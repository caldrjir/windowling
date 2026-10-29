'use strict';
// ── PRŠÍ · karty z ilustrací (rozpracované, zatím nezapojené do hry) ─────────
// Karta se složí na plátně z vrstev: obrázek pozadí přes celou kartu, velký znak barvy
// uprostřed, rámeček barvy a rohové indexy (hodnota + malý znak barvy). Výsledek se uloží
// jako obrázek (data URL), hra pak pracuje s obyčejnými <img>. Návrhové souřadnice jsou
// v rozměru 1024 × 1536 (rozměr ilustrací), kreslí se zmenšeně.
const PrsiCards2 = (() => {
  const DW = 1024, DH = 1536, BASE = '/games/prsi/img/';
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
    rr(ctx, 6, 6, DW - 12, DH - 12, 70); ctx.save(); ctx.clip();
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
    if (img[`frame-${su}`]) ctx.drawImage(img[`frame-${su}`], 0, 0, DW, DH);
    // rohové indexy: hodnota a malý znak na pergamenovém štítku
    const R = (en ? RANKS_EN : RANKS_CS)[rk];
    const index = () => {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
      rr(ctx, 110, 226, 184, 256, 40); ctx.fillStyle = 'rgba(255,248,232,.95)'; ctx.fill(); ctx.restore();
      rr(ctx, 110, 226, 184, 256, 40); ctx.lineWidth = 8; ctx.strokeStyle = '#c9a23a'; ctx.stroke();
      ctx.fillStyle = INK[su]; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${R.length > 1 ? 120 : 164}px Georgia, 'Times New Roman', serif`;
      ctx.fillText(R, 202, R.length > 1 ? 364 : 380);
      contain(ctx, img[`suit-${su}`], 202, 432, 88);
    };
    index();
    ctx.save(); ctx.translate(DW, DH); ctx.rotate(Math.PI); index(); ctx.restore();
    return cv;
  }
  const cache = {};
  const src = (c, en, width = 360) => { const key = `${c}:${en ? 'e' : 'c'}:${width}`; return cache[key] || (cache[key] = draw(c, width, en).toDataURL('image/webp', 0.9)); };
  return { ready, draw, src, RANKS_CS, RANKS_EN };
})();
