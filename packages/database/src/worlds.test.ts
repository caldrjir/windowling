import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTestDatabaseUrl } from '../test/test-database.ts';
import { createDatabase, type DatabaseConnection } from './client.ts';
import { user } from './schema/index.ts';
import {
	catchUpWorld,
	findWorldByUserId,
	getOrCreateWorldForUser,
	transferWorldOwnership,
	updateWorldTimeZone,
} from './worlds.ts';

const url = getTestDatabaseUrl();

describe.skipIf(!url)('worlds repository (postgres)', () => {
	let conn: DatabaseConnection;
	const createdUsers: string[] = [];

	async function createUser(isAnonymous: boolean) {
		const id = randomUUID();
		await conn.db.insert(user).values({
			id,
			name: isAnonymous ? 'Anonymous' : 'Player',
			email: `${id}@test.windowling.local`,
			isAnonymous,
		});
		createdUsers.push(id);
		return id;
	}

	beforeAll(() => {
		conn = createDatabase(url!, { max: 4 });
	});

	afterAll(async () => {
		if (createdUsers.length) await conn.db.delete(user).where(inArray(user.id, createdUsers));
		await conn.close();
	});

	it('creates a world with a character for a new user', async () => {
		const userId = await createUser(true);
		const world = await getOrCreateWorldForUser(conn.db, userId);
		expect(world.userId).toBe(userId);
		expect(world.character.name.length).toBeGreaterThan(0);
	});

	it('is idempotent, including under concurrent calls', async () => {
		const userId = await createUser(true);
		const results = await Promise.all(
			Array.from({ length: 5 }, () => getOrCreateWorldForUser(conn.db, userId)),
		);
		const ids = new Set(results.map((w) => w.id));
		expect(ids.size).toBe(1);
		expect((await getOrCreateWorldForUser(conn.db, userId)).id).toBe(results[0]!.id);
	});

	it('transfers an anonymous world to a fresh account without creating a new one', async () => {
		const anonId = await createUser(true);
		const accountId = await createUser(false);
		const anonWorld = await getOrCreateWorldForUser(conn.db, anonId);

		expect(await transferWorldOwnership(conn.db, anonId, accountId)).toBe('transferred');

		const linked = await findWorldByUserId(conn.db, accountId);
		expect(linked?.id).toBe(anonWorld.id);
		expect(linked?.character.id).toBe(anonWorld.character.id);
		expect(await findWorldByUserId(conn.db, anonId)).toBeNull();
	});

	it('keeps the existing world when the account already has one', async () => {
		const anonId = await createUser(true);
		const accountId = await createUser(false);
		const anonWorld = await getOrCreateWorldForUser(conn.db, anonId);
		const accountWorld = await getOrCreateWorldForUser(conn.db, accountId);

		expect(await transferWorldOwnership(conn.db, anonId, accountId)).toBe('target-has-world');
		expect((await findWorldByUserId(conn.db, accountId))?.id).toBe(accountWorld.id);
		expect((await findWorldByUserId(conn.db, anonId))?.id).toBe(anonWorld.id);
	});

	it('reports when there is nothing to transfer', async () => {
		const anonId = await createUser(true);
		const accountId = await createUser(false);
		expect(await transferWorldOwnership(conn.db, anonId, accountId)).toBe('no-source-world');
	});

	it('only ever moves the simulation clock forward', async () => {
		const userId = await createUser(true);
		const start = new Date('2026-01-01T10:00:00.000Z');
		const world = await getOrCreateWorldForUser(conn.db, userId, { now: start });

		const later = new Date('2026-01-01T12:00:00.000Z');
		const advanced = await catchUpWorld(conn.db, world, later);
		expect(advanced.lastSimulatedAt).toEqual(later);

		const stale = await catchUpWorld(conn.db, world, new Date('2026-01-01T11:00:00.000Z'));
		expect(stale.lastSimulatedAt.getTime()).toBeLessThanOrEqual(later.getTime());
		expect((await findWorldByUserId(conn.db, userId))?.lastSimulatedAt).toEqual(later);
	});

	it('starts a life in the device time zone', async () => {
		const userId = await createUser(true);
		// 02:00 in Prague: a new character starts the night asleep.
		const now = new Date('2026-10-05T00:00:00.000Z');
		const world = await getOrCreateWorldForUser(conn.db, userId, {
			now,
			timeZone: 'Europe/Prague',
		});
		expect(world.timeZone).toBe('Europe/Prague');
		expect(world.character.life.activity).toBe('sleep');
		expect(world.character.life.activityEndsAt.getTime()).toBeGreaterThan(now.getTime());
	});

	it('falls back to UTC for an unknown time zone', async () => {
		const userId = await createUser(true);
		const world = await getOrCreateWorldForUser(conn.db, userId, { timeZone: 'Nowhere/Land' });
		expect(world.timeZone).toBe('UTC');
	});

	it('persists needs and activities while the app is closed', async () => {
		const userId = await createUser(true);
		const start = new Date('2026-10-05T06:00:00.000Z'); // Monday 08:00 in Prague
		const world = await getOrCreateWorldForUser(conn.db, userId, {
			now: start,
			timeZone: 'Europe/Prague',
		});

		// Back on Monday at 13:00 local: hours of life have happened in between.
		const later = new Date('2026-10-05T11:00:00.000Z');
		const advanced = await catchUpWorld(conn.db, world, later);
		expect(advanced.character.life.activityEndsAt.getTime()).toBeGreaterThan(later.getTime());
		expect(advanced.character.life.activityStartedAt.getTime()).toBeLessThanOrEqual(
			later.getTime(),
		);

		const reloaded = await findWorldByUserId(conn.db, userId);
		expect(reloaded?.character.life).toEqual(advanced.character.life);
		expect(reloaded?.lastSimulatedAt).toEqual(later);
	});

	it('follows the device into another time zone', async () => {
		const userId = await createUser(true);
		const world = await getOrCreateWorldForUser(conn.db, userId, { timeZone: 'Europe/Prague' });
		const moved = await updateWorldTimeZone(conn.db, world, 'America/New_York');
		expect(moved.timeZone).toBe('America/New_York');
		expect((await findWorldByUserId(conn.db, userId))?.timeZone).toBe('America/New_York');
		const ignored = await updateWorldTimeZone(conn.db, moved, 'Not/AZone');
		expect(ignored.timeZone).toBe('America/New_York');
	});
});
