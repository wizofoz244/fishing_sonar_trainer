/**
 * @file lake3D.js
 * @description Pure HTML5 2D Canvas isometric lake renderer with volumetric acoustic wedges.
 */

import { simState } from '../state/simState.js';
import { getDepthAt, getLiveRayReach, isTargetIn2DCone, isTargetInLiveScope, isTargetInClearVu, isTargetInSideVu } from '../physics/acousticEngine.js';
import { structures, fishList, lure } from '../physics/targets.js';

export const hitBoxes3D = [];

/**
 * Projects 3D world coordinates (x, y, z) to 2D isometric screen canvas space.
 *
 * @param {number} x - Lateral position in ft.
 * @param {number} y - Depth in ft.
 * @param {number} z - Longitudinal position in ft.
 * @param {number} originX - Canvas origin X in px.
 * @param {number} originY - Canvas origin Y in px.
 * @param {number} scale - Pixels per foot scaling factor.
 * @returns {{ x: number, y: number }}
 */
export function project3D(x, y, z, originX, originY, scale) {
  const state = simState.get();
  let isoXAngle, isoZAngle, depthScale;
  if (state.cameraPreset === 'steep') {
    isoXAngle = 0.88; isoZAngle = 0.52; depthScale = 0.95;
  } else if (state.cameraPreset === 'low') {
    isoXAngle = 0.98; isoZAngle = 0.28; depthScale = 0.65;
  } else {
    isoXAngle = 0.92; isoZAngle = 0.42; depthScale = 0.82;
  }
  const screenX = originX + (x * isoXAngle - z * isoZAngle) * scale;
  const screenY = originY + (y * depthScale + (x * 0.18 + z * 0.48)) * scale;
  return { x: screenX, y: screenY };
}

/**
 * Unprojects 2D screen mouse coordinates back to 3D world space at target water depth.
 *
 * @param {number} screenX
 * @param {number} screenY
 * @param {HTMLCanvasElement} canvas
 * @returns {{ x: number, y: number, z: number }}
 */
export function unproject3D(screenX, screenY, canvas) {
  const state = simState.get();
  const w = canvas.width || 800;
  const h = canvas.height || 600;
  const originX = w * 0.52;
  const originY = h * 0.18;
  const scale = Math.min(w, h) / 125;

  let isoXAngle = 0.92, isoZAngle = 0.42, depthScale = 0.82;
  if (state.cameraPreset === 'steep') {
    isoXAngle = 0.88; isoZAngle = 0.52; depthScale = 0.95;
  } else if (state.cameraPreset === 'low') {
    isoXAngle = 0.98; isoZAngle = 0.28; depthScale = 0.65;
  }

  const dx = (screenX - originX) / scale;
  const targetY = state.lakeDepthFt * 0.6;
  const dy = (screenY - originY) / scale - (targetY * depthScale);

  const det = (isoXAngle * 0.48) + (isoZAngle * 0.18);
  const x = ((dx * 0.48) + (dy * isoZAngle)) / det;
  const z = ((isoXAngle * dy) - (0.18 * dx)) / det;

  const clampedX = Math.max(-55, Math.min(55, x));
  const clampedZ = Math.max(5, Math.min(125, z));
  const bedD = getDepthAt(clampedX, clampedZ);
  const actualY = Math.min(bedD - 1.5, Math.max(2.0, targetY));

  return { x: clampedX, y: actualY, z: clampedZ };
}

export function drawCorrelationBadge(ctx, x, y, tag, name, color, shapeHint, isSelected = false) {
  ctx.save();
  ctx.font = 'bold 9px monospace';
  const tagText = isSelected ? `★ [${tag}] ${name}` : `[${tag}] ${name}`;
  const metrics = ctx.measureText(tagText);
  const boxW = Math.max(54, metrics.width + 10);
  const boxH = shapeHint ? 22 : 14;

  const drawX = Math.round(x - boxW / 2);
  const drawY = Math.round(y - boxH);

  ctx.fillStyle = isSelected ? 'rgba(66, 32, 6, 0.95)' : 'rgba(2, 6, 23, 0.88)';
  ctx.fillRect(drawX, drawY, boxW, boxH);
  ctx.strokeStyle = isSelected ? '#facc15' : (color || '#38bdf8');
  ctx.lineWidth = isSelected ? 2 : 1.2;
  ctx.strokeRect(drawX, drawY, boxW, boxH);

  ctx.fillStyle = isSelected ? '#fef08a' : (color || '#38bdf8');
  ctx.fillText(tagText, drawX + 5, drawY + 10);

  if (shapeHint) {
    ctx.font = '8px monospace';
    ctx.fillStyle = isSelected ? '#fed7aa' : '#94a3b8';
    ctx.fillText(`⤹ ${shapeHint}`, drawX + 5, drawY + 19);
  }
  ctx.restore();
}

export function render3DLake(canvas, ctx, dragState) {
  if (!ctx || canvas.width === 0) return;
  const state = simState.get();
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  hitBoxes3D.length = 0;

  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.45);
  skyGrad.addColorStop(0, '#060d1a');
  skyGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  const originX = w * 0.52;
  const originY = h * 0.18;
  const scale = Math.min(w, h) / 125;
  const lakeWidthHalf = 65;
  const depth = state.lakeDepthFt;
  const length = 135;

  renderLakeFloor3D(ctx, originX, originY, scale, lakeWidthHalf, depth, length);
  renderStructures3D(ctx, originX, originY, scale);
  renderAcousticBeams3D(ctx, originX, originY, scale, depth, lakeWidthHalf);
  renderWaterSurface3D(ctx, originX, originY, scale, lakeWidthHalf, depth, length);
  renderBoat3D(ctx, originX, originY, scale);
  renderLure3D(ctx, originX, originY, scale);
  renderFish3D(ctx, originX, originY, scale);
  if (dragState && dragState.active && dragState.coords3D) {
    renderDragHologram3D(ctx, originX, originY, scale, dragState);
  }
}

function renderLakeFloor3D(ctx, ox, oy, s, wHalf, depth, len) {
  const state = simState.get();
  const stepX = 13;
  const stepZ = 7.5;
  const zScrollOffset = (state.worldZ % stepZ);

  for (let z = 0; z < len; z += stepZ) {
    const z0 = Math.max(0, z - zScrollOffset);
    const z1 = Math.min(len, z + stepZ - zScrollOffset);
    if (z1 <= z0) continue;

    for (let x = -wHalf; x < wHalf; x += stepX) {
      const x0 = x;
      const x1 = Math.min(wHalf, x + stepX);

      const d00 = getDepthAt(x0, z0);
      const d10 = getDepthAt(x1, z0);
      const d11 = getDepthAt(x1, z1);
      const d01 = getDepthAt(x0, z1);

      const p00 = project3D(x0, d00, z0, ox, oy, s);
      const p10 = project3D(x1, d10, z0, ox, oy, s);
      const p11 = project3D(x1, d11, z1, ox, oy, s);
      const p01 = project3D(x0, d01, z1, ox, oy, s);

      const avgD = (d00 + d10 + d11 + d01) * 0.25;
      const slope = (d01 - d00) * 0.5 + (d10 - d00) * 0.3;
      const depthShade = Math.max(0.12, Math.min(0.38, 0.35 - (avgD / 70) * 0.18 + slope * 0.02));

      ctx.fillStyle = `rgba(30, 48, 75, ${depthShade.toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.40)';
  ctx.lineWidth = 1;
  for (let z = 0; z <= len + stepZ; z += stepZ * 2) {
    const drawZ = z - zScrollOffset;
    if (drawZ >= 0 && drawZ <= len) {
      ctx.beginPath();
      for (let x = -wHalf; x <= wHalf; x += stepX) {
        const zDepth = getDepthAt(x, drawZ);
        const pt = project3D(x, zDepth, drawZ, ox, oy, s);
        if (x === -wHalf) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
  }
}

function renderWaterSurface3D(ctx, ox, oy, s, wHalf, depth, len) {
  const state = simState.get();
  const s1 = project3D(-wHalf, 0, 0, ox, oy, s);
  const s2 = project3D(wHalf, 0, 0, ox, oy, s);
  const s3 = project3D(wHalf, 0, len, ox, oy, s);
  const s4 = project3D(-wHalf, 0, len, ox, oy, s);

  ctx.fillStyle = `rgba(2, 132, 199, ${state.waterAlpha * 0.25})`;
  ctx.beginPath();
  ctx.moveTo(s1.x, s1.y);
  ctx.lineTo(s2.x, s2.y);
  ctx.lineTo(s3.x, s3.y);
  ctx.lineTo(s4.x, s4.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function renderAcousticBeams3D(ctx, ox, oy, s, depth, lakeWidthHalf = 65) {
  const state = simState.get();
  if (!state.showIllustrations) return;
  const bZ = state.boatZ || 35;
  const txZ = bZ + state.txOffsetTransom;
  const bowZ = bZ + state.txOffsetBow;
  const txDepth = state.txDepth;
  const txPos = project3D(0, txDepth, txZ, ox, oy, s);
  const pKeelBottom = project3D(0, depth, txZ, ox, oy, s);

  // 1. Traditional 2D Cone
  if (state.power['2d']) {
    const coneHalfAngleRad = ((state.tradAngleDeg / 2) * Math.PI) / 180;
    const dy = depth - txDepth;
    const coneR = dy * Math.tan(coneHalfAngleRad);
    const numBasePts = 24;
    const basePts = [];

    for (let i = 0; i < numBasePts; i++) {
      const theta = (i / numBasePts) * 2 * Math.PI;
      const x = coneR * Math.cos(theta);
      const z = txZ + coneR * Math.sin(theta);
      basePts.push(project3D(x, depth, z, ox, oy, s));
    }

    ctx.beginPath();
    ctx.moveTo(basePts[0].x, basePts[0].y);
    for (let i = 1; i < numBasePts; i++) ctx.lineTo(basePts[i].x, basePts[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const coneGrad = ctx.createRadialGradient(txPos.x, txPos.y, 5, pKeelBottom.x, pKeelBottom.y, depth * s);
    coneGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    coneGrad.addColorStop(0.6, 'rgba(14, 165, 233, 0.15)');
    coneGrad.addColorStop(1, 'rgba(2, 132, 199, 0.04)');

    ctx.beginPath();
    ctx.moveTo(txPos.x, txPos.y);
    for (let i = 0; i < numBasePts; i++) ctx.lineTo(basePts[i].x, basePts[i].y);
    ctx.closePath();
    ctx.fillStyle = coneGrad;
    ctx.fill();
  }

  // 2. ClearVü Razor Wedge & Ribbon
  if (state.power['clear']) {
    const clearHalfAngleRad = (((state.clearAngleDeg || 45) / 2) * Math.PI) / 180;
    const halfLateralReach = (depth - txDepth) * Math.tan(clearHalfAngleRad);
    const sliceThickFt = 1.5;
    const zAft = txZ - sliceThickFt / 2;
    const zFore = txZ + sliceThickFt / 2;

    const txClearFore = project3D(0, txDepth, zFore, ox, oy, s);
    const txClearAft = project3D(0, txDepth, zAft, ox, oy, s);

    const d1 = getDepthAt(-halfLateralReach, zAft);
    const d2 = getDepthAt(halfLateralReach, zAft);
    const d3 = getDepthAt(halfLateralReach, zFore);
    const d4 = getDepthAt(-halfLateralReach, zFore);

    const p1 = project3D(-halfLateralReach, d1, zAft, ox, oy, s);
    const p2 = project3D(halfLateralReach, d2, zAft, ox, oy, s);
    const p3 = project3D(halfLateralReach, d3, zFore, ox, oy, s);
    const p4 = project3D(-halfLateralReach, d4, zFore, ox, oy, s);

    // Water-column acoustic curtain gradient
    const clearCurtainGrad = ctx.createLinearGradient(txPos.x, txPos.y, pKeelBottom.x, pKeelBottom.y);
    clearCurtainGrad.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
    clearCurtainGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.20)');
    clearCurtainGrad.addColorStop(1, 'rgba(180, 83, 9, 0.05)');

    // Fore curtain face
    ctx.fillStyle = clearCurtainGrad;
    ctx.beginPath();
    ctx.moveTo(txClearFore.x, txClearFore.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fill();

    // Aft curtain face
    ctx.beginPath();
    ctx.moveTo(txClearAft.x, txClearAft.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.fill();

    // Lateral port/starboard edge curtains
    ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
    ctx.beginPath();
    ctx.moveTo(txClearAft.x, txClearAft.y);
    ctx.lineTo(txClearFore.x, txClearFore.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(txClearAft.x, txClearAft.y);
    ctx.lineTo(txClearFore.x, txClearFore.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.fill();

    // Lakebed footprint ribbon
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Acoustic beam boundary guide lines from transducer to lakebed
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(txClearFore.x, txClearFore.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.moveTo(txClearFore.x, txClearFore.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.moveTo(txClearAft.x, txClearAft.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.moveTo(txClearAft.x, txClearAft.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // 3. SideVü Fans
  if (state.power['side']) {
    const sweepDeg = state.sideSweepDeg || state.sideSweepAngleDeg || 55;
    const sweepRad = (sweepDeg * Math.PI) / 180;
    const maxSweepReach = Math.min(lakeWidthHalf, Math.max(16, (depth - txDepth) * Math.tan(sweepRad)));
    const thickRad = (((state.sideSliceThickDeg || 1.2) / 2) * Math.PI) / 180;
    const halfThickFt = Math.max(0.4, (depth - txDepth) * Math.tan(thickRad) * 2.2);

    const zFore = txZ + halfThickFt;
    const zAft = txZ - halfThickFt;

    const txFore = project3D(0, txDepth, zFore, ox, oy, s);
    const txAft = project3D(0, txDepth, zAft, ox, oy, s);

    const surfDepth = Math.max(0.5, txDepth * 0.9);
    const pSurfPortFore = project3D(-maxSweepReach, surfDepth, zFore, ox, oy, s);
    const pSurfPortAft = project3D(-maxSweepReach, surfDepth, zAft, ox, oy, s);
    const pSurfStbdFore = project3D(maxSweepReach, surfDepth, zFore, ox, oy, s);
    const pSurfStbdAft = project3D(maxSweepReach, surfDepth, zAft, ox, oy, s);

    const pBedPortFore = project3D(-maxSweepReach, getDepthAt(-maxSweepReach, zFore), zFore, ox, oy, s);
    const pBedPortAft = project3D(-maxSweepReach, getDepthAt(-maxSweepReach, zAft), zAft, ox, oy, s);
    const pBedStbdFore = project3D(maxSweepReach, getDepthAt(maxSweepReach, zFore), zFore, ox, oy, s);
    const pBedStbdAft = project3D(maxSweepReach, getDepthAt(maxSweepReach, zAft), zAft, ox, oy, s);
    const pKeelFore = project3D(0, depth, zFore, ox, oy, s);

    // Port Wing
    const portCurtainGrad = ctx.createLinearGradient(txFore.x, txFore.y, pSurfPortFore.x, pSurfPortFore.y);
    portCurtainGrad.addColorStop(0, 'rgba(192, 132, 252, 0.45)');
    portCurtainGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.28)');
    portCurtainGrad.addColorStop(1, 'rgba(147, 51, 234, 0.10)');

    ctx.fillStyle = portCurtainGrad;
    ctx.beginPath();
    ctx.moveTo(txFore.x, txFore.y);
    ctx.lineTo(pSurfPortFore.x, pSurfPortFore.y);
    ctx.lineTo(pBedPortFore.x, pBedPortFore.y);
    ctx.lineTo(pKeelFore.x, pKeelFore.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
    ctx.beginPath();
    ctx.moveTo(txFore.x, txFore.y);
    ctx.lineTo(pSurfPortFore.x, pSurfPortFore.y);
    ctx.lineTo(pSurfPortAft.x, pSurfPortAft.y);
    ctx.lineTo(txAft.x, txAft.y);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pSurfPortFore.x, pSurfPortFore.y);
    ctx.lineTo(pBedPortFore.x, pBedPortFore.y);
    ctx.lineTo(pBedPortAft.x, pBedPortAft.y);
    ctx.lineTo(pSurfPortAft.x, pSurfPortAft.y);
    ctx.closePath();
    ctx.fill();

    // Starboard Wing
    const stbdCurtainGrad = ctx.createLinearGradient(txFore.x, txFore.y, pSurfStbdFore.x, pSurfStbdFore.y);
    stbdCurtainGrad.addColorStop(0, 'rgba(192, 132, 252, 0.45)');
    stbdCurtainGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.28)');
    stbdCurtainGrad.addColorStop(1, 'rgba(147, 51, 234, 0.10)');

    ctx.fillStyle = stbdCurtainGrad;
    ctx.beginPath();
    ctx.moveTo(txFore.x, txFore.y);
    ctx.lineTo(pSurfStbdFore.x, pSurfStbdFore.y);
    ctx.lineTo(pBedStbdFore.x, pBedStbdFore.y);
    ctx.lineTo(pKeelFore.x, pKeelFore.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
    ctx.beginPath();
    ctx.moveTo(txFore.x, txFore.y);
    ctx.lineTo(pSurfStbdFore.x, pSurfStbdFore.y);
    ctx.lineTo(pSurfStbdAft.x, pSurfStbdAft.y);
    ctx.lineTo(txAft.x, txAft.y);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pSurfStbdFore.x, pSurfStbdFore.y);
    ctx.lineTo(pBedStbdFore.x, pBedStbdFore.y);
    ctx.lineTo(pBedStbdAft.x, pBedStbdAft.y);
    ctx.lineTo(pSurfStbdAft.x, pSurfStbdAft.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(txFore.x, txFore.y);
    ctx.lineTo(pSurfPortFore.x, pSurfPortFore.y);
    ctx.lineTo(pBedPortFore.x, pBedPortFore.y);
    ctx.lineTo(pKeelFore.x, pKeelFore.y);
    ctx.moveTo(txFore.x, txFore.y);
    ctx.lineTo(pSurfStbdFore.x, pSurfStbdFore.y);
    ctx.lineTo(pBedStbdFore.x, pBedStbdFore.y);
    ctx.lineTo(pKeelFore.x, pKeelFore.y);
    ctx.stroke();
  }

  // 4. LiveScope Phased Array (20° Azimuth × Elevation Wedge with Lakebed Footprint)
  if (state.power['live']) {
    const txLive = project3D(0, txDepth, bowZ, ox, oy, s);
    const liveReach = 55;
    const tiltRad = (state.liveTiltDeg * Math.PI) / 180;
    const spreadRad = (state.liveSpreadDeg * Math.PI) / 180;
    const halfAzimuthRad = (20 / 2) * Math.PI / 180;

    const minAngle = Math.max(0.12, tiltRad - spreadRad / 2);
    const maxAngle = Math.min(Math.PI / 2 - 0.05, tiltRad + spreadRad / 2);
    const numArcSteps = 24;

    const portRays = [];
    const stbdRays = [];
    const bottomPtsPort = [];
    const bottomPtsStbd = [];

    for (let i = 0; i <= numArcSteps; i++) {
      const angle = minAngle + (i / numArcSteps) * (maxAngle - minAngle);
      // Raycast center to determine reach
      const ray = getLiveRayReach(angle, liveReach, bowZ, 0);
      const lateralWidth = Math.sin(halfAzimuthRad) * ray.r;

      // Calculate 3D points for port and starboard boundaries
      const pPort = project3D(-lateralWidth, ray.depth, bowZ + ray.fwd, ox, oy, s);
      const pStbd = project3D(lateralWidth, ray.depth, bowZ + ray.fwd, ox, oy, s);

      portRays.push({ p: pPort, ray, lateral: -lateralWidth });
      stbdRays.push({ p: pStbd, ray, lateral: lateralWidth });

      if (ray.hitBottom) {
        bottomPtsPort.push(pPort);
        bottomPtsStbd.push(pStbd);
      }
    }

    // 4a. Shaded Lakebed Bottom Intersection Footprint
    if (bottomPtsPort.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bottomPtsStbd[0].x, bottomPtsStbd[0].y);
      for (let i = 1; i < bottomPtsStbd.length; i++) {
        ctx.lineTo(bottomPtsStbd[i].x, bottomPtsStbd[i].y);
      }
      for (let i = bottomPtsPort.length - 1; i >= 0; i--) {
        ctx.lineTo(bottomPtsPort[i].x, bottomPtsPort[i].y);
      }
      ctx.closePath();

      // Glowing lakebed acoustic return fill
      ctx.fillStyle = 'rgba(16, 185, 129, 0.40)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.90)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 4b. Port Lateral Acoustic Curtain Face
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(txLive.x, txLive.y);
    for (let i = 0; i <= numArcSteps; i++) {
      ctx.lineTo(portRays[i].p.x, portRays[i].p.y);
    }
    ctx.closePath();
    const portGrad = ctx.createLinearGradient(
      txLive.x, txLive.y,
      portRays[Math.floor(numArcSteps / 2)].p.x, portRays[Math.floor(numArcSteps / 2)].p.y
    );
    portGrad.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
    portGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.16)');
    portGrad.addColorStop(1, 'rgba(5, 150, 105, 0.04)');
    ctx.fillStyle = portGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.50)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 4c. Starboard Lateral Acoustic Curtain Face
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(txLive.x, txLive.y);
    for (let i = 0; i <= numArcSteps; i++) {
      ctx.lineTo(stbdRays[i].p.x, stbdRays[i].p.y);
    }
    ctx.closePath();
    const stbdGrad = ctx.createLinearGradient(
      txLive.x, txLive.y,
      stbdRays[Math.floor(numArcSteps / 2)].p.x, stbdRays[Math.floor(numArcSteps / 2)].p.y
    );
    stbdGrad.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
    stbdGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.16)');
    stbdGrad.addColorStop(1, 'rgba(5, 150, 105, 0.04)');
    ctx.fillStyle = stbdGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.50)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 4d. Top Limit Face of the Wedge (from Transducer to shallowest beam boundary)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(txLive.x, txLive.y);
    ctx.lineTo(stbdRays[0].p.x, stbdRays[0].p.y);
    ctx.lineTo(portRays[0].p.x, portRays[0].p.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.70)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // 4e. Bottom Limit Face of the Wedge (from Transducer to deepest beam boundary)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(txLive.x, txLive.y);
    ctx.lineTo(stbdRays[numArcSteps].p.x, stbdRays[numArcSteps].p.y);
    ctx.lineTo(portRays[numArcSteps].p.x, portRays[numArcSteps].p.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.70)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // 4f. Front Wavefront / Mid-Beam Volume Fill
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(portRays[0].p.x, portRays[0].p.y);
    for (let i = 0; i <= numArcSteps; i++) {
      ctx.lineTo(stbdRays[i].p.x, stbdRays[i].p.y);
    }
    for (let i = numArcSteps; i >= 0; i--) {
      ctx.lineTo(portRays[i].p.x, portRays[i].p.y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // 4g. Key Acoustic Ridge / Guideline Lines from Transducer
    ctx.save();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // 4 corner rails of the pyramid/wedge
    ctx.moveTo(txLive.x, txLive.y);
    ctx.lineTo(portRays[0].p.x, portRays[0].p.y);
    ctx.moveTo(txLive.x, txLive.y);
    ctx.lineTo(stbdRays[0].p.x, stbdRays[0].p.y);
    ctx.moveTo(txLive.x, txLive.y);
    ctx.lineTo(portRays[numArcSteps].p.x, portRays[numArcSteps].p.y);
    ctx.moveTo(txLive.x, txLive.y);
    ctx.lineTo(stbdRays[numArcSteps].p.x, stbdRays[numArcSteps].p.y);
    ctx.stroke();
    ctx.restore();
  }
}

function renderBoat3D(ctx, ox, oy, s) {
  const state = simState.get();
  const bZ = state.boatZ || 35;
  const bow = project3D(0, 0, bZ + 14, ox, oy, s);
  const stern = project3D(0, 0, bZ - 4, ox, oy, s);
  const portGunwale = project3D(-3.2, 0, bZ + 4, ox, oy, s);
  const stbdGunwale = project3D(3.2, 0, bZ + 4, ox, oy, s);

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bow.x, bow.y);
  ctx.lineTo(portGunwale.x, portGunwale.y);
  ctx.lineTo(stern.x, stern.y);
  ctx.lineTo(stbdGunwale.x, stbdGunwale.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const ducer = project3D(0, state.txDepth, bZ + state.txOffsetTransom, ox, oy, s);
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.arc(ducer.x, ducer.y, 3, 0, Math.PI * 2);
  ctx.fill();

  const bowDucer = project3D(0, state.txDepth, bZ + state.txOffsetBow, ox, oy, s);
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(bowDucer.x, bowDucer.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function renderStructures3D(ctx, ox, oy, s) {
  const state = simState.get();
  const now = performance.now();
  structures.forEach(st => {
    const relZ = ((st.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
    if (relZ < 125) {
      const zDepth = getDepthAt(st.x, relZ);
      const treeHeight = st.height || 10;
      const trunkRadius = Math.max(1.2, (st.width || 8) * 0.16);
      const isSelected = (state.selectedTargetId === st.id);

      if (st.type === 'boulder') {
        const rw = st.width * 0.5;
        const rh = st.height;
        const rz = rw * 0.85;

        const vBaseL  = project3D(st.x - rw * 0.95, zDepth, relZ - rz * 0.3, ox, oy, s);
        const vBaseFL = project3D(st.x - rw * 0.50, zDepth, relZ + rz * 0.8, ox, oy, s);
        const vBaseFR = project3D(st.x + rw * 0.55, zDepth, relZ + rz * 0.7, ox, oy, s);
        const vBaseR  = project3D(st.x + rw * 0.90, zDepth, relZ - rz * 0.2, ox, oy, s);
        const vTopFL  = project3D(st.x - rw * 0.30, zDepth - rh * 0.92, relZ + rz * 0.30, ox, oy, s);
        const vTopFR  = project3D(st.x + rw * 0.25, zDepth - rh * 0.96, relZ + rz * 0.20, ox, oy, s);
        const vTopB   = project3D(st.x - rw * 0.05, zDepth - rh * 1.00, relZ - rz * 0.40, ox, oy, s);

        if (isSelected) {
          const pulse = Math.sin(now * 0.008) * 3;
          ctx.save();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(vTopB.x, vTopB.y + 6, 22 + pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(vTopB.x, 0);
          ctx.lineTo(vTopB.x, vBaseFL.y);
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = isSelected ? '#713f12' : '#475569';
        ctx.beginPath();
        ctx.moveTo(vBaseFL.x, vBaseFL.y);
        ctx.lineTo(vTopFL.x, vTopFL.y);
        ctx.lineTo(vTopFR.x, vTopFR.y);
        ctx.lineTo(vBaseFR.x, vBaseFR.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = isSelected ? '#fde047' : '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(vTopFL.x, vTopFL.y);
        ctx.lineTo(vTopB.x, vTopB.y);
        ctx.lineTo(vTopFR.x, vTopFR.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#eab308' : 'rgba(15, 23, 42, 0.75)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        hitBoxes3D.push({
          id: st.id,
          x: vTopB.x - 24,
          y: vTopB.y - 28,
          w: 48,
          h: 46
        });

        if (state.showCorrelationOverlay || isSelected) {
          drawCorrelationBadge(ctx, vTopB.x, vTopB.y - 12, st.tag || 'E1', st.name || 'Boulder', isSelected ? '#facc15' : '#94a3b8', 'SideVü Echo + Shadow', isSelected);
        }
      } else {
        const rBase = project3D(st.x, zDepth, relZ, ox, oy, s);
        const rTop = project3D(st.x, zDepth - treeHeight, relZ, ox, oy, s);

        if (isSelected) {
          const pulse = Math.sin(now * 0.008) * 3;
          ctx.save();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(rTop.x, rTop.y + 10, 24 + pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(rTop.x, 0);
          ctx.lineTo(rTop.x, rBase.y);
          ctx.stroke();
          ctx.restore();
        }

        ctx.strokeStyle = isSelected ? '#ea580c' : '#78350f';
        ctx.lineWidth = trunkRadius * 3.5;
        ctx.beginPath();
        ctx.moveTo(rBase.x, rBase.y);
        ctx.lineTo(rTop.x, rTop.y);
        ctx.stroke();

        ctx.strokeStyle = isSelected ? '#fbbf24' : '#b45309';
        ctx.lineWidth = trunkRadius * 1.5;
        ctx.beginPath();
        ctx.moveTo(rBase.x - 4, rBase.y);
        ctx.lineTo(rTop.x - 8, rTop.y + 6);
        ctx.stroke();

        hitBoxes3D.push({
          id: st.id,
          x: rTop.x - 22,
          y: rTop.y - 28,
          w: 44,
          h: 52
        });

        if (state.showCorrelationOverlay || isSelected) {
          drawCorrelationBadge(ctx, rTop.x, rTop.y - 14, st.tag || 'D1', st.name || 'Timber', isSelected ? '#facc15' : '#f59e0b', 'ClearVü Trunk & Limbs', isSelected);
        }
      }
    }
  });
}

function renderFish3D(ctx, ox, oy, s) {
  const state = simState.get();
  const now = performance.now();
  fishList.forEach(f => {
    const relZ = ((f.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
    if (relZ >= 0 && relZ < 130) {
      const zDepth = getDepthAt(f.x, relZ);
      const actualY = Math.min(zDepth - 1.8, f.y);
      const isSelected = (state.selectedTargetId === f.id);

      const hit2D = state.showIllustrations && isTargetIn2DCone(relZ, f.x, actualY);
      const hitLive = state.showIllustrations && isTargetInLiveScope(relZ, f.x, actualY);
      const hitClear = state.showIllustrations && isTargetInClearVu(relZ, f.x, actualY);
      const hitSide = state.showIllustrations && isTargetInSideVu(relZ, f.x, 2.0);

      const scaleMult = Math.max(1.3, f.size * 1.25);
      const len = 4.8 * scaleMult;
      const hBody = 1.6 * scaleMult;

      const wag = Math.sin(now * 0.007 + f.id * 1.7);
      const tailWagX = wag * 0.6 * scaleMult;

      let cBack = '#14532d', cFlank = '#22c55e', cBelly = '#86efac', cStroke = '#15803d';
      if (isSelected) {
        cBack = '#854d0e'; cFlank = '#facc15'; cBelly = '#fef08a'; cStroke = '#ffffff';
      } else if (hitLive) {
        cBack = '#065f46'; cFlank = '#10b981'; cBelly = '#a7f3d0'; cStroke = '#34d399';
      } else if (hit2D) {
        cBack = '#0369a1'; cFlank = '#38bdf8'; cBelly = '#bae6fd'; cStroke = '#7dd3fc';
      } else if (hitClear) {
        cBack = '#92400e'; cFlank = '#f59e0b'; cBelly = '#fde68a'; cStroke = '#fbbf24';
      } else if (hitSide) {
        cBack = '#581c87'; cFlank = '#c084fc'; cBelly = '#f3e8ff'; cStroke = '#e9d5ff';
      }

      const pSnout   = project3D(f.x, actualY, relZ + len * 0.50, ox, oy, s);
      const pCrown   = project3D(f.x, actualY - hBody * 0.40, relZ + len * 0.28, ox, oy, s);
      const pChin    = project3D(f.x, actualY + hBody * 0.35, relZ + len * 0.25, ox, oy, s);
      const pDorsal  = project3D(f.x, actualY - hBody * 0.58, relZ - len * 0.05, ox, oy, s);
      const pBelly   = project3D(f.x, actualY + hBody * 0.50, relZ - len * 0.05, ox, oy, s);
      const pPedTop  = project3D(f.x + tailWagX * 0.4, actualY - hBody * 0.25, relZ - len * 0.40, ox, oy, s);
      const pPedBot  = project3D(f.x + tailWagX * 0.4, actualY + hBody * 0.22, relZ - len * 0.40, ox, oy, s);
      const pTailTop = project3D(f.x + tailWagX * 0.9, actualY - hBody * 0.45, relZ - len * 0.65, ox, oy, s);
      const pTailMid = project3D(f.x + tailWagX * 0.7, actualY, relZ - len * 0.52, ox, oy, s);
      const pTailBot = project3D(f.x + tailWagX * 0.9, actualY + hBody * 0.45, relZ - len * 0.65, ox, oy, s);

      const pShadow = project3D(f.x, zDepth, relZ, ox, oy, s);
      ctx.strokeStyle = isSelected ? '#facc15' : 'rgba(148, 163, 184, 0.35)';
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(pBelly.x, pBelly.y);
      ctx.lineTo(pShadow.x, pShadow.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(pShadow.x, pShadow.y, 6 * s, 2.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        const pulse = Math.sin(now * 0.008) * 4;
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(pCrown.x, pCrown.y + 6, 20 + pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pCrown.x, 0);
        ctx.lineTo(pCrown.x, pShadow.y);
        ctx.stroke();
        ctx.restore();
      }

      // Caudal (Tail) Fin
      ctx.fillStyle = cFlank;
      ctx.beginPath();
      ctx.moveTo(pPedTop.x, pPedTop.y);
      ctx.lineTo(pTailTop.x, pTailTop.y);
      ctx.lineTo(pTailMid.x, pTailMid.y);
      ctx.lineTo(pTailBot.x, pTailBot.y);
      ctx.lineTo(pPedBot.x, pPedBot.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = cStroke;
      ctx.stroke();

      // Spiny Dorsal Fin
      ctx.fillStyle = cBack;
      ctx.beginPath();
      ctx.moveTo(pCrown.x, pCrown.y);
      ctx.lineTo(pDorsal.x, pDorsal.y - 4);
      ctx.lineTo(pPedTop.x, pPedTop.y);
      ctx.closePath();
      ctx.fill();

      // Torso
      const bodyGrad = ctx.createLinearGradient(pDorsal.x, pDorsal.y, pBelly.x, pBelly.y);
      bodyGrad.addColorStop(0, cBack);
      bodyGrad.addColorStop(0.5, cFlank);
      bodyGrad.addColorStop(1, cBelly);

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(pSnout.x, pSnout.y);
      ctx.lineTo(pCrown.x, pCrown.y);
      ctx.lineTo(pDorsal.x, pDorsal.y);
      ctx.lineTo(pPedTop.x, pPedTop.y);
      ctx.lineTo(pPedBot.x, pPedBot.y);
      ctx.lineTo(pBelly.x, pBelly.y);
      ctx.lineTo(pChin.x, pChin.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffffff' : cStroke;
      ctx.lineWidth = isSelected ? 2 : 1.4;
      ctx.stroke();

      // Lateral line stripe
      ctx.strokeStyle = '#052e16';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo((pSnout.x + pCrown.x) / 2, (pSnout.y + pCrown.y) / 2);
      ctx.lineTo((pDorsal.x + pBelly.x) / 2, (pDorsal.y + pBelly.y) / 2);
      ctx.lineTo((pPedTop.x + pPedBot.x) / 2, (pPedTop.y + pPedBot.y) / 2);
      ctx.stroke();

      // Eye
      ctx.fillStyle = '#fde047';
      const eyePt = { x: pSnout.x * 0.4 + pCrown.x * 0.6, y: pSnout.y * 0.4 + pCrown.y * 0.6 };
      ctx.beginPath();
      ctx.arc(eyePt.x, eyePt.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(eyePt.x, eyePt.y, 1, 0, Math.PI * 2);
      ctx.fill();

      hitBoxes3D.push({
        id: f.id,
        x: pCrown.x - 24,
        y: pCrown.y - 28,
        w: 48,
        h: 46
      });

      if (state.showCorrelationOverlay || isSelected) {
        const badgeColor = isSelected ? '#facc15' : (f.x === 0 ? '#38bdf8' : '#c084fc');
        drawCorrelationBadge(ctx, pCrown.x, pCrown.y - 14, f.tag || 'A', f.name || 'Bass', badgeColor, f.shapeHint, isSelected);
      }
    }
  });
}

function renderLure3D(ctx, ox, oy, s) {
  if (!lure || !lure.active) return;
  const state = simState.get();
  const bZ = state.boatZ || 35;
  const pt = project3D(lure.x, lure.depth, bZ + 6, ox, oy, s);
  const rod = project3D(0, 0, bZ + 4, ox, oy, s);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rod.x, rod.y);
  ctx.lineTo(pt.x, pt.y);
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function renderDragHologram3D(ctx, ox, oy, s, dragState) {
  const { x, y, z } = dragState.coords3D;
  const p = project3D(x, y, z, ox, oy, s);
  const bedD = getDepthAt(x, z);
  const pBed = project3D(x, bedD, z, ox, oy, s);

  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(pBed.x, pBed.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.beginPath();
  ctx.ellipse(pBed.x, pBed.y, 14 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  const now = performance.now();
  const pulse = Math.sin(now * 0.01) * 3;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 14 + pulse, 0, Math.PI * 2);
  ctx.stroke();

  const label = `DROP ${dragState.targetType.toUpperCase()}`;
  ctx.font = 'bold 9px monospace';
  const textW = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
  ctx.fillRect(p.x - (textW / 2) - 4, p.y - 24, textW + 8, 14);
  ctx.strokeStyle = '#38bdf8';
  ctx.strokeRect(p.x - (textW / 2) - 4, p.y - 24, textW + 8, 14);
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center';
  ctx.fillText(label, p.x, p.y - 14);
  ctx.textAlign = 'start';
  ctx.restore();
}
