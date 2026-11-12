import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * HOLLOW SUN Act I (P1): every zone built from the Bible's dungeon generator must be playable –
 * walkable from the Lantern to the gate along its route, keys before their locks, enemies at the
 * area's levels – and the zones follow the Bible's main path to the Kiln Warden.
 */
const dir = fileURLToPath(new URL('../../../static/games/hollowsun/js/', import.meta.url));

interface Obj {
	kind: string;
	x: number;
	z: number;
	done: boolean;
	key?: string;
}
interface Zone {
	id: string;
	lv: number[];
	ok: boolean;
	rooms: { kind: string }[];
	spawns: { L: number; type: string }[];
	objs: Obj[];
	keys: [string, number, number][];
	route: { x: number; z: number }[];
}
interface Event {
	t: string;
	next?: string | null;
}
interface State {
	zone: Zone;
	zoneDone: boolean;
	zoneKeys: Set<string>;
	enemies: unknown[];
	events: Event[];
	t: number;
	player: { x: number; z: number; invuln: boolean; hp: number; hpMax: number };
	checkpoint: { x: number; z: number };
	deaths: number;
}
interface World {
	ACT1: string[];
	buildZone(id: string): Zone;
	next(id: string): string | null;
	area(id: string): { links: string[]; enemies: string[]; lv: number[] } | undefined;
}
interface Sim {
	create(opts: Record<string, unknown>): State;
	step(s: State, inp: unknown): State;
}

function load(): { W: World; HSim: Sim } {
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
	return { W: ctx.HSWorld as World, HSim: ctx.HSim as Sim };
}
const { W, HSim } = load();
const zones = W.ACT1.filter((id) => id !== 'a1_kiln_heart');

describe('HOLLOW SUN Act I zones', () => {
	it('follow the Bible main path to the Heart of the Kiln', () => {
		for (let i = 0; i < W.ACT1.length - 1; i++) {
			const a = W.ACT1[i] ?? '';
			expect(W.area(a)?.links, a).toContain(W.ACT1[i + 1]);
			expect(W.next(a)).toBe(W.ACT1[i + 1]);
		}
		expect(W.ACT1.at(-1)).toBe('a1_kiln_heart');
	});

	it.each(zones)('%s: generator passes, levels and enemies follow the area', (id) => {
		const z = W.buildZone(id);
		const a = W.area(id);
		expect(z.ok).toBe(true);
		expect(z).toEqual(W.buildZone(id)); // deterministic
		for (const s of z.spawns) {
			expect(s.L).toBeGreaterThanOrEqual(a?.lv[0] ?? 0);
			expect(s.L).toBeLessThanOrEqual(a?.lv[1] ?? 0);
		}
		const kinds = z.objs.map((o) => o.kind);
		expect(kinds.filter((k) => k === 'lantern')).toHaveLength(1);
		expect(kinds.filter((k) => k === 'gate')).toHaveLength(1);
		expect(kinds.filter((k) => k === 'key')).toHaveLength(z.keys.length);
	});

	it.each(zones)('%s: walking the route picks up the keys and reaches the gate', (id) => {
		const s = HSim.create({
			mode: 'act1',
			zone: id,
			seed: 'walk',
			char: { level: 12, xp: 0, alloc: {} },
		});
		s.enemies.length = 0;
		s.player.invuln = true;
		const R = s.zone.route;
		let i = 0;
		let done: Event | undefined;
		for (let tick = 0; tick < 30 * 60 * 6 && !done; tick++) {
			const p = s.player;
			while (i < R.length - 1 && Math.hypot((R[i]?.x ?? 0) - p.x, (R[i]?.z ?? 0) - p.z) < 1) i++;
			const t = R[i] ?? { x: p.x, z: p.z };
			HSim.step(s, { move: [t.x - p.x, t.z - p.z] });
			done = s.events.find((e) => e.t === 'zonedone');
		}
		expect(done?.next).toBe(W.next(id));
		expect(s.zoneKeys.size).toBe(s.zone.keys.length);
	});

	it('death in a zone respawns at the last Lantern without ending the run', () => {
		const s = HSim.create({
			mode: 'act1',
			zone: 'a1_ashfields',
			seed: 'death',
			char: { level: 1, xp: 0, alloc: {} },
		});
		// a woken Thrall right next to the player
		const e = s.enemies[0] as { x: number; z: number; awake: boolean };
		e.awake = true;
		e.x = s.player.x + 1.2;
		e.z = s.player.z;
		for (let i = 0; i < 30 * 60 * 3 && s.deaths === 0; i++) {
			s.player.hp = Math.min(s.player.hp, 1);
			HSim.step(s, {});
		}
		expect(s.deaths).toBeGreaterThan(0);
		expect(s.player.hp).toBe(s.player.hpMax);
		expect(Math.hypot(s.player.x - s.checkpoint.x, s.player.z - s.checkpoint.z)).toBeLessThan(2);
	});
});
