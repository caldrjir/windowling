# HOLLOW SUN – characters from Scenario (Game Design Bible D34): turns the textured meshes that
# Meshy 7.1 made from the AI concepts into game assets (the player's CH_ak_knight, enemies EN_*,
# bosses BO_*).
#   1. import the GLB, join it, scale it to its height, stand it on the ground facing -Y (glTF +Z)
#   2. humanoids: build RIG_hero with the arm chains laid along the model's A-pose arms
#   3. skin by distance to the bone segments (blend of the two nearest bones; AI meshes are rarely
#      clean enough for bone-heat weighting)
#   4. pose the arms down to RIG_hero's rest pose, bake that into the mesh and make it the rest pose,
#      so the shared clips (AN_hero_*) play on it like on CH_ak_body
#   5. ember emission map from the albedo's glowing cracks, vertex-colour AO, LOD1/LOD2 by Decimate
#   Quadrupeds (EN_hound) have no rig yet: a static mesh with LODs that the game moves as a whole.
#   Props (PR_<biome>_<kind>) take the same path without a rig.
# Run headless (hollowsun-assets.mjs does this with --char=<ID>=<source.glb>):
#   blender -b --factory-startup --python hollowsun_char.py -- <output folder> <ID> <source.glb>
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hollowsun_assets as H  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TEX = 1024
# height in metres (the game scales enemies further: CH_SCALE in game.js), LOD1/LOD2 triangle
# targets, the Bible's triangle budget per LOD, rig (False = static quadruped), turn (degrees about Z
# so the model faces -Y; Meshy keeps the concept's view)
SPECS = {
    "CH_ak_knight": {"height": 1.78, "lods": (8000, 2600), "budget": [25000, 9000, 3000], "rig": True, "turn": 0},
    "EN_thrall": {"height": 1.78, "lods": (3600, 1300), "budget": [10000, 4000, 1500], "rig": True, "turn": 0},
    "EN_brute": {"height": 1.78, "lods": (3600, 1300), "budget": [10000, 4000, 1500], "rig": True, "turn": 0},
    "EN_bowman": {"height": 1.78, "lods": (3600, 1300), "budget": [10000, 4000, 1500], "rig": True, "turn": 0},
    "EN_acolyte": {"height": 1.78, "lods": (3600, 1300), "budget": [10000, 4000, 1500], "rig": True, "turn": 0},
    "EN_hound": {"height": 0.95, "lods": (3600, 1300), "budget": [10000, 4000, 1500], "rig": False, "turn": 0},
    "BO_kiln": {"height": 1.78, "lods": (12000, 4500), "budget": [45000, 15000, 5000], "rig": True, "turn": 0},
    # props (2026-11-18): static, real-world height; the game scales them to the collision radius
    "PR_crypt_pillar": {"height": 3.2, "lods": (2600, 900), "budget": [10000, 4000, 1500], "rig": False, "turn": 0, "date": "2026-11-18", "tex": 512},
    "PR_crypt_wall": {"height": 2.2, "lods": (3000, 1000), "budget": [12000, 5000, 2000], "rig": False, "turn": 0, "date": "2026-11-18", "tex": 512},
    "PR_crypt_lantern": {"height": 2.6, "lods": (1400, 500), "budget": [6000, 2500, 1000], "rig": False, "turn": 0, "date": "2026-11-18", "tex": 512},
    "PR_crypt_chest": {"height": 0.8, "lods": (1600, 600), "budget": [6000, 2500, 1000], "rig": False, "turn": 0, "date": "2026-11-18", "tex": 512},
    "PR_crypt_brazier": {"height": 1.2, "lods": (2000, 700), "budget": [8000, 3000, 1200], "rig": False, "turn": 0, "date": "2026-11-18", "tex": 512},
    "PR_crypt_arch": {"height": 3.6, "lods": (3000, 1000), "budget": [12000, 5000, 2000], "rig": False, "turn": 0, "date": "2026-11-18", "tex": 512},
    "PR_kiln_anvil": {"height": 2.4, "lods": (3200, 1100), "budget": [12000, 5000, 2000], "rig": False, "turn": 0, "date": "2026-11-18", "tex": 512},
}
ID = ARGS[1] if len(ARGS) > 1 else "CH_ak_knight"
SRC = ARGS[2] if len(ARGS) > 2 else "D:/hollowsun-art/raw/3d/ak_knight_meshy.glb"
SPEC = SPECS[ID]
TEX = SPEC.get("tex", TEX)  # props are small on screen: 512 px maps
HEIGHT = SPEC["height"]


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.length_squared)))
    return (a + ab * t - p).length


def import_mesh():
    bpy.ops.import_scene.gltf(filepath=SRC)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.context.scene.objects):  # empties from the importer
        if o != obj:
            bpy.data.objects.remove(o)
    me = obj.data
    if SPEC["turn"]:
        rot = Matrix.Rotation(SPEC["turn"] * 3.14159265 / 180, 4, "Z")
        me.transform(rot)
    lo = Vector((min(v.co[i] for v in me.vertices) for i in range(3)))
    hi = Vector((max(v.co[i] for v in me.vertices) for i in range(3)))
    s = HEIGHT / (hi.z - lo.z)
    off = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for v in me.vertices:
        v.co = (v.co - off) * s
    me.update()
    return obj


def arm_line(me, x_sign):
    """Shoulder → fingertip of the A-pose arm on one side (Blender +X is the character's left)."""
    pts = [v.co for v in me.vertices if v.co.x * x_sign > 0.3 and 0.6 < v.co.z < 1.5]
    tip = max(pts, key=lambda c: c.x * x_sign - 0.3 * c.z)  # farthest out and low: the fingertips
    near = [c for c in pts if (c - tip).length < 0.08]
    tip = sum(near, Vector()) / len(near)
    # the shoulder sits further out on broad bodies (brute, boss): 40 % of the way to the fingertips
    shoulder = Vector((max(0.2, 0.4 * abs(tip.x)) * x_sign, 0.0, 1.42))
    ys = [c.y for c in pts if c.x * x_sign < 0.42]
    shoulder.y = sum(ys) / len(ys) if ys else 0.0
    return shoulder, tip


def build_rig(me):
    arm = H.rig()
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    lines = {}
    for s, x in (("L", 1), ("R", -1)):
        sh, tip = arm_line(me, x)
        lines[s] = (sh, tip)
        d = tip - sh
        eb["clavicle_" + s].tail = sh
        eb["upperarm_" + s].head, eb["upperarm_" + s].tail = sh, sh + d * 0.46
        eb["forearm_" + s].head, eb["forearm_" + s].tail = sh + d * 0.46, sh + d * 0.84
        eb["hand_" + s].head, eb["hand_" + s].tail = sh + d * 0.84, tip
        # legs: from the hip to the middle of the boot sole on this side
        feet = [v.co for v in me.vertices if v.co.x * x > 0.02 and v.co.z < 0.12]
        fx = sum(c.x for c in feet) / len(feet) if feet else 0.14 * x
        fy = sum(c.y for c in feet) / len(feet) if feet else 0.0
        hip = Vector((0.12 * x, fy, 0.95))
        ankle = Vector((fx, fy, 0.1))
        eb["thigh_" + s].head, eb["thigh_" + s].tail = hip, hip.lerp(ankle, 0.5)
        eb["shin_" + s].head, eb["shin_" + s].tail = hip.lerp(ankle, 0.5), ankle
        eb["foot_" + s].head, eb["foot_" + s].tail = ankle, ankle + Vector((0, -0.16, -0.07))
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm, lines


def skin(obj, arm):
    """Weights from the distance to each bone segment: the two nearest bones, inverse distance^4."""
    segs = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in arm.data.bones if b.name != "root"]
    groups = {n: obj.vertex_groups.new(name=n) for n, _a, _b in segs}
    for v in obj.data.vertices:
        p = v.co
        d = sorted(((seg_dist(p, a, b), n) for n, a, b in segs))[:2]
        w = [1.0 / max(1e-4, x) ** 4 for x, _n in d]
        tot = sum(w)
        for (dist, n), wi in zip(d, w):
            if wi / tot > 0.02:
                groups[n].add([v.index], wi / tot, "REPLACE")
    obj.parent = arm
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    return mod


def lower_arms(obj, arm, mod):
    """Rotate the A-pose arms down to RIG_hero's rest direction, bake it, make it the rest pose."""
    rest = {name: (Vector(head), Vector(tail)) for name, _p, head, tail in H.BONES}
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for s in ("L", "R"):
        pb = arm.pose.bones["upperarm_" + s]
        b = arm.data.bones["upperarm_" + s]
        cur = (b.tail_local - b.head_local).normalized()
        h, t = rest["upperarm_" + s]
        want = (t - h).normalized()
        q = cur.rotation_difference(want)
        # rotation about the bone head in armature space
        m = Matrix.Translation(b.head_local) @ q.to_matrix().to_4x4() @ Matrix.Translation(-b.head_local)
        pb.matrix = m @ b.matrix_local
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode="OBJECT")
    # bake the posed arms into the mesh, then make the pose the new rest pose
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm


def emission_from_albedo(mat):
    """Glowing cracks: bright, saturated orange pixels of the albedo become the emissive map."""
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    link = bsdf.inputs["Base Color"].links
    if not link:
        return
    src = link[0].from_node.image
    w, h = src.size
    px = list(src.pixels)
    out = [0.0] * len(px)
    for i in range(0, len(px), 4):
        r, g, b = px[i], px[i + 1], px[i + 2]
        glow = max(0.0, min(1.0, (r - 0.45) * 3)) * max(0.0, min(1.0, (r - 1.6 * g) * 4)) * (1 if b < 0.35 else 0)
        out[i], out[i + 1], out[i + 2], out[i + 3] = r * glow, g * glow, b * glow, 1.0
    img = bpy.data.images.new("T_%s_emissive" % ID, w, h)
    img.pixels = out
    img.file_format = "PNG"
    img.pack()
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = img
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 2.0


def ao(obj):
    me = obj.data
    attr = me.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
    for i, v in enumerate(me.vertices):
        a = min(1.0, 0.72 + 0.28 * min(1.0, v.co.z / 1.2))
        attr.data[i].color = (a, a, a, 1.0)
    me.color_attributes.active_color = attr


def export(lods, mats, hand, arm, meta):
    # textures at most 1024 px as WebP (EXT_texture_webp): the node.js gltfpack cannot encode
    # textures, and four 2K maps would cost ~85 MB of GPU memory for one character
    for img in bpy.data.images:
        if img.size[0] > TEX:
            img.scale(TEX, TEX)
    bpy.ops.object.select_all(action="DESELECT")
    for o in lods + [x for x in (hand, arm) if x]:
        o.select_set(True)
    path = os.path.join(H.OUT, ID + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_normals=True, export_texcoords=True, export_materials="EXPORT", export_image_format="WEBP", export_image_quality=88,
        export_vertex_color="ACTIVE", export_extras=False, export_skins=arm is not None, export_animations=arm is not None,
        export_animation_mode="ACTIONS", export_force_sampling=True, export_frame_step=1)
    return {"id": ID, "file": ID + ".glb", "bytes": os.path.getsize(path),
            "materials": [m.name for m in mats], "parts": [{"name": o.name, "tris": H.tris(o)} for o in lods],
            "sockets": [hand.name] if hand else [], "meta": meta}


def character():
    H.reset()
    bpy.context.scene.render.fps = H.FPS
    obj = import_mesh()
    arm = None
    if SPEC["rig"]:
        arm, _lines = build_rig(obj.data)
        mod = skin(obj, arm)
        lower_arms(obj, arm, mod)
    mats = [m for m in obj.data.materials if m]
    base = "M_" + (ID.split("_", 1)[1] if ID.startswith("CH_") else ID.lower())
    for i, m in enumerate(mats):
        m.name = base if i == 0 else "%s_%d" % (base, i)
    if mats:
        emission_from_albedo(mats[0])
    ao(obj)
    obj.name = obj.data.name = ID + "_LOD0"
    lods = [obj]
    tri0 = H.tris(obj)
    for level, target in zip((1, 2), SPEC["lods"]):
        o = obj.copy()
        o.data = obj.data.copy()
        o.name = o.data.name = "%s_LOD%d" % (ID, level)
        bpy.context.collection.objects.link(o)
        d = o.modifiers.new("Decimate", "DECIMATE")  # after the Armature modifier
        d.ratio = target / tri0
        lods.append(o)
    meta = {"height": HEIGHT, "trisBudget": SPEC["budget"], "source": "scenario",
            "origin": {"concept": "GPT Image 2.5 Sunburst", "mesh": "Meshy 7.1 image to 3D", "via": "Scenario Pro, %s (D34)" % SPEC.get("date", "2026-11-17")}}
    hand = None
    if arm:
        hand = bpy.data.objects.new("socket_hand_R", None)
        bpy.context.collection.objects.link(hand)
        hand.parent = arm
        hand.parent_type = "BONE"
        hand.parent_bone = "hand_R"
        meta["rig"] = {"name": "RIG_hero", "bones": len(H.BONES)}
        meta["clips"] = H.clips(arm)
    return export(lods, mats, hand, arm, meta)


if __name__ == "__main__":
    H.main([character])
