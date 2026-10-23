import { error, json } from '@sveltejs/kit';
import { listSaves, MAX_SAVE_VALUE, putSaves } from '@windowling/database';
import { z } from 'zod';
import { SYNC_KEY_RE } from '$lib/cloud';
import type { RequestHandler } from './$types';

/**
 * Cloud saves for signed-in players (static/games/sync.js): the games' localStorage
 * values, newest write wins per key. Anonymous players get 401 and keep playing locally.
 */
const body = z.object({
	saves: z
		.array(
			z.object({
				key: z.string().regex(SYNC_KEY_RE),
				data: z.string().max(MAX_SAVE_VALUE).nullable(),
				t: z.number().int().positive(),
			}),
		)
		.max(100),
});

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Not signed in');
	const saves = await listSaves(locals.db, locals.user.id);
	return json({ user: locals.user.id, saves }, { headers: { 'cache-control': 'no-store' } });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Not signed in');
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid saves');
	// A device clock far in the future would make its writes win forever.
	const limit = Date.now() + 5 * 60_000;
	const saves = parsed.data.saves.map((s) => ({ ...s, t: Math.min(s.t, limit) }));
	const result = await putSaves(locals.db, locals.user.id, saves);
	if (result.rejected) error(413, 'Too much saved data');
	return json({ stored: result.stored });
};
