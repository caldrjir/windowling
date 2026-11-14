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
	area: string;
	floor: number;
	floors: number;
	quest: string | null;
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
	id?: string;
	xp?: number;
	item?: { base: string; rar: string } | null;
	to?: string;
}
interface State {
	zone: Zone;
	zoneDone: boolean;
	zoneKeys: Set<string>;
	enemies: { id: number; type: string; x: number; z: number; hp: number; dead: boolean }[];
	events: Event[];
	gallowsKey: boolean;
	gear: { inv: { base: string; rar: string }[] };
	char: { level: number; xp: number };
	objs: (Obj & { to?: string })[];
	t: number;
	player: { x: number; z: number; invuln: boolean; hp: number; hpMax: number };
	checkpoint: { x: number; z: number };
	deaths: number;
}
interface World {
	ACT1: string[];
	buildZone(id: string): Zone;
	next(id: string): string | null;
	area(
		id: string,
	): { id: string; links: string[]; enemies: string[]; lv: number[]; type: string } | undefined;
	areaOf(step: string): string;
	SIDE: Record<string, { from: string; need: string; drop: string; chance: number }>;
}
interface Sim {
	create(opts: Record<string, unknown>): State;
	step(s: State, inp: unknown): State;
}

function load(): { W: World; HSim: Sim; HS: HSCore } {
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
	return { W: ctx.HSWorld as World, HSim: ctx.HSim as Sim, HS: ctx.HS as HSCore };
}
interface HSCore {
	rng(seed: string): () => number;
	D: {
		quests: { id: string; area: string; rewards: { xp: number } }[];
		whispers: { id: string; area: string }[];
	};
}
const { W, HSim, HS } = load();
const zones = [...W.ACT1.filter((id) => id !== 'a1_kiln_heart'), ...Object.keys(W.SIDE)];

describe('HOLLOW SUN Act I zones', () => {
	it('follow the Bible main quests to the Heart of the Kiln', () => {
		const areas = W.ACT1.map((x) => W.areaOf(x));
		// q1_01 Ashfields, q1_02 Chapel crypt, q1_03 Tollgate, q1_04 Heart of the Kiln
		const order = ['q1_01', 'q1_02', 'q1_03', 'q1_04'].map((q) =>
			areas.indexOf(HS.D.quests.find((x) => x.id === q)?.area ?? ''),
		);
		for (const i of order) expect(i).toBeGreaterThanOrEqual(0);
		expect([...order].sort((a, b) => a - b)).toEqual(order);
		// each new area borders one already visited (walk there, or by Lantern back to it)
		for (let i = 1; i < areas.length; i++) {
			expect(W.next(W.ACT1[i - 1] ?? '')).toBe(W.ACT1[i]);
			const b = areas[i] ?? '';
			if (b === areas[i - 1]) continue;
			const seen = areas.slice(0, i);
			expect(
				W.area(b)?.links.some((l) => seen.includes(l)),
				b,
			).toBe(true);
		}
		expect(W.ACT1.at(-1)).toBe('a1_kiln_heart');
		// the crypt has 2 floors (Bible: two floors); secret areas lead back where they open
		expect(W.ACT1.filter((x) => W.areaOf(x) === 'a1_chapel_crypt')).toHaveLength(2);
		for (const [id, sd] of Object.entries(W.SIDE)) {
			expect(W.area(id)?.type).toBe('secret');
			expect(W.area(id)?.links).toContain(sd.from);
			expect(W.next(id)).toBe(sd.from);
		}
	});

	it.each(zones)('%s: generator passes, levels and enemies follow the area', (id) => {
		const z = W.buildZone(id);
		const a = W.area(id);
		expect(z.ok).toBe(true);
		expect(z).toEqual(W.buildZone(id)); // deterministic
		for (const s of z.spawns) {
			expect(s.L).toBeGreaterThanOrEqual(a?.lv[0] ?? 0);
			expect(s.L).toBeLessThanOrEqual(a?.lv[1] ?? 0);
			expect(a?.enemies).toContain(s.type); // all six Act I types, the Kiln Acolyte included
		}
		const kinds = z.objs.map((o) => o.kind);
		expect(kinds.filter((k) => k === 'lantern')).toHaveLength(1);
		expect(kinds.filter((k) => k === 'gate')).toHaveLength(1);
		expect(kinds.filter((k) => k === 'key')).toHaveLength(z.keys.length);
		// whispers of the area on its last floor; the secret area's unique chest; the entrance to it
		const wh = HS.D.whispers.filter((w) => w.area === z.area).length;
		expect(kinds.filter((k) => k === 'whisper')).toHaveLength(z.floor === z.floors ? wh : 0);
		const unique = z.objs.some(
			(o) => o.kind === 'chest' && (o as Obj & { unique?: boolean }).unique,
		);
		expect(unique).toBe(a?.type === 'secret');
		const sides = Object.values(W.SIDE).filter((sd) => sd.from === z.area);
		expect(kinds.filter((k) => k === 'side')).toHaveLength(sides.length);
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
		const e = s.enemies[0] as unknown as { x: number; z: number; awake: boolean };
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

	const walk = (s: State, until: (s: State) => boolean) => {
		const R = s.zone.route;
		let i = 0;
		for (let tick = 0; tick < 30 * 60 * 6 && !until(s); tick++) {
			const p = s.player;
			while (i < R.length - 1 && Math.hypot((R[i]?.x ?? 0) - p.x, (R[i]?.z ?? 0) - p.z) < 1) i++;
			const t = R[i] ?? { x: p.x, z: p.z };
			HSim.step(s, { move: [t.x - p.x, t.z - p.z] });
		}
	};

	it('the second crypt floor completes Chapel of Embers: quest XP and a magic ring', () => {
		const s = HSim.create({
			mode: 'act1',
			zone: 'a1_chapel_crypt:2',
			seed: 'quest',
			char: { level: 1, xp: 0, alloc: {} },
		});
		s.enemies.length = 0;
		s.player.invuln = true;
		let quest: Event | undefined;
		walk(s, (st) => {
			quest = quest ?? st.events.find((e) => e.t === 'quest');
			return !!quest;
		});
		expect(quest?.id).toBe('q1_02');
		expect(quest?.xp).toBe(HS.D.quests.find((q) => q.id === 'q1_02')?.rewards.xp);
		expect(quest?.item?.rar).toBe('magic');
		expect(s.gear.inv.some((it) => it.base === quest?.item?.base)).toBe(true);
		expect(s.char.level).toBeGreaterThan(1);
	});

	it('Gallows Hill opens only with the Rusty Gallows Key, which a Smoldering Brute may drop', () => {
		const make = (key: boolean) => {
			const s = HSim.create({
				mode: 'act1',
				zone: 'a1_charcoal_woods',
				seed: 'gallows',
				gallowsKey: key,
				char: { level: 12, xp: 0, alloc: {} },
			});
			s.player.invuln = true;
			return s;
		};
		for (const key of [false, true]) {
			const s = make(key);
			s.enemies.length = 0;
			const door = s.objs.find((o) => o.kind === 'side');
			if (!door) throw new Error('no entrance to Gallows Hill');
			s.player.x = door.x;
			s.player.z = door.z + 1;
			HSim.step(s, {});
			expect(s.events.map((e) => e.t)).toContain(key ? 'side' : 'sidelocked');
			if (key) expect(s.events.find((e) => e.t === 'side')?.to).toBe('a1_gallows');
		}
		// the key drop has its own seeded roll per brute (4 %): a lucky and an unlucky brute
		const s = make(false);
		const gk = W.SIDE.a1_gallows;
		const roll = (id: number) => HS.rng('gallows#gallows#a1_charcoal_woods#' + id)();
		const brutes = s.enemies.filter((e) => e.type === gk?.drop);
		const lucky = brutes.find((e) => roll(e.id) < (gk?.chance ?? 0));
		const unlucky = brutes.find((e) => roll(e.id) >= (gk?.chance ?? 0));
		if (!lucky || !unlucky) throw new Error('no lucky or unlucky brute for this seed');
		for (const [e, drops] of [
			[unlucky, false],
			[lucky, true],
		] as const) {
			s.enemies = [e];
			e.hp = 1;
			s.player.x = e.x + 1.4;
			s.player.z = e.z;
			const ev: string[] = [];
			for (let i = 0; i < 60 && !e.dead; i++) {
				HSim.step(s, { hold: true, aim: [e.x, e.z] });
				ev.push(...s.events.map((x) => x.t));
			}
			expect(e.dead).toBe(true);
			expect(ev.includes('gallowskey')).toBe(drops);
		}
		expect(s.gallowsKey).toBe(true);
	});
});
