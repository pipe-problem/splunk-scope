/**
 * Shared helpers for Review / Coverage ingest totals.
 * Uses measured low/high bands when available; planning buffer otherwise.
 */

import { PLANNING_BUFFER_FRACTION, applyPlanningBufferToSource, calculatePlanningTotals } from './bufferBand.js';

/**
 * True when estimate low/high are measured model bands (not ±20% planning buffer).
 * @param {{ low?: number, expected?: number, high?: number, rateSource?: string }} rawEstimate
 */
export function shouldUseMeasuredBands(rawEstimate) {
  if (!rawEstimate || rawEstimate.rateSource === 'rollup_children') return false;
  const exp = rawEstimate.expected ?? 0;
  if (exp <= 0) return false;
  const low = rawEstimate.low ?? 0;
  const high = rawEstimate.high ?? 0;
  if (low <= 0 && high <= 0) return false;

  const bufferedLow = exp * (1 - PLANNING_BUFFER_FRACTION);
  const bufferedHigh = exp * (1 + PLANNING_BUFFER_FRACTION);
  const tol = Math.max(exp * 0.02, 1e-9);

  if (Math.abs(low - bufferedLow) < tol && Math.abs(high - bufferedHigh) < tol) {
    return false;
  }
  return true;
}

function bandColumns(rawEstimate) {
  if (!rawEstimate) {
    return { gbLow: 0, gbExpected: 0, gbHigh: 0, usedMeasuredBands: false };
  }
  const exp = rawEstimate.expected ?? 0;
  if (exp > 0 && shouldUseMeasuredBands(rawEstimate)) {
    return {
      gbLow: rawEstimate.low ?? exp * (1 - PLANNING_BUFFER_FRACTION),
      gbExpected: exp,
      gbHigh: rawEstimate.high ?? exp * (1 + PLANNING_BUFFER_FRACTION),
      usedMeasuredBands: true,
    };
  }
  const planned = applyPlanningBufferToSource(rawEstimate);
  return {
    gbLow: planned.low,
    gbExpected: planned.expected,
    gbHigh: planned.high,
    usedMeasuredBands: false,
  };
}

/**
 * Map a raw sizing estimate to display columns (low / expected / high).
 * When Cisco promo applied, also returns buffered gross columns for strikethrough.
 * @param {{ low?: number, expected?: number, high?: number, rateSource?: string, ciscoPromoApplied?: boolean, gbGrossExpected?: number, gbGrossLow?: number, gbGrossHigh?: number }} rawEstimate
 */
export function toPlanningDisplayColumns(rawEstimate) {
  const billable = bandColumns(rawEstimate);
  const promoApplied = Boolean(rawEstimate?.ciscoPromoApplied);
  const grossExpected = rawEstimate?.gbGrossExpected;
  if (promoApplied && grossExpected != null && grossExpected > 0) {
    const grossCols = bandColumns({
      expected: grossExpected,
      low: rawEstimate.gbGrossLow,
      high: rawEstimate.gbGrossHigh,
      rateSource: rawEstimate.rateSource,
    });
    return {
      ...billable,
      ciscoPromoApplied: true,
      gbGrossLow: grossCols.gbLow,
      gbGrossExpected: grossCols.gbExpected,
      gbGrossHigh: grossCols.gbHigh,
    };
  }
  return {
    ...billable,
    ciscoPromoApplied: false,
    gbGrossLow: billable.gbLow,
    gbGrossExpected: billable.gbExpected,
    gbGrossHigh: billable.gbHigh,
  };
}

/**
 * Sum planning totals for configured sources, optionally skipping overlap-excluded ids.
 * @param {Array<{ id: string, rawExpected?: number }>} sources
 * @param {string[]} [excludedIds]
 */
export function sumConfiguredSourcePlanningTotals(sources, excludedIds = []) {
  const excluded = new Set(excludedIds);
  const results = {};
  for (const s of sources) {
    if (excluded.has(s.id)) continue;
    const expected = s.rawExpected ?? s.gbExpected ?? 0;
    results[s.id] = { expected };
  }
  return calculatePlanningTotals(results);
}
