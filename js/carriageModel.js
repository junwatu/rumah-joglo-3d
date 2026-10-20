import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { finishDefinitions } from './config.js';

export const wheelRig = {
  FL: { side: -1, isFront: true,  meshes: [], basePos: new THREE.Vector3(-0.82, 0.34,  0.68), restPos: new THREE.Vector3(-0.82, 0.34,  0.68), baseRadius: 0.24, radius: 0.24, angle: 0, lift: 0 },
  FR: { side:  1, isFront: true,  meshes: [], basePos: new THREE.Vector3( 0.82, 0.34,  0.68), restPos: new THREE.Vector3( 0.82, 0.34,  0.68), baseRadius: 0.24, radius: 0.24, angle: 0, lift: 0 },
  RL: { side: -1, isFront: false, meshes: [], basePos: new THREE.Vector3(-0.82, 0.34, -0.68), restPos: new THREE.Vector3(-0.82, 0.34, -0.68), baseRadius: 0.24, radius: 0.24, angle: 0, lift: 0 },
  RR: { side:  1, isFront: false, meshes: [], basePos: new THREE.Vector3( 0.82, 0.34, -0.68), restPos: new THREE.Vector3( 0.82, 0.34, -0.68), baseRadius: 0.24, radius: 0.24, angle: 0, lift: 0 }
};

export const leftDoorMeshes = [];
export const rightDoorMeshes = [];
export const leftDoorWindowMeshes = [];
export const rightDoorWindowMeshes = [];
export const frontWindowMeshes = [];
export const rearLeftWindowMeshes = [];
export const rearRightWindowMeshes = [];
export const interactiveWindowMeshes = [];
export const interactiveDoorMeshes = [];

export const frontLanternMeshes = [];
export const rearLanternMeshes = [];
export const lanternGlassMeshes = [];
export const roofMeshes = [];
export const chimneyMeshes = [];
export const skullMeshes = [];
export const rosetteMeshes = [];
export const wheelTraceryMeshes = [];
export const wheelDiscMeshes = [];
export const sprungBodyMeshes = [];
export const undercarriageMeshes = [];
export const allCarriageMeshes = [];

export const customBuckets = {
  timber:     [], // Kayu Jati Columns, Beams, Tumpang Sari, Gebyok Walls & Doors
  wheels:     [], // Atap Genteng Terakota (Brunjung & Penanggap Roof Tiles)
  metal:      [], // Umpak Batu Hitam & Undak-Undakan Andesite Stone Plinth
  skulls:     [], // Prada Gold Leaf, Gunungan/Kala Carvings, Mustaka Crown & Brass Hardware
  glass:      [], // Kaca Patri Stained Glass Windows
  upholstery: []  // Krobongan Sanctuary Silk/Batik & Pendopo Floor Carpet/Tiles
};

export const lanternLightState = {
  baseColorHex: 0xffaa42,
  baseIntensity: 2.5
};

const desatCache = new WeakMap();

export function getDesaturatedTexture(origTex) {
  if (!origTex || !origTex.image) return null;
  if (desatCache.has(origTex)) return desatCache.get(origTex);

  const img = origTex.image;
  const w = img.width || 512;
  const h = img.height || 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  let sumLum = 0;
  const nPixels = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    sumLum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  const meanLum = Math.max(40, sumLum / nPixels);
  const scale = 205.0 / meanLum;

  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.min(255, Math.max(12, Math.round(lum * scale)));
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);

  const newTex = new THREE.CanvasTexture(c);
  newTex.wrapS = origTex.wrapS;
  newTex.wrapT = origTex.wrapT;
  newTex.flipY = origTex.flipY;
  newTex.colorSpace = origTex.colorSpace;
  newTex.anisotropy = 8;
  desatCache.set(origTex, newTex);
  return newTex;
}

function computeExplodeOffset(name, center) {
  if (name.startsWith('Chimney_')) return new THREE.Vector3(0, 1.85, 0);
  if (name.startsWith('Roof_Brunjung')) return new THREE.Vector3(0, 1.35, 0);
  if (name.startsWith('Roof_')) return new THREE.Vector3(0, 0.95, 0);
  if (name.startsWith('Body_Tumpang')) return new THREE.Vector3(0, 0.52, 0);
  if (name.startsWith('Window_Door_L_')) return new THREE.Vector3(-0.65, 0.12, 0.55);
  if (name.startsWith('Window_Door_R_')) return new THREE.Vector3(0.65, 0.12, 0.55);
  if (name.startsWith('Window_Front_')) return new THREE.Vector3(0, 0.35, 0.65);
  if (name.startsWith('Window_Rear_L_')) return new THREE.Vector3(-0.85, 0.15, -0.35);
  if (name.startsWith('Window_Rear_R_')) return new THREE.Vector3(0.85, 0.15, -0.35);
  if (name.startsWith('Door_L_')) return new THREE.Vector3(-0.45, 0.08, 0.55);
  if (name.startsWith('Door_R_')) return new THREE.Vector3(0.45, 0.08, 0.55);
  if (name.startsWith('Lantern_')) return new THREE.Vector3(0, 0.42, 0.25);
  if (name.startsWith('Wheel_FL_')) return new THREE.Vector3(-0.35, -0.16, 0.25);
  if (name.startsWith('Wheel_FR_')) return new THREE.Vector3(0.35, -0.16, 0.25);
  if (name.startsWith('Wheel_RL_')) return new THREE.Vector3(-0.35, -0.16, -0.25);
  if (name.startsWith('Wheel_RR_')) return new THREE.Vector3(0.35, -0.16, -0.25);
  if (name.startsWith('Undercarriage_')) return new THREE.Vector3(0, -0.42, 0);
  if (name.includes('Skull') || name.startsWith('Rosette_')) return new THREE.Vector3(0, 0.28, 0.52);
  if (name.startsWith('Interior_')) return new THREE.Vector3(0, 0.12, -0.55);
  if (name.startsWith('Body_')) return new THREE.Vector3(center.x * 0.18, 0.18, center.z * 0.18);
  return new THREE.Vector3(0, 0, 0);
}

// ============================================================================
// PROCEDURAL JAVANESE PBR TEXTURE SYNTHESIZER
// ============================================================================
function createProceduralJavaneseMaterials() {
  const size = 512;

  // 1. Kayu Jati Keraton (Warm Aged Javanese Teak Wood Grain + Carved Bump)
  const jatiCanvas = document.createElement('canvas');
  jatiCanvas.width = size;
  jatiCanvas.height = size;
  const jctx = jatiCanvas.getContext('2d');
  const jatiBump = document.createElement('canvas');
  jatiBump.width = size;
  jatiBump.height = size;
  const jbctx = jatiBump.getContext('2d');

  jctx.fillStyle = '#6e472b';
  jctx.fillRect(0, 0, size, size);
  jbctx.fillStyle = '#808080';
  jbctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x += 2) {
      const wave = Math.sin(x * 0.08 + Math.sin(y * 0.025) * 4.0) * 0.5 + 0.5;
      const fine = Math.sin(x * 0.45 + y * 0.05) * 0.5 + 0.5;
      const v = wave * 0.7 + fine * 0.3;
      const r = Math.round(88 + v * 46);
      const g = Math.round(54 + v * 32);
      const b = Math.round(32 + v * 18);
      jctx.fillStyle = `rgb(${r},${g},${b})`;
      jctx.fillRect(x, y, 2, 1);

      const bv = Math.round(105 + v * 50);
      jbctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      jbctx.fillRect(x, y, 2, 1);
    }
  }
  const jatiMap = new THREE.CanvasTexture(jatiCanvas);
  const jatiBumpMap = new THREE.CanvasTexture(jatiBump);
  jatiMap.wrapS = jatiMap.wrapT = THREE.RepeatWrapping;
  jatiBumpMap.wrapS = jatiBumpMap.wrapT = THREE.RepeatWrapping;
  jatiMap.colorSpace = THREE.SRGBColorSpace;

  // 2. Genteng Terakota Soka (Javanese Clay Roof Tiles Texture + Wave Bump)
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = size;
  tileCanvas.height = size;
  const tctx = tileCanvas.getContext('2d');
  const tileBump = document.createElement('canvas');
  tileBump.width = size;
  tileBump.height = size;
  const tbctx = tileBump.getContext('2d');

  const cols = 16;
  const rows = 16;
  const cw = size / cols;
  const rh = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * cw;
      const y0 = r * rh;
      const grad = tctx.createLinearGradient(x0, y0, x0 + cw, y0 + rh);
      grad.addColorStop(0.0, '#783422');
      grad.addColorStop(0.45, '#9e472f');
      grad.addColorStop(0.85, '#692a1a');
      grad.addColorStop(1.0, '#3d170e');
      tctx.fillStyle = grad;
      tctx.fillRect(x0, y0, cw, rh);

      const bgrad = tbctx.createLinearGradient(x0, y0, x0 + cw, y0 + rh);
      bgrad.addColorStop(0.0, '#555');
      bgrad.addColorStop(0.5, '#eee');
      bgrad.addColorStop(0.9, '#333');
      bgrad.addColorStop(1.0, '#111');
      tbctx.fillStyle = bgrad;
      tbctx.fillRect(x0, y0, cw, rh);
    }
  }
  const tileMap = new THREE.CanvasTexture(tileCanvas);
  const tileBumpMap = new THREE.CanvasTexture(tileBump);
  tileMap.wrapS = tileMap.wrapT = THREE.RepeatWrapping;
  tileBumpMap.wrapS = tileBumpMap.wrapT = THREE.RepeatWrapping;
  tileMap.repeat.set(4, 4);
  tileBumpMap.repeat.set(4, 4);
  tileMap.colorSpace = THREE.SRGBColorSpace;

  // 3. Batu Candi Andesit (Volcanic Stone Texture for Umpak & Plinth)
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = 256;
  stoneCanvas.height = 256;
  const sctx = stoneCanvas.getContext('2d');
  sctx.fillStyle = '#38393b';
  sctx.fillRect(0, 0, 256, 256);
  let sSeed = 73;
  const sRand = () => {
    sSeed = (sSeed * 16807) % 2147483647;
    return (sSeed - 1) / 2147483646;
  };
  for (let i = 0; i < 4000; i++) {
    const sx = Math.floor(sRand() * 256);
    const sy = Math.floor(sRand() * 256);
    const v = Math.floor(38 + sRand() * 44);
    sctx.fillStyle = `rgb(${v},${v + 1},${v + 2})`;
    sctx.fillRect(sx, sy, 3, 3);
  }
  const stoneMap = new THREE.CanvasTexture(stoneCanvas);
  stoneMap.wrapS = stoneMap.wrapT = THREE.RepeatWrapping;
  stoneMap.colorSpace = THREE.SRGBColorSpace;

  // 4. Lantai Tegel Kraton / Batik Cinde Floor & Sanctuary Tapestry
  const tegelCanvas = document.createElement('canvas');
  tegelCanvas.width = 256;
  tegelCanvas.height = 256;
  const tgCtx = tegelCanvas.getContext('2d');
  tgCtx.fillStyle = '#732929';
  tgCtx.fillRect(0, 0, 256, 256);
  const step = 64;
  for (let y = 0; y < 256; y += step) {
    for (let x = 0; x < 256; x += step) {
      tgCtx.strokeStyle = '#c89b52';
      tgCtx.lineWidth = 2;
      tgCtx.strokeRect(x + 3, y + 3, step - 6, step - 6);
      tgCtx.fillStyle = '#9c3b34';
      tgCtx.beginPath();
      tgCtx.arc(x + step * 0.5, y + step * 0.5, step * 0.24, 0, Math.PI * 2);
      tgCtx.fill();
      tgCtx.fillStyle = '#d9b066';
      tgCtx.beginPath();
      tgCtx.arc(x + step * 0.5, y + step * 0.5, step * 0.09, 0, Math.PI * 2);
      tgCtx.fill();
    }
  }
  const tegelMap = new THREE.CanvasTexture(tegelCanvas);
  tegelMap.wrapS = tegelMap.wrapT = THREE.RepeatWrapping;
  tegelMap.repeat.set(3, 3);
  tegelMap.colorSpace = THREE.SRGBColorSpace;

  const matTeak = new THREE.MeshStandardMaterial({
    name: 'KayuJatiKeraton',
    map: jatiMap,
    bumpMap: jatiBumpMap,
    bumpScale: 0.015,
    color: 0xffffff,
    roughness: 0.54,
    metalness: 0.06
  });

  const matDarkTeak = new THREE.MeshStandardMaterial({
    name: 'KayuJatiUkir',
    map: jatiMap,
    bumpMap: jatiBumpMap,
    bumpScale: 0.022,
    color: 0xd9bfa8,
    roughness: 0.48,
    metalness: 0.08
  });

  const matRoofTile = new THREE.MeshStandardMaterial({
    name: 'GentengTerakota',
    map: tileMap,
    bumpMap: tileBumpMap,
    bumpScale: 0.038,
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.08,
    side: THREE.DoubleSide
  });

  const matAndesite = new THREE.MeshStandardMaterial({
    name: 'BatuAndesitUmpak',
    map: stoneMap,
    bumpMap: stoneMap,
    bumpScale: 0.025,
    color: 0xffffff,
    roughness: 0.68,
    metalness: 0.10
  });

  const matPradaGold = new THREE.MeshStandardMaterial({
    name: 'PradaEmasKeraton',
    color: 0xd9a648,
    roughness: 0.30,
    metalness: 0.86
  });

  const matCindeSilk = new THREE.MeshStandardMaterial({
    name: 'SutraCindeKrobongan',
    map: tegelMap,
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0.06
  });

  const matStainedGlass = new THREE.MeshStandardMaterial({
    name: 'KacaPatriJawa',
    color: 0xffb347,
    emissive: 0x9e4b10,
    emissiveIntensity: 0.55,
    roughness: 0.20,
    metalness: 0.10,
    transparent: true,
    opacity: 0.52,
    depthWrite: false
  });

  const matLanternGlass = new THREE.MeshStandardMaterial({
    name: 'LampuRobyongGlass',
    color: 0xffcf70,
    emissive: 0xff9b28,
    emissiveIntensity: 0.85,
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.68,
    depthWrite: false
  });

  return {
    matTeak,
    matDarkTeak,
    matRoofTile,
    matAndesite,
    matPradaGold,
    matCindeSilk,
    matStainedGlass,
    matLanternGlass
  };
}

// ============================================================================
// GEOMETRY HELPERS FOR TRAPEZOIDAL JOGLO ROOFS & CARVED RELIEFS
// ============================================================================
function mergePartGeos(geos) {
  const normalized = geos.map((g) => {
    const ni = g.index ? g.toNonIndexed() : g;
    if (!ni.attributes.normal) ni.computeVertexNormals();
    return ni;
  });
  return mergeGeometries(normalized, false);
}

function makeBoxGeo(wx, wy, wz, tx, ty, tz) {
  const g = new THREE.BoxGeometry(wx, wy, wz);
  g.translate(tx, ty, tz);
  return g;
}

function makeCylinderGeo(rt, rb, h, segs, tx, ty, tz, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, segs);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(tx, ty, tz);
  return g;
}

/**
 * Builds a clean, watertight 4-sided hipped/trapezoidal Javanese roof shell
 * (used for both the lower Penanggap skirt roof and upper Brunjung steep roof)
 * with proper surface-normal thickness, eave fascia edges, and flush corner hip ridges (Jurai).
 */
function buildTrapezoidalRoofShell(bx, bz, by, tx, tz, ty, thickness = 0.055) {
  const geos = [];
  const halfT = thickness * 0.5;

  const addSlopeSlab = (p0, p1, p2, p3) => {
    // p0 = bottom-left, p1 = bottom-right, p2 = top-right, p3 = top-left (CCW outward)
    const v0 = new THREE.Vector3(...p0);
    const v1 = new THREE.Vector3(...p1);
    const v2 = new THREE.Vector3(...p2);
    const v3 = new THREE.Vector3(...p3);

    const edgeBottom = v1.clone().sub(v0);
    const edgeSide = v3.clone().sub(v0);
    const normal = new THREE.Vector3().crossVectors(edgeBottom, edgeSide).normalize();
    const offset = normal.clone().multiplyScalar(halfT);

    // Top outer vertices
    const t0 = v0.clone().add(offset);
    const t1 = v1.clone().add(offset);
    const t2 = v2.clone().add(offset);
    const t3 = v3.clone().add(offset);

    // Bottom inner vertices
    const b0 = v0.clone().sub(offset);
    const b1 = v1.clone().sub(offset);
    const b2 = v2.clone().sub(offset);
    const b3 = v3.clone().sub(offset);

    const botW = v0.distanceTo(v1);
    const topW = v3.distanceTo(v2);
    const slopeH = v0.clone().add(v1).multiplyScalar(0.5).distanceTo(v3.clone().add(v2).multiplyScalar(0.5));
    const uScale = Math.max(1.0, botW * 0.85);
    const uTopInset = ((botW - topW) * 0.5 / botW) * uScale;
    const vScale = Math.max(1.0, slopeH * 1.1);

    const posArr = new Float32Array([
      // Outer tiled slope face
      t0.x, t0.y, t0.z,  t1.x, t1.y, t1.z,  t2.x, t2.y, t2.z,
      t0.x, t0.y, t0.z,  t2.x, t2.y, t2.z,  t3.x, t3.y, t3.z,
      // Inner underside ceiling face
      b0.x, b0.y, b0.z,  b2.x, b2.y, b2.z,  b1.x, b1.y, b1.z,
      b0.x, b0.y, b0.z,  b3.x, b3.y, b3.z,  b2.x, b2.y, b2.z,
      // Lower eave edge cap (connecting t0-t1 to b0-b1)
      b0.x, b0.y, b0.z,  b1.x, b1.y, b1.z,  t1.x, t1.y, t1.z,
      b0.x, b0.y, b0.z,  t1.x, t1.y, t1.z,  t0.x, t0.y, t0.z
    ]);

    const uvArr = new Float32Array([
      0, 0,  uScale, 0,  uScale - uTopInset, vScale,
      0, 0,  uScale - uTopInset, vScale,  uTopInset, vScale,

      0, 0,  uScale - uTopInset, vScale,  uScale, 0,
      0, 0,  uTopInset, vScale,  uScale - uTopInset, vScale,

      0, 0,  uScale, 0,  uScale, 0.15,
      0, 0,  uScale, 0.15,  0, 0.15
    ]);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    g.computeVertexNormals();
    geos.push(g);
  };

  // Front slope (+Z)
  addSlopeSlab([-bx, by, bz], [bx, by, bz], [tx, ty, tz], [-tx, ty, tz]);
  // Rear slope (-Z)
  addSlopeSlab([bx, by, -bz], [-bx, by, -bz], [-tx, ty, -tz], [tx, ty, -tz]);
  // Left hip (-X)
  addSlopeSlab([-bx, by, -bz], [-bx, by, bz], [-tx, ty, tz], [-tx, ty, -tz]);
  // Right hip (+X)
  addSlopeSlab([bx, by, bz], [bx, by, -bz], [tx, ty, -tz], [tx, ty, tz]);

  // 4 Flush Corner Hip Ridge Spines (Wuwungan Jurai)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pA = new THREE.Vector3(sx * bx, by + halfT, sz * bz);
      const pB = new THREE.Vector3(sx * tx, ty + halfT, sz * tz);
      const mid = pA.clone().add(pB).multiplyScalar(0.5);
      const len = pA.distanceTo(pB);
      const spine = new THREE.CylinderGeometry(0.032, 0.038, len, 6);
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        pB.clone().sub(pA).normalize()
      );
      spine.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(quat));
      spine.translate(mid.x, mid.y, mid.z);
      geos.push(spine);
    }
  }

  return mergePartGeos(geos);
}

/**
 * Builds the complete procedural Rumah Joglo 3D Scene.
 */
export function buildProceduralJogloScene() {
  const root = new THREE.Group();
  root.name = 'RumahJoglo_RJ001';

  const mats = createProceduralJavaneseMaterials();

  const addNamedMesh = (geos, mat, name, pos = null) => {
    const merged = Array.isArray(geos) ? mergePartGeos(geos) : geos;
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = name;
    if (pos) mesh.position.copy(pos);
    root.add(mesh);
    return mesh;
  };

  // =========================================================================
  // 1. UNDAK-UNDAKAN STONE PLINTH, STAIRS & TEGEL FLOOR (`Undercarriage_*`)
  // =========================================================================
  const plinthGeos = [];
  // Lower stone step (Batur Bawah)
  plinthGeos.push(makeBoxGeo(5.10, 0.16, 4.90, 0, 0.08, -0.05));
  // Upper main Pendopo & Dalem plinth (Batur Atas)
  plinthGeos.push(makeBoxGeo(4.76, 0.18, 4.56, 0, 0.25, -0.05));
  // Perimeter carved stone moulding lip
  plinthGeos.push(makeBoxGeo(4.84, 0.04, 4.64, 0, 0.33, -0.05));

  // Front entry stairs (Trap-trapan Pendopo at +Z)
  plinthGeos.push(makeBoxGeo(1.68, 0.11, 0.36, 0, 0.055, 2.54));
  plinthGeos.push(makeBoxGeo(1.52, 0.22, 0.28, 0, 0.11, 2.34));
  // Carved stair cheek walls (Pipi Tangga & Makara Volutes)
  for (const sx of [-1, 1]) {
    plinthGeos.push(makeBoxGeo(0.14, 0.42, 0.62, sx * 0.88, 0.21, 2.46));
    plinthGeos.push(makeCylinderGeo(0.11, 0.11, 0.16, 16, sx * 0.88, 0.28, 2.74, 0, 0, Math.PI / 2));
  }

  // Outer 12 Soko Pengarak Umpak Stone Pedestals integrated on the plinth
  const outerX = [-2.12, -0.82, 0.82, 2.12];
  const outerZ = [-1.98, -0.68, 0.68, 1.92];
  for (const ox of outerX) {
    for (const oz of outerZ) {
      // Skip the 4 inner Soko Guru positions (handled as independent Wheel_* rigs)
      if (Math.abs(ox) < 1.0 && Math.abs(oz) < 1.0) continue;
      plinthGeos.push(makeBoxGeo(0.30, 0.10, 0.30, ox, 0.39, oz));
      plinthGeos.push(makeCylinderGeo(0.10, 0.15, 0.14, 8, ox, 0.49, oz, 0, Math.PI / 8, 0));
    }
  }

  addNamedMesh(plinthGeos, mats.matAndesite, 'Undercarriage_StonePlinth');

  // Kraton Geometric Floor Tiles (Pendopo + Elevated Dalem Agung Sanctuary)
  const floorGeos = [];
  floorGeos.push(makeBoxGeo(4.56, 0.025, 4.36, 0, 0.345, -0.05));
  // Raised Dalem Agung sanctuary platform (Senthong floor step)
  floorGeos.push(makeBoxGeo(4.28, 0.08, 1.32, 0, 0.38, -1.36));
  addNamedMesh(floorGeos, mats.matCindeSilk, 'Interior_Velvet');

  // =========================================================================
  // 2. 4 MASTER UMPAK SOKO GURU PEDESTALS (`Wheel_FL/FR/RL/RR_*`)
  // =========================================================================
  const sokoGuruCoords = [
    { key: 'FL', x: -0.82, z:  0.68 },
    { key: 'FR', x:  0.82, z:  0.68 },
    { key: 'RL', x: -0.82, z: -0.68 },
    { key: 'RR', x:  0.82, z: -0.68 }
  ];

  for (const sg of sokoGuruCoords) {
    const umpakGeos = [];
    // Stepped square base
    umpakGeos.push(makeBoxGeo(0.42, 0.09, 0.42, 0, -0.19, 0));
    // Tapered octagonal Majapahit body
    umpakGeos.push(makeCylinderGeo(0.15, 0.22, 0.22, 8, 0, -0.04, 0, 0, Math.PI / 8, 0));
    // Padma lotus collar ring
    umpakGeos.push(makeCylinderGeo(0.17, 0.14, 0.06, 16, 0, 0.10, 0));
    // Upper column seat
    umpakGeos.push(makeBoxGeo(0.26, 0.05, 0.26, 0, 0.15, 0));

    addNamedMesh(
      umpakGeos,
      mats.matAndesite,
      `Wheel_${sg.key}_Iron`,
      new THREE.Vector3(sg.x, 0.54, sg.z)
    );

    // Gilded brass collar ring around each master Umpak
    const ringGeo = makeBoxGeo(0.28, 0.032, 0.28, 0, 0.165, 0);
    addNamedMesh(
      ringGeo,
      mats.matPradaGold,
      `Wheel_${sg.key}_Wood`,
      new THREE.Vector3(sg.x, 0.54, sg.z)
    );
  }

  // =========================================================================
  // 3. SOKO GURU (4 MASTER COLUMNS), SOKO PENGARAK (12 OUTER COLUMNS) & BEAMS
  // =========================================================================
  const teakFrameGeos = [];
  const pradaTrimGeos = [];

  // 4 Monumental Soko Guru Columns (y = 0.68 to 2.52)
  for (const sg of sokoGuruCoords) {
    teakFrameGeos.push(makeBoxGeo(0.21, 1.84, 0.21, sg.x, 1.60, sg.z));
    // Carved capital neck & base collars (Prada Gold)
    pradaTrimGeos.push(makeBoxGeo(0.24, 0.06, 0.24, sg.x, 0.74, sg.z));
    pradaTrimGeos.push(makeBoxGeo(0.25, 0.08, 0.25, sg.x, 2.36, sg.z));
    // Carved Santen corbel blocks below Blandar
    teakFrameGeos.push(makeBoxGeo(0.34, 0.10, 0.26, sg.x, 2.45, sg.z));
    teakFrameGeos.push(makeBoxGeo(0.26, 0.10, 0.34, sg.x, 2.45, sg.z));
  }

  // Sunduk & Kili (Lower stabilizing tie beams between the 4 Soko Guru at y = 2.16)
  teakFrameGeos.push(makeBoxGeo(1.88, 0.12, 0.14, 0, 2.16,  0.68));
  teakFrameGeos.push(makeBoxGeo(1.88, 0.12, 0.14, 0, 2.16, -0.68));
  teakFrameGeos.push(makeBoxGeo(0.14, 0.12, 1.60, -0.82, 2.16, 0));
  teakFrameGeos.push(makeBoxGeo(0.14, 0.12, 1.60,  0.82, 2.16, 0));

  // Blandar & Pengeret (Main upper ring beams atop Soko Guru at y = 2.54)
  teakFrameGeos.push(makeBoxGeo(1.96, 0.15, 0.18, 0, 2.54,  0.68));
  teakFrameGeos.push(makeBoxGeo(1.96, 0.15, 0.18, 0, 2.54, -0.68));
  teakFrameGeos.push(makeBoxGeo(0.18, 0.15, 1.68, -0.82, 2.54, 0));
  teakFrameGeos.push(makeBoxGeo(0.18, 0.15, 1.68,  0.82, 2.54, 0));

  // 12 Outer Soko Pengarak Columns (y = 0.56 to 1.88)
  for (const ox of outerX) {
    for (const oz of outerZ) {
      if (Math.abs(ox) < 1.0 && Math.abs(oz) < 1.0) continue;
      teakFrameGeos.push(makeBoxGeo(0.15, 1.32, 0.15, ox, 1.22, oz));
      pradaTrimGeos.push(makeBoxGeo(0.175, 0.05, 0.175, ox, 1.78, oz));
      // Decorative Bahu Danyang eave brackets on outer perimeter columns
      if (Math.abs(ox) > 1.5 || Math.abs(oz) > 1.5) {
        const dirX = Math.abs(ox) > 1.5 ? Math.sign(ox) * 0.16 : 0;
        const dirZ = Math.abs(oz) > 1.5 ? Math.sign(oz) * 0.16 : 0;
        teakFrameGeos.push(makeBoxGeo(0.10 + Math.abs(dirX), 0.14, 0.10 + Math.abs(dirZ), ox + dirX * 0.5, 1.74, oz + dirZ * 0.5));
      }
    }
  }

  // Outer Perimeter Ring Beams (Blandar Penanggap at y = 1.88)
  teakFrameGeos.push(makeBoxGeo(4.48, 0.12, 0.14, 0, 1.88,  1.92));
  teakFrameGeos.push(makeBoxGeo(4.48, 0.12, 0.14, 0, 1.88, -1.98));
  teakFrameGeos.push(makeBoxGeo(0.14, 0.12, 4.08, -2.12, 1.88, -0.03));
  teakFrameGeos.push(makeBoxGeo(0.14, 0.12, 4.08,  2.12, 1.88, -0.03));
  // Intermediate tie beams connecting Soko Guru to Soko Pengarak
  teakFrameGeos.push(makeBoxGeo(4.44, 0.11, 0.12, 0, 1.88,  0.68));
  teakFrameGeos.push(makeBoxGeo(4.44, 0.11, 0.12, 0, 1.88, -0.68));
  teakFrameGeos.push(makeBoxGeo(0.12, 0.11, 4.04, -0.82, 1.88, -0.03));
  teakFrameGeos.push(makeBoxGeo(0.12, 0.11, 4.04,  0.82, 1.88, -0.03));

  addNamedMesh(teakFrameGeos, mats.matTeak, 'Body_TealWood');

  // =========================================================================
  // 4. TUMPANG SARI & DADA PEKSI (STEPPED CORBELED PYRAMID CEILING)
  // =========================================================================
  const tumpangGeos = [];
  // 5 Inward-stepping pyramid tiers (Tumpang Sari Dalam) + 3 Outward-stepping tiers (Tumpang Sari Luar)
  for (let tier = 0; tier < 5; tier++) {
    const y = 2.64 + tier * 0.075;
    const inset = tier * 0.12;
    const spanX = 1.72 - inset * 2.0;
    const spanZ = 1.44 - inset * 2.0;
    const bThick = 0.09;
    // Front & Rear tier beams
    tumpangGeos.push(makeBoxGeo(spanX + bThick, 0.068, bThick, 0, y,  spanZ * 0.5));
    tumpangGeos.push(makeBoxGeo(spanX + bThick, 0.068, bThick, 0, y, -spanZ * 0.5));
    // Left & Right tier beams
    tumpangGeos.push(makeBoxGeo(bThick, 0.068, spanZ + bThick, -spanX * 0.5, y, 0));
    tumpangGeos.push(makeBoxGeo(bThick, 0.068, spanZ + bThick,  spanX * 0.5, y, 0));
    // Gilded dentil frieze along inner edge of each tier
    pradaTrimGeos.push(makeBoxGeo(spanX - 0.04, 0.022, 0.022, 0, y - 0.025,  spanZ * 0.5 - 0.04));
    pradaTrimGeos.push(makeBoxGeo(spanX - 0.04, 0.022, 0.022, 0, y - 0.025, -spanZ * 0.5 + 0.04));
  }

  // Outward-stepping Tumpang Sari Luar (3 tiers supporting Brunjung eaves)
  for (let tier = 1; tier <= 3; tier++) {
    const y = 2.58 + tier * 0.065;
    const outset = tier * 0.11;
    const spanX = 1.72 + outset * 2.0;
    const spanZ = 1.44 + outset * 2.0;
    tumpangGeos.push(makeBoxGeo(spanX, 0.058, 0.08, 0, y,  spanZ * 0.5));
    tumpangGeos.push(makeBoxGeo(spanX, 0.058, 0.08, 0, y, -spanZ * 0.5));
    tumpangGeos.push(makeBoxGeo(0.08, 0.058, spanZ, -spanX * 0.5, y, 0));
    tumpangGeos.push(makeBoxGeo(0.08, 0.058, spanZ,  spanX * 0.5, y, 0));
  }

  // Sacred Central Dada Peksi King-Beam & Carved Lotus Rosette at (0, 2.94, 0)
  tumpangGeos.push(makeBoxGeo(0.92, 0.08, 0.14, 0, 2.94, 0));
  pradaTrimGeos.push(makeCylinderGeo(0.16, 0.12, 0.05, 16, 0, 2.90, 0));

  addNamedMesh(tumpangGeos, mats.matDarkTeak, 'Body_TumpangSari');

  // =========================================================================
  // 5. GEBYOK UKIR JAWA PARTITION WALL, DALEM ENCLOSURE & SANCTUARY
  // =========================================================================
  const gebyokGeos = [];
  const gebyokZ = -0.68;

  // Front Gebyok Partition Wall (spanning x = -2.12 to +2.12 at z = -0.68, y = 0.42 to 1.88)
  // Left & Right carved Tebeng panels flanking the central Kori Agung doorway (x = -0.44 to +0.44)
  gebyokGeos.push(makeBoxGeo(0.32, 1.46, 0.07, -0.60, 1.15, gebyokZ));
  gebyokGeos.push(makeBoxGeo(0.32, 1.46, 0.07,  0.60, 1.15, gebyokZ));
  // Outer wall bays below & above side casement windows (x = ±0.88 to ±2.06)
  for (const sx of [-1, 1]) {
    gebyokGeos.push(makeBoxGeo(1.18, 0.54, 0.07, sx * 1.47, 0.69, gebyokZ));
    gebyokGeos.push(makeBoxGeo(1.18, 0.30, 0.07, sx * 1.47, 1.73, gebyokZ));
    gebyokGeos.push(makeBoxGeo(0.24, 0.62, 0.08, sx * 0.96, 1.27, gebyokZ));
    gebyokGeos.push(makeBoxGeo(0.24, 0.62, 0.08, sx * 1.98, 1.27, gebyokZ));
  }
  // Ornate carved lintel beam above Kori Agung doorway
  gebyokGeos.push(makeBoxGeo(1.68, 0.24, 0.11, 0, 1.76, gebyokZ));
  pradaTrimGeos.push(makeBoxGeo(1.56, 0.08, 0.13, 0, 1.76, gebyokZ + 0.01));

  // Side & Rear Dalem Agung Enclosure Walls (from z = -0.68 to -1.98, x = ±2.12)
  // Rear wall (z = -1.98)
  gebyokGeos.push(makeBoxGeo(4.24, 1.46, 0.08, 0, 1.15, -1.98));
  // Left & Right Dalem side walls (with openings for Rear Left/Right Krepyak windows)
  for (const sx of [-1, 1]) {
    gebyokGeos.push(makeBoxGeo(0.08, 0.56, 1.30, sx * 2.12, 0.70, -1.33));
    gebyokGeos.push(makeBoxGeo(0.08, 0.30, 1.30, sx * 2.12, 1.73, -1.33));
    gebyokGeos.push(makeBoxGeo(0.08, 0.60, 0.32, sx * 2.12, 1.27, -0.84));
    gebyokGeos.push(makeBoxGeo(0.08, 0.60, 0.32, sx * 2.12, 1.27, -1.82));
  }

  addNamedMesh(gebyokGeos, mats.matDarkTeak, 'Body_SlateTrim');
  addNamedMesh(pradaTrimGeos, mats.matPradaGold, 'Body_Brass');

  // Gunungan / Kayon Sacred Tree-of-Life Carved Pediment Medallions (`Body_SkullBone`)
  const gununganGeos = [];
  // Central Gunungan above Kori Agung door
  gununganGeos.push(makeCylinderGeo(0.02, 0.24, 0.42, 6, 0, 2.12, gebyokZ + 0.05));
  // Left & Right Gebyok Wing Gunungan crests
  gununganGeos.push(makeCylinderGeo(0.015, 0.16, 0.28, 6, -1.47, 1.74, gebyokZ + 0.05));
  gununganGeos.push(makeCylinderGeo(0.015, 0.16, 0.28, 6,  1.47, 1.74, gebyokZ + 0.05));
  addNamedMesh(gununganGeos, mats.matPradaGold, 'Body_SkullBone');

  // Interior Krobongan / Senthong Tengah Royal Sanctuary Furniture (`Interior_Wood`)
  const intWoodGeos = [];
  // Four-poster carved Krobongan sanctuary canopy frame at (0, y, -1.48)
  for (const kx of [-0.62, 0.62]) {
    for (const kz of [-1.15, -1.78]) {
      intWoodGeos.push(makeBoxGeo(0.07, 1.15, 0.07, kx, 1.00, kz));
    }
  }
  intWoodGeos.push(makeBoxGeo(1.36, 0.12, 0.72, 0, 1.58, -1.46));
  // Pendopo Gambyong / Gamelan low teak tables
  intWoodGeos.push(makeBoxGeo(0.86, 0.26, 0.48,  0.00, 0.48, 0.68));
  intWoodGeos.push(makeBoxGeo(0.52, 0.24, 0.52, -1.45, 0.46, 0.68));
  intWoodGeos.push(makeBoxGeo(0.52, 0.24, 0.52,  1.45, 0.46, 0.68));
  addNamedMesh(intWoodGeos, mats.matTeak, 'Interior_Wood');

  // =========================================================================
  // 6. INTERACTIVE HINGED KORI AGUNG DOORS (`Door_L_*`, `Door_R_*`)
  // =========================================================================
  for (const sx of [-1, 1]) {
    const sideTag = sx < 0 ? 'L' : 'R';
    const hingePos = new THREE.Vector3(sx * 0.42, 1.04, gebyokZ);
    const doorWoodGeos = [];
    const doorGoldGeos = [];

    // Door leaf spans from hinge (x=0) inward to center (x = -sx * 0.415)
    const leafCenterLocalX = -sx * 0.208;
    doorWoodGeos.push(makeBoxGeo(0.41, 1.24, 0.055, leafCenterLocalX, 0, 0));
    // Raised carved frame rails & stiles
    doorWoodGeos.push(makeBoxGeo(0.35, 0.50, 0.075, leafCenterLocalX,  0.30, 0));
    doorWoodGeos.push(makeBoxGeo(0.35, 0.46, 0.075, leafCenterLocalX, -0.28, 0));

    // Gilded Lung-lungan relief & brass ring knocker
    doorGoldGeos.push(makeCylinderGeo(0.08, 0.08, 0.09, 12, leafCenterLocalX, 0.30, 0, Math.PI / 2, 0, 0));
    doorGoldGeos.push(makeBoxGeo(0.24, 0.26, 0.082, leafCenterLocalX, -0.28, 0));
    doorGoldGeos.push(makeCylinderGeo(0.035, 0.035, 0.095, 12, -sx * 0.35, 0.02, 0, Math.PI / 2, 0, 0));

    addNamedMesh(doorWoodGeos, mats.matTeak, `Door_${sideTag}_Teal`, hingePos);
    addNamedMesh(doorGoldGeos, mats.matPradaGold, `Door_${sideTag}_Skull`, hingePos);
  }

  // =========================================================================
  // 7. 5 INTERACTIVE HINGED KREPYAK & STAINED-GLASS WINDOWS (`Window_*`)
  // =========================================================================
  // A. Front Left & Right Gebyok Casement Windows (`Window_Door_L_*`, `Window_Door_R_*`)
  for (const sx of [-1, 1]) {
    const sideTag = sx < 0 ? 'L' : 'R';
    const winHinge = new THREE.Vector3(sx * 1.84, 1.27, gebyokZ + 0.02);
    const frameCenterLocalX = -sx * 0.37;
    const frameGeo = [
      makeBoxGeo(0.72, 0.58, 0.045, frameCenterLocalX, 0, 0),
      makeBoxGeo(0.035, 0.56, 0.055, frameCenterLocalX, 0, 0),
      makeBoxGeo(0.70, 0.035, 0.055, frameCenterLocalX, 0, 0)
    ];
    const glassGeo = makeBoxGeo(0.66, 0.52, 0.02, frameCenterLocalX, 0, 0);
    addNamedMesh(frameGeo, mats.matTeak, `Window_Door_${sideTag}_Slate`, winHinge);
    addNamedMesh(glassGeo, mats.matStainedGlass, `Window_Door_${sideTag}_Glass`, winHinge);
  }

  // B. Central Upper Transom Awning Window (`Window_Front_*`)
  {
    const frontWinHinge = new THREE.Vector3(0.0, 2.18, 0.68);
    const fFrame = [
      makeBoxGeo(1.36, 0.28, 0.045, 0, -0.14, 0),
      makeBoxGeo(0.04, 0.26, 0.055, -0.34, -0.14, 0),
      makeBoxGeo(0.04, 0.26, 0.055,  0.34, -0.14, 0)
    ];
    const fGlass = makeBoxGeo(1.28, 0.22, 0.02, 0, -0.14, 0);
    addNamedMesh(fFrame, mats.matTeak, 'Window_Front_Slate', frontWinHinge);
    addNamedMesh(fGlass, mats.matStainedGlass, 'Window_Front_Glass', frontWinHinge);
  }

  // C. Side Sanctuary Krepyak Windows (`Window_Rear_L_*`, `Window_Rear_R_*`)
  for (const sx of [-1, 1]) {
    const sideTag = sx < 0 ? 'L' : 'R';
    const rWinHinge = new THREE.Vector3(sx * 2.13, 1.27, -1.02);
    const rFrame = [
      makeBoxGeo(0.045, 0.56, 0.62, 0, 0, -0.31),
      makeBoxGeo(0.055, 0.035, 0.58, 0,  0.12, -0.31),
      makeBoxGeo(0.055, 0.035, 0.58, 0, -0.12, -0.31)
    ];
    const rGlass = makeBoxGeo(0.02, 0.50, 0.56, 0, 0, -0.31);
    addNamedMesh(rFrame, mats.matTeak, `Window_Rear_${sideTag}_Slate`, rWinHinge);
    addNamedMesh(rGlass, mats.matStainedGlass, `Window_Rear_${sideTag}_Glass`, rWinHinge);
  }

  // =========================================================================
  // 8. DUAL-PITCHED JOGLO ROOF: ATAP PENANGGAP & ATAP BRUNJUNG (`Roof_*`, `Chimney_*`)
  // =========================================================================
  // A. Lower Hipped Skirt Roof (Atap Penanggap: y = 1.76 to 2.52)
  const penanggapGeo = buildTrapezoidalRoofShell(2.58, 2.38, 1.76, 1.06, 0.88, 2.52, 0.055);
  addNamedMesh(penanggapGeo, mats.matRoofTile, 'Roof_SlateStructure');

  // Carved Eave Fascia Boards (Lisplang Ukir Jati) & Exposed Usuk Rafters
  const lisplangGeos = [];
  lisplangGeos.push(makeBoxGeo(5.20, 0.11, 0.04, 0, 1.73,  2.39));
  lisplangGeos.push(makeBoxGeo(5.20, 0.11, 0.04, 0, 1.73, -2.39));
  lisplangGeos.push(makeBoxGeo(0.04, 0.11, 4.78, -2.59, 1.73, 0));
  lisplangGeos.push(makeBoxGeo(0.04, 0.11, 4.78,  2.59, 1.73, 0));
  addNamedMesh(lisplangGeos, mats.matTeak, 'Roof_TealCeiling');

  // B. Upper Towering Steep Trapezoidal Roof (Atap Brunjung: y = 2.48 to 3.56)
  const brunjungGeo = buildTrapezoidalRoofShell(1.12, 0.94, 2.48, 0.44, 0.06, 3.56, 0.06);
  addNamedMesh(brunjungGeo, mats.matRoofTile, 'Roof_Brunjung');

  // C. Roof Ridge Crest (Wuwungan) & Royal Mustaka Crown Finial (`Chimney_*`)
  const mustakaIronGeos = [];
  const mustakaGoldGeos = [];
  // Ridge beam (Bubungan Molo at y = 3.58)
  mustakaIronGeos.push(makeBoxGeo(1.02, 0.09, 0.12, 0, 3.58, 0));
  // Upturned Javanese Garuda / Sungut ridge end horns
  for (const sx of [-1, 1]) {
    mustakaGoldGeos.push(makeCylinderGeo(0.015, 0.065, 0.28, 8, sx * 0.52, 3.70, 0, 0, 0, -sx * 0.35));
    mustakaGoldGeos.push(makeBoxGeo(0.11, 0.11, 0.14, sx * 0.46, 3.60, 0));
  }
  // Central Royal Mustaka / Mahkota Temple Finial at (0, 3.62..4.12, 0)
  mustakaIronGeos.push(makeBoxGeo(0.22, 0.08, 0.22, 0, 3.63, 0));
  mustakaGoldGeos.push(makeCylinderGeo(0.12, 0.07, 0.12, 8, 0, 3.72, 0));
  mustakaGoldGeos.push(makeCylinderGeo(0.05, 0.13, 0.14, 8, 0, 3.84, 0));
  mustakaGoldGeos.push(makeCylinderGeo(0.008, 0.055, 0.26, 8, 0, 4.02, 0));

  addNamedMesh(mustakaIronGeos, mats.matAndesite, 'Chimney_Iron');
  addNamedMesh(mustakaGoldGeos, mats.matPradaGold, 'Chimney_Brass');

  // =========================================================================
  // 9. PENDOPO CHANDELIER (LAMPU ROBYONG) & PAVILION LANTERNS (`Lantern_*`)
  // =========================================================================
  const lanternFrameGeos = [];
  const lanternGlassGeos = [];

  // Central Lampu Robyong Chandelier at (0, 2.22, +0.35) + 4 Corner Pendopo Lanterns
  const lanternLocations = [
    { x:  0.00, y: 2.18, z:  0.35, scale: 1.35 },
    { x: -1.55, y: 1.72, z:  1.45, scale: 0.90 },
    { x:  1.55, y: 1.72, z:  1.45, scale: 0.90 },
    { x: -1.55, y: 1.72, z: -1.45, scale: 0.90 },
    { x:  1.55, y: 1.72, z: -1.45, scale: 0.90 }
  ];

  for (const loc of lanternLocations) {
    const s = loc.scale;
    // Suspension chain rod
    lanternFrameGeos.push(makeCylinderGeo(0.012 * s, 0.012 * s, 0.32 * s, 8, loc.x, loc.y + 0.20 * s, loc.z));
    // Ornate Javanese brass crown & base finial
    lanternFrameGeos.push(makeCylinderGeo(0.03 * s, 0.14 * s, 0.07 * s, 8, loc.x, loc.y + 0.06 * s, loc.z));
    lanternFrameGeos.push(makeCylinderGeo(0.11 * s, 0.02 * s, 0.08 * s, 8, loc.x, loc.y - 0.12 * s, loc.z));
    // Glowing Amber Glass Globe
    lanternGlassGeos.push(makeCylinderGeo(0.10 * s, 0.08 * s, 0.15 * s, 12, loc.x, loc.y - 0.02 * s, loc.z));
  }

  addNamedMesh(lanternFrameGeos, mats.matPradaGold, 'Lantern_Brass');
  addNamedMesh(lanternGlassGeos, mats.matLanternGlass, 'Lantern_Glass');

  return root;
}

/**
 * Partitions a mesh's triangles into two meshes based on triangle centroid predicate(cx, cy, cz).
 */
function splitMeshByCentroid(mesh, predicate, newName) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  if (!pos) return null;

  const idxAttr = geo.index;
  const matchIndices = [];
  const keepIndices = [];
  const triCount = idxAttr ? idxAttr.count / 3 : pos.count / 3;

  for (let t = 0; t < triCount; t++) {
    const i0 = idxAttr ? idxAttr.getX(t * 3)     : t * 3;
    const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;
    const cx = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
    const cy = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3;
    const cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;
    if (predicate(cx, cy, cz)) {
      matchIndices.push(i0, i1, i2);
    } else {
      keepIndices.push(i0, i1, i2);
    }
  }

  if (matchIndices.length === 0 || keepIndices.length === 0) return null;

  const newGeo = geo.clone();
  newGeo.setIndex(matchIndices);
  newGeo.computeBoundingBox();

  geo.setIndex(keepIndices);
  geo.computeBoundingBox();

  const newMesh = new THREE.Mesh(newGeo, mesh.material);
  newMesh.name = newName;
  newMesh.castShadow = true;
  newMesh.receiveShadow = true;
  newMesh.position.copy(mesh.position);
  newMesh.rotation.copy(mesh.rotation);
  return newMesh;
}

/**
 * Builds procedural architectural add-on variants:
 * 1. Gilded Santen Column Collars (`wheelTraceryMeshes`) & Pendopo Langkan Balustrades (`wheelDiscMeshes`)
 * 2. Carved Kala Makara Medallions (`rosetteMeshes`) as alternative to Gunungan Kayon (`skullMeshes`)
 */
function buildProceduralCustomAddons(gltfScene, matRefs) {
  const stoneMat = matRefs.iron ? matRefs.iron.clone() : new THREE.MeshStandardMaterial({ color: 0x3b3d40, roughness: 0.65, metalness: 0.12 });
  const brassMat = matRefs.brass ? matRefs.brass.clone() : new THREE.MeshStandardMaterial({ color: 0xd9a648, roughness: 0.30, metalness: 0.86 });
  const teakMat = matRefs.teak ? matRefs.teak.clone() : new THREE.MeshStandardMaterial({ color: 0x6e472b, roughness: 0.54, metalness: 0.06 });

  const tempCenter = new THREE.Vector3();
  const registerAddonMesh = (mesh, bucketName) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.origMap = mesh.material.map || null;
    mesh.userData.origColor = mesh.material.color.clone();
    mesh.userData.origMetalness = mesh.material.metalness;
    mesh.userData.origRoughness = mesh.material.roughness;
    mesh.userData.basePosition = mesh.position.clone();
    mesh.userData.morphedBasePos = mesh.position.clone();
    mesh.userData.restPosition = mesh.position.clone();
    mesh.userData.restRotation = mesh.rotation.clone();
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.getCenter(tempCenter);
    mesh.userData.explodeVec = computeExplodeOffset(mesh.name, tempCenter);
    allCarriageMeshes.push(mesh);
    if (bucketName && customBuckets[bucketName]) {
      customBuckets[bucketName].push(mesh);
    }
    gltfScene.add(mesh);
  };

  // A. Build Gilded Umpak Padma Collars (`tracery`) & Pendopo Langkan Balustrade (`disc`) for the 4 Soko Guru Umpak rigs
  for (const key of ['FL', 'FR', 'RL', 'RR']) {
    const w = wheelRig[key];
    // 1. Gilded Majapahit Lotus Crown around Umpak (`tracery`)
    const lotusGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.12, 12);
    const traceryMesh = new THREE.Mesh(lotusGeo, brassMat);
    traceryMesh.name = `Wheel_${key}_TraceryBrass`;
    traceryMesh.position.copy(w.basePos);
    traceryMesh.visible = false;
    registerAddonMesh(traceryMesh, 'skulls');
    w.meshes.push(traceryMesh);
    wheelTraceryMeshes.push(traceryMesh);

    // 2. Royal Stepped Octagonal Pedestal Base (`disc`)
    const octGeo = new THREE.CylinderGeometry(0.26, 0.32, 0.18, 8);
    const discMesh = new THREE.Mesh(octGeo, stoneMat);
    discMesh.name = `Wheel_${key}_DiscStone`;
    discMesh.position.copy(w.basePos);
    discMesh.visible = false;
    registerAddonMesh(discMesh, 'metal');
    w.meshes.push(discMesh);
    wheelDiscMeshes.push(discMesh);
  }

  // Also add Perimeter Turned Teak Balustrade (Pagar Langkan Pendopo) when 'disc' (Royal Langkan) is active
  const langkanGeos = [];
  for (const sx of [-1, 1]) {
    // Front left & right railings flanking entry stairs
    langkanGeos.push(makeBoxGeo(1.18, 0.055, 0.065, sx * 1.50, 0.72, 1.92));
    langkanGeos.push(makeBoxGeo(1.18, 0.045, 0.055, sx * 1.50, 0.42, 1.92));
    for (let k = 0; k < 5; k++) {
      const bx = sx * (0.98 + k * 0.25);
      langkanGeos.push(makeCylinderGeo(0.024, 0.028, 0.30, 8, bx, 0.57, 1.92));
    }
    // Side railings along Pendopo
    langkanGeos.push(makeBoxGeo(0.065, 0.055, 2.52, sx * 2.12, 0.72, 0.62));
    langkanGeos.push(makeBoxGeo(0.055, 0.045, 2.52, sx * 2.12, 0.42, 0.62));
    for (let k = 0; k < 8; k++) {
      const bz = -0.52 + k * 0.32;
      langkanGeos.push(makeCylinderGeo(0.024, 0.028, 0.30, 8, sx * 2.12, 0.57, bz));
    }
  }
  const langkanMesh = new THREE.Mesh(mergePartGeos(langkanGeos), teakMat);
  langkanMesh.name = 'Body_LangkanBalustrade';
  langkanMesh.visible = false;
  registerAddonMesh(langkanMesh, 'timber');
  sprungBodyMeshes.push(langkanMesh);
  wheelDiscMeshes.push(langkanMesh);

  // B. Build Carved Kala Makara Royal Medallions (`rosetteMeshes`) as alternative to Gunungan Kayon
  const kalaGeos = [
    makeCylinderGeo(0.22, 0.24, 0.05, 16, 0, 2.08, -0.63, Math.PI / 2, 0, 0),
    makeCylinderGeo(0.14, 0.16, 0.05, 16, -1.47, 1.72, -0.63, Math.PI / 2, 0, 0),
    makeCylinderGeo(0.14, 0.16, 0.05, 16,  1.47, 1.72, -0.63, Math.PI / 2, 0, 0)
  ];
  const kalaMesh = new THREE.Mesh(mergePartGeos(kalaGeos), brassMat);
  kalaMesh.name = 'Rosette_Body_Kala';
  kalaMesh.visible = false;
  registerAddonMesh(kalaMesh, 'skulls');
  sprungBodyMeshes.push(kalaMesh);
  rosetteMeshes.push(kalaMesh);
}

let activeJogloRoot = null;

export function setupCarriageModel(gltfScene, turntableGroup, loadingBanner, onModelReady) {
  activeJogloRoot = gltfScene;

  // Clear arrays if reloading
  [
    leftDoorMeshes, rightDoorMeshes, leftDoorWindowMeshes, rightDoorWindowMeshes,
    frontWindowMeshes, rearLeftWindowMeshes, rearRightWindowMeshes,
    interactiveWindowMeshes, interactiveDoorMeshes, frontLanternMeshes,
    rearLanternMeshes, lanternGlassMeshes, roofMeshes, chimneyMeshes,
    skullMeshes, rosetteMeshes, wheelTraceryMeshes, wheelDiscMeshes,
    sprungBodyMeshes, undercarriageMeshes, allCarriageMeshes
  ].forEach((arr) => { arr.length = 0; });
  Object.values(customBuckets).forEach((arr) => { arr.length = 0; });
  Object.values(wheelRig).forEach((w) => { w.meshes.length = 0; });

  const rawMeshes = [];
  gltfScene.traverse((child) => {
    if (child.isMesh) rawMeshes.push(child);
  });

  // Split Front/Center vs. Rear Pendopo Lanterns
  for (const m of rawMeshes) {
    const name = m.name || '';
    if (name.startsWith('Lantern_')) {
      const rearM = splitMeshByCentroid(m, (_cx, _cy, cz) => cz < -0.5, `${name}_Rear`);
      if (rearM) gltfScene.add(rearM);
    }
  }

  const matRefs = {};
  const bbCenter = new THREE.Vector3();

  gltfScene.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;

    const name = child.name || '';
    child.geometry.computeBoundingBox();
    child.geometry.boundingBox.getCenter(bbCenter);

    if (name.startsWith('Wheel_')) {
      child.rotation.order = 'YZX';
      if (name.includes('Iron') && !matRefs.iron) matRefs.iron = child.material;
    }

    if (name.startsWith('Roof_')) {
      roofMeshes.push(child);
    }

    if (name.startsWith('Chimney_')) {
      chimneyMeshes.push(child);
    }

    if (name.startsWith('Door_L_') || name.startsWith('Door_R_')) {
      const sx = name.startsWith('Door_L_') ? -1 : 1;
      if (sx < 0) leftDoorMeshes.push(child);
      else rightDoorMeshes.push(child);
    }

    if (name.startsWith('Window_Door_L_') || name.startsWith('Window_Door_R_')) {
      const sx = name.startsWith('Window_Door_L_') ? -1 : 1;
      if (sx < 0) leftDoorWindowMeshes.push(child);
      else rightDoorWindowMeshes.push(child);
    }

    if (name.startsWith('Window_Front_')) {
      frontWindowMeshes.push(child);
    }

    if (name.startsWith('Window_Rear_L_') || name.startsWith('Window_Rear_R_')) {
      const sx = name.startsWith('Window_Rear_L_') ? -1 : 1;
      if (sx < 0) rearLeftWindowMeshes.push(child);
      else rearRightWindowMeshes.push(child);
    }

    if (name.startsWith('Lantern_')) {
      if (name.endsWith('_Rear')) rearLanternMeshes.push(child);
      else frontLanternMeshes.push(child);
    }

    if (name.includes('Skull')) {
      skullMeshes.push(child);
    }

    if (name.includes('TealWood') && !matRefs.teak) matRefs.teak = child.material;
    if (name.includes('Brass') && !matRefs.brass) matRefs.brass = child.material;
    if (name === 'Interior_Velvet') matRefs.velvet = child.material;

    child.userData.basePosition = child.position.clone();
    child.userData.morphedBasePos = child.position.clone();
    child.userData.restPosition = child.position.clone();
    child.userData.restRotation = child.rotation.clone();
    child.userData.explodeVec = computeExplodeOffset(name, bbCenter);

    if (child.material) {
      child.material = child.material.clone();
      if (name.startsWith('Lantern_Glass')) {
        lanternGlassMeshes.push(child);
      }
      child.userData.origMap = child.material.map;
      child.userData.origColor = child.material.color.clone();
      child.userData.origMetalness = child.material.metalness;
      child.userData.origRoughness = child.material.roughness;
      child.userData.origEmissive = child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000);
      child.userData.origOpacity = child.material.opacity;
    }

    allCarriageMeshes.push(child);

    // Assign to structural groups
    if (name.startsWith('Wheel_FL_')) wheelRig.FL.meshes.push(child);
    else if (name.startsWith('Wheel_FR_')) wheelRig.FR.meshes.push(child);
    else if (name.startsWith('Wheel_RL_')) wheelRig.RL.meshes.push(child);
    else if (name.startsWith('Wheel_RR_')) wheelRig.RR.meshes.push(child);
    else if (name.startsWith('Undercarriage_')) undercarriageMeshes.push(child);
    else if (
      name.startsWith('Body_') ||
      name.startsWith('Roof_') ||
      name.startsWith('Chimney_') ||
      name.startsWith('Door_') ||
      name.startsWith('Window_') ||
      name.startsWith('Lantern_') ||
      name.startsWith('Interior_')
    ) {
      sprungBodyMeshes.push(child);
    }

    // Assign to Javanese Customization Material Buckets
    if (
      name.includes('Teal') ||
      name.includes('Tumpang') ||
      name === 'Body_SlateTrim' ||
      name === 'Interior_Wood' ||
      (name.startsWith('Window_') && name.includes('Slate'))
    ) {
      customBuckets.timber.push(child);
    } else if (name === 'Roof_SlateStructure' || name === 'Roof_Brunjung') {
      customBuckets.wheels.push(child);
    } else if (name === 'Interior_Velvet') {
      customBuckets.upholstery.push(child);
    } else if (name.includes('StonePlinth') || (name.startsWith('Wheel_') && name.includes('Iron')) || name === 'Chimney_Iron') {
      customBuckets.metal.push(child);
    } else if (name.includes('Skull') || name.includes('Brass') || (name.startsWith('Wheel_') && name.includes('Wood'))) {
      customBuckets.skulls.push(child);
    } else if (name.includes('Glass') && !name.startsWith('Lantern_')) {
      customBuckets.glass.push(child);
    }
  });

  // Build Procedural Architectural Variants (Umpak Lotus Collars, Langkan Balustrades & Kala Makara)
  buildProceduralCustomAddons(gltfScene, matRefs);

  interactiveWindowMeshes.push(
    ...leftDoorWindowMeshes,
    ...rightDoorWindowMeshes,
    ...frontWindowMeshes,
    ...rearLeftWindowMeshes,
    ...rearRightWindowMeshes
  );
  interactiveDoorMeshes.push(
    ...leftDoorMeshes,
    ...rightDoorMeshes
  );

  // Cache original rest vertex positions for continuous real-time architectural morphing
  for (const m of [...sprungBodyMeshes, ...undercarriageMeshes]) {
    const posAttr = m.geometry?.attributes?.position;
    if (posAttr && !m.geometry.userData.origPos) {
      m.geometry.userData.origPos = new Float32Array(posAttr.array);
    }
    if (!m.userData.morphedBasePos) {
      m.userData.morphedBasePos = m.userData.basePosition.clone();
    }
  }

  turntableGroup.add(gltfScene);
  if (loadingBanner) loadingBanner.classList.add('hidden');
  if (onModelReady) onModelReady();
}

/**
 * Builds the procedural Rumah Joglo (`RJ-001`) immediately in the browser
 * (zero network latency, works on both HTTP and file://), with optional `.glb` override.
 */
export function loadCarriageGLB(turntableGroup, loadingBanner, onModelReady) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('glb') === '1') {
    const loader = new GLTFLoader();
    loader.load(
      './rumah_joglo.glb',
      (gltf) => setupCarriageModel(gltf.scene, turntableGroup, loadingBanner, onModelReady),
      undefined,
      () => {
        const jogloScene = buildProceduralJogloScene();
        setupCarriageModel(jogloScene, turntableGroup, loadingBanner, onModelReady);
      }
    );
    return;
  }

  const jogloScene = buildProceduralJogloScene();
  setupCarriageModel(jogloScene, turntableGroup, loadingBanner, onModelReady);
}

/**
 * Exports the current customized 3D Rumah Joglo scene as a binary `.glb` file download.
 */
export function exportJogloToGLB(filename = 'rumah_joglo_rj001.glb') {
  if (!activeJogloRoot) return;
  const exporter = new GLTFExporter();
  exporter.parse(
    activeJogloRoot,
    (result) => {
      if (result instanceof ArrayBuffer) {
        const blob = new Blob([result], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    },
    (err) => {
      console.error('GLB Export Error:', err);
    },
    { binary: true }
  );
}

export function applyCustomization(group, val, lights) {
  const def = finishDefinitions[group]?.[val];
  if (!def) return;

  if (group === 'glass_tint') {
    for (const gm of customBuckets.glass) {
      if (!gm.material) continue;
      if (def.isOrig) {
        gm.material.color.copy(gm.userData.origColor);
        gm.material.emissive.copy(gm.userData.origEmissive);
        gm.material.opacity = gm.userData.origOpacity;
      } else {
        gm.material.color.setHex(def.glassColor);
        gm.material.emissive.setHex(def.glassEmit);
        gm.material.emissiveIntensity = 0.85;
        gm.material.opacity = def.opacity;
      }
      gm.material.needsUpdate = true;
    }
    lanternLightState.baseColorHex = def.lightColor;
    lanternLightState.baseIntensity = def.lightInt;
    if (lights) {
      lights.interiorGlow.color.setHex(def.lightColor);
      lights.frontLanternGlow.color.setHex(def.lightColor);
      lights.rearLanternGlow.color.setHex(def.lightColor);
    }
    return;
  }

  const meshes = customBuckets[group] || [];
  for (const m of meshes) {
    if (!m.material) continue;
    if (def.isOrig) {
      m.material.map = m.userData.origMap;
      m.material.color.copy(m.userData.origColor);
      m.material.roughness = m.userData.origRoughness;
      m.material.metalness = m.userData.origMetalness;
    } else {
      const desat = getDesaturatedTexture(m.userData.origMap);
      if (desat) m.material.map = desat;
      m.material.color.setHex(def.color);
      m.material.roughness = def.rough;
      m.material.metalness = def.metal;
    }
    m.material.needsUpdate = true;
  }
}
