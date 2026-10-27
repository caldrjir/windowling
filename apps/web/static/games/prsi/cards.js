'use strict';
// ── PRŠÍ · mariášové karty (SVG) ────────────────────────────────────────────
// Každá karta se nakreslí jednou do SVG a dál se používá jako obrázek (data URL).
// Barvy: 0 srdce, 1 listy (zelené), 2 žaludy, 3 kule. Hodnoty: 7, 8, 9, 10, spodek, svršek, král, eso.
const PrsiCards = (() => {
  const W = 100, H = 150;
  const RANKS_CS = ['7', '8', '9', '10', 'Sp', 'Sv', 'K', 'E'], RANKS_EN = ['7', '8', '9', '10', 'U', 'O', 'K', 'A'];
  const INK = ['#d8262c', '#23873a', '#8a5418', '#e0561d'];
  const LIGHT = ['#fde3e1', '#e0f3e2', '#f6ead6', '#fde7d6'];

  // značky barev v jednotkovém čtverci [-1, 1], umístěné na (x, y) ve velikosti s
  function pip(su, x, y, s, flip) {
    const t = `transform="translate(${x} ${y}) scale(${s})${flip ? ' rotate(180)' : ''}"`;
    if (su === 0) return `<path ${t} d="M0,.92C-.22,.7-1,.25-1,-.3C-1,-.75-.55,-1-.25,-.9C-.1,-.85 0,-.7 0,-.6C0,-.7 .1,-.85 .25,-.9C.55,-1 1,-.75 1,-.3C1,.25 .22,.7 0,.92Z" fill="${INK[0]}" stroke="#7a0f12" stroke-width=".06"/>`;
    if (su === 1) return `<g ${t}><path d="M0,-1C.6,-.62 .8,-.1 .58,.4C.42,.74 .18,.86 0,.96C-.18,.86-.42,.74-.58,.4C-.8,-.1-.6,-.62 0,-1Z" fill="${INK[1]}" stroke="#0f4a1d" stroke-width=".06"/><path d="M0,-.82V1.08M0,-.3L.36,-.55M0,-.3L-.36,-.55M0,.15L.42,-.1M0,.15L-.42,-.1M0,.55L.34,.36M0,.55L-.34,.36" stroke="#bfe8c4" stroke-width=".07" fill="none"/></g>`;
    if (su === 2) return `<g ${t}><ellipse cx="0" cy=".3" rx=".52" ry=".64" fill="#f0bd3c" stroke="#7a4b10" stroke-width=".06"/><ellipse cx="-.16" cy=".2" rx=".12" ry=".22" fill="#fff3c2" opacity=".8"/><path d="M-.74,-.02C-.74,-.72 .74,-.72 .74,-.02Z" fill="${INK[2]}" stroke="#4a2a08" stroke-width=".06"/><path d="M-.5,-.2h1M-.45,-.38h.9" stroke="#c48a45" stroke-width=".07"/><rect x="-.07" y="-.86" width=".14" height=".28" rx=".05" fill="#4a2a08"/></g>`;
    return `<g ${t}><circle r=".86" fill="${INK[3]}" stroke="#7a2a08" stroke-width=".06"/><ellipse rx=".86" ry=".26" fill="none" stroke="#ffd23f" stroke-width=".2"/><path d="M0,-.86V.86" stroke="#ffd23f" stroke-width=".14"/><circle cx="-.36" cy="-.4" r=".16" fill="#fff" opacity=".7"/></g>`;
  }
  const PIPS = {
    0: [[30, 40], [70, 40], [50, 60], [30, 80], [70, 80], [30, 116], [70, 116]],
    1: [[30, 40], [70, 40], [50, 60], [30, 80], [70, 80], [50, 100], [30, 116], [70, 116]],
    2: [[30, 38], [70, 38], [30, 64], [70, 64], [50, 77], [30, 90], [70, 90], [30, 116], [70, 116]],
    3: [[30, 38], [70, 38], [50, 51], [30, 64], [70, 64], [30, 90], [70, 90], [50, 103], [30, 116], [70, 116]],
  };
  // figury: hlava, tělo v barvě, pokrývka hlavy podle hodnosti a značka barvy v ruce
  function figure(su, rk) {
    const ink = INK[su];
    let hat;
    if (rk === 4) hat = `<path d="M37,47C37,36 63,36 63,47Z" fill="${ink}"/><rect x="34" y="45" width="32" height="4" rx="2" fill="#333"/>`; // spodek: čepice
    else if (rk === 5) hat = `<path d="M33,48C35,34 65,34 67,48Z" fill="#2b2b40"/><path d="M60,38C70,26 80,24 84,22C78,30 70,36 62,42Z" fill="${ink}"/><rect x="31" y="46" width="38" height="4" rx="2" fill="#2b2b40"/>`; // svršek: klobouk s pérem
    else hat = `<path d="M36,48L36,34L43,41L50,30L57,41L64,34L64,48Z" fill="#f2c230" stroke="#8a6a10" stroke-width="1"/><circle cx="50" cy="33" r="2" fill="#d8262c"/>`; // král: koruna
    return `<rect x="16" y="22" width="68" height="106" rx="6" fill="${LIGHT[su]}" stroke="${ink}" stroke-width="1.5"/>
      <path d="M26,128C26,92 36,80 50,80C64,80 74,92 74,128Z" fill="${ink}"/><path d="M42,80L50,96L58,80Z" fill="#fff"/>
      <circle cx="50" cy="60" r="13" fill="#f6d2b0" stroke="#8a5a3a" stroke-width="1"/>
      ${rk === 6 ? '<path d="M39,64C40,76 60,76 61,64C57,70 43,70 39,64Z" fill="#a0603a"/>' : '<path d="M44,66C47,69 53,69 56,66" stroke="#8a5a3a" stroke-width="1.4" fill="none"/>'}
      <circle cx="45" cy="58" r="1.6" fill="#333"/><circle cx="55" cy="58" r="1.6" fill="#333"/>${hat}
      ${pip(su, 50, 108, 11)}`;
  }
  function face(c, en) {
    const su = c >> 3, rk = c & 7, ink = INK[su], R = (en ? RANKS_EN : RANKS_CS)[rk];
    let mid;
    if (rk <= 3) mid = PIPS[rk].map(([x, y]) => pip(su, x, y, 10, y > 90)).join('');
    else if (rk === 7) mid = `<circle cx="50" cy="75" r="34" fill="${LIGHT[su]}" stroke="${ink}" stroke-width="1.5" stroke-dasharray="3 3"/>${pip(su, 50, 75, 26)}`;
    else mid = figure(su, rk);
    const idx = (x, y, rot) => `<g transform="translate(${x} ${y})${rot ? ' rotate(180)' : ''}"><text x="0" y="0" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${R.length > 1 ? 13 : 16}" text-anchor="middle" fill="${ink}">${R}</text>${pip(su, 0, 9, 5)}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect x="1" y="1" width="98" height="148" rx="9" fill="#fffdf6" stroke="#c9c2b0" stroke-width="1.5"/>${mid}${idx(10, 17, false)}${idx(90, 133, true)}</svg>`;
  }
  function back() {
    let lines = '';
    for (let k = -150; k < 250; k += 12) lines += `<path d="M${k},0L${k + 150},150M${k + 150},0L${k},150" stroke="#e7b84a" stroke-width="1" opacity=".35"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect x="1" y="1" width="98" height="148" rx="9" fill="#7e1d2c" stroke="#3e0c14" stroke-width="1.5"/><defs><clipPath id="b"><rect x="8" y="8" width="84" height="134" rx="6"/></clipPath></defs><g clip-path="url(#b)">${lines}</g><rect x="8" y="8" width="84" height="134" rx="6" fill="none" stroke="#e7b84a" stroke-width="2"/><circle cx="50" cy="75" r="16" fill="#7e1d2c" stroke="#e7b84a" stroke-width="2"/>${pip(0, 50, 75, 8)}</svg>`;
  }
  const cache = {};
  const uri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const src = (c, en) => cache[c + (en ? 'e' : 'c')] || (cache[c + (en ? 'e' : 'c')] = uri(face(c, en)));
  const backSrc = () => cache.back || (cache.back = uri(back()));
  const suitSvg = (su, s = 24) => `<svg viewBox="-1.1 -1.1 2.2 2.2" width="${s}" height="${s}">${pip(su, 0, 0, 1)}</svg>`;
  return { src, backSrc, suitSvg, INK, RANKS_CS, RANKS_EN };
})();
