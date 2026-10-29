'use strict';
// ── PRŠÍ · karty z ilustrací (rozpracované, zatím nezapojené do hry) ─────────
// Karta se složí na plátně z vrstev: obrázek pozadí, znaky barvy (rozložené podle hodnoty jako
// na mariáškách, bez čísel) nebo velký znak uprostřed a navrch rámeček barvy. Výsledek se uloží
// jako obrázek (data URL), hra pak pracuje s obyčejnými <img>. Návrhové souřadnice jsou
// v rozměru 1024 × 1536 (rozměr ilustrací), kreslí se zmenšeně.
const PrsiCards2 = (() => {
  const DW = 1024, DH = 1536, BASE = '/games/prsi/img/';
  // tvar karty dává rámeček: pozadí jen uvnitř jeho zlatého obrysu (x 34–989, y 51–1473),
  // ozdoby, které z něj vyčnívají, zůstávají celé (karta tak nemusí být přesný obdélník)
  const FX = [34, 989], FY = [51, 1473], FR = 88;
  const RANKS_CS = ['7', '8', '9', '10', 'Sp', 'Sv', 'K', 'E'], RANKS_EN = ['7', '8', '9', '10', 'U', 'O', 'K', 'A'];
  const INK = ['#8e1520', '#1d5e2b', '#6b4012', '#9a4a0c'];
  const img = {};
  const load = name => new Promise(res => { const i = new Image(); i.onload = () => { img[name] = i; res(i); }; i.onerror = () => res(null); i.src = BASE + name + '.webp'; });
  // římské číslice píše Cinzel (SIL Open Font License), přibalený jen se znaky I, V a X
  const FONT = 'PrsiRoman, Cinzel, Georgia, serif';
  const loadFont = () => typeof FontFace === 'function'
    ? new FontFace('PrsiRoman', `url(${BASE}cinzel-ivx.woff2)`, { weight: '700' }).load().then(f => { document.fonts.add(f); }, () => {})
    : null;
  // načte všechny vrstvy, které existují (chybějící se přeskočí), a písmo číslic
  function ready() {
    const names = [];
    for (let su = 0; su < 4; su++) { names.push(`suit-${su}`, `emblem-${su}`, `frame-${su}`); for (let rk = 0; rk < 8; rk++) names.push(`bg-${su}-${rk}`); }
    return Promise.all([...names.map(load), loadFont()]);
  }
  // rozložení znaků na číselných kartách jako na jednohlavých mariáškách: znaky v horních
  // třech čtvrtinách s mezerami mezi sebou, dole zůstává vidět obrázek; hodnotu ukazují
  // římské číslice v obou horních rozích
  const ROMAN = ['VII', 'VIII', 'IX', 'X'];
  const PIPS = {
    0: [[512, 330], [272, 540], [752, 540], [272, 810], [752, 810], [272, 1080], [752, 1080]],
    1: [[272, 380], [752, 380], [272, 650], [752, 650], [272, 920], [752, 920], [272, 1190], [752, 1190]],
    2: [[252, 470], [252, 740], [252, 1010], [512, 340], [512, 610], [512, 880], [772, 470], [772, 740], [772, 1010]],
    3: [[252, 470], [252, 740], [252, 1010], [512, 340], [512, 610], [512, 880], [512, 1150], [772, 470], [772, 740], [772, 1010]],
  };
  const PIP_W = 205;
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  // vystouplý vzhled: uvnitř tvaru světlá hrana vlevo nahoře a tmavá vpravo dole (vnitřní stín).
  // Stín vrhá negativ tvaru posunutý mimo plátno, takže se kreslí jen stín; vše v pixelech
  // (stín plátna nezná ctx.scale), proto se počítá pro každou velikost zvlášť a pamatuje si.
  const raised = {};
  function emboss(name, im, w, h, depth) {
    if (!im) return null;
    const key = `${name}:${w}x${h}`;
    if (raised[key]) return raised[key];
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, 0, 0, w, h);
    const p = Math.ceil(depth * 4) + 2, m = document.createElement('canvas'); m.width = w + 2 * p; m.height = h + 2 * p;
    const mc = m.getContext('2d'); mc.fillRect(0, 0, m.width, m.height); mc.globalCompositeOperation = 'destination-out'; mc.drawImage(im, p, p, w, h);
    ctx.globalCompositeOperation = 'source-atop'; ctx.shadowBlur = depth * 1.6;
    for (const [color, d] of [['rgba(45,10,0,.7)', -depth], ['rgba(255,243,212,.6)', depth]]) {
      ctx.shadowColor = color; ctx.shadowOffsetX = 1e4 + d; ctx.shadowOffsetY = d;
      ctx.drawImage(m, -p - 1e4, -p);
    }
    return (raised[key] = cv);
  }
  // znak barvy vystouplý nad pozadím: vnitřní stín a stín vržený na pozadí
  function pip(ctx, k, name, cx, cy, w, depth) {
    const im = img[name];
    if (!im) return;
    const h = w * im.height / im.width, e = emboss(name, im, Math.round(w * k), Math.round(h * k), depth * k);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 22 * k; ctx.shadowOffsetX = 4 * k; ctx.shadowOffsetY = 10 * k;
    ctx.drawImage(e, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }
  // zlatá římská číslice s tmavým obrysem, vystouplá jako znaky; x je levý (nebo pravý) okraj, y účaří
  function numeral(ctx, k, text, x, y, right) {
    const s = 112 * k, line = 7 * k, c = document.createElement('canvas'), t = c.getContext('2d');
    t.font = `700 ${s}px ${FONT}`;
    const m = t.measureText(text), pad = Math.ceil(line + 2), asc = m.actualBoundingBoxAscent;
    c.width = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + 2 * pad; c.height = Math.ceil(asc + m.actualBoundingBoxDescent) + 2 * pad;
    t.font = `700 ${s}px ${FONT}`; t.lineJoin = 'round';
    const bx = pad + m.actualBoundingBoxLeft, by = pad + asc, g = t.createLinearGradient(0, pad, 0, by);
    g.addColorStop(0, '#fff6cf'); g.addColorStop(0.45, '#f1c95a'); g.addColorStop(1, '#a8701c');
    t.lineWidth = line; t.strokeStyle = '#3a1c06'; t.strokeText(text, bx, by);
    t.fillStyle = g; t.fillText(text, bx, by);
    const e = emboss(`roman-${text}`, c, c.width, c.height, 4 * k), w = c.width / k, h = c.height / k;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 14 * k; ctx.shadowOffsetX = 3 * k; ctx.shadowOffsetY = 7 * k;
    ctx.drawImage(e, right ? x - w + pad / k : x - pad / k, y - by / k, w, h);
    ctx.restore();
  }

  function draw(c, width, en) {
    const su = c >> 3, rk = c & 7, k = width / DW;
    const cv = document.createElement('canvas'); cv.width = width; cv.height = Math.round(DH * k);
    const ctx = cv.getContext('2d'); ctx.scale(k, k); ctx.imageSmoothingQuality = 'high';
    rr(ctx, FX[0], FY[0], FX[1] - FX[0], FY[1] - FY[0], FR); ctx.save(); ctx.clip();
    const bg = img[`bg-${su}-${rk}`];
    if (bg) ctx.drawImage(bg, 0, 0, DW, DH);
    else { const g = ctx.createLinearGradient(0, 0, 0, DH); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#efe3c8'); ctx.fillStyle = g; ctx.fillRect(0, 0, DW, DH); }
    // jemné ztmavení okrajů, ať rámeček a znak vyniknou
    const v = ctx.createRadialGradient(DW / 2, DH / 2, DW * 0.35, DW / 2, DH / 2, DH * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,6,0,.35)'); ctx.fillStyle = v; ctx.fillRect(0, 0, DW, DH);
    const sign = img[`emblem-${su}`] ? `emblem-${su}` : `suit-${su}`;
    // číselná karta: znaky barvy (srdce s elfkou) v rozložení podle hodnoty, jinak velký znak uprostřed
    if (PIPS[rk]) for (const [x, y] of PIPS[rk]) pip(ctx, k, sign, x, y, PIP_W, 7);
    else pip(ctx, k, sign, DW / 2, DH * 0.5, 560, 12);
    // stín rámečku padá jen dovnitř karty (venku je průhledno)
    const fr = emboss(`frame-${su}`, img[`frame-${su}`], cv.width, cv.height, 6 * k);
    if (fr) {
      ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 20 * k; ctx.shadowOffsetX = 1e4 + 3 * k; ctx.shadowOffsetY = 8 * k;
      ctx.drawImage(fr, -1e4 / k, 0, DW, DH);
    }
    ctx.restore();
    // rámeček celý, i s ozdobami, které z karty vyčnívají
    if (fr) ctx.drawImage(fr, 0, 0, DW, DH);
    // římské číslice v horních rozích, vedle ozdob rámečku
    if (ROMAN[rk]) { numeral(ctx, k, ROMAN[rk], 215, 240, false); numeral(ctx, k, ROMAN[rk], DW - 215, 240, true); }
    return cv;
  }
  const cache = {};
  const src = (c, en, width = 360) => { const key = `${c}:${en ? 'e' : 'c'}:${width}`; return cache[key] || (cache[key] = draw(c, width, en).toDataURL('image/webp', 0.9)); };
  return { ready, draw, src, RANKS_CS, RANKS_EN };
})();
