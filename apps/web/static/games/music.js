'use strict';
// Windowling Game Center: background music. Loaded on the hub and on every game page
// (<script src="../music.js"> right after sync.js). Every game has a default playlist: the
// action games play their own music, the puzzle games a playlist generated here (Web Audio,
// no files, nothing to license or load). In the settings anyone can switch to their own
// playlist (a YouTube, SoundCloud or Spotify link) or turn the music off. The games' sound
// effects always play over the music (games mute only their music, see GCMusic.gameMusic).
// The setting is the synced key `gamecenter.music`; the place in a playlist is remembered
// per tab, so the next game page continues from it.
(function () {
  if (window.GCMusic) return;
  const KEY = 'gamecenter.music', POS = 'gamecenter.music.pos';
  const store = (s, k, v) => { try { if (v === undefined) return JSON.parse(s.getItem(k)); s.setItem(k, JSON.stringify(v)); } catch (e) { /* no storage */ } return null; };
  const ls = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const ss = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();
  let state = Object.assign({ src: 'game', url: '', vol: 70, side: 'right' }, (ls && store(ls, KEY)) || {});
  const GAME = (location.pathname.match(/\/games\/([a-z0-9-]+)\//) || [])[1] || null;
  // Games with music of their own; the other games get a generated playlist.
  const OWN_MUSIC = ['voidborn', 'starspire', 'driftwood', 'veky', 'klavesy'];
  const generated = () => state.src === 'game' && !!GAME && !OWN_MUSIC.includes(GAME);
  const lang = () => { try { return (ls && ls.getItem('gamecenter.lang')) === 'en' ? 'en' : 'cs'; } catch (e) { return 'cs'; } };
  const L = (cs, en) => (lang() === 'en' ? en : cs);

  // ── Links: YouTube (video, playlist, YouTube Music), SoundCloud (track, set), Spotify ──
  function parse(url) {
    let u;
    try { u = new URL(String(url || '').trim()); } catch (e) { return null; }
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    if (host === 'youtube.com' || host === 'youtu.be') {
      const id = host === 'youtu.be' ? u.pathname.slice(1) : u.pathname.startsWith('/shorts/') ? u.pathname.slice(8) : u.searchParams.get('v');
      const list = u.searchParams.get('list');
      const ok = s => !s || /^[\w-]{6,64}$/.test(s);
      if ((id || list) && ok(id) && ok(list)) return { kind: 'yt', id: id || null, list: list || null };
      return null;
    }
    if (host === 'soundcloud.com' && /^\/[\w-]+\/[\w-]+/.test(u.pathname)) return { kind: 'sc', url: `https://soundcloud.com${u.pathname}` };
    if (host === 'open.spotify.com') {
      const m = /^\/(?:intl-[a-z-]+\/)?(playlist|album|track|artist|episode|show)\/([A-Za-z0-9]{10,40})/.exec(u.pathname);
      if (m) return { kind: 'sp', uri: `spotify:${m[1]}:${m[2]}` };
    }
    return null;
  }
  const own = () => state.src === 'own' && !!parse(state.url);

  const fns = [];
  function save(next) {
    const wasUrl = state.url;
    state = Object.assign({}, state, next);
    if (ls) store(ls, KEY, state);
    if (state.url !== wasUrl && ss) ss.removeItem(POS);
    for (const f of fns) try { f(state.src === 'game'); } catch (e) { /* a game's handler */ }
    mount();
  }
  // Another tab (or a cloud sync) changed the setting.
  addEventListener('storage', e => { if (e.key === KEY && e.newValue) { try { state = Object.assign(state, JSON.parse(e.newValue)); } catch (x) { return; } for (const f of fns) f(state.src === 'game'); mount(); } });

  // ── Players: one adapter per service (play, pause, next, volume, position) ──
  const scripts = {};
  const load = src => scripts[src] || (scripts[src] = new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }));
  const pos = () => (ss && store(ss, POS)) || {};
  const remember = p => { if (ss) store(ss, POS, Object.assign({ url: state.url }, p)); };

  function youtube(el, t) {
    const saved = pos().url === state.url ? pos() : {};
    let p = null, ready = false, want = false;
    const api = window.YT && window.YT.Player ? Promise.resolve() : new Promise(ok => { const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { if (prev) prev(); ok(); }; load('https://www.youtube.com/iframe_api').catch(() => {}); });
    api.then(() => {
      const div = document.createElement('div'); el.appendChild(div);
      const vars = { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin };
      if (t.list) Object.assign(vars, { listType: 'playlist', list: t.list });
      const opts = {
        host: 'https://www.youtube-nocookie.com', width: 200, height: 200, playerVars: vars,
        events: {
          onReady: () => {
            ready = true; p.setVolume(state.vol);
            if (t.list && saved.i) p.cuePlaylist({ list: t.list, listType: 'playlist', index: saved.i, startSeconds: saved.t || 0 });
            else if (saved.t && t.id) p.cueVideoById({ videoId: t.id, startSeconds: saved.t });
            if (want) p.playVideo();
          },
          onStateChange: e => { if (e.data === 1) want = true; ui(); if (e.data === 0 && !t.list) p.playVideo(); },
          // a video that can't be embedded: try the next one
          onError: () => { if (t.list) p.nextVideo(); },
        },
      };
      // A playlist link has no video id: the API refuses an empty one.
      if (t.id) opts.videoId = t.id;
      p = new window.YT.Player(div, opts);
    });
    setInterval(() => { if (ready && p.getCurrentTime) remember({ i: t.list ? p.getPlaylistIndex() : 0, t: Math.floor(p.getCurrentTime() || 0) }); }, 2000);
    return {
      play() { want = true; if (ready) p.playVideo(); },
      pause() { want = false; if (ready) p.pauseVideo(); },
      next() { if (ready) { if (t.list) p.nextVideo(); else p.seekTo(0); } },
      volume(v) { if (ready) p.setVolume(v); },
      get playing() { return ready && p.getPlayerState && p.getPlayerState() === 1; },
      size: [200, 200],
    };
  }
  function soundcloud(el, t) {
    const saved = pos().url === state.url ? pos() : {};
    const f = document.createElement('iframe');
    f.allow = 'autoplay'; f.width = '100%'; f.height = '166';
    f.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(t.url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`;
    el.appendChild(f);
    let w = null, ready = false, want = false, restored = false, playing = false;
    load('https://w.soundcloud.com/player/api.js').then(() => {
      w = window.SC.Widget(f);
      const E = window.SC.Widget.Events;
      w.bind(E.READY, () => { ready = true; w.setVolume(state.vol); if (want) start(); });
      w.bind(E.PLAY, () => { playing = true; want = true; ui(); });
      w.bind(E.PAUSE, () => { playing = false; ui(); });
      w.bind(E.FINISH, () => { playing = false; ui(); });
      w.bind(E.PLAY_PROGRESS, e => { w.getCurrentSoundIndex(i => remember({ i, t: Math.floor(e.currentPosition / 1000) })); });
    }).catch(() => {});
    function start() {
      if (!restored && saved.t) { restored = true; if (saved.i) w.skip(saved.i); w.seekTo(saved.t * 1000); }
      restored = true; w.play();
    }
    return {
      play() { want = true; if (ready) start(); },
      pause() { want = false; if (ready) w.pause(); },
      next() { if (ready) w.next(); },
      volume(v) { if (ready) w.setVolume(v); },
      get playing() { return playing; },
      size: [300, 166],
    };
  }
  function spotify(el, t) {
    let c = null, want = false, playing = false;
    const div = document.createElement('div'); el.appendChild(div);
    const ready = new Promise(ok => { const prev = window.onSpotifyIframeApiReady; window.onSpotifyIframeApiReady = api => { if (prev) prev(api); ok(api); }; });
    load('https://open.spotify.com/embed/iframe-api/v1').catch(() => {});
    ready.then(api => api.createController(div, { uri: t.uri, width: '100%', height: 152 }, ctl => {
      c = ctl;
      c.addListener('playback_update', e => { playing = !e.data.isPaused; ui(); });
      if (want) c.play();
    }));
    return {
      play() { want = true; if (c) c.resume(); },
      pause() { want = false; if (c) c.pause(); },
      next() { /* Spotify's embed can't skip from outside */ },
      volume() { /* nor change the volume */ },
      get playing() { return playing; },
      size: [300, 152], noNext: true, noVol: true,
    };
  }

  // ── The music card (visible while your own music is on, as the services require) ──
  let card = null, player = null, playerUrl = null, kicked = false;
  // Everything is drawn in a shadow root: the games' own styles (buttons, inputs, fonts) must
  // not reach it, and its styles must not reach the games.
  const CSS = `
:host{all:initial}
*{box-sizing:border-box}
button{font:inherit;color:inherit;background:none;border:0;margin:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
svg{display:block;flex:none}
.gcm-card,.gcm-modal{font:400 14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#eeeaf8;-webkit-font-smoothing:antialiased;letter-spacing:normal;text-transform:none}
.gcm-card{position:fixed;bottom:12px;z-index:2147483000;display:flex;flex-direction:column;gap:6px;padding:6px;border-radius:16px;background:rgba(19,16,42,.94);box-shadow:0 14px 34px -12px #000,inset 0 0 0 1px rgba(255,255,255,.12);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);max-width:calc(100vw - 24px)}
.gcm-card.right{right:12px}.gcm-card.left{left:12px}
.gcm-card.mini .gcm-embed{position:absolute;left:-10000px;top:0}
.gcm-bar{display:flex;align-items:center;gap:2px}
.gcm-bar b{flex:1;display:flex;justify-content:center;color:#b99bff;padding:0 6px}
.gcm-bar button{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;color:#eeeaf8;transition:background .15s}
.gcm-bar button:hover,.gcm-bar button:focus-visible{background:rgba(255,255,255,.1);outline:none}
.gcm-bar svg{width:17px;height:17px}
.gcm-embed{border-radius:11px;overflow:hidden;background:#000;line-height:0}
.gcm-embed iframe{display:block;border:0;max-width:100%}
.gcm-modal{position:fixed;inset:0;z-index:2147483001;display:grid;place-items:center;padding:16px;background:rgba(4,3,12,.72);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.gcm-box{width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:24px;border-radius:20px;background:linear-gradient(180deg,#1b1735,#13102a);box-shadow:0 30px 80px -20px #000,inset 0 0 0 1px rgba(255,255,255,.12)}
.gcm-head{display:flex;align-items:center;gap:10px;color:#b99bff}
.gcm-head svg{width:22px;height:22px}
.gcm-head h2{margin:0;font-size:20px;line-height:1.2;font-weight:700;color:#fff}
.gcm-lead{margin:6px 0 18px;color:#aaa6c4;font-size:13px}
.gcm-opts{display:grid;gap:8px}
.gcm-opt{display:grid;grid-template-columns:18px 1fr;column-gap:14px;align-items:center;width:100%;padding:12px 14px;border-radius:14px;text-align:left;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);transition:background .15s,box-shadow .15s}
.gcm-opt:hover{background:rgba(255,255,255,.04)}
.gcm-opt:focus-visible{outline:2px solid #b99bff;outline-offset:2px}
.gcm-opt.on{background:rgba(185,155,255,.12);box-shadow:inset 0 0 0 1.5px #b99bff}
.gcm-radio{width:18px;height:18px;border-radius:50%;box-shadow:inset 0 0 0 2px #6f6a8e;transition:box-shadow .15s}
.gcm-opt.on .gcm-radio{box-shadow:inset 0 0 0 5px #b99bff}
.gcm-opt b{display:block;font-size:14px;font-weight:650;line-height:1.3;color:#fff}
.gcm-opt small{display:block;margin-top:2px;font-size:12.5px;line-height:1.35;color:#aaa6c4}
.gcm-now[hidden]{display:none}
.gcm-now{display:flex;align-items:center;gap:8px;margin:-2px 0 2px;padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.04)}
.gcm-now button{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
.gcm-now button:hover{background:rgba(255,255,255,.08)}
.gcm-now svg{width:15px;height:15px}
.gcm-now span{flex:1;min-width:0;padding-left:4px;font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gcm-now small{display:block;font-weight:400;font-size:11px;color:#aaa6c4}
.gcm-own{margin-top:12px}
.gcm-own input{display:block;width:100%;height:44px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:#0b0918;color:#fff;font:inherit;font-size:14px;outline:none;transition:border-color .15s,box-shadow .15s}
.gcm-own input::placeholder{color:#6f6a8e}
.gcm-own input:focus{border-color:#b99bff;box-shadow:0 0 0 3px rgba(185,155,255,.22)}
.gcm-svc{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px;font-size:12px;color:#aaa6c4}
.gcm-svc span{margin-right:2px}
.gcm-svc i{font-style:normal;padding:3px 9px;border-radius:999px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);color:#cfc9e6;transition:.15s}
.gcm-svc i.on{background:rgba(124,240,182,.14);box-shadow:inset 0 0 0 1px #7cf0b6;color:#7cf0b6}
.gcm-hint{margin:6px 2px 0;min-height:16px;font-size:12px;color:#aaa6c4}.gcm-hint.bad{color:#ff8a9a}.gcm-hint.ok{color:#7cf0b6}
.gcm-vol{display:grid;grid-template-columns:auto 1fr 3.2em;align-items:center;gap:14px;margin-top:18px;font-size:13px;color:#cfc9e6}
.gcm-vol output{text-align:right;font-variant-numeric:tabular-nums;color:#aaa6c4}
.gcm-vol input{-webkit-appearance:none;appearance:none;width:100%;height:4px;margin:0;border-radius:4px;background:linear-gradient(90deg,#b99bff var(--p,50%),rgba(255,255,255,.16) var(--p,50%));outline:none;cursor:pointer}
.gcm-vol input::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(185,155,255,.35),0 2px 6px rgba(0,0,0,.5);border:0}
.gcm-vol input::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(185,155,255,.35),0 2px 6px rgba(0,0,0,.5);border:0}
.gcm-vol input:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 5px rgba(185,155,255,.6)}
.gcm-acts{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
.gcm-acts button{height:40px;padding:0 18px;border-radius:12px;font-size:14px;font-weight:700;transition:filter .15s,background .15s}
.gcm-acts .sec{box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}.gcm-acts .sec:hover{background:rgba(255,255,255,.06)}
.gcm-acts .pri{background:#b99bff;color:#140f2a}.gcm-acts .pri:hover{filter:brightness(1.08)}
.gcm-acts button:focus-visible{outline:2px solid #b99bff;outline-offset:2px}`;
  const I = {
    note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    play: '<path d="M7 4.5l13 7.5-13 7.5z" fill="currentColor"/>',
    pause: '<path d="M7 4h4v16H7zM14 4h4v16h-4z" fill="currentColor"/>',
    next: '<path d="M5 5l10 7-10 7z" fill="currentColor"/><path d="M18 5v14"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    side: '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
    min: '<path d="M6 12h12"/>', max: '<path d="M6 15l6-6 6 6"/>',
  };
  const svg = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[id]}</svg>`;
  let root = null, preview = null;
  function shadow() {
    if (root && root.host.isConnected) return root;
    const host = document.createElement('div');
    host.id = 'gcm-host';
    host.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000';
    document.body.appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    return root;
  }

  // The generated default playlist of a puzzle game.
  let gen = null, genTimer = 0;
  function mountGen() {
    if (!generated()) { if (gen) gen.pause(); return; }
    const start = () => {
      gen = window.GCGen;
      if (!gen.ready) {
        gen.ready = true;
        const p = pos();
        gen.setup(GAME, p.url === `gen:${GAME}` ? p : null);
        gen.on(() => { ui(); if (genUi) genUi(); });
        genTimer = setInterval(() => { if (gen.playing) { if (ss) store(ss, POS, Object.assign({ url: `gen:${GAME}` }, gen.pos)); } }, 2000);
      }
      gen.volume(state.vol);
      if (kicked && !(ss && store(ss, 'gamecenter.music.paused'))) gen.play();
    };
    if (window.GCGen) start(); else load('/games/music-gen.js').then(start).catch(() => {});
  }
  let genUi = null;
  function mount() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', mount, { once: true }); return; }
    mountGen();
    if (!own()) { if (player) player.pause(); if (card) card.remove(); card = null; player = null; playerUrl = null; return; }
    if (!card) {
      card = document.createElement('div');
      card.className = 'gcm-card'; card.dataset.testid = 'music';
      card.innerHTML = `<div class="gcm-bar"><button data-m="toggle"></button><button data-m="next" title="${L('Další', 'Next')}">${svg('next')}</button><b>${svg('note')}</b><button data-m="side" title="${L('Přesunout', 'Move')}">${svg('side')}</button><button data-m="settings" title="${L('Nastavení hudby', 'Music settings')}">${svg('gear')}</button><button data-m="mini"></button></div><div class="gcm-embed"></div>`;
      card.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const m = b.dataset.m;
        if (m === 'toggle') { if (player.playing) { player.pause(); store(ss, 'gamecenter.music.paused', true); } else { player.play(); store(ss, 'gamecenter.music.paused', false); } }
        if (m === 'next') player.next();
        if (m === 'side') save({ side: state.side === 'right' ? 'left' : 'right' });
        if (m === 'settings') open();
        // the services' players must stay visible while they play: hiding pauses the music
        if (m === 'mini') { const mini = !card.classList.contains('mini'); card.classList.toggle('mini', mini); if (mini) { player.pause(); store(ss, 'gamecenter.music.paused', true); } ui(); }
        ui();
      });
      shadow().appendChild(card);
    }
    card.classList.toggle('left', state.side === 'left'); card.classList.toggle('right', state.side !== 'left');
    if (playerUrl !== state.url) {
      const embed = card.querySelector('.gcm-embed');
      embed.innerHTML = '';
      const t = parse(state.url);
      playerUrl = state.url;
      player = t.kind === 'yt' ? youtube(embed, t) : t.kind === 'sc' ? soundcloud(embed, t) : spotify(embed, t);
      embed.style.width = `${player.size[0]}px`;
      card.querySelector('[data-m="next"]').hidden = !!player.noNext;
      if (kicked && !(ss && store(ss, 'gamecenter.music.paused'))) player.play();
    }
    if (player && !player.noVol) player.volume(state.vol);
    ui();
  }
  function ui() {
    if (!card || !player) return;
    const mini = card.classList.contains('mini');
    const t = card.querySelector('[data-m="toggle"]');
    t.innerHTML = svg(player.playing ? 'pause' : 'play'); t.title = player.playing ? L('Pauza', 'Pause') : L('Přehrát', 'Play');
    if (mini && !player.playing) t.dataset.m = 'toggle';
    card.querySelector('[data-m="mini"]').innerHTML = svg(mini ? 'max' : 'min');
    card.querySelector('[data-m="mini"]').title = mini ? L('Zobrazit přehrávač', 'Show the player') : L('Skrýt přehrávač (pozastaví hudbu)', 'Hide the player (pauses the music)');
  }
  // Browsers start sound only after the player touches the page: the playlist starts (or
  // continues) with the first click or key press on each page, unless it was paused.
  function kick() {
    if (kicked) return;
    kicked = true;
    const paused = ss && store(ss, 'gamecenter.music.paused');
    if (player && card && !card.classList.contains('mini') && !paused) player.play();
    if (gen && generated() && !paused) gen.play();
  }
  // Any element with data-gcmusic opens the music settings (the games' settings screens).
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-gcmusic]')) open(); });
  addEventListener('pointerdown', kick, true);
  addEventListener('keydown', kick, true);

  // ── Settings ──
  function open() {
    const old = shadow().querySelector('.gcm-modal'); if (old) old.remove();
    const m = document.createElement('div');
    m.className = 'gcm-modal'; m.dataset.testid = 'music-settings';
    let src = state.src;
    const hint = v => { const t = parse(v); return !v ? ['', L('Vlož odkaz na playlist, album nebo skladbu.', 'Paste a link to a playlist, album or track.')] : t ? ['ok', t.kind === 'sp' ? L('Celé skladby ze Spotify uslyšíš, když jsi v prohlížeči přihlášený do Spotify.', 'You hear full Spotify tracks when signed in to Spotify in this browser.') : ''] : ['bad', L('Tenhle odkaz neznám. Funguje YouTube, SoundCloud a Spotify.', "I don't know this link. YouTube, SoundCloud and Spotify work.")]; };
    const opt = (id, title, desc) => `<button class="gcm-opt" data-src="${id}" role="radio"><span class="gcm-radio"></span><span><b>${title}</b><small>${desc}</small></span></button>`;
    m.innerHTML = `<div class="gcm-box" role="dialog" aria-modal="true" aria-label="${L('Hudba', 'Music')}">
      <div class="gcm-head">${svg('note')}<h2>${L('Hudba', 'Music')}</h2></div>
      <p class="gcm-lead">${L('Zvuky her hrají vždy, hudba pod nimi je na tobě.', 'Game sounds always play; the music under them is up to you.')}</p>
      <div class="gcm-opts" role="radiogroup">
        ${opt('game', L('Výchozí playlisty her', "The games' playlists"), L('Každá hra má svůj playlist.', 'Every game has a playlist of its own.'))}
        <div class="gcm-now" hidden><button data-a="gtoggle"></button><button data-a="gnext" title="${L('Další skladba', 'Next track')}">${svg('next')}</button><span></span></div>
        ${opt('own', L('Můj playlist', 'My playlist'), L('Odkaz z YouTube, SoundCloudu nebo Spotify. Hraje ve všech hrách.', 'A YouTube, SoundCloud or Spotify link. Plays in every game.'))}
        ${opt('off', L('Bez hudby', 'No music'), L('Jen zvuky her.', 'Game sounds only.'))}
      </div>
      <div class="gcm-own">
        <input type="url" inputmode="url" autocomplete="off" spellcheck="false" aria-label="${L('Odkaz na playlist', 'Playlist link')}" placeholder="${L('Vlož odkaz na playlist…', 'Paste a playlist link…')}" value="${(state.url || '').replace(/"/g, '&quot;')}">
        <div class="gcm-hint"></div>
        <div class="gcm-svc"><span>${L('Podporované služby', 'Supported services')}:</span><i data-k="yt">YouTube</i><i data-k="ytm">YouTube Music</i><i data-k="sc">SoundCloud</i><i data-k="sp">Spotify</i></div>
      </div>
      <label class="gcm-vol"><span>${L('Hlasitost', 'Volume')}</span><input type="range" min="0" max="100" step="5" value="${state.vol}"><output>${state.vol} %</output></label>
      <div class="gcm-acts"><button class="sec" data-a="cancel">${L('Zrušit', 'Cancel')}</button><button class="pri" data-a="save">${L('Uložit', 'Save')}</button></div></div>`;
    const input = m.querySelector('input[type=url]'), vol = m.querySelector('input[type=range]'), hintEl = m.querySelector('.gcm-hint');
    const draw = () => {
      m.querySelectorAll('[data-src]').forEach(b => { b.classList.toggle('on', b.dataset.src === src); b.setAttribute('aria-checked', b.dataset.src === src); });
      vol.style.setProperty('--p', `${vol.value}%`); m.querySelector('output').textContent = `${vol.value} %`;
      m.querySelector('.gcm-own').style.display = src === 'own' ? '' : 'none';
      m.querySelector('.gcm-vol').style.display = src === 'off' ? 'none' : '';
      const now = m.querySelector('.gcm-now'), g = src === 'game' && state.src === 'game' && gen && generated();
      now.hidden = !g;
      if (g) { now.querySelector('[data-a="gtoggle"]').innerHTML = svg(gen.playing ? 'pause' : 'play'); now.querySelector('span').innerHTML = `<small>${L('Teď hraje', 'Now playing')}</small>${gen.track}`; }
      const [cls, txt] = hint(input.value.trim()); hintEl.className = `gcm-hint ${cls}`; hintEl.textContent = txt;
      const t = parse(input.value.trim()), k = t && (t.kind === 'yt' && /music\.youtube\./.test(input.value) ? 'ytm' : t.kind);
      m.querySelectorAll('.gcm-svc i').forEach(i => i.classList.toggle('on', i.dataset.k === k));
    };
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-src],[data-a]');
      if (e.target === m) { close(); return; }
      if (!b) return;
      if (b.dataset.src) { src = b.dataset.src; draw(); if (src === 'own') input.focus(); return; }
      if (b.dataset.a === 'cancel') { close(); return; }
      if (b.dataset.a === 'gtoggle') { kicked = true; if (gen.playing) { gen.pause(); store(ss, 'gamecenter.music.paused', true); } else { gen.play(); store(ss, 'gamecenter.music.paused', false); } draw(); return; }
      if (b.dataset.a === 'gnext') { gen.next(); draw(); return; }
      const url = input.value.trim();
      if (src === 'own' && !parse(url)) { draw(); input.focus(); return; }
      kicked = true;
      if (ss) store(ss, 'gamecenter.music.paused', false);
      preview = null;
      save({ src, url: src === 'own' ? url : state.url, vol: +vol.value });
      genUi = null; m.remove();
    });
    input.addEventListener('input', draw);
    // the games' own music follows the slider right away
    const tell = () => { for (const f of fns) try { f(state.src === 'game'); } catch (e) { /* a game's handler */ } };
    vol.addEventListener('input', () => { preview = +vol.value; if (player && !player.noVol) player.volume(preview); if (gen) gen.volume(preview); tell(); draw(); });
    const close = () => { genUi = null; if (preview !== null) { preview = null; if (player && !player.noVol) player.volume(state.vol); if (gen) gen.volume(state.vol); tell(); } m.remove(); };
    genUi = () => { if (m.isConnected) draw(); };
    m.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
    m.addEventListener('pointerdown', e => e.stopPropagation());
    shadow().appendChild(m);
    draw();
  }

  window.GCMusic = {
    /** True while a game should play its own music (otherwise it plays only its sounds). */
    get gameMusic() { return state.src === 'game'; },
    /** The music volume as a factor of a game's own music (1 at the default 70 %). */
    get level() { return (preview !== null ? preview : state.vol) / 70; },
    /** Calls fn(gameMusic) whenever that changes. */
    on(fn) { fns.push(fn); },
    open,
    parse,
  };
  mount();
})();
