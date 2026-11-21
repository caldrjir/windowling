'use strict';
// Echoes of the Hollow Sun – hudba (P1). Adaptivní vrstvy podle Game Design Bible (Audio direction):
// explore / combat / boss se 3 stemy, crossfade 2 s; stingery (level up, unikát, smrt, boss poražen)
// krátce ztiší hudbu. Skladby z assets/music/ (scripts/hollowsun-music.mjs: smyčky na celé takty,
// −16 LUFS, Opus). Skladby jedné skupiny mají stejnou délku a hrají synchronně, takže prolnutí sedí na takt.
// Hraje jen při GCMusic.gameMusic (Game Center), hlasitost bere z GCMusic.level. Bez manifestu mlčí.
(function () {
  const XF = 2; // s, crossfade vrstev (Bible)
  const DUCK = 0.5; // −6 dB pod stingerem
  let ac = null, out = null, mix = null, man = null, want = 'none', cur = null, layerNow = null;
  const buf = {}; // id → Promise<AudioBuffer>
  const has = (id) => !!(man && man.tracks.some((t) => t.id === id));
  const gm = () => (!window.GCMusic ? 1 : window.GCMusic.gameMusic ? window.GCMusic.level : 0);
  function load(id) {
    if (!buf[id]) { const t = man.tracks.find((x) => x.id === id); buf[id] = fetch('assets/music/' + t.file).then((r) => r.arrayBuffer()).then((a) => ac.decodeAudioData(a)); }
    return buf[id];
  }
  // skupina vrstev: všechny smyčky startují ve stejný okamžik, slyšet je jen aktivní (gain)
  const GROUPS = {
    menu: { ids: ['AU_mus_menu'], first: 'AU_mus_menu' },
    arena: { ids: ['AU_mus_r1_explore', 'AU_mus_r1_combat'], first: 'AU_mus_r1_explore' },
    boss: { ids: ['AU_mus_bo_kiln_1', 'AU_mus_bo_kiln_2', 'AU_mus_bo_kiln_3'], first: 'AU_mus_bo_kiln_1' },
  };
  function stopGroup(g, fade) {
    if (!g) return; const t = ac.currentTime;
    for (const l of Object.values(g.layers)) { l.gain.gain.cancelScheduledValues(t); l.gain.gain.setValueAtTime(l.gain.gain.value, t); l.gain.gain.linearRampToValueAtTime(0, t + fade); l.src.stop(t + fade + 0.05); }
  }
  async function startGroup(name) {
    const def = GROUPS[name]; const ids = def.ids.filter(has); if (!ids.length) return;
    const token = {}; cur = { name, token, layers: {} }; const me = cur;
    const bufs = await Promise.all(ids.map(load)).catch(() => null);
    if (!bufs || cur !== me) return;
    const t0 = ac.currentTime + 0.05; const active = layerNow && ids.includes(layerNow) ? layerNow : ids.includes(def.first) ? def.first : ids[0];
    ids.forEach((id, i) => {
      const src = ac.createBufferSource(); src.buffer = bufs[i]; src.loop = true;
      const gain = ac.createGain(); gain.gain.value = 0; src.connect(gain).connect(mix); src.start(t0);
      if (id === active) gain.gain.linearRampToValueAtTime(1, t0 + 1.5);
      me.layers[id] = { src, gain };
    });
    me.active = active;
  }
  function setLayer(id) {
    layerNow = id; if (!cur || !cur.layers[id] || cur.active === id) return;
    const t = ac.currentTime;
    for (const [lid, l] of Object.entries(cur.layers)) { l.gain.gain.cancelScheduledValues(t); l.gain.gain.setValueAtTime(l.gain.gain.value, t); l.gain.gain.linearRampToValueAtTime(lid === id ? 1 : 0, t + XF); }
    cur.active = id;
  }
  function applyVol() { if (out) out.gain.setTargetAtTime(gm(), ac.currentTime, 0.1); }
  const HSMusic = {
    // po prvním gestu hráče (AudioContext hry); načte manifest, bez něj zůstane potichu
    init(ctx) {
      if (ac || !ctx) return; ac = ctx;
      out = ac.createGain(); out.gain.value = gm(); out.connect(ac.destination);
      mix = ac.createGain(); mix.connect(out);
      fetch('assets/music/manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => { man = m && m.tracks && m.tracks.length ? m : null; if (man) { const w = want; want = null; HSMusic.state(w); } }).catch(() => { man = null; });
      if (window.GCMusic && window.GCMusic.on) window.GCMusic.on(applyVol);
    },
    // 'menu' | 'arena' | 'boss' | 'none' (benchmark a test vstupu hrají bez hudby)
    state(name) {
      if (name === want) return; want = name; if (!ac || !man) return;
      if (cur) { stopGroup(cur, 1.5); cur = null; }
      layerNow = null; if (GROUPS[name]) startGroup(name);
    },
    combat(on) { if (want === 'arena') setLayer(on ? 'AU_mus_r1_combat' : 'AU_mus_r1_explore'); },
    phase(n) { if (want === 'boss') setLayer('AU_mus_bo_kiln_' + Math.max(1, Math.min(3, n))); },
    // stinger přes hudbu; hudba se na jeho délku ztiší o 6 dB. Vrací false, když skladba chybí.
    sting(id) {
      if (!ac || !has(id) || !gm()) return false;
      load(id).then((b) => {
        const t = ac.currentTime; const src = ac.createBufferSource(); src.buffer = b; const g = ac.createGain(); g.gain.value = 1; src.connect(g).connect(out); src.start(t);
        mix.gain.cancelScheduledValues(t); mix.gain.setValueAtTime(mix.gain.value, t); mix.gain.linearRampToValueAtTime(DUCK, t + 0.15); mix.gain.setValueAtTime(DUCK, t + Math.max(0.2, b.duration - 0.5)); mix.gain.linearRampToValueAtTime(1, t + b.duration + 0.5);
      }).catch(() => {});
      return true;
    },
    has,
    get status() { return { ready: !!man, state: want, playing: cur ? cur.name : null, layer: cur ? cur.active : null, tracks: man ? man.tracks.map((t) => t.id) : [] }; },
  };
  window.HSMusic = HSMusic;
})();
