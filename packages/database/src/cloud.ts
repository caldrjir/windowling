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
