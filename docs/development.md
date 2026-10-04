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

No Docker? Any PostgreSQL 16+ works - create databases `windowling` and `windowling_test`
and point `DATABASE_URL` / `TEST_DATABASE_URL` at them.

## Daily workflow

1. Pick (or create) an issue in the current milestone. Label it (`type:`, `area:`).
2. Branch from `main`: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`.
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/):
   `feat(game): add idle animation`, `fix(auth): keep world on link`.
4. `pnpm check` before pushing (same as CI's quality job). Run `pnpm test:e2e` for UI/auth/server changes.
5. Open a PR to `main`, title in Conventional Commit form, body `Closes #<issue>`.
6. CI green → **squash merge**. `main` deploys to production automatically.

```
Issue ─► feature branch ─► PR ─► CI ─► (preview) ─► squash merge ─► production
```

### Recommended GitHub settings (one-time, repo admin)

- Default branch `main`; allow **squash merging** only; auto-delete head branches.
- Branch protection / ruleset on `main`: require PR, require status checks
  `Lint · Typecheck · Test · Build`, `E2E (Playwright on workerd)`, `conventional-title`;
  block force pushes.
- Environment `production` with the deploy secrets (optionally required reviewers).

## Versioning & releases

SemVer, pre-1.0 while the foundation evolves. release-please watches `main`, keeps a
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
| Physics (headless)     | Vitest + Rapier        | `packages/game/src/physics.test.ts` |
| Data access            | Vitest + real Postgres | `packages/database/src/*.test.ts`   |
| Server config          | Vitest                 | `apps/web/src/**/*.test.ts`         |
| End to end             | Playwright (workerd)   | `apps/web/e2e/` - desktop + Pixel 7 |

- DB tests use `TEST_DATABASE_URL`, migrate it automatically, and are skipped locally if it is
  unset (never in CI).
- E2E builds the app and runs it with `wrangler dev` (the real Workers runtime), on
  `http://127.0.0.1:8787`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a preinstalled Chromium.
- Google OAuth is not exercised against real Google in E2E; linking logic is covered by the
  repository integration tests.

## Environments

| Env        | URL                                 | Database                         | Deploy                |
| ---------- | ----------------------------------- | -------------------------------- | --------------------- |
| local      | `http://localhost:5173`             | Docker Postgres                  | `pnpm dev`            |
| preview    | (planned) per-PR Worker version URL | (planned) Neon branch per PR     | GitHub Actions        |
| production | `https://windowling.com`            | Neon (optionally via Hyperdrive) | on green CI on `main` |

## Deployment

One-time setup (requires accounts; free tiers are enough):

1. **Neon**: create project `windowling` (Postgres 17, EU region close to users). Copy the
   pooled or direct connection string.
2. **Cloudflare**: add zone `windowling.com` (DNS on Cloudflare). Create an API token with
   _Workers Scripts: Edit_, _Workers Routes: Edit_, _Account Settings: Read_ (and _Hyperdrive:
   Edit_ if used).
3. **Worker secrets** (from `apps/web`):
   ```bash
   pnpm exec wrangler secret put DATABASE_URL
   pnpm exec wrangler secret put BETTER_AUTH_SECRET
   pnpm exec wrangler secret put GOOGLE_CLIENT_ID
   pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
   ```
   `BETTER_AUTH_URL` and `PUBLIC_APP_URL` are plain vars in `wrangler.jsonc`.
4. **GitHub** → Settings → Environments → `production` secrets:
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `PRODUCTION_DATABASE_URL`.
5. **Google Cloud Console** → OAuth client (Web): authorized origins `https://windowling.com`,
   `http://localhost:5173`; redirect URIs `https://windowling.com/api/auth/callback/google`,
   `http://localhost:5173/api/auth/callback/google`.
6. Optional **Hyperdrive**: `wrangler hyperdrive create windowling --connection-string=...`,
   then uncomment the `hyperdrive` block in `apps/web/wrangler.jsonc`.

After that, every green CI run on `main` migrates and deploys, then smoke-tests `/api/health`.
Manual deploy: `pnpm build && pnpm --filter @windowling/web deploy`.

## Troubleshooting

- **`Invalid environment configuration`** at startup - the message lists each missing/invalid
  variable. Compare with `.env.example`.
- **Worker bundle too large** - something pulled three.js/Rapier or a big lib into server code.
  Check `pnpm --filter @windowling/web exec wrangler deploy --dry-run --outdir /tmp/w`.
- **Auth 404 behind a proxy** - `/api/auth/*` is routed by path; check `BETTER_AUTH_URL` and
  `PUBLIC_APP_URL` match the origin the browser uses (trusted origins).
