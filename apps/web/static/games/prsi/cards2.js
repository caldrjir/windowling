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
    0: [[512, 370], [272, 575], [752, 575], [272, 845], [752, 845], [272, 1115], [752, 1115]],
    1: [[272, 405], [752, 405], [272, 670], [752, 670], [272, 935], [752, 935], [272, 1200], [752, 1200]],
    2: [[252, 470], [252, 740], [252, 1010], [512, 340], [512, 610], [512, 880], [772, 470], [772, 740], [772, 1010]],
    3: [[252, 470], [252, 740], [252, 1010], [512, 340], [512, 610], [512, 880], [512, 1150], [772, 470], [772, 740], [772, 1010]],
  };
  const PIP_W = 205;
  // figura je celá obrázkem a nese znaky barvy [x, y, šířka]: spodek jeden dole, svršek jeden
  // nahoře (stranou od obličeje), král a eso v obou horních rozích
  const FIG_PIP = { 4: [[512, 1190, PIP_W]], 5: [[790, 400, PIP_W]], 6: [[300, 305, 190], [724, 305, 190]], 7: [[300, 305, 190], [724, 305, 190]] };
  // obrázky, kterým by rámeček zakryl hlavu: zmenšit (s) a posunout dolů (y); okraj nad nimi
  // vyplní rozmazaná kopie téhož obrázku, přechod je pozvolný
  const FIT = { '0-5': { s: 0.86, y: 138 } };
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
  // w × h v návrhových jednotkách (op je 'stroke', pak 'fill'); x je levý (u pravého rohu pravý)
  // okraj, y spodní hrana (účaří číslic)
  function badge(ctx, k, key, w, h, shape, x, y, right) {
    const line = 7, pad = line + 4, c = document.createElement('canvas'), t = c.getContext('2d');
    c.width = Math.ceil((w + 2 * pad) * k); c.height = Math.ceil((h + 2 * pad) * k);
    t.scale(k, k); t.translate(pad, pad); t.lineJoin = 'round';
    const g = t.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff6cf'); g.addColorStop(0.45, '#f1c95a'); g.addColorStop(1, '#a8701c');
    t.lineWidth = line; t.strokeStyle = '#3a1c06'; shape(t, 'stroke');
    t.fillStyle = g; shape(t, 'fill');
    const e = emboss(key, c, c.width, c.height, 4 * k);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 14 * k; ctx.shadowOffsetX = 3 * k; ctx.shadowOffsetY = 7 * k;
    ctx.drawImage(e, (right ? x - w : x) - pad, y - h - pad, c.width / k, c.height / k);
    ctx.restore();
  }
  // velké číslice, do šířky trochu stažené, ať se VIII vejde mezi roh a horní ozdobu
  const NUM = '700 142px ' + FONT, NARROW = 0.85;
  let measure = null;
  function numeral(ctx, k, text, x, y, right) {
    measure = measure || document.createElement('canvas').getContext('2d');
    measure.font = NUM;
    const m = measure.measureText(text), w = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * NARROW, h = m.actualBoundingBoxAscent;
    badge(ctx, k, `roman-${text}`, w, h, (t, op) => { t.save(); t.scale(NARROW, 1); t.font = NUM; t[op + 'Text'](text, m.actualBoundingBoxLeft, h); t.restore(); }, x, y, right);
  }
  // figury mají v rozích místo písmen značku, která nepotřebuje překlad: spodek (Unter, „dolní“)
  // hrot dolů, svršek (Ober, „horní“) hrot nahoru
  const MARKS = {
    4: (t, op) => { t.beginPath(); t.moveTo(0, 0); t.lineTo(104, 0); t.quadraticCurveTo(79, 48, 52, 108); t.quadraticCurveTo(25, 48, 0, 0); t.closePath(); t[op](); },
    5: (t, op) => { t.beginPath(); t.moveTo(52, 0); t.quadraticCurveTo(79, 60, 104, 108); t.lineTo(0, 108); t.quadraticCurveTo(25, 60, 52, 0); t.closePath(); t[op](); },
  };

  function draw(c, width, en) {
    const su = c >> 3, rk = c & 7, k = width / DW;
    const cv = document.createElement('canvas'); cv.width = width; cv.height = Math.round(DH * k);
    const ctx = cv.getContext('2d'); ctx.scale(k, k); ctx.imageSmoothingQuality = 'high';
    rr(ctx, FX[0], FY[0], FX[1] - FX[0], FY[1] - FY[0], FR); ctx.save(); ctx.clip();
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
    if (PIPS[rk]) for (const [x, y] of PIPS[rk]) pip(ctx, k, sign, x, y, PIP_W, 7);
    else if (bg && FIG_PIP[rk]) for (const [x, y, w] of FIG_PIP[rk]) pip(ctx, k, sign, x, y, w, 7);
    else if (!bg || !MARKS[rk]) pip(ctx, k, sign, DW / 2, DH * 0.5, 560, 12);
    // stín rámečku padá jen dovnitř karty (venku je průhledno)
    const fr = emboss(`frame-${su}`, img[`frame-${su}`], cv.width, cv.height, 6 * k);
    if (fr) {
      ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 20 * k; ctx.shadowOffsetX = 1e4 + 3 * k; ctx.shadowOffsetY = 8 * k;
      ctx.drawImage(fr, -1e4 / k, 0, DW, DH);
    }
    ctx.restore();
    // rámeček celý, i s ozdobami, které z karty vyčnívají
    if (fr) ctx.drawImage(fr, 0, 0, DW, DH);
    // v horních rozích, vedle ozdob rámečku, římská číslice nebo značka figury
    for (const right of [false, true]) {
      const x = right ? DW - 205 : 205;
      if (ROMAN[rk]) numeral(ctx, k, ROMAN[rk], x, 258, right);
      else if (MARKS[rk]) badge(ctx, k, `mark-${rk}`, 104, 108, MARKS[rk], x, 258, right);
    }
    return cv;
  }
  const cache = {};
  const src = (c, en, width = 360) => { const key = `${c}:${en ? 'e' : 'c'}:${width}`; return cache[key] || (cache[key] = draw(c, width, en).toDataURL('image/webp', 0.9)); };
  return { ready, draw, src, RANKS_CS, RANKS_EN };
})();
