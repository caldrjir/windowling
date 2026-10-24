import { error, json } from '@sveltejs/kit';
import { countPresence, leavePresence, siteStats, touchPresence } from '@windowling/database';
import { z } from 'zod';
import { GAMES } from '$lib/games/registry';
import type { RequestHandler } from './$types';

const gameIds = GAMES.map((g) => g.id);
const id = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

const beat = z.object({
	/** Random id of the tab (static/games/presence.js, or the hub page). */
	client: id,
	/** A game, or 'hub' for the center itself. */
	game: z.string().refine((g) => g === 'hub' || gameIds.includes(g)),
	/** Random id the browser keeps, to count people rather than tabs. */
	visitor: id.optional(),
	leave: z.boolean().optional(),
});

/** Heartbeat from an open game tab (or its goodbye when the tab closes). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const parsed = beat.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid presence heartbeat');
	const { client, game, visitor, leave } = parsed.data;
	if (leave) await leavePresence(locals.db, client);
	else
		await touchPresence(locals.db, {
			clientId: client,
			gameId: game,
			userId: locals.user?.id ?? null,
			visitorId: visitor ?? null,
		});
	return new Response(null, { status: 204 });
};

/**
 * How many signed-in and anonymous players each game has right now, and how many people use
 * the site (online now, in the last 30 days, ever, accounts).
 */
export const GET: RequestHandler = async ({ locals }) => {
	const games: Record<string, { signedIn: number; anonymous: number }> = {};
	for (const id of gameIds) games[id] = { signedIn: 0, anonymous: 0 };
	for (const row of await countPresence(locals.db)) {
		const entry = games[row.gameId];
		if (entry) {
			entry.signedIn = row.signedIn;
			entry.anonymous = row.anonymous;
		}
	}
	const site = await siteStats(locals.db);
	return json({ games, site }, { headers: { 'cache-control': 'no-store' } });
};
