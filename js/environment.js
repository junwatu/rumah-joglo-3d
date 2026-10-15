import * as THREE from 'three';
import { PATCH_LENGTH } from './config.js';

/**
 * Generates a tileable procedural cobblestone diffuse + bump map with a stationary
 * elliptical feathered alpha mask so the road dissolves into the parchment floor.
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

  ctx.fillStyle = '#574c41';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#222';
  bctx.fillRect(0, 0, size, size);

  // Tileable coursed cobblestones (rows divide size cleanly so RepeatWrapping is seamless)
  const rows = 28;
  const cols = 18;
  const rh = size / rows;
  const cw = size / cols;

  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let r = 0; r < rows; r++) {
    const stagger = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * cw + stagger;
      const y = r * rh;
      const w = cw - 6;
      const h = rh - 6;

      const baseTone = 92 + Math.floor(rand() * 58);
      const warmShift = Math.floor((rand() - 0.3) * 24);
      const coolShift = Math.floor((rand() - 0.5) * 18);
      const red = Math.min(220, Math.max(60, baseTone + warmShift));
      const green = Math.min(210, Math.max(58, baseTone + Math.floor(warmShift * 0.6)));
      const blue = Math.min(200, Math.max(52, baseTone - 8 + coolShift));

      ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, w, h, 7);
      ctx.fill();

      ctx.strokeStyle = 'rgba(235, 225, 208, 0.32)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const bVal = 155 + Math.floor(rand() * 85);
      bctx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
      bctx.beginPath();
      bctx.roundRect(x + 4, y + 4, w - 2, h - 2, 6);
      bctx.fill();
    }
  }

  // Stationary elliptical feathered alpha mask so edges dissolve into parchment while stones scroll
  actx.fillStyle = '#000';
  actx.fillRect(0, 0, size, size);
  const grad = actx.createRadialGradient(size * 0.5, size * 0.5, size * 0.16, size * 0.5, size * 0.5, size * 0.48);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.58, 'rgba(255,255,255,0.92)');
  grad.addColorStop(0.82, 'rgba(255,255,255,0.38)');
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
  mapTex.anisotropy = 8;
  bumpTex.anisotropy = 8;

  const patchGeo = new THREE.PlaneGeometry(4.4, PATCH_LENGTH, 64, 64);
  patchGeo.rotateX(-Math.PI / 2);

  const patchMat = new THREE.MeshStandardMaterial({
    map: mapTex,
    bumpMap: bumpTex,
    bumpScale: 0.035,
    alphaMap: alphaTex,
    transparent: true,
    roughness: 0.62,
    metalness: 0.08
  });

  const patchMesh = new THREE.Mesh(patchGeo, patchMat);
  patchMesh.position.set(0.0, 0.002, -0.08);
  patchMesh.receiveShadow = true;
  return { patchMesh, mapTex, bumpTex };
}

function createRoadStoneMesh(radius, height) {
  const geo = new THREE.DodecahedronGeometry(radius, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const n = 1.0 + 0.16 * Math.sin(vx * 22.0 + vz * 18.0);
    pos.setXYZ(i, vx * n, Math.max(0.0, vy + radius * 0.45) * (height / radius) * 1.15, vz * n);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6b6055,
    roughness: 0.78,
    metalness: 0.06,
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
    { side: -1, x: -0.96, z:  1.95, radius: 0.125, height: 0.058 },
    { side:  1, x:  0.96, z: -0.25, radius: 0.130, height: 0.062 },
    { side: -1, x: -0.96, z: -2.10, radius: 0.115, height: 0.052 }
  ];
  const roadStones = [];
  for (const sp of stoneSpecs) {
    const mesh = createRoadStoneMesh(sp.radius, sp.height);
    mesh.position.set(sp.x, 0.005, sp.z);
    turntableGroup.add(mesh);
    roadStones.push({ ...sp, mesh });
  }
  return roadStones;
}
