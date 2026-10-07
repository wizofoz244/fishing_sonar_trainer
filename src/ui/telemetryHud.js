/**
 * @file telemetryHud.js
 * @description Telemetry readouts, depth display, and cross-screen selection indicator.
 */

import { simState } from '../state/simState.js';
import { fishList, structures } from '../physics/targets.js';

export function initTelemetryHud() {
  const dock = document.getElementById('selection-indicator-dock');
  const chip = document.getElementById('txt-selected-chip');
  const clearBtn = document.getElementById('btn-clear-selection');

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearSelectedTarget();
    });
  }

  simState.subscribe((updates, state) => {
    if ('boatSpeed' in updates) {
      const sog = document.getElementById('telemetry-sog');
      if (sog) sog.innerHTML = `${state.boatSpeed.toFixed(1)}<span class="text-[8px]">MPH</span>`;
    }

    if ('selectedTargetId' in updates) {
      updateSelectionUI(state.selectedTargetId, dock, chip, clearBtn);
    }
  });
}

export function updateDepthDisplays(depthFt) {
  const dEl = document.getElementById('telemetry-depth');
  if (dEl) dEl.innerHTML = `${depthFt.toFixed(1)}<span class="text-[8px]">FT</span>`;
  const hLive = document.getElementById('hud-live-depth');
  if (hLive) hLive.innerText = `${depthFt.toFixed(1)}FT`;
  const hClear = document.getElementById('hud-clear-depth');
  if (hClear) hClear.innerText = `${depthFt.toFixed(1)}FT`;
  const hTrad = document.getElementById('hud-trad-depth');
  if (hTrad) hTrad.innerText = `${depthFt.toFixed(1)}FT`;
}

export function selectTarget(id) {
  const currentId = simState.get('selectedTargetId');
  if (currentId === id) {
    clearSelectedTarget();
  } else {
    simState.update({ selectedTargetId: id });
  }
}

export function clearSelectedTarget() {
  simState.update({ selectedTargetId: null });
}

function updateSelectionUI(id, dock, chip, clearBtn) {
  if (!dock || !chip) return;
  if (id) {
    const target = fishList.find(f => f.id === id) || structures.find(s => s.id === id);
    if (target) {
      dock.className = "h-7 min-h-[28px] px-3 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 text-[11px] font-bold flex items-center justify-between shadow-sm";
      chip.innerText = `HIGHLIGHTED: [${target.tag || 'T'}] ${target.name} • Locked across Lake & MFDs`;
      if (clearBtn) clearBtn.classList.remove('hidden');
    }
  } else {
    dock.className = "h-7 min-h-[28px] px-3 rounded-lg bg-amber-950/90 border border-amber-600/70 text-amber-300 text-[11px] font-bold flex items-center justify-between shadow-sm";
    chip.innerText = "Click any fish, boulder, or timber badge to lock and highlight across screens";
    if (clearBtn) clearBtn.classList.add('hidden');
  }
}
