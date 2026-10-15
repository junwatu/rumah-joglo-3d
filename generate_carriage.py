"""
Main Blender Python (bpy) Procedural Generator for the Gothic Victorian Carriage.
Generates procedural PBR textures, builds the complete 3D carriage geometry,
exports an optimized single `gothic_carriage.glb` file, and renders verification views.
"""

import os
import sys
import math
import bpy
from mathutils import Vector

# Ensure current directory is on sys.path
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
if WORKSPACE_DIR not in sys.path:
    sys.path.insert(0, WORKSPACE_DIR)

from procedural_textures import generate_all_textures
from carriage_materials import clear_scene, build_material_library
from carriage_undercarriage import build_undercarriage
from carriage_body import build_carriage_body
from carriage_roof import build_carriage_roof


def apply_crisp_normals():
    """
    Ensure all mesh objects have valid normals and weighted/angle-based smoothing
    so curved surfaces are smooth while architectural mouldings remain crisp.
    """
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        if "SkullBone" in obj.name:
            try:
                bpy.ops.object.shade_smooth()
            except Exception:
                pass
        else:
            try:
                # Blender 4.1+ / 5.0 operator for angle-based smooth shading
                bpy.ops.object.shade_auto_smooth(use_auto_smooth=True, angle=math.radians(42.0))
            except Exception:
                try:
                    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(42.0))
                except Exception:
                    pass
        obj.select_set(False)



def export_glb(glb_path):
    """Export the scene as a single optimized .glb file preserving all materials and textures."""
    # Deselect non-mesh objects if any
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )
    print(f"[SUCCESS] Exported GLB to: {glb_path} ({os.path.getsize(glb_path) / (1024*1024):.2f} MB)")


def setup_studio_and_render(render_dir):
    """
    Set up a clean off-white cyclorama ground plane, studio three-point lighting,
    and render verification views (including the exact 3/4 front-left angle from the reference).
    """
    os.makedirs(render_dir, exist_ok=True)
    scene = bpy.context.scene

    # Use Cycles CPU/Metal for accurate PBR + soft contact shadow verification
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = False  # Keep fast & sandbox-compatible without external denoiser binaries
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1050
    scene.render.film_transparent = False

    # World environment (clean bright studio sky matching reference off-white backdrop)
    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs["Color"].default_value = (0.94, 0.94, 0.95, 1.0)
        bg_node.inputs["Strength"].default_value = 1.15

    # Ground shadow catcher / clean white studio floor at Z = 0
    bpy.ops.mesh.primitive_plane_add(size=30.0, location=(0.0, 0.0, 0.0))
    ground = bpy.context.active_object
    ground.name = "StudioGround"
    mat_ground = bpy.data.materials.new("GroundMat")
    mat_ground.use_nodes = True
    bsdf = mat_ground.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.96, 0.96, 0.97, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.85
    ground.data.materials.append(mat_ground)

    # Studio 3-point area lights
    lights_spec = [
        ("KeyLight", (4.8, -4.8, 5.8), 440.0, 4.5, (1.0, 0.98, 0.95)),
        ("FillLight", (-5.2, -3.5, 4.2), 240.0, 5.0, (0.92, 0.95, 1.0)),
        ("RimLight", (-2.5, 5.5, 5.2), 280.0, 4.0, (0.96, 0.97, 1.0)),
    ]
    for l_name, l_loc, l_energy, l_size, l_col in lights_spec:
        light_data = bpy.data.lights.new(name=l_name, type="AREA")
        light_data.energy = l_energy
        light_data.size = l_size
        light_data.color = l_col
        light_obj = bpy.data.objects.new(name=l_name, object_data=light_data)
        scene.collection.objects.link(light_obj)
        light_obj.location = Vector(l_loc)
        direction = Vector((0.0, 0.0, 1.4)) - Vector(l_loc)
        light_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    # Camera setup helper
    cam_data = bpy.data.cameras.new("RenderCam")
    cam_data.lens = 45.0
    cam_obj = bpy.data.objects.new("RenderCam", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    views = [
        # 1. Exact 3/4 Front-Left Reference Camera Angle (Front balcony on Left, Side on Right)!
        ("view_ref_3quarter.png", (4.70, -4.45, 2.02), (0.0, -0.15, 1.56), 41.5),
        # 2. Side Profile View
        ("view_side_left.png", (5.60, 0.15, 1.75), (0.0, 0.15, 1.68), 45.0),
        # 3. Rear 3/4 View (Inspecting Rear & Opposite Side Completeness)
        ("view_rear_3quarter.png", (-4.35, 4.25, 2.15), (0.0, 0.10, 1.65), 45.0),
        # 4. Close-up on Skull Medallion, Gothic Door Tracery & Balcony
        ("view_closeup_details.png", (2.75, -0.45, 1.96), (0.45, -0.25, 1.88), 50.0),
    ]

    for filename, cam_pos, target_pos, lens in views:
        cam_data.lens = lens
        cam_obj.location = Vector(cam_pos)
        direction = Vector(target_pos) - Vector(cam_pos)
        cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        out_path = os.path.join(render_dir, filename)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        print(f"[RENDERED] {out_path}")


def main():
    tex_dir = os.path.join(WORKSPACE_DIR, "textures")
    glb_path = os.path.join(WORKSPACE_DIR, "gothic_carriage.glb")
    render_dir = os.path.join(WORKSPACE_DIR, "renders")

    print("1. Generating procedural PBR textures...")
    tex_paths = generate_all_textures(tex_dir, size=1024)

    print("2. Initializing Blender scene and PBR material library...")
    clear_scene()
    mats = build_material_library(tex_paths)

    print("3. Building procedural undercarriage, spoked wheels, suspension & hitch...")
    build_undercarriage(mats)

    print("4. Building procedural cabin body, planks, doors, tracery, skulls & balcony...")
    build_carriage_body(mats)

    print("5. Building procedural curved gothic roof, barrel hood & spire finials...")
    build_carriage_roof(mats)

    print("6. Applying crisp smoothing normals...")
    apply_crisp_normals()

    # Count total vertices and triangles
    total_verts = sum(len(o.data.vertices) for o in bpy.data.objects if o.type == "MESH")
    total_faces = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
    print(f"[STATS] Total Mesh Objects: {sum(1 for o in bpy.data.objects if o.type == 'MESH')}, Vertices: {total_verts}, Faces: {total_faces}")

    print("7. Exporting gothic_carriage.glb...")
    export_glb(glb_path)

    if "--render" in sys.argv:
        print("8. Rendering studio verification views...")
        setup_studio_and_render(render_dir)


if __name__ == "__main__":
    main()
