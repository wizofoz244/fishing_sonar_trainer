/**
 * @file helmDock.js
 * @description Docked bottom controls (throttle, depth, gain, overlay, jigs).
 */

import { simState } from '../state/simState.js';
import { dropFishingJig } from '../physics/targets.js';

export function initHelmDock(onPresetSpawn) {
  const speedInput = document.getElementById('slider-speed');
  const speedDock = document.getElementById('lbl-speed-dock');
  if (speedInput) {
    speedInput.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      simState.update({ boatSpeed: v });
      if (speedDock) speedDock.innerText = `${v.toFixed(1)} MPH`;
    });
  }

  const depthInput = document.getElementById('slider-depth');
  const depthDock = document.getElementById('lbl-depth-dock');
  if (depthInput) {
    depthInput.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      simState.update({ baseDepthFt: v });
      if (depthDock) depthDock.innerText = `${v.toFixed(1)} FT`;
    });
  }

  const gainInput = document.getElementById('slider-gain');
  const gainDock = document.getElementById('lbl-gain-dock');
  if (gainInput) {
    gainInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      simState.update({ gain: v / 100 });
      if (gainDock) gainDock.innerText = `${v}%`;
    });
  }

  const btnDockCorrelate = document.getElementById('btn-dock-correlate');
  if (btnDockCorrelate) {
    btnDockCorrelate.addEventListener('click', toggleCorrelationOverlay);
  }

  const btnDropJig = document.getElementById('btn-drop-jig');
  if (btnDropJig) {
    btnDropJig.addEventListener('click', () => dropFishingJig());
  }

  const btnSpawnKeelBass = document.getElementById('btn-spawn-keel-bass');
  if (btnSpawnKeelBass) {
    btnSpawnKeelBass.addEventListener('click', () => {
      if (onPresetSpawn) onPresetSpawn('center-bass');
    });
  }
}

export function toggleCorrelationOverlay() {
  const current = simState.get('showCorrelationOverlay');
  const next = !current;
  simState.update({ showCorrelationOverlay: next });

  const btnHeader = document.getElementById('btn-toggle-correlate');
  const lblHeader = document.getElementById('lbl-correlate-btn');
  const btnDock = document.getElementById('btn-dock-correlate');

  const text = next ? '🎯 Correlate: ON' : '🎯 Correlate: OFF';
  if (lblHeader) lblHeader.innerText = text;
  if (btnDock) btnDock.innerText = next ? '🎯 Acoustic Shape Overlay: ON' : '🎯 Acoustic Shape Overlay: OFF';
  if (btnHeader) btnHeader.classList.toggle('opacity-60', !next);
}
