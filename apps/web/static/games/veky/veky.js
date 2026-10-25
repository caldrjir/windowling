'use strict';
// ── VĚKY VÁLEK · Windowling Hlavolamy ───────────────────────────────────────
// Na motivy Age of War: dvě základny na koncích bojiště. Za zlato cvičíš pěšáky, střelce a těžké
// jednotky, které samy pochodují proti soupeři. Za zabité nepřátele dostáváš zlato a zkušenosti;
// se zkušenostmi postoupíš do dalšího věku (pravěk, středověk, renesance, moderní doba,
// budoucnost) se silnějšími jednotkami, věžemi a zvláštním útokem. Vyhrává, kdo zboří cizí
// základnu. Soupeř se vyvíjí také; jeho rozhodování se bere ze semínka.
const Veky = (() => {
  const L = Kit.L;
  const W = 1800, VH = 400, GY = 336, BX = [92, W - 92], FRONT = [150, W - 150];
  const F = [1, 3, 9, 26, 75];
  const AGE_NAMES = [L('Pravěk', 'Stone Age'), L('Středověk', 'Middle Ages'), L('Renesance', 'Renaissance'), L('Moderní doba', 'Modern Age'), L('Budoucnost', 'Future')];
  const UNIT_NAMES = [
    [L('Pračlověk', 'Caveman'), L('Prakovník', 'Slinger'), L('Jezdec na dinu', 'Dino rider')],
    [L('Šermíř', 'Swordsman'), L('Lučištník', 'Archer'), L('Rytíř', 'Knight')],
    [L('Kordista', 'Duelist'), L('Mušketýr', 'Musketeer'), L('Kanón', 'Cannon')],
    [L('Voják s nožem', 'Knife soldier'), L('Střelec', 'Rifleman'), L('Tank', 'Tank')],
    [L('Robot s mečem', 'Blade robot'), L('Laserník', 'Laser trooper'), L('Bojový robot', 'War mech')],
  ];
  const TURRET_NAMES = [[L('Prak', 'Sling'), L('Kamenomet', 'Rock thrower')], [L('Kuše', 'Crossbow'), L('Balista', 'Ballista')], [L('Malé dělo', 'Small cannon'), L('Dělo', 'Cannon')], [L('Kulomet', 'Machine gun'), L('Raketomet', 'Rocket launcher')], [L('Laser', 'Laser'), L('Iontové dělo', 'Ion cannon')]];
  const SPECIAL_NAMES = [L('Meteorický déšť', 'Meteor shower'), L('Déšť šípů', 'Arrow rain'), L('Dělostřelba', 'Barrage'), L('Nálet', 'Air strike'), L('Orbitální laser', 'Orbital laser')];
  const BASEU = [
    { cost: 15, hp: 60, dmg: 15, rate: 1.0, range: 14, speed: 34, w: 20, train: 1.0 },
    { cost: 25, hp: 40, dmg: 9, rate: 1.15, range: 150, speed: 32, w: 20, train: 1.4 },
    { cost: 100, hp: 280, dmg: 40, rate: 1.3, range: 22, speed: 26, w: 56, train: 3.0 },
  ];
  const SHOTS = [['', 'stone', ''], ['', 'arrow', ''], ['', 'bullet', 'ball'], ['', 'bullet', 'shell'], ['', 'laser', 'laser']];
  const HEAVY = [{ w: 76 }, { w: 64 }, { w: 64, range: 170 }, { w: 64, range: 180 }, { w: 42, range: 160 }];
  const XP_NEED = [1000, 3500, 11000, 32000];
  const BASE_HP = [500, 1200, 3000, 8000, 22000];
  const DIFF = { lehka: { inc: 0.7, evo: 1.35, think: 1.6, mult: 0.7 }, normal: { inc: 1, evo: 1, think: 1.2, mult: 1 }, tezka: { inc: 1.35, evo: 0.75, think: 0.9, mult: 1.4 } };
  const DIFFS = [
    { id: 'lehka', name: L('Lehká', 'Easy'), note: L('pomalejší soupeř', 'a slower rival'), metric: 'score' },
    { id: 'normal', name: L('Normální', 'Normal'), note: L('vyrovnaná válka', 'a fair war'), metric: 'score' },
    { id: 'tezka', name: L('Těžká', 'Hard'), note: L('soupeř rychle postupuje věky', 'the rival advances fast'), metric: 'score' },
  ];
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  function stats(age, kind) {
    const b = BASEU[kind], f = F[age], h = kind === 2 ? HEAVY[age] : {};
    return { cost: b.cost * f, hp: b.hp * f, dmg: b.dmg * f, rate: b.rate, range: h.range || b.range, speed: b.speed, w: (h.w || b.w) * VkArt.UNIT_SCALE, train: b.train, shot: SHOTS[age][kind] };
  }
  function turretStats(age, kind) { const f = F[age]; return kind ? { cost: 300 * f, dmg: 26 * f, rate: 1.6, range: 330, splash: age >= 2 ? 40 : 0 } : { cost: 100 * f, dmg: 10 * f, rate: 1.0, range: 290, splash: 0 }; }
  function levelSpec(n) { return { power: Math.min(1.6, 0.68 + n * 0.0085), text: L(`Bitva ${n}`, `Battle ${n}`) }; }
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') { const s = levelSpec(ctx.key); return { seed, mode: 'level', diff: 'normal', power: s.power, text: s.text }; }
    if (ctx.kind === 'daily') return { seed, mode: 'daily', diff: 'normal', power: 1, text: L('Denní bitva', 'Daily battle') };
    return { seed, mode: 'free', diff: DIFF[diffId] ? diffId : 'normal', power: 1 };
  }

  function create(el, P, saved, api) {
    const D = DIFF[P.diff], power = P.power || 1;
    el.innerHTML = `<div class="vk-wrap">
      <div class="vk-stage"><canvas class="vk-cv"></canvas><div class="vk-msg" hidden></div></div>
      <div class="vk-bar">
        <div class="vk-units">${[0, 1, 2].map(k => `<button class="vk-u" data-u="${k}"><canvas width="64" height="64"></canvas><b></b><small></small></button>`).join('')}</div>
        <div class="vk-side">
          <button class="vk-b" data-a="tower">🏰<small>${L('věž', 'turret')}</small></button>
          <button class="vk-b" data-a="special">✸<small></small><i></i></button>
          <button class="vk-b evo" data-a="evolve">⏫<small>${L('nový věk', 'next age')}</small></button>
          <button class="vk-b" data-a="speed">1×<small>${L('rychlost', 'speed')}</small></button>
        </div>
      </div>
      <div class="vk-tower" hidden></div>
      <p class="vk-keys">${L('Táhni bojiště nebo klepni do minimapy. Klávesy 1 2 3 jednotky, ← → posun, Q věž, E speciál, P pauza', 'Drag the battlefield or tap the minimap. Keys 1 2 3 units, ← → scroll, Q turret, E special, P pause')}</p></div>`;
    const cv = el.querySelector('.vk-cv'), ctx = cv.getContext('2d'), msgEl = el.querySelector('.vk-msg'), towerEl = el.querySelector('.vk-tower');
    let cssW = 900, cssH = 400, dpr = 1, VW = 900;
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      cssW = Math.floor(Math.min(box - 2, 1200));
      cssH = Math.round(Math.max(220, Math.min(innerHeight - (innerWidth < 760 ? 250 : 230), cssW * (innerWidth < 760 ? 0.9 : 0.48))));
      VW = Math.min(W, Math.round(VH * cssW / cssH));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = cssW * dpr; cv.height = cssH * dpr; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
      camX = Math.max(0, Math.min(W - VW, camX));
    }

    // ── Stav ── side 0 = hráč, 1 = soupeř
    const rnd = rngOf(P.seed), fxr = rngOf(P.seed ^ 0xa11);
    const S = [0, 1].map(s => ({ age: 0, gold: 175, xp: 0, xpTotal: 0, hp: BASE_HP[0], maxHp: BASE_HP[0], queue: [], prog: 0, turrets: [null, null, null], spCd: 0, kills: 0 }));
    const units = [], shots = [], fx = [], pops = [], falls = [];
    let lands = [], camX = 0, clock = 0, over = false, paused = false, speed = 1, ending = 0, winner = -1, aiThink = 2, planeX = null;
    let started = false, uid = 1;
    function landOf(age) { if (!lands[age]) lands[age] = VkArt.land(W, VH, age, GY); return lands[age]; }
    function say(t, d = 1.8) { msgEl.textContent = t; msgEl.hidden = false; msgEl.dataset.t = d; }
    function pop(x, y, text, col) { pops.push({ x, y, text, col, life: 1.1 }); }

    // ── Akce ──
    function train(s, kind) {
      const sd = S[s], st = stats(sd.age, kind);
      if (over || sd.queue.length >= 5 || sd.gold < st.cost) { if (s === 0 && !over) api.sound('error'); return false; }
      sd.gold -= st.cost; sd.queue.push({ kind, age: sd.age });
      if (s === 0) { api.sound('tap'); kick(); syncUI(); }
      return true;
    }
    function spawn(s, q) {
      const st = stats(q.age, q.kind);
      units.push({ id: uid++, side: s, age: q.age, kind: q.kind, x: s ? FRONT[1] + 10 : FRONT[0] - 10, y: GY, hp: st.hp, max: st.hp, st, cd: 0.4, atk: 0, walk: 0, hit: 0, dead: 0 });
    }
    function buyTurret(s, kind) {
      const sd = S[s], slot = sd.turrets.indexOf(null), ts = turretStats(sd.age, kind);
      if (slot < 0 || sd.gold < ts.cost) { if (s === 0) api.sound('error'); return false; }
      sd.gold -= ts.cost; sd.turrets[slot] = { age: sd.age, kind, cd: 0, ang: s ? Math.PI : 0, ts };
      if (s === 0) { api.sound('place'); syncUI(); renderTower(); }
      return true;
    }
    function sellTurret(s) {
      const sd = S[s]; let i = 2; while (i >= 0 && !sd.turrets[i]) i--;
      if (i < 0) return;
      sd.gold += Math.round(sd.turrets[i].ts.cost / 2); sd.turrets[i] = null;
      if (s === 0) { api.sound('erase'); syncUI(); renderTower(); }
    }
    function evolve(s) {
      const sd = S[s]; if (sd.age >= 4) return false;
      const need = XP_NEED[sd.age] * (s ? D.evo / power : 1);
      if (sd.xp < need) return false;
      sd.xp -= need; sd.age++;
      const frac = sd.hp / sd.maxHp; sd.maxHp = BASE_HP[sd.age]; sd.hp = Math.min(sd.maxHp, sd.maxHp * frac + sd.maxHp * 0.15);
      if (s === 0) { api.sound('win'); say(`${L('Nový věk', 'New age')}: ${AGE_NAMES[sd.age]}!`, 2.4); VkMusic.setAge(sd.age); syncUI(); renderIcons(); }
      else say(`${L('Soupeř vstoupil do věku', 'The rival entered the')} ${AGE_NAMES[sd.age]}`, 2);
      return true;
    }
    function special(s) {
      const sd = S[s]; if (sd.spCd > 0 || over) return false;
      sd.spCd = 50; const age = sd.age, dmg = 70 * F[age];
      if (age === 3) planeX = { x: s ? W + 60 : -60, dir: s ? -1 : 1, side: s, drops: 0, dmg };
      else {
        const n = age === 4 ? 9 : age === 1 ? 26 : 16;
        for (let i = 0; i < n; i++) {
          const tx = s ? FRONT[0] + 40 + fxr() * (W * 0.62) : FRONT[1] - 40 - fxr() * (W * 0.62);
          falls.push({ x: tx + (age === 0 ? -160 : 0), y: -20 - fxr() * 300, tx, age, side: s, dmg: age === 1 ? dmg * 0.6 : dmg, vy: age === 4 ? 0 : 260 + fxr() * 140, delay: age === 4 ? i * 0.35 : 0, t: 0 });
        }
      }
      if (s === 0) { api.sound('star'); say(`${SPECIAL_NAMES[age]}!`, 1.6); syncUI(); }
      return true;
    }
    function damage(u, dmg, from) {
      if (u.dead) return;
      u.hp -= dmg; u.hit = 0.08;
      if (u.hp <= 0) {
        u.dead = 0.001;
        const k = S[1 - u.side], gain = Math.round(u.st.cost * 1.25);
        k.gold += gain; k.xp += u.st.cost; k.xpTotal += u.st.cost; k.kills++;
        if (from === 0 || u.side === 1) { pop(u.x, u.y - 50, `+${gain}`, '#ffe066'); }
        if (u.side === 1) api.sound('soft');
      }
    }
    function hitBase(s, dmg) {
      const sd = S[s]; if (over || ending) return;
      sd.hp -= dmg;
      if (sd.hp <= 0) { sd.hp = 0; winner = 1 - s; ending = 2.4; boomAt(BX[s], GY - 60, 60); api.sound(winner === 0 ? 'win' : 'error'); say(winner === 0 ? L('Vítězství! Nepřátelská základna padla.', 'Victory! The enemy base has fallen.') : L('Porážka. Tvá základna padla.', 'Defeat. Your base has fallen.'), 3); }
    }
    function boomAt(x, y, n) { for (let i = 0; i < n; i++) { const a = fxr() * Math.PI * 2, v = 40 + fxr() * 200; fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.4 + fxr() * 0.5, c: ['#ffe066', '#ff8a3d', '#ff4d2e', '#cccccc'][i % 4], s: 2 + fxr() * 4 }); } }
    function splash(side, x, r, dmg) { for (const u of units) if (u.side !== side && !u.dead && Math.abs(u.x - x) < r + u.st.w / 2) damage(u, dmg, side); }

    // ── Simulace ──
    function tick(dt) {
      clock += dt;
      if (+msgEl.dataset.t > 0) { msgEl.dataset.t = +msgEl.dataset.t - dt; if (+msgEl.dataset.t <= 0) msgEl.hidden = true; }
      if (ending) { ending -= dt; stepFx(dt); if (ending <= 0) finish(); return; }
      for (let s = 0; s < 2; s++) {
        const sd = S[s];
        sd.gold += 0.8 * F[sd.age] * dt * (s ? D.inc * power : 1);
        sd.spCd = Math.max(0, sd.spCd - dt);
        if (sd.queue.length) {
          const q = sd.queue[0], st = stats(q.age, q.kind);
          sd.prog += dt / st.train;
          const clear = !units.some(u => u.side === s && !u.dead && Math.abs(u.x - (s ? FRONT[1] : FRONT[0])) < 34);
          if (sd.prog >= 1 && clear) { sd.queue.shift(); sd.prog = 0; spawn(s, q); }
        }
        // věže
        sd.turrets.forEach((tr, i) => {
          if (!tr) return;
          tr.cd -= dt;
          const [ox, oy] = slotPos(s, i);
          let best = null, bd = 1e9;
          for (const u of units) if (u.side !== s && !u.dead) { const d = Math.abs(u.x - ox); if (d < tr.ts.range && d < bd) { bd = d; best = u; } }
          if (best) { tr.ang = Math.atan2(best.y - 20 - oy, best.x - ox); if (tr.cd <= 0) { tr.cd = tr.ts.rate; fire(s, ox, oy, best, tr.ts.dmg, ['stone', 'arrow', 'ball', tr.kind ? 'shell' : 'bullet', 'laser'][tr.age], tr.ts.splash); } }
        });
      }
      // jednotky
      for (const u of units) {
        if (u.dead) { u.dead += dt; continue; }
        u.hit = Math.max(0, u.hit - dt); u.cd -= dt; u.atk = Math.max(0, u.atk - dt * 2.5);
        const dir = u.side ? -1 : 1;
        let tgt = null, gap = 1e9;
        for (const e of units) { if (e.side === u.side || e.dead) continue; const g2 = (e.x - u.x) * dir - (e.st.w + u.st.w) / 2; if (g2 > -20 && g2 < gap) { gap = g2; tgt = e; } }
        const bgap = (FRONT[1 - u.side] - u.x) * dir - u.st.w / 2;
        if (bgap < gap) { gap = bgap; tgt = null; }
        if (gap <= u.st.range) {
          if (u.cd <= 0) {
            u.cd = u.st.rate; u.atk = 1;
            const melee = gap <= 16;
            const dmg = melee && u.st.shot && u.kind === 1 ? u.st.dmg * 0.6 : u.st.dmg;
            if (tgt) { if (!melee && u.st.shot) fire(u.side, u.x + dir * u.st.w / 2, u.y - 34, tgt, dmg, u.st.shot, u.kind === 2 ? 30 : 0); else damage(tgt, dmg, u.side); }
            else { if (!melee && u.st.shot) fire(u.side, u.x + dir * u.st.w / 2, u.y - 26, null, dmg, u.st.shot, 0); else hitBase(1 - u.side, dmg); }
          }
        } else {
          let blocked = false;
          for (const a of units) { if (a === u || a.side !== u.side || a.dead) continue; const g2 = (a.x - u.x) * dir - (a.st.w + u.st.w) / 2; if (g2 > -6 && g2 < 4) { blocked = true; break; } }
          if (!blocked) { u.x += dir * u.st.speed * dt; u.walk += dt * 9; }
        }
      }
      for (let i = units.length - 1; i >= 0; i--) if (units[i].dead > 0.8) units.splice(i, 1);
      // střely
      for (let i = shots.length - 1; i >= 0; i--) {
        const p = shots[i]; p.ttl -= dt;
        const tx = p.tgt && !p.tgt.dead ? p.tgt.x : p.tx, ty = p.tgt && !p.tgt.dead ? p.tgt.y - 20 : p.ty;
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), sp = p.speed * dt;
        if (d <= sp + 2 || p.ttl <= 0) {
          if (p.tgt && !p.tgt.dead) { if (p.splash) { splash(p.side, tx, p.splash, p.dmg); boomAt(tx, ty, 8); } else damage(p.tgt, p.dmg, p.side); }
          else if (!p.tgt) hitBase(1 - p.side, p.dmg);
          shots.splice(i, 1); continue;
        }
        p.vx = dx / d * p.speed; p.vy = dy / d * p.speed - (p.arc ? Math.min(0, d - 60) * 0.0 : 0);
        p.x += dx / d * sp; p.y += dy / d * sp;
      }
      // zvláštní útoky
      for (let i = falls.length - 1; i >= 0; i--) {
        const f = falls[i]; if (f.delay > 0) { f.delay -= dt; continue; }
        f.t += dt;
        if (f.age === 4) { f.y = GY; if (f.t > 0.35) { splash(f.side, f.tx, 46, f.dmg); boomAt(f.tx, GY - 10, 14); falls.splice(i, 1); } continue; }
        f.y += f.vy * dt; f.x += (f.tx - f.x) * Math.min(1, dt * 2.2);
        if (f.y >= GY - 6) { splash(f.side, f.x, f.age === 1 ? 14 : 40, f.dmg); boomAt(f.x, GY - 6, f.age === 1 ? 2 : 12); falls.splice(i, 1); }
      }
      if (planeX) {
        planeX.x += planeX.dir * 420 * dt;
        const prog = planeX.dir > 0 ? planeX.x : W - planeX.x;
        if (prog > FRONT[0] + 120 + planeX.drops * 90 && planeX.drops < 12) { planeX.drops++; falls.push({ x: planeX.x, y: 60, tx: planeX.x + planeX.dir * 40, age: 3, side: planeX.side, dmg: planeX.dmg, vy: 300, delay: 0, t: 0 }); }
        if (planeX.x < -100 || planeX.x > W + 100) planeX = null;
      }
      stepFx(dt);
      ai(dt);
    }
    function stepFx(dt) {
      for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.life -= dt; f.vy += 300 * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.life <= 0) fx.splice(i, 1); }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; pops[i].y -= 26 * dt; if (pops[i].life <= 0) pops.splice(i, 1); }
    }
    function fire(side, x, y, tgt, dmg, kind, splashR) {
      const fast = kind === 'bullet' || kind === 'laser';
      shots.push({ side, x, y, tgt, tx: tgt ? tgt.x : FRONT[1 - side], ty: tgt ? tgt.y - 20 : GY - 60, dmg, kind, splash: splashR, speed: fast ? 900 : 420, ttl: 3, vx: side ? -1 : 1, vy: 0 });
    }
    function slotPos(s, i) { const sl = VkArt.SLOTS[S[s].age][i]; return [BX[s] + (s ? -sl[0] : sl[0]), GY + sl[1]]; }

    // ── Soupeř ──
    function ai(dt) {
      const sd = S[1];
      aiThink -= dt; if (aiThink > 0) return;
      aiThink = D.think * (0.7 + rnd() * 0.6);
      evolve(1);
      const mine = units.filter(u => u.side === 1 && !u.dead).length, theirs = units.filter(u => u.side === 0 && !u.dead);
      const near = theirs.filter(u => u.x > W * 0.55).length;
      if (near >= 4 && sd.spCd <= 0 && rnd() < 0.6) special(1);
      if (sd.turrets.indexOf(null) >= 0 && sd.gold > stats(sd.age, 2).cost * 2.2 && rnd() < 0.4) { buyTurret(1, sd.gold > turretStats(sd.age, 1).cost * 1.6 ? 1 : 0); return; }
      if (sd.queue.length < 3 && mine < 14) {
        const r = rnd(), kind = r < 0.12 + sd.age * 0.03 ? 2 : r < 0.55 ? 0 : 1;
        if (!train(1, kind) && kind === 2) train(1, rnd() < 0.5 ? 0 : 1);
      }
    }

    function finish() {
      if (over) return;
      over = true; api.setTimer(false); VkMusic.stop();
      const me = S[0], frac = me.hp / me.maxHp, win = winner === 0;
      const score = Math.round((me.xpTotal + (win ? 10000 + 10000 * frac : 0)) * D.mult * power);
      const html = `<p class="k-muted">${L(`Věk: ${AGE_NAMES[me.age]} · zabito ${me.kills} · základna ${Math.round(frac * 100)} %`, `Age: ${AGE_NAMES[me.age]} · ${me.kills} kills · base ${Math.round(frac * 100)} %`)}</p>`;
      if (!win) { api.failed({ score, html }); return; }
      api.data.wins = (api.data.wins || 0) + 1;
      api.data.bestAge = Math.max(api.data.bestAge || 0, me.age);
      api.solved({ title: L('Vítězství!', 'Victory!'), stars: frac >= 0.66 ? 3 : frac >= 0.33 ? 2 : 1, score, html });
    }

    // ── Kresba ──
    function draw() {
      const g = ctx, k = cssW / VW;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      const age = S[0].age;
      g.drawImage(landOf(age), camX, 0, VW, VH, 0, 0, VW, VH);
      g.save(); g.translate(-camX, 0);
      for (let s = 0; s < 2; s++) {
        VkArt.base(g, BX[s], GY, S[s].age, s, clock);
        S[s].turrets.forEach((tr, i) => { if (tr) { const [x, y] = slotPos(s, i); VkArt.turret(g, x, y, tr.age, tr.kind, tr.ang, s, clock); } });
      }
      const sorted = units.slice().sort((a, b) => (a.kind === 2) - (b.kind === 2));
      for (const u of sorted) {
        VkArt.unit(g, u, clock);
        if (!u.dead && u.hp < u.max) { const bw = Math.max(18, u.st.w * 0.7); g.fillStyle = 'rgba(0,0,0,.5)'; const hy = u.y - (u.kind === 2 ? 70 : 50) * VkArt.UNIT_SCALE; g.fillRect(u.x - bw / 2, hy, bw, 4); g.fillStyle = u.side ? '#ff5a5a' : '#5ad85a'; g.fillRect(u.x - bw / 2, hy, bw * u.hp / u.max, 4); }
      }
      for (const p of shots) VkArt.shot(g, p);
      for (const f of falls) if (f.delay <= 0) VkArt.special(g, f, clock);
      if (planeX) VkArt.plane(g, planeX.x, 60);
      for (const f of fx) { g.globalAlpha = Math.min(1, f.life * 2); g.fillStyle = f.c; g.beginPath(); g.arc(f.x, f.y, f.s, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 13px Unbounded, sans-serif';
      for (const p of pops) { g.globalAlpha = Math.min(1, p.life * 2); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(p.text, p.x, p.y); g.fillStyle = p.col; g.fillText(p.text, p.x, p.y); }
      g.globalAlpha = 1;
      // životy základen
      for (let s = 0; s < 2; s++) {
        const x = BX[s] - 50, y = GY - 210, f = S[s].hp / S[s].maxHp;
        g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(x - 2, y - 2, 104, 12, 5); g.fill();
        g.fillStyle = f > 0.5 ? '#5ad85a' : f > 0.25 ? '#ffd23f' : '#ff4d4d'; g.beginPath(); g.roundRect(x, y, 100 * f, 8, 4); g.fill();
        g.font = '700 10px Space Grotesk, sans-serif'; g.fillStyle = '#fff'; g.fillText(`${Kit.fmtNum(Math.ceil(S[s].hp))}`, BX[s], y - 9);
      }
      g.restore();
      // horní lišta: zlato, zkušenosti, věk; minimapa
      const me = S[0], need = me.age < 4 ? XP_NEED[me.age] : 0;
      g.fillStyle = 'rgba(10,8,20,.72)'; g.beginPath(); g.roundRect(8, 8, 250, 46, 10); g.fill();
      g.textAlign = 'left'; g.font = '900 18px Unbounded, sans-serif'; g.fillStyle = '#ffe066'; g.fillText(`$ ${Kit.fmtNum(Math.floor(me.gold))}`, 18, 26);
      g.font = '700 11px Space Grotesk, sans-serif'; g.fillStyle = '#e8e0ff'; g.fillText(AGE_NAMES[me.age], 150, 22);
      g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(18, 40, 230, 6);
      g.fillStyle = '#b07aff'; g.fillRect(18, 40, 230 * (need ? Math.min(1, me.xp / need) : 1), 6);
      g.fillStyle = '#e8e0ff'; g.fillText(need ? `XP ${Kit.fmtNum(Math.floor(me.xp))} / ${Kit.fmtNum(need)}` : 'XP max', 150, 34);
      const mw = Math.min(260, VW * 0.32), mx = VW - mw - 10, my = 10;
      g.fillStyle = 'rgba(10,8,20,.72)'; g.beginPath(); g.roundRect(mx - 4, my - 4, mw + 8, 26, 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(mx, my + 8, mw, 4);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; g.strokeRect(mx + camX / W * mw, my, VW / W * mw, 18);
      for (const u of units) if (!u.dead) { g.fillStyle = u.side ? '#ff6a6a' : '#6aa8ff'; g.fillRect(mx + u.x / W * mw - 1, my + 6, 2, 8); }
      g.fillStyle = '#6aa8ff'; g.fillRect(mx, my + 2, 5, 14); g.fillStyle = '#ff6a6a'; g.fillRect(mx + mw - 5, my + 2, 5, 14);
      // výcvik
      if (me.queue.length) { const q = me.queue[0]; g.fillStyle = 'rgba(10,8,20,.72)'; g.beginPath(); g.roundRect(8, 60, 150, 18, 6); g.fill(); g.fillStyle = '#6aa8ff'; g.fillRect(12, 64, 100 * Math.min(1, me.prog), 10); g.fillStyle = '#fff'; g.font = '700 10px Space Grotesk, sans-serif'; g.fillText(`${UNIT_NAMES[q.age][q.kind]} · ${me.queue.length}/5`, 116, 69); }
    }

    // ── Rozhraní ──
    const btnU = [...el.querySelectorAll('.vk-u')], btnA = Object.fromEntries([...el.querySelectorAll('[data-a]')].map(b => [b.dataset.a, b]));
    function renderIcons() {
      btnU.forEach((b, k) => {
        const c = b.querySelector('canvas'), g = c.getContext('2d'), age = S[0].age, sc = (k === 2 ? 0.62 : 1.1) / VkArt.UNIT_SCALE;
        g.clearRect(0, 0, 64, 64); g.save(); g.translate(k === 2 ? 30 : 30, 60); g.scale(sc, sc);
        VkArt.unit(g, { x: 0, y: 0, side: 0, age, kind: k, walk: 0, atk: 0, hit: 0, dead: 0 }, 0); g.restore();
        b.querySelector('b').textContent = UNIT_NAMES[age][k];
      });
    }
    function syncUI() {
      const me = S[0];
      btnU.forEach((b, k) => { const c = stats(me.age, k).cost; b.querySelector('small').textContent = `$${Kit.fmtNum(c)}`; b.disabled = me.gold < c || me.queue.length >= 5; });
      btnA.special.querySelector('small').textContent = me.spCd > 0 ? `${Math.ceil(me.spCd)} s` : SPECIAL_NAMES[me.age];
      btnA.special.disabled = me.spCd > 0;
      btnA.special.querySelector('i').style.width = `${(1 - me.spCd / 50) * 100}%`;
      btnA.evolve.disabled = me.age >= 4 || me.xp < XP_NEED[me.age];
      btnA.evolve.classList.toggle('ready', !btnA.evolve.disabled);
      btnA.speed.firstChild.textContent = `${speed}×`;
    }
    function renderTower() {
      const me = S[0];
      towerEl.innerHTML = [0, 1].map(k => { const ts = turretStats(me.age, k); return `<button class="vk-t" data-t="${k}" ${me.gold < ts.cost || me.turrets.indexOf(null) < 0 ? 'disabled' : ''}><b>${TURRET_NAMES[me.age][k]}</b><small>$${Kit.fmtNum(ts.cost)} · ${L('dosah', 'range')} ${ts.range}</small></button>`; }).join('') +
        `<button class="vk-t sell" data-t="sell" ${me.turrets.some(Boolean) ? '' : 'disabled'}><b>${L('Prodat věž', 'Sell turret')}</b><small>${L('vrátí polovinu', 'refunds half')}</small></button><span class="vk-slots">${me.turrets.map(t => (t ? '■' : '□')).join(' ')}</span>`;
    }
    el.querySelector('.vk-units').addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (b) train(0, +b.dataset.u); });
    el.querySelector('.vk-side').addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return; kick();
      if (b.dataset.a === 'tower') { towerEl.hidden = !towerEl.hidden; renderTower(); }
      if (b.dataset.a === 'special') special(0);
      if (b.dataset.a === 'evolve') evolve(0);
      if (b.dataset.a === 'speed') { speed = speed >= 3 ? 1 : speed + 1; syncUI(); }
    });
    towerEl.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; if (b.dataset.t === 'sell') sellTurret(0); else buyTurret(0, +b.dataset.t); });
    // posouvání bojiště tažením a klepnutím do minimapy
    let drag = null;
    const lx = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH]; };
    cv.addEventListener('pointerdown', e => {
      kick(); const [x, y] = lx(e), mw = Math.min(260, VW * 0.32), mx = VW - mw - 10;
      if (y < 34 && x > mx - 4) { camX = Math.max(0, Math.min(W - VW, (x - mx) / mw * W - VW / 2)); return; }
      drag = { x, cam: camX }; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ukazatel už neplatí */ }
    });
    cv.addEventListener('pointermove', e => { if (!drag) return; const [x] = lx(e); camX = Math.max(0, Math.min(W - VW, drag.cam - (x - drag.x))); });
    const endDrag = () => { drag = null; };
    cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
    // hudba začne po prvním dotyku (prohlížeče jinak zvuk nepustí)
    function kick() { if (!started) { started = true; VkMusic.setAge(S[0].age); VkMusic.start(); } }
    const keysHeld = new Set();
    const onKeyUp = e => keysHeld.delete(e.key);
    addEventListener('keyup', onKeyUp);

    // ── Smyčka ──
    let last = performance.now(), raf = 0, uiT = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (api.paused && api.paused() && !paused && !over) setPause(true);
      if (keysHeld.has('ArrowLeft')) camX = Math.max(0, camX - 700 * dt);
      if (keysHeld.has('ArrowRight')) camX = Math.min(W - VW, camX + 700 * dt);
      if (!paused && !over) for (let s = 0; s < speed; s++) { if (auto) autoplay(); if (!over) tick(dt); }
      uiT -= dt; if (uiT <= 0) { uiT = 0.2; syncUI(); if (!towerEl.hidden) renderTower(); }
      draw();
    }
    function setPause(on) { if (over) return; paused = on; api.setTimer(!on); VkMusic.pause(on); if (on) say(L('Pauza · stiskni P', 'Paused · press P'), 9999); else msgEl.hidden = true; }
    // automat pro testy: cvičí smíšenou armádu, staví věže, postupuje věky a používá speciál
    let auto = false;
    function autoplay() {
      const me = S[0];
      evolve(0);
      if (me.spCd <= 0 && units.some(u => u.side === 1 && !u.dead && u.x < W * 0.6)) special(0);
      if (me.turrets.indexOf(null) >= 0 && me.gold > turretStats(me.age, 1).cost * 1.5) buyTurret(0, 1);
      if (me.queue.length < 3) { const r = fxr(); train(0, r < 0.18 ? 2 : r < 0.55 ? 1 : 0); }
    }

    fit(); addEventListener('resize', fit);
    renderIcons(); syncUI();
    api.setTimer(true);
    say(P.mode === 'level' ? `${P.text}: ${L('zboř nepřátelskou základnu', 'destroy the enemy base')}` : L('Cvič jednotky a zboř nepřátelskou základnu!', 'Train units and destroy the enemy base!'), 2.6);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => null,
      progress: () => 1 - S[1].hp / S[1].maxHp,
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('keyup', onKeyUp); VkMusic.stop(); },
      pause() { setPause(true); },
      onKey(e) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); setPause(!paused); return; }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); keysHeld.add(e.key); return; }
        if (e.repeat) return;
        if (e.key === '1' || e.key === '2' || e.key === '3') { kick(); train(0, +e.key - 1); }
        if (e.key === 'q' || e.key === 'Q') { towerEl.hidden = !towerEl.hidden; renderTower(); }
        if (e.key === 'e' || e.key === 'E') special(0);
      },
      _state: () => ({ gold: Math.floor(S[0].gold), xp: Math.floor(S[0].xpTotal), age: S[0].age, aiAge: S[1].age, hp: Math.ceil(S[0].hp), aiHp: Math.ceil(S[1].hp), units: units.filter(u => !u.dead).length, queue: S[0].queue.length, over, clock: +clock.toFixed(1) }),
      _auto(on) { auto = on !== false; },
      _speed(n) { speed = Math.max(1, n | 0); },
      _gold(n) { S[0].gold += n; },
      _xp(n) { S[0].xp += n; },
      _solve() { winner = 0; S[1].hp = 0; finish(); },
    };
  }

  // úvodní obrázek: bitva přes věky, pravěký jezdec na dinu proti rytíři, tank a robot v pozadí
  function art(el) {
    el.innerHTML = '<canvas width="520" height="360" style="object-fit:contain"></canvas>';
    const g = el.querySelector('canvas').getContext('2d');
    g.beginPath(); g.roundRect(0, 0, 520, 360, 28); g.clip();
    const sky = g.createLinearGradient(0, 0, 520, 0); sky.addColorStop(0, '#ff9a5a'); sky.addColorStop(0.5, '#5aa8ff'); sky.addColorStop(1, '#2a1a5a');
    g.fillStyle = sky; g.fillRect(0, 0, 520, 360);
    const gr = g.createLinearGradient(0, 290, 0, 360); gr.addColorStop(0, '#6a7a3a'); gr.addColorStop(1, '#2a2018'); g.fillStyle = gr; g.fillRect(0, 290, 520, 70);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(0, 290); for (let x = 0; x <= 520; x += 26) g.lineTo(x, 230 - Math.sin(x * 0.02) * 30); g.lineTo(520, 290); g.fill();
    g.save(); g.translate(-30, 0); VkArt.base(g, 70, 292, 0, 0, 0.5); g.restore();
    g.save(); g.translate(30, 0); VkArt.base(g, 450, 292, 4, 1, 0.5); g.restore();
    const u = (age, kind, side, x, s, atk = 0) => { g.save(); g.translate(x, 300); g.scale(s, s); VkArt.unit(g, { x: 0, y: 0, side, age, kind, walk: x * 0.1, atk, hit: 0, dead: 0 }, 0.5); g.restore(); };
    u(3, 2, 1, 360, 1.3); u(4, 2, 1, 410, 1.4); u(1, 2, 1, 290, 1.6, 0.6);
    u(0, 2, 0, 200, 1.6, 0.6); u(2, 1, 0, 140, 1.7, 0.8); u(0, 0, 0, 110, 1.6);
    g.fillStyle = '#ffe066'; g.beginPath(); g.arc(246, 236, 9, 0, 7); g.fill(); g.fillStyle = '#ff8a3d'; g.beginPath(); g.arc(246, 236, 5, 0, 7); g.fill();
    for (let i = 0; i < 5; i++) VkArt.special(g, { x: 300 + i * 40, y: 60 + i * 26, age: 0 }, 0);
  }
  return { DIFFS, generate, create, art, levelSpec, stats };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'veky', title: 'VĚKY VÁLEK',
  tagline: Kit.L('Na motivy Age of War: veď svůj národ od pravěku po budoucnost. Cvič jednotky, stav věže, sesílej zvláštní útoky a zboř nepřátelskou základnu. S vlastní hrdinskou hudbou, která roste s každým věkem.', 'In the spirit of Age of War: lead your people from the Stone Age to the future. Train units, build turrets, call down special attacks and destroy the enemy base. With its own heroic score that grows with every age.'),
  diffs: Veky.DIFFS, generate: Veky.generate, create: Veky.create, art: Veky.art,
  dailyDiff: () => 'normal',
  levelDiff: () => 'normal',
  rules: Kit.L(`<p>Tvoje základna je vlevo, soupeřova vpravo. Kdo první zboří cizí základnu, vyhrává.</p>
    <ul><li><b>Jednotky</b> (tlačítka nebo 1 2 3): pěšák, střelec a těžká jednotka. Stojí zlato, cvičí se postupně (fronta až 5) a samy pochodují do boje.</li>
    <li>Za každého zabitého nepřítele dostaneš <b>zlato</b> a <b>zkušenosti</b>. Trochu zlata přibývá i samo.</li>
    <li>Se zkušenostmi postoupíš do dalšího <b>věku</b>: pravěk, středověk, renesance, moderní doba a budoucnost. Nové jednotky jsou mnohem silnější a základna vydrží víc.</li>
    <li><b>Věže</b> (až tři) střílejí ze základny. Prodaná věž vrátí polovinu ceny.</li>
    <li><b>Zvláštní útok</b> se nabíjí 50 s: meteory, déšť šípů, dělostřelba, nálet nebo orbitální laser.</li>
    <li>Bojiště posuneš tažením, šipkami nebo klepnutím do minimapy. Tlačítko 1× až 3× zrychlí hru. P pozastaví hru.</li></ul>`,
    `<p>Your base is on the left, the rival's on the right. Whoever destroys the other base first wins.</p>
    <ul><li><b>Units</b> (buttons or 1 2 3): infantry, ranged and heavy. They cost gold, train one by one (a queue of up to 5) and march into battle on their own.</li>
    <li>Every enemy killed gives <b>gold</b> and <b>experience</b>. A little gold also trickles in by itself.</li>
    <li>With experience you advance to the next <b>age</b>: Stone Age, Middle Ages, Renaissance, Modern Age and Future. New units are much stronger and the base holds more.</li>
    <li><b>Turrets</b> (up to three) fire from the base. A sold turret refunds half its price.</li>
    <li>The <b>special attack</b> recharges in 50 s: meteors, arrow rain, a barrage, an air strike or an orbital laser.</li>
    <li>Scroll the battlefield by dragging, with the arrows or by tapping the minimap. The 1× to 3× button speeds the game up. P pauses the game.</li></ul>`),
  achievements: [
    { id: 'w1', name: Kit.L('Dobyvatel', 'Conqueror'), desc: Kit.L('Vyhraj první válku', 'Win your first war'), prog: s => [Math.min(1, (s.data && s.data.wins) || 0), 1] },
    { id: 'a4', name: Kit.L('Do budoucnosti', 'Into the future'), desc: Kit.L('Vyhraj válku v budoucnosti', 'Win a war in the Future'), prog: s => [Math.min(4, (s.data && s.data.bestAge) || 0), 4] },
  ],
});
