/**
 * @file palettes.js
 * @description Color palette lookup for sonar displays (MFD waterfall and echoes).
 */

/**
 * Returns hexadecimal color for a given normalized sonar amplitude (0.0 to 1.0).
 *
 * @param {number} val - Normalized acoustic return amplitude (0.0 - 1.0).
 * @param {string} [pal='amber'] - Palette name ('amber' or 'blue').
 * @returns {string} Hex color string.
 */
export function getPaletteColor(val, pal = 'amber') {
  if (pal === 'blue') {
    if (val > 0.85) return '#ffffff';
    if (val > 0.65) return '#38bdf8';
    if (val > 0.40) return '#0284c7';
    return '#1e40af';
  } else {
    if (val > 0.85) return '#ffffff';
    if (val > 0.65) return '#facc15';
    if (val > 0.40) return '#ea580c';
    return '#b91c1c';
  }
}
