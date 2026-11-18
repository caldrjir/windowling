'use strict';
// ── Kovárna: 3D model lodi ───────────────────────────────────────────────────
// Nízkopolygonová loď z hranolů a válců promítnutá do 2D canvasu. Pořadí kreslení dává BSP strom
// (postaví se jednou po stavbě modelu; plochy, které protínají rovinu jiné, se rozříznou), takže se díly
// správně překrývají z každého úhlu; odvrácené plochy se nekreslí, stínování je ploché. Každá plocha patří
// jedné části lodi (PARTS); klepnutí najde nejbližší plochu pod prstem. Táhnutím se loď otáčí jako
// předmět v ruce (bližší bok jde s prstem), po puštění rotace plynule dobíhá. Kamera se sama natočí jen
// po výběru části v seznamu; klepnutí do modelu ani nečinnost s lodí nehnou. Model se staví znovu po nákupu:
// víc vylepšení = jasněji svítící část, Duplikátor přidá hlaveň, výzbroj obarví rakety v gondolách.
const Forge3D = (() => {
  // Osy lodi: x dopředu (příď), y doprava, z nahoru.
  let faces = [];
  const ANCHOR = {
    guns: [6.2, 0, -0.35], cockpit: [2.1, 0, 1.15], reactor: [-1.5, 0, 1.55], hull: [-0.6, -1.25, 0.25],
    wings: [-1.9, 3.4, 0.1], engines: [-4.7, 1.55, 0], bay: [-1.7, 2.6, -0.5],
  };

  // ── Stavba primitiv ──
  // Plochy jednoho tělesa se natočí normálou ven (od těžiště tělesa), ať funguje skrývání odvrácených.
  function solid(part, list, opt = {}) {
    let cx = 0, cy = 0, cz = 0, n = 0;
    for (const f of list) for (const p of f) { cx += p[0]; cy += p[1]; cz += p[2]; n++; }
    cx /= n; cy /= n; cz /= n;
    for (const pts of list) {
      const nr = normal(pts), c = center(pts);
      if (nr[0] * (c[0] - cx) + nr[1] * (c[1] - cy) + nr[2] * (c[2] - cz) < 0) pts.reverse();
      faces.push({ part, pts, emit: !!opt.emit, glass: !!opt.glass, tint: opt.tint || null });
    }
  }
  // Newellova normála (funguje i pro mírně nerovinné mnohoúhelníky).
  function normal(p) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return [x, y, z];
  }
  function center(p) { let x = 0, y = 0, z = 0; for (const q of p) { x += q[0]; y += q[1]; z += q[2]; } return [x / p.length, y / p.length, z / p.length]; }
  /** Těleso z průřezů podél osy x: sections = [{ x, pts: [[y, z]…] }], každý průřez stejně bodů. */
  function loft(part, sections, opt = {}) {
    const list = [], n = sections[0].pts.length;
    for (let s = 0; s + 1 < sections.length; s++) {
      const A = sections[s], B = sections[s + 1];
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        list.push([[A.x, A.pts[i][0], A.pts[i][1]], [A.x, A.pts[j][0], A.pts[j][1]], [B.x, B.pts[j][0], B.pts[j][1]], [B.x, B.pts[i][0], B.pts[i][1]]]);
      }
    }
    const capA = opt.caps ? opt.caps[0] : true, capB = opt.caps ? opt.caps[1] : true;
    const end = (S, emit) => ({ pts: S.pts.map(([y, z]) => [S.x, y, z]), emit });
    const solidList = list.slice();
    const caps = [];
    if (capA) caps.push(end(sections[0], opt.emitA));
    if (capB) caps.push(end(sections[sections.length - 1], opt.emitB));
    // boční plochy a víka jednoho tělesa (víka můžou svítit: tryska, ústí hlavně; tint jen svítící víko)
    solid(part, solidList, { glass: opt.glass, emit: opt.emit });
    for (const c of caps) {
      const before = faces.length;
      solid(part, [c.pts], { glass: opt.glass, emit: c.emit || opt.emit, tint: c.emit ? opt.tint : null });
      // víko se natočí ven podle těžiště celého tělesa, ne jen sebe sama
      const f = faces[before], nr = normal(f.pts), cc = center(f.pts), mid = sections[Math.floor(sections.length / 2)].x;
      if (Math.sign(nr[0]) !== Math.sign(cc[0] - mid) && Math.abs(nr[0]) > 1e-6) f.pts.reverse();
    }
  }
  const ring = (n, ry, rz, cy = 0, cz = 0, rot = 0) => Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * Math.PI * 2; return [cy + Math.cos(a) * ry, cz + Math.sin(a) * rz]; });
  const oct = (w, h, zc) => [[w * 0.42, zc - h], [w, zc - h * 0.42], [w, zc + h * 0.42], [w * 0.42, zc + h], [-w * 0.42, zc + h], [-w, zc + h * 0.42], [-w, zc - h * 0.42], [-w * 0.42, zc - h]];
  /** Válec podél x: [x, poloměr] po sobě jdoucí řezy. */
  function cyl(part, xs, y, z, n, opt) { loft(part, xs.map(([x, r]) => ({ x, pts: ring(n, r, r, y, z, Math.PI / n) })), opt); }
  /** Hranol: mnohoúhelník v rovině x–y vytažený mezi z0 a z1. */
  function prism(part, poly, z0, z1, opt) {
    const list = [poly.map(([x, y]) => [x, y, z0]), poly.map(([x, y]) => [x, y, z1])];
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; list.push([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]]); }
    solid(part, list, opt);
  }
  /** Svislý šestiboký hranol (reaktor). */
  function hex(part, x, y, r, z0, z1, opt) { prism(part, Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; return [x + Math.cos(a) * r, y + Math.sin(a) * r]; }), z0, z1, opt); }

  function build() {
    faces = [];
    const S = SAVE, lo = (S.loadout && S.loadout.pre) || [], hard = Math.min(2, S.forge.hard || 0);
    // Trup
    loft('hull', [{ x: -3.6, pts: oct(0.95, 0.7, 0.05) }, { x: -2.0, pts: oct(1.25, 0.85, 0.1) }, { x: 0.5, pts: oct(1.2, 0.85, 0.1) }, { x: 2.4, pts: oct(0.85, 0.65, 0.05) }], { caps: [true, false] });
    cyl('engines', [[-4.15, 0.4], [-3.6, 0.5]], 0, 0.05, 8, { emitA: true });
    // Příď s děly
    loft('guns', [{ x: 2.4, pts: oct(0.85, 0.65, 0.05) }, { x: 4.4, pts: oct(0.55, 0.42, -0.02) }, { x: 6.2, pts: oct(0.12, 0.1, -0.05) }], { caps: [false, true] });
    for (const y of [-0.62, 0.62]) { cyl('guns', [[3.0, 0.13], [6.6, 0.13]], y, -0.38, 6); cyl('guns', [[6.6, 0.19], [6.95, 0.17]], y, -0.38, 6, { emitB: true }); }
    if (S.forge.amount) { cyl('guns', [[4.4, 0.1], [7.3, 0.1]], 0, -0.52, 6); cyl('guns', [[7.3, 0.15], [7.55, 0.13]], 0, -0.52, 6, { emitB: true }); }
    // Kokpit (prosklený hřbet)
    // kabina sedí na hřbetě: spodek kopíruje výšku trupu a přídě v daném místě (o kousek zapuštěný)
    const canopy = (sc, base) => [[-0.42 * sc, base], [-0.32 * sc, base + 0.34 * sc], [0, base + 0.48 * sc], [0.32 * sc, base + 0.34 * sc], [0.42 * sc, base]];
    loft('cockpit', [{ x: 0.9, pts: canopy(0.7, 0.85) }, { x: 1.7, pts: canopy(1, 0.74) }, { x: 2.9, pts: canopy(0.62, 0.58) }, { x: 3.6, pts: canopy(0.18, 0.47) }], { glass: true });
    // Reaktor: šestiboká komora na hřbetě a svítící jádro
    hex('reactor', -1.55, 0, 0.78, 0.7, 1.32);
    hex('reactor', -1.55, 0, 0.46, 1.32, 1.52, { emit: true });
    for (const y of [-0.92, 0.92]) prism('reactor', [[-2.6, y - 0.08], [-0.6, y - 0.08], [-0.9, y + 0.08], [-2.4, y + 0.08]], 0.5, 0.82); // lišty zapuštěné do trupu
    // Sběrná křídla a magnetické cívky na koncích
    for (const sg of [1, -1]) {
      prism('wings', [[0.6, sg * 1.0], [-2.2, sg * 4.6], [-3.25, sg * 4.6], [-3.0, sg * 1.0]], -0.09, 0.11);
      cyl('wings', [[-3.45, 0.2], [-3.1, 0.24], [-2.0, 0.24], [-1.7, 0.18]], sg * 4.78, 0.05, 6, { emitA: true, emitB: true });
    }
    // Motory: dvě gondoly, zadní tryska svítí
    for (const sg of [1, -1]) cyl('engines', [[-4.95, 0.46], [-4.45, 0.56], [-2.6, 0.56], [-1.6, 0.36]], sg * 1.6, 0.0, 8, { emitA: true });
    // Zbrojnice: gondoly pod křídly (špička v barvě zbraně na závěsníku) a pumovnice pod trupem
    [1, -1].forEach((sg, k) => {
      const wid = k < hard ? lo[k] : null, tint = wid && WEAPONS[wid] ? WEAPONS[wid].color : null;
      // závěsník pod křídlem (křídlo je v y = 2,6 mezi x −3,1 a −0,64) a gondola na něm
      prism('bay', [[-2.3, sg * 2.55], [-1.1, sg * 2.55], [-1.25, sg * 2.65], [-2.2, sg * 2.65]], -0.3, -0.05);
      cyl('bay', [[-3.0, 0.2], [-2.7, 0.27], [-0.9, 0.27], [-0.35, 0.12]], sg * 2.6, -0.48, 6, { emitB: !!tint, tint });
    });
    prism('bay', [[-1.9, -0.55], [1.0, -0.55], [1.0, 0.55], [-1.9, 0.55]], -1.0, -0.62);
    bsp = bspBuild(faces.map(f => Object.assign(f, { pl: plane(f.pts), edges: f.pts.map(() => true) })));
  }

  // ── BSP strom: správné pořadí ploch z každého úhlu ──
  // Řazení podle průměrné hloubky plochy se u velkých a protínajících se ploch plete (z jednoho úhlu je
  // křídlo přes gondolu, z jiného naopak). BSP: každý uzel je rovina jedné plochy, ostatní plochy jsou
  // před ní, za ní, nebo se rozříznou. Průchod od pozorovatele dává přesné pořadí od nejvzdálenější.
  // Hrany vzniklé řezem nejsou hrany modelu: edges[i] = false, nekreslí se neonově.
  const EPS = 1e-3;
  let bsp = null;
  function plane(pts) {
    const n = normal(pts), l = Math.hypot(n[0], n[1], n[2]) || 1, c = center(pts);
    return [n[0] / l, n[1] / l, n[2] / l, (n[0] * c[0] + n[1] * c[1] + n[2] * c[2]) / l];
  }
  const side = (P, p) => P[0] * p[0] + P[1] * p[1] + P[2] * p[2] - P[3];
  // 0 = v rovině, 1 = před, -1 = za, 2 = protíná (pak out = [přední, zadní])
  function classify(f, P, out) {
    let pos = 0, neg = 0;
    const ds = f.pts.map(p => { const d = side(P, p); if (d > EPS) pos++; else if (d < -EPS) neg++; return d; });
    if (!pos && !neg) return 0;
    if (!neg) return 1;
    if (!pos) return -1;
    const F = [], Fe = [], B = [], Be = [], n = f.pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = f.pts[i], b = f.pts[j], da = ds[i], db = ds[j], e = f.edges[i];
      const sa = da > EPS ? 1 : da < -EPS ? -1 : 0, sb = db > EPS ? 1 : db < -EPS ? -1 : 0;
      let I = null;
      if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) { const t = da / (da - db); I = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
      // přední část (d ≥ 0)
      if (sa >= 0) {
        if (sb >= 0) { F.push(a); Fe.push(e); } else if (sa > 0) { F.push(a, I); Fe.push(e, false); } else { F.push(a); Fe.push(false); }
      } else if (sb > 0) { F.push(I); Fe.push(e); }
      // zadní část (d ≤ 0)
      if (sa <= 0) {
        if (sb <= 0) { B.push(a); Be.push(e); } else if (sa < 0) { B.push(a, I); Be.push(e, false); } else { B.push(a); Be.push(false); }
      } else if (sb < 0) { B.push(I); Be.push(e); }
    }
    out[0] = F.length >= 3 ? Object.assign({}, f, { pts: F, edges: Fe, cut: true }) : null;
    out[1] = B.length >= 3 ? Object.assign({}, f, { pts: B, edges: Be, cut: true }) : null;
    return 2;
  }
  function bspBuild(list) {
    if (!list.length) return null;
    // dělicí rovina: z několika kandidátů ta, která rozřízne nejmíň ploch
    let best = 0, bestScore = Infinity;
    const step = Math.max(1, Math.floor(list.length / 10)), tmp = [null, null];
    for (let c = 0; c < list.length; c += step) {
      const P = list[c].pl; let splits = 0, fr = 0, bk = 0;
      for (const f of list) { const k = f === list[c] ? 0 : classify(f, P, tmp); if (k === 2) splits++; else if (k === 1) fr++; else if (k === -1) bk++; }
      const score = splits * 8 + Math.abs(fr - bk);
      if (score < bestScore) { bestScore = score; best = c; }
    }
    const P = list[best].pl, node = { P, polys: [list[best]], front: null, back: null }, F = [], B = [], out = [null, null];
    for (const f of list) {
      if (f === list[best]) continue;
      const k = classify(f, P, out);
      if (k === 0) node.polys.push(f);
      else if (k === 1) F.push(f);
      else if (k === -1) B.push(f);
      else { if (out[0]) F.push(out[0]); if (out[1]) B.push(out[1]); }
    }
    node.front = bspBuild(F); node.back = bspBuild(B);
    return node;
  }
  // od nejvzdálenější: nejdřív strana roviny odvrácená od oka
  function walk(node, E, out) {
    if (!node) return;
    const near = side(node.P, E) >= 0 ? node.front : node.back, far = near === node.front ? node.back : node.front;
    walk(far, E, out);
    for (const f of node.polys) out.push(f);
    walk(near, E, out);
  }

  // ── Kamera a vykreslení ──
  let cv = null, ctx = null, W = 0, H = 0, dpr = 1;
  let yaw = -0.75, pitch = 0.38, zoom = 1, target = null, idle = 0, t = 0, spin = 0, touched = false, over = false;
  let selected = null, hovered = null, drawn = [], onSelect = null, glowFx = 0;
  const DIST = 22, LIGHT = (() => { const v = [-0.45, 0.75, 0.55], l = Math.hypot(...v); return v.map(c => c / l); })();
  const METAL = [22, 26, 58];
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const PCOL = {};

  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    W = r.width; H = r.height;
  }
  // svět → pohled: otočení kolem svislé osy (yaw), pak náklon kamery (pitch); d = směr k divákovi
  function view(p, cy, sy, cp, sp) {
    const x1 = p[0] * cy - p[1] * sy, y1 = p[0] * sy + p[1] * cy, z1 = p[2];
    const d0 = -y1;
    return [x1, z1 * cp - d0 * sp, d0 * cp + z1 * sp];
  }
  function project(v, scale) { const k = (DIST / (DIST - v[2])) * scale; return [W / 2 + v[0] * k, H * 0.53 - v[1] * k]; }

  function draw() {
    if (!ctx) return;
    resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = Math.min(W, H * 1.55) / 17 * zoom;
    const prog = {};
    for (const p of PARTS) { prog[p.id] = partProgress(SAVE, p.id); PCOL[p.id] = PCOL[p.id] || rgb(p.color); }
    // podlaha: mřížka pod lodí, ať je vidět natočení
    drawGrid(cy, sy, cp, sp, scale);
    // oko v souřadnicích modelu (inverze pohledu: kamera je v pohledu v [0, 0, DIST])
    const E = [-DIST * cp * sy, -DIST * cp * cy, DIST * sp], order = [], list = [];
    walk(bsp, E, order);
    for (const f of order) {
      if (side(f.pl, E) <= 0) continue; // odvrácená plocha
      const v = f.pts.map(p => view(p, cy, sy, cp, sp)), nv = view(f.pl, cy, sy, cp, sp), dl = nv[0] * LIGHT[0] + nv[1] * LIGHT[1] + nv[2] * LIGHT[2];
      list.push({ f, v, lit: Math.max(0, dl), fill: Math.max(0, -dl) });
    }
    drawn = [];
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    for (const it of list) {
      const { f } = it, pc = f.tint ? rgb(f.tint) : PCOL[f.part], pr = prog[f.part];
      const sel = f.part === selected, hov = f.part === hovered;
      const pts = it.v.map(q => project(q, scale));
      drawn.push({ part: f.part, pts });
      // hlavní světlo + slabé protisvětlo, ať odvrácené plochy (spodek) nejsou černé
      const light = 0.42 + 0.7 * it.lit + 0.24 * it.fill;
      let col;
      if (f.emit) { const e = 0.55 + 0.35 * pr + (sel ? 0.15 * pulse : 0); col = pc.map(c => Math.min(255, c * e + 255 * 0.25 * e)); }
      else {
        const mix = (f.glass ? 0.4 : 0.14 + 0.36 * pr) + (sel ? 0.22 + 0.08 * pulse : hov ? 0.12 : 0);
        col = METAL.map((m, i) => Math.min(255, (m + (pc[i] - m) * mix) * light + (f.glass ? 30 * it.lit : 0)));
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      const fill = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${f.glass ? 0.88 : 1})`;
      ctx.fillStyle = fill;
      ctx.fill();
      const ea = f.emit ? 0.9 : sel ? 0.75 + 0.25 * pulse : 0.22 + 0.45 * pr + (hov ? 0.25 : 0);
      if (!f.cut) {
        ctx.strokeStyle = `rgba(${pc[0]},${pc[1]},${pc[2]},${Math.min(1, ea)})`;
        ctx.lineWidth = sel ? 1.6 : 1;
        ctx.stroke();
      } else {
        // rozříznutá plocha: šev po řezu zakrýt barvou plochy, neonově jen skutečné hrany modelu
        if (!f.glass) { ctx.strokeStyle = fill; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i < pts.length; i++) if (!f.edges[i]) { const b = pts[(i + 1) % pts.length]; ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(b[0], b[1]); } ctx.stroke(); }
        ctx.strokeStyle = `rgba(${pc[0]},${pc[1]},${pc[2]},${Math.min(1, ea)})`;
        ctx.lineWidth = sel ? 1.6 : 1;
        ctx.beginPath(); for (let i = 0; i < pts.length; i++) if (f.edges[i]) { const b = pts[(i + 1) % pts.length]; ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
      }
    }
    drawGlows(cy, sy, cp, sp, scale, prog);
    drawMarkers(cy, sy, cp, sp, scale);
  }
  function drawGrid(cy, sy, cp, sp, scale) {
    ctx.lineWidth = 1;
    for (let i = -8; i <= 8; i += 2) {
      for (const [a, b] of [[[i, -8, -1.6], [i, 8, -1.6]], [[-8, i, -1.6], [8, i, -1.6]]]) {
        const p = project(view(a, cy, sy, cp, sp), scale), q = project(view(b, cy, sy, cp, sp), scale);
        ctx.strokeStyle = `rgba(85,246,255,${0.05 + (i === 0 ? 0.06 : 0)})`;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      }
    }
  }
  // Záře trysek a jádra reaktoru (předkreslené sprity, žádné gradienty za snímek).
  function drawGlows(cy, sy, cp, sp, scale, prog) {
    ctx.globalCompositeOperation = 'lighter';
    const g = (p, color, r, a) => {
      const v = view(p, cy, sy, cp, sp), s = project(v, scale), k = (DIST / (DIST - v[2])) * scale, img = Sprites.glow(color, 12);
      ctx.globalAlpha = a; const R = r * k; ctx.drawImage(img, s[0] - R, s[1] - R, R * 2, R * 2);
    };
    const flick = 0.85 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7);
    for (const y of [-1.6, 1.6]) g([-5.1, y, 0], '#4cc9f0', 0.55 + 0.25 * prog.engines, (0.35 + 0.35 * prog.engines) * flick);
    g([-4.3, 0, 0.05], '#4cc9f0', 0.45, 0.4 * flick);
    g([-1.55, 0, 1.55], '#ffd166', 0.5 + 0.3 * prog.reactor, 0.3 + 0.4 * prog.reactor);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // Značky částí: tečka v barvě části (pulzuje, když se tam dá něco koupit) a jmenovka u vybrané.
  function drawMarkers(cy, sy, cp, sp, scale) {
    ctx.font = '600 13px "Chakra Petch", sans-serif';
    ctx.textBaseline = 'middle';
    for (const p of PARTS) {
      const v = view(ANCHOR[p.id], cy, sy, cp, sp), s = project(v, scale), back = v[2] < -0.8;
      const can = partCanBuy(SAVE, p.id), on = p.id === selected || p.id === hovered;
      ctx.globalAlpha = back && !on ? 0.35 : 1;
      const c = PCOL[p.id];
      if (can) { const r = 7 + 4 * (0.5 + 0.5 * Math.sin(t * 5)); ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.7)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = on ? '#ffffff' : `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath(); ctx.arc(s[0], s[1], on ? 5 : 3.5, 0, TAU); ctx.fill();
      if (on) {
        const txt = p.name, w = ctx.measureText(txt).width + 16, x = Math.min(W - w - 6, Math.max(6, s[0] + 10)), y = s[1] - 22;
        ctx.fillStyle = 'rgba(8,4,24,0.82)'; ctx.fillRect(x, y - 11, w, 22);
        ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y - 10.5, w - 1, 21);
        ctx.fillStyle = '#ffffff'; ctx.fillText(txt, x + 8, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── Klepnutí: nejbližší plocha pod bodem ──
  function pick(x, y) {
    for (let i = drawn.length - 1; i >= 0; i--) if (inside(drawn[i].pts, x, y)) return drawn[i].part;
    // vedle lodi: nejbližší značka (do 26 px)
    let best = null, bd = 26 * 26;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), scale = Math.min(W, H * 1.55) / 17 * zoom;
    for (const p of PARTS) { const s = project(view(ANCHOR[p.id], cy, sy, cp, sp), scale), d = (s[0] - x) ** 2 + (s[1] - y) ** 2; if (d < bd) { bd = d; best = p.id; } }
    return best;
  }
  function inside(pts, x, y) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }

  // ── Vstup ──
  let drag = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  // Rychlost otáčení podle šířky plátna: tah přes celou šířku ≈ 300°, na telefonu i na monitoru stejně.
  const turn = () => 5.2 / Math.max(320, W);
  function down(e) {
    if (e.button > 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, at: performance.now() };
    spin = 0; touched = true;
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* */ }
  }
  function move(e) {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.moved > 5) {
        const now = performance.now(), dtm = Math.max(1, now - drag.at) / 1000, dyaw = dx * turn(); // bližší bok jde s prstem
        yaw += dyaw; pitch = clamp(pitch + dy * turn() * 0.8, -1.15, 1.25); target = null; idle = 0; cv.classList.add('drag');
        // setrvačnost: vyhlazená rychlost posledních pohybů, po puštění dobíhá
        spin = clamp(spin * 0.6 + (dyaw / dtm) * 0.4, -7, 7);
      }
      drag.at = performance.now();
      return;
    }
    over = true;
    const [x, y] = pos(e), h = pick(x, y);
    if (h !== hovered) { hovered = h; cv.style.cursor = h ? 'pointer' : 'grab'; }
  }
  function up(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    // držel prst na místě, než pustil: žádné dobíhání
    if (performance.now() - drag.at > 90) spin = 0;
    drag = null; cv.classList.remove('drag');
    if (moved <= 5) { spin = 0; const [x, y] = pos(e), p = pick(x, y); if (p) select(p, false, true); }
  }
  function leave() { over = false; if (!drag) hovered = null; }
  function wheel(e) { e.preventDefault(); zoom = clamp(zoom * (e.deltaY > 0 ? 0.92 : 1.08), 0.75, 1.6); idle = 0; }
  function key(e) {
    if (!cv || !cv.isConnected || UI.current !== 'forge' || (UI.overlayOpen && UI.overlayOpen())) return;
    const k = e.code;
    if (k === 'ArrowLeft') yaw -= 0.18; else if (k === 'ArrowRight') yaw += 0.18;
    else if (k === 'ArrowUp') pitch = clamp(pitch + 0.15, -1.15, 1.25); else if (k === 'ArrowDown') pitch = clamp(pitch - 0.15, -1.15, 1.25);
    else return;
    target = null; idle = 0; spin = 0; touched = true;
    e.preventDefault();
  }
  window.addEventListener('keydown', key);

  // ── Veřejné ──
  function mount(canvas, opts = {}) {
    if (cv && cv !== canvas) unmount();
    cv = canvas; ctx = cv.getContext('2d');
    onSelect = opts.onSelect || null;
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => { drag = null; });
    cv.addEventListener('pointerleave', leave);
    cv.addEventListener('pointerenter', () => { over = true; });
    touched = false; spin = 0;
    cv.addEventListener('wheel', wheel, { passive: false });
    cv.style.cursor = 'grab';
    build();
    draw();
  }
  function unmount() { cv = null; ctx = null; drawn = []; }
  /** Vybere část; animate = kamera se k ní natočí, fromClick = klepnutí do modelu (ohlásí se UI),
   *  user = vybral ji hráč (pak se loď už sama netočí; při otevření Kovárny false). */
  function select(id, animate = true, fromClick = false, user = true) {
    if (!P_INDEX[id]) return;
    selected = id;
    if (animate) {
      const [ty, tp] = P_INDEX[id].view;
      // nejkratší cesta k cílovému otočení
      let dy = ((ty - yaw) % TAU + TAU * 1.5) % TAU - TAU / 2;
      target = [yaw + dy, tp];
    }
    idle = 0; glowFx = 1; if (user) touched = true; if (animate) spin = 0;
    if (fromClick && onSelect) onSelect(id);
  }
  function frame(dt) {
    if (!cv || !cv.isConnected) return;
    t += dt; idle += dt;
    if (target) {
      const k = 1 - Math.exp(-dt * 6);
      yaw += (target[0] - yaw) * k; pitch += (target[1] - pitch) * k;
      if (Math.abs(target[0] - yaw) < 0.002 && Math.abs(target[1] - pitch) < 0.002) target = null;
    } else if (!drag && Math.abs(spin) > 0.02) {
      yaw += spin * dt; spin *= Math.exp(-dt * 4.5);
    } else if (!touched && !over && idle > 3) yaw -= dt * 0.12; // ukázka, dokud se jí hráč nedotkne
    glowFx = Math.max(0, glowFx - dt);
    draw();
  }
  return {
    mount, unmount, select, frame, rebuild() { if (cv) { build(); draw(); } },
    look(y, p) { yaw = y; pitch = p; target = null; spin = 0; touched = true; }, get selected() { return selected; }, get stats() { let n = 0; const c = x => { if (x) { n += x.polys.length; c(x.front); c(x.back); } }; c(bsp); return { faces: faces.length, bsp: n }; }, get view() { return [yaw, pitch]; },
    // pro testy: kam na obrazovce (v px canvasu) padá značka části
    screenOf(id) { const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), s = project(view(ANCHOR[id], cy, sy, cp, sp), Math.min(W, H * 1.55) / 17 * zoom); return { x: s[0], y: s[1] }; },
    pickAt: (x, y) => pick(x, y),
  };
})();
