'use strict';
// ── KLÁVESY · Windowling Hlavolamy ──────────────────────────────────────────
// Na motivy Piano Tiles: čtyři sloupce, shora jedou černé dlaždice, ťukej jen na ně. Každé
// ťuknutí zahraje další notu skladby, takže hráč skladbu opravdu hraje. Dlouhé dlaždice se
// drží. Ťuknutí vedle nebo propásnutá dlaždice hru končí. Po každém zahrání skladby (★) se
// tempo zrychlí. Skladba a styl (Klavír, Pop, House, EDM, Rock) se vybírají na startu.
const Klavesy = (() => {
  const L = Kit.L, W = 360, H = 640, LANES = 4, LW = W / LANES, RH = 160, Y0 = H - RH * 0.25;
  const { SONGS, STYLES } = KlSongs;
  const DIFFS = [
    { id: 'lehka', name: L('Lehká', 'Easy'), note: L('pomalejší tempo', 'slower tempo'), metric: 'score', speed: 0.8, ramp: 1.08 },
    { id: 'skladba', name: L('Skladba', 'Song'), note: L('každé kolo rychlejší', 'faster every round'), metric: 'score', speed: 1, ramp: 1.12 },
    { id: 'rychla', name: L('Rychlá', 'Fast'), note: L('pro zkušené prsty', 'for nimble fingers'), metric: 'score', speed: 1.25, ramp: 1.14 },
    { id: 'zen', name: L('Zen', 'Zen'), note: L('co nejvíc dlaždic za 30 s', 'most tiles in 30 s'), metric: 'score', zen: 30 },
  ];
  const LEVEL_ORDER = ['twinkle', 'prach', 'narozeniny', 'park', 'largo', 'stastny', 'ukolebavka', 'rolnicky', 'mesic', 'vanoce', 'auld', 'vlna', 'oda', 'susanna', 'neon', 'saints', 'greensleeves', 'pulz', 'vltava', 'kanon', 'dalnice', 'menuet', 'nachtmusik', 'boure', 'korobejniki', 'eliska', 'turbo', 'kralhor', 'entertainer', 'turecky'];
  const THEMES = {
    piano: { bg: ['#fbf8f2', '#ece5d6'], line: 'rgba(60,45,30,.12)', tile: ['#26262c', '#0d0d10'], hi: 'rgba(255,255,255,.14)', done: 'rgba(20,20,25,.10)', hold: '#3fa7ff', text: '#1d1a17', sub: '#7a6e60', glow: null },
    pop: { bg: ['#ffe1ee', '#d8e6ff'], line: 'rgba(90,60,140,.14)', tile: ['#7b4fd6', '#3b2483'], hi: 'rgba(255,255,255,.22)', done: 'rgba(90,60,160,.13)', hold: '#ff5fa2', text: '#2e1c55', sub: '#6d5a99', glow: null },
    house: { bg: ['#1b2140', '#0b0e1d'], line: 'rgba(255,190,90,.12)', tile: ['#ffbf4d', '#ff6a3d'], hi: 'rgba(255,255,255,.3)', done: 'rgba(255,170,70,.12)', hold: '#4de1ff', text: '#fff3dc', sub: '#d8b98a', glow: '#ff9a3d' },
    edm: { bg: ['#1a0638', '#050011'], line: 'rgba(120,220,255,.13)', tile: ['#27e3ff', '#7d4dff'], hi: 'rgba(255,255,255,.35)', done: 'rgba(80,200,255,.12)', hold: '#ff3fd2', text: '#eafcff', sub: '#9fb5ff', glow: '#28d8ff' },
    rock: { bg: ['#24130f', '#0c0706'], line: 'rgba(255,120,80,.12)', tile: ['#ef4a35', '#7d150e'], hi: 'rgba(255,230,200,.25)', done: 'rgba(240,80,50,.13)', hold: '#ffd23f', text: '#fff0e6', sub: '#cf9d88', glow: '#ff5533' },
  };
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const songById = id => SONGS.find(s => s.id === id) || SONGS[0];
  const nm = o => (Kit.LANG === 'en' ? o[1] : o[0]);
  const levelMode = n => (n <= 40 ? 'lehka' : n <= 90 ? 'skladba' : 'rychla');

  function generate(seed, diffId, ctx = {}) {
    if (ctx.kind === 'level') {
      const n = ctx.key, song = LEVEL_ORDER[(n - 1) % LEVEL_ORDER.length], cycle = Math.floor((n - 1) / LEVEL_ORDER.length);
      return { seed, mode: levelMode(n), song, level: n, laps: n <= 60 ? 1 : 2, boost: 1 + cycle * 0.05, text: L(`Úroveň ${n}`, `Level ${n}`) };
    }
    if (ctx.kind === 'daily') return { seed, mode: 'skladba', song: SONGS[hashStr('d' + seed) % SONGS.length].id, text: L('Denní skladba', 'Daily song') };
    return { seed, mode: DIFFS.some(d => d.id === diffId) ? diffId : 'skladba' };
  }

  function create(el, P, saved, api) {
    const D = DIFFS.find(d => d.id === P.mode) || DIFFS[1];
    const data = api.data;
    const free = !P.song;
    let song = songById(P.song || data.song || 'neon');
    let style = data.style && data.style[song.id] ? data.style[song.id] : song.style;
    el.innerHTML = `<div class="kl-wrap"><div class="kl-stage"><canvas class="kl-cv"></canvas>
      <div class="kl-top"><button class="kl-song" type="button"></button><p class="kl-info"></p><div class="kl-styles">${STYLES.map(s => `<button type="button" data-s="${s.id}">${nm(s.name)}</button>`).join('')}</div></div>
      <div class="kl-pick" hidden><div class="kl-pick-h"><b>${L('Vyber skladbu', 'Pick a song')}</b><button type="button" class="kl-x" aria-label="${L('Zavřít', 'Close')}">✕</button></div><div class="kl-list"></div></div>
      </div><p class="kl-keys">${L('Ťukej na dlaždice, nebo klávesy D F J K. P pauza', 'Tap the tiles, or keys D F J K. P pauses')}</p></div>`;
    const stage = el.querySelector('.kl-stage'), cv = el.querySelector('.kl-cv'), ctx = cv.getContext('2d', { alpha: false });
    const top = el.querySelector('.kl-top'), songBtn = el.querySelector('.kl-song'), pick = el.querySelector('.kl-pick'), list = el.querySelector('.kl-list');
    let cssW = 360, cssH = 640, dpr = 1;
    // rozlišení plátna: když telefon nestíhá, sníží se o stupeň (pixely jsou to nejdražší)
    const QUALITY = [1.5, 1.2, 1];
    let quality = 0, slow = 0, slowN = 0;
    function watchFps(dt) {
      if (quality >= QUALITY.length - 1 || phase !== 'play' || dt <= 0) return;
      slow += dt; slowN++;
      if (slowN >= 90) { if (slow / slowN > 0.024) { quality++; fit(); } slow = 0; slowN = 0; }
    }
    function fit() {
      const kv = document.getElementById('kView') || el, pad = getComputedStyle(kv), box = kv.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      cssH = Math.max(400, Math.min(innerHeight - (innerWidth < 760 ? 110 : 150), 860));
      cssW = Math.min(box - 2, cssH * W / H); cssH = cssW * H / W;
      dpr = Math.min(QUALITY[quality], devicePixelRatio || 1);
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
      stage.style.width = cssW + 'px'; stage.style.height = cssH + 'px';
      stage.style.setProperty('--k', cssW / W);
      sprites.clear();
    }
    // ── Předkreslené obrázky: pozadí, záře a dlaždice se kreslí jednou, ve hře se jen kopírují ──
    const sprites = new Map();
    function sprite(key, w, h, paint) {
      let c = sprites.get(key);
      if (c) return c;
      const sc = dpr * (cssW / W);
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w * sc)); c.height = Math.max(1, Math.ceil(h * sc));
      const g = c.getContext('2d'); g.scale(sc, sc); paint(g);
      if (sprites.size > 80) sprites.clear();
      sprites.set(key, c);
      return c;
    }
    const bgSprite = () => sprite('bg|' + style, W, H, g => {
      const T = THEMES[style], bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, T.bg[0]); bg.addColorStop(1, T.bg[1]); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.fillStyle = T.line;
      for (let i = 1; i < LANES; i++) g.fillRect(i * LW, 0, 1, H);
    });
    const glowSprite = () => sprite('glow|' + style, W, H, g => {
      const T = THEMES[style], gl = g.createRadialGradient(W / 2, H, 20, W / 2, H, H * 0.9);
      gl.addColorStop(0, T.glow); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
    });
    const PAD = 10;
    // čekající dlaždice dané výšky (se září, odleskem a značkou držení)
    const tileSprite = (hh, hold, red) => sprite(`t|${style}|${Math.round(hh)}|${hold ? 1 : 0}|${red ? 1 : 0}`, LW - 3 + PAD * 2, hh + PAD * 2, g => {
      const T = THEMES[style], w = LW - 3, gr = g.createLinearGradient(0, PAD, 0, PAD + hh);
      gr.addColorStop(0, red ? '#ff4a4a' : T.tile[0]); gr.addColorStop(1, red ? '#b31515' : T.tile[1]);
      if (T.glow) { g.shadowColor = T.glow; g.shadowBlur = 9; }
      g.fillStyle = gr; rr(g, PAD, PAD, w, hh, 7); g.fill(); g.shadowBlur = 0;
      g.fillStyle = T.hi; rr(g, PAD + 4, PAD + 4, w - 8, Math.min(14, hh * 0.18), 5); g.fill();
      if (hold) holdMarks(g, PAD, PAD, w, hh, T, 0);
    });
    KlAudio.load('assets/piano/');
    const loadStart = performance.now();

    // ── Stav ──
    let parsed, arr, lhOf, lapRows, rps0, ramp, tiles, next, phase, score, laps, pos, playT, over, paused, fx, pops, failInfo, flash, zenLeft, zenPos, autoOn = false, speed = 1, lapFlash = 0;
    let schedLap = 0, schedIdx = 0, aAnchor = 0, pAnchor = 0;
    const lapsCum = [0];
    function lapRps(k) { return rps0 * Math.pow(ramp, Math.min(k, 30)); }
    function lapTime(k) { while (lapsCum.length <= k) { const i = lapsCum.length - 1; lapsCum.push(lapsCum[i] + lapRows / lapRps(i)); } return lapsCum[k]; }
    function rowTime(r) { const k = Math.max(0, Math.floor(r / lapRows)); return lapTime(k) + (r - k * lapRows) / lapRps(k); }
    function rowAt(t) { let k = 0; while (lapTime(k + 1) <= t) k++; return k * lapRows + (t - lapTime(k)) * lapRps(k); }

    function setup() {
      parsed = KlSongs.parse(song);
      arr = KlAudio.arrange(song, parsed, style);
      const lh = style === 'piano' || D.zen ? (style === 'piano' ? arr : KlAudio.arrange(song, parsed, 'piano')).ev : [];
      lhOf = parsed.notes.map(n => lh.filter(e => e.r >= n.r0 - 1e-6 && e.r < n.r0 + n.len - 1e-6));
      lapRows = parsed.total;
      rps0 = song.rps * (D.speed || 1) * (P.boost || 1);
      ramp = D.ramp || 1;
      lapsCum.length = 1;
      tiles = []; next = 0; phase = 'ready'; score = 0; laps = 0; pos = 0; playT = 0; over = false; paused = false;
      fx = []; pops = []; failInfo = null; flash = 0; zenLeft = D.zen || 0; zenPos = 0; schedLap = 0; schedIdx = 0;
      addLap(0);
      KlAudio.setStyle(style);
      ui();
    }
    // dlaždice jedné smyčky; sloupce kopírují melodii (výš = doprava)
    function addLap(k) {
      const r = rngOf((P.seed ^ hashStr(song.id) ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0);
      let prev = tiles.length ? tiles[tiles.length - 1] : null;
      parsed.notes.forEach((n, i) => {
        let lane;
        if (!prev) lane = Math.floor(r() * LANES);
        else {
          const up = n.midi > prev.midi, down = n.midi < prev.midi;
          let opts = [0, 1, 2, 3].filter(l => l !== prev.lane && (up ? l > prev.lane : down ? l < prev.lane : true));
          if (!opts.length || r() < 0.18) opts = [0, 1, 2, 3].filter(l => l !== prev.lane);
          lane = opts[Math.floor(r() * opts.length)];
        }
        const t = { r0: k * lapRows + n.r0, len: n.len, dur: n.dur, midi: n.midi, lane, i, lap: k, st: 0, held: 0, hand: null, pid: null, fade: 0 };
        tiles.push(t); prev = t;
      });
    }
    const zenRow = t => tiles.indexOf(t);
    // spodní hrana dlaždice na plátně
    const yBottom = t => (D.zen ? Y0 + (zenPos - zenRow(t)) * RH : Y0 + (pos - t.r0) * RH);
    const tileH = t => (D.zen ? RH : Math.max(0.5, t.len) * RH);
    // držet se musí noty od půlové délky (dvě doby) výš
    const isHold = t => !D.zen && t.len >= Math.max(2, 2 * song.beat) - 1e-6;

    // ── Hraní ──
    function canStart() { return KlAudio.ready() || performance.now() - loadStart > 9000 || KlAudio.loaded >= KlAudio.total; }
    function start() {
      phase = 'play'; api.setTimer(true);
      top.classList.add('kl-hide'); pick.hidden = true;
      anchor();
    }
    function anchor() { aAnchor = KlAudio.now() + 0.02; pAnchor = playT; }
    function velOf(t) {
      const bp = (((t.r0 % lapRows) - song.pickup) % song.bar + song.bar) % song.bar;
      return Math.min(0.95, 0.56 + (bp < 1e-6 ? 0.2 : bp % song.beat < 1e-6 ? 0.08 : 0) + (isHold(t) ? 0.08 : 0));
    }
    function hit(t, pid) {
      if (phase === 'ready') start();
      const rps = D.zen ? song.rps * 1.15 : lapRps(t.lap), sec = 1 / rps, now = KlAudio.now();
      const hold = isHold(t);
      t.st = hold ? 2 : 1; t.pid = pid; score++; next++;
      t.hand = KlAudio.melody(style, t.midi, velOf(t), now, hold ? null : Math.max(0.14, t.dur * sec));
      for (const e of lhOf[t.i]) KlAudio.play(e, now + (e.r - (t.r0 - t.lap * lapRows)) * sec, sec);
      fx.push({ x: t.lane * LW + LW / 2, y: yBottom(t) - tileH(t) / 2, t: 0 });
      if (next < tiles.length && tiles[next].lap !== t.lap) lapDone();
      if (tiles.length - next < 40) addLap(tiles[tiles.length - 1].lap + 1);
      api.changed && api.changed();
    }
    function lapDone() {
      laps++; lapFlash = 1;
      pops.push({ t: '★'.repeat(Math.min(laps, 3)) + (laps > 3 ? ' ' + laps : ''), life: 1.4, big: true });
      if (!D.zen) pops.push({ t: L('Rychleji!', 'Faster!'), life: 1.4, dy: 46 });
    }
    function release(pid) {
      for (const t of tiles) if (t.st === 2 && t.pid === pid) endHold(t, false);
    }
    function endHold(t, full) {
      const got = full ? t.len : Math.max(0, pos - t.r0);
      const bonus = Math.max(0, Math.floor(got / song.beat + 1e-6) - 1);
      t.st = 1; t.held = got;
      if (bonus) { score += bonus; pops.push({ t: '+' + bonus, life: 0.8, x: t.lane * LW + LW / 2, y: Y0 - RH * 1.2 }); }
      if (t.hand) t.hand.release(KlAudio.now() + (full ? 0.15 : 0.02));
    }
    function fail(info) {
      if (phase !== 'play' && phase !== 'ready') return;
      phase = 'fail'; failInfo = Object.assign({ t: 0, from: pos }, info); flash = 0.5;
      KlAudio.error(KlAudio.now());
      for (const t of tiles) if (t.st === 2) endHold(t, false);
      api.setTimer(false);
    }
    function press(x, y, pid) {
      if (over || paused || phase === 'fail' || phase === 'done') return;
      KlAudio.unlock();
      const lane = Math.max(0, Math.min(LANES - 1, Math.floor(x / LW))), t = tiles[next];
      if (!t) return;
      const yb = yBottom(t), yt = yb - tileH(t);
      if (phase === 'ready') {
        if (!pick.hidden || !canStart()) return;
        if (lane === t.lane && y > yt - RH * 0.3) hit(t, pid);
        return;
      }
      if (lane === t.lane && y >= yt - RH * 0.4) { hit(t, pid); return; }
      // ťuknutí na pozdější dlaždici se ignoruje, do prázdna je chyba
      for (let i = next + 1; i < Math.min(tiles.length, next + 8); i++) {
        const u = tiles[i], b = yBottom(u);
        if (u.lane === lane && y <= b + 6 && y >= b - tileH(u) - 6) return;
      }
      if (lane === t.lane) return;
      const row = D.zen ? null : pos + (Y0 - y) / RH;
      fail({ kind: 'wrong', lane, row, y });
    }

    // ── Doprovod podle hodin ──
    function schedule() {
      if (style === 'piano' || D.zen || speed > 1 || phase !== 'play') return;
      const horizon = rowAt(playT + 0.3);
      for (;;) {
        const e = arr.ev[schedIdx];
        if (!e) { schedLap++; schedIdx = 0; if (!arr.ev.length) return; continue; }
        const r = schedLap * lapRows + e.r;
        if (r >= horizon) break;
        const t = aAnchor + rowTime(r) - pAnchor;
        if (t > KlAudio.now() - 0.02) KlAudio.play(e, t, 1 / lapRps(schedLap));
        schedIdx++;
      }
    }

    function step(dt) {
      for (let i = fx.length - 1; i >= 0; i--) { fx[i].t += dt; if (fx[i].t > 0.4) fx.splice(i, 1); }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (pops[i].life <= 0) pops.splice(i, 1); }
      flash = Math.max(0, flash - dt); lapFlash = Math.max(0, lapFlash - dt * 1.5);
      if (phase === 'fail') {
        failInfo.t += dt;
        if (failInfo.kind === 'miss' && !D.zen) { const goal = failInfo.tile.r0 + (H * 0.62 - Y0) / RH; pos += (goal - pos) * Math.min(1, dt * 8); }
        if (failInfo.t > 1.4) finish();
        return;
      }
      if (phase !== 'play') return;
      if (D.zen) {
        zenPos += (next - zenPos) * Math.min(1, dt * 18);
        zenLeft -= dt;
        if (zenLeft <= 0) { zenLeft = 0; phase = 'done'; api.setTimer(false); setTimeout(finish, 600); }
        return;
      }
      playT += dt;
      pos = rowAt(playT);
      for (const t of tiles) if (t.st === 2 && pos >= t.r0 + t.len) endHold(t, true);
      const t = tiles[next];
      if (t && Y0 + (pos - t.r0) * RH > H + RH * 0.35) fail({ kind: 'miss', tile: t });
    }

    function finish() {
      if (over) return; over = true; api.setTimer(false);
      phase = 'done';
      const best = data.best_song || (data.best_song = {});
      best[song.id] = Math.max(best[song.id] || 0, score);
      if (P.level) {
        const goal = P.laps;
        if (laps < goal) { api.failed({ score, html: `<p class="k-muted">${L(`Zahráno ${laps} z ${goal}× · ${score} dlaždic`, `Played ${laps} of ${goal}× · ${score} tiles`)}</p>` }); return; }
        api.solved({ title: `${score} ${L('dlaždic', 'tiles')}`, stars: laps >= goal + 2 ? 3 : laps >= goal + 1 ? 2 : 1, score }); return;
      }
      data['best_' + P.mode] = Math.max(data['best_' + P.mode] || 0, score);
      data.best = Math.max(data.best || 0, score);
      data.laps = Math.max(data.laps || 0, laps);
      const stars = D.zen ? (score >= 150 ? 3 : score >= 100 ? 2 : 1) : laps >= 3 ? 3 : laps >= 2 ? 2 : 1;
      api.solved({ title: `${score} ${L('dlaždic', 'tiles')}`, stars, score, html: `<p class="k-muted">${nm(song.name)} · ${nm(STYLES.find(s => s.id === style).name)}${D.zen ? '' : ` · ${laps}★`}</p>` });
    }

    // ── Kresba ──
    function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
    function draw() {
      const g = ctx, T = THEMES[style], k = cssW / W;
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      g.drawImage(bgSprite(), 0, 0, W, H);
      // tep: pozadí lehce blikne na každý puls
      if (T.glow && phase === 'play' && !D.zen) {
        const pr = arr.pulse, ph = ((pos - song.pickup) % pr + pr) % pr, a = Math.exp(-ph / pr * 5) * 0.16;
        if (a > 0.01) { g.globalAlpha = a; g.drawImage(glowSprite(), 0, 0, W, H); g.globalAlpha = 1; }
      }
      if (lapFlash > 0) { g.fillStyle = T.hold; g.globalAlpha = lapFlash * 0.18; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
      // dlaždice
      const blink = phase === 'fail' && Math.floor(failInfo.t * 6) % 2 === 0;
      for (let i = Math.max(0, next - 12); i < tiles.length; i++) {
        const t = tiles[i], yb = yBottom(t), h = tileH(t), yt = yb - h;
        if (yt > H + 4) continue;
        if (yb < -4) break;
        const x = t.lane * LW + 1.5, w = LW - 3, y = yt + 1.5, hh = h - 3;
        if (t.st === 0) {
          const miss = phase === 'fail' && failInfo.kind === 'miss' && failInfo.tile === t;
          g.drawImage(tileSprite(hh, isHold(t), miss && blink), x - PAD, y - PAD, w + PAD * 2, hh + PAD * 2);
          if (phase === 'ready' && i === next) {
            g.fillStyle = '#fff'; g.font = '700 17px Unbounded, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            const ok = canStart();
            g.fillText(ok ? 'START' : '…', x + w / 2, yb - Math.min(h, RH) / 2 - 6);
            g.font = '500 11px "Space Grotesk", sans-serif';
            g.fillText(ok ? L('ťukni', 'tap') : L('ladím klavír', 'tuning piano') + ` ${Math.round(100 * Math.min(1, KlAudio.loaded / (KlAudio.total / 2)))} %`, x + w / 2, yb - Math.min(h, RH) / 2 + 16);
          }
        } else if (t.st === 2) {
          const prog = Math.max(0, Math.min(1, (pos - t.r0) / t.len));
          g.fillStyle = T.tile[1]; rr(g, x, y, w, hh, 7); g.fill();
          holdMarks(g, x, y, w, hh, T, prog);
        } else {
          g.fillStyle = T.done; rr(g, x, y, w, hh, 7); g.fill();
          if (isHold(t) && t.held) { const fh = hh * Math.min(1, t.held / t.len); g.fillStyle = T.hold; g.globalAlpha = 0.28; rr(g, x, y + hh - fh, w, fh, 7); g.fill(); g.globalAlpha = 1; }
        }
      }
      // chyba ťuknutím vedle
      if (phase === 'fail' && failInfo.kind === 'wrong') {
        const yb = D.zen ? Y0 : Y0 + (pos - failInfo.row) * RH + RH / 2;
        g.fillStyle = blink ? 'rgba(255,60,60,.85)' : 'rgba(255,60,60,.35)';
        rr(g, failInfo.lane * LW + 1.5, yb - RH + 1.5, LW - 3, RH - 3, 7); g.fill();
      }
      for (const f of fx) { const a = 1 - f.t / 0.4; g.strokeStyle = T.hold; g.globalAlpha = a * 0.8; g.lineWidth = 3; g.beginPath(); g.arc(f.x, f.y, 16 + f.t * 120, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
      if (flash > 0) { g.fillStyle = `rgba(255,40,40,${flash * 0.5})`; g.fillRect(0, 0, W, H); }
      // skóre a nápisy
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const txt = (s, x, y, size, col, wgt = 900, font = 'Unbounded') => { g.font = `${wgt} ${size}px ${font}, sans-serif`; g.lineWidth = 6; g.lineJoin = 'round'; g.strokeStyle = style === 'piano' || style === 'pop' ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.55)'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
      if (phase !== 'ready') {
        txt(String(score), W / 2, 58, 46, D.zen ? T.text : '#ff4757');
        if (D.zen) txt(zenLeft.toFixed(1) + ' s', W / 2, 100, 16, T.sub, 700);
        else {
          txt('★'.repeat(Math.min(3, laps)) + '☆'.repeat(Math.max(0, 3 - laps)) + (laps > 3 ? ` +${laps - 3}` : ''), W / 2, 98, 16, '#f6b400', 700, '"Space Grotesk"');
          if (P.level) txt(`${L('cíl', 'goal')} ${P.laps}★`, W / 2, 122, 12, T.sub, 700, '"Space Grotesk"');
        }
      }
      for (const p of pops) {
        g.globalAlpha = Math.min(1, p.life * 2);
        if (p.x) txt(p.t, p.x, p.y - (0.8 - p.life) * 40, 18, T.hold, 800);
        else txt(p.t, W / 2, H * 0.3 + (p.dy || 0) - (1.4 - p.life) * 20, p.big ? 40 : 18, p.big ? '#f6b400' : T.text, 900);
      }
      g.globalAlpha = 1;
      if (paused) { g.fillStyle = 'rgba(10,8,20,.5)'; g.fillRect(0, 0, W, H); txt(L('PAUZA', 'PAUSED'), W / 2, H * 0.45, 30, '#fff'); txt(L('ťukni nebo P', 'tap or press P'), W / 2, H * 0.52, 14, '#fff', 700, '"Space Grotesk"'); }
    }
    function holdMarks(g, x, y, w, hh, T, prog) {
      const cx = x + w / 2;
      if (prog > 0) {
        const fh = (hh - 6) * prog, gr = g.createLinearGradient(0, y + hh - fh, 0, y + hh);
        gr.addColorStop(0, T.hold); gr.addColorStop(1, 'rgba(255,255,255,.85)');
        g.fillStyle = gr; rr(g, x + 3, y + hh - 3 - fh, w - 6, fh, 6); g.fill();
      }
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx, y + 18); g.lineTo(cx, y + hh - 34); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(cx, y + hh - 22, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = T.tile[1]; g.beginPath(); g.arc(cx, y + hh - 22, 4, 0, Math.PI * 2); g.fill();
    }

    // ── Výběr skladby a stylu ──
    function ui() {
      songBtn.innerHTML = `<span class="kl-note">♪</span><span><b>${nm(song.name)}</b><small>${song.by}</small></span>${free ? '<span class="kl-caret">▾</span>' : ''}`;
      songBtn.disabled = !free;
      for (const b of top.querySelectorAll('[data-s]')) b.classList.toggle('on', b.dataset.s === style);
      stage.dataset.theme = style;
      const best = (data.best_song || {})[song.id];
      el.querySelector('.kl-info').textContent = [P.text || D.name, P.level ? L(`zahraj skladbu ${P.laps}×`, `play the song ${P.laps}×`) : best ? `${L('rekord', 'best')} ${best}` : ''].filter(Boolean).join(' · ');
    }
    function openPick() {
      const best = data.best_song || {};
      const row = s => `<button type="button" data-id="${s.id}" class="${s.id === song.id ? 'on' : ''}"><span><b>${nm(s.name)}</b><small>${s.by}</small></span><em>${nm(STYLES.find(x => x.id === s.style).name)}${best[s.id] ? ` · ${best[s.id]}` : ''}</em></button>`;
      const own = SONGS.filter(s => s.by === 'Windowling'), old = SONGS.filter(s => s.by !== 'Windowling');
      list.innerHTML = `<h4>${L('Vlastní skladby', 'Original songs')}</h4>${own.map(row).join('')}<h4>${L('Klasika a lidovky', 'Classics and folk')}</h4>${old.map(row).join('')}`;
      pick.hidden = false;
      const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'center' });
    }
    songBtn.addEventListener('click', () => { KlAudio.unlock(); if (free && phase === 'ready') openPick(); });
    el.querySelector('.kl-x').addEventListener('click', () => { pick.hidden = true; });
    list.addEventListener('click', e => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      song = songById(b.dataset.id); style = data.style && data.style[song.id] ? data.style[song.id] : song.style;
      data.song = song.id; api.persist && api.persist();
      pick.hidden = true; setup(); preview();
    });
    top.querySelector('.kl-styles').addEventListener('click', e => {
      const b = e.target.closest('[data-s]'); if (!b || phase !== 'ready') return;
      KlAudio.unlock();
      style = b.dataset.s; (data.style || (data.style = {}))[song.id] = style; api.persist && api.persist();
      setup(); preview();
    });
    // krátká ukázka stylu: první takty doprovodu a melodie
    let prevT = 0;
    function preview() {
      if (!KlAudio.ready() || speed > 1) return;
      const now = KlAudio.now() + 0.05, sec = 1 / song.rps, upTo = Math.min(parsed.total, song.pickup + song.bar * 2);
      prevT = performance.now();
      const stamp = prevT;
      for (const n of parsed.notes) if (n.r0 < upTo) { const t = now + n.r0 * sec; setTimeout(() => { if (stamp === prevT && phase === 'ready') KlAudio.melody(style, n.midi, 0.62, t, n.dur * sec); }, Math.max(0, (t - KlAudio.now() - 0.2) * 1000)); }
      const ev = style === 'piano' ? lhOf.flat() : arr.ev;
      for (const e of ev) if (e.r < upTo && e.k !== 'riser') { const t = now + e.r * sec; setTimeout(() => { if (stamp === prevT && phase === 'ready') KlAudio.play(e, t, sec); }, Math.max(0, (t - KlAudio.now() - 0.2) * 1000)); }
    }

    // ── Smyčka a ovládání ──
    let last = performance.now(), last0 = last, raf = 0;
    function frame(nowT) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (nowT - last) / 1000); last = nowT;
      watchFps((nowT - last0) / 1000); last0 = nowT;
      if (api.paused && api.paused() && !paused && !over && phase === 'play') setPause(true);
      if (!paused && !over) {
        const n = Math.max(1, speed);
        for (let i = 0; i < n; i++) { if (autoOn) autopilot(); step(dt); }
        schedule();
      }
      draw();
    }
    function setPause(on) {
      if (over || phase !== 'play') return;
      paused = on; api.setTimer(!on);
      if (on) for (const t of tiles) if (t.st === 2) endHold(t, false);
      else anchor();
    }
    const toCanvas = e => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (paused) { setPause(false); return; }
      if (!pick.hidden) return;
      const [x, y] = toCanvas(e); press(x, y, e.pointerId);
    });
    const up = e => release(e.pointerId);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    // automat pro testy: ťukne na další dlaždici, když dojede dolů
    function autopilot() {
      const t = tiles[next]; if (!t) return;
      if (phase === 'ready') { if (canStart()) press(t.lane * LW + LW / 2, yBottom(t) - 20, 'auto'); return; }
      if (phase !== 'play') return;
      if (D.zen || pos >= t.r0 - 0.02) press(t.lane * LW + LW / 2, yBottom(t) - Math.min(tileH(t), RH) / 2, 'auto' + next);
    }
    const KEYS = { d: 0, f: 1, j: 2, k: 3 };
    const keyDown = {};
    const keyUp = e => { const k = e.key.toLowerCase(); if (k in KEYS) { release('key' + k); keyDown[k] = false; } };
    document.addEventListener('keyup', keyUp);

    fit(); addEventListener('resize', fit);
    setup();
    raf = requestAnimationFrame(frame);
    return {
      getState: () => null,
      progress: () => (P.level ? Math.min(1, laps / P.laps) : 0),
      destroy() { cancelAnimationFrame(raf); removeEventListener('resize', fit); document.removeEventListener('keyup', keyUp); for (const t of tiles) if (t.st === 2) endHold(t, false); prevT = -1; },
      pause() { setPause(true); },
      onKey(e) {
        const k = e.key.toLowerCase();
        if (k in KEYS) {
          e.preventDefault();
          if (keyDown[k] || e.repeat) return;
          keyDown[k] = true;
          if (paused) { setPause(false); return; }
          const t = tiles[next], lane = KEYS[k];
          const y = t && t.lane === lane ? yBottom(t) - Math.min(tileH(t), RH) / 2 : Y0 - RH / 2;
          press(lane * LW + LW / 2, y, 'key' + k);
        } else if (k === 'p' || k === 'escape') { e.preventDefault(); setPause(!paused); }
      },
      _state: () => ({ phase, score, laps, next, pos: +pos.toFixed(2), over, song: song.id, style, tiles: tiles.length }),
      _auto(on) { autoOn = on !== false; },
      _speed(n) { speed = Math.max(1, n | 0); },
      _press(lane) { const t = tiles[next]; press(lane * LW + LW / 2, t && t.lane === lane ? yBottom(t) - 20 : Y0 - RH / 2, 'test'); },
      _next: () => (tiles[next] ? tiles[next].lane : -1),
      _solve() { laps = Math.max(laps, (P.laps || 1) + 2); score = Math.max(score, 200); phase = 'done'; finish(); },
    };
  }

  // úvodní obrázek: klaviatura a padající dlaždice
  function art(el) {
    el.innerHTML = '<canvas width="360" height="360" style="object-fit:contain"></canvas>';
    const g = el.querySelector('canvas').getContext('2d');
    g.beginPath(); g.roundRect(0, 0, 360, 360, 24); g.clip();
    const bg = g.createLinearGradient(0, 0, 0, 360); bg.addColorStop(0, '#1a0638'); bg.addColorStop(1, '#050011'); g.fillStyle = bg; g.fillRect(0, 0, 360, 360);
    g.strokeStyle = 'rgba(120,220,255,.15)';
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * 90, 0); g.lineTo(i * 90, 280); g.stroke(); }
    const tiles = [[1, -40, 90], [3, 40, 90], [0, 120, 170], [2, 200, 70]];
    for (const [l, y, h] of tiles) {
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#27e3ff'); gr.addColorStop(1, '#7d4dff');
      g.shadowColor = '#28d8ff'; g.shadowBlur = 16; g.fillStyle = gr; g.beginPath(); g.roundRect(l * 90 + 3, y, 84, h - 4, 8); g.fill(); g.shadowBlur = 0;
    }
    // klaviatura dole
    g.fillStyle = '#f7f3ea'; g.fillRect(0, 280, 360, 80);
    for (let i = 0; i <= 14; i++) { g.fillStyle = '#c9c1b2'; g.fillRect(i * 25.7, 280, 1.2, 80); }
    g.fillStyle = '#121216';
    for (let i = 0; i < 13; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) g.fillRect(i * 25.7 + 17, 280, 16, 48);
  }
  return { DIFFS, generate, create, art, LEVEL_ORDER };
})();

if (typeof window !== 'undefined' && !window.__KIT_TEST__) Kit.game({
  id: 'klavesy', title: 'KLÁVESY',
  tagline: Kit.L('Na motivy Piano Tiles: ťukej na dlaždice a skladba hraje pod tvými prsty. Beethoven, Mozart, Grieg i lidovky jako klavír, pop, house, EDM nebo rock.', 'In the spirit of Piano Tiles: tap the tiles and the song plays under your fingers. Beethoven, Mozart, Grieg and folk tunes as piano, pop, house, EDM or rock.'),
  diffs: Klavesy.DIFFS, generate: Klavesy.generate, create: Klavesy.create, art: Klavesy.art,
  dailyDiff: () => 'skladba',
  levelDiff: n => (n <= 40 ? 'lehka' : n <= 90 ? 'skladba' : 'rychla'),
  rules: Kit.L(`<p>Shora jedou dlaždice. Ťukej jen na ně, odspodu nahoru: každé ťuknutí zahraje další notu skladby.</p>
    <ul><li>Ťuknutí do prázdna nebo propásnutá dlaždice hru končí.</li>
    <li>Dlouhé dlaždice drž, dokud nedojedou. Za každý držený řádek je bod navíc.</li>
    <li>Po každém zahrání skladby získáš ★ a tempo se zrychlí.</li>
    <li>Na startu si vyber skladbu a styl: Klavír, Pop, House, EDM nebo Rock. <b>Zen</b>: dlaždice stojí, zahraj jich co nejvíc za 30 sekund.</li>
    <li>Na počítači hraj klávesami D F J K. P pozastaví hru.</li></ul>
    <p class="k-muted">Klavír: Salamander Grand Piano, Alexander Holm (CC BY 3.0). Skladby jsou volná díla.</p>`,
    `<p>Tiles slide down from the top. Tap only them, bottom first: every tap plays the next note of the song.</p>
    <ul><li>Tapping an empty spot or missing a tile ends the game.</li>
    <li>Hold long tiles until they pass. Every row held is a bonus point.</li>
    <li>Every time you finish the song you earn a ★ and the tempo goes up.</li>
    <li>Pick a song and a style at the start: Piano, Pop, House, EDM or Rock. <b>Zen</b>: the tiles stand still, play as many as you can in 30 seconds.</li>
    <li>On a computer, play with the keys D F J K. P pauses.</li></ul>
    <p class="k-muted">Piano: Salamander Grand Piano by Alexander Holm (CC BY 3.0). The songs are in the public domain.</p>`),
  achievements: [
    { id: 'k100', name: Kit.L('Rozehraný', 'Warmed up'), desc: Kit.L('Zahraj 100 dlaždic v jedné hře', 'Play 100 tiles in one game'), prog: s => [Math.min(100, (s.data && s.data.best) || 0), 100] },
    { id: 'k3', name: Kit.L('Tři hvězdy', 'Three stars'), desc: Kit.L('Zahraj skladbu třikrát za sebou', 'Play a song three times in a row'), prog: s => [Math.min(3, (s.data && s.data.laps) || 0), 3] },
    { id: 'k300', name: Kit.L('Virtuos', 'Virtuoso'), desc: Kit.L('Zahraj 300 dlaždic v jedné hře', 'Play 300 tiles in one game'), prog: s => [Math.min(300, (s.data && s.data.best) || 0), 300] },
  ],
});
