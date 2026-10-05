import { sql } from 'drizzle-orm';
import type { Database } from './client.ts';
import { aiUsage } from './schema/index.ts';

/**
 * Atomically takes one call from today's allowance. Returns false when the
 * player has used `dailyLimit` calls today (UTC) - the caller then falls back
 * to the non-LLM brain.
 */
export async function consumeAiQuota(
	db: Database,
	userId: string,
	dailyLimit: number,
	now: Date = new Date(),
): Promise<boolean> {
	if (dailyLimit <= 0) return false;
	const day = now.toISOString().slice(0, 10);
	const rows = await db
		.insert(aiUsage)
		.values({ userId, day, count: 1 })
		.onConflictDoUpdate({
			target: [aiUsage.userId, aiUsage.day],
			set: { count: sql`${aiUsage.count} + 1` },
			setWhere: sql`${aiUsage.count} < ${dailyLimit}`,
		})
		.returning({ count: aiUsage.count });
	return rows.length > 0;
}
