'use strict';
// ── Procedurální zvuk: ambient ostrova a efekty ─────────────────────────────
const Sound = (() => {
  let ctx = null, sfx, amb, mus, rev, noise, brown;
  const vol = { sfx: 0.7, music: 0.5 };
  const last = {};
  const beds = {};
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(comp);
    amb = ctx.createGain(); amb.connect(comp);
    mus = ctx.createGain(); mus.connect(comp);
    rev = ctx.createConvolver();
    const len = ctx.sampleRate * 2.5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = 0.4; rev.connect(rg); rg.connect(comp);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    brown = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const bd = brown.getChannelData(0); let l = 0; for (let i = 0; i < bd.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = l * 3.5; }
    // ambientní vrstvy
    const bed = (name, buf, type, f, q) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(fl); fl.connect(g); g.connect(amb); s.start();
      beds[name] = { g, fl };
    };
    bed('wind', brown, 'lowpass', 500, 0.7);
    bed('ocean', brown, 'lowpass', 900, 0.5);
    bed('fire', noise, 'highpass', 2500, 0.7);
    bed('water', noise, 'lowpass', 400, 1);
    apply();
    setInterval(tickAmbient, 120);
  }
  // Hudba Game Center (music.js): vlastní playlist nebo ticho ztlumí jen hudbu hry, zvuky zůstanou.
  // Společná hlasitost hudby (GCMusic.level) a vyrovnání na stejnou hlasitost jako ostatní hry (1.41×).
  const gm = () => (!window.GCMusic ? 1 : window.GCMusic.gameMusic ? window.GCMusic.level * 1.41 : 0);
  if (window.GCMusic) window.GCMusic.on(() => apply());
  function apply() { if (ctx) { sfx.gain.value = vol.sfx * 0.9; amb.gain.value = vol.sfx * 0.6; mus.gain.value = vol.music * 0.5 * gm(); } }
  function setVolume(k, v) { vol[k] = v; apply(); }
  const ok = (n, g) => { if (!ctx) return false; const t = ctx.currentTime; if (last[n] !== undefined && t - last[n] < g) return false; last[n] = t; return true; };
  function tone(o) {
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.glide || o.dur));
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t0 + (o.a || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    let n = osc; if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); n = f; }
    n.connect(g); g.connect(o.bus || sfx); if (o.rev) g.connect(rev);
    osc.start(t0); osc.stop(t0 + o.dur + 0.05);
    return osc;
  }
  function nz(o) {
    const t0 = ctx.currentTime + (o.delay || 0);
    const s = ctx.createBufferSource(); s.buffer = o.brown ? brown : noise;
    const f = ctx.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t0); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur); f.Q.value = o.q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(o.vol || 0.1, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    s.connect(f); f.connect(g); g.connect(o.bus || sfx); if (o.rev) g.connect(rev);
    s.start(t0, Math.random()); s.stop(t0 + o.dur + 0.05);
  }
  const S = {
    step() { if (ok('step', 0.2)) nz({ f: rand(300, 500), dur: 0.12, vol: 0.12, q: 0.8, brown: true }); },
    splash() { if (ok('step', 0.2)) nz({ f: 1200, f2: 400, dur: 0.25, vol: 0.12, q: 0.6 }); },
    swim() { if (ok('swim', 0.4)) nz({ f: 800, f2: 300, dur: 0.5, vol: 0.12, q: 0.5 }); },
    jump() { nz({ f: 400, dur: 0.1, vol: 0.08, brown: true }); },
    swing() { if (ok('swing', 0.15)) nz({ f: 600, f2: 2400, dur: 0.18, vol: 0.06, q: 1.2 }); },
    // dřevo: tupé „tok“ – rezonance kmene, úder ostří a třísky
    chop() {
      const k = rand(0.9, 1.12);
      tone({ f: 190 * k, f2: 120 * k, dur: 0.16, vol: 0.32, a: 0.002 });
      tone({ type: 'triangle', f: 410 * k, f2: 300 * k, dur: 0.09, vol: 0.12, a: 0.002 });
      nz({ f: 750 * k, dur: 0.07, vol: 0.4, q: 2.2 });
      nz({ f: 2600, dur: 0.035, vol: 0.12, q: 1.5, ft: 'highpass' });
      for (let i = 0; i < 2; i++) nz({ f: rand(3000, 5000), dur: 0.02, vol: 0.05, q: 3, delay: 0.05 + i * rand(0.03, 0.07) });
    },
    knock() { tone({ f: 170 * rand(0.9, 1.1), f2: 110, dur: 0.12, vol: 0.22, a: 0.003 }); nz({ f: 500, dur: 0.06, vol: 0.2, q: 1.5 }); },
    // kámen: kovově-kamenné „cink“ s neharmonickými složkami, drť a odletující úlomky
    mine() {
      const k = rand(0.92, 1.08);
      for (const [f, v, d] of [[1150, 0.07, 0.22], [2730, 0.05, 0.16], [4210, 0.03, 0.1], [5890, 0.02, 0.07]]) tone({ f: f * k, dur: d, vol: v, a: 0.001, rev: true });
      nz({ f: 2400, dur: 0.06, vol: 0.32, q: 1.2 });
      tone({ f: 110, f2: 70, dur: 0.1, vol: 0.18, a: 0.002 });
      for (let i = 0; i < 3; i++) nz({ f: rand(2500, 6000), dur: 0.025, vol: 0.06, q: 4, delay: 0.08 + i * rand(0.04, 0.09) });
    },
    mineOre() {
      const k = rand(0.95, 1.05);
      for (const [f, v, d] of [[1650, 0.08, 0.35], [3920, 0.05, 0.25], [6230, 0.03, 0.15]]) tone({ f: f * k, dur: d, vol: v, a: 0.001, rev: true });
      nz({ f: 2800, dur: 0.06, vol: 0.3, q: 1.2 });
      for (let i = 0; i < 3; i++) nz({ f: rand(3000, 6500), dur: 0.025, vol: 0.06, q: 4, delay: 0.08 + i * rand(0.04, 0.09) });
    },
    knockStone() { tone({ f: 140, f2: 90, dur: 0.08, vol: 0.2 }); nz({ f: 1600, dur: 0.05, vol: 0.18, q: 1.5 }); },
    thud() { nz({ f: 200, dur: 0.15, vol: 0.2, brown: true }); },
    // pád stromu: praskání vláken, vrzání, šum listí a dunivý dopad
    fall() {
      for (let i = 0; i < 7; i++) nz({ f: rand(1500, 4000), dur: 0.03, vol: 0.1, q: 3, delay: i * rand(0.04, 0.09) });
      const o = tone({ type: 'sawtooth', f: 95, f2: 55, glide: 0.9, dur: 1.0, vol: 0.06, lp: 600, a: 0.05, delay: 0.2 });
      nz({ f: 3500, f2: 1500, dur: 1.2, vol: 0.12, q: 0.5, delay: 0.5 });
      tone({ f: 70, f2: 35, dur: 0.6, vol: 0.4, delay: 1.25 });
      nz({ f: 300, f2: 120, dur: 0.6, vol: 0.45, brown: true, ft: 'lowpass', delay: 1.25 });
    },
    // rozpad skály: hromada kamínků a hluboké zadunění
    crumble() {
      tone({ f: 85, f2: 45, dur: 0.5, vol: 0.3 });
      nz({ f: 500, f2: 200, dur: 0.5, vol: 0.35, brown: true, ft: 'lowpass' });
      for (let i = 0; i < 10; i++) { nz({ f: rand(1500, 4500), dur: rand(0.02, 0.05), vol: rand(0.05, 0.12), q: 3, delay: 0.05 + i * rand(0.03, 0.07) }); }
    },
    hit() { nz({ f: 400, f2: 150, dur: 0.15, vol: 0.3, brown: true }); },
    kill() { nz({ f: 300, f2: 80, dur: 0.5, vol: 0.25, brown: true }); },
    pick() { tone({ type: 'triangle', f: 700, f2: 1100, dur: 0.1, vol: 0.06 }); nz({ f: 3000, dur: 0.06, vol: 0.05 }); },
    eat() { for (let i = 0; i < 3; i++) nz({ f: rand(1500, 3000), dur: 0.07, vol: 0.12, q: 2, delay: i * 0.13 }); },
    drink() { for (let i = 0; i < 3; i++) tone({ f: 300 + i * 40, f2: 180, dur: 0.12, vol: 0.12, delay: i * 0.22, lp: 900 }); },
    build() { for (let i = 0; i < 3; i++) { nz({ f: 500, dur: 0.1, vol: 0.3, delay: i * 0.15, brown: true }); tone({ type: 'triangle', f: 900, dur: 0.08, vol: 0.05, delay: i * 0.15 }); } },
    craft() { nz({ f: 1800, f2: 600, dur: 0.3, vol: 0.08, q: 1 }); [0, 4, 7].forEach((s, i) => tone({ type: 'triangle', f: 523 * 2 ** (s / 12), dur: 0.2, vol: 0.05, delay: 0.1 + i * 0.06 })); },
    break() { nz({ f: 2000, f2: 400, dur: 0.3, vol: 0.2, q: 2 }); tone({ type: 'square', f: 300, f2: 120, dur: 0.2, vol: 0.04, lp: 1200 }); },
    hurt() { if (ok('hurt', 0.3)) { tone({ type: 'sawtooth', f: 200, f2: 90, dur: 0.25, vol: 0.1, lp: 800 }); nz({ f: 500, dur: 0.2, vol: 0.2, brown: true }); } },
    error() { tone({ type: 'square', f: 180, dur: 0.1, vol: 0.04, lp: 800 }); },
    ui() { tone({ type: 'triangle', f: 900, f2: 1200, dur: 0.05, vol: 0.03 }); },
    howl() { const o = tone({ f: 380, f2: 620, glide: 0.8, dur: 2.6, vol: 0.06, a: 0.3, rev: true, lp: 1800 }); },
    growl() { if (ok('growl', 1)) tone({ type: 'sawtooth', f: 90, f2: 70, dur: 0.6, vol: 0.08, lp: 400, a: 0.05 }); },
    sleep() { [0, 4, 7, 12].forEach((s, i) => tone({ f: 330 * 2 ** (s / 12), dur: 1.5, vol: 0.05, delay: i * 0.25, rev: true })); },
    victory() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone({ type: 'triangle', f: 262 * 2 ** (s / 12), dur: 1.6, vol: 0.06, delay: i * 0.15, rev: true })); },
    death() { [0, -3, -7, -12].forEach((s, i) => tone({ f: 330 * 2 ** (s / 12), dur: 2, vol: 0.06, delay: i * 0.35, rev: true })); },
    achieve() { [0, 7, 12].forEach((s, i) => tone({ type: 'triangle', f: 660 * 2 ** (s / 12), dur: 0.4, vol: 0.05, delay: i * 0.08, rev: true })); },
  };
  // ── Ambient ──
  const A = { wind: 0, ocean: 0, fire: 0, water: 0, birds: 0, crickets: 0, under: 0, night: 0 };
  function ambience(o) { Object.assign(A, o); }
  let musT = 20;
  function tickAmbient() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const set = (n, v) => beds[n].g.gain.setTargetAtTime(v, t, 0.6);
    set('wind', 0.06 + A.wind * 0.12);
    set('ocean', A.ocean * 0.35 * (0.6 + 0.4 * Math.sin(t * 0.5)));
    set('fire', A.fire * 0.05 * (0.5 + Math.random()));
    set('water', A.under * 0.4);
    beds.wind.fl.frequency.setTargetAtTime(400 + 300 * Math.sin(t * 0.13), t, 1);
    // ptáci a cvrčci
    if (A.birds > 0.3 && Math.random() < 0.06 * A.birds) {
      const f = rand(2200, 4200), n = randi(2, 5);
      for (let i = 0; i < n; i++) tone({ f, f2: f * rand(1.1, 1.5), dur: 0.08, vol: 0.02 * A.birds, delay: i * 0.11, bus: amb, rev: true });
    }
    if (A.crickets > 0.3 && Math.random() < 0.25) for (let i = 0; i < 3; i++) tone({ type: 'square', f: 4300, dur: 0.03, vol: 0.006 * A.crickets, delay: i * 0.05, bus: amb, lp: 6000 });
    if (A.fire > 0.2 && Math.random() < 0.3 * A.fire) nz({ f: rand(2000, 5000), dur: 0.02, vol: 0.05 * A.fire, q: 4, bus: amb });
    // jemná hudba – občasné akordy
    musT -= 0.12;
    if (musT <= 0) {
      musT = rand(25, 55);
      const roots = A.night > 0.5 ? [-5, -9, -2] : [0, 5, 7, -3];
      const r = pick(roots);
      const chord = A.night > 0.5 ? [0, 3, 7, 10] : [0, 4, 7, 11];
      chord.forEach((s, i) => tone({ f: 220 * 2 ** ((r + s) / 12), dur: 6, vol: 0.025, a: 1.5, delay: i * 0.4, bus: mus, rev: true }));
      for (let i = 0; i < 5; i++) tone({ f: 440 * 2 ** ((r + pick(chord) + 12 * (i % 2)) / 12), dur: 2.5, vol: 0.018, delay: 2 + i * 0.7, bus: mus, rev: true });
    }
  }
  const play = new Proxy(S, { get: (o, k) => (...a) => { if (ctx && o[k]) o[k](...a); } });
  return { init, setVolume, play, ambience, get ready() { return !!ctx; } };
})();
