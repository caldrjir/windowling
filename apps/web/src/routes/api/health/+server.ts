import { json } from '@sveltejs/kit';
import { pingDatabase } from '@windowling/database';
import type { RequestHandler } from './$types';

/** Liveness + database reachability, used by deploy smoke tests. */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		await pingDatabase(locals.db);
		return json({ status: 'ok', database: 'ok' }, { headers: { 'cache-control': 'no-store' } });
	} catch {
		return json({ status: 'degraded', database: 'unreachable' }, { status: 503 });
	}
};
