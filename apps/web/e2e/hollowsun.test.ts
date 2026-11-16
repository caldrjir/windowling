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
	// The skinned knight (asset pipeline) replaces the grey boxes once it has loaded.
	await expect
		.poll(() => run<boolean>(page, 'return HSGame.chars.ready;'), { timeout: 30_000 })
		.toBe(true);

	await page.locator('#b-arena').click();
	await expect(page.locator('#hud')).toBeVisible();
	// Esc pauses; the resume button must resume (its id once clashed with the HUD's Cinders bar)
	await page.keyboard.press('Escape');
	await expect(page.locator('#b-resume')).toBeVisible();
	await page.locator('#b-resume').click();
	await expect.poll(() => run<string>(page, 'return HSGame.mode;')).toBe('play');
	const result = await run<{
		wave: number;
		kills: number;
		hits: number;
		over: boolean;
		mode: string;
	}>(
		page,
		// invulnerable: a new character starts at level 1 and would die before the minute is up
		`HSGame.state.player.invuln = true; const s = HSGame.step(30 * 60, true);
		return { wave: s.wave, kills: s.kills, hits: s.stats.hits, over: s.over, mode: HSGame.mode };`,
	);
	expect(result.hits).toBeGreaterThan(20);
	expect(result.kills).toBeGreaterThan(5);
	// A few rendered frames with the new state (telegraphs, effects, damage numbers).
	await page.waitForTimeout(500);
	// the arena keeps running in real time (burns can still kill), so at least the stepped kills
	const shown = Number((await page.locator('#kills').innerText()).replace(/\D+/g, ''));
	expect(shown).toBeGreaterThanOrEqual(result.kills);
	const chars = await run<{ enemies: number; clip: string }>(page, 'return HSGame.chars;');
	expect(chars.enemies).toBeGreaterThan(0);
	expect(['idle', 'run', 'attack']).toContain(chars.clip);

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
		'AN_hero_attack',
		'AN_hero_death',
		'AN_hero_idle',
		'AN_hero_run',
	]);
	await page.locator('[data-clip="attack"]').click();
	await expect
		.poll(() => run<number>(page, 'return HSGame.assetRootZ();'), {
			timeout: 30_000,
			intervals: [50],
		})
		.toBeGreaterThan(0.3);
	// back to idle once the clip has played; slow software rendering advances it at most 0.1 s per frame
	await expect
		.poll(() => run<string>(page, 'return HSGame.assets.clip;'), { timeout: 30_000 })
		.toBe('idle');

	// Crowd of 50 skinned, animated characters renders and gets measured.
	await page.locator('#b-as-crowd').click();
	await expect
		.poll(() => run<number>(page, 'return (HSGame.assets.crowd || { count: 0 }).count;'), {
			timeout: 30_000,
		})
		.toBe(50);
	expect(errors).toEqual([]);
});

test('HOLLOW SUN: input latency test and combat rating', async ({ page }, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'HOLLOW SUN is a desktop game');
	test.setTimeout(90_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/games/hollowsun/index.html');
	await page.locator('#b-lat').click();
	await expect(page.locator('#hud')).toBeVisible();
	// Clicks on the ground: each one the knight can react to right away becomes a sample.
	for (const [x, y] of [
		[500, 300],
		[800, 500],
		[400, 550],
		[900, 280],
	]) {
		await page.mouse.click(x, y);
		await page.waitForTimeout(400);
	}
	await expect
		.poll(() => run<number>(page, 'return HSGame.latency().n;'), { timeout: 20_000 })
		.toBeGreaterThan(0);

	// Combat rating: four questions 1–5, saved with the game's own save.
	await run(page, 'HSGame.menu();');
	await page.locator('#b-feel').click();
	for (const q of [0, 1, 2, 3]) await page.locator(`[data-q="${q}"][data-v="4"]`).click();
	await page.locator('#b-fsave').click();
	const feel = await run<{ a: number[] }[]>(page, 'return HSGame.feel;');
	expect(feel.at(-1)?.a).toEqual([4, 4, 4, 4]);
	expect(errors).toEqual([]);
});

test('HOLLOW SUN: loot drops, pick-up and the inventory', async ({ page }, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'HOLLOW SUN is a desktop game');
	test.setTimeout(120_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/games/hollowsun/index.html');
	await page.locator('#b-arena').click();
	await expect(page.locator('#hud')).toBeVisible();
	// Fight on autopilot (invulnerable) until something drops; drop labels appear on the ground.
	const fight = await run<{
		drops: number;
		kills: number;
		wave: number;
		over: boolean;
		loot: boolean;
		mode: string;
	}>(
		page,
		`HSGame.state.player.invuln = true;
		for (let i = 0; i < 60 && (!HSGame.state.drops.length || HSGame.char.level < 2); i++) HSGame.step(30 * 10, true);
		const s = HSGame.state;
		return { drops: s.drops.length, kills: s.kills, wave: s.wave, over: s.over, loot: s.loot, mode: HSGame.mode };`,
	);
	expect(fight.drops, JSON.stringify(fight)).toBeGreaterThan(0);
	// A new character starts at level 1 and levels up from kills; the save keeps it (save v3).
	const level = await run<number>(page, 'return HSGame.char.level;');
	expect(level).toBeGreaterThan(1);
	await expect(page.locator('#xpbar')).toBeVisible();
	await expect(page.locator('.drop').first()).toBeVisible();
	// Pick everything up through the simulation's pickup command, then save carries the bag.
	const bag = await run<number>(
		page,
		`for (const d of HSGame.state.drops.slice()) { const p = HSGame.state.player; p.x = d.x; p.z = d.z; HSGame.step(1, false, { pickup: d.id }); }
		return HSGame.gear.inv.length;`,
	);
	expect(bag).toBeGreaterThan(0);
	const saved = await run<{ v: number; gear: { inv: unknown[] }; char: { level: number } }>(
		page,
		`return JSON.parse(localStorage.getItem('hollowsun.save.v1'));`,
	);
	expect(saved.v).toBe(4);
	expect(saved.char.level).toBe(level);
	expect(saved.gear.inv).toHaveLength(bag);

	// The inventory opens with I, shows a tooltip and equips on click.
	await page.keyboard.press('i');
	await expect(page.locator('#inv')).toBeVisible();
	await page.locator('#inv .grid .cell.has').first().hover();
	await expect(page.locator('#tip')).toBeVisible();
	const usable = page.locator('#inv .grid .cell.has:not(.no)');
	if (await usable.count()) {
		const before = await run<number>(page, 'return Object.keys(HSGame.gear.eq).length;');
		await usable.first().click();
		expect(
			await run<number>(page, 'return Object.keys(HSGame.gear.eq).length;'),
		).toBeGreaterThanOrEqual(before);
	}
	await page.keyboard.press('Escape');
	await expect(page.locator('#inv')).toBeHidden();
	expect(await run<string>(page, 'return HSGame.mode;')).toBe('play');
	expect(errors).toEqual([]);
});

test('HOLLOW SUN: the Kiln Warden fight, phases and boss loot', async ({ page }, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'HOLLOW SUN is a desktop game');
	test.setTimeout(120_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/games/hollowsun/index.html');
	await page.locator('button#b-boss').click();
	await expect(page.locator('#bossbar')).toBeVisible();
	// Phase 2 at 60 % HP with 3 s of immunity, then the kill and the guaranteed loot.
	const phase = await run<number>(
		page,
		`const s = HSGame.state; s.player.invuln = true; const b = s.enemies.find((e) => e.id === s.boss.id);
		b.hp = b.hpMax * 0.55; HSGame.step(2, true); return s.boss.phase;`,
	);
	expect(phase).toBe(2);
	const won = await run<{ won: boolean; drops: number }>(
		page,
		`const s = HSGame.state; const b = s.enemies.find((e) => e.id === s.boss.id); s.boss.invuln = 0; b.hp = 1;
		for (let i = 0; i < 30 * 30 && !s.won; i++) { s.player.x = b.x; s.player.z = b.z + 2.6; HSGame.step(1, false, { hold: true, aim: [b.x, b.z] }); }
		return { won: !!s.won, drops: s.drops.length };`,
	);
	expect(won.won).toBe(true);
	expect(won.drops).toBeGreaterThanOrEqual(5);
	await expect(page.locator('.drop').first()).toBeVisible();
	const saved = await run<{ bossKills: number }>(
		page,
		`return JSON.parse(localStorage.getItem('hollowsun.save.v1'));`,
	);
	expect(saved.bossKills).toBe(1);
	expect(errors).toEqual([]);
});

// quest dialogs pause the game: read through them (a choice stays open)
const skipDialogs = (page: Page) =>
	run(
		page,
		'for (let i = 0; i < 40 && HSGame.dialog && !HSGame.dialog.choice; i++) HSGame.dlgNext();',
	);

test('HOLLOW SUN: the Act I campaign – a zone, Cinderhold, dialogs and the Kiln Warden', async ({
	page,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'HOLLOW SUN is a desktop game');
	test.setTimeout(150_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/games/hollowsun/index.html');
	await page.locator('#b-camp').click();
	await expect(page.locator('#minimap')).toBeVisible();
	const zone = await run<{ id: string; objs: { kind: string }[] }>(page, 'return HSGame.zone;');
	expect(zone.id).toBe('a1_ashfields');
	// the Bible's opening scene (q1_01) starts the campaign
	await expect(page.locator('#dialog')).toBeVisible();
	await expect(page.locator('#dialog .who')).toHaveText('Ysolde');
	await skipDialogs(page);
	await expect(page.locator('#dialog')).toBeHidden();
	expect(zone.objs.map((o) => o.kind)).toEqual(expect.arrayContaining(['lantern', 'gate']));
	// Walk the zone's route (enemies removed) to the gate: the area is cleared and the save moves on.
	const done = await run<{ done: boolean; keys: number; next: string | null }>(
		page,
		`const s = HSGame.state; s.enemies.length = 0; s.player.invuln = true; const R = s.zone.route; let i = 0;
		for (let t = 0; t < 30 * 60 * 6 && !s.zoneDone; t++) { const p = s.player; while (i < R.length - 1 && Math.hypot(R[i].x - p.x, R[i].z - p.z) < 1) i++; HSGame.step(1, false, { move: [R[i].x - p.x, R[i].z - p.z] }); }
		const sv = JSON.parse(localStorage.getItem('hollowsun.save.v1'));
		return { done: s.zoneDone, keys: s.zoneKeys.size, next: sv.act1 && sv.act1.zone };`,
	);
	expect(done).toEqual({ done: true, keys: expect.any(Number), next: 'a1_cinderhold' });
	await page.locator('#b-next').click({ timeout: 20_000 });
	await expect
		.poll(() => run<string>(page, 'return HSGame.zone && HSGame.zone.id;'))
		.toBe('a1_cinderhold');
	// Cinderhold: the gate scene, then Teodor must be visited before the gate opens
	await expect(page.locator('#dialog')).toBeVisible();
	await skipDialogs(page);
	await expect(page.locator('#hint')).toContainText('Teodor');
	await run(page, 'const s = HSGame.state; s.player.x = -19; s.player.z = 0; HSGame.step(2);');
	await expect(page.locator('#dialog .who')).toHaveText('Teodor Lisk');
	await skipDialogs(page);
	await expect(page.locator('#hint')).not.toContainText('Teodor');

	// The last step of Act I is the Kiln Warden; beating him completes the act.
	await run(
		page,
		`const sv = JSON.parse(localStorage.getItem('hollowsun.save.v1')); sv.act1 = { zone: 'a1_kiln_heart', done: false, deaths: 0 }; localStorage.setItem('hollowsun.save.v1', JSON.stringify(sv)); HSGame.menu();`,
	);
	await page.reload();
	await page.locator('#b-camp').click();
	await expect(page.locator('#bossbar')).toBeVisible();
	await run(
		page,
		`const s = HSGame.state; const b = s.enemies.find((e) => e.id === s.boss.id); s.player.invuln = true; b.hp = 1;
		for (let i = 0; i < 30 * 30 && !s.won; i++) { s.player.x = b.x; s.player.z = b.z + 2.6; HSGame.step(1, false, { hold: true, aim: [b.x, b.z] }); }`,
	);
	await expect
		.poll(() =>
			run<boolean>(
				page,
				`return !!JSON.parse(localStorage.getItem('hollowsun.save.v1')).act1.done;`,
			),
		)
		.toBe(true);
	// after the fight: Aldric's last words, then the Kiln Shard choice is saved as a flag
	await expect(page.locator('#dialog')).toBeVisible({ timeout: 10_000 });
	await skipDialogs(page);
	await page.locator('#dlg-c0').click();
	await skipDialogs(page);
	await expect
		.poll(() =>
			run<boolean>(
				page,
				`return !!JSON.parse(localStorage.getItem('hollowsun.save.v1')).story.flags.w_kiln_absorbed;`,
			),
		)
		.toBe(true);
	expect(errors).toEqual([]);
});
