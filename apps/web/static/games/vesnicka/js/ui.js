'use strict';
// ── VESNIČKA · rozhraní: horní lišta, panel se záložkami, oznámení, okna ─────────────
const UI = (() => {
  const $ = (s, el = document) => el.querySelector(s);
  /** Kulaté číslo bez zbytečných nul („10 mil.“ místo „10,0 mil.“). */
  const fmtNice = n => fmt(n).replace(new RegExp(`(\\${SEP}\\d*?)0+(?=\\D|$)`), '$1').replace(new RegExp(`\\${SEP}(?=\\D|$)`), '');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let S = null, H = null, tab = 'build', structKey = '', board = 'best:score';
  // Kolik nákupů naráz u každé položky (1×, 10×, Max): klíč 'b3' = řemeslo 3, 'c1' = stupeň cechu 1.
  const rowAmt = {};
  const amtOf = key => rowAmt[key] || 1;
  const U_ICON = { cr_rad: '📃', cr_zkouska: '🎓', cr_pokladnice: '💰', cr_korouhev: '🎏', cr_zemsky: '🗺️', kaplicka: '⛪', skola: '🏫', posta: '📯', silnice: '🛣️', zeleznice: '🚂', elektrina: '💡', rozhlas: '📢', pohadky: '📖', bylinkarka: '🌿', lucerna: '🏮', pranostiky: '🌦️', fletna: '🎶', kalendar: '📅', ponocny: '🌙', vecernice: '⭐' };
  const C_ICON = { bludicka: '✨', vodnik: '🐸', cert: '😈', krakonos: '⛰️', hospodaricek: '🧙', vseved: '🧓', hvezda: '🌠', nesro: '🎒' };
  const cName = id => (id === 'nesro' ? NESRO.name : (C_INDEX[id] || {}).name || '');
  const BUFF_ICON = { vodnik: '🫖', cert: '🔥', krakonos: '⛰️', blessing: '🌟', nesro: '🥧', vseved: '📖', zne: '🌾', zne_tap: '✋', hvezda_shon: '🌠', hvezda_sila: '💥' };
  const BUFF_NAME = { vodnik: L('Vodníkův hrníček', 'Goblin’s pot'), cert: L('Čertovská síla', 'Devilish strength'), krakonos: L('Krakonošova štědrost', 'Krakonoš’s gift'), blessing: L('Požehnání', 'Blessing'), nesro: L('Nesrovy koláče', 'Nesro’s kolache'), vseved: L('Vševědova moudrost: cech vyučí ×10', 'Know-all’s wisdom: the guild trains ×10'), zne: L('Žně: výnos ×5', 'Harvest rush: income ×5'), zne_tap: L('Žně: klepnutí ×5', 'Harvest rush: taps ×5'), hvezda_shon: L('Hvězdný shon: výnos ×7', 'Star rush: income ×7'), hvezda_sila: L('Hvězdná síla: klepnutí ×50', 'Star strength: taps ×50') };
  const clockAt = sec => new Date(Date.now() + sec * 1000).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  const coinSvg = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#f2c14e" stroke="#a8771e" stroke-width="1.6"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#c9952e" stroke-width="1.2"/><path d="M9.5 9.5h5M12 9.5v6" stroke="#a8771e" stroke-width="1.8" stroke-linecap="round"/></svg>';

  // ── Lišta a HUD ──
  function hud() {
    $('#coins').textContent = fmt(S.coins);
    const r = Econ.rate(S);
    $('#rate').textContent = L(`+${fmt(r, 1)} za s`, `+${fmt(r, 1)} /s`);
    const sn = seasonAt(Date.now());
    $('#season').innerHTML = `<span>${SEASONS[sn].icon}</span><span class="sn">${SEASONS[sn].name}</span><b>${fmtClock(seasonLeft(Date.now()))}</b>`;
    const cm = Econ.cMul(S);
    // Kombo: kouzla výnosu se násobí; od dvou naráz se ukáže, kolik dělají dohromady.
    const rb = S.buffs.filter(b => b.kind === 'rate'), combo = Econ.buff(S, 'rate');
    const comboHtml = rb.length >= 2 ? `<span class="buff b-combo" title="${esc(L('Kouzla výnosu se násobí', 'Income spells multiply'))}"><i>🔥</i>${L('KOMBO', 'COMBO')} ×${fmt(combo)}</span>` : '';
    const html = comboHtml + (Econ.cechOpen(S) && cm > 1.0005 ? `<span class="buff b-cech" title="${esc(L('Cech: učni zvedají výnos vesnice', 'Guild: apprentices lift the village’s income'))}"><i>👥</i>×${fmt(cm, 1)}</span>` : '') + (S.steward && S.settings.auto ? `<span class="buff b-steward" title="${esc(L('Šafář nakupuje za tebe', 'The steward buys for you'))}"><i>🤵</i>${L('Šafář', 'Steward')}</span>` : '') + S.buffs.map(b => `<span class="buff b-${b.id}${b.kind === 'tap' ? ' b-tap' : ''}" title="${esc(BUFF_NAME[b.id] || '')}"><i>${BUFF_ICON[b.id] || '✨'}</i>${b.kind === 'cost' ? '−50 %' : (b.kind === 'tap' && BUFF_ICON[b.id] !== '✋' ? '✋' : '') + '×' + fmt(b.mul)}<b>${fmtClock(b.t)}</b><s style="width:${Math.max(0, Math.min(100, (b.t / b.max) * 100))}%"></s></span>`).join('');
    const bx = $('#buffs'); if (bx._h !== html) { bx.innerHTML = html; bx._h = html; }
    powers();
    const side = Scene.creatureSide();
    const cr = Scene.creature;
    for (const [id, s] of [['#edgeL', -1], ['#edgeR', 1]]) {
      const el = $(id);
      el.hidden = side !== s;
      if (side === s && cr) el.innerHTML = s < 0 ? `‹ ${C_ICON[cr.id]} ${cName(cr.id)}` : `${C_ICON[cr.id]} ${cName(cr.id)} ›`;
    }
    quick();
    const nd = $('#newsBtn .dot'); if (nd) nd.hidden = (S.seen.news || 0) >= NEWS_VERSION;
    if (tabsKey !== visibleTabs().join(',')) tabs();
    // odznáčky na záložkách
    const upgN = Econ.upgAvailable(S).filter(u => Econ.upgCost(S, u) <= S.coins).length;
    badge('upg', upgN);
    const d = Econ.daily(S), claim = d.tasks.filter(t => !t.claimed && Econ.dailyProgress(S, t) >= t.n).length;
    badge('tasks', claim);
    badge('legend', Econ.pending(S) > 0 ? '+' + fmt(Econ.pending(S)) : 0);
  }
  // ── Elán a jeho kouzla (vlevo dole na návsi) ──
  function powers() {
    const box = $('#powers'), open = Econ.elanOpen(S);
    if (box.hidden === open) box.hidden = !open;
    $('#sceneBox').classList.toggle('has-powers', open);
    if (!open) return;
    const e = S.elan, rush = S.buffs.find(b => b.id === 'zne');
    const full = e >= ELAN_MAX - 1e-6, next = full ? 0 : (1 - (e % 1)) / Econ.elanRegen(S);
    const btn = id => {
      const p = POWERS[id], c = Econ.powerCost(S, id), on = id === 'rush' && rush;
      const can = !on && e >= c - 1e-9;
      return `<button class="pw pw-${id}${can ? ' ready' : ''}${on ? ' on' : ''}" data-power="${id}" ${can ? '' : 'disabled'} title="${esc(p.name + ': ' + p.desc)}"><i>${p.icon}</i><span><b>${p.short}</b><small>${on ? fmtClock(rush.t) : `${c} 💫`}</small></span>${on ? `<s style="width:${Math.max(0, Math.min(100, (rush.t / rush.max) * 100))}%"></s>` : ''}</button>`;
    };
    const html = `<div class="elan" title="${esc(L(`Elán: doplňuje se sám (+1 za ${Math.round(1 / Econ.elanRegen(S))} s), nejvýš ${ELAN_MAX}. Za groše se koupit nedá.`, `Spirit: refills by itself (+1 every ${Math.round(1 / Econ.elanRegen(S))} s) up to ${ELAN_MAX}. Groschen cannot buy it.`))}"><i style="width:${(e / ELAN_MAX) * 100}%"></i><span>💫 <b>${Math.floor(e)}</b>/${ELAN_MAX}</span><em>${full ? L('plný', 'full') : '+1 ' + fmtClock(next)}</em></div><div class="pws">${btn('warp')}${btn('rush')}</div>`;
    if (box._h !== html) { box.innerHTML = html; box._h = html; }
  }
  // Rychlý nákup: to, co se nejrychleji zaplatí (stejná volba jako u šafáře).
  let best = null;
  function quick() {
    const q = $('#quick');
    q.hidden = !S.settings.quick || !Econ.total(S) && S.coins < BUILDINGS[0].cost;
    if (q.hidden) return;
    best = Econ.bestBuy(S, H.tps());
    if (!best) { q.hidden = true; return; }
    const can = best.cost <= S.coins;
    q.disabled = !can;
    const html = `<i>⚡</i><span><small>${L('Nejlepší koupě', 'Best buy')}</small><b>${esc(best.name)}${best.sub && best.kind === 'u' ? ` · ${esc(best.sub)}` : ''}</b></span><em>${can ? coinSvg + fmt(best.cost) : '⏳ ' + fmtClock(best.wait)}</em>`;
    if (q._h !== html) { q.innerHTML = html; q._h = html; }
  }
  function badge(id, v) { const el = $(`.tabs [data-tab="${id}"] .bd`); if (el) { el.textContent = v || ''; el.hidden = !v; } }

  // ── Záložky ──
  const TABS = [
    ['build', '🏡', L('Řemesla', 'Trades')], ['cech', '👥', L('Cech', 'Guild')], ['upg', '🔨', L('Vylepšení', 'Upgrades')], ['legend', '📜', L('Kronika', 'Chronicle')],
    ['tasks', '✅', L('Úkoly', 'Tasks')], ['more', '☰', L('Více', 'More')],
  ];
  let tabsKey = '';
  /**
   * Rozhraní se rozbaluje postupně: na začátku jen Řemesla a Více, další záložky přibudou,
   * až mají smysl (vylepšení po prvních nákupech, úkoly později, kronika před první pověstí).
   */
  function tabOpen(id) {
    const vet = Econ.legendsTotal(S) > 0 || S.gen > 1;
    if (id === 'cech') return Econ.cechOpen(S);
    if (id === 'upg') return vet || S.stats.buys >= 3 || Object.keys(S.upg).length > 0;
    if (id === 'tasks') return vet || S.stats.buys >= 15 || S.stats.playTime > 900;
    if (id === 'legend') return vet || S.earnedAll >= LEGEND_BASE / 10 || Econ.pending(S) > 0;
    return true;
  }
  const visibleTabs = () => TABS.filter(([id]) => tabOpen(id)).map(([id]) => id);
  function tabs() {
    const vis = visibleTabs();
    tabsKey = vis.join(',');
    if (!vis.includes(tab)) tab = 'build';
    // nově odemčená záložka: oznámení (jen jednou; při prvním načtení se jen zapamatuje)
    const fresh = vis.filter(id => !S.seen['tab_' + id]);
    for (const id of fresh) S.seen['tab_' + id] = 1;
    if (inited && fresh.length) for (const id of fresh) { const t = TABS.find(x => x[0] === id); if (id !== 'cech' && H.unlocked) H.unlocked(t[1], t[2]); }
    $('#tabs').innerHTML = TABS.filter(([id]) => vis.includes(id)).map(([id, ic, name]) => `<button role="tab" data-tab="${id}" aria-selected="${tab === id}"${fresh.includes(id) && inited ? ' class="new"' : ''}><i>${ic}</i><span>${name}</span><b class="bd" hidden></b></button>`).join('');
  }
  let inited = false;
  function setTab(id) {
    tab = id;
    for (const b of document.querySelectorAll('#tabs [data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === id));
    structKey = '';
    render();
    $('#body').scrollTop = 0;
  }
  function render() {
    const body = $('#body');
    if (tab === 'build') renderBuild(body);
    else if (tab === 'cech') renderCech(body);
    else if (tab === 'upg') renderUpg(body);
    else if (tab === 'legend') renderLegend(body);
    else if (tab === 'tasks') renderTasks(body);
    else renderMore(body);
    refresh();
  }

  // ── Řemesla ──
  function visibleBuildings() {
    const last = BUILDINGS.reduce((a, b, i) => (S.owned[b.id] ? i : a), -1);
    return BUILDINGS.slice(0, Math.min(BUILDINGS.length, last + 2));
  }
  /** Volba 1× · 10× · Max u položky (ukáže se po prvních nákupech, ať je začátek jednoduchý). */
  const amtOpen = () => S.stats.buys >= 5 || Econ.legendsTotal(S) > 0;
  const amtHtml = key => (amtOpen() ? `<div class="amt" role="group" aria-label="${L('Kolik nákupů naráz', 'How many purchases at once')}">${[1, 10, 'max'].map(a => `<button data-ra="${a}" data-rk="${key}" aria-pressed="${amtOf(key) === a}">${a === 'max' ? 'Max' : a + '×'}</button>`).join('')}</div>` : '');
  const buildKey = () => `b${visibleBuildings().length}:${seasonAt(Date.now())}:${amtOpen()}:${BUILDINGS.map(b => (S.owned[b.id] ? 1 : 0)).join('')}`;
  function renderBuild(body) {
    const vis = visibleBuildings(), sn = seasonAt(Date.now());
    structKey = buildKey();
    const stew = S.steward
      ? `<div class="steward"><span class="st-n">🤵 <b>${L('Šafář', 'Steward')}</b></span><label class="sw"><input type="checkbox" id="autoBuy" ${S.settings.auto ? 'checked' : ''}><i></i>${L('Nakupuje sám', 'Buys on his own')}</label><button class="btn small" id="smartBuy">${L('Nakoupit chytře', 'Buy smart')}</button></div>`
      : Econ.legendsTotal(S) > 0 ? `<p class="hint-card">🤵 ${L(`Šafáře, který nakupuje za tebe, najmeš v Kronice za ${STEWARD_COST} pověsti.`, `Hire a steward who buys for you in the Chronicle for ${STEWARD_COST} legends.`)}</p>` : '';
    const nOwned = BUILDINGS.filter(b => S.owned[b.id]).length;
    const twinHint = S.stats.buys >= 4 && S.stats.milestones < 3 ? `<p class="hint-card">⭐ ${L(`<b>Mistrovství:</b> s ${MILESTONES[0]}, ${MILESTONES[1]}, ${MILESTONES[2]}… kusy se výnos řemesla zdvojnásobí <b>a každý další nákup přinese dvakrát víc kusů</b> (1, 2, 4, 8…).`, `<b>Mastery:</b> at ${MILESTONES[0]}, ${MILESTONES[1]}, ${MILESTONES[2]}… of a trade its output doubles <b>and every further purchase brings twice as many</b> (1, 2, 4, 8…).`)}</p>` : '';
    const synHint = nOwned >= 2 && nOwned <= 3 ? `<p class="hint-card">🤝 ${L(`<b>Sousedská výpomoc:</b> každé řemeslo zvedne výnos všech řemesel pod sebou (×${trunc(1 + SYN_FIRST, 2)}, s každým jeho mistrovstvím víc). Nové řemeslo zrychlí celou ves.`, `<b>Neighbourly help:</b> every trade lifts the output of all trades below it (×${trunc(1 + SYN_FIRST, 2)}, more with each of its masteries). A new trade speeds up the whole village.`)}</p>` : '';
    body.innerHTML = `${stew}${twinHint}${synHint}
      <div class="rows">${vis.map(b => { const i = B_INDEX[b.id], locked = !S.owned[b.id];
        return `<div class="row${locked ? ' locked' : ''}" data-b="${i}">
          <canvas class="ico" data-lv="-1" aria-hidden="true"></canvas>
          <div class="info"><div class="nm"><b>${b.name}</b><span class="cnt"></span>${b.season === sn ? `<span class="tag">${SEASONS[sn].icon} ${L('sezóna', 'in season')}</span>` : ''}<span class="mx"></span></div>
          <div class="sub">${locked ? `<span class="desc">${b.desc}</span>` : `<span class="prod"></span>`}</div>
          ${locked ? '' : '<div class="syn"></div><div class="ms"><i></i><span></span></div>'}</div>
          <div class="btns">${locked ? '' : amtHtml('b' + i)}<button class="buy" data-buy="${i}"><small></small><b></b></button>${locked ? '' : `<button class="to" data-to="${i}" hidden></button>`}</div></div>`; }).join('')}</div>
      ${vis.length < BUILDINGS.length ? `<p class="more-hint">${L(`Další řemesla: ${BUILDINGS.length - vis.length}`, `More trades to discover: ${BUILDINGS.length - vis.length}`)}</p>` : ''}`;
  }
  /** Kolik nákupů znamená volba u položky (Max: kolik se vejde, aspoň 1). */
  const qOf = (key, max) => { const a = amtOf(key); return a === 'max' ? Math.max(1, max) : a; };
  function refreshBuild() {
    const sn = seasonAt(Date.now()), r = Econ.rate(S) || 1, mb = Econ.milestoneBase(S);
    for (const row of document.querySelectorAll('#body .row[data-b]')) {
      const i = +row.dataset.b, b = BUILDINGS[i], n = S.owned[b.id];
      const cv = row.querySelector('canvas.ico'), lv = Scene.LV(n);
      if (+cv.dataset.lv !== lv) { cv.dataset.lv = lv; Scene.icon(cv, b.id, lv, 52); }
      set(row.querySelector('.cnt'), n ? fmtN(n) : '');
      const u = Econ.perBuy(S, i);
      const pr = row.querySelector('.prod');
      if (pr) { const br = Econ.bRate(S, i, sn), sh = (br / r) * 100, pc = sh > 0 && sh < 1 ? '<1' : Math.round(sh); set(pr, L(`+${fmt(br, 1)} za s · ${pc} %`, `+${fmt(br, 1)} /s · ${pc}%`) + (u > 1 ? L(` · nákup +${fmtN(u)} ks`, ` · +${fmtN(u)} per buy`) : '')); }
      const sy = row.querySelector('.syn');
      if (sy) {
        const h = Econ.help(S, i), up = Econ.syn(S, i), parts = [];
        if (i > 0 && n) parts.push(`🤝 ${L('nižším', 'to lower')} ×${fmt(h, 2)}`);
        if (up > 1.0005) parts.push(`⬆️ ${L('od vyšších', 'from higher')} ×${fmt(up, up < 10 ? 2 : 1)}`);
        set(sy, parts.join(' · '));
      }
      const ms = row.querySelector('.ms');
      if (ms) {
        const nx = Econ.nextMilestone(n), k = Econ.milestonesOf(n), prev = k ? MILESTONES[k - 1] : 0;
        ms.querySelector('i').style.width = nx ? `${Math.max(0, Math.min(100, ((n - prev) / (nx - prev)) * 100))}%` : '100%';
        set(ms.querySelector('span'), nx ? `${fmtN(n)}/${fmtN(nx)} → ${L(`×${mb} výnos i ×2 kusů`, `×${mb} output, ×2 units`)}` : L('Mistr všech mistrů', 'Master of masters'));
        ms.title = nx ? L(`Do mistrovství: výnos ×${mb} a každý další nákup přinese dvakrát víc kusů`, `To mastery: output ×${mb} and every further purchase brings twice as many`) : '';
      }
      const btn = row.querySelector('.buy'), mx = Econ.maxAfford(S, i);
      const q = locked(row) ? 1 : qOf('b' + i, mx), units = unitsFor(n, q);
      const cost = Econ.costOf(S, i, q), can = cost <= S.coins;
      btn.disabled = !can;
      set(btn.querySelector('small'), L(`Postavit +${fmtN(units)}`, `Build +${fmtN(units)}`));
      setH(btn.querySelector('b'), coinSvg + fmt(cost));
      btn.title = L(`${q}× nákup → +${fmtN(units)} ks`, `${q} purchase${q > 1 ? 's' : ''} → +${fmtN(units)}`);
      btn.classList.toggle('sale', Econ.buff(S, 'cost') < 1);
      set(row.querySelector('.mx'), mx ? `max ${mx}×` : '');
      // kolik nákupů chybí do dalšího mistrovství nebo vylepšení
      const to = row.querySelector('.to');
      if (to) {
        const tg = target(i);
        to.hidden = !tg;
        if (tg) {
          const need = buysFor(n, tg.at), c = Econ.costOf(S, i, need);
          to.dataset.n = need;
          to.disabled = c > S.coins;
          setH(to, `${tg.icon} ${need}× → ${fmtN(tg.at)} · ${coinSvg}${fmt(c)}`);
          to.title = tg.title;
        }
      }
    }
  }
  const locked = row => row.classList.contains('locked');
  const set = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
  const setH = (el, h) => { if (el && el._h !== h) { el.innerHTML = h; el._h = h; } };
  /** Nejbližší cíl řemesla: další mistrovství nebo stupeň vylepšení, který ještě nemáš. */
  function target(i) {
    const b = BUILDINGS[i], n = S.owned[b.id];
    const ms = Econ.nextMilestone(n), tier = TIER_REQ.findIndex((r, t) => r > n && !S.upg[b.id + (t + 1)]);
    const tr = tier >= 0 ? TIER_REQ[tier] : null;
    if (ms == null && tr == null) return null;
    if (tr != null && (ms == null || tr < ms)) return { at: tr, icon: '🔨', title: L(`Do vylepšení ${TIER_NAMES[tier]}`, `To the upgrade ${TIER_NAMES[tier]}`) };
    return { at: ms, icon: '⭐', title: L(`Do mistrovství: výnos ×${Econ.milestoneBase(S)} a každý nákup ×2 kusů`, `To mastery: output ×${Econ.milestoneBase(S)} and twice the units per purchase`) };
  }

  // ── Cech ──
  /** Stupně, které jsou vidět: všechny, co máš, a první, který ještě nemáš. */
  function visibleCech() { const out = []; for (let i = 0; i < CECH.length; i++) { out.push(i); if (!(S.cech.a[i] >= 1)) break; } return out; }
  const cechKey = () => `c${visibleCech().map(i => `${i}${Econ.cechTierOpen(S, i) ? 'o' : ''}${S.cech.a[i] >= 1 ? 'h' : ''}`).join(',')}:${seasonAt(Date.now()) === 3}:${amtOpen()}`;
  function cechLock(i) {
    const t = CECH[i];
    if (Econ.legendsTotal(S) < t.leg) return `🔒 ${L(`Odemkne se s ${fmtNice(t.leg)} pověstmi (máš ${fmt(Econ.legendsTotal(S))}).`, `Unlocks with ${fmtNice(t.leg)} legends (you have ${fmt(Econ.legendsTotal(S))}).`)}`;
    return `🔒 ${L(`Nejdřív potřebuješ: ${CECH[i - 1].name}`, `First you need: ${CECH[i - 1].name}`)}`;
  }
  function renderCech(body) {
    const vis = visibleCech(), winter = seasonAt(Date.now()) === 3;
    structKey = cechKey();
    body.innerHTML = `<div class="cech-head"><span class="ch-i">👥</span><div class="ch-t"><small id="cSub"></small><b id="cMul"></b><span id="cNext"></span></div></div>
      <p class="hint-card cech-hint">${L('<b>Generátor generuje generátor:</b> každý stupeň cechu vyučí ten pod sebou, tovaryši učně, mistři tovaryše… Učni pracují v řemeslech a každý desetinásobek učňů (10, 100, 1 000…) zvedne výnos vesnice.', '<b>Generators make generators:</b> every guild rank trains the one below, journeymen train apprentices, masters train journeymen… Apprentices work in your trades and every tenfold of them (10, 100, 1,000…) lifts the village’s income.')} ${winter ? `❄️ <b>${L(`Je zima: cech vyučí ×${Econ.cSeason(S, 3)}.`, `It is winter: the guild trains ×${Econ.cSeason(S, 3)}.`)}</b>` : `❄️ ${L(`V zimě cech vyučí ×${Econ.cSeason(S, 3)}.`, `In winter the guild trains ×${Econ.cSeason(S, 3)}.`)}`}</p>
      <div class="rows">${vis.map(i => { const t = CECH[i], open = Econ.cechTierOpen(S, i), has = S.cech.a[i] >= 1;
        return `<div class="row crow${has ? '' : ' locked'}" data-c="${i}">
          <span class="cico" aria-hidden="true">${t.icon}</span>
          <div class="info"><div class="nm"><b>${t.name}</b><span class="cnt"></span><span class="mx"></span></div>
          <div class="sub">${has ? '<span class="prod"></span>' : `<span class="desc">${open ? t.desc : cechLock(i)}</span>`}</div>
          ${has ? '<div class="ms"><i></i><span></span></div>' : ''}</div>
          <div class="btns">${open ? `${amtHtml('c' + i)}<button class="buy" data-cbuy="${i}"><small></small><b></b></button>` : ''}</div></div>`; }).join('')}</div>
      ${vis.length < CECH.length ? `<p class="more-hint">${L(`Další stupně cechu: ${CECH.length - vis.length}`, `More guild ranks to discover: ${CECH.length - vis.length}`)}</p>` : ''}`;
  }
  function refreshCech() {
    if (cechKey() !== structKey) renderCech($('#body'));
    const sn = seasonAt(Date.now()), m = Econ.cMul(S), a0 = S.cech.a[0];
    const mEl = $('#cMul'); if (mEl) mEl.textContent = L(`výnos ×${fmt(m, 2)}`, `income ×${fmt(m, 2)}`);
    const sub = $('#cSub'), pct = trunc(Econ.cechPct(S) * 100, 1).replace(new RegExp(`\\${SEP}0$`), '');
    if (sub) sub.textContent = L(`Učni zvedají výnos celé vesnice: každý desetinásobek +${pct}\u00a0%`, `Apprentices lift the whole village’s income: every tenfold +${pct}%`);
    const nx = $('#cNext');
    if (nx) {
      const ten = Econ.cMulOf(S, Math.max(10, a0 * 10)), hr = Econ.cechAhead(S, 3600, sn);
      nx.textContent = L(`Při 10× víc učních ×${fmt(ten, 2)}`, `At 10× the apprentices ×${fmt(ten, 2)}`) + (S.cech.a[1] >= 1 ? L(` · za hodinu ×${fmt(hr.mul, 2)}`, ` · in an hour ×${fmt(hr.mul, 2)}`) : '');
    }
    for (const row of document.querySelectorAll('#body .crow')) {
      const i = +row.dataset.c, t = CECH[i], a = S.cech.a[i], b = S.cech.b[i];
      row.querySelector('.cnt').textContent = a >= 1 ? fmt(a) : '';
      const pr = row.querySelector('.prod');
      if (pr) {
        const grow = i + 1 < CECH.length && S.cech.a[i + 1] >= 1 ? S.cech.a[i + 1] * Econ.cRate(S, i + 1, sn) : 0;
        const what = i ? L(`${t.verb}: +${fmt(a * Econ.cRate(S, i, sn), 1)} za s`, `${t.verb}: +${fmt(a * Econ.cRate(S, i, sn), 1)} /s`) : L('pracují v řemeslech', 'work in the trades');
        pr.textContent = `${what} · ${L(`koupeno ${fmt(b)}`, `bought ${fmt(b)}`)}${grow ? L(` · přibývá +${fmt(grow, 1)} za s`, ` · growing +${fmt(grow, 1)} /s`) : ''}`;
      }
      const ms = row.querySelector('.ms');
      if (ms) {
        const nxs = Econ.nextSeal(b), prev = [0, ...CECH_SEALS].filter(v => v <= b).pop();
        ms.querySelector('i').style.width = nxs ? `${((b - prev) / (nxs - prev)) * 100}%` : '100%';
        ms.querySelector('span').textContent = nxs ? `🔏 ${b}/${nxs} → ${i ? L('pečeť: vyučí ×2', 'seal: trains ×2') : L('pečeť: učni +5 %', 'seal: apprentices +5%')}` : L('Všechny cechovní pečeti', 'All guild seals');
      }
      const btn = row.querySelector('.buy');
      if (btn) {
        const mx = Econ.cechMax(S, i), k = qOf('c' + i, mx), cost = Econ.cechCost(S, i, k);
        btn.disabled = cost > S.coins;
        set(btn.querySelector('small'), `${t.act} +${fmtN(k)}`);
        setH(btn.querySelector('b'), coinSvg + fmt(cost));
        btn.classList.toggle('sale', Econ.buff(S, 'cost') < 1);
        set(row.querySelector('.mx'), mx ? `max +${fmtN(mx)}` : '');
      }
    }
  }

  // ── Vylepšení ──
  function uIcon(u) { return u.kind === 'b' ? `<canvas class="uico" data-ub="${BUILDINGS[u.b].id}"></canvas>` : `<span class="uemo">${u.kind === 'tap' ? '✋' : u.kind === 'c' ? CECH[u.c].icon : U_ICON[u.id] || '✨'}</span>`; }
  /** Účinek vylepšení; u cechovního řádu i o kolik se zvedne násobek od učňů. */
  function uEffect(u) {
    if (u.kind !== 'cb' || S.upg[u.id]) return u.effect;
    const now = Econ.cMul(S); S.upg[u.id] = 1; const after = Econ.cMul(S); delete S.upg[u.id];
    return `${u.effect}: ×${fmt(now, 2)} → ×${fmt(after, 2)}`;
  }
  function reqText(u) {
    const r = u.req || {};
    if (r.b != null) return L(`Potřebuješ ${r.n}× ${BUILDINGS[r.b].name}`, `Needs ${r.n}× ${BUILDINGS[r.b].name}`);
    if (r.cb != null) return L(`Kup do cechu ${r.n}× ${CECH[r.cb].name}`, `Buy ${r.n}× ${CECH[r.cb].name} for the guild`);
    if (r.ucni != null) return L(`Měj ${fmt(r.ucni)} učňů`, `Have ${fmt(r.ucni)} apprentices`);
    if (r.taps != null) return L(`Klepni do vesnice ${r.taps}×`, `Tap the village ${r.taps} times`);
    if (r.total != null) return L(`Měj ${r.total} budov`, `Own ${r.total} buildings`);
    if (r.caught != null) return L(`Chyť ${r.caught} ${r.caught < 5 ? 'bytosti' : 'bytostí'}`, `Catch ${r.caught} creatures`);
    return '';
  }
  function renderUpg(body) {
    const av = Econ.upgAvailable(S), owned = UPGRADES.filter(u => S.upg[u.id]);
    const soon = UPGRADES.filter(u => !S.upg[u.id] && !Econ.reqMet(S, u)).sort((a, b) => a.cost - b.cost).slice(0, 3);
    structKey = 'u' + av.map(u => u.id).join(',');
    body.innerHTML = `${av.length ? `<button class="btn wide" id="buyAll"></button>` : ''}
      <div class="cards">${av.map(u => `<div class="card" data-u="${u.id}">${uIcon(u)}<div class="info"><b>${u.name}</b><small>${u.sub}</small><span class="eff">${uEffect(u)}</span></div><button class="buy" data-ubuy="${u.id}"><b></b></button></div>`).join('') || `<p class="empty">${L('Teď tu nic není. Stav dál a vylepšení přibudou.', 'Nothing here right now. Keep building and upgrades will appear.')}</p>`}</div>
      ${soon.length ? `<h3>${L('Brzy', 'Coming up')}</h3><div class="cards soon">${soon.map(u => `<div class="card dim">${uIcon(u)}<div class="info"><b>${u.name}</b><small>${u.sub}</small><span class="eff">${reqText(u)}</span></div></div>`).join('')}</div>` : ''}
      ${owned.length ? `<details class="owned"><summary>${L(`Koupená vylepšení (${owned.length})`, `Bought upgrades (${owned.length})`)}</summary><div class="chips">${owned.map(u => `<span class="chip" title="${esc(u.effect)}">${u.kind === 'b' ? '' : (u.kind === 'tap' ? '✋' : u.kind === 'c' ? CECH[u.c].icon : U_ICON[u.id] || '✨') + ' '}${u.name}${u.kind === 'b' || u.kind === 'c' ? ` · ${u.sub}` : ''}</span>`).join('')}</div></details>` : ''}`;
    for (const cv of body.querySelectorAll('canvas.uico')) Scene.icon(cv, cv.dataset.ub, Math.max(1, Scene.LV(S.owned[cv.dataset.ub])), 40);
  }
  function refreshUpg() {
    const av = Econ.upgAvailable(S);
    if ('u' + av.map(u => u.id).join(',') !== structKey) { renderUpg($('#body')); }
    let n = 0, sum = 0;
    for (const card of document.querySelectorAll('#body .card[data-u]')) {
      const u = U_INDEX[card.dataset.u], c = Econ.upgCost(S, u), can = c <= S.coins;
      const btn = card.querySelector('.buy'); btn.disabled = !can; btn.querySelector('b').innerHTML = coinSvg + fmt(c);
      card.classList.toggle('can', can);
    }
    for (const u of av) { const c = Econ.upgCost(S, u); if (sum + c <= S.coins) { sum += c; n++; } }
    const all = $('#buyAll');
    if (all) { all.disabled = !n; all.innerHTML = n ? L(`Koupit vše, co se dá (${n}) · ${coinSvg}${fmt(sum)}`, `Buy all I can (${n}) · ${coinSvg}${fmt(sum)}`) : L('Na další vylepšení zatím nemáš', 'You can’t afford the next upgrade yet'); }
  }

  // ── Kronika (pověsti) ──
  let lb = null, lbAt = 0, treeKey = '';
  function renderLegend(body) {
    treeKey = Object.keys(S.tree).join();
    const p = Econ.pending(S), next = Econ.nextLegendAt(S), base = LEGEND_BASE * Math.pow(Math.max(Econ.legendsFor(S.earnedAll), Econ.legendsTotal(S)), 3), tot = Econ.legendsTotal(S);
    structKey = 'l';
    const pct = Math.max(0, Math.min(100, ((S.earnedAll - base) / Math.max(1, next - base)) * 100));
    body.innerHTML = `<div class="legend-card">
        <div class="big"><span>📜</span><b id="legN">${fmt(S.legends)}</b><small>${L('pověstí', 'legends')}</small></div>
        <p>${L(`Každá pověst přidá <b>+${Math.round(LEGEND_BONUS * 100)} %</b> ke všem výnosům: teď <b>+${fmt(S.legends * LEGEND_BONUS * 100)} %</b>.`, `Every legend adds <b>+${Math.round(LEGEND_BONUS * 100)}%</b> to all income: now <b>+${fmt(S.legends * LEGEND_BONUS * 100)}%</b>.`)}</p>
        <p class="muted">${L(`Pokolení: ${S.gen} · vyděláno celkem ${fmt(S.earnedAll)} grošů`, `Generation ${S.gen} · earned ${fmt(S.earnedAll)} groschen in total`)}${S.spent ? L(` · za šafáře utraceno ${S.spent} (kronika počítá všech ${tot})`, ` · ${S.spent} spent on the steward (the chronicle counts all ${tot})`) : ''}</p>
      </div>
      <div class="steward-card${S.steward ? ' on' : ''}">
        <span class="sc-i">🤵</span>
        <div><b>${L('Šafář', 'Steward')}</b><small>${S.steward ? L('Slouží ti napořád: nakupuje nejvýhodněji, i když nejsi u hry. Zapneš ho v Řemeslech.', 'At your service for good: he buys the best deals, even while you are away. Switch him on in Trades.') : L(`Nakupuje za tebe nejvýhodnější řemesla a vylepšení, i když nejsi u hry. Najmeš ho jednou provždy za ${STEWARD_COST} pověsti: ty se utratí (bonus +${Math.round(LEGEND_BONUS * 100)} % za každou zmizí), výhody kroniky zůstávají.`, `He buys the best trades and upgrades for you, even while you are away. Hire him for good for ${STEWARD_COST} legends: they are spent (their +${Math.round(LEGEND_BONUS * 100)}% each goes), chronicle perks stay.`)}</small></div>
        ${S.steward ? '<i>✔</i>' : `<button class="btn gold" id="hire" ${S.legends >= STEWARD_COST ? '' : 'disabled'}>${L(`Najmout · ${STEWARD_COST} 📜`, `Hire · ${STEWARD_COST} 📜`)}</button>`}
      </div>
      <div class="prestige">
        <h3>${L('Předat vesnici dalšímu pokolení', 'Pass the village to the next generation')}</h3>
        <p>${L('O vsi se budou vyprávět pověsti. Začneš znovu od políčka, ale s pověstmi poroste všechno rychleji. Úspěchy a statistiky zůstávají.', 'Legends will be told of your village. You start again from a single field, but with legends everything grows faster. Achievements and stats stay.')}</p>
        <div class="gain">${p > 0 ? L(`Získáš <b>+${fmt(p)}</b> ${p === 1 ? 'pověst' : p < 5 ? 'pověsti' : 'pověstí'} (výnos ×${trunc(((1 + (S.legends + p) * LEGEND_BONUS) / (1 + S.legends * LEGEND_BONUS)), 2)})`, `You gain <b>+${fmt(p)}</b> legend${p === 1 ? '' : 's'} (income ×${trunc(((1 + (S.legends + p) * LEGEND_BONUS) / (1 + S.legends * LEGEND_BONUS)), 2)})`) : L('Zatím by ses pověsti nedočkal.', 'Not enough for a legend yet.')}</div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <small class="muted">${L(`Další pověst při ${fmt(next)} grošů vydělaných celkem`, `Next legend at ${fmt(next)} groschen earned in total`)}</small>
        <button class="btn gold wide" id="prestige" ${p > 0 ? '' : 'disabled'}>${L('Předat vesnici', 'Pass it on')}</button>
      </div>
      ${treeHtml()}
      <h3>${L('Kronika rodu', 'Family chronicle')}</h3>
      <div class="perks">${PERKS.map(pk => `<div class="perk${tot >= pk.n ? ' on' : ''}"><span class="pn">${fmtNice(pk.n)}</span><div><b>${pk.name}</b><small>${pk.desc}</small></div><i>${tot >= pk.n ? '✔' : '🔒'}</i></div>`).join('')}</div>
      <h3>${L('Žebříčky', 'Leaderboards')}</h3>
      <p class="muted">${L('Klepni na hráče a porovnej se s ním.', 'Tap a player to compare yourself with them.')}</p>
      <div class="chips boards" role="tablist">${BOARDS.map(d => `<button class="chip" data-board="${d.key}" aria-selected="${d.key === board}">${d.icon} ${d.name}</button>`).join('')}</div>
      <div id="lb" class="lb"><p class="muted">${L('Načítám…', 'Loading…')}</p></div>`;
    loadLb();
  }
  // ── Rodokmen: trvalé větve za pověsti ──
  const COLS = [L('Úroda', 'Harvest'), L('Elán a kouzla', 'Spirit and magic'), L('Pomocníci', 'Helpers')];
  function treeNode(t) {
    const own = !!S.tree[t.id], open = Econ.treeOpen(S, t), can = !own && open && S.legends >= t.cost;
    return `<div class="tnode${own ? ' own' : open ? '' : ' lock'}${can ? ' can' : ''}"><span class="ti">${t.icon}</span><div><b>${t.name}</b><small>${t.desc}</small></div>${own ? '<i>✔</i>' : `<button class="btn small gold" data-tree="${t.id}" ${can ? '' : 'disabled'}>${fmtNice(t.cost)} 📜</button>`}</div>`;
  }
  function treeHtml() {
    const root = TREE[0], helpers = Econ.autoList(S);
    return `<h3>${L('Rodokmen', 'Family tree')}</h3>
      <p class="muted">${L(`Trvalé větve za pověsti: zůstanou všem dalším pokolením. Pověsti se utratí (jejich +${Math.round(LEGEND_BONUS * 100)} % zmizí), kronika je dál počítá.`, `Lasting branches bought with legends: they stay for every generation. The legends are spent (their +${Math.round(LEGEND_BONUS * 100)}% goes), the chronicle still counts them.`)}</p>
      <div class="tree"><div class="troot">${treeNode(root)}</div>
        <div class="tcols">${COLS.map((name, c) => `<div class="tcol"><h4>${name}</h4>${TREE.filter(t => t !== root && t.col === c).map(treeNode).join('')}</div>`).join('')}</div></div>
      ${helpers.length ? `<div class="abox"><b>${L('Pomocníci kupují sami', 'Helpers buy on their own')}</b><small>${L(`Koupí řemeslo, když další nákup stojí nejvýš ${Math.round(AUTO_SHARE * 100)} % měšce. Na dražší věci se dál šetří.`, `They buy a trade when the next purchase costs at most ${Math.round(AUTO_SHARE * 100)}% of your purse. You keep saving for pricier things.`)}</small>
        <div class="abs">${helpers.map(i => `<label class="sw"><input type="checkbox" data-ab="${BUILDINGS[i].id}" ${Econ.autoOn(S, i) ? 'checked' : ''}><i></i>${BUILDINGS[i].name}</label>`).join('')}</div></div>` : ''}`;
  }
  /** Moje hodnota na desce (stejně zakódovaná jako v žebříčku). */
  function myBoard(key) { return key === 'total:played' ? Math.floor(S.stats.playTime) : Econ.boards(S)[key] || 0; }
  const lbCache = {};
  async function loadLb() {
    const key = board, d = BOARDS.find(x => x.key === key);
    if (!$('#lb') || !d) return;
    let data = lbCache[key];
    if (!data || Date.now() - data.at > 60000) {
      try {
        const r = await fetch(`/api/scores?game=vesnicka&board=${encodeURIComponent(key)}&limit=10`, { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        data = lbCache[key] = Object.assign(await r.json(), { at: Date.now() });
      } catch (e) { if ($('#lb') && board === key) $('#lb').innerHTML = `<p class="muted">${L('Žebříček teď není dostupný.', 'The leaderboard is not available right now.')}</p>`; return; }
    }
    const box = $('#lb'); if (!box || board !== key) return;
    const row = e => `<tr class="${e.me ? 'me' : ''}" data-nick="${esc(e.nickname)}" tabindex="0"><td>${e.rank}.</td><td>${esc(e.nickname)}</td><td>${boardValue(d, e.value)}</td></tr>`;
    const me = data.me && !data.entries.some(e => e.me) ? `<tr class="me sep"><td>${data.me.rank}.</td><td>${L('Ty', 'You')}</td><td>${boardValue(d, data.me.value)}</td></tr>` : '';
    box.innerHTML = data.entries.length ? `<table>${data.entries.map(row).join('')}${me}</table>` : `<p class="muted">${L('Zatím tu nikdo není. Buď první!', 'Nobody here yet. Be the first!')}</p>`;
    const mine = myBoard(key);
    box.innerHTML += `<p class="muted mine">${L('Tvoje hodnota', 'Yours')}: <b>${mine ? boardValue(d, mine) : '–'}</b>${data.total ? L(` · hráčů v žebříčku: ${data.total}`, ` · players on the board: ${data.total}`) : ''}</p>`;
    if (!data.signedIn) box.innerHTML += `<p class="muted">${L('Přihlas se v herním centru a nastav si přezdívku: tvoje vesnice se objeví v žebříčcích.', 'Sign in at the game center and pick a nickname: your village will appear on the boards.')}</p>`;
  }
  /** Porovnání s jiným hráčem: všechny jeho žebříčky vedle mých. */
  async function compare(nick) {
    let data = null;
    try { const r = await fetch(`/api/scores?game=vesnicka&player=${encodeURIComponent(nick)}`, { cache: 'no-store' }); if (r.ok) data = await r.json(); } catch (e) { data = null; }
    if (!data) { toast(L('Statistiky hráče teď nejdou načíst.', 'The player’s stats cannot be loaded right now.')); return; }
    const rows = BOARDS.map(d => {
      const a = myBoard(d.key), b = data.scores[d.key] || 0, win = a > b ? 'me' : b > a ? 'them' : '';
      return `<tr><td>${d.icon} ${d.name}</td><td class="${win === 'me' ? 'win' : ''}">${a ? boardValue(d, a) : '–'}</td><td class="${win === 'them' ? 'win' : ''}">${b ? boardValue(d, b) : '–'}</td></tr>`;
    }).join('');
    const wins = BOARDS.filter(d => myBoard(d.key) > (data.scores[d.key] || 0)).length, losses = BOARDS.filter(d => (data.scores[d.key] || 0) > myBoard(d.key)).length;
    modal(`<div class="compare"><div class="wico">⚖️</div><h2>${L('Ty vs.', 'You vs.')} ${esc(data.nickname)}</h2>
      <table class="stats cmp"><thead><tr><th></th><th>${L('Ty', 'You')}</th><th>${esc(data.nickname)}</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="muted">${L(`Vedeš v ${wins} z ${BOARDS.length}, ${esc(data.nickname)} v ${losses}.`, `You lead in ${wins} of ${BOARDS.length}, ${esc(data.nickname)} in ${losses}.`)}</p></div>`,
    [{ text: L('Zavřít', 'Close'), cls: 'ghost' }]);
  }

  // ── Úkoly a úspěchy ──
  function renderTasks(body) {
    const d = Econ.daily(S);
    structKey = 't' + d.day;
    body.innerHTML = `<h3>${L('Úkoly dne', 'Today’s tasks')}</h3><p class="muted">${L('Každý den nové, stejné pro všechny. Splň všechny tři a vesnici přijde požehnání: výnos ×2 na 15 minut.', 'New every day, the same for everyone. Complete all three and the village is blessed: income ×2 for 15 minutes.')}</p>
      <p class="next" id="dailyNext"></p>
      <div class="tasks">${d.tasks.map((tk, i) => `<div class="task" data-t="${i}"><div class="info"><b>${taskText(tk)}</b><div class="bar"><i></i></div><small></small></div><button class="btn" data-claim="${i}"></button></div>`).join('')}</div>
      <h3>${L(`Úspěchy · ${Econ.achCount(S)} / ${ACHIEVEMENTS.length}`, `Achievements · ${Econ.achCount(S)} / ${ACHIEVEMENTS.length}`)}</h3>
      <p class="muted">${L(`Každý úspěch přidá +${Math.round(ACH_BONUS * 100)} % ke všem výnosům.`, `Each achievement adds +${Math.round(ACH_BONUS * 100)}% to all income.`)}</p>
      <div class="achs">${ACHIEVEMENTS.map(a => { const on = !!S.ach[a.id], secret = a.hidden && !on;
        return `<div class="ach${on ? ' on' : ''}${secret ? ' secret' : ''}" title="${esc(secret ? L('Tajný úspěch', 'Secret achievement') : a.desc)}"><i>${on ? '🏅' : secret ? '❔' : '🔒'}</i><b>${secret ? '???' : a.name}</b><small>${secret ? L('Tajný úspěch', 'Secret achievement') : a.desc}</small></div>`; }).join('')}</div>`;
  }
  function taskText(tk) { const q = DAILY.find(x => x.kind === tk.kind); return q.text(tk.kind === 'earn' ? fmt(tk.n) + L(' grošů', ' groschen') : tk.n); }
  function refreshTasks() {
    const d = Econ.daily(S);
    if ('t' + d.day !== structKey) return renderTasks($('#body'));
    for (const el of document.querySelectorAll('#body .task')) {
      const tk = d.tasks[+el.dataset.t], p = Econ.dailyProgress(S, tk);
      el.querySelector('.bar i').style.width = `${(p / tk.n) * 100}%`;
      el.querySelector('small').textContent = tk.kind === 'earn' ? `${fmt(p)} / ${fmt(tk.n)}` : `${p} / ${tk.n}`;
      const b = el.querySelector('button');
      b.disabled = tk.claimed || p < tk.n;
      b.innerHTML = tk.claimed ? L('Hotovo ✔', 'Done ✔') : L(`Vyzvednout ${coinSvg}${fmt(Econ.dailyReward(S))}`, `Claim ${coinSvg}${fmt(Econ.dailyReward(S))}`);
      el.classList.toggle('ready', !tk.claimed && p >= tk.n);
    }
    const nx = $('#dailyNext'), left = Econ.dailyLeft();
    if (nx) {
      const all = d.tasks.every(t => t.claimed);
      nx.className = 'next' + (all ? ' done' : '');
      nx.innerHTML = all ? L(`🎉 Dnešní úkoly máš hotové. Nové přijdou za <b>${fmtDur(left)}</b> (o půlnoci).`, `🎉 Today’s tasks are done. New ones arrive in <b>${fmtDur(left)}</b> (at midnight).`)
        : L(`⏰ Nové úkoly za <b>${fmtDur(left)}</b> (o půlnoci). Nesplněné do té doby propadnou.`, `⏰ New tasks in <b>${fmtDur(left)}</b> (at midnight). Unfinished ones expire then.`);
    }
  }

  // ── Více: statistiky, nastavení, nápověda ──
  function renderMore(body) {
    structKey = 'm';
    const st = S.stats;
    const rows = [
      [L('Čas ve hře', 'Time played'), fmtDur(st.playTime)], [L('Pokolení', 'Generation'), S.gen], [L('Vyděláno celkem', 'Earned in total'), fmt(S.earnedAll)],
      [L('Vyděláno v tomto pokolení', 'Earned this generation'), fmt(S.earnedGen)], [L('Nejvyšší výnos', 'Best income'), fmt(st.bestRate, 1) + L(' za s', ' /s')],
      [L('Postaveno budov', 'Buildings built'), fmtN(st.bought)], [L('Nákupů v Řemeslech', 'Purchases in Trades'), fmtN(st.buys)], [L('Nejvíc budov naráz', 'Most buildings at once'), fmtN(st.maxBuildings)], [L('Mistrovství', 'Masteries'), fmtN(st.milestones)], ...(S.steward ? [[L('Šafář nakoupil', 'Steward purchases'), fmt(st.stewardBuys)]] : []), [L('Koupeno vylepšení', 'Upgrades bought'), fmt(st.upgrades)], [L('Klepnutí', 'Taps'), fmt(S.taps)],
      ...(Econ.cechOpen(S) ? [[`👥 ${L('Násobek od učňů', 'Apprentice multiplier')}`, '×' + fmt(Econ.cMul(S), 2)], [`🧹 ${L('Nejvíc učňů', 'Most apprentices')}`, fmt(st.ucniMax)], [L('Do cechu koupeno', 'Bought for the guild'), fmt(st.cechBought)], [L('Cechovní pečeti', 'Guild seals'), fmt(st.cechSeals)]] : []),
      ...(Econ.elanOpen(S) ? [[`💫 ${L('Elán', 'Spirit')}`, `${Math.floor(S.elan)} / ${ELAN_MAX}`], [`${POWERS.warp.icon} ${POWERS.warp.name}`, fmtN(st.warps)], [`${POWERS.rush.icon} ${POWERS.rush.name}`, fmtN(st.rushes)]] : []),
      [`🔥 ${L('Největší kombo kouzel', 'Biggest spell combo')}`, '×' + fmt(st.comboMax)], ...(st.autoBuys ? [[`🧑‍🌾 ${L('Pomocníci nakoupili', 'Helper purchases')}`, fmtN(st.autoBuys)]] : []),
      ...CREATURES.map(c => [`${C_ICON[c.id]} ${c.name}`, fmt(S.caught[c.id] || 0)]), [L('Utekly ti', 'Got away'), fmt(st.missed)],
      [L('Bez tebe vesnice vydělává', 'Earns without you for'), fmtDur(Econ.offlineCap(S))],
    ];
    const cap = Econ.offlineCap(S);
    body.innerHTML = `<div class="away-card"><b>🌙 ${L('Odcházíš?', 'Heading off?')}</b>
      <p>${L(`Bez tebe vesnička vydělává až <b>${fmtDur(cap)}</b>. Vrať se nejpozději <b>v ${clockAt(cap)}</b>, jinak začne zahálet. Čím dřív se vrátíš a groše utratíš, tím rychleji poroste.`, `Without you the village earns for up to <b>${fmtDur(cap)}</b>. Come back by <b>${clockAt(cap)}</b> at the latest or it starts idling. The sooner you come back and spend, the faster it grows.`)}</p>
      <p class="muted">${S.steward && S.settings.auto ? L('Šafář bude mezitím nakupovat za tebe.', 'Meanwhile the steward keeps buying for you.') : L(`Za tu dobu vydělá zhruba ${fmt(Econ.rate(S, seasonAt(Date.now()), false) * cap)} grošů.`, `In that time it earns about ${fmt(Econ.rate(S, seasonAt(Date.now()), false) * cap)} groschen.`)} ${L('Delší výdělek bez tebe dává Ponocný a kronika.', 'The Night watchman and the chronicle make it last longer.')}</p></div>
      <h3>${L('Statistiky', 'Statistics')}</h3><table class="stats">${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
      <h3>${L('Nastavení', 'Settings')}</h3>
      <label class="set"><input type="checkbox" id="setMusic" ${S.settings.music ? 'checked' : ''}> ${L('Hudba', 'Music')}</label>
      ${vol('musicVol', L('Hlasitost hudby', 'Music volume'), !S.settings.music)}
      <label class="set"><input type="checkbox" id="setSound" ${S.settings.sound ? 'checked' : ''}> ${L('Zvukové efekty', 'Sound effects')}</label>
      ${vol('sfxVol', L('Hlasitost zvuků', 'Sound volume'), !S.settings.sound)}
      ${S.settings.mute ? `<p class="muted">🔇 ${L('Hudbu i zvuky teď ztlumilo tlačítko nahoře. Zapneš je stejným tlačítkem.', 'Music and sounds are muted by the button at the top. The same button turns them back on.')}</p>` : ''}
      ${window.GCMusic && !window.GCMusic.gameMusic ? `<p class="muted">🎧 ${L('V herním centru máš zvolený vlastní playlist nebo bez hudby, hudba vesnice proto mlčí.', 'The game center is set to your own playlist or no music, so the village music stays quiet.')} <button class="btn small" data-gcmusic>${L('Hudba v centru', 'Center music')}</button></p>` : ''}
      <label class="set"><input type="checkbox" id="setSci" ${S.settings.sci ? 'checked' : ''}> ${L('Vědecký zápis čísel (1,23e15)', 'Scientific notation (1.23e15)')}</label>
      <label class="set"><input type="checkbox" id="setQuick" ${S.settings.quick ? 'checked' : ''}> ${L('Tlačítko ⚡ Nejlepší koupě na návsi', 'The ⚡ Best buy button on the village green')}</label>
      <h3>${L('Jak hrát', 'How to play')}</h3>${help()}
      <h3>${L('Začít úplně znovu', 'Start over completely')}</h3>
      <p class="muted">${L('Smaže celou vesnici, pověsti i úspěchy.', 'Deletes the whole village, legends and achievements.')}</p>
      <button class="btn danger" id="reset">${L('Smazat vesnici', 'Delete the village')}</button>`;
  }
  // Posuvník hlasitosti 0–100 % (mění se hned, uloží se po puštění).
  function vol(k, label, off) {
    const v = S.settings[k] ?? (k === 'musicVol' ? 55 : 100);
    return `<label class="set vol${off ? ' off' : ''}"><span>${label}</span><input type="range" min="0" max="100" step="5" value="${v}" data-vol="${k}" style="--p:${v}%"><output>${v} %</output></label>`;
  }
  function help() {
    return `<ul class="help">${[
      L('<b>Klepej do vesnice</b> a vydělávej groše. Za groše stav <b>řemesla</b>: každé vydělává samo, i když hru zavřeš (až 8 hodin, víc přidá Ponocný a pověsti).', '<b>Tap the village</b> to earn groschen. Spend them on <b>trades</b>: each one earns on its own, even while the game is closed (up to 8 hours, more with the Night watchman and legends).'),
      L(`Při <b>${MILESTONES.slice(0, 4).map(fmtN).join(', ')}…</b> kusech jednoho řemesla získáš <b>mistrovství</b>: výnos řemesla se zdvojnásobí a <b>každý další nákup přinese dvakrát víc kusů</b> (1, 2, 4, 8…). Cena roste s počtem nákupů, ne kusů. Volbou <b>1× · 10× · Max</b> u řemesla koupíš víc nákupů naráz.`, `At <b>${MILESTONES.slice(0, 4).map(fmtN).join(', ')}…</b> of one trade you reach a <b>mastery</b>: that trade’s output doubles and <b>every further purchase brings twice as many</b> (1, 2, 4, 8…). The price grows with purchases, not units. Pick <b>1× · 10× · Max</b> next to a trade to buy several purchases at once.`),
      L(`<b>Sousedská výpomoc:</b> každé řemeslo zvedne výnos všech řemesel pod sebou, s prvním kusem ×${trunc(1 + SYN_FIRST, 2)} a s každým jeho mistrovstvím o ${trunc(SYN_MS, 2)} víc.`, `<b>Neighbourly help:</b> every trade lifts the output of all trades below it, ×${trunc(1 + SYN_FIRST, 2)} with its first unit and ${trunc(SYN_MS, 2)} more with each of its masteries.`),
      L(`<b>Elán</b> 💫 se doplňuje sám (i když nehraješ), nejvýš do ${ELAN_MAX}, a za groše se koupit nedá. Za ${POWERS.warp.cost} otočíš <b>přesýpací hodiny</b> (hned 15 minut výnosu), za ${POWERS.rush.cost} vyhlásíš <b>žně</b> (výnos i klepnutí ×5 na 20 s).`, `<b>Spirit</b> 💫 refills by itself (even while you are away) up to ${ELAN_MAX} and cannot be bought. For ${POWERS.warp.cost} turn the <b>hourglass</b> (15 minutes of income at once), for ${POWERS.rush.cost} call a <b>harvest rush</b> (income and taps ×5 for 20 s).`),
      L('<b>Roční období</b> se střídají každých 5 minut a jsou stejná pro všechny. Řemesla v sezóně vydělávají dvojnásob.', '<b>Seasons</b> change every 5 minutes and are the same for everyone. Trades in season earn double.'),
      L('Každou minutu až dvě se ve vsi zjeví <b>pohádková bytost</b> nebo <b>padající hvězda</b>. Klepni na ni, než zmizí: bludička najde poklad, vodník půjčí hrníček štěstí, čert dá sílu do klepání, Krakonoš zlevní stavby, hospodáříček postaví budovy zdarma a hvězda splní náhodné přání. <b>Kouzla se násobí:</b> vodník ×5, hvězda ×7 a žně ×5 dají dohromady ×175.', 'Every minute or two a <b>fairy-tale creature</b> or a <b>shooting star</b> appears. Tap it before it vanishes: the will-o’-wisp finds treasure, the water goblin lends his lucky pot, the devil powers your taps, Krakonoš cuts prices, the house sprite builds for free and the star grants a random wish. <b>Spells multiply:</b> the goblin’s ×5, a star’s ×7 and a harvest rush ×5 make ×175 together.'),
      L('S první <b>Kovárnou</b> se otevře <b>Cech</b>: generátor generuje generátor. Každý stupeň vyučí ten pod sebou (král vydává listiny, … mistři vychovají tovaryše, tovaryši učně) a <b>učni zvedají výnos celé vesnice</b>: každý desetinásobek učňů o 6 % a víc. Cech roste sám i bez tebe, v zimě dvakrát rychleji. Při 10, 25, 50… koupených kusech dostane stupeň <b>cechovní pečeť</b>.', 'With your first <b>Smithy</b> the <b>Guild</b> opens: generators make generators. Every rank trains the one below (kings issue charters, … masters raise journeymen, journeymen train apprentices) and <b>apprentices lift the whole village’s income</b>: every tenfold of them by 6% and more. The guild grows on its own, even without you, twice as fast in winter. At 10, 25, 50… bought, a rank earns a <b>guild seal</b>.'),
      L('Až vyděláš hodně, <b>předej vesnici dalšímu pokolení</b> v Kronice. Začneš znovu, ale každá pověst zrychlí všechno o 5 % a odemyká trvalé výhody. Pověsti můžeš utratit v <b>rodokmenu</b>: násobky výnosu, rychlejší elán a <b>pomocníci</b>, kteří sami kupují první řemesla.', 'Once you have earned a lot, <b>pass the village on</b> in the Chronicle. You start over, but every legend speeds everything up by 5% and unlocks lasting perks. Spend legends in the <b>family tree</b>: income multipliers, faster spirit and <b>helpers</b> who buy the first trades by themselves.'),
      L('Po přihlášení v herním centru se vesnice ukládá do účtu a pokračuje na jiném zařízení.', 'Sign in at the game center and the village is saved to your account and continues on other devices.'),
    ].map(x => `<li>${x}</li>`).join('')}</ul>`;
  }

  function refresh() {
    hud();
    if (tab === 'build') { if (buildKey() !== structKey) renderBuild($('#body')); refreshBuild(); }
    else if (tab === 'cech') refreshCech();
    else if (tab === 'upg') refreshUpg();
    else if (tab === 'tasks') refreshTasks();
    else if (tab === 'legend') { const el = $('#legN'); if (el && (el.textContent !== fmt(S.legends) || treeKey !== Object.keys(S.tree).join())) renderLegend($('#body')); const pb = $('#prestige'); if (pb) pb.disabled = Econ.pending(S) < 1; const hb = $('#hire'); if (hb) hb.disabled = S.legends < STEWARD_COST; }
  }

  // ── Oznámení ──
  function toast(html, kind = '') {
    const box = $('#toasts'), el = document.createElement('div');
    el.className = 'toast ' + kind; el.innerHTML = html; box.appendChild(el);
    while (box.children.length > (innerWidth < 700 ? 2 : 3)) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, kind === 'big' ? 4200 : 3000);
  }
  /** Plovoucí „+16“ u tlačítka v panelu (šťáva k nákupu). */
  function pop(el, text, cls = '') {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect(), p = document.createElement('div');
    p.className = 'pop ' + cls; p.textContent = text;
    p.style.left = `${r.left + r.width / 2}px`; p.style.top = `${r.top}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 900);
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  /** Řádek řemesla nebo cechu krátce zazáří (mistrovství, pečeť). */
  function flash(sel) { const el = document.querySelector(sel); if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  // ── Okna ──
  function modal(html, buttons) {
    const m = $('#modal');
    m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}<div class="acts">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${b.text}</button>`).join('')}</div></div>`;
    m.hidden = false;
    m.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { const f = buttons[+b.dataset.i].fn; m.hidden = true; m.innerHTML = ''; if (f) f(); } };
    const first = m.querySelector('.btn'); if (first) first.focus();
  }
  const closeModal = () => { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; };

  function bind(handlers) {
    $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { setTab(b.dataset.tab); Sound.play.tap(); } });
    const body = $('#body');
    let hold = null;
    const stopHold = () => { clearTimeout(hold); clearInterval(hold); hold = null; };
    body.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-buy], [data-cbuy]');
      if (!b || b.disabled) return;
      stopHold();
      const go = () => (b.dataset.cbuy != null ? handlers.cbuy(+b.dataset.cbuy, amtOf('c' + b.dataset.cbuy), true, b) : handlers.buy(+b.dataset.buy, amtOf('b' + b.dataset.buy), true, b));
      hold = setTimeout(() => { hold = setInterval(() => { if (!go()) stopHold(); }, 110); }, 450);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) body.addEventListener(ev, stopHold);
    body.addEventListener('click', e => {
      const t = e.target;
      const b = t.closest('[data-buy]'); if (b) { handlers.buy(+b.dataset.buy, amtOf('b' + b.dataset.buy), false, b); return; }
      const cb = t.closest('[data-cbuy]'); if (cb) { handlers.cbuy(+cb.dataset.cbuy, amtOf('c' + cb.dataset.cbuy), false, cb); return; }
      const to = t.closest('[data-to]'); if (to) { handlers.buy(+to.dataset.to, +to.dataset.n, false, to); return; }
      const ra = t.closest('[data-ra]'); if (ra) { const k = ra.dataset.rk; rowAmt[k] = ra.dataset.ra === 'max' ? 'max' : +ra.dataset.ra; for (const x of ra.parentNode.querySelectorAll('[data-ra]')) x.setAttribute('aria-pressed', String(x === ra)); Sound.play.tap(); refresh(); return; }
      const tr = t.closest('[data-tree]'); if (tr) { handlers.tree(tr.dataset.tree); return; }
      if (t.closest('#smartBuy')) { handlers.smart(); return; }
      if (t.closest('#hire')) { handlers.hire(); return; }
      const bd = t.closest('[data-board]'); if (bd) { board = bd.dataset.board; for (const x of body.querySelectorAll('[data-board]')) x.setAttribute('aria-selected', String(x === bd)); $('#lb').innerHTML = `<p class="muted">${L('Načítám…', 'Loading…')}</p>`; loadLb(); return; }
      const pl = t.closest('#lb tr[data-nick]'); if (pl) { compare(pl.dataset.nick); return; }
      const u = t.closest('[data-ubuy]'); if (u) { handlers.upg(u.dataset.ubuy); return; }
      if (t.closest('#buyAll')) { handlers.buyAll(); return; }
      if (t.closest('#prestige')) { handlers.prestige(); return; }
      const c = t.closest('[data-claim]'); if (c) { handlers.claim(+c.dataset.claim); return; }
      if (t.closest('#reset')) { handlers.reset(); return; }
    });
    body.addEventListener('change', e => {
      if (e.target.id === 'setMusic') handlers.setting('music', e.target.checked);
      if (e.target.id === 'setSound') handlers.setting('sound', e.target.checked);
      if (e.target.dataset.vol) handlers.volume(e.target.dataset.vol, +e.target.value, true);
      if (e.target.id === 'setSci') handlers.setting('sci', e.target.checked);
      if (e.target.id === 'setQuick') handlers.setting('quick', e.target.checked);
      if (e.target.id === 'autoBuy') handlers.setting('auto', e.target.checked);
      if (e.target.dataset && e.target.dataset.ab) handlers.ab(e.target.dataset.ab, e.target.checked);
    });
    body.addEventListener('input', e => {
      const k = e.target.dataset && e.target.dataset.vol;
      if (!k) return;
      e.target.style.setProperty('--p', `${e.target.value}%`);
      e.target.nextElementSibling.textContent = `${e.target.value} %`;
      handlers.volume(k, +e.target.value, false);
    });
    body.addEventListener('keydown', e => { const pl = e.target.closest && e.target.closest('#lb tr[data-nick]'); if (pl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); compare(pl.dataset.nick); } });
    for (const id of ['#edgeL', '#edgeR']) $(id).addEventListener('click', () => Scene.focusCreature());
    $('#quick').addEventListener('click', () => { if (best) handlers.quick(best); });
    $('#powers').addEventListener('click', e => { const b = e.target.closest('[data-power]'); if (b && !b.disabled) handlers.power(b.dataset.power, b); });
    $('#newsBtn').addEventListener('click', () => toggleNews());
    $('#news').addEventListener('click', e => { if (e.target.closest('[data-close]')) toggleNews(false); });
    $('#soundBtn').addEventListener('click', () => handlers.setting('mute', !silent()));
  }
  // ── Novinky ──
  function toggleNews(open) {
    const el = $('#news'), show = open == null ? el.hidden : open;
    if (show) {
      el.innerHTML = `<div class="nw-h"><b>🎁 ${L('Co je nového', 'What’s new')}</b><button data-close aria-label="${L('Zavřít', 'Close')}">✕</button></div>${NEWS.map(n => `<div class="nw-v"><small>${n.date}</small><ul>${n.items.map(([i, t]) => `<li><i>${i}</i><span>${t}</span></li>`).join('')}</ul></div>`).join('')}`;
      H.newsSeen();
    }
    el.hidden = !show;
    $('#newsBtn').setAttribute('aria-expanded', String(show));
  }
  // Tlačítko nahoře ztlumí hudbu i zvuky naráz (nastavení obou zůstane).
  const silent = () => S.settings.mute || (!S.settings.sound && !S.settings.music);
  function soundIcon() { const m = silent(); $('#soundBtn').textContent = m ? '🔇' : '🔊'; $('#soundBtn').setAttribute('aria-label', m ? L('Zapnout hudbu a zvuky', 'Unmute music and sounds') : L('Ztlumit hudbu i zvuky', 'Mute music and sounds')); }

  function init(state, handlers) {
    S = state; H = handlers;
    tabs(); inited = true; bind(handlers); soundIcon();
    document.documentElement.lang = LANG;
    $('.back').setAttribute('aria-label', L('Zpět do herního centra', 'Back to the game center'));
    $('#newsBtn .nl').textContent = L('Novinky', 'What’s new');
    render();
  }
  return { init, render, refresh, toast, modal, closeModal, setTab, soundIcon, tabs, coinSvg, C_ICON, cName, clockAt, help, toggleNews, compare, pop, flash, get tab() { return tab; }, set state(v) { S = v; } };
})();
