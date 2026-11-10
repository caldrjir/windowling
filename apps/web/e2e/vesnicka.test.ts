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
	// Daily tasks say when the next ones arrive.
	await page.locator('[data-tab="tasks"]').click();
	await expect(page.locator('#dailyNext')).toContainText('Nové úkoly za');
	await page.locator('[data-tab="build"]').click();
	// "To the next upgrade": exactly what is missing to the next tier or mastery.
	await run(page, 'Game.S.coins = 1e5;');
	const to = page.locator('.row[data-b="0"] .to');
	await expect(to).toContainText('+9 → 10');
	await expect(page.locator('.row[data-b="0"] .mx')).toContainText('max +');
	await to.click();
	expect(await run<number>(page, 'return Game.S.owned.pole;')).toBe(10);
	// The best buy on the green buys what pays for itself fastest.
	const bought = () => run<number>(page, 'return Game.S.stats.bought + Game.S.stats.upgrades;');
	const before = await bought();
	await expect(page.locator('#quick')).toBeVisible();
	await page.locator('#quick').click();
	expect(await bought()).toBe(before + 1);
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
	await run(page, 'Game.S.earnedAll = 3e10;');
	await page.locator('[data-tab="legend"]').click();
	await page.locator('#prestige').click();
	await page.locator('.sheet .btn.gold').click();
	expect(
		await run<{ legends: number; gen: number; pole: number; upg: number }>(
			page,
			'return { legends: Game.S.legends, gen: Game.S.gen, pole: Game.S.owned.pole, upg: Object.keys(Game.S.upg).length };',
		),
	).toEqual({ legends: 3, gen: 2, pole: 0, upg: 0 });

	// The steward costs 3 legends; the chronicle still counts them.
	await page.locator('[data-tab="legend"]').click();
	await page.locator('#hire').click();
	await page.locator('.sheet .btn.gold').click();
	expect(
		await run(
			page,
			'return { st: Game.S.steward, leg: Game.S.legends, total: Econ.legendsTotal(Game.S) };',
		),
	).toEqual({ st: true, leg: 0, total: 3 });
	await expect(page.locator('.steward #autoBuy')).toBeChecked();
	await run(page, 'Game.S.coins = 1e6;');
	await expect.poll(() => run<number>(page, 'return Game.S.stats.stewardBuys;')).toBeGreaterThan(5);

	// A rare visitor: tapping him unlocks a secret achievement.
	await run(
		page,
		"Scene.clearCreature(); Scene.spawnCreature('nesro', 60); Scene.focusCreature();",
	);
	await page.waitForTimeout(800);
	const at = await run<{ x: number; y: number }>(page, 'return Scene.creatureScreen();');
	await cv.click({ position: { x: Math.round(at.x), y: Math.round(at.y) } });
	expect(await run(page, 'return [Game.S.stats.nesro, !!Game.S.ach.nesro];')).toEqual([1, true]);

	// The hub reads the stats and the leaderboard the legends.
	await run(page, 'Game.save();');
	const stats = await run<{ playTime: number; stats: { legends: number; generation: number } }>(
		page,
		'return JSON.parse(localStorage.getItem("gamecenter.stats.vesnicka"));',
	);
	expect(stats.stats).toMatchObject({ legends: 3, generation: 2 });
	expect(stats.playTime).toBeGreaterThanOrEqual(0);
	const lb = await run<Record<string, number>>(
		page,
		'return JSON.parse(localStorage.getItem("vesnicka.save.v1")).lb;',
	);
	expect(lb).toMatchObject({ 'best:score': 3, 'free:pokoleni:score': 1 });
	expect(lb['free:budovy:score']).toBeGreaterThan(10);
	expect(lb['free:jmeni:score']).toBeGreaterThan(10_000); // log10(3e10) × 1000

	// A day away: the village earned up to its limit and the steward kept buying; the news
	// of the latest version shows up once.
	const save = await run<string>(
		page,
		'Game.S.owned.pole = 30; Game.save(); const o = JSON.parse(localStorage.getItem("vesnicka.save.v1")); o.t -= 24 * 3600 * 1000; o.seen.news = 1; return JSON.stringify(o);',
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
	const welcome = back.locator('.sheet');
	await expect(welcome).toContainText('Vítej zpátky');
	await expect(welcome).toContainText('1 d 0 h');
	await expect(welcome).toContainText('Vydělávala 12 h 0 min');
	await expect(welcome).toContainText('Využito 50 %');
	await expect(welcome).toContainText('Šafář mezitím koupil');
	await welcome.locator('.btn').click();
	await expect(back.locator('#news')).toBeVisible();
	await expect(back.locator('#news')).toContainText('Šafář');
	await back.locator('#news [data-close]').click();
	await expect(back.locator('#newsBtn .dot')).toBeHidden();
	// When to come back: the limit and the time on the clock.
	await back.locator('[data-tab="more"]').click();
	await expect(back.locator('.away-card')).toContainText('Vrať se nejpozději');

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
