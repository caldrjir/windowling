import { activitySchema, belongingSchema, ITEMS, moneyAskKindSchema } from '@windowling/shared';
import {
	advanceLife,
	createInitialCharacter,
	DEFAULT_TIME_ZONE,
	isValidTimeZone,
	localClock,
	planCatchUp,
	startLife,
	wakeUp,
	type Envelope,
	type LifeState,
} from '@windowling/simulation';
import { and, eq, lt } from 'drizzle-orm';
import type { Database } from './client.ts';
import { remember, recordRelationshipEvent } from './memories.ts';
import { character, world } from './schema/index.ts';

export interface WorldRecord {
	id: string;
	userId: string;
	createdAt: Date;
	lastSimulatedAt: Date;
	/** IANA zone of the player's device. */
	timeZone: string;
	character: {
		id: string;
		name: string;
		life: LifeState;
		/** Money the player keeps for it (#70). */
		envelope: Envelope;
	};
}

const worldColumns = {
	id: world.id,
	userId: world.userId,
	createdAt: world.createdAt,
	lastSimulatedAt: world.lastSimulatedAt,
	timeZone: world.timezone,
	characterId: character.id,
	characterName: character.name,
	hunger: character.hunger,
	energy: character.energy,
	mood: character.mood,
	activity: character.activity,
	activityStartedAt: character.activityStartedAt,
	activityEndsAt: character.activityEndsAt,
	balanceCents: character.balanceCents,
	unpaidCents: character.unpaidCents,
	paidAt: character.paidAt,
	entrustedCents: character.entrustedCents,
	moneyAskKind: character.moneyAskKind,
	moneyAskCents: character.moneyAskCents,
	moneyAskAt: character.moneyAskAt,
	moneyAskedAt: character.moneyAskedAt,
	belongings: character.belongings,
};

type WorldRow = {
	[K in keyof typeof worldColumns]: (typeof worldColumns)[K]['_']['notNull'] extends true
		? (typeof worldColumns)[K]['_']['data']
		: (typeof worldColumns)[K]['_']['data'] | null;
};

function toRecord(row: WorldRow): WorldRecord {
	// Rows written by an older/newer release may carry an activity we don't know:
	// treat it as finished so the next catch-up decides again.
	const activity = activitySchema.safeParse(row.activity);
	const timeZone = isValidTimeZone(row.timeZone) ? row.timeZone : DEFAULT_TIME_ZONE;
	return {
		id: row.id,
		userId: row.userId,
		createdAt: row.createdAt,
		lastSimulatedAt: row.lastSimulatedAt,
		timeZone,
		character: {
			id: row.characterId,
			name: row.characterName,
			life: {
				needs: { hunger: row.hunger, energy: row.energy, mood: row.mood },
				money: { balance: row.balanceCents, unpaid: row.unpaidCents, paidAt: row.paidAt },
				belongings: parseBelongings(row.belongings),
				activity: activity.success ? activity.data : 'idle',
				activityStartedAt: row.activityStartedAt,
				activityEndsAt: activity.success ? row.activityEndsAt : row.activityStartedAt,
			},
			envelope: toEnvelope(row),
		},
	};
}

/** Rows from another release may hold things we don't know: keep what parses. */
function parseBelongings(raw: unknown): LifeState['belongings'] {
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((entry: unknown) => {
		const parsed = belongingSchema.safeParse(entry);
		return parsed.success ? [parsed.data] : [];
	});
}

function toEnvelope(row: WorldRow): Envelope {
	const kind = moneyAskKindSchema.safeParse(row.moneyAskKind);
	const ask =
		kind.success && row.moneyAskCents !== null && row.moneyAskAt !== null
			? { kind: kind.data, cents: row.moneyAskCents, at: row.moneyAskAt }
			: null;
	return { cents: Math.max(0, row.entrustedCents), ask, lastAskAt: row.moneyAskedAt };
}

/** Columns for an envelope (what the player keeps, the open question). */
export function envelopeColumns(envelope: Envelope) {
	return {
		entrustedCents: envelope.cents,
		moneyAskKind: envelope.ask?.kind ?? null,
		moneyAskCents: envelope.ask?.cents ?? null,
		moneyAskAt: envelope.ask?.at ?? null,
		moneyAskedAt: envelope.lastAskAt,
	};
}

export function lifeColumns(life: LifeState) {
	return {
		hunger: life.needs.hunger,
		energy: life.needs.energy,
		mood: life.needs.mood,
		activity: life.activity,
		activityStartedAt: life.activityStartedAt,
		activityEndsAt: life.activityEndsAt,
		balanceCents: life.money.balance,
		unpaidCents: life.money.unpaid,
		paidAt: life.money.paidAt,
		belongings: life.belongings,
	};
}

export async function findWorldByUserId(db: Database, userId: string): Promise<WorldRecord | null> {
	const rows = await db
		.select(worldColumns)
		.from(world)
		.innerJoin(character, eq(character.worldId, world.id))
		.where(eq(world.userId, userId))
		.limit(1);

	const row = rows[0];
	return row ? toRecord(row) : null;
}

export interface CreateWorldOptions {
	now?: Date;
	/** Device time zone; invalid values fall back to UTC. */
	timeZone?: string;
}

/**
 * Idempotent and race-safe: concurrent calls for the same user converge on
 * a single world thanks to the unique constraints.
 */
export async function getOrCreateWorldForUser(
	db: Database,
	userId: string,
	{ now = new Date(), timeZone }: CreateWorldOptions = {},
): Promise<WorldRecord> {
	const existing = await findWorldByUserId(db, userId);
	if (existing) return existing;

	const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
	await db.transaction(async (tx) => {
		await tx
			.insert(world)
			.values({ userId, lastSimulatedAt: now, timezone: zone })
			.onConflictDoNothing({ target: world.userId });

		const [owned] = await tx.select({ id: world.id }).from(world).where(eq(world.userId, userId));
		if (!owned) throw new Error(`world for user ${userId} vanished during creation`);

		const life = startLife(now, { seed: owned.id, timeZone: zone });
		await tx
			.insert(character)
			.values({
				worldId: owned.id,
				name: createInitialCharacter(owned.id).name,
				...lifeColumns(life),
			})
			.onConflictDoNothing({ target: character.worldId });
	});

	const created = await findWorldByUserId(db, userId);
	if (!created) throw new Error(`failed to create world for user ${userId}`);
	return created;
}

export type WorldTransferResult =
	/** The anonymous world now belongs to the target user. */
	| 'transferred'
	/** Target already had a world; it wins and the source world is left untouched. */
	| 'target-has-world'
	/** Source user had no world - nothing to do. */
	| 'no-source-world';

/**
 * Moves a world from one user to another (anonymous -> authenticated
 * account linking). Never creates a second world for the target user.
 */
export async function transferWorldOwnership(
	db: Database,
	fromUserId: string,
	toUserId: string,
): Promise<WorldTransferResult> {
	return db.transaction(async (tx) => {
		const [targetWorld] = await tx
			.select({ id: world.id })
			.from(world)
			.where(eq(world.userId, toUserId))
			.for('update');
		if (targetWorld) return 'target-has-world';

		const moved = await tx
			.update(world)
			.set({ userId: toUserId })
			.where(eq(world.userId, fromUserId))
			.returning({ id: world.id });
		return moved.length > 0 ? 'transferred' : 'no-source-world';
	});
}

/**
 * The player's device moved to another time zone: the character's day
 * follows it from now on (#10). Invalid zones are ignored.
 */
export async function updateWorldTimeZone(
	db: Database,
	record: WorldRecord,
	timeZone: string,
): Promise<WorldRecord> {
	if (timeZone === record.timeZone || !isValidTimeZone(timeZone)) return record;
	await db.update(world).set({ timezone: timeZone }).where(eq(world.id, record.id));
	return { ...record, timeZone };
}

/**
 * Lives the character's life from `lastSimulatedAt` to `now` (needs,
 * activities) and persists the result. Gaps longer than the catch-up window
 * are skipped. Time only moves forward, even with concurrent requests: the
 * clock update is guarded in SQL and only the winner writes the character.
 */
export async function catchUpWorld(
	db: Database,
	record: WorldRecord,
	now: Date = new Date(),
): Promise<WorldRecord> {
	const plan = planCatchUp(record.lastSimulatedAt, now);
	if (plan.stepEnds.length === 0) return record;

	const life = advanceLife(record.character.life, plan.from, plan.to, {
		seed: record.id,
		timeZone: record.timeZone,
	});

	const won = await db.transaction(async (tx) => {
		const advanced = await tx
			.update(world)
			.set({ lastSimulatedAt: plan.to })
			.where(and(eq(world.id, record.id), lt(world.lastSimulatedAt, plan.to)))
			.returning({ id: world.id });
		if (advanced.length === 0) return false;
		await tx.update(character).set(lifeColumns(life)).where(eq(character.id, record.character.id));
		return true;
	});

	if (!won) {
		// Someone else already simulated further; their state is the truth.
		return (await findWorldByUserId(db, record.userId)) ?? record;
	}
	await rememberShopping(db, record, record.character.life.belongings, life.belongings);
	return {
		...record,
		lastSimulatedAt: plan.to,
		character: { ...record.character, life },
	};
}

/**
 * The player knocked the character awake. Server-side because it has
 * persistent consequences (mood, a broken night). Only a character that is
 * actually asleep right now can be woken; returns null otherwise.
 */
export async function wakeCharacter(
	db: Database,
	userId: string,
	now: Date = new Date(),
	/** What woke it - it remembers how. */
	cause: 'knock' | 'shake' = 'knock',
): Promise<WorldRecord | null> {
	const found = await findWorldByUserId(db, userId);
	if (!found) return null;
	const record = await catchUpWorld(db, found, now);
	const { life } = record.character;
	const woken = wakeUp(life, now);
	if (!woken) return null;

	// Optimistic: only if nobody changed the character since we read it.
	const updated = await db
		.update(character)
		.set(lifeColumns(woken))
		.where(
			and(
				eq(character.id, record.character.id),
				eq(character.activity, 'sleep'),
				eq(character.activityStartedAt, life.activityStartedAt),
			),
		)
		.returning({ id: character.id });
	if (updated.length === 0) return null;

	// It won't forget this in a hurry.
	const clock = localClock(now, record.timeZone);
	await remember(db, record.id, {
		kind: 'moment',
		note:
			cause === 'shake'
				? `Someone shook my whole flat at ${clock.time} on ${clock.weekday} and threw me out of sleep.`
				: `Someone knocked on my window at ${clock.time} on ${clock.weekday} and woke me up.`,
		importance: 0.8,
		tags: ['player', 'woken', cause, 'night', 'sleep'],
		emotion: 'annoyed',
		createdAt: now,
	});
	await recordRelationshipEvent(db, record.id, { type: 'woken' });
	return { ...record, character: { ...record.character, life: woken } };
}

/** What it bought and unpacked while nobody was watching, it remembers. */
async function rememberShopping(
	db: Database,
	record: WorldRecord,
	before: LifeState['belongings'],
	after: LifeState['belongings'],
): Promise<void> {
	const was = new Map(before.map((b) => [b.item, b]));
	for (const b of after) {
		const old = was.get(b.item);
		const name = ITEMS[b.item].name;
		if (!old && !b.gift) {
			const clock = localClock(b.orderedAt, record.timeZone);
			await remember(db, record.id, {
				kind: 'moment',
				note: `I ordered ${name} online on ${clock.weekday}.`,
				importance: 0.45,
				tags: ['shopping', 'bought', b.item],
				emotion: 'happy',
				createdAt: b.orderedAt,
			});
		}
		if (b.unpackedAt && !old?.unpackedAt && !b.gift) {
			await remember(db, record.id, {
				kind: 'fact',
				note: `I have ${name} in my flat - I bought it myself.`,
				importance: 0.5,
				tags: ['home', 'owns', b.item],
				createdAt: b.unpackedAt,
			});
		}
	}
}
