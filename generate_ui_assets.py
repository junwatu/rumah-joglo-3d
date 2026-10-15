"""
Generate Orthographic Architectural Elevation Ink Drawings (Side, Front, Rear, Iso)
and 4 Macro Material Detail Swatches directly from gothic_carriage.glb using Blender (bpy),
then bundle them into ui_assets.js for the Gothic Victorian Carriage Heritage UI.
"""

import os
import math
import base64
import bpy
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from mathutils import Vector, Matrix

WORKSPACE = os.path.dirname(os.path.abspath(__file__))
GLB_PATH = os.path.join(WORKSPACE, "gothic_carriage.glb")
OUT_DIR = os.path.join(WORKSPACE, "ui_renders")
os.makedirs(OUT_DIR, exist_ok=True)


def look_at(cam_obj, pos, target):
    p = Vector(pos)
    t = Vector(target)
    cam_obj.location = p
    z_axis = (p - t).normalized()
    up_ref = Vector((0.0, 0.0, 1.0))
    if abs(z_axis.dot(up_ref)) > 0.99:
        up_ref = Vector((0.0, 1.0, 0.0))
    x_axis = up_ref.cross(z_axis).normalized()
    y_axis = z_axis.cross(x_axis).normalized()
    rot_mat = Matrix((x_axis, y_axis, z_axis)).transposed()
    cam_obj.rotation_euler = rot_mat.to_euler()


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)

    # Hide Interior_* meshes for clean exterior orthographic elevations
    for obj in bpy.data.objects:
        if obj.name.startswith("Interior_"):
            obj.hide_render = True

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 36
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True

    # World lighting
    world = bpy.data.worlds.new("UIWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.85, 0.82, 0.76, 1.0)
        bg.inputs["Strength"].default_value = 1.15

    # Studio 3-point lighting for crisp relief & crevice contrast
    key_data = bpy.data.lights.new("Key", type="SUN")
    key_data.energy = 3.2
    key_data.angle = math.radians(8.0)
    key_obj = bpy.data.objects.new("Key", key_data)
    bpy.context.collection.objects.link(key_obj)
    look_at(key_obj, (-6.0, -5.0, 7.0), (0.0, 0.0, 1.6))

    fill_data = bpy.data.lights.new("Fill", type="SUN")
    fill_data.energy = 1.4
    fill_data.angle = math.radians(25.0)
    fill_obj = bpy.data.objects.new("Fill", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    look_at(fill_obj, (5.0, 6.0, 4.0), (0.0, 0.0, 1.5))

    cam_data = bpy.data.cameras.new("UICam")
    cam_obj = bpy.data.objects.new("UICam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    return scene, cam_obj, cam_data, key_obj


def convert_render_to_architectural_ink(rgba_path, out_path, line_strength=1.65):
    """
    Convert a transparent RGBA orthographic render into a crisp Victorian architectural
    pen-and-ink technical elevation drawing on transparent background.
    """
    img = Image.open(rgba_path).convert("RGBA")
    arr = np.asarray(img, dtype=np.float32) / 255.0

    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]

    # Luminance
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]

    # Compute multi-scale Sobel edge gradients on luminance AND alpha silhouette
    def sobel_mag(channel):
        p = np.pad(channel, 1, mode="edge")
        gx = (
            (p[:-2, 2:] + 2.0 * p[1:-1, 2:] + p[2:, 2:])
            - (p[:-2, :-2] + 2.0 * p[1:-1, :-2] + p[2:, :-2])
        )
        gy = (
            (p[2:, :-2] + 2.0 * p[2:, 1:-1] + p[2:, 2:])
            - (p[:-2, :-2] + 2.0 * p[:-2, 1:-1] + p[:-2, 2:])
        )
        return np.hypot(gx, gy)

    edge_lum = sobel_mag(lum)
    edge_alpha = sobel_mag(alpha)

    # Local high-pass detail (crevices, rivets, spokes, gothic moldings)
    pil_lum = Image.fromarray((lum * 255).astype(np.uint8))
    blur_lum = np.asarray(pil_lum.filter(ImageFilter.GaussianBlur(radius=2.2)), dtype=np.float32) / 255.0
    cavity = np.clip((blur_lum - lum) * 4.8, 0.0, 1.0)

    # Combine silhouette contour + interior Sobel edges + cavity lines
    ink = np.clip(
        (edge_alpha * 1.45 + edge_lum * line_strength + cavity * 0.85) * (alpha > 0.05),
        0.0,
        1.0,
    )
    # Sharpen ink contrast curve
    ink = np.power(ink, 0.78)
    ink = np.clip(ink * 1.35, 0.0, 1.0)

    # Subtle tonal shading from luminance inside the carriage silhouette
    tonal_shade = np.clip((0.72 - lum) * 0.42, 0.0, 0.28) * alpha

    # Parchment base fill inside silhouette (#eae1d3) and dark sepia-charcoal ink (#2b231d)
    paper_r, paper_g, paper_b = 0.918, 0.882, 0.827
    ink_r, ink_g, ink_b = 0.165, 0.133, 0.110

    stroke_mix = np.clip(ink + tonal_shade, 0.0, 1.0)
    out_r = paper_r * (1.0 - stroke_mix) + ink_r * stroke_mix
    out_g = paper_g * (1.0 - stroke_mix) + ink_g * stroke_mix
    out_b = paper_b * (1.0 - stroke_mix) + ink_b * stroke_mix

    # Output alpha: interior has soft paper fill (0.75) + solid ink (1.0) so drafting lines show gently
    out_a = np.clip(alpha * (0.68 + 0.32 * stroke_mix), 0.0, 1.0)

    out_rgba = np.stack([out_r, out_g, out_b, out_a], axis=-1)
    out_img = Image.fromarray((out_rgba * 255.0).astype(np.uint8), mode="RGBA")
    out_img.save(out_path)


def main():
    scene, cam_obj, cam_data, key_obj = setup_scene()

    # 1. RENDER TRUE ORTHOGRAPHIC ELEVATIONS (SIDE, FRONT, REAR, ISO)
    cam_data.type = "ORTHO"

    ortho_specs = [
        # (name, pos, target, ortho_scale, width, height)
        ("side", (-8.0, 0.14, 1.62), (0.0, 0.14, 1.62), 5.05, 840, 560),
        ("front", (0.0, -8.0, 1.62), (0.0, 0.0, 1.62), 3.45, 520, 620),
        ("rear", (0.0, 8.0, 1.62), (0.0, 0.0, 1.62), 3.45, 520, 620),
        ("iso", (-6.2, -5.8, 3.35), (0.0, 0.10, 1.58), 5.15, 520, 520),
    ]

    for name, pos, target, scale, w, h in ortho_specs:
        cam_data.ortho_scale = scale
        look_at(cam_obj, pos, target)
        # Position key light angled nicely relative to camera view
        cam_dir = (Vector(pos) - Vector(target)).normalized()
        up_vec = Vector((0, 0, 1))
        side_vec = cam_dir.cross(up_vec).normalized()
        light_pos = Vector(target) + cam_dir * 6.0 + side_vec * 3.5 + up_vec * 4.5
        look_at(key_obj, light_pos, target)

        scene.render.resolution_x = w
        scene.render.resolution_y = h
        raw_path = os.path.join(OUT_DIR, f"raw_{name}.png")
        ink_path = os.path.join(OUT_DIR, f"elev_{name}.png")
        scene.render.filepath = raw_path
        bpy.ops.render.render(write_still=True)
        convert_render_to_architectural_ink(raw_path, ink_path, line_strength=1.75)
        print(f"[OK] Rendered orthographic elevation: {ink_path}")

    # 2. RENDER 4 MACRO MATERIAL & DETAIL SWATCHES (SQUARE 280x280)
    scene.render.film_transparent = False
    scene.cycles.samples = 48
    cam_data.type = "ORTHO"
    scene.render.resolution_x = 280
    scene.render.resolution_y = 280

    # Add warm internal point light so Stained Glass swatch has rich purple/amber glow
    glass_light_data = bpy.data.lights.new("GlassGlow", type="POINT")
    glass_light_data.energy = 65.0
    glass_light_data.color = (0.95, 0.65, 0.88)
    glass_light_obj = bpy.data.objects.new("GlassGlow", glass_light_data)
    glass_light_obj.location = (0.0, 0.10, 1.98)
    bpy.context.collection.objects.link(glass_light_obj)

    swatch_specs = [
        # 1. TIMBER & PAINT: Weathered teal vertical planking & bolted molding
        ("swatch_timber", (-3.5, -0.55, 1.48), (-0.88, -0.55, 1.48), 0.56),
        # 2. FORGED IRON: Pointed gothic iron tracery & dark slate arch frame
        ("swatch_iron", (-3.5, 0.20, 2.02), (-0.88, 0.20, 2.02), 0.58),
        # 3. STAINED GLASS: Leaded gothic lancet window tracery & stained glass
        ("swatch_glass", (0.0, -3.5, 1.96), (0.0, -1.25, 1.96), 0.54),
        # 4. SKULL EMBLEM: Sculpted bone skull medallion in spiked gothic frame
        ("swatch_skull", (-3.5, -0.55, 1.88), (-0.92, -0.55, 1.88), 0.54),
    ]

    for s_name, pos, target, scale in swatch_specs:
        cam_data.ortho_scale = scale
        look_at(cam_obj, pos, target)
        cam_dir = (Vector(pos) - Vector(target)).normalized()
        up_vec = Vector((0, 0, 1))
        side_vec = cam_dir.cross(up_vec).normalized()
        look_at(key_obj, Vector(target) + cam_dir * 4.0 + side_vec * 2.2 + up_vec * 2.5, target)

        out_p = os.path.join(OUT_DIR, f"{s_name}.png")
        scene.render.filepath = out_p
        bpy.ops.render.render(write_still=True)

        # Slightly boost local contrast & sharpness for crisp swatch thumbnails
        im = Image.open(out_p).convert("RGB")
        im = ImageEnhance.Contrast(im).enhance(1.15)
        im = ImageEnhance.Sharpness(im).enhance(1.3)
        im.save(out_p, quality=92)
        print(f"[OK] Rendered material swatch: {out_p}")

    # 3. PACK ALL GENERATED PNGs INTO ui_assets.js AS BASE64 DATA URLs
    assets = {}
    asset_files = {
        "elev_side": "elev_side.png",
        "elev_front": "elev_front.png",
        "elev_rear": "elev_rear.png",
        "elev_iso": "elev_iso.png",
        "swatch_timber": "swatch_timber.png",
        "swatch_iron": "swatch_iron.png",
        "swatch_glass": "swatch_glass.png",
        "swatch_skull": "swatch_skull.png",
    }

    js_lines = ["window.UI_ASSETS = {"]
    for key, fname in asset_files.items():
        fpath = os.path.join(OUT_DIR, fname)
        with open(fpath, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        js_lines.append(f'  "{key}": "data:image/png;base64,{b64}",')
    js_lines.append("};\n")

    js_out = os.path.join(WORKSPACE, "ui_assets.js")
    with open(js_out, "w") as f:
        f.write("\n".join(js_lines))
    print(f"[SUCCESS] Wrote {js_out}")


if __name__ == "__main__":
    main()
