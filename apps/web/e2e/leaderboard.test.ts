import { expect, test, type Browser } from '@playwright/test';
import { createTestUser, deleteTestUsers } from './auth';
import { GATE_STATE } from './gate';

// Leaderboards: signed-in players' best results on identical challenges, visible to everyone.
test.use({ locale: 'cs-CZ' });

const users: string[] = [];
test.afterAll(async () => {
	await deleteTestUsers(users);
});

async function player(browser: Browser, baseURL: string, nick: string) {
	const u = await createTestUser(nick);
	users.push(u.id);
	const ctx = await browser.newContext({ storageState: GATE_STATE, locale: 'cs-CZ' });
	await u.signIn(ctx, baseURL);
	const page = await ctx.newPage();
	await page.goto('/');
	await page.getByTestId('nick-input').fill(nick);
	await page.getByRole('button', { name: 'Uložit' }).click();
	await expect(page.getByTestId('account')).toContainText(nick);
	return { page, close: () => ctx.close() };
}

const today = () => {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('the daily puzzle has a leaderboard of the same puzzle for everyone', async ({
	browser,
	baseURL,
	request,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const stamp = Date.now() % 100000;
	const fast = await player(browser, baseURL ?? '', `Rychlá${stamp}`);
	const slow = await player(browser, baseURL ?? '', `Pomalý${stamp}`);

	for (const [p, wait] of [
		[fast, 1200],
		[slow, 2600],
	] as const) {
		await p.page.goto('/games/sudoku/index.html');
		await p.page.locator('[data-k="daily"]').click();
		await expect(p.page.locator('.k-gen')).toHaveCount(0, { timeout: 20_000 });
		await p.page.waitForTimeout(wait);
		await p.page.evaluate('Kit._test.inst._solve()');
		await expect(p.page.locator('#kModal:not([hidden]) .k-result')).toBeVisible();
		await p.page.evaluate('GCSync.sync()');
	}

	// Anyone can read the board; the faster player is first.
	const board = `daily:${today()}:time`;
	const res = await request.get(`/api/scores?game=sudoku&board=${board}`);
	const lb = (await res.json()) as { entries: { nickname: string; rank: number }[] };
	const ours = lb.entries.filter((e) => e.nickname.endsWith(String(stamp)));
	expect(ours.map((e) => e.nickname)).toEqual([`Rychlá${stamp}`, `Pomalý${stamp}`]);

	// The slower player sees the board in the game, with their own row marked.
	await slow.page.locator('#kLb').click();
	await expect(slow.page.locator('.k-lb tr.me')).toContainText(`Pomalý${stamp}`);
	await expect(slow.page.locator('.k-lb tbody')).toContainText(`Rychlá${stamp}`);

	// The center shows it too (sudoku is the last game played).
	await slow.page.goto('/');
	await expect(slow.page.getByTestId('leaderboard')).toContainText(`Rychlá${stamp}`);

	await fast.close();
	await slow.close();
});

test('action games rank records and every game ranks play time', async ({
	browser,
	baseURL,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	const nick = `Pilot${Date.now() % 100000}`;
	const p = await player(browser, baseURL ?? '', nick);
	await p.page.evaluate(() => {
		localStorage.setItem('voidborn.save.v1', JSON.stringify({ stats: { bestTime: 754.2 } }));
		localStorage.setItem(
			'gamecenter.stats.voidborn',
			JSON.stringify({ playTime: 7200, lastPlayed: Date.now(), stats: {} }),
		);
	});
	await p.page.evaluate('GCSync.sync()');
	const get = async (board: string) =>
		(await (
			await p.page.request.get(`/api/scores?game=voidborn&board=${board}&limit=50`)
		).json()) as {
			entries: { nickname: string; value: number }[];
			me: { rank: number; value: number } | null;
		};
	expect((await get('best:survive')).me?.value).toBe(754_200);
	expect((await get('total:played')).me?.value).toBe(7200);
	// The center's panel switches between the record and play time.
	// VOIDBORN is selected: it was played last.
	await p.page.reload();
	await expect(p.page.locator('.hero-title')).toHaveText('VOIDBORN');
	await expect(p.page.getByTestId('leaderboard')).toContainText(nick);
	await p.page.getByTestId('leaderboard').getByRole('button', { name: 'Nejvíc nahráno' }).click();
	await expect(p.page.getByTestId('leaderboard')).toContainText('2 h 0 min');
	await p.close();
});

test('the leaderboard API rejects bad boards and anonymous results', async ({ request }, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'one run is enough for the server');
	expect((await request.get('/api/scores?game=sudoku&board=anything')).status()).toBe(400);
	expect((await request.get('/api/scores?game=nope&board=best:floor')).status()).toBe(400);
	const anon = await request.post('/api/scores', {
		data: { scores: [{ game: 'sudoku', board: 'best:score', value: 1 }] },
	});
	expect(anon.status()).toBe(401);
});
