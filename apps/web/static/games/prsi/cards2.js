'use strict';
// ── PRŠÍ · karty z ilustrací (rozpracované, zatím nezapojené do hry) ─────────
// Karta se složí na plátně z vrstev: obrázek pozadí, znaky barvy (rozložené podle hodnoty jako
// na mariáškách, bez čísel) nebo velký znak uprostřed a navrch rámeček barvy. Výsledek se uloží
// jako obrázek (data URL), hra pak pracuje s obyčejnými <img>. Návrhové souřadnice jsou
// v rozměru 1024 × 1536 (rozměr ilustrací), kreslí se zmenšeně.
const PrsiCards2 = (() => {
  const DW = 1024, DH = 1536, BASE = '/games/prsi/img/';
  // tvar karty dává rámeček barvy: pozadí jen uvnitř jeho obrysu [x0, y0, x1, y1, zaoblení]
  // (srdce: zlatý obrys, listy a kule: středy lišt a trámů), ozdoby, které z něj vyčnívají,
  // zůstávají celé (karta tak nemusí být přesný obdélník)
  const CLIP = { 0: [34, 51, 989, 1473, 88], 1: [105, 225, 920, 1400, 10], 3: [75, 150, 950, 1390, 10] };
  // rámeček zvětšený kolem středu karty (víc místa uvnitř, nejkrajnější špičky ozdob se ořežou);
  // ořez pozadí i místo v rozích se zvětší s ním
  const FRAME_S = { 3: 1 };
  const RANKS_CS = ['7', '8', '9', '10', 'Sp', 'Sv', 'K', 'E'], RANKS_EN = ['7', '8', '9', '10', 'U', 'O', 'K', 'A'];
  const INK = ['#8e1520', '#1d5e2b', '#6b4012', '#9a4a0c'];
  const img = {};
  const load = name => new Promise(res => { const i = new Image(); i.onload = () => { img[name] = i; res(i); }; i.onerror = () => res(null); i.src = BASE + name + '.webp'; });
  // římské číslice a písmena figur píše Cinzel (SIL Open Font License), přibalený jen se znaky I, V, X, K a A
  const FONT = 'PrsiRoman, Cinzel, Georgia, serif';
  const loadFont = () => typeof FontFace === 'function'
    ? new FontFace('PrsiRoman', `url(${BASE}cinzel-caps.woff2)`, { weight: '700' }).load().then(f => { document.fonts.add(f); }, () => {})
    : null;
  // načte všechny vrstvy, které existují (chybějící se přeskočí), a písmo číslic
  function ready() {
    const names = [];
    for (let su = 0; su < 4; su++) { names.push(`suit-${su}`, `emblem-${su}`, `frame-${su}`); for (let rk = 0; rk < 8; rk++) names.push(`bg-${su}-${rk}`); }
    return Promise.all([...names.map(load), loadFont()]);
  }
  // rozložení znaků na číselných kartách jako na jednohlavých mariáškách: znaky v horních
  // třech čtvrtinách s mezerami mezi sebou, dole zůstává vidět obrázek; hodnotu ukazují
  // římské číslice v obou horních rozích. Každá barva má rozložení podle vnitřku svého rámečku
  // (listy: nahoře a dole ozdoba s rytířem, kule: nahoře hlava orka a praporce, dole hrot, proto
  // menší znaky); w je šířka znaku.
  const ROMAN = ['VII', 'VIII', 'IX', 'X'];
  const PIPS = {
    0: {
      w: 205,
      0: [[512, 370], [272, 575], [752, 575], [272, 845], [752, 845], [272, 1115], [752, 1115]],
      1: [[272, 405], [752, 405], [272, 670], [752, 670], [272, 935], [752, 935], [272, 1200], [752, 1200]],
      2: [[252, 470], [252, 740], [252, 1010], [512, 340], [512, 610], [512, 880], [772, 470], [772, 740], [772, 1010]],
      3: [[252, 470], [252, 740], [252, 1010], [512, 340], [512, 610], [512, 880], [512, 1150], [772, 470], [772, 740], [772, 1010]],
    },
    1: {
      w: 160,
      0: [[512, 515], [290, 725], [734, 725], [290, 960], [734, 960], [290, 1195], [734, 1195]],
      1: [[290, 505], [734, 505], [290, 738], [734, 738], [290, 971], [734, 971], [290, 1204], [734, 1204]],
      2: [[287, 630], [287, 865], [287, 1100], [512, 512], [512, 747], [512, 982], [737, 630], [737, 865], [737, 1100]],
      3: [[287, 617], [287, 846], [287, 1075], [512, 508], [512, 733], [512, 958], [512, 1183], [737, 617], [737, 846], [737, 1075]],
    },
    3: {
      w: 185,
      0: [[512, 480], [282, 690], [742, 690], [282, 920], [742, 920], [282, 1150], [742, 1150]],
      1: [[282, 470], [742, 470], [282, 700], [742, 700], [282, 930], [742, 930], [282, 1160], [742, 1160]],
      2: [[272, 595], [272, 835], [272, 1075], [512, 475], [512, 715], [512, 955], [752, 595], [752, 835], [752, 1075]],
      3: [[272, 582], [272, 797], [272, 1012], [512, 475], [512, 690], [512, 905], [512, 1120], [752, 582], [752, 797], [752, 1012]],
    },
  };
  // figura je celá obrázkem a nese znaky barvy [x, y, šířka]: spodek jeden dole, svršek jeden
  // nahoře (stranou od obličeje), král a eso v obou horních rozích; podle barvy (rámeček, obrázek)
  const FIG_PIP = {
    0: { 4: [[512, 1190, 205]], 5: [[790, 400, 205]], 6: [[300, 380, 190], [724, 380, 190]], 7: [[300, 380, 190], [724, 380, 190]] },
    1: { 4: [[512, 1200, 160]], 5: [[790, 470, 160]], 6: [[300, 460, 150], [724, 460, 150]], 7: [[300, 460, 150], [724, 460, 150]] },
    3: { 4: [[512, 1130, 185]], 5: [[765, 460, 185]], 6: [[300, 405, 165], [724, 405, 165]], 7: [[300, 405, 165], [724, 405, 165]] },
  };
  // král a eso mají nad znaky v rozích písmeno, srozumitelné ve všech jazycích hry
  const LETTER = { 6: 'K', 7: 'A' };
  // obrázky, kterým by rámeček zakryl hlavu: zmenšit (s) a posunout dolů (y); okraj nad nimi
  // vyplní rozmazaná kopie téhož obrázku, přechod je pozvolný
  const FIT = { '0-5': { s: 0.86, y: 138 }, '3-6': { s: 0.92, y: 118 }, '3-7': { s: 0.84, y: 270 }, '1-4': { s: 0.8, y: 245 }, '1-5': { s: 0.82, y: 220 }, '1-6': { s: 0.8, y: 200 }, '1-7': { s: 0.8, y: 320 } };
  function fitted(bg, k, s) {
    const c = document.createElement('canvas'), t = c.getContext('2d');
    c.width = Math.round(DW * s * k); c.height = Math.round(DH * s * k);
    t.imageSmoothingQuality = 'high'; t.drawImage(bg, 0, 0, c.width, c.height);
    const g = t.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(Math.min(1, 70 * k / c.height), '#000'); g.addColorStop(1, '#000');
    t.globalCompositeOperation = 'destination-in'; t.fillStyle = g; t.fillRect(0, 0, c.width, c.height);
    return c;
  }
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  // vystouplý vzhled: uvnitř tvaru světlá hrana vlevo nahoře a tmavá vpravo dole (vnitřní stín).
  // Stín vrhá negativ tvaru posunutý mimo plátno, takže se kreslí jen stín; vše v pixelech
  // (stín plátna nezná ctx.scale), proto se počítá pro každou velikost zvlášť a pamatuje si.
  const raised = {};
  function emboss(name, im, w, h, depth) {
    if (!im) return null;
    const key = `${name}:${w}x${h}`;
    if (raised[key]) return raised[key];
    if (typeof im === 'function') im = im();
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
  // znak s obrysem, ať nesplývá s obrázkem: tmavý okraj, uvnitř něj tenká zlatá linka a znak
  // o něco sytější; obrys se dělá otisky siluety dokola (o je okraj v pixelech)
  function rimmed(im, w, h, o) {
    const c = document.createElement('canvas'), t = c.getContext('2d');
    c.width = w + 2 * o; c.height = h + 2 * o;
    const s = document.createElement('canvas'), st = s.getContext('2d');
    s.width = c.width; s.height = c.height; st.drawImage(im, o, o, w, h); st.globalCompositeOperation = 'source-in';
    for (const [color, r] of [['#260902', o], ['#f6d277', o * 0.4]]) {
      st.fillStyle = color; st.fillRect(0, 0, s.width, s.height);
      for (let a = 0; a < 16; a++) t.drawImage(s, Math.cos(a * Math.PI / 8) * r, Math.sin(a * Math.PI / 8) * r);
    }
    t.filter = 'saturate(1.2) contrast(1.08)'; t.drawImage(im, o, o, w, h);
    return c;
  }
  // znak barvy vystouplý nad pozadím: obrys, vnitřní stín, tmavá záře kolem a stín vržený na pozadí
  function pip(ctx, k, name, cx, cy, w, depth) {
    const im = img[name];
    if (!im) return;
    const h = w * im.height / im.width, iw = Math.round(w * k), ih = Math.round(h * k), o = Math.max(1, Math.round(8 * k));
    const e = emboss(name, () => rimmed(im, iw, ih, o), iw + 2 * o, ih + 2 * o, depth * k);
    const x = cx - w / 2 - o / k, y = cy - h / 2 - o / k;
    ctx.save(); ctx.shadowColor = 'rgba(25,5,0,.6)'; ctx.shadowBlur = 36 * k;
    ctx.drawImage(e, x, y, e.width / k, e.height / k);
    ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = 24 * k; ctx.shadowOffsetX = 4 * k; ctx.shadowOffsetY = 12 * k;
    ctx.drawImage(e, x, y, e.width / k, e.height / k);
    ctx.restore();
  }
  // zlatý odznak v rohu s tmavým obrysem, vystouplý jako znaky. shape(t, op) nakreslí tvar
  // w × h v návrhových jednotkách (op je 'stroke', pak 'fill'); x je bod, ke kterému se odznak zarovná
  // (align 0 levý okraj, 1 pravý, 0.5 střed), y spodní hrana (účaří číslic)
  function badge(ctx, k, key, w, h, shape, x, y, align) {
    const line = 7, pad = line + 4, c = document.createElement('canvas'), t = c.getContext('2d');
    c.width = Math.ceil((w + 2 * pad) * k); c.height = Math.ceil((h + 2 * pad) * k);
    t.scale(k, k); t.translate(pad, pad); t.lineJoin = 'round';
    const g = t.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff6cf'); g.addColorStop(0.45, '#f1c95a'); g.addColorStop(1, '#a8701c');
    t.lineWidth = line; t.strokeStyle = '#3a1c06'; shape(t, 'stroke');
    t.fillStyle = g; shape(t, 'fill');
    const e = emboss(key, c, c.width, c.height, 4 * k);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 14 * k; ctx.shadowOffsetX = 3 * k; ctx.shadowOffsetY = 7 * k;
    ctx.drawImage(e, x - w * align - pad, y - h - pad, c.width / k, c.height / k);
    ctx.restore();
  }
  // velké číslice, do šířky trochu stažené, ať se VIII vejde mezi roh a horní ozdobu (sc je velikost)
  const NARROW = 0.85, numFont = sc => `700 ${Math.round(142 * sc)}px ${FONT}`;
  let measure = null;
  function numeral(ctx, k, text, x, y, align, sc) {
    const font = numFont(sc);
    measure = measure || document.createElement('canvas').getContext('2d');
    measure.font = font;
    const m = measure.measureText(text), w = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * NARROW, h = m.actualBoundingBoxAscent;
    badge(ctx, k, `roman-${text}-${sc}`, w, h, (t, op) => { t.save(); t.scale(NARROW, 1); t.font = font; t[op + 'Text'](text, m.actualBoundingBoxLeft, h); t.restore(); }, x, y, align);
  }
  // figury mají v rozích místo písmen značku, která nepotřebuje překlad: spodek (Unter, „dolní“)
  // hrot dolů, svršek (Ober, „horní“) hrot nahoru
  // místo v horních rozích podle rámečku barvy [levý okraj, spodní hrana, velikost]: u listů
  // pod lištou mezi rohovou ozdobou a rytířem, u kulí pod trámem mezi praporcem a hlavou orka,
  // proto níž a menší
  const CORNER = { 0: [205, 258, 1], 1: [185, 365, 0.8], 3: [215, 350, 0.78] };
  const MARKS = {
    4: (t, op) => { t.beginPath(); t.moveTo(0, 0); t.lineTo(104, 0); t.quadraticCurveTo(79, 48, 52, 108); t.quadraticCurveTo(25, 48, 0, 0); t.closePath(); t[op](); },
    5: (t, op) => { t.beginPath(); t.moveTo(52, 0); t.quadraticCurveTo(79, 60, 104, 108); t.lineTo(0, 108); t.quadraticCurveTo(25, 60, 52, 0); t.closePath(); t[op](); },
  };

  function draw(c, width, en) {
    const su = c >> 3, rk = c & 7, k = width / DW;
    const cv = document.createElement('canvas'); cv.width = width; cv.height = Math.round(DH * k);
    const ctx = cv.getContext('2d'); ctx.scale(k, k); ctx.imageSmoothingQuality = 'high';
    const fs = FRAME_S[su] || 1, fx = x => DW / 2 + (x - DW / 2) * fs, fy = y => DH / 2 + (y - DH / 2) * fs;
    const [x0, y0, x1, y1, r] = CLIP[su] || CLIP[0];
    rr(ctx, fx(x0), fy(y0), (x1 - x0) * fs, (y1 - y0) * fs, r * fs); ctx.save(); ctx.clip();
    const bg = img[`bg-${su}-${rk}`], fit = FIT[`${su}-${rk}`];
    if (bg && fit) {
      ctx.save(); ctx.filter = `blur(${Math.max(1, Math.round(18 * k))}px) brightness(.8)`; ctx.drawImage(bg, 0, 0, DW, DH); ctx.restore();
      ctx.drawImage(fitted(bg, k, fit.s), (DW - DW * fit.s) / 2, fit.y, DW * fit.s, DH * fit.s);
    } else if (bg) ctx.drawImage(bg, 0, 0, DW, DH);
    else { const g = ctx.createLinearGradient(0, 0, 0, DH); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#efe3c8'); ctx.fillStyle = g; ctx.fillRect(0, 0, DW, DH); }
    // jemné ztmavení okrajů, ať rámeček a znak vyniknou
    const v = ctx.createRadialGradient(DW / 2, DH / 2, DW * 0.35, DW / 2, DH / 2, DH * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,6,0,.35)'); ctx.fillStyle = v; ctx.fillRect(0, 0, DW, DH);
    const sign = img[`emblem-${su}`] ? `emblem-${su}` : `suit-${su}`;
    // číselná karta: znaky barvy (srdce s elfkou) v rozložení podle hodnoty; figura je celá
    // obrázkem se znaky barvy, karta bez obrázku má velký znak uprostřed
    const lay = PIPS[su] || PIPS[0];
    if (lay[rk]) for (const [x, y] of lay[rk]) pip(ctx, k, sign, x, y, lay.w, 7);
    else if (bg && (FIG_PIP[su] || FIG_PIP[0])[rk]) for (const [x, y, w] of (FIG_PIP[su] || FIG_PIP[0])[rk]) pip(ctx, k, sign, x, y, w, 7);
    else if (!bg || !MARKS[rk]) pip(ctx, k, sign, DW / 2, DH * 0.5, 560, 12);
    // stín rámečku padá jen dovnitř karty (venku je průhledno)
    const fr = emboss(`frame-${su}`, img[`frame-${su}`], Math.round(DW * fs * k), Math.round(DH * fs * k), 6 * k);
    if (fr) {
      ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 20 * k; ctx.shadowOffsetX = 1e4 + 3 * k; ctx.shadowOffsetY = 8 * k;
      ctx.drawImage(fr, fx(0) - 1e4 / k, fy(0), DW * fs, DH * fs);
    }
    ctx.restore();
    // rámeček celý, i s ozdobami, které z karty vyčnívají
    if (fr) ctx.drawImage(fr, fx(0), fy(0), DW * fs, DH * fs);
    // v horních rozích, vedle ozdob rámečku, římská číslice nebo značka figury
    const [nx, ny, sc] = CORNER[su] || CORNER[0];
    for (const right of [false, true]) {
      const x = fx(right ? DW - nx : nx), y = fy(ny), s = sc * fs;
      if (ROMAN[rk]) numeral(ctx, k, ROMAN[rk], x, y, right ? 1 : 0, s);
      else if (MARKS[rk]) badge(ctx, k, `mark-${rk}-${s}`, 104 * s, 108 * s, (t, op) => { t.save(); t.scale(s, s); MARKS[rk](t, op); t.restore(); }, x, y, right ? 1 : 0);
    }
    const figs = (FIG_PIP[su] || FIG_PIP[0])[rk], si = img[sign];
    if (bg && LETTER[rk] && figs && si) for (const [x, y, w] of figs) numeral(ctx, k, LETTER[rk], x, y - w * si.height / si.width / 2 - 14, 0.5, sc);
    return cv;
  }
  const cache = {};
  const src = (c, en, width = 360) => { const key = `${c}:${en ? 'e' : 'c'}:${width}`; return cache[key] || (cache[key] = draw(c, width, en).toDataURL('image/webp', 0.9)); };
  return { ready, draw, src, RANKS_CS, RANKS_EN };
})();
