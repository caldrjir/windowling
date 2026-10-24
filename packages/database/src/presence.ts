import { count, eq, gte, lt, sql } from 'drizzle-orm';
import type { Database } from './client.ts';
import { user } from './schema/auth.ts';
import { presence, visitor } from './schema/presence.ts';

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
	beat: { clientId: string; gameId: string; userId: string | null; visitorId?: string | null },
	now = new Date(),
): Promise<void> {
	const visitorId = beat.visitorId ?? null;
	await db
		.insert(presence)
		.values({ ...beat, visitorId, lastSeen: now })
		.onConflictDoUpdate({
			target: presence.clientId,
			set: { gameId: beat.gameId, userId: beat.userId, visitorId, lastSeen: now },
		});
	if (visitorId)
		await db
			.insert(visitor)
			.values({ id: visitorId, userId: beat.userId, firstSeen: now, lastSeen: now })
			.onConflictDoUpdate({
				target: visitor.id,
				set: { lastSeen: now, userId: sql`coalesce(${beat.userId}, ${visitor.userId})` },
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

/** Days a visitor counts as active for the monthly number. */
export const ACTIVE_DAYS = 30;

export interface SiteStats {
	/** People on the site right now (hub or a game); one person in several tabs counts once. */
	online: number;
	/** Browsers that used the site in the last 30 days, and ever. */
	visitors: { month: number; total: number };
	/** Player accounts. */
	accounts: number;
}

/** How many people use the center: now, this month, ever, and accounts. */
export async function siteStats(db: Database, now = new Date()): Promise<SiteStats> {
	const since = new Date(now.getTime() - PRESENCE_WINDOW_MS);
	const month = new Date(now.getTime() - ACTIVE_DAYS * 86_400_000);
	const [online] = await db
		.select({
			n: sql<number>`count(distinct coalesce(${presence.userId}, ${presence.visitorId}, ${presence.clientId}))`.mapWith(
				Number,
			),
		})
		.from(presence)
		.where(gte(presence.lastSeen, since));
	const [visitors] = await db
		.select({
			total: count(),
			month:
				sql<number>`count(*) filter (where ${visitor.lastSeen} >= ${month.toISOString()})`.mapWith(
					Number,
				),
		})
		.from(visitor);
	const [accounts] = await db.select({ n: count() }).from(user);
	return {
		online: online?.n ?? 0,
		visitors: { month: visitors?.month ?? 0, total: visitors?.total ?? 0 },
		accounts: accounts?.n ?? 0,
	};
}
