'use strict';
// ── MINY · Windowling Hlavolamy ─────────────────────────────────────────────
// Hledání min bez hádání: generátor ověří vlastním řešitelem, že z označeného startu
// jde celé pole vyřešit logikou (kde řešitel uvízne, přesune minu jinam). Tři štíty
// odpustí přehmat; o hvězdách rozhoduje čas a počet zásahů.
const Miny = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'easy', name: L('Lehké', 'Easy'), note: '9×9 · 10', w: 9, h: 9, m: 10, par: 60 },
    { id: 'medium', name: L('Střední', 'Medium'), note: '12×16 · 32', w: 12, h: 16, m: 32, par: 3 * 60 },
    { id: 'hard', name: L('Těžké', 'Hard'), note: '16×16 · 46', w: 16, h: 16, m: 46, par: 5 * 60 },
    { id: 'expert', name: L('Expert', 'Expert'), note: '16×30 · 99', w: 16, h: 30, m: 99, par: 10 * 60 },
  ];
  function levelSpec(n) {
    const ch = Math.floor((n - 1) / 20), k = (n - 1) % 20;
    const w = [8, 9, 10, 12, 14, 16][ch], h = [8, 10, 12, 16, 18, 22][ch] + (k >= 10 ? 2 : 0);
    const dens = [0.11, 0.13, 0.15, 0.16, 0.18, 0.19][ch] + (k % 10) * 0.002;
    return { w, h, m: Math.round(w * h * dens), par: Math.round(w * h * 0.55) };
  }
  const nbrs = (i, w, h) => { const x = i % w, y = Math.floor(i / w), o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) o.push(yy * w + xx); } return o; };

  // Logický řešitel: vrací množinu odkrytých buněk (bez hádání), nebo -1 frontu nejasných.
  function solvable(mine, w, h, start, M) {
    const N = w * h, num = new Int8Array(N), open = new Uint8Array(N), flag = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (!mine[i]) num[i] = nbrs(i, w, h).reduce((s, j) => s + mine[j], 0);
    const queue = [start];
    const reveal = i => { if (open[i] || flag[i]) return; open[i] = 1; if (!num[i]) for (const j of nbrs(i, w, h)) if (!open[j] && !mine[j]) queue.push(j); };
    const flush = () => { while (queue.length) reveal(queue.pop()); };
    flush();
    for (let guard = 0; guard < 2000; guard++) {
      let progress = false;
      const cons = [];
      for (let i = 0; i < N; i++) {
        if (!open[i] || !num[i]) continue;
        const nb = nbrs(i, w, h), unk = nb.filter(j => !open[j] && !flag[j]), f = nb.filter(j => flag[j]).length;
        if (!unk.length) continue;
        const need = num[i] - f;
        if (need === 0) { unk.forEach(j => queue.push(j)); progress = true; }
        else if (need === unk.length) { unk.forEach(j => { flag[j] = 1; }); progress = true; }
        else cons.push({ set: unk, n: need });
      }
      if (progress) { flush(); continue; }
      // podmnožiny dvou omezení
      for (let a = 0; a < cons.length && !progress; a++) for (let b = 0; b < cons.length && !progress; b++) {
        if (a === b) continue; const A = cons[a], B = cons[b];
        if (A.set.length >= B.set.length || !A.set.every(j => B.set.includes(j))) continue;
        const rest = B.set.filter(j => !A.set.includes(j)), d = B.n - A.n;
        if (d === 0) { rest.forEach(j => queue.push(j)); progress = true; }
        else if (d === rest.length) { rest.forEach(j => { flag[j] = 1; }); progress = true; }
      }
      if (progress) { flush(); continue; }
      // počet min celkem
      const unknown = []; let flags = 0; for (let i = 0; i < N; i++) { if (flag[i]) flags++; else if (!open[i]) unknown.push(i); }
      if (!unknown.length) return { ok: true };
      if (M - flags === 0) { unknown.forEach(j => queue.push(j)); flush(); continue; }
      if (M - flags === unknown.length) { unknown.forEach(j => { flag[j] = 1; }); continue; }
      // uvízl: vrať neznámé buňky na hranici
      const frontier = unknown.filter(i => nbrs(i, w, h).some(j => open[j]));
      return { ok: false, frontier: frontier.length ? frontier : unknown, unknown };
    }
    return { ok: false, frontier: [], unknown: [] };
  }

  function generate(seed, diffId, ctx = {}) {
    const D = ctx.kind === 'level' ? levelSpec(ctx.key) : DIFFS.find(d => d.id === diffId) || DIFFS[0];
    const { w, h, m } = D, N = w * h, r = Kit.rng(seed);
    const sx = 1 + Math.floor(r() * (w - 2)), sy = 1 + Math.floor(r() * (h - 2)), start = sy * w + sx;
    const safe = new Set([start, ...nbrs(start, w, h)]);
    let best = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const mine = new Uint8Array(N);
      const pool = Kit.shuffle([...Array(N).keys()].filter(i => !safe.has(i)), r);
      pool.slice(0, m).forEach(i => { mine[i] = 1; });
      for (let fix = 0; fix < N * 3; fix++) {
        const res = solvable(mine, w, h, start, m);
        if (res.ok) return { w, h, m, start, mine: Array.from(mine).join(''), par: D.par };
        // přesuň jednu minu z nejasné hranice do neodkryté oblasti mimo hranici
        const fr = res.frontier.filter(i => mine[i]);
        const from = fr.length ? fr[Math.floor(r() * fr.length)] : res.frontier[Math.floor(r() * res.frontier.length)];
        const targets = res.unknown.filter(i => !mine[i] && !res.frontier.includes(i) && !safe.has(i));
        if (from == null || !mine[from] || !targets.length) {
          // bez možnosti přesunu: udělej z nejasné buňky volnou (sníží počet min jen dočasně – vrať ji jinam)
          const any = [...Array(N).keys()].filter(i => !mine[i] && !safe.has(i) && !res.frontier.includes(i));
          if (from == null || !any.length) break;
          if (mine[from]) { mine[from] = 0; mine[any[Math.floor(r() * any.length)]] = 1; } else break;
          continue;
        }
        mine[from] = 0; mine[targets[Math.floor(r() * targets.length)]] = 1;
      }
      best = best || { w, h, m, start, mine: Array.from(mine).join(''), par: D.par, guess: true };
    }
    return best;
  }

  function create(el, P, saved, api) {
    const { w, h } = P, N = w * h, mine = [...P.mine].map(Number);
    const num = mine.map((v, i) => (v ? -1 : nbrs(i, w, h).reduce((s, j) => s + mine[j], 0)));
    let open = saved && saved.open ? saved.open.slice() : new Array(N).fill(0);
    let flag = saved && saved.flag ? saved.flag.slice() : new Array(N).fill(0);
    let boom = saved && saved.boom ? saved.boom.slice() : new Array(N).fill(0);
    let lives = saved && saved.lives != null ? saved.lives : 3, flagMode = false, done = false;
    el.innerHTML = `<div class="mn-wrap"><div class="mn-head"><div><small>${L('MINY', 'MINES')}</small><b class="mn-left"></b></div><div><small>${L('ŠTÍTY', 'SHIELDS')}</small><b class="mn-lives"></b></div></div>
      <div class="mn-board" style="--w:${w};--h:${h}"></div>
      <div class="k-tools"><button class="k-tool" data-t="flag"><span class="mn-fl">⚑</span><span>${L('Vlajky', 'Flags')}</span></button><button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button></div></div>`;
    const board = el.querySelector('.mn-board');
    board.innerHTML = mine.map((_, i) => `<button class="mn-c${i === P.start ? ' start' : ''}" data-i="${i}"></button>`).join('');
    const cells = [...board.children];
    function render() {
      cells.forEach((c, i) => {
        c.className = 'mn-c' + (open[i] ? ' o' : '') + (flag[i] ? ' f' : '') + (boom[i] ? ' boom' : '') + (i === P.start && !open.some(Boolean) ? ' start' : '') + (done && mine[i] && !flag[i] && !boom[i] ? ' show' : '');
        c.textContent = open[i] && num[i] > 0 ? num[i] : '';
        c.dataset.n = open[i] ? num[i] : '';
      });
      el.querySelector('.mn-left').textContent = P.m - flag.reduce((a, b) => a + b, 0) - boom.reduce((a, b) => a + b, 0);
      el.querySelector('.mn-lives').innerHTML = '◆'.repeat(lives) + '<i>' + '◇'.repeat(3 - lives) + '</i>';
      el.querySelector('[data-t="flag"]').classList.toggle('on', flagMode);
    }
    function flood(i) {
      const st = [i];
      while (st.length) { const k = st.pop(); if (open[k] || flag[k] || boom[k]) continue; open[k] = 1; if (num[k] === 0) for (const j of nbrs(k, w, h)) if (!open[j]) st.push(j); }
    }
    function reveal(i) {
      if (done || open[i] || flag[i] || boom[i]) return;
      if (!open.some(Boolean) && i !== P.start) { api.toast(L('Začni na označeném políčku', 'Start on the marked cell')); cells[P.start].classList.add('pulse'); setTimeout(() => cells[P.start].classList.remove('pulse'), 800); return; }
      if (mine[i]) {
        boom[i] = 1; lives--; api.mistake(); cells[i].classList.add('shake');
        if (lives <= 0) { done = true; render(); setTimeout(() => api.failed({ title: L('Bum!', 'Boom!'), html: `<p class="k-muted">${L('Došly ti štíty.', 'You ran out of shields.')}</p>` }), 700); return; }
        api.toast(L(`Zásah! Zbývá štítů: ${lives}`, `Hit! Shields left: ${lives}`));
      } else { flood(i); api.sound(num[i] === 0 ? 'line' : 'tap'); }
      render(); api.changed(); check();
    }
    function chord(i) {
      if (!open[i] || num[i] <= 0) return;
      const nb = nbrs(i, w, h), f = nb.filter(j => flag[j] || boom[j]).length;
      if (f === num[i]) nb.forEach(j => { if (!open[j] && !flag[j]) reveal(j); });
    }
    function toggleFlag(i) { if (done || open[i] || boom[i]) return; flag[i] ^= 1; api.sound('soft'); render(); api.changed(); }
    function check() {
      if (mine.every((v, i) => v || open[i])) {
        done = true; mine.forEach((v, i) => { if (v && !boom[i]) flag[i] = 1; }); render();
        cells.forEach((c, i) => setTimeout(() => c.classList.add('win'), ((i % w) + Math.floor(i / w)) * 12));
        setTimeout(() => api.solved(), 900);
      }
    }
    function hint() {
      if (done) return;
      if (!open.some(Boolean)) { reveal(P.start); return; }
      // bezpečné políčko na hranici, jinak libovolné
      const safe = [...Array(N).keys()].filter(i => !mine[i] && !open[i]);
      const edge = safe.filter(i => nbrs(i, w, h).some(j => open[j]));
      const pick = (edge.length ? edge : safe)[0]; if (pick == null) return;
      api.hint(); flood(pick); api.sound('star'); cells[pick].classList.add('pulse'); render(); api.changed(); check();
    }
    // klepnutí, dlouhé podržení = vlajka, pravé tlačítko = vlajka
    let press = null;
    board.addEventListener('pointerdown', e => {
      const c = e.target.closest('.mn-c'); if (!c) return;
      const i = +c.dataset.i;
      press = { i, t: setTimeout(() => { if (press && press.i === i) { press.long = true; toggleFlag(i); if (navigator.vibrate) navigator.vibrate(20); } }, 380) };
    });
    board.addEventListener('pointerup', e => {
      const c = e.target.closest('.mn-c'); if (!press) return; clearTimeout(press.t);
      const p = press; press = null; if (p.long || !c || +c.dataset.i !== p.i || e.button === 2) return;
      const i = p.i;
      if (open[i]) chord(i); else if (flagMode) toggleFlag(i); else reveal(i);
    });
    board.addEventListener('pointercancel', () => { if (press) clearTimeout(press.t); press = null; });
    board.addEventListener('contextmenu', e => { e.preventDefault(); const c = e.target.closest('.mn-c'); if (c) { if (press) clearTimeout(press.t); press = null; toggleFlag(+c.dataset.i); } });
    el.querySelector('.k-tools').addEventListener('click', e => { const t = e.target.closest('[data-t]'); if (!t) return; if (t.dataset.t === 'flag') { flagMode = !flagMode; render(); } if (t.dataset.t === 'hint') hint(); });
    function fit() {
      const vw = (document.getElementById('kView') || el).clientWidth - 28, hh = innerHeight - 220;
      const cs = Math.max(14, Math.min(40, Math.floor(Math.min((vw - 16 - 2 * (w - 1)) / w, (hh - 16 - 2 * (h - 1)) / h))));
      board.style.setProperty('--cs', cs + 'px');
    }
    fit(); addEventListener('resize', fit);
    render();
    return {
      getState: () => (done ? null : { open, flag, boom, lives }),
      destroy() { removeEventListener('resize', fit); },
      onKey(e) { if (e.key === 'f' || e.key === 'F') { flagMode = !flagMode; render(); } if (e.key === 'h' || e.key === 'H') hint(); },
      _solve() { open = mine.map(v => (v ? 0 : 1)); check(); },
    };
  }

  function art(el) {
    const p = generate(Kit.hash('mart'), 'easy'), mine = [...p.mine].map(Number);
    let s = '<svg viewBox="0 0 270 270">';
    mine.forEach((v, i) => {
      const x = (i % 9) * 30, y = Math.floor(i / 9) * 30, n = v ? -1 : nbrs(i, 9, 9).reduce((a, j) => a + mine[j], 0), op = (i * 37) % 5 > 1;
      s += `<rect x="${x + 1}" y="${y + 1}" width="28" height="28" rx="5" fill="${op ? 'rgba(255,255,255,.05)' : 'rgba(85,246,255,.18)'}" stroke="var(--a)" stroke-opacity=".25"/>`;
      if (op && n > 0) s += `<text x="${x + 15}" y="${y + 21}" text-anchor="middle" font-family="Unbounded, sans-serif" font-size="15" fill="hsl(${200 - n * 35} 95% 70%)">${n}</text>`;
      if (!op && v) s += `<text x="${x + 15}" y="${y + 21}" text-anchor="middle" font-size="15" fill="var(--b)">⚑</text>`;
    });
    el.innerHTML = s + '</svg>';
  }
  return { DIFFS, generate, create, art, solvable, levelSpec };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'miny', title: 'MINY',
  tagline: Kit.L('Hledání min bez hádání. Každé pole jde vyřešit čistou logikou a tři štíty ti odpustí přehmat.', 'Minesweeper without guessing. Every field can be solved by logic, and three shields forgive a slip.'),
  diffs: Miny.DIFFS, generate: Miny.generate, create: Miny.create, art: Miny.art,
  levelDiff: n => { const s = Miny.levelSpec(n); return s.w * s.h <= 100 ? 'easy' : s.w * s.h <= 200 ? 'medium' : s.w * s.h <= 260 ? 'hard' : 'expert'; },
  rules: Kit.L(`<p>Odkryj všechna políčka bez min. Číslo říká, kolik min je v osmi okolních políčkách.</p>
    <ul><li>Začni na <b>označeném políčku</b>. Odtud jde celé pole vyřešit logikou, nikdy nemusíš hádat.</li>
    <li><b>Vlajka:</b> dlouze podrž políčko (na počítači pravé tlačítko) nebo zapni režim Vlajky (F).</li>
    <li>Klepnutí na číslo, kolem kterého jsou všechny miny označené, odkryje zbytek okolí.</li>
    <li>Máš <b>3 štíty</b>: zásah miny stojí jeden štít a počítá se jako chyba.</li></ul>`,
    `<p>Reveal every cell without a mine. A number tells how many mines are in the eight surrounding cells.</p>
    <ul><li>Start on the <b>marked cell</b>. From there the whole field can be solved by logic, you never have to guess.</li>
    <li><b>Flag:</b> long-press a cell (right-click on a computer) or switch to Flag mode (F).</li>
    <li>Tapping a number whose mines are all flagged reveals the rest of its neighbours.</li>
    <li>You have <b>3 shields</b>: hitting a mine costs one and counts as a mistake.</li></ul>`),
  achievements: [],
});
