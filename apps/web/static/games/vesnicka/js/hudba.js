'use strict';
// ── VESNIČKA · hudba v pozadí ──
// Dvě skladby na každé roční období a dvě na noc (hudba/*.mp3, srovnané na stejnou hlasitost, −18 LUFS).
// Období trvá 5 minut a jeho dvě skladby po 2,5 minuty ho vyplní: hraje se od místa, kde je čas období,
// takže změna období padne na konec skladby. Mezi skladbami, obdobími i dnem a nocí se hudba prolíná.
// Hlasitost = nastavení hry × hudba v herním centru (GCMusic.level); vlastní playlist nebo „bez hudby“
// v centru ji ztiší. Hraje se přes Web Audio (na iPhonu jde hlasitost nastavit jen tak).
const Hudba = (() => {
  const FADE = 4, HALF = SEASON_LEN / 2, DAY = ['jaro', 'leto', 'podzim', 'zima'];
  let ac = null, master = null, on = true, vol = 0.55, unlocked = false, cur = null, skip = null, stopT = 0;
  const players = [];

  // Co má hrát teď: noc podle hodin hráče (jako obloha), jinak roční období; skladba 1 nebo 2 podle půlky období.
  function plan() {
    const now = Date.now(), d = new Date(now), o = (typeof Scene !== 'undefined' && Scene.opts) || {};
    const h = o.hour != null ? o.hour : d.getHours() + d.getMinutes() / 60;
    const slot = h < 6 || h >= 20 ? 'noc' : DAY[o.season != null ? o.season : seasonAt(now)];
    const pos = (now / 1000) % SEASON_LEN, idx = pos < HALF ? 0 : 1;
    return { key: `${slot}-${idx + 1}`, at: pos - idx * HALF };
  }
  // Po které skladbě hraje která, když skladba skončí dřív než půlka období.
  function following(key) {
    const [slot, n] = key.split('-');
    if (n === '1') return `${slot}-2`;
    return slot === 'noc' ? 'noc-1' : `${DAY[(DAY.indexOf(slot) + 1) % 4]}-1`;
  }
  const level = () => {
    const g = window.GCMusic;
    if (!on || !unlocked || (g && !g.gameMusic)) return 0;
    return Math.min(1, vol * vol * (g ? g.level : 1));
  };

  function player() {
    const el = new Audio();
    el.preload = 'auto';
    const p = { el, key: null, gain: null };
    if (ac) {
      try { const src = ac.createMediaElementSource(el); p.gain = ac.createGain(); p.gain.gain.value = 0; src.connect(p.gain); p.gain.connect(master); } catch (e) { p.gain = null; }
    }
    if (!p.gain) el.volume = 0;
    return p;
  }
  // Plynulé zesílení nebo zeslabení jedné skladby (bez Web Audio přes el.volume).
  function fade(p, to, sec) {
    if (p.gain) { const t = ac.currentTime, g = p.gain.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + sec); return; }
    const from = p.v || 0, t0 = performance.now();
    clearInterval(p.iv);
    p.iv = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / (sec * 1000)); p.v = from + (to - from) * k; p.el.volume = p.v * level(); if (k >= 1) clearInterval(p.iv); }, 50);
  }
  function start(key, at, sec = FADE) {
    const p = players.find(x => x !== cur), old = cur;
    p.key = key;
    p.el.src = `hudba/${key}.mp3`;
    if (at > 1) p.el.addEventListener('loadedmetadata', () => { if (at < p.el.duration - FADE - 1) p.el.currentTime = at; }, { once: true });
    p.el.play().catch(() => {});
    fade(p, 1, sec);
    if (old) { fade(old, 0, sec); setTimeout(() => { if (cur !== old) old.el.pause(); }, sec * 1000 + 100); }
    cur = p;
  }
  function stop() {
    for (const p of players) { p.el.pause(); clearInterval(p.iv); p.v = 0; if (p.gain) { p.gain.gain.cancelScheduledValues(ac.currentTime); p.gain.gain.value = 0; } else p.el.volume = 0; }
    cur = null; skip = null;
  }

  // Hlasitost celé hudby; při nule se přehrávání po zeslabení zastaví a šetří baterii.
  function apply() {
    const v = level();
    if (master) { const t = ac.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + 0.6); }
    else for (const p of players) p.el.volume = (p.v || 0) * v;
    clearTimeout(stopT);
    if (!v) { stopT = setTimeout(() => { if (!level()) stop(); }, 800); return; }
    if (!cur && !document.hidden) { const p = plan(); start(p.key, p.at); }
  }
  // Volá se jednou za sekundu: změna období, dne a noci, nebo konec skladby.
  function tick() {
    if (!cur || !level()) return;
    const p = plan();
    if (cur.key === p.key) { skip = null; if (cur.el.duration - cur.el.currentTime < FADE) { skip = p.key; start(following(p.key), 0); } return; }
    if (p.key === skip) return; // skladba skončila dřív než půlka období a už hraje ta další
    skip = null;
    start(p.key, p.key.split('-')[0] === cur.key.split('-')[0] ? 0 : p.at);
  }
  /** Volá se při klepnutí hráče: prohlížeče pustí zvuk až po něm. */
  function unlock() {
    if (unlocked) { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); return; }
    unlocked = true;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
      if (ac.state === 'suspended') ac.resume().catch(() => {});
    } catch (e) { ac = null; master = null; }
    players.push(player(), player());
    // Druhý přehrávač se musí poprvé spustit při klepnutí, jinak ho iPhone později nepustí.
    const b = players[1]; b.el.src = `hudba/${following(plan().key)}.mp3`; b.el.play().then(() => { if (cur !== b) b.el.pause(); }).catch(() => {});
    apply();
  }

  document.addEventListener('visibilitychange', () => {
    if (!unlocked) return;
    if (document.hidden) { stop(); return; }
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    apply();
  });
  if (window.GCMusic) window.GCMusic.on(() => apply());

  return {
    unlock, tick, apply,
    /** Nastavení hry: hudba zapnutá a hlasitost 0..1. */
    set(o) { on = !!o.on; vol = Math.max(0, Math.min(1, o.vol)); apply(); },
    /** Pro testy: co hraje a jak nahlas. */
    state: () => ({ key: cur && cur.key, plan: plan().key, level: level(), unlocked, playing: !!cur && !cur.el.paused, time: cur ? cur.el.currentTime : 0 }),
  };
})();
