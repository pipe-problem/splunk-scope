/**
 * Shared Architecture Paths display helpers — single source for card/detail/report consistency.
 * Numeric totals come from plan objects produced by generatePlans (same as Report/Coverage).
 */

import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog, calculateSourceSize } from './sizingEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);

/** @param {object} plan */
export function getPathTotals(plan) {
  return plan?.totals?.buffered ?? plan?.totals ?? { low: 0, expected: 0, high: 0 };
}

/** Buffered expected GB/day — same field used on Report and exports. */
export function getPlanIngestGb(plan) {
  return getPathTotals(plan).expected ?? 0;
}

/** @param {object} plan */
export function getPlanSourceCount(plan) {
  return plan?.sources?.length ?? 0;
}

/** @param {object} plan */
export function getPlanReadiness(plan) {
  return plan?.outcomeReadiness?.score ?? plan?.validation?.score ?? 0;
}

/**
 * @param {object} plan
 * @param {object|null} prevPlan
 */
export function getPathDelta(plan, prevPlan) {
  if (plan?.pathComparison) return plan.pathComparison;
  if (!prevPlan) return null;
  const prevExp = getPlanIngestGb(prevPlan);
  const exp = getPlanIngestGb(plan);
  const prevReadiness = getPlanReadiness(prevPlan);
  const readiness = getPlanReadiness(plan);
  const prevIds = new Set((prevPlan.sources || []).map((s) => s.id));
  const added = (plan.sources || []).filter((s) => !prevIds.has(s.id)).map((s) => s.name);
  return {
    sourceDelta: getPlanSourceCount(plan) - getPlanSourceCount(prevPlan),
    ingestDeltaGb: exp - prevExp,
    readinessDelta: readiness - prevReadiness,
    addedSources: added.slice(0, 8),
    addedSourceDetails: (plan.sources || [])
      .filter((s) => !prevIds.has(s.id))
      .map((s) => ({ id: s.id, name: s.name, category: s.category || 'Uncategorized' })),
    summary: null,
  };
}

/**
 * Recommend Walk (balanced commercial path) when present.
 * @param {object[]} plans
 */
export function findRecommendedPlanIndex(plans) {
  const walk = plans.findIndex((p) => p.pathPhase === 'walk');
  if (walk >= 0) return walk;
  return Math.min(1, Math.max(0, plans.length - 1));
}

/**
 * Per-source ingest rows for a path (sorted by GB descending).
 * @param {object} plan
 * @param {Record<string, object>} sourceStates
 * @param {object|null} prevPlan
 */
export function buildPathSourceRows(plan, sourceStates, prevPlan = null) {
  if (!plan) return { sortedEntries: [], allRows: [] };
  const pathExpected = getPlanIngestGb(plan);
  const prevIds = new Set((prevPlan?.sources || []).map((s) => s.id));

  const allRows = (plan.sources || []).map((s) => {
    const row = plan.sourceIngestGb?.find((r) => r.id === s.id);
    const gb =
      row?.gbDay ??
      calculateSourceSize(s, sourceStates[s.id] || {}, {
        catalog: sourceCatalog,
        allInputs: sourceStates,
      }).expected;
    const ss = sourceStates[s.id] || {};
    const isLookup = gb < 0.001 && (s.category === 'Lookup' || s.id?.includes('asset'));
    return {
      id: s.id,
      name: s.name,
      category: s.category || 'Uncategorized',
      status: ss.status || 'unknown',
      gbExpected: gb,
      pct: pathExpected > 0 ? (gb / pathExpected) * 100 : 0,
      addedInPath: prevPlan ? !prevIds.has(s.id) : false,
      isLookup,
      isTopDriver: false,
      isLowIngestHighValue: !isLookup && gb > 0 && gb < 0.05,
    };
  });

  allRows.sort((a, b) => b.gbExpected - a.gbExpected);
  const topIds = new Set(allRows.slice(0, 3).map((r) => r.id));
  for (const row of allRows) {
    if (topIds.has(row.id) && row.pct >= 8) row.isTopDriver = true;
  }

  const byCategory = {};
  for (const row of allRows) {
    if (!byCategory[row.category]) byCategory[row.category] = [];
    byCategory[row.category].push(row);
  }

  const sortedEntries = Object.entries(byCategory).sort(([, a], [, b]) => {
    const sumA = a.reduce((acc, r) => acc + r.gbExpected, 0);
    const sumB = b.reduce((acc, r) => acc + r.gbExpected, 0);
    return sumB - sumA;
  });

  return { sortedEntries, allRows, pathExpected };
}

/** Card + detail metrics from the same plan object. */
export function buildPlanDisplayMetrics(plan) {
  return {
    readiness: getPlanReadiness(plan),
    qualitativeLabel: plan?.outcomeReadiness?.qualitativeLabel ?? '',
    ingestGb: getPlanIngestGb(plan),
    sourceCount: getPlanSourceCount(plan),
    domainCoverage: plan?.validation?.score ?? plan?.outcomeReadiness?.domainCoverageScore ?? 0,
  };
}

/** Enforce tile copy limits for tests. */
export function isShortTileCopy(text, maxLen = 48) {
  if (!text || typeof text !== 'string') return false;
  if (text.includes('\n')) return false;
  return text.length <= maxLen;
}

export { flatCatalog as pathDisplayCatalog };
