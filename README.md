# Gothic Victorian Carriage (GVC-001) — Procedural 3D Generator & Three.js Configurator

A 100% code-generated 3D Gothic Victorian Carriage (`GVC-001`) built with a procedural Python (`bpy` + `bmesh`) geometry/texture pipeline and an interactive **Three.js** web configurator.

---

## Architecture

```text
├── index.html                  # Semantic HTML5 presentation sheet & configurator UI
├── css/
│   └── styles.css              # Victorian drafting & Bespoke Atelier stylesheet
├── js/
│   ├── main.js                 # Scene setup, lighting, UI controls, zero-allocation SVG callouts & render loop
│   ├── config.js               # Metric baselines, camera presets, material palettes & curated themes
│   ├── carriageModel.js        # Native binary GLB streaming, depth-offset hierarchy & procedural add-ons
│   ├── kinematics.js           # Real-time vertex morphing & multi-body suspension/clearance solver
│   └── environment.js          # Procedural feathered cobblestone road patch & 3D road stones
├── gothic_carriage.glb         # Compiled 3D carriage model with embedded PBR textures
├── ui_renders/                 # Orthographic elevation drawings & macro material swatches
├── generate_carriage.py        # Headless Python compiler entry point -> gothic_carriage.glb
├── carriage_body.py            # Procedural cabin hull, Gothic arches, doors, windows & lanterns
├── carriage_roof.py            # Procedural barrel-vault roof, iron cresting & finials
├── carriage_undercarriage.py   # Procedural 12-spoke wheels, leaf springs, chassis & fifth-wheel steer
├── carriage_materials.py       # Principled BSDF materials & bmesh geometry/UV utilities
└── procedural_textures.py      # Procedural PBR BaseColor, Normal, Roughness & Metallic map synthesizer
```

---

## Running the Web Configurator

Serve the directory with any static HTTP server:

```bash
python3 -m http.server 5174
```

Then open [http://localhost:5174](http://localhost:5174) in your browser.

---

## Regenerating the 3D Model (`gothic_carriage.glb`)

To rebuild the 3D carriage model and PBR textures from scratch using Python:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python generate_carriage.py
```
