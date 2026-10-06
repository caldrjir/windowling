import { NEW_ACQUAINTANCE, type Relationship } from '@windowling/shared';
import {
	applyRelationshipEvent,
	emotionValence as emotionValenceOf,
	tagsFor,
	type Memory,
	type RelationshipEvent,
} from '@windowling/simulation';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from './client.ts';
import { memory, relationship } from './schema/index.ts';

export const PLAYER = 'player';
/** Moments kept per world; facts are never pruned. */
export const MAX_MOMENTS = 300;
/** How many recent moments are considered for recall (facts are always considered). */
const RECALL_POOL = 150;

export interface NewMemory {
	kind: Memory['kind'];
	note: string;
	importance: number;
	/** Extra tags besides the note's keywords (e.g. the event type). */
	tags?: string[];
	emotion?: string;
	createdAt?: Date;
}

export interface StoredMemory extends Memory {
	id: string;
}

/** Stores a memory and forgets the least valuable moments beyond MAX_MOMENTS. */
export async function remember(db: Database, worldId: string, entry: NewMemory): Promise<void> {
	await db.insert(memory).values({
		worldId,
		kind: entry.kind,
		note: entry.note.trim().slice(0, 200),
		tags: tagsFor(entry.note, entry.tags),
		importance: Math.min(1, Math.max(0, entry.importance)),
		emotion: entry.emotion ?? null,
		createdAt: entry.createdAt ?? new Date(),
	});

	const [counted] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(memory)
		.where(and(eq(memory.worldId, worldId), eq(memory.kind, 'moment')));
	const excess = (counted?.n ?? 0) - MAX_MOMENTS;
	if (excess > 0) {
		const victims = await db
			.select({ id: memory.id })
			.from(memory)
			.where(and(eq(memory.worldId, worldId), eq(memory.kind, 'moment')))
			.orderBy(asc(memory.importance), asc(memory.createdAt))
			.limit(excess);
		await db.delete(memory).where(
			inArray(
				memory.id,
				victims.map((v) => v.id),
			),
		);
	}
}

/** Candidates for recall: every fact plus the most recent moments. */
export async function loadMemories(db: Database, worldId: string): Promise<StoredMemory[]> {
	const columns = {
		id: memory.id,
		kind: memory.kind,
		note: memory.note,
		tags: memory.tags,
		importance: memory.importance,
		createdAt: memory.createdAt,
	};
	const [facts, moments] = await Promise.all([
		db
			.select(columns)
			.from(memory)
			.where(and(eq(memory.worldId, worldId), eq(memory.kind, 'fact'))),
		db
			.select(columns)
			.from(memory)
			.where(and(eq(memory.worldId, worldId), eq(memory.kind, 'moment')))
			.orderBy(desc(memory.createdAt))
			.limit(RECALL_POOL),
	]);
	return [...facts, ...moments].map((row) => ({
		...row,
		kind: row.kind === 'fact' ? 'fact' : 'moment',
	}));
}

export async function getRelationship(
	db: Database,
	worldId: string,
	subject = PLAYER,
): Promise<Relationship> {
	const [row] = await db
		.select({
			affinity: relationship.affinity,
			trust: relationship.trust,
			familiarity: relationship.familiarity,
		})
		.from(relationship)
		.where(and(eq(relationship.worldId, worldId), eq(relationship.subject, subject)));
	return row ?? NEW_ACQUAINTANCE;
}

/**
 * Applies an event to the relationship atomically (row lock), so two tabs
 * talking at once can't lose an update.
 */
export async function recordRelationshipEvent(
	db: Database,
	worldId: string,
	event: RelationshipEvent,
	subject = PLAYER,
): Promise<Relationship> {
	return db.transaction(async (tx) => {
		await tx
			.insert(relationship)
			.values({ worldId, subject, ...NEW_ACQUAINTANCE })
			.onConflictDoNothing();
		const [current] = await tx
			.select({
				affinity: relationship.affinity,
				trust: relationship.trust,
				familiarity: relationship.familiarity,
			})
			.from(relationship)
			.where(and(eq(relationship.worldId, worldId), eq(relationship.subject, subject)))
			.for('update');
		const next = applyRelationshipEvent(current ?? NEW_ACQUAINTANCE, event);
		await tx
			.update(relationship)
			.set({
				...next,
				...(event.type === 'conversation'
					? { conversations: sql`${relationship.conversations} + 1` }
					: {}),
				...(event.type === 'woken' ? { wakeUps: sql`${relationship.wakeUps} + 1` } : {}),
			})
			.where(and(eq(relationship.worldId, worldId), eq(relationship.subject, subject)));
		return next;
	});
}

/** What a conversation step produced - structural, so this package needs no AI types. */
export interface ConversationOutcome {
	event: 'player_at_window' | 'woken_up' | 'player_said' | 'ignoring_player' | 'player_silent';
	playerUtterance?: string;
	emotion: string;
	intensity: number;
	remember?: { kind: 'moment' | 'fact'; note: string };
}

/**
 * The single place where conversations leave traces: relationship changes and
 * memories. Used by the cloud brain and by on-device brains reporting back.
 */
export async function recordConversation(
	db: Database,
	worldId: string,
	outcome: ConversationOutcome,
	now: Date = new Date(),
): Promise<Relationship> {
	const before = await getRelationship(db, worldId);
	let after = before;
	switch (outcome.event) {
		case 'player_at_window':
			after = await recordRelationshipEvent(db, worldId, { type: 'visit' });
			if (before.familiarity === 0) {
				await remember(db, worldId, {
					kind: 'moment',
					note: 'I noticed someone watching me through my window for the first time.',
					importance: 0.6,
					tags: ['player', 'window', 'first'],
					createdAt: now,
				});
			}
			break;
		case 'player_said':
			after = await recordRelationshipEvent(db, worldId, {
				type: 'conversation',
				valence: emotionValenceOf(outcome.emotion),
				intensity: outcome.intensity,
			});
			if (outcome.playerUtterance) {
				await remember(db, worldId, {
					kind: 'moment',
					note: `The player said: "${outcome.playerUtterance.slice(0, 140)}"`,
					importance: 0.25,
					tags: ['player', 'said'],
					emotion: outcome.emotion,
					createdAt: now,
				});
			}
			break;
		case 'player_silent':
			after = await recordRelationshipEvent(db, worldId, { type: 'silence' });
			break;
		case 'woken_up':
		case 'ignoring_player':
			break;
	}
	if (outcome.remember) {
		await remember(db, worldId, {
			kind: outcome.remember.kind,
			note: outcome.remember.note,
			importance: outcome.remember.kind === 'fact' ? 0.7 : 0.5,
			tags: ['player'],
			emotion: outcome.emotion,
			createdAt: now,
		});
	}
	return after;
}
