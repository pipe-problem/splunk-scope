/**
 * Fixed planning buffer band for daily ingest (GB/day).
 *
 * Model (applied per source, then summed):
 *   expected = planning estimate from sizing (expected_raw)
 *   low      = expected × (1 − PLANNING_BUFFER_FRACTION)
 *   high     = expected × (1 + PLANNING_BUFFER_FRACTION)
 *
 * Totals:
 *   Σ low, Σ expected, Σ high — never apply buffer only to the aggregate expected.
 */

/** Hardcoded 20% planning contingency — not user-configurable in UI. */
export const PLANNING_BUFFER_FRACTION = 0.2;

export function normalizeBufferFraction(bufferPercent) {
  if (bufferPercent == null || Number.isNaN(bufferPercent)) return PLANNING_BUFFER_FRACTION;
  const n = Number(bufferPercent);
  return n > 1 ? n / 100 : n;
}

/**
 * Planning low/expected/high for one source from its planning expected value.
 * @param {number} expectedGb
 */
export function planningValuesFromExpected(expectedGb) {
  const expected = Math.max(0, expectedGb ?? 0);
  const bf = PLANNING_BUFFER_FRACTION;
  return {
    low: expected * (1 - bf),
    expected,
    high: expected * (1 + bf),
  };
}

/**
 * Apply fixed planning buffer to a sizing result (uses `expected` only; ignores catalog low/high).
 * @param {{ low?: number, expected?: number, high?: number, [key: string]: unknown }} sourceResult
 */
export function applyPlanningBufferToSource(sourceResult) {
  if (!sourceResult) {
    return { low: 0, expected: 0, high: 0, planningBufferFraction: PLANNING_BUFFER_FRACTION };
  }
  const band = planningValuesFromExpected(sourceResult.expected);
  return {
    ...sourceResult,
    ...band,
    planningBufferFraction: PLANNING_BUFFER_FRACTION,
  };
}

/**
 * Sum planning totals across sources (each source buffered individually, then aggregated).
 * @param {Record<string, { expected?: number }>} sourceResults
 */
export function calculatePlanningTotals(sourceResults) {
  let low = 0;
  let expected = 0;
  let high = 0;
  const entries = Object.values(sourceResults || {});

  for (const r of entries) {
    const b = applyPlanningBufferToSource(r);
    low += b.low;
    expected += b.expected;
    high += b.high;
  }

  const buffered = { low, expected, high };

  return {
    raw: { ...buffered },
    low,
    expected,
    high,
    band: buffered,
    buffered,
    bufferPercent: PLANNING_BUFFER_FRACTION,
    planningBufferFraction: PLANNING_BUFFER_FRACTION,
    sourceCount: entries.length,
  };
}

/**
 * @deprecated Use planningValuesFromExpected / calculatePlanningTotals for session ingest.
 * Kept for single-value band helpers in legacy tests.
 */
export function applyBufferBand(expectedGb, bufferPercentOrFraction) {
  const bf = normalizeBufferFraction(bufferPercentOrFraction);
  const expected = Math.max(0, expectedGb ?? 0);
  return {
    low: expected * (1 - bf),
    expected,
    high: expected * (1 + bf),
    bufferFraction: bf,
  };
}
