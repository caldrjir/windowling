'use strict';
// ── ŠMIK! · kresba ──────────────────────────────────────────────────────────
// Kreslené ovoce s obrysem (meloun, pomeranč, jablko, citron, kiwi, švestka, ananas, kokos,
// jahoda) celé i rozpůlené s dužinou, banány se zvláštní mocí, bomba s jiskřící zápalnou šňůrou,
// dřevěné dojo jako pozadí a svítící stopa čepele. Sdílí je hra i obrázek na úvodní stránce.
const SmArt = (() => {
  const TAU = Math.PI * 2, OL = '#2a1408';
  const F = {
    melon: { r: 34, skin: ['#7bd24a', '#2e7d1e'], flesh: '#ff4d5a', rind: '#e8f5c8', juice: '#ff3b4a', pts: 1 },
    orange: { r: 23, skin: ['#ffc46a', '#ff8a1a'], flesh: '#ffa53a', juice: '#ff9a2a', pts: 1 },
    apple: { r: 22, skin: ['#ff7a6a', '#c81e2a'], flesh: '#fff3c8', juice: '#fff0b0', pts: 1 },
    lemon: { r: 20, sx: 1.25, skin: ['#fff59a', '#f2c81a'], flesh: '#fff7a8', juice: '#fff27a', pts: 1 },
    kiwi: { r: 19, sx: 1.15, skin: ['#b8844a', '#6b4422'], flesh: '#8fd14a', juice: '#a8e05a', pts: 1 },
    plum: { r: 18, skin: ['#c07aff', '#5a2a8a'], flesh: '#ffd66a', juice: '#c97aff', pts: 1 },
    pine: { r: 27, sy: 1.25, skin: ['#ffd36a', '#c9861a'], flesh: '#ffe680', juice: '#ffe066', pts: 1 },
    coco: { r: 24, skin: ['#9a6a44', '#4a2e18'], flesh: '#fffaf0', juice: '#f4f4f4', pts: 1 },
    straw: { r: 16, skin: ['#ff6a6a', '#c81e2a'], flesh: '#ff9aa8', juice: '#ff4d5a', pts: 1 },
    banana: { r: 22, skin: ['#fff27a', '#e8b81a'], flesh: '#fff8d8', juice: '#fff27a', pts: 1 },
  };
  const POWER = { freeze: '#7ad8ff', frenzy: '#ff6a4a', double: '#ffe066' };

  function body(g, f) { const r = f.r; g.beginPath(); g.ellipse(0, 0, r * (f.sx || 1), r * (f.sy || 1), 0, 0, TAU); }
  function skinFill(g, f) {
    const r = f.r, gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.2);
    gr.addColorStop(0, f.skin[0]); gr.addColorStop(1, f.skin[1]); return gr;
  }
  // celé ovoce v místních souřadnicích (střed 0, 0)
  function whole(g, kind, t = 0, power) {
    const f = F[kind], r = f.r;
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    if (kind === 'banana') { banana(g, f, power, t); g.restore(); return; }
    if (kind === 'pine') { // korunka
      g.fillStyle = '#4caf48'; g.strokeStyle = OL; g.lineWidth = 2;
      for (const [a, l] of [[-0.5, 22], [0, 28], [0.5, 22], [-0.25, 25], [0.25, 25]]) { g.save(); g.translate(0, -r * 1.15); g.rotate(a); g.beginPath(); g.moveTo(-4, 4); g.quadraticCurveTo(-3, -l * 0.6, 0, -l); g.quadraticCurveTo(3, -l * 0.6, 4, 4); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    }
    if (kind === 'straw') { // jahoda: srdíčko
      g.beginPath(); g.moveTo(0, r * 1.15); g.bezierCurveTo(-r * 1.4, r * 0.2, -r * 1.1, -r * 1.05, 0, -r * 0.75); g.bezierCurveTo(r * 1.1, -r * 1.05, r * 1.4, r * 0.2, 0, r * 1.15); g.closePath();
      g.fillStyle = skinFill(g, f); g.fill(); g.strokeStyle = OL; g.lineWidth = 2.2; g.stroke();
      g.fillStyle = '#ffe680'; for (let i = 0; i < 12; i++) { const a = i * 2.4, rr = r * (0.2 + (i % 4) * 0.18); g.beginPath(); g.ellipse(Math.cos(a) * rr, Math.sin(a) * rr * 0.9 + r * 0.1, 1.4, 2.2, a, 0, TAU); g.fill(); }
      g.fillStyle = '#3e9a2e'; for (let i = 0; i < 5; i++) { g.save(); g.translate(0, -r * 0.8); g.rotate(-1.2 + i * 0.6); g.beginPath(); g.ellipse(0, -6, 3.5, 8, 0, 0, TAU); g.fill(); g.lineWidth = 1.4; g.stroke(); g.restore(); }
      g.restore(); return;
    }
    body(g, f); g.fillStyle = skinFill(g, f); g.fill();
    g.save(); body(g, f); g.clip();
    if (kind === 'melon') { g.strokeStyle = '#1f5a14'; g.lineWidth = 5; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 10, -r); g.quadraticCurveTo(i * 13 + Math.sin(i) * 4, 0, i * 10, r); g.stroke(); } }
    if (kind === 'orange') { g.fillStyle = 'rgba(200,90,0,.35)'; for (let i = 0; i < 26; i++) { const a = i * 2.4, rr = r * Math.sqrt((i + 1) / 27); g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * rr, 1.1, 0, TAU); g.fill(); } }
    if (kind === 'kiwi') { g.strokeStyle = 'rgba(60,35,15,.4)'; g.lineWidth = 1; for (let i = 0; i < 40; i++) { const a = i * 2.39, rr = r * Math.sqrt((i + 1) / 41) * 1.1; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.5, y + 2); g.stroke(); } }
    if (kind === 'pine') { g.strokeStyle = 'rgba(140,80,10,.65)'; g.lineWidth = 1.6; for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * 9 - r, -r * 1.3); g.lineTo(i * 9 + r, r * 1.3); g.moveTo(i * 9 + r, -r * 1.3); g.lineTo(i * 9 - r, r * 1.3); g.stroke(); } }
    if (kind === 'coco') { g.strokeStyle = 'rgba(40,22,10,.6)'; g.lineWidth = 1.2; for (let i = 0; i < 30; i++) { const a = i * 2.4, rr = r * ((i % 7) / 7); g.beginPath(); g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); g.lineTo(Math.cos(a) * rr + 4, Math.sin(a) * rr + 1.5); g.stroke(); } g.fillStyle = '#2a1408'; for (const [x, y] of [[-5, -12], [5, -12], [0, -5]]) { g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); } }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(r * 0.3, r * 0.45, r * 1.1, r * 0.7, 0, 0, TAU); g.fill();
    g.restore();
    body(g, f); g.strokeStyle = OL; g.lineWidth = 2.4; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-r * 0.38, -r * 0.42 * (f.sy || 1), r * 0.24, r * 0.13, -0.6, 0, TAU); g.fill();
    if (kind === 'apple' || kind === 'plum') { g.strokeStyle = '#5a3a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -r * 0.85); g.quadraticCurveTo(2, -r * 1.2, 5, -r * 1.35); g.stroke(); }
    if (kind === 'apple') { g.fillStyle = '#4caf48'; g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.ellipse(9, -r * 1.12, 8, 4, -0.5, 0, TAU); g.fill(); g.stroke(); }
    if (kind === 'lemon') { g.fillStyle = f.skin[1]; g.strokeStyle = OL; g.lineWidth = 1.6; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 1.27, 0, 4, 3.5, 0, 0, TAU); g.fill(); g.stroke(); } }
    g.restore();
  }
  function banana(g, f, power, t) {
    if (power) { const gl = g.createRadialGradient(0, 0, 4, 0, 0, 44); gl.addColorStop(0, POWER[power] + 'cc'); gl.addColorStop(1, POWER[power] + '00'); g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.fill(); }
    const path = () => { g.beginPath(); g.moveTo(-28, -10); g.quadraticCurveTo(0, 26, 28, -10); g.quadraticCurveTo(26, -4, 24, -6); g.quadraticCurveTo(0, 12, -24, -6); g.quadraticCurveTo(-26, -6, -28, -10); g.closePath(); };
    path(); const gr = g.createLinearGradient(0, -10, 0, 14); gr.addColorStop(0, f.skin[0]); gr.addColorStop(1, f.skin[1]); g.fillStyle = gr; g.fill();
    g.strokeStyle = OL; g.lineWidth = 2.2; g.stroke();
    g.fillStyle = '#5a3a1a'; g.beginPath(); g.arc(-27, -10, 2.6, 0, TAU); g.arc(27, -10, 2.6, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(0, 10, 14, 0); g.stroke();
    if (power) { g.fillStyle = POWER[power]; g.strokeStyle = OL; g.lineWidth = 1.5; g.font = '900 12px Unbounded, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const ic = power === 'freeze' ? '❄' : power === 'frenzy' ? '✦' : '×2'; g.strokeText(ic, 0, -14 + Math.sin(t * 6) * 1.5); g.fillText(ic, 0, -14 + Math.sin(t * 6) * 1.5); }
  }
  // polovina ovoce: side ±1, řez prochází středem; v místních souřadnicích je řez svislý
  function half(g, kind, side) {
    const f = F[kind], r = f.r, sx = f.sx || 1, sy = f.sy || 1;
    g.save(); g.lineJoin = 'round';
    g.beginPath(); g.rect(side > 0 ? 0 : -r * 2, -r * 2, r * 2, r * 4); g.clip();
    if (kind === 'banana') { banana(g, f, null, 0); g.restore(); g.save(); g.beginPath(); g.ellipse(0, 2, 4, 10, 0, 0, TAU); g.fillStyle = f.flesh; g.fill(); g.restore(); return; }
    // slupka jako obrys kolem dužiny
    g.beginPath(); g.ellipse(0, 0, r * sx, r * sy, 0, 0, TAU); g.fillStyle = kind === 'melon' ? f.skin[1] : f.skin[1]; g.fill(); g.strokeStyle = OL; g.lineWidth = 2.4; g.stroke();
    if (kind === 'melon') { g.beginPath(); g.ellipse(0, 0, r * 0.9, r * 0.9, 0, 0, TAU); g.fillStyle = f.rind; g.fill(); }
    const k = kind === 'melon' ? 0.8 : kind === 'coco' ? 0.78 : 0.88;
    g.beginPath(); g.ellipse(0, 0, r * sx * k, r * sy * k, 0, 0, TAU); g.fillStyle = f.flesh; g.fill();
    // vnitřek podle druhu
    if (kind === 'melon') { g.fillStyle = '#1a1010'; for (let i = 0; i < 9; i++) { const a = i * 0.75 + 0.3, rr = r * 0.5; g.beginPath(); g.ellipse(Math.cos(a) * rr * 0.9, Math.sin(a) * rr, 1.6, 3, a, 0, TAU); g.fill(); } }
    if (kind === 'orange' || kind === 'lemon') { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.6; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * sx * 0.82, Math.sin(a) * r * sy * 0.82); g.stroke(); } g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 2.5, 0, TAU); g.fill(); }
    if (kind === 'kiwi') { g.fillStyle = '#f4ffd8'; g.beginPath(); g.ellipse(0, 0, r * 0.3, r * 0.25, 0, 0, TAU); g.fill(); g.fillStyle = '#1a1010'; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.beginPath(); g.ellipse(Math.cos(a) * r * 0.48 * sx, Math.sin(a) * r * 0.45, 1.1, 2.2, a, 0, TAU); g.fill(); } }
    if (kind === 'apple') { g.fillStyle = '#7a4a24'; for (const y of [-4, 4]) { g.beginPath(); g.ellipse(-2, y, 1.6, 3, 0.4, 0, TAU); g.fill(); } }
    if (kind === 'plum') { g.fillStyle = '#a8743a'; g.beginPath(); g.ellipse(0, 0, r * 0.35, r * 0.5, 0, 0, TAU); g.fill(); }
    if (kind === 'pine') { g.fillStyle = '#fff3b0'; g.beginPath(); g.ellipse(0, 0, r * 0.25, r * 0.3, 0, 0, TAU); g.fill(); }
    if (kind === 'straw') { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, r * 0.3, r * 0.5, 0, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(-r * 0.25 * side, -r * 0.3, r * 0.3, r * 0.12, -0.4, 0, TAU); g.fill();
    g.restore();
    // řezná hrana
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -r * sy * 0.95); g.lineTo(0, r * sy * 0.95); g.stroke();
  }

  // bomba s jiskřící zápalnou šňůrou a pulzující červenou září
  function bomb(g, t) {
    const r = 22;
    const gl = g.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.8); gl.addColorStop(0, `rgba(255,40,40,${0.35 + 0.2 * Math.sin(t * 10)})`); gl.addColorStop(1, 'rgba(255,40,40,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, r * 1.8, 0, TAU); g.fill();
    const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1); gr.addColorStop(0, '#5a5a6e'); gr.addColorStop(1, '#0a0a12');
    g.fillStyle = gr; g.strokeStyle = '#000'; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(-r * 0.4, -r * 0.4, r * 0.22, r * 0.12, -0.6, 0, TAU); g.fill();
    g.fillStyle = '#8a92a4'; g.beginPath(); g.roundRect(-6, -r - 6, 12, 8, 2); g.fill(); g.stroke();
    g.strokeStyle = '#d8c8a0'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -r - 6); g.quadraticCurveTo(8, -r - 16, 4, -r - 22); g.stroke();
    for (let i = 0; i < 6; i++) { const a = t * 20 + i * 1.05, l = 4 + (i % 3) * 3; g.strokeStyle = i % 2 ? '#ffe066' : '#ff8a3d'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(4, -r - 22); g.lineTo(4 + Math.cos(a) * l, -r - 22 + Math.sin(a) * l); g.stroke(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(4, -r - 22, 2.5, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,60,60,.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-7, -7); g.lineTo(7, 7); g.moveTo(7, -7); g.lineTo(-7, 7); g.stroke();
  }

  // dřevěné dojo: svislá prkna s letokruhy, suky a hřebíky, tmavé okraje
  function wood(W, H, seed = 1) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    let a = seed; const r = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    const pw = Math.max(70, W / 7);
    for (let x = 0, i = 0; x < W; x += pw, i++) {
      const base = ['#7a4a2a', '#6b3f22', '#865534', '#70442a'][i % 4], gr = g.createLinearGradient(x, 0, x + pw, 0);
      gr.addColorStop(0, base); gr.addColorStop(0.5, '#8f5c38'); gr.addColorStop(1, base);
      g.fillStyle = gr; g.fillRect(x, 0, pw, H);
      g.strokeStyle = 'rgba(40,20,8,.35)'; g.lineWidth = 1.2;
      for (let k = 0; k < 7; k++) { const gx = x + 6 + r() * (pw - 12); g.beginPath(); g.moveTo(gx, 0); for (let y = 0; y <= H; y += 40) g.lineTo(gx + Math.sin(y * 0.02 + k + i) * 4, y); g.stroke(); }
      for (let k = 0; k < 2; k++) { const kx = x + 12 + r() * (pw - 24), ky = r() * H; g.fillStyle = 'rgba(50,25,10,.5)'; g.beginPath(); g.ellipse(kx, ky, 6, 11, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(50,25,10,.4)'; g.beginPath(); g.ellipse(kx, ky, 10, 18, 0, 0, TAU); g.stroke(); }
      g.fillStyle = 'rgba(20,10,4,.75)'; g.fillRect(x, 0, 3, H);
      g.fillStyle = 'rgba(255,220,180,.08)'; g.fillRect(x + 3, 0, 2, H);
      for (const ny of [H * 0.12, H * 0.88]) { g.fillStyle = '#3a3a44'; g.beginPath(); g.arc(x + pw / 2, ny, 3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(x + pw / 2 - 1, ny - 1, 1, 0, TAU); g.fill(); }
    }
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,4,0,.6)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return c;
  }

  // stopa čepele: body { x, y, t }, now = čas; zužuje se do ztracena
  function blade(g, pts, now, life = 0.16) {
    const live = pts.filter(p => now - p.t < life);
    if (live.length < 2) return;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, col, blur] of [[14, 'rgba(120,220,255,.35)', 14], [7, 'rgba(200,245,255,.8)', 6], [3, '#ffffff', 0]]) {
      g.shadowColor = '#7ad8ff'; g.shadowBlur = blur; g.strokeStyle = col;
      for (let i = 1; i < live.length; i++) { const k = 1 - (now - live[i].t) / life; g.lineWidth = Math.max(0.5, w * k); g.beginPath(); g.moveTo(live[i - 1].x, live[i - 1].y); g.lineTo(live[i].x, live[i].y); g.stroke(); }
    }
    g.restore();
  }

  return { F, POWER, whole, half, bomb, wood, blade };
})();
