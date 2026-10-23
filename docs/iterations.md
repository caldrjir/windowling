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
- Invite-only: the whole site behind one shared password (site gate).
- Mobile: responsive hub; VOIDBORN touch controls (stick + dash) and compact phone HUD/menus.
- STARSPIRE (deck-building roguelike) joins the library, with a phone layout for battles.
- DRIFTWOOD (first-person 3D survival) joins the library; computers only (blocked on phones/tablets).
- Live player counts per game (signed-in vs anonymous) from game-tab heartbeats.
- Puzzle shelf, stage 1: puzzle kit (daily puzzle, streaks, Star Path, weekly quests, themes) with
  Sudoku, Nonograms, Kakuro and Souhvězdí (Hashi).
- Puzzle shelf, stage 2: Pulsar (falling blocks), Fúze (2048), Miny (no-guess minesweeper),
  Omalovánky (colour by number).
- Puzzle shelf, stage 3: Solitaire (Klondike 1/3, FreeCell, Spider; winnable Klondike deals),
  Mahjong (always solvable layouts), Skládačka (jigsaw of generated cosmic paintings).
- Puzzle shelf, stage 4: Šachy (computer at six strengths, daily mate in 1–2, two players) and
  Piškvorky (15×15 gomoku, four strengths with VCF, daily opening, two players).
- DRIFTWOOD multiplayer: create or join a shared world by code (Durable Objects), nicknames,
  players see each other, in-game chat.

## Game Center 2 – Accounts & Cloud Saves

- Table for per-user game stats/saves; server routes `GET/PUT /api/games/<id>/save`.
- On first sign-in, import the browser's local stats and saves.
- Hub shows account-wide stats when signed in.

## Later

- More games in the library.
- Multiplayer for more games (same pattern as DRIFTWOOD), lobby in the hub, identities from
  Better Auth sessions, results persisted to Postgres.
- Leaderboards.
