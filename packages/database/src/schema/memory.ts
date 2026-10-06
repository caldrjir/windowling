import {
	doublePrecision,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core';
import { world } from './world.ts';

/**
 * What the character remembers (Iteration 5). `moment` = episodic (something
 * that happened), `fact` = semantic (something known). Notes are first person
 * and only ever given to the brain - a handful at a time, never the whole list.
 */
export const memory = pgTable(
	'memory',
	{
		id: uuid().primaryKey().defaultRandom(),
		worldId: uuid()
			.notNull()
			.references(() => world.id, { onDelete: 'cascade' }),
		kind: text().notNull(),
		note: text().notNull(),
		tags: text().array().notNull().default([]),
		importance: doublePrecision().notNull(),
		/** The emotion it was felt with, if any. */
		emotion: text(),
		/** World time of the memory (not insertion time). */
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index('memory_world_created_idx').on(t.worldId, t.createdAt)],
);

/**
 * How the character feels about someone. `subject` is `player` for now;
 * NPCs (Iteration 12) get their own rows.
 */
export const relationship = pgTable(
	'relationship',
	{
		worldId: uuid()
			.notNull()
			.references(() => world.id, { onDelete: 'cascade' }),
		subject: text().notNull(),
		affinity: doublePrecision().notNull().default(0),
		trust: doublePrecision().notNull().default(0.3),
		familiarity: doublePrecision().notNull().default(0),
		conversations: integer().notNull().default(0),
		wakeUps: integer().notNull().default(0),
		updatedAt: timestamp({ withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [primaryKey({ columns: [t.worldId, t.subject] })],
);
