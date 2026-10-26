'use strict';
// ── PTAČÍ POMSTA · jádro ────────────────────────────────────────────────────
// Generátor úrovní a fyzika (planck.js, port Box2D). Běží v prohlížeči i v Node (ladění úrovní).
// Souřadnice v metrech, y nahoru, země y = 0. Úroveň je celá dána semínkem, stejně tak simulace
// (pevný krok), takže denní výzva i úrovně Cesty jsou pro všechny stejné.
(function (root) {
  const W = 24, SLING = { x: 3.4, y: 2.35 }, VMAX = 15.5, PULL = 2.1, G = 10, DT = 1 / 60;
  const MAT = {
    wood: { density: 0.7, friction: 0.7, rest: 0.08, hp: 2.4, pts: 500 },
    glass: { density: 0.5, friction: 0.35, rest: 0.05, hp: 1.1, pts: 300 },
    stone: { density: 2.1, friction: 0.85, rest: 0.03, hp: 6.5, pts: 800 },
    rock: { density: 0, friction: 0.9, rest: 0.02, hp: Infinity, pts: 0 },
  };
  const PIGS = { s: { r: 0.32, hp: 1.3 }, m: { r: 0.42, hp: 2 }, l: { r: 0.55, hp: 3.2 }, k: { r: 0.5, hp: 4.6 } }; // k = s helmou
  const BIRDS = {
    red: { r: 0.34, density: 4.2 },
    yellow: { r: 0.32, density: 3.6 },
    blue: { r: 0.24, density: 4.2 },
    black: { r: 0.4, density: 4.6 },
  };
  // násobek poškození podle ptáka a materiálu (žlutý prorazí dřevo, modrý sklo, černý kámen výbuchem)
  const BONUS = { yellow: { wood: 2.2 }, blue: { glass: 3, wood: 0.6, stone: 0.4 }, red: {}, black: { stone: 1.4 } };
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ── Generátor ── tier 0–5: počet staveb, materiály, výška, druhy ptáků
  function genLevel(seed, tier) {
    const r = rngOf(seed), pick = a => a[Math.floor(r() * a.length)];
    const blocks = [], pigs = [];
    const T = 0.22; // tloušťka trámu
    const matFor = () => { const x = r(); return tier < 1 ? (x < 0.6 ? 'wood' : 'glass') : tier < 3 ? (x < 0.5 ? 'wood' : x < 0.8 ? 'glass' : 'stone') : (x < 0.4 ? 'wood' : x < 0.65 ? 'glass' : 'stone'); };
    const box = (x, y, w, h, mat) => blocks.push({ x, y, w, h, mat });
    // nahoru jen stejný nebo lehčí materiál, ať se stavba nezřítí vlastní vahou
    const RANK = { glass: 0, wood: 1, stone: 2 };
    const lighter = mat => { const m = matFor(); return RANK[m] <= RANK[mat] ? m : mat; };
    const pig = (x, y0, size) => pigs.push({ x, y: y0 + PIGS[size].r + 0.01, size });
    // chatka: dva sloupky a střecha; vrací výšku střechy
    function hut(xc, y0, w, H, mat, inside) {
      box(xc - w / 2 + T / 2, y0 + H / 2, T, H, mat);
      box(xc + w / 2 - T / 2, y0 + H / 2, T, H, mat);
      const roofMat = r() < 0.7 || mat === 'glass' ? mat : lighter(mat);
      box(xc, y0 + H + T / 2, w + 0.3, T, roofMat);
      if (inside) pig(xc, y0, inside);
      return y0 + H + T;
    }
    function tower(xc, y0, levels) {
      const w = 1.4 + r() * 0.6; let y = y0, below = 'stone';
      for (let i = 0; i < levels; i++) {
        const H = 1 + r() * 0.35, mat = lighter(below); below = mat;
        y = hut(xc, y, w - i * 0.12, H, mat, r() < 0.75 ? (H > 1.15 ? pick(['m', 'm', 'k']) : 's') : null);
      }
      if (r() < 0.7) pig(xc, y, tier > 2 && r() < 0.4 ? 'k' : 'm');
      return w + 0.3;
    }
    function pyramid(xc, y0) {
      const n = 3 + Math.floor(r() * 2 + tier * 0.25), s = 0.55, mat = matFor();
      for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) box(xc + (j - (n - i - 1) / 2) * (s + 0.01), y0 + s / 2 + i * s, s, s, mat);
      pig(xc, y0 + n * s, 'm');
      return n * (s + 0.01);
    }
    function fort(xc, y0) {
      // široká stavba: tři sloupky, dvě střechy, skleněné okno a prase uvnitř každé části
      const w = 1.3, H = 1.1, mat = matFor();
      box(xc - w, y0 + H / 2, T, H, mat); box(xc, y0 + H / 2, T, H, mat); box(xc + w, y0 + H / 2, T, H, mat);
      box(xc - w / 2, y0 + H + T / 2, w + 0.2, T, mat); box(xc + w / 2, y0 + H + T / 2, w + 0.2, T, mat);
      pig(xc - w / 2, y0, 's'); pig(xc + w / 2, y0, r() < 0.5 ? 's' : 'm');
      const y1 = y0 + H + T;
      box(xc - w / 2 + 0.1, y1 + 0.45, T, 0.9, 'glass'); box(xc + w / 2 - 0.1, y1 + 0.45, T, 0.9, 'glass');
      box(xc, y1 + 0.9 + T / 2, w + 0.5, T, lighter('wood'));
      if (r() < 0.8) pig(xc, y1, 'm');
      return 2 * w + 0.4;
    }
    function rockHut(xc) {
      // skála (nezničitelná) a na ní chatka
      const rw = 2.4 + r() * 0.8, rh = 0.8 + r() * 1.4;
      blocks.push({ x: xc, y: rh / 2, w: rw, h: rh, mat: 'rock' });
      hut(xc, rh, 1.3 + r() * 0.4, 1.0 + r() * 0.3, matFor(), r() < 0.5 ? 'm' : 's');
      return rw;
    }
    const kinds = tier < 1 ? [tower, pyramid] : tier < 3 ? [tower, pyramid, fort, rockHut] : [tower, tower, fort, rockHut, pyramid];
    const count = Math.min(3, 1 + Math.floor(tier / 2 + r() * 1.2));
    let x = 11 + r() * 1.5;
    for (let i = 0; i < count && x < W - 3; i++) {
      const fn = pick(kinds), lv = fn === tower ? Math.min(tier >= 4 ? 4 : 3, 1 + Math.floor(r() * (1.5 + tier * 0.6))) : 0;
      // nejdřív odhad šířky, pak postavit se středem tak, aby se stavby nepřekrývaly
      const est = fn === fort ? 3 : fn === rockHut ? 3.2 : fn === pyramid ? 2.6 : 2.2;
      const xc = x + est / 2;
      if (xc + est / 2 > W - 0.5) break;
      fn(xc, 0, lv);
      x += est + 0.8 + r() * 1.0;
    }
    if (!pigs.length) pig(18, 0, 'm');
    // ptáci: o jednoho víc než prasat, nové druhy s vyšší úrovní
    const pool = ['red', ...(tier >= 1 ? ['yellow'] : []), ...(tier >= 2 ? ['blue'] : []), ...(tier >= 3 ? ['black'] : [])];
    const nb = Math.max(3, Math.min(6, pigs.length + (tier < 2 ? 2 : 1)));
    const birds = []; for (let i = 0; i < nb; i++) birds.push(i === 0 ? 'red' : pick(pool));
    return { blocks, pigs, birds, tier };
  }

  // ── Simulace ──
  function Sim(planck, spec) {
    const V = planck.Vec2, world = new planck.World({ gravity: V(0, -G) });
    world.createBody().createFixture(planck.Edge(V(-20, 0), V(W + 40, 0)), { friction: 0.9 });
    const S = { score: 0, phase: 'aim', birdsLeft: spec.birds.slice(), bird: null, flyers: [], spent: [], events: [], pigsTotal: spec.pigs.length, quiet: 0, flyT: 0, armed: true, time: 0, shots: 0 };
    let damageOn = false;
    const hits = new Map();
    for (const b of spec.blocks) {
      const m = MAT[b.mat], body = world.createBody({ type: b.mat === 'rock' ? 'static' : 'dynamic', position: V(b.x, b.y), angle: b.a || 0 });
      body.createFixture(planck.Box(b.w / 2, b.h / 2), { density: m.density, friction: m.friction, restitution: m.rest });
      body.setUserData({ type: 'block', mat: b.mat, w: b.w, h: b.h, hp: m.hp * Math.max(0.6, b.w * b.h / 0.3) ** 0.35, max: 0 });
      body.getUserData().max = body.getUserData().hp;
    }
    for (const p of spec.pigs) {
      const d = PIGS[p.size], body = world.createBody({ type: 'dynamic', position: V(p.x, p.y), angularDamping: 3, linearDamping: 0.1 });
      body.createFixture(planck.Circle(d.r), { density: 0.7, friction: 0.9, restitution: 0.15 });
      body.setUserData({ type: 'pig', size: p.size, r: d.r, hp: d.hp, max: d.hp, blink: 0 });
    }
    world.on('post-solve', (c, imp) => {
      if (!damageOn) return;
      let sum = 0; for (const n of imp.normalImpulses) sum += n;
      // klidová váha stavby dává každý krok malý impulz, poškozují jen nárazy nad ním
      sum -= 0.45; if (sum <= 0) return;
      const a = c.getFixtureA().getBody(), b = c.getFixtureB().getBody();
      const ua = a.getUserData(), ub = b.getUserData();
      for (const [me, other, um, uo] of [[a, b, ua, ub], [b, a, ub, ua]]) {
        if (!um || um.type === 'bird') continue;
        let k = 1;
        if (uo && uo.type === 'bird') { k = (BONUS[uo.kind] || {})[um.mat] || 1; if (um.type === 'pig') k = 1.6; }
        hits.set(me, (hits.get(me) || 0) + sum * k * (um.type === 'pig' ? 1 : 0.9));
      }
      for (const u of [ua, ub]) if (u && u.type === 'bird' && !u.hitT) u.hitT = S.time;
    });
    const live = type => { const out = []; for (let b = world.getBodyList(); b; b = b.getNext()) { const u = b.getUserData(); if (u && u.type === type) out.push(b); } return out; };
    function kill(body, why) {
      const u = body.getUserData(), p = body.getPosition();
      if (u.type === 'pig') { S.score += 5000; S.events.push({ kind: 'pig', x: p.x, y: p.y, r: u.r }); }
      else if (u.type === 'block') { S.score += MAT[u.mat].pts; S.events.push({ kind: 'break', mat: u.mat, x: p.x, y: p.y, a: body.getAngle(), w: u.w, h: u.h }); }
      world.destroyBody(body);
    }
    // usazení stavby bez poškození
    for (let i = 0; i < 90; i++) world.step(DT);
    damageOn = true;

    function readyBird() {
      if (S.bird || !S.birdsLeft.length) return;
      S.bird = { kind: S.birdsLeft.shift() };
      S.phase = 'aim';
    }
    readyBird();
    function launch(px, py) {
      // px, py = vytažení praku (m, od kapsy praku); výstřel opačným směrem
      if (S.phase !== 'aim' || !S.bird) return false;
      const len = Math.hypot(px, py); if (len < 0.25) return false;
      const k = Math.min(1, len / PULL), dx = -px / len, dy = -py / len, sp = VMAX * k;
      const d = BIRDS[S.bird.kind];
      const x0 = SLING.x + px / len * Math.min(len, PULL), y0 = SLING.y + py / len * Math.min(len, PULL);
      const body = world.createBody({ type: 'dynamic', position: V(x0, y0), bullet: true, angularDamping: 1.2 });
      body.createFixture(planck.Circle(d.r), { density: d.density, friction: 0.8, restitution: 0.3 });
      body.setLinearVelocity(V(dx * sp, dy * sp));
      body.setUserData({ type: 'bird', kind: S.bird.kind, r: d.r, hitT: 0, born: S.time });
      for (const old of S.spent) world.destroyBody(old);
      S.spent = [];
      S.flyers = [body]; S.bird = null; S.phase = 'fly'; S.flyT = 0; S.quiet = 0; S.armed = true; S.shots++;
      S.events.push({ kind: 'launch', x: x0, y: y0 });
      return true;
    }
    function explode(body) {
      const c = body.getPosition(), R = 3.2;
      for (let b = world.getBodyList(); b; b = b.getNext()) {
        const u = b.getUserData(); if (!u || u.type === 'bird' || !b.isDynamic()) continue;
        const p = b.getWorldCenter(), dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
        if (d > R) continue;
        const f = (1 - d / R), m = b.getMass();
        b.applyLinearImpulse(V(dx / (d || 1) * f * 14 * Math.sqrt(m + 0.3), (dy / (d || 1) * f * 14 + 3 * f) * Math.sqrt(m + 0.3)), p, true);
        hits.set(b, (hits.get(b) || 0) + f * 4.5 * ((BONUS.black[u.mat]) || 1));
      }
      S.events.push({ kind: 'boom', x: c.x, y: c.y });
      S.flyers = S.flyers.filter(f => f !== body); world.destroyBody(body);
    }
    // schopnost ptáka (klepnutí za letu)
    function ability() {
      if (S.phase !== 'fly' || !S.armed || !S.flyers.length) return false;
      const b = S.flyers[0], u = b.getUserData(); if (u.hitT) return false;
      S.armed = false;
      const v = b.getLinearVelocity(), p = b.getPosition();
      if (u.kind === 'yellow') { const s = Math.hypot(v.x, v.y) || 1; b.setLinearVelocity(V(v.x / s * 23, v.y / s * 23)); S.events.push({ kind: 'dash', x: p.x, y: p.y }); return true; }
      if (u.kind === 'blue') {
        for (const da of [-0.2, 0.2]) {
          const c = Math.cos(da), s = Math.sin(da), nb = world.createBody({ type: 'dynamic', position: V(p.x, p.y + da), bullet: true, angularDamping: 1.2 });
          nb.createFixture(planck.Circle(BIRDS.blue.r), { density: BIRDS.blue.density, friction: 0.8, restitution: 0.3 });
          nb.setLinearVelocity(V(v.x * c - v.y * s, v.x * s + v.y * c));
          nb.setUserData({ type: 'bird', kind: 'blue', r: BIRDS.blue.r, hitT: 0, born: S.time });
          S.flyers.push(nb);
        }
        S.events.push({ kind: 'split', x: p.x, y: p.y }); return true;
      }
      if (u.kind === 'black') { explode(b); return true; }
      S.events.push({ kind: 'cry', x: p.x, y: p.y }); return true;
    }
    function step() {
      world.step(DT, 8, 3); S.time += DT;
      for (const [b, d] of hits) { const u = b.getUserData(); if (!u || u.hp === undefined) continue; u.hp -= d; if (u.type === 'pig') u.blink = 0.3; if (u.hp <= 0) kill(b); }
      hits.clear();
      for (let b = world.getBodyList(); b; b = b.getNext()) {
        const u = b.getUserData(); if (!u) continue;
        if (u.type === 'pig' && u.blink > 0) u.blink -= DT;
        const p = b.getPosition();
        if (p.y < -4 || p.x < -6 || p.x > W + 14) { if (u.type === 'bird') { S.flyers = S.flyers.filter(f => f !== b); world.destroyBody(b); } else kill(b); }
      }
      // černý pták vybuchne sám 1,5 s po prvním nárazu
      for (const f of S.flyers.slice()) { const u = f.getUserData(); if (u.kind === 'black' && u.hitT && S.time - u.hitT > 1.5) explode(f); }
      if (S.phase === 'aim' && S.flyT >= 0 && !live('pig').length) { S.phase = 'won'; S.score += 10000 * (S.birdsLeft.length + (S.bird ? 1 : 0)); S.bird = null; S.events.push({ kind: 'won' }); }
      if (S.phase === 'fly') {
        S.flyT += DT;
        let moving = false;
        for (let b = world.getBodyList(); b; b = b.getNext()) if (b.isDynamic() && b.isAwake() && b.getLinearVelocity().lengthSquared() > 0.05) { moving = true; break; }
        S.quiet = moving ? 0 : S.quiet + DT;
        const pigsLeft = live('pig').length;
        if ((S.quiet > 0.6 && S.flyT > 1) || S.flyT > 9 || (pigsLeft === 0 && S.flyT > 1.5 && S.quiet > 0.2)) {
          S.spent = S.flyers.slice(); S.flyers = [];
          if (pigsLeft === 0) { S.phase = 'won'; S.score += 10000 * S.birdsLeft.length; S.events.push({ kind: 'won' }); }
          else if (!S.birdsLeft.length) { S.phase = 'lost'; S.events.push({ kind: 'lost' }); }
          else readyBird();
        }
      }
    }
    // předpověď dráhy pro zaměřování (bez překážek)
    function aimPath(px, py, n = 26, dt = 0.07) {
      const len = Math.hypot(px, py); if (len < 0.25) return [];
      const k = Math.min(1, len / PULL), sp = VMAX * k, vx = -px / len * sp, vy = -py / len * sp;
      const x0 = SLING.x + px / len * Math.min(len, PULL), y0 = SLING.y + py / len * Math.min(len, PULL), out = [];
      for (let i = 1; i <= n; i++) { const t = i * dt; out.push([x0 + vx * t, y0 + vy * t - G * t * t / 2]); }
      return out;
    }
    // výstřel na bod (pro automat a testy): úhel pro danou rychlost, nízká nebo vysoká dráha
    function aimAt(tx, ty, power = 0.95, high = false) {
      const v = VMAX * power, dx = tx - SLING.x, dy = ty - SLING.y, disc = v ** 4 - G * (G * dx * dx + 2 * dy * v * v);
      if (disc < 0) return [-Math.cos(Math.PI / 4) * PULL * power, -Math.sin(Math.PI / 4) * PULL * power];
      const th = Math.atan((v * v + (high ? 1 : -1) * Math.sqrt(disc)) / (G * dx));
      return [-Math.cos(th) * PULL * power, -Math.sin(th) * PULL * power];
    }
    return { world, S, launch, ability, step, aimPath, aimAt, live, planck };
  }
  root.PtCore = { W, SLING, VMAX, PULL, G, DT, MAT, PIGS, BIRDS, genLevel, Sim, rngOf };
})(typeof window !== 'undefined' ? window : globalThis);
