import { error, json } from '@sveltejs/kit';
import { findWorldByUserId, recordShake, wakeCharacter } from '@windowling/database';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const shakeSchema = z.object({ intensity: z.number().min(0).max(1) });
/** Shaking harder than this throws a sleeper out of bed. */
const WAKES_AT = 0.5;

/**
 * The player shook the phone. The client only reports how hard; the server
 * remembers it, lets the relationship suffer, and wakes a sleeper if it was
 * a real shake.
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user) error(401, 'No session');
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Cross-origin request');
	const parsed = shakeSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid shake');

	const world = await findWorldByUserId(locals.db, locals.user.id);
	if (!world) error(404, 'No world');
	const now = new Date();
	const { intensity } = parsed.data;
	const woken =
		intensity >= WAKES_AT ? await wakeCharacter(locals.db, locals.user.id, now, 'shake') : null;
	const recorded = await recordShake(locals.db, world.id, intensity, now);
	return json({ woken: woken !== null, recorded }, { headers: { 'cache-control': 'no-store' } });
};
