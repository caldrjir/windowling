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
		return json(
			{ status: 'degraded', database: 'unreachable' },
			{ status: 503, headers: { 'cache-control': 'no-store' } },
		);
	}
};
