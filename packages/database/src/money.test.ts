import { randomUUID } from 'node:crypto';
import { ITEMS } from '@windowling/shared';
import { DOLLAR } from '@windowling/simulation';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTestDatabaseUrl } from '../test/test-database.ts';
import { createDatabase, type DatabaseConnection } from './client.ts';
import { getRelationship, loadMemories, PLAYER } from './memories.ts';
import { answerMoney, bringUpMoney, buyGiftFor, giveBackMoney } from './money.ts';
import { character, relationship, user, world } from './schema/index.ts';
import { catchUpWorld, findWorldByUserId, getOrCreateWorldForUser } from './worlds.ts';

const url = getTestDatabaseUrl();
// Mid-month Wednesday evening: no rent worries.
const NOW = new Date('2026-10-14T16:00:00.000Z');

describe.skipIf(!url)('entrusted money (postgres)', () => {
	let conn: DatabaseConnection;
	const createdUsers: string[] = [];

	/** A world whose character has savings and knows and trusts the player. */
	async function friendWithSavings(balanceDollars = 2_000) {
		const id = randomUUID();
		await conn.db.insert(user).values({
			id,
			name: 'Player',
			email: `${id}@test.windowling.local`,
			isAnonymous: true,
		});
		createdUsers.push(id);
		const created = await getOrCreateWorldForUser(conn.db, id, { now: NOW, timeZone: 'UTC' });
		await conn.db
			.update(character)
			.set({ balanceCents: balanceDollars * DOLLAR })
			.where(eq(character.worldId, created.id));
		await conn.db.insert(relationship).values({
			worldId: created.id,
			subject: PLAYER,
			affinity: 0.5,
			trust: 0.7,
			familiarity: 0.5,
		});
		await conn.db.update(world).set({ lastSimulatedAt: NOW }).where(eq(world.id, created.id));
		return { userId: id, worldId: created.id };
	}

	beforeAll(() => {
		conn = createDatabase(url!, { max: 4 });
	});

	afterAll(async () => {
		if (createdUsers.length) await conn.db.delete(user).where(inArray(user.id, createdUsers));
		await conn.close();
	});

	it('asks a trusted player to keep some savings; yes moves the money exactly once', async () => {
		const { userId, worldId } = await friendWithSavings();
		const moment = await bringUpMoney(conn.db, userId, NOW);
		expect(moment?.ask?.kind).toBe('entrust');
		const cents = moment?.ask?.cents ?? 0;
		expect(cents).toBeGreaterThan(0);

		const before = (await findWorldByUserId(conn.db, userId))?.character.life.money.balance ?? 0;
		const soon = new Date(NOW.getTime() + 30_000);
		// Two tabs answer at once: only one can win.
		const answers = await Promise.all([
			answerMoney(conn.db, userId, true, soon),
			answerMoney(conn.db, userId, true, soon),
		]);
		expect(answers.filter(Boolean)).toHaveLength(1);
		const after = await findWorldByUserId(conn.db, userId);
		expect(after?.character.envelope.cents).toBe(cents);
		expect(after?.character.envelope.ask).toBeNull();
		expect(after?.character.life.money.balance).toBe(before - cents);

		const memories = await loadMemories(conn.db, worldId);
		expect(memories.some((m) => /gave the player \$\d+ of my savings/.test(m.note))).toBe(true);
		// Doesn't ask again right away.
		expect((await bringUpMoney(conn.db, userId, soon))?.ask).toBeNull();
	});

	it('remembers being refused its own money, and trusts the player less', async () => {
		const { userId, worldId } = await friendWithSavings();
		await bringUpMoney(conn.db, userId, NOW);
		await answerMoney(conn.db, userId, true, NOW);
		// Then it runs out of money.
		await conn.db
			.update(character)
			.set({ balanceCents: 20 * DOLLAR, moneyAskedAt: null })
			.where(eq(character.worldId, worldId));
		const later = new Date(NOW.getTime() + 60_000);
		const ask = await bringUpMoney(conn.db, userId, later);
		expect(ask?.ask?.kind).toBe('return');
		const trustBefore = (await getRelationship(conn.db, worldId)).trust;
		const refused = await answerMoney(conn.db, userId, false, later);
		expect(refused?.outcome).toBe('withheld');
		expect((await getRelationship(conn.db, worldId)).trust).toBeLessThan(trustBefore);
		const memories = await loadMemories(conn.db, worldId);
		expect(memories.some((m) => /would not give it to me/.test(m.note))).toBe(true);
	});

	it('takes everything back when the player returns it unasked; nothing to return twice', async () => {
		const { userId } = await friendWithSavings();
		await bringUpMoney(conn.db, userId, NOW);
		const entrusted = await answerMoney(conn.db, userId, true, NOW);
		const back = await giveBackMoney(conn.db, userId, NOW);
		expect(back?.outcome).toBe('returned_unasked');
		expect(back?.cents).toBe(entrusted?.cents);
		expect(back?.envelope).toBe(0);
		expect(await giveBackMoney(conn.db, userId, NOW)).toBeNull();
		// An answer with no open question moves nothing.
		expect(await answerMoney(conn.db, userId, true, NOW)).toBeNull();
	});

	it('buys a gift from the envelope - only with enough in it, never twice; it arrives and is remembered', async () => {
		const { userId, worldId } = await friendWithSavings();
		// No envelope yet: nothing to pay with.
		expect(await buyGiftFor(conn.db, userId, 'plant', NOW)).toEqual({
			ok: false,
			reason: 'not_enough',
		});
		await bringUpMoney(conn.db, userId, NOW);
		const entrusted = await answerMoney(conn.db, userId, true, NOW);
		const bought = await buyGiftFor(conn.db, userId, 'plant', NOW);
		expect(bought).toEqual({
			ok: true,
			item: 'plant',
			envelope: (entrusted?.envelope ?? 0) - ITEMS.plant.price,
		});
		expect(await buyGiftFor(conn.db, userId, 'plant', NOW)).toEqual({ ok: false, reason: 'owned' });
		const after = await findWorldByUserId(conn.db, userId);
		expect(after?.character.envelope.cents).toBe(bought?.ok ? bought.envelope : -1);
		expect(after?.character.life.belongings.find((b) => b.item === 'plant')?.gift).toBe(true);

		// Two days later the parcel has come and been unpacked - and it knows who sent it.
		const found = await findWorldByUserId(conn.db, userId);
		if (!found) throw new Error('world');
		await catchUpWorld(conn.db, found, new Date(NOW.getTime() + 2 * 24 * 3600e3));
		const memories = await loadMemories(conn.db, worldId);
		expect(
			memories.some((m) => /The player (bought me|spent my savings on) a floor plant/.test(m.note)),
		).toBe(true);
	});
});
