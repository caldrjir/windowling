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

| Game      | Genre                            | Status   |
| --------- | -------------------------------- | -------- |
| VOIDBORN  | Roguelite, bullet heaven         | Released |
| STARSPIRE | Deckbuilder, roguelike, strategy | Released |
| -         | Free slots (2 shown)             | Planned  |

## What the hub shows

- Hero with the selected game: cover, description, tags, play / continue button.
- Library shelf with game cards and free slots.
- Per-game stats from this browser: play time, last played, progress and game-specific numbers.
- Who is playing right now: per game, signed-in players and anonymous players (live, ~15 s).
- Account: Google sign-in button, or the player's name and avatar with sign-out.

## Roadmap (high level)

1. **Launch** - hub, VOIDBORN, Google sign-in. (Game Center 1)
2. **Accounts & cloud saves** - stats and saves stored per account in Postgres. (Game Center 2)
3. **More games** - fill the shelf.
4. **Multiplayer** - real-time games through Cloudflare Durable Objects (WebSockets).

See [`iterations.md`](iterations.md).
