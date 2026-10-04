import { building } from '$app/environment';
import type { Handle, ServerInit } from '@sveltejs/kit';
import { createAuth } from '$lib/server/auth';
import { getServerEnv } from '$lib/server/config';
import { acquireDatabase } from '$lib/server/db';

const AUTH_BASE_PATH = '/api/auth/';

/** Fail fast on misconfiguration instead of on the first unlucky request. */
export const init: ServerInit = () => {
	if (!building) getServerEnv();
};

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const env = getServerEnv();
	const { connection, release } = acquireDatabase(env, event.platform);
	try {
		const auth = createAuth(connection.db, env);
		event.locals.db = connection.db;
		event.locals.auth = auth;
		event.locals.user = null;
		event.locals.session = null;

		// Routed by path only: Better Auth's own helper also compares origins,
		// which breaks behind host rewrites (wrangler dev, www vs apex).
		if (event.url.pathname.startsWith(AUTH_BASE_PATH)) {
			return await auth.handler(event.request);
		}

		const result = await auth.api.getSession({ headers: event.request.headers });
		event.locals.user = result?.user ?? null;
		event.locals.session = result?.session ?? null;

		return await resolve(event);
	} finally {
		release();
	}
};
