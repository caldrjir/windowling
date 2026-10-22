/**
 * Who is playing right now. Every open game tab sends a heartbeat; a row whose
 * `lastSeen` is older than the presence window no longer counts and is pruned.
 * `userId` is set when the player is signed in, null for anonymous players.
 */
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

export const presence = pgTable(
	'presence',
	{
		/** Random id of one browser tab (not linked to a person). */
		clientId: text().primaryKey(),
		gameId: text().notNull(),
		userId: text().references(() => user.id, { onDelete: 'cascade' }),
		lastSeen: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index('presence_last_seen_idx').on(t.lastSeen)],
);
