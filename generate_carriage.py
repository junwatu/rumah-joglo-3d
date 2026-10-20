"""
Procedural 3D Compiler for the Rumah Joglo Jawa (RJ-001).
Builds:
1. Orthographic architectural elevation drawings & macro material swatches (`ui_renders/*.png`)
2. Complete binary glTF 2.0 3D model (`rumah_joglo.glb`) — uses `bpy` if installed, or a
   built-in zero-dependency pure-Python glTF 2.0 binary compiler so it builds cleanly on any machine.
"""

import os
import sys
import math
import json
import struct

WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
if WORKSPACE_DIR not in sys.path:
    sys.path.insert(0, WORKSPACE_DIR)


def build_joglo_glb_pure_python(glb_path):
    """
    Zero-dependency pure-Python binary glTF 2.0 (.glb) compiler for the Rumah Joglo (RJ-001).
    Generates indexed triangle meshes with normals and PBR materials.
    """
    meshes_spec = []

    def make_frustum_verts_tris(bx, bz, by, tx, tz, ty):
        # 8 corners of a box/frustum in glTF Y-up coordinates:
        # Bottom: (-bx, by, bz), (bx, by, bz), (bx, by, -bz), (-bx, by, -bz)
        # Top:    (-tx, ty, tz), (tx, ty, tz), (tx, ty, -tz), (-tx, ty, -tz)
        faces = [
            # Front (+Z)
            ((-bx, by,  bz), ( bx, by,  bz), ( tx, ty,  tz), (-tx, ty,  tz)),
            # Rear (-Z)
            (( bx, by, -bz), (-bx, by, -bz), (-tx, ty, -tz), ( tx, ty, -tz)),
            # Left (-X)
            ((-bx, by, -bz), (-bx, by,  bz), (-tx, ty,  tz), (-tx, ty, -tz)),
            # Right (+X)
            (( bx, by,  bz), ( bx, by, -bz), ( tx, ty, -tz), ( tx, ty,  tz)),
            # Top (+Y)
            ((-tx, ty,  tz), ( tx, ty,  tz), ( tx, ty, -tz), (-tx, ty, -tz)),
            # Bottom (-Y)
            ((-bx, by, -bz), ( bx, by, -bz), ( bx, by,  bz), (-bx, by,  bz)),
        ]
        verts = []
        norms = []
        tris = []
        for p0, p1, p2, p3 in faces:
            ux, uy, uz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
            vx, vy, vz = p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]
            nx = uy * vz - uz * vy
            ny = uz * vx - ux * vz
            nz = ux * vy - uy * vx
            ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            n = (nx / ln, ny / ln, nz / ln)
            base = len(verts)
            verts.extend([p0, p1, p2, p3])
            norms.extend([n, n, n, n])
            tris.extend([(base, base + 1, base + 2), (base, base + 2, base + 3)])
        return verts, norms, tris

    def add_box_to_list(part_list, wx, wy, wz, cx, cy, cz):
        hx, hy, hz = wx * 0.5, wy * 0.5, wz * 0.5
        v, n, t = make_frustum_verts_tris(hx, hz, -hy, hx, hz, hy)
        v = [(px + cx, py + cy, pz + cz) for (px, py, pz) in v]
        part_list.append((v, n, t))

    def merge_parts(part_list):
        all_v, all_n, all_t = [], [], []
        for v, n, t in part_list:
            offset = len(all_v)
            all_v.extend(v)
            all_n.extend(n)
            all_t.extend([(a + offset, b + offset, c + offset) for (a, b, c) in t])
        return all_v, all_n, all_t

    # Materials: (name, baseColorFactor, metallic, roughness)
    materials = [
        ("KayuJatiKeraton",     [0.43, 0.28, 0.17, 1.0], 0.06, 0.54),  # 0
        ("GentengTerakota",     [0.62, 0.28, 0.18, 1.0], 0.08, 0.58),  # 1
        ("BatuAndesitUmpak",    [0.23, 0.24, 0.25, 1.0], 0.10, 0.68),  # 2
        ("PradaEmasKeraton",    [0.85, 0.65, 0.28, 1.0], 0.86, 0.30),  # 3
        ("SutraCindeKrobongan", [0.55, 0.18, 0.16, 1.0], 0.06, 0.62),  # 4
        ("KacaPatriJawa",       [1.00, 0.70, 0.28, 0.65], 0.10, 0.20), # 5
    ]

    # 1. Undak-Undakan Stone Plinth
    plinth_parts = []
    add_box_to_list(plinth_parts, 5.10, 0.16, 4.90, 0, 0.08, -0.05)
    add_box_to_list(plinth_parts, 4.76, 0.18, 4.56, 0, 0.25, -0.05)
    add_box_to_list(plinth_parts, 1.68, 0.11, 0.36, 0, 0.055, 2.54)
    add_box_to_list(plinth_parts, 1.52, 0.22, 0.28, 0, 0.11, 2.34)
    meshes_spec.append(("Undercarriage_StonePlinth", 2, (0, 0, 0), merge_parts(plinth_parts)))

    # 2. Kraton Floor & Senthong Platform
    floor_parts = []
    add_box_to_list(floor_parts, 4.56, 0.025, 4.36, 0, 0.345, -0.05)
    add_box_to_list(floor_parts, 4.28, 0.08, 1.32, 0, 0.38, -1.36)
    meshes_spec.append(("Interior_Velvet", 4, (0, 0, 0), merge_parts(floor_parts)))

    # 3. 4 Master Umpak Soko Guru
    for key, sx, sz in [("FL", -0.82, 0.68), ("FR", 0.82, 0.68), ("RL", -0.82, -0.68), ("RR", 0.82, -0.68)]:
        u_parts = []
        add_box_to_list(u_parts, 0.42, 0.09, 0.42, 0, -0.15, 0)
        add_box_to_list(u_parts, 0.30, 0.22, 0.30, 0, 0.0, 0)
        add_box_to_list(u_parts, 0.26, 0.06, 0.26, 0, 0.14, 0)
        meshes_spec.append((f"Wheel_{key}_Iron", 2, (sx, 0.54, sz), merge_parts(u_parts)))

        g_parts = []
        add_box_to_list(g_parts, 0.28, 0.032, 0.28, 0, 0.165, 0)
        meshes_spec.append((f"Wheel_{key}_Wood", 3, (sx, 0.54, sz), merge_parts(g_parts)))

    # 4. Soko Guru, Soko Pengarak & Tie Beams
    teak_parts = []
    for sx, sz in [(-0.82, 0.68), (0.82, 0.68), (-0.82, -0.68), (0.82, -0.68)]:
        add_box_to_list(teak_parts, 0.21, 1.58, 0.21, sx, 1.47, sz)
    for ox in (-2.12, -0.82, 0.82, 2.12):
        for oz in (-1.98, -0.68, 0.68, 1.92):
            if abs(ox) < 1.0 and abs(oz) < 1.0:
                continue
            add_box_to_list(teak_parts, 0.15, 1.24, 0.15, ox, 1.18, oz)
    add_box_to_list(teak_parts, 1.84, 0.12, 0.16, 0, 2.30, 0.68)
    add_box_to_list(teak_parts, 1.84, 0.12, 0.16, 0, 2.30, -0.68)
    add_box_to_list(teak_parts, 0.16, 0.12, 1.56, -0.82, 2.30, 0)
    add_box_to_list(teak_parts, 0.16, 0.12, 1.56, 0.82, 2.30, 0)
    meshes_spec.append(("Body_TealWood", 0, (0, 0, 0), merge_parts(teak_parts)))

    # 5. Stepped Tumpang Sari Ceiling
    ts_parts = []
    for tier in range(5):
        y = 2.40 + tier * 0.08
        span_x = 1.60 - tier * 0.22
        span_z = 1.32 - tier * 0.20
        add_box_to_list(ts_parts, span_x, 0.064, 0.085, 0, y, span_z * 0.5)
        add_box_to_list(ts_parts, span_x, 0.064, 0.085, 0, y, -span_z * 0.5)
        add_box_to_list(ts_parts, 0.085, 0.064, span_z, -span_x * 0.5, y, 0)
        add_box_to_list(ts_parts, 0.085, 0.064, span_z, span_x * 0.5, y, 0)
    add_box_to_list(ts_parts, 0.68, 0.075, 0.14, 0, 2.78, 0)
    meshes_spec.append(("Body_TumpangSari", 0, (0, 0, 0), merge_parts(ts_parts)))

    # 6. Gebyok Ukir Wall & Hinged Kori Agung Doors
    gebyok_parts = []
    add_box_to_list(gebyok_parts, 1.68, 1.46, 0.07, -1.28, 1.15, -0.68)
    add_box_to_list(gebyok_parts, 1.68, 1.46, 0.07,  1.28, 1.15, -0.68)
    add_box_to_list(gebyok_parts, 4.24, 1.46, 0.08,  0.00, 1.15, -1.98)
    meshes_spec.append(("Body_SlateTrim", 0, (0, 0, 0), merge_parts(gebyok_parts)))

    for side_tag, sx in [("L", -1), ("R", 1)]:
        d_parts = []
        add_box_to_list(d_parts, 0.41, 1.24, 0.055, -sx * 0.208, 0, 0)
        meshes_spec.append((f"Door_{side_tag}_Teal", 0, (sx * 0.42, 1.04, -0.68), merge_parts(d_parts)))

    # 7. Dual-Pitched Joglo Roof (Penanggap + Brunjung + Mustaka Crown)
    p_v, p_n, p_t = make_frustum_verts_tris(2.62, 2.42, 1.72, 1.08, 0.90, 2.52)
    meshes_spec.append(("Roof_SlateStructure", 1, (0, 0, 0), (p_v, p_n, p_t)))

    b_v, b_n, b_t = make_frustum_verts_tris(1.12, 0.94, 2.48, 0.44, 0.06, 3.56)
    meshes_spec.append(("Roof_Brunjung", 1, (0, 0, 0), (b_v, b_n, b_t)))

    m_parts = []
    add_box_to_list(m_parts, 1.02, 0.09, 0.12, 0, 3.58, 0)
    add_box_to_list(m_parts, 0.18, 0.46, 0.18, 0, 3.84, 0)
    meshes_spec.append(("Chimney_Brass", 3, (0, 0, 0), merge_parts(m_parts)))

    # 8. Lampu Robyong Chandelier
    l_parts = []
    add_box_to_list(l_parts, 0.16, 0.22, 0.16, 0, 2.16, 0.35)
    meshes_spec.append(("Lantern_Glass", 5, (0, 0, 0), merge_parts(l_parts)))

    # Pack into glTF 2.0 binary buffer
    bin_Writer = bytearray()
    buffer_views = []
    accessors = []
    gltf_meshes = []
    gltf_nodes = []

    for mesh_name, mat_idx, translation, (verts, norms, tris) in meshes_spec:
        # Positions
        pos_offset = len(bin_Writer)
        xs = [p[0] for p in verts]
        ys = [p[1] for p in verts]
        zs = [p[2] for p in verts]
        for vx, vy, vz in verts:
            bin_Writer.extend(struct.pack("<fff", vx, vy, vz))
        pos_len = len(bin_Writer) - pos_offset
        pos_bv = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": pos_offset, "byteLength": pos_len, "target": 34962})
        pos_acc = len(accessors)
        accessors.append({
            "bufferView": pos_bv,
            "componentType": 5126,
            "count": len(verts),
            "type": "VEC3",
            "min": [min(xs), min(ys), min(zs)],
            "max": [max(xs), max(ys), max(zs)],
        })

        # Normals
        norm_offset = len(bin_Writer)
        for nx, ny, nz in norms:
            bin_Writer.extend(struct.pack("<fff", nx, ny, nz))
        norm_len = len(bin_Writer) - norm_offset
        norm_bv = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": norm_offset, "byteLength": norm_len, "target": 34962})
        norm_acc = len(accessors)
        accessors.append({
            "bufferView": norm_bv,
            "componentType": 5126,
            "count": len(norms),
            "type": "VEC3",
        })

        # Indices
        idx_offset = len(bin_Writer)
        for i0, i1, i2 in tris:
            bin_Writer.extend(struct.pack("<HHH", i0, i1, i2))
        while len(bin_Writer) % 4 != 0:
            bin_Writer.append(0)
        idx_len = len(tris) * 6
        idx_bv = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": idx_offset, "byteLength": idx_len, "target": 34963})
        idx_acc = len(accessors)
        accessors.append({
            "bufferView": idx_bv,
            "componentType": 5123,
            "count": len(tris) * 3,
            "type": "SCALAR",
        })

        mesh_idx = len(gltf_meshes)
        gltf_meshes.append({
            "name": mesh_name,
            "primitives": [{
                "attributes": {"POSITION": pos_acc, "NORMAL": norm_acc},
                "indices": idx_acc,
                "material": mat_idx,
            }],
        })
        gltf_nodes.append({
            "name": mesh_name,
            "mesh": mesh_idx,
            "translation": list(translation),
        })

    gltf_json = {
        "asset": {"version": "2.0", "generator": "Keraton Nusantara Rumah Joglo Compiler"},
        "scene": 0,
        "scenes": [{"name": "RumahJogloScene", "nodes": list(range(len(gltf_nodes)))}],
        "nodes": gltf_nodes,
        "meshes": gltf_meshes,
        "materials": [
            {
                "name": m_name,
                "pbrMetallicRoughness": {
                    "baseColorFactor": m_col,
                    "metallicFactor": m_met,
                    "roughnessFactor": m_rough,
                },
                "doubleSided": True,
            }
            for (m_name, m_col, m_met, m_rough) in materials
        ],
        "buffers": [{"byteLength": len(bin_Writer)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }

    json_bytes = json.dumps(gltf_json, separators=(",", ":")).encode("utf-8")
    while len(json_bytes) % 4 != 0:
        json_bytes += b" "
    while len(bin_Writer) % 4 != 0:
        bin_Writer.append(0)

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_Writer)
    with open(glb_path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total_len))
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        f.write(struct.pack("<II", len(bin_Writer), 0x004E4942))
        f.write(bin_Writer)

    print(f"[SUCCESS] Compiled binary GLB to: {glb_path} ({os.path.getsize(glb_path) / 1024:.1f} KB)")


def main():
    from generate_ui_assets import main as generate_ui_main
    print("1. Generating Rumah Joglo orthographic elevation drawings & macro swatches...")
    generate_ui_main()

    glb_path = os.path.join(WORKSPACE_DIR, "rumah_joglo.glb")
    print("2. Compiling 3D Rumah Joglo binary GLB (`rumah_joglo.glb`)...")
    build_joglo_glb_pure_python(glb_path)


if __name__ == "__main__":
    main()
