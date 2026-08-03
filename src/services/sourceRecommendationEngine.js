/**
 * Source Recommendation Engine
 *
 * Dynamically classifies sources as Required / Recommended / Optional /
 * Redundant / Unnecessary / Needs Review based on:
 *   - log capability requirements from apps/use cases (primary)
 *   - telemetry domains already covered by active sources (fallback)
 *   - overlap groups and user overlap decisions
 *   - source hierarchy (parent/child)
 */

import { classifySourceByCapability } from './sourceRequirementEngine.js'
import { prioritizeAndSortSources } from './sourcePrioritizationEngine.js'
import { sourceMatchesAppInterest } from './appCatalogService.js'
import sourceCatalogTree from '../data/sources.json' with { type: 'json' }
import { isBranchActiveInSession } from './sizingEngine.js'
import { STRENGTH_SCORE } from './strengthScores.js'

const COVERAGE_THRESHOLD = 0.75

const LABEL_EXPLANATIONS = {
  suggested:
    'Strongly aligned with your selected apps, use cases, and current visibility gaps.',
  optional:
    'Useful enrichment when capacity allows; not required for the current planning scope.',
  redundant:
    'May overlap with another configured source. Confirm whether this is a separate feed before counting additional ingest.',
  needs_review:
    'Confirm vendor, logging scope, and overlap with other sources before including in the estimate.',
}

export function getLabelExplanation(classification) {
  const legacy = {
    required: LABEL_EXPLANATIONS.suggested,
    recommended: LABEL_EXPLANATIONS.suggested,
    unnecessary: LABEL_EXPLANATIONS.optional,
  }
  return LABEL_EXPLANATIONS[classification] || legacy[classification] || ''
}

/**
 * Build a domain satisfaction map from currently active sources,
 * optionally excluding a specific source so we can evaluate what
 * the landscape looks like *without* it.
 */
function buildDomainSatisfaction(allSources, sourceStates, excludeId) {
  const satisfaction = {}

  for (const source of allSources) {
    if (source.id === excludeId) continue
    const ss = sourceStates[source.id]
    if (!ss || (ss.status !== 'current' && ss.status !== 'future')) continue
    if (!source.telemetryDomains) continue

    for (const [domain, strength] of Object.entries(source.telemetryDomains)) {
      const score = STRENGTH_SCORE[strength] || 0
      if (!satisfaction[domain] || score > satisfaction[domain].score) {
        satisfaction[domain] = { score, strength, sourceId: source.id }
      }
    }
  }

  return satisfaction
}

/**
 * Collect all required and recommended domains across selected use cases.
 */
function collectDomainRequirements(useCases) {
  const required = new Set()
  const recommended = new Set()

  for (const uc of useCases || []) {
    for (const d of uc.requiredDomains || []) required.add(d)
    for (const d of uc.recommendedDomains || []) recommended.add(d)
  }

  return { required, recommended }
}

/**
 * Check if a source is in the same overlap group as another active source
 * and the user hasn't confirmed it's separate.
 */
function checkRedundancy(sourceId, sourceStates, overlapDecisions, overlapGroups) {
  if (!overlapGroups) return { isRedundant: false }

  for (const [, group] of Object.entries(overlapGroups)) {
    for (const pair of group.pairs || []) {
      if (!pair.sources.includes(sourceId)) continue

      const otherId = pair.sources.find((s) => s !== sourceId)
      if (!isBranchActiveInSession(otherId, sourceStates, sourceCatalogTree)) continue

      const pairKey = `${pair.sources[0]}__${pair.sources[1]}`
      const decision = overlapDecisions?.[pairKey]

      if (decision?.selectedOption?.dedup) {
        const excludedId = pairKey.split('__')[1]
        if (excludedId === sourceId) {
          return { isRedundant: true, reason: `Included in ${pair.sources[0].replace(/_/g, ' ')} logging` }
        }
      }

      if (!decision) {
        const isSecondary = pair.sources[1] === sourceId
        if (isSecondary) {
          return { isRedundant: false, needsReview: true, reason: `May overlap with ${pair.sources[0].replace(/_/g, ' ')}` }
        }
      }
    }
  }

  return { isRedundant: false }
}

/**
 * Main classification function. Evaluates a single source against the
 * full session context.
 *
 * @returns {{ classification: string, score: number, reason: string, explanation: string }}
 */
export function classifySource(
  source,
  useCases,
  desiredApps,
  allSources,
  sourceStates,
  overlapDecisions,
  overlapGroups,
) {
  if (!source.telemetryDomains || Object.keys(source.telemetryDomains).length === 0) {
    return {
      classification: 'needs_review',
      score: 0,
      reason: 'No telemetry domain mapping defined',
      explanation: getLabelExplanation('needs_review'),
    }
  }

  const { required: reqDomains, recommended: recDomains } = collectDomainRequirements(useCases)
  const domainSatisfaction = buildDomainSatisfaction(allSources, sourceStates, source.id)

  const redundancy = checkRedundancy(source.id, sourceStates, overlapDecisions, overlapGroups)
  if (redundancy.isRedundant) {
    return {
      classification: 'redundant',
      score: -10,
      reason: redundancy.reason,
      explanation: getLabelExplanation('redundant'),
    }
  }

  const interestRaw = [
    ...(desiredApps || []),
    ...(useCases || []).flatMap((uc) => uc.splunkApps || []),
  ]
  const appMatch = sourceMatchesAppInterest(source.splunkApps, interestRaw)

  let unsatisfiedRequiredFills = 0
  let partialRequiredFills = 0
  let recommendedFills = 0
  let totalStrength = 0

  for (const [domain, strength] of Object.entries(source.telemetryDomains)) {
    const score = STRENGTH_SCORE[strength] || 0
    totalStrength += score

    const currentSat = domainSatisfaction[domain]
    const currentScore = currentSat?.score || 0
    const isSatisfied = currentScore >= COVERAGE_THRESHOLD

    if (reqDomains.has(domain)) {
      if (!isSatisfied && score >= COVERAGE_THRESHOLD) {
        unsatisfiedRequiredFills++
      } else if (!isSatisfied && score > 0) {
        partialRequiredFills++
      }
    } else if (recDomains.has(domain)) {
      if (currentScore === 0) {
        recommendedFills++
      }
    }
  }

  if (unsatisfiedRequiredFills > 0) {
    const isSourceActive = sourceStates[source.id]?.status === 'current' || sourceStates[source.id]?.status === 'future'
    const isOnlyStrongProvider = countAlternativeStrongProviders(
      source, reqDomains, domainSatisfaction, allSources, sourceStates
    ) === 0

    if (isSourceActive && isOnlyStrongProvider) {
      return {
        classification: 'required',
        score: 100 + unsatisfiedRequiredFills * 25 + totalStrength * 5,
        reason: `Only active source for ${unsatisfiedRequiredFills} unsatisfied required domain(s)`,
        explanation: getLabelExplanation('required'),
      }
    }

    if (!isSourceActive && isOnlyStrongProvider) {
      const noOtherActive = !checkIfOtherActiveSourcesCouldCover(
        source, reqDomains, domainSatisfaction, allSources, sourceStates
      )
      if (noOtherActive) {
        return {
          classification: 'recommended',
          score: 85 + unsatisfiedRequiredFills * 15 + totalStrength * 5,
          reason: `Would fill ${unsatisfiedRequiredFills} unsatisfied required domain(s)`,
          explanation: 'Strongly recommended — fills a critical gap in required telemetry domains.',
        }
      }
    }

    return {
      classification: 'recommended',
      score: 70 + unsatisfiedRequiredFills * 10 + totalStrength * 5,
      reason: `Strengthens ${unsatisfiedRequiredFills} required domain(s) (partially covered by other sources)`,
      explanation: getLabelExplanation('recommended'),
    }
  }

  if (redundancy.needsReview) {
    return {
      classification: 'needs_review',
      score: 30 + totalStrength * 3,
      reason: redundancy.reason,
      explanation: getLabelExplanation('needs_review'),
    }
  }

  if (partialRequiredFills > 0 || appMatch) {
    return {
      classification: 'recommended',
      score: 50 + partialRequiredFills * 10 + recommendedFills * 5 + totalStrength * 5 + (appMatch ? 10 : 0),
      reason: partialRequiredFills > 0
        ? `Partially covers ${partialRequiredFills} required domain(s)`
        : 'Supports a desired Splunk app',
      explanation: getLabelExplanation('recommended'),
    }
  }

  if (recommendedFills > 0) {
    return {
      classification: 'recommended',
      score: 35 + recommendedFills * 8 + totalStrength * 3,
      reason: `Adds ${recommendedFills} recommended domain(s)`,
      explanation: getLabelExplanation('recommended'),
    }
  }

  const hasAnyRelevance = Object.keys(source.telemetryDomains).some(
    (d) => reqDomains.has(d) || recDomains.has(d)
  )

  if (hasAnyRelevance) {
    return {
      classification: 'optional',
      score: 10 + totalStrength * 2,
      reason: 'Provides supplementary telemetry for selected use cases',
      explanation: getLabelExplanation('optional'),
    }
  }

  if (useCases?.length > 0) {
    return {
      classification: 'unnecessary',
      score: totalStrength,
      reason: 'Not relevant to the selected use cases',
      explanation: getLabelExplanation('unnecessary'),
    }
  }

  return {
    classification: 'optional',
    score: 5 + totalStrength,
    reason: 'General telemetry source',
    explanation: getLabelExplanation('optional'),
  }
}

/**
 * Check if other active sources already cover the gaps this source would fill.
 */
function checkIfOtherActiveSourcesCouldCover(source, reqDomains, domainSatisfaction, allSources, sourceStates) {
  for (const [domain, strength] of Object.entries(source.telemetryDomains)) {
    if (!reqDomains.has(domain)) continue
    const currentScore = domainSatisfaction[domain]?.score || 0
    if (currentScore >= COVERAGE_THRESHOLD) continue

    const otherActive = allSources.some((other) => {
      if (other.id === source.id) return false
      const ss = sourceStates[other.id]
      if (!ss || (ss.status !== 'current' && ss.status !== 'future')) return false
      const otherStrength = STRENGTH_SCORE[other.telemetryDomains?.[domain]] || 0
      return otherStrength >= COVERAGE_THRESHOLD
    })

    if (!otherActive) return false
  }

  return true
}

/**
 * Count how many other active sources could also strongly satisfy the same
 * unsatisfied required domains this source fills. If 0, this source is the
 * sole viable provider (a true "Required" candidate).
 */
function countAlternativeStrongProviders(source, reqDomains, domainSatisfaction, allSources, sourceStates) {
  let alternatives = 0

  for (const [domain] of Object.entries(source.telemetryDomains)) {
    if (!reqDomains.has(domain)) continue
    const currentScore = domainSatisfaction[domain]?.score || 0
    if (currentScore >= COVERAGE_THRESHOLD) continue

    const sourceStrength = STRENGTH_SCORE[source.telemetryDomains[domain]] || 0
    if (sourceStrength < COVERAGE_THRESHOLD) continue

    for (const other of allSources) {
      if (other.id === source.id) continue
      const ss = sourceStates[other.id]
      if (ss && (ss.status === 'current' || ss.status === 'future')) continue
      const otherStrength = STRENGTH_SCORE[other.telemetryDomains?.[domain]] || 0
      if (otherStrength >= COVERAGE_THRESHOLD) {
        alternatives++
        break
      }
    }
  }

  return alternatives
}

/**
 * Classify and sort all sources using the prioritization engine.
 */
export function classifyAndSortSources(
  sources,
  useCases,
  desiredApps,
  allSources,
  sourceStates,
  overlapDecisions,
  overlapGroups,
  intake = {},
) {
  return prioritizeAndSortSources(
    sources,
    useCases,
    desiredApps,
    allSources,
    sourceStates,
    overlapDecisions,
    overlapGroups,
    intake,
  )
}

import { formatValidationNeededLabel, formatRelevanceBadgeLabel } from '../utils/displayLabels.js';

const BADGE_STYLES = {
  suggested: { bg: 'bg-amber-900/20', text: 'text-amber-400', label: formatRelevanceBadgeLabel('suggested') },
  optional: { bg: 'bg-blue-900/20', text: 'text-blue-400', label: formatRelevanceBadgeLabel('optional') },
  redundant: { bg: 'bg-orange-900/20', text: 'text-orange-400', label: formatRelevanceBadgeLabel('redundant') },
  needs_review: { bg: 'bg-purple-900/20', text: 'text-purple-400', label: formatValidationNeededLabel() },
  /** @deprecated legacy keys map to simplified labels */
  required: { bg: 'bg-amber-900/20', text: 'text-amber-400', label: formatRelevanceBadgeLabel('required') },
  recommended: { bg: 'bg-amber-900/20', text: 'text-amber-400', label: formatRelevanceBadgeLabel('recommended') },
  unnecessary: { bg: 'bg-blue-900/20', text: 'text-blue-400', label: formatRelevanceBadgeLabel('unnecessary') },
}

export function getRelevanceBadgeStyle(classification) {
  return BADGE_STYLES[classification] || BADGE_STYLES.optional
}
