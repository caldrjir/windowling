import { error, json } from '@sveltejs/kit';
import { countPresence, leavePresence, touchPresence } from '@windowling/database';
import { z } from 'zod';
import { GAMES } from '$lib/games/registry';
import type { RequestHandler } from './$types';

const gameIds = GAMES.map((g) => g.id);

const beat = z.object({
	/** Random id of the game tab (static/games/presence.js). */
	client: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
	game: z.string().refine((id) => gameIds.includes(id)),
	leave: z.boolean().optional(),
});

/** Heartbeat from an open game tab (or its goodbye when the tab closes). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const parsed = beat.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid presence heartbeat');
	const { client, game, leave } = parsed.data;
	if (leave) await leavePresence(locals.db, client);
	else
		await touchPresence(locals.db, {
			clientId: client,
			gameId: game,
			userId: locals.user?.id ?? null,
		});
	return new Response(null, { status: 204 });
};

/** How many signed-in and anonymous players each game has right now. */
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
	return json({ games }, { headers: { 'cache-control': 'no-store' } });
};
