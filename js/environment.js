import * as THREE from 'three';
import { PATCH_LENGTH } from './config.js';

/**
 * Generates a tileable Javanese Kraton Courtyard (Pelataran Batu Candi & Andesit)
 * diffuse + bump map with a stationary elliptical feathered alpha mask so the
 * courtyard dissolves organically into the parchment drafting sheet.
 */
export function createFeatheredCobblestonePatch() {
  const size = 1024;
  const diffuseCanvas = document.createElement('canvas');
  diffuseCanvas.width = size;
  diffuseCanvas.height = size;
  const ctx = diffuseCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d');

  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = size;
  alphaCanvas.height = size;
  const actx = alphaCanvas.getContext('2d');

  // Deep volcanic mortar & subtle tropical moss bed
  ctx.fillStyle = '#47433c';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#1e1e1e';
  bctx.fillRect(0, 0, size, size);

  // Tileable coursed Javanese Andesite flagstones (Batu Candi)
  const rows = 20;
  const cols = 14;
  const rh = size / rows;
  const cw = size / cols;

  let seed = 108;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let r = 0; r < rows; r++) {
    const stagger = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * cw + stagger;
      const y = r * rh;
      const w = cw - 5;
      const h = rh - 5;

      const baseTone = 86 + Math.floor(rand() * 44);
      const warmShift = Math.floor((rand() - 0.35) * 18);
      const mossShift = Math.floor((rand() - 0.45) * 16);
      const red = Math.min(185, Math.max(58, baseTone + warmShift));
      const green = Math.min(185, Math.max(58, baseTone + Math.floor(warmShift * 0.7) + Math.max(0, mossShift)));
      const blue = Math.min(178, Math.max(54, baseTone - 5));

      ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      ctx.beginPath();
      ctx.roundRect(x + 2.5, y + 2.5, w, h, 4);
      ctx.fill();

      // Subtle chiselled stone bevel highlight
      ctx.strokeStyle = 'rgba(218, 210, 195, 0.24)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const bVal = 150 + Math.floor(rand() * 85);
      bctx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
      bctx.beginPath();
      bctx.roundRect(x + 3.5, y + 3.5, w - 2, h - 2, 3);
      bctx.fill();
    }
  }

  // Stationary elliptical feathered alpha mask so edges dissolve into parchment
  actx.fillStyle = '#000';
  actx.fillRect(0, 0, size, size);
  const grad = actx.createRadialGradient(size * 0.5, size * 0.5, size * 0.18, size * 0.5, size * 0.5, size * 0.49);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.64, 'rgba(255,255,255,0.92)');
  grad.addColorStop(0.84, 'rgba(255,255,255,0.36)');
  grad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
  actx.fillStyle = grad;
  actx.fillRect(0, 0, size, size);

  const mapTex = new THREE.CanvasTexture(diffuseCanvas);
  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  const alphaTex = new THREE.CanvasTexture(alphaCanvas);
  mapTex.wrapS = THREE.RepeatWrapping;
  mapTex.wrapT = THREE.RepeatWrapping;
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  mapTex.repeat.set(1.5, 1.5);
  bumpTex.repeat.set(1.5, 1.5);
  mapTex.anisotropy = 8;
  bumpTex.anisotropy = 8;

  const patchGeo = new THREE.PlaneGeometry(8.8, PATCH_LENGTH, 48, 48);
  patchGeo.rotateX(-Math.PI / 2);

  const patchMat = new THREE.MeshStandardMaterial({
    map: mapTex,
    bumpMap: bumpTex,
    bumpScale: 0.028,
    alphaMap: alphaTex,
    transparent: true,
    roughness: 0.72,
    metalness: 0.06
  });

  const patchMesh = new THREE.Mesh(patchGeo, patchMat);
  patchMesh.position.set(0.0, 0.002, 0.0);
  patchMesh.receiveShadow = true;
  return { patchMesh, mapTex, bumpTex };
}

/**
 * Builds ornamental Javanese courtyard stone urns (Gentong Batu) & stepping stones
 * flanking the front Pendopo approach.
 */
function createCourtyardUrnMesh(radius, height) {
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(radius * 0.78, 0.0),
    new THREE.Vector2(radius * 0.85, height * 0.14),
    new THREE.Vector2(radius * 0.65, height * 0.24),
    new THREE.Vector2(radius * 1.02, height * 0.62),
    new THREE.Vector2(radius * 0.86, height * 0.88),
    new THREE.Vector2(radius * 0.94, height * 0.96),
    new THREE.Vector2(radius * 0.72, height),
    new THREE.Vector2(0.0, height)
  ];
  const geo = new THREE.LatheGeometry(pts, 16);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x524c46,
    roughness: 0.74,
    metalness: 0.08,
    transparent: true,
    opacity: 1.0
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildRoadStones(turntableGroup) {
  const stoneSpecs = [
    { side: -1, x: -1.65, z:  2.85, radius: 0.16, height: 0.26 },
    { side:  1, x:  1.65, z:  2.85, radius: 0.16, height: 0.26 },
    { side: -1, x: -2.95, z:  0.00, radius: 0.14, height: 0.22 },
    { side:  1, x:  2.95, z:  0.00, radius: 0.14, height: 0.22 }
  ];
  const roadStones = [];
  for (const sp of stoneSpecs) {
    const mesh = createCourtyardUrnMesh(sp.radius, sp.height);
    mesh.position.set(sp.x, 0.005, sp.z);
    turntableGroup.add(mesh);
    roadStones.push({ ...sp, mesh });
  }
  return roadStones;
}
