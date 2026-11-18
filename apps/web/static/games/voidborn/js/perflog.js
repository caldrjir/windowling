'use strict';
// ── Záznam výkonu (volitelný, v nastavení je vypnutý) ───────────────────────
// Během běhu sbírá každou sekundu FPS a časy snímků (update / vykreslení / HUD a jejich části,
// i podle jednotlivých zbraní), počty objektů a události (bossové, postupy, záseky, skryté okno).
// Po skončení běhu jde log stáhnout jako JSON a poslat vývojáři k rozboru. Drží se jen poslední log
// (localStorage voidborn.perflog: sync.js ho do cloudu neposílá). Když je záznam vypnutý, stojí
// každé měření jen jedno porovnání.
const PerfLog = (() => {
  // STORE_MAX: localStorage sdílí celé centrum her, uložená kopie proto nesmí být velká (dlouhý běh se prořídí)
  const KEY = 'voidborn.perflog', FORMAT = 1, HITCH_MS = 50, MAX_ROWS = 7200, MAX_EVENTS = 3000, MAX_HITCHES = 400, STORE_MAX = 1000000;
  const NOTES = [
    'rows: jeden řádek za sekundu reálného času, sloupce viz columns/units/help.',
    'Délka snímku (f*) je doba mezi dvěma requestAnimationFrame. fAvg − (uAvg + dAvg + hud) ≈ čas mimo JS hry: rasterizace canvasu na GPU, kompozice, garbage collector, jiné záložky.',
    'u.* a d.* jsou části herní logiky a vykreslení v ms na snímek; w = zbraně {id: [update, vykreslení]}.',
    'hitches: snímky delší než 50 ms s rozpadem času a počty objektů v tom snímku; events: co se ve hře dělo (bossové, postupy, pauza, skrytí okna…).',
  ];
  // části snímku (ms na snímek): u.* = herní logika, d.* = vykreslení
  const SECS = ['u.player', 'u.director', 'u.stats', 'u.grid', 'u.weapons', 'u.enemies', 'u.bullets', 'u.ebullets', 'u.effects', 'u.pickups', 'u.merge', 'u.particles', 'u.cleanup',
    'd.bg', 'd.under', 'd.anomaly', 'd.pickups', 'd.enemies', 'd.weapons', 'd.player', 'd.bullets', 'd.over', 'd.particles', 'd.meteors', 'd.texts', 'd.overlay'];
  const SI = Object.fromEntries(SECS.map((k, i) => [k, i]));
  const COLS = [
    ['t', 's', 'reálný čas od začátku záznamu'], ['gt', 's', 'herní čas běhu'], ['play', '0-1', 'podíl snímků ve stavu hry (zbytek pauza, výběr karet, truhla…)'],
    ['fps', '1/s', 'snímků za sekundu'], ['fAvg', 'ms', 'průměrná délka snímku (mezi dvěma requestAnimationFrame)'], ['fP50', 'ms', 'medián snímku'],
    ['fP95', 'ms', '95. percentil snímku'], ['fMax', 'ms', 'nejdelší snímek'], ['uAvg', 'ms', 'herní logika na snímek'], ['uMax', 'ms', 'nejdelší herní logika'],
    ['dAvg', 'ms', 'vykreslení na snímek'], ['dMax', 'ms', 'nejdelší vykreslení'], ['hud', 'ms', 'HUD (DOM) na snímek'],
    ['f33', 'n', 'snímky delší než 33 ms'], ['f50', 'n', 'snímky delší než 50 ms (hra se zpomalí)'], ['f100', 'n', 'snímky delší než 100 ms'],
    ['lt', 'ms', 'long tasks prohlížeče (jen Chromium)'], ['en', 'n', 'nepřátelé'], ['boss', '0/1', 'boss naživu'], ['bu', 'n', 'střely hráče'], ['eb', 'n', 'střely nepřátel'],
    ['pk', 'n', 'předměty celkem'], ['gem', 'n', 'krystaly'], ['sh', 'n', 'střepy'], ['pa', 'n', 'částice'], ['fx', 'n', 'efekty'], ['tx', 'n', 'plovoucí texty'],
    ['spr', 'n', 'vykreslené sprity na snímek'], ['lvl', '', 'úroveň'], ['kills', 'n', 'zničení nepřátelé celkem'], ['wpn', 'n', 'zbraně'], ['ts', '', 'zpomalení času hry (1 = normál)'],
    ['heap', 'MB', 'JS halda (jen Chromium)'], ...SECS.map(k => [k, 'ms', k === 'u.pickups' ? 'část snímku, průměr na snímek (včetně u.merge)' : 'část snímku, průměr na snímek']), ['w', 'ms', 'zbraně: {id: [update, vykreslení]} průměr na snímek'],
  ];
  const r = (v, d = 2) => (v == null || !isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

  let log = null, b = null, obs = null, last = null;
  const cur = new Float64Array(SECS.length), tot = new Float64Array(SECS.length);
  let curW = {}, totW = {}, hist = new Uint32Array(251), totU = 0, totD = 0, totH = 0, maxN = {};

  const t = () => (log ? performance.now() : 0);
  function lap(key, t0) {
    if (!log) return 0;
    const now = performance.now(), i = SI[key];
    cur[i] += now - t0;
    return now;
  }
  // čas jedné zbraně: kind 0 = update, 1 = vykreslení
  function lapW(id, kind, t0) {
    if (!log) return 0;
    const now = performance.now(), a = curW[id] || (curW[id] = [0, 0]);
    a[kind] += now - t0;
    return now;
  }
  function ev(type, data) {
    if (!log || log.events.length >= MAX_EVENTS) return;
    log.events.push([r((performance.now() - log.t0) / 1000), r(G.time, 1), type, data === undefined ? null : data]);
  }

  function gpu() {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return gl ? { vendor: gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR), renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) } : null;
    } catch (e) { return null; }
  }
  function music() {
    try { const m = JSON.parse(localStorage.getItem('gamecenter.music') || '{}'); return { src: m.src || null, gameMusic: window.GCMusic ? !!GCMusic.gameMusic : null }; } catch (e) { return null; }
  }
  const newBucket = now => ({ t0: now, n: 0, play: 0, fs: [], fSum: 0, fMax: 0, uSum: 0, uMax: 0, dSum: 0, dMax: 0, hSum: 0, f33: 0, f50: 0, f100: 0, lt: 0, spr: 0, sec: new Float64Array(SECS.length), w: {} });

  /** Začátek běhu: jen když je záznam zapnutý v nastavení. */
  function begin() {
    if (log) end('restart');
    if (!SAVE.settings.perfLog || !DEBUG) return; // záznam výkonu je v sekci Debug
    const now = performance.now(), cv = document.getElementById('cv');
    const settings = Object.assign({}, SAVE.settings); delete settings.prio;
    log = {
      game: 'VOIDBORN', version: typeof GAME_VERSION === 'string' ? GAME_VERSION : null, format: FORMAT, created: new Date().toISOString(), t0: now, notes: NOTES,
      meta: {
        lang: LANG, ua: navigator.userAgent, platform: (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform,
        mobile: navigator.userAgentData ? navigator.userAgentData.mobile : null, cores: navigator.hardwareConcurrency || null, memoryGB: navigator.deviceMemory || null,
        screen: [screen.width, screen.height], dpr: window.devicePixelRatio || 1, viewport: [innerWidth, innerHeight], canvas: cv ? [cv.width, cv.height] : null,
        zoom: r(Render.zoom, 3), renderScale: r(Render.scale), touch: matchMedia('(pointer: coarse)').matches, gpu: gpu(), music: music(), settings,
      },
      run: {
        pilot: G.pilot.id, sector: G.sector.id, sectorName: G.sector.name, od: G.od, startWeapon: G.startWeapon,
        forge: Object.assign({}, SAVE.forge), unlockedAchievements: Object.keys(SAVE.achievements).length,
      },
      columns: COLS.map(c => c[0]), units: Object.fromEntries(COLS.map(c => [c[0], c[1]])), help: Object.fromEntries(COLS.map(c => [c[0], c[2]])),
      rows: [], events: [], hitches: [], frames: 0,
    };
    b = newBucket(now);
    cur.fill(0); tot.fill(0); curW = {}; totW = {}; hist = new Uint32Array(251); totU = totD = totH = 0; maxN = {};
    try {
      obs = new PerformanceObserver(list => { if (b) for (const e of list.getEntries()) b.lt += e.duration; });
      obs.observe({ type: 'longtask', buffered: false });
    } catch (e) { obs = null; }
    ev('start', { weapons: G.weapons.map(w => w.id) });
  }

  /** Jeden snímek: délka (od minulého), herní logika, vykreslení a HUD v ms. */
  function frame(ms, u, d, h, spr) {
    if (!log) return;
    const now = performance.now();
    if (ms > 1000) { ev('gap', r(ms, 0)); cur.fill(0); curW = {}; b = newBucket(now); return; }
    log.frames++;
    b.n++; if (G.state === 'play') b.play++;
    b.fs.push(ms); b.fSum += ms; if (ms > b.fMax) b.fMax = ms;
    b.uSum += u; if (u > b.uMax) b.uMax = u;
    b.dSum += d; if (d > b.dMax) b.dMax = d;
    b.hSum += h; b.spr += spr;
    if (ms > 33) b.f33++;
    if (ms > 50) b.f50++;
    if (ms > 100) b.f100++;
    hist[Math.min(250, Math.round(ms))]++;
    totU += u; totD += d; totH += h;
    for (let i = 0; i < SECS.length; i++) { b.sec[i] += cur[i]; tot[i] += cur[i]; }
    for (const id in curW) {
      const a = curW[id], bw = b.w[id] || (b.w[id] = [0, 0]), tw = totW[id] || (totW[id] = [0, 0]);
      bw[0] += a[0]; bw[1] += a[1]; tw[0] += a[0]; tw[1] += a[1];
    }
    // zásek: co v tom snímku trvalo a kolik toho na mapě bylo
    if (ms > HITCH_MS && log.frames > 5 && log.hitches.length < MAX_HITCHES) {
      const sec = {};
      for (let i = 0; i < SECS.length; i++) if (cur[i] > 0.3) sec[SECS[i]] = r(cur[i]);
      const w = {};
      for (const id in curW) if (curW[id][0] + curW[id][1] > 0.3) w[id] = [r(curW[id][0]), r(curW[id][1])];
      log.hitches.push({ t: r((now - log.t0) / 1000), gt: r(G.time, 1), ms: r(ms, 1), u: r(u), d: r(d), h: r(h), sec, w, state: G.state,
        en: G.enemies.length, pk: G.pickups.length, pa: G.particles.length, fx: G.effects.length, bu: G.bullets.length, eb: G.ebullets.length });
    }
    cur.fill(0); curW = {};
    if (now - b.t0 >= 1000) flush(now);
  }

  function flush(now) {
    if (!b.n) { b = newBucket(now); return; }
    const fs = b.fs.sort((x, y) => x - y), q = p => fs[Math.min(fs.length - 1, Math.floor(p * fs.length))];
    let gem = 0, sh = 0;
    for (const pk of G.pickups) { if (pk.kind === 'gem') gem++; else if (pk.kind === 'shard') sh++; }
    const counts = { en: G.enemies.length, bu: G.bullets.length, eb: G.ebullets.length, pk: G.pickups.length, pa: G.particles.length, fx: G.effects.length, tx: G.texts.length };
    for (const k in counts) maxN[k] = Math.max(maxN[k] || 0, counts[k]);
    const heap = performance.memory ? r(performance.memory.usedJSHeapSize / 1048576, 1) : null;
    const w = {};
    for (const id in b.w) w[id] = [r(b.w[id][0] / b.n), r(b.w[id][1] / b.n)];
    if (log.rows.length < MAX_ROWS) log.rows.push([
      r((b.t0 - log.t0) / 1000, 1), r(G.time, 1), r(b.play / b.n), r(b.n / ((now - b.t0) / 1000), 1),
      r(b.fSum / b.n), r(q(0.5)), r(q(0.95)), r(b.fMax), r(b.uSum / b.n), r(b.uMax), r(b.dSum / b.n), r(b.dMax), r(b.hSum / b.n, 3),
      b.f33, b.f50, b.f100, r(b.lt, 1), counts.en, G.boss ? 1 : 0, counts.bu, counts.eb, counts.pk, gem, sh, counts.pa, counts.fx, counts.tx,
      Math.round(b.spr / b.n), G.level, G.kills, G.weapons.length, r(G.timeScale), heap, ...Array.from(b.sec, v => r(v / b.n)), w,
    ]);
    else log.truncated = true;
    b = newBucket(now);
  }

  // percentil délky snímku z histogramu celého běhu
  function pct(p) {
    const n = hist.reduce((a, v) => a + v, 0);
    let acc = 0;
    for (let i = 0; i < hist.length; i++) { acc += hist[i]; if (acc >= n * p) return i; }
    return 250;
  }

  /** Konec běhu: dopočítá souhrn, uloží log a záznam zastaví. */
  function end(reason) {
    if (!log) return;
    const now = performance.now();
    if (b && b.n) flush(now);
    if (obs) { try { obs.disconnect(); } catch (e) { /* nic */ } obs = null; }
    const n = log.frames || 1, dur = (now - log.t0) / 1000, over = ms => r(hist.reduce((a, v, i) => a + (i > ms ? v : 0), 0) / n * 100, 1);
    log.result = {
      reason, victory: !!G.victory, endless: !!G.endless, time: r(G.time, 1), kills: G.kills, level: G.level,
      weapons: G.weapons.map(w => `${w.id}:${w.level}${w.oc ? '★' + w.oc : ''}`), passives: Object.assign({}, G.passives), mutations: Object.assign({}, G.mut),
    };
    log.summary = {
      seconds: r(dur, 1), frames: log.frames, avgFps: r(log.frames / Math.max(0.001, dur), 1),
      frameMs: { p50: pct(0.5), p90: pct(0.9), p95: pct(0.95), p99: pct(0.99), max: log.rows.reduce((a, row) => Math.max(a, row[7] || 0), 0) },
      fps1Low: r(1000 / Math.max(1, pct(0.99)), 1), pctFramesOver: { '17ms': over(17), '33ms': over(33), '50ms': over(50), '100ms': over(100) },
      avgMs: { frame: r(dur * 1000 / n), update: r(totU / n, 3), draw: r(totD / n, 3), hud: r(totH / n, 3), outsideJs: r(dur * 1000 / n - (totU + totD + totH) / n) },
      sections: SECS.map((k, i) => [k, r(tot[i] / n, 3)]).sort((x, y) => y[1] - x[1]),
      weapons: Object.entries(totW).map(([id, a]) => [id, r(a[0] / n, 3), r(a[1] / n, 3)]).sort((x, y) => y[1] + y[2] - x[1] - x[2]),
      maxCounts: maxN, hitches: log.hitches.length,
      worstSeconds: log.rows.slice().sort((x, y) => y[4] - x[4]).slice(0, 8).map(row => ({ t: row[0], gt: row[1], fAvg: row[4], fMax: row[7], en: row[17], pk: row[21], pa: row[24], fx: row[25] })),
    };
    ev('end', reason);
    log.frameHistogram = Array.from(hist);
    const json = JSON.stringify(log);
    last = { json, created: log.created, seconds: log.summary.seconds };
    // uložená kopie (pro stažení po znovunačtení): dlouhý běh se prořídí na každý n-tý řádek
    let stored = json;
    for (let step = 2; stored.length > STORE_MAX && step <= 64; step *= 2) {
      stored = JSON.stringify(Object.assign({}, log, { rows: log.rows.filter((row, i) => i % step === 0), rowStep: step, hitches: log.hitches.slice(0, 100) }));
    }
    try {
      if (stored.length <= STORE_MAX) localStorage.setItem(KEY, stored); else localStorage.removeItem(KEY);
    } catch (e) { try { localStorage.removeItem(KEY); } catch (e2) { /* nic */ } }
    log = null; b = null;
  }

  /** Poslední uložený log (v paměti, nebo z localStorage po znovunačtení stránky). */
  function lastLog() {
    if (last) return last;
    try {
      const json = localStorage.getItem(KEY);
      if (!json) return null;
      const o = JSON.parse(json);
      last = { json, created: o.created, seconds: o.summary ? o.summary.seconds : null };
      return last;
    } catch (e) { return null; }
  }
  function download() {
    const l = lastLog();
    if (!l) return false;
    const stamp = (l.created || new Date().toISOString()).slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
    const url = URL.createObjectURL(new Blob([l.json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `voidborn-log-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  }

  return { begin, end, frame, t, lap, lapW, ev, lastLog, download, get on() { return !!log; } };
})();
