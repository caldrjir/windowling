'use strict';
// ── OSADNÍCI · ostrov, pravidla a počítačoví hráči (sdílí je hra i testy v Node) ──
// Ostrov z 19 šestiúhelníků (poloměr 2), 54 křižovatek a 72 cest. Suroviny: 0 dřevo, 1 cihly,
// 2 vlna, 3 obilí, 4 ruda. Mapa, hody kostkami, balíček akčních karet i krádeže zloděje se
// počítají ze semínka partie, takže se celá hra dá přehrát ze seznamu akcí – online tah je jen
// řetězec akcí jednoho hráče („D,r12,s30,E“), uložená hra je seznam všech akcí.
// Akce: S<v> / R<e> zakládání, D hod, X<pole>.<oběť> zloděj, r<e> cesta, s<v> osada, c<v> město,
// B koupě karty, K rytíř, P stavba silnic, Y<a><b> vynález, M<r> monopol, T<dám><beru> směna, E konec.
const OsCore = (() => {
  const WIN = 10, COST = { road: [1, 1, 0, 0, 0], set: [1, 1, 1, 1, 0], city: [0, 0, 0, 2, 3], dev: [0, 0, 1, 1, 1] };
  const LIMIT = { road: 15, set: 5, city: 4 };
  const DEV = ['K', 'V', 'P', 'Y', 'M']; // rytíř, vítězný bod, stavba silnic, vynález, monopol
  const hash = (a, b, c) => { let h = (a ^ Math.imul(b + 1, 0x9e3779b1) ^ Math.imul(c + 7, 0x85ebca6b)) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b); return (h ^ (h >>> 16)) >>> 0; };
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shuffle = (arr, r) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const pips = n => (n ? 6 - Math.abs(7 - n) : 0);

  // ── Geometrie (stejná pro všechny mapy) ──
  const G = (() => {
    const tiles = [], verts = [], edges = [], vk = new Map(), ek = new Map();
    for (let r = -2; r <= 2; r++) for (let q = -2; q <= 2; q++) if (Math.abs(q + r) <= 2) tiles.push({ q, r, x: Math.sqrt(3) * (q + r / 2), y: 1.5 * r, v: [], e: [], nb: [] });
    const vid = (x, y) => {
      const k = Math.round(x * 100) + ',' + Math.round(y * 100);
      if (!vk.has(k)) { vk.set(k, verts.length); verts.push({ x, y, t: [], e: [], n: [], port: null }); }
      return vk.get(k);
    };
    tiles.forEach((t, ti) => {
      for (let i = 0; i < 6; i++) { const a = (Math.PI / 180) * (60 * i - 90); t.v.push(vid(t.x + Math.cos(a), t.y + Math.sin(a))); }
      t.v.forEach(v => verts[v].t.push(ti));
      for (let i = 0; i < 6; i++) {
        const a = t.v[i], b = t.v[(i + 1) % 6], k = Math.min(a, b) + '-' + Math.max(a, b);
        if (!ek.has(k)) { ek.set(k, edges.length); edges.push({ a: Math.min(a, b), b: Math.max(a, b), t: [] }); verts[a].e.push(edges.length - 1); verts[b].e.push(edges.length - 1); verts[a].n.push(b); verts[b].n.push(a); }
        const e = ek.get(k); t.e.push(e); edges[e].t.push(ti);
      }
    });
    tiles.forEach(t => { t.nb = tiles.map((u, j) => [u, j]).filter(([u]) => u !== t && Math.hypot(u.x - t.x, u.y - t.y) < 1.8).map(([, j]) => j); });
    edges.forEach(e => { e.x = (verts[e.a].x + verts[e.b].x) / 2; e.y = (verts[e.a].y + verts[e.b].y) / 2; });
    // přístavy: 9 pobřežních hran rovnoměrně kolem ostrova
    const coast = edges.map((e, i) => i).filter(i => edges[i].t.length === 1).sort((a, b) => Math.atan2(edges[a].y, edges[a].x) - Math.atan2(edges[b].y, edges[b].x));
    const ports = [0, 3, 7, 10, 13, 17, 20, 23, 27].map(k => coast[k]);
    return { tiles, verts, edges, ports };
  })();
  const other = (e, v) => (G.edges[e].a === v ? G.edges[e].b : G.edges[e].a);

  // ── Mapa ze semínka ──
  function board(seed) {
    const r = rngOf(seed ^ 0x05ad);
    for (let attempt = 0; ; attempt++) {
      const res = shuffle([0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, -1], r);
      const nums = shuffle([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12], r);
      const num = []; let k = 0;
      for (const x of res) num.push(x < 0 ? 0 : nums[k++]);
      const hot = i => num[i] === 6 || num[i] === 8;
      if (attempt < 500 && G.tiles.some((t, i) => hot(i) && t.nb.some(hot))) continue;
      if (attempt < 500 && G.tiles.some((t, i) => num[i] && t.nb.some(j => num[j] === num[i]))) continue;
      const portType = shuffle(['*', '*', '*', '*', 0, 1, 2, 3, 4], r);
      const port = new Array(G.verts.length).fill(null);
      G.ports.forEach((e, i) => { port[G.edges[e].a] = portType[i]; port[G.edges[e].b] = portType[i]; });
      return { res, num, port, portType, desert: res.indexOf(-1) };
    }
  }

  function start(seed, n) {
    const B = board(seed), z = () => [0, 0, 0, 0, 0];
    const deck = shuffle([...Array(14).fill(0), ...Array(5).fill(1), 2, 2, 3, 3, 4, 4], rngOf(seed ^ 0xdec));
    const order = n === 2 ? [0, 1, 1, 0] : [...Array(n).keys(), ...[...Array(n).keys()].reverse()];
    return {
      seed, n, B, res: [...Array(n)].map(z), dev: [...Array(n)].map(z), fresh: [...Array(n)].map(z), knights: Array(n).fill(0),
      vb: new Array(G.verts.length).fill(-1), vc: new Array(G.verts.length).fill(false), eo: new Array(G.edges.length).fill(-1),
      robber: B.desert, deck, dp: 0, order, step: 0, phase: 'setS', cur: order[0], last: -1, t: 0, played: false, free: 0, after: 'main',
      roadLen: Array(n).fill(0), longest: -1, army: -1, winner: -1, dice: [0, 0], steals: 0,
    };
  }

  // ── Dotazy na stav ──
  const sum = a => a.reduce((x, y) => x + y, 0);
  const count = (s, p, kind) => (kind === 'road' ? s.eo.filter(o => o === p).length : s.vb.filter((o, v) => o === p && s.vc[v] === (kind === 'city')).length);
  const afford = (s, p, c) => c.every((x, i) => s.res[p][i] >= x);
  const freeSpot = (s, v) => s.vb[v] < 0 && G.verts[v].n.every(u => s.vb[u] < 0);
  function canSettle(s, p, v, setup) { return freeSpot(s, v) && (setup || G.verts[v].e.some(e => s.eo[e] === p)); }
  function canRoad(s, p, e) {
    if (s.eo[e] >= 0) return false;
    return [G.edges[e].a, G.edges[e].b].some(w => s.vb[w] === p || (s.vb[w] < 0 && G.verts[w].e.some(f => f !== e && s.eo[f] === p)));
  }
  const canCity = (s, p, v) => s.vb[v] === p && !s.vc[v];
  const settleSpots = (s, p) => G.verts.map((_, v) => v).filter(v => canSettle(s, p, v, false));
  const roadSpots = (s, p) => G.edges.map((_, e) => e).filter(e => canRoad(s, p, e));
  const citySpots = (s, p) => G.verts.map((_, v) => v).filter(v => canCity(s, p, v));
  function rate(s, p, r) {
    let best = 4;
    G.verts.forEach((_, v) => { if (s.vb[v] !== p) return; const pt = s.B.port[v]; if (pt === r) best = 2; else if (pt === '*' && best > 3) best = 3; });
    return best;
  }
  const publicVp = (s, p) => s.vb.reduce((a, o, v) => a + (o === p ? (s.vc[v] ? 2 : 1) : 0), 0) + (s.longest === p ? 2 : 0) + (s.army === p ? 2 : 0);
  const vp = (s, p) => publicVp(s, p) + s.dev[p][1];
  const playable = (s, p, k) => s.dev[p][k] - s.fresh[p][k] > 0 && !s.played && s.cur === p && (s.phase === 'main' || (k === 0 && s.phase === 'roll'));
  // kdo může být okraden na poli (sousední cizí stavby, hráč má karty)
  const victims = (s, p, tile) => [...new Set(G.tiles[tile].v.map(v => s.vb[v]).filter(o => o >= 0 && o !== p && sum(s.res[o]) > 0))];

  // nejdelší souvislá cesta hráče (cizí stavba ji přerušuje)
  function longestRoad(s, p) {
    let best = 0;
    const used = new Set();
    const walk = (v, first) => {
      if (!first && s.vb[v] >= 0 && s.vb[v] !== p) return 0;
      let b = 0;
      for (const e of G.verts[v].e) if (s.eo[e] === p && !used.has(e)) { used.add(e); b = Math.max(b, 1 + walk(other(e, v), false)); used.delete(e); }
      return b;
    };
    G.verts.forEach((vert, v) => { if (vert.e.some(e => s.eo[e] === p)) best = Math.max(best, walk(v, true)); });
    return best;
  }
  function updateLongest(s) {
    s.roadLen = [...Array(s.n).keys()].map(p => longestRoad(s, p));
    const L = s.roadLen, h = s.longest;
    if (h >= 0 && L[h] >= 5 && L.every(x => x <= L[h])) return;
    const m = Math.max(...L), top = L.map((x, p) => (x === m ? p : -1)).filter(p => p >= 0);
    s.longest = m >= 5 && top.length === 1 ? top[0] : h >= 0 && L[h] === m && m >= 5 ? h : -1;
  }
  const pay = (s, p, c) => c.forEach((x, i) => (s.res[p][i] -= x));
  function checkWin(s) { if (s.winner < 0 && vp(s, s.cur) >= WIN) { s.winner = s.cur; s.phase = 'done'; } }

  // ── Provedení akce; vrací popis události, nebo null, když akce není dovolená ──
  function apply(s, str) {
    if (s.winner >= 0) return null;
    const a = String(str), op = a[0], arg = a.slice(1), p = s.cur, num = +arg.split('.')[0];
    const ok = x => Number.isInteger(x);
    switch (op) {
      case 'S': {
        if (s.phase !== 'setS' || !ok(num) || !G.verts[num] || !canSettle(s, p, num, true)) return null;
        s.vb[num] = p; s.last = num; s.phase = 'setR';
        const gain = [0, 0, 0, 0, 0];
        if (s.step >= s.n) G.verts[num].t.forEach(t => { if (s.B.res[t] >= 0) { s.res[p][s.B.res[t]]++; gain[s.B.res[t]]++; } });
        return { type: 'set', p, v: num, gain };
      }
      case 'R': {
        if (s.phase !== 'setR' || !ok(num) || !G.edges[num] || s.eo[num] >= 0 || (G.edges[num].a !== s.last && G.edges[num].b !== s.last)) return null;
        s.eo[num] = p; s.step++;
        if (s.step >= s.order.length) { s.phase = 'roll'; s.cur = 0; } else { s.phase = 'setS'; s.cur = s.order[s.step]; }
        updateLongest(s);
        return { type: 'road', p, e: num, next: s.cur };
      }
      case 'D': {
        if (s.phase !== 'roll') return null;
        const d = [1 + (hash(s.seed >>> 0, s.t, 1) % 6), 1 + (hash(s.seed >>> 0, s.t, 2) % 6)], total = d[0] + d[1];
        s.dice = d;
        const gain = [...Array(s.n)].map(() => [0, 0, 0, 0, 0]), lost = [...Array(s.n)].map(() => [0, 0, 0, 0, 0]);
        if (total === 7) {
          // odhazuje se samo: polovina karet, vždy z té suroviny, které má hráč nejvíc
          for (let q = 0; q < s.n; q++) {
            let k = sum(s.res[q]) > 7 ? Math.floor(sum(s.res[q]) / 2) : 0;
            while (k-- > 0) { const i = s.res[q].indexOf(Math.max(...s.res[q])); s.res[q][i]--; lost[q][i]++; }
          }
          s.phase = 'rob'; s.after = 'main';
        } else {
          G.tiles.forEach((t, ti) => {
            if (s.B.num[ti] !== total || ti === s.robber) return;
            t.v.forEach(v => { const o = s.vb[v]; if (o >= 0) { const k = s.vc[v] ? 2 : 1; s.res[o][s.B.res[ti]] += k; gain[o][s.B.res[ti]] += k; } });
          });
          s.phase = 'main';
        }
        return { type: 'roll', p, d, total, gain, lost };
      }
      case 'X': {
        const [ts, vs] = arg.split('.'), tile = +ts;
        if (s.phase !== 'rob' || !ok(tile) || !G.tiles[tile] || tile === s.robber) return null;
        s.robber = tile;
        const vic = victims(s, p, tile);
        let victim = vs === undefined ? -1 : +vs, card = -1;
        if (vic.length && !vic.includes(victim)) victim = vic[0];
        if (!vic.length) victim = -1;
        if (victim >= 0) {
          let k = hash(s.seed >>> 0, s.t, 100 + s.steals++) % sum(s.res[victim]);
          for (let i = 0; i < 5; i++) { if (k < s.res[victim][i]) { card = i; break; } k -= s.res[victim][i]; }
          s.res[victim][card]--; s.res[p][card]++;
        }
        s.phase = s.after;
        return { type: 'rob', p, tile, victim, card };
      }
      case 'r': {
        if (s.phase !== 'main' || !ok(num) || !G.edges[num] || !canRoad(s, p, num) || count(s, p, 'road') >= LIMIT.road) return null;
        const free = s.free > 0;
        if (!free && !afford(s, p, COST.road)) return null;
        if (free) s.free--; else pay(s, p, COST.road);
        s.eo[num] = p; updateLongest(s); checkWin(s);
        return { type: 'road', p, e: num, free };
      }
      case 's': {
        if (s.phase !== 'main' || !ok(num) || !G.verts[num] || !canSettle(s, p, num, false) || !afford(s, p, COST.set) || count(s, p, 'set') >= LIMIT.set) return null;
        pay(s, p, COST.set); s.vb[num] = p; updateLongest(s); checkWin(s);
        return { type: 'set', p, v: num };
      }
      case 'c': {
        if (s.phase !== 'main' || !ok(num) || !G.verts[num] || !canCity(s, p, num) || !afford(s, p, COST.city) || count(s, p, 'city') >= LIMIT.city) return null;
        pay(s, p, COST.city); s.vc[num] = true; checkWin(s);
        return { type: 'city', p, v: num };
      }
      case 'B': {
        if (s.phase !== 'main' || s.dp >= s.deck.length || !afford(s, p, COST.dev)) return null;
        pay(s, p, COST.dev);
        const k = s.deck[s.dp++]; s.dev[p][k]++; s.fresh[p][k]++; checkWin(s);
        return { type: 'buy', p, k };
      }
      case 'K': {
        if (!playable(s, p, 0)) return null;
        s.dev[p][0]--; s.knights[p]++; s.played = true; s.after = s.phase; s.phase = 'rob';
        if (s.knights[p] >= 3 && (s.army < 0 || s.knights[p] > s.knights[s.army])) s.army = p;
        checkWin(s);
        return { type: 'knight', p };
      }
      case 'P': {
        if (!playable(s, p, 2)) return null;
        s.dev[p][2]--; s.played = true; s.free = Math.min(2, LIMIT.road - count(s, p, 'road'));
        return { type: 'roads', p };
      }
      case 'Y': {
        const x = +arg[0], y = +arg[1];
        if (!playable(s, p, 3) || !(x >= 0 && x < 5 && y >= 0 && y < 5)) return null;
        s.dev[p][3]--; s.played = true; s.res[p][x]++; s.res[p][y]++;
        return { type: 'plenty', p, r: [x, y] };
      }
      case 'M': {
        if (!playable(s, p, 4) || !(num >= 0 && num < 5)) return null;
        s.dev[p][4]--; s.played = true;
        let got = 0;
        for (let q = 0; q < s.n; q++) if (q !== p) { got += s.res[q][num]; s.res[q][num] = 0; }
        s.res[p][num] += got;
        return { type: 'mono', p, r: num, got };
      }
      case 'T': {
        const g = +arg[0], w = +arg[1];
        if (s.phase !== 'main' || !(g >= 0 && g < 5 && w >= 0 && w < 5) || g === w) return null;
        const k = rate(s, p, g);
        if (s.res[p][g] < k) return null;
        s.res[p][g] -= k; s.res[p][w]++;
        return { type: 'trade', p, g, w, k };
      }
      case 'E': {
        if (s.phase !== 'main') return null;
        s.free = 0; s.played = false; s.fresh[p] = [0, 0, 0, 0, 0];
        s.cur = (s.cur + 1) % s.n; s.t++; s.phase = 'roll';
        return { type: 'end', p, next: s.cur };
      }
    }
    return null;
  }
  const encode = acts => acts.join(',');
  const decode = str => String(str).split(',').filter(Boolean);

  // ── Počítačový hráč: další akce pro hráče na tahu ──
  // level 1 staví bez rozmyslu a nesměňuje, 2 plánuje stavbu a směňuje, 3 navíc hraje o armádu,
  // nejdelší cestu a zloděje posílá na vedoucího hráče
  // váhy surovin při výběru místa (zkušený hráč sází na obilí a rudu)
  const WEIGHT = [[1.1, 1.1, 0.8, 1, 1], [1, 1, 0.7, 1.25, 1.25]];
  function spotValue(s, p, v, level = 2) {
    const have = new Set();
    G.verts.forEach((_, u) => { if (s.vb[u] === p) G.verts[u].t.forEach(t => s.B.res[t] >= 0 && have.add(s.B.res[t])); });
    let val = 0;
    for (const t of G.verts[v].t) { const res = s.B.res[t]; if (res < 0) continue; val += pips(s.B.num[t]) * WEIGHT[level === 3 ? 1 : 0][res] * (t === s.robber ? 0.3 : 1) + (have.has(res) ? 0 : 1.2); }
    const pt = s.B.port[v];
    if (pt !== null) val += pt === '*' ? 1 : 1.5;
    return val;
  }
  function roadValue(s, p, e, level = 2) {
    let best = 0;
    for (const w of [G.edges[e].a, G.edges[e].b]) {
      if (s.vb[w] >= 0) continue;
      if (freeSpot(s, w)) best = Math.max(best, spotValue(s, p, w, level));
      for (const u of G.verts[w].n) if (freeSpot(s, u)) best = Math.max(best, 0.6 * spotValue(s, p, u, level));
    }
    return best;
  }
  const pick = (list, f, r, noise) => { let best = list[0], bv = -Infinity; for (const x of list) { const v = f(x) + r() * noise; if (v > bv) { bv = v; best = x; } } return best; };
  function aiStep(s, level, r) {
    const p = s.cur, noise = level === 1 ? 6 : level === 2 ? 1.5 : 0.3;
    if (s.phase === 'setS') return 'S' + pick(G.verts.map((_, v) => v).filter(v => freeSpot(s, v)), v => spotValue(s, p, v, level), r, noise);
    if (s.phase === 'setR') return 'R' + pick(G.verts[s.last].e.filter(e => s.eo[e] < 0), e => roadValue(s, p, e, level), r, noise);
    if (s.phase === 'rob') {
      const lead = q => publicVp(s, q);
      const tiles = G.tiles.map((_, t) => t).filter(t => t !== s.robber);
      const score = t => {
        let v = 0;
        for (const u of G.tiles[t].v) { const o = s.vb[u]; if (o < 0) continue; const w = pips(s.B.num[t]) * (s.vc[u] ? 2 : 1); v += o === p ? -3 * w : w * (level === 3 ? 1 + publicVp(s, o) / 4 : 1); }
        return v;
      };
      const t = pick(tiles, score, r, noise / 2), vic = victims(s, p, t);
      const victim = vic.length ? pick(vic, q => lead(q) + sum(s.res[q]) / 10, r, 0.01) : -1;
      return 'X' + t + (victim >= 0 ? '.' + victim : '');
    }
    const robbedMe = G.tiles[s.robber].v.some(v => s.vb[v] === p) && s.B.num[s.robber];
    if (s.phase === 'roll') return playable(s, p, 0) && robbedMe && level >= 2 ? 'K' : 'D';
    if (s.phase !== 'main') return 'E';
    const res = s.res[p];
    // akční karty
    if (playable(s, p, 0) && (robbedMe || (level === 3 && s.knights[p] + 1 >= 3 && (s.army < 0 || s.knights[p] + 1 > s.knights[s.army])))) return 'K';
    if (playable(s, p, 2) && roadSpots(s, p).length && count(s, p, 'road') <= LIMIT.road - 2 && level >= 2) return 'P';
    if (s.free > 0) { const rs = roadSpots(s, p); if (rs.length) return 'r' + pick(rs, e => roadValue(s, p, e, level), r, noise); }
    const spots = count(s, p, 'set') < LIMIT.set ? settleSpots(s, p) : [];
    const cities = count(s, p, 'city') < LIMIT.city ? citySpots(s, p) : [];
    // co stavět: město > osada > cesta k nové osadě > karta
    let target = null;
    if (cities.length && (level === 1 || res[4] >= 1 || res[3] >= 2 || !spots.length)) target = 'city';
    if (spots.length && (!target || afford(s, p, COST.set))) target = 'set';
    if (!target && !spots.length && count(s, p, 'road') < LIMIT.road && roadSpots(s, p).some(e => roadValue(s, p, e, level) > 0)) target = 'road';
    if (!target && !cities.length && s.dp < s.deck.length) target = 'dev';
    if (!target && cities.length) target = 'city';
    if (target === 'city' && afford(s, p, COST.city)) return 'c' + pick(cities, v => spotValue(s, p, v, level), r, noise);
    if (target === 'set' && afford(s, p, COST.set)) return 's' + pick(spots, v => spotValue(s, p, v, level), r, noise);
    if (target === 'road' && afford(s, p, COST.road)) return 'r' + pick(roadSpots(s, p), e => roadValue(s, p, e, level), r, noise);
    if ((target === 'dev' || (level >= 2 && sum(res) > 7)) && afford(s, p, COST.dev) && s.dp < s.deck.length && level >= 1) return 'B';
    if (playable(s, p, 3) && target) { const need = COST[target].map((x, i) => x - res[i]); const a = need.indexOf(Math.max(...need)); need[a]--; return 'Y' + a + need.indexOf(Math.max(...need)); }
    if (playable(s, p, 4) && level >= 2) return 'M' + (target === 'city' ? 4 : target === 'set' ? 3 : 0);
    // směna s bankou nebo přístavem pro chybějící surovinu
    if (level >= 2 && target) {
      const c = COST[target], need = c.map((x, i) => Math.max(0, x - res[i]));
      if (sum(need) > 0) {
        const gives = [0, 1, 2, 3, 4].filter(g => res[g] - c[g] >= rate(s, p, g));
        if (gives.length && (level === 3 || sum(need) <= gives.reduce((a, g) => a + Math.floor((res[g] - c[g]) / rate(s, p, g)), 0))) {
          const g = pick(gives, x => res[x] - c[x] - rate(s, p, x), r, 0.01);
          return 'T' + g + need.indexOf(Math.max(...need));
        }
      }
    }
    // s velkou hromadou karet (hrozí sedmička) postav aspoň cestu
    if (sum(res) > 7 && afford(s, p, COST.road) && count(s, p, 'road') < LIMIT.road && level >= 2) { const rs = roadSpots(s, p); if (rs.length) return 'r' + pick(rs, e => roadValue(s, p, e, level), r, noise); }
    return 'E';
  }
  // odehraj celý tah počítačem (pro testy a automat); vrací seznam akcí
  function aiTurn(s, level, r) {
    const p = s.cur, acts = [];
    for (let guard = 0; guard < 80 && s.cur === p && s.winner < 0; guard++) {
      const a = aiStep(s, level, r);
      if (!apply(s, a)) { if (s.phase === 'main') apply(s, 'E'), acts.push('E'); else break; } else acts.push(a);
    }
    return acts;
  }
  return { G, WIN, COST, LIMIT, DEV, hash, pips, board, start, apply, encode, decode, aiStep, aiTurn, canSettle, canRoad, canCity, settleSpots, roadSpots, citySpots, rate, vp, publicVp, playable, victims, longestRoad, afford, count, sum, other, rngOf };
})();
if (typeof module !== 'undefined') module.exports = OsCore;
