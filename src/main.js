/**
 * @file main.js
 * @description Main application entrypoint, canvas resize observer, hit routing, and 60 FPS animation loop.
 */

import { simState } from './state/simState.js';
import { getDepthAt } from './physics/acousticEngine.js';
import { structures, fishList, updateKinematics, dropFishingJig } from './physics/targets.js';
import { render3DLake, hitBoxes3D, unproject3D } from './renderers/lake3D.js';
import { render2DWaterPhysics, hitBoxes2D } from './renderers/lake2D.js';
import { renderSonarSuite, samplePings, seedAcousticHistory } from './renderers/sonarSuite.js';
import { hitBoxesLiveScope } from './renderers/liveScope.js';
import { hitBoxesSideVu } from './renderers/sideVu.js';
import { hitBoxesClearVu } from './renderers/clearVu.js';
import { hitBoxesTrad } from './renderers/chirp2D.js';
import { initTelemetryHud, updateDepthDisplays, selectTarget, clearSelectedTarget } from './ui/telemetryHud.js';
import { initHelmDock } from './ui/helmDock.js';
import { initDrawers, toggleDrawer, setContour } from './ui/angleDrawers.js';
import { initTargetTray, dragState } from './ui/targetTray.js';
import { initModals, checkFirstTimeUser, toggleGuideModal, toggleCreditsModal, toggleTipsModal, openSonarTipTab } from './ui/modals.js';

// Global references
const canvas3D = document.getElementById('canvas-3d-lake');
const ctx3D = canvas3D.getContext('2d');
const canvas2DWater = document.getElementById('canvas-2d-water');
const ctx2DWater = canvas2DWater.getContext('2d');
const canvasMFDLive = document.getElementById('canvas-mfd-live');
const ctxMFDLive = canvasMFDLive.getContext('2d');
const canvasMFDSide = document.getElementById('canvas-mfd-side');
const ctxMFDSide = canvasMFDSide.getContext('2d');
const canvasMFDClear = document.getElementById('canvas-mfd-clear');
const ctxMFDClear = canvasMFDClear.getContext('2d');
const canvasMFDTrad = document.getElementById('canvas-mfd-trad');
const ctxMFDTrad = canvasMFDTrad.getContext('2d');

let lastPingTime = 0;
let lastAutoSpawnTime = 0;

function resizeCanvases() {
  const list = [canvas3D, canvas2DWater, canvasMFDLive, canvasMFDSide, canvasMFDClear, canvasMFDTrad];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  list.forEach(c => {
    if (!c || !c.parentElement) return;
    const rect = c.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
    }
  });
}
window.addEventListener('resize', resizeCanvases);

export function spawnPresetTarget(type) {
  const state = simState.get();
  const newId = Date.now();
  const zFwd = (state.boatZ || 35) + 62;

  if (type === 'center-bass') {
    fishList.push({
      id: newId, tag: 'A', name: 'Keel Bass', shapeHint: '2D Arch & ClearVü Grain',
      x: 0, y: 15.0, baseY: 15.0, z: zFwd, size: 1.6, speed: 0.0, color: '#38bdf8'
    });
    selectTarget(newId);
  } else if (type === 'port-bass') {
    fishList.push({
      id: newId, tag: 'B', name: "35' Port Bass", shapeHint: 'SideVü Port Echo + Shadow',
      x: -35, y: 14.0, baseY: 14.0, z: zFwd, size: 1.6, speed: 0.0, color: '#c084fc'
    });
    selectTarget(newId);
  } else if (type === 'stbd-bass') {
    fishList.push({
      id: newId, tag: 'C', name: "40' Stbd Bass", shapeHint: 'SideVü Stbd Echo + Shadow',
      x: 40, y: 16.0, baseY: 16.0, z: zFwd, size: 1.6, speed: 0.0, color: '#c084fc'
    });
    selectTarget(newId);
  } else if (type === 'boulder') {
    structures.push({
      id: `b-${newId}`, tag: 'E', name: 'Boulder', type: 'boulder',
      x: state.lakeFeed === '2d' ? 0 : 28, z: zFwd, width: 8.5, height: 5.5, color: '#94a3b8'
    });
    selectTarget(`b-${newId}`);
  } else if (type === 'timber') {
    structures.push({
      id: `t-${newId}`, tag: 'D', name: 'Timber', type: 'tree',
      x: state.lakeFeed === '2d' ? 0 : 25, z: zFwd, width: 10, height: 11, color: '#f59e0b'
    });
    selectTarget(`t-${newId}`);
  } else if (type === 'bed') {
    structures.push({
      id: `bed-${newId}`, tag: 'E', name: 'Bed', type: 'boulder',
      x: 0, z: zFwd, width: 12, height: 3, color: '#f59e0b'
    });
    selectTarget(`bed-${newId}`);
  }
}

function attachCanvasHitListeners() {
  const views = [
    { canvas: canvas3D, getHits: () => hitBoxes3D, key: 'lake3D' },
    { canvas: canvas2DWater, getHits: () => hitBoxes2D, key: 'water2D' },
    { canvas: canvasMFDLive, getHits: () => hitBoxesLiveScope, key: 'mfdLive' },
    { canvas: canvasMFDSide, getHits: () => hitBoxesSideVu, key: 'mfdSide' },
    { canvas: canvasMFDClear, getHits: () => hitBoxesClearVu, key: 'mfdClear' },
    { canvas: canvasMFDTrad, getHits: () => hitBoxesTrad, key: 'mfdTrad' }
  ];

  views.forEach(({ canvas, getHits, key }) => {
    if (!canvas) return;
    canvas.addEventListener('click', (e) => {
      if (dragState.active) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const clickX = (e.clientX - rect.left) * dpr;
      const clickY = (e.clientY - rect.top) * dpr;

      const boxList = getHits();
      let hitFound = null;

      for (let i = boxList.length - 1; i >= 0; i--) {
        const b = boxList[i];
        if (clickX >= b.x && clickX <= b.x + b.w && clickY >= b.y && clickY <= b.y + b.h) {
          hitFound = b;
          break;
        }
      }

      if (hitFound) {
        selectTarget(hitFound.id);
      } else {
        if (simState.get('selectedTargetId')) {
          clearSelectedTarget();
        } else if (key === 'lake3D' || key === 'water2D') {
          spawnTargetAtClick(clickX, clickY, key, rect, dpr);
        }
      }
    });
  });
}

function spawnTargetAtClick(clickX, clickY, key, rect, dpr) {
  const state = simState.get();
  const newId = Date.now();
  if (key === 'water2D') {
    const depthRatio = Math.max(0.1, Math.min(0.9, (clickY / (rect.height * dpr))));
    const clickedDepth = depthRatio * 60;
    const forwardZ = (state.boatZ || 35) + 62;
    fishList.push({
      id: newId, tag: 'A', name: 'Keel Bass', shapeHint: '2D Arch & ClearVü Grain',
      x: 0, y: clickedDepth, baseY: clickedDepth, z: forwardZ, size: 1.6, speed: 0.0, color: '#38bdf8'
    });
    selectTarget(newId);
  } else {
    const unproj = unproject3D(clickX, clickY, canvas3D);
    const worldZ = (state.worldZ + unproj.z) % state.lakeLength;
    fishList.push({
      id: newId, tag: 'A', name: 'Bass', shapeHint: 'Acoustic Target',
      x: unproj.x, y: unproj.y, baseY: unproj.y, z: worldZ, size: 1.6, speed: 0.0, color: '#38bdf8'
    });
    selectTarget(newId);
  }
}

function initNavigationAndModes() {
  // Layout mode switcher buttons
  ['split-quad', 'split-dual', 'lake-full', 'mfd-quad'].forEach(mode => {
    const btn = document.getElementById(`btn-layout-${mode}`);
    if (btn) btn.addEventListener('click', () => setLayout(mode));
  });

  // Source selection dropdown
  const selLakeFeed = document.getElementById('sel-source-lake');
  if (selLakeFeed) {
    selLakeFeed.addEventListener('change', (e) => {
      setLakeFeedType(e.target.value);
    });
  }

  // Camera preset buttons
  ['quarter', 'steep', 'low'].forEach(cam => {
    const btn = document.getElementById(`cam-${cam}`);
    if (btn) btn.addEventListener('click', () => setCameraAngle(cam));
  });

  // Transducer power toggles
  ['live', 'side', 'clear', '2d'].forEach(tech => {
    const btn = document.getElementById(`mfd-btn-${tech}`);
    if (btn) btn.addEventListener('click', () => toggleTransducer(tech));
  });

  // Maximize slot buttons
  ['lake', 'live', 'side', 'clear', 'trad'].forEach(slot => {
    const btn = document.getElementById(`btn-max-${slot}`);
    if (btn) btn.addEventListener('click', () => maximizeSlot(slot));
  });

  // Header quick toggles
  const btnToggleCorrelate = document.getElementById('btn-toggle-correlate');
  if (btnToggleCorrelate) {
    btnToggleCorrelate.addEventListener('click', () => {
      const cur = simState.get('showCorrelationOverlay');
      simState.update({ showCorrelationOverlay: !cur });
      const lbl = document.getElementById('lbl-correlate-btn');
      if (lbl) lbl.innerText = !cur ? '🎯 Correlate: ON' : '🎯 Correlate: OFF';
    });
  }

  const btnToggleGuide = document.getElementById('btn-toggle-guide');
  if (btnToggleGuide) btnToggleGuide.addEventListener('click', () => toggleGuideModal());

  const btnToggleTips = document.getElementById('btn-toggle-tips');
  if (btnToggleTips) btnToggleTips.addEventListener('click', () => toggleTipsModal());

  const btnToggleAngles = document.getElementById('btn-toggle-angles');
  if (btnToggleAngles) btnToggleAngles.addEventListener('click', () => toggleDrawer('angles'));

  const btnToggleTargets = document.getElementById('btn-toggle-targets');
  if (btnToggleTargets) btnToggleTargets.addEventListener('click', () => toggleDrawer('targets'));

  const btnToggleLakebed = document.getElementById('btn-toggle-lakebed');
  if (btnToggleLakebed) btnToggleLakebed.addEventListener('click', () => toggleDrawer('lakebed'));

  const btnToggleCredits = document.getElementById('btn-toggle-credits');
  if (btnToggleCredits) btnToggleCredits.addEventListener('click', () => toggleCreditsModal());

  const btnPause = document.getElementById('btn-pause');
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      const isPaused = !simState.get('isPaused');
      simState.update({ isPaused });
      const txt = document.getElementById('txt-pause');
      if (txt) txt.innerText = isPaused ? '▶' : '⏸';
      btnPause.classList.toggle('bg-emerald-700', isPaused);
    });
  }

  const btnBeams = document.getElementById('btn-quick-illustrations');
  if (btnBeams) {
    btnBeams.addEventListener('click', () => {
      const show = !simState.get('showIllustrations');
      simState.update({ showIllustrations: show });
      btnBeams.innerText = show ? 'Beams: ON' : 'Beams: OFF';
      btnBeams.classList.toggle('opacity-50', !show);
    });
  }

  const btnSideFlip = document.getElementById('btn-side-flip');
  if (btnSideFlip) {
    btnSideFlip.addEventListener('click', () => {
      const sideFlipped = !simState.get('sideFlipped');
      simState.update({ sideFlipped });
      btnSideFlip.classList.toggle('bg-purple-900', sideFlipped);
      const lblL = document.getElementById('lbl-side-left');
      const lblR = document.getElementById('lbl-side-right');
      if (lblL && lblR) {
        if (sideFlipped) {
          lblL.innerText = '◄ STBD 60\'';
          lblR.innerText = 'PORT 60\' ►';
        } else {
          lblL.innerText = '◄ PORT 60\'';
          lblR.innerText = 'STBD 60\' ►';
        }
      }
    });
  }

  const btnAutoSpawn = document.getElementById('btn-auto-spawn');
  if (btnAutoSpawn) {
    btnAutoSpawn.addEventListener('click', () => {
      const autoSpawn = !simState.get('autoSpawn');
      simState.update({ autoSpawn });
      btnAutoSpawn.innerText = autoSpawn ? '⚡ Auto-Spawn [ON]' : '⚡ Auto-Spawn [OFF]';
      btnAutoSpawn.classList.toggle('bg-cyan-800', autoSpawn);
      btnAutoSpawn.classList.toggle('text-white', autoSpawn);
    });
  }

  // Target preset buttons inside drawer
  ['center-bass', 'port-bass', 'stbd-bass', 'bed', 'boulder', 'timber'].forEach(type => {
    const btn = document.getElementById(`btn-spawn-${type}`);
    if (btn) btn.addEventListener('click', () => spawnPresetTarget(type));
  });

  const btnDrawerDropJig = document.getElementById('btn-drawer-drop-jig');
  if (btnDrawerDropJig) {
    btnDrawerDropJig.addEventListener('click', () => dropFishingJig());
  }

  // Global window fallback
  window.dropFishingJig = dropFishingJig;

  // Tips drawer open buttons on MFD bezels
  ['live', 'side', 'clear', 'trad'].forEach(tab => {
    const btn = document.getElementById(`btn-tip-${tab}`);
    if (btn) btn.addEventListener('click', () => openSonarTipTab(tab));
  });
}

function setLayout(mode) {
  simState.update({ layoutMode: mode });
  const container = document.getElementById('helm-display-container');
  const paneLake = document.getElementById('pane-container-lake');
  const paneMFD = document.getElementById('pane-container-mfd');
  const mfdGrid = document.getElementById('mfd-subgrid');

  const buttons = {
    'split-quad': document.getElementById('btn-layout-split-quad'),
    'split-dual': document.getElementById('btn-layout-split-dual'),
    'lake-full': document.getElementById('btn-layout-lake-full'),
    'mfd-quad': document.getElementById('btn-layout-mfd-quad')
  };

  Object.entries(buttons).forEach(([k, btn]) => {
    if (!btn) return;
    if (k === mode) {
      btn.className = "px-2 py-1 rounded bg-sky-600 text-white font-bold transition-all";
    } else {
      btn.className = "px-2 py-1 rounded text-slate-400 hover:text-white transition-all ml-0.5";
    }
  });

  if (!container || !paneLake || !paneMFD) return;

  if (mode === 'lake-full') {
    container.className = "flex-1 w-full h-full min-h-0 grid grid-cols-1 gap-1.5 overflow-hidden transition-all duration-200";
    paneLake.classList.remove('hidden');
    paneMFD.classList.add('hidden');
  } else if (mode === 'mfd-quad') {
    container.className = "flex-1 w-full h-full min-h-0 grid grid-cols-1 gap-1.5 overflow-hidden transition-all duration-200";
    paneLake.classList.add('hidden');
    paneMFD.classList.remove('hidden');
    if (mfdGrid) mfdGrid.className = "flex-1 w-full h-full min-h-0 grid grid-cols-1 sm:grid-cols-2 gap-1.5 overflow-hidden";
    restoreAllMFDCards();
  } else if (mode === 'split-dual') {
    container.className = "flex-1 w-full h-full min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-1.5 overflow-hidden transition-all duration-200";
    paneLake.classList.remove('hidden');
    paneMFD.classList.remove('hidden');
    maximizeSlot('live');
  } else {
    container.className = "flex-1 w-full h-full min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-1.5 overflow-hidden transition-all duration-200";
    paneLake.classList.remove('hidden');
    paneMFD.classList.remove('hidden');
    if (mfdGrid) mfdGrid.className = "flex-1 w-full h-full min-h-0 grid grid-cols-1 sm:grid-cols-2 gap-1.5 overflow-hidden";
    restoreAllMFDCards();
  }

  setTimeout(resizeCanvases, 40);
}

function restoreAllMFDCards() {
  ['live', 'side', 'clear', 'trad'].forEach(slot => {
    const card = document.getElementById(`card-mfd-${slot}`);
    if (card) card.classList.remove('hidden', 'col-span-2', 'row-span-2');
  });
}

function maximizeSlot(slot) {
  if (slot === 'lake') {
    setLayout('lake-full');
    return;
  }
  const mfdGrid = document.getElementById('mfd-subgrid');
  if (mfdGrid) mfdGrid.className = "flex-1 w-full h-full min-h-0 grid grid-cols-1 gap-1.5 overflow-hidden";
  ['live', 'side', 'clear', 'trad'].forEach(s => {
    const card = document.getElementById(`card-mfd-${s}`);
    if (!card) return;
    if (s === slot) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
  setTimeout(resizeCanvases, 40);
}

function setLakeFeedType(type) {
  simState.update({ lakeFeed: type });
  if (type === '2d') {
    canvas3D.classList.add('hidden');
    canvas2DWater.classList.remove('hidden');
  } else {
    canvas3D.classList.remove('hidden');
    canvas2DWater.classList.add('hidden');
  }
  setTimeout(resizeCanvases, 30);
}

function setCameraAngle(angle) {
  simState.update({ cameraPreset: angle });
  ['quarter', 'steep', 'low'].forEach(a => {
    const btn = document.getElementById(`cam-${a}`);
    if (btn) {
      if (a === angle) {
        btn.className = "px-1.5 py-0.5 rounded bg-sky-600 text-white font-bold";
      } else {
        btn.className = "px-1.5 py-0.5 rounded text-slate-400 hover:text-white ml-0.5";
      }
    }
  });
}

function toggleTransducer(type) {
  const currentPower = { ...simState.get('power') };
  currentPower[type] = !currentPower[type];
  simState.update({ power: currentPower });

  const btn = document.getElementById(`mfd-btn-${type}`);
  const dot = document.getElementById(`dot-${type}`);
  const isPwr = currentPower[type];
  if (btn) {
    btn.innerText = isPwr ? 'PWR: ON' : 'PWR: OFF';
    btn.classList.toggle('opacity-50', !isPwr);
  }
  if (dot) {
    dot.classList.toggle('opacity-30', !isPwr);
  }
}

function animate(timestamp) {
  if (!timestamp) timestamp = performance.now();
  const state = simState.get();

  if (!state.isPaused) {
    const knots = state.boatSpeed;
    const dt = 0.016;
    const distStep = (knots * 1.467) * dt * 0.7;
    const nextWorldZ = (state.worldZ + distStep) % state.lakeLength;
    const nextLakeDepthFt = getDepthAt(0, state.boatZ);

    simState.update({ worldZ: nextWorldZ, lakeDepthFt: nextLakeDepthFt });
    updateDepthDisplays(nextLakeDepthFt);
    updateKinematics(timestamp);

    if (state.autoSpawn && timestamp - lastAutoSpawnTime > 4500) {
      const types = ['center-bass', 'port-bass', 'stbd-bass', 'timber', 'boulder'];
      const pick = types[Math.floor(Math.random() * types.length)];
      spawnPresetTarget(pick);
      lastAutoSpawnTime = timestamp;
    }

    if (timestamp - lastPingTime > 65) {
      samplePings();
      lastPingTime = timestamp;
    }
  }

  if (state.lakeFeed === '2d') {
    render2DWaterPhysics(canvas2DWater, ctx2DWater);
  } else {
    render3DLake(canvas3D, ctx3D, dragState);
  }

  renderSonarSuite({
    canvasLive: canvasMFDLive, ctxLive: ctxMFDLive,
    canvasSide: canvasMFDSide, ctxSide: ctxMFDSide,
    canvasClear: canvasMFDClear, ctxClear: ctxMFDClear,
    canvasTrad: canvasMFDTrad, ctxTrad: ctxMFDTrad
  });

  requestAnimationFrame(animate);
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  resizeCanvases();
  seedAcousticHistory();
  initTelemetryHud();
  initHelmDock(spawnPresetTarget);
  initDrawers();
  initTargetTray(canvas3D, canvas2DWater);
  initModals();
  initNavigationAndModes();
  attachCanvasHitListeners();
  setLayout(simState.get('layoutMode'));
  checkFirstTimeUser();

  requestAnimationFrame(animate);
});
