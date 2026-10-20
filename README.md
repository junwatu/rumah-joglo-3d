# Rumah Joglo Jawa (RJ-001) — Procedural 3D Architecture & Three.js Configurator

A 100% code-generated 3D **Rumah Joglo Jawa (`RJ-001`)** built with an instant browser-native **Three.js** procedural geometry & PBR texture synthesizer, plus an offline Python (`generate_carriage.py` & `generate_ui_assets.py`) generator.

---

## Architectural Ensemble (`RJ-001`)

1. **Undak-Undakan & Pelataran**: Two-stepped volcanic andesite stone plinth (*batur*), front *trap-trapan* entry stairs with *pipi tangga* cheek walls, and Kraton geometric floor tiles surrounded by a feathered *Batu Candi* courtyard.
2. **Umpak Batu & Soko Guru**: 4 monumental central *Soko Guru* teak columns + 12 outer *Soko Pengarak* perimeter columns seated on carved black andesite *Umpak* pedestals, linked by *Sunduk-Kili* and *Blandar-Pengeret* beams.
3. **Tumpang Sari & Dada Peksi**: 8-tier stepped corbeled pyramid ceiling (*5 inward tiers + 3 outward tiers*) culminating in the sacred *Dada Peksi* king-beam with a gilded lotus rosette and hanging *Lampu Robyong* chandelier.
4. **Gebyok Ukir Jawa & Dalem Agung**: Hand-carved teak partition wall featuring a *Gunungan Kayon* (or *Kala Makara*) pediment, hinged *Kori Agung* double doors, 5 articulated *Krepyak* & stained-glass windows, and the inner *Krobongan / Senthong Tengah* royal sanctuary.
5. **Atap Penanggap, Brunjung & Mustaka**: Dual-pitched Javanese roof with lower *Penanggap* hipped skirt roof, steep central *Brunjung* trapezoidal roof, *Sungut* ridge horns, and a central *Mustaka* royal crown finial.

---

## Running the Web Configurator

Serve the directory with any static HTTP server:

```bash
python3 -m http.server 5174
```

Then open [http://localhost:5174](http://localhost:5174) in your browser.
- Click **`⇩ .GLB`** in the top-left panel at any time to export and download your customized 3D Rumah Joglo as `rumah_joglo_rj001.glb`.
- Click **`Inspect Tumpang Sari Ceiling`** to ghost and lift the outer roof so you can inspect the stepped *Tumpang Sari* ceiling beams inside.

---

## Regenerating UI Elevations & Offline `.GLB`

To regenerate the orthographic elevation drawings (`ui_renders/elev_*.png`) and macro swatches (`ui_renders/swatch_*.png`) using pure Python (zero third-party dependencies required):

```bash
python3 generate_ui_assets.py
```

To also run the offline `bpy` generator:

```bash
python3 generate_carriage.py
```
