import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
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
  frontLanternMeshes,
  rearLanternMeshes,
  lanternGlassMeshes,
  roofMeshes,
  chimneyMeshes,
  sprungBodyMeshes,
  undercarriageMeshes,
  allCarriageMeshes,
  lanternLightState,
  loadCarriageGLB,
  exportJogloToGLB,
  applyCustomization
} from './carriageModel.js';
import { syncAllCarriageTransforms } from './kinematics.js';
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
// 2. THREE.JS SCENE, JAVANESE HERITAGE LIGHTING & PELATARAN COURTYARD
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

const camera = new THREE.PerspectiveCamera(34, 1, 0.25, 55);

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
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 2.0;
controls.maxDistance = 32.0;

const hemiLight = new THREE.HemisphereLight(0xfff7e8, 0x8c7965, 1.50);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfff2dc, 2.80);
keyLight.position.set(-6.0, 8.8, 6.2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1.0;
keyLight.shadow.camera.far = 28.0;
const sc = 4.8;
keyLight.shadow.camera.left = -sc;
keyLight.shadow.camera.right = sc;
keyLight.shadow.camera.top = sc;
keyLight.shadow.camera.bottom = -sc;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xdce8f2, 1.15);
rimLight.position.set(5.5, 5.0, -5.5);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xf7e6cc, 0.95);
fillLight.position.set(-3.5, 2.0, 4.8);
scene.add(fillLight);

// Dalem Agung / Krobongan Sanctuary Glow
const interiorGlow = new THREE.PointLight(0xffaa42, 2.5, 4.5, 1.4);
interiorGlow.position.set(0.0, 1.55, -1.35);
scene.add(interiorGlow);

const { patchMesh: cobblePatch } = createFeatheredCobblestonePatch();
const turntableGroup = new THREE.Group();
scene.add(turntableGroup);
turntableGroup.add(cobblePatch);

const roadStones = buildRoadStones(turntableGroup);

// Pendopo Central Lampu Robyong Chandelier Glow
const frontLanternGlow = new THREE.PointLight(0xffb248, 2.4, 5.2, 1.4);
frontLanternGlow.position.set(0.0, 2.05, 0.35);
turntableGroup.add(frontLanternGlow);

// Rear Sanctuary & Eaves Glow
const rearLanternGlow = new THREE.PointLight(0xffb248, 1.85, 4.2, 1.5);
rearLanternGlow.position.set(0.0, 1.80, -1.65);
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
  const wMM = Math.round((BASE_WIDTH_MM * carriageConfig.widthScale * (0.85 + 0.15 * carriageConfig.cabinScale)) / 10) * 10;
  const hMM = Math.round((BASE_HEIGHT_MM * (carriageConfig.heightScale * (0.72 + 0.28 * carriageConfig.roofCrownScale) + carriageConfig.rideHeightOffset / 3.8)) / 10) * 10;
  const lMM = Math.round((BASE_LENGTH_MM * carriageConfig.lengthScale * (0.85 + 0.15 * carriageConfig.cabinScale)) / 10) * 10;
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

// Build / Load Rumah Joglo 3D Model
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

// Bind Proportions & Structural Sliders
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
// 4. INTERACTIVE CONTROLS: ROOF CUTAWAY (TUMPANG SARI), DOORS, WINDOWS, LANTERNS, WIREFRAME, EXPLODED, EXPORT GLB
// =========================================================================
let isRoofCutaway = false;
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
let currentCutawayT = 0.0;

const btnDriveRoad = document.getElementById('btn-drive-road');
const driveRoadLabel = document.getElementById('drive-road-label');
const btnRotate = document.getElementById('btn-rotate');
const btnWireframe = document.getElementById('btn-wireframe');
const btnDoor = document.getElementById('btn-door');
const btnWindow = document.getElementById('btn-window');
const btnLanterns = document.getElementById('btn-lanterns');
const btnExploded = document.getElementById('btn-exploded');
const btnExportGlb = document.getElementById('btn-export-glb');
const btnResetCustom = document.getElementById('btn-reset-custom');
const btnDockReset = document.getElementById('btn-dock-reset');
const viewCards = document.querySelectorAll('.view-card');
const elevPlates = document.querySelectorAll('[data-elev-view]');
const swatchItems = document.querySelectorAll('.swatch-item');
const calloutItems = document.querySelectorAll('.callout-item');

// Direct One-Click Kori Agung Door Mode (Closed | Left | Right | Both)
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

// Direct One-Click Krepyak Window Mode (Closed | Gebyok | Transom | Dalem | All 5)
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
    targetWindowDeg = customAngle !== null ? customAngle : (targetWindowDeg > 5.0 ? targetWindowDeg : 60.0);
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

// One-Click Curated Javanese Architectural Themes
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

// Top Full-Width Toggle: Roof Cutaway (Inspect Tumpang Sari Ceiling)
function setRoofCutawayMode(active) {
  isRoofCutaway = active;
  if (btnDriveRoad) btnDriveRoad.classList.toggle('active', isRoofCutaway);
  if (driveRoadLabel) {
    driveRoadLabel.textContent = isRoofCutaway
      ? 'Tumpang Sari Cutaway: Active'
      : 'Inspect Tumpang Sari Ceiling';
  }
  for (const rm of [...roofMeshes, ...chimneyMeshes]) {
    if (rm.material) {
      rm.material.transparent = isRoofCutaway;
      rm.material.opacity = isRoofCutaway ? 0.22 : 1.0;
      rm.material.depthWrite = !isRoofCutaway;
      rm.material.needsUpdate = true;
    }
  }
}

if (btnDriveRoad) {
  btnDriveRoad.addEventListener('click', () => {
    setRoofCutawayMode(!isRoofCutaway);
  });
}

if (btnExportGlb) {
  btnExportGlb.addEventListener('click', () => {
    exportJogloToGLB('rumah_joglo_rj001.glb');
  });
}

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
      lg.material.emissiveIntensity = isLanternsLit ? 0.85 : 0.0;
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
  setRoofCutawayMode(false);
  triggerSyncTransforms();

  isLanternsLit = true;
  btnLanterns.classList.add('active');
  for (const lg of lanternGlassMeshes) {
    if (lg.material) lg.material.emissiveIntensity = 0.85;
  }

  isExploded = false;
  btnExploded.classList.remove('active');

  isWireframe = false;
  btnWireframe.classList.remove('active');
  allCarriageMeshes.forEach((m) => {
    if (m.material) m.material.wireframe = false;
  });

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
      if (key === 'glass' && !isRoofCutaway) {
        setRoofCutawayMode(true);
      }
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

// Direct 3D raycast click on Gebyok doors or Krepyak windows to open/close them
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
// 6. RESIZE HANDLER & MAIN RENDER / ANIMATION LOOP
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

  // 3. Selective Kori Agung Door Swing, Selective 5-Window Swing, Cutaway & Exploded View Interpolation
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

  const targetCutaway = isRoofCutaway ? 1.0 : 0.0;
  currentCutawayT += (targetCutaway - currentCutawayT) * Math.min(1.0, dt * 5.5);

  // 4. Warm Javanese Oil-Lamp / Robyong Chandelier Flicker & Gentle Tropical Breeze Sway
  const lMode = carriageConfig.lanternsMode;
  const breezeMult = carriageConfig.driveSpeedMult * BASE_DRIVE_SPEED;
  const lanternSwayZ = Math.sin(elapsed * 1.8 * Math.max(0.2, breezeMult)) * 0.025 * breezeMult;

  if (isLanternsLit) {
    const flicker = 1.0 + 0.06 * Math.sin(elapsed * 6.5 * Math.max(0.4, breezeMult)) + 0.04 * Math.cos(elapsed * 11.3);
    const baseInt = lanternLightState.baseIntensity;
    interiorGlow.intensity = baseInt * flicker;
    frontLanternGlow.intensity = (lMode === 'all' || lMode === 'front') ? (baseInt * 0.95 * flicker) : 0.0;
    rearLanternGlow.intensity = (lMode === 'all') ? (baseInt * 0.80 * flicker) : 0.0;
  } else {
    interiorGlow.intensity = 0.0;
    frontLanternGlow.intensity = 0.0;
    rearLanternGlow.intensity = 0.0;
  }

  // 5. Apply Transforms to 4 Master Umpak Soko Guru Pedestals
  for (const key of ['FL', 'FR', 'RL', 'RR']) {
    const w = wheelRig[key];
    for (const m of w.meshes) {
      m.position
        .copy(m.userData.restPosition)
        .addScaledVector(m.userData.explodeVec, currentExplodeT);
    }
  }

  // 6. Apply Transforms to Undak-Undakan Stone Plinth
  for (const m of undercarriageMeshes) {
    m.position
      .copy(m.userData.restPosition)
      .addScaledVector(m.userData.explodeVec, currentExplodeT);
  }

  // 7. Apply Transforms to Sprung Joglo Pavilion, Roof, Tumpang Sari, Lanterns & Hinged Doors/Windows
  for (const m of sprungBodyMeshes) {
    m.position
      .copy(m.userData.restPosition)
      .addScaledVector(m.userData.explodeVec, currentExplodeT);
    if (m.name.startsWith('Chimney_')) {
      m.position.y += currentCutawayT * 1.65;
    } else if (m.name === 'Roof_Brunjung') {
      m.position.y += currentCutawayT * 1.38;
    } else if (m.name.startsWith('Roof_')) {
      m.position.y += currentCutawayT * 0.98;
    }
  }

  // Gentle breeze sway on hanging Pendopo Chandeliers
  for (const m of [...frontLanternMeshes, ...rearLanternMeshes]) {
    m.rotation.z = m.userData.restRotation.z + lanternSwayZ;
  }

  // Hinged Central Kori Agung Double Doors
  for (const m of leftDoorMeshes) {
    m.rotation.y = m.userData.restRotation.y - currentDoorLeftRad;
  }
  for (const m of rightDoorMeshes) {
    m.rotation.y = m.userData.restRotation.y + currentDoorRightRad;
  }

  // Front Left & Right Gebyok Casement Windows
  for (const m of leftDoorWindowMeshes) {
    m.rotation.y = m.userData.restRotation.y - currentWinSideRad * 0.90;
  }
  for (const m of rightDoorWindowMeshes) {
    m.rotation.y = m.userData.restRotation.y + currentWinSideRad * 0.90;
  }

  // Central Upper Transom Awning Window
  for (const m of frontWindowMeshes) {
    m.rotation.x = m.userData.restRotation.x - currentWinFrontRad * 0.85;
  }

  // Side Sanctuary Krepyak Windows
  for (const m of rearLeftWindowMeshes) {
    m.rotation.y = m.userData.restRotation.y + currentWinRearRad * 0.90;
  }
  for (const m of rearRightWindowMeshes) {
    m.rotation.y = m.userData.restRotation.y - currentWinRearRad * 0.90;
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
