# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.
Read `docs/product.md` and `docs/architecture.md` before larger changes, and
`docs/art-direction.md` before modelling anything visible.

## What this is

Windowling is a persistent web life simulation. The player does not control a character -
they look through a window into the life of an autonomous one that keeps living when the app
is closed. North Star: _"I didn't open the app to make it live. I opened it to see what it's
doing."_ If a change weakens that feeling, question the change.

## Product principles

1. **Character is autonomous.** It has its own needs, preferences, moods and plans.
2. **Player does not directly control the character.** No "make it do X" buttons.
3. **World exists independently from the player.** Opening the app ≠ the character noticing.
4. **AI is not the simulation engine.** The LLM never runs the game loop.
5. **AI produces high-level decisions** - a closed schema (`characterDecisionSchema`), never code.
6. **Simulation validates decisions** against state before anything happens.
7. **Game engine visualizes state.** It renders; it does not decide.
8. **Prefer emergent systems over scripted dialogues.** Combine states, don't hardcode scenes.
9. **Show state through behaviour, not dashboards.** No `Hunger: 27%` in the UI.
10. **Real time matters.** 3 AM in the real world is 3 AM for the character.
11. **Persistent consequences matter.** Events are remembered and change what comes next.
12. **Player creates opportunities, character makes decisions.**

## Engineering principles

- Strict TypeScript everywhere. No `any`, no non-null assertions in production code.
- Simple architecture, explicit package boundaries, no premature abstractions or microservices.
- No vendor lock-in without a good reason (plain Postgres, standard OAuth, portable code).
- Every schema change ships with a Drizzle migration (`pnpm db:generate`). CI fails on drift.
- No secrets in the repo. Ever. Use `.env` locally, Wrangler/GitHub secrets in production.
- Test critical logic: simulation, contracts, data access, auth/world linking.
- Keep the renderer independent from the simulation, and the LLM independent from rendering.
- Free-first: no dependency on paid AI APIs; prefer local/open-source tooling.
- Implement only the current iteration (`docs/iterations.md`), but don't block future ones.

## Repository map

```
apps/web             SvelteKit app shell: routes, auth, UI overlay, server routes, PWA
packages/shared      Contracts only: zod schemas + types shared across packages
packages/simulation  Headless life simulation (time, catch-up, character state). Pure TS.
packages/game        Three.js renderer + Rapier physics + rAF loop. No game decisions.
packages/ai          AI interfaces, decision schema, mocks (real Ollama etc. later)
packages/database    Drizzle schema, migrations, client, repositories. The ONLY place with SQL.
docs/                Product, architecture, iterations, development
docker/              Local infrastructure (Postgres init scripts)
```

Dependency direction (enforced by ESLint `no-restricted-imports`):

```
apps/web ──► database ──► simulation ──► (nothing UI/DB)
   │    └──► game (lazy, browser only)
   └──────► shared ◄── ai, simulation
```

- `simulation`, `ai`, `shared` must not import three, rapier, svelte, or database code.
- `game` must not import database, ai or svelte.
- `apps/web` must not import `drizzle-orm`/`postgres` directly - use `@windowling/database`.
- Svelte never renders individual game objects and never drives frames. `GameCanvas.svelte`
  only mounts/unmounts `GameWorld`.

## Commands

```bash
pnpm install               # install
docker compose up -d       # local Postgres (+ windowling_test DB)
pnpm db:migrate            # apply migrations
pnpm dev                   # http://localhost:5173
pnpm check                 # lint + format:check + typecheck + test + build (run before pushing)
pnpm test                  # unit + DB integration tests (Vitest)
pnpm test:e2e              # Playwright against the built Worker in workerd
pnpm db:generate --name x  # create a migration after editing packages/database/src/schema
```

## Workflow

- Work from a GitHub issue in the current iteration's milestone.
- Branch from `master`: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`.
- Conventional Commits (`feat(simulation): add hunger decay`). PRs are squash-merged; the
  PR title must be a Conventional Commit (CI checks it). release-please derives versions.
- Run `pnpm check` before pushing. CI must be green before merge; `master` deploys to production.
- Update the relevant docs in the same PR when architecture, workflow or env vars change.

## Gotchas

- Cloudflare Workers: DB clients are per request (`acquireDatabase` in `apps/web/src/lib/server/db.ts`).
  Never cache I/O objects in module scope for production code paths.
- three.js / Rapier must stay out of the server bundle: `GameCanvas` guards the dynamic import
  with `import.meta.env.SSR`. Check `wrangler deploy --dry-run` size if you touch imports.
- `/api/auth/*` is routed by path in `hooks.server.ts` (not Better Auth's origin-matching helper).
- Anonymous players are real Better Auth users (`isAnonymous`). Linking to Google moves the world
  via `transferWorldOwnership`; a user can never own two worlds (unique `world.user_id`).
- Env is validated by `parseServerEnv` (`apps/web/src/lib/server/env.ts`). Add new vars there,
  to `.env.example`, and to `docs/development.md`.
