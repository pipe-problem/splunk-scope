/**
 * Source Prioritization Engine
 *
 * Scores sources 0–100 from intake, apps, use cases, budget, deployment,
 * configured sources, capability gaps, overlap, and ingest efficiency.
 * Maps to customer-facing labels: suggested | optional | redundant | needs_review
 */

import rules from '../data/sourceRecommendationRules.json' with { type: 'json' }
import sourceUseCaseMappings from '../data/sourceUseCaseMappings.json' with { type: 'json' }
import sourceLogCapabilities from '../data/sourceLogCapabilities.json' with { type: 'json' }
import { classifySourceByCapability } from './sourceRequirementEngine.js'
import { classifySource, getLabelExplanation } from './sourceRecommendationEngine.js'
import { computeIngestBudgetFromIntake } from './budgetEngine.js'
import { calculateSourceSize } from './sizingEngine.js'
import sourceCatalogTree from '../data/sources.json' with { type: 'json' }
import { collectCanonicalAppIds } from './appCatalogService.js'
import { withEffectiveGoals } from '../utils/goalPresets.js'

const LABEL_ORDER = Object.fromEntries(
  (rules.labelOrder || ['suggested', 'needs_review', 'optional', 'redundant']).map((l, i) => [l, i]),
)

const LEGACY_TO_LABEL = {
  required: 'suggested',
  recommended: 'suggested',
  optional: 'optional',
  redundant: 'redundant',
  needs_review: 'needs_review',
  unnecessary: 'optional',
}

function isActive(sourceStates, sourceId) {
  const ss = sourceStates?.[sourceId]
  return ss?.status === 'current' || ss?.status === 'future'
}

function normalizeScore(raw) {
  return Math.max(0, Math.min(100, Math.round(raw)))
}

/**
 * @param {object} intake
 * @returns {'low'|'medium'|'high'}
 */
export function getBudgetSensitivityBand(intake) {
  const budget = computeIngestBudgetFromIntake(intake)
  if (!budget?.budgetGbDay) return rules.defaultBudgetBand || 'medium'
  const gb = budget.budgetGbDay
  if (gb <= rules.budgetBands.low.maxBudgetGbDay) return 'low'
  if (gb >= rules.budgetBands.high.minBudgetGbDay) return 'high'
  return 'medium'
}

function collectInterpretationText(intake) {
  const effective = withEffectiveGoals(intake || {});
  return [
    effective.discoveryNotes,
    effective.customUseCases,
    effective.crawlGoal,
    effective.walkGoal,
    effective.runGoal,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Cloud-only sources rank high only when cloud security / IaaS is explicitly in scope. */
export function isCloudSecurityInScope(intake, useCases) {
  const text = collectInterpretationText(intake)
  if ((rules.cloudInScopeKeywords || []).some((kw) => text.includes(kw.toLowerCase()))) return true
  const ucIds = new Set((useCases || []).map((u) => u.id))
  if ((rules.cloudInScopeUseCaseIds || []).some((id) => ucIds.has(id))) return true
  return false
}

function scoreSiemCoreBoost(sourceId, useCases, desiredApps) {
  if (!rules.siemCoreSourceIds?.includes(sourceId)) return 0
  const securityApps = ['enterprise_security', 'infosec_app', 'security_essentials']
  const hasSecurityApp = (desiredApps || []).some((a) => securityApps.includes(a))
    || (useCases || []).some((uc) => /security|siem|threat|identity|network/i.test(uc.name || ''))
  return hasSecurityApp ? 10 : 0
}

function scoreUseCaseRelevance(sourceId, useCases) {
  const mapping = (sourceUseCaseMappings.mappings || {})[sourceId]
  if (!mapping?.useCases?.length || !useCases?.length) return 0
  const selectedIds = new Set(useCases.map((u) => u.id))
  let score = 0
  for (const row of mapping.useCases) {
    if (!selectedIds.has(row.useCaseId)) continue
    if (row.relevance === 'high') score += 12
    else if (row.relevance === 'medium') score += 7
    else if (row.relevance === 'low') score += 0
  }
  return Math.min(rules.scoreWeights.useCaseRelevance || 22, score)
}

function scoreAppAlignment(sourceId, desiredApps, useCases) {
  const profileNames = (useCases || []).flatMap((uc) => uc.splunkApps || [])
  const appIds = collectCanonicalAppIds([...(desiredApps || []), ...profileNames])
  let score = 0
  for (const appId of appIds) {
    const mapping = rules.appCapabilityMappings[appId]
    if (!mapping) continue
    if (mapping.boostSourceIds?.includes(sourceId)) score += 8
    const caps = sourceLogCapabilities.capabilities?.[sourceId]?.produces || []
    for (const cap of mapping.boostCapabilities || []) {
      if (caps.includes(cap)) score += 3
    }
  }
  return Math.min(rules.scoreWeights.appAlignment || 18, score)
}

function scoreDeploymentFit(sourceId, deploymentType, cloudInScope) {
  const dep = rules.deploymentWeights[deploymentType || 'cloud'] || rules.deploymentWeights.hybrid
  const isCloudOnly = rules.cloudOnlySourceIds?.includes(sourceId)
  if (isCloudOnly && !cloudInScope) return -22
  if (dep.boostSourceIds?.includes(sourceId)) {
    if (isCloudOnly && !cloudInScope) return -22
    return rules.scoreWeights.deploymentFit || 12
  }
  if (dep.deemphasizeSourceIds?.includes(sourceId)) return -10
  return 0
}

function scoreInterpretationKeywords(sourceId, intake) {
  const text = collectInterpretationText(intake)
  if (!text) return 0
  let score = 0
  for (const row of rules.interpretationKeywords || []) {
    const hit = row.keywords.some((kw) => text.includes(kw.toLowerCase()))
    if (hit && row.boostSourceIds?.includes(sourceId)) score += row.boost || 4
  }
  return Math.min(rules.scoreWeights.interpretationKeywords || 8, score)
}

function scoreIngestEfficiency(source, sourceStates) {
  const ss = sourceStates[source.id] || {}
  const est = calculateSourceSize(source, ss, { catalog: sourceCatalogTree, allInputs: sourceStates })
  const rate = typeof source.sizingRate === 'number' ? source.sizingRate : 0
  const highVolume =
    rules.highVolumeSourceIds?.includes(source.id) ||
    rate >= (rules.ingestEfficiency?.highRateThreshold || 0.35)
  if (highVolume && est.expected > 5) return -6
  if (est.expected > 0 && est.expected <= 2) return 6
  return 0
}

function applySubstitutionRules(sourceId, sourceStates, budgetBand) {
  for (const rule of rules.substitutionRules || []) {
    if (!rule.downgradeSources?.includes(sourceId)) continue
    const primaryActive = rule.primarySources?.some((id) => isActive(sourceStates, id))
    if (!primaryActive) continue
    const downgradeTo = rule.downgradeTo || 'optional'
    const penalty = downgradeTo === 'redundant' ? 40 : 20
    const mod = rules.budgetModifiers[budgetBand]?.overlapStrictness || 1
    return {
      forcedLabel: downgradeTo,
      penalty: penalty * mod,
      reason: rule.reasonTemplate,
    }
  }
  return null
}

function buildCustomerReason(label, source, ctx) {
  const { capResult, budgetBand, substitutionReason, baseReason, gapCount } = ctx
  if (substitutionReason) return substitutionReason
  if (label === 'redundant') {
    return capResult.explanation || baseReason || 'May overlap with another configured source — confirm separate telemetry before counting additional ingest.'
  }
  if (label === 'needs_review') {
    if (!sourceStatesHasScope(source, ctx.sourceStates)) {
      return 'Planning considerations: confirm vendor, logging scope, and count before including this source in the estimate.'
    }
    return capResult.explanation || baseReason || 'Confirm whether this telemetry is separate from other configured sources.'
  }
  if (label === 'suggested' && gapCount > 0) {
    return `Suggested because it helps close ${gapCount} important visibility gap${gapCount > 1 ? 's' : ''} for your selected apps and use cases.`
  }
  if (label === 'suggested') {
    return capResult.explanation || baseReason || 'Suggested because it aligns with your selected apps, use cases, and deployment goals.'
  }
  if (label === 'optional' && budgetBand === 'low') {
    return 'Optional for now — useful enrichment in a later phase; core sources should be prioritized first.'
  }
  return capResult.explanation || baseReason || getLabelExplanation(label) || 'Useful enrichment when capacity allows.'
}

function sourceStatesHasScope(source, sourceStates) {
  const ss = sourceStates[source.id] || {}
  if (ss.vendor || ss.logging_scope || ss.notes) return true
  for (const f of source.input_fields || []) {
    if (ss[f.key] != null && ss[f.key] !== '') return true
  }
  return false
}

/**
 * @returns {{ priorityScore: number, label: string, classification: string, score: number, reason: string, explanation: string, confidence: string }}
 */
export function prioritizeSource(
  source,
  useCases,
  desiredApps,
  allSources,
  sourceStates,
  overlapDecisions,
  overlapGroups,
  intake,
) {
  const budgetBand = getBudgetSensitivityBand(intake)
  const budgetMod = rules.budgetModifiers[budgetBand] || rules.budgetModifiers.medium
  const cloudInScope = isCloudSecurityInScope(intake, useCases)

  const domainResult = classifySource(
    source, useCases, desiredApps, allSources, sourceStates, overlapDecisions, overlapGroups,
  )
  const capResult = classifySourceByCapability(source, useCases, desiredApps, allSources, sourceStates)

  const capLabel = LEGACY_TO_LABEL[capResult.classification] || 'optional'
  const domainLabel = LEGACY_TO_LABEL[domainResult.classification] || 'optional'
  const labelRank = { suggested: 0, needs_review: 1, optional: 2, redundant: 3 }

  let label = capLabel
  if (capResult.confidence === 'low' && (labelRank[domainLabel] ?? 9) < (labelRank[capLabel] ?? 9)) {
    label = domainLabel
  } else if ((labelRank[domainLabel] ?? 9) < (labelRank[capLabel] ?? 9)) {
    label = domainLabel
  }

  let reason = capResult.explanation || domainResult.reason || ''
  let confidence = capResult.confidence || 'medium'

  if (capResult.classification === 'redundant' || domainResult.classification === 'redundant') {
    label = 'redundant'
  } else if (capResult.classification === 'needs_review' || domainResult.classification === 'needs_review') {
    label = 'needs_review'
  }

  const substitution = applySubstitutionRules(source.id, sourceStates, budgetBand)
  if (substitution) {
    if (label !== 'needs_review') label = substitution.forcedLabel
    reason = substitution.reason
  }

  const gapCount = capResult.gapsAddressed?.length || 0

  let score =
    20 +
    scoreUseCaseRelevance(source.id, useCases) +
    scoreAppAlignment(source.id, desiredApps, useCases) +
    scoreDeploymentFit(source.id, intake?.deploymentType, cloudInScope) +
    scoreInterpretationKeywords(source.id, intake) +
    scoreIngestEfficiency(source, sourceStates) +
    scoreSiemCoreBoost(source.id, useCases, desiredApps) +
    Math.min(rules.scoreWeights.capabilityGapClosure || 30, gapCount * 10)

  if (rules.cloudOnlySourceIds?.includes(source.id) && !cloudInScope) {
    score -= 25
    if (label === 'suggested' && gapCount === 0) label = 'optional'
  }

  if (rules.minimumViableByBand[budgetBand]?.includes(source.id)) {
    score += budgetMod.minimumViableBoost || 8
  }

  if (rules.enrichmentSourceIds?.includes(source.id) && budgetBand === 'low') {
    score -= budgetMod.enrichmentPenalty || 18
    if (label === 'suggested') label = 'optional'
  }

  if (substitution?.penalty) score -= substitution.penalty

  if (label === 'redundant') score = Math.min(score, 25)
  if (label === 'needs_review') score = Math.min(Math.max(score, 30), 55)
  if (label === 'optional' && score > 70 && gapCount === 0 && !rules.minimumViableByBand[budgetBand]?.includes(source.id)) {
    score = 55
  }

  const priorityScore = normalizeScore(score)

  if (rules.minimumViableByBand[budgetBand]?.includes(source.id) && priorityScore >= 45 && label !== 'redundant' && label !== 'needs_review') {
    label = 'suggested'
  }

  if (label === 'suggested' && priorityScore < 40 && gapCount === 0 && !rules.minimumViableByBand[budgetBand]?.includes(source.id)) {
    label = 'optional'
  }
  if (priorityScore >= 62 && gapCount > 0 && label === 'optional') {
    const lowBudgetEnrichment = rules.enrichmentSourceIds?.includes(source.id) && budgetBand === 'low'
    if (!lowBudgetEnrichment) label = 'suggested'
  }
  if (priorityScore >= 68 && domainLabel === 'suggested' && label === 'optional' && !substitution) {
    const lowBudgetEnrichment = rules.enrichmentSourceIds?.includes(source.id) && budgetBand === 'low'
    if (!lowBudgetEnrichment) label = 'suggested'
  }

  const customerReason = buildCustomerReason(label, source, {
    capResult,
    budgetBand,
    substitutionReason: substitution?.reason,
    baseReason: reason,
    gapCount,
    sourceStates,
  })

  return {
    priorityScore,
    label,
    classification: label,
    score: priorityScore,
    reason: customerReason,
    explanation: customerReason,
    confidence,
    capabilitiesSatisfied: capResult.capabilitiesSatisfied,
    gapsAddressed: capResult.gapsAddressed,
    possibleOverlaps: capResult.possibleOverlaps,
    affectsGbDay: capResult.affectsGbDay,
    dataModelsImpacted: capResult.dataModelsImpacted,
    cimRequired: capResult.cimRequired,
    budgetBand,
  }
}

export function prioritizeAllSources(
  sources,
  useCases,
  desiredApps,
  allSources,
  sourceStates,
  overlapDecisions,
  overlapGroups,
  intake,
) {
  return sources.map((source) => ({
    ...source,
    relevance: prioritizeSource(
      source, useCases, desiredApps, allSources, sourceStates, overlapDecisions, overlapGroups, intake,
    ),
  }))
}

export function sortSourcesByPriority(sourcesWithRelevance) {
  return [...sourcesWithRelevance].sort((a, b) => {
    const orderA = LABEL_ORDER[a.relevance?.label] ?? 99
    const orderB = LABEL_ORDER[b.relevance?.label] ?? 99
    if (orderA !== orderB) return orderA - orderB
    return (b.relevance?.priorityScore ?? 0) - (a.relevance?.priorityScore ?? 0)
  })
}

/** @deprecated alias */
export function prioritizeAndSortSources(
  sources,
  useCases,
  desiredApps,
  allSources,
  sourceStates,
  overlapDecisions,
  overlapGroups,
  intake,
) {
  const prioritized = prioritizeAllSources(
    sources, useCases, desiredApps, allSources, sourceStates, overlapDecisions, overlapGroups, intake,
  )
  return sortSourcesByPriority(prioritized)
}

export function getTopSuggestedSources(sourcesWithRelevance, limit = rules.topSuggestedLimit || 8) {
  return sortSourcesByPriority(sourcesWithRelevance)
    .filter((s) => s.relevance?.label === 'suggested')
    .slice(0, limit)
}

/**
 * Rank categories by sum of top source scores in each category.
 */
export function rankCategoriesByRelevance(sourcesWithRelevance) {
  const byCat = {}
  for (const s of sourcesWithRelevance) {
    const cat = s.category || 'Other'
    if (!byCat[cat]) byCat[cat] = []
    byCat[cat].push(s.relevance?.priorityScore ?? 0)
  }
  return Object.entries(byCat)
    .map(([category, scores]) => ({
      category,
      score: scores.sort((a, b) => b - a).slice(0, 5).reduce((sum, n) => sum + n, 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.category)
}

export { LABEL_ORDER, rules as recommendationRules }
