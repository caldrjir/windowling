'use strict';
// ── Chování zbraní: update(w, dt) a volitelně draw(w, ctx) ──────────────────
const _wq = [];

function firePulse(w) {
  const p = G.p, s = w.s;
  const tgt = nearestEnemy(p.x, p.y, G.viewR * 0.9);
  if (!tgt) { w.t = 0.1; return; }
  w.t = s.cd;
  const base = Math.atan2(tgt.y - p.y, tgt.x - p.x);
  const n = s.amount, spread = s.boom ? 0.09 : 0.13;
  const color = WEAPONS[w.id].color;
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * spread + (s.boom ? rand(-0.05, 0.05) : 0);
    shoot({ x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14, a, spd: s.speed, r: 5.5 * Math.sqrt(s.area), dmg: s.dmg, pierce: s.pierce, life: 1.1 * s.dur, src: w.id, color, boom: s.boom ? 42 * s.area : 0 });
  }
  Sound.play.shoot();
}

function fireMissiles(w) {
  const p = G.p, s = w.s;
  if (!G.enemies.length) { w.t = 0.2; return; }
  w.t = s.cd;
  const color = WEAPONS[w.id].color, swarm = w.id === 'swarm';
  for (let i = 0; i < s.amount; i++) {
    const a = swarm ? Math.random() * TAU : p.face + Math.PI + (i - (s.amount - 1) / 2) * 0.55 + rand(-0.2, 0.2);
    shoot({ kind: 'missile', x: p.x, y: p.y, a, spd: s.speed * rand(0.9, 1.1), r: swarm ? 6 : 7, dmg: s.dmg, life: 3.2, src: w.id, color, homing: true, turn: swarm ? 5 : 3.5, blast: 52 * s.area });
  }
  Sound.play.missile();
}

function fireArc(w) {
  const p = G.p, s = w.s;
  const cands = enemiesNear(p.x, p.y, 430);
  if (!cands.length) { w.t = 0.15; return; }
  w.t = s.cd;
  const color = WEAPONS[w.id].color, range = s.range * s.area;
  for (let k = 0; k < s.amount; k++) {
    let cur = cands[(Math.random() * cands.length) | 0];
    if (cur.dead && cands.length > 1) cur = cands[(Math.random() * cands.length) | 0];
    const hit = new Set([cur.id]);
    const pts = [{ x: p.x, y: p.y }, { x: cur.x, y: cur.y }];
    hurtEnemy(cur, s.dmg, w.id, 0, 0);
    for (let c = 0; c < s.chain; c++) {
      G.grid.query(cur.x, cur.y, range + G.maxR, _wq);
      let best = null, bd = range * range;
      for (const e of _wq) {
        if (e.dead || hit.has(e.id)) continue;
        const dd = d2(cur.x, cur.y, e.x, e.y);
        if (dd < bd) { bd = dd; best = e; }
      }
      if (!best) break;
      hit.add(best.id);
      pts.push({ x: best.x, y: best.y });
      hurtEnemy(best, s.dmg, w.id, 0, 0, true);
      cur = best;
    }
    // zubatý blesk
    const jag = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], segs = 5;
      for (let j = 0; j < segs; j++) {
        const t = j / segs, off = j === 0 ? 0 : rand(-14, 14);
        const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
        jag.push({ x: lerp(a.x, b.x, t) + nx / nl * off, y: lerp(a.y, b.y, t) + ny / nl * off });
      }
    }
    jag.push(pts[pts.length - 1]);
    G.effects.push({ k: 'bolt', pts: jag, life: 0.2, max: 0.2, color });
    for (let i = 1; i < pts.length; i++) burst(pts[i].x, pts[i].y, color, 4, 160, 2, 0.3);
  }
  Sound.play.zap();
}

function fireNova(w) {
  const p = G.p, s = w.s;
  w.t = s.cd;
  const color = WEAPONS[w.id].color;
  for (let i = 0; i < s.amount; i++) {
    G.effects.push({ k: 'ring', id: ++G.uid, x: p.x, y: p.y, r: 8, maxR: 185 * s.area, spd: 560, dmg: s.dmg, knock: s.knock, src: w.id, delay: i * 0.22, life: 1, color, visual: false, thick: w.id === 'supernova' ? 14 : 8 });
  }
  Sound.play.nova();
}

function fireLance(w) {
  const p = G.p, s = w.s;
  const tgt = nearestEnemy(p.x, p.y, G.viewR);
  if (!tgt) { w.t = 0.2; return; }
  w.t = s.cd;
  const base = Math.atan2(tgt.y - p.y, tgt.x - p.x), color = WEAPONS[w.id].color;
  const width = s.width * s.area;
  for (let i = 0; i < s.amount; i++) {
    const a = base + (i - (s.amount - 1) / 2) * 0.2;
    beam(p.x, p.y, a, s.len, width, s.dmg, w.id);
    G.effects.push({ k: 'beam', x: p.x, y: p.y, a, len: s.len, w: width, life: 0.32, max: 0.32, color });
  }
  addShake(2);
  Sound.play.laser();
}

const WB = {
  pulse: { update(w, dt) { w.t -= dt; if (w.t <= 0) firePulse(w); } },
  seeker: { update(w, dt) { w.t -= dt; if (w.t <= 0) fireMissiles(w); } },
  arc: { update(w, dt) { w.t -= dt; if (w.t <= 0) fireArc(w); } },
  nova: { update(w, dt) { w.t -= dt; if (w.t <= 0) fireNova(w); } },
  lance: { update(w, dt) { w.t -= dt; if (w.t <= 0) fireLance(w); } },

  orbit: {
    update(w, dt) {
      const s = w.s, p = G.p;
      w.ang = (w.ang || 0) + s.speed * dt;
      if (s.eternal) w.on = true;
      else {
        if (w.on === undefined) { w.on = true; w.ot = s.dur; }
        w.ot -= dt;
        if (w.ot <= 0) { w.on = !w.on; w.ot = w.on ? s.dur : s.cd; }
      }
      w.fade = clamp((w.fade || 0) + (w.on ? dt * 5 : -dt * 5), 0, 1);
      if (w.fade < 0.5) return;
      const R = 78 * s.area, br = 11 * Math.sqrt(s.area) * (s.eternal ? 1.25 : 1), n = s.amount;
      for (let i = 0; i < n; i++) {
        const a = w.ang + i * TAU / n;
        const bx = p.x + Math.cos(a) * R, by = p.y + Math.sin(a) * R;
        G.grid.query(bx, by, br + G.maxR, _wq);
        for (const e of _wq) {
          if (e.dead || e.orbT > G.time) continue;
          if (d2(bx, by, e.x, e.y) < (br + e.r) * (br + e.r)) {
            e.orbT = G.time + 0.3;
            const dx = e.x - p.x, dy = e.y - p.y, dl = Math.hypot(dx, dy) || 1;
            hurtEnemy(e, s.dmg, w.id, dx / dl * 220, dy / dl * 220);
            Sound.play.blade();
          }
        }
      }
    },
    draw(w, ctx) {
      if (!w.fade) return;
      const s = w.s, p = G.p, R = 78 * s.area, n = s.amount;
      const img = Sprites.blade(WEAPONS[w.id].color, s.eternal ? 1.25 : 1);
      const sc = Math.sqrt(s.area);
      for (let i = 0; i < n; i++) {
        const a = w.ang + i * TAU / n;
        for (let tr = 3; tr >= 0; tr--) {
          const ta = a - tr * 0.09;
          Render.spr(img, p.x + Math.cos(ta) * R, p.y + Math.sin(ta) * R, ta + Math.PI / 2 + w.ang * 2, sc * (1 - tr * 0.12), w.fade * (tr === 0 ? 1 : 0.22));
        }
      }
    },
  },

  aura: {
    update(w, dt) {
      w.t -= dt;
      w.spin = (w.spin || 0) + dt * 0.6;
      if (w.t > 0) return;
      const s = w.s, p = G.p;
      w.t = s.cd;
      const R = 72 * s.area;
      G.grid.query(p.x, p.y, R + G.maxR, _wq);
      for (const e of _wq) {
        if (e.dead) continue;
        if (d2(p.x, p.y, e.x, e.y) < (R + e.r) * (R + e.r)) {
          e.slowT = 0.6; e.slow = Math.max(e.slow || 0, Math.min(0.8, s.slow));
          if (s.leech) { e.leech = G.time + 0.6; e.leechAmt = s.leech; }
          hurtEnemy(e, s.dmg, w.id, 0, 0, true);
        }
      }
      w.pulse = 1;
    },
    draw(w, ctx) {
      const s = w.s, p = G.p, R = 72 * s.area, col = WEAPONS[w.id].color;
      w.pulse = Math.max(0, (w.pulse || 0) - 0.06);
      Render.world();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, R * 0.2, p.x, p.y, R);
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(0.75, rgba(col, 0.07 + w.pulse * 0.05));
      g.addColorStop(1, rgba(col, 0.2 + w.pulse * 0.12));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(col, 0.55);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -w.spin * 40;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 6; i++) {
        const a = w.spin + i * TAU / 6;
        ctx.fillStyle = rgba(col, 0.7);
        ctx.fillRect(p.x + Math.cos(a) * R - 2, p.y + Math.sin(a) * R - 2, 4, 4);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  },

  mines: {
    update(w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = w.s, p = G.p;
      w.t = s.cd;
      for (let i = 0; i < s.amount; i++) {
        const a = Math.random() * TAU, d = rand(30, 150);
        G.effects.push({ k: 'mine', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, arm: 0.5, life: s.dur, max: s.dur, blast: 72 * s.area, dmg: s.dmg, src: w.id, color: WEAPONS[w.id].color });
      }
      Sound.play.mine();
    },
  },

  singularity: {
    update(w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = w.s, p = G.p;
      const cands = enemiesNear(p.x, p.y, G.viewR * 0.55);
      if (!cands.length) { w.t = 0.3; return; }
      w.t = s.cd;
      for (let i = 0; i < s.amount; i++) {
        const e = cands[(Math.random() * cands.length) | 0];
        G.effects.push({ k: 'hole', x: e.x, y: e.y, r: 170 * s.area, life: s.dur, max: s.dur, dmg: s.dmg, tick: 0, src: w.id, color: WEAPONS[w.id].color });
      }
      Sound.play.nova();
    },
  },

  prism: {
    update(w, dt) {
      const s = w.s, p = G.p;
      w.ang = (w.ang || 0) + s.spin * dt;
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd;
      for (let i = 0; i < s.amount; i++) beam(p.x, p.y, w.ang + i * TAU / s.amount, s.len, s.width * s.area, s.dmg, w.id);
    },
    draw(w, ctx) {
      const s = w.s, p = G.p, col = WEAPONS[w.id].color, width = s.width * s.area;
      Render.world();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let i = 0; i < s.amount; i++) {
        const a = w.ang + i * TAU / s.amount;
        const ex = p.x + Math.cos(a) * s.len, ey = p.y + Math.sin(a) * s.len;
        const g = ctx.createLinearGradient(p.x, p.y, ex, ey);
        g.addColorStop(0, rgba(col, 0.5)); g.addColorStop(1, rgba(col, 0));
        ctx.strokeStyle = g; ctx.lineWidth = width * 2.2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke();
        const g2 = ctx.createLinearGradient(p.x, p.y, ex, ey);
        g2.addColorStop(0, 'rgba(255,255,255,0.95)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g2; ctx.lineWidth = width * 0.45;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  },
};
WB.hyperpulse = WB.pulse;
WB.swarm = WB.seeker;
WB.tesla = WB.arc;
WB.supernova = WB.nova;
WB.halo = WB.orbit;
WB.entropy = WB.aura;
