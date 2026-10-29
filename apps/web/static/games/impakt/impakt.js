'use strict';
// ── IMPAKT · Windowling Hlavolamy ───────────────────────────────────────────
// Vodorovná vesmírná střílečka na motivy Space Impact: loď vlevo střílí sama, vlny nepřátel
// přilétají zprava, na konci sektoru čeká boss. Speciální zbraně (rakety, laser, štít) a dvojitá
// palba se sbírají z vybuchlých nosičů. Sektor se generuje ze semínka: denní je pro všechny stejný,
// Kampaň má pevná semínka (stejná hra pro všechny, žebříček podle skóre).
// Volitelný retro vzhled zeleného displeje starých mobilů.
const Impakt = (() => {
  const L = Kit.L;
  const FW = 240, FH = 144; // logické pole
  const DIFFS = [
    { id: 'sector', name: L('Sektor', 'Sector'), note: L('vlny nepřátel a boss', 'enemy waves and a boss'), par: 75 },
    { id: 'campaign', name: L('Kampaň', 'Campaign'), note: L('5 sektorů, stejné pro všechny', '5 sectors, the same for everyone'), metric: 'score' },
    { id: 'endless', name: L('Nekonečno', 'Endless'), note: L('sektor za sektorem, dokud vydržíš', 'sector after sector while you last'), metric: 'score' },
  ];
  const CAMPAIGN = 5;
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ── Sprity (# = pixel) ──
  const SPR = {
    ship: ['##..........', '####........', '.######.....', '.##########.', '.######.....', '####........', '##..........'],
    drone: ['..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#'],
    wave: ['.######.', '##....##', '#.####.#', '##....##', '.######.'],
    diver: ['....###..', '..#####..', '#########', '..#####..', '....###..'],
    shooter: ['...####...', '..######..', '##########', '#.##..##.#', '##########', '..##..##..'],
    rock: ['...####...', '.########.', '##.#######', '######.###', '##########', '###.######', '.#######..', '...####...'],
    mine: ['...#...', '.#####.', '.#.#.#.', '#######', '.#.#.#.', '.#####.', '...#...'],
    carrier: ['..######..', '.########.', '###.##.###', '##########', '.########.', '..#.##.#..'],
    bossA: ['............########....', '..........############..', '........######....######', '......#########..#######', '....####################', '..######################', '########.###.###.###.###', '########################', '########################', '########.###.###.###.###', '..######################', '....####################', '......#########..#######', '........######....######', '..........############..', '............########....'],
    bossB: ['......########......', '....############....', '..################..', '.####..######..####.', '####....####....####', '####..########..####', '####################', '.##################.', '..################..', '...##..##..##..##...', '..##..##....##..##..', '.##..##......##..##.', '##..##........##..##', '#...#..........#...#'],
    bossC: ['......######......', '....##########....', '..####......####..', '.###..######..###.', '.##..########..##.', '##..####..####..##', '##..###....###..##', '##..###....###..##', '##..####..####..##', '.##..########..##.', '.###..######..###.', '..####......####..', '....##########....', '......######......'],
  };
  const ENEMY = {
    drone: { hp: 1, pts: 10, col: '#ff5a7a' }, wave: { hp: 1, pts: 15, col: '#c77dff' }, diver: { hp: 2, pts: 20, col: '#ffa94d' },
    shooter: { hp: 3, pts: 30, col: '#55f6ff' }, rock: { hp: 4, pts: 25, col: '#a8a3c8' }, mine: { hp: 1, pts: 15, col: '#ff9de6' }, carrier: { hp: 3, pts: 40, col: '#6dff9e' },
  };
  const PICKS = ['missile', 'laser', 'wall', 'double'];

  // ── Sektor ze semínka: vlny (čas, typ, počet, vzor, výška) a boss ──
  function sector(seed, d) {
    const r = rngOf(seed), waves = [];
    const n = 8 + Math.min(d, 10), types = ['drone', 'wave', 'drone', 'diver', 'wave', 'rock', 'shooter', 'mine', 'diver', 'shooter'];
    let t = 1.6;
    for (let i = 0; i < n; i++) {
      const pool = types.slice(0, Math.min(types.length, 3 + d + Math.floor(i / 3)));
      const type = pool[Math.floor(r() * pool.length)];
      const count = type === 'rock' || type === 'shooter' ? 1 + Math.floor(r() * 2 + d / 6) : 3 + Math.floor(r() * 3 + d / 5);
      const pattern = ['line', 'column', 'v'][Math.floor(r() * 3)];
      waves.push({ t, type, count: Math.min(count, 8), pattern, y: 22 + Math.floor(r() * (FH - 44)), carrier: i % 3 === 1 });
      t += Math.max(1.9, 3.4 - Math.min(d, 12) * 0.1) + r() * 1.2;
    }
    const boss = { kind: ['bossA', 'bossB', 'bossC'][Math.floor(r() * 3)], hp: 30 + d * 12 };
    return { waves, boss, length: t + 1.5, d };
  }
  function levelSpec(n) {
    const d = 1 + Math.floor((n - 1) / 6);
    return { d, text: L(`Sektor ${n} · obtížnost ${d}`, `Sector ${n} · difficulty ${d}`) };
  }
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') return Object.assign({ seed, mode: 'level', n: ctx.key, type: 'sector' }, levelSpec(ctx.key));
    if (ctx.kind === 'daily') return { seed, mode: 'daily', type: 'sector', d: 3, text: L('Denní sektor', 'Daily sector') };
    if (diffId === 'campaign') return { seed: 0x1a2b3c, mode: 'free', type: 'campaign', d: 1 };
    if (diffId === 'endless') return { seed, mode: 'free', type: 'endless', d: 1 };
    return { seed, mode: 'free', type: 'sector', d: 2 };
  }

  function create(el, P, saved, api) {
    let retro = !!(api.settings && api.settings.retro);
    let idx = 0, S, score = 0, lives = 3, livesLost = 0, special = null, charges = 0, doubleT = 0;
    let t = 0, elapsed = 0, waveI = 0, boss = null, bossDone = false, over = false, paused = false, clear = 0, msg = null;
    let ship, shots = [], foes = [], bolts = [], picks = [], parts = [], missiles = [], laser = 0, wall = 0, fireT = 0;
    const held = {};
    let god = false; // jen pro testy
    const seedOf = i => (P.type === 'campaign' ? P.seed + i * 104729 : i === 0 ? P.seed : (P.seed + i * 7919)) >>> 0;
    const dOf = i => (P.type === 'sector' ? P.d : P.d + i);
    let fx = rngOf(P.seed ^ 0xbeef);

    function loadSector(i) {
      idx = i; S = sector(seedOf(i), dOf(i)); t = 0; waveI = 0; boss = null; bossDone = false; clear = 0;
      foes = []; bolts = []; shots = []; picks = []; missiles = []; laser = 0; wall = 0;
      spawnShip();
      msg = { t: 2, text: P.type === 'sector' ? L('SEKTOR', 'SECTOR') : L(`SEKTOR ${i + 1}`, `SECTOR ${i + 1}`) };
    }
    function spawnShip() { ship = { x: 22, y: FH / 2, inv: 2, dead: 0 }; }

    // ── Spawn ──
    function spawnWave(w) {
      for (let k = 0; k < w.count; k++) {
        let x = FW + 8, y = w.y;
        if (w.pattern === 'line') x += k * 16;
        else if (w.pattern === 'column') { y = w.y + (k - (w.count - 1) / 2) * 13; x += (k % 2) * 6; }
        else { x += Math.abs(k - (w.count - 1) / 2) * 12; y = w.y + (k - (w.count - 1) / 2) * 9; }
        y = Math.max(10, Math.min(FH - 10, y));
        const type = w.carrier && k === w.count - 1 ? 'carrier' : w.type, def = ENEMY[type];
        foes.push({ type, x, y, y0: y, hp: def.hp + Math.floor(dOf(idx) / 6), t: k * 0.3, vx: type === 'rock' ? 22 : type === 'mine' ? 18 : 38 + dOf(idx) * 1.5, fire: 1 + fx() * 1.5 });
      }
    }
    function spawnBoss() {
      const d = dOf(idx);
      boss = { kind: S.boss.kind, x: FW + 30, y: FH / 2, hp: S.boss.hp, max: S.boss.hp, t: 0, fire: 1.5, hit: 0, d };
      msg = { t: 1.6, text: L('POZOR, BOSS!', 'WARNING: BOSS!') }; api.sound('error');
    }

    // ── Logika ──
    const box = (o, w, h) => ({ x0: o.x - w / 2, x1: o.x + w / 2, y0: o.y - h / 2, y1: o.y + h / 2 });
    const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    const sizeOf = type => [SPR[type][0].length, SPR[type].length];
    function boom(x, y, col, n = 10) { for (let i = 0; i < n; i++) { const a = fx() * 6.28, v = 20 + fx() * 60; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.4 + fx() * 0.4, col }); } }
    function damageFoe(f, dmg) {
      f.hp -= dmg; f.hit = 0.08;
      if (f.hp > 0) return;
      f.dead = true; score += ENEMY[f.type].pts; boom(f.x, f.y, ENEMY[f.type].col); api.sound('soft');
      if (f.type === 'carrier') picks.push({ x: f.x, y: f.y, kind: PICKS[Math.floor(fx() * PICKS.length)] });
    }
    function damageBoss(dmg) {
      if (!boss || boss.hp <= 0) return;
      boss.hp -= dmg; boss.hit = 0.06;
      if (boss.hp <= 0) {
        score += 500 + dOf(idx) * 100; bossDone = true; clear = 2.2;
        for (let i = 0; i < 6; i++) boom(boss.x + (fx() - 0.5) * 30, boss.y + (fx() - 0.5) * 20, '#ffe066', 14);
        api.sound('win'); api.changed();
      }
    }
    function shoot() {
      const ys = doubleT > 0 ? [-3, 3] : [0];
      for (const dy of ys) shots.push({ x: ship.x + 7, y: ship.y + dy });
      api.sound('tap');
    }
    function useSpecial() {
      if (!special || charges <= 0 || ship.dead || paused || over) return;
      charges--;
      if (special === 'missile') { missiles.push({ x: ship.x + 6, y: ship.y - 3, vx: 60, vy: -20 }, { x: ship.x + 6, y: ship.y + 3, vx: 60, vy: 20 }); api.sound('place'); }
      if (special === 'laser') { laser = 0.7; api.sound('line'); }
      if (special === 'wall') { wall = 4; api.sound('star'); }
      if (charges <= 0) special = null;
    }
    function loseLife() {
      ship.dead = 1.2; lives--; livesLost++; boom(ship.x, ship.y, '#ffe066', 24); api.sound('error'); bolts = [];
      special = null; charges = 0; doubleT = 0; api.changed();
    }
    function end(won) {
      if (over) return; over = true; api.setTimer(false);
      const info = `<p class="k-muted">${L(`Skóre ${Kit.fmtNum(score)} · ztracené životy ${livesLost}`, `Score ${Kit.fmtNum(score)} · lives lost ${livesLost}`)}${P.text ? ` · ${P.text}` : ''}</p>`;
      if (!won) { api.failed({ score, html: info }); return; }
      const stars = livesLost === 0 ? 3 : livesLost === 1 ? 2 : 1;
      const scored = P.type === 'campaign' || P.type === 'endless';
      api.solved({ title: scored ? Kit.fmtNum(score) : Kit.fmtTime(elapsed), stars, score: scored ? score : undefined, html: info });
    }

    function tick(dt) {
      t += dt; elapsed += dt;
      if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
      parts = parts.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; return (p.t -= dt) > 0; });
      if (clear > 0) {
        clear -= dt;
        if (clear <= 0) {
          if ((P.type === 'campaign' && idx + 1 < CAMPAIGN) || P.type === 'endless') { loadSector(idx + 1); api.changed(); }
          else end(true);
        }
        moveShip(dt); return;
      }
      // vlny a boss
      while (waveI < S.waves.length && t >= S.waves[waveI].t) spawnWave(S.waves[waveI++]);
      if (!boss && !bossDone && waveI >= S.waves.length && t >= S.length && !foes.length) spawnBoss();
      // loď
      if (ship.dead) { ship.dead -= dt; if (ship.dead <= 0) { if (lives <= 0) { end(false); return; } spawnShip(); } }
      else {
        moveShip(dt);
        ship.inv = god ? 1 : Math.max(0, ship.inv - dt); doubleT = Math.max(0, doubleT - dt);
        fireT -= dt; if (fireT <= 0) { fireT = 0.17; shoot(); }
      }
      laser = Math.max(0, laser - dt); wall = Math.max(0, wall - dt);
      // střely hráče
      for (const s of shots) s.x += 230 * dt;
      shots = shots.filter(s => s.x < FW + 4 && !s.used);
      for (const m of missiles) {
        const tg = boss && boss.hp > 0 ? boss : foes.find(f => !f.dead && f.x > m.x);
        if (tg) { const a = Math.atan2(tg.y - m.y, tg.x - m.x), v = 120; m.vx += (Math.cos(a) * v - m.vx) * Math.min(1, dt * 4); m.vy += (Math.sin(a) * v - m.vy) * Math.min(1, dt * 4); }
        m.x += m.vx * dt; m.y += m.vy * dt; m.t = (m.t || 0) + dt;
      }
      missiles = missiles.filter(m => m.x < FW + 10 && m.x > -10 && m.y > -10 && m.y < FH + 10 && !m.used && m.t < 4);
      // nepřátelé
      const d = dOf(idx);
      for (const f of foes) {
        f.t += dt; f.hit = Math.max(0, (f.hit || 0) - dt);
        f.x -= f.vx * dt;
        if (f.type === 'wave') f.y = f.y0 + Math.sin(f.t * 3) * 18;
        if (f.type === 'mine') f.y = f.y0 + Math.sin(f.t * 1.6) * 6;
        if (f.type === 'diver' && f.x < 170 && ship && !ship.dead) f.y += Math.sign(ship.y - f.y) * Math.min(Math.abs(ship.y - f.y), 40 * dt);
        if (f.type === 'shooter' || f.type === 'carrier') {
          if (f.type === 'shooter' && f.x < 190 && f.t < 6) f.x += f.vx * dt * 0.85;
          f.fire -= dt;
          if (f.fire <= 0 && f.x < FW - 6 && !ship.dead) { f.fire = Math.max(0.9, 2.2 - d * 0.08); aim(f.x - 5, f.y, 70 + d * 3); }
        }
        if (f.type === 'drone' && d >= 4) { f.fire -= dt; if (f.fire <= 0 && f.x < FW - 10 && f.x > 60) { f.fire = 3 + fx() * 2; bolts.push({ x: f.x - 4, y: f.y, vx: -(80 + d * 3), vy: 0 }); } }
      }
      foes = foes.filter(f => !f.dead && f.x > -16);
      // boss
      if (boss && boss.hp > 0) {
        boss.t += dt; boss.hit = Math.max(0, boss.hit - dt);
        if (boss.x > 196) boss.x -= 30 * dt;
        else boss.y = FH / 2 + Math.sin(boss.t * (0.9 + d * 0.04)) * (FH / 2 - 22);
        boss.fire -= dt;
        if (boss.fire <= 0 && boss.x < 205 && !ship.dead) {
          const sp = 64 + d * 3;
          if (boss.kind === 'bossA') { for (const a of [-0.35, 0, 0.35]) bolts.push({ x: boss.x - 12, y: boss.y, vx: -Math.cos(a) * sp, vy: Math.sin(a) * sp }); boss.fire = Math.max(0.8, 1.6 - d * 0.04); }
          else if (boss.kind === 'bossB') { aim(boss.x - 10, boss.y, sp + 10); setTimeout(() => boss && !over && boss.hp > 0 && aim(boss.x - 10, boss.y, sp + 10), 160); boss.fire = Math.max(0.7, 1.3 - d * 0.03); }
          else { for (let k = 0; k < 8; k++) { const a = Math.PI * 2 * k / 8 + boss.t; bolts.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * sp * 0.7, vy: Math.sin(a) * sp * 0.7 }); } boss.fire = Math.max(1.1, 2 - d * 0.05); }
          if (d >= 3 && fx() < 0.25) foes.push({ type: 'drone', x: boss.x - 10, y: boss.y, y0: boss.y, hp: 1, t: 0, vx: 50, fire: 2 });
        }
      }
      // střely nepřátel
      for (const b of bolts) { b.x += b.vx * dt; b.y += b.vy * dt; }
      bolts = bolts.filter(b => b.x > -4 && b.x < FW + 4 && b.y > -4 && b.y < FH + 4 && !b.used);
      // bonusy
      for (const p of picks) p.x -= 26 * dt;
      picks = picks.filter(p => p.x > -8 && !p.used);
      collisions();
    }
    function aim(x, y, sp) { const a = Math.atan2(ship.y - y, ship.x - x); bolts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }); }
    function moveShip(dt) {
      if (ship.dead) return;
      const sp = 95;
      const dx = (held.r ? 1 : 0) - (held.l ? 1 : 0), dy = (held.d ? 1 : 0) - (held.u ? 1 : 0);
      ship.x = Math.max(8, Math.min(150, ship.x + dx * sp * dt));
      ship.y = Math.max(7, Math.min(FH - 7, ship.y + dy * sp * dt));
    }
    function collisions() {
      const bossBox = boss && boss.hp > 0 ? box(boss, sizeOf(boss.kind)[0] - 2, sizeOf(boss.kind)[1] - 2) : null;
      for (const s of shots) {
        const sb = { x0: s.x - 2, x1: s.x + 2, y0: s.y - 1, y1: s.y + 1 };
        for (const f of foes) if (!f.dead && hit(sb, box(f, ...sizeOf(f.type)))) { s.used = true; damageFoe(f, 1); break; }
        if (!s.used && bossBox && hit(sb, bossBox)) { s.used = true; damageBoss(1); }
      }
      for (const m of missiles) {
        const mb = { x0: m.x - 2, x1: m.x + 2, y0: m.y - 2, y1: m.y + 2 };
        for (const f of foes) if (!f.dead && hit(mb, box(f, ...sizeOf(f.type)))) { m.used = true; damageFoe(f, 6); boom(m.x, m.y, '#ffa94d', 6); break; }
        if (!m.used && bossBox && hit(mb, bossBox)) { m.used = true; damageBoss(6); boom(m.x, m.y, '#ffa94d', 6); }
      }
      if (laser > 0 && !ship.dead) {
        const lb = { x0: ship.x, x1: FW, y0: ship.y - 3, y1: ship.y + 3 };
        for (const f of foes) if (!f.dead && hit(lb, box(f, ...sizeOf(f.type)))) damageFoe(f, 0.6);
        if (bossBox && hit(lb, bossBox)) damageBoss(0.5);
        bolts = bolts.filter(b => !(b.x > ship.x && Math.abs(b.y - ship.y) < 4));
      }
      if (ship.dead) return;
      const sb = box(ship, 9, 4);
      if (wall > 0) {
        const wb = { x0: ship.x + 9, x1: ship.x + 13, y0: ship.y - 12, y1: ship.y + 12 };
        for (const b of bolts) if (hit(wb, { x0: b.x - 1, x1: b.x + 1, y0: b.y - 1, y1: b.y + 1 })) b.used = true;
        for (const f of foes) if (!f.dead && hit(wb, box(f, ...sizeOf(f.type)))) damageFoe(f, 99);
      }
      for (const p of picks) if (hit(sb, box(p, 9, 9))) {
        p.used = true; score += 50; api.sound('star');
        if (p.kind === 'double') { doubleT = 12; msg = { t: 1, text: L('DVOJITÁ PALBA', 'DOUBLE SHOT') }; }
        else { special = p.kind; charges = p.kind === 'wall' ? 2 : 3; msg = { t: 1, text: { missile: L('RAKETY', 'MISSILES'), laser: L('LASER', 'LASER'), wall: L('ŠTÍT', 'SHIELD') }[p.kind] }; }
      }
      if (ship.inv > 0) return;
      for (const b of bolts) if (hit(sb, { x0: b.x - 1.5, x1: b.x + 1.5, y0: b.y - 1.5, y1: b.y + 1.5 })) { loseLife(); return; }
      for (const f of foes) if (!f.dead && hit(sb, box(f, ...sizeOf(f.type)))) { damageFoe(f, 99); loseLife(); return; }
      if (bossBox && hit(sb, bossBox)) { loseLife(); }
    }

    // ── Vykreslení ──
    el.innerHTML = `<div class="ip-wrap">
      <div class="ip-hud"><div><small>${L('SKÓRE', 'SCORE')}</small><b class="ip-score">0</b></div><div class="ip-lives"></div><div class="ip-spec"><small>${L('SPECIÁL', 'SPECIAL')}</small><b class="ip-special">–</b></div></div>
      <div class="ip-stage"><canvas class="ip-board"></canvas><div class="ip-over" hidden></div></div>
      <div class="ip-touch"><button class="ip-fire" data-b="special">${L('Speciál', 'Special')}</button></div>
      <div class="ip-tools"><button class="k-tool ip-retro" data-b="retro" aria-pressed="${retro}"><span>${L('Retro displej', 'Retro screen')}</span></button><button class="ip-pause k-tool" data-b="pause">${api.icon('pause')}<span>${L('Pauza', 'Pause')}</span></button></div></div>`;
    const cv = el.querySelector('.ip-board'), ctx = cv.getContext('2d'), ov = el.querySelector('.ip-over'), wrapEl = el.querySelector('.ip-wrap');
    const scoreEl = el.querySelector('.ip-score'), livesEl = el.querySelector('.ip-lives'), specEl = el.querySelector('.ip-special');
    let sc = 3, dpr = 1;
    function fit() {
      const phone = innerWidth < 760, vw = (document.getElementById('kView') || el).clientWidth - (phone ? 16 : 8);
      const hAvail = innerHeight - (phone ? 300 : 200);
      sc = Math.max(1.2, Math.min(vw / FW, hAvail / FH, 4.5));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(FW * sc * dpr); cv.height = Math.round(FH * sc * dpr); cv.style.width = Math.round(FW * sc) + 'px'; cv.style.height = Math.round(FH * sc) + 'px';
      wrapEl.classList.toggle('phone', phone);
    }
    // sprity se předkreslí v barvě do malých plátének
    const cache = new Map();
    function sprite(name, col) {
      const k = name + col; if (cache.has(k)) return cache.get(k);
      const rows = SPR[name], c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
      const g = c.getContext('2d'); g.fillStyle = col;
      rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && g.fillRect(x, y, 1, 1)));
      cache.set(k, c); return c;
    }
    const FG = '#43523d', BG = '#c7f0d8';
    const colr = c => (retro ? FG : c);
    function put(name, x, y, col, flip, glow) {
      const img = sprite(name, colr(col)), w = img.width, h = img.height;
      ctx.save();
      if (!retro && glow) { ctx.shadowColor = col; ctx.shadowBlur = 6 * sc; }
      ctx.translate(x * sc, y * sc); if (flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2 * sc, -h / 2 * sc, w * sc, h * sc);
      ctx.restore();
    }
    const stars = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97.3) % FW, y: (i * 53.7) % FH, z: 0.3 + ((i * 7) % 10) / 10 }));
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const w = FW * sc, h = FH * sc;
      ctx.fillStyle = retro ? BG : '#05031a'; ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        const x = ((s.x - t * 30 * s.z) % FW + FW) % FW;
        ctx.fillStyle = retro ? 'rgba(67,82,61,.35)' : `rgba(255,255,255,${0.25 + s.z * 0.5})`;
        ctx.fillRect(Math.floor(x * sc), Math.floor(s.y * sc), Math.max(1, sc * (s.z > 0.9 ? 1 : 0.6)), Math.max(1, sc * 0.6));
      }
      for (const p of picks) {
        const blink = Math.floor(t * 6) % 2;
        ctx.strokeStyle = colr('#6dff9e'); ctx.lineWidth = sc; ctx.strokeRect((p.x - 4.5) * sc, (p.y - 4.5) * sc, 9 * sc, 9 * sc);
        ctx.fillStyle = colr(blink ? '#ffffff' : '#6dff9e'); ctx.font = `700 ${6.5 * sc}px Unbounded, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText({ missile: 'M', laser: 'L', wall: 'S', double: '2' }[p.kind], p.x * sc, (p.y + 0.4) * sc);
      }
      for (const f of foes) put(f.type, f.x, f.y, f.hit > 0 ? '#ffffff' : ENEMY[f.type].col, false, true);
      if (boss && boss.hp > 0) put(boss.kind, boss.x, boss.y, boss.hit > 0 ? '#ffffff' : '#ff5a7a', false, true);
      ctx.fillStyle = colr('#ffe066');
      for (const s of shots) ctx.fillRect((s.x - 2) * sc, (s.y - 0.5) * sc, 4 * sc, Math.max(1, sc));
      ctx.fillStyle = colr('#ffa94d');
      for (const m of missiles) ctx.fillRect((m.x - 2) * sc, (m.y - 1) * sc, 4 * sc, 2 * sc);
      ctx.fillStyle = colr('#ff5a7a');
      for (const b of bolts) ctx.fillRect((b.x - 1.5) * sc, (b.y - 1.5) * sc, 3 * sc, 3 * sc);
      if (ship && !ship.dead && !(ship.inv > 0 && Math.floor(t * 12) % 2)) {
        if (!retro) { ctx.fillStyle = Math.floor(t * 20) % 2 ? '#ff9de6' : '#ffa94d'; ctx.fillRect((ship.x - 9) * sc, (ship.y - 1) * sc, 3 * sc, 2 * sc); }
        put('ship', ship.x, ship.y, '#55f6ff', false, true);
        if (laser > 0) { ctx.fillStyle = colr('#ff9de6'); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 60); ctx.fillRect((ship.x + 6) * sc, (ship.y - 1.5) * sc, (FW - ship.x) * sc, 3 * sc); ctx.globalAlpha = 1; }
        if (wall > 0) { ctx.fillStyle = colr('#6dff9e'); ctx.globalAlpha = wall < 1 && Math.floor(t * 10) % 2 ? 0.3 : 0.8; ctx.fillRect((ship.x + 10) * sc, (ship.y - 12) * sc, 2 * sc, 24 * sc); ctx.globalAlpha = 1; }
      }
      for (const p of parts) { ctx.globalAlpha = Math.min(1, p.t * 2.5); ctx.fillStyle = colr(p.col); ctx.fillRect((p.x - 1) * sc, (p.y - 1) * sc, 2 * sc, 2 * sc); }
      ctx.globalAlpha = 1;
      if (boss && boss.hp > 0) {
        ctx.fillStyle = retro ? 'rgba(67,82,61,.3)' : 'rgba(255,255,255,.15)'; ctx.fillRect(w * 0.25, 4 * sc, w * 0.5, 2.5 * sc);
        ctx.fillStyle = colr('#ff5a7a'); ctx.fillRect(w * 0.25, 4 * sc, w * 0.5 * Math.max(0, boss.hp / boss.max), 2.5 * sc);
      }
      if (msg || clear > 0) {
        ctx.fillStyle = colr('#ffe066'); ctx.font = `700 ${9 * sc}px Unbounded, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(clear > 0 ? L('SEKTOR VYČIŠTĚN', 'SECTOR CLEAR') : msg.text, w / 2, h / 2);
      }
      scoreEl.textContent = Kit.fmtNum(score);
      const lh = '<i></i>'.repeat(Math.max(0, lives));
      if (livesEl.innerHTML !== lh) livesEl.innerHTML = lh;
      specEl.textContent = special ? `${{ missile: L('Rakety', 'Missiles'), laser: 'Laser', wall: L('Štít', 'Shield') }[special]} ×${charges}` : doubleT > 0 ? L('Dvojitá palba', 'Double shot') : '–';
      wrapEl.classList.toggle('retro', retro);
    }

    // ── Smyčka ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (api.paused() && !paused) setPause(true);
      if (!paused && !over) tick(dt);
      draw();
    }
    function setPause(on) {
      if (over) return; paused = on; api.setTimer(!on); ov.hidden = !on;
      for (const k in held) held[k] = false;
      if (on) ov.innerHTML = `<div><b>${L('Pauza', 'Paused')}</b><button class="k-btn primary" data-b="resume">${L('Pokračovat', 'Resume')}</button></div>`;
      else last = performance.now();
    }

    // ── Ovládání: šipky/WASD pohyb, mezerník speciál; na dotyku táhni lodí kdekoli po ploše ──
    const keys = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', W: 'u', s: 'd', S: 'd', a: 'l', A: 'l', d: 'r', D: 'r' };
    const onKeyUp = e => { const k = keys[e.key]; if (k) held[k] = false; };
    addEventListener('keyup', onKeyUp);
    el.querySelector('[data-b="special"]').addEventListener('pointerdown', e => { e.preventDefault(); useSpecial(); });
    el.querySelector('[data-b="pause"]').addEventListener('click', () => setPause(!paused));
    el.querySelector('[data-b="retro"]').addEventListener('click', e => { retro = !retro; e.currentTarget.setAttribute('aria-pressed', String(retro)); api.setSetting && api.setSetting('retro', retro); });
    ov.addEventListener('click', e => { if (e.target.closest('[data-b="resume"]')) setPause(false); });
    let drag = null;
    const stage = el.querySelector('.ip-stage');
    stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', e => {
      if (!drag || !ship || ship.dead || paused) return;
      const k = 1.3 / sc;
      ship.x = Math.max(8, Math.min(150, ship.x + (e.clientX - drag.x) * k));
      ship.y = Math.max(7, Math.min(FH - 7, ship.y + (e.clientY - drag.y) * k));
      drag = { x: e.clientX, y: e.clientY };
    });
    stage.addEventListener('pointerup', () => (drag = null));
    stage.addEventListener('pointercancel', () => (drag = null));

    // obnovení: rozehraný sektor začne znovu od začátku
    if (saved && saved.idx != null) { score = saved.score; lives = saved.lives; livesLost = saved.livesLost; elapsed = saved.elapsed || 0; loadSector(saved.idx); paused = true; setTimeout(() => setPause(true), 0); }
    else loadSector(0);
    fit(); addEventListener('resize', fit);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => (over ? null : { idx, score, lives: Math.max(1, lives), livesLost, elapsed }),
      progress: () => {
        const part = bossDone ? 1 : boss ? 0.7 + 0.3 * (1 - boss.hp / boss.max) : 0.7 * Math.min(1, t / S.length);
        return P.type === 'campaign' ? (idx + part) / CAMPAIGN : part;
      },
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('keyup', onKeyUp); },
      pause() { setPause(true); },
      onKey(e) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); setPause(!paused); return; }
        if (e.key === ' ' || e.key === 'x' || e.key === 'X' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) useSpecial(); return; }
        const k = keys[e.key]; if (!k) return; e.preventDefault(); held[k] = true;
      },
      _solve() { score = Math.max(score, 1000); elapsed = Math.max(elapsed, 1); if (P.type === 'campaign') idx = CAMPAIGN - 1; end(true); },
      _state: () => ({ idx, t, score, lives, ship: ship && { x: ship.x, y: ship.y, dead: ship.dead }, shots: shots.length, foes: foes.length, boss: boss && { hp: boss.hp }, special, charges, retro }),
      _give(kind) { picks.push({ x: ship.x + 2, y: ship.y, kind }); },
      _god() { god = true; },
      _boss() { waveI = S.waves.length; t = S.length; foes = []; },
    };
  }

  function art(el) {
    const px = (rows, ox, oy, s, col) => rows.map((row, y) => [...row].map((ch, x) => ch === '#' ? `<rect x="${ox + x * s}" y="${oy + y * s}" width="${s}" height="${s}" fill="${col}"/>` : '').join('')).join('');
    el.innerHTML = `<svg viewBox="0 0 260 260"><defs><filter id="ipGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g filter="url(#ipGlow)">${px(SPR.ship, 30, 112, 5, '#55f6ff')}${[0, 1, 2].map(i => `<rect x="${100 + i * 22}" y="126" width="12" height="4" fill="#ffe066"/>`).join('')}
      ${px(SPR.drone, 180, 70, 5, '#ff5a7a')}${px(SPR.wave, 196, 120, 5, '#c77dff')}${px(SPR.drone, 176, 170, 5, '#ff5a7a')}</g></svg>`;
  }
  return { DIFFS, generate, create, art, sector, levelSpec, SPR };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'impakt', title: 'IMPAKT', wording: 'play',
  tagline: Kit.L('Vesmírná střílečka na motivy Space Impact: sestřeluj vlny nepřátel, sbírej zbraně a poraz bosse na konci sektoru.', 'A space shooter in the spirit of Space Impact: shoot down enemy waves, pick up weapons and beat the boss at the end of each sector.'),
  diffs: Impakt.DIFFS, generate: Impakt.generate, create: Impakt.create, art: Impakt.art,
  online: { kind: 'race', diffs: ['sector'] },
  dailyDiff: () => 'sector',
  levelDiff: () => 'sector',
  rules: Kit.L(`<p>Proleť sektorem, sestřel nepřátele a poraz bosse na jeho konci.</p>
    <ul><li><b>Ovládání:</b> loď střílí sama. Šipky nebo WASD ji posouvají, mezerník (nebo X) odpálí speciální zbraň, P pauza. Na telefonu táhni prstem kdekoli po ploše a loď se posune s ním; speciál má vlastní tlačítko.</li>
    <li>Zelení <b>nosiči</b> po sestřelení pustí bonus: <b>M</b> rakety, které samy míří, <b>L</b> laser přes celou řadu, <b>S</b> štít před lodí, <b>2</b> dvojitá palba.</li>
    <li>Máš tři životy; po zásahu je loď chvíli nezranitelná.</li>
    <li><b>Kampaň</b> je pět sektorů za sebou, pro všechny stejných, a počítá se skóre. <b>Nekonečno</b> pokračuje, dokud vydržíš. Tři hvězdy za sektor bez ztráty života.</li>
    <li>Tlačítko <b>Retro displej</b> přepne hru do vzhledu zeleného displeje starých mobilů.</li></ul>`,
    `<p>Fly through the sector, shoot down the enemies and beat the boss at its end.</p>
    <ul><li><b>Controls:</b> the ship fires on its own. Arrows or WASD move it, Space (or X) fires the special weapon, P pauses. On a phone drag anywhere on the screen and the ship moves with your finger; the special has its own button.</li>
    <li>Green <b>carriers</b> drop a bonus: <b>M</b> homing missiles, <b>L</b> a laser across the whole row, <b>S</b> a shield in front of the ship, <b>2</b> double shot.</li>
    <li>You have three lives; after a hit the ship is invulnerable for a moment.</li>
    <li><b>Campaign</b> is five sectors in a row, the same for everyone, scored by points. <b>Endless</b> goes on while you last. Three stars for a sector without losing a life.</li>
    <li>The <b>Retro screen</b> button switches the game to the look of an old phone's green display.</li></ul>`),
  achievements: [],
});
