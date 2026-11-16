#!/usr/bin/env node
// Builds the English Gray Zone Warfare field guide (static/wiki/gzw/en/index.html) from the
// Czech one (static/wiki/gzw/index.html), which its authors keep updating:
//   node apps/web/scripts/wiki-gzw-en.mjs
// Every Czech text is replaced by its translation and must be found exactly as often as
// listed; when the authors change a text, the script names it and writes nothing, so the
// translation is fixed here and nothing stays half Czech.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'wiki', 'gzw');
const SOURCE = join(dir, 'index.html');
const TARGET = join(dir, 'en', 'index.html');

/** [Czech, English, how many times the Czech text is there (default 1)] */
const T = [
	// head
	['<html lang="cs">', '<html lang="en">'],
	['<title>GZW Polní příručka</title>', '<title>GZW Field Guide</title>'],
	['content="GZW Polní příručka"', 'content="GZW Field Guide"'],
	[
		'Česká příručka ke Gray Zone Warfare: co prorazí jakou vestu, výkupní ceny 176 předmětů s ikonami a reputace obchodníků. Pro verzi hry 0.5.1.',
		'A Gray Zone Warfare field guide: what penetrates which armour, sell prices of 176 items with icons and vendor reputation. For game version 0.5.1.',
		2,
	],
	['content="cs_CZ"', 'content="en_US"'],
	[
		'<meta property="og:url" content="https://windowling.com/wiki/gzw/">',
		'<meta property="og:url" content="https://windowling.com/wiki/gzw/en/">',
	],
	// header
	[
		'Polní příručka<small>Lamang · data pro verzi 0.5.1</small>',
		'Field Guide<small>Lamang · data for version 0.5.1</small>',
	],
	['aria-label="Sekce"', 'aria-label="Sections"'],
	['data-tab="munice">Munice</a>', 'data-tab="munice">Ammo</a>'],
	['data-tab="obchodnici">Obchodníci</a>', 'data-tab="obchodnici">Vendors</a>'],
	['>Tac mapa ↗</a>', '>Tac map ↗</a>'],
	['title="Gray Zone Warfare Wiki na Fandomu"', 'title="Gray Zone Warfare Wiki on Fandom"'],
	[
		'<a class="maplink" href="en/" hreflang="en" lang="en" title="English version">EN</a>',
		'<a class="maplink" href="../" hreflang="cs" lang="cs" title="Česká verze">CZ</a>',
	],
	[
		'title="Zpět na herní wiki ve Windowling Game Center"',
		'title="Back to the game wikis in Windowling Game Center"',
	],
	// ammo
	['<h1>Čím prorazím jeho vestu</h1>', '<h1>What gets through his armour</h1>'],
	[
		'Vyber třídu vesty nebo helmy nepřítele a uvidíš jen náboje, které ji prorazí, seřazené podle ceny.',
		'Pick the class of the enemy’s vest or helmet and you see only the rounds that penetrate it, sorted by price.',
	],
	[
		'placeholder="Hledat ráži, náboj, obchodníka…  ( / )"',
		'placeholder="Search calibre, round, vendor…  ( / )"',
	],
	[
		'aria-label="Třída vesty nepřítele"><span class="glabel">Vesta</span>',
		'aria-label="Enemy armour class"><span class="glabel">Armour</span>',
	],
	[
		'aria-label="Ráže"><span class="glabel">Ráže</span>',
		'aria-label="Calibre"><span class="glabel">Calibre</span>',
	],
	['prorazí, jedna rána do srdce zabíjí', 'penetrates, one shot to the heart kills'],
	['<i class="sq n"></i>neprorazí</span>', '<i class="sq n"></i>does not penetrate</span>'],
	['<i class="sq u"></i>netestováno</span>', '<i class="sq u"></i>not tested</span>'],
	['Kliknutím na třídu v záhlaví ji vybereš.', 'Click a class in the table header to select it.'],
	[
		'Testováno na hráčích z bezprostřední blízkosti (srdce, u helem temeno). Na dálku může náboj ztratit průraznost.',
		'Tested on players at point-blank range (the heart, the top of the head for helmets). At range a round can lose penetration.',
	],
	[
		'Vesta chytá kulky na 100 %, dokud se úplně nerozbije. 90% vesta chrání stejně jako 10%.',
		'A vest stops 100% of rounds until it breaks completely. A vest at 90% protects just like one at 10%.',
	],
	[
		'Helma chrání jen místa, která zakrývá. Obličej a uši jsou samostatné zásahové zóny.',
		'A helmet protects only what it covers. The face and the ears are separate hit zones.',
	],
	[
		'Broky zabijí jen tehdy, když předchozí broky vestu rozbijí a poslední prorazí.',
		'Buckshot kills only when earlier pellets break the vest and the last one gets through.',
	],
	['<p class="src">Zdroj: <a', '<p class="src">Source: <a'],
	[
		'</a> od AstroPolski a komunity. Třídy II, II+ a IV ve hře zatím nejsou, proto chybí.',
		'</a> by AstroPolski and the community. Classes II, II+ and IV are not in the game yet, so they are missing.',
	],
	// loot
	['<h1>Co se vyplatí nosit</h1>', '<h1>What is worth carrying</h1>'],
	[
		'Nejlepší výkupní ceny u obchodníků. Při plném batohu se řiď cenou za slot, při přetížení cenou za kilo.',
		'The best vendor sell prices. With a full backpack go by the price per slot, when overweight by the price per kilo.',
	],
	['placeholder="Hledat předmět…  ( / )"', 'placeholder="Search items…  ( / )"'],
	[
		'aria-label="Kategorie"><option value="">Všechny kategorie</option>',
		'aria-label="Category"><option value="">All categories</option>',
	],
	[
		'aria-label="Řazení"><span class="glabel">Řadit</span>',
		'aria-label="Sorting"><span class="glabel">Sort</span>',
	],
	[
		'aria-label="Komu prodat"><span class="glabel">Komu</span>',
		'aria-label="Who to sell to"><span class="glabel">Sell to</span>',
	],
	[
		'<b>Peněženka:</b> karty, hotovost a doklady se vejdou do peněženky a ušetří místo. Nos ji v zabezpečeném kontejneru.',
		'<b>Wallet:</b> cards, cash and IDs fit in a wallet and save space. Keep it in your secure container.',
	],
	[
		'Důkazy, doklady a pasy vykoupí Handshake za stejnou cenu jako Banshee. Handshake je dostupný od levelu 1.',
		'Handshake buys evidence, IDs and passports for the same price as Banshee. Handshake is available from level 1.',
	],
	[
		'„Exkluzivně“ znamená, že předmět vykoupí jen tento obchodník.',
		'“Exclusive” means only this vendor buys the item.',
	],
	[
		'„Úkol ×2“: předmět chtějí úkoly, 2 kusy na jeden požadavek. Než ho prodáš, zkontroluj, jestli ho nepotřebuješ.',
		'“Task ×2”: tasks want the item, 2 per requirement. Before you sell it, check you do not need it.',
	],
	[
		'„★ pašování“: předmět pro pašování nebo úkoly úkrytu. Tam za něj obvykle dostaneš víc než u obchodníka.',
		'“★ smuggling”: an item for smuggling or hideout tasks. You usually get more for it there than from a vendor.',
	],
	[
		'T1–T3 u rozebírání: tier zdroje říká, jakou součástku z něj dostaneš (T1 základní, T2 pokročilá, T3 špičková).',
		'T1–T3 for dismantling: the tier of a source says which component you get from it (T1 basic, T2 advanced, T3 top-tier).',
	],
	[
		'Ceny jsou přímé nabídky obchodníků. Zkrácené názvy jsou převzaté z tabulky.',
		'Prices are the vendors’ direct offers. Shortened names are taken from the charts.',
	],
	[
		'Zdroj: tabulky „Sellable Loot Reference“ a „Best Value Loot by Slot / by Weight“ od Sargcj (',
		'Source: the “Sellable Loot Reference” and “Best Value Loot by Slot / by Weight” charts by Sargcj (',
	],
	[
		'), ověřeno pro verzi 0.5.1.0. Ceny přepsané a ikony vyřezané z jeho tabulek.',
		'), checked for version 0.5.1.0. Prices transcribed and icons cut out of his charts.',
	],
	// vendors
	['<h1>Obchodníci a reputace</h1>', '<h1>Vendors and reputation</h1>'],
	[
		'Rank se počítá z celkové nasbírané reputace. Prodejem ji získáváš třikrát rychleji než nákupem.',
		'Rank comes from the total reputation you have collected. Selling earns it three times faster than buying.',
	],
	['<span class="k">Nákup u obchodníka</span>', '<span class="k">Buying from a vendor</span>'],
	['$500 utraceno = 1 rep', '$500 spent = 1 rep'],
	['<span class="k">Prodej obchodníkovi</span>', '<span class="k">Selling to a vendor</span>'],
	['$166.67 prodáno = 1 rep', '$166.67 sold = 1 rep'],
	['<span class="k">Bonus specialisty</span>', '<span class="k">Specialist bonus</span>'],
	['+33,33 %', '+33.33%', 7],
	['za jeho druh lootu', 'for their kind of loot'],
	['<span class="k">Bonus Vulture</span>', '<span class="k">Vulture bonus</span>'],
	['+6,67 %', '+6.67%', 2],
	['na běžný loot', 'on common loot'],
	['<h2>Kolik prodat do dalšího ranku</h2>', '<h2>How much to sell for the next rank</h2>'],
	['<label for="calc-v">Obchodník</label>', '<label for="calc-v">Vendor</label>'],
	[
		'<label for="calc-rep">Moje reputace teď</label>',
		'<label for="calc-rep">My reputation now</label>',
	],
	[
		'<label for="calc-amt">Převod: částka v $</label>',
		'<label for="calc-amt">Convert: amount in $</label>',
	],
	['<h2>Odemykání</h2>', '<h2>Unlocks</h2>'],
	['<dt>Úkryt (hideout)</dt>', '<dt>Hideout</dt>'],
	['<dt>Pašování a úkoly úkrytu</dt>', '<dt>Smuggling and hideout tasks</dt>'],
	['<h2>Nová postava bez tutoriálu</h2>', '<h2>A new character without the tutorial</h2>'],
	[
		'Začínáš na levelu postavy 8 s těmito ranky:',
		'You start at character level 8 with these ranks:',
	],
	['<span class="r off">zamčeno</span>', '<span class="r off">locked</span>', 2],
	[
		'Zdroj: „Vendor Rep / Rank / Value“ od Sargcj (',
		'Source: “Vendor Rep / Rank / Value” by Sargcj (',
	],
	[
		'), verze 0.5.1.0. Částky k ranku jsou dopočítané z poměru 6 rep za $1 000 prodeje.',
		'), version 0.5.1.0. The amounts to each rank are worked out from the ratio of 6 rep per $1,000 sold.',
	],
	// footer
	[
		'<b>Ve hře:</b> <kbd>Shift</kbd>+<kbd>Tab</kbd> → webový prohlížeč → vlož odkaz na tuhle stránku.',
		'<b>In game:</b> <kbd>Shift</kbd>+<kbd>Tab</kbd> → web browser → paste the link to this page.',
	],
	[
		'Okno připni špendlíkem, ať zůstane vidět i po zavření overlaye.',
		'Pin the window so it stays visible after you close the overlay.',
	],
	['Tac mapu si otevři v druhé záložce.', 'Open the Tac map in a second tab.'],
	['<kbd>/</kbd> hledat · <kbd>Esc</kbd> smazat', '<kbd>/</kbd> search · <kbd>Esc</kbd> clear'],
	[
		'Neoficiální fanouškovská stránka, není spojená s MADFINGER Games. Gray Zone Warfare a herní grafika patří jejich vlastníkům. Data a tabulky vytvořila komunita, autoři jsou uvedeni u každé sekce.',
		'An unofficial fan page, not affiliated with MADFINGER Games. Gray Zone Warfare and the game art belong to their owners. The data and charts were made by the community; the authors are credited in each section.',
	],
	// script: data
	['"Tahirs (karton)"', '"Tahirs (carton)"'],
	['"Tahirs (krabička)"', '"Tahirs (pack)"'],
	['"vices": "Neřesti"', '"vices": "Vices"'],
	['"electronics": "Elektronika"', '"electronics": "Electronics"'],
	['"evidence": "Důkazy a doklady"', '"evidence": "Evidence and IDs"'],
	['"jewellery": "Šperky"', '"jewellery": "Jewellery"'],
	['"funds": "Platební karty"', '"funds": "Payment cards"'],
	['"milequip": "Vojenské vybavení"', '"milequip": "Military equipment"'],
	['"milmat": "Vojenský materiál"', '"milmat": "Military materials"'],
	['"workshop": "Dílna"', '"workshop": "Workshop"'],
	['"lab": "Laboratoř"', '"lab": "Laboratory"'],
	['"prodin": "Výroba: suroviny"', '"prodin": "Production: ingredients"'],
	['"prodmid": "Výroba: meziprodukty"', '"prodmid": "Production: intermediates"'],
	['"prodout": "Výroba: produkty"', '"prodout": "Production: products"'],
	['"dissrc": "Rozebírání: zdroje"', '"dissrc": "Dismantling: sources"'],
	['"disout": "Rozebírání: výstupy"', '"disout": "Dismantling: outputs"'],
	['"house": "Domácnost"', '"house": "Household"'],
	['best: "Důkazy, doklady, pasy"', 'best: "Evidence, IDs, passports"', 2],
	['best: "Neřesti, alkohol"', 'best: "Vices, alcohol"'],
	['best: "Telefony, elektronika"', 'best: "Phones, electronics"'],
	['best: "Karty, peníze"', 'best: "Cards, money"'],
	['best: "Šperky"', 'best: "Jewellery"'],
	['best: "Běžný a vybraný vojenský loot"', 'best: "Common and selected military loot"'],
	// script: ammo
	['data-cls="-1">Vše</button>', 'data-cls="-1">All</button>'],
	['data-cal="">Všechny</button>', 'data-cal="">All</button>'],
	[
		'{ k: "c", t: "Ráže" }, { k: "n", t: "Náboj" }, { k: "p", t: "Cena",',
		'{ k: "c", t: "Calibre" }, { k: "n", t: "Round" }, { k: "p", t: "Price",',
	],
	[
		'{ k: "v", t: "Kde koupit" }, { k: "max", t: "Prorazí do",',
		'{ k: "v", t: "Where to buy" }, { k: "max", t: "Penetrates up to",',
	],
	['title: "Úsťová rychlost"', 'title: "Muzzle velocity"'],
	['t: "Přesnost"', 't: "Accuracy"'],
	[
		't: "Výdrž", num: 1, sort: 1, dirDefault: -1, title: "Durability mod % z tabulky"',
		't: "Durability", num: 1, sort: 1, dirDefault: -1, title: "Durability mod % from the chart"',
	],
	[
		'title="Ukázat jen náboje, které prorazí ${c}"',
		'title="Show only the rounds that penetrate ${c}"',
	],
	[
		'const word = v => v === 1 ? "prorazí" : v === 0 ? "neprorazí" : "netestováno";',
		'const word = v => v === 1 ? "penetrates" : v === 0 ? "does not penetrate" : "not tested";',
	],
	['a.max < 0 ? "nic" : CLASSES[a.max]', 'a.max < 0 ? "none" : CLASSES[a.max]'],
	['Nic tomu neodpovídá. Zkus jiný filtr.', 'Nothing matches. Try another filter.'],
	[
		'? `Třídu <b>${CLASSES[ammo.cls]}</b> prorazí <b>${rows.length}</b> ${plural(rows.length, "náboj", "náboje", "nábojů")}. Nejlevnější: <b>${esc(cheapest.c)} ${esc(cheapest.n)}</b> za ${usd(cheapest.p)}',
		'? `<b>${rows.length}</b> ${plural(rows.length, "round", "rounds", "rounds")} penetrate${rows.length === 1 ? "s" : ""} class <b>${CLASSES[ammo.cls]}</b>. The cheapest: <b>${esc(cheapest.c)} ${esc(cheapest.n)}</b> for ${usd(cheapest.p)}',
	],
	[
		': `Třídu <b>${CLASSES[ammo.cls]}</b> nic z vybraného neprorazí.`',
		': `Nothing selected penetrates class <b>${CLASSES[ammo.cls]}</b>.`',
	],
	[
		'sum.innerHTML = `<b>${rows.length}</b> ${plural(rows.length, "náboj", "náboje", "nábojů")} ze ${AMMO.length}. Vyber třídu vesty nepřítele a zbyde jen to, co ji prorazí.`;',
		'sum.innerHTML = `<b>${rows.length}</b> of ${AMMO.length} ${plural(AMMO.length, "round", "rounds", "rounds")}. Pick the enemy’s armour class and only what penetrates it stays.`;',
	],
	// script: loot
	[
		'const LOOT_SORTS = { ps: "Za slot", pk: "Za kg", p: "Celková cena" };',
		'const LOOT_SORTS = { ps: "Per slot", pk: "Per kg", p: "Total price" };',
	],
	['data-lv="">Všichni</button>', 'data-lv="">All</button>'],
	[
		'title="Vykoupí jen tento obchodník">exkluzivně</span>',
		'title="Only this vendor buys it">exclusive</span>',
	],
	[
		'title="Chtějí to úkoly: ${it.t} ks na jeden požadavek. Než to prodáš, zkontroluj, jestli to nepotřebuješ.">úkol ×${it.t}</span>',
		'title="Tasks want it: ${it.t} per requirement. Before you sell it, check you do not need it.">task ×${it.t}</span>',
	],
	[
		'title="Předmět pro pašování nebo úkoly úkrytu. Tam za něj obvykle dostaneš víc než u obchodníka.">★ pašování</span>',
		'title="An item for smuggling or hideout tasks. You usually get more for it there than from a vendor.">★ smuggling</span>',
	],
	[
		'title="Tier součástky z rozebírání: T1 základní, T2 pokročilá, T3 špičková"',
		'title="Tier of the dismantled component: T1 basic, T2 advanced, T3 top-tier"',
	],
	['<span class="same">i</span>', '<span class="same">and</span>'],
	[
		'title="Handshake vykoupí důkazy a doklady za stejnou cenu a je dostupný od levelu 1"',
		'title="Handshake buys evidence and IDs for the same price and is available from level 1"',
	],
	[
		'title: "Pořadí podle zvoleného řazení mezi všemi předměty"',
		'title: "Rank by the chosen sorting among all items"',
	],
	['{ k: "n", t: "Předmět" }', '{ k: "n", t: "Item" }'],
	['{ k: "s", t: "Velikost" }', '{ k: "s", t: "Size" }'],
	['{ k: "w", t: "Váha", num: 1 }', '{ k: "w", t: "Weight", num: 1 }'],
	['{ k: "v", t: "Komu prodat" }', '{ k: "v", t: "Sell to" }'],
	['{ k: "p", t: "Nejvíc dá", num: 1, sort: 1 }', '{ k: "p", t: "Best price", num: 1, sort: 1 }'],
	[
		'{ k: "std", t: "Ostatní", num: 1, title: "Cena u běžného obchodníka" }',
		'{ k: "std", t: "Others", num: 1, title: "Price at a regular vendor" }',
	],
	['plural(it.s, "slot", "sloty", "slotů")', 'plural(it.s, "slot", "slots", "slots")'],
	['Žádný předmět neodpovídá hledání.', 'No item matches the search.'],
	[
		'`<b>${rows.length}</b> ${plural(rows.length, "předmět", "předměty", "předmětů")} ze ${LOOT.length}`',
		'`<b>${rows.length}</b> of ${LOOT.length} ${plural(LOOT.length, "item", "items", "items")}`',
	],
	['` v kategorii <b>${esc(CATS[loot.cat])}</b>`', '` in <b>${esc(CATS[loot.cat])}</b>`'],
	['` pro ${esc(loot.v)}`', '` for ${esc(loot.v)}`'],
	[
		'`, seřazeno: <b>${LOOT_SORTS[k].toLowerCase()}</b>.`',
		'`, sorted <b>${LOOT_SORTS[k].toLowerCase()}</b>.`',
	],
	// script: vendors
	[
		'<th scope="col">Obchodník</th><th class="num" scope="col">Od levelu</th>',
		'<th scope="col">Vendor</th><th class="num" scope="col">From level</th>',
	],
	[
		'title="Kolik prodat od nuly, aby měl rank R2">Prodat do R2</th>',
		'title="How much to sell from zero to reach rank R2">Sell to R2</th>',
	],
	[
		'title="Kolik prodat od nuly do maxima">Prodat do max</th>',
		'title="How much to sell from zero to the maximum">Sell to max</th>',
	],
	['<th scope="col">Nejlépe vykupuje</th>', '<th scope="col">Pays best for</th>'],
	['<span class="bonus">splněno</span>', '<span class="bonus">done</span>'],
	[
		'`zbývá <b>${Math.ceil(left).toLocaleString("en-US")}</b> rep · prodej za <b>${usdShort(left * SELL_PER_REP)}</b> <span class="dim">nebo nákup za ${usdShort(left * BUY_PER_REP)}</span>`',
		'`<b>${Math.ceil(left).toLocaleString("en-US")}</b> rep to go · sell <b>${usdShort(left * SELL_PER_REP)}</b> <span class="dim">or buy ${usdShort(left * BUY_PER_REP)}</span>`',
	],
	[
		'`Prodej za ${usd(amt)} = <b class="strong">+${(amt / SELL_PER_REP).toFixed(1)} rep</b>, nákup za ${usd(amt)} = <b class="strong">+${(amt / BUY_PER_REP).toFixed(1)} rep</b>.`',
		'`Selling ${usd(amt)} = <b class="strong">+${(amt / SELL_PER_REP).toFixed(1)} rep</b>, buying ${usd(amt)} = <b class="strong">+${(amt / BUY_PER_REP).toFixed(1)} rep</b>.`',
	],
];

let html = readFileSync(SOURCE, 'utf8');
const problems = [];
for (const [cs, en, count = 1] of T) {
	const found = html.split(cs).length - 1;
	if (found !== count) problems.push(`found ${found}× (expected ${count}×): ${cs}`);
	else html = html.split(cs).join(en);
}
// Czech left in what the reader sees (code comments aside) means the source has new text.
const CZ = /[ěščřžýáíéůúňťďĚŠČŘŽÝÁÍÉŮÚŇŤĎ]/;
html.split('\n').forEach((line, i) => {
	const text = line.replace(/\/\/.*$|\/\*.*?\*\/|<!--.*?-->/g, '');
	if (CZ.test(text) && !text.includes('lang="cs"') && !text.includes('data:image'))
		problems.push(`Czech text on line ${i + 1}: ${line.trim().slice(0, 120)}`);
});
if (problems.length) {
	console.error(
		`The Czech guide changed, update the translations in this script:\n- ${problems.join('\n- ')}`,
	);
	process.exit(1);
}
mkdirSync(dirname(TARGET), { recursive: true });
writeFileSync(TARGET, html);
console.log(`Wrote ${TARGET}`);
