# HOLLOW SUN – asset pipeline (P0): builds the test assets in Blender and exports them as GLB.
#   DM_crypt_rS_X_a – crypt room module from the Game Design Bible's catalogue (5×5 cells of 2 m,
#                     door sockets on all four sides, bevelled walls, vertex-colour AO, 2 materials)
#   CH_ak_body      – placeholder Ash Knight body; LOD1/LOD2 come from LOD0 through Decimate
# Run headless (apps/web/scripts/hollowsun-assets.mjs does this, then compresses the GLBs with gltfpack):
#   blender -b --factory-startup --python hollowsun_assets.py -- <output folder>
# Every export must pass src/lib/games/hollowsun-assets.test.ts.
import json
import os
import sys

import bmesh
import bpy

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.getcwd()
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, rgba, rough=0.85, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    return m


def add_box(bm, a, b, mat_index):
    """Axis-aligned box from corner a to corner b (Blender coordinates, Z up)."""
    verts = [bm.verts.new((x, y, z)) for x in (a[0], b[0]) for y in (a[1], b[1]) for z in (a[2], b[2])]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    for f in faces:
        face = bm.faces.new([verts[i] for i in f])
        face.material_index = mat_index
    return verts


def add_cylinder(bm, cx, cy, r, z0, z1, seg, mat_index):
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=z1 - z0)
    for v in res["verts"]:
        v.co.x += cx
        v.co.y += cy
        v.co.z += (z0 + z1) / 2
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index = mat_index


def finish(name, bm, mats, ao_height):
    """Mesh object from a bmesh: recalculated normals, vertex-colour AO by height, triangulated."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    attr = me.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
    for i, v in enumerate(me.vertices):
        ao = min(1.0, 0.55 + 0.45 * min(1.0, v.co.z / max(0.5, ao_height)))
        attr.data[i].color = (ao, ao, ao, 1.0)
    me.color_attributes.active_color = attr
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    return obj


def socket(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    if parent:
        e.parent = parent
    bpy.context.collection.objects.link(e)
    return e


def tris(obj):
    me = obj.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    obj.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
    return n


def export(asset, objects, materials, sockets, meta, rig=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects + sockets + ([rig] if rig else []):
        o.select_set(True)
    path = os.path.join(OUT, asset + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=False,
        export_materials="EXPORT",
        export_vertex_color="ACTIVE",
        export_extras=False,
        export_skins=rig is not None,
        export_animations=rig is not None,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_step=1,
    )
    return {
        "id": asset,
        "file": asset + ".glb",
        "bytes": os.path.getsize(path),
        "materials": [m.name for m in materials],
        "parts": [{"name": o.name, "tris": tris(o)} for o in objects],
        "sockets": [s.name for s in sockets],
        "meta": meta,
    }


def crypt_room():
    """10 × 10 m room, walls 4 m, doors 4 m wide × 3 m high in the middle of every side."""
    reset()
    stone = material("M_crypt_stone", (0.36, 0.33, 0.31, 1))
    trim = material("M_crypt_trim", (0.42, 0.24, 0.14, 1), rough=0.6)
    S, H, T, DOOR, DH = 5.0, 4.0, 0.5, 2.0, 3.0
    bm = bmesh.new()
    add_box(bm, (-S, -S, -0.2), (S, S, 0), 0)
    for x in range(-5, 5, 2):  # floor tiles on the 2 m grid
        for y in range(-5, 5, 2):
            add_box(bm, (x + 0.06, y + 0.06, 0), (x + 1.94, y + 1.94, 0.04), 0)
    walls = bmesh.new()
    for side in range(4):  # two wall pieces per side, door gap in the middle, trim lintel above
        for a, b in ((-S, -DOOR), (DOOR, S)):
            if side == 0:
                add_box(walls, (a, -S, 0), (b, -S + T, H), 0)
            elif side == 1:
                add_box(walls, (a, S - T, 0), (b, S, H), 0)
            elif side == 2:
                add_box(walls, (-S, a, 0), (-S + T, b, H), 0)
            else:
                add_box(walls, (S - T, a, 0), (S, b, H), 0)
        lintel = [((-DOOR, -S, DH), (DOOR, -S + T, H)), ((-DOOR, S - T, DH), (DOOR, S, H)), ((-S, -DOOR, DH), (-S + T, DOOR, H)), ((S - T, -DOOR, DH), (S, DOOR, H))][side]
        add_box(walls, lintel[0], lintel[1], 1)
    for x, y, s in ((2.6, -2.2, 0.5), (-3.1, 1.7, 0.35), (1.2, 3.4, 0.3)):  # rubble
        add_box(walls, (x - s, y - s * 0.8, 0), (x + s, y + s * 0.8, s * 0.9), 0)
    bmesh.ops.bevel(walls, geom=list(walls.edges), offset=0.04, segments=1, affect="EDGES")
    for x in (-1, 1):  # corner pillars inside the footprint
        for y in (-1, 1):
            add_cylinder(walls, x * (S - 0.45), y * (S - 0.45), 0.45, 0, H + 0.4, 12, 1)
    tmp = bpy.data.meshes.new("tmp")
    walls.to_mesh(tmp)
    walls.free()
    bm.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)
    room = finish("DM_crypt_rS_X_a", bm, [stone, trim], H)
    # door sockets: centre of each opening on the floor (Blender -Y is glTF +Z)
    socks = [socket("socket_door_N", (0, S, 0)), socket("socket_door_S", (0, -S, 0)), socket("socket_door_W", (-S, 0, 0)), socket("socket_door_E", (S, 0, 0))]
    return export("DM_crypt_rS_X_a", [room], [stone, trim], socks, {"cells": [5, 5], "cellSize": 2, "size": [10, H, 10], "trisBudget": 3000, "source": "blender"})


# The shared humanoid rig (Bible D16: one skeleton for every class, at most 65 bones).
# (name, parent, head, tail) in Blender coordinates; the character faces -Y (glTF +Z).
FPS = 30
BONES = [("root", None, (0, 0, 0), (0, 0, 0.2)),
         ("pelvis", "root", (0, 0, 0.95), (0, 0, 1.05)),
         ("spine", "pelvis", (0, 0, 1.05), (0, 0, 1.25)),
         ("chest", "spine", (0, 0, 1.25), (0, 0, 1.45)),
         ("neck", "chest", (0, 0, 1.45), (0, 0, 1.53)),
         ("head", "neck", (0, 0, 1.53), (0, 0, 1.78))]
for _s, _x in (("L", 1), ("R", -1)):
    BONES += [("clavicle_" + _s, "chest", (0.05 * _x, 0, 1.42), (0.3 * _x, 0, 1.42)),
              ("upperarm_" + _s, "clavicle_" + _s, (0.34 * _x, 0, 1.4), (0.36 * _x, 0, 1.12)),
              ("forearm_" + _s, "upperarm_" + _s, (0.36 * _x, 0, 1.12), (0.38 * _x, 0, 0.86)),
              ("hand_" + _s, "forearm_" + _s, (0.38 * _x, 0, 0.86), (0.39 * _x, 0, 0.74)),
              ("thigh_" + _s, "pelvis", (0.14 * _x, 0, 0.95), (0.14 * _x, 0, 0.52)),
              ("shin_" + _s, "thigh_" + _s, (0.14 * _x, 0, 0.52), (0.14 * _x, 0, 0.1)),
              ("foot_" + _s, "shin_" + _s, (0.14 * _x, 0, 0.1), (0.14 * _x, -0.16, 0.03))]


def rig():
    data = bpy.data.armatures.new("RIG_human")
    arm = bpy.data.objects.new("RIG_human", data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name, parent, head, tail in BONES:
        b = data.edit_bones.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
    return arm


def clip(arm, name, frames, keys):
    """Action AN_human_<name>: keys = {bone: [(frame, (rx, ry, rz)) or (frame, rot, loc)]}."""
    act = bpy.data.actions.new("AN_human_" + name)
    act.use_fake_user = True
    arm.animation_data_create().action = act
    for bone, seq in keys.items():
        pb = arm.pose.bones[bone]
        for k in seq:
            pb.rotation_euler = k[1]
            pb.keyframe_insert("rotation_euler", frame=k[0])
            if len(k) > 2:
                pb.location = k[2]
                pb.keyframe_insert("location", frame=k[0])
    act.frame_range = (0, frames)
    for pb in arm.pose.bones:  # back to the rest pose
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    return {"name": act.name, "frames": frames, "seconds": round(frames / FPS, 3)}


def clips(arm):
    """Placeholder motion: enough to test the skin, blending and root motion."""
    import math
    out = []
    # idle 2 s: breathing chest, arms a little out
    out.append(clip(arm, "idle", 60, {
        "chest": [(f, (0.04 * math.sin(f / 60 * 2 * math.pi), 0, 0)) for f in (0, 15, 30, 45, 60)],
        "upperarm_L": [(f, (0, 0, -0.08 - 0.02 * math.sin(f / 60 * 2 * math.pi))) for f in (0, 15, 30, 45, 60)],
        "upperarm_R": [(f, (0, 0, 0.08 + 0.02 * math.sin(f / 60 * 2 * math.pi))) for f in (0, 15, 30, 45, 60)],
    }))
    # run 0.8 s: legs and arms in opposition, lean forward, pelvis bob (root stays in place)
    ph = lambda f, off=0.0: math.sin((f / 24 + off) * 2 * math.pi)
    fr = range(0, 25, 3)
    out.append(clip(arm, "run", 24, {
        "spine": [(f, (-0.18, 0, 0)) for f in (0, 24)],
        "thigh_L": [(f, (0.55 * ph(f), 0, 0)) for f in fr],
        "thigh_R": [(f, (-0.55 * ph(f), 0, 0)) for f in fr],
        "shin_L": [(f, (-0.6 * max(0.0, ph(f, 0.25)), 0, 0)) for f in fr],
        "shin_R": [(f, (-0.6 * max(0.0, -ph(f, 0.25)), 0, 0)) for f in fr],
        "upperarm_L": [(f, (-0.6 * ph(f), 0, -0.1)) for f in fr],
        "upperarm_R": [(f, (0.6 * ph(f), 0, 0.1)) for f in fr],
        "pelvis": [(f, (0, 0, 0), (0, 0.04 * abs(ph(f)), 0)) for f in fr],
    }))
    # attack 0.9 s: wind-up, overhead swing of the right arm, step forward = root motion 0.6 m
    # (pose-space location of the root bone: it points up, so its local +Z is the character's forward)
    out.append(clip(arm, "attack", 27, {
        "root": [(0, (0, 0, 0), (0, 0, 0)), (8, (0, 0, 0), (0, 0, 0)), (16, (0, 0, 0), (0, 0, 0.6)), (27, (0, 0, 0), (0, 0, 0.6))],
        "chest": [(0, (0, 0, 0)), (8, (0.1, 0.5, 0)), (14, (-0.25, -0.4, 0)), (27, (0, 0, 0))],
        "upperarm_R": [(0, (0, 0, 0)), (8, (2.6, 0, 0.3)), (14, (-0.4, 0, 0.1)), (27, (0, 0, 0))],
        "forearm_R": [(0, (0, 0, 0)), (8, (0.9, 0, 0)), (14, (0.1, 0, 0)), (27, (0, 0, 0))],
        "thigh_L": [(0, (0, 0, 0)), (12, (0.5, 0, 0)), (27, (0, 0, 0))],
    }))
    # death 1.2 s: knees give way, falls backwards onto the ground
    out.append(clip(arm, "death", 36, {
        "root": [(0, (0, 0, 0)), (12, (-0.3, 0, 0)), (30, (-1.5, 0, 0)), (36, (-1.55, 0, 0))],
        "thigh_L": [(0, (0, 0, 0)), (12, (0.6, 0, 0)), (36, (0.2, 0, 0))],
        "thigh_R": [(0, (0, 0, 0)), (12, (0.5, 0, 0)), (36, (0.1, 0, 0))],
        "head": [(0, (0, 0, 0)), (30, (0, 0, 0)), (36, (-0.4, 0.3, 0))],
        "upperarm_L": [(0, (0, 0, 0)), (36, (0, 0, -1.2))],
        "upperarm_R": [(0, (0, 0, 0)), (36, (0, 0, 1.2))],
    }))
    arm.animation_data.action = None
    return out


def knight():
    """Placeholder Ash Knight (1.78 m) on the shared rig: rigid parts skinned to one bone each,
    LOD0 modelled, LOD1/LOD2 decimated from it, four placeholder clips."""
    reset()
    bpy.context.scene.render.fps = FPS
    steel = material("M_ak_steel", (0.23, 0.25, 0.29, 1), rough=0.45, metal=0.6)
    ember = material("M_ak_ember", (0.93, 0.48, 0.23, 1), rough=0.5)
    arm = rig()
    bm = bmesh.new()
    seg = 32
    parts = []  # (first vertex, end vertex, bone)

    def part(bone, build):
        a = len(bm.verts)
        build()
        parts.append((a, len(bm.verts), bone))

    part("pelvis", lambda: add_cylinder(bm, 0, 0, 0.26, 0.85, 1.05, seg, 0))
    part("pelvis", lambda: add_cylinder(bm, 0, 0, 0.29, 0.98, 1.06, seg, 1))  # belt
    part("spine", lambda: add_cylinder(bm, 0, 0, 0.25, 1.05, 1.26, seg, 0))
    part("chest", lambda: add_cylinder(bm, 0, 0, 0.27, 1.25, 1.47, seg, 0))
    part("neck", lambda: add_cylinder(bm, 0, 0, 0.07, 1.45, 1.55, 16, 0))

    def head():
        h = bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=0.14)
        for v in h["verts"]:
            v.co.z += 1.66
    part("head", head)
    for s, x in (("L", 1), ("R", -1)):
        part("upperarm_" + s, lambda x=x: add_cylinder(bm, 0.35 * x, 0, 0.08, 1.12, 1.4, seg, 0))
        part("upperarm_" + s, lambda x=x: add_cylinder(bm, 0.33 * x, 0, 0.14, 1.32, 1.48, seg, 1))  # pauldron
        part("forearm_" + s, lambda x=x: add_cylinder(bm, 0.37 * x, 0, 0.07, 0.86, 1.12, seg, 0))
        part("hand_" + s, lambda x=x: add_cylinder(bm, 0.385 * x, 0, 0.055, 0.74, 0.86, 16, 0))
        part("thigh_" + s, lambda x=x: add_cylinder(bm, 0.14 * x, 0, 0.11, 0.52, 0.9, seg, 0))
        part("shin_" + s, lambda x=x: add_cylinder(bm, 0.14 * x, 0, 0.1, 0.1, 0.52, seg, 0))
        part("foot_" + s, lambda x=x: add_box(bm, (0.14 * x - 0.07, -0.2, 0), (0.14 * x + 0.07, 0.07, 0.1), 0))
    lod0 = finish("CH_ak_body_LOD0", bm, [steel, ember], 2.0)
    # rigid skin: every part follows its bone with weight 1
    for a, b, bone in parts:
        vg = lod0.vertex_groups.get(bone) or lod0.vertex_groups.new(name=bone)
        vg.add(list(range(a, b)), 1.0, "REPLACE")
    lod0.parent = arm
    lod0.modifiers.new("Armature", "ARMATURE").object = arm
    lods = [lod0]
    for level, ratio in ((1, 0.22), (2, 0.07)):
        o = lod0.copy()
        o.data = lod0.data.copy()
        o.name = o.data.name = "CH_ak_body_LOD%d" % level
        bpy.context.collection.objects.link(o)
        mod = o.modifiers.new("Decimate", "DECIMATE")  # after the Armature modifier
        mod.ratio = ratio
        lods.append(o)
    lod0.data.name = "CH_ak_body_LOD0"
    hand = bpy.data.objects.new("socket_hand_R", None)  # weapon socket follows the right hand
    bpy.context.collection.objects.link(hand)
    hand.parent = arm
    hand.parent_type = "BONE"
    hand.parent_bone = "hand_R"
    anims = clips(arm)
    meta = {"height": 1.78, "trisBudget": [25000, 9000, 3000], "source": "blender",
            "rig": {"name": "RIG_human", "bones": len(BONES)}, "clips": anims}
    return export("CH_ak_body", lods, [steel, ember], [hand], meta, rig=arm)


manifest = {"generated": "scripts/blender/hollowsun_assets.py (Blender %s)" % bpy.app.version_string, "assets": [crypt_room(), knight()]}
with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent="\t")
    f.write("\n")
for a in manifest["assets"]:
    print("HSASSET", a["id"], a["bytes"], " ".join("%s:%d" % (p["name"], p["tris"]) for p in a["parts"]))
