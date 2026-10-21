import {
	doublePrecision,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core';
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
	/** IANA zone of the player's device - the character lives on that clock (#10). */
	timezone: text().notNull().default('UTC'),
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
	// Life state (Iteration 2). Needs are 0..1, never shown as numbers.
	hunger: doublePrecision().notNull().default(0.3),
	energy: doublePrecision().notNull().default(0.8),
	mood: doublePrecision().notNull().default(0.7),
	/** One of the shared `Activity` values; validated when read. */
	activity: text().notNull().default('idle'),
	activityStartedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	/** An activity that already ended is re-decided on the next catch-up. */
	activityEndsAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	// Money (Iteration 9), in cents. Never shown as a number.
	balanceCents: integer().notNull().default(90_000),
	/** Wages earned since the last payday. */
	unpaidCents: integer().notNull().default(0),
	paidAt: timestamp({ withTimezone: true }),
	// Entrusted money (#70): what the player keeps for it, and its open question.
	entrustedCents: integer().notNull().default(0),
	/** `entrust` | `return`; validated when read. */
	moneyAskKind: text(),
	moneyAskCents: integer(),
	moneyAskAt: timestamp({ withTimezone: true }),
	/** When it last brought money up (it doesn't nag). */
	moneyAskedAt: timestamp({ withTimezone: true }),
	/** Things it owns or waits for (Iteration 10): shared `Belonging`s, validated when read. */
	belongings: jsonb().notNull().default([]),
	...timestamps,
});
