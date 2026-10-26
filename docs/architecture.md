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

- `game` (default): VOIDBORN, STARSPIRE, DRIFTWOOD and Věky válek (`veky/hudba.js`, a generated
  march whose instruments change with each age) play their own music, Klávesy is music itself (the
  player's taps play the song: Salamander Grand Piano samples, CC BY 3.0, in
  `klavesy/assets/piano/` plus Web Audio drums and synths); the other puzzle games get
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

Generators guarantee a unique solution (Sudoku: digging with a solution counter, graded by a
logic solver; Nonograms: line solver; Kakuro: combination solver with repair; Souhvězdí: bridge
solver; Miny: no-guess fields checked by a constraint solver; Solitaire: Klondike deals proven
winnable by a search; Mahjong: deals built by removing random free pairs in reverse; Šachy: mate-in-1/2 puzzles
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
- Per player (not shared): inventory, health, animals. Time is shared (sleeping moves it
  for everybody). `pnpm dev` has no Durable Objects - use `pnpm preview`.

## Online puzzles - `apps/web/src/worker/duel`

Every puzzle can be played online, served by the Worker entry like DRIFTWOOD multiplayer.

- `DuelRoom` (SQLite-backed Durable Object, one per room, 5-letter code). Two kinds:
  - **turn** (Šachy, Piškvorky, Tanky, Červíci): two seats, the room keeps the move list and accepts a move
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
  (explosions and every worm's position and health), so both terrains stay identical); race games implement
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
  DRIFTWOOD records) and `total:played` (play time of every game). Time is better when lower,
  everything else when higher.
- The puzzle kit keeps its best result per board in its save (`lb`); `sync.js` sends changed
  results of all games (`lb`, the action games' records, `playTime`) to `POST /api/scores`
  after each sync. Results come from the browser, so the server only range-checks them.
- `GET /api/scores?game&board` is public: the top players (only players with a nickname), the
  asking player's place and the count. Shown in every puzzle (Žebříčky, and from the result of a
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
| 2026-10-23 | Leaderboards per comparable board only                  | Fair rankings: same daily puzzle, same level, same rules; client-reported, range-checked.   |
