'use strict';
// ── Rozhraní (DOM) ──────────────────────────────────────────────────────────
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const fmtClock = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

// Úkoly vedoucí hráče k útěku
const OBJECTIVES = [
  { t: L('Seber větve a kamínky ze země (E)', 'Pick up branches and pebbles (E)'), done: () => Inv.count('wood') >= 3 && Inv.count('stone') >= 3 || SAVE.stats.tools > 0 },
  { t: L('Natrhej vlákna z rostlin (E)', 'Gather fiber from plants (E)'), done: () => Inv.count('fiber') >= 2 || SAVE.stats.tools > 0 },
  { t: L('Vyrob kamennou sekeru (Tab)', 'Craft a stone axe (Tab)'), done: () => Inv.count('stoneAxe') + Inv.count('ironAxe') > 0 || G.flags.axe },
  { t: L('Postav táborák před setměním', 'Build a campfire before nightfall'), done: () => World.structures.some(s => s.type === 'campfire') },
  { t: L('Najdi jezírko se sladkou vodou a napij se', 'Find a freshwater pond and drink'), done: () => G.flags.fresh },
  { t: L('Postav pracovní stůl', 'Build a workbench'), done: () => World.structures.some(s => s.type === 'workbench') },
  { t: L('Ulov zvíře kvůli kůži a masu', 'Hunt an animal for hide and meat'), done: () => Inv.count('hide') > 0 || G.flags.hide },
  { t: L('Postav přístřešek a přespi noc', 'Build a shelter and sleep through a night'), done: () => G.flags.slept },
  { t: L('Najdi železnou rudu v horách', 'Find iron ore in the mountains'), done: () => Inv.count('ironOre') > 0 || Inv.count('iron') > 0 || G.flags.ore },
  { t: L('Postav pec a vytav železo', 'Build a furnace and smelt iron'), done: () => SAVE.stats.iron > 0 && G.flags.iron },
  { t: L('Postav vor a uprchni z ostrova', 'Build a raft and escape the island'), done: () => false },
];

const UI = {
  invOpen: false, selSlot: null, station: null,
  init() {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-act],[data-slot],[data-craft],[data-mode],[data-lang],[data-view],[data-look]');
      if (!t) return;
      if (UI._dragged && t.dataset.slot !== undefined) return;
      Sound.play.ui();
      const d = t.dataset;
      if (d.act && UI.acts[d.act]) UI.acts[d.act](t);
      else if (d.slot !== undefined) UI.clickSlot(+d.slot);
      else if (d.craft !== undefined) UI.craft(+d.craft);
      else if (d.mode) { UI.mode = d.mode; UI.newGame(); }
      else if (d.lang) { Game.save(); setLang(d.lang); }
      else if (d.view) { SAVE.settings.view = +d.view; persist(); UI.settings(true); }
      else if (d.look) { const [k, i] = d.look.split(':'); const look = Object.assign(defaultLook(), SAVE.settings.look || {}); look[k] = +i; Game.setLook(look); UI.settings(true); }
    });
    document.addEventListener('input', e => {
      const d = e.target.dataset;
      if (d.vol) { SAVE.settings[d.vol] = +e.target.value; Sound.setVolume(d.vol, +e.target.value); persist(); }
      if (d.set) { SAVE.settings[d.set] = +e.target.value; Game.applySettings(); persist(); }
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
    this.initDrag();
  },

  // Přetahování v inventáři: na jiný slot = prohodit / doplnit stoh, mimo okno = vyhodit.
  initDrag() {
    let drag = null;
    const end = () => { if (drag && drag.ghost) drag.ghost.remove(); if (drag && drag.el) drag.el.classList.remove('dragging'); drag = null; };
    document.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !this.invOpen) return;
      const el = e.target.closest('#inv [data-slot]');
      if (!el || !Inv.slots[+el.dataset.slot]) return;
      drag = { i: +el.dataset.slot, el, x: e.clientX, y: e.clientY, ghost: null };
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
      }
      drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
      const out = !e.target.closest('.inv-panel');
      drag.ghost.classList.toggle('out', out);
    });
    document.addEventListener('pointerup', e => {
      if (!drag || !drag.ghost) { drag = null; return; }
      const from = drag.i;
      const over = document.elementFromPoint(e.clientX, e.clientY);
      const to = over && over.closest('#inv [data-slot]');
      const inPanel = over && over.closest('.inv-panel');
      end();
      // klik, který po puštění následuje, už slot nevybírá
      this._dragged = true; setTimeout(() => { this._dragged = false; }, 0);
      if (to) this.moveSlot(from, +to.dataset.slot);
      else if (!inPanel) Drops.dropSlot(from, 0);
      if (this.invOpen) this.renderInv();
      this.renderHotbar();
    });
    document.addEventListener('pointercancel', end);
  },
  moveSlot(a, b) {
    if (a === b) return;
    const s = Inv.slots[a], t = Inv.slots[b];
    if (s && t && s.id === t.id && ITEMS[s.id].stack > 1 && s.dur === undefined && t.dur === undefined && s.ch === undefined && t.ch === undefined) {
      const k = Math.min(s.n, ITEMS[s.id].stack - t.n);
      if (k > 0) { t.n += k; s.n -= k; if (!s.n) Inv.slots[a] = null; Sound.play.ui(); return; }
    }
    Inv.swap(a, b);
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
      <div class="brand"><h1>DRIFTWOOD</h1><p>${L('Přežij na opuštěném ostrově', 'Survive the forsaken island')}</p></div>
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
        <div><b>${S.wolves}</b><span>${L('vlků', 'wolves')}</span></div>
        <div><b>${S.trees}</b><span>${L('stromů', 'trees')}</span></div>
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
    UI.screen(`<div class="panel"><h2>${L('Nastavení', 'Settings')}</h2>
      <div class="set"><label>${L('Jazyk', 'Language')}</label><div class="lang">${['cs', 'en'].map(l => `<button class="${l === LANG ? 'on' : ''}" data-lang="${l}">${l.toUpperCase()}</button>`).join('')}</div></div>
      <div class="set"><label>${L('Citlivost myši', 'Mouse sensitivity')}</label><input type="range" min="0.3" max="2.5" step="0.05" value="${s.sens}" data-set="sens"></div>
      <div class="set"><label>${L('Zorné pole', 'Field of view')}</label><input type="range" min="60" max="100" step="1" value="${s.fov}" data-set="fov"></div>
      <div class="set"><label>${L('Pohled', 'Camera')}<small class="sub">${L('Klávesa V přepíná ve hře', 'Press V in game to switch')}</small></label><div class="lang">${[1, 3].map(v => `<button class="${(s.view || 1) === v ? 'on' : ''}" data-view="${v}">${v === 1 ? L('1. osoba', '1st person') : L('3. osoba', '3rd person')}</button>`).join('')}</div></div>
      <div class="set look"><label>${L('Vzhled postavy', 'Character look')}</label><div class="looks">${Object.keys(LOOKS).map(k => `<div class="lk"><span>${{ skin: L('Pleť', 'Skin'), hair: L('Vlasy', 'Hair'), shirt: L('Košile', 'Shirt'), pants: L('Kalhoty', 'Pants') }[k]}</span>${LOOKS[k].map((c, i) => `<button class="sw ${((s.look || defaultLook())[k]) === i ? 'on' : ''}" style="background:${c}" data-look="${k}:${i}"></button>`).join('')}</div>`).join('')}</div></div>
      <div class="set"><label>${L('Stíny', 'Shadows')}</label><button class="toggle ${s.shadows ? 'on' : ''}" data-act="toggleShadows"></button></div>
      <div class="set"><label>${L('Efekty a prostředí', 'Effects & ambience')}</label><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-vol="sfx"></div>
      <div class="set"><label>${L('Hudba', 'Music')}</label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-vol="music"></div>
      ${window.GCMusic ? `<div class="set"><label>${L('Vlastní playlist', 'Your playlist')}</label><button class="btn" data-gcmusic>${L('Nastavit hudbu', 'Music settings')}</button></div>` : ''}
      <div class="keys">
        <span><kbd>W A S D</kbd></span><span>${L('Pohyb', 'Move')}</span><span><kbd>Shift</kbd></span><span>${L('Sprint', 'Sprint')}</span><span><kbd>${L('Mezerník', 'Space')}</kbd></span><span>${L('Skok / plavání nahoru', 'Jump / swim up')}</span>
        <span><kbd>${L('Levé tl.', 'LMB')}</kbd></span><span>${L('Těžit, útočit, stavět', 'Harvest, attack, build')}</span><span><kbd>${L('Pravé tl.', 'RMB')}</kbd></span><span>${L('Jíst, pít, použít', 'Eat, drink, use')}</span>
        <span><kbd>E</kbd></span><span>${L('Sebrat, napít se, použít stavbu', 'Pick up, drink, use structure')}</span><span><kbd>Tab</kbd></span><span>${L('Inventář a výroba', 'Inventory & crafting')}</span><span><kbd>1–6</kbd></span><span>${L('Výběr v liště', 'Select hotbar slot')}</span><span><kbd>V</kbd></span><span>${L('Přepnout pohled 1./3. osoba', 'Toggle 1st/3rd person')}</span><span><kbd>Q</kbd></span><span>${L('Vyhodit předmět (Shift+Q celý stoh)', 'Drop item (Shift+Q whole stack)')}</span>
      </div>
      <div class="set"><label>${L('Smazat veškerý postup', 'Erase all progress')}</label><button class="btn danger" data-act="wipe">${L('Smazat', 'Erase')}</button></div>
      <button class="btn" data-act="${Game.playing ? 'resumePause' : 'back'}">${L('Zpět', 'Back')}</button></div>`, 'm-panel');
    UI.acts.resumePause = () => UI.pause();
  },
  pause() {
    UI.screen(`<div class="panel pause"><h2>${L('Pauza', 'Paused')}</h2>
      <p class="muted">${MODES[G.mode].name} · ${L('Den', 'Day')} ${G.day} · ${fmtClock(G.hour)}</p>
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
      $('#resume').innerHTML = L('Klikni pro pokračování · <kbd>Esc</kbd> menu', 'Click to continue · <kbd>Esc</kbd> menu');
    }
    this.renderHotbar();
  },
  bars: {},
  updateHud(P) {
    const set = (id, v) => { const r = Math.round(v); if (this.bars[id] === r) return; this.bars[id] = r; const el = $('#b-' + id); el.querySelector('i').style.width = clamp(v, 0, 100) + '%'; el.classList.toggle('low', v < 25); };
    set('hp', P.hp); set('food', P.hunger); set('water', P.thirst); set('warm', P.warmth); set('stam', P.stamina);
    const night = G.hour >= 20 || G.hour < 5.5;
    const clock = `${icon(night ? 'moon' : 'sun')} ${L('Den', 'Day')} ${G.day} · ${fmtClock(G.hour)}`;
    if (this._clock !== clock) { this._clock = clock; $('#clock').innerHTML = clock; }
    // kompas
    const deg = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360;
    $('#compass-strip').style.transform = `translateX(${180 - (deg + 360) * 2}px)`;
    // výzva
    const t = Player.target, it = Player.selItem();
    let prompt = '';
    if (it && it.place) prompt = Player.ghostOk ? L(`[LTM] Postavit: ${it.name}`, `[LMB] Place ${it.name}`) : L('Sem to postavit nejde', "Can't place here");
    else if (t) {
      if (t.kind === 'node') { const d = NODES[t.node.type]; prompt = d.gather ? `[E] ${L('Sebrat', 'Pick up')}: ${d.name}` : `[LMB] ${d.name}${d.needs && !(it && it.tool && it.tool.type === d.needs) ? L(' — potřebuješ krumpáč', ' — needs a pickaxe') : ''}`; }
      else if (t.kind === 'animal') prompt = `${t.a.d.name} <span class="hpm"><i style="width:${t.a.hp / t.a.d.hp * 100}%"></i></span>`;
      else if (t.kind === 'structure') prompt = `[E] ${ITEMS[t.s.type].name}${t.s.type === 'shelter' ? L(' — spát', ' — sleep') : t.s.type === 'raft' ? L(' — vyplout', ' — set sail') : L(' — výroba', ' — crafting')}`;
      else if (t.kind === 'drop') prompt = `[E] ${L('Sebrat', 'Pick up')}: <span style="color:${ITEMS[t.d.item.id].color}">${Drops.label(t.d)}</span>`;
      else if (t.kind === 'water') prompt = t.fresh ? L('[E] Napít se', '[E] Drink') : L('[E] Slaná voda', '[E] Salt water');
    }
    prompt = prompt.replace('[LTM]', '[LMB]');
    if (prompt !== this._prompt) { this._prompt = prompt; $('#prompt').innerHTML = prompt; $('#prompt').hidden = !prompt; }
    $('#cross').classList.toggle('on', !!t);
    // úkol
    const oi = OBJECTIVES.findIndex(o => !o.done());
    if (oi !== this._obj) { this._obj = oi; $('#objective').innerHTML = oi >= 0 ? `<small>${L('Úkol', 'Objective')} ${oi + 1}/${OBJECTIVES.length}</small>${OBJECTIVES[oi].t}` : ''; $('#objective').classList.remove('pop'); void $('#objective').offsetWidth; $('#objective').classList.add('pop'); }
    $('#resume').hidden = Game.locked || UI.invOpen || P.dead || !$('#screen').hidden || !$('#overlay').hidden;
    $('#under').classList.toggle('on', Game.cam.position.y < World.waterLevelAt(Game.cam.position.x, Game.cam.position.z) - 0.05);
  },
  renderHotbar() {
    $('#hotbar').innerHTML = Inv.slots.slice(0, HOTBAR).map((s, i) => this.slotHTML(s, i, Player.P && Player.P.sel === i)).join('');
    if (this.invOpen) this.renderInv();
  },
  slotHTML(s, i, sel) {
    if (!s) return `<div class="slot ${sel ? 'sel' : ''}" data-slot="${i}"><em>${i < HOTBAR ? i + 1 : ''}</em></div>`;
    const it = ITEMS[s.id];
    const dur = s.dur !== undefined && it.tool ? `<u style="width:${s.dur / it.tool.dur * 100}%"></u>` : s.ch !== undefined ? `<u class="ch" style="width:${s.ch / it.charges * 100}%"></u>` : '';
    return `<div class="slot ${sel ? 'sel' : ''} ${this.selSlot === i ? 'pick' : ''}" data-slot="${i}" style="--ic:${it.color}" title="${it.name}">${icon(it.icon)}${s.n > 1 ? `<b>${s.n}</b>` : ''}${dur}<em>${i < HOTBAR ? i + 1 : ''}</em></div>`;
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

  // ── Inventář a výroba ──
  // relock = false: zavřít bez zamčení myši (Esc) – hráč pokračuje kliknutím
  toggleInv(on, station, relock = true) {
    this.invOpen = on === undefined ? !this.invOpen : on;
    this.selSlot = null;
    $('#inv').hidden = !this.invOpen;
    if (this.invOpen) { this.station = station || null; Game.unlock(true); this.renderInv(); }
    else if (relock) Game.lock();
  },
  renderInv() {
    const P = Player.P;
    const near = t => !!World.stationNear(t, P.x, P.z);
    const rec = RECIPES.map((r, i) => ({ r, i, can: Inv.canCraft(r) && (!r.at || near(r.at)), stOk: !r.at || near(r.at) }));
    rec.sort((a, b) => (b.can - a.can) || (b.stOk - a.stOk) || a.i - b.i);
    $('#inv').innerHTML = `<div class="inv-panel">
      <div class="inv-left">
        <h3>${L('Inventář', 'Inventory')}${P.armor ? ` <span class="armor-tag">${icon('armor')} ${L('Zbroj', 'Armor')}</span>` : ''}</h3>
        <div class="grid">${Inv.slots.map((s, i) => this.slotHTML(s, i, false)).join('')}</div>
        <p class="hint">${L('Přetáhni předmět na jiný slot (nebo klikni na dva sloty). Přetažením mimo okno ho vyhodíš. Horní řada je lišta (1–6).', 'Drag an item to another slot (or click two slots). Drag it outside the window to drop it. The top row is your hotbar (1–6).')}</p>
        <div class="stations">${['campfire', 'workbench', 'furnace'].map(t => `<span class="${near(t) ? 'on' : ''}">${icon(ITEMS[t].icon)} ${ITEMS[t].name}</span>`).join('')}</div>
      </div>
      <div class="inv-right">
        <h3>${L('Výroba', 'Crafting')}</h3>
        <div class="recipes">${rec.map(({ r, i, can, stOk }) => {
          const it = ITEMS[r.out];
          return `<button class="recipe ${can ? 'can' : ''}" data-craft="${i}" ${can ? '' : 'aria-disabled="true"'} style="--ic:${it.color}">
            <span class="ri">${icon(it.icon)}</span>
            <span class="rt"><b>${it.name}${r.n > 1 ? ' ×' + r.n : ''}</b>
            <span class="cost">${Object.entries(r.cost).map(([id, n]) => `<i class="${Inv.count(id) >= n ? 'ok' : ''}">${n} ${ITEMS[id].name}</i>`).join('')}</span>
            ${r.at ? `<span class="at ${stOk ? 'ok' : ''}">${STATION_NAME[r.at]}</span>` : ''}</span>
          </button>`;
        }).join('')}</div>
      </div>
      <button class="close" data-act="closeInv">✕</button>
    </div>`;
  },
  clickSlot(i) {
    if (!this.invOpen) { Player.P.sel = i; this.renderHotbar(); return; }
    if (this.selSlot === null) { if (Inv.slots[i]) this.selSlot = i; }
    else { Inv.swap(this.selSlot, i); this.selSlot = null; }
    this.renderInv(); this.renderHotbar();
  },
  craft(i) {
    const r = RECIPES[i], P = Player.P;
    if (!Inv.canCraft(r) || (r.at && !World.stationNear(r.at, P.x, P.z))) { Sound.play.error(); return; }
    for (const [id, n] of Object.entries(r.cost)) Inv.remove(id, n);
    const left = Inv.add(r.out, r.n);
    if (left) { Sound.play.error(); UI.msg(L('Inventář je plný!', 'Inventory is full!')); for (const [id, n] of Object.entries(r.cost)) Inv.add(id, n); Inv.remove(r.out, r.n - left); }
    else {
      Sound.play.craft(); UI.gain(r.out, r.n);
      if (ITEMS[r.out].tool && r.out !== 'torch') { SAVE.stats.tools++; if (/Axe$/.test(r.out)) G.flags.axe = true; }
      if (r.out === 'iron') { SAVE.stats.iron++; G.flags.iron = true; }
      Game.checkAch();
    }
    this.renderInv(); this.renderHotbar();
  },
};
