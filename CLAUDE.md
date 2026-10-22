# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.
Read `docs/product.md` and `docs/architecture.md` before larger changes.

## What this is

**Windowling Game Center** (<https://windowling.com>) is a web game hub: a library of browser
games with a shared shell, language switch, per-game stats and Google sign-in. The library
holds **VOIDBORN** and **STARSPIRE**. Later games will store progress in Postgres and some will be multiplayer.

(Until v0.x the repo held a life simulation; it was removed in the Game Center rewrite.
Its history is in git and `CHANGELOG.md`.)

## Product principles

1. **The hub is a launcher, not a game.** It lists games, shows their stats, starts them.
2. **Games are self-contained.** A game owns its logic, balance and save format; the hub
   never changes them. A game is a static page under `apps/web/static/games/<id>/`.
3. **Shared browser contract.** `gamecenter.lang` (`cs` / `en`) is shared by hub and games;
   each game writes `gamecenter.stats.<id>` (`playTime`, `lastPlayed`, `progress`, `stats`).
   Never rename these keys or a game's own save key (`voidborn.save.v1`, `starspire.save.v1`).
4. **Secrets never reach the browser.** DB credentials and OAuth secrets live only in
   `$lib/server` and Worker env. Anything a game needs from the DB goes through a server route.
5. **Signing in is optional.** Everything works anonymously; Google sign-in adds an account.

## Engineering principles

- Strict TypeScript everywhere. No `any`, no non-null assertions in production code.
  (Game code in `static/games` is plain JS shipped as-is and is excluded from lint/format.)
- Simple architecture, explicit package boundaries, no premature abstractions or microservices.
- No vendor lock-in without a good reason (plain Postgres, standard OAuth, portable code).
- Every schema change ships with a Drizzle migration (`pnpm db:generate`). CI fails on drift.
- No secrets in the repo. Ever. Use `.env` locally, GitHub `production` environment in production.
- Test critical logic: data access, auth, server routes, the hub's contract with games (E2E).
- Implement only the current iteration (`docs/iterations.md`), but don't block future ones
  (accounts with cloud saves, multiplayer via Durable Objects).

## Repository map

```
apps/web                       SvelteKit app: hub UI, auth, server routes, PWA shell
apps/web/src/lib/games         Game catalogue (registry.ts) - one entry per game
apps/web/src/lib/hub           Hub stylesheet
apps/web/src/lib/server        Server-only code: env, auth, DB access (never imported by the client)
apps/web/static/games/<id>     The games themselves (static HTML/CSS/JS)
packages/database              Drizzle schema, migrations, client. The ONLY place with SQL.
docs/                          Product, architecture, iterations, development
docker/                        Local infrastructure (Postgres init scripts)
```

- `apps/web` must not import `drizzle-orm`/`postgres` directly - use `@windowling/database`
  (enforced by ESLint `no-restricted-imports`).
- SvelteKit refuses to bundle `$lib/server` into client code - keep secrets there.

## Adding a game

1. Put the game in `apps/web/static/games/<id>/` (it may link back with `../../index.html`,
   which redirects to `/`).
2. Add an entry to `GAMES` in `apps/web/src/lib/games/registry.ts` (texts in cs + en, `path`,
   `statsKey`, cover colours).
3. Make it playable on phones (touch input, small screens) and extend `apps/web/e2e/app.test.ts`
   so it launches without page errors (desktop and mobile projects).
4. If it loads anything external, update the CSP in `apps/web/svelte.config.js`.

## Commands

```bash
pnpm install               # install
pnpm setup:local           # .env + local secrets, Docker Postgres, migrations (idempotent)
pnpm dev                   # http://localhost:5173 (no site password)
pnpm preview               # http://localhost:8787, production Worker, site password "windowling"
pnpm db:migrate            # apply migrations
pnpm check                 # lint + format:check + typecheck + test + build (run before pushing)
pnpm test                  # unit + DB integration tests (Vitest)
pnpm test:e2e              # Playwright against the built Worker in workerd
pnpm db:generate --name x  # create a migration after editing packages/database/src/schema
```

## Workflow

- Work from a GitHub issue in the current iteration's milestone.
- Branch from `master`: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`.
- Conventional Commits (`feat(web): add game tile`). PRs are squash-merged; the
  PR title must be a Conventional Commit (CI checks it). release-please derives versions.
- Run `pnpm check` before pushing. CI must be green before merge; `master` deploys to production.
- Update the relevant docs in the same PR when architecture, workflow or env vars change.

## Gotchas

- Cloudflare Workers: DB clients are per request (`acquireDatabase` in `apps/web/src/lib/server/db.ts`).
  Never cache I/O objects in module scope for production code paths.
- The site is behind a password (`src/worker/gate.ts`, the Worker entry). Static assets go
  through it (`run_worker_first`); SvelteKit hooks never see static files. The adapter writes
  its worker to the paths in `wrangler.sveltekit.jsonc`, never to `wrangler.jsonc` `main`.
- Workers static assets serve `/games/<id>/index.html` as `/games/<id>/` (default `html_handling`).
- Assets are revalidated by default; `static/service-worker.js` is a kill switch that removes
  the old app's service worker and caches. Don't add a caching SW without versioning games.
- `/api/auth/*` is routed by path in `hooks.server.ts` (not Better Auth's origin-matching helper).
- Local scripts must run on Windows too: Node scripts, `fileURLToPath` (never `URL.pathname`),
  no shell-only syntax in package.json scripts.
- Env is validated by `parseServerEnv` (`apps/web/src/lib/server/env.ts`). Add new vars there,
  to `.env.example`, and to `docs/development.md`.
