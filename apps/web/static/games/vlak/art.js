'use strict';
// ── VLAK · kresba ───────────────────────────────────────────────────────────
// Pohled shora: louka z dlaždic, kamenné zdi, brána (zavřená závora / otevřený portál), osm
// druhů předmětů a parní mašinka s vagóny, které vezou, co posbírala. Podklad úrovně (louka a
// zdi) se kreslí jednou do vlastního plátna.
const VlArt = (() => {
  const OL = '#1d2a1c';
  const hash = n => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

  // ── Podklad: louka a zdi ──
  function board(L, t, sc) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(L.w * t * sc); c.height = Math.ceil(L.h * t * sc);
    const g = c.getContext('2d'); g.scale(sc, sc);
    const isWall = (x, y) => x < 0 || y < 0 || x >= L.w || y >= L.h || L.wall[y * L.w + x];
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const px = x * t, py = y * t, h = hash(x * 131 + y * 17);
      if (!isWall(x, y)) {
        g.fillStyle = (x + y) % 2 ? '#86cf72' : '#7cc768'; g.fillRect(px, py, t, t);
        g.fillStyle = 'rgba(40,110,40,.35)';
        for (let k = 0; k < 3; k++) { const gx = px + hash(x * 7 + y * 13 + k) * (t - 4) + 2, gy = py + hash(x * 11 + y * 5 + k * 3) * (t - 5) + 3; g.fillRect(gx, gy, 1.2, 3); g.fillRect(gx + 2, gy + 1, 1.2, 2.5); }
        if (h > 0.93) { g.fillStyle = hash(x + y * 3) > 0.5 ? '#fff6a8' : '#ffd1e6'; g.beginPath(); g.arc(px + t * 0.3, py + t * 0.6, t * 0.06, 0, 7); g.fill(); }
      }
    }
    // stín zdí na louce
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (!isWall(x, y)) {
      const px = x * t, py = y * t;
      g.fillStyle = 'rgba(20,50,20,.22)';
      if (isWall(x, y - 1)) g.fillRect(px, py, t, t * 0.16);
      if (isWall(x - 1, y)) g.fillRect(px, py, t * 0.12, t);
    }
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (isWall(x, y)) wallTile(g, x * t, y * t, t, x, y, isWall);
    return c;
  }
  function wallTile(g, px, py, t, x, y, isWall) {
    const h = hash(x * 97 + y * 31);
    g.fillStyle = '#5d6a7c'; g.fillRect(px, py, t, t);
    // kameny: dvě řady s posunutými spárami
    const rows = 2, rh = t / rows;
    for (let i = 0; i < rows; i++) {
      const off = (i + y) % 2 ? t / 2 : 0;
      for (let j = -1; j < 2; j++) {
        const sx = px + off + j * (t / 1) * 1, sw = t;
        const x0 = Math.max(px, sx + 1), x1 = Math.min(px + t, sx + sw - 1);
        if (x1 <= x0) continue;
        const shade = 0.5 + hash(x * 13 + y * 7 + i * 3 + j) * 0.5;
        g.fillStyle = `rgb(${Math.round(120 + shade * 30)},${Math.round(132 + shade * 30)},${Math.round(150 + shade * 30)})`;
        g.fillRect(x0, py + i * rh + 1, x1 - x0, rh - 2);
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x0, py + i * rh + 1, x1 - x0, 1.5);
      }
    }
    // horní hrana světlejší, kde zeď sousedí s loukou, mech
    if (!isWall(x, y - 1)) { g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(px, py, t, 2); }
    if (!isWall(x, y + 1)) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(px, py + t - 3, t, 3); }
    if (h > 0.7) { g.fillStyle = 'rgba(90,160,70,.75)'; g.beginPath(); g.arc(px + t * (0.2 + h * 0.5), py + t * 0.15, t * 0.14, 0, Math.PI); g.fill(); }
  }

  // ── Brána ──
  function gate(g, x, y, t, open, clock) {
    const cx = x + t / 2, cy = y + t / 2;
    if (open) {
      const p = (Math.sin(clock * 4) + 1) / 2;
      const gr = g.createRadialGradient(cx, cy, 1, cx, cy, t * 0.7);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, `rgba(120,240,255,${0.9})`); gr.addColorStop(1, 'rgba(60,140,255,0)');
      g.fillStyle = gr; g.fillRect(x - t * 0.3, y - t * 0.3, t * 1.6, t * 1.6);
      g.strokeStyle = `rgba(255,255,255,${0.5 + p * 0.5})`; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, t * (0.28 + p * 0.12), 0, 7); g.stroke();
    }
    // kamenný rám
    g.fillStyle = '#7b6a5a'; rr(g, x + 1, y + 1, t - 2, t - 2, t * 0.18); g.fill();
    g.fillStyle = open ? '#1b2a4a' : '#3a2f28'; rr(g, x + t * 0.16, y + t * 0.16, t * 0.68, t * 0.68, t * 0.12); g.fill();
    if (open) {
      const gr = g.createRadialGradient(cx, cy, 1, cx, cy, t * 0.34);
      gr.addColorStop(0, '#e9ffff'); gr.addColorStop(0.5, '#5fe3ff'); gr.addColorStop(1, '#2b6bd6');
      g.fillStyle = gr; rr(g, x + t * 0.16, y + t * 0.16, t * 0.68, t * 0.68, t * 0.12); g.fill();
    } else { // závora s červenobílými pruhy
      g.save(); rr(g, x + t * 0.16, y + t * 0.16, t * 0.68, t * 0.68, t * 0.12); g.clip();
      for (let k = -2; k < 6; k++) { g.fillStyle = k % 2 ? '#f4f1ea' : '#e5463b'; g.beginPath(); g.moveTo(x + k * t * 0.18, y + t); g.lineTo(x + (k + 1) * t * 0.18, y + t); g.lineTo(x + (k + 1) * t * 0.18 + t, y); g.lineTo(x + k * t * 0.18 + t, y); g.fill(); }
      g.restore();
    }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; rr(g, x + 1, y + 1, t - 2, t - 2, t * 0.18); g.stroke();
  }

  // ── Předměty (střed cx, cy; velikost s ≈ šířka) ──
  function item(g, kind, cx, cy, s) {
    g.save(); g.translate(cx, cy);
    const u = s / 2;
    g.lineWidth = Math.max(1, s * 0.06); g.strokeStyle = OL; g.lineJoin = 'round';
    switch (kind) {
      case 'jablko': {
        const gr = g.createRadialGradient(-u * 0.3, -u * 0.2, 1, 0, u * 0.1, u);
        gr.addColorStop(0, '#ff8a7a'); gr.addColorStop(1, '#d42a2a');
        g.fillStyle = gr; g.beginPath(); g.arc(-u * 0.32, u * 0.1, u * 0.62, 0, 7); g.arc(u * 0.32, u * 0.1, u * 0.62, 0, 7); g.fill(); g.stroke();
        g.strokeStyle = '#6b3b1c'; g.beginPath(); g.moveTo(0, -u * 0.4); g.lineTo(u * 0.08, -u * 0.85); g.stroke();
        g.fillStyle = '#4caf50'; g.beginPath(); g.ellipse(u * 0.3, -u * 0.72, u * 0.28, u * 0.13, -0.5, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-u * 0.45, -u * 0.12, u * 0.14, 0, 7); g.fill();
        break;
      }
      case 'diamant': {
        g.fillStyle = '#7fe8ff'; g.beginPath(); g.moveTo(-u * 0.85, -u * 0.25); g.lineTo(-u * 0.45, -u * 0.7); g.lineTo(u * 0.45, -u * 0.7); g.lineTo(u * 0.85, -u * 0.25); g.lineTo(0, u * 0.85); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#c9f7ff'; g.beginPath(); g.moveTo(-u * 0.45, -u * 0.7); g.lineTo(0, -u * 0.25); g.lineTo(u * 0.45, -u * 0.7); g.fill();
        g.fillStyle = '#35b8e8'; g.beginPath(); g.moveTo(0, -u * 0.25); g.lineTo(u * 0.85, -u * 0.25); g.lineTo(0, u * 0.85); g.fill();
        g.beginPath(); g.moveTo(-u * 0.85, -u * 0.25); g.lineTo(u * 0.85, -u * 0.25); g.stroke();
        break;
      }
      case 'koruna': {
        g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(-u * 0.85, u * 0.55); g.lineTo(-u * 0.85, -u * 0.45); g.lineTo(-u * 0.4, 0); g.lineTo(0, -u * 0.7); g.lineTo(u * 0.4, 0); g.lineTo(u * 0.85, -u * 0.45); g.lineTo(u * 0.85, u * 0.55); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#e8453c'; g.beginPath(); g.arc(0, u * 0.22, u * 0.15, 0, 7); g.fill();
        g.fillStyle = '#3fa7ff'; g.beginPath(); g.arc(-u * 0.5, u * 0.25, u * 0.11, 0, 7); g.arc(u * 0.5, u * 0.25, u * 0.11, 0, 7); g.fill();
        break;
      }
      case 'strom': {
        g.fillStyle = '#7a4b2a'; g.fillRect(-u * 0.12, u * 0.2, u * 0.24, u * 0.65); g.strokeRect(-u * 0.12, u * 0.2, u * 0.24, u * 0.65);
        g.fillStyle = '#3c9a46'; g.beginPath(); g.arc(-u * 0.35, u * 0.05, u * 0.45, 0, 7); g.arc(u * 0.35, u * 0.05, u * 0.45, 0, 7); g.arc(0, -u * 0.4, u * 0.5, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#5cc265'; g.beginPath(); g.arc(-u * 0.15, -u * 0.5, u * 0.2, 0, 7); g.fill();
        g.fillStyle = '#e8453c'; g.beginPath(); g.arc(u * 0.3, -u * 0.1, u * 0.09, 0, 7); g.arc(-u * 0.4, 0, u * 0.09, 0, 7); g.fill();
        break;
      }
      case 'dort': {
        g.fillStyle = '#f7d9b0'; rr(g, -u * 0.8, -u * 0.1, u * 1.6, u * 0.85, u * 0.12); g.fill(); g.stroke();
        g.fillStyle = '#ff8fb8'; g.beginPath(); g.moveTo(-u * 0.8, -u * 0.1); for (let k = 0; k <= 8; k++) g.lineTo(-u * 0.8 + k * u * 0.2, k % 2 ? u * 0.2 : -u * 0.1); g.lineTo(u * 0.8, -u * 0.3); g.lineTo(-u * 0.8, -u * 0.3); g.closePath(); g.fill();
        g.fillStyle = '#d42a3a'; g.beginPath(); g.arc(0, -u * 0.48, u * 0.18, 0, 7); g.fill(); g.stroke();
        break;
      }
      case 'darek': {
        g.fillStyle = '#7d5cf0'; rr(g, -u * 0.75, -u * 0.45, u * 1.5, u * 1.25, u * 0.1); g.fill(); g.stroke();
        g.fillStyle = '#ffd23f'; g.fillRect(-u * 0.12, -u * 0.45, u * 0.24, u * 1.25); g.fillRect(-u * 0.75, u * 0.05, u * 1.5, u * 0.22);
        g.beginPath(); g.ellipse(-u * 0.3, -u * 0.6, u * 0.3, u * 0.16, 0.4, 0, 7); g.ellipse(u * 0.3, -u * 0.6, u * 0.3, u * 0.16, -0.4, 0, 7); g.fill(); g.stroke();
        break;
      }
      case 'hvezda': {
        g.fillStyle = '#ffd23f'; g.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr2 = k % 2 ? u * 0.42 : u * 0.9; g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
        g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-u * 0.15, -u * 0.2, u * 0.13, 0, 7); g.fill();
        break;
      }
      default: { // houba
        g.fillStyle = '#f4ead8'; rr(g, -u * 0.25, -u * 0.05, u * 0.5, u * 0.85, u * 0.15); g.fill(); g.stroke();
        g.fillStyle = '#e5463b'; g.beginPath(); g.ellipse(0, -u * 0.15, u * 0.85, u * 0.6, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(-u * 0.35, -u * 0.4, u * 0.13, 0, 7); g.arc(u * 0.25, -u * 0.5, u * 0.11, 0, 7); g.arc(u * 0.5, -u * 0.25, u * 0.09, 0, 7); g.fill();
      }
    }
    g.restore();
  }

  // ── Vlak ── (pohled shora, směr jízdy ang, střed cx, cy, dlaždice t)
  function loco(g, cx, cy, ang, t, clock) {
    g.save(); g.translate(cx, cy); g.rotate(ang);
    const L = t * 0.46, Wd = t * 0.36;
    g.fillStyle = 'rgba(0,0,0,.25)'; rr(g, -L + 2, -Wd + 3, L * 2, Wd * 2, Wd * 0.5); g.fill();
    // kola
    g.fillStyle = '#2b2b33';
    for (const k of [-0.6, 0, 0.55]) { g.fillRect(L * k - t * 0.09, -Wd - t * 0.05, t * 0.18, t * 0.07); g.fillRect(L * k - t * 0.09, Wd - t * 0.02, t * 0.18, t * 0.07); }
    // podvozek, kotel, budka
    g.fillStyle = '#2f3540'; rr(g, -L, -Wd, L * 2, Wd * 2, t * 0.08); g.fill();
    const bg = g.createLinearGradient(0, -Wd, 0, Wd); bg.addColorStop(0, '#e86a4a'); bg.addColorStop(0.5, '#c8382a'); bg.addColorStop(1, '#8e2219');
    g.fillStyle = bg; rr(g, -L * 0.15, -Wd * 0.72, L * 1.05, Wd * 1.44, Wd * 0.7); g.fill();
    g.fillStyle = '#ffd23f'; for (const k of [0.15, 0.45]) g.fillRect(L * k, -Wd * 0.72, t * 0.035, Wd * 1.44);
    g.fillStyle = '#1f6f4a'; rr(g, -L * 0.98, -Wd * 0.92, L * 0.82, Wd * 1.84, t * 0.06); g.fill();
    g.fillStyle = '#2e9a66'; rr(g, -L * 0.9, -Wd * 0.8, L * 0.66, Wd * 1.6, t * 0.05); g.fill();
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-L * 0.9, -Wd * 0.8, L * 0.66, Wd * 0.25);
    // komín a zvon
    g.fillStyle = '#22252c'; g.beginPath(); g.arc(L * 0.62, 0, t * 0.1, 0, 7); g.fill();
    g.fillStyle = '#555c6a'; g.beginPath(); g.arc(L * 0.62, 0, t * 0.06, 0, 7); g.fill();
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(L * 0.3, 0, t * 0.055, 0, 7); g.fill();
    // pluh vpředu a lampa
    g.fillStyle = '#c8c8c8'; g.beginPath(); g.moveTo(L, -Wd * 0.85); g.lineTo(L + t * 0.08, 0); g.lineTo(L, Wd * 0.85); g.fill();
    g.fillStyle = '#fff3a8'; g.beginPath(); g.arc(L * 0.9, 0, t * 0.045, 0, 7); g.fill();
    g.restore();
    void clock;
  }
  function wagon(g, cx, cy, ang, t, kind) {
    g.save(); g.translate(cx, cy); g.rotate(ang);
    const L = t * 0.42, Wd = t * 0.34;
    g.fillStyle = 'rgba(0,0,0,.22)'; rr(g, -L + 2, -Wd + 3, L * 2, Wd * 2, t * 0.08); g.fill();
    g.fillStyle = '#2b2b33';
    for (const k of [-0.55, 0.55]) { g.fillRect(L * k - t * 0.09, -Wd - t * 0.05, t * 0.18, t * 0.07); g.fillRect(L * k - t * 0.09, Wd - t * 0.02, t * 0.18, t * 0.07); }
    g.fillStyle = '#8a5a34'; rr(g, -L, -Wd, L * 2, Wd * 2, t * 0.08); g.fill();
    g.fillStyle = '#a8703f'; for (let k = 0; k < 4; k++) g.fillRect(-L + 2, -Wd + 2 + k * (Wd * 2 - 4) / 4, L * 2 - 4, (Wd * 2 - 4) / 4 - 1.2);
    g.strokeStyle = '#5a3a20'; g.lineWidth = 1.5; rr(g, -L, -Wd, L * 2, Wd * 2, t * 0.08); g.stroke();
    g.restore();
    if (kind) item(g, kind, cx, cy - t * 0.04, t * 0.56);
  }
  function smoke(g, p) {
    g.fillStyle = `rgba(240,240,245,${Math.max(0, p.life) * 0.6})`;
    g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
  }
  return { board, gate, item, loco, wagon, smoke, OL };
})();
