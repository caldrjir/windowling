// HOLLOW SUN: headless průchod celou kampaní Act I (P1 v Bible: „E2E playthrough bot (headless)“, „Telemetrie TTK vs tabulka“).
// Bot jde po trase zóny, bojuje s tím, kdo ho dožene (střelce a Acolyty do 10 m honí), sbírá loot a gold, nasazuje lepší
// výbavu (Cleave DPS × EHP), rozděluje body a bere pasivy. Pro každý krok vypíše čas, level, zabití, smrti, gold, zásahy
// na zabití Thralla úrovně oblasti (Bible: 2–4) a kolik zásahů nepřítele postava vydrží (Bible: ≥ 20).
//   pnpm --filter @windowling/web hollowsun:playthrough [seed] [krok,krok…]
// Bot je měřidlo, ne hráč: neuhýbá mechanikám bosse a ve vedlejších místnostech nechává nepřátele za rohem.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const dir = fileURLToPath(new URL('../static/games/hollowsun/js/', import.meta.url));
const seed = process.argv[2] || 'playthrough';
const only = process.argv[3];
const ctx = { console, Math, JSON, Object, Array, Set, Map, String, Number };
ctx.window = ctx;
createContext(ctx);
for (const f of ['data', 'core', 'dungeon', 'world', 'sim'])
	runInContext(readFileSync(dir + f + '.js', 'utf8'), ctx, { filename: f + '.js' });
const { HS, HSim: H, HSWorld: W } = ctx;
const len = Math.hypot;

const PASSIVES = ['ak_p1', 'ak_p3', 'ak_p2', 'ak_p4', 'ak_p5'];
function score(s, items) {
	const ch = HS.calcChar(s.L, items, s.char.alloc);
	const sk = s.skills.ak_cleave;
	const h = HS.computeHit(sk.sk, sk.sl, ch, HS.refEnemy(s.L, 'en_thrall'));
	return (h.dps * ch.S.hp) / (1 - ch.S.dr) / (1 - ch.S.evade);
}
function manage(s) {
	if (s.char.points > 0) H.invCommand(s, { autoAlloc: true });
	for (const id of PASSIVES) while (H.invCommand(s, { passive: id }));
	for (let pass = 0; pass < 3; pass++) {
		let best = null;
		let bv = score(s, H.equipped(s));
		s.gear.inv.forEach((it, i) => {
			if (H.canEquip(s, it)) return;
			const slot = H.slotFor(s, it);
			if (!slot) return;
			const eq = Object.assign({}, s.gear.eq, { [slot]: it });
			if (slot === 'main' && HS.get(it.base).hands === 2) delete eq.off;
			const v = score(s, Object.values(eq).filter(Boolean));
			if (v > bv * 1.001) {
				bv = v;
				best = i;
			}
		});
		if (best == null) break;
		H.invCommand(s, { equip: best });
	}
	while (s.gear.inv.length > 30) H.invCommand(s, { discard: 0 });
}
// přímá průchozí cesta (po 0,5 m)
const clear = (s, ax, az, bx, bz) => {
	if (!s.zone) return true;
	const n = Math.ceil(len(bx - ax, bz - az) / 0.5);
	for (let i = 1; i <= n; i++) {
		const k = i / n;
		if (!W.walkable(s.zone, ax + (bx - ax) * k, az + (bz - az) * k, 0.4, s.zoneKeys)) return false;
	}
	return true;
};
function bot() {
	const skip = new Set();
	let tgt = null;
	let tgtT = 0;
	let last = [0, 0];
	let still = 0;
	return (s) => {
		const p = s.player;
		still = len(p.x - last[0], p.z - last[1]) < 0.02 ? still + 1 : 0;
		last = [p.x, p.z];
		if (tgt && (still > 60 || ++tgtT > 30 * 8)) {
			skip.add(tgt);
			tgt = null;
		}
		const loot = [...s.drops, ...s.coins];
		const awake = s.enemies.some(
			(e) => !e.dead && (e.awake || !s.zone) && len(e.x - p.x, e.z - p.z) < 9,
		);
		if (!awake && !tgt) {
			let d = null;
			let dd = 12;
			for (const x of loot) {
				const k = len(x.x - p.x, x.z - p.z);
				if (k < dd && !skip.has('o' + x.id) && clear(s, p.x, p.z, x.x, x.z)) {
					dd = k;
					d = x;
				}
			}
			if (d) {
				tgt = 'o' + d.id;
				tgtT = 0;
			}
		}
		if (tgt) {
			const o = loot.find((x) => 'o' + x.id === tgt);
			if (o) return o.item ? { pickup: o.id } : { move: [o.x - p.x, o.z - p.z] };
			tgt = null;
		}
		if (still > 45) {
			still = 0;
			const a = (s.tick * 2.39996) % (Math.PI * 2);
			return { move: [Math.cos(a), Math.sin(a)] };
		}
		if (!s.zone) return H.autopilot(s);
		const near = s.enemies.filter((e) => {
			if (e.dead || !e.awake) return false;
			const d = len(e.x - p.x, e.z - p.z);
			return (
				d < 3.5 ||
				((e.type === 'en_acolyte' || e.type === 'en_bowman') &&
					d < 10 &&
					clear(s, p.x, p.z, e.x, e.z))
			);
		});
		const keep = s.enemies;
		s.enemies = near;
		const inp = H.autopilot(s);
		s.enemies = keep;
		return inp;
	};
}

const steps = only ? only.split(',') : W.ACT1;
const rows = [];
let save = { char: null, gear: null, gold: 0, seen: [] };
for (const step of steps) {
	const boss = step === 'a1_kiln_heart';
	const s = H.create({
		mode: boss ? 'boss' : 'act1',
		zone: boss ? undefined : step,
		seed: seed + '-' + step,
		char: save.char || undefined,
		gear: save.gear || undefined,
		gold: save.gold,
		needTalk: boss ? [] : W.needTalk(step, save.seen),
		loot: true,
	});
	const L0 = s.L;
	let toll = '';
	if (step === 'a1_tollgate') {
		if (H.invCommand(s, { pay: 500 })) toll = 'paid';
		else {
			H.champion(s);
			toll = 'champion';
		}
	}
	manage(s);
	const play = bot();
	let done = false;
	let ticks = 0;
	const cap = 30 * 60 * (boss ? 8 : 30);
	for (; ticks < cap && !done; ticks++) {
		H.step(s, play(s));
		for (const e of s.events) {
			if (e.t === 'zonedone') done = true;
			if (e.t === 'levelup' || e.t === 'pickup') manage(s);
			if (e.t === 'npc')
				save.seen.push(
					...W.STORY.filter((x) => x.on === 'npc' && x.npc === e.npc && x.step === step).map(
						(x) => x.q + '/' + x.at,
					),
				);
		}
		if (boss && (s.won || s.over)) done = true;
		if (ticks % 150 === 0) manage(s);
	}
	const Lm = boss ? 12 : Math.round((s.zone.lv[0] + s.zone.lv[1]) / 2);
	const sk = s.skills.ak_cleave;
	const thrall = HS.refEnemy(Lm, 'en_thrall');
	const h = HS.computeHit(sk.sk, sk.sl, s.ch, thrall);
	rows.push({
		step,
		done: done && !s.over && !(boss && !s.won),
		min: +(ticks / 30 / 60).toFixed(1),
		level: L0 + '→' + s.L,
		kills: s.kills,
		deaths: s.deaths || (s.over ? 1 : 0),
		gold: s.gold,
		hitsToKill: +(thrall.hp / (h.perHit || 1)).toFixed(1),
		hitsSurvived: Math.round(
			s.ch.S.hp / (HS.F.enemyDmg(Lm, 1) * (1 - HS.F.armorDR(s.ch.S.armor, Lm))),
		),
		bossS: boss ? Math.round(s.boss.t) : '',
		toll,
	});
	save = {
		char: JSON.parse(JSON.stringify(s.char)),
		gear: JSON.parse(JSON.stringify(s.gear)),
		gold: s.gold,
		seen: save.seen,
	};
}
console.table(rows);
console.log('total minutes', rows.reduce((a, b) => a + b.min, 0).toFixed(1));
