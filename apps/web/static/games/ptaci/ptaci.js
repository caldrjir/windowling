'use strict';
// ── PTAČÍ POMSTA · Windowling Hlavolamy ─────────────────────────────────────
// Na motivy Angry Birds: prakem střílíš ptáky na stavby ze dřeva, skla a kamene, ve kterých
// se schovávají zelená prasata. Úroveň vyhraješ, když padne poslední prase. Žlutý pták na
// klepnutí zrychlí, modrý se rozdělí na tři, černý vybuchne. Fyzika: planck.js (core.js).
const Ptaci = (() => {
  const L = Kit.L, C = PtCore;
  const DIFFS = [
    { id: 'lehka', name: L('Lehká', 'Easy'), note: L('nízké stavby, víc ptáků', 'low forts, more birds'), tiers: [0, 1] },
    { id: 'normal', name: L('Střední', 'Medium'), note: L('věže, sklo i kámen', 'towers, glass and stone'), tiers: [2, 3] },
    { id: 'tezka', name: L('Těžká', 'Hard'), note: L('pevnosti a prasata v helmách', 'fortresses and helmet pigs'), tiers: [4, 5] },
  ];
  const BIRD_NAME = { red: L('Červený', 'Red'), yellow: L('Žlutý: klepni a zrychlí', 'Yellow: tap to dash'), blue: L('Modrý: klepni a rozdělí se', 'Blue: tap to split'), black: L('Černý: klepni a vybuchne', 'Black: tap to explode') };
  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') { const n = ctx.key; return { seed, tier: Math.min(5, Math.floor((n - 1) / 3)), level: n, text: L(`Úroveň ${n}`, `Level ${n}`) }; }
    if (ctx.kind === 'daily') return { seed, tier: 2 + (seed % 2), text: L('Denní pomsta', 'Daily revenge') };
    const d = DIFFS.find(x => x.id === diffId) || DIFFS[0];
    return { seed, tier: d.tiers[seed % 2], text: d.name };
  }

  function create(el, P, saved, api) {
    el.innerHTML = `<div class="pt-wrap"><div class="pt-stage"><div class="pt-box"><canvas class="pt-cv"></canvas><div class="pt-msg" hidden></div><button class="pt-fs" type="button"></button></div></div>
      <p class="pt-keys">${L('Táhni od praku a pusť. Za letu klepni pro schopnost ptáka. P pauza', 'Drag back from the slingshot and let go. Tap in flight for the bird\'s power. P pauses')}</p></div>`;
    const cv = el.querySelector('.pt-cv'), ctx = cv.getContext('2d'), msgEl = el.querySelector('.pt-msg');
    const wrapEl = el.querySelector('.pt-wrap'), stage = el.querySelector('.pt-stage'), boxEl = el.querySelector('.pt-box'), fsBtn = el.querySelector('.pt-fs');
    const VW = 960;
    let cssW = 960, cssH = 540, dpr = 1, VH = 540, GY = 484, bg = null, PPM = 40;
    // Na šířku přes celou obrazovku (mobil): skutečná celá obrazovka se zámkem na šířku, kde to jde
    // (Android); jinak hra vyplní okno a na výšku se otočí o 90°, takže stačí otočit telefon (iPhone).
    const coarse = matchMedia('(pointer: coarse)').matches;
    let full = false, rot = false, autoFull = false;
    function setFull(on, auto = false) {
      if (on === full) return;
      full = on; autoFull = on && auto;
      stage.classList.toggle('pt-full', on); document.documentElement.classList.toggle('pt-lock', on);
      // přes celou obrazovku jen přímo v body (předek s transformací by fixed pozici uvěznil)
      if (on) document.body.appendChild(stage); else wrapEl.prepend(stage);
      if (on && !auto) {
        const fs = document.documentElement;
        try { const pr = fs.requestFullscreen && fs.requestFullscreen({ navigationUI: 'hide' }); if (pr && pr.then) pr.then(() => { try { const lk = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (lk && lk.catch) lk.catch(() => {}); } catch (e) { /* zámek není */ } }).catch(() => {}); } catch (e) { /* celá obrazovka není */ }
      }
      if (!on && document.fullscreenElement) { try { document.exitFullscreen().catch(() => {}); } catch (e) { /* už není */ } }
      fit();
    }
    fsBtn.addEventListener('pointerdown', e => e.stopPropagation());
    fsBtn.addEventListener('click', e => { e.stopPropagation(); setFull(!full); });
    // telefon otočený na šířku: hra se sama roztáhne přes celou obrazovku
    function orient() { if (!coarse || over) { fit(); return; } const land = innerWidth > innerHeight && innerHeight < 560; if (land && !full) setFull(true, true); else if (!land && full && autoFull) setFull(false); else fit(); }
    function fit() {
      rot = full && innerHeight > innerWidth;
      fsBtn.hidden = !coarse && !full; fsBtn.textContent = full ? '✕' : L('⤢ Na šířku', '⤢ Landscape');
      if (full) {
        cssW = rot ? innerHeight : innerWidth; cssH = rot ? innerWidth : innerHeight;
      } else {
        const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
        cssW = Math.floor(Math.min(box - 2, 1100));
        cssH = Math.max(Math.min(260, cssW * 0.75), Math.min(innerHeight - (innerWidth < 760 ? 150 : 170), cssW * 0.58));
      }
      boxEl.classList.toggle('pt-rot', rot); boxEl.style.width = cssW + 'px'; boxEl.style.height = cssH + 'px';
      VH = Math.round(VW * cssH / cssW); GY = VH - 56; PPM = VW / (X1 - X0);
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = cssW * dpr; cv.height = cssH * dpr; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
      bg = PtArt.land(VW, VH, GY, P.seed % 3);
    }
    const SX = x => (x - X0) * PPM, SY = y => GY - y * PPM;

    // ── Stav ──
    const spec = C.genLevel(P.seed, P.tier), sim = C.Sim(planck, spec), S = sim.S;
    // kamera: celá úroveň od fronty ptáků po nejvzdálenější stavbu, ať jsou prasata co největší
    const X0 = 0.2, X1 = Math.max(17, ...spec.blocks.map(b => b.x + b.w / 2 + 0.9), ...spec.pigs.map(p => p.x + 1));
    const fx = [], pops = [], trail = [], lastTrail = [];
    let clock = 0, acc = 0, speed = 1, paused = false, over = false, endT = 0, shake = 0, hint = 0, trailT = 0;
    let drag = null; // { x0, y0, px, py } v css px a metrech
    const fr = C.rngOf(P.seed ^ 0xabc);
    function say(t, d = 1.6) { msgEl.textContent = t; msgEl.hidden = false; msgEl.dataset.t = d; }
    function pop(x, y, text, col, size = 20) { pops.push({ x, y, text, col, size, life: 1.2 }); }

    function handleEvents() {
      for (const e of S.events.splice(0)) {
        const x = SX(e.x || 0), y = SY(e.y || 0);
        if (e.kind === 'break') {
          const n = 6 + Math.round(e.w * e.h * 8);
          for (let i = 0; i < n; i++) fx.push({ k: 'shard', mat: e.mat, c: PtArt.debrisColor(e.mat, i), x: x + (fr() - 0.5) * e.w * PPM, y: y + (fr() - 0.5) * e.h * PPM, vx: (fr() - 0.5) * 220, vy: -fr() * 220, a: fr() * 6, va: (fr() - 0.5) * 12, s: 3 + fr() * 5, life: 0.8 + fr() * 0.5 });
          pop(x, y - 10, String(C.MAT[e.mat].pts), '#fff', 15);
          api.sound(e.mat === 'glass' ? 'tap' : 'soft');
        } else if (e.kind === 'pig') {
          fx.push({ k: 'puff', x, y, r: e.r * PPM * 1.2, life: 0.7, max: 0.7, seed: fr() * 6 });
          pop(x, y - 20, '5000', '#b4ff6a', 22); api.sound('line'); shake = Math.max(shake, 0.15);
        } else if (e.kind === 'boom') {
          fx.push({ k: 'boom', x, y, r: 3.2 * PPM * 0.6, life: 0.45, max: 0.45 });
          for (let i = 0; i < 18; i++) fx.push({ k: 'puff', x: x + (fr() - 0.5) * 60, y: y + (fr() - 0.5) * 50, r: 14 + fr() * 14, life: 0.9, max: 0.9, seed: fr() * 6, c: '#c8c0b8' });
          shake = 0.4; api.sound('error');
        } else if (e.kind === 'launch') api.sound('place');
        else if (e.kind === 'split' || e.kind === 'dash' || e.kind === 'cry') { api.sound('star'); for (let i = 0; i < 6; i++) fx.push({ k: 'feather', c: e.kind === 'split' ? '#8ad4ff' : e.kind === 'dash' ? '#ffe45a' : '#ff5a4a', x, y, vx: (fr() - 0.5) * 120, vy: (fr() - 0.5) * 120, a: fr() * 6, va: (fr() - 0.5) * 6, s: 5 + fr() * 3, life: 1.2 }); }
        else if (e.kind === 'won') { api.sound('win'); say(L('Všechna prasata padla!', 'All pigs down!'), 2.5); }
        else if (e.kind === 'lost') { api.sound('error'); say(L('Došli ptáci…', 'Out of birds…'), 2.5); }
      }
    }

    function tick(dt) {
      clock += dt;
      if (+msgEl.dataset.t > 0) { msgEl.dataset.t = +msgEl.dataset.t - dt; if (+msgEl.dataset.t <= 0) msgEl.hidden = true; }
      acc += dt;
      while (acc >= C.DT) { acc -= C.DT; sim.step(); handleEvents(); }
      // stopa letu prvního ptáka
      if (S.phase === 'fly' && S.flyers.length) { trailT -= dt; if (trailT <= 0) { trailT = 0.045; const p = S.flyers[0].getPosition(); trail.push([SX(p.x), SY(p.y), trail.length % 3 === 0 ? 3 : 2]); } }
      else if (trail.length && S.phase === 'aim') { lastTrail.length = 0; lastTrail.push(...trail); trail.length = 0; }
      for (let i = fx.length - 1; i >= 0; i--) {
        const p = fx[i]; p.life -= dt;
        if (p.k === 'shard' || p.k === 'feather') { p.vy += (p.k === 'feather' ? 120 : 600) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt; if (p.y > GY + 6 && p.k === 'shard') { p.y = GY + 6; p.vy *= -0.3; p.vx *= 0.6; } }
        if (p.life <= 0) fx.splice(i, 1);
      }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; pops[i].y -= 24 * dt; if (pops[i].life <= 0) pops.splice(i, 1); }
      shake = Math.max(0, shake - dt); hint = Math.max(0, hint - dt);
      if ((S.phase === 'won' || S.phase === 'lost') && !over) { endT += dt; if (endT > 1.6) finish(); }
    }
    function finish() {
      if (over) return; over = true; api.setTimer(false);
      if (full) setFull(false); // výsledek ukazuje stavebnice pod hrou
      const nb = spec.birds.length, left = S.birdsLeft.length;
      if (S.phase !== 'won') { api.failed({ score: S.score, html: `<p class="k-muted">${L(`Zbývá ${sim.live('pig').length} prasat`, `${sim.live('pig').length} pigs left`)}</p>` }); return; }
      api.data.best = Math.max(api.data.best || 0, S.score);
      api.data.wins = (api.data.wins || 0) + 1;
      const stars = left >= Math.max(1, nb - spec.pigs.length) ? 3 : left >= 1 ? 2 : 1;
      if (stars === 3) api.data.three = (api.data.three || 0) + 1;
      api.solved({ title: `${S.score.toLocaleString('cs-CZ')} ${L('bodů', 'pts')}`, stars, score: S.score });
    }

    // ── Kresba ──
    function draw() {
      const g = ctx, k = cssW / VW, sh = shake > 0 ? (Math.sin(clock * 90) * 6 * shake) : 0;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      g.drawImage(bg, 0, 0, VW, VH);
      g.translate(sh, sh * 0.5);
      const sx = SX(C.SLING.x), sy = SY(C.SLING.y), ss = 1.65 * PPM / 40;
      // stopa minulého a právě letícího výstřelu
      for (const [x, y, r] of lastTrail) { g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      for (const [x, y, r] of trail) { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      PtArt.slingBack(g, sx, sy, ss);
      // pták v kapse praku
      let bx = sx, by = sy;
      if (S.phase === 'aim' && S.bird) {
        if (drag) { const len = Math.hypot(drag.px, drag.py), q = Math.min(len, C.PULL) / (len || 1); bx = sx + drag.px * q * PPM; by = sy - drag.py * q * PPM; }
        PtArt.band(g, sx + 14 * ss, sy - 16 * ss, bx, by, ss);
        PtArt.bird(g, S.bird.kind, bx, by, C.BIRDS[S.bird.kind].r * PPM, drag ? Math.atan2(-(sy - by), -(bx - sx)) * 0 : 0, clock);
        // předpověď dráhy
        if (drag) { const path = sim.aimPath(drag.px, drag.py, 22, 0.06); path.forEach(([x, y], i) => { g.fillStyle = `rgba(255,255,255,${0.85 - i * 0.035})`; g.beginPath(); g.arc(SX(x), SY(y), 3 - i * 0.08, 0, 7); g.fill(); }); }
      }
      // ptáci ve frontě u praku
      const gap = Math.min(PPM, (sx - 1.1 * PPM) / Math.max(1, S.birdsLeft.length)); S.birdsLeft.forEach((kind, i) => { const r = C.BIRDS[kind].r * PPM; PtArt.bird(g, kind, sx - 1.1 * PPM - i * gap, GY - r, r, 0, clock + i * 1.7); });
      // stavby, prasata, ptáci ve hře
      let bseed = 0;
      for (let b = sim.world.getBodyList(); b; b = b.getNext()) {
        const u = b.getUserData(); if (!u) continue;
        const p = b.getPosition(), x = SX(p.x), y = SY(p.y), a = -b.getAngle();
        bseed++;
        if (u.type === 'block') PtArt.block(g, x, y, u.w * PPM, u.h * PPM, a, u.mat, u.max === Infinity ? 0 : 1 - u.hp / u.max, (u.seed = u.seed || bseed));
        else if (u.type === 'pig') PtArt.pig(g, x, y, u.r * PPM, a, u.hp / u.max, u.size === 'k', clock + (u.seed = u.seed || bseed), u.blink > 0);
      }
      for (const b of [...S.spent, ...S.flyers]) { const u = b.getUserData(), p = b.getPosition(); PtArt.bird(g, u.kind, SX(p.x), SY(p.y), u.r * PPM, -b.getAngle(), clock, u.hitT ? 2 : 1); }
      if (S.phase === 'aim' && S.bird) PtArt.band(g, sx - 12 * ss, sy - 14 * ss, bx - 4, by + 2, ss);
      PtArt.slingFront(g, sx, sy, ss, GY + 4);
      for (const p of fx) { if (p.k === 'shard') PtArt.shard(g, p); else if (p.k === 'feather') PtArt.feather(g, p); else if (p.k === 'puff') PtArt.puff(g, p); else if (p.k === 'boom') PtArt.boom(g, p); }
      g.globalAlpha = 1;
      // HUD
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      g.textBaseline = 'middle'; g.lineJoin = 'round';
      const txt = (s, x, y, size, col, align = 'left') => { g.font = `900 ${size}px Unbounded, sans-serif`; g.textAlign = align; g.lineWidth = 6; g.strokeStyle = 'rgba(20,14,8,.8)'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
      txt(S.score.toLocaleString('cs-CZ'), VW - 20, 32, 28, '#fff', 'right');
      const best = api.data.best; if (best && !P.level) txt(`${L('rekord', 'best')} ${best.toLocaleString('cs-CZ')}`, VW - 20, 62, 13, '#ffe9a8', 'right');
      txt(P.text || '', 20, 30, 16, '#fff');
      const pigsLeft = sim.live('pig').length;
      PtArt.pig(g, 34, 66, 13, 0, 1, false, clock, false); txt(`× ${pigsLeft}`, 54, 66, 18, '#d8ffb0');
      if (S.phase === 'fly' && S.armed && S.flyers.length && S.flyers[0].getUserData().kind !== 'red' && !S.flyers[0].getUserData().hitT) { g.globalAlpha = 0.7 + 0.3 * Math.sin(clock * 10); txt(L('klepni!', 'tap!'), VW / 2, 70, 18, '#ffe45a', 'center'); g.globalAlpha = 1; }
      for (const p of pops) { g.globalAlpha = Math.min(1, p.life * 2); txt(p.text, p.x, p.y, p.size, p.col, 'center'); }
      g.globalAlpha = 1;
    }

    // ── Smyčka a ovládání ──
    let last = performance.now(), raf = 0, auto = false, autoT = 0, alt = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      if (api.paused && api.paused() && !paused && !over) setPause(true);
      if (!paused && !over) for (let s = 0; s < speed; s++) { if (auto) autoplay(dt); tick(dt); }
      draw();
    }
    function setPause(on) { if (over) return; paused = on; api.setTimer(!on); if (on) say(L('Pauza · stiskni P', 'Paused · press P'), 9999); else msgEl.hidden = true; }
    // souřadnice na plátně; otočené o 90° po směru: x plátna jde dolů po obrazovce, y doleva
    const cssPos = e => { const b = cv.getBoundingClientRect(); return rot ? [e.clientY - b.top, b.right - e.clientX] : [e.clientX - b.left, e.clientY - b.top]; };
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); if (paused || over) return;
      if (S.phase === 'fly') { sim.ability(); handleEvents(); return; }
      if (S.phase !== 'aim' || !S.bird) return;
      const [x, y] = cssPos(e); drag = { x0: x, y0: y, px: 0, py: 0 };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ukazatel už neplatí */ }
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      // plné natažení = 22 % šířky plátna (min. 90 px), ať se dobře míří i na mobilu
      const [x, y] = cssPos(e), maxPx = Math.max(90, cssW * 0.22), kk = C.PULL / maxPx;
      let px = (x - drag.x0) * kk, py = -(y - drag.y0) * kk; const len = Math.hypot(px, py);
      if (len > C.PULL) { px *= C.PULL / len; py *= C.PULL / len; }
      // prak nepustí ptáka do země
      if (C.SLING.y + py < 0.4) py = 0.4 - C.SLING.y;
      drag.px = px; drag.py = py;
    });
    const up = () => { if (!drag) return; const d = drag; drag = null; if (Math.hypot(d.px, d.py) > 0.3) sim.launch(d.px, d.py); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { drag = null; });
    // automat pro testy: míří na nejbližší prase, střídá nízkou a vysokou dráhu, schopnost u stavby
    function autoplay(dt) {
      if (S.phase === 'aim' && S.bird && !drag) {
        autoT -= dt; if (autoT > 0) return; autoT = 0.3;
        const pigs = sim.live('pig').map(b => b.getPosition()).sort((a, b) => a.x - b.x); if (!pigs.length) return;
        const [px, py] = sim.aimAt(pigs[0].x, pigs[0].y, 0.97, alt++ % 2 === 1); sim.launch(px, py);
      } else if (S.phase === 'fly' && S.armed && S.flyers.length && S.flyers[0].getPosition().x > 8 && S.flyers[0].getUserData().kind !== 'red') sim.ability();
    }

    fit(); orient(); addEventListener('resize', orient);
    api.setTimer(true);
    say(`${P.text}: ${L('sestřel všechna prasata!', 'knock down every pig!')}`, 2);
    const kinds = [...new Set(spec.birds)].filter(k => k !== 'red');
    if (kinds.length) setTimeout(() => { if (!over) say(kinds.map(k => BIRD_NAME[k]).join(' · '), 3); }, 2100);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => null,
      progress: () => 1 - sim.live('pig').length / Math.max(1, S.pigsTotal),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', orient); if (full) setFull(false); stage.remove(); },
      pause() { setPause(true); },
      onKey(e) { if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); setPause(!paused); } },
      _state: () => ({ phase: S.phase, pigs: sim.live('pig').length, birds: S.birdsLeft.length + (S.bird ? 1 : 0), score: S.score, over, shots: S.shots }),
      _shoot(px, py) { return sim.launch(px, py); },
      _aim(high) { const pigs = sim.live('pig').map(b => b.getPosition()).sort((a, b) => a.x - b.x); if (!pigs.length) return false; const [px, py] = sim.aimAt(pigs[0].x, pigs[0].y, 0.97, !!high); return sim.launch(px, py); },
      _auto(on) { auto = on !== false; },
      _speed(n) { speed = Math.max(1, n | 0); },
      _solve() { for (const b of sim.live('pig')) sim.world.destroyBody(b); S.phase = 'won'; finish(); },
    };
  }

  // úvodní obrázek: prak, letící pták a pevnost s prasaty
  function art(el) {
    el.innerHTML = '<canvas width="520" height="360" style="object-fit:contain"></canvas>';
    const c = el.querySelector('canvas'), g = c.getContext('2d');
    g.beginPath(); g.roundRect(0, 0, 520, 360, 28); g.clip();
    PtArt.scene(g, 520, 360, 0.75);
  }
  return { DIFFS, generate, create, art };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'ptaci', title: 'PTAČÍ POMSTA', wording: 'play',
  tagline: Kit.L('Na motivy Angry Birds: natáhni prak, pusť ptáka a rozbij stavby ze dřeva, skla a kamene. Zelená prasata musí padnout všechna, a čím míň ptáků spotřebuješ, tím víc hvězd.', 'In the spirit of Angry Birds: pull the slingshot, let the bird fly and smash forts of wood, glass and stone. Every green pig has to fall, and the fewer birds you use, the more stars you get.'),
  diffs: Ptaci.DIFFS, generate: Ptaci.generate, create: Ptaci.create, art: Ptaci.art,
  dailyDiff: () => 'normal',
  levelDiff: n => (n <= 6 ? 'lehka' : n <= 12 ? 'normal' : 'tezka'),
  rules: Kit.L(`<p>Chyť prak (kdekoli na plátně), táhni dozadu a pusť. Tečky ukazují začátek dráhy.</p>
    <ul><li>Úroveň vyhraješ, když padnou <b>všechna prasata</b>. Za každého ušetřeného ptáka je 10 000 bodů navíc.</li>
    <li>Stavby se lámou nárazy: <b>sklo</b> praskne snadno, <b>dřevo</b> vydrží víc, <b>kámen</b> nejvíc. Skála se nerozbije.</li>
    <li>Za letu klepni pro schopnost: <b>žlutý</b> zrychlí a prorazí dřevo, <b>modrý</b> se rozdělí na tři a tříští sklo, <b>černý</b> vybuchne (i sám chvíli po dopadu).</li>
    <li>Hvězdy: tři, když ti zbude dost ptáků, dvě s aspoň jedním zbylým, jinak jedna. P pozastaví hru.</li></ul>`,
    `<p>Grab the slingshot (anywhere on the canvas), pull back and let go. The dots show the start of the flight path.</p>
    <ul><li>You win a level when <b>every pig</b> is down. Each bird you save is worth 10,000 bonus points.</li>
    <li>Forts break on impact: <b>glass</b> shatters easily, <b>wood</b> takes more, <b>stone</b> the most. Rock never breaks.</li>
    <li>Tap in flight for a power: <b>yellow</b> dashes and punches through wood, <b>blue</b> splits in three and shatters glass, <b>black</b> explodes (also by itself soon after landing).</li>
    <li>Stars: three when enough birds are left, two with at least one left, otherwise one. P pauses the game.</li></ul>`),
  achievements: [
    { id: 'w10', name: Kit.L('Prakostřelec', 'Slingshot ace'), desc: Kit.L('Vyhraj 10 úrovní', 'Win 10 levels'), prog: s => [Math.min(10, (s.data && s.data.wins) || 0), 10] },
    { id: 's3', name: Kit.L('Čistá práce', 'Clean job'), desc: Kit.L('5× tři hvězdy', 'Three stars 5 times'), prog: s => [Math.min(5, (s.data && s.data.three) || 0), 5] },
    { id: 'b80', name: Kit.L('Demoliční četa', 'Demolition crew'), desc: Kit.L('80 000 bodů v jedné úrovni', '80,000 points in one level'), prog: s => [Math.min(80000, (s.data && s.data.best) || 0), 80000] },
  ],
});
