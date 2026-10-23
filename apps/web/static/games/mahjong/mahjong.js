'use strict';
// ── MAHJONG · Windowling Hlavolamy ──────────────────────────────────────────
// Mahjong solitaire: odebírej dvojice stejných volných kamenů. Rozdání se staví
// zpětně (náhodně volné dvojice dostanou stejný kámen), takže jde vždy dohrát.
// Kameny: Hvězdy, Planety, Komety 1–9, čtyři směry, tři nebeská tělesa, souhvězdí a fáze.
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

  // ── Kresba kamene ──
  const NUM = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const WIND = L(['S', 'V', 'J', 'Z'], ['N', 'E', 'S', 'W']);
  function face(k, v) {
    if (k < 27) {
      const suit = Math.floor(k / 9), n = k % 9 + 1, col = ['#2b8cff', '#e0446a', '#18a37a'][suit], sym = ['★', '●', '☄'][suit];
      const dots = n <= 3 ? sym.repeat(n) : n <= 6 ? `${sym.repeat(3)}<br>${sym.repeat(n - 3)}` : `${sym.repeat(3)}<br>${sym.repeat(3)}<br>${sym.repeat(n - 6)}`;
      return `<span class="mj-n" style="color:${col}">${NUM[n]}</span><span class="mj-s" style="color:${col}">${dots}</span>`;
    }
    if (k < 31) return `<span class="mj-big" style="color:#3d2f86">${WIND[k - 27]}</span><span class="mj-cap">${L('směr', 'wind')}</span>`;
    if (k < 34) return `<span class="mj-big" style="color:${['#ff9a1f', '#5b6cff', '#7a2cff'][k - 31]}">${['☀', '☾', '◐'][k - 31]}</span>`;
    if (k === 34) return `<span class="mj-big" style="color:#b14cff">${['♈', '♌', '♐', '♒'][v]}</span><span class="mj-cap">${L('souhvězdí', 'zodiac')}</span>`;
    return `<span class="mj-big" style="color:#0aa6a6">${['◔', '◑', '◕', '●'][v]}</span><span class="mj-cap">${L('fáze', 'phase')}</span>`;
  }

  function create(el, P, saved, api) {
    const tiles = P.tiles.map(([x, y, z, k, v], i) => ({ i, p: [x, y, z], k, v }));
    let alive = saved && saved.alive ? saved.alive.slice() : tiles.map(() => true), sel = -1, hist = [], done = false;
    if (saved && saved.kinds) saved.kinds.forEach(([k, v], i) => { if (tiles[i]) { tiles[i].k = k; tiles[i].v = v; } });
    const assist = P.diff !== 'tower';
    el.innerHTML = `<div class="mj-wrap"><div class="mj-head"><div><small>${L('ZBÝVÁ', 'LEFT')}</small><b class="mj-left"></b></div><div><small>${L('MOŽNÉ TAHY', 'MOVES')}</small><b class="mj-moves"></b></div></div>
      <div class="mj-scroll"><div class="mj-board"></div></div>
      <div class="k-tools"><button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button><button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button><button class="k-tool" data-t="shuffle">${api.icon('plus')}<span>${L('Zamíchat', 'Shuffle')}</span></button></div></div>`;
    const board = el.querySelector('.mj-board');
    const xs = tiles.map(t => t.p[0]), ys = tiles.map(t => t.p[1]), minX = Math.min(...xs), minY = Math.min(...ys), maxZ = Math.max(...tiles.map(t => t.p[2]));
    const spanX = Math.max(...xs) - minX + 2, spanY = Math.max(...ys) - minY + 2;
    let tw = 40, th = 54, dz = 4;
    const els = tiles.map(t => { const e = document.createElement('button'); e.className = 'mj-t'; e.innerHTML = face(t.k, t.v); e.dataset.i = t.i; board.appendChild(e); return e; });
    function fit() {
      const vw = (document.getElementById('kView') || el).clientWidth - 24, vh = innerHeight - 230;
      tw = Math.max(26, Math.floor(Math.min(vw / (spanX / 2 + 0.4), (vh / (spanY / 2 + 0.4)) * 0.74)));
      th = Math.round(tw * 1.34); dz = Math.max(2, Math.round(tw * 0.09));
      board.style.width = (spanX / 2) * tw + maxZ * dz + 8 + 'px'; board.style.height = (spanY / 2) * th + maxZ * dz + 8 + 'px';
      board.style.setProperty('--tw', tw + 'px'); board.style.setProperty('--th', th + 'px'); board.style.setProperty('--dz', dz + 'px');
      tiles.forEach((t, i) => { const [x, y, z] = t.p; els[i].style.transform = `translate(${((x - minX) / 2) * tw + (maxZ - z) * dz}px, ${((y - minY) / 2) * th + (maxZ - z) * dz}px)`; els[i].style.zIndex = z * 1000 + y * 10 + x; });
    }
    const free = i => freeOf(tiles, alive)(i);
    function pairs() { const fr = tiles.filter((t, i) => alive[i] && free(i)), out = []; for (let a = 0; a < fr.length; a++) for (let b = a + 1; b < fr.length; b++) if (match(fr[a], fr[b])) out.push([fr[a].i, fr[b].i]); return out; }
    function render() {
      tiles.forEach((t, i) => { els[i].hidden = !alive[i]; els[i].classList.toggle('sel', i === sel); els[i].classList.toggle('blocked', alive[i] && assist && !free(i)); });
      el.querySelector('.mj-left').textContent = alive.filter(Boolean).length;
      const pc = pairs().length; el.querySelector('.mj-moves').textContent = pc;
      if (!done && pc === 0 && alive.some(Boolean)) { api.toast(L('Žádný tah – zamíchej kameny', 'No moves – shuffle the tiles')); el.querySelector('[data-t="shuffle"]').classList.add('on'); } else el.querySelector('[data-t="shuffle"]').classList.remove('on');
    }
    function tap(i) {
      if (done || !alive[i]) return;
      if (!free(i)) { api.sound('error'); els[i].classList.add('shake'); setTimeout(() => els[i].classList.remove('shake'), 350); return; }
      if (sel < 0 || sel === i) { sel = sel === i ? -1 : i; api.sound('tap'); render(); return; }
      if (match(tiles[sel], tiles[i])) {
        hist.push(alive.slice()); alive[sel] = false; alive[i] = false;
        [sel, i].forEach(k => { els[k].classList.add('gone'); setTimeout(() => els[k].classList.remove('gone'), 300); });
        sel = -1; api.sound('line'); api.changed();
        setTimeout(() => { render(); check(); }, 220);
      } else { sel = i; api.sound('tap'); render(); }
    }
    function check() { if (alive.every(a => !a)) { done = true; setTimeout(() => api.solved(), 300); } }
    function shuffle() {
      // zamíchej zbývající kameny tak, aby šlo pokračovat (stejný postup jako generátor)
      hist.push(alive.slice());
      const idx = tiles.map((t, i) => i).filter(i => alive[i]), kinds = idx.map(i => ({ k: tiles[i].k, v: tiles[i].v }));
      for (let attempt = 0; attempt < 200; attempt++) {
        const al = alive.slice(), fr = freeOf(tiles, al), pairsK = []; const byK = new Map(); kinds.forEach(t => (byK.get(t.k) || byK.set(t.k, []).get(t.k)).push(t));
        for (const l of byK.values()) for (let a = 0; a + 1 < l.length; a += 2) pairsK.push([l[a], l[a + 1]]);
        Kit.shuffle(pairsK, Math.random); let ok = true; const assign = {};
        for (const [a, b] of pairsK) { const f1 = idx.filter(i => al[i] && fr(i)); if (f1.length < 2) { ok = false; break; } const i = f1[Math.floor(Math.random() * f1.length)]; al[i] = false; const f2 = idx.filter(k => al[k] && fr(k)); if (!f2.length) { ok = false; break; } const j = f2[Math.floor(Math.random() * f2.length)]; al[j] = false; assign[i] = a; assign[j] = b; }
        if (ok) { for (const i of idx) { tiles[i].k = assign[i].k; tiles[i].v = assign[i].v; els[i].innerHTML = face(tiles[i].k, tiles[i].v); } api.hint(); api.sound('soft'); sel = -1; render(); api.changed(); return; }
      }
    }
    board.addEventListener('click', e => { const t = e.target.closest('.mj-t'); if (t) tap(+t.dataset.i); });
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t || done) return;
      if (t.dataset.t === 'undo' && hist.length) { alive = hist.pop(); sel = -1; api.hint(); api.sound('erase'); render(); api.changed(); }
      if (t.dataset.t === 'hint') { const pr = pairs(); if (!pr.length) return; api.hint(); pr[0].forEach(k => { els[k].classList.add('hint'); setTimeout(() => els[k].classList.remove('hint'), 1500); }); }
      if (t.dataset.t === 'shuffle') shuffle();
    });
    fit(); addEventListener('resize', fit); render();
    return {
      getState: () => (done ? null : { alive, kinds: tiles.map(t => [t.k, t.v]) }),
      destroy() { removeEventListener('resize', fit); },
      onKey(e) { if (e.key === 'h' || e.key === 'H') el.querySelector('[data-t="hint"]').click(); if ((e.key === 'z' || e.key === 'Z')) el.querySelector('[data-t="undo"]').click(); },
      _solve() { alive = alive.map(() => false); render(); check(); },
    };
  }
  function art(el) {
    const ks = [[0, 0], [10, 0], [31, 0], [22, 0], [34, 1], [28, 0]];
    el.innerHTML = `<div class="mj-art">${ks.map(([k, v], i) => `<div class="mj-t" style="transform:translate(${(i % 3) * 66 + (i > 2 ? 33 : 0)}px, ${Math.floor(i / 3) * 80 + 40}px)">${face(k, v)}</div>`).join('')}</div>`;
  }
  return { DIFFS, generate, create, art, LAYOUTS, freeOf };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'mahjong', title: 'MAHJONG',
  tagline: Kit.L('Odebírej dvojice nebeských kamenů. Hvězdy, planety, komety a souhvězdí, každé rozložení jde dohrát.', 'Remove pairs of celestial tiles. Stars, planets, comets and zodiacs; every layout can be cleared.'),
  diffs: Mahjong.DIFFS, generate: Mahjong.generate, create: Mahjong.create, art: Mahjong.art,
  dailyDiff: () => 'turtle', levelDiff: n => ['pyramid', 'pyramid', 'fortress', 'fortress', 'turtle', 'tower'][Math.floor((n - 1) / 20)],
  rules: Kit.L(`<p>Odeber všechny kameny po dvojicích stejných.</p>
    <ul><li>Odebrat jde jen <b>volný</b> kámen: nic na něm neleží a vlevo nebo vpravo od něj je volno. Zablokované kameny jsou ztmavené (kromě Věže).</li>
    <li><b>Souhvězdí</b> (♈ ♌ ♐ ♒) se párují mezi sebou, stejně tak <b>fáze</b> Měsíce.</li>
    <li>Rozdání jde vždy dohrát. Když uvízneš, <b>Zamíchat</b> rozloží zbylé kameny znovu (počítá se jako nápověda).</li></ul>`,
    `<p>Remove every tile in matching pairs.</p>
    <ul><li>Only a <b>free</b> tile can be removed: nothing on top of it and its left or right side is open. Blocked tiles are dimmed (except in the Tower).</li>
    <li><b>Zodiacs</b> (♈ ♌ ♐ ♒) match each other, and so do Moon <b>phases</b>.</li>
    <li>Every deal can be cleared. If you get stuck, <b>Shuffle</b> rearranges the remaining tiles (counts as a hint).</li></ul>`),
  achievements: [],
});
