import { error, json } from '@sveltejs/kit';
import { leaderboard, playerScores, submitScores } from '@windowling/database';
import { z } from 'zod';
import { BOARD_RE, cleanNickname } from '$lib/cloud';
import { GAMES } from '$lib/games/registry';
import type { RequestHandler } from './$types';

/**
 * Leaderboards. Signed-in players' best results are sent by static/games/sync.js; anyone can
 * read a board, or all of one player's boards in a game (`?game&player=<nickname>`) to compare
 * with them. Results come from the player's browser, so values are only range-checked.
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
const score = z.object({ game, board, value: z.number().int().positive().max(1e10) });
const body = z.object({ scores: z.array(z.unknown()).max(200) });

export const GET: RequestHandler = async ({ url, locals }) => {
	const player = url.searchParams.get('player');
	if (player !== null) {
		const g = game.safeParse(url.searchParams.get('game'));
		const nick = cleanNickname(player);
		if (!g.success || !nick) error(400, 'Invalid player');
		const found = await playerScores(locals.db, g.data, nick);
		if (!found) error(404, 'No such player');
		return json(found, { headers: { 'cache-control': 'no-store' } });
	}
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
	// Browsers keep the saves of games removed from the library since, so one result the server
	// no longer takes is skipped instead of refusing the player's other results with it.
	const scores = parsed.data.scores.flatMap((s) => {
		const r = score.safeParse(s);
		return r.success ? [r.data] : [];
	});
	const improved = await submitScores(locals.db, locals.user.id, scores);
	return json({ improved, ignored: parsed.data.scores.length - scores.length });
};
