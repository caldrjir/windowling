import { expect, test, type Page } from '@playwright/test';

// DRIFTWOOD itself: the 3D game runs in a software WebGL renderer (SwiftShader). Pointer lock
// and real-time play are not possible headless, so the test drives the game through its own
// objects (Game, Player, UI, ...), which are globals of the page's classic scripts.
test.use({
	locale: 'cs-CZ',
	launchOptions: {
		channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
		executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
		args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
	},
});

/** Runs a snippet of game code in the page and returns its JSON result. */
const run = <T>(page: Page, code: string): Promise<T> =>
	page.evaluate(`(() => { ${code} })()`) as Promise<T>;

test('DRIFTWOOD: quests, crafting, chest, garden, fishing, the bow, ruins and saving', async ({
	page,
}, info) => {
	test.skip(info.project.name !== 'desktop-chromium', 'DRIFTWOOD is a desktop game');
	test.setTimeout(180_000);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));

	await page.goto('/games/driftwood/index.html');
	await expect(page.locator('#screen .menu')).toBeVisible({ timeout: 30_000 });

	// A new island: the first quest, the daily tasks and the places to explore.
	const start = await run<{
		quest: string;
		daily: number;
		ruins: number;
		crates: number;
		bottles: number;
	}>(
		page,
		`localStorage.removeItem('driftwood.save.v1'); SAVE = loadSave();
		Game.startNew('normal', '4242'); Game.locked = true; Player.locked = true; UI.hud();
		const n = k => Sites.list.filter(s => s.kind === k).length;
		return { quest: Story.current().id, daily: G.flags.daily.tasks.length, ruins: n('ruin'), crates: n('crate'), bottles: n('bottle') };`,
	);
	expect(start).toEqual({ quest: 'gather', daily: 3, ruins: 3, crates: 5, bottles: 5 });
	await expect(page.locator('#objective')).toContainText('Kapitola 1');

	// Crafting at the stations, then a chest and a garden bed placed in the world.
	const built = await run<{
		items: string[];
		chest: string[];
		planted: boolean;
		berries: number;
		quest: string;
	}>(
		page,
		`const P = Player.P, env = Game.env, idx = o => RECIPES.findIndex(r => r.out === o);
		for (const [id, n] of [['wood', 50], ['wood', 50], ['stone', 40], ['fiber', 40], ['hide', 6], ['berries', 4]]) Inv.add(id, n);
		World.addStructure('workbench', P.x - 3, P.z, 0); World.addStructure('campfire', P.x + 3, P.z, 0);
		for (const o of ['stoneAxe', 'fishingRod', 'rope', 'rope', 'bow', 'chest', 'garden', 'waterskin']) UI.craft(idx(o));
		UI.craft(idx('arrow'), true);
		const place = id => { const i = Inv.slots.findIndex(s => s && s.id === id); Inv.swap(i, 0); P.sel = 0;
			for (let k = 0; k < 12 && !Player.ghostOk; k++) { P.yaw += 0.55; Player.updateGhost(Game.cam, env); }
			Player.place(env); Player.ghostOk = false; };
		place('chest'); place('garden');
		const ch = World.structures.find(s => s.type === 'chest'), ga = World.structures.find(s => s.type === 'garden');
		UI.openChest(ch); UI.clickSlot(Inv.slots.findIndex(s => s && s.id === 'stone')); UI.toggleInv(false, null, false);
		Player.tend(ga, env); const planted = !!ga.crop; G.day += 1; Player.tend(ga, env);
		Story.update();
		return { items: ['stoneAxe', 'fishingRod', 'bow', 'arrow', 'waterskin'].filter(id => Inv.count(id) > 0),
			chest: ch.items.filter(Boolean).map(s => s.id), planted, berries: Inv.count('berries'), quest: Story.current().id };`,
	);
	expect(built.items).toEqual(['stoneAxe', 'fishingRod', 'bow', 'arrow', 'waterskin']);
	expect(built.chest).toEqual(['stone']);
	expect(built.planted).toBe(true);
	expect(built.berries).toBeGreaterThanOrEqual(5);

	// Fishing: cast from the beach into the sea and strike on a bite.
	const fished = await run<{ cast: boolean; fish: number }>(
		page,
		`const P = Player.P, env = Game.env;
		const i = Inv.slots.findIndex(s => s && s.id === 'fishingRod'); Inv.swap(i, 1); P.sel = 1;
		const sp = P.spawn; let best = null;
		for (let a = 0; a < 6.28; a += 0.05) for (let d = 4; d < 30; d += 1) { const x = sp.x + Math.cos(a) * d, z = sp.z + Math.sin(a) * d;
			if (World.height(x, z) < -1.2 && !World.isFreshWater(x, z)) { if (!best || d < best.d) best = { x, z, d, a }; break; } }
		P.x = best.x - Math.cos(best.a) * 7; P.z = best.z - Math.sin(best.a) * 7; P.y = World.height(P.x, P.z);
		P.yaw = Math.atan2(-Math.cos(best.a), -Math.sin(best.a)); P.pitch = -0.45;
		CameraRig.place(Game.cam, P, false, 0.016, 0); Game.cam.updateMatrixWorld();
		let cast = false;
		for (let k = 0; k < 25 && !Inv.count('rawFish'); k++) { Player.cast(Game.cam, env); if (Player.fish) { cast = true; Player.fish.state = 'bite'; Player.strike(env); } }
		return { cast, fish: Inv.count('rawFish') };`,
	);
	expect(fished.cast).toBe(true);
	expect(fished.fish).toBeGreaterThan(0);

	// The bow: a full draw at a deer on open ground hits it; the kill leaves loot on the ground.
	const shot = await run<{ hit: boolean; dead: boolean; loot: string[] }>(
		page,
		`const P = Player.P, env = Game.env; Player.reel(false);
		const i = Inv.slots.findIndex(s => s && s.id === 'bow'); Inv.swap(i, 2); P.sel = 2;
		const r = mulberry32(7); let spot = null;
		for (let t = 0; t < 5000 && !spot; t++) { const x = (r() * 2 - 1) * 130, z = (r() * 2 - 1) * 130, h = World.height(x, z);
			if (h < 2.5 || h > 12) continue; let ok = true;
			for (let d = 0; d <= 8; d++) if (Math.abs(World.height(x + d, z) - h) > 0.5 || World.solidsNear(x + d, z).some(o => Math.hypot(o.x - x - d, o.z - z) < 1.5)) { ok = false; break; }
			if (ok) spot = { x, z }; }
		P.x = spot.x; P.z = spot.z; P.y = World.height(P.x, P.z); P.yaw = -Math.PI / 2;
		Animals.clear(); Drops.clear();
		const a = Animals.spawn('deer', P.x + 7, P.z);
		P.pitch = Math.atan2(a.y + 0.45 * a.d.size + 0.1 - (P.y + EYE), 7);
		CameraRig.place(Game.cam, P, false, 0.016, 0); Game.cam.updateMatrixWorld();
		let hit = false;
		for (let k = 0; k < 4 && !a.dead; k++) { a.x = P.x + 7; a.z = P.z; a.y = World.height(a.x, a.z); const hp = a.hp;
			P.draw = 1; Player.mouse.l = false; Player.updateBow(0.016, Game.cam, env);
			for (let j = 0; j < 40; j++) Projectiles.update(0.01); if (a.hp < hp) hit = true; }
		return { hit, dead: a.dead, loot: Drops.list.map(d => d.item.id) };`,
	);
	expect(shot.hit).toBe(true);
	expect(shot.dead).toBe(true);
	expect(shot.loot).toContain('rawMeat');

	// Old Grey, a shipwreck crate and the ruins with a map fragment and a carving to read.
	const explored = await run<{ bears: number; fur: number; pieces: number; notes: number }>(
		page,
		`const b = Animals.spawn('bear', World.lair.x + 2, World.lair.z + 2); Animals.hurt(b, 999); Game.killed(b, 'melee');
		Sites.interact(Sites.list.find(s => s.kind === 'crate'));
		Sites.interact(Sites.list.find(s => s.kind === 'ruin'));
		return { bears: G.run.bears, fur: Inv.count('fur'), pieces: Inv.count('mapPiece'), notes: Object.keys(SAVE.notes).length };`,
	);
	expect(explored).toMatchObject({ bears: 1, pieces: 1, notes: 1 });
	expect(explored.fur).toBeGreaterThan(0);
	await expect(page.locator('#overlay .letter')).toBeVisible();

	// The journal, the map and the skills open as tabs of the backpack.
	await run(page, `UI.hideOverlay(); UI.openTab('journal');`);
	await expect(page.locator('#inv .chap')).toHaveCount(4);
	await run(page, `UI.openTab('map');`);
	await expect(page.locator('#mapCv')).toBeVisible();
	await run(page, `UI.openTab('skills');`);
	await expect(page.locator('#inv .skill')).toHaveCount(3);

	// Save, back to the menu and continue: the chest, the skills and the quests are kept.
	const reloaded = await run<{ chest: number; hunt: boolean; quests: boolean; pieces: number }>(
		page,
		`UI.toggleInv(false, null, false);
		const hunt = JSON.stringify(Player.P.skills.hunt), quests = Object.keys(G.flags.qd).length;
		Game.save(); Game.toMenu(); Game.continueGame(); Game.locked = true;
		const ch = World.structures.find(s => s.type === 'chest');
		return { chest: ch.items.filter(Boolean).length, hunt: hunt === JSON.stringify(Player.P.skills.hunt), quests: quests === Object.keys(G.flags.qd).length, pieces: Inv.count('mapPiece') };`,
	);
	expect(reloaded).toEqual({ chest: 1, hunt: true, quests: true, pieces: 1 });

	// Passing out in Normal mode leaves the backpack on the ground where you fell.
	const death = await run<{ had: number; inv: number; near: number }>(
		page,
		`const P = Player.P, had = Inv.slots.filter(Boolean).length; Game.die(); const x = P.x, z = P.z; Game.respawn(); Game.locked = true;
		return { had, inv: Inv.slots.filter(Boolean).length, near: Drops.list.filter(d => Math.hypot(d.x - x, d.z - z) < 6).length };`,
	);
	expect(death.inv).toBe(0);
	expect(death.near).toBe(death.had);

	// The way home: a raft, supplies for the crossing, set sail.
	const sail = await run<{ placed: boolean }>(
		page,
		`const P = Player.P; Inv.add('cookedFish', 3); Inv.add('waterskin', 1); Inv.slots.find(s => s && s.id === 'waterskin').ch = 4;
		Inv.add('raft', 1); const i = Inv.slots.findIndex(s => s && s.id === 'raft'); Inv.swap(i, 0); P.sel = 0;
		const sp = P.spawn; let best = null;
		for (let a = 0; a < 6.28; a += 0.05) for (let d = 3; d < 30; d += 0.5) { const x = sp.x + Math.cos(a) * d, z = sp.z + Math.sin(a) * d, h = World.height(x, z);
			if (h < -0.5 && h > -3.5) { if (!best || d < best.d) best = { x, z, d, a }; break; } }
		P.x = best.x - Math.cos(best.a) * 5; P.z = best.z - Math.sin(best.a) * 5; P.y = World.height(P.x, P.z); P.yaw = Math.atan2(-Math.cos(best.a), -Math.sin(best.a));
		Player.updateGhost(Game.cam, Game.env); const placed = Player.ghostOk; if (placed) Player.place(Game.env);
		return { placed };`,
	);
	expect(sail.placed).toBe(true);
	await page.locator('[data-act="escapeYes"]').click();
	await expect(page.locator('#overlay .end.win')).toBeVisible({ timeout: 20_000 });
	expect(await run<number>(page, 'return SAVE.stats.escapes;')).toBe(1);

	expect(errors).toEqual([]);
});
