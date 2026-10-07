/**
 * @file targetTray.js
 * @description Drag-and-drop target tray, holographic drop reticle, and target spawners.
 */

import { simState } from '../state/simState.js';
import { structures, fishList, setLure } from '../physics/targets.js';
import { unproject3D } from '../renderers/lake3D.js';
import { selectTarget } from './telemetryHud.js';

export const dragState = {
  active: false,
  targetType: null,
  screenX: 0,
  screenY: 0,
  coords3D: null
};

export function initTargetTray(canvas3D, canvas2D) {
  const dragSources = document.querySelectorAll('.drag-source');
  dragSources.forEach(source => {
    const handleDragStart = (e) => {
      const type = source.getAttribute('data-target-type');
      if (!type) return;
      dragState.active = true;
      dragState.targetType = type;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      updateDragPosition(clientX, clientY, canvas3D, canvas2D);
    };

    source.addEventListener('mousedown', handleDragStart);
    source.addEventListener('touchstart', handleDragStart, { passive: true });
  });

  const handlePointerMove = (e) => {
    if (!dragState.active) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    updateDragPosition(clientX, clientY, canvas3D, canvas2D);
  };

  const handlePointerEnd = (e) => {
    if (!dragState.active) return;
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    finalizeDrop(clientX, clientY, canvas3D, canvas2D);
    dragState.active = false;
    dragState.coords3D = null;
    dragState.targetType = null;
  };

  window.addEventListener('mousemove', handlePointerMove);
  window.addEventListener('touchmove', handlePointerMove, { passive: true });
  window.addEventListener('mouseup', handlePointerEnd);
  window.addEventListener('touchend', handlePointerEnd);
}

function updateDragPosition(clientX, clientY, canvas3D, canvas2D) {
  const state = simState.get();
  const activeCanvas = state.lakeFeed === '2d' ? canvas2D : canvas3D;
  const rect = activeCanvas.getBoundingClientRect();
  const inX = clientX - rect.left;
  const inY = clientY - rect.top;

  if (inX >= 0 && inX <= rect.width && inY >= 0 && inY <= rect.height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dragState.screenX = inX * dpr;
    dragState.screenY = inY * dpr;
    if (state.lakeFeed === '3d') {
      dragState.coords3D = unproject3D(dragState.screenX, dragState.screenY, canvas3D);
    }
  } else {
    dragState.coords3D = null;
  }
}

function finalizeDrop(clientX, clientY, canvas3D, canvas2D) {
  const state = simState.get();
  const activeCanvas = state.lakeFeed === '2d' ? canvas2D : canvas3D;
  const rect = activeCanvas.getBoundingClientRect();
  const inX = clientX - rect.left;
  const inY = clientY - rect.top;

  if (inX < 0 || inX > rect.width || inY < 0 || inY > rect.height) return;

  const type = dragState.targetType;

  if (state.lakeFeed === '3d' && dragState.coords3D) {
    const { x, y, z } = dragState.coords3D;
    const worldZ = (state.worldZ + z) % state.lakeLength;
    const newId = Date.now();

    if (type === 'jig') {
      setLure({ x, y, depth: y, z: worldZ, active: true });
    } else if (type === 'boulder') {
      structures.push({
        id: `b-${newId}`, tag: 'E', name: 'Placed Rock', type: 'boulder',
        x, z: worldZ, width: 8, height: 5.5, color: '#94a3b8'
      });
      selectTarget(`b-${newId}`);
    } else if (type === 'timber') {
      structures.push({
        id: `t-${newId}`, tag: 'D', name: 'Placed Timber', type: 'tree',
        x, z: worldZ, width: 9, height: 10, color: '#f59e0b'
      });
      selectTarget(`t-${newId}`);
    } else {
      const lateral = type === 'port-bass' ? -35 : (type === 'stbd-bass' ? 38 : x);
      fishList.push({
        id: newId, tag: 'A', name: 'Placed Bass', shapeHint: 'Acoustic Target',
        x: lateral, y, baseY: y, z: worldZ, size: 1.6, speed: 0.0, color: '#38bdf8'
      });
      selectTarget(newId);
    }
  } else if (state.lakeFeed === '2d') {
    const depthRatio = Math.max(0.05, Math.min(0.95, (inY / rect.height)));
    const clickedDepth = depthRatio * 60;
    const forwardZ = (state.boatZ || 35) + 62;
    const newId = Date.now();

    if (type === 'jig') {
      setLure({ x: 0, y: clickedDepth, depth: clickedDepth, z: forwardZ, active: true });
    } else if (type === 'boulder') {
      structures.push({
        id: `b-${newId}`, tag: 'E', name: 'Keel Boulder', type: 'boulder',
        x: 0, z: forwardZ, width: 8, height: 5.5, color: '#94a3b8'
      });
      selectTarget(`b-${newId}`);
    } else if (type === 'timber') {
      structures.push({
        id: `t-${newId}`, tag: 'D', name: 'Keel Timber', type: 'tree',
        x: 0, z: forwardZ, width: 9, height: 10, color: '#f59e0b'
      });
      selectTarget(`t-${newId}`);
    } else {
      fishList.push({
        id: newId, tag: 'A', name: 'Keel Bass', shapeHint: '2D Arch & ClearVü Grain',
        x: 0, y: clickedDepth, baseY: clickedDepth, z: forwardZ, size: 1.6, speed: 0.0, color: '#38bdf8'
      });
      selectTarget(newId);
    }
  }
}
