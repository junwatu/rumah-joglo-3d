import * as THREE from 'three';

export const PATCH_LENGTH = 9.6;
export const BASE_DRIVE_SPEED = 0.85; // Ambient tropical breeze & lantern sway cadence

// Authentic Javanese Rumah Joglo Metric Baselines (MM)
export const BASE_WIDTH_MM = 9800;         // Pendopo & Eaves Width (9.80m)
export const BASE_HEIGHT_MM = 7600;        // Plinth to Mustaka Crown Apex (7.60m)
export const BASE_LENGTH_MM = 11400;       // Pendopo + Pringgitan + Dalem Depth (11.40m)
export const BASE_FRONT_WHEEL_MM = 320;    // Soko Guru Master Column Girth (320mm square)
export const BASE_REAR_WHEEL_MM = 520;     // Umpak Andesite Pedestal Height (520mm)

export const HERO_TARGET = new THREE.Vector3(0.0, 1.55, 0.05);

export const DEFAULT_CARRIAGE_CONFIG = {
  widthScale: 1.0,
  heightScale: 1.0,
  lengthScale: 1.0,
  roofCrownScale: 1.0,     // Brunjung Central Roof Steepness / Height
  rideHeightOffset: 0.0,   // Undak-Undakan Plinth Elevation Offset
  cabinScale: 1.0,         // Penanggap Eaves Overhang Span
  frontWheelScale: 1.0,    // Soko Guru Master Column Girth Scale
  rearWheelScale: 1.0,     // Umpak Stone Pedestal Height Scale
  wheelRimScale: 1.0,      // Tumpang Sari Stepped Beam Depth Scale
  wheelCamberDeg: 0.0,     // Roof Eaves Upturn / Flare Angle (deg)
  wheelStyle: 'spokes',    // 'spokes' (Padma Lotus Umpak) | 'tracery' (Gilded Santen Brackets) | 'disc' (Langkan Balustrade)
  driveSpeedMult: 1.0,     // Ambient Courtyard Breeze & Lantern Sway Speed
  activeWindows: { side: true, front: true, rear: true },
  activeDoors: { left: true, right: true },
  medallionsMode: 'skulls', // 'skulls' (Gunungan Kayon) | 'rosettes' (Kala Makara) | 'none' (Minimal)
  chimneyMode: 'standard',  // 'standard' (Mustaka Crown) | 'tall' (Tall Garuda Spire) | 'none' (Clean Ridge)
  lanternsMode: 'all',      // 'all' (Robyong + Corner + Garden) | 'front' (Robyong + Front) | 'none'
  timberLabel: 'Jati Keraton',
  wheelLabel: 'Umpak Padma'
};

export const carriageConfig = structuredClone(DEFAULT_CARRIAGE_CONFIG);

// 4 Architectural Callout 3D Anchors on the Rumah Joglo
export const baseCalloutAnchors3D = {
  '1': new THREE.Vector3( 0.00, 3.65,  0.15), // 1. Atap Brunjung & Mustaka Crown
  '2': new THREE.Vector3(-0.78, 2.08,  0.62), // 2. Soko Guru & Tumpang Sari Ceiling
  '3': new THREE.Vector3( 0.52, 1.38, -0.82), // 3. Gebyok Ukir & Kori Agung Doors
  '4': new THREE.Vector3( 1.85, 0.42,  1.45)  // 4. Umpak Batu & Undak-Undakan Plinth
};

export const calloutAnchors3D = {
  '1': baseCalloutAnchors3D['1'].clone(),
  '2': baseCalloutAnchors3D['2'].clone(),
  '3': baseCalloutAnchors3D['3'].clone(),
  '4': baseCalloutAnchors3D['4'].clone()
};

export const viewSpecMap = {
  iso: {
    dir: new THREE.Vector3(-5.10, 1.45, 5.20),
    target: new THREE.Vector3(0.0, 1.52, 0.0),
    reqW: 7.45,
    reqH: 5.75
  },
  side: {
    dir: new THREE.Vector3(-1.0, 0.06, 0.0),
    target: new THREE.Vector3(0.0, 1.58, -0.05),
    reqW: 7.70,
    reqH: 5.75
  },
  front: {
    dir: new THREE.Vector3(0.0, 0.06, 1.0),
    target: new THREE.Vector3(0.0, 1.58, 0.0),
    reqW: 6.80,
    reqH: 5.75
  },
  rear: {
    dir: new THREE.Vector3(0.0, 0.06, -1.0),
    target: new THREE.Vector3(0.0, 1.58, 0.0),
    reqW: 6.80,
    reqH: 5.75
  }
};

export const detailFocusSpecs = {
  timber: { dir: new THREE.Vector3(-2.6, 0.35, 2.8),   target: new THREE.Vector3(-0.78, 1.55, 0.62),  reqW: 3.8, reqH: 3.2 },
  iron:   { dir: new THREE.Vector3(-1.4, 0.25, 3.2),   target: new THREE.Vector3( 0.00, 1.38, -0.78), reqW: 3.6, reqH: 3.1 },
  glass:  { dir: new THREE.Vector3(-1.8, -0.55, 2.4),  target: new THREE.Vector3( 0.00, 2.25, 0.00),  reqW: 3.6, reqH: 3.0 },
  skull:  { dir: new THREE.Vector3(-3.0, 0.95, 2.8),   target: new THREE.Vector3( 0.00, 3.25, 0.00),  reqW: 4.4, reqH: 3.6 },
  '1':    { dir: new THREE.Vector3(-3.4, 1.10, 3.2),   target: new THREE.Vector3( 0.00, 3.10, 0.00),  reqW: 4.8, reqH: 4.0 },
  '2':    { dir: new THREE.Vector3(-2.2, 0.15, 2.8),   target: new THREE.Vector3(-0.35, 1.92, 0.35),  reqW: 3.9, reqH: 3.3 },
  '3':    { dir: new THREE.Vector3(-1.6, 0.22, 3.1),   target: new THREE.Vector3( 0.15, 1.35, -0.78), reqW: 3.8, reqH: 3.2 },
  '4':    { dir: new THREE.Vector3(-2.8, 0.45, 2.9),   target: new THREE.Vector3( 1.25, 0.55, 1.15),  reqW: 4.0, reqH: 3.4 }
};

export const finishDefinitions = {
  // 1. Kayu Jati (Teak Pillars, Beams & Gebyok Timber)
  timber: {
    default: { isOrig: true },
    ebony:   { color: 0x382820, rough: 0.52, metal: 0.06 }, // Sono Keling Dark Rosewood
    crimson: { color: 0x7c3324, rough: 0.56, metal: 0.05 }, // Politur Mahoni Merah
    emerald: { color: 0x4b5d46, rough: 0.64, metal: 0.04 }, // Jati Pesisir Patina
    ivory:   { color: 0xb88b58, rough: 0.58, metal: 0.04 }  // Jati Emas Muda (Honey Teak)
  },
  // 2. Genteng Atap (Brunjung & Penanggap Roof Tiles)
  wheels: {
    default:  { isOrig: true },
    ochre:    { color: 0xb57832, rough: 0.52, metal: 0.12 }, // Glazed Royal Ochre Tile
    oxblood:  { color: 0x7d2922, rough: 0.60, metal: 0.06 }, // Majapahit Deep Red Clay
    charcoal: { color: 0x333538, rough: 0.65, metal: 0.10 }, // Sirap Kayu Ulin (Dark Ironwood Shingles)
    teal:     { color: 0x3f6e66, rough: 0.58, metal: 0.14 }  // Patina Tembaga Hijau (Verdigris Tile)
  },
  // 3. Batu Umpak & Lantai (Plinth & Pedestal Stone)
  metal: {
    default:   { isOrig: true },
    brass:     { color: 0x9e886c, rough: 0.68, metal: 0.08 }, // Batu Paras Jogja (Warm Cream Sandstone)
    silver:    { color: 0x6c7378, rough: 0.58, metal: 0.12 }, // Batu Kali Abu (Grey River Andesite)
    verdigris: { color: 0x3b4d44, rough: 0.66, metal: 0.10 }  // Batu Candi Lumut (Mossy Temple Stone)
  },
  // 4. Prada & Ornamen Ukir (Gold Leaf, Mustaka Crown & Tumpang Sari Accents)
  skulls: {
    default:       { isOrig: true },
    gold_amber:    { color: 0xebc054, rough: 0.28, metal: 0.88 }, // Prada Emas Keraton (24K Royal Gold)
    obsidian_ruby: { color: 0x3d2e29, rough: 0.42, metal: 0.55 }, // Perunggu Kuno (Dark Majapahit Bronze)
    bronze_teal:   { color: 0xa87442, rough: 0.36, metal: 0.80 }  // Kuningan Sari (Burnished Javanese Brass)
  },
  // 5. Krobongan & Lantai Pendopo (Interior Sanctuary Silk/Batik & Pendopo Floor)
  upholstery: {
    default: { isOrig: true },
    oxblood: { color: 0x8a2026, rough: 0.68, metal: 0.06 }, // Sutra Cinde Merah (Royal Crimson Silk)
    tan:     { color: 0xa6743d, rough: 0.56, metal: 0.06 }, // Batik Sogan Kraton (Warm Sogan Brown)
    emerald: { color: 0x265942, rough: 0.68, metal: 0.05 }, // Hijau Gadung Mlathi (Sacred Pandan Green)
    ebony:   { color: 0x2a3346, rough: 0.66, metal: 0.06 }  // Batik Indigo Pesisir (Deep Indigo)
  },
  // 6. Kaca Patri & Lampu Robyong (Stained Glass & Pendopo Lantern Glow)
  glass_tint: {
    default:  { isOrig: true, lightColor: 0xffaa42, lightInt: 2.5 },
    amber:    { glassColor: 0xffb84d, glassEmit: 0xd46e18, opacity: 0.72, lightColor: 0xffa428, lightInt: 4.4 },
    ruby:     { glassColor: 0xc82838, glassEmit: 0x78101c, opacity: 0.72, lightColor: 0xff3b52, lightInt: 4.0 },
    spectral: { glassColor: 0x38c9a8, glassEmit: 0x146b56, opacity: 0.70, lightColor: 0x48f0cc, lightInt: 4.0 },
    crystal:  { glassColor: 0xe6f0f2, glassEmit: 0x283236, opacity: 0.24, lightColor: 0xfff2d6, lightInt: 3.1 }
  }
};

export const curatedThemes = {
  heritage: {
    finishes: { timber: 'default', wheels: 'default', metal: 'default', glass_tint: 'default', upholstery: 'default', skulls: 'default' },
    segs: { wheel_style: 'spokes', medallions: 'skulls', chimney: 'standard', lanterns_mode: 'all' },
    dims: { widthScale: 1.00, heightScale: 1.00, lengthScale: 1.00, roofCrownScale: 1.00, cabinScale: 1.00, rideHeightOffset: 0.00, frontWheelScale: 1.00, rearWheelScale: 1.00, wheelRimScale: 1.00, wheelCamberDeg: 0.0 }
  },
  midnight: {
    finishes: { timber: 'ebony', wheels: 'charcoal', metal: 'silver', glass_tint: 'amber', upholstery: 'oxblood', skulls: 'obsidian_ruby' },
    segs: { wheel_style: 'tracery', medallions: 'skulls', chimney: 'tall', lanterns_mode: 'all' },
    dims: { widthScale: 1.04, heightScale: 1.05, lengthScale: 1.04, roofCrownScale: 1.18, cabinScale: 1.06, rideHeightOffset: 0.04, frontWheelScale: 1.08, rearWheelScale: 1.10, wheelRimScale: 1.12, wheelCamberDeg: 2.5 }
  },
  imperial: {
    finishes: { timber: 'ivory', wheels: 'ochre', metal: 'brass', glass_tint: 'amber', upholstery: 'emerald', skulls: 'gold_amber' },
    segs: { wheel_style: 'disc', medallions: 'rosettes', chimney: 'tall', lanterns_mode: 'all' },
    dims: { widthScale: 1.06, heightScale: 1.04, lengthScale: 1.06, roofCrownScale: 1.14, cabinScale: 1.08, rideHeightOffset: 0.05, frontWheelScale: 1.06, rearWheelScale: 1.06, wheelRimScale: 1.15, wheelCamberDeg: 2.0 }
  },
  wraith: {
    finishes: { timber: 'emerald', wheels: 'teal', metal: 'verdigris', glass_tint: 'spectral', upholstery: 'ebony', skulls: 'bronze_teal' },
    segs: { wheel_style: 'tracery', medallions: 'rosettes', chimney: 'standard', lanterns_mode: 'front' },
    dims: { widthScale: 0.96, heightScale: 1.08, lengthScale: 1.02, roofCrownScale: 1.24, cabinScale: 1.05, rideHeightOffset: 0.06, frontWheelScale: 1.04, rearWheelScale: 1.12, wheelRimScale: 1.08, wheelCamberDeg: 3.5 }
  }
};

export function formatMetricMM(val) {
  const rounded = Math.round(val / 10) * 10;
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' MM';
}
