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
  frontHubDeltaY: 0.0,
  rearHubDeltaY: 0.0,
  totalLiftY: 0.0
};

export function evalMorphedBodyPoint(px, py, pz, outVec) {
  const sx = carriageConfig.widthScale;
  const sy = carriageConfig.heightScale;
  const sz = carriageConfig.lengthScale;
  const sCrown = carriageConfig.roofCrownScale;
  const sCab = carriageConfig.cabinScale;
  let flareMult = 1.0;
  if (py > 1.30) {
    const u = Math.min(1.0, (py - 1.30) / (2.40 - 1.30));
    flareMult = 1.0 + (sCab - 1.0) * (u * u * (3.0 - 2.0 * u));
  }
  const mx = px * flareMult;
  const my = (py > 2.38) ? (2.38 + (py - 2.38) * sCrown) : py;
  outVec.set(mx * sx, my * sy + kinematicState.currentTotalLiftY, pz * sz);
  return outVec;
}

export function deformCarriageGeometry(sy, sCrown, sCab, chimMode, frontHubDeltaY, rearHubDeltaY, totalLiftY) {
  if (sprungBodyMeshes.length === 0) return;

  const needBodyDeform = (
    !lastDeformState.initialized ||
    Math.abs(sCrown - lastDeformState.sCrown) > 1e-4 ||
    Math.abs(sCab - lastDeformState.sCab) > 1e-4 ||
    chimMode !== lastDeformState.chimMode
  );

  if (needBodyDeform) {
    for (const m of sprungBodyMeshes) {
      const posAttr = m.geometry?.attributes?.position;
      const orig = m.geometry?.userData?.origPos;
      if (!posAttr || !orig) continue;

      const dst = posAttr.array;
      const bp = m.userData.basePosition;
      const name = m.name || '';
      const isChimney = name.startsWith('Chimney_');

      let bpFlare = 1.0;
      if (bp.y > 1.30) {
        const u = Math.min(1.0, (bp.y - 1.30) / (2.40 - 1.30));
        bpFlare = 1.0 + (sCab - 1.0) * (u * u * (3.0 - 2.0 * u));
      }
      const mbpX = bp.x * bpFlare;
      const mbpY = (bp.y > 2.38) ? (2.38 + (bp.y - 2.38) * sCrown) : bp.y;
      const mbpZ = bp.z;
      m.userData.morphedBasePos.set(mbpX, mbpY, mbpZ);

      if (m.userData.doorHingeBase) {
        const dhb = m.userData.doorHingeBase;
        let dhFlare = 1.0;
        if (dhb.y > 1.30) {
          const u = Math.min(1.0, (dhb.y - 1.30) / (2.40 - 1.30));
          dhFlare = 1.0 + (sCab - 1.0) * (u * u * (3.0 - 2.0 * u));
        }
        const mdhX = dhb.x * dhFlare;
        const mdhY = (dhb.y > 2.38) ? (2.38 + (dhb.y - 2.38) * sCrown) : dhb.y;
        m.userData.morphedDoorHinge.set(mdhX, mdhY, dhb.z);
      }

      const count = posAttr.count;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const wx = orig[i3] + bp.x;
        const wy = orig[i3 + 1] + bp.y;
        const wz = orig[i3 + 2] + bp.z;

        // Victorian coachbuilder upper-cabin flare / taper above wheel-well waist (y > 1.30)
        let flareMult = 1.0;
        if (wy > 1.30) {
          const u = Math.min(1.0, (wy - 1.30) / (2.40 - 1.30));
          flareMult = 1.0 + (sCab - 1.0) * (u * u * (3.0 - 2.0 * u));
        }
        const newWx = wx * flareMult;

        // Seamless Roof Vault Crown across Roof_*, Body_* gables/eaves, Interior_* & Chimney_*
        let newWy = wy;
        if (wy > 2.38) {
          newWy = 2.38 + (wy - 2.38) * sCrown;
        }
        if (isChimney && chimMode === 'tall' && wy > 2.58) {
          const chimBaseY = 2.38 + (2.58 - 2.38) * sCrown;
          newWy = chimBaseY + (newWy - chimBaseY) * 1.55;
        }

        dst[i3]     = newWx - mbpX;
        dst[i3 + 1] = newWy - mbpY;
        dst[i3 + 2] = wz - mbpZ;
      }
      posAttr.needsUpdate = true;
    }
  }

  const needChassisDeform = (
    !lastDeformState.initialized ||
    Math.abs(sy - lastDeformState.sy) > 1e-4 ||
    Math.abs(frontHubDeltaY - lastDeformState.frontHubDeltaY) > 1e-4 ||
    Math.abs(rearHubDeltaY - lastDeformState.rearHubDeltaY) > 1e-4 ||
    Math.abs(totalLiftY - lastDeformState.totalLiftY) > 1e-4
  );

  if (needChassisDeform) {
    for (const m of undercarriageMeshes) {
      const posAttr = m.geometry?.attributes?.position;
      const orig = m.geometry?.userData?.origPos;
      if (!posAttr || !orig) continue;

      const dst = posAttr.array;
      const count = posAttr.count;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const lx = orig[i3];
        const ly = orig[i3 + 1];
        const lz = orig[i3 + 2];

        // Interpolate axle height between Rear Axle (z = -1.42) and Front Axle (z = +1.25)
        const zNorm = Math.max(0.0, Math.min(1.0, (lz - (-1.42)) / (1.25 - (-1.42))));
        const axleDeltaUnscaled = ((1.0 - zNorm) * rearHubDeltaY + zNorm * frontHubDeltaY) / sy;
        const cabinDeltaUnscaled = totalLiftY / sy;

        // Smooth leaf-spring flex between axle hub level (y <= 0.60) and cabin floor mount (y >= 0.78)
        const springT = Math.max(0.0, Math.min(1.0, (ly - 0.60) / (0.78 - 0.60)));
        let newLy = ly + axleDeltaUnscaled * (1.0 - springT) + cabinDeltaUnscaled * springT;

        // Keep front draft hitch finial well clear of the ground at all height/wheel settings
        if (lz > 1.35 && ly < 0.45) {
          const minGroundClearance = 0.22 / sy;
          if (newLy < minGroundClearance) {
            newLy = minGroundClearance + ly * 0.22;
          }
        }

        dst[i3]     = lx;
        dst[i3 + 1] = newLy;
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
  lastDeformState.frontHubDeltaY = frontHubDeltaY;
  lastDeformState.rearHubDeltaY = rearHubDeltaY;
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

  // Update Metric Badges & Right-Column Elevation Readouts
  const effHeightScale = sy * (0.78 + 0.22 * sCrown) + rideY / 3.2;
  const wText = formatMetricMM(BASE_WIDTH_MM * sx);
  const hText = formatMetricMM(BASE_HEIGHT_MM * effHeightScale);
  const lText = formatMetricMM(BASE_LENGTH_MM * sz);

  if (uiRefs.valWidthBadge) uiRefs.valWidthBadge.textContent = wText;
  if (uiRefs.valHeightBadge) uiRefs.valHeightBadge.textContent = hText;
  if (uiRefs.valLengthBadge) uiRefs.valLengthBadge.textContent = lText;
  if (uiRefs.elevMmWidth) uiRefs.elevMmWidth.textContent = wText;
  if (uiRefs.elevMmHeight) uiRefs.elevMmHeight.textContent = hText;
  if (uiRefs.elevMmLength) uiRefs.elevMmLength.textContent = lText;

  const baseWheelScale = Math.min(sy, sz);
  if (uiRefs.valRoofCrown) uiRefs.valRoofCrown.textContent = `${Math.round(sCrown * 100)}%`;
  if (uiRefs.valRideHeight) {
    const mm = Math.round(rideY * 1000);
    uiRefs.valRideHeight.textContent = `+${mm} MM`;
  }
  if (uiRefs.valCabinScale) uiRefs.valCabinScale.textContent = `${Math.round(sCab * 100)}%`;
  if (uiRefs.valWheelFront) uiRefs.valWheelFront.textContent = formatMetricMM(BASE_FRONT_WHEEL_MM * baseWheelScale * sWF);
  if (uiRefs.valWheelRear) uiRefs.valWheelRear.textContent = formatMetricMM(BASE_REAR_WHEEL_MM * baseWheelScale * sWR);
  if (uiRefs.valWheelRim) uiRefs.valWheelRim.textContent = `${Math.round(sRim * 100)}%`;
  if (uiRefs.valWheelCamber) uiRefs.valWheelCamber.textContent = `${carriageConfig.wheelCamberDeg.toFixed(1)}°`;
  if (uiRefs.valDriveSpeed) uiRefs.valDriveSpeed.textContent = `${Math.round(carriageConfig.driveSpeedMult * 100)}%`;

  if (updateAtelierSummary) updateAtelierSummary();

  // Subtly scale right-column technical elevation drawings to mirror custom proportions
  const clampS = (v) => Math.max(0.84, Math.min(1.12, 1.0 + (v - 1.0) * 0.55));
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

  // 1. Update 4 Spoked Wheels (Circular in Y-Z plane, grounded at y = 0, constrained by min(sy, sz))
  for (const key of ['FL', 'FR', 'RL', 'RR']) {
    const w = wheelRig[key];
    const wDiaScale = w.isFront ? (baseWheelScale * sWF) : (baseWheelScale * sWR);
    w.radius = w.baseRadius * wDiaScale;
    // Shift wider rims outward so extra tire width never grows inward into the leaf springs or belly trough
    const outwardRimShift = w.side * Math.max(0.0, sRim - 1.0) * 0.14 * sx;
    w.restPos.set(
      w.basePos.x * sx + outwardRimShift,
      w.radius,
      w.basePos.z * sz
    );
    for (const m of w.meshes) {
      m.userData.restPosition.copy(w.restPos);
      m.scale.set(sx * sRim, wDiaScale, wDiaScale);
    }
  }

  // 2. Compute Axle Hub Deltas & Guaranteed Wheel-Top Fender Arch Clearance
  const frontHubDeltaY = wheelRig.FL.radius - 0.55 * sy;
  const rearHubDeltaY  = wheelRig.RL.radius - 0.63 * sy;
  kinematicState.avgAxleLiftY = 0.5 * (frontHubDeltaY + rearHubDeltaY);
  kinematicState.stancePitchRad = 0.0;

  const minLiftForFrontArch = (2.0 * wheelRig.FL.radius + 0.025 * sy) - 1.10 * sy;
  const minLiftForRearArch  = (2.0 * wheelRig.RL.radius + 0.025 * sy) - 1.26 * sy;
  const cabinWheelLiftY = Math.max(kinematicState.avgAxleLiftY, minLiftForFrontArch, minLiftForRearArch);
  const totalLiftY = cabinWheelLiftY + rideY;
  kinematicState.currentTotalLiftY = totalLiftY;

  // 3. Apply Seamless Vertex-Level Deformation for Roof Vault Crown, Upper-Cabin Flare & Undercarriage Leaf-Spring Flex
  deformCarriageGeometry(sy, sCrown, sCab, chimMode, frontHubDeltaY, rearHubDeltaY, totalLiftY);

  // 4. Update Undercarriage & Sprung Cabin Transforms (Cohesive X, Y, Z Scaling with Zero Desync)
  for (const m of undercarriageMeshes) {
    const bp = m.userData.basePosition;
    m.userData.restPosition.set(bp.x * sx, bp.y * sy, bp.z * sz);
    m.scale.set(sx, sy, sz);
  }

  for (const m of sprungBodyMeshes) {
    const mbp = m.userData.morphedBasePos || m.userData.basePosition;
    m.userData.restPosition.set(mbp.x * sx, mbp.y * sy + totalLiftY, mbp.z * sz);
    if (m.userData.morphedDoorHinge) {
      const mdh = m.userData.morphedDoorHinge;
      if (!m.userData.doorRestHinge) m.userData.doorRestHinge = new THREE.Vector3();
      m.userData.doorRestHinge.set(mdh.x * sx, mdh.y * sy + totalLiftY, mdh.z * sz);
    }
    m.scale.set(sx, sy, sz);
  }

  // 5. Component Visibility Modes (Wheel Style, Medallions, Chimney, Lanterns)
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

  // 6. Reposition Interior & Exterior Coach Lantern Point Lights
  if (lights) {
    evalMorphedBodyPoint(0.0, 1.85, -0.25, lights.interiorGlow.position);
    evalMorphedBodyPoint(0.0, 2.06,  1.38, lights.frontLanternGlow.position);
    evalMorphedBodyPoint(0.0, 2.06, -1.88, lights.rearLanternGlow.position);
  }

  // 7. Adjust Cobblestone Road Patch & 3D Road Stone Wheel Tracks
  if (cobblePatch) cobblePatch.scale.set(sx, 1.0, sz);
  if (roadStones) {
    for (const st of roadStones) {
      st.x = st.side * 0.96 * sx;
      st.mesh.position.x = st.x;
    }
  }

  // 8. Scale 3D Callout Leader Anchors
  evalMorphedBodyPoint(baseCalloutAnchors3D['1'].x, baseCalloutAnchors3D['1'].y, baseCalloutAnchors3D['1'].z, calloutAnchors3D['1']);
  evalMorphedBodyPoint(baseCalloutAnchors3D['2'].x, baseCalloutAnchors3D['2'].y, baseCalloutAnchors3D['2'].z, calloutAnchors3D['2']);
  evalMorphedBodyPoint(baseCalloutAnchors3D['3'].x, baseCalloutAnchors3D['3'].y, baseCalloutAnchors3D['3'].z, calloutAnchors3D['3']);
  calloutAnchors3D['4'].set(
    wheelRig.RL.restPos.x,
    wheelRig.RL.radius,
    wheelRig.RL.restPos.z
  );
}
