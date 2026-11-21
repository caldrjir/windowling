import { expect, test } from '@playwright/test';
import { GAMES } from '../src/lib/games/registry';
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
	// The three big games on top, no empty slots.
	await expect(page.getByTestId('shelf').locator('.gcard')).toHaveCount(3);
	// The rest of the library, sorted into genre shelves.
	const library = page.getByTestId('library');
	await expect(library.locator('.gcard')).toHaveCount(
		GAMES.filter((g) => g.group === 'puzzle').length,
	);
	await expect(page.getByTestId('shelf-logic')).toContainText('SUDOKU');
	await expect(page.getByTestId('shelf-board')).toContainText('ŠACHY');
	// How many people use the site.
	await expect(page.getByTestId('online')).toHaveText(/^\d+$/);
	expect(errors).toEqual([]);
});

test('switches language and keeps it for the games', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'EN', exact: true }).click();
	await expect(page.locator('.lib-head h2').first()).toHaveText('Featured games');
	await expect(page.getByTestId('play')).toContainText('PLAY');
	expect(await page.evaluate(() => localStorage.getItem('gamecenter.lang'))).toBe('en');
	await page.reload();
	await expect(page.locator('.lib-head h2').first()).toHaveText('Featured games');
	await page.getByRole('button', { name: 'CS', exact: true }).click();
	await expect(page.locator('.lib-head h2').first()).toHaveText('Hlavní hry');
});

test('launches VOIDBORN and comes back to the center', { tag: '@voidborn' }, async ({ page }) => {
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
	test(
		`right-click in ${game} does not open the browser menu`,
		{ tag: `@${game}` },
		async ({ page }) => {
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
		},
	);
}

test(
	'launches STARSPIRE from the center and plays a card',
	{ tag: '@starspire' },
	async ({ page, isMobile }) => {
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
	},
);

test(
	'STARSPIRE: Star Atlas, the Act IV summit and the Endless Spire',
	{ tag: '@starspire' },
	async ({ page, isMobile }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		const tap = (selector: string) =>
			isMobile
				? page.locator(selector).first().tap({ force: true })
				: page.locator(selector).first().click({ force: true });
		await page.goto('/games/starspire/index.html');
		await page.evaluate('SAVE.dust = 100; persist()');
		await page.locator('#s-title').click();

		// Stardust buys permanent upgrades.
		await tap('[data-go="atlas"]');
		await tap('[data-perk="vit"]');
		await expect(page.locator('.dust-bank b')).toHaveText('60');
		await tap('[data-go="menu"]');
		await tap('[data-go="heroes"]');
		await tap('[data-act="startRun"]');
		expect(await page.evaluate('R.maxHp')).toBe(85);

		// Straight to the boss of the fourth act.
		await page.evaluate(
			'R.act = 3; R.map = Run.genMap(3); R.row = 11; R.col = 0; Run.save(); UI.go("menu")',
		);
		await tap('[data-act="continue"]');
		await expect(page.locator('.map-head p')).toContainText('4 / 4');
		await tap('.node.boss');
		await expect(page.locator('.enemy')).toHaveCount(1);
		await page.evaluate(
			'B.enemies[0].block = 0; Battle.hitEnemy(B.enemies[0], 99999); Battle.finish()',
		);
		await tap('[data-act="rwDone"]');
		if (await page.locator('[data-act="skipBossRelic"]').count())
			await tap('[data-act="skipBossRelic"]');

		// The summit counts as a victory; the climb goes on into the Endless Spire.
		await expect(page.locator('.summit')).toBeVisible();
		expect(await page.evaluate('SAVE.stats.victories')).toBe(1);
		await tap('[data-act="summitGo"]');
		await tap('[data-omen]');
		expect(await page.evaluate('[R.loop, R.act, R.omens.length]')).toEqual([1, 0, 1]);
		await expect(page.locator('.tb-floor')).toContainText('52');

		await tap('[data-act="pause"]');
		await tap('[data-act="abandon"]');
		await expect(page.locator('.dust-gain')).toContainText('+');
		expect(await page.evaluate('SAVE.dust')).toBeGreaterThan(60);
		expect(errors).toEqual([]);
	},
);

test(
	'STARSPIRE Saga: one deck through the levels, retry after a fall',
	{ tag: '@starspire' },
	async ({ page, isMobile }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		const tap = (selector: string) =>
			isMobile
				? page.locator(selector).first().tap({ force: true })
				: page.locator(selector).first().click({ force: true });
		await page.goto('/games/starspire/index.html');
		await page.locator('#s-title').click();
		await tap('[data-go="heroes"]');
		await tap('[data-mode="saga"]');
		await tap('[data-act="startRun"]');
		await expect(page.locator('.map-head p')).toContainText('1');

		// Win the level with a bigger deck: the next level keeps it, on Eclipse 1.
		await page.evaluate(
			'Run.addCard("bash", true); Run.checkpoint(); R.act = 3; R.map = Run.genMap(3); R.row = 11; R.col = 0; Run.save(); UI.go("menu")',
		);
		await tap('[data-act="continueSaga"]');
		await tap('.node.boss');
		await expect(page.locator('.enemy')).toHaveCount(1);
		await page.evaluate(
			'B.enemies[0].block = 0; Battle.hitEnemy(B.enemies[0], 99999); Battle.finish()',
		);
		await tap('[data-act="rwDone"]');
		if (await page.locator('[data-act="skipBossRelic"]').count())
			await tap('[data-act="skipBossRelic"]');
		await tap('[data-act="sagaGo"]');
		expect(await page.evaluate('[R.level, R.eclipse, R.act, R.deck.length]')).toEqual([
			1, 1, 0, 11,
		]);

		// A fall is not the end: the level starts again with the same deck.
		await tap('.node.avail');
		await expect(page.locator('.enemy').first()).toBeVisible();
		await page.evaluate('Battle.hurtPlayer(9999, false); Battle.finish()');
		await tap('[data-act="sagaRetry"]');
		expect(await page.evaluate('[R.level, R.hp === R.maxHp, R.deck.length]')).toEqual([
			1,
			true,
			11,
		]);
		expect(errors).toEqual([]);
	},
);

test('background music: a default playlist per game, your own playlist, or none', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/games/sudoku/index.html');
	// The generated default playlist starts with the first touch of the page.
	await page.locator('#kMusic').click();
	await expect(page.getByTestId('music-settings')).toBeVisible();
	await expect
		.poll(() => page.evaluate('window.GCGen ? [GCGen.playing, GCGen.tracks.length] : []'))
		.toEqual([true, 4]);
	expect(await page.evaluate('GCMusic.gameMusic')).toBe(true);

	// Your own playlist: an unknown link is refused, a YouTube link is kept.
	await page.locator('[data-src="own"]').click();
	const link = page.locator('.gcm-own input[type=url]');
	await link.fill('https://example.com/song');
	await expect(page.locator('.gcm-hint')).toHaveClass(/bad/);
	await link.fill('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG');
	await expect(page.locator('.gcm-svc i.on')).toHaveText('YouTube');
	await page.locator('[data-a="save"]').click();
	await expect(page.getByTestId('music')).toBeVisible();
	expect(await page.evaluate('[GCGen.playing, GCMusic.gameMusic]')).toEqual([false, false]);

	// The setting follows to the other games: the action games keep only their sounds.
	await page.goto('/games/voidborn/index.html');
	await expect(page.getByTestId('music')).toBeVisible();
	expect(await page.evaluate('[GCMusic.gameMusic, GCMusic.level]')).toEqual([false, 1]);

	// No music at all, set from the hub.
	await page.goto('/');
	await page.getByTestId('music-btn').click();
	await page.locator('[data-src="off"]').click();
	await page.locator('[data-a="save"]').click();
	await expect(page.getByTestId('music')).toHaveCount(0);
	expect(
		await page.evaluate(
			() => JSON.parse(localStorage.getItem('gamecenter.music') ?? '{}') as object,
		),
	).toMatchObject({ src: 'off' });
	expect(errors).toEqual([]);
});

test(
	'VOIDBORN can be played by touch',
	{ tag: '@voidborn' },
	async ({ page, context, isMobile }) => {
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
	},
);

test(
	'VOIDBORN on a phone: Back steps back, safe areas, sticky buttons, quiet toasts and haptics',
	{ tag: '@voidborn' },
	async ({ page, request, isMobile }) => {
		test.skip(!isMobile, 'phone behaviour');
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.addInitScript(() => {
			const w = window as unknown as { vib: unknown[] };
			w.vib = [];
			navigator.vibrate = (p: VibratePattern) => {
				w.vib.push(p);
				return true;
			};
		});
		await page.goto('/games/voidborn/index.html');
		await expect(page.locator('#s-title .press')).toHaveText('Klepni kamkoli');
		// The tap that leaves the title does not also press the menu button under the finger.
		const hub = await page.evaluate<number[]>(`(() => { UI.show('menu');
			const r = document.querySelector('[data-go="hub"]').getBoundingClientRect();
			UI.show('title'); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
		await page.touchscreen.tap(hub[0], hub[1]);
		await expect.poll(() => page.evaluate('UI.current')).toBe('menu');
		expect(page.url()).toContain('/games/voidborn/');
		// Nothing is wider than the phone; the hangar's Launch bar stays on screen while scrolling.
		const wide = `[...document.querySelectorAll('.screen.active, .screen.active *')].some(e => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.ship-view'))`;
		expect(await page.evaluate(wide)).toBe(false);
		await page.locator('[data-go="hangar"]').tap();
		await expect(page.locator('#startBtn')).toBeInViewport();
		expect(await page.evaluate(wide)).toBe(false);
		// Android Back (or the browser's back) returns to the menu instead of leaving the game.
		await page.goBack();
		await expect.poll(() => page.evaluate('UI.current')).toBe('menu');
		expect(page.url()).toContain('/games/voidborn/');

		await page.locator('[data-go="hangar"]').tap();
		await page.locator('#startBtn').tap();
		await expect(page.locator('#dashBtn')).toBeVisible();
		// Toasts go to the top, away from the dash button and the thumbs.
		await page.evaluate(`UI.toast('Test', 'jen nadpis')`);
		const toast = await page.locator('#toasts .toast').last().boundingBox();
		const dash = await page.locator('#dashBtn').boundingBox();
		const vh = page.viewportSize()?.height ?? 0;
		expect(
			toast && dash && toast.y + toast.height < vh / 2 && toast.y + toast.height < dash.y,
		).toBe(true);
		// The dash button shows its recharge; hits buzz the phone (and stop when switched off).
		const ring = await page.evaluate<
			string[]
		>(`(() => { G.p.dashCharges = 0; G.p.dashRe = G.st.dashCd / 2;
			UI.hudUpdate(60, true); const b = document.getElementById('dashBtn');
			return [b.className, b.style.getPropertyValue('--re')]; })()`);
		expect(ring).toEqual(['empty', '0.50']);
		await page.evaluate(`G.p.inv = 0; hurtPlayer(1)`);
		expect(await page.evaluate('vib.length')).toBeGreaterThan(0);
		// Display cutouts (simulated in Debug): the HUD moves out of the notch.
		await page.evaluate(`SAVE.settings.dbgNotch = true; Platform.apply()`);
		expect(await page.evaluate('Platform.insets.t')).toBe(47);
		await expect
			.poll(() =>
				page.evaluate(`document.querySelector('.hud-center').getBoundingClientRect().top`),
			)
			.toBeGreaterThanOrEqual(47);
		// Back during a run pauses it, Back on the pause screen resumes.
		await page.goBack();
		await expect.poll(() => page.evaluate('G.state')).toBe('paused');
		await expect(page.locator('#overlay .ov-actions')).toBeInViewport();
		await page.goBack();
		await expect.poll(() => page.evaluate('G.state')).toBe('play');
		expect(page.url()).toContain('/games/voidborn/');
		// The game can be installed (PWA, a store wrapper): manifest and icons.
		const manifest = await (await request.get('/games/voidborn/manifest.webmanifest')).json();
		expect(manifest).toMatchObject({ name: 'VOIDBORN', display: 'fullscreen' });
		for (const icon of manifest.icons as { src: string }[])
			expect((await request.get(`/games/voidborn/${icon.src}`)).status()).toBe(200);
		expect(errors).toEqual([]);
	},
);

test(
	'VOIDBORN: advanced weapons, overcharge, mutations and the Master Workshop',
	{ tag: '@voidborn' },
	async ({ page, isMobile }) => {
		test.skip(isMobile, 'one run is enough for the game logic');
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		// A veteran: Sector II cleared, the achievements that unlock the advanced weapons and passives.
		await page.addInitScript(() => {
			localStorage.setItem(
				'voidborn.save.v1',
				JSON.stringify({
					shards: 20000,
					forge: { revival: 1 },
					achievements: { clear1: 1, clear2: 1, evo1: 1, evo4: 1, boss1: 1 },
					sectors: {
						s1: { cleared: true, odUnlocked: 1, best: 900 },
						s2: { cleared: true, odUnlocked: 1, best: 900 },
					},
				}),
			);
		});
		await page.goto('/games/voidborn/index.html');
		await page.mouse.click(100, 100);
		await page.locator('[data-go="forge"]').click();
		// The Forge is a ship: the cockpit holds the Master Workshop's extra card (open after Sector II).
		await page.locator('[data-part="cockpit"]').click();
		await expect(page.locator('#fc-cards')).not.toHaveClass(/locked/);
		await page.locator('[data-buy="cards"]').click();
		expect(await page.evaluate('SAVE.forge.cards')).toBe(1);
		await page.locator('.back').click();
		await page.locator('[data-go="hangar"]').click();
		await page.locator('#startBtn').click();
		// The revive left is visible in the run.
		await expect(page.locator('#hudChips .hc.rv')).toContainText('1');

		// The game's state is top-level `const`/functions of the page (not on window).
		const run = (await page.evaluate(`(() => {
		G.weapons = [];
		addWeapon('disc', 8); addWeapon('plasma', 8); addWeapon('meteor', 8);
		for (const id of ['luck', 'speed', 'critamp']) applyChoice({ kind: 'passive', id });
		const evos = upgradePool().filter(c => c.kind === 'evo');
		for (const c of evos) applyChoice(c);
		applyChoice({ kind: 'oc', id: 'quantum', lvl: 1 });
		for (let i = 0; i < 40; i++) spawnEnemyAt('drone', G.p.x + 150 + i * 4, G.p.y + (i % 8) * 30 - 120);
		return {
			evos: evos.map(c => c.id).sort(),
			weapons: G.weapons.map(w => w.id + ':' + (w.oc || 0)),
			cards: genChoices().length,
			armor10: Math.round(armorFactor(10) * 1000),
			stabilizer: calcStats(PILOTS[0], { duration: 4 }, {}, {}).projSpd,
		};
	})()`)) as Record<string, unknown>;
		expect(run).toMatchObject({
			evos: ['comet', 'quantum', 'starfall'],
			weapons: ['quantum:1', 'comet:0', 'starfall:0'],
			armor10: 484,
			stabilizer: 1.2,
		});
		expect(run.cards).toBeGreaterThanOrEqual(4);
		await page.waitForTimeout(1500);
		// Nothing left to upgrade: level-ups offer mutations, which raise the stats without a limit.
		const mut = (await page.evaluate(`(() => {
		G.weapons.forEach(w => { w.oc = OC_MAX; });
		for (const id in G.passives) G.passives[id] = PASSIVES[id].max;
		computeStats();
		G.st.wSlots = G.weapons.length; G.st.pSlots = Object.keys(G.passives).length;
		const kinds = genChoices().map(c => c.kind);
		const before = G.st.might;
		applyChoice({ kind: 'mut', id: 'might', lvl: 1 });
		return { kinds, gain: Math.round((G.st.might - before) * 100) };
	})()`)) as { kinds: string[]; gain: number };
		expect(mut.kinds).toContain('mut');
		expect(mut.gain).toBe(4);
		expect(errors).toEqual([]);
	},
);

test(
	'VOIDBORN: merged pickups, auto-pick by priority, the Void Workshop and the anomaly sectors',
	{ tag: '@voidborn' },
	async ({ page, isMobile }) => {
		test.skip(isMobile, 'one run is enough for the game logic');
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		// All five main sectors cleared: the Void Workshop and the four anomaly sectors are open.
		await page.addInitScript(() => {
			if (sessionStorage.getItem('seeded')) return;
			sessionStorage.setItem('seeded', '1');
			const sectors: Record<string, object> = {};
			for (const id of ['s1', 's2', 's3', 's4', 's5'])
				sectors[id] = { cleared: true, odUnlocked: 1, best: 900 };
			localStorage.setItem(
				'voidborn.save.v1',
				JSON.stringify({ shards: 50000, achievements: { clear1: 1, clear2: 1 }, sectors }),
			);
		});
		await page.goto('/games/voidborn/index.html');
		await page.mouse.click(100, 100);
		await page.locator('[data-go="hangar"]').click();
		await expect(page.locator('.sectors.anom .sector')).toHaveCount(4);
		await expect(page.locator('.sectors.anom .sector.locked')).toHaveCount(0);
		await page.locator('.screen.active .back').click();

		await page.locator('[data-go="forge"]').click();
		await page.locator('[data-part="cockpit"]').click();
		await expect(page.locator('#fc-deepmut')).not.toHaveClass(/locked/); // the Void Workshop is open
		await page.locator('[data-buy="deepmut"]').click();
		expect(await page.evaluate('SAVE.forge.deepmut')).toBe(1);
		await page.locator('.screen.active .back').click();

		// Auto-pick on, the first weapon moved one place up in the priorities.
		await page.locator('[data-go="settings"]').click();
		await page.locator('[data-tog="autoPick"]').click();
		await page.locator('[data-go="prio"]').click();
		const sixth = await page.evaluate<string>('SAVE.settings.prio?.[5] ?? PRIO_DEFAULT[5]');
		await page.locator('[data-prio="up:5"]').click();
		expect(await page.evaluate('[SAVE.settings.autoPick, SAVE.settings.prio[4]]')).toEqual([
			true,
			sixth,
		]);
		// Entries can be dragged too: the first one dropped below the third.
		const first = await page.evaluate<string>('SAVE.settings.prio[0]');
		const from = await page.locator('#prioList > li').nth(0).boundingBox();
		const to = await page.locator('#prioList > li').nth(2).boundingBox();
		if (!from || !to) throw new Error('no priority entries');
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		await page.mouse.move(to.x + to.width / 2, to.y + to.height * 0.8, { steps: 10 });
		await page.mouse.up();
		expect(await page.evaluate(`SAVE.settings.prio.indexOf(${JSON.stringify(first)})`)).toBe(2);
		await expect(page.locator('#prioList > li').nth(2)).toHaveAttribute('data-k', first);

		// The game's state is top-level `const`/functions of the page (not on window).
		const run = (await page.evaluate(`(() => {
		UI.hideOverlay(); Game.start('vex', 0, 0);
		G.pickups.length = 0;
		for (let i = 0; i < 40; i++) { const g = mkPickup('gem', 400 + (i % 5) * 8, 300 + Math.floor(i / 5) * 8, 1); g.age = 1; G.pickups.push(g); }
		for (let i = 0; i < 12; i++) { const g = mkPickup('shard', -400 + i * 5, 300, 2); g.age = 1; G.pickups.push(g); }
		const sum = G.pickups.reduce((a, p) => a + p.val, 0);
		mergePickups(); G.pickups = G.pickups.filter(p => !p.dead);
		const merged = { count: G.pickups.length, sum: G.pickups.reduce((a, p) => a + p.val, 0) };
		G.pendingLevels = 5; updateGame(0.016);
		const auto = { state: G.state, level: G.level };
		G.weapons[0].level = 8; G.passives = {}; computeStats();
		const evo = upgradePool().filter(c => c.kind === 'evo').map(c => c.id);
		return { sum, merged, auto, evo, start: G.startWeapon, mutMax: G.st.mutMax };
	})()`)) as {
			sum: number;
			merged: { count: number; sum: number };
			auto: { state: string; level: number };
			evo: string[];
			start: string;
			mutMax: number;
		};
		// Pickups close together merge into fewer ones of the same total value.
		expect(run.merged.sum).toBe(run.sum);
		expect(run.merged.count).toBeLessThan(10);
		// Five level-ups at once are picked without stopping the run.
		expect(run.auto.state).toBe('play');
		// The pilot's starting weapon evolves even without its catalyst passive.
		expect(run.start).toBe('pulse');
		expect(run.evo).toEqual(['hyperpulse']);
		expect(run.mutMax).toBeGreaterThan(10);

		// Each anomaly sector runs with its own rule.
		for (const [index, check] of [
			[5, 'G.sector.meteors && G.meteors.length > 0'],
			[
				6,
				`Object.keys(currentPool()).join() === G.monoType && G.enemies.some(e => e.type === G.monoType)`,
			],
			[7, 'G.sector.well && !!G.well'],
			[8, 'G.sector.dark && G.time > 1'],
		] as const) {
			await page.evaluate(`UI.hideOverlay(); Game.start('vex', ${index}, 0); G.nextMeteor = 0;`);
			await expect
				.poll(() => page.evaluate(`!!(${check}) && G.state === 'play'`), {
					message: `sector ${index + 1}`,
				})
				.toBe(true);
		}
		expect(errors).toEqual([]);
	},
);

test(
	'VOIDBORN end game: the Eternal Workshop, Masterpieces, new weapons and the deep sectors',
	{ tag: '@voidborn' },
	async ({ page, isMobile }) => {
		test.skip(isMobile, 'one run is enough for the game logic');
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		// Sectors I–IX cleared and plenty of shards.
		await page.addInitScript(() => {
			if (sessionStorage.getItem('seeded')) return;
			sessionStorage.setItem('seeded', '1');
			const sectors: Record<string, object> = {};
			for (let i = 1; i <= 9; i++) sectors[`s${i}`] = { cleared: true, odUnlocked: 1, best: 900 };
			localStorage.setItem(
				'voidborn.save.v1',
				JSON.stringify({ shards: 500000, achievements: { clear1: 1 }, sectors }),
			);
		});
		await page.goto('/games/voidborn/index.html');
		await page.mouse.click(100, 100);
		await page.locator('[data-go="forge"]').click();
		await page.locator('[data-part="guns"]').click();
		await expect(page.locator('#fc-e_might')).not.toHaveClass(/locked/);
		// An Eternal Workshop upgrade has no cap and every level costs more.
		await page.locator('[data-buy="e_might"]').click();
		await page.locator('[data-buy="e_might"]').click();
		await expect(page.locator('#fc-e_might .lvl-inf')).toContainText('2');
		expect(
			await page.evaluate(
				`[SAVE.forge.e_might, forgeCost(FORGE.find(f => f.id === 'e_might'), 2)]`,
			),
		).toEqual([2, 9400]);
		// Masterpieces: blueprints and Voidborn in the weapon bay, Echo in the cockpit.
		await page.locator('[data-part="bay"]').click();
		await expect(page.locator('#fc-bp_sentry')).not.toHaveClass(/locked/);
		for (const id of ['bp_sentry', 'bp_voidray', 'bp_cluster', 'voidborn'])
			await page.locator(`[data-buy="${id}"]`).click();
		await page.locator('[data-part="cockpit"]').click();
		await page.locator('[data-buy="echo"]').click();
		expect(await page.evaluate('unlocked(WEAPONS.sentry) && unlocked(WEAPONS.cluster)')).toBe(true);
		await page.locator('.screen.active .back').click();

		// The deep sectors open one after another from Sector IX.
		await page.locator('[data-go="hangar"]').click();
		await expect(page.locator('.sectors.deep .sector')).toHaveCount(3);
		await expect(page.locator('.sectors.deep .sector.locked')).toHaveCount(2);
		await page.locator('.screen.active .back').click();

		// The game's state is top-level `const`/functions of the page (not on window).
		const run = (await page.evaluate(`(() => {
		UI.hideOverlay(); Game.start('vex', 0, 0);
		const start = G.weapons.map(w => w.id), might = G.st.might;
		// a crystal that drops next to one already lying there joins it
		G.pickups.length = 0; mergePickups();
		for (let i = 0; i < 20; i++) dropGem(G.p.x + 300, G.p.y + 100, 1);
		const gems = G.pickups.filter(p => p.kind === 'gem');
		const drop = { count: gems.length, sum: gems.reduce((a, p) => a + p.val, 0) };
		// Echo (forced on): a level-up also applies the best of the remaining cards
		const offer = genChoices(), first = autoPickBest(offer);
		applyChoice(first); G.st.echo = 1;
		const echo = echoPick(offer, first);
		const echoed = !!echo && echo.echo && echo !== first && offer.some(c => c.kind === echo.kind && c.id === echo.id);
		G.weapons = []; for (const id of ['sentry', 'voidray', 'cluster']) addWeapon(id, 8);
		for (let i = 0; i < 50; i++) spawnEnemyAt('brute', G.p.x + 120 + (i % 10) * 30, G.p.y - 120 + Math.floor(i / 10) * 50);
		G.dmgBy = {};
		return { start, might, drop, echoed };
	})()`)) as {
			start: string[];
			might: number;
			drop: { count: number; sum: number };
			echoed: boolean;
		};
		// Voidborn: the starting weapon begins evolved; Eternal Might adds 5 % per level.
		expect(run.start).toEqual(['hyperpulse']);
		expect(run.might).toBeCloseTo(1.1);
		expect(run.drop).toEqual({ count: 1, sum: 20 });
		expect(run.echoed).toBe(true);
		// All three new weapons deal damage.
		await expect
			.poll(() =>
				page.evaluate(`['sentry', 'voidray', 'cluster'].every(id => (G.dmgBy[id] || 0) > 0)`),
			)
			.toBe(true);

		// Each deep sector runs with its own rule.
		for (const [index, check] of [
			[9, 'G.sector.rush && G.nextBossT === 150'],
			[10, `!!G.zone && (G.p.x = G.zone.x + G.zone.r + 400, G.p.hp < G.st.maxHp)`],
			[11, 'G.sector.meteors && G.sector.dark && !!G.well'],
		] as const) {
			await page.evaluate(`UI.hideOverlay(); Game.start('vex', ${index}, 0);`);
			await expect
				.poll(() => page.evaluate(`!!(${check}) && G.state === 'play'`), {
					message: `sector ${index + 1}`,
				})
				.toBe(true);
		}
		expect(errors).toEqual([]);
	},
);

test(
	'VOIDBORN Forge: a 3D ship by parts, the loadout in the hangar and chests without a window',
	{ tag: '@voidborn' },
	async ({ page, isMobile }) => {
		test.skip(isMobile, 'the touch test plays on the phone');
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		// An older save: Fan of Cards and Eternal Phoenix (since merged), Sectors I–V cleared.
		await page.addInitScript(() => {
			if (sessionStorage.getItem('seeded')) return;
			sessionStorage.setItem('seeded', '1');
			const sectors: Record<string, object> = {};
			for (let i = 1; i <= 5; i++) sectors[`s${i}`] = { cleared: true, odUnlocked: 1, best: 900 };
			localStorage.setItem(
				'voidborn.save.v1',
				JSON.stringify({
					shards: 100000,
					forge: { cards: 1, fan: 1, revival: 2, phoenix: 1, might: 2, gone: 3 },
					achievements: { clear1: 1, clear2: 1, evo1: 1, evo4: 1, boss1: 1 },
					sectors,
				}),
			);
		});
		await page.goto('/games/voidborn/index.html');
		await page.mouse.click(100, 100);
		// Merged upgrades carry over, removed ones are gone.
		expect(await page.evaluate('JSON.stringify(SAVE.forge)')).toBe(
			JSON.stringify({ cards: 2, revival: 3, might: 2 }),
		);
		await page.locator('[data-go="forge"]').click();
		const cv = page.locator('#forgeCv');
		await expect(cv).toBeVisible();
		await expect(page.locator('.fpart')).toHaveCount(7);
		// A part chip turns the camera to the part and lists its upgrades.
		await page.locator('[data-part="engines"]').click();
		await expect(page.locator('.fpanel h3')).toHaveText('Motory');
		await expect(page.locator('#fc-e_thrust')).toBeVisible();
		await page.waitForTimeout(800);
		// Tapping the model picks the part under the pointer.
		const box = await cv.boundingBox();
		if (!box) throw new Error('no forge canvas');
		const at = (await page.evaluate('Forge3D.screenOf("wings")')) as { x: number; y: number };
		const under = await page.evaluate(`Forge3D.pickAt(${at.x}, ${at.y})`);
		await page.mouse.click(box.x + at.x, box.y + at.y);
		expect(await page.evaluate('Forge3D.selected')).toBe(under);
		await expect(page.locator('.fpart.sel')).toHaveAttribute('data-part', String(under));
		// Dragging rotates the ship.
		const yaw = (await page.evaluate('Forge3D.view[0]')) as number;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 30, { steps: 8 });
		await page.mouse.up();
		// The nearer side follows the pointer (dragging right turns yaw up) and the turn coasts out after release.
		expect(((await page.evaluate('Forge3D.view[0]')) as number) - yaw).toBeGreaterThan(1);
		// Under the model: the ship's stats at the start of a run and what the Forge adds.
		await expect(page.locator('#fstats [data-stat="might"]')).toContainText('110 %');
		await expect(page.locator('#fstats [data-stat="might"] em')).toHaveText('+10 %');

		// The weapon bay: an Arms Plan (two strikes) and a hardpoint; Calibration raises its level.
		await page.locator('[data-part="bay"]').click();
		for (const id of ['bans', 'bans', 'hard', 'prelvl'])
			await page.locator(`[data-buy="${id}"]`).click();
		expect(await page.evaluate('[SAVE.forge.bans, SAVE.forge.hard, SAVE.forge.prelvl]')).toEqual([
			2, 1, 1,
		]);
		await expect(page.locator('.fp-note')).toContainText('Na palubě 0/1');
		// The loadout is set in the hangar: Bouncing Disc on board, Shockwave and Void Mines struck out.
		await page.locator('.fp-note [data-go="hangar"]').click();
		await expect(page.locator('.loadout')).toBeVisible();
		await page.locator('[data-lw="disc"]').click();
		await page.locator('[data-lmode="ban"]').click();
		await page.locator('[data-lw="nova"]').click();
		await page.locator('[data-lw="mines"]').click();
		await page.locator('[data-lw="arc"]').click(); // only two strikes bought
		expect(await page.evaluate('JSON.stringify(SAVE.loadout)')).toBe(
			JSON.stringify({ pre: ['disc'], ban: ['nova', 'mines'] }),
		);
		await expect(page.locator('[data-lw="pulse"]')).toBeDisabled(); // the pilot's own weapon
		await page.locator('#startBtn').click();
		const run = (await page.evaluate(`(() => ({
		weapons: G.weapons.map(w => w.id + ':' + w.level),
		offered: upgradePool().filter(c => c.kind === 'weapon' && c.isNew).map(c => c.id),
	}))()`)) as { weapons: string[]; offered: string[] };
		expect(run.weapons).toEqual(['pulse:1', 'disc:2']);
		expect(run.offered).not.toContain('nova');
		expect(run.offered).not.toContain('mines');
		expect(run.offered).toContain('arc');

		// Chests without a window: the run goes on and the contents are applied.
		const before = (await page.evaluate('G.shards')) as number;
		await page.evaluate('SAVE.settings.autoChest = true; openChest(true);');
		expect(await page.evaluate('G.state')).toBe('play');
		await expect(page.locator('#overlay')).toBeHidden();
		expect((await page.evaluate('G.shards')) as number).toBeGreaterThan(before);
		// … and the switch is in the pause menu too.
		await page.evaluate('Game.togglePause()');
		await page.locator('[data-act="autochest"]').click();
		expect(await page.evaluate('SAVE.settings.autoChest')).toBe(false);
		await page.evaluate('Game.togglePause(); openChest(false);');
		expect(await page.evaluate('G.state')).toBe('chest');
		await page.locator('#overlay [data-act="ok"]').click();
		expect(await page.evaluate('G.state')).toBe('play');
		expect(errors).toEqual([]);
	},
);

test(
	'VOIDBORN performance log is off by default and downloads after a run',
	{ tag: '@voidborn' },
	async ({ page, isMobile }) => {
		test.skip(isMobile, 'one run is enough for the game logic');
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		// The log lives in the Debug section of Settings (?debug=1 keeps it on after a release).
		await page.goto('/games/voidborn/index.html?debug=1');
		await page.mouse.click(100, 100);
		// Off by default: a run records nothing and the end screen offers no log.
		// The game's state is top-level `const`/functions of the page (not on window).
		expect(
			await page.evaluate(
				`(() => { Game.start('vex', 0, 0); const on = PerfLog.on; endRun('quit'); return [SAVE.settings.perfLog, on]; })()`,
			),
		).toEqual([false, false]);
		await expect(page.locator('.perf-dl')).toHaveCount(0);
		await page.evaluate(`Game.toMenu('menu')`);

		await page.locator('[data-go="settings"]').click();
		await page.locator('[data-tog="perfLog"]').click();
		expect(await page.evaluate('SAVE.settings.perfLog')).toBe(true);
		await page.locator('.screen.active .back').click();
		await page.locator('[data-go="hangar"]').click();
		await page.locator('#startBtn').click();
		await expect(page.locator('#hudChips .hc.rec')).toBeVisible();
		// At least two one-second rows.
		await expect.poll(() => page.evaluate('PerfLog.on && G.time > 2.5')).toBe(true);
		await page.evaluate(`endRun('quit')`);
		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.locator('.perf-dl [data-act="perflog"]').click(),
		]);
		expect(download.suggestedFilename()).toMatch(/^voidborn-log-\d{8}-\d{6}\.json$/);
		const log = (await page.evaluate(`(() => {
		const l = JSON.parse(PerfLog.lastLog().json);
		return { cols: l.columns.length, rows: l.rows.length, width: l.rows[0].length, frames: l.summary.frames,
			reason: l.result.reason, events: l.events.map(e => e[2]), stored: !!localStorage.getItem('voidborn.perflog') };
	})()`)) as {
			cols: number;
			rows: number;
			width: number;
			frames: number;
			reason: string;
			events: string[];
			stored: boolean;
		};
		expect(log.rows).toBeGreaterThanOrEqual(2);
		expect(log.width).toBe(log.cols);
		expect(log.frames).toBeGreaterThan(30);
		expect(log.reason).toBe('quit');
		expect(log.events).toEqual(expect.arrayContaining(['start', 'end']));
		expect(log.stored).toBe(true);
		expect(errors).toEqual([]);
	},
);

test(
	'VOIDBORN 1.4: new kinds of enemies, the bestiary and achievements that pay',
	{ tag: '@voidborn' },
	async ({ page, isMobile }) => {
		test.skip(isMobile, 'one run is enough for the game logic');
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		// A save from before 1.4: Sector I cleared (old reward 100) and 5 minutes survived (old 30).
		await page.addInitScript(() => {
			if (sessionStorage.getItem('seeded')) return;
			sessionStorage.setItem('seeded', '1');
			localStorage.setItem(
				'voidborn.save.v1',
				JSON.stringify({
					shards: 0,
					achievements: { clear1: 1, t5: 1 },
					sectors: { s1: { cleared: true, odUnlocked: 1, best: 900 } },
				}),
			);
		});
		await page.goto('/games/voidborn/index.html');
		await page.mouse.click(100, 100);
		// Earned achievements are topped up to the new rewards once (1500 − 100 + 300 − 30) and
		// add their permanent bonuses (+3 % shards, +5 health) to every run.
		expect(await page.evaluate('[SAVE.shards, SAVE.achV]')).toEqual([1670, 2]);
		await expect(page.locator('#toasts')).toContainText(/\+1\s670/);
		await page.locator('[data-go="ach"]').click();
		await expect(page.locator('.ach-fame')).toContainText('+3 % střepů');
		await expect(page.locator('.ach-fame')).toContainText('+5 zdraví');
		// Grouped by rarity (by difficulty while few signed-in players have the game).
		await expect(page.locator('.ach-tier')).toHaveCount(5);
		await expect(page.locator('.ach-tier[data-tier="common"] [data-ach="k100"]')).toBeVisible();
		await expect(
			page.locator('.ach-tier[data-tier="legend"] [data-ach="sectorsAll"]'),
		).toBeVisible();
		await page.locator('.screen.active .back').click();
		const res = (await page.evaluate(`(() => {
		UI.hideOverlay(); Game.start('vex', 0, 0);
		const st = [G.st.maxHp, Math.round(G.st.greed * 100)];
		UI.showLevelUp = () => {}; UI.showChest = () => {}; UI.banner = () => {};
		playerDown = () => { G.p.hp = G.st.maxHp; };
		G.nextBossT = 1e9; G.nextElite = 1e9; G.nextEvent = 1e9; G.time = 240;
		// every new kind spawns and acts for a while without errors
		const kinds = ENEMY_KINDS.filter(k => ENEMIES[k].ai || ENEMIES[k].plate || ENEMIES[k].burstN || ENEMIES[k].cloak || ENEMIES[k].split === 'hydra2' || (ENEMIES[k].ranged && ENEMIES[k].ranged.n));
		for (const k of kinds) { const a = Math.random() * TAU; spawnEnemyAt(k, G.p.x + Math.cos(a) * 320, G.p.y + Math.sin(a) * 320); }
		for (let i = 0; i < 600; i++) { updateGame(1 / 60); if (G.state === 'levelup') pickChoice(0); if (G.state === 'chest') closeChest(); }
		// the bulwark's front shield and the phaser (no crits, nobody's aegis around)
		G.enemies.length = 0; G.st.crit = 0;
		const bw = spawnEnemyAt('bulwark', G.p.x, G.p.y - 300); bw.ang = Math.PI / 2;
		const h0 = bw.hp; hurtEnemy(bw, 10, 't', 0, -50); const front = h0 - bw.hp;
		const h1 = bw.hp; hurtEnemy(bw, 10, 't', 0, 50); const back = h1 - bw.hp;
		const ph = spawnEnemyAt('phaser', G.p.x, G.p.y + 300); ph.phased = true; const p0 = ph.hp; hurtEnemy(ph, 10, 't');
		// a hydra splits twice and the kill goes into the bestiary
		const hy = spawnEnemyAt('hydra', G.p.x + 300, G.p.y); killEnemy(hy);
		const heads = G.enemies.filter(e => !e.dead && e.type === 'hydra2').length;
		const tw = spawnEnemyAt('twin', G.p.x - 300, G.p.y);
		return { st, kinds: kinds.length, total: ENEMY_KINDS.length, front: Math.round(front), back: Math.round(back), phased: p0 - ph.hp, heads, hydra: SAVE.bestiary.hydra, pair: !!tw.mate && tw.mate.mate === tw };
	})()`)) as Record<string, unknown>;
		expect(res).toMatchObject({
			st: [105, 103],
			front: 2,
			back: 10,
			phased: 0,
			heads: 2,
			hydra: 1,
			pair: true,
		});
		expect(res.kinds as number).toBeGreaterThanOrEqual(25);
		expect(res.total as number).toBeGreaterThanOrEqual(30);
		expect(errors).toEqual([]);
	},
);

test(
	'VOIDBORN 1.5: void legends come only after their secret condition and pay an achievement',
	{ tag: '@voidborn' },
	async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto('/games/voidborn/index.html');
		await page.mouse.click(100, 100);
		const res = (await page.evaluate(`(() => {
		const out = {};
		const step = s => { for (let i = 0; i < s * 60; i++) { updateGame(1 / 60); if (G.state === 'levelup') pickChoice(0); if (G.state === 'chest') closeChest(); } };
		const got = () => (Legends.alive ? Legends.alive.type : null);
		// sure chance (Debug), so only the condition decides; no other spawns or bosses
		const run = setup => {
			SAVE.settings.dbgGod = true; SAVE.settings.dbgLegend = true; SAVE.settings.dbgLegendNext = '';
			UI.hideOverlay(); Game.start('vex', 0, 0);
			G.nextBossT = 1e9; G.nextEvent = 1e9; G.nextElite = 1e9; G.spawnAcc = -1e9;
			Input.move = () => ({ x: 0, y: 0 });
			setup();
		};
		// Watcher: 30 s without moving (from 1:30); moving starts the count again
		run(() => { G.time = 100; }); step(29); out.watcher29 = got(); step(2); out.watcher = got();
		run(() => { G.time = 100; }); step(20); Input.move = () => ({ x: 1, y: 0 }); step(0.5); Input.move = () => ({ x: 0, y: 0 }); step(15); out.watcherMoved = got();
		// Hoarder: 30 s without picking up a crystal while 15+ of them lie around
		run(() => { G.time = 130; G.lastGemT = G.time - 29; for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; G.pickups.push(mkPickup('gem', G.p.x + Math.cos(a) * 700, G.p.y + Math.sin(a) * 700, 1)); } });
		step(0.5); out.hoarderEarly = got(); step(1); out.hoarder = got();
		// Midnight Chime: only while the player's clock shows 0:xx
		const hours = Date.prototype.getHours;
		run(() => { G.time = 70; Date.prototype.getHours = () => 13; Legends.state.mid = 0.05; }); step(0.2); out.midnightAfternoon = got();
		run(() => { G.time = 70; Date.prototype.getHours = () => 0; Legends.state.mid = 0.05; }); step(0.2); out.midnight = got();
		Date.prototype.getHours = hours;
		// Comet: a meteor (not a weapon) finishes off an elite
		run(() => { G.time = 200; }); killEnemy(spawnEnemyAt('drone', G.p.x + 500, G.p.y, { elite: true })); out.cometByWeapon = got();
		run(() => { G.time = 200; }); { const el = spawnEnemyAt('drone', G.p.x + 500, G.p.y, { elite: true }); el.hp = el.maxHp * 0.2; G.byMeteor = true; hazardKill(el, 0, 0); G.byMeteor = false; } out.comet = got();
		// Mirror: 4 minutes without a hit
		run(() => { G.time = 300; G.noHit = 239.5; G.p.inv = 1e9; }); step(0.3); out.mirrorEarly = got(); step(0.5); out.mirror = got();
		step(2); out.mirrorShots = G.ebullets.length > 0;
		// Ouroboros: five tight loops in one direction within 12 s; wide circles are not enough
		run(() => { G.time = 200; Input.move = () => ({ x: Math.cos(G.time * Math.PI / 8), y: Math.sin(G.time * Math.PI / 8) }); }); step(30); out.ouroborosWide = got();
		run(() => { G.time = 200; Input.move = () => ({ x: Math.cos(G.time * Math.PI), y: Math.sin(G.time * Math.PI) }); }); step(12.5); out.ouroboros = got();
		// one legend at a time, each once per run, a minute of calm after it leaves
		Legends.state.done.watcher = false; Legends.state.still = 40; step(0.1); out.second = got();
		Legends.alive.life = 0.01; step(0.1); out.escaped = got(); out.gap = Math.round(Legends.state.gap);
		// a bomb only hurts a legend; killing it fills the bestiary, pays shards and the achievement
		SAVE.achievements = {}; SAVE.legendSeen = {}; delete SAVE.bestiary.watcher;
		run(() => { G.time = 300; G.st.crit = 0; });
		const h = Legends.spawn('hoarder'); h.x = G.p.x + 100; h.y = G.p.y;
		collect(mkPickup('bomb', G.p.x, G.p.y)); out.bombed = [!h.dead, Math.round(h.hp / h.maxHp * 100)];
		h.dead = true; SAVE.legendSeen = {};
		const w = Legends.spawn('watcher');
		const s0 = G.pickups.filter(p => p.kind === 'shard').reduce((t, p) => t + p.val, 0);
		killEnemy(w); checkAchievements(true);
		out.loot = G.pickups.filter(p => p.kind === 'shard').reduce((t, p) => t + p.val, 0) > s0;
		out.killed = [SAVE.bestiary.watcher, !!SAVE.achievements.lgWatcher, Legends.alive === null];
		out.kinds = [ENEMY_KINDS.length, LEGENDS.length, ENEMY_KINDS.some(k => LEGENDS.includes(k))];
		SAVE.settings.dbgLegend = false; SAVE.settings.dbgGod = false;
		endRun('quit'); UI.hideOverlay();
		return out;
	})()`)) as Record<string, unknown>;
		expect(res).toEqual({
			watcher29: null,
			watcher: 'watcher',
			watcherMoved: null,
			hoarderEarly: null,
			hoarder: 'hoarder',
			midnightAfternoon: null,
			midnight: 'midnight',
			cometByWeapon: null,
			comet: 'comet',
			mirrorEarly: null,
			mirror: 'mirror',
			mirrorShots: true,
			ouroborosWide: null,
			ouroboros: 'ouroboros',
			second: 'ouroboros',
			escaped: null,
			gap: 60,
			bombed: [true, 90],
			loot: true,
			killed: [1, true, true],
			kinds: [36, 6, false],
		});
		// Codex: the destroyed legend has its description, the others only a hint.
		await page.evaluate(`UI.show('codex')`);
		await page.locator('[data-tab="enemies"]').click();
		await expect(page.locator('.fcard.legend')).toHaveCount(6);
		await expect(page.locator('.fcard.legend').first()).toContainText('Pozorovatel');
		await expect(page.locator('.fcard.legend.unknown .hint')).toHaveCount(5);
		await expect(page.locator('.cx-sum.lg')).toContainText('1 / 6');
		// Achievements: legendary even by difficulty; locked ones show the hint instead of the name.
		await page.evaluate(`UI.show('ach')`);
		await expect(
			page.locator('.ach-tier[data-tier="legend"] [data-ach="lgWatcher"]'),
		).toContainText('Pozorovatel');
		await expect(
			page.locator('.ach-tier[data-tier="legend"] [data-ach="lgHoarder"] .hint'),
		).toBeVisible();
		await expect(page.locator('[data-ach="lgHoarder"]')).not.toContainText('Zlatník');
		expect(errors).toEqual([]);
	},
);

test(
	'VOIDBORN shows its version and the rendering quality can be lowered',
	{ tag: '@voidborn' },
	async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto('/games/voidborn/index.html');
		// The game's state is top-level `const`/functions of the page (not on window).
		const version = await page.evaluate<string>('GAME_VERSION');
		expect(version).toMatch(/^\d+\.\d+\.\d+$/);
		// The version sits on the title screen (and in the corner during a run), not in Settings.
		await expect(page.locator('#s-title .title-ver')).toBeVisible();
		await expect(page.locator('#s-title .title-ver')).toHaveText(`v${version}`);
		await page.mouse.click(100, 100);
		await page.locator('[data-go="settings"]').click();
		await expect(page.locator('#s-settings')).not.toContainText(`v${version}`);
		// The preview stays empty until the pointer is on a setting you can see in the game.
		await page.mouse.move(5, 5);
		await expect(page.locator('#setPv canvas')).toHaveCount(0);
		// Auto -> Full -> Saver: the canvas is drawn at 70 % of the resolution.
		await page.locator('[data-act="quality"]').click();
		await page.locator('[data-act="quality"]').click();
		expect(await page.evaluate(`[SAVE.settings.quality, Render.scale]`)).toEqual(['low', 0.7]);
		// Settings are grouped; picking a row shows what it looks like on and off.
		await expect(page.locator('.setg')).toHaveCount(
			(await page.evaluate<boolean>('DEBUG')) ? 6 : 5,
		);
		await page.locator('[data-pv="dmgNums"] label').click();
		await expect(page.locator('#setPv')).toContainText('Čísla poškození');
		await expect(page.locator('#setPv canvas')).toHaveCount(2);
		// Sound has nothing to show: the preview goes away.
		await page.locator('.row:has([data-vol="sfx"]) label').click();
		await expect(page.locator('#setPv canvas')).toHaveCount(0);
		// Debug tools (hidden for a release): shards, game speed and god mode.
		if (await page.evaluate<boolean>('DEBUG')) {
			const before = await page.evaluate<number>('SAVE.shards');
			await page.locator('[data-act="dbgShards"]').click();
			await page.locator('[data-act="dbgSpeed"]').click();
			await page.locator('[data-tog="dbgGod"]').click();
			expect(await page.evaluate('[SAVE.shards, Debug.speed, Debug.god]')).toEqual([
				before + 10000,
				2,
				true,
			]);
			await page.locator('[data-act="dbgSpeed"]').click();
			await page.locator('[data-act="dbgSpeed"]').click();
			expect(await page.evaluate('Debug.speed')).toBe(1);
		}
		await page.locator('.screen.active .back').click();
		await page.locator('[data-go="hangar"]').click();
		await page.locator('#startBtn').click();
		await expect(page.locator('#fps')).toContainText(`v${version}`);
		expect(errors).toEqual([]);
	},
);

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

test('achievement rarity counts come from the cloud saves', async ({ request }) => {
	const res = await request.get('/api/rarity?game=voidborn');
	expect(res.ok()).toBe(true);
	const body = (await res.json()) as { total: number; counts: Record<string, number> };
	expect(typeof body.total).toBe('number');
	expect(typeof body.counts).toBe('object');
	expect((await request.get('/api/rarity?game=nope')).status()).toBe(400);
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

	test('the hidden page /tajne/ruzek opens without the password', async ({ page }) => {
		await page.goto('/tajne/ruzek');
		await expect(page).toHaveURL(/\/tajne\/ruzek\/?$/);
		await expect(page).toHaveTitle(/Honza Růžek/);
	});
});

test('the center shows who is playing a game right now', async ({ context, page, request }) => {
	// Another tab opens VOIDBORN; the game tells the center it is being played.
	const game = await context.newPage();
	const heartbeat = game.waitForResponse(
		(r) => r.url().endsWith('/api/presence') && r.request().method() === 'POST',
	);
	await game.goto('/games/voidborn/index.html');
	expect((await heartbeat).status()).toBe(204);

	const res = await request.get('/api/presence');
	expect(res.ok()).toBe(true);
	const { games, site } = (await res.json()) as {
		games: Record<string, { signedIn: number; anonymous: number }>;
		site: { online: number; visitors: { month: number; total: number }; accounts: number };
	};
	// Other tests play in parallel, so at least this tab is counted (nobody is signed in in E2E).
	expect(games.voidborn?.anonymous).toBeGreaterThanOrEqual(1);
	expect(Object.keys(games).sort()).toEqual(GAMES.map((g) => g.id).sort());
	// The site counts people, not tabs: this visitor is online and has been here.
	expect(site.online).toBeGreaterThanOrEqual(1);
	expect(site.visitors.total).toBeGreaterThanOrEqual(site.visitors.month);
	expect(site.visitors.month).toBeGreaterThanOrEqual(1);

	await page.goto('/');
	await expect(page.getByTestId('live')).toContainText('Právě hraje');
	await expect(page.getByTestId('live')).toContainText('anonymní');
	await expect(page.getByTestId('shelf').locator('.gc-live').first()).toBeVisible();
	// VOIDBORN is among the games played right now.
	await expect(page.getByTestId('hot')).toContainText('VOIDBORN');

	// Unknown games and malformed heartbeats are rejected.
	const bad = await request.post('/api/presence', {
		data: { client: 'abcdefgh1234', game: 'not-a-game' },
	});
	expect(bad.status()).toBe(400);
});

test(
	'DRIFTWOOD runs on computers and is blocked on phones',
	{ tag: '@driftwood' },
	async ({ page, request, isMobile }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto('/');
		const card = page.getByTestId('shelf').locator('.gcard').nth(2);
		await card.click();
		await expect(page.locator('.hero-title')).toHaveText('DRIFTWOOD');
		await expect(card.locator('.gc-badges span').first()).toHaveText('PC');

		if (isMobile) {
			await expect(page.getByTestId('play')).toBeDisabled();
			await expect(page.getByTestId('play')).toHaveText('JEN NA POČÍTAČI');
			// A second tap on the card does not launch it either, and a direct link goes back.
			await card.click();
			await expect(page).toHaveURL(/\/$/);
			await page.goto('/games/driftwood/index.html');
			await page.waitForURL((url) => url.pathname === '/');
			await expect(page).toHaveTitle('Windowling Game Center');
		} else {
			// The 3D game itself is not rendered here: headless Chrome on GPU-less CI runners
			// crashes in WebGL. The hub must launch it, and the game must be served.
			const game = await request.get('/games/driftwood/index.html');
			expect(game.ok()).toBe(true);
			expect(await game.text()).toContain('<title>DRIFTWOOD</title>');
			await page.route('**/games/driftwood/**', (route) =>
				route.fulfill({ contentType: 'text/html', body: '<title>DRIFTWOOD</title>' }),
			);
			await page.getByTestId('play').click();
			await page.waitForURL('**/games/driftwood/**');
			await expect(page).toHaveTitle('DRIFTWOOD');
		}
		expect(errors).toEqual([]);
	},
);

test('/favicon.ico points browsers at the SVG icon', async ({ request }) => {
	const res = await request.get('/favicon.ico', { maxRedirects: 0 });
	expect(res.status()).toBe(308);
	expect(res.headers().location).toBe('/favicon.svg');
});

test('the hidden page opens at /tajne/ruzek, unlinked and kept out of search engines', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/tajne/ruzek');
	await expect(page).toHaveURL(/\/tajne\/ruzek\/?$/);
	await expect(page).toHaveTitle(/Honza Růžek/);
	await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, nofollow');
	expect(errors).toEqual([]);
	// Nothing in the center points to it.
	await page.goto('/');
	await expect(page.locator('.brand')).toContainText('WINDOWLING');
	await expect(page.locator('a[href*="tajne"]')).toHaveCount(0);
});

test('the Game wikis tab opens the Gray Zone Warfare field guide, which works and links back', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');
	await page.getByTestId('tab-wiki').click();
	await expect(page).toHaveURL(/#wiki$/);
	await expect(page.getByTestId('library')).toBeHidden();
	const card = page.getByTestId('wiki-gzw');
	await expect(card).toContainText('Gray Zone Warfare');
	await card.click();
	await expect(page).toHaveURL(/\/wiki\/gzw\/?$/);
	await expect(page).toHaveTitle('GZW Polní příručka');

	// Ammo: picking the enemy's armour class keeps only what penetrates it.
	const rows = page.locator('#ammo-t tbody tr');
	await expect(rows.first()).toBeVisible();
	const all = await rows.count();
	await page.locator('#ammo-cls [data-cls="6"]').click();
	await expect(page.locator('#ammo-sum')).toContainText('IIIA+');
	await expect.poll(() => rows.count()).toBeLessThan(all);
	// Loot shows the item icons.
	await page.locator('.tabs [data-tab="loot"]').click();
	await expect(page.locator('#loot-t img.ico').first()).toBeVisible();
	// The Fandom wiki is one click away.
	await expect(page.getByRole('link', { name: 'Fandom wiki ↗' })).toHaveAttribute(
		'href',
		'https://gray-zone-warfare.fandom.com/wiki/Gray_Zone_Warfare_Wiki',
	);

	// The English version: the same guide, translated, and back to Czech.
	await page.getByRole('link', { name: 'EN', exact: true }).click();
	await expect(page).toHaveURL(/\/wiki\/gzw\/en\/?$/);
	await expect(page).toHaveTitle('GZW Field Guide');
	await page.locator('.tabs [data-tab="munice"]').click();
	await page.locator('#ammo-cls [data-cls="6"]').click();
	await expect(page.locator('#ammo-sum')).toContainText('penetrate');
	await page.locator('.tabs [data-tab="loot"]').click();
	await expect(page.locator('#loot-cat')).toContainText('Evidence and IDs');
	await page.getByRole('link', { name: 'CZ', exact: true }).click();
	await expect(page).toHaveTitle('GZW Polní příručka');

	// Back to the center lands on its wiki tab.
	await page.getByRole('link', { name: '← Game Center' }).click();
	await expect(page.getByTestId('wiki')).toBeVisible();
	// Under the card: both languages and the Fandom wiki.
	await expect(page.getByTestId('wiki-gzw-en')).toHaveAttribute('href', '/wiki/gzw/en/');
	await expect(page.getByTestId('wiki').getByRole('link', { name: 'Fandom wiki ↗' })).toBeVisible();
	await page.getByTestId('tab-library').click();
	await expect(page.getByTestId('library')).toBeVisible();
	expect(errors).toEqual([]);
});

test('the library filters by genre, finds games and keeps favourites', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');
	const library = page.getByTestId('library');
	await expect(library.locator('.gcard').first()).toBeVisible();

	// A genre chip shows just that genre.
	await library.locator('[data-filter="board"]').click();
	await expect(library.locator('.sub')).toHaveCount(1);
	await expect(page.getByTestId('shelf-board')).toContainText('MAHJONG');
	await expect(library).not.toContainText('SUDOKU');
	await library.getByRole('tab', { name: 'Vše' }).click();

	// Search ignores case and diacritics.
	await page.getByTestId('search').fill('sachy');
	await expect(page.getByTestId('shelf-search').locator('.gcard')).toHaveCount(1);
	await expect(page.getByTestId('shelf-search')).toContainText('ŠACHY');
	await page.getByTestId('search').fill('');

	// Favourites: the star on a card, its own shelf on top and the filter; kept after reload.
	await library.locator('.gslot[data-game="sokoban"] .gc-fav').click();
	await expect(page.getByTestId('shelf-fav')).toContainText('SOKOBAN');
	await expect(library.locator('.sub').first()).toHaveAttribute('data-group', 'fav');
	expect(await page.evaluate(() => localStorage.getItem('gamecenter.favorites'))).toBe(
		'["sokoban"]',
	);
	// The big games can be favourites too, from the hero.
	await page.getByTestId('fav').click();
	await expect(page.getByTestId('fav')).toHaveAttribute('aria-pressed', 'true');
	await library.locator('[data-filter="fav"]').click();
	await expect(page.getByTestId('shelf-fav').locator('.gcard')).toHaveCount(2);
	await page.reload();
	await expect(library.locator('[data-filter="fav"]')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('shelf-fav').locator('.gcard')).toHaveCount(2);
	await library.locator('.gslot[data-game="sokoban"] .gc-fav').click();
	await expect(page.getByTestId('shelf-fav').locator('.gcard')).toHaveCount(1);

	// Sorting by name.
	await library.getByRole('tab', { name: 'Vše' }).click();
	await page.getByTestId('sort').selectOption('name');
	await expect(page.getByTestId('shelf-arcade').locator('h3').first()).toHaveText('BOMBARĎÁK');
	expect(errors).toEqual([]);
});
