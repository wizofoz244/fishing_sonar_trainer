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
  const maxDisplayDepth = 45;
  const bowZ = (state.boatZ || 35) + state.txOffsetBow;
  const mode = state.liveMode || 'forward';
  const rotationDeg = state.liveRotationDeg || 0;
  const rotRad = (rotationDeg * Math.PI) / 180;

  // Helper coordinate mapper depending on mode:
  // Forward: (forward, depth) from origin top-left
  // Down: (forwardSpan -30..+30, depth 0..45) with origin at top-center (w/2, 14)
  // Perspective: (crossSpan -45..+45, forward 0..60) with origin at bottom-center (w/2, h - 14)
  let getScreenCoords;

  if (mode === 'perspective') {
    // Top-down / horizontal radar view looking forward from boat
    const pOriginX = w / 2;
    const pOriginY = h - 16;
    const pMaxDist = 60;
    const pScale = (h - 28) / pMaxDist;

    // Draw range arc sectors (135° fan: -67.5° to +67.5°)
    const startAngle = -Math.PI / 2 - (135 / 2) * Math.PI / 180;
    const endAngle = -Math.PI / 2 + (135 / 2) * Math.PI / 180;

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.lineWidth = 1;
    [20, 40, 60].forEach(r => {
      ctx.beginPath();
      ctx.arc(pOriginX, pOriginY, r * pScale, startAngle, endAngle);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '7.5px monospace';
      ctx.fillText(`${r}FT`, pOriginX - 10, pOriginY - r * pScale + 8);
    });

    // Azimuth radial lines
    [-67.5, -45, -22.5, 0, 22.5, 45, 67.5].forEach(deg => {
      const rad = -Math.PI / 2 + (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(pOriginX, pOriginY);
      ctx.lineTo(pOriginX + Math.cos(rad) * 60 * pScale, pOriginY + Math.sin(rad) * 60 * pScale);
      ctx.stroke();
    });

    // Outer boundary fan border
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(pOriginX, pOriginY);
    ctx.arc(pOriginX, pOriginY, 60 * pScale, startAngle, endAngle);
    ctx.closePath();
    ctx.stroke();

    // Boat hull icon at top-down origin
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pOriginX, pOriginY - 7);
    ctx.lineTo(pOriginX + 4, pOriginY);
    ctx.lineTo(pOriginX + 3, pOriginY + 5);
    ctx.lineTo(pOriginX - 3, pOriginY + 5);
    ctx.lineTo(pOriginX - 4, pOriginY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    getScreenCoords = (hit) => {
      // hit.beamX (lateral cross), hit.beamZ (forward)
      return {
        x: pOriginX + hit.beamX * pScale,
        y: pOriginY - hit.beamZ * pScale
      };
    };
  } else if (mode === 'down') {
    // Down mode: origin at top-center, showing water column directly beneath transducer (-30ft to +30ft span, 0 to 45ft depth)
    const dOriginX = w / 2;
    const dOriginY = 14;
    const spanFt = 60; // -30 to +30 ft
    const scaleSpan = (w - 28) / spanFt;
    const scaleDepth = (h - 24) / maxDisplayDepth;

    // Depth arcs / range rings
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.lineWidth = 1;
    [15, 30, 45].forEach(r => {
      ctx.beginPath();
      ctx.arc(dOriginX, dOriginY, r * scaleDepth, 0, Math.PI);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '7.5px monospace';
      ctx.fillText(`${r}FT`, dOriginX + 4, dOriginY + r * scaleDepth - 2);
    });

    // Downward beam cone borders (135° downward fan = -67.5° to +67.5° from nadir)
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(dOriginX, dOriginY);
    ctx.lineTo(dOriginX - 30 * scaleSpan, dOriginY + 45 * scaleDepth);
    ctx.moveTo(dOriginX, dOriginY);
    ctx.lineTo(dOriginX + 30 * scaleSpan, dOriginY + 45 * scaleDepth);
    ctx.stroke();

    // Boat transducer icon at top center
    ctx.save();
    ctx.fillStyle = '#34d399';
    ctx.fillRect(dOriginX - 5, dOriginY - 4, 10, 4);
    ctx.restore();

    // Lakebed bottom contour beneath boat
    ctx.beginPath();
    for (let span = -30; span <= 30; span += 2) {
      const zOffset = span * Math.cos(rotRad);
      const xOffset = span * Math.sin(rotRad);
      const bD = getDepthAt(xOffset, bowZ + zOffset);
      const px = dOriginX + span * scaleSpan;
      const py = dOriginY + bD * scaleDepth;
      if (span === -30) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    getScreenCoords = (hit) => {
      return {
        x: dOriginX + hit.fwdDist * scaleSpan,
        y: dOriginY + hit.depth * scaleDepth
      };
    };
  } else {
    // Forward mode (Default): origin at top-left
    const scaleX = (w - 24) / maxRangeFt;
    const scaleY = (h - 24) / maxDisplayDepth;

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.lineWidth = 1;
    [20, 40, 60].forEach(r => {
      ctx.beginPath();
      ctx.arc(originX, originY, r * scaleX, 0, Math.PI / 2);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '7.5px monospace';
      ctx.fillText(`${r}FT`, originX + r * scaleX - 16, originY + 10);
    });

    ctx.beginPath();
    for (let fwd = 0; fwd <= maxRangeFt; fwd += 2) {
      const zOffset = fwd * Math.cos(rotRad);
      const xOffset = fwd * Math.sin(rotRad);
      const bD = getDepthAt(xOffset, bowZ + zOffset);
      const px = originX + fwd * scaleX;
      const py = originY + bD * scaleY;
      if (fwd === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    getScreenCoords = (hit) => {
      return {
        x: originX + hit.fwdDist * scaleX,
        y: originY + hit.depth * scaleY
      };
    };
  }

  // Draw on-screen LiveScope Mode & Rotation Telemetry Banner + Rosette
  ctx.save();
  ctx.font = 'bold 8.5px monospace';
  const modeLabel = `${mode.toUpperCase()} MODE • ROT: ${rotationDeg >= 0 ? '+' : ''}${rotationDeg}°`;
  ctx.fillStyle = 'rgba(6, 78, 59, 0.9)';
  ctx.fillRect(w - 150, 4, 146, 14);
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 1;
  ctx.strokeRect(w - 150, 4, 146, 14);
  ctx.fillStyle = '#6ee7b7';
  ctx.fillText(modeLabel, w - 146, 14);

  // Tactical LiveScope Beam Heading Dial / Rosette
  const dialX = w - 24;
  const dialY = 38;
  const dialR = 14;

  ctx.beginPath();
  ctx.arc(dialX, dialY, dialR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
  ctx.fill();
  ctx.strokeStyle = '#047857';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Boat heading reference (0° = straight UP towards Bow)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(dialX, dialY - dialR + 2);
  ctx.lineTo(dialX, dialY + dialR - 2);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 6.5px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('N', dialX, dialY - dialR - 1);

  // Steered Beam Azimuth Needle
  const needleAngle = -Math.PI / 2 + rotRad;
  const nx = dialX + Math.cos(needleAngle) * (dialR - 3);
  const ny = dialY + Math.sin(needleAngle) * (dialR - 3);

  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dialX, dialY);
  ctx.lineTo(nx, ny);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(nx, ny, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = '#facc15';
  ctx.fill();

  ctx.textAlign = 'start';
  ctx.restore();

  structures.forEach(st => {
    const relZ = ((st.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
    const bD = getDepthAt(st.x, relZ);
    const topD = Math.max(0.5, bD - (st.height || (st.type === 'tree' ? 11 : 5.5)));
    const hitTop = isTargetInLiveScope(relZ, st.x, topD);
    const hitBase = isTargetInLiveScope(relZ, st.x, bD);
    const hit = hitTop || hitBase;
    if (!hit) return;

    const coords = getScreenCoords(hit);
    const px = coords.x;
    const py = coords.y;
    const isSelected = (state.selectedTargetId === st.id);

    if (st.type === 'boulder') {
      const rockR = 8;
      ctx.beginPath();
      ctx.arc(px, py, rockR, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#713f12' : '#064e3b';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#facc15' : '#34d399';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      hitBoxesLiveScope.push({
        id: st.id,
        x: px - rockR - 4,
        y: py - rockR - 4,
        w: rockR * 2 + 8,
        h: rockR * 2 + 8
      });

      if (state.showCorrelationOverlay || isSelected) {
        drawLiveScopeBadge(canvas, ctx, px, py - 12, st.tag || 'E1', isSelected ? '★ BOULDER' : 'BOULDER DOME', isSelected ? '#facc15' : '#34d399', isSelected);
      }
    } else if (st.type === 'tree') {
      const treeH = mode === 'perspective' ? 14 : 28;
      ctx.strokeStyle = isSelected ? '#facc15' : '#10b981';
      ctx.lineWidth = isSelected ? 3.5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - treeH);
      ctx.stroke();

      ctx.strokeStyle = isSelected ? '#fef08a' : '#34d399';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py - treeH * 0.4);
      ctx.lineTo(px + 7, py - treeH * 0.55);
      ctx.moveTo(px, py - treeH * 0.65);
      ctx.lineTo(px - 6, py - treeH * 0.8);
      ctx.stroke();

      hitBoxesLiveScope.push({
        id: st.id,
        x: px - 12,
        y: py - treeH - 4,
        w: 24,
        h: treeH + 8
      });

      if (state.showCorrelationOverlay || isSelected) {
        drawLiveScopeBadge(canvas, ctx, px, py - treeH - 6, st.tag || 'D1', isSelected ? '★ TIMBER' : 'STANDING TIMBER', isSelected ? '#facc15' : '#34d399', isSelected);
      }
    }
  });

  fishList.forEach(f => {
    const relZ = ((f.z - state.worldZ) % state.lakeLength + state.lakeLength) % state.lakeLength;
    const localD = getDepthAt(f.x, relZ);
    const actualDepth = Math.min(localD - 1.5, f.y);
    const hit = isTargetInLiveScope(relZ, f.x, actualDepth);
    if (hit) {
      const coords = getScreenCoords(hit);
      const fx = coords.x;
      const fy = coords.y;
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
      const coords = getScreenCoords(hit);
      const lx = coords.x;
      const ly = coords.y;

      if (mode !== 'perspective') {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(lx, Math.max(14, ly - 20));
        ctx.lineTo(lx, ly);
        ctx.stroke();
        ctx.setLineDash([]);
      }

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
