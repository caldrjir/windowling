'use strict';
// ── MRAKODRAP · kresba ──────────────────────────────────────────────────────
// Patra domu (fasáda, okna, balkony), jeřáb s lanem, nebe podle výšky (den, západ, noc,
// vesmír) a město v dálce. Nebe se předkreslí, ve hře se jen kopíruje.
const MdArt = (() => {
  const OL = '#24171a';
  // barvy fasády po deseti patrech: [stěna, světlejší pruh, střecha/římsa]
  const FACADES = [
    ['#e8734a', '#f39a73', '#9c3f22'], ['#4fa3d9', '#7cc0ea', '#24618c'], ['#f2c14e', '#f8d987', '#a77a17'],
    ['#7bc86c', '#a3dc96', '#3f7f33'], ['#c86fd0', '#dc9ce2', '#7c3484'], ['#ef5d6c', '#f58c97', '#9c2533'],
    ['#55c2b5', '#88d8ce', '#23766c'], ['#f0915a', '#f6b48a', '#a3501f'],
  ];
  const facade = i => FACADES[Math.floor(i / 10) % FACADES.length];
  // nebe podle výšky: 0 den, 1 západ, 2 noc, 3 vesmír (plynule)
  const SKIES = [
    ['#5cb8f2', '#bfe8ff'], ['#ff9a6b', '#ffd59a'], ['#1d2a5c', '#4a3f7a'], ['#05040f', '#151034'],
  ];
  const mix = (a, b, t) => { const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
  function sky(g, W, H, h) {
    const k = Math.min(SKIES.length - 1.001, h), i = Math.floor(k), t = k - i;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, mix(SKIES[i][0], SKIES[i + 1][0], t)); gr.addColorStop(1, mix(SKIES[i][1], SKIES[i + 1][1], t));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  // hvězdy (v noci a ve vesmíru), mraky (ve dne)
  function stars(g, W, H, a, off) {
    if (a <= 0) return;
    g.fillStyle = `rgba(255,255,255,${a})`;
    for (let i = 0; i < 70; i++) { const x = (i * 97.3) % W, y = ((i * 57.7 + off * 0.2) % (H + 40)) - 20; g.fillRect(x, y, i % 5 ? 1.5 : 2.5, i % 5 ? 1.5 : 2.5); }
  }
  function cloud(g, x, y, s, a) {
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.beginPath(); g.arc(x, y, 18 * s, 0, 7); g.arc(x + 20 * s, y - 8 * s, 22 * s, 0, 7); g.arc(x + 44 * s, y, 17 * s, 0, 7); g.rect(x, y, 44 * s, 14 * s); g.fill();
  }
  // město v dálce a zem
  function city(g, W, y, night) {
    g.fillStyle = night ? '#2b2752' : '#8fb7cc';
    for (let i = -14; i < 28; i++) { const j = (i + 28) % 14, w = 22 + ((j * 37) % 19), h = 40 + ((j * 53) % 70), x = i * 27 - 8; g.fillRect(x, y - h, w, h); }
    if (night) { g.fillStyle = '#ffe08a'; for (let i = 0; i < 120; i++) g.fillRect(((i * 41) % (W * 3)) - W, y - 10 - ((i * 23) % 90), 2, 3); }
  }
  function ground(g, W, y, H) {
    g.fillStyle = '#6cbf4a'; g.fillRect(-W, y, W * 3, 10);
    g.fillStyle = '#8a8f98'; g.fillRect(-W, y + 10, W * 3, H);
    g.fillStyle = '#7a7f88'; for (let x = -W; x < W * 2; x += 24) g.fillRect(x, y + 16, 12, 3);
  }

  // jedno patro: x je střed, y spodní hrana; i číslo patra; lit = rozsvícená okna
  function floor(g, x, y, w, h, i, lit, ang = 0) {
    const [wall, light, dark] = facade(i), x0 = -w / 2;
    g.save(); g.translate(x, y); if (ang) g.rotate(ang);
    g.fillStyle = wall; g.fillRect(x0, -h, w, h);
    g.fillStyle = light; g.fillRect(x0, -h, w, 5);
    g.fillStyle = dark; g.fillRect(x0 - 3, -h, w + 6, 4); g.fillRect(x0, -3, w, 3);
    // okna
    const n = Math.max(2, Math.round(w / 30)), ww = (w - 12) / n;
    for (let k = 0; k < n; k++) {
      const wx = x0 + 6 + k * ww + 3, wy = -h + 11, wwid = ww - 6, wh = h - 22;
      if (i === 0 && k === Math.floor(n / 2)) { g.fillStyle = '#5a3b2a'; g.fillRect(wx + 2, -h + 9, wwid - 4, h - 12); g.fillStyle = '#e8c35a'; g.fillRect(wx + wwid - 9, -h / 2, 3, 3); continue; }
      g.fillStyle = lit && ((i * 7 + k * 3) % 5) ? '#ffe28a' : '#bfe4f7';
      g.fillRect(wx, wy, wwid, wh);
      g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(wx + 2, wy + 2, wwid * 0.35, wh - 4);
      g.fillStyle = dark; g.fillRect(wx + wwid / 2 - 1, wy, 2, wh);
      if ((i + k) % 3 === 0 && i > 0) { g.fillStyle = dark; g.fillRect(wx - 2, wy + wh - 2, wwid + 4, 4); }
    }
    g.strokeStyle = OL; g.lineWidth = 2; g.strokeRect(x0, -h, w, h);
    g.restore();
  }
  // střecha nad nejvyšším patrem
  function roof(g, x, y, w, i) {
    const [, , dark] = facade(i);
    g.fillStyle = dark; g.fillRect(x - w / 2 + 6, y - 8, w - 12, 8);
    g.strokeStyle = OL; g.lineWidth = 2; g.strokeRect(x - w / 2 + 6, y - 8, w - 12, 8);
    g.fillStyle = '#d93c3c'; g.fillRect(x + w / 4 - 2, y - 22, 3, 14); g.beginPath(); g.arc(x + w / 4 - 0.5, y - 23, 3, 0, 7); g.fill();
  }
  // jeřáb: rameno nahoře, kočka a lano k háku
  function crane(g, W, px, py, hx, hy) {
    g.strokeStyle = '#f2b632'; g.lineWidth = 6; g.beginPath(); g.moveTo(-10, py - 14); g.lineTo(W + 10, py - 14); g.stroke();
    g.strokeStyle = '#c98d14'; g.lineWidth = 1.5;
    for (let x = 0; x < W; x += 18) { g.beginPath(); g.moveTo(x, py - 17); g.lineTo(x + 9, py - 11); g.lineTo(x + 18, py - 17); g.stroke(); }
    g.fillStyle = '#3d3f46'; g.fillRect(px - 14, py - 12, 28, 12);
    g.strokeStyle = '#2e2f35'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = '#3d3f46'; g.beginPath(); g.arc(hx, hy, 5, 0, 7); g.fill();
  }
  return { OL, facade, sky, stars, cloud, city, ground, floor, roof, crane };
})();
