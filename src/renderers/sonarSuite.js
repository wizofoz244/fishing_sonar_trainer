/**
 * @file sonarSuite.js
 * @description MFD coordinator managing ping buffers, sampling cycles, and 4 sounder renders.
 */

import { simState } from '../state/simState.js';
import { isTargetInSideVu, isTargetInClearVu, isTargetIn2DCone } from '../physics/acousticEngine.js';
import { structures, fishList, lure } from '../physics/targets.js';
import { renderLiveScopeMFD } from './liveScope.js';
import { renderSideVuMFD } from './sideVu.js';
import { renderClearVuMFD } from './clearVu.js';
import { renderTradMFD } from './chirp2D.js';

export const FT_PER_PING = 0.35;
export const MAX_HISTORY = 240;

export const sideHistory = [];
export const clearHistory = [];
export const tradHistory = [];

/**
 * Samples one sonar ping across SideVü, ClearVü, and 2D CHIRP arrays.
 */
export function samplePings() {
  const state = simState.get();
  const depth = state.lakeDepthFt;
  const maxDisplayDepth = 55;
  const maxRange = state.sideRangeFt;
  const txZ = (state.boatZ || 35) + state.txOffsetTransom;

  if (state.power['side']) {
    const bins = 130;
    const portRow = new Float32Array(bins);
    const stbdRow = new Float32Array(bins);
    const firstBottomBin = Math.floor((depth / maxRange) * bins);

    for (let b = firstBottomBin; b < bins; b++) {
      const falloff = Math.cos(((b - firstBottomBin) / bins) * 1.4);
      const noise = (Math.random() - 0.5) * 0.08;
      const val = Math.max(0.08, falloff * 0.45 + noise) * state.gain;
      portRow[b] = val; stbdRow[b] = val;
    }

    fishList.forEach(f => {
      const relZ = ((f.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
      if (isTargetInSideVu(relZ, f.x, 2.0)) {
        const slantRange = Math.hypot(f.x, f.y);
        const bin = Math.floor((slantRange / maxRange) * bins);
        if (bin > 0 && bin < bins) {
          const targetRow = f.x < 0 ? portRow : stbdRow;
          targetRow[bin] = 1.0 * state.gain;
        }
      }
    });

    if (lure && lure.active) {
      const relZ = ((lure.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
      if (isTargetInSideVu(relZ, lure.x, 1.2)) {
        const slantRange = Math.hypot(lure.x, lure.depth);
        const bin = Math.floor((slantRange / maxRange) * bins);
        if (bin > 0 && bin < bins) {
          portRow[bin] = Math.max(portRow[bin], 0.95 * state.gain);
          stbdRow[bin] = Math.max(stbdRow[bin], 0.95 * state.gain);
        }
      }
    }

    structures.forEach(st => {
      const relZ = ((st.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
      if (isTargetInSideVu(relZ, st.x, st.width || 8)) {
        const dz = relZ - txZ;
        const rw = (st.width || 8) * 0.5;
        const isKeel = Math.abs(st.x) <= Math.max(5, rw * 0.9);

        if (isKeel) {
          if (st.type === 'boulder') {
            const normDist = Math.hypot(dz / rw, st.x / Math.max(4, rw));
            if (normDist <= 1.0) {
              const domeH = Math.sqrt(Math.max(0, 1 - normDist * normDist)) * st.height;
              const rockTopDepth = Math.max(2, depth - domeH);
              const rockTopBin = Math.max(1, Math.floor((rockTopDepth / maxRange) * bins));
              
              for (let b = rockTopBin; b <= firstBottomBin; b++) {
                const rockVal = (b === rockTopBin ? 1.0 : 0.88) * state.gain;
                portRow[b] = Math.max(portRow[b], rockVal);
                stbdRow[b] = Math.max(stbdRow[b], rockVal);
              }
            }
          } else if (st.type === 'tree') {
            const treeTopDepth = Math.max(2, depth - st.height);
            const treeTopBin = Math.floor((treeTopDepth / maxRange) * bins);
            
            for (let b = treeTopBin; b <= firstBottomBin; b++) {
              const trunkVal = ((b % 2 === 0) ? 0.95 : 0.82) * state.gain;
              portRow[b] = Math.max(portRow[b], trunkVal);
              stbdRow[b] = Math.max(stbdRow[b], trunkVal);
            }
          }
        } else {
          const targetRow = st.x < 0 ? portRow : stbdRow;
          const slantTop = Math.hypot(st.x, depth - st.height);
          const slantBase = Math.hypot(st.x, depth);
          const binTop = Math.floor((slantTop / maxRange) * bins);
          const binBase = Math.floor((slantBase / maxRange) * bins);

          if (binTop > 0 && binBase < bins) {
            for (let b = Math.max(0, binTop); b <= Math.min(bins - 1, binBase); b++) {
              targetRow[b] = 0.96 * state.gain;
            }
            const shadowLenBins = Math.floor(((st.height / Math.max(2, depth - st.height)) * binBase) * 0.65);
            for (let sh = binBase + 1; sh < Math.min(bins, binBase + shadowLenBins); sh++) {
              targetRow[sh] = 0.0;
            }
          }
        }
      }
    });

    sideHistory.push({ port: portRow, stbd: stbdRow });
    if (sideHistory.length > MAX_HISTORY) sideHistory.shift();
  }

  if (state.power['clear']) {
    const bins = 90;
    const slice = new Float32Array(bins);
    const botBin = Math.min(bins - 1, Math.floor((depth / maxDisplayDepth) * bins));
    for (let b = botBin; b < bins; b++) slice[b] = (b === botBin ? 0.98 : 0.75) * state.gain;

    fishList.forEach(f => {
      const relZ = ((f.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
      if (isTargetInClearVu(relZ, f.x, f.y, 1.5)) {
        const fBin = Math.floor((f.y / maxDisplayDepth) * bins);
        if (fBin >= 0 && fBin < botBin) {
          slice[fBin] = 1.0 * state.gain;
          if (fBin + 1 < botBin) slice[fBin + 1] = Math.max(slice[fBin + 1], 0.72 * state.gain);
        }
      }
    });

    if (lure && lure.active) {
      const relZ = ((lure.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
      if (isTargetInClearVu(relZ, lure.x, lure.depth, 1.2)) {
        const lBin = Math.floor((lure.depth / maxDisplayDepth) * bins);
        if (lBin >= 0 && lBin < botBin) {
          slice[lBin] = 0.95 * state.gain;
          if (lBin + 1 < botBin) slice[lBin + 1] = Math.max(slice[lBin + 1], 0.65 * state.gain);
        }
      }
    }

    structures.forEach(st => {
      const relZ = ((st.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
      const dz = relZ - txZ;
      const clearHalfAngleRad = (((state.clearAngleDeg || 45) / 2) * Math.PI) / 180;
      const maxLateralReach = depth * Math.tan(clearHalfAngleRad);

      if (Math.abs(st.x) <= maxLateralReach + (st.width || 8) * 0.5) {
        const latRatio = Math.min(1, Math.abs(st.x) / Math.max(1, maxLateralReach));
        const latFactor = Math.cos(latRatio * Math.PI * 0.38);

        if (st.type === 'boulder') {
          const rw = (st.width || 8) * 0.5;
          if (Math.abs(dz) <= rw) {
            const normDist = Math.hypot(dz / rw, st.x / Math.max(5, rw));
            if (normDist <= 1.0) {
              const domeH = Math.sqrt(Math.max(0, 1 - normDist * normDist)) * st.height;
              const rockTopDepth = Math.max(2, depth - domeH);
              const rockTopBin = Math.max(0, Math.floor((rockTopDepth / maxDisplayDepth) * bins));

              if (rockTopBin >= 0 && rockTopBin < bins) {
                slice[rockTopBin] = Math.max(slice[rockTopBin], 1.0 * state.gain * latFactor);
              }
              for (let b = rockTopBin + 1; b <= botBin; b++) {
                slice[b] = Math.max(slice[b], 0.88 * state.gain * latFactor);
              }
            }
          }
        } else if (st.type === 'tree') {
          const rw = (st.width || 10) * 0.5;
          if (Math.abs(dz) <= rw) {
            const trunkRadius = 1.6;
            const treeTopDepth = Math.max(2, depth - st.height);
            const treeTopBin = Math.max(0, Math.floor((treeTopDepth / maxDisplayDepth) * bins));

            if (Math.abs(dz) <= trunkRadius && Math.abs(st.x) <= 6) {
              const trunkCore = 0.96 * state.gain * latFactor;
              for (let b = treeTopBin; b <= botBin; b++) {
                slice[b] = Math.max(slice[b], trunkCore);
              }
            }

            const limbs = [
              { relH: 0.40, zOff: -rw * 0.45, thick: 2.2 },
              { relH: 0.65, zOff:  rw * 0.35, thick: 2.0 },
              { relH: 0.88, zOff: -rw * 0.20, thick: 1.8 },
              { relH: 0.95, zOff:  rw * 0.10, thick: 1.6 }
            ];

            limbs.forEach(limb => {
              if (Math.abs(dz - limb.zOff) <= limb.thick) {
                const limbDepth = depth - (st.height * limb.relH);
                const limbBin = Math.floor((limbDepth / maxDisplayDepth) * bins);
                if (limbBin >= 0 && limbBin < botBin) {
                  const branchStrength = 0.92 * state.gain * latFactor;
                  slice[limbBin] = Math.max(slice[limbBin], branchStrength);
                  if (limbBin + 1 < botBin) {
                    slice[limbBin + 1] = Math.max(slice[limbBin + 1], branchStrength * 0.78);
                  }
                }
              }
            });
          }
        }
      }
    });

    clearHistory.push(slice);
    if (clearHistory.length > MAX_HISTORY) clearHistory.shift();
  }

  if (state.power['2d']) {
    const bins = 90;
    const slice = new Float32Array(bins);
    const botBin = Math.min(bins - 1, Math.floor((depth / maxDisplayDepth) * bins));
    for (let b = botBin; b < bins; b++) slice[b] = (b < botBin + 4 ? 0.98 : 0.65) * state.gain;

    fishList.forEach(f => {
      const relZ = ((f.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
      const hit = isTargetIn2DCone(relZ, f.x, f.y);
      if (hit) {
        const archBin = Math.floor((hit.slantRange / maxDisplayDepth) * bins);
        if (archBin >= 0 && archBin < botBin) {
          const signalStrength = Math.max(0.25, (1.0 - Math.pow(hit.distRatio, 1.8) * 0.75)) * state.gain;
          slice[archBin] = Math.max(slice[archBin], signalStrength);
        }
      }
    });

    if (lure && lure.active) {
      const relZ = ((lure.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
      const hit = isTargetIn2DCone(relZ, lure.x, lure.depth);
      if (hit) {
        const archBin = Math.floor((hit.slantRange / maxDisplayDepth) * bins);
        if (archBin >= 0 && archBin < botBin) {
          const signalStrength = Math.max(0.3, (1.0 - Math.pow(hit.distRatio, 1.8) * 0.7)) * state.gain;
          slice[archBin] = Math.max(slice[archBin], signalStrength);
        }
      }
    }

    structures.forEach(st => {
      const relZ = ((st.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
      const coneHalfAngleRad = ((state.tradAngleDeg / 2) * Math.PI) / 180;
      const coneRadiusAtBase = depth * Math.tan(coneHalfAngleRad);
      const horizDist = Math.hypot(st.x, relZ - txZ);
      const effectiveRadius = coneRadiusAtBase + (st.width || 8) * 0.45;

      if (horizDist <= effectiveRadius) {
        const distRatio = horizDist / effectiveRadius;
        const topDepth = Math.max(2, depth - st.height);
        const topBin = Math.max(0, Math.floor((topDepth / maxDisplayDepth) * bins));

        if (st.type === 'tree') {
          const coreStrength = Math.max(0.35, (1.0 - Math.pow(distRatio, 1.5) * 0.65)) * state.gain;
          for (let b = topBin; b < botBin; b++) {
            const branchScatter = ((b % 3 === 0) ? 0.15 : 0) + (Math.sin(b * 1.7 + relZ) * 0.1);
            const str = Math.min(1.0, coreStrength * (0.75 + branchScatter));
            slice[b] = Math.max(slice[b], str);
          }
          if (topBin >= 0 && topBin < botBin) {
            slice[topBin] = Math.max(slice[topBin], coreStrength * 0.95);
          }
        } else if (st.type === 'boulder') {
          const domeStrength = Math.max(0.4, (1.0 - Math.pow(distRatio, 1.6) * 0.6)) * state.gain;
          for (let b = topBin; b < botBin; b++) {
            slice[b] = Math.max(slice[b], domeStrength);
          }
        }
      }
    });

    tradHistory.push(slice);
    if (tradHistory.length > MAX_HISTORY) tradHistory.shift();
  }
}

/**
 * Pre-seeds acoustic history buffers for realistic startup display.
 */
export function seedAcousticHistory() {
  for (let i = MAX_HISTORY; i > 0; i--) {
    samplePings();
  }
}

/**
 * Renders all 4 Garmin sounders.
 *
 * @param {object} canvases
 */
export function renderSonarSuite({ canvasLive, ctxLive, canvasSide, ctxSide, canvasClear, ctxClear, canvasTrad, ctxTrad }) {
  renderLiveScopeMFD(canvasLive, ctxLive);
  renderSideVuMFD(canvasSide, ctxSide, sideHistory, MAX_HISTORY, FT_PER_PING);
  renderClearVuMFD(canvasClear, ctxClear, clearHistory, MAX_HISTORY, FT_PER_PING);
  renderTradMFD(canvasTrad, ctxTrad, tradHistory, MAX_HISTORY, FT_PER_PING);
}
