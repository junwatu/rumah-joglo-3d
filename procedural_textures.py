"""
Procedural PBR Texture Generator for the Gothic Victorian Carriage.
Generates high-resolution seamless BaseColor, Roughness, Metallic, and Normal maps
so that all procedural weathering, wood grain, streaks, patina, and metal details
are preserved inside the exported .glb file.
"""

import os
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image


def _fbm_noise(shape, scales=(4, 8, 16, 32, 64), weights=(0.35, 0.25, 0.20, 0.12, 0.08), seed=42, stretch_y=1.0):
    """Generate tileable-like multi-octave fractal Brownian motion noise."""
    rng = np.random.default_rng(seed)
    h, w = shape
    result = np.zeros((h, w), dtype=np.float32)
    for scale, weight in zip(scales, weights):
        raw = rng.standard_normal((h, w)).astype(np.float32)
        sigma_y = (h / scale) * stretch_y
        sigma_x = (w / scale)
        filtered = gaussian_filter(raw, sigma=(max(0.8, sigma_y), max(0.8, sigma_x)), mode="wrap")
        std = filtered.std()
        if std > 1e-6:
            filtered = filtered / std
        result += weight * filtered
    r_min, r_max = result.min(), result.max()
    if r_max - r_min > 1e-6:
        result = (result - r_min) / (r_max - r_min)
    return result


def _height_to_normal(height_map, strength=2.5):
    """Convert a 2D height map [0,1] into an RGB tangent-space normal map uint8 image."""
    gy, gx = np.gradient(height_map.astype(np.float32))
    nx = -gx * strength
    ny = gy * strength
    nz = np.ones_like(height_map, dtype=np.float32)
    length = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-8
    nx /= length
    ny /= length
    nz /= length
    rgb = np.stack([
        np.clip((nx * 0.5 + 0.5) * 255.0, 0, 255),
        np.clip((ny * 0.5 + 0.5) * 255.0, 0, 255),
        np.clip((nz * 0.5 + 0.5) * 255.0, 0, 255),
    ], axis=-1).astype(np.uint8)
    return rgb


def generate_all_textures(out_dir, size=1024):
    """
    Generate all PBR texture sets (BaseColor, Roughness, Metallic, Normal)
    for the carriage materials and return a dictionary of file paths.
    """
    os.makedirs(out_dir, exist_ok=True)
    paths = {}

    # =========================================================================
    # 1. WEATHERED TEAL WOOD (Main body planks, panels, mouldings)
    # =========================================================================
    h, w = size, size
    y_coords = np.linspace(0, 1, h, dtype=np.float32)[:, None]

    # Fine vertical wood grain + strong vertical rain/grime streaks + blotchy patina
    wood_grain = _fbm_noise((h, w), scales=(8, 16, 32, 64, 128), weights=(0.15, 0.25, 0.25, 0.20, 0.15), seed=101, stretch_y=5.5)
    vertical_streaks = _fbm_noise((h, w), scales=(6, 14, 28, 56), weights=(0.30, 0.35, 0.20, 0.15), seed=102, stretch_y=7.5)
    patina_blotches = _fbm_noise((h, w), scales=(3, 6, 12, 24), weights=(0.40, 0.30, 0.20, 0.10), seed=103, stretch_y=1.2)
    fine_grit = _fbm_noise((h, w), scales=(32, 64, 128, 256), weights=(0.2, 0.3, 0.3, 0.2), seed=104, stretch_y=1.8)

    # Strong top & bottom edge darkening (rain drip from eaves & dirt splash above lower ledge)
    edge_grime = np.exp(-((y_coords - 0.0) / 0.18) ** 2) * 0.72 + np.exp(-((y_coords - 1.0) / 0.18) ** 2) * 0.68
    edge_grime = np.clip(edge_grime * (0.55 + 0.90 * (1.0 - vertical_streaks)), 0.0, 0.88)

    c_mid = np.array([62.0, 104.0, 120.0], dtype=np.float32)
    c_light = np.array([116.0, 162.0, 174.0], dtype=np.float32)
    c_dark = np.array([24.0, 34.0, 44.0], dtype=np.float32)
    c_purple_tint = np.array([54.0, 56.0, 76.0], dtype=np.float32)

    mix_light = np.clip(wood_grain * 0.65 + patina_blotches * 0.35, 0, 1)[..., None]
    base_teal = c_mid * (1.0 - mix_light) + c_light * mix_light

    purple_mask = np.clip((patina_blotches - 0.42) * 1.7, 0, 0.48)[..., None]
    base_teal = base_teal * (1.0 - purple_mask) + c_purple_tint * purple_mask

    grime_mask = np.clip((1.0 - vertical_streaks) * 0.48 + edge_grime * 0.65 + (1.0 - fine_grit) * 0.16, 0, 0.90)[..., None]
    base_teal = base_teal * (1.0 - grime_mask) + c_dark * grime_mask

    teal_albedo = np.clip(base_teal, 0, 255).astype(np.uint8)
    teal_height = np.clip(wood_grain * 0.6 + fine_grit * 0.25 + vertical_streaks * 0.15, 0, 1)
    teal_normal = _height_to_normal(teal_height, strength=3.6)
    teal_rough = np.clip((0.58 + (1.0 - wood_grain) * 0.24 + grime_mask[..., 0] * 0.15) * 255.0, 0, 255).astype(np.uint8)

    paths["teal_wood_albedo"] = os.path.join(out_dir, "teal_wood_albedo.png")
    paths["teal_wood_normal"] = os.path.join(out_dir, "teal_wood_normal.png")
    paths["teal_wood_roughness"] = os.path.join(out_dir, "teal_wood_roughness.png")
    Image.fromarray(teal_albedo).save(paths["teal_wood_albedo"])
    Image.fromarray(teal_normal).save(paths["teal_wood_normal"])
    Image.fromarray(teal_rough).save(paths["teal_wood_roughness"])

    # =========================================================================
    # 2. DARK AGED SLATE-BLUE TRIM & CORNICE (Frames, Pilasters, Roof Trim, Doors)
    # =========================================================================
    trim_grain = _fbm_noise((h, w), scales=(6, 16, 32, 64, 128), weights=(0.2, 0.25, 0.25, 0.15, 0.15), seed=201, stretch_y=2.2)
    trim_pitting = _fbm_noise((h, w), scales=(16, 32, 64, 128, 256), weights=(0.15, 0.2, 0.25, 0.2, 0.2), seed=202, stretch_y=1.0)
    trim_patina = _fbm_noise((h, w), scales=(4, 8, 16), weights=(0.45, 0.35, 0.20), seed=203, stretch_y=1.0)

    c_trim_base = np.array([46.0, 62.0, 78.0], dtype=np.float32)
    c_trim_high = np.array([84.0, 110.0, 128.0], dtype=np.float32)
    c_trim_dark = np.array([22.0, 28.0, 36.0], dtype=np.float32)
    c_trim_violet = np.array([58.0, 50.0, 72.0], dtype=np.float32)

    t_mix = np.clip(trim_grain * 0.6 + trim_pitting * 0.4, 0, 1)[..., None]
    trim_col = c_trim_dark * (1.0 - t_mix) + c_trim_base * t_mix
    hi_mask = np.clip((trim_patina - 0.42) * 1.9, 0, 0.68)[..., None]
    trim_col = trim_col * (1.0 - hi_mask) + c_trim_high * hi_mask
    v_mask = np.clip((1.0 - trim_patina - 0.35) * 1.4, 0, 0.45)[..., None]
    trim_col = trim_col * (1.0 - v_mask) + c_trim_violet * v_mask

    trim_albedo = np.clip(trim_col, 0, 255).astype(np.uint8)
    trim_height = np.clip(trim_grain * 0.55 + trim_pitting * 0.45, 0, 1)
    trim_normal = _height_to_normal(trim_height, strength=3.2)
    trim_rough = np.clip((0.48 + (1.0 - trim_pitting) * 0.28) * 255.0, 0, 255).astype(np.uint8)
    trim_metal = np.clip((0.20 + hi_mask[..., 0] * 0.24) * 255.0, 0, 255).astype(np.uint8)

    paths["slate_trim_albedo"] = os.path.join(out_dir, "slate_trim_albedo.png")
    paths["slate_trim_normal"] = os.path.join(out_dir, "slate_trim_normal.png")
    paths["slate_trim_roughness"] = os.path.join(out_dir, "slate_trim_roughness.png")
    paths["slate_trim_metallic"] = os.path.join(out_dir, "slate_trim_metallic.png")
    Image.fromarray(trim_albedo).save(paths["slate_trim_albedo"])
    Image.fromarray(trim_normal).save(paths["slate_trim_normal"])
    Image.fromarray(trim_rough).save(paths["slate_trim_roughness"])
    Image.fromarray(trim_metal).save(paths["slate_trim_metallic"])

    # =========================================================================
    # 3. WEATHERED PURPLE-PLUM WOOD (Wheels, spokes, felloes, axle beams, hitch)
    # =========================================================================
    pw_grain = _fbm_noise((h, w), scales=(8, 16, 32, 64, 128), weights=(0.15, 0.25, 0.25, 0.20, 0.15), seed=301, stretch_y=3.5)
    pw_wear = _fbm_noise((h, w), scales=(4, 10, 24, 48), weights=(0.35, 0.30, 0.20, 0.15), seed=302, stretch_y=1.2)

    c_pw_base = np.array([92.0, 56.0, 96.0], dtype=np.float32)
    c_pw_light = np.array([132.0, 88.0, 134.0], dtype=np.float32)
    c_pw_dark = np.array([36.0, 22.0, 40.0], dtype=np.float32)

    pw_mix = np.clip(pw_grain * 0.65 + pw_wear * 0.35, 0, 1)[..., None]
    pw_col = c_pw_dark * (1.0 - pw_mix) + c_pw_base * pw_mix
    pw_hi = np.clip((pw_wear - 0.46) * 1.9, 0, 0.68)[..., None]
    pw_col = pw_col * (1.0 - pw_hi) + c_pw_light * pw_hi

    pw_albedo = np.clip(pw_col, 0, 255).astype(np.uint8)
    pw_normal = _height_to_normal(pw_grain * 0.7 + pw_wear * 0.3, strength=3.2)
    pw_rough = np.clip((0.55 + (1.0 - pw_grain) * 0.28) * 255.0, 0, 255).astype(np.uint8)

    paths["purple_wood_albedo"] = os.path.join(out_dir, "purple_wood_albedo.png")
    paths["purple_wood_normal"] = os.path.join(out_dir, "purple_wood_normal.png")
    paths["purple_wood_roughness"] = os.path.join(out_dir, "purple_wood_roughness.png")
    Image.fromarray(pw_albedo).save(paths["purple_wood_albedo"])
    Image.fromarray(pw_normal).save(paths["purple_wood_normal"])
    Image.fromarray(pw_rough).save(paths["purple_wood_roughness"])

    # =========================================================================
    # 4. WROUGHT IRON / DARK GUNMETAL (Wheel tires, finials, rivets, steps, springs)
    # =========================================================================
    iron_pit = _fbm_noise((h, w), scales=(12, 24, 48, 96, 192), weights=(0.2, 0.2, 0.25, 0.2, 0.15), seed=401, stretch_y=1.0)
    iron_rust = _fbm_noise((h, w), scales=(4, 8, 16, 32), weights=(0.35, 0.3, 0.2, 0.15), seed=402, stretch_y=1.0)

    c_iron_base = np.array([44.0, 48.0, 56.0], dtype=np.float32)
    c_iron_spec = np.array([88.0, 94.0, 106.0], dtype=np.float32)
    c_iron_rust = np.array([62.0, 46.0, 48.0], dtype=np.float32)

    i_mix = iron_pit[..., None]
    iron_col = c_iron_base * (1.0 - i_mix * 0.6) + c_iron_spec * (i_mix * 0.6)
    r_mask = np.clip((iron_rust - 0.55) * 2.0, 0, 0.45)[..., None]
    iron_col = iron_col * (1.0 - r_mask) + c_iron_rust * r_mask

    iron_albedo = np.clip(iron_col, 0, 255).astype(np.uint8)
    iron_normal = _height_to_normal(iron_pit, strength=2.6)
    iron_rough = np.clip((0.36 + (1.0 - iron_pit) * 0.30 + r_mask[..., 0] * 0.20) * 255.0, 0, 255).astype(np.uint8)
    iron_metal = np.clip((0.76 - r_mask[..., 0] * 0.35) * 255.0, 0, 255).astype(np.uint8)

    paths["iron_albedo"] = os.path.join(out_dir, "iron_albedo.png")
    paths["iron_normal"] = os.path.join(out_dir, "iron_normal.png")
    paths["iron_roughness"] = os.path.join(out_dir, "iron_roughness.png")
    paths["iron_metallic"] = os.path.join(out_dir, "iron_metallic.png")
    Image.fromarray(iron_albedo).save(paths["iron_albedo"])
    Image.fromarray(iron_normal).save(paths["iron_normal"])
    Image.fromarray(iron_rough).save(paths["iron_roughness"])
    Image.fromarray(iron_metal).save(paths["iron_metallic"])

    # =========================================================================
    # 5. AGED BONE / SKULL (Skulls & carved bone accents)
    # =========================================================================
    bone_noise = _fbm_noise((h, w), scales=(8, 16, 32, 64, 128), weights=(0.25, 0.25, 0.2, 0.15, 0.15), seed=501, stretch_y=1.0)
    c_bone_light = np.array([224.0, 210.0, 186.0], dtype=np.float32)
    c_bone_mid = np.array([178.0, 162.0, 136.0], dtype=np.float32)
    c_bone_dark = np.array([76.0, 66.0, 52.0], dtype=np.float32)

    b_mix = bone_noise[..., None]
    bone_col = c_bone_mid * (1.0 - b_mix) + c_bone_light * b_mix
    b_crevice = np.clip((0.42 - bone_noise) * 2.2, 0, 0.68)[..., None]
    bone_col = bone_col * (1.0 - b_crevice) + c_bone_dark * b_crevice

    bone_albedo = np.clip(bone_col, 0, 255).astype(np.uint8)
    bone_normal = _height_to_normal(bone_noise, strength=2.0)
    bone_rough = np.clip((0.50 + (1.0 - bone_noise) * 0.28) * 255.0, 0, 255).astype(np.uint8)

    paths["bone_albedo"] = os.path.join(out_dir, "bone_albedo.png")
    paths["bone_normal"] = os.path.join(out_dir, "bone_normal.png")
    paths["bone_roughness"] = os.path.join(out_dir, "bone_roughness.png")
    Image.fromarray(bone_albedo).save(paths["bone_albedo"])
    Image.fromarray(bone_normal).save(paths["bone_normal"])
    Image.fromarray(bone_rough).save(paths["bone_roughness"])

    # =========================================================================
    # 6. AGED BRASS / BRONZE HARDWARE (Under-chassis blocks, latches, accents)
    # =========================================================================
    brass_noise = _fbm_noise((h, w), scales=(8, 16, 32, 64), weights=(0.3, 0.3, 0.2, 0.2), seed=601, stretch_y=1.0)
    c_brass_hi = np.array([184.0, 146.0, 82.0], dtype=np.float32)
    c_brass_dark = np.array([88.0, 68.0, 38.0], dtype=np.float32)
    brass_col = c_brass_dark * (1.0 - brass_noise[..., None]) + c_brass_hi * brass_noise[..., None]

    paths["brass_albedo"] = os.path.join(out_dir, "brass_albedo.png")
    paths["brass_normal"] = os.path.join(out_dir, "brass_normal.png")
    paths["brass_roughness"] = os.path.join(out_dir, "brass_roughness.png")
    Image.fromarray(np.clip(brass_col, 0, 255).astype(np.uint8)).save(paths["brass_albedo"])
    Image.fromarray(_height_to_normal(brass_noise, strength=1.8)).save(paths["brass_normal"])
    Image.fromarray(np.clip((0.35 + (1.0 - brass_noise) * 0.30) * 255.0, 0, 255).astype(np.uint8)).save(paths["brass_roughness"])

    return paths
