'use strict';
// ── VLAK · kresba ───────────────────────────────────────────────────────────
// Původní grafika hry Vlak 1.0 (Miroslav Němeček, 1993; autor ji dovoluje volně použít):
// sprites.png je autorův VLAK.PNG z github.com/Panda381/DOS-Progs (HRY/VLAK/V100/SOURCE),
// 320×200 bodů, sprity 16×16. Rozložení:
//   řádky 0–2 (y 0, 16, 32): 18 předmětů, tři fáze animace;
//   řádky 3–6 (y 48–96): vagóny s nákladem, směr vlevo, nahoru, vpravo, dolů;
//   y 160: mašinka 2× čtyři směry (fáze 1 a 2), pak 10 fází srážky a cihla (x 296);
//   y 176: mašinka fáze 3 (4 směry), od x 224 šest fází brány (zavřená → otevřená).
// Směr spritu: 0 vlevo, 1 nahoru, 2 vpravo, 3 dolů (jako LO1–LO4 v originále).
const VlArt = (() => {
  const S = 16;
  const sheet = typeof Image !== 'undefined' ? new Image() : null;
  const ready = new Promise(res => {
    if (!sheet) return;
    sheet.onload = () => res();
    sheet.src = new URL('sprites.png', document.currentScript ? document.currentScript.src : location.href).href;
  });
  const blit = (g, sx, sy, x, y, s) => { if (sheet && sheet.complete && sheet.naturalWidth) g.drawImage(sheet, sx, sy, S, S, x, y, s, s); };
  const item = (g, kind, frame, x, y, s) => blit(g, kind * S, (frame % 3) * S, x, y, s);
  const wagon = (g, kind, dir, x, y, s) => blit(g, kind * S, 48 + dir * S, x, y, s);
  const loco = (g, dir, phase, x, y, s) => blit(g, (phase === 1 ? 64 : 0) + dir * S, phase === 2 ? 176 : 160, x, y, s);
  const crash = (g, f, x, y, s) => blit(g, 128 + Math.min(9, f) * S, 160, x, y, s);
  const wall = (g, x, y, s) => blit(g, 296, 160, x, y, s);
  const gate = (g, f, x, y, s) => blit(g, 224 + Math.max(0, Math.min(5, f)) * S, 176, x, y, s);

  // podklad: černá plocha a cihly; cell(x, y) → [sloupec, řádek] na obrazovce (otočená scéna)
  function board(L, t, dpr, cell, cols, rows) {
    const c = document.createElement('canvas');
    c.width = Math.round(cols * t * dpr); c.height = Math.round(rows * t * dpr);
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.scale(dpr, dpr);
    g.fillStyle = '#000'; g.fillRect(0, 0, cols * t, rows * t);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      if (!L.wall[y * L.w + x] || (x === L.gate.x && y === L.gate.y)) continue;
      const [sx, sy] = cell(x, y);
      wall(g, sx * t, sy * t, t);
    }
    return c;
  }
  return { ready, item, wagon, loco, crash, wall, gate, board, S };
})();
