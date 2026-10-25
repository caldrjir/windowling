'use strict';
// ── ZLATOKOP · kresba ───────────────────────────────────────────────────────
// Sprity do canvasu: starý zlatokop u navijáku (klobouk, vousy, kšandy), drapák se dvěma čelistmi,
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
    if (it.type === 'gold' || it.type === 'stone') {
      // hrbolatá hrouda: obrys, plastický přechod, boule uvnitř, odlesk a jiskry
      const gold = it.type === 'gold';
      const C = gold ? ['#6b3a00', '#fffbd6', '#ffe14d', '#f2a71b', '#a8620a'] : ['#2a2622', '#ebe7e1', '#aaa49c', '#7d766e', '#4a443e'];
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x + 3, y + r * 0.72, r * 0.98, r * 0.3, 0, 0, TAU); g.fill();
      blobPath(g, x, y, r, it.shape, 0.84);
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.05, x, y, r * 1.15);
      gr.addColorStop(0, C[1]); gr.addColorStop(0.3, C[2]); gr.addColorStop(0.72, C[3]); gr.addColorStop(1, C[4]);
      g.fillStyle = gr; g.fill();
      g.save(); g.clip();
      for (let k = 0; k < 3; k++) {
        const a = it.shape[k] * 7 + k * 2.1, bx = x + Math.cos(a) * r * 0.45, by = y + Math.sin(a) * r * 0.34, br = r * (0.3 + it.shape[k + 3] * 0.12);
        g.fillStyle = gold ? 'rgba(150,75,0,.22)' : 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(bx + br * 0.18, by + br * 0.22, br, 0, TAU); g.fill();
        const bg2 = g.createRadialGradient(bx - br * 0.3, by - br * 0.35, br * 0.05, bx, by, br); bg2.addColorStop(0, gold ? 'rgba(255,252,215,.75)' : 'rgba(255,255,255,.4)'); bg2.addColorStop(1, gold ? 'rgba(255,225,77,0)' : 'rgba(170,164,156,0)');
        g.fillStyle = bg2; g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill();
      }
      g.fillStyle = gold ? 'rgba(140,70,0,.22)' : 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(x + r * 0.25, y + r * 0.7, r, r * 0.45, 0, 0, TAU); g.fill();
      g.restore();
      blobPath(g, x, y, r, it.shape, 0.84); g.strokeStyle = C[0]; g.lineWidth = Math.max(2, r * 0.07); g.stroke();
      if (!gold) { g.strokeStyle = 'rgba(30,24,20,.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - r * 0.1, y - r * 0.55); g.lineTo(x + r * 0.05, y - r * 0.1); g.lineTo(x - r * 0.18, y + r * 0.25); g.moveTo(x + r * 0.05, y - r * 0.1); g.lineTo(x + r * 0.42, y + r * 0.02); g.stroke(); }
      g.fillStyle = gold ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.38, r * 0.22, r * 0.11, -0.6, 0, TAU); g.fill();
      g.beginPath(); g.arc(x - r * 0.08, y - r * 0.52, r * 0.06, 0, TAU); g.fill();
      if (gold) { sparkle(g, x + r * 0.42, y - r * 0.28, 3 + r * 0.16, Math.max(0, Math.sin(t * 2.2 + it.ph)) * 0.95); sparkle(g, x - r * 0.5, y + r * 0.25, 2 + r * 0.1, Math.max(0, Math.sin(t * 2.2 + it.ph + 2.4)) * 0.8); }
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
    const sp = 0.3 + open * 0.55;
    for (const s of [-1, 1]) {
      g.save(); g.rotate(s * (sp - 0.45) * 0.9);
      g.beginPath(); g.moveTo(s * 3, 4); g.bezierCurveTo(s * 18, 6, s * 20, 20, s * 8, 28); g.lineTo(s * 4, 25); g.bezierCurveTo(s * 13, 19, s * 12, 10, s * 1, 9); g.closePath();
      const jg = g.createLinearGradient(-12, 0, 12, 0); jg.addColorStop(0, '#9aa3b4'); jg.addColorStop(0.5, '#eef1f6'); jg.addColorStop(1, '#7c8596');
      g.fillStyle = jg; g.fill(); g.strokeStyle = OL; g.lineWidth = 1.8; g.stroke();
      g.restore();
    }
    g.fillStyle = '#c99a3a'; g.strokeStyle = OL; g.lineWidth = 1.8; g.beginPath(); g.roundRect(-7, -3, 14, 10, 3); g.fill(); g.stroke();
    g.fillStyle = '#8a92a4'; g.beginPath(); g.arc(0, 2, 3.4, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#fff3c0'; g.fillRect(-5, -1.5, 4, 1.6);
    g.restore();
  }

  // ── Zlatokop ── (x, y) nohy na plošině; hand = poloha kliky vůči nohám, strain 0–1 při tažení
  function miner(g, x, y, o) {
    const st = o.strain || 0, t = o.t || 0, [hx, hy] = o.hand || [-28, -32];
    g.save(); g.translate(x, y); g.lineJoin = 'round'; g.lineCap = 'round';
    const bob = Math.sin(t * 2) * 0.6 + st * 1.5;
    const stroke2 = (w, col, pts) => { for (const [lw, c] of [[w + 3, OL], [w, col]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); } };
    // nohy v montérkách a boty
    stroke2(8, '#3b5a8c', [-6, -30, -9 - st * 3, -15, -9 - st * 3, -4]);
    stroke2(8, '#4a6aa0', [6, -30, 8, -15, 8, -4]);
    g.fillStyle = '#4a2a14'; g.strokeStyle = OL; g.lineWidth = 1.8; for (const bx of [-11 - st * 3, 6]) { g.beginPath(); g.moveTo(bx - 6, 0); g.quadraticCurveTo(bx - 6, -7, bx, -7); g.lineTo(bx + 4, -7); g.quadraticCurveTo(bx + 11, -5, bx + 11, 0); g.closePath(); g.fill(); g.stroke(); }
    g.translate(0, bob); g.rotate(-st * 0.1);
    // trup: kostkovaná košile, kšandy, pásek s přezkou
    g.fillStyle = '#c8402e'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.moveTo(-13, -30); g.quadraticCurveTo(-15, -50, -10, -60); g.lineTo(10, -60); g.quadraticCurveTo(16, -48, 13, -30); g.closePath(); g.fill();
    g.save(); g.clip(); g.strokeStyle = 'rgba(80,10,10,.45)'; g.lineWidth = 2; for (let i = -16; i <= 16; i += 6) { g.beginPath(); g.moveTo(i, -62); g.lineTo(i, -28); g.stroke(); } for (let j = -58; j <= -30; j += 6) { g.beginPath(); g.moveTo(-16, j); g.lineTo(16, j); g.stroke(); } g.restore();
    g.stroke();
    g.strokeStyle = '#2b3f66'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(-7, -59); g.lineTo(-6, -32); g.moveTo(7, -59); g.lineTo(6, -32); g.stroke();
    g.fillStyle = '#3b2412'; g.fillRect(-14, -34, 28, 6); g.fillStyle = '#ffd23f'; g.strokeStyle = OL; g.lineWidth = 1; g.beginPath(); g.rect(-3, -34, 6, 6); g.fill(); g.stroke();
    // ruka na klice, druhá v bok
    stroke2(6.5, '#c8402e', [9, -54, 18, -42, 14, -34]);
    g.fillStyle = '#f2c79a'; g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.arc(14, -33, 4, 0, TAU); g.fill(); g.stroke();
    const ex = (-8 + hx) / 2 - 4, ey = (-54 + hy - bob) / 2 + 6;
    stroke2(6.5, '#c8402e', [-8, -54, ex, ey, hx, hy - bob]);
    g.fillStyle = '#f2c79a'; g.beginPath(); g.arc(hx, hy - bob, 4.5, 0, TAU); g.fill(); g.stroke();
    // hlava: velký nos, obočí, bílé vousy a knír, klobouk s páskou
    g.fillStyle = '#f2c79a'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -72, 12, 13, 0, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(11, -71, 3.5, 4.5, 0, 0, TAU); g.fill(); g.stroke(); // ucho
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(-12, -70); g.quadraticCurveTo(-16, -50, -3, -46 + Math.sin(t * 3) * 0.8); g.quadraticCurveTo(8, -48, 10, -64); g.quadraticCurveTo(-1, -60, -12, -70); g.fill(); g.stroke();
    g.fillStyle = '#e8e2d6'; g.beginPath(); g.ellipse(-8, -64, 7, 3.5, -0.2, 0, TAU); g.fill(); g.lineWidth = 1.4; g.stroke();
    g.fillStyle = '#e8957a'; g.beginPath(); g.ellipse(-11, -68, 5, 4.2, 0, 0, TAU); g.fill(); g.stroke(); // nos
    g.fillStyle = '#1a0e08'; g.beginPath(); g.ellipse(-6, -75, 1.6, 2.2, 0, 0, TAU); g.fill();
    g.strokeStyle = '#d8d2c4'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-10, -79); g.lineTo(-2, -80); g.stroke();
    g.fillStyle = '#8a5428'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -83, 22, 5, -0.06, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-12, -84); g.quadraticCurveTo(-13, -101, -4, -99); g.quadraticCurveTo(0, -95, 4, -99); g.quadraticCurveTo(13, -101, 12, -84); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#4a2a14'; g.beginPath(); g.moveTo(-12, -88); g.lineTo(12, -88); g.lineTo(12, -84); g.lineTo(-12, -84); g.fill();
    g.restore();
  }

  // naviják: dřevěný kozlík, buben s navinutým lanem a železnými obručemi, klika vpravo
  const DRUM = { y: 76, w: 34, r: 15 };
  function rig(g, x, o) {
    const crank = o.crank || 0, coil = o.coil || 0, y = DRUM.y, w = DRUM.w, r = DRUM.r;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const beam = (x0, y0, x1, y1, wd) => { for (const [lw, c] of [[wd + 3, OL], [wd, '#a8703a']]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); } g.strokeStyle = 'rgba(255,220,170,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0 - 1.5, y0); g.lineTo(x1 - 1.5, y1); g.stroke(); };
    for (const s of [-1, 1]) { beam(x + s * (w + 16), SURF - 8, x + s * (w + 4), y, 6); beam(x + s * (w - 2), SURF - 8, x + s * (w + 4), y, 6); }
    beam(x - w - 12, y + 24, x - w + 2, y + 24, 4); beam(x + w - 2, y + 24, x + w + 12, y + 24, 4);
    // buben
    const dg = g.createLinearGradient(0, y - r, 0, y + r); dg.addColorStop(0, '#6b4224'); dg.addColorStop(0.35, '#c99460'); dg.addColorStop(1, '#5a361c');
    g.fillStyle = dg; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.rect(x - w, y - r, w * 2, r * 2); g.fill(); g.stroke();
    g.save(); g.beginPath(); g.rect(x - w + 6, y - r, w * 2 - 12, r * 2); g.clip();
    for (let i = -w - 8; i < w + 8; i += 4) { const ox = i + (coil * 4) % 4; g.strokeStyle = '#e8d6a8'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + ox, y - r); g.lineTo(x + ox + 3, y + r); g.stroke(); g.strokeStyle = 'rgba(90,60,30,.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + ox + 1.6, y - r); g.lineTo(x + ox + 4.6, y + r); g.stroke(); }
    const sh = g.createLinearGradient(0, y - r, 0, y + r); sh.addColorStop(0, 'rgba(0,0,0,.25)'); sh.addColorStop(0.35, 'rgba(255,255,255,.12)'); sh.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = sh; g.fillRect(x - w, y - r, w * 2, r * 2);
    g.restore();
    for (const s of [-1, 1]) { g.fillStyle = '#5d6478'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.ellipse(x + s * (w - 3), y, 5, r + 3, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#9aa3b8'; g.beginPath(); g.ellipse(x + s * (w - 3) - 1, y - 4, 1.5, 5, 0, 0, TAU); g.fill(); }
    // klika
    const cx = x + w + 5, hx = cx + Math.cos(crank) * 10, hy = y + Math.sin(crank) * 10;
    g.fillStyle = '#3b3f4e'; g.beginPath(); g.arc(cx, y, 4.5, 0, TAU); g.fill(); g.stroke();
    for (const [lw, c] of [[6, OL], [3.5, '#8a92a4']]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(cx, y); g.lineTo(hx, hy); g.stroke(); }
    g.fillStyle = '#c8402e'; g.beginPath(); g.arc(hx, hy, 3.5, 0, TAU); g.fill(); g.lineWidth = 1.5; g.stroke();
    // kladka pod bubnem
    g.fillStyle = '#5d6478'; g.beginPath(); g.arc(x, y + r + 4, 4, 0, TAU); g.fill(); g.lineWidth = 1.5; g.stroke();
    g.restore();
    return [hx, hy];
  }

  // dřevěná cedule pro HUD
  function plank(g, x, y, w, h) {
    g.save();
    const wg = g.createLinearGradient(0, y, 0, y + h); wg.addColorStop(0, '#b47a40'); wg.addColorStop(1, '#7a4a24');
    g.fillStyle = wg; g.strokeStyle = OL; g.lineWidth = 2.5; g.beginPath(); g.roundRect(x, y, w, h, 8); g.fill(); g.stroke();
    g.save(); g.clip(); g.strokeStyle = 'rgba(60,30,10,.28)'; g.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { const yy = y + 8 + i * (h - 12) / 3; g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + w * 0.3, yy - 3, x + w * 0.6, yy + 3, x + w, yy); g.stroke(); }
    g.fillStyle = 'rgba(255,230,180,.18)'; g.fillRect(x, y, w, 3); g.restore();
    g.fillStyle = '#4a4e5a'; for (const [nx, ny] of [[x + 7, y + 7], [x + w - 7, y + 7], [x + 7, y + h - 7], [x + w - 7, y + h - 7]]) { g.beginPath(); g.arc(nx, ny, 2.2, 0, TAU); g.fill(); }
    g.restore();
  }

  // pozadí: poušť se stolovými horami, plošina nad šachtou, vozík se zlatem, krumpáč a lucerna;
  // pod zemí vrstvy hlíny, kamínky, zkameněliny, krystaly a kořeny
  const SURF = 116;
  function background(W, H, seed, tier) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = rngOf(seed);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const sky = g.createLinearGradient(0, 0, 0, SURF); sky.addColorStop(0, '#ff9f4a'); sky.addColorStop(0.6, '#ffd27a'); sky.addColorStop(1, '#ffeab8');
    g.fillStyle = sky; g.fillRect(0, 0, W, SURF);
    const sx = W / 2 - 120, sun = g.createRadialGradient(sx, 34, 4, sx, 34, 60); sun.addColorStop(0, 'rgba(255,255,230,1)'); sun.addColorStop(0.3, 'rgba(255,240,170,.9)'); sun.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = sun; g.fillRect(sx - 60, -26, 120, 120); g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(sx, 34, 15, 0, TAU); g.fill();
    // stolové hory
    const mesa = (x0, x1, top, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x0 - 18, SURF); g.lineTo(x0, top + 6); g.lineTo(x0 + 6, top); g.lineTo(x1 - 6, top); g.lineTo(x1, top + 5); g.lineTo(x1 + 20, SURF); g.closePath(); g.fill(); };
    mesa(W * 0.02, W * 0.2, 40, '#e9a070'); mesa(W * 0.62, W * 0.86, 30, '#e9a070'); mesa(W * 0.3, W * 0.42, 52, '#efb488');
    mesa(W * 0.08, W * 0.14, 58, '#d4824e'); mesa(W * 0.76, W * 0.98, 50, '#d4824e');
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 64, W, 2);
    // písek povrchu
    const sand = g.createLinearGradient(0, SURF - 14, 0, SURF); sand.addColorStop(0, '#f0c27a'); sand.addColorStop(1, '#d99a52');
    g.fillStyle = sand; g.beginPath(); g.moveTo(0, SURF - 10); for (let x = 0; x <= W; x += 20) g.lineTo(x, SURF - 11 - Math.sin(x * 0.05 + seed) * 2); g.lineTo(W, SURF); g.lineTo(0, SURF); g.fill();
    // kaktusy
    const cactus = (cx, s) => { for (const [lw, col] of [[7 * s + 3, OL], [7 * s, '#4a9a46']]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(cx, SURF - 8); g.lineTo(cx, SURF - 8 - 30 * s); g.moveTo(cx, SURF - 8 - 12 * s); g.quadraticCurveTo(cx - 10 * s, SURF - 8 - 12 * s, cx - 10 * s, SURF - 8 - 22 * s); g.moveTo(cx, SURF - 8 - 16 * s); g.quadraticCurveTo(cx + 9 * s, SURF - 8 - 16 * s, cx + 9 * s, SURF - 8 - 26 * s); g.stroke(); } };
    cactus(W * 0.04, 0.8); cactus(W * 0.95, 1);
    // koleje a vozík se zlatem
    g.strokeStyle = '#5a3a20'; g.lineWidth = 3; g.beginPath(); g.moveTo(110, SURF - 6); g.lineTo(240, SURF - 6); g.stroke();
    g.fillStyle = '#7a4a24'; for (let x = 114; x < 240; x += 12) g.fillRect(x, SURF - 6, 6, 4);
    g.strokeStyle = '#9aa3b8'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(110, SURF - 7); g.lineTo(240, SURF - 7); g.stroke();
    const cxx = 150;
    for (let i = 0; i < 6; i++) { const nx = cxx + 6 + i * 7 + r() * 3, ny = SURF - 38 - r() * 6; g.fillStyle = '#f2a71b'; g.strokeStyle = '#6b3a00'; g.lineWidth = 1.4; g.beginPath(); g.arc(nx, ny, 5 + r() * 3, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#fff3a6'; g.beginPath(); g.arc(nx - 2, ny - 2, 1.6, 0, TAU); g.fill(); }
    const cg = g.createLinearGradient(0, SURF - 36, 0, SURF - 14); cg.addColorStop(0, '#8a92a4'); cg.addColorStop(1, '#4a5060');
    g.fillStyle = cg; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.moveTo(cxx - 2, SURF - 36); g.lineTo(cxx + 54, SURF - 36); g.lineTo(cxx + 48, SURF - 14); g.lineTo(cxx + 4, SURF - 14); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#c9ced8'; for (const rx of [cxx + 6, cxx + 26, cxx + 46]) { g.beginPath(); g.arc(rx, SURF - 31, 1.6, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cxx + 2, SURF - 25); g.lineTo(cxx + 50, SURF - 25); g.stroke();
    for (const wx of [cxx + 12, cxx + 40]) { g.fillStyle = '#3b3f4e'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.arc(wx, SURF - 12, 6, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#9aa3b8'; g.beginPath(); g.arc(wx, SURF - 12, 2, 0, TAU); g.fill(); }
    // krumpáč opřený o vozík
    g.save(); g.translate(cxx + 64, SURF - 8); g.rotate(-0.35);
    for (const [lw, col] of [[6, OL], [3.5, '#a8703a']]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -36); g.stroke(); }
    g.fillStyle = '#9aa3b8'; g.strokeStyle = OL; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-16, -30); g.quadraticCurveTo(0, -42, 16, -30); g.quadraticCurveTo(0, -37, -16, -30); g.fill(); g.stroke();
    g.restore();
    // sloupek s lucernou a cedulí
    const px = 470;
    for (const [lw, col] of [[7, OL], [4.5, '#8a5428']]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(px, SURF - 6); g.lineTo(px, SURF - 46); g.moveTo(px, SURF - 44); g.lineTo(px + 14, SURF - 44); g.stroke(); }
    const lg = g.createRadialGradient(px + 14, SURF - 32, 2, px + 14, SURF - 32, 24); lg.addColorStop(0, 'rgba(255,220,120,.7)'); lg.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = lg; g.fillRect(px - 10, SURF - 56, 48, 48);
    g.fillStyle = '#3b3f4e'; g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.roundRect(px + 9, SURF - 40, 10, 14, 3); g.fill(); g.stroke(); g.fillStyle = '#ffd86a'; g.fillRect(px + 11, SURF - 37, 6, 8);
    g.fillStyle = '#c99460'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.roundRect(px - 26, SURF - 30, 30, 14, 3); g.fill(); g.stroke();
    g.fillStyle = '#4a2a14'; g.font = '900 7px Unbounded, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GOLD', px - 11, SURF - 22.5);
    // hlína po vrstvách (hlouběji a ve vyšších dolech tmavší)
    const layers = [['#b07440', '#9a6136'], ['#93572f', '#7f4a28'], ['#7a4426', '#683920'], ['#62351e', '#4f2a18']];
    let y0 = SURF;
    for (let i = 0; i < layers.length; i++) {
      const y1 = i === layers.length - 1 ? H : SURF + (H - SURF) * (i + 1) / layers.length + (r() - 0.5) * 14, ph = r() * 6;
      const lg2 = g.createLinearGradient(0, y0, 0, y1); lg2.addColorStop(0, layers[i][0]); lg2.addColorStop(1, layers[i][1]);
      g.fillStyle = lg2; g.beginPath(); g.moveTo(0, y0); for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 + (i ? Math.sin(x * 0.02 + ph) * 5 : 0)); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
      if (i) { g.strokeStyle = 'rgba(40,18,6,.35)'; g.lineWidth = 2.5; g.beginPath(); for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.02 + ph) * 5); g.stroke(); g.strokeStyle = 'rgba(255,220,170,.12)'; g.lineWidth = 1.5; g.beginPath(); for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 + 3 + Math.sin(x * 0.02 + ph) * 5); g.stroke(); }
      y0 = y1;
    }
    // zrnitost, kamínky a zlaté šupinky
    for (let i = 0; i < 260; i++) { const x = r() * W, y = SURF + 6 + r() * (H - SURF - 6); g.fillStyle = r() < 0.5 ? 'rgba(255,220,180,.1)' : 'rgba(0,0,0,.14)'; g.beginPath(); g.ellipse(x, y, 1 + r() * 3, 0.8 + r() * 1.6, r() * 3, 0, TAU); g.fill(); }
    for (let i = 0; i < 26; i++) { const x = r() * W, y = SURF + 20 + r() * (H - SURF - 24), rr = 2.5 + r() * 4; g.fillStyle = ['#8d8780', '#a89a88', '#6e6458'][i % 3]; g.strokeStyle = 'rgba(30,15,5,.6)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, rr, rr * 0.7, r() * 3, 0, TAU); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(x - rr * 0.3, y - rr * 0.25, rr * 0.3, 0, TAU); g.fill(); }
    for (let i = 0; i < 18; i++) { const x = r() * W, y = SURF + 30 + r() * (H - SURF - 34); g.fillStyle = 'rgba(255,214,90,.75)'; g.beginPath(); g.arc(x, y, 1 + r() * 1.2, 0, TAU); g.fill(); }
    // zkamenělina (amonit) a krystaly
    for (let k = 0; k < 2; k++) {
      const fx = 40 + r() * (W - 80), fy = SURF + 60 + r() * (H - SURF - 90), fr = 7 + r() * 4;
      g.strokeStyle = 'rgba(230,205,170,.45)'; g.lineWidth = 1.6; g.beginPath(); for (let a = 0; a < 14; a += 0.3) { const rr = fr * a / 14; g.lineTo(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr); } g.stroke();
      const kx = 40 + r() * (W - 80), ky = SURF + 80 + r() * (H - SURF - 100);
      for (let j = 0; j < 3; j++) { const a = -0.5 + j * 0.5, l = 8 + r() * 6; g.save(); g.translate(kx + j * 4 - 4, ky); g.rotate(a); g.fillStyle = j === 1 ? '#c99aff' : '#9a6ad8'; g.strokeStyle = '#3a1a5a'; g.lineWidth = 1; g.beginPath(); g.moveTo(-2.5, 0); g.lineTo(-2.5, -l); g.lineTo(0, -l - 4); g.lineTo(2.5, -l); g.lineTo(2.5, 0); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    }
    // kořeny pod povrchem
    g.strokeStyle = 'rgba(70,35,12,.55)'; g.lineWidth = 1.6;
    for (let i = 0; i < 10; i++) { let x = r() * W, y = SURF + 2; if (Math.abs(x - W / 2) < 70) continue; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 12; y += 4 + r() * 6; g.lineTo(x, y); } g.stroke(); }
    // šachta pod plošinou s výdřevou
    const sg = g.createLinearGradient(0, SURF, 0, SURF + 34); sg.addColorStop(0, 'rgba(20,8,2,.85)'); sg.addColorStop(1, 'rgba(20,8,2,0)');
    g.fillStyle = sg; g.beginPath(); g.moveTo(W / 2 - 30, SURF); g.lineTo(W / 2 + 30, SURF); g.lineTo(W / 2 + 22, SURF + 34); g.lineTo(W / 2 - 22, SURF + 34); g.closePath(); g.fill();
    for (const s of [-1, 1]) { for (const [lw, col] of [[7, OL], [4.5, '#8a5428']]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(W / 2 + s * 30, SURF); g.lineTo(W / 2 + s * 24, SURF + 30); g.stroke(); } }
    // tráva a plošina
    g.fillStyle = '#5e9a42'; g.fillRect(0, SURF - 3, W, 4);
    g.fillStyle = '#4a8436'; for (let x = 0; x < W; x += 6) { if (r() < 0.5) continue; g.beginPath(); g.moveTo(x, SURF); g.lineTo(x + 2, SURF - 5 - r() * 4); g.lineTo(x + 4, SURF); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, SURF + 1, W, 3);
    const dg = g.createLinearGradient(0, SURF - 9, 0, SURF); dg.addColorStop(0, '#c99460'); dg.addColorStop(1, '#8a5428');
    g.fillStyle = dg; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.rect(W / 2 - 90, SURF - 9, 180, 8); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(60,30,10,.5)'; g.lineWidth = 1; for (let x = W / 2 - 90 + 18; x < W / 2 + 90; x += 18) { g.beginPath(); g.moveTo(x, SURF - 9); g.lineTo(x, SURF - 1); g.stroke(); }
    // temné okraje dolu
    const vg = g.createRadialGradient(W / 2, SURF + 40, 120, W / 2, H * 0.7, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(15,5,0,${0.4 + Math.min(0.25, tier * 0.02)})`);
    g.fillStyle = vg; g.fillRect(0, SURF + 4, W, H - SURF - 4);
    return c;
  }

  return { item, claw, miner, rig, plank, background, blob, sparkle, rngOf, SURF, DRUM };
})();
