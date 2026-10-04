import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface DatabaseConnection {
	db: Database;
	/** Closes the underlying pool. Required per request on Cloudflare Workers. */
	close: () => Promise<void>;
}

export interface CreateDatabaseOptions {
	/** Max pooled connections. Keep at 1 for per-request clients on Workers. */
	max?: number;
}

/**
 * Plain Postgres over TCP via postgres.js - works the same against local
 * Docker, Neon, or Cloudflare Hyperdrive (which just hands us a connection string).
 */
export function createDatabase(
	url: string,
	{ max = 10 }: CreateDatabaseOptions = {},
): DatabaseConnection {
	const sql = postgres(url, { max, onnotice: () => {} });
	const db = drizzle(sql, { schema, casing: 'snake_case' });
	return { db, close: () => sql.end({ timeout: 5 }) };
}
