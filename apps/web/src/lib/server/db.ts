import { dev } from '$app/environment';
import { createDatabase, type DatabaseConnection } from '@windowling/database';
import type { ServerEnv } from './env.ts';

let devConnection: DatabaseConnection | undefined;

/**
 * Node dev server: one shared pool for the process.
 * Cloudflare Workers: I/O objects cannot outlive a request, so every request
 * gets its own single-connection client that is closed after the response.
 * Hyperdrive (if bound) provides pooling in production.
 */
export function acquireDatabase(
	env: ServerEnv,
	platform: App.Platform | undefined,
): { connection: DatabaseConnection; release: () => void } {
	const url = platform?.env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
	if (!url) {
		throw new Error('No database configured: set DATABASE_URL or bind HYPERDRIVE.');
	}

	if (dev) {
		devConnection ??= createDatabase(url);
		return { connection: devConnection, release: () => {} };
	}

	const connection = createDatabase(url, { max: 1 });
	return {
		connection,
		release: () => {
			const closing = connection.close();
			if (platform?.ctx) platform.ctx.waitUntil(closing);
			else void closing;
		},
	};
}
