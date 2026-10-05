import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTestDatabaseUrl } from '../test/test-database.ts';
import { consumeAiQuota } from './ai-usage.ts';
import { createDatabase, type DatabaseConnection } from './client.ts';
import { user } from './schema/index.ts';

const url = getTestDatabaseUrl();

describe.skipIf(!url)('AI quota (postgres)', () => {
	let conn: DatabaseConnection;
	const users: string[] = [];

	beforeAll(() => {
		conn = createDatabase(url!, { max: 4 });
	});

	afterAll(async () => {
		if (users.length) await conn.db.delete(user).where(inArray(user.id, users));
		await conn.close();
	});

	async function createUser() {
		const id = randomUUID();
		await conn.db.insert(user).values({ id, name: 'P', email: `${id}@test.windowling.local` });
		users.push(id);
		return id;
	}

	it('allows exactly the daily limit, even under concurrency, and resets the next day', async () => {
		const userId = await createUser();
		const today = new Date('2026-10-05T10:00:00Z');
		const results = await Promise.all(
			Array.from({ length: 8 }, () => consumeAiQuota(conn.db, userId, 5, today)),
		);
		expect(results.filter(Boolean)).toHaveLength(5);
		expect(await consumeAiQuota(conn.db, userId, 5, today)).toBe(false);
		expect(await consumeAiQuota(conn.db, userId, 5, new Date('2026-10-06T00:00:01Z'))).toBe(true);
	});

	it('denies everything with a zero limit', async () => {
		expect(await consumeAiQuota(conn.db, await createUser(), 0)).toBe(false);
	});
});
