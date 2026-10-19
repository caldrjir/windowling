"""
Builds the character variants (tools/character/variants.json) as glTF files for the game.

Runs inside Blender with the MPFB extension and MakeHuman's system assets (CC0) installed -
see tools/character/README.md. Headless:

    blender -b --factory-startup --python tools/character/build_character.py -- <out_dir> [variant_id ...]

Each variant: MakeHuman base mesh shaped by its macro values, a skin, eyes, brows, lashes,
teeth, tongue, hair, clothes and shoes, skinned to MPFB's "game_engine" skeleton (53 bones,
fingers included). Textures are scaled down and stored as WebP to keep the files small.
"""

import importlib
import json
import os
import re
import sys

import bpy


def mpfb(module: str, name: str):
    """MPFB is an extension; its absolute module path is not known in advance."""
    for loaded in list(sys.modules):
        if loaded.endswith(module):
            return getattr(importlib.import_module(loaded), name)
    raise ValueError(f"MPFB module {module} not loaded")


HERE = os.path.dirname(os.path.abspath(__file__))
# Textures larger than this (pixels per side) are scaled down before export.
MAX_TEXTURE = {"skin": 1024, "default": 512}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures):
        for item in list(block):
            block.remove(item)


def asset(subdir: str, name: str, ext: str = ".mhclo") -> str:
    AssetService = mpfb("mpfb.services.assetservice", "AssetService")
    path = AssetService.find_asset_absolute_path(name + ext, asset_subdir=subdir)
    if path is None:
        raise RuntimeError(f"Missing MakeHuman asset {subdir}/{name}{ext}")
    return path


def set_eye_colour(basemesh, colour: str) -> None:
    ObjectService = mpfb("mpfb.services.objectservice", "ObjectService")
    eyes = ObjectService.find_object_of_type_amongst_nearest_relatives(basemesh, "Eyes")
    texture = os.path.join(os.path.dirname(asset("eyes", "materials/" + colour, ".mhmat")), colour + "_eye.png")
    image = bpy.data.images.load(texture)
    for slot in eyes.material_slots:
        for node in slot.material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image and "eye" in node.image.name.lower():
                node.image = image


def shrink_textures() -> None:
    for image in bpy.data.images:
        if image.size[0] == 0:
            continue
        limit = MAX_TEXTURE["skin"] if "skin" in image.name.lower() or "diffuse" in image.name.lower() else MAX_TEXTURE["default"]
        width, height = image.size
        if max(width, height) > limit:
            scale = limit / max(width, height)
            image.scale(max(1, int(width * scale)), max(1, int(height * scale)))


# Face shapes, made by posing the face bones of MakeHuman's "default" skeleton (the game
# skeleton has none): (bone, euler XYZ in radians) per shape. Exported as morph targets.
FACE_SHAPES = {
    "jawOpen": [("jaw", (0.32, 0, 0))],
    "blink": [
        ("orbicularis03.L", (-0.62, 0, 0)),
        ("orbicularis03.R", (-0.62, 0, 0)),
        ("orbicularis04.L", (0.22, 0, 0)),
        ("orbicularis04.R", (0.22, 0, 0)),
    ],
}


def mesh_key(obj) -> str:
    """The same part in both builds: its name without the export suffix."""
    return re.sub(r"\.\d+$", "", obj.name.rsplit("_export", 1)[0])


def assemble(variant: dict, rig: str):
    """The character with `rig`, copied for export with modifiers baked. Returns (root, meshes)."""
    HumanService = mpfb("mpfb.services.humanservice", "HumanService")
    ExportService = mpfb("mpfb.services.exportservice", "ExportService")
    ObjectService = mpfb("mpfb.services.objectservice", "ObjectService")

    clear_scene()
    basemesh = HumanService.create_human(macro_detail_dict=variant["macro"])
    HumanService.set_character_skin(asset("skins", variant["skin"] + "/" + variant["skin"], ".mhmat"), basemesh, skin_type="GAMEENGINE")
    HumanService.add_builtin_rig(basemesh, rig)
    parts = [
        ("eyes", "high-poly", "Eyes"),
        ("eyebrows", variant["eyebrows"], "Eyebrows"),
        ("eyelashes", variant["eyelashes"], "Eyelashes"),
        ("teeth", "teeth_base", "Teeth"),
        ("tongue", "tongue01", "Tongue"),
        ("hair", variant["hair"], "Hair"),
    ] + [("clothes", name, "Clothes") for name in variant["clothes"]]
    for subdir, name, kind in parts:
        HumanService.add_mhclo_asset(asset(subdir, f"{name}/{name}"), basemesh, asset_type=kind, material_type="GAMEENGINE", subdiv_levels=0)
    set_eye_colour(basemesh, variant["eyes"])

    root = ExportService.create_character_copy(basemesh, name_suffix="_export")
    export_basemesh = ObjectService.find_object_of_type_amongst_nearest_relatives(root, "Basemesh")
    ExportService.bake_modifiers_remove_helpers(export_basemesh, bake_masks=True, bake_subdiv=True, remove_helpers=True, also_proxy=True)
    meshes = [o for o in ObjectService.get_list_of_children(root) if o.type == "MESH"]
    # The body is shaped by MakeHuman's targets (shape keys): bake them in, so the
    # only shape keys left are the face's.
    for m in meshes:
        if m.data.shape_keys:
            bpy.ops.object.select_all(action="DESELECT")
            bpy.context.view_layer.objects.active = m
            m.select_set(True)
            bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    return root, meshes


def deformed(obj) -> list:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    return [v.co.copy() for v in obj.evaluated_get(depsgraph).data.vertices]


def capture_face_shapes(variant: dict) -> dict:
    """{part: {shape: [(vertex, dx, dy, dz)]}} from posing the default skeleton's face."""
    root, meshes = assemble(variant, "default")
    rest = {mesh_key(m): deformed(m) for m in meshes}
    shapes: dict = {mesh_key(m): {} for m in meshes}
    for shape, bones in FACE_SHAPES.items():
        for bone, euler in bones:
            pose_bone = root.pose.bones[bone]
            pose_bone.rotation_mode = "XYZ"
            pose_bone.rotation_euler = euler
        bpy.context.view_layer.update()
        for m in meshes:
            key = mesh_key(m)
            moved = [
                (i, *(now - before))
                for i, (now, before) in enumerate(zip(deformed(m), rest[key]))
                if (now - before).length > 1e-5
            ]
            if moved:
                shapes[key][shape] = moved
        for bone, _ in bones:
            root.pose.bones[bone].rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
    return shapes


def add_face_shapes(meshes: list, shapes: dict) -> None:
    for m in meshes:
        for shape, moved in shapes.get(mesh_key(m), {}).items():
            if not m.data.shape_keys:
                m.shape_key_add(name="Basis", from_mix=False)
            key = m.shape_key_add(name=shape, from_mix=False)
            for i, dx, dy, dz in moved:
                if i < len(key.data):
                    key.data[i].co.x += dx
                    key.data[i].co.y += dy
                    key.data[i].co.z += dz


def build(variant: dict, out_dir: str) -> str:
    ObjectService = mpfb("mpfb.services.objectservice", "ObjectService")
    shapes = capture_face_shapes(variant)
    root, meshes = assemble(variant, "game_engine")
    add_face_shapes(meshes, shapes)
    shrink_textures()

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in ObjectService.get_list_of_children(root):
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

    path = os.path.join(out_dir, variant["id"] + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        # Modifiers are baked already; applying again would drop the face shapes.
        export_apply=False,
        export_skins=True,
        export_animations=False,
        export_morph=True,
        export_morph_normal=False,
        export_image_format="WEBP",
        export_image_quality=82,
        export_yup=True,
    )
    return path


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out_dir = os.path.abspath(args[0] if args else os.path.join(HERE, "out"))
    wanted = set(args[1:])
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(HERE, "variants.json")) as handle:
        variants = json.load(handle)["variants"]
    for variant in variants:
        if wanted and variant["id"] not in wanted:
            continue
        path = build(variant, out_dir)
        print(f"BUILT {path} {os.path.getsize(path) // 1024} KiB")


main()
