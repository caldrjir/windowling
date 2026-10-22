# Windowling Game Center

> Pick a game. Play.

A web game hub: a library of browser games with one look, a shared CS/EN language switch,
per-game stats and optional Google sign-in. The first game is **VOIDBORN**. Later: cloud
saves per account and multiplayer games.

Production: <https://windowling.com> · Product: [`docs/product.md`](docs/product.md) ·
Iterations: [`docs/iterations.md`](docs/iterations.md)

## Tech stack

| Concern   | Choice                                                       |
| --------- | ------------------------------------------------------------ |
| Language  | TypeScript (strict) everywhere                               |
| App shell | SvelteKit 2 + Svelte 5 (runes), Vite 8                       |
| Games     | Static HTML/CSS/vanilla JS under `apps/web/static/games/`    |
| Database  | PostgreSQL (Neon in production, Docker locally), Drizzle ORM |
| Auth      | Better Auth - Google OAuth                                   |
| Hosting   | Cloudflare Workers (`@sveltejs/adapter-cloudflare`)          |
| Tests     | Vitest (unit + DB integration), Playwright (E2E on workerd)  |
| Quality   | ESLint 10 (flat config), Prettier, svelte-check              |
| Monorepo  | pnpm workspaces                                              |
| CI/CD     | GitHub Actions, release-please, Dependabot                   |

## Repository layout

```
apps/web                    SvelteKit app (hub, auth, server routes, PWA shell)
apps/web/src/lib/games      Game catalogue
apps/web/static/games/<id>  The games (static, shipped as-is)
packages/database           Drizzle schema, migrations, client
docs/                       Product, architecture, iterations, development guide
docker/                     Local infrastructure helpers
```

Architecture and boundaries: [`docs/architecture.md`](docs/architecture.md).

## Prerequisites

- **Node.js 24 LTS** (`.nvmrc`; `>=24`)
- **pnpm 10** - `corepack enable` picks the pinned version from `package.json`
- **Docker** (for local PostgreSQL) - or any PostgreSQL 16+ (production runs 18) you point `DATABASE_URL` at

## Getting started

```bash
git clone https://github.com/caldrjir/windowling.git
cd windowling
corepack enable
pnpm install

cp .env.example .env
# set BETTER_AUTH_SECRET, e.g.:  openssl rand -base64 32

docker compose up -d     # PostgreSQL on :5432 with databases windowling + windowling_test
pnpm db:migrate          # apply migrations
pnpm dev                 # http://localhost:5173
```

Open the hub and launch VOIDBORN. With Google credentials configured, the hub also shows
"Přihlásit přes Google" / "Sign in with Google".

## Environment variables

All variables live in a single root `.env` (template: [`.env.example`](.env.example)) and are
validated at startup - the server refuses to start with a readable list of problems.

| Variable               | Required | Description                                                       |
| ---------------------- | -------- | ----------------------------------------------------------------- |
| `DATABASE_URL`         | yes\*    | `postgres://` connection string. \*Optional if `HYPERDRIVE` bound |
| `TEST_DATABASE_URL`    | tests    | Database for integration tests (`windowling_test`)                |
| `BETTER_AUTH_SECRET`   | yes      | ≥32 chars, `openssl rand -base64 32`                              |
| `BETTER_AUTH_URL`      | yes      | Base URL for auth callbacks, e.g. `http://localhost:5173`         |
| `PUBLIC_APP_URL`       | yes      | Public app URL (trusted origin)                                   |
| `GOOGLE_CLIENT_ID`     | no       | Google OAuth client id (both or neither)                          |
| `GOOGLE_CLIENT_SECRET` | no       | Google OAuth client secret                                        |

Google OAuth redirect URIs:

- local: `http://localhost:5173/api/auth/callback/google`
- production: `https://windowling.com/api/auth/callback/google`

## Commands

| Command                     | What it does                                                           |
| --------------------------- | ---------------------------------------------------------------------- |
| `pnpm dev`                  | Dev server with HMR                                                    |
| `pnpm check`                | Everything CI's quality job runs: lint, format, types, tests, build    |
| `pnpm lint` / `lint:fix`    | ESLint (incl. architecture boundary rules)                             |
| `pnpm format`               | Prettier write                                                         |
| `pnpm typecheck`            | `tsc` per package + `svelte-check`                                     |
| `pnpm test`                 | Vitest - unit tests + DB integration tests (`TEST_DATABASE_URL`)       |
| `pnpm test:e2e`             | Playwright: builds, runs the Worker in workerd, tests desktop + mobile |
| `pnpm build`                | Production build for Cloudflare Workers                                |
| `pnpm preview`              | Build + run the production Worker locally (`wrangler dev`)             |
| `pnpm db:generate --name x` | Generate a migration from schema changes                               |
| `pnpm db:migrate`           | Apply migrations to `DATABASE_URL`                                     |
| `pnpm db:studio`            | Drizzle Studio                                                         |

First E2E run: `pnpm --filter @windowling/web exec playwright install chromium`.

## Deployment overview

- `master` is production. Every push runs CI; when CI passes on `master`, the **Deploy** workflow
  applies migrations to the production database and deploys the Worker to `windowling.com`.
- Deploy stays inert until Cloudflare/Neon secrets are configured - see
  [`docs/development.md#deployment`](docs/development.md#deployment).
- Versions and `CHANGELOG.md` are maintained by release-please from Conventional Commits.

## Contributing

Issue → `feat/<topic>` branch → PR (Conventional Commit title) → green CI → squash merge.
Details in [`docs/development.md`](docs/development.md) and [`CLAUDE.md`](CLAUDE.md).
