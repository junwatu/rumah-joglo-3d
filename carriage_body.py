"""
Procedural Cabin Body, Ledges, Balcony, Doors, Gothic Tracery,
Sweeping Corner Corbels, Relief Scrollwork, and 3D Sculpted Skull Medallions
for the Gothic Victorian Carriage.
"""

import math
import bmesh
from mathutils import Vector, Matrix
from carriage_materials import (
    finalize_bmesh,
    add_box,
    add_cylinder,
    add_sphere,
    add_lathe_profile,
    add_extruded_profile_along_path,
    add_rivet_row,
)


def wall_x_at_z(z):
    """
    Compute the outward-flaring (tumblehome) X half-width of the cabin side wall
    at height z (from z=1.15m ledge to z=2.55m eaves).
    """
    t = max(0.0, min(1.0, (z - 1.15) / (2.55 - 1.15)))
    return 0.86 + 0.14 * (t ** 1.12)


def add_scroll_relief_panel(bm, center, normal_axis, u_size, v_size, depth=0.018):
    """
    Generate crisp, twist-free 3D raised gothic acanthus / S-scrollwork filigree
    anchored to the panel's outward normal vector.
    normal_axis: '-Y' (front), '+Y' (rear), '-X' (left), '+X' (right)
    """
    cx, cy, cz = center
    if normal_axis == "-Y":
        n_vec = Vector((0, -1, 0))
    elif normal_axis == "+Y":
        n_vec = Vector((0, 1, 0))
    elif normal_axis == "-X":
        n_vec = Vector((-1, 0, 0))
    else:
        n_vec = Vector((1, 0, 0))

    prof = [
        (-0.012, -depth * 0.25),
        (0.012, -depth * 0.25),
        (0.008, depth),
        (-0.008, depth),
    ]

    def to_world(u, v, w=0.0):
        if normal_axis == "-Y":
            return (cx + u, cy - w, cz + v)
        elif normal_axis == "+Y":
            return (cx - u, cy + w, cz + v)
        elif normal_axis == "-X":
            return (cx - w, cy + u, cz + v)
        else:
            return (cx + w, cy - u, cz + v)

    # Symmetric left and right S-scroll volutes
    for side in (-1, 1):
        s_pts = []
        n_pts = 20
        for i in range(n_pts):
            t = i / (n_pts - 1)
            ang = t * 1.85 * math.pi
            r = (0.38 - 0.22 * t) * min(u_size * 0.42, v_size * 0.45)
            u = side * (u_size * 0.05 + u_size * 0.24 * t + r * math.sin(ang) * 0.55)
            v = (v_size * 0.14 * math.cos(t * math.pi)) + r * math.cos(ang) * 0.55
            sc = 1.10 - 0.40 * t
            wx, wy, wz = to_world(u, v, depth * 0.35)
            s_pts.append((wx, wy, wz, sc, sc))
        add_extruded_profile_along_path(bm, prof, s_pts, up_hint=n_vec)

        # Lower foliate C-scroll branch
        c_pts = []
        for i in range(12):
            t = i / 11.0
            ang = t * 1.25 * math.pi
            u = side * (u_size * 0.12 + u_size * 0.25 * t)
            v = -v_size * 0.20 + math.sin(ang) * (v_size * 0.20 * (1.0 - 0.35 * t))
            sc = 0.95 - 0.30 * t
            wx, wy, wz = to_world(u, v, depth * 0.30)
            c_pts.append((wx, wy, wz, sc, sc))
        add_extruded_profile_along_path(bm, prof, c_pts, up_hint=n_vec)

    # Central gothic pointed arch / trefoil crest
    arch_pts = []
    for i in range(15):
        t = (i / 14.0) * 2.0 - 1.0
        u = t * (u_size * 0.15)
        v = -v_size * 0.24 + (1.0 - abs(t) ** 1.35) * (v_size * 0.56)
        wx, wy, wz = to_world(u, v, depth * 0.42)
        arch_pts.append((wx, wy, wz, 1.0, 1.0))
    add_extruded_profile_along_path(bm, prof, arch_pts, up_hint=n_vec)


def build_sculpted_skull_medallion(bm_slate, bm_iron, bm_bone, bm_glass, side_sign, y_center, z_center):
    """
    Build the signature ornate Gothic Pointed-Diamond / Ogee-Quatrefoil Window Frame
    with continuous multi-stepped moldings, horizontal side spikes, cusped inner foils,
    custom polygonal dark shadow-box recess, bat-wing scroll brackets, and a high-detail 3D skull
    with deep black eye sockets, nasal cavity, cheekbones, brow ridge, teeth, and mandible.
    """
    sx = side_sign
    norm = Vector((sx, 0.0, 0.0))

    half_h = 0.40
    half_w = 0.31

    def gothic_diamond_point(theta, scale_y=1.0, scale_z=1.0, cusp=0.14):
        """
        Pointed gothic ogee diamond curve around (y_center, z_center).
        Produces crisp top/bottom/left/right gothic points with 4 ogee lobes.
        """
        st = math.sin(theta)
        ct = math.cos(theta)
        # Sharp diamond astroid + ogee swell in the 4 quadrants
        p_exp = 0.78
        dy = (abs(st) ** p_exp) * (1.0 if st >= 0 else -1.0)
        dz = (abs(ct) ** p_exp) * (1.0 if ct >= 0 else -1.0)
        # Pinch slightly at 45-degree diagonals and swell into 4 cusped foils
        lobe = 1.0 - cusp * (math.sin(2.0 * theta) ** 2) + 0.06 * math.cos(4.0 * theta)
        y = y_center + dy * half_w * scale_y * lobe
        z = z_center + dz * half_h * scale_z * lobe
        return y, z

    # 1. Continuous Multi-Stepped Gothic Frame Mesh (Zero gaps between outer & inner moldings!)
    # We construct concentric rings of vertices from outer perimeter (scale=1.06) inward to cavity back (scale=0.58)
    n_seg = 64
    # Profile layers: (scale_yz, x_offset_from_wall)
    frame_layers = [
        (1.06, -0.005),  # 0: Flush against cabin planks
        (1.04, 0.032),   # 1: Outer beveled lip
        (0.94, 0.048),   # 2: Outer raised ridge
        (0.90, 0.038),   # 3: Outer border flat band (with rivets)
        (0.78, 0.038),   # 4: Inner edge of flat band
        (0.74, 0.056),   # 5: High inner ogee molding crest
        (0.66, 0.044),   # 6: Inner cusped fillet
        (0.62, 0.004),   # 7: Deep shadow-box recess wall
    ]

    layer_rings = []
    for sc_yz, x_off in frame_layers:
        ring = []
        cusp_val = 0.18 if sc_yz < 0.80 else 0.13
        for i in range(n_seg):
            theta = 2.0 * math.pi * i / n_seg
            yv, zv = gothic_diamond_point(theta, scale_y=sc_yz, scale_z=sc_yz, cusp=cusp_val)
            xv = sx * (wall_x_at_z(zv) + x_off)
            ring.append(bm_slate.verts.new((xv, yv, zv)))
        layer_rings.append(ring)

    for l_idx in range(len(layer_rings) - 1):
        r0, r1 = layer_rings[l_idx], layer_rings[l_idx + 1]
        for i in range(n_seg):
            i1 = (i + 1) % n_seg
            try:
                if sx > 0:
                    bm_slate.faces.new((r0[i], r0[i1], r1[i1], r1[i]))
                else:
                    bm_slate.faces.new((r0[i], r1[i], r1[i1], r0[i1]))
            except ValueError:
                pass

    # 2. Custom Polygonal Dark Shadow-Box Backing (Fits strictly inside the inner frame contour!)
    glass_center = bm_glass.verts.new((sx * (wall_x_at_z(z_center) + 0.006), y_center, z_center))
    glass_ring = []
    for i in range(n_seg):
        theta = 2.0 * math.pi * i / n_seg
        yv, zv = gothic_diamond_point(theta, scale_y=0.66, scale_z=0.66, cusp=0.18)
        xv = sx * (wall_x_at_z(zv) + 0.006)
        glass_ring.append(bm_glass.verts.new((xv, yv, zv)))
    for i in range(n_seg):
        i1 = (i + 1) % n_seg
        try:
            if sx > 0:
                bm_glass.faces.new((glass_center, glass_ring[i], glass_ring[i1]))
            else:
                bm_glass.faces.new((glass_center, glass_ring[i1], glass_ring[i]))
        except ValueError:
            pass

    # 3. Perimeter Rivets along the Flat Band of the Gothic Frame
    rivet_pts = []
    for i in range(0, n_seg, 4):
        theta = 2.0 * math.pi * i / n_seg
        yr, zr = gothic_diamond_point(theta, scale_y=0.84, scale_z=0.84, cusp=0.14)
        xr = sx * (wall_x_at_z(zr) + 0.040)
        rivet_pts.append(((xr, yr, zr), (sx, 0, 0)))
    add_rivet_row(bm_iron, rivet_pts, radius=0.0085)

    # 4. Prominent Gothic Spurs & Finials on the 4 Outer Points of the Diamond Frame
    x_w_mid = wall_x_at_z(z_center)
    spike_prof = [(-0.026, -0.022), (0.026, -0.022), (0.016, 0.026), (-0.016, 0.026)]
    for dy_sign in (-1, 1):
        # Horizontal left & right side spikes extending from the outer point of the diamond frame
        sy0 = y_center + dy_sign * (half_w * 0.98)
        spike_path = [
            (sx * (x_w_mid + 0.018), sy0, z_center, 1.30, 1.30),
            (sx * (x_w_mid + 0.032), sy0 + dy_sign * 0.050, z_center, 0.80, 0.80),
            (sx * (x_w_mid + 0.038), sy0 + dy_sign * 0.115, z_center, 0.10, 0.10),
        ]
        add_extruded_profile_along_path(bm_slate, spike_prof, spike_path, up_hint=norm)

    for dz_sign in (-1, 1):
        # Top and bottom pointed gothic finials extending from the outer apexes of the diamond frame
        fz0 = z_center + dz_sign * (half_h * 0.98)
        fx0 = sx * (wall_x_at_z(fz0) + 0.018)
        fin_path = [
            (fx0, y_center, fz0, 1.30, 1.30),
            (fx0 + sx * 0.012, y_center, fz0 + dz_sign * 0.048, 0.78, 0.78),
            (fx0 + sx * 0.016, y_center, fz0 + dz_sign * 0.108, 0.10, 0.10),
        ]
        add_extruded_profile_along_path(bm_slate, spike_prof, fin_path, up_hint=norm)

    # 5. Flanking Multi-Ribbed Gothic Wing / Scroll Corbels Behind the Skull's Temples
    for dy_sign in (-1, 1):
        for rib_idx, (z_off, len_sc, r_sc) in enumerate(((0.032, 1.05, 1.0), (0.014, 0.90, 0.82), (-0.004, 0.72, 0.68))):
            wing_pts = [
                (sx * (x_w_mid + 0.024), y_center + dy_sign * 0.038, z_center + z_off, 0.9 * r_sc, 1.1 * r_sc),
                (sx * (x_w_mid + 0.054), y_center + dy_sign * (0.082 * len_sc), z_center + z_off + 0.018, 1.25 * r_sc, 1.05 * r_sc),
                (sx * (x_w_mid + 0.046), y_center + dy_sign * (0.132 * len_sc), z_center + z_off + 0.006, 0.85 * r_sc, 0.80 * r_sc),
                (sx * (x_w_mid + 0.022), y_center + dy_sign * (0.168 * len_sc), z_center + z_off - 0.016, 0.35 * r_sc, 0.40 * r_sc),
            ]
            wing_prof = [(-0.011, -0.014), (0.011, -0.014), (0.008, 0.014), (-0.008, 0.014)]
            add_extruded_profile_along_path(bm_bone if rib_idx == 0 else bm_slate, wing_prof, wing_pts, up_hint=norm)

    # 6. Reworked Anatomical 3D Sculpted Gothic Skull (Unified 64x48 Manifold + Smoothed Mandible)
    skull_cx = sx * (x_w_mid + 0.036)
    skull_cy = y_center
    skull_cz = z_center + 0.016
    skull_verts_to_smooth = []

    # 6a. Unified High-Resolution Cranium, Brow, Eye Orbits, Piriform Nose, Cheekbones & Maxilla (64 x 48)
    n_u, n_v = 64, 48
    cranium_rings = []
    for iv in range(n_v):
        v = iv / (n_v - 1)  # 0.0 (upper alveolar maxilla rim) to 1.0 (cranial crown pole)
        # Never exceed +0.488*pi so cos(phi) stays strictly positive and never folds at the crown
        phi = (-0.33 + v * 0.818) * math.pi
        cp, sp = math.cos(phi), math.sin(phi)
        ring = []
        for iu in range(n_u):
            u = iu / n_u
            theta = (u - 0.5) * 2.0 * math.pi  # theta=0 is dead-center front (+sx)
            ct, st = math.cos(theta), math.sin(theta)

            # Base neurocranium vault (broad rounded parietal bosses at back-top, tapered frontal bone)
            parietal_widen = 1.0 + 0.15 * math.exp(-((v - 0.68) / 0.22) ** 2) * (1.0 - max(0.0, ct) * 0.55)
            rx = 0.086 * cp
            ry = 0.068 * cp * parietal_widen
            rz = 0.094 * sp + 0.028

            # Temporal fossa pinching behind the brow on left/right sides (|st| ~ 0.78, v ~ 0.48..0.68)
            temple_indent = math.exp(-((v - 0.56) / 0.12) ** 2 - ((abs(st) - 0.78) / 0.20) ** 2) * 0.016
            ry -= temple_indent

            if ct > -0.10:
                fw = max(0.0, ct)  # Front-hemisphere weight
                dy0 = ry * st      # Exact metric horizontal coordinate (-0.068m to +0.068m)
                dz0 = rz           # Exact metric vertical coordinate (-0.052m to +0.120m)

                # 1. Sweeping W-shaped Supraorbital Brow Ridge (centered at dz0 ~ +0.035m)
                glabella_dip = 1.0 - 0.25 * math.exp(-(dy0 / 0.009) ** 2)
                brow_z_curve = 0.035 + 0.004 * math.cos(min(math.pi, abs(dy0) / 0.026 * math.pi * 0.5))
                brow = (
                    math.exp(-((dz0 - brow_z_curve) / 0.009) ** 2)
                    * math.exp(-(dy0 / 0.048) ** 4)
                    * (fw ** 1.2)
                    * 0.020
                    * glabella_dip
                )

                # 2. Left & Right Eye Orbits (centered at dy0 = ±0.025m, dz0 = +0.015m)
                d_eye_l = math.sqrt(((dy0 - 0.025) / 0.0172) ** 2 + ((dz0 - 0.015 + 0.16 * (dy0 - 0.025)) / 0.0142) ** 2)
                d_eye_r = math.sqrt(((dy0 + 0.025) / 0.0172) ** 2 + ((dz0 - 0.015 - 0.16 * (dy0 + 0.025)) / 0.0142) ** 2)
                d_eye = min(d_eye_l, d_eye_r)
                orb_rim = 0.012 * math.exp(-((d_eye - 1.05) / 0.22) ** 2) * fw
                orb_socket = -0.048 * (1.0 / (1.0 + (d_eye / 0.82) ** 6)) * fw

                # 3. Nasal Bridge & Piriform (Inverted-Pear) Nasal Aperture (dy0 = 0, dz0 = -0.012m)
                nasal_bridge = 0.013 * math.exp(-((dz0 - 0.008) / 0.012) ** 2 - (dy0 / 0.0075) ** 2) * fw
                t_nose = max(0.0, min(1.0, (0.003 - dz0) / 0.028))
                piriform_half_w = 0.0048 + 0.0078 * t_nose
                d_nose = math.sqrt((dy0 / piriform_half_w) ** 2 + ((dz0 + 0.012) / 0.0145) ** 2)
                nasal_rim = 0.008 * math.exp(-((d_nose - 1.06) / 0.22) ** 2) * fw
                nasal_socket = -0.042 * (1.0 / (1.0 + (d_nose / 0.80) ** 6)) * fw

                # 4. Prominent Zygomatic Cheekbones (dz0 ~ +0.001m, |dy0| ~ 0.042m) & Sub-Malar Hollows
                cheek_flare = (
                    math.exp(-((dz0 - 0.001) / 0.013) ** 2 - ((abs(dy0) - 0.042) / 0.014) ** 2)
                ) * fw
                sub_cheek_hollow = (
                    math.exp(-((dz0 + 0.028) / 0.016) ** 2 - ((abs(dy0) - 0.038) / 0.016) ** 2)
                ) * fw

                # 5. Upper Alveolar Maxilla Arch (dz0 ~ -0.036m, |dy0| < 0.028m)
                maxilla_arch = math.exp(-((dz0 + 0.036) / 0.014) ** 2) * math.exp(-(dy0 / 0.028) ** 4) * (fw ** 1.3) * 0.022

                rx += brow + orb_rim + orb_socket + nasal_bridge + nasal_rim + nasal_socket + cheek_flare * 0.020 - sub_cheek_hollow * 0.016 + maxilla_arch
                ry += cheek_flare * 0.018 - sub_cheek_hollow * 0.022

                # Narrow the lateral skull walls below the cheekbones so the upper jaw forms a distinct horseshoe
                if v < 0.28:
                    t_jaw = max(0.0, min(1.0, v / 0.28))
                    s_jaw = t_jaw * t_jaw * (3.0 - 2.0 * t_jaw)
                    ry *= (0.56 + 0.44 * s_jaw)

            wx = skull_cx + sx * (rx * ct)
            wy = skull_cy + ry * st
            wz = skull_cz + rz
            v_new = bm_bone.verts.new((wx, wy, wz))
            ring.append(v_new)
            skull_verts_to_smooth.append(v_new)
        cranium_rings.append(ring)

    for iv in range(n_v - 1):
        r0, r1 = cranium_rings[iv], cranium_rings[iv + 1]
        for iu in range(n_u):
            iu1 = (iu + 1) % n_u
            try:
                if sx > 0:
                    bm_bone.faces.new((r0[iu], r0[iu1], r1[iu1], r1[iu]))
                else:
                    bm_bone.faces.new((r0[iu], r1[iu], r1[iu1], r0[iu1]))
            except ValueError:
                pass
    try:
        f_top = bm_bone.faces.new(cranium_rings[-1] if sx > 0 else list(reversed(cranium_rings[-1])))
        f_bot = bm_bone.faces.new(list(reversed(cranium_rings[0])) if sx > 0 else cranium_rings[0])
        bmesh.ops.triangulate(bm_bone, faces=[f_top, f_bot])
    except ValueError:
        pass

    # Light organic smoothing across the unified cranium mesh
    bmesh.ops.smooth_vert(bm_bone, verts=skull_verts_to_smooth, factor=0.25, use_axis_x=True, use_axis_y=True, use_axis_z=True)

    # 6b. Pitch-Black Concave Ocular Cups & Piriform Nasal Backing (Exact 1:1 metric match with sculpted sockets!)
    for eye_sy in (-1, 1):
        ey_c = skull_cy + eye_sy * 0.025
        ez_c = skull_cz + 0.015
        ex_cup = skull_cx + sx * 0.068
        n_orb = 24
        cup_center = bm_glass.verts.new((ex_cup - sx * 0.014, ey_c, ez_c))
        glass_ring = []
        for k in range(n_orb):
            ang = 2.0 * math.pi * k / n_orb
            ca, sa = math.cos(ang), math.sin(ang)
            dy_local = 0.0162 * ca
            dz_local = 0.0135 * sa - eye_sy * dy_local * 0.16
            glass_ring.append(bm_glass.verts.new((ex_cup, ey_c + dy_local, ez_c + dz_local)))
        for k in range(n_orb):
            k1 = (k + 1) % n_orb
            try:
                if sx > 0:
                    bm_glass.faces.new((cup_center, glass_ring[k1], glass_ring[k]))
                else:
                    bm_glass.faces.new((cup_center, glass_ring[k], glass_ring[k1]))
            except ValueError:
                pass

    # Pitch-black piriform nasal cavity backing + central bony vomer septum
    nz_c = skull_cz - 0.012
    nx_cup = skull_cx + sx * 0.070
    n_nas = 20
    nas_cup_c = bm_glass.verts.new((nx_cup - sx * 0.014, skull_cy, nz_c))
    nas_glass_ring = []
    for k in range(n_nas):
        ang = 2.0 * math.pi * k / n_nas
        ca, sa = math.cos(ang), math.sin(ang)
        w_taper = 0.42 + 0.58 * (0.5 - 0.5 * sa)
        dy_n = 0.0112 * ca * w_taper
        dz_n = 0.0135 * sa
        nas_glass_ring.append(bm_glass.verts.new((nx_cup, skull_cy + dy_n, nz_c + dz_n)))
    for k in range(n_nas):
        k1 = (k + 1) % n_nas
        try:
            if sx > 0:
                bm_glass.faces.new((nas_cup_c, nas_glass_ring[k1], nas_glass_ring[k]))
            else:
                bm_glass.faces.new((nas_cup_c, nas_glass_ring[k], nas_glass_ring[k1]))
        except ValueError:
            pass
    # Bony central nasal septum (vomer) inside the dark nasal cavity
    add_box(bm_bone, (nx_cup - sx * 0.002, skull_cy, nz_c - 0.002), (0.010, 0.0022, 0.020))

    # 6c. Dark Oral Cavity Backing & Centered Upper + Lower Dentition (16 Lathe-Turned Teeth)
    add_box(bm_glass, (skull_cx + sx * 0.062, skull_cy, skull_cz - 0.056), (0.022, 0.046, 0.024))

    tooth_rz = [
        (0.001, 0.0),
        (0.0036, 0.002),
        (0.0042, 0.007),
        (0.0036, 0.013),
        (0.0018, 0.016),
    ]
    for t_idx in range(8):
        u_t = ((t_idx + 0.5) / 8.0) * 2.0 - 1.0  # -0.875 to +0.875 (perfectly symmetric around 0)
        ty_u = skull_cy + u_t * 0.027
        tx_u = skull_cx + sx * (0.078 - (u_t * u_t) * 0.024)
        tz_u = skull_cz - 0.055 + (u_t * u_t) * 0.004
        sc_t = 1.05 if abs(u_t) < 0.35 else (0.90 if abs(u_t) < 0.65 else 0.78)
        add_lathe_profile(bm_bone, tooth_rz, center=(tx_u, ty_u, tz_u), axis="Z", segments=8, scale_xy=(sc_t, sc_t * 0.85), cap_ends=True)

        # Lower tooth (centered on skull_cy + u_t * 0.0245, slightly inset behind upper arch)
        ty_l = skull_cy + u_t * 0.0245
        tx_l = skull_cx + sx * (0.074 - (u_t * u_t) * 0.022)
        tz_l = skull_cz - 0.070 + (u_t * u_t) * 0.004
        add_lathe_profile(bm_bone, tooth_rz, center=(tx_l, ty_l, tz_l), axis="Z", segments=8, scale_xy=(sc_t * 0.88, sc_t * 0.80), cap_ends=True)

    # 6d. Articulated Mandible (Lower Jawbone) with Rounded Chin & Ascending Rami
    jaw_pts = []
    for i in range(21):
        t = (i / 20.0) * 2.0 - 1.0  # -1 to +1
        at = abs(t)
        if at <= 0.65:
            un = t / 0.65
            jy = skull_cy + un * 0.030
            jx = skull_cx + sx * (0.075 - (un * un) * 0.030)
            jz = skull_cz - 0.078 + (un * un) * 0.009
            sc_u = 1.18 if at < 0.22 else 0.92
            sc_v = 1.12 if at < 0.22 else 0.92
        else:
            ur = (at - 0.65) / 0.35
            sign_t = 1.0 if t >= 0 else -1.0
            jy = skull_cy + sign_t * (0.030 + ur * 0.012)
            jx = skull_cx + sx * (0.045 - ur * 0.020)
            jz = skull_cz - 0.069 + ur * 0.064
            sc_u = 0.88 * (1.0 - 0.25 * ur)
            sc_v = 1.00 * (1.0 - 0.25 * ur)
        jaw_pts.append((jx, jy, jz, sc_u, sc_v))
    jaw_prof = [
        (-0.010, -0.009), (0.0, -0.012), (0.010, -0.009),
        (0.011, 0.002), (0.008, 0.012), (0.0, 0.014),
        (-0.008, 0.012), (-0.011, 0.002),
    ]
    add_extruded_profile_along_path(bm_bone, jaw_prof, jaw_pts, up_hint=norm)



def build_gothic_door_and_tracery(bm_frame_slate, bm_d_teal, bm_d_slate, bm_d_iron, bm_w_slate, bm_w_glass, side_sign, y_door=0.22):
    """
    Build the full-height Center Entrance Doorway on the side of the carriage:
    - Stationary surround frame (molded vertical pilasters, threshold sill, arched header) -> bm_frame_slate
    - Movable hinged door leaf (lower teal wood backing, stiles, rails,
      recessed gothic panels, and iron handle/hinges) -> bm_d_teal, bm_d_slate, bm_d_iron
    - Articulated Upper Gothic Casement Window Sash (arched frame, 3D tracery, leaded glass) -> bm_w_slate, bm_w_glass
    """
    sx = side_sign
    norm = Vector((sx, 0.0, 0.0))
    half_door_w = 0.34
    y_left = y_door - half_door_w
    y_right = y_door + half_door_w
    z_bot = 1.08
    z_top = 2.52

    # 1. Left & Right Full-Height Molded Door Pilasters (Stationary Frame)
    pilaster_prof = [
        (-0.036, -0.035),
        (0.036, -0.035),
        (0.032, 0.025),
        (0.022, 0.042),
        (-0.022, 0.042),
        (-0.032, 0.025),
    ]
    for py in (y_left - 0.056, y_right + 0.056):
        p_path = []
        for i in range(16):
            t = i / 15.0
            z = z_bot + t * (z_top - z_bot)
            x = sx * (wall_x_at_z(z) + 0.032)
            p_path.append((x, py, z, 1.0, 1.0))
        add_extruded_profile_along_path(bm_frame_slate, pilaster_prof, p_path, up_hint=norm)

        add_box(bm_frame_slate, (sx * (wall_x_at_z(z_bot) + 0.038), py, z_bot + 0.04), (0.095, 0.086, 0.082))
        add_box(bm_frame_slate, (sx * (wall_x_at_z(z_top) + 0.042), py, z_top - 0.03), (0.105, 0.092, 0.072))

    # 2. Door Threshold Sill at bottom (Z = 1.07, Stationary Frame)
    add_box(bm_frame_slate, (sx * (wall_x_at_z(1.10) + 0.035), y_door, 1.068), (0.12, half_door_w * 2.38, 0.042))

    # 3. Arched Door Surround Header at top (Z = 2.44 to 2.53, Stationary Frame)
    header_pts = []
    for i in range(17):
        t = (i / 16.0) * 2.0 - 1.0
        hy = y_door + t * (half_door_w + 0.056)
        hz = 2.445 + (1.0 - t * t) * 0.09
        hx = sx * (wall_x_at_z(hz) + 0.036)
        header_pts.append((hx, hy, hz, 1.0, 1.0))
    add_extruded_profile_along_path(bm_frame_slate, pilaster_prof, header_pts, up_hint=norm)

    # 4. Movable Hinged Door Leaf Backing (continuous manifold for lower teal wood, separate non-overlapping upper window sash glass)
    n_dz = 10
    d_teal_rings = []
    ya_d = y_door - 0.272
    yb_d = y_door + 0.272
    for i in range(n_dz):
        z = 1.13 + (i / (n_dz - 1)) * (1.79 - 1.13)
        xw = wall_x_at_z(z)
        x_in = sx * (xw - 0.008)
        x_out = sx * (xw + 0.022)
        xa, xb = min(x_in, x_out), max(x_in, x_out)
        d_teal_rings.append([
            bm_d_teal.verts.new((xa, ya_d, z)),
            bm_d_teal.verts.new((xb, ya_d, z)),
            bm_d_teal.verts.new((xb, yb_d, z)),
            bm_d_teal.verts.new((xa, yb_d, z)),
        ])
    for i in range(n_dz - 1):
        r0, r1 = d_teal_rings[i], d_teal_rings[i + 1]
        for j in range(4):
            j1 = (j + 1) % 4
            try:
                bm_d_teal.faces.new((r0[j], r0[j1], r1[j1], r1[j]))
            except ValueError:
                pass
    try:
        bm_d_teal.faces.new(list(reversed(d_teal_rings[0])))
        bm_d_teal.faces.new(d_teal_rings[-1])
    except ValueError:
        pass

    # Continuous manifold for the upper door casement window glass (strictly inside the upper window sash opening)
    n_wz = 9
    w_glass_rings = []
    ya_w = y_door - 0.232
    yb_w = y_door + 0.232
    for i in range(n_wz):
        z = 1.845 + (i / (n_wz - 1)) * (2.345 - 1.845)
        xw = wall_x_at_z(z)
        x_in = sx * (xw + 0.005)
        x_out = sx * (xw + 0.015)
        xa, xb = min(x_in, x_out), max(x_in, x_out)
        w_glass_rings.append([
            bm_w_glass.verts.new((xa, ya_w, z)),
            bm_w_glass.verts.new((xb, ya_w, z)),
            bm_w_glass.verts.new((xb, yb_w, z)),
            bm_w_glass.verts.new((xa, yb_w, z)),
        ])
    for i in range(n_wz - 1):
        r0, r1 = w_glass_rings[i], w_glass_rings[i + 1]
        for j in range(4):
            j1 = (j + 1) % 4
            try:
                bm_w_glass.faces.new((r0[j], r0[j1], r1[j1], r1[j]))
            except ValueError:
                pass
    try:
        bm_w_glass.faces.new(list(reversed(w_glass_rings[0])))
        bm_w_glass.faces.new(w_glass_rings[-1])
    except ValueError:
        pass

    # Outer door stiles (left & right vertical door edges, cleanly framing the lower panel and upper window opening)
    stile_prof = [(-0.026, -0.024), (0.026, -0.024), (0.022, 0.022), (-0.022, 0.022)]
    for dy_s in (-half_door_w + 0.042, half_door_w - 0.042):
        s_path = [
            (sx * (wall_x_at_z(z) + 0.016), y_door + dy_s, z)
            for z in (1.115, 1.45, 1.80, 2.12, 2.395)
        ]
        add_extruded_profile_along_path(bm_d_slate, stile_prof, s_path, up_hint=norm)

    # Horizontal door rails spanning strictly between the inner faces of the left & right stiles (width = 0.540m)
    rail_span_y = (half_door_w - 0.042 - 0.026) * 2.0 - 0.004
    for rz, rh in ((1.14, 0.060), (1.65, 0.050), (1.80, 0.050), (2.382, 0.046)):
        add_box(bm_d_slate, (sx * (wall_x_at_z(rz) + 0.016), y_door, rz), (0.044, rail_span_y, rh))

    # Middle horizontal lock panel molding between Z=1.65 and Z=1.80
    z_lock = 1.725
    add_box(bm_d_teal, (sx * (wall_x_at_z(z_lock) + 0.022), y_door, z_lock), (0.036, half_door_w * 1.42, 0.068))

    # 5. Lower Twin Vertical Recessed Gothic Panels (Z = 1.18 to 1.62)
    z_low_mid = 1.395
    add_box(bm_d_slate, (sx * (wall_x_at_z(z_low_mid) + 0.016), y_door, z_low_mid), (0.044, 0.054, 0.44))

    panel_mould_prof = [(-0.014, -0.010), (0.014, -0.010), (0.010, 0.016), (-0.010, 0.016)]
    for p_side in (-1, 1):
        py_c = y_door + p_side * 0.145
        pw = 0.092
        ph_bot, ph_top = 1.21, 1.585
        p_pts = [
            (sx * (wall_x_at_z(ph_bot) + 0.026), py_c - pw, ph_bot),
            (sx * (wall_x_at_z(ph_bot) + 0.026), py_c + pw, ph_bot),
            (sx * (wall_x_at_z(ph_top) + 0.026), py_c + pw, ph_top),
            (sx * (wall_x_at_z(ph_top + 0.02) + 0.026), py_c, ph_top + 0.022),
            (sx * (wall_x_at_z(ph_top) + 0.026), py_c - pw, ph_top),
        ]
        add_extruded_profile_along_path(bm_d_slate, panel_mould_prof, p_pts, closed_path=True, up_hint=norm)
        add_box(bm_d_teal, (sx * (wall_x_at_z(z_low_mid) + 0.022), py_c, z_low_mid), (0.028, pw * 1.22, 0.27))

    # 6. Articulated Upper Pointed Gothic Arch Window Sash & Multi-Layered 3D Gothic Tracery (Z = 1.845 to 2.345)
    z_win_bot = 1.848
    z_win_spring = 2.13
    z_win_peak = 2.342
    win_half_w = 0.232

    arch_frame_pts = [
        (sx * (wall_x_at_z(z_win_bot) + 0.022), y_door - win_half_w, z_win_bot),
        (sx * (wall_x_at_z(z_win_spring) + 0.022), y_door - win_half_w, z_win_spring),
    ]
    for i in range(1, 11):
        t = i / 10.0
        ay = y_door - win_half_w * (1.0 - t)
        az = z_win_spring + (z_win_peak - z_win_spring) * math.sin(t * math.pi * 0.5)
        arch_frame_pts.append((sx * (wall_x_at_z(az) + 0.022), ay, az))
    for i in range(1, 11):
        t = i / 10.0
        ay = y_door + win_half_w * t
        az = z_win_spring + (z_win_peak - z_win_spring) * math.cos(t * math.pi * 0.5)
        arch_frame_pts.append((sx * (wall_x_at_z(az) + 0.022), ay, az))
    arch_frame_pts.append((sx * (wall_x_at_z(z_win_bot) + 0.022), y_door + win_half_w, z_win_bot))

    tracery_outer_prof = [(-0.018, -0.018), (0.018, -0.018), (0.013, 0.022), (-0.013, 0.022)]
    add_extruded_profile_along_path(bm_w_slate, tracery_outer_prof, arch_frame_pts, closed_path=True, up_hint=norm)

    # 3D Gothic Tracery Ribs inside the Upper Door Window Sash
    rib_prof = [(-0.009, -0.014), (0.009, -0.014), (0.006, 0.018), (-0.006, 0.018)]

    for dm_y, z_end in ((0.0, 2.315), (-0.11, 2.16), (0.11, 2.16)):
        m_pts = [
            (sx * (wall_x_at_z(z) + 0.022), y_door + dm_y, z)
            for z in (z_win_bot + 0.012, 1.98, 2.09, z_end)
        ]
        add_extruded_profile_along_path(bm_w_slate, rib_prof, m_pts, up_hint=norm)

    for l_side in (-1, 1):
        ly_c = y_door + l_side * (win_half_w * 0.5)
        sub_w = win_half_w * 0.46
        lancet_pts = []
        for i in range(13):
            t = (i / 12.0) * 2.0 - 1.0
            ly = ly_c + t * sub_w
            lz = 1.86 + (1.0 - abs(t) ** 1.35) * 0.34
            lancet_pts.append((sx * (wall_x_at_z(lz) + 0.023), ly, lz))
        add_extruded_profile_along_path(bm_w_slate, rib_prof, lancet_pts, up_hint=norm)

        ogee_pts = []
        for i in range(14):
            t = i / 13.0
            oy = y_door + l_side * win_half_w * (0.90 - 1.42 * t)
            oz = 1.94 + 0.35 * t + 0.032 * math.sin(t * math.pi * 2.0)
            ogee_pts.append((sx * (wall_x_at_z(oz) + 0.024), oy, oz))
        add_extruded_profile_along_path(bm_w_slate, rib_prof, ogee_pts, up_hint=norm)

    for cz_rose, r_rose in ((2.20, 0.074), (2.01, 0.082)):
        rose_pts = []
        for i in range(24):
            ang = 2.0 * math.pi * i / 24.0
            lobe = 1.0 + 0.22 * abs(math.cos(2.0 * ang))
            ry = y_door + math.sin(ang) * r_rose * lobe
            rz = cz_rose + math.cos(ang) * r_rose * lobe * 1.12
            rose_pts.append((sx * (wall_x_at_z(rz) + 0.024), ry, rz))
        add_extruded_profile_along_path(bm_w_slate, rib_prof, rose_pts, closed_path=True, up_hint=norm)

    # 7. Wrought-Iron Door Handle (Interior & Exterior), Escutcheon Plate & Strap Hinges
    hx = sx * (wall_x_at_z(1.72) + 0.044)
    add_box(bm_d_iron, (hx, y_door - 0.24, 1.72), (0.048, 0.035, 0.14))
    add_cylinder(bm_d_iron, (hx + sx * 0.024, y_door - 0.24, 1.72), radius=0.028, height=0.016, segments=12, axis="Y")
    add_cylinder(bm_d_iron, (hx - sx * 0.038, y_door - 0.24, 1.72), radius=0.025, height=0.016, segments=12, axis="Y")
    for hz_hinge in (1.26, 1.78, 2.22):
        add_box(bm_d_iron, (sx * (wall_x_at_z(hz_hinge) + 0.042), y_door + 0.275, hz_hinge), (0.018, 0.095, 0.030))



def build_sweeping_corner_corbel(bm_teal, bm_slate, bm_iron, side_sign, is_front):
    """
    Build the dramatic sweeping concave corner arch-corbel and flared Gothic Plinth Block
    at each of the 4 corners of the cabin (Front-Left, Rear-Left, Front-Right, Rear-Right).
    """
    sx = side_sign
    norm = Vector((sx, 0.0, 0.0))
    y_dir = -1.0 if is_front else 1.0
    y_wall_corner = -1.32 if is_front else 1.84

    # 1. Flared Gothic Plinth Block sitting above its base collar on the side ledge (Z = 1.21 to 1.60)
    y_plinth_mid = y_wall_corner - y_dir * 0.09
    add_box(bm_slate, (sx * (wall_x_at_z(1.185) + 0.048), y_plinth_mid, 1.185), (0.135, 0.43, 0.050))

    z_p0, z_p1 = 1.21, 1.60
    plinth_w_bot = 0.34
    n_pz = 10
    rings = []
    for i in range(n_pz):
        t = i / (n_pz - 1)
        z = z_p0 + t * (z_p1 - z_p0)
        xw_in = sx * (wall_x_at_z(z) + 0.006)
        xw_out = sx * (wall_x_at_z(z) + 0.082 * (1.0 - 0.30 * t))
        y_in = y_wall_corner - y_dir * (plinth_w_bot * (1.0 - 0.55 * (t ** 0.75)))
        y_out = y_wall_corner + y_dir * (0.08 + 0.06 * t)
        xa, xb = min(xw_in, xw_out), max(xw_in, xw_out)
        ya, yb = min(y_in, y_out), max(y_in, y_out)
        ring = [
            bm_slate.verts.new((xa, ya, z)),
            bm_slate.verts.new((xb, ya, z)),
            bm_slate.verts.new((xb, yb, z)),
            bm_slate.verts.new((xa, yb, z)),
        ]
        rings.append(ring)

    for i in range(n_pz - 1):
        r0, r1 = rings[i], rings[i + 1]
        for j in range(4):
            j1 = (j + 1) % 4
            try:
                bm_slate.faces.new((r0[j], r0[j1], r1[j1], r1[j]))
            except ValueError:
                pass
    try:
        bm_slate.faces.new(list(reversed(rings[0])))
        bm_slate.faces.new(rings[-1])
    except ValueError:
        pass

    # Crisp 3D Gothic Relief Scrollwork on the outer side face of the Plinth Block
    add_scroll_relief_panel(
        bm_iron,
        center=(sx * (wall_x_at_z(1.36) + 0.076), y_plinth_mid, 1.36),
        normal_axis="+X" if sx > 0 else "-X",
        u_size=0.22,
        v_size=0.24,
        depth=0.015,
    )

    # 2. Sweeping Upper Concave Arch-Corbel rising from Z = 1.58 to Z = 2.55
    sweep_reach = 0.74 if is_front else 0.34
    n_arch = 18
    corbel_rings = []
    outer_trim_pts = []
    inner_trim_pts = []
    rivets = []

    for i in range(n_arch):
        t = i / (n_arch - 1)
        z = 1.58 + t * (2.55 - 1.58)
        curve_f = (t ** 2.05) * sweep_reach
        y_front_edge = y_wall_corner + y_dir * (0.12 + curve_f)
        y_back_edge = y_wall_corner - y_dir * (0.06 * (1.0 - 0.4 * t))

        x_in = sx * (wall_x_at_z(z) - 0.024)
        x_out = sx * (wall_x_at_z(z) + 0.044)
        xa, xb = min(x_in, x_out), max(x_in, x_out)
        ya, yb = min(y_front_edge, y_back_edge), max(y_front_edge, y_back_edge)

        ring = [
            bm_teal.verts.new((xa, ya, z)),
            bm_teal.verts.new((xb, ya, z)),
            bm_teal.verts.new((xb, yb, z)),
            bm_teal.verts.new((xa, yb, z)),
        ]
        corbel_rings.append(ring)

        outer_trim_pts.append((sx * (wall_x_at_z(z) + 0.038), y_front_edge, z, 1.0, 1.0))
        inner_trim_pts.append((sx * (wall_x_at_z(z) + 0.038), y_back_edge, z, 0.85, 0.85))
        if i % 2 == 1:
            ym = 0.5 * (y_front_edge + y_back_edge)
            rivets.append(((sx * (wall_x_at_z(z) + 0.050), ym, z), (sx, 0, 0)))

    for i in range(n_arch - 1):
        r0, r1 = corbel_rings[i], corbel_rings[i + 1]
        for j in range(4):
            j1 = (j + 1) % 4
            try:
                bm_teal.faces.new((r0[j], r0[j1], r1[j1], r1[j]))
            except ValueError:
                pass
    try:
        bm_teal.faces.new(corbel_rings[-1])
    except ValueError:
        pass

    flange_prof = [(-0.038, -0.022), (0.038, -0.022), (0.030, 0.024), (-0.030, 0.024)]
    add_extruded_profile_along_path(bm_slate, flange_prof, outer_trim_pts, up_hint=norm)
    add_extruded_profile_along_path(bm_slate, flange_prof, inner_trim_pts, up_hint=norm)
    add_rivet_row(bm_iron, rivets, radius=0.010)


def build_front_and_rear_walls(
    bm_teal,
    bm_slate,
    bm_iron,
    bm_wf_slate,
    bm_wf_glass,
    bm_wr_l_slate,
    bm_wr_l_glass,
    bm_wr_r_slate,
    bm_wr_r_glass,
):
    """
    Build the Front Bulkhead Wall (with true window cutout & articulated top-hinged Front Gothic Window)
    and the Rear Bulkhead Wall (with true window cutout & articulated twin Rear French Casement Windows),
    plus the Front Porch Balcony (turned balusters, molded handrail, and corner goblet finials).
    """
    # =========================================================================
    # 1. FRONT BULKHEAD WALL (Y = -1.32, Z = 1.15 to 2.86) WITH WINDOW APERTURE
    # =========================================================================
    y_front_wall = -1.32
    n_planks = 26
    for i in range(n_planks):
        t0 = (i / n_planks) * 2.0 - 1.0
        t1 = ((i + 1) / n_planks) * 2.0 - 1.0
        tm = 0.5 * (t0 + t1)
        x_w = tm * 0.94
        pw = (2.0 * 0.94 / n_planks) * 0.94
        z_arch_top = 2.86 - (tm * tm) * 0.30
        y_var = 0.002 * math.sin(i * 2.7)
        if abs(x_w) < 0.27:
            # Cut open window aperture between Z = 1.75 and Z = 2.42
            z_bot_h = 1.75 - 1.15
            add_box(bm_teal, (x_w, y_front_wall + y_var, 1.15 + z_bot_h * 0.5), (pw, 0.045, z_bot_h))
            if z_arch_top > 2.42:
                z_top_h = z_arch_top - 2.42
                add_box(bm_teal, (x_w, y_front_wall + y_var, 2.42 + z_top_h * 0.5), (pw, 0.045, z_top_h))
        else:
            z_mid = 0.5 * (1.15 + z_arch_top)
            add_box(bm_teal, (x_w, y_front_wall + y_var, z_mid), (pw, 0.045, z_arch_top - 1.15))

    # Stationary Front Gothic Door / Window Frame on Front Bulkhead
    fw_half = 0.31
    y_fw = y_front_wall - 0.032
    front_norm = Vector((0, -1, 0))

    f_pil_prof = [(-0.035, -0.032), (0.035, -0.032), (0.028, 0.028), (-0.028, 0.028)]
    for sx in (-1, 1):
        p_pts = [(sx * (fw_half + 0.038), y_fw, z) for z in (1.18, 1.60, 2.05, 2.46)]
        add_extruded_profile_along_path(bm_slate, f_pil_prof, p_pts, up_hint=front_norm)

    # Projecting Entablature Lintel Cornice at top of front door (Z = 2.48) & Sill at Z = 1.75
    add_box(bm_slate, (0.0, y_fw - 0.025, 2.48), (fw_half * 2.55, 0.095, 0.055))
    add_box(bm_slate, (0.0, y_fw - 0.038, 2.515), (fw_half * 2.72, 0.115, 0.038))
    add_box(bm_slate, (0.0, y_fw - 0.01, 1.745), (fw_half * 2.1, 0.065, 0.052))

    # Lower stationary carved relief panel below the front window (Z = 1.18 to 1.72)
    add_box(bm_teal, (0.0, y_fw, 1.46), (fw_half * 1.75, 0.035, 0.46))
    add_scroll_relief_panel(bm_slate, (0.0, y_fw - 0.022, 1.46), "-Y", u_size=0.44, v_size=0.36, depth=0.016)

    # Articulated Top-Hinged Front Gothic Awning Window Sash (Z = 1.78 to 2.40, hinged at Z = 2.40)
    add_box(bm_wf_glass, (0.0, y_fw + 0.016, 2.09), (fw_half * 1.74, 0.012, 0.56))
    # Perimeter sash frame for the movable front window (horizontal rails span strictly between vertical stiles)
    wf_rail_span = (fw_half * 0.90 - 0.018) * 2.0 - 0.002
    add_box(bm_wf_slate, (0.0, y_fw - 0.006, 2.39), (wf_rail_span, 0.034, 0.034))
    add_box(bm_wf_slate, (0.0, y_fw - 0.006, 1.79), (wf_rail_span, 0.034, 0.034))
    for sx in (-1, 1):
        add_box(bm_wf_slate, (sx * fw_half * 0.90, y_fw - 0.006, 2.09), (0.036, 0.034, 0.634))

    rib_prof = [(-0.010, -0.010), (0.010, -0.010), (0.007, 0.014), (-0.007, 0.014)]
    for sx in (-1, 1):
        outer_arch = []
        for i in range(12):
            t = i / 11.0
            ax = sx * fw_half * 0.86 * (1.0 - t)
            az = 2.08 + 0.28 * math.sin(t * math.pi * 0.5)
            outer_arch.append((ax, y_fw - 0.014, az))
        add_extruded_profile_along_path(bm_wf_slate, rib_prof, outer_arch, up_hint=front_norm)

        for x_start in (-fw_half * 0.72, -fw_half * 0.24, fw_half * 0.24):
            diag_pts = []
            for i in range(10):
                t = i / 9.0
                dx = x_start + sx * t * 0.30
                dz = 1.81 + t * 0.52
                if abs(dx) <= fw_half * 0.84:
                    diag_pts.append((dx, y_fw - 0.012, dz))
            if len(diag_pts) >= 2:
                add_extruded_profile_along_path(bm_wf_slate, rib_prof, diag_pts, up_hint=front_norm)

    add_box(bm_wf_slate, (0.0, y_fw - 0.006, 2.09), (0.024, 0.028, 0.562))

    # =========================================================================
    # 2. FRONT BALCONY / PORCH BALUSTRADE (Y = -2.02 to -1.35, Z = 1.16 to 1.82)
    # =========================================================================
    y_bal_front = -1.96
    x_bal_side = 0.80
    z_rail_bot = 1.18
    z_rail_top = 1.54

    shoe_prof = [(-0.042, -0.022), (0.042, -0.022), (0.036, 0.022), (-0.036, 0.022)]
    bal_path_bot = [
        (-x_bal_side, -1.36, z_rail_bot),
        (-x_bal_side, y_bal_front + 0.06, z_rail_bot),
        (-x_bal_side + 0.06, y_bal_front, z_rail_bot),
        (x_bal_side - 0.06, y_bal_front, z_rail_bot),
        (x_bal_side, y_bal_front + 0.06, z_rail_bot),
        (x_bal_side, -1.36, z_rail_bot),
    ]
    add_extruded_profile_along_path(bm_slate, shoe_prof, bal_path_bot, up_hint=Vector((0, 0, 1)))

    handrail_prof = [
        (-0.062, -0.038),
        (0.062, -0.038),
        (0.072, -0.018),
        (0.056, 0.0),
        (0.076, 0.022),
        (0.068, 0.042),
        (-0.068, 0.042),
        (-0.076, 0.022),
        (-0.056, 0.0),
        (-0.072, -0.018),
    ]
    bal_path_top = [
        (-x_bal_side, -1.34, z_rail_top),
        (-x_bal_side, y_bal_front + 0.05, z_rail_top),
        (-x_bal_side + 0.05, y_bal_front, z_rail_top),
        (x_bal_side - 0.05, y_bal_front, z_rail_top),
        (x_bal_side, y_bal_front + 0.05, z_rail_top),
        (x_bal_side, -1.34, z_rail_top),
    ]
    add_extruded_profile_along_path(bm_slate, handrail_prof, bal_path_top, up_hint=Vector((0, 0, 1)))

    rail_rivets = []
    for rx in (-0.68, -0.50, -0.32, -0.15, 0.0, 0.15, 0.32, 0.50, 0.68):
        rail_rivets.append(((rx, y_bal_front - 0.068, z_rail_top), (0, -1, 0)))
    for sx in (-1, 1):
        for ry in (-1.84, -1.66, -1.48):
            rail_rivets.append(((sx * (x_bal_side + 0.068), ry, z_rail_top), (sx, 0, 0)))
    add_rivet_row(bm_iron, rail_rivets, radius=0.008)

    spindle_positions = [
        (-0.70, y_bal_front),
        (-0.42, y_bal_front),
        (-0.14, y_bal_front),
        (0.14, y_bal_front),
        (0.42, y_bal_front),
        (0.70, y_bal_front),
        (-x_bal_side, -1.72),
        (-x_bal_side, -1.50),
        (x_bal_side, -1.72),
        (x_bal_side, -1.50),
    ]
    spindle_h = 0.30
    spindle_rz = [
        (0.028, 0.0),
        (0.028, 0.025),
        (0.034, 0.042),
        (0.020, 0.062),
        (0.036, 0.105),
        (0.032, 0.145),
        (0.018, 0.195),
        (0.026, 0.215),
        (0.017, 0.235),
        (0.030, 0.275),
        (0.026, spindle_h),
    ]
    for sp_x, sp_y in spindle_positions:
        add_box(bm_teal, (sp_x, sp_y, 1.21), (0.062, 0.062, 0.035))
        add_box(bm_teal, (sp_x, sp_y, 1.49), (0.062, 0.062, 0.035))
        add_lathe_profile(bm_teal, spindle_rz, center=(sp_x, sp_y, 1.20), axis="Z", segments=14)

    goblet_rz = [
        (0.038, 0.0),
        (0.042, 0.018),
        (0.022, 0.038),
        (0.016, 0.075),
        (0.028, 0.095),
        (0.018, 0.115),
        (0.040, 0.155),
        (0.044, 0.195),
        (0.034, 0.215),
        (0.018, 0.230),
        (0.002, 0.245),
    ]
    for sx in (-1, 1):
        add_lathe_profile(bm_slate, goblet_rz, center=(sx * 0.56, y_bal_front + 0.02, z_rail_top + 0.04), axis="Z", segments=16)

    # =========================================================================
    # 3. REAR BULKHEAD WALL & TWIN FRENCH CASEMENT WINDOWS (Y = +1.84, Z = 1.15 to 2.86)
    # =========================================================================
    y_rear_wall = 1.84
    rear_norm = Vector((0, 1, 0))
    for i in range(n_planks):
        t0 = (i / n_planks) * 2.0 - 1.0
        t1 = ((i + 1) / n_planks) * 2.0 - 1.0
        tm = 0.5 * (t0 + t1)
        x_w = tm * 0.94
        pw = (2.0 * 0.94 / n_planks) * 0.94
        z_arch_top = 2.86 - (tm * tm) * 0.30
        y_var = 0.002 * math.cos(i * 2.3)
        if abs(x_w) < 0.27:
            # Cut open rear window aperture between Z = 1.48 and Z = 2.44
            z_bot_h = 1.48 - 1.15
            add_box(bm_teal, (x_w, y_rear_wall + y_var, 1.15 + z_bot_h * 0.5), (pw, 0.045, z_bot_h))
            if z_arch_top > 2.44:
                z_top_h = z_arch_top - 2.44
                add_box(bm_teal, (x_w, y_rear_wall + y_var, 2.44 + z_top_h * 0.5), (pw, 0.045, z_top_h))
        else:
            z_mid = 0.5 * (1.15 + z_arch_top)
            add_box(bm_teal, (x_w, y_rear_wall + y_var, z_mid), (pw, 0.045, z_arch_top - 1.15))

    # Stationary Rear Gothic Window Outer Pilasters, Lintel & Sill
    y_rw = y_rear_wall + 0.032
    for sx in (-1, 1):
        p_pts = [(sx * (fw_half + 0.038), y_rw, z) for z in (1.48, 1.80, 2.15, 2.44)]
        add_extruded_profile_along_path(bm_slate, f_pil_prof, p_pts, up_hint=rear_norm)
    add_box(bm_slate, (0.0, y_rw + 0.02, 2.465), (fw_half * 2.5, 0.085, 0.052))
    add_box(bm_slate, (0.0, y_rw + 0.02, 1.475), (fw_half * 2.4, 0.085, 0.052))

    # Articulated Twin Rear French Casement Window Leaves (Left & Right)
    for sx, bm_r_slate, bm_r_glass in (
        (-1, bm_wr_l_slate, bm_wr_l_glass),
        (1, bm_wr_r_slate, bm_wr_r_glass),
    ):
        leaf_xc = sx * 0.1435
        leaf_w = 0.233
        add_box(bm_r_glass, (leaf_xc, y_rw - 0.012, 1.96), (leaf_w, 0.012, 0.84))
        # Casement leaf perimeter stiles & rails (horizontal rails span strictly between vertical stiles)
        add_box(bm_r_slate, (sx * 0.274, y_rw + 0.006, 1.96), (0.026, 0.032, 0.892))
        add_box(bm_r_slate, (sx * 0.013, y_rw + 0.006, 1.96), (0.024, 0.032, 0.892))
        add_box(bm_r_slate, (leaf_xc, y_rw + 0.006, 2.388), (leaf_w, 0.032, 0.034))
        add_box(bm_r_slate, (leaf_xc, y_rw + 0.006, 1.532), (leaf_w, 0.032, 0.034))
        add_box(bm_r_slate, (leaf_xc, y_rw + 0.006, 1.96), (leaf_w, 0.026, 0.026))
        # Pointed gothic lancet arch inside each rear casement leaf
        lancet_pts = []
        for k in range(11):
            t = (k / 10.0) * 2.0 - 1.0
            lx = leaf_xc + t * (leaf_w * 0.44)
            lz = 2.08 + (1.0 - abs(t) ** 1.4) * 0.27
            lancet_pts.append((lx, y_rw + 0.016, lz))
        add_extruded_profile_along_path(bm_r_slate, rib_prof, lancet_pts, up_hint=rear_norm)
        add_scroll_relief_panel(bm_r_slate, (leaf_xc, y_rw + 0.020, 1.96), "+Y", u_size=0.21, v_size=0.66, depth=0.015)



def build_carriage_body(mats):
    """
    Construct the complete Lower Belly Box, Carved Front & Rear Aprons, Riveted Side Ledges,
    3-Bay Outward-Flaring Individual-Plank Cabin Walls, Sweeping Corner Corbels,
    Center Entrance Doors with 3D Gothic Tracery, 4x Sculpted Skull Medallions,
    Front Bulkhead Door, Rear Bulkhead Window, and Front Balcony Balustrade.
    """
    bm_teal = bmesh.new()
    bm_slate = bmesh.new()
    bm_iron = bmesh.new()
    bm_bone = bmesh.new()
    bm_glass = bmesh.new()

    # =========================================================================
    # 1. LOWER BODY BELLY BOX ("TROUGH") & CARVED FRONT/REAR APRONS (Z = 0.78 to 1.15)
    # =========================================================================
    n_by = 28
    y_belly_start = -1.96
    y_belly_end = 1.94
    belly_rings = []
    for i in range(n_by):
        t = i / (n_by - 1)
        y = y_belly_start + t * (y_belly_end - y_belly_start)
        apron_taper = 1.0
        if y < -1.35:
            apron_taper = 1.0 - 0.16 * ((-1.35 - y) / 0.61)
        xb_bot = 0.72 * apron_taper
        xb_mid = 0.81 * apron_taper
        xb_top = 0.91 * apron_taper
        ring = [
            bm_teal.verts.new((-xb_bot, y, 0.79)),
            bm_teal.verts.new((xb_bot, y, 0.79)),
            bm_teal.verts.new((xb_mid, y, 0.95)),
            bm_teal.verts.new((xb_top, y, 1.12)),
            bm_teal.verts.new((-xb_top, y, 1.12)),
            bm_teal.verts.new((-xb_mid, y, 0.95)),
        ]
        belly_rings.append(ring)

    for i in range(n_by - 1):
        r0, r1 = belly_rings[i], belly_rings[i + 1]
        for j in range(6):
            j1 = (j + 1) % 6
            try:
                bm_teal.faces.new((r0[j], r0[j1], r1[j1], r1[j]))
            except ValueError:
                pass
    try:
        f0 = bm_teal.faces.new(list(reversed(belly_rings[0])))
        f1 = bm_teal.faces.new(belly_rings[-1])
        bmesh.ops.triangulate(bm_teal, faces=[f0, f1])
    except ValueError:
        pass

    def belly_x_at_yz(y_val, z_val):
        taper = 1.0 - 0.16 * max(0.0, (-1.35 - y_val) / 0.61) if y_val < -1.35 else 1.0
        u_z = max(0.0, min(1.0, (z_val - 0.79) / (1.12 - 0.79)))
        return (0.72 + (0.91 - 0.72) * u_z) * taper

    for sx in (-1, 1):
        side_norm = Vector((sx, 0, 0))
        bot_trim_path = [
            (sx * (belly_x_at_yz(-1.95, 0.808) + 0.020), -1.95, 0.808),
            (sx * (belly_x_at_yz(-1.35, 0.808) + 0.020), -1.35, 0.808),
            (sx * (belly_x_at_yz(1.93, 0.808) + 0.020), 1.93, 0.808),
        ]
        t_prof = [(-0.018, -0.014), (0.018, -0.014), (0.018, 0.020), (-0.018, 0.020)]
        add_extruded_profile_along_path(bm_slate, t_prof, bot_trim_path, up_hint=side_norm)

        for wy, wr in ((-1.25, 0.44), (1.42, 0.50)):
            arch_pts = []
            for k in range(17):
                ang = (k / 16.0) * math.pi * 0.72 + math.pi * 0.14
                ay = wy - math.cos(ang) * wr
                az = 0.795 + math.sin(ang) * (wr * 0.64)
                if 0.835 <= az <= 1.095:
                    ax = sx * (belly_x_at_yz(ay, az) + 0.022)
                    arch_pts.append((ax, ay, az))
            if len(arch_pts) >= 2:
                add_extruded_profile_along_path(bm_slate, t_prof, arch_pts, up_hint=side_norm)

    # =========================================================================
    # 2. FRONT & REAR APRON CARVED GOTHIC SCROLLWORK PANELS & CONSOLE BRACKETS
    # =========================================================================
    apron_frame_prof = [(-0.024, -0.022), (0.024, -0.022), (0.018, 0.024), (-0.018, 0.024)]
    front_apron_rect = [
        (-0.54, -1.97, 0.83),
        (0.54, -1.97, 0.83),
        (0.60, -1.97, 1.08),
        (-0.60, -1.97, 1.08),
    ]
    add_extruded_profile_along_path(bm_slate, apron_frame_prof, front_apron_rect, closed_path=True, up_hint=Vector((0, -1, 0)))
    add_scroll_relief_panel(bm_teal, (0.0, -1.975, 0.955), "-Y", u_size=0.96, v_size=0.22, depth=0.022)

    rear_apron_rect = [
        (-0.58, 1.95, 0.83),
        (0.58, 1.95, 0.83),
        (0.64, 1.95, 1.08),
        (-0.64, 1.95, 1.08),
    ]
    add_extruded_profile_along_path(bm_slate, apron_frame_prof, rear_apron_rect, closed_path=True, up_hint=Vector((0, 1, 0)))
    add_scroll_relief_panel(bm_teal, (0.0, 1.955, 0.955), "+Y", u_size=1.02, v_size=0.22, depth=0.022)

    corbel_prof = [(-0.032, -0.028), (0.032, -0.028), (0.026, 0.028), (-0.026, 0.028)]
    for sx in (-1, 1):
        s_corbel_pts = [
            (sx * 0.62, -1.94, 0.80, 0.85, 0.85),
            (sx * 0.66, -1.98, 0.90, 1.15, 1.15),
            (sx * 0.70, -2.02, 1.02, 1.10, 1.10),
            (sx * 0.74, -2.06, 1.12, 1.30, 1.30),
        ]
        add_extruded_profile_along_path(bm_slate, corbel_prof, s_corbel_pts, up_hint=Vector((0, -1, 0)))

    # =========================================================================
    # 3. MAIN HORIZONTAL SIDE LEDGE & FRONT PORCH PLATFORM (Z = 1.12 to 1.18)
    # =========================================================================
    ledge_prof = [
        (-0.085, -0.032),
        (0.085, -0.032),
        (0.095, -0.008),
        (0.078, 0.006),
        (0.098, 0.024),
        (0.088, 0.038),
        (-0.085, 0.038),
    ]
    ledge_perim = [
        (-0.92, -1.35, 1.14),
        (-0.86, -2.00, 1.14),
        (-0.78, -2.07, 1.14),
        (0.78, -2.07, 1.14),
        (0.86, -2.00, 1.14),
        (0.92, -1.35, 1.14),
        (0.92, 1.98, 1.14),
        (-0.92, 1.98, 1.14),
    ]
    add_extruded_profile_along_path(bm_slate, ledge_prof, ledge_perim, closed_path=True, up_hint=Vector((0, 0, 1)))

    for i in range(18):
        px = -0.82 + (i + 0.5) * (1.64 / 18.0)
        add_box(bm_teal, (px, -1.68, 1.15), (0.086, 0.74, 0.036))

    ledge_rivets = []
    for sx in (-1, 1):
        for i in range(28):
            ry = -1.96 + i * (3.92 / 27.0)
            if -0.16 < ry < 0.60:
                continue
            rx = sx * (0.98 if ry > -1.38 else 0.92)
            ledge_rivets.append(((rx, ry, 1.14), (sx, 0, 0)))
    for i in range(13):
        rx = -0.74 + i * (1.48 / 12.0)
        ledge_rivets.append(((rx, -2.14, 1.14), (0, -1, 0)))
    add_rivet_row(bm_iron, ledge_rivets, radius=0.009)

    # =========================================================================
    # 4. 3-BAY OUTWARD-FLARING INDIVIDUAL-PLANK SIDE WALLS (Left & Right)
    # =========================================================================
    bay_ranges = [
        (-1.28, -0.18, 15),
        (0.62, 1.80, 16),
    ]
    n_z_steps = 14
    z_wall_bot = 1.15
    z_wall_top = 2.55

    for sx in (-1, 1):
        for y_start, y_end, num_p in bay_ranges:
            step_y = (y_end - y_start) / num_p
            plank_w = step_y * 0.93
            for p_idx in range(num_p):
                py_center = y_start + (p_idx + 0.5) * step_y
                ya = py_center - plank_w * 0.5
                yb = py_center + plank_w * 0.5
                x_jitter = 0.0016 * math.sin(p_idx * 3.1 + sx)
                plank_rings = []
                for iz in range(n_z_steps):
                    tz = iz / (n_z_steps - 1)
                    z = z_wall_bot + tz * (z_wall_top - z_wall_bot)
                    xw = wall_x_at_z(z) + x_jitter
                    x_in = sx * (xw - 0.032)
                    x_out = sx * xw
                    xa, xb = min(x_in, x_out), max(x_in, x_out)
                    ring = [
                        bm_teal.verts.new((xa, ya, z)),
                        bm_teal.verts.new((xb, ya, z)),
                        bm_teal.verts.new((xb, yb, z)),
                        bm_teal.verts.new((xa, yb, z)),
                    ]
                    plank_rings.append(ring)

                for iz in range(n_z_steps - 1):
                    r0, r1 = plank_rings[iz], plank_rings[iz + 1]
                    for j in range(4):
                        j1 = (j + 1) % 4
                        try:
                            bm_teal.faces.new((r0[j], r0[j1], r1[j1], r1[j]))
                        except ValueError:
                            pass

        for y_a, y_b in ((-1.25, -0.18), (0.62, 1.78)):
            ym = 0.5 * (y_a + y_b)
            add_box(bm_slate, (sx * (wall_x_at_z(1.18) + 0.015), ym, 1.18), (0.035, y_b - y_a, 0.045))

        # Build stationary door frame on bm_slate and movable hinged door leaf + casement window into dedicated BMesh objects!
        bm_d_teal = bmesh.new()
        bm_d_slate = bmesh.new()
        bm_d_iron = bmesh.new()
        bm_w_slate = bmesh.new()
        bm_w_glass = bmesh.new()
        build_gothic_door_and_tracery(
            bm_slate,
            bm_d_teal,
            bm_d_slate,
            bm_d_iron,
            bm_w_slate,
            bm_w_glass,
            sx,
            y_door=0.22,
        )
        side_tag = "L" if sx < 0 else "R"
        door_pivot = (sx * 0.955, 0.545, 1.78)
        win_door_pivot = (sx * 0.985, 0.455, 2.08)
        finalize_bmesh(bm_d_teal, f"Door_{side_tag}_Teal", mats["teal_wood"], bevel_width=0.002, bevel_segments=1, smooth=True, uv_scale=1.1, pivot=door_pivot)
        finalize_bmesh(bm_d_slate, f"Door_{side_tag}_Slate", mats["slate_trim"], bevel_width=0.002, bevel_segments=1, smooth=True, uv_scale=1.3, pivot=door_pivot)
        finalize_bmesh(bm_d_iron, f"Door_{side_tag}_Iron", mats["iron"], smooth=True, uv_scale=1.8, pivot=door_pivot)
        finalize_bmesh(bm_w_slate, f"Window_Door_{side_tag}_Slate", mats["slate_trim"], bevel_width=0.002, bevel_segments=1, smooth=True, uv_scale=1.3, pivot=win_door_pivot)
        finalize_bmesh(bm_w_glass, f"Window_Door_{side_tag}_Glass", mats["dark_glass"], smooth=True, uv_scale=1.0, pivot=win_door_pivot)

        build_sweeping_corner_corbel(bm_teal, bm_slate, bm_iron, sx, is_front=True)
        build_sweeping_corner_corbel(bm_teal, bm_slate, bm_iron, sx, is_front=False)
        build_sculpted_skull_medallion(bm_slate, bm_iron, bm_bone, bm_glass, sx, y_center=-0.72, z_center=1.94)
        build_sculpted_skull_medallion(bm_slate, bm_iron, bm_bone, bm_glass, sx, y_center=1.20, z_center=1.94)

    # =========================================================================
    # 5. FRONT & REAR BULKHEAD WALLS, ARTICULATED WINDOWS & FRONT BALCONY
    # =========================================================================
    bm_wf_slate = bmesh.new()
    bm_wf_glass = bmesh.new()
    bm_wr_l_slate = bmesh.new()
    bm_wr_l_glass = bmesh.new()
    bm_wr_r_slate = bmesh.new()
    bm_wr_r_glass = bmesh.new()

    build_front_and_rear_walls(
        bm_teal,
        bm_slate,
        bm_iron,
        bm_wf_slate,
        bm_wf_glass,
        bm_wr_l_slate,
        bm_wr_l_glass,
        bm_wr_r_slate,
        bm_wr_r_glass,
    )

    front_win_pivot = (0.0, -1.375, 2.40)
    finalize_bmesh(bm_wf_slate, "Window_Front_Slate", mats["slate_trim"], bevel_width=0.002, bevel_segments=1, smooth=True, uv_scale=1.3, pivot=front_win_pivot)
    finalize_bmesh(bm_wf_glass, "Window_Front_Glass", mats["dark_glass"], smooth=True, uv_scale=1.0, pivot=front_win_pivot)

    rear_l_pivot = (-0.285, 1.895, 1.96)
    finalize_bmesh(bm_wr_l_slate, "Window_Rear_L_Slate", mats["slate_trim"], bevel_width=0.002, bevel_segments=1, smooth=True, uv_scale=1.3, pivot=rear_l_pivot)
    finalize_bmesh(bm_wr_l_glass, "Window_Rear_L_Glass", mats["dark_glass"], smooth=True, uv_scale=1.0, pivot=rear_l_pivot)

    rear_r_pivot = (0.285, 1.895, 1.96)
    finalize_bmesh(bm_wr_r_slate, "Window_Rear_R_Slate", mats["slate_trim"], bevel_width=0.002, bevel_segments=1, smooth=True, uv_scale=1.3, pivot=rear_r_pivot)
    finalize_bmesh(bm_wr_r_glass, "Window_Rear_R_Glass", mats["dark_glass"], smooth=True, uv_scale=1.0, pivot=rear_r_pivot)

    # =========================================================================
    # 6. 4x EXTERIOR WROUGHT-IRON & BRASS GOTHIC COACH LANTERNS
    # =========================================================================
    build_exterior_coach_lanterns(mats)

    # =========================================================================
    # 7. FURNISHED VICTORIAN CABIN INTERIOR (Floor, Berth, Stove, Bureau, Ribs)
    # =========================================================================
    build_carriage_interior(mats)

    finalize_bmesh(bm_teal, "Body_TealWood", mats["teal_wood"], bevel_width=0.002, bevel_segments=1, smooth=True, uv_scale=1.1, wall_vertical_map=True)
    finalize_bmesh(bm_slate, "Body_SlateTrim", mats["slate_trim"], bevel_width=0.0025, bevel_segments=1, smooth=True, uv_scale=1.3)
    finalize_bmesh(bm_iron, "Body_IronHardware", mats["iron"], smooth=True, uv_scale=1.8)
    finalize_bmesh(bm_bone, "Body_SkullBone", mats["bone"], smooth=True, uv_scale=2.2, organic_uv=True)
    finalize_bmesh(bm_glass, "Body_DarkGlass", mats["dark_glass"], smooth=True, uv_scale=1.0)


def build_exterior_coach_lanterns(mats):
    """
    Build 4 ornate Victorian Gothic Wrought-Iron & Brass Coach Lanterns mounted on
    scrolled iron brackets at the 4 corners of the cabin (Front-Left, Front-Right
    flanking the balcony and Rear-Left, Rear-Right flanking the rear bulkhead).
    """
    bm_l_iron = bmesh.new()
    bm_l_brass = bmesh.new()
    bm_l_glass = bmesh.new()

    lantern_mounts = [
        (-1, -1.26, 2.02, -1),  # Front-Left
        (1, -1.26, 2.02, -1),   # Front-Right
        (-1, 1.78, 2.02, 1),    # Rear-Left
        (1, 1.78, 2.02, 1),     # Rear-Right
    ]
    bracket_prof = [(-0.012, -0.012), (0.012, -0.012), (0.010, 0.012), (-0.010, 0.012)]

    for sx, my, mz, y_dir in lantern_mounts:
        wx = sx * (wall_x_at_z(mz) + 0.025)
        lx = sx * 1.06
        ly = my + y_dir * 0.10
        lz = mz + 0.04

        # Wall mounting escutcheon plate
        add_box(bm_l_iron, (wx, my, mz), (0.024, 0.065, 0.16))
        add_sphere(bm_l_brass, (wx + sx * 0.014, my, mz + 0.055), radius=0.010, segments=8, rings=6)
        add_sphere(bm_l_brass, (wx + sx * 0.014, my, mz - 0.055), radius=0.010, segments=8, rings=6)

        # Forged S-scroll bracket arm from corner pilaster out to lantern socket
        arm_pts = [
            (wx, my, mz - 0.04),
            (wx + sx * 0.08, my + y_dir * 0.04, mz - 0.02),
            (wx + sx * 0.14, my + y_dir * 0.07, mz - 0.08),
            (lx, ly, lz - 0.14),
        ]
        add_extruded_profile_along_path(bm_l_iron, bracket_prof, arm_pts, up_hint=Vector((0, 0, 1)))

        # Upper decorative scroll Volute brace
        brace_pts = [
            (wx, my, mz + 0.04),
            (wx + sx * 0.09, my + y_dir * 0.05, mz + 0.06),
            (lx, ly, lz - 0.10),
        ]
        add_extruded_profile_along_path(bm_l_iron, bracket_prof, brace_pts, up_hint=Vector((0, 0, 1)))

        # Lower turned brass drop finial & hexagonal base cup (lz - 0.24 to lz - 0.10)
        drop_rz = [
            (0.003, 0.0),
            (0.016, 0.035),
            (0.010, 0.065),
            (0.028, 0.105),
            (0.068, 0.135),
            (0.076, 0.150),
        ]
        add_lathe_profile(bm_l_brass, drop_rz, center=(lx, ly, lz - 0.24), axis="Z", segments=6)

        # Tapered 6-sided Beveled Glass Lantern Cage (lz - 0.09 to lz + 0.12)
        add_cylinder(bm_l_glass, (lx, ly, lz + 0.015), radius=0.068, height=0.20, segments=6, axis="Z")
        # Internal brass oil burner & glowing flame core
        add_cylinder(bm_l_brass, (lx, ly, lz - 0.04), radius=0.028, height=0.06, segments=10, axis="Z")
        add_sphere(bm_l_brass, (lx, ly, lz + 0.015), radius=0.024, segments=10, rings=8)

        # 6 Wrought-Iron Corner Colonnettes & Gothic Arch Struts around the glass cage
        for k in range(6):
            ang = k * (math.pi / 3.0)
            cx0 = lx + math.cos(ang) * 0.068
            cy0 = ly + math.sin(ang) * 0.068
            cx1 = lx + math.cos(ang) * 0.082
            cy1 = ly + math.sin(ang) * 0.082
            strut_pts = [
                (cx0, cy0, lz - 0.09),
                (0.5 * (cx0 + cx1), 0.5 * (cy0 + cy1), lz + 0.015),
                (cx1, cy1, lz + 0.12),
            ]
            add_extruded_profile_along_path(
                bm_l_iron,
                [(-0.006, -0.006), (0.006, -0.006), (0.006, 0.006), (-0.006, 0.006)],
                strut_pts,
                up_hint=Vector((math.cos(ang), math.sin(ang), 0)),
            )

        # Tiered Hexagonal Gothic Canopy Hood & Brass Spire Finial (lz + 0.12 to lz + 0.34)
        hood_rz = [
            (0.092, 0.0),
            (0.086, 0.022),
            (0.052, 0.075),
            (0.062, 0.090),
            (0.032, 0.145),
            (0.016, 0.180),
            (0.024, 0.195),
            (0.003, 0.230),
        ]
        add_lathe_profile(bm_l_brass, hood_rz, center=(lx, ly, lz + 0.12), axis="Z", segments=6)

    finalize_bmesh(bm_l_iron, "Lantern_Iron", mats["iron"], smooth=True, uv_scale=1.8)
    finalize_bmesh(bm_l_brass, "Lantern_Brass", mats["brass"], smooth=True, uv_scale=1.8)
    finalize_bmesh(bm_l_glass, "Lantern_Glass", mats["dark_glass"], smooth=True, uv_scale=1.0)


def build_carriage_interior(mats):
    """
    Build a richly furnished 3D Gothic Victorian Reading Vardo interior inside the cabin
    (Y in [-1.25, +1.78], Z in [1.16, 2.85]) so opening the doors or switching to Inside View
    reveals authentic Victorian cabinetry, tufted velvet sleeping berth, cast-iron stove,
    writing bureau with books, exposed gothic ceiling ribs, and hanging brass lanterns.
    """
    bm_i_wood = bmesh.new()
    bm_i_slate = bmesh.new()
    bm_i_velvet = bmesh.new()
    bm_i_iron = bmesh.new()
    bm_i_brass = bmesh.new()

    # 1. Planked Interior Cabin Floor (Z = 1.165) & Bordered Velvet Runner Rug
    for i in range(14):
        px = -0.68 + (i + 0.5) * (1.36 / 14.0)
        add_box(bm_i_wood, (px, 0.26, 1.162), (0.092, 3.04, 0.022))
    # Central runner rug with brass corner trim
    add_box(bm_i_velvet, (0.0, 0.08, 1.176), (0.68, 2.15, 0.012))
    add_box(bm_i_brass, (0.0, 0.08, 1.178), (0.72, 2.19, 0.006))

    # 2. Interior Canted Wainscoting Ribs & Arched Clerestory Roof Bents
    rib_y_list = (-1.18, -0.82, -0.46, -0.14, 0.58, 0.92, 1.32, 1.72)
    rib_prof = [(-0.018, -0.020), (0.018, -0.020), (0.014, 0.020), (-0.014, 0.020)]
    for ry in rib_y_list:
        for sx in (-1, 1):
            stud_pts = [
                (sx * (wall_x_at_z(z) - 0.036), ry, z)
                for z in (1.18, 1.52, 1.88, 2.22, 2.52)
            ]
            add_extruded_profile_along_path(bm_i_slate, rib_prof, stud_pts, up_hint=Vector((-sx, 0, 0)))
        # Arched ceiling rib across the roof vault
        ceil_pts = []
        for k in range(15):
            t = (k / 14.0) * 2.0 - 1.0
            cx = t * 0.84
            cz = 2.54 + (1.0 - t * t) * 0.28
            ceil_pts.append((cx, ry, cz))
        add_extruded_profile_along_path(bm_i_slate, rib_prof, ceil_pts, up_hint=Vector((0, 0, -1)))
        add_sphere(bm_i_brass, (0.0, ry, 2.81), radius=0.022, segments=10, rings=8)

    # Interior horizontal dado rail along front and rear bays (skipping open doorway Y in [-0.14, 0.58])
    for sx in (-1, 1):
        for y_a, y_b in ((-1.24, -0.16), (0.60, 1.76)):
            ym = 0.5 * (y_a + y_b)
            add_box(bm_i_slate, (sx * (wall_x_at_z(1.68) - 0.038), ym, 1.68), (0.028, y_b - y_a, 0.045))

    # 3. Rear Master Tufted Velvet Divan / Sleeping Berth & Gothic Alcove Screen (Y = +0.92 to +1.76)
    # Under-berth storage cabinet with recessed gothic panels and brass pulls
    add_box(bm_i_wood, (0.0, 1.35, 1.36), (1.38, 0.82, 0.38))
    add_box(bm_i_slate, (0.0, 0.93, 1.55), (1.42, 0.05, 0.045))
    for bx in (-0.42, 0.0, 0.42):
        add_box(bm_i_slate, (bx, 0.935, 1.36), (0.34, 0.03, 0.26))
        add_box(bm_i_wood, (bx, 0.928, 1.36), (0.28, 0.032, 0.20))
        add_sphere(bm_i_brass, (bx, 0.905, 1.36), radius=0.016, segments=10, rings=8)

    # Plush Tufted Velvet Mattress, Quilted Backrest & Bolster Pillows
    add_box(bm_i_velvet, (0.0, 1.36, 1.60), (1.42, 0.80, 0.11))
    for tx in (-0.52, -0.26, 0.0, 0.26, 0.52):
        for ty in (1.14, 1.36, 1.58):
            add_sphere(bm_i_brass, (tx, ty, 1.655), radius=0.010, segments=8, rings=6)
    # Tufted Rear Headboard / Backrest against rear wall (Y = 1.72, low enough so Rear Casement Windows look over it!)
    add_box(bm_i_velvet, (0.0, 1.71, 1.68), (1.44, 0.09, 0.22))
    add_box(bm_i_slate, (0.0, 1.71, 1.80), (1.48, 0.11, 0.04))
    # Side Cylindrical Velvet Bolster Cushions
    for sx in (-1, 1):
        add_cylinder(bm_i_velvet, (sx * 0.62, 1.36, 1.71), radius=0.075, height=0.72, segments=16, axis="Y")
        add_sphere(bm_i_brass, (sx * 0.62, 0.99, 1.71), radius=0.024, segments=10, rings=8)

    # Carved Gothic Alcove Screen Pillars framing the Sleeping Quarters at Y = +0.92
    for sx in (-1, 1):
        add_box(bm_i_slate, (sx * 0.64, 0.92, 1.85), (0.09, 0.09, 1.36))
        # Arched gothic spandrel bracket at top of screen pillar
        spandrel_pts = [
            (sx * 0.64, 0.92, 2.18),
            (sx * 0.48, 0.92, 2.38),
            (sx * 0.22, 0.92, 2.52),
        ]
        add_extruded_profile_along_path(bm_i_slate, rib_prof, spandrel_pts, up_hint=Vector((0, -1, 0)))

    # 4. Forward-Right Carved Writing Bureau, Bookcase & Reading Stool (X = +0.46, Y = -1.16 to -0.24)
    add_box(bm_i_wood, (0.50, -0.70, 1.48), (0.42, 0.88, 0.62))
    add_box(bm_i_slate, (0.48, -0.70, 1.80), (0.46, 0.92, 0.04))
    # Brass desktop gallery rail & leather blotter pad
    add_box(bm_i_velvet, (0.44, -0.70, 1.825), (0.32, 0.62, 0.015))
    add_box(bm_i_brass, (0.64, -0.70, 1.86), (0.018, 0.86, 0.04))
    # Upper Gothic Bookcase with 2 shelves & rows of 3D leather-bound books
    add_box(bm_i_wood, (0.58, -0.70, 2.14), (0.28, 0.84, 0.64))
    add_box(bm_i_slate, (0.56, -0.70, 2.08), (0.30, 0.86, 0.03))
    add_box(bm_i_slate, (0.56, -0.70, 2.28), (0.30, 0.86, 0.03))
    for shelf_z in (1.92, 2.17):
        for b_idx in range(9):
            by = -1.04 + b_idx * 0.082
            bh = 0.13 + 0.025 * ((b_idx * 3) % 3)
            bm_book = bm_i_velvet if b_idx % 2 == 0 else (bm_i_brass if b_idx % 3 == 0 else bm_i_wood)
            add_box(bm_book, (0.52, by, shelf_z + bh * 0.5), (0.18, 0.068, bh))
    # Upholstered Reading Stool in front of the desk
    add_box(bm_i_slate, (0.16, -0.70, 1.34), (0.28, 0.32, 0.34))
    add_box(bm_i_velvet, (0.16, -0.70, 1.53), (0.32, 0.36, 0.06))

    # 5. Forward-Left Victorian Cast-Iron Parlour Stove & Exterior Roof Chimney Crown (X = -0.48, Y = -0.68)
    # Slate fireproof hearth slab & brass fender rail
    add_box(bm_i_slate, (-0.48, -0.68, 1.19), (0.52, 0.56, 0.045))
    add_box(bm_i_brass, (-0.48, -0.68, 1.23), (0.54, 0.58, 0.03))
    # Octagonal Cast-Iron Stove Body, Arched Firebox Door & Brass Urn Crown
    add_cylinder(bm_i_iron, (-0.48, -0.68, 1.52), radius=0.17, height=0.58, segments=8, axis="Z")
    add_cylinder(bm_i_brass, (-0.48, -0.68, 1.82), radius=0.19, height=0.045, segments=8, axis="Z")
    add_box(bm_i_brass, (-0.31, -0.68, 1.48), (0.04, 0.16, 0.22))
    # Vertical Brass Chimney Flue Pipe rising through the roof up to Z = 3.16
    add_cylinder(bm_i_brass, (-0.48, -0.68, 2.42), radius=0.055, height=1.20, segments=14, axis="Z")
    add_cylinder(bm_i_iron, (-0.48, -0.68, 2.72), radius=0.095, height=0.06, segments=14, axis="Z")
    # Exterior Roof Chimney Gothic Smoke Crown & Conical Weather Cap (Z = 2.98 to 3.18)
    chimney_cap_rz = [
        (0.065, 0.0),
        (0.082, 0.03),
        (0.058, 0.08),
        (0.115, 0.11),
        (0.065, 0.16),
        (0.018, 0.20),
        (0.002, 0.23),
    ]
    add_lathe_profile(bm_i_brass, chimney_cap_rz, center=(-0.48, -0.68, 2.96), axis="Z", segments=8)

    # 6. Twin Hanging Brass Carriage Lanterns inside the Foyer (Y = +0.22, Z = 2.42)
    for sx in (-1, 1):
        lx, ly, lz = sx * 0.44, 0.22, 2.42
        add_cylinder(bm_i_iron, (lx, ly, 2.56), radius=0.012, height=0.22, segments=8, axis="Z")
        add_cylinder(bm_i_brass, (lx, ly, lz), radius=0.065, height=0.14, segments=8, axis="Z")
        add_sphere(bm_i_brass, (lx, ly, lz - 0.09), radius=0.035, segments=10, rings=8)

    finalize_bmesh(bm_i_wood, "Interior_Wood", mats["teal_wood"], bevel_width=0.002, bevel_segments=1, smooth=True, uv_scale=1.2)
    finalize_bmesh(bm_i_slate, "Interior_Slate", mats["slate_trim"], bevel_width=0.002, bevel_segments=1, smooth=True, uv_scale=1.3)
    finalize_bmesh(bm_i_velvet, "Interior_Velvet", mats["purple_wood"], bevel_width=0.002, bevel_segments=1, smooth=True, uv_scale=1.4)
    finalize_bmesh(bm_i_iron, "Interior_Iron", mats["iron"], smooth=True, uv_scale=1.6)
    finalize_bmesh(bm_i_brass, "Interior_Brass", mats["brass"], smooth=True, uv_scale=1.6)


