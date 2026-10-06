import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTestDatabaseUrl } from '../test/test-database.ts';
import { createDatabase, type DatabaseConnection } from './client.ts';
import {
	getRelationship,
	loadMemories,
	MAX_MOMENTS,
	recordConversation,
	recordRelationshipEvent,
	remember,
} from './memories.ts';
import { user } from './schema/index.ts';
import { getOrCreateWorldForUser, wakeCharacter } from './worlds.ts';

const url = getTestDatabaseUrl();

describe.skipIf(!url)('memories and relationship (postgres)', () => {
	let conn: DatabaseConnection;
	const users: string[] = [];

	beforeAll(() => {
		conn = createDatabase(url!, { max: 4 });
	});

	afterAll(async () => {
		if (users.length) await conn.db.delete(user).where(inArray(user.id, users));
		await conn.close();
	});

	async function newWorld(now?: Date) {
		const id = randomUUID();
		await conn.db.insert(user).values({ id, name: 'P', email: `${id}@test.windowling.local` });
		users.push(id);
		return getOrCreateWorldForUser(conn.db, id, { now, timeZone: 'Europe/Prague' });
	}

	it('starts as strangers and changes with events, atomically', async () => {
		const world = await newWorld();
		expect(await getRelationship(conn.db, world.id)).toEqual({
			affinity: 0,
			trust: 0.3,
			familiarity: 0,
		});
		await Promise.all(
			Array.from({ length: 5 }, () =>
				recordRelationshipEvent(conn.db, world.id, { type: 'visit' }),
			),
		);
		expect((await getRelationship(conn.db, world.id)).familiarity).toBeCloseTo(0.15, 5);
	});

	it('stores memories with tags and keeps facts while pruning old trivial moments', async () => {
		const world = await newWorld();
		await remember(conn.db, world.id, {
			kind: 'fact',
			note: "The player's name is Jiri.",
			importance: 0.9,
		});
		const base = new Date('2026-01-01T00:00:00Z').getTime();
		for (let i = 0; i < MAX_MOMENTS + 5; i++) {
			await remember(conn.db, world.id, {
				kind: 'moment',
				note: `Moment number ${i}`,
				importance: i < 5 ? 0.01 : 0.5,
				createdAt: new Date(base + i * 60_000),
			});
		}
		const all = await loadMemories(conn.db, world.id);
		expect(all.some((m) => m.kind === 'fact' && m.tags.includes('jiri'))).toBe(true);
		expect(all.some((m) => m.note === 'Moment number 0')).toBe(false);
		expect(all.filter((m) => m.kind === 'moment').length).toBeLessThanOrEqual(150);
	}, 60_000);

	it('turns conversations into relationship changes and memories', async () => {
		const world = await newWorld();
		await recordConversation(conn.db, world.id, {
			event: 'player_at_window',
			emotion: 'surprised',
			intensity: 0.4,
		});
		const after = await recordConversation(conn.db, world.id, {
			event: 'player_said',
			playerUtterance: 'My name is Jiri',
			emotion: 'happy',
			intensity: 0.8,
			remember: { kind: 'fact', note: 'The player told me their name is Jiri.' },
		});
		expect(after.affinity).toBeGreaterThan(0);
		expect(after.familiarity).toBeGreaterThan(0.03);
		const notes = (await loadMemories(conn.db, world.id)).map((m) => m.note);
		expect(notes).toContain('I noticed someone watching me through my window for the first time.');
		expect(notes).toContain('The player said: "My name is Jiri"');
		expect(notes).toContain('The player told me their name is Jiri.');
	});

	it('remembers being knocked awake and holds it against the player', async () => {
		const night = new Date('2026-10-05T01:00:00Z'); // 03:00 Monday in Prague
		const world = await newWorld(night);
		const woken = await wakeCharacter(
			conn.db,
			world.userId,
			new Date(night.getTime() + 12 * 60_000),
		);
		expect(woken).not.toBeNull();
		const notes = (await loadMemories(conn.db, world.id)).map((m) => m.note);
		expect(notes).toContain('Someone knocked on my window at 03:12 on Monday and woke me up.');
		expect((await getRelationship(conn.db, world.id)).affinity).toBeLessThan(0);
	});
});
