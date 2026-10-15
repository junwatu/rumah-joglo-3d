import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { finishDefinitions } from './config.js';

export const wheelRig = {
  FL: { side: -1, isFront: true,  meshes: [], basePos: new THREE.Vector3(-0.96, 0.55,  1.25), restPos: new THREE.Vector3(-0.96, 0.55,  1.25), baseRadius: 0.55, radius: 0.55, angle: 0, lift: 0 },
  FR: { side:  1, isFront: true,  meshes: [], basePos: new THREE.Vector3( 0.96, 0.55,  1.25), restPos: new THREE.Vector3( 0.96, 0.55,  1.25), baseRadius: 0.55, radius: 0.55, angle: 0, lift: 0 },
  RL: { side: -1, isFront: false, meshes: [], basePos: new THREE.Vector3(-1.00, 0.63, -1.42), restPos: new THREE.Vector3(-1.00, 0.63, -1.42), baseRadius: 0.63, radius: 0.63, angle: 0, lift: 0 },
  RR: { side:  1, isFront: false, meshes: [], basePos: new THREE.Vector3( 1.00, 0.63, -1.42), restPos: new THREE.Vector3( 1.00, 0.63, -1.42), baseRadius: 0.63, radius: 0.63, angle: 0, lift: 0 }
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
  timber:     [], // Body_TealWood, Door_*_Teal, Roof_TealCeiling, Interior_Wood
  wheels:     [], // Wheel_*_Wood, Undercarriage_PurpleWood, Royal Disc
  metal:      [], // *_Iron*, *_Slate*
  skulls:     [], // Body_SkullBone, Door_*_Skull, Rosette Medallions
  glass:      [], // Window_*_Glass
  upholstery: []  // Interior_Velvet
};

export const lanternLightState = {
  baseColorHex: 0xffa845,
  baseIntensity: 2.2
};

// WeakMap cache for desaturated luminance-preserving CanvasTextures
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

function computeExplodeOffset(name, center) {
  if (name.startsWith('Chimney_')) return new THREE.Vector3(0, 1.25, 0);
  if (name.startsWith('Roof_')) return new THREE.Vector3(0, 0.92, 0);
  if (name.startsWith('Window_Door_L_')) return new THREE.Vector3(-1.08, 0.20, 0);
  if (name.startsWith('Window_Door_R_')) return new THREE.Vector3(1.08, 0.20, 0);
  if (name.startsWith('Window_Front_')) return new THREE.Vector3(0, 0.28, 0.62);
  if (name.startsWith('Window_Rear_L_')) return new THREE.Vector3(-0.34, 0.24, -0.62);
  if (name.startsWith('Window_Rear_R_')) return new THREE.Vector3(0.34, 0.24, -0.62);
  if (name.startsWith('Door_L_') || name.startsWith('Rosette_Door_L')) return new THREE.Vector3(-0.78, 0.08, 0);
  if (name.startsWith('Door_R_') || name.startsWith('Rosette_Door_R')) return new THREE.Vector3(0.78, 0.08, 0);
  if (name.startsWith('Lantern_')) return new THREE.Vector3(0, 0.42, 0);
  if (name.startsWith('Wheel_FL_')) return new THREE.Vector3(-0.62, -0.18, 0.35);
  if (name.startsWith('Wheel_FR_')) return new THREE.Vector3(0.62, -0.18, 0.35);
  if (name.startsWith('Wheel_RL_')) return new THREE.Vector3(-0.62, -0.18, -0.35);
  if (name.startsWith('Wheel_RR_')) return new THREE.Vector3(0.62, -0.18, -0.35);
  if (name.startsWith('Undercarriage_')) return new THREE.Vector3(0, -0.42, 0);
  if (name.includes('Skull') || name.startsWith('Rosette_Body')) return new THREE.Vector3(center.x < 0 ? -0.45 : 0.45, 0.12, 0);
  if (name.startsWith('Body_')) return new THREE.Vector3(0, 0.22, 0);
  return new THREE.Vector3(0, 0, 0);
}

/**
 * Builds procedural add-on meshes:
 * 1. Wheel Gothic Tracery Rings & Royal Solid Coach Discs
 * 2. Turned Brass Tudor Rosette Medallions (alternative to Gothic Skulls)
 */
function buildProceduralCustomAddons(gltfScene, matRefs) {
  const ironMat = matRefs.iron ? matRefs.iron.clone() : new THREE.MeshStandardMaterial({ color: 0x35393e, roughness: 0.42, metalness: 0.82 });
  const brassMat = matRefs.brass ? matRefs.brass.clone() : new THREE.MeshStandardMaterial({ color: 0xc8963e, roughness: 0.32, metalness: 0.88 });
  const wheelWoodMat = matRefs.wheelWood ? matRefs.wheelWood.clone() : new THREE.MeshStandardMaterial({ color: 0x5c2c45, roughness: 0.58, metalness: 0.08 });

  [ironMat, brassMat].forEach((m) => {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -3;
    m.polygonOffsetUnits = -3;
  });
  wheelWoodMat.polygonOffset = true;
  wheelWoodMat.polygonOffsetFactor = -1;
  wheelWoodMat.polygonOffsetUnits = -1;

  const tempCenter = new THREE.Vector3();
  const registerAddonMesh = (mesh, bucketName) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.origMap = mesh.material.map || null;
    mesh.userData.origColor = mesh.material.color.clone();
    mesh.userData.origMetalness = mesh.material.metalness;
    mesh.userData.origRoughness = mesh.material.roughness;
    mesh.userData.basePosition = mesh.position.clone();
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

  // Cache wheel add-on geometries by radius so left/right wheels share GPU vertex buffers
  const wheelGeoCache = new Map();
  const getWheelAddonGeometries = (r) => {
    if (wheelGeoCache.has(r)) return wheelGeoCache.get(r);
    const ringGeo = new THREE.TorusGeometry(r * 0.64, 0.022, 10, 36);
    ringGeo.rotateY(Math.PI / 2);
    const cuspGeo = new THREE.TorusGeometry(r * 0.46, 0.016, 8, 12);
    cuspGeo.rotateY(Math.PI / 2);
    const discGeo = new THREE.CylinderGeometry(r * 0.84, r * 0.84, 0.036, 32);
    discGeo.rotateZ(Math.PI / 2);
    const crownRingGeo = new THREE.TorusGeometry(r * 0.72, 0.018, 10, 32);
    crownRingGeo.rotateY(Math.PI / 2);
    const geos = { ringGeo, cuspGeo, discGeo, crownRingGeo };
    wheelGeoCache.set(r, geos);
    return geos;
  };

  // A. Build Wheel Tracery Rings & Royal Solid Discs for each of the 4 wheels
  for (const key of ['FL', 'FR', 'RL', 'RR']) {
    const w = wheelRig[key];
    const { ringGeo, cuspGeo, discGeo, crownRingGeo } = getWheelAddonGeometries(w.baseRadius);

    // 1. Gothic Pierced Iron & Brass Tracery Ring around mid-spokes
    const traceryMesh = new THREE.Mesh(ringGeo, ironMat);
    traceryMesh.name = `Wheel_${key}_Tracery`;
    traceryMesh.position.copy(w.basePos);
    traceryMesh.rotation.order = 'YZX';
    traceryMesh.visible = false;
    registerAddonMesh(traceryMesh, 'metal');
    w.meshes.push(traceryMesh);
    wheelTraceryMeshes.push(traceryMesh);

    const cuspMesh = new THREE.Mesh(cuspGeo, brassMat);
    cuspMesh.name = `Wheel_${key}_TraceryBrass`;
    cuspMesh.position.copy(w.basePos);
    cuspMesh.rotation.order = 'YZX';
    cuspMesh.visible = false;
    registerAddonMesh(cuspMesh, 'skulls');
    w.meshes.push(cuspMesh);
    wheelTraceryMeshes.push(cuspMesh);

    // 2. Royal Solid Coach Wheel Disc with Brass Moulding Ring
    const discMesh = new THREE.Mesh(discGeo, wheelWoodMat);
    discMesh.name = `Wheel_${key}_DiscWood`;
    discMesh.position.copy(w.basePos);
    discMesh.rotation.order = 'YZX';
    discMesh.visible = false;
    registerAddonMesh(discMesh, 'wheels');
    w.meshes.push(discMesh);
    wheelDiscMeshes.push(discMesh);

    const crownRingMesh = new THREE.Mesh(crownRingGeo, brassMat);
    crownRingMesh.name = `Wheel_${key}_DiscBrass`;
    crownRingMesh.position.copy(w.basePos);
    crownRingMesh.rotation.order = 'YZX';
    crownRingMesh.visible = false;
    registerAddonMesh(crownRingMesh, 'skulls');
    w.meshes.push(crownRingMesh);
    wheelDiscMeshes.push(crownRingMesh);
  }

  // B. Build 4 Ornate Turned Brass Tudor Rosette Medallions (2 on Hinged Doors, 2 on Upper Cornices)
  const createRosetteGeometry = (radius) => {
    const g = new THREE.CylinderGeometry(radius, radius * 1.08, 0.038, 16);
    g.rotateZ(Math.PI / 2);
    return g;
  };

  for (const sx of [-1, 1]) {
    const sideTag = sx < 0 ? 'L' : 'R';
    // Door Rosette (local to exterior door hinge (sx*0.955, 1.78, -0.545))
    const hingePos = new THREE.Vector3(sx * 0.955, 1.78, -0.545);
    const doorRosGeo = createRosetteGeometry(0.115);
    doorRosGeo.translate(sx * 0.925 - hingePos.x, 1.48 - hingePos.y, -0.22 - hingePos.z);
    const doorRosMesh = new THREE.Mesh(doorRosGeo, brassMat);
    doorRosMesh.name = `Rosette_Door_${sideTag}`;
    doorRosMesh.position.copy(hingePos);
    doorRosMesh.visible = false;
    registerAddonMesh(doorRosMesh, 'skulls');
    sprungBodyMeshes.push(doorRosMesh);
    if (sx < 0) leftDoorMeshes.push(doorRosMesh);
    else rightDoorMeshes.push(doorRosMesh);
    rosetteMeshes.push(doorRosMesh);

    // Upper Cornice Rosette (at (sx * 0.95, 2.38, -0.22))
    const bodyRosGeo = createRosetteGeometry(0.105);
    bodyRosGeo.translate(sx * 0.95, 2.38, -0.22);
    const bodyRosMesh = new THREE.Mesh(bodyRosGeo, brassMat);
    bodyRosMesh.name = `Rosette_Body_${sideTag}`;
    bodyRosMesh.visible = false;
    registerAddonMesh(bodyRosMesh, 'skulls');
    sprungBodyMeshes.push(bodyRosMesh);
    rosetteMeshes.push(bodyRosMesh);
  }
}

export function setupCarriageModel(gltfScene, turntableGroup, loadingBanner, onModelReady) {
  const rawMeshes = [];
  gltfScene.traverse((child) => {
    if (child.isMesh) rawMeshes.push(child);
  });

  // Split Front vs. Rear Coach Lanterns & Split Exterior Roof Stove Chimney Stack
  for (const m of rawMeshes) {
    const name = m.name || '';
    if (name.startsWith('Lantern_')) {
      const rearM = splitMeshByCentroid(m, (_cx, _cy, cz) => cz < 0.0, `${name}_Rear`);
      if (rearM) gltfScene.add(rearM);
    } else if (name === 'Interior_Brass' || name === 'Interior_Iron') {
      const chimM = splitMeshByCentroid(m, (cx, cy, _cz) => cy > 2.58 && cx < -0.22, name.replace('Interior_', 'Chimney_'));
      if (chimM) gltfScene.add(chimM);
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
      if (Math.abs(bbCenter.y) > 0.02 || Math.abs(bbCenter.z) > 0.02) {
        child.geometry.translate(-bbCenter.x, -bbCenter.y, -bbCenter.z);
        child.position.add(bbCenter);
      }
      child.rotation.order = 'YZX';
      if (name.includes('Wood') && !matRefs.wheelWood) matRefs.wheelWood = child.material;
    }

    if (name.startsWith('Roof_')) {
      roofMeshes.push(child);
    }

    if (name.startsWith('Chimney_')) {
      chimneyMeshes.push(child);
    }

    if (name.startsWith('Door_L_') || name.startsWith('Door_R_')) {
      const sx = name.startsWith('Door_L_') ? -1 : 1;
      const hingePos = new THREE.Vector3(sx * 0.955, 1.78, -0.545);
      if (child.position.distanceTo(hingePos) > 0.05) {
        child.geometry.translate(child.position.x - hingePos.x, child.position.y - hingePos.y, child.position.z - hingePos.z);
        child.position.copy(hingePos);
      }
      if (sx < 0) leftDoorMeshes.push(child);
      else rightDoorMeshes.push(child);
    }

    if (name.startsWith('Window_Door_L_') || name.startsWith('Window_Door_R_')) {
      const sx = name.startsWith('Window_Door_L_') ? -1 : 1;
      const hingePos = new THREE.Vector3(sx * 0.985, 2.08, -0.455);
      if (child.position.distanceTo(hingePos) > 0.05) {
        child.geometry.translate(child.position.x - hingePos.x, child.position.y - hingePos.y, child.position.z - hingePos.z);
        child.position.copy(hingePos);
      }
      child.userData.doorHingeBase = new THREE.Vector3(sx * 0.955, 1.78, -0.545);
      child.userData.morphedDoorHinge = new THREE.Vector3(sx * 0.955, 1.78, -0.545);
      child.userData.doorRestHinge = new THREE.Vector3(sx * 0.955, 1.78, -0.545);
      if (sx < 0) leftDoorWindowMeshes.push(child);
      else rightDoorWindowMeshes.push(child);
    }

    if (name.startsWith('Window_Front_')) {
      const hingePos = new THREE.Vector3(0.0, 2.40, 1.375);
      if (child.position.distanceTo(hingePos) > 0.05) {
        child.geometry.translate(child.position.x - hingePos.x, child.position.y - hingePos.y, child.position.z - hingePos.z);
        child.position.copy(hingePos);
      }
      frontWindowMeshes.push(child);
    }

    if (name.startsWith('Window_Rear_L_') || name.startsWith('Window_Rear_R_')) {
      const sx = name.startsWith('Window_Rear_L_') ? -1 : 1;
      const hingePos = new THREE.Vector3(sx * 0.285, 1.96, -1.895);
      if (child.position.distanceTo(hingePos) > 0.05) {
        child.geometry.translate(child.position.x - hingePos.x, child.position.y - hingePos.y, child.position.z - hingePos.z);
        child.position.copy(hingePos);
      }
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

    if (name.includes('Iron') && !matRefs.iron) matRefs.iron = child.material;
    if (name.includes('Brass') && !matRefs.brass) matRefs.brass = child.material;
    if (name === 'Interior_Velvet') matRefs.velvet = child.material;

    child.userData.basePosition = child.position.clone();
    child.userData.morphedBasePos = child.position.clone();
    child.userData.restPosition = child.position.clone();
    child.userData.restRotation = child.rotation.clone();
    child.userData.explodeVec = computeExplodeOffset(name, bbCenter);

    if (child.material) {
      child.material = child.material.clone();
      const isShellSurface = (
        name === 'Roof_SlateStructure' ||
        name === 'Roof_TealCeiling' ||
        name === 'Body_SlateTrim' ||
        name === 'Body_DarkGlass'
      );
      child.material.side = isShellSurface ? THREE.DoubleSide : THREE.FrontSide;

      // Deterministic hardware depth-offset hierarchy so layered trim/hardware/sashes never Z-fight
      if (name === 'Roof_TealCeiling') {
        child.material.polygonOffset = true;
        child.material.polygonOffsetFactor = 1;
        child.material.polygonOffsetUnits = 1;
      } else if (name.startsWith('Window_') && name.includes('Slate')) {
        child.material.polygonOffset = true;
        child.material.polygonOffsetFactor = -2;
        child.material.polygonOffsetUnits = -2;
      } else if (name.includes('Slate') || name === 'Body_DarkGlass') {
        child.material.polygonOffset = true;
        child.material.polygonOffsetFactor = -1;
        child.material.polygonOffsetUnits = -1;
      } else if (name.includes('Iron') || name.includes('Brass') || name.includes('Skull') || name === 'Interior_Velvet') {
        child.material.polygonOffset = true;
        child.material.polygonOffsetFactor = -3;
        child.material.polygonOffsetUnits = -3;
      }

      if (name.includes('Glass') && name !== 'Body_DarkGlass') {
        child.material.transparent = true;
        child.material.depthWrite = false;
        child.renderOrder = 2;
        const isLanternG = name.startsWith('Lantern_Glass');
        child.material.opacity = isLanternG ? 0.58 : 0.38;
        if (isLanternG) {
          child.material.emissive = new THREE.Color(0xff9b28);
          child.material.emissiveIntensity = 0.75;
          lanternGlassMeshes.push(child);
        }
      }
      child.userData.origMap = child.material.map;
      child.userData.origColor = child.material.color.clone();
      child.userData.origMetalness = child.material.metalness;
      child.userData.origRoughness = child.material.roughness;
      child.userData.origEmissive = child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000);
      child.userData.origOpacity = child.material.opacity;
    }

    allCarriageMeshes.push(child);

    // Assign to wheel & suspension groups
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

    // Assign to Bespoke Customization Buckets
    if (name.includes('Teal') || name === 'Interior_Wood') {
      customBuckets.timber.push(child);
    } else if ((name.startsWith('Wheel_') && name.includes('Wood')) || name === 'Undercarriage_PurpleWood') {
      customBuckets.wheels.push(child);
    } else if (name === 'Interior_Velvet') {
      customBuckets.upholstery.push(child);
    } else if (name.includes('Iron') || name.includes('Slate')) {
      customBuckets.metal.push(child);
    } else if (name.includes('Skull')) {
      customBuckets.skulls.push(child);
    } else if (name.includes('Glass') && !name.startsWith('Lantern_')) {
      customBuckets.glass.push(child);
    }
  });

  // Build Procedural Wheel Discs/Tracery & Tudor Brass Rosettes
  buildProceduralCustomAddons(gltfScene, matRefs);

  // Pre-populate raycast target lists once so pointerup events allocate zero arrays
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

  // Cache original rest vertex positions for seamless continuous vertex-level deformation
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
 * Loads `./gothic_carriage.glb` as a fast native binary stream over HTTP/HTTPS,
 * with automatic fallback to `carriage_glb_data.js` when opened directly via `file://`.
 */
export function loadCarriageGLB(turntableGroup, loadingBanner, onModelReady) {
  const loader = new GLTFLoader();

  const parseFromBase64 = (b64) => {
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    loader.parse(bytes.buffer, './', (gltf) => {
      setupCarriageModel(gltf.scene, turntableGroup, loadingBanner, onModelReady);
    });
  };

  const loadFallbackBase64Script = () => {
    const existing = window.CARRIAGE_GLB_BASE64 || window.__CARRIAGE_GLB_B64__;
    if (existing) {
      parseFromBase64(existing);
      return;
    }
    const s = document.createElement('script');
    s.src = './carriage_glb_data.js';
    s.onload = () => {
      const b64 = window.CARRIAGE_GLB_BASE64 || window.__CARRIAGE_GLB_B64__;
      if (b64) parseFromBase64(b64);
    };
    document.head.appendChild(s);
  };

  if (window.location.protocol === 'file:') {
    loadFallbackBase64Script();
  } else {
    loader.load(
      './gothic_carriage.glb',
      (gltf) => setupCarriageModel(gltf.scene, turntableGroup, loadingBanner, onModelReady),
      undefined,
      () => loadFallbackBase64Script()
    );
  }
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
