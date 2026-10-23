'use strict';
// ── OMALOVÁNKY · Windowling Hlavolamy ───────────────────────────────────────
// Malování podle čísel: generované pixelové obrazy (planety, krajiny, bytosti, lodě,
// mlhoviny). Vyber barvu, maluj tahem, přibližuj kolečkem nebo dvěma prsty.
// Hotové obrazy se ukládají do galerie (stačí semínko, obraz se umí znovu vytvořit).
const Omalovanky = (() => {
  const L = Kit.L;
  const DIFFS = [
    { id: 'small', name: L('Malý', 'Small'), note: '24×24', n: 24, par: 4 * 60 },
    { id: 'medium', name: L('Střední', 'Medium'), note: '32×32', n: 32, par: 8 * 60 },
    { id: 'large', name: L('Velký', 'Large'), note: '40×40', n: 40, par: 13 * 60 },
    { id: 'huge', name: L('Obří', 'Huge'), note: '48×48', n: 48, par: 20 * 60 },
  ];
  const KINDS = ['planet', 'land', 'creature', 'ship', 'nebula'];
  const KIND_NAME = { planet: L('Planeta', 'Planet'), land: L('Krajina', 'Landscape'), creature: L('Bytost', 'Creature'), ship: L('Loď', 'Ship'), nebula: L('Mlhovina', 'Nebula') };

  // ── šum ──
  function noise2(r) {
    const G = 16, v = [...Array(G * G)].map(() => r());
    const at = (x, y) => v[((y % G + G) % G) * G + ((x % G + G) % G)];
    const sm = t => t * t * (3 - 2 * t);
    const n = (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0); return at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy; };
    return (x, y) => n(x, y) * 0.6 + n(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + n(x * 4.3 + 11, y * 4.3 + 5) * 0.1;
  }
  const hsl = (h, s, l) => `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s)}% ${Math.round(l)}%)`;

  // Každý generátor vrací { pal: [barvy], map: Uint8Array(n*n) indexů do palety }
  const GEN = {
    planet(n, r) {
      const h = r() * 360, pal = [hsl(250 + r() * 30, 50, 8), hsl(0, 0, 92), hsl(h, 70, 62), hsl(h + 20, 65, 48), hsl(h - 25, 60, 36), hsl(h + 10, 55, 24), hsl(h + 180, 70, 70), hsl(h + 160, 40, 50)];
      const map = new Uint8Array(n * n), cx = n * (0.42 + r() * 0.16), cy = n * (0.45 + r() * 0.1), R = n * (0.28 + r() * 0.06), tilt = (r() - 0.5) * 0.6;
      const nz = noise2(r), ring = r() < 0.7, moon = [n * (0.12 + r() * 0.2), n * (0.12 + r() * 0.2), n * 0.07];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x; map[i] = r() < 0.025 ? 1 : 0;
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (Math.hypot(x + 0.5 - moon[0], y + 0.5 - moon[1]) < moon[2]) map[i] = x + 0.5 - moon[0] > moon[2] * 0.3 ? 7 : 6;
        const ry = (dy - dx * tilt), rx = dx;
        const ringD = Math.hypot(rx / 1.9, ry / 0.42);
        const behind = ry < 0;
        if (ring && ringD > R * 1.08 && ringD < R * 1.32 && (behind ? d > R : true)) map[i] = 6;
        if (d < R && !(ring && !behind && ringD > R * 1.08 && ringD < R * 1.32)) {
          const band = Math.floor((dy / R + 1) * 3 + nz(x / 6, y / 3) * 2.2) % 3;
          const shade = (dx + dy * 0.4) / R;
          map[i] = shade > 0.45 ? 5 : [2, 3, 4][band];
          if (shade < -0.55 && band !== 2) map[i] = 2;
        }
      }
      return { pal, map };
    },
    land(n, r) {
      const h = r() * 360, pal = [hsl(h, 60, 18), hsl(h + 20, 65, 34), hsl(h + 40, 70, 55), hsl(h + 180, 90, 75), hsl(h + 200, 45, 30), hsl(h + 220, 45, 20), hsl(h + 240, 40, 12), hsl(h + 170, 60, 45), hsl(0, 0, 95)];
      const map = new Uint8Array(n * n), nz = noise2(r), sun = [n * (0.2 + r() * 0.6), n * (0.18 + r() * 0.15), n * (0.09 + r() * 0.05)], water = n * (0.72 + r() * 0.1);
      const ridge = k => x => n * (0.38 + k * 0.12) - nz(x / (8 - k * 2) + k * 10, k * 5) * n * (0.28 - k * 0.05);
      const ridges = [ridge(0), ridge(1), ridge(2)];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x;
        let c = y < n * 0.22 ? 0 : y < n * 0.42 ? 1 : 2;
        if (y < n * 0.3 && r() < 0.03) c = 8;
        if (Math.hypot(x + 0.5 - sun[0], y + 0.5 - sun[1]) < sun[2]) c = 3;
        ridges.forEach((f, k) => { if (y >= f(x)) c = 4 + k; });
        if (y >= water) { const ry = 2 * water - y - 1; c = ry > 0 && Math.abs(x + 0.5 - sun[0]) < sun[2] * (0.7 - (y - water) / n) ? 3 : nz(x / 5, y * 1.7) > 0.62 ? 8 : 7; }
        map[i] = c;
      }
      return { pal, map };
    },
    creature(n, r) {
      const h = r() * 360, pal = [hsl(250, 40, 10), hsl(h, 75, 58), hsl(h + 15, 70, 42), hsl(h - 10, 80, 72), hsl(0, 0, 97), hsl(260, 60, 14), hsl(h + 160, 85, 60), hsl(0, 0, 80)];
      const map = new Uint8Array(n * n), half = Math.ceil(n / 2), body = new Uint8Array(n * n), nz = noise2(r);
      for (let y = 0; y < n; y++) for (let x = 0; x < half; x++) {
        const cx = Math.abs(x + 0.5 - n / 2) / (n / 2), cy = (y + 0.5) / n;
        const v = nz(x / 4, y / 4) + (1 - cx) * 0.55 - Math.abs(cy - 0.52) * 1.1 > 0.62 ? 1 : 0;
        body[y * n + x] = v; body[y * n + n - 1 - x] = v;
      }
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x;
        if (!body[i]) { map[i] = (r() < 0.02 ? 7 : 0); continue; }
        const edge = [i - 1, i + 1, i - n, i + n].some(j => j < 0 || j >= n * n || !body[j]);
        map[i] = edge ? 2 : y > n * 0.6 && Math.abs(x + 0.5 - n / 2) < n * 0.15 ? 3 : 1;
        if (!edge && (x + y * 3) % 7 === 0 && y < n * 0.55) map[i] = 6;
      }
      const ey = Math.floor(n * (0.36 + r() * 0.08)), ex = Math.floor(n * (0.32 + r() * 0.08)), er = Math.max(1, Math.round(n * 0.05));
      for (const sx of [ex, n - 1 - ex]) for (let y = -er; y <= er; y++) for (let x = -er; x <= er; x++) if (x * x + y * y <= er * er) { const i = (ey + y) * n + sx + x; if (i >= 0 && i < n * n) map[i] = x * x + y * y <= (er * 0.45) ** 2 ? 5 : 4; }
      return { pal, map };
    },
    ship(n, r) {
      const h = r() * 360, pal = [hsl(240, 45, 9), hsl(0, 0, 95), hsl(h, 20, 78), hsl(h, 25, 55), hsl(h, 30, 35), hsl(h + 180, 90, 62), hsl(30, 100, 60), hsl(50, 100, 70), hsl(h + 30, 80, 55)];
      const map = new Uint8Array(n * n);
      for (let i = 0; i < n * n; i++) map[i] = r() < 0.025 ? 1 : 0;
      const top = Math.floor(n * 0.08), bot = Math.floor(n * 0.72), half = n / 2;
      let wmax = n * (0.13 + r() * 0.06);
      const widths = [];
      for (let y = top; y <= bot; y++) { const t = (y - top) / (bot - top); widths.push(Math.max(1, wmax * Math.min(1, Math.sin(Math.min(1, t * 1.6) * Math.PI / 2) + 0.1))); }
      const wingY = top + Math.floor((bot - top) * (0.55 + r() * 0.15)), wingW = n * (0.18 + r() * 0.1), wingH = Math.floor(n * (0.16 + r() * 0.08));
      for (let y = top; y <= bot; y++) {
        const w = widths[y - top];
        for (let x = 0; x < n; x++) {
          const dx = Math.abs(x + 0.5 - half), i = y * n + x;
          if (dx < w) map[i] = dx > w - 1.2 ? 4 : dx < w * 0.35 ? 2 : 3;
          const wy = y - wingY;
          if (wy >= 0 && wy < wingH && dx >= w - 0.5 && dx < w + wingW * (1 - wy / wingH * 0.4) && dx > w * 0.8 + wy * 0.6) map[i] = wy === wingH - 1 || dx > w + wingW * (1 - wy / wingH * 0.4) - 1.2 ? 8 : 4;
        }
      }
      const wy = top + Math.floor((bot - top) * 0.3), wr = Math.max(1.2, n * 0.055);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (Math.hypot(x + 0.5 - half, y + 0.5 - wy) < wr) map[y * n + x] = Math.hypot(x + 0.5 - half + wr * 0.3, y + 0.5 - wy + wr * 0.3) < wr * 0.4 ? 1 : 5;
      for (let y = bot + 1; y < Math.min(n, bot + n * 0.2); y++) { const t = (y - bot) / (n * 0.2), w = wmax * 0.7 * (1 - t); for (let x = 0; x < n; x++) { const dx = Math.abs(x + 0.5 - half); if (dx < w) map[y * n + x] = dx < w * 0.45 ? 7 : 6; } }
      return { pal, map };
    },
    nebula(n, r) {
      const h = r() * 360, pal = [hsl(250, 50, 7), hsl(h, 60, 22), hsl(h + 25, 70, 38), hsl(h + 50, 80, 55), hsl(h + 75, 90, 72), hsl(h + 100, 95, 86), hsl(0, 0, 98), hsl(h + 200, 80, 60)];
      const map = new Uint8Array(n * n), nz = noise2(r), nz2 = noise2(r);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const v = nz(x / (n / 5), y / (n / 5)), w = nz2(x / (n / 3) + 3, y / (n / 3));
        let c = v < 0.38 ? 0 : v < 0.46 ? 1 : v < 0.54 ? 2 : v < 0.62 ? 3 : v < 0.7 ? 4 : 5;
        if (c <= 1 && w > 0.62) c = 7;
        if (r() < 0.02 && c < 3) c = 6;
        map[y * n + x] = c;
      }
      return { pal, map };
    },
  };
  // vyhoď nepoužité barvy, seřaď od nejčastější
  function compact(img) {
    const cnt = new Map(); img.map.forEach(c => cnt.set(c, (cnt.get(c) || 0) + 1));
    const order = [...cnt.keys()].sort((a, b) => cnt.get(b) - cnt.get(a)), re = new Map(order.map((c, k) => [c, k]));
    return { pal: order.map(c => img.pal[c]), map: img.map.map(c => re.get(c)) };
  }
  function image(seed, n, kind) { const r = Kit.rng(seed); kind = kind || KINDS[Math.floor(r() * KINDS.length)]; return Object.assign(compact(GEN[kind](n, r)), { kind }); }

  function generate(seed, diffId, ctx = {}) {
    let n = (DIFFS.find(d => d.id === diffId) || DIFFS[0]).n, kind = null;
    if (ctx.kind === 'level') { const ch = Math.floor((ctx.key - 1) / 20); n = [20, 24, 28, 32, 40, 48][ch]; kind = KINDS[(ctx.key - 1) % KINDS.length]; }
    const img = image(seed, n, kind);
    return { seed, n, kind: img.kind, pal: img.pal, map: Array.from(img.map).join(','), name: `${KIND_NAME[img.kind]} #${(seed % 9000) + 1000}` };
  }

  function create(el, P, saved, api) {
    const n = P.n, map = P.map.split(',').map(Number), pal = P.pal;
    let paint = saved && saved.paint ? saved.paint.slice() : new Array(n * n).fill(-1); // -1 nic
    let col = saved && saved.col != null ? saved.col : 0, done = false;
    el.innerHTML = `<div class="om-wrap"><div class="om-stage"><canvas class="om-cv"></canvas></div>
      <div class="om-pal">${pal.map((c, k) => `<button class="om-sw" data-c="${k}" style="--c:${c}"><b>${k + 1}</b><i></i></button>`).join('')}</div>
      <div class="k-tools"><button class="k-tool" data-t="find">${api.icon('bulb')}<span>${L('Najít', 'Find')}</span></button><button class="k-tool" data-t="fit">${api.icon('plus')}<span>${L('Celý obraz', 'Fit')}</span></button></div></div>`;
    const stage = el.querySelector('.om-stage'), cv = el.querySelector('.om-cv'), ctx = cv.getContext('2d'), palEl = el.querySelector('.om-pal');
    let scale = 10, ox = 0, oy = 0, vw = 300, vh = 300; const dpr = Math.min(2, devicePixelRatio || 1);
    const lum = c => { const m = /hsl\((\d+) (\d+)% (\d+)%\)/.exec(c); return m ? +m[3] : 50; };
    function fitView() {
      const w = (document.getElementById('kView') || el).clientWidth - 28, h = innerHeight - (innerWidth < 760 ? 300 : 240);
      vw = Math.max(240, Math.min(w, 760)); vh = Math.max(240, Math.min(h, 760)); const s = Math.min(vw, vh);
      vw = vh = s; cv.width = vw * dpr; cv.height = vh * dpr; cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
      scale = s / n; ox = 0; oy = 0; draw();
    }
    function clampView() { const minS = Math.min(vw, vh) / n; scale = Math.max(minS, Math.min(scale, 60)); ox = Math.min(0, Math.max(vw - n * scale, ox)); oy = Math.min(0, Math.max(vh - n * scale, oy)); }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, vw, vh);
      ctx.fillStyle = '#0c0a1e'; ctx.fillRect(0, 0, vw, vh);
      const x0 = Math.max(0, Math.floor(-ox / scale)), y0 = Math.max(0, Math.floor(-oy / scale)), x1 = Math.min(n, Math.ceil((vw - ox) / scale)), y1 = Math.min(n, Math.ceil((vh - oy) / scale));
      const showNum = scale >= 13, fs = scale * 0.5;
      ctx.font = `600 ${fs}px "Space Grotesk", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = y * n + x, px = ox + x * scale, py = oy + y * scale, p = paint[i];
        if (p === map[i]) { ctx.fillStyle = pal[p]; ctx.fillRect(px, py, scale + 0.6, scale + 0.6); continue; }
        const g = 235 - (map[i] % 4) * 6;
        ctx.fillStyle = map[i] === col ? 'rgba(160,150,255,.55)' : `rgb(${g},${g},${g + 6})`;
        ctx.fillRect(px, py, scale + 0.6, scale + 0.6);
        if (p >= 0) { ctx.fillStyle = pal[p]; ctx.globalAlpha = 0.5; ctx.fillRect(px + scale * 0.2, py + scale * 0.2, scale * 0.6, scale * 0.6); ctx.globalAlpha = 1; }
        if (showNum) { ctx.fillStyle = map[i] === col ? '#1b1048' : 'rgba(40,36,70,.75)'; ctx.fillText(String(map[i] + 1), px + scale / 2, py + scale / 2 + 0.5); }
      }
      if (scale >= 8) { ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = x0; x <= x1; x++) { ctx.moveTo(ox + x * scale + 0.5, oy + y0 * scale); ctx.lineTo(ox + x * scale + 0.5, oy + y1 * scale); } for (let y = y0; y <= y1; y++) { ctx.moveTo(ox + x0 * scale, oy + y * scale + 0.5); ctx.lineTo(ox + x1 * scale, oy + y * scale + 0.5); } ctx.stroke(); }
    }
    function renderPal() {
      const left = pal.map(() => 0); map.forEach((c, i) => { if (paint[i] !== c) left[c]++; });
      [...palEl.children].forEach((b, k) => { b.classList.toggle('on', k === col); b.classList.toggle('done', !left[k]); b.querySelector('i').style.setProperty('--p', `${100 - Math.round(left[k] / map.filter(c => c === k).length * 100)}%`); });
    }
    function paintAt(i) {
      if (done || i < 0 || paint[i] === map[i]) return false;
      if (paint[i] === col) return false;
      paint[i] = col;
      if (col !== map[i]) api.mistake(); else api.sound('soft');
      return true;
    }
    function cellAt(e) { const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left - ox) / scale), y = Math.floor((e.clientY - r.top - oy) / scale); return x >= 0 && y >= 0 && x < n && y < n ? y * n + x : -1; }
    // Ovládání: 1 prst/myš maluje (jen pokud je obraz dost velký), 2 prsty posun + zoom, kolečko zoom, pravé tlačítko posun.
    const pts = new Map(); let mode = null, last = null, pinch = null, changed = false;
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { mode = 'pinch'; const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: scale, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, ox, oy }; return; }
      if (e.button === 2 || e.button === 1 || scale < 9) { mode = 'pan'; last = { x: e.clientX, y: e.clientY, moved: 0 }; return; }
      mode = 'paint'; changed = paintAt(cellAt(e)) || changed; draw();
    });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === 'pinch' && pts.size >= 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = cv.getBoundingClientRect();
        const ns = Math.max(Math.min(vw, vh) / n, Math.min(60, pinch.s * d / pinch.d)), cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
        ox = cx - (pinch.cx - r.left - pinch.ox) * ns / pinch.s; oy = cy - (pinch.cy - r.top - pinch.oy) * ns / pinch.s; scale = ns; clampView(); draw();
      } else if (mode === 'pan' && last) { ox += e.clientX - last.x; oy += e.clientY - last.y; last.moved += Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y); last.x = e.clientX; last.y = e.clientY; clampView(); draw(); }
      else if (mode === 'paint') { changed = paintAt(cellAt(e)) || changed; draw(); }
    });
    const up = e => {
      pts.delete(e.pointerId);
      if (mode === 'pan' && last && last.moved < 6 && scale < 9) { // klepnutí při malém zvětšení: přibliž sem
        const r = cv.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top, ns = 22; ox = cx - (cx - ox) * ns / scale; oy = cy - (cy - oy) * ns / scale; scale = ns; clampView(); draw();
      }
      if (!pts.size) { mode = null; last = null; if (changed) { changed = false; renderPal(); api.changed(); check(); } }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top, ns = Math.max(Math.min(vw, vh) / n, Math.min(60, scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18))); ox = cx - (cx - ox) * ns / scale; oy = cy - (cy - oy) * ns / scale; scale = ns; clampView(); draw(); }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    palEl.addEventListener('click', e => { const b = e.target.closest('.om-sw'); if (!b) return; col = +b.dataset.c; api.sound('tap'); renderPal(); draw(); });
    el.querySelector('.k-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t) return;
      if (t.dataset.t === 'fit') fitView();
      if (t.dataset.t === 'find') {
        let i = map.findIndex((c, k) => c === col && paint[k] !== c); if (i < 0) i = map.findIndex((c, k) => paint[k] !== c);
        if (i < 0) return; if (map[i] !== col) { col = map[i]; renderPal(); }
        const ns = Math.max(scale, 24), x = i % n, y = Math.floor(i / n); scale = ns; ox = vw / 2 - (x + 0.5) * ns; oy = vh / 2 - (y + 0.5) * ns; clampView(); draw(); api.sound('ui');
      }
    });
    function check() {
      if (!map.every((c, i) => paint[i] === c)) return;
      done = true; fitView();
      const g = api.data.gallery = api.data.gallery || []; if (!g.some(x => x.seed === P.seed && x.n === n)) { g.push({ seed: P.seed, n, kind: P.kind, name: P.name, at: Date.now() }); if (g.length > 300) g.shift(); }
      const t = document.createElement('canvas'); t.width = t.height = n; const tc = t.getContext('2d'); map.forEach((c, i) => { tc.fillStyle = pal[c]; tc.fillRect(i % n, Math.floor(i / n), 1, 1); });
      setTimeout(() => api.solved({ title: P.name, html: `<img class="om-res" src="${t.toDataURL()}" alt=""><p class="k-muted">${L('Obraz visí ve tvé galerii', 'The picture now hangs in your gallery')}</p>` }), 700);
    }
    fitView(); renderPal(); addEventListener('resize', fitView);
    return {
      getState: () => (done ? null : { paint, col }),
      destroy() { removeEventListener('resize', fitView); },
      onKey(e) { const d = parseInt(e.key, 10); if (d >= 1 && d <= pal.length) { col = d - 1; renderPal(); draw(); } if (e.key === '0' && pal.length >= 10) { col = 9; renderPal(); draw(); } },
      _solve() { paint = map.slice(); renderPal(); draw(); check(); },
    };
  }

  const gallery = { icon: 'brush', name: L('Galerie', 'Gallery'), badge: s => ((s.data && s.data.gallery) || []).length,
    render(el, save) {
      const g = (save.data.gallery || []).slice().reverse();
      el.innerHTML = `<h2>${L('Galerie', 'Gallery')}</h2><p class="k-muted">${L(`Vymalované obrazy: ${g.length}.`, `Pictures painted: ${g.length}.`)}</p><div class="om-gal">${g.map((x, k) => `<figure><canvas data-g="${k}" width="${x.n}" height="${x.n}"></canvas><figcaption>${Kit.esc(x.name)}</figcaption></figure>`).join('') || `<p class="k-muted">${L('Zatím prázdná.', 'Empty so far.')}</p>`}</div>`;
      el.querySelectorAll('canvas[data-g]').forEach(cv => { const x = g[+cv.dataset.g], img = image(x.seed, x.n, x.kind), c = cv.getContext('2d'); img.map.forEach((k, i) => { c.fillStyle = img.pal[k]; c.fillRect(i % x.n, Math.floor(i / x.n), 1, 1); }); });
    } };
  function art(el) {
    const img = image(Kit.hash('oart' + Kit.dayKey()), 32), cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const c = cv.getContext('2d'); img.map.forEach((k, i) => { c.fillStyle = img.pal[k]; c.fillRect(i % 32, Math.floor(i / 32), 1, 1); });
    cv.className = 'om-art'; el.innerHTML = ''; el.appendChild(cv);
  }
  return { DIFFS, generate, create, art, gallery, image, KINDS };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'omalovanky', title: 'OMALOVÁNKY',
  tagline: Kit.L('Malování podle čísel pro chvíle klidu. Planety, mlhoviny, bytosti a lodě, každý obraz nový a tvůj.', 'Colour by number for quiet moments. Planets, nebulae, creatures and ships, every picture new and yours.'),
  diffs: Omalovanky.DIFFS, generate: Omalovanky.generate, create: Omalovanky.create, art: Omalovanky.art, views: [Omalovanky.gallery],
  dailyDiff: () => 'medium',
  rules: Kit.L(`<p>Každé políčko má číslo barvy. Vyber barvu dole a vybarvi všechna políčka s jejím číslem. Políčka vybrané barvy jsou zvýrazněná.</p>
    <ul><li>Maluj klepnutím nebo tahem. <b>Přibližuj</b> kolečkem myši nebo dvěma prsty, posouvej pravým tlačítkem nebo dvěma prsty.</li>
    <li>Když je obraz malý, klepnutí ho přiblíží na místo, kam jsi klepl(a).</li>
    <li><b>Najít</b> ukáže nejbližší nevybarvené políčko vybrané barvy.</li>
    <li>Špatná barva se počítá jako chyba, jde ale přemalovat.</li>
    <li>Hotové obrazy najdeš v <b>Galerii</b>.</li></ul>`,
    `<p>Every cell has a colour number. Pick a colour below and paint every cell with its number. Cells of the selected colour are highlighted.</p>
    <ul><li>Paint by tapping or dragging. <b>Zoom</b> with the mouse wheel or two fingers, pan with the right button or two fingers.</li>
    <li>When the picture is small, a tap zooms in where you tapped.</li>
    <li><b>Find</b> shows the next unpainted cell of the selected colour.</li>
    <li>A wrong colour counts as a mistake but can be painted over.</li>
    <li>Finished pictures hang in your <b>Gallery</b>.</li></ul>`),
  achievements: [
    { id: 'gal10', name: Kit.L('Malíř', 'Painter'), desc: Kit.L('10 obrazů v galerii', '10 pictures in the gallery'), prog: s => [((s.data && s.data.gallery) || []).length, 10] },
    { id: 'gal50', name: Kit.L('Výstava', 'Exhibition'), desc: Kit.L('50 obrazů v galerii', '50 pictures in the gallery'), prog: s => [((s.data && s.data.gallery) || []).length, 50] },
  ],
});
