/**
 * Source Eligibility Engine
 *
 * Single source of truth for whether a source counts toward totals and coverage.
 * All pages and engines must use these helpers instead of inline eligibility checks.
 */

import { SIZING_MODE, OVERLAP_ANNOTATE_ONLY } from '../config/featureFlags.js'
import { calculateSourceSize, isCatalogParentRolledUp, getScopeMultiplier, lookupSizingRate } from './sizingEngine.js'
import { calculateLogOptionIngest } from './sourceHierarchyEngine.js'
import { getExcludedSources } from './overlapEngine.js'
import { formatIngestString } from '../utils/formatIngestDisplay.js'
import { applySizingGuardrails } from './sourceSizingGuardrailEngine.js'
import { calculateSimpleSourceIngest } from './simpleSizingEngine.js'

/**
 * Canonical ingest calculation for a source including child log options.
 * When log channels are selected, channel-sum replaces the flat catalog rate (avoids double-counting).
 *
 * @param {{ catalog?: object[], allInputs?: Record<string, object> }} [sizingContext] - When set, parent rows roll up to children (see sizingEngine).
 */
export function calculateFullSourceIngest(source, sourceState, sizingContext) {
  if (SIZING_MODE === 'simple') {
    return calculateSimpleSourceIngest(source, sourceState, sizingContext)
  }

  const rollup = sizingContext?.catalog && sizingContext?.allInputs && source?.id
    && isCatalogParentRolledUp(sizingContext.catalog, sizingContext.allInputs, source.id)
  const childIngest = rollup ? 0 : calculateLogOptionIngest(source, sourceState, sizingContext)
  const logOpts = source.log_options || []
  const usesChannelSum = logOpts.length > 0 && childIngest > 0

  if (usesChannelSum) {
    const scope = sourceState?.logging_scope || sourceState?.audit_level || ''
    const vendor = sourceState?.vendor || ''
    const model = sourceState?.model || sourceState?.firewall_model || sourceState?.appliance_model || ''
    const lookup = source.id != null ? lookupSizingRate(source.id, vendor, model) : null
    const scopeMult = getScopeMultiplier(scope, lookup?.catalogEntry)
    const expected = childIngest * scopeMult
    const channelResult = {
      low: expected * 0.6,
      expected,
      high: expected * 1.5,
      confidence: scope ? 'medium' : 'medium',
      assumptions: ['Sized from selected log channels (flat catalog rate omitted)', ...(scope ? [`Scope: ${scope}`] : [])],
      warnings: [],
      rateSource: 'log_channels',
      needsReview: false,
      countBasis: source.sizing_formula?.primary_input?.replace(/_/g, ' ').replace('number of ', '') || 'unit',
      vendorMultiplier: 1.0,
      scopeMultiplier: scopeMult,
      bufferApplied: false,
      childIngest,
    }
    return applySizingGuardrails(source, sourceState, channelResult)
  }

  const base = calculateSourceSize(source, sourceState, sizingContext)
  const combined = {
    ...base,
    low: base.low + childIngest * 0.6,
    expected: base.expected + childIngest,
    high: base.high + childIngest * 1.5,
    childIngest,
  }
  return applySizingGuardrails(source, sourceState, combined)
}

/**
 * Whether a source counts toward GB/day totals.
 *
 * A source counts if:
 *  - status is 'current' or 'future'
 *  - AND (estimated GB/day > 0 OR explicitly included with a valid reason)
 *  - AND not excluded by overlap dedup decisions
 */
export function sourceCountsTowardTotals(source, sourceState, estimate, overlapExcludedIds) {
  if (!sourceState) return false

  const status = sourceState.status
  if (status !== 'current' && status !== 'future') return false

  const excluded = Array.isArray(overlapExcludedIds)
    ? overlapExcludedIds
    : overlapExcludedIds instanceof Set
      ? [...overlapExcludedIds]
      : []
  const sid = source?.id ?? sourceState?.id
  if (sid && excluded.includes(sid)) return false

  const manualInclude = sourceState.includeInTotals === true
    && typeof sourceState.includeInTotalsReason === 'string'
    && sourceState.includeInTotalsReason.trim().length > 0
  if (manualInclude) return true

  const gb = estimate?.expected ?? 0
  return gb > 0
}

/**
 * Whether a source counts toward coverage scoring.
 *
 * Same rules as totals — a source with 0 GB/day and no manual inclusion
 * must not inflate domain coverage.
 */
export function sourceCountsTowardCoverage(source, sourceState, estimate, overlapExcludedIds) {
  return sourceCountsTowardTotals(source, sourceState, estimate, overlapExcludedIds)
}

/**
 * Human-readable explanation of why a source is or is not eligible.
 */
export function explainSourceEligibility(source, sourceState, estimate, overlapExcludedIds) {
  const sid = source?.id ?? sourceState?.id
  const status = sourceState?.status

  if (!sourceState) {
    return { eligible: false, reason: 'No source state — not configured.' }
  }

  if (status !== 'current' && status !== 'future') {
    return { eligible: false, reason: `Status is "${status || 'unknown'}" — only Current or Future sources count.` }
  }

  const excluded = Array.isArray(overlapExcludedIds)
    ? overlapExcludedIds
    : overlapExcludedIds instanceof Set
      ? [...overlapExcludedIds]
      : []
  if (sid && excluded.includes(sid)) {
    return { eligible: false, reason: 'Excluded by overlap dedup decision.' }
  }

  const manualInclude = sourceState.includeInTotals === true
    && typeof sourceState.includeInTotalsReason === 'string'
    && sourceState.includeInTotalsReason.trim().length > 0
  if (manualInclude) {
    return { eligible: true, reason: `Manually included: ${sourceState.includeInTotalsReason.trim()}` }
  }

  const gb = estimate?.expected ?? 0
  if (gb <= 0) {
    if (estimate?.rateSource === 'rollup_children') {
      return { eligible: false, reason: 'Rolled up through configured child sources.' }
    }
    const warn = estimate?.warnings?.[0]
    if (warn) return { eligible: false, reason: warn }
    return { eligible: false, reason: 'Needs sizing input — no ingest estimate.' }
  }

  return { eligible: true, reason: `Estimated ${formatIngestString(gb)}.` }
}

/**
 * Get the set of excluded source IDs from overlap decisions.
 * Convenience wrapper around overlapEngine.getExcludedSources.
 */
export function getOverlapExcludedIds(overlapDecisions) {
  if (OVERLAP_ANNOTATE_ONLY) return []
  const { excluded } = getExcludedSources(overlapDecisions || {})
  return excluded instanceof Set ? [...excluded] : [...(excluded || [])]
}
