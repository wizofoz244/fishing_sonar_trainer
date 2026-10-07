/**
 * @file acousticEngine.js
 * @description Trigonometric calculations, bathymetry elevation, ray-casting, and beam coverage.
 */

import { simState } from '../state/simState.js';

/**
 * Returns water column depth at given coordinates considering bathymetric contours.
 *
 * @param {number} xOrRelZ - Lateral X distance (ft) or relative Z if only 1 argument.
 * @param {number} [maybeRelZ] - Relative Z distance (ft) from boat keel.
 * @returns {number} Lake bottom depth in feet (clamped between 6 and 65 ft).
 */
export function getDepthAt(xOrRelZ, maybeRelZ) {
  const state = simState.get();
  let x = 0;
  let relZ = 0;
  if (maybeRelZ !== undefined) {
    x = xOrRelZ;
    relZ = maybeRelZ;
  } else {
    relZ = xOrRelZ;
  }

  let d = state.baseDepthFt;
  const trackZ = ((state.worldZ + relZ) % state.lakeLength + state.lakeLength) % state.lakeLength;

  if (state.contourType === 'ledge') {
    const cycleZ = trackZ % 160;
    if (cycleZ < 65) {
      d = state.baseDepthFt - 10;
    } else if (cycleZ < 95) {
      const t = (cycleZ - 65) / 30;
      d = (state.baseDepthFt - 10) + t * 22;
    } else {
      d = state.baseDepthFt + 12;
    }
    d += (x / 65) * 3.5;
  } else if (state.contourType === 'hump') {
    const cycleZ = trackZ % 150;
    const distFromPeak = Math.hypot(x * 0.7, cycleZ - 75);
    const peakElevation = Math.max(0, 15 - distFromPeak * 0.40);
    d = (state.baseDepthFt + 7) - peakElevation;
  } else if (state.contourType === 'rolling') {
    d = state.baseDepthFt + Math.sin(trackZ * 0.08) * 8.0 + Math.cos((trackZ * 0.04) + (x * 0.05)) * 3.0;
  }

  if (state.autoVary) {
    d += Math.sin(state.worldZ * 0.035) * 6.0;
  }
  return Math.max(6, Math.min(65, d));
}

/**
 * Raycasts forward from the bow transducer along an acoustic angle to locate lakebed intersection.
 *
 * @param {number} angleRad - Beam angle in radians from horizontal downwards.
 * @param {number} maxReachFt - Maximum acoustic range in feet.
 * @param {number} bowZ - Bow transducer Z coordinate in world space.
 * @param {number} [lateralX=0] - Lateral offset in feet.
 * @returns {{ r: number, fwd: number, depth: number, hitBottom: boolean }}
 */
export function getLiveRayReach(angleRad, maxReachFt, bowZ, lateralX = 0) {
  const state = simState.get();
  const txDepth = state.txDepth;
  const sinA = Math.sin(angleRad);
  const cosA = Math.cos(angleRad);
  const step = 0.8;

  for (let r = step; r <= maxReachFt; r += step) {
    const fwd = r * cosA;
    const d = txDepth + r * sinA;
    const bedD = getDepthAt(lateralX, bowZ + fwd);
    if (d >= bedD) {
      const prevR = r - step;
      const prevD = txDepth + prevR * sinA;
      const prevBed = getDepthAt(lateralX, bowZ + prevR * cosA);
      const denom = (d - prevD) - (bedD - prevBed);
      const frac = Math.max(0, Math.min(1, denom !== 0 ? (prevBed - prevD) / denom : 0.5));
      const hitR = Math.min(maxReachFt, prevR + frac * step);
      return { r: hitR, fwd: hitR * cosA, depth: txDepth + hitR * sinA, hitBottom: true };
    }
  }
  return { r: maxReachFt, fwd: maxReachFt * cosA, depth: txDepth + maxReachFt * sinA, hitBottom: false };
}

/**
 * Evaluates whether a target falls within the 2D CHIRP conical beam.
 * Cone footprint radius = dy * tan(theta / 2).
 *
 * @param {number} relZ - Target Z coordinate in lake frame.
 * @param {number} lateralX - Target lateral distance from keel line (ft).
 * @param {number} depthFt - Target depth (ft).
 * @returns {false | { inCone: boolean, slantRange: number, distRatio: number, coneRadius: number }}
 */
export function isTargetIn2DCone(relZ, lateralX, depthFt) {
  const state = simState.get();
  if (!state.power['2d']) return false;
  const txZ = state.boatZ + state.txOffsetTransom;
  const txDepth = state.txDepth;
  const dy = depthFt - txDepth;
  if (dy <= 0.2) return false;

  const coneHalfAngleRad = ((state.tradAngleDeg / 2) * Math.PI) / 180;
  const coneRadiusAtDepth = dy * Math.tan(coneHalfAngleRad);
  const horizontalDistFromTransducer = Math.hypot(lateralX, relZ - txZ);

  if (horizontalDistFromTransducer <= coneRadiusAtDepth) {
    const slantRange = Math.hypot(lateralX, relZ - txZ, dy);
    const distRatio = horizontalDistFromTransducer / coneRadiusAtDepth;
    return { inCone: true, slantRange, distRatio, coneRadius: coneRadiusAtDepth };
  }
  return false;
}

/**
 * Evaluates whether a target is inside the Panoptix LiveScope phased-array forward fan.
 *
 * @param {number} relZ - Target Z coordinate.
 * @param {number} lateralX - Lateral distance (ft).
 * @param {number} depthFt - Target depth (ft).
 * @returns {false | { fwdDist: number, depth: number, r3D: number, angle: number }}
 */
export function isTargetInLiveScope(relZ, lateralX, depthFt) {
  const state = simState.get();
  if (!state.power['live']) return false;
  const txZ = state.boatZ + state.txOffsetBow;
  const txDepth = state.txDepth;
  const fwdDist = relZ - txZ;
  if (fwdDist < 0.2) return false;

  const bedDepth = getDepthAt(lateralX, relZ);
  if (depthFt > bedDepth + 0.2) return false;

  const dy = Math.max(0.1, depthFt - txDepth);
  const r2D = Math.hypot(fwdDist, dy);
  const r3D = Math.hypot(fwdDist, dy, lateralX);
  const maxLiveRange = 60;
  if (r3D > maxLiveRange) return false;

  const targetAngleRad = Math.atan2(dy, fwdDist);
  const tiltRad = (state.liveTiltDeg * Math.PI) / 180;
  const spreadRad = (state.liveSpreadDeg * Math.PI) / 180;
  const minAngle = tiltRad - spreadRad / 2;
  const maxAngle = tiltRad + spreadRad / 2;
  if (targetAngleRad < minAngle || targetAngleRad > maxAngle) return false;

  const rayHit = getLiveRayReach(targetAngleRad, maxLiveRange, txZ, lateralX);
  if (r2D > rayHit.r + 0.4) return false;

  const azimuthRad = Math.atan2(Math.abs(lateralX), r2D);
  const maxAzimuthRad = (20 / 2) * Math.PI / 180;
  if (azimuthRad > maxAzimuthRad) return false;

  return { fwdDist, depth: depthFt, r3D, angle: targetAngleRad };
}

/**
 * Evaluates whether a target is sliced by the ClearVü DownScan razor beam.
 *
 * @param {number} relZ - Target Z coordinate.
 * @param {number} lateralX - Lateral offset (ft).
 * @param {number} depthFt - Depth (ft).
 * @param {number} [targetWidth=1.5] - Physical target width (ft).
 * @returns {boolean}
 */
export function isTargetInClearVu(relZ, lateralX, depthFt, targetWidth = 1.5) {
  const state = simState.get();
  if (!state.power['clear']) return false;
  const txZ = state.boatZ + state.txOffsetTransom;
  const txDepth = state.txDepth;
  const dy = depthFt - txDepth;
  if (dy <= 0.2) return false;
  const spanFt = Math.max(1.5, targetWidth);
  if (Math.abs(relZ - txZ) > spanFt / 2) return false;
  const clearHalfAngleRad = (((state.clearAngleDeg || 45) / 2) * Math.PI) / 180;
  const lateralReach = dy * Math.tan(clearHalfAngleRad);
  return Math.abs(lateralX) <= (lateralReach + targetWidth * 0.4);
}

/**
 * Evaluates whether a target is traversed by the SideVü bilateral swath.
 *
 * @param {number} relZ - Target Z coordinate.
 * @param {number} lateralX - Lateral offset (ft).
 * @param {number} [targetWidth=1.5] - Physical target span (ft).
 * @returns {boolean}
 */
export function isTargetInSideVu(relZ, lateralX, targetWidth = 1.5) {
  const state = simState.get();
  if (!state.power['side']) return false;
  const txZ = state.boatZ + state.txOffsetTransom;
  const thickRad = (((state.sideSliceThickDeg || 1.2) / 2) * Math.PI) / 180;
  const acousticThickFt = Math.max(0.8, (state.lakeDepthFt - state.txDepth) * Math.tan(thickRad) * 2.2);
  const totalSpanFt = Math.max(acousticThickFt, targetWidth);
  if (Math.abs(relZ - txZ) > totalSpanFt / 2) return false;

  const sweepDeg = state.sideSweepDeg || state.sideSweepAngleDeg || 55;
  const sweepRad = (sweepDeg * Math.PI) / 180;
  const maxSweepReach = Math.min(state.sideRangeFt, Math.max(12, (state.lakeDepthFt - state.txDepth) * Math.tan(sweepRad)));
  return Math.abs(lateralX) <= (maxSweepReach + targetWidth * 0.5);
}
