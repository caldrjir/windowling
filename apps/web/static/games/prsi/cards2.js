'use strict';
// ── PRŠÍ · karty z ilustrací (rozpracované, zatím nezapojené do hry) ─────────
// Karta se složí na plátně z vrstev: obrázek pozadí přes celou kartu, velký znak barvy
// uprostřed, rámeček barvy a rohové indexy (hodnota + malý znak barvy). Výsledek se uloží
// jako obrázek (data URL), hra pak pracuje s obyčejnými <img>. Návrhové souřadnice jsou
// v rozměru 1024 × 1536 (rozměr ilustrací), kreslí se zmenšeně.
const PrsiCards2 = (() => {
  const DW = 1024, DH = 1536, BASE = '/games/prsi/img/';
  // rámeček se roztáhne až k okraji karty: jeho zlatý obrys (v obrázku x 34–989, y 51–1473)
  // padne na okraj karty, pozadí se ořízne podle něj
  const EDGE = 8, FX = [34, 989], FY = [51, 1473];
  const SX = (DW - 2 * EDGE) / (FX[1] - FX[0]), SY = (DH - 2 * EDGE) / (FY[1] - FY[0]);
  const RANKS_CS = ['7', '8', '9', '10', 'Sp', 'Sv', 'K', 'E'], RANKS_EN = ['7', '8', '9', '10', 'U', 'O', 'K', 'A'];
  const INK = ['#8e1520', '#1d5e2b', '#6b4012', '#9a4a0c'];
  const img = {};
  const load = name => new Promise(res => { const i = new Image(); i.onload = () => { img[name] = i; res(i); }; i.onerror = () => res(null); i.src = BASE + name + '.webp'; });
  // načte všechny vrstvy, které existují (chybějící se přeskočí)
  function ready() {
    const names = [];
    for (let su = 0; su < 4; su++) { names.push(`suit-${su}`, `emblem-${su}`, `frame-${su}`); for (let rk = 0; rk < 8; rk++) names.push(`bg-${su}-${rk}`); }
    return Promise.all(names.map(load));
  }
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const contain = (ctx, im, cx, cy, w) => { if (!im) return; const h = w * im.height / im.width; ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h); };

  function draw(c, width, en) {
    const su = c >> 3, rk = c & 7, k = width / DW;
    const cv = document.createElement('canvas'); cv.width = width; cv.height = Math.round(DH * k);
    const ctx = cv.getContext('2d'); ctx.scale(k, k); ctx.imageSmoothingQuality = 'high';
    rr(ctx, EDGE, EDGE, DW - 2 * EDGE, DH - 2 * EDGE, 92); ctx.save(); ctx.clip();
    const bg = img[`bg-${su}-${rk}`];
    if (bg) ctx.drawImage(bg, 0, 0, DW, DH);
    else { const g = ctx.createLinearGradient(0, 0, 0, DH); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#efe3c8'); ctx.fillStyle = g; ctx.fillRect(0, 0, DW, DH); }
    // jemné ztmavení okrajů, ať rámeček a znak vyniknou
    const v = ctx.createRadialGradient(DW / 2, DH / 2, DW * 0.35, DW / 2, DH / 2, DH * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,6,0,.35)'); ctx.fillStyle = v; ctx.fillRect(0, 0, DW, DH);
    // velký znak barvy uprostřed
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
    contain(ctx, img[`emblem-${su}`] || img[`suit-${su}`], DW / 2, DH * 0.5, 560);
    ctx.restore();
    ctx.restore();
    // rámeček
    if (img[`frame-${su}`]) ctx.drawImage(img[`frame-${su}`], EDGE - FX[0] * SX, EDGE - FY[0] * SY, DW * SX, DH * SY);
    // rohové indexy: hodnota a malý znak na pergamenovém štítku
    const R = (en ? RANKS_EN : RANKS_CS)[rk];
    const index = () => {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
      rr(ctx, 100, 214, 184, 256, 40); ctx.fillStyle = 'rgba(255,248,232,.95)'; ctx.fill(); ctx.restore();
      rr(ctx, 100, 214, 184, 256, 40); ctx.lineWidth = 8; ctx.strokeStyle = '#c9a23a'; ctx.stroke();
      ctx.fillStyle = INK[su]; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${R.length > 1 ? 120 : 164}px Georgia, 'Times New Roman', serif`;
      ctx.fillText(R, 192, R.length > 1 ? 352 : 368);
      contain(ctx, img[`suit-${su}`], 192, 420, 88);
    };
    index();
    ctx.save(); ctx.translate(DW, DH); ctx.rotate(Math.PI); index(); ctx.restore();
    return cv;
  }
  const cache = {};
  const src = (c, en, width = 360) => { const key = `${c}:${en ? 'e' : 'c'}:${width}`; return cache[key] || (cache[key] = draw(c, width, en).toDataURL('image/webp', 0.9)); };
  return { ready, draw, src, RANKS_CS, RANKS_EN };
})();
