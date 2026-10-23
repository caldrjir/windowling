/**
 * /api/duel/* - online play for the puzzle shelf, served by the Worker entry (SvelteKit
 * cannot hand WebSockets to a Durable Object). Runs behind the site gate like everything else.
 *
 *   GET  /api/duel/rooms?game=sachy    open games waiting for players
 *   POST /api/duel/rooms               create { game, kind, diff, nick, open } -> { code }
 *   GET  /api/duel/rooms/:code         a room's game, kind and difficulty (to join it)
 *   GET  /api/duel/rooms/:code/ws      WebSocket into the room
 */
import { CODE_RE, makeCode, parseCreate, parseGame } from './protocol';
import type { DuelEnv } from './room';

const PREFIX = '/api/duel/rooms';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
	});

export async function duelApi(request: Request, env: DuelEnv): Promise<Response | null> {
	const url = new URL(request.url);
	if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) return null;
	const room = (code: string) => env.DUEL_ROOM.get(env.DUEL_ROOM.idFromName(code));
	// Same-origin only: game pages create and join rooms, other sites cannot.
	const origin = request.headers.get('origin');
	const foreign = !!origin && origin !== url.origin;

	if (url.pathname === PREFIX) {
		if (request.method === 'GET') {
			const game = parseGame(url.searchParams.get('game'));
			if (!game) return json({ error: 'game required' }, 400);
			const lobby = env.DUEL_LOBBY.get(env.DUEL_LOBBY.idFromName('lobby'));
			return json({ rooms: await lobby.list(game) });
		}
		if (request.method === 'POST') {
			if (foreign) return json({ error: 'forbidden' }, 403);
			const body = parseCreate(await request.json().catch(() => null));
			if (!body) return json({ error: 'invalid game' }, 400);
			for (let attempt = 0; attempt < 5; attempt++) {
				const code = makeCode();
				if (await room(code).create({ ...body, code, created: Date.now() }))
					return json({ code }, 201);
			}
			return json({ error: 'try again' }, 503);
		}
		return json({ error: 'method not allowed' }, 405);
	}

	const [code, rest, ...extra] = url.pathname.slice(PREFIX.length + 1).split('/');
	if (!code || !CODE_RE.test(code) || extra.length) return json({ error: 'not found' }, 404);
	if (rest === 'ws') {
		if (foreign) return json({ error: 'forbidden' }, 403);
		return room(code).fetch(request);
	}
	if (rest === undefined && request.method === 'GET') {
		const info = await room(code).info();
		return info ? json(info) : json({ error: 'no such game' }, 404);
	}
	return json({ error: 'not found' }, 404);
}
