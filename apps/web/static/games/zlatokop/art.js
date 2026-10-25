'use strict';
// ── ZLATOKOP · kresba ───────────────────────────────────────────────────────
// Sprity do canvasu: starý zlatokop u navijáku (klobouk, vousy, kšandy), drapák se třemi drápy,
// hroudy zlata, kameny, broušené diamanty, pytle s otazníkem, krtek s helmou, sud TNT a kosti,
// a pozadí dolu s vrstvami hlíny. Sdílí je hra i obrázek na úvodní stránce.
const ZkArt = (() => {
  const TAU = Math.PI * 2, OL = '#2a160c';
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // nepravidelný obrys hroudy: poloměry v násobcích r
  function blob(r, n = 9) { const out = []; for (let i = 0; i < n; i++) out.push(0.78 + r() * 0.3); return out; }
  function blobPath(g, x, y, r, shape, sq = 1) {
    const n = shape.length; g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a0 = (i - 0.5) / n * TAU, a1 = i / n * TAU, k0 = shape[(i + n - 1) % n], k1 = shape[i % n];
      const px = x + Math.cos(a1) * r * k1, py = y + Math.sin(a1) * r * k1 * sq;
      if (i === 0) g.moveTo(px, py); else { const kc = (k0 + k1) / 2 * 1.06; g.quadraticCurveTo(x + Math.cos(a0) * r * kc, y + Math.sin(a0) * r * kc * sq, px, py); }
    }
    g.closePath();
  }
  function sparkle(g, x, y, s, a) {
    if (a <= 0) return;
    g.save(); g.globalAlpha = a; g.fillStyle = '#fff'; g.translate(x, y);
    g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(0, 0, s, 0); g.quadraticCurveTo(0, 0, 0, s); g.quadraticCurveTo(0, 0, -s, 0); g.quadraticCurveTo(0, 0, 0, -s); g.fill();
    g.restore();
  }

  // ── Předměty ── it: { type, x, y, r, shape, dir, ph, diamond }
  function item(g, it, t) {
    const { x, y, r } = it;
    g.save(); g.lineJoin = 'round';
    if (it.type === 'gold') {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 2, y + r * 0.75, r * 0.95, r * 0.3, 0, 0, TAU); g.fill();
      blobPath(g, x, y, r, it.shape, 0.86);
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1); gr.addColorStop(0, '#fff3a6'); gr.addColorStop(0.35, '#ffd23f'); gr.addColorStop(0.8, '#e09a14'); gr.addColorStop(1, '#a8650a');
      g.fillStyle = gr; g.fill(); g.strokeStyle = OL; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.38, r * 0.22, r * 0.12, -0.6, 0, TAU); g.fill();
      g.fillStyle = 'rgba(150,80,0,.35)'; for (let i = 0; i < 3; i++) { const a = it.shape[i] * 9 + i * 2; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.35, r * 0.09, 0, TAU); g.fill(); }
      sparkle(g, x + r * 0.4, y - r * 0.3, 2 + r * 0.14, Math.max(0, Math.sin(t * 2.2 + it.ph)) * 0.95);
    } else if (it.type === 'stone') {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 2, y + r * 0.72, r * 0.95, r * 0.28, 0, 0, TAU); g.fill();
      blobPath(g, x, y, r, it.shape, 0.8);
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.1); gr.addColorStop(0, '#c9c4bd'); gr.addColorStop(0.6, '#8d8780'); gr.addColorStop(1, '#5a554f');
      g.fillStyle = gr; g.fill(); g.strokeStyle = OL; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(40,30,20,.45)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - r * 0.1, y - r * 0.5); g.lineTo(x + r * 0.05, y - r * 0.1); g.lineTo(x - r * 0.15, y + r * 0.2); g.moveTo(x + r * 0.05, y - r * 0.1); g.lineTo(x + r * 0.4, y); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(x - r * 0.4, y - r * 0.32, r * 0.2, r * 0.1, -0.5, 0, TAU); g.fill();
    } else if (it.type === 'diamond') {
      const s = r * 1.15;
      g.fillStyle = 'rgba(80,220,255,.18)'; g.beginPath(); g.arc(x, y, r * 2, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(x - s, y - s * 0.25); g.lineTo(x - s * 0.5, y - s * 0.7); g.lineTo(x + s * 0.5, y - s * 0.7); g.lineTo(x + s, y - s * 0.25); g.lineTo(x, y + s * 0.95); g.closePath();
      g.fillStyle = '#8ef0ff'; g.fill(); g.strokeStyle = '#0d3a5a'; g.lineWidth = 1.8; g.stroke();
      g.fillStyle = '#d8fbff'; g.beginPath(); g.moveTo(x - s * 0.5, y - s * 0.7); g.lineTo(x - s * 0.15, y - s * 0.25); g.lineTo(x - s, y - s * 0.25); g.closePath(); g.fill();
      g.fillStyle = '#3ac6f0'; g.beginPath(); g.moveTo(x + s * 0.15, y - s * 0.25); g.lineTo(x + s, y - s * 0.25); g.lineTo(x, y + s * 0.95); g.closePath(); g.fill();
      g.fillStyle = '#5fdcff'; g.beginPath(); g.moveTo(x - s * 0.15, y - s * 0.25); g.lineTo(x + s * 0.15, y - s * 0.25); g.lineTo(x, y + s * 0.95); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(13,58,90,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - s, y - s * 0.25); g.lineTo(x + s, y - s * 0.25); g.moveTo(x - s * 0.5, y - s * 0.7); g.lineTo(x - s * 0.15, y - s * 0.25); g.lineTo(x, y + s * 0.95); g.lineTo(x + s * 0.15, y - s * 0.25); g.lineTo(x + s * 0.5, y - s * 0.7); g.stroke();
      sparkle(g, x - s * 0.4, y - s * 0.5, 5, Math.max(0, Math.sin(t * 3 + it.ph)));
      sparkle(g, x + s * 0.5, y + s * 0.1, 3.5, Math.max(0, Math.sin(t * 3 + it.ph + 2)));
    } else if (it.type === 'bag') {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 2, y + r * 0.85, r, r * 0.28, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(x - r * 0.35, y - r * 0.55); g.quadraticCurveTo(x - r * 1.15, y + r * 0.1, x - r * 0.8, y + r * 0.75); g.quadraticCurveTo(x, y + r * 1.05, x + r * 0.8, y + r * 0.75); g.quadraticCurveTo(x + r * 1.15, y + r * 0.1, x + r * 0.35, y - r * 0.55); g.closePath();
      const gr = g.createLinearGradient(x - r, y, x + r, y); gr.addColorStop(0, '#c9944e'); gr.addColorStop(0.5, '#e3b26a'); gr.addColorStop(1, '#a8743a');
      g.fillStyle = gr; g.fill(); g.strokeStyle = OL; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#c9944e'; g.beginPath(); g.moveTo(x - r * 0.45, y - r * 0.95); g.lineTo(x - r * 0.25, y - r * 0.55); g.lineTo(x + r * 0.25, y - r * 0.55); g.lineTo(x + r * 0.45, y - r * 0.95); g.quadraticCurveTo(x, y - r * 0.75, x - r * 0.45, y - r * 0.95); g.fill(); g.stroke();
      g.strokeStyle = '#7a3b1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - r * 0.38, y - r * 0.58); g.lineTo(x + r * 0.38, y - r * 0.58); g.stroke();
      g.fillStyle = '#5a2a10'; g.font = `900 ${Math.round(r * 1.05)}px Unbounded, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', x, y + r * 0.2);
    } else if (it.type === 'mole') {
      const d = it.dir || 1, bob = Math.sin(t * 10 + it.ph) * 1.2;
      g.translate(x, y + bob); g.scale(d, 1);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, r * 0.8 - bob, r * 1.1, r * 0.25, 0, 0, TAU); g.fill();
      g.fillStyle = '#7a5640'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, r * 1.15, r * 0.82, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#9a7258'; g.beginPath(); g.ellipse(r * 0.1, r * 0.25, r * 0.7, r * 0.4, 0, 0, TAU); g.fill();
      g.fillStyle = '#ff9aa8'; g.beginPath(); g.arc(r * 1.15, -r * 0.05, r * 0.24, 0, TAU); g.fill(); g.stroke();
      for (const fx of [-0.6, 0.55]) { g.fillStyle = '#ffb3a0'; g.beginPath(); g.ellipse(r * fx, r * 0.75, r * 0.28, r * 0.14, 0, 0, TAU); g.fill(); g.lineWidth = 1.2; g.stroke(); }
      g.fillStyle = '#1a0e08'; g.beginPath(); g.arc(r * 0.62, -r * 0.3, r * 0.11, 0, TAU); g.fill();
      // přilba s lampičkou
      g.fillStyle = '#ffd23f'; g.lineWidth = 1.6; g.beginPath(); g.arc(r * 0.1, -r * 0.52, r * 0.62, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(r * 0.55, -r * 0.82, r * 0.16, 0, TAU); g.fill();
      if (it.diamond) { g.scale(d, 1); item(g, { type: 'diamond', x: d * r * 1.3, y: r * 0.3, r: r * 0.55, ph: it.ph }, t); }
    } else if (it.type === 'tnt') {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 2, y + r * 1.0, r * 0.9, r * 0.22, 0, 0, TAU); g.fill();
      const gr = g.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, '#9a1a14'); gr.addColorStop(0.45, '#e2402c'); gr.addColorStop(1, '#8a140e');
      g.fillStyle = gr; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.roundRect(x - r * 0.8, y - r, r * 1.6, r * 2, r * 0.3); g.fill(); g.stroke();
      g.fillStyle = '#3a2a20'; for (const yy of [-0.7, 0.55]) g.fillRect(x - r * 0.8, y + r * yy, r * 1.6, r * 0.16);
      g.fillStyle = '#fff3d0'; g.font = `900 ${Math.round(r * 0.62)}px Unbounded, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TNT', x, y + 1);
      g.strokeStyle = '#d8c8a8'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + r * 0.2, y - r); g.quadraticCurveTo(x + r * 0.5, y - r * 1.5, x + r * 0.2, y - r * 1.7); g.stroke();
      if (Math.sin(t * 14 + it.ph) > 0) { g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x + r * 0.2, y - r * 1.75, 3, 0, TAU); g.fill(); }
    } else if (it.type === 'skull') {
      g.fillStyle = '#efe6d2'; g.strokeStyle = OL; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y - r * 0.15, r * 0.85, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(x + r * 0.55, y + r * 0.75); g.lineTo(x - r * 0.55, y + r * 0.75); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#3a2418'; for (const sx of [-0.35, 0.35]) { g.beginPath(); g.ellipse(x + r * sx, y - r * 0.05, r * 0.22, r * 0.26, 0, 0, TAU); g.fill(); }
      g.beginPath(); g.moveTo(x, y + r * 0.25); g.lineTo(x - r * 0.1, y + r * 0.45); g.lineTo(x + r * 0.1, y + r * 0.45); g.fill();
    } else if (it.type === 'bone') {
      g.translate(x, y); g.rotate(it.shape[0] * 3);
      g.strokeStyle = OL; g.lineWidth = r * 0.55 + 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke();
      g.strokeStyle = '#efe6d2'; g.lineWidth = r * 0.55; g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke();
      g.fillStyle = '#efe6d2'; g.strokeStyle = OL; g.lineWidth = 1.5;
      for (const ex of [-r, r]) for (const ey of [-0.3, 0.3]) { g.beginPath(); g.arc(ex, r * ey, r * 0.32, 0, TAU); g.fill(); g.stroke(); }
      g.fillStyle = '#efe6d2'; g.fillRect(-r, -r * 0.25, r * 2, r * 0.5);
    }
    g.restore();
  }

  // ── Drapák ── (x, y) je kloub, ang úhel lana (0 = dolů), open 0–1
  function claw(g, x, y, ang, open) {
    g.save(); g.translate(x, y); g.rotate(-ang); g.lineCap = 'round'; g.lineJoin = 'round';
    const sp = 0.35 + open * 0.45;
    for (const [w, c] of [[6, OL], [3.5, '#c9ced8']]) {
      g.strokeStyle = c; g.lineWidth = w;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, 2); g.quadraticCurveTo(s * 14 * sp + s * 6, 8, s * 10 * sp + s * 2, 20); g.lineTo(s * 2, 23); g.stroke(); }
      g.beginPath(); g.moveTo(0, 2); g.lineTo(0, 16); g.stroke();
    }
    g.fillStyle = '#8a92a4'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.arc(0, 2, 5, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#e8ecf4'; g.beginPath(); g.arc(-1.5, 0.5, 1.6, 0, TAU); g.fill();
    g.restore();
  }

  // ── Zlatokop u navijáku ── (x, y) jsou nohy; crank = úhel kliky, strain 0–1 při tažení
  function miner(g, x, y, o) {
    const cr = o.crank || 0, st = o.strain || 0, t = o.t || 0;
    g.save(); g.translate(x, y); g.lineJoin = 'round'; g.lineCap = 'round';
    const lean = -st * 0.12, hx = Math.cos(cr) * 9, hy = Math.sin(cr) * 9;
    // nohy a boty
    g.strokeStyle = OL; g.lineWidth = 9; g.beginPath(); g.moveTo(-5, -26); g.lineTo(-7, -3); g.moveTo(6, -26); g.lineTo(8, -3); g.stroke();
    g.strokeStyle = '#3b5a8c'; g.lineWidth = 6.5; g.beginPath(); g.moveTo(-5, -26); g.lineTo(-7, -3); g.moveTo(6, -26); g.lineTo(8, -3); g.stroke();
    g.fillStyle = '#4a2a14'; g.strokeStyle = OL; g.lineWidth = 1.6; for (const bx of [-9, 6]) { g.beginPath(); g.roundRect(bx - 5, -5, 12, 6, 3); g.fill(); g.stroke(); }
    g.rotate(lean);
    // tělo: košile a kšandy
    g.fillStyle = '#c8402e'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.roundRect(-12, -54, 24, 32, 8); g.fill(); g.stroke();
    g.strokeStyle = '#3b5a8c'; g.lineWidth = 3; g.beginPath(); g.moveTo(-6, -53); g.lineTo(-6, -24); g.moveTo(6, -53); g.lineTo(6, -24); g.stroke();
    g.fillStyle = '#3b5a8c'; g.fillRect(-12, -30, 24, 8); g.fillStyle = '#ffd23f'; g.fillRect(-2, -29, 4, 5);
    // ruka na klice navijáku (vlevo od zlatokopa)
    const kx = -26 + hx, ky = -38 + hy;
    g.strokeStyle = OL; g.lineWidth = 8; g.beginPath(); g.moveTo(-8, -48); g.quadraticCurveTo(-18, -40, kx, ky); g.stroke();
    g.strokeStyle = '#c8402e'; g.lineWidth = 5.5; g.beginPath(); g.moveTo(-8, -48); g.quadraticCurveTo(-18, -40, kx, ky); g.stroke();
    g.fillStyle = '#f2c79a'; g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.arc(kx, ky, 4, 0, TAU); g.fill(); g.stroke();
    // hlava: obličej, nos, vousy a klobouk
    g.fillStyle = '#f2c79a'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.arc(0, -66, 12, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#e8a87c'; g.beginPath(); g.ellipse(-8, -64, 5, 4, 0, 0, TAU); g.fill(); g.lineWidth = 1.4; g.stroke();
    g.fillStyle = '#f4f1ea'; g.strokeStyle = OL; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-12, -62); g.quadraticCurveTo(-14, -44, -2, -42 + Math.sin(t * 3) * 1); g.quadraticCurveTo(10, -46, 12, -60); g.quadraticCurveTo(0, -56, -12, -62); g.fill(); g.stroke();
    g.fillStyle = '#1a0e08'; g.beginPath(); g.arc(-4, -69, 1.8, 0, TAU); g.fill();
    g.strokeStyle = '#d8d2c4'; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, -73); g.lineTo(-1, -74); g.stroke();
    g.fillStyle = '#7a4a24'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -76, 19, 4.5, -0.08, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-10, -77); g.quadraticCurveTo(-11, -92, 0, -91); g.quadraticCurveTo(11, -92, 10, -77); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#4a2a14'; g.fillRect(-10, -81, 20, 4);
    g.restore();
  }

  // naviják na kozlíku: buben s navinutým lanem, klika
  function winch(g, x, y, crank, coil) {
    g.save(); g.translate(x, y); g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = OL; g.lineWidth = 7; g.beginPath(); g.moveTo(-26, 22); g.lineTo(-8, -10); g.moveTo(26, 22); g.lineTo(8, -10); g.stroke();
    g.strokeStyle = '#a8703a'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(-26, 22); g.lineTo(-8, -10); g.moveTo(26, 22); g.lineTo(8, -10); g.stroke();
    g.fillStyle = '#7a4a24'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.roundRect(-22, -14, 44, 18, 6); g.fill(); g.stroke();
    g.strokeStyle = '#d8c8a0'; g.lineWidth = 1.6; for (let i = -18; i <= 18; i += 4) { g.beginPath(); g.moveTo(i + (coil % 4), -12); g.lineTo(i + 2 + (coil % 4), 2); g.stroke(); }
    g.fillStyle = '#4a2a14'; g.beginPath(); g.arc(24, -5, 6, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = '#8a92a4'; g.lineWidth = 3; g.beginPath(); g.moveTo(24, -5); g.lineTo(24 + Math.cos(crank) * 9, -5 + Math.sin(crank) * 9); g.stroke();
    g.restore();
  }

  // pozadí dolu: obloha nad povrchem, tráva, vrstvy hlíny, oblázky a kořeny
  const SURF = 92;
  function background(W, H, seed, tier) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = rngOf(seed);
    const sky = g.createLinearGradient(0, 0, 0, SURF); sky.addColorStop(0, '#ffb35c'); sky.addColorStop(0.55, '#ffd98a'); sky.addColorStop(1, '#ffe9b8');
    g.fillStyle = sky; g.fillRect(0, 0, W, SURF);
    g.fillStyle = 'rgba(255,248,220,.9)'; g.beginPath(); g.arc(W * 0.12, 30, 16, 0, TAU); g.fill();
    // vzdálené kopce a kaktusy
    g.fillStyle = '#e8a060'; g.beginPath(); g.moveTo(0, SURF - 10); for (let x = 0; x <= W; x += 40) g.lineTo(x, SURF - 22 - Math.sin(x * 0.012 + seed) * 12 - r() * 6); g.lineTo(W, SURF); g.lineTo(0, SURF); g.fill();
    g.fillStyle = '#c97a44'; g.beginPath(); g.moveTo(0, SURF); for (let x = 0; x <= W; x += 30) g.lineTo(x, SURF - 8 - Math.sin(x * 0.03 + seed * 2) * 5); g.lineTo(W, SURF); g.fill();
    for (const cx of [W * 0.06, W * 0.88, W * 0.94]) {
      g.strokeStyle = '#3e7a3a'; g.lineCap = 'round'; g.lineWidth = 7; g.beginPath(); g.moveTo(cx, SURF - 4); g.lineTo(cx, SURF - 34); g.moveTo(cx, SURF - 18); g.quadraticCurveTo(cx - 10, SURF - 18, cx - 10, SURF - 28); g.moveTo(cx, SURF - 22); g.quadraticCurveTo(cx + 9, SURF - 22, cx + 9, SURF - 32); g.stroke();
    }
    // hlína po vrstvách, hlouběji tmavší (vyšší úroveň = tmavší důl)
    const dk = Math.min(0.35, tier * 0.025);
    const layers = [['#a0663a', '#8e5631'], ['#8a5230', '#7a462a'], ['#764528', '#663a22'], ['#5f3620', '#52301c']];
    let y0 = SURF;
    for (let i = 0; i < layers.length; i++) {
      const y1 = i === layers.length - 1 ? H : SURF + (H - SURF) * (i + 1) / layers.length + (r() - 0.5) * 14;
      const lg = g.createLinearGradient(0, y0, 0, y1); lg.addColorStop(0, layers[i][0]); lg.addColorStop(1, layers[i][1]);
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, y0); for (let x = 0; x <= W; x += 32) g.lineTo(x, y0 + Math.sin(x * 0.02 + i * 3) * 4); g.lineTo(W, y1); g.lineTo(0, y1); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= W; x += 32) g.lineTo(x, y0 + Math.sin(x * 0.02 + i * 3) * 4); g.stroke();
      y0 = y1;
    }
    g.fillStyle = `rgba(10,4,0,${dk})`; g.fillRect(0, SURF, W, H - SURF);
    for (let i = 0; i < 160; i++) { const px = r() * W, py = SURF + 10 + r() * (H - SURF - 10); g.fillStyle = r() < 0.5 ? 'rgba(255,220,180,.12)' : 'rgba(0,0,0,.16)'; g.beginPath(); g.ellipse(px, py, 1.5 + r() * 3.5, 1 + r() * 2, r() * 3, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(60,30,10,.5)'; g.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) { let px = r() * W, py = SURF + 2; g.beginPath(); g.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 14; py += 5 + r() * 6; g.lineTo(px, py); } g.stroke(); }
    // tráva a hrana povrchu
    g.fillStyle = '#6aa84f'; g.fillRect(0, SURF - 4, W, 6);
    g.fillStyle = '#4e8a3a'; for (let x = 0; x < W; x += 5) { g.beginPath(); g.moveTo(x, SURF); g.lineTo(x + 2, SURF - 6 - r() * 4); g.lineTo(x + 4, SURF); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, SURF + 2, W, 3);
    return c;
  }

  return { item, claw, miner, winch, background, blob, sparkle, rngOf, SURF };
})();
