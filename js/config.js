import * as THREE from 'three';

export const PATCH_LENGTH = 6.2;
export const BASE_DRIVE_SPEED = 1.25; // m/s smooth heritage cobblestone drive speed

export const BASE_WIDTH_MM = 2140;
export const BASE_HEIGHT_MM = 3200;
export const BASE_LENGTH_MM = 4860;
export const BASE_FRONT_WHEEL_MM = 1100;
export const BASE_REAR_WHEEL_MM = 1260;

export const HERO_TARGET = new THREE.Vector3(0.0, 1.45, -0.05);

export const DEFAULT_CARRIAGE_CONFIG = {
  widthScale: 1.0,
  heightScale: 1.0,
  lengthScale: 1.0,
  roofCrownScale: 1.0,
  rideHeightOffset: 0.0,
  cabinScale: 1.0,
  frontWheelScale: 1.0,
  rearWheelScale: 1.0,
  wheelRimScale: 1.0,
  wheelCamberDeg: 0.0,
  wheelStyle: 'spokes',      // 'spokes' | 'tracery' | 'disc'
  driveSpeedMult: 1.0,
  activeWindows: { side: true, front: true, rear: true },
  activeDoors: { left: true, right: true },
  medallionsMode: 'skulls',  // 'skulls' | 'rosettes' | 'none'
  chimneyMode: 'standard',   // 'standard' | 'tall' | 'none'
  lanternsMode: 'all',       // 'all' | 'front' | 'none'
  timberLabel: 'Heritage Teal',
  wheelLabel: '12-Spoke'
};

export const carriageConfig = structuredClone(DEFAULT_CARRIAGE_CONFIG);

export const baseCalloutAnchors3D = {
  '1': new THREE.Vector3(-0.08, 2.86,  1.56), // Ornate Roof & Finials
  '2': new THREE.Vector3(-0.78, 1.54,  1.72), // Front Porch Balustrade & Coach Lanterns
  '3': new THREE.Vector3(-0.90, 1.92, -0.52), // Gothic Casement Window & Skull Medallion
  '4': new THREE.Vector3(-0.98, 0.65, -1.42)  // 12-Spoke Wheel & Leaf-Spring Undercarriage
};

export const calloutAnchors3D = {
  '1': baseCalloutAnchors3D['1'].clone(),
  '2': baseCalloutAnchors3D['2'].clone(),
  '3': baseCalloutAnchors3D['3'].clone(),
  '4': baseCalloutAnchors3D['4'].clone()
};

export const viewSpecMap = {
  iso: {
    dir: new THREE.Vector3(-4.85, 0.72, 4.55),
    target: new THREE.Vector3(0.0, 1.45, -0.05),
    reqW: 6.75,
    reqH: 5.45
  },
  side: {
    dir: new THREE.Vector3(-1.0, 0.03, 0.0),
    target: new THREE.Vector3(0.0, 1.48, -0.08),
    reqW: 7.15,
    reqH: 5.45
  },
  front: {
    dir: new THREE.Vector3(0.0, 0.04, 1.0),
    target: new THREE.Vector3(0.0, 1.48, 0.0),
    reqW: 5.30,
    reqH: 5.45
  },
  rear: {
    dir: new THREE.Vector3(0.0, 0.04, -1.0),
    target: new THREE.Vector3(0.0, 1.48, 0.0),
    reqW: 5.30,
    reqH: 5.45
  }
};

export const detailFocusSpecs = {
  timber: { dir: new THREE.Vector3(-3.3, 0.45, 1.4),   target: new THREE.Vector3(-0.3, 1.60, 0.20),  reqW: 4.4, reqH: 3.8 },
  iron:   { dir: new THREE.Vector3(-3.1, 0.35, -0.15), target: new THREE.Vector3(-0.3, 1.72, -0.15), reqW: 4.2, reqH: 3.6 },
  glass:  { dir: new THREE.Vector3(-1.8, 0.40, 3.2),   target: new THREE.Vector3(0.0, 1.75, 0.65),   reqW: 4.2, reqH: 3.6 },
  skull:  { dir: new THREE.Vector3(-3.0, 0.30, -0.65), target: new THREE.Vector3(-0.4, 1.75, -0.65), reqW: 4.0, reqH: 3.5 },
  '1':    { dir: new THREE.Vector3(-3.6, 0.85, 3.2),   target: new THREE.Vector3(0.0, 2.05, 0.45),   reqW: 4.8, reqH: 4.0 },
  '2':    { dir: new THREE.Vector3(-2.6, 0.35, 3.6),   target: new THREE.Vector3(0.0, 1.55, 1.25),   reqW: 4.4, reqH: 3.8 },
  '3':    { dir: new THREE.Vector3(-3.0, 0.32, -0.45), target: new THREE.Vector3(-0.35, 1.74, -0.45), reqW: 4.2, reqH: 3.6 },
  '4':    { dir: new THREE.Vector3(-3.2, 0.15, -1.25), target: new THREE.Vector3(-0.4, 0.95, -0.95), reqW: 4.4, reqH: 3.8 }
};

export const finishDefinitions = {
  timber: {
    default: { isOrig: true },
    ebony:   { color: 0x2c3035, rough: 0.58, metal: 0.08 },
    crimson: { color: 0x7a2432, rough: 0.62, metal: 0.05 },
    emerald: { color: 0x315c45, rough: 0.65, metal: 0.05 },
    ivory:   { color: 0xd6c8b4, rough: 0.68, metal: 0.04 }
  },
  wheels: {
    default:  { isOrig: true },
    ochre:    { color: 0xbd893e, rough: 0.55, metal: 0.12 },
    oxblood:  { color: 0x802323, rough: 0.58, metal: 0.06 },
    charcoal: { color: 0x363335, rough: 0.62, metal: 0.08 },
    teal:     { color: 0x457c82, rough: 0.60, metal: 0.05 }
  },
  metal: {
    default:   { isOrig: true },
    brass:     { color: 0xd9a84e, rough: 0.34, metal: 0.86 },
    silver:    { color: 0xc2ccd4, rough: 0.32, metal: 0.88 },
    verdigris: { color: 0x528f7f, rough: 0.52, metal: 0.62 }
  },
  skulls: {
    default:       { isOrig: true },
    gold_amber:    { color: 0xe8b854, rough: 0.30, metal: 0.88 },
    obsidian_ruby: { color: 0x292528, rough: 0.36, metal: 0.45 },
    bronze_teal:   { color: 0x9c7848, rough: 0.40, metal: 0.78 }
  },
  upholstery: {
    default: { isOrig: true },
    oxblood: { color: 0x8a1c2b, rough: 0.78, metal: 0.04 },
    tan:     { color: 0xb0763e, rough: 0.54, metal: 0.06 },
    emerald: { color: 0x265e44, rough: 0.76, metal: 0.04 },
    ebony:   { color: 0x262428, rough: 0.72, metal: 0.06 }
  },
  glass_tint: {
    default:  { isOrig: true, lightColor: 0xffa845, lightInt: 2.2 },
    amber:    { glassColor: 0xffb347, glassEmit: 0xc86414, opacity: 0.68, lightColor: 0xffa024, lightInt: 4.5 },
    ruby:     { glassColor: 0xb81d38, glassEmit: 0x6e0b1c, opacity: 0.68, lightColor: 0xff2a4b, lightInt: 4.0 },
    spectral: { glassColor: 0x34d1bf, glassEmit: 0x126e63, opacity: 0.66, lightColor: 0x38f2dc, lightInt: 4.2 },
    crystal:  { glassColor: 0xdcebf0, glassEmit: 0x1a2428, opacity: 0.16, lightColor: 0xfff0d4, lightInt: 2.8 }
  }
};

export const curatedThemes = {
  heritage: {
    finishes: { timber: 'default', wheels: 'default', metal: 'default', glass_tint: 'default', upholstery: 'default', skulls: 'default' },
    segs: { wheel_style: 'spokes', medallions: 'skulls', chimney: 'standard', lanterns_mode: 'all' },
    dims: { widthScale: 1.00, heightScale: 1.00, lengthScale: 1.00, roofCrownScale: 1.00, cabinScale: 1.00, rideHeightOffset: 0.00, frontWheelScale: 1.00, rearWheelScale: 1.00, wheelRimScale: 1.00, wheelCamberDeg: 0.0 }
  },
  midnight: {
    finishes: { timber: 'ebony', wheels: 'charcoal', metal: 'silver', glass_tint: 'ruby', upholstery: 'oxblood', skulls: 'obsidian_ruby' },
    segs: { wheel_style: 'tracery', medallions: 'skulls', chimney: 'tall', lanterns_mode: 'all' },
    dims: { widthScale: 1.04, heightScale: 1.02, lengthScale: 1.06, roofCrownScale: 1.15, cabinScale: 1.06, rideHeightOffset: 0.03, frontWheelScale: 1.04, rearWheelScale: 1.06, wheelRimScale: 1.10, wheelCamberDeg: 2.0 }
  },
  imperial: {
    finishes: { timber: 'crimson', wheels: 'ochre', metal: 'brass', glass_tint: 'amber', upholstery: 'tan', skulls: 'gold_amber' },
    segs: { wheel_style: 'disc', medallions: 'rosettes', chimney: 'standard', lanterns_mode: 'all' },
    dims: { widthScale: 1.06, heightScale: 1.04, lengthScale: 1.08, roofCrownScale: 1.12, cabinScale: 1.08, rideHeightOffset: 0.04, frontWheelScale: 1.05, rearWheelScale: 1.08, wheelRimScale: 1.15, wheelCamberDeg: 1.5 }
  },
  wraith: {
    finishes: { timber: 'emerald', wheels: 'teal', metal: 'verdigris', glass_tint: 'spectral', upholstery: 'emerald', skulls: 'bronze_teal' },
    segs: { wheel_style: 'tracery', medallions: 'skulls', chimney: 'tall', lanterns_mode: 'front' },
    dims: { widthScale: 0.96, heightScale: 1.08, lengthScale: 1.02, roofCrownScale: 1.24, cabinScale: 1.05, rideHeightOffset: 0.05, frontWheelScale: 1.02, rearWheelScale: 1.08, wheelRimScale: 0.95, wheelCamberDeg: 3.0 }
  }
};

export function formatMetricMM(val) {
  const rounded = Math.round(val / 10) * 10;
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' MM';
}
