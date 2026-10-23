/**
 * Progress kept in the player's account so it follows them across devices.
 * `game_save` mirrors the browser's localStorage keys of the games (one row per key,
 * the value exactly as the game stored it); `t` is when the value was last written on
 * a device (milliseconds), so the newest write wins. `player_profile` holds the
 * nickname chosen after the first sign-in.
 */
import { bigint, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.ts';

export const gameSave = pgTable(
	'game_save',
	{
		userId: text()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		key: text().notNull(),
		/** null: the game removed the key (kept so other devices remove it too). */
		data: text(),
		t: bigint({ mode: 'number' }).notNull(),
		updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export const playerProfile = pgTable(
	'player_profile',
	{
		userId: text()
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		nickname: text().notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp({ withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	// Nicknames are unique regardless of letter case.
	(t) => [uniqueIndex('player_profile_nickname_idx').on(sql`lower(${t.nickname})`)],
);
