/**
 * Leaderboards: a signed-in player's best result per game and board. A board groups
 * results that are comparable (the same daily puzzle, the same Path level, the same rules):
 * `<scope>:<unit>`, e.g. `daily:2026-10-23:time`, `best:floor` or `total:played` (play time). The unit decides whether
 * lower (time) or higher (everything else) is better.
 */
import { bigint, index, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

export const score = pgTable(
	'score',
	{
		userId: text()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		game: text().notNull(),
		board: text().notNull(),
		value: bigint({ mode: 'number' }).notNull(),
		achievedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.game, t.board] }),
		index('score_board_idx').on(t.game, t.board, t.value),
	],
);
