"""
Procedural Undercarriage, Wheels, Suspension, Steps & Hitch Builder
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


def build_wheel(name_prefix, center, radius, width, side_sign, is_rear, mats):
    """
    Build a highly detailed 12-spoke wooden wagon wheel with purple wooden felloe,
    turned spokes, multi-tiered hub, iron tire band, iron hub rings, and rivets.
    center = (cx, cy, cz)
    side_sign = -1 for Left (-X), +1 for Right (+X)
    """
    cx, cy, cz = center
    bm_wood = bmesh.new()
    bm_iron = bmesh.new()

    tire_thick = 0.022
    felloe_thick = 0.068
    r_outer = radius
    r_felloe_out = r_outer - tire_thick
    r_felloe_in = r_felloe_out - felloe_thick
    half_w = width * 0.5

    # 1. Outer Wrought-Iron Tire Ring (36 segments for smooth circular silhouette)
    n_seg = 48
    tire_profile = [
        (-half_w * 1.02, r_felloe_out + 0.0005),
        (half_w * 1.02, r_felloe_out + 0.0005),
        (half_w * 1.02, r_outer - 0.005),
        (half_w * 0.88, r_outer),
        (-half_w * 0.88, r_outer),
        (-half_w * 1.02, r_outer - 0.005),
    ]
    # Revolve around X axis at wheel center
    tire_rz = [(r, x) for (x, r) in tire_profile] + [(tire_profile[0][1], tire_profile[0][0])]
    add_lathe_profile(bm_iron, tire_rz, center=(cx, cy, cz), axis="X", segments=n_seg)

    # 2. Deep Purple Wooden Felloe (Stepped & chamfered wooden rim)
    felloe_profile = [
        (-half_w * 0.96, r_felloe_in + 0.014),
        (-half_w * 0.72, r_felloe_in),
        (half_w * 0.72, r_felloe_in),
        (half_w * 0.96, r_felloe_in + 0.014),
        (half_w * 0.98, r_felloe_out),
        (-half_w * 0.98, r_felloe_out),
    ]
    felloe_rz = [(r, x) for (x, r) in felloe_profile] + [(felloe_profile[0][1], felloe_profile[0][0])]
    add_lathe_profile(bm_wood, felloe_rz, center=(cx, cy, cz), axis="X", segments=n_seg)

    # Outer decorative chamfer rib on felloe face + rivets
    rivet_list = []
    for k in range(24):
        ang = 2.0 * math.pi * k / 24.0
        ry = cy + math.cos(ang) * (r_felloe_in + felloe_thick * 0.52)
        rz = cz + math.sin(ang) * (r_felloe_in + felloe_thick * 0.52)
        rx = cx + side_sign * (half_w * 0.99)
        rivet_list.append(((rx, ry, rz), (side_sign, 0, 0)))
    add_rivet_row(bm_iron, rivet_list, radius=0.010)

    # 6 Felloe segment iron joint plates on outer face (placed cleanly proud of wooden felloe face)
    for k in range(6):
        ang = (2.0 * math.pi * k / 6.0) + (math.pi / 12.0)
        r_mid = r_felloe_in + felloe_thick * 0.45
        py = cy + math.cos(ang) * r_mid
        pz = cz + math.sin(ang) * r_mid
        px = cx + side_sign * (half_w * 0.98 + 0.008)
        rot_x = Matrix.Rotation(ang, 4, "X")
        mat_plate = Matrix.Translation(Vector((px, py, pz))) @ rot_x @ Matrix.Diagonal((0.010, 0.045, 0.055, 1.0))
        bmesh.ops.create_cube(bm_iron, size=1.0, matrix=mat_plate)

    # 3. Multi-Tiered Wooden Hub (Nave) & Iron Hub Bands
    # Hub extends further outward on side_sign side
    hub_len_in = 0.13
    hub_len_out = 0.17
    hub_r_base = 0.115 if not is_rear else 0.128
    # Profile (r, x_offset) where x_offset is multiplied by side_sign
    s = side_sign
    hub_pts_local = [
        (0.02, -hub_len_in),
        (hub_r_base * 0.78, -hub_len_in),
        (hub_r_base * 0.88, -hub_len_in * 0.55),
        (hub_r_base * 1.02, -0.045),
        (hub_r_base * 1.06, 0.0),
        (hub_r_base * 1.02, 0.048),
        (hub_r_base * 0.82, 0.088),
        (hub_r_base * 0.68, 0.125),
        (hub_r_base * 0.48, 0.155),
        (hub_r_base * 0.32, hub_len_out),
        (0.0, hub_len_out + 0.012),
    ]
    if s < 0:
        hub_rz = [(r, -x) for (r, x) in reversed(hub_pts_local)]
    else:
        hub_rz = [(r, x) for (r, x) in hub_pts_local]
    add_lathe_profile(bm_wood, hub_rz, center=(cx, cy, cz), axis="X", segments=24)

    # Iron bands around the hub (seated cleanly proud on the exterior of the hub tiers)
    band_offsets = [-0.075, -0.042, 0.045, 0.095, 0.142]
    band_radii = [hub_r_base * 0.89, hub_r_base * 1.04, hub_r_base * 1.04, hub_r_base * 0.80, hub_r_base * 0.54]
    band_widths = [0.020, 0.022, 0.022, 0.018, 0.020]
    for b_off, b_rad, b_w in zip(band_offsets, band_radii, band_widths):
        x0 = s * (b_off - b_w * 0.5)
        x1 = s * (b_off + b_w * 0.5)
        xa, xb = min(x0, x1), max(x0, x1)
        band_rz = [
            (b_rad * 0.98, xa),
            (b_rad * 1.05, xa),
            (b_rad * 1.05, xb),
            (b_rad * 0.98, xb),
            (b_rad * 0.98, xa),
        ]
        add_lathe_profile(bm_iron, band_rz, center=(cx, cy, cz), axis="X", segments=24)

    # Hub flange bolts (12 bolts around outer hub ring)
    hub_bolts = []
    for k in range(12):
        ang = 2.0 * math.pi * k / 12.0
        by = cy + math.cos(ang) * (hub_r_base * 0.86)
        bz = cz + math.sin(ang) * (hub_r_base * 0.86)
        bx = cx + s * 0.072
        hub_bolts.append(((bx, by, bz), (s, math.cos(ang) * 0.3, math.sin(ang) * 0.3)))
    add_rivet_row(bm_iron, hub_bolts, radius=0.010)

    # 4. 12 Shaped / Turned Wooden Spokes
    n_spokes = 12
    r_spoke_start = hub_r_base * 0.92
    r_spoke_end = r_felloe_in + 0.008
    spoke_len = r_spoke_end - r_spoke_start

    for k in range(n_spokes):
        ang = 2.0 * math.pi * k / n_spokes
        # Slight dish angle (classic carriage wheel dish)
        ca, sa = math.cos(ang), math.sin(ang)
        # Build spoke using lathe profile with oval cross-section (thicker in Y/Z plane or X)
        spoke_prof = [
            (0.030, 0.0),
            (0.033, spoke_len * 0.08),
            (0.025, spoke_len * 0.14),
            (0.028, spoke_len * 0.18),
            (0.023, spoke_len * 0.24),
            (0.020, spoke_len * 0.65),
            (0.018, spoke_len * 0.86),
            (0.024, spoke_len * 0.91),
            (0.021, spoke_len * 1.0),
        ]
        # Construct spoke vertices along radial direction
        radial_dir = Vector((0.0, ca, sa))
        tangent_dir = Vector((0.0, -sa, ca))
        axial_dir = Vector((1.0, 0.0, 0.0))
        spoke_rings = []
        n_s_seg = 10
        for r_val, d_val in spoke_prof:
            r_center = Vector((cx + s * (0.008 * (1.0 - d_val / spoke_len)), cy, cz)) + radial_dir * (r_spoke_start + d_val)
            ring = []
            for j in range(n_s_seg):
                phi = 2.0 * math.pi * j / n_s_seg
                # Elliptical cross-section: slightly wider axially near hub, narrower near rim
                p = r_center + axial_dir * (r_val * 1.08 * math.cos(phi)) + tangent_dir * (r_val * 0.88 * math.sin(phi))
                ring.append(bm_wood.verts.new(p))
            spoke_rings.append(ring)

        for i in range(len(spoke_rings) - 1):
            r0, r1 = spoke_rings[i], spoke_rings[i + 1]
            for j in range(n_s_seg):
                j1 = (j + 1) % n_s_seg
                try:
                    bm_wood.faces.new((r0[j], r1[j], r1[j1], r0[j1]))
                except ValueError:
                    pass

        # Iron ferrule collar at spoke-to-felloe junction
        ferrule_c = Vector((cx, cy, cz)) + radial_dir * (r_spoke_end - 0.018)
        ferrule_ring0 = []
        ferrule_ring1 = []
        for j in range(8):
            phi = 2.0 * math.pi * j / 8
            offset_vec = axial_dir * (0.026 * math.cos(phi)) + tangent_dir * (0.023 * math.sin(phi))
            ferrule_ring0.append(bm_iron.verts.new(ferrule_c - radial_dir * 0.010 + offset_vec))
            ferrule_ring1.append(bm_iron.verts.new(ferrule_c + radial_dir * 0.014 + offset_vec))
        for j in range(8):
            j1 = (j + 1) % 8
            try:
                bm_iron.faces.new((ferrule_ring0[j], ferrule_ring1[j], ferrule_ring1[j1], ferrule_ring0[j1]))
            except ValueError:
                pass

    # 5. Inner Mechanical Brake Drum / Secondary Ring on Rear Wheels (visible in reference!)
    if is_rear:
        drum_r = radius * 0.48
        drum_x0 = cx - s * (half_w * 0.95)
        drum_x1 = cx - s * (half_w * 0.45)
        dxa, dxb = min(drum_x0, drum_x1), max(drum_x0, drum_x1)
        drum_rz = [
            (drum_r * 0.82, dxa - cx),
            (drum_r, dxa - cx),
            (drum_r, dxb - cx),
            (drum_r * 0.82, dxb - cx),
            (drum_r * 0.82, dxa - cx),
        ]
        add_lathe_profile(bm_iron, drum_rz, center=(cx, cy, cz), axis="X", segments=28)

    finalize_bmesh(bm_wood, f"{name_prefix}_Wood", mats["purple_wood"], smooth=True, uv_scale=1.6, pivot=(cx, cy, cz))
    finalize_bmesh(bm_iron, f"{name_prefix}_Iron", mats["iron"], smooth=True, uv_scale=1.8, pivot=(cx, cy, cz))


def build_leaf_spring(bm_iron, center_pos, length, arch_drop, num_leaves=6, width=0.055, leaf_thick=0.009):
    """
    Build a multi-leaf semi-elliptical suspension spring pack with center U-bolt clamp
    and scrolled shackle eyes at both ends.
    """
    cx, cy, cz = center_pos
    leaf_step = 0.0125
    for l_idx in range(num_leaves):
        frac = 1.0 - (l_idx / (num_leaves + 1.2))
        l_len = length * frac
        n_pts = 15
        path = []
        for i in range(n_pts):
            t = (i / (n_pts - 1)) * 2.0 - 1.0  # -1 to +1
            y = cy + t * (l_len * 0.5)
            # Parabolic arch curving down at center (or up at ends)
            z = cz + (t * t) * arch_drop - l_idx * leaf_step
            path.append((cx, y, z))

        prof = [
            (-width * 0.5, -leaf_thick * 0.5),
            (width * 0.5, -leaf_thick * 0.5),
            (width * 0.5, leaf_thick * 0.5),
            (-width * 0.5, leaf_thick * 0.5),
        ]
        add_extruded_profile_along_path(bm_iron, prof, path, closed_path=False, closed_profile=True)

        # Add rolled shackle eyes at ends of main (top) leaf
        if l_idx == 0:
            for end_sign in (-1, 1):
                ey = cy + end_sign * (l_len * 0.5)
                ez = cz + arch_drop + 0.012
                add_cylinder(bm_iron, (cx, ey, ez), radius=0.022, height=width * 1.28, segments=12, axis="X")

    # Center clamp box & U-bolts
    clamp_h = num_leaves * leaf_step + 0.028
    add_box(bm_iron, (cx, cy, cz - clamp_h * 0.36), (width * 1.45, 0.068, clamp_h))


def build_undercarriage(mats):
    """
    Construct all 4 wheels, axles, bolsters, leaf springs, chassis frame,
    front singletree hitch assembly, under-body mechanical boxes, brass clevis blocks,
    and hanging folding carriage entry steps.
    """
    # Wheel parameters matching reference proportions
    y_front = -1.25
    y_rear = 1.42
    r_front = 0.55
    r_rear = 0.63
    x_wheel_front = 0.96
    x_wheel_rear = 1.00

    # 1. Build all 4 Spoked Wheels
    build_wheel("Wheel_FL", (-x_wheel_front, y_front, r_front), r_front, 0.095, -1, False, mats)
    build_wheel("Wheel_FR", (x_wheel_front, y_front, r_front), r_front, 0.095, +1, False, mats)
    build_wheel("Wheel_RL", (-x_wheel_rear, y_rear, r_rear), r_rear, 0.105, -1, True, mats)
    build_wheel("Wheel_RR", (x_wheel_rear, y_rear, r_rear), r_rear, 0.105, +1, True, mats)

    bm_pwood = bmesh.new()
    bm_iron = bmesh.new()
    bm_slate = bmesh.new()
    bm_brass = bmesh.new()

    # 2. Front & Rear Axles and Heavy Timber Axle Beds
    # Front iron axle rod + wooden axle bed
    add_cylinder(bm_iron, (0.0, y_front, r_front), radius=0.036, height=x_wheel_front * 2.04, segments=16, axis="X")
    add_box(bm_pwood, (0.0, y_front, r_front + 0.055), (1.68, 0.11, 0.095))
    # Upper front bolster + kingpin fifth-wheel turntable ring
    add_box(bm_pwood, (0.0, y_front, r_front + 0.165), (1.52, 0.12, 0.085))
    add_cylinder(bm_iron, (0.0, y_front, r_front + 0.115), radius=0.28, height=0.035, segments=24, axis="Z")
    add_cylinder(bm_iron, (0.0, y_front, r_front + 0.115), radius=0.08, height=0.18, segments=16, axis="Z")

    # Rear iron axle rod + wooden axle bed
    add_cylinder(bm_iron, (0.0, y_rear, r_rear), radius=0.040, height=x_wheel_rear * 2.04, segments=16, axis="X")
    add_box(bm_pwood, (0.0, y_rear, r_rear + 0.055), (1.72, 0.12, 0.095))
    add_box(bm_pwood, (0.0, y_rear, r_rear + 0.145), (1.54, 0.12, 0.072))

    # 3. Forward-Projecting Bolster Outriggers (visible behind front wheel & extending forward!)
    # Notice in the reference: heavy beveled purple-wood horizontal beams projecting forward from the front axle
    for sx in (-1, 1):
        bx = sx * 0.58
        # Upper horizontal bolster beam with chamfered front nose (Y = -1.25 to -1.96, Z = 0.52)
        beam_path = [
            (bx, -0.85, r_front - 0.02, 1.0, 1.0),
            (bx, -1.25, r_front - 0.02, 1.1, 1.1),
            (bx, -1.85, r_front - 0.02, 1.0, 0.95),
            (bx, -1.98, r_front - 0.01, 0.72, 0.65),
        ]
        beam_prof = [(-0.045, -0.042), (0.045, -0.042), (0.045, 0.042), (-0.045, 0.042)]
        add_extruded_profile_along_path(bm_pwood, beam_prof, beam_path)

        # Lower angled hound brace under the bolster (Y = -1.30 to -1.78)
        hound_path = [
            (bx, -1.22, r_front - 0.18, 0.9, 0.9),
            (bx, -1.52, r_front - 0.15, 1.0, 1.0),
            (bx, -1.78, r_front - 0.06, 0.85, 0.85),
        ]
        add_extruded_profile_along_path(bm_pwood, beam_prof, hound_path)

        # Iron straps & rivets on the bolster beams
        for ry in (-1.90, -1.72, -1.55, -1.38, -1.05):
            add_box(bm_iron, (bx, ry, r_front - 0.02), (0.104, 0.022, 0.096))
        bolster_rivets = [
            ((bx + sx * 0.050, ry, r_front - 0.02), (sx, 0, 0))
            for ry in (-1.82, -1.64, -1.46, -1.12)
        ]
        add_rivet_row(bm_iron, bolster_rivets, radius=0.012)

    # Transverse cross-bar connecting the forward bolster outriggers at Y = -1.82
    add_box(bm_pwood, (0.0, -1.82, r_front - 0.02), (1.10, 0.086, 0.078))
    add_box(bm_iron, (0.0, -1.82, r_front - 0.02), (0.24, 0.098, 0.092))

    # 4. Front Singletree / Whiffletree Hitch Assembly (Y = -1.82 forward to Y = -2.26, Z = 0.21)
    # Two curved wrought-iron drawbar struts sweeping forward & downward from the bolster to the singletree
    for sx in (-1, 1):
        strut_path = [
            (sx * 0.48, -1.82, r_front - 0.04, 1.1, 1.1),
            (sx * 0.44, -1.98, 0.39, 1.0, 1.0),
            (sx * 0.38, -2.14, 0.28, 0.95, 0.95),
            (sx * 0.34, -2.26, 0.21, 1.1, 1.1),
        ]
        strut_prof = [(-0.020, -0.016), (0.020, -0.016), (0.020, 0.016), (-0.020, 0.016)]
        add_extruded_profile_along_path(bm_iron, strut_prof, strut_path)

        # Secondary upper scroll rod alongside each drawbar strut
        scroll_path = [
            (sx * 0.54, -1.86, r_front - 0.01, 0.9, 0.9),
            (sx * 0.46, -2.04, 0.34, 0.85, 0.85),
            (sx * 0.36, -2.23, 0.23, 0.9, 0.9),
        ]
        scroll_prof = [(-0.012, -0.012), (0.012, -0.012), (0.012, 0.012), (-0.012, 0.012)]
        add_extruded_profile_along_path(bm_iron, scroll_prof, scroll_path)

    # Horizontal Turned Singletree Bar at Y = -2.26, Z = 0.21
    y_hitch = -2.26
    z_hitch = 0.21
    # Wooden singletree core (revolved along X axis from X = -0.58 to +0.58)
    singletree_wood_rz = [
        (0.0, -0.56),
        (0.036, -0.54),
        (0.044, -0.30),
        (0.052, 0.0),
        (0.044, 0.30),
        (0.036, 0.54),
        (0.0, 0.56),
    ]
    add_lathe_profile(bm_pwood, singletree_wood_rz, center=(0.0, y_hitch, z_hitch), axis="X", segments=20)

    # Ornate multi-layered iron spool/drum collars & pointed spear end-caps on both ends of the singletree
    for sx in (-1, 1):
        # Layered circular drum collars at X = sx * 0.38..0.52
        spool_local = [
            (0.046, 0.26),
            (0.058, 0.27),
            (0.058, 0.31),
            (0.046, 0.32),
            (0.088, 0.34),
            (0.094, 0.37),
            (0.088, 0.40),
            (0.054, 0.41),
            (0.076, 0.43),
            (0.082, 0.46),
            (0.076, 0.49),
            (0.044, 0.50),
            (0.050, 0.53),
            (0.032, 0.58),
            (0.018, 0.65),
            (0.002, 0.72),
        ]
        if sx < 0:
            spool_rz = [(r, -x) for (r, x) in reversed(spool_local)]
        else:
            spool_rz = [(r, x) for (r, x) in spool_local]
        add_lathe_profile(bm_iron, spool_rz, center=(0.0, y_hitch, z_hitch), axis="X", segments=20)

        # Horizontal spear-blade wing at outer end of singletree (visible at bottom-left of reference!)
        blade_center = Vector((sx * 0.58, y_hitch - 0.04, z_hitch - 0.01))
        add_box(bm_iron, blade_center, (0.18, 0.08, 0.018))

    # Central iron ring on singletree
    add_cylinder(bm_iron, (0.0, y_hitch, z_hitch), radius=0.062, height=0.05, segments=16, axis="X")

    # 5. 4x Multi-Leaf Suspension Spring Packs & Chassis Rails
    for sx in (-1, 1):
        # Front leaf spring pack
        build_leaf_spring(bm_iron, (sx * 0.70, y_front, r_front + 0.085), length=0.82, arch_drop=0.10, num_leaves=6)
        # Rear leaf spring pack
        build_leaf_spring(bm_iron, (sx * 0.72, y_rear, r_rear + 0.065), length=0.92, arch_drop=0.105, num_leaves=7)

        # Longitudinal chassis frame beams running from Y = -1.75 to Y = +1.85 at Z = 0.735 (strictly below Body_TealWood at Z=0.79!)
        add_box(bm_slate, (sx * 0.66, 0.08, 0.735), (0.072, 3.62, 0.068))

        # Curved iron scroll hangers connecting chassis to leaf spring eyes
        for sy_pos in (y_front - 0.41, y_front + 0.41, y_rear - 0.46, y_rear + 0.46):
            add_box(bm_iron, (sx * 0.71, sy_pos, 0.695), (0.052, 0.045, 0.13))

    # 6. Under-Belly Mechanical Gear/Brake Box & Warm Brass/Ochre Clevis Brackets
    # Look at the reference image between the front and rear wheels:
    # A dark detailed chassis box with grid/recessed panels at Y = -0.35 to +0.55, Z = 0.56 to 0.74
    add_box(bm_iron, (0.0, 0.10, 0.645), (1.22, 0.96, 0.18))
    for sx in (-1, 1):
        for py in (-0.25, -0.05, 0.15, 0.35):
            add_box(bm_slate, (sx * 0.625, py, 0.645), (0.026, 0.14, 0.13))
            add_box(bm_iron, (sx * 0.642, py, 0.645), (0.016, 0.10, 0.095))

        # Curved under-belly swoop strap / rocker loop (visible hanging down to Z=0.45 between front wheel & step!)
        swoop_path = [
            (sx * 0.66, -0.68, 0.72, 1.0, 1.0),
            (sx * 0.66, -0.45, 0.54, 1.1, 1.1),
            (sx * 0.66, -0.18, 0.46, 1.2, 1.2),
            (sx * 0.66, 0.05, 0.56, 1.1, 1.1),
            (sx * 0.66, 0.25, 0.71, 1.0, 1.0),
        ]
        swoop_prof = [(-0.035, -0.028), (0.035, -0.028), (0.035, 0.028), (-0.035, 0.028)]
        add_extruded_profile_along_path(bm_pwood, swoop_prof, swoop_path)

        # Warm Tarnished Brass / Ochre Clevis Blocks (seated cleanly below the lower belly trim)
        for cy_brass in (-0.50, 0.74):
            bx = sx * 0.76
            bz = 0.725
            add_box(bm_brass, (bx, cy_brass, bz), (0.095, 0.145, 0.092))
            add_cylinder(bm_brass, (bx, cy_brass, bz - 0.028), radius=0.052, height=0.112, segments=14, axis="X")
            add_cylinder(bm_iron, (bx + sx * 0.018, cy_brass, bz - 0.028), radius=0.024, height=0.125, segments=12, axis="X")

    # 7. Ornate 2-Tread Hanging Carriage Entry Steps (Left & Right at Y = +0.22)
    y_door = 0.22
    step_half_y = 0.21
    for sx in (-1, 1):
        # Two curved side stringers per step assembly (at Y = y_door - 0.19 and y_door + 0.19)
        for dy in (-step_half_y, step_half_y):
            sy = y_door + dy
            stringer_path = [
                (sx * 0.80, sy, 1.06, 1.1, 1.1),
                (sx * 0.84, sy, 0.90, 1.0, 1.0),
                (sx * 0.91, sy, 0.76, 1.1, 1.1),
                (sx * 0.93, sy, 0.62, 1.0, 1.0),
                (sx * 1.00, sy, 0.48, 1.1, 1.1),
                (sx * 1.02, sy, 0.34, 0.8, 0.8),
            ]
            str_prof = [(-0.014, -0.018), (0.014, -0.018), (0.014, 0.018), (-0.014, 0.018)]
            add_extruded_profile_along_path(bm_iron, str_prof, stringer_path)

            # Diagonal rear brace rod from lower step back to chassis
            brace_path = [
                (sx * 0.96, sy, 0.50, 0.9, 0.9),
                (sx * 0.84, sy - 0.06, 0.64, 0.9, 0.9),
                (sx * 0.72, sy - 0.12, 0.78, 1.0, 1.0),
            ]
            add_extruded_profile_along_path(bm_iron, str_prof, brace_path)

        # Upper Step Tread (Z = 0.76) & Lower Step Tread (Z = 0.48)
        for tx_abs, tz in ((0.90, 0.76), (0.99, 0.48)):
            add_box(bm_iron, (sx * tx_abs, y_door, tz), (0.15, step_half_y * 2.15, 0.022))
            # Rolled front lip on tread
            add_cylinder(bm_iron, (sx * (tx_abs + 0.075), y_door, tz), radius=0.014, height=step_half_y * 2.18, segments=10, axis="Y")
            # Ornate side valence plates under tread
            for dy in (-step_half_y, step_half_y):
                add_box(bm_iron, (sx * tx_abs, y_door + dy * 0.95, tz - 0.028), (0.12, 0.018, 0.038))

        # Curved U-shaped decorative gothic stirrup loop hanging below the bottom step (visible in reference!)
        loop_pts = []
        n_loop = 13
        for i in range(n_loop):
            t = (i / (n_loop - 1)) * 2.0 - 1.0  # -1 to +1
            ly = y_door + t * (step_half_y * 0.88)
            lz = 0.48 - (1.0 - t * t) * 0.13
            lx = sx * (0.97 + (1.0 - t * t) * 0.03)
            loop_pts.append((lx, ly, lz))
        loop_prof = [(-0.012, -0.012), (0.012, -0.012), (0.012, 0.012), (-0.012, 0.012)]
        add_extruded_profile_along_path(bm_iron, loop_prof, loop_pts)

    finalize_bmesh(bm_pwood, "Undercarriage_PurpleWood", mats["purple_wood"], bevel_width=0.004, bevel_segments=1, smooth=True, uv_scale=1.4)
    finalize_bmesh(bm_iron, "Undercarriage_Iron", mats["iron"], smooth=True, uv_scale=1.6)
    finalize_bmesh(bm_slate, "Undercarriage_Slate", mats["slate_trim"], bevel_width=0.003, bevel_segments=1, smooth=True, uv_scale=1.4)
    finalize_bmesh(bm_brass, "Undercarriage_Brass", mats["brass"], bevel_width=0.003, bevel_segments=1, smooth=True, uv_scale=2.0)
