'use strict';
// ── SOUHVĚZDÍ · Windowling Hlavolamy ────────────────────────────────────────
// Hashiwokakero: spoj hvězdy čarami tak, aby z každé vedlo tolik čar, kolik ukazuje
// její číslo. Mezi dvěma hvězdami nejvýš dvě čáry, čáry se nekříží a vše tvoří jedno
// souhvězdí. Generátor staví strom hvězd s občasnými smyčkami a kontroluje jediné řešení.
const Souhvezdi = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'easy', name: L('Lehké', 'Easy'), note: '7×7', w: 7, h: 7, count: 11, par: 3 * 60 },
    { id: 'medium', name: L('Střední', 'Medium'), note: '9×9', w: 9, h: 9, count: 19, par: 6 * 60 },
    { id: 'hard', name: L('Těžké', 'Hard'), note: '11×11', w: 11, h: 11, count: 30, par: 11 * 60 },
    { id: 'expert', name: L('Expert', 'Expert'), note: '13×13', w: 13, h: 13, count: 44, par: 18 * 60 },
  ];
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  // Hrany: dvojice nejbližších hvězd v řádku/sloupci; kříženia mezi vodorovnou a svislou hranou.
  function edgesOf(isl, w, h) {
    const at = {}; isl.forEach((p, i) => { at[p.y * w + p.x] = i; });
    const E = [];
    isl.forEach((p, i) => {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        let x = p.x + dx, y = p.y + dy;
        while (x < w && y < h && at[y * w + x] === undefined) { x += dx; y += dy; }
        if (x < w && y < h) E.push({ a: i, b: at[y * w + x], h: dy === 0 });
      }
    });
    const cross = E.map(() => []);
    for (let i = 0; i < E.length; i++) for (let j = 0; j < E.length; j++) {
      const e = E[i], f = E[j]; if (!e.h || f.h) continue;
      const ey = isl[e.a].y, ex0 = isl[e.a].x, ex1 = isl[e.b].x, fx = isl[f.a].x, fy0 = isl[f.a].y, fy1 = isl[f.b].y;
      if (fx > ex0 && fx < ex1 && ey > fy0 && ey < fy1) { cross[i].push(j); cross[j].push(i); }
    }
    return { E, cross };
  }

  // Řešitel: počet řešení (do limitu), s propagací kapacit.
  function solve(isl, G, fixed = {}, limit = 2) {
    const { E, cross } = G, n = isl.length, val = new Int8Array(E.length).fill(-1), inc = isl.map(() => []);
    E.forEach((e, k) => { inc[e.a].push(k); inc[e.b].push(k); });
    for (const k in fixed) val[k] = fixed[k];
    const sols = []; let nodes = 0;
    const deg = i => inc[i].reduce((s, k) => s + Math.max(0, val[k]), 0);
    const cap = k => { if (val[k] >= 0) return val[k]; for (const c of cross[k]) if (val[c] > 0) return 0; return Math.min(2, isl[E[k].a].n - deg(E[k].a), isl[E[k].b].n - deg(E[k].b)); };
    function feasible() {
      for (let i = 0; i < n; i++) { const d = deg(i); if (d > isl[i].n) return false; let room = 0; for (const k of inc[i]) if (val[k] < 0) room += cap(k); if (d + room < isl[i].n) return false; }
      for (let k = 0; k < E.length; k++) if (val[k] > 0) for (const c of cross[k]) if (val[c] > 0) return false;
      return true;
    }
    function connected() {
      const seen = new Uint8Array(n); seen[0] = 1; const q = [0];
      while (q.length) { const i = q.pop(); for (const k of inc[i]) if (val[k] > 0) { const j = E[k].a === i ? E[k].b : E[k].a; if (!seen[j]) { seen[j] = 1; q.push(j); } } }
      return seen.every(Boolean);
    }
    (function rec() {
      if (sols.length >= limit || ++nodes > 80000) return;
      if (!feasible()) return;
      // vyber hranu u nejvíc omezené hvězdy
      let bk = -1, bs = 99;
      for (let i = 0; i < n; i++) {
        const need = isl[i].n - deg(i); const open = inc[i].filter(k => val[k] < 0);
        if (!open.length) continue;
        if (!need) { bk = open[0]; bs = -1; break; }
        const sc = open.length * 3 - need; if (sc < bs) { bs = sc; bk = open[0]; }
      }
      if (bk < 0) { if (connected()) sols.push(Array.from(val)); return; }
      const c = cap(bk);
      for (let v = c; v >= 0; v--) { val[bk] = v; rec(); if (sols.length >= limit) break; }
      val[bk] = -1;
    })();
    return { n: sols.length, sols, timeout: nodes > 80000 };
  }

  function build(D, r) {
    const { w, h } = D, grid = new Int16Array(w * h).fill(-1), used = new Uint8Array(w * h); // used = vede tudy čára
    const isl = [], bridges = [];
    const put = (x, y) => { grid[y * w + x] = isl.length; isl.push({ x, y, n: 0 }); return isl.length - 1; };
    const near = (x, y) => DIRS.some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < w && yy < h && grid[yy * w + xx] >= 0; });
    put(Math.floor(r() * w), Math.floor(r() * h));
    for (let tries = 0; tries < 3000 && isl.length < D.count; tries++) {
      const a = Math.floor(r() * isl.length), [dx, dy] = DIRS[Math.floor(r() * 4)], len = 2 + Math.floor(r() * Math.max(2, Math.min(w, h) / 2));
      const x = isl[a].x + dx * len, y = isl[a].y + dy * len;
      if (x < 0 || y < 0 || x >= w || y >= h || grid[y * w + x] >= 0 || used[y * w + x] || near(x, y)) continue;
      let ok = true; for (let k = 1; k < len; k++) { const c = (isl[a].y + dy * k) * w + isl[a].x + dx * k; if (grid[c] >= 0 || used[c]) { ok = false; break; } }
      if (!ok) continue;
      const b = put(x, y);
      for (let k = 1; k < len; k++) used[(isl[a].y + dy * k) * w + isl[a].x + dx * k] = 1;
      const v = r() < 0.4 ? 2 : 1; bridges.push([a, b, v]); isl[a].n += v; isl[b].n += v;
    }
    // smyčky: občas spoj další sousedy
    const G = edgesOf(isl, w, h);
    const has = new Set(bridges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
    G.E.forEach(e => {
      const key = `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`; if (has.has(key) || r() > 0.25) return;
      const pa = isl[e.a], pb = isl[e.b], dx = Math.sign(pb.x - pa.x), dy = Math.sign(pb.y - pa.y);
      let x = pa.x + dx, y = pa.y + dy, ok = true; const path = [];
      while (x !== pb.x || y !== pb.y) { if (used[y * w + x]) { ok = false; break; } path.push(y * w + x); x += dx; y += dy; }
      if (!ok) return;
      path.forEach(c => { used[c] = 1; }); has.add(key); const v = r() < 0.3 ? 2 : 1; bridges.push([e.a, e.b, v]); isl[e.a].n += v; isl[e.b].n += v;
    });
    return { isl, bridges, G };
  }

  function generate(seed, diffId) {
    const D = DIFFS.find(d => d.id === diffId) || DIFFS[0], r = Kit.rng(seed);
    let best = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const { isl, bridges, G } = build(D, r);
      if (isl.length < D.count * 0.8) continue;
      const sol = G.E.map(e => { const b = bridges.find(([a, c]) => (a === e.a && c === e.b) || (a === e.b && c === e.a)); return b ? b[2] : 0; });
      const fixed = {};
      let res = solve(isl, G, fixed), reveals = 0;
      while (res.n > 1 && reveals < 6 && !res.timeout) {
        const diff = sol.map((v, k) => (res.sols[0][k] !== res.sols[1][k] ? k : -1)).filter(k => k >= 0);
        const k = diff[Math.floor(r() * diff.length)]; fixed[k] = sol[k]; reveals++;
        res = solve(isl, G, fixed);
      }
      if (res.n !== 1 || res.timeout) continue;
      const p = { w: D.w, h: D.h, isl: isl.map(p => [p.x, p.y, p.n]), edges: G.E.map(e => [e.a, e.b]), cross: G.cross, sol, given: Object.keys(fixed).map(Number), name: nameOf(seed) };
      if (!reveals) return p;
      if (!best || reveals < best.given.length) best = p;
      if (attempt > 12 && best) return best;
    }
    return best;
  }
  const NM = {
    cs: { a: ['Velký', 'Malý', 'Tichý', 'Bludný', 'Zlatý', 'Ledový', 'Spící', 'Zapomenutý', 'Stříbrný', 'Prastarý', 'Rudý', 'Polární'], b: ['Rejnok', 'Poutník', 'Lukostřelec', 'Kormorán', 'Jelen', 'Maják', 'Kompas', 'Koráb', 'Drak', 'Vlk', 'Strážce', 'Kosatec'] },
    en: { a: ['Great', 'Little', 'Silent', 'Wandering', 'Golden', 'Frozen', 'Sleeping', 'Forgotten', 'Silver', 'Ancient', 'Red', 'Polar'], b: ['Manta', 'Pilgrim', 'Archer', 'Cormorant', 'Stag', 'Lighthouse', 'Compass', 'Galleon', 'Dragon', 'Wolf', 'Warden', 'Iris'] },
  };
  function nameOf(seed) { const r = Kit.rng(seed ^ 0x2545f491), N = NM[Kit.LANG] || NM.cs; return `${N.a[Math.floor(r() * N.a.length)]} ${N.b[Math.floor(r() * N.b.length)]}`; }

  // ── Hrací plocha (SVG) ──
  function create(el, P, saved, api) {
    const isl = P.isl.map(([x, y, n]) => ({ x, y, n })), E = P.edges, given = new Set(P.given);
    let val = saved && saved.val ? saved.val.slice() : E.map((_, k) => (given.has(k) ? P.sol[k] : 0));
    let sel = -1, undo = [], done = false;
    const S = 100, pad = 60, W = (P.w - 1) * S + pad * 2, H = (P.h - 1) * S + pad * 2;
    const X = i => pad + isl[i].x * S, Y = i => pad + isl[i].y * S;
    el.innerHTML = `<div class="hs-wrap"><svg class="hs" viewBox="0 0 ${W} ${H}"><g class="hs-dots"></g><g class="hs-br"></g><g class="hs-isl"></g></svg>
      <div class="k-tools">
        <button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button>
        <button class="k-tool" data-t="clear">${api.icon('erase')}<span>${L('Vymazat', 'Clear')}</span></button>
        <button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button></div></div>`;
    const svg = el.querySelector('svg'), gB = el.querySelector('.hs-br'), gI = el.querySelector('.hs-isl');
    let dots = ''; for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) dots += `<circle cx="${pad + x * S}" cy="${pad + y * S}" r="2.5"/>`;
    el.querySelector('.hs-dots').innerHTML = dots;
    const deg = i => E.reduce((s, [a, b], k) => s + (a === i || b === i ? val[k] : 0), 0);
    const crossing = k => P.cross[k].some(c => val[c] > 0);
    function render() {
      let b = '';
      E.forEach(([a1, b1], k) => {
        const v = val[k]; if (!v) return;
        const x1 = X(a1), y1 = Y(a1), x2 = X(b1), y2 = Y(b1), hz = y1 === y2, o = 9;
        const cls = `hs-l${given.has(k) ? ' giv' : ''}`;
        if (v === 1) b += `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        else b += `<line class="${cls}" x1="${x1 + (hz ? 0 : -o)}" y1="${y1 + (hz ? -o : 0)}" x2="${x2 + (hz ? 0 : -o)}" y2="${y2 + (hz ? -o : 0)}"/><line class="${cls}" x1="${x1 + (hz ? 0 : o)}" y1="${y1 + (hz ? o : 0)}" x2="${x2 + (hz ? 0 : o)}" y2="${y2 + (hz ? o : 0)}"/>`;
      });
      gB.innerHTML = b;
      const nb = sel >= 0 ? E.map(([a, c]) => (a === sel ? c : c === sel ? a : -1)).filter(i => i >= 0) : [];
      gI.innerHTML = isl.map((p, i) => { const d = deg(i), st = d === p.n ? 'ok' : d > p.n ? 'over' : '';
        return `<g class="hs-s ${st} ${i === sel ? 'sel' : ''} ${nb.includes(i) ? 'nb' : ''}" data-i="${i}" transform="translate(${X(i)} ${Y(i)})"><circle class="halo" r="40"/><circle class="core" r="30"/><text dy="11">${p.n}</text></g>`; }).join('');
    }
    function cycle(a, b) {
      const k = E.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
      if (k < 0 || done) return false;
      if (given.has(k)) { api.toast(L('Tahle čára je daná', 'This line is given')); return true; }
      const next = (val[k] + 1) % 3;
      if (next > 0 && crossing(k)) { api.sound('error'); api.toast(L('Čáry se nesmí křížit', 'Lines cannot cross')); return true; }
      undo.push(val.slice()); if (undo.length > 200) undo.shift();
      if (next > P.sol[k]) { val[k] = 0; api.mistake(); render(); api.changed(); return true; }
      val[k] = next; api.sound(next ? 'place' : 'erase'); render(); api.changed(); check(); return true;
    }
    // Ovládání: klepni na hvězdu a pak na sousední, nebo táhni z jedné na druhou.
    let down = -1;
    const islAt = e => { const g = e.target.closest && e.target.closest('.hs-s'); if (g) return +g.dataset.i;
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      let best = -1, bd = 55; isl.forEach((p, i) => { const d = Math.hypot(X(i) - q.x, Y(i) - q.y); if (d < bd) { bd = d; best = i; } }); return best; };
    svg.addEventListener('pointerdown', e => { down = islAt(e); if (down >= 0) e.preventDefault(); });
    svg.addEventListener('pointerup', e => {
      const up = islAt(e);
      if (down >= 0 && up >= 0 && up !== down) { cycle(down, up); sel = -1; render(); }
      else if (up >= 0 && up === down) {
        if (sel >= 0 && sel !== up) { if (!cycle(sel, up)) { sel = up; api.sound('tap'); } else sel = -1; }
        else { sel = sel === up ? -1 : up; api.sound('tap'); }
        render();
      } else if (up < 0) { sel = -1; render(); }
      down = -1;
    });
    function hint() {
      if (done) return;
      const k = val.findIndex((v, i) => v !== P.sol[i]); if (k < 0) return;
      undo.push(val.slice()); val[k] = P.sol[k]; api.hint(); api.sound('star'); render(); api.changed(); check();
    }
    function check() {
      if (!val.every((v, k) => v === P.sol[k])) return;
      done = true; svg.classList.add('won');
      setTimeout(() => api.solved({ title: P.name, html: `<p class="k-muted">${L('Nové souhvězdí na tvé obloze', 'A new constellation in your sky')}</p>` }), 1300);
      const sky = api.data.sky = api.data.sky || []; if (!sky.includes(P.name)) sky.push(P.name);
    }
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t) return; const k = t.dataset.t;
      if (k === 'undo' && undo.length) { val = undo.pop(); api.sound('erase'); render(); api.changed(); }
      if (k === 'clear') { undo.push(val.slice()); val = val.map((v, i) => (given.has(i) ? v : 0)); api.sound('erase'); render(); api.changed(); }
      if (k === 'hint') hint();
    });
    function fit() { const vw = (document.getElementById('kView') || el).clientWidth - 28, hh = innerHeight - 200; const s = Math.max(260, Math.min(vw, hh * W / H, 720)); svg.style.width = s + 'px'; }
    fit(); addEventListener('resize', fit);
    render();
    return { getState: () => ({ val }), progress: () => { let k = 0, m = 0; P.sol.forEach((v, e) => { m += v; k += Math.min(v, val[e] || 0); }); return m ? k / m : 1; }, destroy() { removeEventListener('resize', fit); }, onKey(e) { if ((e.key === 'z' || e.key === 'Z') && undo.length) { val = undo.pop(); render(); api.changed(); } if (e.key === 'h' || e.key === 'H') hint(); }, _solve() { val = P.sol.slice(); render(); check(); } };
  }

  function art(el) {
    const p = generate(Kit.hash('hart'), 'easy'), S = 36, pad = 22, W = (p.w - 1) * S + pad * 2;
    let s = `<svg viewBox="0 0 ${W} ${W}">`;
    p.edges.forEach(([a, b], k) => { if (p.sol[k]) s += `<line x1="${pad + p.isl[a][0] * S}" y1="${pad + p.isl[a][1] * S}" x2="${pad + p.isl[b][0] * S}" y2="${pad + p.isl[b][1] * S}" stroke="var(--a)" stroke-width="${p.sol[k] * 2}" opacity=".7"/>`; });
    p.isl.forEach(([x, y, n]) => { s += `<circle cx="${pad + x * S}" cy="${pad + y * S}" r="11" fill="var(--bg)" stroke="var(--a)" stroke-width="2"/><circle cx="${pad + x * S}" cy="${pad + y * S}" r="16" fill="var(--a)" opacity=".15"/><text x="${pad + x * S}" y="${pad + y * S + 4.5}" text-anchor="middle" font-size="13" font-family="Unbounded, sans-serif" fill="var(--text)">${n}</text>`; });
    el.innerHTML = s + '</svg>';
  }
  const sky = { icon: 'star', name: L('Moje obloha', 'My sky'), badge: s => ((s.data && s.data.sky) || []).length,
    render(el, save) { const k = save.data.sky || []; el.innerHTML = `<h2>${L('Moje obloha', 'My sky')}</h2><p class="k-muted">${L(`Pojmenovaná souhvězdí, která jsi spojil(a): ${k.length}.`, `Constellations you have connected: ${k.length}.`)}</p><div class="hs-sky">${k.slice().reverse().map(x => `<span>${Kit.esc(x)}</span>`).join('') || `<p class="k-muted">${L('Obloha je zatím prázdná.', 'Your sky is still empty.')}</p>`}</div>`; } };

  return { DIFFS, generate, create, art, solve, edgesOf, views: [sky] };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'souhvezdi', title: 'SOUHVĚZDÍ',
  tagline: Kit.L('Spoj hvězdy v souhvězdí. Číslo ve hvězdě říká, kolik čar z ní vede. Jednoduchá pravidla, hluboká logika.', 'Connect the stars into constellations. The number in a star is how many lines leave it. Simple rules, deep logic.'),
  diffs: Souhvezdi.DIFFS, generate: Souhvezdi.generate, create: Souhvezdi.create, art: Souhvezdi.art, views: Souhvezdi.views,
  online: { kind: 'race' },
  rules: Kit.L(`<p>Spoj všechny hvězdy čarami (Hashiwokakero):</p>
    <ul><li>Z každé hvězdy vede přesně tolik čar, kolik ukazuje její číslo.</li>
    <li>Čáry vedou jen vodorovně nebo svisle k nejbližší hvězdě a <b>nesmí se křížit</b>.</li>
    <li>Mezi dvěma hvězdami mohou vést nejvýš <b>dvě</b> čáry.</li>
    <li>Všechny hvězdy musí tvořit jedno propojené souhvězdí.</li>
    <li>Klepni na hvězdu a pak na sousední (nebo táhni z jedné na druhou): 1 čára → 2 čáry → žádná. Hotová hvězda zezelená.</li></ul>`,
    `<p>Connect all stars with lines (Hashiwokakero):</p>
    <ul><li>Each star has exactly as many lines as its number.</li>
    <li>Lines run only horizontally or vertically to the nearest star and <b>must not cross</b>.</li>
    <li>At most <b>two</b> lines connect any pair of stars.</li>
    <li>All stars must form a single connected constellation.</li>
    <li>Tap a star, then a neighbour (or drag between them): 1 line → 2 lines → none. A finished star turns green.</li></ul>`),
  achievements: [{ id: 'sky30', name: Kit.L('Mapa oblohy', 'Sky Chart'), desc: Kit.L('Spoj 30 souhvězdí', 'Connect 30 constellations'), prog: s => [((s.data && s.data.sky) || []).length, 30] }],
});
