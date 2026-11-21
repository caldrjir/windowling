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
  'Úspěchy odemykají nové <b>piloty, zbraně a doplňky</b>. Co který odemyká, uvidíš v Úspěších.',
  'Evoluční zbraň jde dál <b>přetížit</b> až na ★4. Když už není co vylepšit, nabídnou se <b>mutace</b>, každá až 10×.',
  'Po dobytí Sektoru II se v Kovárně otevře <b>Mistrovská dílna</b>: víc karet, víc slotů, rázový úskok…',
  '<b>Pancíř</b> ubírá procento z každého zásahu, takže chrání i proti nejsilnějším nepřátelům.',
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
  'Achievements unlock new <b>pilots, weapons and passives</b>. See what each one unlocks under Achievements.',
  'An evolved weapon can be <b>overcharged</b> up to ★4. When nothing is left to upgrade, you get <b>mutations</b>, each up to 10 times.',
  'Clearing Sector II opens the <b>Master Workshop</b> in the Forge: more cards, more slots, shock dash…',
  '<b>Armor</b> takes a percentage off every hit, so it protects even against the strongest enemies.',
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
  orbiter: [L('Kroužič', 'Circler'), L('Obletuje tě v kruhu, který se pomalu stahuje. Přímé střely ho míjí.', 'Circles you in a slowly tightening ring. Straight shots tend to miss it.')],
  weaver: [L('Klikatec', 'Weaver'), L('Letí ke tobě v kličkách, aby uhýbal střelám.', 'Zigzags towards you to dodge your shots.')],
  blinker: [L('Přeskokan', 'Blinker'), L('Ztuhne, u tebe se objeví jeho přízrak a pak se tam přenese. Uhni z místa.', 'Freezes, its ghost appears next to you, then it teleports there. Move away.')],
  ram: [L('Beran', 'Ram'), L('Otáčí se pomalu, ale v přímce zrychlí na dvojnásobek tvé rychlosti. Uhni mu do strany.', 'Turns slowly but builds up to twice your speed in a straight line. Sidestep it.')],
  scorcher: [L('Žhavec', 'Scorcher'), L('Prolétá kolem tebe a nechává za sebou hořící stopu.', 'Streaks past you and leaves a burning trail.')],
  shade: [L('Stín', 'Shade'), L('Je skoro neviditelný; ukáže se až zblízka nebo po zásahu.', 'Nearly invisible: it only shows up close or after it is hit.')],
  berserker: [L('Zuřivec', 'Berserker'), L('Pod polovinou zdraví se rozzuří: je skoro dvakrát rychlejší a bije silněji.', 'Below half health it goes berserk: almost twice as fast and hits harder.')],
  marksman: [L('Ostrostřelec', 'Marksman'), L('Z dálky zamíří laserem a vypálí rychlou střelu. Když laser zesílí, je zamčený: uhni.', 'Aims a laser from afar, then fires a fast shot. When the laser brightens it is locked: dodge.')],
  scatter: [L('Brokovník', 'Scatterer'), L('Zblízka pálí vějíř pěti střel.', 'Fires a fan of five shots at close range.')],
  pulsar: [L('Pulzar', 'Pulsar'), L('Rozzáří se a vystřelí prstenec střel do všech stran.', 'Lights up, then fires a ring of shots in every direction.')],
  mortar: [L('Minomet', 'Mortar'), L('Z dálky hází granáty tam, kam letíš. Červený kruh ukazuje dopad.', 'Lobs shells where you are heading. The red circle marks the impact.')],
  rocketeer: [L('Raketník', 'Rocketeer'), L('Odpaluje navigované rakety. Dají se sestřelit, nebo jim utéct, než vyhoří.', 'Launches homing rockets. Shoot them down or outrun them until they burn out.')],
  medic: [L('Ošetřovatel', 'Medic'), L('Drží se vzadu a léčí zraněné spojence kolem sebe. Zabij ho první.', 'Hangs back and heals wounded allies around it. Kill it first.')],
  aegis: [L('Clona', 'Aegis'), L('Spojenci v jejím kruhu dostávají jen poloviční zranění.', 'Allies inside its circle take only half damage.')],
  commander: [L('Velitel', 'Commander'), L('Spojenci v jeho kruhu jsou o 40 % rychlejší.', 'Allies inside its circle are 40% faster.')],
  plated: [L('Pancéřník', 'Plated'), L('Z každé rány si odečte kus zranění. Slabé rychlé zbraně ho skoro neškrábnou.', 'Shrugs off part of every hit. Weak rapid weapons barely scratch it.')],
  phaser: [L('Fázovač', 'Phaser'), L('Na chvíli zprůsvitní: střely jím projdou, ale ani on tě nezraní.', 'Turns see-through now and then: shots pass through it, but it cannot hurt you either.')],
  bulwark: [L('Štítník', 'Bulwark'), L('Štít vpředu pohltí 80 % zranění. Otáčí se pomalu: obleť ho.', 'Its front shield absorbs 80% of the damage. It turns slowly: fly around it.')],
  carrier: [L('Nosič', 'Carrier'), L('Pomalá matka, která každých pár sekund vypustí trojici larev.', 'A slow mothership that releases three larvae every few seconds.')],
  shrapnel: [L('Šrapnel', 'Shrapnel'), L('Po zničení se rozletí na střely do všech stran.', 'Bursts into shots in every direction when destroyed.')],
  hydra: [L('Hydra', 'Hydra'), L('Po zničení se rozdělí na dvě menší, a ty znovu.', 'Splits into two smaller ones when destroyed, and those split again.')],
  minelayer: [L('Minér', 'Minelayer'), L('Krouží kolem tebe a klade miny. Miny jdou zničit dřív, než se k nim přiblížíš.', 'Circles you laying mines. You can destroy the mines before you get close.')],
  frost: [L('Mrazivec', 'Frostling'), L('V jeho mrazivé auře zpomalíš o třetinu.', 'Inside its frost aura you slow down by a third.')],
  gravitar: [L('Gravitar', 'Gravitar'), L('Přitahuje tě k sobě. Úskok se z jeho tahu vytrhne.', 'Pulls you towards itself. A dash breaks free.')],
  leech: [L('Pijavice', 'Leech'), L('Přisaje se, saje zdraví a zpomaluje tě. Setřese ji úskok.', 'Latches on, drains your health and slows you. A dash shakes it off.')],
  scavenger: [L('Mrchožrout', 'Scavenger'), L('Sbírá tvoje krystaly zkušeností a roste z nich. Po smrti je vrátí i s úrokem.', 'Eats your experience crystals and grows. When it dies it gives them back with interest.')],
  twin: [L('Dvojčata', 'Twins'), L('Chodí v páru a drží se po stranách. Energetické lano mezi nimi pálí. Po smrti jednoho se druhé rozzuří.', 'Come in pairs and flank you. The energy tether between them burns. Kill one and the other goes wild.')],
  // Legendy: [jméno, popis, nápověda k podmínce příchodu (kodex a úspěchy ji ukazují místo popisu)]
  watcher: [L('Pozorovatel', 'Watcher'), L('Obří oko, které si drží odstup a dívá se. Otevřené je jen, když se nehýbeš: jen tehdy ho zbraně zraní.', 'A giant eye that keeps its distance and stares. It only opens while you hold still, and only then can your weapons hurt it.'),
    L('Kdo se dlouho ani nehne, toho si někdo všimne.', 'Hold perfectly still for long enough and someone will notice.')],
  hoarder: [L('Zlatník', 'Hoarder'), L('Krade krystaly zkušeností po celé obrazovce a utíká před tebou. Po zničení vrátí dvakrát tolik a sype střepy.', 'Steals experience crystals all over the screen and runs from you. Destroy it to get twice as many back and a pile of shards.'),
    L('Krystaly, které nikdo nesbírá, přilákají jejich strážce.', 'Crystals nobody picks up attract their keeper.')],
  midnight: [L('Půlnočník', 'Midnight Chime'), L('Přenáší se kolem tebe a s každým úderem vypustí hustší prstenec střel. Po dvanáctém úderu zmizí.', 'Teleports around you and each chime releases a denser ring of shots. After the twelfth chime it vanishes.'),
    L('Přilétá jen tehdy, když hodiny odbíjejí půlnoc.', 'It only comes while the clock strikes midnight.')],
  comet: [L('Kometa', 'Comet'), L('Zamíří, proletí přes celou obrazovku a nechá za sebou oheň. Nejlíp se trefí, když se zastaví a míří.', 'Takes aim, streaks across the whole screen and leaves fire behind. It is easiest to hit while it stops to aim.'),
    L('Až padající kámen dorazí zlatého vůdce, nebe odpoví.', 'When a falling stone finishes off a golden leader, the sky answers.')],
  mirror: [L('Zrcadlo', 'Mirror'), L('Tvůj odraz: pohybuje se přesně opačně než ty kolem bílé kotvy a střílí tvými střelami. Ke kotvě se dostanete oba zároveň.', 'Your reflection: it moves exactly opposite to you around a white anchor and fires your own shots. You both reach the anchor at once.'),
    L('Bezchybný pilot jednou potká sám sebe.', 'A flawless pilot will one day meet themself.')],
  ouroboros: [L('Uroboros', 'Ouroboros'), L('Had, který obtáčí tvou loď. Tělo pálí, zbraně zraní jen hlavu. Pod polovinou zdraví kruh utáhne.', 'A serpent coiling around your ship. Its body burns, weapons only hurt the head. Below half health it tightens the coil.'),
    L('Had, který požírá vlastní ocas. Krouží a krouží, rychle a těsně…', 'The serpent that devours its own tail. Round and round, fast and tight…')],
};

const UI = (() => {
  let current = null;
  const hs = { pilot: SAVE.lastPilot, sector: SAVE.lastSector || 0, od: SAVE.lastOd || 0 };
  let codexTab = 'weapons';
  let actions = {};
  let focusIdx = 0;
  let openedAt = 0;
  const hc = {};

  // Součet vylepšení Věčné dílny na dané úrovni (např. „+35 % poškození“).
  const fmtDec = v => (LANG === 'cs' ? String(v).replace('.', ',') : String(v));
  const fmtP = v => fmtDec(Math.round(v * 1000) / 10);
  function forgeTotal(f, l) {
    const T = {
      might: v => L(`+${fmtP(v)} % poškození`, `+${fmtP(v)}% damage`), maxHp: v => L(`+${Math.round(v)} zdraví`, `+${Math.round(v)} HP`),
      regen: v => L(`+${fmtDec(Math.round(v * 100) / 100)} zdraví/s`, `+${fmtDec(Math.round(v * 100) / 100)} HP/s`),
      area: v => L(`+${fmtP(v)} % oblast`, `+${fmtP(v)}% area`), dur: v => L(`+${fmtP(v)} % trvání`, `+${fmtP(v)}% duration`),
      crit: v => L(`+${fmtP(v)} % krit.`, `+${fmtP(v)}% crit`), critDmg: v => L(`+${fmtP(v)} % krit. poškození`, `+${fmtP(v)}% crit damage`),
      growth: v => L(`+${fmtP(v)} % zkušeností`, `+${fmtP(v)}% XP`), luck: v => L(`+${fmtP(v)} % štěstí`, `+${fmtP(v)}% luck`),
      greed: v => L(`+${fmtP(v)} % střepů`, `+${fmtP(v)}% shards`),
      speed: v => L(`+${fmtP(v)} % rychlost`, `+${fmtP(v)}% speed`), dashCd: v => L(`−${fmtP(v)} % dobití úskoku`, `−${fmtP(v)}% dash recharge`),
    };
    return Object.entries(f.mod).map(([k, v]) => (k === 'cdMul' ? L(`−${fmtP(1 - Math.pow(1 + v, l))} % nabíjení`, `−${fmtP(1 - Math.pow(1 + v, l))}% cooldown`) : T[k] ? T[k](v * l) : '')).filter(Boolean).join(', ');
  }
  const pips = (n, max, cls = '') => `<div class="pips ${cls}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
  const topbar = (small, title, extra = '', back = 'menu') => `<div class="topbar"><button class="back" data-go="${back}" title="${L('Zpět', 'Back')} (Esc)">←</button><h2><small>${small}</small>${title}</h2><div class="spacer"></div>${extra}<div class="chip shard">${icon('shard')} ${fmtNum(SAVE.shards)}</div></div>`;
  const langSwitch = () => `<div class="lang">${['cs', 'en'].map(l => `<button class="${l === LANG ? 'on' : ''}" data-lang="${l}">${l.toUpperCase()}</button>`).join('')}</div>`;

  // ── Kovárna: štítky částí a panel vylepšení ──────────────────────────────
  let forgePart = null, setPv = null;
  const TIER_NAME = () => ({ 2: L('Mistrovská dílna', 'Master Workshop'), 3: L('Prázdnotová dílna', 'Void Workshop'), 4: L('Věčná dílna', 'Eternal Workshop'), 5: L('Mistrovské dílo', 'Masterpiece') });
  const TIER_CLS = { 2: 'master', 3: 'master void', 4: 'master eternal', 5: 'master piece' };
  const MK = ['I', 'II', 'III', 'IV', 'V'];
  const mkOf = pr => (pr >= 1 ? 'MAX' : 'Mk ' + MK[Math.min(4, Math.floor(pr * 5))]);
  function partChip(p) {
    const pr = partProgress(SAVE, p.id), can = partCanBuy(SAVE, p.id);
    return `<button class="fpart ${p.id === forgePart ? 'sel' : ''} ${can ? 'can' : ''}" data-part="${p.id}" role="tab" aria-selected="${p.id === forgePart}" style="--c:${p.color}">${icon(p.icon)}<span>${p.name}</span><b>${mkOf(pr)}</b>${can ? '<i class="dot"></i>' : ''}</button>`;
  }
  function forgeRow(f) {
    const l = SAVE.forge[f.id] || 0, maxed = l >= f.max, t = lvlTier(f, Math.min(l, f.max - 1)), open = maxed || forgeOpen(f), cost = maxed ? 0 : forgeCost(f, l);
    const lock = t === 2 ? L('Otevře dobytí Sektoru II', 'Opens once you clear Sector II') : L('Otevře dobytí Sektoru V', 'Opens once you clear Sector V');
    return `<div class="fcard frow ${maxed ? 'maxed' : ''} ${TIER_CLS[t] || ''} ${open ? '' : 'locked'}" id="fc-${f.id}">
      <div class="fi">${icon(f.icon)}<div><h4>${f.name}${t ? ` <em class="ftier">${TIER_NAME()[t]}</em>` : ''}</h4><p>${f.desc}</p></div></div>
      <div class="frow-b">${f.max === Infinity ? `<div class="lvl-inf">${L('Úroveň', 'Level')} <b>${l}</b>${l ? ` · ${L('celkem', 'total')} ${forgeTotal(f, l)}` : ''}</div>` : pips(l, f.max)}
      <button class="btn buy ${maxed ? 'ghost' : ''}" data-buy="${f.id}" ${!open || maxed || SAVE.shards < cost ? 'disabled' : ''} title="${open ? '' : lock}">${!open ? `${icon('lock')} ${fmtNum(cost)}` : maxed ? L('Maximum', 'Maxed') : `${icon('shard')} ${fmtNum(cost)}`}</button></div>
      ${open ? '' : `<small class="flock">${icon('lock')} ${lock}</small>`}
    </div>`;
  }
  function partPanel(id) {
    const p = P_INDEX[id], pr = partProgress(SAVE, id), et = partEternal(SAVE, id);
    const items = FORGE.filter(f => f.part === id);
    const fin = items.filter(f => f.max !== Infinity), have = fin.reduce((a, f) => a + Math.min(f.max, SAVE.forge[f.id] || 0), 0), all = fin.reduce((a, f) => a + f.max, 0);
    return `<div class="fp-top"><div class="fp-head" style="--c:${p.color}">${icon(p.icon)}<div><small>${L('ČÁST LODI', 'SHIP PART')} · ${mkOf(pr)}</small><h3>${p.name}</h3><p>${p.desc}</p></div></div>
      <div class="fp-bar" style="--c:${p.color}"><i style="width:${pct(pr)}%"></i></div>
      <div class="fp-meta">${L('Úrovně', 'Levels')} <b>${have} / ${all}</b>${et ? ` · ${L('Věčná dílna', 'Eternal Workshop')} <b>+${et}</b>` : ''}</div>
      ${id === 'bay' ? loadoutNote() : ''}</div>
      <div class="fp-list" id="fpList">${items.map(forgeRow).join('')}</div>`;
  }
  // Zbrojnice: co je teď ve výzbroji (nastavuje se v Hangáru před startem).
  function loadoutNote() {
    const hard = Math.min(2, SAVE.forge.hard || 0), bans = Math.min(6, SAVE.forge.bans || 0);
    if (!hard && !bans) return `<div class="fp-note">${icon('hardpoint')} ${L('Závěsníky a Zbrojní plán ti dovolí vybrat, se kterými zbraněmi běh začne a které se v něm vůbec neobjeví. Nastavíš je v Hangáru.', 'Hardpoints and the Arms Plan let you choose which weapons a run starts with and which never show up in it. Set them in the Hangar.')}</div>`;
    const lo = SAVE.loadout, nm = id => WEAPONS[id].name;
    return `<div class="fp-note on">${icon('hardpoint')}<div>${hard ? `<b>${L('Na palubě', 'On board')} ${lo.pre.slice(0, hard).length}/${hard}:</b> ${lo.pre.slice(0, hard).map(nm).join(', ') || '—'}<br>` : ''}${bans ? `<b>${L('Vyřazené', 'Struck out')} ${lo.ban.slice(0, bans).length}/${bans}:</b> ${lo.ban.slice(0, bans).map(nm).join(', ') || '—'}` : ''}
      <button class="btn small" data-go="hangar">${icon('rocket')} ${L('Výzbroj v Hangáru', 'Loadout in the Hangar')}</button></div></div>`;
  }
  /** Po nákupu nebo výběru části: překreslí štítky, panel, statistiky a střepy, model lodi zůstane (jen se přestaví).
   *  keep = stejná část (po nákupu): seznam vylepšení zůstane odrolovaný, kde byl. */
  function forgeRefresh(keep = true) {
    const panel = $('#fpanel');
    if (!panel) return;
    const list = $('#fpList'), sc = keep && list ? list.scrollTop : 0;
    $('.fparts').innerHTML = PARTS.map(partChip).join('');
    panel.innerHTML = partPanel(forgePart);
    $('#fpList').scrollTop = sc;
    const st = $('#fstats'); if (st) st.innerHTML = forgeStats();
    const sh = $('#s-forge .topbar .chip.shard'); if (sh) sh.innerHTML = `${icon('shard')} ${fmtNum(SAVE.shards)}`;
    Forge3D.rebuild();
  }
  // Statistiky lodi na startu běhu (bez schopnosti pilota): základ lodi a kolik přidává Kovárna.
  // [klíč, popisek, část lodi, hodnota, přírůstek z Kovárny (null = nic)]
  const sgn = (v, d = 0) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtDec(Math.abs(Math.round(v * Math.pow(10, d)) / Math.pow(10, d)));
  const pc = v => fmtDec(Math.round(v * 1000) / 10);
  function forgeStatRows(c, b) {
    const P = (x, y) => (Math.abs(x - y) > 1e-9 ? `${sgn((x - y) * 100, 1)} %` : null), N = (x, y, d = 0) => (Math.abs(x - y) > 1e-9 ? sgn(x - y, d) : null);
    return [
      [L('Útok', 'Offense'), [
        ['might', L('Poškození', 'Damage'), 'guns', `${pc(c.might)} %`, P(c.might, b.might)],
        ['crit', L('Krit. zásah', 'Crit chance'), 'guns', `${pc(c.crit)} %`, P(c.crit, b.crit)],
        ['critMul', L('Krit. poškození', 'Crit damage'), 'guns', `×${fmtDec(c.critMul.toFixed(2))}`, N(c.critMul, b.critMul, 2)],
        ['bossDmg', L('Proti bossům', 'Vs bosses'), 'guns', `${pc(c.bossDmg)} %`, P(c.bossDmg, b.bossDmg)],
        ['amount', L('Projektily navíc', 'Extra projectiles'), 'guns', `+${c.amount}`, N(c.amount, b.amount)],
        ['execute', L('Poprava pod', 'Execute below'), 'guns', `${pc(c.execute)} %`, P(c.execute, b.execute)],
        ['cdMul', L('Nabíjení', 'Cooldown'), 'reactor', `${pc(c.cdMul)} %`, P(c.cdMul, b.cdMul)],
        ['area', L('Oblast', 'Area'), 'reactor', `${pc(c.area)} %`, P(c.area, b.area)],
        ['dur', L('Trvání', 'Duration'), 'reactor', `${pc(c.dur)} %`, P(c.dur, b.dur)],
      ]],
      [L('Obrana', 'Defense'), [
        ['maxHp', L('Max. zdraví', 'Max HP'), 'hull', String(Math.round(c.maxHp)), N(c.maxHp, b.maxHp)],
        ['regen', L('Regenerace', 'Regen'), 'hull', `${fmtDec(Math.round(c.regen * 100) / 100)} /s`, N(c.regen, b.regen, 2)],
        ['armor', L('Přijaté zranění', 'Damage taken'), 'hull', `${pc(armorFactor(c.armor))} %`, P(armorFactor(c.armor), armorFactor(b.armor))],
        ['revives', L('Oživení', 'Revives'), 'hull', String(c.revives), N(c.revives, b.revives)],
        ['heartHeal', L('Léčení srdcem', 'Heart heal'), 'hull', String(c.heartHeal), N(c.heartHeal, b.heartHeal)],
        ['speed', L('Rychlost', 'Speed'), 'engines', String(Math.round(c.speed)), P(c.speed / b.speed, 1)],
        ['dashMax', L('Úskoky', 'Dashes'), 'engines', String(c.dashMax), N(c.dashMax, b.dashMax)],
        ['dashCd', L('Dobití úskoku', 'Dash recharge'), 'engines', `${fmtDec(c.dashCd.toFixed(2))} s`, N(c.dashCd, b.dashCd, 2)],
      ]],
      [L('Sběr a běh', 'Pickup & run'), [
        ['magnet', L('Dosah sběru', 'Pickup range'), 'wings', String(Math.round(c.magnet)), P(c.magnet / b.magnet, 1)],
        ['growth', L('Zkušenosti', 'Experience'), 'wings', `${pc(c.growth)} %`, P(c.growth, b.growth)],
        ['greed', L('Střepy', 'Shards'), 'wings', `${pc(c.greed)} %`, P(c.greed, b.greed)],
        ['chestItems', L('Předměty v truhle', 'Chest items'), 'wings', `+${c.chestItems}`, N(c.chestItems, b.chestItems)],
        ['luck', L('Štěstí', 'Luck'), 'cockpit', `${pc(c.luck)} %`, P(c.luck, b.luck)],
        ['rerolls', L('Přehození', 'Rerolls'), 'cockpit', String(1 + c.rerolls), N(c.rerolls, b.rerolls)],
        ['cards', L('Karet při postupu', 'Cards per level-up'), 'cockpit', String(3 + c.cards), N(c.cards, b.cards)],
        ['wSlots', L('Místa zbraní / doplňků', 'Weapon / passive slots'), 'bay', `${c.wSlots} / ${c.pSlots}`, N(c.wSlots + c.pSlots, b.wSlots + b.pSlots)],
        ['hard', L('Závěsníky / vyřazení', 'Hardpoints / strikes'), 'bay', `${c.hard} / ${c.bans}`, N(c.hard + c.bans, b.hard + b.bans)],
      ]],
    ];
  }
  function forgeStats() {
    const none = { mods: {} }, b = calcStats(none, {}, {}, {}), c = calcStats(none, SAVE.forge, {}, {});
    return `<div class="fs-head"><b>${L('STATISTIKY LODI', 'SHIP STATS')}</b><small>${L('Na startu běhu, bez schopnosti pilota · barevně: kolik přidává Kovárna', 'At the start of a run, without the pilot’s perk · in colour: what the Forge adds')}</small></div>
      <div class="fs-groups">${forgeStatRows(c, b).map(([g, rows]) => `<div class="fs-g"><h5>${g}</h5>${rows.map(([k, label, part, v, d]) => `<div class="fs ${part === forgePart ? 'hl' : ''} ${d ? '' : 'zero'}" data-stat="${k}" style="--c:${P_INDEX[part].color}"><span title="${label}">${label}</span><b>${v}</b><em>${d || '·'}</em></div>`).join('')}</div>`).join('')}</div>`;
  }

  // ── Výzbroj (Hangár): zbraně na závěsnících a vyřazené zbraně ──────────────
  let loMode = 'pre';
  function loadoutSection(pl) {
    const hard = Math.min(2, SAVE.forge.hard || 0), bans = Math.min(6, SAVE.forge.bans || 0);
    if (!hard && !bans) return '';
    if (!hard) loMode = 'ban'; else if (!bans) loMode = 'pre';
    const lo = SAVE.loadout, start = pl.weapon === 'random' ? null : pl.weapon, lvl = 1 + Math.min(2, SAVE.forge.prelvl || 0);
    const pre = lo.pre.filter(id => id !== start).slice(0, hard), ban = lo.ban.filter(id => id !== start && !pre.includes(id)).slice(0, bans);
    const tile = id => {
      const d = WEAPONS[id], open = unlocked(d);
      if (!open) return `<button class="lw locked" disabled style="--c:${d.color}">${icon('lock')}<span>???</span></button>`;
      const st = id === start ? 'start' : pre.includes(id) ? 'pre' : ban.includes(id) ? 'ban' : '';
      const badge = st === 'start' ? L('Startovní', 'Starting') : st === 'pre' ? `▲ ${L('Úr.', 'Lv')} ${lvl}` : st === 'ban' ? `✕ ${L('Vyřazená', 'Struck')}` : '';
      return `<button class="lw ${st}" data-lw="${id}" ${st === 'start' ? 'disabled' : ''} style="--c:${d.color}" title="${d.desc}">${icon(d.icon)}<span>${d.name}</span>${badge ? `<b>${badge}</b>` : ''}</button>`;
    };
    return `<div class="loadout">
      <div class="lo-head">${icon('hardpoint')}<div><h3>${L('VÝZBROJ', 'LOADOUT')}</h3><p>${L('Zbraně na závěsnících máš od startu, vyřazené se v běhu vůbec neobjeví (ostatní pak chodí častěji). Úrovně dál získáváš postupem.', 'Weapons on hardpoints are yours from the start; struck-out ones never show up in the run (so the rest come more often). Levels still come from levelling up.')}</p></div>
        <div class="lo-modes">${hard ? `<button class="${loMode === 'pre' ? 'on' : ''}" data-lmode="pre">▲ ${L('Na palubu', 'On board')} <b>${pre.length}/${hard}</b></button>` : ''}${bans ? `<button class="${loMode === 'ban' ? 'on' : ''}" data-lmode="ban">✕ ${L('Vyřadit', 'Strike out')} <b>${ban.length}/${bans}</b></button>` : ''}</div></div>
      <div class="lo-grid">${BASE_WEAPONS.map(tile).join('')}</div>
    </div>`;
  }
  function toggleLoadout(id) {
    const lo = SAVE.loadout, hard = Math.min(2, SAVE.forge.hard || 0), bans = Math.min(6, SAVE.forge.bans || 0);
    const pl = PILOTS.find(p => p.id === hs.pilot), start = pl && pl.weapon !== 'random' ? pl.weapon : null;
    if (!WEAPONS[id] || !unlocked(WEAPONS[id]) || id === start) { Sound.play.error(); return; }
    const del = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); return i >= 0; };
    // jen platné položky (pilotova zbraň se nepočítá), ať se dá vybrat i po změně pilota
    lo.pre = lo.pre.filter(x => x !== start).slice(0, hard);
    lo.ban = lo.ban.filter(x => x !== start && !lo.pre.includes(x)).slice(0, bans);
    const list = loMode === 'pre' ? lo.pre : lo.ban, cap = loMode === 'pre' ? hard : bans;
    if (del(list, id)) Sound.play.click();
    else if (list.length >= cap) { Sound.play.error(); return; }
    else { del(loMode === 'pre' ? lo.ban : lo.pre, id); list.push(id); Sound.play.select(); }
    persist(); rerender();
  }

  // ── Obrazovky ─────────────────────────────────────────────────────────────
  const screens = {
    title(el) {
      el.innerHTML = `<div><div class="logo" data-text="VOIDBORN">VOIDBORN</div><div class="tagline">${L('Přežij prázdnotu', 'Survive the void')}</div><div class="press">${Platform.touch ? L('Klepni kamkoli', 'Tap anywhere') : L('Stiskni libovolnou klávesu', 'Press any key')}</div></div><div class="title-ver">v${GAME_VERSION}</div>`;
    },

    menu(el) {
      const S = SAVE.stats;
      if (SAVE.achTopUp > 0) {
        const v = SAVE.achTopUp; SAVE.achTopUp = 0; persist();
        setTimeout(() => toast(L('Síň slávy', 'Hall of Fame'), L(`Úspěchy teď odměňují mnohem víc a dávají trvalé bonusy. Doplatek za ty splněné: +${fmtNum(v)} ◆`, `Achievements now pay much more and give permanent bonuses. Top-up for those already earned: +${fmtNum(v)} ◆`), 'trophy'), 700);
      }
      const cleared = SECTORS.filter(s => SAVE.sectors[s.id] && SAVE.sectors[s.id].cleared).length;
      const achN = Object.keys(SAVE.achievements).length;
      const canBuy = canBuyAny(SAVE);
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
            <span>${L('Objevené evoluce', 'Evolutions found')}</span><b>${Object.keys(SAVE.evolutions).length} / ${EVOLUTIONS.length}</b>
            <span>${L('Odehráno', 'Time played')}</span><b>${fmtTime(S.time)}</b>
          </div>
          <div class="progress" title="${L('Celkový postup', 'Overall progress')}"><i style="width:${pct(prog)}%"></i></div>
          <div class="tip"><span class="tl">TIP</span>${pick(TIPS)}</div>
        </aside>
        <div class="version">VOIDBORN · v${GAME_VERSION} · ${L('WASD + MEZERNÍK', 'WASD + SPACE')}</div>
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
            <div class="perk">${icon(wid ? WEAPONS[wid].icon : 'luck')}<div><small>${L('Startovní zbraň · evoluce zaručena', 'Starting weapon · evolution guaranteed')}</small>${wid ? WEAPONS[wid].name : L('Náhodná', 'Random')}</div></div>
            <div class="perk">${icon('star')}<div><small>${L('Schopnost', 'Perk')}</small>${pl.perk}</div></div>
          </div>
        </div>
        ${loadoutSection(pl)}
        <div class="sectors">${SECTORS.slice(0, BASE_SECTORS).map((s, i) => sectorCard(s, i)).join('')}</div>
        <div class="anom-head">${icon('meteor')}<div><h3>${L('ANOMÁLIE', 'ANOMALIES')}</h3><p>${L('Sektory s vlastním pravidlem. Každý otevře dobytí jednoho z hlavních sektorů.', 'Sectors with a rule of their own. Each one opens once you clear one of the main sectors.')}</p></div></div>
        <div class="sectors anom">${SECTORS.map((s, i) => [s, i]).filter(([s, i]) => i >= BASE_SECTORS && !s.deep).map(([s, i]) => sectorCard(s, i)).join('')}</div>
        <div class="anom-head deep">${icon('skull')}<div><h3>${L('HLUBINY', 'THE DEEP')}</h3><p>${L('Sektory pro konec hry. Otevírají se jeden po druhém od dobytí Sektoru IX.', 'Sectors for the end game. They open one after another once you clear Sector IX.')}</p></div></div>
        <div class="sectors deep">${SECTORS.map((s, i) => [s, i]).filter(([s]) => s.deep).map(([s, i]) => sectorCard(s, i)).join('')}</div>
        <div class="launch">
          <div class="sdesc"><b>${L('Sektor', 'Sector')} ${sec.roman} · ${sec.name}</b><span class="sd-more">${sec.desc}<br>${L('Nejlepší čas', 'Best time')}: ${fmtTime(rec ? rec.best || 0 : 0)} · ${L('Cíl: přežij 15:00 a poraz Monarchu', 'Goal: survive 15:00 and defeat the Monarch')}</span></div>
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

    // Kovárna: 3D model lodi (forge3d.js). Klepnutím na část lodi (nebo na její štítek) se vedle
    // ukážou její vylepšení; loď se dá tažením otáčet.
    forge(el) {
      const spent = FORGE.reduce((s, f) => { let c = 0; for (let l = 0; l < (SAVE.forge[f.id] || 0); l++) c += forgeCost(f, l); return s + c; }, 0);
      if (!forgePart || !P_INDEX[forgePart]) forgePart = (PARTS.find(p => partCanBuy(SAVE, p.id)) || PARTS[0]).id;
      el.innerHTML = `
        ${topbar(L('TRVALÁ VYLEPŠENÍ', 'PERMANENT UPGRADES'), L('KOVÁRNA', 'FORGE'), spent ? `<button class="btn ghost" data-act="refund">${icon('reroll')} ${L('Vrátit vše', 'Refund all')}</button>` : '')}
        <div class="forge">
          <div class="fleft">
            <div class="fstage">
              <canvas id="forgeCv" aria-label="${L('Model lodi: tažením otočíš, klepnutím vybereš část', 'Ship model: drag to rotate, tap to pick a part')}"></canvas>
              <div class="fhint">${icon('reroll')} ${L('Táhni a loď se otočí · klepni na část lodi', 'Drag to rotate the ship · tap a part')}</div>
            </div>
            <div class="fstats" id="fstats">${forgeStats()}</div>
          </div>
          <div class="fside">
            <div class="fparts" role="tablist">${PARTS.map(p => partChip(p)).join('')}</div>
            <div class="fpanel" id="fpanel">${partPanel(forgePart)}</div>
          </div>
        </div>`;
      Forge3D.mount($('#forgeCv'), { onSelect: id => { const same = id === forgePart; forgePart = id; Sound.play.select(); forgeRefresh(same); } });
      Forge3D.select(forgePart, true, false, false);
    },

    // Úspěchy po vzácnosti. Kolik procent hráčů úspěch má, se počítá z uložení hráčů s účtem
    // (/api/rarity). Dokud je jich málo, řadí se úspěchy do vzácnosti podle odměny (obtížnosti).
    ach(el) {
      const n = Object.keys(SAVE.achievements).length, perks = achPerks(SAVE.achievements);
      const left = ACHIEVEMENTS.filter(a => !SAVE.achievements[a.id]).reduce((t, a) => t + a.reward, 0);
      loadRarity();
      const R = rarity, byPlayers = !!R && R.total >= RARITY_MIN;
      const pct = a => (R && R.total ? (R.counts[a.id] || 0) / R.total * 100 : null);
      // legendy jsou legendární i podle obtížnosti: hlavní je najít je, ne jejich odměna
      const tierOf = a => { const p = pct(a); if (byPlayers) return p >= 60 ? 0 : p >= 35 ? 1 : p >= 15 ? 2 : p >= 5 ? 3 : 4; if (a.legend || a.id === 'lgAll') return 4; const r = a.reward; return r < 1000 ? 0 : r < 5000 ? 1 : r < 20000 ? 2 : r < 60000 ? 3 : 4; };
      const fmtPct = p => (p === null ? '' : p > 0 && p < 1 ? L('<1 %', '<1%') : `${Math.round(p)}${L(' %', '%')}`);
      const card = a => {
        const got = !!SAVE.achievements[a.id], [v, m] = a.prog(SAVE, null), p = pct(a);
        const pl = a.pilot && PILOTS.find(x => x.id === a.pilot);
        const opens = [...(pl ? [pl.name] : []), ...[...BASE_WEAPONS.map(id => WEAPONS[id]), ...Object.values(PASSIVES)].filter(o => o.unlock === a.id).map(o => o.name)];
        return `<div class="fcard ach ${got ? 'got' : ''}" data-ach="${a.id}">
            <div class="fi">${icon(a.icon)}<div><h4>${a.name}</h4><p>${a.legend && !got ? `${L('Legenda ???', 'Legend ???')}: <i class="hint">„${ENEMY_NAMES[a.legend][2]}“</i>` : a.desc}</p></div>${p !== null ? `<em class="ach-pct" title="${L('Kolik hráčů s účtem ho má', 'Share of signed-in players who have it')}">${fmtPct(p)}</em>` : ''}</div>
            <div class="bar"><i style="width:${Math.min(100, v / m * 100)}%"></i></div>
            <div class="rw"><span>${got ? L('Splněno', 'Completed') : `${fmtNum(Math.min(v, m))} / ${fmtNum(m)}`}${opens.length ? ` · ${L('odemyká', 'unlocks')} ${opens.join(', ')}` : ''}</span><b>+${fmtNum(a.reward)} ◆</b></div>
            ${a.perk ? `<div class="ach-perk">${icon('star')} ${L('Navždy', 'Forever')}: ${perkText(a.perk)}</div>` : ''}
          </div>`;
      };
      const tiers = ACH_TIERS.map(() => []);
      for (const a of ACHIEVEMENTS) tiers[tierOf(a)].push(a);
      const how = byPlayers
        ? L(`Vzácnost podle toho, kolik z ${R.total} hráčů s účtem úspěch má.`, `Rarity by how many of ${R.total} signed-in players have it.`)
        : R ? L(`Hráčů s účtem je zatím málo (${R.total}), proto vzácnost podle obtížnosti. Procenta ukazují, kolik z nich úspěch má.`, `Few signed-in players so far (${R.total}), so rarity follows difficulty. The percentages show how many of them have it.`)
          : L('Vzácnost podle obtížnosti. Kolik procent hráčů úspěch má, se ukáže s připojením k síti.', 'Rarity by difficulty. The share of players who have each one shows up when online.');
      el.innerHTML = `
        ${topbar(L('SÍŇ SLÁVY', 'HALL OF FAME'), L('ÚSPĚCHY', 'ACHIEVEMENTS'), `<span class="sum">${n} / ${ACHIEVEMENTS.length}</span>`)}
        <div class="ach-fame">
          <div><small>${L('TRVALÉ BONUSY DO KAŽDÉHO BĚHU', 'PERMANENT BONUSES FOR EVERY RUN')}</small>
            <p>${Object.keys(perks).length ? perkText(perks) : L('Zatím žádné. Každý úspěch kromě střepů přidá i trvalý bonus.', 'None yet. Besides shards, every achievement adds a permanent bonus.')}</p></div>
          <div class="af-left"><small>${L('ZBÝVÁ ZÍSKAT', 'STILL TO EARN')}</small><b>${icon('shard')} ${fmtNum(left)}</b></div>
        </div>
        <p class="ach-how">${how}</p>
        ${tiers.map((list, t) => list.length ? `<section class="ach-tier" style="--t:${ACH_TIERS[t][1]}" data-tier="${ACH_TIERS[t][0]}">
          <h3><i></i>${ACH_TIERS[t][2]}<small>${list.filter(a => SAVE.achievements[a.id]).length} / ${list.length}</small></h3>
          <div class="grid-cards">${list.map(card).join('')}</div></section>` : '').join('')}`;
    },

    codex(el) {
      const tabs = [['weapons', L('Zbraně', 'Weapons')], ['passives', L('Doplňky', 'Passives')], ['evos', L('Evoluce', 'Evolutions')], ['enemies', L('Nepřátelé', 'Enemies')]];
      const unknown = L('Zatím neobjeveno.', 'Not discovered yet.');
      let body = '';
      // Zamčené zbraně a doplňky ukazují, který úspěch je odemkne.
      const lockNote = o => {
        if (o.forge) { const f = FORGE.find(f => f.id === o.forge); return `${icon('lock')} ${L('Odemkne Mistrovské dílo', 'Unlocked by the Masterpiece')} „${f.name}“ (${fmtNum(f.cost)} ◆)`; }
        const a = ACHIEVEMENTS.find(a => a.id === o.unlock); return `${icon('lock')} ${L('Odemkne úspěch', 'Unlocked by')} „${a.name}“: ${a.desc}`;
      };
      if (codexTab === 'weapons') body = BASE_WEAPONS.map(id => {
        const d = WEAPONS[id], seen = SAVE.seen[id], open = unlocked(d);
        return `<div class="fcard cx ${seen ? '' : 'unknown'}" style="--c:${d.color}"><div class="fi">${icon(d.icon)}<div><h4>${seen || open ? d.name : '???'}</h4><p>${seen ? d.desc : open ? `${d.desc} <i>${L('Zatím nepoužita.', 'Not used yet.')}</i>` : lockNote(d)}</p></div></div>
          ${seen ? `<p>${d.up.map((u, i) => `<b>${i + 2}:</b> ${u[1]}`).join(' · ')}</p>` : ''}</div>`;
      }).join('');
      else if (codexTab === 'passives') body = Object.entries(PASSIVES).map(([id, d]) => {
        const seen = SAVE.seen[id], open = unlocked(d);
        return `<div class="fcard cx ${seen ? '' : 'unknown'}" style="--c:${d.color}"><div class="fi">${icon(d.icon)}<div><h4>${seen || open ? d.name : '???'}</h4><p>${seen || open ? `${d.desc}${d.noPer ? '' : ' ' + L('za úroveň', 'per level')} · max. ${d.max}` : lockNote(d)}</p></div></div></div>`;
      }).join('') + `<div class="fcard cx" style="--c:#ffd166"><div class="fi">${icon('overcharge')}<div><h4>${L('Přetížení', 'Overcharge')}</h4><p>${L(`Evoluční zbraň se dál vylepšuje: ★1–★${OC_MAX}, každá hvězda +${pct(OC_DMG)} % poškození a −${pct(OC_CD)} % nabíjení.`, `An evolved weapon keeps improving: ★1–★${OC_MAX}, each star +${pct(OC_DMG)}% damage and −${pct(OC_CD)}% cooldown.`)}</p></div></div></div>
        <div class="fcard cx" style="--c:#5dffa8"><div class="fi">${icon('mutation')}<div><h4>${L('Mutace', 'Mutations')}</h4><p>${L(`Když už není co vylepšit, nabízí postup mutace: drobná posílení, od každého druhu nejvýš ${MUT_MAX}.`, `When there is nothing left to upgrade, level-ups offer mutations: small boosts, at most ${MUT_MAX} of each kind.`)}</p></div></div></div>`;
      else if (codexTab === 'evos') body = BASE_WEAPONS.map(id => {
        const b = WEAPONS[id], e = WEAPONS[b.evo], got = SAVE.evolutions[b.evo];
        return `<div class="fcard cx ${got ? '' : 'unknown'}" style="--c:${e.color}"><div class="fi">${icon(e.icon)}<div><h4>${got ? e.name : '???'}</h4><p>${got ? e.desc : L('Neobjevená evoluce.', 'Undiscovered evolution.')}</p></div></div>
          <div class="recipe">${SAVE.seen[id] ? b.name : '???'} (${L('úr.', 'lv.')} 8) + ${got ? PASSIVES[b.evoWith].name : '???'}${got ? `<br><small>${L('Startovní zbraň pilota se vyvine i bez doplňku.', 'A pilot’s starting weapon evolves even without the passive.')}</small>` : ''}</div></div>`;
      }).join('');
      else body = `<div class="cx-sum">${L('Bestiář', 'Bestiary')}: <b>${ENEMY_KINDS.filter(k => SAVE.bestiary[k]).length} / ${ENEMY_KINDS.length}</b> ${L('druhů zničeno', 'kinds destroyed')}</div>` + ENEMY_KINDS.map(k => {
        const d = ENEMIES[k], names = ENEMY_NAMES[k], n = SAVE.bestiary[k] || 0;
        return `<div class="fcard cx ${n ? '' : 'unknown'}" style="--c:${d.color}"><div class="fi"><canvas width="64" height="64" data-enemy="${k}" style="width:40px;height:40px"></canvas><div><h4>${n ? names[0] : '???'}</h4><p>${n ? `${names[1]} <i>${L('Zničeno', 'Destroyed')}: ${fmtNum(n)}</i>` : L('Zatím nezničen. Potkáš ho v některém ze sektorů.', 'Not destroyed yet. You will meet it in one of the sectors.')}</p></div></div></div>`;
      }).join('') + Object.values(BOSSES).map(b => `<div class="fcard cx" style="--c:${b.color}"><div class="fi">${icon('boss')}<div><h4>${b.name}</h4><p>${L('Boss sektoru. Vzorce útoků', 'Sector boss. Attack patterns')}: ${b.patterns.length}.</p></div></div></div>`).join('')
        // Legendy: neobjevené jen jako ??? s nápovědou, spatřené se jménem, zničené s celým popisem
        + `<div class="cx-sum lg">${icon('legend')} ${L('Legendy prázdnoty', 'Void legends')}: <b>${LEGENDS.filter(k => SAVE.bestiary[k]).length} / ${LEGENDS.length}</b> ${L('zničeno', 'destroyed')}<small>${L('Přiletí jen, když uděláš něco hodně zvláštního, a i pak jen občas. Za každou je úspěch.', 'They only appear when you do something very particular, and even then only sometimes. Each one has an achievement.')}</small></div>`
        + LEGENDS.map(k => {
          const d = ENEMIES[k], [name, desc, hint] = ENEMY_NAMES[k], n = SAVE.bestiary[k] || 0, seen = SAVE.legendSeen[k] || 0;
          const txt = n ? `${desc} <i>${L('Zničeno', 'Destroyed')}: ${fmtNum(n)}</i>` : seen ? `${desc} <i>${L('Spatřena', 'Seen')}: ${fmtNum(seen)}× · ${L('zatím neporažena', 'not defeated yet')}</i>` : `<i class="hint">„${hint}“</i>`;
          return `<div class="fcard cx legend ${n ? '' : 'unknown'}" style="--c:${d.color}"><div class="fi"><canvas width="64" height="64" data-enemy="${k}" data-seen="${seen ? 1 : 0}" style="width:40px;height:40px"></canvas><div><h4 class="${seen || n ? '' : 'q'}">${seen || n ? name : '???'}</h4><p>${txt}</p></div></div></div>`;
        }).join('');
      el.innerHTML = `${topbar(L('ARCHIV', 'ARCHIVE'), L('KODEX', 'CODEX'))}
        <div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === codexTab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
        <div class="grid-cards">${body}</div>`;
      el.querySelectorAll('canvas[data-enemy]').forEach(c => {
        const k = c.dataset.enemy, d = ENEMIES[k], x = c.getContext('2d'), known = SAVE.bestiary[k] > 0 || c.dataset.seen === '1';
        const img = Sprites.enemy(d.shape, d.r, known ? d.color : '#6b6f8f', false, false);
        if (!known) x.globalAlpha = 0.45;
        const s = 52 / (img.hw * 2) * Math.min(1.6, 26 / d.r);
        x.translate(32, 32); x.scale(s, s); x.drawImage(img, -img.hw, -img.hw, img.hw * 2, img.hw * 2);
      });
    },

    // Pořadí priorit pro automatický výběr karet: kompaktní mřížka, která se celá vejde na obrazovku
    // (čte se shora dolů a pak dalším sloupcem; počet řádků podle výšky okna, prioLayout). Položky se
    // přetahují myší (celé) nebo prstem (za úchyt), šipky posunou o jedno místo. Popis položky pod
    // myší se ukáže v liště nahoře.
    prio(el) {
      const order = prioList(SAVE.settings.prio), n = order.length;
      el.innerHTML = `${topbar(L('AUTOMATICKÝ VÝBĚR', 'AUTO-PICK'), L('PRIORITY', 'PRIORITIES'), `<button class="btn ghost" data-prio="reset">${icon('reroll')} ${L('Výchozí', 'Default')}</button>`, 'settings')}
        <div class="prio-wrap">
          <div class="prio-head">
            <div class="ph-tog"><b>${L('Automatický výběr karet', 'Auto-pick cards')}</b><button class="toggle ${SAVE.settings.autoPick ? 'on' : ''}" data-tog="autoPick"></button></div>
            <div class="prio-info" id="prioInfo">${prioHelp()}</div>
          </div>
          <ol class="prio-list" id="prioList">${order.map((k, i) => {
            const f = prioInfo(k), [c, tag] = prioCat(k);
            return `<li data-k="${k}" class="cat-${c} ${f.locked ? 'locked' : ''} ${i < 3 ? 'top' : ''}" style="--c:${f.color}">
              <span class="grip" aria-hidden="true">⠿</span><b class="pn">${i + 1}</b><span class="pic">${icon(f.icon)}</span>
              <span class="pt">${f.name}</span><em class="tag cat-${c}">${tag}</em>
              <span class="pmv"><button class="pa" data-prio="up:${i}" ${i === 0 ? 'disabled' : ''} aria-label="${L('Výš', 'Up')}">▲</button><button class="pa" data-prio="down:${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="${L('Níž', 'Down')}">▼</button></span></li>`;
          }).join('')}</ol>
        </div>`;
      const list = el.querySelector('#prioList'), info = el.querySelector('#prioInfo');
      prioDrag(list, el);
      // popis položky pod myší (nebo s fokusem) v liště nahoře
      const show = li => { info.innerHTML = li ? prioHelp(li.dataset.k) : prioHelp(); };
      list.addEventListener('pointerover', e => { if (!document.body.classList.contains('dragging')) show(e.target.closest('#prioList > li')); });
      list.addEventListener('pointerleave', () => show(null));
      list.addEventListener('focusin', e => show(e.target.closest('#prioList > li')));
      requestAnimationFrame(() => prioLayout(list));
    },

    // Nastavení po skupinách přes celou šířku; vpravo ukázka, jak nastavení pod myší vypadá zapnuté a vypnuté.
    settings(el) {
      const s = SAVE.settings, pl = PerfLog.lastLog();
      const perfLast = pl && pl.created ? `${new Date(pl.created).toLocaleString(LANG === 'cs' ? 'cs-CZ' : 'en-GB')}${pl.seconds ? ` · ${fmtTime(pl.seconds)}` : ''}` : '';
      const grp = (ic, title, rows, cls = '') => `<section class="setg ${cls}"><h4>${icon(ic)} ${title}</h4>${rows}</section>`;
      el.innerHTML = `${topbar(L('KONFIGURACE', 'CONFIGURATION'), L('NASTAVENÍ', 'SETTINGS'))}
        <div class="set-wrap">
          <div class="set-groups" data-scroll>
            ${grp('auto', L('Hratelnost', 'Gameplay'), `
          <div class="row" data-pv="autoPick" tabindex="-1"><label>${L('Automatický výběr karet', 'Auto-pick cards')}<small>${L('Při postupu se hra nezastaví: vybere kartu nejvýš v pořadí priorit', 'Level-ups no longer pause: the card highest in your priority order is picked')}</small></label><button class="btn" data-go="prio">${icon('auto')} ${L('Priority', 'Priorities')}</button><button class="toggle ${s.autoPick ? 'on' : ''}" data-tog="autoPick"></button></div>
          <div class="row" data-pv="autoChest" tabindex="-1"><label>${L('Truhly bez okna', 'Chests without a window')}<small>${L('Truhla se otevře sama a hra se nezastaví: co v ní bylo, se jen krátce ukáže nad lodí', 'A chest opens by itself and the game keeps going: its contents only flash above your ship')}</small></label><button class="toggle ${s.autoChest ? 'on' : ''}" data-tog="autoChest"></button></div>`)}
            ${grp('eye', L('Obraz', 'Display'), `
          <div class="row" data-pv="shake" tabindex="-1"><label>${L('Otřesy obrazovky', 'Screen shake')}<small>${L('Při explozích a zásazích', 'On explosions and hits')}</small></label><button class="toggle ${s.shake ? 'on' : ''}" data-tog="shake"></button></div>
          <div class="row" data-pv="dmgNums" tabindex="-1"><label>${L('Čísla poškození', 'Damage numbers')}<small>${L('Plovoucí čísla nad nepřáteli', 'Floating numbers above enemies')}</small></label><button class="toggle ${s.dmgNums ? 'on' : ''}" data-tog="dmgNums"></button></div>
          <div class="row" data-pv="quality" tabindex="-1"><label>${L('Kvalita vykreslování', 'Rendering quality')}<small>${L('Auto hlídá rozlišení podle obrazovky a při sekání ho sníží. Úsporná kreslí v 70 % rozlišení.', 'Auto keeps the resolution in budget for your screen and lowers it when the game stutters. Saver draws at 70% resolution.')}</small></label><button class="btn" data-act="quality">${{ auto: 'Auto', high: L('Plná', 'Full'), low: L('Úsporná', 'Saver') }[s.quality || 'auto']}</button></div>
          <div class="row" data-pv="fps" tabindex="-1"><label>${L('Počítadlo FPS', 'FPS counter')}<small>${L('Snímky za sekundu a počet nepřátel v rohu obrazovky', 'Frames per second and the enemy count in the corner')}</small></label><button class="toggle ${s.fps ? 'on' : ''}" data-tog="fps"></button></div>`)}
            ${grp('wave', L('Jazyk a zvuk', 'Language & sound'), `
          <div class="row"><label>${L('Jazyk', 'Language')}<small>Čeština / English</small></label>${langSwitch()}</div>
          <div class="row"><label>${L('Efekty', 'Effects')}<small>${L('Hlasitost zvukových efektů', 'Sound effects volume')}</small></label><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-vol="sfx"></div>
          <div class="row"><label>${L('Hudba', 'Music')}<small>${L('Generativní synthwave', 'Generative synthwave')}</small></label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-vol="music"></div>
          ${window.GCMusic ? `<div class="row"><label>${L('Vlastní playlist', 'Your playlist')}<small>${L('YouTube, SoundCloud, Spotify, nebo bez hudby', 'YouTube, SoundCloud, Spotify, or no music')}</small></label><button class="btn" data-gcmusic>${L('Nastavit hudbu', 'Music settings')}</button></div>` : ''}`)}
            ${grp('gear', L('Ovládání', 'Controls'), Platform.touch ? `
          <div class="keys touch-keys">
            <span>${L('Joystick', 'Joystick')}</span><span>${L('Polož prst kamkoli na plochu a táhni', 'Put a finger anywhere and drag')}</span>
            <span>DASH</span><span>${L('Úskok — krátká nezranitelnost', 'Dash — brief invulnerability')}</span>
            <span>II</span><span>${L('Pauza (nebo Zpět na Androidu)', 'Pause (or Back on Android)')}</span>
            <span>${L('Zbraně', 'Weapons')}</span><span>${L('Střílí automaticky. Ty jen přežij.', 'They fire automatically. You just survive.')}</span>
          </div>
          ${Platform.canVibrate ? `<div class="row"><label>${L('Vibrace', 'Vibration')}<small>${L('Krátké zachvění při zásahu, úskoku, postupu a bossech', 'A short buzz on hits, dashes, level-ups and bosses')}</small></label><button class="toggle ${s.haptics ? 'on' : ''}" data-tog="haptics"></button></div>` : ''}
          <div class="row"><label>${L('Úskok vlevo', 'Dash on the left')}<small>${L('Tlačítko úskoku v levém dolním rohu (pro leváky)', 'The dash button in the bottom left corner (left-handed)')}</small></label><button class="toggle ${s.dashLeft ? 'on' : ''}" data-tog="dashLeft"></button></div>
          <div class="row"><label>${L('Šetřit baterii', 'Save battery')}<small>${L('Nejvýš 60 snímků za sekundu i na rychlých displejích', 'At most 60 frames per second, even on fast displays')}</small></label><button class="toggle ${s.fpsCap ? 'on' : ''}" data-tog="fpsCap"></button></div>` : `
          <div class="keys">
            <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>${L('Pohyb (nebo šipky / gamepad)', 'Move (or arrows / gamepad)')}</span>
            <span><kbd>${L('Mezerník', 'Space')}</kbd></span><span>${L('Úskok — krátká nezranitelnost', 'Dash — brief invulnerability')}</span>
            <span><kbd>Esc</kbd><kbd>P</kbd></span><span>${L('Pauza', 'Pause')}</span>
            <span><kbd>1</kbd>–<kbd>4</kbd></span><span>${L('Výběr karty při postupu', 'Pick a card on level-up')}</span>
            <span><kbd>R</kbd> / <kbd>X</kbd></span><span>${L('Přehodit / přeskočit karty', 'Reroll / skip cards')}</span>
            <span>${L('Zbraně', 'Weapons')}</span><span>${L('Střílí automaticky. Ty jen přežij.', 'They fire automatically. You just survive.')}</span>
          </div>`, 'keys-g')}
            ${DEBUG ? grp('calib', L('Debug', 'Debug'), `
          <p class="dbg-note">${L('Nástroje pro ladění. Při vydání se sekce schová (DEBUG_MENU v debug.js).', 'Tools for testing. Hidden for a release (DEBUG_MENU in debug.js).')}</p>
          <div class="row"><label>${L('Záznam výkonu', 'Performance log')}<small>${L('Když se hra seká: během běhu zaznamenává FPS, délky snímků a počty objektů. Po skončení běhu si log stáhneš a pošleš vývojáři.', 'If the game stutters: records FPS, frame times and object counts during a run. Download the log after the run and send it to the developer.')}${perfLast ? `<br>${L('Poslední log', 'Last log')}: ${perfLast}` : ''}</small></label>${PerfLog.lastLog() ? `<button class="btn" data-act="perflog">${icon('book')} ${L('Stáhnout log', 'Download log')}</button>` : ''}<button class="toggle ${s.perfLog ? 'on' : ''}" data-tog="perfLog"></button></div>
          <div class="row"><label>${L('Nesmrtelnost', 'God mode')}<small>${L('Smrtelný zásah jen doplní zdraví', 'A fatal hit only refills your health')}</small></label><button class="toggle ${s.dbgGod ? 'on' : ''}" data-tog="dbgGod"></button></div>
          <div class="row"><label>${L('Výřez displeje', 'Display cutout')}<small>${L('Simuluje notch a indikátor domů jako na iPhonu (na výšku i na šířku)', 'Simulates an iPhone notch and home indicator (portrait and landscape)')}</small></label><button class="toggle ${s.dbgNotch ? 'on' : ''}" data-tog="dbgNotch"></button></div>
          <div class="row"><label>${L('Hitboxy', 'Hitboxes')}<small>${L('Kruhy zásahů nepřátel, jejich střel a lodi', 'Hit circles of enemies, their shots and your ship')}</small></label><button class="toggle ${s.dbgHit ? 'on' : ''}" data-tog="dbgHit"></button></div>
          <div class="row"><label>${L('Rychlost hry', 'Game speed')}<small>${L('Víc kroků simulace za snímek', 'More simulation steps per frame')}</small></label><button class="btn" data-act="dbgSpeed">${s.dbgSpeed || 1}×</button></div>
          <div class="row"><label>${L('Odemknout vše', 'Unlock everything')}<small>${L('Všechny sektory, Overdrive a piloti, jen dokud je zapnuto (postup se nemění)', 'All sectors, Overdrive and pilots while it is on (progress is not changed)')}</small></label><button class="toggle ${s.dbgUnlock ? 'on' : ''}" data-tog="dbgUnlock"></button></div>
          <div class="row"><label>${L('Legendy: jistá šance', 'Legends: sure chance')}<small>${L('Legenda přiletí pokaždé, když splníš její podmínku', 'A legend appears every time you meet its condition')}</small></label><button class="toggle ${s.dbgLegend ? 'on' : ''}" data-tog="dbgLegend"></button></div>
          <div class="row"><label>${L('Přivolat legendu', 'Summon a legend')}<small>${L('Zvolená legenda přiletí 12 s po startu každého běhu', 'The chosen legend arrives 12 s into every run')}</small></label><button class="btn" data-act="dbgLegendNext">${s.dbgLegendNext && ENEMY_NAMES[s.dbgLegendNext] ? ENEMY_NAMES[s.dbgLegendNext][0] : L('Žádná', 'None')}</button></div>
          <div class="row"><label>${L('Střepy', 'Shards')}<small>${L('Přidá střepy na nákupy v Kovárně', 'Adds shards for the Forge')}</small></label><button class="btn" data-act="dbgShards">+10 000 ◆</button></div>`, 'debug') : ''}
            ${grp('skull', L('Data', 'Data'), `
          <div class="row"><label>${L('Smazat postup', 'Erase progress')}<small>${L('Nevratně vymaže všechny střepy, úspěchy a odemčení', 'Permanently erases all shards, achievements and unlocks')}</small></label><button class="btn danger" data-act="wipe">${L('Smazat', 'Erase')}</button></div>`, 'danger')}
          </div>
          <aside class="set-pv" id="setPv">${SetPreview.html(setPv)}</aside>
        </div>`;
      // Ukázka jen po najetí na nastavení, které jde vidět ve hře. Jiný řádek (zvuk, jazyk…) nebo odjetí
      // ze seznamu ji schová; mezery mezi řádky a nadpisy skupin nechají tu poslední.
      const groups = el.querySelector('.set-groups'), aside = el.querySelector('#setPv');
      const pick = k => {
        if (k !== setPv) { setPv = k; aside.innerHTML = SetPreview.html(k); aside.classList.toggle('empty', !k); }
        groups.querySelectorAll('[data-pv]').forEach(x => x.classList.toggle('pv', x.dataset.pv === k));
      };
      const at = e => { const r = e.target.closest('.row, .keys'); if (r) pick(r.dataset.pv || null); };
      groups.addEventListener('pointerover', at); groups.addEventListener('focusin', at); groups.addEventListener('click', at);
      groups.addEventListener('pointerleave', () => pick(null));
      aside.classList.toggle('empty', !setPv);
      if (setPv) pick(setPv);
    },
  };

  // ── Vzácnost úspěchů (kolik hráčů s účtem je má) ──
  const ACH_TIERS = [['common', '#c9c8ea', L('Běžné', 'Common')], ['uncommon', '#5dffa8', L('Neobvyklé', 'Uncommon')], ['rare', '#55c8ff', L('Vzácné', 'Rare')], ['epic', '#c58bff', L('Epické', 'Epic')], ['legend', '#ffb347', L('Legendární', 'Legendary')]];
  const RARITY_MIN = 10; // od kolika hráčů s účtem se vzácnost řídí jejich procenty
  let rarity = null, rarityAt = 0;
  function loadRarity() {
    if (Date.now() - rarityAt < 300e3) return;
    rarityAt = Date.now();
    fetch('/api/rarity?game=voidborn', { credentials: 'same-origin' }).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d || typeof d.total !== 'number') return;
      rarity = { total: d.total, counts: d.counts || {} };
      if (current === 'ach') rerender();
    }).catch(() => { /* bez sítě: vzácnost podle obtížnosti */ });
  }

  const SECTOR_RULE = s => (s.meteors && s.well && s.dark ? L('Všechny anomálie', 'Every anomaly') : s.rush ? L('Přehlídka bossů', 'Boss parade') : s.zone ? L('Smršťující se zóna', 'Shrinking zone')
    : s.meteors ? L('Meteority', 'Meteors') : s.mono ? L('Jediný druh', 'One kind only') : s.well ? L('Černá díra', 'Black hole') : s.dark ? L('Tma', 'Darkness') : '');
  function sectorCard(s, i) {
    const un = sectorUnlocked(i), r = SAVE.sectors[s.id], req = SECTORS.find(x => x.id === sectorReq(i));
    const rule = SECTOR_RULE(s);
    return `<button class="sector ${un ? '' : 'locked'} ${i === hs.sector ? 'sel' : ''}" data-sector="${i}" style="--s1:${s.bg[0]};--s2:${s.bg[1]};--a:${s.accent}">
      <div class="rn">${s.roman}</div><div class="sn">${un ? s.name : L('Neznámý sektor', 'Unknown sector')}</div>
      <div class="sx">${un ? `${rule ? `<b class="rule">${rule}</b> · ` : ''}${L('Odolnost', 'Toughness')} ×${s.hp} · ${L('Střepy', 'Shards')} ×${s.shards}` : s.req ? L(`Dokonči Sektor ${req.roman}`, `Clear Sector ${req.roman}`) : L('Dokonči předchozí sektor', 'Clear the previous sector')}</div>
      ${r && r.cleared ? `<div class="done">${icon('trophy')}</div>` : ''}
    </button>`;
  }

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (current === 'forge' && id !== 'forge') Forge3D.unmount();
    current = id;
    if (!id) return;
    // Zpět (Android, gesto, prohlížeč) z podobrazovky vede do menu, z menu ven ze hry (platform.js)
    if (id === 'menu' || id === 'title') Platform.disarm(); else Platform.arm();
    if (id === 'settings') setPv = null;
    const el = $('#s-' + id);
    actions = {};
    screens[id](el);
    el.classList.add('active');
    el.scrollTop = 0;
  }
  function rerender() {
    if (!current) return;
    const el = $('#s-' + current), st = el.scrollTop, inner = [...el.querySelectorAll('[data-scroll]')].map(x => x.scrollTop);
    screens[current](el);
    el.scrollTop = st;
    el.querySelectorAll('[data-scroll]').forEach((x, i) => { if (inner[i] != null) x.scrollTop = inner[i]; });
  }

  // ── Delegované události ───────────────────────────────────────────────────
  function init() {
    let lastHover = null;
    document.addEventListener('pointerover', e => {
      const b = e.target.closest('button');
      if (b && b !== lastHover && !b.disabled) { lastHover = b; Sound.play.hover(); }
      if (!b) lastHover = null;
    });
    // Okno, které se otevřelo pod drženým prstem (karty postupu, truhla), nesmí vzít „click“ po jeho
    // zvednutí: platí jen klepnutí, které začalo až po otevření okna.
    let downAt = 0;
    document.addEventListener('pointerdown', () => { downAt = performance.now(); }, true);
    document.addEventListener('click', e => {
      if (overlayOpen() && e.target.closest('#overlay') && downAt < openedAt && e.detail > 0) return;
      const t = e.target.closest('[data-go],[data-pilot],[data-sector],[data-od],[data-buy],[data-tab],[data-tog],[data-act],[data-pick],[data-lang],[data-prio],[data-part],[data-lw],[data-lmode],#startBtn,#pauseBtn');
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
      } else if (ds.part) {
        if (forgePart === ds.part) return;
        forgePart = ds.part; Forge3D.select(ds.part, true); Sound.play.select(); forgeRefresh(false);
      } else if (ds.lmode) {
        loMode = ds.lmode; Sound.play.click(); rerender();
      } else if (ds.lw) {
        toggleLoadout(ds.lw);
      } else if (ds.prio) {
        movePrio(ds.prio);
      } else if (ds.tab) {
        codexTab = ds.tab; Sound.play.click(); rerender();
      } else if (ds.tog) {
        SAVE.settings[ds.tog] = !SAVE.settings[ds.tog]; persist(); Sound.play.click(); Platform.apply(); rerender();
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
    perflog() { PerfLog.download(); Sound.play.click(); },
    // Debug (sekce jen při DEBUG)
    dbgSpeed() { if (!DEBUG) return; const o = [1, 2, 4], v = SAVE.settings.dbgSpeed || 1; SAVE.settings.dbgSpeed = o[(o.indexOf(v) + 1) % o.length]; persist(); Sound.play.click(); rerender(); },
    dbgShards() { if (!DEBUG) return; SAVE.shards += 10000; persist(); Sound.play.buy(); rerender(); },
    dbgLegendNext() { if (!DEBUG) return; const o = ['', ...LEGENDS], v = SAVE.settings.dbgLegendNext || ''; SAVE.settings.dbgLegendNext = o[(o.indexOf(v) + 1) % o.length]; persist(); Sound.play.click(); rerender(); },
    quality() {
      const order = ['auto', 'high', 'low'], q = SAVE.settings.quality || 'auto';
      SAVE.settings.quality = order[(order.indexOf(q) + 1) % order.length];
      persist(); Sound.play.click(); Render.resize(); rerender();
    },
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
    if (l >= f.max || !forgeOpen(f)) return;
    const cost = forgeCost(f, l);
    if (SAVE.shards < cost) { Sound.play.error(); return; }
    SAVE.shards -= cost;
    SAVE.forge[id] = l + 1;
    Sound.play.buy();
    checkAchievements(false);
    persist();
    if (current === 'forge' && $('#fpanel')) {
      const same = forgePart === f.part;
      if (!same) { forgePart = f.part; Forge3D.select(f.part, true); }
      forgeRefresh(same);
      // úspěch za nákup mohl přidat střepy: ty se ukážou v horní liště (forgeRefresh)
    } else rerender();
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

  // Jak se statistika projeví: hodnota teď → po výběru (karty doplňků a mutací).
  const STAT_FMT = {
    might: [L('Poškození', 'Damage'), s => signPct(s.might - 1)],
    cdMul: [L('Nabíjení', 'Cooldown'), s => signPct(s.cdMul - 1)],
    area: [L('Oblast', 'Area'), s => signPct(s.area - 1)],
    speed: [L('Rychlost', 'Speed'), s => signPct(s.speed / 205 - 1)],
    armor: [L('Přijaté zranění', 'Damage taken'), s => signPct(armorFactor(s.armor) - 1)],
    maxHp: [L('Max. zdraví', 'Max HP'), s => Math.round(s.maxHp)],
    magnet: [L('Dosah sběru', 'Pickup range'), s => signPct(s.magnet / 90 - 1)],
    dur: [L('Trvání', 'Duration'), s => signPct(s.dur - 1)],
    regen: [L('Regenerace', 'Regen'), s => s.regen.toFixed(1) + L(' /s', '/s')],
    luck: [L('Štěstí', 'Luck'), s => signPct(s.luck - 1)],
    crit: [L('Krit. zásah', 'Crit chance'), s => pct(s.crit) + L(' %', '%')],
    critDmg: [L('Krit. poškození', 'Crit damage'), s => '×' + s.critMul.toFixed(2)],
    amount: [L('Projektily navíc', 'Extra projectiles'), s => '+' + s.amount],
    shield: [L('Dobití štítu', 'Shield recharge'), s => (s.shieldCd ? s.shieldCd + ' s' : '—')],
    greed: [L('Střepy', 'Shards'), s => signPct(s.greed - 1)],
  };
  function statLines(mod, after) {
    return Object.keys(mod).filter(k => STAT_FMT[k]).map(k => {
      const [label, f] = STAT_FMT[k];
      return `<div class="cstat"><span>${label}</span><b>${f(G.st)} → ${f(after)}</b></div>`;
    }).join('');
  }

  function prioInfo(k) {
    if (k === 'evo') return { name: L('Evoluce', 'Evolution'), icon: 'star', color: '#ffd166', sub: L('Zbraň se změní ve svou evoluci; mezi zbraněmi rozhoduje jejich pořadí níž', 'A weapon turns into its evolution; between weapons, their order below decides') };
    if (k === 'start') return { name: L('Startovní zbraň', 'Starting weapon'), icon: 'rocket', color: '#55f6ff', sub: L('Vylepšení, evoluce i přetížení zbraně, se kterou pilot začíná', 'Upgrades, evolution and overcharge of the weapon the pilot starts with') };
    if (k === 'catalyst') return { name: L('Klíč k evoluci', 'Evolution key'), icon: 'growth', color: '#5dffa8', sub: L('Doplněk, který některé tvé zbrani chybí k evoluci', 'A passive one of your weapons still needs to evolve') };
    if (k === 'oc') return { name: L('Přetížení evoluce ★', 'Evolution overcharge ★'), icon: 'overcharge', color: '#ffd166', sub: L('Mezi zbraněmi rozhoduje jejich pořadí níž', 'Between weapons, their order below decides') };
    if (k.startsWith('m:')) { const m = MUTATIONS[k.slice(2)]; return { name: m.name, icon: 'mutation', color: m.color, sub: m.desc }; }
    if (k === 'heal') return { name: L('Nanoopravy', 'Nano-repair'), icon: 'heal', color: '#5dffa8', sub: L('Jen při nízkém zdraví', 'Only at low health') };
    if (k === 'gold') return { name: L('Hromádka střepů', 'Shard pile'), icon: 'shard', color: '#e08bff' };
    const [t, id] = k.split(':'), d = t === 'w' ? WEAPONS[id] : PASSIVES[id], open = unlocked(d);
    return { name: open ? d.name : '???', icon: d.icon, color: d.color, sub: t === 'w' ? L('Zbraň', 'Weapon') : L('Doplněk', 'Passive'), locked: !open };
  }
  // Automatický výběr: krátce ukáže, co se vybralo (nad lodí).
  function autoPicked(list) {
    list.slice(-3).forEach((c, i) => {
      const f = choiceInfo(c);
      addText(G.p.x, G.p.y - 40 - i * 18, (c.echo ? L('↻ Ozvěna: ', '↻ Echo: ') : '▲ ') + f.name + (f.badge && f.badge !== 'Bonus' ? ' · ' + f.badge : ''), f.color, 14, 1.6);
    });
    if (list.length > 3) addText(G.p.x, G.p.y - 40 - 3 * 18, L(`a ${list.length - 3} další`, `and ${list.length - 3} more`), '#ffffff', 12, 1.6);
  }
  const prioCat = k => (k.startsWith('w:') ? ['w', L('Zbraň', 'Weapon')] : k.startsWith('p:') ? ['p', L('Doplněk', 'Passive')] : k.startsWith('m:') ? ['m', L('Mutace', 'Mutation')]
    : k === 'heal' || k === 'gold' ? ['x', L('Náhradní', 'Fallback')] : ['r', L('Pravidlo', 'Rule')]);
  // Lišta nad seznamem: návod, nebo popis položky pod myší.
  function prioHelp(k) {
    if (!k) return `<p>${icon('auto')} <span>${L('Při postupu vyhraje karta, která je v pořadí nejvýš. <b>Přetáhni</b> položku na nové místo (na telefonu za úchyt <i class="gr">⠿</i>), nebo ji posuň šipkami. Najeď na položku a uvidíš, co znamená.', 'On level-up the card highest in this order wins. <b>Drag</b> an entry to a new place (on a phone by its handle <i class="gr">⠿</i>) or nudge it with the arrows. Hover an entry to see what it means.')}</span></p>`;
    const f = prioInfo(k), [c, tag] = prioCat(k), i = prioList(SAVE.settings.prio).indexOf(k) + 1;
    const sub = c === 'w' ? L('Zbraň: nová, další úroveň i evoluce a přetížení této zbraně.', 'Weapon: new, next level, its evolution and overcharge.')
      : c === 'p' ? L('Doplněk: nový i další úroveň.', 'Passive: new or the next level.') : f.sub || '';
    return `<p class="pi-k" style="--c:${f.color}"><span class="pic">${icon(f.icon)}</span><span><b>${i}. ${f.name}</b> <em class="tag cat-${c}">${tag}</em><br>${sub}</span></p>`;
  }
  // Mřížka priorit se vejde na obrazovku: řádků kolik se vejde na výšku, sloupců kolik je potřeba.
  // Na úzkém displeji (telefon) se 37 položek vejít nedá: tam jeden sloupec a obrazovka se posouvá.
  function prioLayout(list) {
    if (!list || !list.isConnected) return;
    if (innerWidth <= 760) { list.style.removeProperty('--rows'); list.style.removeProperty('--cols'); list.classList.remove('fit', 'narrow'); return; }
    list.classList.add('fit'); // v mřížce má seznam výšku zbytku obrazovky (ne podle obsahu)
    const n = list.children.length, H = list.clientHeight, W = list.clientWidth, gap = 6;
    let rowH = 40, rows = Math.max(5, Math.floor((H + gap) / (rowH + gap))), cols = Math.ceil(n / rows);
    // moc sloupců na šířku: menší řádky
    if (W / cols < 230) { rowH = 34; rows = Math.max(5, Math.floor((H + gap) / (rowH + gap))); cols = Math.ceil(n / rows); }
    rows = Math.ceil(n / cols); // vyrovnané sloupce
    list.style.setProperty('--rows', rows); list.style.setProperty('--cols', cols); list.style.setProperty('--rh', rowH + 'px');
    list.classList.toggle('narrow', W / cols < 300);
  }
  window.addEventListener('resize', () => { if (current === 'prio') prioLayout($('#prioList')); });
  // Přetahování priorit: ukazatelové události (myš i dotyk). Položka se zvedne do „ducha“, který
  // jde za prstem, a v seznamu se průběžně přesouvá prázdné místo; u okraje se obrazovka posouvá.
  function prioDrag(list, screen) {
    let d = null;
    const renumber = () => [...list.children].forEach((li, i) => { li.querySelector('.pn').textContent = i + 1; li.classList.toggle('top', i < 3); });
    function hit(x, y) {
      const t = document.elementFromPoint(x, y), over = t && t.closest('#prioList > li');
      if (!over || over === d.li) return;
      const r = over.getBoundingClientRect(), after = y > r.top + r.height / 2;
      const ref = after ? over.nextElementSibling : over;
      if (ref === d.li || d.li.nextElementSibling === ref) return; // už tam je
      list.insertBefore(d.li, ref);
      renumber();
    }
    function tick() {
      if (!d || !d.on) return;
      if (d.vy) { screen.scrollTop += d.vy; hit(d.x, d.y); }
      d.raf = requestAnimationFrame(tick);
    }
    function end(e) {
      if (!d || (e && e.pointerId !== d.id)) return;
      const was = d; d = null;
      cancelAnimationFrame(was.raf);
      if (!was.on) return;
      was.ghost.remove(); was.li.classList.remove('ph'); document.body.classList.remove('dragging');
      const order = [...list.children].map(li => li.dataset.k);
      if (order.join() !== was.before) { SAVE.settings.prio = order; persist(); Sound.play.click(); }
      rerender();
    }
    list.addEventListener('pointerdown', e => {
      const li = e.target.closest('li');
      if (!li || e.button > 0 || e.target.closest('.pa')) return;
      // na dotyk jen za úchyt: jinde prst seznam posouvá
      if (e.pointerType !== 'mouse' && !e.target.closest('.grip')) return;
      d = { li, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, on: false, vy: 0, before: [...list.children].map(x => x.dataset.k).join() };
      // zachytí celý seznam (ne položku: ta se při přesunu v DOM odpojí a zachycení by ztratila)
      try { list.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      if (e.pointerType !== 'mouse') e.preventDefault();
    });
    list.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      d.x = e.clientX; d.y = e.clientY;
      if (!d.on) {
        if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
        const r = d.li.getBoundingClientRect();
        d.dx = e.clientX - r.left; d.dy = e.clientY - r.top;
        d.ghost = d.li.cloneNode(true); d.ghost.className += ' prio-ghost'; d.ghost.style.width = r.width + 'px';
        document.body.appendChild(d.ghost); document.body.classList.add('dragging');
        d.li.classList.add('ph'); d.on = true; Sound.play.select();
        d.raf = requestAnimationFrame(tick);
      }
      d.ghost.style.transform = `translate(${e.clientX - d.dx}px, ${e.clientY - d.dy}px) rotate(-1.5deg)`;
      const sr = screen.getBoundingClientRect(), edge = 70;
      d.vy = e.clientY < sr.top + edge ? -Math.ceil((sr.top + edge - e.clientY) / 6) : e.clientY > sr.bottom - edge ? Math.ceil((e.clientY - sr.bottom + edge) / 6) : 0;
      hit(e.clientX, e.clientY);
    });
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
    list.addEventListener('lostpointercapture', end);
  }
  function movePrio(arg) {
    let order = prioList(SAVE.settings.prio);
    if (arg === 'reset') order = PRIO_DEFAULT.slice();
    else {
      const [dir, si] = arg.split(':'), i = +si, j = dir === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
    }
    SAVE.settings.prio = order; persist(); Sound.play.click(); rerender();
  }

  function choiceInfo(c) {
    const lvl = L('Úroveň ', 'Level '), nw = L('Nové', 'New');
    if (c.kind === 'weapon') {
      const d = WEAPONS[c.id];
      const start = c.id === G.startWeapon;
      return { name: d.name, color: d.color, icon: d.icon, badge: c.isNew ? nw : lvl + c.lvl, isNew: c.isNew, desc: c.isNew ? d.desc : d.up[c.lvl - 2][1], type: L('Zbraň', 'Weapon') + (start ? L(' · startovní, evoluce zaručena', ' · starting, evolution guaranteed') : ''), lvl: c.lvl, max: 8 };
    }
    if (c.kind === 'passive') {
      const d = PASSIVES[c.id], after = calcStats(G.pilot, SAVE.forge, Object.assign({}, G.passives, { [c.id]: c.lvl }), G.mut);
      return { name: d.name, color: d.color, icon: d.icon, badge: c.isNew ? nw : lvl + c.lvl, isNew: c.isNew, desc: d.desc, stat: statLines(d.mod, after), type: L('Doplněk', 'Passive'), lvl: c.lvl, max: d.max, hint: c.evoHint && WEAPONS[c.evoHint].name };
    }
    if (c.kind === 'oc') {
      const d = WEAPONS[c.id];
      return { name: d.name, color: '#ffd166', icon: 'overcharge', badge: L('Přetížení ', 'Overcharge ') + '★' + c.lvl, desc: L(`+${pct(OC_DMG)} % poškození, −${pct(OC_CD)} % nabíjení (celkem +${pct(OC_DMG * c.lvl)} % poškození)`, `+${pct(OC_DMG)}% damage, −${pct(OC_CD)}% cooldown (+${pct(OC_DMG * c.lvl)}% damage in total)`), type: L('Přetížení evoluce', 'Evolution overcharge'), stars: [c.lvl, G.st.ocMax], evo: true };
    }
    if (c.kind === 'mut') {
      const d = MUTATIONS[c.id], after = calcStats(G.pilot, SAVE.forge, G.passives, Object.assign({}, G.mut, { [c.id]: c.lvl }));
      return { name: d.name, color: d.color, icon: 'mutation', badge: L('Mutace ', 'Mutation ') + c.lvl + ' / ' + G.st.mutMax, desc: d.desc, stat: statLines(d.mod, after), type: L('Mutace', 'Mutation') };
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
          ${f.stat ? `<div class="cstats">${f.stat}</div>` : ''}
          ${f.max ? `<div class="pips">${Array.from({ length: f.max }, (_, j) => `<i class="${j < f.lvl - 1 ? 'on' : j === f.lvl - 1 ? 'next' : ''}"></i>`).join('')}</div>` : ''}
          ${f.stars ? `<div class="stars">${Array.from({ length: f.stars[1] }, (_, j) => `<i class="${j < f.stars[0] - 1 ? 'on' : j === f.stars[0] - 1 ? 'next' : ''}">★</i>`).join('')}</div>` : ''}
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
      return `<div class="build-item" style="--c:${d.color}">${icon(d.icon)}<span>${d.name}</span>${d.evolved ? `<span style="margin-left:auto;color:var(--gold)">★ ${L('EVOLUCE', 'EVOLVED')}${w.oc ? ' ' + '★'.repeat(w.oc) : ''}</span>` : pips(w.level, 8)}</div>`;
    }).join('');
    const p = Object.entries(G.passives).map(([id, l]) => {
      const d = PASSIVES[id];
      return `<div class="build-item" style="--c:${d.color}">${icon(d.icon)}<span>${d.name}</span>${pips(l, d.max)}</div>`;
    }).join('');
    const m = Object.entries(G.mut).map(([id, l]) => `<div class="build-item" style="--c:${MUTATIONS[id].color}">${icon('mutation')}<span>${MUTATIONS[id].name}</span><b style="margin-left:auto">${l} / ${G.st.mutMax}</b></div>`).join('');
    return `<h4>${L('Zbraně', 'Weapons')} <small>${G.weapons.length} / ${G.st.wSlots}</small></h4><div class="build-list">${w}</div><h4>${L('Doplňky', 'Passives')} <small>${Object.keys(G.passives).length} / ${G.st.pSlots}</small></h4><div class="build-list">${p || `<span class="sum">${L('Zatím žádné', 'None yet')}</span>`}</div>${m ? `<h4>${L('Mutace', 'Mutations')}</h4><div class="build-list">${m}</div>` : ''}`;
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
            <span>${L('Pancíř', 'Armor')}</span><b>${s.armor} (${L('zranění', 'damage')} ${signPct(armorFactor(s.armor) - 1)})</b>
            <span>${L('Regenerace', 'Regen')}</span><b>${s.regen.toFixed(1)}${L(' /s', '/s')}</b>
            <span>${L('Kritický zásah', 'Crit chance')}</span><b>${pct(s.crit)}${L(' %', '%')} · ×${s.critMul.toFixed(2)}</b>
            <span>${L('Štěstí / Růst', 'Luck / Growth')}</span><b>${signPct(s.luck - 1)} / ${signPct(s.growth - 1)}</b>
            ${s.shieldCd ? `<span>${L('Štít', 'Shield')}</span><b>${G.p.shieldOn ? L('nabitý', 'ready') : Math.ceil(G.p.shieldT) + ' s'} · ${L('dobití', 'recharge')} ${s.shieldCd} s</b>` : ''}
            <span>${L('Oživení', 'Revives')}</span><b>${G.revives}${s.reviveFull ? L(' (plné zdraví)', ' (full health)') : ''}</b>
            <span>${L('Přehození / Přeskočení', 'Rerolls / Skips')}</span><b>${G.rerolls} / ${G.skips}</b>
          </div>
          <h4>${L('Karty', 'Cards')}</h4>
          <div class="kv"><span>${L('Automatický výběr podle priorit', 'Auto-pick by priority')}</span><button class="toggle ${SAVE.settings.autoPick ? 'on' : ''}" data-act="auto"></button></div>
          <div class="kv"><span>${L('Truhly bez okna', 'Chests without a window')}</span><button class="toggle ${SAVE.settings.autoChest ? 'on' : ''}" data-act="autochest"></button></div>
          <h4>${L('Zvuk', 'Audio')}</h4>
          <div class="kv"><span>${L('Efekty', 'Effects')}</span><input type="range" min="0" max="1" step="0.05" value="${SAVE.settings.sfx}" data-vol="sfx"><span>${L('Hudba', 'Music')}</span><input type="range" min="0" max="1" step="0.05" value="${SAVE.settings.music}" data-vol="music"></div>
        </div>
      </div>
      <div class="ov-actions">
        <button class="btn primary" data-act="resume">${icon('play')} ${L('Pokračovat', 'Resume')} <kbd>Esc</kbd></button>
        <button class="btn danger" data-act="quit">${L('Opustit misi', 'Abandon mission')}</button>
      </div></div>`, {
      resume: () => Game.togglePause(),
      auto: () => { SAVE.settings.autoPick = !SAVE.settings.autoPick; persist(); Sound.play.click(); showPause(); },
      autochest: () => { SAVE.settings.autoChest = !SAVE.settings.autoChest; persist(); Sound.play.click(); showPause(); },
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
      ${G.perfLogged && PerfLog.lastLog() ? `<div class="perf-dl">${icon('book')}<span>${L('Záznam výkonu z tohoto běhu je připravený. Stáhni ho a pošli vývojáři.', 'The performance log of this run is ready. Download it and send it to the developer.')}</span><button class="btn" data-act="perflog">${L('Stáhnout log', 'Download log')}</button></div>` : ''}
      <div class="ov-actions">
        <button class="btn primary" data-act="again">${icon('reroll')} ${L('Znovu', 'Retry')} <kbd>Enter</kbd></button>
        <button class="btn" data-act="hangar">${icon('rocket')} ${L('Hangár', 'Hangar')}</button>
        <button class="btn ghost" data-act="menu">Menu</button>
      </div></div>`, {
      perflog: () => { PerfLog.download(); Sound.play.click(); },
      again: () => Game.start(G.pilot.id, G.si, G.od),
      hangar: () => Game.toMenu('hangar'),
      menu: () => Game.toMenu('menu'),
    });
  }

  function showVictory() {
    const opened = G.firstClear ? unlockedBy(G.sector.id) : [], next = opened.length > 0;
    overlay(`<div class="ov">
      <div class="ov-title title-win">${L('SEKTOR DOBYT', 'SECTOR CLEARED')}</div>
      <div class="ov-sub">${L('Monarcha prázdnoty padl', 'The Void Monarch has fallen')}</div>
      <div class="ov-panel" style="max-width:560px;margin:30px auto;text-align:center">
        <div class="big-shards" style="justify-content:center">${icon('shard')} +${G.clearBonus}</div>
        <p class="sum" style="margin-top:12px;line-height:1.6">${next ? L(`Odemčen <b style="color:var(--gold)">${opened.map(s => 'Sektor ' + s.roman).join(' a ')}</b> a `, `Unlocked <b style="color:var(--gold)">${opened.map(s => 'Sector ' + s.roman).join(' and ')}</b> and `) : ''}${G.od < MAX_OD ? L(`Overdrive ${G.od + 1} pro tento sektor.`, `Overdrive ${G.od + 1} for this sector.`) : L('Dosáhl jsi maximálního Overdrive.', 'You reached the maximum Overdrive.')}<br>${L('V nekonečném režimu můžeš pokračovat a sbírat další střepy — prázdnota ale poroste každou minutou.', 'You can keep going in endless mode and collect more shards — but the void grows stronger every minute.')}</p>
      </div>
      <div class="ov-actions">
        <button class="btn primary" data-act="endless">${icon('wave')} ${L('Pokračovat do nekonečna', 'Continue into endless')}</button>
        <button class="btn" data-act="finish">${icon('trophy')} ${L('Ukončit misi', 'End mission')}</button>
      </div></div>`, { endless: continueEndless, finish: () => endRun('victory') });
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  function hudShow(on) {
    $('#hud').hidden = !on;
    document.body.classList.toggle('run', on); // na telefonu: oznámení se posunou pod HUD
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
    else if (prop === 're') el.style.setProperty('--re', val);
  }
  // HUD stačí obnovovat 30× za vteřinu: každá změna DOM znamená přepočet stylů, rozvržení a vykreslení
  // (na 240Hz monitoru jinak 240×). Čísla se mění jen jako text, ikony zůstávají.
  let hudT = 0;
  function hudUpdate(fps, force) {
    const now = performance.now();
    if (!force && now - hudT < 33) return;
    hudT = now;
    const p = G.p, s = G.st;
    set('xpFill', 'w', (G.xp / G.xpNext * 100).toFixed(1) + '%');
    const hpw = Math.max(0, p.hp / s.maxHp * 100).toFixed(1) + '%';
    set('hpFill', 'w', hpw); set('hpGhost', 'w', hpw);
    set('hpTxt', 'text', Math.ceil(Math.max(0, p.hp)) + ' / ' + Math.round(s.maxHp));
    set('lvlTag', 'text', L('ÚR ', 'LV ') + G.level);
    set('timer', 'text', fmtTime(G.time));
    set('timer', 'cls', G.time >= bossTimes()[bossTimes().length - 1] - 60 && !G.victory ? 'final' : '');
    set('sectorTag', 'text', `${L('SEKTOR', 'SECTOR')} ${G.sector.roman} · OD ${G.od}${G.endless ? ' · ∞' : ''}`);
    if (!hc.statIcons) { hc.statIcons = 1; $('#killStat').innerHTML = `${icon('skull')} <span id="killN"></span>`; $('#shardStat').innerHTML = `${icon('shard')} <span id="shardN"></span>`; }
    set('killN', 'text', fmtNum(G.kills));
    set('shardN', 'text', fmtNum(G.shards));
    const re = Math.round(p.dashRe / s.dashCd * 20);
    // tlačítko úskoku (dotyk): kruh se plní, jak se úskok dobíjí; bez nabití je ztlumené
    set('dashBtn', 're', p.dashCharges > 0 ? '1' : (p.dashRe / s.dashCd).toFixed(2));
    set('dashBtn', 'cls', p.dashCharges > 0 ? '' : 'empty');
    set('dashPips', 'html', Array.from({ length: s.dashMax }, (_, i) => i < p.dashCharges ? '<i class="on"></i>' : i === p.dashCharges ? `<i><b style="width:${re * 5}%"></b></i>` : '<i></i>').join(''));
    // co dřív v běhu vidět nebylo: zbývající oživení, štít, pancíř a regenerace
    const chips = [];
    if (s.revives) chips.push(`<span class="hc rv ${G.revives ? '' : 'off'}" title="${L('Zbývající oživení', 'Revives left')}">${icon('revival')}<b>${G.revives}</b></span>`);
    if (s.shieldCd) chips.push(`<span class="hc sh ${p.shieldOn ? 'on' : ''}" title="${L('Energetický štít', 'Energy shield')}">${icon('shield')}${p.shieldOn ? '' : `<b>${Math.ceil(p.shieldT)}s</b>`}</span>`);
    if (s.armor) chips.push(`<span class="hc ar" title="${L('Pancíř: méně přijatého zranění', 'Armor: less damage taken')}">${icon('armor')}<b>−${pct(1 - armorFactor(s.armor))}${L(' %', '%')}</b></span>`);
    if (s.regen) chips.push(`<span class="hc rg" title="${L('Regenerace zdraví za sekundu', 'Health regen per second')}">${icon('regen')}<b>+${s.regen.toFixed(1)}</b></span>`);
    if (SAVE.settings.autoPick) chips.push(`<span class="hc au" title="${L('Automatický výběr karet', 'Auto-pick cards')}">${icon('auto')}<b>AUTO</b></span>`);
    if (PerfLog.on) chips.push(`<span class="hc rec" title="${L('Záznam výkonu běží', 'Performance log is recording')}"><i class="dot"></i><b>LOG</b></span>`);
    if (G.zone) {
      const z = G.zone, lbl = { calm: L('Smrštění za', 'Shrinks in'), shrink: L('Smršťuje se', 'Shrinking'), hold: L('Rozšíří se za', 'Grows in'), grow: L('Rozšiřuje se', 'Growing') }[z.phase];
      chips.push(`<span class="hc zo ${z.out > 0 ? 'out' : ''}" title="${L('Bezpečná zóna', 'Safe zone')}">${icon('zone')}<b>${z.out > 0 ? L('MIMO ZÓNU', 'OUTSIDE') : `${lbl} ${Math.ceil(z.t)} s`}</b></span>`);
    }
    if (Legends.alive) { const e = Legends.alive; chips.push(`<span class="hc lg" title="${L('Legenda: zbývá do odletu', 'Legend: time until it leaves')}">${icon('legend')}<b>${ENEMY_NAMES[e.type][0]} · ${Legends.leftText(e)}</b></span>`); }
    if (G.sector.mono && G.monoType) chips.push(`<span class="hc mo" title="${L('Monokultura: teď jen tento druh', 'Monoculture: only this kind for now')}">${icon('skull')}<b>${ENEMY_NAMES[G.monoType][0]}</b></span>`);
    set('hudChips', 'html', chips.join(''));
    if (G.boss) set('bossFill', 'w', Math.max(0, G.boss.hp / G.boss.maxHp * 100).toFixed(1) + '%');
    set('fps', 'text', (SAVE.settings.fps ? fps + ' FPS · ' + G.enemies.length + L(' nepřátel', ' enemies') + ' · ' : '') + 'v' + GAME_VERSION);
  }
  function refreshLoadout() {
    $('#wSlots').innerHTML = G.weapons.map(w => {
      const d = WEAPONS[w.id];
      return `<div class="slot ${d.evolved ? 'evo' : ''}" style="--c:${d.color}">${icon(d.icon)}<b>${d.evolved ? '★' + (w.oc ? w.oc : '') : w.level}</b></div>`;
    }).join('');
    $('#pSlots').innerHTML = Object.entries(G.passives).map(([id, l]) => {
      const d = PASSIVES[id];
      return `<div class="slot" style="--c:${d.color}">${icon(d.icon)}<b>${l}</b></div>`;
    }).join('');
  }
  function bossBar(name) {
    const bb = $('#bossBar');
    document.body.classList.toggle('boss', !!name); // na výšku telefonu: HUD sjede pod pruh bosse
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
    const box = $('#toasts');
    box.appendChild(t);
    // na malém displeji nanejvýš dvě oznámení naráz, ať nezakryjí hru (starší zmizí dřív)
    const max = innerWidth < 700 || innerHeight < 520 ? 2 : 5;
    while (box.children.length > max) box.firstElementChild.remove();
    setTimeout(() => t.remove(), 4500);
  }

  return {
    init, show, rerender, get current() { return current; }, overlayOpen, hideOverlay, confirm,
    showLevelUp, moveFocus, get focusIdx() { return focusIdx; }, get openedAt() { return openedAt; },
    showChest, showPause, showGameOver, showVictory, act: k => { const fn = actions[k]; if (fn) fn(); },
    hudShow, hudUpdate, refreshLoadout, bossBar, banner, toast, hs, autoPicked,
  };
})();
