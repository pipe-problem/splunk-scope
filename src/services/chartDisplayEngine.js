/**
 * Presentation-scaled chart slices for donuts/pies.
 * Display sizes are adjusted for visibility; actual values are preserved for tooltips/legends.
 */

const DEFAULT_MIN_DISPLAY_PERCENT = 5;
const DEFAULT_MAX_SLICES = 8;

/**
 * @typedef {object} ChartSliceInput
 * @property {string} label
 * @property {number} value - actual GB/day or count
 * @property {string} [color]
 */

/**
 * @typedef {object} ChartSliceDisplay
 * @property {string} label
 * @property {number} actualValue
 * @property {number} actualPercent
 * @property {number} displayValue
 * @property {number} displayPercent
 * @property {string} [color]
 * @property {boolean} [isGroupedOther]
 */

/**
 * @param {ChartSliceInput[]} items
 * @param {{ minDisplayPercent?: number, maxSlices?: number }} [options]
 * @returns {ChartSliceDisplay[]}
 */
export function normalizeChartSlicesForDisplay(items, options = {}) {
  const minPct = options.minDisplayPercent ?? DEFAULT_MIN_DISPLAY_PERCENT;
  let working = (items || [])
    .filter((i) => i && i.label && Number(i.value) > 0)
    .map((i) => ({
      label: i.label,
      value: Number(i.value),
      color: i.color,
    }));

  if (working.length === 0) return [];

  const maxSlices = options.maxSlices ?? DEFAULT_MAX_SLICES;
  if (working.length > maxSlices) {
    working = groupSmallSlices(working, maxSlices);
  }

  const totalActual = working.reduce((s, i) => s + i.value, 0);
  if (totalActual <= 0) return [];

  const withActualPct = working.map((i) => ({
    ...i,
    actualValue: i.value,
    actualPercent: (i.value / totalActual) * 100,
  }));

  const nonzero = withActualPct.filter((i) => i.actualValue > 0);
  const minCount = nonzero.length;
  const minTotal = minPct * minCount;
  let displayPool = 100;

  if (minTotal > 100) {
    const scale = 100 / minTotal;
    return nonzero.map((i) => ({
      label: i.label,
      actualValue: i.actualValue,
      actualPercent: i.actualPercent,
      displayValue: i.actualValue,
      displayPercent: i.actualPercent * scale,
      color: i.color,
      isGroupedOther: i.isGroupedOther,
    }));
  }

  const displayValues = nonzero.map((i) => {
    const floor = Math.max(i.actualPercent, minPct);
    return { ...i, displayPercent: floor };
  });

  let displaySum = displayValues.reduce((s, i) => s + i.displayPercent, 0);
  const excess = displaySum - 100;

  if (excess > 0) {
    const large = [...displayValues].sort((a, b) => b.displayPercent - a.displayPercent);
    let remaining = excess;
    for (const item of large) {
      if (remaining <= 0) break;
      const room = item.displayPercent - minPct;
      if (room <= 0) continue;
      const take = Math.min(room, remaining);
      item.displayPercent -= take;
      remaining -= take;
    }
  } else if (excess < 0) {
    let remaining = -excess;
    const large = [...displayValues].sort((a, b) => b.actualPercent - a.actualPercent);
    for (const item of large) {
      if (remaining <= 0) break;
      item.displayPercent += Math.min(remaining, 2);
      remaining -= 2;
    }
  }

  displaySum = displayValues.reduce((s, i) => s + i.displayPercent, 0);
  const scale = displaySum > 0 ? 100 / displaySum : 1;

  return displayValues.map((i) => ({
    label: i.label,
    actualValue: i.actualValue,
    actualPercent: i.actualPercent,
    displayValue: (i.actualPercent / 100) * totalActual,
    displayPercent: i.displayPercent * scale,
    color: i.color,
    isGroupedOther: i.isGroupedOther,
  }));
}

/**
 * @param {ChartSliceInput[]} items
 * @param {number} maxSlices
 * @returns {ChartSliceInput[]}
 */
export function groupSmallSlices(items, maxSlices) {
  if (items.length <= maxSlices) return items;
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const keep = maxSlices - 1;
  const top = sorted.slice(0, keep);
  const rest = sorted.slice(keep);
  const otherValue = rest.reduce((s, i) => s + i.value, 0);
  return [
    ...top,
    {
      label: 'Other',
      value: otherValue,
      color: rest[0]?.color,
      isGroupedOther: true,
    },
  ];
}

/**
 * @param {ChartSliceDisplay} item
 * @param {string} [unit]
 * @returns {{ title: string, lines: string[] }}
 */
export function getActualTooltipData(item, unit = 'GB/day') {
  const actualPct = item.actualPercent != null ? item.actualPercent.toFixed(1) : '0';
  const actualVal = item.actualValue != null ? item.actualValue.toFixed(1) : '0';
  return {
    title: item.label,
    lines: [
      `${actualVal} ${unit} (${actualPct}% actual)`,
      item.isGroupedOther ? 'Grouped small categories for readability' : 'Slice size adjusted for presentation',
    ],
  };
}
