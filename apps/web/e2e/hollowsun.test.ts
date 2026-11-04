import { expect, test, type Page } from '@playwright/test';

// HOLLOW SUN (P0 prototype): the PlayCanvas game in a software WebGL renderer (SwiftShader).
// Real-time play is not possible headless, so the test drives the fixed-step simulation through
// the page's own `HSGame` object and checks that the scene renders and saves without errors.
test.use({
	locale: 'cs-CZ',
	launchOptions: {
		channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
		executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
		args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
	},
});

const run = <T>(page: Page, code: string): Promise<T> =>
	page.evaluate(`(() => { ${code} })()`) as Promise<T>;

test('HOLLOW SUN: menu, arena waves, combat events and stats', async ({ page }, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'HOLLOW SUN is a desktop game');
	test.setTimeout(120_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));

	await page.goto('/games/hollowsun/index.html');
	await expect(page.locator('.panel h1')).toHaveText('Hollow Sun', { timeout: 30_000 });
	await expect(page.locator('#b-arena')).toBeVisible();

	await page.locator('#b-arena').click();
	await expect(page.locator('#hud')).toBeVisible();
	const result = await run<{
		wave: number;
		kills: number;
		hits: number;
		over: boolean;
		mode: string;
	}>(
		page,
		`const s = HSGame.step(30 * 60, true);
		return { wave: s.wave, kills: s.kills, hits: s.stats.hits, over: s.over, mode: HSGame.mode };`,
	);
	expect(result.hits).toBeGreaterThan(20);
	expect(result.kills).toBeGreaterThan(5);
	// A few rendered frames with the new state (telegraphs, effects, damage numbers).
	await page.waitForTimeout(500);
	await expect(page.locator('#kills')).toContainText(String(result.kills));

	// Stats for the center are written in the shared format.
	const stats = await run<{ playTime: number; stats: Record<string, number> }>(
		page,
		`return JSON.parse(localStorage.getItem('gamecenter.stats.hollowsun'));`,
	);
	expect(typeof stats.playTime).toBe('number');
	expect(stats.stats).toHaveProperty('bestWave');
	expect(errors).toEqual([]);
});

test('HOLLOW SUN: the asset pipeline test loads both GLB assets', async ({ page }, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'HOLLOW SUN is a desktop game');
	test.setTimeout(90_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/games/hollowsun/index.html');
	await page.locator('#b-assets').click();
	await expect(page.locator('#assetPanel')).toBeVisible();
	await expect
		.poll(() => run<number>(page, 'return (HSGame.assets && HSGame.assets.loaded) || 0;'), {
			timeout: 60_000,
		})
		.toBe(2);
	const assets = await run<{ error: string | null; items: { id: string; ok: boolean }[] }>(
		page,
		'return HSGame.assets;',
	);
	expect(assets.error).toBeNull();
	expect(assets.items.map((i) => i.id)).toEqual(['DM_crypt_rS_X_a', 'CH_ak_body']);

	// Skinned character: the four clips play, the attack carries root motion forward (+Z).
	const clips = await run<string[]>(page, 'return HSGame.assets.clips;');
	expect([...clips].sort()).toEqual([
		'AN_human_attack',
		'AN_human_death',
		'AN_human_idle',
		'AN_human_run',
	]);
	await page.locator('[data-clip="attack"]').click();
	await expect
		.poll(
			() =>
				run<number>(
					page,
					"return pc.Application.getApplication().root.findByName('root').getPosition().z;",
				),
			{ timeout: 10_000, intervals: [50] },
		)
		.toBeGreaterThan(0.3);
	await expect.poll(() => run<string>(page, 'return HSGame.assets.clip;')).toBe('idle');

	// Crowd of 50 skinned, animated characters renders and gets measured.
	await page.locator('#b-as-crowd').click();
	await expect
		.poll(() => run<number>(page, 'return (HSGame.assets.crowd || { count: 0 }).count;'), {
			timeout: 30_000,
		})
		.toBe(50);
	expect(errors).toEqual([]);
});
