# Architecture

## Overview

```
                    Browser                                        Cloudflare Worker
┌───────────────────────────────────────────┐        ┌──────────────────────────────────────┐
│ Hub  /            (SvelteKit page)        │  HTTP  │ SvelteKit server (apps/web)          │
│  catalogue · stats · language · account   │◄──────►│  hooks: env → db → Better Auth       │
│                                           │        │  /api/auth/*  (Google OAuth)         │
│ Game /games/<id>/ (static HTML/CSS/JS)    │        │  /api/health                         │
│  own logic + localStorage save            │        │  /api/driftwood/*, /api/duel/* → DOs │
└───────────────────────────────────────────┘        └──────────────────┬───────────────────┘
          localStorage: gamecenter.lang,                                │ TCP (postgres.js)
          gamecenter.stats.<id>, <game save>                 ┌──────────▼──────────┐
                                                             │ PostgreSQL          │
                                                             │ Docker / Neon       │
                                                             │ (via Hyperdrive)    │
                                                             └─────────────────────┘
```

## Pieces

### Hub - `apps/web`

- `src/routes/+page.svelte` - the hub (Svelte 5 runes). Reads stats from `localStorage` in
  `onMount`, draws the aurora background and game covers on canvases, handles ←/→/Enter,
  launches a game by navigating to its `path`.
- `src/routes/+page.server.ts` - passes only `{ user: { name, image } | null, googleEnabled }`
  to the page. Nothing secret is serialised.
- `src/lib/games/registry.ts` - typed catalogue (`GAMES`, `CATEGORIES`, `cover()`).
- `src/lib/auth-client.ts` - Better Auth browser client (`signIn.social`, `signOut`).
- `src/routes/index.html/+server.ts` - 308 to `/`, because games link back via
  `../../index.html`.
- `static/service-worker.js` - kill switch for the old app's service worker: clears caches,
  unregisters, reloads open tabs once.
- `static/tajne/ruzek/` - a hidden single page at `/tajne/ruzek` (a trainer's site, plain
  HTML + `assets/`, kept as its author wrote it): nothing links to it and it is `noindex`. It is open without the site password (gate `OPEN_PATHS`), so it can
  be shown to friends; files it needs go under `/tajne/ruzek/`.
- `static/wiki/<id>/` - game wikis: self-contained guide pages for games we play with friends
  (not games of the library), kept as their authors wrote them, behind the site password like
  the games. `src/lib/wikis.ts` lists them on the hub's "Game wikis" tab (`/#wiki`) with their
  pages per language (the card opens the hub's language) and outside links (e.g. the Fandom
  wiki); a wiki links back to `/#wiki`. Like every static file they get no SvelteKit CSP. The
  English Gray Zone Warfare guide (`static/wiki/gzw/en/`) is generated from the Czech one by
  `node apps/web/scripts/wiki-gzw-en.mjs`, which fails and names the text when the authors change
  a Czech sentence it has no translation for.

### Games - `apps/web/static/games/<id>/`

Shipped as static assets, untouched by the build. The contract with the hub is browser-only:

| Key                     | Owner       | Content                                                     |
| ----------------------- | ----------- | ----------------------------------------------------------- |
| `gamecenter.lang`       | hub + games | `cs` or `en`                                                |
| `gamecenter.stats.<id>` | game        | `{ playTime (s), lastPlayed (ms), progress (0..1), stats }` |
| e.g. `voidborn.save.v1` | game        | the game's own save - never read or migrated by the hub     |

Games must work on phones too: VOIDBORN reads touch input (a floating stick anywhere on the
play field + a dash button, in `js/main.js` `Input`) next to keyboard and gamepad; its logic,
balance and save format are unchanged.

### Site gate - `apps/web/src/worker`

The deployed Worker entry (`wrangler.jsonc` `main`) is `src/worker/index.ts`: it checks the
site password and only then hands the request to the SvelteKit worker built by
adapter-cloudflare (aliased as `sveltekit-worker`; the adapter writes it to the paths in
`wrangler.sveltekit.jsonc`). `assets.run_worker_first` routes static files through it too,
so the static games are protected. A correct password sets an HTTP-only cookie (30 days)
signed with the password hash.

### Live players - `presence`

Every game page and the hub (as game `hub`) load `static/games/presence.js`. While the tab is
visible it POSTs `/api/presence` (`{ client, game, visitor }`: a random per-tab id and a random
per-browser id kept in `gamecenter.visitor`) every 25 s and says goodbye on
`pagehide` / when hidden (`sendBeacon`). The server records the tab in the `presence` table,
with `user_id` taken from the Better Auth session (null = anonymous), and prunes rows older than
60 s. `GET /api/presence` returns, per game, distinct signed-in players and anonymous tabs; the
hub polls it every 15 s. The visitor id is upserted into the `visitor` table (first / last seen,
the account once signed in), so the response also carries `site`: people online now (distinct
account, else browser), visitors in the last 30 days and in total, and the number of accounts.
No personal data beyond the user link; presence rows live for a minute.

### Background music - `static/games/music.js`

The hub and every game page load `music.js` (after `sync.js`). The synced key
`gamecenter.music` (`{ src: 'game' | 'own' | 'off', url, vol, side }`) chooses the music:

- `game` (default): VOIDBORN, STARSPIRE, DRIFTWOOD and Vesnička (`vesnicka/js/hudba.js`: two
  tracks per season and two for the night in `vesnicka/hudba/`, loudness-matched to −18 LUFS, played
  where the shared 5-minute season clock stands and cross-faded) play their own music; the puzzle games get
  a generated playlist (`music-gen.js`, Web Audio, four tracks per game seeded by its id, the
  same for everyone; no audio files).
- `own`: a YouTube, SoundCloud or Spotify link plays in a small player card on every page
  (the services' official embeds; their players must stay visible while playing, hiding the
  card pauses). The hub CSP allows their scripts and frames.
- `off`: only the games' sound effects.

Games mute only their music bus while `GCMusic.gameMusic` is false (`GCMusic.on` tells them
when it changes), so sound effects always play over the music. One music volume (`vol`, shown
as `GCMusic.level`, 1 at the default 70 %) applies to every game, and all music is matched to
the same loudness (about -48 dBFS RMS at the default, measured; below the games' effects): the
generated styles have per-style gains, the action games a factor on their music bus. Browsers start sound only after
a click, so a page continues the playlist with the first touch; the place in the playlist is
kept per tab (`sessionStorage`).

### Server - `apps/web/src/lib/server` and `hooks.server.ts`

Request lifecycle:

1. `getServerEnv()` - validated config (zod), cached.
2. Canonical host redirect (`www` → apex).
3. `acquireDatabase()` - per-request client on Workers, shared pool in dev.
4. `createAuth(db, env)` - Better Auth bound to that client (Google provider when configured).
5. `/api/auth/*` → Better Auth handler (routed by path).
6. Otherwise resolve the session → `locals.user` → route.
7. Release the DB client (`waitUntil(close)` on Workers).

### `packages/database`

Drizzle schema (`src/schema`), SQL migrations (`drizzle/`), `createDatabase()` (postgres.js)
and `checkDatabase()`. The only package that talks SQL. Today the schema is just Better Auth's
`user`, `session`, `account`, `verification`.

## Secrets

- Production secrets (`DATABASE_URL` via Hyperdrive, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_*`)
  exist only in the Worker env, uploaded by the Deploy workflow from the GitHub `production`
  environment. Locally they live in `.env` (git-ignored).
- They are read only in `$lib/server` (SvelteKit refuses to import it from client code) and
  never returned from `load` or an API route. The browser gets the session cookie only
  (HTTP-only, secure).
- Env errors never echo values.

## Security

- CSP (SvelteKit, nonces) on hub pages: scripts only from self; styles/fonts from self and
  Google Fonts; images from self and Google avatars; `connect-src 'self'`;
  `frame-ancestors 'none'`. Static game pages are plain assets without this header.
- Site gate: one shared password (PBKDF2 hash as a Worker secret, HMAC-signed pass cookie,
  1 s delay per wrong attempt, `noindex`); fails closed when the hash is missing.
- Better Auth: secure cookies on HTTPS, trusted origins, CSRF/origin checks.
- Future server routes for games validate input with zod and act only for `locals.user`.

## Cloudflare specifics

- `@sveltejs/adapter-cloudflare` → Worker + static assets. `nodejs_compat` for postgres.js.
- Per-request DB client (`max: 1`); **Hyperdrive** (binding `HYPERDRIVE`, caching off) pools
  connections to Neon. Plain Postgres TCP - any Postgres works.
- Static assets are revalidated by default (ETag), so a deploy is visible on the next load.

## Puzzle games - `apps/web/static/games/puzzle-kit`

Puzzle games share one static kit (`kit.js`, `kit.css`); a game supplies only a seeded
generator and its board (`Kit.game({...})`). The kit provides the shell and everything meant to
keep players coming back for weeks:

- **Daily puzzle**: seeded by date (`hash(id:daily:YYYY-MM-DD)`), same for every player, harder
  towards the weekend; streaks, a month calendar and a 60-day archive.
- **Star Path**: 120 seeded levels in six chapters, 1–3 stars (clean solve within par time).
- **Free play**: endless puzzles per difficulty. Ranks from XP, kit + game achievements, stats.
- **Weekly quests** shared by all puzzle games and **stardust** for themes
  (`gamecenter.puzzles` in localStorage).
- Storage: `<id>.save.v1` (game), `gamecenter.puzzles` (shared), `gamecenter.stats.<id>` (hub).
- Parts a game can switch off: `Kit.game({ daily: false, path: false, quests: false, perfect: false })`
  hides the daily puzzle, the Star Path, the weekly quests and the no-mistake achievements (cards,
  achievements, leaderboard tabs and hub stats follow). `versus: true` adds a **Score** card: who
  beat whom, from online results (by nickname) and `api.versus(id, name, 'w' | 'l' | 'd')` against
  computer players, kept in the game's save (`vs`). `freeTitle` / `freeNote` rename free play
  (Lodě: "Proti počítači"). `palette: { a, b, c, bg }` fixes the colours for a game with its own
  artwork (Lodě: night sea) and hides the theme picker there.
- Wording: `Kit.game({ wording })` picks the shell's words: `solve` (default: a puzzle is
  solved), `win` (board, card and two-player games: a game is won) or `play` (arcade and relax
  games: a run is finished). The catalogue's `statLabels` match (`labels`, `winLabels`, `doneLabels`).

Generators guarantee a unique solution (Sudoku: digging with a solution counter, graded by a
logic solver; Nonograms: line solver; Kakuro: combination solver with repair; Miny: no-guess
fields checked by a constraint solver; Mahjong: deals built by removing random free pairs in reverse; Šachy: mate-in-1/2 puzzles
found by `mateIn` search in positions from random lively games, opponent is an alpha-beta engine
in a Web Worker (`sachy/ai-worker.js`); Piškvorky: threat rules plus a VCF search); where uniqueness would need
guessing, they reveal a cell or line up front. Arcade puzzles (Pulsar, Fúze) end with
`api.failed({ score })` or `api.solved({ score, stars })`; the kit keeps best scores and lets a
game pause its timer.

## DRIFTWOOD multiplayer - `apps/web/src/worker/driftwood`

Shared worlds for up to 8 players, served by the Worker entry (behind the site gate) because
SvelteKit cannot hand a WebSocket to a Durable Object.

- `DriftwoodRoom` (SQLite-backed Durable Object, one per world, named by its 6-letter code):
  hibernatable WebSockets; keeps seed, mode, clock, harvested nodes (with regrow time),
  structures, items lying on the ground (taken first-come, first-served) and the last 40 chat lines, so a world can be re-joined later. Relays player
  states (~10/s) and chat. The longest-connected player is the host and keeps the clock.
- `DriftwoodLobby` (one instance): worlds somebody is playing in right now.
- `api.ts`: `GET/POST /api/driftwood/rooms`, `GET /api/driftwood/rooms/:code`,
  `GET /api/driftwood/rooms/:code/ws`. Creating and connecting are same-origin only.
- `protocol.ts`: every client message is parsed and bounded (sizes, coordinates, ids, text);
  unit-tested.
- Client: `static/games/driftwood/js/mp.js` wraps the game's own functions (world build,
  harvesting, building, saving, menus) without changing the game logic. Nickname in
  `driftwood.nick`, the player's own state per world in `driftwood.mp.<code>`; the solo save
  `driftwood.save.v1` is never touched by a multiplayer session.
- Per player (not shared): inventory, health, animals, skills, quests, explored map, chest
  contents and garden crops (kept in `driftwood.mp.<code>`), arrows in flight and fishing.
  Time is shared (sleeping moves it for everybody) and so is the weather, which is derived
  from the seed and the clock. New items and structures need no server change: the protocol
  only checks the shape of ids. `pnpm dev` has no Durable Objects - use `pnpm preview`.

## DRIFTWOOD game - `static/games/driftwood`

Plain scripts on Three.js r128 (`vendor/three.min.js`), loaded in order by `index.html`:
`data.js` (items, recipes, animals, skills, achievements), `world.js` (terrain, water and
vegetation shaders, sky, structures), `fx.js` (fire, smoke, fireflies, rain, weather),
`entities.js` (animals including the bear, arrows), `player.js` (movement, needs, fishing,
the bow, building), `quests.js` (4 story chapters, daily tasks, skills, ruins / wrecks /
bottles, explored map), `audio.js` (procedural sound and generative music), `ui.js`, `main.js`
(loop, saving), `drops.js`, `mp.js`. The solo save stays `driftwood.save.v1`: new fields are
merged into old saves, finished story steps are recognised from the old flags. E2E drives the
real game in a software WebGL renderer (`e2e/driftwood.test.ts`).

## HOLLOW SUN prototype - `static/games/hollowsun`

The P0 prototype of _Echoes of the Hollow Sun_, an isometric dark fantasy ARPG designed in a
separate Game Design Bible (a claude.ai artifact). Plain scripts on PlayCanvas 2.23.3
(`vendor/playcanvas.min.js`, MIT, licence beside it), loaded in order by `index.html`:
`data.js` (generated from the Bible – Ash Knight, three skills, two Act I enemies, balance
constants; never edited by hand), `core.js` (the Bible's formulas: character stats, weapon,
`computeHit` with conversion, crit, armour/resistance and hit chance), `sim.js` (combat at a
fixed 30 Hz with a seeded RNG and commands as input, no rendering - the GDD's multiplayer
preparation) and `game.js` (PlayCanvas scene, isometric camera, click-to-move or WASD, telegraphs,
hit-stop, HUD, a 20 s benchmark with 50 enemies). Save `hollowsun.save.v1`, stats
`gamecenter.stats.hollowsun`. `src/lib/games/hollowsun.test.ts` checks the core against values
exported from the Bible (`hollowsun.fixtures.json`) and runs the simulation headless;
`e2e/hollowsun.test.ts` drives the real page in a software WebGL renderer.

Loot and inventory (P1): `data.js` also carries the Bible's item data (`loot`: slots, rarities,
bases, affixes with tiers, uniques, loot tables) and loot constants (`rarW`, `dropChance`,
`smartLoot`, `pityUnique`). `core.js` ports the Bible's `G.rng`, `G.rollRarity`, `G.genItem`,
`G.itemMods` and `G.weaponOf`, and `calcChar`/`computeHit` take the equipped items; with the starter
mace they give exactly the P0 numbers. In `sim.js` a killed enemy rolls a drop with its own seeded
RNG (`seed#loot#n`), so drops are deterministic. The drop uses the enemy's drop chance and rarity
weights, the unique pity counter, and an item level equal to the monster level, with smart loot for
the Ash Knight. The benchmark and the input test drop nothing. A drop is picked up with the
`pickup` command when the player is close. `invCommand` equips, takes off or discards; it checks
class, tier level, attribute requirements, two-handed weapons and the two ring slots, then
recomputes the character. The inventory (I) pauses the game and shows a tooltip comparing the item
with what is equipped. The save moves from version 1 to 2 (`gear`, `sinceU`) via
`HSim.migrateSave`; unknown items are dropped on load (`sanitizeGear`).
`src/lib/games/hollowsun-loot.test.ts` checks item generation, item stats and the character with
gear against `hollowsun.loot.fixtures.json` (exported from the Bible), plus drops, equipping and the
save migration.

Character progression (P1): the arena character starts at level 1 and gains XP per kill by the
Bible (`F.monsterXp` × `F.xpPenalty` for the level gap, `F.xpToNext` per level, cap `levelCap`). A
level-up heals, gives 3 attribute points (`freeAttrPerLevel`) and unlocks skills by their `req`;
skill levels follow `F.maxSkillLevel`. Points go to attributes through `invCommand` (`alloc` or
`autoAlloc`, which splits like the Bible's reference character: 2/3 to the primary attribute, the
rest to VIT), so item attribute requirements matter. The Bible sets no enemy level for the
prototype arena; the rule here is player level − 1 + every second wave, capped at the end of Act I
(12, from the exported Act I areas), with brutes only from their level range (5+). Enemy armour,
evasion and damage use each enemy's own level. The Ash Knight's six Act I skills are on the bar:

- Cleave, Searing Slam and Ember Charge (from P0).
- Brand Strike: a single-target generator with 50 % fire conversion. Its brand gives +10 % increased
  Fire damage for 4 s (an exact `computeHit` with `fireInc` + 0.1), and Searing Slam's burn on a
  branded target lasts 6 s.
- Ashen Bulwark: a barrier of (15 % + 1 % × skill level) Max HP and +20 % Armor for 6 s.
- Cry of the Pyre: a 7 m pull, −15 % enemy damage for 6 s and +40 Cinders.

The benchmark and the input test keep the P0 setup: a fixed level 8 with the reference allocation.
The save moves to version 3 (`char`: level, xp, alloc, points). Players with a P0/P1 save get the
level 8 character they effectively had, so their gear stays usable. The progression fixtures
(`progress` in the loot fixtures) check the XP formulas, the character with its own allocation and
the Bulwark buff, the barrier and the new skills against the Bible.

Act I enemies (P1): besides the Ashen Thrall and the Smoldering Brute, the arena now has two more
Act I types from the Bible:

- Cinder Hound: fast (6 m/s), evasion 40, packs of 3–5 from wave 2. It bites (0.9×) and leaps
  6 m (1.4×, 0.5 s telegraph) along a line from the side, and circles the player while the leap
  is on cooldown.
- Charred Bowman: from its Bible level 3. It keeps 12–16 m, backs off when approached and needs a
  clear line. It shoots arrows (1.1×, 20 m) and a fire arrow (1.6×, cd 6 s) as projectiles; pillars,
  the anvil, the kilns and the arena wall stop them, and the dodge's i-frames avoid them.
- Kiln Acolyte (caster, from level 4; Burnt Orchard has none, the Great Kiln many): stays 9–13 m
  behind the front line. It throws a slow fireball (1.3×) as a projectile, raises 2 Ashen Thralls
  (cd 12 s, at most 4 alive per acolyte; raised Thralls drop no loot) and wards the most wounded
  ally within 10 m with a barrier of 30 % of its max HP for 6 s (cd 10 s). The ward absorbs hits
  and burns before HP. The raise and the ward are casts with a glow instead of a danger telegraph,
  and any hit during the cast interrupts it (the Bible's weakness "interrupt"; the cooldown still
  runs). Drops follow `lt_caster` (normal × 1.1). Arena waves add up to 3 acolytes from wave 3.

The bite's telegraph, the cooldowns, the draw time and the arrow speed are prototype values marked
in the exported `attacks`. Waves mix Thralls (4 + 2 × wave), the hound pack, Bowmen and Brutes,
each from the first level of its Bible range. The benchmark keeps its P0 Thrall/Brute mix. Fixtures
check the hound and bowman stats and the skills against them; simulation tests cover the wave mix,
the leap, the bowman's range and arrows stopped by pillars.

Music (P1): `js/hudba.js` plays the Bible's adaptive layers (Audio direction):

- the main menu,
- the Act I region as explore and combat layers, which switch with a 2 s crossfade (combat while
  an enemy is within 11 m or within 4 s of a hit),
- the Kiln Warden as three phase layers,
- stingers for level up, a unique drop, death and the boss kill, which duck the music by 6 dB.

The layers of one group are loops of the same length started together, so a crossfade stays on the
beat. The benchmark, the input test and the asset test play no music. It follows `GCMusic.gameMusic`
and `GCMusic.level` like the other action games.

`scripts/hollowsun-music.mjs` (`pnpm --filter @windowling/web hollowsun:music [folder]`) makes the
tracks from downloaded sources (Suno, allowed for final music by D32) listed in
`scripts/hollowsun-music.json`. It cuts loops to whole bars (`bars` × 4 beats at `bpm`), normalises
them to −16 LUFS / −1 dBTP (two-pass loudnorm) and encodes Opus 128 kb/s into
`static/games/hollowsun/assets/music/` with a manifest. `hollowsun-music.test.ts` checks the files
(Opus, loudness, loop length, one length per group, the Suno link D32 asks for). Without a manifest
the game stays silent, so `hollowsun` joins `OWN_MUSIC` in `static/games/music.js` together with the
first tracks.

Act I campaign (P1): "Kampaň: Act I" in the menu plays the Bible's Act I main quests: Ashfields
(L1–3, q1_01), Burnt Orchard (3–5), the Chapel of Embers crypt on two floors (4–5 and 5–6, q1_02,
reached from the Ashfields), Ironbound Tollgate (5–7), Charcoal Woods (6–9, ends q1_03), the Great
Kiln (9–11), then the Kiln Warden in the Heart of the Kiln (L12, the boss mode, q1_04). A campaign
step is an area id, a further floor is `id:2`. Each new area borders one already visited (on foot,
or by Lantern back to it).

- Layout: each zone comes from the Bible's own dungeon generator. `js/dungeon.js` is G.genDungeon
  (14 steps), exported unchanged by the Bible exporter and checked by fixtures. `js/world.js` turns
  it into geometry (cells 18 m apart, room units of 2.5 m, 4 m corridors, L-shaped where rooms are
  not neighbours).
- Content: a Lantern at the entrance, locks with their keys in side rooms, chests, the gate to the
  next area in the last main room, and the generator's enemy budget with types from the area's list.
  Enemies are at the area's levels by depth and elites use the Bible's elite multipliers.
- Whispers: each zone holds its area's whispers (G.WHISPERS, exported with the speaker's name) in
  the deepest free side room, on the last floor; touching one shows the line and collects it in
  the save (`whispers`). "Poslední úder" follows the Kiln Warden's defeat.
- Quests: the step that ends a main quest grants its Bible XP when the gate is reached (q1_01 300,
  q1_02 1,400, q1_03 3,200); q1_02's magic ring goes straight to the inventory. The prototype has no
  gold or passive points.
- Gallows Hill (secret, L8): a sealed entrance in a Charcoal Woods side room. The Rusty Gallows Key
  drops from a Smoldering Brute in the campaign with 4 % (the Bible's unlock), rolled per brute with
  its own seed so other rolls stay the same. With the key the entrance offers the area; it ends
  with a unique chest next to the gate and leads back to the Charcoal Woods without moving the
  campaign on (`gallowsKey`, `gallowsDone` in the save).
- Cinderhold (the hub, `inst: fixed`): a fixed town from `buildTown` – a plaza with extinguished
  furnaces, the archive (Teodor), the forge (Brannoc), the Compact barracks (Oduin), a Lantern at the
  entrance and the gate north. The campaign visits it after the Ashfields and again after the crypt
  (step `a1_cinderhold#2`); the gate stays shut until the player has met the NPCs whose quest scenes
  are still unseen (`needTalk`), then leads straight on without a summary panel.
- Story: `HSWorld.STORY` maps every Act I scene of the Bible's G.DIALOGS (exported with the
  speakers from G.NPCS) to a trigger – a step's start, an NPC, five kills in the Ashfields, the boss
  start and his defeat. Talks pause the game; Ysolde's lines and lines during a fight run as
  subtitles without a pause (length as for VO: words / 2.5 + 0.5 s). Whisper entries in a scene show
  the whisper card. Seen scenes, choices and flags go to `story` in the save.
- Choices: at the Tollgate, paying the toll of 500 gold or fighting the champion,
  an elite Smoldering Brute at the area cap who drops a rare weapon (`HSim.champion`); after the
  Kiln Warden, the Kiln Shard choice sets `w_kiln_absorbed` or `w_kiln_returned` for Act II.
- Simulation (`mode: 'act1'`): enemies sleep until they see the player (the Bible's detection
  ranges) and alarm allies within 8 m. Movement slides along the walls and steps round corners;
  walls block sight and arrows.
- Death respawns at the last Lantern (D08: no XP loss). A chest drops two items with elite-pack
  rarity (prototype value).
- The renderer builds floors, walls (where the space next to an edge is not walkable), doors that
  open with their key, the objects, a minimap and the area's quest objective. It only creates enemy
  visuals within 38 m of the player.
- The save moves to version 4 (`act1`: the zone reached, done, deaths), and the progress goes to the
  hub stats.

The generator parameters per zone are prototype values (`ZONE_P` in `world.js`); an XP estimate
reaches level 11 at the end of the Great Kiln, matching the Bible's area levels. On the autopilot a
zone takes about 3–11 minutes. `hollowsun-world.test.ts` checks that the zones follow the Bible's
main quests and links, the levels and objects, that walking each route picks up the keys and reaches the gate, and
the respawn, the quests, the crypt floors, the Gallows Hill key and entrance, the scenes against
the Bible dialogs, the Cinderhold gate and the champion; E2E clears a zone, reads the opening scene,
meets Teodor in Cinderhold and finishes Act I with the boss and the Kiln Shard choice.

Campaign balance (P1): `pnpm --filter @windowling/web hollowsun:playthrough [seed] [steps]` runs
the whole Act I campaign headless (the Bible's P1 tests "E2E playthrough bot" and "TTK telemetry").
The bot follows each zone's route, fights what catches up with it and hunts Bowmen and Acolytes,
collects loot and gold, equips better gear (Cleave DPS × EHP), spends points and passives, and
prints per step the time, level, kills, deaths, gold, hits to kill a Thrall of the area's level
(Bible target 2–4) and enemy hits survived (target ≥ 20). It is a gauge, not a player: it does not
dodge the boss's mechanics. The first runs led to these changes:

- Raised Thralls give no XP and an Acolyte keeps at most two alive: the bot farmed them from L10 to
  L13 in the Great Kiln, which took 21 minutes.
- Great Kiln density 2 → 1.7 and the crypt floors 1.5 / 1.75 → 1.25 / 1.5 (the crypt, all Bowmen and
  Acolytes, had the most deaths).
- The autopilot (also used by tests and the benchmark) checks a skill's real cost (it used to stand
  on "no resources" once costs grew), finds its way back to the route through the room graph,
  attacks only enemies it can walk to, puts the Acolyte first; shoved enemies stay on walkable
  ground (one could end up inside a wall where nothing could hit it).

A run now takes about 42–47 minutes of game time (the Bible's slice: 45–60 minutes for a person),
with 1.5–2.8 hits to kill and 30–60 hits survived. The bot reaches the Kiln Warden at L9–10 (boss
L12) and beat him (in about 3.5 minutes) in one of three runs; this gap is left for the playtest
telemetry (D31).

Gold and passive skills (P1):

- Gold drops by the Bible's loot tables (`lt_normal`/`lt_caster` 6 %, `lt_elite` 20 %, `lt_rare`
  50 %) as 2–5 × L, rolled per enemy with its own seed; the Kiln Warden drops 20 × L. Piles are
  picked up by walking over them (1.6 m). Quests add their Bible gold. Gold pays the Tollgate toll
  and the merchant buys items in Cinderhold (Shift + click: Common 1 / Magic 3 / Rare 10 / Unique
  25 × L). The save keeps `gold`; the exporter adds `econ` from G.BAL.econ and G.LOOT.
- The Ash Knight's six class passives (G.SKILLS, `k: 'passive'`) take points from D04
  (`F.passivePoints`, one per level plus quest points ≈ L / 6), each up to its max rank and from its
  level. Their stats go into `calcChar` as modifiers; Kindling Fury adds Cinders on every hit and
  Unquenched adds more damage under 35 % HP. Respec costs `F.respecPoint` (D13: free up to L12). The character
  save keeps `passives`, cleaned to the points of its level.
- Voices (P1): the game is voiced in English; Czech players hear the English voice with Czech text as
  subtitles. The Bible holds the English translation of Act I (G.DIALOGS_EN, G.WHISPERS_EN,
  G.NAMES_EN), so with the English language the dialogs, choices, scene titles and whispers show in
  English. data.js lists every voiced line (D.vo: the dialogs' lines including choice branches and
  the seven whispers) with a Bible-style file name (`AU_vo_q1_02_03`, `AU_vo_wh_05`), its role and
  both texts. The game plays a line's recording from `assets/vo/en` when it shows the line (talks,
  subtitles, whisper cards; subtitles last at least as long as the recording) and stays text only
  without one. Czech voices can be added later in `assets/vo/cs`: the game uses them for Czech when
  that manifest has lines. Recordings come from `scripts/hollowsun-vo.mjs` (see development.md).
- Damage types (P1): the core computes the player's resistances like the Bible's calcChar –
  (resAll + res_<type>) × 100 plus the act penalty (none in Act I), capped at 75 % (+ max res) and
  the hard cap 90 % – and shows fire resistance in the inventory. Enemy hits are physical unless the
  ability is a fire one: the Ember Wisp's explosion, the Bowman's fire arrow, the Acolyte's fireball
  and the Kiln Warden's kiln fire, Bellows Breath, burning ground and Quench Slam steam (Hammerfall
  and Anvil Toss stay physical). Following the Bible, armor mitigates physical damage only; fire is
  cut by fire resistance alone (negative resistance raises it). Fire hits on the player show in orange.
  The playthrough barely moved (45–47 minutes, similar deaths), since armor only takes 14–20 % in
  Act I.
- Forge (P1): talking to Brannoc in Cinderhold opens her forge with the Bible's smith operations
  from G.CRAFT and their prices from G.CRAFT_COST – Salvage (Common 0–1 / Magic 1–2 Ember Shard, Rare
  2–4 Hollow Dust, Unique 10 Dust + 20 % Sunmote), Reforge Magic, Imbue (Magic with 2 affixes →
  Rare with 3–4), Reforge Rare (price × 1.15 per earlier reforge), Temper (values within the tier)
  and Unravel (Rare with ≥ 4 affixes loses one). Sockets, runes, Sunmote and Echo operations belong
  to later stations. Ember Shards drop by the loot tables (`lt_normal` 2 %, `lt_caster` 3 %,
  `lt_elite` 10 %) and the Kiln Warden drops Hollow Dust; both are picked up like gold and saved in
  `cur`. Affixes for crafting come from `HS.addAffixes`, the same roll genItem uses, so the item
  parity with the Bible stays. Items remember their item level (`ilvl`, set on drop); older items
  use the character's level within their tier.

Boss (P1): "Boss: Kiln Warden" is a separate mode (`mode: 'boss'`). It uses the player's character
and gear in the boss arena from the Bible: a round forge Ø 30 m, a central anvil as cover and three
kilns on the edge. The boss comes from the exported Bible data (`bosses.bo_kiln`: level 12, HP ×60,
damage ×2.2, resistances, phases, abilities, mechanics, enrage, unique pool) and `refEnemy` gives
its stats.

- Phases by HP: 100–60 %, 60–25 % (3 s immune, the kilns ignite, smouldering ground shrinks the
  arena to Ø 16 m) and 25–0 % (−30 % armour, +25 % speed).
- Abilities, gated by phase and on their own cooldowns:
  - Hammerfall: a 3 m circle in front of the boss.
  - Bellows Breath: a 60° × 10 m cone for 2 s.
  - Anvil Toss: a 4 m circle on the player.
  - Stoke the Kilns: 90° × 12 m cones from the kilns.
  - Molten Spawn: four Ember Wisps, the Bible's suicide swarm.
  - Quench Slam: the whole arena except three steam circles.
- The anvil blocks the cones (a line test). Standing by a burning kiln for 1.5 s quenches it.
- After 240 s the boss enrages: the kilns burn for good and damage is +50 %.
- The kill drops 3 Magic + 2 Rare plus a unique from the boss pool (25 %, 100 % on the first kill).
  The first kill also pays the XP of quest q1_04. The renderer slows to 30 % for 4 s.

Where the Bible gives no number, the prototype picks one and marks it in `sim.js` (`BOSS`): the
steam circle radius, the smouldering-ground burn, the boss speed, and the boss XP of 10 normal
enemies of its level. The save keeps `bossKills` and `bossBest`. `hollowsun-loot.test.ts` checks the
boss and wisp stats and the skills against the boss (also with phase 3 armour) against the Bible,
plus the phases, immunity, Quench Slam, quenching, enrage and the boss loot in the simulation.

Asset pipeline (P0): `pnpm --filter @windowling/web hollowsun:assets` runs
`scripts/blender/hollowsun_assets.py` in Blender without a window (`scripts/hollowsun-assets.mjs`
finds it through `BLENDER`, the PATH or the default install folders) and exports raw GLB files:
a dungeon module `DM_crypt_rS_X_a` (bevelled walls, door sockets, vertex-colour AO) and a
placeholder `CH_ak_body` whose LOD1/LOD2 come from LOD0 through Decimate. gltfpack (the
`gltfpack` npm package, meshoptimizer) then quantizes and compresses them
(`EXT_meshopt_compression` + `KHR_mesh_quantization`, `-cc -kn -km`: named nodes and materials
kept) into `assets/`, together with `assets/manifest.json` (raw and compressed sizes). The GLBs
are committed, so CI needs no Blender. PlayCanvas cannot decode Meshopt itself: the game's
"Asset test" mode loads the GLBs as container assets whose `bufferView.processAsync` hook
decodes them with meshoptimizer's decoder (`vendor/meshopt_decoder.js`, MIT), switches LODs by
camera distance and shows the sockets.
`src/lib/games/hollowsun-assets.test.ts` decodes every GLB the same way and holds it to the
Bible's asset rules: compression (every buffer view Meshopt, at most half the raw size, textures
only as KTX2 via `KHR_texture_basisu`), naming, triangle budget, at most 2 materials per mesh,
LOD0–2, footprint on the 2 m grid (through the dequantizing node transform), door sockets,
vertex-colour AO and glTF integrity. The P0 assets have no textures yet; the npm gltfpack cannot
encode KTX2 (the native gltfpack build with Basis Universal can, `-tc`), and the game will also
need the Basis transcoder for them.
`CH_ak_body` is skinned to the shared humanoid rig `RIG_hero` (Bible D16: one skeleton for every
class, at most 65 bones; 20 now, rigid placeholder skinning) and carries four placeholder clips
`AN_hero_idle|run|attack|death` sampled at 30 FPS; the attack has root motion (0.6 m forward on
the `root` bone), the loops stay in place and close seamlessly. The weapon socket `socket_hand_R`
is a child of the `hand_R` joint. The "Asset test" mode plays the clips through PlayCanvas' anim
component (keys 1–4) and has a crowd test: 50 skinned, animated characters (LOD1) for 5 s with the
average FPS and p95 frame time. The validator checks the skin (bone budget, complete weights, valid
joints, one skin for all LODs), the clip names, 30 FPS sampling, seamless loops and root motion.
The arena and the benchmark use the same knight for the player and the enemies (thrall and brute get
their own materials, the brute is scaled up) once the GLB has loaded; until then, or with `?gray` for
a comparison, the grey boxes stay. The simulation still owns positions and timing: the clips follow
its state (attack slowed or sped up so the swing lands at the end of the telegraph or in the
player's hit window, run while moving, death played out before the body is removed), the attack's
root motion is pinned to the spot, LODs switch by camera distance (18 m / 35 m) and the player's
blade sits in `socket_hand_R`.

P0 acceptance tools: "Test vstupu" measures input latency – from the input event's timestamp to the
end of rendering the frame where the knight reacts (`frameend`) and to the start of the next frame
(≈ on screen); 20 samples, average and p95 (target < 50 ms p95). Only inputs the knight can act on
right away count (not during a strike, dodge, stun or hit-stop, where commands queue on purpose). A
fresh input runs the next simulation step in the very next frame, borrowing the time so the rate
stays 30 steps/s and the command stream stays deterministic; a click that is pressed and released
between two steps is kept for the next step. "Ohodnotit boj" (also after a game over) asks four
1–5 questions for the combat feel test (target ≥ 4/5 from 5 players), keeps the ratings in the
game's save and copies them as text to the clipboard for collecting, together with the graphics
adapter, the last benchmark and the last input test, so testers on other hardware send one paste.
The benchmark also records GPU time per frame (WebGL2 `EXT_disjoint_timer_query_webgl2` around
rendering; measure without the frame cap, since the GPU clocks down at 60 FPS) and CPU time per frame
(PlayCanvas `stats.frame` update + render).

## Vesnička - `static/games/vesnicka`

An idle game outside the puzzle kit, plain scripts loaded by `index.html`: `data.js` (trades,
upgrades, creatures, perks, achievements, number formatting), `econ.js` (state, income, buying,
offline earnings, prestige, daily tasks, save; no DOM, so the balance can be simulated in Node),
`scene.js` (the village on a 2D canvas: parallax panorama, seasons, day and night by the
player's clock, buildings that grow with their count, creatures), `audio.js` (Web Audio
effects; the music is the generated playlist from `music.js`), `ui.js` and `main.js` (loop,
saving every 5 s and on leaving). Save `vesnicka.save.v1`, stats `gamecenter.stats.vesnicka`.
Time away is paid out when the game starts or the tab returns: `Econ.advance` integrates
income piecewise between season changes and spell ends, up to the offline cap. Seasons come
from the wall clock (`floor(now / 5 min) % 4`), so all players share them. `Econ.bestBuy`
ranks every purchase by payback time (average income over the four seasons in closed form);
the ⚡ best-buy button and the steward (bought for legends, which are then spent; the
chronicle counts legends earned in total) both use it, and the steward also buys while the
player is away (`Econ.offline` steps through the time in up to 240 slices). The save's `lb`
holds the leaderboard values: legends on `best:score` and `free:<category>:score` for fortune,
best income and apprentices (as log10 × 1000), buildings, creatures, taps, generations and
achievements (values are capped below the server's 10^10).
`NEWS` in `data.js` feeds the "what's new" popover, shown once per version (`seen.news`).

The guild (`CECH` in `data.js`, `S.cech` in the save) is a chain of generators: each of the
8 ranks trains the rank below (`a` amounts with fractions, `b` bought, which sets prices and
seals), and the apprentices multiply all income by `(1 + pct)^log10(1 + apprentices)`. Over a
stretch with constant rates the amounts are an exact polynomial in time (`cechEvolve`), so
`Econ.advance` evolves the guild exactly per segment and integrates the income over the growing
multiplier with Simpson's rule; a big step and many small ones agree to 10^-4 %. Higher ranks
unlock with legends. `bestBuy` ranks guild purchases by the time the extra income repays the
price (`cechPayback`, searched over the polynomial), so the ⚡ button and the steward buy for the
guild too. The balance was tuned with a Node bot playing 21 days (an active and a casual
profile) against the version without the guild: the base game multiplies any income bonus many
times over by climbing the trades faster, so the guild starts at a few percent per tenfold and
grows with the chronicle.

## Online puzzles - `apps/web/src/worker/duel`

Every puzzle can be played online, served by the Worker entry like DRIFTWOOD multiplayer.

- `DuelRoom` (SQLite-backed Durable Object, one per room, 5-letter code). Two kinds:
  - **turn** (Šachy, Piškvorky, Tanky, Červíci, Dáma, Lodě, Člověče, Osadníci): two seats, the room keeps the move list and accepts a move
    only from the seat to move (`seatToMove`: colours swap every round). It also records the
    result (game end reported by the clients, resignation, draw by agreement, or a win claimed
    when the opponent has been gone 60 s) and handles rematches. The clients check the rules
    of the game; the room checks whose turn it is.
  - **race** (all other puzzles): up to 8 players. The host starts a round, the room hands
    out a fresh seed and a start time (3.5 s countdown) and records progress and finish times
    by its own clock.
    A player is identified by a private per-browser id (`gamecenter.pid`), so a reload or a
    dropped connection rejoins the same seat. Chat keeps the last 30 lines. An empty room
    deletes itself after a day (alarm).
- `DuelLobby` (one instance): open rooms waiting for players, per game.
- `api.ts`: `GET /api/duel/rooms?game=<id>`, `POST /api/duel/rooms`,
  `GET /api/duel/rooms/:code`, `GET /api/duel/rooms/:code/ws` (same-origin only).
- `protocol.ts`: parses and bounds every client message; unit-tested.
- Client: the puzzle kit (online card, room with code/link and chat, play bar). A game opts in
  with `online: { kind: 'turn' | 'race', diffs? }` in `Kit.game`. Turn games get
  `opts.net` (`side`, `moves`, `send`, `onMove`, `end`, `resign`; a move is up to 320 characters and a
  game's moves up to 100 kB; Tanky sends the aim and the impact points, Červíci the whole turn result
  (explosions and every worm's position and health), so both terrains stay identical; Lodě keeps each fleet on its own device, a move carries the result of the opponent's last shot plus a new shot; Člověče rolls the die from the round seed and the turn number and sends only which pieces moved; Osadníci derives the island, the dice, the card deck and every robbery from the round seed, and a move is the list of one player's actions until play passes to the other, e.g. `D,T03,s30,E`); race games implement
  `progress()` (0..1) and use the normal `api.solved` / `api.failed`. Results go to
  `<id>.save.v1` (`stats.online`), the room link is `?duel=<code>`.

## Cloud saves and nicknames

Signed-in players keep their progress in their account; anonymous play is unchanged.

- Games keep writing `localStorage` and are not changed. `static/games/sync.js` (first
  script in every game page's `<head>` and in `app.html`) wraps `Storage.setItem/removeItem`
  to time-stamp writes of the synced keys (`SYNC_KEY_RE` in `src/lib/cloud.ts`: `gamecenter.lang`,
  `gamecenter.puzzles`, `gamecenter.stats.<id>`, `<id>.save.v1`, `driftwood.*`; not
  `gamecenter.pid`). Its bookkeeping is in `gamecenter.sync`.
- `GET/PUT /api/sync` (401 when signed out): table `game_save (user_id, key, data, t)`, one row
  per key with the value exactly as stored; `data` null marks a removed key. The server keeps
  the newest write per key (`t`, capped at server time + 5 min); 1 MB per value, 8 MB and
  200 keys per account.
- Merge on every page load, every 90 s and when a tab is shown again; changes are flushed when
  a tab is hidden or closed. Three-way per key: the account's value wins when it changed since
  this device last synced and the device did not write the key later. The first sync of a
  device with an account (progress made before signing in) keeps, per game, the side with more
  play time. Writes a game makes on start, before the account answered, do not count as new.
- A game page opened straight from a link reloads once when the account had newer progress
  (writes are frozen during the reload so the old in-memory state is not saved).
- `player_profile (user_id, nickname)`: picked in the hub after the first sign-in
  (`GET/POST /api/profile`, unique regardless of case). The hub copies it into
  `gamecenter.puzzles` (online puzzles) and `driftwood.nick`.

## Leaderboards

- Table `score (user_id, game, board, value)`: a signed-in player's best result per board.
  A board (`BOARD_RE` in `src/lib/cloud.ts`) only groups comparable results:
  `daily:<date>:time` (the same daily puzzle), `level:<n>:time` (the same Path level),
  `free:<diff>:time|score` (free play only in modes with fixed rules: `metric: 'score'` or
  `ranked: true` diffs), `online:wins`, `best:survive|floor|days` (VOIDBORN, STARSPIRE,
  DRIFTWOOD records), `best:score` (Vesnička's legends) and `total:played` (play time of every
  game). Time is better when lower,
  everything else when higher.
- The puzzle kit keeps its best result per board in its save (`lb`); `sync.js` sends changed
  results of all games (`lb`, the action games' records, `playTime`) to `POST /api/scores`
  after each sync. Results come from the browser, so the server only range-checks them. It
  skips single results it does not take (a game removed from the library, an unknown board)
  and stores the rest: browsers keep the saves of removed games for years.
- `GET /api/scores?game&board` is public: the top players (only players with a nickname), the
  asking player's place and the count. `GET /api/scores?game&player=<nickname>` returns all
  boards of one player in a game (Vesnička compares two players with it). Shown in every puzzle (Žebříčky, and from the result of a
  daily or level) and in the center for the selected game (record board or play time).

## Future: multiplayer

- **More multiplayer**: the same pattern as DRIFTWOOD (a Durable Object per room); identity
  from the Better Auth session and results written to Postgres when a game needs them.

## Decisions log

| Date       | Decision                                                | Why                                                                                         |
| ---------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 2026-10-04 | SvelteKit 2.x, TypeScript 5.9                           | Better Auth and tooling support.                                                            |
| 2026-10-04 | postgres.js over TCP, not Neon HTTP driver              | Works with Docker, Neon, Hyperdrive, any Postgres; real transactions; no lock-in.           |
| 2026-10-04 | E2E runs the built Worker in workerd (`wrangler dev`)   | Tests the real production runtime.                                                          |
| 2026-10-04 | Hyperdrive in front of Neon, caching disabled           | Direct Worker→Neon TCP timed out; cached reads would be stale.                              |
| 2026-10-22 | Life simulation replaced by Windowling Game Center      | Product pivot; DB wiped, old packages removed (history in git).                             |
| 2026-10-22 | Hub in SvelteKit, games as untouched static pages       | Server-only secrets and a path to DB/multiplayer, without rewriting games.                  |
| 2026-10-22 | Google-only Better Auth, no anonymous users             | Anonymous play needs no account; localStorage holds progress until cloud saves.             |
| 2026-10-22 | One shared site password in the Worker entry            | Invite-only for now; must also cover static games, which bypass SvelteKit hooks.            |
| 2026-10-22 | Kill-switch service worker instead of a caching one     | Old SW would keep serving the removed app; games have no versioned assets for precaching.   |
| 2026-10-22 | DRIFTWOOD multiplayer in Durable Objects (Worker entry) | WebSockets need a DO; SQLite-backed DOs are on the free plan; no DB needed for world state. |
| 2026-10-23 | Puzzle games on one shared static kit                   | Daily/streak/levels/quests once for all puzzles; games stay static and self-contained.      |
| 2026-10-23 | Online puzzles: one generic room DO for turns and races | One server for 13 games; the room enforces turn order and timing, the games keep rules.     |
| 2026-10-23 | Cloud saves mirror localStorage keys, newest write wins | Games stay untouched; one generic sync script for all games; per-key time stamps.           |
| 2026-11-04 | HOLLOW SUN on PlayCanvas, vendored like Three.js        | Engine chosen in the GDD (D09); no build step, self-contained static game, MIT licence.     |
| 2026-10-23 | Leaderboards per comparable board only                  | Fair rankings: same daily puzzle, same level, same rules; client-reported, range-checked.   |
