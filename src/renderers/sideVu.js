/**
 * @file sideVu.js
 * @description SideVü™ UHD bilateral waterfall sonar renderer.
 */

import { simState } from '../state/simState.js';
import { getPaletteColor } from '../state/palettes.js';
import { structures, fishList } from '../physics/targets.js';

export const hitBoxesSideVu = [];

export function renderSideVuMFD(canvas, ctx, sideHistory, maxHistory, ftPerPing) {
  if (!ctx || canvas.width === 0) return;
  const state = simState.get();
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  hitBoxesSideVu.length = 0;
  const now = performance.now();

  if (!state.power['side']) {
    renderStandbyScreen(ctx, w, h, 'SIDEVÜ STANDBY');
    return;
  }

  ctx.fillStyle = '#02050c';
  ctx.fillRect(0, 0, w, h);

  const centerX = w / 2;
  const count = sideHistory.length;
  if (count === 0) return;
  const rowH = Math.max(1.5, h / maxHistory);

  for (let i = 0; i < count; i++) {
    const ping = sideHistory[i];
    const screenY = (count - 1 - i) * rowH;

    if (screenY >= 0 && screenY <= h) {
      const bins = ping.port.length;
      const binW = (centerX - 4) / bins;
      const leftChannel = state.sideFlipped ? ping.stbd : ping.port;
      const rightChannel = state.sideFlipped ? ping.port : ping.stbd;

      for (let b = 0; b < bins; b++) {
        const valL = leftChannel[b];
        if (valL > 0.05) {
          ctx.fillStyle = getPaletteColor(valL, state.palette);
          ctx.fillRect(centerX - 3 - ((b + 1) * binW), screenY, binW + 0.6, rowH + 0.6);
        }
        const valR = rightChannel[b];
        if (valR > 0.05) {
          ctx.fillStyle = getPaletteColor(valR, state.palette);
          ctx.fillRect(centerX + 3 + (b * binW), screenY, binW + 0.6, rowH + 0.6);
        }
      }
    }
  }

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, h);
  ctx.stroke();

  const txZ = (state.boatZ || 35) + state.txOffsetTransom;
  const totalHistFt = maxHistory * ftPerPing;

  fishList.forEach(f => {
    const elapsedFt = ((state.worldZ + txZ - f.z) % state.lakeLength + state.lakeLength) % state.lakeLength;
    if (elapsedFt >= 0 && elapsedFt <= totalHistFt) {
      const screenY = (elapsedFt / totalHistFt) * h;
      const isSelected = (state.selectedTargetId === f.id);
      const sideChannelX = f.x < 0
        ? (state.sideFlipped ? centerX + (Math.abs(f.x) / state.sideRangeFt) * (centerX - 6) : centerX - (Math.abs(f.x) / state.sideRangeFt) * (centerX - 6))
        : (state.sideFlipped ? centerX - (Math.abs(f.x) / state.sideRangeFt) * (centerX - 6) : centerX + (Math.abs(f.x) / state.sideRangeFt) * (centerX - 6));

      if (isSelected) {
        const pulse = Math.sin(now * 0.01) * 3;
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.strokeRect(sideChannelX - 14 - pulse, screenY - 7, 28 + pulse * 2, 14);
        ctx.restore();
      }

      if (state.showCorrelationOverlay || isSelected) {
        ctx.save();
        ctx.font = 'bold 8px monospace';
        const label = isSelected
          ? `[${f.tag}] ★ SELECTED`
          : (f.x === 0 ? `[${f.tag}] WATER COL` : `[${f.tag}] ECHO+SHADOW`);
        const boxW = ctx.measureText(label).width + 8;
        const drawX = Math.min(w - boxW - 2, Math.max(2, sideChannelX - boxW / 2));

        ctx.fillStyle = isSelected ? 'rgba(66, 32, 6, 0.95)' : 'rgba(2, 6, 23, 0.90)';
        ctx.fillRect(drawX, screenY - 5, boxW, 11);
        ctx.strokeStyle = isSelected ? '#facc15' : (f.x === 0 ? '#38bdf8' : '#c084fc');
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(drawX, screenY - 5, boxW, 11);
        ctx.fillStyle = isSelected ? '#fef08a' : (f.x === 0 ? '#38bdf8' : '#c084fc');
        ctx.fillText(label, drawX + 4, screenY + 3);
        ctx.restore();
      }

      hitBoxesSideVu.push({
        id: f.id,
        x: sideChannelX - 25,
        y: screenY - 9,
        w: 50,
        h: 18
      });
    }
  });

  structures.forEach(st => {
    const elapsedFt = ((state.worldZ + txZ - st.z) % state.lakeLength + state.lakeLength) % state.lakeLength;
    if (elapsedFt >= 0 && elapsedFt <= totalHistFt) {
      const screenY = (elapsedFt / totalHistFt) * h;
      const isSelected = (state.selectedTargetId === st.id);
      const isKeel = Math.abs(st.x) <= 6;
      const sideChannelX = isKeel ? centerX : (st.x < 0
        ? (state.sideFlipped ? centerX + (Math.abs(st.x) / state.sideRangeFt) * (centerX - 6) : centerX - (Math.abs(st.x) / state.sideRangeFt) * (centerX - 6))
        : (state.sideFlipped ? centerX - (Math.abs(st.x) / state.sideRangeFt) * (centerX - 6) : centerX + (Math.abs(st.x) / state.sideRangeFt) * (centerX - 6)));

      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        if (isKeel) {
          ctx.strokeRect(centerX - 24, screenY - 8, 48, 16);
        } else {
          ctx.strokeRect(sideChannelX - 16, screenY - 7, 32, 14);
        }
        ctx.restore();
      }

      if (state.showCorrelationOverlay || isSelected) {
        ctx.save();
        ctx.font = 'bold 8px monospace';
        const label = isSelected ? `[${st.tag}] ★ SELECTED` : (
          isKeel
            ? (st.type === 'boulder' ? `[${st.tag}] KEEL HUMP (PINCH)` : `[${st.tag}] KEEL TIMBER (WATER COL)`)
            : (st.type === 'boulder' ? `[${st.tag}] BOULDER + SHADOW` : `[${st.tag}] TIMBER + SHADOW`)
        );
        const boxW = ctx.measureText(label).width + 8;
        const drawX = Math.min(w - boxW - 2, Math.max(2, sideChannelX - boxW / 2));

        ctx.fillStyle = isSelected ? 'rgba(66, 32, 6, 0.95)' : 'rgba(2, 6, 23, 0.90)';
        ctx.fillRect(drawX, screenY - 5, boxW, 11);
        ctx.strokeStyle = isSelected ? '#facc15' : (st.color || '#f59e0b');
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(drawX, screenY - 5, boxW, 11);
        ctx.fillStyle = isSelected ? '#fef08a' : (st.color || '#f59e0b');
        ctx.fillText(label, drawX + 4, screenY + 3);
        ctx.restore();
      }

      hitBoxesSideVu.push({
        id: st.id,
        x: isKeel ? centerX - 25 : sideChannelX - 25,
        y: screenY - 9,
        w: 50,
        h: 18
      });
    }
  });
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
