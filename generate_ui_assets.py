"""
Pure-Python Zero-Dependency Architectural Elevation & Swatch PNG Generator
for the Rumah Joglo Jawa (RJ-001).
Uses only Python standard library (`math`, `struct`, `zlib`, `os`) so it runs
instantly on any Python 3 installation without requiring PIL/bpy/numpy.

Generates in `./ui_renders/`:
- elev_side.png, elev_side_light.png
- elev_front.png, elev_front_light.png
- elev_rear.png, elev_rear_light.png
- elev_iso.png, elev_iso_light.png
- swatch_timber.png (Kayu Jati & Prada Gold)
- swatch_iron.png   (Ukiran Gebyok & Kori Agung)
- swatch_glass.png  (Tumpang Sari Stepped Ceiling)
- swatch_skull.png  (Genteng Terakota & Mustaka Crown)
"""

import os
import math
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui_renders")
os.makedirs(OUT_DIR, exist_ok=True)


def write_png_rgba(filepath, width, height, rgba_bytes):
    """Encode raw RGBA bytes (width * height * 4) into a standard PNG file."""
    def make_chunk(chunk_type, data):
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    raw_rows = bytearray()
    stride = width * 4
    for y in range(height):
        raw_rows.append(0)  # Filter type 0 (None)
        row_start = y * stride
        raw_rows.extend(rgba_bytes[row_start:row_start + stride])

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(bytes(raw_rows), level=6)

    with open(filepath, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(make_chunk(b"IHDR", ihdr))
        f.write(make_chunk(b"IDAT", compressed))
        f.write(make_chunk(b"IEND", b""))


class CanvasRGBA:
    """Lightweight anti-aliased 2D vector canvas for architectural pen-and-ink drawings."""

    def __init__(self, width, height, bg=(0, 0, 0, 0)):
        self.w = width
        self.h = height
        self.buf = bytearray(width * height * 4)
        if bg[3] > 0:
            r, g, b, a = bg
            for i in range(0, len(self.buf), 4):
                self.buf[i] = r
                self.buf[i + 1] = g
                self.buf[i + 2] = b
                self.buf[i + 3] = a

    def blend_pixel(self, x, y, r, g, b, a):
        if x < 0 or x >= self.w or y < 0 or y >= self.h or a <= 0:
            return
        idx = (y * self.w + x) * 4
        sa = a / 255.0
        da = self.buf[idx + 3] / 255.0
        out_a = sa + da * (1.0 - sa)
        if out_a <= 1e-5:
            return
        self.buf[idx] = int(min(255, (r * sa + self.buf[idx] * da * (1.0 - sa)) / out_a))
        self.buf[idx + 1] = int(min(255, (g * sa + self.buf[idx + 1] * da * (1.0 - sa)) / out_a))
        self.buf[idx + 2] = int(min(255, (b * sa + self.buf[idx + 2] * da * (1.0 - sa)) / out_a))
        self.buf[idx + 3] = int(min(255, out_a * 255.0))

    def fill_rect(self, x0, y0, x1, y1, color):
        r, g, b, a = color
        xa = max(0, int(min(x0, x1)))
        xb = min(self.w - 1, int(max(x0, x1)))
        ya = max(0, int(min(y0, y1)))
        yb = min(self.h - 1, int(max(y0, y1)))
        for y in range(ya, yb + 1):
            for x in range(xa, xb + 1):
                self.blend_pixel(x, y, r, g, b, a)

    def fill_polygon(self, pts, color):
        r, g, b, a = color
        ys = [p[1] for p in pts]
        y_min = max(0, int(min(ys)))
        y_max = min(self.h - 1, int(max(ys)))
        n = len(pts)
        for y in range(y_min, y_max + 1):
            yc = y + 0.5
            x_ints = []
            for i in range(n):
                x1, y1 = pts[i]
                x2, y2 = pts[(i + 1) % n]
                if (y1 <= yc < y2) or (y2 <= yc < y1):
                    t = (yc - y1) / (y2 - y1)
                    x_ints.append(x1 + t * (x2 - x1))
            x_ints.sort()
            for k in range(0, len(x_ints) - 1, 2):
                xa = max(0, int(math.ceil(x_ints[k])))
                xb = min(self.w - 1, int(math.floor(x_ints[k + 1])))
                for x in range(xa, xb + 1):
                    self.blend_pixel(x, y, r, g, b, a)

    def draw_line(self, x0, y0, x1, y1, color, thickness=1.5):
        r, g, b, a = color
        dist = math.hypot(x1 - x0, y1 - y0)
        steps = max(2, int(dist * 2.5))
        rad = thickness * 0.5
        ir = int(math.ceil(rad + 1))
        for s in range(steps + 1):
            t = s / steps
            cx = x0 + (x1 - x0) * t
            cy = y0 + (y1 - y0) * t
            ix = int(cx)
            iy = int(cy)
            for dy in range(-ir, ir + 1):
                for dx in range(-ir, ir + 1):
                    px = ix + dx
                    py = iy + dy
                    d = math.hypot((px + 0.5) - cx, (py + 0.5) - cy)
                    if d <= rad + 0.65:
                        cov = max(0.0, min(1.0, (rad + 0.65 - d) / 1.1))
                        self.blend_pixel(px, py, r, g, b, int(a * cov))

    def draw_polyline(self, pts, color, thickness=1.5, closed=False):
        n = len(pts)
        for i in range(n - 1):
            self.draw_line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], color, thickness)
        if closed and n > 2:
            self.draw_line(pts[-1][0], pts[-1][1], pts[0][0], pts[0][1], color, thickness)

    def draw_circle(self, cx, cy, radius, color, thickness=1.5, fill_color=None):
        pts = []
        segs = max(16, int(radius * 2.5))
        for i in range(segs):
            ang = 2.0 * math.pi * i / segs
            pts.append((cx + math.cos(ang) * radius, cy + math.sin(ang) * radius))
        if fill_color:
            self.fill_polygon(pts, fill_color)
        self.draw_polyline(pts, color, thickness, closed=True)

    def save(self, filepath):
        write_png_rgba(filepath, self.w, self.h, self.buf)


def draw_joglo_elevation(view_mode, is_light=False):
    """
    Render crisp orthographic architectural elevation drawings of the Rumah Joglo (RJ-001):
    - 'front': Front elevation showing Undak-Undakan stairs, 4 Soko Pengarak + 2 Soko Guru,
               Gebyok Kori Agung portal & Gunungan, Penanggap skirt roof, Brunjung roof & Mustaka crown.
    - 'side':  Side elevation showing Open Pendopo (right) + Enclosed Dalem Agung (left),
               4 column bays, Krepyak window, dual-pitched Joglo roof & Mustaka finial.
    - 'rear':  Rear elevation showing Dalem Agung sanctuary wall, ornate pilasters & Joglo roof.
    - 'iso':   3/4 Isometric architectural drawing of the Rumah Joglo pavilion.
    """
    w, h = (520, 340) if view_mode == "side" else (460, 340)
    c = CanvasRGBA(w, h)

    if is_light:
        ink = (242, 232, 214, 245)
        ink_mid = (242, 232, 214, 165)
        ink_faint = (242, 232, 214, 85)
        wash_roof = (242, 232, 214, 34)
        wash_wall = (242, 232, 214, 22)
        wash_dark = (242, 232, 214, 48)
    else:
        ink = (54, 44, 36, 240)
        ink_mid = (78, 66, 56, 175)
        ink_faint = (104, 90, 76, 95)
        wash_roof = (138, 82, 58, 42)
        wash_wall = (118, 94, 72, 30)
        wash_dark = (64, 52, 42, 55)

    cx = w * 0.5
    base_y = h - 26

    if view_mode in ("front", "rear", "side"):
        span = 195 if view_mode == "side" else 172
        plinth_y1 = base_y - 12
        plinth_y2 = base_y - 24
        eave_y = base_y - 128
        break_y = base_y - 182
        ridge_y = base_y - 264

        # 1. Undak-Undakan Stepped Stone Plinth
        c.fill_polygon([
            (cx - span, base_y), (cx + span, base_y),
            (cx + span, plinth_y1), (cx - span, plinth_y1)
        ], wash_dark)
        c.draw_polyline([
            (cx - span, base_y), (cx + span, base_y),
            (cx + span, plinth_y1), (cx - span, plinth_y1)
        ], ink, 1.8, closed=True)

        c.fill_polygon([
            (cx - span + 12, plinth_y1), (cx + span - 12, plinth_y1),
            (cx + span - 12, plinth_y2), (cx - span + 12, plinth_y2)
        ], wash_wall)
        c.draw_polyline([
            (cx - span + 12, plinth_y1), (cx + span - 12, plinth_y1),
            (cx + span - 12, plinth_y2), (cx - span + 12, plinth_y2)
        ], ink, 1.6, closed=True)

        if view_mode == "front":
            # Front entry stairs
            for step in range(3):
                sy0 = base_y - step * 8
                sy1 = sy0 - 8
                sw = 46 - step * 4
                c.draw_polyline([(cx - sw, sy0), (cx + sw, sy0), (cx + sw, sy1), (cx - sw, sy1)], ink, 1.3, closed=True)

        # 2. Inner Gebyok Sanctuary Wall & Doors / Windows
        wall_span = span - 32
        if view_mode == "front":
            c.fill_polygon([
                (cx - wall_span, plinth_y2), (cx + wall_span, plinth_y2),
                (cx + wall_span, eave_y), (cx - wall_span, eave_y)
            ], wash_wall)
            # Central Kori Agung Double Doors
            dw, dh = 32, 82
            c.fill_polygon([
                (cx - dw, plinth_y2), (cx + dw, plinth_y2),
                (cx + dw, plinth_y2 - dh), (cx - dw, plinth_y2 - dh)
            ], wash_dark)
            c.draw_polyline([
                (cx - dw, plinth_y2), (cx + dw, plinth_y2),
                (cx + dw, plinth_y2 - dh), (cx - dw, plinth_y2 - dh)
            ], ink, 1.7, closed=True)
            c.draw_line(cx, plinth_y2, cx, plinth_y2 - dh, ink, 1.5)
            # Carved Gunungan Kayon pediment above door
            c.fill_polygon([
                (cx - 22, plinth_y2 - dh - 4),
                (cx + 22, plinth_y2 - dh - 4),
                (cx, plinth_y2 - dh - 32)
            ], wash_dark)
            c.draw_polyline([
                (cx - 22, plinth_y2 - dh - 4),
                (cx + 22, plinth_y2 - dh - 4),
                (cx, plinth_y2 - dh - 32)
            ], ink, 1.4, closed=True)
            # Left & Right Gebyok Casement Windows
            for sx in (-1, 1):
                wx = cx + sx * 92
                wy = plinth_y2 - 52
                c.draw_polyline([
                    (wx - 24, wy + 22), (wx + 24, wy + 22),
                    (wx + 24, wy - 22), (wx - 24, wy - 22)
                ], ink, 1.4, closed=True)
                c.draw_line(wx, wy - 22, wx, wy + 22, ink_mid, 1.1)
                c.draw_line(wx - 24, wy, wx + 24, wy, ink_mid, 1.1)
            # Hanging Lampu Robyong Chandelier
            c.draw_line(cx, eave_y, cx, eave_y + 22, ink_mid, 1.2)
            c.draw_circle(cx, eave_y + 28, 7, ink, 1.3, fill_color=wash_roof)

        elif view_mode == "side":
            # Side shows Enclosed Dalem on Left (-X) and Open Pendopo on Right (+X)
            c.fill_polygon([
                (cx - wall_span, plinth_y2), (cx - 18, plinth_y2),
                (cx - 18, eave_y), (cx - wall_span, eave_y)
            ], wash_wall)
            c.draw_polyline([
                (cx - wall_span, plinth_y2), (cx - 18, plinth_y2),
                (cx - 18, eave_y), (cx - wall_span, eave_y)
            ], ink, 1.5, closed=True)
            # Side Dalem Krepyak Window
            wx = cx - 88
            wy = plinth_y2 - 52
            c.draw_polyline([
                (wx - 28, wy + 22), (wx + 28, wy + 22),
                (wx + 28, wy - 22), (wx - 28, wy - 22)
            ], ink, 1.4, closed=True)
            for l_i in range(-16, 20, 7):
                c.draw_line(wx - 26, wy + l_i, wx + 26, wy + l_i, ink_faint, 1.0)
            # Open Pendopo Chandelier on Right (+X)
            c.draw_line(cx + 42, eave_y, cx + 42, eave_y + 24, ink_mid, 1.2)
            c.draw_circle(cx + 42, eave_y + 30, 7, ink, 1.3, fill_color=wash_roof)

        elif view_mode == "rear":
            c.fill_polygon([
                (cx - wall_span, plinth_y2), (cx + wall_span, plinth_y2),
                (cx + wall_span, eave_y), (cx - wall_span, eave_y)
            ], wash_wall)
            c.draw_polyline([
                (cx - wall_span, plinth_y2), (cx + wall_span, plinth_y2),
                (cx + wall_span, eave_y), (cx - wall_span, eave_y)
            ], ink, 1.6, closed=True)
            for pan_x in (-96, -32, 32, 96):
                px = cx + pan_x
                c.draw_polyline([
                    (px - 22, plinth_y2 - 14), (px + 22, plinth_y2 - 14),
                    (px + 22, eave_y + 14), (px - 22, eave_y + 14)
                ], ink_mid, 1.2, closed=True)

        # 3. 4 Columns (Soko Pengarak outer + Soko Guru inner) & Umpak Stone Bases
        col_offsets = [-wall_span, -58, 58, wall_span]
        for col_x in col_offsets:
            px = cx + col_x
            is_guru = abs(col_x) < 80
            cw_half = 6 if is_guru else 4.5
            uh = 18 if is_guru else 14
            # Trapezoidal Umpak Base
            c.fill_polygon([
                (px - cw_half * 2.1, plinth_y2),
                (px + cw_half * 2.1, plinth_y2),
                (px + cw_half * 1.3, plinth_y2 - uh),
                (px - cw_half * 1.3, plinth_y2 - uh)
            ], wash_dark)
            c.draw_polyline([
                (px - cw_half * 2.1, plinth_y2),
                (px + cw_half * 2.1, plinth_y2),
                (px + cw_half * 1.3, plinth_y2 - uh),
                (px - cw_half * 1.3, plinth_y2 - uh)
            ], ink, 1.4, closed=True)
            # Teak Column Shaft
            c.fill_polygon([
                (px - cw_half, plinth_y2 - uh),
                (px + cw_half, plinth_y2 - uh),
                (px + cw_half, eave_y),
                (px - cw_half, eave_y)
            ], wash_wall)
            c.draw_polyline([
                (px - cw_half, plinth_y2 - uh),
                (px + cw_half, plinth_y2 - uh),
                (px + cw_half, eave_y),
                (px - cw_half, eave_y)
            ], ink, 1.5, closed=True)

        # 4. Lower Penanggap Skirt Roof
        eave_w = span + 14
        break_w = 82 if view_mode == "side" else 76
        penanggap_pts = [
            (cx - eave_w, eave_y),
            (cx + eave_w, eave_y),
            (cx + break_w, break_y),
            (cx - break_w, break_y)
        ]
        c.fill_polygon(penanggap_pts, wash_roof)
        # Roof tile rib lines on Penanggap
        for i in range(-10, 11):
            u = i / 10.0
            c.draw_line(cx + u * eave_w, eave_y, cx + u * break_w, break_y, ink_faint, 1.0)
        for r_step in (0.25, 0.50, 0.75):
            ry = eave_y + (break_y - eave_y) * r_step
            rw = eave_w + (break_w - eave_w) * r_step
            c.draw_line(cx - rw, ry, cx + rw, ry, ink_faint, 0.9)
        c.draw_polyline(penanggap_pts, ink, 1.9, closed=True)
        # Lisplang fascia double line
        c.draw_line(cx - eave_w, eave_y + 5, cx + eave_w, eave_y + 5, ink, 1.5)

        # 5. Upper Towering Steep Brunjung Trapezoidal Roof
        ridge_w = 18 if view_mode == "side" else 34
        brunjung_pts = [
            (cx - break_w - 4, break_y),
            (cx + break_w + 4, break_y),
            (cx + ridge_w, ridge_y),
            (cx - ridge_w, ridge_y)
        ]
        c.fill_polygon(brunjung_pts, wash_roof)
        for i in range(-6, 7):
            u = i / 6.0
            c.draw_line(cx + u * break_w, break_y, cx + u * ridge_w, ridge_y, ink_faint, 1.0)
        for r_step in (0.25, 0.50, 0.75):
            ry = break_y + (ridge_y - break_y) * r_step
            rw = break_w + (ridge_w - break_w) * r_step
            c.draw_line(cx - rw, ry, cx + rw, ry, ink_faint, 0.9)
        c.draw_polyline(brunjung_pts, ink, 2.0, closed=True)

        # 6. Wuwungan Ridge Beam, Sungut Horns & Central Royal Mustaka Finial
        c.draw_line(cx - ridge_w - 6, ridge_y - 3, cx + ridge_w + 6, ridge_y - 3, ink, 2.2)
        for sx in (-1, 1):
            hx = cx + sx * (ridge_w + 4)
            c.draw_polyline([(hx, ridge_y), (hx + sx * 8, ridge_y - 14), (hx + sx * 2, ridge_y - 4)], ink, 1.5, closed=True)
        # Central Mustaka Spire
        c.fill_polygon([
            (cx - 10, ridge_y), (cx + 10, ridge_y),
            (cx + 13, ridge_y - 12), (cx, ridge_y - 38), (cx - 13, ridge_y - 12)
        ], wash_dark)
        c.draw_polyline([
            (cx - 10, ridge_y), (cx + 10, ridge_y),
            (cx + 13, ridge_y - 12), (cx, ridge_y - 38), (cx - 13, ridge_y - 12)
        ], ink, 1.6, closed=True)

    else:
        # 3/4 Isometric View Thumbnail (`elev_iso`)
        def iso_pt(x, y, z):
            ix = cx + (x - z) * 0.86
            iy = base_y - 48 - y + (x + z) * 0.42
            return (ix, iy)

        # Plinth
        p_plinth = [iso_pt(-110, 0, 100), iso_pt(110, 0, 100), iso_pt(110, 0, -100), iso_pt(-110, 0, -100)]
        c.fill_polygon(p_plinth, wash_wall)
        c.draw_polyline(p_plinth, ink, 1.6, closed=True)

        # Front & Side Columns
        for x, z in [(-95, 85), (-32, 85), (32, 85), (95, 85), (95, 25), (95, -35), (95, -85), (-95, 25), (-95, -85)]:
            p0 = iso_pt(x, 0, z)
            p1 = iso_pt(x, 82, z)
            c.draw_line(p0[0], p0[1], p1[0], p1[1], ink, 1.8)

        # Penanggap Roof
        e_fl, e_fr, e_rr, e_rl = iso_pt(-122, 82, 110), iso_pt(122, 82, 110), iso_pt(122, 82, -110), iso_pt(-122, 82, -110)
        b_fl, b_fr, b_rr, b_rl = iso_pt(-54, 128, 48), iso_pt(54, 128, 48), iso_pt(54, 128, -48), iso_pt(-54, 128, -48)
        c.fill_polygon([e_fl, e_fr, b_fr, b_fl], wash_roof)
        c.fill_polygon([e_fr, e_rr, b_rr, b_fr], wash_roof)
        c.draw_polyline([e_fl, e_fr, b_fr, b_fl], ink, 1.8, closed=True)
        c.draw_polyline([e_fr, e_rr, b_rr, b_fr], ink, 1.8, closed=True)
        c.draw_polyline([e_fl, b_fl, b_rl, e_rl], ink_mid, 1.4, closed=True)

        # Brunjung Steep Roof
        r_l, r_r = iso_pt(-22, 195, 0), iso_pt(22, 195, 0)
        c.fill_polygon([b_fl, b_fr, r_r, r_l], wash_roof)
        c.fill_polygon([b_fr, b_rr, r_r], wash_dark)
        c.draw_polyline([b_fl, b_fr, r_r, r_l], ink, 2.0, closed=True)
        c.draw_polyline([b_fr, b_rr, r_r], ink, 2.0, closed=True)
        c.draw_line(b_rl[0], b_rl[1], r_l[0], r_l[1], ink_mid, 1.5)

        # Mustaka Crown
        m_base = iso_pt(0, 195, 0)
        m_top = iso_pt(0, 224, 0)
        c.draw_line(m_base[0], m_base[1], m_top[0], m_top[1], ink, 2.2)
        c.draw_circle(m_base[0], m_base[1] - 10, 5, ink, 1.5, fill_color=wash_dark)

    return c


def generate_macro_swatches():
    """Generate the 4 square 240x240 macro material & detail swatches."""
    size = 240

    # 1. swatch_timber.png: Kayu Jati Keraton & Prada Gold Collar
    c1 = CanvasRGBA(size, size, bg=(106, 68, 42, 255))
    for y in range(size):
        for x in range(size):
            wave = math.sin(x * 0.11 + math.sin(y * 0.04) * 3.5) * 0.5 + 0.5
            r = int(84 + wave * 48)
            g = int(50 + wave * 30)
            b = int(28 + wave * 16)
            c1.blend_pixel(x, y, r, g, b, 255)
    # Carved Soko Guru vertical fluting & gilded Prada band
    for x in (48, 96, 144, 192):
        c1.draw_line(x, 0, x, size, (48, 28, 15, 190), 2.5)
    c1.fill_rect(0, 92, size, 148, (198, 148, 56, 245))
    c1.draw_line(0, 92, size, 92, (245, 210, 120, 255), 2.5)
    c1.draw_line(0, 148, size, 148, (92, 62, 18, 255), 2.5)
    for k in range(18, size, 36):
        c1.draw_circle(k, 120, 11, (92, 62, 18, 230), 2.0, fill_color=(235, 190, 88, 255))
    c1.save(os.path.join(OUT_DIR, "swatch_timber.png"))

    # 2. swatch_iron.png: Ukiran Gebyok & Gunungan Relief
    c2 = CanvasRGBA(size, size, bg=(78, 48, 30, 255))
    c2.fill_rect(14, 14, size - 14, size - 14, (62, 38, 24, 255))
    c2.draw_polyline([(14, 14), (size - 14, 14), (size - 14, size - 14), (14, size - 14)], (196, 150, 64, 240), 2.5, closed=True)
    # Gunungan Kayon sacred tree motif in center
    gunungan = [(120, 28), (186, 156), (156, 206), (84, 206), (54, 156)]
    c2.fill_polygon(gunungan, (188, 140, 52, 235))
    c2.draw_polyline(gunungan, (242, 208, 116, 255), 2.2, closed=True)
    c2.draw_line(120, 36, 120, 202, (82, 52, 22, 230), 2.2)
    for branch_y, span_x in [(76, 24), (108, 42), (142, 52), (174, 38)]:
        c2.draw_circle(120 - span_x * 0.5, branch_y, 10, (92, 58, 24, 220), 1.8)
        c2.draw_circle(120 + span_x * 0.5, branch_y, 10, (92, 58, 24, 220), 1.8)
    c2.save(os.path.join(OUT_DIR, "swatch_iron.png"))

    # 3. swatch_glass.png: Stepped Tumpang Sari Ceiling & Dada Peksi Lotus
    c3 = CanvasRGBA(size, size, bg=(52, 34, 22, 255))
    for tier in range(5):
        inset = 16 + tier * 20
        col = (94 + tier * 14, 60 + tier * 9, 36 + tier * 5, 255)
        c3.fill_rect(inset, inset, size - inset, size - inset, col)
        c3.draw_polyline([
            (inset, inset), (size - inset, inset),
            (size - inset, size - inset), (inset, size - inset)
        ], (212, 166, 74, 235), 2.0, closed=True)
    # Central Dada Peksi golden Padma rosette
    c3.draw_circle(120, 120, 22, (242, 206, 112, 255), 2.2, fill_color=(204, 152, 54, 255))
    c3.draw_circle(120, 120, 9, (92, 56, 18, 255), 1.8, fill_color=(248, 220, 136, 255))
    c3.save(os.path.join(OUT_DIR, "swatch_glass.png"))

    # 4. swatch_skull.png: Terracotta Genteng Tiles & Royal Mustaka Finial
    c4 = CanvasRGBA(size, size, bg=(226, 216, 198, 255))
    # Lower half terracotta roof slope
    c4.fill_polygon([(16, 224), (224, 224), (176, 132), (64, 132)], (152, 68, 46, 255))
    for rx in range(28, 220, 22):
        tx = 64 + (rx - 16) * (112.0 / 208.0)
        c4.draw_line(rx, 224, tx, 132, (88, 34, 22, 220), 2.2)
    c4.draw_polyline([(16, 224), (224, 224), (176, 132), (64, 132)], (58, 42, 34, 255), 2.2, closed=True)
    # Central Royal Mustaka Crown Finial rising from ridge
    c4.fill_rect(54, 122, 186, 136, (62, 64, 68, 255))
    mustaka_pts = [(96, 122), (144, 122), (154, 92), (132, 68), (120, 22), (108, 68), (86, 92)]
    c4.fill_polygon(mustaka_pts, (214, 166, 68, 255))
    c4.draw_polyline(mustaka_pts, (64, 46, 24, 255), 2.2, closed=True)
    c4.save(os.path.join(OUT_DIR, "swatch_skull.png"))


def main():
    for view in ("side", "front", "rear", "iso"):
        dark_canvas = draw_joglo_elevation(view, is_light=False)
        dark_path = os.path.join(OUT_DIR, f"elev_{view}.png")
        dark_canvas.save(dark_path)

        light_canvas = draw_joglo_elevation(view, is_light=True)
        light_path = os.path.join(OUT_DIR, f"elev_{view}_light.png")
        light_canvas.save(light_path)
        print(f"[GENERATED] {dark_path} & {light_path}")

    generate_macro_swatches()
    print("[SUCCESS] Generated all Rumah Joglo elevation drawings and material swatches in ./ui_renders/")


if __name__ == "__main__":
    main()
