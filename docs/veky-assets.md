# Věky válek: zadání grafických assetů

Hra kreslí všechno sama ve `static/games/veky/art.js`. Každý obrázek, který dodáš, tu kresbu
nahradí; co chybí, kreslí se dál jako dosud. Takže se dá měnit postupně, po jednom souboru.

## Společná pravidla

- **Formát:** PNG s průhledností (RGBA, sRGB). Žádné JPG, žádný bílý podklad.
- **Měřítko:** vše 4× větší, než se kreslí ve hře (kvůli ostrosti na mobilech s velkým DPI).
  Pozadí 2×. Uvedená **výška je přesná**, šířka podle potřeby (bez zbytečných okrajů).
- **Směr:** jednotky, základny a věže se kreslí **otočené doprava** (hráč je vlevo a útočí
  doprava). Soupeře hra zrcadlí sama.
- **Kotva:** u jednotek a základen je kotvou **střed spodní hrany** obrázku: na ní stojí nohy,
  kola nebo pata stavby. Obrázek tedy končí přesně u země, bez stínu a bez místa pod nohama
  (stín pod jednotkou kreslí hra).
- **Barva týmu:** prvky týmu (pásek, štít, čabraka, praporek…) modré `#3d7bff`. Pro soupeře
  můžeš dodat stejný obrázek s červenou `#e8383a` a koncovkou `-red`; když chybí, hra soupeři
  přimaluje červený praporek.
- **Styl:** malovaný fantasy styl podle návrhu (detailní, poloreálný jako mobilní strategie):
  měkké stínování a objem, bohaté textury (kámen, dřevo, kov, látka), jemný tmavý obrys,
  světlo zleva shora, sytě modrá obloha a zelená krajina. Postavy proporčně „chibi“ až
  poloreálné (hlava cca 1/5 výšky), čitelné i v malé velikosti. Všechny věky ve stejném stylu.
  Referenční obrázek: `veky-style.png` (návrh obrazovky).
- **Animace:** stačí jeden obrázek na jednotku. Chůzi (houpání) a útok (výpad) přidá hra.
- **Jména souborů** přesně podle tabulek níže. Soubory mi pošli, já je dám do
  `static/games/veky/assets/` a zapíšu do `assets/manifest.json`.

Věky: `0` pravěk, `1` středověk, `2` renesance, `3` moderní doba, `4` budoucnost.

## 1. Jednotky (15 + volitelně 15 červených)

`unit-<věk>-<druh>.png`, druh `0` pěšák (boj zblízka), `1` střelec, `2` těžká jednotka.

| Soubor     | Co to je                                         | Výška  |
| ---------- | ------------------------------------------------ | ------ |
| `unit-0-0` | pračlověk s kyjem, kožešina                      | 256 px |
| `unit-0-1` | prakovník s prakem                               | 256 px |
| `unit-0-2` | tyranosaurus, na něm **sedící** jezdec s oštěpem | 384 px |
| `unit-1-0` | šermíř s mečem a štítem, kroužková zbroj, erb    | 256 px |
| `unit-1-1` | lučištník v kápi s lukem                         | 256 px |
| `unit-1-2` | rytíř v brnění na koni v čabraku, s kopím        | 392 px |
| `unit-2-0` | kordista (šerm), klobouk s pérem, plášť          | 256 px |
| `unit-2-1` | mušketýr s mušketou, trojrohý klobouk            | 256 px |
| `unit-2-2` | bronzový kanón na lafetě s dělostřelcem          | 280 px |
| `unit-3-0` | voják s nožem, helma, maskáče                    | 256 px |
| `unit-3-1` | voják se samopalem / puškou                      | 256 px |
| `unit-3-2` | tank                                             | 240 px |
| `unit-4-0` | robot / voják budoucnosti s energetickým mečem   | 256 px |
| `unit-4-1` | voják budoucnosti s laserovou puškou             | 256 px |
| `unit-4-2` | velký bojový robot (mech) s kanónem              | 416 px |

Šířka zhruba: pěšák a střelec 160–260 px, těžké jednotky 380–560 px. Zbraň míří doprava.

## 2. Základny (5 + volitelně 5 červených)

`base-<věk>.png`, výška **760 px** (renesance 912 px, budoucnost 950 px), šířka do ~600 px.
Pata stavby na spodní hraně. Na stavbě nech místo na 3 věže; přesné pozice věží doladím
podle dodaného obrázku.

| Soubor   | Co to je                                       |
| -------- | ---------------------------------------------- |
| `base-0` | jeskyně / skalní obydlí s palisádou a ohništěm |
| `base-1` | kamenný hrad s cimbuřím a branou               |
| `base-2` | renesanční pevnost / radnice s hodinovou věží  |
| `base-3` | betonový bunkr s pytli písku a radarem         |
| `base-4` | futuristická věž se svítícím jádrem a štítem   |

## 3. Věže (10, volitelně podstavce)

`turret-<věk>-<druh>.png`: jen **hlaveň / zbraň**, otočená doprava, výška **88 px**, šířka
do 160 px. Hra ji otáčí kolem bodu ve **25 % šířky zleva a v polovině výšky** (tam patří čep).
Volitelně `turret-<věk>-<druh>-base.png`: podstavec, výška 72 px, kotva dole uprostřed.

| Věk | druh 0 (levná) | druh 1 (drahá) |
| --- | -------------- | -------------- |
| 0   | prak           | kamenomet      |
| 1   | kuše           | balista        |
| 2   | malé dělo      | dělo           |
| 3   | kulomet        | raketomet      |
| 4   | laser          | iontové dělo   |

## 4. Zvláštní útoky a střely

| Soubor        | Co to je                                               | Velikost                                    |
| ------------- | ------------------------------------------------------ | ------------------------------------------- |
| `special-0`   | meteor s ohnivým ohonem (padá zprava shora šikmo dolů) | výška 160 px, střed obrázku = střed meteoru |
| `special-1`   | šíp padající hrotem dolů                               | výška 160 px, střed                         |
| `special-2`   | dělová koule s doutnákem                               | výška 160 px, střed                         |
| `special-3`   | letecká bomba hrotem dolů                              | výška 160 px, střed                         |
| `special-4`   | paprsek orbitálního laseru (svislý, svítící)           | výška 1680 px, kotva dole uprostřed         |
| `plane`       | bombardér, letí doprava                                | výška 160 px                                |
| `shot-stone`  | kámen z praku                                          | výška 40 px                                 |
| `shot-arrow`  | šíp, hrot doprava                                      | výška 32 px                                 |
| `shot-ball`   | dělová koule                                           | výška 40 px                                 |
| `shot-bullet` | kulka se stopou, doprava                               | výška 40 px                                 |
| `shot-shell`  | granát / raketa, doprava                               | výška 40 px                                 |
| `shot-laser`  | laserový výboj, doprava                                | výška 32 px                                 |

## 5. Ikony do spodní lišty (volitelné)

Dlaždice lišty jinak ukazují zmenšenou jednotku nebo věž. Hezčí jsou samostatné ikony,
čtvercové **256 × 256 px**, průhledné, motiv vycentrovaný s malým okrajem, světlo zleva:

| Soubor                     | Co to je                                                           |
| -------------------------- | ------------------------------------------------------------------ |
| `icon-unit-<věk>-<druh>`   | portrét jednotky v celé postavě (jako na návrhu „Šermíř“, „Rytíř“) |
| `icon-turret-<věk>-<druh>` | věž/obranný stroj (jako „Beran“, „Hradba“)                         |
| `icon-special-<věk>`       | symbol zvláštního útoku                                            |

## 6. Pozadí (5)

`bg-<věk>.png`, přesně **3600 × 800 px** (celé bojiště 2×). Pozadí se posouvá vodorovně,
takže musí být široké celé.

- **Země / cesta:** horní hrana cesty, po které chodí jednotky, je na **y = 672 px**.
  Pod ní (672–800) je cesta s kameny a trávou na okraji, nad ní krajina.
- **Volná místa:** levých a pravých **~500 px** nech u země volných, stojí tam základny.
- **Žádné postavy** a nic výrazného přímo na cestě.
- **Hloubka:** popředí (keře, kameny na okraji cesty), střední plán (stromy, mlýn, ploty),
  pozadí (hory, hrad, obloha s mraky), jako na návrhu.

| Soubor | Krajina                                                            |
| ------ | ------------------------------------------------------------------ |
| `bg-0` | pravěk: oranžové nebe, sopka s lávou, palmy, kostry dinosaurů      |
| `bg-1` | středověk: modré nebe, hrady na kopcích, větrný mlýn, jehličnany   |
| `bg-2` | renesance: zlatavé nebe, městečko s červenými střechami a kostelem |
| `bg-3` | moderní doba: šedé zakouřené nebe, rozbité město, ostnatý drát     |
| `bg-4` | budoucnost: noční fialové nebe, planeta, neonové mrakodrapy        |

## Doporučené pořadí

1. Pravěk: `unit-0-0`, `unit-0-1`, `unit-0-2`, `base-0`, `bg-0` (hned je vidět celý první věk).
2. Středověk: `unit-1-*`, `base-1`, `bg-1`.
3. Renesance, moderní doba a budoucnost stejně.
4. Věže, zvláštní útoky a střely.

K tomu jsou referenční listy se současnou kresbou ve stejném měřítku (`ref-age0.png` … a
`ref-bg-0.png` …): červený rámeček ukazuje výšku obrázku, červená tečka kotvu.
