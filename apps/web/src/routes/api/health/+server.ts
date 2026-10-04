import { json } from '@sveltejs/kit';
import { pingDatabase } from '@windowling/database';
import type { RequestHandler } from './$types';

interface ErrorInfo {
	name?: string;
	code?: string;
	message?: string;
}

/** Drizzle wraps driver errors ("Failed query: ..."); the real reason is in `cause`. */
function rootCause(error: unknown): ErrorInfo {
	let current: unknown = error;
	for (let depth = 0; depth < 5; depth++) {
		const next = (current as { cause?: unknown } | null)?.cause;
		if (!next) break;
		current = next;
	}
	const { name, code, message } = (current ?? {}) as ErrorInfo;
	return { name, code, message };
}

/** Liveness + database reachability, used by deploy smoke tests. */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		await pingDatabase(locals.db);
		return json({ status: 'ok', database: 'ok' }, { headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		const cause = rootCause(error);
		// Full details go to Workers Logs (observability). Driver errors carry no credentials.
		console.error('health: database unreachable', cause);
		// Only the error code is exposed (e.g. CONNECT_TIMEOUT, 28P01) - no messages or hosts.
		return json(
			{ status: 'degraded', database: 'unreachable', code: cause.code ?? cause.name ?? 'unknown' },
			{ status: 503, headers: { 'cache-control': 'no-store' } },
		);
	}
};
