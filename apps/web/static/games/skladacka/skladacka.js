'use strict';
// ── SKLÁDAČKA · Windowling Hlavolamy ────────────────────────────────────────
// Jigsaw z generovaných vesmírných obrazů (mlhoviny, planety, galaxie, komety, krajiny).
// Dílky s klasickými zámky; přitáhni dílek k jeho místu a sám zapadne.
const Skladacka = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'p24', name: L('24 dílků', '24 pieces'), cols: 6, rows: 4, par: 3 * 60 },
    { id: 'p48', name: L('48 dílků', '48 pieces'), cols: 8, rows: 6, par: 7 * 60 },
    { id: 'p96', name: L('96 dílků', '96 pieces'), cols: 12, rows: 8, par: 15 * 60 },
    { id: 'p150', name: L('150 dílků', '150 pieces'), cols: 15, rows: 10, par: 26 * 60 },
  ];
  const IW = 960, IH = 640;

  // ── Malba obrazu ──
  function noiseCanvas(r, w, h, hue) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), d = g.createImageData(w, h);
    const v = [...Array((w + 1) * (h + 1))].map(() => r());
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = v[y * (w + 1) + x], i = (y * w + x) * 4, s = Math.pow(a, 3); d.data[i] = 120 + 120 * Math.sin(hue); d.data[i + 1] = 80; d.data[i + 2] = 200; d.data[i + 3] = s * 255; }
    g.putImageData(d, 0, 0); return c;
  }
  function paint(seed) {
    const r = Kit.rng(seed), c = document.createElement('canvas'); c.width = IW; c.height = IH;
    const g = c.getContext('2d'), h = r() * 360, kind = Math.floor(r() * 5);
    const bg = g.createLinearGradient(0, 0, IW * 0.3, IH);
    bg.addColorStop(0, `hsl(${h + 230} 60% 7%)`); bg.addColorStop(1, `hsl(${h + 260} 55% 3%)`);
    g.fillStyle = bg; g.fillRect(0, 0, IW, IH);
    // mlhovina
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const x = r() * IW, y = r() * IH, rad = 140 + r() * 320, hh = h + (r() - 0.5) * 140;
      const rg = g.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, `hsla(${hh} 85% 55% / ${0.16 + r() * 0.2})`); rg.addColorStop(1, `hsla(${hh} 85% 40% / 0)`);
      g.fillStyle = rg; g.fillRect(0, 0, IW, IH);
    }
    for (let k = 0; k < 2; k++) { const nc = noiseCanvas(r, 24, 16, h / 57 + k); g.globalAlpha = 0.35; g.imageSmoothingEnabled = true; g.filter = 'blur(18px)'; g.drawImage(nc, 0, 0, IW, IH); g.filter = 'none'; g.globalAlpha = 1; }
    // hvězdy
    for (let i = 0; i < 520; i++) { const x = r() * IW, y = r() * IH, s = r() < 0.94 ? r() * 1.4 + 0.3 : r() * 2.5 + 1.2; g.fillStyle = `hsla(${h + r() * 60} 60% ${80 + r() * 20}% / ${0.4 + r() * 0.6})`; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); if (s > 2.2) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - s * 4, y); g.lineTo(x + s * 4, y); g.moveTo(x, y - s * 4); g.lineTo(x, y + s * 4); g.stroke(); } }
    g.globalCompositeOperation = 'source-over';
    const px = IW * (0.3 + r() * 0.4), py = IH * (0.35 + r() * 0.3);
    if (kind === 0 || kind === 3) { // planeta s prstencem
      const R = 110 + r() * 80, ph = h + 120 + r() * 80, tilt = (r() - 0.5) * 0.8;
      const ring = (front) => { g.save(); g.translate(px, py); g.rotate(tilt); g.scale(1, 0.28); g.lineWidth = 26; for (let k = 0; k < 4; k++) { g.strokeStyle = `hsla(${ph + k * 15} 70% ${55 + k * 6}% / .55)`; g.beginPath(); g.arc(0, 0, R * (1.45 + k * 0.13), front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); g.stroke(); } g.restore(); };
      ring(false);
      const pg = g.createRadialGradient(px - R * 0.35, py - R * 0.4, R * 0.1, px, py, R); pg.addColorStop(0, `hsl(${ph} 80% 72%)`); pg.addColorStop(0.6, `hsl(${ph + 20} 70% 45%)`); pg.addColorStop(1, `hsl(${ph + 40} 60% 14%)`);
      g.fillStyle = pg; g.beginPath(); g.arc(px, py, R, 0, Math.PI * 2); g.fill();
      g.save(); g.beginPath(); g.arc(px, py, R, 0, Math.PI * 2); g.clip(); for (let k = 0; k < 7; k++) { g.fillStyle = `hsla(${ph + k * 9} 70% ${40 + (k % 3) * 12}% / .35)`; g.fillRect(px - R, py - R + k * R * 0.3 + Math.sin(k) * 10, R * 2, R * 0.12 + r() * 10); } g.restore();
      ring(true);
      const glow = g.createRadialGradient(px, py, R, px, py, R * 1.3); glow.addColorStop(0, `hsla(${ph} 90% 70% / .35)`); glow.addColorStop(1, 'transparent'); g.fillStyle = glow; g.fillRect(0, 0, IW, IH);
    }
    if (kind === 1) { // spirální galaxie
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2600; i++) { const arm = i % 2, t = r() * 4.2, a = t + arm * Math.PI + (r() - 0.5) * 0.5, rad = 20 + t * 55 + r() * 18; const x = px + Math.cos(a) * rad * 1.3, y = py + Math.sin(a) * rad * 0.6; g.fillStyle = `hsla(${h + 180 + t * 20} 80% ${60 + r() * 30}% / ${0.25 + r() * 0.5})`; g.fillRect(x, y, 1.6, 1.6); }
      const core = g.createRadialGradient(px, py, 0, px, py, 90); core.addColorStop(0, 'rgba(255,240,220,.95)'); core.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = core; g.fillRect(0, 0, IW, IH);
      g.globalCompositeOperation = 'source-over';
    }
    if (kind === 2) { // kometa
      const ang = r() * Math.PI * 2, len = 380;
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 60; k++) { const t = k / 60, x = px - Math.cos(ang) * len * t, y = py - Math.sin(ang) * len * t; const rg = g.createRadialGradient(x, y, 0, x, y, 12 + t * 50); rg.addColorStop(0, `hsla(${h + 160} 90% 80% / ${0.25 * (1 - t)})`); rg.addColorStop(1, 'transparent'); g.fillStyle = rg; g.fillRect(x - 70, y - 70, 140, 140); }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 9, 0, Math.PI * 2); g.fill();
    }
    if (kind === 3 || kind === 4) { // krajina s měsíci
      if (kind === 4) for (let k = 0; k < 2; k++) { const mx = IW * (0.15 + r() * 0.7), my = IH * (0.15 + r() * 0.25), mr = 30 + r() * 50, mh = h + 60 * k; const mg = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 2, mx, my, mr); mg.addColorStop(0, `hsl(${mh} 40% 85%)`); mg.addColorStop(1, `hsl(${mh} 35% 35%)`); g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill(); }
      for (let layer = 0; layer < 3; layer++) {
        const base = IH * (0.62 + layer * 0.11), amp = 60 - layer * 15;
        g.fillStyle = `hsl(${h + 250 - layer * 10} ${40 - layer * 8}% ${16 - layer * 4}%)`;
        g.beginPath(); g.moveTo(0, IH);
        const f1 = 0.005 + r() * 0.01, f2 = 0.02 + r() * 0.02, o1 = r() * 10, o2 = r() * 10;
        for (let x = 0; x <= IW; x += 8) g.lineTo(x, base - Math.abs(Math.sin(x * f1 + o1)) * amp - Math.sin(x * f2 + o2) * amp * 0.3);
        g.lineTo(IW, IH); g.closePath(); g.fill();
      }
    }
    return c;
  }

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
    // stav: pozice dílků (v jednotkách obrazu), umístěné
    let st = saved && saved.pos ? saved : null, done = false;
    el.innerHTML = `<div class="jg-wrap"><div class="jg-head"><div><small>${L('UMÍSTĚNO', 'PLACED')}</small><b class="jg-count"></b></div></div>
      <div class="jg-area"><div class="jg-board"><canvas class="jg-ghost"></canvas></div></div>
      <div class="k-tools"><button class="k-tool" data-t="ghost">${api.icon('star')}<span>${L('Náhled', 'Preview')}</span></button><button class="k-tool" data-t="edges">${api.icon('plus')}<span>${L('Okraje', 'Edges')}</span></button><button class="k-tool" data-t="spread">${api.icon('undo')}<span>${L('Rozložit', 'Spread')}</span></button><button class="k-tool" data-t="hint">${api.icon('bulb')}<span>${L('Nápověda', 'Hint')}</span></button></div></div>`;
    const area = el.querySelector('.jg-area'), board = el.querySelector('.jg-board'), ghost = el.querySelector('.jg-ghost');
    ghost.width = IW; ghost.height = IH; ghost.getContext('2d').drawImage(img, 0, 0);
    const pieces = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const t = y ? -P.bottom[y - 1][x] : 0, rr = x < cols - 1 ? P.right[y][x] : 0, b = y < rows - 1 ? P.bottom[y][x] : 0, l = x ? -P.right[y][x - 1] : 0;
      const c = document.createElement('canvas'); c.width = Math.ceil(cw + m * 2); c.height = Math.ceil(ch + m * 2); c.className = 'jg-p';
      const g = c.getContext('2d'), s = Math.min(cw, ch);
      g.beginPath(); g.moveTo(m, m);
      edge(g, m, m, m + cw, m, t, s); edge(g, m + cw, m, m + cw, m + ch, rr, s); edge(g, m + cw, m + ch, m, m + ch, b, s); edge(g, m, m + ch, m, m, l, s);
      g.closePath(); g.save(); g.clip(); g.drawImage(img, x * cw - m, y * ch - m, c.width, c.height, 0, 0, c.width, c.height); g.restore();
      g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke(); g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.5)'; g.stroke();
      c.dataset.i = pieces.length; area.appendChild(c);
      pieces.push({ el: c, x: 0, y: 0, hx: x * cw, hy: y * ch, placed: false, edge: !t || !rr || !b || !l });
    }
    let scale = 1, bx = 0, by = 0, AW = 0, AH = 0, zTop = 10;
    // pixely plochy ↔ jednotky obrazu (levý horní roh plátna dílku)
    const toImg = (ax, ay) => [(ax - bx) / scale + m, (ay - by) / scale + m];
    function bands() {
      const pw = (cw + 2 * m) * scale, ph = (ch + 2 * m) * scale, out = [];
      const left = bx - pw, right = AW - pw - (bx + IW * scale), below = AH - ph - (by + IH * scale + 6);
      if (left > 4) out.push([0, 0, left, AH - ph]);
      if (right > 4) out.push([bx + IW * scale, 0, right, AH - ph]);
      if (below > 4) out.push([0, by + IH * scale + 6, AW - pw, below]);
      return out.length ? out : [[0, 0, Math.max(1, AW - pw), Math.max(1, AH - ph)]];
    }
    function scatter(onlyLoose) {
      const B = bands(), total = B.reduce((a, b) => a + b[2] * b[3], 0);
      for (const p of pieces) {
        if (p.placed) continue;
        let k = r() * total, band = B[0];
        for (const b of B) { if (k < b[2] * b[3]) { band = b; break; } k -= b[2] * b[3]; }
        [p.x, p.y] = toImg(band[0] + r() * band[2], band[1] + r() * band[3]);
        if (onlyLoose === 'edges' && p.edge) p.el.style.zIndex = ++zTop;
      }
      if (onlyLoose === 'edges') {
        pieces.filter(p => !p.placed && !p.edge).forEach(p => { p.el.style.opacity = '.25'; });
        setTimeout(() => pieces.forEach(p => { p.el.style.opacity = ''; }), 2500);
      }
    }
    function fit() {
      const vw = (document.getElementById('kView') || el).clientWidth - 28, vh = innerHeight - 200;
      AW = vw; AH = Math.max(380, vh);
      const wide = AW > AH * 1.15;
      scale = wide ? Math.min((AW * 0.62) / IW, (AH * 0.86) / IH) : Math.min((AW - 16) / IW, (AH * 0.55) / IH);
      bx = wide ? (AW - IW * scale) / 2 : (AW - IW * scale) / 2; by = wide ? (AH - IH * scale) / 2 : 8;
      area.style.width = AW + 'px'; area.style.height = AH + 'px';
      board.style.left = bx + 'px'; board.style.top = by + 'px'; board.style.width = IW * scale + 'px'; board.style.height = IH * scale + 'px';
      pieces.forEach(p => { p.el.style.width = p.el.width * scale + 'px'; p.el.style.height = p.el.height * scale + 'px'; });
      // dílky mimo plochu vrať dovnitř
      const [x0, y0] = toImg(0, 0), [x1, y1] = toImg(AW - (cw + 2 * m) * scale, AH - (ch + 2 * m) * scale);
      pieces.forEach(p => { if (p.placed) return; p.x = Math.max(x0, Math.min(p.x, x1)); p.y = Math.max(y0, Math.min(p.y, y1)); });
      render();
    }
    function render() {
      pieces.forEach(p => { p.el.style.transform = `translate(${bx + (p.x - m) * scale}px, ${by + (p.y - m) * scale}px)`; p.el.classList.toggle('placed', p.placed); if (p.placed) p.el.style.zIndex = 1; });
      el.querySelector('.jg-count').textContent = `${pieces.filter(p => p.placed).length} / ${n}`;
    }
    // táhnutí
    let drag = null;
    area.addEventListener('pointerdown', e => {
      const c = e.target.closest('.jg-p'); if (!c || done) return;
      const p = pieces[+c.dataset.i]; if (p.placed) return;
      // zásah jen do neprůhledné části (jinak vyber dílek pod ním)
      e.preventDefault(); area.setPointerCapture(e.pointerId);
      p.el.style.zIndex = ++zTop; p.el.classList.add('drag');
      drag = { p, x0: e.clientX, y0: e.clientY, px: p.x, py: p.y };
    });
    area.addEventListener('pointermove', e => { if (!drag) return; drag.p.x = drag.px + (e.clientX - drag.x0) / scale; drag.p.y = drag.py + (e.clientY - drag.y0) / scale; drag.p.el.style.transform = `translate(${bx + (drag.p.x - m) * scale}px, ${by + (drag.p.y - m) * scale}px)`; });
    area.addEventListener('pointerup', () => {
      if (!drag) return; const p = drag.p; drag = null; p.el.classList.remove('drag');
      const tol = Math.min(cw, ch) * 0.3;
      if (Math.hypot(p.x - p.hx, p.y - p.hy) < tol) { p.x = p.hx; p.y = p.hy; p.placed = true; api.sound('place'); p.el.classList.add('snap'); setTimeout(() => p.el.classList.remove('snap'), 400); }
      else api.sound('soft');
      render(); api.changed(); check();
    });
    function check() {
      if (!pieces.every(p => p.placed) || done) return;
      done = true; board.classList.add('done'); area.classList.add('done');
      const g = api.data.gallery = api.data.gallery || []; if (!g.includes(P.seed)) { g.push(P.seed); if (g.length > 200) g.shift(); }
      setTimeout(() => api.solved({ html: `<p class="k-muted">${L('Obraz je ve tvé galerii', 'The picture is in your gallery')}</p>` }), 900);
    }
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t || done) return;
      if (t.dataset.t === 'ghost') { board.classList.toggle('show'); t.classList.toggle('on'); }
      if (t.dataset.t === 'spread') { scatter(); render(); api.changed(); }
      if (t.dataset.t === 'edges') { scatter('edges'); render(); }
      if (t.dataset.t === 'hint') { const p = pieces.find(q => !q.placed); if (!p) return; api.hint(); p.x = p.hx; p.y = p.hy; p.placed = true; p.el.classList.add('snap'); api.sound('star'); render(); api.changed(); check(); }
    });
    fit();
    if (st) st.pos.forEach((q, i) => { if (pieces[i]) { pieces[i].x = q[0]; pieces[i].y = q[1]; pieces[i].placed = !!q[2]; } });
    else scatter();
    fit();
    addEventListener('resize', fit);
    return {
      getState: () => (done ? null : { pos: pieces.map(p => [Math.round(p.x), Math.round(p.y), p.placed ? 1 : 0]) }),
      destroy() { removeEventListener('resize', fit); },
      onKey(e) { if (e.key === 'h' || e.key === 'H') el.querySelector('[data-t="hint"]').click(); },
      _solve() { pieces.forEach(p => { p.x = p.hx; p.y = p.hy; p.placed = true; }); render(); check(); },
    };
  }

  const gallery = { icon: 'brush', name: L('Galerie', 'Gallery'), badge: s => ((s.data && s.data.gallery) || []).length,
    render(el, save) {
      const g = (save.data.gallery || []).slice().reverse();
      el.innerHTML = `<h2>${L('Galerie', 'Gallery')}</h2><p class="k-muted">${L(`Složené obrazy: ${g.length}.`, `Pictures completed: ${g.length}.`)}</p><div class="jg-gal">${g.map((s, k) => `<canvas data-g="${k}" width="240" height="160"></canvas>`).join('') || `<p class="k-muted">${L('Zatím prázdná.', 'Empty so far.')}</p>`}</div>`;
      el.querySelectorAll('canvas[data-g]').forEach(cv => cv.getContext('2d').drawImage(paint(g[+cv.dataset.g]), 0, 0, 240, 160));
    } };
  function art(el) { const c = paint(Kit.hash('jart' + Kit.dayKey())); c.className = 'jg-art'; el.innerHTML = ''; el.appendChild(c); }
  return { DIFFS, generate, create, art, gallery, paint };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'skladacka', title: 'SKLÁDAČKA',
  tagline: Kit.L('Jigsaw z vesmírných obrazů: mlhoviny, planety s prstenci, galaxie a komety. Každý obraz je nový a skončí v galerii.', 'A jigsaw of cosmic paintings: nebulae, ringed planets, galaxies and comets. Every picture is new and joins your gallery.'),
  diffs: Skladacka.DIFFS, generate: Skladacka.generate, create: Skladacka.create, art: Skladacka.art, views: [Skladacka.gallery],
  dailyDiff: () => 'p48', levelDiff: n => ['p24', 'p24', 'p48', 'p48', 'p96', 'p96'][Math.floor((n - 1) / 20)],
  rules: Kit.L(`<p>Poskládej obraz z dílků. Přetáhni dílek k jeho místu na desce a když je dost blízko, sám zapadne.</p>
    <ul><li><b>Náhled</b> ukáže slabý obrys celého obrazu na desce.</li>
    <li><b>Okraje</b> vytáhnou krajní dílky dopředu, ostatní na chvíli ztlumí.</li>
    <li><b>Rozložit</b> znovu rozhází volné dílky kolem desky.</li>
    <li><b>Nápověda</b> položí jeden dílek na místo (počítá se do hvězd).</li></ul>`,
    `<p>Assemble the picture. Drag a piece to its place on the board; when it is close enough it snaps in.</p>
    <ul><li><b>Preview</b> shows a faint image of the whole picture on the board.</li>
    <li><b>Edges</b> brings border pieces forward and dims the rest for a moment.</li>
    <li><b>Spread</b> scatters the loose pieces around the board again.</li>
    <li><b>Hint</b> places one piece (counts against stars).</li></ul>`),
  achievements: [{ id: 'jg25', name: Kit.L('Galerista', 'Curator'), desc: Kit.L('25 složených obrazů', '25 completed pictures'), prog: s => [((s.data && s.data.gallery) || []).length, 25] }],
});
