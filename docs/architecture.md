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

- `planCatchUp(lastSimulatedAt, now)` - bounds the offline gap, never rewinds time, and skips
  beyond a maximum window (default 14 days) so huge absences stay cheap.
- `createInitialCharacter(seed)` - deterministic starter identity.
- `localTime(now, timeZone)` - local hour + weekday via `Intl` (same in Workers and browsers).
- `Needs` (`hunger`, `energy`, `mood`, all 0..1) + `applyNeeds(needs, activity, hours)`: per-hour
  rates per activity, mood drifts to a baseline and suffers from hunger/exhaustion.
- `chooseActivity` - the basic scheduler: utility scores from needs x local time x weekday
  (sleep at night, work on weekdays 9-17, meals, evening gaming) times a little randomness, plus
  duration rules (sleep until the morning, work never past 17:00, ...).
- `startLife` / `advanceLife(state, from, to, ctx)` - event-driven: applies needs over the current
  activity and decides again whenever one ends. The RNG is seeded with `world id + decision time`,
  so the same inputs always give the same life.
- `stepAwareness(awareness, input, ctx, rng)` - does the character know it is watched?
  Suspicion grows from presence and pointer movement scaled by the activity (idle notices, work
  and games absorb, sleep notices nothing) and fades when the player keeps still. A knock is
  unmistakable when awake; a sleeper stirs, and wakes on 3 knocks within 8 s. The character
  also looks up by itself now and then (idle ~1 min, work/games ~4-5 min, never asleep; more
  often once suspicious), so it can start the contact without any input - the player never has
  to do anything. If the player stays silent at the window it says so and goes back. On detection the
  character approaches (mood, activity, just woken) or ignores the player. Session state only.
- `wakeUp(life, at)` - interrupts sleep with a mood penalty; the scheduler decides what next.
- `actionForActivity` - activity -> `CharacterAction` (`idle` = no fixed place: the web layer then
  wanders using `nextAmbientAction`).

### `packages/game` - rendering & physics

`GameWorld` owns `WebGLRenderer`, scene, camera, lights, `PhysicsWorld` (Rapier) and the
`requestAnimationFrame` loop with a fixed-timestep accumulator (physics at 60 Hz, render
interpolated). Exposes imperative primitives (later `walkTo`, `lookAt`, `playAnimation`,
`applyImpulse`). Gravity is mutable so phone tilt can drive it later. Pauses when the tab is
hidden. Since Iteration 1 it renders the starter flat (`src/room/`): procedural furniture,
real-time sky in the back window, lighting, static colliders, and `frameRoom(aspect)` which keeps
the whole room in view from ultrawide desktops to portrait phones (higher angle on phones).

**Character (Iteration 1, `src/character/`):**

- `CharacterController` - pure logic (no three.js): turns a `CharacterAction` into steps
  (stand up → walk the path → turn → sit / lie down), validates it against the shared target
  affordances, never cuts a sit-down/stand-up in half, and emits `completed` / `rejected` events.
  Headless-tested, including "never walks through furniture between any two targets".
- `planPath` - straight line, or a detour through the room-centre hub when furniture is in the way.
- `Animator` - crossfading state machine (`idle`, `walk`, `sit`, `lie`) producing a `Pose`.
- `CharacterRig` - placeholder figure from primitives; only applies a transform + pose.

`GameWorld.perform(action)`, `setMood(mood)` and `onCharacterEvent()` are the only ways in.
Activities (`eat`, `work`, `play`) are animation layers on top of the posture (bowl, typing,
handheld); mood shows in walking pace and slumped shoulders. The renderer never decides.

**Who drives the character (Iteration 2):** the server owns the life. The page load catches the
world up and returns the current activity with its end time; `GameCanvas` performs the matching
action, and when the activity ends the page re-runs the load (`invalidateAll`) to get the next one.
No game loop runs on the server and the client never simulates authoritative state.

**Awareness (Iteration 3):** `apps/web/src/lib/watcher.ts` collects the player's signals
(presence ticks, pointer movement, knocks = clicks/taps on the glass) and feeds the simulation's
awareness model in the browser; `GameCanvas` turns its events into actions (glance =
`setAttention`, approach = `walkTo window` + `lookAtPlayer`, `wave`) and resumes the daily
activity afterwards. Knocking a sleeper awake calls `POST /api/world/wake`; the server checks
that the character is really asleep and persists the consequences.

### `packages/ai` - reasoning interfaces

`CharacterAI.decide(context) → CharacterDecision`. `characterDecisionSchema` is the only output
an LLM may produce (speech, emotion, intensity, one `CharacterAction`, optional goal slug).
`parseCharacterDecision` validates untrusted output and returns `null` on garbage.

- `buildMessages(context)` - only what matters now: who, local time, activity, needs as feelings
  (never numbers), awareness, the event, the last few lines, what the player said.
- `LlmCharacterAI(chatModel)` - asks for JSON (constrained decoding via `DECISION_JSON_SCHEMA`
  where supported), extracts and validates it, trims rambling; anything else → `MockCharacterAI`
  (canned reactions).
- `ChatModel` backends: `OpenAICompatibleChatModel` (Workers AI over REST in production, Ollama
  locally - any compatible API, no SDK, no lock-in); WebLLM in the browser (#31).

**Conversation flow (Iteration 4):** awareness → the character arrives at the window →
`Conversation.handle(event)` → `POST /api/ai/decide` (the server reads the character's state from
the database, checks the per-player daily quota in `ai_usage`, asks the model, and runs
`reviewAction` from the simulation) → `GameCanvas` shows the emotion, performs the reviewed
action and speaks through `TextToSpeech` (browser `speechSynthesis` for now, #32 tracks the
neural voice) with subtitles (`OFF | AUTO | ALWAYS`) and a mouth driven by word boundaries.

**Memory & relationship (Iteration 5):** `recordConversation` (database) is the single place
where conversations leave traces - relationship events (`visit`, `conversation` with the
emotion's valence, `silence`; `woken` from the wake endpoint) and memories (first sighting, what
the player said, anything the brain put in the closed `remember` field). Moments are pruned to
the 300 most valuable per world; facts are kept. Before each decision the server recalls a few
memories (`recall`: importance × recency × keyword relevance - plain Postgres, embeddings can
replace the relevance term later) and describes the relationship in words. On-device brains get
the same context from `POST /api/ai/context` and report back via `POST /api/ai/outcome`, so the
server stays the one source of truth. Affinity also feeds `chooseResponse`: a liked player gets
visits, an annoying one gets ignored.

**A richer day (Iteration 7):** the scheduler knows 14 activities. `shower` and `out` are
_away_: the character leaves through the door (`leave` action, controller `pass` steps, door
animation) and the rig is hidden until any next action brings it back in; awareness ignores the
player meanwhile. TV is "on our side of the glass" - only a flickering light reaches the sofa.
Music while listening is generated in the browser (`lib/sound/music.ts`, pentatonic pad + melody,
low-passed), started only after a user gesture and behind the "Sounds" switch.

**Emergent moments (Iteration 8):** `personalityFor(worldId)` gives every world a stable
character (competitive, exuberant, shy, chatty - never shown as numbers). Every ~20 s
`GameCanvas` asks `nextMoment(activity, needs, personality)` whether something small arises -
dancing to good music, singing while cooking, raging at a game, dozing off in front of the TV,
talking to itself, yawning. Nothing is scripted: each moment is a combination of state, and
most checks produce nothing. The game only plays them (`dance` action to `room.center`, other
moments as an animator overlay via `GameWorld.setMoment`); self-talk is subtitled in brackets.
While absorbed in a private moment the awareness model notices less. Detected meanwhile, the
character freezes, is embarrassed (more so when shy) and the conversation event is `caught`;
`recordConversation` remembers "The player caught me dancing." and the canned brain refuses to
talk about it later. `?debug&moment=dance` plays a moment right away.

**Phone sensors (Iteration 6):** `lib/sensors/motion.ts` (pure, tested) maps device orientation
relative to the pose at start to a gravity vector (clamped tilt, screen rotation aware) and
detects shakes (3 jolts > 12 m/s² within 1 s → intensity). `PhoneSensors` feeds
`GameWorld.setGravity` (loose bodies wake and roll; the camera leans) and `GameWorld.shake`
(impulses, camera jitter, character startle). The awareness model treats a shake as unmistakable
(a hard one wakes a sleeper); `POST /api/world/shake` remembers it (rate-limited), hurts the
relationship and wakes a sleeper with the cause remembered. Opt-in via Settings; iOS needs a
permission request from a tap; tilt and shake are separate switches.

**Ears:** `TalkButton` (tap to start / tap to stop, or hold; Space on desktop) appears while the character is at the window. After a
one-time consent it loads Whisper (`Xenova/whisper-tiny.en`, ~40 MB from the Hugging Face Hub,
cached by the browser) in a Web Worker via transformers.js. The ONNX runtime is the plain CPU
WASM build served from our own assets (Vite aliases `onnxruntime-web/webgpu` → `/wasm`: the
WebGPU build is 27 MB, over Cloudflare's 25 MiB asset limit) and is excluded from the service
worker precache. Audio is recorded with `MediaRecorder`, resampled to 16 kHz mono on the device
and never uploaded; only the recognised text goes to the brain. `onnxruntime-node` is removed
via a pnpm override (the Node backend is never used).

**On-device brain (#31):** `deviceBrain` runs Llama 3.2 1B (q4f16, or q4f32 without
`shader-f16`) with WebLLM in a Web Worker over WebGPU. It never downloads by itself: the player
starts the ~0.7 GB download in Settings; afterwards the weights stay in the browser cache and
the model is loaded into the GPU only when the character starts walking to the window
(`Brain.warmUp`). The compiled kernels (`static/webllm/*.wasm`, checksums in its README) are
served by us; only weights (data) come from the Hugging Face Hub. `CombinedBrain` picks the
device model (`auto` once downloaded, or `device`) and falls back to the cloud; device decisions
go through the same `reviewAction`.

### `packages/database` - persistence

Drizzle schema (`src/schema`), SQL migrations (`drizzle/`), `createDatabase()` (postgres.js),
and repositories (`worlds.ts`). The only package that talks SQL.

## Data model

```
user (Better Auth, isAnonymous) 1 ── 1 world 1 ── 1 character
  │                                     ├── * memory        (moments + facts)
  │                                     └── * relationship  (subject = player; NPCs later)
  ├─ session, account, verification (Better Auth)
  └─ * ai_usage (daily LLM quota)
```

- `world`: `id uuid`, `user_id` (unique, FK → user, cascade), `last_simulated_at`, `timezone`
  (IANA, device zone), timestamps.
- `character`: `id uuid`, `world_id` (unique, FK → world, cascade), `name`, life state
  (`hunger`, `energy`, `mood`, `activity`, `activity_started_at`, `activity_ends_at`), timestamps.

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

The world is not simulated per frame while closed. On load, the server runs `advanceLife` from
`world.last_simulated_at` to now (at most 14 days; older time is skipped) and persists the
character's needs and activity. The clock update is guarded in SQL (`last_simulated_at < new`)
and only the request that wins it writes the character, so concurrent loads never rewind.

The character lives on the **player's device clock** (#10): the browser stores its IANA zone in
the `wl_tz` cookie, the first load creates the world in that zone, and a later change of zone
updates `world.timezone` after the catch-up (missed time is lived on the old clock).

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

| Date       | Decision                                                          | Why                                                                                                                       |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-04 | SvelteKit **2.x** (not 3.0)                                       | 3.0 released days ago; Better Auth declares support for Kit 2 only. Upgrade tracked as an issue.                          |
| 2026-10-04 | TypeScript 5.9 (not 7)                                            | typescript-eslint and svelte-check don't support TS 7 yet.                                                                |
| 2026-10-04 | postgres.js over TCP, not Neon HTTP driver                        | Works with Docker, Neon, Hyperdrive, any Postgres; real transactions; no lock-in.                                         |
| 2026-10-04 | Anonymous users are Better Auth users; `world.user_id` only       | One ownership path; linking = ownership transfer.                                                                         |
| 2026-10-04 | Account world wins on link conflict                               | Existing long-lived save is more valuable than a fresh anonymous one. Revisit if players complain.                        |
| 2026-10-04 | Anonymous user created client-side after hydration                | Crawlers/bots never mint users or worlds.                                                                                 |
| 2026-10-04 | Internal packages consumed as TS source (no build step)           | Vite/Vitest/drizzle-kit all read TS directly; zero build orchestration.                                                   |
| 2026-10-04 | E2E runs the built Worker in workerd (`wrangler dev`)             | Tests the real production runtime, not the Node dev server.                                                               |
| 2026-10-04 | `@dimforge/rapier3d-compat` (inlined WASM)                        | No bundler WASM plugin needed; lazy-loaded on the client only.                                                            |
| 2026-10-04 | Hyperdrive in front of Neon, **caching disabled**                 | Direct Worker→Neon TCP timed out; cached reads would serve stale game state (e.g. world just created).                    |
| 2026-10-05 | Character lives in the device time zone (`wl_tz` cookie)          | Player's choice (#10): "3 AM for me is 3 AM for it", follows the player when travelling.                                  |
| 2026-10-05 | Server-authoritative life; client re-loads when an activity ends  | One source of truth, no client/server divergence; activities last minutes, so few requests.                               |
| 2026-10-05 | Awareness is browser session state; only waking is persisted      | Being watched exists only while someone looks; consequences (broken sleep) must survive.                                  |
| 2026-10-05 | Brain = on-device / cloud (OpenAI-compatible) / Ollama / canned   | Player's choice (#28). REST instead of the Workers AI binding: portable, and `wrangler dev`/E2E need no Cloudflare login. |
| 2026-10-05 | Browser `speechSynthesis` first, neural TTS later (#32)           | Local neural TTS needs GPL-3 espeak-ng and CDN-loaded runtimes; tracked to reach the best quality later.                  |
| 2026-10-05 | Whisper in the browser, CPU WASM, self-hosted runtime             | Voice stays on the device; no third-party CDN scripts; fits Cloudflare asset limits.                                      |
| 2026-10-05 | WebLLM kernels vendored in `static/webllm/`                       | No executable code from third-party hosts at runtime; pinned by checksum.                                                 |
| 2026-10-06 | Memory recall by importance × recency × keywords (no vectors yet) | Free, plain Postgres, testable; embeddings can replace the relevance term behind `recall`.                                |
