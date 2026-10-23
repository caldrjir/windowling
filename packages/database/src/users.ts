import { eq } from 'drizzle-orm';
import type { Database } from './client.ts';
import { user } from './schema/auth.ts';

/** Deletes an account; sessions, saves and the profile go with it (cascade). */
export async function deleteUser(db: Database, userId: string): Promise<void> {
	await db.delete(user).where(eq(user.id, userId));
}
