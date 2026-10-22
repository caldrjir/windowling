'use strict';
// ── Sprity: předrenderované neonové tvary (shadowBlur jen jednou) ───────────
const SPR = 2;
const Sprites = (() => {
  const cache = new Map();
  const get = (key, fn) => { let s = cache.get(key); if (!s) { s = fn(); cache.set(key, s); } return s; };

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
      default: x.arc(0, 0, r, 0, TAU);
    }
  }

  function canvasFor(halfWorld) {
    const c = makeCanvas(halfWorld * 2 * SPR, halfWorld * 2 * SPR);
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

  function gem(color, r) {
    return get(`gem|${color}|${r}`, () => {
      const [c, x] = canvasFor(r + 10);
      x.shadowColor = color; x.shadowBlur = 10;
      x.beginPath(); x.moveTo(0, -r); x.lineTo(r * 0.7, 0); x.lineTo(0, r); x.lineTo(-r * 0.7, 0); x.closePath();
      x.fillStyle = rgba(color, 0.55); x.fill(); x.strokeStyle = color; x.lineWidth = 1.6; x.stroke();
      x.beginPath(); x.moveTo(0, -r * 0.5); x.lineTo(r * 0.3, 0); x.lineTo(0, r * 0.1); x.closePath();
      x.fillStyle = 'rgba(255,255,255,0.85)'; x.fill();
      return c;
    });
  }

  function pickup(kind) {
    return get(`pk|${kind}`, () => {
      const [c, x] = canvasFor(30);
      x.lineJoin = 'round'; x.lineCap = 'round';
      const col = { shard: '#e08bff', heart: '#5dffa8', magnet: '#55c8ff', bomb: '#ff5a5a', chest: '#ffd166' }[kind];
      x.shadowColor = col; x.shadowBlur = 14; x.strokeStyle = col; x.lineWidth = 2.4; x.fillStyle = rgba(col, 0.3);
      if (kind === 'shard') {
        x.beginPath(); x.moveTo(0, -11); x.lineTo(7, -2); x.lineTo(0, 11); x.lineTo(-7, -2); x.closePath(); x.fill(); x.stroke();
        x.beginPath(); x.moveTo(-7, -2); x.lineTo(7, -2); x.stroke();
      } else if (kind === 'heart') {
        x.beginPath(); x.arc(0, 0, 11, 0, TAU); x.fill(); x.stroke();
        x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.moveTo(-5, 0); x.lineTo(5, 0); x.moveTo(0, -5); x.lineTo(0, 5); x.stroke();
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

  return { enemy, boss, bossCore, ship, drawShip, glow, blade, gem, pickup, path, clear: () => cache.clear() };
})();

// ── Renderer ────────────────────────────────────────────────────────────────
const Render = (() => {
  let cv, ctx, W = 1280, H = 720, dpr = 1, zoom = 1, k = 1, ox = 0, oy = 0;
  let bg = null, bgKey = '', vign = null, stars = [];
  const GEM_COL = v => v < 2.5 ? ['#4cc9f0', 5] : v < 8 ? ['#06ffa5', 6] : v < 30 ? ['#ff4fd8', 7.5] : ['#ffd166', 9.5];

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
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
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
    zoom = clamp(Math.min(W, H) / 800, 0.6, 1.2);
    if (W < 700) zoom = clamp(Math.min(W, H) / 640, 0.5, 1);
    G.viewW = W / zoom; G.viewH = H / zoom; G.viewR = Math.hypot(G.viewW, G.viewH) / 2;
    bgKey = '';
    vign = makeCanvas(W, H);
    const v = vign.getContext('2d');
    const g = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
    v.fillStyle = g; v.fillRect(0, 0, W, H);
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
  function spr(img, x, y, a, sc = 1, alpha = 1) {
    const c = Math.cos(a) * sc * k, s = Math.sin(a) * sc * k;
    ctx.setTransform(c, s, -s, c, ox + x * k, oy + y * k);
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(img, -img.hw, -img.hw, img.hw * 2, img.hw * 2);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }
  function sprStretch(img, x, y, a, sx, sy, alpha = 1) {
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

  const inView = (x, y, r) => Math.abs(x - G.cam.x) < G.viewW / 2 + r + 30 && Math.abs(y - G.cam.y) < G.viewH / 2 + r + 30;

  function drawGame() {
    const p = G.p, sec = G.sector;
    frame(sec, G.cam.x, G.cam.y, G.shake * 0.6, G.flash * 0.6);

    // efekty pod entitami
    world();
    for (const f of G.effects) {
      if (f.k === 'mine') {
        const blink = (f.t * (f.life < 1.5 ? 10 : 3)) % 1 < 0.5;
        world();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(f.color, f.arm > 0 ? 0.35 : 0.8); ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + f.t; i ? ctx.lineTo(f.x + Math.cos(a) * 9, f.y + Math.sin(a) * 9) : ctx.moveTo(f.x + Math.cos(a) * 9, f.y + Math.sin(a) * 9); }
        ctx.closePath(); ctx.stroke();
        if (blink && f.arm <= 0) { ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, TAU); ctx.fill(); }
        ctx.globalCompositeOperation = 'source-over';
      } else if (f.k === 'hole') {
        world();
        const t = f.t || 0, fade = Math.min(1, t * 4, f.life * 2);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, `rgba(0,0,0,${0.95 * fade})`); g.addColorStop(0.25, `rgba(10,0,25,${0.85 * fade})`);
        g.addColorStop(0.5, rgba(f.color, 0.18 * fade)); g.addColorStop(1, rgba(f.color, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(f.color, 0.8 * fade); ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.22 + i * 0.06), t * (3 + i) + i * 2, t * (3 + i) + i * 2 + 2.2); ctx.stroke(); }
      } else if (f.k === 'tele') {
        world();
        const a = 0.25 + 0.35 * ((f.life * 8) % 1);
        ctx.strokeStyle = rgba(f.color, a); ctx.lineWidth = f.w;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(f.a) * f.len, f.y + Math.sin(f.a) * f.len); ctx.stroke();
      }
    }

    // předměty
    for (const pk of G.pickups) {
      if (!inView(pk.x, pk.y, 20)) continue;
      const bob = Math.sin(pk.t * 4) * 2;
      if (pk.kind === 'gem') { const [c, r] = GEM_COL(pk.val); spr(Sprites.gem(c, r), pk.x, pk.y + bob, 0); }
      else if (pk.kind === 'chest') {
        ctx.globalCompositeOperation = 'lighter';
        spr(Sprites.glow('#ffd166', 16), pk.x, pk.y, 0, 1 + Math.sin(pk.t * 5) * 0.15, 0.5);
        ctx.globalCompositeOperation = 'source-over';
        spr(Sprites.pickup('chest'), pk.x, pk.y + bob * 2, Math.sin(pk.t * 2) * 0.1, 1.1);
      } else spr(Sprites.pickup(pk.kind), pk.x, pk.y + bob, 0);
    }

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
      const spawnIn = Math.min(1, e.t * 4);
      spr(Sprites.enemy(e.d.shape, e.d.r, e.color, false, e.elite), e.x, e.y, e.rot, (e.elite ? 1.75 : 1) * spawnIn);
      if (e.flash > 0) spr(Sprites.enemy(e.d.shape, e.d.r, e.color, true, e.elite), e.x, e.y, e.rot, (e.elite ? 1.75 : 1), Math.min(1, e.flash * 12));
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

    // zbraně s vlastním vykreslením
    for (const w of G.weapons) { const b = WB[w.id]; if (b && b.draw) b.draw(w, ctx); }

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

    // střely
    ctx.globalCompositeOperation = 'lighter';
    for (const b of G.bullets) {
      if (!inView(b.x, b.y, 20)) continue;
      const a = Math.atan2(b.vy, b.vx);
      sprStretch(Sprites.glow(b.color, b.r), b.x, b.y, a, b.kind === 'missile' ? 1.6 : 2.2, 1);
    }
    for (const b of G.ebullets) {
      if (!inView(b.x, b.y, 20)) continue;
      spr(Sprites.glow(b.color, b.r), b.x, b.y, 0, 1 + Math.sin(G.time * 20 + b.x) * 0.08);
    }

    // efekty nad entitami
    world();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const f of G.effects) {
      if (f.k === 'ring') {
        if (f.delay > 0) continue;
        const t = f.r / f.maxR, a = 1 - t;
        ctx.strokeStyle = rgba(f.color, a * 0.85); ctx.lineWidth = (f.thick || 6) * (1 - t * 0.5);
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = rgba(f.color, a * 0.25); ctx.lineWidth = (f.thick || 6) * 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(0, f.r - 10), 0, TAU); ctx.stroke();
      } else if (f.k === 'beam') {
        const t = f.life / f.max, ex = f.x + Math.cos(f.a) * f.len, ey = f.y + Math.sin(f.a) * f.len;
        ctx.strokeStyle = rgba(f.color, 0.45 * t); ctx.lineWidth = f.w * 2.6 * (0.5 + t * 0.5);
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.95 * t})`; ctx.lineWidth = f.w * 0.55 * t;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(ex, ey); ctx.stroke();
      } else if (f.k === 'bolt') {
        const t = f.life / f.max;
        for (const [lw, col] of [[9, rgba(f.color, 0.3 * t)], [3, rgba(f.color, t)], [1.2, `rgba(255,255,255,${t})`]]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(f.pts[0].x, f.pts[0].y);
          for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
          ctx.stroke();
        }
      } else if (f.k === 'boom') {
        const t = 1 - f.life / f.max, rr = f.r * ease.outCubic(t);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, Math.max(1, rr));
        g.addColorStop(0, `rgba(255,255,255,${0.7 * (1 - t)})`); g.addColorStop(0.4, rgba(f.color, 0.5 * (1 - t))); g.addColorStop(1, rgba(f.color, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(1, rr), 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(f.color, 0.8 * (1 - t)); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(1, rr), 0, TAU); ctx.stroke();
      }
    }

    // částice
    world();
    for (const q of G.particles) {
      if (q.ghost !== undefined) {
        spr(Sprites.ship(q.color), q.x, q.y, q.ghost, 1, q.life / q.max * 0.5);
        world();
        continue;
      }
      const a = q.life / q.max, s = q.size * (0.4 + a * 0.6);
      ctx.globalAlpha = a;
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // čísla poškození
    world();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    for (const t of G.texts) {
      const a = Math.min(1, t.life / t.max * 2.5);
      const pop = t.life > t.max - 0.1 ? 1.3 : 1;
      ctx.globalAlpha = a;
      ctx.font = `700 ${Math.round(t.size * pop)}px "Chakra Petch", sans-serif`;
      ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // ukazatele mimo obrazovku
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pointers = [];
    if (G.boss) pointers.push([G.boss.x, G.boss.y, G.boss.color, 14]);
    for (const pk of G.pickups) if (pk.kind === 'chest') pointers.push([pk.x, pk.y, '#ffd166', 10]);
    for (const [x, y, col, sz] of pointers) {
      const sx = (x - G.cam.x) * zoom + W / 2, sy = (y - G.cam.y) * zoom + H / 2;
      if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
      const a = Math.atan2(sy - H / 2, sx - W / 2);
      const m = 34, tx = clamp(sx, m, W - m), ty = clamp(sy, m + 50, H - m);
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.6, sz * 0.7); ctx.lineTo(-sz * 0.6, -sz * 0.7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // vinětace a záblesky
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(vign, 0, 0, cv.width, cv.height);
    const low = p.hp / G.st.maxHp;
    const danger = Math.max(G.hurtFlash * 0.8, low < 0.3 && G.state === 'play' ? (0.3 - low) * 1.6 * (0.6 + 0.4 * Math.sin(G.time * 6)) : 0);
    if (danger > 0.01) {
      const g = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.3, cv.width / 2, cv.height / 2, Math.hypot(cv.width, cv.height) * 0.55);
      g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(255,0,40,${Math.min(0.42, danger)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    }
    if (G.flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.35})`; ctx.fillRect(0, 0, cv.width, cv.height); }
  }

  // ── Pozadí menu (atraktivní ukázka) ───────────────────────────────────────
  const attract = { t: 0, items: [], sector: SECTORS[0] };
  function drawAttract(dt) {
    attract.t += dt;
    const t = attract.t;
    if (!attract.items.length) {
      const types = Object.keys(ENEMIES);
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

  return { init, resize, drawGame, drawAttract, setAttractSector, world, spr, get ctx() { return ctx; }, get zoom() { return zoom; } };
})();
