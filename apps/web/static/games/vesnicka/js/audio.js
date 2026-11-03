'use strict';
// ── VESNIČKA · zvuky (Web Audio, nic se nenačítá). Hudbu hraje společný přehrávač (music.js). ──
const Sound = (() => {
  let ac = null, out = null, on = true, last = {};
  function ctx() {
    if (!on) return null;
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
      out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function tone(f, dur, o = {}) {
    const a = ctx(); if (!a) return;
    const t0 = a.currentTime + (o.at || 0), g = a.createGain(), osc = a.createOscillator();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t0 + (o.attack || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(out); osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noise(dur, o = {}) {
    const a = ctx(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t0 = a.currentTime + (o.at || 0);
    src.buffer = buf; f.type = o.filter || 'bandpass'; f.frequency.value = o.freq || 1200; f.Q.value = o.q || 1;
    g.gain.value = o.vol || 0.15; src.connect(f); f.connect(g); g.connect(out); src.start(t0);
  }
  // Omezení: stejný zvuk nejvýš jednou za `gap` sekund (klepání prstem po obrazovce).
  const limit = (k, gap) => { const n = performance.now() / 1000; if (last[k] && n - last[k] < gap) return false; last[k] = n; return true; };
  const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  let tapStep = 0;
  const play = {
    tap() { if (!limit('tap', 0.045)) return; const f = notes[tapStep++ % 3] * (1 + Math.random() * 0.02); tone(f * 2, 0.07, { type: 'triangle', vol: 0.09 }); noise(0.03, { freq: 3000, vol: 0.04 }); },
    buy() { tone(660, 0.08, { type: 'triangle', vol: 0.14 }); tone(990, 0.12, { type: 'triangle', vol: 0.12, at: 0.06 }); noise(0.06, { freq: 900, vol: 0.06 }); },
    upgrade() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.12, at: i * 0.06 })); },
    milestone() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.24, { type: 'square', vol: 0.06, at: i * 0.08 })); tone(1568, 0.5, { vol: 0.08, at: 0.4 }); },
    first() { [523, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.13, at: i * 0.1 })); },
    appear() { [1318, 1568, 1976].forEach((f, i) => tone(f, 0.35, { vol: 0.06, at: i * 0.09 })); },
    catch() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.1, at: i * 0.05 })); noise(0.25, { freq: 6000, q: 0.5, vol: 0.05 }); },
    devil() { tone(220, 0.25, { type: 'sawtooth', vol: 0.08, to: 110 }); tone(330, 0.25, { type: 'square', vol: 0.05, to: 160, at: 0.1 }); },
    achievement() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.11, at: i * 0.07 })); },
    legend() { [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.6, { type: 'triangle', vol: 0.1, at: i * 0.12 })); },
    claim() { [880, 1109, 1319].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.12, at: i * 0.06 })); noise(0.1, { freq: 4000, vol: 0.05, at: 0.12 }); },
    bell() { tone(880, 1.4, { vol: 0.08 }); tone(1760, 1.0, { vol: 0.03 }); },
    no() { tone(180, 0.12, { type: 'square', vol: 0.05 }); },
  };
  return {
    play: new Proxy(play, { get: (o, k) => (on && o[k]) || (() => {}) }),
    set on(v) { on = !!v; }, get on() { return on; }, unlock() { ctx(); },
  };
})();
