import { eq, sql } from 'drizzle-orm';
import type { Database } from './client.ts';
import { gameSave, playerProfile } from './schema/cloud.ts';

/** Limits per account: one value and all values together (characters). */
export const MAX_SAVE_VALUE = 1_000_000;
export const MAX_SAVE_TOTAL = 8_000_000;
export const MAX_SAVE_KEYS = 200;

export interface SaveEntry {
	key: string;
	/** null when the key was removed. */
	data: string | null;
	/** When the value was written on the device (ms since epoch). */
	t: number;
}

/** Everything stored for the player. */
export async function listSaves(db: Database, userId: string): Promise<SaveEntry[]> {
	return db
		.select({ key: gameSave.key, data: gameSave.data, t: gameSave.t })
		.from(gameSave)
		.where(eq(gameSave.userId, userId));
}

/**
 * Stores values that are newer than what the account has (last write wins per key).
 * Returns the keys that were stored; older values are ignored.
 */
export async function putSaves(
	db: Database,
	userId: string,
	entries: SaveEntry[],
): Promise<{ stored: string[]; rejected: 'too-large' | null }> {
	if (!entries.length) return { stored: [], rejected: null };
	const existing = await db
		.select({
			key: gameSave.key,
			size: sql<number>`coalesce(length(${gameSave.data}), 0)`.mapWith(Number),
		})
		.from(gameSave)
		.where(eq(gameSave.userId, userId));
	const sizes = new Map(existing.map((r) => [r.key, r.size]));
	for (const e of entries) sizes.set(e.key, e.data?.length ?? 0);
	const total = [...sizes.values()].reduce((a, b) => a + b, 0);
	if (total > MAX_SAVE_TOTAL || sizes.size > MAX_SAVE_KEYS)
		return { stored: [], rejected: 'too-large' };

	const stored: string[] = [];
	for (const e of entries) {
		const rows = await db
			.insert(gameSave)
			.values({ userId, key: e.key, data: e.data, t: e.t })
			.onConflictDoUpdate({
				target: [gameSave.userId, gameSave.key],
				set: { data: e.data, t: e.t, updatedAt: new Date() },
				setWhere: sql`${gameSave.t} < ${e.t}`,
			})
			.returning({ key: gameSave.key });
		if (rows.length) stored.push(e.key);
	}
	return { stored, rejected: null };
}

export async function getNickname(db: Database, userId: string): Promise<string | null> {
	const [row] = await db
		.select({ nickname: playerProfile.nickname })
		.from(playerProfile)
		.where(eq(playerProfile.userId, userId));
	return row?.nickname ?? null;
}

/** Sets the player's nickname; false when another player already has it (any letter case). */
export async function setNickname(
	db: Database,
	userId: string,
	nickname: string,
): Promise<boolean> {
	const [taken] = await db
		.select({ userId: playerProfile.userId })
		.from(playerProfile)
		.where(sql`lower(${playerProfile.nickname}) = lower(${nickname})`);
	if (taken && taken.userId !== userId) return false;
	try {
		await db
			.insert(playerProfile)
			.values({ userId, nickname })
			.onConflictDoUpdate({ target: playerProfile.userId, set: { nickname } });
		return true;
	} catch {
		// Lost a race for the same nickname (unique index).
		return false;
	}
}

export interface KeyCounts {
	/** Saves of the key with valid JSON (players who played the game while signed in). */
	total: number;
	/** How many of them hold each property of the object `field` (e.g. each achievement). */
	counts: Record<string, number>;
}

/**
 * Counts, over every player's save of one key, the properties of a JSON object inside it:
 * `keyCounts(db, 'voidborn.save.v1', 'achievements')` says how many players have each
 * achievement. Values that are not valid JSON are skipped instead of failing the query.
 */
export async function keyCounts(db: Database, key: string, field: string): Promise<KeyCounts> {
	const rows = await db.execute<{ total: number; counts: Record<string, number> | null }>(sql`
		with s as materialized (
			select ${gameSave.data}::jsonb -> ${field} as o from ${gameSave}
			where ${gameSave.key} = ${key} and ${gameSave.data} is not null
				and pg_input_is_valid(${gameSave.data}, 'jsonb')
		), c as (
			select k, count(*)::int as n
			from s, jsonb_object_keys(case when jsonb_typeof(s.o) = 'object' then s.o else '{}'::jsonb end) as k
			group by k
		)
		select (select count(*)::int from s) as total, (select jsonb_object_agg(k, n) from c) as counts`);
	const row = rows[0];
	return { total: Number(row?.total ?? 0), counts: row?.counts ?? {} };
}
