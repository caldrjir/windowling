import { expect, test } from '@playwright/test';

// The center picks its language from the browser; the tests start in Czech.
test.use({ locale: 'cs-CZ' });

test('the game center opens with its library', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/');
	await expect(page).toHaveTitle('Windowling Game Center');
	await expect(page.locator('.brand')).toContainText('WINDOWLING');
	await expect(page.locator('.hero-title')).toHaveText('VOIDBORN');
	// One game and free slots on the shelf.
	await expect(page.getByTestId('shelf').locator('.gcard')).toHaveCount(4);
	await expect(page.getByTestId('shelf').locator('.gcard.soon')).toHaveCount(3);
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

test('the previous app is gone', async ({ request }) => {
	for (const path of ['/api/ai/decide', '/api/world/money', '/api/world/wake']) {
		expect((await request.post(path, { data: {} })).status(), path).toBe(404);
	}
	expect((await request.get('/characters/ava.glb')).status()).toBe(404);
	// The old service worker is replaced by one that cleans up after it.
	const sw = await request.get('/service-worker.js');
	expect(sw.ok()).toBe(true);
	expect(await sw.text()).toContain('unregister');
});

test('health endpoint reports the database', async ({ request }) => {
	const response = await request.get('/api/health');
	expect(response.ok()).toBe(true);
	expect(await response.json()).toEqual({ status: 'ok', database: 'ok' });
});
