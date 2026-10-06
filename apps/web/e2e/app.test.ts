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
		/^(idle|(walkTo|sit|sleep|eat|work|play):[a-z][a-z0-9_.-]*)$/,
		{ timeout: 10_000 },
	);
	// ...and what it does comes from the simulation's schedule.
	await expect(canvas).toHaveAttribute('data-activity', /^(sleep|eat|work|gaming|idle)$/, {
		timeout: 15_000,
	});

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

test('the character lives in the time zone of the device', async ({ browser }) => {
	const context = await browser.newContext({ timezoneId: 'Pacific/Auckland' });
	const page = await context.newPage();
	await page.goto('/');
	const status = page.getByTestId('world-status');
	await expect(status).toHaveAttribute('data-time-zone', 'Pacific/Auckland', { timeout: 15_000 });
	await context.close();
});

test('the character does not notice you just because you opened the app', async ({ page }) => {
	await page.goto('/');
	const canvas = page.getByTestId('game-canvas');
	await expect(canvas).toHaveAttribute('data-status', 'running', { timeout: 15_000 });
	await expect(page.getByTestId('world-status')).toContainText("'s place", { timeout: 15_000 });
	await page.waitForTimeout(2_000);
	// At most a suspicious glance - it doesn't *know* you are there yet.
	await expect(canvas).toHaveAttribute('data-awareness', /^(UNKNOWN|SUSPECTED)$/);
});

test('knocking on the glass gets noticed - asleep or awake', async ({ page }) => {
	await page.goto('/');
	const canvas = page.getByTestId('game-canvas');
	await expect(canvas).toHaveAttribute('data-status', 'running', { timeout: 15_000 });
	await expect(canvas).toHaveAttribute('data-activity', /.+/, { timeout: 15_000 });
	const box = await canvas.boundingBox();
	if (!box) throw new Error('canvas has no box');
	// A sleeper needs several knocks in quick succession; anyone awake notices sooner.
	for (let i = 0; i < 4; i++) {
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		await page.waitForTimeout(150);
	}
	await expect(canvas).toHaveAttribute('data-awareness', /^(DETECTED|INTERACTING|IGNORING)$/, {
		timeout: 5_000,
	});
});

test('the character comes to the window and says something', async ({ page }) => {
	// It may brush us off first and only come over after more knocking - its choice.
	test.setTimeout(90_000);
	await page.goto('/');
	const canvas = page.getByTestId('game-canvas');
	await expect(canvas).toHaveAttribute('data-status', 'running', { timeout: 15_000 });
	await expect(canvas).toHaveAttribute('data-activity', /.+/, { timeout: 15_000 });
	const box = await canvas.boundingBox();
	if (!box) throw new Error('canvas has no box');
	const subtitles = page.getByTestId('subtitles');
	// Knock until it decides to come over (it may ignore us for a while - its choice).
	for (let i = 0; i < 40; i++) {
		if ((await canvas.getAttribute('data-character-action')) === 'walkTo:window') break;
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		await page.waitForTimeout(400);
	}
	// At the window it speaks first, and you can answer (after a one-time download consent).
	const talk = page.getByTestId('talk-button');
	await expect(talk).toBeVisible({ timeout: 20_000 });
	await expect(subtitles).toHaveAttribute('data-line', /\w+/, { timeout: 20_000 });
	await expect(subtitles.getByRole('paragraph')).toBeVisible();
	await talk.dispatchEvent('pointerdown');
	await expect(page.getByRole('dialog', { name: 'Let them hear you' })).toBeVisible();
	await page.getByRole('button', { name: 'Not now' }).click();
	await expect(talk).toHaveAttribute('data-phase', 'off');
});

test('settings offer subtitles, voice and where the brain runs', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('game-canvas')).toHaveAttribute('data-status', 'running', {
		timeout: 15_000,
	});
	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(page.getByRole('radiogroup', { name: 'Subtitles' })).toBeVisible();
	const brain = page.getByRole('radiogroup', { name: 'Brain' });
	await brain.getByRole('radio', { name: 'Cloud' }).click();
	await expect(brain.getByRole('radio', { name: 'Cloud' })).toHaveAttribute('aria-checked', 'true');
	// Never downloads anything by itself: the device brain only reports what it found.
	await expect(page.getByTestId('device-brain')).toHaveAttribute(
		'data-status',
		/^(unsupported|absent|downloaded)$/,
		{ timeout: 10_000 },
	);
	await page.reload();
	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(
		page.getByRole('radiogroup', { name: 'Brain' }).getByRole('radio', { name: 'Cloud' }),
	).toHaveAttribute('aria-checked', 'true');
});

test('debug panel shows what the character is thinking', async ({ page }) => {
	await page.goto('/?debug');
	await expect(page.getByTestId('debug-panel')).toContainText('awareness', { timeout: 15_000 });
});

test('memories stay private to their world', async ({ request }) => {
	const body = { event: 'player_at_window', awareness: 'DETECTED', recent: [] };
	expect((await request.post('/api/ai/context', { data: body })).status()).toBe(401);
	expect(
		(
			await request.post('/api/ai/outcome', {
				data: { ...body, decision: { emotion: 'happy', intensity: 1, action: { type: 'idle' } } },
			})
		).status(),
	).toBe(401);
});

test('the brain needs a session', async ({ request }) => {
	const response = await request.post('/api/ai/decide', {
		data: { event: 'player_at_window', awareness: 'DETECTED', recent: [] },
	});
	expect(response.status()).toBe(401);
});

test('waking needs a session and only works on a sleeping character', async ({ request }) => {
	const response = await request.post('/api/world/wake');
	expect(response.status()).toBe(401);
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
