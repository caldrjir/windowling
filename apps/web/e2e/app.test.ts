import { expect, test } from '@playwright/test';

test('app loads and the game canvas starts rendering', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/');
	await expect(page).toHaveTitle('Windowling');

	const canvas = page.getByTestId('game-canvas');
	await expect(canvas).toBeVisible();
	await expect(canvas).toHaveAttribute('data-status', 'running', { timeout: 15_000 });

	// The character starts doing something on its own - nobody asked it to.
	await expect(canvas).toHaveAttribute(
		'data-character-action',
		/^(idle|(walkTo|sit|sleep):[a-z][a-z0-9_.-]*)$/,
		{ timeout: 10_000 },
	);

	const box = await canvas.boundingBox();
	const viewport = page.viewportSize();
	expect(box?.width).toBe(viewport?.width);
	expect(box?.height).toBe(viewport?.height);
	expect(errors).toEqual([]);
});

test('a first visit creates an anonymous world that survives a reload', async ({ page }) => {
	await page.goto('/');

	const status = page.getByTestId('world-status');
	await expect(status).toContainText("'s place", { timeout: 15_000 });
	const worldId = await status.getAttribute('data-world-id');
	expect(worldId).toMatch(/^[0-9a-f-]{36}$/);

	await page.reload();
	await expect(status).toContainText("'s place");
	await expect(status).toHaveAttribute('data-world-id', worldId!);
});

test('different visitors get different worlds', async ({ browser }) => {
	const ids: string[] = [];
	for (let i = 0; i < 2; i++) {
		const context = await browser.newContext();
		const page = await context.newPage();
		await page.goto('/');
		const status = page.getByTestId('world-status');
		await expect(status).toContainText("'s place", { timeout: 15_000 });
		ids.push((await status.getAttribute('data-world-id'))!);
		await context.close();
	}
	expect(ids[0]).not.toBe(ids[1]);
});

test('PWA manifest is served and installable-shaped', async ({ request }) => {
	const response = await request.get('/manifest.webmanifest');
	expect(response.ok()).toBe(true);
	const manifest = await response.json();
	expect(manifest.display).toBe('standalone');
	expect(manifest.start_url).toBe('/');
	const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
	expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
	for (const icon of manifest.icons) {
		expect((await request.get(icon.src)).ok()).toBe(true);
	}
});

test('health endpoint reports a reachable database', async ({ request }) => {
	const response = await request.get('/api/health');
	expect(response.ok()).toBe(true);
	expect(await response.json()).toEqual({ status: 'ok', database: 'ok' });
});

test('security headers are set on pages', async ({ request }) => {
	const response = await request.get('/');
	const csp = response.headers()['content-security-policy'];
	expect(csp).toContain("frame-ancestors 'none'");
	expect(csp).toContain("object-src 'none'");
});
