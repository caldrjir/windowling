'use strict';
// ── BOMBARĎÁK · jádro hry (sdílí ho hra i testy v Node) ──────────────────────
// Aréna 15×13: obvodová zeď a pevné sloupy na sudých souřadnicích, mezi nimi bedny, které jde
// rozbít bombou. Pod bednami se skrývají vylepšení (víc bomb, delší plamen, rychlost) a ve Výpravě
// i východ. Svět (createWorld) běží v pevných krocích a nic nekreslí; kreslí bombardak.js.
// Výprava: zneškodni všechny příšery a odejdi východem. Souboj: poslední živý bombarďák vyhrává
// (soupeře řídí botThink: utíká z dosahu bomb, sbírá vylepšení, boří bedny a útočí).
const BbCore = (() => {
  const W = 15, H = 13;
  const FUSE = 2.4, FLAME = 0.55, BURN = 0.5;
  const DIRS = { u: [0, -1], r: [1, 0], d: [0, 1], l: [-1, 0] }, ORDER = ['u', 'r', 'd', 'l'], OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };
  // příšery: rychlost v políčkách za sekundu, body, chytrost (0 bloudí, 1 jde po hráči), průchod bednami
  const ENEMY = {
    balonek: { speed: 1.5, pts: 100, smart: 0, pass: false, keep: 0.8 },
    kapka: { speed: 2.3, pts: 200, smart: 0, pass: false, keep: 0.55 },
    duch: { speed: 1.7, pts: 400, smart: 0.35, pass: true, keep: 0.6 },
    lovec: { speed: 2.5, pts: 800, smart: 0.75, chase: true, pass: false, keep: 0.5 },
  };
  const ITEM = { bomb: 1, fire: 2, speed: 3 };
  const idx = (x, y) => y * W + x;
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // o = { mode: 'adv' | 'battle', players, crates (0..1), enemies: { typ: počet }, extras: { bomb, fire, speed } }
  function generate(seed, o) {
    const r = rng(seed), g = new Uint8Array(W * H), hidden = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0)) g[idx(x, y)] = 1;
    const corners = [[1, 1], [W - 2, H - 2], [W - 2, 1], [1, H - 2]];
    const starts = o.mode === 'battle' ? corners.slice(0, o.players || 4) : [corners[0]];
    // u startu zůstane volno do tvaru L, aby šla položit první bomba a utéct
    const safe = new Set();
    for (const [sx, sy] of starts) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const x = sx + dx, y = sy + dy;
      if (x > 0 && y > 0 && x < W - 1 && y < H - 1 && !g[idx(x, y)] && (Math.abs(dx) + Math.abs(dy) < 2 || o.mode !== 'battle')) safe.add(idx(x, y));
    }
    for (let i = 0; i < W * H; i++) if (!g[i] && !safe.has(i) && r() < o.crates) g[i] = 2;
    const [sx, sy] = starts[0], dist = i => Math.abs((i % W) - sx) + Math.abs(Math.floor(i / W) - sy);
    // příšery daleko od startu (aspoň 8 kroků), na volných políčkách (když je jich málo, uvolní se bedny)
    const enemies = [];
    const want = Object.entries(o.enemies || {}).flatMap(([t, n]) => Array(n).fill(t));
    if (want.length) {
      let cand = [];
      for (let i = 0; i < W * H; i++) if (!g[i] && dist(i) >= 8) cand.push(i);
      if (cand.length < want.length * 2) {
        const extra = shuffle([...Array(W * H).keys()].filter(i => g[i] === 2 && dist(i) >= 8), r).slice(0, want.length * 2 - cand.length);
        for (const i of extra) g[i] = 0;
        cand = cand.concat(extra);
      }
      shuffle(cand, r);
      // nejdřív políčka, která od sebe nejsou těsně (příšery se rozprostřou)
      const taken = [];
      for (const t of want) {
        let k = cand.findIndex(i => taken.every(j => Math.abs((i % W) - (j % W)) + Math.abs(Math.floor(i / W) - Math.floor(j / W)) >= 3));
        if (k < 0) k = 0;
        const i = cand.splice(k, 1)[0];
        taken.push(i); enemies.push({ x: i % W, y: Math.floor(i / W), type: t });
      }
    }
    // východ a vylepšení pod bednami
    const crates = shuffle([...Array(W * H).keys()].filter(i => g[i] === 2), r);
    let exit = null;
    if (o.mode !== 'battle') {
      let k = crates.findIndex(i => dist(i) >= 7);
      if (k < 0) k = crates.findIndex(i => dist(i) >= 4);
      if (k >= 0) { const i = crates.splice(k, 1)[0]; exit = { x: i % W, y: Math.floor(i / W) }; }
      else { // bez beden (nemělo by nastat): východ volně v nejvzdálenějším rohu
        exit = { x: W - 2, y: H - 2 };
      }
    }
    for (const [name, n] of Object.entries(o.extras || {})) for (let k = 0; k < n && crates.length; k++) hidden[crates.pop()] = ITEM[name];
    return { W, H, mode: o.mode, g: Array.from(g), hidden: Array.from(hidden), starts, enemies, exit };
  }

  // ── Svět ──
  // opts = { players: [{ human, skill, bombs, fire, speed }], hurryAt, seed }
  function createWorld(L, opts = {}) {
    const w = {
      L, t: 0, mode: L.mode, g: Uint8Array.from(L.g), hidden: Uint8Array.from(L.hidden), items: new Uint8Array(W * H),
      flames: new Float32Array(W * H), shape: new Uint8Array(W * H), owner: new Int8Array(W * H).fill(-1),
      bombs: [], burning: [], events: [], over: null, endT: -1, hurryAt: opts.hurryAt || Infinity, hurryAcc: 0, hurryI: 0, spiral: null,
      exit: L.exit ? { x: L.exit.x, y: L.exit.y, seen: false, open: false } : null,
      rnd: rng((opts.seed || 1) ^ 0x9e3779b9), nextId: 1,
    };
    const ps = opts.players || [{ human: true }];
    w.players = ps.map((c, i) => ({
      i, kind: 'player', human: !!c.human, skill: c.skill == null ? 0.8 : c.skill, x: L.starts[i][0], y: L.starts[i][1], dir: 'd', moving: false,
      alive: true, deadT: 0, inv: 0, bombs: c.bombs || 1, fire: c.fire || 2, speed: c.speed || 0, kills: 0, wait: 0, tx: 0, ty: 0,
    }));
    w.enemies = L.enemies.map((e, i) => ({ i, kind: 'enemy', type: e.type, spec: ENEMY[e.type], x: e.x, y: e.y, dir: ORDER[Math.floor(w.rnd() * 4)], moving: false, alive: true, deadT: 0, tx: 0, ty: 0 }));
    return w;
  }
  const actors = w => w.players.concat(w.enemies);
  const bombAt = (w, x, y) => w.bombs.find(b => b.x === x && b.y === y);
  // je políčko pro aktéra `a` neprůchodné? (zeď, bedna, bomba, kterou neopustil)
  function solid(w, x, y, a) {
    if (x < 0 || y < 0 || x >= W || y >= H) return true;
    const c = w.g[idx(x, y)];
    if (c === 1) return true;
    if (c === 2 && !(a && a.spec && a.spec.pass)) return true;
    const b = bombAt(w, x, y);
    return !!(b && !(a && b.pass.includes(a)));
  }
  const speedOf = p => 3.0 + p.speed * 0.45;

  // Volný pohyb hráče: po ose, druhá souřadnice se na rohu sama dorovná (snadné zatáčení)
  function moveFree(w, a, dir, dist) {
    const [dx, dy] = DIRS[dir];
    a.dir = dir;
    const along = dx ? 'x' : 'y', side = dx ? 'y' : 'x', s = dx || dy;
    const cs = Math.round(a[side]), off = a[side] - cs;
    let moved = false;
    if (Math.abs(off) > 1e-4) {
      const ca = Math.round(a[along]);
      const nx = dx ? ca + dx : cs, ny = dx ? cs : ca + dy;
      // v pruhu před námi je volno (nebo právě stojíme uprostřed políčka) → dorovnat na střed pruhu
      if (!solid(w, nx, ny, a) || Math.abs(a[along] - ca) > 1e-4) {
        const st = Math.min(dist, Math.abs(off));
        a[side] -= Math.sign(off) * st; dist -= st; moved = true;
        if (Math.abs(a[side] - cs) < 1e-4) a[side] = cs; else return moved;
      } else {
        // nejbližší pruh je zavřený, ale druhý (kam už jsme kus zajeli) je volný → sklouznout tam
        const c2 = cs + Math.sign(off), nx2 = dx ? ca + dx : c2, ny2 = dx ? c2 : ca + dy;
        if (Math.abs(off) < 0.18 || solid(w, nx2, ny2, a) || solid(w, dx ? ca : c2, dx ? c2 : ca, a)) return false;
        a[side] = Math.abs(c2 - a[side]) <= dist ? c2 : a[side] + Math.sign(off) * dist;
        return true;
      }
    }
    a[side] = cs;
    const ca = Math.round(a[along]);
    let np = a[along] + s * dist;
    const nx = dx ? ca + dx : cs, ny = dx ? cs : ca + dy;
    if (solid(w, nx, ny, a) && s * (np - ca) > 0) np = s * (a[along] - ca) > 0 ? a[along] : ca;
    if (np !== a[along]) moved = true;
    a[along] = np;
    return moved;
  }

  // Pohyb po mřížce (příšery, boti): směr se volí jen uprostřed políčka funkcí pick
  function moveGrid(w, a, dist, pick) {
    let guard = 0;
    while (dist > 1e-6 && guard++ < 20) {
      const cx = Math.round(a.x), cy = Math.round(a.y);
      if (Math.abs(a.x - cx) + Math.abs(a.y - cy) < 1e-6) {
        a.x = cx; a.y = cy;
        const d = pick(a);
        if (!d || solid(w, cx + DIRS[d][0], cy + DIRS[d][1], a)) { a.moving = false; if (d) a.dir = d; return; }
        a.dir = d; a.tx = cx + DIRS[d][0]; a.ty = cy + DIRS[d][1];
      } else if (solid(w, a.tx, a.ty, a) && !(Math.abs(a.x - a.tx) < 0.5 && Math.abs(a.y - a.ty) < 0.5)) {
        // cíl se mezitím zavřel (padající zeď, bomba) → zpět na předchozí políčko
        const [dx, dy] = DIRS[a.dir];
        a.tx -= dx; a.ty -= dy; a.dir = OPP[a.dir];
      }
      const [dx, dy] = DIRS[a.dir];
      const rem = Math.abs(a.tx - a.x) + Math.abs(a.ty - a.y), st = Math.min(dist, rem);
      a.x += dx * st; a.y += dy * st; dist -= st; a.moving = true;
      if (st >= rem - 1e-9) { a.x = a.tx; a.y = a.ty; }
    }
  }

  function placeBomb(w, p) {
    if (!p.alive) return false;
    const x = Math.round(p.x), y = Math.round(p.y), i = idx(x, y);
    if (w.g[i] !== 0 || bombAt(w, x, y)) return false;
    if (w.bombs.filter(b => b.owner === p).length >= p.bombs) return false;
    const b = { id: w.nextId++, x, y, t: FUSE, range: p.fire, owner: p, pass: [] };
    for (const a of actors(w)) if (a.alive && Math.abs(a.x - x) < 1 && Math.abs(a.y - y) < 1) b.pass.push(a);
    w.bombs.push(b);
    w.events.push({ type: 'place', x, y, p: p.i });
    return true;
  }

  function setFlame(w, x, y, bits, owner) {
    const i = idx(x, y);
    w.flames[i] = FLAME; w.shape[i] |= bits; w.owner[i] = owner;
  }
  function explode(w, b) {
    w.bombs.splice(w.bombs.indexOf(b), 1);
    const own = b.owner ? b.owner.i : -1;
    w.events.push({ type: 'boom', x: b.x, y: b.y, range: b.range });
    setFlame(w, b.x, b.y, 4, own);
    for (const d of ORDER) {
      const [dx, dy] = DIRS[d];
      for (let k = 1; k <= b.range; k++) {
        const x = b.x + dx * k, y = b.y + dy * k, i = idx(x, y), c = w.g[i];
        if (c === 1) break;
        if (c === 2) { if (!w.burning.some(q => q.i === i)) { w.burning.push({ i, t: BURN, owner: own }); } break; }
        setFlame(w, x, y, dx ? 1 : 2, own);
        const ob = bombAt(w, x, y);
        if (ob) ob.t = Math.min(ob.t, 0);
        if (w.items[i]) { w.items[i] = 0; w.events.push({ type: 'itemburn', x, y }); }
      }
    }
  }

  // hraně arény se po čase zavírají (Souboj): spirála od okraje dovnitř
  function spiralOf(w) {
    const out = [];
    let x0 = 1, y0 = 1, x1 = W - 2, y1 = H - 2;
    while (x0 <= x1 && y0 <= y1) {
      for (let x = x0; x <= x1; x++) out.push(idx(x, y0));
      for (let y = y0 + 1; y <= y1; y++) out.push(idx(x1, y));
      if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push(idx(x, y1));
      if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push(idx(x0, y));
      x0++; y0++; x1--; y1--;
    }
    return out.filter(i => w.g[i] !== 1).slice(0, -9);
  }
  function dropWall(w, i) {
    const x = i % W, y = Math.floor(i / W);
    w.g[i] = 1; w.items[i] = 0; w.hidden[i] = 0; w.flames[i] = 0; w.shape[i] = 0;
    w.burning = w.burning.filter(q => q.i !== i);
    const b = bombAt(w, x, y); if (b) w.bombs.splice(w.bombs.indexOf(b), 1);
    w.events.push({ type: 'wall', x, y });
    for (const a of actors(w)) if (a.alive && Math.abs(a.x - x) < 0.8 && Math.abs(a.y - y) < 0.8) kill(w, a, -1);
  }

  function kill(w, a, by) {
    if (!a.alive) return;
    a.alive = false; a.deadT = 0;
    w.events.push({ type: a.kind === 'enemy' ? 'enemy' : 'die', x: a.x, y: a.y, i: a.i, by, pts: a.spec ? a.spec.pts : 0, etype: a.type });
    if (by >= 0 && w.players[by] && w.players[by] !== a) w.players[by].kills++;
  }
  function respawn(w, p) {
    const [x, y] = w.L.starts[p.i];
    p.x = x; p.y = y; p.alive = true; p.deadT = 0; p.inv = 2.5; p.dir = 'd'; p.moving = false;
  }

  // Volba směru příšery uprostřed políčka
  function enemyDir(w, e) {
    const x = Math.round(e.x), y = Math.round(e.y), r = w.rnd;
    const open = ORDER.filter(d => !solid(w, x + DIRS[d][0], y + DIRS[d][1], e) && !(e.spec.chase && w.flames[idx(x + DIRS[d][0], y + DIRS[d][1])] > 0));
    if (!open.length) return null;
    const target = w.players.find(p => p.alive);
    if (target && e.spec.smart > 0 && r() < e.spec.smart) {
      const tx = Math.round(target.x), ty = Math.round(target.y);
      if (e.spec.chase) {
        // lovec: nejkratší cestou, pokud je hráč do 10 kroků
        const step = bfsStep(w, x, y, i => i === idx(tx, ty), i => !solid(w, i % W, Math.floor(i / W), e), 10);
        if (step) return step;
      } else {
        const best = open.slice().sort((a, b) => Math.abs(x + DIRS[a][0] - tx) + Math.abs(y + DIRS[a][1] - ty) - (Math.abs(x + DIRS[b][0] - tx) + Math.abs(y + DIRS[b][1] - ty)))[0];
        if (best) return best;
      }
    }
    if (open.includes(e.dir) && r() < e.spec.keep) return e.dir;
    const fwd = open.filter(d => d !== OPP[e.dir]);
    const pool = fwd.length ? fwd : open;
    return pool[Math.floor(r() * pool.length)];
  }
  // první krok nejkratší cesty k políčku, které splní goal
  function bfsStep(w, sx, sy, goal, pass, maxD) {
    const prev = new Int16Array(W * H).fill(-1), dist = new Int16Array(W * H).fill(-1), s = idx(sx, sy), q = [s];
    dist[s] = 0;
    for (let k = 0; k < q.length; k++) {
      const i = q[k];
      if (i !== s && goal(i)) { let c = i; while (prev[c] !== s) c = prev[c]; return dirTo(s, c); }
      if (dist[i] >= maxD) continue;
      for (const d of ORDER) {
        const n = i + DIRS[d][0] + DIRS[d][1] * W;
        if (dist[n] >= 0 || !pass(n)) continue;
        dist[n] = dist[i] + 1; prev[n] = i; q.push(n);
      }
    }
    return null;
  }
  const dirTo = (a, b) => (b === a + 1 ? 'r' : b === a - 1 ? 'l' : b === a + W ? 'd' : 'u');

  // ── Umělá inteligence soupeřů ──
  function blastTiles(w, x, y, range) {
    const out = [idx(x, y)];
    for (const d of ORDER) for (let k = 1; k <= range; k++) {
      const nx = x + DIRS[d][0] * k, ny = y + DIRS[d][1] * k, c = w.g[idx(nx, ny)];
      if (c === 1) break;
      out.push(idx(nx, ny));
      if (c === 2) break;
    }
    return out;
  }
  // za kolik sekund bouchne každé políčko (Infinity = bezpečné); bomby v dosahu jiných bouchnou s nimi
  function dangerMap(w, extra) {
    const D = new Float32Array(W * H).fill(Infinity);
    for (let i = 0; i < W * H; i++) if (w.flames[i] > 0) D[i] = 0;
    for (const q of w.burning) D[q.i] = 0;
    const bs = w.bombs.map(b => ({ x: b.x, y: b.y, t: b.t, range: b.range }));
    if (extra) bs.push(extra);
    const tiles = bs.map(b => blastTiles(w, b.x, b.y, b.range));
    for (let guard = 0, changed = true; changed && guard < 8; guard++) {
      changed = false;
      for (let a = 0; a < bs.length; a++) for (let b = 0; b < bs.length; b++) {
        if (a !== b && bs[a].t < bs[b].t && tiles[a].includes(idx(bs[b].x, bs[b].y))) { bs[b].t = bs[a].t; changed = true; }
      }
    }
    for (let a = 0; a < bs.length; a++) for (const i of tiles[a]) D[i] = Math.min(D[i], bs[a].t);
    return D;
  }
  // BFS po bezpečných políčkách; vrací seznam dosažených políček { i, steps, first }
  function reach(w, p, D, maxSteps) {
    const s = idx(Math.round(p.x), Math.round(p.y)), sp = speedOf(p), out = [];
    const seen = new Int16Array(W * H).fill(-1), first = new Array(W * H);
    seen[s] = 0; first[s] = null;
    const q = [s];
    const enemyNear = i => w.enemies.some(e => e.alive && Math.abs(e.x - (i % W)) + Math.abs(e.y - Math.floor(i / W)) < 2.2);
    for (let k = 0; k < q.length; k++) {
      const i = q[k];
      out.push({ i, steps: seen[i], first: first[i] });
      if (seen[i] >= maxSteps) continue;
      for (const d of ORDER) {
        const n = i + DIRS[d][0] + DIRS[d][1] * W;
        if (seen[n] >= 0 || w.g[n] !== 0 || bombAt(w, n % W, Math.floor(n / W))) continue;
        // okno, kdy bot na políčku bude, se nesmí překrýt s plamenem
        const tIn = (seen[i] + 0.5) / sp, tOut = (seen[i] + 1.6) / sp;
        if (D[n] !== Infinity && !(tOut < D[n] - 0.15 || tIn > D[n] + FLAME + 0.15)) continue;
        if (enemyNear(n)) continue;
        seen[n] = seen[i] + 1; first[n] = first[i] || d; q.push(n);
      }
    }
    return out;
  }
  function hitsTarget(w, p, i) {
    const tiles = blastTiles(w, i % W, Math.floor(i / W), p.fire);
    let crates = 0, foes = 0;
    for (const t of tiles) if (w.g[t] === 2 && !w.burning.some(q => q.i === t)) crates++;
    const foesList = w.mode === 'battle' ? w.players.filter(o => o !== p && o.alive) : w.enemies.filter(e => e.alive);
    for (const o of foesList) if (tiles.includes(idx(Math.round(o.x), Math.round(o.y)))) foes++;
    return { crates, foes };
  }
  // dá se po položení bomby na místě utéct?
  function canEscape(w, p) {
    const x = Math.round(p.x), y = Math.round(p.y);
    const D = dangerMap(w, { x, y, t: FUSE, range: p.fire });
    return reach(w, p, D, 12).some(r => D[r.i] === Infinity && r.steps / speedOf(p) < FUSE - 0.6);
  }
  function botThink(w, p) {
    const D = dangerMap(w), here = idx(Math.round(p.x), Math.round(p.y)), r = w.rnd;
    const R = reach(w, p, D, 14);
    if (D[here] !== Infinity) {
      // nebezpečí: nejbližší bezpečné políčko
      const safe = R.filter(q => D[q.i] === Infinity && q.first);
      if (safe.length) return safe[0].first;
      const best = R.filter(q => q.first).sort((a, b) => D[b.i] - D[a.i])[0];
      return best ? best.first : null;
    }
    const mine = w.bombs.filter(b => b.owner === p).length, canBomb = mine < p.bombs;
    // příšera blízko: bomba, když je v dosahu, jinak ustoupit co nejdál
    const ex = here % W, ey = Math.floor(here / W), near = w.enemies.filter(e => e.alive && Math.abs(e.x - ex) + Math.abs(e.y - ey) < 3.2);
    if (near.length) {
      if (canBomb && hitsTarget(w, p, here).foes && canEscape(w, p)) { placeBomb(w, p); return botThink(w, p); }
      const far = q => Math.min(...near.map(e => Math.abs(e.x - (q.i % W)) + Math.abs(e.y - Math.floor(q.i / W))));
      const opt = R.filter(q => q.first && q.steps <= 4 && D[q.i] === Infinity).sort((a, b) => far(b) - b.steps * 0.3 - (far(a) - a.steps * 0.3))[0];
      if (opt && far(opt) > far({ i: here })) return opt.first;
    }
    // na místě: vyplatí se bomba?
    if (canBomb) {
      const h = hitsTarget(w, p, here);
      if ((h.foes || h.crates) && r() < 0.35 + p.skill * 0.65 && canEscape(w, p)) {
        placeBomb(w, p);
        return botThink(w, p);
      }
    }
    // cíl: vylepšení, místo na útok, bedny; východ, když už nejsou příšery
    let best = null, bestV = -Infinity;
    for (const q of R) {
      if (D[q.i] !== Infinity) continue;
      let v = 0;
      if (w.items[q.i]) v = 4;
      if (w.exit && w.exit.open && w.exit.seen && q.i === idx(w.exit.x, w.exit.y)) v = 10;
      if (canBomb && v < 3 && q.steps <= 10) {
        const h = hitsTarget(w, p, q.i);
        v = Math.max(v, h.foes ? 3 : 0, h.crates ? 1 + h.crates * 0.3 : 0);
      }
      if (!v && w.mode === 'battle') {
        // jinak se přibližovat k soupeři
        const foe = w.players.find(o => o !== p && o.alive);
        if (foe) v = 0.4 - (Math.abs(foe.x - (q.i % W)) + Math.abs(foe.y - Math.floor(q.i / W))) * 0.03;
      }
      v -= q.steps * 0.22;
      if (v > bestV) { bestV = v; best = q; }
    }
    // méně zkušení boti občas zabloudí
    if (r() > p.skill * 0.9 + 0.1) {
      const opts = R.filter(q => q.steps === 1 && D[q.i] === Infinity);
      if (opts.length) return opts[Math.floor(r() * opts.length)].first;
    }
    if (best && best.first) return best.first;
    return null;
  }

  // ── Krok světa ──
  // input = { dir: 'u'|'r'|'d'|'l'|null, bomb: bool } pro hráče-člověka
  function step(w, dt, input = {}) {
    const n = Math.max(1, Math.ceil(dt / 0.016)), h = dt / n;
    for (let k = 0; k < n && !w.over; k++) sub(w, h, input);
  }
  function sub(w, h, input) {
    w.t += h;
    for (const p of w.players) {
      if (!p.alive) { p.deadT += h; continue; }
      if (p.inv > 0) p.inv -= h;
      const sp = speedOf(p) * h;
      if (p.human && !p.auto) {
        if (input.bomb) { placeBomb(w, p); input.bomb = false; }
        p.moving = input.dir ? moveFree(w, p, input.dir, sp) : false;
      } else if (p.wait > 0) { p.wait -= h; p.moving = false; }
      else moveGrid(w, p, sp, a => { const d = botThink(w, a); if (!d) a.wait = 0.1 + w.rnd() * 0.1; return d; });
    }
    for (const b of w.bombs) b.pass = b.pass.filter(a => a.alive && Math.abs(a.x - b.x) < 0.98 && Math.abs(a.y - b.y) < 0.98);
    for (const e of w.enemies) {
      if (!e.alive) { e.deadT += h; continue; }
      moveGrid(w, e, e.spec.speed * h, a => enemyDir(w, a));
    }
    for (const b of w.bombs) b.t -= h;
    for (let b = w.bombs.find(q => q.t <= 0); b; b = w.bombs.find(q => q.t <= 0)) explode(w, b);
    for (let i = 0; i < W * H; i++) if (w.flames[i] > 0) { w.flames[i] -= h; if (w.flames[i] <= 0) { w.flames[i] = 0; w.shape[i] = 0; } }
    for (const q of w.burning) q.t -= h;
    for (const q of w.burning.filter(q => q.t <= 0)) {
      w.g[q.i] = 0;
      if (w.hidden[q.i]) { w.items[q.i] = w.hidden[q.i]; w.hidden[q.i] = 0; }
      if (w.exit && q.i === idx(w.exit.x, w.exit.y)) w.exit.seen = true;
      w.events.push({ type: 'crate', x: q.i % W, y: Math.floor(q.i / W), by: q.owner });
    }
    w.burning = w.burning.filter(q => q.t > 0);
    // zavírání arény
    if (w.t >= w.hurryAt) {
      if (!w.spiral) { w.spiral = spiralOf(w); w.events.push({ type: 'hurry' }); }
      w.hurryAcc += h;
      while (w.hurryAcc >= 0.28 && w.hurryI < w.spiral.length) { w.hurryAcc -= 0.28; dropWall(w, w.spiral[w.hurryI++]); }
    }
    // plameny, dotyk příšer, vylepšení
    for (const a of actors(w)) {
      if (!a.alive) continue;
      const i = idx(Math.round(a.x), Math.round(a.y));
      if (w.flames[i] > 0 && !(a.inv > 0)) kill(w, a, w.owner[i]);
    }
    for (const p of w.players) {
      if (!p.alive) continue;
      if (!(p.inv > 0)) for (const e of w.enemies) if (e.alive && Math.abs(e.x - p.x) < 0.62 && Math.abs(e.y - p.y) < 0.62) { kill(w, p, -1); break; }
      if (!p.alive) continue;
      const x = Math.round(p.x), y = Math.round(p.y), i = idx(x, y), it = w.items[i];
      if (it) {
        w.items[i] = 0;
        if (it === 1) p.bombs = Math.min(8, p.bombs + 1); else if (it === 2) p.fire = Math.min(8, p.fire + 1); else p.speed = Math.min(4, p.speed + 1);
        w.events.push({ type: 'item', x, y, item: it, p: p.i });
      }
    }
    if (w.exit && !w.exit.open && w.enemies.every(e => !e.alive)) { w.exit.open = true; w.events.push({ type: 'open' }); }
    if (w.mode !== 'battle') {
      const p = w.players[0];
      if (p.alive && w.exit && w.exit.open && w.exit.seen && Math.abs(p.x - w.exit.x) < 0.3 && Math.abs(p.y - w.exit.y) < 0.3) w.over = { win: true };
    } else {
      const alive = w.players.filter(p => p.alive);
      if (alive.length <= 1 && w.endT < 0) w.endT = 1.2;
      if (w.endT >= 0) { w.endT -= h; if (w.endT <= 0) { const last = w.players.filter(p => p.alive); w.over = { winner: last.length === 1 ? last[0].i : -1 }; } }
    }
  }

  return { W, H, FUSE, FLAME, BURN, DIRS, ORDER, OPP, ENEMY, ITEM, idx, rng, generate, createWorld, step, placeBomb, respawn, solid, moveFree, botThink, dangerMap, blastTiles, speedOf };
})();
if (typeof module !== 'undefined') module.exports = BbCore;
