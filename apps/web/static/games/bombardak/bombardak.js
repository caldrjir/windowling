'use strict';
// ── BOMBARĎÁK · Windowling Hlavolamy ────────────────────────────────────────
// Vlastní hra na motivy Bombermana: v aréně plné beden pokládáš bomby, plameny boří bedny,
// pod nimi jsou vylepšení a východ. Výprava: zneškodni příšery a odejdi východem.
// Souboj: tři počítačoví bombarďáci, vyhrává poslední živý; po 90 s se aréna začne zavírat.
// Arkáda: osm arén za sebou na skóre. Cesta: 120 úrovní v šesti světech, každá desátá je souboj.
const Bombardak = (() => {
  const L = Kit.L, C = BbCore, A = BbArt, { W, H } = C;
  const DIFFS = [
    { id: 'vyprava', name: L('Výprava', 'Quest'), note: L('příšery a skrytý východ, 3 životy', 'monsters and a hidden exit, 3 lives'), par: 150 },
    { id: 'souboj', name: L('Souboj', 'Battle'), note: L('ty proti třem bombarďákům', 'you against three bombers') },
    { id: 'arkada', name: L('Arkáda', 'Arcade'), note: L('8 arén za sebou na skóre', '8 arenas in a row for score'), metric: 'score' },
  ];
  const ARCADE = 8;

  // Úroveň Cesty n (1–120): svět podle kapitoly, každá desátá je souboj
  function advSpec(n) {
    const lovec = n >= 41 ? 1 + Math.floor((n - 41) / 30) : 0;
    const duch = n >= 21 ? 1 + Math.floor((n - 21) / 25) : 0;
    const kapka = n >= 6 ? 1 + Math.floor((n - 6) / 15) : 0;
    const total = Math.min(10, 3 + Math.floor(n / 10));
    const balonek = Math.max(1, total - lovec - duch - kapka);
    return {
      type: 'adv', crates: 0.42 + Math.min(0.24, n * 0.003),
      enemies: { balonek, kapka, duch, lovec },
      extras: { bomb: 1 + (n > 30 ? 1 : 0), fire: 1 + (n > 50 ? 1 : 0), speed: n % 3 === 0 || n > 70 ? 1 : 0 },
      par: 60 + (balonek + kapka + duch + lovec) * 12,
    };
  }
  function battleSpec(bots, skill, hurryAt) {
    return { type: 'battle', bots, skill, hurryAt, crates: 0.62, extras: { bomb: 6, fire: 6, speed: 3 } };
  }
  function levelSpec(n) {
    const world = Math.min(5, Math.floor((n - 1) / 20));
    if (n % 10 === 0) {
      const bots = n < 40 ? 1 : n < 80 ? 2 : 3;
      return Object.assign(battleSpec(bots, Math.min(0.95, 0.45 + n / 220), 75), { world, n, text: L(`Úroveň ${n} · souboj`, `Level ${n} · battle`) });
    }
    return Object.assign(advSpec(n), { world, n, text: L(`Úroveň ${n}`, `Level ${n}`) });
  }

  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') return Object.assign({ seed, mode: 'level' }, levelSpec(ctx.key));
    const world = seed % 6;
    if (ctx.kind === 'daily') return Object.assign({ seed, mode: 'daily', world, text: L('Denní výprava', 'Daily quest') }, advSpec(45));
    if (diffId === 'souboj') return Object.assign({ seed, mode: 'free', world }, battleSpec(3, 0.75, 90));
    if (diffId === 'arkada') return Object.assign({ seed, mode: 'free', world, arcade: true }, advSpec(5));
    return Object.assign({ seed, mode: 'free', world }, advSpec(30));
  }

  // vlastní zvuk výbuchu (šum); respektuje ztlumení v puzzle kitu
  let ac = null, noise = null;
  const soundOn = () => { try { const m = JSON.parse(localStorage.getItem('gamecenter.puzzles') || '{}'); return m.sound !== false; } catch (e) { return true; } };
  function boomSound(big) {
    if (!soundOn()) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (!noise) { noise = ac.createBuffer(1, ac.sampleRate * 0.8, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2); }
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t0 = ac.currentTime;
      src.buffer = noise; f.type = 'lowpass'; f.frequency.setValueAtTime(big ? 1400 : 1000, t0); f.frequency.exponentialRampToValueAtTime(120, t0 + 0.6);
      g.gain.setValueAtTime(big ? 0.32 : 0.22, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
      src.connect(f); f.connect(g); g.connect(ac.destination); src.start(t0); src.stop(t0 + 0.75);
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.35);
      og.gain.setValueAtTime(0.25, t0); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      o.connect(og); og.connect(ac.destination); o.start(t0); o.stop(t0 + 0.45);
    } catch (e) { /* bez zvuku */ }
  }

  function create(el, P, saved, api) {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const battle = P.type === 'battle';
    const theme = A.THEMES[P.world % A.THEMES.length];
    el.innerHTML = `<div class="bb-wrap">
      <div class="bb-hud"><div class="bb-left"></div><div class="bb-mid"><small class="bb-mid-l"></small><b class="bb-mid-v"></b></div><div class="bb-right"></div></div>
      <div class="bb-stage"><canvas class="bb-cv"></canvas></div>
      <div class="bb-pads" ${coarse ? '' : 'hidden'}><div class="bb-pad" aria-label="${L('Pohyb', 'Move')}"><i data-d="u"></i><i data-d="l"></i><i data-d="r"></i><i data-d="d"></i><b></b></div><button class="bb-bomb" aria-label="${L('Bomba', 'Bomb')}"></button></div>
      <p class="bb-keys">${L('Šipky nebo WASD pohyb, mezerník nebo X bomba, P pauza', 'Arrows or WASD to move, Space or X for a bomb, P pauses')}</p></div>`;
    const cv = el.querySelector('.bb-cv'), ctx = cv.getContext('2d');
    const leftEl = el.querySelector('.bb-left'), midL = el.querySelector('.bb-mid-l'), midV = el.querySelector('.bb-mid-v'), rightEl = el.querySelector('.bb-right');

    // ── Stav hry ──
    let stage = 0, Lv = null, w = null, score = 0, lives = 3, deaths = 0, carry = { bombs: 1, fire: 2, speed: 0 };
    let phase = 'ready', phaseT = 1.6, over = false, paused = false, clock = 0, shake = 0, speed = 1, auto = false;
    let parts = [], pops = [], banner = null, levelT = 0, killed = 0, totalEnemies = 0;
    function build() {
      const seed = stage === 0 ? P.seed : (P.seed + stage * 7919) >>> 0;
      const spec = P.arcade ? advSpec(5 + stage * 12) : P;
      Lv = C.generate(seed, { mode: battle ? 'battle' : 'adv', players: battle ? P.bots + 1 : 1, crates: spec.crates, enemies: spec.enemies, extras: spec.extras });
      const players = battle ? [{ human: true }].concat(Array.from({ length: P.bots }, () => ({ skill: P.skill }))) : [Object.assign({ human: true }, carry)];
      w = C.createWorld(Lv, { players, hurryAt: P.hurryAt, seed });
      w.players[0].auto = auto;
      totalEnemies = Lv.enemies.length; killed = 0; levelT = 0;
      phase = 'ready'; phaseT = 1.6;
      banner = battle ? L('SOUBOJ!', 'BATTLE!') : P.arcade ? L(`ARÉNA ${stage + 1}`, `ARENA ${stage + 1}`) : L('VÝPRAVA', 'QUEST');
      sprites.board = null;
    }

    // ── Sprity (podle velikosti políčka) ──
    let T = 32, dpr = 1;
    const sprites = {}, icons = {};
    { const it = A.items(22, 2); for (const k of [1, 2, 3]) icons[k] = it[k].toDataURL(); }
    function fit() {
      const kv = document.getElementById('kView') || el, cs = getComputedStyle(kv), box = kv.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const maxH = Math.max(260, innerHeight - (coarse ? 330 : 210));
      T = Math.max(14, Math.min(54, Math.floor(Math.min((box - 4) / W, maxH / H))));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(W * T * dpr); cv.height = Math.round(H * T * dpr);
      cv.style.width = W * T + 'px'; cv.style.height = H * T + 'px';
      sprites.crate = A.crate(theme, T, dpr);
      sprites.bomb = A.bomb(T, dpr);
      sprites.flame = A.flames(T, dpr);
      sprites.items = A.items(T, dpr);
      sprites.enemy = A.enemySprites(T, dpr);
      sprites.board = null;
    }
    function pillarSprite() {
      const c = document.createElement('canvas'); c.width = Math.round(T * dpr); c.height = Math.round(T * dpr);
      const L1 = { W: 1, H: 1, g: [1] }, img = A.board(L1, theme, T, dpr);
      c.getContext('2d').drawImage(img, 0, 0);
      return c;
    }

    // ── Události světa → body, zvuky, efekty ──
    function handleEvents() {
      for (const e of w.events) {
        if (e.type === 'boom') { boomSound(e.range > 3); shake = Math.min(0.35, shake + 0.18); }
        else if (e.type === 'place') { if (e.p === 0) api.sound('place'); }
        else if (e.type === 'crate') {
          if (e.by === 0) score += 10;
          for (let k = 0; k < 7; k++) parts.push({ x: e.x + 0.5, y: e.y + 0.5, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 5 - 1, life: 0.6, col: theme.c[k % 3], s: 0.08 + Math.random() * 0.08 });
        } else if (e.type === 'item') { if (e.p === 0) { api.sound('line'); score += 50; const nm = { 1: L('+1 BOMBA', '+1 BOMB'), 2: L('+1 PLAMEN', '+1 FIRE'), 3: L('RYCHLOST', 'SPEED') }[e.item]; pops.push({ x: e.x + 0.5, y: e.y, t: 1, text: nm, col: A.ITEM_COL[e.item][0] }); } }
        else if (e.type === 'itemburn') { for (let k = 0; k < 5; k++) parts.push({ x: e.x + 0.5, y: e.y + 0.5, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 4, life: 0.4, col: '#fff3a0', s: 0.06 }); }
        else if (e.type === 'enemy') { killed++; score += e.pts; api.sound('star'); pops.push({ x: e.x + 0.5, y: e.y + 0.2, t: 1.1, text: e.pts, col: '#ffe066' }); api.changed && api.changed(); }
        else if (e.type === 'open') { api.sound('line'); banner = L('VÝCHOD OTEVŘEN', 'EXIT OPEN'); bannerT = 1.6; }
        else if (e.type === 'hurry') { banner = L('ARÉNA SE ZAVÍRÁ!', 'HURRY UP!'); bannerT = 2; api.sound('error'); }
        else if (e.type === 'wall') { shake = Math.min(0.2, shake + 0.04); }
        else if (e.type === 'die') {
          for (let k = 0; k < 12; k++) parts.push({ x: e.x + 0.5, y: e.y + 0.3, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 5, life: 0.8, col: A.PLAYER[e.i % 4].body, s: 0.07 });
          if (e.i === 0) playerDied();
        }
      }
      w.events.length = 0;
    }
    let bannerT = 0;
    function playerDied() {
      if (battle) { phase = 'lost'; phaseT = 1.6; return; }
      phase = 'dead'; phaseT = 1.5; deaths++; lives--;
      if (api.mistake) api.mistake();
    }

    function tick(dt) {
      clock += dt; shake = Math.max(0, shake - dt);
      if (bannerT > 0) bannerT -= dt;
      for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 14 * dt; p.life -= dt; }
      parts = parts.filter(p => p.life > 0);
      for (const p of pops) p.t -= dt;
      pops = pops.filter(p => p.t > 0);
      if (phase === 'ready') { phaseT -= dt; if (phaseT <= 0) { phase = 'play'; api.setTimer(true); bannerT = 0; } return; }
      if (phase === 'dead') {
        phaseT -= dt;
        if (phaseT <= 0) { if (lives <= 0) { end(false); return; } const s = stage; stage = s; build(); banner = L(`ŽIVOTY: ${lives}`, `LIVES: ${lives}`); }
        return;
      }
      if (phase === 'clear') { phaseT -= dt; if (phaseT <= 0) nextStage(); return; }
      if (phase === 'lost') { C.step(w, dt, {}); handleEvents(); phaseT -= dt; if (phaseT <= 0) end(false); return; }
      if (phase !== 'play') return;
      levelT += dt;
      C.step(w, dt, input());
      handleEvents();
      if (w.over) {
        if (battle) { if (w.over.winner === 0) end(true); else { phase = 'lost'; phaseT = 0.6; } return; }
        // východ: bonus za čas
        const bonus = Math.max(0, Math.round((P.par || 150) - levelT)) * 10;
        score += 1000 + bonus;
        pops.push({ x: w.exit.x + 0.5, y: w.exit.y, t: 1.4, text: '+' + (1000 + bonus), col: '#b9f5ff' });
        api.sound('win'); phase = 'clear'; phaseT = 1.5;
      }
    }
    function nextStage() {
      const p = w.players[0];
      if (P.arcade && stage + 1 < ARCADE) { carry = { bombs: p.bombs, fire: p.fire, speed: p.speed }; stage++; build(); api.changed && api.changed(); return; }
      end(true);
    }
    function end(won) {
      if (over) return; over = true; api.setTimer(false); phase = 'over';
      if (battle) {
        const p = w.players[0];
        const info = `<p class="k-muted">${L(`Vyřazení soupeři: ${p.kills} · čas ${Kit.fmtTime(w.t)}`, `Opponents knocked out: ${p.kills} · time ${Kit.fmtTime(w.t)}`)}</p>`;
        if (won) api.solved({ title: L('Vítězství!', 'Victory!'), stars: w.t < P.hurryAt ? 3 : 2, html: info });
        else api.failed({ title: w.over && w.over.winner === -1 ? L('Remíza', 'Draw') : L('Vyřazen!', 'Knocked out!'), html: info });
        return;
      }
      const info = `<p class="k-muted">${L(`Skóre ${Kit.fmtNum(score)} · ztracené životy ${deaths}`, `Score ${Kit.fmtNum(score)} · lives lost ${deaths}`)}${P.text ? ` · ${P.text}` : ''}</p>`;
      if (!won) { api.failed({ score: P.arcade ? score : undefined, html: info }); return; }
      const stars = deaths === 0 && levelT <= (P.par || 150) ? 3 : deaths <= 1 ? 2 : 1;
      api.solved({ title: P.arcade ? Kit.fmtNum(score) : L('Východ nalezen!', 'Exit found!'), stars, score: P.arcade ? score : undefined, html: info });
    }

    // ── Ovládání ──
    const held = [];
    let touchDir = null, bombReq = false;
    const KEYS = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', W: 'u', s: 'd', S: 'd', a: 'l', A: 'l', d: 'r', D: 'r' };
    function input() { const o = { dir: touchDir || held[held.length - 1] || null, bomb: bombReq }; bombReq = false; return o; }
    function dropBomb() { if (phase === 'play' && !paused) bombReq = true; else if (paused) setPause(false); }
    const keyUp = e => { const d = KEYS[e.key]; if (d) { const k = held.indexOf(d); if (k >= 0) held.splice(k, 1); } };
    const blur = () => { held.length = 0; touchDir = null; };
    addEventListener('keyup', keyUp); addEventListener('blur', blur);
    // tah po aréně = joystick, krátké ťuknutí = bomba
    let jp = null;
    const dirOf = (dx, dy, dead) => (Math.hypot(dx, dy) < dead ? null : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u');
    cv.addEventListener('pointerdown', e => { e.preventDefault(); if (paused) { setPause(false); return; } jp = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* nic */ } });
    cv.addEventListener('pointermove', e => {
      if (!jp || e.pointerId !== jp.id) return;
      const d = dirOf(e.clientX - jp.x, e.clientY - jp.y, 14);
      if (d) { jp.moved = true; touchDir = d; }
    });
    const jEnd = e => { if (!jp || e.pointerId !== jp.id) return; if (!jp.moved && performance.now() - jp.t < 300) dropBomb(); jp = null; touchDir = null; };
    cv.addEventListener('pointerup', jEnd); cv.addEventListener('pointercancel', jEnd);
    // tlačítka pro dotyk: kříž (držet) a bomba
    const pad = el.querySelector('.bb-pad');
    let padId = null;
    const padDir = e => { const r = pad.getBoundingClientRect(); return dirOf(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2, r.width * 0.12); };
    pad.addEventListener('pointerdown', e => { e.preventDefault(); padId = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch (er) { /* nic */ } touchDir = padDir(e); pad.dataset.on = touchDir || ''; });
    pad.addEventListener('pointermove', e => { if (e.pointerId !== padId) return; touchDir = padDir(e); pad.dataset.on = touchDir || ''; });
    const padEnd = e => { if (e.pointerId !== padId) return; padId = null; touchDir = null; pad.dataset.on = ''; };
    pad.addEventListener('pointerup', padEnd); pad.addEventListener('pointercancel', padEnd);
    el.querySelector('.bb-bomb').addEventListener('pointerdown', e => { e.preventDefault(); dropBomb(); });

    function setPause(on) { if (over) return; paused = on; api.setTimer(!on && phase === 'play'); if (!on) last = performance.now(); }

    // ── Kresba ──
    function hud() {
      const p = w.players[0];
      let left;
      if (battle) left = w.players.map((q, i) => `<span class="bb-face${q.alive ? '' : ' out'}" style="--c:${A.PLAYER[i].body}">${i ? L('CPU', 'CPU') : L('TY', 'YOU')}</span>`).join('');
      else left = `<span class="bb-hearts">${'<i></i>'.repeat(Math.max(0, lives))}</span>`;
      const stats = `<span class="bb-st"><img src="${icons[1]}" alt=""><b>${p.bombs}</b></span><span class="bb-st"><img src="${icons[2]}" alt=""><b>${p.fire}</b></span><span class="bb-st"><img src="${icons[3]}" alt=""><b>${p.speed + 1}</b></span>`;
      if (leftEl.dataset.v !== left) { leftEl.innerHTML = left; leftEl.dataset.v = left; }
      if (rightEl.dataset.v !== stats) { rightEl.innerHTML = stats; rightEl.dataset.v = stats; }
      if (battle) {
        const rest = Math.max(0, P.hurryAt - w.t);
        midL.textContent = rest > 0 ? L('DO ZAVÍRÁNÍ', 'HURRY IN') : L('ARÉNA SE ZAVÍRÁ', 'CLOSING');
        midV.textContent = rest > 0 ? Kit.fmtTime(rest) : '!!!';
      } else {
        midL.textContent = P.arcade ? L(`SKÓRE · ARÉNA ${stage + 1}/${ARCADE}`, `SCORE · ARENA ${stage + 1}/${ARCADE}`) : L(`PŘÍŠERY ${totalEnemies - w.enemies.filter(e => e.alive).length}/${totalEnemies}`, `MONSTERS ${totalEnemies - w.enemies.filter(e => e.alive).length}/${totalEnemies}`);
        midV.textContent = Kit.fmtNum(score);
      }
    }
    function draw() {
      const g = ctx, PW = W * T, PH = H * T;
      if (!sprites.board) { sprites.board = A.board(Lv, theme, T, dpr); sprites.pillar = pillarSprite(); }
      g.setTransform(1, 0, 0, 1, 0, 0);
      const sx = shake > 0 ? (Math.random() - 0.5) * shake * T * 0.5 : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake * T * 0.5 : 0;
      g.fillStyle = theme.bg; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(sprites.board, sx * dpr, sy * dpr);
      g.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
      // východ, vylepšení
      if (w.exit && w.exit.seen) A.exitTile(g, w.exit.x * T, w.exit.y * T, T, w.exit.open, clock);
      for (let i = 0; i < W * H; i++) {
        const it = w.items[i]; if (!it) continue;
        const x = (i % W) * T, y = Math.floor(i / W) * T + Math.sin(clock * 4 + i) * T * 0.04;
        g.drawImage(sprites.items[it], x, y, T, T);
      }
      // po řádcích: bedny, padlé zdi, bomby, postavy (spodní překrývají horní)
      const byRow = [];
      for (const a of w.players) if (a.alive || a.deadT < 0.9) (byRow[Math.min(H - 1, Math.floor(a.y + 0.5))] ||= []).push(a);
      for (const a of w.enemies) if (a.alive || a.deadT < 0.6) (byRow[Math.min(H - 1, Math.floor(a.y + 0.5))] ||= []).push(a);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x, c = w.g[i];
          if (c === 2) {
            const b = w.burning.find(q => q.i === i);
            if (b) {
              const k = 1 - b.t / C.BURN;
              g.globalAlpha = 1 - k; g.drawImage(sprites.crate, x * T + T * k * 0.1, y * T + T * k * 0.1, T * (1 - k * 0.2), T * (1 - k * 0.2));
              g.globalAlpha = 0.7 * (1 - k); g.fillStyle = '#ff7a2a'; g.fillRect(x * T + T * 0.1, y * T + T * 0.1, T * 0.8, T * 0.8); g.globalAlpha = 1;
            } else {
              g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x * T + T * 0.16, y * T + T * 0.9, T * 0.84, T * 0.12);
              g.drawImage(sprites.crate, x * T, y * T, T, T);
            }
          } else if (c === 1 && Lv.g[i] !== 1) g.drawImage(sprites.pillar, x * T, y * T, T, T);
        }
        for (const b of w.bombs) if (b.y === y) {
          const warn = b.t < 0.7, k = 1 + Math.sin(clock * (warn ? 30 : 10)) * 0.06 + (1 - b.t / C.FUSE) * 0.08;
          const s = T * k, bx = b.x * T + (T - s) / 2, by = b.y * T + (T - s) / 2;
          g.drawImage(sprites.bomb, bx, by, s, s);
          if (warn && Math.floor(clock * 14) % 2) { g.globalAlpha = 0.45; g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(b.x * T + T / 2, b.y * T + T * 0.56, T * 0.34 * k, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
          // jiskra na doutnáku
          const fx = bx + s * A.FUSE_TIP[0], fy = by + s * A.FUSE_TIP[1];
          g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(fx, fy, T * (0.06 + Math.random() * 0.04), 0, Math.PI * 2); g.fill();
          g.fillStyle = '#ff8a2a'; for (let q = 0; q < 3; q++) g.fillRect(fx + (Math.random() - 0.5) * T * 0.25, fy + (Math.random() - 0.5) * T * 0.25, 2, 2);
        }
        const row = byRow[y];
        if (row) for (const a of row.sort((p, q) => p.y - q.y)) drawActor(g, a);
      }
      // plameny
      g.globalCompositeOperation = 'lighter';
      const F = sprites.flame;
      for (let i = 0; i < W * H; i++) {
        const f = w.flames[i]; if (f <= 0) continue;
        const x = (i % W) * T, y = Math.floor(i / W) * T, k = f / C.FLAME, th = T * (0.55 + 0.35 * Math.sin(Math.PI * Math.min(1, (1 - k) * 1.6 + 0.15)));
        const sh = w.shape[i], fl = j => j >= 0 && j < W * H && w.flames[j] > 0;
        g.globalAlpha = Math.min(1, k * 2.2);
        if (sh & 1 || sh & 4) { const l = fl(i - 1) ? 0 : T * 0.2, r = fl(i + 1) ? 0 : T * 0.2; if (sh & 1 || fl(i - 1) || fl(i + 1)) g.drawImage(F.strip, x + l, y + (T - th) / 2, T - l - r, th); }
        if (sh & 2 || sh & 4) { const u = fl(i - W) ? 0 : T * 0.2, d = fl(i + W) ? 0 : T * 0.2; if (sh & 2 || fl(i - W) || fl(i + W)) g.drawImage(F.vstrip, x + (T - th) / 2, y + u, th, T - u - d); }
        if (sh & 4) { const s = T * (1.1 + 0.25 * (1 - k)); g.drawImage(F.center, x + (T - s) / 2, y + (T - s) / 2, s, s); }
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      // částice a body
      for (const p of parts) { g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.col; g.fillRect(p.x * T - p.s * T / 2, p.y * T - p.s * T / 2, p.s * T, p.s * T); }
      g.globalAlpha = 1;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const p of pops) {
        g.globalAlpha = Math.min(1, p.t * 2); g.font = `800 ${Math.max(10, T * 0.42)}px Unbounded, sans-serif`;
        g.lineWidth = 3; g.strokeStyle = 'rgba(10,10,20,.8)'; const yy = p.y * T - (1.2 - p.t) * T * 0.7;
        g.strokeText(p.text, p.x * T, yy); g.fillStyle = p.col; g.fillText(p.text, p.x * T, yy);
      }
      g.globalAlpha = 1;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const label = (s, y, size, col = '#fff') => { g.font = `800 ${size}px Unbounded, sans-serif`; g.lineWidth = Math.max(3, size * 0.22); g.lineJoin = 'round'; g.strokeStyle = 'rgba(10,10,25,.85)'; g.strokeText(s, PW / 2, y); g.fillStyle = col; g.fillText(s, PW / 2, y); };
      const big = Math.max(16, Math.min(34, T * 0.9));
      if (phase === 'ready' && banner) { label(banner, PH * 0.42, big, '#ffe066'); label(battle ? L('poslední živý vyhrává', 'last one standing wins') : L('zneškodni příšery a najdi východ', 'defeat the monsters, find the exit'), PH * 0.42 + big * 1.1, Math.max(10, big * 0.42), '#fff'); }
      else if (bannerT > 0 && banner) label(banner, PH * 0.42, big * 0.8, '#ffe066');
      if (phase === 'dead') label(L('AU!', 'OUCH!'), PH * 0.42, big, '#ff8a8a');
      if (phase === 'clear') label(L('HOTOVO!', 'CLEAR!'), PH * 0.42, big, '#b9f5ff');
      if (paused) { g.fillStyle = 'rgba(10,8,20,.55)'; g.fillRect(0, 0, PW, PH); label(L('PAUZA', 'PAUSED'), PH * 0.45, big); label(L('ťukni nebo stiskni P', 'tap or press P'), PH * 0.45 + big, Math.max(10, big * 0.4)); }
      hud();
    }
    function drawActor(g, a) {
      const x = a.x * T + T / 2, y = a.y * T + T / 2;
      if (a.kind === 'player') {
        if (!a.alive) {
          const k = a.deadT / 0.9;
          g.save(); g.globalAlpha = Math.max(0, 1 - k); g.translate(x, y); g.rotate(k * 6); g.scale(1 - k * 0.6, 1 - k * 0.6);
          A.bomber(g, 0, 0, T, a.i, 'd', false, clock); g.restore(); return;
        }
        if (a.inv > 0 && Math.floor(clock * 12) % 2) g.globalAlpha = 0.4;
        A.bomber(g, x, y - T * 0.06, T, a.i, a.dir, a.moving, clock + a.i);
        g.globalAlpha = 1;
        return;
      }
      const sp = sprites.enemy[a.type][Math.floor(clock * 5 + a.i) % 2];
      if (!a.alive) {
        const k = a.deadT / 0.6;
        g.globalAlpha = Math.max(0, 1 - k); g.drawImage(sp, x - T / 2 * (1 - k * 0.5), y - T / 2 * (1 - k * 0.5), T * (1 - k * 0.5), T * (1 - k * 0.5));
        g.globalAlpha = 0.6 * (1 - k); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, T * 0.4 * (1 + k), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        return;
      }
      const bob = Math.sin(clock * 6 + a.i) * T * 0.04;
      g.save(); g.translate(x, y + bob - T * 0.04);
      if (a.dir === 'l') g.scale(-1, 1);
      if (a.type === 'duch') g.globalAlpha = 0.85;
      g.drawImage(sp, -T / 2, -T / 2, T, T);
      g.restore();
    }

    // ── Smyčka ──
    let last = performance.now(), raf = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      if (api.paused && api.paused() && !paused && !over && phase === 'play') setPause(true);
      if (!paused && !over) for (let i = 0; i < speed; i++) tick(dt);
      draw();
    }

    fit(); build(); addEventListener('resize', fit);
    raf = requestAnimationFrame(frame);
    return {
      getState: () => null,
      progress: () => (over ? 1 : P.arcade ? (stage + killed / Math.max(1, totalEnemies) * 0.9) / ARCADE : battle ? (w.players.length - w.players.filter(p => p.alive).length) / w.players.length : (killed / Math.max(1, totalEnemies)) * 0.9),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('keyup', keyUp); removeEventListener('blur', blur); },
      pause() { if (phase === 'play') setPause(true); },
      onKey(e) {
        if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setPause(!paused); return; }
        if (e.key === ' ' || e.key === 'x' || e.key === 'X' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) dropBomb(); return; }
        const d = KEYS[e.key]; if (!d) return;
        e.preventDefault(); if (paused) { setPause(false); return; }
        const k = held.indexOf(d); if (k >= 0) held.splice(k, 1); held.push(d);
      },
      _state: () => ({ phase, stage, score, lives, deaths, killed, totalEnemies, t: w.t, over, players: w.players.map(p => ({ alive: p.alive, x: p.x, y: p.y, bombs: p.bombs, fire: p.fire })), bombs: w.bombs.length, exit: w.exit && { ...w.exit } }),
      _auto(on) { auto = on !== false; w.players[0].auto = auto; },
      _speed(n) { speed = Math.max(1, n | 0); },
      _input(dir, bomb) { if (dir !== undefined) touchDir = dir; if (bomb) bombReq = true; },
      _solve() { phase = 'play'; if (battle) { for (const p of w.players) if (p.i) p.alive = false; w.over = { winner: 0 }; end(true); } else { stage = P.arcade ? ARCADE - 1 : 0; end(true); } },
    };
  }

  // úvodní obrázek: kousek arény, bombarďák, bomba, plameny a příšera
  function art(el) {
    el.innerHTML = '<canvas width="720" height="720"></canvas>';
    const g = el.querySelector('canvas').getContext('2d');
    g.scale(2, 2);
    g.beginPath(); g.roundRect(0, 0, 360, 360, 24); g.clip();
    const T = 60, th = A.THEMES[0], Lv = { W: 6, H: 6, g: [] };
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) Lv.g.push(x === 0 || y === 0 || x === 5 || y === 5 || (x === 2 && y === 2) || (x === 4 && y === 2) || (x === 2 && y === 4) ? 1 : 0);
    g.drawImage(A.board(Lv, th, T, 2), 0, 0, 360, 360);
    const crate = A.crate(th, T, 2), bomb = A.bomb(T, 2), F = A.flames(T, 2), en = A.enemySprites(T, 2), it = A.items(T, 2);
    g.drawImage(crate, 4 * T, 1 * T, T, T); g.drawImage(crate, 3 * T, 4 * T, T, T);
    g.drawImage(it[2], 1 * T, 4 * T, T, T);
    g.drawImage(en.balonek[0], 4 * T, 3 * T, T, T);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(F.strip, 1.2 * T, 3 * T + T * 0.12, 2.6 * T, T * 0.76);
    g.drawImage(F.vstrip, 3 * T + T * 0.12, 1.2 * T, T * 0.76, 2.6 * T);
    g.drawImage(F.center, 2.85 * T, 2.85 * T, T * 1.3, T * 1.3);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(bomb, 1 * T - 4, 1 * T, T, T);
    A.bomber(g, 1.5 * T, 2.5 * T - 4, T, 0, 'd', false, 0);
  }
  return { DIFFS, generate, create, art, levelSpec, advSpec };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'bombardak', title: 'BOMBARĎÁK', wording: 'play',
  tagline: Kit.L('Na motivy Bombermana: pokládej bomby, boř bedny, sbírej vylepšení a vyřaď příšery i soupeře. Pozor na vlastní plameny!', 'In the spirit of Bomberman: drop bombs, blast crates, grab power-ups and take out monsters and rivals. Mind your own flames!'),
  diffs: Bombardak.DIFFS, generate: Bombardak.generate, create: Bombardak.create, art: Bombardak.art,
  online: { kind: 'race', diffs: ['vyprava'] },
  dailyDiff: () => 'vyprava',
  levelDiff: n => (n % 10 === 0 ? 'souboj' : 'vyprava'),
  rules: Kit.L(`<p>Pokládej bomby, plamen se rozšíří do kříže a rozbije první bednu v cestě. Plamen zasáhne i tebe, tak utíkej za roh!</p>
    <ul><li><b>Ovládání:</b> šipky nebo WASD, bomba mezerníkem nebo X, P pauza. Na telefonu táhni prstem po aréně (nebo drž kříž) a ťukni pro bombu.</li>
    <li><b>Výprava:</b> zneškodni všechny příšery, pak se otevře východ schovaný pod jednou z beden. Máš 3 životy, po ztrátě života začíná aréna znovu.</li>
    <li><b>Souboj:</b> ty a tři počítačoví bombarďáci, vyhrává poslední živý. Po 90 sekundách začnou padat zdi a aréna se zmenšuje.</li>
    <li><b>Vylepšení</b> pod bednami: modré +1 bomba, oranžové delší plamen, zelené rychlost. Plamen nesebraná vylepšení spálí.</li>
    <li>Příšery: balónek bloudí, kapka je rychlá, duch prochází bednami a lovec jde přímo po tobě.</li>
    <li>Bomba v dosahu jiné bouchne s ní. Cesta má 120 úrovní v šesti světech, každá desátá je souboj.</li></ul>`,
    `<p>Drop bombs; the blast spreads in a cross and breaks the first crate in its way. It hits you too, so run around a corner!</p>
    <ul><li><b>Controls:</b> arrows or WASD, Space or X for a bomb, P pauses. On a phone drag on the arena (or hold the pad) and tap for a bomb.</li>
    <li><b>Quest:</b> defeat every monster, then the exit hidden under one of the crates opens. You have 3 lives; losing one restarts the arena.</li>
    <li><b>Battle:</b> you and three computer bombers, the last one standing wins. After 90 seconds walls start to fall and the arena shrinks.</li>
    <li><b>Power-ups</b> under crates: blue +1 bomb, orange a longer blast, green speed. Flames burn power-ups left lying around.</li>
    <li>Monsters: the balloon wanders, the drop is fast, the ghost floats through crates and the hunter comes straight for you.</li>
    <li>A bomb caught in a blast goes off with it. The Path has 120 levels in six worlds; every tenth is a battle.</li></ul>`),
  achievements: [
    { id: 'bb10', name: Kit.L('Pyrotechnik', 'Pyrotechnician'), desc: Kit.L('Dokonči 10 arén', 'Finish 10 arenas'), prog: s => [Math.min(10, (s.stats && s.stats.solved) || 0), 10] },
  ],
});
