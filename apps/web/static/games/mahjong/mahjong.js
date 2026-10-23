'use strict';
// ── MAHJONG · Windowling Hlavolamy ──────────────────────────────────────────
// Mahjong solitaire: odebírej dvojice stejných volných kamenů. Rozdání se staví
// zpětně (náhodně volné dvojice dostanou stejný kámen), takže jde vždy dohrát.
// Kameny: Hvězdy, Planety, Komety 1–9, čtyři směry, tři nebeská tělesa, souhvězdí a fáze.
// Čtyři odkládací políčka: odložený kámen uvolní sousedy a spáruje se později.
const Mahjong = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'pyramid', name: L('Pyramida', 'Pyramid'), note: L('40 kamenů', '40 tiles'), par: 3 * 60 },
    { id: 'fortress', name: L('Pevnost', 'Fortress'), note: L('84 kamenů', '84 tiles'), par: 7 * 60 },
    { id: 'turtle', name: L('Želva', 'Turtle'), note: L('144 kamenů', '144 tiles'), par: 13 * 60 },
    { id: 'tower', name: L('Věž', 'Tower'), note: L('144, bez nápovědy volných', '144, no free-tile assist'), par: 16 * 60 },
  ];
  // Pozice v polovinách kamene: [x, y, z]; kámen zabírá 2×2.
  function rect(out, x0, y0, w, h, z) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push([x0 + x * 2, y0 + y * 2, z]); }
  const LAYOUTS = {
    turtle() {
      const p = [], rows = [12, 8, 10, 12, 12, 10, 8, 12];
      rows.forEach((w, y) => rect(p, 2 + (12 - w), y * 2, w, 1, 0));
      p.push([0, 7, 0], [26, 7, 0], [28, 7, 0]);
      rect(p, 8, 2, 6, 6, 1); rect(p, 10, 4, 4, 4, 2); rect(p, 12, 6, 2, 2, 3); p.push([13, 7, 4]);
      return p;
    },
    pyramid() { const p = []; rect(p, 0, 0, 6, 4, 0); rect(p, 2, 1, 4, 3, 1); rect(p, 4, 2, 2, 2, 2); return p; },
    fortress() { const p = []; rect(p, 0, 0, 10, 6, 0); rect(p, 2, 2, 8, 4, 1); rect(p, 4, 4, 4, 2, 2); rect(p, 0, 0, 2, 2, 1); rect(p, 16, 0, 2, 2, 1); rect(p, 0, 8, 2, 2, 1); rect(p, 16, 8, 2, 2, 1); return p.slice(0, 84); },
    tower() { const p = []; rect(p, 0, 0, 8, 8, 0); rect(p, 2, 2, 6, 6, 1); rect(p, 4, 4, 4, 4, 2); rect(p, 6, 6, 2, 2, 3); rect(p, -4, 4, 2, 4, 0); rect(p, 16, 4, 2, 4, 0); return p.slice(0, 144); },
  };
  // Náhodné souměrné rozložení pro Cestu
  function randomLayout(r, count) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const p = [], W = 7 + Math.floor(r() * 4), H = 4 + Math.floor(r() * 4), grid = new Set();
      for (let y = 0; y < H; y++) for (let x = 0; x < Math.ceil(W / 2); x++) if (r() < 0.78) { grid.add(`${x},${y}`); grid.add(`${W - 1 - x},${y}`); }
      for (const k of grid) { const [x, y] = k.split(',').map(Number); p.push([x * 2, y * 2, 0]); }
      let z = 1, layer = p.filter(t => t[2] === 0);
      while (p.length < count && layer.length > 3 && z < 5) {
        const next = [];
        for (const [x, y] of layer) { const up = [x + 1, y + 1, z]; const ok = [[0, 0], [2, 0], [0, 2], [2, 2]].every(([dx, dy]) => layer.some(t => t[0] === x + dx && t[1] === y + dy)); if (ok && r() < 0.8 && !next.some(t => Math.abs(t[0] - up[0]) < 2 && Math.abs(t[1] - up[1]) < 2)) next.push(up); }
        p.push(...next); layer = next; z++;
      }
      const n = Math.min(p.length, count) - (Math.min(p.length, count) % 2);
      if (n >= count * 0.8) return p.sort((a, b) => a[2] - b[2]).slice(0, n);
    }
    return LAYOUTS.pyramid();
  }

  // Kameny: 0–8 hvězdy, 9–17 planety, 18–26 komety, 27–30 směry, 31–33 tělesa, 34 souhvězdí (4 různé), 35 fáze (4 různé)
  const KINDS = 36;
  function tileSet(n, r) {
    const all = []; for (let k = 0; k < 34; k++) for (let c = 0; c < 4; c++) all.push({ k, v: 0 });
    for (let c = 0; c < 4; c++) { all.push({ k: 34, v: c }); all.push({ k: 35, v: c }); }
    if (n >= 144) return Kit.shuffle(all, r);
    // menší rozložení: náhodné druhy po dvojicích
    const kinds = Kit.shuffle([...Array(34).keys()], r), out = [];
    for (let i = 0; out.length < n; i++) { const k = kinds[i % 34]; out.push({ k, v: 0 }, { k, v: 0 }); }
    return out.slice(0, n);
  }
  const match = (a, b) => a.k === b.k;
  // volný kámen: nic na něm a volná levá nebo pravá strana
  function freeOf(tiles, alive) {
    return i => {
      const [x, y, z] = tiles[i].p;
      let left = false, right = false;
      for (let j = 0; j < tiles.length; j++) {
        if (j === i || !alive[j]) continue;
        const [x2, y2, z2] = tiles[j].p;
        if (Math.abs(y2 - y) >= 2) continue;
        if (z2 === z + 1 && Math.abs(x2 - x) < 2) return false;
        if (z2 === z) { if (x2 === x - 2) left = true; if (x2 === x + 2) right = true; }
      }
      return !(left && right);
    };
  }

  function generate(seed, diffId, ctx = {}) {
    const r = Kit.rng(seed);
    let pos, D = diffId;
    if (ctx.kind === 'level') { const n = ctx.key, ch = Math.floor((n - 1) / 20); pos = n % 10 === 0 ? LAYOUTS[['pyramid', 'fortress', 'turtle', 'turtle', 'tower', 'tower'][ch]]() : randomLayout(r, [36, 56, 72, 96, 120, 144][ch]); D = ['pyramid', 'pyramid', 'fortress', 'fortress', 'turtle', 'tower'][ch]; }
    else pos = LAYOUTS[ctx.kind === 'daily' ? 'turtle' : diffId]();
    if (pos.length % 2) pos = pos.slice(0, pos.length - 1);
    for (let attempt = 0; attempt < 200; attempt++) {
      const set = tileSet(pos.length, r), pairs = [];
      // páry: pořadí podle druhu
      const byKind = new Map(); set.forEach(t => { const k = t.k; (byKind.get(k) || byKind.set(k, []).get(k)).push(t); });
      for (const list of byKind.values()) for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
      Kit.shuffle(pairs, r);
      const tiles = pos.map(p => ({ p })), alive = tiles.map(() => true), free = freeOf(tiles, alive);
      let ok = true;
      for (const [a, b] of pairs) {
        const fr = tiles.map((_, i) => i).filter(i => alive[i] && free(i));
        if (fr.length < 2) { ok = false; break; }
        const i = fr[Math.floor(r() * fr.length)]; alive[i] = false;
        const fr2 = tiles.map((_, k) => k).filter(k => alive[k] && free(k));
        if (!fr2.length) { ok = false; break; }
        const j = fr2[Math.floor(r() * fr2.length)]; alive[j] = false;
        tiles[i].t = a; tiles[j].t = b;
      }
      if (ok) return { diff: D, tiles: tiles.map(t => [t.p[0], t.p[1], t.p[2], t.t.k, t.t.v]) };
    }
    return null;
  }

  // ── Kresba kamene (SVG 100×134, společné symboly v jednom skrytém <svg>) ──
  const WIND = L(['S', 'V', 'J', 'Z'], ['N', 'E', 'S', 'W']);
  function defs() {
    if (document.getElementById('mjDefs')) return;
    const d = document.createElement('div');
    d.innerHTML = `<svg id="mjDefs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <linearGradient id="mjGStar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fb4ff"/><stop offset="1" stop-color="#1f4fd8"/></linearGradient>
      <radialGradient id="mjGPlan" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffb0c0"/><stop offset=".55" stop-color="#e0446a"/><stop offset="1" stop-color="#8a1838"/></radialGradient>
      <radialGradient id="mjGCom" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#b8ffe6"/><stop offset=".6" stop-color="#14b08a"/><stop offset="1" stop-color="#0a6b55"/></radialGradient>
      <linearGradient id="mjGTail" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14b08a" stop-opacity=".9"/><stop offset="1" stop-color="#14b08a" stop-opacity="0"/></linearGradient>
      <radialGradient id="mjGSun" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#ffb21f"/><stop offset="1" stop-color="#e2620a"/></radialGradient>
      <linearGradient id="mjGMoon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9aa8ff"/><stop offset="1" stop-color="#3a3fc4"/></linearGradient>
      <radialGradient id="mjGRing" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e2b8ff"/><stop offset=".55" stop-color="#9b3dff"/><stop offset="1" stop-color="#4c138f"/></radialGradient>
      <mask id="mjMoonMask"><rect x="-40" y="-40" width="80" height="80" fill="#fff"/><circle cx="13" cy="-9" r="25" fill="#000"/></mask>
      <symbol id="mjMoon" viewBox="-32 -32 64 64"><circle r="30" fill="url(#mjGMoon)" mask="url(#mjMoonMask)"/></symbol>
      <symbol id="mjStar" viewBox="-10 -10 20 20"><path d="M0-9.5 2.8-3.2 9.5-2.9 4.3 1.5 6 8.3 0 4.6-6 8.3-4.3 1.5-9.5-2.9-2.8-3.2z" fill="url(#mjGStar)" stroke="#173a9e" stroke-width=".6" stroke-linejoin="round"/></symbol>
      <symbol id="mjPlanet" viewBox="-10 -10 20 20"><circle r="6.2" fill="url(#mjGPlan)"/><ellipse rx="9.6" ry="2.8" fill="none" stroke="#b02a50" stroke-width="1.3" transform="rotate(-22)"/><path d="M-6 0.6a6.2 6.2 0 0 0 12-1.2" fill="url(#mjGPlan)" transform="rotate(-22)"/></symbol>
      <symbol id="mjComet" viewBox="-10 -10 20 20"><path d="M1.2-6.6 7-1.2-8.6 9.2z" fill="url(#mjGTail)"/><circle cx="3.6" cy="-3.6" r="4.6" fill="url(#mjGCom)" stroke="#0a6b55" stroke-width=".5"/></symbol>
    </defs></svg>`;
    document.body.appendChild(d.firstChild);
  }
  const PIPS = [[], [[50, 50]], [[50, 26], [50, 74]], [[26, 24], [50, 50], [74, 76]], [[28, 28], [72, 28], [28, 72], [72, 72]], [[26, 24], [74, 24], [50, 50], [26, 76], [74, 76]],
    [[30, 20], [70, 20], [30, 50], [70, 50], [30, 80], [70, 80]], [[22, 18], [50, 18], [78, 18], [30, 52], [70, 52], [30, 82], [70, 82]],
    [[30, 14], [70, 14], [30, 38], [70, 38], [30, 62], [70, 62], [30, 86], [70, 86]], [[22, 18], [50, 18], [78, 18], [22, 50], [50, 50], [78, 50], [22, 82], [50, 82], [78, 82]]];
  const SUIT = [{ id: 'mjStar', col: '#1f4fd8' }, { id: 'mjPlanet', col: '#c22a52' }, { id: 'mjComet', col: '#0d8a6c' }];
  // souhvězdí: hvězdy a spojnice (Beran, Lev, Střelec, Vodnář)
  const ZOD = [
    [[[22, 40], [44, 30], [66, 38], [80, 60]], [[0, 1], [1, 2], [2, 3]]],
    [[[24, 70], [40, 46], [60, 34], [78, 44], [72, 66], [46, 70]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1]]],
    [[[20, 76], [40, 58], [58, 62], [62, 38], [80, 26], [44, 34]], [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [5, 1]]],
    [[[18, 36], [36, 48], [52, 36], [68, 50], [84, 38], [50, 72]], [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]]],
  ];
  const ZOD_NAME = L(['Beran', 'Lev', 'Střelec', 'Vodnář'], ['Aries', 'Leo', 'Sagittarius', 'Aquarius']);
  const cap = t => `<text x="50" y="125" text-anchor="middle" class="mj-cap">${t}</text>`;
  function face(k, v) {
    let g = '';
    if (k < 27) {
      const suit = SUIT[Math.floor(k / 9)], n = k % 9 + 1, size = n === 1 ? 46 : n <= 3 ? 30 : n <= 6 ? 25 : 21;
      g = PIPS[n].map(([x, y]) => `<use href="#${suit.id}" x="${(14 + x * 0.72 - size / 2).toFixed(1)}" y="${(34 + y * 0.84 - size / 2).toFixed(1)}" width="${size}" height="${size}"/>`).join('')
        + `<text x="13" y="27" class="mj-num" fill="${suit.col}">${n}</text>`;
    } else if (k < 31) {
      g = `<g opacity=".14" transform="translate(50 66)"><path d="M0-40 7-7 40 0 7 7 0 40-7 7-40 0-7-7z" fill="#2c2178"/></g>
        <text x="50" y="86" text-anchor="middle" class="mj-wind">${WIND[k - 27]}</text>${cap(L('vítr', 'wind'))}`;
    } else if (k === 31) {
      g = `<g transform="translate(50 64)">${[...Array(12)].map((_, i) => `<path d="M-3-30 0-40 3-30z" fill="#ff9a1f" transform="rotate(${i * 30})"/>`).join('')}<circle r="24" fill="url(#mjGSun)"/></g>${cap(L('slunce', 'sun'))}`;
    } else if (k === 32) {
      g = `<use href="#mjMoon" x="16" y="30" width="68" height="68"/><use href="#mjStar" x="64" y="36" width="12" height="12"/><use href="#mjStar" x="74" y="56" width="8" height="8"/>${cap(L('měsíc', 'moon'))}`;
    } else if (k === 33) {
      g = `<g transform="translate(50 64) rotate(-20)"><ellipse rx="40" ry="11" fill="none" stroke="#7a2cff" stroke-width="3.5"/><circle r="22" fill="url(#mjGRing)"/><path d="M-39 3a40 11 0 0 0 78 0" fill="none" stroke="#7a2cff" stroke-width="3.5"/></g>${cap(L('planeta', 'planet'))}`;
    } else if (k === 34) {
      const [pts, lines] = ZOD[v];
      g = lines.map(([a, b]) => `<line x1="${pts[a][0]}" y1="${pts[a][1] + 12}" x2="${pts[b][0]}" y2="${pts[b][1] + 12}" stroke="#b14cff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`).join('')
        + pts.map(([x, y], i) => `<use href="#mjStar" x="${x - (i ? 6 : 8)}" y="${y + 12 - (i ? 6 : 8)}" width="${i ? 12 : 16}" height="${i ? 12 : 16}" class="mj-zs"/>`).join('') + cap(ZOD_NAME[v]);
    } else {
      // fáze Měsíce: srpek, čtvrt, dorůstající, úplněk
      const lit = ['M50 32a32 32 0 0 1 0 64a20 32 0 0 0 0-64z', 'M50 32a32 32 0 0 1 0 64z', 'M50 32a32 32 0 0 1 0 64a18 32 0 0 1 0-64z', 'M50 32a32 32 0 0 1 0 64a32 32 0 0 1 0-64z'][v];
      g = `<circle cx="50" cy="64" r="32" fill="#163a52"/><path d="${lit}" fill="#5fe0e0"/><circle cx="50" cy="64" r="32" fill="none" stroke="#0a6b7a" stroke-width="1.5"/>${cap(L('fáze', 'phase'))}`;
    }
    return `<svg viewBox="0 0 100 134" class="mj-f">${g}</svg>`;
  }

  function create(el, P, saved, api) {
    defs();
    const tiles = P.tiles.map(([x, y, z, k, v], i) => ({ i, p: [x, y, z], k, v }));
    let alive = saved && saved.alive ? saved.alive.slice() : tiles.map(() => true), sel = -1, hist = [], done = false;
    // 4 odkládací políčka: index kamene nebo -1. Odložený kámen už neblokuje ostatní.
    let slots = saved && saved.slots ? saved.slots.slice() : [-1, -1, -1, -1];
    if (saved && saved.kinds) saved.kinds.forEach(([k, v], i) => { if (tiles[i]) { tiles[i].k = k; tiles[i].v = v; } });
    const assist = P.diff !== 'tower';
    el.innerHTML = `<div class="mj-wrap"><div class="mj-head"><div><small>${L('ZBÝVÁ', 'LEFT')}</small><b class="mj-left"></b></div><div><small>${L('MOŽNÉ TAHY', 'MOVES')}</small><b class="mj-moves"></b></div></div>
      <div class="mj-tray" aria-label="${L('Odkládací políčka', 'Holding slots')}">${slots.map((_, s) => `<button class="mj-slot" data-s="${s}" aria-label="${L('Odkládací políčko', 'Holding slot')} ${s + 1}"></button>`).join('')}</div>
      <div class="mj-scroll"><div class="mj-board"></div></div>
      <div class="k-tools"><button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button><button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button><button class="k-tool" data-t="shuffle">${api.icon('plus')}<span>${L('Zamíchat', 'Shuffle')}</span></button></div></div>`;
    const board = el.querySelector('.mj-board'), tray = el.querySelector('.mj-tray'), slotEls = [...tray.children];
    const xs = tiles.map(t => t.p[0]), ys = tiles.map(t => t.p[1]), minX = Math.min(...xs), minY = Math.min(...ys), maxZ = Math.max(...tiles.map(t => t.p[2]));
    const spanX = Math.max(...xs) - minX + 2, spanY = Math.max(...ys) - minY + 2;
    let tw = 40, th = 54, dz = 4;
    const els = tiles.map(t => { const e = document.createElement('button'); e.className = 'mj-t'; e.innerHTML = face(t.k, t.v); e.dataset.i = t.i; board.appendChild(e); return e; });
    function fit() {
      const vw = (document.getElementById('kView') || el).clientWidth - 40, vh = innerHeight - 300;
      tw = Math.max(26, Math.floor(Math.min(vw / (spanX / 2 + 0.4), (vh / (spanY / 2 + 0.4)) * 0.74)));
      th = Math.round(tw * 1.34); dz = Math.max(2, Math.round(tw * 0.1));
      board.style.width = (spanX / 2) * tw + maxZ * dz + 8 + 'px'; board.style.height = (spanY / 2) * th + maxZ * dz + 8 + 'px';
      board.style.setProperty('--tw', tw + 'px'); board.style.setProperty('--th', th + 'px'); board.style.setProperty('--dz', dz + 'px');
      tray.style.setProperty('--tw', Math.min(52, Math.max(34, tw)) + 'px');
      tiles.forEach((t, i) => { const [x, y, z] = t.p; els[i].style.transform = `translate(${((x - minX) / 2) * tw + (maxZ - z) * dz}px, ${((y - minY) / 2) * th + (maxZ - z) * dz}px)`; els[i].style.zIndex = z * 1000 + y * 10 + x; });
    }
    const inSlot = i => slots.indexOf(i);
    const free = i => freeOf(tiles, alive)(i);
    const usable = i => (alive[i] && free(i)) || inSlot(i) >= 0;
    const left = () => alive.filter(Boolean).length + slots.filter(s => s >= 0).length;
    function pairs() {
      const f = freeOf(tiles, alive), fr = tiles.filter((t, i) => (alive[i] && f(i)) || inSlot(i) >= 0), out = [];
      for (let a = 0; a < fr.length; a++) for (let b = a + 1; b < fr.length; b++) if (match(fr[a], fr[b])) out.push([fr[a].i, fr[b].i]);
      return out;
    }
    function render() {
      const f = freeOf(tiles, alive);
      tiles.forEach((t, i) => { els[i].hidden = !alive[i]; els[i].classList.toggle('sel', i === sel); els[i].classList.toggle('blocked', alive[i] && assist && !f(i)); });
      const parkable = sel >= 0 && alive[sel];
      slotEls.forEach((e, s) => {
        const t = slots[s];
        e.classList.toggle('full', t >= 0); e.classList.toggle('sel', t >= 0 && t === sel); e.classList.toggle('ready', t < 0 && parkable);
        const want = t >= 0 ? `${tiles[t].k}:${tiles[t].v}` : '';
        if (e.dataset.f !== want) { e.dataset.f = want; e.innerHTML = t >= 0 ? `<span class="mj-mini">${face(tiles[t].k, tiles[t].v)}</span>` : `<i>${s + 1}</i>`; }
      });
      el.querySelector('.mj-left').textContent = left();
      const pc = pairs().length; el.querySelector('.mj-moves').textContent = pc;
      const stuck = !done && pc === 0 && left() > 0 && (slots.every(s => s >= 0) || !tiles.some((t, i) => alive[i] && f(i)));
      if (stuck) api.toast(L('Žádný tah – zamíchej kameny', 'No moves – shuffle the tiles'));
      el.querySelector('[data-t="shuffle"]').classList.toggle('on', stuck);
    }
    const snap = () => hist.push({ alive: alive.slice(), slots: slots.slice() });
    function remove(a, b) {
      snap();
      for (const k of [a, b]) { const s = inSlot(k); if (s >= 0) slots[s] = -1; else { alive[k] = false; els[k].classList.add('gone'); setTimeout(() => els[k].classList.remove('gone'), 300); } }
      sel = -1; api.sound('line'); api.changed();
      setTimeout(() => { render(); check(); }, 220);
    }
    function pick(i) {
      if (sel < 0 || sel === i) { sel = sel === i ? -1 : i; api.sound('tap'); render(); return; }
      if (match(tiles[sel], tiles[i])) remove(sel, i);
      else { sel = i; api.sound('tap'); render(); }
    }
    function tap(i) {
      if (done || !alive[i]) return;
      if (!free(i)) { api.sound('error'); els[i].classList.add('shake'); setTimeout(() => els[i].classList.remove('shake'), 350); return; }
      pick(i);
    }
    function tapSlot(s) {
      if (done) return;
      const t = slots[s];
      if (t >= 0) { pick(t); return; }
      if (sel >= 0 && alive[sel]) {
        // odlož vybraný volný kámen
        snap(); slots[s] = sel; alive[sel] = false; sel = -1; api.sound('soft'); api.changed(); render(); return;
      }
      api.toast(L('Vyber volný kámen a klepni na políčko – odložíš ho stranou', 'Pick a free tile, then tap a slot to set it aside'));
    }
    function check() { if (alive.every(a => !a) && slots.every(s => s < 0)) { done = true; setTimeout(() => api.solved(), 300); } }
    function shuffle() {
      // odložené kameny se vrátí na svá místa; zbytek se zamíchá tak, aby šlo pokračovat
      snap();
      for (const t of slots) if (t >= 0) alive[t] = true;
      slots = [-1, -1, -1, -1];
      const idx = tiles.map((t, i) => i).filter(i => alive[i]), kinds = idx.map(i => ({ k: tiles[i].k, v: tiles[i].v }));
      for (let attempt = 0; attempt < 200; attempt++) {
        const al = alive.slice(), fr = freeOf(tiles, al), pairsK = []; const byK = new Map(); kinds.forEach(t => (byK.get(t.k) || byK.set(t.k, []).get(t.k)).push(t));
        for (const l of byK.values()) for (let a = 0; a + 1 < l.length; a += 2) pairsK.push([l[a], l[a + 1]]);
        Kit.shuffle(pairsK, Math.random); let ok = true; const assign = {};
        for (const [a, b] of pairsK) { const f1 = idx.filter(i => al[i] && fr(i)); if (f1.length < 2) { ok = false; break; } const i = f1[Math.floor(Math.random() * f1.length)]; al[i] = false; const f2 = idx.filter(k => al[k] && fr(k)); if (!f2.length) { ok = false; break; } const j = f2[Math.floor(Math.random() * f2.length)]; al[j] = false; assign[i] = a; assign[j] = b; }
        if (ok) { for (const i of idx) { tiles[i].k = assign[i].k; tiles[i].v = assign[i].v; els[i].innerHTML = face(tiles[i].k, tiles[i].v); } break; }
      }
      api.hint(); api.sound('soft'); sel = -1; render(); api.changed();
    }
    board.addEventListener('click', e => { const t = e.target.closest('.mj-t'); if (t) tap(+t.dataset.i); });
    tray.addEventListener('click', e => { const t = e.target.closest('.mj-slot'); if (t) tapSlot(+t.dataset.s); });
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t || done) return;
      if (t.dataset.t === 'undo' && hist.length) { const h = hist.pop(); alive = h.alive; slots = h.slots; sel = -1; api.hint(); api.sound('erase'); render(); api.changed(); }
      if (t.dataset.t === 'hint') {
        const pr = pairs(); if (!pr.length) return; api.hint();
        pr[0].forEach(k => { const s = inSlot(k), e = s >= 0 ? slotEls[s] : els[k]; e.classList.add('hint'); setTimeout(() => e.classList.remove('hint'), 1500); });
      }
      if (t.dataset.t === 'shuffle') shuffle();
    });
    fit(); addEventListener('resize', fit); render();
    return {
      getState: () => (done ? null : { alive, slots, kinds: tiles.map(t => [t.k, t.v]) }),
      progress: () => 1 - left() / alive.length,
      destroy() { removeEventListener('resize', fit); },
      onKey(e) { if (e.key === 'h' || e.key === 'H') el.querySelector('[data-t="hint"]').click(); if ((e.key === 'z' || e.key === 'Z')) el.querySelector('[data-t="undo"]').click(); if (/^[1-4]$/.test(e.key)) tapSlot(+e.key - 1); },
      _solve() { alive = alive.map(() => false); slots = [-1, -1, -1, -1]; render(); check(); },
    };
  }
  function art(el) {
    defs();
    const ks = [[0, 0], [10, 0], [31, 0], [22, 0], [34, 1], [28, 0]];
    el.innerHTML = `<div class="mj-art">${ks.map(([k, v], i) => `<div class="mj-t" style="transform:translate(${(i % 3) * 66 + (i > 2 ? 33 : 0)}px, ${Math.floor(i / 3) * 80 + 40}px)">${face(k, v)}</div>`).join('')}</div>`;
  }
  return { DIFFS, generate, create, art, LAYOUTS, freeOf };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'mahjong', title: 'MAHJONG',
  tagline: Kit.L('Odebírej dvojice nebeských kamenů. Hvězdy, planety, komety a souhvězdí, každé rozložení jde dohrát.', 'Remove pairs of celestial tiles. Stars, planets, comets and zodiacs; every layout can be cleared.'),
  diffs: Mahjong.DIFFS, generate: Mahjong.generate, create: Mahjong.create, art: Mahjong.art,
  online: { kind: 'race' },
  dailyDiff: () => 'turtle', levelDiff: n => ['pyramid', 'pyramid', 'fortress', 'fortress', 'turtle', 'tower'][Math.floor((n - 1) / 20)],
  rules: Kit.L(`<p>Odeber všechny kameny po dvojicích stejných.</p>
    <ul><li>Odebrat jde jen <b>volný</b> kámen: nic na něm neleží a vlevo nebo vpravo od něj je volno. Zablokované kameny jsou ztmavené (kromě Věže).</li>
    <li><b>Souhvězdí</b> (♈ ♌ ♐ ♒) se párují mezi sebou, stejně tak <b>fáze</b> Měsíce.</li>
    <li><b>Odkládací políčka:</b> vyber volný kámen a klepni na jedno ze 4 políček nad deskou. Odložený kámen uvolní místo a spárovat ho můžeš později s kterýmkoli volným kamenem (klávesy 1–4).</li>
    <li>Rozdání jde vždy dohrát. Když uvízneš, <b>Zamíchat</b> vrátí odložené kameny a rozloží zbylé znovu (počítá se jako nápověda).</li></ul>`,
    `<p>Remove every tile in matching pairs.</p>
    <ul><li>Only a <b>free</b> tile can be removed: nothing on top of it and its left or right side is open. Blocked tiles are dimmed (except in the Tower).</li>
    <li><b>Zodiacs</b> (♈ ♌ ♐ ♒) match each other, and so do Moon <b>phases</b>.</li>
    <li><b>Holding slots:</b> pick a free tile and tap one of the 4 slots above the board. The tile is set aside, freeing its neighbours, and can be paired later with any free tile (keys 1–4).</li>
    <li>Every deal can be cleared. If you get stuck, <b>Shuffle</b> returns the set-aside tiles and rearranges the rest (counts as a hint).</li></ul>`),
  achievements: [],
});
