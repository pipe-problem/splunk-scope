/**
 * Shared adaptive ingest display — GB/day internally, MB/day when < 0.1 GB/day.
 */

const GB_THRESHOLD = 0.1;

/**
 * @param {number} gb
 * @param {{ suffix?: boolean }} [options]
 * @returns {{ text: string, unit: string, gb: number, display: string }}
 */
export function formatIngestValue(gb, options = {}) {
  const v = Number(gb);
  const withSuffix = options.suffix !== false;
  if (!Number.isFinite(v) || v === 0) {
    return { text: '0', unit: '', gb: 0, display: '0' };
  }
  if (v >= GB_THRESHOLD) {
    let text;
    if (v >= 10) text = v.toFixed(1);
    else if (v >= 1) text = v.toFixed(2);
    else text = v.toFixed(2);
    const unit = 'GB/day';
    return { text, unit, gb: v, display: withSuffix ? `${text} ${unit}` : text };
  }
  const mb = v * 1024;
  let text;
  if (mb >= 100) text = mb.toFixed(1);
  else if (mb >= 10) text = mb.toFixed(1);
  else if (mb >= 1) text = mb.toFixed(2);
  else text = mb.toFixed(2);
  const unit = 'MB/day';
  return { text, unit, gb: v, display: withSuffix ? `${text} ${unit}` : text };
}

/** @param {number} gb */
export function formatIngestNumber(gb) {
  return formatIngestValue(gb, { suffix: false }).text;
}

/** @param {number} gb */
export function formatIngestString(gb) {
  return formatIngestValue(gb).display;
}

/**
 * @param {{ lowGb?: number, expectedGb?: number, highGb?: number }} triplet
 */
export function formatIngestTriplet({ lowGb = 0, expectedGb = 0, highGb = 0 } = {}) {
  return {
    low: formatIngestValue(lowGb),
    expected: formatIngestValue(expectedGb),
    high: formatIngestValue(highGb),
  };
}
