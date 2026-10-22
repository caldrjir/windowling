import { expect, test, type Page } from '@playwright/test';

// DRIFTWOOD multiplayer server (Durable Objects in workerd). The 3D game is not rendered
// in CI (no GPU), so two browser pages talk to a world over the same WebSocket API.
test.use({ locale: 'cs-CZ' });

interface Msg {
	t: string;
	[key: string]: unknown;
}

/** Opens a WebSocket in the page; messages collect in window.__mp. */
async function connect(page: Page, code: string, nick: string) {
	await page.evaluate(
		({ code, nick }) =>
			new Promise<void>((resolve, reject) => {
				const w = window as unknown as { __mp: Msg[]; __ws: WebSocket };
				w.__mp = [];
				const ws = new WebSocket(
					`${location.origin.replace('http', 'ws')}/api/driftwood/rooms/${code}/ws`,
				);
				w.__ws = ws;
				ws.onmessage = (e) => w.__mp.push(JSON.parse(String(e.data)) as Msg);
				ws.onerror = () => reject(new Error('websocket error'));
				ws.onopen = () => {
					ws.send(JSON.stringify({ t: 'hello', nick, look: { skin: 1 } }));
					resolve();
				};
			}),
		{ code, nick },
	);
}
const send = (page: Page, m: unknown) =>
	page.evaluate((m) => (window as unknown as { __ws: WebSocket }).__ws.send(JSON.stringify(m)), m);
const received = (page: Page, t: string) =>
	page.evaluate((t) => (window as unknown as { __mp: Msg[] }).__mp.filter((m) => m.t === t), t);

test('two players share a DRIFTWOOD world', async ({ browser, request }, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const created = await request.post('/api/driftwood/rooms', {
		data: { seed: 4242, mode: 'normal', nick: 'Ann', name: 'Ostrov Ann' },
	});
	expect(created.status()).toBe(201);
	const { code } = (await created.json()) as { code: string };
	expect(code).toMatch(/^[A-Z2-9]{6}$/);
	const world = await (await request.get(`/api/driftwood/rooms/${code}`)).json();
	expect(world).toMatchObject({ code, seed: 4242, mode: 'normal', name: 'Ostrov Ann', players: 0 });

	const ctx = browser.contexts()[0] ?? (await browser.newContext());
	const ann = await ctx.newPage();
	const bob = await ctx.newPage();
	await ann.goto('/');
	await bob.goto('/');

	await connect(ann, code, 'Ann');
	await expect.poll(async () => (await received(ann, 'welcome')).length).toBe(1);
	const [annWelcome] = await received(ann, 'welcome');
	expect(annWelcome).toMatchObject({ host: true, meta: { seed: 4242 }, players: [] });

	// Ann harvests a tree and builds a campfire before Bob arrives.
	await send(ann, { t: 'node', k: 'tree', i: 7, r: 300 });
	await send(ann, { t: 'build', type: 'campfire', x: 2, z: 3, rot: 0 });
	await send(ann, { t: 's', x: 10, y: 1, z: 20, yaw: 0, pitch: 0, m: true });

	await connect(bob, code, 'Bob');
	await expect.poll(async () => (await received(bob, 'welcome')).length).toBe(1);
	const [bobWelcome] = await received(bob, 'welcome');
	expect(bobWelcome).toMatchObject({
		host: false,
		structures: [{ type: 'campfire', x: 2, z: 3, rot: 0 }],
		players: [{ nick: 'Ann', state: { x: 10, z: 20, m: true } }],
	});
	expect((bobWelcome?.nodes as [string, number][])[0]?.[0]).toBe('tree:7');

	// Ann sees Bob join, then his moves and his chat.
	await expect.poll(async () => (await received(ann, 'join')).length).toBe(1);
	await send(bob, { t: 's', x: 11, y: 1, z: 21, yaw: 1, pitch: 0 });
	await expect.poll(async () => (await received(ann, 's')).length).toBeGreaterThan(0);
	await send(bob, { t: 'chat', text: 'Ahoj Ann!' });
	await expect
		.poll(async () => (await received(ann, 'chat')).map((m) => m.text))
		.toContain('Ahoj Ann!');

	// The lobby lists the world while people play in it.
	const lobby = (await (await request.get('/api/driftwood/rooms')).json()) as {
		rooms: { code: string; players: string[] }[];
	};
	expect(lobby.rooms.find((r) => r.code === code)?.players.sort()).toEqual(['Ann', 'Bob']);

	// Ann leaves: Bob is told and becomes the host.
	await ann.close();
	await expect
		.poll(async () => (await received(bob, 'leave'))[0])
		.toMatchObject({ host: (bobWelcome as Msg).you });
	await bob.close();
});

test('DRIFTWOOD worlds reject bad requests', async ({ request }, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	expect(
		(await request.post('/api/driftwood/rooms', { data: { seed: -5, mode: 'x' } })).status(),
	).toBe(400);
	expect((await request.get('/api/driftwood/rooms/ZZZZZZ')).status()).toBe(404);
	expect((await request.get('/api/driftwood/rooms/nope')).status()).toBe(404);
	const crossSite = await request.post('/api/driftwood/rooms', {
		data: { seed: 1, mode: 'normal' },
		headers: { origin: 'https://evil.example' },
	});
	expect(crossSite.status()).toBe(403);
});
