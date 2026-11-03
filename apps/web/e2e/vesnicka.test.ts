import { expect, test, type Page } from '@playwright/test';

// VESNIČKA: the idle village. The game's objects (Game, Scene, ...) are globals of the page's
// classic scripts; the test plays by clicking and only shortens the waiting.
test.use({ locale: 'cs-CZ' });

const URL = '/games/vesnicka/index.html';
const run = <T>(page: Page, code: string): Promise<T> =>
	page.evaluate(`(() => { ${code} })()`) as Promise<T>;

test('VESNIČKA: tap, build, catch a creature, pass the village on and earn while away', async ({
	page,
	context,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));

	await page.goto(URL);
	await page.locator('.sheet .btn').click();
	await expect(page.locator('#modal')).toBeHidden();

	// Tapping the village earns the first groschen; a field costs 12.
	const cv = page.locator('#cv');
	const box = await cv.boundingBox();
	if (!box) throw new Error('no canvas');
	for (let i = 0; i < 14; i++)
		await cv.click({ position: { x: box.width / 2 + (i % 4) * 12, y: box.height * 0.62 } });
	expect(await run<number>(page, 'return Game.S.taps;')).toBe(14);
	await expect(page.locator('#hint')).toBeHidden();
	await page.locator('.row[data-b="0"] .buy').click();
	expect(await run<number>(page, 'return Game.S.owned.pole;')).toBe(1);
	await expect(page.locator('.row[data-b="0"] .cnt')).toHaveText('1');
	// The village fits the screen (phones too).
	expect(
		await run<boolean>(page, 'return document.documentElement.scrollWidth <= innerWidth;'),
	).toBe(true);

	// A fairy-tale creature appears; tapping it casts its spell.
	await run(page, 'Game.S.taps = 50; Game.S.nextCreature = 0;');
	await expect
		.poll(() => run<string | null>(page, 'return Scene.creature && Scene.creature.id;'))
		.not.toBeNull();
	await run(page, 'Scene.focusCreature();');
	await page.waitForTimeout(800); // the camera settles on the creature
	const pos = await run<{ x: number; y: number }>(page, 'return Scene.creatureScreen();');
	await cv.click({ position: { x: Math.round(pos.x), y: Math.round(pos.y) } });
	expect(
		await run<number>(page, 'return Object.values(Game.S.caught).reduce((a, b) => a + b, 0);'),
	).toBe(1);

	// Upgrades: buy everything the purse allows.
	await run(page, 'Game.S.coins = 1e6; Game.S.owned.kurnik = 12;');
	await page.locator('[data-tab="upg"]').click();
	await page.locator('#buyAll').click();
	expect(await run<number>(page, 'return Object.keys(Game.S.upg).length;')).toBeGreaterThan(3);

	// Passing the village on: legends instead of buildings, the chronicle remembers.
	await run(page, 'Game.S.earnedAll = 2e10;');
	await page.locator('[data-tab="legend"]').click();
	await page.locator('#prestige').click();
	await page.locator('.sheet .btn.gold').click();
	expect(
		await run<{ legends: number; gen: number; pole: number; upg: number }>(
			page,
			'return { legends: Game.S.legends, gen: Game.S.gen, pole: Game.S.owned.pole, upg: Object.keys(Game.S.upg).length };',
		),
	).toEqual({ legends: 2, gen: 2, pole: 0, upg: 0 });

	// The hub reads the stats and the leaderboard the legends.
	await run(page, 'Game.save();');
	const stats = await run<{ playTime: number; stats: { legends: number; generation: number } }>(
		page,
		'return JSON.parse(localStorage.getItem("gamecenter.stats.vesnicka"));',
	);
	expect(stats.stats).toMatchObject({ legends: 2, generation: 2 });
	expect(stats.playTime).toBeGreaterThanOrEqual(0);
	expect(
		await run<unknown>(page, 'return JSON.parse(localStorage.getItem("vesnicka.save.v1")).lb;'),
	).toEqual({ 'best:score': 2 });

	// Three hours away: the village kept earning.
	const save = await run<string>(
		page,
		'Game.S.owned.pole = 30; Game.save(); const o = JSON.parse(localStorage.getItem("vesnicka.save.v1")); o.t -= 3 * 3600 * 1000; return JSON.stringify(o);',
	);
	await page.close();
	const back = await context.newPage();
	back.on('pageerror', (e) => errors.push(e.message));
	await back.addInitScript((v) => {
		if (!sessionStorage.getItem('vesnicka.e2e')) {
			localStorage.setItem('vesnicka.save.v1', v);
			sessionStorage.setItem('vesnicka.e2e', '1');
		}
	}, save);
	await back.goto(URL);
	await expect(back.locator('.sheet')).toContainText('Vítej zpátky');
	await expect(back.locator('.sheet')).toContainText('3 h');
	expect(await run<number>(back, 'return Game.S.coins;')).toBeGreaterThan(1000);

	expect(errors).toEqual([]);
});

test('VESNIČKA in the center: the card, the cover and the link', async ({ page }) => {
	await page.goto('/');
	const card = page.getByTestId('library').locator('.gslot[data-game="vesnicka"]');
	await expect(card).toBeVisible();
	await expect(page.getByTestId('shelf-relax')).toContainText('VESNIČKA');
	const cover = await page.request.get('/games/vesnicka/cover/scene.webp');
	expect(cover.ok()).toBe(true);
});
