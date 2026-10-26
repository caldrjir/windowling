# Product

## Vision

**Windowling Game Center** is a home for small, polished browser games. One place, one
look, one account: open <https://windowling.com>, pick a game, play. Progress and stats
follow the player; later, some games are played together (multiplayer).

## Principles

- **Instant play.** No install, no sign-up wall. A game starts in one click (or Enter).
- **Optional account.** Google sign-in is offered, never required. Anonymous play keeps its
  progress in the browser.
- **Games stay themselves.** Each game owns its logic, balance and save format. The hub only
  launches games and shows what they report.
- **Bilingual.** Czech and English; the choice is shared by the hub and all games.
- **Safe by construction.** Secrets (database, OAuth) never leave the server.

## Library

| Game      | Genre                            | Status                    |
| --------- | -------------------------------- | ------------------------- |
| VOIDBORN  | Roguelite, bullet heaven         | Released                  |
| STARSPIRE | Deckbuilder, roguelike, strategy | Released                  |
| DRIFTWOOD | First-person survival, 3D, co-op | Released (computers only) |

**Puzzles** (the library below them, phones and computers): Sudoku, Nonograms, Kakuro, Souhvězdí
(Hashi), Pulsar (falling blocks), Fúze (2048 with cosmic bodies), Miny (no-guess minesweeper) and
Omalovánky (colour by number), Solitaire (Klondike, FreeCell, Spider), Mahjong, Skládačka
(jigsaw), Šachy (chess), Piškvorky (gomoku), Sokoban, Clickomania, Rybky (in the spirit of Fish Fillets), Mlsoun (a maze chase in the spirit of Pac-Man), Had (snake), Impakt (a space shooter in the spirit of Space Impact), Skladník (crates in the spirit of Stack Attack), Bubliny (bubble shooter), Letní hry (an athletics multi-event in the spirit of Playman Summer Games), Zlatokop (in the spirit of Gold Miner), Skokan (in the spirit of Doodle Jump), Šmik! (fruit slicing in the spirit of Fruit Ninja), Ptačí pomsta (slingshot physics in the spirit of Angry Birds, on planck.js), Pírko (in the spirit of Flappy Bird), Klávesy (in the spirit of Piano Tiles: every tap plays the next note of a public-domain song on a sampled concert grand, with Piano, Pop, House, EDM and Rock arrangements), Věky válek (in the spirit of Age of War, with its own generated music), Tanky (a two-player artillery duel) and Červíci (a worms war on a destructible island); the last two play against the computer, two players on one device or online. Each has a daily puzzle with streaks, a 120-level Star Path, endless free play, ranks and
achievements; weekly quests and themes are shared by all puzzles. **Online**: chess and gomoku
against a live opponent, and races of up to 8 players on the same puzzle in every other game
(join by a code, a link or the list of open games).

## What the hub shows

- Hero with the selected game: cover, description, tags, play / continue button.
- Featured shelf: the big games (VOIDBORN, STARSPIRE, DRIFTWOOD), always on top.
- Library: every other game in genre shelves (`CATEGORIES` in `registry.ts`: logic, arcade,
  cards & board, relax; a new genre is one entry there), with genre chips, search (ignores
  diacritics) and sorting (recently played, most played, playing now, by name). The view is
  remembered in `gamecenter.libview`.
- Favourites: a star on every card and next to the hero title. Favourites get their own shelf
  on top of the library and a filter chip; `gamecenter.favorites` syncs with the account.
- Site pulse: people online now, players in the last 30 days and in total, accounts, and the
  games most played right now.
- Per-game stats from this browser: play time, last played, progress and game-specific numbers.
- Who is playing right now: per game, signed-in players and anonymous players (live, ~15 s).
- Account: Google sign-in button, or the player's name and avatar with sign-out.

## Roadmap (high level)

1. **Launch** - hub, VOIDBORN, Google sign-in. (Game Center 1)
2. **Accounts & cloud saves** - stats and saves stored per account in Postgres, so progress
   continues on every device; a nickname after the first sign-in. (Game Center 2, done)
3. **More games** - fill the shelf.
4. **Multiplayer** - real-time games through Cloudflare Durable Objects (WebSockets).
   DRIFTWOOD already has shared worlds (up to 8 players, nicknames, chat); every puzzle can be
   played online (live games or races).

See [`iterations.md`](iterations.md).
