# Věky válek: zadání pro GPT (generování obrázků)

Prompty jsou anglicky (generátory jim rozumí nejlépe). Postup:

1. Do každé konverzace přilož **`veky-style.png`** (náhled obrazovky) jako vzor stylu.
2. Na začátek vlož **STYLE BLOCK** (stejný pro všechny obrázky, kvůli jednotnému stylu).
3. Pak vlož prompt konkrétního assetu.
4. Generuj s **průhledným pozadím** (u GPT: „transparent background“, formát PNG).
   Pozadí krajiny (`bg-*`) průhledná nejsou.
5. Hotový obrázek mi pošli s názvem souboru z tabulky. **Velikost neřeš**, zmenším, ořežu
   a umístím ho sám. Důležitý je jen směr, celá postava a průhlednost.

Tip: když se jednotky jednoho věku generují v jedné konverzaci po sobě, drží se stejný styl.
Když výsledek „uteče“ (jiný styl, špatný směr), napiš: _„Same style as before, facing right,
full body, transparent background.“_

## STYLE BLOCK (vždy na začátek)

```
Game art asset for a 2D side-view lane-battle strategy game in the style of the attached
screenshot: polished painterly fantasy mobile-strategy art, rich hand-painted textures
(stone, wood, metal, cloth), soft shading and volume, subtle dark outline, warm light from
the upper left, saturated but natural colours. Semi-realistic "chibi-ish" proportions
(head about 1/5 of the body height), very readable at small size.
Strict side view (profile), the subject faces RIGHT. Single subject only, centered, the whole
subject fully visible, nothing cropped. Transparent background, no ground, no cast shadow,
no text, no frame, no UI. The player's team colour is royal blue (#3d7bff) with gold trim:
use it on banners, tabards, shields, saddle cloths and stripes.
```

## 1. Jednotky

Doplňkový text ke každé jednotce: _„Full body, standing on an invisible ground line at the
bottom edge, mid-stride walking pose, weapon ready.“_

| Soubor     | Prompt (za STYLE BLOCK)                                                                                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unit-0-0` | Stone Age caveman warrior with a big knotted wooden club, fur loincloth and fur shoulder wrap, wild brown hair and beard, blue cloth belt.                                                                                         |
| `unit-0-1` | Stone Age slinger with a leather sling spinning a stone, fur tunic, feather and blue headband, lean build.                                                                                                                         |
| `unit-0-2` | Green tyrannosaurus walking to the right, a caveman rider SITTING on its back on a blue cloth saddle, rider holds a stone-tipped spear forward. Whole dinosaur and rider visible.                                                  |
| `unit-1-0` | Medieval swordsman in chainmail and steel helmet, blue tabard with a gold cross, round-top blue heater shield with gold cross, short sword.                                                                                        |
| `unit-1-1` | Medieval archer in a green hood and leather armour, longbow drawn, quiver on the back, small blue sash.                                                                                                                            |
| `unit-1-2` | Medieval knight in full plate armour with a plume, riding a brown warhorse in a blue caparison with gold trim, lance pointed forward, small blue pennant on the lance. Whole horse and rider visible, rider SITTING in the saddle. |
| `unit-2-0` | Renaissance duelist (musketeer era) with a rapier, wide-brimmed hat with a white feather, blue doublet with gold buttons and a short blue cape.                                                                                    |
| `unit-2-1` | Renaissance musketeer firing a long matchlock musket, tricorn hat, blue coat with white cross belts, white trousers, black boots.                                                                                                  |
| `unit-2-2` | Renaissance bronze cannon on a wooden carriage with two big spoked wheels, a gunner in a blue coat standing behind it with a rammer.                                                                                               |
| `unit-3-0` | WW2-era infantry soldier with a combat knife, olive camouflage uniform, round helmet with netting, blue armband.                                                                                                                   |
| `unit-3-1` | WW2-era rifleman aiming a rifle, olive camouflage uniform, helmet, backpack, blue armband.                                                                                                                                         |
| `unit-3-2` | Olive-green battle tank with camouflage, long gun barrel pointing right, a small blue emblem with the number 07 on the turret.                                                                                                     |
| `unit-4-0` | Sci-fi soldier in sleek white-and-steel power armour with a glowing visor, holding a glowing cyan energy sword, blue light stripes.                                                                                                |
| `unit-4-1` | Sci-fi soldier in dark blue power armour with a yellow visor, aiming a futuristic laser rifle with a cyan glow.                                                                                                                    |
| `unit-4-2` | Large bipedal combat mech robot, steel and dark blue plating, glowing cyan core in the chest, a big arm cannon pointing right, blue light stripes.                                                                                 |

Volitelně stejné jednotky za **soupeře**: totéž, jen místo modré **crimson red (#e8383a)
with dark iron trim** a název s koncovkou `-red` (např. `unit-1-2-red`). Pořád otočené doprava,
otočím je sám.

## 2. Základny

Doplněk: _„A large fortified base building, side view, facing right (its gate on the right
side), standing on the bottom edge, with space on its roof/walls for three small defensive
turrets, blue banners with a gold cross.“_

| Soubor   | Prompt                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base-0` | A Stone Age cave dwelling in a big rock, a wooden palisade of sharpened stakes, skulls, a campfire by the entrance, a blue hide banner on a pole. |
| `base-1` | A medieval stone castle keep with battlements, a wooden gate with iron studs, blue banners with gold crosses, torches by the gate.                |
| `base-2` | A Renaissance fortress with brick walls, a white clock tower with a blue roof, round gun ports, blue flag.                                        |
| `base-3` | A WW2-era concrete bunker with sandbags, a radar dish, a machine-gun slit, a blue flag.                                                           |
| `base-4` | A futuristic sci-fi tower of dark metal with a glowing cyan energy core and a faint energy shield dome, blue light stripes.                       |

## 3. Věže (hlaveň/zbraň)

Doplněk: _„Only the weapon part of a small defensive turret, side view, barrel or business
end pointing RIGHT, no stand, the pivot point near the left third.“_

| Soubor       | Prompt                                                  |
| ------------ | ------------------------------------------------------- |
| `turret-0-0` | A wooden sling launcher on a forked branch.             |
| `turret-0-1` | A small wooden rock-throwing catapult arm with a stone. |
| `turret-1-0` | A heavy medieval crossbow.                              |
| `turret-1-1` | A wooden ballista with a big bolt.                      |
| `turret-2-0` | A short bronze cannon barrel.                           |
| `turret-2-1` | A long bronze cannon barrel with ornaments.             |
| `turret-3-0` | A mounted machine gun.                                  |
| `turret-3-1` | A twin rocket launcher pod.                             |
| `turret-4-0` | A sleek sci-fi laser emitter with a cyan glow.          |
| `turret-4-1` | A large ion cannon with glowing coils.                  |

## 4. Ikony do spodní lišty (čtverec)

Doplněk: _„Square game UI icon, the object centered with a small margin, three-quarter view
is allowed, transparent background, same painterly style as the screenshot's bottom bar
icons.“_

- `icon-unit-<věk>-<druh>`: stejný popis jako jednotka (portrét v celé postavě).
- `icon-turret-<věk>-<druh>`: stejný popis jako věž, ale celá věž i s podstavcem.
- `icon-special-0` meteor in flames · `icon-special-1` bundle of falling arrows ·
  `icon-special-2` cannonball with a lit fuse · `icon-special-3` aerial bomb ·
  `icon-special-4` orbital laser satellite firing a cyan beam.

## 5. Zvláštní útoky, střely, letadlo

| Soubor        | Prompt (průhledné pozadí)                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `special-0`   | A flaming meteor falling diagonally down-left, fiery tail to the upper right.                     |
| `special-1`   | A single arrow falling point-down, white fletching.                                               |
| `special-2`   | A black iron cannonball with a lit sparking fuse.                                                 |
| `special-3`   | A WW2 aerial bomb falling nose-down.                                                              |
| `special-4`   | A vertical cyan orbital laser beam, tall and narrow, glowing, with an impact flare at the bottom. |
| `plane`       | A WW2 olive-green bomber plane flying to the right, side view, blue roundel.                      |
| `shot-stone`  | A small grey sling stone.                                                                         |
| `shot-arrow`  | An arrow flying right.                                                                            |
| `shot-ball`   | A small iron cannonball.                                                                          |
| `shot-bullet` | A bullet with a short yellow tracer streak, flying right.                                         |
| `shot-shell`  | A small rocket with a smoke trail, flying right.                                                  |
| `shot-laser`  | A short cyan laser bolt, flying right.                                                            |

## 6. Pozadí krajiny

Pozadí **není průhledné**. Generuj na šířku (např. 1536 × 1024). Bojiště je velmi široké,
proto stačí **1–3 navazující obrázky** stejné scény (já je spojím a prolnu).

Doplněk ke každému pozadí: _„Wide side-view landscape for a 2D lane-battle game, NO buildings
in the left and right fifth near the ground, NO characters. A flat dirt road runs
horizontally across the lower fifth of the image with grass edges and a few rocks; the
road surface must be clear and flat. Depth layers: foreground bushes and rocks at the road
edges, middle ground trees and props, distant mountains and sky with clouds.“_

| Soubor | Prompt                                                                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg-0` | Prehistoric world: orange sunset sky, a smoking volcano with lava streams, palm and fern trees, dinosaur skeleton bones by the road.                                    |
| `bg-1` | Medieval countryside as in the screenshot: blue sky with big clouds, blue mountains, a castle on a distant hill, a windmill, pine forests, a stone bridge over a river. |
| `bg-2` | Renaissance era: golden afternoon sky, a small town with red-roofed houses and a church tower, vineyards and cypress trees.                                             |
| `bg-3` | WW2-era battlefield: grey smoky sky, ruined city buildings in the distance, barbed wire fences and craters by the road.                                                 |
| `bg-4` | Futuristic world: night purple sky with a ringed planet and stars, neon skyscrapers with cyan and pink lights, a glowing cyan road edge.                                |

## Pořadí

1. Středověk (je jako na náhledu): `bg-1`, `unit-1-0`, `unit-1-1`, `unit-1-2`, `base-1`.
2. Pravěk, renesance, moderní doba, budoucnost: vždy `bg`, tři jednotky, `base`.
3. Ikony, věže, zvláštní útoky a střely.
