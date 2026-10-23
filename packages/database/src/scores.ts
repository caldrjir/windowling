import { and, asc, desc, eq, gt, lt, sql } from 'drizzle-orm';
import type { Database } from './client.ts';
import { playerProfile } from './schema/cloud.ts';
import { score } from './schema/scores.ts';

/** Units of a board (its last segment): time is better when lower, the rest when higher. */
export const SCORE_UNITS = ['time', 'score', 'survive', 'floor', 'days', 'wins', 'played'] as const;
export type ScoreUnit = (typeof SCORE_UNITS)[number];
export const lowerIsBetter = (board: string) => board.endsWith(':time');

export interface ScoreEntry {
	game: string;
	board: string;
	value: number;
}

/** Keeps each result if it beats the player's best on that board; returns the boards improved. */
export async function submitScores(
	db: Database,
	userId: string,
	entries: ScoreEntry[],
): Promise<string[]> {
	const improved: string[] = [];
	for (const e of entries) {
		const better = lowerIsBetter(e.board)
			? sql`${score.value} > ${e.value}`
			: sql`${score.value} < ${e.value}`;
		const rows = await db
			.insert(score)
			.values({ userId, game: e.game, board: e.board, value: e.value })
			.onConflictDoUpdate({
				target: [score.userId, score.game, score.board],
				set: { value: e.value, achievedAt: new Date() },
				setWhere: better,
			})
			.returning({ board: score.board });
		if (rows.length) improved.push(`${e.game}/${e.board}`);
	}
	return improved;
}

export interface Leaderboard {
	entries: { rank: number; nickname: string; value: number; me: boolean }[];
	me: { rank: number; value: number } | null;
	total: number;
}

/** The best players of a board (only players with a nickname are listed) and the asking player's place. */
export async function leaderboard(
	db: Database,
	game: string,
	board: string,
	{ limit = 20, userId = null }: { limit?: number; userId?: string | null } = {},
): Promise<Leaderboard> {
	const lower = lowerIsBetter(board);
	const where = and(eq(score.game, game), eq(score.board, board));
	const rows = await db
		.select({ userId: score.userId, nickname: playerProfile.nickname, value: score.value })
		.from(score)
		.innerJoin(playerProfile, eq(playerProfile.userId, score.userId))
		.where(where)
		.orderBy(lower ? asc(score.value) : desc(score.value), asc(score.achievedAt))
		.limit(limit);
	const [count] = await db
		.select({ n: sql<number>`count(*)`.mapWith(Number) })
		.from(score)
		.innerJoin(playerProfile, eq(playerProfile.userId, score.userId))
		.where(where);
	// Equal results share a place.
	let rank = 0;
	let prev: number | null = null;
	const entries = rows.map((r, i) => {
		if (r.value !== prev) rank = i + 1;
		prev = r.value;
		return { rank, nickname: r.nickname, value: r.value, me: r.userId === userId };
	});
	let me: Leaderboard['me'] = null;
	if (userId) {
		const [mine] = await db
			.select({ value: score.value })
			.from(score)
			.innerJoin(playerProfile, eq(playerProfile.userId, score.userId))
			.where(and(where, eq(score.userId, userId)));
		if (mine) {
			const [ahead] = await db
				.select({ n: sql<number>`count(*)`.mapWith(Number) })
				.from(score)
				.innerJoin(playerProfile, eq(playerProfile.userId, score.userId))
				.where(and(where, lower ? lt(score.value, mine.value) : gt(score.value, mine.value)));
			me = { rank: (ahead?.n ?? 0) + 1, value: mine.value };
		}
	}
	return { entries, me, total: count?.n ?? 0 };
}
