'use strict';
// ── Rozhraní (DOM) ──────────────────────────────────────────────────────────
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const fmtClock = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const wrapPi = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

const UI = {
  invOpen: false, selSlot: null, station: null, chest: null, tab: 'bag', cat: 'all',
  init() {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-act],[data-slot],[data-cslot],[data-craft],[data-mode],[data-lang],[data-view],[data-look],[data-tab],[data-cat],[data-note],[data-set-toggle]');
      if (!t) return;
      if (UI._dragged && (t.dataset.slot !== undefined || t.dataset.cslot !== undefined)) return;
      Sound.play.ui();
      const d = t.dataset;
      if (d.act && UI.acts[d.act]) UI.acts[d.act](t);
      else if (d.slot !== undefined) UI.clickSlot(+d.slot, e.shiftKey);
      else if (d.cslot !== undefined) UI.clickChest(+d.cslot);
      else if (d.craft !== undefined) UI.craft(+d.craft, e.shiftKey);
      else if (d.mode) { UI.mode = d.mode; UI.newGame(); }
      else if (d.lang) { Game.save(); setLang(d.lang); }
      else if (d.view) { SAVE.settings.view = +d.view; persist(); UI.settings(true); }
      else if (d.look) { const [k, i] = d.look.split(':'); const look = Object.assign(defaultLook(), SAVE.settings.look || {}); look[k] = +i; Game.setLook(look); UI.settings(true); }
      else if (d.tab) { UI.tab = d.tab; if (d.tab !== 'bag') UI.chest = null; UI.renderInv(); }
      else if (d.cat) { UI.cat = d.cat; UI.renderInv(); }
      else if (d.note !== undefined) UI.note(+d.note, null, true);
      else if (d.setToggle) { SAVE.settings[d.setToggle] = !SAVE.settings[d.setToggle]; persist(); UI.settings(true); }
    });
    document.addEventListener('input', e => {
      const d = e.target.dataset;
      if (d.vol) { SAVE.settings[d.vol] = +e.target.value; Sound.setVolume(d.vol, +e.target.value); persist(); }
      if (d.set) { SAVE.settings[d.set] = +e.target.value; Game.applySettings(); persist(); }
    });
    document.addEventListener('contextmenu', e => {
      e.preventDefault();
      // pravé tlačítko na mapě smaže vlastní značku, na slotu použije předmět
      if (e.target.id === 'mapCv' && G.flags.pin) { delete G.flags.pin; Sound.play.ui(); UI.renderInv(); return; }
      const sl = e.target.closest && e.target.closest('#inv [data-slot]');
      if (sl && UI.invOpen && Inv.slots[+sl.dataset.slot]) { Player.use(Game.env, +sl.dataset.slot); UI.renderInv(); UI.renderHotbar(); }
    });
    // tooltipy předmětů a receptů
    const tip = document.createElement('div'); tip.id = 'tip'; tip.hidden = true; document.body.appendChild(tip);
    document.addEventListener('mouseover', e => {
      const el = e.target.closest && e.target.closest('#inv [data-slot], #inv [data-cslot], #inv [data-craft], #hotbar [data-slot]');
      if (!el || (!UI.invOpen && !el.closest('#hotbar'))) { tip.hidden = true; return; }
      const d = el.dataset;
      const html = d.craft !== undefined ? UI.recipeTip(RECIPES[+d.craft]) : UI.itemTip(d.cslot !== undefined ? UI.chest && UI.chest.items[+d.cslot] : Inv.slots[+d.slot]);
      if (!html) { tip.hidden = true; return; }
      tip.innerHTML = html; tip.hidden = false;
      const r = el.getBoundingClientRect();
      tip.style.left = Math.min(innerWidth - 270, r.right + 10) + 'px';
      tip.style.top = Math.max(10, Math.min(innerHeight - tip.offsetHeight - 10, r.top)) + 'px';
    });
    this.initDrag();
  },

  // ── Tooltipy ──
  itemTip(s) {
    if (!s) return '';
    const it = ITEMS[s.id], rows = [];
    if (it.tool) {
      if (it.tool.type === 'axe' || it.tool.type === 'pick') rows.push(L(`Síla ${it.tool.power} · poškození ${it.tool.dmg}`, `Power ${it.tool.power} · damage ${it.tool.dmg}`));
      else if (it.tool.type === 'weapon' || it.tool.type === 'torch') rows.push(L(`Poškození ${it.tool.dmg} · dosah ${it.tool.reach} m`, `Damage ${it.tool.dmg} · reach ${it.tool.reach} m`));
      if (s.dur !== undefined && it.id !== 'torch') rows.push(L(`Výdrž ${Math.ceil(s.dur)}/${it.tool.dur}`, `Durability ${Math.ceil(s.dur)}/${it.tool.dur}`));
    }
    if (it.food) {
      const f = it.food, parts = [];
      if (f.hunger) parts.push(`${icon('food')} +${f.hunger}`); if (f.thirst) parts.push(`${icon('water')} +${f.thirst}`);
      if (f.health) parts.push(`${icon('heart')} ${f.health > 0 ? '+' : ''}${f.health}`);
      rows.push(parts.join(' &nbsp; '));
      if (f.sick) rows.push(`<span class="bad">${L('Může ti být špatně – raději uvař', 'May make you sick – better cook it')}</span>`);
    }
    if (s.ch !== undefined) rows.push(L(`Doušky ${s.ch}/${it.charges}`, `Sips ${s.ch}/${it.charges}`));
    const use = it.food || it.armor || s.id === 'waterskin' ? `<i>${L('Pravé tlačítko: použít', 'Right click: use')}</i>` : it.place ? `<i>${L('Vyber v liště a postav levým tlačítkem', 'Select it on the hotbar and place with the left button')}</i>` : '';
    return `<b style="color:${it.color}">${icon(it.icon)} ${it.name}${s.n > 1 ? ` ×${s.n}` : ''}</b>${it.desc ? `<p>${it.desc}</p>` : ''}${rows.map(r => `<p>${r}</p>`).join('')}${use}`;
  },
  recipeTip(r) {
    const it = ITEMS[r.out];
    return this.itemTip({ id: r.out, n: r.n, dur: it.tool ? it.tool.dur : undefined, ch: it.charges }) + `<i>${L('Shift+klik: vyrobit 5×', 'Shift+click: craft 5×')}</i>`;
  },

  // Přetahování v inventáři a truhle: na jiný slot = prohodit / doplnit stoh, mimo okno = vyhodit.
  initDrag() {
    let drag = null;
    const end = () => { if (drag && drag.ghost) drag.ghost.remove(); if (drag && drag.el) drag.el.classList.remove('dragging'); drag = null; };
    const loc = el => (el.dataset.slot !== undefined ? { inv: Inv.slots, i: +el.dataset.slot } : UI.chest ? { inv: UI.chest.items, i: +el.dataset.cslot } : null);
    document.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !this.invOpen) return;
      const el = e.target.closest('#inv [data-slot], #inv [data-cslot]');
      const l = el && loc(el);
      if (!l || !l.inv[l.i]) return;
      drag = { from: l, el, x: e.clientX, y: e.clientY, ghost: null };
    });
    document.addEventListener('pointermove', e => {
      if (!drag) return;
      if (!drag.ghost) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
        drag.ghost = drag.el.cloneNode(true);
        drag.ghost.classList.add('drag-ghost'); drag.ghost.classList.remove('pick', 'sel');
        document.body.appendChild(drag.ghost);
        drag.el.classList.add('dragging');
        this.selSlot = null;
        $('#tip').hidden = true;
      }
      drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
      drag.ghost.classList.toggle('out', !e.target.closest('.inv-panel'));
    });
    document.addEventListener('pointerup', e => {
      if (!drag || !drag.ghost) { drag = null; return; }
      const from = drag.from;
      const over = document.elementFromPoint(e.clientX, e.clientY);
      const to = over && over.closest('#inv [data-slot], #inv [data-cslot]');
      const inPanel = over && over.closest('.inv-panel');
      end();
      // klik, který po puštění následuje, už slot nevybírá
      this._dragged = true; setTimeout(() => { this._dragged = false; }, 0);
      if (to) this.moveAny(from, loc(to));
      else if (!inPanel) {
        if (from.inv === Inv.slots) Drops.dropSlot(from.i, 0);
        else { const s = from.inv[from.i], P = Player.P; from.inv[from.i] = null; Drops.put(Drops.item(s, s.n), P.x - Math.sin(P.yaw) * 1.1, P.z - Math.cos(P.yaw) * 1.1); }
      }
      if (this.invOpen) this.renderInv();
      this.renderHotbar();
      Game.save();
    });
    document.addEventListener('pointercancel', end);
  },
  moveAny(a, b) {
    if (!a || !b || (a.inv === b.inv && a.i === b.i)) return;
    const s = a.inv[a.i], t = b.inv[b.i];
    if (s && t && s.id === t.id && ITEMS[s.id].stack > 1 && s.dur === undefined && t.dur === undefined && s.ch === undefined && t.ch === undefined) {
      const k = Math.min(s.n, ITEMS[s.id].stack - t.n);
      if (k > 0) { t.n += k; s.n -= k; if (!s.n) a.inv[a.i] = null; Sound.play.ui(); return; }
    }
    [a.inv[a.i], b.inv[b.i]] = [t || null, s];
    Sound.play.ui();
  },
  // přesun celého stohu do druhého úložiště (doplní stohy, pak volné místo)
  transfer(src, i, dst) {
    const s = src[i];
    if (!s) return;
    const it = ITEMS[s.id];
    if (it.stack > 1 && s.dur === undefined && s.ch === undefined) for (const t of dst) { if (!s.n) break; if (t && t.id === s.id && t.n < it.stack && t.dur === undefined && t.ch === undefined) { const k = Math.min(s.n, it.stack - t.n); t.n += k; s.n -= k; } }
    if (s.n) { const j = dst.indexOf(null); if (j < 0) { Sound.play.error(); UI.msg(L('Není místo', 'No room')); return; } dst[j] = Object.assign({}, s); s.n = 0; }
    src[i] = null;
    Sound.play.ui();
  },
  acts: {
    continue: () => Game.continueGame(),
    newMenu: () => UI.newGame(),
    back: () => UI.menu(),
    ach: () => UI.achievements(),
    settings: () => UI.settings(),
    hub: () => { Game.save(); location.href = '../../index.html'; },
    resume: () => Game.lock(),
    quit: () => { Game.save(); Game.toMenu(); },
    respawn: () => Game.respawn(),
    toMenu: () => Game.toMenu(),
    closeInv: () => UI.toggleInv(false),
    escapeYes: () => Game.victory(),
    escapeNo: () => { UI.hideOverlay(); Game.lock(); },
    closeNote: () => { UI.hideOverlay(); if (UI.invOpen) UI.renderInv(); else Game.lock(); },
    sortInv: () => UI.sortInv(),
    unequip: () => {
      const P = Player.P, id = P.armor === true ? 'hideArmor' : P.armor;
      if (!id) return;
      if (Inv.add(id, 1)) { UI.msg(L('Není místo v batohu', 'No room in your pack')); return; }
      P.armor = false; UI.renderInv(); UI.renderHotbar();
    },
    takeAll: () => { if (UI.chest) { for (let i = 0; i < UI.chest.items.length; i++) UI.transfer(UI.chest.items, i, Inv.slots); UI.renderInv(); UI.renderHotbar(); Game.save(); } },
    storeAll: () => { if (UI.chest) { for (let i = HOTBAR; i < INV_SIZE; i++) UI.transfer(Inv.slots, i, UI.chest.items); UI.renderInv(); UI.renderHotbar(); Game.save(); } },
    toggleShadows: () => { SAVE.settings.shadows = !SAVE.settings.shadows; Game.applySettings(); persist(); UI.settings(true); },
    wipe: () => { if (UI._wipe) { localStorage.removeItem(SAVE_KEY); SAVE = loadSave(); persist(); UI.menu(); } else { UI._wipe = true; $('[data-act="wipe"]').textContent = L('Opravdu smazat?', 'Really erase?'); } },
  },

  // ── Menu ──
  screen(html, cls = '') { const s = $('#screen'); s.className = cls; s.innerHTML = html; s.hidden = false; $('#hud').hidden = true; },
  hideScreen() { $('#screen').hidden = true; },
  menu() {
    UI._wipe = false;
    const W = SAVE.world, S = SAVE.stats;
    UI.screen(`<div class="menu">
      <div class="brand"><h1>DRIFTWOOD</h1><p>${L('Přežij na opuštěném ostrově a najdi cestu domů', 'Survive the forsaken island and find your way home')}</p></div>
      <nav>
        ${W ? `<button class="mi primary" data-act="continue">${icon('play')} ${L('Pokračovat', 'Continue')}<small>${MODES[W.mode].name} · ${L('Den', 'Day')} ${W.day}</small></button>` : ''}
        <button class="mi ${W ? '' : 'primary'}" data-act="newMenu">${icon('plus')} ${L('Nový ostrov', 'New Island')}</button>
        <button class="mi" data-act="ach">${icon('trophy')} ${L('Úspěchy', 'Achievements')}<small>${Object.keys(SAVE.achievements).length} / ${ACHIEVEMENTS.length}</small></button>
        <button class="mi" data-act="settings">${icon('gear')} ${L('Nastavení', 'Settings')}</button>
        <button class="mi" data-act="hub">${icon('home')} Game Center</button>
      </nav>
      <div class="menu-stats">
        <div><b>${S.bestDays}</b><span>${L('nejvíc dní', 'best days')}</span></div>
        <div><b>${S.escapes}</b><span>${L('útěků', 'escapes')}</span></div>
        <div><b>${S.fish || 0}</b><span>${L('ryb', 'fish')}</span></div>
        <div><b>${S.wolves}</b><span>${L('vlků', 'wolves')}</span></div>
        <div><b>${Object.keys(SAVE.notes || {}).length}/${NOTES.length}</b><span>${L('vzkazů', 'messages')}</span></div>
      </div>
    </div>`, 'm-menu');
  },
  newGame() {
    const m = UI.mode || 'normal';
    UI.screen(`<div class="panel newgame">
      <h2>${L('Nový ostrov', 'New Island')}</h2>
      <div class="modes">${Object.entries(MODES).map(([k, v]) => `<button class="mode ${k === m ? 'sel' : ''}" data-mode-sel="${k}" onclick="UI.mode='${k}';UI.newGame()"><b>${v.name}</b><span>${v.desc}</span></button>`).join('')}</div>
      <div class="seed"><label>${L('Semínko ostrova', 'Island seed')}</label><input id="seedIn" placeholder="${L('náhodné', 'random')}" maxlength="10"></div>
      ${SAVE.world ? `<p class="warn">${L('Současný ostrov bude ztracen.', 'Your current island will be lost.')}</p>` : ''}
      <div class="row"><button class="btn" data-act="back">${L('Zpět', 'Back')}</button><button class="btn primary" onclick="Game.startNew(UI.mode || 'normal', document.getElementById('seedIn').value)">${icon('play')} ${L('Vyplavit se na břeh', 'Wash Ashore')}</button></div>
    </div>`, 'm-panel');
  },
  achievements() {
    UI.screen(`<div class="panel wide"><h2>${L('Úspěchy', 'Achievements')}</h2><div class="ach-grid">${ACHIEVEMENTS.map(a => {
      const got = SAVE.achievements[a.id], [v, mx] = a.prog(SAVE);
      return `<div class="ach ${got ? 'got' : ''}">${icon(a.icon)}<div><b>${a.name}</b><span>${a.desc}</span><i><u style="width:${Math.min(100, v / mx * 100)}%"></u></i></div></div>`;
    }).join('')}</div><button class="btn" data-act="back">${L('Zpět', 'Back')}</button></div>`, 'm-panel');
  },
  settings(keep) {
    const s = SAVE.settings;
    const tog = (k, label, sub) => `<div class="set"><label>${label}${sub ? `<small class="sub">${sub}</small>` : ''}</label><button class="toggle ${s[k] ? 'on' : ''}" data-set-toggle="${k}"></button></div>`;
    UI.screen(`<div class="panel"><h2>${L('Nastavení', 'Settings')}</h2>
      <div class="set"><label>${L('Jazyk', 'Language')}</label><div class="lang">${['cs', 'en'].map(l => `<button class="${l === LANG ? 'on' : ''}" data-lang="${l}">${l.toUpperCase()}</button>`).join('')}</div></div>
      <div class="set"><label>${L('Citlivost myši', 'Mouse sensitivity')}</label><input type="range" min="0.3" max="2.5" step="0.05" value="${s.sens}" data-set="sens"></div>
      ${tog('invertY', L('Obrátit osu Y', 'Invert Y axis'))}
      <div class="set"><label>${L('Zorné pole', 'Field of view')}</label><input type="range" min="60" max="100" step="1" value="${s.fov}" data-set="fov"></div>
      ${tog('bob', L('Pohupování kamery při chůzi', 'Camera bob while walking'))}
      ${tog('toggleSprint', L('Sprint přepínáním', 'Toggle sprint'), L('Shift zapne a vypne sprint místo držení', 'Shift switches sprint on and off instead of holding'))}
      <div class="set"><label>${L('Pohled', 'Camera')}<small class="sub">${L('Klávesa V přepíná ve hře', 'Press V in game to switch')}</small></label><div class="lang">${[1, 3].map(v => `<button class="${(s.view || 1) === v ? 'on' : ''}" data-view="${v}">${v === 1 ? L('1. osoba', '1st person') : L('3. osoba', '3rd person')}</button>`).join('')}</div></div>
      <div class="set look"><label>${L('Vzhled postavy', 'Character look')}</label><div class="looks">${Object.keys(LOOKS).map(k => `<div class="lk"><span>${{ skin: L('Pleť', 'Skin'), hair: L('Vlasy', 'Hair'), shirt: L('Košile', 'Shirt'), pants: L('Kalhoty', 'Pants') }[k]}</span>${LOOKS[k].map((c, i) => `<button class="sw ${((s.look || defaultLook())[k]) === i ? 'on' : ''}" style="background:${c}" data-look="${k}:${i}"></button>`).join('')}</div>`).join('')}</div></div>
      <div class="set"><label>${L('Stíny', 'Shadows')}</label><button class="toggle ${s.shadows ? 'on' : ''}" data-act="toggleShadows"></button></div>
      <div class="set"><label>${L('Efekty a prostředí', 'Effects & ambience')}</label><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-vol="sfx"></div>
      <div class="set"><label>${L('Hudba', 'Music')}</label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-vol="music"></div>
      ${window.GCMusic ? `<div class="set"><label>${L('Vlastní playlist', 'Your playlist')}</label><button class="btn" data-gcmusic>${L('Nastavit hudbu', 'Music settings')}</button></div>` : ''}
      <div class="keys">
        <span><kbd>W A S D</kbd></span><span>${L('Pohyb', 'Move')}</span><span><kbd>Shift</kbd></span><span>${L('Sprint', 'Sprint')}</span><span><kbd>${L('Mezerník', 'Space')}</kbd></span><span>${L('Skok / plavání nahoru', 'Jump / swim up')}</span>
        <span><kbd>${L('Levé tl.', 'LMB')}</kbd></span><span>${L('Těžit, útočit, stavět, nahodit prut; držet = natáhnout luk', 'Harvest, attack, build, cast a rod; hold = draw the bow')}</span><span><kbd>${L('Pravé tl.', 'RMB')}</kbd></span><span>${L('Jíst, pít, použít', 'Eat, drink, use')}</span>
        <span><kbd>E</kbd></span><span>${L('Sebrat, napít se, použít stavbu, prozkoumat', 'Pick up, drink, use structure, explore')}</span><span><kbd>F</kbd></span><span>${L('Rychle se najíst nebo napít', 'Quick eat or drink')}</span>
        <span><kbd>Tab</kbd></span><span>${L('Batoh a výroba', 'Backpack & crafting')}</span><span><kbd>J</kbd> <kbd>M</kbd></span><span>${L('Deník úkolů · mapa ostrova', 'Quest journal · island map')}</span>
        <span><kbd>1–8</kbd></span><span>${L('Výběr v liště', 'Select hotbar slot')}</span><span><kbd>R</kbd></span><span>${L('Otočit stavbu', 'Rotate structure')}</span><span><kbd>V</kbd></span><span>${L('Přepnout pohled 1./3. osoba', 'Toggle 1st/3rd person')}</span><span><kbd>Q</kbd></span><span>${L('Vyhodit předmět (Shift+Q celý stoh)', 'Drop item (Shift+Q whole stack)')}</span>
      </div>
      <div class="set"><label>${L('Smazat veškerý postup', 'Erase all progress')}</label><button class="btn danger" data-act="wipe">${L('Smazat', 'Erase')}</button></div>
      <button class="btn" data-act="${Game.playing ? 'resumePause' : 'back'}">${L('Zpět', 'Back')}</button></div>`, 'm-panel');
    UI.acts.resumePause = () => UI.pause();
  },
  pause() {
    const q = Story.current();
    UI.screen(`<div class="panel pause"><h2>${L('Pauza', 'Paused')}</h2>
      <p class="muted">${MODES[G.mode].name} · ${L('Den', 'Day')} ${G.day} · ${fmtClock(G.hour)}</p>
      ${q ? `<p class="pause-q">${icon('book')} ${CHAPTERS[q.ch].name}: ${q.t}</p>` : ''}
      <div class="col"><button class="btn primary" data-act="resume">${icon('play')} ${L('Pokračovat', 'Resume')}</button>
      <button class="btn" data-act="settings">${icon('gear')} ${L('Nastavení', 'Settings')}</button>
      <button class="btn" data-act="quit">${L('Uložit a odejít do menu', 'Save & quit to menu')}</button></div>
      <p class="hint">${L('Klikni do hry pro pokračování', 'Click the game to resume')}</p></div>`, 'm-pause');
  },
  overlay(html) { const o = $('#overlay'); o.innerHTML = html; o.hidden = false; },
  hideOverlay() { $('#overlay').hidden = true; },

  // ── HUD ──
  hud() {
    $('#hud').hidden = false;
    this.hideScreen();
    if (!this._hudInit) {
      this._hudInit = true;
      for (const [id, ic] of [['hp', 'heart'], ['food', 'food'], ['water', 'water'], ['warm', 'temp']]) $('#b-' + id + ' span').innerHTML = icon(ic);
      const names = { 0: L('S', 'N'), 45: L('SV', 'NE'), 90: L('V', 'E'), 135: L('JV', 'SE'), 180: L('J', 'S'), 225: L('JZ', 'SW'), 270: L('Z', 'W'), 315: L('SZ', 'NW') };
      let h = '';
      for (let d = -360; d <= 720; d += 15) { const n = ((d % 360) + 360) % 360; h += `<span class="${n % 90 === 0 ? 'c' : n % 45 === 0 ? '' : 't'}" style="left:${(d + 360) * 2}px">${names[n] || '·'}</span>`; }
      $('#compass-strip').innerHTML = h;
      $('#compass').insertAdjacentHTML('beforeend', '<div id="marks"></div>');
      $('#bars').insertAdjacentHTML('beforebegin', '<div id="status"></div>');
      $('#cross').insertAdjacentHTML('afterend', '<div id="charge"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/></svg></div>');
      $('#resume').innerHTML = L('Klikni pro pokračování · <kbd>Esc</kbd> menu', 'Click to continue · <kbd>Esc</kbd> menu');
    }
    this._obj = null;
    this.renderHotbar();
  },
  bars: {},
  updateHud(P) {
    const set = (id, v) => { const r = Math.round(v); if (this.bars[id] === r) return; this.bars[id] = r; const el = $('#b-' + id); el.querySelector('i').style.width = clamp(v, 0, 100) + '%'; el.classList.toggle('low', v < 25); };
    set('hp', P.hp); set('food', P.hunger); set('water', P.thirst); set('warm', P.warmth); set('stam', P.stamina);
    const night = G.hour >= 20 || G.hour < 5.5;
    const wk = Weather.kind, clock = `${icon(night ? 'moon' : 'sun')} ${L('Den', 'Day')} ${G.day} · ${fmtClock(G.hour)}${wk !== 'clear' ? ` · ${icon(Weather.ICONS[wk])} ${Weather.NAMES[wk]}` : ''}`;
    if (this._clock !== clock) { this._clock = clock; $('#clock').innerHTML = clock; }
    // kompas a značky na něm
    const deg = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360;
    $('#compass-strip').style.transform = `translateX(${180 - (deg + 360) * 2}px)`;
    this.compassMarks(P);
    // výzva
    const t = Player.target, it = Player.selItem(), slot = Player.sel();
    let prompt = '';
    if (it && it.place) prompt = Player.ghostOk ? L(`[LMB] Postavit: ${it.name} · [R] otočit`, `[LMB] Place ${it.name} · [R] rotate`) : L('Sem to postavit nejde', "Can't place here");
    else if (slot && slot.id === 'fishingRod') {
      const F = Player.fish;
      prompt = F ? (F.state === 'bite' ? `<b class="hot">${L('ZÁBĚR! [LMB]', 'A BITE! [LMB]')}</b>` : L('Čekej na záběr… · [LMB] přitáhnout', 'Wait for a bite… · [LMB] reel in')) : Player.castPoint(Game.cam) ? L('[LMB] Nahodit', '[LMB] Cast') : '';
    } else if (slot && slot.id === 'bow') prompt = `${icon('arrow')} ${Inv.count('arrow')} · ${P.draw > 0 ? L('pusť pro výstřel', 'release to shoot') : L('drž [LMB] pro natažení', 'hold [LMB] to draw')}`;
    if (!prompt && t) {
      if (t.kind === 'node') { const d = NODES[t.node.type]; prompt = d.gather ? `[E] ${L('Sebrat', 'Pick up')}: ${d.name}` : `[LMB] ${d.name}${d.needs && !(it && it.tool && it.tool.type === d.needs) ? L(' — potřebuješ krumpáč', ' — needs a pickaxe') : ''}`; }
      else if (t.kind === 'animal') prompt = `${t.a.d.name} <span class="hpm"><i style="width:${t.a.hp / t.a.d.hp * 100}%"></i></span>`;
      else if (t.kind === 'structure') {
        const ty = t.s.type;
        if (ty === 'garden') { const g = World.cropGrowth(t.s); prompt = g < 0 ? L('[E] Záhon — zasadit bobule (2)', '[E] Garden bed — plant berries (2)') : g < 1 ? L(`Záhon — roste ${Math.round(g * 100)} %`, `Garden bed — growing ${Math.round(g * 100)}%`) : L('[E] Sklidit úrodu', '[E] Harvest the crop'); }
        else prompt = `[E] ${ITEMS[ty].name}${ty === 'shelter' ? L(' — spát', ' — sleep') : ty === 'raft' ? L(' — vyplout', ' — set sail') : ty === 'chest' ? L(' — otevřít', ' — open') : L(' — výroba', ' — crafting')}`;
      } else if (t.kind === 'drop') prompt = `[E] ${L('Sebrat', 'Pick up')}: <span style="color:${ITEMS[t.d.item.id].color}">${Drops.label(t.d)}</span>`;
      else if (t.kind === 'site') prompt = Sites.label(t.site);
      else if (t.kind === 'water') prompt = t.fresh ? L('[E] Napít se', '[E] Drink') : L('[E] Slaná voda', '[E] Salt water');
    }
    if (prompt !== this._prompt) { this._prompt = prompt; $('#prompt').innerHTML = prompt; $('#prompt').hidden = !prompt; }
    $('#cross').classList.toggle('on', !!t);
    // nátah luku
    const ch = $('#charge');
    if (ch) { ch.classList.toggle('on', P.draw > 0); if (P.draw > 0) ch.querySelector('circle').style.strokeDashoffset = 100 - P.draw * 100; }
    this.objective();
    this.status(P);
    this.flushXp();
    $('#resume').hidden = Game.locked || UI.invOpen || P.dead || !$('#screen').hidden || !$('#overlay').hidden;
    $('#under').classList.toggle('on', Game.cam.position.y < World.waterLevelAt(Game.cam.position.x, Game.cam.position.z) - 0.05);
  },
  // sledování úkolu: kapitola, hlavní úkol a denní úkoly
  objective() {
    const q = Story.current(), D = G.flags.daily;
    const key = `${q ? q.id : '-'}|${q && q.prog ? q.prog().join('/') : ''}|${D ? D.tasks.map(x => `${x.k}${Story.dprog(x)}${x.done}`).join(',') : ''}`;
    if (key === this._obj) return;
    const fresh = !this._obj || this._obj.split('|')[0] !== key.split('|')[0];
    this._obj = key;
    const p = q && q.prog ? q.prog() : null;
    $('#objective').innerHTML = (q ? `<small>${L('Kapitola', 'Chapter')} ${q.ch + 1} · ${CHAPTERS[q.ch].name}</small><b>${q.t}</b>${p ? ` <em>${p[0]}/${p[1]}</em>` : ''}` : `<small>${L('Hotovo', 'Done')}</small><b>${L('Všechny úkoly splněny', 'All objectives complete')}</b>`)
      + (D && D.tasks.length ? `<div class="daily">${D.tasks.map(x => `<span class="${x.done ? 'done' : ''}">${icon(x.done ? 'star' : 'plus')} ${Story.dtext(x)} <em>${Math.min(x.n, Story.dprog(x))}/${x.n}</em></span>`).join('')}</div>` : '');
    if (fresh) { const o = $('#objective'); o.classList.remove('pop'); void o.offsetWidth; o.classList.add('pop'); }
  },
  // ikony stavů nad ukazateli
  status(P) {
    const B = P.buffs || {}, list = [];
    if (B.fed) list.push(['fed', 'bowl', L('Sytý', 'Well fed'), Math.ceil(B.fed)]);
    if (B.sick) list.push(['sick', 'sick', L('Je ti zle', 'Sick'), Math.ceil(B.sick)]);
    if (P.wet > 0.25) list.push(['wet', 'water', L('Promoklý', 'Soaked'), 0]);
    if (P.warmth < 30) list.push(['cold', 'cold', L('Zima', 'Cold'), 0]);
    const arm = P.armor === true ? 'hideArmor' : P.armor;
    if (arm) list.push(['arm', ITEMS[arm].icon, ITEMS[arm].name, 0]);
    const html = list.map(([c, ic, n, s]) => `<span class="st ${c}" title="${n}">${icon(ic)}${s ? `<em>${s > 90 ? Math.ceil(s / 60) + 'm' : s + 's'}</em>` : ''}</span>`).join('');
    if (html !== this._status) { this._status = html; $('#status').innerHTML = html; }
  },
  compassMarks(P) {
    const marks = [], q = Story.current();
    const tgt = q && q.target ? q.target(P) : null;
    if (tgt) marks.push({ x: tgt.x, z: tgt.z, c: 'quest', ic: 'star', d: true });
    const home = World.structures.find(s => s.type === 'shelter') || (P.spawn && { x: P.spawn.x, z: P.spawn.z });
    if (home) marks.push({ x: home.x, z: home.z, c: 'home', ic: 'home' });
    if (G.flags.death && !P.dead) marks.push({ x: G.flags.death.x, z: G.flags.death.z, c: 'death', ic: 'skull', d: true });
    if (G.flags.pin) marks.push({ x: G.flags.pin.x, z: G.flags.pin.z, c: 'pin', ic: 'pin', d: true });
    if (typeof MP !== 'undefined' && MP.active) for (const p of MP.state.players.values()) marks.push({ x: p.x, z: p.z, c: 'mate', ic: null });
    // místo smrti zmizí, až k němu hráč dojde
    if (G.flags.death && Math.hypot(G.flags.death.x - P.x, G.flags.death.z - P.z) < 3) delete G.flags.death;
    const heading = -P.yaw;
    const html = marks.map(m => {
      const dx = m.x - P.x, dz = m.z - P.z, dist = Math.hypot(dx, dz);
      const rel = wrapPi(-Math.atan2(-dx, -dz) - heading) * 180 / Math.PI;
      if (Math.abs(rel) > 88 || dist < 2) return '';
      return `<span class="mk ${m.c}" style="left:${180 + rel * 2}px">${m.ic ? icon(m.ic) : '<i></i>'}${m.d && dist > 6 ? `<em>${Math.round(dist)} m</em>` : ''}</span>`;
    }).join('');
    if (html !== this._marks) { this._marks = html; $('#marks').innerHTML = html; }
  },
  renderHotbar() {
    $('#hotbar').innerHTML = Inv.slots.slice(0, HOTBAR).map((s, i) => this.slotHTML(s, i, Player.P && Player.P.sel === i)).join('');
    if (this.invOpen) this.renderInv();
  },
  slotHTML(s, i, sel, attr = 'slot') {
    const num = attr === 'slot' && i < HOTBAR ? i + 1 : '';
    if (!s) return `<div class="slot ${sel ? 'sel' : ''}" data-${attr}="${i}"><em>${num}</em></div>`;
    const it = ITEMS[s.id];
    const dur = s.dur !== undefined && it.tool ? `<u style="width:${s.dur / it.tool.dur * 100}%"></u>` : s.ch !== undefined ? `<u class="ch" style="width:${s.ch / it.charges * 100}%"></u>` : '';
    return `<div class="slot ${sel ? 'sel' : ''} ${attr === 'slot' && this.selSlot === i ? 'pick' : ''}" data-${attr}="${i}" style="--ic:${it.color}">${icon(it.icon)}${s.n > 1 ? `<b>${s.n}</b>` : ''}${dur}<em>${num}</em></div>`;
  },
  notify(txt, cls = '') {
    const f = $('#feed'), d = document.createElement('div');
    d.className = 'note ' + cls; d.innerHTML = txt; f.prepend(d);
    while (f.children.length > 6) f.lastChild.remove();
    setTimeout(() => d.remove(), 3500);
  },
  gain(id, n) { const it = ITEMS[id]; this.notify(`<span style="color:${it.color}">${icon(it.icon)}</span> +${n} ${it.name}`, 'gain'); },
  msg(t) { const m = $('#msg'); m.textContent = t; m.classList.remove('show'); void m.offsetWidth; m.classList.add('show'); },
  toast(a) {
    const t = document.createElement('div'); t.className = 'toast';
    t.innerHTML = `${icon(a.icon)}<div><small>${L('ÚSPĚCH', 'ACHIEVEMENT')}</small><b>${a.name}</b><span>${a.desc}</span></div>`;
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4800);
  },
  hurt(v) { const h = $('#hurt'); h.style.opacity = Math.min(0.85, v); },
  // zkušenosti se sčítají a hlásí jednou za chvíli (ne po každém úderu)
  _xp: {}, _xpT: 0,
  xpGain(k, n) { this._xp[k] = (this._xp[k] || 0) + n; },
  flushXp() {
    const now = performance.now();
    if (now - this._xpT < 1800) return;
    this._xpT = now;
    for (const k in this._xp) { if (this._xp[k] >= 3) this.notify(`<span style="color:${SKILLS[k].color}">${icon('up')}</span> +${this._xp[k]} XP ${SKILLS[k].name}`, 'xp'); }
    this._xp = {};
  },
  levelUp(k, l) {
    const S = SKILLS[k], d = document.createElement('div');
    d.className = 'banner lvl';
    d.innerHTML = `<small>${L('NOVÁ ÚROVEŇ', 'LEVEL UP')}</small><b style="color:${S.color}">${icon(S.icon)} ${S.name} ${l}</b><span>${S.perks(l).join(' · ')}</span>`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 4200);
  },
  chapter(ch) {
    const C = CHAPTERS[ch], d = document.createElement('div');
    d.className = 'banner chap';
    d.innerHTML = `<small>${L('KAPITOLA DOKONČENA', 'CHAPTER COMPLETE')}</small><b>${ch + 1}. ${C.name}</b>${C.reward.length ? `<span>${L('Odměna', 'Reward')}: ${C.reward.map(([id, n]) => `${n}× ${ITEMS[id].name}`).join(', ')}</span>` : ''}${CHAPTERS[ch + 1] ? `<span>${L('Další kapitola', 'Next chapter')}: ${CHAPTERS[ch + 1].name}</span>` : ''}`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 6000);
    Sound.play.achieve();
  },
  // čtení vzkazu z láhve nebo z ruin
  note(i, extra, fromJournal) {
    if (!fromJournal) Game.unlock(true);
    const ruin = i >= 5;
    this.overlay(`<div class="letter"><small>${ruin ? L('NÁPIS V RUINÁCH', 'CARVING IN THE RUINS') : L('VZKAZ V LÁHVI', 'MESSAGE IN A BOTTLE')} · ${i + 1}/${NOTES.length}</small>${extra ? `<h3>${icon('scroll')} ${extra}</h3>` : ''}<p>${NOTES[i]}</p><div class="row"><button class="btn primary" data-act="closeNote">${L('Zavřít', 'Close')}</button></div></div>`);
  },
  // plovoucí číslo poškození nad zásahem
  floatText(pos, text, cls = '') {
    const v = pos.clone().project(Game.cam);
    if (v.z > 1) return;
    const d = document.createElement('div');
    d.className = 'float ' + cls; d.textContent = text;
    d.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; d.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 900);
  },
  runStats() {
    const r = G.run || newRun(), S = Player.P && Player.P.skills;
    const items = [[r.trees, L('stromů', 'trees')], [r.rocks, L('skal', 'rocks')], [r.fish, L('ryb', 'fish')], [r.kills, L('úlovků', 'kills')], [r.crafted, L('výrobků', 'crafted')], [r.built, L('staveb', 'built')], [(r.dist / 1000).toFixed(1) + ' km', L('nachozeno', 'walked')]];
    return `<div class="runstats">${items.map(([v, n]) => `<div><b>${v}</b><span>${n}</span></div>`).join('')}</div>${S ? `<p class="muted">${Object.keys(SKILLS).map(k => `${SKILLS[k].name} ${S[k] ? S[k].l : 1}`).join(' · ')}</p>` : ''}`;
  },

  // ── Inventář, výroba, truhla, deník, mapa, dovednosti ──
  // relock = false: zavřít bez zamčení myši (Esc) – hráč pokračuje kliknutím
  toggleInv(on, station, relock = true) {
    this.invOpen = on === undefined ? !this.invOpen : on;
    this.selSlot = null;
    $('#inv').hidden = !this.invOpen;
    $('#tip').hidden = true;
    if (this.invOpen) { this.station = station || null; if (on === undefined || station) this.tab = 'bag'; Game.unlock(true); this.renderInv(); }
    else { this.chest = null; Game.save(); if (relock) Game.lock(); }
  },
  openTab(tab) { this.tab = tab; this.chest = null; if (!this.invOpen) this.toggleInv(true); else this.renderInv(); },
  openChest(s) { Sound.play.chest(); this.chest = s; this.tab = 'bag'; if (!this.invOpen) this.toggleInv(true); else this.renderInv(); },
  renderInv() {
    const P = Player.P;
    const tabs = [['bag', 'bag', L('Batoh', 'Backpack'), 'Tab'], ['journal', 'book', L('Deník', 'Journal'), 'J'], ['map', 'map', L('Mapa', 'Map'), 'M'], ['skills', 'up', L('Dovednosti', 'Skills'), '']];
    const body = this.tab === 'journal' ? this.journalHTML() : this.tab === 'map' ? this.mapHTML() : this.tab === 'skills' ? this.skillsHTML() : this.bagHTML(P);
    $('#inv').innerHTML = `<div class="inv-panel t-${this.tab}">
      <div class="tabs">${tabs.map(([k, ic, n, key]) => `<button class="${this.tab === k ? 'on' : ''}" data-tab="${k}">${icon(ic)} ${n}${key ? ` <kbd>${key}</kbd>` : ''}</button>`).join('')}</div>
      ${body}
      <button class="close" data-act="closeInv">✕</button>
    </div>`;
    if (this.tab === 'map') this.drawMap();
  },
  bagHTML(P) {
    const near = t => !!World.stationNear(t, P.x, P.z);
    const arm = P.armor === true ? 'hideArmor' : P.armor;
    const left = `<div class="inv-left">
        <h3>${L('Batoh', 'Backpack')}<button class="mini" data-act="sortInv">${L('Seřadit', 'Sort')}</button></h3>
        <div class="grid">${Inv.slots.map((s, i) => this.slotHTML(s, i, false)).join('')}</div>
        <div class="equip">${arm ? `<span>${icon(ITEMS[arm].icon)} ${ITEMS[arm].name}</span><button class="mini" data-act="unequip">${L('Svléknout', 'Take off')}</button>` : `<span class="muted">${L('Nemáš na sobě žádnou zbroj', 'No armor worn')}</span>`}</div>
        <p class="hint">${L('Přetáhni předmět na jiný slot, mimo okno ho vyhodíš. Pravé tlačítko předmět použije. Horní řada je lišta (1–8).', 'Drag items between slots, outside the window to drop. Right click uses an item. The top row is your hotbar (1–8).')}</p>
        <div class="stations">${['campfire', 'workbench', 'furnace'].map(t => `<span class="${near(t) ? 'on' : ''}">${icon(ITEMS[t].icon)} ${ITEMS[t].name}</span>`).join('')}</div>
      </div>`;
    if (this.chest) {
      return `${left}<div class="inv-right chest-side">
        <h3>${icon('chest')} ${ITEMS.chest.name}</h3>
        <div class="grid cgrid">${this.chest.items.map((s, i) => this.slotHTML(s, i, false, 'cslot')).join('')}</div>
        <div class="row left"><button class="btn" data-act="takeAll">${L('Vzít vše', 'Take all')}</button><button class="btn" data-act="storeAll">${L('Uložit batoh', 'Store backpack')}</button></div>
        <p class="hint">${L('Klik přesune stoh mezi truhlou a batohem. Lišta se při „Uložit batoh“ nepřesouvá.', 'Click moves a stack between the chest and your pack. "Store backpack" keeps your hotbar.')}</p>
      </div>`;
    }
    const rec = RECIPES.map((r, i) => ({ r, i, can: Inv.canCraft(r) && (!r.at || near(r.at)), stOk: !r.at || near(r.at) })).filter(o => this.cat === 'all' || o.r.cat === this.cat);
    rec.sort((a, b) => (b.can - a.can) || (b.stOk - a.stOk) || a.i - b.i);
    return `${left}<div class="inv-right">
        <h3>${L('Výroba', 'Crafting')}</h3>
        <div class="cats">${RECIPE_CATS.map(([k, n]) => `<button class="${this.cat === k ? 'on' : ''}" data-cat="${k}">${n}</button>`).join('')}</div>
        <div class="recipes">${rec.map(({ r, i, can, stOk }) => {
          const it = ITEMS[r.out];
          return `<button class="recipe ${can ? 'can' : ''}" data-craft="${i}" ${can ? '' : 'aria-disabled="true"'} style="--ic:${it.color}">
            <span class="ri">${icon(it.icon)}</span>
            <span class="rt"><b>${it.name}${r.n > 1 ? ' ×' + r.n : ''}</b>
            <span class="cost">${Object.entries(r.cost).map(([id, n]) => `<i class="${Inv.count(id) >= n ? 'ok' : ''}">${n} ${ITEMS[id].name}</i>`).join('')}</span>
            ${r.at ? `<span class="at ${stOk ? 'ok' : ''}">${STATION_NAME[r.at]}</span>` : ''}</span>
          </button>`;
        }).join('') || `<p class="muted">${L('Nic tu není.', 'Nothing here.')}</p>`}</div>
      </div>`;
  },
  journalHTML() {
    const cur = Story.current(), curCh = cur ? cur.ch : CHAPTERS.length;
    const chapters = CHAPTERS.map((C, ci) => {
      if (ci > curCh) return `<div class="chap locked"><h4>${icon('lock')} ${ci + 1}. ${L('Kapitola', 'Chapter')} ???</h4></div>`;
      const qs = QUESTS.filter(q => q.ch === ci);
      return `<div class="chap ${ci < curCh ? 'done' : 'cur'}"><h4>${ci + 1}. ${C.name}</h4><ul>${qs.map(q => {
        const done = Story.qdone(q), isCur = q === cur, p = q.prog ? q.prog() : null;
        if (!done && !isCur && ci === curCh) return `<li class="todo">???</li>`;
        return `<li class="${done ? 'ok' : isCur ? 'now' : ''}">${icon(done ? 'star' : 'play')} ${q.t}${p && !done ? ` <em>${p[0]}/${p[1]}</em>` : ''}</li>`;
      }).join('')}</ul></div>`;
    }).join('');
    const D = G.flags.daily;
    const daily = D ? D.tasks.map(t => `<div class="dt ${t.done ? 'ok' : ''}"><span>${icon(t.done ? 'star' : 'plus')} ${Story.dtext(t)}</span><i><u style="width:${Math.min(100, Story.dprog(t) / t.n * 100)}%"></u></i><small>${Math.min(t.n, Story.dprog(t))}/${t.n} · ${L('odměna', 'reward')} ${t.rw[1]}× ${ITEMS[t.rw[0]].name}</small></div>`).join('') : '';
    const found = G.flags.sites || {};
    const notes = NOTES.map((n, i) => {
      const site = Sites.list.find(s => s.note === i);
      const got = site ? found[site.id] : false;
      return got ? `<button class="nt" data-note="${i}">${icon(i >= 5 ? 'ruin' : 'note')} ${i + 1}. ${n.slice(0, 46)}…</button>` : `<span class="nt no">${icon('lock')} ${i + 1}. ???</span>`;
    }).join('');
    return `<div class="journal"><div class="jcol"><h3>${icon('book')} ${L('Příběh', 'Story')}</h3>${chapters}</div>
      <div class="jcol"><h3>${icon('star')} ${L('Denní úkoly', 'Daily tasks')} <small>${L('Den', 'Day')} ${G.day}</small></h3>${daily}<p class="hint left">${L('Každý den nové úkoly. Odměnou jsou zkušenosti a zásoby.', 'New tasks every day. They reward experience and supplies.')}</p>
      <h3>${icon('note')} ${L('Vzkazy', 'Messages')} <small>${notes.split('class="nt"').length - 1}/${NOTES.length}</small></h3><div class="notes">${notes}</div></div></div>`;
  },
  skillsHTML() {
    const S = Skills.all();
    return `<div class="skills">${Object.keys(SKILLS).map(k => {
      const d = SKILLS[k], s = S[k], max = s.l >= SKILL_MAX, need = xpNeed(s.l);
      return `<div class="skill" style="--sc:${d.color}"><h4>${icon(d.icon)} ${d.name} <b>${s.l}</b></h4><i><u style="width:${max ? 100 : s.x / need * 100}%"></u></i><small>${max ? L('Maximální úroveň', 'Max level') : `${Math.floor(s.x)} / ${need} XP`}</small>
        <ul>${d.perks(s.l).map(p => `<li>${p}</li>`).join('')}</ul>${max ? '' : `<p class="next">${L('Další úroveň', 'Next level')}: ${d.perks(s.l + 1).join(' · ')}</p>`}</div>`;
    }).join('')}</div>
    <h3 class="center">${L('Tento ostrov', 'This island')} · ${L('den', 'day')} ${G.day}</h3>${this.runStats()}
    <p class="hint">${L('Těžba roste kácením a těžbou, Lov lovem a rybařením, Přežití výrobou, stavěním, vařením a úkoly.', 'Gathering grows by chopping and mining, Hunting by hunting and fishing, Survival by crafting, building, cooking and quests.')}</p>`;
  },
  mapHTML() {
    return `<div class="mapwrap"><canvas id="mapCv" width="512" height="512"></canvas>
      <div class="legend">
        <span class="lg you">▲ ${L('Ty', 'You')}</span><span class="lg home">${icon('home')} ${L('Domov', 'Home')}</span><span class="lg quest">${icon('star')} ${L('Cíl úkolu', 'Objective')}</span>
        <span class="lg ruin">${icon('ruin')} ${L('Ruiny', 'Ruins')}</span><span class="lg crate">${icon('crate')} ${L('Vrak', 'Wreck')}</span><span class="lg pin">${icon('pin')} ${L('Tvoje značka', 'Your pin')}</span>
        <p class="hint left">${L('Mapa se odkrývá, kudy chodíš. Klikni pro vlastní značku (ukáže se na kompasu), pravým tlačítkem ji smažeš.', 'The map reveals where you walk. Click to set a pin (shown on your compass); right click removes it.')}</p>
      </div></div>`;
  },
  // obrázek ostrova (jednou na svět) a překryv prozkoumaného
  mapImage() {
    if (this._mapImg && this._mapSeed === G.seed) return this._mapImg;
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -HALF + (i + 0.5) / N * SIZE, z = -HALF + (j + 0.5) / N * SIZE, h = World.height(x, z);
      let r, gg, b;
      const pond = World.isFreshWater(x, z);
      if (pond) [r, gg, b] = [90, 190, 210];
      else if (h < 0) { const k = clamp(-h / 12, 0, 1); [r, gg, b] = [lerp(110, 30, k), lerp(200, 90, k), lerp(200, 140, k)]; }
      else if (h < 1.5) [r, gg, b] = [226, 210, 158];
      else if (h > 38) [r, gg, b] = [236, 240, 244];
      else if (h > 22) [r, gg, b] = [140, 138, 130];
      else { const k = clamp(h / 22, 0, 1); [r, gg, b] = [lerp(122, 80, k), lerp(170, 120, k), lerp(82, 60, k)]; }
      const sh = clamp((World.height(x - 2, z - 2) - h) * 0.12, -0.25, 0.25);
      const o = (j * N + i) * 4; img.data[o] = r * (1 - sh); img.data[o + 1] = gg * (1 - sh); img.data[o + 2] = b * (1 - sh); img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this._mapImg = c; this._mapSeed = G.seed;
    return c;
  },
  drawMap() {
    const cv = $('#mapCv');
    if (!cv) return;
    const g = cv.getContext('2d'), W = cv.width, P = Player.P;
    const toM = (x, z) => [(x + HALF) / SIZE * W, (z + HALF) / SIZE * W];
    g.imageSmoothingEnabled = true;
    g.drawImage(this.mapImage(), 0, 0, W, W);
    // mlha neprozkoumaného
    if (!Explore.bits) Explore.load(G.flags.ex);
    const cs = W / MAPN;
    // neprozkoumané je zahalené, obrys ostrova jen tušíš
    g.fillStyle = 'rgba(28,24,18,0.9)';
    for (let j = 0; j < MAPN; j++) for (let i = 0; i < MAPN; i++) if (!Explore.seen(i, j)) g.fillRect(i * cs, j * cs, cs, cs);
    const ic = (x, z, color, glyph, size = 14) => {
      const [mx, my] = toM(x, z);
      g.fillStyle = 'rgba(10,8,6,.65)'; g.beginPath(); g.arc(mx, my, size * 0.72, 0, Math.PI * 2); g.fill();
      g.fillStyle = color; g.font = `700 ${size}px Outfit, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyph, mx, my + 1);
    };
    const seenAt = (x, z) => { const [i, j] = Explore.cell(x, z); return Explore.seen(i, j); };
    for (const s of Sites.list) {
      if (!seenAt(s.x, s.z)) continue;
      if (s.kind === 'ruin') ic(s.x, s.z, Sites.used(s) ? '#8a9a8a' : '#7fe0d0', '◈', 15);
      else if (s.kind === 'crate' && !Sites.used(s)) ic(s.x, s.z, '#ffd88a', '▣', 12);
      else if (s.kind === 'lair') ic(s.x, s.z, '#ff7a6a', '☠', 13);
    }
    for (const s of World.structures) {
      const c = { campfire: '#ff8a3d', workbench: '#c08a52', furnace: '#bbb', shelter: '#ffcf7a', chest: '#b07a44', garden: '#8ac060', raft: '#e0c38a' }[s.type];
      if (c) { const [mx, my] = toM(s.x, s.z); g.fillStyle = c; g.fillRect(mx - 3, my - 3, 6, 6); }
    }
    const home = World.structures.find(s => s.type === 'shelter');
    if (home) ic(home.x, home.z, '#ffcf7a', '⌂', 15);
    const q = Story.current(), tgt = q && q.target ? q.target(P) : null;
    if (tgt && seenAt(tgt.x, tgt.z)) ic(tgt.x, tgt.z, '#ffd23a', '★', 15);
    if (G.flags.death) ic(G.flags.death.x, G.flags.death.z, '#ff8a7a', '✕', 13);
    if (G.flags.pin) ic(G.flags.pin.x, G.flags.pin.z, '#ff5ca8', '⚑', 14);
    if (typeof MP !== 'undefined' && MP.active) for (const p of MP.state.players.values()) { const [mx, my] = toM(p.x, p.z); g.fillStyle = '#7fe0d0'; g.beginPath(); g.arc(mx, my, 5, 0, Math.PI * 2); g.fill(); }
    // hráč: šipka ve směru pohledu
    const [px, py] = toM(P.x, P.z);
    g.save(); g.translate(px, py); g.rotate(-P.yaw);
    g.fillStyle = '#fff'; g.strokeStyle = '#1c1812'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.stroke(); g.fill();
    g.restore();
    cv.onclick = e => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * SIZE - HALF, z = (e.clientY - r.top) / r.height * SIZE - HALF;
      G.flags.pin = { x: +x.toFixed(1), z: +z.toFixed(1) };
      Sound.play.ui();
      this.drawMap();
    };
  },
  clickSlot(i, shift) {
    if (!this.invOpen) { Player.P.sel = i; this.renderHotbar(); return; }
    // s otevřenou truhlou klik přesune stoh do truhly
    if (this.chest) { this.transfer(Inv.slots, i, this.chest.items); this.renderInv(); this.renderHotbar(); return; }
    if (this.selSlot === null) { if (Inv.slots[i]) this.selSlot = i; }
    else { Inv.swap(this.selSlot, i); this.selSlot = null; }
    this.renderInv(); this.renderHotbar();
  },
  clickChest(i) {
    if (!this.chest) return;
    this.transfer(this.chest.items, i, Inv.slots);
    this.renderInv(); this.renderHotbar();
  },
  // seřadit batoh (lišta zůstane): podle druhu předmětu a spojit stohy
  sortInv() {
    const rest = Inv.slots.slice(HOTBAR).filter(Boolean);
    const order = Object.keys(ITEMS);
    const merged = [];
    for (const s of rest.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))) {
      const it = ITEMS[s.id], last = merged[merged.length - 1];
      if (last && last.id === s.id && it.stack > 1 && s.dur === undefined && last.dur === undefined && s.ch === undefined && last.ch === undefined && last.n < it.stack) {
        const k = Math.min(s.n, it.stack - last.n); last.n += k; s.n -= k;
        if (s.n) merged.push(s);
      } else merged.push(s);
    }
    for (let i = HOTBAR; i < INV_SIZE; i++) Inv.slots[i] = merged[i - HOTBAR] || null;
    this.renderInv(); this.renderHotbar();
  },
  craft(i, many) {
    const r = RECIPES[i], P = Player.P;
    let made = 0;
    for (let k = 0; k < (many ? 5 : 1); k++) {
      if (!Inv.canCraft(r) || (r.at && !World.stationNear(r.at, P.x, P.z))) break;
      for (const [id, n] of Object.entries(r.cost)) Inv.remove(id, n);
      const left = Inv.add(r.out, r.n);
      if (left) { UI.msg(L('Inventář je plný!', 'Inventory is full!')); for (const [id, n] of Object.entries(r.cost)) Inv.add(id, n); Inv.remove(r.out, r.n - left); break; }
      made++;
      runBump('crafted');
      if (ITEMS[r.out].tool && r.out !== 'torch') { SAVE.stats.tools++; if (/Axe$/.test(r.out)) G.flags.axe = true; if (/^iron/.test(r.out)) G.flags.ironTool = true; }
      if (r.out === 'iron') { SAVE.stats.iron++; G.flags.iron = true; }
      if (r.out === 'fishingRod') G.flags.rod = true;
      if (r.out === 'bow') G.flags.bow = G.flags.bow || Inv.count('arrow') > 0;
      if (r.out === 'arrow' && Inv.count('bow')) G.flags.bow = true;
      if (r.out === 'seaChart') { G.flags.chart = true; SAVE.stats.charts = (SAVE.stats.charts || 0) + 1; }
      if (r.at === 'campfire') runBump('cooked');
      Skills.add('survive', r.at === 'campfire' ? 4 : 3);
    }
    if (!made) { Sound.play.error(); return; }
    Sound.play.craft(); UI.gain(r.out, r.n * made);
    Game.checkAch();
    Story.update();
    this.renderInv(); this.renderHotbar();
  },
};
