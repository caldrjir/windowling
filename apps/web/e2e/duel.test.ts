import { expect, test, type Browser, type Page } from '@playwright/test';
import { GATE_STATE } from './gate';

// Online play on the puzzle shelf (Durable Objects in workerd): two players in separate
// browser contexts (each has its own player id) play chess and gomoku and race at sudoku.
test.use({ locale: 'cs-CZ' });

async function player(browser: Browser, nick: string) {
	const ctx = await browser.newContext({ storageState: GATE_STATE, locale: 'cs-CZ' });
	const page = await ctx.newPage();
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript((nick) => {
		const meta = JSON.parse(localStorage.getItem('gamecenter.puzzles') ?? '{}') as object;
		localStorage.setItem('gamecenter.puzzles', JSON.stringify({ ...meta, nick }));
	}, nick);
	return { page, errors, close: () => ctx.close() };
}

/** Creates an online game from the game's start screen and returns its code. */
async function create(page: Page, game: string) {
	await page.goto(`/games/${game}/index.html`);
	await page.locator('[data-k="online"]').click();
	await page.locator('#kCreate').click();
	await expect(page.locator('#kRoomCode')).toHaveText(/^[A-Z2-9]{5}$/);
	return (await page.locator('#kRoomCode').textContent()) ?? '';
}
// The game instance is briefly null while a round (re)opens.
const moves = (page: Page) =>
	page.evaluate('Kit._test.inst ? Kit._test.inst.getState().moves.length : -1') as Promise<number>;
const tap = (page: Page, square: number) =>
	page.locator(`.ch-sq[data-s="${square}"]`).dispatchEvent('pointerdown');
const result = (page: Page) => page.locator('#kModal:not([hidden]) .k-result h2');

test('two players play online chess: moves, chat, draw, rematch, resign', async ({
	browser,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const ann = await player(browser, 'Ann');
	const bob = await player(browser, 'Bob');
	const code = await create(ann.page, 'sachy');

	// Bob finds the game in the list of open games.
	await bob.page.goto('/games/sachy/index.html');
	await bob.page.locator('[data-k="online"]').click();
	await bob.page.locator(`.k-room[data-code="${code}"]`).click();
	await expect(ann.page.locator('.ch-sq')).toHaveCount(64);
	await expect(bob.page.locator('.ch-sq')).toHaveCount(64);
	await expect(ann.page.locator('.k-vs')).toContainText('Bob');

	// Ann (who created the game) has white: e2-e4, Bob answers e7-e5.
	await tap(ann.page, 85);
	await tap(ann.page, 65);
	await expect.poll(() => moves(bob.page)).toBe(1);
	await tap(bob.page, 35);
	await tap(bob.page, 55);
	await expect.poll(() => moves(ann.page)).toBe(2);

	// Chat.
	await bob.page.locator('#kChatBtn').click();
	await bob.page.locator('#kChatIn').fill('Ahoj Ann!');
	await bob.page.locator('#kChatIn').press('Enter');
	await expect(ann.page.locator('#kChatBtn sup')).toHaveText('1');

	// A reload rejoins the game with its moves.
	await ann.page.reload();
	await expect(ann.page.locator('.ch-sq')).toHaveCount(64);
	await expect.poll(() => moves(ann.page)).toBe(2);

	// Draw by agreement, then a rematch with the colours swapped.
	await ann.page.locator('#kDraw').click();
	await bob.page.locator('#kDraw.primary').click();
	await expect(result(ann.page)).toHaveText('Remíza');
	await expect(result(bob.page)).toHaveText('Remíza');
	await ann.page.locator('#kRematch').click();
	await bob.page.locator('#kRematch:not([disabled])').click();
	await expect(bob.page.locator('#kModal')).toBeHidden();
	await expect.poll(() => bob.page.evaluate('Kit._test.inst && Kit._test.inst.net.side')).toBe(1);
	await tap(bob.page, 85);
	await tap(bob.page, 65);
	await expect.poll(() => moves(ann.page)).toBe(1);
	await ann.page.locator('[data-t="resign"]').click();
	await expect(result(bob.page)).toHaveText('Výhra!');
	await expect(result(ann.page)).toHaveText('Prohra');
	const online = await bob.page.evaluate(
		() =>
			(JSON.parse(localStorage.getItem('sachy.save.v1') ?? '{}') as { stats: { online: object } })
				.stats.online,
	);
	expect(online).toMatchObject({ w: 1, l: 0, d: 1 });

	expect([...ann.errors, ...bob.errors]).toEqual([]);
	await ann.close();
	await bob.close();
});

test('gomoku online: five in a row wins for one player and loses for the other', async ({
	browser,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const ann = await player(browser, 'Ann');
	const bob = await player(browser, 'Bob');
	const code = await create(ann.page, 'piskvorky');
	// Joining by the shared link.
	await bob.page.goto(`/games/piskvorky/index.html?duel=${code}`);
	await expect(ann.page.locator('.gm-c')).toHaveCount(225);
	const stones = (page: Page) =>
		page.evaluate('Kit._test.inst ? Kit._test.inst.getState().hist.length : -1') as Promise<number>;
	for (let k = 0; k < 5; k++) {
		await ann.page.locator(`.gm-c[data-i="${7 * 15 + 3 + k}"]`).click();
		if (k === 4) break;
		await expect.poll(() => stones(bob.page)).toBe(2 * k + 1);
		await bob.page.locator(`.gm-c[data-i="${9 * 15 + 3 + k}"]`).click();
		await expect.poll(() => stones(ann.page)).toBe(2 * k + 2);
	}
	await expect(result(ann.page)).toHaveText('Výhra!');
	await expect(result(bob.page)).toHaveText('Prohra');
	expect([...ann.errors, ...bob.errors]).toEqual([]);
	await ann.close();
	await bob.close();
});

test('prsi online: both players see the same deal and one of them wins', async ({
	browser,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const ann = await player(browser, 'Ann');
	const bob = await player(browser, 'Bob');
	const code = await create(ann.page, 'prsi');
	await bob.page.goto(`/games/prsi/index.html?duel=${code}`);
	await expect(ann.page.locator('.pr-hand .pr-card')).toHaveCount(4);
	await expect(bob.page.locator('.pr-hand .pr-card')).toHaveCount(4);
	// the same table on both sides: the same top card and the same card counts
	const table = (page: Page) =>
		page.evaluate('(s => [s.top, s.counts.join()])(Kit._test.inst._state())') as Promise<
			[number, string]
		>;
	expect(await table(ann.page)).toEqual(await table(bob.page));
	// both let the computer play for them until someone runs out of cards
	await ann.page.evaluate('Kit._test.inst._autoplay()');
	await bob.page.evaluate('Kit._test.inst._autoplay()');
	await expect(result(ann.page)).toHaveText(/Výhra!|Prohra/, { timeout: 60_000 });
	await expect(result(bob.page)).toHaveText(/Výhra!|Prohra/, { timeout: 60_000 });
	expect(await result(ann.page).textContent()).not.toEqual(await result(bob.page).textContent());
	expect([...ann.errors, ...bob.errors]).toEqual([]);
	await ann.close();
	await bob.close();
});

test('dama online: moves cross over and a resignation ends the game', async ({ browser }, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const ann = await player(browser, 'Ann');
	const bob = await player(browser, 'Bob');
	const code = await create(ann.page, 'dama');
	await bob.page.goto(`/games/dama/index.html?duel=${code}`);
	await expect(ann.page.locator('.dm-pc')).toHaveCount(24);
	await expect(bob.page.locator('.dm-pc')).toHaveCount(24);
	const count = (page: Page) =>
		page.evaluate('Kit._test.inst ? Kit._test.inst._state().moves.length : -1') as Promise<number>;
	// whoever is on the move plays the engine's choice; both boards must stay identical
	for (let k = 0; k < 6; k++) {
		const [a, b] = [ann.page, bob.page];
		const annMoves = (await a.evaluate(
			'(s => s.turn === s.me)(Kit._test.inst._state())',
		)) as boolean;
		await (annMoves ? a : b).evaluate('Kit._test.inst._move(Kit._test.inst._best())');
		await expect.poll(() => count(a)).toBe(k + 1);
		await expect.poll(() => count(b)).toBe(k + 1);
	}
	const board = (page: Page) =>
		page.evaluate('Kit._test.inst._state().b.join()') as Promise<string>;
	expect(await board(ann.page)).toEqual(await board(bob.page));
	await ann.page.locator('[data-t="resign"]').click();
	await expect(result(ann.page)).toHaveText('Prohra');
	await expect(result(bob.page)).toHaveText('Výhra!');
	expect([...ann.errors, ...bob.errors]).toEqual([]);
	await ann.close();
	await bob.close();
});

test('lode online: hidden fleets, shots answered by the defender, one side sinks the other', async ({
	browser,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const ann = await player(browser, 'Ann');
	const bob = await player(browser, 'Bob');
	const code = await create(ann.page, 'lode');
	await bob.page.goto(`/games/lode/index.html?duel=${code}`);
	for (const p of [ann.page, bob.page]) {
		await expect(p.locator('[data-b="ready"]')).toBeVisible();
		await p.evaluate('Kit._test.inst._ready()');
	}
	// whoever may fire takes the best shot until a fleet is gone
	for (let k = 0; k < 220; k++) {
		if ((await result(ann.page).count()) && (await result(bob.page).count())) break;
		for (const p of [ann.page, bob.page])
			await p.evaluate('Kit._test.inst && Kit._test.inst._fireBest()');
		await ann.page.waitForTimeout(60);
	}
	await expect(result(ann.page)).toHaveText(/Výhra!|Prohra/, { timeout: 20_000 });
	await expect(result(bob.page)).toHaveText(/Výhra!|Prohra/, { timeout: 20_000 });
	expect(await result(ann.page).textContent()).not.toEqual(await result(bob.page).textContent());
	expect([...ann.errors, ...bob.errors]).toEqual([]);
	await ann.close();
	await bob.close();
});

test('clovece online: both boards replay the same rolls and moves until someone is home', async ({
	browser,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const ann = await player(browser, 'Ann');
	const bob = await player(browser, 'Bob');
	const code = await create(ann.page, 'clovece');
	await bob.page.goto(`/games/clovece/index.html?duel=${code}`);
	await expect(ann.page.locator('.cl-pc')).toHaveCount(8);
	await expect(bob.page.locator('.cl-pc')).toHaveCount(8);
	for (const p of [ann.page, bob.page])
		await p.evaluate('Kit._test.inst._speed(20); Kit._test.inst._auto(true)');
	await expect(result(ann.page)).toHaveText(/Výhra!|Prohra/, { timeout: 120_000 });
	await expect(result(bob.page)).toHaveText(/Výhra!|Prohra/, { timeout: 30_000 });
	expect(await result(ann.page).textContent()).not.toEqual(await result(bob.page).textContent());
	expect([...ann.errors, ...bob.errors]).toEqual([]);
	await ann.close();
	await bob.close();
});

test('osadnici online: both islands replay the same rolls, builds and robberies to 10 points', async ({
	browser,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	test.setTimeout(240_000);
	const ann = await player(browser, 'Ann');
	const bob = await player(browser, 'Bob');
	const code = await create(ann.page, 'osadnici');
	await bob.page.goto(`/games/osadnici/index.html?duel=${code}`);
	await expect(ann.page.locator('.os-board svg')).toBeVisible();
	await expect(bob.page.locator('.os-board svg')).toBeVisible();
	// Ann (who created the game) places the first settlement; Bob waits.
	await expect(ann.page.locator('.os-spot').first()).toBeAttached();
	await expect(bob.page.locator('.os-spot')).toHaveCount(0);
	for (const p of [ann.page, bob.page])
		await p.evaluate('Kit._test.inst._speed(30); Kit._test.inst._auto(true)');
	await expect(result(ann.page)).toHaveText(/Výhra!|Prohra/, { timeout: 200_000 });
	await expect(result(bob.page)).toHaveText(/Výhra!|Prohra/, { timeout: 30_000 });
	expect(await result(ann.page).textContent()).not.toEqual(await result(bob.page).textContent());
	expect([...ann.errors, ...bob.errors]).toEqual([]);
	await ann.close();
	await bob.close();
});

test('tanks online: both see the same shots, terrain and damage; a resignation ends it', async ({
	browser,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const ann = await player(browser, 'Ann');
	const bob = await player(browser, 'Bob');
	const code = await create(ann.page, 'tanky');
	await bob.page.goto(`/games/tanky/index.html?duel=${code}`);
	await expect(ann.page.locator('.tk-board')).toBeVisible();
	await expect(bob.page.locator('.tk-board')).toBeVisible();
	type TkState = {
		active: number;
		phase: string;
		moves: number;
		tanks: { x: number; y: number; hp: number }[];
	};
	const state = (page: Page) =>
		page.evaluate('Kit._test.inst ? Kit._test.inst._state() : null') as Promise<TkState | null>;
	const shoot = async (page: Page, a: number, pw: number) => {
		await expect.poll(async () => (await state(page))?.phase).toBe('aim');
		await page.evaluate(`Kit._test.inst._aim(${a}, ${pw})`);
		await page.locator('.tk-fire').click();
	};
	// Ann created the game: she plays first with the left tank; Bob can't fire yet.
	await expect(bob.page.locator('.tk-fire')).toBeDisabled();
	await shoot(ann.page, 45, 72);
	await expect.poll(async () => (await state(bob.page))?.moves).toBe(1);
	await expect.poll(async () => (await state(bob.page))?.active).toBe(1);
	await shoot(bob.page, 135, 72);
	await expect.poll(async () => (await state(ann.page))?.moves).toBe(2);
	// After both shots the battlefield is the same on both screens.
	await expect.poll(async () => (await state(ann.page))?.phase).toBe('aim');
	await expect.poll(async () => (await state(bob.page))?.phase).toBe('aim');
	expect((await state(ann.page))?.tanks).toEqual((await state(bob.page))?.tanks);
	await ann.page.locator('[data-c="resign"]').click();
	await expect(result(bob.page)).toHaveText('Výhra!');
	await expect(result(ann.page)).toHaveText('Prohra');
	expect([...ann.errors, ...bob.errors]).toEqual([]);
	await ann.close();
	await bob.close();
});

test('worms online: the turn is replayed for the other player and both islands agree', async ({
	browser,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const ann = await player(browser, 'Ann');
	const bob = await player(browser, 'Bob');
	const code = await create(ann.page, 'cervici');
	await bob.page.goto(`/games/cervici/index.html?duel=${code}`);
	await expect(ann.page.locator('.cv-board')).toBeVisible();
	await expect(bob.page.locator('.cv-board')).toBeVisible();
	type CvState = {
		team: number;
		phase: string;
		moves: number;
		worms: { x: number; y: number; hp: number; dead: boolean }[];
	};
	const state = (page: Page) =>
		page.evaluate('Kit._test.inst ? Kit._test.inst._state() : null') as Promise<CvState | null>;
	const shoot = async (page: Page) => {
		await expect.poll(async () => (await state(page))?.phase, { timeout: 20_000 }).toBe('move');
		await page.evaluate('Kit._test.inst._aim(40, 0.55); Kit._test.inst._fire()');
	};
	// Ann plays first (blue team); Bob waits.
	await expect.poll(async () => (await state(bob.page))?.phase).toBe('remote');
	await shoot(ann.page);
	await expect.poll(async () => (await state(bob.page))?.moves, { timeout: 30_000 }).toBe(1);
	await shoot(bob.page);
	await expect.poll(async () => (await state(ann.page))?.moves, { timeout: 30_000 }).toBe(2);
	// After both turns every worm is in the same place with the same health on both screens.
	await expect.poll(async () => (await state(ann.page))?.phase, { timeout: 20_000 }).toBe('move');
	expect((await state(ann.page))?.worms).toEqual((await state(bob.page))?.worms);
	await ann.page.locator('[data-c="resign"]').click();
	await expect(result(bob.page)).toHaveText('Výhra!');
	await expect(result(ann.page)).toHaveText('Prohra');
	expect([...ann.errors, ...bob.errors]).toEqual([]);
	await ann.close();
	await bob.close();
});

test('a sudoku race: same puzzle for both, live progress and standings', async ({
	browser,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const ann = await player(browser, 'Ann');
	const bob = await player(browser, 'Bob');
	const code = await create(ann.page, 'sudoku');
	await bob.page.goto(`/games/sudoku/index.html?duel=${code}`);
	await expect(ann.page.locator('.k-plist li')).toHaveCount(2);
	await ann.page.locator('.k-chip[data-diff="easy"]').click();
	await ann.page.locator('#kStart').click();
	await expect(bob.page.locator('#kCount')).toBeVisible();
	await expect(ann.page.locator('.sd-grid')).toBeVisible({ timeout: 10_000 });
	await expect(bob.page.locator('.sd-grid')).toBeVisible({ timeout: 10_000 });

	// Both got the same puzzle.
	const givens = (page: Page) =>
		page.evaluate(() => [...document.querySelectorAll('.sd-c.given')].map((c) => c.textContent));
	expect(await givens(ann.page)).toEqual(await givens(bob.page));

	// Ann solves first; Bob sees her finish in the race bar.
	expect(await bob.page.evaluate('Kit._test.inst.progress()')).toBe(0);
	await ann.page.evaluate('Kit._test.inst._solve()');
	await expect(result(ann.page)).toHaveText('Vyřešeno!');
	await expect(bob.page.locator('.k-race .ok')).toContainText('Ann');
	await bob.page.evaluate('Kit._test.inst._solve()');
	await expect(result(ann.page)).toHaveText('Vítězství!');
	await expect(ann.page.locator('#kModal .k-stand li').first()).toContainText('Ann');
	await expect(ann.page.locator('#kNextRound')).toBeVisible();
	expect([...ann.errors, ...bob.errors]).toEqual([]);
	await ann.close();
	await bob.close();
});

test('online games reject bad requests', async ({ request }, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	expect(
		(await request.post('/api/duel/rooms', { data: { game: 'sachy', kind: 'solo' } })).status(),
	).toBe(400);
	expect((await request.get('/api/duel/rooms')).status()).toBe(400);
	expect((await request.get('/api/duel/rooms/ZZZZZ')).status()).toBe(404);
	expect((await request.get('/api/duel/rooms/nope')).status()).toBe(404);
	const crossSite = await request.post('/api/duel/rooms', {
		data: { game: 'sachy', kind: 'turn', diff: 'online' },
		headers: { origin: 'https://evil.example' },
	});
	expect(crossSite.status()).toBe(403);
});
