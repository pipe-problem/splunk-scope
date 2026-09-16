/**
 * Simple sizing — quantity × rate from originalSizingRates.json (original calculator defaults).
 */

import originalSizingRates from '../data/originalSizingRates.json';
import { parseCount } from './iaasSizingEngine.js';
import { getNestedValue } from '../utils/draftPathUtils.js';
import { getOriginalSizingRateEntry } from './sourceMeasurementQuestionsService.js';

export { getOriginalSizingRateEntry } from './sourceMeasurementQuestionsService.js';

function resolveSecondaryIngest(entry, sourceState = {}) {
  let add = 0;
  for (const sec of entry?.optionalSecondaryInputs || []) {
    if (!sec?.field) continue;
    const qty = parseCount(getNestedValue(sourceState, sec.field));
    add += qty * (sec.rateGbPerUnit ?? 0);
  }
  return add;
}

/**
 * Resolve primary quantity from source state using original calculator primaryInputField.
 * Supports dotted paths (e.g. containerCounts.clusters).
 */
export function resolvePrimaryQuantity(sourceId, sourceState = {}) {
  const entry = getOriginalSizingRateEntry(sourceId);
  if (!entry?.primaryInputField) return 0;
  return parseCount(getNestedValue(sourceState, entry.primaryInputField));
}

/**
 * @returns {{ expected: number, low: number, high: number, unit: string, quantity: number, rateSource: 'original_calculator', confidence: string, warnings: string[], assumptions: string[], needsReview: boolean, countBasis: string, vendorMultiplier: number, scopeMultiplier: number, bufferApplied: boolean, childIngest: number }}
 */
export function calculateSimpleSourceIngest(source, sourceState = {}, sizingContext = {}) {
  const sourceId = source?.id;
  const entry = getOriginalSizingRateEntry(sourceId);

  if (!entry) {
    return {
      low: 0,
      expected: 0,
      high: 0,
      unit: source?.sizingUnit || 'unit',
      quantity: 0,
      confidence: 'low',
      assumptions: [],
      warnings: ['No original calculator rate for this source'],
      rateSource: 'original_calculator',
      needsReview: true,
      countBasis: 'unit',
      vendorMultiplier: 1.0,
      scopeMultiplier: 1.0,
      bufferApplied: false,
      childIngest: 0,
    };
  }

  const quantity = resolvePrimaryQuantity(sourceId, sourceState);
  const rate = entry.rateGbPerUnit ?? 0;
  const lowMult = entry.lowMultiplier ?? originalSizingRates.lowMultiplierDefault ?? 0.8;
  const highMult = entry.highMultiplier ?? originalSizingRates.highMultiplierDefault ?? 1.2;
  const primaryExpected = quantity * rate;
  const secondaryExpected = resolveSecondaryIngest(entry, sourceState);
  const expected = primaryExpected + secondaryExpected;

  return {
    expected,
    low: expected * lowMult,
    high: expected * highMult,
    unit: entry.unitLabel,
    quantity,
    rateSource: 'original_calculator',
    confidence: quantity > 0 || secondaryExpected > 0 ? 'medium' : 'low',
    warnings: quantity <= 0 && secondaryExpected <= 0 ? ['Needs sizing input'] : [],
    assumptions: quantity > 0 || secondaryExpected > 0
      ? [
          ...(quantity > 0
            ? [`${quantity} ${entry.unitLabel} × ${rate} GB/day (original calculator)`]
            : []),
          ...(secondaryExpected > 0
            ? [`Supplementary secondary inputs add ${secondaryExpected.toFixed(3)} GB/day`]
            : []),
        ]
      : [],
    needsReview: quantity <= 0 && secondaryExpected <= 0,
    countBasis: entry.unitLabel,
    vendorMultiplier: 1.0,
    scopeMultiplier: 1.0,
    bufferApplied: false,
    childIngest: 0,
  };
}
