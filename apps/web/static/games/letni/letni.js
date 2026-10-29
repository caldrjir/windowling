'use strict';
// ── LETNÍ HRY · Windowling Hlavolamy ────────────────────────────────────────
// Atletický víceboj na motivy mobilních Playman Summer Games: panáček běží, když střídavě mačkáš
// dvě tlačítka (← →), a skáče nebo hází načasovaným podržením akčního tlačítka (úhel roste, dokud
// držíš, a pustíš ho). Disciplíny: 100 m, skok daleký, 110 m překážek, hod oštěpem. Body podle
// desetibojařských tabulek. Vítr a soupeři se berou ze semínka, takže denní víceboj je pro všechny stejný.
const Letni = (() => {
  const L = Kit.L;
  const EVENTS = ['sprint', 'longjump', 'hurdles', 'javelin'];
  const EV = {
    sprint: { name: L('100 m', '100 m'), long: L('Sprint na 100 m', '100 m sprint'), unit: 's' },
    longjump: { name: L('Dálka', 'Long jump'), long: L('Skok daleký', 'Long jump'), unit: 'm' },
    hurdles: { name: L('Překážky', 'Hurdles'), long: L('110 m překážek', '110 m hurdles'), unit: 's' },
    javelin: { name: L('Oštěp', 'Javelin'), long: L('Hod oštěpem', 'Javelin throw'), unit: 'm' },
  };
  const DIFFS = [
    { id: 'decathlon', name: L('Víceboj', 'Multi-event'), note: L('všechny 4 disciplíny', 'all 4 events'), metric: 'score' },
    { id: 'sprint', name: EV.sprint.long, note: L('mačkej ← → střídavě', 'alternate ← →'), metric: 'score' },
    { id: 'longjump', name: EV.longjump.long, note: L('rozběh a odraz', 'run-up and take-off'), metric: 'score' },
    { id: 'hurdles', name: EV.hurdles.long, note: L('běh a skoky', 'run and jump'), metric: 'score' },
    { id: 'javelin', name: EV.javelin.long, note: L('rozběh a hod', 'run-up and throw'), metric: 'score' },
  ];
  // body podle desetibojařských tabulek (IAAF)
  const POINTS = {
    sprint: t => Math.max(0, Math.floor(25.4347 * Math.pow(Math.max(0, 18 - t), 1.81))),
    hurdles: t => Math.max(0, Math.floor(5.74352 * Math.pow(Math.max(0, 28.5 - t), 1.92))),
    longjump: m => Math.max(0, Math.floor(0.14354 * Math.pow(Math.max(0, m * 100 - 220), 1.4))),
    javelin: m => Math.max(0, Math.floor(10.14 * Math.pow(Math.max(0, m - 7), 1.08))),
  };
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const RIVALS = [['Bolt', 'Lewis', 'Owens', 'Zátopek', 'Johnson', 'Powell', 'Bubka', 'Šebrle', 'Dvořák', 'Železný'], ['USA', 'GBR', 'JAM', 'CZE', 'KEN', 'FRA', 'GER', 'CAN', 'ITA', 'NOR']];

  function levelSpec(n) {
    const ev = EVENTS[(n - 1) % 4], tier = Math.floor((n - 1) / 4);
    return { ev, target: Math.min(960, 520 + tier * 16), text: L(`Kolo ${n}`, `Round ${n}`) };
  }
  function generate(seed, diffId, ctx = {}) {
    const r = rngOf(seed);
    const wind = Math.round((r() - 0.4) * 30) / 10; // −1,2 … +1,8 m/s
    const rivalLevel = 0.85 + r() * 0.2;
    if (ctx.kind === 'level') { const s = levelSpec(ctx.key); return { seed, mode: 'level', events: [s.ev], target: s.target, wind, rivalLevel, text: s.text }; }
    if (ctx.kind === 'daily') return { seed, mode: 'daily', events: EVENTS.slice(), wind, rivalLevel, text: L('Denní víceboj', 'Daily multi-event') };
    if (diffId === 'decathlon' || !EV[diffId]) return { seed, mode: 'free', events: EVENTS.slice(), wind, rivalLevel };
    return { seed, mode: 'free', events: [diffId], wind, rivalLevel };
  }

  const athlete = LhArt.athlete;

  function create(el, P, saved, api) {
    const evs = P.events, multi = evs.length > 1;
    let evI = saved && saved.evI != null ? Math.min(evs.length - 1, saved.evI) : 0;
    const results = saved && saved.results ? saved.results.slice() : [];
    el.innerHTML = `<div class="lh-wrap">
      <div class="lh-hud"><div><small>${L('DISCIPLÍNA', 'EVENT')}</small><b class="lh-ev"></b></div><div><small>${L('BODY', 'POINTS')}</small><b class="lh-pts">0</b></div><div class="lh-res"></div></div>
      <div class="lh-stage"><canvas class="lh-cv"></canvas><div class="lh-msg" hidden></div></div>
      <div class="lh-pad">
        <button class="lh-btn run" data-b="l" aria-label="${L('Levá noha', 'Left foot')}">◀<small>${L('levá', 'left')}</small></button>
        <button class="lh-btn act" data-b="a">${L('SKOK', 'JUMP')}<small></small></button>
        <button class="lh-btn run" data-b="r" aria-label="${L('Pravá noha', 'Right foot')}">▶<small>${L('pravá', 'right')}</small></button>
      </div>
      <p class="lh-keys">${L('Klávesy: ← → střídavě běh, mezerník nebo ↑ skok, hod a úhel (drž a pusť)', 'Keys: ← → alternately to run, Space or ↑ to jump, throw and set the angle (hold and release)')}</p></div>`;
    const cv = el.querySelector('.lh-cv'), ctx = cv.getContext('2d'), msgEl = el.querySelector('.lh-msg'), actBtn = el.querySelector('[data-b="a"]');
    const VW = 640, VH = 360;
    let cssW = 640, cssH = 360, dpr = 1;
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      cssW = Math.floor(Math.min(box - 2, 960)); cssH = Math.round(cssW * VH / VW);
      const maxH = innerHeight - (innerWidth < 760 ? 300 : 250);
      if (cssH > maxH) { cssH = Math.max(200, maxH); cssW = Math.round(cssH * VW / VH); }
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = cssW * dpr; cv.height = cssH * dpr; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    }

    // ── Stav disciplíny ──
    const fx = rngOf(P.seed ^ 0x51);
    let ev, st, clock = 0, over = false, paused = false;
    const PPM = 34; // pixely na metr v logickém zobrazení
    function startEvent(i) {
      evI = i; ev = evs[i];
      const r = rngOf((P.seed + i * 977) >>> 0);
      st = { phase: 'ready', t: 0, x: 0, v: 0, y: 0, vy: 0, last: '', attempt: 1, best: null, marks: [], countdown: ev === 'sprint' || ev === 'hurdles' ? 2.4 : 1.2, falseStart: false,
        hold: false, angle: 0, airT: 0, jav: null, pose: 'stand', step: 0, hurdlesDown: [], landing: null, done: false, info: '', infoT: 0, wind: P.wind };
      // soupeři v ostatních drahách
      st.rivals = (ev === 'sprint' || ev === 'hurdles') ? [0, 1, 2].map(k => {
        const base = ev === 'sprint' ? 10.15 + r() * 1.5 : 13.4 + r() * 2.1, T = base / P.rivalLevel + (k === 0 ? 0.2 : 0);
        const tau = 1.1, x = t => vmax * (t - tau * (1 - Math.exp(-t / tau)));
        let vmax = 10; for (let it = 0; it < 30; it++) vmax *= (ev === 'sprint' ? 100 : 110) / x(T);
        return { name: RIVALS[0][Math.floor(r() * 10)], nat: RIVALS[1][Math.floor(r() * 10)], T, pos: t => Math.min(ev === 'sprint' ? 100 : 110, vmax * (t - tau * (1 - Math.exp(-t / tau)))), shirt: ['#55f6ff', '#ffd34d', '#6dff9e'][k] };
      }) : [];
      st.hurdles = ev === 'hurdles' ? [...Array(10)].map((_, k) => 13.72 + k * 9.14) : [];
      actBtn.firstChild.textContent = ev === 'javelin' ? L('HOD', 'THROW') : L('SKOK', 'JUMP');
      actBtn.disabled = ev === 'sprint';
      el.querySelector('.lh-ev').textContent = EV[ev].long;
      say(ev === 'sprint' || ev === 'hurdles' ? L('Připravit…', 'On your marks…') : `${EV[ev].long} · ${L('pokus', 'attempt')} 1/3`);
      syncHUD();
    }
    function say(text, t = 1.6) { msgEl.textContent = text; msgEl.hidden = false; st.infoT = t; }
    const total = () => results.reduce((a, r) => a + r.pts, 0);
    function syncHUD() {
      el.querySelector('.lh-pts').textContent = Kit.fmtNum(total());
      el.querySelector('.lh-res').innerHTML = evs.map((e, k) => { const r = results[k]; return `<span class="${k === evI ? 'on' : ''}">${EV[e].name}<b>${r ? r.pts : '–'}</b></span>`; }).join('');
    }

    // ── Vstupy: střídavé nohy a akční tlačítko ──
    const taps = [];
    function foot(side) {
      if (over || paused || !st) return;
      if (st.phase === 'ready') { if (st.countdown < 1.2 && st.countdown > 0 && (ev === 'sprint' || ev === 'hurdles') && !st.falseStart) { st.falseStart = true; api.sound('error'); say(L('Ulitý start! Znovu.', 'False start! Again.')); st.countdown = 2.4; } return; }
      if (st.phase !== 'run') return;
      if (side === st.last || st.y > 0) return; // stejná noha dvakrát (nebo ve vzduchu) = nic
      st.last = side; taps.push(clock);
      st.v += 0.75 * (1 - st.v / 12.4);
      api.sound('soft');
    }
    function action(down) {
      if (over || paused || !st || ev === 'sprint') return;
      if (ev === 'hurdles') { if (down && st.phase === 'run' && st.y <= 0) { st.vy = 3.3; st.y = 0.001; api.sound('tap'); } return; }
      // stisk = odraz/zastavení na místě, podržení zvedá úhel, puštění skočí nebo hodí
      if (down && st.phase === 'run') {
        const line = ev === 'longjump' ? 40 : 30;
        if (st.x > line + 0.05) { foul(); return; }
        st.phase = 'aim'; st.hold = true; st.angle = 0; st.take = st.x; api.sound('tap');
      } else if (!down && st.phase === 'aim') release();
    }
    function release() {
      st.hold = false;
      const line = ev === 'longjump' ? 40 : 30, a = st.angle * Math.PI / 180;
      api.sound('place');
      if (ev === 'longjump') { st.phase = 'air'; st.vx = st.v * Math.cos(a); st.vy = st.v * Math.sin(a) * 0.74; st.y = 0.001; }
      else { const vj = 2.4 * st.v + 4; st.phase = 'throw'; st.jav = { x: st.x + 0.3, y: 1.9, vx: vj * Math.cos(a) + st.wind * 0.15, vy: vj * Math.sin(a), ang: a, flying: true }; }
    }
    function foul() { st.hold = false; st.phase = 'foul'; st.v *= 0.4; api.sound('error'); say(L('Přešlap! Pokus neplatí.', 'Foul! No mark.')); mark(null); }
    function mark(val) {
      st.marks.push(val);
      if (val != null && (st.best == null || val > st.best)) st.best = val;
      if (val != null) st.ex = 0.8;
      st.next = 1.8;
    }
    function finishEvent(val) {
      const pts = val == null ? 0 : POINTS[ev](val);
      results[evI] = { ev, val, pts }; syncHUD(); api.changed();
      st.phase = 'done'; st.next = 2.6;
      const md = medal(pts);
      say(val == null ? L('Bez platného pokusu · 0 bodů', 'No valid mark · 0 points') : `${md ? md + ' ' : ''}${fmtVal(ev, val)} · ${pts} ${L('bodů', 'points')}`, 2.6);
      cheer(pts >= 750 ? 90 : pts >= 600 ? 40 : 0, VW / 2, 150);
      api.sound(pts >= 800 ? 'star' : 'line');
    }
    const medal = pts => (pts >= 900 ? '🥇' : pts >= 750 ? '🥈' : pts >= 600 ? '🥉' : '');
    const fmtVal = (e, v) => (EV[e].unit === 's' ? `${v.toFixed(2)} s` : `${v.toFixed(2)} m`);
    function endGame() {
      over = true; api.setTimer(false);
      const sum = total();
      const rows = results.map(r => `<tr><td>${medal(r.pts)} ${EV[r.ev].long}</td><td>${r.val == null ? '–' : fmtVal(r.ev, r.val)}</td><td><b>${r.pts}</b></td></tr>`).join('');
      const html = `<table class="lh-table">${rows}<tr><td colspan="2">${L('Celkem', 'Total')}</td><td><b>${sum}</b></td></tr></table>`;
      if (P.mode === 'level') {
        const s = sum >= P.target + 140 ? 3 : sum >= P.target + 70 ? 2 : 1;
        if (sum < P.target) { api.failed({ score: sum, html: `<p class="k-muted">${L(`Cíl ${P.target} bodů`, `Target ${P.target} points`)}</p>${html}` }); return; }
        api.solved({ title: `${sum} ${L('bodů', 'pts')}`, stars: s, score: sum, html }); return;
      }
      const per = sum / evs.length, stars = per >= 850 ? 3 : per >= 650 ? 2 : 1;
      if (multi) api.data.best = Math.max(api.data.best || 0, sum);
      api.solved({ title: `${Kit.fmtNum(sum)} ${L('bodů', 'pts')}`, stars, score: sum, html });
    }

    // ── Simulace ──
    function tick(dt) {
      clock += dt;
      if (st.infoT > 0) { st.infoT -= dt; if (st.infoT <= 0) msgEl.hidden = true; }
      const sprintLike = ev === 'sprint' || ev === 'hurdles';
      if (st.phase === 'ready') {
        st.countdown -= dt; st.pose = sprintLike ? 'set' : 'stand';
        if (sprintLike && st.countdown < 1.2 && st.countdown + dt >= 1.2) say(L('Pozor…', 'Get set…'), 1);
        if (st.countdown <= 0) { st.phase = 'run'; st.t = 0; if (sprintLike) { say(L('START!', 'GO!'), 0.8); api.sound('star'); } }
        return;
      }
      // rychlost: tapy ji zvedají, odpor ji brzdí
      if (st.phase === 'run' || st.phase === 'foul') {
        st.v = Math.max(0, st.v - (0.9 + 0.08 * st.v) * dt * (st.phase === 'foul' ? 4 : 1));
        st.t += dt;
      }
      if (st.phase === 'run') {
        st.x += st.v * dt; st.step += st.v * dt * 1.9; st.pose = st.v > 0.3 ? 'run' : 'stand';
        if (ev === 'hurdles') {
          if (st.y > 0) { st.vy -= 9.81 * dt; st.y += st.vy * dt; st.pose = 'hurdle'; if (st.y <= 0) { st.y = 0; st.vy = 0; st.v *= 0.94; } }
          // překážka se vyhodnotí ve chvíli, kdy ji běžec míjí: nízko = shozená a zpomalení
          for (let k = 0; k < st.hurdles.length; k++) {
            if (st.hurdlesDown[k] || st.x < st.hurdles[k]) continue;
            if (st.y < 0.32) { st.hurdlesDown[k] = 1; st.v *= 0.55; api.sound('error'); st.hitT = 0.4; }
            else st.hurdlesDown[k] = 2;
          }
        }
        const goal = ev === 'sprint' ? 100 : ev === 'hurdles' ? 110 : null;
        if (goal && st.x >= goal) {
          const tt = st.t - (st.x - goal) / Math.max(0.1, st.v);
          st.phase = 'finish'; st.fin = tt; api.sound('place');
          finishEvent(Math.round(tt * 100) / 100);
          return;
        }
        // rozběh bez odrazu: za čárou je přešlap
        if ((ev === 'longjump' || ev === 'javelin') && st.x > (ev === 'longjump' ? 40.6 : 30.6)) foul();
        if (st.t > 40 && goal) { finishEvent(null); }
      }
      if (st.phase === 'aim') {
        // odraz: krátce se drží rychlost, úhel roste; na 80° se pustí sám
        st.v = Math.max(0, st.v - 0.6 * dt); st.angle = Math.min(80, st.angle + 110 * dt);
        st.pose = ev === 'javelin' ? 'throw' : 'takeoff';
        if (st.angle >= 80) release();
      }
      if (st.phase === 'air') {
        st.vy -= 9.81 * dt; st.y += st.vy * dt; st.x += st.vx * dt; st.pose = 'jump';
        if (st.y <= 0) { st.y = 0; const d = Math.max(0, st.x - 40 + 1.15); st.phase = 'landed'; st.pose = 'land'; st.landing = st.x + 1.15; api.sound('place'); const m = Math.round(d * 100) / 100; say(`${m.toFixed(2)} m`, 1.6); mark(m); }
      }
      if (st.phase === 'throw') {
        st.v = Math.max(0, st.v - 9 * dt); st.x += st.v * dt; st.pose = 'release';
        const j = st.jav;
        if (j.flying) {
          j.vy -= 9.81 * dt; j.x += j.vx * dt; j.y += j.vy * dt; j.ang = Math.atan2(j.vy, j.vx);
          if (j.y <= 0) { j.y = 0; j.flying = false; const d = Math.round((j.x - 30) * 100) / 100; api.sound('place'); say(`${Math.max(0, d).toFixed(2)} m`, 1.6); mark(Math.max(0, d)); }
        }
      }
      if (st.next != null && st.phase !== 'run') {
        st.next -= dt;
        if (st.next <= 0) {
          st.next = null;
          if (st.phase === 'done') { if (evI + 1 < evs.length) { startEvent(evI + 1); api.changed(); } else endGame(); return; }
          if (st.marks.length >= 3) { finishEvent(st.best); return; }
          // další pokus
          Object.assign(st, { phase: 'ready', countdown: 1.0, x: 0, v: 0, y: 0, vy: 0, last: '', hold: false, angle: 0, jav: null, landing: null, attempt: st.attempt + 1, t: 0 });
          say(`${EV[ev].long} · ${L('pokus', 'attempt')} ${st.attempt}/3`);
        }
      }
      if (st.hitT > 0) st.hitT -= dt;
    }

    // ── Kresba ──
    const crowd = LhArt.makeCrowd(P.seed ^ 0xc40d), confetti = [], flashes = [];
    let drawDt = 0;
    const RIVAL_LOOK = [{ skin: '#a8694a', hair: '#1a1210', shorts: '#1d1d2a', shoe: '#ffffff' }, { skin: '#ffd9b3', hair: '#d8a24a', shorts: '#14365e', shoe: '#ff5a7a' }, { skin: '#6e4330', hair: '#1a1210', shorts: '#0f4a2a', shoe: '#55f6ff' }];
    function cheer(n, x, y) { st.ex = 1; if (n) LhArt.confetti(confetti, x, y, n, fx); }
    function draw() {
      const g = ctx, k = cssW / VW, dt = drawDt;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      const flying = st.jav && st.phase === 'throw', focus = flying ? st.jav.x : st.x, camX = focus * PPM - VW * (flying ? 0.55 : 0.32);
      const trackY = 300, sprintLike = ev === 'sprint' || ev === 'hurdles', goal = ev === 'sprint' ? 100 : 110;
      const X = m => m * PPM - camX;
      // nadšení diváků a blesky fotoaparátů
      if (sprintLike && st.phase === 'run' && st.x > goal - 25) st.ex = Math.max(st.ex || 0, 0.5);
      st.ex = Math.max(0, (st.ex || 0) - dt * 0.25);
      if (st.ex > 0.3 && fx() < dt * 14 * st.ex) flashes.push({ x: fx() * 1408, y: 86 + Math.floor(fx() * 6) * 19, a: 1 });
      for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].a -= dt * 5; if (flashes[i].a <= 0) flashes.splice(i, 1); }
      const shown = sprintLike ? (st.phase === 'finish' || st.phase === 'done' ? (st.fin || 0) : st.t).toFixed(2) : st.best != null ? `${st.best.toFixed(2)} m` : `${st.attempt}/3`;
      LhArt.stadium(g, { VW, VH, camX, t: clock, ex: st.ex, crowd, flashes, board: [EV[ev].long.toUpperCase(), shown] });
      LhArt.track(g, { VW, VH, camX });
      // značky po 10 m
      g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '700 11px Space Grotesk, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      for (let m = 0; m <= 130; m += 10) { const px = X(m); if (px < -20 || px > VW + 20) continue; g.fillRect(px - 1, 324, 2, 10); g.fillText(`${m}`, px, 348); }
      if (sprintLike) {
        // čísla drah a startovní bloky
        g.font = '900 13px Unbounded, sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)';
        [250, 270, 290, 316].forEach((ly, i) => g.fillText(`${i + 1}`, X(-1.6), ly));
        g.fillStyle = '#fff'; g.fillRect(X(0) - 2, 237, 3, 87);
        if (st.phase === 'ready') { g.fillStyle = '#3a3f52'; g.beginPath(); g.moveTo(X(-0.9), 314); g.lineTo(X(-0.55), 314); g.lineTo(X(-0.9), 304); g.fill(); g.beginPath(); g.moveTo(X(-0.45), 314); g.lineTo(X(-0.1), 314); g.lineTo(X(-0.45), 306); g.fill(); }
        // cíl: šachovnice a portál s časomírou
        const fin = X(goal);
        if (fin > -80 && fin < VW + 80) {
          g.fillStyle = '#fff'; g.fillRect(fin - 2, 237, 4, 87);
          for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#111' : '#fff'; g.fillRect(fin + 2, 237 + i * 14.5, 6, 14.5); }
          g.fillStyle = '#d8dde8'; g.fillRect(fin - 34, 160, 5, 76); g.fillRect(fin + 30, 160, 5, 76);
          g.fillStyle = '#16123a'; g.beginPath(); g.roundRect(fin - 40, 150, 80, 30, 5); g.fill();
          g.strokeStyle = '#ffd34d'; g.lineWidth = 2; g.stroke();
          g.fillStyle = '#ffe066'; g.font = '900 14px Unbounded, sans-serif'; g.textBaseline = 'middle'; g.fillText(shown, fin, 166); g.textBaseline = 'alphabetic';
        }
      }
      if (ev === 'longjump') {
        // rozběhová dráha, odrazové prkno a doskočiště s pískem
        g.fillStyle = '#fff'; g.fillRect(X(39.8), 298, X(40) - X(39.8), 22); g.fillStyle = '#7fd6a0'; g.fillRect(X(40), 298, X(40.1) - X(40), 22);
        g.fillStyle = '#6a4a2a'; g.beginPath(); g.roundRect(X(40.5) - 3, 292, X(50) - X(40.5) + 6, 34, 6); g.fill();
        const sand = g.createLinearGradient(0, 295, 0, 323); sand.addColorStop(0, '#f6e2a0'); sand.addColorStop(1, '#e2c27a');
        g.fillStyle = sand; g.beginPath(); g.roundRect(X(40.5), 295, X(50) - X(40.5), 28, 5); g.fill();
        g.fillStyle = 'rgba(160,120,60,.35)'; for (let i = 0; i < 60; i++) g.fillRect(X(40.5 + (i * 0.37) % 9.4), 297 + (i * 7) % 24, 3, 1.5);
        g.font = '700 10px Space Grotesk, sans-serif'; g.textAlign = 'center';
        for (const m of [6, 7, 8, 9]) { const px = X(40 + m); g.fillStyle = '#fff'; g.fillRect(px - 1, 270, 2, 22); g.fillStyle = m === 8 ? '#ff5a7a' : '#1b6bd6'; g.fillRect(px + 1, 270, 12, 8); g.fillStyle = 'rgba(255,255,255,.95)'; g.fillText(`${m} m`, px, 266); }
        for (const mk of st.marks) if (mk != null) { const px = X(40 + mk); g.fillStyle = '#ffd34d'; g.strokeStyle = '#16123a'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, 294); g.lineTo(px - 6, 284); g.lineTo(px + 6, 284); g.closePath(); g.fill(); g.stroke(); }
        if (st.landing) { g.fillStyle = 'rgba(120,80,40,.45)'; g.beginPath(); g.ellipse(X(st.landing - 0.15), 314, 18, 5, 0, 0, 7); g.fill(); }
      }
      if (ev === 'javelin') {
        // výseč na trávníku s posekanými pruhy a čarami po 10 m
        g.save(); g.beginPath(); g.moveTo(X(30.5), 237); g.lineTo(X(160), 237); g.lineTo(X(160), 324); g.lineTo(X(30.5), 324); g.clip();
        g.fillStyle = '#4caf48'; g.fillRect(0, 237, VW, 87);
        g.fillStyle = 'rgba(255,255,255,.08)'; for (let m = 30; m < 160; m += 8) g.fillRect(X(m), 237, 4 * PPM, 87);
        g.font = '700 11px Space Grotesk, sans-serif'; g.textAlign = 'center';
        for (let m = 40; m <= 110; m += 10) { const px = X(30 + m); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, 237); g.lineTo(px - 14, 324); g.stroke(); g.fillStyle = '#fff'; g.fillText(`${m} m`, px - 7, 252); }
        g.restore();
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(X(30), 312, 8, 26, 0, -Math.PI / 2, Math.PI / 2); g.lineTo(X(30), 286); g.fill();
        for (const mk of st.marks) if (mk != null) { const px = X(30 + mk); g.fillStyle = '#ffd34d'; g.strokeStyle = '#16123a'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, 306); g.lineTo(px - 6, 295); g.lineTo(px + 6, 295); g.closePath(); g.fill(); g.stroke(); }
      }
      const hurdle = (px, base, sc, down) => {
        g.save(); g.translate(px, base); g.scale(sc, sc); if (down) g.rotate(1.35);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-6, 0, 20, 2);
        g.strokeStyle = '#2b1712'; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-6, 0); g.lineTo(10, 0); g.moveTo(0, 0); g.lineTo(0, -34); g.stroke();
        g.strokeStyle = '#d8dde8'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-6, 0); g.lineTo(10, 0); g.moveTo(0, 0); g.lineTo(0, -34); g.stroke();
        g.fillStyle = '#fff'; g.strokeStyle = '#2b1712'; g.lineWidth = 1.2; g.beginPath(); g.rect(-3, -39, 10, 9); g.fill(); g.stroke(); g.fillStyle = '#16123a'; g.fillRect(0.5, -39, 3.5, 9);
        g.restore();
      };
      if (ev === 'hurdles') st.hurdles.forEach((hx, i) => {
        const px = X(hx); if (px < -30 || px > VW + 30) return;
        [[254, 0.55], [274, 0.6], [294, 0.65]].forEach(([ly, sc]) => hurdle(px, ly, sc, false));
        hurdle(px, trackY + 14, 1, st.hurdlesDown[i] === 1);
      });
      // soupeři vzadu
      st.rivals.forEach((rv, i) => {
        const rx = st.phase === 'ready' ? 0 : rv.pos(st.t), ly = 254 + i * 20, done = rx >= goal;
        const pose = st.phase === 'ready' ? 'set' : done ? (rv.T < (st.fin || 99) && rv.T <= Math.min(...st.rivals.map(q => q.T)) ? 'cheer' : 'stand') : 'run';
        g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(X(rx), ly + 1, 10, 2.5, 0, 0, 7); g.fill();
        athlete(g, X(rx), ly, PPM * 0.6, { pose, phase: rx * 1.9 + i, shirt: rv.shirt, speed: 9, t: clock, ...RIVAL_LOOK[i] });
      });
      // hlavní závodník: stín, prach od tretr a čáry rychlosti
      const ax = X(st.x), ay = trackY + 14 - st.y * PPM;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(ax, trackY + 15, 18 - Math.min(10, st.y * 6), 4, 0, 0, 7); g.fill();
      if (st.v > 6 && (st.phase === 'run' || st.phase === 'aim') && st.y <= 0) {
        g.strokeStyle = `rgba(255,255,255,${Math.min(0.5, (st.v - 6) / 8)})`; g.lineWidth = 2; g.lineCap = 'round';
        for (const [dy, l] of [[-50, 26], [-34, 36], [-18, 22]]) { const o = (clock * 300) % 12; g.beginPath(); g.moveTo(ax - 30 - o, ay + dy); g.lineTo(ax - 30 - l - o, ay + dy); g.stroke(); }
        g.fillStyle = 'rgba(230,140,110,.5)'; for (let i = 0; i < 3; i++) { const o = (clock * 2.3 + i / 3) % 1; g.beginPath(); g.arc(ax - 8 - o * 26, ay - 2 - o * 6, 2 + o * 3, 0, 7); g.fill(); }
      }
      const look = { skin: '#ffcf9e', hair: '#3a2414', shorts: '#16123a', shoe: '#ffd34d' };
      const { hand } = athlete(g, ax, ay, PPM, { pose: st.hitT > 0 ? 'fall' : st.pose, phase: st.step, speed: st.v, shirt: '#ff5a7a', num: 1, t: clock, ...look });
      // oštěp
      if (ev === 'javelin') {
        const j = st.jav;
        const jav = (x, y, ang) => { g.save(); g.translate(x, y); g.rotate(-ang); g.lineCap = 'round'; g.strokeStyle = '#2b1712'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(-42, 0); g.lineTo(44, 0); g.stroke(); g.strokeStyle = '#f2f4fa'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-42, 0); g.lineTo(44, 0); g.stroke(); g.fillStyle = '#ff5a5a'; g.fillRect(-6, -2.5, 12, 5); g.fillStyle = '#9aa3b8'; g.beginPath(); g.moveTo(42, -2.5); g.lineTo(52, 0); g.lineTo(42, 2.5); g.fill(); g.restore(); };
        if (j) { if (j.flying) { g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(X(j.x), trackY + 15, 30, 3, 0, 0, 7); g.fill(); } jav(X(j.x), trackY + 14 - j.y * PPM, j.flying ? j.ang : Math.max(-0.7, j.ang)); }
        else jav(hand[0], hand[1] - 4, st.hold ? st.angle * Math.PI / 180 : 0.15);
      }
      // ukazatel úhlu při držení: zelená výseč je ideál
      if (st.hold) {
        const cx = ax + 44, cy = ay - 76, R = 36, a = st.angle * Math.PI / 180;
        g.fillStyle = 'rgba(10,8,30,.75)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R + 8, -Math.PI / 2 - 0.12, 0.12); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, R - 4, -Math.PI / 2, 0); g.stroke();
        g.strokeStyle = '#6dff9e'; g.beginPath(); g.arc(cx, cy, R - 4, -(48 * Math.PI / 180), -(36 * Math.PI / 180)); g.stroke();
        g.strokeStyle = '#ffe066'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy - Math.sin(a) * R); g.stroke();
        g.fillStyle = '#fff'; g.font = '800 12px Unbounded, sans-serif'; g.textAlign = 'left'; g.fillText(`${Math.round(st.angle)}°`, cx + 6, cy + 14);
      }
      LhArt.drawConfetti(g, confetti, dt);
      // HUD jako v televizním přenosu
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillStyle = 'rgba(12,8,36,.85)'; g.beginPath(); g.roundRect(10, 10, 254, 56, 12); g.fill();
      const tab = g.createLinearGradient(10, 10, 66, 66); tab.addColorStop(0, '#ff5a7a'); tab.addColorStop(1, '#ff9a3d');
      g.fillStyle = tab; g.beginPath(); g.roundRect(10, 10, 56, 56, [12, 0, 0, 12]); g.fill();
      LhArt.pictogram(g, ev, 38, 39, 1.25);
      g.fillStyle = '#fff'; g.font = `800 ${sprintLike ? 20 : 17}px Unbounded, sans-serif`;
      g.fillText(sprintLike ? `${shown} s` : `${L('Pokus', 'Try')} ${Math.min(3, st.attempt)}/3`, 76, 34);
      g.font = '700 11px Space Grotesk, sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)';
      g.fillText(sprintLike ? `${Math.max(0, Math.min(goal, st.x)).toFixed(0)} / ${goal} m` : `${L('nejlepší', 'best')} ${st.best != null ? st.best.toFixed(2) + ' m' : '–'}`, 76, 54);
      // rychloměr z dílků
      const sp = Math.min(1, st.v / 11);
      for (let i = 0; i < 10; i++) { const on = sp * 10 > i + 0.2; g.fillStyle = on ? (i < 5 ? '#6dff9e' : i < 8 ? '#ffe066' : '#ff5a5a') : 'rgba(255,255,255,.12)'; g.fillRect(186 + i * 7, 44, 5, 12); }
      g.fillStyle = '#fff'; g.font = '700 11px Space Grotesk, sans-serif'; g.fillText(`${(st.v * 3.6).toFixed(0)} km/h`, 186, 34);
      // vítr s rukávem a pokusy
      const rw = sprintLike ? 118 : 160, rx0 = VW - 10 - rw;
      g.fillStyle = 'rgba(12,8,36,.85)'; g.beginPath(); g.roundRect(rx0, 10, rw, sprintLike ? 34 : 56, 12); g.fill();
      const wsx = rx0 + 14, wsy = 20, wd = st.wind >= 0 ? 1 : -1, wl = 8 + Math.min(1, Math.abs(st.wind) / 2) * 12;
      g.strokeStyle = '#d8dde8'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(wsx, wsy - 4); g.lineTo(wsx, wsy + 16); g.stroke();
      for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? '#fff' : '#ff6a3d'; const x0 = wsx + wd * i * wl / 3, sw = Math.sin(clock * 8 + i) * 0.8; g.beginPath(); g.moveTo(x0, wsy - 3 + i * 0.7 + sw); g.lineTo(x0 + wd * wl / 3, wsy - 2.3 + (i + 1) * 0.7 + sw); g.lineTo(x0 + wd * wl / 3, wsy + 5 - (i + 1) * 0.7 + sw); g.lineTo(x0, wsy + 5 - i * 0.7 + sw); g.fill(); }
      g.fillStyle = '#fff'; g.font = '700 11px Space Grotesk, sans-serif'; g.textAlign = 'right';
      g.fillText(`${L('vítr', 'wind')} ${st.wind >= 0 ? '+' : ''}${st.wind.toFixed(1)} m/s`, rx0 + rw - 12, 31);
      if (!sprintLike) for (let i = 0; i < 3; i++) {
        const m = st.marks[i], bx = rx0 + 10 + i * 48;
        g.fillStyle = m === undefined ? 'rgba(255,255,255,.1)' : m === null ? 'rgba(255,90,90,.85)' : m === st.best ? '#ffd34d' : 'rgba(109,255,158,.8)';
        g.beginPath(); g.roundRect(bx, 42, 44, 16, 8); g.fill();
        g.fillStyle = m === undefined ? 'rgba(255,255,255,.4)' : '#16123a'; g.textAlign = 'center'; g.font = '800 10px Space Grotesk, sans-serif';
        g.fillText(m === undefined ? `${i + 1}.` : m === null ? 'X' : m.toFixed(2), bx + 22, 54);
      }
      // startovní světla
      if (sprintLike && (st.phase === 'ready' || (st.phase === 'run' && st.t < 0.7))) {
        const go = st.phase === 'run', on = go ? 3 : st.countdown < 1.2 ? 2 : 1, cx = VW / 2;
        g.fillStyle = 'rgba(12,8,36,.88)'; g.beginPath(); g.roundRect(cx - 62, 128, 124, 40, 20); g.fill();
        for (let i = 0; i < 3; i++) {
          const lit = go || i < on, col = go ? '#6dff9e' : '#ff4d4d';
          if (lit) { const gl = g.createRadialGradient(cx - 36 + i * 36, 148, 2, cx - 36 + i * 36, 148, 22); gl.addColorStop(0, col); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(cx - 58 + i * 36, 126, 44, 44); }
          g.fillStyle = lit ? col : '#3a3550'; g.beginPath(); g.arc(cx - 36 + i * 36, 148, 11, 0, 7); g.fill();
        }
      }
    }

    // ── Smyčka a ovládání ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; drawDt = paused ? 0 : dt;
      if (api.paused && api.paused() && !paused && !over) setPause(true);
      if (!paused && !over) { tick(dt); if (auto) autoplay(dt); }
      draw();
    }
    function setPause(on) { if (over) return; paused = on; api.setTimer(!on); if (on) say(L('Pauza · stiskni P', 'Paused · press P'), 9999); else msgEl.hidden = true; }
    const pad = el.querySelector('.lh-pad');
    pad.addEventListener('pointerdown', e => { const b = e.target.closest('[data-b]'); if (!b || b.disabled) return; e.preventDefault(); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ukazatel už neplatí */ } if (b.dataset.b === 'a') action(true); else foot(b.dataset.b); });
    const up = e => { const b = e.target.closest('[data-b]'); if (!b) return; b.classList.remove('on'); if (b.dataset.b === 'a') action(false); };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    const KEYS = { ArrowLeft: 'l', ArrowRight: 'r', a: 'l', d: 'r', A: 'l', D: 'r' };
    const onKeyUp = e => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') action(false); };
    addEventListener('keyup', onKeyUp);
    // automat pro testy: střídá nohy a pouští úhel kolem 42°
    let auto = false, autoT = 0;
    function autoplay(dt) {
      autoT -= dt; if (autoT > 0) return; autoT = 0.09;
      if (st.phase === 'run') {
        foot(st.last === 'l' ? 'r' : 'l');
        if (ev === 'hurdles') { const nx = st.hurdles.find(h => h > st.x); if (nx && nx - st.x < 1.9 && st.y <= 0) action(true); }
        if ((ev === 'longjump' && st.x > 39.2) || (ev === 'javelin' && st.x > 29.2)) action(true);
      }
      if (st.phase === 'aim' && st.angle >= 42) action(false);
    }

    fit(); addEventListener('resize', fit);
    startEvent(evI);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => (over ? null : { evI, results }),
      progress: () => results.filter(Boolean).length / evs.length,
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('keyup', onKeyUp); },
      pause() { setPause(true); },
      onKey(e) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); setPause(!paused); return; }
        if (KEYS[e.key]) { e.preventDefault(); if (!e.repeat) foot(KEYS[e.key]); return; }
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); if (!e.repeat) action(true); }
      },
      _state: () => ({ ev, evI, phase: st.phase, x: +st.x.toFixed(2), v: +st.v.toFixed(2), t: +st.t.toFixed(2), attempt: st.attempt, marks: st.marks.slice(), best: st.best, results: results.slice(), over }),
      _auto(on) { auto = on !== false; },
      _solve() { for (let k = 0; k < evs.length; k++) results[k] = results[k] || { ev: evs[k], val: evs[k] === 'sprint' ? 10.5 : evs[k] === 'hurdles' ? 14 : evs[k] === 'longjump' ? 7.8 : 75, pts: 900 }; endGame(); },
    };
  }

  // úvodní obrázek: překážkář v letu před plným stadionem, nad ním letí oštěp
  function art(el) {
    el.innerHTML = '<canvas width="520" height="360" style="object-fit:contain"></canvas>';
    const g = el.querySelector('canvas').getContext('2d');
    g.beginPath(); g.roundRect(0, 0, 520, 360, 28); g.clip();
    g.fillStyle = '#c9512f'; g.fillRect(0, 0, 520, 360); g.translate(0, -26);
    LhArt.stadium(g, { VW: 520, VH: 360, camX: -560, t: 2.2, ex: 0.9, crowd: LhArt.makeCrowd(11), board: ['WINDOWLING', 'LETNÍ HRY'], flashes: [{ x: 120, y: 105, a: 1 }, { x: 330, y: 143, a: 0.8 }, { x: 460, y: 86, a: 0.9 }] });
    LhArt.track(g, { VW: 520, VH: 390, camX: 0 });
    // překážky v drahách
    const hurdle = (x, y, sc) => { g.save(); g.translate(x, y); g.scale(sc, sc); g.lineCap = 'round'; for (const [w, c] of [[4.5, '#2b1712'], [2.5, '#d8dde8']]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(-6, 0); g.lineTo(10, 0); g.moveTo(0, 0); g.lineTo(0, -34); g.stroke(); } g.fillStyle = '#fff'; g.strokeStyle = '#2b1712'; g.lineWidth = 1.2; g.beginPath(); g.rect(-3, -39, 10, 9); g.fill(); g.stroke(); g.fillStyle = '#16123a'; g.fillRect(0.5, -39, 3.5, 9); g.restore(); };
    hurdle(120, 274, 0.6); hurdle(430, 274, 0.6); hurdle(80, 296, 0.66); hurdle(390, 296, 0.66);
    LhArt.athlete(g, 70, 274, 22, { pose: 'run', phase: 2.2, speed: 9, shirt: '#55f6ff', skin: '#a8694a', hair: '#1a1210', shorts: '#1d1d2a', shoe: '#fff' });
    LhArt.athlete(g, 330, 296, 24, { pose: 'hurdle', speed: 9, shirt: '#6dff9e', skin: '#6e4330', hair: '#1a1210', shorts: '#0f4a2a', shoe: '#55f6ff' });
    hurdle(268, 316, 1.25);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(262, 318, 34, 6, 0, 0, 7); g.fill();
    LhArt.athlete(g, 240, 290, 58, { pose: 'hurdle', speed: 10, shirt: '#ff5a7a', num: 1, shorts: '#16123a', shoe: '#ffd34d', t: 0.3 });
    // oštěp na obloze
    g.save(); g.translate(140, 84); g.rotate(-0.28); g.lineCap = 'round'; for (const [w, c] of [[5, '#2b1712'], [3, '#f2f4fa']]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(-60, 0); g.lineTo(62, 0); g.stroke(); } g.fillStyle = '#ff5a5a'; g.fillRect(-8, -3, 16, 6); g.fillStyle = '#9aa3b8'; g.beginPath(); g.moveTo(60, -3); g.lineTo(74, 0); g.lineTo(60, 3); g.fill(); g.restore();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(10, 150); g.quadraticCurveTo(40, 104, 80, 98); g.stroke(); g.setLineDash([]);
    // konfety
    const r = LhArt.rngOf(5), cols = ['#ff5a7a', '#ffd34d', '#55f6ff', '#6dff9e', '#c77dff', '#fff'];
    for (let i = 0; i < 46; i++) { g.save(); g.translate(r() * 520, 70 + r() * 150); g.rotate(r() * 6); g.fillStyle = cols[i % 6]; g.fillRect(-3, -1.5, 6, 3); g.restore(); }
  }
  return { DIFFS, EVENTS, POINTS, generate, create, art, levelSpec, athlete };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'letni', title: 'LETNÍ HRY', wording: 'play',
  tagline: Kit.L('Atletický víceboj na motivy mobilních Playman Summer Games: běh na 100 m, skok daleký, překážky a oštěp. Mačkej střídavě dvě tlačítka a trefuj úhel odrazu.', 'An athletics multi-event in the spirit of the mobile Playman Summer Games: 100 m, long jump, hurdles and javelin. Alternate two buttons and nail the take-off angle.'),
  diffs: Letni.DIFFS, generate: Letni.generate, create: Letni.create, art: Letni.art,
  dailyDiff: () => 'decathlon',
  levelDiff: n => Letni.levelSpec(n).ev,
  rules: Kit.L(`<p>Čtyři atletické disciplíny. Výkon se přepočítá na body podle desetibojařských tabulek a body se sčítají.</p>
    <ul><li><b>Běh:</b> mačkej střídavě levou a pravou (← → nebo tlačítka ◀ ▶). Dvakrát stejná noha neplatí. Čím rychleji střídáš, tím rychleji běžíš.</li>
    <li><b>100 m:</b> po povelu START mačkej, co to dá. Kdo začne mačkat před startem, má ulitý start.</li>
    <li><b>110 m překážek:</b> běž a před každou překážkou skoč (mezerník, ↑ nebo SKOK). Shozená překážka tě zpomalí.</li>
    <li><b>Skok daleký</b> a <b>oštěp:</b> rozběhni se, před čarou podrž SKOK/HOD, úhel roste, a pusť ho kolem 40–45°. Za čárou je přešlap. Tři pokusy, počítá se nejlepší.</li>
    <li><b>Víceboj</b> jsou všechny 4 disciplíny za sebou. <b>Denní víceboj</b> má pro všechny stejný vítr a soupeře. Na <b>Cestě</b> musíš v disciplíně získat zadaný počet bodů.</li>
    <li>P pozastaví hru.</li></ul>`,
    `<p>Four athletics events. Your result is converted to points by the decathlon tables and the points add up.</p>
    <ul><li><b>Running:</b> alternate left and right (← → or the ◀ ▶ buttons). The same foot twice does not count. The faster you alternate, the faster you run.</li>
    <li><b>100 m:</b> after GO tap as fast as you can. Tapping before the start is a false start.</li>
    <li><b>110 m hurdles:</b> run and jump before each hurdle (Space, ↑ or JUMP). A knocked hurdle slows you down.</li>
    <li><b>Long jump</b> and <b>javelin:</b> run up, hold JUMP/THROW before the line, the angle rises, and release it around 40–45°. Past the line is a foul. Three attempts, the best counts.</li>
    <li><b>Multi-event</b> is all 4 events in a row. The <b>daily multi-event</b> has the same wind and rivals for everyone. On the <b>Path</b> you must reach the target points in an event.</li>
    <li>P pauses the game.</li></ul>`),
  achievements: [
    { id: 'k3', name: Kit.L('Na stupních', 'On the podium'), desc: Kit.L('3000 bodů ve víceboji', '3000 points in the multi-event'), prog: s => [Math.min(3000, (s.data && s.data.best) || 0), 3000] },
  ],
});
