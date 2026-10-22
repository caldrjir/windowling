# Development

## Local setup

See the [README](../README.md#getting-started). Short version:

```bash
corepack enable && pnpm install
cp .env.example .env            # set BETTER_AUTH_SECRET (openssl rand -base64 32)
docker compose up -d
pnpm db:migrate
pnpm dev
```

No Docker? Any PostgreSQL 16+ works (production and CI run 18) - create databases `windowling` and `windowling_test`
and point `DATABASE_URL` / `TEST_DATABASE_URL` at them.

## Daily workflow

1. Pick (or create) an issue in the current milestone. Label it (`type:`, `area:`).
2. Branch from `master`: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`.
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/):
   `feat(web): add game tile`, `fix(auth): keep session after sign-in`.
4. `pnpm check` before pushing (same as CI's quality job). Run `pnpm test:e2e` for UI/auth/server changes.
5. Open a PR to `master`, title in Conventional Commit form, body `Closes #<issue>`.
6. CI green → **squash merge**. `master` deploys to production automatically.

```
Issue ─► feature branch ─► PR ─► CI ─► (preview) ─► squash merge ─► production
```

### Recommended GitHub settings (one-time, repo admin)

- Default branch `master`; allow **squash merging** only; auto-delete head branches.
- Branch protection / ruleset on `master`: require PR, require status checks
  `Lint · Typecheck · Test · Build`, `E2E (Playwright on workerd)`, `conventional-title`;
  block force pushes.
- Environment `production` with the deploy secrets (optionally required reviewers).

## Versioning & releases

SemVer, pre-1.0 while the foundation evolves. release-please watches `master`, keeps a
"release PR" with the next version and `CHANGELOG.md`; merging it tags `vX.Y.Z` and creates a
GitHub Release. `feat:` → minor, `fix:` → patch (pre-1.0, breaking changes bump minor).
Convention: each completed iteration is at least one minor release.

## Database & migrations

- Schema: `packages/database/src/schema/*.ts` (Drizzle, `snake_case` columns).
- After editing: `pnpm db:generate --name <what_changed>` → commit the SQL in `packages/database/drizzle/`.
- Apply: `pnpm db:migrate`. CI fails if the schema and migrations drift apart.
- Production migrations run in the Deploy workflow **before** the new Worker goes live, so
  migrations must be backwards compatible with the previous release (expand → migrate → contract).
- Better Auth tables (`user`, `session`, `account`, `verification`) must match Better Auth's
  expectations. When upgrading Better Auth or adding plugins, compare with
  `pnpm dlx @better-auth/cli generate`.

## Testing

| Layer                  | Tool                   | Where                               |
| ---------------------- | ---------------------- | ----------------------------------- |
| Contracts / pure logic | Vitest                 | `packages/*/src/**/*.test.ts`       |
| Data access            | Vitest + real Postgres | `packages/database/src/*.test.ts`   |
| Server config          | Vitest                 | `apps/web/src/**/*.test.ts`         |
| End to end             | Playwright (workerd)   | `apps/web/e2e/` - desktop + Pixel 7 |

- DB tests use `TEST_DATABASE_URL`, migrate it automatically, and are skipped locally if it is
  unset (never in CI).
- E2E builds the app and runs it with `wrangler dev` (the real Workers runtime), on
  `http://127.0.0.1:8787`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a preinstalled Chromium.
- Google OAuth is not exercised against real Google in E2E (the button is hidden without
  credentials). E2E checks the hub, the language contract, launching VOIDBORN and stats.

## Environments

| Env        | URL                                 | Database                            | Deploy                  |
| ---------- | ----------------------------------- | ----------------------------------- | ----------------------- |
| local      | `http://localhost:5173`             | Docker Postgres                     | `pnpm dev`              |
| preview    | (planned) per-PR Worker version URL | Neon branch `preview/pr-<n>` (auto) | GitHub Actions          |
| production | `https://windowling.com`            | Neon via Hyperdrive                 | on green CI on `master` |

## Preview databases (Neon branches)

`.github/workflows/neon-preview.yml` creates a Neon branch `preview/pr-<n>` for every PR
(a copy-on-write fork of production data), applies the PR's migrations to it and posts a
schema diff comment. The branch is deleted when the PR closes and expires after 14 days.
Requires the secret `NEON_API_KEY` and variable `NEON_PROJECT_ID` (added by the Neon GitHub
integration). Fork and Dependabot PRs are skipped (no secret access). A per-PR Worker preview
using this database is tracked in the "Per-PR preview deployments" issue.

## Deployment

One-time setup (requires accounts; free tiers are enough). **All production secrets live in
the GitHub environment `production`** - the Deploy workflow uploads the Worker's secrets with
every deploy (`wrangler deploy --secrets-file`), so nobody needs to run `wrangler secret put`.

1. **Neon**: project `windowling` (Postgres 18, AWS Europe Central 1 - Frankfurt). From
   _Connect_, copy both connection strings (keep only `?sslmode=require` as query):
   - **direct** (connection pooling off) → `PRODUCTION_DATABASE_URL` (migrations)
   - **pooled** (connection pooling on, host contains `-pooler`) → `WORKER_DATABASE_URL`
2. **Cloudflare**: the domain `windowling.com` is registered at Cloudflare (account id is in
   `apps/web/wrangler.jsonc`, it is not a secret). Create an API token from the _Edit Cloudflare Workers_
   template, scoped to your account and the `windowling.com` zone.
3. **GitHub** → Settings → Environments → `production` → environment secrets:

   | Secret                    | Value                                                 |
   | ------------------------- | ----------------------------------------------------- |
   | `PRODUCTION_DATABASE_URL` | Neon direct connection string                         |
   | `WORKER_DATABASE_URL`     | Neon pooled connection string                         |
   | `BETTER_AUTH_SECRET`      | `openssl rand -base64 32` (never reuse the local one) |
   | `CLOUDFLARE_API_TOKEN`    | token from step 2                                     |
   | `GOOGLE_CLIENT_ID`        | optional, step 4                                      |
   | `GOOGLE_CLIENT_SECRET`    | optional, step 4                                      |

   `BETTER_AUTH_URL` and `PUBLIC_APP_URL` are plain vars in `apps/web/wrangler.jsonc`.

4. **Google Cloud Console** → OAuth client (Web): authorized origins `https://windowling.com`,
   `http://localhost:5173`; redirect URIs `https://windowling.com/api/auth/callback/google`,
   `http://localhost:5173/api/auth/callback/google`.
5. **Hyperdrive** (done: config `windowling`, id in `apps/web/wrangler.jsonc`): Workers & Pages →
   Hyperdrive → Connect to public database, with the **direct** Neon connection details and
   **caching disabled**. In production the Worker connects through it; `WORKER_DATABASE_URL`
   is only a fallback when the binding is absent.

After that, every green CI run on `master` migrates and deploys, then smoke-tests `/api/health`.
Manual deploy: `pnpm build && pnpm --filter @windowling/web deploy`.

## Troubleshooting

- **`Invalid environment configuration`** at startup - the message lists each missing/invalid
  variable. Compare with `.env.example`.
- **Worker bundle too large** - something pulled a big lib into server code.
  Check `pnpm --filter @windowling/web exec wrangler deploy --dry-run --outdir /tmp/w`.
- **Auth 404 behind a proxy** - `/api/auth/*` is routed by path; check `BETTER_AUTH_URL` and
  `PUBLIC_APP_URL` match the origin the browser uses (trusted origins).
