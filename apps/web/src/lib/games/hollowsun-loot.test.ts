import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import fixtures from './hollowsun.loot.fixtures.json';

/**
 * HOLLOW SUN (P1 loot): the game generates and evaluates items exactly like the Game Design Bible.
 * The fixtures come from the Bible's own `G.genItem`, `G.rollRarity`, `G.itemMods` and
 * `G.calcChar`/`G.computeHit` with gear; the same seed must give the same item in the game.
 */
const dir = fileURLToPath(new URL('../../../static/games/hollowsun/js/', import.meta.url));

type Item = Record<string, unknown>;
interface Rng {
	(): number;
}
interface Hit {
	final: number;
	perHit: number;
	dot: number;
	critChance: number;
	eCrit: number;
	hitChance: number;
	actTime: number;
	cd: number;
	cost: number;
	dps: number;
}
interface Char {
	S: Record<string, unknown>;
	weapon: { avg: number; min: number; max: number; aps: number };
}
interface Core {
	rng(seed: string): Rng;
	genItem(r: Rng, ilvl: number, cls: string | null, forceRar: string | null, slot?: string): Item;
	rollRarity(r: Rng, mf: number, type: string): string;
	itemMods(item: Item): Record<string, number>;
	calcChar(
		level: number,
		items: Item[],
		alloc?: Record<string, number>,
		extra?: Record<string, number>,
	): Char & { A: Record<string, number> };
	refEnemy(
		level: number,
		id: string,
	): { hp: number; armor: number; eva: number; res: Record<string, number> };
	skill(id: string): { req: number };
	computeHit(sk: unknown, sl: number, ch: Char, en: unknown): Hit;
	F: {
		maxSkillLevel(level: number, req: number): number;
		xpToNext(level: number): number;
		monsterXp(level: number, mul: number): number;
		xpPenalty(pL: number, mL: number): number;
		passivePoints(level: number): number;
		respecPoint(level: number): number;
	};
	CRAFT_COST: Record<string, (ilvl: number, n?: number) => Record<string, number>>;
	D: {
		passives: { id: string; mx: number; req: number; stat: string; v: number }[];
		econ: {
			goldMin: number;
			goldMax: number;
			sell: Record<string, number>;
			goldChance: Record<string, number>;
			emberChance: Record<string, number>;
		};
		craft: { id: string }[];
	};
	bulwarkBarrier(ch: Char, sl: number): number;
	describe(item: Item): { name: string; lines: unknown[] };
}

interface CharSave {
	level: number;
	xp: number;
	alloc: Record<string, number>;
	points: number;
	passives: Record<string, number>;
}
interface Drop {
	id: number;
	x: number;
	z: number;
	item: Item;
}
interface Gear {
	eq: Record<string, Item | undefined>;
	inv: Item[];
}
interface SimState {
	kills: number;
	over: boolean;
	lootN: number;
	drops: Drop[];
	gear: Gear;
	L: number;
	wave: number;
	char: CharSave;
	skills: Record<string, { on: boolean; sl: number; cd: number }>;
	enemies: {
		L: number;
		type: string;
		dead: boolean;
		x: number;
		z: number;
		brand: number;
		weak: number;
	}[];
	player: {
		x: number;
		z: number;
		hp: number;
		hpMax: number;
		res: number;
		invuln: boolean;
		barrier: number;
		bulwark: number;
		face: number;
	};
	ch: { S: Record<string, number> };
	events: { t: string; why?: string }[];
}
interface Sim {
	create(opts: Record<string, unknown>): SimState;
	step(s: SimState, input: unknown): SimState;
	autopilot(s: SimState): unknown;
	invCommand(s: SimState, cmd: Record<string, unknown>): boolean;
	canEquip(s: SimState, item: Item): string | null;
	migrateSave(save: Record<string, unknown>): Record<string, unknown>;
	sanitizeChar(c: unknown): CharSave;
	monsterLevel(s: SimState): number;
	sanitizeGear(g: unknown, level: number): Gear;
	sanitizePassives(p: unknown, level: number): Record<string, number>;
	INV_MAX: number;
}

interface WorldApi {
	walkable(z: unknown, x: number, y: number, m: number, keys: Set<string>): boolean;
}
function loadAll(): { HS: Core; HSim: Sim; W: WorldApi } {
	const ctx: Record<string, unknown> = {
		console,
		Math,
		JSON,
		Object,
		Array,
		Set,
		Map,
		String,
		Number,
	};
	ctx.window = ctx;
	createContext(ctx);
	for (const f of ['data', 'core', 'dungeon', 'world', 'sim'])
		runInContext(readFileSync(dir + f + '.js', 'utf8'), ctx, { filename: f + '.js' });
	return { HS: ctx.HS as Core, HSim: ctx.HSim as Sim, W: ctx.HSWorld as WorldApi };
}
const load = (): Core => loadAll().HS;
/** Plain JSON copy: objects from the vm context have another realm's prototypes. */
const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe('HOLLOW SUN loot = Game Design Bible', () => {
	const HS = load();

	it.each(fixtures.items)('genItem $seed (ilvl $ilvl, $forceRar)', (row) => {
		const item = HS.genItem(HS.rng(row.seed), row.ilvl, row.cls, row.forceRar);
		expect(plain(item)).toEqual(row.item);
		const mods = HS.itemMods(item);
		for (const [k, v] of Object.entries(row.mods)) expect(mods[k], k).toBeCloseTo(v, 9);
		expect(Object.keys(mods).sort()).toEqual(Object.keys(row.mods).sort());
		expect(HS.describe(item).name.length).toBeGreaterThan(0);
	});

	it('rollRarity draws the same sequence', () => {
		for (const row of fixtures.rarity) {
			const r = HS.rng(row.seed);
			expect(
				Array.from({ length: row.out.length }, () => HS.rollRarity(r, row.mf, row.type)),
			).toEqual(row.out);
		}
	});

	it.each(fixtures.gear)('character with gear at L$level', (row) => {
		const ch = HS.calcChar(row.level, row.items as Item[]);
		for (const [k, v] of Object.entries(row.S)) {
			if (k === 'inc') continue;
			expect(Number(ch.S[k]), k).toBeCloseTo(Number(v), 6);
		}
		const inc = ch.S.inc as Record<string, number>;
		for (const [k, v] of Object.entries(row.S.inc)) expect(inc[k], 'inc.' + k).toBeCloseTo(v, 9);
		expect(ch.weapon.avg).toBeCloseTo(row.weapon.avg, 9);
		expect([ch.weapon.min, ch.weapon.max, ch.weapon.aps]).toEqual([
			row.weapon.min,
			row.weapon.max,
			row.weapon.aps,
		]);
		for (const h of row.hits) {
			const sk = HS.skill(h.skill);
			const got = HS.computeHit(
				sk,
				HS.F.maxSkillLevel(row.level, sk.req),
				ch,
				HS.refEnemy(row.level, h.enemy),
			);
			for (const k of [
				'perHit',
				'dot',
				'critChance',
				'eCrit',
				'hitChance',
				'actTime',
				'dps',
			] as const)
				expect(got[k], `${h.skill} ${h.enemy} ${k}`).toBeCloseTo(h[k], 6);
			for (const k of ['final', 'cd', 'cost'] as const)
				expect(got[k], `${h.skill} ${h.enemy} ${k}`).toBe(h[k]);
		}
	});
});

describe('HOLLOW SUN loot in the simulation', () => {
	const { HS, HSim } = loadAll();
	const run = (seed: string, seconds: number) => {
		const s = HSim.create({ mode: 'arena', seed, invuln: true });
		for (let i = 0; i < seconds * 30 && !s.over; i++) HSim.step(s, HSim.autopilot(s));
		return s;
	};

	it('drops are deterministic for a seed and follow the drop chance', () => {
		const a = run('loot-sim', 240);
		const b = run('loot-sim', 240);
		expect(JSON.stringify(a.drops)).toBe(JSON.stringify(b.drops));
		// every kill rolls loot except Thralls raised by a Kiln Acolyte (no loot)
		expect(a.lootN).toBeLessThanOrEqual(a.kills);
		expect(a.lootN).toBeGreaterThan(a.kills * 0.7);
		// normal enemies: 10 % (BAL.dropChance.normal); a wide band for one seeded run
		const rate = a.drops.length / a.lootN;
		expect(rate).toBeGreaterThan(0.05);
		expect(rate).toBeLessThan(0.2);
		for (const d of a.drops) expect(HS.describe(d.item).name.length).toBeGreaterThan(0);
	});

	it('the benchmark drops nothing', () => {
		const s = HSim.create({ mode: 'bench', seed: 'b', invuln: true });
		for (let i = 0; i < 30 * 30; i++) HSim.step(s, HSim.autopilot(s));
		expect(s.kills).toBeGreaterThan(0);
		expect(s.drops).toHaveLength(0);
	});

	it('picking up, equipping and taking off change the character', () => {
		const s = run('loot-equip-2', 300);
		expect(s.drops.length).toBeGreaterThan(0);
		for (const d of s.drops.slice()) {
			s.player.x = d.x;
			s.player.z = d.z;
			HSim.step(s, { pickup: d.id });
		}
		expect(s.drops).toHaveLength(0);
		const stats0 = JSON.stringify(s.ch.S);
		let equipped = 0;
		for (let i = s.gear.inv.length - 1; i >= 0; i--)
			if (HSim.invCommand(s, { equip: i })) equipped++;
		expect(equipped).toBeGreaterThan(0);
		expect(JSON.stringify(s.ch.S)).not.toBe(stats0);
		const slot = Object.keys(s.gear.eq).find((k) => k !== 'main');
		expect(slot).toBeDefined();
		const n = s.gear.inv.length;
		expect(HSim.invCommand(s, { unequip: slot })).toBe(true);
		expect(s.gear.inv).toHaveLength(n + 1);
		expect(HSim.invCommand(s, { unequip: 'main' })).toBe(false);
		expect(s.player.hp).toBeLessThanOrEqual(s.player.hpMax);
	});

	it('enforces class, level and two-handed rules', () => {
		const s = HSim.create({ mode: 'arena', seed: 'rules', level: 8 });
		const wand = { base: 'wb_wand', tier: 0, affixes: [], rar: 'common' };
		const highTier = { base: 'wb_mace', tier: 2, affixes: [], rar: 'common' };
		expect(HSim.canEquip(s, wand)).toBe('class');
		expect(HSim.canEquip(s, highTier)).toBe('level');
		// a two-handed weapon in the main hand blocks the off hand
		s.gear.eq.main = { base: 'wb_greataxe', tier: 0, affixes: [], rar: 'common' };
		s.gear.inv.push({ base: 'wb_buckler', tier: 0, affixes: [], rar: 'common' });
		expect(HSim.canEquip(s, { base: 'wb_buckler', tier: 0 })).toBeNull();
		expect(HSim.invCommand(s, { equip: s.gear.inv.length - 1 })).toBe(false);
		expect(s.events.some((e) => e.why === 'twohand')).toBe(true);
		expect(s.gear.eq.off).toBeUndefined();
	});

	it('migrates a P0 save and drops unknown items', () => {
		const v1 = { v: 1, bestWave: 4, kills: 30, clickMove: true };
		const v2 = HSim.migrateSave(v1);
		expect(v2).toMatchObject({ v: 4, gear: null, sinceU: 0, bestWave: 4, kills: 30, act1: null });
		// P0 players had a fixed level 8 character; they keep it so their gear stays usable
		expect(v2.char).toMatchObject({ level: 8, xp: 0, points: 0 });
		expect(HSim.migrateSave({ v: 1 }).char).toBeNull();
		expect(HSim.migrateSave(v2)).toEqual(v2);
		const g = HSim.sanitizeGear(
			{
				eq: { helm: { base: 'nope', tier: 0, affixes: [] } },
				inv: [
					{ base: 'wb_mace', tier: 0, affixes: [['af_unknown', 0, 0.5]] },
					{ base: 'wb_mace', tier: 0, affixes: [], rar: 'common' },
				],
			},
			8,
		);
		expect(Object.keys(g.eq)).toEqual(['main']);
		expect(g.inv).toHaveLength(1);
		expect(HSim.sanitizeGear('garbage', 8).eq.main).toBeDefined();
	});
});

describe('HOLLOW SUN character progression = Game Design Bible', () => {
	const { HS } = loadAll();
	const P = fixtures.progress;

	it('XP curve, monster XP and the level-gap penalty', () => {
		P.xpToNext.forEach((v, i) => expect(HS.F.xpToNext(i + 1), `L${i + 1}`).toBe(v));
		for (const row of P.monsterXp) {
			const L = Number(row[0]);
			expect([HS.F.monsterXp(L, 1), HS.F.monsterXp(L, 2.6)]).toEqual([row[1], row[2]]);
		}
		for (const row of P.penalty)
			expect(HS.F.xpPenalty(Number(row[0]), Number(row[1]))).toBeCloseTo(Number(row[2]), 9);
	});

	it.each(P.chars)('L$level with alloc $alloc and $extra', (row) => {
		const items = [{ base: 'wb_mace', tier: row.level >= 18 ? 1 : 0, affixes: [], rar: 'common' }];
		const ch = HS.calcChar(
			row.level,
			items,
			row.alloc as Record<string, number>,
			row.extra as Record<string, number>,
		);
		for (const [k, v] of Object.entries(row.S)) expect(Number(ch.S[k]), k).toBeCloseTo(v, 9);
		expect(plain(ch.A)).toEqual(row.A);
		expect(HS.bulwarkBarrier(ch, HS.F.maxSkillLevel(row.level, 8))).toBeCloseTo(row.barrier, 9);
		for (const h of row.hits) {
			const sk = HS.skill(h.skill);
			const got = HS.computeHit(sk, h.sl, ch, HS.refEnemy(row.level, 'en_thrall'));
			for (const k of ['perHit', 'dot', 'actTime', 'dps'] as const)
				expect(got[k], `${h.skill} ${k}`).toBeCloseTo(h[k], 6);
			for (const k of ['final', 'cd', 'cost'] as const)
				expect(got[k], `${h.skill} ${k}`).toBe(h[k]);
		}
	});
});

describe('HOLLOW SUN progression in the simulation', () => {
	const { HSim } = loadAll();

	it('a new character starts at level 1, levels up and unlocks skills', () => {
		const s = HSim.create({ mode: 'arena', seed: 'prog', invuln: true });
		expect(s.L).toBe(1);
		expect(s.skills.ak_cleave?.on).toBe(true);
		expect(s.skills.ak_slam?.on).toBe(false);
		const ups: number[] = [];
		for (let i = 0; i < 30 * 600 && s.L < 6; i++) {
			HSim.step(s, HSim.autopilot(s));
			for (const e of s.events) if (e.t === 'levelup') ups.push(s.L);
		}
		expect(s.L).toBeGreaterThanOrEqual(6);
		expect(ups[0]).toBe(2);
		expect(s.char.points).toBe((s.L - 1) * 3);
		expect(s.skills.ak_slam?.on).toBe(true);
		// enemies follow the arena rule: player level - 1 + every second wave, capped at Act I's end
		expect(HSim.monsterLevel(s)).toBe(
			Math.max(1, Math.min(12, s.L - 1 + Math.floor((s.wave - 1) / 2))),
		);
		expect(s.player.hp).toBeLessThanOrEqual(s.player.hpMax);
	});

	it('attribute points change the character', () => {
		const s = HSim.create({ mode: 'arena', seed: 'pts', char: { level: 6, xp: 0, alloc: {} } });
		expect(s.char.points).toBe(15);
		const hp = s.player.hpMax;
		expect(HSim.invCommand(s, { alloc: 'vit' })).toBe(true);
		expect(s.player.hpMax).toBeGreaterThan(hp);
		expect(HSim.invCommand(s, { autoAlloc: true })).toBe(true);
		expect(s.char.points).toBe(0);
		expect(HSim.invCommand(s, { alloc: 'str' })).toBe(false);
		expect(Object.values(s.char.alloc).reduce((a, b) => a + b, 0)).toBe(15);
	});

	it('Bulwark shields, Brand marks, Cry of the Pyre weakens and pays Cinders', () => {
		const s = HSim.create({ mode: 'arena', seed: 'skills', char: { level: 10, xp: 0, alloc: {} } });
		const p = s.player;
		p.res = 100;
		HSim.step(s, { cast: 'ak_bulwark' });
		for (let i = 0; i < 15; i++) HSim.step(s, {});
		expect(p.barrier).toBeGreaterThan(0);
		expect(p.bulwark).toBeGreaterThan(0);
		const e = s.enemies[0];
		if (!e) throw new Error('no enemy');
		e.x = p.x + 1.5;
		e.z = p.z;
		// Brand Strike can miss (hit chance < 100 %): strike until the brand sticks
		for (let i = 0; i < 30 * 10 && !(e.brand > 0) && !e.dead; i++) {
			e.x = p.x + 1.5;
			e.z = p.z;
			HSim.step(s, { cast: 'ak_brand', aim: [e.x, e.z] });
		}
		expect(e.brand > 0 || e.dead).toBe(true);
		p.res = 0;
		for (let i = 0; i < 40 && s.skills.ak_warcry?.cd === 0; i++)
			HSim.step(s, { cast: 'ak_warcry' });
		for (let i = 0; i < 30; i++) HSim.step(s, {});
		expect(p.res).toBeGreaterThanOrEqual(40 - 1);
		expect(s.enemies.some((x) => !x.dead && x.weak > 0)).toBe(true);
	});

	it('sanitises a saved character', () => {
		expect(HSim.sanitizeChar(null)).toMatchObject({ level: 1, xp: 0, points: 0 });
		const c = HSim.sanitizeChar({ level: 5, xp: 999999, alloc: { str: 100, dex: 'x' } });
		expect(c.level).toBe(5);
		expect(c.alloc).toEqual({ str: 12 });
		expect(c.points).toBe(0);
		expect(c.xp).toBeLessThan(3340);
	});
});

describe('HOLLOW SUN Kiln Warden = Game Design Bible', () => {
	const HS = load() as Core & {
		F: { enemyDmg(level: number, mul: number): number };
		D: { enemies: { id: string; dmgMul: number }[] };
	};
	const B = fixtures.boss;

	it('boss and wisp stats', () => {
		for (const r of B.enemies) {
			const e = HS.refEnemy(r.level, r.id);
			expect([e.hp, e.armor, e.eva]).toEqual([r.hp, r.armor, r.eva]);
			expect(plain(e.res)).toEqual(r.res);
			const dm = HS.D.enemies.find((x) => x.id === r.id)?.dmgMul ?? 0;
			expect(HS.F.enemyDmg(r.level, dm)).toBe(r.dmg);
		}
	});

	it('skills against the boss, also with phase 3 armour (-30 %)', () => {
		for (const h of B.hits) {
			const ch = HS.calcChar(h.level, [{ base: 'wb_mace', tier: 0, affixes: [], rar: 'common' }]);
			const en = HS.refEnemy(h.vs ? h.level : 12, h.vs ?? 'bo_kiln');
			if (h.armor70) en.armor = Math.round(en.armor * 0.7);
			const got = HS.computeHit(HS.skill(h.skill), h.sl, ch, en);
			for (const k of ['perHit', 'dot', 'hitChance', 'dps'] as const)
				expect(got[k], `${h.skill} L${h.level} ${h.vs ?? 'boss'} ${k}`).toBeCloseTo(h[k], 6);
			expect(got.final).toBe(h.final);
		}
	});
});

describe('HOLLOW SUN Kiln Warden in the simulation', () => {
	const { HSim } = loadAll();
	interface Boss {
		id: number;
		phase: number;
		invuln: number;
		enrage: boolean;
		t: number;
		ground: number;
		act: { n: string; t: number; tele: number; safe?: number[][] } | null;
		kilns: { x: number; z: number; alive: boolean; q: number }[];
	}
	type BossState = SimState & {
		boss: Boss;
		won: boolean;
		bossKills: number;
		stats: { taken: number };
	};
	type E = SimState['enemies'][number] & {
		id: number;
		hp: number;
		hpMax: number;
		armorMul?: number;
		atk: unknown;
	};
	const make = (bossKills = 0) =>
		HSim.create({
			mode: 'boss',
			seed: 'kiln',
			char: { level: 12, xp: 0, alloc: {} },
			bossKills,
		}) as BossState;
	const bossOf = (s: BossState) => s.enemies.find((e) => (e as E).id === s.boss.id) as E;

	it('phases follow HP: 60 % brings 3 s of immunity, 25 % strips armour', () => {
		const s = make();
		s.player.invuln = true;
		const b = bossOf(s);
		b.hp = b.hpMax * 0.59;
		HSim.step(s, {});
		expect(s.boss.phase).toBe(2);
		expect(s.boss.invuln).toBeGreaterThan(2.9);
		const hp = b.hp;
		s.player.x = b.x;
		s.player.z = b.z + 2.5;
		for (let i = 0; i < 30; i++) HSim.step(s, { hold: true, aim: [b.x, b.z] });
		expect(b.hp).toBe(hp);
		b.hp = b.hpMax * 0.24;
		for (let i = 0; i < 30 * 4; i++) HSim.step(s, {});
		expect(s.boss.phase).toBe(3);
		expect(b.armorMul).toBe(0.7);
	});

	it('Quench Slam spares the steam circles only', () => {
		for (const inSafe of [true, false]) {
			const s = make();
			const b = bossOf(s);
			b.hp = b.hpMax * 0.2;
			for (let i = 0; i < 30 * 60 && s.boss.act?.n !== 'Quench Slam'; i++) {
				s.player.hp = s.player.hpMax;
				HSim.step(s, {});
			}
			const act = s.boss.act;
			if (!act?.safe) throw new Error('no Quench Slam');
			const safe = act.safe[0] ?? [0, 0];
			s.player.x = inSafe ? (safe[0] ?? 0) : 50;
			s.player.z = inSafe ? (safe[1] ?? 0) : 50;
			const taken = s.stats.taken;
			let quench: { safe?: boolean } | undefined;
			for (let i = 0; i < 60 && s.boss.act; i++) {
				if (inSafe) {
					s.player.x = safe[0] ?? 0;
					s.player.z = safe[1] ?? 0;
				}
				HSim.step(s, {});
				quench =
					quench ?? (s.events.find((e) => e.t === 'quench') as { safe?: boolean } | undefined);
			}
			expect(quench?.safe).toBe(inSafe);
			if (!inSafe) expect(s.stats.taken).toBeGreaterThan(taken);
		}
	});

	it('standing by a burning kiln quenches it; enrage comes at 240 s', () => {
		const s = make();
		s.player.invuln = true;
		const b = bossOf(s);
		b.hp = b.hpMax * 0.5;
		HSim.step(s, {});
		const k = s.boss.kilns[0];
		if (!k) throw new Error('no kiln');
		for (let i = 0; i < 30 * 2 && k.alive; i++) {
			s.player.x = k.x * 0.85;
			s.player.z = k.z * 0.85;
			HSim.step(s, {});
		}
		expect(k.alive).toBe(false);
		s.boss.t = 239.9;
		for (let i = 0; i < 5; i++) HSim.step(s, {});
		expect(s.boss.enrage).toBe(true);
	});

	it('the boss drops 3 magic + 2 rare and a unique on the first kill, and pays the quest XP', () => {
		const first = make(0);
		const xp0 = first.char.xp;
		const b = bossOf(first);
		b.hp = 1;
		first.player.x = b.x;
		first.player.z = b.z + 2.6;
		for (let i = 0; i < 30 * 20 && !first.won; i++)
			HSim.step(first, { hold: true, aim: [b.x, b.z] });
		expect(first.won).toBe(true);
		const rars = first.drops.map((d) => String(d.item.rar)).sort();
		expect(rars).toEqual(['magic', 'magic', 'magic', 'rare', 'rare', 'unique']);
		expect(first.char.level > 12 || first.char.xp > xp0 + 6000).toBe(true);
		const again = make(1);
		const b2 = bossOf(again);
		b2.hp = 1;
		again.player.x = b2.x;
		again.player.z = b2.z + 2.6;
		for (let i = 0; i < 30 * 20 && !again.won; i++)
			HSim.step(again, { hold: true, aim: [b2.x, b2.z] });
		expect(again.drops.length).toBeGreaterThanOrEqual(5);
		expect(again.drops.filter((d) => d.item.rar === 'magic')).toHaveLength(3);
	});
});

describe('HOLLOW SUN Act I enemies in the simulation', () => {
	const { HSim, W } = loadAll();
	const arena = (level: number) =>
		HSim.create({
			mode: 'arena',
			seed: 'act1-' + level,
			invuln: true,
			char: { level, xp: 0, alloc: {} },
		});
	const types = (s: SimState) => new Set(s.enemies.map((e) => e.type));

	it('waves bring hound packs from wave 2 and bowmen from their Bible level', () => {
		const low = arena(1);
		expect(types(low).has('en_hound')).toBe(false);
		expect(types(low).has('en_bowman')).toBe(false);
		const s = arena(6);
		for (let i = 0; i < 30 * 600 && s.wave < 2; i++) HSim.step(s, HSim.autopilot(s));
		const hounds = s.enemies.filter((e) => e.type === 'en_hound').length;
		expect(hounds).toBeGreaterThanOrEqual(3);
		expect(hounds).toBeLessThanOrEqual(5);
		expect(types(s).has('en_bowman')).toBe(true);
	});

	it('a hound leaps along its telegraph; a bowman keeps 12-16 m and shoots arrows', () => {
		const s = arena(6);
		for (let i = 0; i < 30 * 600 && s.wave < 2; i++) HSim.step(s, HSim.autopilot(s));
		const p = s.player;
		const ev = new Set<string>();
		for (let i = 0; i < 30 * 30; i++) {
			HSim.step(s, {});
			for (const e of s.events) ev.add(e.t);
		}
		expect(ev.has('leap')).toBe(true);
		expect(ev.has('shoot')).toBe(true);
		const bow = s.enemies.filter((e) => !e.dead && e.type === 'en_bowman');
		for (const b of bow) expect(Math.hypot(b.x - p.x, b.z - p.z)).toBeGreaterThan(9);
	});

	it('pillars stop arrows', () => {
		const s = arena(6) as SimState & { proj: unknown[]; stats: { taken: number } };
		s.enemies.length = 0;
		const p = s.player;
		p.x = 7;
		p.z = -2;
		// an arrow flying from behind the pillar at (7, -6) towards the player
		s.proj.push({
			id: 999,
			by: 0,
			x: 7,
			z: -12,
			dx: 0,
			dz: 1,
			speed: 18,
			left: 20,
			mul: 1.1,
			fire: false,
		});
		const taken = s.stats.taken;
		for (let i = 0; i < 40; i++) HSim.step(s, {});
		expect(s.proj).toHaveLength(0);
		expect(s.stats.taken).toBe(taken);
	});

	// Kiln Acolyte (Bible: fireball 1.3×, raises 2 Thralls cd 12 s, wards an ally cd 10 s; weak to interrupts)
	interface Foe {
		L: number;
		brand: number;
		weak: number;
		id: number;
		type: string;
		x: number;
		z: number;
		hp: number;
		hpMax: number;
		dead: boolean;
		awake: boolean;
		ward?: number;
		summoned?: boolean;
		noLoot?: boolean;
		by?: number;
		atk: { def: { shape: string } } | null;
	}
	const kiln = () => {
		const s = HSim.create({
			mode: 'act1',
			zone: 'a1_kiln',
			seed: 'acolyte',
			char: { level: 10, xp: 0, alloc: {} },
		}) as unknown as Omit<SimState, 'enemies'> & {
			enemies: Foe[];
			stats: { interrupts?: number };
		};
		const a = s.enemies.find((e) => e.type === 'en_acolyte');
		const b = s.enemies.find((e) => e.type === 'en_brute');
		if (!a || !b) throw new Error('the Great Kiln has no acolyte or brute');
		// only the acolyte and a wounded brute next to it stay; the player 11 m away
		s.enemies = [a, b];
		a.awake = b.awake = true;
		b.x = a.x + 1.5;
		b.z = a.z;
		b.hp = Math.round(b.hpMax / 2);
		s.player.invuln = true;
		// the player 10 m away on open floor with a clear line to the acolyte
		const st = s as unknown as { zone: unknown; zoneKeys: Set<string> };
		const clear = (x: number, z: number) => {
			for (let k = 1; k <= 10; k++) {
				const t = k / 10;
				if (!W.walkable(st.zone, a.x + (x - a.x) * t, a.z + (z - a.z) * t, 0.5, st.zoneKeys))
					return false;
			}
			return true;
		};
		const spot = Array.from(
			{ length: 16 },
			(_, i) => [a.x + Math.cos(i / 2.546) * 10, a.z + Math.sin(i / 2.546) * 10] as const,
		).find(([x, z]) => clear(x, z));
		if (!spot) throw new Error('no open floor around the acolyte');
		[s.player.x, s.player.z] = spot;
		return { s, a, b };
	};

	it('a Kiln Acolyte wards a wounded ally, raises Thralls and throws fireballs', () => {
		const { s, a, b } = kiln();
		const ev = new Set<string>();
		let warded = 0;
		for (let i = 0; i < 30 * 15; i++) {
			HSim.step(s, {});
			for (const e of s.events) ev.add(e.t);
			warded = Math.max(warded, b.ward ?? 0);
		}
		expect(ev.has('ward')).toBe(true);
		expect(warded).toBe(Math.round(b.hpMax * 0.3));
		expect(ev.has('summon')).toBe(true);
		const raised = s.enemies.filter((e) => e.summoned && e.by === a.id);
		expect(raised.length).toBeGreaterThanOrEqual(2);
		expect(raised.filter((e) => !e.dead).length).toBeLessThanOrEqual(2);
		for (const t of raised) {
			expect(t.type).toBe('en_thrall');
			expect(t.noLoot).toBe(true);
		}
		expect(ev.has('shoot')).toBe(true);
	});

	it('hitting a casting Acolyte interrupts the spell; a ward absorbs damage first', () => {
		const { s, a, b } = kiln();
		s.enemies = [a, b];
		let cast = false;
		for (let i = 0; i < 30 * 12 && !cast; i++) {
			HSim.step(s, {});
			cast = !!a.atk && (a.atk.def.shape === 'summon' || a.atk.def.shape === 'ward');
		}
		expect(cast).toBe(true);
		s.player.x = a.x + 1.6;
		s.player.z = a.z;
		let interrupted = false;
		for (let i = 0; i < 30 && !interrupted; i++) {
			HSim.step(s, { hold: true, aim: [a.x, a.z] });
			interrupted = s.events.some((e) => e.t === 'interrupt');
		}
		expect(interrupted).toBe(true);
		expect(s.stats.interrupts).toBeGreaterThan(0);
		// a ward of 50 HP on a full-health brute: the first hits shave the ward, not HP
		b.hp = b.hpMax;
		b.ward = 50;
		s.player.x = b.x + 1.6;
		s.player.z = b.z;
		a.dead = true;
		for (let i = 0; i < 30 * 6 && (b.ward ?? 0) === 50; i++)
			HSim.step(s, { hold: true, aim: [b.x, b.z] });
		expect(b.ward ?? 0).toBeLessThan(50);
		if ((b.ward ?? 0) > 0) expect(b.hp).toBe(b.hpMax);
	});
});

describe('HOLLOW SUN dungeon generator = Game Design Bible', () => {
	const ctx: Record<string, unknown> = {
		console,
		Math,
		JSON,
		Object,
		Array,
		Set,
		Map,
		String,
		Number,
	};
	ctx.window = ctx;
	createContext(ctx);
	for (const f of ['data', 'core', 'dungeon'])
		runInContext(readFileSync(dir + f + '.js', 'utf8'), ctx, { filename: f + '.js' });
	const gen = (ctx.HS as { genDungeon(p: unknown): Record<string, unknown> }).genDungeon;

	it.each(fixtures.dungeon)('genDungeon $p.seed ($p.size, $p.floors floors)', (row) => {
		const d = gen(row.p);
		expect(plain(d.rooms)).toEqual(row.rooms);
		expect(plain(d.edges)).toEqual(row.edges);
		expect([d.bossOk, d.allOk, d.mainLen]).toEqual([row.bossOk, row.allOk, row.mainLen]);
		expect(plain(d.keys)).toEqual(row.keys);
	});
});

describe('HOLLOW SUN gold and passive skills = Game Design Bible', () => {
	const { HS, HSim } = loadAll();
	type GoldState = SimState & {
		gold: number;
		coins: { id: number; x: number; z: number; n: number }[];
		events: { t: string; gold?: number }[];
	};

	it('passive points and respec cost follow D04 and D13', () => {
		for (const [L, pts, respec] of fixtures.progress.passivePoints) {
			expect(HS.F.passivePoints(L ?? 1), 'L' + L).toBe(pts);
			expect(HS.F.respecPoint(L ?? 1), 'L' + L).toBe(respec);
		}
	});

	it('passives need points, their level and stay under the max rank; they change the character', () => {
		const s = HSim.create({
			mode: 'arena',
			seed: 'pas',
			char: { level: 6, xp: 0, alloc: {} },
		}) as GoldState;
		expect(s.char.passives).toEqual({});
		const hp = s.player.hpMax;
		for (let i = 0; i < 5; i++) expect(HSim.invCommand(s, { passive: 'ak_p1' })).toBe(true);
		expect(HSim.invCommand(s, { passive: 'ak_p1' })).toBe(false); // max rank 5
		expect(s.player.hpMax).toBeGreaterThan(hp);
		expect(HSim.invCommand(s, { passive: 'ak_p4' })).toBe(false); // from L10
		expect(HSim.invCommand(s, { passive: 'ak_p3' })).toBe(true); // L6: 6 points, 5 + 1
		expect(HSim.invCommand(s, { passive: 'ak_p2' })).toBe(false); // no points left
		// respec is free up to L12 (D13) and returns every point
		expect(HSim.invCommand(s, { respecPassives: true })).toBe(true);
		expect(s.char.passives).toEqual({});
		expect(s.player.hpMax).toBe(hp);
		// a save cannot hold more than the points of its level, ranks above max or locked passives
		const clean = HSim.sanitizePassives({ ak_p1: 9, ak_p4: 2, ak_p3: 5, bogus: 3 }, 6);
		expect(clean).toEqual({ ak_p1: 5, ak_p3: 1 });
	});

	it('gold drops by the loot tables, is picked up on the way and pays the merchant and the toll', () => {
		const E = HS.D.econ;
		expect(E.goldChance.lt_normal).toBe(0.06);
		expect(E.goldChance.lt_elite).toBe(0.2);
		const s = HSim.create({
			mode: 'arena',
			seed: 'gold',
			invuln: true,
			char: { level: 6, xp: 0, alloc: {} },
		}) as GoldState;
		let coins: GoldState['coins'] = [];
		for (let i = 0; i < 30 * 300 && coins.length < 3; i++) {
			HSim.step(s, HSim.autopilot(s));
			coins = s.coins;
		}
		expect(coins.length).toBeGreaterThan(0);
		for (const c of coins) {
			expect(c.n % 1).toBe(0);
			expect(c.n).toBeGreaterThanOrEqual(E.goldMin);
		}
		const before = s.gold;
		const c = coins[0];
		if (!c) throw new Error('no coins');
		s.player.x = c.x;
		s.player.z = c.z;
		HSim.step(s, {});
		expect(s.gold).toBe(before + c.n);
		// selling only in Cinderhold: Common 1 / Magic 3 / Rare 10 / Unique 25 x L
		s.gear.inv.push(HS.genItem(HS.rng('sell'), 6, 'ak', 'rare'));
		expect(HSim.invCommand(s, { sell: 0 })).toBe(false);
		const town = HSim.create({
			mode: 'act1',
			zone: 'a1_cinderhold',
			seed: 'sell',
			gold: 10,
			char: { level: 6, xp: 0, alloc: {} },
		}) as GoldState;
		town.gear.inv.push(HS.genItem(HS.rng('sell'), 6, 'ak', 'rare'));
		expect(HSim.invCommand(town, { sell: town.gear.inv.length - 1 })).toBe(true);
		expect(town.gold).toBe(10 + (E.sell.rare ?? 0) * 6);
		// the toll: 500 gold or nothing happens
		expect(HSim.invCommand(town, { pay: 500 })).toBe(false);
		town.gold = 620;
		expect(HSim.invCommand(town, { pay: 500 })).toBe(true);
		expect(town.gold).toBe(120);
	});
});

describe('HOLLOW SUN forge (Brannoc) = Game Design Bible', () => {
	const { HS, HSim } = loadAll();
	type Forge = SimState & {
		gold: number;
		cur: Record<string, number>;
		events: { t: string; why?: string; gain?: Record<string, number> }[];
	};
	const town = (gold = 2000, cur: Record<string, number> = { ember: 20, dust: 30 }) =>
		HSim.create({
			mode: 'act1',
			zone: 'a1_cinderhold#2',
			seed: 'forge',
			gold,
			cur,
			char: { level: 8, xp: 0, alloc: {} },
		}) as Forge;
	const affs = (it: Item | undefined): [string, number, number][] =>
		(it?.affixes ?? []) as [string, number, number][];
	const item = (rar: string, seed = 'f') =>
		Object.assign(HS.genItem(HS.rng(seed), 8, 'ak', rar), { ilvl: 8 });

	it('costs follow G.CRAFT_COST and the Act I smith operations are exported', () => {
		expect(HS.D.craft.map((c) => c.id)).toEqual([
			'cr_salvage',
			'cr_reforge_m',
			'cr_imbue',
			'cr_reforge_r',
			'cr_temper',
			'cr_unravel',
		]);
		for (const row of fixtures.progress.craftCost) {
			const L = row.ilvl;
			expect(HS.CRAFT_COST.cr_reforge_m?.(L)).toEqual(row.reforge_m);
			expect(HS.CRAFT_COST.cr_imbue?.(L)).toEqual(row.imbue);
			row.reforge_r.forEach((c, n) =>
				expect(HS.CRAFT_COST.cr_reforge_r?.(L, [0, 1, 3][n])).toEqual(c),
			);
			expect(HS.CRAFT_COST.cr_temper?.(L)).toEqual(row.temper);
			expect(HS.CRAFT_COST.cr_unravel?.(L)).toEqual(row.unravel);
		}
		expect(HS.D.econ.emberChance.lt_normal).toBe(0.02);
		expect(HS.D.econ.emberChance.lt_elite).toBe(0.1);
	});

	it('the forge works only in Cinderhold and charges its price', () => {
		const field = HSim.create({
			mode: 'arena',
			seed: 'f',
			gold: 999,
			cur: { ember: 9 },
			char: { level: 8, xp: 0, alloc: {} },
		}) as Forge;
		field.gear.inv.push(item('magic'));
		expect(HSim.invCommand(field, { craft: 'cr_reforge_m', inv: 0 })).toBe(false);
		const s = town(100, { ember: 2 });
		s.gear.inv.push(item('magic'));
		expect(HSim.invCommand(s, { craft: 'cr_reforge_m', inv: 0 })).toBe(false); // 3 Ember needed
		expect(s.events.at(-1)?.why).toBe('cost');
		s.cur.ember = 3;
		const before = JSON.stringify(s.gear.inv[0]);
		expect(HSim.invCommand(s, { craft: 'cr_reforge_m', inv: 0 })).toBe(true);
		expect(s.cur.ember).toBe(0);
		expect(s.gold).toBe(100 - 5 * 8);
		const after = s.gear.inv[0];
		expect(after?.rar).toBe('magic');
		expect(affs(after).length).toBeGreaterThanOrEqual(1);
		expect(affs(after).length).toBeLessThanOrEqual(2);
		expect(JSON.stringify(after)).not.toBe(before);
	});

	it('salvage, imbue, rare reforge, temper and unravel follow the Bible rules', () => {
		const s = town();
		// salvage: Common 0-1 Ember, Magic 1-2 Ember, Rare 2-4 Dust; never an equipped item
		s.gear.inv.push(item('rare', 'sv'));
		const dust = s.cur.dust ?? 0;
		expect(HSim.invCommand(s, { craft: 'cr_salvage', inv: s.gear.inv.length - 1 })).toBe(true);
		const got = (s.cur.dust ?? 0) - dust;
		expect(got).toBeGreaterThanOrEqual(2);
		expect(got).toBeLessThanOrEqual(4);
		expect(HSim.invCommand(s, { craft: 'cr_salvage', eq: 'main' })).toBe(false);
		// imbue: Magic with 2 affixes becomes Rare with 3-4
		let magic = item('magic', 'im');
		for (let k = 0; affs(magic).length !== 2 && k < 50; k++) magic = item('magic', 'im' + k);
		s.gear.inv.push(magic);
		expect(HSim.invCommand(s, { craft: 'cr_imbue', inv: s.gear.inv.length - 1 })).toBe(true);
		const imb = s.gear.inv.at(-1);
		expect(imb?.rar).toBe('rare');
		expect(affs(imb).length).toBeGreaterThanOrEqual(3);
		expect(affs(imb).length).toBeLessThanOrEqual(4);
		// rare reforge: the price grows by 15 % per earlier reforge
		const i = s.gear.inv.length - 1;
		const g0 = s.gold;
		HSim.invCommand(s, { craft: 'cr_reforge_r', inv: i });
		const g1 = s.gold;
		HSim.invCommand(s, { craft: 'cr_reforge_r', inv: i });
		expect(g0 - g1).toBe(Math.round(20 * 8));
		expect(g1 - s.gold).toBe(Math.round(20 * 8 * 1.15));
		// temper keeps the affixes and their tiers, rerolls the values
		const ids = affs(s.gear.inv[i]).map((a) => String(a[0]) + a[1]);
		expect(HSim.invCommand(s, { craft: 'cr_temper', inv: i })).toBe(true);
		expect(affs(s.gear.inv[i]).map((a) => String(a[0]) + a[1])).toEqual(ids);
		// unravel only on a Rare with at least 4 affixes, removes one
		let r4 = item('rare', 'un');
		for (let k = 0; affs(r4).length < 4 && k < 50; k++) r4 = item('rare', 'un' + k);
		s.gear.inv.push(r4);
		const n = affs(r4).length;
		expect(HSim.invCommand(s, { craft: 'cr_unravel', inv: s.gear.inv.length - 1 })).toBe(true);
		expect(affs(s.gear.inv.at(-1))).toHaveLength(n - 1);
		s.gear.inv.push(item('magic', 'x'));
		expect(HSim.invCommand(s, { craft: 'cr_unravel', inv: s.gear.inv.length - 1 })).toBe(false);
	});

	it('Ember Shards drop by the loot tables and are picked up like gold', () => {
		const s = HSim.create({
			mode: 'arena',
			seed: 'ember',
			invuln: true,
			char: { level: 6, xp: 0, alloc: {} },
		}) as Forge & {
			coins: { x: number; z: number; n: number; cur?: string }[];
		};
		// the autopilot may walk over a shard itself; either way it ends up in the currencies
		let ember: { x: number; z: number; n: number; cur?: string } | undefined;
		for (let i = 0; i < 30 * 900 && !ember && !(s.cur.ember ?? 0); i++) {
			HSim.step(s, HSim.autopilot(s));
			ember = s.coins.find((c) => c.cur === 'ember');
		}
		if (ember) {
			s.player.x = ember.x;
			s.player.z = ember.z;
			HSim.step(s, {});
		}
		expect(s.cur.ember).toBeGreaterThanOrEqual(1);
	});
});
