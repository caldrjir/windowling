'use strict';
// ── Legendy prázdnoty (1.5) ─────────────────────────────────────────────────
// Šest vzácných nepřátel mimo vlny. Legenda přiletí, jen když hráč udělá něco hodně specifického
// (podmínka v Legends.tick nebo háček ve hře), a i pak jen s malou šancí (LG_CHANCE). V jednom běhu
// přiletí každá nejvýš jednou a vždy jen jedna naráz. Za life sekund (data.js) odletí, takže se
// musí ulovit hned. Kodex a úspěchy ukazují k neobjeveným legendám jen nápovědu.
//   Pozorovatel  30 s se ani nehnout (od 1:30)          zranitelný jen, když stojíš
//   Zlatník      30 s nesebrat krystal, 15+ jich leží    krade krystaly a utíká
//   Půlnočník    hrát mezi půlnocí a jednou hodinou      teleportuje se a odbíjí prstence střel
//   Kometa       meteorit dorazí elitního nepřítele      proletí obrazovkou, nechává oheň
//   Zrcadlo      4 minuty bez zásahu                     pohybuje se zrcadlově proti tobě
//   Uroboros     5 těsných kruhů za 12 s jedním směrem   had obtáčí loď, zranitelná je jen hlava
const LG_CHANCE = { watcher: 0.2, hoarder: 0.15, midnight: 0.08, comet: 0.35, mirror: 0.25, ouroboros: 0.2 };
const LG_GAP = 60; // po legendě aspoň minuta klidu, než může přiletět další
const LG_STILL = 30, LG_HOARD = 30, LG_HOARD_GEMS = 15, LG_FLAWLESS = 240, LG_LOOPS = 5, LG_LOOP_T = 12;

const Legends = (() => {
  let S = null;
  function reset() {
    S = { done: {}, alive: null, gap: 0, still: 0, hoardAt: 0, mid: 60, flaw: LG_FLAWLESS, lastNoHit: 0, turn: 0, turnT: 0, pa: null, dbgT: 12 };
  }
  reset();
  const chance = k => (Debug.legend ? 1 : LG_CHANCE[k]);
  const can = k => G.state === 'play' && !S.done[k] && !S.alive && S.gap <= 0 && !G.boss && !(G.victoryT > 0);
  // Pokus o příchod: podmínka je splněná, teď rozhodne šance.
  function attempt(k) {
    if (!can(k)) return false;
    if (Math.random() >= chance(k)) return false;
    spawn(k);
    return true;
  }

  // Kde legenda přiletí a s jakým stavem začne (zbytek chování ve FOE_AI níže).
  const INIT = {
    watcher(e) { e.open = 0; e.phased = true; },
    hoarder(e) { e.ate = 0; },
    midnight(e, p) { const a = Math.random() * TAU; e.x = p.x + Math.cos(a) * 270; e.y = p.y + Math.sin(a) * 270; e.chime = 0; e.st = 0; e.stT = 1.2; },
    comet(e, p) { e.st = 0; e.stT = 1.2; e.passes = 0; e.ang = Math.atan2(p.y - e.y, p.x - e.x); },
    mirror(e, p) {
      const a = Math.random() * TAU;
      e.cx = p.x + Math.cos(a) * 260; e.cy = p.y + Math.sin(a) * 260; e.x = 2 * e.cx - p.x; e.y = 2 * e.cy - p.y; e.stT = 1.6;
    },
    ouroboros(e, p) {
      e.ang = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2; e.side = Math.random() < 0.5 ? 1 : -1;
      // stopa hlavy (kruhový zásobník bodů po 9 px), z ní se skládá tělo
      e.tr = new Float32Array(SERPENT_BUF * 2); e.ti = 0; e.trN = 0; e.lx = e.x; e.ly = e.y;
      for (let i = 0; i < SERPENT_BUF; i++) { e.tr[i * 2] = e.x; e.tr[i * 2 + 1] = e.y; }
    },
  };

  function spawn(k) {
    const p = G.p, sp = spawnPos(40);
    const e = spawnEnemyAt(k, sp.x, sp.y);
    INIT[k](e, p);
    S.alive = e; S.done[k] = true;
    G.nextEvent = Math.max(G.nextEvent, G.time + 10); // banner legendy nepřebije hned obklíčení ani horda
    SAVE.legendSeen[k] = (SAVE.legendSeen[k] || 0) + 1;
    UI.banner(`★ ${ENEMY_NAMES[k][0]}`, `${L('Legenda prázdnoty', 'Void legend')} · ${LEGEND_LINE[k]}`, 'legend');
    Sound.play.legend();
    Platform.vibrate([30, 70, 30, 70, 30]);
    G.flash = Math.max(G.flash, 0.35);
    PerfLog.ev('legend', k);
    return e;
  }

  // Legenda odletěla, než ji hráč zničil.
  function escape(e, why) {
    if (e.dead) return;
    e.dead = true;
    burst(e.x, e.y, e.color, 40, 420, 3.5, 0.9);
    G.effects.push({ k: 'ring', x: e.x, y: e.y, r: 8, maxR: 160, spd: 520, dmg: 0, knock: 0, life: 1, color: e.color, visual: true, delay: 0 });
    if (S.alive === e) { S.alive = null; S.gap = LG_GAP; }
    UI.banner(`${ENEMY_NAMES[e.type][0]} ${L('unikl(a)', 'escaped')}`, why || L('Legenda zmizela v prázdnotě', 'The legend vanished into the void'), 'warn');
    Sound.play.back();
  }

  // Legenda zničena: zpomalení, záblesk a velká kořist (killEnemy už ji zapsal do bestiáře).
  function killed(e) {
    if (S.alive === e) { S.alive = null; S.gap = LG_GAP; }
    SAVE.stats.legendKills = (SAVE.stats.legendKills || 0) + 1;
    PerfLog.ev('legendKilled', e.type);
    Sound.play.bossdie();
    G.timeScale = 0.25; G.flash = 0.8; addShake(16);
    burst(e.x, e.y, e.color, 80, 600, 4.5, 1.4);
    burst(e.x, e.y, '#ffd166', 40, 380, 3, 1.1);
    G.effects.push({ k: 'ring', x: e.x, y: e.y, r: 10, maxR: 520, spd: 1300, dmg: 0, knock: 0, life: 1, color: '#ffd166', visual: true, delay: 0 });
    for (let i = 0; i < 20; i++) dropPickup('shard', e.x, e.y, 4 * shardMul() * G.st.bounty);
    dropGem(e.x, e.y, e.xp * (1 + minutes() * 0.1) + (e.ate || 0) * 2);
    UI.banner(`★ ${ENEMY_NAMES[e.type][0]}`, L('Legenda poražena', 'Legend defeated'), 'legend');
  }

  // Sledování podmínek, jednou za snímek běhu (updateGame).
  function tick(dt) {
    const p = G.p;
    if (S.gap > 0) S.gap -= dt;
    // Debug: zvolená legenda přiletí 12 s po startu každého běhu
    const forced = DEBUG && SAVE.settings.dbgLegendNext;
    if (forced && ENEMIES[forced] && S.dbgT > 0 && (S.dbgT -= dt) <= 0 && !S.alive) spawn(forced);
    const sp = Math.hypot(p.vx, p.vy);

    // Pozorovatel: 30 s bez hnutí (úskok i zásah, který loď odhodí, počítání přeruší)
    S.still = sp < 8 && p.dashT <= 0 ? S.still + dt : 0;
    if (S.still >= LG_STILL && G.time >= 90 && can('watcher')) { S.still = 0; attempt('watcher'); }

    // Zlatník: krystaly leží a nikdo je nesbírá (počítají se i slité: krystal mimo obrazovku jich nese víc)
    if (G.time >= 120 && G.time - G.lastGemT >= LG_HOARD) {
      if (G.time >= S.hoardAt && can('hoarder') && lyingGems() >= LG_HOARD_GEMS) { S.hoardAt = G.time + 15; attempt('hoarder'); }
    } else S.hoardAt = 0;

    // Půlnočník: jednou za minutu běhu, pokud jsou na hodinách hráče hodiny mezi 0:00 a 0:59
    S.mid -= dt;
    if (S.mid <= 0) { S.mid = 60; if (new Date().getHours() === 0) attempt('midnight'); }

    // Zrcadlo: 4 minuty bez zásahu, pak každou další minutu nový pokus
    if (G.noHit < S.lastNoHit) S.flaw = LG_FLAWLESS;
    S.lastNoHit = G.noHit;
    if (G.noHit >= S.flaw && can('mirror')) { S.flaw += 60; attempt('mirror'); }

    // Uroboros: pět těsných kruhů jedním směrem do 12 sekund (velké kroužení při úhybu nestačí)
    if (sp > G.st.speed * 0.45 && p.dashT <= 0) {
      const a = Math.atan2(p.vy, p.vx);
      if (S.pa !== null) {
        const da = angDiff(S.pa, a);
        if (S.turn * da < 0 && Math.abs(da) > 0.15) { S.turn = 0; S.turnT = 0; } else S.turn += da;
      }
      S.pa = a; S.turnT += dt;
      if (S.turnT > LG_LOOP_T) { S.turn = 0; S.turnT = 0; }
      if (Math.abs(S.turn) >= LG_LOOPS * TAU && can('ouroboros')) { S.turn = 0; S.turnT = 0; attempt('ouroboros'); }
    } else if (sp < G.st.speed * 0.2) { S.pa = null; S.turn = 0; S.turnT = 0; }
  }

  function lyingGems() {
    let n = 0;
    for (const g of G.pickups) if (g.kind === 'gem' && !g.dead) n += g.n || 1;
    return n;
  }

  // Kometa: háček z killEnemy, když elitu dorazil meteorit
  const meteorElite = () => attempt('comet');

  // Kolik legendě zbývá do odletu (0..1) a jak to říct v HUD: Půlnočník počítá údery, Kometa průlety.
  function left(e) {
    if (e.type === 'midnight') return 1 - (e.chime || 0) / 12;
    if (e.type === 'comet') return Math.min(e.life / e.d.life, 1 - (e.passes || 0) / 8);
    return Math.max(0, e.life / e.d.life);
  }
  function leftText(e) {
    if (e.type === 'midnight') return `${L('úder', 'chime')} ${e.chime || 0}/12`;
    if (e.type === 'comet') return `${L('průlet', 'pass')} ${e.passes || 0}/8`;
    return `${Math.ceil(Math.max(0, e.life))} s`;
  }

  return { reset, tick, spawn, escape, killed, meteorElite, attempt, left, leftText, get alive() { return S.alive; }, get state() { return S; } };
})();

// Úvodní věta při příletu (banner).
const LEGEND_LINE = {
  watcher: L('Něco tě pozoruje. Zůstaň v klidu…', 'Something is watching you. Hold still…'),
  hoarder: L('Krade tvoje krystaly. Chyť ho, než uteče!', 'It is stealing your crystals. Catch it before it flees!'),
  midnight: L('Odbíjí půlnoc. Znič ho do dvanáctého úderu!', 'Midnight is striking. Destroy it before the twelfth chime!'),
  comet: L('Z nebe padá kometa. Zastav ji!', 'A comet is falling from the sky. Stop it!'),
  mirror: L('Tvůj odraz. Hýbe se přesně opačně než ty.', 'Your reflection. It moves exactly opposite to you.'),
  ouroboros: L('Had obtáčí tvou loď. Zranitelná je jen hlava!', 'A serpent coils around your ship. Only the head can be hurt!'),
};
const SERPENT_BUF = 96, SERPENT_SEG = 16, SERPENT_GAP = 3; // body stopy, články těla, rozestup (v bodech po 9 px)

// Odpočet pobytu legendy; vrátí true, když právě odletěla.
function lgAge(e, dt) {
  e.life -= dt;
  if (e.life > 0) return false;
  Legends.escape(e);
  return true;
}
function lgTouch(e, r) {
  const p = G.p;
  if (d2(e.x, e.y, p.x, p.y) < (r + p.r) * (r + p.r)) hurtPlayer(e.dmg, e.x, e.y);
}

Object.assign(FOE_AI, {
  // Pozorovatel: drží si odstup a dívá se. Oko je otevřené (zranitelné) jen, když se hráč nehýbe.
  lgWatch(e, d, dt, dist, dx, dy) {
    if (lgAge(e, dt)) return;
    const p = G.p, still = Math.hypot(p.vx, p.vy) < 25 && p.dashT <= 0;
    e.open = clamp(e.open + (still ? dt * 2.2 : -dt * 6), 0, 1);
    e.phased = e.open < 0.5;
    keepRange(e, dist, dx, dy, 230, 300);
    e.ang = Math.atan2(dy, dx);
    M.noHit = true;
  },
  // Zlatník: sbírá krystaly po celé obrazovce, před hráčem utíká; čím víc snědl, tím je pomalejší.
  lgHoard(e, d, dt, dist, dx, dy) {
    if (lgAge(e, dt)) return;
    e.scT = (e.scT || 0) - dt;
    if (e.scT <= 0) {
      e.scT = 0.3; e.food = null;
      let bd = 900 * 900;
      for (const g of G.pickups) {
        if (g.dead || g.kind !== 'gem' || g.mag) continue;
        const dd = d2(e.x, e.y, g.x, g.y);
        if (dd < bd) { bd = dd; e.food = g; }
      }
    }
    const g = e.food, fat = 1 / (1 + Math.sqrt(e.ate) * 0.035);
    if (dist < 300) {
      // útěk s kličkou do strany
      const s = Math.sin(e.t * 2.3 + e.id) * 0.6;
      M.mx = -dx / dist - dy / dist * s; M.my = -dy / dist + dx / dist * s;
      const l = Math.hypot(M.mx, M.my) || 1; M.mx /= l; M.my /= l; M.sp *= 1.1 * fat;
    } else if (g && !g.dead && !g.mag && dist < 950) {
      const tx = g.x - e.x, ty = g.y - e.y, tl = Math.hypot(tx, ty) || 1;
      M.mx = tx / tl; M.my = ty / tl; M.sp *= fat;
      if (tl < e.r + 12) {
        g.dead = true; e.food = null; e.ate += g.val;
        e.r = e.d.r * Math.min(1.7, 1 + Math.sqrt(e.ate) * 0.05);
        burst(g.x, g.y, '#ffd23f', 6, 140, 2.5, 0.35);
      }
    } else if (dist > 600) M.sp *= 0.9; // bez krystalů se drží u hráče (na okraji obrazovky)
    else { M.mx = -dy / dist; M.my = dx / dist; M.sp *= 0.6; }
    e.ang = Math.atan2(M.my, M.mx);
    if (G.particles.length < MAX_PARTICLES && Math.random() < 0.6) G.particles.push({ x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), vx: rand(-30, 30), vy: rand(-30, 30), life: 0.5, max: 0.5, size: rand(2, 4), color: '#ffe066', drag: 2 });
  },
  // Půlnočník: přenáší se kolem hráče (místo dopadu napřed ukáže přízrak) a po každém přenosu
  // odbije: prstenec střel, který s každým úderem houstne. Po dvanáctém úderu zmizí.
  lgMidnight(e, d, dt, dist, dx, dy, frozen) {
    M.lock = true;
    if (frozen || lgAge(e, dt)) return;
    const p = G.p;
    e.stT -= dt;
    if (e.st === 0 && e.stT <= 0) {
      const a = Math.random() * TAU, r = rand(190, 290);
      e.bx = p.x + Math.cos(a) * r; e.by = p.y + Math.sin(a) * r; e.st = 1; e.stT = 0.75;
    } else if (e.st === 1 && e.stT <= 0) {
      burst(e.x, e.y, e.color, 12, 240, 3, 0.4);
      e.x = e.bx; e.y = e.by; e.kx = 0; e.ky = 0;
      burst(e.x, e.y, e.color, 18, 280, 3, 0.5);
      e.st = 0; e.stT = 1.9; e.chime++;
      const n = 5 + e.chime, a0 = Math.random() * TAU;
      for (let k = 0; k < n; k++) fireE(e.x, e.y, a0 + k / n * TAU, 165, d.bulletDmg * dmgMul(), e.color, 7);
      G.effects.push({ k: 'ring', x: e.x, y: e.y, r: e.r, maxR: e.r + 90, spd: 300, dmg: 0, knock: 0, life: 1, color: e.color, visual: true, delay: 0 });
      Sound.play.chime();
      addText(e.x, e.y - e.r - 14, String(e.chime), e.color, 24, 1);
      if (e.chime >= 12) { Legends.escape(e, L('Odbila dvanáctá a Půlnočník zmizel', 'The twelfth chime rang and the Midnight Chime vanished')); return; }
    }
    lgTouch(e, e.r);
  },
  // Kometa: na chvíli se zastaví a zamíří (tehdy se dá nejlíp trefit), pak proletí přes hráče a za
  // sebou nechá hořící stopu. Po osmi průletech odletí.
  lgComet(e, d, dt, dist, dx, dy, frozen) {
    M.lock = true;
    if (frozen || lgAge(e, dt)) return;
    const p = G.p;
    e.stT -= dt;
    if (e.st === 0) {
      const tx = p.x + p.vx * 0.35 - e.x, ty = p.y + p.vy * 0.35 - e.y;
      e.ang += angDiff(e.ang, Math.atan2(ty, tx)) * Math.min(1, dt * 6);
      if (e.stT <= 0) {
        if (e.passes >= 8) { Legends.escape(e, L('Kometa odletěla zpátky mezi hvězdy', 'The comet flew back among the stars')); return; }
        e.st = 1; e.stT = 1.6; e.passes++; Sound.play.missile();
      }
    } else {
      const sp = d.speed * spdMul() * (e.slowT > 0 ? 1 - e.slow * 0.5 : 1);
      e.x += Math.cos(e.ang) * sp * dt; e.y += Math.sin(e.ang) * sp * dt;
      e.fT = (e.fT || 0) - dt;
      if (e.fT <= 0 && G.fireN < 160) { e.fT = 0.06; G.effects.push({ k: 'efire', x: e.x, y: e.y, r: 18, life: 2.2, max: 2.2, dmg: d.fire * dmgMul(), color: e.color }); }
      if (G.particles.length < MAX_PARTICLES) for (let i = 0; i < 2; i++) {
        const b = e.ang + Math.PI + rand(-0.4, 0.4);
        G.particles.push({ x: e.x, y: e.y, vx: Math.cos(b) * rand(90, 280), vy: Math.sin(b) * rand(90, 280), life: 0.5, max: 0.5, size: rand(3, 6), color: i ? '#ffe08a' : e.color, drag: 2 });
      }
      if (e.stT <= 0) { e.st = 0; e.stT = 0.9; }
    }
    e.rot = e.ang;
    lgTouch(e, e.r);
  },
  // Zrcadlo: bodově souměrné s hráčem podle kotvy, která se k hráči pomalu plíží (hráč doprava →
  // zrcadlo doleva, hráč ke kotvě → zrcadlo taky). Střílí trojice střel v barvě pilota.
  lgMirror(e, d, dt, dist, dx, dy, frozen) {
    M.lock = true;
    if (frozen || lgAge(e, dt)) return;
    const p = G.p, ax = p.x - e.cx, ay = p.y - e.cy, al = Math.hypot(ax, ay) || 1;
    if (al > 150) { e.cx += ax / al * 26 * dt; e.cy += ay / al * 26 * dt; }
    const k = Math.min(1, dt * 12);
    e.x += (2 * e.cx - p.x - e.x) * k; e.y += (2 * e.cy - p.y - e.y) * k;
    e.rot = p.face + Math.PI;
    e.stT -= dt;
    if (e.stT <= 0 && dist < 900) {
      e.stT = 1.5;
      const a = Math.atan2(dy, dx);
      for (let i = -1; i <= 1; i++) fireE(e.x, e.y, a + i * 0.13, 270, d.bulletDmg * dmgMul(), G.pilot.color, 6);
      Sound.play.eshoot();
    }
    lgTouch(e, e.r);
  },
  // Uroboros: hlava krouží kolem hráče po kruhu, který se stahuje a zase povoluje; tělo za ní pálí
  // při dotyku, ale zbraně zraní jen hlavu. Pod polovinou zdraví zrychlí.
  lgSerpent(e, d, dt, dist, dx, dy, frozen) {
    M.lock = true;
    if (frozen || lgAge(e, dt)) return;
    const p = G.p, rage = e.hp < e.maxHp * 0.5;
    const R = (rage ? 200 : 250) + 70 * Math.sin(e.t * 0.55);
    const ang = Math.atan2(e.y - p.y, e.x - p.x) + e.side * 0.55;
    const tx = p.x + Math.cos(ang) * R - e.x, ty = p.y + Math.sin(ang) * R - e.y;
    e.ang += clamp(angDiff(e.ang, Math.atan2(ty, tx)), -3.4 * dt, 3.4 * dt);
    const sp = e.speed * (rage ? 1.3 : 1) * (e.slowT > 0 ? 1 - e.slow * 0.5 : 1);
    e.x += Math.cos(e.ang) * sp * dt; e.y += Math.sin(e.ang) * sp * dt;
    e.rot = e.ang;
    // stopa: nový bod po každých 9 px dráhy
    if (d2(e.x, e.y, e.lx, e.ly) > 81) {
      e.ti = (e.ti + 1) % SERPENT_BUF; e.tr[e.ti * 2] = e.x; e.tr[e.ti * 2 + 1] = e.y; e.lx = e.x; e.ly = e.y;
      if (e.trN < SERPENT_BUF) e.trN++;
    }
    lgTouch(e, e.r);
    // tělo pálí (zásahy hlídá nezranitelnost lodi po zásahu)
    if (p.inv > 0) return;
    for (let i = 1; i <= SERPENT_SEG; i++) {
      const j = serpentIdx(e, i), sr = serpentR(e, i);
      const x = e.tr[j * 2], y = e.tr[j * 2 + 1];
      if (d2(x, y, p.x, p.y) < (sr + p.r) * (sr + p.r)) { hurtPlayer(e.dmg * 0.7, x, y); break; }
    }
  },
});
// poloměr i-tého článku hada (od hlavy k ocasu se zužuje) a jeho bod ve stopě hlavy
const serpentR = (e, i) => e.r * (0.78 - i * 0.03);
const serpentIdx = (e, i) => ((e.ti - i * SERPENT_GAP) % SERPENT_BUF + SERPENT_BUF) % SERPENT_BUF;
