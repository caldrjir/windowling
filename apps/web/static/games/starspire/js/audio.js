'use strict';
// ── Procedurální zvuk: zvonkové efekty a ambientní hudba ────────────────────
const Sound = (() => {
  let ctx = null, sfxBus, musBus, rev, noiseBuf;
  const vol = { sfx: 0.7, music: 0.45 };
  const last = {};
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    musBus = ctx.createGain(); musBus.connect(comp);
    // jednoduchý dozvuk ze šumového impulzu
    rev = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    rev.buffer = ir;
    const rg = ctx.createGain(); rg.gain.value = 0.45; rev.connect(rg); rg.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply();
    if (mus.want) music(mus.want);
  }
  // Hudba Game Center (music.js): vlastní playlist nebo ticho ztlumí jen hudbu hry, zvuky zůstanou.
  const gm = () => (window.GCMusic && !window.GCMusic.gameMusic ? 0 : 1);
  if (window.GCMusic) window.GCMusic.on(() => apply());
  function apply() { if (ctx) { sfxBus.gain.value = vol.sfx * 0.8; musBus.gain.value = vol.music * 0.5 * gm(); } }
  function setVolume(k, v) { vol[k] = v; apply(); }
  const ok = (n, gap) => { if (!ctx) return false; const t = ctx.currentTime; if (last[n] !== undefined && t - last[n] < gap) return false; last[n] = t; return true; };
  const hz = s => 440 * Math.pow(2, s / 12);
  function tone(o) {
    const t0 = (o.at || ctx.currentTime) + (o.delay || 0);
    const osc = ctx.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t0 + (o.a || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    let n = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); n = f; }
    n.connect(g); g.connect(o.bus || sfxBus); if (o.rev) g.connect(rev);
    osc.start(t0); osc.stop(t0 + o.dur + 0.05);
  }
  function noise(o) {
    const t0 = (o.at || ctx.currentTime) + (o.delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t0); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur); f.Q.value = o.q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(o.vol || 0.1, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    s.connect(f); f.connect(g); g.connect(o.bus || sfxBus); if (o.rev) g.connect(rev);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + o.dur + 0.05);
  }
  const bell = (s, delay = 0, v = 0.05, dur = 1.2) => { tone({ f: hz(s), dur, vol: v, delay, rev: true }); tone({ f: hz(s) * 2.76, dur: dur * 0.4, vol: v * 0.25, delay, rev: true }); };
  const sfx = {
    hover() { if (ok('hover', 0.04)) tone({ f: 2400, dur: 0.04, vol: 0.012 }); },
    click() { tone({ type: 'triangle', f: 900, f2: 1300, dur: 0.06, vol: 0.04 }); },
    card() { if (ok('card', 0.05)) noise({ f: 2500, f2: 5000, dur: 0.12, vol: 0.05, q: 0.7 }); },
    draw() { if (ok('draw', 0.04)) noise({ f: 3500, dur: 0.05, vol: 0.02, q: 1.2 }); },
    hit(big) {
      if (!ok('hit', 0.05)) return;
      noise({ f: big ? 800 : 1400, f2: 200, dur: big ? 0.35 : 0.18, vol: big ? 0.2 : 0.13, q: 0.8 });
      tone({ type: 'sine', f: big ? 110 : 160, f2: 40, dur: 0.25, vol: big ? 0.2 : 0.1 });
    },
    block() { if (ok('block', 0.06)) { tone({ type: 'triangle', f: 1600, f2: 1200, dur: 0.18, vol: 0.05, rev: true }); noise({ f: 6000, dur: 0.1, vol: 0.03 }); } },
    blocked() { if (ok('blocked', 0.06)) { tone({ type: 'square', f: 300, f2: 200, dur: 0.1, vol: 0.04, lp: 1500 }); noise({ f: 3000, dur: 0.1, vol: 0.06 }); } },
    hurt() { if (ok('hurt', 0.08)) { tone({ type: 'sawtooth', f: 180, f2: 60, dur: 0.3, vol: 0.1, lp: 900 }); noise({ f: 500, dur: 0.25, vol: 0.12 }); } },
    buff() { [0, 4, 7].forEach((s, i) => tone({ type: 'triangle', f: hz(s + 3), dur: 0.25, vol: 0.04, delay: i * 0.05, rev: true })); },
    debuff() { [7, 3, 0].forEach((s, i) => tone({ type: 'triangle', f: hz(s - 5), dur: 0.25, vol: 0.04, delay: i * 0.05, rev: true })); },
    poison() { if (ok('poison', 0.1)) [0, 1, 2].forEach(i => tone({ f: rand(300, 600), f2: rand(700, 1000), dur: 0.08, vol: 0.03, delay: i * 0.05 })); },
    burn() { if (ok('burn', 0.1)) noise({ f: 900, f2: 3000, dur: 0.4, vol: 0.07, q: 0.6 }); },
    death() { noise({ f: 2000, f2: 200, dur: 0.9, vol: 0.1, rev: true }); [12, 7, 3, 0].forEach((s, i) => bell(s, i * 0.08, 0.03, 0.8)); },
    energy() { tone({ f: 600, f2: 1200, dur: 0.15, vol: 0.04 }); },
    error() { tone({ type: 'square', f: 180, dur: 0.12, vol: 0.04, lp: 900 }); },
    turn() { bell(7, 0, 0.04, 1); bell(14, 0.08, 0.03, 1); },
    gold() { [0, 7].forEach((s, i) => tone({ type: 'triangle', f: hz(s + 24), dur: 0.15, vol: 0.04, delay: i * 0.06 })); },
    relic() { [0, 4, 7, 11, 14].forEach((s, i) => bell(s, i * 0.07, 0.04)); },
    victory() { [0, 4, 7, 12, 16, 19].forEach((s, i) => bell(s, i * 0.09, 0.05, 1.6)); },
    defeat() { [0, -3, -7, -12].forEach((s, i) => bell(s - 5, i * 0.25, 0.05, 2)); },
    heal() { [0, 7, 12].forEach((s, i) => bell(s + 5, i * 0.06, 0.03)); },
    step() { bell(pick([0, 2, 4, 7, 9]) + 5, 0, 0.035, 0.9); },
    boss() { tone({ type: 'sawtooth', f: 55, dur: 2.5, vol: 0.12, lp: 400, a: 0.3, rev: true }); [0, 1, 0, -1].forEach((s, i) => bell(s - 12, i * 0.4, 0.05, 1.5)); },
    upgrade() { [0, 7, 12, 19].forEach((s, i) => bell(s, i * 0.05, 0.04)); noise({ f: 7000, dur: 0.4, vol: 0.02, ft: 'highpass' }); },
    start() { [0, 7, 12, 16, 19, 24].forEach((s, i) => bell(s - 5, i * 0.12, 0.04, 2)); },
  };
  // ── Ambientní hudba ──
  const SCALES = { menu: [0, 2, 4, 7, 9], map: [0, 2, 3, 7, 8], battle: [0, 3, 5, 7, 10], boss: [0, 1, 5, 6, 10] };
  const CHORDS = { menu: [[0, 7, 16], [-3, 4, 12], [-7, 0, 9], [-5, 2, 11]], map: [[0, 7, 15], [-4, 3, 12], [-2, 5, 14], [-5, 2, 10]], battle: [[0, 7, 15], [-2, 5, 14], [-4, 3, 12], [-5, 2, 10]], boss: [[0, 6, 15], [1, 8, 13], [-2, 5, 13], [-1, 6, 11]] };
  const mus = { on: false, mode: 'menu', want: null, next: 0, step: 0, timer: null };
  function music(mode) {
    mus.want = mode; mus.mode = mode;
    if (!ctx) return;
    if (!mus.on) { mus.on = true; mus.next = ctx.currentTime + 0.2; mus.timer = setInterval(tickMusic, 100); }
  }
  function tickMusic() {
    if (!ctx) return;
    const beat = mus.mode === 'battle' ? 0.42 : mus.mode === 'boss' ? 0.36 : 0.55;
    if (mus.next < ctx.currentTime - 0.1) mus.next = ctx.currentTime + 0.05;
    while (mus.next < ctx.currentTime + 0.3) {
      const st = mus.step % 16, bar = Math.floor(mus.step / 16) % 4;
      const ch = CHORDS[mus.mode][bar];
      if (st === 0) for (const s of ch) { tone({ at: mus.next, type: 'sine', f: hz(s - 12), dur: beat * 16, vol: 0.022, a: beat * 4, bus: musBus, rev: true }); tone({ at: mus.next, type: 'triangle', f: hz(s - 12) * 1.003, dur: beat * 16, vol: 0.012, a: beat * 5, bus: musBus }); }
      const sc = SCALES[mus.mode];
      if (Math.random() < (mus.mode === 'menu' ? 0.35 : 0.45) && st % 2 === 0) {
        const s = sc[(Math.random() * sc.length) | 0] + 12 * (Math.random() < 0.3 ? 1 : 0);
        tone({ at: mus.next, f: hz(s), dur: 1.4, vol: 0.022, bus: musBus, rev: true });
        tone({ at: mus.next, f: hz(s) * 2.76, dur: 0.5, vol: 0.005, bus: musBus, rev: true });
      }
      if ((mus.mode === 'battle' || mus.mode === 'boss') && st % 4 === 0) tone({ at: mus.next, type: 'sine', f: mus.mode === 'boss' ? 70 : 82, f2: 40, dur: 0.4, vol: 0.06, bus: musBus });
      if (mus.mode === 'boss' && st % 8 === 4) noise({ at: mus.next, f: 1800, dur: 0.12, vol: 0.03, bus: musBus });
      mus.next += beat; mus.step++;
    }
  }
  const play = new Proxy(sfx, { get: (o, k) => (...a) => { if (ctx && o[k]) o[k](...a); } });
  return { init, setVolume, play, music };
})();
