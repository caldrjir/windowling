import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

const timestamps = {
	createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp({ withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
};

/**
 * One persistent world per player. Anonymous players are real Better Auth
 * users (`user.isAnonymous = true`), so ownership is always a user id and
 * "linking" an anonymous world to a Google account is an ownership transfer.
 * The unique constraint guarantees a user can never end up with two worlds.
 */
export const world = pgTable('world', {
	id: uuid().primaryKey().defaultRandom(),
	userId: text()
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	lastSimulatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	...timestamps,
});

/** Exactly one character per world for now (enforced by the unique world_id). */
export const character = pgTable('character', {
	id: uuid().primaryKey().defaultRandom(),
	worldId: uuid()
		.notNull()
		.unique()
		.references(() => world.id, { onDelete: 'cascade' }),
	name: text().notNull(),
	...timestamps,
});
