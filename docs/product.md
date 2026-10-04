# Product

## Vision

Windowling is a persistent web game / life simulation. The player does not control a game
character. They watch - and influence - the life of an autonomous virtual person who:

- lives their own life, also when the player is away,
- has needs, preferences, moods and a daily rhythm,
- sleeps, eats, works, earns and spends money, rests, listens to music, watches shows, games,
- talks to other people, makes friends, may date, find a partner, start a family,
- ages, and their life develops over a very long time.

**Design rule:** _Player creates opportunities. Character makes decisions._

## North Star

> The character doesn't live because I opened the app.
> I opened the app to look at a life that is already happening.

The MVP succeeds when, after a few visits, the player starts wondering _"what is it doing
right now?"_ and opens Windowling just to look.

Windowling must **not** feel like a chatbot in 3D, a virtual assistant, a management game,
a Tamagotchi with meters, or an NPC waiting for input.

## Core experience pillars

| Pillar               | Meaning                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Autonomy             | The character decides. The player advises, gifts, enables - never commands.                  |
| Real time            | Real clock. At 3 AM it's probably asleep; waking it has consequences.                        |
| Awareness            | Opening the app ≠ being noticed (`UNKNOWN → SUSPECTED → DETECTED → INTERACTING / IGNORING`). |
| Show, don't tell     | No stat bars. Hunger = opening the fridge, sighing, cooking.                                 |
| Emergence            | Moments (dancing alone, raging at a game) arise from combined state, not scripts.            |
| Memory & consequence | Episodic, semantic and relationship memory. "I told you to stop."                            |
| Earned trust         | The character owns its money and entrusts some to the player - or doesn't.                   |
| Physicality          | Bought items arrive, get unpacked, appear in the room and get used.                          |
| Growing independence | Over time the player shifts from caretaker to old friend.                                    |

## Platforms & metaphors

One web app + PWA for desktop, laptop, tablet and phone. No native apps initially.

- **Desktop:** the screen is a window into the character's flat. The character may not see
  you, may notice you, come to the window, knock, close the curtain, ignore you, leave.
- **Mobile:** the phone _is_ the box containing the room. Later: tilt changes gravity/camera,
  shaking shakes the room (and is remembered), the front camera becomes the character's
  window into our world - processed in the browser into semantic events (`{ gesture: "wave" }`),
  never streamed as raw video.

## Voice

The character speaks with a voice; text is subtitles (`OFF | AUTO | ALWAYS`).
Pipeline: microphone → STT → reasoning → structured decision → TTS → lip sync → audio.
TTS should support emotion, pauses, whispering, sleepiness, laughter, sighs. Spatial audio
places voice, music and TV in the scene.

## Life systems (long-term)

Daily routine driven by time, weekday, energy, mood, needs, personality, money, job, social
situation and past events. Music taste, fictional TV and online games, a virtual internet
(work, messaging, social, shopping), an in-game economy, shopping with physical progression,
careers, social world of persistent NPC identities, dating where the player can only help,
partner as a full character (who may dislike the player), family, aging.

Multiplayer: two players can connect worlds with a rope bridge; characters decide on their
own whether to cross, knock, open, ignore. Character relationships are independent from
player relationships. Later, adjacent phones form physically connected worlds.

## Principles for AI

- Local and free first: Ollama + open-weight model, whisper.cpp, Piper-class TTS, MediaPipe.
- The LLM is never the game engine and never emits code - only a validated decision schema.
- The LLM only ever sees relevant memories, never the full history.

## Out of scope for now

See [`iterations.md`](iterations.md): everything beyond the current iteration is roadmap,
not a requirement - but the architecture must not block it.
