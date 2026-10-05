# Iterations

Each iteration is a GitHub milestone (`Iteration N – Name`). Issues belong to exactly one
milestone. Only the current iteration is implemented; later ones guide architecture only.

| #   | Name                              | Milestone outcome                                        | Status          |
| --- | --------------------------------- | -------------------------------------------------------- | --------------- |
| 0   | Foundation                        | Production-ready technical base                          | done            |
| 1   | Room + Character                  | A simple living space with a character (idle, walk, sit) | done            |
| 2   | Autonomous Activities             | The character does things without player input           | done            |
| 3   | Player Awareness                  | The player can watch unnoticed for a while               | done            |
| 4   | Voice + Local LLM                 | Natural voice interaction without a text chat            | **in progress** |
| 5   | Memory + Relationship             | Past events influence present behaviour                  | planned         |
| 6   | Mobile Sensors                    | The world feels physically held inside the phone         | planned         |
| 7   | Rich Autonomous Life              | Opening the app is unpredictable                         | planned         |
| 8   | Emergent Moments                  | Situations feel scripted but emerge from systems         | planned         |
| 9   | Economy                           | The character earns; the player gets real decisions      | planned         |
| 10  | Shopping + Physical Progression   | The room tells the save's history                        | planned         |
| 11  | Career                            | Skills, opportunities, autonomous career choices         | planned         |
| 12  | Social World                      | Abstract NPCs with identity, personality, shared history | planned         |
| 13  | Dating                            | Player advises, character decides                        | planned         |
| 14  | Physical NPC Visits               | Visitors, shared activities, conflicts                   | planned         |
| 15  | Multiplayer Bridge                | Paired worlds, characters decide to cross                | planned         |
| 16  | Multi-device Physical Interaction | Characters walk between adjacent phones                  | planned         |
| 17  | Parties and Group Interaction     | Several NPCs in one household, each with memory          | planned         |
| 18  | Partner                           | Partner as persistent household member                   | planned         |
| 19  | Family                            | Shared household, children, changed priorities           | planned         |
| 20  | Long-term Life Progression        | A save that can exist for years                          | planned         |

## Iteration 0 – Foundation

**Goal:** a production-grade technical base. No real AI.

Definition of Done:

- [x] pnpm monorepo, strict TypeScript, ESLint (with boundary rules), Prettier
- [x] SvelteKit 2 + Svelte 5 + Tailwind 4 running
- [x] three.js canvas mounted outside Svelte reactivity, own rAF loop, resize, pause when hidden
- [x] Rapier foundation (fixed-step physics, headless-tested)
- [x] PostgreSQL via Docker Compose, Drizzle schema + migrations, CI drift check
- [x] Better Auth integrated, anonymous users, Google OAuth ready (enabled by env)
- [x] Anonymous world persistence (one world + character per user)
- [x] Anonymous → Google linking moves the world (never creates a second one)
- [x] Simulation catch-up foundation (`lastSimulatedAt` → now)
- [x] AI interfaces + decision schema + mock
- [x] PWA foundation: manifest, icons, service worker, mobile viewport, theme
- [x] Responsive full-screen layout with safe-area insets
- [x] Cloudflare Workers build, bundle dry run in CI
- [x] CI: lint, format, typecheck, unit + DB integration tests, build, E2E (desktop + mobile)
- [x] Deploy workflow (inert until secrets exist), release-please, Dependabot
- [x] `.env.example`, env validation, README, CLAUDE.md, docs
- [x] First production deploy to windowling.com (Cloudflare Workers + Neon via Hyperdrive)
- [x] Google OAuth credentials created and verified end-to-end

## Iteration 1 – Room + Character

Definition of Done:

- [x] One simple room (bed, sofa, desk + chair, lamp, rug, back window) - #8
- [x] Camera framing for desktop landscape and mobile portrait, resize-safe - #8
- [x] Lighting, real-time sky in the window - #8
- [x] Furniture exposed as shared target ids with affordances - #8
- [x] Placeholder character with idle / walk / sit / lie and crossfading animation system - #9
- [x] Character driven only through `CharacterAction` (walk paths avoid furniture) - #9
- [x] Placeholder ambient behaviour from the simulation package (replaced in Iteration 2)

## Iteration 2 – Autonomous Activities

**Goal:** the character does things even when the player does nothing.

Definition of Done:

- [x] Real local time in the device time zone (`world.timezone`, decision #10) - #21
- [x] Needs: hunger, energy, mood (0..1, never shown as numbers) - #20
- [x] Activities: sleep, eat, work, gaming, idle with need effects and duration rules - #20
- [x] Basic scheduler: utility scores from needs x time of day x weekday, deterministic per world - #20
- [x] Offline catch-up lives the missed hours (max 14 days) and persists needs + activity - #21
- [x] Kitchenette; eating, working, gaming, sleeping shown through behaviour; mood in pace/posture - #22
- [x] The page follows the simulation: asks the server for the next activity when one ends - #22

## Iteration 3 – Player Awareness

**Goal:** the player can watch the character for a while without it knowing.

Definition of Done:

- [x] Awareness model `UNKNOWN → SUSPECTED → DETECTED → INTERACTING / IGNORING` (simulation) - #24
- [x] Detection from presence, movement and knocks, filtered by what the character is busy with - #24
- [x] Reactions: glance, approach the window, wave, ignore and carry on - #25
- [x] Knocking on the glass (ripple + synthesised sound); a sleeper stirs, repeated knocks wake it - #26
- [x] Waking is persisted server-side (`POST /api/world/wake`): broken night, worse mood - #26

## Iteration 4 – Voice + Local LLM (in progress)

**Goal:** natural voice interaction without a text chat. Brain = combination of backends behind
`CharacterAI` (decision in #28): on-device (WebLLM), cloud (Workers AI, any OpenAI-compatible
API), Ollama for development, canned reactions as the last fallback.

Definition of Done:

- [x] Controlled decision schema, prompt with only relevant context, JSON extraction - #28
- [x] Cloud brain behind `POST /api/ai/decide` with server-side state and a daily quota - #28
- [x] Simulation reviews every proposed action - #28
- [x] The character starts the conversation (comes to the window, woken up) - #29
- [x] Voice via browser speech (neural voice: #32), subtitles OFF/AUTO/ALWAYS, basic lip sync - #29
- [x] Speech recognition in the browser (Whisper), push-to-talk - #30
- [ ] On-device brain (WebLLM) with download consent - #31
