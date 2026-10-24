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
    let projs = [], booms = [], parts = [], pops = [], shake = 0, clock = 0, log = null, firedAt = 0, replay = null;
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
        carve(mask, x, y, R);
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
      for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 240; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, t: 0.5 + Math.random() * 0.8, col: i % 3 ? '#7a5a3a' : '#ffb84d', g: true }); }
      api.sound('line');
    }

    // ── Střely ──
    function launch(w, wpn, a, pw, fz, tx) {
      const ang = a * Math.PI / 180, dir = w.face, cx = Math.cos(ang) * dir, cy = -Math.sin(ang);
      const sx = w.x + cx * 14, sy = w.y - 10 + cy * 14;
      if (wpn.kind === 'proj') projs.push({ k: 'rocket', x: sx, y: sy, vx: cx * pw * 640, vy: cy * pw * 640, wind: true, wpn, owner: w, t: 0 });
      else if (wpn.kind === 'bounce') projs.push({ k: 'grenade', x: sx, y: sy, vx: cx * pw * 560, vy: cy * pw * 560, fuse: fz, wpn, owner: w, t: 0 });
      else if (wpn.kind === 'drop') projs.push({ k: 'dyn', x: w.x + dir * 8, y: w.y - 6, vx: dir * 30, vy: -40, fuse: 4, wpn, owner: w, t: 0 });
      else if (wpn.kind === 'air') for (let i = 0; i < 5; i++) projs.push({ k: 'missile', x: tx + (i - 2) * 26, y: -40 - i * 30, vx: 0, vy: 260, wpn, owner: null, t: 0 });
      else if (wpn.kind === 'ray') {
        for (const shot of [0, 1]) setTimeout(() => {
          if (done) return;
          let x = sx, y = sy;
          for (let d = 0; d < 520; d += 2) {
            x = sx + cx * d; y = sy + cy * d;
            if (solidAt(mask, x, y) || worms.some(o => o !== w && !o.dead && Math.abs(o.x - x) < 7 && y > o.y - 16 && y < o.y + 1)) break;
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
        const hitWorm = worms.some(o => !o.dead && (o !== p.owner || p.t > 0.15) && Math.abs(o.x - p.x) < 7 && p.y > o.y - 16 && p.y < o.y + 1);
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
      for (const [x, y, r] of m.ex) carve(mask, x, y, r);
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
        } else { x = nx; y = ny; if (solidAt(mask, x, y)) return [x, y]; if (t > 0.15 && worms.some(o => !o.dead && Math.abs(o.x - x) < 7 && y > o.y - 16 && y < o.y + 1)) return [x, y]; }
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
      <div class="cv-top"><div class="cv-t cv-t0"><b></b><i><s></s></i></div><div class="cv-mid"><span class="cv-wind"></span><b class="cv-timer"></b></div><div class="cv-t cv-t1"><b></b><i><s></s></i></div></div>
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
      { sky: ['#0d1440', '#3a2a7a', '#f08a6a'], hill: '#2a2058', dirt: [[120, 84, 56], [64, 40, 30]], grass: '#7ad97a', water: ['#1a5a8a', '#0a2a4a'] },
      { sky: ['#06081a', '#14204a', '#2a4a8a'], hill: '#121a3a', dirt: [[92, 80, 110], [40, 32, 56]], grass: '#5ac8a0', water: ['#14406a', '#081a34'] },
      { sky: ['#2a5aa0', '#7aa8d8', '#ffd2b0'], hill: '#4a6aa0', dirt: [[140, 98, 62], [76, 50, 34]], grass: '#8ae06a', water: ['#2a7ab0', '#104a7a'] },
    ];
    const TH = THEMES[I.theme];
    // terén se vykreslí jednou do bitmapy (textura hlíny, tráva na povrchu); výbuchy jen vyřežou díru
    function buildTerrain() {
      terrainCv = document.createElement('canvas'); terrainCv.width = MW; terrainCv.height = MH; terrainG = terrainCv.getContext('2d');
      const img = terrainG.createImageData(MW, MH), d = img.data, [c0, c1] = TH.dirt, gr = TH.grass;
      const gR = parseInt(gr.slice(1, 3), 16), gG = parseInt(gr.slice(3, 5), 16), gB = parseInt(gr.slice(5, 7), 16);
      for (let x = 0; x < MW; x++) {
        let air = 99;
        for (let y = 0; y < MH; y++) {
          const i = y * MW + x;
          if (!mask[i]) { air = 0; continue; }
          air++;
          const k = Math.min(1, y / MH * 1.4), n = ((x * 73856093) ^ (y * 19349663)) & 15;
          let r = c0[0] + (c1[0] - c0[0]) * k + n - 8, g = c0[1] + (c1[1] - c0[1]) * k + n - 8, b = c0[2] + (c1[2] - c0[2]) * k + n - 8;
          if (((x >> 3) + (y >> 2)) % 7 === 0) { r -= 10; g -= 10; b -= 10; }
          if (air <= 6) { r = gR - air * 6; g = gG - air * 6; b = gB - air * 6; }
          d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
        }
      }
      terrainG.putImageData(img, 0, 0);
    }
    function drawHole(x, y, R) {
      if (!terrainG) return;
      terrainG.save(); terrainG.globalCompositeOperation = 'destination-out'; terrainG.beginPath(); terrainG.arc(x, y, R, 0, 7); terrainG.fill();
      terrainG.globalCompositeOperation = 'source-atop'; terrainG.strokeStyle = 'rgba(30,18,12,.55)'; terrainG.lineWidth = 5; terrainG.beginPath(); terrainG.arc(x, y, R + 2, 0, 7); terrainG.stroke(); terrainG.restore();
    }
    function redrawTerrain() { buildTerrain(); }
    function background() {
      if (bgCv) return bgCv;
      bgCv = document.createElement('canvas'); bgCv.width = cv.width; bgCv.height = cv.height;
      const g = bgCv.getContext('2d'), sky = g.createLinearGradient(0, 0, 0, bgCv.height);
      sky.addColorStop(0, TH.sky[0]); sky.addColorStop(0.6, TH.sky[1]); sky.addColorStop(1, TH.sky[2]);
      g.fillStyle = sky; g.fillRect(0, 0, bgCv.width, bgCv.height);
      const r = rngOf(P.seed ^ 0xc10d);
      if (I.theme === 1) for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; g.fillRect(r() * bgCv.width, r() * bgCv.height * 0.6, 1.5 * dpr, 1.5 * dpr); }
      g.fillStyle = TH.hill; g.globalAlpha = 0.7; g.beginPath(); g.moveTo(0, bgCv.height);
      for (let x = 0; x <= bgCv.width; x += 10) g.lineTo(x, bgCv.height * (0.62 + 0.08 * Math.sin(x / bgCv.width * 9 + r() * 0.2)));
      g.lineTo(bgCv.width, bgCv.height); g.fill(); g.globalAlpha = 1;
      return bgCv;
    }
    function drawWorm(w) {
      if (w.dead && !(w.dying > 0)) {
        if (w.drown) return;
        // hrob
        ctx.fillStyle = '#9aa0b8'; ctx.strokeStyle = '#2a2f45'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(w.x - 6, w.y - 16, 12, 16, [6, 6, 0, 0]); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a2f45'; ctx.fillRect(w.x - 1, w.y - 13, 2, 8); ctx.fillRect(w.x - 3.5, w.y - 11, 7, 2);
        return;
      }
      const col = TEAM[w.team].col, active = w === cur && !done, bob = active && phase === 'move' ? Math.sin(clock * 6) * 0.8 : 0;
      ctx.save(); ctx.translate(w.x, w.y);
      if (w.dying > 0) ctx.globalAlpha = 0.5 + 0.5 * Math.sin(clock * 20);
      // tělo
      ctx.fillStyle = '#ff9db8'; ctx.strokeStyle = '#7a2a48'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(-w.face * 3, -3, 7, 3.6, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w.face * 1, -9 + bob, 5, 8, w.face * 0.15, 0, 7); ctx.fill(); ctx.stroke();
      // čelenka týmu
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(w.face * 1, -13 + bob, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      // oči míří tam, kam míří zbraň
      const la = active && isHuman(team) ? aim * Math.PI / 180 : 0, ex = Math.cos(la) * w.face * 1.2, ey = -Math.sin(la) * 1.2;
      for (const s of [-1.6, 1.8]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w.face * 2 + s, -12 + bob, 2.1, 0, 7); ctx.fill(); ctx.fillStyle = '#10142a'; ctx.beginPath(); ctx.arc(w.face * 2 + s + ex, -12 + bob + ey, 1, 0, 7); ctx.fill(); }
      // zbraň v ruce
      if (active && (phase === 'move') && W().kind !== 'air') {
        ctx.save(); ctx.translate(w.face * 3, -8); ctx.rotate(w.face > 0 ? -aim * Math.PI / 180 : Math.PI + aim * Math.PI / 180);
        ctx.fillStyle = W().id === 'bazooka' ? '#5a6a4a' : W().id === 'shotgun' ? '#4a3a2a' : '#3a4a3a'; ctx.fillRect(0, -2, W().id === 'shotgun' ? 13 : 12, 4); ctx.restore();
      }
      ctx.restore();
      // jméno a zdraví
      ctx.font = '700 11px Space Grotesk, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.65)';
      const shownHp = Math.round(w.shown);
      ctx.strokeText(w.name, w.x, w.y - 34); ctx.fillStyle = col; ctx.fillText(w.name, w.x, w.y - 34);
      ctx.strokeText(shownHp, w.x, w.y - 22); ctx.fillStyle = '#fff'; ctx.fillText(shownHp, w.x, w.y - 22);
      if (active && phase === 'move') { ctx.fillStyle = col; const by = w.y - 52 + Math.sin(clock * 5) * 3; ctx.beginPath(); ctx.moveTo(w.x - 5, by); ctx.lineTo(w.x + 5, by); ctx.lineTo(w.x, by + 7); ctx.fill(); }
    }
    function drawProj(p) {
      ctx.save(); ctx.translate(p.x, p.y);
      if (p.k === 'rocket' || p.k === 'missile') {
        ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.fillStyle = '#c8cde0'; ctx.fillRect(-6, -2, 10, 4); ctx.fillStyle = '#ff5a7a'; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(8, 0); ctx.lineTo(4, 2); ctx.fill();
        ctx.fillStyle = `rgba(255,${150 + Math.random() * 80},60,.9)`; ctx.beginPath(); ctx.arc(-8, 0, 2 + Math.random() * 2, 0, 7); ctx.fill();
        if (Math.random() < 0.6) parts.push({ x: p.x - Math.cos(Math.atan2(p.vy, p.vx)) * 8, y: p.y - Math.sin(Math.atan2(p.vy, p.vx)) * 8, vx: 0, vy: -10, t: 0.5, col: 'rgba(200,200,220,.5)', smoke: true });
      } else if (p.k === 'grenade') {
        ctx.fillStyle = '#4a7a3a'; ctx.strokeStyle = '#1a2a12'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#9aa0b8'; ctx.fillRect(-1.5, -7, 3, 3);
        ctx.restore(); ctx.font = '700 11px Space Grotesk, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(Math.max(1, Math.ceil(p.fuse)), p.x, p.y - 10); return;
      } else if (p.k === 'dyn') {
        ctx.fillStyle = '#d83a3a'; ctx.fillRect(-3, -9, 6, 12); ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(0, -11, 2 + Math.random() * 2, 0, 7); ctx.fill();
        ctx.restore(); ctx.font = '700 11px Space Grotesk, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(Math.max(1, Math.ceil(p.fuse)), p.x, p.y - 16); return;
      }
      ctx.restore();
    }
    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(background(), 0, 0);
      zoom = closeUp ? Math.max(fitZoom, 0.62) : fitZoom;
      const viewW = cssW / zoom, viewH = cssH / zoom;
      // kamera sleduje střelu nebo červa na tahu
      let fx = camX, fy = camY;
      const p = projs[0], focus = p ? p : replay && replay.focus ? replay.focus : cur;
      if (focus) { fx = focus.x; fy = focus.y - 40; }
      camX += (fx - camX) * 0.08; camY += (fy - camY) * 0.08;
      camX = viewW >= MW ? MW / 2 : Math.max(viewW / 2, Math.min(MW - viewW / 2, camX));
      camY = viewH >= MH ? MH / 2 : Math.max(viewH / 2, Math.min(MH - viewH / 2, camY));
      const sx = (shake > 0 ? (Math.random() - 0.5) * shake * 26 : 0), sy = (shake > 0 ? (Math.random() - 0.5) * shake * 26 : 0);
      ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, (cssW / 2 - camX * zoom + sx) * dpr, (cssH / 2 - camY * zoom + sy) * dpr);
      ctx.drawImage(terrainCv, 0, 0);
      worms.forEach(drawWorm);
      projs.forEach(drawProj);
      // zaměřovač a síla
      if (cur && phase === 'move' && isHuman(team) && !done) {
        if (W().kind === 'air') {
          ctx.strokeStyle = '#ff5a7a'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(airX, 0); ctx.lineTo(airX, MH); ctx.stroke(); ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(airX, 60, 10, 0, 7); ctx.stroke();
        } else if (W().kind !== 'drop') {
          const a = aim * Math.PI / 180, cx = cur.x + Math.cos(a) * cur.face * 46, cy = cur.y - 10 - Math.sin(a) * 46;
          ctx.strokeStyle = '#ff5a7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy + 9); ctx.stroke();
          if (W().charge) {
            const pw = charging ? Math.min(1, chargeT / 1.6) : power;
            for (let i = 0; i < 12; i++) { if (i / 12 > pw) break; const d = 12 + i * 3; ctx.fillStyle = `hsl(${60 - i * 5},100%,60%)`; ctx.beginPath(); ctx.arc(cur.x + Math.cos(a) * cur.face * d, cur.y - 10 - Math.sin(a) * d, 1.5 + i * 0.25, 0, 7); ctx.fill(); }
          }
        }
      }
      for (const b of booms) {
        const k = Math.min(1, b.t / 0.25), fade = Math.max(0, 1 - (b.t - 0.15) / 0.6); if (fade <= 0) continue;
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * (0.5 + k));
        g.addColorStop(0, `rgba(255,255,220,${fade})`); g.addColorStop(0.45, `rgba(255,160,60,${fade * 0.9})`); g.addColorStop(1, 'rgba(255,60,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.5 + k), 0, 7); ctx.fill();
      }
      for (const q of parts) {
        if (q.ray) { ctx.strokeStyle = `rgba(255,240,180,${q.t * 6})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x2, q.y2); ctx.stroke(); continue; }
        ctx.globalAlpha = Math.min(1, q.t * 2); ctx.fillStyle = q.col; const z = q.smoke ? 4 + (0.5 - q.t) * 10 : 3; ctx.fillRect(q.x - z / 2, q.y - z / 2, z, z);
      }
      ctx.globalAlpha = 1;
      // voda
      const wg = ctx.createLinearGradient(0, WATER, 0, MH); wg.addColorStop(0, TH.water[0]); wg.addColorStop(1, TH.water[1]);
      ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(-400, MH + 400);
      for (let x = -400; x <= MW + 400; x += 16) ctx.lineTo(x, WATER + Math.sin(x * 0.03 + clock * 2) * 3);
      ctx.lineTo(MW + 400, MH + 400); ctx.fill();
      ctx.font = '800 16px Unbounded, sans-serif'; ctx.textAlign = 'center';
      for (const q of pops) { ctx.globalAlpha = Math.min(1, q.t); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; const y = q.y - (1.5 - q.t) * 24; ctx.strokeText(q.text, q.x, y); ctx.fillStyle = q.col; ctx.fillText(q.text, q.x, y); }
      ctx.globalAlpha = 1;
    }
    // ── Panel ──
    function syncUI() {
      const mine = !!cur && isHuman(team) && phase === 'move' && !done;
      el.querySelectorAll('.cv-ctrl button').forEach(b => (b.disabled = !mine));
      el.querySelector('[data-c="skip"]').disabled = !(isHuman(team) && (phase === 'move' || phase === 'fired') && !done);
      el.querySelector('.cv-weap').innerHTML = WEAPONS.map((w, i) => { const n = ammo[team][i]; return `<button data-w="${i}" class="${i === weapon ? 'on' : ''}" ${n > 0 && mine ? '' : 'disabled'}>${w.name}<small>${n === Infinity ? '∞' : n}</small></button>`; }).join('');
      el.querySelector('.cv-fuse').hidden = W().kind !== 'bounce';
      el.querySelectorAll('.cv-fuse [data-f]').forEach(b => b.classList.toggle('on', +b.dataset.f === fuse));
      for (let t = 0; t < 2; t++) {
        const box = el.querySelector(`.cv-t${t}`), hp = worms.filter(w => w.team === t).reduce((s, w) => s + (w.dead ? 0 : w.hp), 0);
        box.classList.toggle('on', t === team && !done); box.querySelector('b').textContent = `${teamName(t)} · ${hp}`; box.querySelector('s').style.width = hp / (PER_TEAM * 100) * 100 + '%';
      }
      el.querySelector('.cv-wind').textContent = wind === 0 ? L('bezvětří', 'calm') : `${L('vítr', 'wind')} ${wind > 0 ? '→' : '←'}${Math.abs(wind)}`;
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
          while (R.exIdx < m.ex.length && m.ex[R.exIdx][3] <= tt) { const [x, y, r] = m.ex[R.exIdx++]; carve(mask, x, y, r); drawHole(x, y, r); booms.push({ x, y, r, t: 0 }); shake = Math.max(shake, r / 110); api.sound('line'); }
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
      for (const [x, y, r] of m.ex) carve(mask, x, y, r);
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

  function art(el) {
    el.innerHTML = `<svg viewBox="0 0 260 260"><defs><linearGradient id="cvSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1440"/><stop offset=".6" stop-color="#3a2a7a"/><stop offset="1" stop-color="#f08a6a"/></linearGradient></defs>
      <rect x="10" y="20" width="240" height="210" rx="18" fill="url(#cvSky)"/>
      <path d="M30 230 C40 150 90 130 120 150 C150 170 170 120 210 130 C240 140 240 200 236 230Z" fill="#78543a"/><path d="M30 230 C40 150 90 130 120 150 C150 170 170 120 210 130 C240 140 240 200 236 230" fill="none" stroke="#7ad97a" stroke-width="6"/>
      <circle cx="150" cy="190" r="16" fill="#3a2a7a"/>
      <rect x="10" y="210" width="240" height="20" fill="#1a5a8a"/>
      <g transform="translate(80 146)"><ellipse cx="-4" cy="-3" rx="9" ry="4.5" fill="#ff9db8" stroke="#7a2a48" stroke-width="1.5"/><ellipse cx="2" cy="-12" rx="6.5" ry="10" fill="#ff9db8" stroke="#7a2a48" stroke-width="1.5"/><path d="M-4 -17 A6 6 0 0 1 8 -17" stroke="#55f6ff" stroke-width="3" fill="none"/><circle cx="1" cy="-15" r="2.6" fill="#fff"/><circle cx="6" cy="-15" r="2.6" fill="#fff"/><circle cx="2" cy="-16" r="1.2"/><circle cx="7" cy="-16" r="1.2"/><rect x="4" y="-13" width="16" height="5" fill="#5a6a4a" transform="rotate(-25 4 -11)"/></g>
      <g transform="translate(200 126) scale(-1 1)"><ellipse cx="-4" cy="-3" rx="9" ry="4.5" fill="#ff9db8" stroke="#7a2a48" stroke-width="1.5"/><ellipse cx="2" cy="-12" rx="6.5" ry="10" fill="#ff9db8" stroke="#7a2a48" stroke-width="1.5"/><path d="M-4 -17 A6 6 0 0 1 8 -17" stroke="#ff6fb5" stroke-width="3" fill="none"/><circle cx="1" cy="-15" r="2.6" fill="#fff"/><circle cx="6" cy="-15" r="2.6" fill="#fff"/><circle cx="2" cy="-16" r="1.2"/><circle cx="7" cy="-16" r="1.2"/></g>
      <path d="M98 128 Q140 50 196 108" fill="none" stroke="#ffe6a0" stroke-width="2.5" stroke-dasharray="4 5"/></svg>`;
  }
  return { DIFFS, WEAPONS, generate, create, art, island, spawns, carve, solidAt, windFor, levelSpec, MW, MH, WATER };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'cervici', title: 'ČERVÍCI',
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
