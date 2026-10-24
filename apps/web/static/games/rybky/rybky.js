'use strict';
// ── RYBKY · Windowling Hlavolamy ────────────────────────────────────────────
// Malá a velká rybka musí uplavat z jeskyně. Předměty padají, malá rybka pohne jen lehkými
// věcmi, velká i ocelí, a padající předmět rybku zabije. Úrovně jsou vygenerované předem
// a ověřené řešitelem (levels.js, seřazené podle obtížnosti), řešení slouží nápovědě.
const Rybky = (() => {
  const L = Kit.L, E = RybkyEngine, POOL = RYBKY_LEVELS;
  const DIFFS = [
    { id: 'easy', name: L('Mělčina', 'Shallows'), note: L('lehké', 'easy'), par: 4 * 60 },
    { id: 'medium', name: L('Útes', 'Reef'), note: L('střední', 'medium'), par: 7 * 60 },
    { id: 'hard', name: L('Hlubina', 'Deep'), note: L('těžké', 'hard'), par: 11 * 60 },
    { id: 'expert', name: L('Propast', 'Abyss'), note: L('expert', 'expert'), par: 16 * 60 },
  ];
  const PATH = 120;
  const NM = {
    cs: { a: ['Korálová', 'Tichá', 'Zelená', 'Temná', 'Perlová', 'Stará', 'Mlžná', 'Hluboká', 'Modrá', 'Zapomenutá', 'Ledová', 'Zrádná'], b: ['zátoka', 'jeskyně', 'štěrbina', 'laguna', 'propast', 'chodba', 'tůň', 'hlubina', 'skrýš', 'sluj', 'rokle', 'komora'] },
    en: { a: ['Coral', 'Quiet', 'Green', 'Dark', 'Pearl', 'Old', 'Misty', 'Deep', 'Blue', 'Forgotten', 'Icy', 'Treacherous'], b: ['Bay', 'Cave', 'Crevice', 'Lagoon', 'Chasm', 'Passage', 'Pool', 'Deep', 'Hideout', 'Grotto', 'Gorge', 'Chamber'] },
  };
  const nameOf = i => { const r = Kit.rng(i * 2654435761), N = NM[Kit.LANG] || NM.cs; return `${N.a[Math.floor(r() * N.a.length)]} ${N.b[Math.floor(r() * N.b.length)]}`; };

  function generate(seed, diffId, ctx) {
    let i;
    if (ctx && ctx.kind === 'level') i = Math.round((Math.min(PATH, Math.max(1, +ctx.key)) - 1) * (POOL.length - 1) / (PATH - 1));
    else {
      const q = Math.max(0, DIFFS.findIndex(d => d.id === diffId)), n = POOL.length, from = Math.floor(q * n / 4), to = Math.floor((q + 1) * n / 4);
      i = from + Math.floor(Kit.rng(seed)() * (to - from));
    }
    const lv = POOL[i];
    // ořízni čistě skalní okraje (nechá jednu řadu skály kolem vody)
    let rows = lv.r.slice();
    const solid = r => /^#+$/.test(r);
    while (rows.length > 2 && solid(rows[0]) && solid(rows[1])) rows.shift();
    while (rows.length > 2 && solid(rows[rows.length - 1]) && solid(rows[rows.length - 2])) rows.pop();
    const col = x => rows.every(r => r[x] === '#');
    while (rows[0].length > 2 && col(0) && col(1)) rows = rows.map(r => r.slice(1));
    while (rows[0].length > 2 && col(rows[0].length - 1) && col(rows[0].length - 2)) rows = rows.map(r => r.slice(0, -1));
    return { rows, sol: lv.s.match(/../g), par: lv.n, idx: i, name: nameOf(i) };
  }

  // ── kresby ──
  const S = 60;
  const OBJ_COL = ['#d98f4a', '#e0675a', '#c9a24a', '#5fb88f', '#d47bb4', '#8f7ad6', '#e8a54a', '#4fb0c6', '#cf7d5a', '#a3c45a', '#e57f9a', '#6f9fe0', '#d9b26a', '#7cc7a0'];
  function fishSVG(k) {
    // malá: 2×1 zlatá, velká: 3×2 modrá; kresleno doprava, otáčí se přes scaleX
    const w = k ? 3 * S : 2 * S, h = k ? 2 * S : S;
    const body = k ? '#4d8bff' : '#ffb547', belly = k ? '#a8c8ff' : '#ffe0a0', fin = k ? '#2f62c9' : '#e8862a';
    return `<g class="rb-fish-art"><path class="tail" d="M${w * 0.24} ${h * 0.5} L${w * 0.04} ${h * 0.18} Q${w * 0.1} ${h * 0.5} ${w * 0.04} ${h * 0.82}Z" fill="${fin}"/>
      <ellipse cx="${w * 0.56}" cy="${h * 0.52}" rx="${w * 0.38}" ry="${h * 0.38}" fill="${body}"/>
      <ellipse cx="${w * 0.6}" cy="${h * 0.66}" rx="${w * 0.26}" ry="${h * 0.16}" fill="${belly}" opacity=".75"/>
      <path d="M${w * 0.5} ${h * 0.16} Q${w * 0.6} ${h * 0.02} ${w * 0.7} ${h * 0.18}" fill="${fin}"/>
      <circle cx="${w * 0.78}" cy="${h * 0.42}" r="${h * 0.11}" fill="#fff"/><circle cx="${w * 0.8}" cy="${h * 0.42}" r="${h * 0.055}" fill="#0b1630"/>
      <path d="M${w * 0.9} ${h * 0.58} q${-w * 0.03} ${h * 0.05} ${-w * 0.06} 0" stroke="#0b1630" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
  }

  function create(el, P, saved, api) {
    const Lv = E.parse(P.rows), { W, H } = Lv;
    let s = Lv.start.slice(), moves = [], hist = [], active = 1, dead = -1, done = false, hintsUsed = (saved && saved.h) || 0;
    const facing = [1, 1];
    E.settle(Lv, s);
    if (saved && Array.isArray(saved.m)) for (const m of saved.m) { const r = E.move(Lv, s, +m[0] - 1, m[1]); if (!r) break; hist.push(s); s = r.s; moves.push(m); if (r.dead >= 0) { dead = r.dead; break; } }

    // skála: kreslí se jen u vody; otvor v okraji je východ
    let rock = '';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!Lv.wall[y * W + x]) continue;
      let near = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && !Lv.wall[yy * W + xx]) near = true; }
      rock += near ? `<rect class="rb-rock" x="${x * S + 1}" y="${y * S + 1}" width="${S - 2}" height="${S - 2}" rx="${10 + ((x * 7 + y * 3) % 3) * 4}"/>` : `<rect class="rb-deep" x="${x * S}" y="${y * S}" width="${S}" height="${S}"/>`;
    }
    // východ: voda na okraji plánu, se šipkou ven
    let exits = '';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (Lv.wall[y * W + x] || (x > 0 && y > 0 && x < W - 1 && y < H - 1)) continue;
      const rot = x === W - 1 ? 90 : x === 0 ? 270 : y === 0 ? 0 : 180;
      exits += `<g class="rb-exit" transform="translate(${x * S + S / 2} ${y * S + S / 2}) rotate(${rot})"><rect x="${-S / 2}" y="${-S / 2}" width="${S}" height="${S}"/><path d="M0 -16l12 12h-7v12h-10v-12h-7z"/></g>`;
    }
    const objs = Lv.objects.map((o, j) => {
      const set = new Set(o.cells.map(([x, y]) => `${x},${y}`));
      let g = '';
      for (const [x, y] of o.cells) {
        g += `<rect x="${x * S + 4}" y="${y * S + 4}" width="${S - 8}" height="${S - 8}" rx="9"/>`;
        if (set.has(`${x + 1},${y}`)) g += `<rect x="${x * S + S - 8}" y="${y * S + 4}" width="16" height="${S - 8}"/>`;
        if (set.has(`${x},${y + 1}`)) g += `<rect x="${x * S + 4}" y="${y * S + S - 8}" width="${S - 8}" height="16"/>`;
      }
      const deco = o.heavy ? o.cells.map(([x, y]) => `<circle cx="${x * S + 14}" cy="${y * S + 14}" r="3.5"/><circle cx="${x * S + S - 14}" cy="${y * S + 14}" r="3.5"/><circle cx="${x * S + 14}" cy="${y * S + S - 14}" r="3.5"/><circle cx="${x * S + S - 14}" cy="${y * S + S - 14}" r="3.5"/>`).join('') : o.cells.map(([x, y]) => `<path d="M${x * S + 14} ${y * S + 20}h${S - 28}M${x * S + 14} ${y * S + S - 20}h${S - 28}"/>`).join('');
      return `<g class="rb-obj ${o.heavy ? 'heavy' : 'light'}" data-j="${j}" style="--oc:${OBJ_COL[j % OBJ_COL.length]}"><g class="body">${g}</g><g class="deco">${deco}</g></g>`;
    }).join('');
    el.innerHTML = `<div class="rb-wrap">
      <div class="rb-head"><div><small>${L('TAHY', 'MOVES')}</small><b id="rbMoves">0</b></div><div class="rb-par" title="${L('Vyřeš nejvýš tolika tahy pro tři hvězdy', 'Solve within this many moves for three stars')}"><small>${L('LIMIT', 'PAR')}</small><b>${Math.ceil(P.par * 1.25)}</b></div>
        <button class="rb-swap" data-t="swap" title="${L('Přepnout rybku (mezerník)', 'Switch fish (Space)')}"><svg viewBox="0 0 24 24"><path d="M4 8h13l-3-3M20 16H7l3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span id="rbWho"></span></button></div>
      <div class="rb-tank"><svg class="rb" viewBox="0 0 ${W * S} ${H * S}">
        <defs><linearGradient id="rbWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d4d6e"/><stop offset="1" stop-color="#061a33"/></linearGradient></defs>
        <rect width="${W * S}" height="${H * S}" fill="url(#rbWater)"/><g class="rb-rays"><path d="M${W * S * 0.2} 0l${S} 0l${-S * 2} ${H * S}l${-S} 0z"/><path d="M${W * S * 0.6} 0l${S * 0.6} 0l${-S * 1.6} ${H * S}l${-S * 0.6} 0z"/></g>
        <g class="rb-rocks">${rock}</g><g class="rb-exits">${exits}</g><g class="rb-objs">${objs}</g>
        <g class="rb-f" data-f="0"><g class="flip">${fishSVG(0)}</g></g><g class="rb-f" data-f="1"><g class="flip">${fishSVG(1)}</g></g>
      </svg><div class="rb-dead" hidden><b></b><span>${L('Vrať tah (Z) nebo začni znovu.', 'Undo (Z) or start over.')}</span></div></div>
      <div class="rb-pad"><button data-dir="u">${arrow(0)}</button><button data-dir="l">${arrow(270)}</button><button data-dir="d">${arrow(180)}</button><button data-dir="r">${arrow(90)}</button></div>
      <div class="k-tools">
        <button class="k-tool" data-t="undo">${api.icon('undo')}<span>${L('Zpět', 'Undo')}</span></button>
        <button class="k-tool" data-t="restart">${api.icon('erase')}<span>${L('Znovu', 'Restart')}</span></button>
        <button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button></div></div>`;
    function arrow(rot) { return `<svg viewBox="0 0 24 24" style="transform:rotate(${rot}deg)"><path d="M12 5l7 8h-4.5v6h-5v-6H5z" fill="currentColor"/></svg>`; }
    const svg = el.querySelector('svg.rb'), fishEls = [...el.querySelectorAll('.rb-f')], objEls = [...el.querySelectorAll('.rb-obj')], deadEl = el.querySelector('.rb-dead');
    const NAMES = [L('Malá rybka', 'Small fish'), L('Velká rybka', 'Big fish')];
    function render() {
      fishEls.forEach((g, k) => {
        const out = s[k * 2] === E.OUT;
        g.classList.toggle('out', out); g.classList.toggle('active', k === active && !out); g.classList.toggle('dead', k === dead);
        if (!out) g.style.transform = `translate(${s[k * 2] * S}px, ${s[k * 2 + 1] * S}px)`;
        const w = (k ? 3 : 2) * S;
        g.querySelector('.flip').style.transform = facing[k] < 0 ? `translate(${w}px, 0) scaleX(-1)` : '';
      });
      objEls.forEach((g, j) => { g.style.transform = `translate(${s[4 + j * 2] * S}px, ${s[5 + j * 2] * S}px)`; });
      el.querySelector('#rbMoves').textContent = moves.length;
      el.querySelector('#rbWho').textContent = NAMES[active];
      deadEl.hidden = dead < 0;
      if (dead >= 0) deadEl.querySelector('b').textContent = dead ? L('Velká rybka nepřežila', "The big fish didn't make it") : L('Malá rybka nepřežila', "The small fish didn't make it");
    }
    function select(k) { if (s[k * 2] !== E.OUT) { active = k; render(); } }
    function go(d, f = active) {
      if (done || dead >= 0) return false;
      const r = E.move(Lv, s, f, d);
      if (!r) { api.sound('error'); return false; }
      hist.push(s); s = r.s; moves.push(`${f + 1}${d}`);
      if (d === 'l') facing[f] = -1; if (d === 'r') facing[f] = 1;
      if (r.dead >= 0) { dead = r.dead; api.sound('error'); }
      else api.sound(r.pushed ? 'place' : 'soft');
      // uplavaná rybka: řízení přejde na druhou
      if (s[f * 2] === E.OUT) { api.sound('line'); if (s[(1 - f) * 2] !== E.OUT) active = 1 - f; }
      render(); api.changed(); check();
      return true;
    }
    function check() {
      if (!E.won(s)) return;
      done = true; svg.classList.add('won');
      const par = Math.ceil(P.par * 1.25), stars = moves.length <= par ? 3 : moves.length <= P.par * 2 ? 2 : 1;
      setTimeout(() => api.solved({ title: P.name, stars: hintsUsed ? Math.min(2, stars) : stars, html: `<p class="k-muted">${L(`${moves.length} tahů (limit ${par})`, `${moves.length} moves (par ${par})`)}</p>` }), 700);
    }
    function undo() {
      if (done || !hist.length) return;
      s = hist.pop(); moves.pop(); dead = -1;
      if (s[active * 2] === E.OUT) active = 1 - active;
      api.sound('erase'); render(); api.changed();
    }
    function restart() { if (done) return; s = Lv.start.slice(); E.settle(Lv, s); moves = []; hist = []; dead = -1; active = 1; api.sound('erase'); render(); api.changed(); }
    function nextMove() {
      if (moves.every((m, i) => P.sol[i] === m) && moves.length < P.sol.length) return P.sol[moves.length];
      const res = E.solve(Lv, s, 60000);
      return res ? res.path[0] : null;
    }
    function hint() {
      if (done) return;
      if (dead >= 0) { api.toast(L('Nejdřív vrať tah, rybka nepřežila.', 'Undo first, a fish did not survive.')); return; }
      const m = nextMove();
      if (!m) { api.toast(L('Odsud cestu nevidím. Vrať pár tahů.', "I can't find a way from here. Undo a few moves.")); return; }
      api.hint(); hintsUsed++; api.sound('star');
      active = +m[0] - 1; go(m[1]);
    }

    // ── ovládání ──
    let down = null;
    svg.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, f: e.target.closest('.rb-f') }; e.preventDefault(); });
    svg.addEventListener('pointerup', e => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y, f = down.f; down = null;
      if (Math.hypot(dx, dy) > 22) { go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); return; }
      if (f) { select(+f.dataset.f); api.sound('tap'); }
    });
    el.querySelector('.rb-pad').addEventListener('click', e => { const b = e.target.closest('[data-dir]'); if (b) go(b.dataset.dir); });
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t) return;
      if (t.dataset.t === 'undo') undo(); if (t.dataset.t === 'restart') restart(); if (t.dataset.t === 'hint') hint();
      if (t.dataset.t === 'swap') { select(1 - active); api.sound('tap'); }
    });
    function fit() {
      const vw = (document.getElementById('kView') || el).clientWidth - 28, hh = innerHeight - (matchMedia('(pointer: coarse)').matches ? 340 : 240);
      const w = Math.max(240, Math.min(vw, hh * W / H, 820));
      svg.style.width = w + 'px';
    }
    fit(); addEventListener('resize', fit);
    render();
    const KEYS = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' };
    return {
      getState: () => ({ m: moves, h: hintsUsed }),
      progress: () => ((s[0] === E.OUT) + (s[2] === E.OUT)) / 2,
      destroy() { removeEventListener('resize', fit); },
      onKey(e) {
        if (KEYS[e.key]) { e.preventDefault(); go(KEYS[e.key]); return; }
        if (e.key === ' ' || e.key === 'Tab') { e.preventDefault(); select(1 - active); }
        if (e.key === '1') select(0); if (e.key === '2') select(1);
        if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') undo();
        if (e.key === 'r' || e.key === 'R') restart();
        if (e.key === 'h' || e.key === 'H') hint();
      },
      _solve() { restart(); for (const m of P.sol) { active = +m[0] - 1; go(m[1]); } },
      _hint: hint,
    };
  }

  function art(el) {
    const p = generate(0, 'easy', { kind: 'level', key: 12 }), Lv = E.parse(p.rows), s = Lv.start.slice(); E.settle(Lv, s);
    const occ = E.occupancy(Lv, s), C = 26;
    let out = `<svg viewBox="0 0 ${Lv.W * C} ${Lv.H * C}"><rect width="100%" height="100%" rx="14" fill="#0b3550"/>`;
    for (let y = 0; y < Lv.H; y++) for (let x = 0; x < Lv.W; x++) {
      const v = occ[y * Lv.W + x];
      if (v === 1) out += `<rect x="${x * C + 1}" y="${y * C + 1}" width="${C - 2}" height="${C - 2}" rx="6" fill="#2b4a57"/>`;
      else if (v >= 10) { const o = Lv.objects[v - 10]; out += `<rect x="${x * C + 2}" y="${y * C + 2}" width="${C - 4}" height="${C - 4}" rx="5" fill="${o.heavy ? '#9aa7b8' : OBJ_COL[(v - 10) % OBJ_COL.length]}"/>`; }
      else if (v >= 2) out += `<rect x="${x * C + 2}" y="${y * C + 3}" width="${C - 4}" height="${C - 6}" rx="${C / 2}" fill="${v === 2 ? '#ffb547' : '#4d8bff'}"/>`;
    }
    el.innerHTML = out + '</svg>';
  }

  return { DIFFS, generate, create, art };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'rybky', title: 'RYBKY',
  tagline: Kit.L('Malá a velká rybka musí uplavat z jeskyně. Odsouvej předměty, hlídej gravitaci a nenech na rybku nic spadnout.', 'A small and a big fish must swim out of the cave. Shift things around, mind the gravity and never let anything fall on a fish.'),
  diffs: Rybky.DIFFS, generate: Rybky.generate, create: Rybky.create, art: Rybky.art,
  online: { kind: 'race' },
  rules: Kit.L(`<p>Dostaň obě rybky z jeskyně ven otvorem ve skále:</p>
    <ul><li>Ovládáš vždy jednu rybku. Přepneš mezerníkem, tlačítkem, nebo klepnutím na rybku. Pohyb: šipky / WASD, přejetí prstem, šipky pod plánem.</li>
    <li>Rybka tlačí předměty, i několik naráz a i nahoru. <b>Malá</b> pohne jen lehkými věcmi, <b>velká</b> i ocelí (šedé s nýty).</li>
    <li>Předměty bez opory padají. Když předmět <b>dopadne na rybku</b>, rybka zahyne. Ocel na zádech malé rybky ji také rozdrtí.</li>
    <li>Plave-li rybka dolů s něčím na zádech, náklad jede s ní.</li>
    <li>Z vrátí tah, R začne znovu, H poradí. Tři hvězdy za vyřešení v limitu tahů bez nápovědy.</li></ul>`,
    `<p>Get both fish out of the cave through the gap in the rock:</p>
    <ul><li>You control one fish at a time. Switch with Space, the button or by tapping a fish. Move with arrows / WASD, swipes or the arrows under the board.</li>
    <li>A fish pushes objects, several at once and even upwards. The <b>small</b> fish moves only light things, the <b>big</b> one moves steel too (grey with rivets).</li>
    <li>Unsupported objects fall. When an object <b>lands on a fish</b>, the fish dies. Steel on the small fish's back crushes it too.</li>
    <li>When a fish swims down with something on its back, the load comes along.</li>
    <li>Z undoes, R restarts, H gives a hint. Three stars for solving within par without hints.</li></ul>`),
});
