'use strict';
// ── KLÁVESY · zvuk ──────────────────────────────────────────────────────────
// Klavír: nahrávky Salamander Grand Piano (Alexander Holm, CC BY 3.0), každý třetí půltón ve
// dvou silách úhozu, mezitóny se dopočítají posunem výšky. Bicí, basa, plochy a lead pro styly
// se syntetizují ve Web Audio. Vše jde přes kompresor a dozvuk místnosti.
const KlAudio = (() => {
  const NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
  const SAMPLES = [];
  for (let m = 33; m <= 96; m += 3) SAMPLES.push(m); // A1 … C7
  const fileOf = (m, layer) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}${layer}.mp3`;
  let ac = null, out = null, trim = null, bus = null, melBus = null, bgBus = null, rv = null, melRev = null, bgRev = null, padBus = null, rev = null, noise = null, shaper = null;
  const bufs = { s: {}, f: {} }, offs = { s: {}, f: {} };
  let loadP = null, loaded = 0;

  function ctx() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { ac = new AC(); }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
    // pojistka proti přebuzení na konci řetězu
    const lim = ac.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    out = ac.createGain(); out.gain.value = 0.8;
    trim = ac.createGain();
    trim.connect(comp); comp.connect(lim); lim.connect(out); out.connect(ac.destination);
    melBus = ac.createGain(); melBus.connect(trim);
    bgBus = ac.createGain(); bgBus.connect(trim);
    bus = melBus;
    padBus = ac.createGain(); padBus.connect(bgBus);
    // dozvuk: generovaná odezva malého sálu
    rev = ac.createConvolver();
    const len = Math.floor(ac.sampleRate * 1.5), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) { const t = i / ac.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3.2) * (t < 0.012 ? t / 0.012 : 1); }
    }
    rev.buffer = ir;
    const revOut = ac.createGain(); revOut.gain.value = 0.22;
    rev.connect(revOut); revOut.connect(trim);
    melRev = ac.createGain(); melRev.connect(rev); bgRev = ac.createGain(); bgRev.connect(rev); rv = melRev;
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    shaper = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; shaper[i] = Math.tanh(x * 6) / Math.tanh(6); }
    return ac;
  }
  // první dotek: rozjet kontext (iOS chce i krátké přehrání)
  function unlock() {
    const a = ctx();
    if (a.state !== 'running') a.resume().catch(() => {});
    try { const s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, 22050); s.connect(a.destination); s.start(0); } catch (e) { /* nic */ }
  }
  const now = () => (ac ? ac.currentTime : 0);

  function decode(arr) {
    return new Promise((ok, bad) => { const p = ac.decodeAudioData(arr, ok, bad); if (p && p.catch) p.catch(bad); });
  }
  // načte vzorky: nejdřív tišší vrstvu (s), pak silnější (f)
  function load(base) {
    if (loadP) return loadP;
    ctx();
    const one = (m, layer) => fetch(base + fileOf(m, layer)).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then(decode).then(b => {
      // začátek tónu (MP3 má na začátku ticho kodéru)
      const d = b.getChannelData(0); let i = 0;
      while (i < d.length && Math.abs(d[i]) < 0.003) i++;
      bufs[layer][m] = b; offs[layer][m] = Math.max(0, i / b.sampleRate - 0.002); loaded++;
    }).catch(() => {});
    loadP = Promise.all(SAMPLES.map(m => one(m, 's'))).then(() => Promise.all(SAMPLES.map(m => one(m, 'f'))));
    return loadP;
  }
  const ready = () => Object.keys(bufs.s).length >= SAMPLES.length * 0.9;

  function nearest(m, layer) {
    let best = null, bd = 99;
    for (const k in bufs[layer]) { const d = Math.abs(m - k); if (d < bd) { bd = d; best = +k; } }
    return best;
  }
  function panner(p) {
    if (!ac.createStereoPanner) return null;
    const n = ac.createStereoPanner(); n.pan.value = Math.max(-0.6, Math.min(0.6, p)); return n;
  }
  // ── Klavír ──
  // vrací { release(t) } pro držené tóny
  function piano(m, vel, t, dur, opt = {}) {
    if (!ac) return null;
    t = Math.max(t, ac.currentTime);
    let layer = vel > 0.6 && Object.keys(bufs.f).length ? 'f' : 's';
    let s = nearest(m, layer);
    if (s == null) { layer = layer === 'f' ? 's' : 'f'; s = nearest(m, layer); }
    if (s == null) return synthPiano(m, vel, t, dur);
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = bufs[layer][s];
    src.playbackRate.value = Math.pow(2, (m - s) / 12);
    const amp = (layer === 'f' ? 0.75 : 1.15) * (0.35 + 0.65 * vel) * (opt.gain || 1);
    g.gain.setValueAtTime(amp, t);
    const p = panner((m - 64) / 40);
    src.connect(g);
    if (p) { g.connect(p); p.connect(bus); } else g.connect(bus);
    const send = ac.createGain(); send.gain.value = opt.wet != null ? opt.wet : 1; g.connect(send); send.connect(rv);
    src.start(t, offs[layer][s] || 0);
    const rel = (tt, k = 0.09) => { tt = Math.max(tt, ac.currentTime); g.gain.cancelScheduledValues(tt); g.gain.setValueAtTime(g.gain.value || amp, tt); g.gain.setTargetAtTime(0, tt, k); try { src.stop(tt + k * 8); } catch (e) { /* už stojí */ } };
    // tlumítko: tón doznívá ještě kousek po své délce (lehký pedál)
    if (dur != null) rel(t + dur + 0.12, opt.ring || 0.16);
    return { release: tt => rel(tt == null ? ac.currentTime : tt, 0.1) };
  }
  // náhrada, než se nahrávky načtou
  function synthPiano(m, vel, t, dur) {
    const f = 440 * Math.pow(2, (m - 69) / 12), g = ac.createGain(), o1 = ac.createOscillator(), o2 = ac.createOscillator();
    o1.type = 'triangle'; o2.type = 'sine'; o1.frequency.value = f; o2.frequency.value = f * 2;
    const g2 = ac.createGain(); g2.gain.value = 0.25;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus);
    const a = 0.18 * (0.4 + vel * 0.6);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.005); g.gain.setTargetAtTime(a * 0.3, t + 0.01, 0.35);
    const end = t + (dur || 0.5) + 0.1;
    g.gain.setTargetAtTime(0, end, 0.08);
    o1.start(t); o2.start(t); o1.stop(end + 0.6); o2.stop(end + 0.6);
    return { release: tt => { g.gain.cancelScheduledValues(tt); g.gain.setTargetAtTime(0, Math.max(tt, ac.currentTime), 0.06); } };
  }

  // ── Bicí ──
  function noiseSrc(t, dur) { const s = ac.createBufferSource(); s.buffer = noise; s.start(t, Math.random() * 0.5); s.stop(t + dur); return s; }
  function env(node, t, a, d, peak) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function kick(t, v = 1, hard = false) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(hard ? 170 : 140, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    env(g, t, 0.002, hard ? 0.42 : 0.32, 0.95 * v);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.5);
    const c = noiseSrc(t, 0.02), cf = ac.createBiquadFilter(), cg = ac.createGain();
    cf.type = 'highpass'; cf.frequency.value = 2500; env(cg, t, 0.001, 0.012, 0.25 * v);
    c.connect(cf); cf.connect(cg); cg.connect(bus);
    duck(t);
  }
  function snare(t, v = 1, wet = 0.5) {
    const n = noiseSrc(t, 0.25), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'highpass'; f.frequency.value = 1400; env(g, t, 0.001, 0.17, 0.42 * v);
    n.connect(f); f.connect(g); g.connect(bus);
    const s = ac.createGain(); s.gain.value = wet; g.connect(s); s.connect(rv);
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
    env(og, t, 0.001, 0.09, 0.35 * v); o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.15);
  }
  function clap(t, v = 1) {
    const n = noiseSrc(t, 0.3), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, t);
    for (const d of [0, 0.011, 0.022]) { g.gain.setValueAtTime(0.5 * v, t + d); g.gain.exponentialRampToValueAtTime(0.05 * v, t + d + 0.009); }
    g.gain.setValueAtTime(0.4 * v, t + 0.032); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    n.connect(f); f.connect(g); g.connect(bus);
    const s = ac.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(rv);
  }
  function hat(t, v = 1, open = false) {
    const n = noiseSrc(t, open ? 0.35 : 0.08), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'highpass'; f.frequency.value = open ? 7000 : 8500;
    env(g, t, 0.001, open ? 0.22 : 0.04, (open ? 0.16 : 0.13) * v);
    n.connect(f); f.connect(g);
    const p = panner(0.25); if (p) { g.connect(p); p.connect(bus); } else g.connect(bus);
  }
  function crash(t, v = 1) {
    const n = noiseSrc(t, 1.6), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'highpass'; f.frequency.value = 4500; env(g, t, 0.002, 1.4, 0.2 * v);
    n.connect(f); f.connect(g); g.connect(bus);
    const s = ac.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(rv);
  }
  // náběh před další smyčkou (šum se otevírajícím filtrem)
  function riser(t, dur, v = 1) {
    const n = noiseSrc(t, dur + 0.05), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14 * v, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.04);
    n.connect(f); f.connect(g); g.connect(bus);
  }
  // „sidechain“: plochy se při kopáku přikrčí
  let pump = false;
  function duck(t) {
    if (!pump) return;
    const g = padBus.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.25, t); g.setTargetAtTime(1, t + 0.03, 0.09);
  }
  function setPump(on) { pump = on; if (!on && padBus) { padBus.gain.cancelScheduledValues(0); padBus.gain.value = 1; } }

  // ── Syntezátory ──
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function bass(m, t, dur, v = 1, kind = 'sub') {
    const f = hz(m), g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = kind === 'saw' ? 6 : 1;
    const o1 = ac.createOscillator(); o1.type = kind === 'saw' ? 'sawtooth' : 'triangle'; o1.frequency.value = f;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = f;
    const g2 = ac.createGain(); g2.gain.value = kind === 'saw' ? 0.5 : 0.8;
    o1.connect(lp); o2.connect(g2); g2.connect(g); lp.connect(g); g.connect(bus);
    const top = kind === 'saw' ? 1800 : kind === 'pick' ? 1400 : 520;
    lp.frequency.setValueAtTime(top, t); lp.frequency.exponentialRampToValueAtTime(kind === 'saw' ? 220 : 180, t + Math.min(dur, 0.25));
    const a = (kind === 'saw' ? 0.32 : 0.42) * v, end = t + Math.max(0.06, dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.006); g.gain.setValueAtTime(a * 0.8, end - 0.02); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.05);
    o1.start(t); o2.start(t); o1.stop(end + 0.1); o2.stop(end + 0.1);
  }
  // supersaw: několik rozladěných pil pod jedním filtrem
  function saws(ms, t, dur, v, opt) {
    const g = ac.createGain(), lp = ac.createBiquadFilter(), oscs = [];
    lp.type = 'lowpass'; lp.Q.value = opt.q || 0.7;
    const det = opt.detune || [-14, -6, 0, 6, 14];
    for (const m of ms) for (const d of det) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = d + (Math.random() - 0.5) * 3; o.connect(lp); oscs.push(o); }
    lp.connect(g); g.connect(opt.dest || bus);
    if (opt.wet) { const s = ac.createGain(); s.gain.value = opt.wet; g.connect(s); s.connect(rv); }
    const n = oscs.length, a = v / Math.sqrt(n) * (opt.level || 0.25);
    lp.frequency.setValueAtTime(opt.f0 || 4000, t);
    if (opt.f1) lp.frequency.exponentialRampToValueAtTime(opt.f1, t + (opt.fd || 0.3));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + (opt.att || 0.01));
    if (opt.dec) g.gain.setTargetAtTime(a * (opt.sus != null ? opt.sus : 0.6), t + (opt.att || 0.01), opt.dec);
    const rel = opt.rel || 0.2;
    const stop = tt => { tt = Math.max(tt, ac.currentTime); g.gain.cancelScheduledValues(tt); g.gain.setValueAtTime(g.gain.value || a, tt); g.gain.setTargetAtTime(0.0001, tt, rel / 3); for (const o of oscs) try { o.stop(tt + rel * 2); } catch (e) { /* stojí */ } };
    for (const o of oscs) o.start(t);
    if (dur != null) stop(t + dur);
    return { release: tt => stop(tt == null ? ac.currentTime : tt) };
  }
  function pad(ms, t, dur, v = 1) { return saws(ms, t, dur, v, { dest: padBus, f0: 1300, att: 0.06, rel: 0.25, level: 0.16, wet: 0.5, detune: [-12, 0, 12] }); }
  function pluck(ms, t, v = 1) { return saws(ms, t, 0.18, v, { f0: 4200, f1: 600, fd: 0.15, att: 0.003, dec: 0.08, sus: 0.3, rel: 0.12, level: 0.28, wet: 0.6, detune: [-8, 8] }); }
  function lead(m, t, dur, v = 1) {
    const h = saws([m], t, dur, v, { f0: 5200, f1: 2600, fd: 0.25, att: 0.006, dec: 0.25, sus: 0.7, rel: 0.18, level: 0.3, wet: 0.45, detune: [-12, 0, 12] });
    return h;
  }
  // zkreslená kytara: pila → saturace → „reprobedna“
  function guitar(ms, t, dur, v = 1, mute = false) {
    const g = ac.createGain(), ws = ac.createWaveShaper(), lp = ac.createBiquadFilter(), hp = ac.createBiquadFilter(), pre = ac.createGain(), oscs = [];
    ws.curve = shaper; ws.oversample = 'none';
    pre.gain.value = 0.9;
    lp.type = 'lowpass'; lp.frequency.value = mute ? 1500 : 2900; lp.Q.value = 0.9;
    hp.type = 'highpass'; hp.frequency.value = 90;
    for (const m of ms) for (const d of ms.length > 1 ? [0] : [-7, 7]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = d; o.connect(pre); oscs.push(o); }
    pre.connect(ws); ws.connect(lp); lp.connect(hp); hp.connect(g); g.connect(bus);
    const s = ac.createGain(); s.gain.value = 0.25; g.connect(s); s.connect(rv);
    const a = 0.16 * v;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.004);
    if (mute) g.gain.setTargetAtTime(0.0001, t + 0.01, 0.05);
    else g.gain.setTargetAtTime(a * 0.7, t + 0.01, 0.3);
    if (!mute && ms.length === 1) { // vibrato pro sólo
      const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(18, t + 0.45);
      l.connect(lg); for (const o of oscs) lg.connect(o.detune); l.start(t); oscs.push(l);
    }
    const stop = tt => { tt = Math.max(tt, ac.currentTime); g.gain.cancelScheduledValues(tt); g.gain.setTargetAtTime(0.0001, tt, 0.05); for (const o of oscs) try { o.stop(tt + 0.4); } catch (e) { /* stojí */ } };
    for (const o of oscs) if (o.type === 'sawtooth') o.start(t);
    stop(t + (dur || 0.2));
    return { release: tt => stop(tt == null ? ac.currentTime : tt) };
  }

  // ── Aranže ──
  // Z akordů skladby a stylu udělá doprovod na jednu smyčku: [{ r, k, ... }] v řádcích.
  // Klavírní styl má levou ruku, kterou spouští ťuknutí (k: 'lh'); ostatní styly mají doprovod
  // hraný podle hodin (bicí, basa, akordy).
  function voice(ch, lo, n = 3) {
    const ms = [];
    for (const pc of ch.pcs) { let m = lo + ((pc - lo) % 12 + 12) % 12; ms.push(m); }
    ms.sort((a, b) => a - b);
    return ms.slice(0, n);
  }
  const bassNote = (ch, lo = 36) => lo + ((ch.root - lo) % 12 + 12) % 12;
  function arrange(song, parsed, style) {
    const ev = [], { chords, total } = parsed;
    const chordAt = r => { for (const c of chords) if (r >= c.r0 - 1e-6 && r < c.r0 + c.len - 1e-6) return c; return null; };
    // puls: doba, zdvojená/půlená, aby tempo bicích bylo 75–150 úderů za minutu
    let pulse = song.beat;
    while ((60 * song.rps) / pulse > 150) pulse *= 2;
    while ((60 * song.rps) / pulse < 75) pulse /= 2;
    const half = pulse / 2;
    if (style === 'piano') {
      // levá ruka: bas na první době akordu, akordy na dalších dobách
      for (const c of chords) {
        if (!c.ch) continue;
        const b = song.beat;
        for (let r = c.r0, i = 0; r < c.r0 + c.len - 1e-6; r += b, i++) {
          const barPos = ((r - song.pickup) % song.bar + song.bar) % song.bar;
          if (i === 0 || barPos < 1e-6) ev.push({ r, k: 'lh', n: [bassNote(c.ch, 40)], d: Math.min(c.len, song.bar), v: 0.5 });
          else if (song.bar / b >= 4 && Math.abs(barPos - song.bar / 2) < 1e-6) ev.push({ r, k: 'lh', n: [bassNote(c.ch, 40) + 7], d: b * 2, v: 0.38 });
          else ev.push({ r, k: 'lh', n: voice(c.ch, 55), d: b * 0.9, v: 0.32 });
        }
      }
      return { ev, pulse };
    }
    for (let r = 0; r < total - 1e-6; r += half) {
      const c = chordAt(r) || chordAt(Math.max(0, r - 1e-3));
      const ip = Math.round((r - song.pickup) / half), onPulse = ip % 2 === 0, pi = Math.floor(ip / 2);
      const pulsesPerBar = Math.max(1, Math.round(song.bar / pulse));
      const pb = ((pi % pulsesPerBar) + pulsesPerBar) % pulsesPerBar;
      const barStart = onPulse && pb === 0, back = pulsesPerBar >= 2 && pb % 2 === 1;
      const chordStart = c && Math.abs(c.r0 - r) < 1e-6;
      if (style === 'pop') {
        if (onPulse && (pb === 0 || (pulsesPerBar >= 4 && pb === 2))) ev.push({ r, k: 'kick', v: 0.75 });
        if (onPulse && back) ev.push({ r, k: 'snare', v: 0.55 });
        if (pulsesPerBar === 3 && onPulse && pb === 2) ev.push({ r, k: 'snare', v: 0.35 });
        ev.push({ r, k: 'hat', v: onPulse ? 0.5 : 0.32 });
        if (c && c.ch) {
          if (onPulse) ev.push({ r, k: 'keys', n: voice(c.ch, 60), d: pulse * 0.95, v: 0.3 });
          if (onPulse && (pb === 0 || chordStart)) ev.push({ r, k: 'bass', n: bassNote(c.ch), d: pulse * 1.5, v: 0.9 });
          else if (!onPulse && pb === pulsesPerBar - 1) ev.push({ r, k: 'bass', n: bassNote(c.ch) + 7, d: half * 0.9, v: 0.6 });
          else if (onPulse) ev.push({ r, k: 'bass', n: bassNote(c.ch), d: pulse * 0.8, v: 0.7 });
        }
        if (barStart && Math.round((r - song.pickup) / song.bar) % 8 === 0) ev.push({ r, k: 'crash', v: 0.5 });
      } else if (style === 'house') {
        if (onPulse) ev.push({ r, k: 'kick', v: 0.9 });
        if (onPulse && back) ev.push({ r, k: 'clap', v: 0.6 });
        ev.push({ r, k: 'hat', v: onPulse ? 0.25 : 0.6, open: !onPulse });
        ev.push({ r: r + half / 2, k: 'hat', v: 0.18 });
        if (c && c.ch) {
          if (!onPulse) ev.push({ r, k: 'stab', n: voice(c.ch, 62, 4), d: half * 0.7, v: 0.5 });
          if (!onPulse) ev.push({ r, k: 'bass', n: bassNote(c.ch), d: half * 0.8, v: 0.9, kind: 'pick' });
        }
      } else if (style === 'edm') {
        if (onPulse) ev.push({ r, k: 'kick', v: 1, hard: true });
        if (onPulse && back) ev.push({ r, k: 'clap', v: 0.65 });
        if (!onPulse) ev.push({ r, k: 'hat', v: 0.5, open: true });
        if (c && c.ch) {
          if (chordStart || barStart) ev.push({ r, k: 'pad', n: voice(c.ch, 57, 4), d: Math.min(c.len, c.r0 + c.len - r), v: 0.9 });
          ev.push({ r, k: 'bass', n: bassNote(c.ch, 33), d: half * 0.85, v: onPulse ? 0.5 : 0.85, kind: 'saw' });
        }
      } else if (style === 'rock') {
        const kickHere = onPulse ? !back : pulsesPerBar >= 4 && pb === 2;
        if (kickHere) ev.push({ r, k: 'kick', v: 0.95 });
        if (onPulse && back) ev.push({ r, k: 'snare', v: 0.85 });
        if (pulsesPerBar === 3 && onPulse && pb === 2) ev.push({ r, k: 'snare', v: 0.6 });
        ev.push({ r, k: 'hat', v: onPulse ? 0.55 : 0.4, open: false });
        if (barStart && Math.round((r - song.pickup) / song.bar) % 4 === 0) ev.push({ r, k: 'crash', v: 0.7 });
        if (c && c.ch) {
          const root = bassNote(c.ch, 40);
          ev.push({ r, k: 'gtr', n: [root, root + 7, root + 12], d: half * 0.9, v: chordStart ? 1 : 0.75, mute: !chordStart });
          ev.push({ r, k: 'bass', n: bassNote(c.ch, 28), d: half * 0.85, v: 0.85, kind: 'pick' });
        }
      }
    }
    // náběh na konci smyčky
    if (style === 'edm' || style === 'rock' || style === 'house') {
      const lastBar = total - song.bar;
      for (let r = lastBar + song.bar / 2; r < total - 1e-6; r += pulse / 4) ev.push({ r, k: 'snare', v: 0.25 + 0.5 * ((r - lastBar) / song.bar), wet: 0.2 });
      ev.push({ r: lastBar, k: 'riser', d: song.bar, v: style === 'edm' ? 1 : 0.6 });
    }
    ev.sort((a, b) => a.r - b.r);
    return { ev, pulse };
  }

  // jedna událost doprovodu v čase t; sec = délka řádku v sekundách
  function play(e, t, sec) {
    if (!ac) return;
    bus = bgBus; rv = bgRev;
    try { playOne(e, t, sec); } finally { bus = melBus; rv = melRev; }
  }
  function playOne(e, t, sec) {
    switch (e.k) {
      case 'kick': kick(t, e.v, e.hard); break;
      case 'snare': snare(t, e.v, e.wet); break;
      case 'clap': clap(t, e.v); break;
      case 'hat': hat(t, e.v, e.open); break;
      case 'crash': crash(t, e.v); break;
      case 'riser': riser(t, e.d * sec, e.v); break;
      case 'bass': bass(e.n, t, e.d * sec, e.v, e.kind); break;
      case 'pad': pad(e.n, t, e.d * sec, e.v); break;
      case 'stab': for (const m of e.n) piano(m, e.v, t, e.d * sec, { gain: 0.6, ring: 0.05 }); break;
      case 'keys': case 'lh': for (const m of e.n) piano(m, e.v, t, e.d * sec, { gain: e.k === 'lh' ? 0.85 : 0.55, wet: 1.3 }); break;
      case 'gtr': guitar(e.n, t, e.d * sec, e.v, e.mute); break;
      default: break;
    }
  }
  // melodie podle stylu; vrací držák s release()
  function melody(style, m, vel, t, dur) {
    if (style === 'edm') { const p = piano(m, vel * 0.7, t, dur, { gain: 0.5 }); const l = lead(m, t, dur == null ? null : dur, vel); return { release: tt => { if (p) p.release(tt); l.release(tt); } }; }
    if (style === 'rock') { const p = piano(m, vel, t, dur, { gain: 0.45 }); const g = guitar([m], t, dur == null ? 6 : dur + 0.05, vel * 1.1); return { release: tt => { if (p) p.release(tt); g.release(tt); } }; }
    if (style === 'house') { const p = piano(m, vel, t, dur, { gain: 1.05 }); const k = pluck([m + 12], t, vel * 0.35); return { release: tt => { if (p) p.release(tt); k.release(tt); } }; }
    return piano(m, vel, t, dur, { gain: 1.1 }) || { release() {} };
  }
  // vyrovnání hlasitosti stylů (změřeno na nahrávkách)
  // doprovod je o pár dB pod melodií, ať melodie vede
  const MEL = { piano: 2.4, pop: 1.9, house: 2.2, edm: 0.6, rock: 0.75 };
  const BG = { piano: 1.4, pop: 0.14, house: 0.2, edm: 0.3, rock: 0.18 };
  function setStyle(style) {
    ctx(); setPump(style === 'edm');
    melBus.gain.setTargetAtTime(MEL[style] || 1, ac.currentTime, 0.05);
    melRev.gain.setTargetAtTime(MEL[style] || 1, ac.currentTime, 0.05);
    bgBus.gain.setTargetAtTime(BG[style] || 0.5, ac.currentTime, 0.05);
    bgRev.gain.setTargetAtTime(BG[style] || 0.5, ac.currentTime, 0.05);
  }
  function mute(on) { if (out) out.gain.setTargetAtTime(on ? 0 : 0.8, ac.currentTime, 0.03); }
  function error(t) { // falešný tón: disonantní klastr
    if (!ac) return;
    for (const m of [47, 48, 54]) piano(m, 0.9, t, 0.5, { gain: 0.8 });
  }

  return { MEL, BG, load, ready, unlock, ctx, now, piano, play, melody, arrange, setStyle, mute, error, get loaded() { return loaded; }, get total() { return SAMPLES.length * 2; }, get state() { return ac ? ac.state : 'none'; } };
})();
