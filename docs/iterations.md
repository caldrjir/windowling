# Iterations

Each iteration is a GitHub milestone (`Iteration N – Name`). Issues belong to exactly one
milestone. Only the current iteration is implemented; later ones guide architecture only.

| #   | Name                              | Milestone outcome                                        | Status          |
| --- | --------------------------------- | -------------------------------------------------------- | --------------- |
| 0   | Foundation                        | Production-ready technical base                          | done            |
| 1   | Room + Character                  | A simple living space with a character (idle, walk, sit) | **in progress** |
| 2   | Autonomous Activities             | The character does things without player input           | planned         |
| 3   | Player Awareness                  | The player can watch unnoticed for a while               | planned         |
| 4   | Voice + Local LLM                 | Natural voice interaction without a text chat            | planned         |
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

## Iteration 1 – Room + Character (in progress)

Definition of Done:

- [x] One simple room (bed, sofa, desk + chair, lamp, rug, back window) - #8
- [x] Camera framing for desktop landscape and mobile portrait, resize-safe - #8
- [x] Lighting, real-time sky in the window - #8
- [x] Furniture exposed as shared target ids with affordances - #8
- [x] Placeholder character with idle / walk / sit / lie and crossfading animation system - #9
- [x] Character driven only through `CharacterAction` (walk paths avoid furniture) - #9
- [x] Placeholder ambient behaviour from the simulation package (replaced in Iteration 2)
