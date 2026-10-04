import { sql } from 'drizzle-orm';
import type { Database } from './client.ts';

/** Cheap round-trip used by health checks. */
export async function pingDatabase(db: Database): Promise<void> {
	await db.execute(sql`select 1`);
}
