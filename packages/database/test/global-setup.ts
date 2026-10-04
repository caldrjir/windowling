import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getTestDatabaseUrl } from './test-database.ts';

/** Applies the real migrations to the test database once per run. */
export default async function setup() {
	const url = getTestDatabaseUrl();
	if (!url) return;
	const sql = postgres(url, { max: 1, onnotice: () => {} });
	try {
		await migrate(drizzle(sql), {
			migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
		});
	} finally {
		await sql.end();
	}
}
