/**
 * Review confirmation gate — derives display data from canonical planning totals only.
 */

import { flattenSourceCatalog } from './sizingEngine.js';
import { sumSessionPlanningIngest } from './planningIngestTotals.js';
import { getAnalysisSourcePriorities } from './analysisSourcePriorityEngine.js';
import { detectActiveOverlaps } from './overlapEngine.js';
import { getFlatSplunkApps } from './splunkAppsCatalog.js';
import overlapTelemetryCopy from '../data/overlapTelemetryCopy.json';
import { getCustomerAppDisplayName } from '../utils/customerAppDisplay.js';
import { filterMissingPrioritiesForEquivalency } from './sourceEquivalencyEngine.js';

const APP_NAMES = new Map(getFlatSplunkApps().map((a) => [a.id, a.name]));

const DEFAULT_HINT =
  'Both sources remain in your total — use separate collection paths in production to avoid duplicate events.';

function getPairTelemetryCopy(pairKey) {
  return overlapTelemetryCopy.pairs?.[pairKey] ?? null;
}

function buildFallbackSharedTelemetry(nameA, nameB) {
  return [
    { label: 'Security events', example: `Activity that may appear in both ${nameA} and ${nameB}` },
    { label: 'Audit logs', example: 'Confirm whether each platform sends a separate copy' },
    { label: 'Flow records', example: 'Network metadata describing the same sessions' },
  ];
}

function sourceNameById(catalog, sourceId) {
  const flat = flattenSourceCatalog(Array.isArray(catalog) ? catalog : [catalog]);
  return flat.find((s) => s.id === sourceId)?.name || sourceId.replace(/_/g, ' ');
}

function isConfiguredCurrent(sourceStates, sourceId) {
  return sourceStates?.[sourceId]?.status === 'current';
}

/**
 * Plain-language overlap notes where both sources are configured (status=current).
 * Annotate-only — never reduces totals.
 */
export function getConfiguredOverlapNotes(sourceStates, catalog) {
  const prompts = detectActiveOverlaps(sourceStates, catalog);
  return prompts
    .filter((p) => p.sources.every((id) => isConfiguredCurrent(sourceStates, id)))
    .map((p) => {
      const [idA, idB] = p.sources;
      const nameA = sourceNameById(catalog, idA);
      const nameB = sourceNameById(catalog, idB);
      const copy = getPairTelemetryCopy(p.pairKey);
      const summary =
        copy?.summary ||
        `${nameA} and ${nameB} may share telemetry — confirm separate collection paths before production.`;
      const sharedTelemetry = (copy?.sharedTelemetry || buildFallbackSharedTelemetry(nameA, nameB)).slice(0, 5);
      return {
        pairKey: p.pairKey,
        sourceIds: p.sources,
        sourceNames: [nameA, nameB],
        groupLabel: p.groupLabel,
        summary,
        /** @deprecated use summary — retained for internal export strings */
        message: summary,
        sharedTelemetry,
        confirmQuestion: p.question,
        hint: DEFAULT_HINT,
      };
    });
}

function appDisplayName(appId) {
  return getCustomerAppDisplayName(appId, APP_NAMES.get(appId));
}

/**
 * Analysis top-10 priorities not yet configured (status !== current).
 */
export function getMissingAnalysisPriorities({ intake, sourceStates, overlapDecisions, sizingContext, limit = 10 }) {
  const priorities = getAnalysisSourcePriorities({
    intake,
    desiredApps: intake?.desiredApps,
    recommendedApps: intake?.recommendedApps,
    sourceStates,
    overlapDecisions,
    limit,
  });
  return priorities
    .filter((p) => !isConfiguredCurrent(sourceStates, p.sourceId))
    .map((p) => ({
      ...p,
      appLabels: (p.appsPowered || []).slice(0, 3).map(appDisplayName),
    }));
}

/**
 * @param {{ catalog, sourceStates, overlapDecisions?, sizingContext?, intake? }} params
 */
export function buildReviewGateData(params) {
  const session = sumSessionPlanningIngest(params);
  const { totals, eligible } = session;

  const configuredRows = eligible
    .filter((row) => isConfiguredCurrent(params.sourceStates, row.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      quantity: row.quantity,
      unitLabel: row.unitLabel,
      gbLow: row.gbLow,
      gbExpected: row.gbExpected,
      gbHigh: row.gbHigh,
      gbGrossLow: row.gbGrossLow,
      gbGrossExpected: row.gbGrossExpected,
      gbGrossHigh: row.gbGrossHigh,
      ciscoPromoApplied: Boolean(row.ciscoPromoApplied),
      isCustom: row.isCustom,
    }));

  const missingPriorities = filterMissingPrioritiesForEquivalency(
    getMissingAnalysisPriorities(params),
    params.sourceStates,
  );
  const overlaps = getConfiguredOverlapNotes(params.sourceStates, params.catalog);

  return {
    totals,
    eligible,
    configuredRows,
    configuredCount: configuredRows.length,
    missingPriorities,
    missingPriorityCount: missingPriorities.length,
    overlaps,
  };
}

export function formatQuantityUnit(row) {
  const qty = row.quantity;
  if (qty != null && qty > 0 && row.unitLabel) {
    return `${qty} ${row.unitLabel}`;
  }
  if (row.unitLabel) return row.unitLabel;
  return '—';
}
