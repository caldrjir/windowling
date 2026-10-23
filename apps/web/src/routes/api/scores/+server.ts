import { error, json } from '@sveltejs/kit';
import { leaderboard, submitScores } from '@windowling/database';
import { z } from 'zod';
import { BOARD_RE } from '$lib/cloud';
import { GAMES } from '$lib/games/registry';
import type { RequestHandler } from './$types';

/**
 * Leaderboards. Signed-in players' best results are sent by static/games/sync.js; anyone can
 * read a board. Results come from the player's browser, so values are only range-checked.
 */
const gameIds = GAMES.map((g) => g.id);
const game = z.string().refine((id) => gameIds.includes(id));
const board = z
	.string()
	.regex(BOARD_RE)
	.refine((b) => {
		// No daily boards from the future (time zones aside).
		const day = /^daily:(\d{4}-\d{2}-\d{2})/.exec(b)?.[1];
		return !day || Date.parse(day) <= Date.now() + 36 * 3600_000;
	});
const body = z.object({
	scores: z.array(z.object({ game, board, value: z.number().int().positive().max(1e10) })).max(200),
});

export const GET: RequestHandler = async ({ url, locals }) => {
	const g = game.safeParse(url.searchParams.get('game'));
	const b = board.safeParse(url.searchParams.get('board'));
	if (!g.success || !b.success) error(400, 'Invalid board');
	const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));
	const lb = await leaderboard(locals.db, g.data, b.data, {
		limit,
		userId: locals.user?.id ?? null,
	});
	return json(
		{ ...lb, signedIn: Boolean(locals.user) },
		{ headers: { 'cache-control': 'no-store' } },
	);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Not signed in');
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid scores');
	const improved = await submitScores(locals.db, locals.user.id, parsed.data.scores);
	return json({ improved });
};
