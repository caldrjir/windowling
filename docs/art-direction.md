# Art direction

The window should feel like looking into a real flat, not a game level. The goal is
**grounded realism**: believable proportions, real materials and real light, so the character's
life reads as a life. Stylisation only where the tech can't yet do better (the character).

## The place

A small rental flat in a European city, furnished the way a person in their late twenties
actually furnishes one: a few good pieces (an oak desk, a decent office chair), a few cheap ones,
plants, things left lying around. Calm Scandinavian-leaning palette - warm whites, natural oak,
charcoal textiles, black steel, terracotta, muted greens - with personal clutter for colour.

## Rules for everything we model

- **Real dimensions.** Desk top at 75 cm, seat at ~47 cm, 2.8 m ceiling. A piece that is the
  wrong size looks fake whatever its detail.
- **Real construction.** Show how a thing is built: legs, frames, rails, casters, seams, a
  hinge. No single boxes standing in for furniture.
- **Real materials.** Physically based (`MeshStandardMaterial` / `MeshPhysicalMaterial`):
  lacquered wood has grain and a soft clear coat, metal reflects the room, fabric has a weave and
  sheen. Textures are painted procedurally (`room/materials.ts`) - no downloads, no licences,
  identical on every device.
- **Real light.** ACES tone mapping, an environment map for reflections (`RoomEnvironment`),
  daylight through the window, warm lamps at night.
- **Fast on weak devices too.** Detail costs frame time: prefer standard PBR to clear coat and
  sheen, reflections only on metal. `AdaptiveResolution` drops the pixel ratio when frames get
  slow (never below 0.75; WebGL without a GPU starts at 0.5 and draws no shadows) instead of
  letting the room stutter.
- **Lived in.** Every surface carries a sign of use: a mug, a notebook, a plant.
- **Footprints stay the truth.** Models are visual; walking, sitting and physics use the
  footprints and seats in `room/layout.ts`. A model must fit its footprint (tested).

## Where we are

| Piece                                                | State                                                   |
| ---------------------------------------------------- | ------------------------------------------------------- |
| Desk (oak, steel frame, laptop, plant, notebook)     | realistic (`room/furniture/desk.ts`)                    |
| Office chair (5-star base, mesh back, swivel)        | realistic (`room/furniture/office-chair.ts`)            |
| Sofa (oak legs, seat + back cushions, pillow, throw) | realistic (`room/furniture/sofa.ts`)                    |
| Bed (oak frame, headboard, linen, duvet), nightstand | realistic (`room/furniture/bed.ts`)                     |
| Loose props (mug, books, throw pillow)               | realistic (`room/furniture/props.ts`), moved by physics |
| Kitchenette, fridge                                  | realistic (`room/furniture/kitchen.ts`)                 |
| Floor lamp (oak tripod, linen drum shade)            | realistic (`room/furniture/floor-lamp.ts`)              |
| Walls, floor, skirting, door, window, rug, prints    | realistic (`room/architecture.ts`)                      |
| Character                                            | realistic (`tools/character`, `character/human-rig.ts`) |

The back window looks out on the tenement across the street under the real sky; its windows
light up at night. The street is drawn only through the glass (a stencil mask), so it never
shows around the room when the camera looks in from above.

The duvet is a deformable sheet: flat on the made bed, draping over the edges, raised over the
body (chest, legs, toes) as the character lies down - computed per vertex, not a box on top.
Seats say how far the character leans back (`seat.recline`): deep into the sofa, upright on
the desk chair and the edge of the bed.

## The character: fully realistic

Four people (`tools/character/variants.json`): two women and two men in their late twenties,
different in build, skin, hair and clothes. Each world gets one, picked from its id like its
name; the voice is picked to fit (`prefer` in `voice/tts.ts`).

1. **Model** - MakeHuman via MPFB (CC0 output), built headless in Blender by
   `tools/character/build_character.py`: body shaped from its macro targets, realistic skin,
   eyes, brows, lashes, teeth, hair, everyday clothes; MPFB's `game_engine` skeleton (53 bones,
   fingers included). Exported as glTF with WebP textures, ~2 MB, loaded after the room.
2. **Animation** - motion capture where the body moves freely: standing (weight shifting from
   leg to leg, toned down), walking (heel to toe, swinging hips and arms, phase-locked to the
   walking speed), sweeping, dancing, waving - real people from the CMU Graphics Lab Motion
   Capture Database (free for any use), converted by `packages/game/scripts/mocap.mjs` into
   `/characters/motions.json`. Each bone is lined up with the take's T-pose (limbs; the trunk
   as it is) and plays the take's rotations - one set of motions for every body. Procedural
   poses where the flat decides: sitting on its chair, lying in its bed, hands on a keyboard or
   a bowl, looking at the player; `HumanRig` blends the two bone by bone. Hands rest with curled
   fingers; shoes come off in bed. The face has morph targets: `jawOpen` (talking) and `blink`
   (every few seconds, closed in bed), made from MakeHuman's face bones.
3. **Performance** - without a GPU (software WebGL) the simple placeholder figure stays: a
   skinned body would be too slow there.

Next: captured sitting down, getting up and lying down; more takes per activity; visemes from
the voice; eye contact with the player; more people.

Realism raises the bar for animation too (the uncanny valley is worse than honest
stylisation): procedural poses are the floor, not the goal.
