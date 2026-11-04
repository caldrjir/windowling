import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import fixtures from './hollowsun.fixtures.json';

/**
 * HOLLOW SUN (P0 prototype): the game's combat core must compute exactly what the Game Design
 * Bible computes. The fixtures are exported from the Bible's own `computeHit`/`calcChar`; the
 * game's plain scripts are loaded here the way the browser loads them (classic scripts on `window`).
 */
const dir = fileURLToPath(new URL('../../../static/games/hollowsun/js/', import.meta.url));

interface Hit {
	perHit: number;
	final: number;
	dot: number;
	critChance: number;
	hitChance: number;
	actTime: number;
	cd: number;
	cost: number;
	dps: number;
}
interface Skill {
	id: string;
	req: number;
}
interface CharStats {
	S: Record<string, number>;
}
interface Enemy {
	hp: number;
	armor: number;
	eva: number;
}
interface Core {
	calcChar(level: number): CharStats;
	refEnemy(level: number, id: string): Enemy;
	skill(id: string): Skill;
	computeHit(sk: Skill, sl: number, ch: CharStats, en: Enemy): Hit;
	F: { maxSkillLevel(level: number, req: number): number };
}
interface SimEnemy {
	x: number;
	z: number;
	hp: number;
	dead: boolean;
}
interface SimState {
	t: number;
	wave: number;
	kills: number;
	over: boolean;
	player: { x: number; z: number; hp: number };
	enemies: SimEnemy[];
	stats: { hits: number; dmg: number };
}
interface Sim {
	create(opts: Record<string, unknown>): SimState;
	step(s: SimState, input: unknown): SimState;
	autopilot(s: SimState): unknown;
}

function load(): { HS: Core; HSim: Sim } {
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

interface Row {
	level: number;
	enemy?: string;
	skill?: string;
	player?: Record<string, number>;
	enemyStats?: Record<string, number>;
	[key: string]: unknown;
}
const rows = fixtures.rows as Row[];

describe('HOLLOW SUN combat core = Game Design Bible', () => {
	const { HS } = load();

	it.each(rows.filter((r) => r.skill))('$skill at L$level vs $enemy', (r) => {
		const sk = HS.skill(String(r.skill));
		const sl = HS.F.maxSkillLevel(r.level, sk.req);
		expect(sl).toBe(r.sl);
		const hit = HS.computeHit(sk, sl, HS.calcChar(r.level), HS.refEnemy(r.level, String(r.enemy)));
		for (const k of ['perHit', 'dot', 'critChance', 'hitChance', 'actTime', 'dps'] as const)
			expect(hit[k]).toBeCloseTo(Number(r[k]), 3);
		for (const k of ['final', 'cd', 'cost'] as const) expect(hit[k]).toBe(r[k]);
	});

	it('player and enemy stats match the Bible', () => {
		for (const r of rows) {
			if (r.player) {
				const S = HS.calcChar(r.level).S;
				for (const k of ['hp', 'armor', 'eva', 'acc', 'res', 'cinderOnHit'])
					expect(S[k]).toBe(r.player[k]);
				expect(S.dr).toBeCloseTo(Number(r.player.dr), 5);
			}
			if (r.enemyStats && r.enemy) {
				const e = HS.refEnemy(r.level, r.enemy);
				expect([e.hp, e.armor, e.eva]).toEqual([
					r.enemyStats.hp,
					r.enemyStats.armor,
					r.enemyStats.eva,
				]);
			}
		}
	});
});

describe('HOLLOW SUN simulation (30 Hz, seeded)', () => {
	const { HSim } = load();
	const play = (mode: string, seconds: number, seed: string) => {
		const s = HSim.create({ mode, seed, invuln: mode === 'bench' });
		for (let i = 0; i < seconds * 30 && !s.over; i++) HSim.step(s, HSim.autopilot(s));
		return s;
	};

	it('is deterministic for a seed and stays finite', () => {
		const a = play('arena', 90, 'test-1');
		const b = play('arena', 90, 'test-1');
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
		expect(a.wave).toBeGreaterThan(1);
		expect(a.kills).toBeGreaterThan(10);
		const finite = [
			a.player.x,
			a.player.z,
			a.player.hp,
			...a.enemies.flatMap((e) => [e.x, e.z, e.hp]),
		];
		expect(finite.every(Number.isFinite)).toBe(true);
	});

	it('the benchmark keeps 50 enemies alive and fighting', () => {
		const s = play('bench', 30, 'bench');
		expect(s.enemies.filter((e) => !e.dead).length + s.kills).toBeGreaterThanOrEqual(50);
		expect(s.stats.hits).toBeGreaterThan(0);
		expect(s.over).toBe(false);
	});
});
