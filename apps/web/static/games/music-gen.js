'use strict';
// Windowling Game Center: the generated default playlists of the puzzle games (loaded by
// music.js). Every game gets its own playlist of four tracks, the same for everyone (seeded
// by the game id): lo-fi, ambient, piano, garden, space and chip styles, played by small
// Web Audio instruments. No files, nothing to license, nothing to load.
(function () {
  if (window.GCGen) return;
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const MODES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10] };
  const PROGS = [[0, 5, 3, 4], [1, 4, 0, 5], [0, 3, 5, 4], [5, 3, 0, 4], [0, 2, 3, 4], [3, 4, 2, 5], [0, 4, 5, 3], [1, 4, 0, 0]];
  // gain: every style at the same loudness (measured), as quiet as the action games' music,
  // below the games' sound effects
  const STYLES = {
    lofi: { bpm: [68, 84], modes: ['dorian', 'major', 'minor'], swing: 0.18, sev: true, gain: 0.048 },
    ambient: { bpm: [56, 66], modes: ['lydian', 'major', 'minor'], swing: 0, gain: 0.065 },
    piano: { bpm: [78, 96], modes: ['major', 'minor', 'mixo'], swing: 0.08, sev: true, gain: 0.053 },
    garden: { bpm: [96, 112], modes: ['major', 'mixo', 'lydian'], swing: 0.1, gain: 0.072 },
    space: { bpm: [60, 72], modes: ['minor', 'lydian', 'dorian'], swing: 0, gain: 0.058 },
    chip: { bpm: [104, 120], modes: ['major', 'minor', 'mixo'], swing: 0, gain: 0.084 },
  };
  // Which styles fit which game best (the rest of the playlist is drawn from all styles).
  const TASTE = {
    sudoku: ['piano', 'lofi'], nonogram: ['lofi', 'garden'], kakuro: ['piano', 'ambient'], souhvezdi: ['space', 'ambient'],
    pulsar: ['chip', 'space'], fuze: ['chip', 'garden'], miny: ['lofi', 'chip'], omalovanky: ['garden', 'ambient'],
    solitaire: ['lofi', 'piano'], mahjong: ['ambient', 'garden'], skladacka: ['garden', 'piano'], sachy: ['piano', 'ambient'], piskvorky: ['lofi', 'garden'],
  };
  const lang = () => { try { return localStorage.getItem('gamecenter.lang') === 'en' ? 1 : 0; } catch (e) { return 0; } };
  const ADJ = [['Tichá', 'Quiet'], ['Zlatá', 'Golden'], ['Noční', 'Night'], ['Ranní', 'Morning'], ['Modrá', 'Blue'], ['Hvězdná', 'Starry'], ['Mlžná', 'Misty'], ['Teplá', 'Warm'], ['Daleká', 'Distant'], ['Měkká', 'Soft'], ['Snová', 'Dreamy'], ['Křišťálová', 'Crystal']];
  const NOUN = [['zahrada', 'Garden'], ['řeka', 'River'], ['mlhovina', 'Nebula'], ['ulice', 'Street'], ['louka', 'Meadow'], ['laguna', 'Lagoon'], ['kometa', 'Comet'], ['knihovna', 'Library'], ['zátoka', 'Bay'], ['obloha', 'Sky'], ['krajina', 'Land'], ['chvíle', 'Moment']];

  function playlist(game) {
    const r = rng(hash(game || 'windowling'));
    const all = Object.keys(STYLES), taste = TASTE[game] || [];
    const styles = taste.slice();
    while (styles.length < 4) { const s = pick(r, all); if (!styles.includes(s)) styles.push(s); }
    return styles.map((style, i) => {
      const S = STYLES[style], a = pick(r, ADJ), n = pick(r, NOUN);
      return {
        style, seed: hash(`${game}:${i}`), names: [`${a[0]} ${n[0]}`, `${a[1]} ${n[1]}`],
        bpm: Math.round(S.bpm[0] + r() * (S.bpm[1] - S.bpm[0])), mode: pick(r, S.modes), root: 48 + Math.floor(r() * 10),
        prog: pick(r, PROGS), bars: style === 'ambient' || style === 'space' ? 32 : 48,
      };
    });
  }

  // ── Audio graph and instruments ──
  let ctx = null, out = null, wet = null, noise = null;
  function graph() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    out = ctx.createGain(); out.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    out.connect(comp); comp.connect(ctx.destination);
    const rev = ctx.createConvolver(), len = ctx.sampleRate * 2.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    rev.buffer = ir; wet = ctx.createGain(); wet.gain.value = 0.32; wet.connect(rev); rev.connect(out);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  function voice(t, dur, peak, attack, release, send, build) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + Math.max(attack, dur), release / 3);
    g.connect(out); if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(wet); }
    const end = t + Math.max(attack, dur) + release + 0.1;
    build(g, end);
  }
  const osc = (type, f, t, end, dest, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); return o; };
  const lp = (f, q = 0.7) => { const x = ctx.createBiquadFilter(); x.type = 'lowpass'; x.frequency.value = f; x.Q.value = q; return x; };
  const I = {
    pad(m, t, dur, v = 0.05) { voice(t, dur, v, 1.2, 1.8, 0.9, (g, end) => { const f = lp(1100); f.connect(g); osc('sawtooth', mtof(m), t, end, f, -7); osc('triangle', mtof(m), t, end, f, 6); }); },
    keys(m, t, dur, v = 0.07) { voice(t, Math.min(dur, 0.25), v, 0.006, 1.4, 0.45, (g, end) => { const f = lp(2400); f.connect(g); osc('sine', mtof(m), t, end, f); const h = ctx.createGain(); h.gain.value = 0.18; h.connect(f); osc('triangle', mtof(m) * 2, t, end, h); }); },
    pluck(m, t, v = 0.06) { voice(t, 0.02, v, 0.004, 0.5, 0.35, (g, end) => { const f = lp(1800); f.connect(g); osc('triangle', mtof(m), t, end, f); }); },
    bell(m, t, v = 0.035) { voice(t, 0.05, v, 0.004, 2.6, 1, (g, end) => { osc('sine', mtof(m), t, end, g); const h = ctx.createGain(); h.gain.value = 0.3; h.connect(g); osc('sine', mtof(m) * 2.76, t, end, h); }); },
    chip(m, t, v = 0.03) { voice(t, 0.05, v, 0.003, 0.18, 0.2, (g, end) => { const f = lp(3000); f.connect(g); osc('square', mtof(m), t, end, f); }); },
    bass(m, t, dur, v = 0.12) { voice(t, dur, v, 0.01, 0.25, 0, (g, end) => { const f = lp(420); f.connect(g); osc('sine', mtof(m), t, end, f); osc('triangle', mtof(m), t, end, f); }); },
    kick(t, v = 0.32) { const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); g.connect(out); const o = osc('sine', 110, t, t + 0.4, g); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); },
    hit(t, freq, type, len, v) { const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.05); },
    snare(t, v = 0.08) { I.hit(t, 1700, 'bandpass', 0.16, v); },
    hat(t, v = 0.025) { I.hit(t, 7500, 'highpass', 0.04, v); },
  };

  // ── A track: chords, bass, melody motifs and drums, in 8-bar sections ──
  function compose(tr) {
    const r = rng(tr.seed), sc = MODES[tr.mode];
    const deg = (d, oct = 0) => { const n = sc.length, o = Math.floor(d / n); return tr.root + 12 * (oct + o) + sc[((d % n) + n) % n]; };
    const chord = (d, size) => Array.from({ length: size }, (_, k) => deg(d + 2 * k));
    const motif = () => Array.from({ length: 16 }, () => (r() < 0.42 ? Math.floor(r() * 7) + (r() < 0.3 ? 7 : 0) : null));
    const motifs = [motif(), motif(), motif()];
    // per section: [drums, melody motif or -1, arp]
    const plan = Array.from({ length: Math.ceil(tr.bars / 8) }, (_, i) => ({ drums: i > 0 && i % 4 !== 3, mel: i === 0 ? -1 : i % 3, arp: r() < 0.6 }));
    return { deg, chord, motifs, plan, r };
  }
  function bar(tr, c, b, t0) {
    const spb = 60 / tr.bpm, six = spb / 4, sw = STYLES[tr.style].swing;
    const at = s => t0 + s * six + (s % 2 ? sw * six : 0);
    const sec = c.plan[Math.floor(b / 8) % c.plan.length], d = tr.prog[b % 4], size = STYLES[tr.style].sev ? 4 : 3;
    const ch = c.chord(d, size), barLen = spb * 4;
    const mel = sec.mel >= 0 ? c.motifs[sec.mel] : null;
    const melody = (fn, oct) => { if (!mel) return; mel.forEach((n, s) => { if (n !== null && (b % 2 || s < 12)) fn(c.deg(d + n, oct), at(s)); }); };
    switch (tr.style) {
      case 'lofi':
        ch.forEach(m => I.keys(m, at(0), barLen * 0.5, 0.05)); if (b % 2) ch.forEach(m => I.keys(m + 12 * (m < tr.root + 6), at(10), spb, 0.035));
        I.bass(c.deg(d, -1), at(0), spb * 1.5); I.bass(c.deg(d + 4, -1), at(10), spb * 0.8, 0.09);
        if (sec.drums) { I.kick(at(0)); I.kick(at(7), 0.22); I.snare(at(4)); I.snare(at(12)); for (let s = 0; s < 16; s += 2) I.hat(at(s), s % 4 ? 0.018 : 0.028); }
        melody((m, t) => I.keys(m, t, 0.2, 0.045), 1);
        break;
      case 'ambient':
        if (b % 2 === 0) ch.forEach(m => I.pad(m, t0, barLen * 2, 0.035));
        I.bass(c.deg(d, -1), t0, barLen * 0.9, 0.06);
        for (let s = 0; s < 16; s += 4) if (c.r() < 0.35) I.bell(c.deg(d + Math.floor(c.r() * 7), 1), at(s));
        break;
      case 'piano':
        I.bass(c.deg(d, -1), at(0), barLen * 0.9, 0.08);
        for (let s = 0; s < 16; s += 2) I.keys(ch[[0, 1, 2, 1, 3 % size, 2, 1, 2][s / 2] % size] + (s >= 8 ? 12 : 0), at(s), spb * 0.6, 0.045);
        melody((m, t) => I.keys(m, t, 0.3, 0.055), 1);
        break;
      case 'garden':
        I.bass(c.deg(d, -1), at(0), spb, 0.09); I.bass(c.deg(d, -1), at(8), spb, 0.07);
        [0, 3, 6, 8, 11, 14].forEach((s, k) => I.pluck(ch[k % size] + 12, at(s), 0.05));
        if (sec.drums) { I.kick(at(0), 0.2); I.kick(at(8), 0.16); for (let s = 2; s < 16; s += 4) I.hat(at(s), 0.03); }
        melody((m, t) => I.bell(m, t, 0.03), 1);
        break;
      case 'space':
        if (b % 2 === 0) ch.forEach(m => I.pad(m, t0, barLen * 2, 0.03));
        if (sec.arp) for (let s = 0; s < 16; s += 2) I.pluck(ch[(s / 2) % size] + 12 + (s >= 8 ? 7 : 0), at(s), 0.03);
        I.bass(c.deg(d, -2), t0, barLen * 0.95, 0.07);
        melody((m, t) => I.bell(m, t, 0.025), 1);
        break;
      case 'chip':
        I.bass(c.deg(d, -1), at(0), spb * 0.4, 0.08); I.bass(c.deg(d, -1), at(6), spb * 0.4, 0.07); I.bass(c.deg(d + 4, -1), at(8), spb * 0.4, 0.07); I.bass(c.deg(d, -1), at(12), spb * 0.4, 0.07);
        for (let s = 0; s < 16; s++) if (s % 2 === 0 || sec.arp) I.chip(ch[s % size] + 12, at(s), 0.018);
        if (sec.drums) { I.kick(at(0), 0.22); I.kick(at(8), 0.18); I.snare(at(4), 0.05); I.snare(at(12), 0.05); }
        melody((m, t) => I.chip(m, t, 0.03), 1);
        break;
    }
  }

  // ── Player ──
  let list = [], idx = 0, barNo = 0, comp = null, next = 0, timer = 0, playing = false, vol = 0.7;
  const fns = [];
  const emit = () => { for (const f of fns) f(); };
  function load(i, startBar) { idx = ((i % list.length) + list.length) % list.length; comp = compose(list[idx]); barNo = startBar || 0; if (ctx && playing) out.gain.setTargetAtTime(level(), ctx.currentTime, 0.3); emit(); }
  function tick() {
    while (next < ctx.currentTime + 0.6) {
      const tr = list[idx];
      if (barNo >= tr.bars) { load(idx + 1, 0); next += 0.8; continue; }
      bar(tr, comp, barNo, next);
      next += (60 / tr.bpm) * 4; barNo++;
    }
  }
  const level = () => (playing ? vol * 0.86 * STYLES[list[idx].style].gain : 0);
  window.GCGen = {
    setup(game, pos) { list = playlist(game); load(pos && pos.i || 0, pos && pos.t || 0); },
    play() {
      graph();
      if (ctx.state === 'suspended') ctx.resume();
      if (playing) return;
      playing = true;
      out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(level(), ctx.currentTime, 0.4);
      next = ctx.currentTime + 0.1; clearInterval(timer); timer = setInterval(tick, 150); tick(); emit();
    },
    pause() {
      if (!playing) return;
      playing = false; clearInterval(timer); timer = 0;
      if (ctx) out.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      emit();
    },
    next() { const was = playing; if (was) GCGen.pause(); load(idx + 1, 0); if (was) setTimeout(() => GCGen.play(), 250); },
    volume(v) { vol = v / 100; if (ctx && playing) out.gain.setTargetAtTime(level(), ctx.currentTime, 0.1); },
    get playing() { return playing; },
    get track() { const t = list[idx]; return t ? t.names[lang()] : ''; },
    get pos() { return { i: idx, t: barNo }; },
    get tracks() { return list.map(t => t.names[lang()]); },
    on(fn) { fns.push(fn); },
    _playlist: playlist,
    // tests: play one track of a style
    _style(style) { const t = playlist('x')[0]; Object.assign(t, { style, bpm: STYLES[style].bpm[0], bars: 64 }); list = [t]; load(0, 0); },
  };
  // A hidden tab stays quiet (and costs nothing).
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (playing) ctx.resume(); });
})();
