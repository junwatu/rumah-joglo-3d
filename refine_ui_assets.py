"""
Refine the orthographic elevation drawings (elev_side, elev_front, elev_rear, elev_iso)
into delicate, crisp architectural line-art (both dark-ink-on-parchment and cream-ink-on-plum
for the active VIEW MODE button), and produce perfectly centered macro swatches for
TIMBER & PAINT, FORGED IRON, STAINED GLASS, and SKULL EMBLEM.
"""

import os
import base64
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw

WORKSPACE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(WORKSPACE, "ui_renders")
RENDERS_DIR = os.path.join(WORKSPACE, "renders")


def make_fine_architectural_elevation(raw_path, out_dark_path, out_light_path=None, flip_x=False):
    img = Image.open(raw_path).convert("RGBA")
    if flip_x:
        img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

    # Auto-crop transparent padding with clean margin
    bbox = img.getbbox()
    if bbox:
        pad = 14
        x0 = max(0, bbox[0] - pad)
        y0 = max(0, bbox[1] - pad)
        x1 = min(img.width, bbox[2] + pad)
        y1 = min(img.height, bbox[3] + pad)
        img = img.crop((x0, y0, x1, y1))

    arr = np.asarray(img, dtype=np.float32) / 255.0
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]

    def sobel_mag(ch):
        p = np.pad(ch, 1, mode="edge")
        gx = (p[:-2, 2:] + 2.0 * p[1:-1, 2:] + p[2:, 2:]) - (p[:-2, :-2] + 2.0 * p[1:-1, :-2] + p[2:, :-2])
        gy = (p[2:, :-2] + 2.0 * p[2:, 1:-1] + p[2:, 2:]) - (p[:-2, :-2] + 2.0 * p[:-2, 1:-1] + p[:-2, 2:])
        return np.hypot(gx, gy)

    edge_lum = sobel_mag(lum)
    edge_alpha = sobel_mag(alpha)

    # Fine unsharp / high-pass for delicate architectural linework
    pil_lum = Image.fromarray((lum * 255).astype(np.uint8))
    blur_fine = np.asarray(pil_lum.filter(ImageFilter.GaussianBlur(radius=1.15)), dtype=np.float32) / 255.0
    fine_detail = np.clip(np.abs(blur_fine - lum) * 6.5, 0.0, 1.0)

    # Delicate architectural pencil/ink stroke intensity
    stroke = np.clip(
        (edge_alpha * 1.15 + edge_lum * 1.15 + fine_detail * 0.55) * (alpha > 0.05),
        0.0,
        1.0,
    )
    # Soften very faint noise, keep crisp lines
    stroke = np.where(stroke < 0.08, 0.0, np.power(stroke, 0.88))

    # Very light, airy tonal wash inside silhouette (like the reference's right-hand elevations)
    wash = np.clip((0.76 - lum) * 0.18, 0.0, 0.14) * alpha

    # 1. Dark sepia/charcoal ink (#3b322b) on transparent/parchment
    ink_r, ink_g, ink_b = 0.21, 0.18, 0.15
    paper_r, paper_g, paper_b = 0.925, 0.894, 0.843

    mix = np.clip(stroke * 0.88 + wash, 0.0, 1.0)
    dr = paper_r * (1.0 - mix) + ink_r * mix
    dg = paper_g * (1.0 - mix) + ink_g * mix
    db = paper_b * (1.0 - mix) + ink_b * mix
    da = np.clip(alpha * (0.28 + 0.72 * mix), 0.0, 1.0)

    dark_rgba = np.stack([dr, dg, db, da], axis=-1)
    Image.fromarray((dark_rgba * 255.0).astype(np.uint8), mode="RGBA").save(out_dark_path)

    # 2. Light cream line-art (#f0e6d6) on transparent for active dark-plum VIEW MODE button
    if out_light_path:
        cream_r, cream_g, cream_b = 0.95, 0.90, 0.83
        la = np.clip(alpha * (0.08 + 0.92 * stroke), 0.0, 1.0)
        light_rgba = np.stack(
            [
                np.full_like(la, cream_r),
                np.full_like(la, cream_g),
                np.full_like(la, cream_b),
                la,
            ],
            axis=-1,
        )
        Image.fromarray((light_rgba * 255.0).astype(np.uint8), mode="RGBA").save(out_light_path)


def build_perfect_swatches():
    """
    Create the 4 square material & detail swatches matching the reference:
    1. TIMBER & PAINT (weathered teal vertical planks with dark iron-bolted trim)
    2. FORGED IRON (pointed gothic arch iron window tracery)
    3. STAINED GLASS (leaded gothic stained-glass window with warm violet/amber reflections)
    4. SKULL EMBLEM (centered sculpted bone skull medallion in spiked gothic quatrefoil frame)
    """
    side_render = Image.open(os.path.join(RENDERS_DIR, "view_side_left.png")).convert("RGB")
    sw, sh = side_render.size  # 1400 x 1050

    # 1. SKULL EMBLEM: Crop centered directly on the left-front skull medallion in view_side_left.png
    # Let's locate the skull medallion in view_side_left.png or view_closeup_details.png
    closeup_render = Image.open(os.path.join(RENDERS_DIR, "view_closeup_details.png")).convert("RGB")
    cw, ch = closeup_render.size  # 1400 x 1050

    # In view_side_left.png (1400x1050), let's find exact bounding box of the left-rear and left-front skull emblems
    # Rear skull is around x=[315..515], y=[290..490]; Front skull is around x=[800..1000], y=[290..490]
    # Let's check brightness peak of bone skull in x=[300..550], y=[250..520]
    arr_side = np.asarray(side_render, dtype=np.float32)
    roi = arr_side[250:520, 300:560]
    # Bone is warm high-R, high-G
    bone_mask = (roi[:, :, 0] > 145) & (roi[:, :, 1] > 125) & ((roi[:, :, 0] - roi[:, :, 2]) > 15)
    ys, xs = np.where(bone_mask)
    if len(xs) > 10:
        cx_skull = 300 + int(np.mean(xs))
        cy_skull = 250 + int(np.mean(ys))
    else:
        cx_skull, cy_skull = 425, 385

    half_s = 105
    skull_crop = side_render.crop((cx_skull - half_s, cy_skull - half_s, cx_skull + half_s, cy_skull + half_s)).resize(
        (260, 260), Image.Resampling.LANCZOS
    )
    skull_crop = ImageEnhance.Contrast(skull_crop).enhance(1.18)
    skull_crop = ImageEnhance.Sharpness(skull_crop).enhance(1.25)
    skull_crop.save(os.path.join(OUT_DIR, "swatch_skull.png"))

    # 2. TIMBER & PAINT: Weathered teal planks + riveted lower molding from view_side_left.png
    timber_crop = side_render.crop((cx_skull - 95, cy_skull + 65, cx_skull + 95, cy_skull + 255)).resize(
        (260, 260), Image.Resampling.LANCZOS
    )
    timber_crop = ImageEnhance.Contrast(timber_crop).enhance(1.18)
    timber_crop = ImageEnhance.Sharpness(timber_crop).enhance(1.25)
    timber_crop.save(os.path.join(OUT_DIR, "swatch_timber.png"))

    # 3. FORGED IRON: Pointed gothic arch tracery on the central door from view_side_left.png
    # Central door window arch is between the two skulls (around x = 618, y = 375)
    iron_crop = side_render.crop((528, 280, 708, 460)).resize((260, 260), Image.Resampling.LANCZOS)
    iron_crop = ImageEnhance.Contrast(iron_crop).enhance(1.22)
    iron_crop = ImageEnhance.Sharpness(iron_crop).enhance(1.3)
    iron_crop.save(os.path.join(OUT_DIR, "swatch_iron.png"))

    # 4. STAINED GLASS: Gothic lancet window with warm stained-glass reflections
    glass_crop = side_render.crop((540, 295, 696, 451)).resize((260, 260), Image.Resampling.LANCZOS)
    # Add subtle warm violet-amber stained-glass luster to the dark glass panes
    g_arr = np.asarray(glass_crop, dtype=np.float32)
    lum_g = 0.299 * g_arr[:, :, 0] + 0.587 * g_arr[:, :, 1] + 0.114 * g_arr[:, :, 2]
    # Dark glass regions have low luminance; give them a subtle rich gothic plum-amber reflection gradient
    yy, xx = np.mgrid[0:260, 0:260]
    grad = np.exp(-((xx - 130) ** 2 + (yy - 120) ** 2) / (2.0 * 75.0 ** 2))
    glass_pane_mask = np.clip((55.0 - lum_g) / 35.0, 0.0, 1.0)
    g_arr[:, :, 0] = np.clip(g_arr[:, :, 0] + glass_pane_mask * grad * 68.0, 0, 255)
    g_arr[:, :, 1] = np.clip(g_arr[:, :, 1] + glass_pane_mask * grad * 32.0, 0, 255)
    g_arr[:, :, 2] = np.clip(g_arr[:, :, 2] + glass_pane_mask * grad * 62.0, 0, 255)
    glass_img = Image.fromarray(g_arr.astype(np.uint8), mode="RGB")
    glass_img = ImageEnhance.Contrast(glass_img).enhance(1.18)
    glass_img.save(os.path.join(OUT_DIR, "swatch_glass.png"))


def main():
    make_fine_architectural_elevation(
        os.path.join(OUT_DIR, "raw_side.png"),
        os.path.join(OUT_DIR, "elev_side.png"),
        os.path.join(OUT_DIR, "elev_side_light.png"),
        flip_x=True,
    )
    make_fine_architectural_elevation(
        os.path.join(OUT_DIR, "raw_front.png"),
        os.path.join(OUT_DIR, "elev_front.png"),
        os.path.join(OUT_DIR, "elev_front_light.png"),
        flip_x=False,
    )
    make_fine_architectural_elevation(
        os.path.join(OUT_DIR, "raw_rear.png"),
        os.path.join(OUT_DIR, "elev_rear.png"),
        os.path.join(OUT_DIR, "elev_rear_light.png"),
        flip_x=False,
    )
    make_fine_architectural_elevation(
        os.path.join(OUT_DIR, "raw_iso.png"),
        os.path.join(OUT_DIR, "elev_iso.png"),
        os.path.join(OUT_DIR, "elev_iso_light.png"),
        flip_x=True,
    )

    build_perfect_swatches()

    asset_files = {
        "elev_side": "elev_side.png",
        "elev_side_light": "elev_side_light.png",
        "elev_front": "elev_front.png",
        "elev_front_light": "elev_front_light.png",
        "elev_rear": "elev_rear.png",
        "elev_rear_light": "elev_rear_light.png",
        "elev_iso": "elev_iso.png",
        "elev_iso_light": "elev_iso_light.png",
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
    print("[SUCCESS] Refined elevations and swatches and updated ui_assets.js")


if __name__ == "__main__":
    main()
