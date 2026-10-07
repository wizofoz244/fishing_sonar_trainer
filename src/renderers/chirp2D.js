/**
 * @file chirp2D.js
 * @description Traditional 2D conical CHIRP sonar renderer with dynamic hyperbolic fish arches.
 */

import { simState } from '../state/simState.js';
import { structures, fishList } from '../physics/targets.js';

export const hitBoxesTrad = [];

export function renderTradMFD(canvas, ctx, tradHistory, maxHistory, ftPerPing) {
  if (!ctx || canvas.width === 0) return;
  const state = simState.get();
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  hitBoxesTrad.length = 0;
  const now = performance.now();

  if (!state.power['2d']) {
    renderStandbyScreen(ctx, w, h, '2D CHIRP STANDBY');
    return;
  }

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);

  const count = tradHistory.length;
  if (count === 0) return;
  const colW = Math.max(2, w / maxHistory);
  const rightX = w - 6;

  for (let i = 0; i < count; i++) {
    const slice = tradHistory[i];
    const screenX = rightX - (count - 1 - i) * colW;
    if (screenX >= 0 && screenX <= w) {
      const bins = slice.length;
      const sliceH = h / bins;
      for (let b = 0; b < bins; b++) {
        const val = slice[b];
        if (val > 0.08) {
          if (val > 0.85) ctx.fillStyle = '#ffffff';
          else if (val > 0.65) ctx.fillStyle = '#ef4444';
          else if (val > 0.40) ctx.fillStyle = '#f59e0b';
          else ctx.fillStyle = '#38bdf8';
          ctx.fillRect(screenX, b * sliceH, colW + 0.6, sliceH + 0.6);
        }
      }
    }
  }

  const txZ = (state.boatZ || 35) + state.txOffsetTransom;
  const totalHistFt = maxHistory * ftPerPing;

  fishList.forEach(f => {
    if (Math.abs(f.x) <= 4) {
      const elapsedFt = ((state.worldZ + txZ - f.z) % state.lakeLength + state.lakeLength) % state.lakeLength;
      if (elapsedFt >= 0 && elapsedFt <= totalHistFt) {
        const screenX = rightX - (elapsedFt / totalHistFt) * w;
        const screenY = (f.y / 55) * h;
        const isSelected = (state.selectedTargetId === f.id);

        if (isSelected) {
          const pulse = Math.sin(now * 0.01) * 3;
          ctx.save();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.strokeRect(screenX - 14 - pulse, screenY - 16, 28 + pulse * 2, 24);
          ctx.restore();
        }

        if (state.showCorrelationOverlay || isSelected) {
          ctx.save();
          ctx.font = 'bold 8px monospace';
          const label = isSelected ? `[${f.tag}] ★ SELECTED` : `[${f.tag}] ARCH (⤺)`;
          const boxW = ctx.measureText(label).width + 8;
          const drawX = Math.min(w - boxW - 2, Math.max(2, screenX - boxW / 2));

          ctx.fillStyle = isSelected ? 'rgba(66, 32, 6, 0.95)' : 'rgba(2, 6, 23, 0.90)';
          ctx.fillRect(drawX, screenY - 14, boxW, 11);
          ctx.strokeStyle = isSelected ? '#facc15' : '#38bdf8';
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.strokeRect(drawX, screenY - 14, boxW, 11);
          ctx.fillStyle = isSelected ? '#fef08a' : '#38bdf8';
          ctx.fillText(label, drawX + 4, screenY - 6);
          ctx.restore();
        }

        hitBoxesTrad.push({
          id: f.id,
          x: screenX - 22,
          y: screenY - 18,
          w: 44,
          h: 28
        });
      }
    }
  });

  structures.forEach(st => {
    if (Math.abs(st.x) <= 14) {
      const elapsedFt = ((state.worldZ + txZ - st.z) % state.lakeLength + state.lakeLength) % state.lakeLength;
      if (elapsedFt >= 0 && elapsedFt <= totalHistFt) {
        const screenX = rightX - (elapsedFt / totalHistFt) * w;
        const topDepth = Math.max(2, state.lakeDepthFt - (st.height || 10));
        const screenY = (topDepth / 55) * h;
        const isSelected = (state.selectedTargetId === st.id);

        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.strokeRect(screenX - 16, screenY - 16, 32, 28);
          ctx.restore();
        }

        if (state.showCorrelationOverlay || isSelected) {
          ctx.save();
          ctx.font = 'bold 8px monospace';
          const label = isSelected
            ? `[${st.tag}] ★ SELECTED`
            : (st.type === 'tree' ? `[${st.tag}] TIMBER BLOB` : `[${st.tag}] BOULDER DOME`);
          const boxW = ctx.measureText(label).width + 8;
          const drawX = Math.min(w - boxW - 2, Math.max(2, screenX - boxW / 2));

          ctx.fillStyle = isSelected ? 'rgba(66, 32, 6, 0.95)' : 'rgba(2, 6, 23, 0.90)';
          ctx.fillRect(drawX, screenY - 14, boxW, 11);
          ctx.strokeStyle = isSelected ? '#facc15' : (st.color || '#f59e0b');
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.strokeRect(drawX, screenY - 14, boxW, 11);
          ctx.fillStyle = isSelected ? '#fef08a' : (st.color || '#f59e0b');
          ctx.fillText(label, drawX + 4, screenY - 6);
          ctx.restore();
        }

        hitBoxesTrad.push({
          id: st.id,
          x: screenX - 24,
          y: screenY - 18,
          w: 48,
          h: 30
        });
      }
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
