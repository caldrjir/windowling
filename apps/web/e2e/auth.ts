import { createHmac, randomUUID } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';
import { createDatabase, deleteUser, schema } from '@windowling/database';

// Signs a test user in without Google: a session row in the E2E database and the Better
// Auth session cookie signed with the E2E-only secret (playwright.config.ts).
const SECRET = 'e2e-only-secret-not-used-anywhere-else-0123456789';
const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

export async function createTestUser(name: string) {
	const conn = createDatabase(databaseUrl, { max: 1 });
	const id = `e2e-${randomUUID()}`;
	const token = randomUUID().replace(/-/g, '');
	try {
		await conn.db.insert(schema.user).values({ id, name, email: `${id}@example.com` });
		await conn.db.insert(schema.session).values({
			id: randomUUID(),
			token,
			userId: id,
			expiresAt: new Date(Date.now() + 3600_000),
		});
	} finally {
		await conn.close();
	}
	const signature = createHmac('sha256', SECRET).update(token).digest('base64');
	const cookie = encodeURIComponent(`${token}.${signature}`);
	return {
		id,
		async signIn(context: BrowserContext, baseURL: string) {
			await context.addCookies([
				{ name: 'better-auth.session_token', value: cookie, url: baseURL, httpOnly: true },
			]);
		},
	};
}

export async function deleteTestUsers(ids: string[]) {
	if (!ids.length) return;
	const conn = createDatabase(databaseUrl, { max: 1 });
	try {
		for (const id of ids) await deleteUser(conn.db, id);
	} finally {
		await conn.close();
	}
}
