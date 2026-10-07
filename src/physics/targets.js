/**
 * @file targets.js
 * @description Submerged structure definitions, fish populations, and lure kinematics.
 */

import { simState } from '../state/simState.js';
import { getDepthAt } from './acousticEngine.js';

export const structures = [
  { id: 'tree-hist',   tag: 'D1', name: 'Aft Timber',   type: 'tree',    x: -32, z: 12,  width: 10, height: 11, color: '#f59e0b' },
  { id: 'boulder-cur', tag: 'E1', name: 'Stbd Boulder', type: 'boulder', x: 28,  z: 32,  width: 9,  height: 5.5, color: '#94a3b8' },
  { id: 'tree-live',   tag: 'D2', name: 'Fwd Timber',   type: 'tree',    x: 0,   z: 62,  width: 10, height: 10, color: '#f59e0b' },
  { id: 'boulder-fwd', tag: 'E2', name: 'Port Boulder', type: 'boulder', x: -30, z: 110, width: 8,  height: 5.0, color: '#94a3b8' },
  { id: 'tree-mid',    tag: 'D3', name: 'Mid Timber',   type: 'tree',    x: 35,  z: 210, width: 11, height: 12, color: '#f59e0b' },
  { id: 'boulder-far', tag: 'E3', name: 'Keel Boulder', type: 'boulder', x: 2,   z: 290, width: 9,  height: 6.0, color: '#94a3b8' }
];

export const fishList = [
  { id: 101, tag: 'A1', name: 'Keel Bass',     shapeHint: '2D Arch & ClearVü Grain', x: 0.0, y: 15.0, baseY: 15.0, z: 80,  size: 1.8, speed: 0.0,   color: '#38bdf8' },
  { id: 102, tag: 'A2', name: 'Keel Bass',     shapeHint: '2D Arch & ClearVü Grain', x: 0.0, y: 19.0, baseY: 19.0, z: 175, size: 1.6, speed: 0.0,   color: '#38bdf8' },
  { id: 103, tag: 'A3', name: 'Keel Bass',     shapeHint: '2D Arch & ClearVü Grain', x: 0.0, y: 13.0, baseY: 13.0, z: 275, size: 1.7, speed: 0.0,   color: '#38bdf8' },
  { id: 104, tag: 'A4', name: 'Keel Bass',     shapeHint: '2D Arch & ClearVü Grain', x: 0.0, y: 17.5, baseY: 17.5, z: 360, size: 1.5, speed: 0.0,   color: '#38bdf8' },
  { id: 1,   tag: 'B1', name: "35' Port Bass", shapeHint: 'SideVü Port Echo + Shadow', x: -35, y: 14.0, baseY: 14.0, z: 50,  size: 1.6, speed: -0.01, color: '#c084fc' },
  { id: 2,   tag: 'B2', name: "33' Port Bass", shapeHint: 'SideVü Port Echo + Shadow', x: -33, y: 15.5, baseY: 15.5, z: 80,  size: 1.5, speed: -0.01, color: '#c084fc' },
  { id: 3,   tag: 'B3', name: "36' Port Bass", shapeHint: 'SideVü Port Echo + Shadow', x: -36, y: 13.5, baseY: 13.5, z: 120, size: 1.6, speed: -0.01, color: '#c084fc' },
  { id: 4,   tag: 'B4', name: "34' Port Bass", shapeHint: 'SideVü Port Echo + Shadow', x: -34, y: 16.5, baseY: 16.5, z: 160, size: 1.7, speed: -0.01, color: '#c084fc' },
  { id: 11,  tag: 'C1', name: "38' Stbd Bass", shapeHint: 'SideVü Stbd Echo + Shadow', x: 38,  y: 16.0, baseY: 16.0, z: 60,  size: 1.5, speed: 0.01,  color: '#c084fc' },
  { id: 12,  tag: 'C2', name: "40' Stbd Bass", shapeHint: 'SideVü Stbd Echo + Shadow', x: 40,  y: 14.5, baseY: 14.5, z: 100, size: 1.6, speed: 0.01,  color: '#c084fc' },
  { id: 13,  tag: 'C3', name: "37' Stbd Bass", shapeHint: 'SideVü Stbd Echo + Shadow', x: 37,  y: 18.0, baseY: 18.0, z: 140, size: 1.5, speed: 0.01,  color: '#c084fc' }
];

export let lure = null;

/**
 * Drop or reposition fishing jig right off bow under LiveScope transducer.
 */
export function dropFishingJig() {
  const state = simState.get();
  const bowZ = (state.boatZ || 35) + state.txOffsetBow;
  lure = { x: 0, y: 0, depth: 1.0, z: bowZ + 6, active: true };
}

/**
 * Update active lure instance.
 * @param {object | null} newLure
 */
export function setLure(newLure) {
  lure = newLure;
}

/**
 * Updates kinematics for fish and falling/jigging lures.
 *
 * @param {number} timestamp - Performance timestamp.
 */
export function updateKinematics(timestamp) {
  const state = simState.get();
  fishList.forEach(f => {
    if (f.speed !== 0) {
      f.x += f.speed;
      if (f.x > 50 || f.x < -50) f.speed *= -1;
    }
    f.y = f.baseY + Math.sin(timestamp * 0.002 + f.id) * 0.4;
  });

  if (lure && lure.active) {
    const bedD = getDepthAt(lure.x, (state.boatZ || 35) + 6);
    if (lure.depth < bedD - 1.5) {
      lure.depth += 0.18;
    } else {
      lure.depth = bedD - 1.5 + Math.sin(timestamp * 0.006) * 0.8;
    }
  }
}
