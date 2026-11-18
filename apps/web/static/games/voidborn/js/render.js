'use strict';
// ── Sprity: předrenderované neonové tvary (shadowBlur jen jednou) ───────────
// Vše, co se dá, se kreslí jednou do spritu a ve hře se jen otáčí a škáluje přes drawImage (rychlá
// cesta GPU canvasu). Gradienty, čárkované čáry, stíny a měnící se cesty v každém snímku stojí GPU
// rasterizaci mimo JS (záznam výkonu: 80 % délky snímku). SPR = rozlišení spritů vůči světu: podle
// skutečného zvětšení obrazovky (dpr × zoom), ne víc, ať textury zbytečně nebobtnají.
let SPR = 2;
const Sprites = (() => {
  const cache = new Map();
  const get = (key, fn) => { let s = cache.get(key); if (!s) { s = fn(); cache.set(key, s); } return s; };
  // nové rozlišení spritů (při změně velikosti okna): staré se zahodí a nakreslí znovu podle potřeby
  function setScale(v) { v = clamp(Math.ceil(v * 4) / 4, 1, 2); if (v !== SPR) { SPR = v; cache.clear(); } }

  function path(x, shape, r) {
    x.beginPath();
    const poly = (n, rot, rr = r) => { for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); };
    switch (shape) {
      case 'tri': poly(3, 0); break;
      case 'dart': x.moveTo(r, 0); x.lineTo(-r * 0.8, r * 0.8); x.lineTo(-r * 0.35, 0); x.lineTo(-r * 0.8, -r * 0.8); x.closePath(); break;
      case 'arrow': x.moveTo(r * 1.15, 0); x.lineTo(-r * 0.2, r * 0.75); x.lineTo(-r * 0.9, r * 0.75); x.lineTo(-r * 0.35, 0); x.lineTo(-r * 0.9, -r * 0.75); x.lineTo(-r * 0.2, -r * 0.75); x.closePath(); break;
      case 'square': poly(4, Math.PI / 4, r * 1.15); break;
      case 'diamond': x.moveTo(r, 0); x.lineTo(0, r * 0.7); x.lineTo(-r, 0); x.lineTo(0, -r * 0.7); x.closePath(); break;
      case 'hex': poly(6, 0); break;
      case 'oct': poly(8, Math.PI / 8); break;
      case 'star': for (let i = 0; i < 16; i++) { const a = i * TAU / 16, rr = i % 2 ? r * 0.5 : r; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(rr, 0); } x.closePath(); break;
      // tvary nepřátel z 1.4 (všechny míří doprava, kreslí se jednou do spritu)
      case 'ring': x.arc(0, 0, r, 0, TAU); x.moveTo(r * 0.55, 0); x.arc(0, 0, r * 0.55, 0, TAU, true); break;
      case 'chevron': x.moveTo(r, 0); x.lineTo(-r * 0.45, r); x.lineTo(-r * 0.95, r * 0.6); x.lineTo(-r * 0.05, 0); x.lineTo(-r * 0.95, -r * 0.6); x.lineTo(-r * 0.45, -r); x.closePath(); break;
      case 'bolt': x.moveTo(r * 0.35, -r); x.lineTo(-r * 0.55, r * 0.1); x.lineTo(-r * 0.02, r * 0.1); x.lineTo(-r * 0.35, r); x.lineTo(r * 0.6, -r * 0.15); x.lineTo(r * 0.05, -r * 0.15); x.closePath(); break;
      case 'kite': x.moveTo(r * 1.25, 0); x.lineTo(-r * 0.1, r * 0.62); x.lineTo(-r * 0.85, 0); x.lineTo(-r * 0.1, -r * 0.62); x.closePath(); break;
      case 'drop': x.moveTo(r * 1.15, 0); x.arc(-r * 0.15, 0, r * 0.68, -Math.PI * 0.42, Math.PI * 0.42, true); x.closePath(); break;
      case 'crescent': x.arc(0, 0, r, Math.PI * 0.3, Math.PI * 1.7); x.arc(r * 0.45, 0, r * 0.72, Math.PI * 1.45, Math.PI * 0.55, true); x.closePath(); break;
      case 'star6': for (let i = 0; i < 12; i++) { const a = i * TAU / 12, rr = i % 2 ? r * 0.55 : r; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(rr, 0); } x.closePath(); break;
      case 'star5': for (let i = 0; i < 10; i++) { const a = i * TAU / 10 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); break;
      case 'spikeball': for (let i = 0; i < 20; i++) { const a = i * TAU / 20, rr = i % 2 ? r * 0.6 : r; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(rr, 0); } x.closePath(); break;
      case 'snow': for (let i = 0; i < 12; i++) { const a = i * TAU / 12, rr = i % 2 ? r * 0.3 : r; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(rr, 0); } x.closePath(); break;
      case 'spike4': for (let i = 0; i < 8; i++) { const a = i * TAU / 8, rr = i % 2 ? r * 0.36 : r; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(rr, 0); } x.closePath(); break;
      case 'gear': for (let i = 0; i < 32; i++) { const a = i * TAU / 32, rr = (i >> 1) % 2 ? r * 0.74 : r; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(rr, 0); } x.closePath(); break;
      case 'lens': x.moveTo(r * 1.1, 0); x.quadraticCurveTo(0, r * 1.05, -r * 1.1, 0); x.quadraticCurveTo(0, -r * 1.05, r * 1.1, 0); x.closePath(); break;
      case 'trefoil': for (let i = 0; i < 3; i++) { const a = i * TAU / 3, cx = Math.cos(a) * r * 0.45, cy = Math.sin(a) * r * 0.45; x.moveTo(cx + r * 0.55, cy); x.arc(cx, cy, r * 0.55, 0, TAU); } break;
      case 'clover': for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4, cx = Math.cos(a) * r * 0.42, cy = Math.sin(a) * r * 0.42; x.moveTo(cx + r * 0.5, cy); x.arc(cx, cy, r * 0.5, 0, TAU); } break;
      case 'hourglass': x.moveTo(-r * 0.85, -r); x.lineTo(r * 0.85, -r); x.lineTo(r * 0.12, 0); x.lineTo(r * 0.85, r); x.lineTo(-r * 0.85, r); x.lineTo(-r * 0.12, 0); x.closePath(); break;
      case 'pent': poly(5, -Math.PI / 2); break;
      case 'hept': poly(7, -Math.PI / 2); break;
      case 'cross': { const t = r * 0.36; x.moveTo(t, -r); x.lineTo(t, -t); x.lineTo(r, -t); x.lineTo(r, t); x.lineTo(t, t); x.lineTo(t, r); x.lineTo(-t, r); x.lineTo(-t, t); x.lineTo(-r, t); x.lineTo(-r, -t); x.lineTo(-t, -t); x.lineTo(-t, -r); x.closePath(); break; }
      case 'squircle': for (let i = 0; i < 24; i++) { const a = i * TAU / 24, c = Math.cos(a), s = Math.sin(a); const px = Math.sign(c) * Math.pow(Math.abs(c), 0.5) * r * 0.95, py = Math.sign(s) * Math.pow(Math.abs(s), 0.5) * r * 0.95; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); break;
      case 'blob': for (let i = 0; i < 20; i++) { const a = i * TAU / 20, rr = r * (0.86 + 0.14 * Math.sin(a * 5) + 0.06 * Math.cos(a * 3)); i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(rr, 0); } x.closePath(); break;
      case 'shield': x.moveTo(-r * 0.55, -r); x.arc(-r * 0.55, 0, r, -Math.PI / 2, Math.PI / 2); x.lineTo(-r * 0.75, r * 0.7); x.lineTo(-r * 0.75, -r * 0.7); x.closePath(); break;
      case 'saucer': x.ellipse(0, 0, r, r * 0.58, 0, 0, TAU); x.moveTo(r * 0.45, -r * 0.2); x.ellipse(0, -r * 0.2, r * 0.45, r * 0.38, 0, 0, TAU); break;
      case 'pinwheel': for (let i = 0; i < 4; i++) { const a = i * TAU / 4; x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); x.lineTo(Math.cos(a + 1.05) * r * 0.32, Math.sin(a + 1.05) * r * 0.32); } x.closePath(); break;
      case 'capsule': x.moveTo(r * 0.45, -r * 0.55); x.arc(r * 0.45, 0, r * 0.55, -Math.PI / 2, Math.PI / 2); x.lineTo(-r * 0.6, r * 0.55); x.arc(-r * 0.6, 0, r * 0.55, Math.PI / 2, Math.PI * 1.5); x.closePath(); break;
      case 'maw': x.moveTo(0, 0); x.arc(0, 0, r, 0.6, TAU - 0.6); x.closePath(); break;
      case 'trap': x.moveTo(r, -r * 0.42); x.lineTo(r, r * 0.42); x.lineTo(-r * 0.85, r); x.lineTo(-r * 0.85, -r); x.closePath(); break;
      // legendy (1.5): tvary pro kodex a těla; oči, ručičky a víčka jsou zvlášť v legendPart
      case 'eye': x.moveTo(r * 1.25, 0); x.quadraticCurveTo(0, r, -r * 1.25, 0); x.quadraticCurveTo(0, -r, r * 1.25, 0); x.closePath(); x.moveTo(r * 0.5, 0); x.arc(0, 0, r * 0.5, 0, TAU); break;
      case 'gmaw': x.moveTo(0, 0); x.arc(0, 0, r, 0.55, TAU - 0.55); x.closePath(); x.moveTo(r * 0.12, -r * 0.3); x.lineTo(r * 0.4, 0); x.lineTo(r * 0.12, r * 0.3); x.lineTo(-r * 0.14, 0); x.closePath(); break;
      case 'clock': x.arc(0, 0, r, 0, TAU); for (let i = 0; i < 12; i++) { const a = i * TAU / 12, r0 = i % 3 ? r * 0.8 : r * 0.64; x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); x.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92); } break;
      case 'comet': x.arc(r * 0.25, 0, r * 0.62, -Math.PI / 2, Math.PI / 2); x.lineTo(-r * 0.5, r * 0.45); x.lineTo(-r * 0.25, r * 0.2); x.lineTo(-r * 1.25, r * 0.32); x.lineTo(-r * 0.55, 0); x.lineTo(-r * 1.25, -r * 0.32); x.lineTo(-r * 0.25, -r * 0.2); x.lineTo(-r * 0.5, -r * 0.45); x.closePath(); break;
      case 'mship': { const k = r / 16; x.moveTo(20 * k, 0); x.lineTo(-4 * k, 6 * k); x.lineTo(-13 * k, 16 * k); x.lineTo(-10 * k, 4 * k); x.lineTo(-14 * k, 0); x.lineTo(-10 * k, -4 * k); x.lineTo(-13 * k, -16 * k); x.lineTo(-4 * k, -6 * k); x.closePath(); break; }
      case 'serpent': x.moveTo(r * 1.25, 0); x.lineTo(r * 0.5, r * 0.7); x.lineTo(-r * 0.7, r * 0.55); x.lineTo(-r, 0); x.lineTo(-r * 0.7, -r * 0.55); x.lineTo(r * 0.5, -r * 0.7); x.closePath(); x.moveTo(r * 0.6, -r * 0.3); x.arc(r * 0.48, -r * 0.3, r * 0.12, 0, TAU); x.moveTo(r * 0.6, r * 0.3); x.arc(r * 0.48, r * 0.3, r * 0.12, 0, TAU); break;
      case 'scale': poly(6, Math.PI / 6); break;
      default: x.arc(0, 0, r, 0, TAU);
    }
  }

  function canvasFor(halfWorld) {
    const c = makeCanvas(halfWorld * 2 * SPR, halfWorld * 2 * SPR);
    c.spr = SPR;
    const x = c.getContext('2d');
    x.scale(SPR, SPR); x.translate(halfWorld, halfWorld);
    c.hw = halfWorld;
    return [c, x];
  }

  function enemy(shape, r, color, white, elite) {
    return get(`e|${shape}|${r}|${color}|${white}|${elite}`, () => {
      const pad = 16 + (elite ? 10 : 0);
      const [c, x] = canvasFor(r + pad);
      x.lineJoin = 'round';
      const col = white ? '#ffffff' : color;
      if (elite) {
        x.shadowColor = '#ffd166'; x.shadowBlur = 18;
        path(x, shape, r + 6); x.strokeStyle = 'rgba(255,209,102,0.9)'; x.lineWidth = 2.5; x.stroke();
      }
      x.shadowColor = col; x.shadowBlur = 14;
      path(x, shape, r); x.fillStyle = white ? 'rgba(255,255,255,0.95)' : rgba(col, 0.16); x.fill();
      x.lineWidth = 2.6; x.strokeStyle = col; x.stroke();
      x.shadowBlur = 8; path(x, shape, r * 0.42); x.fillStyle = col; x.globalAlpha = white ? 1 : 0.85; x.fill();
      return c;
    });
  }

  // Části legend, které se kreslí přes tělo: bělmo, duhovka, zavřené víčko, ručička hodin.
  function legendPart(part, r, color) {
    return get(`lg|${part}|${r}|${color}`, () => {
      const [c, x] = canvasFor(r * 1.4 + 16);
      x.lineJoin = 'round'; x.lineCap = 'round';
      x.shadowColor = color; x.shadowBlur = 14;
      const lidY = t => 2 * (1 - t) * t * r * 0.5; // svislá výška víčka (kvadratická křivka)
      if (part === 'eye') {
        x.beginPath(); x.moveTo(r * 1.3, 0); x.quadraticCurveTo(0, r * 1.05, -r * 1.3, 0); x.quadraticCurveTo(0, -r * 1.05, r * 1.3, 0); x.closePath();
        x.fillStyle = rgba(color, 0.2); x.fill(); x.lineWidth = 3; x.strokeStyle = color; x.stroke();
      } else if (part === 'iris') {
        x.beginPath(); x.arc(0, 0, r * 0.42, 0, TAU); x.fillStyle = rgba(color, 0.6); x.fill(); x.lineWidth = 2.4; x.strokeStyle = '#ffffff'; x.stroke();
        x.shadowBlur = 4; x.beginPath(); x.arc(0, 0, r * 0.18, 0, TAU); x.fillStyle = '#05010f'; x.fill();
        x.beginPath(); x.arc(-r * 0.12, -r * 0.15, r * 0.07, 0, TAU); x.fillStyle = '#ffffff'; x.fill();
      } else if (part === 'lid') {
        x.beginPath(); x.moveTo(-r * 1.3, 0); x.quadraticCurveTo(0, r * 0.5, r * 1.3, 0); x.lineWidth = 3.2; x.strokeStyle = color; x.stroke();
        x.lineWidth = 2;
        for (let i = 1; i <= 5; i++) { const t = i / 6, px = (t * 2 - 1) * r * 1.3, py = lidY(t); x.beginPath(); x.moveTo(px, py); x.lineTo(px * 1.08, py + r * 0.28); x.stroke(); }
      } else if (part === 'hand') {
        x.beginPath(); x.moveTo(-r * 0.15, 0); x.lineTo(r, 0); x.lineWidth = 3; x.strokeStyle = color; x.stroke();
        x.beginPath(); x.arc(0, 0, 3.5, 0, TAU); x.fillStyle = '#ffffff'; x.fill();
      }
      return c;
    });
  }

  function boss(shape, r, color, white) {
    return get(`b|${shape}|${r}|${color}|${white}`, () => {
      const [c, x] = canvasFor(r + 34);
      const col = white ? '#ffffff' : color;
      x.lineJoin = 'round';
      x.shadowColor = col; x.shadowBlur = 30;
      path(x, shape, r); x.fillStyle = white ? 'rgba(255,255,255,0.9)' : rgba(col, 0.14); x.fill();
      x.lineWidth = 4; x.strokeStyle = col; x.stroke();
      x.shadowBlur = 12; x.lineWidth = 2;
      path(x, shape, r * 0.75); x.strokeStyle = rgba(col, 0.7); x.stroke();
      x.beginPath(); x.arc(0, 0, r + 14, 0, TAU); x.setLineDash([8, 12]); x.strokeStyle = rgba(col, 0.5); x.stroke();
      return c;
    });
  }
  function bossCore(shape, r, color) {
    return get(`bc|${shape}|${r}|${color}`, () => {
      const [c, x] = canvasFor(r + 20);
      x.shadowColor = color; x.shadowBlur = 20;
      path(x, shape === 'oct' ? 'square' : shape === 'square' ? 'diamond' : 'hex', r);
      x.fillStyle = rgba(color, 0.5); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();
      x.beginPath(); x.arc(0, 0, r * 0.35, 0, TAU); x.fillStyle = '#fff'; x.fill();
      return c;
    });
  }

  function drawShip(x, color) {
      x.lineJoin = 'round';
      x.shadowColor = color; x.shadowBlur = 16;
      x.beginPath();
      x.moveTo(20, 0); x.lineTo(-4, 6); x.lineTo(-13, 16); x.lineTo(-10, 4); x.lineTo(-14, 0); x.lineTo(-10, -4); x.lineTo(-13, -16); x.lineTo(-4, -6); x.closePath();
      x.fillStyle = rgba(color, 0.22); x.fill();
      x.lineWidth = 2.4; x.strokeStyle = color; x.stroke();
      x.shadowBlur = 10;
      x.beginPath(); x.moveTo(11, 0); x.lineTo(-2, 3.5); x.lineTo(-2, -3.5); x.closePath();
      x.fillStyle = '#ffffff'; x.fill();
  }
  function ship(color) {
    return get(`ship|${color}`, () => { const [c, x] = canvasFor(34); drawShip(x, color); return c; });
  }

  // Výbuch předkreslený jednou: kreslit radiální přechod v každém snímku pro desítky výbuchů naráz
  // stálo v pozdní hře skoro polovinu času snímku.
  function boom(color) {
    return get(`b|${color}`, () => {
      const [c, x] = canvasFor(64);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 64);
      g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(0.4, rgba(color, 0.5)); g.addColorStop(1, rgba(color, 0));
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, 64, 0, TAU); x.fill();
      return c;
    });
  }
  function glow(color, r) {
    return get(`g|${color}|${r}`, () => {
      const [c, x] = canvasFor(r * 2.6);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, r * 2.6);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.22, rgba(color, 0.95));
      g.addColorStop(0.45, rgba(color, 0.35));
      g.addColorStop(1, rgba(color, 0));
      x.fillStyle = g; x.fillRect(-r * 2.6, -r * 2.6, r * 5.2, r * 5.2);
      return c;
    });
  }

  function blade(color, k) {
    return get(`bl|${color}|${k}`, () => {
      const r = 13 * k;
      const [c, x] = canvasFor(r + 14);
      x.shadowColor = color; x.shadowBlur = 14;
      x.beginPath(); x.moveTo(0, -r); x.lineTo(r * 0.38, 0); x.lineTo(0, r); x.lineTo(-r * 0.38, 0); x.closePath();
      x.fillStyle = rgba(color, 0.35); x.fill(); x.strokeStyle = color; x.lineWidth = 2; x.stroke();
      x.beginPath(); x.moveTo(0, -r * 0.6); x.lineTo(r * 0.12, 0); x.lineTo(0, r * 0.6); x.lineTo(-r * 0.12, 0); x.closePath();
      x.fillStyle = '#fff'; x.fill();
      return c;
    });
  }

  // Krystal: kosočtverec, slitý shluk (dva krystaly), šestiboký krystal nebo hvězda (čím víc jich splynulo).
  function crystalPath(x, r, shape) {
    x.beginPath();
    if (shape === 'h') for (let i = 0; i < 6; i++) { const a = i * TAU / 6 - Math.PI / 2, q = i % 3 === 0 ? 1 : 0.82; x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * q, Math.sin(a) * r); }
    else if (shape === 's') for (let i = 0; i < 10; i++) { const a = i * TAU / 10 - Math.PI / 2, q = i % 2 ? 0.45 : 1; x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * q, Math.sin(a) * r * q); }
    else { x.moveTo(0, -r); x.lineTo(r * 0.7, 0); x.lineTo(0, r); x.lineTo(-r * 0.7, 0); }
    x.closePath();
  }
  function gem(color, r, shape = 'd') {
    return get(`gem|${color}|${r}|${shape}`, () => {
      const [c, x] = canvasFor(r + 12);
      x.shadowColor = color; x.shadowBlur = shape === 'd' ? 10 : 14;
      if (shape === 'c') {
        // shluk: menší krystal za větším, mírně natočený
        x.save(); x.translate(-r * 0.45, r * 0.15); x.rotate(-0.5); crystalPath(x, r * 0.7, 'd');
        x.fillStyle = rgba(color, 0.4); x.fill(); x.strokeStyle = color; x.lineWidth = 1.4; x.stroke(); x.restore();
        x.save(); x.translate(r * 0.2, 0); crystalPath(x, r, 'd');
      } else { x.save(); crystalPath(x, r, shape); }
      x.fillStyle = rgba(color, 0.55); x.fill(); x.strokeStyle = color; x.lineWidth = 1.6; x.stroke();
      x.beginPath(); x.moveTo(0, -r * 0.5); x.lineTo(r * 0.3, 0); x.lineTo(0, r * 0.1); x.closePath();
      x.fillStyle = 'rgba(255,255,255,0.85)'; x.fill();
      x.restore();
      return c;
    });
  }
  // Střep podle toho, kolik jich splynulo: fialový kosočtverec, dvojitý, šestiboký, zlatá hvězda.
  function shard(tier) {
    return get(`shard|${tier}`, () => {
      const col = ['#e08bff', '#b47bff', '#ff7ae6', '#ffe08a'][tier], r = [11, 12, 13.5, 15][tier];
      const [c, x] = canvasFor(r + 14);
      x.lineJoin = 'round'; x.shadowColor = col; x.shadowBlur = 14 + tier * 3; x.strokeStyle = col; x.lineWidth = 2.4; x.fillStyle = rgba(col, 0.3);
      if (tier === 0 || tier === 1) {
        if (tier === 1) { x.save(); x.translate(-5, 2); x.rotate(-0.45); x.beginPath(); x.moveTo(0, -8); x.lineTo(5, -1.5); x.lineTo(0, 8); x.lineTo(-5, -1.5); x.closePath(); x.fill(); x.stroke(); x.restore(); x.translate(3, 0); }
        x.beginPath(); x.moveTo(0, -r); x.lineTo(r * 0.64, -2); x.lineTo(0, r); x.lineTo(-r * 0.64, -2); x.closePath(); x.fill(); x.stroke();
        x.beginPath(); x.moveTo(-r * 0.64, -2); x.lineTo(r * 0.64, -2); x.stroke();
      } else {
        crystalPath(x, r, tier === 2 ? 'h' : 's'); x.fillStyle = rgba(col, 0.38); x.fill(); x.stroke();
        x.fillStyle = 'rgba(255,255,255,0.8)'; x.beginPath(); x.arc(0, 0, r * 0.22, 0, TAU); x.fill();
      }
      return c;
    });
  }

  function pickup(kind) {
    return get(`pk|${kind}`, () => {
      const [c, x] = canvasFor(30);
      x.lineJoin = 'round'; x.lineCap = 'round';
      const col = { shard: '#e08bff', heart: '#ff3d6e', magnet: '#55c8ff', bomb: '#ff5a5a', chest: '#ffd166' }[kind];
      x.shadowColor = col; x.shadowBlur = 14; x.strokeStyle = col; x.lineWidth = 2.4; x.fillStyle = rgba(col, 0.3);
      if (kind === 'shard') {
        x.beginPath(); x.moveTo(0, -11); x.lineTo(7, -2); x.lineTo(0, 11); x.lineTo(-7, -2); x.closePath(); x.fill(); x.stroke();
        x.beginPath(); x.moveTo(-7, -2); x.lineTo(7, -2); x.stroke();
      } else if (kind === 'heart') {
        // Plné srdce v barvě ukazatele zdraví s bílým lemem a odleskem: nepřátelé jsou duté
        // geometrické obrysy s jádrem, tohle má vypadat jako předmět, ne jako loď.
        const heart = () => {
          x.beginPath(); x.moveTo(0, 11);
          x.bezierCurveTo(-4, 7.5, -13, 2.5, -13, -4); x.bezierCurveTo(-13, -10.5, -5.5, -13, 0, -6.5);
          x.bezierCurveTo(5.5, -13, 13, -10.5, 13, -4); x.bezierCurveTo(13, 2.5, 4, 7.5, 0, 11); x.closePath();
        };
        const g = x.createLinearGradient(0, -12, 0, 11); g.addColorStop(0, '#ff8fab'); g.addColorStop(1, '#ff2d60');
        x.shadowBlur = 16; heart(); x.fillStyle = g; x.fill();
        x.shadowBlur = 0; x.lineWidth = 2.2; x.strokeStyle = '#ffffff'; x.stroke();
        x.fillStyle = 'rgba(255,255,255,0.85)'; x.beginPath(); x.ellipse(-6, -6, 3, 1.9, -0.7, 0, TAU); x.fill();
      } else if (kind === 'magnet') {
        x.beginPath(); x.arc(0, 2, 8, 0, Math.PI); x.moveTo(-8, 2); x.lineTo(-8, -9); x.moveTo(8, 2); x.lineTo(8, -9); x.lineWidth = 5; x.stroke();
        x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.moveTo(-8, -9); x.lineTo(-8, -5); x.moveTo(8, -9); x.lineTo(8, -5); x.stroke();
      } else if (kind === 'bomb') {
        x.beginPath(); x.arc(0, 2, 9, 0, TAU); x.fill(); x.stroke();
        x.beginPath(); x.moveTo(5, -5); x.lineTo(9, -11); x.stroke();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(9, -12, 2.5, 0, TAU); x.fill();
      } else if (kind === 'chest') {
        x.lineWidth = 2.6;
        x.beginPath(); x.rect(-14, -6, 28, 18); x.fill(); x.stroke();
        x.beginPath(); x.moveTo(-14, -6); x.lineTo(-10, -14); x.lineTo(10, -14); x.lineTo(14, -6); x.stroke();
        x.fillStyle = '#fff'; x.fillRect(-3, -2, 6, 7);
      }
      return c;
    });
  }

  // ── Sprity efektů, které se dřív kreslily gradientem nebo cestou v každém snímku ──
  // radiální přechod v kruhu o poloměru R (ve světě); stops = [[poloha, barva], …]
  // (square: vyplní celý čtverec, za poloměrem zůstane poslední barva – maska tmy)
  function radial(key, stops, R = 128, square = false) {
    return get(`rad|${key}`, () => {
      const [c, x] = canvasFor(R);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, R);
      for (const [o, col] of stops) g.addColorStop(o, col);
      x.fillStyle = g;
      if (square) x.fillRect(-R, -R, R * 2, R * 2); else { x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fill(); }
      return c;
    });
  }
  // černá díra Singularity (kreslí se s průhledností podle doby trvání)
  const hole = color => radial(`hole|${color}`, [[0, 'rgba(0,0,0,0.95)'], [0.25, 'rgba(10,0,25,0.85)'], [0.5, rgba(color, 0.18)], [1, rgba(color, 0)]]);
  // oblouk o poloměru R a délce span (rad) od úhlu 0; otáčí se celým spritem
  function arcLine(color, R, lw, span, alpha = 1) {
    return get(`arc|${color}|${R}|${lw}|${span}|${alpha}`, () => {
      const [c, x] = canvasFor(R + lw);
      x.strokeStyle = rgba(color, alpha); x.lineWidth = lw; x.lineCap = 'round';
      x.beginPath(); x.arc(0, 0, R, 0, span); x.stroke();
      return c;
    });
  }
  // čárkovaný kruh (zaměřovač úderu, okraj pole); posun čárek = otočení spritu
  function dashRing(color, R, lw, dash, gap, alpha = 1) {
    return get(`dring|${color}|${R}|${lw}|${dash}|${gap}|${alpha}`, () => {
      const [c, x] = canvasFor(R + lw);
      x.strokeStyle = rgba(color, alpha); x.lineWidth = lw; x.setLineDash([dash, gap]);
      x.beginPath(); x.arc(0, 0, R, 0, TAU); x.stroke();
      return c;
    });
  }
  // mina: šestiúhelník (při aktivaci slabší), aktivní mina blikající tečkou uprostřed
  function mine(color, state) {
    return get(`mine|${color}|${state}`, () => {
      const [c, x] = canvasFor(12);
      x.strokeStyle = rgba(color, state ? 0.8 : 0.35); x.lineWidth = 2; x.lineJoin = 'round';
      x.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 9, Math.sin(a) * 9); }
      x.closePath(); x.stroke();
      if (state === 2) { x.fillStyle = color; x.beginPath(); x.arc(0, 0, 3, 0, TAU); x.fill(); }
      return c;
    });
  }
  // dron Strážních dronů (míří doprava)
  function drone(color) {
    return get(`drone|${color}`, () => {
      const [c, x] = canvasFor(12);
      x.lineWidth = 1.6; x.strokeStyle = color; x.fillStyle = 'rgba(10,20,30,0.85)'; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(9, 0); x.lineTo(0, 6); x.lineTo(-5, 0); x.lineTo(0, -6); x.closePath(); x.fill(); x.stroke();
      return c;
    });
  }
  // kužel plamene (Plazmový hořák, Kometa): výseč s přechodem, špička ve středu spritu, míří doprava
  function cone(color, arc) {
    arc = Math.round(arc * 20) / 20;
    return get(`cone|${color}|${arc}`, () => {
      const R = 128, [c, x] = canvasFor(R);
      const g = x.createRadialGradient(0, 0, 6, 0, 0, R);
      g.addColorStop(0, 'rgba(255,248,220,0.75)'); g.addColorStop(0.35, rgba(color, 0.42)); g.addColorStop(1, rgba(color, 0));
      x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, -arc / 2, arc / 2); x.closePath(); x.fill();
      return c;
    });
  }
  // paprsek jako pruh 256 × 64 (natahuje se na délku a šířku): fade = slábne ke konci
  function beam(color, fade) {
    return get(`beam|${color}|${fade}`, () => {
      const c = makeCanvas(256, 64), x = c.getContext('2d');
      const outer = x.createLinearGradient(0, 0, 256, 0), inner = x.createLinearGradient(0, 0, 256, 0);
      outer.addColorStop(0, rgba(color, fade ? 0.5 : 0.45)); outer.addColorStop(1, rgba(color, fade ? 0 : 0.45));
      inner.addColorStop(0, 'rgba(255,255,255,0.95)'); inner.addColorStop(1, `rgba(255,255,255,${fade ? 0 : 0.95})`);
      x.fillStyle = outer; x.fillRect(0, 0, 256, 64);
      x.fillStyle = inner; x.fillRect(0, 32 - 6.5, 256, 13);
      return c;
    });
  }
  // ukazatel mimo obrazovku se září (dřív shadowBlur v každém snímku)
  function pointer(color, sz) {
    return get(`ptr|${color}|${sz}`, () => {
      const [c, x] = canvasFor(sz + 14);
      x.fillStyle = color; x.shadowColor = color; x.shadowBlur = 12;
      x.beginPath(); x.moveTo(sz, 0); x.lineTo(-sz * 0.6, sz * 0.7); x.lineTo(-sz * 0.6, -sz * 0.7); x.closePath(); x.fill();
      return c;
    });
  }

  return { enemy, legendPart, boss, bossCore, ship, drawShip, glow, boom, blade, gem, shard, pickup, path, radial, hole, arcLine, dashRing, mine, drone, cone, beam, pointer, setScale, clear: () => cache.clear() };
})();

// ── Renderer ────────────────────────────────────────────────────────────────
const Render = (() => {
  let cv, ctx, W = 1280, H = 720, dpr = 1, zoom = 1, k = 1, ox = 0, oy = 0;
  let bg = null, bgKey = '', vign = null, dangerV = null, stars = [];
  // Rozlišení vykreslování: canvas se kreslí v menším rozlišení a prohlížeč ho roztáhne (MDN: menší
  // canvas zvětšit je levnější než velký zmenšovat). Auto drží rozpočet ~2,3 Mpx (zhruba 2048 × 1120)
  // a když hra dlouho nestíhá (průměr snímku nad 26 ms), ubere v běhu ještě po 10 % (nejvýš o 30 %).
  const PX_BUDGET = 2.3e6;
  let drop = 0, scale = 1, dirty = true;
  const QUALITY = { high: 1, low: 0.7 };
  const GEM_COL = v => v < 2.5 ? ['#4cc9f0', 5] : v < 8 ? ['#06ffa5', 6] : v < 30 ? ['#ff4fd8', 7.5] : v < 120 ? ['#ffd166', 9.5] : v < 500 ? ['#ff8a5c', 10.5] : ['#ffffff', 11.5];
  // tvar podle počtu slitých krystalů (a střepů)
  const GEM_SHAPE = n => (n >= 20 ? 's' : n >= 6 ? 'h' : n >= 2 ? 'c' : 'd');
  const SHARD_TIER = n => (n >= 20 ? 3 : n >= 6 ? 2 : n >= 2 ? 1 : 0);

  function init(canvas) {
    // alpha: false: canvas je vždy celý zakrytý pozadím, prohlížeč ho pak skládá jako neprůhledný
    cv = canvas; ctx = cv.getContext('2d', { alpha: false });
    // hvězdné dlaždice pro paralaxu
    for (let l = 0; l < 3; l++) {
      const c = makeCanvas(512, 512), x = c.getContext('2d');
      const n = [140, 60, 26][l];
      for (let i = 0; i < n; i++) {
        const s = [0.6, 1.1, 1.8][l] * rand(0.6, 1.3), a = rand(0.25, 0.9) * [0.5, 0.7, 1][l];
        x.fillStyle = `rgba(${randi(200, 255)},${randi(200, 255)},255,${a})`;
        x.beginPath(); x.arc(rand(0, 512), rand(0, 512), s, 0, TAU); x.fill();
      }
      stars.push(c);
    }
    resize();
  }

  function resize() {
    const dpr0 = Math.min(window.devicePixelRatio || 1, 1.75);
    W = window.innerWidth; H = window.innerHeight;
    const q = SAVE.settings.quality || 'auto';
    scale = QUALITY[q] || clamp(Math.sqrt(PX_BUDGET / (W * H * dpr0 * dpr0)), 0.55, 1) - drop;
    scale = clamp(scale, 0.5, 1);
    dpr = dpr0 * scale;
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
    zoom = clamp(Math.min(W, H) / 800, 0.6, 1.2);
    if (W < 700) zoom = clamp(Math.min(W, H) / 640, 0.5, 1);
    G.viewW = W / zoom; G.viewH = H / zoom; G.viewR = Math.hypot(G.viewW, G.viewH) / 2;
    Sprites.setScale(dpr * zoom);
    bgKey = ''; dirty = true;
    PerfLog.ev('resize', [W, H, Math.round(dpr * 1000) / 1000, Math.round(zoom * 1000) / 1000, Math.round(scale * 100) / 100]);
    vign = makeCanvas(W, H);
    const v = vign.getContext('2d');
    const g = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
    v.fillStyle = g; v.fillRect(0, 0, W, H);
    // červená vinětace při zásahu a nízkém zdraví (kreslí se s průhledností, dřív gradient v každém snímku)
    dangerV = makeCanvas(W / 2, H / 2);
    const dv = dangerV.getContext('2d'), w2 = W / 2, h2 = H / 2;
    const dg = dv.createRadialGradient(w2 / 2, h2 / 2, Math.min(w2, h2) * 0.3, w2 / 2, h2 / 2, Math.hypot(w2, h2) * 0.55);
    dg.addColorStop(0, 'rgba(255,0,40,0)'); dg.addColorStop(1, 'rgba(255,0,40,1)');
    dv.fillStyle = dg; dv.fillRect(0, 0, w2, h2);
  }
  // Automatická kvalita: když hra dlouho nestíhá, ubere rozlišení (jen v Auto, nejvýš o 30 %).
  function degrade() {
    if ((SAVE.settings.quality || 'auto') !== 'auto' || drop >= 0.3 || scale <= 0.55) return false;
    drop = Math.round((drop + 0.1) * 10) / 10;
    resize();
    PerfLog.ev('quality', Math.round(scale * 100) / 100);
    return true;
  }
  function resetQuality() { if (drop) { drop = 0; resize(); } }
  // kreslení na obrazovku podél úsečky: sprite (natažený) od bodu x,y pod úhlem a
  function sprLine(img, x, y, a, len, thick, alpha = 1) {
    sprN++;
    const c = Math.cos(a) * k, s = Math.sin(a) * k;
    ctx.setTransform(c, s, -s, c, ox + x * k, oy + y * k);
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(img, 0, -thick / 2, len, thick);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  function buildBg(sec) {
    const key = sec.id + W + 'x' + H;
    if (bgKey === key) return;
    bgKey = key;
    bg = makeCanvas(W, H);
    const x = bg.getContext('2d');
    const g = x.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H / 2, Math.hypot(W, H) * 0.7);
    g.addColorStop(0, sec.bg[0]); g.addColorStop(1, sec.bg[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // mlhoviny
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const cx = rnd() * W, cy = rnd() * H, r = (0.25 + rnd() * 0.45) * Math.max(W, H);
      const col = sec.neb[i % sec.neb.length];
      const ng = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      ng.addColorStop(0, rgba(col, 0.13)); ng.addColorStop(0.5, rgba(col, 0.045)); ng.addColorStop(1, rgba(col, 0));
      x.fillStyle = ng; x.fillRect(0, 0, W, H);
    }
    x.globalCompositeOperation = 'source-over';
  }

  // nastaví transformaci světa
  function world() { ctx.setTransform(k, 0, 0, k, ox, oy); }
  let sprN = 0; // vykreslené sprity za snímek (záznam výkonu)
  function spr(img, x, y, a, sc = 1, alpha = 1) {
    sprN++;
    const c = Math.cos(a) * sc * k, s = Math.sin(a) * sc * k;
    ctx.setTransform(c, s, -s, c, ox + x * k, oy + y * k);
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(img, -img.hw, -img.hw, img.hw * 2, img.hw * 2);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }
  function sprStretch(img, x, y, a, sx, sy, alpha = 1) {
    sprN++;
    const c = Math.cos(a) * k, s = Math.sin(a) * k;
    ctx.setTransform(c * sx, s * sx, -s * sy, c * sy, ox + x * k, oy + y * k);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, -img.hw, -img.hw, img.hw * 2, img.hw * 2);
    ctx.globalAlpha = 1;
  }

  function frame(sector, camX, camY, shake, extra) {
    buildBg(sector);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bg, 0, 0, cv.width, cv.height);
    // hvězdy
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fac = [0.08, 0.2, 0.42];
    for (let l = 0; l < 3; l++) {
      const t = stars[l];
      const offx = ((-camX * fac[l]) % 512 + 512) % 512 - 512, offy = ((-camY * fac[l]) % 512 + 512) % 512 - 512;
      for (let x = offx; x < W; x += 512) for (let y = offy; y < H; y += 512) ctx.drawImage(t, x, y);
    }
    const shx = shake ? rand(-shake, shake) : 0, shy = shake ? rand(-shake, shake) : 0;
    k = dpr * zoom;
    ox = dpr * (W / 2 + shx) - camX * k;
    oy = dpr * (H / 2 + shy) - camY * k;
    // mřížka
    world();
    const vw = W / zoom / 2 + 40, vh = H / zoom / 2 + 40, step = 110;
    const x0 = Math.floor((camX - vw) / step) * step, x1 = camX + vw, y0 = Math.floor((camY - vh) / step) * step, y1 = camY + vh;
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = rgba(sector.grid, 0.07 + (extra || 0) * 0.15);
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = y0; y <= y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    ctx.fillStyle = rgba(sector.grid, 0.35);
    for (let x = x0; x <= x1; x += step * 4) for (let y = y0; y <= y1; y += step * 4) ctx.fillRect(x - 2, y - 2, 4, 4);
  }

  // srdce, magnety a bomby před zmizením blikají
  const fading = pk => (pk.t > PICKUP_LIFE - 6 && (pk.t * 6) % 1 < 0.45 ? 0.3 : 1);
  const inView = (x, y, r) => Math.abs(x - G.cam.x) < G.viewW / 2 + r + 30 && Math.abs(y - G.cam.y) < G.viewH / 2 + r + 30;

  function drawGame() {
    const p = G.p, sec = G.sector;
    sprN = 0;
    let pt = PerfLog.t();
    frame(sec, G.cam.x, G.cam.y, G.shake * 0.45, G.flash * 0.6);
    pt = PerfLog.lap('d.bg', pt);

    // efekty pod entitami
    world();
    let mines = 0;
    for (const f of G.effects) {
      if (f.k === 'mine') { mines++; continue; }
      if (f.k === 'hole') {
        if (!inView(f.x, f.y, f.r)) continue;
        const t = f.t || 0, fade = Math.min(1, t * 4, f.life * 2);
        spr(Sprites.hole(f.color), f.x, f.y, 0, f.r / 128, fade);
        const arc = Sprites.arcLine(f.color, 100, 2.5, 2.2, 0.8);
        for (let i = 0; i < 3; i++) spr(arc, f.x, f.y, t * (3 + i) + i * 2, f.r * (0.22 + i * 0.06) / 100, fade);
      } else if (f.k === 'tele') {
        world();
        const a = 0.25 + 0.35 * ((f.life * 8) % 1);
        ctx.strokeStyle = rgba(f.color, a); ctx.lineWidth = f.w;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(f.a) * f.len, f.y + Math.sin(f.a) * f.len); ctx.stroke();
      } else if (f.k === 'strike') {
        // zaměřovací kruh se stahuje, shora padá stopa střely
        if (f.t < 0 || !inView(f.x, f.y, f.r + 300)) continue;
        world();
        const q = clamp(f.t / f.delay, 0, 1);
        spr(Sprites.dashRing(f.color, 64, 2, 7, 7), f.x, f.y, f.t * 60 / Math.max(20, f.r), f.r / 64, 0.25 + 0.5 * q);
        world();
        ctx.fillStyle = rgba(f.color, 0.08 + 0.12 * q);
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - q * 0.85), 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        const hx = f.x + 260 * (1 - q), hy = f.y - 520 * (1 - q);
        ctx.strokeStyle = rgba(f.color, 0.55); ctx.lineWidth = 7 * q + 2;
        ctx.beginPath(); ctx.moveTo(hx + 50, hy - 100); ctx.lineTo(hx, hy); ctx.stroke();
        spr(Sprites.glow('#ffffff', 10), hx, hy, 0, 0.6 + q * 0.6, 0.9);
        ctx.globalCompositeOperation = 'source-over';
      } else if (f.k === 'efire') {
        // hořící stopa Žhavce (nepřátelská: bez prolínání, ať je odlišná od plamenů hráče)
        if (!inView(f.x, f.y, f.r)) continue;
        const a = Math.min(1, f.life / f.max * 1.8);
        spr(Sprites.boom(f.color), f.x, f.y, 0, f.r * (0.8 + 0.2 * a) / 64 * 1.3, 0.75 * a);
      } else if (f.k === 'eburst') {
        if (!inView(f.x, f.y, 40)) continue;
        const q = clamp(f.t / f.delay, 0, 1);
        spr(Sprites.dashRing(f.color, 32, 2.5, 5, 5, 0.9), f.x, f.y, f.t * 8, 1.4 - q * 0.9, 0.5 + 0.5 * q);
      } else if (f.k === 'eshell') {
        // granát Minometu: kruh dopadu se plní, granát letí obloukem
        if (!inView(f.x, f.y, f.r + 400)) continue;
        const q = clamp(f.t / f.delay, 0, 1);
        spr(Sprites.dashRing('#ff4d5e', 64, 2.5, 8, 6), f.x, f.y, f.t * 2, f.r / 64, 0.45 + 0.5 * q);
        spr(Sprites.radial('shell', [[0, 'rgba(255,77,94,0.32)'], [0.85, 'rgba(255,77,94,0.18)'], [1, 'rgba(255,77,94,0)']], 64), f.x, f.y, 0, f.r * q / 64, 1);
        const hx = lerp(f.sx, f.x, q), hy = lerp(f.sy, f.y, q) - Math.sin(q * Math.PI) * 220;
        ctx.globalCompositeOperation = 'lighter';
        spr(Sprites.glow(f.color, 8), hx, hy, 0, 1, 0.95);
        ctx.globalCompositeOperation = 'source-over';
      } else if (f.k === 'flame') {
        if (!inView(f.x, f.y, f.r)) continue;
        const a = Math.min(1, f.life / f.max * 1.6), rr = f.r * (0.75 + 0.25 * a);
        ctx.globalCompositeOperation = 'lighter';
        spr(Sprites.boom(f.color), f.x, f.y, 0, rr / 64, 0.8 * a);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // miny najednou a v jednom režimu prolínání (dřív každá vlastní cesta a přepnutí režimu)
    if (mines) {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of G.effects) {
        if (f.k !== 'mine' || !inView(f.x, f.y, 12)) continue;
        const blink = (f.t * (f.life < 1.5 ? 10 : 3)) % 1 < 0.5;
        spr(Sprites.mine(f.color, f.arm > 0 ? 0 : blink ? 2 : 1), f.x, f.y, f.t || 0, 1);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    pt = PerfLog.lap('d.under', pt);
    // anomálie: černá díra a varovné čáry meteoritů (pod předměty a nepřáteli)
    if (G.well) drawWell(G.well);
    if (G.zone) drawZone(G.zone);
    if (G.meteors) for (const m of G.meteors) if (m.warn > 0) {
      world();
      const q = 1 - m.warn / 1.3, pulse = 0.35 + 0.35 * ((m.warn * 6) % 1);
      ctx.strokeStyle = `rgba(255,90,40,${(0.18 + 0.4 * q) * pulse * 2})`; ctx.lineWidth = m.r * 2 * (0.4 + 0.6 * q);
      ctx.setLineDash([26, 18]); ctx.lineDashOffset = -G.time * 220;
      ctx.beginPath(); ctx.moveTo(m.sx, m.sy); ctx.lineTo(m.sx + Math.cos(m.a) * m.len, m.sy + Math.sin(m.a) * m.len); ctx.stroke();
      ctx.setLineDash([]);
    }

    pt = PerfLog.lap('d.anomaly', pt);
    // předměty
    for (const pk of G.pickups) {
      if (!inView(pk.x, pk.y, 20)) continue;
      const bob = Math.sin(pk.t * 4) * 2;
      if (pk.kind === 'gem') { const [c, r] = GEM_COL(pk.val); spr(Sprites.gem(c, r, GEM_SHAPE(pk.n || 1)), pk.x, pk.y + bob, 0); }
      else if (pk.kind === 'shard') spr(Sprites.shard(SHARD_TIER(pk.n || 1)), pk.x, pk.y + bob, 0);
      else if (pk.kind === 'chest') {
        ctx.globalCompositeOperation = 'lighter';
        spr(Sprites.glow('#ffd166', 16), pk.x, pk.y, 0, 1 + Math.sin(pk.t * 5) * 0.15, 0.5);
        ctx.globalCompositeOperation = 'source-over';
        spr(Sprites.pickup('chest'), pk.x, pk.y + bob * 2, Math.sin(pk.t * 2) * 0.1, 1.1);
      } else if (pk.kind === 'heart') {
        // tep: dvojitý úder a slabý kruh, který se od srdce rozbíhá
        const b = (pk.t % 1.2) / 1.2, pulse = q => Math.exp(-(((b - q) / 0.05) ** 2));
        world(); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,143,171,${(0.55 * (1 - b)).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 15 + b * 22, 0, TAU); ctx.stroke();
        spr(Sprites.pickup('heart'), pk.x, pk.y + bob, 0, 1 + 0.16 * pulse(0.05) + 0.1 * pulse(0.22), fading(pk));
      } else spr(Sprites.pickup(pk.kind), pk.x, pk.y + bob, 0, 1, fading(pk));
    }

    pt = PerfLog.lap('d.pickups', pt);
    // nepřátelé
    for (const e of G.enemies) {
      if (!inView(e.x, e.y, e.r + 20)) continue;
      if (e.boss) {
        const s = e.boss.phase > 1 ? 1 + Math.sin(G.time * 10) * 0.03 : 1;
        spr(Sprites.boss(e.d.shape, e.r, e.color, false), e.x, e.y, e.rot, s);
        spr(Sprites.bossCore(e.d.shape, e.r * 0.42, e.color), e.x, e.y, -e.rot * 2.5, s);
        if (e.flash > 0) spr(Sprites.boss(e.d.shape, e.r, e.color, true), e.x, e.y, e.rot, s, Math.min(1, e.flash * 8));
        continue;
      }
      if (e.legend) { drawLegend(e, e.d); continue; }
      const spawnIn = Math.min(1, e.t * 4), d = e.d, sc = e.r / d.r;
      // průhlednost: Stín je vidět jen zblízka (nebo chvíli po zásahu), Fázovač při průchodu
      let al = 1;
      if (d.cloak && !(e.revealT > G.time)) al = clamp((300 - Math.hypot(e.x - p.x, e.y - p.y)) / 140, 0.07, 1);
      else if (e.phased) al = 0.22;
      if (d.ai) drawFoeUnder(e, d);
      spr(Sprites.enemy(d.shape, d.r, e.color, false, e.elite), e.x, e.y, e.rot, sc * spawnIn, al);
      if (e.flash > 0) spr(Sprites.enemy(d.shape, d.r, e.color, true, e.elite), e.x, e.y, e.rot, sc, Math.min(1, e.flash * 12) * al);
      if (d.ai) drawFoeOver(e, d);
      if (e.d.dash && e.st === 1) {
        world();
        ctx.strokeStyle = rgba(e.color, 0.35); ctx.lineWidth = e.r;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.ang) * 240, e.y + Math.sin(e.ang) * 240); ctx.stroke();
      }
      if (e.elite) {
        world();
        const w = e.r * 2, fr = e.hp / e.maxHp;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2, e.y + e.r + 8, w, 4);
        ctx.fillStyle = '#ffd166'; ctx.fillRect(e.x - w / 2, e.y + e.r + 8, w * fr, 4);
      }
    }

    // Debug: kruhy zásahů (nepřátelé červeně, střely žlutě, loď a dosah sběru tyrkysově)
    if (Debug.hit) {
      world(); ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,60,80,0.9)'; ctx.beginPath();
      for (const e of G.enemies) if (!e.dead && inView(e.x, e.y, e.r)) { ctx.moveTo(e.x + e.r, e.y); ctx.arc(e.x, e.y, e.r, 0, TAU); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,60,0.9)'; ctx.beginPath();
      for (const b of G.ebullets) if (inView(b.x, b.y, b.r)) { const r = b.r * 0.8; ctx.moveTo(b.x + r, b.y); ctx.arc(b.x, b.y, r, 0, TAU); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(85,246,255,0.95)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(85,246,255,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, G.st.magnet, 0, TAU); ctx.stroke();
    }
    pt = PerfLog.lap('d.enemies', pt);
    // zbraně s vlastním vykreslením
    for (const w of G.weapons) { const b = WB[w.id]; if (b && b.draw) { const wt = PerfLog.t(); b.draw(w, ctx); PerfLog.lapW(w.id, 1, wt); } }
    pt = PerfLog.lap('d.weapons', pt);

    // hráč
    if (G.state !== 'dying' && G.state !== 'over') {
      const blink = p.inv > 0 && p.dashT <= 0 && (p.inv * 14) % 1 < 0.45;
      ctx.globalCompositeOperation = 'lighter';
      spr(Sprites.glow(G.pilot.color, 14), p.x, p.y, 0, 1, 0.35);
      ctx.globalCompositeOperation = 'source-over';
      spr(Sprites.ship(G.pilot.color), p.x, p.y, p.face, 1, blink ? 0.35 : 1);
      // magnetický dosah – jemný kruh
      world();
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, G.st.magnet, 0, TAU); ctx.stroke();
    }

    pt = PerfLog.lap('d.player', pt);
    // střely
    ctx.globalCompositeOperation = 'lighter';
    // hodně střel naráz: menší záře (stejné střely, méně překreslených pixelů)
    const bulletGlow = G.bullets.length > 120 ? 0.7 : 1;
    for (const b of G.bullets) {
      if (!inView(b.x, b.y, 20)) continue;
      const a = Math.atan2(b.vy, b.vx);
      sprStretch(Sprites.glow(b.color, bulletGlow === 1 ? b.r : Math.round(b.r * bulletGlow * 2) / 2), b.x, b.y, a, b.kind === 'missile' ? 1.6 : 2.2, 1);
    }
    for (const b of G.ebullets) {
      if (!inView(b.x, b.y, 20)) continue;
      spr(Sprites.glow(b.color, b.r), b.x, b.y, 0, 1 + Math.sin(G.time * 20 + b.x) * 0.08);
    }

    pt = PerfLog.lap('d.bullets', pt);
    // efekty nad entitami
    world();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const f of G.effects) {
      if (f.k === 'ring') {
        if (f.delay > 0 || !inView(f.x, f.y, f.r + 30)) continue;
        const t = f.r / f.maxR, a = 1 - t;
        ctx.strokeStyle = rgba(f.color, a * 0.85); ctx.lineWidth = (f.thick || 6) * (1 - t * 0.5);
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = rgba(f.color, a * 0.25); ctx.lineWidth = (f.thick || 6) * 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(0, f.r - 10), 0, TAU); ctx.stroke();
      } else if (f.k === 'beam') {
        const t = f.life / f.max;
        sprLine(Sprites.beam(f.color, false), f.x, f.y, f.a, f.len, f.w * 2.6 * (0.5 + t * 0.5), t);
        world();
      } else if (f.k === 'bolt') {
        const t = f.life / f.max;
        for (const [lw, col] of [[9, rgba(f.color, 0.3 * t)], [3, rgba(f.color, t)], [1.2, `rgba(255,255,255,${t})`]]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(f.pts[0].x, f.pts[0].y);
          for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
          ctx.stroke();
        }
      } else if (f.k === 'boom') {
        if (!inView(f.x, f.y, f.r)) continue;
        const t = 1 - f.life / f.max, rr = Math.max(1, f.r * ease.outCubic(t));
        spr(Sprites.boom(f.color), f.x, f.y, 0, rr / 64, 1 - t);
        world();
        ctx.strokeStyle = rgba(f.color, 0.8 * (1 - t)); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, TAU); ctx.stroke();
      }
    }

    pt = PerfLog.lap('d.over', pt);
    // částice
    world();
    let pa = -1, pc = '';
    for (const q of G.particles) {
      if (q.ghost !== undefined) {
        spr(Sprites.ship(q.color), q.x, q.y, q.ghost, 1, q.life / q.max * 0.5);
        world(); pa = -1;
        continue;
      }
      if (q.x < G.cam.x - G.viewW / 2 - 20 || q.x > G.cam.x + G.viewW / 2 + 20 || q.y < G.cam.y - G.viewH / 2 - 20 || q.y > G.cam.y + G.viewH / 2 + 20) continue;
      // průhlednost po dvacetinách a barvu nastavit jen při změně: méně příkazů pro GPU proces
      const a = q.life / q.max, s = q.size * (0.4 + a * 0.6), qa = Math.ceil(a * 20) / 20;
      if (qa !== pa) { ctx.globalAlpha = qa; pa = qa; }
      if (q.color !== pc) { ctx.fillStyle = q.color; pc = q.color; }
      ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    pt = PerfLog.lap('d.particles', pt);
    // meteority v letu
    if (G.meteors) for (const m of G.meteors) if (m.warn <= 0 && inView(m.x, m.y, 60)) {
      ctx.globalCompositeOperation = 'lighter';
      spr(Sprites.glow('#ff7a1a', 24), m.x, m.y, 0, m.r / 14, 0.8);
      ctx.globalCompositeOperation = 'source-over';
      world();
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot);
      ctx.fillStyle = '#5a3a2a'; ctx.strokeStyle = '#ffb36b'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) { const a = i * TAU / 9, q = 0.78 + 0.22 * Math.sin(i * 2.7); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * m.r * q, Math.sin(a) * m.r * q); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,190,110,0.5)'; ctx.beginPath(); ctx.arc(-m.r * 0.25, -m.r * 0.2, m.r * 0.22, 0, TAU); ctx.fill();
      ctx.restore();
    }

    pt = PerfLog.lap('d.meteors', pt);
    // čísla poškození
    world();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    let font = '';
    for (const t of G.texts) {
      const a = Math.min(1, t.life / t.max * 2.5);
      const pop = t.life > t.max - 0.1 ? 1.3 : 1;
      ctx.globalAlpha = a;
      const f = `700 ${Math.round(t.size * pop)}px "Chakra Petch", sans-serif`;
      if (f !== font) { ctx.font = f; font = f; }
      ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    pt = PerfLog.lap('d.texts', pt);
    // ukazatele mimo obrazovku
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pointers = [];
    if (G.boss) pointers.push([G.boss.x, G.boss.y, G.boss.color, 14]);
    if (G.well) pointers.push([G.well.x, G.well.y, '#c58bff', 13]);
    if (G.zone && (G.zone.out > 0 || G.zone.phase === 'shrink')) pointers.push(G.zone.phase === 'shrink' ? [G.zone.tx, G.zone.ty, '#ffffff', 13] : [G.zone.x, G.zone.y, '#e08bff', 15]);
    for (const pk of G.pickups) if (pk.kind === 'chest') pointers.push([pk.x, pk.y, '#ffd166', 10]);
    if (Legends.alive) pointers.push([Legends.alive.x, Legends.alive.y, '#ffd166', 16]);
    for (const [x, y, col, sz] of pointers) {
      const sx = (x - G.cam.x) * zoom + W / 2, sy = (y - G.cam.y) * zoom + H / 2;
      if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
      const a = Math.atan2(sy - H / 2, sx - W / 2);
      const m = 34, tx = clamp(sx, m, W - m), ty = clamp(sy, m + 50, H - m);
      const img = Sprites.pointer(col, sz), c = Math.cos(a) * dpr, sn = Math.sin(a) * dpr;
      ctx.setTransform(c, sn, -sn, c, tx * dpr, ty * dpr);
      ctx.drawImage(img, -img.hw, -img.hw, img.hw * 2, img.hw * 2);
    }

    if (sec.dark) drawDark(p);
    // vinětace a záblesky
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(vign, 0, 0, cv.width, cv.height);
    const low = p.hp / G.st.maxHp;
    const danger = Math.max(G.hurtFlash * 0.8, low < 0.3 && G.state === 'play' ? (0.3 - low) * 1.6 * (0.6 + 0.4 * Math.sin(G.time * 6)) : 0);
    if (danger > 0.01) {
      ctx.globalAlpha = Math.min(0.42, danger);
      ctx.drawImage(dangerV, 0, 0, cv.width, cv.height);
      ctx.globalAlpha = 1;
    }
    if (G.flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.35})`; ctx.fillRect(0, 0, cv.width, cv.height); }
    PerfLog.lap('d.overlay', pt);
  }

  // Bloudící černá díra: tmavý vír s akrečním prstencem a slabým okrajem dosahu.
  // Kolaps: mimo zónu tmavě fialový závoj, okraj zóny a (při smršťování) kam se zóna stáhne
  function drawZone(z) {
    world();
    const hw = G.viewW / 2 + 80, hh = G.viewH / 2 + 80;
    ctx.fillStyle = z.out > 0 ? 'rgba(70,0,40,0.5)' : 'rgba(40,0,34,0.42)';
    ctx.beginPath(); ctx.rect(G.cam.x - hw, G.cam.y - hh, hw * 2, hh * 2); ctx.arc(z.x, z.y, z.r, 0, TAU, true); ctx.fill('evenodd');
    const pulse = 0.6 + 0.4 * Math.sin(G.time * 5);
    ctx.lineWidth = 4; ctx.strokeStyle = `rgba(224,139,255,${0.55 + 0.35 * pulse})`;
    ctx.setLineDash([22, 12]); ctx.lineDashOffset = -G.time * 60;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke();
    if (z.phase === 'shrink') {
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([8, 10]);
      ctx.beginPath(); ctx.arc(z.tx, z.ty, z.tr, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  function drawWell(w) {
    if (!inView(w.x, w.y, w.r * 4)) return;
    world();
    const t = w.t, R = w.r * 3.4;
    spr(Sprites.radial('well', [[0, 'rgba(0,0,0,1)'], [1 / 3.4, 'rgba(6,0,16,0.97)'], [0.55, 'rgba(123,60,255,0.18)'], [1, 'rgba(123,60,255,0)']]), w.x, w.y, 0, R / 128);
    world();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = rgba(i % 2 ? '#ff4fd8' : '#c58bff', 0.5 - i * 0.08); ctx.lineWidth = 3 - i * 0.5;
      const rr = w.r * (1.08 + i * 0.32), a0 = t * (2.4 - i * 0.4) + i * 1.7;
      ctx.beginPath(); ctx.ellipse(w.x, w.y, rr, rr * 0.92, 0, a0, a0 + 2.6); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,79,216,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke();
  }
  // ── Nepřátelé z 1.4: varování a aury (všechno předkreslené sprity) ──
  function drawFoeUnder(e, d) {
    switch (d.ai) {
      case 'aegis': case 'command': case 'frost': case 'grav':
        spr(Sprites.dashRing(e.color, d.aura, 1.6, 10, 9, 0.5), e.x, e.y, G.time * (d.ai === 'grav' ? -0.6 : 0.25), 1, 0.6);
        if (d.ai === 'grav') {
          const arc = Sprites.arcLine(e.color, 100, 3, 2.2, 0.55);
          for (let i = 0; i < 3; i++) spr(arc, e.x, e.y, -G.time * (2.2 + i * 0.6) + i * 2.1, d.aura * (0.25 + i * 0.14) / 100, 0.7);
        }
        break;
      case 'twin':
        if (e.side > 0 && e.mate && !e.mate.dead) {
          const m = e.mate, len = Math.hypot(m.x - e.x, m.y - e.y);
          if (len < TETHER) { ctx.globalCompositeOperation = 'lighter'; sprLine(Sprites.beam('#ff7ad9', false), e.x, e.y, Math.atan2(m.y - e.y, m.x - e.x), len, 9, 0.85); ctx.globalCompositeOperation = 'source-over'; }
        }
        break;
      case 'snipe':
        if (e.st === 1) {
          const locked = e.stT < 0.3;
          ctx.globalCompositeOperation = 'lighter';
          sprLine(Sprites.beam(e.color, true), e.x, e.y, e.ang, 980, locked ? 7 : 3, locked ? 0.95 : 0.35 + 0.3 * ((e.stT * 12) % 1));
          ctx.globalCompositeOperation = 'source-over';
        }
        break;
      case 'blink':
        if (e.st === 1) {
          const q = 1 - e.stT / 0.8;
          spr(Sprites.dashRing(e.color, 32, 2, 6, 6, 0.9), e.bx, e.by, G.time * 3, 0.6 + 0.6 * (1 - q), 0.5 + 0.4 * q);
          spr(Sprites.enemy(d.shape, d.r, e.color, false, false), e.bx, e.by, e.rot, 1, 0.2 + 0.35 * q);
        }
        break;
    }
  }
  function drawFoeOver(e, d) {
    if (d.ai === 'pulse' && e.stT < 0.45) spr(Sprites.enemy(d.shape, d.r, e.color, true, e.elite), e.x, e.y, e.rot, e.r / d.r, (1 - e.stT / 0.45) * 0.8);
    else if (d.ai === 'bulwark') spr(Sprites.arcLine('#ffffff', d.r + 7, 3, 1.75, 0.85), e.x, e.y, e.ang - 0.875, e.r / d.r);
    else if (d.ai === 'mine' && e.arm <= 0 && (G.time * 4 + e.id) % 1 < 0.5) spr(Sprites.glow(e.color, 6), e.x, e.y, 0, 1, 0.9);
  }
  // Legendy (legends.js): zlatý čárkovaný kruh, záře, tělo podle druhu a pod ním zdraví a čas do odletu.
  function drawLegend(e, d) {
    const sc = e.r / d.r, grow = Math.min(1, e.t * 2.5), white = e.flash > 0 ? Math.min(1, e.flash * 12) : 0;
    ctx.globalCompositeOperation = 'lighter';
    spr(Sprites.glow(e.color, Math.round(d.r * 0.7)), e.x, e.y, 0, sc, e.phased ? 0.15 : 0.35);
    ctx.globalCompositeOperation = 'source-over';
    spr(Sprites.dashRing('#ffd166', d.r + 18, 2, 6, 9, 0.75), e.x, e.y, G.time * 0.7, sc * grow);
    const body = (shape, rot) => {
      spr(Sprites.enemy(shape, d.r, e.color, false, false), e.x, e.y, rot, sc * grow);
      if (white) spr(Sprites.enemy(shape, d.r, e.color, true, false), e.x, e.y, rot, sc, white);
    };
    switch (e.type) {
      case 'watcher': {
        // oko se zavírá svislým stažením bělma; zavřené ukáže jen víčko s řasami
        const o = Math.max(0.06, e.open);
        sprStretch(Sprites.legendPart('eye', d.r, e.color), e.x, e.y, 0, grow, grow * o);
        if (e.open > 0.15) spr(Sprites.legendPart('iris', d.r, e.color), e.x + Math.cos(e.ang) * d.r * 0.38, e.y + Math.sin(e.ang) * d.r * 0.2 * o, 0, grow, Math.min(1, e.open * 1.5));
        if (e.open < 0.6) spr(Sprites.legendPart('lid', d.r, e.color), e.x, e.y, 0, grow, 1 - e.open / 0.6);
        if (white && !e.phased) sprStretch(Sprites.legendPart('eye', d.r, '#ffffff'), e.x, e.y, 0, 1, o, white);
        break;
      }
      case 'midnight': {
        if (e.st === 1) {
          const q = 1 - e.stT / 0.75;
          spr(Sprites.dashRing(e.color, 34, 2, 6, 6, 0.9), e.bx, e.by, G.time * 3, 0.6 + 0.6 * (1 - q), 0.5 + 0.4 * q);
          spr(Sprites.enemy('clock', d.r, e.color, false, false), e.bx, e.by, 0, 1, 0.15 + 0.35 * q);
        }
        body('clock', 0);
        spr(Sprites.legendPart('hand', Math.round(d.r * 0.6), '#ffffff'), e.x, e.y, -Math.PI / 2 + (e.chime || 0) / 12 * TAU, sc);
        spr(Sprites.legendPart('hand', Math.round(d.r * 0.88), e.color), e.x, e.y, -Math.PI / 2 + G.time * 2.4, sc);
        break;
      }
      case 'comet':
        if (e.st === 0 && e.t > 0.3) {
          // míří: varovná čára, kudy poletí
          ctx.globalCompositeOperation = 'lighter';
          sprLine(Sprites.beam(e.color, true), e.x, e.y, e.ang, 760, 5, 0.25 + 0.3 * ((e.stT * 8) % 1));
          ctx.globalCompositeOperation = 'source-over';
        }
        body('comet', e.rot);
        break;
      case 'mirror':
        // kotva souměrnosti: střed mezi lodí a odrazem
        spr(Sprites.dashRing('#ffffff', 16, 2, 4, 5, 0.6), e.cx, e.cy, -G.time * 2, 1, 0.7);
        body('mship', e.rot);
        break;
      case 'ouroboros': {
        const seg = Sprites.enemy('scale', 12, e.color, false, false);
        for (let i = SERPENT_SEG; i >= 1; i--) {
          const j = serpentIdx(e, i), k = serpentIdx(e, i - 1), x = e.tr[j * 2], y = e.tr[j * 2 + 1];
          if (!inView(x, y, 24)) continue;
          spr(seg, x, y, Math.atan2(e.tr[k * 2 + 1] - y, e.tr[k * 2] - x), serpentR(e, i) / 12 * grow);
        }
        body('serpent', e.rot);
        break;
      }
      default: body(d.shape, e.rot);
    }
    world();
    const w = Math.max(48, e.r * 2.4), y = e.y + e.r + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2, y, w, 5);
    ctx.fillStyle = '#ffd166'; ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 5);
    ctx.fillStyle = rgba(e.color, 0.85); ctx.fillRect(e.x - w / 2, y + 7, w * Legends.left(e), 2);
  }
  // Temnota: světlo jen kolem lodi; za ním z nepřátel svítí jen slabé oči.
  function drawDark(p) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sx = ((p.x - G.cam.x) * zoom + W / 2) * dpr, sy = ((p.y - G.cam.y) * zoom + H / 2) * dpr;
    const r1 = 330 * zoom * dpr;
    // světlo kolem lodi jako sprite (přechod 150 → 330), zbytek obrazovky čtyři obdélníky tmy
    const m = Sprites.radial('dark', [[0, 'rgba(0,0,4,0)'], [150 / 330, 'rgba(0,0,4,0)'], [150 / 330 + 0.55 * 180 / 330, 'rgba(0,0,4,0.75)'], [1, 'rgba(0,0,4,0.95)']], 128, true);
    ctx.drawImage(m, sx - r1, sy - r1, r1 * 2, r1 * 2);
    ctx.fillStyle = 'rgba(0,0,4,0.95)';
    const x0 = Math.max(0, sx - r1), x1 = Math.min(cv.width, sx + r1), y0 = Math.max(0, sy - r1), y1 = Math.min(cv.height, sy + r1);
    ctx.fillRect(0, 0, cv.width, y0); ctx.fillRect(0, y1, cv.width, cv.height - y1);
    ctx.fillRect(0, y0, x0, y1 - y0); ctx.fillRect(x1, y0, cv.width - x1, y1 - y0);
    world();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of G.enemies) {
      if (!inView(e.x, e.y, e.r) || d2(e.x, e.y, p.x, p.y) < 260 * 260) continue;
      const a = e.boss ? 0.7 : 0.35, s = Math.max(1.6, e.r * 0.16);
      ctx.fillStyle = rgba(e.boss ? '#ff4d5e' : e.color, a);
      ctx.beginPath(); ctx.arc(e.x - s * 1.6, e.y - s * 0.4, s, 0, TAU); ctx.arc(e.x + s * 1.6, e.y - s * 0.4, s, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── Pozadí menu (atraktivní ukázka) ───────────────────────────────────────
  const attract = { t: 0, items: [], sector: SECTORS[0] };
  function drawAttract(dt) {
    attract.t += dt;
    const t = attract.t;
    if (!attract.items.length) {
      const types = ENEMY_KINDS;
      for (let i = 0; i < 46; i++) attract.items.push({ type: pick(types), r: rand(260, 900), a: rand(0, TAU), s: rand(0.04, 0.12) * (Math.random() < 0.5 ? 1 : -1), rot: rand(0, TAU), z: rand(0.6, 1.2) });
    }
    const cx = Math.cos(t * 0.05) * 300, cy = t * 22;
    frame(attract.sector, cx, cy, 0, 0.1 + Math.sin(t * 0.8) * 0.05);
    ctx.globalCompositeOperation = 'lighter';
    // centrální singularita
    const g0 = Sprites.glow(attract.sector.accent, 40);
    spr(g0, cx, cy, 0, 2.2 + Math.sin(t * 1.3) * 0.15, 0.25);
    world();
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = rgba(attract.sector.accent, 0.12 - i * 0.02); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 160 + i * 90 + Math.sin(t + i) * 10, t * (0.2 + i * 0.05), t * (0.2 + i * 0.05) + 4); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const it of attract.items) {
      it.a += it.s * dt; it.rot += dt;
      const d = ENEMIES[it.type];
      spr(Sprites.enemy(d.shape, d.r, d.color, false, false), cx + Math.cos(it.a) * it.r, cy + Math.sin(it.a) * it.r * 0.6, it.rot, it.z, 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(vign, 0, 0, cv.width, cv.height);
  }
  function setAttractSector(s) { attract.sector = s; }

  return { init, resize, degrade, resetQuality, drawGame, drawAttract, setAttractSector, world, spr, sprLine,
    get ctx() { return ctx; }, get zoom() { return zoom; }, get sprN() { return sprN; }, get scale() { return scale; },
    get dirty() { return dirty; }, set dirty(v) { dirty = v; } };
})();
