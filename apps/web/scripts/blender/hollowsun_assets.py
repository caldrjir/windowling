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


def export(asset, objects, materials, sockets, meta):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects + sockets:
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


def knight():
    """Placeholder Ash Knight (1.78 m), LOD0 modelled, LOD1/LOD2 decimated from it."""
    reset()
    steel = material("M_ak_steel", (0.23, 0.25, 0.29, 1), rough=0.45, metal=0.6)
    ember = material("M_ak_ember", (0.93, 0.48, 0.23, 1), rough=0.5)
    bm = bmesh.new()
    seg = 40
    for x in (-0.14, 0.14):
        add_cylinder(bm, x, 0, 0.11, 0, 0.85, seg, 0)  # legs
    add_cylinder(bm, 0, 0, 0.27, 0.85, 1.45, seg, 0)  # torso
    for x in (-0.38, 0.38):
        add_cylinder(bm, x, 0, 0.08, 0.85, 1.4, seg, 0)  # arms
        add_cylinder(bm, x * 0.87, 0, 0.14, 1.32, 1.48, seg, 1)  # pauldrons
    add_cylinder(bm, 0, 0, 0.29, 1.0, 1.08, seg, 1)  # belt
    head = bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=0.14)
    for v in head["verts"]:
        v.co.z += 1.64
    lod0 = finish("CH_ak_body_LOD0", bm, [steel, ember], 2.0)
    lods = [lod0]
    for level, ratio in ((1, 0.22), (2, 0.06)):
        o = lod0.copy()
        o.data = lod0.data.copy()
        o.name = o.data.name = "CH_ak_body_LOD%d" % level
        bpy.context.collection.objects.link(o)
        mod = o.modifiers.new("Decimate", "DECIMATE")
        mod.ratio = ratio
        lods.append(o)
    lod0.data.name = "CH_ak_body_LOD0"
    hand = socket("socket_hand_R", (0.38, 0, 0.9))
    return export("CH_ak_body", lods, [steel, ember], [hand], {"height": 1.78, "trisBudget": [25000, 9000, 3000], "source": "blender"})


manifest = {"generated": "scripts/blender/hollowsun_assets.py (Blender %s)" % bpy.app.version_string, "assets": [crypt_room(), knight()]}
with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent="\t")
    f.write("\n")
for a in manifest["assets"]:
    print("HSASSET", a["id"], a["bytes"], " ".join("%s:%d" % (p["name"], p["tris"]) for p in a["parts"]))
