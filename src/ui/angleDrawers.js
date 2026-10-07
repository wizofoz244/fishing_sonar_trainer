/**
 * @file angleDrawers.js
 * @description Flyout drawers for transducer angles, presets, and lakebed contours.
 */

import { simState } from '../state/simState.js';

export function initDrawers() {
  initAngleControls();
  initLakebedControls();
}

export function toggleDrawer(id) {
  ['angles', 'targets', 'lakebed', 'tips'].forEach(key => {
    const el = document.getElementById(`drawer-${key}`);
    if (!el) return;
    if (key === id) {
      el.classList.toggle('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

function initAngleControls() {
  const tradInput = document.getElementById('input-trad-angle');
  const tradVal = document.getElementById('val-trad-angle');
  if (tradInput) {
    tradInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      simState.update({ tradAngleDeg: v });
      if (tradVal) tradVal.innerText = `${v}° (CHIRP)`;
    });
  }

  const sideSweepInput = document.getElementById('input-side-sweep');
  const sideSweepVal = document.getElementById('val-side-sweep');
  if (sideSweepInput) {
    sideSweepInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      simState.update({ sideSweepDeg: v, sideSweepAngleDeg: v });
      if (sideSweepVal) sideSweepVal.innerText = `${v}°`;
    });
  }

  const sideThickInput = document.getElementById('input-side-thick');
  const sideThickVal = document.getElementById('val-side-thick');
  if (sideThickInput) {
    sideThickInput.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      simState.update({ sideSliceThickDeg: v });
      if (sideThickVal) sideThickVal.innerText = `${v}°`;
    });
  }

  // LiveScope Directional Modes
  ['fwd', 'down', 'persp'].forEach(mKey => {
    const modeName = mKey === 'fwd' ? 'forward' : (mKey === 'down' ? 'down' : 'perspective');
    const headerBtn = document.getElementById(`btn-live-mode-${mKey}`);
    const drawerBtn = document.getElementById(`drawer-live-mode-${mKey}`);

    const setMode = () => {
      simState.update({ liveMode: modeName });
    };

    if (headerBtn) headerBtn.addEventListener('click', setMode);
    if (drawerBtn) drawerBtn.addEventListener('click', setMode);
  });

  // LiveScope Beam Azimuth Rotation
  const liveRotInput = document.getElementById('input-live-rot');
  const liveRotVal = document.getElementById('val-live-rot-num');
  if (liveRotInput) {
    liveRotInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      simState.update({ liveRotationDeg: v });
    });
  }

  // Preset rotation buttons
  const rotPresets = [
    { id: 'btn-rot-port90', val: -90 },
    { id: 'btn-rot-port45', val: -45 },
    { id: 'btn-rot-zero',   val: 0 },
    { id: 'btn-rot-stbd45', val: 45 },
    { id: 'btn-rot-stbd90', val: 90 }
  ];
  rotPresets.forEach(({ id, val }) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        simState.update({ liveRotationDeg: val });
      });
    }
  });

  // Subscribe to simState to update UI buttons and labels
  simState.subscribe((updates, state) => {
    if ('liveMode' in updates) {
      const mode = state.liveMode;
      const badge = document.getElementById('val-live-mode-badge');
      if (badge) badge.innerText = mode.toUpperCase();

      ['fwd', 'down', 'persp'].forEach(mKey => {
        const mName = mKey === 'fwd' ? 'forward' : (mKey === 'down' ? 'down' : 'perspective');
        const isCur = (mode === mName);
        const hBtn = document.getElementById(`btn-live-mode-${mKey}`);
        const dBtn = document.getElementById(`drawer-live-mode-${mKey}`);
        if (hBtn) {
          hBtn.className = isCur 
            ? "px-1.5 py-0.2 rounded bg-emerald-600 text-white font-bold text-[7.5px]"
            : "px-1.5 py-0.2 rounded text-slate-400 hover:text-white font-bold text-[7.5px]";
        }
        if (dBtn) {
          dBtn.className = isCur
            ? "py-1 rounded bg-emerald-600 text-white font-bold text-[9px] border border-emerald-500"
            : "py-1 rounded bg-slate-800 text-slate-300 hover:text-white font-bold text-[9px] border border-slate-700";
        }
      });
    }

    if ('liveRotationDeg' in updates) {
      const deg = state.liveRotationDeg;
      if (liveRotInput && parseInt(liveRotInput.value, 10) !== deg) {
        liveRotInput.value = deg;
      }
      if (liveRotVal) {
        let label = `${deg}°`;
        if (deg === 0) label += ' (Bow Ahead)';
        else if (deg > 0) label += ' (Stbd)';
        else label += ' (Port)';
        liveRotVal.innerText = label;
      }
    }
  });

  const liveTiltInput = document.getElementById('input-live-tilt');
  const liveTiltVal = document.getElementById('val-live-tilt-num');
  if (liveTiltInput) {
    liveTiltInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      simState.update({ liveTiltDeg: v });
      if (liveTiltVal) liveTiltVal.innerText = `${v}°`;
    });
  }

  const liveSpreadInput = document.getElementById('input-live-spread');
  const liveSpreadVal = document.getElementById('val-live-spread-num');
  if (liveSpreadInput) {
    liveSpreadInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      simState.update({ liveSpreadDeg: v });
      if (liveSpreadVal) liveSpreadVal.innerText = `${v}°`;
    });
  }

  const clearAngleInput = document.getElementById('input-clear-angle');
  const clearAngleVal = document.getElementById('val-clear-angle');
  if (clearAngleInput) {
    clearAngleInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      simState.update({ clearAngleDeg: v });
      if (clearAngleVal) clearAngleVal.innerText = `${v}° (UHD)`;
    });
  }
}

function initLakebedControls() {
  const btnAutoVary = document.getElementById('btn-auto-vary');
  if (btnAutoVary) {
    btnAutoVary.addEventListener('click', () => {
      const autoVary = !simState.get('autoVary');
      simState.update({ autoVary });
      btnAutoVary.classList.toggle('bg-amber-900', autoVary);
      btnAutoVary.classList.toggle('text-white', autoVary);
    });
  }

  ['flat', 'ledge', 'hump', 'rolling'].forEach(type => {
    const btn = document.getElementById(`btm-${type}`);
    if (btn) {
      btn.addEventListener('click', () => setContour(type));
    }
  });
}

export function setContour(type) {
  simState.update({ contourType: type });
  ['flat', 'ledge', 'hump', 'rolling'].forEach(t => {
    const btn = document.getElementById(`btm-${t}`);
    if (btn) {
      if (t === type) {
        btn.className = "p-2 rounded-lg bg-cyan-700 text-white font-bold";
      } else {
        btn.className = "p-2 rounded-lg bg-slate-950 text-slate-300 hover:text-white border border-slate-800";
      }
    }
  });
}
