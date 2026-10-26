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
- Puzzle shelf: Clickomania (SameGame; every board checked by a beam-search solver that clears it,
  the clearing kept for hints; 3-5 colours, undo, three stars without undo or hints).
- Puzzle shelf: Rybky (two fish escape a cave, Fish Fillets style: pushing, gravity, light and
  steel objects). Caves are generated offline and verified by a BFS solver (`levels.js`, sorted by
  difficulty, with solutions for hints); the Path walks the pool from easy to hard.
- Puzzle shelf: Mlsoun (maze chase in the spirit of Pac-Man: four ghosts with their own chase
  rules, power dots, tunnels, a bonus comet). Symmetric mazes are generated from the seed (DFS
  tree mirrored, dead ends braided, ghost house in the middle), so the daily maze is shared;
  Calm, Maze and a 10-maze Arcade for score, a 120-maze Path and online races.
- Puzzle shelf: Had (snake: Sprint 25 on a seeded obstacle map, endless Classic and No walls for
  score, golden bonus stars). Obstacle maps are point-symmetric and checked so free cells stay
  connected with no dead-end pockets; the daily sprint shares map and fruit order.
- Puzzle shelf: Impakt (side-scrolling space shooter in the spirit of Space Impact: auto-fire,
  enemy waves and a boss per sector, missiles, laser, shield and double shot from carriers, a
  green retro-screen look). Sectors are generated from the seed; the 5-sector Campaign uses fixed
  seeds so its score board is fair; Endless, a daily sector, a 120-sector Path and online races.
- Puzzle shelf: Skladník (warehouse crates in the spirit of Stack Attack: cranes drop crates,
  the worker pushes and jumps onto them, full rows disappear; bombs, hearts and a high-jump
  feather). Crate order comes from the seed, so the daily shift is shared; Shift, Calm shift,
  Endless for score, a 120-shift Path and online races.
- Puzzle shelf: Bubliny (bubble shooter: hex cluster from the seed, bank shots with a dotted aim
  line, match three pops, unattached bubbles fall, the ceiling drops after misses; Endless adds
  rows for score; daily board, 120-board Path, online races).
- Two-player shelf (`category: 'duo'`, „Pro dva hráče“): Tanky, a turn-based artillery duel
  (angle, power, wind, destructible terrain, five weapons) against the computer at three
  strengths, two players on one device, or online through the turn rooms. Červíci, a worms war on a
  seeded destructible island (caves, water, knock-back, five weapons, 45 s turns, follow camera on
  phones); online the player on turn sends the result and the other client replays it.
- Hub library: the big games featured on top, the rest in genre shelves with filters, search,
  sorting and synced favourites; site stats (online now, players in 30 days / total, accounts)
  and the games most played right now.
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

## Game backlog

Games the owner wants next, in the spirit of the originals (own names, art and code; the
originals are only the inspiration). Ticked when the game is in the library.

- [x] Letní hry (Playman Summer Games: sprint, long jump, hurdles, javelin)
- [ ] Rally Master Pro – top-down / behind-the-car rally on stages
- [ ] Asphalt (series) – arcade street racing with nitro
- [ ] Townsmen – medieval town builder
- [ ] Prince of Persia (Sands of Time / Warrior Within) – acrobatic platformer with traps and sword fights
- [ ] Diamond Rush – maze adventure, collect diamonds, push boulders
- [ ] Bounce / Bounce Tales – rolling red ball platformer
- [ ] Splinter Cell – stealth in shadows
- [x] Tower Bloxx – stack swinging floors into a tower (Mrakodrap)
- [x] Angry Birds – slingshot physics against structures (Ptačí pomsta)
- [x] Flappy Bird – tap to fly through gaps (Pírko)
- [x] Fruit Ninja – swipe to slice fruit, avoid bombs (Šmik!)
- [ ] Temple Run / Subway Surfers – endless runner with lanes, jump and slide
- [x] Doodle Jump – endless vertical jumping on platforms (Skokan)
- [ ] Plants vs. Zombies – lane defence with plants
- [ ] Tower defence – build towers along a path
- [ ] OpenTTD – transport tycoon (trains, roads, economy)
- [ ] Gone Fishing – fishing game
- [ ] Sonic – fast loop-and-ring platformer
- [ ] Jazz Jackrabbit – run-and-gun platformer
- [ ] Mario Kart – kart racing with items
- [ ] The Right Mix – bartending / cocktail mixing
- [ ] Happy Wheels – ragdoll physics obstacle courses
- [ ] Heli Attack – helicopter shooter
- [x] Age of War – lane war through the ages, with its iconic-style music (Věky válek)
- [ ] Burger Tycoon – burger chain business sim
- [x] Gold Miner – swinging claw grabbing gold (Zlatokop)
- [ ] Hobo – brawler as a homeless guy
- [ ] Earn to Die – drive through zombies, upgrade the car between runs
- [ ] Defend Your Castle – drag and fling attackers away from the castle
- [ ] Rural Racer – rural road racing

## Later

- More games in the library.
- Multiplayer for more games (same pattern as DRIFTWOOD), lobby in the hub, identities from
  Better Auth sessions, results persisted to Postgres.
- Leaderboards.
