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
      for (let k = 0; k < 2; k++) { const t = st.tanks[k]; if ((k !== shooter || i > 30) && t.hp > 0 && Math.abs(x - t.x) < 20 && y > t.y - 25 && y < t.y + 2) { path.push([x, y]); return { path, hit: [Math.round(x), Math.round(y)] }; } }
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
      t.recoil = 1; t.flash = 1;
      const m = tankScale(), ar = a * Math.PI / 180, mx = t.x + Math.cos(ar) * 28 * m, my = t.y - 15 * m - Math.sin(ar) * 28 * m;
      for (let i = 0; i < 7; i++) { const life = 0.6 + Math.random() * 0.6; parts.push({ x: mx, y: my, vx: Math.cos(ar) * (30 + Math.random() * 60) + (Math.random() - 0.5) * 30, vy: -Math.sin(ar) * (30 + Math.random() * 60) - 10, t: life, life, puff: 3 + Math.random() * 3, col: '200,200,210' }); }
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
        if (w.kind !== 'dirt') burns.push([p[0], p[1], w.r]);
        const soil = `rgb(${TH.soil[0].join(',')})`;
        for (let i = 0; i < (w.kind === 'dirt' ? 18 : 30); i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 240; parts.push({ x: p[0], y: p[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, t: 0.6 + Math.random() * 0.8, col: w.kind === 'dirt' || i % 3 ? soil : Math.random() < 0.5 ? '#ffe066' : '#ff8a3d', z: 2 + Math.random() * 3.5, g: true }); }
        for (let i = 0; i < (w.kind === 'dirt' ? 4 : 9); i++) { const a = Math.random() * 6.28, d = Math.random() * w.r * 0.6, life = 1 + Math.random() * 0.8; parts.push({ x: p[0] + Math.cos(a) * d, y: p[1] + Math.sin(a) * d, vx: (Math.random() - 0.5) * 20, vy: -16 - Math.random() * 24, t: life, life, puff: w.r * 0.2 + Math.random() * 5, col: w.kind === 'dirt' ? '140,110,80' : i % 3 ? '70,64,72' : '120,110,110' }); }
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
        t.x = nx; t.y = st.h[nx]; fuel--; t.wheel = (t.wheel || 0) + dir;
        if (Math.abs(st.tanks[1 - active].x - t.x) < 44) { t.x -= dir; t.y = st.h[t.x]; break; }
      }
      syncUI();
    }

    // ── Vykreslení ──
    el.innerHTML = `<div class="tk-wrap">
      <div class="tk-top"><div class="tk-p tk-p0"><b></b><i><s></s></i></div><div class="tk-wind"><small>${L('VÍTR', 'WIND')}</small><b></b><span class="tk-wbar"><u></u></span></div><div class="tk-p tk-p1"><b></b><i><s></s></i></div></div>
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
      wrapEl.classList.toggle('phone', phone); bgCv = null; texCv = null; terrainDirty = true;
    }
    const THEMES = [
      { sky: ['#1a1240', '#5a2a6e', '#ff8a5c'], sun: '#ffd27a', far: '#4a2c68', near: '#2e1c4a', cloud: 'rgba(255,190,200,.3)', grass: ['#8ae06a', '#3f8a3a'], soil: [[140, 96, 62], [62, 38, 30]], stone: '#c49a6a', decos: ['pine', 'pine', 'rock', 'bush', 'sandbags', 'barrel', 'flower'] },
      { sky: ['#050818', '#0f1a44', '#2a3a7a'], sun: '#e8f0ff', moon: true, far: '#1a2450', near: '#10183a', cloud: 'rgba(140,160,220,.14)', grass: ['#5ac8a0', '#2a7a6a'], soil: [[92, 80, 112], [36, 28, 52]], stone: '#9a8cb8', decos: ['dead', 'dead', 'ruin', 'rock', 'sandbags', 'barrel'] },
      { sky: ['#3a5aa8', '#b07ab8', '#ffc8b0'], sun: '#fff0c0', far: '#7a6aa8', near: '#5a6a8a', cloud: 'rgba(255,240,245,.7)', grass: ['#a8e070', '#5a9a40'], soil: [[176, 128, 80], [92, 60, 40]], stone: '#d8b88a', decos: ['oak', 'pine', 'cactus', 'rock', 'bush', 'flower', 'flower', 'barrel'] },
    ];
    const TH = THEMES[T.theme];
    const origH = Int16Array.from(st.h), burns = [];
    // ozdoby: náhodně na povrchu mimo tanky; zmizí, jakmile se pod nimi změní zem
    const decos = (() => {
      const r = rngOf(P.seed ^ 0xdec0), out = [];
      for (let tries = 0; tries < 400 && out.length < 16; tries++) {
        const x = 12 + Math.floor(r() * (FW - 24));
        if (T.spots.some(s => Math.abs(s - x) < 56) || out.some(o => Math.abs(o.x - x) < 50) || Math.abs(st.h[x - 6] - st.h[x + 6]) > 7) continue;
        out.push({ x, kind: TH.decos[Math.floor(r() * TH.decos.length)], s: 0.85 + r() * 0.4, seed: Math.floor(r() * 1e9) });
      }
      return out;
    })();
    function layer() { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.setTransform(sc * dpr, 0, 0, sc * dpr, 0, 0); return [c, g]; }
    function background() {
      if (bgCv) return bgCv;
      const [c, g] = layer(); bgCv = c;
      const sky = g.createLinearGradient(0, 0, 0, FH); sky.addColorStop(0, TH.sky[0]); sky.addColorStop(0.55, TH.sky[1]); sky.addColorStop(1, TH.sky[2]);
      g.fillStyle = sky; g.fillRect(0, 0, FW, FH);
      const r = rngOf(P.seed ^ 0x5ca1);
      if (T.theme === 1) for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.7})`; const z = r() < 0.1 ? 2.2 : 1.3; g.fillRect(r() * FW, r() * FH * 0.6, z, z); }
      const sx = FW * (0.3 + r() * 0.4), sy = FH * (0.18 + r() * 0.12);
      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, 150); glow.addColorStop(0, TH.sun + 'aa'); glow.addColorStop(1, TH.sun + '00');
      g.fillStyle = glow; g.fillRect(sx - 150, sy - 150, 300, 300);
      g.fillStyle = TH.sun; g.beginPath(); g.arc(sx, sy, 34, 0, 7); g.fill();
      if (TH.moon) { g.fillStyle = 'rgba(150,160,200,.35)'; for (const [dx, dy, rr] of [[-10, -6, 8], [9, 10, 5], [4, -14, 3.5]]) { g.beginPath(); g.arc(sx + dx, sy + dy, rr, 0, 7); g.fill(); } }
      for (const [col, base, amp, f, trees] of [[TH.far, 0.5, 70, 0.006, false], [TH.near, 0.6, 50, 0.011, true]]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, FH);
        const ph = r() * 6, y = x => FH * base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.7 + ph * 2) * amp * 0.35;
        for (let x = 0; x <= FW; x += 8) g.lineTo(x, y(x));
        g.lineTo(FW, FH); g.fill();
        // siluety stromů na bližších kopcích
        if (trees) for (let x = 6; x < FW; x += 9 + r() * 22) { if (r() < 0.35) continue; const h = 8 + r() * 12, yy = y(x) + 2; g.beginPath(); g.moveTo(x - h * 0.35, yy); g.lineTo(x, yy - h); g.lineTo(x + h * 0.35, yy); g.fill(); }
      }
      return bgCv;
    }
    // textura hlíny (šum, vrstvy, kamínky) jednou na velikost plátna; terén ji jen ořízne
    let texCv = null;
    function texture() {
      if (texCv) return texCv;
      const k = sc * dpr, W = Math.round(FW * k), H = Math.round(FH * k);
      texCv = document.createElement('canvas'); texCv.width = W; texCv.height = H;
      const g = texCv.getContext('2d'), img = g.createImageData(W, H), d = img.data, [c0, c1] = TH.soil;
      const hash = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + P.seed | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
      const sm = t => t * t * (3 - 2 * t);
      const vn = (x, y, c) => { const i = Math.floor(x / c), j = Math.floor(y / c), fx = sm(x / c - i), fy = sm(y / c - j), a = hash(i, j), b = hash(i + 1, j), e = hash(i, j + 1), f = hash(i + 1, j + 1); return a + (b - a) * fx + (e - a) * fy + (a - b - e + f) * fx * fy; };
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const x = px / k, y = py / k, q = Math.min(1, Math.max(0, (y - FH * 0.3) / (FH * 0.7))), n1 = vn(x, y, 16), n2 = vn(x + 50, y, 4);
        const band = Math.sin((y + n1 * 36) / 8) > 0.6 ? -16 : 0, f = 0.8 + n1 * 0.3 + n2 * 0.12, i = (py * W + px) * 4;
        d[i] = (c0[0] + (c1[0] - c0[0]) * q) * f + band; d[i + 1] = (c0[1] + (c1[1] - c0[1]) * q) * f + band; d[i + 2] = (c0[2] + (c1[2] - c0[2]) * q) * f + band; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      g.setTransform(k, 0, 0, k, 0, 0);
      const r = rngOf(P.seed ^ 0x57);
      for (let i = 0; i < 220; i++) {
        const x = r() * FW, y = FH * 0.3 + r() * FH * 0.7, s = 1.5 + r() * 4;
        g.globalAlpha = 0.5; g.fillStyle = r() < 0.5 ? TH.stone : 'rgba(20,10,10,.8)'; g.beginPath(); g.ellipse(x, y, s, s * 0.7, r() * 3, 0, 7); g.fill();
        g.globalAlpha = 0.3; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - s * 0.3, y - s * 0.25, s * 0.35, s * 0.2, 0, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      return texCv;
    }
    function terrainLayer() {
      if (terCv && !terrainDirty) return terCv;
      const [c, g] = layer(); terCv = c; terrainDirty = false;
      for (let i = decos.length - 1; i >= 0; i--) { const o = decos[i]; if (Math.abs(st.h[o.x] - origH[o.x]) > 2) decos.splice(i, 1); }
      for (const o of decos) TkArt.deco(g, o.kind, o.x, st.h[o.x] + 2, o.s * 1.6, rngOf(o.seed));
      const path = () => { g.beginPath(); g.moveTo(0, FH); for (let x = 0; x < FW; x++) g.lineTo(x, st.h[x]); g.lineTo(FW, FH); g.closePath(); };
      g.save(); path(); g.clip();
      g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.drawImage(texture(), 0, 0); g.restore();
      // spálená místa po výbuších
      for (const [x, y, R] of burns) { const gr = g.createRadialGradient(x, y, R * 0.4, x, y, R + 10); gr.addColorStop(0, 'rgba(20,10,8,.55)'); gr.addColorStop(1, 'rgba(20,10,8,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, R + 10, 0, 7); g.fill(); }
      // stín pod drnem
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 12; g.beginPath(); for (let x = 0; x < FW; x += 2) g.lineTo(x, st.h[x] + 9); g.stroke();
      g.restore();
      // drn a stébla
      const gg = g.createLinearGradient(0, FH * 0.25, 0, FH); gg.addColorStop(0, TH.grass[0]); gg.addColorStop(1, TH.grass[1]);
      g.strokeStyle = gg; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath(); for (let x = 0; x < FW; x++) g.lineTo(x, st.h[x] + 2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.2; g.beginPath(); for (let x = 0; x < FW; x++) g.lineTo(x, st.h[x] - 0.5); g.stroke();
      g.strokeStyle = TH.grass[0]; g.lineWidth = 1.1;
      for (let x = 1; x < FW - 1; x += 2) {
        if (Math.abs(st.h[x + 1] - st.h[x - 1]) > 5) continue; // ne na srázu
        const n = Math.sin(x * 12.9898) * 43758.5453, h = 2 + (n - Math.floor(n)) * 4;
        g.beginPath(); g.moveTo(x, st.h[x] + 1); g.lineTo(x + (n % 2) - 0.5, st.h[x] - h); g.stroke();
      }
      return terCv;
    }
    const clouds = Array.from({ length: 6 }, (_, i) => { const r = rngOf(P.seed ^ (0xc1 + i)); return { x: r() * FW * 1.4, y: 30 + r() * FH * 0.3, s: 0.6 + r() * 0.9, v: 3 + r() * 6 }; });
    function drawClouds() {
      ctx.fillStyle = TH.cloud;
      for (const c of clouds) {
        const x = ((c.x + clock * c.v * (wind >= 0 ? 1 : -1) * (0.5 + Math.abs(wind) / 8)) % (FW + 200) + FW + 200) % (FW + 200) - 100;
        ctx.beginPath(); for (const [dx, dy, rr] of [[0, 0, 20], [22, -7, 16], [42, 2, 14], [-20, 4, 12], [14, 7, 16]]) { ctx.moveTo(x + dx * c.s + rr * c.s, c.y + dy * c.s); ctx.arc(x + dx * c.s, c.y + dy * c.s, rr * c.s, 0, 7); } ctx.fill();
      }
    }
    const tankScale = () => Math.max(1.3, Math.min(2.2, 0.82 / sc)); // na malé ploše větší tanky
    function pill(text, x, y, col, m) {
      ctx.font = `700 ${11 * m}px Space Grotesk, sans-serif`; ctx.textAlign = 'center';
      const w = ctx.measureText(text).width + 12 * m;
      ctx.fillStyle = 'rgba(8,8,26,.72)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 8 * m, w, 15 * m, 4 * m); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText(text, x, y + 3.5 * m);
    }
    function drawTank(t, k) {
      const col = COLORS[k], x = t.x, y = t.y, m = tankScale();
      const tilt = Math.atan2((st.h[Math.min(FW - 1, x + 12)] - st.h[Math.max(0, x - 12)]), 24) * 0.8;
      ctx.save(); ctx.translate(x, y + 1); ctx.rotate(tilt); ctx.scale(m, m);
      TkArt.tank(ctx, { col, ang: t.ang, t: clock + k, wheel: t.wheel || 0, recoil: t.recoil || 0, flash: t.flash || 0, dead: t.hp <= 0, wind });
      ctx.restore();
      if (t.hp <= 0) {
        for (let i = 0; i < 3; i++) { const f = (clock * 1.6 + i / 3) % 1; ctx.fillStyle = `rgba(50,48,56,${0.6 * (1 - f)})`; ctx.beginPath(); ctx.arc(x + Math.sin(clock * 2 + i) * 6, y - 22 * m - f * 40, (5 + f * 10) * m * 0.6, 0, 7); ctx.fill(); }
        ctx.fillStyle = `rgba(255,${140 + Math.random() * 80},40,.85)`; ctx.beginPath(); ctx.moveTo(x - 6, y - 14 * m); ctx.quadraticCurveTo(x, y - (24 + Math.random() * 6) * m, x + 6, y - 14 * m); ctx.fill();
      }
      // jméno a zdraví
      const ny = y - 50 * m;
      pill(names[k], x, ny, col, m);
      const bw = 44 * m, by = ny + 10 * m;
      ctx.fillStyle = 'rgba(8,8,26,.72)'; ctx.beginPath(); ctx.roundRect(x - bw / 2 - 1, by - 1, bw + 2, 6 * m + 2, 3 * m); ctx.fill();
      ctx.fillStyle = t.hp > 50 ? '#6dff9e' : t.hp > 25 ? '#ffe066' : '#ff5a7a'; ctx.beginPath(); ctx.roundRect(x - bw / 2, by, Math.max(0.1, bw * t.hp / 100), 6 * m, 3 * m); ctx.fill();
      if (t.hurt && t.hurt.t > 0) { ctx.globalAlpha = Math.min(1, t.hurt.t); ctx.font = `900 ${18 * m}px Unbounded, sans-serif`; ctx.fillStyle = '#ff5a7a'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4 * m; const hy = y - (70 + (1.4 - t.hurt.t) * 30) * m; ctx.strokeText(`−${t.hurt.v}`, x, hy); ctx.fillText(`−${t.hurt.v}`, x, hy); ctx.globalAlpha = 1; }
      if (k === active && phase === 'aim' && !done) { ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.beginPath(); const by2 = y - (74 + Math.sin(clock * 5) * 3) * m; ctx.moveTo(x - 6 * m, by2); ctx.lineTo(x + 6 * m, by2); ctx.lineTo(x, by2 + 8 * m); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 30 * dpr, (Math.random() - 0.5) * shake * 30 * dpr);
      ctx.drawImage(background(), 0, 0);
      const ox = ctx.getTransform().e, oy = ctx.getTransform().f;
      ctx.setTransform(sc * dpr, 0, 0, sc * dpr, ox, oy);
      drawClouds();
      ctx.setTransform(1, 0, 0, 1, ox, oy);
      ctx.drawImage(terrainLayer(), 0, 0);
      ctx.setTransform(sc * dpr, 0, 0, sc * dpr, ox, oy);
      st.tanks.forEach(drawTank);
      // míření: šipka od hlavně, délka podle síly
      if (phase === 'aim' && isHuman(active) && !done) {
        const t = st.tanks[active], a = t.ang * Math.PI / 180, m = tankScale(), x0 = t.x + Math.cos(a) * 26 * m, y0 = t.y - 15 * m - Math.sin(a) * 26 * m, len = 16 + t.pw * 0.9;
        for (let i = 0; i < 8; i++) {
          const d = (i / 8) * len, f = (i / 8 + clock * 0.8) % 1, px = x0 + Math.cos(a) * d, py = y0 - Math.sin(a) * d;
          ctx.fillStyle = `hsla(${60 - (d / 106) * 60},100%,62%,${0.35 + 0.6 * (1 - f)})`; ctx.beginPath(); ctx.arc(px, py, 1.6 + d / 40, 0, 7); ctx.fill();
        }
      }
      if (shot) {
        const n = Math.floor(shot.t * 40);
        for (const f of shot.flights) {
          const upto = Math.min(f.path.length - 1, n), p = f.path[upto], q = f.path[Math.max(0, upto - 1)];
          if (p && upto < f.path.length - 1) TkArt.shell(ctx, shot.w.id, p[0], p[1], Math.atan2(p[1] - q[1], p[0] - q[0]), clock);
        }
      }
      for (const b of booms) {
        const k = Math.min(1, b.t / 0.3), fade = Math.max(0, 1 - (b.t - 0.15) / 0.6);
        if (fade <= 0) continue;
        if (b.kind !== 'dirt' && b.t < 0.3) { ctx.strokeStyle = `rgba(255,255,255,${(0.3 - b.t) * 3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.6 + b.t * 4), 0, 7); ctx.stroke(); }
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * (0.5 + k * 0.7));
        if (b.kind === 'dirt') { g.addColorStop(0, `rgba(170,130,80,${fade})`); g.addColorStop(1, 'rgba(120,90,60,0)'); }
        else { g.addColorStop(0, `rgba(255,255,230,${fade})`); g.addColorStop(0.35, `rgba(255,214,90,${fade})`); g.addColorStop(0.7, `rgba(255,110,40,${fade * 0.85})`); g.addColorStop(1, 'rgba(200,40,30,0)'); }
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.5 + k * 0.7), 0, 7); ctx.fill();
      }
      for (const p of parts) {
        if (p.puff) { const k = 1 - p.t / p.life; ctx.fillStyle = `rgba(${p.col},${Math.min(0.55, p.t / p.life * 0.8)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.puff * (1 + k * 2.2), 0, 7); ctx.fill(); continue; }
        ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.col; const z = p.z || 4; ctx.fillRect(p.x - z / 2, p.y - z / 2, z, z);
      }
      ctx.globalAlpha = 1;
    }
    // ── Ovládání a panel ──
    function syncUI() {
      const t = st.tanks[active], mine = isHuman(active) && phase === 'aim' && !done;
      el.querySelectorAll('.tk-ctrl button, .tk-ctrl input').forEach(b => (b.disabled = !mine));
      angIn.value = t.ang; pwIn.value = t.pw;
      el.querySelector('.tk-angv').textContent = `${t.ang}°`; el.querySelector('.tk-pwv').textContent = t.pw;
      el.querySelector('.tk-fuel').textContent = `${L('Palivo', 'Fuel')} ${Math.round(fuel / FUEL * 100)} %`;
      el.querySelector('.tk-weap').innerHTML = WEAPONS.map((w, i) => { const n = st.ammo[active][i]; return `<button data-w="${i}" class="${i === weapon ? 'on' : ''}" ${n > 0 && mine ? '' : 'disabled'}>${TkArt.ICON[w.id]}${w.name}<small>${n === Infinity ? '∞' : n}</small></button>`; }).join('');
      for (let k = 0; k < 2; k++) {
        const p = el.querySelector(`.tk-p${k}`); p.classList.toggle('on', k === active && !done);
        p.querySelector('b').textContent = names[k]; p.querySelector('s').style.width = st.tanks[k].hp + '%';
      }
      const wb = el.querySelector('.tk-wind b');
      wb.textContent = wind === 0 ? L('bezvětří', 'calm') : `${wind > 0 ? '→' : '←'} ${Math.abs(wind)}`;
      const wu = el.querySelector('.tk-wbar u'), wk = Math.min(1, Math.abs(wind) / 10) * 50;
      wu.style.left = (wind < 0 ? 50 - wk : 50) + '%'; wu.style.width = wk + '%'; wu.className = wind < 0 ? 'l' : 'r';
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
      for (const t of st.tanks) { if (t.hurt) t.hurt.t -= dt; t.recoil = Math.max(0, (t.recoil || 0) - dt * 4); t.flash = Math.max(0, (t.flash || 0) - dt * 6); }
      if (shot && phase === 'fly') for (const f of shot.flights) { const p = f.path[Math.min(f.path.length - 1, Math.floor(shot.t * 40))]; if (p && Math.random() < 0.6) parts.push({ x: p[0], y: p[1], vx: (Math.random() - 0.5) * 8, vy: -8, t: 0.6, life: 0.6, puff: shot.w.kind === 'dirt' ? 2 : 2.5, col: shot.w.kind === 'dirt' ? '160,130,90' : '225,225,235' }); }
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

  // obrázek na úvodní stránce: dva tanky, letící střela a výbuch při západu slunce
  function art(el) {
    el.innerHTML = '<canvas width="520" height="520" style="object-fit:contain"></canvas>';
    const g = el.querySelector('canvas').getContext('2d'), TAU = Math.PI * 2;
    g.beginPath(); g.roundRect(20, 40, 480, 420, 36); g.clip();
    const sky = g.createLinearGradient(0, 40, 0, 460); sky.addColorStop(0, '#1a1240'); sky.addColorStop(0.55, '#5a2a6e'); sky.addColorStop(1, '#ff8a5c');
    g.fillStyle = sky; g.fillRect(0, 0, 520, 520);
    const glow = g.createRadialGradient(270, 190, 10, 270, 190, 160); glow.addColorStop(0, 'rgba(255,210,122,.6)'); glow.addColorStop(1, 'rgba(255,210,122,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 520, 520); g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(270, 190, 42, 0, TAU); g.fill();
    g.fillStyle = '#4a2c68'; g.beginPath(); g.moveTo(0, 520); for (let x = 0; x <= 520; x += 8) g.lineTo(x, 290 + Math.sin(x / 60) * 30); g.lineTo(520, 520); g.fill();
    g.fillStyle = '#2e1c4a'; g.beginPath(); g.moveTo(0, 520); for (let x = 0; x <= 520; x += 8) g.lineTo(x, 330 + Math.sin(x / 40 + 2) * 18); g.lineTo(520, 520); g.fill();
    for (let x = 30; x < 500; x += 26) { const y = 330 + Math.sin(x / 40 + 2) * 18 + 2, h = 14 + (x % 3) * 5; g.beginPath(); g.moveTo(x - h * 0.35, y); g.lineTo(x, y - h); g.lineTo(x + h * 0.35, y); g.fill(); }
    const ground = x => 380 - Math.sin(x / 520 * 5 + 0.6) * 30 - Math.sin(x / 520 * 1.8) * 20;
    const soil = g.createLinearGradient(0, 330, 0, 470); soil.addColorStop(0, '#8c603e'); soil.addColorStop(1, '#3e261e');
    g.fillStyle = soil; g.beginPath(); g.moveTo(0, 520); for (let x = 0; x <= 520; x += 4) g.lineTo(x, ground(x)); g.lineTo(520, 520); g.fill();
    g.fillStyle = 'rgba(20,10,8,.5)'; g.beginPath(); g.arc(400, ground(400) + 6, 34, 0, TAU); g.fill();
    g.strokeStyle = '#8ae06a'; g.lineWidth = 9; g.beginPath(); for (let x = 0; x <= 520; x += 4) g.lineTo(x, ground(x) + 3); g.stroke();
    TkArt.deco(g, 'pine', 250, ground(250) + 3, 2, rngOf(3)); TkArt.deco(g, 'sandbags', 170, ground(170) + 3, 1.8, rngOf(4));
    g.setLineDash([6, 8]); g.strokeStyle = 'rgba(255,240,200,.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(140, 290); g.quadraticCurveTo(250, 40, 360, 200); g.stroke(); g.setLineDash([]);
    for (const [x, y, r] of [[160, 255, 7], [185, 215, 9], [212, 182, 10]]) { g.fillStyle = 'rgba(230,230,240,.4)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.save(); g.scale(2.6, 2.6); TkArt.shell(g, 'big', 362 / 2.6, 205 / 2.6, 1.0, 0); g.restore();
    const bx = 420, by = ground(420) - 20, bg = g.createRadialGradient(bx, by, 0, bx, by, 64);
    bg.addColorStop(0, 'rgba(255,255,230,.95)'); bg.addColorStop(0.4, 'rgba(255,210,90,.9)'); bg.addColorStop(0.75, 'rgba(255,110,40,.7)'); bg.addColorStop(1, 'rgba(200,40,30,0)');
    g.fillStyle = bg; g.beginPath(); g.arc(bx, by, 64, 0, TAU); g.fill();
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.fillStyle = i % 2 ? '#ffd34d' : '#6a4a2a'; g.fillRect(bx + Math.cos(a) * 70, by + Math.sin(a) * 52, 7, 7); }
    g.save(); g.translate(110, ground(110) + 2); g.rotate(-0.08); g.scale(3.3, 3.3); TkArt.tank(g, { col: '#55f6ff', ang: 52, t: 0, recoil: 0.5, flash: 0.35, wind: 4 }); g.restore();
    g.save(); g.translate(430, ground(430) + 2); g.rotate(0.12); g.scale(2.6, 2.6); TkArt.tank(g, { col: '#ff6fb5', ang: 140, t: 1, wind: 4 }); g.restore();
    g.font = '900 32px Unbounded, sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = 'rgba(20,8,30,.8)'; g.strokeText('−52', 430, 250); g.fillStyle = '#ff5a7a'; g.fillText('−52', 430, 250);
  }
  return { DIFFS, WEAPONS, generate, create, art, terrain, fly, blast, settle, windFor, levelSpec, FW, FH };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'tanky', title: 'TANKY', wording: 'win',
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
