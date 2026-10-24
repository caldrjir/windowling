'use strict';
// ── SOKOBAN · Windowling Hlavolamy ──────────────────────────────────────────
// Skladník ve vesmírném skladu: dotlač všechny bedny na zářící cíle. Bedny jde jen tlačit,
// ne táhnout, a nejvýš jednu najednou. Generátor staví úrovně pozpátku: z vyřešeného stavu
// bedny „odtahuje“ (přesné BFS, ve velkých prostorech paprsek několika set stavů), takže
// každá úroveň je řešitelná a víme, kolika posuny se dá vyřešit (limit posunů).
const Sokoban = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'easy', name: L('Lehké', 'Easy'), note: L('2 bedny', '2 crates'), w: 8, h: 8, floor: 22, k: 2, min: 8, max: 14, par: 3 * 60 },
    { id: 'medium', name: L('Střední', 'Medium'), note: L('3 bedny', '3 crates'), w: 9, h: 9, floor: 30, k: 3, min: 14, max: 24, par: 6 * 60 },
    { id: 'hard', name: L('Těžké', 'Hard'), note: L('4 bedny', '4 crates'), w: 10, h: 10, floor: 38, k: 4, min: 22, max: 34, par: 10 * 60 },
    { id: 'expert', name: L('Expert', 'Expert'), note: L('5 beden', '5 crates'), w: 11, h: 11, floor: 46, k: 5, min: 30, max: 46, par: 16 * 60 },
  ];
  const CAP = 8000, BEAM = 300, BUDGET = [30000, 40000, 45000, 50000];

  // ── Místnost: náhodná procházka štětcem 1–2 pole, sloupy, bez slepých výběžků ──
  function room(W, H, target, r) {
    const wall = new Uint8Array(W * H).fill(1), N4 = [1, -1, W, -W];
    const conn = () => {
      let first = -1, n = 0; for (let i = 0; i < W * H; i++) if (!wall[i]) { n++; if (first < 0) first = i; }
      if (first < 0) return true;
      const s = new Uint8Array(W * H), st = [first]; s[first] = 1; let c = 1;
      while (st.length) { const a = st.pop(); for (const o of N4) if (!wall[a + o] && !s[a + o]) { s[a + o] = 1; c++; st.push(a + o); } }
      return c === n;
    };
    let x = 1 + Math.floor(r() * (W - 2)), y = 1 + Math.floor(r() * (H - 2)), n = 0, guard = 0;
    while (n < target && guard++ < 600) {
      const bw = 1 + (r() < 0.6 ? 1 : 0), bh = 1 + (r() < 0.6 ? 1 : 0);
      for (let yy = y; yy < y + bh; yy++) for (let xx = x; xx < x + bw; xx++) if (xx >= 1 && yy >= 1 && xx < W - 1 && yy < H - 1 && wall[yy * W + xx]) { wall[yy * W + xx] = 0; n++; }
      const d = Math.floor(r() * 4);
      x = Math.max(1, Math.min(W - 2, x + [1, 0, -1, 0][d])); y = Math.max(1, Math.min(H - 2, y + [0, 1, 0, -1][d]));
    }
    for (let k = 0; k < Math.round(target / 9); k++) {
      const i = (1 + Math.floor(r() * (H - 2))) * W + 1 + Math.floor(r() * (W - 2));
      if (wall[i]) continue;
      let open = 0; for (const o of [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]) open += !wall[i + o];
      if (open < 6) continue;
      wall[i] = 1; if (!conn()) wall[i] = 0;
    }
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < W * H; i++) if (!wall[i]) {
      let c = 0; for (const o of N4) c += wall[i + o];
      if (c >= 3 && r() < 0.7) { wall[i] = 1; if (!conn()) wall[i] = 0; }
    }
    return wall;
  }

  // ── Generátor: pozpátku od vyřešeného stavu ──
  function build(D, budget, r) {
    const W = D.w, H = D.h, N = W * H, DIR = [1, W, -1, -W];
    const wall = room(W, H, D.floor, r);
    const floors = []; for (let i = 0; i < N; i++) if (!wall[i]) floors.push(i);
    if (floors.length < D.floor * 0.8) return null;
    const cand = floors.filter(i => DIR.some(d => !wall[i + d] && !wall[i + 2 * d]));
    if (cand.length < D.k + 2) return null;
    const goals = [];
    while (goals.length < D.k) goals.push(cand.splice(Math.floor(r() * cand.length), 1)[0]);
    goals.sort((a, b) => a - b);
    const occ = new Uint8Array(N), seen = new Int32Array(N), reach = new Int32Array(N), q = new Int32Array(N);
    let stamp = 0, rstamp = 0;
    const flood = (p, mark) => {
      const m = mark === reach ? ++rstamp : ++stamp; let h = 0, t = 0, mn = p; q[t++] = p; mark[p] = m;
      while (h < t) { const c = q[h++]; if (c < mn) mn = c; for (const d of DIR) { const n2 = c + d; if (!wall[n2] && !occ[n2] && mark[n2] !== m) { mark[n2] = m; q[t++] = n2; } } }
      return mn;
    };
    const map = new Map(); let frontier = [];
    for (const g of goals) occ[g] = 1;
    const regions = new Set();
    for (const f of floors) {
      if (occ[f]) continue; const mn = flood(f, seen); if (regions.has(mn)) continue;
      regions.add(mn); const key = String.fromCharCode(...goals, mn); map.set(key, null); frontier.push([goals.slice(), mn, f, key]);
    }
    for (const g of goals) occ[g] = 0;
    let depth = 0, last = frontier;
    while (frontier.length && depth < D.max && map.size <= budget) {
      if (map.size >= CAP && frontier.length > BEAM) {
        for (let i = 0; i < BEAM; i++) { const j = i + Math.floor(r() * (frontier.length - i)); [frontier[i], frontier[j]] = [frontier[j], frontier[i]]; }
        frontier = frontier.slice(0, BEAM);
      }
      const next = [];
      for (const [boxes, pmin, , pkey] of frontier) {
        for (const b of boxes) occ[b] = 1;
        flood(pmin, reach); const st = rstamp;
        for (let bi = 0; bi < boxes.length; bi++) {
          const b = boxes[bi];
          for (const d of DIR) {
            const p = b + d, p2 = p + d;
            if (reach[p] !== st || wall[p2] || occ[p2]) continue;
            occ[b] = 0; occ[p] = 1; const mn = flood(p2, seen); occ[p] = 0; occ[b] = 1;
            const nb = boxes.slice(); nb[bi] = p; nb.sort((a, c) => a - c);
            const key = String.fromCharCode(...nb, mn);
            if (map.has(key)) continue;
            // rodič a tah: vpřed je to posun bedny z p zpět na b
            map.set(key, [pkey, p, b]); next.push([nb, mn, p2, key]);
          }
        }
        for (const b of boxes) occ[b] = 0;
      }
      if (!next.length) break;
      depth++; last = next; frontier = next;
    }
    const gs = new Set(goals);
    let pick = null;
    for (const s of last) { const on = s[0].filter(b => gs.has(b)).length; if (!pick || on < pick.on) pick = { s, on }; }
    if (!pick || !depth) return null;
    // pole, kam se hráč nikdy nedostane, zazdi
    const reachable = new Uint8Array(N), st = [pick.s[2]]; reachable[pick.s[2]] = 1;
    while (st.length) { const a = st.pop(); for (const d of DIR) if (!wall[a + d] && !reachable[a + d]) { reachable[a + d] = 1; st.push(a + d); } }
    for (let i = 0; i < N; i++) if (!wall[i] && !reachable[i]) wall[i] = 1;
    const sol = []; for (let k = pick.s[3]; map.get(k); k = map.get(k)[0]) { const [, from, to] = map.get(k); sol.push([from, to]); }
    return { wall, goals, boxes: pick.s[0], player: pick.s[2], pushes: depth, on: pick.on, states: map.size, sol };
  }

  function generate(seed, diffId) {
    const D = DIFFS.find(d => d.id === diffId) || DIFFS[0], r = Kit.rng(seed), budget = BUDGET[DIFFS.indexOf(D)];
    let best = null, spent = 0;
    for (let tries = 0; tries < 40 && spent < budget; tries++) {
      const g = build(D, budget, r);
      if (!g) continue;
      spent += g.states;
      const good = g.pushes >= D.min && g.on <= (D.k >= 3 ? 1 : 0);
      if (good || !best || g.pushes - g.on * 4 > best.pushes - best.on * 4) best = g;
      if (good) break;
    }
    // ořízni zbytečné okraje ze zdí
    const W = D.w, H = D.h;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let i = 0; i < W * H; i++) if (!best.wall[i]) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0--; y0--; x1++; y1++;
    const w = x1 - x0 + 1, h = y1 - y0 + 1, mapI = i => ((i / W | 0) - y0) * w + (i % W) - x0;
    const rows = []; for (let y = y0; y <= y1; y++) { let s = ''; for (let x = x0; x <= x1; x++) s += best.wall[y * W + x] ? '#' : ' '; rows.push(s); }
    return { w, h, rows, goals: best.goals.map(mapI), boxes: best.boxes.map(mapI), player: mapI(best.player), par: best.pushes, sol: best.sol.map(([a, b]) => [mapI(a), mapI(b)]), name: nameOf(seed) };
  }

  const NM = {
    cs: { a: ['Severní', 'Zapomenutý', 'Zlatý', 'Tichý', 'Mlžný', 'Ledový', 'Starý', 'Rudý', 'Hvězdný', 'Hluboký', 'Polární', 'Lunární'], b: ['sklad', 'hangár', 'přístav', 'dok', 'trezor', 'maják', 'tunel', 'důl', 'archiv', 'modul', 'terminál', 'sál'] },
    en: { a: ['Northern', 'Forgotten', 'Golden', 'Silent', 'Misty', 'Frozen', 'Old', 'Red', 'Starry', 'Deep', 'Polar', 'Lunar'], b: ['Depot', 'Hangar', 'Harbour', 'Dock', 'Vault', 'Beacon', 'Tunnel', 'Mine', 'Archive', 'Module', 'Terminal', 'Hall'] },
  };
  function nameOf(seed) { const r = Kit.rng(seed ^ 0x51c0ba7), N = NM[Kit.LANG] || NM.cs; return `${N.a[Math.floor(r() * N.a.length)]} ${N.b[Math.floor(r() * N.b.length)]}`; }

  // ── Pravidla a řešitel pro nápovědu ──
  function world(P) {
    const W = P.w, N = W * P.h, wall = new Uint8Array(N);
    P.rows.forEach((row, y) => { for (let x = 0; x < W; x++) wall[y * W + x] = row[x] === '#' ? 1 : 0; });
    const DIR = { r: 1, d: W, l: -1, u: -W };
    // mrtvá pole: odtud bednu na žádný cíl nedotlačíš (pozpátné tahání z cílů)
    const live = new Uint8Array(N), st = P.goals.slice(); P.goals.forEach(g => { live[g] = 1; });
    while (st.length) { const b = st.pop(); for (const d of Object.values(DIR)) { const p = b + d, p2 = p + d; if (!wall[p] && !wall[p2] && !live[p]) { live[p] = 1; st.push(p); } } }
    return { W, N, wall, DIR, live };
  }
  // BFS po posunech: vrátí první posun nejkratšího řešení { box, dir } nebo null
  function solveNext(Wd, P, boxes, player, cap = 60000) {
    const { W, N, wall } = Wd, D4 = [1, W, -1, -W], goals = new Set(P.goals);
    const occ = new Uint8Array(N), mark = new Int32Array(N), reach = new Int32Array(N), q = new Int32Array(N);
    let m1 = 0, m2 = 0;
    const flood = (p, arr) => { const m = arr === reach ? ++m2 : ++m1; let h = 0, t = 0, mn = p; q[t++] = p; arr[p] = m; while (h < t) { const c = q[h++]; if (c < mn) mn = c; for (const d of D4) { const n2 = c + d; if (!wall[n2] && !occ[n2] && arr[n2] !== m) { arr[n2] = m; q[t++] = n2; } } } return mn; };
    const start = boxes.slice().sort((a, b) => a - b);
    if (start.every(b => goals.has(b))) return null;
    start.forEach(b => { occ[b] = 1; }); const pm = flood(player, mark); start.forEach(b => { occ[b] = 0; });
    const seenS = new Map([[String.fromCharCode(...start, pm), null]]);
    let frontier = [[start, pm, null]];
    while (frontier.length && seenS.size < cap) {
      const next = [];
      for (const [bx, pmin, first] of frontier) {
        bx.forEach(b => { occ[b] = 1; }); flood(pmin, reach); const st = m2;
        for (let i = 0; i < bx.length; i++) for (const d of D4) {
          const b = bx[i], from = b - d, to = b + d;
          if (reach[from] !== st || wall[to] || occ[to] || !Wd.live[to]) continue;
          const nb = bx.slice(); nb[i] = to; nb.sort((a, c) => a - c);
          occ[b] = 0; occ[to] = 1; const mn = flood(b, mark); occ[to] = 0; occ[b] = 1;
          const key = String.fromCharCode(...nb, mn);
          if (seenS.has(key)) continue;
          const f = first || { box: b, dir: d };
          if (nb.every(x => goals.has(x))) { bx.forEach(x => { occ[x] = 0; }); return f; }
          seenS.set(key, 1); next.push([nb, mn, f]);
        }
        bx.forEach(b => { occ[b] = 0; });
      }
      frontier = next;
    }
    return null;
  }
  // nejkratší cesta hráče bez posouvání (BFS), jako řetězec směrů
  function walkPath(Wd, boxes, from, to) {
    if (from === to) return '';
    const { W, N, wall } = Wd, occ = new Uint8Array(N); boxes.forEach(b => { occ[b] = 1; });
    if (wall[to] || occ[to]) return null;
    const prev = new Int32Array(N).fill(-1), dirOf = new Uint8Array(N), K = 'rdlu', D4 = [1, W, -1, -W], q = [from]; prev[from] = from;
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      for (let k = 0; k < 4; k++) { const n = c + D4[k]; if (wall[n] || occ[n] || prev[n] >= 0) continue; prev[n] = c; dirOf[n] = k; if (n === to) { let s = '', x = n; while (x !== from) { s = K[dirOf[x]] + s; x = prev[x]; } return s; } q.push(n); }
    }
    return null;
  }

  const cz = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

  // ── Hrací plocha ──
  // ── Kresba skladu (SVG): souvislé stěny s přední stěnou do hloubky, kovová podlaha se stínem
  // pod zdí, svítící cílové plošiny, dřevěné bedny a robot skladník. Sdílí ji hra i úvodní obrázek. ──
  const DEFS = `<defs>
    <linearGradient id="skWallTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4f86"/><stop offset="1" stop-color="#363a6c"/></linearGradient>
    <linearGradient id="skWallFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262a52"/><stop offset="1" stop-color="#171936"/></linearGradient>
    <linearGradient id="skFloorG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2850"/><stop offset="1" stop-color="#211f42"/></linearGradient>
    <linearGradient id="skShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(0,0,0,.45)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></linearGradient>
    <linearGradient id="skWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2a55a"/><stop offset="1" stop-color="#b8752f"/></linearGradient>
    <linearGradient id="skWoodOn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ff0b8"/><stop offset="1" stop-color="#2fb37a"/></linearGradient>
    <linearGradient id="skBot" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9c6ff"/></linearGradient>
    <radialGradient id="skPad"><stop offset="0" stop-color="var(--a)" stop-opacity=".45"/><stop offset="1" stop-color="var(--a)" stop-opacity="0"/></radialGradient>
  </defs>`;
  // mapa: podlaha, stěny (horní plocha + přední stěna tam, kde pod nimi je podlaha), stíny a cíle
  function mapSVG(P, wall, S) {
    const W = P.w, H = P.h, isWall = (x, y) => x < 0 || y < 0 || x >= W || y >= H || wall[y * W + x];
    const near = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!isWall(x + dx, y + dy)) return true; return false; };
    let floor = '', walls = '', fronts = '', edges = '';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const X = x * S, Y = y * S;
      if (!wall[y * W + x]) {
        floor += `<rect class="sk-fl" x="${X}" y="${Y}" width="${S}" height="${S}"/><rect class="sk-fl2" x="${X + 6}" y="${Y + 6}" width="${S - 12}" height="${S - 12}" rx="6"/>`;
        for (const [cx, cy] of [[14, 14], [S - 14, 14], [14, S - 14], [S - 14, S - 14]]) floor += `<circle class="sk-rv" cx="${X + cx}" cy="${Y + cy}" r="2.6"/>`;
        if (isWall(x, y - 1)) floor += `<rect x="${X}" y="${Y}" width="${S}" height="${S * 0.3}" fill="url(#skShade)"/>`;
        if (isWall(x - 1, y)) floor += `<rect x="${X}" y="${Y}" width="${S * 0.12}" height="${S}" fill="rgba(0,0,0,.18)"/>`;
        continue;
      }
      if (!near(x, y)) continue;
      walls += `<rect x="${X - 0.5}" y="${Y - 0.5}" width="${S + 1}" height="${S + 1}" fill="url(#skWallTop)"/>`;
      // nýty a spáry v horní ploše
      walls += `<path class="sk-seam" d="M${X} ${Y + S / 2}h${S}M${X + (y % 2 ? S / 2 : 0)} ${Y}v${S / 2}M${X + (y % 2 ? 0 : S / 2)} ${Y + S / 2}v${S / 2}"/>`;
      if (!isWall(x, y + 1)) fronts += `<rect x="${X - 0.5}" y="${Y + S * 0.72}" width="${S + 1}" height="${S * 0.28 + 0.5}" fill="url(#skWallFront)"/><path class="sk-stripe" d="M${X + 8} ${Y + S * 0.86}h${S - 16}"/>`;
      if (!isWall(x, y - 1)) edges += `<path class="sk-edge" d="M${X} ${Y + 1.5}h${S}"/>`;
      if (!isWall(x - 1, y)) edges += `<path class="sk-edge" d="M${X + 1.5} ${Y}v${S}"/>`;
      if (!isWall(x + 1, y)) edges += `<path class="sk-edge dk" d="M${X + S - 1.5} ${Y}v${S}"/>`;
    }
    const goals = P.goals.map(g => { const X = (g % W) * S + S / 2, Y = ((g / W) | 0) * S + S / 2; return `<g class="sk-goal" transform="translate(${X} ${Y})"><circle r="${S * 0.48}" fill="url(#skPad)"/><rect class="pad" x="${-S * 0.33}" y="${-S * 0.33}" width="${S * 0.66}" height="${S * 0.66}" rx="12"/><path class="mk" d="M-12 0h24M0-12v24"/></g>`; }).join('');
    return `<g class="sk-floor">${floor}</g><g class="sk-goals">${goals}</g><g class="sk-walls">${walls}${fronts}${edges}</g>`;
  }
  const CRATE = '<g class="crate"><rect class="sh" x="14" y="80" width="72" height="10" rx="5"/><rect class="body" x="12" y="10" width="76" height="76" rx="9"/><path class="pl" d="M12 35h76M12 61h76"/><path class="br" d="M20 80L80 16"/><rect class="fr" x="12" y="10" width="76" height="76" rx="9"/><g class="cn"><rect x="12" y="10" width="14" height="14" rx="4"/><rect x="74" y="10" width="14" height="14" rx="4"/><rect x="12" y="72" width="14" height="14" rx="4"/><rect x="74" y="72" width="14" height="14" rx="4"/></g><path class="ok" d="M36 49l10 10 20-22"/></g>';
  const HERO = '<g class="sk-hero"><ellipse class="sh" cx="50" cy="88" rx="24" ry="6"/><g class="bot"><rect class="leg" x="30" y="70" width="14" height="16" rx="5"/><rect class="leg" x="56" y="70" width="14" height="16" rx="5"/><path class="antl" d="M50 22v-10"/><circle class="ant" cx="50" cy="11" r="5"/><rect class="body" x="24" y="22" width="52" height="54" rx="20"/><rect class="scr" x="32" y="32" width="36" height="24" rx="10"/><g class="eyes"><circle cx="43" cy="44" r="4"/><circle cx="57" cy="44" r="4"/></g><rect class="arm" x="14" y="44" width="12" height="18" rx="6"/><rect class="arm" x="74" y="44" width="12" height="18" rx="6"/></g></g>';
  function create(el, P, saved, api) {
    const Wd = world(P), { W, wall } = Wd, S = 100;
    const goals = new Set(P.goals);
    let player, boxes, moves = '', pushes = 0, facing = 'd', done = false, busy = false, queue = [];
    let hintsUsed = (saved && saved.h) || 0;
    const DV = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] };
    function reset() { player = P.player; boxes = P.boxes.slice(); moves = ''; pushes = 0; }
    // jeden krok; vrací 'm' (pohyb), 'p' (posun) nebo '' (nejde)
    function step(k) {
      const d = Wd.DIR[k], to = player + d;
      if (wall[to]) return '';
      const bi = boxes.indexOf(to);
      if (bi >= 0) { const b2 = to + d; if (wall[b2] || boxes.includes(b2)) return ''; boxes[bi] = b2; player = to; moves += k.toUpperCase(); pushes++; facing = k; return 'p'; }
      player = to; moves += k; facing = k; return 'm';
    }
    reset();
    if (saved && typeof saved.m === 'string') for (const c of saved.m) step(c.toLowerCase());

    el.innerHTML = `<div class="sk-wrap">
      <div class="sk-head"><div><small>${L('TAHY', 'MOVES')}</small><b id="skMoves">0</b></div><div><small>${L('POSUNY', 'PUSHES')}</small><b id="skPushes">0</b></div><div class="sk-par" title="${L('Vyřeš nejvýš tolika posuny pro tři hvězdy', 'Solve within this many pushes for three stars')}"><small>${L('LIMIT', 'PAR')}</small><b>${P.par}</b></div></div>
      <svg class="sk" viewBox="-10 -10 ${W * S + 20} ${P.h * S + 20}">${DEFS}<g class="sk-map">${mapSVG(P, wall, S)}</g><g class="sk-hl"></g><g class="sk-fx"></g><g class="sk-boxes"></g><g class="sk-player"></g></svg>
      <div class="sk-pad" aria-label="${L('Ovládání', 'Controls')}"><button data-dir="u">${arrow(0)}</button><button data-dir="l">${arrow(270)}</button><button data-dir="d">${arrow(180)}</button><button data-dir="r">${arrow(90)}</button></div>
      <div class="k-tools">
        <button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button>
        <button class="k-tool" data-t="restart">${api.icon('erase')}<span>${L('Znovu', 'Restart')}</span></button>
        <button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button></div></div>`;
    function arrow(rot) { return `<svg viewBox="0 0 24 24" style="transform:rotate(${rot}deg)"><path d="M12 5l7 8h-4.5v6h-5v-6H5z" fill="currentColor"/></svg>`; }
    const svg = el.querySelector('svg.sk'), gB = el.querySelector('.sk-boxes'), gP = el.querySelector('.sk-player'), gH = el.querySelector('.sk-hl');
    const xy = i => [(i % W) * S, ((i / W) | 0) * S];
    // bedny mají stálé uzly (plynulý pohyb přes CSS transform)
    const boxEls = P.boxes.map(() => { const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'sk-box'); g.innerHTML = CRATE; gB.appendChild(g); return g; });
    gP.innerHTML = HERO;
    const gFx = el.querySelector('.sk-fx');
    // jiskry, když bedna dojede na cíl
    function sparkle(i) {
      const [x, y] = xy(i), g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'sk-spark'); g.setAttribute('transform', `translate(${x + S / 2} ${y + S / 2})`);
      g.innerHTML = [...Array(10)].map((_, k) => { const a = (k / 10) * Math.PI * 2; return `<circle r="5" style="--dx:${Math.cos(a) * 70}px;--dy:${Math.sin(a) * 70}px"/>`; }).join('') + `<circle class="ring" r="40"/>`;
      gFx.appendChild(g); setTimeout(() => g.remove(), 700);
    }
    let pushing = false, stepT = 0;
    const hero = gP.querySelector('.sk-hero');
    function render() {
      boxes.forEach((b, i) => {
        const [x, y] = xy(b), el2 = boxEls[i];
        el2.style.transform = `translate(${x}px, ${y}px)`;
        el2.classList.toggle('on', goals.has(b));
        el2.classList.toggle('dead', !goals.has(b) && !Wd.live[b]);
      });
      const [px, py] = xy(player);
      gP.style.transform = `translate(${px}px, ${py}px)`;
      hero.setAttribute('class', `sk-hero f-${facing}${pushing ? ' push' : ''}${stepT % 2 ? ' s1' : ''}`);
      el.querySelector('#skMoves').textContent = moves.length;
      const pe = el.querySelector('#skPushes'); pe.textContent = pushes; pe.classList.toggle('over', pushes > P.par);
    }
    const onGoal = () => boxes.filter(b => goals.has(b)).length;
    function after(res) {
      if (!res) { api.sound('error'); return; }
      const b = player + Wd.DIR[facing];
      api.sound(res === 'p' ? (goals.has(b) ? 'line' : 'place') : 'soft');
      pushing = res === 'p'; stepT++;
      if (res === 'p' && goals.has(b)) sparkle(b);
      render(); api.changed(); gH.innerHTML = '';
      if (res === 'p') {
        if (!goals.has(b) && !Wd.live[b]) api.toast(L('Tahle bedna už se na cíl nedostane. Vrať tah (Z).', "This crate can't reach a goal any more. Undo (Z)."));
      }
      check();
    }
    function move(k) { if (done || busy) return; queue = []; after(step(k)); }
    // chůze po cestě (klepnutí na pole): krok za krokem s animací
    function walk(path, then) {
      if (path === null) return;
      queue = path.split(''); busy = true;
      const tick = () => {
        if (!queue.length || done) { busy = false; if (then) then(); return; }
        const r = step(queue.shift()); pushing = r === 'p'; stepT++; render();
        if (r) api.sound(r === 'p' ? 'place' : 'soft');
        setTimeout(tick, 70);
      };
      tick(); api.changed();
    }
    function check() {
      if (done || onGoal() < boxes.length) return;
      done = true; svg.classList.add('won');
      const within = pushes <= P.par, hints = hintsUsed;
      const stars = within ? 3 : pushes <= P.par * 1.5 ? 2 : 1;
      if (within) api.data.par = (api.data.par || 0) + 1;
      setTimeout(() => api.solved({ title: P.name, stars: hints ? Math.min(2, stars) : stars, html: `<p class="k-muted">${L(`${moves.length} ${cz(moves.length, 'tah', 'tahy', 'tahů')}, ${pushes} ${cz(pushes, 'posun', 'posuny', 'posunů')} (limit ${P.par})`, `${moves.length} moves, ${pushes} pushes (par ${P.par})`)}${within ? ` · ${L('v limitu', 'within par')}` : ''}</p>` }), 1100);
    }
    function undo() {
      if (done || !moves.length) return;
      const m = moves.slice(0, -1); reset(); for (const c of m) step(c.toLowerCase());
      facing = m.length ? m[m.length - 1].toLowerCase() : 'd';
      api.sound('erase'); render(); api.changed(); gH.innerHTML = '';
    }
    function restart() { if (done) return; reset(); facing = 'd'; api.sound('erase'); render(); api.changed(); gH.innerHTML = ''; }
    // Uložené řešení: po i posunech jsou bedny v known[i] (seřazeno).
    const known = []; { let bx = P.boxes.slice(); known.push(bx.slice().sort((a, b) => a - b).join()); for (const [a, b] of P.sol) { bx = bx.map(x => (x === a ? b : x)); known.push(bx.slice().sort((x, y) => x - y).join()); } }
    function nextPush() {
      const i = known.indexOf(boxes.slice().sort((a, b) => a - b).join());
      if (i >= 0 && i < P.sol.length) { const [a, b] = P.sol[i], d = b - a; if (walkPath(Wd, boxes, player, a - d) !== null) return { box: a, dir: d }; }
      return solveNext(Wd, P, boxes, player, 40000);
    }
    function hint() {
      if (done || busy) return;
      const f = nextPush();
      if (!f) { api.toast(boxes.some(b => !goals.has(b) && !Wd.live[b]) ? L('Některá bedna uvízla. Vrať pár tahů zpět.', 'A crate is stuck. Undo a few moves.') : L('Odsud cestu nevidím. Zkus vrátit pár tahů.', "I can't find a way from here. Try undoing a few moves.")); return; }
      api.hint(); hintsUsed++; api.sound('star');
      const k = Object.keys(Wd.DIR).find(key => Wd.DIR[key] === f.dir);
      const path = walkPath(Wd, boxes, player, f.box - f.dir);
      const [bx, by] = xy(f.box);
      gH.innerHTML = `<rect class="sk-hint" x="${bx + 4}" y="${by + 4}" width="92" height="92" rx="16"/>`;
      walk(path, () => { if (!done) after(step(k)); });
    }

    // ── Ovládání: klávesy (onKey), přejetí, klepnutí, šipky ──
    let down = null;
    const cellAt = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); const x = Math.floor(p.x / S), y = Math.floor(p.y / S); return x >= 0 && y >= 0 && x < W && y < P.h ? y * W + x : -1; };
    svg.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; e.preventDefault(); });
    svg.addEventListener('pointerup', e => {
      if (!down || done) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
      if (Math.hypot(dx, dy) > 24) { move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); return; }
      if (busy) return;
      const c = cellAt(e); if (c < 0 || wall[c]) return;
      const bi = boxes.indexOf(c);
      if (bi >= 0) { const k = Object.keys(Wd.DIR).find(key => player + Wd.DIR[key] === c); if (k) move(k); else api.sound('error'); return; }
      const path = walkPath(Wd, boxes, player, c);
      if (path === null) api.sound('error'); else walk(path);
    });
    el.querySelector('.sk-pad').addEventListener('click', e => { const b = e.target.closest('[data-dir]'); if (b) move(b.dataset.dir); });
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t) return;
      if (t.dataset.t === 'undo') undo(); if (t.dataset.t === 'restart') restart(); if (t.dataset.t === 'hint') hint();
    });
    function fit() {
      const vw = (document.getElementById('kView') || el).clientWidth - 28, hh = innerHeight - (matchMedia('(pointer: coarse)').matches ? 330 : 230);
      const ratio = (W * S + 20) / (P.h * S + 20), s = Math.max(240, Math.min(vw, hh * ratio, 760));
      svg.style.width = s + 'px';
    }
    fit(); addEventListener('resize', fit);
    render();
    const KEYS = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' };
    return {
      getState: () => ({ m: moves, h: hintsUsed }),
      progress: () => onGoal() / boxes.length,
      destroy() { removeEventListener('resize', fit); queue = []; },
      onKey(e) {
        if (KEYS[e.key]) { e.preventDefault(); move(KEYS[e.key]); return; }
        if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') undo();
        if (e.key === 'r' || e.key === 'R') restart();
        if (e.key === 'h' || e.key === 'H') hint();
      },
      _solve() { boxes = P.goals.slice(); render(); check(); },
      _hint: hint,
    };
  }

  // úvodní obrázek: hotový sklad v nové kresbě, jedna bedna už na cíli
  function art(el) {
    const p = generate(Kit.hash('sokoban-art'), 'medium'), S = 100, W = p.w, wd = world(p), gs = new Set(p.goals);
    const crates = p.boxes.map((b, k) => { const at = k === 0 ? p.goals.find(g => !p.boxes.includes(g)) ?? b : b; return `<g class="sk-box${gs.has(at) ? ' on' : ''}" transform="translate(${(at % W) * S} ${((at / W) | 0) * S})">${CRATE}</g>`; }).join('');
    el.innerHTML = `<svg class="sk-art" viewBox="-10 -10 ${W * S + 20} ${p.h * S + 20}">${DEFS}${mapSVG(p, wd.wall, S)}${crates}<g transform="translate(${(p.player % W) * S} ${((p.player / W) | 0) * S})">${HERO.replace('sk-hero', 'sk-hero f-r')}</g></svg>`;
  }

  return { DIFFS, generate, create, art, world, solveNext, walkPath };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'sokoban', title: 'SOKOBAN',
  tagline: Kit.L('Skladník ve vesmírném skladu. Dotlač bedny na zářící cíle a nezasekni se v rohu.', 'A warehouse keeper in a space depot. Push the crates onto the glowing goals without getting stuck.'),
  diffs: Sokoban.DIFFS, generate: Sokoban.generate, create: Sokoban.create, art: Sokoban.art,
  online: { kind: 'race' },
  rules: Kit.L(`<p>Dotlač všechny bedny na zářící cíle:</p>
    <ul><li>Chodíš nahoru, dolů, doleva a doprava. Bednu můžeš jen <b>tlačit</b>, ne táhnout.</li>
    <li>Najednou utlačíš jen <b>jednu</b> bednu. Bednu natlačenou do rohu už nevytáhneš, hra tě na to upozorní.</li>
    <li>Ovládání: šipky nebo WASD, přejetí prstem, šipky pod plánem, nebo klepni na pole a skladník tam dojde sám. Klepnutím na bednu vedle sebe ji posuneš.</li>
    <li>Z (nebo Zpět) vrátí tah, R začne znovu, H poradí další posun.</li>
    <li>Tři hvězdy za vyřešení v <b>limitu posunů</b> bez nápovědy.</li></ul>`,
    `<p>Push every crate onto a glowing goal:</p>
    <ul><li>Walk up, down, left and right. You can only <b>push</b> crates, never pull them.</li>
    <li>You can push only <b>one</b> crate at a time. A crate pushed into a corner is stuck for good; the game warns you.</li>
    <li>Controls: arrow keys or WASD, swipe, the arrows under the board, or tap a cell and the keeper walks there. Tap a crate next to you to push it.</li>
    <li>Z (or Undo) takes a move back, R restarts, H shows the next push.</li>
    <li>Three stars for solving within the <b>push par</b> without hints.</li></ul>`),
  achievements: [{ id: 'par25', name: Kit.L('Úsporný skladník', 'Thrifty Keeper'), desc: Kit.L('Vyřeš 25 skladů v limitu posunů', 'Solve 25 depots within the push par'), prog: s => [(s.data && s.data.par) || 0, 25] }],
});
