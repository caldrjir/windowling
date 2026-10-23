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
