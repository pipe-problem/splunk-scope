/**
 * Canonical planning ingest totals — single source of truth for GB/day KPIs.
 * Pipeline: calculateFullSourceIngest → overlap exclusion → calculatePlanningTotals (20% per source).
 */

import { OVERLAP_ANNOTATE_ONLY } from '../config/featureFlags.js';
import { flattenSourceCatalog } from './sizingEngine.js';
import { applyOverlapExclusions } from './overlapEngine.js';
import {
  calculateFullSourceIngest,
  sourceCountsTowardTotals,
  getOverlapExcludedIds,
} from './sourceEligibilityEngine.js';
import { applyPlanningBufferToSource, calculatePlanningTotals } from '../utils/bufferBand.js';
import { toPlanningDisplayColumns } from '../utils/planningIngestDisplay.js';

function catalogToFlatList(catalog) {
  if (!catalog) return [];
  const roots = Array.isArray(catalog) ? catalog : [catalog];
  return flattenSourceCatalog(roots);
}

function resolveSizingContext(sizingContext, catalog, sourceStates) {
  if (sizingContext?.catalog && sizingContext?.allInputs) return sizingContext;
  return { catalog, allInputs: sourceStates };
}

function customSourcesFromStates(sourceStates = {}) {
  return Object.entries(sourceStates)
    .filter(([id, s]) => id.startsWith('custom_') && s?.status !== 'unknown' && s?.status !== 'skip')
    .map(([id, s]) => ({
      id,
      name: s.name || 'Custom',
      category: 'Custom',
      sizing_formula: { primary_input: 'count', rate_per_unit: s.sizingRate || 0.1 },
      ...s,
    }));
}

/**
 * Whether a source has real session sizing inputs eligible for ingest totals.
 */
export function isSourceEligibleForPlanningTotals(source, sourceStates, sizingContext, overlapDecisions) {
  const ss = sourceStates?.[source?.id];
  if (!ss || ss.status === 'unknown' || ss.status === 'skip') return false;
  const ctx = resolveSizingContext(sizingContext, sizingContext?.catalog, sourceStates);
  const excludedIds = getOverlapExcludedIds(overlapDecisions);
  const est = calculateFullSourceIngest(source, ss, ctx);
  return sourceCountsTowardTotals(source, ss, est, excludedIds);
}

/**
 * All session sources that count toward planning ingest (Review / Coverage strip).
 * @param {{ catalog: object|object[], sourceStates: object, overlapDecisions?: object, sizingContext?: object, customSources?: object[] }} params
 */
export function getEligibleConfiguredSources({
  catalog,
  sourceStates,
  overlapDecisions = {},
  sizingContext,
  customSources,
}) {
  const flat = catalogToFlatList(catalog);
  const ctx = resolveSizingContext(sizingContext, catalog, sourceStates);
  const excludedIds = getOverlapExcludedIds(overlapDecisions);
  const customs = customSources ?? customSourcesFromStates(sourceStates);
  const rows = [];

  for (const source of flat) {
    const ss = sourceStates[source.id];
    if (!ss || ss.status === 'unknown' || ss.status === 'skip') continue;
    const est = calculateFullSourceIngest(source, ss, ctx);
    if (!sourceCountsTowardTotals(source, ss, est, excludedIds)) continue;
    const cols = toPlanningDisplayColumns(est);
    rows.push({
      ...source,
      ...ss,
      rawExpected: est.expected,
      gbLow: cols.gbLow,
      gbExpected: cols.gbExpected,
      gbHigh: cols.gbHigh,
      usedMeasuredBands: cols.usedMeasuredBands,
      confidence: est.confidence,
      quantity: est.quantity,
      unitLabel: est.unit || est.countBasis || source.configuredItemLabel || source.sizingUnit,
      isCustom: false,
    });
  }

  for (const source of customs) {
    const ss = sourceStates[source.id];
    if (!ss || ss.status === 'unknown' || ss.status === 'skip') continue;
    const est = calculateFullSourceIngest(source, ss, ctx);
    if (!sourceCountsTowardTotals(source, ss, est, excludedIds)) continue;
    const cols = toPlanningDisplayColumns(est);
    rows.push({
      ...source,
      ...ss,
      rawExpected: est.expected,
      gbLow: cols.gbLow,
      gbExpected: cols.gbExpected,
      gbHigh: cols.gbHigh,
      usedMeasuredBands: cols.usedMeasuredBands,
      confidence: est.confidence,
      quantity: est.quantity,
      unitLabel: est.unit || est.countBasis || source.configuredItemLabel || source.sizingUnit,
      isCustom: true,
    });
  }

  return rows;
}

/**
 * Sum planning ingest for catalog sources filtered by optional sourceIds.
 * Uses user session states only — never synthetic planning pool states.
 */
export function sumPlanningIngestForSources(
  sources,
  sourceStates,
  overlapDecisions,
  sizingContext,
  options = {},
) {
  const { sourceIds } = options;
  const idFilter = sourceIds?.length ? new Set(sourceIds) : null;
  const ctx = resolveSizingContext(sizingContext, sizingContext?.catalog, sourceStates);
  const excludedIds = getOverlapExcludedIds(overlapDecisions);
  const sizeResults = {};

  for (const source of sources || []) {
    if (idFilter && !idFilter.has(source.id)) continue;
    const ss = sourceStates[source.id];
    if (!ss) continue;
    const est = calculateFullSourceIngest(source, ss, ctx);
    if (!sourceCountsTowardTotals(source, ss, est, excludedIds)) continue;
    sizeResults[source.id] = { expected: est.expected };
  }

  const { results: adjustedResults } = OVERLAP_ANNOTATE_ONLY
    ? { results: { ...sizeResults }, excluded: [], assumptions: [] }
    : applyOverlapExclusions(sizeResults, overlapDecisions);
  const totals = calculatePlanningTotals(adjustedResults);

  return { totals, adjustedResults, sizeResults };
}

/** Session-wide eligible totals (Review / Coverage KPI strip). */
export function sumSessionPlanningIngest(params) {
  const eligible = getEligibleConfiguredSources(params);
  const totals = calculatePlanningTotals(
    Object.fromEntries(eligible.map((s) => [s.id, { expected: s.rawExpected }])),
  );
  return { totals, eligible, count: eligible.length };
}

/** Per-path display totals from configured sources in the path only. */
export function sumPathPlanningIngest(pathSources, sourceStates, overlapDecisions, catalog, customSources = []) {
  const flat = flattenSourceCatalog(catalog);
  const all = [...flat, ...customSources];
  const ctx = { catalog, allInputs: sourceStates };
  const ids = (pathSources || []).map((s) => s.id);
  return sumPlanningIngestForSources(all, sourceStates, overlapDecisions, ctx, { sourceIds: ids });
}

/** Buffered per-source breakdown for path / report tables. */
export function buildPathSourceIngestBreakdown(pathSources, adjustedResults) {
  return (pathSources || []).map((s) => {
    const raw = adjustedResults[s.id]?.expected ?? 0;
    const cols = toPlanningDisplayColumns({ expected: raw });
    return {
      id: s.id,
      name: s.name,
      gbDay: cols.gbExpected,
      gbLow: cols.gbLow,
      gbHigh: cols.gbHigh,
    };
  });
}
