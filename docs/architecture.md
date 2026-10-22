# Architecture

## Overview

```
                    Browser                                        Cloudflare Worker
┌───────────────────────────────────────────┐        ┌──────────────────────────────────────┐
│ Hub  /            (SvelteKit page)        │  HTTP  │ SvelteKit server (apps/web)          │
│  catalogue · stats · language · account   │◄──────►│  hooks: env → db → Better Auth       │
│                                           │        │  /api/auth/*  (Google OAuth)         │
│ Game /games/<id>/ (static HTML/CSS/JS)    │        │  /api/health                         │
│  own logic + localStorage save            │        │  (later) /api/games/*, multiplayer   │
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
- `src/lib/games/registry.ts` - typed catalogue (`GAMES`, `GAME_SLOTS`, `cover()`).
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

Every game page loads `static/games/presence.js`. While the tab is visible it POSTs
`/api/presence` (`{ client, game }`, a random per-tab id) every 25 s and says goodbye on
`pagehide` / when hidden (`sendBeacon`). The server records the tab in the `presence` table,
with `user_id` taken from the Better Auth session (null = anonymous), and prunes rows older than
60 s. `GET /api/presence` returns, per game, distinct signed-in players and anonymous tabs; the
hub polls it every 15 s. No personal data beyond the user link; rows live for a minute.

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

## Future: cloud saves and multiplayer

- **Cloud saves**: a `game_save (user_id, game_id, data jsonb, updated_at)` table and
  `GET/PUT /api/games/<id>/save`; games keep writing `localStorage`, the hub syncs it.
- **Multiplayer**: a Durable Object per room (WebSocket hibernation API) bound to the same
  Worker; the hub creates/joins rooms, identity from the Better Auth session, results written
  to Postgres at the end of a match. Games stay static pages that open a WebSocket to
  `/api/rooms/<id>`.

## Decisions log

| Date       | Decision                                              | Why                                                                                       |
| ---------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 2026-10-04 | SvelteKit 2.x, TypeScript 5.9                         | Better Auth and tooling support.                                                          |
| 2026-10-04 | postgres.js over TCP, not Neon HTTP driver            | Works with Docker, Neon, Hyperdrive, any Postgres; real transactions; no lock-in.         |
| 2026-10-04 | E2E runs the built Worker in workerd (`wrangler dev`) | Tests the real production runtime.                                                        |
| 2026-10-04 | Hyperdrive in front of Neon, caching disabled         | Direct Worker→Neon TCP timed out; cached reads would be stale.                            |
| 2026-10-22 | Life simulation replaced by Windowling Game Center    | Product pivot; DB wiped, old packages removed (history in git).                           |
| 2026-10-22 | Hub in SvelteKit, games as untouched static pages     | Server-only secrets and a path to DB/multiplayer, without rewriting games.                |
| 2026-10-22 | Google-only Better Auth, no anonymous users           | Anonymous play needs no account; localStorage holds progress until cloud saves.           |
| 2026-10-22 | One shared site password in the Worker entry          | Invite-only for now; must also cover static games, which bypass SvelteKit hooks.          |
| 2026-10-22 | Kill-switch service worker instead of a caching one   | Old SW would keep serving the removed app; games have no versioned assets for precaching. |
