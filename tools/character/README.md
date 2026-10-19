# Characters

The people who live in the worlds: realistic, built from MakeHuman's CC0 assets,
exported as glTF to `apps/web/static/characters/<id>.glb`. Each world gets one,
picked from its id (`lookFor` in `packages/game/src/character/looks.ts`).

| id    | who                                   |
| ----- | ------------------------------------- |
| ava   | woman, late 20s, ponytail, sportswear |
| theo  | man, late 20s, white tee and jeans    |
| maya  | woman, late 20s, afro, tee and jeans  |
| kenji | man, late 20s, shirt and jeans        |

`variants.json` describes them (MakeHuman macro values, skin, eyes, brows, hair, clothes).
`build_character.py` builds them in Blender, headless:

- MakeHuman base mesh shaped by the macros, with skin, eyes, brows, lashes, teeth, tongue,
  hair, clothes and shoes;
- skinned to MPFB's `game_engine` skeleton (53 bones, fingers included) - the game drives it
  from its own poses (`HumanRig`);
- face shapes as morph targets (`jawOpen`, `blink`), made by posing the face bones of
  MakeHuman's `default` skeleton and keeping the difference;
- textures scaled down (skin 1024 px, the rest 512 px) and stored as WebP: ~2 MB per person.

## Rebuilding

Needs Blender 4.2 LTS, the MPFB extension and MakeHuman's system asset pack:

```bash
# Blender (download.blender.org) and MPFB (github.com/makehumancommunity/mpfb2)
curl -LO https://download.blender.org/release/Blender4.2/blender-4.2.23-linux-x64.tar.xz
tar -xf blender-4.2.23-linux-x64.tar.xz
git clone --depth 1 https://github.com/makehumancommunity/mpfb2.git
mkdir -p ~/.config/blender/4.2/extensions/user_default
ln -s "$PWD/mpfb2/src/mpfb" ~/.config/blender/4.2/extensions/user_default/mpfb
blender-4.2.23-linux-x64/blender -b --factory-startup --python-expr \
  "import addon_utils, bpy; addon_utils.enable('bl_ext.user_default.mpfb', default_set=True, persistent=True); bpy.ops.wm.save_userpref()"

# MakeHuman system assets (skins, hair, clothes...), CC0
curl -LO https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip
mkdir -p ~/.config/blender/4.2/extensions/.user/user_default/mpfb/data
unzip makehuman_system_assets_cc0.zip -d ~/.config/blender/4.2/extensions/.user/user_default/mpfb/data

# Build all (or name the ids to build)
blender-4.2.23-linux-x64/blender -b --python tools/character/build_character.py -- apps/web/static/characters
```

## Licences

The models are CC0: MakeHuman's base mesh, targets and system assets are CC0, and so is what
MPFB generates from them. MPFB itself (GPL) is only the build tool; none of its code ships.

## Motion capture

`apps/web/static/characters/motions.json` holds the motions every character plays (walking,
standing, sweeping, dancing, waving, a yawn). They come from the CMU Graphics Lab Motion Capture
Database (free for any use, including commercial) in Bruce Hahne's BVH conversion
(github.com/Shriinivas/cmubvh). To rebuild, put the takes named in `CLIPS` in
`packages/game/scripts/mocap.mjs` into a folder and run:

```bash
node packages/game/scripts/mocap.mjs <folder with the .bvh files>
```
