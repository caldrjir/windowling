'use strict';
// Echoes of the Hollow Sun – P0: simulace boje. Pevný tick 30 Hz, seedované RNG, vstup jako příkazy (D21).
// Žádná závislost na vykreslování: renderer čte stav a události, test ji pouští v Node.
(function (root) {
  const HS = root.HS;
  const TICK = 1 / 30;
  const ARENA = 18; // poloměr arény (m)
  const PLAYER_R = 0.5, PLAYER_SPEED = 5.2;
  const DODGE = { dist: 5.5, time: 0.3, iframes: 0.25, cd: 0.9 };
  const WINDUP = 0.4; // zásah přichází po 40 % času akce (Casting Lifecycle v Bible)
  const ER = { en_thrall: 0.45, en_brute: 0.95 };

  function rng(seed) {
    let h = 1779033703 ^ String(seed).length;
    for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const len = (x, z) => Math.hypot(x, z);
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
  const PILLARS = [[-7, -6, 1.1], [7, -6, 1.1], [-7, 6, 1.1], [7, 6, 1.1], [0, -11, 1.4], [0, 11, 1.4]];

  function create(opts) {
    opts = opts || {};
    const L = opts.level || HS.D.level;
    const ch = HS.calcChar(L);
    const skills = {};
    for (const sk of HS.D.skills) { const sl = HS.F.maxSkillLevel(L, sk.req); skills[sk.id] = { sk, sl, cd: 0, hit: {} }; for (const e of HS.D.enemies) skills[sk.id].hit[e.id] = HS.computeHit(sk, sl, ch, HS.refEnemy(L, e.id)); }
    const s = {
      L, ch, skills, rnd: rng(opts.seed || 'hollow-p0'), t: 0, tick: 0, mode: opts.mode || 'arena', wave: 0, kills: 0, over: false, nextId: 1,
      player: { x: 0, z: 0, face: 0, hp: ch.S.hp, hpMax: ch.S.hp, res: 30, resMax: ch.S.res, act: null, dodge: null, dodgeCd: 0, stun: 0, moveTo: null, invuln: !!opts.invuln, dmgTaken: 0 },
      enemies: [], pillars: PILLARS, events: [], stats: { hits: 0, crits: 0, dmg: 0, taken: 0, dodged: 0, casts: {} },
    };
    if (s.mode === 'bench') spawnBench(s, opts.benchCount || 50); else nextWave(s);
    return s;
  }
  function spawn(s, id, x, z) {
    const def = HS.D.enemies.find((e) => e.id === id); const en = HS.refEnemy(s.L, id);
    const e = { id: s.nextId++, type: id, def, x, z, face: 0, hp: en.hp, hpMax: en.hp, armor: en.armor, eva: en.eva, res: en.res, r: ER[id], speed: def.ms, atk: null, cds: HS.D.attacks[id].map(() => 0.5 + s.rnd()), stun: 0, burn: [], flash: 0, dead: false, push: [0, 0] };
    s.enemies.push(e); return e;
  }
  function ring(s, n, r0) { const out = []; const off = s.rnd() * Math.PI * 2; for (let i = 0; i < n; i++) { const a = off + (i / n) * Math.PI * 2 + (s.rnd() - 0.5) * 0.3; const r = r0 - s.rnd() * 2; out.push([Math.cos(a) * r, Math.sin(a) * r]); } return out; }
  function nextWave(s) {
    s.wave++; const nT = 5 + 3 * s.wave, nB = Math.floor(s.wave / 2);
    ring(s, nT, ARENA - 1).forEach(([x, z]) => spawn(s, 'en_thrall', x, z));
    ring(s, nB, ARENA - 2).forEach(([x, z]) => spawn(s, 'en_brute', x, z));
    s.events.push({ t: 'wave', wave: s.wave, n: nT + nB });
  }
  function spawnBench(s, n) {
    const nB = Math.round(n / 5);
    ring(s, n - nB, ARENA - 1).forEach(([x, z]) => spawn(s, 'en_thrall', x, z));
    ring(s, nB, ARENA - 3).forEach(([x, z]) => spawn(s, 'en_brute', x, z));
    s.events.push({ t: 'wave', wave: 0, n });
  }

  /* hráč zasáhne nepřítele: hod na zásah a crit, poškození z computeHit (bez očekávaného critu) */
  function strike(s, e, slot, mult) {
    const h = slot.hit[e.type]; const sk = slot.sk;
    if (s.rnd() > h.hitChance) { s.events.push({ t: 'miss', x: e.x, z: e.z }); return false; }
    const crit = s.rnd() < h.critChance; const S = s.ch.S;
    let dmg = (h.perHit / h.eCrit) * (crit ? S.critMult : 1) * (mult || 1) * (0.9 + s.rnd() * 0.2);
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.flash = 0.1; s.stats.hits++; s.stats.dmg += dmg; if (crit) s.stats.crits++;
    if (sk.dot) e.burn.push({ left: sk.dot.dur, dps: (h.dot / h.hitChance) / sk.dot.dur });
    const kb = sk.id === 'ak_slam' ? 1.4 : sk.id === 'ak_charge' ? 2 : 0.6; const d = len(e.x - s.player.x, e.z - s.player.z) || 1;
    if (e.type !== 'en_brute') { e.push[0] += ((e.x - s.player.x) / d) * kb; e.push[1] += ((e.z - s.player.z) / d) * kb; }
    s.events.push({ t: 'hit', id: e.id, x: e.x, z: e.z, dmg, crit, skill: sk.id, type: sk.conv ? 'fire' : 'phys' });
    if (e.hp <= 0) kill(s, e);
    return true;
  }
  function kill(s, e) { if (e.dead) return; e.dead = true; s.kills++; s.events.push({ t: 'death', id: e.id, x: e.x, z: e.z, type: e.type }); }

  function startSkill(s, id, aim) {
    const p = s.player; const slot = s.skills[id]; if (!slot || p.act || p.dodge || p.stun > 0) return false;
    const h = slot.hit.en_thrall; if (slot.cd > 0) return false; if (h.cost > 0 && p.res < h.cost) { s.events.push({ t: 'nores', skill: id }); return false; }
    if (aim) p.face = Math.atan2(aim[1] - p.z, aim[0] - p.x);
    p.res = Math.min(p.resMax, p.res - Math.max(0, h.cost));
    slot.cd = h.cd || 0;
    const act = { id, slot, t: 0, dur: h.actTime, fired: false, aim: aim ? aim.slice() : [p.x + Math.cos(p.face), p.z + Math.sin(p.face)] };
    if (id === 'ak_charge') { const dx = act.aim[0] - p.x, dz = act.aim[1] - p.z; const d = Math.min(slot.sk.r, len(dx, dz)); act.from = [p.x, p.z]; act.to = [p.x + Math.cos(p.face) * d, p.z + Math.sin(p.face) * d]; act.hitIds = new Set(); act.stunned = false; }
    p.act = act; p.moveTo = null; s.stats.casts[id] = (s.stats.casts[id] || 0) + 1;
    s.events.push({ t: 'cast', skill: id, x: p.x, z: p.z, face: p.face, dur: h.actTime });
    return true;
  }
  function fire(s, act) {
    const p = s.player; const sk = act.slot.sk; let hits = 0;
    if (sk.id === 'ak_cleave') {
      const half = (150 / 2) * (Math.PI / 180);
      for (const e of s.enemies) { if (e.dead) continue; const dx = e.x - p.x, dz = e.z - p.z; if (len(dx, dz) - e.r > sk.r) continue; if (angDiff(Math.atan2(dz, dx), p.face) > half) continue; if (strike(s, e, act.slot)) hits++; }
      if (hits) p.res = Math.min(p.resMax, p.res + 8 + Math.min(8, 2 * (hits - 1)));
      s.events.push({ t: 'swing', x: p.x, z: p.z, face: p.face, r: sk.r, w: 150, hits });
      if (hits) s.events.push({ t: 'hitstop', ms: 45 + Math.min(4, hits) * 8 });
    } else if (sk.id === 'ak_slam') {
      const dx = act.aim[0] - p.x, dz = act.aim[1] - p.z; const d = Math.min(sk.r, len(dx, dz)); const cx = p.x + Math.cos(p.face) * d, cz = p.z + Math.sin(p.face) * d; const R = 3.5;
      for (const e of s.enemies) { if (e.dead) continue; if (len(e.x - cx, e.z - cz) - e.r > R) continue; if (strike(s, e, act.slot)) hits++; }
      s.events.push({ t: 'slam', x: cx, z: cz, r: R, hits }); s.events.push({ t: 'hitstop', ms: hits ? 90 : 40 }); s.events.push({ t: 'shake', amp: 0.35 });
    }
    return hits;
  }

  function updatePlayer(s, inp) {
    const p = s.player; const dt = TICK;
    for (const id in s.skills) s.skills[id].cd = Math.max(0, s.skills[id].cd - dt);
    p.dodgeCd = Math.max(0, p.dodgeCd - dt); p.stun = Math.max(0, p.stun - dt);
    p.hp = Math.min(p.hpMax, p.hp + s.ch.S.hpRegen * dt);
    if (p.hp <= 0) return;
    if (inp.dodge && !p.dodge && p.dodgeCd <= 0 && p.stun <= 0) {
      let dx = inp.move ? inp.move[0] : Math.cos(p.face), dz = inp.move ? inp.move[1] : Math.sin(p.face); if (!dx && !dz) { dx = Math.cos(p.face); dz = Math.sin(p.face); }
      const d = len(dx, dz) || 1; p.dodge = { t: 0, dx: dx / d, dz: dz / d }; p.dodgeCd = DODGE.cd; p.act = null; p.moveTo = null; s.events.push({ t: 'dodge', x: p.x, z: p.z });
    }
    if (p.dodge) { p.dodge.t += dt; const v = DODGE.dist / DODGE.time; move(s, p, p.dodge.dx * v * dt, p.dodge.dz * v * dt, PLAYER_R); if (p.dodge.t >= DODGE.time) p.dodge = null; return; }
    if (p.stun > 0) return;
    if (!p.act) {
      if (inp.cast) startSkill(s, inp.cast, inp.aim);
      else if (inp.hold && inp.aim) startSkill(s, 'ak_cleave', inp.aim);
    }
    if (p.act) {
      const a = p.act; a.t += dt;
      if (a.id === 'ak_charge') {
        const k = Math.min(1, a.t / a.dur); const nx = a.from[0] + (a.to[0] - a.from[0]) * k, nz = a.from[1] + (a.to[1] - a.from[1]) * k; move(s, p, nx - p.x, nz - p.z, PLAYER_R);
        for (const e of s.enemies) { if (e.dead || a.hitIds.has(e.id)) continue; if (len(e.x - p.x, e.z - p.z) - e.r > 0.75 + PLAYER_R) continue; a.hitIds.add(e.id); if (strike(s, e, a.slot) && !a.stunned && e.type !== 'en_brute') { e.stun = 0.6; e.atk = null; a.stunned = true; } }
        if (k >= 1) { if (a.hitIds.size) { a.slot.cd = Math.max(0, a.slot.cd - 0.5 * a.hitIds.size); s.events.push({ t: 'hitstop', ms: 60 }); } p.act = null; }
        return;
      }
      if (!a.fired && a.t >= a.dur * WINDUP) { a.fired = true; fire(s, a); }
      if (a.t >= a.dur) p.act = null;
      return;
    }
    let mx = 0, mz = 0;
    if (inp.move && (inp.move[0] || inp.move[1])) { mx = inp.move[0]; mz = inp.move[1]; p.moveTo = null; }
    else if (inp.moveTo) p.moveTo = inp.moveTo.slice();
    if (!mx && !mz && p.moveTo) { const dx = p.moveTo[0] - p.x, dz = p.moveTo[1] - p.z; const d = len(dx, dz); if (d < 0.15) p.moveTo = null; else { mx = dx / d; mz = dz / d; } }
    const d = len(mx, mz);
    if (d > 0) { mx /= d; mz /= d; move(s, p, mx * PLAYER_SPEED * dt, mz * PLAYER_SPEED * dt, PLAYER_R); if (!inp.aim) p.face = Math.atan2(mz, mx); }
    if (inp.aim) p.face = Math.atan2(inp.aim[1] - p.z, inp.aim[0] - p.x);
  }
  function move(s, o, dx, dz, r) {
    o.x += dx; o.z += dz;
    for (const [px, pz, pr] of s.pillars) { const ddx = o.x - px, ddz = o.z - pz; const d = len(ddx, ddz); const min = pr + r; if (d < min && d > 1e-6) { o.x = px + (ddx / d) * min; o.z = pz + (ddz / d) * min; } }
    const d = len(o.x, o.z); if (d > ARENA - r) { o.x *= (ARENA - r) / d; o.z *= (ARENA - r) / d; }
  }
  function inShape(s, e, atk, tx, tz) {
    const p = s.player; const a = atk.def;
    if (a.shape === 'circle') return len(p.x - tx, p.z - tz) <= a.range + PLAYER_R;
    const dx = p.x - e.x, dz = p.z - e.z; if (len(dx, dz) > a.range + PLAYER_R) return false;
    return angDiff(Math.atan2(dz, dx), atk.face) <= ((a.w / 2) * Math.PI) / 180 + 0.15;
  }
  function hurtPlayer(s, e, a) {
    const p = s.player; const L = s.L; const S = s.ch.S;
    if (p.dodge && p.dodge.t <= DODGE.iframes) { s.stats.dodged++; s.events.push({ t: 'dodged', x: p.x, z: p.z }); return; }
    if (s.rnd() < S.evade) { s.events.push({ t: 'evade', x: p.x, z: p.z }); return; }
    const raw = HS.F.enemyDmg(L, e.def.dmgMul * a.mul) * (0.9 + s.rnd() * 0.2);
    const dmg = Math.max(1, Math.round(raw * (1 - S.dr)));
    s.stats.taken += dmg; if (!p.invuln) p.hp -= dmg;
    if (a.stun) { p.stun = Math.max(p.stun, a.stun); p.act = null; }
    s.events.push({ t: 'hurt', dmg, x: p.x, z: p.z, by: e.type }); s.events.push({ t: 'shake', amp: a.mul >= 1.5 ? 0.3 : 0.15 });
    if (p.hp <= 0 && !p.invuln) { p.hp = 0; s.over = true; s.events.push({ t: 'over', wave: s.wave, kills: s.kills }); }
  }
  function updateEnemies(s) {
    const dt = TICK; const p = s.player; const alive = s.enemies.filter((e) => !e.dead);
    for (const e of alive) {
      e.flash = Math.max(0, e.flash - dt);
      if (e.burn.length) { let bd = 0; for (const b of e.burn) { const t = Math.min(dt, b.left); bd += b.dps * t; b.left -= dt; } e.burn = e.burn.filter((b) => b.left > 0); e.burnAcc = (e.burnAcc || 0) + bd; if (e.burnAcc >= 1) { const d = Math.floor(e.burnAcc); e.burnAcc -= d; e.hp -= d; s.stats.dmg += d; if (s.tick % 10 === 0) s.events.push({ t: 'burn', id: e.id, x: e.x, z: e.z, dmg: d }); if (e.hp <= 0) { kill(s, e); continue; } } }
      // odstrčení se tlumí
      if (e.push[0] || e.push[1]) { move(s, e, e.push[0] * dt * 6, e.push[1] * dt * 6, e.r); e.push[0] *= 0.7; e.push[1] *= 0.7; if (Math.abs(e.push[0]) + Math.abs(e.push[1]) < 0.01) e.push = [0, 0]; }
      e.cds = e.cds.map((c) => Math.max(0, c - dt));
      if (e.stun > 0) { e.stun -= dt; continue; }
      const dx = p.x - e.x, dz = p.z - e.z; const d = len(dx, dz);
      if (e.atk) {
        e.atk.t += dt;
        if (e.atk.t >= e.atk.def.tele) { if (p.hp > 0 && inShape(s, e, e.atk, e.atk.tx, e.atk.tz)) hurtPlayer(s, e, e.atk.def); e.cds[e.atk.i] = e.atk.def.cd; e.atk = null; e.recover = 0.35; }
        continue;
      }
      if (e.recover > 0) { e.recover -= dt; continue; }
      if (s.over) continue;
      e.face = Math.atan2(dz, dx);
      const atks = HS.D.attacks[e.type];
      let chosen = -1; for (let i = atks.length - 1; i >= 0; i--) { if (e.cds[i] > 0) continue; const reach = atks[i].shape === 'circle' ? atks[i].range * 0.8 : atks[i].range + PLAYER_R * 0.5; if (d - e.r <= reach) { chosen = i; break; } }
      if (chosen >= 0) { const a = atks[chosen]; e.atk = { i: chosen, def: a, t: 0, face: e.face, tx: a.shape === 'circle' ? e.x : p.x, tz: a.shape === 'circle' ? e.z : p.z }; s.events.push({ t: 'tele', id: e.id, shape: a.shape, x: e.x, z: e.z, face: e.face, r: a.range, w: a.w || 360, dur: a.tele }); continue; }
      if (d > e.r + PLAYER_R + 0.2) move(s, e, (dx / d) * e.speed * dt, (dz / d) * e.speed * dt, e.r);
    }
    // oddělení nepřátel (měkké kolize)
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j]; const dx = b.x - a.x, dz = b.z - a.z; const d = len(dx, dz); const min = a.r + b.r; if (d >= min || d < 1e-6) continue;
      const k = ((min - d) / d) * 0.5; const wa = b.r / (a.r + b.r), wb = a.r / (a.r + b.r); a.x -= dx * k * wa; a.z -= dz * k * wa; b.x += dx * k * wb; b.z += dz * k * wb;
    }
    for (const e of alive) { const dx = e.x - p.x, dz = e.z - p.z; const d = len(dx, dz); const min = e.r + PLAYER_R; if (d < min && d > 1e-6) { e.x = p.x + (dx / d) * min; e.z = p.z + (dz / d) * min; } }
  }
  function step(s, inp) {
    s.events.length = 0; if (s.over) return s;
    s.tick++; s.t += TICK;
    updatePlayer(s, inp || {});
    updateEnemies(s);
    if (s.enemies.length > 300) s.enemies = s.enemies.filter((e) => !e.dead);
    if (s.mode === 'arena' && !s.over && s.enemies.every((e) => e.dead)) { s.enemies = []; nextWave(s); }
    if (s.mode === 'bench' && s.enemies.every((e) => e.dead)) { s.enemies = []; spawnBench(s, 50); }
    return s;
  }
  // jednoduchý autopilot pro benchmark a testy: drží se u středu, seká nejbližšího a občas použije Slam a Charge
  function autopilot(s) {
    const p = s.player; let best = null, bd = 1e9;
    for (const e of s.enemies) { if (e.dead) continue; const d = len(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; best = e; } }
    if (!best) return {};
    const aim = [best.x, best.z]; const inp = { aim };
    const tele = s.enemies.some((e) => e.atk && e.atk.def.mul >= 1.2 && e.atk.t > e.atk.def.tele - 0.35 && len(e.x - p.x, e.z - p.z) < 4);
    if (tele && p.dodgeCd <= 0) { inp.dodge = true; inp.move = [p.x - best.x || 1, p.z - best.z]; return inp; }
    if (bd > 3 && s.skills.ak_charge.cd <= 0 && p.res >= 20) inp.cast = 'ak_charge';
    else if (p.res >= 40 && s.skills.ak_slam.cd <= 0 && bd < 3.5) inp.cast = 'ak_slam';
    else if (bd <= s.skills.ak_cleave.sk.r + best.r) inp.hold = true;
    else inp.move = [best.x - p.x, best.z - p.z];
    return inp;
  }
  root.HSim = { TICK, ARENA, PLAYER_R, DODGE, create, step, autopilot, rng };
})(typeof window !== 'undefined' ? window : globalThis);
