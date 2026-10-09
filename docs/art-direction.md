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
  slow (never below 0.75) instead of letting the room stutter.
- **Lived in.** Every surface carries a sign of use: a mug, a notebook, a plant.
- **Footprints stay the truth.** Models are visual; walking, sitting and physics use the
  footprints and seats in `room/layout.ts`. A model must fit its footprint (tested).

## Where we are

| Piece                                                | State                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Desk (oak, steel frame, laptop, plant, notebook)     | realistic (`room/furniture/desk.ts`)                           |
| Office chair (5-star base, mesh back, swivel)        | realistic (`room/furniture/office-chair.ts`)                   |
| Sofa (oak legs, seat + back cushions, pillow, throw) | realistic (`room/furniture/sofa.ts`)                           |
| Bed (oak frame, headboard, linen, duvet), nightstand | realistic (`room/furniture/bed.ts`)                            |
| Loose props (mug, books, throw pillow)               | realistic (`room/furniture/props.ts`), moved by physics        |
| Kitchenette, fridge, floor lamp, door                | placeholder blocks - next                                      |
| Walls, floor, window                                 | flat colours - need plaster, wooden floor boards, a real frame |
| Character                                            | primitive placeholder - the biggest gap; needs a rigged model  |

The duvet is a deformable sheet: flat on the made bed, draping over the edges, raised over the
body (chest, legs, toes) as the character lies down - computed per vertex, not a box on top.
Seats say how far the character leans back (`seat.recline`): deep into the sofa, upright on
the desk chair and the edge of the bed.

The character is the hardest part: a realistic person needs a rigged, skinned model with
facial animation, and realism raises the bar for animation too (the uncanny valley is worse
than honest stylisation). That decision - authored model vs. generated, how realistic - is open.
