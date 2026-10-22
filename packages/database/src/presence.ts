import { eq, gte, lt, sql } from 'drizzle-orm';
import type { Database } from './client.ts';
import { presence } from './schema/presence.ts';

/** A tab counts as playing while its last heartbeat is younger than this. */
export const PRESENCE_WINDOW_MS = 60_000;

export interface PresenceCount {
	gameId: string;
	/** Distinct signed-in players (one person in two tabs counts once). */
	signedIn: number;
	/** Anonymous tabs. */
	anonymous: number;
}

/** Records a heartbeat from one tab and prunes rows that went quiet. */
export async function touchPresence(
	db: Database,
	beat: { clientId: string; gameId: string; userId: string | null },
	now = new Date(),
): Promise<void> {
	await db
		.insert(presence)
		.values({ ...beat, lastSeen: now })
		.onConflictDoUpdate({
			target: presence.clientId,
			set: { gameId: beat.gameId, userId: beat.userId, lastSeen: now },
		});
	await db
		.delete(presence)
		.where(lt(presence.lastSeen, new Date(now.getTime() - PRESENCE_WINDOW_MS)));
}

/** The tab closed: stop counting it right away. */
export async function leavePresence(db: Database, clientId: string): Promise<void> {
	await db.delete(presence).where(eq(presence.clientId, clientId));
}

/** Players per game right now. Games nobody plays are left out. */
export async function countPresence(db: Database, now = new Date()): Promise<PresenceCount[]> {
	const since = new Date(now.getTime() - PRESENCE_WINDOW_MS);
	const rows = await db
		.select({
			gameId: presence.gameId,
			signedIn:
				sql<number>`count(distinct ${presence.userId}) filter (where ${presence.userId} is not null)`.mapWith(
					Number,
				),
			anonymous: sql<number>`count(*) filter (where ${presence.userId} is null)`.mapWith(Number),
		})
		.from(presence)
		.where(gte(presence.lastSeen, since))
		.groupBy(presence.gameId);
	return rows;
}
