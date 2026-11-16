'use strict';
// GENEROVÁNO z Game Design Bible (needitovat ručně) – generátor dungeonů G.genDungeon (14 kroků), beze změny.
// Zdroj: Echoes of the Hollow Sun – Game Design Bible v33 (https://claude.ai/artifact/2AEuTsGxsBrYAzdqQX7R2c)
(function (root) {
  const HS = root.HS;
  const G = { rng: HS.rng, DG_SIZES: HS.D.dungeon.sizes, DG_THEMES: HS.D.dungeon.themes };
  function genDungeon(p) {
      const r = G.rng([p.seed, p.theme, p.size, p.diff, p.density, p.side, p.special, p.arena, p.floors].join('|'));
      const rooms = []; const edges = []; const log = [];
      const [mn, mx] = G.DG_SIZES[p.size]; const mainLen = r.int(mn, mx);
      log.push(`1–2: biom ${G.DG_THEMES[p.theme][0]}, hlavní cesta ${mainLen}, rozpočet obtížnosti ${p.diff}`);
      const floors = p.floors; const perFloor = Math.ceil(mainLen / floors);
      // 3–4: graf hlavní cesty
      for (let i = 0; i < mainLen; i++) rooms.push({ id: i, kind: i === 0 ? 'entrance' : i === mainLen - 1 ? 'boss' : i === mainLen - 2 && mainLen > 5 ? 'ante' : 'normal', main: true, depth: i, floor: Math.min(floors - 1, Math.floor(i / perFloor)), branch: -1 });
      for (let i = 1; i < mainLen; i++) edges.push({ a: i - 1, b: i, main: true, lock: null, stairs: rooms[i].floor !== rooms[i - 1].floor });
      // 5: větve
      const candidates = rooms.filter((x) => x.kind === 'normal').map((x) => x.id);
      let bi = 0;
      for (let k = 0; k < p.side && candidates.length; k++) {
        const parent = r.pick(candidates); const len = r.int(1, 3); let prev = parent;
        for (let j = 0; j < len; j++) { const id = rooms.length; rooms.push({ id, kind: 'side', main: false, depth: rooms[parent].depth + j + 1, floor: rooms[parent].floor, branch: bi, parent }); edges.push({ a: prev, b: id, main: false }); prev = id; }
        rooms[prev].kind = r() < 0.15 ? 'secret' : 'treasure'; bi++;
      }
      log.push(`5: ${bi} větví, ${rooms.filter((x) => x.kind === 'secret').length} tajných`);
      // 6: speciální
      const sideNorm = rooms.filter((x) => x.kind === 'side');
      const specialKinds = ['shrine', 'lore', 'challenge', 'vault'];
      let sp = 0; for (let k = 0; k < p.special; k++) { const pool = sideNorm.filter((x) => x.kind === 'side').concat(rooms.filter((x) => x.kind === 'normal' && x.main && x.id > 1)); if (!pool.length) break; const t = r.pick(pool); t.kind = specialKinds[k % specialKinds.length]; t.special = true; sp++; }
      log.push(`6: ${sp} speciálních místností`);
      // 7: zámky
      const locks = mainLen >= 11 ? 2 : mainLen >= 7 ? 1 : 0; const keys = [];
      for (let k = 0; k < locks; k++) {
        const lo = Math.ceil(mainLen * (k === 0 ? 0.45 : 0.75)); const pos = Math.min(mainLen - 2, Math.max(2, lo + r.int(-1, 1)));
        const e = edges.find((x) => x.main && x.b === pos); if (!e || e.lock) continue;
        const lockId = 'K' + (k + 1); e.lock = lockId;
        // klíč: ve větvi s rodičem < pos, jinak nová větev
        let host = rooms.filter((x) => !x.main && rooms[rootOf(x)].id < pos && !x.key && x.kind !== 'secret');
        let keyRoom;
        if (host.length) keyRoom = r.pick(host); else { const parent = r.int(1, pos - 1); const id = rooms.length; rooms.push({ id, kind: 'side', main: false, depth: rooms[parent].depth + 1, floor: rooms[parent].floor, branch: bi++, parent }); edges.push({ a: parent, b: id, main: false }); keyRoom = rooms[id]; }
        keyRoom.key = lockId; keys.push([lockId, keyRoom.id, pos]);
      }
      function rootOf(x) { let c = x; let guard = 0; while (!c.main && guard++ < 50) c = rooms[c.parent]; return c.id; }
      log.push(`7: ${locks} zámků; klíče v místnostech ${keys.map((k) => '#' + k[1]).join(', ') || '—'}`);
      // 8–9: umístění do mřížky (per patro)
      const occ = {}; const key = (f, x, y) => f + ':' + x + ':' + y; let collisions = 0;
      const dirs = [[1, 0], [0, 1], [0, -1], [-1, 0]];
      const nearestFree = (f, x, y) => { for (let rad = 1; rad < 40; rad++) for (let dx = -rad; dx <= rad; dx++) for (let dy = -rad; dy <= rad; dy++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue; if (!occ[key(f, x + dx, y + dy)]) return [x + dx, y + dy]; } return [x + 40, y]; };
      const placeMain = () => {
        let x = 0, y = 0, f = 0;
        for (const rm of rooms.filter((q) => q.main)) {
          if (rm.floor !== f) { f = rm.floor; x = 0; y = 0; }
          if (rm.id === 0 || (rm.id > 0 && rooms[rm.id - 1].floor !== rm.floor)) { rm.gx = x; rm.gy = y; occ[key(f, x, y)] = rm.id + 1; continue; }
          const prev = rooms[rm.id - 1]; const opts = r.shuffle(dirs).sort((a, b) => (b[0] === 1 ? 1 : 0) - (a[0] === 1 ? 1 : 0)).filter((d) => !occ[key(f, prev.gx + d[0], prev.gy + d[1])]);
          if (!opts.length) { collisions++; const fr = nearestFree(f, prev.gx, prev.gy); rm.gx = fr[0]; rm.gy = fr[1]; rm.longCorr = true; }
          else { const d = r() < 0.55 ? (opts.find((o) => o[0] === 1) || opts[0]) : opts[0]; rm.gx = prev.gx + d[0]; rm.gy = prev.gy + d[1]; }
          occ[key(f, rm.gx, rm.gy)] = rm.id + 1;
        }
      };
      placeMain();
      for (const rm of rooms.filter((q) => !q.main)) {
        const par = rooms[edges.find((e) => e.b === rm.id).a]; const f = rm.floor; let placed = false;
        for (const d of r.shuffle(dirs)) { const nx = par.gx + d[0], ny = par.gy + d[1]; if (!occ[key(f, nx, ny)]) { rm.gx = nx; rm.gy = ny; occ[key(f, nx, ny)] = rm.id + 1; placed = true; break; } }
        if (!placed) { collisions++; const fr = nearestFree(f, par.gx, par.gy); rm.gx = fr[0]; rm.gy = fr[1]; occ[key(f, fr[0], fr[1])] = rm.id + 1; rm.longCorr = true; }
      }
      log.push(`8–9: moduly umístěny do mřížky, ${collisions} kolizí vyřešeno přesunem`);
      // rozměry místností
      for (const rm of rooms) { rm.w = rm.kind === 'boss' ? 6.4 : r.int(3, 5) + (rm.main ? 0.6 : 0); rm.h = rm.kind === 'boss' ? 6.4 : r.int(3, 5); }
      // 10: nepřátelé
      let enemies = 0, elites = 0;
      for (const rm of rooms) { if (['entrance', 'ante', 'boss', 'secret', 'shrine', 'lore'].includes(rm.kind)) { rm.enemies = 0; continue; } const budget = rm.w * rm.h * 0.18 * p.density * (0.8 + 0.2 * p.diff) * (rm.kind === 'challenge' ? 2 : 1); rm.enemies = Math.max(1, Math.round(budget)); rm.elite = r() < 0.08 + 0.03 * p.diff; enemies += rm.enemies; if (rm.elite) elites++; }
      log.push(`10: ${enemies} nepřátel, ${elites} elitních packů`);
      // 11: poklady
      let chests = 0; for (const rm of rooms) { rm.chest = rm.kind === 'treasure' || rm.kind === 'vault' || rm.kind === 'secret' || (rm.kind === 'normal' && r() < 0.12); if (rm.chest) chests++; }
      log.push(`11: ${chests} truhel`); log.push(`12: boss aréna „${p.arena}“ v místnosti #${mainLen - 1}`);
      // 13: průchodnost (BFS s klíči)
      const adj = {}; for (const e of edges) { (adj[e.a] = adj[e.a] || []).push(e); (adj[e.b] = adj[e.b] || []).push(e); }
      const have = new Set(); let reach = new Set([0]); const passes = [];
      for (let it = 0; it < 6; it++) {
        const q = [0]; reach = new Set([0]);
        while (q.length) { const c = q.shift(); for (const e of adj[c] || []) { const o = e.a === c ? e.b : e.a; if (reach.has(o)) continue; if (e.lock && !have.has(e.lock)) continue; reach.add(o); q.push(o); } }
        const newKeys = rooms.filter((x) => reach.has(x.id) && x.key && !have.has(x.key)).map((x) => x.key);
        passes.push({ reach: reach.size, keys: [...have], found: newKeys });
        if (!newKeys.length) break; newKeys.forEach((k) => have.add(k));
      }
      const bossOk = reach.has(mainLen - 1); const allOk = rooms.every((x) => reach.has(x.id));
      log.push(`13: průchodnost ${bossOk && allOk ? 'OK' : 'SELHALO'} (${reach.size}/${rooms.length} dosažitelných)`);
      log.push(`14: seed „${p.seed}“ + parametry → identický výsledek`);
      return { rooms, edges, log, passes, bossOk, allOk, enemies, elites, chests, keys, mainLen, collisions };
    }
  HS.genDungeon = genDungeon;
})(typeof window !== 'undefined' ? window : globalThis);
