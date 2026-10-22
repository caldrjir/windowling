import { expect, test } from '@playwright/test';
import { E2E_SITE_PASSWORD } from './gate';

// The center picks its language from the browser; the tests start in Czech.
test.use({ locale: 'cs-CZ' });

test('the game center opens with its library', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/');
	await expect(page).toHaveTitle('Windowling Game Center');
	await expect(page.locator('.brand')).toContainText('WINDOWLING');
	await expect(page.locator('.hero-title')).toHaveText('VOIDBORN');
	// Two games and free slots on the shelf.
	await expect(page.getByTestId('shelf').locator('.gcard')).toHaveCount(4);
	await expect(page.getByTestId('shelf').locator('.gcard.soon')).toHaveCount(2);
	expect(errors).toEqual([]);
});

test('switches language and keeps it for the games', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'EN', exact: true }).click();
	await expect(page.locator('.lib-head h2')).toHaveText('Library');
	await expect(page.getByTestId('play')).toContainText('PLAY');
	expect(await page.evaluate(() => localStorage.getItem('gamecenter.lang'))).toBe('en');
	await page.reload();
	await expect(page.locator('.lib-head h2')).toHaveText('Library');
	await page.getByRole('button', { name: 'CS', exact: true }).click();
	await expect(page.locator('.lib-head h2')).toHaveText('Knihovna');
});

test('launches VOIDBORN and comes back to the center', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');
	await page.getByTestId('play').click();
	// Workers assets serve index.html as the directory URL.
	await page.waitForURL('**/games/voidborn/**');
	await expect(page).toHaveTitle('VOIDBORN');
	await expect(page.locator('#s-title')).not.toBeEmpty();
	expect(errors).toEqual([]);
	// The game returns via ../../index.html: that lands on the center.
	await page.goto('/index.html');
	await expect(page).toHaveURL(/\/$/);
	await expect(page).toHaveTitle('Windowling Game Center');
});

for (const [game, canvas] of [
	['voidborn', 'cv'],
	['starspire', 'fx'],
] as const) {
	test(`right-click in ${game} does not open the browser menu`, async ({ page }) => {
		await page.goto(`/games/${game}/index.html`);
		await expect(page.locator('#s-title')).not.toBeEmpty();
		const prevented = await page.evaluate(
			(id) =>
				!document
					.getElementById(id)
					?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
			canvas,
		);
		expect(prevented).toBe(true);
	});
}

test('launches STARSPIRE from the center and plays a card', async ({ page, isMobile }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');
	// First tap selects the card on the shelf, the second one launches it.
	const card = page.getByTestId('shelf').locator('.gcard').nth(1);
	await card.click();
	await expect(page.locator('.hero-title')).toHaveText('STARSPIRE');
	await card.click();
	await page.waitForURL('**/games/starspire/**');
	await expect(page).toHaveTitle('STARSPIRE');

	const tap = (selector: string) =>
		isMobile
			? page.locator(selector).first().tap({ force: true })
			: page.locator(selector).first().click({ force: true });
	await page.locator('#s-title').click();
	await tap('[data-go="heroes"]');
	await tap('[data-act="startRun"]');
	await tap('.node.avail');
	await expect(page.locator('#hand .card')).toHaveCount(5);
	await expect(page.locator('#endTurn')).toBeInViewport();
	// Tap a card, then the enemy: the card is played and costs energy.
	await tap('#hand .card');
	await tap('.enemy:not(.dead)');
	await expect(page.locator('#hand .card')).toHaveCount(4);
	expect(errors).toEqual([]);
});

test('VOIDBORN can be played by touch', async ({ page, context, isMobile }) => {
	test.skip(!isMobile, 'touch controls are for phones');
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/games/voidborn/index.html');
	await page.touchscreen.tap(100, 100);
	await page.locator('[data-go="hangar"]').tap();
	await page.locator('#startBtn').tap();
	await expect(page.locator('#dashBtn')).toBeVisible();

	// Drag a floating stick to the right: the ship follows.
	const cdp = await context.newCDPSession(page);
	const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
		cdp.send('Input.dispatchTouchEvent', {
			type,
			touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
		});
	await touch('touchStart', 120, 500);
	for (let i = 1; i <= 8; i++) await touch('touchMove', 120 + i * 8, 500);
	await expect
		// The game's state is a top-level `const G` (not on window).
		.poll(() => page.evaluate<number>('G.p.x'))
		.toBeGreaterThan(50);
	await touch('touchEnd');
	expect(errors).toEqual([]);
});

test('shows the stats a game saved in this browser', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() =>
		localStorage.setItem(
			'gamecenter.stats.voidborn',
			JSON.stringify({
				playTime: 3725,
				lastPlayed: Date.now() - 60_000,
				progress: 0.25,
				stats: { kills: 1234, sectors: 2 },
			}),
		),
	);
	await page.reload();
	await expect(page.getByTestId('play')).toContainText('POKRAČOVAT');
	await expect(page.locator('.stats')).toContainText('1');
	await expect(page.locator('.stats')).toContainText('Dobyté sektory');
	await expect(page.locator('.prog')).toContainText('25');
	await expect(page.locator('.foot')).toContainText('1 h 2 min');
});

test('signing in is offered only when Google is configured, and nobody is signed in by default', async ({
	page,
	request,
}) => {
	await page.goto('/');
	// E2E runs without Google credentials: no sign-in button, no user.
	await expect(page.getByTestId('account')).not.toContainText('Odhlásit');
	await expect(page.getByTestId('account').getByRole('button')).toHaveCount(0);
	const session = await request.get('/api/auth/get-session');
	expect(session.ok()).toBe(true);
	expect(await session.json()).toBeNull();
});

test('the service worker only cleans up caches', async ({ request }) => {
	const sw = await request.get('/service-worker.js');
	expect(sw.ok()).toBe(true);
	expect(await sw.text()).toContain('unregister');
});

test('health endpoint reports the database', async ({ request }) => {
	const response = await request.get('/api/health');
	expect(response.ok()).toBe(true);
	expect(await response.json()).toEqual({ status: 'ok', database: 'ok' });
});

test.describe('without the site password', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('the hub, the games and the API are locked', async ({ page, request }) => {
		await page.goto('/games/voidborn/index.html');
		await expect(page).toHaveURL(/\/gate\?next=%2Fgames%2Fvoidborn%2Findex\.html$/);
		await expect(page.locator('input[type=password]')).toBeVisible();
		expect((await request.get('/games/voidborn/js/game.js')).status()).toBe(401);
		expect((await request.get('/api/auth/get-session')).status()).toBe(401);
		// The deploy smoke test still works.
		expect((await request.get('/api/health')).ok()).toBe(true);
	});

	test('the right password lets you in and back to where you were going', async ({ page }) => {
		await page.goto('/games/voidborn/index.html');
		await page.locator('input[type=password]').fill('not the password');
		await page.locator('button[type=submit]').click();
		await expect(page.getByRole('alert')).toBeVisible();

		await page.locator('input[type=password]').fill(E2E_SITE_PASSWORD);
		await page.locator('button[type=submit]').click();
		await expect(page).toHaveTitle('VOIDBORN');
		await page.goto('/');
		await expect(page).toHaveTitle('Windowling Game Center');
	});
});
