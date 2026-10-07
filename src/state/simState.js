/**
 * @file simState.js
 * @description Central reactive simulator state store and event bus.
 */

class SimStateManager {
  constructor() {
    this.state = {
      layoutMode: 'split-quad',
      lakeFeed: '3d',
      isPaused: false,
      boatSpeed: 3.6,
      boatZ: 35,
      txOffsetTransom: -3.5,
      txOffsetBow: 13.0,
      txDepth: 0.6,
      lakeDepthFt: 25.0,
      baseDepthFt: 25.0,
      sideRangeFt: 60,
      sideFlipped: false,
      waterAlpha: 0.55,
      gain: 0.78,
      cameraPreset: 'quarter',
      palette: 'amber',
      contourType: 'flat',
      autoVary: false,
      autoSpawn: false,
      showIllustrations: true,
      showCorrelationOverlay: true,
      selectedTargetId: null,
      worldZ: 0,
      lakeLength: 400,

      power: {
        '2d': true,
        'side': true,
        'clear': true,
        'live': true
      },

      tradAngleDeg: 24,
      sideSweepDeg: 55,
      sideSweepAngleDeg: 55,
      sideSliceThickDeg: 1.2,
      liveTiltDeg: 45,
      liveSpreadDeg: 40,
      clearAngleDeg: 45
    };

    this.listeners = new Set();
  }

  /**
   * Get current state snapshot or specific property.
   * @param {string} [key]
   * @returns {*}
   */
  get(key) {
    return key ? this.state[key] : this.state;
  }

  /**
   * Mutate state and notify subscribers.
   * @param {Partial<typeof this.state>} updates
   */
  update(updates) {
    Object.assign(this.state, updates);
    this.notify(updates);
  }

  /**
   * Subscribe to state mutations.
   * @param {(updates: Partial<typeof this.state>, fullState: typeof this.state) => void} fn
   * @returns {() => void} Unsubscribe function.
   */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Emit updates to listeners.
   * @private
   */
  notify(updates) {
    this.listeners.forEach(fn => fn(updates, this.state));
  }
}

export const simState = new SimStateManager();
