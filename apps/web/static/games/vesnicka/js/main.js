'use strict';
// ── VESNIČKA · hra: smyčka, ukládání, čas bez hráče, klepání, bytosti ──────────────
const Game = (() => {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* plné nebo zakázané úložiště */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } },
  };
  let S = Econ.load(store.get(SAVE_KEY));
  const isNew = !store.get(SAVE_KEY);
  let last = performance.now(), saveT = 0, achT = 0, uiT = 0, stewT = 0, autoT = 0, wasCreature = null;
  const tapTimes = [];
  /** Jak rychle hráč teď klepe (klepnutí za sekundu za posledních 10 s). */
  function tps() { const t = performance.now() - 10000; while (tapTimes.length && tapTimes[0] < t) tapTimes.shift(); return tapTimes.length / 10; }

  function applySettings() {
    const st = S.settings;
    SCI = !!st.sci; Sound.on = !!st.sound && !st.mute; Sound.vol = (st.sfxVol ?? 100) / 100;
    Hudba.set({ on: !!st.music && !st.mute, vol: (st.musicVol ?? 55) / 100 });
  }
  function save() {
    store.set(SAVE_KEY, Econ.serialize(S));
    store.set(STATS_KEY, JSON.stringify(Econ.hubStats(S)));
    S.t = Date.now();
  }
  // ── Konec hry: po výhře hra stojí a vesnička je jen k prohlížení ──
  const over = () => Econ.over(S);
  function applyOver() {
    const o = over(), wb = document.getElementById('wonBadge');
    document.body.classList.toggle('vs-over', o);
    wb.hidden = !S.paused;
    if (S.paused) wb.innerHTML = `🏆 <b>${L('Vyhráno', 'You won')}</b>`;
    if (o) { document.getElementById('hint').hidden = true; Scene.clearCreature(); wasCreature = null; }
  }

  // ── Čas bez hráče (zavřená hra nebo skrytá karta) ──
  function catchUp(fromMs, toMs, welcome) {
    if (over() || (toMs - fromMs) / 1000 < 1) return;
    const o = Econ.offline(S, fromMs, toMs);
    if (o.cechOpened && !welcome) cechOpened();
    if (o.away < 60 || o.got <= 0) return;
    if (welcome) welcomeBack(o);
    else UI.toast(`${UI.coinSvg} ${L(`Zatímco jsi byl pryč: +${fmt(o.got)}`, `While you were away: +${fmt(o.got)}`)}${o.buys ? ` · 🤵 ${o.buys}` : ''}`);
  }
  /** Uvítání: jak dlouho byl hráč pryč, kolik z toho vesnice vydělávala a kdy se příště vrátit. */
  function welcomeBack(o) {
    const pct = Math.round((o.earnSec / o.away) * 100), perHour = o.got / Math.max(1, o.earnSec / 3600);
    const idle = o.away - o.earnSec;
    UI.modal(`<div class="welcome"><div class="wico">🏡</div><h2>${L('Vítej zpátky!', 'Welcome back!')}</h2>
      <p>${L(`Byl jsi pryč <b>${fmtDur(o.away)}</b>. Vesnička mezitím vydělala`, `You were away for <b>${fmtDur(o.away)}</b>. Meanwhile the village earned`)}</p>
      <div class="wgot">${UI.coinSvg}<b>${fmt(o.got)}</b></div>
      <div class="eff"><div class="effbar"><i style="width:${pct}%"></i></div>
        <div class="effrow"><span>${L('Vydělávala', 'Earning')} <b>${fmtDur(o.earnSec)}</b></span><span>${o.capped ? L(`zahálela <b>${fmtDur(idle)}</b>`, `idle <b>${fmtDur(idle)}</b>`) : ''}</span></div>
        <p class="effp">${L(`Využito <b>${pct} %</b> času · zhruba ${fmt(perHour)} grošů za hodinu`, `<b>${pct}%</b> of the time used · about ${fmt(perHour)} groschen an hour`)}</p></div>
      ${o.cechOpened ? `<p>⚒️ <b>${L('Kovář mezitím založil v obci cech!', 'Meanwhile the smith founded a guild in the village!')}</b> ${L('Podívej se do nové záložky Cech.', 'Have a look at the new Guild tab.')}</p>` : ''}
      ${o.ucni >= 1 ? `<p>👥 ${L(`Cech mezitím vyučil <b>${fmt(o.ucni)}</b> učňů: výnos teď ×${fmt(Econ.cMul(S), 2)}.`, `Meanwhile the guild trained <b>${fmt(o.ucni)}</b> apprentices: income now ×${fmt(Econ.cMul(S), 2)}.`)}</p>` : ''}
      ${o.auto ? `<p>🧑‍🌾 ${L(`Pomocníci mezitím nakoupili <b>${fmtN(o.auto)}×</b> (+${fmtN(o.autoUnits)} budov).`, `Meanwhile your helpers made <b>${fmtN(o.auto)}</b> purchases (+${fmtN(o.autoUnits)} buildings).`)}</p>` : ''}
      ${Econ.elanOpen(S) && o.elan >= 1 ? `<p>💫 ${L(`Elán se doplnil o ${Math.floor(o.elan)} na <b>${Math.floor(S.elan)}/${ELAN_MAX}</b>: otoč přesýpací hodiny nebo vyhlas žně.`, `Spirit refilled by ${Math.floor(o.elan)} to <b>${Math.floor(S.elan)}/${ELAN_MAX}</b>: turn the hourglass or call a harvest rush.`)}</p>` : ''}
      ${o.buys ? `<p>🤵 ${L(`Šafář mezitím koupil <b>${o.buildings}</b> budov, <b>${o.upgrades}</b> vylepšení a <b>${o.cech}</b> do cechu.`, `Meanwhile the steward bought <b>${o.buildings}</b> buildings, <b>${o.upgrades}</b> upgrades and <b>${o.cech}</b> for the guild.`)}</p>` : ''}
      <p class="muted">${o.capped
        ? L(`Bez tebe vesnička vydělává nejvýš ${fmtDur(o.cap)}, pak zahálí. Příště se vrať do ${fmtDur(o.cap)} (když odejdeš teď, tak nejpozději v ${UI.clockAt(o.cap)}). Déle vydrží s Ponocným a s kronikou.`, `Without you the village earns for at most ${fmtDur(o.cap)}, then it idles. Next time come back within ${fmtDur(o.cap)} (if you leave now, by ${UI.clockAt(o.cap)}). The Night watchman and the chronicle make it last longer.`)
        : L(`Vesnička vydělávala celou dobu. Bez tebe vydrží ${fmtDur(o.cap)}: když odejdeš teď, vrať se nejpozději v ${UI.clockAt(o.cap)}.`, `The village earned the whole time. It lasts ${fmtDur(o.cap)} without you: if you leave now, come back by ${UI.clockAt(o.cap)}.`)}</p></div>`,
    [{ text: L('Vybrat groše', 'Collect'), cls: 'gold', fn: () => { Sound.unlock(); Hudba.unlock(); Sound.play.claim(); burstCoins(); newsOnce(); } }]);
  }
  function burstCoins() {
    const cv = document.getElementById('cv'), r = cv.getBoundingClientRect();
    for (let i = 0; i < 18; i++) Scene.coin(r.width / 2 + (Math.random() - 0.5) * 60, r.height * 0.4);
  }

  // ── Akce hráče ──
  function onTap(sx, sy) {
    Sound.unlock(); Hudba.unlock();
    if (over()) return;
    tapTimes.push(performance.now());
    const v = Econ.tap(S), tb = Econ.buff(S, 'tap');
    Scene.floatText(sx, sy - 6, '+' + fmt(v, 1), tb > 1 ? '#ff9a7a' : '#fff3b0', tb >= 25);
    if (Math.random() < 0.5) Scene.coin(sx, sy);
    Sound.play.tap();
    if (!S.seen.tap && S.taps >= 3) { S.seen.tap = 1; document.getElementById('hint').hidden = true; }
    if (!S.seen.firstBuy && S.coins >= BUILDINGS[0].cost) { S.seen.firstBuy = 1; UI.toast(L('Máš na první políčko! Postav ho dole v Řemeslech.', 'You can afford a field! Build it below in Trades.'), 'big'); }
    pulse();
  }
  let pulseT = 0;
  function pulse(big) { const el = document.querySelector('.coins'), c = big ? 'pulse-big' : 'pulse'; el.classList.remove('pulse', 'pulse-big'); void el.offsetWidth; el.classList.add(c); clearTimeout(pulseT); pulseT = setTimeout(() => el.classList.remove(c), big ? 700 : 300); }
  function buy(i, amount, quiet, el) {
    if (over()) return false;
    const ev = Econ.buy(S, i, amount);
    if (!ev) { if (!quiet) Sound.play.no(); return false; }
    UI.pop(el, '+' + fmtN(ev.n), ev.milestones.length ? 'gold' : '');
    afterBuilt(i, ev, quiet);
    afterChange();
    return true;
  }
  // Rychlý nákup a šafář: koupí to, co se nejrychleji zaplatí.
  function cbuy(i, amount, quiet, el) {
    if (over()) return false;
    const ev = Econ.cechBuy(S, i, amount);
    if (!ev) { if (!quiet) Sound.play.no(); return false; }
    UI.pop(el, '+' + fmtN(ev.n), ev.seals.length ? 'gold' : '');
    afterCech(i, ev, quiet);
    afterChange();
    return true;
  }
  function afterCech(i, ev, quiet) {
    const t = CECH[i];
    if (ev.first) { Sound.play.first(); UI.toast(`${t.icon} <b>${t.name}</b> · ${t.desc}`, 'big'); }
    else if (!quiet) Sound.play.buy(); else Sound.play.tap();
    if (ev.seals.length) UI.flash(`.crow[data-c="${i}"]`);
    for (const m of ev.seals) { Sound.play.milestone(); UI.toast(`🔏 <b>${L('Cechovní pečeť', 'Guild seal')}: ${t.name} ${m}×</b> · ${i ? L(`${t.verb} ×2`, `${t.verb} ×2`) : L('učni +5 %', 'apprentices +5%')}`, 'gold'); }
  }
  function cechOpened() {
    Sound.play.bell();
    UI.tabs();
    UI.toast(`⚒️ <b>${L('Kovář založil v obci cech!', 'The smith founded a guild in the village!')}</b> ${L('Přivedl prvního tovaryše a pět učňů. Podívej se do záložky Cech.', 'He brought the first journeyman and five apprentices. Have a look at the Guild tab.')}`, 'big');
  }
  function quickBuy(b) {
    if (over()) return;
    const got = Econ.buyThing(S, b);
    if (!got) { Sound.play.no(); return; }
    if (got.kind === 'b') afterBuilt(got.i, got.ev, false);
    else if (got.kind === 'c') afterCech(got.i, got.ev, false);
    else { Sound.play.upgrade(); UI.toast(`⚡ <b>${got.name}</b> · ${U_INDEX[got.id].effect}`); }
    afterChange();
  }
  function smart() {
    if (over()) return;
    const r = Econ.stewardBuy(S, tps(), 400);
    if (!r.n) { Sound.play.no(); UI.toast(L('🤵 Teď se nic nevyplatí, počkej na groše.', '🤵 Nothing worth buying yet, wait for groschen.')); return; }
    Sound.play.upgrade();
    stewardNews(r);
    UI.toast(`🤵 ${L(`Šafář koupil ${r.buildings} budov, ${r.upgrades} vylepšení a ${r.cech} do cechu.`, `The steward bought ${r.buildings} buildings, ${r.upgrades} upgrades and ${r.cech} for the guild.`)}`);
    afterChange();
  }
  function stewardNews(r) {
    for (const i of r.firsts) { const b = BUILDINGS[i]; Sound.play.first(); UI.toast(`<b>${b.name}</b> · ${b.desc}`, 'big'); }
    for (const [i, m] of r.milestones.slice(-2)) { UI.flash(`.row[data-b="${i}"]`); UI.toast(`⭐ <b>${L('Mistrovství', 'Mastery')}: ${BUILDINGS[i].name} ${fmtN(m)}!</b> ${L(`Nákup teď přinese ${fmtN(Econ.perBuy(S, i))} ks`, `A purchase now brings ${fmtN(Econ.perBuy(S, i))}`)}`, 'gold'); }
    for (const i of r.cfirsts) { const t = CECH[i]; Sound.play.first(); UI.toast(`${t.icon} <b>${t.name}</b> · ${t.desc}`, 'big'); }
    for (const [i, m] of r.seals.slice(-1)) UI.toast(`🔏 <b>${L('Cechovní pečeť', 'Guild seal')}: ${CECH[i].name} ${m}×</b>`, 'gold');
  }
  let stewAgg = 0, stewAggT = 0;
  function stewardTick(dt) {
    if (over() || !S.steward || !S.settings.auto) return;
    stewT += dt; stewAggT += dt;
    if (stewT < 0.5) return;
    stewT = 0;
    const r = Econ.stewardBuy(S, tps(), 30);
    if (r.n) { stewAgg += r.n; stewardNews(r); Sound.play.tap(); afterChange(); }
    if (stewAgg && stewAggT > 20) { UI.toast(`🤵 ${L(`Šafář nakoupil ${stewAgg}×`, `The steward bought ${stewAgg} things`)}`); stewAgg = 0; stewAggT = 0; }
  }
  // Pomocníci z rodokmenu: kupují svá řemesla každou sekundu (jen do desetiny měšce).
  let autoAgg = 0, autoAggT = 0;
  function autoTick(dt) {
    if (over()) return;
    autoT += dt; autoAggT += dt;
    if (autoT < 1) return;
    autoT = 0;
    if (!Econ.autoList(S).length) return;
    const r = Econ.autoBuy(S);
    if (r.n) {
      autoAgg += r.n;
      for (const [i, ev] of r.events.slice(-2)) {
        if (ev.first) { UI.toast(`<b>${BUILDINGS[i].name}</b> · ${BUILDINGS[i].desc}`, 'big'); continue; }
        UI.flash(`.row[data-b="${i}"]`);
        UI.toast(`⭐ <b>${L('Mistrovství', 'Mastery')}: ${BUILDINGS[i].name} ${fmtN(ev.milestones[ev.milestones.length - 1])}!</b> ${L(`Nákup teď přinese ${fmtN(Econ.perBuy(S, i))} ks`, `A purchase now brings ${fmtN(Econ.perBuy(S, i))}`)}`, 'gold');
        Sound.play.milestone();
      }
      afterChange();
    }
    if (autoAgg && autoAggT > 30) { UI.toast(`🧑‍🌾 ${L(`Pomocníci nakoupili ${fmtN(autoAgg)}×`, `Helpers made ${fmtN(autoAgg)} purchases`)}`); autoAgg = 0; autoAggT = 0; }
  }
  /** Kouzla za elán: přesýpací hodiny (hned 15 minut výnosu) a žně (×5 na 20 s). */
  function power(id, el) {
    Sound.unlock(); Hudba.unlock();
    if (over()) return;
    const r = Econ.power(S, id);
    if (!r) { Sound.play.no(); return; }
    const cv = document.getElementById('cv'), rc = cv.getBoundingClientRect(), box = document.getElementById('sceneBox');
    box.classList.remove('fx-warp', 'fx-rush'); void box.offsetWidth; box.classList.add(id === 'warp' ? 'fx-warp' : 'fx-rush');
    setTimeout(() => box.classList.remove('fx-warp', 'fx-rush'), 1200);
    if (id === 'warp') {
      Sound.play.claim(); Sound.play.bell();
      Scene.floatText(rc.width / 2, rc.height * 0.42, '⏳ +' + fmt(r.got), '#fff3b0', true);
      for (let i = 0; i < 26; i++) Scene.coin(rc.width / 2 + (Math.random() - 0.5) * 120, rc.height * 0.45);
      UI.toast(`${POWERS.warp.icon} <b>${POWERS.warp.name}!</b> ${L(`15 minut výnosu naráz: +${fmt(r.got)}`, `15 minutes of income at once: +${fmt(r.got)}`)}`, 'gold');
      pulse(true);
    } else {
      Sound.play.devil();
      Scene.burst(rc.width / 2, rc.height * 0.5, '#ffd36a', 30);
      UI.toast(`${POWERS.rush.icon} <b>${L('Žně!', 'Harvest rush!')}</b> ${L(`Výnos i klepnutí ×${POWERS.rush.mul} na ${r.dur} s. Teď klepej!`, `Income and taps ×${POWERS.rush.mul} for ${r.dur} s. Tap away!`)}`, 'gold');
    }
    afterChange(); save();
  }
  function tree(id) {
    if (over()) return;
    if (!Econ.treeBuy(S, id)) { Sound.play.no(); return; }
    const t = T_INDEX[id];
    Sound.play.legend();
    UI.toast(`${t.icon} <b>${t.name}</b> · ${t.desc}`, 'gold');
    if (t.kind === 'auto') for (const i of t.b) S.settings.ab[BUILDINGS[i].id] = true;
    afterChange(); UI.render(); save();
  }
  function ab(id, on) { S.settings.ab[id] = !!on; save(); }
  function unlocked(icon, name) { Sound.play.bell(); UI.toast(`🔓 ${L('Nové', 'New')}: <b>${icon} ${name}</b>`, 'big'); }
  function elanCheck() {
    if (S.seen.elan || !Econ.elanOpen(S)) return;
    S.seen.elan = 1;
    Sound.play.bell();
    UI.toast(`💫 <b>${L('Elán!', 'Spirit!')}</b> ${L(`Vesnice se rozjela. Elán se doplňuje sám a za něj otočíš přesýpací hodiny (hned 15 minut výnosu) nebo vyhlásíš žně (×5 na 20 s). Najdeš ho vlevo dole.`, `The village is in full swing. Spirit refills by itself: spend it on the hourglass (15 minutes of income at once) or a harvest rush (×5 for 20 s). Bottom left.`)}`, 'big');
  }
  function hire() {
    if (over()) return;
    UI.modal(`<div class="welcome"><div class="wico">🤵</div><h2>${L('Najmout šafáře?', 'Hire a steward?')}</h2>
      <p>${L(`Šafář bude za tebe nakupovat řemesla a vylepšení, která se nejrychleji zaplatí, i když nejsi u hry. Stojí <b>${STEWARD_COST} pověsti</b> jednou provždy: ty se utratí a s nimi jejich bonus +${Math.round(LEGEND_BONUS * 100)} % za každou. Výhody kroniky zůstávají.`, `The steward buys the trades and upgrades that pay for themselves fastest, even while you are away. He costs <b>${STEWARD_COST} legends</b> once and for good: they are spent along with their +${Math.round(LEGEND_BONUS * 100)}% each. Chronicle perks stay.`)}</p></div>`,
    [{ text: L(`Najmout · ${STEWARD_COST} 📜`, `Hire · ${STEWARD_COST} 📜`), cls: 'gold', fn: () => {
      if (!Econ.hireSteward(S)) { Sound.play.no(); return; }
      Sound.play.legend();
      UI.toast(`🤵 <b>${L('Šafář nastoupil!', 'The steward is here!')}</b> · ${L('Zapínáš ho v Řemeslech.', 'Switch him on in Trades.')}`, 'gold');
      afterChange(); UI.setTab('build'); save();
    } }, { text: L('Ještě ne', 'Not yet'), cls: 'ghost' }]);
  }
  function afterBuilt(i, ev, quiet) {
    const b = BUILDINGS[i];
    if (ev.first) {
      Sound.play.first();
      Scene.panTo(Scene.SLOT[b.id][0]);
      UI.toast(`<b>${b.name}</b> · ${b.desc}`, 'big');
    } else if (!quiet) Sound.play.buy(); else Sound.play.tap();
    if (ev.milestones.length) {
      Sound.play.milestone();
      UI.flash(`.row[data-b="${i}"]`);
      const k = ev.milestones.length, mb = Math.pow(Econ.milestoneBase(S), k), u = Econ.perBuy(S, i);
      UI.toast(`⭐ <b>${L('Mistrovství', 'Mastery')}${k > 1 ? ` ×${k}` : ''}: ${b.name} ${fmtN(ev.milestones[k - 1])}!</b> ${L(`Výnos ×${fmtN(mb)}, každý nákup teď přinese <b>${fmtN(u)}</b> ks`, `Output ×${fmtN(mb)}, every purchase now brings <b>${fmtN(u)}</b>`)}`, 'gold ms');
      if (!quiet || k > 1) { const cv = document.getElementById('cv'), r = cv.getBoundingClientRect(); Scene.burst(r.width / 2, r.height * 0.45, '#ffe27a', 22); }
    }
  }
  function upg(id) {
    if (over()) return;
    if (!Econ.buyUpg(S, id)) { Sound.play.no(); return; }
    Sound.play.upgrade();
    const u = U_INDEX[id];
    UI.toast(`🔨 <b>${u.name}</b> · ${u.effect}`);
    afterChange();
  }
  function buyAll() {
    if (over()) return;
    let n = 0;
    for (const u of Econ.upgAvailable(S)) if (Econ.buyUpg(S, u.id)) n++;
    if (!n) { Sound.play.no(); return; }
    Sound.play.upgrade();
    UI.toast(L(`🔨 Koupeno vylepšení: ${n}`, `🔨 Upgrades bought: ${n}`));
    afterChange();
  }
  function prestige() {
    if (over()) return;
    const p = Econ.pending(S);
    if (p < 1) return;
    UI.modal(`<div class="welcome"><div class="wico">📜</div><h2>${L('Předat vesnici?', 'Pass the village on?')}</h2>
      <p>${L(`Získáš <b>+${fmt(p)}</b> pověstí. Budovy, vylepšení, cech a groše začnou znovu od nuly, pověsti, úspěchy a kronika zůstanou.`, `You gain <b>+${fmt(p)}</b> legends. Buildings, upgrades, the guild and groschen start again from zero; legends, achievements and the chronicle stay.`)}</p></div>`,
    [{ text: L('Předat', 'Pass it on'), cls: 'gold', fn: () => {
      if (Econ.finale(S)) { finale(); return; }
      const before = Econ.perks(S).length, got = Econ.prestige(S);
      Scene.clearCreature(); Scene.panTo(0, false);
      Sound.play.legend();
      UI.toast(`📜 <b>${L(`Nové pokolení! +${fmt(got)} pověstí`, `A new generation! +${fmt(got)} legends`)}</b>`, 'gold');
      for (const pk of Econ.perks(S).slice(before)) UI.toast(`📖 <b>${pk.name}</b> · ${pk.desc}`, 'big');
      afterChange(); UI.setTab('build'); save();
    } }, { text: L('Ještě ne', 'Not yet'), cls: 'ghost' }]);
  }
  function claim(i) {
    if (over()) return;
    const r = Econ.claimDaily(S, i);
    if (!r) return;
    Sound.play.claim(); burstCoins();
    UI.toast(`${UI.coinSvg} +${fmt(r.coins)}`);
    if (r.blessing) { Sound.play.bell(); UI.toast(`🌟 <b>${L('Požehnání! Výnos ×2 na 15 minut', 'Blessing! Income ×2 for 15 minutes')}</b>`, 'gold'); }
    afterChange();
  }
  function setting(k, v) {
    S.settings[k] = v;
    // Odtlumit, když je hudba i zvuky vypnuté: zapnout obojí, jinak by tlačítko nic neudělalo.
    if (k === 'mute' && !v && !S.settings.sound && !S.settings.music) S.settings.sound = S.settings.music = true;
    if (k !== 'mute' && v === true && (k === 'sound' || k === 'music')) S.settings.mute = false;
    applySettings(); UI.soundIcon(); Hudba.unlock();
    if (UI.tab === 'more') UI.render(); else UI.refresh();
    save();
  }
  // Posuvník hlasitosti: zní hned, uloží se po puštění.
  function volume(k, v, final) {
    S.settings[k] = v; applySettings();
    if (final) save();
  }
  function reset() {
    UI.modal(`<div class="welcome"><div class="wico">⚠️</div><h2>${L('Smazat vesnici?', 'Delete the village?')}</h2><p>${L('Tohle nejde vrátit. Přijdeš o všechno včetně pověstí a úspěchů.', 'This cannot be undone. You lose everything including legends and achievements.')}</p></div>`,
      [{ text: L('Smazat', 'Delete'), cls: 'danger', fn: () => { S = Econ.fresh(); S.settings = Object.assign({}, S.settings); UI.state = S; applyOver(); Scene.clearCreature(); Scene.panTo(0, false); save(); UI.setTab('build'); intro(); } }, { text: L('Nechat', 'Keep it'), cls: 'ghost' }]);
  }
  // ── Výhra: poslední předání vesnice ──
  /** Okno výhry nejde zavřít: hráč si vybere pauzu, nebo začne od znova (to se ještě potvrzuje). */
  function finale() {
    const got = Econ.win(S);
    applyOver(); save();
    Sound.play.legend(); Sound.play.achievement();
    const cv = document.getElementById('cv'), r = cv.getBoundingClientRect();
    for (const [x, col] of [[0.25, '#ffe27a'], [0.5, '#fff6c8'], [0.75, '#ffb36a']]) Scene.burst(r.width * x, r.height * 0.4, col, 30);
    for (let i = 0; i < 30; i++) Scene.coin(r.width / 2 + (Math.random() - 0.5) * 200, r.height * 0.4);
    UI.render();
    showWin(got);
  }
  function winStats() {
    return `<div class="won-stats">
      <div><b>${S.gen}</b><small>${L('pokolení', 'generations')}</small></div>
      <div><b>${fmt(Econ.legendsTotal(S))}</b><small>${L('pověstí', 'legends')}</small></div>
      <div><b>${fmt(S.earnedAll)}</b><small>${L('grošů celkem', 'groschen in total')}</small></div>
      <div><b>${fmtDur(S.stats.playTime)}</b><small>${L('ve hře', 'played')}</small></div></div>`;
  }
  function showWin(got) {
    UI.modal(`<div class="welcome won"><div class="wico">🏆</div><h2>${L('Blahopřejeme, vyhrál jste!', 'Congratulations, you won!')}</h2>
      <p>${L(`Vesnička prošla ${S.gen} pokoleními a je hotová.`, `The village has seen ${S.gen} generations and it is complete.`)}${got ? L(` Poslední předání přineslo <b>+${fmt(got)}</b> pověstí.`, ` The last handover brought <b>+${fmt(got)}</b> legends.`) : ''}</p>
      ${winStats()}
      <p><b>${L('Můžete si dát pauzu, nebo začít od znova.', 'You can take a break or start over.')}</b></p>
      <p class="muted">${L('Při pauze se hra zastaví. Vesničku i statistiky si můžete dál prohlížet a všechno bude splněné, i to, co vám ještě chybělo. Hrát znovu půjde jen po smazání vesnice.', 'On a break the game stops. You can still look around the village and at your stats, and everything will be completed, even what you were still missing. You can only play again after deleting the village.')}</p></div>`,
    [{ text: L('⏸️ Dát si pauzu', '⏸️ Take a break'), cls: 'gold', fn: pauseGame }, { text: L('Začít od znova', 'Start over'), cls: 'ghost', fn: () => confirmRestart(() => showWin(got)) }]);
  }
  function confirmRestart(back) {
    UI.modal(`<div class="welcome"><div class="wico">🔄</div><h2>${L('Začít od znova?', 'Start over?')}</h2><p>${L('Smaže se celá vesnice včetně pověstí a úspěchů a začnete s prázdnou návsí. Tohle nejde vrátit.', 'The whole village is deleted, legends and achievements included, and you start on an empty green. This cannot be undone.')}</p></div>`,
      [{ text: L('Smazat a začít znovu', 'Delete and start over'), cls: 'danger', fn: restartWon }, { text: L('Zpět', 'Back'), cls: 'ghost', fn: back }]);
  }
  function pauseGame() {
    Econ.rest(S);
    applyOver(); save();
    Sound.play.bell();
    UI.render();
    UI.toast(`⏸️ <b>${L('Hra stojí.', 'The game is paused.')}</b> ${L('Vesnička je hotová a všechno splněné. Prohlížejte si ji v klidu.', 'The village is complete and everything is done. Enjoy looking around.')}`, 'big');
  }
  function restartWon() {
    const keep = Object.assign({}, S.settings), news = S.seen.news;
    S = Econ.fresh();
    Object.assign(S.settings, keep);
    S.seen.news = news;
    UI.state = S;
    applyOver(); applySettings();
    Scene.clearCreature(); Scene.panTo(0, false);
    document.getElementById('hint').hidden = false;
    save(); UI.setTab('build'); intro();
  }
  /** Odznak „Vyhráno“ na návsi: připomene výhru a nabídne nový začátek. */
  function wonInfo() {
    UI.modal(`<div class="welcome won"><div class="wico">🏆</div><h2>${L('Vyhráno!', 'You won!')}</h2>
      <p>${L(`Vesnička je hotová od ${new Date(S.won).toLocaleDateString(LOCALE)}. Hra stojí: nic se nevydělává ani nekupuje, prohlížet si ji můžete dál.`, `The village has been complete since ${new Date(S.won).toLocaleDateString(LOCALE)}. The game is paused: nothing is earned or bought, but you can keep looking around.`)}</p>
      ${winStats()}</div>`,
    [{ text: L('Zavřít', 'Close'), cls: 'gold' }, { text: L('Začít od znova', 'Start over'), cls: 'ghost', fn: () => confirmRestart(wonInfo) }]);
  }

  function afterChange() { checkAch(); UI.refresh(); }
  function checkAch() {
    for (const a of Econ.checkAch(S)) { Sound.play.achievement(); UI.toast(`🏅 <b>${a.name}</b> · ${a.desc} · +${Math.round(ACH_BONUS * 100)}${L(' %', '%')}`, 'gold'); }
  }

  // ── Bytosti ──
  function onCreature(id, sx, sy) {
    if (over()) return;
    const r = Econ.catchCreature(S, id);
    if (!r) return;
    wasCreature = null;
    if (id === 'cert') Sound.play.devil(); else Sound.play.catch();
    if (id === 'nesro') Sound.play.bell();
    let msg = `${UI.C_ICON[id]} <b>${r.name}</b> ${r.text}`;
    if (r.coins) { msg += `: +${fmt(r.coins)}`; Scene.floatText(sx, sy - 20, '+' + fmt(r.coins), '#bff4ff', true); for (let i = 0; i < 14; i++) Scene.coin(sx, sy); pulse(true); }
    else if (id === 'hvezda') Scene.floatText(sx, sy - 20, r.wish === 'elan' ? '+💫' : r.wish === 'sila' ? '✋×50' : '×7', '#fff3b0', true);
    const combo = Econ.buff(S, 'rate');
    if (S.buffs.filter(b => b.kind === 'rate').length >= 2) msg += ` · 🔥 <b>${L('KOMBO', 'COMBO')} ×${fmt(combo)}</b>`;
    if (r.buildings) msg += `: +${fmt(r.buildings)}`;
    UI.toast(msg, 'big');
    afterChange();
  }
  function creatureTick() {
    const cr = Scene.creature;
    if (cr && !cr.done && wasCreature === cr && performance.now() / 1000 > cr.expire) { S.stats.missed++; wasCreature = null; }
  }

  // ── Smyčka ──
  function frame(nowT) {
    let dt = (nowT - last) / 1000;
    last = nowT;
    const o = over();
    if (dt > 2 && !o) { catchUp(Date.now() - dt * 1000, Date.now(), false); dt = 0; }
    dt = Math.max(0, Math.min(0.25, dt));
    if (dt > 0 && !o) {
      const ev = Econ.tick(S, dt);
      if (ev && ev.cechOpened) cechOpened();
      if (ev && ev.creature && !Scene.creature) {
        const c = ev.creature === 'nesro' ? NESRO : C_INDEX[ev.creature];
        Scene.spawnCreature(ev.creature, c.life);
        wasCreature = Scene.creature; wasCreature.expire = nowT / 1000 + c.life;
        Sound.play.appear();
        if (ev.creature === 'nesro') UI.toast(L('🎒 Po návsi se prochází někdo s velkým batohem…', '🎒 Someone with a big backpack is strolling across the green…'), 'big');
        else if (!S.seen.creature || (ev.creature === 'hvezda' && !S.seen.star)) {
          S.seen.creature = 1; if (ev.creature === 'hvezda') S.seen.star = 1;
          const fem = ev.creature === 'bludicka' || ev.creature === 'hvezda';
          UI.toast(L(`${UI.C_ICON[ev.creature]} Ve vsi se ${ev.creature === 'hvezda' ? 'snesla' : `zjevil${fem ? 'a' : ''}`} <b>${c.name}</b>! Rychle na ${fem ? 'ni' : 'něj'} klepni.`, `${UI.C_ICON[ev.creature]} A <b>${c.name}</b> appeared! Quick, tap it.`), 'big');
        }
      }
    }
    stewardTick(dt);
    autoTick(dt);
    Scene.frame(dt, S);
    uiT += dt; achT += dt; saveT += dt;
    if (uiT > 0.2) { uiT = 0; UI.refresh(); if (!o) creatureTick(); }
    if (achT > 1) { achT = 0; if (!o) { checkAch(); elanCheck(); } Hudba.tick(); }
    if (saveT > 5) { saveT = 0; save(); }
    requestAnimationFrame(frame);
  }

  /** Novinky se ukážou samy jednou, dokud je hráč neviděl. */
  function newsOnce() { if ((S.seen.news || 0) < NEWS_VERSION) UI.toggleNews(true); }

  function intro() {
    UI.modal(`<div class="welcome"><div class="wico">🏡</div><h2>VESNIČKA</h2>
      <p>${L('Postav vesnici, která roste, i když zrovna nehraješ. Od políčka a kurníku po pivovar, zámek a pražský orloj.', 'Build a village that keeps growing while you are away. From a field and a hen house to a brewery, a castle and an astronomical clock.')}</p>
      <p>${L('<b>Klepej do vesnice</b> a vydělej první groše. Za 12 grošů postavíš políčko.', '<b>Tap the village</b> to earn your first groschen. A field costs 12.')}</p></div>`,
    [{ text: L('Do toho!', 'Let’s go!'), cls: 'gold', fn: () => { Sound.unlock(); Hudba.unlock(); } }]);
  }

  function start() {
    applySettings();
    Scene.init(document.getElementById('cv'));
    Scene.on.tap = onTap; Scene.on.creature = onCreature;
    UI.init(S, { buy, cbuy, upg, buyAll, prestige, claim, setting, volume, reset, quick: quickBuy, smart, hire, tps, power, tree, ab, unlocked, newsSeen: () => { if ((S.seen.news || 0) < NEWS_VERSION) { S.seen.news = NEWS_VERSION; save(); } } });
    Econ.daily(S);
    if (isNew) { S.seen.news = NEWS_VERSION; intro(); }
    else if (!over()) {
      catchUp(S.t, Date.now(), true);
      if (document.getElementById('modal').hidden) newsOnce();
    }
    if (S.seen.tap) document.getElementById('hint').hidden = true;
    document.getElementById('wonBadge').addEventListener('click', wonInfo);
    applyOver();
    // Vyhráno, ale ještě nevybráno: okno se ukáže znovu, dokud si hráč nevybere.
    if (over() && !S.paused) showWin(0);
    else if (!over()) checkAch();
    save();
    addEventListener('resize', () => Scene.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    addEventListener('pagehide', save);
    // Jiná karta nebo synchronizace z účtu změnila uložení: převzít novější vesnici.
    addEventListener('storage', e => {
      if (!(e.key === SAVE_KEY && e.newValue && document.hidden)) return;
      S = Econ.load(e.newValue); UI.state = S; applySettings(); applyOver(); UI.render();
      if (over() && !S.paused) showWin(0);
    });
    requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  return { get S() { return S; }, save, buy, cbuy, upg, onTap, onCreature, prestige, claim, quickBuy, smart, hire, power, tree, pauseGame };
})();
