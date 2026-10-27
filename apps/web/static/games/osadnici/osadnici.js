'use strict';
// ── OSADNÍCI · Windowling Hlavolamy ─────────────────────────────────────────
// Budovatelská desková hra na ostrově ze šestiúhelníků: suroviny, cesty, osady, města, zloděj a
// akční karty. Proti 1 nebo 3 počítačovým hráčům, denní ostrov pro všechny stejný, Cesta a online
// ve dvou. Pravidla a počítačoví hráči jsou v core.js; tady se akce kreslí a animují. Online tah
// je seznam akcí jednoho hráče, dokud nepředá hru soupeři.
const Osadnici = (() => {
  const L = Kit.L, C = OsCore, G = C.G, S = 60;
  const COLORS = ['#e0453a', '#2f6fe0', '#f08a24', '#f4f1e8'], DARK = ['#8e1d16', '#173f8f', '#9a4f0c', '#6d6758'];
  const BOTS = [L('Pepa', 'Joe'), L('Máňa', 'Mary'), L('Jarda', 'Jack')];
  const RES = [L('dřevo', 'wood'), L('cihly', 'brick'), L('vlna', 'wool'), L('obilí', 'grain'), L('ruda', 'ore')];
  const RCOL = ['#2f7d3a', '#c0532f', '#8fcf55', '#e9c44a', '#8c8f99'];
  const TILE = ['#3f8f45', '#c9703f', '#a5d867', '#ecc94f', '#9a9ca6'], DESERT = '#e8d5a2';
  const DEVN = [L('Rytíř', 'Knight'), L('Vítězný bod', 'Victory point'), L('Stavba silnic', 'Road building'), L('Vynález', 'Year of plenty'), L('Monopol', 'Monopoly')];
  const DIFFS = [
    { id: 'dva', name: L('Dva hráči', 'Two players'), note: L('ty proti počítači', 'you against the computer'), par: 1200 },
    { id: 'ctyri', name: L('Čtyři hráči', 'Four players'), note: L('plný ostrov', 'a full island'), par: 1500 },
    { id: 'mistr', name: L('Mistři', 'Masters'), note: L('tři zkušení soupeři', 'three seasoned rivals'), par: 1800 },
  ];
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'online') return { seed, n: 2, online: true };
    if (ctx.kind === 'daily') return { seed, n: 4, level: 2 };
    if (ctx.kind === 'level') { const k = ctx.key; return { seed, n: k <= 40 ? 2 : 4, level: k <= 20 || (k > 40 && k <= 70) ? 1 : k <= 100 ? 2 : 3 }; }
    return { seed, n: diffId === 'dva' ? 2 : 4, level: diffId === 'mistr' ? 3 : 2 };
  }

  // ── Kresby ──
  const ICON = [
    '<rect x="2" y="8" width="18" height="9" rx="4.5" fill="#8a5a2b" stroke="#4a2c10" stroke-width="1.2"/><ellipse cx="18" cy="12.5" rx="3.2" ry="4.5" fill="#e0b070" stroke="#4a2c10" stroke-width="1.2"/><circle cx="18" cy="12.5" r="1.2" fill="#8a5a2b"/>',
    '<g stroke="#5a2010" stroke-width="1.1" fill="#d2603a"><rect x="2" y="12" width="9.5" height="5.5"/><rect x="12.5" y="12" width="9.5" height="5.5"/><rect x="7" y="6" width="9.5" height="5.5"/></g>',
    '<g fill="#fff" stroke="#6a6a6a" stroke-width="1"><circle cx="9" cy="10" r="4"/><circle cx="14" cy="9" r="4"/><circle cx="12" cy="14" r="4"/><circle cx="7" cy="14" r="3.5"/><circle cx="16.5" cy="13" r="3.5"/></g><ellipse cx="20" cy="11" rx="2.6" ry="2" fill="#333"/>',
    '<path d="M12 22V6" stroke="#9a7a20" stroke-width="1.6"/><g fill="#f1c84a" stroke="#9a7a20" stroke-width="1"><ellipse cx="9.5" cy="9" rx="2" ry="3.2" transform="rotate(-25 9.5 9)"/><ellipse cx="14.5" cy="9" rx="2" ry="3.2" transform="rotate(25 14.5 9)"/><ellipse cx="9.5" cy="14" rx="2" ry="3.2" transform="rotate(-25 9.5 14)"/><ellipse cx="14.5" cy="14" rx="2" ry="3.2" transform="rotate(25 14.5 14)"/><ellipse cx="12" cy="4.5" rx="1.8" ry="3"/></g>',
    '<path d="M3 18l4-9 4 2 3-6 7 13z" fill="#7d8190" stroke="#3a3d48" stroke-width="1.2" stroke-linejoin="round"/><path d="M11 11l3-6 2 4" fill="none" stroke="#c9ccd6" stroke-width="1.2"/>',
  ];
  const resIcon = (i, cls = '') => `<svg class="os-ri ${cls}" viewBox="0 0 24 24">${ICON[i]}</svg>`;
  const DEVICON = [
    '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" fill="#7a5bd6" stroke="#3b2a7a" stroke-width="1.4"/><path d="M12 7v10M8.5 10.5h7" stroke="#fff" stroke-width="1.8"/>',
    '<path d="M3 18h18M4 15L3 7l5 4 4-6 4 6 5-4-1 8z" fill="#f4c542" stroke="#8a6a10" stroke-width="1.4" stroke-linejoin="round"/>',
    '<path d="M4 20L10 4M20 20L14 4" stroke="#6b4a2a" stroke-width="2.4"/><path d="M12 6v2M12 11v2M12 16v3" stroke="#f4c542" stroke-width="2"/>',
    '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" fill="#4fc4e8" stroke="#1d6a85" stroke-width="1.3" stroke-linejoin="round"/>',
    '<circle cx="12" cy="12" r="8.5" fill="#f4c542" stroke="#8a6a10" stroke-width="1.6"/><text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="800" fill="#8a6a10">M</text>',
  ];
  const devIcon = k => `<svg class="os-ri" viewBox="0 0 24 24">${DEVICON[k]}</svg>`;
  const hexPts = (x, y, r) => [...Array(6)].map((_, i) => { const a = (Math.PI / 180) * (60 * i - 90); return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
  function deco(res, x, y) {
    const spots = [[-24, -24], [22, -26], [-28, 16], [26, 18], [0, 34]];
    const at = (k, f) => spots.slice(0, k).map(([dx, dy]) => f(x + dx, y + dy)).join('');
    switch (res) {
      case 0: return at(5, (a, b) => `<path d="M${a} ${b - 13}l9 15h-18z" fill="#1f5e29"/><path d="M${a} ${b - 18}l7 11h-14z" fill="#2a7434"/><rect x="${a - 1.5}" y="${b + 2}" width="3" height="5" fill="#5a3a1a"/>`);
      case 1: return at(4, (a, b) => `<g fill="#a8482a" stroke="#6a2a14" stroke-width="1"><rect x="${a - 10}" y="${b}" width="10" height="6"/><rect x="${a}" y="${b}" width="10" height="6"/><rect x="${a - 5}" y="${b - 6}" width="10" height="6"/></g>`);
      case 2: return at(4, (a, b) => `<g fill="#fff" stroke="#8a8a8a" stroke-width=".8"><ellipse cx="${a}" cy="${b}" rx="8" ry="5.5"/></g><ellipse cx="${a + 8}" cy="${b - 2}" rx="3" ry="2.4" fill="#333"/><path d="M${a - 4} ${b + 5}v4M${a + 3} ${b + 5}v4" stroke="#333" stroke-width="1.4"/>`);
      case 3: return at(5, (a, b) => `<g stroke="#a8841f" stroke-width="1.6" fill="none"><path d="M${a - 5} ${b + 8}q1-10 0-16M${a} ${b + 8}v-18M${a + 5} ${b + 8}q-1-10 0-16"/></g><g fill="#f6dc7a"><ellipse cx="${a - 5}" cy="${b - 9}" rx="1.8" ry="3"/><ellipse cx="${a}" cy="${b - 11}" rx="1.8" ry="3"/><ellipse cx="${a + 5}" cy="${b - 9}" rx="1.8" ry="3"/></g>`);
      case 4: return at(4, (a, b) => `<path d="M${a - 13} ${b + 8}l9-18 5 7 4-5 9 16z" fill="#6f7380" stroke="#3a3d48" stroke-width="1"/><path d="M${a - 4} ${b - 10}l3 5-4 1z" fill="#fff"/>`);
      default: return `<path d="M${x - 30} ${y + 26}q15-10 30 0t30 0" fill="none" stroke="#c9b27a" stroke-width="2"/><g fill="#5e9a4a"><rect x="${x + 18}" y="${y - 30}" width="6" height="22" rx="3"/><rect x="${x + 12}" y="${y - 22}" width="4" height="9" rx="2"/></g>`;
    }
  }
  const house = (x, y, p, city) => city
    ? `<g class="os-bld"><path d="M${x - 14} ${y + 10}V${y - 3}l7-7 7 7V${y - 8}h14V${y + 10}z" fill="${COLORS[p]}" stroke="${DARK[p]}" stroke-width="2.4" stroke-linejoin="round"/><rect x="${x + 3}" y="${y - 3}" width="4" height="4" fill="${DARK[p]}" opacity=".6"/></g>`
    : `<g class="os-bld"><path d="M${x - 9} ${y + 8}V${y - 2}l9-9 9 9V${y + 8}z" fill="${COLORS[p]}" stroke="${DARK[p]}" stroke-width="2.4" stroke-linejoin="round"/></g>`;
  const robberSvg = (x, y) => `<g class="os-robber"><ellipse cx="${x}" cy="${y + 15}" rx="11" ry="4" fill="rgba(0,0,0,.35)"/><path d="M${x - 9} ${y + 15}c0-9 4-12 5-17h8c1 5 5 8 5 17z" fill="#2b2b33" stroke="#000" stroke-width="1.5"/><circle cx="${x}" cy="${y - 8}" r="7" fill="#2b2b33" stroke="#000" stroke-width="1.5"/></g>`;
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const dieFace = d => `<span class="os-face">${[...Array(9)].map((_, i) => `<i class="${d && PIPS[d].includes(i) ? 'on' : ''}"></i>`).join('')}</span>`;
  // ostrov jako SVG (pole, čísla, přístavy); kusy a zloděj se kreslí zvlášť
  function islandSvg(B) {
    let out = `<polygon points="${[...Array(6)].map((_, i) => { const a = (Math.PI / 180) * 60 * i; return `${(345 * Math.cos(a)).toFixed(1)},${(345 * Math.sin(a)).toFixed(1)}`; }).join(' ')}" fill="#2a6aa6" stroke="#1d4f80" stroke-width="6" stroke-linejoin="round"/>`;
    out += `<polygon points="${[...Array(6)].map((_, i) => { const a = (Math.PI / 180) * 60 * i; return `${(320 * Math.cos(a)).toFixed(1)},${(320 * Math.sin(a)).toFixed(1)}`; }).join(' ')}" fill="#3b85c4" stroke="#6fb0e3" stroke-width="2" stroke-dasharray="4 8" stroke-linejoin="round"/>`;
    // přístavy
    G.ports.forEach((e, i) => {
      const E = G.edges[e], t = G.tiles[E.t[0]], dx = E.x - t.x, dy = E.y - t.y, d = Math.hypot(dx, dy), ox = (E.x + (dx / d) * 0.62) * S, oy = (E.y + (dy / d) * 0.62) * S, type = B.portType[i];
      for (const v of [E.a, E.b]) out += `<line x1="${G.verts[v].x * S}" y1="${G.verts[v].y * S}" x2="${ox}" y2="${oy}" stroke="#8a6a3a" stroke-width="5" stroke-linecap="round"/>`;
      out += `<circle cx="${ox}" cy="${oy}" r="17" fill="${type === '*' ? '#fff8e6' : RCOL[type]}" stroke="#5a4020" stroke-width="2"/>`;
      out += type === '*' ? `<text x="${ox}" y="${oy + 5}" class="os-port">3:1</text>` : `<g transform="translate(${ox - 10} ${oy - 15}) scale(.85)">${ICON[type]}</g><text x="${ox}" y="${oy + 13}" class="os-port small">2:1</text>`;
    });
    G.tiles.forEach((t, i) => {
      const x = t.x * S, y = t.y * S, res = B.res[i];
      out += `<polygon points="${hexPts(x, y, S - 1.5)}" fill="${res < 0 ? DESERT : TILE[res]}" stroke="#f2e2b5" stroke-width="3" stroke-linejoin="round"/>`;
      out += deco(res, x, y);
      const n = B.num[i];
      if (n) out += `<g class="os-num"><circle cx="${x}" cy="${y}" r="17" fill="#f8efd4" stroke="#7a5a2a" stroke-width="2"/><text x="${x}" y="${y + 4}" class="${n === 6 || n === 8 ? 'hot' : ''}">${n}</text>${[...Array(C.pips(n))].map((_, k, a) => `<circle cx="${x + (k - (a.length - 1) / 2) * 4}" cy="${y + 10}" r="1.4" fill="${n === 6 || n === 8 ? '#c22' : '#333'}"/>`).join('')}</g>`;
    });
    return out;
  }

  function create(el, P, saved, api, opts = {}) {
    const net = P.online ? opts.net : null, online = !!net;
    const me = online ? (net.side === 1 ? 0 : 1) : 0;
    const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    const names = [...Array(P.n)].map((_, p) => (p === me ? L('Ty', 'You') : online ? esc(net.opp) : BOTS[(p - 1 + 3) % 3]));
    const s = C.start(P.seed, P.n), log = [];
    const r = Kit.rng((P.seed ^ 0x5e77) >>> 0);
    if (saved && Array.isArray(saved.log)) for (const a of saved.log) if (C.apply(s, a)) log.push(a);
    if (online) for (const m of net.moves) for (const a of C.decode(m)) C.apply(s, a);
    let done = false, speed = 1, auto = false, busy = false, mode = null, panel = null, wake = null, gotMove = null, myTurns = 0;
    const incoming = [], buf = [];

    el.innerHTML = `<div class="os-wrap"><div class="os-players"></div><div class="os-status"></div>
      <div class="os-board"><svg viewBox="-350 -310 700 620"><g class="os-island">${islandSvg(s.B)}</g><g class="os-pieces"></g><g class="os-hot"></g></svg></div>
      <div class="os-hand"></div><div class="os-panel" hidden></div><div class="os-bar"></div>
      <div class="k-tools"><button class="k-tool" data-t="resign">${api.icon('x')}<span>${L('Vzdát', 'Resign')}</span></button></div></div>`;
    const $ = q => el.querySelector(q);
    const board = $('.os-board'), svg = $('.os-board svg'), piecesEl = $('.os-pieces'), hotEl = $('.os-hot'), statusEl = $('.os-status'), handEl = $('.os-hand'), barEl = $('.os-bar'), panelEl = $('.os-panel');
    let statusMain = '', statusSub = '';
    const setStatus = (b, sub = '') => { statusMain = b; statusSub = sub; statusEl.innerHTML = `<b>${b}</b>${sub ? `<span>${sub}</span>` : ''}`; };
    const wait = ms => new Promise(res => setTimeout(res, ms / speed));
    const resList = arr => arr.map((k, i) => (k ? `${k}× ${resIcon(i, 'in')}` : '')).filter(Boolean).join(' ');
    const myMove = () => s.cur === me && s.winner < 0 && !done;

    // ── Kreslení ──
    function drawPieces() {
      let out = '';
      G.edges.forEach((e, i) => {
        const o = s.eo[i]; if (o < 0) return;
        const A = G.verts[e.a], B = G.verts[e.b], x1 = (A.x * 0.82 + B.x * 0.18) * S, y1 = (A.y * 0.82 + B.y * 0.18) * S, x2 = (B.x * 0.82 + A.x * 0.18) * S, y2 = (B.y * 0.82 + A.y * 0.18) * S;
        out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DARK[o]}" stroke-width="13" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COLORS[o]}" stroke-width="8" stroke-linecap="round"/>`;
      });
      const t = G.tiles[s.robber];
      out += robberSvg(t.x * S + (s.B.num[s.robber] ? 24 : 0), t.y * S - 4);
      G.verts.forEach((v, i) => { if (s.vb[i] >= 0) out += house(v.x * S, v.y * S, s.vb[i], s.vc[i]); });
      piecesEl.innerHTML = out;
    }
    function curMode() {
      if (!myMove() || busy || auto) return null;
      if (s.phase === 'setS') return 'S';
      if (s.phase === 'setR') return 'R';
      if (s.phase === 'rob') return 'rob';
      if (s.phase === 'main' && s.free > 0) return 'road';
      return s.phase === 'main' ? mode : null;
    }
    function drawHot() {
      const m = curMode();
      let out = '';
      const spot = v => `<circle class="os-spot" data-v="${v}" cx="${G.verts[v].x * S}" cy="${G.verts[v].y * S}" r="12"/>`;
      if (m === 'S') G.verts.forEach((_, v) => { if (C.canSettle(s, me, v, true)) out += spot(v); });
      if (m === 'set') C.settleSpots(s, me).forEach(v => (out += spot(v)));
      if (m === 'city') C.citySpots(s, me).forEach(v => (out += spot(v)));
      const lane = e => { const E = G.edges[e], A = G.verts[E.a], B = G.verts[E.b]; return `<line class="os-lane" data-e="${e}" x1="${A.x * S}" y1="${A.y * S}" x2="${B.x * S}" y2="${B.y * S}"/>`; };
      if (m === 'R') G.verts[s.last].e.filter(e => s.eo[e] < 0).forEach(e => (out += lane(e)));
      if (m === 'road') C.roadSpots(s, me).forEach(e => (out += lane(e)));
      if (m === 'rob') G.tiles.forEach((t, i) => { if (i !== s.robber) out += `<polygon class="os-tile" data-t="${i}" points="${hexPts(t.x * S, t.y * S, S - 4)}"/>`; });
      hotEl.innerHTML = out;
      board.classList.toggle('picking', !!m);
    }
    function players() {
      $('.os-players').innerHTML = [...Array(P.n).keys()].map(p => {
        const cards = C.sum(s.res[p]), devs = C.sum(s.dev[p]), v = p === me ? C.vp(s, p) : C.publicVp(s, p);
        return `<span class="${s.cur === p && s.winner < 0 ? 'turn' : ''}" style="--c:${COLORS[p]};--d:${DARK[p]}"><i></i><b>${names[p]}</b><em title="${L('vítězné body', 'victory points')}">${v}</em>
          <small title="${L('karty surovin', 'resource cards')}">${resIcon(0, 'in g')}${cards}</small>${devs ? `<small title="${L('akční karty', 'development cards')}">${devIcon(0)}${devs}</small>` : ''}
          ${s.knights[p] ? `<small class="${s.army === p ? 'gold' : ''}" title="${L('rytíři', 'knights')}">⚔${s.knights[p]}</small>` : ''}<small class="${s.longest === p ? 'gold' : ''}" title="${L('nejdelší cesta', 'longest road')}">⟿${s.roadLen[p]}</small></span>`;
      }).join('');
    }
    function hand() {
      const R = s.res[me], D = s.dev[me];
      let out = R.map((k, i) => `<span class="os-card ${k ? '' : 'none'}" style="--rc:${RCOL[i]}" title="${RES[i]}">${resIcon(i)}<b>${k}</b></span>`).join('');
      out += [0, 2, 3, 4].filter(k => D[k]).map(k => `<button class="os-devc" data-dev="${k}" ${C.playable(s, me, k) && !busy && !auto && myMove() ? '' : 'disabled'} title="${DEVN[k]}">${devIcon(k)}<b>${D[k]}</b><small>${DEVN[k]}</small></button>`).join('');
      if (D[1]) out += `<span class="os-devc vp" title="${DEVN[1]}">${devIcon(1)}<b>${D[1]}</b><small>${DEVN[1]}</small></span>`;
      handEl.innerHTML = out;
    }
    const costDots = c => `<span class="os-cost">${c.map((k, i) => `<i style="background:${RCOL[i]}"></i>`.repeat(k)).join('')}</span>`;
    function bar() {
      const my = myMove() && !busy && !auto, main = my && s.phase === 'main', full = buf.join(',').length > 280;
      const can = {
        road: main && !full && (s.free > 0 || C.afford(s, me, C.COST.road)) && C.count(s, me, 'road') < C.LIMIT.road && C.roadSpots(s, me).length > 0,
        set: main && !full && C.afford(s, me, C.COST.set) && C.count(s, me, 'set') < C.LIMIT.set && C.settleSpots(s, me).length > 0,
        city: main && !full && C.afford(s, me, C.COST.city) && C.count(s, me, 'city') < C.LIMIT.city && C.citySpots(s, me).length > 0,
        dev: main && !full && C.afford(s, me, C.COST.dev) && s.dp < s.deck.length,
        trade: main && !full && [0, 1, 2, 3, 4].some(g => s.res[me][g] >= C.rate(s, me, g)),
      };
      const btn = (id, label, cost) => `<button class="os-act ${mode === id && curMode() === id ? 'on' : ''}" data-a="${id}" ${can[id] ? '' : 'disabled'}><span>${label}</span>${cost ? costDots(cost) : ''}</button>`;
      const rollable = my && s.phase === 'roll';
      barEl.innerHTML = `<button class="os-dice ${rollable ? 'go' : ''}" data-a="roll" ${rollable ? '' : 'disabled'} aria-label="${L('Hodit kostkami', 'Roll the dice')}">${dieFace(s.dice[0])}${dieFace(s.dice[1])}</button>
        ${btn('road', L('Cesta', 'Road'), s.free > 0 ? null : C.COST.road)}${btn('set', L('Osada', 'Settlement'), C.COST.set)}${btn('city', L('Město', 'City'), C.COST.city)}${btn('dev', L('Karta', 'Card'), C.COST.dev)}${btn('trade', L('Směna', 'Trade'))}
        <button class="os-act end" data-a="end" ${main && s.free === 0 ? '' : 'disabled'}><span>${L('Konec tahu', 'End turn')}</span></button>`;
    }
    function render() { drawPieces(); drawHot(); players(); hand(); bar(); }
    function prompt() {
      if (done) return;
      if (s.winner >= 0) return;
      if (!myMove()) return;
      if (auto) return setStatus(L('Hraje automat…', 'Autoplay…'));
      const step = s.step >= s.n ? L('druhou', 'second') : L('první', 'first');
      if (s.phase === 'setS') setStatus(L(`Postav ${step} osadu`, `Place your ${step} settlement`), L('ťukni na volnou křižovatku (osady nesmí stát vedle sebe)', 'tap a free corner (settlements cannot be neighbours)'));
      else if (s.phase === 'setR') setStatus(L('Postav k ní cestu', 'Add a road next to it'), s.step >= s.n ? L('za druhou osadu dostaneš suroviny z okolních polí', 'your second settlement gives you the resources around it') : '');
      else if (s.phase === 'roll') setStatus(L('Hoď kostkami', 'Roll the dice'), C.playable(s, me, 0) ? L('nebo nejdřív zahraj rytíře', 'or play a knight first') : L('ťukni na kostky nebo stiskni mezerník', 'tap the dice or press space'));
      else if (s.phase === 'rob') setStatus(L('Přesuň zloděje', 'Move the robber'), L('ťukni na pole: přestane vynášet a sebereš kartu hráči u něj', 'tap a tile: it stops producing and you steal a card from a player there'));
      else if (s.free > 0) setStatus(L(`Postav zdarma ${s.free === 2 ? 'dvě cesty' : 'cestu'}`, `Build ${s.free} free road${s.free === 2 ? 's' : ''}`));
      else if (mode === 'road') setStatus(L('Kam postavit cestu?', 'Where should the road go?'));
      else if (mode === 'set') setStatus(L('Kam postavit osadu?', 'Where should the settlement go?'));
      else if (mode === 'city') setStatus(L('Kterou osadu povýšit na město?', 'Which settlement becomes a city?'));
    }

    // ── Popis události ──
    const said = (p, me2, other) => (p === me ? me2 : `${names[p]} ${other}`);
    function describe(ev) {
      const p = ev.p;
      switch (ev.type) {
        case 'set': return said(p, L('Stavíš osadu', 'You build a settlement'), L('staví osadu', 'builds a settlement')) + (ev.gain && C.sum(ev.gain) ? `<span>${p === me ? L('dostáváš', 'you get') : L('dostává', 'gets')} ${resList(ev.gain)}</span>` : '');
        case 'road': return said(p, L('Stavíš cestu', 'You build a road'), L('staví cestu', 'builds a road'));
        case 'city': return said(p, L('Stavíš město', 'You build a city'), L('staví město', 'builds a city'));
        case 'roll': {
          let t = `${said(p, L('Hodil jsi', 'You rolled'), L('hodil', 'rolled'))} ${ev.total}`;
          if (ev.total === 7) {
            t += ` · ${L('zloděj!', 'robber!')}`;
            const lost = ev.lost[me];
            if (C.sum(lost)) t += `<span>${L('odhazuješ', 'you discard')} ${resList(lost)}</span>`;
          } else {
            const parts = [...Array(P.n)].map((_, q) => (C.sum(ev.gain[q]) ? (q === me ? `${L('ty', 'you')} ${resList(ev.gain[q])}` : `${names[q]} +${C.sum(ev.gain[q])}`) : '')).filter(Boolean);
            t += `<span>${parts.length ? parts.join(' · ') : L('nikdo nic nedostal', 'nobody gets anything')}</span>`;
          }
          return t;
        }
        case 'rob': {
          let t = said(p, L('Přesunul jsi zloděje', 'You moved the robber'), L('přesunul zloděje', 'moved the robber'));
          if (ev.victim === me) t += `<span>${L('a ukradl ti', 'and stole your')} ${resIcon(ev.card, 'in')} ${RES[ev.card]}</span>`;
          else if (p === me && ev.victim >= 0) t += `<span>${L('a bereš hráči', 'and take from')} ${names[ev.victim]} ${resIcon(ev.card, 'in')} ${RES[ev.card]}</span>`;
          else if (ev.victim >= 0) t += `<span>${L('a bere kartu hráči', 'and takes a card from')} ${names[ev.victim]}</span>`;
          return t;
        }
        case 'buy': return p === me ? `${L('Kupuješ kartu', 'You buy a card')}: ${DEVN[ev.k]}` : `${names[p]} ${L('kupuje akční kartu', 'buys a development card')}`;
        case 'knight': return said(p, L('Hraješ rytíře', 'You play a knight'), L('hraje rytíře', 'plays a knight'));
        case 'roads': return said(p, L('Hraješ stavbu silnic', 'You play road building'), L('hraje stavbu silnic', 'plays road building'));
        case 'plenty': return said(p, L('Vynález', 'Year of plenty'), L('hraje vynález', 'plays year of plenty')) + `<span>+ ${resIcon(ev.r[0], 'in')} ${resIcon(ev.r[1], 'in')}</span>`;
        case 'mono': return said(p, L('Monopol', 'Monopoly'), L('hraje monopol', 'plays monopoly')) + `<span>${RES[ev.r]}: ${ev.got}×</span>`;
        case 'trade': return said(p, L('Směňuješ', 'You trade'), L('směňuje', 'trades')) + `<span>${ev.k}× ${resIcon(ev.g, 'in')} → 1× ${resIcon(ev.w, 'in')}</span>`;
        case 'end': return ev.next === me ? L('Jsi na tahu', 'Your turn') : `${L('Na tahu je', 'Now playing:')} ${names[ev.next]}`;
      }
      return '';
    }
    const SOUND = { set: 'place', road: 'soft', city: 'line', roll: 'tap', rob: 'error', buy: 'ui', knight: 'error', trade: 'soft', plenty: 'star', mono: 'star', roads: 'ui' };

    // ── Akce ──
    function act(a, fromNet) {
      if (done) return null;
      const actor = s.cur, ev = C.apply(s, a);
      if (!ev) return null;
      log.push(a);
      if (online && actor === me && !fromNet) buf.push(a);
      const d = describe(ev);
      if (d) { const [b, sub] = d.split('<span>'); setStatus(b, sub ? sub.replace('</span>', '') : ''); }
      if (ev.type === 'roll') api.sound(ev.total === 7 ? 'error' : 'tap');
      else if (SOUND[ev.type] && !(ev.type === 'road' && actor !== me && speed > 4)) api.sound(SOUND[ev.type]);
      if (ev.type === 'rob' && ev.victim === me) api.sound('error');
      if (ev.type !== 'set' && ev.type !== 'road' && ev.type !== 'city') mode = null;
      if (s.phase !== 'main') mode = null;
      if (online && actor === me && (s.cur !== me || s.winner >= 0) && buf.length) { net.send(C.encode(buf)); buf.length = 0; }
      render();
      return ev;
    }
    async function botTurn(level) {
      const p = s.cur;
      for (let guard = 0; guard < 80 && s.cur === p && s.winner < 0 && !done; guard++) {
        const a = C.aiStep(s, level, r);
        const ev = act(a) || (s.phase === 'main' ? act('E') : null);
        if (!ev) break;
        await wait(ev.type === 'roll' ? 900 : ev.type === 'end' ? 500 : ev.type === 'trade' ? 450 : 650);
      }
    }
    async function myTurn() {
      myTurns++;
      while (myMove()) {
        if (auto) { const ev = act(C.aiStep(s, 3, r)) || (s.phase === 'main' ? act('E') : null); if (!ev) break; await wait(150); continue; }
        prompt(); render();
        await new Promise(res => (wake = res)); wake = null;
      }
      api.changed();
    }
    async function loop() {
      while (!done && s.winner < 0) {
        if (s.cur === me) await myTurn();
        else if (online) {
          setStatus(L(`Hraje ${names[s.cur]}…`, `${names[s.cur]} is playing…`), statusMain);
          render();
          const m = incoming.length ? incoming.shift() : await new Promise(res => (gotMove = res));
          gotMove = null;
          for (const a of C.decode(m)) { if (done) break; const ev = act(a, true); if (ev) await wait(ev.type === 'roll' ? 800 : 450); }
        } else await botTurn(P.level || 2);
      }
      if (s.winner >= 0) finish();
    }
    function finish() {
      if (done) return; done = true; api.setTimer(false); render();
      const won = s.winner === me, v = C.vp(s, me);
      setStatus(won ? L('Vyhrál jsi!', 'You won!') : L(`Vyhrává ${names[s.winner]}`, `${names[s.winner]} wins`), L(`${C.vp(s, s.winner)} vítězných bodů`, `${C.vp(s, s.winner)} victory points`));
      api.sound(won ? 'win' : 'error');
      if (online) { setTimeout(() => net.end(won ? net.side : -net.side, 'vp'), 600); return; }
      setTimeout(() => {
        if (won) api.solved({ title: L('Ostrov je tvůj!', 'The island is yours!'), stars: myTurns <= 22 ? 3 : myTurns <= 32 ? 2 : 1, html: `<p class="k-muted">${L(`Tahy: ${myTurns}`, `Turns: ${myTurns}`)}</p>` });
        else api.failed({ title: L(`Vyhrál ${names[s.winner]}`, `${names[s.winner]} won`), html: `<p class="k-muted">${L(`Měl jsi ${v} z ${C.WIN} bodů`, `You had ${v} of ${C.WIN} points`)}</p>` });
      }, 900);
    }
    const poke = () => { if (wake) wake(); };

    // ── Panely: směna, vynález, monopol, výběr oběti ──
    function openPanel(kind, data) {
      panel = { kind, data, give: -1, get: -1, picks: [] };
      drawPanel();
    }
    function closePanel() { panel = null; panelEl.hidden = true; panelEl.innerHTML = ''; }
    function drawPanel() {
      if (!panel) return closePanel();
      const R = s.res[me], row = (sel, dis, label) => [0, 1, 2, 3, 4].map(i => `<button class="os-pick ${sel(i) ? 'on' : ''}" data-r="${i}" ${dis(i) ? 'disabled' : ''} style="--rc:${RCOL[i]}">${resIcon(i)}<small>${label(i)}</small></button>`).join('');
      let out = '';
      if (panel.kind === 'trade') {
        out = `<b>${L('Směna s bankou a přístavy', 'Trade with the bank and harbours')}</b>
          <div class="os-row" data-row="give"><span>${L('Dáš', 'Give')}</span>${row(i => panel.give === i, i => R[i] < C.rate(s, me, i), i => `${C.rate(s, me, i)}:1`)}</div>
          <div class="os-row" data-row="get"><span>${L('Dostaneš', 'Get')}</span>${row(i => panel.get === i, i => i === panel.give, () => '1')}</div>
          <div class="os-row"><button class="k-btn" data-p="ok" ${panel.give >= 0 && panel.get >= 0 ? '' : 'disabled'}>${L('Směnit', 'Trade')}</button><button class="k-btn ghost" data-p="close">${L('Zavřít', 'Close')}</button></div>`;
      } else if (panel.kind === 'plenty') {
        out = `<b>${L('Vynález: vyber dvě suroviny', 'Year of plenty: pick two resources')}</b><div class="os-row">${row(i => panel.picks.includes(i), () => false, i => (panel.picks.filter(x => x === i).length ? '+' + panel.picks.filter(x => x === i).length : RES[i]))}</div>
          <div class="os-row"><button class="k-btn ghost" data-p="close">${L('Zpět', 'Back')}</button></div>`;
      } else if (panel.kind === 'mono') {
        out = `<b>${L('Monopol: kterou surovinu ti všichni odevzdají?', 'Monopoly: which resource must everyone hand over?')}</b><div class="os-row">${row(() => false, () => false, i => RES[i])}</div>
          <div class="os-row"><button class="k-btn ghost" data-p="close">${L('Zpět', 'Back')}</button></div>`;
      } else if (panel.kind === 'victim') {
        out = `<b>${L('Komu sebrat kartu?', 'Steal from whom?')}</b><div class="os-row">${panel.data.vic.map(q => `<button class="k-btn" data-victim="${q}" style="--c:${COLORS[q]}">${names[q]} · ${C.sum(s.res[q])} ${L('karet', 'cards')}</button>`).join('')}</div>`;
      }
      panelEl.innerHTML = out; panelEl.hidden = false;
    }
    panelEl.addEventListener('click', e => {
      if (!panel || !myMove()) return;
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.p === 'close') return closePanel();
      if (panel.kind === 'victim' && b.dataset.victim) { const t = panel.data.t; closePanel(); act('X' + t + '.' + b.dataset.victim); return poke(); }
      const i = +b.dataset.r;
      if (panel.kind === 'trade') {
        if (b.dataset.p === 'ok') { act('T' + panel.give + panel.get); panel.give = s.res[me][panel.give] >= C.rate(s, me, panel.give) ? panel.give : -1; panel.get = -1; drawPanel(); return poke(); }
        if (b.closest('[data-row="give"]')) { panel.give = i; if (panel.get === i) panel.get = -1; } else panel.get = i;
        return drawPanel();
      }
      if (panel.kind === 'plenty') { panel.picks.push(i); if (panel.picks.length === 2) { const [x, y] = panel.picks; closePanel(); act('Y' + x + y); return poke(); } return drawPanel(); }
      if (panel.kind === 'mono') { closePanel(); act('M' + i); return poke(); }
    });

    // ── Ovládání ──
    svg.addEventListener('click', e => {
      const m = curMode(); if (!m) return;
      const t = e.target.closest('[data-v],[data-e],[data-t]'); if (!t) return;
      if (t.dataset.v !== undefined) { act((m === 'S' ? 'S' : m === 'set' ? 's' : 'c') + t.dataset.v); if (s.phase === 'main' && s.free === 0) mode = null; }
      else if (t.dataset.e !== undefined) { act((m === 'R' ? 'R' : 'r') + t.dataset.e); if (s.free === 0 && !(C.afford(s, me, C.COST.road) && mode === 'road')) mode = null; }
      else if (t.dataset.t !== undefined) {
        const tile = +t.dataset.t, vic = C.victims(s, me, tile);
        if (vic.length > 1) return openPanel('victim', { t: tile, vic });
        act('X' + tile + (vic.length ? '.' + vic[0] : ''));
      }
      render(); prompt(); poke();
    });
    barEl.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled || !myMove() || busy) return;
      const a = b.dataset.a;
      if (a === 'roll') { closePanel(); act('D'); }
      else if (a === 'end') { closePanel(); mode = null; act('E'); }
      else if (a === 'dev') act('B');
      else if (a === 'trade') { mode = null; panel && panel.kind === 'trade' ? closePanel() : openPanel('trade'); }
      else { closePanel(); mode = mode === a ? null : a; }
      render(); prompt(); poke();
    });
    handEl.addEventListener('click', e => {
      const b = e.target.closest('[data-dev]'); if (!b || b.disabled || !myMove()) return;
      const k = +b.dataset.dev;
      if (k === 0) { closePanel(); act('K'); } else if (k === 2) { closePanel(); act('P'); } else if (k === 3) openPanel('plenty'); else if (k === 4) openPanel('mono');
      render(); prompt(); poke();
    });
    $('[data-t="resign"]').addEventListener('click', () => { if (done) return; done = true; poke(); if (online) net.resign(); else api.failed({ title: L('Vzdáno', 'Resigned') }); });
    if (online) net.onMove = m => { if (gotMove) gotMove(m); else incoming.push(m); };
    function fit() { const vw = (document.getElementById('kView') || el).clientWidth - 16, w = Math.max(290, Math.min(vw, innerHeight - 330, 680)); board.style.width = w + 'px'; board.style.height = w * (620 / 700) + 'px'; }
    fit(); addEventListener('resize', fit); render(); api.setTimer(true);
    if (s.winner >= 0) finish(); else { prompt(); loop(); }
    return {
      getState: () => (done || online ? null : { log: log.slice() }),
      destroy() { done = true; removeEventListener('resize', fit); poke(); },
      onKey(e) {
        if (e.key === 'Escape') { mode = null; closePanel(); render(); prompt(); return; }
        if ((e.key === ' ' || e.key === 'Enter') && myMove()) {
          e.preventDefault();
          if (s.phase === 'roll') act('D'); else if (s.phase === 'main' && s.free === 0 && !panel) act('E');
          render(); prompt(); poke();
        }
      },
      _state: () => ({ phase: s.phase, cur: s.cur, me, t: s.t, vp: [...Array(P.n)].map((_, p) => C.vp(s, p)), winner: s.winner, done, log: log.length }),
      _act(a) { const ev = act(a); render(); prompt(); poke(); return !!ev; },
      _auto(on) { auto = on !== false; closePanel(); poke(); },
      _speed(n) { speed = Math.max(1, n); },
      _solve() { done = true; api.solved({ title: L('Ostrov je tvůj!', 'The island is yours!') }); },
    };
  }
  function art(el) {
    const B = C.board(7);
    el.innerHTML = `<svg class="os-art" viewBox="-350 -310 700 620">${islandSvg(B)}${house(G.verts[10].x * S, G.verts[10].y * S, 0, true)}${house(G.verts[30].x * S, G.verts[30].y * S, 1, false)}${house(G.verts[44].x * S, G.verts[44].y * S, 2, false)}</svg>`;
  }
  return { DIFFS, generate, create, art, islandSvg, house, COLORS };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'osadnici', title: 'OSADNÍCI',
  tagline: Kit.L('Budovatelská desková hra na ostrově: sbírej suroviny, stav cesty, osady a města a jako první získej 10 vítězných bodů.', 'A building board game on an island: gather resources, build roads, settlements and cities and be the first to reach 10 victory points.'),
  diffs: Osadnici.DIFFS, generate: Osadnici.generate, create: Osadnici.create, art: Osadnici.art,
  online: { kind: 'turn' },
  dailyDiff: () => 'ctyri', levelDiff: n => (n <= 40 ? 'dva' : 'ctyri'),
  rules: Kit.L(`<p>Ostrov tvoří 19 polí: les dává <b>dřevo</b>, hlína <b>cihly</b>, pastvina <b>vlnu</b>, pole <b>obilí</b> a hory <b>rudu</b>, poušť nic. Na začátku si každý postaví dvě osady s cestou (za druhou dostane suroviny z okolí).</p>
    <ul><li>Na začátku tahu hodíš dvěma kostkami: každé pole s padlým číslem vynese surovinu všem osadám (1) a městům (2) na svých rozích.</li>
    <li><b>Cesta</b> = dřevo + cihly, <b>osada</b> = dřevo + cihly + vlna + obilí, <b>město</b> = 2 obilí + 3 rudy, <b>akční karta</b> = vlna + obilí + ruda.</li>
    <li>Osady stojí na křižovatkách, nikdy vedle sebe, a musí navazovat na tvou cestu.</li>
    <li>Padne-li <b>sedmička</b>, kdo má víc než 7 karet, polovinu odhodí (vždy ze suroviny, které má nejvíc), a hráč na tahu přesune zloděje: pole přestane vynášet a sebere kartu někomu, kdo u něj staví.</li>
    <li>Akční karty: <b>rytíř</b> přesune zloděje, <b>stavba silnic</b> dá dvě cesty zdarma, <b>vynález</b> dvě suroviny, <b>monopol</b> sebere všem jednu surovinu, <b>vítězný bod</b> se počítá sám. Za tah jde zahrát jen jedna karta a ne ta, kterou sis právě koupil.</li>
    <li>Směňuje se s bankou 4 : 1, v přístavu 3 : 1, ve specializovaném přístavu 2 : 1.</li>
    <li>Body: osada 1, město 2, nejdelší cesta (aspoň 5) 2, největší vojsko (aspoň 3 rytíři) 2, vítězný bod 1. Vyhrává, kdo jako první na svém tahu dosáhne <b>10 bodů</b>.</li>
    <li>Mapa, kostky i balíček karet se počítají ze semínka partie: denní ostrov a online hra jsou pro oba stejné.</li></ul>`,
    `<p>The island has 19 tiles: forests give <b>wood</b>, hills <b>brick</b>, pastures <b>wool</b>, fields <b>grain</b> and mountains <b>ore</b>; the desert gives nothing. To start, everyone places two settlements with a road (the second one yields the resources around it).</p>
    <ul><li>Each turn starts with a roll of two dice: every tile showing that number gives its resource to each settlement (1) and city (2) on its corners.</li>
    <li><b>Road</b> = wood + brick, <b>settlement</b> = wood + brick + wool + grain, <b>city</b> = 2 grain + 3 ore, <b>development card</b> = wool + grain + ore.</li>
    <li>Settlements sit on corners, never next to each other, and must connect to your road.</li>
    <li>On a <b>seven</b>, anyone holding more than 7 cards discards half (always from their largest pile), and the player moves the robber: that tile stops producing and they steal a card from someone building there.</li>
    <li>Development cards: a <b>knight</b> moves the robber, <b>road building</b> gives two free roads, <b>year of plenty</b> two resources, <b>monopoly</b> takes one resource from everyone, a <b>victory point</b> just counts. You may play one card per turn, never one bought this turn.</li>
    <li>Trade with the bank at 4 : 1, at a harbour 3 : 1, at a special harbour 2 : 1.</li>
    <li>Points: settlement 1, city 2, longest road (at least 5) 2, largest army (at least 3 knights) 2, victory point card 1. The first to reach <b>10 points</b> on their own turn wins.</li>
    <li>The map, the dice and the card deck come from the game's seed: the daily island and online games are the same for both players.</li></ul>`),
  achievements: [],
});
