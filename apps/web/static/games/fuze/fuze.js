'use strict';
// ── FÚZE · Windowling Hlavolamy ─────────────────────────────────────────────
// Slučuj stejná tělesa: prach → kamínek → asteroid → … → supernova → černá díra.
// Princip 2048, ale s vesmírnými tělesy, asteroidy jako překážkami a cíli na Cestě.
const Fuze = (() => {
  const L = Kit.L;
  const NAMES = [null, L('Prach', 'Dust'), L('Kamínek', 'Pebble'), L('Asteroid', 'Asteroid'), L('Měsíc', 'Moon'), L('Planeta', 'Planet'), L('Plynný obr', 'Gas giant'),
    L('Hvězda', 'Star'), L('Rudý obr', 'Red giant'), L('Pulsar', 'Pulsar'), L('Neutronová hv.', 'Neutron star'), L('Supernova', 'Supernova'), L('Černá díra', 'Black hole'),
    L('Kvasar', 'Quasar'), L('Galaxie', 'Galaxy'), L('Kupa galaxií', 'Cluster'), L('Vesmír', 'Universe')];
  const HUES = [0, 210, 190, 170, 140, 100, 60, 40, 20, 0, 330, 300, 270, 250, 230, 200, 180];
  const DIFFS = [
    { id: 'classic', name: L('Klasika 4×4', 'Classic 4×4'), note: L('cíl: Supernova', 'goal: Supernova'), n: 4, goal: 11, metric: 'score' },
    { id: 'big', name: L('Velká 5×5', 'Big 5×5'), note: L('cíl: Kvasar', 'goal: Quasar'), n: 5, goal: 13, metric: 'score' },
    { id: 'small', name: L('Malá 3×3', 'Small 3×3'), note: L('cíl: Rudý obr', 'goal: Red giant'), n: 3, goal: 8, metric: 'score' },
    { id: 'belt', name: L('Pás asteroidů', 'Asteroid belt'), note: L('5×5 s překážkami', '5×5 with obstacles'), n: 5, goal: 11, rocks: 3, metric: 'score' },
  ];
  // Cesta: cíle rostou, občas menší deska nebo asteroidy; hvězdy podle počtu tahů.
  function levelSpec(n) {
    const ch = Math.floor((n - 1) / 20), k = (n - 1) % 20;
    const size = k % 7 === 6 ? 3 : k % 5 === 4 ? 5 : 4;
    const goal = Math.min(size === 5 ? 12 : size === 3 ? 8 : 11, (size === 3 ? 4 : 5) + ch + Math.floor(k / 8));
    const rocks = size === 5 && k % 2 ? 1 + Math.floor(ch / 2) : 0;
    const par = Math.round(Math.pow(2, goal) / 1.8 / (size === 3 ? 1.6 : 1));
    return { n: size, goal, rocks, par };
  }
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') return Object.assign({ seed, mode: 'level' }, levelSpec(ctx.key));
    if (ctx.kind === 'daily') return { seed, mode: 'daily', n: 4, goal: 10, rocks: 0 };
    const D = DIFFS.find(d => d.id === diffId) || DIFFS[0];
    return { seed, mode: 'free', n: D.n, goal: D.goal, rocks: D.rocks || 0 };
  }

  function create(el, P, saved, api) {
    const n = P.n, r = Kit.rng(P.seed);
    let grid, score = 0, moves = 0, best = 0, spawns = 0, undoStack = [], over = false, won = false, id = 1;
    const ROCK = -1;
    function spawn() {
      const empty = []; for (let i = 0; i < n * n; i++) if (!grid[i]) empty.push(i);
      if (!empty.length) return;
      const i = empty[Math.floor(r() * empty.length)]; spawns++;
      grid[i] = { v: r() < 0.9 ? 1 : 2, id: id++, born: true };
    }
    function fresh() {
      grid = new Array(n * n).fill(null);
      for (let k = 0; k < P.rocks; k++) { const empty = grid.map((c, i) => (c ? -1 : i)).filter(i => i >= 0); const i = empty[Math.floor(r() * empty.length)]; grid[i] = { v: ROCK, id: id++ }; }
      spawn(); spawn();
    }
    if (saved && saved.grid) {
      grid = saved.grid.map(c => (c ? { v: c, id: id++ } : null)); score = saved.score; moves = saved.moves;
      // posuň náhodu za již vytvořená tělesa (zápis je deterministický)
      for (let k = 0; k < saved.spawns * 2 + P.rocks; k++) r(); spawns = saved.spawns;
    } else fresh();
    best = Math.max(0, ...grid.map(c => (c ? c.v : 0)));

    el.innerHTML = `<div class="fz-wrap"><div class="fz-head"><div><small>${L('SKÓRE', 'SCORE')}</small><b class="fz-score">0</b></div><div><small>${L('TAHY', 'MOVES')}</small><b class="fz-moves">0</b></div><div class="fz-goal"><small>${L('CÍL', 'GOAL')}</small><b>${NAMES[P.goal]}</b></div></div>
      <div class="fz-board" style="--n:${n}">${[...Array(n * n)].map(() => '<i></i>').join('')}</div>
      <div class="k-tools"><button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button><button class="k-tool" data-t="restart">${api.icon('erase')}<span>${L('Znovu', 'Restart')}</span></button></div></div>`;
    const boardEl = el.querySelector('.fz-board');
    const tiles = new Map();
    function tileEl(t) {
      let e = tiles.get(t.id);
      if (!e) { e = document.createElement('div'); e.className = 'fz-t' + (t.v === ROCK ? ' rock' : ''); boardEl.appendChild(e); tiles.set(t.id, e); }
      return e;
    }
    function render() {
      const seen = new Set();
      grid.forEach((t, i) => {
        if (!t) return; seen.add(t.id);
        const e = tileEl(t);
        e.style.setProperty('--x', i % n); e.style.setProperty('--y', Math.floor(i / n));
        if (t.v !== ROCK) {
          e.style.setProperty('--h', HUES[Math.min(t.v, HUES.length - 1)]); e.style.setProperty('--l', 40 + Math.min(t.v, 12) * 2 + '%');
          e.dataset.v = t.v; e.innerHTML = `<b>${2 ** t.v}</b><small>${NAMES[Math.min(t.v, NAMES.length - 1)]}</small>`;
        }
        e.classList.toggle('born', !!t.born); e.classList.toggle('merged', !!t.merged);
        if (t.born || t.merged) { const tt = t; setTimeout(() => { tt.born = tt.merged = false; }, 0); }
      });
      for (const [k, e] of tiles) if (!seen.has(k)) { e.classList.add('gone'); tiles.delete(k); setTimeout(() => e.remove(), 120); }
      el.querySelector('.fz-score').textContent = Kit.fmtNum(score); el.querySelector('.fz-moves').textContent = moves;
    }
    // Posun: směr 0 vlevo, 1 nahoru, 2 vpravo, 3 dolů
    function slide(dir) {
      if (over) return;
      const before = grid.map(c => c && { v: c.v, id: c.id });
      let moved = false, gained = 0, top = 0;
      for (let a = 0; a < n; a++) {
        const idx = []; for (let b = 0; b < n; b++) { const x = dir === 0 ? b : dir === 2 ? n - 1 - b : a, y = dir === 1 ? b : dir === 3 ? n - 1 - b : a; idx.push(y * n + x); }
        // asteroidy dělí řadu na úseky
        let seg = [];
        const flush = () => {
          const line = seg.map(i => grid[i]).filter(Boolean), out = [];
          for (let k = 0; k < line.length; k++) {
            if (k + 1 < line.length && line[k].v === line[k + 1].v) { const v = line[k].v + 1; out.push({ v, id: line[k + 1].id, merged: true }); gained += 2 ** v; top = Math.max(top, v); k++; }
            else out.push(line[k]);
          }
          seg.forEach((i, k) => { const t = out[k] || null; if ((grid[i] && grid[i].id) !== (t && t.id) || (t && t.merged)) moved = true; grid[i] = t; });
          seg = [];
        };
        for (const i of idx) { if (grid[i] && grid[i].v === ROCK) flush(); else seg.push(i); }
        flush();
      }
      if (!moved) return;
      undoStack.push({ grid: before, score, moves, spawns }); if (undoStack.length > 20) undoStack.shift();
      score += gained; moves++;
      api.sound(gained ? (top >= 7 ? 'line' : 'place') : 'soft');
      spawn(); render(); api.changed();
      const mx = Math.max(...grid.map(c => (c && c.v > 0 ? c.v : 0)));
      if (mx > best) { best = mx; if (best >= 6) api.toast(`${NAMES[best]}!`); }
      if (!won && best >= P.goal) { won = true; finish(true); return; }
      if (!canMove()) finish(false);
    }
    function canMove() {
      for (let i = 0; i < n * n; i++) {
        if (!grid[i]) return true;
        const v = grid[i].v; if (v === ROCK) continue;
        const x = i % n, y = Math.floor(i / n);
        if (x + 1 < n && grid[i + 1] && grid[i + 1].v === v) return true;
        if (y + 1 < n && grid[i + n] && grid[i + n].v === v) return true;
      }
      return false;
    }
    function finish(win) {
      over = true;
      setTimeout(() => {
        if (win) {
          const stars = P.mode === 'level' ? (moves <= P.par ? 3 : moves <= P.par * 1.3 ? 2 : 1) : undefined;
          api.solved({ title: NAMES[best], stars, score, html: `<p class="k-muted">${L(`Tahy: ${moves}`, `Moves: ${moves}`)}</p>` });
        } else api.failed({ score, html: `<p class="k-muted">${L(`Nejvýš: ${NAMES[best]} · tahy ${moves}`, `Best: ${NAMES[best]} · moves ${moves}`)}</p>` });
      }, 450);
    }
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t || over) return;
      if (t.dataset.t === 'undo' && undoStack.length) {
        const u = undoStack.pop(); grid = u.grid.map(c => c && { v: c.v, id: c.id }); score = u.score; moves = u.moves;
        api.hint(); api.sound('erase'); render(); api.changed();
      }
      if (t.dataset.t === 'restart') { undoStack = []; for (const e2 of tiles.values()) e2.remove(); tiles.clear(); score = 0; moves = 0; fresh(); best = Math.max(...grid.map(c => (c && c.v > 0 ? c.v : 0))); render(); api.changed(); }
    });
    // Gesta
    let p0 = null;
    boardEl.addEventListener('pointerdown', e => { p0 = { x: e.clientX, y: e.clientY }; boardEl.setPointerCapture(e.pointerId); });
    boardEl.addEventListener('pointerup', e => {
      if (!p0) return; const dx = e.clientX - p0.x, dy = e.clientY - p0.y; p0 = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      slide(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 2) : (dy < 0 ? 1 : 3));
    });
    function fit() { const vw = (document.getElementById('kView') || el).clientWidth - 28, s = Math.max(240, Math.min(vw, innerHeight - 250, 520)); boardEl.style.width = boardEl.style.height = s + 'px'; }
    fit(); addEventListener('resize', fit);
    render();
    return {
      getState: () => (over ? null : { grid: grid.map(c => (c ? c.v : 0)), score, moves, spawns }),
      destroy() { removeEventListener('resize', fit); },
      onKey(e) { const m = { ArrowLeft: 0, a: 0, A: 0, ArrowUp: 1, w: 1, W: 1, ArrowRight: 2, d: 2, D: 2, ArrowDown: 3, s: 3, S: 3 }[e.key]; if (m !== undefined) { e.preventDefault(); slide(m); } if ((e.key === 'z' || e.key === 'Z') && undoStack.length) el.querySelector('[data-t="undo"]').click(); },
      _solve() { const i = grid.findIndex(c => !c || c.v > 0); grid[i] = { v: P.goal, id: id++ }; best = P.goal; won = true; render(); finish(true); },
    };
  }

  function art(el) {
    let h = '<div class="fz-art">';
    [1, 2, 3, 5, 4, 7, 6, 9, 8, 10, 11, 12, 7, 5, 3, 1].forEach(v => { h += `<div class="fz-t" style="--h:${HUES[v]};--l:${40 + v * 2}%"><b>${2 ** v}</b><small>${NAMES[v]}</small></div>`; });
    el.innerHTML = h + '</div>';
  }
  return { DIFFS, generate, create, art, levelSpec, NAMES };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'fuze', title: 'FÚZE',
  tagline: Kit.L('Slučuj vesmírná tělesa: z prachu planety, z planet hvězdy, ze hvězd supernovu. Každý tah se počítá.', 'Merge cosmic bodies: dust into planets, planets into stars, stars into a supernova. Every move counts.'),
  diffs: Fuze.DIFFS, generate: Fuze.generate, create: Fuze.create, art: Fuze.art,
  dailyDiff: () => 'classic', levelDiff: n => { const s = Fuze.levelSpec(n); return s.n === 3 ? 'small' : s.rocks ? 'belt' : s.n === 5 ? 'big' : 'classic'; },
  rules: Kit.L(`<p>Posouvej všechna tělesa najednou (šipky, WASD nebo tah prstem). Dvě stejná tělesa, která do sebe narazí, se sloučí ve vyšší: 2 → 4 → 8 … Po každém tahu se objeví nový prach.</p>
    <ul><li>Dosáhni cílového tělesa: v klasice <b>Supernovy (2048)</b>, na Cestě podle úkolu, v denní výzvě <b>Neutronové hvězdy (1024)</b>.</li>
    <li><b>Asteroidy</b> v Pásu se nehýbou a dělí řady.</li>
    <li>Hra končí, když už nejde táhnout. <b>Zpět</b> vrátí tah, ale počítá se jako nápověda.</li>
    <li>Na Cestě dostaneš tři hvězdy za splnění úkolu v limitu tahů.</li></ul>`,
    `<p>Slide all bodies at once (arrows, WASD or a swipe). Two equal bodies that collide merge into a higher one: 2 → 4 → 8 … New dust appears after every move.</p>
    <ul><li>Reach the goal body: <b>Supernova (2048)</b> in Classic, per task on the Path, <b>Neutron star (1024)</b> in the daily.</li>
    <li><b>Asteroids</b> in the Belt never move and split the rows.</li>
    <li>The game ends when no move is possible. <b>Undo</b> takes a move back but counts as a hint.</li>
    <li>On the Path, three stars for reaching the goal within the move limit.</li></ul>`),
  achievements: [],
});
