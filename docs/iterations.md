# Iterations

Each iteration is a GitHub milestone. Only the current one is implemented; later ones only
shape decisions so they are not blocked.

Iterations 0-10 (milestones "Iteration 0 – Foundation" … "Iteration 10") built the former
life simulation. Its code was removed in the Game Center rewrite; it remains in git history.
The technical foundation from Iteration 0 (SvelteKit on Workers, Postgres/Drizzle, Better
Auth, CI/CD, release-please) carries on.

## Game Center 1 – Launch (current)

- SvelteKit hub "Windowling Game Center" (ported from the static NEXUS prototype).
- VOIDBORN shipped unchanged under `/games/voidborn/`.
- Shared browser contract: `gamecenter.lang`, `gamecenter.stats.<id>`, game saves untouched.
- Google sign-in (button + sign-out); anonymous users removed.
- Production database wiped; old tables dropped (migration `0007_game_center`).
- Kill-switch service worker removes the old app's caches.

## Game Center 2 – Accounts & Cloud Saves

- Table for per-user game stats/saves; server routes `GET/PUT /api/games/<id>/save`.
- On first sign-in, import the browser's local stats and saves.
- Hub shows account-wide stats when signed in.

## Later

- More games in the library.
- Multiplayer: a Durable Object per room (WebSocket), lobby in the hub, identities from
  Better Auth sessions, results persisted to Postgres.
- Leaderboards.
