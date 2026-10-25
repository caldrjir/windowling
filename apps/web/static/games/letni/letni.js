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

  // ── Kresba ──
  const SKIN = '#ffd9b3', HAIR = '#3a2a1a';
  // panáček: (x, y) jsou chodidla, s = pixely na metr, pose a fáze kroku
  function athlete(g, x, y, s, o) {
    const ph = o.phase || 0, pose = o.pose || 'run', shirt = o.shirt || '#ff5a7a', shorts = o.shorts || '#1b2a6b', a = o.alpha ?? 1;
    g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const lean = pose === 'run' || pose === 'hurdle' ? 0.12 + Math.min(0.15, (o.speed || 0) * 0.012) : pose === 'throw' ? -0.18 : 0;
    const hip = [0, -0.95], neck = [Math.sin(lean) * 0.5, -0.95 - Math.cos(lean) * 0.5];
    const limb = (from, a1, l1, a2, l2, w, col) => { const k = [from[0] + Math.sin(a1) * l1, from[1] + Math.cos(a1) * l1], e = [k[0] + Math.sin(a2) * l2, k[1] + Math.cos(a2) * l2]; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(from[0], from[1]); g.lineTo(k[0], k[1]); g.lineTo(e[0], e[1]); g.stroke(); return e; };
    let legs, arms;
    if (pose === 'run') {
      const t1 = Math.sin(ph) * 0.9, t2 = -t1, k1 = Math.max(0, -Math.cos(ph)) * 1.6 + 0.2, k2 = Math.max(0, Math.cos(ph)) * 1.6 + 0.2;
      legs = [[t1, t1 - k1], [t2, t2 - k2]]; arms = [[-t1 * 0.9, -t1 * 0.9 + 1.6], [-t2 * 0.9, -t2 * 0.9 + 1.6]];
    } else if (pose === 'stand') { legs = [[0.12, 0.12], [-0.12, -0.12]]; arms = [[0.25, 0.1], [-0.25, -0.1]]; }
    else if (pose === 'set') { legs = [[0.9, -0.9], [-0.3, -1.6]]; arms = [[1.4, 1.4], [1.2, 1.2]]; }
    else if (pose === 'jump') { legs = [[1.4, -0.2], [1.1, -0.6]]; arms = [[2.6, 2.4], [2.2, 2.2]]; }
    else if (pose === 'hurdle') { legs = [[1.5, 1.5], [-1.2, -2.6]]; arms = [[1.8, 1.8], [-0.8, 0.6]]; }
    else if (pose === 'land') { legs = [[1.5, 0.1], [1.4, 0.2]]; arms = [[1.6, 1.4], [1.3, 1.2]]; }
    else if (pose === 'throw') { legs = [[0.5, 0.4], [-0.5, -0.4]]; arms = [[-2.2, -2.6], [1.0, 1.3]]; }
    else if (pose === 'release') { legs = [[0.6, 0.5], [-0.6, -0.3]]; arms = [[2.4, 2.8], [-0.6, -0.4]]; }
    else if (pose === 'fall') { legs = [[1.6, 1.6], [1.4, 1.4]]; arms = [[2.8, 2.8], [2.6, 2.6]]; }
    else { legs = [[0, 0], [0, 0]]; arms = [[0, 0], [0, 0]]; }
    // zadní noha a ruka tmavší
    limb(hip, legs[1][0], 0.48, legs[1][1], 0.5, 0.13, '#c79a7a');
    const sh = [neck[0] - 0.02, neck[1] + 0.12];
    limb(sh, arms[1][0], 0.32, arms[1][1], 0.3, 0.1, '#c79a7a');
    // trup: dres a trenky
    g.strokeStyle = shorts; g.lineWidth = 0.24; g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(hip[0] + Math.sin(lean) * 0.12, hip[1] - 0.12); g.stroke();
    g.strokeStyle = shirt; g.lineWidth = 0.26; g.beginPath(); g.moveTo(hip[0] + Math.sin(lean) * 0.1, hip[1] - 0.1); g.lineTo(neck[0], neck[1]); g.stroke();
    if (o.num) { g.fillStyle = '#fff'; g.save(); g.translate((hip[0] + neck[0]) / 2, (hip[1] + neck[1]) / 2 - 0.02); g.rotate(lean); g.fillRect(-0.07, -0.08, 0.14, 0.12); g.restore(); }
    const f1 = limb(hip, legs[0][0], 0.48, legs[0][1], 0.5, 0.14, SKIN);
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(f1[0] + 0.05, f1[1], 0.1, 0.05, 0, 0, 7); g.fill();
    // hlava s čelenkou
    const hx = neck[0] + Math.sin(lean) * 0.14, hy = neck[1] - 0.16;
    g.fillStyle = SKIN; g.beginPath(); g.arc(hx, hy, 0.15, 0, 7); g.fill();
    g.fillStyle = HAIR; g.beginPath(); g.arc(hx - 0.02, hy - 0.04, 0.15, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    g.strokeStyle = shirt; g.lineWidth = 0.05; g.beginPath(); g.moveTo(hx - 0.15, hy - 0.04); g.lineTo(hx + 0.15, hy - 0.06); g.stroke();
    g.fillStyle = '#1a1020'; g.beginPath(); g.arc(hx + 0.08, hy, 0.022, 0, 7); g.fill();
    limb(sh, arms[0][0], 0.32, arms[0][1], 0.3, 0.11, SKIN);
    g.restore();
    return { hand: [x + (sh[0] + Math.sin(arms[0][0]) * 0.32 + Math.sin(arms[0][1]) * 0.3) * s, y + (sh[1] + Math.cos(arms[0][0]) * 0.32 + Math.cos(arms[0][1]) * 0.3) * s] };
  }

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
      st.next = 1.8;
    }
    function finishEvent(val) {
      const pts = val == null ? 0 : POINTS[ev](val);
      results[evI] = { ev, val, pts }; syncHUD(); api.changed();
      st.phase = 'done'; st.next = 2.6;
      say(val == null ? L('Bez platného pokusu · 0 bodů', 'No valid mark · 0 points') : `${fmtVal(ev, val)} · ${pts} ${L('bodů', 'points')}`, 2.6);
      api.sound(pts >= 800 ? 'star' : 'line');
    }
    const fmtVal = (e, v) => (EV[e].unit === 's' ? `${v.toFixed(2)} s` : `${v.toFixed(2)} m`);
    function endGame() {
      over = true; api.setTimer(false);
      const sum = total();
      const rows = results.map(r => `<tr><td>${EV[r.ev].long}</td><td>${r.val == null ? '–' : fmtVal(r.ev, r.val)}</td><td><b>${r.pts}</b></td></tr>`).join('');
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
        st.pose = ev === 'javelin' ? 'throw' : 'set';
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
    const crowd = (() => { const r = rngOf(P.seed ^ 0xc40d), out = []; for (let i = 0; i < 260; i++) out.push([r() * 1400, r(), ['#ff5a7a', '#55f6ff', '#ffd34d', '#6dff9e', '#c77dff', '#ffffff', '#ff9a3d'][Math.floor(r() * 7)]]); return out; })();
    function draw() {
      const g = ctx, k = cssW / VW;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      const focus = st.jav && st.phase === 'throw' ? st.jav.x : st.x, camX = focus * PPM - VW * (st.jav && st.phase === 'throw' ? 0.55 : 0.32);
      const trackY = 300;
      // obloha
      const sky = g.createLinearGradient(0, 0, 0, 200); sky.addColorStop(0, '#3a8ee0'); sky.addColorStop(1, '#b8e2ff');
      g.fillStyle = sky; g.fillRect(0, 0, VW, VH);
      g.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 5; i++) { const cx = ((i * 260 - camX * 0.05 + clock * 6) % 1300 + 1300) % 1300 - 100, cy = 24 + (i % 3) * 14; g.beginPath(); for (const [dx, dy, rr] of [[0, 0, 16], [18, -6, 13], [34, 2, 12], [-16, 4, 11]]) { g.moveTo(cx + dx + rr, cy + dy); g.arc(cx + dx, cy + dy, rr, 0, 7); } g.fill(); }
      // tribuna s divákyí
      const off = -camX * 0.35;
      g.fillStyle = '#3a4060'; g.fillRect(0, 70, VW, 120);
      for (let row = 0; row < 6; row++) { g.fillStyle = row % 2 ? '#4a5078' : '#454b70'; g.fillRect(0, 80 + row * 17, VW, 15); }
      for (const [x, yy, col] of crowd) {
        const px = ((x + off) % 1400 + 1400) % 1400 - 30, row = Math.floor(yy * 6), py = 92 + row * 17 + Math.sin(clock * 6 + x) * (st.phase === 'finish' || st.phase === 'landed' ? 2 : 0.6);
        if (px < -10 || px > VW + 10) continue;
        g.fillStyle = col; g.fillRect(px - 3, py - 4, 6, 7); g.fillStyle = '#ffd9b3'; g.beginPath(); g.arc(px, py - 7, 2.6, 0, 7); g.fill();
      }
      g.fillStyle = '#20253a'; g.fillRect(0, 186, VW, 16);
      // reklamní mantinel
      g.fillStyle = '#1b6bd6'; g.fillRect(0, 202, VW, 14);
      g.fillStyle = '#fff'; g.font = '700 10px Space Grotesk, sans-serif'; g.textBaseline = 'middle';
      for (let i = -1; i < 6; i++) { const px = ((i * 160 - camX * 0.9) % 160 + 160) % 160 + i * 160 - 160; g.fillText('WINDOWLING · LETNÍ HRY', px + 10, 209); }
      // tráva a dráhy
      g.fillStyle = '#4fae4a'; g.fillRect(0, 216, VW, 20);
      const tg = g.createLinearGradient(0, 236, 0, VH); tg.addColorStop(0, '#d0563a'); tg.addColorStop(1, '#b8462e');
      g.fillStyle = tg; g.fillRect(0, 236, VW, VH - 236);
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
      for (const ly of [236, 256, 276, 296, 324]) { g.beginPath(); g.moveTo(0, ly); g.lineTo(VW, ly); g.stroke(); }
      const X = m => m * PPM - camX;
      // značky po 10 m
      g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '700 11px Space Grotesk, sans-serif'; g.textAlign = 'center';
      for (let m = 0; m <= 130; m += 10) { const px = X(m); if (px < -20 || px > VW + 20) continue; g.fillRect(px - 1, 324, 2, 10); g.fillText(`${m}`, px, 346); }
      // disciplína
      if (ev === 'sprint' || ev === 'hurdles') {
        const fin = X(ev === 'sprint' ? 100 : 110);
        g.fillStyle = '#fff'; g.fillRect(fin - 2, 236, 4, 88);
        for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#111' : '#fff'; g.fillRect(fin + 2, 236 + i * 14.6, 6, 14.6); }
        g.fillStyle = '#fff'; g.fillRect(X(0) - 2, 236, 3, 88);
      }
      if (ev === 'longjump') {
        g.fillStyle = '#fff'; g.fillRect(X(39.8), 300, X(40) - X(39.8), 18);
        g.fillStyle = '#e8d28a'; g.fillRect(X(40.5), 296, X(50) - X(40.5), 28);
        g.fillStyle = 'rgba(160,120,60,.35)'; for (let i = 0; i < 40; i++) g.fillRect(X(40.5 + (i * 0.37) % 9.5), 300 + (i * 7) % 22, 3, 2);
        for (const m of [6, 7, 8, 9]) { const px = X(40 + m); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(px - 1, 288, 2, 8); g.fillText(`${m} m`, px, 282); }
        for (const mk of st.marks) if (mk != null) { const px = X(40 + mk); g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(px, 292); g.lineTo(px - 5, 284); g.lineTo(px + 5, 284); g.fill(); }
        if (st.landing) { g.fillStyle = 'rgba(120,80,40,.5)'; g.beginPath(); g.ellipse(X(st.landing - 0.1), 312, 14, 5, 0, 0, 7); g.fill(); }
      }
      if (ev === 'javelin') {
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(X(30), 312, 8, 26, 0, -Math.PI / 2, Math.PI / 2); g.lineTo(X(30), 286); g.fill();
        g.fillStyle = '#4fae4a'; g.fillRect(X(30.5), 236, X(140) - X(30.5), 88);
        for (let m = 40; m <= 100; m += 10) { const px = X(30 + m); g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(px, 236); g.lineTo(px - 12, 324); g.stroke(); g.fillStyle = '#fff'; g.fillText(`${m} m`, px - 6, 248); }
        for (const mk of st.marks) if (mk != null) { const px = X(30 + mk); g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(px, 306); g.lineTo(px - 5, 296); g.lineTo(px + 5, 296); g.fill(); }
      }
      if (ev === 'hurdles') st.hurdles.forEach((hx, k) => {
        const px = X(hx), down = st.hurdlesDown[k] === 1;
        for (const [ly, sc] of [[254, 0.6], [274, 0.65], [294, 0.7]]) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, ly); g.lineTo(px, ly - 30 * sc); g.lineTo(px + 6, ly - 30 * sc); g.stroke(); }
        g.save(); g.translate(px, trackY + 6); if (down) g.rotate(1.3);
        g.strokeStyle = '#ddd'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -34); g.stroke();
        g.fillStyle = '#fff'; g.fillRect(-2, -36, 14, 8); g.fillStyle = '#111'; g.fillRect(3, -36, 4, 8);
        g.restore();
      });
      // soupeři vzadu
      st.rivals.forEach((rv, k) => {
        const rx = st.phase === 'ready' ? 0 : rv.pos(st.t), ly = 254 + k * 20;
        const pose = st.phase === 'ready' ? (ev === 'sprint' || ev === 'hurdles' ? 'set' : 'stand') : rx >= (ev === 'sprint' ? 100 : 110) ? 'stand' : 'run';
        athlete(g, X(rx), ly, PPM * 0.62, { pose, phase: rx * 1.9 + k, shirt: rv.shirt, shorts: '#2a2a2a', alpha: 0.9, speed: 9 });
      });
      // hlavní závodník
      const ax = X(st.x), ay = trackY + 14 - st.y * PPM;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(ax, trackY + 16, 16, 4, 0, 0, 7); g.fill();
      const { hand } = athlete(g, ax, ay, PPM, { pose: st.hitT > 0 ? 'fall' : st.pose, phase: st.step, speed: st.v, shirt: '#ff5a7a', num: true });
      // oštěp
      if (ev === 'javelin') {
        const j = st.jav;
        const draw = (x, y, ang) => { g.save(); g.translate(x, y); g.rotate(-ang); g.strokeStyle = '#e8e8f0'; g.lineWidth = 3; g.beginPath(); g.moveTo(-40, 0); g.lineTo(40, 0); g.stroke(); g.fillStyle = '#ff5a5a'; g.fillRect(-4, -2, 8, 4); g.fillStyle = '#c8c8d0'; g.beginPath(); g.moveTo(40, -2); g.lineTo(48, 0); g.lineTo(40, 2); g.fill(); g.restore(); };
        if (j) draw(X(j.x), trackY + 14 - j.y * PPM, j.flying ? j.ang : Math.max(-0.7, j.ang));
        else draw(hand[0], hand[1] - 6, st.hold ? st.angle * Math.PI / 180 : 0.15);
      }
      // ukazatel úhlu při držení
      if (st.hold) {
        const cx = ax + 40, cy = ay - 70, R = 34, a = st.angle * Math.PI / 180;
        g.fillStyle = 'rgba(10,10,30,.55)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R + 6, -Math.PI / 2 - 0.1, 0.1); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(109,255,158,.6)'; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, R - 4, -(48 * Math.PI / 180), -(38 * Math.PI / 180)); g.stroke();
        g.strokeStyle = '#ffe066'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy - Math.sin(a) * R); g.stroke();
        g.fillStyle = '#fff'; g.font = '800 12px Space Grotesk, sans-serif'; g.textAlign = 'left'; g.fillText(`${Math.round(st.angle)}°`, cx + 6, cy + 10);
      }
      // HUD v plátně: čas / vzdálenost, rychlost, vítr, soupeři
      g.textAlign = 'left'; g.fillStyle = 'rgba(10,10,30,.82)'; g.beginPath(); g.roundRect(10, 10, 220, 52, 10); g.fill();
      g.fillStyle = '#fff'; g.font = '800 20px Unbounded, sans-serif';
      const sprintLike = ev === 'sprint' || ev === 'hurdles';
      g.fillText(sprintLike ? `${(st.phase === 'finish' || st.phase === 'done' ? st.fin || 0 : st.t).toFixed(2)} s` : `${L('pokus', 'att.')} ${st.attempt}/3`, 20, 32);
      g.font = '700 11px Space Grotesk, sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)';
      g.fillText(sprintLike ? `${Math.max(0, Math.min(ev === 'sprint' ? 100 : 110, st.x)).toFixed(0)} m` : `${L('nejlepší', 'best')} ${st.best != null ? st.best.toFixed(2) + ' m' : '–'}`, 20, 50);
      // rychloměr
      g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(120, 42, 100, 10);
      const sp = Math.min(1, st.v / 11), sg = g.createLinearGradient(120, 0, 220, 0); sg.addColorStop(0, '#6dff9e'); sg.addColorStop(0.7, '#ffe066'); sg.addColorStop(1, '#ff5a5a');
      g.fillStyle = sg; g.fillRect(120, 42, 100 * sp, 10);
      g.fillStyle = '#fff'; g.fillText(`${(st.v * 3.6).toFixed(0)} km/h`, 120, 32);
      if (!sprintLike || ev === 'sprint') { g.textAlign = 'right'; g.fillStyle = 'rgba(10,10,30,.82)'; g.beginPath(); g.roundRect(VW - 120, 10, 110, 30, 10); g.fill(); g.fillStyle = '#fff'; g.fillText(`${L('vítr', 'wind')} ${st.wind >= 0 ? '+' : ''}${st.wind.toFixed(1)} m/s`, VW - 20, 29); }
      if (st.phase === 'ready' && sprintLike) {
        const n = Math.ceil(st.countdown / 0.8); g.textAlign = 'center'; g.font = '900 54px Unbounded, sans-serif'; g.fillStyle = 'rgba(255,255,255,.9)'; g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 6;
        const txt = n >= 3 ? '3' : n === 2 ? '2' : '1'; g.strokeText(txt, VW / 2, 150); g.fillText(txt, VW / 2, 150);
      }
    }

    // ── Smyčka a ovládání ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
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

  // úvodní obrázek: sprinter na dráze před tribunou
  function art(el) {
    el.innerHTML = '<canvas width="520" height="360" style="object-fit:contain"></canvas>';
    const g = el.querySelector('canvas').getContext('2d');
    g.beginPath(); g.roundRect(0, 0, 520, 360, 28); g.clip();
    const sky = g.createLinearGradient(0, 0, 0, 160); sky.addColorStop(0, '#3a8ee0'); sky.addColorStop(1, '#b8e2ff'); g.fillStyle = sky; g.fillRect(0, 0, 520, 360);
    g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(430, 50, 26, 0, 7); g.fill();
    g.fillStyle = '#3a4060'; g.fillRect(0, 80, 520, 110);
    const r = rngOf(7);
    for (let i = 0; i < 220; i++) { const x = r() * 520, row = Math.floor(r() * 6), y = 96 + row * 16; g.fillStyle = ['#ff5a7a', '#55f6ff', '#ffd34d', '#6dff9e', '#fff'][i % 5]; g.fillRect(x - 3, y - 4, 6, 7); g.fillStyle = '#ffd9b3'; g.beginPath(); g.arc(x, y - 7, 2.6, 0, 7); g.fill(); }
    g.fillStyle = '#1b6bd6'; g.fillRect(0, 190, 520, 14);
    g.fillStyle = '#4fae4a'; g.fillRect(0, 204, 520, 16);
    g.fillStyle = '#c94e34'; g.fillRect(0, 220, 520, 140);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; for (const y of [220, 262, 304, 346]) { g.beginPath(); g.moveTo(0, y); g.lineTo(520, y); g.stroke(); }
    g.fillStyle = '#fff'; g.fillRect(440, 220, 6, 140); for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#111' : '#fff'; g.fillRect(446, 220 + i * 14, 8, 14); }
    athlete(g, 150, 296, 46, { pose: 'run', phase: 1.2, speed: 8, shirt: '#55f6ff', alpha: 0.85 });
    athlete(g, 300, 340, 62, { pose: 'run', phase: 2.6, speed: 10, shirt: '#ff5a7a', num: true });
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 4; g.lineCap = 'round'; for (const [y, l] of [[250, 60], [270, 40], [290, 52]]) { g.beginPath(); g.moveTo(240 - l, y); g.lineTo(240, y); g.stroke(); }
  }
  return { DIFFS, EVENTS, POINTS, generate, create, art, levelSpec, athlete };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'letni', title: 'LETNÍ HRY',
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
