"""
Procedural Double-Tiered Curved Gothic Roof, Barrel-Vaulted Front Porch Hood,
Arched Clerestory Doorway Break, and Gothic Spire Finials Builder
for the Gothic Victorian Carriage.
"""

import math
import bmesh
from mathutils import Vector, Matrix
from carriage_materials import (
    finalize_bmesh,
    add_box,
    add_cylinder,
    add_lathe_profile,
    add_extruded_profile_along_path,
    add_rivet_row,
)
from carriage_body import add_scroll_relief_panel


def build_hero_diamond_finial(bm_iron, bm_slate, center, scale=1.0):
    """
    Build the prominent Hero Gothic Diamond-Lantern Spire Finial at the apex of the front/rear arch.
    Features:
    - Flared saddle/pedestal base straddling the arch ridge
    - Collared octagonal neck
    - Wide 4-pointed Gothic Diamond Boss with horizontal side spurs and beveled triangular facets
    - Tall concave-tapered 4-sided Gothic Spire Spike
    """
    cx, cy, cz = center
    s = scale

    # 1. Saddle Pedestal Base & Collared Neck
    add_box(bm_slate, (cx, cy, cz + 0.025 * s), (0.16 * s, 0.14 * s, 0.055 * s))
    add_box(bm_iron, (cx, cy, cz + 0.065 * s), (0.11 * s, 0.10 * s, 0.040 * s))

    # 2. 4-Pointed Diamond Lantern Boss (Z = cz + 0.09*s to cz + 0.28*s)
    z_b0 = cz + 0.085 * s
    z_b_mid = cz + 0.185 * s
    z_b1 = cz + 0.285 * s

    # Build faceted diamond lantern body using 8-point star/octagon cross-sections
    boss_levels = [
        (z_b0, 0.038 * s, 0.038 * s),
        (cz + 0.12 * s, 0.065 * s, 0.055 * s),
        (z_b_mid, 0.125 * s, 0.095 * s),   # Sharp protruding diamond equator!
        (cz + 0.24 * s, 0.062 * s, 0.052 * s),
        (z_b1, 0.032 * s, 0.032 * s),
    ]
    rings = []
    n_oct = 8
    for zv, rx_card, r_diag in boss_levels:
        ring = []
        for k in range(n_oct):
            ang = 2.0 * math.pi * k / n_oct
            r = rx_card if (k % 2 == 0) else (r_diag * 0.68)
            wx = cx + math.cos(ang) * r
            wy = cy + math.sin(ang) * r
            ring.append(bm_iron.verts.new((wx, wy, zv)))
        rings.append(ring)

    for i in range(len(rings) - 1):
        r0, r1 = rings[i], rings[i + 1]
        for k in range(n_oct):
            k1 = (k + 1) % n_oct
            try:
                bm_iron.faces.new((r0[k], r0[k1], r1[k1], r1[k]))
            except ValueError:
                pass

    # Decorative collar ring above diamond boss
    add_box(bm_slate, (cx, cy, z_b1 + 0.012 * s), (0.075 * s, 0.075 * s, 0.024 * s))

    # 3. Tall Concave-Tapered 4-Sided Gothic Spire Point (Z = z_b1 + 0.02*s to cz + 0.54*s)
    spire_levels = [
        (z_b1 + 0.015 * s, 0.036 * s),
        (cz + 0.35 * s, 0.024 * s),
        (cz + 0.42 * s, 0.014 * s),
        (cz + 0.49 * s, 0.006 * s),
        (cz + 0.55 * s, 0.0015 * s),
    ]
    s_rings = []
    for zv, rad in spire_levels:
        ring = []
        for k in range(8):
            ang = 2.0 * math.pi * k / 8.0
            r = rad if (k % 2 == 0) else (rad * 0.62)
            ring.append(bm_iron.verts.new((cx + math.cos(ang) * r, cy + math.sin(ang) * r, zv)))
        s_rings.append(ring)

    for i in range(len(s_rings) - 1):
        r0, r1 = s_rings[i], s_rings[i + 1]
        for k in range(8):
            k1 = (k + 1) % 8
            try:
                bm_iron.faces.new((r0[k], r0[k1], r1[k1], r1[k]))
            except ValueError:
                pass
    try:
        bm_iron.faces.new(s_rings[-1])
    except ValueError:
        pass


def build_roof_spire_finial(bm_iron, bm_slate, center, scale=1.0):
    """
    Build one of the pointed gothic spire finials along the upper roof cornice and arch shoulders.
    """
    cx, cy, cz = center
    s = scale
    # Square molded pedestal base
    add_box(bm_slate, (cx, cy, cz + 0.018 * s), (0.068 * s, 0.068 * s, 0.036 * s))
    # Faceted 8-sided gothic obelisk/urn finial profile
    fin_rz = [
        (0.028 * s, 0.032 * s),
        (0.034 * s, 0.050 * s),
        (0.020 * s, 0.072 * s),
        (0.038 * s, 0.115 * s),
        (0.042 * s, 0.135 * s),
        (0.022 * s, 0.165 * s),
        (0.028 * s, 0.180 * s),
        (0.016 * s, 0.215 * s),
        (0.008 * s, 0.265 * s),
        (0.001 * s, 0.315 * s),
    ]
    add_lathe_profile(bm_iron, fin_rz, center=(cx, cy, cz), axis="Z", segments=8)


def build_carriage_roof(mats):
    """
    Construct the complete Double-Tiered Curved Gothic Roof:
    1. Barrel-vaulted Front Porch Hood & Rear Overhang with coffered plank underside
    2. Front Arch Fascia with radial iron straps, rivets, flared eaves tips, and 3D apex scrollwork
    3. Lower Side Eaves Cornice with the Arched Clerestory Break & 3D filigree over the center doors
    4. Sloped Lower Roof Skirt with standing seam ribs
    5. Upper Clerestory Cornice & Crowned Roof Deck
    6. Hero Front & Rear Diamond Spire Finials + 12 Upper Roof Cresting Finials + 4 Shoulder Finials
    """
    bm_teal = bmesh.new()
    bm_slate = bmesh.new()
    bm_iron = bmesh.new()

    y_front_hood = -2.22
    y_rear_hood = 2.16
    y_door = 0.22
    door_arch_half_w = 0.44

    def door_clerestory_bump(y):
        """Smooth upward arch over the center entrance doorway (Y = -0.22 to +0.66)."""
        dy = abs(y - y_door)
        if dy >= door_arch_half_w:
            return 0.0
        u = dy / door_arch_half_w
        # Smooth cosine/parabolic arch rising 0.19m at y == y_door
        return 0.19 * ((1.0 - u * u) ** 1.25)

    # =========================================================================
    # 1. BARREL-VAULTED FRONT PORCH HOOD & LOWER ROOF SHELL (Y = -2.22 to +2.16)
    # =========================================================================
    # Notice how at the front (Y = -2.22 to -1.32), the roof forms a continuous arched barrel hood
    # spanning from X = -1.06 to +1.06 and rising from Z = 2.52 at the eaves to Z = 2.90 at X = 0.
    # Along the main cabin (Y = -1.32 to +1.84), the lower roof slopes up from X = ±1.04 (Z=2.55 + door_bump)
    # to the upper clerestory cornice at X = ±0.80 (Z = 2.78), and the upper roof deck crowns at Z = 2.95.

    n_y = 44
    n_x = 24
    shell_top_rings = []
    shell_bot_rings = []

    for iy in range(n_y):
        ty = iy / (n_y - 1)
        y = y_front_hood + ty * (y_rear_hood - y_front_hood)
        bump = door_clerestory_bump(y)

        # Blend factor for how pronounced the two-tier clerestory step is vs smooth barrel hood at ends
        # At front hood (y < -1.35) and rear hood (y > 1.85), blend smoothly toward barrel arch
        tier_blend = 1.0
        if y < -1.30:
            tier_blend = max(0.0, 1.0 - ((-1.30 - y) / 0.85) ** 1.2)
        elif y > 1.80:
            tier_blend = max(0.0, 1.0 - ((y - 1.80) / 0.36) ** 1.2)

        top_row = []
        bot_row = []
        for ix in range(n_x):
            tx = (ix / (n_x - 1)) * 2.0 - 1.0  # -1 to +1
            ax = abs(tx)

            # Width flares slightly at the very front & rear eaves tips
            end_flare = 0.0
            if y < -2.02:
                end_flare = 0.06 * ((-2.02 - y) / 0.20) * (ax ** 2)
            elif y > 2.00:
                end_flare = 0.04 * ((y - 2.00) / 0.16) * (ax ** 2)

            x = tx * (1.05 + end_flare)

            # Barrel arch profile z_barrel(tx):
            # Kicks outward slightly flat near |tx| > 0.92 (flared gothic eaves tips!)
            if ax > 0.90:
                arch_h = 0.36 * (1.0 - 0.90 ** 1.85) * (1.0 - (ax - 0.90) / 0.12)
            else:
                arch_h = 0.36 * (1.0 - (ax / 0.90) ** 1.85)
            z_barrel = 2.53 + arch_h + bump * (ax ** 1.4)

            # Two-tier clerestory profile z_tiered(tx):
            if ax >= 0.76:
                # Lower sloped roof skirt from |tx|=1.0 (Z=2.55+bump) to |tx|=0.76 (Z=2.76 + 0.35*bump)
                s_skirt = (1.0 - ax) / 0.24
                z_tier = (2.54 + bump) * (1.0 - s_skirt) + (2.75 + 0.25 * bump) * s_skirt + 0.04 * math.sin(s_skirt * math.pi)
            elif ax >= 0.72:
                # Vertical clerestory step from Z=2.75 to Z=2.84
                s_step = (0.76 - ax) / 0.04
                z_tier = (2.75 + 0.25 * bump) * (1.0 - s_step) + 2.84 * s_step
            else:
                # Upper crowned roof deck from |tx|=0.72 (Z=2.84) to tx=0 (Z=2.95)
                u_deck = ax / 0.72
                z_tier = 2.84 + 0.11 * (1.0 - u_deck * u_deck)

            z_top = z_barrel * (1.0 - tier_blend) + z_tier * tier_blend
            z_bot = z_top - 0.045

            top_row.append(bm_slate.verts.new((x, y, z_top)))
            bot_row.append(bm_teal.verts.new((x * 0.985, y, z_bot)))

        shell_top_rings.append(top_row)
        shell_bot_rings.append(bot_row)

    # Connect top roof surface faces (slate_trim) and underside ceiling faces (teal_wood)
    for iy in range(n_y - 1):
        t0, t1 = shell_top_rings[iy], shell_top_rings[iy + 1]
        b0, b1 = shell_bot_rings[iy], shell_bot_rings[iy + 1]
        for ix in range(n_x - 1):
            try:
                bm_slate.faces.new((t0[ix], t0[ix + 1], t1[ix + 1], t1[ix]))
                bm_teal.faces.new((b0[ix], b1[ix], b1[ix + 1], b0[ix + 1]))
            except ValueError:
                pass

    # Underside longitudinal ceiling plank ribs under the front barrel porch hood (Y = -2.20 to -1.30)
    for ix in range(2, n_x - 2, 2):
        tx = (ix / (n_x - 1)) * 2.0 - 1.0
        ax = abs(tx)
        x = tx * 0.98
        z_ceil = 2.49 + 0.35 * (1.0 - (min(ax, 0.90) / 0.90) ** 1.85)
        add_box(bm_slate, (x, -1.76, z_ceil), (0.022, 0.88, 0.022))

    # =========================================================================
    # 2. LOWER EAVES CORNICE MOLDING & ARCHED CLERESTORY BREAK OVER DOORS
    # =========================================================================
    eaves_prof = [
        (-0.048, -0.036),
        (0.048, -0.036),
        (0.058, -0.008),
        (0.042, 0.010),
        (0.062, 0.028),
        (0.050, 0.042),
        (-0.048, 0.042),
    ]
    for sx in (-1, 1):
        side_eaves_pts = []
        eaves_rivets = []
        n_ep = 40
        for i in range(n_ep):
            t = i / (n_ep - 1)
            y = y_front_hood + t * (y_rear_hood - y_front_hood)
            bump = door_clerestory_bump(y)
            end_flare = 0.0
            if y < -2.02:
                end_flare = 0.06 * ((-2.02 - y) / 0.20)
            elif y > 2.00:
                end_flare = 0.04 * ((y - 2.00) / 0.16)
            x = sx * (1.05 + end_flare)
            z = 2.53 + bump
            side_eaves_pts.append((x, y, z, 1.0, 1.0))
            if i % 2 == 0:
                eaves_rivets.append(((x + sx * 0.055, y, z), (sx, 0, 0)))

        add_extruded_profile_along_path(bm_slate, eaves_prof, side_eaves_pts, up_hint=Vector((0, 0, 1)))
        add_rivet_row(bm_iron, eaves_rivets, radius=0.009)

        # Arched Clerestory Tympanum Panel & 3D Raised Gothic Scrollwork above Center Door!
        for i in range(16):
            u0 = (i / 16.0) * 2.0 - 1.0
            u1 = ((i + 1) / 16.0) * 2.0 - 1.0
            um = 0.5 * (u0 + u1)
            ty = y_door + um * (door_arch_half_w * 0.92)
            wy = (u1 - u0) * (door_arch_half_w * 0.94)
            z_low = 2.44 + (1.0 - um * um) * 0.06
            z_high = 2.54 + door_clerestory_bump(ty)
            zm = 0.5 * (z_low + z_high)
            zh = max(0.06, z_high - z_low + 0.04)
            add_box(bm_teal, (sx * 1.015, ty, zm), (0.048, wy, zh))

        add_scroll_relief_panel(
            bm_iron,
            center=(sx * 1.042, y_door, 2.59),
            normal_axis="+X" if sx > 0 else "-X",
            u_size=0.58,
            v_size=0.14,
            depth=0.016,
        )

    # =========================================================================
    # 3. FRONT & REAR BARREL ARCH FASCIAS, STRAPS, RIVETS & APEX SCROLLWORK
    # =========================================================================
    # Look at the front arch fascia (Y = -2.22):
    # Heavy molded arch with flared horizontal eaves tips at X = ±1.12, segmented iron strap plates,
    # rivet rows, and 3D gothic scrollwork right at the apex (X = 0, Z = 2.88)!
    arch_fascia_prof = [
        (-0.055, -0.048),
        (0.055, -0.048),
        (0.065, -0.015),
        (0.048, 0.012),
        (0.068, 0.038),
        (0.052, 0.052),
        (-0.055, 0.052),
    ]
    for y_end, y_norm in ((y_front_hood, -1), (y_rear_hood, +1)):
        arch_pts = []
        arch_rivets = []
        n_a = 33
        for i in range(n_a):
            tx = (i / (n_a - 1)) * 2.0 - 1.0  # -1 to +1
            ax = abs(tx)
            x = tx * 1.12
            if ax > 0.88:
                # Flared horizontal gothic eaves tips at outer ends of arch!
                z = 2.52
            else:
                z = 2.52 + 0.37 * (1.0 - (ax / 0.88) ** 1.80)
            arch_pts.append((x, y_end, z, 1.0, 1.0))
            if i % 2 == 1:
                arch_rivets.append(((x, y_end + y_norm * 0.058, z), (0, y_norm, 0)))

        add_extruded_profile_along_path(bm_slate, arch_fascia_prof, arch_pts, up_hint=Vector((0, y_norm, 0)))
        add_rivet_row(bm_iron, arch_rivets, radius=0.009)

        # Radial iron reinforcement strap plates along the arch fascia
        for tx_strap in (-0.82, -0.46, 0.0, 0.46, 0.82):
            ax = abs(tx_strap)
            sx_pos = tx_strap * 1.12
            sz_pos = 2.52 + 0.37 * (1.0 - (min(ax, 0.88) / 0.88) ** 1.80)
            add_box(bm_iron, (sx_pos, y_end + y_norm * 0.015, sz_pos), (0.065, 0.13, 0.115))

        # 3D Gothic Scrollwork Relief right at the Apex of the Arch Fascia!
        add_scroll_relief_panel(
            bm_iron,
            center=(0.0, y_end + y_norm * 0.052, 2.88),
            normal_axis="-Y" if y_norm < 0 else "+Y",
            u_size=0.38,
            v_size=0.11,
            depth=0.016,
        )

    # =========================================================================
    # 4. UPPER CLERESTORY CORNICE RAIL & TRANSVERSE ROOF RIBS
    # =========================================================================
    upper_cornice_prof = [
        (-0.042, -0.045),
        (0.042, -0.045),
        (0.052, 0.010),
        (0.038, 0.038),
        (-0.042, 0.038),
    ]
    for sx in (-1, 1):
        u_path = []
        u_rivets = []
        for i in range(25):
            t = i / 24.0
            y = -1.52 + t * (1.92 - (-1.52))
            x = sx * 0.78
            z = 2.81
            u_path.append((x, y, z, 1.0, 1.0))
            if i % 2 == 0:
                u_rivets.append(((x + sx * 0.048, y, z), (sx, 0, 0)))
        add_extruded_profile_along_path(bm_slate, upper_cornice_prof, u_path, up_hint=Vector((0, 0, 1)))
        add_rivet_row(bm_iron, u_rivets, radius=0.008)

    # Front & Rear transverse arch connectors for the Upper Clerestory Cornice
    for y_uc in (-1.52, 1.92):
        uc_arch = []
        for i in range(17):
            tx = (i / 16.0) * 2.0 - 1.0
            x = tx * 0.78
            z = 2.81 + 0.12 * (1.0 - tx * tx)
            uc_arch.append((x, y_uc, z))
        add_extruded_profile_along_path(bm_slate, upper_cornice_prof, uc_arch, up_hint=Vector((0, 0, 1)))

    # Standing-seam transverse roof ribs across the lower skirt & upper deck
    rib_prof = [(-0.018, -0.015), (0.018, -0.015), (0.014, 0.022), (-0.014, 0.022)]
    for y_rib in (-1.78, -1.35, -0.72, -0.18, 0.62, 1.20, 1.82):
        bump = door_clerestory_bump(y_rib)
        r_pts = []
        for i in range(19):
            tx = (i / 18.0) * 2.0 - 1.0
            ax = abs(tx)
            x = tx * 1.04
            if y_rib < -1.40:
                z = 2.53 + 0.36 * (1.0 - (min(ax, 0.90) / 0.90) ** 1.85)
            else:
                if ax >= 0.75:
                    s_sk = (1.0 - ax) / 0.25
                    z = (2.54 + bump) * (1.0 - s_sk) + 2.80 * s_sk
                else:
                    u_dk = ax / 0.75
                    z = 2.83 + 0.12 * (1.0 - u_dk * u_dk)
            r_pts.append((x, y_rib, z + 0.01))
        add_extruded_profile_along_path(bm_slate, rib_prof, r_pts, up_hint=Vector((0, 0, 1)))

    # =========================================================================
    # 5. GOTHIC SPIRE FINIALS (HERO APEX FINIALS + SHOULDER FINIALS + ROOF CRESTING)
    # =========================================================================
    # 5a. Large Hero Diamond-Lantern Spire Finials at Front Apex (Y = -2.18) & Rear Apex (Y = +2.12)
    build_hero_diamond_finial(bm_iron, bm_slate, center=(0.0, -2.18, 2.89), scale=1.05)
    build_hero_diamond_finial(bm_iron, bm_slate, center=(0.0, 2.12, 2.89), scale=0.92)

    # 5b. Front & Rear Arch Shoulder Finials (visible on the left & right slopes of the front arch!)
    for sx in (-1, 1):
        build_roof_spire_finial(bm_iron, bm_slate, center=(sx * 0.88, -2.14, 2.60), scale=0.82)
        build_roof_spire_finial(bm_iron, bm_slate, center=(sx * 0.88, 2.08, 2.60), scale=0.78)
        # Corner eaves finials above the front & rear sweeping corbels
        build_roof_spire_finial(bm_iron, bm_slate, center=(sx * 1.02, -1.42, 2.55), scale=0.88)

    # 5c. 12x Upper Roof Cornice Cresting Spire Finials (6 along Left Upper Ledge, 6 along Right Upper Ledge)
    upper_finial_y = (-1.45, -0.82, -0.18, 0.56, 1.22, 1.86)
    for sx in (-1, 1):
        for fy in upper_finial_y:
            build_roof_spire_finial(bm_iron, bm_slate, center=(sx * 0.78, fy, 2.83), scale=0.86)

    finalize_bmesh(bm_teal, "Roof_TealCeiling", mats["teal_wood"], smooth=True, uv_scale=1.2)
    finalize_bmesh(bm_slate, "Roof_SlateStructure", mats["slate_trim"], bevel_width=0.0025, bevel_segments=1, smooth=True, uv_scale=1.3)
    finalize_bmesh(bm_iron, "Roof_IronFinialsAndHardware", mats["iron"], smooth=True, uv_scale=1.8)
