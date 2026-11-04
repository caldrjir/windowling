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
	calcChar(level: number, items: Item[]): Char;
	refEnemy(level: number, id: string): unknown;
	skill(id: string): { req: number };
	computeHit(sk: unknown, sl: number, ch: Char, en: unknown): Hit;
	F: { maxSkillLevel(level: number, req: number): number };
	describe(item: Item): { name: string; lines: unknown[] };
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
	player: { x: number; z: number; hp: number; hpMax: number; invuln: boolean };
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
	sanitizeGear(g: unknown, level: number): Gear;
	INV_MAX: number;
}

function loadAll(): { HS: Core; HSim: Sim } {
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
	for (const f of ['data', 'core', 'sim'])
		runInContext(readFileSync(dir + f + '.js', 'utf8'), ctx, { filename: f + '.js' });
	return { HS: ctx.HS as Core, HSim: ctx.HSim as Sim };
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
		expect(a.lootN).toBe(a.kills);
		// normal enemies: 10 % (BAL.dropChance.normal); a wide band for one seeded run
		const rate = a.drops.length / a.kills;
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
		const s = run('loot-equip', 300);
		expect(s.drops.length).toBeGreaterThan(0);
		for (const d of s.drops.slice()) {
			s.player.x = d.x;
			s.player.z = d.z;
			HSim.step(s, { pickup: d.id });
		}
		expect(s.drops).toHaveLength(0);
		const armor0 = s.ch.S.armor ?? 0;
		let equipped = 0;
		for (let i = s.gear.inv.length - 1; i >= 0; i--)
			if (HSim.invCommand(s, { equip: i })) equipped++;
		expect(equipped).toBeGreaterThan(0);
		expect(s.ch.S.armor).not.toBe(armor0);
		const slot = Object.keys(s.gear.eq).find((k) => k !== 'main');
		expect(slot).toBeDefined();
		const n = s.gear.inv.length;
		expect(HSim.invCommand(s, { unequip: slot })).toBe(true);
		expect(s.gear.inv).toHaveLength(n + 1);
		expect(HSim.invCommand(s, { unequip: 'main' })).toBe(false);
		expect(s.player.hp).toBeLessThanOrEqual(s.player.hpMax);
	});

	it('enforces class, level and two-handed rules', () => {
		const s = HSim.create({ mode: 'arena', seed: 'rules' });
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
		expect(v2).toMatchObject({ v: 2, gear: null, sinceU: 0, bestWave: 4, kills: 30 });
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
