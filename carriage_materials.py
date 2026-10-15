"""
Blender PBR Material & Mesh Utility Module for the Gothic Victorian Carriage.
Creates glTF-compatible Principled BSDF materials backed by procedural PBR textures
and provides mesh creation, bevel, UV projection, and curve helper utilities.
"""

import math
import bpy
import bmesh
from mathutils import Vector, Matrix


def clear_scene():
    """Remove all existing objects, meshes, materials, curves, and images."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for curve in list(bpy.data.curves):
        bpy.data.curves.remove(curve)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)


def _load_image(path, is_data=False):
    img = bpy.data.images.load(path, check_existing=True)
    if is_data:
        img.colorspace_settings.name = "Non-Color"
    else:
        img.colorspace_settings.name = "sRGB"
    return img


def create_pbr_material(name, albedo_path=None, normal_path=None, roughness_path=None,
                        metallic_path=None, base_color=(0.3, 0.45, 0.5, 1.0),
                        roughness=0.65, metallic=0.0, normal_strength=1.0):
    """
    Create a glTF-exportable Principled BSDF material with packed image textures.
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new(type="ShaderNodeOutputMaterial")
    out_node.location = (400, 0)

    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.location = (100, 0)
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

    if albedo_path:
        tex_albedo = nodes.new(type="ShaderNodeTexImage")
        tex_albedo.location = (-350, 250)
        tex_albedo.image = _load_image(albedo_path, is_data=False)
        links.new(tex_albedo.outputs["Color"], bsdf.inputs["Base Color"])

    if roughness_path:
        tex_rough = nodes.new(type="ShaderNodeTexImage")
        tex_rough.location = (-350, 0)
        tex_rough.image = _load_image(roughness_path, is_data=True)
        links.new(tex_rough.outputs["Color"], bsdf.inputs["Roughness"])

    if metallic_path:
        tex_metal = nodes.new(type="ShaderNodeTexImage")
        tex_metal.location = (-350, -250)
        tex_metal.image = _load_image(metallic_path, is_data=True)
        links.new(tex_metal.outputs["Color"], bsdf.inputs["Metallic"])

    if normal_path:
        tex_norm = nodes.new(type="ShaderNodeTexImage")
        tex_norm.location = (-600, -500)
        tex_norm.image = _load_image(normal_path, is_data=True)

        norm_map = nodes.new(type="ShaderNodeNormalMap")
        norm_map.location = (-250, -500)
        norm_map.inputs["Strength"].default_value = normal_strength
        links.new(tex_norm.outputs["Color"], norm_map.inputs["Color"])
        links.new(norm_map.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


def build_material_library(tex_paths):
    """Build and return dictionary of all carriage materials."""
    mats = {}

    # 1. Weathered Teal Wood (Cabin planks, carved panels, balcony base)
    mats["teal_wood"] = create_pbr_material(
        "WeatheredTealWood",
        albedo_path=tex_paths["teal_wood_albedo"],
        normal_path=tex_paths["teal_wood_normal"],
        roughness_path=tex_paths["teal_wood_roughness"],
        metallic=0.04,
        normal_strength=1.35,
    )

    # 2. Dark Slate-Blue Trim (Mouldings, pilasters, cornices, window frames, doors, roof)
    mats["slate_trim"] = create_pbr_material(
        "AgedSlateTrim",
        albedo_path=tex_paths["slate_trim_albedo"],
        normal_path=tex_paths["slate_trim_normal"],
        roughness_path=tex_paths["slate_trim_roughness"],
        metallic_path=tex_paths["slate_trim_metallic"],
        normal_strength=1.25,
    )

    # 3. Weathered Purple-Plum Wood (Wheels, spokes, felloes, axle bolsters, hitch)
    mats["purple_wood"] = create_pbr_material(
        "WeatheredPurpleWood",
        albedo_path=tex_paths["purple_wood_albedo"],
        normal_path=tex_paths["purple_wood_normal"],
        roughness_path=tex_paths["purple_wood_roughness"],
        metallic=0.05,
        normal_strength=1.25,
    )

    # 4. Wrought Iron / Dark Gunmetal (Tires, rivets, finials, steps, leaf springs)
    mats["iron"] = create_pbr_material(
        "WroughtIron",
        albedo_path=tex_paths["iron_albedo"],
        normal_path=tex_paths["iron_normal"],
        roughness_path=tex_paths["iron_roughness"],
        metallic_path=tex_paths["iron_metallic"],
        normal_strength=1.1,
    )

    # 5. Aged Bone (Sculpted skulls & bone brackets)
    mats["bone"] = create_pbr_material(
        "AgedSkullBone",
        albedo_path=tex_paths["bone_albedo"],
        normal_path=tex_paths["bone_normal"],
        roughness_path=tex_paths["bone_roughness"],
        metallic=0.02,
        normal_strength=0.35,
    )

    # 6. Tarnished Brass / Ochre Bronze (Suspension clevis blocks, latches)
    mats["brass"] = create_pbr_material(
        "AgedBrassHardware",
        albedo_path=tex_paths["brass_albedo"],
        normal_path=tex_paths["brass_normal"],
        roughness_path=tex_paths["brass_roughness"],
        metallic=0.72,
        normal_strength=0.8,
    )

    # 7. Dark Interior Gothic Glass / Shadow Recess (Behind window tracery & skull cavities)
    mats["dark_glass"] = create_pbr_material(
        "DarkGothicGlass",
        base_color=(0.02, 0.025, 0.03, 1.0),
        roughness=0.22,
        metallic=0.25,
    )

    return mats


def assign_material(obj, mat):
    """Assign material to object."""
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def auto_uv_project(bm, scale=1.2, wall_vertical_map=False, organic_uv=False):
    """
    Compute clean triplanar/box UV coordinates directly in bmesh.
    When organic_uv=True, uses a continuous seamless projection without triplanar normal-split seams.
    """
    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        if organic_uv:
            for loop in face.loops:
                co = loop.vert.co
                u = (co.y + co.x * 0.25) * scale
                v = (co.z + co.x * 0.15) * scale
                loop[uv_layer].uv = (u, v)
            continue

        n = face.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in face.loops:
            co = loop.vert.co
            if ax >= ay and ax >= az:
                u = (co.y * 0.45 + 0.5) * scale
                if wall_vertical_map and 1.10 <= co.z <= 2.65:
                    v = 0.03 + 0.94 * max(0.0, min(1.0, (co.z - 1.15) / 1.40))
                else:
                    v = co.z * scale
            elif ay >= ax and ay >= az:
                u = (co.x * 0.45 + 0.5) * scale
                if wall_vertical_map and 1.10 <= co.z <= 2.88:
                    v = 0.03 + 0.94 * max(0.0, min(1.0, (co.z - 1.15) / 1.50))
                else:
                    v = co.z * scale
            else:
                u = co.x * scale
                v = co.y * scale
            loop[uv_layer].uv = (u, v)


def finalize_bmesh(bm, name, mat, bevel_width=0.0, bevel_segments=1, smooth=True, uv_scale=1.2, recalc_normals=True, wall_vertical_map=False, pivot=None, organic_uv=False):
    """Convert a bmesh into a Blender Object with optional bevel, auto UVs, material, and local pivot."""
    if bevel_width > 0.0 and len(bm.edges) > 0:
        bmesh.ops.bevel(
            bm,
            geom=list(bm.edges),
            offset=bevel_width,
            offset_type="OFFSET",
            segments=bevel_segments,
            profile=0.5,
            clamp_overlap=True,
        )
    if recalc_normals:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ngons = [f for f in bm.faces if len(f.verts) > 4]
    if ngons:
        bmesh.ops.triangulate(bm, faces=ngons)
    auto_uv_project(bm, scale=uv_scale, wall_vertical_map=wall_vertical_map, organic_uv=organic_uv)

    if pivot is not None:
        p_vec = Vector(pivot)
        bmesh.ops.translate(bm, verts=bm.verts, vec=-p_vec)

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()

    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True

    obj = bpy.data.objects.new(name, mesh)
    if pivot is not None:
        obj.location = Vector(pivot)
    bpy.context.scene.collection.objects.link(obj)
    if mat is not None:
        assign_material(obj, mat)
    return obj


def add_box(bm, center, size, matrix=None):
    """Add a 3D box of given size=(sx, sy, sz) centered at center=(cx, cy, cz) to bmesh."""
    sx, sy, sz = size
    mat = Matrix.Translation(Vector(center))
    if matrix is not None:
        mat = matrix @ mat
    mat = mat @ Matrix.Diagonal((sx, sy, sz, 1.0))
    bmesh.ops.create_cube(bm, size=1.0, matrix=mat)


def add_cylinder(bm, center, radius, height, segments=16, axis="Z", matrix=None):
    """Add a cylinder to bmesh oriented along X, Y, or Z."""
    rot = Matrix.Identity(4)
    if axis == "X":
        rot = Matrix.Rotation(math.pi / 2.0, 4, "Y")
    elif axis == "Y":
        rot = Matrix.Rotation(math.pi / 2.0, 4, "X")
    mat = Matrix.Translation(Vector(center)) @ rot
    if matrix is not None:
        mat = matrix @ mat
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=True,
        segments=segments,
        radius1=radius,
        radius2=radius,
        depth=height,
        matrix=mat,
    )


def add_sphere(bm, center, radius=0.05, segments=12, rings=8):
    """Add a 3D UV sphere centered at center=(cx, cy, cz) to bmesh."""
    mat = Matrix.Translation(Vector(center))
    bmesh.ops.create_uvsphere(
        bm,
        u_segments=segments,
        v_segments=rings,
        radius=radius,
        matrix=mat,
    )


def add_lathe_profile(bm, profile_rz, center=(0, 0, 0), axis="Z", segments=16, angle_start=0.0, angle_end=2 * math.pi, scale_xy=(1.0, 1.0), cap_ends=False):
    """
    Revolve a 2D profile [(r, z), ...] around an axis to create turned spindles, hubs, finials, or hollow rings.
    NOTE: cap_ends defaults to False so closed torus/annulus profiles (wheel tires, felloes, bands)
    never create solid disks across the wheel center!
    """
    n_pts = len(profile_rz)
    full_circle = abs((angle_end - angle_start) - 2 * math.pi) < 1e-4
    n_rings = segments if full_circle else (segments + 1)

    rot_mat = Matrix.Identity(3)
    if axis == "X":
        rot_mat = Matrix.Rotation(math.pi / 2.0, 3, "Y")
    elif axis == "Y":
        rot_mat = Matrix.Rotation(-math.pi / 2.0, 3, "X")

    c_vec = Vector(center)
    rings = []
    for i in range(n_rings):
        t = i / segments
        ang = angle_start + t * (angle_end - angle_start)
        ca, sa = math.cos(ang), math.sin(ang)
        ring_verts = []
        for r, z in profile_rz:
            local_p = Vector((r * ca * scale_xy[0], r * sa * scale_xy[1], z))
            world_p = c_vec + (rot_mat @ local_p)
            ring_verts.append(bm.verts.new(world_p))
        rings.append(ring_verts)

    for i in range(segments):
        r0 = rings[i]
        r1 = rings[(i + 1) % n_rings]
        for j in range(n_pts - 1):
            v00, v01 = r0[j], r0[j + 1]
            v11, v10 = r1[j + 1], r1[j]
            try:
                bm.faces.new((v00, v10, v11, v01))
            except ValueError:
                pass

    if cap_ends and full_circle:
        if profile_rz[0][0] > 1e-4:
            try:
                f = bm.faces.new([rings[i][0] for i in reversed(range(n_rings))])
                bmesh.ops.triangulate(bm, faces=[f])
            except ValueError:
                pass
        if profile_rz[-1][0] > 1e-4:
            try:
                f = bm.faces.new([rings[i][-1] for i in range(n_rings)])
                bmesh.ops.triangulate(bm, faces=[f])
            except ValueError:
                pass


def add_extruded_profile_along_path(bm, profile_2d, path_points, closed_path=False, closed_profile=True, up_hint=Vector((0, 0, 1))):
    """
    Sweep a 2D cross-section profile [(u, v), ...] along a 3D polyline path [(x, y, z), ...]
    using a twist-free frame anchored to `up_hint` (which acts as the outward surface normal `v_axis`
    whenever the path lies on a wall or panel).
    """
    pts = []
    scales = []
    for p in path_points:
        if len(p) == 5:
            pts.append(Vector((p[0], p[1], p[2])))
            scales.append((p[3], p[4]))
        else:
            pts.append(Vector((p[0], p[1], p[2])))
            scales.append((1.0, 1.0))

    n_path = len(pts)
    n_prof = len(profile_2d)
    if n_path < 2 or n_prof < 2:
        return

    rings = []
    prev_u = None
    ref_n = Vector(up_hint).normalized()

    for i in range(n_path):
        if closed_path:
            t_prev = (pts[i] - pts[(i - 1) % n_path]).normalized()
            t_next = (pts[(i + 1) % n_path] - pts[i]).normalized()
            tangent = (t_prev + t_next).normalized()
        else:
            if i == 0:
                tangent = (pts[1] - pts[0]).normalized()
            elif i == n_path - 1:
                tangent = (pts[-1] - pts[-2]).normalized()
            else:
                t_prev = (pts[i] - pts[i - 1]).normalized()
                t_next = (pts[i + 1] - pts[i]).normalized()
                tangent = (t_prev + t_next).normalized()

        if tangent.length < 1e-6:
            tangent = Vector((0, 1, 0))

        # Project ref_n perpendicular to tangent to serve as stable v_axis (outward normal)
        v_proj = ref_n - tangent * tangent.dot(ref_n)
        if v_proj.length < 0.15:
            # Fallback if tangent is nearly parallel to ref_n
            alt = Vector((1, 0, 0)) if abs(tangent.x) < 0.8 else Vector((0, 1, 0))
            v_proj = alt - tangent * tangent.dot(alt)

        v_axis = v_proj.normalized()
        u_axis = tangent.cross(v_axis).normalized()
        if prev_u is not None and u_axis.dot(prev_u) < -0.5:
            u_axis = -u_axis
            v_axis = -v_axis
        prev_u = u_axis

        su, sv = scales[i]
        ring = []
        for u, v in profile_2d:
            pos = pts[i] + u_axis * (u * su) + v_axis * (v * sv)
            ring.append(bm.verts.new(pos))
        rings.append(ring)

    n_seg_path = n_path if closed_path else (n_path - 1)
    n_seg_prof = n_prof if closed_profile else (n_prof - 1)

    for i in range(n_seg_path):
        r0 = rings[i]
        r1 = rings[(i + 1) % n_path]
        for j in range(n_seg_prof):
            v00 = r0[j]
            v01 = r0[(j + 1) % n_prof]
            v11 = r1[(j + 1) % n_prof]
            v10 = r1[j]
            try:
                bm.faces.new((v00, v10, v11, v01))
            except ValueError:
                pass

    if not closed_path and closed_profile and n_prof >= 3:
        try:
            f0 = bm.faces.new(list(reversed(rings[0])))
            if len(f0.verts) > 4:
                bmesh.ops.triangulate(bm, faces=[f0])
        except ValueError:
            pass
        try:
            f1 = bm.faces.new(rings[-1])
            if len(f1.verts) > 4:
                bmesh.ops.triangulate(bm, faces=[f1])
        except ValueError:
            pass


def add_rivet_row(bm, points_and_normals, radius=0.011):
    """Add 3D dome-headed iron rivets at each (pos, normal) tuple."""
    for pos, norm in points_and_normals:
        p = Vector(pos)
        n = Vector(norm).normalized()
        up = Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))
        u = n.cross(up).normalized()
        v = u.cross(n).normalized()

        base_ring = []
        top_ring = []
        n_sides = 6
        for k in range(n_sides):
            ang = 2.0 * math.pi * k / n_sides
            ca, sa = math.cos(ang), math.sin(ang)
            radial = u * ca + v * sa
            base_ring.append(bm.verts.new(p - n * (radius * 0.2) + radial * radius))
            top_ring.append(bm.verts.new(p + n * (radius * 0.65) + radial * (radius * 0.55)))
        apex = bm.verts.new(p + n * (radius * 0.95))

        for k in range(n_sides):
            k1 = (k + 1) % n_sides
            try:
                bm.faces.new((base_ring[k], base_ring[k1], top_ring[k1], top_ring[k]))
                bm.faces.new((top_ring[k], top_ring[k1], apex))
            except ValueError:
                pass
