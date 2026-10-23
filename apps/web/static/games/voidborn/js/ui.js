'use strict';
// ── Uživatelské rozhraní (DOM) ──────────────────────────────────────────────
const $ = s => document.querySelector(s);
const pct = v => Math.round(v * 100);
const signPct = v => (v >= 0 ? '+' : '') + Math.round(v * 100) + L(' %', '%');

const TIPS = L([
  'Každá zbraň na <b>maximální úrovni</b> se může vyvinout — potřebuje ale ten správný doplněk.',
  'Zlatá aura kolem nepřítele znamená <b>elitu</b>. Pusť se do ní — padá z ní truhla.',
  'Úskok (<b>Mezerník</b>) tě na okamžik učiní nezranitelným. Proleť skrz střely!',
  'Dokončený sektor odemkne <b>Overdrive</b> — těžší nepřátelé, ale mnohem víc střepů.',
  'Střepy z běhu si ponecháš i po smrti. Utrácej je v <b>Kovárně</b>.',
  'Karta se zlatým rámečkem <b>„Klíč k evoluci“</b> doplňuje recept některé z tvých zbraní.',
  'Kvantová kostka zvyšuje šanci na <b>čtvrtou kartu</b> při postupu na vyšší úroveň.',
  'Rozbušky (bílé hvězdy) se před výbuchem rozblikají. Drž si odstup!',
  'Magnet vysaje <b>všechny krystaly</b> na mapě. Bomba vyčistí obrazovku.',
  'Úspěchy odemykají nové <b>piloty</b>. Každý začíná s jinou zbraní.',
  'V nekonečném režimu po porážce Monarchy roste síla prázdnoty každou minutou.',
], [
  'Every weapon at <b>max level</b> can evolve — but it needs the right passive item.',
  'A golden aura around an enemy marks an <b>elite</b>. Take it down — it drops a chest.',
  'Dashing (<b>Space</b>) makes you briefly invulnerable. Fly straight through bullets!',
  'Clearing a sector unlocks <b>Overdrive</b> — tougher enemies, but far more shards.',
  'You keep the shards from a run even after death. Spend them in the <b>Forge</b>.',
  'A card marked <b>“Evolution key”</b> completes the recipe for one of your weapons.',
  'The Quantum Die raises the chance of a <b>fourth card</b> when you level up.',
  'Detonators (white stars) start blinking before they explode. Keep your distance!',
  'The magnet pulls in <b>every crystal</b> on the map. The bomb clears the screen.',
  'Achievements unlock new <b>pilots</b>. Each one starts with a different weapon.',
  'In endless mode after the Monarch falls, the void grows stronger every minute.',
]);

const ENEMY_NAMES = {
  drone: [L('Dron', 'Drone'), L('Základní lovec. Je jich hodně.', 'Basic hunter. There are many of them.')],
  swarmer: [L('Šipka', 'Dart'), L('Rychlá a křehká. Útočí v rojích.', 'Fast and fragile. Attacks in swarms.')],
  brute: [L('Kvádr', 'Brute'), L('Pomalý tank, který hodně vydrží.', 'A slow tank that takes a beating.')],
  shooter: [L('Střelec', 'Gunner'), L('Drží si odstup a pálí na tebe.', 'Keeps its distance and shoots at you.')],
  splitter: [L('Dělič', 'Splitter'), L('Po zničení se rozpadne na menší kusy.', 'Breaks into smaller pieces when destroyed.')],
  dasher: [L('Kopiník', 'Lancer'), L('Zamíří a bleskově vyrazí vpřed.', 'Takes aim, then charges at lightning speed.')],
  exploder: [L('Rozbuška', 'Detonator'), L('Přiblíží se, rozbliká a vybuchne.', 'Closes in, starts blinking, and explodes.')],
  tank: [L('Monolit', 'Monolith'), L('Obří pevnost z pozdějších vln.', 'A giant fortress from later waves.')],
  wisp: [L('Přízrak', 'Wisp'), L('Extrémně rychlý, ale slabý.', 'Extremely fast, but weak.')],
};

const UI = (() => {
  let current = null;
  const hs = { pilot: SAVE.lastPilot, sector: SAVE.lastSector || 0, od: SAVE.lastOd || 0 };
  let codexTab = 'weapons';
  let actions = {};
  let focusIdx = 0;
  let openedAt = 0;
  const hc = {};

  const pips = (n, max, cls = '') => `<div class="pips ${cls}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
  const topbar = (small, title, extra = '') => `<div class="topbar"><button class="back" data-go="menu" title="${L('Zpět', 'Back')} (Esc)">←</button><h2><small>${small}</small>${title}</h2><div class="spacer"></div>${extra}<div class="chip shard">${icon('shard')} ${fmtNum(SAVE.shards)}</div></div>`;
  const langSwitch = () => `<div class="lang">${['cs', 'en'].map(l => `<button class="${l === LANG ? 'on' : ''}" data-lang="${l}">${l.toUpperCase()}</button>`).join('')}</div>`;

  // ── Obrazovky ─────────────────────────────────────────────────────────────
  const screens = {
    title(el) {
      el.innerHTML = `<div><div class="logo" data-text="VOIDBORN">VOIDBORN</div><div class="tagline">${L('Přežij prázdnotu', 'Survive the void')}</div><div class="press">${L('Stiskni libovolnou klávesu', 'Press any key')}</div></div>`;
    },

    menu(el) {
      const S = SAVE.stats;
      const cleared = SECTORS.filter(s => SAVE.sectors[s.id] && SAVE.sectors[s.id].cleared).length;
      const achN = Object.keys(SAVE.achievements).length;
      const canBuy = FORGE.some(f => (SAVE.forge[f.id] || 0) < f.max && SAVE.shards >= forgeCost(f, SAVE.forge[f.id] || 0));
      const prog = (achN / ACHIEVEMENTS.length + cleared / SECTORS.length) / 2;
      el.innerHTML = `
        <div class="menu-left">
          <div class="logo" data-text="VOIDBORN">VOIDBORN</div>
          <div class="tagline">${L('Roguelite · Přežij prázdnotu', 'Roguelite · Survive the void')}</div>
          <nav class="menu-list">
            <button class="mi play" data-go="hangar">${icon('play')} ${L('Hrát', 'Play')} <small>${L('Hangár', 'Hangar')}</small></button>
            <button class="mi" data-go="forge">${icon('forge')} ${L('Kovárna', 'Forge')} ${canBuy ? '<span class="badge"></span>' : ''}</button>
            <button class="mi" data-go="ach">${icon('trophy')} ${L('Úspěchy', 'Achievements')} <small>${achN} / ${ACHIEVEMENTS.length}</small></button>
            <button class="mi" data-go="codex">${icon('book')} ${L('Kodex', 'Codex')}</button>
            <button class="mi" data-go="settings">${icon('gear')} ${L('Nastavení', 'Settings')}</button>
            <button class="mi" data-go="hub">${icon('home')} Game Center</button>
          </nav>
        </div>
        <aside class="profile">
          <h4>${L('STŘEPY PRÁZDNOTY', 'VOID SHARDS')}</h4>
          <div class="big-shards">${icon('shard')} ${fmtNum(SAVE.shards)}</div>
          <div class="kv">
            <span>${L('Nejdelší přežití', 'Longest survival')}</span><b>${fmtTime(S.bestTime)}</b>
            <span>${L('Zničeno nepřátel', 'Enemies destroyed')}</span><b>${fmtNum(S.kills)}</b>
            <span>${L('Poraženo bossů', 'Bosses defeated')}</span><b>${fmtNum(S.bossKills)}</b>
            <span>${L('Dobyté sektory', 'Sectors cleared')}</span><b>${cleared} / ${SECTORS.length}</b>
            <span>${L('Objevené evoluce', 'Evolutions found')}</span><b>${Object.keys(SAVE.evolutions).length} / 8</b>
            <span>${L('Odehráno', 'Time played')}</span><b>${fmtTime(S.time)}</b>
          </div>
          <div class="progress" title="${L('Celkový postup', 'Overall progress')}"><i style="width:${pct(prog)}%"></i></div>
          <div class="tip"><span class="tl">TIP</span>${pick(TIPS)}</div>
        </aside>
        <div class="version">VOIDBORN · v1.1 · ${L('WASD + MEZERNÍK', 'WASD + SPACE')}</div>
        <div class="corner-lang">${langSwitch()}</div>`;
    },

    hangar(el) {
      if (!PILOTS.find(p => p.id === hs.pilot && pilotUnlocked(p))) hs.pilot = 'vex';
      if (!sectorUnlocked(hs.sector)) hs.sector = 0;
      hs.od = clamp(hs.od, 0, sectorMaxOd(hs.sector));
      const pl = PILOTS.find(p => p.id === hs.pilot), sec = SECTORS[hs.sector];
      const wid = pl.weapon === 'random' ? null : pl.weapon;
      const rec = SAVE.sectors[sec.id];
      const maxOd = sectorMaxOd(hs.sector);
      el.innerHTML = `
        ${topbar(L('PŘÍPRAVA MISE', 'MISSION PREP'), L('HANGÁR', 'HANGAR'))}
        <div class="hangar">
          <div class="pilots">${PILOTS.map(p => {
            const un = pilotUnlocked(p), ach = p.unlock && ACHIEVEMENTS.find(a => a.id === p.unlock);
            const wi = p.weapon === 'random' ? 'luck' : WEAPONS[p.weapon].icon;
            return `<button class="pilot ${un ? '' : 'locked'} ${p.id === hs.pilot ? 'sel' : ''}" data-pilot="${p.id}" style="--c:${p.color}">
              <div class="pn">${un ? p.name : '???'}</div><div class="pr">${un ? p.role : L('Zamčeno', 'Locked')}</div>
              ${un ? `<div class="pw">${icon(wi)}</div>` : `<div class="lockmsg">${icon('lock')}<span>${ach.desc}</span></div>`}
            </button>`;
          }).join('')}</div>
          <div class="detail" style="--c:${pl.color}">
            <canvas class="ship-view" id="shipView" width="300" height="300"></canvas>
            <div class="role">${pl.role}</div>
            <h3>${pl.name}</h3>
            <p>${pl.desc}</p>
            <div class="perk">${icon(wid ? WEAPONS[wid].icon : 'luck')}<div><small>${L('Startovní zbraň', 'Starting weapon')}</small>${wid ? WEAPONS[wid].name : L('Náhodná', 'Random')}</div></div>
            <div class="perk">${icon('star')}<div><small>${L('Schopnost', 'Perk')}</small>${pl.perk}</div></div>
          </div>
        </div>
        <div class="sectors">${SECTORS.map((s, i) => {
          const un = sectorUnlocked(i), r = SAVE.sectors[s.id];
          return `<button class="sector ${un ? '' : 'locked'} ${i === hs.sector ? 'sel' : ''}" data-sector="${i}" style="--s1:${s.bg[0]};--s2:${s.bg[1]};--a:${s.accent}">
            <div class="rn">${s.roman}</div><div class="sn">${un ? s.name : L('Neznámý sektor', 'Unknown sector')}</div>
            <div class="sx">${un ? `${L('Odolnost', 'Toughness')} ×${s.hp} · ${L('Střepy', 'Shards')} ×${s.shards}` : L('Dokonči předchozí sektor', 'Clear the previous sector')}</div>
            ${r && r.cleared ? `<div class="done">${icon('trophy')}</div>` : ''}
          </button>`;
        }).join('')}</div>
        <div class="launch">
          <div class="sdesc"><b>${L('Sektor', 'Sector')} ${sec.roman} · ${sec.name}</b>${sec.desc}<br>${L('Nejlepší čas', 'Best time')}: ${fmtTime(rec ? rec.best || 0 : 0)} · ${L('Cíl: přežij 15:00 a poraz Monarchu', 'Goal: survive 15:00 and defeat the Monarch')}</div>
          <div class="od">
            <button data-od="-1" ${hs.od <= 0 ? 'disabled' : ''}>−</button>
            <div class="odv"><b>OVERDRIVE ${hs.od}</b><small>${hs.od ? L(`+${hs.od * 25} % odolnost · +${hs.od * 20} % střepů`, `+${hs.od * 25}% toughness · +${hs.od * 20}% shards`) : maxOd ? L('Zvyš obtížnost', 'Raise the difficulty') : L('Dokonči sektor k odemčení', 'Clear the sector to unlock')}</small></div>
            <button data-od="1" ${hs.od >= maxOd ? 'disabled' : ''}>+</button>
          </div>
          <button class="btn primary start" id="startBtn">${icon('rocket')} ${L('Vzlétnout', 'Launch')}</button>
        </div>`;
      const cv = $('#shipView'), x = cv.getContext('2d');
      x.translate(150, 150); x.rotate(-Math.PI / 2); x.scale(5, 5);
      Sprites.drawShip(x, pl.color);
    },

    forge(el) {
      const spent = FORGE.reduce((s, f) => { let c = 0; for (let l = 0; l < (SAVE.forge[f.id] || 0); l++) c += forgeCost(f, l); return s + c; }, 0);
      el.innerHTML = `
        ${topbar(L('TRVALÁ VYLEPŠENÍ', 'PERMANENT UPGRADES'), L('KOVÁRNA', 'FORGE'), spent ? `<button class="btn ghost" data-act="refund">${icon('reroll')} ${L('Vrátit vše', 'Refund all')}</button>` : '')}
        <div class="grid-cards">${FORGE.map(f => {
          const l = SAVE.forge[f.id] || 0, maxed = l >= f.max, cost = maxed ? 0 : forgeCost(f, l);
          return `<div class="fcard ${maxed ? 'maxed' : ''}" id="fc-${f.id}">
            <div class="fi">${icon(f.icon)}<div><h4>${f.name}</h4><p>${f.desc}</p></div></div>
            ${pips(l, f.max)}
            <button class="btn buy ${maxed ? 'ghost' : ''}" data-buy="${f.id}" ${maxed || SAVE.shards < cost ? 'disabled' : ''}>${maxed ? L('Maximum', 'Maxed') : `${icon('shard')} ${fmtNum(cost)}`}</button>
          </div>`;
        }).join('')}</div>`;
    },

    ach(el) {
      const n = Object.keys(SAVE.achievements).length;
      el.innerHTML = `
        ${topbar(L('SÍŇ SLÁVY', 'HALL OF FAME'), L('ÚSPĚCHY', 'ACHIEVEMENTS'), `<span class="sum">${n} / ${ACHIEVEMENTS.length}</span>`)}
        <div class="grid-cards">${ACHIEVEMENTS.map(a => {
          const got = !!SAVE.achievements[a.id], [v, m] = a.prog(SAVE, null);
          const pl = a.pilot && PILOTS.find(p => p.id === a.pilot);
          return `<div class="fcard ach ${got ? 'got' : ''}">
            <div class="fi">${icon(a.icon)}<div><h4>${a.name}</h4><p>${a.desc}</p></div></div>
            <div class="bar"><i style="width:${Math.min(100, v / m * 100)}%"></i></div>
            <div class="rw"><span>${got ? L('Splněno', 'Completed') : `${fmtNum(Math.min(v, m))} / ${fmtNum(m)}`}${pl ? ` · ${L('odemyká', 'unlocks')} ${pl.name}` : ''}</span><b>+${a.reward} ◆</b></div>
          </div>`;
        }).join('')}</div>`;
    },

    codex(el) {
      const tabs = [['weapons', L('Zbraně', 'Weapons')], ['passives', L('Doplňky', 'Passives')], ['evos', L('Evoluce', 'Evolutions')], ['enemies', L('Nepřátelé', 'Enemies')]];
      const unknown = L('Zatím neobjeveno.', 'Not discovered yet.');
      let body = '';
      if (codexTab === 'weapons') body = BASE_WEAPONS.map(id => {
        const d = WEAPONS[id], seen = SAVE.seen[id];
        return `<div class="fcard cx ${seen ? '' : 'unknown'}" style="--c:${d.color}"><div class="fi">${icon(d.icon)}<div><h4>${seen ? d.name : '???'}</h4><p>${seen ? d.desc : unknown}</p></div></div>
          ${seen ? `<p>${d.up.map((u, i) => `<b>${i + 2}:</b> ${u[1]}`).join(' · ')}</p>` : ''}</div>`;
      }).join('');
      else if (codexTab === 'passives') body = Object.entries(PASSIVES).map(([id, d]) => {
        const seen = SAVE.seen[id];
        return `<div class="fcard cx ${seen ? '' : 'unknown'}" style="--c:${d.color}"><div class="fi">${icon(d.icon)}<div><h4>${seen ? d.name : '???'}</h4><p>${seen ? `${d.desc} ${L('za úroveň', 'per level')} · max. ${d.max}` : unknown}</p></div></div></div>`;
      }).join('');
      else if (codexTab === 'evos') body = BASE_WEAPONS.map(id => {
        const b = WEAPONS[id], e = WEAPONS[b.evo], got = SAVE.evolutions[b.evo];
        return `<div class="fcard cx ${got ? '' : 'unknown'}" style="--c:${e.color}"><div class="fi">${icon(e.icon)}<div><h4>${got ? e.name : '???'}</h4><p>${got ? e.desc : L('Neobjevená evoluce.', 'Undiscovered evolution.')}</p></div></div>
          <div class="recipe">${SAVE.seen[id] ? b.name : '???'} (${L('úr.', 'lv.')} 8) + ${got ? PASSIVES[b.evoWith].name : '???'}</div></div>`;
      }).join('');
      else body = Object.entries(ENEMIES).filter(([k]) => k !== 'mini').map(([k, d]) => {
        const names = ENEMY_NAMES[k];
        return `<div class="fcard cx" style="--c:${d.color}"><div class="fi"><canvas width="64" height="64" data-enemy="${k}" style="width:40px;height:40px"></canvas><div><h4>${names[0]}</h4><p>${names[1]}</p></div></div></div>`;
      }).join('') + Object.values(BOSSES).map(b => `<div class="fcard cx" style="--c:${b.color}"><div class="fi">${icon('boss')}<div><h4>${b.name}</h4><p>${L('Boss sektoru. Vzorce útoků', 'Sector boss. Attack patterns')}: ${b.patterns.length}.</p></div></div></div>`).join('');
      el.innerHTML = `${topbar(L('ARCHIV', 'ARCHIVE'), L('KODEX', 'CODEX'))}
        <div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === codexTab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
        <div class="grid-cards">${body}</div>`;
      el.querySelectorAll('canvas[data-enemy]').forEach(c => {
        const d = ENEMIES[c.dataset.enemy], x = c.getContext('2d'), img = Sprites.enemy(d.shape, d.r, d.color, false, false);
        const s = 52 / (img.hw * 2) * Math.min(1.6, 26 / d.r);
        x.translate(32, 32); x.scale(s, s); x.drawImage(img, -img.hw, -img.hw, img.hw * 2, img.hw * 2);
      });
    },

    settings(el) {
      const s = SAVE.settings;
      el.innerHTML = `${topbar(L('KONFIGURACE', 'CONFIGURATION'), L('NASTAVENÍ', 'SETTINGS'))}
        <div class="settings">
          <div class="row"><label>${L('Jazyk', 'Language')}<small>Čeština / English</small></label>${langSwitch()}</div>
          <div class="row"><label>${L('Efekty', 'Effects')}<small>${L('Hlasitost zvukových efektů', 'Sound effects volume')}</small></label><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-vol="sfx"></div>
          <div class="row"><label>${L('Hudba', 'Music')}<small>${L('Generativní synthwave', 'Generative synthwave')}</small></label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-vol="music"></div>
          ${window.GCMusic ? `<div class="row"><label>${L('Vlastní playlist', 'Your playlist')}<small>${L('YouTube, SoundCloud, Spotify, nebo bez hudby', 'YouTube, SoundCloud, Spotify, or no music')}</small></label><button class="btn" data-gcmusic>${L('Nastavit hudbu', 'Music settings')}</button></div>` : ''}
          <div class="row"><label>${L('Otřesy obrazovky', 'Screen shake')}<small>${L('Při explozích a zásazích', 'On explosions and hits')}</small></label><button class="toggle ${s.shake ? 'on' : ''}" data-tog="shake"></button></div>
          <div class="row"><label>${L('Čísla poškození', 'Damage numbers')}<small>${L('Plovoucí čísla nad nepřáteli', 'Floating numbers above enemies')}</small></label><button class="toggle ${s.dmgNums ? 'on' : ''}" data-tog="dmgNums"></button></div>
          <div class="row"><label>${L('Počítadlo FPS', 'FPS counter')}</label><button class="toggle ${s.fps ? 'on' : ''}" data-tog="fps"></button></div>
          <div class="keys">
            <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>${L('Pohyb (nebo šipky / gamepad)', 'Move (or arrows / gamepad)')}</span>
            <span><kbd>${L('Mezerník', 'Space')}</kbd></span><span>${L('Úskok — krátká nezranitelnost', 'Dash — brief invulnerability')}</span>
            <span><kbd>Esc</kbd><kbd>P</kbd></span><span>${L('Pauza', 'Pause')}</span>
            <span><kbd>1</kbd>–<kbd>4</kbd></span><span>${L('Výběr karty při postupu', 'Pick a card on level-up')}</span>
            <span><kbd>R</kbd> / <kbd>X</kbd></span><span>${L('Přehodit / přeskočit karty', 'Reroll / skip cards')}</span>
            <span>${L('Zbraně', 'Weapons')}</span><span>${L('Střílí automaticky. Ty jen přežij.', 'They fire automatically. You just survive.')}</span>
          </div>
          <div class="row"><label>${L('Smazat postup', 'Erase progress')}<small>${L('Nevratně vymaže všechny střepy, úspěchy a odemčení', 'Permanently erases all shards, achievements and unlocks')}</small></label><button class="btn danger" data-act="wipe">${L('Smazat', 'Erase')}</button></div>
        </div>`;
    },
  };

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    current = id;
    if (!id) return;
    const el = $('#s-' + id);
    actions = {};
    screens[id](el);
    el.classList.add('active');
    el.scrollTop = 0;
  }
  function rerender() {
    if (!current) return;
    const el = $('#s-' + current), st = el.scrollTop;
    screens[current](el);
    el.scrollTop = st;
  }

  // ── Delegované události ───────────────────────────────────────────────────
  function init() {
    let lastHover = null;
    document.addEventListener('pointerover', e => {
      const b = e.target.closest('button');
      if (b && b !== lastHover && !b.disabled) { lastHover = b; Sound.play.hover(); }
      if (!b) lastHover = null;
    });
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-go],[data-pilot],[data-sector],[data-od],[data-buy],[data-tab],[data-tog],[data-act],[data-pick],[data-lang],#startBtn,#pauseBtn');
      if (!t) return;
      if (t.blur) t.blur();
      const ds = t.dataset;
      if (ds.go) {
        if (ds.go === 'hub') { Sound.play.back(); persist(); setTimeout(() => { location.href = '../../index.html'; }, 120); return; }
        ds.go === 'menu' ? Sound.play.back() : Sound.play.click();
        show(ds.go);
      } else if (ds.lang) {
        Sound.play.click(); persist(); setLang(ds.lang);
      } else if (ds.pilot) {
        const p = PILOTS.find(p => p.id === ds.pilot);
        if (!pilotUnlocked(p)) { Sound.play.error(); return; }
        hs.pilot = p.id; Sound.play.select(); rerender();
      } else if (ds.sector) {
        hs.sector = +ds.sector; hs.od = Math.min(hs.od, sectorMaxOd(hs.sector));
        Render.setAttractSector(SECTORS[hs.sector]);
        Sound.play.select(); rerender();
      } else if (ds.od) {
        hs.od = clamp(hs.od + +ds.od, 0, sectorMaxOd(hs.sector)); Sound.play.click(); rerender();
      } else if (t.id === 'startBtn') {
        Game.start(hs.pilot, hs.sector, hs.od);
      } else if (t.id === 'pauseBtn') {
        Game.togglePause();
      } else if (ds.buy) {
        buy(ds.buy);
      } else if (ds.tab) {
        codexTab = ds.tab; Sound.play.click(); rerender();
      } else if (ds.tog) {
        SAVE.settings[ds.tog] = !SAVE.settings[ds.tog]; persist(); Sound.play.click(); rerender();
      } else if (ds.pick !== undefined) {
        if (performance.now() - openedAt < 300) return;
        pickChoice(+ds.pick);
      } else if (ds.act) {
        const fn = actions[ds.act] || globalActs[ds.act];
        if (fn) fn();
      }
    });
    document.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset && t.dataset.vol) {
        SAVE.settings[t.dataset.vol] = +t.value;
        Sound.setVolume(t.dataset.vol, +t.value);
        persist();
      }
    });
  }

  const globalActs = {
    refund() {
      confirm(L('Vrátit vylepšení?', 'Refund upgrades?'), L('Všechny utracené střepy se ti vrátí a můžeš je rozdělit znovu.', 'All spent shards are returned so you can spend them again.'), () => {
        let sum = 0;
        for (const f of FORGE) for (let l = 0; l < (SAVE.forge[f.id] || 0); l++) sum += forgeCost(f, l);
        SAVE.shards += sum; SAVE.forge = {}; persist(); Sound.play.buy(); hideOverlay(); rerender();
      });
    },
    wipe() {
      confirm(L('Smazat veškerý postup?', 'Erase all progress?'), L('Tohle nejde vrátit. Přijdeš o všechny střepy, piloty, sektory a úspěchy.', 'This cannot be undone. You will lose all shards, pilots, sectors and achievements.'), () => {
        resetSave(); Sound.play.error(); hideOverlay(); show('menu');
      });
    },
  };

  function buy(id) {
    const f = FORGE.find(f => f.id === id), l = SAVE.forge[id] || 0;
    if (l >= f.max) return;
    const cost = forgeCost(f, l);
    if (SAVE.shards < cost) { Sound.play.error(); return; }
    SAVE.shards -= cost;
    SAVE.forge[id] = l + 1;
    Sound.play.buy();
    checkAchievements(false);
    persist();
    rerender();
    const c = $('#fc-' + id); if (c) c.classList.add('bought');
  }

  // ── Překryvy ──────────────────────────────────────────────────────────────
  function overlay(html, acts = {}) {
    const o = $('#overlay');
    o.innerHTML = html;
    o.hidden = false;
    actions = acts;
    openedAt = performance.now();
  }
  function hideOverlay() { const o = $('#overlay'); o.hidden = true; o.innerHTML = ''; actions = {}; }
  const overlayOpen = () => !$('#overlay').hidden;

  function confirm(title, text, yes) {
    const prev = actions;
    overlay(`<div class="ov confirm"><div class="ov-panel"><div class="ov-title" style="font-size:28px">${title}</div><p>${text}</p>
      <div class="ov-actions"><button class="btn danger" data-act="yes">${L('Potvrdit', 'Confirm')}</button><button class="btn ghost" data-act="no">${L('Zrušit', 'Cancel')}</button></div></div></div>`,
    { yes, no: () => { if (prev.__restore) prev.__restore(); else hideOverlay(); } });
  }

  function choiceInfo(c) {
    const lvl = L('Úroveň ', 'Level '), nw = L('Nové', 'New');
    if (c.kind === 'weapon') {
      const d = WEAPONS[c.id];
      return { name: d.name, color: d.color, icon: d.icon, badge: c.isNew ? nw : lvl + c.lvl, isNew: c.isNew, desc: c.isNew ? d.desc : d.up[c.lvl - 2][1], type: L('Zbraň', 'Weapon'), lvl: c.lvl, max: 8 };
    }
    if (c.kind === 'passive') {
      const d = PASSIVES[c.id];
      return { name: d.name, color: d.color, icon: d.icon, badge: c.isNew ? nw : lvl + c.lvl, isNew: c.isNew, desc: d.desc, type: L('Doplněk', 'Passive'), lvl: c.lvl, max: d.max, hint: c.evoHint && WEAPONS[c.evoHint].name };
    }
    if (c.kind === 'evo') {
      const d = WEAPONS[c.id];
      return { name: d.name, color: '#ffd166', icon: d.icon, badge: L('Evoluce', 'Evolution'), desc: d.desc, type: L('Evoluce', 'Evolution') + ' · ' + WEAPONS[c.from].name, evo: true };
    }
    if (c.kind === 'heal') return { name: L('Nanoopravy', 'Nano-repair'), color: '#5dffa8', icon: 'heal', badge: 'Bonus', desc: L('Obnoví 40 bodů zdraví.', 'Restores 40 HP.'), type: L('Spotřební', 'Consumable') };
    return { name: L('Hromádka střepů', 'Shard pile'), color: '#e08bff', icon: 'shard', badge: 'Bonus', desc: L('Získej hrst střepů navíc.', 'Grab a handful of extra shards.'), type: L('Spotřební', 'Consumable') };
  }

  function showLevelUp(choices, quick) {
    focusIdx = 0;
    overlay(`<div class="ov">
      <div class="lvl-head"><span>${L('ÚROVEŇ', 'LEVEL')}</span><b>${G.level - G.pendingLevels + 1}</b></div>
      <div class="ov-sub">${L('Vyber vylepšení', 'Choose an upgrade')}${G.pendingLevels > 1 ? L(` · čeká ještě ${G.pendingLevels - 1}`, ` · ${G.pendingLevels - 1} more waiting`) : ''}</div>
      <div class="cards">${choices.map((c, i) => {
        const f = choiceInfo(c);
        return `<button class="card ${f.evo ? 'evo' : ''} ${i === 0 ? 'focus' : ''}" data-pick="${i}" style="--c:${f.color};animation-delay:${quick ? 0 : i * 0.07}s">
          <span class="ck">${i + 1}</span>
          <div class="cico">${icon(f.icon)}</div>
          <div class="cbadge ${f.isNew ? 'new' : ''}">${f.badge}</div>
          <h3>${f.name}</h3>
          <p>${f.desc}</p>
          ${f.max ? `<div class="pips">${Array.from({ length: f.max }, (_, j) => `<i class="${j < f.lvl - 1 ? 'on' : j === f.lvl - 1 ? 'next' : ''}"></i>`).join('')}</div>` : ''}
          ${f.hint ? `<div class="hint">★ ${L('Klíč k evoluci', 'Evolution key')}: ${f.hint}</div>` : ''}
          <div class="ctype">${f.type}</div>
        </button>`;
      }).join('')}</div>
      <div class="lvl-actions">
        <button class="btn" data-act="reroll" ${G.rerolls <= 0 ? 'disabled' : ''}>${icon('reroll')} ${L('Přehodit', 'Reroll')} (${G.rerolls}) <kbd>R</kbd></button>
        <button class="btn ghost" data-act="skip" ${G.skips <= 0 ? 'disabled' : ''}>${icon('skip')} ${L('Přeskočit', 'Skip')} (${G.skips}) <kbd>X</kbd></button>
      </div></div>`, { reroll: rerollChoices, skip: skipChoice });
    if (quick) openedAt = performance.now() - 150;
  }
  function moveFocus(d) {
    const cards = document.querySelectorAll('#overlay .card');
    if (!cards.length) return;
    focusIdx = (focusIdx + d + cards.length) % cards.length;
    cards.forEach((c, i) => c.classList.toggle('focus', i === focusIdx));
    Sound.play.hover();
  }

  function showChest(rewards, shards) {
    overlay(`<div class="ov">
      <div class="chest-glow">${icon('chest')}</div>
      <div class="ov-title title-win" style="margin-top:10px">${L('ZÁSOBNÍK', 'SUPPLY CACHE')}</div>
      <div class="ov-sub">${L('Získal jsi', 'You received')}</div>
      <div class="chest-items">${rewards.map((c, i) => {
        const f = choiceInfo(c);
        return `<div class="chest-item" style="--c:${f.color};animation-delay:${0.25 + i * 0.18}s">${icon(f.icon)}<h4>${f.name}</h4><small>${f.badge}</small></div>`;
      }).join('')}
        <div class="chest-item" style="--c:#e08bff;animation-delay:${0.25 + rewards.length * 0.18}s">${icon('shard')}<h4>+${shards} ${L('střepů', 'shards')}</h4><small>Bonus</small></div>
      </div>
      <div class="ov-actions"><button class="btn primary" data-act="ok">${L('Pokračovat', 'Continue')} <kbd>Enter</kbd></button></div></div>`, { ok: closeChest });
  }

  function buildList() {
    const w = G.weapons.map(w => {
      const d = WEAPONS[w.id];
      return `<div class="build-item" style="--c:${d.color}">${icon(d.icon)}<span>${d.name}</span>${d.evolved ? `<span style="margin-left:auto;color:var(--gold)">★ ${L('EVOLUCE', 'EVOLVED')}</span>` : pips(w.level, 8)}</div>`;
    }).join('');
    const p = Object.entries(G.passives).map(([id, l]) => {
      const d = PASSIVES[id];
      return `<div class="build-item" style="--c:${d.color}">${icon(d.icon)}<span>${d.name}</span>${pips(l, d.max)}</div>`;
    }).join('');
    return `<h4>${L('Zbraně', 'Weapons')}</h4><div class="build-list">${w}</div><h4>${L('Doplňky', 'Passives')}</h4><div class="build-list">${p || `<span class="sum">${L('Zatím žádné', 'None yet')}</span>`}</div>`;
  }

  function showPause() {
    const s = G.st;
    overlay(`<div class="ov">
      <div class="ov-title">${L('PAUZA', 'PAUSED')}</div>
      <div class="ov-sub">${G.pilot.name} · ${L('Sektor', 'Sector')} ${G.sector.roman} · OD ${G.od} · ${fmtTime(G.time)}</div>
      <div class="pause-grid">
        <div class="ov-panel">${buildList()}</div>
        <div class="ov-panel"><h4>${L('Statistiky', 'Stats')}</h4>
          <div class="kv">
            <span>${L('Zdraví', 'Health')}</span><b>${Math.ceil(G.p.hp)} / ${Math.round(s.maxHp)}</b>
            <span>${L('Poškození', 'Damage')}</span><b>${signPct(s.might - 1)}</b>
            <span>${L('Nabíjení', 'Cooldown')}</span><b>${signPct(s.cdMul - 1)}</b>
            <span>${L('Oblast', 'Area')}</span><b>${signPct(s.area - 1)}</b>
            <span>${L('Trvání', 'Duration')}</span><b>${signPct(s.dur - 1)}</b>
            <span>${L('Projektily navíc', 'Extra projectiles')}</span><b>+${s.amount}</b>
            <span>${L('Pancíř / Regenerace', 'Armor / Regen')}</span><b>${s.armor} / ${s.regen.toFixed(1)}</b>
            <span>${L('Kritický zásah', 'Crit chance')}</span><b>${pct(s.crit)}${L(' %', '%')}</b>
            <span>${L('Štěstí / Růst', 'Luck / Growth')}</span><b>${signPct(s.luck - 1)} / ${signPct(s.growth - 1)}</b>
            <span>${L('Oživení', 'Revives')}</span><b>${G.revives}</b>
          </div>
          <h4>${L('Zvuk', 'Audio')}</h4>
          <div class="kv"><span>${L('Efekty', 'Effects')}</span><input type="range" min="0" max="1" step="0.05" value="${SAVE.settings.sfx}" data-vol="sfx"><span>${L('Hudba', 'Music')}</span><input type="range" min="0" max="1" step="0.05" value="${SAVE.settings.music}" data-vol="music"></div>
        </div>
      </div>
      <div class="ov-actions">
        <button class="btn primary" data-act="resume">${icon('play')} ${L('Pokračovat', 'Resume')} <kbd>Esc</kbd></button>
        <button class="btn danger" data-act="quit">${L('Opustit misi', 'Abandon mission')}</button>
      </div></div>`, {
      resume: () => Game.togglePause(),
      quit: () => confirm(L('Opustit misi?', 'Abandon the mission?'), L('Nasbírané střepy si ponecháš, ale běh skončí.', 'You keep the shards you collected, but the run ends.'), () => { hideOverlay(); endRun('quit'); }),
      __restore: () => showPause(),
    });
  }

  function showGameOver({ reason, earned, victory }) {
    hudShow(false);
    bossBar(null);
    const title = victory ? L('SEKTOR DOBYT', 'SECTOR CLEARED') : reason === 'quit' ? L('MISE PŘERUŠENA', 'MISSION ABORTED') : L('SIGNÁL ZTRACEN', 'SIGNAL LOST');
    const entries = Object.entries(G.dmgBy).filter(([k]) => WEAPONS[k]).sort((a, b) => b[1] - a[1]);
    const top = entries.length ? entries[0][1] : 1;
    overlay(`<div class="ov">
      <div class="ov-title ${victory ? 'title-win' : 'title-death'}">${title}</div>
      <div class="ov-sub">${G.pilot.name} · ${L('Sektor', 'Sector')} ${G.sector.roman} — ${G.sector.name} · OD ${G.od}${G.endless ? L(' · Nekonečno', ' · Endless') : ''}</div>
      <div class="statgrid">
        <div class="sg"><small>${L('Čas', 'Time')}</small><b>${fmtTime(G.time)}</b></div>
        <div class="sg"><small>${L('Zničeno', 'Destroyed')}</small><b>${fmtNum(G.kills)}</b></div>
        <div class="sg"><small>${L('Úroveň', 'Level')}</small><b>${G.level}</b></div>
        <div class="sg shards"><small>${L('Získané střepy', 'Shards earned')}</small><b>+${fmtNum(earned)}</b></div>
      </div>
      <div class="over-cols">
        <div class="ov-panel"><h4>${L('Poškození podle zbraně', 'Damage by weapon')}</h4>${entries.map(([k, v]) => {
          const d = WEAPONS[k];
          return `<div class="dmg-row" style="--c:${d.color}">${icon(d.icon)}<span>${d.name}</span><div class="db"><i style="width:${v / top * 100}%"></i></div><span>${fmtNum(v)}</span></div>`;
        }).join('') || `<span class="sum">${L('Žádné poškození', 'No damage dealt')}</span>`}</div>
        <div class="ov-panel">
          ${G.clearBonus ? `<h4>${L('Bonus za dobytí', 'Clear bonus')}</h4><div class="ach-mini">${icon('trophy')}<span>${L('Sektor', 'Sector')} ${G.sector.roman}${G.firstClear ? L(' · poprvé!', ' · first time!') : ''}</span><b>+${G.clearBonus} ◆</b></div>` : ''}
          <h4>${L('Nové úspěchy', 'New achievements')}</h4>
          ${G.newAch.length ? G.newAch.map(a => `<div class="ach-mini">${icon(a.icon)}<span>${a.name}</span><b>+${a.reward} ◆</b></div>`).join('') : `<span class="sum">${L('Tentokrát nic nového', 'Nothing new this time')}</span>`}
          ${G.evolvedRun.length ? `<h4>${L('Evoluce v tomto běhu', 'Evolutions this run')}</h4>${G.evolvedRun.map(id => `<div class="ach-mini" style="--c:${WEAPONS[id].color}">${icon(WEAPONS[id].icon)}<span>${WEAPONS[id].name}</span></div>`).join('')}` : ''}
        </div>
      </div>
      <div class="ov-actions">
        <button class="btn primary" data-act="again">${icon('reroll')} ${L('Znovu', 'Retry')} <kbd>Enter</kbd></button>
        <button class="btn" data-act="hangar">${icon('rocket')} ${L('Hangár', 'Hangar')}</button>
        <button class="btn ghost" data-act="menu">Menu</button>
      </div></div>`, {
      again: () => Game.start(G.pilot.id, G.si, G.od),
      hangar: () => Game.toMenu('hangar'),
      menu: () => Game.toMenu('menu'),
    });
  }

  function showVictory() {
    const next = G.firstClear && G.si < SECTORS.length - 1;
    overlay(`<div class="ov">
      <div class="ov-title title-win">${L('SEKTOR DOBYT', 'SECTOR CLEARED')}</div>
      <div class="ov-sub">${L('Monarcha prázdnoty padl', 'The Void Monarch has fallen')}</div>
      <div class="ov-panel" style="max-width:560px;margin:30px auto;text-align:center">
        <div class="big-shards" style="justify-content:center">${icon('shard')} +${G.clearBonus}</div>
        <p class="sum" style="margin-top:12px;line-height:1.6">${next ? L(`Odemčen <b style="color:var(--gold)">Sektor ${SECTORS[G.si + 1].roman}</b> a `, `Unlocked <b style="color:var(--gold)">Sector ${SECTORS[G.si + 1].roman}</b> and `) : ''}${G.od < MAX_OD ? L(`Overdrive ${G.od + 1} pro tento sektor.`, `Overdrive ${G.od + 1} for this sector.`) : L('Dosáhl jsi maximálního Overdrive.', 'You reached the maximum Overdrive.')}<br>${L('V nekonečném režimu můžeš pokračovat a sbírat další střepy — prázdnota ale poroste každou minutou.', 'You can keep going in endless mode and collect more shards — but the void grows stronger every minute.')}</p>
      </div>
      <div class="ov-actions">
        <button class="btn primary" data-act="endless">${icon('wave')} ${L('Pokračovat do nekonečna', 'Continue into endless')}</button>
        <button class="btn" data-act="finish">${icon('trophy')} ${L('Ukončit misi', 'End mission')}</button>
      </div></div>`, { endless: continueEndless, finish: () => endRun('victory') });
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  function hudShow(on) {
    $('#hud').hidden = !on;
    for (const k in hc) delete hc[k];
  }
  function set(id, prop, val) {
    const key = id + prop;
    if (hc[key] === val) return;
    hc[key] = val;
    const el = document.getElementById(id);
    if (prop === 'text') el.textContent = val;
    else if (prop === 'html') el.innerHTML = val;
    else if (prop === 'w') el.style.width = val;
    else if (prop === 'cls') el.className = val;
  }
  function hudUpdate(fps) {
    const p = G.p, s = G.st;
    set('xpFill', 'w', (G.xp / G.xpNext * 100).toFixed(1) + '%');
    const hpw = Math.max(0, p.hp / s.maxHp * 100).toFixed(1) + '%';
    set('hpFill', 'w', hpw); set('hpGhost', 'w', hpw);
    set('hpTxt', 'text', Math.ceil(Math.max(0, p.hp)) + ' / ' + Math.round(s.maxHp));
    set('lvlTag', 'text', L('ÚR ', 'LV ') + G.level);
    set('timer', 'text', fmtTime(G.time));
    set('timer', 'cls', G.time >= BOSS_TIMES[2] - 60 && !G.victory ? 'final' : '');
    set('sectorTag', 'text', `${L('SEKTOR', 'SECTOR')} ${G.sector.roman} · OD ${G.od}${G.endless ? ' · ∞' : ''}`);
    set('killStat', 'html', `${icon('skull')} ${fmtNum(G.kills)}`);
    set('shardStat', 'html', `${icon('shard')} ${fmtNum(G.shards)}`);
    const re = Math.round(p.dashRe / 2.6 * 20);
    set('dashPips', 'html', Array.from({ length: s.dashMax }, (_, i) => i < p.dashCharges ? '<i class="on"></i>' : i === p.dashCharges ? `<i><b style="width:${re * 5}%"></b></i>` : '<i></i>').join(''));
    if (G.boss) set('bossFill', 'w', Math.max(0, G.boss.hp / G.boss.maxHp * 100).toFixed(1) + '%');
    set('fps', 'text', SAVE.settings.fps ? fps + ' FPS · ' + G.enemies.length + L(' nepřátel', ' enemies') : '');
  }
  function refreshLoadout() {
    $('#wSlots').innerHTML = G.weapons.map(w => {
      const d = WEAPONS[w.id];
      return `<div class="slot ${d.evolved ? 'evo' : ''}" style="--c:${d.color}">${icon(d.icon)}<b>${d.evolved ? '★' : w.level}</b></div>`;
    }).join('');
    $('#pSlots').innerHTML = Object.entries(G.passives).map(([id, l]) => {
      const d = PASSIVES[id];
      return `<div class="slot" style="--c:${d.color}">${icon(d.icon)}<b>${l}</b></div>`;
    }).join('');
  }
  function bossBar(name) {
    const bb = $('#bossBar');
    if (!name) { bb.hidden = true; return; }
    $('#bossName').textContent = name;
    $('#bossFill').style.width = '100%';
    delete hc['bossFillw'];
    bb.hidden = false;
  }

  function banner(title, sub, cls = '') {
    const b = $('#banner');
    b.innerHTML = `<div class="bn-item ${cls}"><h3>${title}</h3><p>${sub || ''}</p></div>`;
  }
  function toast(title, sub, ic = 'trophy', color) {
    const t = document.createElement('div');
    t.className = 'toast';
    if (color) t.style.setProperty('--c', color);
    t.innerHTML = `${icon(ic)}<div><small>${color ? L('ODEMČENO', 'UNLOCKED') : L('ÚSPĚCH', 'ACHIEVEMENT')}</small><b>${title}</b><span>${sub}</span></div>`;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 4500);
  }

  return {
    init, show, rerender, get current() { return current; }, overlayOpen, hideOverlay, confirm,
    showLevelUp, moveFocus, get focusIdx() { return focusIdx; }, get openedAt() { return openedAt; },
    showChest, showPause, showGameOver, showVictory, act: k => { const fn = actions[k]; if (fn) fn(); },
    hudShow, hudUpdate, refreshLoadout, bossBar, banner, toast, hs,
  };
})();
