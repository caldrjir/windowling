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
- Puzzle shelf: Sokoban (generated depots built backwards from the solved state, so every one is
  solvable; push par for three stars, unlimited undo, hints from the stored solution).
- DRIFTWOOD multiplayer: create or join a shared world by code (Durable Objects), nicknames,
  players see each other, in-game chat.
- Online puzzles: live chess and gomoku games (open games list, code or link, chat, draw
  offers, rematch with swapped colours) and races of up to 8 players on the same puzzle for
  every other puzzle (live progress, standings).

## Game Center 2 – Accounts & Cloud Saves

- Done: every game's progress is kept in the account (`/api/sync`, `static/games/sync.js`) and
  follows the player to other devices; the first sign-in on a device merges its local progress
  per game (more play time wins).
- Done: nickname chosen after the first sign-in, used by online puzzles and DRIFTWOOD.
- Done: leaderboards for signed-in players on comparable boards (daily puzzle, Path level,
  fixed-rule free modes, online wins, action-game records) and play time per game.
- Next: account-wide stats.

## Later

- More games in the library.
- Multiplayer for more games (same pattern as DRIFTWOOD), lobby in the hub, identities from
  Better Auth sessions, results persisted to Postgres.
- Leaderboards.
