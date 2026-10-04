# Architecture

## Overview

```
                         Browser                                         Cloudflare Worker
┌──────────────────────────────────────────────────┐      ┌──────────────────────────────────────┐
│ SvelteKit UI (apps/web)                          │      │ SvelteKit server (apps/web)          │
│  overlay · auth UI · settings · subtitles        │ HTTP │  hooks: env → db → Better Auth       │
│                                                  │◄────►│  load/routes orchestrate:            │
│ <GameCanvas> mounts ─► GameWorld (packages/game) │      │   simulation (pure) + database       │
│                        three.js + Rapier + rAF   │      └──────────────────┬───────────────────┘
└──────────────────────────────────────────────────┘                         │ TCP (postgres.js)
                                                                  ┌──────────▼──────────┐
                                                                  │ PostgreSQL          │
                                                                  │ Docker / Neon       │
                                                                  │ (via Hyperdrive)    │
                                                                  └─────────────────────┘
```

Three layers with strict responsibilities:

| Layer          | Package               | Decides?                        | Knows about      |
| -------------- | --------------------- | ------------------------------- | ---------------- |
| AI (reasoning) | `packages/ai`         | proposes high-level decisions   | shared contracts |
| Simulation     | `packages/simulation` | **yes** - validates, owns state | shared contracts |
| Game engine    | `packages/game`       | no - visualizes                 | three.js, Rapier |

The LLM proposes, the simulation disposes, the engine shows.

## Packages

### `apps/web` - SvelteKit shell

Routes, auth endpoints, UI overlay, PWA, server orchestration. Owns **no** complex simulation
logic and **no** raw SQL. `GameCanvas.svelte` creates a `GameWorld` in `onMount` and disposes
it on destroy; Svelte never renders game objects and never drives frames.

Server request lifecycle (`src/hooks.server.ts`):

1. `getServerEnv()` - validated config (zod), cached.
2. `acquireDatabase()` - per-request client on Workers, shared pool in dev.
3. `createAuth(db, env)` - Better Auth instance bound to that client.
4. `/api/auth/*` → Better Auth handler (routed by path).
5. Otherwise resolve session → `locals.user` → route.
6. Release the DB client (`ctx.waitUntil(close)` on Workers).

### `packages/shared` - contracts

zod schemas and types used across packages: `AwarenessState`, `CharacterAction` (closed
union), `WorldSummary` (API shape), `STARTER_ROOM_TARGETS` (target ids + affordances: what can be
done where - the simulation decides with these, the renderer owns their positions). Only things that are genuinely shared. Not a utils bin.

### `packages/simulation` - the life engine (headless)

Pure TypeScript, no DOM, no three.js, no DB. Testable with plain Vitest.
Iteration 0 provides:

- `planCatchUp(lastSimulatedAt, now)` - splits the offline gap into fixed steps, never rewinds
  time, and skips beyond a maximum window (default 14 days) so huge absences stay cheap.
- `createInitialCharacter(seed)` - deterministic starter identity.

### `packages/game` - rendering & physics

`GameWorld` owns `WebGLRenderer`, scene, camera, lights, `PhysicsWorld` (Rapier) and the
`requestAnimationFrame` loop with a fixed-timestep accumulator (physics at 60 Hz, render
interpolated). Exposes imperative primitives (later `walkTo`, `lookAt`, `playAnimation`,
`applyImpulse`). Gravity is mutable so phone tilt can drive it later. Pauses when the tab is
hidden. Since Iteration 1 it renders the starter flat (`src/room/`): procedural furniture,
real-time sky in the back window, lighting, static colliders, and `frameRoom(aspect)` which keeps
the whole room in view from ultrawide desktops to portrait phones (higher angle on phones).

### `packages/ai` - reasoning interfaces

`CharacterAI.decide(context) → CharacterDecision`. `characterDecisionSchema` is the only output
an LLM may produce (speech, emotion, intensity, one `CharacterAction`, optional goal slug).
`parseCharacterDecision` validates untrusted output and returns `null` on garbage.
`MockCharacterAI` until Ollama arrives (Iteration 4). STT/TTS/vision interfaces will be added
when they get a consumer.

### `packages/database` - persistence

Drizzle schema (`src/schema`), SQL migrations (`drizzle/`), `createDatabase()` (postgres.js),
and repositories (`worlds.ts`). The only package that talks SQL.

## Data model (Iteration 0)

```
user (Better Auth, isAnonymous) 1 ── 1 world 1 ── 1 character
  └─ session, account, verification (Better Auth)
```

- `world`: `id uuid`, `user_id` (unique, FK → user, cascade), `last_simulated_at`, timestamps.
- `character`: `id uuid`, `world_id` (unique, FK → world, cascade), `name`, timestamps.

Uniqueness constraints make `getOrCreateWorldForUser` race-safe and guarantee one world per
user. Columns are added only when an iteration needs them.

## Anonymous players & account linking

Anonymous players are real Better Auth users (`anonymous` plugin, `isAnonymous = true`), so a
world always has exactly one owner id. This replaces the `userId | anonymousId` pair from the
original brief - same capability, one ownership path, no dual-key edge cases.

```
first visit (JS) ─► signIn.anonymous() ─► session cookie ─► load() getOrCreateWorldForUser
                                                         (bots without JS create nothing)
"Sign in with Google" (while anonymous)
  ─► OAuth ─► Better Auth creates/links account ─► onLinkAccount
       ─► transferWorldOwnership(anon → account)  (single transaction)
       ─► anonymous user deleted by the plugin
```

`transferWorldOwnership` outcomes:

| Situation                            | Result             | Effect                                                                            |
| ------------------------------------ | ------------------ | --------------------------------------------------------------------------------- |
| Account has no world                 | `transferred`      | Anonymous world now belongs to the account                                        |
| Account already owns a world         | `target-has-world` | Account's existing world wins; anonymous world is removed with the anonymous user |
| Anonymous user never created a world | `no-source-world`  | Nothing                                                                           |

A second world is never created for an account.

## Time & offline simulation

The world is not simulated per frame while closed. On load, the server computes a catch-up
plan from `world.last_simulated_at` to now and advances the clock (only forward, guarded in
SQL). Later iterations apply per-step simulation (needs, activities, events) inside the same
loop and persist resulting events.

## Cloudflare specifics

- `@sveltejs/adapter-cloudflare` → Worker + static assets. `nodejs_compat` for postgres.js.
- Workers forbid sharing I/O objects across requests → per-request DB client (`max: 1`) closed
  via `waitUntil`. **Hyperdrive** (binding `HYPERDRIVE`, query caching off) provides pooling and fast connects -
  direct TCP from Workers to Neon timed out in production. When bound, its connection
  string wins over `DATABASE_URL`. Neon is reached over plain Postgres TCP - no Neon-specific
  driver, so any Postgres works.
- three.js/Rapier are excluded from the server bundle (`import.meta.env.SSR` guard). Worker
  bundle ≈ 560 KiB gzip (limit 3 MiB on the free plan). CI runs `wrangler deploy --dry-run`.
- Later: R2 for assets, Durable Objects for realtime/multiplayer.

## Security

- Secrets only via environment (`.env` locally, `wrangler secret` / GitHub secrets in prod).
- Env validated with zod at startup; errors never echo values.
- Better Auth: secure cookies on HTTPS, trusted origins, built-in CSRF/origin checks.
- CSP via SvelteKit (nonces), `frame-ancestors 'none'`, `object-src 'none'`,
  `'wasm-unsafe-eval'` only for Rapier.
- All persistent decisions are made server-side; the client renders and requests.
- LLM output (later) is validated against a closed schema - never executed.

## Decisions log

| Date       | Decision                                                    | Why                                                                                                    |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 2026-10-04 | SvelteKit **2.x** (not 3.0)                                 | 3.0 released days ago; Better Auth declares support for Kit 2 only. Upgrade tracked as an issue.       |
| 2026-10-04 | TypeScript 5.9 (not 7)                                      | typescript-eslint and svelte-check don't support TS 7 yet.                                             |
| 2026-10-04 | postgres.js over TCP, not Neon HTTP driver                  | Works with Docker, Neon, Hyperdrive, any Postgres; real transactions; no lock-in.                      |
| 2026-10-04 | Anonymous users are Better Auth users; `world.user_id` only | One ownership path; linking = ownership transfer.                                                      |
| 2026-10-04 | Account world wins on link conflict                         | Existing long-lived save is more valuable than a fresh anonymous one. Revisit if players complain.     |
| 2026-10-04 | Anonymous user created client-side after hydration          | Crawlers/bots never mint users or worlds.                                                              |
| 2026-10-04 | Internal packages consumed as TS source (no build step)     | Vite/Vitest/drizzle-kit all read TS directly; zero build orchestration.                                |
| 2026-10-04 | E2E runs the built Worker in workerd (`wrangler dev`)       | Tests the real production runtime, not the Node dev server.                                            |
| 2026-10-04 | `@dimforge/rapier3d-compat` (inlined WASM)                  | No bundler WASM plugin needed; lazy-loaded on the client only.                                         |
| 2026-10-04 | Hyperdrive in front of Neon, **caching disabled**           | Direct Worker→Neon TCP timed out; cached reads would serve stale game state (e.g. world just created). |
