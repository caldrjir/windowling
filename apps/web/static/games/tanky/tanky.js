'use strict';
// ── TANKY · Windowling Hlavolamy ────────────────────────────────────────────
// Dělostřelecký souboj dvou tanků na tahy (na motivy klasických „Tanks“): nastav úhel a sílu,
// počítej s větrem, popojeď a pal. Výbuchy hloubí terén, tank může sjet do kráteru.
// Proti počítači (3 síly), ve dvou na jednom zařízení a online (tahové místnosti DuelRoom).
// Online pošle střelec i místo dopadu, takže terén je u obou hráčů vždy stejný, i kdyby se
// dráha střely v jiném prohlížeči spočítala o chlup jinak.
const Tanky = (() => {
  const L = Kit.L;
  const FW = 960, FH = 540, G = 300, VK = 6.4, FUEL = 70, BARREL = 20;
  const DIFFS = [
    { id: 'ai1', name: L('Kadet', 'Cadet'), note: L('soupeř se teprve učí mířit', 'still learning to aim'), par: 600 },
    { id: 'ai2', name: L('Dělostřelec', 'Gunner'), note: L('solidní soupeř', 'a solid opponent'), par: 600 },
    { id: 'ai3', name: L('Generál', 'General'), note: L('skoro nemine', 'rarely misses'), par: 600 },
    { id: 'duo', name: L('Dva hráči', 'Two players'), note: L('na jednom zařízení', 'on one device'), par: 900 },
  ];
  const WEAPONS = [
    { id: 'shell', name: L('Střela', 'Shell'), r: 26, dmg: 34, ammo: Infinity, kind: 'boom', n: 1 },
    { id: 'big', name: L('Těžká střela', 'Heavy shell'), r: 44, dmg: 52, ammo: 3, kind: 'boom', n: 1 },
    { id: 'tri', name: L('Trojitá', 'Triple'), r: 22, dmg: 22, ammo: 2, kind: 'boom', n: 3 },
    { id: 'dig', name: L('Kopáč', 'Digger'), r: 58, dmg: 8, ammo: 2, kind: 'dig', n: 1 },
    { id: 'dirt', name: L('Hlína', 'Dirt'), r: 46, dmg: 0, ammo: 2, kind: 'dirt', n: 1 },
  ];
  const COLORS = ['#55f6ff', '#ff6fb5'];
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ── Terén ze semínka: kopce ze součtu vln, rovné plošinky pro tanky ──
  function terrain(seed) {
    const r = rngOf(seed), h = new Int16Array(FW);
    const waves = [0, 1, 2, 3].map(i => ({ f: (0.004 + r() * 0.006) * (i + 1) * 0.7, p: r() * 6.28, a: (70 - i * 15) * (0.5 + r()) }));
    const base = FH * (0.58 + r() * 0.08);
    for (let x = 0; x < FW; x++) {
      let y = base; for (const w of waves) y += Math.sin(x * w.f + w.p) * w.a;
      h[x] = Math.round(Math.max(FH * 0.28, Math.min(FH * 0.9, y)));
    }
    const spots = [Math.round(FW * (0.1 + r() * 0.08)), Math.round(FW * (0.82 + r() * 0.08))];
    for (const sx of spots) { const y = h[sx]; for (let x = sx - 18; x <= sx + 18; x++) h[x] = y; }
    // hladké přechody k plošinkám
    for (let pass = 0; pass < 2; pass++) for (let x = 1; x < FW - 1; x++) if (!spots.some(s => Math.abs(x - s) <= 18)) h[x] = Math.round((h[x - 1] + h[x] * 2 + h[x + 1]) / 4);
    const theme = Math.floor(r() * 3);
    return { h, spots, theme };
  }
  const windFor = (seed, turn, max) => Math.round((rngOf((seed ^ Math.imul(turn + 1, 2654435761)) >>> 0)() - 0.5) * 2 * max);

  function levelSpec(n) {
    const ai = n <= 30 ? 1 : n <= 75 ? 2 : 3;
    return { ai, wind: Math.min(10, 2 + Math.floor(n / 12)), text: L(`Bitva ${n}`, `Battle ${n}`) };
  }
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'online') return { seed, type: 'online', wind: 8 };
    if (ctx.kind === 'daily') return { seed, type: 'ai', ai: 2, wind: 8, text: L('Denní bitva', 'Daily battle') };
    if (ctx.kind === 'level') return Object.assign({ seed, type: 'ai' }, levelSpec(ctx.key));
    if (diffId === 'duo') return { seed, type: 'duo', wind: 8 };
    return { seed, type: 'ai', ai: { ai1: 1, ai2: 2, ai3: 3 }[diffId] || 1, wind: diffId === 'ai1' ? 4 : 8 };
  }

  // ── Fyzika střely (pevný krok, stejná na obou stranách online) ──
  function fly(st, from, angle, power, wind, shooter) {
    const a = angle * Math.PI / 180, v = power * VK;
    let x = from.x + Math.cos(a) * BARREL, y = from.y - Math.sin(a) * BARREL, vx = Math.cos(a) * v, vy = -Math.sin(a) * v;
    const path = [[x, y]], dt = 1 / 120, ax = wind * 7;
    for (let i = 0; i < 120 * 14; i++) {
      vx += ax * dt; vy += G * dt; x += vx * dt; y += vy * dt;
      if (i % 3 === 0) path.push([x, y]);
      if (x < -300 || x > FW + 300 || y > FH + 40) return { path, hit: null };
      for (let k = 0; k < 2; k++) { const t = st.tanks[k]; if ((k !== shooter || i > 30) && t.hp > 0 && Math.abs(x - t.x) < 14 && y > t.y - 20 && y < t.y + 2) { path.push([x, y]); return { path, hit: [Math.round(x), Math.round(y)] }; } }
      if (x >= 0 && x < FW && y >= st.h[Math.floor(x)]) { path.push([x, y]); return { path, hit: [Math.round(x), Math.round(st.h[Math.floor(x)])] }; }
    }
    return { path, hit: null };
  }
  // Výbuch: hloubí (nebo přisype) terén a zraňuje; celočíselně, ať je výsledek všude stejný.
  function blast(st, [cx, cy], w) {
    const R = w.r, dmg = [0, 0];
    for (let x = Math.max(0, cx - R); x <= Math.min(FW - 1, cx + R); x++) {
      const dy = Math.round(Math.sqrt(R * R - (x - cx) * (x - cx))), top = cy - dy, bot = cy + dy;
      if (w.kind === 'dirt') { if (bot >= st.h[x]) st.h[x] = Math.min(st.h[x], top); else st.h[x] -= 2 * dy; }
      else if (st.h[x] < bot) st.h[x] = st.h[x] >= top ? bot : st.h[x] + 2 * dy;
      st.h[x] = Math.max(24, Math.min(FH - 6, st.h[x]));
    }
    if (w.dmg) for (let k = 0; k < 2; k++) {
      const t = st.tanks[k]; if (t.hp <= 0) continue;
      const d = Math.sqrt((t.x - cx) ** 2 + (t.y - 8 - cy) ** 2), reach = R + 12;
      if (d < reach) dmg[k] = Math.round(w.dmg * (d < 12 ? 1.2 : 1 - d / reach));
    }
    return dmg;
  }
  function settle(st) {
    const fallDmg = [0, 0];
    for (let k = 0; k < 2; k++) {
      const t = st.tanks[k], ny = st.h[t.x];
      if (ny > t.y) { const fall = ny - t.y; if (fall > 24) fallDmg[k] = Math.floor((fall - 24) / 5); t.fallFrom = t.y; t.y = ny; }
      else t.y = ny;
    }
    return fallDmg;
  }

  // ── Počítač: zkusí spoustu dráh (vítr zná) a vybere nejbližší dopad, pak přidá chybu podle síly ──
  function aiShot(st, k, level, wind) {
    const me = st.tanks[k], foe = st.tanks[1 - k], dir = foe.x > me.x ? 1 : -1;
    let best = null;
    for (let ang = 8; ang <= 85; ang += 2) for (let pw = 24; pw <= 100; pw += 3) {
      const a = dir > 0 ? ang : 180 - ang;
      const r = fly(st, { x: me.x, y: me.y - 14 }, a, pw, wind, k);
      if (!r.hit) continue;
      const d = Math.hypot(r.hit[0] - foe.x, r.hit[1] - (foe.y - 8));
      if (!best || d < best.d) best = { a, pw, d };
    }
    if (!best) best = { a: dir > 0 ? 45 : 135, pw: 70, d: 999 };
    const err = [0, 7, 3.2, 1.1][level], r = Math.random;
    const ammo = st.ammo[k];
    let weapon = 0;
    if (level >= 2 && ammo[1] > 0 && r() < 0.35) weapon = 1;
    else if (ammo[2] > 0 && r() < 0.2) weapon = 2;
    return { a: Math.round(Math.max(0, Math.min(180, best.a + (r() - 0.5) * 2 * err * 1.6))), pw: Math.round(Math.max(10, Math.min(100, best.pw + (r() - 0.5) * 2 * err))), weapon };
  }

  function create(el, P, saved, api, opts = {}) {
    const net = P.type === 'online' ? opts.net : null, online = !!net;
    const T = terrain(P.seed);
    const st = {
      h: T.h,
      tanks: T.spots.map((x, k) => ({ x, y: T.h[x], ang: k ? 135 : 45, pw: 60, hp: 100, fallFrom: null })),
      ammo: [WEAPONS.map(w => w.ammo), WEAPONS.map(w => w.ammo)],
    };
    // kdo je kdo: online je levý tank ten, kdo hraje první (net.side 1)
    const me = online ? (net.side > 0 ? 0 : 1) : 0;
    const names = online ? (me === 0 ? [net.me, net.opp] : [net.opp, net.me]) : P.type === 'duo' ? [L('Hráč 1', 'Player 1'), L('Hráč 2', 'Player 2')] : [L('Ty', 'You'), L(`Počítač ${P.ai}`, `Computer ${P.ai}`)];
    let turn = 0, active = 0, wind = 0, weapon = 0, fuel = FUEL, moves = [], phase = 'aim', done = false;
    const pending = []; // tahy soupeře, které dorazily během animace
    let shot = null, booms = [], parts = [], shake = 0, clock = 0, terrainDirty = true, aiT = 0, aiPlan = null, banner = null;
    const isHuman = k => (online ? k === me : P.type === 'duo' ? true : k === 0);
    const W = () => WEAPONS[weapon];

    function startTurn() {
      wind = windFor(P.seed, turn, P.wind ?? 8);
      active = turn % 2; fuel = FUEL; phase = 'aim';
      const ammo = st.ammo[active]; if (!(ammo[weapon] > 0)) weapon = 0;
      banner = { t: 1.3, text: isHuman(active) ? (P.type === 'duo' ? L(`Na tahu: ${names[active]}`, `${names[active]}'s turn`) : L('Jsi na tahu', 'Your turn')) : L(`Hraje ${names[active]}`, `${names[active]} plays`) };
      if (!isHuman(active) && !online) { aiPlan = aiShot(st, active, P.ai, wind); aiT = 1.1; }
      syncUI();
      if (online && !isHuman(active) && pending.length) setTimeout(() => fire(dec(pending.shift())), 400);
    }

    // Tah: "x:úhel,síla,zbraň:dopady" (dopad "x,y", více dopadů odděleno ";", "-" mimo plochu)
    const enc = (x, a, pw, wi, hits) => `${x}:${a},${pw},${wi}:${hits.map(p => (p ? `${p[0]},${p[1]}` : '-')).join(';')}`;
    const dec = s => { const [x, apw, hs] = s.split(':'); const [a, pw, wi] = apw.split(',').map(Number); return { x: +x, a, pw, wi, hits: hs.split(';').map(p => (p === '-' ? null : p.split(',').map(Number))) }; };

    function fire(fromNet) {
      if (phase !== 'aim' || done) return;
      const t = st.tanks[active], w = WEAPONS[fromNet ? fromNet.wi : weapon];
      const a = fromNet ? fromNet.a : t.ang, pw = fromNet ? fromNet.pw : t.pw;
      if (fromNet) { t.x = Math.max(0, Math.min(FW - 1, fromNet.x)); t.y = st.h[t.x]; t.ang = a; t.pw = pw; }
      const spread = w.n === 3 ? [-5, 0, 5] : [0];
      const flights = spread.map(da => fly(st, { x: t.x, y: t.y - 14 }, a + da, pw, wind, active));
      const hits = fromNet ? fromNet.hits : flights.map(f => f.hit);
      const wi = WEAPONS.indexOf(w);
      if (st.ammo[active][wi] !== Infinity) st.ammo[active][wi]--;
      const mv = enc(t.x, a, pw, wi, hits);
      moves.push(mv);
      if (online && !fromNet) net.send(mv);
      phase = 'fly'; shot = { flights, hits, w, t: 0, k: active }; api.sound('place'); shake = Math.max(shake, 0.08);
      syncUI(); api.changed();
    }
    // bez animace (obnovení rozehrané hry)
    function applyQuiet(mv) {
      const m = dec(mv), t = st.tanks[active], w = WEAPONS[m.wi];
      t.x = m.x; t.y = st.h[t.x]; t.ang = m.a; t.pw = m.pw;
      if (st.ammo[active][m.wi] !== Infinity) st.ammo[active][m.wi]--;
      for (const p of m.hits) if (p) { const d = blast(st, p, w); st.tanks.forEach((tk, k) => (tk.hp = Math.max(0, tk.hp - d[k]))); }
      settle(st).forEach((d, k) => (st.tanks[k].hp = Math.max(0, st.tanks[k].hp - d)));
      moves.push(mv); turn++;
    }
    function explode() {
      const { hits, w } = shot; let total = [0, 0];
      for (const p of hits) {
        if (!p) continue;
        const d = blast(st, p, w); total = total.map((v, k) => v + d[k]);
        booms.push({ x: p[0], y: p[1], r: w.r, t: 0, kind: w.kind });
        for (let i = 0; i < (w.kind === 'dirt' ? 18 : 26); i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 220; parts.push({ x: p[0], y: p[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, t: 0.6 + Math.random() * 0.7, col: w.kind === 'dirt' ? '#8a6a44' : Math.random() < 0.5 ? '#ffe066' : '#ff8a3d', g: true }); }
      }
      const fall = settle(st);
      st.tanks.forEach((tk, k) => { const dd = total[k] + fall[k]; if (dd > 0) { tk.hp = Math.max(0, tk.hp - dd); tk.hurt = { v: dd, t: 1.4 }; } });
      terrainDirty = true; shake = Math.max(shake, hits.some(Boolean) ? (w.kind === 'dirt' ? 0.15 : 0.35) : 0);
      api.sound(hits.some(Boolean) ? (w.kind === 'dirt' ? 'soft' : 'line') : 'error');
      phase = 'boom'; shot = null; booms.forEach(b => (b.wait = 0.9));
    }
    function afterBoom() {
      const dead = st.tanks.map(t => t.hp <= 0);
      if (dead[0] || dead[1]) { finish(dead[0] && dead[1] ? -1 : dead[0] ? 1 : 0); return; }
      turn++; startTurn(); api.changed();
    }
    function finish(winner) {
      done = true; phase = 'over'; syncUI();
      const hpLeft = winner >= 0 ? st.tanks[winner].hp : 0;
      if (online) { net.end(winner < 0 ? 0 : winner === me ? net.side : -net.side, 'tank'); return; }
      setTimeout(() => {
        if (P.type === 'duo') { api.solved({ title: winner < 0 ? L('Remíza', 'Draw') : L(`Vyhrál ${names[winner]}`, `${names[winner]} wins`), html: `<p class="k-muted">${L(`Výstřely: ${moves.length}`, `Shots: ${moves.length}`)}</p>` }); return; }
        if (winner === 0) api.solved({ title: L('Vítězství!', 'Victory!'), stars: hpLeft >= 70 ? 3 : hpLeft >= 35 ? 2 : 1, html: `<p class="k-muted">${L(`Zbylé zdraví ${hpLeft} · výstřely ${Math.ceil(moves.length / 2)}`, `Health left ${hpLeft} · shots ${Math.ceil(moves.length / 2)}`)}</p>` });
        else api.failed({ title: winner < 0 ? L('Remíza', 'Draw') : L('Tvůj tank padl', 'Your tank is destroyed'), html: `<p class="k-muted">${L(`Soupeři zbylo ${st.tanks[1].hp} zdraví`, `The opponent has ${st.tanks[1].hp} health left`)}</p>` });
      }, 900);
    }
    function drive(dir, px) {
      if (phase !== 'aim' || !isHuman(active) || done) return;
      const t = st.tanks[active];
      for (let i = 0; i < px && fuel > 0; i++) {
        const nx = t.x + dir; if (nx < 6 || nx > FW - 7) break;
        if (st.h[nx] < t.y - 5) break; // příliš strmé
        t.x = nx; t.y = st.h[nx]; fuel--;
        if (Math.abs(st.tanks[1 - active].x - t.x) < 26) { t.x -= dir; t.y = st.h[t.x]; break; }
      }
      syncUI();
    }

    // ── Vykreslení ──
    el.innerHTML = `<div class="tk-wrap">
      <div class="tk-top"><div class="tk-p tk-p0"><b></b><i><s></s></i></div><div class="tk-wind"><small>${L('VÍTR', 'WIND')}</small><b></b></div><div class="tk-p tk-p1"><b></b><i><s></s></i></div></div>
      <div class="tk-stage"><canvas class="tk-board"></canvas><div class="tk-banner" hidden></div></div>
      <div class="tk-ctrl">
        <div class="tk-row"><span>${L('Úhel', 'Angle')}</span><button data-c="a-">−</button><input type="range" class="tk-ang" min="0" max="180" step="1" aria-label="${L('Úhel', 'Angle')}"><button data-c="a+">+</button><b class="tk-angv"></b></div>
        <div class="tk-row"><span>${L('Síla', 'Power')}</span><button data-c="p-">−</button><input type="range" class="tk-pw" min="5" max="100" step="1" aria-label="${L('Síla', 'Power')}"><button data-c="p+">+</button><b class="tk-pwv"></b></div>
        <div class="tk-row tk-row3"><button data-c="m-" aria-label="${L('Jet doleva', 'Drive left')}">◀</button><span class="tk-fuel"></span><button data-c="m+" aria-label="${L('Jet doprava', 'Drive right')}">▶</button><div class="tk-weap"></div></div>
        <button class="tk-fire" data-c="fire">${L('PAL!', 'FIRE!')}</button>
      </div>
      <div class="k-tools"><button class="k-tool" data-c="resign">${api.icon('x')}<span>${L('Vzdát', 'Resign')}</span></button></div></div>`;
    const cv = el.querySelector('.tk-board'), ctx = cv.getContext('2d'), wrapEl = el.querySelector('.tk-wrap');
    const angIn = el.querySelector('.tk-ang'), pwIn = el.querySelector('.tk-pw'), bannerEl = el.querySelector('.tk-banner');
    let sc = 1, dpr = 1, bgCv = null, terCv = null;
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight), phone = box < 740, vw = box - 2; // šířka plochy bez okrajů, ne okna (to umí přerůst)
      const hAvail = innerHeight - (phone ? 360 : 300);
      sc = Math.max(0.3, Math.min(vw / FW, hAvail / FH, 1.1));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(FW * sc * dpr); cv.height = Math.round(FH * sc * dpr); cv.style.width = Math.round(FW * sc) + 'px'; cv.style.height = Math.round(FH * sc) + 'px';
      wrapEl.classList.toggle('phone', phone); bgCv = null; terrainDirty = true;
    }
    const THEMES = [
      { sky: ['#1a1240', '#5a2a6e', '#ff8a5c'], sun: '#ffd27a', far: '#3a2458', near: '#2a1a46', top: '#7ad97a', dirt: ['#5b3a2a', '#2c1c18'] },
      { sky: ['#050818', '#0f1a44', '#2a3a7a'], sun: '#e8f0ff', far: '#16224a', near: '#101838', top: '#5ac8a0', dirt: ['#3e3550', '#1a1528'] },
      { sky: ['#2a3a8a', '#9a6ab8', '#ffb8c8'], sun: '#fff0c0', far: '#5a4a8a', near: '#44386e', top: '#9ae07a', dirt: ['#6a4a34', '#33221c'] },
    ];
    const TH = THEMES[T.theme];
    function layer() { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.setTransform(sc * dpr, 0, 0, sc * dpr, 0, 0); return [c, g]; }
    function background() {
      if (bgCv) return bgCv;
      const [c, g] = layer(); bgCv = c;
      const sky = g.createLinearGradient(0, 0, 0, FH); sky.addColorStop(0, TH.sky[0]); sky.addColorStop(0.55, TH.sky[1]); sky.addColorStop(1, TH.sky[2]);
      g.fillStyle = sky; g.fillRect(0, 0, FW, FH);
      const r = rngOf(P.seed ^ 0x5ca1);
      if (T.theme === 1) for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; g.fillRect(r() * FW, r() * FH * 0.6, 1.5, 1.5); }
      const sx = FW * (0.3 + r() * 0.4), sy = FH * (0.18 + r() * 0.12);
      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, 140); glow.addColorStop(0, TH.sun + 'aa'); glow.addColorStop(1, TH.sun + '00');
      g.fillStyle = glow; g.fillRect(sx - 140, sy - 140, 280, 280);
      g.fillStyle = TH.sun; g.beginPath(); g.arc(sx, sy, 34, 0, 7); g.fill();
      for (const [col, base, amp, f] of [[TH.far, 0.5, 70, 0.006], [TH.near, 0.6, 50, 0.011]]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, FH);
        const ph = r() * 6;
        for (let x = 0; x <= FW; x += 8) g.lineTo(x, FH * base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.7 + ph * 2) * amp * 0.35);
        g.lineTo(FW, FH); g.fill();
      }
      return bgCv;
    }
    function terrainLayer() {
      if (terCv && !terrainDirty) return terCv;
      const [c, g] = layer(); terCv = c; terrainDirty = false;
      const path = () => { g.beginPath(); g.moveTo(0, FH); for (let x = 0; x < FW; x++) g.lineTo(x, st.h[x]); g.lineTo(FW, FH); g.closePath(); };
      const dirt = g.createLinearGradient(0, FH * 0.3, 0, FH); dirt.addColorStop(0, TH.dirt[0]); dirt.addColorStop(1, TH.dirt[1]);
      path(); g.fillStyle = dirt; g.fill();
      // vrstvy horniny
      g.save(); path(); g.clip(); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2;
      for (let k = 1; k < 7; k++) { g.beginPath(); for (let x = 0; x < FW; x += 6) g.lineTo(x, FH * 0.45 + k * 42 + Math.sin(x * 0.02 + k) * 8); g.stroke(); }
      g.restore();
      // tráva na hraně
      g.strokeStyle = TH.top; g.lineWidth = 5; g.lineJoin = 'round'; g.beginPath(); for (let x = 0; x < FW; x++) g.lineTo(x, st.h[x] + 1); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.5; g.beginPath(); for (let x = 0; x < FW; x++) g.lineTo(x, st.h[x] - 1); g.stroke();
      return terCv;
    }
    function drawTank(t, k) {
      const col = COLORS[k], x = t.x, y = t.y, m = Math.max(1, Math.min(1.9, 0.62 / sc)); // na malé ploše větší tanky
      // sklon podle terénu
      const tilt = Math.atan2((st.h[Math.min(FW - 1, x + 10)] - st.h[Math.max(0, x - 10)]), 20) * 0.8;
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(m, m);
      if (t.hp <= 0) ctx.globalAlpha = 0.55;
      // hlaveň
      ctx.save(); ctx.translate(0, -14); ctx.rotate(-t.ang * Math.PI / 180 - tilt);
      ctx.fillStyle = '#2a2f45'; ctx.fillRect(0, -2.6, BARREL, 5.2); ctx.fillStyle = col; ctx.fillRect(BARREL - 4, -3.2, 4, 6.4);
      ctx.restore();
      // věž
      ctx.fillStyle = col; ctx.strokeStyle = '#10142a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, -12, 8, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      // korba
      ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(16, -6); ctx.lineTo(13, -12); ctx.lineTo(-13, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-12, -11, 24, 1.5);
      // pásy
      ctx.fillStyle = '#20253a'; ctx.beginPath(); ctx.roundRect(-18, -7, 36, 8, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#596080'; for (let i = -13; i <= 13; i += 6.5) { ctx.beginPath(); ctx.arc(i, -3, 2.3, 0, 7); ctx.fill(); }
      ctx.restore();
      if (t.hp <= 0) { ctx.fillStyle = 'rgba(60,60,60,.5)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + Math.sin(clock * 2 + i) * 6, y - 26 - i * 12 - (clock * 20 % 12), 6 + i * 2, 0, 7); ctx.fill(); } }
      // jméno a zdraví
      ctx.font = `700 ${13 * m}px Space Grotesk, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3 * m;
      ctx.strokeText(names[k], x, y - 44 * m); ctx.fillText(names[k], x, y - 44 * m);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 22 * m, y - 38 * m, 44 * m, 5 * m); ctx.fillStyle = t.hp > 50 ? '#6dff9e' : t.hp > 25 ? '#ffe066' : '#ff5a7a'; ctx.fillRect(x - 22 * m, y - 38 * m, 44 * m * t.hp / 100, 5 * m);
      if (t.hurt && t.hurt.t > 0) { ctx.globalAlpha = Math.min(1, t.hurt.t); ctx.font = `800 ${18 * m}px Unbounded, sans-serif`; ctx.fillStyle = '#ff5a7a'; const hy = y - (58 + (1.4 - t.hurt.t) * 30) * m; ctx.strokeText(`−${t.hurt.v}`, x, hy); ctx.fillText(`−${t.hurt.v}`, x, hy); ctx.globalAlpha = 1; }
      if (k === active && phase === 'aim' && !done) { ctx.fillStyle = col; ctx.beginPath(); const by = y - (70 + Math.sin(clock * 5) * 3) * m; ctx.moveTo(x - 6 * m, by); ctx.lineTo(x + 6 * m, by); ctx.lineTo(x, by + 8 * m); ctx.fill(); }
    }
    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 30 * dpr, (Math.random() - 0.5) * shake * 30 * dpr);
      ctx.drawImage(background(), 0, 0);
      ctx.drawImage(terrainLayer(), 0, 0);
      ctx.setTransform(sc * dpr, 0, 0, sc * dpr, ctx.getTransform().e, ctx.getTransform().f);
      st.tanks.forEach(drawTank);
      // míření: čára od hlavně, délka podle síly
      if (phase === 'aim' && isHuman(active) && !done) {
        const t = st.tanks[active], a = t.ang * Math.PI / 180, x0 = t.x + Math.cos(a) * BARREL, y0 = t.y - 14 - Math.sin(a) * BARREL, len = 20 + t.pw * 0.9;
        ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * len, y0 - Math.sin(a) * len); ctx.stroke(); ctx.setLineDash([]);
      }
      if (shot) {
        const n = Math.floor(shot.t * 40);
        for (const f of shot.flights) {
          const upto = Math.min(f.path.length - 1, n);
          ctx.strokeStyle = 'rgba(255,230,160,.35)'; ctx.lineWidth = 2; ctx.beginPath();
          for (let i = Math.max(0, upto - 14); i <= upto; i++) ctx.lineTo(f.path[i][0], f.path[i][1]);
          ctx.stroke();
          const p = f.path[upto]; if (p) { ctx.fillStyle = '#fff6c8'; ctx.shadowColor = '#ffb84d'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(p[0], p[1], shot.w.r > 40 ? 5 : 3.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
        }
      }
      for (const b of booms) {
        const k = Math.min(1, b.t / 0.35), fade = Math.max(0, 1 - (b.t - 0.2) / 0.6);
        if (fade <= 0) continue;
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * (0.4 + k * 0.9));
        if (b.kind === 'dirt') { g.addColorStop(0, `rgba(170,130,80,${fade})`); g.addColorStop(1, 'rgba(120,90,60,0)'); }
        else { g.addColorStop(0, `rgba(255,255,220,${fade})`); g.addColorStop(0.4, `rgba(255,170,60,${fade * 0.9})`); g.addColorStop(1, 'rgba(255,60,40,0)'); }
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.4 + k * 0.9), 0, 7); ctx.fill();
      }
      for (const p of parts) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.col; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
      ctx.globalAlpha = 1;
    }
    // ── Ovládání a panel ──
    function syncUI() {
      const t = st.tanks[active], mine = isHuman(active) && phase === 'aim' && !done;
      el.querySelectorAll('.tk-ctrl button, .tk-ctrl input').forEach(b => (b.disabled = !mine));
      angIn.value = t.ang; pwIn.value = t.pw;
      el.querySelector('.tk-angv').textContent = `${t.ang}°`; el.querySelector('.tk-pwv').textContent = t.pw;
      el.querySelector('.tk-fuel').textContent = `${L('Palivo', 'Fuel')} ${Math.round(fuel / FUEL * 100)} %`;
      el.querySelector('.tk-weap').innerHTML = WEAPONS.map((w, i) => { const n = st.ammo[active][i]; return `<button data-w="${i}" class="${i === weapon ? 'on' : ''}" ${n > 0 && mine ? '' : 'disabled'}>${w.name}<small>${n === Infinity ? '∞' : n}</small></button>`; }).join('');
      for (let k = 0; k < 2; k++) {
        const p = el.querySelector(`.tk-p${k}`); p.classList.toggle('on', k === active && !done);
        p.querySelector('b').textContent = names[k]; p.querySelector('s').style.width = st.tanks[k].hp + '%';
      }
      const wb = el.querySelector('.tk-wind b');
      wb.textContent = wind === 0 ? L('bezvětří', 'calm') : `${wind > 0 ? '→' : '←'} ${Math.abs(wind)}`;
      wrapEl.classList.toggle('waiting', !mine);
    }
    const setAng = v => { if (!isHuman(active) || phase !== 'aim') return; st.tanks[active].ang = Math.max(0, Math.min(180, Math.round(v))); syncUI(); };
    const setPw = v => { if (!isHuman(active) || phase !== 'aim') return; st.tanks[active].pw = Math.max(5, Math.min(100, Math.round(v))); syncUI(); };
    angIn.addEventListener('input', () => setAng(+angIn.value));
    pwIn.addEventListener('input', () => setPw(+pwIn.value));
    let rep = 0;
    el.querySelector('.tk-ctrl').addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-c]'); if (!b || b.disabled) return;
      const c = b.dataset.c, act = () => {
        if (c === 'a+') setAng(st.tanks[active].ang + 1); if (c === 'a-') setAng(st.tanks[active].ang - 1);
        if (c === 'p+') setPw(st.tanks[active].pw + 1); if (c === 'p-') setPw(st.tanks[active].pw - 1);
        if (c === 'm+') drive(1, 3); if (c === 'm-') drive(-1, 3);
      };
      if (c === 'fire') { fire(); return; }
      act(); clearInterval(rep); rep = setInterval(act, 70);
    });
    const stopRep = () => clearInterval(rep);
    addEventListener('pointerup', stopRep); addEventListener('pointercancel', stopRep);
    el.querySelector('.tk-weap').addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (!b || b.disabled) return; weapon = +b.dataset.w; api.sound('tap'); syncUI(); });
    el.querySelector('[data-c="resign"]').addEventListener('click', () => {
      if (done) return;
      if (online) { done = true; net.resign(); return; }
      finish(P.type === 'duo' ? 1 - active : 1);
    });
    // míření tahem po bojišti: směr od tanku = úhel, vzdálenost = síla
    let aiming = false;
    const aimAt = e => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / sc, y = (e.clientY - r.top) / sc, t = st.tanks[active];
      const dx = x - t.x, dy = t.y - 14 - y;
      setAng(Math.atan2(Math.max(0, dy), dx) * 180 / Math.PI); setPw(Math.hypot(dx, dy) / 3);
    };
    cv.addEventListener('pointerdown', e => { if (!isHuman(active) || phase !== 'aim' || done) return; aiming = true; cv.setPointerCapture(e.pointerId); aimAt(e); });
    cv.addEventListener('pointermove', e => { if (aiming) aimAt(e); });
    cv.addEventListener('pointerup', () => (aiming = false));

    // ── Smyčka ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
      shake = Math.max(0, shake - dt);
      parts = parts.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += 500 * dt; return (p.t -= dt) > 0; });
      for (const t of st.tanks) if (t.hurt) t.hurt.t -= dt;
      if (banner) { banner.t -= dt; bannerEl.hidden = banner.t <= 0; bannerEl.textContent = banner.text; if (banner.t <= 0) banner = null; }
      if (phase === 'fly' && shot) {
        shot.t += dt * 1.6;
        const longest = Math.max(...shot.flights.map(f => f.path.length));
        if (shot.t * 40 >= longest - 1) explode();
      } else if (phase === 'boom') {
        for (const b of booms) b.t += dt;
        booms = booms.filter(b => b.t < 1);
        if (!booms.length) afterBoom();
      } else if (phase === 'aim' && aiPlan && !done) {
        // počítač otáčí hlavní k cíli a pak vystřelí
        const t = st.tanks[active];
        t.ang += Math.sign(aiPlan.a - t.ang) * Math.min(Math.abs(aiPlan.a - t.ang), 90 * dt);
        t.pw += Math.sign(aiPlan.pw - t.pw) * Math.min(Math.abs(aiPlan.pw - t.pw), 80 * dt);
        aiT -= dt;
        if (aiT <= 0 && Math.round(t.ang) === aiPlan.a && Math.round(t.pw) === aiPlan.pw) { t.ang = aiPlan.a; t.pw = aiPlan.pw; weapon = aiPlan.weapon; aiPlan = null; fire(); }
        if (Math.random() < 0.05) syncUI();
      }
      draw();
    }

    // obnovení: znovu se přehrají všechny výstřely
    const replay = online ? net.moves : saved && saved.moves ? saved.moves : [];
    for (const mv of replay) { wind = windFor(P.seed, turn, P.wind ?? 8); active = turn % 2; applyQuiet(mv); }
    if (online) net.onMove = mv => { if (done) return; if (phase === 'aim' && !isHuman(active)) fire(dec(mv)); else pending.push(mv); };
    fit(); addEventListener('resize', fit);
    const deadAtStart = st.tanks.map(t => t.hp <= 0);
    if (deadAtStart[0] || deadAtStart[1]) { done = true; phase = 'over'; } else startTurn();
    raf = requestAnimationFrame(frame);
    return {
      getState: () => (done ? null : { moves: moves.slice() }),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('pointerup', stopRep); removeEventListener('pointercancel', stopRep); clearInterval(rep); },
      onKey(e) {
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); setAng(st.tanks[active].ang + (k === 'ArrowLeft' ? 1 : -1) * (e.shiftKey ? 5 : 1)); }
        else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); setPw(st.tanks[active].pw + (k === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 5 : 1)); }
        else if (k === 'a' || k === 'A') drive(-1, 4);
        else if (k === 'd' || k === 'D') drive(1, 4);
        else if (k === ' ' || k === 'Enter') { e.preventDefault(); if (!e.repeat && isHuman(active)) fire(); }
        else if (/^[1-5]$/.test(k) && isHuman(active) && phase === 'aim' && st.ammo[active][+k - 1] > 0) { weapon = +k - 1; syncUI(); }
      },
      _solve() { st.tanks[1].hp = 0; finish(0); },
      _state: () => ({ turn, active, phase, wind, weapon, fuel, done, tanks: st.tanks.map(t => ({ x: t.x, y: t.y, hp: t.hp, ang: Math.round(t.ang), pw: Math.round(t.pw) })), moves: moves.length }),
      _aim(a, pw) { const t = st.tanks[active]; t.ang = a; t.pw = pw; syncUI(); },
    };
  }

  function art(el) {
    el.innerHTML = `<svg viewBox="0 0 260 260"><defs><linearGradient id="tkSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1240"/><stop offset=".6" stop-color="#5a2a6e"/><stop offset="1" stop-color="#ff8a5c"/></linearGradient></defs>
      <rect x="10" y="20" width="240" height="210" rx="18" fill="url(#tkSky)"/><circle cx="150" cy="80" r="18" fill="#ffd27a"/>
      <path d="M10 175 Q60 140 95 160 T170 150 T250 165 V230 H10Z" fill="#5b3a2a"/><path d="M10 175 Q60 140 95 160 T170 150 T250 165" fill="none" stroke="#7ad97a" stroke-width="5"/>
      <path d="M95 112 Q140 40 190 130" fill="none" stroke="#ffe6a0" stroke-width="2.5" stroke-dasharray="4 5"/><circle cx="190" cy="130" r="5" fill="#fff6c8"/>
      <g transform="translate(70 152)"><rect x="-16" y="-7" width="32" height="8" rx="4" fill="#20253a"/><path d="M-14 -6H14L11 -12H-11Z" fill="#55f6ff"/><path d="M-7 -12A7 7 0 0 1 7 -12Z" fill="#55f6ff"/><rect x="0" y="-16" width="20" height="4" fill="#2a2f45" transform="rotate(-50 0 -14)"/></g>
      <g transform="translate(205 148)"><rect x="-16" y="-7" width="32" height="8" rx="4" fill="#20253a"/><path d="M-14 -6H14L11 -12H-11Z" fill="#ff6fb5"/><path d="M-7 -12A7 7 0 0 1 7 -12Z" fill="#ff6fb5"/><rect x="-20" y="-16" width="20" height="4" fill="#2a2f45" transform="rotate(40 0 -14)"/></g></svg>`;
  }
  return { DIFFS, WEAPONS, generate, create, art, terrain, fly, blast, settle, windFor, levelSpec, FW, FH };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'tanky', title: 'TANKY',
  tagline: Kit.L('Dělostřelecký souboj dvou tanků na tahy: nastav úhel a sílu, počítej s větrem a trefuj. Proti počítači, ve dvou na jednom zařízení i online.', 'An artillery duel of two tanks, turn by turn: set the angle and power, mind the wind and hit. Against the computer, two players on one device or online.'),
  diffs: Tanky.DIFFS, generate: Tanky.generate, create: Tanky.create, art: Tanky.art,
  online: { kind: 'turn' },
  dailyDiff: () => 'ai2',
  levelDiff: n => ['ai1', 'ai2', 'ai3'][Tanky.levelSpec(n).ai - 1],
  rules: Kit.L(`<p>Dva tanky, jeden kopec mezi nimi. Střídáte se ve výstřelech; kdo první srazí soupeři zdraví na nulu, vyhrál.</p>
    <ul><li><b>Míření:</b> nastav úhel a sílu posuvníky, nebo táhni prstem či myší po bojišti (směr od tanku je úhel, vzdálenost síla). Na klávesnici ← → úhel, ↑ ↓ síla (se Shiftem po pěti), mezerník vystřelí.</li>
    <li><b>Vítr</b> se mění každý tah a stáčí střely; síla a směr jsou nahoře.</li>
    <li>Než vystřelíš, můžeš s tankem <b>popojet</b> (◀ ▶ nebo A/D); paliva je na každý tah omezeně.</li>
    <li><b>Zbraně</b> (1–5): střela (bez omezení), těžká střela, trojitá, kopáč (vyhloubí velkou jámu) a hlína (zasype soupeře).</li>
    <li>Výbuchy hloubí terén. Když se tank zřítí do kráteru z výšky, utrží poškození.</li>
    <li><b>Online:</b> založ hru a pošli kód kamarádovi; po partii jde dát odvetu.</li></ul>`,
    `<p>Two tanks, one hill between them. Take turns firing; the first to bring the opponent's health to zero wins.</p>
    <ul><li><b>Aiming:</b> set the angle and power with the sliders, or drag on the battlefield (direction from the tank is the angle, distance the power). Keyboard: ← → angle, ↑ ↓ power (Shift for steps of five), Space fires.</li>
    <li>The <b>wind</b> changes every turn and bends the shots; its strength and direction are at the top.</li>
    <li>Before firing you can <b>drive</b> a bit (◀ ▶ or A/D); fuel is limited per turn.</li>
    <li><b>Weapons</b> (1–5): shell (unlimited), heavy shell, triple, digger (blasts a big pit) and dirt (buries the opponent).</li>
    <li>Explosions dig into the terrain. A tank that falls into a crater from high up takes damage.</li>
    <li><b>Online:</b> create a game and send the code to a friend; a rematch is one click away.</li></ul>`),
  achievements: [],
});
