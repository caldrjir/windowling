import { error, json } from '@sveltejs/kit';
import { wakeCharacter } from '@windowling/database';
import type { RequestHandler } from './$types';

/**
 * The player knocked a sleeping character awake. The client only reports the
 * knocks; the server checks the character really is asleep and applies the
 * consequences (broken night, worse mood).
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user) error(401, 'No session');
	// Session cookies are SameSite=Lax already; refuse explicit cross-site calls too.
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Cross-origin request');

	const woken = await wakeCharacter(locals.db, locals.user.id);
	return json({ woken: woken !== null }, { headers: { 'cache-control': 'no-store' } });
};
