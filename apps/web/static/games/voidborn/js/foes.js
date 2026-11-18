'use strict';
// ── Chování nepřátel z verze 1.4 ────────────────────────────────────────────
// Druh s `ai` (data.js) má tady funkci, kterou updateEnemies volá v každém snímku. Funkce upraví
// směr a rychlost pohybu ve sdíleném M (žádné nové objekty za snímek) a případně zaútočí.
// M.lock = nepřítel se sám nehýbe a nesráží (přisátá pijavice, mina), M.noHit = nezraní dotykem.
// Každý druh má jednu jasnou schopnost a čitelné varování (laser, kruh dopadu, ghost cíle), aby se
// dalo reagovat: uhnout, zabít ho jako prvního, obletět ho, nebo ho nechat být.
const M = { mx: 0, my: 0, sp: 0, lock: false, noHit: false };
const FOE_CAP = 440; // potomci (larvy, miny, rakety) jen do tohoto počtu nepřátel na mapě
const _qF = [];

// Drží odstup od hráče: blíž než near couvá, dál než far se blíží, mezi tím obletuje.
function keepRange(e, dist, dx, dy, near, far) {
  const ux = dx / dist, uy = dy / dist, s = (e.id & 1) ? 1 : -1;
  if (dist > far) { M.mx = ux; M.my = uy; }
  else if (dist < near) { M.mx = -ux * 0.85 - uy * s * 0.45; M.my = -uy * 0.85 + ux * s * 0.45; }
  else { M.mx = -uy * s * 0.85 + ux * 0.1; M.my = ux * s * 0.85 + uy * 0.1; M.sp *= 0.7; }
}
// Aura podpory: jednou za čtvrt sekundy označí spojence v dosahu (štít, zrychlení).
const PROT = o => { o.prot = G.time + 0.4; };
const HASTE = o => { o.haste = G.time + 0.4; };
function aura(e, dt, R, apply) {
  e.auT = (e.auT || 0) - dt;
  if (e.auT > 0) return;
  e.auT = 0.25;
  G.grid.query(e.x, e.y, R + G.maxR, _qF);
  for (const o of _qF) if (o !== e && !o.dead && !o.boss && d2(o.x, o.y, e.x, e.y) < R * R) apply(o);
}
// Výbuch nepřítele, který zraní hráče (raketa, mina). Nepočítá se jako zabití: žádné krystaly.
function foeBoom(e, r, dmg) {
  e.dead = true;
  G.effects.push({ k: 'boom', x: e.x, y: e.y, r, life: 0.35, max: 0.35, color: e.color });
  burst(e.x, e.y, e.color, 14, r * 5, 3, 0.45);
  Sound.play.explode(); addShake(dmg ? 4 : 1.5);
  const p = G.p;
  if (dmg && d2(e.x, e.y, p.x, p.y) < (r + p.r) * (r + p.r)) hurtPlayer(dmg, e.x, e.y);
}

const FOE_AI = {
  // Kroužič: obletuje hráče v kruhu, který se pomalu stahuje; zbraně mířící přímo ho těžko trefí.
  orbit(e, d, dt, dist, dx, dy) {
    if (e.orR === undefined) e.orR = rand(230, 290);
    e.orR = Math.max(0, e.orR - 9 * dt);
    if (dist > e.orR + 50) return;
    const ux = dx / dist, uy = dy / dist, s = (e.id & 1) ? 1 : -1, pull = clamp((dist - e.orR) / 50, -1, 1);
    M.mx = -uy * s + ux * pull * 0.6; M.my = ux * s + uy * pull * 0.6;
    const l = Math.hypot(M.mx, M.my) || 1; M.mx /= l; M.my /= l;
  },
  // Klikatec: letí k hráči v kličkách, přímé střely míjí.
  weave(e, d, dt, dist, dx, dy) {
    const a = Math.atan2(dy, dx) + Math.sin(e.t * 3.1 + e.id) * 0.95;
    M.mx = Math.cos(a); M.my = Math.sin(a);
  },
  // Přeskokan: na chvíli ztuhne (u hráče se objeví jeho přízrak) a pak se tam přenese.
  blink(e, d, dt, dist, dx, dy, frozen) {
    e.stT -= dt;
    if (e.st === 1) {
      M.sp = 0;
      if (e.stT <= 0 && !frozen) {
        burst(e.x, e.y, e.color, 10, 220, 3, 0.4);
        e.x = e.bx; e.y = e.by; e.kx = 0; e.ky = 0;
        burst(e.x, e.y, e.color, 14, 260, 3, 0.45);
        e.st = 0; e.stT = rand(3.4, 4.8);
        Sound.play.zap();
      }
    } else if (e.stT <= 0 && dist > 170 && dist < 760 && !frozen) {
      const p = G.p, a = Math.random() * TAU, r = rand(90, 135), lead = Math.hypot(p.vx, p.vy) > 40 ? 0.5 : 0;
      e.bx = p.x + p.vx * lead + Math.cos(a) * r; e.by = p.y + p.vy * lead + Math.sin(a) * r;
      e.st = 1; e.stT = 0.8;
    }
  },
  // Beran: točí se pomalu, ale v přímce zrychluje až na 270; dá se mu uhnout do strany.
  ram(e, d, dt, dist, dx, dy) {
    if (e.v === undefined) { e.v = e.speed; e.ang = Math.atan2(dy, dx); }
    const diff = angDiff(e.ang, Math.atan2(dy, dx));
    e.ang += clamp(diff, -1.15 * dt, 1.15 * dt);
    const top = d.top * spdMul();
    e.v = Math.abs(diff) < 0.4 ? Math.min(top, e.v + 170 * dt) : Math.max(e.speed, e.v - 300 * dt);
    M.mx = Math.cos(e.ang); M.my = Math.sin(e.ang); M.sp = e.v * (e.slowT > 0 ? 1 - e.slow : 1);
    if (e.v > top * 0.7 && G.particles.length < MAX_PARTICLES && Math.random() < 0.5) G.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 6, color: e.color, drag: 0 });
  },
  // Žhavec: proletí kolem hráče a za sebou nechá hořící stopu.
  trail(e, d, dt, dist, dx, dy, frozen) {
    const p = G.p;
    e.tgT = (e.tgT || 0) - dt;
    if (e.tgx === undefined || e.tgT <= 0 || d2(e.x, e.y, e.tgx, e.tgy) < 40 * 40) {
      e.tgx = p.x + dx / dist * 240 + rand(-60, 60); e.tgy = p.y + dy / dist * 240 + rand(-60, 60); e.tgT = 3.2;
    }
    const tx = e.tgx - e.x, ty = e.tgy - e.y, tl = Math.hypot(tx, ty) || 1;
    M.mx = tx / tl; M.my = ty / tl;
    e.fT = (e.fT || 0) - dt;
    if (e.fT <= 0 && !frozen && G.fireN < 160 && dist < G.viewR * 1.1) {
      e.fT = 0.15;
      G.effects.push({ k: 'efire', x: e.x, y: e.y, r: 17, life: 2.4, max: 2.4, dmg: d.fire * dmgMul(), color: e.color });
    }
  },
  // Zuřivec: pod polovinou zdraví se rozzuří (rychlejší, silnější, točí se).
  rage(e, d) {
    if (!e.rage && e.hp < e.maxHp * 0.5) {
      e.rage = true; e.dmg *= 1.4; e.color = '#ff0033';
      burst(e.x, e.y, '#ff0033', 12, 260, 3, 0.4);
      addText(e.x, e.y - e.r - 6, '!', '#ff4d5e', 18);
    }
    if (e.rage) M.sp *= 1.9;
  },
  // Ostrostřelec: drží se daleko, zamíří laserem (poslední 0,3 s už nepřemíří) a vypálí rychlou střelu.
  snipe(e, d, dt, dist, dx, dy, frozen) {
    e.stT -= dt;
    if (e.st === 1) {
      M.sp = 0;
      if (e.stT > 0.3) e.ang = Math.atan2(dy, dx);
      if (e.stT <= 0 && !frozen) {
        fireE(e.x, e.y, e.ang, 760, d.shot * dmgMul(), e.color, 6);
        Sound.play.laser();
        e.st = 0; e.stT = rand(3.6, 4.6);
      }
      return;
    }
    keepRange(e, dist, dx, dy, 420, 580);
    if (e.stT <= 0 && dist < 700 && !frozen) { e.st = 1; e.stT = 1.15; e.ang = Math.atan2(dy, dx); }
  },
  // Pulzar: zblízka zpomalí, rozzáří se a vystřelí prstenec střel do všech stran.
  pulse(e, d, dt, dist, dx, dy, frozen) {
    if (dist < 360) M.sp *= 0.25;
    e.stT -= dt;
    if (e.stT <= 0) {
      e.stT = rand(3.1, 3.7);
      if (dist < 560 && !frozen) {
        const n = d.burst, off = e.t * 0.7;
        for (let i = 0; i < n; i++) fireE(e.x, e.y, off + i / n * TAU, 165, d.bulletDmg * dmgMul(), e.color, 6);
        Sound.play.eshoot();
      }
    }
  },
  // Minomet: z dálky hází granáty tam, kam hráč míří; kruh na zemi ukazuje dopad.
  mortar(e, d, dt, dist, dx, dy, frozen) {
    keepRange(e, dist, dx, dy, 330, 520);
    e.stT -= dt;
    if (e.stT <= 0) {
      e.stT = rand(4.2, 5.2);
      if (dist < 760 && !frozen && G.shellN < 40) {
        const p = G.p;
        G.effects.push({ k: 'eshell', x: p.x + p.vx * 0.7, y: p.y + p.vy * 0.7, r: 70, t: 0, delay: 1.45, life: 9, dmg: d.shell * dmgMul(), color: e.color, sx: e.x, sy: e.y });
        Sound.play.eshoot();
      }
    }
  },
  // Raketník: odpaluje pomalé navigované rakety, které jdou sestřelit.
  launch(e, d, dt, dist, dx, dy, frozen) {
    keepRange(e, dist, dx, dy, 420, 600);
    e.stT -= dt;
    if (e.stT <= 0) {
      e.stT = rand(4.6, 5.8);
      if (dist < 800 && !frozen && G.enemies.length < FOE_CAP) {
        const r = spawnEnemyAt('rocket', e.x, e.y);
        r.ang = Math.atan2(dy, dx) + rand(-0.6, 0.6); r.life = 7;
        Sound.play.missile();
      }
    }
  },
  homing(e, d, dt, dist, dx, dy, frozen) {
    if (e.ang === undefined) e.ang = Math.atan2(dy, dx);
    e.ang += clamp(angDiff(e.ang, Math.atan2(dy, dx)), -2.1 * dt, 2.1 * dt);
    M.mx = Math.cos(e.ang); M.my = Math.sin(e.ang); M.noHit = true;
    e.life = (e.life === undefined ? 7 : e.life) - dt;
    if (G.particles.length < MAX_PARTICLES && Math.random() < 0.6) G.particles.push({ x: e.x - M.mx * 8, y: e.y - M.my * 8, vx: -M.mx * 60, vy: -M.my * 60, life: 0.3, max: 0.3, size: 3, color: '#ffd166', drag: 3 });
    if (!frozen && dist < e.r + G.p.r + 4) foeBoom(e, 46, e.dmg);
    else if (e.life <= 0) foeBoom(e, 30, 0);
  },
  // Ošetřovatel: drží se za ostatními a vlna ze středu léčí zraněné spojence.
  medic(e, d, dt, dist, dx, dy, frozen) {
    keepRange(e, dist, dx, dy, 250, 380);
    e.stT -= dt;
    if (e.stT > 0 || frozen) return;
    e.stT = rand(2.9, 3.5);
    let healed = 0;
    G.grid.query(e.x, e.y, 190 + G.maxR, _qF);
    for (const o of _qF) {
      if (o === e || o.dead || o.boss || o.hp >= o.maxHp || d2(o.x, o.y, e.x, e.y) > 190 * 190) continue;
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.22); healed++;
    }
    if (healed) G.effects.push({ k: 'ring', x: e.x, y: e.y, r: 10, maxR: 190, spd: 480, dmg: 0, knock: 0, life: 1, color: e.color, visual: true, delay: 0, thick: 3 });
  },
  // Clona: spojenci v jejím dosahu dostávají poloviční zranění.
  aegis(e, d, dt) { aura(e, dt, d.aura, PROT); },
  // Velitel: spojenci v jeho dosahu jsou o 40 % rychlejší.
  command(e, d, dt) { aura(e, dt, d.aura, HASTE); },
  // Fázovač: každé 4 s na 1,4 s zprůsvitní; střely jím projdou, ale ani on nezraní.
  phase(e) {
    e.phased = (e.t + (e.id % 7) * 0.57) % 4 < 1.4;
    if (e.phased) { M.sp *= 1.3; M.noHit = true; }
  },
  // Štítník: štít vpředu pohltí 80 % zranění; otáčí se pomalu, takže ho jde obletět.
  bulwark(e, d, dt, dist, dx, dy) {
    if (e.ang === undefined) e.ang = Math.atan2(dy, dx);
    e.ang += clamp(angDiff(e.ang, Math.atan2(dy, dx)), -1.25 * dt, 1.25 * dt);
  },
  // Nosič: pomalá matka, která každé ~4 s vypustí trojici larev.
  carrier(e, d, dt, dist, dx, dy, frozen) {
    e.stT -= dt;
    if (e.stT > 0) return;
    e.stT = rand(3.8, 4.6);
    if (frozen || dist > G.viewR * 1.2 || G.enemies.length >= FOE_CAP) return;
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * TAU, m = spawnEnemyAt('larva', e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r);
      m.kx = Math.cos(a) * 220; m.ky = Math.sin(a) * 220;
    }
  },
  // Minér: krouží kolem hráče a klade miny (zapnou se po chvíli, dají se zničit).
  layer(e, d, dt, dist, dx, dy, frozen) {
    keepRange(e, dist, dx, dy, 200, 320); M.sp *= 1.1;
    e.stT -= dt;
    if (e.stT > 0) return;
    e.stT = rand(2.0, 2.6);
    if (!frozen && G.mineN < 36 && dist < G.viewR && G.enemies.length < FOE_CAP) { const m = spawnEnemyAt('emine', e.x, e.y); m.arm = 0.9; m.life = 16; Sound.play.mine(); }
  },
  mine(e, d, dt, dist, dx, dy, frozen) {
    M.lock = true; G.mineCount++;
    e.arm -= dt; e.life -= dt;
    if (!frozen && e.arm <= 0 && dist < 50) foeBoom(e, 64, ENEMIES.minelayer.mineDmg * dmgMul());
    else if (e.life <= 0) { e.dead = true; burst(e.x, e.y, e.color, 5, 120, 2, 0.3); }
  },
  // Mrazivec: v jeho mrazivé auře hráč zpomalí o třetinu.
  frost(e, d, dt, dist) { if (dist < d.aura) G.pSlowN = Math.max(G.pSlowN, 0.35); },
  // Gravitar: přitahuje hráče k sobě (úskok se vytrhne).
  grav(e, d, dt, dist, dx, dy, frozen) {
    const p = G.p;
    if (!frozen && dist < d.aura && p.dashT <= 0) {
      const pull = (1 - dist / d.aura) * 80 + 20;
      p.x -= dx / dist * pull * dt; p.y -= dy / dist * pull * dt;
    }
  },
  // Pijavice: přisaje se, saje zdraví a zpomaluje; setřese ji úskok.
  leech(e, d, dt, dist, dx, dy, frozen) {
    const p = G.p;
    if (e.att) {
      M.lock = true;
      e.x = p.x + Math.cos(e.attA) * e.attD; e.y = p.y + Math.sin(e.attA) * e.attD; e.rot = e.attA + Math.PI;
      G.pSlowN += 0.12;
      e.attT -= dt;
      if (e.attT <= 0 && !frozen) { e.attT = 0.7; hurtPlayer(e.dmg); }
      return;
    }
    if (!frozen && dist < e.r + p.r && G.time > (e.noAtt || 0)) {
      e.att = true; e.attA = Math.atan2(e.y - p.y, e.x - p.x); e.attD = p.r + e.r * 0.5; e.attT = 0.35;
      M.lock = true;
    }
  },
  // Mrchožrout: sbírá krystaly zkušeností, roste z nich a po smrti je vrátí i s úrokem.
  scav(e, d, dt) {
    e.scT = (e.scT || 0) - dt;
    if (e.scT <= 0) {
      e.scT = 0.4; e.food = null;
      let bd = 520 * 520;
      for (const g of G.pickups) {
        if (g.dead || g.kind !== 'gem' || g.mag) continue;
        const dd = d2(e.x, e.y, g.x, g.y);
        if (dd < bd) { bd = dd; e.food = g; }
      }
    }
    const g = e.food;
    if (g && !g.dead && !g.mag) {
      const tx = g.x - e.x, ty = g.y - e.y, tl = Math.hypot(tx, ty) || 1;
      M.mx = tx / tl; M.my = ty / tl; M.sp *= 1.15;
      if (tl < e.r + 10) {
        g.dead = true; e.food = null; e.ate = (e.ate || 0) + g.val;
        const gain = g.val * 2.5 * hpMul();
        e.hp += gain; e.maxHp += gain;
        e.r = e.d.r * (e.elite ? 1.75 : 1) * Math.min(1.9, 1 + Math.sqrt(e.ate) * 0.06);
        burst(g.x, g.y, '#06ffa5', 5, 120, 2, 0.3);
      }
    } else e.food = null;
    e.ang = Math.atan2(M.my, M.mx);
  },
  // Dvojčata: drží se po stranách hráče a energetické lano mezi nimi pálí; po smrti jednoho
  // se druhé rozzuří.
  twin(e, d, dt, dist, dx, dy, frozen) {
    const m = e.mate, p = G.p;
    if (!m || m.dead) {
      if (!e.lone) { e.lone = true; e.speed *= 1.5; e.dmg *= 1.3; burst(e.x, e.y, e.color, 12, 240, 3, 0.4); }
      e.ang = Math.atan2(dy, dx);
      return;
    }
    const th = e.pairA + G.time * 0.55;
    const tx = p.x + Math.cos(th) * 150 * e.side - e.x, ty = p.y + Math.sin(th) * 150 * e.side - e.y, tl = Math.hypot(tx, ty) || 1;
    M.mx = tx / tl; M.my = ty / tl;
    if (tl < 30) M.sp *= tl / 30;
    e.ang = Math.atan2(m.y - e.y, m.x - e.x);
    if (e.side < 0 || frozen) return; // zásah lanem počítá jen jedno z dvojčat
    const L2 = d2(e.x, e.y, m.x, m.y);
    if (L2 > TETHER * TETHER) return;
    const t = clamp(((p.x - e.x) * (m.x - e.x) + (p.y - e.y) * (m.y - e.y)) / (L2 || 1), 0, 1);
    const qx = e.x + (m.x - e.x) * t, qy = e.y + (m.y - e.y) * t;
    if (d2(p.x, p.y, qx, qy) < (p.r + 4) * (p.r + 4)) hurtPlayer(d.tether * dmgMul(), qx, qy);
  },
};
const TETHER = 520;
