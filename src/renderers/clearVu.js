/**
 * @file clearVu.js
 * @description ClearVü™ DownScan high-frequency razor-slice sonar renderer.
 */

import { simState } from '../state/simState.js';
import { getPaletteColor } from '../state/palettes.js';
import { structures, fishList } from '../physics/targets.js';

export const hitBoxesClearVu = [];

export function renderClearVuMFD(canvas, ctx, clearHistory, maxHistory, ftPerPing) {
  if (!ctx || canvas.width === 0) return;
  const state = simState.get();
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  hitBoxesClearVu.length = 0;
  const now = performance.now();

  if (!state.power['clear']) {
    renderStandbyScreen(ctx, w, h, 'CLEARVÜ STANDBY');
    return;
  }

  ctx.fillStyle = '#02050c';
  ctx.fillRect(0, 0, w, h);

  const count = clearHistory.length;
  if (count === 0) return;
  const colW = Math.max(2, w / maxHistory);
  const rightX = w - 6;

  for (let i = 0; i < count; i++) {
    const slice = clearHistory[i];
    const screenX = rightX - (count - 1 - i) * colW;
    if (screenX >= 0 && screenX <= w) {
      const bins = slice.length;
      const sliceH = h / bins;
      for (let b = 0; b < bins; b++) {
        const val = slice[b];
        if (val > 0.08) {
          ctx.fillStyle = getPaletteColor(val, 'amber');
          ctx.fillRect(screenX, b * sliceH, colW + 0.6, sliceH + 0.6);
        }
      }
    }
  }

  const txZ = (state.boatZ || 35) + state.txOffsetTransom;
  const totalHistFt = maxHistory * ftPerPing;

  fishList.forEach(f => {
    if (Math.abs(f.x) <= 3) {
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
          ctx.strokeRect(screenX - 12 - pulse, screenY - 14, 24 + pulse * 2, 22);
          ctx.restore();
        }

        if (state.showCorrelationOverlay || isSelected) {
          ctx.save();
          ctx.font = 'bold 8px monospace';
          const label = isSelected ? `[${f.tag}] ★ SELECTED` : `[${f.tag}] RICE GRAIN`;
          const boxW = ctx.measureText(label).width + 8;
          const drawX = Math.min(w - boxW - 2, Math.max(2, screenX - boxW / 2));

          ctx.fillStyle = isSelected ? 'rgba(66, 32, 6, 0.95)' : 'rgba(2, 6, 23, 0.90)';
          ctx.fillRect(drawX, screenY - 12, boxW, 11);
          ctx.strokeStyle = isSelected ? '#facc15' : '#fbbf24';
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.strokeRect(drawX, screenY - 12, boxW, 11);
          ctx.fillStyle = isSelected ? '#fef08a' : '#fbbf24';
          ctx.fillText(label, drawX + 4, screenY - 4);
          ctx.restore();
        }

        hitBoxesClearVu.push({
          id: f.id,
          x: screenX - 22,
          y: screenY - 16,
          w: 44,
          h: 26
        });
      }
    }
  });

  structures.forEach(st => {
    if (Math.abs(st.x) <= 12) {
      const elapsedFt = ((state.worldZ + txZ - st.z) % state.lakeLength + state.lakeLength) % state.lakeLength;
      if (elapsedFt >= 0 && elapsedFt <= totalHistFt) {
        const screenX = rightX - (elapsedFt / totalHistFt) * w;
        const topDepth = Math.max(2, state.lakeDepthFt - (st.height || (st.type === 'tree' ? 10 : 5.5)));
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
            : (st.type === 'tree' ? `[${st.tag}] TIMBER SILHOUETTE` : `[${st.tag}] BOULDER DOME`);
          const boxW = ctx.measureText(label).width + 8;
          const drawX = Math.min(w - boxW - 2, Math.max(2, screenX - boxW / 2));

          ctx.fillStyle = isSelected ? 'rgba(66, 32, 6, 0.95)' : 'rgba(2, 6, 23, 0.90)';
          ctx.fillRect(drawX, screenY - 12, boxW, 11);
          ctx.strokeStyle = isSelected ? '#facc15' : (st.color || '#f59e0b');
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.strokeRect(drawX, screenY - 12, boxW, 11);
          ctx.fillStyle = isSelected ? '#fef08a' : (st.color || '#f59e0b');
          ctx.fillText(label, drawX + 4, screenY - 4);
          ctx.restore();
        }

        hitBoxesClearVu.push({
          id: st.id,
          x: screenX - 22,
          y: screenY - 16,
          w: 44,
          h: 26
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
