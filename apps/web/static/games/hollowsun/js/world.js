'use strict';
// Echoes of the Hollow Sun – oblast Act I (P1). Zóna = rozložení z generátoru Bible (HS.genDungeon, 14 kroků)
// převedené na herní geometrii: místnosti a chodby jako osově zarovnané obdélníky (průchozí plocha), zámky
// a klíče, Lantern (checkpoint, D08), truhly, brána do další oblasti a nepřátelé z rozpočtu generátoru.
// Kampaň jde po hlavních questech Bible: Ashfields (q1_01) → Burnt Orchard → krypta Chapel of Embers, 2 patra (q1_02,
// z Ashfields přes Lantern) → Tollgate → Charcoal Woods (q1_03) → Great Kiln → Heart of the Kiln (q1_04, boss).
// Gallows Hill je tajná odbočka z Charcoal Woods (klíč z Brutů). Krok kampaně je id oblasti, další patro „id:2“.
// Čistá a deterministická funkce (seed = krok), testuje se v Node.
(function (root) {
  const HS = root.HS;
  const CELL = 18; // m mezi středy buněk mřížky generátoru
  const UNIT = 2.5; // m na jednotku rozměru místnosti v generátoru (3–5 j. → 7,5–12,5 m)
  const CORR = 4; // m šířka chodby
  // Cinderhold (hub) po Ashfields (q1_01 končí u jeho brány, Teodor zadá q1_02) a znovu po kryptě („id#2“: deník, kovárna)
  const ACT1 = ['a1_ashfields', 'a1_cinderhold', 'a1_burnt_orchard', 'a1_chapel_crypt', 'a1_chapel_crypt:2', 'a1_cinderhold#2', 'a1_tollgate', 'a1_charcoal_woods', 'a1_kiln', 'a1_kiln_heart'];
  // scény G.DIALOGS → spouštěče v kampani (prototyp): start kroku, NPC, zabití, boss, po bossovi.
  // bark = titulky bez pauzy (Bible: dialog nikdy neblokuje boj); fight = volba, po které přijde souboj se šampionem
  const STORY = [
    { q: 'q1_01', at: 'Probuzení v hrobě', on: 'start', step: 'a1_ashfields' },
    { q: 'q1_01', at: 'První ozvěna', on: 'kills', step: 'a1_ashfields', n: 5, bark: true },
    { q: 'q1_01', at: 'Brána Cinderholdu', on: 'start', step: 'a1_cinderhold' },
    { q: 'q1_02', at: 'Archiv v Cinderholdu', on: 'npc', npc: 'np_teodor', step: 'a1_cinderhold' },
    { q: 'q1_02', at: 'Krypta', on: 'start', step: 'a1_chapel_crypt:2', bark: true },
    { q: 'q1_02', at: 'Návrat s deníkem', on: 'npc', npc: 'np_teodor', step: 'a1_cinderhold#2' },
    { q: 'q1_04', at: 'Kovárna v Cinderholdu', on: 'npc', npc: 'np_brannoc', step: 'a1_cinderhold#2' },
    { q: 'q1_03', at: 'Ironbound Tollgate', on: 'start', step: 'a1_tollgate' },
    { q: 'q1_03', at: 'Volba: clo', on: 'start', step: 'a1_tollgate', fight: 1 },
    { q: 'q1_03', at: 'Charcoal Woods', on: 'start', step: 'a1_charcoal_woods', bark: true },
    { q: 'q1_04', at: 'Heart of the Kiln', on: 'boss', bark: true },
    { q: 'q1_04', at: 'Po souboji', on: 'victory' },
    { q: 'q1_04', at: 'Volba: Kiln Shard', on: 'victory' },
  ];
  // s kým je třeba v Cinderholdu promluvit, než pustí brána dál (NPC scény kroku, které hráč ještě neviděl)
  const needTalk = (step, seen) => STORY.filter((x) => x.on === 'npc' && x.step === step && !(seen || []).includes(x.q + '/' + x.at)).map((x) => x.npc);
  // tajné odbočky: odkud se vchází a co je potřeba (Bible: „Najít Rusty Gallows Key (drop: Smoldering Brute, 4 %)“)
  const SIDE = { a1_gallows: { from: 'a1_charcoal_woods', need: 'gallowsKey', drop: 'en_brute', chance: 0.04 } };
  // konec questu = konec kroku kampaně (q1_02 končí Archivním deníkem ve 2. patře, q1_03 průchodem Charcoal Woods)
  const QUEST_END = { a1_ashfields: 'q1_01', 'a1_chapel_crypt:2': 'q1_02', a1_charcoal_woods: 'q1_03' };
  // parametry generátoru pro zóny (prototyp; Bible je pro oblasti neudává): velikost, obtížnost, hustota, větve
  const ZONE_P = {
    a1_ashfields: { size: 'M', diff: 1, density: 1.25, side: 2, special: 1 },
    a1_burnt_orchard: { size: 'L', diff: 2, density: 1.5, side: 3, special: 1 },
    a1_tollgate: { size: 'L', diff: 3, density: 1.75, side: 3, special: 2 },
    a1_charcoal_woods: { size: 'L', diff: 4, density: 2, side: 4, special: 2 },
    a1_kiln: { size: 'L', diff: 5, density: 2, side: 4, special: 2 },
    // krypta: 2 patra (Bible: „procedurální, 2 patra“), level oblasti 4–6 rozdělený na patra
    a1_chapel_crypt: { size: 'M', diff: 3, density: 1.5, side: 2, special: 1, lv: [4, 5] },
    'a1_chapel_crypt:2': { size: 'M', diff: 3, density: 1.75, side: 2, special: 2, lv: [5, 6] },
    a1_gallows: { size: 'S', diff: 4, density: 1.5, side: 2, special: 0 },
  };
  const areaOf = (step) => String(step).split(/[:#]/)[0];
  const floorOf = (step) => Number(String(step).split('#')[0].split(':')[1] || 1);
  const floorsOf = (areaId) => ACT1.filter((x) => areaOf(x) === areaId && !x.includes('#')).length || 1;
  const area = (id) => HS.D.areas.find((a) => a.id === areaOf(id));
  const rect = (cx, cz, w, h) => ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - h / 2, z1: cz + h / 2 });
  const inRect = (r, x, z, m) => x >= r.x0 + m && x <= r.x1 - m && z >= r.z0 + m && z <= r.z1 - m;
  // všech 6 typů Act I z Bible (Thrall, Brute, Wisp, Hound, Bowman, Acolyte); neznámý typ by nahradil Thrall
  const KNOWN = ['en_thrall', 'en_brute', 'en_wisp', 'en_hound', 'en_bowman', 'en_acolyte'];
  const enemyPool = (a) => { const out = a.enemies.map((e) => (KNOWN.includes(e) ? e : 'en_thrall')); return out.length ? out : ['en_thrall']; };

  function buildZone(areaId) {
    const a = area(areaId); const P = ZONE_P[areaId]; const step = areaId; const aid = areaOf(step);
    if (a && a.type === 'town') return buildTown(step, a);
    if (!a || !P) throw new Error('Unknown zone ' + areaId);
    const prm = Object.assign({ seed: 'act1-' + areaId, theme: 'crypt', arena: 'pillars', floors: 1 }, P);
    const d = HS.genDungeon(prm); const r = HS.rng('act1-zone-' + areaId);
    const rooms = d.rooms.map((rm) => {
      const cx = rm.gx * CELL, cz = rm.gy * CELL; const w = rm.w * UNIT, h = rm.h * UNIT;
      return Object.assign(rect(cx, cz, w, h), { id: rm.id, kind: rm.kind, main: rm.main, depth: rm.depth, cx, cz, w, h, key: rm.key || null, chest: !!rm.chest, elite: !!rm.elite, enemies: rm.enemies });
    });
    // chodby: přímé mezi sousedy, jinak do L (vodorovně, pak svisle – jako schematická mapa v Bible)
    const corridors = [];
    for (const e of d.edges) {
      const A = rooms[e.a], B = rooms[e.b]; const segs = [];
      if (A.cz === B.cz) segs.push({ x0: Math.min(A.cx, B.cx), x1: Math.max(A.cx, B.cx), z0: A.cz - CORR / 2, z1: A.cz + CORR / 2 });
      else if (A.cx === B.cx) segs.push({ x0: A.cx - CORR / 2, x1: A.cx + CORR / 2, z0: Math.min(A.cz, B.cz), z1: Math.max(A.cz, B.cz) });
      else { segs.push({ x0: Math.min(A.cx, B.cx) - CORR / 2, x1: Math.max(A.cx, B.cx) + CORR / 2, z0: A.cz - CORR / 2, z1: A.cz + CORR / 2 }); segs.push({ x0: B.cx - CORR / 2, x1: B.cx + CORR / 2, z0: Math.min(A.cz, B.cz), z1: Math.max(A.cz, B.cz) }); }
      corridors.push({ a: e.a, b: e.b, main: e.main, lock: e.lock || null, segs, corner: A.cz === B.cz || A.cx === B.cx ? null : [B.cx, A.cz] });
    }
    const lv = P.lv || a.lv; const L0 = lv[0], L1 = lv[1]; const maxDepth = Math.max(1, ...rooms.map((x) => x.depth));
    const levelAt = (rm) => Math.round(L0 + ((L1 - L0) * rm.depth) / maxDepth);
    const pool = enemyPool(a); const spawns = [];
    for (const rm of rooms) {
      if (!rm.enemies) continue; const L = levelAt(rm);
      for (let i = 0; i < rm.enemies; i++) {
        const type = r.pick(pool); const m = 1.2;
        spawns.push({ room: rm.id, type, L, elite: rm.elite && i === 0, x: rm.x0 + m + r() * (rm.w - 2 * m), z: rm.z0 + m + r() * (rm.h - 2 * m) });
      }
    }
    const entrance = rooms[0]; const exit = rooms[d.mainLen - 1];
    const objs = [{ kind: 'lantern', x: entrance.cx, z: entrance.cz, room: 0 }, { kind: 'gate', x: exit.cx, z: exit.cz, room: exit.id }];
    for (const rm of rooms) {
      if (rm.chest) objs.push({ kind: 'chest', x: rm.cx + rm.w * 0.25, z: rm.cz, room: rm.id, L: levelAt(rm) });
      if (rm.key) objs.push({ kind: 'key', key: rm.key, x: rm.cx, z: rm.cz, room: rm.id });
    }
    // šepot (G.WHISPERS) ve vedlejší místnosti – u více pater v posledním; vchod do tajné odbočky v jiné
    const free = rooms.filter((x) => !x.main && !x.key).sort((p, q) => q.depth - p.depth || p.id - q.id);
    const spot = () => free.shift() || rooms[Math.floor(d.mainLen / 2)];
    const floors = floorsOf(aid), floor = floorOf(step);
    if (floor === floors) for (const w of HS.D.whispers.filter((x) => x.area === aid)) { const rm = spot(); objs.push({ kind: 'whisper', wh: w.id, x: rm.cx - rm.w * 0.25, z: rm.cz, room: rm.id }); }
    for (const sid in SIDE) if (SIDE[sid].from === aid) { const rm = spot(); objs.push({ kind: 'side', to: sid, need: SIDE[sid].need, x: rm.cx, z: rm.cz - rm.h * 0.25, room: rm.id }); }
    // tajná oblast: unikátní truhla v poslední místnosti (Bible: „lore scéna + unikátní truhla“)
    if (a.type === 'secret') objs.push({ kind: 'chest', unique: true, x: exit.cx - exit.w * 0.25, z: exit.cz, room: exit.id, L: L1 });
    objs.forEach((o, i) => { o.id = i + 1; });
    return { id: areaId, area: aid, floor, floors, quest: QUEST_END[step] || null, side: !!SIDE[aid], n: a.n, lv, type: a.type, rooms, corridors, spawns, objs, mainLen: d.mainLen, keys: d.keys, ok: d.bossOk && d.allOk, route: route(rooms, corridors, d) };
  }

  // Cinderhold: pevné město (inst fixed) – náměstí, archiv (Teodor), kovárna (Brannoc), kasárna Compactu (Oduin),
  // Lantern u vstupu a brána ven na sever; vyhaslé pece kolem náměstí. Rozměry jsou hodnoty prototypu.
  function buildTown(step, a) {
    const R = (id, kind, cx, cz, w, h) => Object.assign(rect(cx, cz, w, h), { id, kind, main: true, depth: id, cx, cz, w, h, key: null, chest: false, elite: false, enemies: 0 });
    const rooms = [R(0, 'entrance', 0, 15, 8, 10), R(1, 'normal', 0, 0, 30, 22), R(2, 'normal', -18, 0, 10, 10), R(3, 'normal', 18, 0, 10, 10), R(4, 'boss', 0, -14, 10, 10)]; // místnosti se překrývají = průchod
    const at = { np_teodor: [-20, 0], np_brannoc: [20, 0], np_oduin: [-3, -13] };
    const objs = [{ kind: 'lantern', x: 0, z: 16, room: 0 }, { kind: 'gate', x: 0, z: -17, room: 4 }];
    for (const id of a.npcs || []) if (at[id]) objs.push({ kind: 'npc', npc: id, x: at[id][0], z: at[id][1], room: at[id][0] < -14 ? 2 : at[id][0] > 14 ? 3 : 4 });
    for (const [x, z] of [[-11, -7], [11, -7], [-11, 7], [11, 7]]) objs.push({ kind: 'deco', what: 'furnace', x, z, room: 1 });
    objs.forEach((o, i) => { o.id = i + 1; });
    const route = [{ x: 0, z: 12 }, { x: 0, z: 0 }, { x: -19.5, z: 0 }, { x: 0, z: 0 }, { x: 19.5, z: 0 }, { x: 0, z: 0 }, { x: -3, z: -11 }, { x: 0, z: -15 }, { x: 0, z: -17 }];
    return { id: step, area: a.id, floor: 1, floors: 1, quest: null, side: false, town: true, n: a.n, lv: a.lv, type: a.type, rooms, corridors: [], spawns: [], objs, mainLen: rooms.length, keys: [], ok: true, route };
  }
  // průchozí místo? (místnosti + chodby, zamčené chodby bez klíče ne)
  function walkable(z, x, y, m, keys) {
    for (const rm of z.rooms) if (inRect(rm, x, y, m)) return true;
    for (const c of z.corridors) { if (c.lock && !(keys && keys.has(c.lock))) continue; for (const s of c.segs) if (inRect(s, x, y, Math.min(m, CORR / 2 - 0.05))) return true; }
    return false;
  }
  // trasa pro autopilota a testy: hlavní cesta, před zamčenou chodbou odbočka pro klíč (strom místností, BFS)
  function route(rooms, corridors, d) {
    const adj = {}; for (const c of corridors) { (adj[c.a] = adj[c.a] || []).push(c); (adj[c.b] = adj[c.b] || []).push(c); }
    const path = (from, to) => { const prev = { [from]: null }; const q = [from]; while (q.length) { const c = q.shift(); if (c === to) break; for (const e of adj[c] || []) { const o = e.a === c ? e.b : e.a; if (o in prev) continue; prev[o] = [c, e]; q.push(o); } } const out = []; let c = to; while (prev[c]) { out.unshift([c, prev[c][1]]); c = prev[c][0]; } return out; };
    const pts = []; let at = 0;
    const go = (to) => { for (const [room, e] of path(at, to)) { if (e.corner) pts.push({ x: e.corner[0], z: e.corner[1] }); pts.push({ x: rooms[room].cx, z: rooms[room].cz, room }); } at = to; };
    const keyRoom = {}; for (const [k, room] of d.keys.map((x) => [x[0], x[1]])) keyRoom[k] = room;
    for (let i = 1; i < d.mainLen; i++) { const c = corridors.find((x) => x.main && x.b === i); if (c && c.lock && keyRoom[c.lock] != null) { go(keyRoom[c.lock]); } go(i); }
    return pts;
  }
  // další krok kampaně; z tajné odbočky zpět do oblasti, odkud se vešlo
  const next = (id) => { if (SIDE[id]) return SIDE[id].from; const i = ACT1.indexOf(id); return i >= 0 && i < ACT1.length - 1 ? ACT1[i + 1] : null; };
  root.HSWorld = { ACT1, SIDE, QUEST_END, STORY, needTalk, CELL, UNIT, CORR, ZONE_P, buildZone, walkable, next, area, areaOf, floorOf, floorsOf };
})(typeof window !== 'undefined' ? window : globalThis);
