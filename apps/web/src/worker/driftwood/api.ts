/**
 * /api/driftwood/* - DRIFTWOOD multiplayer, served by the Worker entry (SvelteKit cannot
 * hand WebSockets to a Durable Object). Runs behind the site gate like everything else.
 *
 *   GET  /api/driftwood/rooms            worlds somebody is playing in right now
 *   POST /api/driftwood/rooms            create a world { seed, mode, name?, nick } -> { code }
 *   GET  /api/driftwood/rooms/:code      a world's seed and mode (to join it)
 *   GET  /api/driftwood/rooms/:code/ws   WebSocket into the world
 */
import { CODE_RE, makeCode, parseCreate } from './protocol';
import type { DriftwoodEnv } from './room';

const PREFIX = '/api/driftwood/rooms';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
	});

export async function driftwoodApi(request: Request, env: DriftwoodEnv): Promise<Response | null> {
	const url = new URL(request.url);
	if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) return null;
	const room = (code: string) => env.DRIFTWOOD_ROOM.get(env.DRIFTWOOD_ROOM.idFromName(code));

	if (url.pathname === PREFIX) {
		if (request.method === 'GET') {
			const lobby = env.DRIFTWOOD_LOBBY.get(env.DRIFTWOOD_LOBBY.idFromName('lobby'));
			return json({ rooms: await lobby.list() });
		}
		if (request.method === 'POST') {
			// Same-origin only: the game page creates worlds, other sites cannot.
			const origin = request.headers.get('origin');
			if (origin && origin !== url.origin) return json({ error: 'forbidden' }, 403);
			const body = parseCreate(await request.json().catch(() => null));
			if (!body) return json({ error: 'invalid world' }, 400);
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
		const origin = request.headers.get('origin');
		if (origin && origin !== url.origin) return json({ error: 'forbidden' }, 403);
		return room(code).fetch(request);
	}
	if (rest === undefined && request.method === 'GET') {
		const info = await room(code).info();
		return info ? json(info) : json({ error: 'no such world' }, 404);
	}
	return json({ error: 'not found' }, 404);
}
