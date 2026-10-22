'use strict';
// ── Multiplayer (doplněno pro Windowling Game Center) ───────────────────────
// Svět (ostrov ze semínka, pokácené stromy, vytěžené kameny, stavby a čas) sdílí až
// 8 hráčů přes WebSocket do serveru Game Center (/api/driftwood). Každý má vlastní
// inventář, zdraví a zvířata; spoluhráče vidí jako postavy s přezdívkou a může s nimi
// psát (Enter). Hra sama zůstává stejná – tady se jen obalují její funkce.
const MP = (() => {
  const NICK_KEY = 'driftwood.nick';
  const WORLDS_KEY = 'driftwood.mp.worlds';
  const ROOM_KEY = code => `driftwood.mp.${code}`;
  const API = '/api/driftwood/rooms';
  const SEND_MS = 100;

  const st = {
    active: false, ws: null, code: null, meta: null, me: null, host: false,
    players: new Map(), applying: false, chatOpen: false, lastSend: 0, lastTime: 0, retry: 0, leaving: false,
  };

  // ── Úložiště ──
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez úložiště */ } };
  const nick = () => { try { return localStorage.getItem(NICK_KEY) || ''; } catch (e) { return ''; } };
  const setNick = v => { try { localStorage.setItem(NICK_KEY, String(v).trim().slice(0, 20)); } catch (e) { /* bez úložiště */ } };
  const worlds = () => read(WORLDS_KEY, []);
  const remember = (code, name) => write(WORLDS_KEY, [{ code, name }, ...worlds().filter(w => w.code !== code)].slice(0, 8));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const usersIcon = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/></svg>';

  // ── Obrazovky ──
  function screen(err) {
    const list = worlds();
    UI.screen(`<div class="panel mp"><h2>${usersIcon} ${L('Hra více hráčů', 'Multiplayer')}</h2>
      <div class="set"><label>${L('Tvoje přezdívka', 'Your nickname')}</label><input class="mp-in" id="mpNick" maxlength="20" value="${esc(nick())}" placeholder="${L('např. Trosečník', 'e.g. Castaway')}"></div>
      ${err ? `<p class="mp-err">${esc(err)}</p>` : ''}
      <h3>${L('Otevřené světy', 'Open worlds')}</h3>
      <div class="mp-list" id="mpRooms"><p class="muted">${L('Načítám…', 'Loading…')}</p></div>
      <div class="mp-row"><input class="mp-in mp-code" id="mpCode" maxlength="6" placeholder="${L('KÓD SVĚTA', 'WORLD CODE')}"><button class="btn" data-act="mpJoinCode">${L('Připojit se', 'Join')}</button></div>
      ${list.length ? `<h3>${L('Moje světy', 'My worlds')}</h3><div class="mp-list">${list.map(w => `<div class="mp-room"><div><b>${esc(w.name)}</b><span>${w.code}</span></div><button class="btn" data-mp-join="${w.code}">${L('Vstoupit', 'Enter')}</button></div>`).join('')}</div>` : ''}
      <h3>${L('Založit nový svět', 'Create a world')}</h3>
      <div class="modes mp-modes">${Object.entries(MODES).map(([k, v]) => `<button class="mode ${k === (st.mode || 'normal') ? 'sel' : ''}" data-mp-mode="${k}"><b>${v.name}</b><span>${v.desc}</span></button>`).join('')}</div>
      <div class="mp-row"><input class="mp-in" id="mpName" maxlength="30" placeholder="${L('Název světa (nepovinné)', 'World name (optional)')}"><input class="mp-in" id="mpSeed" maxlength="10" placeholder="${L('Semínko', 'Seed')}"></div>
      <div class="row"><button class="btn" data-act="back">${L('Zpět', 'Back')}</button><button class="btn primary" data-act="mpCreate">${icon('plus')} ${L('Založit svět', 'Create world')}</button></div>
    </div>`, 'm-panel');
    loadRooms();
  }
  async function loadRooms() {
    const box = $('#mpRooms');
    try {
      const { rooms } = await (await fetch(API, { cache: 'no-store' })).json();
      if (!box.isConnected) return;
      box.innerHTML = rooms.length ? rooms.map(r => `<div class="mp-room"><div><b>${esc(r.name)}</b><span>${MODES[r.mode] ? MODES[r.mode].name : esc(r.mode)} · ${r.players.map(esc).join(', ')}</span></div><button class="btn primary" data-mp-join="${r.code}">${L('Připojit', 'Join')}</button></div>`).join('')
        : `<p class="muted">${L('Teď nikdo nehraje. Založ svět a pošli kód kamarádům.', 'Nobody is playing right now. Create a world and share its code.')}</p>`;
    } catch (e) {
      if (box.isConnected) box.innerHTML = `<p class="mp-err">${L('Seznam světů se nepodařilo načíst.', 'Could not load the worlds.')}</p>`;
    }
  }
  function takeNick() {
    const n = $('#mpNick') && $('#mpNick').value.trim();
    if (n) setNick(n);
    if (!nick()) { const i = $('#mpNick'); if (i) { i.focus(); i.classList.add('bad'); } return false; }
    return true;
  }

  async function create() {
    if (!takeNick()) return;
    const seedTxt = $('#mpSeed').value.trim();
    let seed = parseInt(seedTxt, 10);
    if (!seedTxt || isNaN(seed) || seed < 0) seed = seedTxt ? [...seedTxt].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) : (Math.random() * 1e9) | 0;
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seed, mode: st.mode || 'normal', name: $('#mpName').value, nick: nick() }) });
      if (!res.ok) throw new Error(res.status);
      const { code } = await res.json();
      join(code);
    } catch (e) { screen(L('Svět se nepodařilo založit.', 'Could not create the world.')); }
  }

  async function join(code) {
    if (!takeNick()) return;
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    let meta;
    try {
      const res = await fetch(`${API}/${code}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      meta = await res.json();
    } catch (e) { screen(L(`Svět ${code || '?'} neexistuje.`, `World ${code || '?'} does not exist.`)); return; }
    if (meta.players >= 8) { screen(L('Svět je plný (8 hráčů).', 'The world is full (8 players).')); return; }
    UI.screen(`<div class="panel mp"><h2>${L('Připojuji…', 'Connecting…')}</h2><p class="muted">${esc(meta.name)} · ${meta.code}</p></div>`, 'm-panel');
    st.code = meta.code; st.meta = meta; st.retry = 0; st.leaving = false;
    remember(meta.code, meta.name);
    connect();
  }

  // ── Spojení ──
  function connect() {
    const ws = st.ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}${API}/${st.code}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', nick: nick(), look: SAVE.settings.look || defaultLook() }));
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } onMessage(m); };
    ws.onclose = () => {
      if (st.ws !== ws || st.leaving) return;
      if (!st.active) { screen(L('Do světa se nepodařilo připojit.', 'Could not connect to the world.')); return; }
      if (st.retry < 5) {
        st.retry++;
        UI.msg(L('Spojení přerušeno, připojuji znovu…', 'Connection lost, reconnecting…'));
        setTimeout(() => { if (st.active && !st.leaving) connect(); }, 1000 * st.retry);
      } else { UI.msg(L('Spojení se světem se ztratilo.', 'Lost the connection to the world.')); Game.save(); Game.toMenu(); }
    };
  }
  const send = m => { if (st.ws && st.ws.readyState === 1) st.ws.send(JSON.stringify(m)); };

  function onMessage(m) {
    switch (m.t) {
      case 'welcome': return welcome(m);
      case 'join': addPlayer(m); return;
      case 'leave': removePlayer(m.id); st.host = m.host === st.me; return;
      case 's': { const p = st.players.get(m.id); if (p) { p.target = m; if (!p.seen) { p.seen = true; p.x = m.x; p.y = m.y; p.z = m.z; p.yaw = m.yaw; } } return; }
      case 'chat': return chatLine(m);
      case 'node': return applyNode(m.k, m.i, m.r, true);
      case 'build': return applyBuild(m, true);
      case 'time': if (st.active) { if (G.day !== m.day || Math.abs(G.hour - m.hour) > 0.05) { G.day = m.day; G.hour = m.hour; } } return;
    }
  }

  function welcome(m) {
    st.me = m.you; st.host = m.host; st.retry = 0;
    if (st.active) {
      // znovu připojeno: jen obnovit spoluhráče
      for (const id of [...st.players.keys()]) removePlayer(id);
      for (const p of m.players) addPlayer(p);
      return;
    }
    const meta = m.meta;
    Sound.init();
    Game.built = false;
    Game.buildWorld(meta.seed);
    Object.assign(G, { mode: MODES[meta.mode] ? meta.mode : 'normal', hour: m.clock ? m.clock.hour : 8, day: m.clock ? m.clock.day : 1, flags: {}, won: false });
    Player.init();
    const mine = read(ROOM_KEY(meta.code), null);
    if (mine && mine.P) {
      Object.assign(Player.P, mine.P);
      Inv.slots = mine.inv.concat(new Array(INV_SIZE).fill(null)).slice(0, INV_SIZE);
      G.flags = mine.flags || {};
    } else {
      Inv.reset();
      Player.spawnOnBeach(mulberry32(meta.seed + 3));
    }
    st.applying = true;
    for (const s of m.structures) applyBuild(s, false);
    for (const [key, left] of m.nodes) { const [k, i] = key.split(':'); applyNode(k, +i, left, false); }
    st.applying = false;
    st.active = true;
    for (const p of m.players) addPlayer(p);
    $('#mpChat').hidden = false;
    $('#mpChatLog').innerHTML = '';
    for (const c of m.chat.slice(-8)) chatLine(c, true);
    Game.playing = true; Game.playStart();
    UI.msg(L(`Vítej ve světě ${meta.name}`, `Welcome to ${meta.name}`));
    hud();
  }

  // ── Svět ──
  function applyNode(k, i, left, fx) {
    const list = World.nodes[k], o = list && list[i];
    if (!o || !o.alive) return;
    st.applying = true;
    o.alive = false; o.respawn = left;
    World.refreshNode(o);
    st.applying = false;
    if (fx) Particles.burst(o.x, (o.y || 0) + 1, o.z, '#8f949a', 10, 3, 3);
  }
  function applyBuild(s, fx) {
    if (!STRUCTURES[s.type] || World.structures.some(o => o.type === s.type && Math.abs(o.x - s.x) < 0.01 && Math.abs(o.z - s.z) < 0.01)) return;
    st.applying = true;
    const o = World.addStructure(s.type, s.x, s.z, s.rot, true);
    st.applying = false;
    if (fx && o) Particles.burst(o.x, o.y + 0.3, o.z, '#c9a77a', 12, 3, 3);
  }

  // ── Spoluhráči ──
  function label(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = '600 30px Outfit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = Math.min(250, g.measureText(text).width + 28);
    g.fillStyle = 'rgba(18,16,12,0.6)'; g.beginPath(); g.roundRect ? g.roundRect(128 - w / 2, 10, w, 44, 22) : g.rect(128 - w / 2, 10, w, 44); g.fill();
    g.fillStyle = '#fbf6ec'; g.fillText(text, 128, 33);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, transparent: true }));
    sp.scale.set(1.6, 0.4, 1); sp.position.y = 2.25;
    return sp;
  }
  function addPlayer(p) {
    if (!st.active || p.id === st.me || st.players.has(p.id)) return;
    const char = new Character(p.look || defaultLook());
    char.root.add(label(p.nick));
    Game.scene.add(char.root);
    const s = p.state;
    const pl = { id: p.id, nick: p.nick, char, target: s, seen: !!s, x: s ? s.x : 0, y: s ? s.y : -50, z: s ? s.z : 0, yaw: s ? s.yaw : 0 };
    char.root.visible = !!s;
    st.players.set(p.id, pl);
    hud();
  }
  function removePlayer(id) {
    const p = st.players.get(id);
    if (!p) return;
    Game.scene.remove(p.char.root);
    st.players.delete(id);
    hud();
  }

  // ── Smyčka: pozice spoluhráčů a odesílání vlastní ──
  function tick(ms) {
    requestAnimationFrame(tick);
    if (!st.active) return;
    const dt = Math.min(1, (ms - (tick.last || ms)) / 1000); tick.last = ms;
    for (const p of st.players.values()) {
      const t = p.target;
      if (!t) continue;
      p.char.root.visible = true;
      // Plynule k poslední známé pozici – i při nízkém FPS (časově, ne po snímcích).
      const k = 1 - Math.exp(-dt * 12);
      p.x = lerp(p.x, t.x, k); p.y = lerp(p.y, t.y, k); p.z = lerp(p.z, t.z, k);
      let d = t.yaw - p.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      p.yaw += d * k;
      p.char.yaw = p.yaw;
      p.char.root.position.set(p.x, p.y, p.z);
      p.char.setState({ moving: t.m, sprint: t.sp, swim: t.sw, onGround: t.g, swing: t.w, item: t.it && ITEMS[t.it] ? t.it : null });
      p.char.update(Math.min(0.05, dt));
    }
    const P = Player.P;
    if (ms - st.lastSend > SEND_MS && P && !P.dead && Game.playing) {
      st.lastSend = ms;
      const s = Player.sel();
      send({ t: 's', x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3), m: Math.hypot(P.vx || 0, P.vz || 0) > 0.5, sp: !!P.sprint, sw: !!P.swim, g: !!P.onGround, w: +(P.swing || 0).toFixed(2), it: s ? s.id : null });
    }
    if (st.host && ms - st.lastTime > 10000) { st.lastTime = ms; send({ t: 'time', hour: G.hour, day: G.day }); }
  }
  requestAnimationFrame(tick);

  // ── Chat ──
  const chatEl = document.createElement('div');
  chatEl.id = 'mpChat'; chatEl.hidden = true;
  chatEl.innerHTML = `<div id="mpChatLog"></div><input id="mpChatIn" maxlength="200" hidden placeholder="${L('Napiš zprávu… (Enter odeslat, Esc zrušit)', 'Type a message… (Enter to send, Esc to cancel)')}">`;
  document.body.appendChild(chatEl);
  const bar = document.createElement('div');
  bar.id = 'mpBar'; bar.hidden = true;
  document.body.appendChild(bar);

  function chatLine(m, old) {
    const log = $('#mpChatLog');
    if (!log) return;
    const d = document.createElement('div');
    d.className = 'mp-line' + (m.sys ? ' sys' : '') + (old ? ' old' : '');
    d.innerHTML = m.sys
      ? esc(m.text === 'join' ? L(`${m.nick} se připojil(a)`, `${m.nick} joined`) : L(`${m.nick} odešel/odešla`, `${m.nick} left`))
      : `<b>${esc(m.nick)}</b> ${esc(m.text)}`;
    log.appendChild(d);
    while (log.children.length > 30) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    if (!m.sys && !old) Sound.play.ui && Sound.play.ui();
  }
  function openChat() {
    st.chatOpen = true;
    Game.unlock(true);
    chatEl.classList.add('open');
    const i = $('#mpChatIn'); i.hidden = false; i.value = ''; i.focus();
  }
  function closeChat(sendIt) {
    const i = $('#mpChatIn');
    const text = i.value.trim();
    if (sendIt && text) send({ t: 'chat', text });
    i.hidden = true; i.blur();
    chatEl.classList.remove('open');
    st.chatOpen = false;
    if (Game.playing && !Player.P.dead && !UI.invOpen && $('#overlay').hidden) Game.lock();
  }
  window.addEventListener('keydown', e => {
    if (!st.active || !Game.playing) return;
    if (st.chatOpen) {
      e.stopImmediatePropagation();
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); closeChat(true); }
      else if (e.code === 'Escape') { e.preventDefault(); closeChat(false); }
      return;
    }
    if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyT') && Game.locked && !UI.invOpen) {
      e.preventDefault(); e.stopImmediatePropagation(); openChat();
    }
  }, true);

  function hud() {
    bar.hidden = !st.active;
    if (!st.active) return;
    const names = [nick(), ...[...st.players.values()].map(p => p.nick)];
    bar.innerHTML = `${usersIcon} <b>${names.length}</b> <span>${names.map(esc).join(', ')}</span><em>${st.code}</em>`;
  }

  // ── Uložení vlastního stavu v tomhle světě ──
  function saveLocal() {
    const P = Player.P;
    if (!st.code || !P) return;
    if (P.dead && MODES[G.mode].perma) { try { localStorage.removeItem(ROOM_KEY(st.code)); } catch (e) { /* */ } return; }
    write(ROOM_KEY(st.code), {
      P: { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: P.pitch, hp: Math.max(1, P.hp), hunger: P.hunger, thirst: P.thirst, warmth: P.warmth, stamina: P.stamina, armor: P.armor, spawn: P.spawn, sel: P.sel },
      inv: Inv.slots, flags: G.flags,
    });
  }
  function leave() {
    st.leaving = true;
    if (st.ws) { try { st.ws.close(1000); } catch (e) { /* */ } }
    st.ws = null;
    for (const id of [...st.players.keys()]) removePlayer(id);
    st.active = false; st.chatOpen = false; st.code = null; st.meta = null;
    chatEl.hidden = true; chatEl.classList.remove('open'); bar.hidden = true;
    // svět z multiplayeru nesmí zůstat v menu: postavit znovu čistý
    Game.built = false;
  }

  // ── Napojení na hru ──
  const wrap = (obj, name, fn) => { const orig = obj[name]; obj[name] = function (...a) { return fn.call(this, orig, ...a); }; };

  // Vlastní změny světa jdou ostatním.
  wrap(World, 'refreshNode', function (orig, o) {
    const r = orig.call(this, o);
    if (st.active && !st.applying && !o.alive) send({ t: 'node', k: o.type, i: o.i, r: Math.max(1, Math.round(o.respawn || 60)) });
    return r;
  });
  wrap(World, 'addStructure', function (orig, type, x, z, rot, silent) {
    const s = orig.call(this, type, x, z, rot, silent);
    if (st.active && !st.applying) send({ t: 'build', type, x: s.x, z: s.z, rot: s.rot });
    return s;
  });
  // Nový den (i po spánku) dostanou všichni.
  wrap(Game, 'newDay', function (orig) { const r = orig.call(this); if (st.active) setTimeout(() => send({ t: 'time', hour: G.hour, day: G.day }), 0); return r; });
  // V multiplayeru se ukládá jen vlastní postava (zvlášť pro každý svět); sólo hra zůstává netknutá.
  wrap(Game, 'save', function (orig) { if (st.active) { saveLocal(); persist(); return; } return orig.call(this); });
  wrap(Game, 'die', function (orig) { const w = SAVE.world; const r = orig.call(this); if (st.active) { SAVE.world = w; saveLocal(); persist(); } return r; });
  wrap(Game, 'victory', function (orig) { const w = SAVE.world; const r = orig.call(this); if (st.active) { SAVE.world = w; persist(); try { localStorage.removeItem(ROOM_KEY(st.code)); } catch (e) { /* */ } } return r; });
  wrap(Game, 'toMenu', function (orig) { if (st.active) { saveLocal(); leave(); } return orig.call(this); });
  // Menu: položka Multiplayer. Nastavení: přezdívka. Pauza: kód světa.
  wrap(UI, 'menu', function (orig) {
    const r = orig.call(this);
    const nav = document.querySelector('#screen .menu nav');
    if (nav) {
      const b = document.createElement('button');
      b.className = 'mi'; b.dataset.act = 'mp';
      b.innerHTML = `${usersIcon} ${L('Hra více hráčů', 'Multiplayer')}`;
      nav.insertBefore(b, nav.querySelector('[data-act="ach"]'));
    }
    return r;
  });
  wrap(UI, 'settings', function (orig, keep) {
    const r = orig.call(this, keep);
    const first = document.querySelector('#screen .panel .set');
    if (first) {
      const row = document.createElement('div');
      row.className = 'set';
      row.innerHTML = `<label>${L('Přezdívka', 'Nickname')}<small class="sub">${L('Uvidí ji spoluhráči', 'Other players see it')}</small></label><input class="mp-in" id="setNick" maxlength="20" value="${esc(nick())}">`;
      first.after(row);
      row.querySelector('input').addEventListener('change', e => { setNick(e.target.value); hud(); });
    }
    return r;
  });
  wrap(UI, 'pause', function (orig) {
    const r = orig.call(this);
    const p = document.querySelector('#screen .panel.pause .muted');
    if (st.active && p) p.insertAdjacentHTML('afterend', `<p class="mp-code">${L('Kód světa', 'World code')} <b>${st.code}</b> · ${L('hráčů', 'players')} ${st.players.size + 1}</p>`);
    return r;
  });
  Object.assign(UI.acts, {
    mp: () => screen(),
    mpCreate: () => create(),
    mpJoinCode: () => join($('#mpCode').value),
  });
  document.addEventListener('click', e => {
    const j = e.target.closest('[data-mp-join]');
    if (j) { Sound.play.ui(); join(j.dataset.mpJoin); return; }
    const m = e.target.closest('[data-mp-mode]');
    if (m) { st.mode = m.dataset.mpMode; document.querySelectorAll('[data-mp-mode]').forEach(b => b.classList.toggle('sel', b === m)); }
  });
  document.addEventListener('keydown', e => {
    if (e.target && e.target.id === 'mpCode' && e.code === 'Enter') join(e.target.value);
  });
  window.addEventListener('beforeunload', () => { if (st.active) { saveLocal(); st.leaving = true; } });

  return { get active() { return st.active; }, get code() { return st.code; }, state: st, join, screen };
})();
