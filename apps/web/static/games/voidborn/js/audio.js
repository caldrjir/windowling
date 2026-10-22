'use strict';
// ── Procedurální zvuk: efekty i hudba se syntetizují za běhu přes WebAudio ──
const Sound = (() => {
  let ctx = null, master, sfxBus, musBus, musFilter, delayIn, noiseBuf;
  const vol = { sfx: 0.7, music: 0.45 };
  const last = {};

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musFilter = ctx.createBiquadFilter(); musFilter.type = 'lowpass'; musFilter.frequency.value = 18000;
    musBus = ctx.createGain(); musBus.connect(musFilter); musFilter.connect(master);
    // ozvěna pro arpeggio
    delayIn = ctx.createGain(); delayIn.gain.value = 0.5;
    const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dlf = ctx.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 2600;
    delayIn.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(musBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVol();
    if (mus.wanted) startMusic(mus.wanted);
  }
  function applyVol() { if (!ctx) return; sfxBus.gain.value = vol.sfx * 0.8; musBus.gain.value = vol.music * 0.55; }
  function setVolume(k, v) { vol[k] = v; applyVol(); }
  function ok(name, gap) {
    if (!ctx) return false;
    const t = ctx.currentTime;
    if (last[name] !== undefined && t - last[name] < gap) return false;
    last[name] = t; return true;
  }

  function tone(o) {
    const t0 = (o.at || ctx.currentTime) + (o.delay || 0);
    const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.detune) osc.detune.value = o.detune;
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + o.dur);
    const g = ctx.createGain(); const v = o.vol || 0.1; const a = o.a || 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(a + 0.01, o.dur));
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus || sfxBus);
    if (o.send) g.connect(delayIn);
    osc.start(t0); osc.stop(t0 + o.dur + 0.05);
  }
  function noise(o) {
    const t0 = (o.at || ctx.currentTime) + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.ft || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol || 0.1, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + o.dur + 0.05);
  }
  const semi = s => 440 * Math.pow(2, s / 12);

  const sfx = {
    shoot() { if (ok('shoot', 0.07)) tone({ type: 'triangle', f: 1300, f2: 520, dur: 0.07, vol: 0.03 }); },
    hit() { if (ok('hit', 0.045)) noise({ f: 3200, dur: 0.04, vol: 0.045, q: 2 }); },
    kill() {
      if (!ok('kill', 0.035)) return;
      noise({ f: 1000, f2: 180, dur: 0.14, vol: 0.08, q: 1.4 });
      tone({ type: 'square', f: 240, f2: 60, dur: 0.1, vol: 0.025, lp: 1400 });
    },
    gem(n) {
      if (!ok('gem', 0.028)) return;
      const f = 560 * Math.pow(2, Math.min(n, 24) / 12);
      tone({ type: 'sine', f, dur: 0.1, vol: 0.055 });
      tone({ type: 'triangle', f: f * 2, dur: 0.05, vol: 0.018 });
    },
    shard() { tone({ type: 'sine', f: 1568, dur: 0.16, vol: 0.06 }); tone({ type: 'sine', f: 2349, dur: 0.22, vol: 0.05, delay: 0.06 }); },
    hurt() {
      if (!ok('hurt', 0.12)) return;
      tone({ type: 'sawtooth', f: 220, f2: 55, dur: 0.28, vol: 0.12, lp: 900 });
      noise({ f: 500, dur: 0.22, vol: 0.1 });
    },
    dash() { noise({ f: 700, f2: 3400, dur: 0.2, vol: 0.08, q: 0.8 }); tone({ type: 'sine', f: 300, f2: 900, dur: 0.15, vol: 0.04 }); },
    levelup() { [0, 4, 7, 12, 16, 19].forEach((s, i) => tone({ type: 'square', f: semi(s + 3), dur: 0.2, vol: 0.045, delay: i * 0.055, lp: 3200 })); },
    select() { tone({ type: 'triangle', f: 660, f2: 1320, dur: 0.14, vol: 0.08 }); tone({ type: 'sine', f: 1320, dur: 0.2, vol: 0.04, delay: 0.07 }); },
    hover() { if (ok('hover', 0.04)) tone({ type: 'sine', f: 1900, dur: 0.035, vol: 0.018 }); },
    click() { tone({ type: 'square', f: 520, f2: 960, dur: 0.05, vol: 0.035, lp: 2600 }); },
    back() { tone({ type: 'square', f: 700, f2: 380, dur: 0.06, vol: 0.03, lp: 2200 }); },
    error() { tone({ type: 'square', f: 160, dur: 0.14, vol: 0.05, lp: 900 }); tone({ type: 'square', f: 120, dur: 0.14, vol: 0.05, lp: 900, delay: 0.1 }); },
    buy() { [0, 7, 12].forEach((s, i) => tone({ type: 'triangle', f: semi(s + 7), dur: 0.16, vol: 0.06, delay: i * 0.05 })); noise({ f: 6000, dur: 0.25, vol: 0.02, ft: 'highpass' }); },
    explode() {
      if (!ok('explode', 0.07)) return;
      noise({ f: 700, f2: 60, dur: 0.45, vol: 0.16, q: 0.8, ft: 'lowpass' });
      tone({ type: 'sine', f: 130, f2: 30, dur: 0.35, vol: 0.13 });
    },
    zap() { if (!ok('zap', 0.07)) return; noise({ f: 5200, f2: 1400, dur: 0.12, vol: 0.055, q: 4 }); tone({ type: 'sawtooth', f: 1500, f2: 300, dur: 0.1, vol: 0.025, lp: 5000 }); },
    laser() { if (!ok('laser', 0.09)) return; tone({ type: 'sawtooth', f: 1900, f2: 180, dur: 0.28, vol: 0.045, lp: 4200 }); tone({ type: 'sine', f: 90, dur: 0.2, vol: 0.06 }); },
    nova() { if (!ok('nova', 0.12)) return; tone({ type: 'sine', f: 320, f2: 55, dur: 0.5, vol: 0.11 }); noise({ f: 2400, f2: 200, dur: 0.4, vol: 0.045 }); },
    missile() { if (ok('missile', 0.09)) noise({ f: 1300, f2: 400, dur: 0.15, vol: 0.035 }); },
    mine() { if (ok('mine', 0.1)) tone({ type: 'square', f: 900, dur: 0.04, vol: 0.02, lp: 2000 }); },
    blade() { if (ok('blade', 0.09)) noise({ f: 4500, f2: 2500, dur: 0.06, vol: 0.03, q: 3 }); },
    eshoot() { if (ok('eshoot', 0.09)) tone({ type: 'square', f: 320, f2: 210, dur: 0.06, vol: 0.022, lp: 1500 }); },
    warning() { for (let i = 0; i < 3; i++) tone({ type: 'sawtooth', f: 330, f2: 660, dur: 0.45, vol: 0.07, delay: i * 0.65, lp: 1800 }); },
    bossdie() {
      noise({ f: 500, f2: 40, dur: 1.8, vol: 0.25, ft: 'lowpass' });
      tone({ type: 'sine', f: 90, f2: 20, dur: 1.6, vol: 0.2 });
      [0, 3, 7, 12, 15].forEach((s, i) => tone({ type: 'triangle', f: semi(s - 2), dur: 0.6, vol: 0.05, delay: 0.5 + i * 0.1 }));
    },
    chest() { [0, 4, 7, 11, 14, 19].forEach((s, i) => tone({ type: 'triangle', f: semi(s + 3), dur: 0.32, vol: 0.055, delay: i * 0.07 })); },
    evolve() {
      [0, 7, 12, 16, 19, 24].forEach((s, i) => tone({ type: 'sawtooth', f: semi(s - 9), dur: 0.7, vol: 0.035, delay: i * 0.09, lp: 3200 }));
      noise({ f: 7000, dur: 1.2, vol: 0.03, q: 0.5, ft: 'highpass' });
    },
    achieve() { [0, 4, 7, 12].forEach((s, i) => tone({ type: 'sine', f: semi(s + 10), dur: 0.28, vol: 0.055, delay: i * 0.08 })); },
    heal() { tone({ type: 'sine', f: 440, f2: 880, dur: 0.3, vol: 0.07 }); tone({ type: 'sine', f: 660, f2: 1320, dur: 0.3, vol: 0.04, delay: 0.08 }); },
    bomb() { noise({ f: 300, f2: 30, dur: 1.0, vol: 0.25, ft: 'lowpass' }); tone({ type: 'sine', f: 100, f2: 25, dur: 0.9, vol: 0.2 }); },
    die() { tone({ type: 'sawtooth', f: 320, f2: 28, dur: 1.6, vol: 0.14, lp: 1100 }); noise({ f: 300, f2: 40, dur: 1.4, vol: 0.15, ft: 'lowpass' }); },
    revive() { [12, 7, 4, 0, 12, 19, 24].forEach((s, i) => tone({ type: 'triangle', f: semi(s), dur: 0.3, vol: 0.06, delay: i * 0.07 })); },
    start() { tone({ type: 'sawtooth', f: 110, f2: 880, dur: 0.8, vol: 0.06, lp: 2400 }); noise({ f: 300, f2: 6000, dur: 0.8, vol: 0.05 }); },
  };

  // ── Generativní synthwave ─────────────────────────────────────────────────
  const PROG = {
    menu: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
    game: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]],
    boss: [[0, 3, 7], [1, 5, 8], [-2, 2, 5], [-1, 3, 6]],
  };
  const BPM = { menu: 92, game: 112, boss: 128 };
  const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 0, 2, 1, 3, 2, 1, 2, 3];
  const mus = { on: false, mode: 'menu', wanted: null, step: 0, next: 0, timer: null, level: 0 };

  function note(s, t, dur, type, v, lp, send) {
    tone({ at: t, type, f: semi(s), dur, vol: v, lp, a: 0.01, bus: musBus, send });
  }
  function kick(t) { tone({ at: t, type: 'sine', f: 160, f2: 38, dur: 0.22, vol: 0.32, bus: musBus }); }
  function snare(t) { noise({ at: t, f: 1900, dur: 0.16, vol: 0.09, q: 0.9, bus: musBus }); tone({ at: t, type: 'triangle', f: 200, f2: 120, dur: 0.08, vol: 0.05, bus: musBus }); }
  function hat(t, v) { noise({ at: t, f: 9000, dur: 0.04, vol: v, ft: 'highpass', bus: musBus }); }
  function pad(ch, t, len) {
    for (const s of ch) for (const det of [-9, 9]) {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = semi(s - 12); osc.detune.value = det;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = mus.mode === 'boss' ? 1400 : 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012, t + len * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len * 1.02);
      osc.connect(f); f.connect(g); g.connect(musBus);
      osc.start(t); osc.stop(t + len * 1.05);
    }
  }
  function playStep(s, t, spb) {
    const P = PROG[mus.mode]; const bar = Math.floor(s / 16) % 4, st = s % 16; const ch = P[bar];
    if (st === 0) pad(ch, t, spb * 16);
    const i = ARP[st]; const n = ch[i % 3] + (i === 3 ? 12 : 0) + 12;
    if (mus.mode === 'menu') { if (st % 2 === 0) note(n, t, spb * 1.6, 'triangle', 0.03, 2400, true); return; }
    note(n, t, spb * 0.8, 'square', 0.018 + mus.level * 0.002, 1800 + mus.level * 400, true);
    if (st % 2 === 0) note(ch[0] - 24 + (st % 8 === 6 ? 12 : 0), t, spb * 1.7, 'sawtooth', 0.06, 520 + mus.level * 60);
    if (st % 4 === 0) kick(t);
    if (st % 4 === 2) hat(t, 0.028);
    if (mus.mode === 'boss') { if (st % 2 === 1) hat(t, 0.014); if (st === 4 || st === 12) snare(t); }
    else if (mus.level >= 1 && (st === 4 || st === 12)) snare(t);
    else if (mus.level >= 2 && st % 2 === 1) hat(t, 0.01);
  }
  function tick() {
    if (!ctx || !mus.on) return;
    const spb = 60 / BPM[mus.mode] / 4;
    if (mus.next < ctx.currentTime - 0.05) mus.next = ctx.currentTime + 0.05;
    while (mus.next < ctx.currentTime + 0.15) { playStep(mus.step, mus.next, spb); mus.next += spb; mus.step++; }
  }
  function startMusic(mode) {
    mus.wanted = mode;
    if (!ctx) return;
    if (mus.mode !== mode) { mus.mode = mode; mus.step = Math.floor(mus.step / 16) * 16 + 16; }
    if (!mus.on) { mus.on = true; mus.next = ctx.currentTime + 0.1; mus.timer = setInterval(tick, 25); }
  }
  function stopMusic() { mus.on = false; mus.wanted = null; if (mus.timer) clearInterval(mus.timer); mus.timer = null; }
  function muffle(on) { if (ctx) musFilter.frequency.setTargetAtTime(on ? 700 : 18000, ctx.currentTime, 0.15); }
  function setLevel(l) { mus.level = l; }

  // Obal: zvuky jsou tiché, dokud není audio inicializováno gestem
  const play = new Proxy(sfx, { get: (o, k) => (...a) => { if (ctx && o[k]) o[k](...a); } });
  return { init, setVolume, play, music: startMusic, stopMusic, muffle, setLevel, get ready() { return !!ctx; } };
})();
