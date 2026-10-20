import * as THREE from 'three';
import {
  carriageConfig,
  BASE_WIDTH_MM,
  BASE_HEIGHT_MM,
  BASE_LENGTH_MM,
  BASE_FRONT_WHEEL_MM,
  BASE_REAR_WHEEL_MM,
  baseCalloutAnchors3D,
  calloutAnchors3D,
  formatMetricMM
} from './config.js';
import {
  wheelRig,
  sprungBodyMeshes,
  undercarriageMeshes,
  wheelTraceryMeshes,
  wheelDiscMeshes,
  skullMeshes,
  rosetteMeshes,
  chimneyMeshes,
  frontLanternMeshes,
  rearLanternMeshes
} from './carriageModel.js';

export const kinematicState = {
  stancePitchRad: 0.0,
  avgAxleLiftY: 0.0,
  currentTotalLiftY: 0.0
};

const lastDeformState = {
  initialized: false,
  sCrown: 1.0,
  sCab: 1.0,
  chimMode: 'standard',
  sy: 1.0,
  sWF: 1.0,
  sRim: 1.0,
  camberDeg: 0.0,
  totalLiftY: 0.0
};

export function evalMorphedBodyPoint(px, py, pz, outVec) {
  const sx = carriageConfig.widthScale;
  const sy = carriageConfig.heightScale;
  const sz = carriageConfig.lengthScale;
  const sCrown = carriageConfig.roofCrownScale;
  const sCab = carriageConfig.cabinScale;

  let eaveMult = 1.0;
  if (py > 1.65 && py < 2.55) {
    const rDist = Math.max(Math.abs(px) / 2.58, Math.abs(pz) / 2.38);
    if (rDist > 0.55) {
      eaveMult = 1.0 + (sCab - 1.0) * ((rDist - 0.55) / 0.45);
    }
  }
  const mx = px * eaveMult;
  const mz = pz * eaveMult;
  const my = (py > 2.48) ? (2.48 + (py - 2.48) * sCrown) : py;
  outVec.set(mx * sx, my * sy + kinematicState.currentTotalLiftY, mz * sz);
  return outVec;
}

export function deformCarriageGeometry(sy, sCrown, sCab, chimMode, sWF, sRim, camberDeg, totalLiftY) {
  if (sprungBodyMeshes.length === 0) return;

  const needBodyDeform = (
    !lastDeformState.initialized ||
    Math.abs(sCrown - lastDeformState.sCrown) > 1e-4 ||
    Math.abs(sCab - lastDeformState.sCab) > 1e-4 ||
    Math.abs(sWF - lastDeformState.sWF) > 1e-4 ||
    Math.abs(sRim - lastDeformState.sRim) > 1e-4 ||
    Math.abs(camberDeg - lastDeformState.camberDeg) > 1e-4 ||
    chimMode !== lastDeformState.chimMode
  );

  if (needBodyDeform) {
    const flareLift = Math.tan(THREE.MathUtils.degToRad(camberDeg)) * 0.85;

    for (const m of sprungBodyMeshes) {
      const posAttr = m.geometry?.attributes?.position;
      const orig = m.geometry?.userData?.origPos;
      if (!posAttr || !orig) continue;

      const dst = posAttr.array;
      const bp = m.userData.basePosition;
      const name = m.name || '';
      const isChimney = name.startsWith('Chimney_');
      const isTumpang = name.startsWith('Body_Tumpang');
      const isRoof = name.startsWith('Roof_');
      const isTimberFrame = (name === 'Body_TealWood' || name === 'Body_Brass');

      const mbpX = bp.x;
      const mbpY = (bp.y > 2.48) ? (2.48 + (bp.y - 2.48) * sCrown) : bp.y;
      const mbpZ = bp.z;
      m.userData.morphedBasePos.set(mbpX, mbpY, mbpZ);

      const count = posAttr.count;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const wx = orig[i3] + bp.x;
        const wy = orig[i3 + 1] + bp.y;
        const wz = orig[i3 + 2] + bp.z;

        let newWx = wx;
        let newWy = wy;
        let newWz = wz;

        // 1. Soko Guru Master Column Girth Scaling (`sWF`) around each of the 4 central pillars (±0.82, ±0.68)
        if (isTimberFrame && wy >= 0.65 && wy <= 2.24) {
          for (const sgx of [-0.82, 0.82]) {
            for (const sgz of [-0.68, 0.68]) {
              const dx = wx - sgx;
              const dz = wz - sgz;
              if (Math.abs(dx) < 0.16 && Math.abs(dz) < 0.16) {
                newWx = sgx + dx * sWF;
                newWz = sgz + dz * sWF;
              }
            }
          }
        }

        // 2. Tumpang Sari Stepped Ceiling Beam Relief Depth (`sRim`)
        if (isTumpang && wy > 2.36 && Math.abs(wx) < 0.88 && Math.abs(wz) < 0.74) {
          newWy = 2.36 + (wy - 2.36) * sRim;
        }

        // 3. Penanggap Eaves Overhang Span (`sCab`) & Upturned Eave Flare (`camberDeg`)
        if (isRoof && wy < 2.50) {
          const rNorm = Math.max(0.0, (Math.max(Math.abs(wx) / 2.62, Math.abs(wz) / 2.42) - 0.42) / 0.58);
          const spanMult = 1.0 + (sCab - 1.0) * rNorm;
          newWx = wx * spanMult;
          newWz = wz * spanMult;
          newWy += (rNorm * rNorm) * flareLift;
        }

        // 4. Steep Brunjung Central Roof Crown (`sCrown`) & Tall Garuda Spire (`chimMode`)
        if (newWy > 2.48) {
          newWy = 2.48 + (newWy - 2.48) * sCrown;
        }
        if (isChimney && chimMode === 'tall' && wy > 3.60) {
          const baseApex = 2.48 + (3.60 - 2.48) * sCrown;
          newWy = baseApex + (newWy - baseApex) * 1.65;
        }

        dst[i3]     = newWx - mbpX;
        dst[i3 + 1] = newWy - mbpY;
        dst[i3 + 2] = newWz - mbpZ;
      }
      posAttr.needsUpdate = true;
    }
  }

  const needPlinthDeform = (
    !lastDeformState.initialized ||
    Math.abs(sy - lastDeformState.sy) > 1e-4 ||
    Math.abs(totalLiftY - lastDeformState.totalLiftY) > 1e-4
  );

  if (needPlinthDeform) {
    for (const m of undercarriageMeshes) {
      const posAttr = m.geometry?.attributes?.position;
      const orig = m.geometry?.userData?.origPos;
      if (!posAttr || !orig) continue;

      const dst = posAttr.array;
      const count = posAttr.count;
      const liftUnscaled = totalLiftY / sy;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const lx = orig[i3];
        const ly = orig[i3 + 1];
        const lz = orig[i3 + 2];

        // Stretch the Undak-Undakan stone plinth smoothly from ground (y=0) up to the elevated floor
        const tPlinth = Math.max(0.0, Math.min(1.0, ly / 0.34));
        dst[i3]     = lx;
        dst[i3 + 1] = ly + liftUnscaled * tPlinth;
        dst[i3 + 2] = lz;
      }
      posAttr.needsUpdate = true;
    }
  }

  lastDeformState.initialized = true;
  lastDeformState.sCrown = sCrown;
  lastDeformState.sCab = sCab;
  lastDeformState.chimMode = chimMode;
  lastDeformState.sy = sy;
  lastDeformState.sWF = sWF;
  lastDeformState.sRim = sRim;
  lastDeformState.camberDeg = camberDeg;
  lastDeformState.totalLiftY = totalLiftY;
}

export function syncAllCarriageTransforms({ uiRefs, lights, cobblePatch, roadStones, updateAtelierSummary }) {
  const sx = carriageConfig.widthScale;
  const sy = carriageConfig.heightScale;
  const sz = carriageConfig.lengthScale;
  const sCrown = carriageConfig.roofCrownScale;
  const rideY = Math.max(0.0, carriageConfig.rideHeightOffset);
  const sCab = carriageConfig.cabinScale;
  const sWF = carriageConfig.frontWheelScale;
  const sWR = carriageConfig.rearWheelScale;
  const sRim = carriageConfig.wheelRimScale;
  const chimMode = carriageConfig.chimneyMode;
  const camberDeg = carriageConfig.wheelCamberDeg;

  // Update Metric Badges & Right-Column Elevation Readouts
  const effHeightScale = sy * (0.72 + 0.28 * sCrown) + rideY / 3.8;
  const wText = formatMetricMM(BASE_WIDTH_MM * sx * (0.85 + 0.15 * sCab));
  const hText = formatMetricMM(BASE_HEIGHT_MM * effHeightScale);
  const lText = formatMetricMM(BASE_LENGTH_MM * sz * (0.85 + 0.15 * sCab));

  if (uiRefs.valWidthBadge) uiRefs.valWidthBadge.textContent = wText;
  if (uiRefs.valHeightBadge) uiRefs.valHeightBadge.textContent = hText;
  if (uiRefs.valLengthBadge) uiRefs.valLengthBadge.textContent = lText;
  if (uiRefs.elevMmWidth) uiRefs.elevMmWidth.textContent = wText;
  if (uiRefs.elevMmHeight) uiRefs.elevMmHeight.textContent = hText;
  if (uiRefs.elevMmLength) uiRefs.elevMmLength.textContent = lText;

  if (uiRefs.valRoofCrown) uiRefs.valRoofCrown.textContent = `${Math.round(sCrown * 100)}%`;
  if (uiRefs.valRideHeight) {
    const mm = Math.round(rideY * 2200);
    uiRefs.valRideHeight.textContent = `+${mm} MM`;
  }
  if (uiRefs.valCabinScale) uiRefs.valCabinScale.textContent = `${Math.round(sCab * 100)}%`;
  if (uiRefs.valWheelFront) uiRefs.valWheelFront.textContent = formatMetricMM(BASE_FRONT_WHEEL_MM * sWF);
  if (uiRefs.valWheelRear) uiRefs.valWheelRear.textContent = formatMetricMM(BASE_REAR_WHEEL_MM * sWR);
  if (uiRefs.valWheelRim) uiRefs.valWheelRim.textContent = `${Math.round(sRim * 100)}%`;
  if (uiRefs.valWheelCamber) uiRefs.valWheelCamber.textContent = `${camberDeg.toFixed(1)}°`;
  if (uiRefs.valDriveSpeed) uiRefs.valDriveSpeed.textContent = `${Math.round(carriageConfig.driveSpeedMult * 100)}%`;

  if (updateAtelierSummary) updateAtelierSummary();

  // Subtly scale right-column technical elevation drawings to mirror custom proportions
  const clampS = (v) => Math.max(0.84, Math.min(1.14, 1.0 + (v - 1.0) * 0.55));
  if (uiRefs.imgElevSide) {
    uiRefs.imgElevSide.style.transformOrigin = 'center bottom';
    uiRefs.imgElevSide.style.transform = `scale(${clampS(sz).toFixed(3)}, ${clampS(effHeightScale).toFixed(3)})`;
  }
  if (uiRefs.imgElevFront) {
    uiRefs.imgElevFront.style.transformOrigin = 'center bottom';
    uiRefs.imgElevFront.style.transform = `scale(${clampS(sx).toFixed(3)}, ${clampS(effHeightScale).toFixed(3)})`;
  }
  if (uiRefs.imgElevRear) {
    uiRefs.imgElevRear.style.transformOrigin = 'center bottom';
    uiRefs.imgElevRear.style.transform = `scale(${clampS(sx).toFixed(3)}, ${clampS(effHeightScale).toFixed(3)})`;
  }

  const umpakExtraLift = (sWR - 1.0) * 0.14 * sy;
  const totalLiftY = rideY + Math.max(0, umpakExtraLift);
  kinematicState.currentTotalLiftY = totalLiftY;

  // 1. Update 4 Master Umpak Soko Guru Pedestals
  for (const key of ['FL', 'FR', 'RL', 'RR']) {
    const w = wheelRig[key];
    w.radius = w.baseRadius * sWR;
    w.restPos.set(
      w.basePos.x * sx,
      0.54 * sy + rideY + umpakExtraLift * 0.5,
      w.basePos.z * sz
    );
    for (const m of w.meshes) {
      m.userData.restPosition.copy(w.restPos);
      m.scale.set(sx * sWF, sy * sWR, sz * sWF);
    }
  }

  // 2. Apply Vertex-Level Deformation for Brunjung Pitch, Eave Overhang, Column Girth & Plinth Step
  deformCarriageGeometry(sy, sCrown, sCab, chimMode, sWF, sRim, camberDeg, totalLiftY);

  // 3. Update Plinth & Sprung Pavilion Transforms
  for (const m of undercarriageMeshes) {
    const bp = m.userData.basePosition;
    m.userData.restPosition.set(bp.x * sx, bp.y * sy, bp.z * sz);
    m.scale.set(sx, sy, sz);
  }

  for (const m of sprungBodyMeshes) {
    const mbp = m.userData.morphedBasePos || m.userData.basePosition;
    m.userData.restPosition.set(mbp.x * sx, mbp.y * sy + totalLiftY, mbp.z * sz);
    m.scale.set(sx, sy, sz);
  }

  // 4. Component Visibility Modes (Umpak/Langkan Style, Gebyok Crest, Mustaka Crown, Lanterns)
  const wStyle = carriageConfig.wheelStyle;
  wheelTraceryMeshes.forEach((m) => { m.visible = (wStyle === 'tracery'); });
  wheelDiscMeshes.forEach((m) => { m.visible = (wStyle === 'disc'); });

  const mMode = carriageConfig.medallionsMode;
  skullMeshes.forEach((m) => { m.visible = (mMode === 'skulls'); });
  rosetteMeshes.forEach((m) => { m.visible = (mMode === 'rosettes'); });

  chimneyMeshes.forEach((m) => { m.visible = (chimMode !== 'none'); });

  const lMode = carriageConfig.lanternsMode;
  frontLanternMeshes.forEach((m) => { m.visible = (lMode === 'all' || lMode === 'front'); });
  rearLanternMeshes.forEach((m) => { m.visible = (lMode === 'all'); });

  // 5. Reposition Pendopo Robyong Chandelier & Dalem Sanctuary Point Lights
  if (lights) {
    evalMorphedBodyPoint(0.0, 2.05,  0.35, lights.frontLanternGlow.position);
    evalMorphedBodyPoint(0.0, 1.55, -1.35, lights.interiorGlow.position);
    evalMorphedBodyPoint(0.0, 1.80, -1.65, lights.rearLanternGlow.position);
  }

  // 6. Adjust Courtyard Pelataran Patch & Stone Garden Urns
  if (cobblePatch) cobblePatch.scale.set(sx, 1.0, sz);
  if (roadStones) {
    for (const st of roadStones) {
      st.mesh.position.set(st.x * sx, 0.005, st.z * sz);
    }
  }

  // 7. Scale 3D Callout Leader Anchors
  evalMorphedBodyPoint(baseCalloutAnchors3D['1'].x, baseCalloutAnchors3D['1'].y, baseCalloutAnchors3D['1'].z, calloutAnchors3D['1']);
  evalMorphedBodyPoint(baseCalloutAnchors3D['2'].x, baseCalloutAnchors3D['2'].y, baseCalloutAnchors3D['2'].z, calloutAnchors3D['2']);
  evalMorphedBodyPoint(baseCalloutAnchors3D['3'].x, baseCalloutAnchors3D['3'].y, baseCalloutAnchors3D['3'].z, calloutAnchors3D['3']);
  evalMorphedBodyPoint(baseCalloutAnchors3D['4'].x, baseCalloutAnchors3D['4'].y, baseCalloutAnchors3D['4'].z, calloutAnchors3D['4']);
}
