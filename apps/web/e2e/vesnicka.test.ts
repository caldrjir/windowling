import { expect, test, type Page } from '@playwright/test';

// VESNIČKA: the idle village. The game's objects (Game, Scene, ...) are globals of the page's
// classic scripts; the test plays by clicking and only shortens the waiting.
test.use({ locale: 'cs-CZ' });

const URL = '/games/vesnicka/index.html';
const run = <T>(page: Page, code: string): Promise<T> =>
	page.evaluate(`(() => { ${code} })()`) as Promise<T>;
// Toasts come in bursts and a phone keeps only two on screen, so a newer one can push out the one
// a test waits for: record every toast that appears and check the record instead.
const recordToasts = (page: Page) =>
	run(
		page,
		"window.toastLog = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) window.toastLog.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true });",
	);
const toastLog = (page: Page) =>
	run<string[]>(page, 'return window.toastLog;').then((l) => l.join(' | '));

test(
	'VESNIČKA: tap, build, catch a creature, pass the village on and earn while away',
	{ tag: '@vesnicka' },
	async ({ page, context }) => {
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
		// "To the next upgrade": exactly the purchases missing to the next tier or mastery.
		await run(page, 'Game.S.coins = 1e5;');
		const to = page.locator('.row[data-b="0"] .to');
		await expect(to).toContainText('9× → 10');
		await expect(page.locator('.row[data-b="0"] .mx')).toContainText('max ');
		await to.click();
		expect(await run<number>(page, 'return Game.S.owned.pole;')).toBe(10);
		// The best buy on the green buys what pays for itself fastest.
		const bought = () => run<number>(page, 'return Game.S.stats.buys + Game.S.stats.upgrades;');
		const before = await bought();
		await expect(page.locator('#quick')).toBeVisible();
		await page.locator('#quick').click();
		expect(await bought()).toBe(before + 1);
		// Daily tasks unfold after the first purchases and say when the next ones arrive.
		await expect(page.locator('[data-tab="tasks"]')).toHaveCount(0);
		await run(page, 'Game.S.stats.buys = 15;');
		await page.locator('[data-tab="tasks"]').click();
		await expect(page.locator('#dailyNext')).toContainText('Nové úkoly za');
		await page.locator('[data-tab="build"]').click();
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
		await run(page, 'Game.S.earnedAll = 2.7e12;'); // ∛(2,7e12 / 10^11) = 3
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
		await expect
			.poll(() => run<number>(page, 'return Game.S.stats.stewardBuys;'))
			.toBeGreaterThan(5);

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
		expect(lb['free:jmeni:score']).toBeGreaterThan(12_000); // log10(2,7e12) × 1000

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
	},
);

test(
	'VESNIČKA guild: the smith founds it, ranks train the ranks below and it grows while away',
	{ tag: '@vesnicka' },
	async ({ page, context }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(URL);
		await page.locator('.sheet .btn').click();
		await expect(page.locator('[data-tab="cech"]')).toHaveCount(0);

		// The first smithy founds the guild: a new tab, five apprentices and a journeyman as a gift.
		await recordToasts(page);
		await run(page, 'Game.S.coins = 3e5; Game.S.owned.pole = 10; Game.S.owned.pekarna = 1;');
		await page.locator('.row[data-b="4"] .buy').click();
		await expect.poll(() => toastLog(page)).toContain('Kovář založil v obci cech');
		await page.locator('[data-tab="cech"]').click();
		await expect(page.locator('.crow[data-c="0"] .cnt')).toHaveText('5');
		await expect(page.locator('.crow[data-c="1"] .cnt')).toHaveText('1');
		await expect(page.locator('#cMul')).toContainText('výnos ×');
		await expect(page.locator('#cSub')).toContainText('každý desetinásobek +6\u00a0%');

		// Buying: the apprentice works in the trades, the journeyman trains apprentices.
		await run(page, 'Game.S.coins = 1e7;');
		await page.locator('[data-cbuy="0"]').click();
		await page.locator('[data-cbuy="1"]').click();
		expect(await run(page, 'return Game.S.cech.b.slice(0, 2);')).toEqual([1, 1]);
		await expect(page.locator('#buffs .b-cech')).toBeVisible();
		// Generators make generators: ten minutes of training add apprentices without buying.
		const grown = await run<{ before: number; after: number; mul: [number, number] }>(
			page,
			'const S = Game.S, before = S.cech.a[0], m0 = Econ.cMul(S), t = Date.now(); Econ.advance(S, t, t + 600e3); return { before, after: S.cech.a[0], mul: [m0, Econ.cMul(S)] };',
		);
		expect(grown.after).toBeGreaterThan(grown.before + 100);
		expect(grown.mul[1]).toBeGreaterThan(grown.mul[0]);
		// Ten bought earn a guild seal (1× · 10× · Max next to every item).
		await run(page, 'Game.S.coins = 1e12; Game.S.stats.buys = 10;');
		await page.locator('.crow[data-c="0"] [data-ra="10"]').click();
		await page.locator('[data-cbuy="0"]').click();
		await expect.poll(() => toastLog(page)).toContain('Cechovní pečeť');
		expect(await run(page, 'return [Game.S.cech.b[0], Game.S.stats.cechSeals];')).toEqual([11, 1]);
		// The next rank shows up once you have the one below; higher ones need legends.
		await page.locator('[data-cbuy="2"]').click();
		await expect(page.locator('.crow[data-c="3"]')).toContainText('Odemkne se s 5 pověstmi');
		expect(
			await run<boolean>(page, 'return document.documentElement.scrollWidth <= innerWidth;'),
		).toBe(true);

		// Grandpa Know-all makes the guild train ten times as much for a while.
		await run(
			page,
			"Scene.clearCreature(); Scene.spawnCreature('vseved', 60); Scene.focusCreature();",
		);
		await page.waitForTimeout(800);
		const at = await run<{ x: number; y: number }>(page, 'return Scene.creatureScreen();');
		await page.locator('#cv').click({ position: { x: Math.round(at.x), y: Math.round(at.y) } });
		expect(await run(page, "return Game.S.buffs.find((b) => b.id === 'vseved').kind;")).toBe(
			'cech',
		);

		// The guild is saved, grows while the game is closed and is welcomed back.
		await run(page, 'Game.save();');
		const lb = await run<Record<string, number>>(
			page,
			'return JSON.parse(localStorage.getItem("vesnicka.save.v1")).lb;',
		);
		expect(lb['free:ucni:score']).toBeGreaterThan(1000); // log10(apprentices) × 1000
		const save = await run<string>(
			page,
			'const o = JSON.parse(localStorage.getItem("vesnicka.save.v1")); o.t -= 2 * 3600 * 1000; o.seen.news = 99; return JSON.stringify(o);',
		);
		const ucni = await run<number>(page, 'return Game.S.cech.a[0];');
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
		await expect(back.locator('.sheet')).toContainText('Cech mezitím vyučil');
		await back.locator('.sheet .btn').click();
		expect(await run<number>(back, 'return Game.S.cech.a[0];')).toBeGreaterThan(ucni * 2);
		await expect(back.locator('[data-tab="cech"]')).toBeVisible();

		// A new generation starts the guild again; the guild stays founded.
		await run(back, 'Game.S.earnedAll = 2.7e12;');
		await back.locator('[data-tab="legend"]').click();
		await back.locator('#prestige').click();
		await back.locator('.sheet .btn.gold').click();
		expect(
			await run(back, 'return [Game.S.cech.b.every((n) => n === 0), Econ.cechOpen(Game.S)];'),
		).toEqual([true, true]);
		expect(errors).toEqual([]);
	},
);

test(
	'VESNIČKA music: the season by day, the night, volume and mute',
	{ tag: '@vesnicka' },
	async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		const key = () => run<string | null>(page, 'return Hudba.state().key;');
		const level = () => run<number>(page, 'return Hudba.state().level;');
		await page.goto(URL);
		await run(page, 'Scene.opts.hour = 12; Scene.opts.season = 2;');
		expect(await key()).toBeNull(); // browsers play sound only after the first tap
		await page.locator('.sheet .btn').click();
		// Autumn by day, quietly under the sound effects (55 % of the music volume).
		await expect.poll(key).toMatch(/^podzim-[12]$/);
		expect(await level()).toBeCloseTo(0.3025, 3);
		// At night the night music fades in instead.
		await run(page, 'Scene.opts.hour = 23; Hudba.tick();');
		await expect.poll(key).toMatch(/^noc-[12]$/);

		// Settings: music off and on, its volume and the volume of the sounds.
		await page.locator('[data-tab="more"]').click();
		await page.locator('#setMusic').uncheck();
		await expect.poll(level).toBe(0);
		await page.locator('#setMusic').check();
		await page.locator('[data-vol="musicVol"]').fill('20');
		await expect.poll(level).toBeCloseTo(0.04, 3);
		await page.locator('[data-vol="sfxVol"]').fill('50');
		expect(await run(page, 'return [Game.S.settings.musicVol, Game.S.settings.sfxVol];')).toEqual([
			20, 50,
		]);
		// The button at the top mutes music and sounds together, and brings them back.
		await page.locator('#soundBtn').click();
		await expect(page.locator('#soundBtn')).toHaveText('🔇');
		expect(await run(page, 'return [Hudba.state().level, Sound.on];')).toEqual([0, false]);
		await page.locator('#soundBtn').click();
		await expect(page.locator('#soundBtn')).toHaveText('🔊');
		await expect.poll(level).toBeGreaterThan(0);

		// Two tracks for every season and two for the night.
		for (const slot of ['jaro', 'leto', 'podzim', 'zima', 'noc'])
			for (const n of [1, 2]) {
				const res = await page.request.head(`/games/vesnicka/hudba/${slot}-${n}.mp3`);
				expect(res.ok(), `${slot}-${n}`).toBe(true);
			}
		expect(errors).toEqual([]);
	},
);

test(
	'VESNIČKA: the chapel grows into a church with the masteries',
	{ tag: '@vesnicka' },
	async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(URL);
		await page.locator('.sheet .btn').click();
		const level = (pole: number) =>
			run<number>(
				page,
				`for (const b of BUILDINGS) Game.S.owned[b.id] = 0; Game.S.owned.pole = ${pole}; Game.S.upg.kaplicka = 1; return Scene.churchLevel();`,
			);
		expect(await level(0)).toBe(1); // a stone chapel
		expect(await level(150)).toBe(2); // 10, 40 and 150 fields: three masteries, a tower
		expect(await level(120_000)).toBe(3); // ten masteries, the spire
		await run(page, 'Scene.panTo(600, false);');
		expect(
			await run<number>(
				page,
				'for (const b of BUILDINGS.slice(0, 4)) Game.S.owned[b.id] = 1e6; return Scene.churchLevel();',
			),
		).toBe(5); // 4 × 13 masteries
		await page.waitForTimeout(300); // a few frames of the whole church on screen
		expect(errors).toEqual([]);
	},
);

test(
	'VESNIČKA: twin masteries, 1× · 10× · Max, spirit, stars, the family tree and helpers',
	{ tag: '@vesnicka' },
	async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(URL);
		await page.locator('.sheet .btn').click();
		// The interface starts simple and unfolds: trades and more only, no spirit yet.
		await expect(page.locator('#tabs [data-tab]')).toHaveCount(2);
		await expect(page.locator('#powers')).toBeHidden();

		// The first mastery at 10 fields: output ×2 and every purchase now brings two fields.
		await run(page, 'Game.S.coins = 1e4;');
		await page.locator('.row[data-b="0"] .buy').click();
		await page.locator('.row[data-b="0"] .to').click();
		expect(
			await run(page, 'return [Game.S.owned.pole, Game.S.buys.pole, Econ.perBuy(Game.S, 0)];'),
		).toEqual([10, 10, 2]);
		await expect(page.locator('#toasts')).toContainText('Mistrovství');
		await expect(page.locator('#toasts')).toContainText('přinese 2 ks');
		await expect(page.locator('.row[data-b="0"] .buy small')).toHaveText('Postavit +2');
		await expect(page.locator('.row[data-b="0"] .ms span')).toContainText('10/40');
		await expect(page.locator('[data-tab="upg"]')).toBeVisible(); // unlocked after the first purchases
		// 1× · 10× · Max: ten purchases at once (price by purchases, not by units).
		await run(page, 'Game.S.coins = 1e6;');
		await page.locator('.row[data-b="0"] [data-ra="10"]').click();
		await expect(page.locator('.row[data-b="0"] .buy small')).toHaveText('Postavit +20');
		await page.locator('.row[data-b="0"] .buy').click();
		expect(await run(page, 'return [Game.S.owned.pole, Game.S.buys.pole];')).toEqual([30, 20]);
		await page.locator('.row[data-b="0"] [data-ra="max"]').click();
		const mx = await run<number>(page, 'return Econ.maxAfford(Game.S, 0);');
		await page.locator('.row[data-b="0"] .buy').click();
		expect(await run<number>(page, 'return Game.S.buys.pole;')).toBe(20 + mx);
		// Neighbourly help: a hen house lifts the fields below it.
		const before = await run<number>(page, 'return Econ.bRate(Game.S, 0, 0, false);');
		await page.locator('.row[data-b="1"] .buy').click();
		expect(await run<number>(page, 'return Econ.bRate(Game.S, 0, 0, false);')).toBeGreaterThan(
			before * 1.15,
		);
		await expect(page.locator('.row[data-b="0"] .syn')).toContainText('od vyšších ×1,2');

		// Spirit opens once the village earns a bit: a harvest rush and the hourglass.
		await run(page, 'Game.S.earnedAll = 1e4;');
		await expect(page.locator('#powers')).toBeVisible();
		await expect(page.locator('#toasts')).toContainText('Elán');
		await page.locator('[data-power="rush"]').click();
		expect(
			await run(
				page,
				"return Game.S.buffs.filter((b) => b.id.startsWith('zne')).map((b) => b.mul);",
			),
		).toEqual([5, 5]);
		await expect(page.locator('[data-power="rush"]')).toBeDisabled(); // running: a countdown
		const coins = await run<number>(page, 'return Game.S.coins;');
		await page.locator('[data-power="warp"]').click();
		expect(await run<number>(page, 'return Game.S.coins;')).toBeGreaterThan(coins);
		expect(
			await run(page, 'return [Game.S.stats.warps, Game.S.stats.rushes, Math.round(Game.S.elan)];'),
		).toEqual([1, 1, 10]);
		await expect(page.locator('[data-power="warp"]')).toBeDisabled(); // 10 spirit left

		// A shooting star grants a wish; income spells multiply into a combo.
		await run(
			page,
			"Scene.clearCreature(); Scene.spawnCreature('hvezda', 60); Scene.focusCreature();",
		);
		await page.waitForTimeout(800);
		const at = await run<{ x: number; y: number }>(page, 'return Scene.creatureScreen();');
		await page.locator('#cv').click({ position: { x: Math.round(at.x), y: Math.round(at.y) } });
		expect(await run<number>(page, 'return Game.S.stats.stars;')).toBe(1);
		await run(
			page,
			"Game.S.buffs = []; Econ.addBuff(Game.S, 'vodnik', 'rate', 5, 30); Econ.addBuff(Game.S, 'hvezda_shon', 'rate', 7, 30); Econ.noteCombo(Game.S);",
		);
		await expect(page.locator('#buffs .b-combo')).toContainText('KOMBO ×35');
		expect(await run<number>(page, 'return Game.S.stats.comboMax;')).toBeGreaterThanOrEqual(35);

		// The family tree: legends buy lasting branches; a farmhand buys fields and hen houses.
		await run(page, 'Game.S.legends = 30; Game.S.earnedAll = 1e12;');
		await page.locator('[data-tab="legend"]').click();
		await page.locator('[data-tree="erb"]').click();
		await page.locator('[data-tree="pacholek"]').click();
		expect(
			await run(
				page,
				'return [Object.keys(Game.S.tree), Game.S.legends, Econ.legendsTotal(Game.S)];',
			),
		).toEqual([['erb', 'pacholek'], 28, 30]);
		await expect(page.locator('[data-tree="puda"]')).toBeEnabled();
		const auto = await run<number>(page, 'return Game.S.stats.autoBuys;');
		const buys = await run<number>(page, 'return Game.S.buys.pole + Game.S.buys.kurnik;');
		await run(page, 'Game.S.coins = 1e12;');
		await expect
			.poll(() => run<number>(page, 'return Game.S.stats.autoBuys;'))
			.toBeGreaterThan(auto);
		expect(
			await run<number>(page, 'return Game.S.buys.pole + Game.S.buys.kurnik;'),
		).toBeGreaterThan(buys);
		await page.locator('label:has([data-ab="pole"])').click();
		expect(await run(page, 'return Game.S.settings.ab.pole;')).toBe(false);

		// Clean numbers: 1,25 tis. … then scientific from 10^15; never NaN.
		expect(
			await run(
				page,
				'return [fmt(1250), fmt(4.8e6), fmt(1.24e10), fmt(1.5e15), fmt(NaN), fmt(Infinity)];',
			),
		).toEqual(['1,25 tis.', '4,80 mil.', '12,4 mld.', '1,50e15', '0', '∞']);
		expect(
			await run<boolean>(page, 'return document.documentElement.scrollWidth <= innerWidth;'),
		).toBe(true);
		expect(errors).toEqual([]);
	},
);

test(
	'VESNIČKA: an old save loads with the new systems (no NaN)',
	{ tag: '@vesnicka' },
	async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		// A save from before the overhaul: no purchases, no spirit, no tree, no helper settings.
		const old = {
			v: 1,
			coins: 5e9,
			earnedGen: 1e10,
			earnedAll: 3e10,
			legends: 3,
			spent: 0,
			steward: false,
			gen: 2,
			taps: 900,
			owned: { pole: 300, kurnik: 120, vcelin: 60, pekarna: 25, kovarna: 3 },
			upg: { pole1: 1, pole2: 1, kurnik1: 1 },
			caught: { bludicka: 4 },
			buffs: [{ id: 'vodnik', kind: 'rate', mul: 5, t: 20, max: 45 }],
			ach: {},
			daily: {
				day: '2026-11-17',
				tasks: [{ kind: 'buy', n: 30, claimed: false }],
				start: { bought: 400, taps: 800, caught: 3, upg: 2, earned: 1e9, milestones: 5 },
				seasons: {},
				bonus: false,
			},
			cech: { a: [10, 1, 0, 0, 0, 0, 0, 0], b: [0, 0, 0, 0, 0, 0, 0, 0] },
			stats: {
				playTime: 5000,
				bought: 508,
				upgrades: 3,
				milestones: 9,
				seasons: { 0: 1 },
				night: 0,
				awayMax: 0,
				dailyAll: 0,
				bestRate: 1e6,
				started: 0,
				genStart: 0,
				missed: 1,
				maxBuildings: 508,
				stewardBuys: 0,
				nesro: 0,
				cechOpen: 1,
				ucniMax: 10,
				cechBought: 0,
				cechSeals: 0,
			},
			settings: {
				sound: true,
				sci: false,
				quick: true,
				auto: true,
				music: false,
				musicVol: 55,
				sfxVol: 100,
				mute: false,
			},
			seen: { news: 7, tap: 1, creature: 1 },
			t: Date.now() - 60_000,
		};
		await page.addInitScript((v) => {
			// today's tasks, so that the purchase task stays (a new day would draw new ones)
			const d = new Date(),
				o = JSON.parse(v);
			o.daily.day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			localStorage.setItem('vesnicka.save.v1', JSON.stringify(o));
		}, JSON.stringify(old));
		await page.goto(URL);
		const state = await run<{
			buys: number;
			owned: number;
			elan: number;
			rate: number;
			coins: string;
			tree: number;
			ab: object;
		}>(
			page,
			'const S = Game.S; return { buys: S.buys.pole, owned: S.owned.pole, elan: S.elan, rate: Econ.rate(S), coins: document.querySelector("#coins").textContent, tree: Object.keys(S.tree).length, ab: S.settings.ab };',
		);
		expect(state.owned).toBe(300);
		expect(state.buys).toBe(await run<number>(page, 'return buysFor(0, 300);'));
		expect(state.buys).toBeLessThan(300); // cheaper than before: the price follows purchases
		expect(state.elan).toBe(100);
		expect(Number.isFinite(state.rate) && state.rate > 0).toBe(true);
		expect(state.coins).not.toMatch(/NaN|undefined/);
		expect(state.tree).toBe(0);
		expect(state.ab).toEqual({});
		// Today's purchase task counts purchases from now on (not the old buildings count).
		expect(
			await run<number>(page, 'return Econ.dailyProgress(Game.S, Game.S.daily.tasks[0]);'),
		).toBe(0);
		await expect(page.locator('#body')).not.toContainText('NaN');
		expect(errors).toEqual([]);
	},
);

test(
	'VESNIČKA in the center: the card, the cover and the link',
	{ tag: '@vesnicka' },
	async ({ page }) => {
		await page.goto('/');
		const card = page.getByTestId('library').locator('.gslot[data-game="vesnicka"]');
		await expect(card).toBeVisible();
		await expect(page.getByTestId('shelf-relax')).toContainText('VESNIČKA');
		const cover = await page.request.get('/games/vesnicka/cover/scene.webp');
		expect(cover.ok()).toBe(true);
	},
);

test(
	'VESNIČKA ending: the last handover wins, a break freezes the village with everything done',
	{ tag: '@vesnicka' },
	async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(URL);
		await page.locator('.sheet .btn').click();

		// Handing the village over from generation 65 on is the last handover: the game is won.
		await run(
			page,
			'Object.assign(Game.S, { gen: 65, legends: 1000, earnedAll: 1e30 }); Game.S.owned.pole = 30; Game.S.seen.news = 99;',
		);
		await page.locator('[data-tab="legend"]').click();
		await page.locator('#prestige').click();
		await page.locator('.sheet .btn.gold').click();
		const sheet = page.locator('#modal .sheet');
		await expect(sheet).toContainText('Blahopřejeme, vyhrál jste!');
		await expect(sheet).toContainText('Můžete si dát pauzu, nebo začít od znova.');
		expect(
			await run(
				page,
				'return [Game.S.gen, Game.S.owned.pole, Game.S.won > 0, Game.S.legends > 1000];',
			),
		).toEqual([65, 30, true, true]);
		// The window cannot be dismissed: neither the backdrop nor Escape closes it, nor reloading.
		await page.mouse.click(4, 4);
		await page.keyboard.press('Escape');
		await expect(sheet).toContainText('Blahopřejeme');
		await page.reload();
		await expect(page.locator('#modal .sheet')).toContainText('Blahopřejeme, vyhrál jste!');
		// Starting over asks first; "Back" returns to the window.
		await page.locator('#modal .btn.ghost').click();
		await expect(sheet).toContainText('Začít od znova?');
		await page.locator('#modal .btn.ghost').click();
		await expect(sheet).toContainText('Blahopřejeme');

		// A break: the game stops, everything is completed and the village stays to look at.
		await page.locator('#modal .btn.gold').click();
		await expect(page.locator('#modal')).toBeHidden();
		await expect(page.locator('body')).toHaveClass(/vs-over/);
		await expect(page.locator('#wonBadge')).toBeVisible();
		await expect(page.locator('#rate')).toContainText('Hra stojí');
		expect(
			await run(
				page,
				'return [Game.S.paused, Econ.achCount(Game.S) === ACHIEVEMENTS.length, Object.keys(Game.S.tree).length === TREE.length];',
			),
		).toEqual([true, true, true]);
		const frozen = () =>
			run<number[]>(page, 'return [Game.S.coins, Game.S.earnedAll, Game.S.taps];');
		const before = await frozen();
		const cv = page.locator('#cv');
		const box = await cv.boundingBox();
		if (!box) throw new Error('no canvas');
		await cv.click({ position: { x: box.width / 2, y: box.height * 0.62 } });
		await page.waitForTimeout(1200);
		expect(await frozen()).toEqual(before);
		expect(await run(page, 'return Game.buy(0, 1);')).toBe(false);
		await page.locator('[data-tab="tasks"]').click();
		await expect(page.locator('#body')).toContainText(
			`Úspěchy · ${await run<number>(page, 'return ACHIEVEMENTS.length;')} / `,
		);
		await expect(page.locator('#body [data-claim]')).toHaveCount(0);
		await page.locator('[data-tab="more"]').click();
		await expect(page.locator('#body .won-card')).toContainText('Hra stojí');
		expect(
			await run<boolean>(page, 'return document.documentElement.scrollWidth <= innerWidth;'),
		).toBe(true);

		// The break lasts: no window after reloading, and the hub shows the game as complete.
		await page.reload();
		await expect(page.locator('#wonBadge')).toBeVisible();
		await expect(page.locator('#modal')).toBeHidden();
		expect(
			await run<number>(
				page,
				'return JSON.parse(localStorage.getItem("gamecenter.stats.vesnicka")).progress;',
			),
		).toBe(1);

		// Only deleting the village lets you play again.
		await page.locator('#wonBadge').click();
		await page.locator('#modal .btn.ghost').click();
		await page.locator('#modal .btn.danger').click();
		await expect(page.locator('#modal .sheet h2')).toHaveText('VESNIČKA');
		await expect(page.locator('body')).not.toHaveClass(/vs-over/);
		expect(await run(page, 'return [Game.S.gen, Game.S.won, Game.S.paused];')).toEqual([
			1,
			0,
			false,
		]);
		expect(errors).toEqual([]);
	},
);
