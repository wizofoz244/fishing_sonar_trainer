/**
 * @file liveScope.js
 * @description Panoptix LiveScope™ forward-looking 20 FPS phased array renderer.
 */

import { simState } from '../state/simState.js';
import { getDepthAt, isTargetInLiveScope } from '../physics/acousticEngine.js';
import { structures, fishList, lure } from '../physics/targets.js';

export const hitBoxesLiveScope = [];

export function renderLiveScopeMFD(canvas, ctx) {
  if (!ctx || canvas.width === 0) return;
  const state = simState.get();
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  hitBoxesLiveScope.length = 0;
  const now = performance.now();

  if (!state.power['live']) {
    renderStandbyScreen(ctx, w, h, 'LIVESCOPE STANDBY');
    return;
  }

  ctx.fillStyle = '#02050c';
  ctx.fillRect(0, 0, w, h);

  const originX = 14;
  const originY = 14;
  const maxRangeFt = 60;
  const scaleX = (w - 24) / maxRangeFt;
  const maxDisplayDepth = 45;
  const scaleY = (h - 24) / maxDisplayDepth;
  const bowZ = (state.boatZ || 35) + state.txOffsetBow;

  ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
  ctx.lineWidth = 1;
  [20, 40, 60].forEach(r => {
    ctx.beginPath();
    ctx.arc(originX, originY, r * scaleX, 0, Math.PI / 2);
    ctx.stroke();
  });

  ctx.beginPath();
  for (let fwd = 0; fwd <= maxRangeFt; fwd += 2) {
    const bD = getDepthAt(0, bowZ + fwd);
    const px = originX + fwd * scaleX;
    const py = originY + bD * scaleY;
    if (fwd === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  structures.forEach(st => {
    const relZ = ((st.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
    const fwdDist = relZ - bowZ;
    if (fwdDist >= 0 && fwdDist <= maxRangeFt && Math.abs(st.x) <= 22) {
      const bD = getDepthAt(st.x, relZ);
      const topD = Math.max(0.5, bD - (st.height || (st.type === 'tree' ? 11 : 5.5)));
      // Check if top or bottom of structure intersects the LiveScope beam window
      const inBeamTop = isTargetInLiveScope(relZ, st.x, topD);
      const inBeamBase = isTargetInLiveScope(relZ, st.x, bD);
      if (!inBeamTop && !inBeamBase) return;

      const px = originX + fwdDist * scaleX;
      const pyBed = originY + bD * scaleY;
      const isSelected = (state.selectedTargetId === st.id);

      if (st.type === 'boulder') {
        const rockH = (st.height || 5.5) * scaleY;
        const rockW = (st.width || 8.5) * 0.5 * scaleX;
        const pyTop = pyBed - rockH;

        const shadowSpan = rockW * 1.6;
        ctx.fillStyle = '#02050c';
        ctx.fillRect(px + rockW * 0.8, pyBed - 2, shadowSpan, 5);

        ctx.beginPath();
        ctx.ellipse(px, pyBed - rockH * 0.45, rockW, rockH * 0.7, 0, Math.PI, 0, false);
        ctx.lineTo(px + rockW, pyBed);
        ctx.lineTo(px - rockW, pyBed);
        ctx.closePath();

        ctx.fillStyle = isSelected ? '#713f12' : '#064e3b';
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#facc15' : '#34d399';
        ctx.lineWidth = isSelected ? 2.5 : 1.8;
        ctx.beginPath();
        ctx.arc(px, pyBed - rockH * 0.45, rockW * 0.95, Math.PI * 0.85, Math.PI * 1.8);
        ctx.stroke();

        hitBoxesLiveScope.push({
          id: st.id,
          x: px - rockW - 4,
          y: pyTop - 8,
          w: rockW * 2 + 8,
          h: rockH + 12
        });

        if (state.showCorrelationOverlay || isSelected) {
          drawLiveScopeBadge(canvas, ctx, px, pyTop - 12, st.tag || 'E1', isSelected ? '★ BOULDER' : 'BOULDER DOME', isSelected ? '#facc15' : '#34d399', isSelected);
        }
      } else if (st.type === 'tree') {
        const treeH = (st.height || 11) * scaleY;
        const pyTop = pyBed - treeH;

        ctx.strokeStyle = isSelected ? '#facc15' : '#10b981';
        ctx.lineWidth = isSelected ? 3.5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(px, pyBed);
        ctx.lineTo(px - 2, pyTop);
        ctx.stroke();

        ctx.strokeStyle = isSelected ? '#fef08a' : '#34d399';
        ctx.lineWidth = isSelected ? 2.2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(px - 1, pyBed - treeH * 0.38);
        ctx.lineTo(px + 7 * scaleX, pyBed - treeH * 0.52);
        ctx.moveTo(px - 1, pyBed - treeH * 0.62);
        ctx.lineTo(px - 6 * scaleX, pyBed - treeH * 0.78);
        ctx.moveTo(px - 2, pyTop);
        ctx.lineTo(px + 4 * scaleX, pyTop - 3);
        ctx.stroke();

        hitBoxesLiveScope.push({
          id: st.id,
          x: px - 12,
          y: pyTop - 8,
          w: 32,
          h: treeH + 12
        });

        if (state.showCorrelationOverlay || isSelected) {
          drawLiveScopeBadge(canvas, ctx, px, pyTop - 12, st.tag || 'D1', isSelected ? '★ TIMBER' : 'STANDING TIMBER', isSelected ? '#facc15' : '#34d399', isSelected);
        }
      }
    }
  });

  fishList.forEach(f => {
    const relZ = ((f.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
    const localD = getDepthAt(f.x, relZ);
    const actualDepth = Math.min(localD - 1.5, f.y);
    const hit = isTargetInLiveScope(relZ, f.x, actualDepth);
    if (hit) {
      const fx = originX + hit.fwdDist * scaleX;
      const fy = originY + hit.depth * scaleY;
      const isSelected = (state.selectedTargetId === f.id);

      const fishLen = Math.max(7, 9 * f.size);
      const fishThick = Math.max(2.8, 3.4 * f.size);
      const swimAngle = (f.speed !== 0 ? (f.speed > 0 ? 0.15 : -0.15) : 0);
      const wagOffset = Math.sin(now * 0.012 + f.id) * 2;

      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(swimAngle);

      const haloGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, fishLen * 1.4);
      haloGrad.addColorStop(0, isSelected ? 'rgba(250, 204, 21, 0.45)' : 'rgba(52, 211, 153, 0.45)');
      haloGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, fishLen * 1.3, fishThick * 1.8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isSelected ? '#eab308' : '#059669';
      ctx.beginPath();
      ctx.ellipse(0, 0, fishLen, fishThick, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isSelected ? '#ffffff' : '#a7f3d0';
      ctx.beginPath();
      ctx.ellipse(fishLen * 0.2, 0, fishLen * 0.45, fishThick * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isSelected ? '#facc15' : '#34d399';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-fishLen * 0.7, 0);
      ctx.lineTo(-fishLen * 1.25, wagOffset);
      ctx.stroke();

      ctx.restore();

      if (isSelected) {
        const pulse = Math.sin(now * 0.01) * 3;
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.strokeRect(fx - 14 - pulse, fy - 9 - pulse, 28 + pulse * 2, 18 + pulse * 2);
      }

      hitBoxesLiveScope.push({
        id: f.id,
        x: fx - 14,
        y: fy - 12,
        w: 88,
        h: 24
      });

      if (state.showCorrelationOverlay || isSelected) {
        const label = isSelected ? `[${f.tag}] ★ SELECTED` : `[${f.tag || 'A'}] LIVE BASS`;
        drawLiveScopeBadge(canvas, ctx, fx, fy - 12, f.tag || 'A', label, isSelected ? '#facc15' : '#34d399', isSelected);
      }
    }
  });

  if (lure && lure.active) {
    const lureRelZ = lure.z !== undefined ? lure.z : bowZ + 6;
    const hit = isTargetInLiveScope(lureRelZ, lure.x || 0, lure.depth);
    if (hit) {
      const lx = originX + hit.fwdDist * scaleX;
      const ly = originY + hit.depth * scaleY;

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(lx, originY + (hit.depth - 4) * scaleY);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(lx, ly, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 7.5px monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('🎣 JIG', lx + 5, ly + 2);
    }
  }
}

function drawLiveScopeBadge(canvas, ctx, x, y, tag, label, color, isSelected) {
  ctx.save();
  ctx.font = 'bold 8px monospace';
  const boxW = Math.max(68, ctx.measureText(label).width + 8);
  const drawX = Math.min(canvas.width - boxW - 2, Math.max(2, x + 5));
  const drawY = Math.max(14, y);

  ctx.fillStyle = isSelected ? 'rgba(66, 32, 6, 0.95)' : 'rgba(2, 6, 23, 0.88)';
  ctx.fillRect(drawX, drawY, boxW, 12);
  ctx.strokeStyle = color;
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.strokeRect(drawX, drawY, boxW, 12);
  ctx.fillStyle = isSelected ? '#fef08a' : color;
  ctx.fillText(label, drawX + 4, drawY + 9);
  ctx.restore();
}

function renderStandbyScreen(ctx, w, h, label) {
  ctx.fillStyle = '#050b16';
  ctx.fillRect(0, 0, w, h);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText(label, w / 2, h / 2);
  ctx.textAlign = 'start';
}
