'use strict';
// ── SKLÁDAČKA · Windowling Hlavolamy ────────────────────────────────────────
// Jigsaw z generovaných vesmírných obrazů (mlhoviny, planety, galaxie, komety, krajiny).
// Dílky s klasickými zámky; přitáhni dílek k jeho místu a sám zapadne. Sousední dílky se spojí
// i mimo desku a táhnou se jako skupina; klepnutí bere nejvyšší dílek podle jeho obrysu.
const Skladacka = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'p24', name: L('24 dílků', '24 pieces'), cols: 6, rows: 4, par: 3 * 60 },
    { id: 'p48', name: L('48 dílků', '48 pieces'), cols: 8, rows: 6, par: 7 * 60 },
    { id: 'p96', name: L('96 dílků', '96 pieces'), cols: 12, rows: 8, par: 15 * 60 },
    { id: 'p150', name: L('150 dílků', '150 pieces'), cols: 15, rows: 10, par: 26 * 60 },
  ];
  const IW = 960, IH = 640;

  // obrazy maluje art.js (JgArt): motiv, denní doba a název
  const paint = seed => JgArt.paint(seed);

  // ── Tvar dílku ──
  function edge(g, ax, ay, bx, by, dir, s) {
    const dx = bx - ax, dy = by - ay, nx = dy / Math.hypot(dx, dy), ny = -dx / Math.hypot(dx, dy);
    const P = (u, v) => [ax + dx * u + nx * v * s * dir, ay + dy * u + ny * v * s * dir];
    if (!dir) { g.lineTo(bx, by); return; }
    g.lineTo(...P(0.35, 0));
    g.bezierCurveTo(...P(0.45, 0), ...P(0.38, 0.12), ...P(0.42, 0.14));
    g.bezierCurveTo(...P(0.34, 0.24), ...P(0.40, 0.31), ...P(0.50, 0.31));
    g.bezierCurveTo(...P(0.60, 0.31), ...P(0.66, 0.24), ...P(0.58, 0.14));
    g.bezierCurveTo(...P(0.62, 0.12), ...P(0.55, 0), ...P(0.65, 0));
    g.lineTo(bx, by);
  }

  function generate(seed, diffId, ctx = {}) {
    let D = DIFFS.find(d => d.id === diffId) || DIFFS[0];
    if (ctx.kind === 'daily') D = DIFFS[1];
    if (ctx.kind === 'level') { const ch = Math.floor((ctx.key - 1) / 20); const sizes = [[4, 3], [6, 4], [7, 5], [8, 6], [10, 7], [12, 8]][ch]; D = { cols: sizes[0], rows: sizes[1], par: sizes[0] * sizes[1] * 6 }; }
    const r = Kit.rng(seed ^ 0x77);
    const right = [...Array(D.rows)].map(() => [...Array(D.cols - 1)].map(() => (r() < 0.5 ? 1 : -1)));
    const bottom = [...Array(D.rows - 1)].map(() => [...Array(D.cols)].map(() => (r() < 0.5 ? 1 : -1)));
    return { seed, cols: D.cols, rows: D.rows, right, bottom, par: D.par };
  }

  function create(el, P, saved, api) {
    const { cols, rows } = P, n = cols * rows, img = paint(P.seed), cw = IW / cols, ch = IH / rows, m = Math.min(cw, ch) * 0.34;
    const r = Kit.rng(P.seed ^ 0x99);
    let st = saved && saved.pos ? saved : null, done = false;
    el.innerHTML = `<div class="jg-wrap"><div class="jg-head"><div><small>${L('UMÍSTĚNO', 'PLACED')}</small><b class="jg-count"></b><i class="jg-bar"><s></s></i></div></div>
      <div class="jg-area"><div class="jg-board"><canvas class="jg-ghost"></canvas></div></div>
      <div class="k-tools"><button class="k-tool" data-t="ghost">${api.icon('star')}<span>${L('Náhled', 'Preview')}</span></button><button class="k-tool" data-t="edges">${api.icon('plus')}<span>${L('Okraje', 'Edges')}</span></button><button class="k-tool" data-t="spread">${api.icon('undo')}<span>${L('Rozložit', 'Spread')}</span></button><button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button></div></div>`;
    const area = el.querySelector('.jg-area'), board = el.querySelector('.jg-board'), ghost = el.querySelector('.jg-ghost');
    ghost.width = IW; ghost.height = IH; ghost.getContext('2d').drawImage(img, 0, 0);
    const hitCtx = document.createElement('canvas').getContext('2d');
    // dílky: plátno s obrazem, obrys (Path2D) pro přesné klepnutí, skupina spojených dílků
    const pieces = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const t = y ? -P.bottom[y - 1][x] : 0, rr = x < cols - 1 ? P.right[y][x] : 0, b = y < rows - 1 ? P.bottom[y][x] : 0, l = x ? -P.right[y][x - 1] : 0;
      const c = document.createElement('canvas'); c.width = Math.ceil(cw + m * 2); c.height = Math.ceil(ch + m * 2); c.className = 'jg-p';
      const g = c.getContext('2d'), s = Math.min(cw, ch), path = new Path2D();
      path.moveTo(m, m);
      edge(path, m, m, m + cw, m, t, s); edge(path, m + cw, m, m + cw, m + ch, rr, s); edge(path, m + cw, m + ch, m, m + ch, b, s); edge(path, m, m + ch, m, m, l, s);
      path.closePath();
      g.save(); g.clip(path); g.drawImage(img, x * cw - m, y * ch - m, c.width, c.height, 0, 0, c.width, c.height);
      // plastický okraj: světlo zleva shora, stín zprava zdola
      const bw = Math.max(2, s * 0.035);
      g.lineWidth = bw * 2;
      g.translate(bw, bw); g.strokeStyle = 'rgba(255,255,255,.28)'; g.stroke(path);
      g.translate(-bw * 2, -bw * 2); g.strokeStyle = 'rgba(0,0,0,.42)'; g.stroke(path);
      g.restore();
      g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke(path);
      c.dataset.i = pieces.length; area.appendChild(c);
      const p = { i: pieces.length, gx: x, gy: y, el: c, path, x: 0, y: 0, z: 0, hx: x * cw, hy: y * ch, placed: false, edge: !t || !rr || !b || !l };
      p.grp = [p]; pieces.push(p);
    }
    const at = (x, y) => (x >= 0 && y >= 0 && x < cols && y < rows ? pieces[y * cols + x] : null);
    let scale = 1, bx = 0, by = 0, AW = 0, AH = 0, zTop = 10;
    const PW = cw + 2 * m, PH = ch + 2 * m;
    // pixely plochy ↔ jednotky obrazu (levý horní roh plátna dílku)
    const toImg = (ax, ay) => [(ax - bx) / scale + m, (ay - by) / scale + m];
    const groups = () => [...new Set(pieces.filter(p => !p.placed).map(p => p.grp))];
    const moveGroup = (grp, dx, dy) => grp.forEach(q => { q.x += dx; q.y += dy; });
    const box = grp => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of grp) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); } return { x0, y0, x1, y1 }; };
    // volná místa pro dílky: mřížka přes celou plochu mimo desku (při daném měřítku a poloze desky)
    function slotsFor(sc, x0, y0) {
      const pw = PW * sc, ph = PH * sc, step = Math.max(cw, ch) * sc * 1.12, mm = m * sc * 0.55, out = [];
      for (let y = 0; y + ph <= AH + 0.5; y += step) for (let x = 0; x + pw <= AW + 0.5; x += step) {
        const hit = x + pw - mm > x0 && x + mm < x0 + IW * sc && y + ph - mm > y0 && y + mm < y0 + IH * sc;
        if (!hit) out.push([x, y]);
      }
      return out;
    }
    // rozložení do volných míst (dílky se nekryjí, dokud je místo), skupiny jako celek
    function scatter() {
      const slots = slotsFor(scale, bx, by), jit = Math.max(cw, ch) * scale * 0.08;
      for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
      groups().forEach((grp, k) => {
        const sl = slots.length ? slots[k % slots.length] : [r() * AW, r() * AH], extra = slots.length && k >= slots.length ? Math.max(cw, ch) * scale * 0.3 : 0;
        const [tx, ty] = toImg(sl[0] + (r() - 0.5) * jit + extra, sl[1] + (r() - 0.5) * jit + extra), b = box(grp);
        moveGroup(grp, tx - b.x0, ty - b.y0);
      });
      clamp();
    }
    // volné skupiny drž uvnitř plochy
    function clamp() {
      const [x0, y0] = toImg(0, 0), [x1, y1] = toImg(AW - PW * scale, AH - PH * scale);
      for (const grp of groups()) {
        const b = box(grp);
        const dx = b.x0 < x0 ? x0 - b.x0 : b.x1 > x1 ? Math.max(x0 - b.x0, x1 - b.x1) : 0, dy = b.y0 < y0 ? y0 - b.y0 : b.y1 > y1 ? Math.max(y0 - b.y0, y1 - b.y1) : 0;
        if (dx || dy) moveGroup(grp, dx, dy);
      }
    }
    function fit() {
      const vw = (document.getElementById('kView') || el).clientWidth - 28, vh = innerHeight - 200;
      AW = vw; AH = Math.max(380, vh);
      const wide = AW > AH * 1.15, s0 = wide ? Math.min((AW * 0.62) / IW, (AH * 0.86) / IH) : Math.min((AW - 16) / IW, (AH * 0.55) / IH);
      // deska se zmenší, dokud se všechny dílky nevejdou vedle ní
      const pos = sc => [(AW - IW * sc) / 2, wide ? (AH - IH * sc) / 2 : 8];
      for (scale = s0; scale > s0 * 0.55; scale *= 0.95) { const [x, y] = pos(scale); if (slotsFor(scale, x, y).length >= n) break; }
      [bx, by] = pos(scale);
      area.style.width = AW + 'px'; area.style.height = AH + 'px';
      board.style.left = bx + 'px'; board.style.top = by + 'px'; board.style.width = IW * scale + 'px'; board.style.height = IH * scale + 'px';
      pieces.forEach(p => { p.el.style.width = p.el.width * scale + 'px'; p.el.style.height = p.el.height * scale + 'px'; });
      clamp(); render();
    }
    const place = p => { p.el.style.transform = `translate(${bx + (p.x - m) * scale}px, ${by + (p.y - m) * scale}px)`; };
    function render() {
      pieces.forEach(p => { place(p); p.el.classList.toggle('placed', p.placed); p.el.style.zIndex = p.placed ? 1 : p.z; });
      const k = pieces.filter(p => p.placed).length;
      el.querySelector('.jg-count').textContent = `${k} / ${n}`;
      el.querySelector('.jg-bar s').style.width = (k / n) * 100 + '%';
    }
    const raise = grp => { zTop++; grp.forEach(q => { q.z = zTop; q.el.style.zIndex = zTop; }); };
    // přesné klepnutí: nejvyšší volný dílek, jehož obrys je pod prstem (průhledné rohy plátna se nepočítají)
    function pick(cx, cy) {
      const rc = area.getBoundingClientRect(), ax = cx - rc.left, ay = cy - rc.top;
      let best = null;
      for (const p of pieces) {
        if (p.placed || (best && p.z < best.z)) continue;
        const lx = (ax - (bx + (p.x - m) * scale)) / scale, ly = (ay - (by + (p.y - m) * scale)) / scale;
        if (lx < 0 || ly < 0 || lx > PW || ly > PH) continue;
        if (hitCtx.isPointInPath(p.path, lx, ly) && (!best || p.z >= best.z)) best = p;
      }
      return best;
    }
    // spojení: sousední dílek ve správné vzájemné poloze se přicvakne a skupiny se sloučí
    const tol = Math.min(cw, ch) * 0.28;
    function join(grp) {
      for (let again = true; again;) {
        again = false;
        for (const q of grp) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nb = at(q.gx + dx, q.gy + dy);
          if (!nb || nb.placed || nb.grp === grp) continue;
          const ex = nb.x - (nb.hx - q.hx), ey = nb.y - (nb.hy - q.hy);
          if (Math.hypot(ex - q.x, ey - q.y) < tol) {
            moveGroup(grp, ex - q.x, ey - q.y);
            const other = nb.grp; for (const o of other) { o.grp = grp; grp.push(o); }
            raise(grp); again = true; break;
          }
        }
      }
      return grp;
    }
    function flash(grp) { grp.forEach(q => { q.el.classList.remove('snap'); void q.el.offsetWidth; q.el.classList.add('snap'); }); setTimeout(() => grp.forEach(q => q.el.classList.remove('snap')), 450); }
    let drag = null;
    area.addEventListener('pointerdown', e => {
      if (done) return;
      const p = pick(e.clientX, e.clientY); if (!p) return;
      e.preventDefault(); try { area.setPointerCapture(e.pointerId); } catch (err) { /* ukazatel už neplatí */ }
      raise(p.grp); p.grp.forEach(q => q.el.classList.add('drag'));
      drag = { grp: p.grp, x0: e.clientX, y0: e.clientY, start: p.grp.map(q => [q.x, q.y]) };
    });
    area.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = (e.clientX - drag.x0) / scale, dy = (e.clientY - drag.y0) / scale;
      drag.grp.forEach((q, k) => { q.x = drag.start[k][0] + dx; q.y = drag.start[k][1] + dy; place(q); });
    });
    const drop = () => {
      if (!drag) return; const grp = drag.grp; drag = null; grp.forEach(q => q.el.classList.remove('drag'));
      const before = grp.length;
      join(grp);
      const home = grp.find(q => Math.hypot(q.x - q.hx, q.y - q.hy) < tol);
      if (home) { grp.forEach(q => { q.x = q.hx; q.y = q.hy; q.placed = true; }); api.sound('place'); flash(grp); }
      else if (grp.length > before) { api.sound('tap'); flash(grp); }
      else api.sound('soft');
      clamp(); render(); api.changed(); check();
    };
    area.addEventListener('pointerup', drop); area.addEventListener('pointercancel', drop);
    function check() {
      if (!pieces.every(p => p.placed) || done) return;
      done = true; board.classList.add('done'); area.classList.add('done');
      const g = api.data.gallery = api.data.gallery || []; if (!g.includes(P.seed)) { g.push(P.seed); if (g.length > 200) g.shift(); }
      // odhalení: švy zmizí, obraz se rozzáří v rámu a ukáže se jeho název
      const title = img.jgTitle ? img.jgTitle[Kit.LANG === 'en' ? 1 : 0] : '';
      const rv = document.createElement('div'); rv.className = 'jg-reveal';
      rv.style.left = bx + 'px'; rv.style.top = by + 'px'; rv.style.width = IW * scale + 'px'; rv.style.height = IH * scale + 'px';
      const rc = document.createElement('canvas'); rc.width = IW; rc.height = IH; rc.getContext('2d').drawImage(img, 0, 0); rv.appendChild(rc);
      const cap = document.createElement('div'); cap.className = 'jg-cap'; cap.innerHTML = `<small>${L('Složil jsi', 'You assembled')}</small><b></b>`; cap.querySelector('b').textContent = title; rv.appendChild(cap);
      area.appendChild(rv); api.sound('win');
      setTimeout(() => {
        api.solved({ html: `<div class="jg-res"><canvas width="480" height="320"></canvas><b></b></div><p class="k-muted">${L('Obraz je ve tvé galerii', 'The picture is in your gallery')}</p>` });
        // náhled hotového obrazu ve výsledku (vložený až po vykreslení karty)
        setTimeout(() => document.querySelectorAll('.jg-res').forEach(box => { const cv = box.querySelector('canvas'); if (cv && !cv.dataset.done) { cv.dataset.done = 1; cv.getContext('2d').drawImage(img, 0, 0, 480, 320); box.querySelector('b').textContent = title; } }), 30);
      }, 3200);
    }
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t || done) return;
      if (t.dataset.t === 'ghost') { board.classList.toggle('show'); t.classList.toggle('on'); }
      if (t.dataset.t === 'spread') { scatter(); render(); api.changed(); }
      if (t.dataset.t === 'edges') {
        // krajní dílky dopředu, ostatní na chvíli ztlumit
        scatter(); pieces.filter(p => !p.placed && p.grp.some(q => q.edge)).forEach(p => raise(p.grp)); render();
        pieces.filter(p => !p.placed && !p.grp.some(q => q.edge)).forEach(p => { p.el.style.opacity = '.25'; });
        setTimeout(() => pieces.forEach(p => { p.el.style.opacity = ''; }), 2500);
      }
      if (t.dataset.t === 'hint') {
        // nápověda položí jednu volnou skupinu (nejmenší) na místo
        const grp = groups().sort((a, b) => a.length - b.length)[0]; if (!grp) return;
        api.hint(); grp.forEach(q => { q.x = q.hx; q.y = q.hy; q.placed = true; }); flash(grp); api.sound('star'); render(); api.changed(); check();
      }
    });
    fit();
    if (st) {
      const byId = new Map();
      st.pos.forEach((q, i) => {
        const p = pieces[i]; if (!p) return;
        p.x = q[0]; p.y = q[1]; p.placed = !!q[2];
        if (q[3] !== undefined && !p.placed) { const g = byId.get(q[3]) || []; byId.set(q[3], g); g.push(p); }
      });
      for (const g of byId.values()) g.forEach(p => (p.grp = g));
    } else scatter();
    pieces.forEach(p => (p.z = ++zTop));
    fit();
    addEventListener('resize', fit);
    return {
      getState: () => (done ? null : { pos: pieces.map(p => [Math.round(p.x), Math.round(p.y), p.placed ? 1 : 0, p.grp[0].i]) }),
      progress: () => pieces.filter(p => p.placed).length / pieces.length,
      destroy() { removeEventListener('resize', fit); },
      onKey(e) { if (e.key === 'h' || e.key === 'H') el.querySelector('[data-t="hint"]').click(); },
      _solve() { pieces.forEach(p => { p.x = p.hx; p.y = p.hy; p.placed = true; }); render(); check(); },
      // testy: střed těla dílku na obrazovce a kam by šel (cílová poloha vůči jinému dílku nebo desce)
      _center(i) { const p = pieces[i], rc = area.getBoundingClientRect(); return [rc.left + bx + (p.x + cw / 2 - m) * scale, rc.top + by + (p.y + ch / 2 - m) * scale]; },
      _target(i, j) { const p = pieces[i], rc = area.getBoundingClientRect(); const x = j === undefined ? p.hx : pieces[j].x + (p.hx - pieces[j].hx), y = j === undefined ? p.hy : pieces[j].y + (p.hy - pieces[j].hy); return [rc.left + bx + (x + cw / 2 - m) * scale, rc.top + by + (y + ch / 2 - m) * scale]; },
      _put(i, ax, ay) { const p = pieces[i]; moveGroup(p.grp, ax - p.x, ay - p.y); render(); },
      _group: i => pieces[i].grp.length,
      _cols: cols,
    };
  }

  const gallery = { icon: 'brush', name: L('Galerie', 'Gallery'), badge: s => ((s.data && s.data.gallery) || []).length,
    render(el, save) {
      const g = (save.data.gallery || []).slice().reverse();
      el.innerHTML = `<h2>${L('Galerie', 'Gallery')}</h2><p class="k-muted">${L(`Složené obrazy: ${g.length}.`, `Pictures completed: ${g.length}.`)}</p><div class="jg-gal">${g.map((s, k) => `<canvas data-g="${k}" width="240" height="160"></canvas>`).join('') || `<p class="k-muted">${L('Zatím prázdná.', 'Empty so far.')}</p>`}</div>`;
      el.querySelectorAll('canvas[data-g]').forEach(cv => { const pic = paint(g[+cv.dataset.g]); cv.getContext('2d').drawImage(pic, 0, 0, 240, 160); if (pic.jgTitle) cv.title = pic.jgTitle[Kit.LANG === 'en' ? 1 : 0]; });
    } };
  function art(el) { const src = paint(Kit.hash('jart' + Kit.dayKey())), c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); c.className = 'jg-art'; el.innerHTML = ''; el.appendChild(c); }
  return { DIFFS, generate, create, art, gallery, paint };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'skladacka', title: 'SKLÁDAČKA', wording: 'play',
  tagline: Kit.L('Jigsaw z malovaných obrazů: maják nad mořem, horské jezero, balóny nad údolím, korálový útes, pohádkový hrad, sakurová zahrada, polární záře i planeta s prstenci. Co skládáš, poznáš až na konci, a každý obraz skončí v galerii.', 'A jigsaw of painted pictures: a lighthouse by the sea, a mountain lake, balloons over a valley, a coral reef, a fairytale castle, a cherry blossom garden, the northern lights and a ringed planet. You only find out what you built at the end, and every picture joins your gallery.'),
  diffs: Skladacka.DIFFS, generate: Skladacka.generate, create: Skladacka.create, art: Skladacka.art, views: [Skladacka.gallery],
  online: { kind: 'race' },
  dailyDiff: () => 'p48', levelDiff: n => ['p24', 'p24', 'p48', 'p48', 'p96', 'p96'][Math.floor((n - 1) / 20)],
  rules: Kit.L(`<p>Poskládej obraz z dílků. Přetáhni dílek k jeho místu na desce a když je dost blízko, sám zapadne.</p>
    <ul><li><b>Spojování:</b> přilož k sobě dílky, které spolu sousedí, a spojí se i mimo desku. Pak je přenášíš jako celek.</li>
    <li>Dílek bereš tam, kde je vidět; průhledné okolí dílku nad ním nepřekáží.</li>
    <li><b>Náhled</b> ukáže slabý obrys celého obrazu na desce.</li>
    <li><b>Okraje</b> vytáhnou krajní dílky dopředu, ostatní na chvíli ztlumí.</li>
    <li><b>Rozložit</b> znovu rozhází volné dílky kolem desky.</li>
    <li><b>Nápověda</b> položí jeden dílek (nebo nejmenší spojenou skupinu) na místo (počítá se do hvězd).</li></ul>`,
    `<p>Assemble the picture. Drag a piece to its place on the board; when it is close enough it snaps in.</p>
    <ul><li><b>Joining:</b> put neighbouring pieces together and they join even off the board. Then you move them as one.</li>
    <li>You grab the piece you can see; the transparent area around a piece above it does not get in the way.</li>
    <li><b>Preview</b> shows a faint image of the whole picture on the board.</li>
    <li><b>Edges</b> brings border pieces forward and dims the rest for a moment.</li>
    <li><b>Spread</b> scatters the loose pieces around the board again.</li>
    <li><b>Hint</b> places one piece (or the smallest joined group) (counts against stars).</li></ul>`),
  achievements: [{ id: 'jg25', name: Kit.L('Galerista', 'Curator'), desc: Kit.L('25 složených obrazů', '25 completed pictures'), prog: s => [((s.data && s.data.gallery) || []).length, 25] }],
});
