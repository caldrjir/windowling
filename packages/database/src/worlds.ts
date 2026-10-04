import { createInitialCharacter, planCatchUp } from '@windowling/simulation';
import { and, eq, lt } from 'drizzle-orm';
import type { Database } from './client.ts';
import { character, world } from './schema/index.ts';

export interface WorldRecord {
	id: string;
	userId: string;
	createdAt: Date;
	lastSimulatedAt: Date;
	character: { id: string; name: string };
}

export async function findWorldByUserId(db: Database, userId: string): Promise<WorldRecord | null> {
	const rows = await db
		.select({
			id: world.id,
			userId: world.userId,
			createdAt: world.createdAt,
			lastSimulatedAt: world.lastSimulatedAt,
			characterId: character.id,
			characterName: character.name,
		})
		.from(world)
		.innerJoin(character, eq(character.worldId, world.id))
		.where(eq(world.userId, userId))
		.limit(1);

	const row = rows[0];
	if (!row) return null;
	return {
		id: row.id,
		userId: row.userId,
		createdAt: row.createdAt,
		lastSimulatedAt: row.lastSimulatedAt,
		character: { id: row.characterId, name: row.characterName },
	};
}

/**
 * Idempotent and race-safe: concurrent calls for the same user converge on
 * a single world thanks to the unique constraints.
 */
export async function getOrCreateWorldForUser(
	db: Database,
	userId: string,
	now: Date = new Date(),
): Promise<WorldRecord> {
	const existing = await findWorldByUserId(db, userId);
	if (existing) return existing;

	await db.transaction(async (tx) => {
		await tx
			.insert(world)
			.values({ userId, lastSimulatedAt: now })
			.onConflictDoNothing({ target: world.userId });

		const [owned] = await tx.select({ id: world.id }).from(world).where(eq(world.userId, userId));
		if (!owned) throw new Error(`world for user ${userId} vanished during creation`);

		await tx
			.insert(character)
			.values({ worldId: owned.id, name: createInitialCharacter(owned.id).name })
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
 * Advances the world's simulation clock to `now`. Iteration 0 only moves
 * the clock; later iterations apply per-step simulation results here.
 * Time only moves forward, even with concurrent requests.
 */
export async function catchUpWorld(
	db: Database,
	record: WorldRecord,
	now: Date = new Date(),
): Promise<WorldRecord> {
	const plan = planCatchUp(record.lastSimulatedAt, now);
	if (plan.stepEnds.length === 0) return record;

	await db
		.update(world)
		.set({ lastSimulatedAt: plan.to })
		.where(and(eq(world.id, record.id), lt(world.lastSimulatedAt, plan.to)));

	return { ...record, lastSimulatedAt: plan.to };
}
