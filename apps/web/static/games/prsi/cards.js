'use strict';
// ── PRŠÍ · mariášové karty (SVG) ────────────────────────────────────────────
// Každá karta se nakreslí jednou do SVG a dál se používá jako obrázek (data URL).
// Barvy: 0 srdce, 1 listy (zelené), 2 žaludy, 3 kule. Hodnoty: 7, 8, 9, 10, spodek, svršek, král, eso.
// Číselné karty se značkami ve dvou sloupcích, figury dvouhlavé jako na klasických mariáškách,
// esa s ročním obdobím (srdce léto, listy jaro, žaludy podzim, kule zima).
const PrsiCards = (() => {
  const W = 100, H = 150;
  const RANKS_CS = ['7', '8', '9', '10', 'Sp', 'Sv', 'K', 'E'], RANKS_EN = ['7', '8', '9', '10', 'U', 'O', 'K', 'A'];
  const INK = ['#c41f2a', '#1e7a35', '#8a5216', '#c9620f'];
  const DARK = ['#6e0d13', '#0c4519', '#4a2a08', '#6e2c05'];
  const LIGHT = ['#fbe1dc', '#dff1df', '#f4e6cf', '#fbe7cf'];
  const SEASON_CS = ['LÉTO', 'JARO', 'PODZIM', 'ZIMA'], SEASON_EN = ['SUMMER', 'SPRING', 'AUTUMN', 'WINTER'];

  // přechody pro značky (v každém SVG zvlášť, id jsou jen uvnitř karty)
  const DEFS = `<defs>
    <radialGradient id="gh" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ff7a74"/><stop offset=".55" stop-color="#d4232c"/><stop offset="1" stop-color="#8e1018"/></radialGradient>
    <radialGradient id="gl" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#7fd98c"/><stop offset=".55" stop-color="#26923f"/><stop offset="1" stop-color="#0f5420"/></radialGradient>
    <radialGradient id="ga" cx=".35" cy=".35" r=".9"><stop offset="0" stop-color="#ffe08a"/><stop offset=".6" stop-color="#d9a032"/><stop offset="1" stop-color="#8e5a12"/></radialGradient>
    <radialGradient id="gb" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#f2b21c"/><stop offset="1" stop-color="#a35f06"/></radialGradient>
    <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#f3ead6"/></linearGradient>
    <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe8f7"/><stop offset=".62" stop-color="#f6f1df"/><stop offset=".63" stop-color="#b9d38c"/><stop offset="1" stop-color="#8fb565"/></linearGradient>
    <linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1a6"/><stop offset=".5" stop-color="#f2c230"/><stop offset="1" stop-color="#a87a10"/></linearGradient>
  </defs>`;

  // značky barev v jednotkovém čtverci [-1, 1], umístěné na (x, y) ve velikosti s
  function pip(su, x, y, s, flip) {
    const t = `transform="translate(${x} ${y}) scale(${s})${flip ? ' rotate(180)' : ''}"`, w = (0.9 / Math.max(4, s)).toFixed(3);
    if (su === 0) return `<g ${t}><path d="M0,.92C-.24,.7-1,.26-1,-.3C-1,-.76-.55,-1-.26,-.9C-.11,-.85 0,-.72 0,-.6C0,-.72 .11,-.85 .26,-.9C.55,-1 1,-.76 1,-.3C1,.26 .24,.7 0,.92Z" fill="url(#gh)" stroke="${DARK[0]}" stroke-width="${w}"/><ellipse cx="-.45" cy="-.45" rx=".22" ry=".14" transform="rotate(-35 -.45 -.45)" fill="#fff" opacity=".55"/></g>`;
    if (su === 1) return `<g ${t}><path d="M0,.72V1.02" stroke="${DARK[1]}" stroke-width=".12" stroke-linecap="round"/><path d="M0,-1C.3,-.72 .95,-.42 .95,.08C.95,.48 .55,.74 .2,.6C.12,.66 .05,.72 0,.78C-.05,.72-.12,.66-.2,.6C-.55,.74-.95,.48-.95,.08C-.95,-.42-.3,-.72 0,-1Z" fill="url(#gl)" stroke="${DARK[1]}" stroke-width="${w}"/><path d="M0,-.8V.7M0,-.3L.45,-.45M0,-.3L-.45,-.45M0,.08L.6,-.05M0,.08L-.6,-.05M0,.42L.48,.36M0,.42L-.48,.36" stroke="#d9f5d7" stroke-width=".06" stroke-linecap="round" fill="none" opacity=".85"/></g>`;
    if (su === 2) return `<g ${t}><ellipse cx="0" cy=".32" rx=".55" ry=".66" fill="url(#ga)" stroke="${DARK[2]}" stroke-width="${w}"/><ellipse cx="-.2" cy=".18" rx=".13" ry=".25" fill="#fff6cf" opacity=".7"/><path d="M-.8,0C-.8,-.75 .8,-.75 .8,0C.4,.12-.4,.12-.8,0Z" fill="#6b3a10" stroke="${DARK[2]}" stroke-width="${w}"/><path d="M-.62,-.12L-.3,-.5M-.32,-.03L.1,-.6M.02,0L.42,-.52M.34,-.04L.6,-.36M-.6,-.3L.1,.02M-.3,-.55L.5,-.06" stroke="#b07a3c" stroke-width=".06" opacity=".8"/><path d="M0,-.6C.05,-.85 .22,-.95 .3,-1" stroke="#4a2808" stroke-width=".12" stroke-linecap="round" fill="none"/></g>`;
    return `<g ${t}><circle r=".86" fill="url(#gb)" stroke="${DARK[3]}" stroke-width="${w}"/><path d="M-.86,0C-.6,.2 .6,.2 .86,0C.84,-.14 .8,-.24 .74,-.32C.5,-.18-.5,-.18-.74,-.32C-.8,-.24-.84,-.14-.86,0Z" fill="#c8202a" stroke="${DARK[3]}" stroke-width="${(w * 0.7).toFixed(3)}"/><path d="M-.34,.5Q0,.66 .34,.5" stroke="${DARK[3]}" stroke-width=".1" fill="none" stroke-linecap="round"/><circle cy=".52" r=".07" fill="${DARK[3]}"/><circle cx="-.34" cy="-.46" r=".16" fill="#fff" opacity=".75"/><path d="M-.12,-.86C-.12,-1.04 .12,-1.04 .12,-.86" stroke="${DARK[3]}" stroke-width=".1" fill="none"/></g>`;
  }
  // rozmístění značek na číselných kartách (dva sloupce, jako na mariáškách)
  const PIPS = {
    0: [[32, 36], [68, 36], [50, 56], [32, 76], [68, 76], [32, 114], [68, 114]],
    1: [[32, 36], [68, 36], [32, 62], [68, 62], [32, 88], [68, 88], [32, 114], [68, 114]],
    2: [[32, 36], [68, 36], [32, 62], [68, 62], [50, 75], [32, 88], [68, 88], [32, 114], [68, 114]],
    3: [[32, 34], [68, 34], [50, 47], [32, 62], [68, 62], [32, 88], [68, 88], [50, 103], [32, 116], [68, 116]],
  };
  const frame = su => `<rect x="1" y="1" width="98" height="148" rx="9" fill="url(#gp)" stroke="#bdb39b" stroke-width="1.4"/><rect x="6.5" y="6.5" width="87" height="137" rx="5" fill="none" stroke="${INK[su]}" stroke-width=".9" opacity=".55"/>`;
  const ribbon = (y, text, su) => {
    const fs = text.length > 5 ? 7.2 : 8.4;
    return `<path d="M21,${y}h58l-4,6l4,6h-58l4,-6z" fill="${INK[su]}" stroke="${DARK[su]}" stroke-width=".8"/><text x="50" y="${y + 8.6}" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="${fs}" letter-spacing=".8" text-anchor="middle" fill="#fff8e4">${text}</text>`;
  };

  // figury: dvouhlavé jako na klasických mariáškách – poprsí nahoře, zrcadlově dole; šaty v barvě,
  // silné obrysy, spodek s baretem, svršek s kloboukem a pérem, král s korunou, vousem a hermelínem
  function figure(su, rk) {
    const ink = INK[su], dk = DARK[su], OL = '#2a1a10', skin = '#f4d2ac';
    const hair = rk === 6 ? '#9b8f80' : rk === 5 ? '#6b4220' : '#b0722e';
    const o = `stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"`;
    // tělo a šaty (horní polovina, končí na středu karty)
    // trup jako lichoběžník (ramena široká, pas užší) a rukáv k ruce, ve které drží značku
    const sleeve = (x, sgn) => `<path d="M${50 + sgn * 17},53.5Q${50 + sgn * 27},54.5 ${x + sgn * 2},${60}L${x - sgn * 1},${65.5}Q${50 + sgn * 22},${61.5} ${50 + sgn * 16},61Z" fill="${ink}" ${o}/><path d="M${x + sgn * 1.4},${61.2}L${x - sgn * 2},${64.6}" stroke="#f2c230" stroke-width="1.6"/>`;
    let body = `<path d="M33,76L29.5,61Q28,54.5 35,53L65,53Q72,54.5 70.5,61L67,76Z" fill="${ink}" ${o}/>`;
    body += `<path d="M31,62L35,76M69,62L65,76" stroke="#f2c230" stroke-width="1.3" opacity=".9"/>`;
    body += sleeve(78, 1);
    if (rk === 6) body += sleeve(22, -1);
    if (rk === 6) {
      // hermelínový plášť a zlatý řetěz
      body += `<path d="M29.5,61Q28,54.5 35,53L42,53C38,57 36.5,62 36,68L31.2,68Z" fill="#fffaf0" ${o}/><path d="M70.5,61Q72,54.5 65,53L58,53C62,57 63.5,62 64,68L68.8,68Z" fill="#fffaf0" ${o}/>`;
      body += [[33, 57], [38, 56], [33.5, 63], [67, 57], [62, 56], [66.5, 63]].map(([x, y]) => `<path d="M${x},${y - 1.6}l1.3,2.6h-2.6z" fill="${OL}"/>`).join('');
      body += `<path d="M38,58Q50,70 62,58" stroke="#e0a91c" stroke-width="2.2" fill="none" stroke-dasharray="2.2 1.2"/><circle cx="50" cy="66" r="2.6" fill="url(#gg)" stroke="#7a5a08" stroke-width=".6"/>`;
    } else if (rk === 5) {
      body += `<path d="M42,53L50,64L58,53Z" fill="#fffaf0" ${o}/><path d="M50,64V76" stroke="${dk}" stroke-width="1"/>${[68, 72].map(y => `<circle cx="50" cy="${y}" r="1.3" fill="#f2c230"/>`).join('')}`;
      body += `<path d="M36,55L66,74" stroke="#f2c230" stroke-width="2.8" opacity=".9"/>`;
    } else {
      body += `<path d="M39,53C41,58 59,58 61,53" fill="#fffaf0" ${o}/><path d="M50,56V76" stroke="${dk}" stroke-width="1"/>${[61, 66, 71].map(y => `<circle cx="50" cy="${y}" r="1.2" fill="#f2c230"/>`).join('')}`;
    }
    // hlava: krk, obličej, vlasy
    let head = `<path d="M45.5,44V53.5H54.5V44Z" fill="${skin}" ${o}/>`;
    head += `<path d="M38.5,34C37,40 38,44 39,46L44,42Z" fill="${hair}" ${o}/><path d="M61.5,34C63,40 62,44 61,46L56,42Z" fill="${hair}" ${o}/>`;
    head += `<ellipse cx="50" cy="35" rx="10.5" ry="12" fill="${skin}" ${o}/>`;
    head += `<path d="M44.2,33.2q1.8,-1.2 3.6,0M52.2,33.2q1.8,-1.2 3.6,0" stroke="${OL}" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
    head += `<ellipse cx="46" cy="35.6" rx="1.15" ry="1.35" fill="${OL}"/><ellipse cx="54" cy="35.6" rx="1.15" ry="1.35" fill="${OL}"/>`;
    head += `<path d="M48.4,39.6Q50,41.2 51.6,39.6" stroke="#b07a52" stroke-width=".9" fill="none" stroke-linecap="round"/><circle cx="43.6" cy="40" r="1.9" fill="#ef9a86" opacity=".55"/><circle cx="56.4" cy="40" r="1.9" fill="#ef9a86" opacity=".55"/>`;
    if (rk === 6) head += `<path d="M39.5,38C39,48 44,55 50,56C56,55 61,48 60.5,38C58,42 55,43.5 50,43.5C45,43.5 42,42 39.5,38Z" fill="${hair}" ${o}/><path d="M45,43.6Q50,41.6 55,43.6" stroke="${OL}" stroke-width="1.1" fill="none"/><path d="M47.5,46.2h5" stroke="#6e6458" stroke-width=".9"/>`;
    else if (rk === 5) head += `<path d="M44.5,43.2Q47.5,41.6 50,42.6Q52.5,41.6 55.5,43.2Q52.5,44.4 50,43.6Q47.5,44.4 44.5,43.2Z" fill="${hair}" ${o}/><path d="M48.6,45.2Q50,48.6 51.4,45.2Z" fill="${hair}"/>`;
    else head += `<path d="M46.6,43.4Q50,45.4 53.4,43.4" stroke="${OL}" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
    // pokrývka hlavy
    let hat;
    if (rk === 6) hat = `<path d="M38,27L36.5,13L43,20L50,10L57,20L63.5,13L62,27Z" fill="url(#gg)" ${o}/><path d="M37.5,24.5H62.5V28.5H37.5Z" fill="url(#gg)" ${o}/><circle cx="50" cy="13.5" r="2" fill="#c8202a" ${o}/><circle cx="43.5" cy="21.5" r="1.4" fill="#2f6fe0"/><circle cx="56.5" cy="21.5" r="1.4" fill="#1e7a35"/><circle cx="50" cy="26.5" r="1.3" fill="#c8202a"/>`;
    else if (rk === 5) hat = `<path d="M30,27C34,22 42,20.5 50,20.5C58,20.5 66,22 70,27C64,29.2 36,29.2 30,27Z" fill="#2b2b3a" ${o}/><path d="M40,23.5C40,14 60,14 60,23.5Z" fill="#2b2b3a" ${o}/><path d="M40,22.2H60" stroke="#e0a91c" stroke-width="1.8"/><path d="M57,19C62,9 71,5 79,3C75,11 67,18 60,22Z" fill="${ink}" ${o}/><path d="M59.5,20.5C64,13 70,8.5 77,4.8" stroke="#fffaf0" stroke-width=".6" fill="none" opacity=".8"/>`;
    else hat = `<path d="M36.5,29C33,20 42,15 51,15.5C60,16 66,21 63.5,29C57,26.6 43,26.6 36.5,29Z" fill="${dk}" ${o}/><path d="M38,27.5Q50,24.6 62,27.5" stroke="#f2c230" stroke-width="1.4" fill="none"/><path d="M58,19C61,12 65,9 69,7.5C68,12 64,16 60,20Z" fill="#fffaf0" ${o}/>`;
    // co drží v ruce: značku barvy (a král žezlo)
    let held = '';
    if (rk === 6) held = `<path d="M21.5,68L27,40" stroke="#a87a10" stroke-width="2.4" stroke-linecap="round"/><circle cx="27.4" cy="38" r="3.2" fill="url(#gg)" ${o}/><ellipse cx="22" cy="64.5" rx="3.4" ry="2.9" fill="${skin}" ${o}/>`;
    const hand = [78, 64];
    held += `${pip(su, hand[0], hand[1] - 8.5, 7.5)}<ellipse cx="${hand[0]}" cy="${hand[1]}" rx="3.6" ry="3" fill="${skin}" ${o}/>`;
    const half = `${body}${head}${hat}${held}`;
    return `<defs><clipPath id="hf"><rect x="9" y="9" width="82" height="66"/></clipPath></defs>
      <rect x="9" y="9" width="82" height="132" rx="4" fill="${LIGHT[su]}"/>
      <g clip-path="url(#hf)">${half}</g><g transform="rotate(180 50 75)"><g clip-path="url(#hf)">${half}</g></g>
      <path d="M9,75H91" stroke="${dk}" stroke-width="1.2"/><rect x="9" y="9" width="82" height="132" rx="4" fill="none" stroke="${dk}" stroke-width="1"/>`;
  }
  function ace(su, en) {
    let wreath = '';
    for (let k = 0; k < 9; k++) {
      for (const side of [-1, 1]) {
        const a = Math.PI * (0.62 + k * 0.1), x = 50 + side * Math.cos(a) * -31, y = 66 + Math.sin(a) * 31, rot = side * (k * 18 - 30);
        wreath += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.2" ry="5" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${k % 2 ? '#3f8f45' : '#2e7a38'}"/>`;
      }
    }
    return `<circle cx="50" cy="66" r="36" fill="${LIGHT[su]}" stroke="${INK[su]}" stroke-width="1" stroke-dasharray="2 2.5" opacity=".9"/>${wreath}${pip(su, 50, 64, 23)}${ribbon(112, (en ? SEASON_EN : SEASON_CS)[su], su)}`;
  }
  function face(c, en) {
    const su = c >> 3, rk = c & 7, ink = INK[su], R = (en ? RANKS_EN : RANKS_CS)[rk];
    let mid;
    if (rk <= 3) mid = PIPS[rk].map(([x, y]) => pip(su, x, y, 10, y > 80)).join('');
    else if (rk === 7) mid = ace(su, en);
    else mid = figure(su, rk);
    const fig = rk >= 4 && rk <= 6;
    const idx = (x, y, rot) => `<g transform="translate(${x} ${y})${rot ? ' rotate(180)' : ''}"><rect x="-8" y="-11" width="16" height="25" rx="3" fill="#fffdf6" opacity="${fig ? 0.92 : 0}"/><text x="0" y="1.5" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="${R.length > 1 ? 11.5 : 14}" text-anchor="middle" fill="${ink}">${R}</text>${pip(su, 0, 8.5, 4.4)}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${DEFS}${frame(su)}${mid}${idx(13, 17, false)}${idx(87, 133, true)}</svg>`;
  }
  function back() {
    let lattice = '';
    for (let k = -150; k < 250; k += 10) lattice += `<path d="M${k},0L${k + 150},150M${k + 150},0L${k},150" stroke="#e9c46a" stroke-width=".7" opacity=".32"/>`;
    const corner = (x, y, r) => `<path transform="translate(${x} ${y}) rotate(${r})" d="M0,0C6,0 10,4 10,10M0,0C0,6 4,10 10,10" stroke="#e9c46a" stroke-width="1.2" fill="none"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${DEFS}<defs><radialGradient id="bk" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#a32436"/><stop offset="1" stop-color="#5a0f1c"/></radialGradient><clipPath id="b"><rect x="8" y="8" width="84" height="134" rx="6"/></clipPath></defs>
      <rect x="1" y="1" width="98" height="148" rx="9" fill="#fffaf0" stroke="#bdb39b" stroke-width="1.4"/><rect x="5" y="5" width="90" height="140" rx="7" fill="url(#bk)"/>
      <g clip-path="url(#b)">${lattice}</g><rect x="8" y="8" width="84" height="134" rx="6" fill="none" stroke="#e9c46a" stroke-width="1.6"/>
      ${corner(13, 13, 0)}${corner(87, 13, 90)}${corner(87, 137, 180)}${corner(13, 137, 270)}
      <ellipse cx="50" cy="75" rx="22" ry="28" fill="#5a0f1c" stroke="#e9c46a" stroke-width="1.6"/><ellipse cx="50" cy="75" rx="18" ry="24" fill="none" stroke="#e9c46a" stroke-width=".6" opacity=".7"/>
      ${pip(0, 43, 66, 5.2)}${pip(1, 57, 66, 5.2)}${pip(2, 43, 84, 5.2)}${pip(3, 57, 84, 5.2)}</svg>`;
  }
  const cache = {};
  const uri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const src = (c, en) => cache[c + (en ? 'e' : 'c')] || (cache[c + (en ? 'e' : 'c')] = uri(face(c, en)));
  const backSrc = () => cache.back || (cache.back = uri(back()));
  const suitSvg = (su, s = 24) => `<svg viewBox="-1.15 -1.15 2.3 2.3" width="${s}" height="${s}">${DEFS}${pip(su, 0, 0, 1)}</svg>`;
  return { src, backSrc, suitSvg, face, back, INK, RANKS_CS, RANKS_EN };
})();
