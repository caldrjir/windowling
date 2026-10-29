'use strict';
// ── ČERVÍCI · Windowling Hlavolamy ──────────────────────────────────────────
// Tahová válka dvou týmů červů na zničitelném ostrově (na motivy Worms). Červ na tahu může chodit
// a skákat, zamíří a vystřelí, pak má chvíli na ústup. Výbuchy hloubí terén a odhazují červy,
// voda dole je smrtelná. Proti počítači, ve dvou na jednom zařízení a online (tahové místnosti).
// Ostrov se generuje jen ze sčítání a násobení (žádné sin/cos), takže je ve všech prohlížečích
// stejný. Online pošle hráč na tahu výsledek tahu: výbuchy a kde skončil každý červ.
const Cervici = (() => {
  const L = Kit.L;
  const MW = 1280, MH = 720, WATER = MH - 46, G = 330, TURN = 45, RETREAT = 4, PER_TEAM = 3;
  const DIFFS = [
    { id: 'ai1', name: L('Nováček', 'Rookie'), note: L('počítač se učí mířit', 'the computer is learning to aim'), par: 900 },
    { id: 'ai2', name: L('Voják', 'Soldier'), note: L('solidní soupeř', 'a solid opponent'), par: 900 },
    { id: 'ai3', name: L('Velitel', 'Commander'), note: L('skoro nemine', 'rarely misses'), par: 900 },
    { id: 'duo', name: L('Dva hráči', 'Two players'), note: L('na jednom zařízení', 'on one device'), par: 1200 },
  ];
  const WEAPONS = [
    { id: 'bazooka', name: L('Bazuka', 'Bazooka'), ammo: Infinity, kind: 'proj', r: 34, dmg: 48, charge: true },
    { id: 'grenade', name: L('Granát', 'Grenade'), ammo: Infinity, kind: 'bounce', r: 34, dmg: 46, charge: true },
    { id: 'shotgun', name: L('Brokovnice', 'Shotgun'), ammo: Infinity, kind: 'ray', r: 14, dmg: 25 },
    { id: 'dynamite', name: L('Dynamit', 'Dynamite'), ammo: 1, kind: 'drop', r: 62, dmg: 75 },
    { id: 'air', name: L('Nálet', 'Air strike'), ammo: 1, kind: 'air', r: 28, dmg: 30 },
  ];
  const TEAM = [{ col: '#55f6ff', name: L('Modří', 'Blue') }, { col: '#ff6fb5', name: L('Růžoví', 'Pink') }];
  const WORM_NAMES = [['Bob', 'Pepa', 'Žížala'], ['Kuba', 'Máňa', 'Sliz']];
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const smooth = t => t * t * (3 - 2 * t);

  // ── Ostrov: výšky z hladkého šumu, jeskyně z 2D šumu, okraje se svažují do vody ──
  function island(seed) {
    const r = rngOf(seed), mask = new Uint8Array(MW * MH);
    const lattice = (n, cell) => { const pts = Array.from({ length: Math.ceil(n / cell) + 2 }, () => r()); return x => { const i = Math.floor(x / cell), f = smooth((x - i * cell) / cell); return pts[i] + (pts[i + 1] - pts[i]) * f; }; };
    const big = lattice(MW, 220), mid = lattice(MW, 90), small = lattice(MW, 34);
    const gw = Math.ceil(MW / 56) + 2, gh = Math.ceil(MH / 56) + 2, grid = Array.from({ length: gw * gh }, () => r());
    const cave = (x, y) => {
      const i = Math.floor(x / 56), j = Math.floor(y / 56), fx = smooth(x / 56 - i), fy = smooth(y / 56 - j);
      const a = grid[j * gw + i], b = grid[j * gw + i + 1], c = grid[(j + 1) * gw + i], d = grid[(j + 1) * gw + i + 1];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
    const holes = 0.7 + r() * 0.08, top = MH * (0.32 + r() * 0.1);
    for (let x = 0; x < MW; x++) {
      const edge = Math.min(x, MW - 1 - x) / 160, fall = edge < 1 ? (1 - edge) * (1 - edge) * 300 : 0;
      const surf = Math.round(top + big(x) * 170 + mid(x) * 70 + small(x) * 18 + fall);
      for (let y = Math.max(0, surf); y < MH; y++) if (!(y > surf + 26 && cave(x, y) > holes)) mask[y * MW + x] = 1;
    }
    return { mask, theme: Math.floor(r() * 3) };
  }
  const solidAt = (mask, x, y) => { x |= 0; y |= 0; return x >= 0 && x < MW && y >= 0 && y < MH && mask[y * MW + x] === 1; };
  // místa pro červy: na povrchu, nad vodou, s odstupem
  function spawns(mask, seed, n) {
    const r = rngOf(seed ^ 0x77), out = [];
    for (let tries = 0; tries < 4000 && out.length < n; tries++) {
      const x = 150 + Math.floor(r() * (MW - 300));
      const top = xx => { let y = 0; while (y < MH && !solidAt(mask, xx, y)) y++; return y; };
      const y = top(x);
      if (y >= WATER - 60 || y < 30) continue;
      if (tries < 3000 && (Math.abs(top(x - 10) - y) > 7 || Math.abs(top(x + 10) - y) > 7)) continue; // rovné místo, ne svah
      if (out.some(p => Math.abs(p[0] - x) < 90)) continue;
      out.push([x, y - 1]);
    }
    while (out.length < n) out.push([100 + out.length * 150, 100]);
    // střídavě týmy, ať nejsou všichni modří na jedné straně
    return out.sort((a, b) => a[0] - b[0]);
  }
  const windFor = (seed, turn, max) => Math.round((rngOf((seed ^ Math.imul(turn + 7, 2654435761)) >>> 0)() - 0.5) * 2 * max);
  function carve(mask, cx, cy, R) {
    for (let y = Math.max(0, cy - R); y <= Math.min(MH - 1, cy + R); y++) for (let x = Math.max(0, cx - R); x <= Math.min(MW - 1, cx + R); x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= R * R) mask[y * MW + x] = 0;
  }

  function levelSpec(n) {
    return { ai: n <= 30 ? 1 : n <= 80 ? 2 : 3, wind: Math.min(10, 3 + Math.floor(n / 15)), text: L(`Bitva ${n}`, `Battle ${n}`) };
  }
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'online') return { seed, type: 'online', wind: 8 };
    if (ctx.kind === 'daily') return { seed, type: 'ai', ai: 2, wind: 8, text: L('Denní bitva', 'Daily battle') };
    if (ctx.kind === 'level') return Object.assign({ seed, type: 'ai' }, levelSpec(ctx.key));
    if (diffId === 'duo') return { seed, type: 'duo', wind: 8 };
    return { seed, type: 'ai', ai: { ai1: 1, ai2: 2, ai3: 3 }[diffId] || 1, wind: diffId === 'ai1' ? 4 : 8 };
  }

  function create(el, P, saved, api, opts = {}) {
    const net = P.type === 'online' ? opts.net : null, online = !!net;
    const I = island(P.seed), mask = I.mask;
    const sp = spawns(mask, P.seed, PER_TEAM * 2);
    // pozice střídavě: tým 0 dostane 0., 2., 4. místo zleva, tým 1 ostatní
    const worms = [];
    for (let k = 0; k < PER_TEAM * 2; k++) { const team = k % 2, p = sp[k]; worms.push({ team, idx: Math.floor(k / 2), name: WORM_NAMES[team][Math.floor(k / 2)], x: p[0], y: p[1], vx: 0, vy: 0, hp: 100, air: false, face: team ? -1 : 1, dead: false, drown: false, shown: 100 }); }
    const order = t => worms.filter(w => w.team === t);
    const me = online ? (net.side > 0 ? 0 : 1) : 0;
    const teamName = t => (online ? (t === me ? net.me : net.opp) : P.type === 'duo' ? L(`Hráč ${t + 1}`, `Player ${t + 1}`) : t === 0 ? L('Ty', 'You') : L(`Počítač ${P.ai}`, `Computer ${P.ai}`));
    const ammo = [WEAPONS.map(w => w.ammo), WEAPONS.map(w => w.ammo)];
    const next = [0, 0]; // kdo z týmu hraje příště
    let turn = 0, team = 0, cur = null, wind = 0, phase = 'start', timer = TURN, retreat = 0, settleT = 0, done = false;
    let weapon = 0, aim = 30, power = 0.6, fuse = 3, charging = false, chargeT = 0, airX = MW / 2, airSet = false;
    let projs = [], planes = [], booms = [], parts = [], pops = [], shake = 0, clock = 0, log = null, firedAt = 0, replay = null;
    let aiPlan = null, aiT = 0, banner = null, terrainCv = null, terrainG = null;
    const pending = [];
    const isHuman = t => (online ? t === me : P.type === 'duo' ? true : t === 0);
    const W = () => WEAPONS[weapon];
    const alive = t => worms.some(w => w.team === t && !w.dead);

    // ── Fyzika červů ──
    const grounded = w => solidAt(mask, w.x, w.y + 1);
    function walk(w, dir) {
      w.face = dir;
      if (w.air) return;
      const nx = w.x + dir; if (nx < 2 || nx > MW - 3) return;
      let ny = w.y;
      if (solidAt(mask, nx, ny)) { let k = 1; while (k <= 5 && solidAt(mask, nx, ny - k)) k++; if (k > 5) return; ny -= k; }
      if (solidAt(mask, nx, ny - 10)) return; // nízký strop
      w.x = nx; w.y = ny;
      if (!grounded(w)) { let k = 0; while (k < 4 && !solidAt(mask, w.x, w.y + 1)) { w.y++; k++; } if (!grounded(w)) { w.air = true; w.vx = dir * 30; w.vy = 0; } }
    }
    function jump(w) { if (w.air || !grounded(w)) return; w.air = true; w.vx = w.face * 95; w.vy = -175; api.sound('tap'); }
    function physWorm(w, dt) {
      if (w.dead) return;
      if (!w.air) { if (!grounded(w)) { w.air = true; w.vx = 0; w.vy = 0; } else return; }
      w.vy += G * dt; w.vx += (w.vx > 0 ? -1 : 1) * Math.min(Math.abs(w.vx), 8 * dt);
      const steps = Math.ceil(Math.max(Math.abs(w.vx), Math.abs(w.vy)) * dt) + 1;
      for (let i = 0; i < steps; i++) {
        const nx = w.x + w.vx * dt / steps, ny = w.y + w.vy * dt / steps;
        if (solidAt(mask, nx, w.y) || solidAt(mask, nx, w.y - 8)) { w.vx = -w.vx * 0.3; }
        else w.x = nx;
        if (w.vy > 0 && solidAt(mask, w.x, ny + 1)) {
          // dopad
          const speed = w.vy; w.vy = 0; w.vx = 0; w.air = false; w.x = Math.round(w.x); w.y = Math.floor(ny); // celé pixely: online se poloha posílá zaokrouhlená
          while (solidAt(mask, w.x, w.y)) w.y--;
          if (speed > 270) hurt(w, Math.round((speed - 270) / 6));
          return;
        }
        if (w.vy < 0 && solidAt(mask, w.x, ny - 10)) w.vy = 0; else w.y = ny;
      }
      if (w.x < -20 || w.x > MW + 20) w.x = Math.max(-20, Math.min(MW + 20, w.x));
      if (w.y > WATER) { w.dead = true; w.drown = true; w.hp = 0; api.sound('error'); for (let i = 0; i < 12; i++) parts.push({ x: w.x, y: WATER, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 160, t: 0.8, col: '#bfefff', g: true }); }
    }
    function hurt(w, d) {
      if (w.dead || d <= 0) return;
      w.hp = Math.max(0, w.hp - d); pops.push({ x: w.x, y: w.y - 30, t: 1.5, text: `−${d}`, col: TEAM[w.team].col });
      if (w.hp <= 0) w.dying = 1.2;
    }
    // ── Výbuch: díra do terénu, poškození a odhození ──
    function explode(x, y, wpn, visualOnly) {
      x = Math.round(x); y = Math.round(y);
      const R = wpn.r;
      if (!visualOnly) {
        dig(x, y, R);
        if (log) log.ex.push([x, y, R, Math.round((clock - firedAt) * 10)]);
        for (const w of worms) {
          if (w.dead) continue;
          const dx = w.x - x, dy = w.y - 6 - y, d = Math.sqrt(dx * dx + dy * dy), reach = R * 1.7;
          if (d < reach) {
            const k = 1 - d / reach;
            if (d < R + 8) hurt(w, Math.round(wpn.dmg * (d < 10 ? 1 : Math.min(1, (R + 8 - d) / R + 0.15))));
            const n = d || 1; w.air = true; w.vx += dx / n * 260 * k; w.vy += (dy / n - 0.7) * 260 * k;
          }
        }
      }
      drawHole(x, y, R);
      booms.push({ x, y, r: R, t: 0 }); shake = Math.max(shake, Math.min(0.45, R / 110));
      const dirt = `rgb(${TH.dirt[0].join(',')})`;
      for (let i = 0; i < 30; i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 260; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 110, t: 0.5 + Math.random() * 0.9, col: i % 3 ? dirt : i % 2 ? '#ffd34d' : '#ff7a3a', z: 2 + Math.random() * 3, g: true }); }
      for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28, d = Math.random() * R * 0.6, life = 1 + Math.random() * 0.8; parts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: (Math.random() - 0.5) * 20, vy: -18 - Math.random() * 24, t: life, life, puff: R * 0.22 + Math.random() * 5, col: i % 3 ? '70,64,72' : '120,110,110' }); }
      api.sound('line');
    }

    // ── Střely ──
    function launch(w, wpn, a, pw, fz, tx) {
      const ang = a * Math.PI / 180, dir = w.face, cx = Math.cos(ang) * dir, cy = -Math.sin(ang);
      const sx = w.x + cx * 14, sy = w.y - 10 + cy * 14;
      if (wpn.kind === 'proj') projs.push({ k: 'rocket', x: sx, y: sy, vx: cx * pw * 640, vy: cy * pw * 640, wind: true, wpn, owner: w, t: 0 });
      else if (wpn.kind === 'bounce') projs.push({ k: 'grenade', x: sx, y: sy, vx: cx * pw * 560, vy: cy * pw * 560, fuse: fz, wpn, owner: w, t: 0 });
      else if (wpn.kind === 'drop') projs.push({ k: 'dyn', x: w.x + dir * 8, y: w.y - 6, vx: dir * 30, vy: -40, fuse: 4, wpn, owner: w, t: 0 });
      else if (wpn.kind === 'air') { planes.push({ x: tx - 520, y: 34, vx: 900 }); }
      if (wpn.kind === 'air') for (let i = 0; i < 5; i++) projs.push({ k: 'missile', x: tx + (i - 2) * 26, y: -40 - i * 30, vx: 0, vy: 260, wpn, owner: null, t: 0 });
      else if (wpn.kind === 'ray') {
        for (const shot of [0, 1]) setTimeout(() => {
          if (done) return;
          let x = sx, y = sy;
          for (let d = 0; d < 520; d += 2) {
            x = sx + cx * d; y = sy + cy * d;
            if (solidAt(mask, x, y) || worms.some(o => o !== w && !o.dead && Math.abs(o.x - x) < 8 && y > o.y - 20 && y < o.y + 1)) break;
          }
          parts.push({ x: sx, y: sy, x2: x, y2: y, t: 0.15, ray: true });
          explode(x, y, wpn, !!replay);
        }, shot * 450);
      }
      api.sound(wpn.kind === 'ray' ? 'tap' : 'place');
    }
    function stepProj(p, dt, visualOnly) {
      p.t += dt;
      if (p.wind) p.vx += wind * 9 * dt;
      if (p.k !== 'missile') p.vy += G * dt;
      if (p.fuse !== undefined) p.fuse -= dt;
      const steps = Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy)) * dt / 2) + 1;
      for (let i = 0; i < steps; i++) {
        const nx = p.x + p.vx * dt / steps, ny = p.y + p.vy * dt / steps;
        if (p.k === 'grenade' || p.k === 'dyn') {
          if (solidAt(mask, nx, p.y)) p.vx = -p.vx * 0.45; else p.x = nx;
          if (solidAt(mask, p.x, ny)) { p.vy = -p.vy * 0.45; p.vx *= 0.8; if (Math.abs(p.vy) < 25) p.vy = 0; } else p.y = ny;
          continue;
        }
        p.x = nx; p.y = ny;
        const hitWorm = worms.some(o => !o.dead && (o !== p.owner || p.t > 0.15) && Math.abs(o.x - p.x) < 8 && p.y > o.y - 20 && p.y < o.y + 1);
        if (solidAt(mask, p.x, p.y) || hitWorm) { p.gone = true; explode(p.x, p.y, p.wpn, visualOnly); return; }
      }
      if ((p.fuse !== undefined && p.fuse <= 0)) { p.gone = true; explode(p.x, p.y, p.wpn, visualOnly); return; }
      if (p.y > WATER + 10 || p.x < -400 || p.x > MW + 400) { p.gone = true; if (p.y > WATER) parts.push({ x: p.x, y: WATER, vx: 0, vy: -90, t: 0.6, col: '#bfefff', g: true }); }
    }

    // ── Tahy ──
    function nextWorm(t) {
      const list = order(t);
      for (let i = 0; i < list.length; i++) { const w = list[(next[t] + i) % list.length]; if (!w.dead) { next[t] = (list.indexOf(w) + 1) % list.length; return w; } }
      return null;
    }
    function startTurn() {
      if (checkEnd()) return;
      team = turn % 2; wind = windFor(P.seed, turn, P.wind ?? 8);
      cur = nextWorm(team); timer = TURN; retreat = 0; phase = 'move'; charging = false; airSet = false;
      if (!(ammo[team][weapon] > 0)) weapon = 0;
      log = { ex: [], from: [cur.x, cur.y] };
      const target = worms.filter(w => w.team !== team && !w.dead).sort((a, b) => Math.abs(a.x - cur.x) - Math.abs(b.x - cur.x))[0];
      airX = target ? target.x : MW / 2;
      banner = { t: 1.6, text: isHuman(team) ? (P.type === 'duo' || online ? L(`${teamName(team)}: hraje ${cur.name}`, `${teamName(team)}: ${cur.name}'s turn`) : L(`Na tahu: ${cur.name}`, `Your turn: ${cur.name}`)) : L(`Hraje ${teamName(team)} (${cur.name})`, `${teamName(team)} plays (${cur.name})`) };
      if (!isHuman(team) && !online) { aiPlan = planAI(); aiT = 1.2; }
      if (online && !isHuman(team)) { phase = 'remote'; if (pending.length) setTimeout(() => applyRemote(pending.shift()), 300); }
      syncUI();
    }
    function fire() {
      if (phase !== 'move' || done || !cur || cur.air) return;
      const wpn = W(); if (!(ammo[team][weapon] > 0)) return;
      if (ammo[team][weapon] !== Infinity) ammo[team][weapon]--;
      firedAt = clock; log.shot = [weapon, Math.round(aim), Math.round(power * 100), fuse, Math.round(airX), cur.face]; log.at = [Math.round(cur.x), Math.round(cur.y)];
      launch(cur, wpn, aim, power, fuse, airX);
      phase = 'fired'; retreat = isHuman(team) ? RETREAT : 1.2; charging = false; syncUI();
    }
    function endTurn() {
      phase = 'settle'; settleT = 0.6; charging = false;
    }
    function settled() { return !projs.length && worms.every(w => w.dead || (!w.air && !(w.dying > 0))) && !booms.some(b => b.t < 0.5); }
    function finishTurn() {
      // mrtví zmizí, zápis tahu
      for (const w of worms) if (w.hp <= 0) w.dead = true;
      const mv = encode();
      if (online && isHuman(team)) net.send(mv);
      moves.push(mv);
      turn++; api.changed();
      startTurn();
    }
    const moves = [];
    // Tah: "zbraň,úhel,síla,rozbuška,náletX:x,y červa při výstřelu:výbuchy x,y,r,t;…:x,y,hp každého červa;…"
    // čísla v base36, ať se tah vejde do zprávy
    const b36 = a => a.map(n => Math.round(n).toString(36)).join(',');
    const un36 = t => t.split(',').map(v => parseInt(v, 36));
    function encode() {
      const shot = log.shot ? b36(log.shot) : '-';
      const at = b36(log.at || log.from);
      const ex = log.ex.length ? log.ex.slice(0, 16).map(b36).join(';') : '_';
      const ws = worms.map(w => b36([w.x, w.y, w.dead ? 0 : w.hp])).join(';');
      return `${shot}:${at}:${ex}:${ws}`;
    }
    function decode(s) {
      const [shot, at, ex, ws] = s.split(':');
      return { shot: shot === '-' ? null : un36(shot), at: un36(at), ex: ex === '_' ? [] : ex.split(';').map(un36), ws: ws.split(';').map(un36) };
    }
    // výsledek tahu soupeře (nebo obnovení): terén a červi podle zápisu
    function applyState(m) {
      for (const [x, y, r] of m.ex) dig(x, y, r);
      redrawTerrain();
      m.ws.forEach(([x, y, hp], i) => { const w = worms[i]; if (!w) return; w.x = x; w.y = y; w.vx = w.vy = 0; w.air = false; if (hp < w.hp) pops.push({ x, y: y - 30, t: 1.5, text: `−${w.hp - hp}`, col: TEAM[w.team].col }); w.hp = hp; w.dead = hp <= 0; w.drown = hp <= 0 && y > WATER; w.dying = 0; });
    }
    function applyRemote(s) {
      if (done) return;
      const m = decode(s);
      if (m.shot) { const [wi] = m.shot; if (ammo[team][wi] !== Infinity) ammo[team][wi]--; }
      replay = { m, s, t: 0, walkFrom: [cur.x, cur.y], fired: false, exIdx: 0 };
      phase = 'replay';
    }
    function checkEnd() {
      const a0 = alive(0), a1 = alive(1);
      if (a0 && a1) return false;
      done = true; phase = 'over'; syncUI();
      const winner = a0 ? 0 : a1 ? 1 : -1;
      if (online) { net.end(winner < 0 ? 0 : winner === me ? net.side : -net.side, 'worms'); return true; }
      setTimeout(() => {
        if (P.type === 'duo') { api.solved({ title: winner < 0 ? L('Remíza', 'Draw') : L(`Vyhrál ${teamName(winner)}`, `${teamName(winner)} wins`), html: `<p class="k-muted">${L(`Tahy: ${turn}`, `Turns: ${turn}`)}</p>` }); return; }
        const left = order(0).filter(w => !w.dead).length;
        if (winner === 0) api.solved({ title: L('Vítězství!', 'Victory!'), stars: left === 3 ? 3 : left === 2 ? 2 : 1, html: `<p class="k-muted">${L(`Přeživší červi: ${left} · tahy ${turn}`, `Worms alive: ${left} · turns ${turn}`)}</p>` });
        else api.failed({ title: winner < 0 ? L('Remíza', 'Draw') : L('Tvůj tým padl', 'Your team is wiped out'), html: `<p class="k-muted">${L(`Tahy: ${turn}`, `Turns: ${turn}`)}</p>` });
      }, 900);
      return true;
    }

    // ── Počítač: vyzkouší bazuku a granát na nejbližší soupeře (zná vítr), pak se splete podle síly ──
    function simShot(w, kind, a, pw, fz) {
      const ang = a * Math.PI / 180, cx = Math.cos(ang) * w.face, cy = -Math.sin(ang);
      let x = w.x + cx * 14, y = w.y - 10 + cy * 14, vx = cx * pw * (kind === 'grenade' ? 560 : 640), vy = cy * pw * (kind === 'grenade' ? 560 : 640), t = 0;
      const dt = 1 / 60;
      for (let i = 0; i < 60 * 8; i++) {
        t += dt; if (kind === 'rocket') vx += wind * 9 * dt; vy += G * dt;
        const nx = x + vx * dt, ny = y + vy * dt;
        if (kind === 'grenade') {
          if (solidAt(mask, nx, y)) vx = -vx * 0.45; else x = nx;
          if (solidAt(mask, x, ny)) { vy = -vy * 0.45; vx *= 0.8; } else y = ny;
          if (t >= fz) return [x, y];
        } else { x = nx; y = ny; if (solidAt(mask, x, y)) return [x, y]; if (t > 0.15 && worms.some(o => !o.dead && Math.abs(o.x - x) < 8 && y > o.y - 20 && y < o.y + 1)) return [x, y]; }
        if (y > WATER || x < -300 || x > MW + 300) return null;
      }
      return null;
    }
    function planAI() {
      const w = cur, foes = worms.filter(o => o.team !== w.team && !o.dead).sort((a, b) => Math.abs(a.x - w.x) - Math.abs(b.x - w.x)).slice(0, 2);
      let best = null;
      for (const foe of foes) {
        const face = foe.x >= w.x ? 1 : -1, save = w.face; w.face = face;
        for (const kind of ['rocket', 'grenade']) for (let a = -30; a <= 85; a += 5) for (let pw = 0.25; pw <= 1.001; pw += 0.06) {
          const hit = simShot(w, kind, a, pw, 3); if (!hit) continue;
          let d = Math.hypot(hit[0] - foe.x, hit[1] - (foe.y - 6));
          if (Math.hypot(hit[0] - w.x, hit[1] - w.y) < 50) d += 200; // nestřílej si pod nohy
          if (!best || d < best.d) best = { d, a, pw, kind, face };
        }
        w.face = save;
      }
      if (!best) best = { a: 45, pw: 0.6, kind: 'rocket', face: w.face };
      const err = [0, 9, 4, 1.4][P.ai];
      return { face: best.face, a: Math.max(-85, Math.min(85, best.a + (Math.random() - 0.5) * 2 * err)), pw: Math.max(0.15, Math.min(1, best.pw + (Math.random() - 0.5) * err / 40)), weapon: best.kind === 'grenade' ? 1 : 0 };
    }

    // ── Vykreslení ──
    el.innerHTML = `<div class="cv-wrap">
      <div class="cv-top"><div class="cv-t cv-t0"><b></b><i><s></s></i></div><div class="cv-mid"><b class="cv-timer"></b><span class="cv-wind"></span><span class="cv-wbar"><u></u></span></div><div class="cv-t cv-t1"><b></b><i><s></s></i></div></div>
      <div class="cv-stage"><canvas class="cv-board"></canvas><div class="cv-banner" hidden></div><button class="cv-zoom" data-c="zoom" title="${L('Přiblížit / celý ostrov', 'Zoom in / whole island')}">⤢</button></div>
      <div class="cv-ctrl">
        <div class="cv-pad"><button data-c="l" aria-label="${L('Doleva', 'Left')}">◀</button><button data-c="jump" aria-label="${L('Skok', 'Jump')}">⤒</button><button data-c="r" aria-label="${L('Doprava', 'Right')}">▶</button></div>
        <div class="cv-pad"><button data-c="up" aria-label="${L('Mířit výš', 'Aim up')}">▲</button><button data-c="down" aria-label="${L('Mířit níž', 'Aim down')}">▼</button></div>
        <button class="cv-fire" data-c="fire">${L('PAL!', 'FIRE!')}<small>${L('drž pro sílu', 'hold for power')}</small></button>
        <div class="cv-weap"></div>
        <div class="cv-fuse"><span>${L('Rozbuška', 'Fuse')}</span>${[1, 2, 3, 4, 5].map(n => `<button data-f="${n}">${n} s</button>`).join('')}</div>
      </div>
      <div class="k-tools"><button class="k-tool" data-c="skip">${api.icon('undo')}<span>${L('Ukončit tah', 'End turn')}</span></button><button class="k-tool" data-c="resign">${api.icon('x')}<span>${L('Vzdát', 'Resign')}</span></button></div></div>`;
    const cv = el.querySelector('.cv-board'), ctx = cv.getContext('2d'), wrapEl = el.querySelector('.cv-wrap'), bannerEl = el.querySelector('.cv-banner');
    let cssW = 900, cssH = 506, dpr = 1, zoom = 1, fitZoom = 1, closeUp = false, camX = MW / 2, camY = MH / 2, bgCv = null;
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      const phone = box < 740;
      cssW = Math.floor(box - 2); cssH = Math.floor(Math.min(cssW * MH / MW, innerHeight - (phone ? 330 : 270)));
      if (phone) cssH = Math.max(cssH, Math.round(cssW * 0.72));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
      fitZoom = Math.min(cssW / MW, cssH / MH); closeUp = phone;
      wrapEl.classList.toggle('phone', phone); bgCv = null;
    }
    const THEMES = [
      { sky: ['#1b1550', '#6a3a8a', '#ff9a6a'], sun: { x: 0.78, y: 0.5, r: 46, c: '#ffd27a' }, far: '#5a3a86', near: '#3a2766', cloud: 'rgba(255,190,200,.32)',
        dirt: [[150, 100, 62], [84, 50, 34]], stone: ['#c49a6a', '#5e3a24'], grass: [118, 214, 86], grassDark: [52, 140, 50], water: ['#2a6aa0', '#0c2c52'], decos: ['palm', 'palm', 'palm', 'bush', 'rock', 'flower'] },
      { sky: ['#04051a', '#121845', '#2c3a78'], moon: { x: 0.22, y: 0.2, r: 30 }, stars: true, far: '#1c2250', near: '#11163a', cloud: 'rgba(140,160,220,.16)',
        dirt: [[104, 88, 124], [44, 34, 62]], stone: ['#9a8cb8', '#2a2040'], grass: [90, 200, 160], grassDark: [40, 120, 110], water: ['#1a4272', '#061830'], decos: ['dead', 'dead', 'lamp', 'pumpkin', 'rock', 'pumpkin'] },
      { sky: ['#2f6fc8', '#86bdec', '#e8f4ff'], sun: { x: 0.82, y: 0.16, r: 34, c: '#fff4c0' }, far: '#8fb0d8', near: '#5f9a7a', cloud: 'rgba(255,255,255,.85)',
        dirt: [[156, 108, 68], [82, 54, 38]], stone: ['#c8b08a', '#5a3e28'], grass: [130, 220, 90], grassDark: [58, 150, 56], water: ['#2f86c0', '#0f4a80'], decos: ['pine', 'oak', 'pine', 'bush', 'flower', 'mushroom', 'sign', 'rock', 'flower'] },
    ];
    const TH = THEMES[I.theme];
    // ── Terén: bitmapa jednou (hlína se šumem a vrstvami, kamínky, tráva, stínování hran); výbuch jen vyřízne díru ──
    const holes = [];
    function dig(x, y, r) { carve(mask, x, y, r); holes.push([x, y, r]); }
    const hash = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + P.seed | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vnoise = (x, y, c) => { const i = Math.floor(x / c), j = Math.floor(y / c), fx = smooth(x / c - i), fy = smooth(y / c - j), a = hash(i, j), b = hash(i + 1, j), d = hash(i, j + 1), e = hash(i + 1, j + 1); return a + (b - a) * fx + (d - a) * fy + (a - b - d + e) * fx * fy; };
    let decos = null, decoCv = null;
    function buildTerrain() {
      terrainCv = document.createElement('canvas'); terrainCv.width = MW; terrainCv.height = MH; terrainG = terrainCv.getContext('2d');
      const img = terrainG.createImageData(MW, MH), d = img.data, [c0, c1] = TH.dirt, gr = TH.grass, gd = TH.grassDark;
      // vzdálenost ke vzduchu nahoru, dolů, doleva a doprava (na stínování)
      const up = new Uint8Array(MW * MH), dn = new Uint8Array(MW * MH), lf = new Uint8Array(MW * MH), rt = new Uint8Array(MW * MH);
      for (let x = 0; x < MW; x++) { let a = 0; for (let y = 0; y < MH; y++) { const i = y * MW + x; a = mask[i] ? Math.min(255, a + 1) : 0; up[i] = a; } a = 0; for (let y = MH - 1; y >= 0; y--) { const i = y * MW + x; a = mask[i] ? Math.min(255, a + 1) : 0; dn[i] = a; } }
      for (let y = 0; y < MH; y++) { let a = 0; for (let x = 0; x < MW; x++) { const i = y * MW + x; a = mask[i] ? Math.min(255, a + 1) : 0; lf[i] = a; } a = 0; for (let x = MW - 1; x >= 0; x--) { const i = y * MW + x; a = mask[i] ? Math.min(255, a + 1) : 0; rt[i] = a; } }
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const i = y * MW + x; if (!mask[i]) continue;
        const u = up[i], gdepth = 5 + Math.floor(hash(x, 7) * 4);
        let r, g, b;
        if (u <= gdepth && dn[i] > 2) {
          const k = (u - 1) / gdepth; r = gr[0] + (gd[0] - gr[0]) * k; g = gr[1] + (gd[1] - gr[1]) * k; b = gr[2] + (gd[2] - gr[2]) * k;
          if (u === 1) { r += 30; g += 30; b += 20; }
        } else {
          const k = Math.min(1, y / MH * 1.5), n1 = vnoise(x, y, 18), n2 = vnoise(x + 99, y, 5);
          const band = Math.sin((y + n1 * 40) / 7) > 0.55 ? -14 : 0, f = 0.8 + n1 * 0.32 + n2 * 0.12;
          r = (c0[0] + (c1[0] - c0[0]) * k) * f + band; g = (c0[1] + (c1[1] - c0[1]) * k) * f + band; b = (c0[2] + (c1[2] - c0[2]) * k) * f + band;
          if (u <= gdepth + 4) { r *= 0.72; g *= 0.72; b *= 0.72; } // stín pod trávou
        }
        const sh = dn[i] <= 4 ? 0.55 + dn[i] * 0.1 : 1, lt = lf[i] <= 2 ? 1.18 : rt[i] <= 3 ? 0.8 : 1;
        d[i * 4] = r * sh * lt; d[i * 4 + 1] = g * sh * lt; d[i * 4 + 2] = b * sh * lt; d[i * 4 + 3] = 255;
      }
      terrainG.putImageData(img, 0, 0);
      // kamínky a kořínky v hlíně
      const rr = rngOf(P.seed ^ 0x5707e);
      terrainG.globalCompositeOperation = 'source-atop';
      for (let k = 0; k < 340; k++) {
        const x = rr() * MW, y = rr() * MH, s = 2 + rr() * 5, sy = up[(y | 0) * MW + (x | 0)];
        if (!mask[(y | 0) * MW + (x | 0)] || sy < 14) continue;
        terrainG.fillStyle = rr() < 0.5 ? TH.stone[1] : TH.stone[0]; terrainG.globalAlpha = 0.55;
        terrainG.beginPath(); terrainG.ellipse(x, y, s, s * 0.7, rr() * 3, 0, 7); terrainG.fill();
        terrainG.fillStyle = 'rgba(255,255,255,.35)'; terrainG.beginPath(); terrainG.ellipse(x - s * 0.3, y - s * 0.25, s * 0.35, s * 0.22, 0, 0, 7); terrainG.fill();
      }
      terrainG.globalAlpha = 1; terrainG.globalCompositeOperation = 'source-over';
      // stébla trávy nad povrchem
      terrainG.lineWidth = 1.2;
      for (let x = 1; x < MW - 1; x += 2) for (let y = 1; y < MH; y++) {
        const i = y * MW + x; if (!mask[i] || mask[i - MW] || dn[i] <= 4) continue;
        const h = 2 + hash(x, y) * 5, lean = (hash(y, x) - 0.5) * 3;
        terrainG.strokeStyle = `rgb(${gr[0] - 20 + h * 6},${gr[1] - 10 + h * 4},${gr[2]})`;
        terrainG.beginPath(); terrainG.moveTo(x, y + 1); terrainG.lineTo(x + lean, y - h); terrainG.stroke();
      }
      buildDecos();
    }
    // ozdoby stojí na povrchu; když jim výbuch podebere zem, zmizí
    function buildDecos() {
      if (!decos) {
        decos = [];
        const r = rngOf(P.seed ^ 0xdec0), n = 26;
        for (let k = 0, tries = 0; k < n && tries < 600; tries++) {
          const x = 30 + Math.floor(r() * (MW - 60)); let y = 0; while (y < MH && !solidAt(mask, x, y)) y++;
          if (y >= WATER - 20 || Math.abs(y - (() => { let yy = 0; while (yy < MH && !solidAt(mask, x + 8, yy)) yy++; return yy; })()) > 6) continue;
          if (worms.some(w => Math.abs(w.x - x) < 26) || decos.some(o => Math.abs(o.x - x) < 34)) continue;
          const kind = TH.decos[Math.floor(r() * TH.decos.length)];
          decos.push({ kind, x, y: y + 1, s: 0.85 + r() * 0.4, seed: Math.floor(r() * 1e9) }); k++;
        }
      }
      decos = decos.filter(o => solidAt(mask, o.x, o.y + 2));
      decoCv = document.createElement('canvas'); decoCv.width = MW; decoCv.height = MH;
      const g = decoCv.getContext('2d');
      for (const o of decos) CvArt.deco(g, o.kind, o.x, o.y, o.s, rngOf(o.seed));
      g.globalCompositeOperation = 'destination-out';
      for (const [x, y, R] of holes) { g.beginPath(); g.arc(x, y, R, 0, 7); g.fill(); }
    }
    function drawHole(x, y, R) {
      if (!terrainG) return;
      terrainG.save(); terrainG.globalCompositeOperation = 'destination-out'; terrainG.beginPath(); terrainG.arc(x, y, R, 0, 7); terrainG.fill();
      // spálený okraj díry
      terrainG.globalCompositeOperation = 'source-atop';
      const g = terrainG.createRadialGradient(x, y, R, x, y, R + 9); g.addColorStop(0, 'rgba(20,10,6,.75)'); g.addColorStop(1, 'rgba(20,10,6,0)');
      terrainG.fillStyle = g; terrainG.beginPath(); terrainG.arc(x, y, R + 9, 0, 7); terrainG.fill(); terrainG.restore();
      if (decos && decos.some(o => !solidAt(mask, o.x, o.y + 2) || Math.hypot(o.x - x, o.y - y) < R + 30)) buildDecos();
    }
    function redrawTerrain() { buildTerrain(); }
    // ── Pozadí: obloha, slunce/měsíc a hvězdy (statické), hory a mraky v paralaxe ──
    const clouds = Array.from({ length: 7 }, (_, i) => { const r = rngOf(P.seed ^ (0xc1 + i)); return { x: r() * 1.6, y: 0.06 + r() * 0.3, s: 0.6 + r() * 0.9, v: 0.004 + r() * 0.01 }; });
    const ridge = (u, ph, a) => Math.sin(u * 0.011 + ph) * a * 0.5 + Math.sin(u * 0.027 + ph * 2.1) * a * 0.3 + Math.sin(u * 0.063 + ph * 3.7) * a * 0.12;
    function background() {
      if (bgCv) return bgCv;
      bgCv = document.createElement('canvas'); bgCv.width = cv.width; bgCv.height = cv.height;
      const g = bgCv.getContext('2d'), Wd = bgCv.width, Hd = bgCv.height, sky = g.createLinearGradient(0, 0, 0, Hd);
      sky.addColorStop(0, TH.sky[0]); sky.addColorStop(0.62, TH.sky[1]); sky.addColorStop(1, TH.sky[2]);
      g.fillStyle = sky; g.fillRect(0, 0, Wd, Hd);
      const r = rngOf(P.seed ^ 0xc10d);
      if (TH.stars) for (let i = 0; i < 180; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.7})`; const z = (r() < 0.1 ? 2.2 : 1.2) * dpr; g.fillRect(r() * Wd, r() * Hd * 0.7, z, z); }
      const orb = TH.sun || TH.moon;
      if (orb) {
        const ox = orb.x * Wd, oy = orb.y * Hd, R = orb.r * dpr, glow = g.createRadialGradient(ox, oy, R * 0.6, ox, oy, R * 4);
        glow.addColorStop(0, TH.sun ? 'rgba(255,230,160,.45)' : 'rgba(200,220,255,.25)'); glow.addColorStop(1, 'rgba(255,230,160,0)');
        g.fillStyle = glow; g.beginPath(); g.arc(ox, oy, R * 4, 0, 7); g.fill();
        g.fillStyle = TH.sun ? orb.c : '#eef2ff'; g.beginPath(); g.arc(ox, oy, R, 0, 7); g.fill();
        if (TH.moon) { g.fillStyle = 'rgba(150,160,200,.35)'; for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.3, 0.15], [0.1, -0.4, 0.1]]) { g.beginPath(); g.arc(ox + dx * R, oy + dy * R, rr * R, 0, 7); g.fill(); } }
      }
      return bgCv;
    }
    function drawParallax() {
      // v CSS pixelech obrazovky
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const base = cssH * 0.5 + (MH / 2 - camY) * zoom * 0.25;
      for (const c of clouds) {
        const x = ((c.x + clock * c.v - camX / MW * 0.15) % 1.6 + 1.6) % 1.6 * cssW * 1.2 - cssW * 0.2, y = c.y * cssH + (MH / 2 - camY) * zoom * 0.1, s = c.s * Math.max(0.6, cssW / 900);
        ctx.fillStyle = TH.cloud; ctx.beginPath();
        for (const [dx, dy, rr] of [[0, 0, 22], [24, -8, 18], [46, 2, 16], [-22, 4, 14], [16, 8, 18]]) { ctx.moveTo(x + dx * s + rr * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, rr * s, 0, 7); }
        ctx.fill();
      }
      for (const [col, par, h, ph, off] of [[TH.far, 0.12, 0.34, 1.3, 0.02], [TH.near, 0.25, 0.22, 4.1, 0.16]]) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, cssH);
        for (let x = 0; x <= cssW + 8; x += 8) { const u = (x + camX * zoom * par) / Math.max(0.5, zoom); ctx.lineTo(x, base + off * cssH - Math.abs(ridge(u, ph, cssH * h)) - cssH * h * 0.3); }
        ctx.lineTo(cssW, cssH); ctx.fill();
      }
    }
    function label(text, x, y, col) {
      const w = ctx.measureText(text).width + 8;
      ctx.fillStyle = 'rgba(8,8,26,.72)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 7, w, 13, 3); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = col; ctx.fillText(text, x, y + 3.5);
    }
    function drawWorm(w) {
      if (w.dead && !(w.dying > 0)) {
        if (w.drown) return;
        ctx.save(); ctx.translate(w.x, w.y + 1); CvArt.grave(ctx, TEAM[w.team].col); ctx.restore();
        return;
      }
      const col = TEAM[w.team].col, active = w === cur && !done, armed = active && phase === 'move' && !w.air && W().kind !== 'air' || (active && phase === 'move' && W().kind === 'air');
      ctx.save(); ctx.translate(w.x, w.y);
      if (w.air) ctx.rotate(Math.max(-0.5, Math.min(0.5, w.vx / 300)) * w.face * (w.vy < 0 ? 1 : -1) * 0.6);
      const hurt = w.dying > 0 && Math.sin(clock * 20) > 0;
      CvArt.worm(ctx, { col, face: w.face, t: clock + w.idx * 1.3 + w.team * 0.7, walk: w.wt > 0 ? w.wp : 0, aim: armed ? aim : 0, look: active && phase === 'move' ? aim : w.air ? 40 : 0, weapon: armed ? W().id : null, hurt, blink: w.dying > 0 });
      ctx.restore();
      ctx.font = '700 9px Space Grotesk, sans-serif'; ctx.textAlign = 'center';
      label(w.name, w.x, w.y - 44, col); label(String(Math.round(w.shown)), w.x, w.y - 31, col);
      if (active && phase === 'move') { ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; const by = w.y - 66 + Math.sin(clock * 5) * 3; ctx.beginPath(); ctx.moveTo(w.x - 6, by); ctx.lineTo(w.x + 6, by); ctx.lineTo(w.x, by + 8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    function drawProj(p) {
      ctx.textAlign = 'center'; ctx.font = '800 11px Space Grotesk, sans-serif';
      if (p.k === 'rocket' || p.k === 'missile') {
        const a = Math.atan2(p.vy, p.vx); CvArt.rocket(ctx, p.x, p.y, a);
        if (Math.random() < 0.7) parts.push({ x: p.x - Math.cos(a) * 12, y: p.y - Math.sin(a) * 12, vx: (Math.random() - 0.5) * 10, vy: -12, t: 0.7, puff: 3 + Math.random() * 2, col: '220,220,235' });
      } else if (p.k === 'grenade') {
        CvArt.grenade(ctx, p.x, p.y, clock, p.t * 9 * Math.sign(p.vx || 1));
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(Math.max(1, Math.ceil(p.fuse)), p.x, p.y - 12); ctx.fillStyle = '#fff'; ctx.fillText(Math.max(1, Math.ceil(p.fuse)), p.x, p.y - 12);
      } else if (p.k === 'dyn') {
        CvArt.stick(ctx, p.x, p.y - 5, clock);
        if (Math.random() < 0.5) parts.push({ x: p.x + 1.5, y: p.y - 16, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 40, t: 0.3, col: '#ffd34d', g: true });
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(Math.max(1, Math.ceil(p.fuse)), p.x, p.y - 22); ctx.fillStyle = '#fff'; ctx.fillText(Math.max(1, Math.ceil(p.fuse)), p.x, p.y - 22);
      }
    }
    function drawWater(back) {
      const y0 = WATER + (back ? -7 : 0), wg = ctx.createLinearGradient(0, y0, 0, MH);
      wg.addColorStop(0, back ? TH.water[1] : TH.water[0]); wg.addColorStop(1, TH.water[1]);
      ctx.globalAlpha = back ? 0.85 : 0.92; ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(-400, MH + 400);
      const wave = x => y0 + Math.sin(x * (back ? 0.021 : 0.03) + clock * (back ? -1.4 : 2)) * 3 + Math.sin(x * 0.07 + clock * 3) * 1.2;
      for (let x = -400; x <= MW + 400; x += 12) ctx.lineTo(x, wave(x));
      ctx.lineTo(MW + 400, MH + 400); ctx.fill(); ctx.globalAlpha = 1;
      if (!back) {
        ctx.strokeStyle = 'rgba(220,245,255,.55)'; ctx.lineWidth = 1.6; ctx.beginPath();
        for (let x = -400; x <= MW + 400; x += 12) ctx.lineTo(x, wave(x)); ctx.stroke();
        ctx.fillStyle = 'rgba(220,245,255,.35)';
        for (let i = 0; i < 26; i++) { const x = ((i * 97 + clock * 22 * (i % 2 ? 1 : -1)) % (MW + 200) + MW + 200) % (MW + 200) - 100, y = WATER + 10 + (i * 37) % 30; ctx.fillRect(x, y, 10 + (i % 3) * 4, 1.4); }
      }
    }
    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(background(), 0, 0);
      zoom = closeUp ? Math.max(fitZoom, 0.82) : fitZoom;
      const viewW = cssW / zoom, viewH = cssH / zoom;
      // kamera sleduje střelu nebo červa na tahu
      let fx = camX, fy = camY;
      const p = projs[0], focus = p ? p : replay && replay.focus ? replay.focus : cur;
      if (focus) { fx = focus.x; fy = focus.y - 40; }
      camX += (fx - camX) * 0.08; camY += (fy - camY) * 0.08;
      camX = viewW >= MW ? MW / 2 : Math.max(viewW / 2, Math.min(MW - viewW / 2, camX));
      camY = viewH >= MH ? MH / 2 : Math.max(viewH / 2, Math.min(MH - viewH / 2, camY));
      drawParallax();
      const sx = (shake > 0 ? (Math.random() - 0.5) * shake * 26 : 0), sy = (shake > 0 ? (Math.random() - 0.5) * shake * 26 : 0);
      ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, (cssW / 2 - camX * zoom + sx) * dpr, (cssH / 2 - camY * zoom + sy) * dpr);
      drawWater(true);
      ctx.drawImage(decoCv, 0, 0);
      ctx.drawImage(terrainCv, 0, 0);
      worms.forEach(drawWorm);
      projs.forEach(drawProj);
      for (const pl of planes) {
        ctx.save(); ctx.translate(pl.x, pl.y); ctx.scale(pl.vx > 0 ? 1.6 : -1.6, 1.6);
        ctx.fillStyle = '#9aa4c0'; ctx.strokeStyle = '#3a4058'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-16, -2); ctx.lineTo(10, -3); ctx.quadraticCurveTo(17, 0, 10, 3); ctx.lineTo(-16, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6a7494'; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-8, 10); ctx.lineTo(-3, 10); ctx.lineTo(4, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-14, -1); ctx.lineTo(-19, -8); ctx.lineTo(-15, -8); ctx.lineTo(-10, -1); ctx.fill();
        ctx.fillStyle = '#bfe8ff'; ctx.fillRect(5, -2.5, 4, 2); ctx.restore();
      }
      // zaměřovač a síla
      if (cur && phase === 'move' && isHuman(team) && !done) {
        if (W().kind === 'air') {
          ctx.strokeStyle = '#ff5a7a'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(airX, 0); ctx.lineTo(airX, MH); ctx.stroke(); ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(airX, 60, 10, 0, 7); ctx.stroke();
        } else if (W().kind !== 'drop') {
          const a = aim * Math.PI / 180, cx = cur.x + Math.cos(a) * cur.face * 50, cy = cur.y - 10 - Math.sin(a) * 50;
          ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.stroke();
          ctx.strokeStyle = '#ff3a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx - 3, cy); ctx.moveTo(cx + 3, cy); ctx.lineTo(cx + 10, cy); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy - 3); ctx.moveTo(cx, cy + 3); ctx.lineTo(cx, cy + 10); ctx.stroke();
          if (W().charge) {
            const pw = charging ? Math.min(1, chargeT / 1.6) : power;
            for (let i = 0; i < 14; i++) { if (i / 14 > pw) break; const d = 14 + i * 3; ctx.fillStyle = `hsl(${60 - i * 4.5},100%,58%)`; ctx.beginPath(); ctx.arc(cur.x + Math.cos(a) * cur.face * d, cur.y - 10 - Math.sin(a) * d, 1.5 + i * 0.26, 0, 7); ctx.fill(); }
          }
        }
      }
      for (const b of booms) {
        const k = Math.min(1, b.t / 0.22), fade = Math.max(0, 1 - (b.t - 0.12) / 0.55); if (fade <= 0) continue;
        if (b.t < 0.3) { ctx.strokeStyle = `rgba(255,255,255,${(0.3 - b.t) * 3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.6 + b.t * 4), 0, 7); ctx.stroke(); }
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * (0.55 + k * 0.6));
        g.addColorStop(0, `rgba(255,255,230,${fade})`); g.addColorStop(0.35, `rgba(255,214,90,${fade})`); g.addColorStop(0.7, `rgba(255,110,40,${fade * 0.85})`); g.addColorStop(1, 'rgba(200,40,30,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.55 + k * 0.6), 0, 7); ctx.fill();
      }
      for (const q of parts) {
        if (q.ray) { ctx.strokeStyle = `rgba(255,240,180,${q.t * 6})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x2, q.y2); ctx.stroke(); continue; }
        if (q.puff) { const life = q.life || 0.7, k = 1 - q.t / life; ctx.fillStyle = `rgba(${q.col},${Math.min(0.55, q.t / life * 0.8)})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.puff * (1 + k * 2.2), 0, 7); ctx.fill(); continue; }
        ctx.globalAlpha = Math.min(1, q.t * 2); ctx.fillStyle = q.col; const z = q.z || 3; ctx.fillRect(q.x - z / 2, q.y - z / 2, z, z);
      }
      ctx.globalAlpha = 1;
      drawWater(false);
      ctx.font = '900 16px Unbounded, sans-serif'; ctx.textAlign = 'center';
      for (const q of pops) { ctx.globalAlpha = Math.min(1, q.t); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; const y = q.y - (1.5 - q.t) * 24; ctx.strokeText(q.text, q.x, y); ctx.fillStyle = q.col; ctx.fillText(q.text, q.x, y); }
      ctx.globalAlpha = 1;
    }
    // ── Panel ──
    function syncUI() {
      const mine = !!cur && isHuman(team) && phase === 'move' && !done;
      el.querySelectorAll('.cv-ctrl button').forEach(b => (b.disabled = !mine));
      el.querySelector('[data-c="skip"]').disabled = !(isHuman(team) && (phase === 'move' || phase === 'fired') && !done);
      el.querySelector('.cv-weap').innerHTML = WEAPONS.map((w, i) => { const n = ammo[team][i]; return `<button data-w="${i}" class="${i === weapon ? 'on' : ''}" ${n > 0 && mine ? '' : 'disabled'}>${CvArt.ICON[w.id]}${w.name}<small>${n === Infinity ? '∞' : n}</small></button>`; }).join('');
      el.querySelector('.cv-fuse').hidden = W().kind !== 'bounce';
      el.querySelectorAll('.cv-fuse [data-f]').forEach(b => b.classList.toggle('on', +b.dataset.f === fuse));
      for (let t = 0; t < 2; t++) {
        const box = el.querySelector(`.cv-t${t}`), hp = worms.filter(w => w.team === t).reduce((s, w) => s + (w.dead ? 0 : w.hp), 0);
        box.classList.toggle('on', t === team && !done); box.querySelector('b').textContent = `${teamName(t)} · ${hp}`; box.querySelector('s').style.width = hp / (PER_TEAM * 100) * 100 + '%';
      }
      el.querySelector('.cv-wind').textContent = wind === 0 ? L('bezvětří', 'calm') : `${L('vítr', 'wind')} ${wind > 0 ? '→' : '←'}${Math.abs(wind)}`;
      const wb = el.querySelector('.cv-wbar u'), wk = Math.min(1, Math.abs(wind) / 10) * 50;
      wb.style.left = (wind < 0 ? 50 - wk : 50) + '%'; wb.style.width = wk + '%'; wb.className = wind < 0 ? 'l' : 'r';
      wrapEl.classList.toggle('waiting', !mine);
    }
    // vstupy
    const held = { l: 0, r: 0, up: 0, down: 0 };
    function press(c, down) {
      if (c === 'fire') { if (!isHuman(team) || phase !== 'move') return; if (down) { charging = W().charge; chargeT = 0; chargeStart = performance.now(); if (!W().charge) fire(); } else if (charging) { const quick = performance.now() - chargeStart < 160; if (!quick) power = Math.max(0.05, Math.min(1, chargeT / 1.6)); fire(); } return; }
      if (c in held) held[c] = down ? 1 : 0;
      if (down && c === 'jump' && cur && isHuman(team) && (phase === 'move' || phase === 'fired')) jump(cur);
    }
    let chargeStart = 0;
    el.querySelector('.cv-ctrl').addEventListener('pointerdown', e => { const b = e.target.closest('[data-c]'); if (!b || b.disabled) return; e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ukazatel už neplatí */ } press(b.dataset.c, true); });
    el.querySelector('.cv-ctrl').addEventListener('pointerup', e => { const b = e.target.closest('[data-c]'); if (b) press(b.dataset.c, false); });
    el.querySelector('.cv-ctrl').addEventListener('pointercancel', () => { for (const k in held) held[k] = 0; });
    el.querySelector('.cv-weap').addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (!b || b.disabled) return; weapon = +b.dataset.w; api.sound('tap'); syncUI(); });
    el.querySelector('.cv-fuse').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b || b.disabled) return; fuse = +b.dataset.f; syncUI(); });
    el.querySelector('[data-c="zoom"]').addEventListener('click', () => { closeUp = !closeUp; });
    el.querySelector('[data-c="skip"]').addEventListener('click', () => { if (isHuman(team) && (phase === 'move' || phase === 'fired') && !done) endTurn(); });
    el.querySelector('[data-c="resign"]').addEventListener('click', () => {
      if (done) return;
      if (online) { done = true; net.resign(); return; }
      for (const w of worms) if (w.team === (P.type === 'duo' ? team : 0)) { w.dead = true; w.hp = 0; }
      checkEnd();
    });
    // míření tahem po ploše (úhel a síla), nálet: kam klepneš
    let aiming = false;
    const toWorld = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - cssW / 2) / zoom + camX, (e.clientY - r.top - cssH / 2) / zoom + camY]; };
    const aimAt = e => {
      if (!cur || phase !== 'move' || !isHuman(team)) return;
      const [x, y] = toWorld(e);
      if (W().kind === 'air') { airX = Math.max(30, Math.min(MW - 30, x)); airSet = true; return; }
      const dx = x - cur.x, dy = cur.y - 10 - y; cur.face = dx >= 0 ? 1 : -1;
      aim = Math.max(-85, Math.min(85, Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI)); power = Math.max(0.1, Math.min(1, Math.hypot(dx, dy) / 260));
    };
    cv.addEventListener('pointerdown', e => { aiming = true; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ukazatel už neplatí */ } aimAt(e); });
    cv.addEventListener('pointermove', e => { if (aiming) aimAt(e); });
    cv.addEventListener('pointerup', () => (aiming = false));

    // ── Smyčka ──
    let last = performance.now(), raf = 0, acc = 0;
    function tick(dt) {
      clock += dt; shake = Math.max(0, shake - dt);
      parts = parts.filter(q => { q.x += (q.vx || 0) * dt; q.y += (q.vy || 0) * dt; if (q.g) q.vy += 500 * dt; return (q.t -= dt) > 0; });
      pops = pops.filter(q => (q.t -= dt) > 0);
      for (const b of booms) b.t += dt; booms = booms.filter(b => b.t < 1);
      for (const pl of planes) pl.x += pl.vx * dt; planes = planes.filter(pl => pl.x < MW + 200);
      // chůze: fáze kroku podle ušlé vzdálenosti
      for (const w of worms) { const d = Math.abs(w.x - (w.px ?? w.x)); if (d > 0 && !w.air) { w.wp = (w.wp || 0) + d * 0.7; w.wt = 0.12; } else w.wt = (w.wt || 0) - dt; w.px = w.x; }
      for (const w of worms) { w.shown += (w.hp - w.shown) * Math.min(1, dt * 3); if (w.dying > 0) { w.dying -= dt; if (w.dying <= 0) { w.dead = true; explode(w.x, w.y - 4, { r: 20, dmg: 12 }, phase === 'replay'); } } }
      if (banner) { banner.t -= dt; bannerEl.hidden = banner.t <= 0; bannerEl.textContent = banner.text; if (banner.t <= 0) banner = null; }
      if (charging) chargeT += dt;
      // pohyb červa na tahu
      if (cur && !cur.dead && isHuman(team) && (phase === 'move' || phase === 'fired')) {
        acc += dt; while (acc > 1 / 40) { acc -= 1 / 40; if (held.l) walk(cur, -1); if (held.r) walk(cur, 1); }
        if (held.up) aim = Math.min(85, aim + 60 * dt); if (held.down) aim = Math.max(-85, aim - 60 * dt);
      }
      if (phase === 'move' || phase === 'fired') {
        timer -= dt; if (phase === 'fired') retreat -= dt;
        if (cur && cur.dead) endTurn();
        else if (phase === 'move' && timer <= 0) endTurn();
        else if (phase === 'fired' && retreat <= 0 && !projs.length) endTurn();
      }
      // počítač
      if (aiPlan && phase === 'move' && !done) {
        aiT -= dt; cur.face = aiPlan.face; weapon = aiPlan.weapon;
        aim += Math.sign(aiPlan.a - aim) * Math.min(Math.abs(aiPlan.a - aim), 70 * dt);
        if (aiT <= 0 && Math.abs(aim - aiPlan.a) < 0.5) { aim = aiPlan.a; power = aiPlan.pw; fuse = 3; aiPlan = null; fire(); }
      }
      // přehrávání tahu soupeře
      if (phase === 'replay' && replay) {
        const R = replay, m = R.m; R.t += dt;
        if (!R.fired) {
          const k = Math.min(1, R.t / 0.9); cur.x = R.walkFrom[0] + (m.at[0] - R.walkFrom[0]) * k; cur.y = R.walkFrom[1] + (m.at[1] - R.walkFrom[1]) * k;
          if (k >= 1) {
            R.fired = true; R.t0 = R.t;
            if (m.shot) { const [wi, a, pw, fz, tx, face] = m.shot; weapon = wi; aim = a; if (face) cur.face = face; launch(cur, WEAPONS[wi], a, pw / 100, fz, tx); }
          }
        } else {
          const tt = (R.t - R.t0) * 10;
          while (R.exIdx < m.ex.length && m.ex[R.exIdx][3] <= tt) { const [x, y, r] = m.ex[R.exIdx++]; dig(x, y, r); drawHole(x, y, r); booms.push({ x, y, r, t: 0 }); shake = Math.max(shake, r / 110); api.sound('line'); }
          if (R.exIdx >= m.ex.length && (R.t - R.t0) > 1.2 && !projs.length) {
            projs = []; applyState({ ex: [], ws: m.ws }); replay = null;
            for (const w of worms) if (w.hp <= 0) w.dead = true;
            moves.push(R.s); turn++; startTurn(); return;
          }
        }
      }
      // fyzika
      for (const w of worms) physWorm(w, dt);
      for (const p of projs) stepProj(p, dt, phase === 'replay');
      projs = projs.filter(p => !p.gone);
      if (phase === 'settle') { settleT -= dt; if (settleT <= 0 && settled()) finishTurn(); }
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.04, (now - last) / 1000); last = now;
      if (!done || booms.length || parts.length) tick(dt);
      draw(); if (Math.random() < 0.08) syncUI();
      const tEl = el.querySelector('.cv-timer');
      tEl.textContent = phase === 'move' ? Math.ceil(timer) : phase === 'fired' ? Math.ceil(Math.max(0, retreat)) : phase === 'remote' ? '…' : '';
      tEl.classList.toggle('low', phase === 'move' && timer < 10);
    }

    // obnovení: zapsané tahy se použijí rovnou (terén a červi podle zápisu)
    buildTerrain();
    const restore = online ? net.moves : saved && saved.moves ? saved.moves : [];
    for (const mv of restore) {
      const m = decode(mv); team = turn % 2; cur = nextWorm(team);
      if (m.shot) { const wi = m.shot[0]; if (ammo[team][wi] !== Infinity) ammo[team][wi]--; }
      for (const [x, y, r] of m.ex) dig(x, y, r);
      m.ws.forEach(([x, y, hp], i) => { const w = worms[i]; if (w) { w.x = x; w.y = y; w.hp = hp; w.shown = hp; w.dead = hp <= 0; w.drown = hp <= 0 && y > WATER; } });
      moves.push(mv); turn++;
    }
    if (restore.length) buildTerrain();
    if (online) net.onMove = mv => { if (done) return; if (phase === 'remote') applyRemote(mv); else pending.push(mv); };
    fit(); addEventListener('resize', fit);
    startTurn();
    raf = requestAnimationFrame(frame);
    const onKeyUp = e => { const c = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'up', ArrowDown: 'down', ' ': 'fire' }[e.key]; if (c) press(c, false); };
    addEventListener('keyup', onKeyUp);
    return {
      getState: () => (done ? null : { moves: moves.slice() }),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('keyup', onKeyUp); done = true; },
      onKey(e) {
        const c = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'up', ArrowDown: 'down', ' ': 'fire', Enter: 'jump' }[e.key];
        if (c) { e.preventDefault(); if (!e.repeat) press(c, true); return; }
        if (/^[1-5]$/.test(e.key) && isHuman(team) && phase === 'move' && ammo[team][+e.key - 1] > 0) { weapon = +e.key - 1; syncUI(); }
        if ((e.key === 'f' || e.key === 'F') && isHuman(team)) { fuse = fuse % 5 + 1; syncUI(); }
      },
      _solve() { for (const w of worms) if (w.team === 1) { w.dead = true; w.hp = 0; } checkEnd(); },
      _state: () => ({ turn, team, phase, wind, weapon, done, cur: cur && worms.indexOf(cur), worms: worms.map(w => ({ x: Math.round(w.x), y: Math.round(w.y), hp: w.hp, dead: w.dead })), moves: moves.length, aim: Math.round(aim), power }),
      _aim(a, pw, face) { aim = a; power = pw; if (cur && face) cur.face = face; },
      _fire() { fire(); },
      _target(i) { const w = worms[i]; if (cur && w) { cur.face = w.x >= cur.x ? 1 : -1; } },
    };
  }

  // obrázek na úvodní stránce: dva červi, bazuka, raketa a výbuch na tropickém ostrově
  function art(el) {
    el.innerHTML = '<canvas width="520" height="520" style="object-fit:contain"></canvas>';
    const g = el.querySelector('canvas').getContext('2d'), TAU = Math.PI * 2;
    g.beginPath(); g.roundRect(20, 40, 480, 420, 36); g.clip();
    const sky = g.createLinearGradient(0, 40, 0, 460); sky.addColorStop(0, '#1b1550'); sky.addColorStop(0.6, '#6a3a8a'); sky.addColorStop(1, '#ff9a6a');
    g.fillStyle = sky; g.fillRect(0, 0, 520, 520);
    const glow = g.createRadialGradient(390, 250, 20, 390, 250, 150); glow.addColorStop(0, 'rgba(255,230,160,.5)'); glow.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 520, 520); g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(390, 250, 40, 0, TAU); g.fill();
    g.fillStyle = '#5a3a86'; g.beginPath(); g.moveTo(0, 340); for (let x = 0; x <= 520; x += 10) g.lineTo(x, 300 - Math.abs(Math.sin(x / 70) * 50) - Math.sin(x / 23) * 8); g.lineTo(520, 520); g.lineTo(0, 520); g.fill();
    const ground = x => 330 - Math.sin(x / 520 * 6.2 + 0.4) * 28 - Math.sin(x / 520 * 2.4 + 1) * 34;
    const soil = g.createLinearGradient(0, 260, 0, 460); soil.addColorStop(0, '#96643e'); soil.addColorStop(1, '#4a2c1c');
    g.fillStyle = soil; g.beginPath(); g.moveTo(40, 470); for (let x = 40; x <= 480; x += 4) g.lineTo(x, ground(x)); g.lineTo(480, 470); g.fill();
    g.fillStyle = 'rgba(40,20,10,.5)'; for (const [x, y, r] of [[120, 400, 9], [300, 420, 7], [400, 380, 6], [200, 370, 5]]) { g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, TAU); g.fill(); }
    g.strokeStyle = '#76d656'; g.lineWidth = 9; g.beginPath(); for (let x = 40; x <= 480; x += 4) g.lineTo(x, ground(x) + 4); g.stroke();
    // kráter
    g.fillStyle = '#6a3a8a'; g.beginPath(); g.arc(330, ground(330) + 10, 30, 0, TAU); g.fill();
    CvArt.deco(g, 'palm', 210, ground(210) + 3, 1.6, rngOf(5));
    CvArt.deco(g, 'rock', 440, ground(440) + 2, 1.4, rngOf(6));
    const water = g.createLinearGradient(0, 430, 0, 470); water.addColorStop(0, '#2a6aa0'); water.addColorStop(1, '#0c2c52');
    g.fillStyle = water; g.beginPath(); g.moveTo(0, 520); for (let x = 0; x <= 520; x += 8) g.lineTo(x, 436 + Math.sin(x / 18) * 3); g.lineTo(520, 520); g.fill();
    g.strokeStyle = 'rgba(220,245,255,.6)'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= 520; x += 8) g.lineTo(x, 436 + Math.sin(x / 18) * 3); g.stroke();
    // let rakety
    g.setLineDash([6, 7]); g.strokeStyle = 'rgba(255,240,200,.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(150, 250); g.quadraticCurveTo(250, 90, 330, 160); g.stroke(); g.setLineDash([]);
    for (const [x, y, r] of [[170, 222, 7], [196, 190, 9], [226, 164, 10]]) { g.fillStyle = 'rgba(230,230,240,.4)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.save(); g.scale(2.4, 2.4); CvArt.rocket(g, 340 / 2.4, 172 / 2.4, 0.9); g.restore();
    // výbuch u růžového
    const bx = 400, by = ground(400) - 40, bg = g.createRadialGradient(bx, by, 0, bx, by, 56);
    bg.addColorStop(0, 'rgba(255,255,230,.95)'); bg.addColorStop(0.4, 'rgba(255,210,90,.9)'); bg.addColorStop(0.75, 'rgba(255,110,40,.7)'); bg.addColorStop(1, 'rgba(200,40,30,0)');
    g.fillStyle = bg; g.beginPath(); g.arc(bx, by, 56, 0, TAU); g.fill();
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; g.fillStyle = i % 2 ? '#ffd34d' : '#7a4a2a'; g.fillRect(bx + Math.cos(a) * 62, by + Math.sin(a) * 50, 6, 6); }
    // červi
    g.save(); g.translate(120, ground(120) + 2); g.scale(3.6, 3.6); CvArt.worm(g, { col: '#55f6ff', face: 1, t: 0.6, aim: 38, look: 38, weapon: 'bazooka' }); g.restore();
    g.save(); g.translate(430, ground(430) - 34); g.rotate(0.5); g.scale(3.1, 3.1); CvArt.worm(g, { col: '#ff6fb5', face: -1, t: 1.2, look: 70, hurt: false }); g.restore();
    g.font = '900 30px Unbounded, sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = 'rgba(20,8,30,.8)'; g.strokeText('−48', 440, 190); g.fillStyle = '#ff6fb5'; g.fillText('−48', 440, 190);
  }
  return { DIFFS, WEAPONS, generate, create, art, island, spawns, carve, solidAt, windFor, levelSpec, MW, MH, WATER };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'cervici', title: 'ČERVÍCI', wording: 'win',
  tagline: Kit.L('Tahová válka dvou týmů červů na zničitelném ostrově: bazuka, granát, brokovnice, dynamit a nálet. Proti počítači, ve dvou i online.', 'A turn-based war of two worm teams on a destructible island: bazooka, grenade, shotgun, dynamite and an air strike. Against the computer, two players or online.'),
  diffs: Cervici.DIFFS, generate: Cervici.generate, create: Cervici.create, art: Cervici.art,
  online: { kind: 'turn' },
  dailyDiff: () => 'ai2',
  levelDiff: n => ['ai1', 'ai2', 'ai3'][Cervici.levelSpec(n).ai - 1],
  rules: Kit.L(`<p>Dva týmy po třech červech. Tým, který jako první přijde o všechny červy, prohrál.</p>
    <ul><li><b>Tah:</b> červ na tahu má 45 sekund. Může chodit (◀ ▶, šipky) a skákat (⤒, Enter), zamířit (▲ ▼, šipky nahoru a dolů, nebo táhni po ploše) a vystřelit. Po výstřelu má 4 sekundy na ústup.</li>
    <li><b>Síla:</b> u bazuky a granátu drž PAL (nebo mezerník) a pusť ve správnou chvíli; krátké klepnutí vystřelí silou nastavenou tahem po ploše.</li>
    <li><b>Zbraně</b> (1–5): bazuka (stáčí ji vítr), granát (odráží se, rozbuška 1–5 s, klávesa F), brokovnice (dva výstřely přímo), dynamit (polož a uteč) a nálet (klepni, kam má dopadnout).</li>
    <li>Výbuchy hloubí terén a odhazují červy; pád z výšky bolí a voda je smrtelná.</li>
    <li><b>Online:</b> založ hru a pošli kód kamarádovi. Hraje vždy jen ten, kdo je na tahu; druhý uvidí celý tah přehraný.</li></ul>`,
    `<p>Two teams of three worms. The team that loses all its worms first loses.</p>
    <ul><li><b>A turn:</b> the worm to play has 45 seconds. It can walk (◀ ▶, arrows) and jump (⤒, Enter), aim (▲ ▼, up and down arrows, or drag on the map) and fire. After firing it has 4 seconds to retreat.</li>
    <li><b>Power:</b> for the bazooka and grenade hold FIRE (or Space) and release at the right moment; a short tap fires with the power set by dragging.</li>
    <li><b>Weapons</b> (1–5): bazooka (bent by the wind), grenade (bounces, 1–5 s fuse, key F), shotgun (two straight shots), dynamite (drop it and run) and air strike (tap where it should land).</li>
    <li>Explosions dig into the terrain and throw worms around; falls hurt and the water is deadly.</li>
    <li><b>Online:</b> create a game and send the code to a friend. Only the player on turn plays; the other sees the whole turn replayed.</li></ul>`),
  achievements: [],
});
