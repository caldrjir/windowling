import { json } from '@sveltejs/kit';
import { pingDatabase } from '@windowling/database';
import type { RequestHandler } from './$types';

/** Liveness + database reachability, used by deploy smoke tests. */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		await pingDatabase(locals.db);
		return json({ status: 'ok', database: 'ok' }, { headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		// Visible in Workers Logs (observability). Driver errors carry no credentials.
		const { name, message, code } = error as Error & { code?: string };
		console.error('health: database unreachable', { name, code, message });
		// Only the driver/Postgres error code is exposed (e.g. CONNECT_TIMEOUT, 28P01) - no
		// messages, hosts or credentials - so deploy smoke tests can tell failures apart.
		return json(
			{ status: 'degraded', database: 'unreachable', code: code ?? name },
			{ status: 503, headers: { 'cache-control': 'no-store' } },
		);
	}
};
