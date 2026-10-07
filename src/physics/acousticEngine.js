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
 * Raycasts from the bow transducer along an acoustic angle and azimuth to locate lakebed intersection.
 *
 * @param {number} angleRad - Beam angle in radians from horizontal downwards.
 * @param {number} maxReachFt - Maximum acoustic range in feet.
 * @param {number} bowZ - Bow transducer Z coordinate in world space.
 * @param {number} [lateralX=0] - Lateral offset in feet.
 * @param {number} [azimuthRad=0] - Azimuth heading in radians (0 = straight ahead along +Z).
 * @returns {{ r: number, fwd: number, depth: number, hitBottom: boolean }}
 */
export function getLiveRayReach(angleRad, maxReachFt, bowZ, lateralX = 0, azimuthRad = 0) {
  const state = simState.get();
  const txDepth = state.txDepth;
  const sinA = Math.sin(angleRad);
  const cosA = Math.cos(angleRad);
  const cosAz = Math.cos(azimuthRad);
  const sinAz = Math.sin(azimuthRad);
  const step = 0.8;

  for (let r = step; r <= maxReachFt; r += step) {
    const horizDist = r * cosA;
    const fwdZ = horizDist * cosAz;
    const sideX = lateralX + horizDist * sinAz;
    const d = txDepth + r * sinA;
    const bedD = getDepthAt(sideX, bowZ + fwdZ);
    if (d >= bedD) {
      const prevR = r - step;
      const prevHoriz = prevR * cosA;
      const prevD = txDepth + prevR * sinA;
      const prevBed = getDepthAt(lateralX + prevHoriz * sinAz, bowZ + prevHoriz * cosAz);
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
 * Evaluates whether a target is inside the Panoptix LiveScope phased-array beam
 * across Forward, Down, and Perspective directional modes, accounting for beam azimuth rotation.
 *
 * @param {number} relZ - Target Z coordinate in lake frame.
 * @param {number} lateralX - Lateral distance from keel line (ft).
 * @param {number} depthFt - Target depth (ft).
 * @returns {false | { fwdDist: number, depth: number, r3D: number, angle: number, beamX: number, beamY: number, beamZ: number }}
 */
export function isTargetInLiveScope(relZ, lateralX, depthFt) {
  const state = simState.get();
  if (!state.power['live']) return false;
  const txZ = state.boatZ + state.txOffsetBow;
  const txDepth = state.txDepth;
  const mode = state.liveMode || 'forward';
  const rotationDeg = state.liveRotationDeg || 0;
  const rotRad = (rotationDeg * Math.PI) / 180;

  // Relative vector from bow transducer to target in lake coordinates
  const dX = lateralX;
  const dZ = relZ - txZ;
  const dY = Math.max(0.05, depthFt - txDepth);

  // Rotate target coordinates into the beam's local reference frame
  // rotRad = 0 -> beam directed straight forward along +dZ (boat travel heading)
  // rotRad > 0 -> beam rotated clockwise / to starboard (+dX)
  // rotRad < 0 -> beam rotated counter-clockwise / to port (-dX)
  const beamForward = dZ * Math.cos(rotRad) + dX * Math.sin(rotRad);
  const beamCross = -dZ * Math.sin(rotRad) + dX * Math.cos(rotRad);

  const bedDepth = getDepthAt(lateralX, relZ);
  if (depthFt > bedDepth + 0.2) return false;

  const maxLiveRange = 60;
  const r3D = Math.hypot(beamForward, beamCross, dY);
  if (r3D > maxLiveRange) return false;

  if (mode === 'perspective') {
    // PERSPECTIVE MODE:
    // Transducer oriented horizontally for shallow-water shoreline scanning.
    // Wide horizontal fan (135° total azimuth = ±67.5°), narrow vertical elevation slice (~20°).
    if (beamForward < 0.2) return false;

    // Azimuth coverage check (135° horizontal sweep)
    const horizAngle = Math.atan2(Math.abs(beamCross), beamForward);
    const maxHorizAngle = (135 / 2) * Math.PI / 180;
    if (horizAngle > maxHorizAngle) return false;

    // Vertical elevation thickness check (20° beam thickness)
    const vertAngle = Math.atan2(dY, Math.hypot(beamForward, beamCross));
    const maxVertAngle = (22 / 2) * Math.PI / 180;
    if (vertAngle > maxVertAngle) return false;

    return {
      fwdDist: beamForward,
      depth: depthFt,
      r3D,
      angle: vertAngle,
      beamX: beamCross,
      beamY: dY,
      beamZ: beamForward
    };
  } else if (mode === 'down') {
    // DOWN MODE:
    // LiveScope transducer pointed straight down beneath the hull.
    // 135° fore-and-aft / span slice beneath boat, 20° cross-beam thickness.
    if (dY < 0.5) return false;

    const spanDist = Math.abs(beamForward);
    const downSpreadRad = (135 / 2) * Math.PI / 180;
    const vertAngleFromNadir = Math.atan2(spanDist, dY);
    if (vertAngleFromNadir > downSpreadRad) return false;

    // Cross-beam thickness
    const crossAngle = Math.atan2(Math.abs(beamCross), Math.hypot(spanDist, dY));
    const maxCrossAngle = (20 / 2) * Math.PI / 180;
    if (crossAngle > maxCrossAngle) return false;

    return {
      fwdDist: beamForward,
      depth: depthFt,
      r3D,
      angle: vertAngleFromNadir,
      beamX: beamCross,
      beamY: dY,
      beamZ: beamForward
    };
  } else {
    // FORWARD MODE (Default):
    // Phased array fan projected ahead along beam azimuth.
    if (beamForward < 0.2) return false;

    const r2D = Math.hypot(beamForward, dY);
    const targetAngleRad = Math.atan2(dY, beamForward);
    const tiltRad = ((state.liveTiltDeg ?? 45) * Math.PI) / 180;
    const spreadRad = ((state.liveSpreadDeg ?? 40) * Math.PI) / 180;
    const minAngle = tiltRad - spreadRad / 2;
    const maxAngle = tiltRad + spreadRad / 2;
    if (targetAngleRad < minAngle || targetAngleRad > maxAngle) return false;

    const rayHit = getLiveRayReach(targetAngleRad, maxLiveRange, txZ, lateralX, rotRad);
    if (r2D > rayHit.r + 0.4) return false;

    const azimuthRad = Math.atan2(Math.abs(beamCross), r2D);
    const maxAzimuthRad = (20 / 2) * Math.PI / 180;
    if (azimuthRad > maxAzimuthRad) return false;

    return {
      fwdDist: beamForward,
      depth: depthFt,
      r3D,
      angle: targetAngleRad,
      beamX: beamCross,
      beamY: dY,
      beamZ: beamForward
    };
  }
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
