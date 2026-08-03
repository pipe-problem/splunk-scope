/**
 * Shared source sizing result — single object for detail, Review, totals, charts, paths, reports.
 */

import { flattenSourceCatalog, isCatalogParentRolledUp, parentHasDirectSizingInputs } from './sizingEngine.js';
import { calculateFullSourceIngest, sourceCountsTowardTotals, getOverlapExcludedIds } from './sourceEligibilityEngine.js';
import { getLogChannelBreakdown } from './sourceHierarchyEngine.js';
import { toPlanningDisplayColumns } from '../utils/planningIngestDisplay.js';
import { formatIngestString, formatIngestTriplet } from '../utils/formatIngestDisplay.js';

function catalogToFlatList(catalog) {
  if (!catalog) return [];
  const roots = Array.isArray(catalog) ? catalog : [catalog];
  return flattenSourceCatalog(roots);
}

export const SIZING_STATE = {
  SIZED: 'sized',
  NEEDS_INPUT: 'needs_input',
  ROLLED_UP: 'rolled_up',
  EXCLUDED: 'excluded',
  LOOKUP: 'lookup',
};

/**
 * @param {object} source
 * @param {object} session
 * @param {object} [options]
 * @param {object} [options.catalog]
 * @param {object} [options.allInputs]
 * @param {object} [options.overlapDecisions]
 */
export function buildSourceSizingResult(source, session, options = {}) {
  const catalog = options.catalog ?? session?.catalog;
  const allInputs = options.allInputs ?? session?.sources ?? session?.sourceStates ?? {};
  const overlapDecisions = options.overlapDecisions ?? session?.overlapDecisions ?? {};
  const sourceState = allInputs[source?.id];

  const empty = {
    sourceId: source?.id,
    sourceName: source?.name ?? source?.id,
    lowGb: 0,
    expectedGb: 0,
    highGb: 0,
    confidence: 'none',
    hasValidInputs: false,
    missingInputs: [],
    includedInTotals: false,
    displayLow: '0',
    displayExpected: '0',
    displayHigh: '0',
    componentBreakdown: [],
    warnings: [],
    rateSource: 'catalog_formula',
    sizingModel: source?.sizing_formula?.strategy ?? 'catalog_formula',
    isRolledUpParent: false,
    rolledUpToChildren: false,
    sizingState: SIZING_STATE.NEEDS_INPUT,
    statusMessage: null,
    usedMeasuredBands: false,
    rawEstimate: null,
  };

  if (!source || !sourceState) return empty;

  const sizingContext = { catalog, allInputs };
  const excludedIds = getOverlapExcludedIds(overlapDecisions);
  const rolledUp = isCatalogParentRolledUp(catalog, allInputs, source.id);
  const hasDirectInputs = parentHasDirectSizingInputs(source, sourceState);

  const rawEstimate = calculateFullSourceIngest(source, sourceState, sizingContext);
  const cols = toPlanningDisplayColumns(rawEstimate);

  const missingInputs = extractMissingInputs(source, sourceState, rawEstimate, rolledUp, hasDirectInputs);
  const warnings = [...(rawEstimate.warnings || [])];
  const componentBreakdown = extractComponentBreakdown(source, sourceState, rawEstimate, sizingContext);

  if (rawEstimate.lookupContextOnly) {
    return {
      ...empty,
      confidence: 'none',
      missingInputs: [],
      warnings,
      rateSource: rawEstimate.rateSource || 'lookup_context',
      sizingState: SIZING_STATE.LOOKUP,
      statusMessage: 'Lookup / Context Source',
      includedInTotals: false,
      rawEstimate,
    };
  }

  if (rolledUp && !hasDirectInputs && rawEstimate.rateSource === 'rollup_children') {
    return {
      ...empty,
      confidence: 'none',
      missingInputs: [],
      warnings: rawEstimate.assumptions || [],
      rateSource: 'rollup_children',
      isRolledUpParent: true,
      rolledUpToChildren: true,
      sizingState: SIZING_STATE.ROLLED_UP,
      statusMessage: 'Rolled up through configured child sources',
      rawEstimate,
    };
  }

  if (hasActiveChildBranch(catalog, allInputs, source.id) && hasDirectInputs) {
    warnings.push(
      'This parent source has its own sizing inputs while child sources are also Active or Planned — confirm ingest is not double-counted.',
    );
  }

  const hasValidInputs = missingInputs.length === 0 && rawEstimate.confidence !== 'none'
    && (rawEstimate.expected > 0 || rawEstimate.rateSource === 'manual');

  const includedInTotals = sourceCountsTowardTotals(source, sourceState, rawEstimate, excludedIds);

  let sizingState = SIZING_STATE.NEEDS_INPUT;
  if (includedInTotals && hasValidInputs && cols.gbExpected > 0) {
    sizingState = SIZING_STATE.SIZED;
  } else if (sourceState.status === 'skip') {
    sizingState = SIZING_STATE.EXCLUDED;
  } else if (rolledUp && !hasDirectInputs) {
    sizingState = SIZING_STATE.ROLLED_UP;
  } else if (sourceState.status !== 'current' && sourceState.status !== 'future') {
    sizingState = SIZING_STATE.EXCLUDED;
  } else if (!hasValidInputs && missingInputs.length > 0) {
    sizingState = SIZING_STATE.NEEDS_INPUT;
  } else if (cols.gbExpected === 0 && sourceState.status === 'current' || sourceState.status === 'future') {
    sizingState = SIZING_STATE.NEEDS_INPUT;
  }

  const triplet = formatIngestTriplet({
    lowGb: cols.gbLow,
    expectedGb: cols.gbExpected,
    highGb: cols.gbHigh,
  });

  let statusMessage = null;
  if (sizingState === SIZING_STATE.ROLLED_UP) {
    statusMessage = 'Rolled up through configured child sources';
  } else if (sizingState === SIZING_STATE.NEEDS_INPUT && missingInputs.length) {
    statusMessage = missingInputs.join('; ');
  }

  return {
    sourceId: source.id,
    sourceName: source.name,
    lowGb: cols.gbLow,
    expectedGb: cols.gbExpected,
    highGb: cols.gbHigh,
    confidence: rawEstimate.confidence,
    hasValidInputs,
    missingInputs,
    includedInTotals,
    displayLow: triplet.low.display,
    displayExpected: triplet.expected.display,
    displayHigh: triplet.high.display,
    componentBreakdown,
    warnings,
    rateSource: rawEstimate.rateSource,
    sizingModel: rawEstimate.rateSource || source.sizing_formula?.strategy || 'catalog_formula',
    isRolledUpParent: rolledUp,
    rolledUpToChildren: rolledUp && !hasDirectInputs,
    sizingState,
    statusMessage,
    usedMeasuredBands: cols.usedMeasuredBands,
    rawEstimate,
  };
}

function hasActiveChildBranch(catalog, allInputs, sourceId) {
  const flat = catalogToFlatList(catalog);
  const node = flat.find((s) => s.id === sourceId);
  if (!node?.children?.length) return false;
  return node.children.some((c) => {
    const st = allInputs[c.id]?.status;
    return st === 'current' || st === 'future';
  });
}

function extractMissingInputs(source, sourceState, rawEstimate, rolledUp, hasDirectInputs) {
  if (rolledUp && !hasDirectInputs && rawEstimate.rateSource === 'rollup_children') {
    return [];
  }

  const missing = [];
  const warnings = rawEstimate.warnings || [];

  for (const w of warnings) {
    if (w.includes('Missing monitored users')) missing.push('Missing monitored users');
    if (w.includes('Missing firewall sizing inputs')) missing.push('Missing firewall sizing inputs');
    if (w.includes('Missing active users for SaaS activity sizing')) {
      missing.push('Missing active users for SaaS activity sizing');
    }
    if (w.includes('Missing DLP product/channel count')) {
      missing.push('Missing DLP product/channel count');
    }
    if (w.toLowerCase().includes('missing')) {
      const cleaned = w.replace(/^Missing:\s*/i, '').trim();
      if (cleaned && !missing.includes(cleaned)) missing.push(cleaned);
    }
  }

  if (source.id === 'saas_general') {
    const profile = sourceState.saasCollectionProfile || 'standard_activity';
    const users = parseFloat(sourceState.saasActiveUsers || 0);
    if (profile !== 'audit_only' && users <= 0) {
      if (!missing.includes('Missing active users for SaaS activity sizing')) {
        missing.push('Missing active users for SaaS activity sizing');
      }
    }
  }

  if (source.id === 'dlp') {
    const users = parseFloat(sourceState.number_of_users || 0);
    const channels = parseFloat(sourceState.number_of_channels || 0);
    const profile = sourceState.dlpSizingProfile || 'user_and_channel';
    if (profile === 'channel_products' && channels <= 0) {
      if (!missing.includes('Missing DLP product/channel count')) {
        missing.push('Missing DLP product/channel count');
      }
    } else if (profile !== 'lookup_context' && profile !== 'channel_products' && users <= 0) {
      if (!missing.includes('Missing monitored users')) missing.push('Missing monitored users');
    }
  }

  if (source.id === 'firewalls') {
    const systems = parseFloat(sourceState.number_of_systems || sourceState.count || 0);
    const users = parseFloat(sourceState.number_of_users || 0);
    const hasTraffic = sourceState.logging_scope || sourceState.traffic_level;
    if (!systems && !users && !hasTraffic && rawEstimate.expected <= 0) {
      if (!missing.includes('Missing firewall sizing inputs')) {
        missing.push('Missing firewall sizing inputs');
      }
    }
  }

  if (
    rawEstimate.confidence === 'none'
    && rawEstimate.expected <= 0
    && (sourceState.status === 'current' || sourceState.status === 'future')
    && missing.length === 0
  ) {
    const generic = warnings.find((w) => w.includes('No quantity inputs provided'));
    if (generic) missing.push('Missing sizing quantity inputs');
  }

  return missing;
}

function extractComponentBreakdown(source, sourceState, rawEstimate, sizingContext) {
  const bd = rawEstimate.saaBreakdown
    || rawEstimate.crmBreakdown
    || rawEstimate.iaasBreakdown
    || rawEstimate.ssoBreakdown
    || rawEstimate.officeBreakdown
    || rawEstimate.containerBreakdown
    || rawEstimate.cloudVmBreakdown
    || rawEstimate.cloudStorageBreakdown;

  if (bd?.length) {
    return bd.map((row) => ({
      id: row.id,
      label: row.label,
      count: row.count,
      unit: row.unit,
      lowGb: row.lowGb ?? row.tierGb,
      expectedGb: row.displayGb ?? row.tierGb ?? row.mediumGb,
      highGb: row.highGb,
      display: formatIngestString(row.displayGb ?? row.tierGb ?? row.mediumGb ?? 0),
    }));
  }

  const logBreakdown = getLogChannelBreakdown(source, sourceState, sizingContext);
  if (logBreakdown?.channels?.length) {
    return logBreakdown.channels.map((ch) => ({
      id: ch.id,
      label: ch.name,
      count: ch.serverCount,
      unit: 'server',
      expectedGb: ch.totalGb,
      display: formatIngestString(ch.totalGb),
      perServerGb: ch.perServerGb,
    }));
  }

  return [];
}

/**
 * Build sizing results for all configured sources in a session.
 */
export function buildSessionSizingResults(session, options = {}) {
  const catalog = options.catalog ?? session?.catalog;
  const allInputs = options.allInputs ?? session?.sources ?? {};
  const flat = catalogToFlatList(catalog);
  const overlapDecisions = options.overlapDecisions ?? session?.overlapDecisions ?? {};

  const results = {};
  for (const source of flat) {
    const ss = allInputs[source.id];
    if (!ss || ss.status === 'unknown') continue;
    results[source.id] = buildSourceSizingResult(source, session, {
      catalog,
      allInputs,
      overlapDecisions,
    });
  }
  return results;
}

/**
 * Session sizing summary for KPI strip / Review footer.
 */
export function summarizeSessionSizing(session, options = {}) {
  const results = buildSessionSizingResults(session, options);
  const allInputs = options.allInputs ?? session?.sources ?? {};
  let sizedCurrent = 0;
  let needsInputCurrent = 0;
  let plannedExcluded = 0;
  let totalExpectedGb = 0;

  for (const [id, r] of Object.entries(results)) {
    const st = allInputs[id]?.status;
    if (st === 'future') {
      plannedExcluded += 1;
      continue;
    }
    if (st !== 'current') continue;
    if (r.includedInTotals && r.expectedGb > 0) {
      sizedCurrent += 1;
      totalExpectedGb += r.expectedGb;
    } else if (r.sizingState === SIZING_STATE.NEEDS_INPUT || r.sizingState === SIZING_STATE.ROLLED_UP) {
      if (r.sizingState === SIZING_STATE.NEEDS_INPUT) needsInputCurrent += 1;
    } else if (r.expectedGb <= 0 && r.sizingState !== SIZING_STATE.ROLLED_UP) {
      needsInputCurrent += 1;
    }
  }

  return { sizedCurrent, needsInputCurrent, plannedExcluded, totalExpectedGb, results };
}
