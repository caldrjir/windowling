import { date, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

/**
 * How many language-model calls a player used per (UTC) day. Protects the
 * shared free tier of the cloud brain; on-device models don't count.
 */
export const aiUsage = pgTable(
	'ai_usage',
	{
		userId: text()
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		day: date({ mode: 'string' }).notNull(),
		count: integer().notNull().default(0),
	},
	(t) => [primaryKey({ columns: [t.userId, t.day] })],
);
