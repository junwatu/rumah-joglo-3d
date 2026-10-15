import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  PATCH_LENGTH,
  BASE_DRIVE_SPEED,
  BASE_WIDTH_MM,
  BASE_HEIGHT_MM,
  BASE_LENGTH_MM,
  HERO_TARGET,
  DEFAULT_CARRIAGE_CONFIG,
  carriageConfig,
  calloutAnchors3D,
  viewSpecMap,
  detailFocusSpecs,
  curatedThemes
} from './config.js';
import { createFeatheredCobblestonePatch, buildRoadStones } from './environment.js';
import {
  wheelRig,
  leftDoorMeshes,
  rightDoorMeshes,
  leftDoorWindowMeshes,
  rightDoorWindowMeshes,
  frontWindowMeshes,
  rearLeftWindowMeshes,
  rearRightWindowMeshes,
  interactiveWindowMeshes,
  interactiveDoorMeshes,
  lanternGlassMeshes,
  sprungBodyMeshes,
  undercarriageMeshes,
  allCarriageMeshes,
  lanternLightState,
  loadCarriageGLB,
  applyCustomization
} from './carriageModel.js';
import { kinematicState, syncAllCarriageTransforms } from './kinematics.js';
import { initPerfMonitor } from './perfMonitor.js';

// =========================================================================
// 1. POPULATE ORTHOGRAPHIC ELEVATION IMAGES & MACRO SWATCHES
// =========================================================================
const A = window.UI_ASSETS || {};
document.getElementById('img-elev-side').src = A.elev_side || './ui_renders/elev_side.png';
document.getElementById('img-elev-front').src = A.elev_front || './ui_renders/elev_front.png';
document.getElementById('img-elev-rear').src = A.elev_rear || './ui_renders/elev_rear.png';

document.getElementById('img-swatch-timber').src = A.swatch_timber || './ui_renders/swatch_timber.png';
document.getElementById('img-swatch-iron').src = A.swatch_iron || './ui_renders/swatch_iron.png';
document.getElementById('img-swatch-glass').src = A.swatch_glass || './ui_renders/swatch_glass.png';
document.getElementById('img-swatch-skull').src = A.swatch_skull || './ui_renders/swatch_skull.png';

function updateViewModeThumbnails(activeView) {
  const views = ['iso', 'side', 'front', 'rear'];
  for (const v of views) {
    const imgEl = document.getElementById(`thumb-${v}`);
    if (!imgEl) continue;
    const isAct = v === activeView;
    const key = isAct ? `elev_${v}_light` : `elev_${v}`;
    imgEl.src = A[key] || `./ui_renders/${key}.png`;
  }
}
updateViewModeThumbnails('iso');

// =========================================================================
// 2. THREE.JS SCENE, STUDIO HERITAGE LIGHTING & FEATHERED COBBLESTONE ROAD
// =========================================================================
const canvasWrap = document.getElementById('carriage-canvas-wrap');
const canvas = document.getElementById('carriage-canvas');
const centerStage = document.getElementById('center-stage');
const loadingBanner = document.getElementById('loading-banner');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  logarithmicDepthBuffer: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(34, 1, 0.25, 45);

const _camDirNorm = new THREE.Vector3();
function computeFittedCameraPos(dirVec, targetVec, reqWidth, reqHeight, explodeScale = 1.0) {
  const rect = canvasWrap.getBoundingClientRect();
  const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1.0;
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const dVert = (reqHeight * 0.5) / tanHalfFov;
  const dHoriz = (reqWidth * 0.5) / (tanHalfFov * Math.max(0.42, aspect));
  const dist = Math.max(dVert, dHoriz) * explodeScale;
  _camDirNorm.copy(dirVec).normalize();
  return targetVec.clone().addScaledVector(_camDirNorm, dist);
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HERO_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 2.2;
controls.maxDistance = 28.0;

const hemiLight = new THREE.HemisphereLight(0xfff8ed, 0x8f7e6a, 1.45);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfff3de, 2.75);
keyLight.position.set(-5.5, 7.8, 5.2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1.0;
keyLight.shadow.camera.far = 24.0;
const sc = 4.2;
keyLight.shadow.camera.left = -sc;
keyLight.shadow.camera.right = sc;
keyLight.shadow.camera.top = sc;
keyLight.shadow.camera.bottom = -sc;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xdce8f2, 1.15);
rimLight.position.set(5.0, 4.5, -5.0);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xf7e7cf, 0.90);
fillLight.position.set(-3.0, 2.2, -4.5);
scene.add(fillLight);

const interiorGlow = new THREE.PointLight(0xffa845, 2.2, 3.8, 1.5);
interiorGlow.position.set(0.0, 2.05, -0.15);
scene.add(interiorGlow);

const { patchMesh: cobblePatch, mapTex: roadMapTex, bumpTex: roadBumpTex } = createFeatheredCobblestonePatch();
const turntableGroup = new THREE.Group();
scene.add(turntableGroup);
turntableGroup.add(cobblePatch);

const roadStones = buildRoadStones(turntableGroup);

const frontLanternGlow = new THREE.PointLight(0xffad42, 1.85, 3.2, 1.6);
frontLanternGlow.position.set(0.0, 2.06, 1.38);
turntableGroup.add(frontLanternGlow);

const rearLanternGlow = new THREE.PointLight(0xffad42, 1.85, 3.2, 1.6);
rearLanternGlow.position.set(0.0, 2.06, -1.88);
turntableGroup.add(rearLanternGlow);

const lights = { interiorGlow, frontLanternGlow, rearLanternGlow };

// =========================================================================
// 3. UI ELEMENT REFERENCES & BESPOKE CUSTOMIZATION BINDINGS
// =========================================================================
const atelierDock = document.getElementById('atelier-dock');
const btnToggleAtelier = document.getElementById('btn-toggle-atelier');
const btnDockCollapse = document.getElementById('btn-dock-collapse');
const atelierDockHeaderToggle = document.getElementById('atelier-dock-header-toggle');
const atelierSummaryText = document.getElementById('atelier-summary-text');

const sliderWidth = document.getElementById('slider-dim-width');
const sliderHeight = document.getElementById('slider-dim-height');
const sliderLength = document.getElementById('slider-dim-length');
const sliderRoofCrown = document.getElementById('slider-roof-crown');
const sliderRideHeight = document.getElementById('slider-ride-height');
const sliderCabinScale = document.getElementById('slider-cabin-scale');

const sliderWheelFront = document.getElementById('slider-wheel-front');
const sliderWheelRear = document.getElementById('slider-wheel-rear');
const sliderWheelRim = document.getElementById('slider-wheel-rim');
const sliderWheelCamber = document.getElementById('slider-wheel-camber');
const sliderDriveSpeed = document.getElementById('slider-drive-speed');

const sliderWindowAngle = document.getElementById('slider-window-angle');
const sliderDoorAngle = document.getElementById('slider-door-angle');

const uiRefs = {
  valWidthBadge: document.getElementById('val-dim-width'),
  valHeightBadge: document.getElementById('val-dim-height'),
  valLengthBadge: document.getElementById('val-dim-length'),
  valRoofCrown: document.getElementById('val-roof-crown'),
  valRideHeight: document.getElementById('val-ride-height'),
  valCabinScale: document.getElementById('val-cabin-scale'),
  valWheelFront: document.getElementById('val-wheel-front'),
  valWheelRear: document.getElementById('val-wheel-rear'),
  valWheelRim: document.getElementById('val-wheel-rim'),
  valWheelCamber: document.getElementById('val-wheel-camber'),
  valDriveSpeed: document.getElementById('val-drive-speed'),
  valWindowAngle: document.getElementById('val-window-angle'),
  valDoorAngle: document.getElementById('val-door-angle'),
  elevMmWidth: document.getElementById('elev-mm-width'),
  elevMmHeight: document.getElementById('elev-mm-height'),
  elevMmLength: document.getElementById('elev-mm-length'),
  imgElevSide: document.getElementById('img-elev-side'),
  imgElevFront: document.getElementById('img-elev-front'),
  imgElevRear: document.getElementById('img-elev-rear')
};

function updateAtelierSummary() {
  if (!atelierSummaryText) return;
  const wMM = Math.round((BASE_WIDTH_MM * carriageConfig.widthScale) / 10) * 10;
  const hMM = Math.round((BASE_HEIGHT_MM * carriageConfig.heightScale * (0.78 + 0.22 * carriageConfig.roofCrownScale)) / 10) * 10;
  const lMM = Math.round((BASE_LENGTH_MM * carriageConfig.lengthScale) / 10) * 10;
  atelierSummaryText.innerHTML = `${carriageConfig.timberLabel} &bull; ${carriageConfig.wheelLabel} &bull; ${lMM} &times; ${wMM} &times; ${hMM} MM`;
}

function triggerSyncTransforms() {
  syncAllCarriageTransforms({
    uiRefs,
    lights,
    cobblePatch,
    roadStones,
    updateAtelierSummary
  });
}

// Load GLB Model
loadCarriageGLB(turntableGroup, loadingBanner, triggerSyncTransforms);

function selectFinishSwatch(grpName, val) {
  const pillGroup = document.querySelector(`.color-pills[data-group="${grpName}"]`);
  if (pillGroup) {
    pillGroup.querySelectorAll('.color-pill').forEach((p) => {
      const isMatch = p.dataset.val === val;
      p.classList.toggle('active', isMatch);
      if (isMatch && p.dataset.name) {
        const subEl = document.getElementById(`subval-${grpName}`);
        if (subEl) subEl.textContent = p.dataset.name;
        if (grpName === 'timber') carriageConfig.timberLabel = p.dataset.name;
      }
    });
  }
  applyCustomization(grpName, val, lights);
}

document.querySelectorAll('.color-pills').forEach((pillGroup) => {
  const grpName = pillGroup.dataset.group;
  pillGroup.querySelectorAll('.color-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      selectFinishSwatch(grpName, pill.dataset.val);
      document.querySelectorAll('#atelier-preset-grid .preset-chip').forEach((c) => c.classList.remove('active'));
      updateAtelierSummary();
    });
  });
});

// Floating Bottom Configurator Dock Toggle & Smart Tab Switching
function setAtelierDockCollapsed(collapsed) {
  if (!atelierDock) return;
  atelierDock.classList.toggle('collapsed', collapsed);
  if (btnToggleAtelier) btnToggleAtelier.classList.toggle('active', !collapsed);
  if (btnDockCollapse) btnDockCollapse.innerHTML = collapsed ? '&#9652; Expand' : '&#9662; Minimize';
  invalidateAnnotationRects();
}

if (btnToggleAtelier) {
  btnToggleAtelier.addEventListener('click', () => {
    setAtelierDockCollapsed(!atelierDock.classList.contains('collapsed'));
  });
}
if (btnDockCollapse) {
  btnDockCollapse.addEventListener('click', () => {
    setAtelierDockCollapsed(!atelierDock.classList.contains('collapsed'));
  });
}
if (atelierDockHeaderToggle) {
  atelierDockHeaderToggle.addEventListener('click', () => {
    setAtelierDockCollapsed(!atelierDock.classList.contains('collapsed'));
  });
}

document.querySelectorAll('.atelier-tab-btn').forEach((tabBtn) => {
  tabBtn.addEventListener('click', () => {
    const targetTab = tabBtn.dataset.tab;
    const isAlreadyActive = tabBtn.classList.contains('active');
    const isCollapsed = atelierDock.classList.contains('collapsed');

    if (!isCollapsed && isAlreadyActive) {
      setAtelierDockCollapsed(true);
      return;
    }

    document.querySelectorAll('.atelier-tab-btn').forEach((b) => b.classList.toggle('active', b === tabBtn));
    document.querySelectorAll('.atelier-tab-pane').forEach((pane) => {
      pane.classList.toggle('active', pane.dataset.pane === targetTab);
    });
    if (isCollapsed) {
      setAtelierDockCollapsed(false);
    }
  });
});

// Bind Proportions & Wheel Sliders (with Double-Click-to-Reset and Click-Badge-to-Reset)
const sliderPropMap = new Map();
const bindSlider = (el, propName) => {
  if (!el) return;
  sliderPropMap.set(el.id, { el, propName, defVal: parseFloat(el.dataset.default ?? el.value) });
  el.addEventListener('input', () => {
    carriageConfig[propName] = parseFloat(el.value);
    triggerSyncTransforms();
  });
  el.addEventListener('dblclick', () => {
    const def = parseFloat(el.dataset.default ?? '1.00');
    el.value = String(def);
    carriageConfig[propName] = def;
    triggerSyncTransforms();
  });
};

bindSlider(sliderWidth, 'widthScale');
bindSlider(sliderHeight, 'heightScale');
bindSlider(sliderLength, 'lengthScale');
bindSlider(sliderRoofCrown, 'roofCrownScale');
bindSlider(sliderRideHeight, 'rideHeightOffset');
bindSlider(sliderCabinScale, 'cabinScale');
bindSlider(sliderWheelFront, 'frontWheelScale');
bindSlider(sliderWheelRear, 'rearWheelScale');
bindSlider(sliderWheelRim, 'wheelRimScale');
bindSlider(sliderWheelCamber, 'wheelCamberDeg');
bindSlider(sliderDriveSpeed, 'driveSpeedMult');

// Click any value badge to reset its paired slider back to default
document.querySelectorAll('[data-reset-slider]').forEach((badge) => {
  badge.addEventListener('click', () => {
    const targetId = badge.dataset.resetSlider;
    if (targetId === 'slider-door-angle') {
      setDirectDoorMode('closed');
      return;
    }
    if (targetId === 'slider-window-angle') {
      setDirectWindowMode('closed');
      return;
    }
    const entry = sliderPropMap.get(targetId);
    if (entry) {
      entry.el.value = String(entry.defVal);
      carriageConfig[entry.propName] = entry.defVal;
      triggerSyncTransforms();
    }
  });
});

// Helper & Binding for Segmented Option Pills (wheel_style, medallions, chimney, lanterns_mode)
function selectSegmentedOption(segKey, val) {
  const segGroup = document.querySelector(`[data-seg="${segKey}"]`);
  if (segGroup) {
    segGroup.querySelectorAll('.seg-pill').forEach((b) => {
      const isMatch = b.dataset.val === val;
      b.classList.toggle('active', isMatch);
      if (isMatch && segKey === 'wheel_style') {
        carriageConfig.wheelLabel = b.textContent.trim();
      }
    });
  }
  if (segKey === 'wheel_style') carriageConfig.wheelStyle = val;
  else if (segKey === 'medallions') carriageConfig.medallionsMode = val;
  else if (segKey === 'chimney') carriageConfig.chimneyMode = val;
  else if (segKey === 'lanterns_mode') carriageConfig.lanternsMode = val;
}

document.querySelectorAll('[data-seg]').forEach((segGroup) => {
  const segKey = segGroup.dataset.seg;
  segGroup.querySelectorAll('.seg-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectSegmentedOption(segKey, btn.dataset.val);
      document.querySelectorAll('#atelier-preset-grid .preset-chip').forEach((c) => c.classList.remove('active'));
      triggerSyncTransforms();
    });
  });
});

// =========================================================================
// 4. INTERACTIVE CONTROLS: SELF-DRIVE, DOOR, WINDOW, LANTERNS, WIREFRAME, EXPLODED, PRESETS & RESET
// =========================================================================
let isDrivingOnRoad = true;
let isRotating = false;
let isWireframe = false;
let isDoorOpen = false;
let isWindowOpen = false;
let isLanternsLit = true;
let isExploded = false;

let targetDoorDeg = 0.0;
let targetWindowDeg = 0.0;
let currentDoorLeftRad = 0.0;
let currentDoorRightRad = 0.0;
let currentWinSideRad = 0.0;
let currentWinFrontRad = 0.0;
let currentWinRearRad = 0.0;
let currentExplodeT = 0.0;
let roadScrollDist = 0.0;
let bodyHeaveY = 0.0;
let bodyHeaveVel = 0.0;
let bodyPitch = 0.0;

const btnDriveRoad = document.getElementById('btn-drive-road');
const driveRoadLabel = document.getElementById('drive-road-label');
const btnRotate = document.getElementById('btn-rotate');
const btnWireframe = document.getElementById('btn-wireframe');
const btnDoor = document.getElementById('btn-door');
const btnWindow = document.getElementById('btn-window');
const btnLanterns = document.getElementById('btn-lanterns');
const btnExploded = document.getElementById('btn-exploded');
const btnResetCustom = document.getElementById('btn-reset-custom');
const btnDockReset = document.getElementById('btn-dock-reset');
const viewCards = document.querySelectorAll('.view-card');
const elevPlates = document.querySelectorAll('[data-elev-view]');
const swatchItems = document.querySelectorAll('.swatch-item');
const calloutItems = document.querySelectorAll('.callout-item');

// Direct One-Click Coach Door Mode (Closed | Left | Right | Both)
function setDirectDoorMode(mode, customAngle = null) {
  document.querySelectorAll('#seg-door-mode .seg-pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.dmode === mode);
  });
  if (mode === 'closed') {
    carriageConfig.activeDoors.left = true;
    carriageConfig.activeDoors.right = true;
    targetDoorDeg = 0.0;
    isDoorOpen = false;
  } else {
    carriageConfig.activeDoors.left = (mode === 'left' || mode === 'both');
    carriageConfig.activeDoors.right = (mode === 'right' || mode === 'both');
    targetDoorDeg = customAngle !== null ? customAngle : (targetDoorDeg > 5.0 ? targetDoorDeg : 85.0);
    isDoorOpen = true;
  }
  if (sliderDoorAngle) sliderDoorAngle.value = String(Math.round(targetDoorDeg));
  if (uiRefs.valDoorAngle) uiRefs.valDoorAngle.textContent = `${Math.round(targetDoorDeg)}°`;
  if (btnDoor) btnDoor.classList.toggle('active', isDoorOpen);
}

document.querySelectorAll('#seg-door-mode .seg-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    setDirectDoorMode(btn.dataset.dmode);
  });
});

if (sliderDoorAngle) {
  sliderDoorAngle.addEventListener('input', () => {
    targetDoorDeg = parseFloat(sliderDoorAngle.value);
    if (uiRefs.valDoorAngle) uiRefs.valDoorAngle.textContent = `${Math.round(targetDoorDeg)}°`;
    isDoorOpen = targetDoorDeg > 2.0;
    if (btnDoor) btnDoor.classList.toggle('active', isDoorOpen);
    if (!isDoorOpen) {
      document.querySelectorAll('#seg-door-mode .seg-pill').forEach((b) => {
        b.classList.toggle('active', b.dataset.dmode === 'closed');
      });
    } else {
      const activeBtn = document.querySelector('#seg-door-mode .seg-pill.active');
      if (!activeBtn || activeBtn.dataset.dmode === 'closed') {
        carriageConfig.activeDoors.left = true;
        carriageConfig.activeDoors.right = true;
        document.querySelectorAll('#seg-door-mode .seg-pill').forEach((b) => {
          b.classList.toggle('active', b.dataset.dmode === 'both');
        });
      }
    }
  });
}

// Direct One-Click Casement Window Mode (Closed | Doors | Front | Rear | All 5)
function setDirectWindowMode(mode, customAngle = null) {
  document.querySelectorAll('#seg-window-mode .seg-pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.wmode === mode);
  });
  if (mode === 'closed') {
    carriageConfig.activeWindows.side = true;
    carriageConfig.activeWindows.front = true;
    carriageConfig.activeWindows.rear = true;
    targetWindowDeg = 0.0;
    isWindowOpen = false;
  } else {
    carriageConfig.activeWindows.side = (mode === 'side' || mode === 'all');
    carriageConfig.activeWindows.front = (mode === 'front' || mode === 'all');
    carriageConfig.activeWindows.rear = (mode === 'rear' || mode === 'all');
    targetWindowDeg = customAngle !== null ? customAngle : (targetWindowDeg > 5.0 ? targetWindowDeg : 62.0);
    isWindowOpen = true;
  }
  if (sliderWindowAngle) sliderWindowAngle.value = String(Math.round(targetWindowDeg));
  if (uiRefs.valWindowAngle) uiRefs.valWindowAngle.textContent = `${Math.round(targetWindowDeg)}°`;
  if (btnWindow) btnWindow.classList.toggle('active', isWindowOpen);
}

document.querySelectorAll('#seg-window-mode .seg-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    setDirectWindowMode(btn.dataset.wmode);
  });
});

if (sliderWindowAngle) {
  sliderWindowAngle.addEventListener('input', () => {
    targetWindowDeg = parseFloat(sliderWindowAngle.value);
    if (uiRefs.valWindowAngle) uiRefs.valWindowAngle.textContent = `${Math.round(targetWindowDeg)}°`;
    isWindowOpen = targetWindowDeg > 2.0;
    if (btnWindow) btnWindow.classList.toggle('active', isWindowOpen);
    if (!isWindowOpen) {
      document.querySelectorAll('#seg-window-mode .seg-pill').forEach((b) => {
        b.classList.toggle('active', b.dataset.wmode === 'closed');
      });
    } else {
      const activeBtn = document.querySelector('#seg-window-mode .seg-pill.active');
      if (!activeBtn || activeBtn.dataset.wmode === 'closed') {
        carriageConfig.activeWindows.side = true;
        carriageConfig.activeWindows.front = true;
        carriageConfig.activeWindows.rear = true;
        document.querySelectorAll('#seg-window-mode .seg-pill').forEach((b) => {
          b.classList.toggle('active', b.dataset.wmode === 'all');
        });
      }
    }
  });
}

// One-Click Curated Designer Themes in the Left Sidebar ("Bespoke Atelier")
document.querySelectorAll('#atelier-preset-grid .preset-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const presetKey = chip.dataset.preset;
    const theme = curatedThemes[presetKey];
    if (!theme) return;

    document.querySelectorAll('#atelier-preset-grid .preset-chip').forEach((c) => c.classList.toggle('active', c === chip));

    Object.entries(theme.finishes).forEach(([grp, val]) => selectFinishSwatch(grp, val));
    Object.entries(theme.segs).forEach(([seg, val]) => selectSegmentedOption(seg, val));
    Object.entries(theme.dims).forEach(([prop, val]) => {
      carriageConfig[prop] = val;
    });

    if (sliderWidth) sliderWidth.value = String(carriageConfig.widthScale);
    if (sliderHeight) sliderHeight.value = String(carriageConfig.heightScale);
    if (sliderLength) sliderLength.value = String(carriageConfig.lengthScale);
    if (sliderRoofCrown) sliderRoofCrown.value = String(carriageConfig.roofCrownScale);
    if (sliderCabinScale) sliderCabinScale.value = String(carriageConfig.cabinScale);
    if (sliderRideHeight) sliderRideHeight.value = String(carriageConfig.rideHeightOffset);
    if (sliderWheelFront) sliderWheelFront.value = String(carriageConfig.frontWheelScale);
    if (sliderWheelRear) sliderWheelRear.value = String(carriageConfig.rearWheelScale);
    if (sliderWheelRim) sliderWheelRim.value = String(carriageConfig.wheelRimScale);
    if (sliderWheelCamber) sliderWheelCamber.value = String(carriageConfig.wheelCamberDeg);

    triggerSyncTransforms();
  });
});

let camTween = null;
function animateCameraTo(posVec, targetVec, resetTurntable = true) {
  camTween = {
    startPos: camera.position.clone(),
    endPos: posVec.clone(),
    startTarget: controls.target.clone(),
    endTarget: targetVec.clone(),
    resetYaw: resetTurntable,
    startYaw: turntableGroup.rotation.y,
    t: 0
  };
}

let currentViewMode = 'iso';

function getFittedPreset(mode) {
  const spec = viewSpecMap[mode] || viewSpecMap.iso;
  const maxDim = Math.max(
    1.0,
    carriageConfig.widthScale * 0.96,
    carriageConfig.heightScale * 0.96,
    carriageConfig.lengthScale * 0.96
  );
  const expFactor = (isExploded ? 1.24 : 1.0) * maxDim;
  const scaledTarget = spec.target.clone();
  scaledTarget.y *= (0.5 + 0.5 * carriageConfig.heightScale);
  return {
    pos: computeFittedCameraPos(spec.dir, scaledTarget, spec.reqW, spec.reqH, expFactor),
    target: scaledTarget
  };
}

function setViewMode(mode, instant = false) {
  currentViewMode = mode;
  viewCards.forEach((c) => c.classList.toggle('active', c.dataset.view === mode));
  updateViewModeThumbnails(mode);
  const preset = getFittedPreset(mode);
  isRotating = false;
  btnRotate.classList.remove('active');
  if (instant) {
    camera.position.copy(preset.pos);
    controls.target.copy(preset.target);
    controls.update();
  } else {
    animateCameraTo(preset.pos, preset.target, true);
  }
}

btnDriveRoad.addEventListener('click', () => {
  isDrivingOnRoad = !isDrivingOnRoad;
  btnDriveRoad.classList.toggle('active', isDrivingOnRoad);
  driveRoadLabel.textContent = isDrivingOnRoad ? 'Drive On Road: Active' : 'Drive On Road: Paused';
});

btnRotate.addEventListener('click', () => {
  isRotating = !isRotating;
  btnRotate.classList.toggle('active', isRotating);
});

btnWireframe.addEventListener('click', () => {
  isWireframe = !isWireframe;
  btnWireframe.classList.toggle('active', isWireframe);
  allCarriageMeshes.forEach((m) => {
    if (m.material) m.material.wireframe = isWireframe;
  });
});

btnDoor.addEventListener('click', () => {
  setDirectDoorMode(isDoorOpen ? 'closed' : 'both');
});

btnWindow.addEventListener('click', () => {
  setDirectWindowMode(isWindowOpen ? 'closed' : 'all');
});

btnLanterns.addEventListener('click', () => {
  isLanternsLit = !isLanternsLit;
  btnLanterns.classList.toggle('active', isLanternsLit);
  for (const lg of lanternGlassMeshes) {
    if (lg.material) {
      lg.material.emissiveIntensity = isLanternsLit ? 0.75 : 0.0;
    }
  }
});

btnExploded.addEventListener('click', () => {
  isExploded = !isExploded;
  btnExploded.classList.toggle('active', isExploded);
  const preset = getFittedPreset(currentViewMode);
  animateCameraTo(preset.pos, preset.target, false);
});

function resetAllCarriageCustomizations() {
  ['timber', 'wheels', 'metal', 'skulls', 'glass_tint', 'upholstery'].forEach((grp) => {
    selectFinishSwatch(grp, 'default');
  });

  document.querySelectorAll('#atelier-preset-grid .preset-chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.preset === 'heritage');
  });

  Object.assign(carriageConfig, structuredClone(DEFAULT_CARRIAGE_CONFIG));

  if (sliderWidth) sliderWidth.value = '1.00';
  if (sliderHeight) sliderHeight.value = '1.00';
  if (sliderLength) sliderLength.value = '1.00';
  if (sliderRoofCrown) sliderRoofCrown.value = '1.00';
  if (sliderRideHeight) sliderRideHeight.value = '0.00';
  if (sliderCabinScale) sliderCabinScale.value = '1.00';
  if (sliderWheelFront) sliderWheelFront.value = '1.00';
  if (sliderWheelRear) sliderWheelRear.value = '1.00';
  if (sliderWheelRim) sliderWheelRim.value = '1.00';
  if (sliderWheelCamber) sliderWheelCamber.value = '0';
  if (sliderDriveSpeed) sliderDriveSpeed.value = '1.00';

  ['wheel_style', 'medallions', 'chimney', 'lanterns_mode'].forEach((segKey) => {
    const firstPill = document.querySelector(`[data-seg="${segKey}"] .seg-pill`);
    if (firstPill) selectSegmentedOption(segKey, firstPill.dataset.val);
  });

  setDirectDoorMode('closed');
  setDirectWindowMode('closed');
  triggerSyncTransforms();

  isLanternsLit = true;
  btnLanterns.classList.add('active');
  for (const lg of lanternGlassMeshes) {
    if (lg.material) lg.material.emissiveIntensity = 0.75;
  }

  isExploded = false;
  btnExploded.classList.remove('active');

  isWireframe = false;
  btnWireframe.classList.remove('active');
  allCarriageMeshes.forEach((m) => {
    if (m.material) m.material.wireframe = false;
  });

  isDrivingOnRoad = true;
  btnDriveRoad.classList.add('active');
  driveRoadLabel.textContent = 'Drive On Road: Active';

  swatchItems.forEach((s) => s.classList.remove('active'));
  calloutItems.forEach((c) => c.classList.remove('active'));

  setViewMode('iso');
}

if (btnResetCustom) btnResetCustom.addEventListener('click', resetAllCarriageCustomizations);
if (btnDockReset) btnDockReset.addEventListener('click', resetAllCarriageCustomizations);

viewCards.forEach((card) => {
  card.addEventListener('click', () => setViewMode(card.dataset.view));
});

elevPlates.forEach((plate) => {
  plate.addEventListener('click', () => setViewMode(plate.dataset.elevView));
});

function focusOnDetailKey(key) {
  const sp = detailFocusSpecs[key];
  if (!sp) return;
  const scaledTarget = new THREE.Vector3(
    sp.target.x * carriageConfig.widthScale,
    sp.target.y * carriageConfig.heightScale,
    sp.target.z * carriageConfig.lengthScale
  );
  const maxS = Math.max(1.0, carriageConfig.widthScale, carriageConfig.heightScale, carriageConfig.lengthScale);
  const pos = computeFittedCameraPos(sp.dir, scaledTarget, sp.reqW, sp.reqH, maxS);
  animateCameraTo(pos, scaledTarget, true);
}

swatchItems.forEach((item) => {
  item.addEventListener('click', () => {
    const key = item.dataset.swatch;
    const already = item.classList.contains('active');
    swatchItems.forEach((s) => s.classList.remove('active'));
    if (already) {
      setViewMode('iso');
    } else {
      item.classList.add('active');
      focusOnDetailKey(key);
    }
  });
});

calloutItems.forEach((item) => {
  item.addEventListener('click', () => {
    const key = item.dataset.callout;
    const already = item.classList.contains('active');
    calloutItems.forEach((c) => c.classList.remove('active'));
    if (already) {
      setViewMode('iso');
    } else {
      item.classList.add('active');
      focusOnDetailKey(key);
    }
  });
});

// Direct 3D raycast click on carriage doors or windows to open/close them
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPt = { x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => {
  downPt = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y) > 5) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  if (interactiveWindowMeshes.length > 0) {
    const winHits = raycaster.intersectObjects(interactiveWindowMeshes, false);
    if (winHits.length > 0) {
      btnWindow.click();
      return;
    }
  }

  if (interactiveDoorMeshes.length > 0) {
    const doorHits = raycaster.intersectObjects(interactiveDoorMeshes, false);
    if (doorHits.length > 0) {
      btnDoor.click();
    }
  }
});

// =========================================================================
// 5. ZERO-ALLOCATION DYNAMIC 3D-TO-2D ARCHITECTURAL CALLOUT LEADERS
// =========================================================================
const svgLeadersLayer = document.getElementById('svg-leaders-layer');
const SVG_NS = 'http://www.w3.org/2000/svg';
const CALLOUT_IDS = ['1', '2', '3', '4'];

// Pre-create reusable SVG nodes once (zero innerHTML parsing in the 60fps loop)
const leaderNodes = {};
for (const id of CALLOUT_IDS) {
  const polyline = document.createElementNS(SVG_NS, 'polyline');
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', '#4a3f36');
  polyline.setAttribute('stroke-width', '0.95');
  svgLeadersLayer.appendChild(polyline);

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('r', '2.6');
  circle.setAttribute('fill', '#e8dfd1');
  circle.setAttribute('stroke', '#2a221d');
  circle.setAttribute('stroke-width', '1.2');
  svgLeadersLayer.appendChild(circle);

  leaderNodes[id] = {
    el: document.getElementById(`callout-${id}`),
    polyline,
    circle,
    lastPoints: '',
    rect: null
  };
}

let cachedStageRect = null;
let cachedCanvasRect = null;
let rectsDirty = true;

function invalidateAnnotationRects() {
  rectsDirty = true;
}

function refreshAnnotationRects() {
  cachedStageRect = centerStage.getBoundingClientRect();
  cachedCanvasRect = canvas.getBoundingClientRect();
  for (const id of CALLOUT_IDS) {
    const node = leaderNodes[id];
    if (node.el) node.rect = node.el.getBoundingClientRect();
  }
  rectsDirty = false;
}

const _projVec = new THREE.Vector3();
const _projOut = { x: 0, y: 0 };

function project3DToStage(localVec, stageRect, canvasRect) {
  _projVec.copy(localVec).applyMatrix4(turntableGroup.matrixWorld).project(camera);
  _projOut.x = (_projVec.x * 0.5 + 0.5) * canvasRect.width + (canvasRect.left - stageRect.left);
  _projOut.y = (-_projVec.y * 0.5 + 0.5) * canvasRect.height + (canvasRect.top - stageRect.top);
  return _projOut;
}

function updateSVGAnnotations() {
  if (rectsDirty || !cachedStageRect || !cachedCanvasRect) {
    refreshAnnotationRects();
  }
  if (cachedStageRect.width === 0 || cachedCanvasRect.width === 0) return;

  for (const id of CALLOUT_IDS) {
    const node = leaderNodes[id];
    const r = node.rect;
    if (!r) continue;

    const p3d = project3DToStage(calloutAnchors3D[id], cachedStageRect, cachedCanvasRect);
    let sx, sy, kx, ky;
    if (id === '1' || id === '2') {
      sx = r.right - cachedStageRect.left - 6;
      sy = r.top - cachedStageRect.top + 14;
      kx = sx + 22;
      ky = sy;
    } else {
      sx = r.left - cachedStageRect.left - 6;
      sy = r.top - cachedStageRect.top + 11;
      kx = sx - 24;
      ky = p3d.y;
    }

    const pxStr = p3d.x.toFixed(1);
    const pyStr = p3d.y.toFixed(1);
    const ptsStr = `${sx.toFixed(1)},${sy.toFixed(1)} ${kx.toFixed(1)},${ky.toFixed(1)} ${pxStr},${pyStr}`;
    if (ptsStr !== node.lastPoints) {
      node.lastPoints = ptsStr;
      node.polyline.setAttribute('points', ptsStr);
      node.circle.setAttribute('cx', pxStr);
      node.circle.setAttribute('cy', pyStr);
    }
  }
}

// =========================================================================
// 6. RESIZE HANDLER & MAIN SELF-DRIVING / SUSPENSION / RENDER LOOP
// =========================================================================
function handleResize() {
  const rect = canvasWrap.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height);
  invalidateAnnotationRects();
  const preset = getFittedPreset(currentViewMode);
  camera.position.copy(preset.pos);
  controls.target.copy(preset.target);
  controls.update();
}
window.addEventListener('resize', handleResize);
window.addEventListener('scroll', invalidateAnnotationRects, { passive: true });
handleResize();

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  // 1. Smooth Camera Tweening
  if (camTween) {
    camTween.t = Math.min(1.0, camTween.t + dt * 2.6);
    const ease = 1.0 - Math.pow(1.0 - camTween.t, 3);
    camera.position.lerpVectors(camTween.startPos, camTween.endPos, ease);
    controls.target.lerpVectors(camTween.startTarget, camTween.endTarget, ease);
    if (camTween.resetYaw) {
      turntableGroup.rotation.y = camTween.startYaw * (1.0 - ease);
    }
    if (camTween.t >= 1.0) camTween = null;
  }

  // 2. Rotate 360 Turntable Mode
  if (isRotating) {
    turntableGroup.rotation.y += dt * 0.30;
  }

  // 3. Autonomous Self-Driving on the Feathered Cobblestone Road Patch
  const speedMult = carriageConfig.driveSpeedMult;
  const currentSpeed = isDrivingOnRoad ? (BASE_DRIVE_SPEED * speedMult) : 0.0;
  if (currentSpeed > 0.001) {
    roadScrollDist += currentSpeed * dt;
    const uvOffset = roadScrollDist / (PATCH_LENGTH * carriageConfig.lengthScale);
    roadMapTex.offset.y = uvOffset;
    roadBumpTex.offset.y = uvOffset;

    const halfRoadSpan = 2.55 * carriageConfig.lengthScale;
    for (const st of roadStones) {
      st.z -= currentSpeed * dt;
      if (st.z < -halfRoadSpan) {
        st.z += halfRoadSpan * 2.0;
      }
      st.mesh.position.set(st.x, 0.005, st.z);
      const edgeDist = Math.max(0, halfRoadSpan - 0.10 - Math.abs(st.z));
      st.mesh.material.opacity = Math.min(1.0, edgeDist * 2.2);
    }
  }

  // 4. Compute 4-Wheel Independent Stone Climb, Spoked Wheel Spin & Fifth-Wheel Micro-Steer
  const steerWeave = (isDrivingOnRoad && currentSpeed > 0.01) ? Math.sin(elapsed * 1.15 * Math.max(0.5, speedMult)) * 0.055 : 0.0;
  const bounceScale = Math.max(0.4, Math.min(1.8, speedMult));
  for (const key of ['FL', 'FR', 'RL', 'RR']) {
    const w = wheelRig[key];
    w.angle += (currentSpeed / w.radius) * dt;

    let targetLift = 0.0;
    for (const st of roadStones) {
      if (Math.abs(st.x - w.restPos.x) < 0.28) {
        const dz = Math.abs(st.z - w.restPos.z);
        const span = st.radius + 0.20 * carriageConfig.heightScale;
        if (dz < span) {
          const q = 1.0 - (dz / span) * (dz / span);
          targetLift = Math.max(targetLift, st.height * bounceScale * q * Math.sqrt(q));
        }
      }
    }
    if (isDrivingOnRoad && currentSpeed > 0.01) {
      targetLift += Math.abs(Math.sin(roadScrollDist * 9.0 + w.restPos.z * 3.0)) * 0.004 * bounceScale;
    }
    w.lift += (targetLift - w.lift) * Math.min(1.0, dt * 18.0);
  }

  // 5. Damped Leaf-Spring Cabin Suspension & Pitch Response
  const frontLift = 0.5 * (wheelRig.FL.lift + wheelRig.FR.lift);
  const rearLift = 0.5 * (wheelRig.RL.lift + wheelRig.RR.lift);
  const avgWheelLift = 0.5 * (frontLift + rearLift);

  const springForce = (avgWheelLift * 0.75 - bodyHeaveY) * 110.0 - bodyHeaveVel * 13.0;
  bodyHeaveVel += springForce * dt;
  bodyHeaveY += bodyHeaveVel * dt;

  const dynamicPitch = Math.atan2(rearLift - frontLift, 2.67 * carriageConfig.lengthScale) * 0.65;
  bodyPitch += (dynamicPitch - bodyPitch) * Math.min(1.0, dt * 10.0);

  // 6. Selective Door Swing, Selective 5-Window Swing & Exploded View Interpolation
  const fullDoorRad = THREE.MathUtils.degToRad(targetDoorDeg);
  const tgtDoorL = carriageConfig.activeDoors.left ? fullDoorRad : 0.0;
  const tgtDoorR = carriageConfig.activeDoors.right ? fullDoorRad : 0.0;
  currentDoorLeftRad += (tgtDoorL - currentDoorLeftRad) * Math.min(1.0, dt * 6.5);
  currentDoorRightRad += (tgtDoorR - currentDoorRightRad) * Math.min(1.0, dt * 6.5);

  const fullWinRad = THREE.MathUtils.degToRad(targetWindowDeg);
  const tgtWinSide = carriageConfig.activeWindows.side ? fullWinRad : 0.0;
  const tgtWinFront = carriageConfig.activeWindows.front ? fullWinRad : 0.0;
  const tgtWinRear = carriageConfig.activeWindows.rear ? fullWinRad : 0.0;
  currentWinSideRad += (tgtWinSide - currentWinSideRad) * Math.min(1.0, dt * 6.5);
  currentWinFrontRad += (tgtWinFront - currentWinFrontRad) * Math.min(1.0, dt * 6.5);
  currentWinRearRad += (tgtWinRear - currentWinRearRad) * Math.min(1.0, dt * 6.5);

  const targetExplode = isExploded ? 1.0 : 0.0;
  currentExplodeT += (targetExplode - currentExplodeT) * Math.min(1.0, dt * 5.5);

  // Warm Victorian Oil-Lamp Flicker for the Exterior Coach Lanterns & Interior Parlour Lamp
  const lMode = carriageConfig.lanternsMode;
  if (isLanternsLit) {
    const flicker = 1.0 + 0.08 * Math.sin(elapsed * 7.3) + 0.05 * Math.cos(elapsed * 13.7);
    const baseInt = lanternLightState.baseIntensity;
    interiorGlow.intensity = baseInt * flicker;
    frontLanternGlow.intensity = (lMode === 'all' || lMode === 'front') ? (baseInt * 0.85 * flicker) : 0.0;
    rearLanternGlow.intensity = (lMode === 'all') ? (baseInt * 0.85 * flicker) : 0.0;
  } else {
    interiorGlow.intensity = 0.0;
    frontLanternGlow.intensity = 0.0;
    rearLanternGlow.intensity = 0.0;
  }

  // Apply transforms to Wheels (including Outward Victorian Wheel Camber)
  const camberRad = THREE.MathUtils.degToRad(carriageConfig.wheelCamberDeg);
  for (const key of ['FL', 'FR', 'RL', 'RR']) {
    const w = wheelRig[key];
    const yaw = w.isFront ? steerWeave : 0.0;
    const zTilt = -w.side * camberRad;
    for (const m of w.meshes) {
      m.position
        .copy(m.userData.restPosition)
        .addScaledVector(m.userData.explodeVec, currentExplodeT);
      m.position.y += w.lift;
      m.rotation.x = w.angle;
      m.rotation.y = yaw;
      m.rotation.z = zTilt;
    }
  }

  // Apply transforms to Undercarriage
  const stancePitch = kinematicState.stancePitchRad * 0.85;
  for (const m of undercarriageMeshes) {
    m.position
      .copy(m.userData.restPosition)
      .addScaledVector(m.userData.explodeVec, currentExplodeT);
    m.rotation.x = m.userData.restRotation.x + stancePitch;
  }

  // Apply transforms to Sprung Cabin Body, Roof, Chimney, Interior, Lanterns & Hinged Doors/Windows
  const totalBodyPitch = stancePitch + bodyPitch;
  for (const m of sprungBodyMeshes) {
    m.position
      .copy(m.userData.restPosition)
      .addScaledVector(m.userData.explodeVec, currentExplodeT);
    m.position.y += bodyHeaveY;
    if (!m.name.startsWith('Window_Front_')) {
      m.rotation.x = m.userData.restRotation.x + totalBodyPitch;
    }
  }

  for (const m of leftDoorMeshes) {
    m.rotation.y = m.userData.restRotation.y - currentDoorLeftRad;
  }
  for (const m of rightDoorMeshes) {
    m.rotation.y = m.userData.restRotation.y + currentDoorRightRad;
  }

  // Upper Pointed Gothic Arch Door Casement Windows (orbit with their door hinge + swing on their own sash hinge)
  for (const m of leftDoorWindowMeshes) {
    const doorYaw = -currentDoorLeftRad;
    if (m.userData.doorRestHinge) {
      const dh = m.userData.doorRestHinge;
      const dx = m.userData.restPosition.x - dh.x;
      const dz = m.userData.restPosition.z - dh.z;
      const cosD = Math.cos(doorYaw);
      const sinD = Math.sin(doorYaw);
      m.position.x = dh.x + dx * cosD + dz * sinD + m.userData.explodeVec.x * currentExplodeT;
      m.position.z = dh.z - dx * sinD + dz * cosD + m.userData.explodeVec.z * currentExplodeT;
    }
    m.rotation.y = m.userData.restRotation.y + doorYaw - currentWinSideRad * 0.95;
  }
  for (const m of rightDoorWindowMeshes) {
    const doorYaw = currentDoorRightRad;
    if (m.userData.doorRestHinge) {
      const dh = m.userData.doorRestHinge;
      const dx = m.userData.restPosition.x - dh.x;
      const dz = m.userData.restPosition.z - dh.z;
      const cosD = Math.cos(doorYaw);
      const sinD = Math.sin(doorYaw);
      m.position.x = dh.x + dx * cosD + dz * sinD + m.userData.explodeVec.x * currentExplodeT;
      m.position.z = dh.z - dx * sinD + dz * cosD + m.userData.explodeVec.z * currentExplodeT;
    }
    m.rotation.y = m.userData.restRotation.y + doorYaw + currentWinSideRad * 0.95;
  }

  // Front Balcony Top-Hinged Gothic Awning Window (tilts outward over the front balustrade)
  for (const m of frontWindowMeshes) {
    m.rotation.x = m.userData.restRotation.x + totalBodyPitch - currentWinFrontRad * 0.85;
  }

  // Twin Rear French Casement Windows (swing outward from center mullion)
  for (const m of rearLeftWindowMeshes) {
    m.rotation.y = m.userData.restRotation.y + currentWinRearRad;
  }
  for (const m of rearRightWindowMeshes) {
    m.rotation.y = m.userData.restRotation.y - currentWinRearRad;
  }

  controls.update();
  turntableGroup.updateMatrixWorld();
  updateSVGAnnotations();
  perfMonitor.beginRender();
  renderer.render(scene, camera);
  perfMonitor.endFrame();
}

const perfMonitor = initPerfMonitor(renderer, scene, camera);
animate();
