import { error, json } from '@sveltejs/kit';
import { getNickname, setNickname } from '@windowling/database';
import { cleanNickname } from '$lib/cloud';
import type { RequestHandler } from './$types';

/** The signed-in player's nickname (chosen after the first sign-in). */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Not signed in');
	return json({ nickname: await getNickname(locals.db, locals.user.id) });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Not signed in');
	const data = (await request.json().catch(() => null)) as { nickname?: unknown } | null;
	const nickname = cleanNickname(data?.nickname);
	if (!nickname) error(400, 'Invalid nickname');
	if (!(await setNickname(locals.db, locals.user.id, nickname))) error(409, 'Nickname taken');
	return json({ nickname });
};
