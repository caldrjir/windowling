'use strict';
// ── VĚKY VÁLEK · hudba ──────────────────────────────────────────────────────
// Vlastní hrdinský pochod v d moll, celý z Web Audia (bez souborů, nic k licencování). Téma má
// osm taktů (Dm, B, F, C, Dm, B, Gm, A) a celek běží ve smyčce: úvod s bubny a basou, téma,
// téma s druhým hlasem a bojová mezihra. Každý věk ho hraje jinými nástroji a v jiném tempu:
// doba kamenná na kmenové bubny a flétnu, středověk na lesní rohy, renesance na cembalo,
// moderní doba na vojenský virbl a žestě, budoucnost na syntezátory s arpeggiem.
// Hraje jen při GCMusic.gameMusic, hlasitost bere z GCMusic.level.
const VkMusic = (() => {
  const AGES = [
    { bpm: 96, lead: 'flute', drums: 'tribal', pad: 0.5 },
    { bpm: 102, lead: 'horn', drums: 'march', pad: 0.8 },
    { bpm: 106, lead: 'harpsi', drums: 'march', pad: 0.8 },
    { bpm: 112, lead: 'brass', drums: 'military', pad: 1 },
    { bpm: 120, lead: 'synth', drums: 'electro', pad: 1 },
  ];
  // téma: [midi, doby]
  const THEME = [
    [74, 1.5], [69, 0.5], [74, 1], [76, 1],
    [77, 1], [76, 0.5], [74, 0.5], [72, 2],
    [69, 1.5], [72, 0.5], [77, 1], [76, 1],
    [76, 1], [74, 1], [72, 1], [76, 1],
    [74, 1], [77, 1], [81, 1.5], [79, 0.5],
    [77, 2], [74, 1], [77, 1],
    [79, 1], [77, 1], [76, 1], [74, 1],
    [76, 2], [73, 1], [69, 1],
  ];
  const CHORDS = [[38, 'm'], [34, 'M'], [41, 'M'], [36, 'M'], [38, 'm'], [34, 'M'], [43, 'm'], [45, 'M']];
  // formy: úvod (4 takty bez melodie), téma, téma s terciemi, mezihra (4 takty)
  const FORM = [['intro', 4], ['theme', 8], ['theme2', 8], ['battle', 4], ['theme', 8], ['battle', 4]];
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  let ac = null, master = null, verb = null, noiseBuf = null, timer = 0, playing = false, age = 0, nextT = 0, bar = 0, section = 0, sectBar = 0, vol = 1, wantOn = false;

  function init() {
    if (ac) return true;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ac.createGain(); master.gain.value = 0;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ac.destination);
    // jednoduchý dozvuk: zpožděná zpětná vazba přes dolní propust
    verb = ac.createGain(); verb.gain.value = 0.22;
    const d = ac.createDelay(1); d.delayTime.value = 0.23; const fb = ac.createGain(); fb.gain.value = 0.38; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    verb.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    return true;
  }
  function out(node, wet = 0.3) { node.connect(master); if (wet) { const s = ac.createGain(); s.gain.value = wet; node.connect(s); s.connect(verb); } }
  function env(g, t, a, peak, dec, sus, end) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), t + a + dec); g.gain.setValueAtTime(Math.max(0.0001, sus), end); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.12); }
  function osc(type, f, t, dur, peak, o = {}) {
    const g = ac.createGain(), os = ac.createOscillator(); os.type = type; os.frequency.value = f;
    if (o.detune) os.detune.value = o.detune;
    if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.2; lg.gain.value = o.vib; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + dur + 0.2); }
    let node = os;
    if (o.lp) { const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(o.lp, t); if (o.sweep) f2.frequency.exponentialRampToValueAtTime(o.sweep, t + Math.min(dur, 0.4)); f2.Q.value = o.q || 0.7; os.connect(f2); node = f2; }
    node.connect(g); env(g, t, o.a || 0.01, peak, o.d || 0.1, peak * (o.s ?? 0.6), t + dur);
    out(g, o.wet ?? 0.3); os.start(t); os.stop(t + dur + 0.3);
  }
  function noise(t, dur, peak, type, f, q = 1) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ac.createGain();
    s.connect(fl); fl.connect(g); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); out(g, 0.15); s.start(t); s.stop(t + dur + 0.05);
  }
  function drum(t, f0, f1, dur, peak) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); out(g, 0.2); o.start(t); o.stop(t + dur + 0.05); }

  // nástroje melodie
  function lead(kind, m, t, dur, amp = 1) {
    const f = hz(m);
    if (kind === 'flute') { osc('triangle', f, t, dur, 0.16 * amp, { a: 0.05, vib: 4, s: 0.8, wet: 0.45 }); noise(t, 0.06, 0.02 * amp, 'bandpass', f * 2, 3); }
    else if (kind === 'horn') { osc('sawtooth', f, t, dur, 0.09 * amp, { a: 0.06, lp: 900, sweep: 1600, s: 0.75, vib: 2, wet: 0.45 }); osc('sawtooth', f, t, dur, 0.06 * amp, { a: 0.07, lp: 900, detune: 9, s: 0.75, wet: 0.45 }); }
    else if (kind === 'harpsi') { osc('square', f, t, Math.min(dur, 0.5), 0.07 * amp, { a: 0.003, d: 0.25, s: 0.15, lp: 3200, wet: 0.35 }); osc('sawtooth', f * 2, t, Math.min(dur, 0.3), 0.025 * amp, { a: 0.003, d: 0.15, s: 0.1, lp: 4000 }); osc('sawtooth', f, t, dur, 0.05 * amp, { a: 0.08, lp: 1000, s: 0.7, wet: 0.4 }); }
    else if (kind === 'brass') { osc('sawtooth', f, t, dur, 0.1 * amp, { a: 0.03, lp: 1100, sweep: 2400, q: 2, s: 0.7, wet: 0.35 }); osc('sawtooth', f / 2, t, dur, 0.05 * amp, { a: 0.03, lp: 800, detune: -7, s: 0.7 }); }
    else { osc('square', f, t, dur, 0.06 * amp, { a: 0.01, lp: 2600, q: 3, s: 0.6, vib: 3, wet: 0.5 }); osc('sawtooth', f, t, dur, 0.05 * amp, { a: 0.01, lp: 1800, detune: 12, s: 0.6, wet: 0.5 }); }
  }
  function chordNotes(root, q) { return [root + 12, root + 12 + (q === 'm' ? 3 : 4), root + 19]; }

  // jeden takt hudby od času t
  function playBar(t, idx, kind) {
    const A = AGES[age], beat = 60 / A.bpm, [root, q] = CHORDS[idx % 8];
    // bas: cválavý rytmus (osmina a dvě šestnáctiny)
    for (let b = 0; b < 4; b++) {
      const bt = t + b * beat, n = b === 2 ? root + 7 : root;
      osc(age === 4 ? 'square' : 'sawtooth', hz(n), bt, beat * 0.45, 0.11, { a: 0.005, lp: age === 4 ? 700 : 420, d: 0.12, s: 0.5, wet: 0.05 });
      osc('sawtooth', hz(n), bt + beat * 0.5, beat * 0.2, 0.08, { a: 0.005, lp: 420, s: 0.4, wet: 0.05 });
      osc('sawtooth', hz(n), bt + beat * 0.75, beat * 0.2, 0.08, { a: 0.005, lp: 420, s: 0.4, wet: 0.05 });
    }
    // plocha smyčců: akord přes celý takt
    for (const n of chordNotes(root, q)) osc('sawtooth', hz(n), t, beat * 3.9, 0.025 * A.pad, { a: 0.4, lp: 1200, d: 0.5, s: 0.85, detune: (n % 3) * 6 - 6, wet: 0.6 });
    // bubny
    for (let b = 0; b < 4; b++) {
      const bt = t + b * beat;
      if (A.drums === 'tribal') { drum(bt, 150, 50, 0.35, b % 2 ? 0.2 : 0.32); if (b === 3) { drum(bt + beat / 2, 220, 90, 0.2, 0.18); drum(bt + beat * 0.75, 200, 80, 0.2, 0.16); } }
      else { drum(bt, 120, 42, 0.3, b === 0 || b === 2 ? 0.34 : 0.12); if (b % 2) noise(bt, 0.16, A.drums === 'military' ? 0.14 : 0.1, 'bandpass', A.drums === 'electro' ? 3200 : 1800, 0.8); }
      if (A.drums === 'military' && b === 3) for (let k = 1; k < 4; k++) noise(bt + k * beat / 4, 0.06, 0.06, 'bandpass', 2000, 1);
      if (A.drums === 'electro') noise(bt + beat / 2, 0.04, 0.05, 'highpass', 7000);
    }
    if (idx % 4 === 3) { noise(t + 3.5 * beat, 0.6, 0.05, 'highpass', 5000); } // činel na konci fráze
    // arpeggio v budoucnosti
    if (age === 4) { const ns = chordNotes(root, q).map(n => n + 12); for (let k = 0; k < 16; k++) osc('square', hz(ns[k % 3] + (k % 6 > 2 ? 12 : 0)), t + k * beat / 4, beat / 5, 0.022, { a: 0.003, lp: 3000, d: 0.08, s: 0.3, wet: 0.5 }); }
    // melodie
    if (kind === 'theme' || kind === 'theme2') {
      let pos = 0, bi = 0, i = 0;
      while (bi < idx % 8) { pos += THEME[i][1]; i++; if (pos >= 4 - 1e-6) { pos = 0; bi++; } }
      pos = 0;
      while (i < THEME.length && pos < 4 - 1e-6) {
        const [m, d] = THEME[i];
        lead(AGES[age].lead, m, t + pos * beat, d * beat * 0.95);
        if (kind === 'theme2') lead(AGES[age].lead, m - (q === 'm' ? 3 : 4), t + pos * beat, d * beat * 0.95, 0.6);
        pos += d; i++;
      }
    } else if (kind === 'battle') {
      // bojová mezihra: úderný motiv na tónice
      const ns = [root + 24, root + 24, root + 27, root + 26];
      for (let k = 0; k < 4; k++) lead(AGES[age].lead, ns[k] + (q === 'm' ? 0 : 1) * (k === 2 ? 1 : 0), t + k * beat, beat * 0.5, 0.8);
    }
    return beat * 4;
  }

  function tick() {
    if (!playing || !ac) return;
    while (nextT < ac.currentTime + 0.4) {
      const [kind, len] = FORM[section];
      nextT += playBar(nextT, kind === 'intro' || kind === 'battle' ? sectBar % 4 : sectBar, kind);
      sectBar++; bar++;
      if (sectBar >= len) { sectBar = 0; section = (section + 1) % FORM.length; if (section === 0) section = 1; }
    }
  }
  function applyVol() {
    if (!ac) return;
    const gm = !window.GCMusic ? 1 : window.GCMusic.gameMusic ? window.GCMusic.level : 0;
    master.gain.setTargetAtTime(playing ? 0.55 * vol * gm : 0, ac.currentTime, 0.3);
  }
  function start() {
    wantOn = true;
    if (!init()) return;
    if (ac.state === 'suspended') ac.resume();
    if (playing) return;
    playing = true; nextT = ac.currentTime + 0.1; section = 0; sectBar = 0;
    clearInterval(timer); timer = setInterval(tick, 100); tick(); applyVol();
  }
  function stop() { wantOn = false; playing = false; clearInterval(timer); applyVol(); }
  function pause(on) { if (!ac) return; if (on) { playing = false; clearInterval(timer); applyVol(); } else if (wantOn) { playing = true; nextT = Math.max(nextT, ac.currentTime + 0.1); clearInterval(timer); timer = setInterval(tick, 100); applyVol(); } }
  function setAge(a) { age = Math.max(0, Math.min(4, a)); }
  if (window.GCMusic) window.GCMusic.on(() => applyVol());
  document.addEventListener('visibilitychange', () => { if (wantOn) pause(document.hidden); });
  return { start, stop, pause, setAge, get playing() { return playing; }, set volume(v) { vol = v; applyVol(); } };
})();
