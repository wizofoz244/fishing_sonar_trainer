/**
 * @file lake2D.js
 * @description 2D underwater lateral slice renderer with transducer cones and hull profile.
 */

import { simState } from '../state/simState.js';
import { getDepthAt, getLiveRayReach } from '../physics/acousticEngine.js';
import { structures, fishList } from '../physics/targets.js';
import { drawCorrelationBadge } from './lake3D.js';

export const hitBoxes2D = [];

export function render2DWaterPhysics(canvas, ctx) {
  if (!ctx || canvas.width === 0) return;
  const state = simState.get();
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  hitBoxes2D.length = 0;
  const now = performance.now();

  const airHeight = h * 0.18;
  const usableHeight = h - airHeight;
  const maxDisplayDepth = 60;
  const boatX = w * 0.24;
  const boatY = airHeight;
  const scaleX = (w - boatX - 40) / 65;
  const scaleY = usableHeight / maxDisplayDepth;

  const bZ = state.boatZ || 35;
  const txZ = bZ + state.txOffsetTransom;
  const bowZ = bZ + state.txOffsetBow;
  const txDepth = state.txDepth;

  const screenTransomX = boatX + state.txOffsetTransom * scaleX;
  const screenTransomY = boatY + txDepth * scaleY;
  const screenBowX = boatX + state.txOffsetBow * scaleX;
  const screenBowY = boatY + (txDepth + 0.4) * scaleY;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, airHeight);

  const gradWater = ctx.createLinearGradient(0, airHeight, 0, h);
  gradWater.addColorStop(0, '#0369a1');
  gradWater.addColorStop(1, '#082f49');
  ctx.fillStyle = gradWater;
  ctx.fillRect(0, airHeight, w, h - airHeight);

  // Lakebed Profile
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 10) {
    const relDistFt = (x - boatX) / scaleX;
    const localDepth = getDepthAt(0, relDistFt + bZ);
    const localY = airHeight + Math.min(usableHeight * 0.94, (localDepth / maxDisplayDepth) * usableHeight);
    ctx.lineTo(x, localY);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (state.showIllustrations) {
    if (state.power['live']) {
      const tiltRad = (state.liveTiltDeg * Math.PI) / 180;
      const spreadRad = (state.liveSpreadDeg * Math.PI) / 180;
      const liveReachFt = 55;
      const minAngle = tiltRad - spreadRad / 2;
      const maxAngle = tiltRad + spreadRad / 2;
      const numArcSteps = 20;

      ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
      ctx.beginPath();
      ctx.moveTo(screenBowX, screenBowY);

      for (let i = 0; i <= numArcSteps; i++) {
        const a = minAngle + (i / numArcSteps) * (maxAngle - minAngle);
        const ray = getLiveRayReach(a, liveReachFt, bowZ, 0);
        const px = screenBowX + ray.fwd * scaleX;
        const py = screenBowY + (ray.depth - txDepth) * scaleY;
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    if (state.power['2d']) {
      const coneHalfAngleRad = ((state.tradAngleDeg / 2) * Math.PI) / 180;
      const localBedDepth = getDepthAt(0, txZ);
      const coneRadiusFt = (localBedDepth - txDepth) * Math.tan(coneHalfAngleRad);
      const coneRadiusPx = coneRadiusFt * scaleX;
      const bedY = airHeight + Math.min(usableHeight * 0.94, (localBedDepth / maxDisplayDepth) * usableHeight);

      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screenTransomX, screenTransomY);
      ctx.lineTo(screenTransomX + coneRadiusPx, bedY);
      ctx.lineTo(screenTransomX - coneRadiusPx, bedY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    if (state.power['clear']) {
      const localBedDepth = getDepthAt(0, txZ);
      const bedY = airHeight + Math.min(usableHeight * 0.94, (localBedDepth / maxDisplayDepth) * usableHeight);
      const sliceHalfWidthPx = Math.max(3.0, 1.2 * scaleX);

      const clearGrad = ctx.createLinearGradient(screenTransomX, screenTransomY, screenTransomX, bedY);
      clearGrad.addColorStop(0, 'rgba(245, 158, 11, 0.7)');
      clearGrad.addColorStop(0.4, 'rgba(245, 158, 11, 0.35)');
      clearGrad.addColorStop(1, 'rgba(251, 191, 36, 0.1)');

      ctx.fillStyle = clearGrad;
      ctx.beginPath();
      ctx.moveTo(screenTransomX - sliceHalfWidthPx, screenTransomY);
      ctx.lineTo(screenTransomX + sliceHalfWidthPx, screenTransomY);
      ctx.lineTo(screenTransomX + sliceHalfWidthPx * 1.5, bedY);
      ctx.lineTo(screenTransomX - sliceHalfWidthPx * 1.5, bedY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(screenTransomX, screenTransomY);
      ctx.lineTo(screenTransomX, bedY);
      ctx.stroke();

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(screenTransomX - sliceHalfWidthPx * 2.5, bedY);
      ctx.lineTo(screenTransomX + sliceHalfWidthPx * 2.5, bedY);
      ctx.stroke();

      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('CLEARVÜ SLICE (45°)', screenTransomX + 6, screenTransomY + (bedY - screenTransomY) * 0.52);
    }

    if (state.power['side']) {
      const localBedDepth = getDepthAt(0, txZ);
      const bedY = airHeight + Math.min(usableHeight * 0.94, (localBedDepth / maxDisplayDepth) * usableHeight);
      const sweepDeg = state.sideSweepDeg || state.sideSweepAngleDeg || 55;
      const sweepRad = (sweepDeg * Math.PI) / 180;
      const reachFt = Math.min(state.sideRangeFt || 60, localBedDepth * Math.tan(sweepRad));
      const reachPx = reachFt * scaleX * 0.45;
      const surfY = airHeight + Math.max(2, txDepth * scaleY);

      const portGrad = ctx.createLinearGradient(screenTransomX, screenTransomY, screenTransomX - reachPx, bedY);
      portGrad.addColorStop(0, 'rgba(192, 132, 252, 0.45)');
      portGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.22)');
      portGrad.addColorStop(1, 'rgba(147, 51, 234, 0.04)');

      ctx.fillStyle = portGrad;
      ctx.beginPath();
      ctx.moveTo(screenTransomX, screenTransomY);
      ctx.lineTo(screenTransomX - reachPx, surfY + 4);
      ctx.lineTo(screenTransomX - reachPx, bedY);
      ctx.lineTo(screenTransomX, bedY);
      ctx.closePath();
      ctx.fill();

      const stbdGrad = ctx.createLinearGradient(screenTransomX, screenTransomY, screenTransomX + reachPx, bedY);
      stbdGrad.addColorStop(0, 'rgba(192, 132, 252, 0.45)');
      stbdGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.22)');
      stbdGrad.addColorStop(1, 'rgba(147, 51, 234, 0.04)');

      ctx.fillStyle = stbdGrad;
      ctx.beginPath();
      ctx.moveTo(screenTransomX, screenTransomY);
      ctx.lineTo(screenTransomX + reachPx, surfY + 4);
      ctx.lineTo(screenTransomX + reachPx, bedY);
      ctx.lineTo(screenTransomX, bedY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(screenTransomX - reachPx, surfY + 4);
      ctx.lineTo(screenTransomX, screenTransomY);
      ctx.lineTo(screenTransomX + reachPx, surfY + 4);
      ctx.moveTo(screenTransomX - reachPx, bedY);
      ctx.lineTo(screenTransomX, bedY);
      ctx.lineTo(screenTransomX + reachPx, bedY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#c084fc';
      ctx.fillText('◄ PORT SIDEVÜ', screenTransomX - reachPx + 2, surfY + 13);
      ctx.fillText('SIDEVÜ STBD ►', screenTransomX + reachPx - 70, surfY + 13);
    }
  }

  renderBoat2D(ctx, boatX, airHeight, scaleX, scaleY, screenTransomX, screenTransomY, screenBowX, screenBowY);

  structures.forEach(st => {
    const relZ = ((st.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
    const distZ = relZ - bZ;
    if (distZ >= -22 && distZ <= 65) {
      const stX = boatX + distZ * scaleX;
      const localBedD = getDepthAt(st.x, relZ);
      const stBedY = airHeight + (localBedD / maxDisplayDepth) * usableHeight;
      const isSelected = (state.selectedTargetId === st.id);

      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(stX - 16, stBedY - (st.height * scaleY) - 8, 32, (st.height * scaleY) + 12);
        ctx.restore();
      }

      if (st.type === 'boulder') {
        ctx.fillStyle = isSelected ? '#fde047' : '#64748b';
        ctx.beginPath();
        ctx.ellipse(stX, stBedY - (st.height * 0.45 * scaleY), st.width * 0.4 * scaleX, st.height * 0.5 * scaleY, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = isSelected ? '#facc15' : '#78350f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(stX, stBedY);
        ctx.lineTo(stX, stBedY - st.height * scaleY);
        ctx.stroke();
      }

      hitBoxes2D.push({
        id: st.id,
        x: stX - 20,
        y: stBedY - (st.height * scaleY) - 22,
        w: 40,
        h: (st.height * scaleY) + 26
      });

      if (state.showCorrelationOverlay || isSelected) {
        drawCorrelationBadge(ctx, stX, stBedY - (st.height * scaleY) - 6, st.tag || 'E1', st.name, isSelected ? '#facc15' : '#94a3b8', null, isSelected);
      }
    }
  });

  fishList.forEach(f => {
    const relZ = ((f.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
    const distZ = relZ - bZ;
    if (distZ >= -22 && distZ <= 65) {
      const fishX = boatX + distZ * scaleX;
      const localD = getDepthAt(f.x, relZ);
      const actualDepth = Math.min(localD - 1.5, f.y);
      const fishY = airHeight + (actualDepth / maxDisplayDepth) * usableHeight;
      const isSelected = (state.selectedTargetId === f.id);

      if (isSelected) {
        const pulse = Math.sin(now * 0.008) * 3;
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(fishX - 16 - pulse, fishY - 10 - pulse, 32 + pulse * 2, 20 + pulse * 2);
        ctx.restore();
      }

      const cFish = isSelected ? '#facc15' : (f.x === 0 ? '#38bdf8' : '#c084fc');
      ctx.fillStyle = cFish;
      ctx.beginPath();
      ctx.ellipse(fishX, fishY, 7 * f.size, 3 * f.size, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(fishX - 6 * f.size, fishY);
      ctx.lineTo(fishX - 11 * f.size, fishY - 3 * f.size);
      ctx.lineTo(fishX - 11 * f.size, fishY + 3 * f.size);
      ctx.closePath();
      ctx.fill();

      hitBoxes2D.push({
        id: f.id,
        x: fishX - 22,
        y: fishY - 24,
        w: 44,
        h: 36
      });

      if (state.showCorrelationOverlay || isSelected) {
        drawCorrelationBadge(ctx, fishX, fishY - 14, f.tag || 'A', f.name || 'Bass', cFish, f.shapeHint, isSelected);
      }
    }
  });
}

function renderBoat2D(ctx, boatX, waterY, scaleX, scaleY, transomX, transomY, bowX, bowY) {
  const sternX = boatX + (-4.5 * scaleX);
  const bowTipX = boatX + (13.8 * scaleX);

  const hullGrad = ctx.createLinearGradient(0, waterY - 14, 0, waterY + 4);
  hullGrad.addColorStop(0, '#f8fafc');
  hullGrad.addColorStop(0.7, '#cbd5e1');
  hullGrad.addColorStop(1, '#64748b');

  ctx.fillStyle = hullGrad;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(sternX, waterY - 8);
  ctx.lineTo(sternX, waterY + 2);
  ctx.lineTo(bowTipX - 8, waterY + 2);
  ctx.lineTo(bowTipX, waterY - 8);
  ctx.lineTo(bowTipX - 2, waterY - 11);
  ctx.lineTo(sternX + 4, waterY - 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0284c7';
  ctx.fillRect(sternX + 2, waterY - 4, (bowTipX - sternX) - 8, 2.5);

  const consoleX = boatX + (3.0 * scaleX);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(consoleX - 4, waterY - 18, 14, 9);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.beginPath();
  ctx.moveTo(consoleX + 10, waterY - 9);
  ctx.lineTo(consoleX + 7, waterY - 19);
  ctx.lineTo(consoleX - 1, waterY - 19);
  ctx.lineTo(consoleX + 2, waterY - 9);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(consoleX - 7, waterY - 21, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(consoleX - 9, waterY - 17, 5, 8);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(sternX - 8, waterY - 18, 7, 14);
  ctx.fillRect(sternX - 6, waterY - 4, 4, 15);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(sternX - 9, waterY + 7, 7, 2.5);

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(transomX, waterY);
  ctx.lineTo(transomX, transomY);
  ctx.stroke();

  ctx.fillStyle = '#a855f7';
  ctx.fillRect(transomX - 3.5, transomY, 7, 3.5);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(transomX, transomY + 1.8, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(bowX - 1, waterY - 14);
  ctx.lineTo(bowX - 1, bowY);
  ctx.stroke();

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(bowX - 6, bowY - 1.5, 10, 4);

  ctx.fillStyle = '#10b981';
  ctx.fillRect(bowX - 2.5, bowY - 5.5, 6, 5);
  ctx.fillStyle = '#34d399';
  ctx.beginPath();
  ctx.arc(bowX + 0.5, bowY - 3, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 7.5px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('2D/CLEARVÜ/SIDEVÜ TX', transomX - 44, waterY - 10);
  ctx.fillStyle = '#34d399';
  ctx.fillText('LIVESCOPE TX', bowX - 16, waterY - 16);
}
