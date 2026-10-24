import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getTestDatabaseUrl } from '../test/test-database.ts';
import { createDatabase } from './client.ts';
import {
	countPresence,
	leavePresence,
	PRESENCE_WINDOW_MS,
	siteStats,
	touchPresence,
} from './presence.ts';
import { presence, user, visitor } from './schema/index.ts';

const url = getTestDatabaseUrl();

describe.skipIf(!url)('presence', () => {
	const conn = url ? createDatabase(url, { max: 1 }) : null;
	const db = () => {
		if (!conn) throw new Error('no test database');
		return conn.db;
	};
	const now = new Date('2026-10-22T20:00:00Z');

	beforeEach(async () => {
		await db().delete(presence);
		await db().delete(visitor);
		await db().delete(user);
		await db()
			.insert(user)
			.values([
				{ id: 'u1', name: 'Ann', email: 'ann@example.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@example.com' },
			]);
	});
	afterAll(async () => {
		await db().delete(presence);
		await db().delete(visitor);
		await db().delete(user);
		await conn?.close();
	});

	it('counts signed-in people and anonymous tabs per game', async () => {
		await touchPresence(db(), { clientId: 'a', gameId: 'voidborn', userId: 'u1' }, now);
		// The same person in a second tab counts once.
		await touchPresence(db(), { clientId: 'b', gameId: 'voidborn', userId: 'u1' }, now);
		await touchPresence(db(), { clientId: 'c', gameId: 'voidborn', userId: null }, now);
		await touchPresence(db(), { clientId: 'd', gameId: 'starspire', userId: 'u2' }, now);
		await touchPresence(db(), { clientId: 'e', gameId: 'starspire', userId: null }, now);
		await touchPresence(db(), { clientId: 'f', gameId: 'starspire', userId: null }, now);

		const counts = await countPresence(db(), now);
		expect(counts.sort((x, y) => x.gameId.localeCompare(y.gameId))).toEqual([
			{ gameId: 'starspire', signedIn: 1, anonymous: 2 },
			{ gameId: 'voidborn', signedIn: 1, anonymous: 1 },
		]);
	});

	it('follows a tab to another game and stops counting it when it leaves', async () => {
		await touchPresence(db(), { clientId: 'a', gameId: 'voidborn', userId: null }, now);
		await touchPresence(db(), { clientId: 'a', gameId: 'starspire', userId: null }, now);
		expect(await countPresence(db(), now)).toEqual([
			{ gameId: 'starspire', signedIn: 0, anonymous: 1 },
		]);
		await leavePresence(db(), 'a');
		expect(await countPresence(db(), now)).toEqual([]);
	});

	it('forgets tabs that went quiet', async () => {
		await touchPresence(db(), { clientId: 'old', gameId: 'voidborn', userId: null }, now);
		const later = new Date(now.getTime() + PRESENCE_WINDOW_MS + 1000);
		expect(await countPresence(db(), later)).toEqual([]);
		// The next heartbeat prunes the stale row.
		await touchPresence(db(), { clientId: 'new', gameId: 'voidborn', userId: null }, later);
		expect(await db().select().from(presence)).toHaveLength(1);
	});

	it('counts people on the site now, this month and ever', async () => {
		const day = 86_400_000;
		const old = new Date(now.getTime() - 40 * day);
		// A visitor from 40 days ago, one from last week, and today: an anonymous person with the
		// hub and a game open, and a signed-in person in a game.
		await touchPresence(
			db(),
			{ clientId: 'x', gameId: 'hub', userId: null, visitorId: 'v-old' },
			old,
		);
		await touchPresence(
			db(),
			{ clientId: 'y', gameId: 'hub', userId: null, visitorId: 'v-week' },
			new Date(now.getTime() - 7 * day),
		);
		await touchPresence(db(), { clientId: 'a', gameId: 'hub', userId: null, visitorId: 'v1' }, now);
		await touchPresence(
			db(),
			{ clientId: 'b', gameId: 'sudoku', userId: null, visitorId: 'v1' },
			now,
		);
		await touchPresence(
			db(),
			{ clientId: 'c', gameId: 'voidborn', userId: 'u1', visitorId: 'v2' },
			now,
		);

		expect(await siteStats(db(), now)).toEqual({
			online: 2,
			visitors: { month: 3, total: 4 },
			accounts: 2,
		});
		// The visitor keeps its first visit and learns the account.
		const [v2] = await db().select().from(visitor).where(eq(visitor.id, 'v2'));
		expect(v2?.userId).toBe('u1');
	});
});
