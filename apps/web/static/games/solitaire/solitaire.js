'use strict';
// ── SOLITAIRE · Windowling Hlavolamy ────────────────────────────────────────
// Klondike (po 1 / po 3), FreeCell a Pavouk (1 nebo 2 barvy). Rozdání Klondike
// ověřuje řešitel, aby denní výzva a úrovně šly vždy dohrát; FreeCell je řešitelný
// téměř vždy. Karty se táhnou, klepnutí je pošle na nejlepší místo.
const Solitaire = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'klondike1', name: L('Klondike', 'Klondike'), note: L('po 1 kartě', 'draw 1'), par: 5 * 60 },
    { id: 'freecell', name: 'FreeCell', note: L('4 volná pole', '4 free cells'), par: 6 * 60 },
    { id: 'klondike3', name: L('Klondike 3', 'Klondike 3'), note: L('po 3 kartách', 'draw 3'), par: 7 * 60 },
    { id: 'spider2', name: L('Pavouk', 'Spider'), note: L('2 barvy', '2 suits'), par: 12 * 60 },
    { id: 'spider1', name: L('Pavouk 1', 'Spider 1'), note: L('1 barva', '1 suit'), par: 8 * 60 },
  ];
  const SUITS = ['♠', '♥', '♦', '♣'], RED = s => s === 1 || s === 2, RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function deck(r, suits = [0, 1, 2, 3], copies = 1) { const d = []; let id = 0; for (let c = 0; c < copies; c++) for (const s of suits) for (let k = 1; k <= 13; k++) d.push({ id: id++, s, r: k, up: false }); return Kit.shuffle(d, r); }
  function deal(mode, r) {
    if (mode.startsWith('klondike')) {
      const d = deck(r), t = [...Array(7)].map(() => []);
      for (let c = 0; c < 7; c++) for (let k = 0; k <= c; k++) { const x = d.pop(); x.up = k === c; t[c].push(x); }
      return { mode, stock: d, waste: [], f: [[], [], [], []], t, cells: [], draw: mode === 'klondike3' ? 3 : 1 };
    }
    if (mode === 'freecell') { const d = deck(r), t = [...Array(8)].map(() => []); d.forEach((x, i) => { x.up = true; t[i % 8].push(x); }); return { mode, stock: [], waste: [], f: [[], [], [], []], t, cells: [null, null, null, null] }; }
    const suits = mode === 'spider1' ? [0, 0, 0, 0] : [0, 1, 0, 1];
    const d = deck(r, suits, 2), t = [...Array(10)].map(() => []);
    for (let i = 0; i < 54; i++) { const x = d.pop(); t[i % 10].push(x); }
    t.forEach(c => { c[c.length - 1].up = true; });
    return { mode, stock: d, waste: [], f: [], t, cells: [] };
  }

  // ── Pravidla ──
  const top = a => a[a.length - 1];
  function canStack(mode, a, b) { // může karta a na kartu b v tablu
    if (!b) return mode.startsWith('klondike') ? a.r === 13 : true;
    if (mode.startsWith('spider')) return a.r === b.r - 1;
    return a.r === b.r - 1 && RED(a.s) !== RED(b.s);
  }
  function seqOk(mode, cards) { // smí se táhnout jako celek
    for (let i = 1; i < cards.length; i++) {
      const a = cards[i], b = cards[i - 1];
      if (!a.up || a.r !== b.r - 1) return false;
      if (mode.startsWith('spider') ? a.s !== b.s : RED(a.s) === RED(b.s)) return false;
    }
    return cards.length > 0 && cards[0].up;
  }
  const fOk = (S, c, i) => { const f = S.f[i]; return f.length ? top(f).s === c.s && top(f).r === c.r - 1 : c.r === 1; };
  function freecellMax(S, toEmpty) { const cells = S.cells.filter(x => !x).length, empty = S.t.filter(c => !c.length).length - (toEmpty ? 1 : 0); return (cells + 1) * 2 ** Math.max(0, empty); }

  // ── Řešitel Klondike (DFS s pamětí stavů) ──
  function klondikeWinnable(S0, limit = 25000) {
    const cp = a => a.map(x => ({ ...x }));
    const clone = S => ({ stock: cp(S.stock), waste: cp(S.waste), f: S.f.map(cp), t: S.t.map(c => c.map(x => ({ ...x }))), draw: S.draw, mode: S.mode, cells: [] });
    const key = S => S.f.map(f => f.length).join(',') + '|' + S.t.map(c => c.map(x => (x.up ? x.id : 'x')).join('.')).join('/') + '|' + S.stock.length + ':' + S.waste.length;
    const seen = new Set(); let nodes = 0;
    function rec(S) {
      if (S.f.every(f => f.length === 13)) return true;
      if (++nodes > limit) return false;
      const k = key(S); if (seen.has(k)) return false; seen.add(k);
      // automaticky na základnu (bezpečné tahy)
      for (const m of moves(S)) { const N = clone(S); apply(N, m); if (rec(N)) return true; }
      return false;
    }
    function moves(S) {
      const out = [];
      const src = [...S.t.map((c, i) => ({ k: 't', i, c: top(c) })), { k: 'w', c: top(S.waste) }].filter(x => x.c && x.c.up);
      for (const x of src) for (let f = 0; f < 4; f++) if (fOk(S, x.c, f)) out.push({ from: x.k, i: x.i, n: 1, to: 'f', j: f, p: 0 });
      S.t.forEach((c, i) => {
        const first = c.findIndex(x => x.up); if (first < 0) return;
        for (let s = first; s < c.length; s++) {
          if (!seqOk(S.mode, c.slice(s))) continue;
          S.t.forEach((d, j) => { if (i !== j && canStack(S.mode, c[s], top(d)) && !(s === 0 && !d.length)) out.push({ from: 't', i, n: c.length - s, to: 't', j, p: s === first && first > 0 ? 1 : 3 }); });
        }
      });
      const w = top(S.waste); if (w) S.t.forEach((d, j) => { if (canStack(S.mode, w, top(d))) out.push({ from: 'w', n: 1, to: 't', j, p: 2 }); });
      if (S.stock.length || S.waste.length) out.push({ from: 's', p: 4 });
      return out.sort((a, b) => a.p - b.p);
    }
    function apply(S, m) {
      if (m.from === 's') { if (!S.stock.length) { S.stock = S.waste.reverse().map(x => ({ ...x, up: false })); S.waste = []; } else for (let k = 0; k < S.draw && S.stock.length; k++) { const x = S.stock.pop(); x.up = true; S.waste.push(x); } return; }
      const cards = m.from === 'w' ? [S.waste.pop()] : S.t[m.i].splice(S.t[m.i].length - m.n, m.n);
      if (m.from === 't' && S.t[m.i].length) top(S.t[m.i]).up = true;
      if (m.to === 'f') S.f[m.j].push(...cards); else S.t[m.j].push(...cards);
    }
    return rec(clone(S0));
  }

  function generate(seed, diffId, ctx = {}) {
    let mode = diffId;
    if (ctx.kind === 'daily') mode = 'klondike1';
    if (ctx.kind === 'level') mode = levelMode(ctx.key);
    // Klondike: hledej rozdání, které řešitel dohraje
    for (let attempt = 0; attempt < 40; attempt++) {
      const r = Kit.rng(seed + attempt * 7919), S = deal(mode, r);
      if (!mode.startsWith('klondike') || klondikeWinnable(S, mode === 'klondike3' ? 40000 : 25000)) return { seed: seed + attempt * 7919, mode, S: JSON.stringify(S) };
    }
    const r = Kit.rng(seed); return { seed, mode, S: JSON.stringify(deal(mode, r)) };
  }
  function levelMode(n) { const ch = Math.floor((n - 1) / 20), k = (n - 1) % 20; return [['klondike1', 'freecell'], ['klondike1', 'freecell', 'spider1'], ['klondike3', 'freecell', 'spider1'], ['klondike3', 'spider2', 'freecell'], ['spider2', 'klondike3', 'freecell'], ['spider2', 'klondike3', 'spider2']][ch][k % [2, 3, 3, 3, 3, 3][ch]]; }

  // ── Kresba karet (SVG 100×140, symboly ve sdíleném skrytém <svg>) ──
  function defs() {
    if (document.getElementById('slDefs')) return;
    const d = document.createElement('div');
    d.innerHTML = `<svg id="slDefs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <linearGradient id="slRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9617f"/><stop offset="1" stop-color="#a3304f"/></linearGradient>
      <linearGradient id="slBlk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4478"/><stop offset="1" stop-color="#262150"/></linearGradient>
      <linearGradient id="slGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".5" stop-color="#e8c574"/><stop offset="1" stop-color="#b8892e"/></linearGradient>
      <linearGradient id="slFaceR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eadbd8"/><stop offset="1" stop-color="#dcc3c4"/></linearGradient>
      <linearGradient id="slFaceB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcdbe6"/><stop offset="1" stop-color="#c6c5da"/></linearGradient>
      <radialGradient id="slBackG" cx=".5" cy=".35" r=".9"><stop offset="0" stop-color="#4b33b8"/><stop offset=".55" stop-color="#241466"/><stop offset="1" stop-color="#0d0830"/></radialGradient>
      <pattern id="slLat" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 5h10M5 0v10" stroke="#e8c574" stroke-width=".6" opacity=".35"/></pattern>
      <symbol id="slS0" viewBox="0 0 20 20"><path d="M10 1.2C8 4 2 7.6 2 11.6c0 2.7 2 4.5 4.4 4.5 1.4 0 2.6-.7 3.2-1.6-.3 2-1.2 3.4-2.8 4.3h6.4c-1.6-.9-2.5-2.3-2.8-4.3.6.9 1.8 1.6 3.2 1.6 2.4 0 4.4-1.8 4.4-4.5C18 7.6 12 4 10 1.2z"/></symbol>
      <symbol id="slS1" viewBox="0 0 20 20"><path d="M10 18C4.2 13.6 1.2 10.2 1.2 6.6 1.2 3.8 3.3 1.8 5.9 1.8c1.8 0 3.2 1 4.1 2.5.9-1.5 2.3-2.5 4.1-2.5 2.6 0 4.7 2 4.7 4.8 0 3.6-3 7-8.8 11.4z"/></symbol>
      <symbol id="slS2" viewBox="0 0 20 20"><path d="M10 .8 17.6 10 10 19.2 2.4 10z"/></symbol>
      <symbol id="slS3" viewBox="0 0 20 20"><circle cx="10" cy="5.6" r="4.2"/><circle cx="5" cy="11.2" r="4.2"/><circle cx="15" cy="11.2" r="4.2"/><path d="M9 10.5 7.6 18.8h4.8L11 10.5z"/></symbol>
      <symbol id="slBack" viewBox="0 0 100 140"><rect width="100" height="140" rx="9" fill="url(#slBackG)"/><rect width="100" height="140" rx="9" fill="url(#slLat)"/>
        <rect x="6" y="6" width="88" height="128" rx="6" fill="none" stroke="url(#slGold)" stroke-width="1.6"/><rect x="10" y="10" width="80" height="120" rx="4" fill="none" stroke="#e8c574" stroke-width=".6" opacity=".6"/>
        <circle cx="50" cy="70" r="21" fill="#140c44" stroke="url(#slGold)" stroke-width="1.6"/><path d="M50 52 54 66 68 70 54 74 50 88 46 74 32 70 46 66z" fill="url(#slGold)"/><circle cx="50" cy="70" r="3.5" fill="#fff6d8"/>
        <circle cx="24" cy="26" r="1.3" fill="#fff"/><circle cx="76" cy="30" r="1" fill="#fff"/><circle cx="28" cy="112" r="1" fill="#fff"/><circle cx="74" cy="114" r="1.4" fill="#fff"/></symbol>
    </defs></svg>`;
    document.body.appendChild(d.firstChild);
  }
  // rozložení symbolů 2–10 (dolní polovina se otáčí)
  const PIPS = { 2: [[50, 29], [50, 111]], 3: [[50, 29], [50, 70], [50, 111]], 4: [[34, 29], [66, 29], [34, 111], [66, 111]], 5: [[34, 29], [66, 29], [50, 70], [34, 111], [66, 111]],
    6: [[34, 29], [66, 29], [34, 70], [66, 70], [34, 111], [66, 111]], 7: [[34, 29], [66, 29], [50, 48], [34, 70], [66, 70], [34, 111], [66, 111]],
    8: [[34, 29], [66, 29], [50, 48], [34, 70], [66, 70], [50, 92], [34, 111], [66, 111]], 9: [[34, 29], [66, 29], [34, 55], [66, 55], [50, 70], [34, 85], [66, 85], [34, 111], [66, 111]],
    10: [[34, 29], [66, 29], [50, 39], [34, 55], [66, 55], [34, 85], [66, 85], [50, 101], [34, 111], [66, 111]] };
  const EMBLEM = {
    11: '<path d="M0-13 3.4-3.4 13 0 3.4 3.4 0 13-3.4 3.4-13 0-3.4-3.4z"/><circle r="2.6" fill="#fff"/>',
    12: '<path d="M5-13a13 13 0 1 0 0 26a10 10 0 1 1 0-26z"/><path d="M9-6 10.4-2.4 14-1 10.4.4 9 4 7.6.4 4-1 7.6-2.4z"/>',
    13: '<path d="M-15 7-17-9-7.5-1.5 0-14 7.5-1.5 17-9 15 7z"/><rect x="-15" y="8" width="30" height="4.5" rx="1.5"/><circle cy="-14" r="2.4"/>',
  };
  function cardSvg(r, s) {
    const fill = RED(s) ? 'url(#slRed)' : 'url(#slBlk)', sym = `#slS${s}`;
    const pip = (x, y, w, flip) => `<use href="${sym}" x="${x - w / 2}" y="${y - w / 2}" width="${w}" height="${w}"${flip ? ` transform="rotate(180 ${x} ${y})"` : ''}/>`;
    const corner = `<text x="12" y="24" class="sl-rk" text-anchor="middle">${RANK[r]}</text>${pip(12, 35, 13)}`;
    let mid;
    if (r === 1) mid = `<circle cx="50" cy="70" r="27" fill="none" stroke="url(#slGold)" stroke-width="1.2" opacity=".8"/>${pip(50, 70, 40)}`;
    else if (r <= 10) mid = PIPS[r].map(([x, y]) => pip(x, y, r >= 9 ? 15 : 17, y > 72)).join('');
    else mid = `<rect x="22" y="17" width="56" height="106" rx="6" fill="${RED(s) ? 'url(#slFaceR)' : 'url(#slFaceB)'}" stroke="url(#slGold)" stroke-width="1.4"/>
      <g transform="translate(50 46)">${EMBLEM[r]}</g><text x="50" y="96" class="sl-fc" text-anchor="middle">${RANK[r]}</text>${pip(50, 110, 11)}`;
    return `<svg viewBox="0 0 100 140" class="sl-f" fill="${fill}"><g class="sl-pips">${mid}</g><g class="sl-big">${r > 10 ? `<text x="50" y="96" class="sl-fc" text-anchor="middle">${RANK[r]}</text>` : pip(50, 82, r === 1 ? 46 : 36)}</g>${corner}<g transform="rotate(180 50 70)">${corner}</g></svg>`;
  }
  const BACK = '<svg viewBox="0 0 100 140" class="sl-f"><use href="#slBack"/></svg>';

  // ── Hrací plocha ──
  function create(el, P, saved, api) {
    defs();
    const mode = P.mode, spider = mode.startsWith('spider'), klon = mode.startsWith('klondike'), fc = mode === 'freecell';
    let S = saved && saved.S ? saved.S : JSON.parse(P.S), hist = saved && saved.hist ? saved.hist : [], moves = saved && saved.moves || 0, done = false;
    el.innerHTML = `<div class="sl-wrap ${mode}"><div class="sl-head"><div><small>${L('TAHY', 'MOVES')}</small><b class="sl-moves">0</b></div><div><small>${spider ? L('HOTOVÉ ŘADY', 'RUNS') : L('NA ZÁKLADNÁCH', 'HOME')}</small><b class="sl-home">0</b></div><div class="sl-mode">${(DIFFS.find(d => d.id === mode) || {}).name || mode}</div></div>
      <div class="sl-table"></div>
      <div class="k-tools"><button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button><button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button></div></div>`;
    const table = el.querySelector('.sl-table');
    const cols = spider ? 10 : fc ? 8 : 7;
    let cw = 80, chh = 112, gap = 8, pos = {}, dealing = !saved, autoOn = false;
    const pend = new Map();
    const cardEls = new Map();
    function size() {
      const vw = Math.min((document.getElementById('kView') || el).clientWidth - 20, 1000);
      gap = vw < 500 ? 4 : 8;
      cw = Math.floor(Math.min(96, (vw - gap * (cols + 1)) / cols)); chh = Math.round(cw * 1.4);
      table.style.width = (cw * cols + gap * (cols + 1)) + 'px';
      table.style.setProperty('--cw', cw + 'px'); table.style.setProperty('--ch', chh + 'px');
      table.classList.toggle('small', cw < 62);
    }
    // místa hromádek
    function slots() {
      const s = {}; const x = i => gap + i * (cw + gap);
      if (klon) { s.stock = [x(0), gap]; s.waste = [x(1), gap]; for (let i = 0; i < 4; i++) s['f' + i] = [x(3 + i), gap]; }
      if (fc) { for (let i = 0; i < 4; i++) { s['c' + i] = [x(i), gap]; s['f' + i] = [x(4 + i), gap]; } }
      if (spider) { s.stock = [x(9), gap]; s.f = [x(0), gap]; }
      const ty = gap * 2 + chh + (spider ? 0 : 6);
      for (let i = 0; i < cols; i++) s['t' + i] = [x(i), ty];
      return s;
    }
    function layout() {
      size(); const s = slots(); pos = {};
      const maxH = Math.max(innerHeight - 260, chh * 3), ty = s.t0[1];
      // hromádky (rámečky)
      let frames = '';
      const mark = k => (k === 'stock' ? '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : k[0] === 'f' ? '<svg viewBox="0 0 24 24"><path d="M12 3 14 10 21 12 14 14 12 21 10 14 3 12 10 10z" fill="currentColor"/></svg>' : '');
      for (const [k, [x, y]] of Object.entries(s)) frames += `<div class="sl-slot ${k[0]} ${k === 'stock' ? 'stock' : ''}" data-p="${k}" style="left:${x}px;top:${y}px">${mark(k)}</div>`;
      table.querySelectorAll('.sl-slot').forEach(e => e.remove()); table.insertAdjacentHTML('afterbegin', frames);
      const place = (c, x, y, z) => { pos[c.id] = { x, y, z }; };
      if (klon) {
        S.stock.forEach((c, k) => place(c, s.stock[0], s.stock[1], k));
        const w = S.waste, show = S.draw === 3 ? 3 : 1; w.forEach((c, k) => place(c, s.waste[0] + Math.max(0, k - (w.length - show)) * cw * 0.22, s.waste[1], 100 + k));
      }
      if (spider) { S.stock.forEach((c, k) => place(c, s.stock[0] - Math.floor(k / 10) * 6, s.stock[1], k)); S.f.forEach((run, k) => run.forEach((c, j) => place(c, s.f[0] + k * Math.min(14, cw * 0.18), s.f[1], 10 + k * 13 + j))); }
      if (!spider) S.f.forEach((f, i) => f.forEach((c, k) => place(c, s['f' + i][0], s['f' + i][1], 200 + k)));
      if (fc) S.cells.forEach((c, i) => c && place(c, s['c' + i][0], s['c' + i][1], 300));
      S.t.forEach((col, i) => {
        const down = col.filter(c => !c.up).length, up = col.length - down;
        let dUp = chh * 0.3, dDown = chh * 0.14;
        const need = ty + down * dDown + Math.max(0, up - 1) * dUp + chh;
        if (need > ty + maxH) { const k = (maxH - chh - down * dDown) / Math.max(1, up - 1); dUp = Math.max(chh * 0.12, Math.min(dUp, k)); }
        let y = s['t' + i][1]; col.forEach((c, k) => { place(c, s['t' + i][0], y, 400 + k); y += c.up ? dUp : dDown; });
      });
      table.style.height = Math.max(...Object.values(pos).map(p => p.y + chh), ty + chh) + gap + 'px';
      // karty
      const all = [...S.stock, ...S.waste, ...S.t.flat(), ...(spider ? S.f.flat() : S.f.flat()), ...S.cells.filter(Boolean)];
      const live = new Set(all.map(c => c.id));
      for (const c of all) {
        let e = cardEls.get(c.id);
        const p = pos[c.id];
        if (!e) {
          e = document.createElement('div'); e.className = 'sl-card'; e.dataset.id = c.id; table.appendChild(e); cardEls.set(c.id, e);
          // rozdání: karty přiletí z balíčku
          if (dealing) { const st = s.stock || s.t0; e.style.transition = 'none'; e.style.transform = `translate(${st[0]}px, ${st[1]}px)`; pend.set(e, pend.size); }
        }
        if (!pend.has(e)) e.style.transform = `translate(${p.x}px, ${p.y}px)`;
        e.style.zIndex = p.z;
        const face = c.up ? `${c.r}${c.s}` : 'b';
        if (e.dataset.f !== face) { e.dataset.f = face; e.classList.toggle('up', c.up); e.classList.toggle('red', RED(c.s)); e.innerHTML = c.up ? cardSvg(c.r, c.s) : BACK; if (c.up && !dealing) { e.classList.add('turn'); setTimeout(() => e.classList.remove('turn'), 320); } }
      }
      if (dealing) {
        dealing = false;
        requestAnimationFrame(() => requestAnimationFrame(() => { pend.forEach((k, e) => { const p = pos[+e.dataset.id]; e.style.transition = ''; e.style.transitionDelay = `${Math.min(k * 14, 900)}ms`; if (p) e.style.transform = `translate(${p.x}px, ${p.y}px)`; setTimeout(() => { e.style.transitionDelay = ''; }, 1500); }); pend.clear(); }));
      }
      for (const [id, e] of cardEls) if (!live.has(id)) { e.remove(); cardEls.delete(id); }
      el.querySelector('.sl-moves').textContent = moves;
      el.querySelector('.sl-home').textContent = spider ? `${S.f.length} / 8` : `${S.f.reduce((a, f) => a + f.length, 0)} / 52`;
    }
    // najdi kartu a její hromádku
    function locate(id) {
      for (let i = 0; i < S.t.length; i++) { const k = S.t[i].findIndex(c => c.id === id); if (k >= 0) return { p: 't', i, k }; }
      if (S.waste.length && top(S.waste).id === id) return { p: 'w', k: S.waste.length - 1 };
      for (let i = 0; i < S.cells.length; i++) if (S.cells[i] && S.cells[i].id === id) return { p: 'c', i };
      if (!spider) for (let i = 0; i < 4; i++) if (S.f[i].length && top(S.f[i]).id === id) return { p: 'f', i };
      if (S.stock.some(c => c.id === id)) return { p: 's' };
      return null;
    }
    function picked(loc) {
      if (loc.p === 't') return S.t[loc.i].slice(loc.k);
      if (loc.p === 'w') return [top(S.waste)];
      if (loc.p === 'c') return [S.cells[loc.i]];
      if (loc.p === 'f') return [top(S.f[loc.i])];
      return [];
    }
    function legal(loc, dest) {
      const cards = picked(loc); if (!cards.length || !seqOk(mode, cards)) return false;
      if (dest.p === 'f') return !spider && cards.length === 1 && fOk(S, cards[0], dest.i);
      if (dest.p === 'c') return fc && cards.length === 1 && !S.cells[dest.i];
      if (dest.p === 't') {
        if (loc.p === 't' && loc.i === dest.i) return false;
        const d = S.t[dest.i];
        if (fc && cards.length > freecellMax(S, !d.length)) return false;
        return canStack(mode, cards[0], top(d));
      }
      return false;
    }
    const snapshot = () => JSON.stringify({ S, moves });
    function move(loc, dest) {
      hist.push(snapshot()); if (hist.length > 300) hist.shift();
      const cards = loc.p === 't' ? S.t[loc.i].splice(loc.k) : loc.p === 'w' ? [S.waste.pop()] : loc.p === 'c' ? [S.cells[loc.i]] : [S.f[loc.i].pop()];
      if (loc.p === 'c') S.cells[loc.i] = null;
      if (dest.p === 'f') S.f[dest.i].push(...cards); else if (dest.p === 'c') S.cells[dest.i] = cards[0]; else S.t[dest.i].push(...cards);
      if (loc.p === 't' && S.t[loc.i].length && !top(S.t[loc.i]).up) { top(S.t[loc.i]).up = true; }
      moves++;
      if (spider && dest.p === 't') collectRun(dest.i);
      api.sound(dest.p === 'f' ? 'line' : 'place'); after();
    }
    function collectRun(i) {
      const c = S.t[i]; if (c.length < 13) return;
      const run = c.slice(-13); if (run[0].r === 13 && seqOk(mode, run) && run[12].r === 1) { S.t[i].splice(-13); S.f.push(run); if (S.t[i].length) top(S.t[i]).up = true; api.sound('win'); }
    }
    function drawStock() {
      if (klon) {
        hist.push(snapshot());
        if (!S.stock.length) { if (!S.waste.length) { hist.pop(); return; } S.stock = S.waste.reverse().map(x => ({ ...x, up: false })); S.waste = []; }
        else for (let k = 0; k < S.draw && S.stock.length; k++) { const x = S.stock.pop(); x.up = true; S.waste.push(x); }
        moves++; api.sound('soft'); after();
      } else if (spider && S.stock.length) {
        if (S.t.some(c => !c.length)) { api.toast(L('Nejdřív zaplň prázdné sloupce', 'Fill the empty columns first')); return; }
        hist.push(snapshot());
        for (let i = 0; i < 10 && S.stock.length; i++) { const x = S.stock.pop(); x.up = true; S.t[i].push(x); }
        for (let i = 0; i < 10; i++) collectRun(i);
        moves++; api.sound('place'); after();
      }
    }
    // nejlepší cíl pro klepnutí
    function bestDest(loc) {
      const cards = picked(loc);
      if (!spider && cards.length === 1) for (let i = 0; i < 4; i++) if (legal(loc, { p: 'f', i })) return { p: 'f', i };
      const opts = []; for (let i = 0; i < S.t.length; i++) if (legal(loc, { p: 't', i })) opts.push({ p: 't', i, score: (S.t[i].length ? 10 : 0) + (spider && top(S.t[i]) && top(S.t[i]).s === cards[0].s ? 5 : 0) });
      opts.sort((a, b) => b.score - a.score); if (opts.length) return opts[0];
      if (fc && cards.length === 1) for (let i = 0; i < 4; i++) if (!S.cells[i]) return { p: 'c', i };
      return null;
    }
    function after() { layout(); api.changed(); autoFoundation(); check(); autoFinish(); }
    // Když už nic neleží lícem dolů (Klondike) nebo jsou všechny sloupce seřazené (FreeCell), hra se dohraje sama.
    function canFinish() {
      if (done) return false;
      if (klon) return S.t.every(c => c.every(x => x.up));
      if (fc) return S.t.every(c => c.every((x, k) => !k || x.r < c[k - 1].r));
      return false;
    }
    function autoFinish() {
      if (autoOn || !canFinish()) return;
      autoOn = true; table.classList.add('auto');
      let idle = 0;
      const step = () => {
        if (done) { autoOn = false; return; }
        const locs = S.t.map((c, i) => ({ p: 't', i, k: c.length - 1 })).filter(l => l.k >= 0);
        if (S.waste.length) locs.push({ p: 'w', k: S.waste.length - 1 });
        if (fc) S.cells.forEach((c, i) => { if (c) locs.push({ p: 'c', i }); });
        locs.sort((a, b) => picked(a)[0].r - picked(b)[0].r);
        for (const loc of locs) for (let i = 0; i < 4; i++) if (legal(loc, { p: 'f', i })) { move(loc, { p: 'f', i }); idle = 0; setTimeout(step, 85); return; }
        if (klon && (S.stock.length || S.waste.length) && idle <= S.stock.length + S.waste.length + 2) { idle++; drawStock(); setTimeout(step, 55); return; }
        autoOn = false; table.classList.remove('auto'); // uvízlo (Klondike 3) – dohraje hráč
      };
      setTimeout(step, 350);
    }
    function autoFoundation() { // FreeCell: bezpečné karty samy na základnu
      if (!fc) return;
      // bezpečné: dvojky vždy, jinak když obě opačné barvy mají aspoň r-1 karet
      const safe = c => { if (c.r <= 2) return true; const opp = S.f.filter(f => f.length && RED(top(f).s) !== RED(c.s)).map(f => f.length); return opp.length === 2 && Math.min(...opp) >= c.r - 1; };
      for (let guard = 0; guard < 52; guard++) {
        let moved = false;
        const cand = [...S.t.map((c, i) => ({ p: 't', i, k: c.length - 1, c: top(c) })), ...S.cells.map((c, i) => ({ p: 'c', i, c }))].filter(x => x.c);
        for (const x of cand) { if (!safe(x.c)) continue; for (let i = 0; i < 4; i++) if (fOk(S, x.c, i)) { const loc = x.p === 't' ? { p: 't', i: x.i, k: x.k } : { p: 'c', i: x.i }; const cards = loc.p === 't' ? S.t[loc.i].splice(loc.k) : [S.cells[loc.i]]; if (loc.p === 'c') S.cells[loc.i] = null; S.f[i].push(...cards); moved = true; break; } if (moved) break; }
        if (!moved) break;
      }
      layout();
    }
    function check() {
      const won = spider ? S.f.length === 8 : S.f.every(f => f.length === 13);
      if (!won || done) return; done = true;
      const t = api.time, par = (DIFFS.find(d => d.id === mode) || {}).par || 400, mPar = spider ? 220 : fc ? 110 : 140;
      const stars = api.kind === 'level' ? (moves <= mPar && t <= par ? 3 : moves <= mPar * 1.5 ? 2 : 1) : undefined;
      cardEls.forEach((e, id) => setTimeout(() => e.classList.add('fly'), (id % 13) * 40));
      setTimeout(() => api.solved({ stars, html: `<p class="k-muted">${L(`Tahy: ${moves}`, `Moves: ${moves}`)}</p>` }), 1300);
    }
    function hint() {
      for (const [, e] of cardEls) e.classList.remove('hint');
      const locs = [];
      S.t.forEach((c, i) => c.forEach((x, k) => { if (x.up) locs.push({ p: 't', i, k }); }));
      if (S.waste.length) locs.push({ p: 'w', k: S.waste.length - 1 });
      S.cells.forEach((c, i) => { if (c) locs.push({ p: 'c', i }); });
      for (const loc of locs) {
        const d = bestDest(loc); if (!d) continue;
        if (loc.p === 't' && d.p === 't' && loc.k === 0 && !S.t[d.i].length) continue; // zbytečný přesun
        if (loc.p === 't' && d.p === 't' && loc.k > 0 && S.t[loc.i][loc.k - 1].up && canStack(mode, S.t[loc.i][loc.k], S.t[loc.i][loc.k - 1]) && !spider) continue;
        api.hint(); const ids = picked(loc).map(c => c.id); ids.forEach(id => cardEls.get(id).classList.add('hint')); setTimeout(() => ids.forEach(id => cardEls.get(id) && cardEls.get(id).classList.remove('hint')), 1600); return;
      }
      if (S.stock.length || (klon && S.waste.length)) { api.hint(); table.querySelector('[data-p="stock"]').classList.add('hint'); setTimeout(() => { const s = table.querySelector('[data-p="stock"]'); if (s) s.classList.remove('hint'); }, 1600); return; }
      api.toast(L('Žádný užitečný tah. Zkus Zpět.', 'No useful move. Try Undo.'));
    }
    // ── Táhnutí ──
    let drag = null;
    table.addEventListener('pointerdown', e => {
      if (done || autoOn) return;
      const ce = e.target.closest('.sl-card'), slot = e.target.closest('.sl-slot');
      if ((ce && locate(+ce.dataset.id) && locate(+ce.dataset.id).p === 's') || (slot && slot.dataset.p === 'stock' && !ce)) { drawStock(); return; }
      if (!ce) return;
      const loc = locate(+ce.dataset.id); if (!loc || loc.p === 's') return;
      const cards = picked(loc); if (!seqOk(mode, cards)) return;
      e.preventDefault(); table.setPointerCapture(e.pointerId);
      drag = { loc, cards, x0: e.clientX, y0: e.clientY, moved: false, els: cards.map(c => cardEls.get(c.id)) };
    });
    table.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      drag.els.forEach((ce, k) => { const p = pos[drag.cards[k].id]; ce.classList.add('drag'); ce.style.transform = `translate(${p.x + dx}px, ${p.y + dy}px)`; ce.style.zIndex = 1000 + k; });
      const t = target(drag, dx, dy);
      table.querySelectorAll('.drop').forEach(x => x.classList.remove('drop'));
      if (t) { const top_ = t.p === 't' ? top(S.t[t.i]) : t.p === 'f' ? top(S.f[t.i]) : S.cells[t.i]; const tel = top_ ? cardEls.get(top_.id) : table.querySelector(`[data-p="${t.p === 'c' ? 'c' : t.p}${t.i}"]`); if (tel) tel.classList.add('drop'); }
    });
    // nejbližší povolený cíl pro přetahovanou kartu
    function target(d, dx, dy) {
      const p = pos[d.cards[0].id], cx = p.x + dx + cw / 2, cy = p.y + dy + chh / 2;
      const s = slots(); let best = null, bd = 1e9;
      const cand = [];
      for (let i = 0; i < S.t.length; i++) { const t = top(S.t[i]); const tp = t ? pos[t.id] : { x: s['t' + i][0], y: s['t' + i][1] }; cand.push({ dest: { p: 't', i }, x: tp.x, y: tp.y }); }
      if (!spider) for (let i = 0; i < 4; i++) cand.push({ dest: { p: 'f', i }, x: s['f' + i][0], y: s['f' + i][1] });
      if (fc) for (let i = 0; i < 4; i++) cand.push({ dest: { p: 'c', i }, x: s['c' + i][0], y: s['c' + i][1] });
      for (const c of cand) { const dd = Math.hypot(c.x + cw / 2 - cx, c.y + chh / 2 - cy); if (dd < bd && dd < cw * 1.3 && legal(d.loc, c.dest)) { bd = dd; best = c.dest; } }
      return best;
    }
    table.addEventListener('pointerup', e => {
      if (!drag) return; const d = drag; drag = null;
      d.els.forEach(ce => ce.classList.remove('drag'));
      table.querySelectorAll('.drop').forEach(x => x.classList.remove('drop'));
      if (!d.moved) { const dest = bestDest(d.loc); if (dest) move(d.loc, dest); else { api.sound('error'); layout(); } return; }
      const best = target(d, e.clientX - d.x0, e.clientY - d.y0);
      if (best) move(d.loc, best); else { api.sound('soft'); layout(); }
    });
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t || done) return;
      if (t.dataset.t === 'undo' && hist.length) { const h = JSON.parse(hist.pop()); S = h.S; moves = h.moves; api.hint(); api.sound('erase'); layout(); api.changed(); }
      if (t.dataset.t === 'hint') hint();
    });
    addEventListener('resize', layout);
    layout(); autoFoundation(); autoFinish();
    return {
      getState: () => (done ? null : { S, hist: hist.slice(-60), moves }),
      progress: () => S.f.reduce((a, f) => a + f.length, 0) / (S.f.length * 13),
      destroy() { removeEventListener('resize', layout); },
      onKey(e) { if ((e.key === 'z' || e.key === 'Z') && hist.length) el.querySelector('[data-t="undo"]').click(); if (e.key === 'h' || e.key === 'H') hint(); if (e.key === ' ' ) { e.preventDefault(); drawStock(); } },
      _solve() { if (spider) { S.f = [...Array(8)].map(() => []); } else S.f = S.f.map((_, i) => [...Array(13)].map((__, k) => ({ id: 900 + i * 13 + k, s: i, r: k + 1, up: true }))); S.t = S.t.map(() => []); S.stock = []; S.waste = []; S.cells = S.cells.map(() => null); layout(); check(); },
    };
  }

  function art(el) {
    defs();
    let h = '<div class="sl-art">';
    [[13, 0], [12, 1], [11, 3], [1, 2], [10, 1]].forEach(([r, s], k) => { h += `<div class="sl-card up ${RED(s) ? 'red' : ''}" style="transform:translate(${20 + k * 36}px, ${40 + Math.abs(2 - k) * 14}px) rotate(${(k - 2) * 9}deg)">${cardSvg(r, s)}</div>`; });
    el.innerHTML = h + '</div>';
  }
  return { DIFFS, generate, create, art, deal, klondikeWinnable, levelMode };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'solitaire', title: 'SOLITAIRE', wording: 'win',
  tagline: Kit.L('Klondike, FreeCell a Pavouk pod hvězdami. Rozdání Klondike, která jdou vždy dohrát, a denní partie pro všechny.', 'Klondike, FreeCell and Spider under the stars. Klondike deals that can always be won, and a daily deal for everyone.'),
  diffs: Solitaire.DIFFS, generate: Solitaire.generate, create: Solitaire.create, art: Solitaire.art,
  online: { kind: 'race' },
  dailyDiff: () => 'klondike1', levelDiff: n => Solitaire.levelMode(n),
  rules: Kit.L(`<p>Přesuň všechny karty na <b>základny</b> podle barev od esa po krále.</p>
    <ul><li><b>Klondike:</b> v sloupcích skládej sestupně se střídáním červené a černé. Na prázdný sloupec jen král. Klepnutím na balíček otočíš další kartu (nebo tři).</li>
    <li><b>FreeCell:</b> všechny karty jsou vidět, máš 4 volná pole na odložení. Kolik karet přesuneš najednou, záleží na volných polích.</li>
    <li><b>Pavouk:</b> skládej sestupně v jedné barvě od krále po eso. Hotová řada sama odejde. Balíček rozdá do každého sloupce jednu kartu.</li>
    <li>Karty táhni, nebo na ně klepni a hra je pošle na nejlepší místo. <b>Zpět</b> a <b>Nápověda</b> se počítají do hvězd.</li>
    <li>Jakmile v Klondike nic neleží lícem dolů (ve FreeCell jsou všechny sloupce seřazené), hra se dohraje sama.</li>
    <li>Každé rozdání Klondike na denní výzvě a na Cestě jde dohrát.</li></ul>`,
    `<p>Move every card to the <b>foundations</b> by suit, from ace to king.</p>
    <ul><li><b>Klondike:</b> build columns down in alternating colours. Only a king goes to an empty column. Tap the stock to turn one card (or three).</li>
    <li><b>FreeCell:</b> every card is visible and you have 4 free cells. How many cards you can move at once depends on free spaces.</li>
    <li><b>Spider:</b> build down in one suit from king to ace; a complete run leaves by itself. The stock deals one card to every column.</li>
    <li>Drag cards, or tap one and the game sends it to the best place. <b>Undo</b> and <b>Hint</b> count against stars.</li>
    <li>Once no Klondike card is face down (or every FreeCell column is in order), the game finishes itself.</li>
    <li>Every Klondike deal in the daily and on the Path can be won.</li></ul>`),
  achievements: [],
});
