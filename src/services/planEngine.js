/**
 * Plan Engine — Architecture paths (Crawl, Walk, Run)
 * Packs configured sources by analysis relevance, apps powered, and category diversity.
 */

import { calculateCoverage, validateMultiUseCase } from './coverageEngine.js'
import { mapPriorityScoreToRelevance1to10 } from './analysisSourcePriorityEngine.js'
import { prioritizeAndSortSources } from './sourcePrioritizationEngine.js'
import { OVERLAP_GROUPS } from './overlapEngine.js'
import { APPS_BY_ID } from './goalAppSourceKnowledge.js'
import rules from '../data/sourceRecommendationRules.json' with { type: 'json' }
import { calculateTotals, calculateStorage } from './sizingEngine.js'
import { scoreAllSources } from './priorityEngine.js'
import { applyOverlapExclusions } from './overlapEngine.js'
import { OVERLAP_ANNOTATE_ONLY } from '../config/featureFlags.js'
import { calculateFullSourceIngest, sourceCountsTowardTotals, getOverlapExcludedIds } from './sourceEligibilityEngine.js'
import { enrichPlanWithDynamicName } from './pathNamingEngine.js'
import { strengthToScore } from './strengthScores.js'
import {
  isSourceEligibleForPlanningTotals,
  sumPlanningIngestForSources,
  buildPathSourceIngestBreakdown,
} from './planningIngestTotals.js'
import { applyPlanningBufferToSource } from '../utils/bufferBand.js'
import {
  sourceInTheme,
  rankCandidatesForTheme,
  computeSourceOverlapRatio,
  pathThemes,
} from './pathThemeEngine.js'
import { computeRoadmapReadiness, adjustReadinessForPhase, applyRoadmapReadinessToPlans } from './pathOutcomeScoringEngine.js'
import { buildPathCardMessaging } from './pathValueMessagingEngine.js'
import { attachPathComparisons } from './pathComparisonEngine.js'
import { buildFutureMaturityOpportunities } from './pathMaturityOpportunitiesEngine.js'
import { resolveKnowledgeAppId } from '../utils/customerAppDisplay.js'
import { getConfiguredSourceIds } from './sourceEquivalencyEngine.js'

const COVERAGE_THRESHOLD = 0.75

const CRAWL_RATIO_MIN = 0.6
const CRAWL_RATIO_TARGET = 0.7
const CRAWL_RATIO_MAX = 0.8
const WALK_TOLERANCE = 0.03
/** Below this ratio of budget cap, show Phase 2 source suggestions separately. */
const HEADROOM_THRESHOLD = 0.85
/** Cloud budget at or below ~$40K — essentials only, no Phase 2 padding. */
const LOW_BUDGET_GB_DAY = 40
const RUN_SOFT_MAX_MULTIPLIER = 2
const WALK_UPLIFT_MAX = 1.35
/** Crawl may scale current inputs more aggressively to reach 60–80% of cap when configured ingest is low. */
const CRAWL_UPLIFT_MAX = 2.5

const NUMERIC_STATE_KEYS = [
  'number_of_users',
  'number_of_endpoints',
  'number_of_servers',
  'number_of_systems',
  'number_of_devices',
  'number_of_leases',
  'number_of_dcs',
  'count',
]

/**
 * @returns {import('./planEngine.js').PlanResult[]}
 */
export function generatePlans(
  sourceCatalog,
  sourceStates,
  useCases,
  customSources = [],
  overlapDecisions = {},
  bufferPercent = 0.2,
  options = {},
) {
  const budgetGbDay = options.budgetGbDay ?? null
  const intake = options.intake || {}
  const allSources = [...sourceCatalog, ...customSources]
  const excludedIds = getOverlapExcludedIds(overlapDecisions)
  const sizingCtx = { catalog: sourceCatalog, allInputs: sourceStates }

  const currentSources = allSources.filter((s) => {
    const ss = sourceStates[s.id]
    if (ss?.status !== 'current') return false
    const est = calculateFullSourceIngest(s, ss, sizingCtx)
    return sourceCountsTowardTotals(s, ss, est, excludedIds)
  })

  const currentCoverage = calculateCoverage(currentSources)
  const scored = scoreAllSources(allSources, useCases, currentCoverage, sourceStates)
  const primaryProfile = resolvePrimaryProfile(useCases, options.primaryProfileId)
  const rankedUseCases = rankUseCasesForPlanning(useCases, primaryProfile)
  const pool = createPlanPool(allSources, scored, useCases, sourceStates, overlapDecisions, bufferPercent, sourceCatalog)

  if (budgetGbDay && budgetGbDay > 0) {
    const plans = buildBudgetPaths(pool, budgetGbDay, primaryProfile, rankedUseCases, intake)
    const enriched = plans.map((p) => enrichPlanWithDynamicName(applyPlanLabels(p, p.pathPhase, p.pathVariant), useCases, intake))
    return attachPathComparisons(applyRoadmapReadinessToPlans(enriched, useCases), useCases)
  }

  const plans = buildNoBudgetPaths(pool, primaryProfile, rankedUseCases, currentSources, intake)
  const enriched = plans.map((p) => enrichPlanWithDynamicName(applyPlanLabels(p, p.pathPhase, p.pathVariant), useCases, intake))
  return attachPathComparisons(applyRoadmapReadinessToPlans(enriched, useCases), useCases)
}

function resolvePrimaryProfile(useCases, primaryProfileId) {
  if (!useCases?.length) return null
  if (primaryProfileId) {
    const hit = useCases.find((p) => p.id === primaryProfileId)
    if (hit) return hit
  }
  return useCases[0]
}

/** Largest use cases first (by domain footprint), primary pinned first. */
function rankUseCasesForPlanning(useCases, primaryProfile) {
  if (!useCases?.length) return []
  const rest = useCases.filter((u) => u.id !== primaryProfile?.id)
  rest.sort((a, b) => useCaseFootprint(b) - useCaseFootprint(a))
  return primaryProfile ? [primaryProfile, ...rest] : rest
}

function useCaseFootprint(uc) {
  return (uc.requiredDomains?.length || 0) * 2 + (uc.recommendedDomains?.length || 0)
}

function createPlanPool(allSources, scored, useCases, sourceStates, overlapDecisions, bufferPercent, catalogTree) {
  const excludedIds = getOverlapExcludedIds(overlapDecisions)
  const sizingCtx = { catalog: catalogTree, allInputs: sourceStates }
  const byId = new Map(allSources.map((s) => [s.id, s]))

  const candidates = []
  for (const row of scored) {
    const source = byId.get(row.id)
    if (!source) continue
    const ss = sourceStates[source.id] || {}
    if (ss.status !== 'current' && ss.status !== 'future') continue
    const est = calculateFullSourceIngest(source, ss, sizingCtx)
    if (!sourceCountsTowardTotals(source, ss, est, excludedIds)) continue
    const gb = planSourceGb(source, sourceStates, overlapDecisions, bufferPercent, catalogTree)
    if (gb <= 0) continue
    candidates.push({
      id: source.id,
      source,
      gb,
      priorityScore: row.priorityScore,
      valuePerGb: row.estimatedGB > 0 ? row.priorityScore / row.estimatedGB : row.priorityScore,
      status: ss.status,
      reasons: row.reasons,
    })
  }

  return {
    allSources,
    candidates,
    candidatesById: new Map(candidates.map((c) => [c.id, c])),
    scored,
    useCases,
    sourceStates,
    userSourceStates: { ...sourceStates },
    overlapDecisions,
    bufferPercent,
    catalogTree,
    excludedIds,
  }
}

function planSourceGb(source, sourceStates, overlapDecisions, bufferPercent, catalogTree) {
  const { totals } = sizeSources([source], sourceStates, overlapDecisions, bufferPercent, catalogTree)
  return totals.buffered.expected
}

function getRequiredDomains(useCases) {
  const domains = new Set()
  for (const uc of useCases || []) {
    ;(uc.requiredDomains || []).forEach((d) => domains.add(d))
  }
  return [...domains]
}

function uncoveredRequiredDomains(sources, useCases) {
  if (!useCases?.length) return []
  const coverage = calculateCoverage(sources)
  return getRequiredDomains(useCases).filter((d) => (coverage[d]?.score || 0) < COVERAGE_THRESHOLD)
}

function domainStrengthOnSource(source, domain) {
  return strengthToScore(source.telemetryDomains?.[domain])
}

function addSourcesWithDependencies(selected, entries, pool) {
  const ids = new Set(selected.map((s) => s.id))
  for (const entry of entries) {
    const chain = [entry]
    for (const depId of entry.source.dependencies || []) {
      if (!ids.has(depId)) {
        const dep = pool.candidatesById.get(depId)
        if (dep) chain.unshift(dep)
      }
    }
    for (const item of chain) {
      if (!ids.has(item.source.id)) {
        selected.push(item.source)
        ids.add(item.source.id)
      }
    }
  }
  return selected
}

function totalPlanGb(sources, pool) {
  const { totals } = sizeSources(sources, pool.sourceStates, pool.overlapDecisions, pool.bufferPercent, pool.catalogTree)
  return totals.buffered.expected
}

/** Buffered GB added when including candidate (joint overlap-aware), not solo source sizing. */
function marginalGbIfAdded(selected, candidate, pool) {
  const before = totalPlanGb(selected, pool)
  const after = totalPlanGb(addSourcesWithDependencies([...selected], [candidate], pool), pool)
  return Math.max(0, after - before)
}

function wouldExceedBufferedCap(selected, candidate, pool, maxGb) {
  const after = totalPlanGb(addSourcesWithDependencies([...selected], [candidate], pool), pool)
  return after > maxGb + 0.001
}

function sourceSetKey(sources) {
  return [...sources]
    .map((s) => s.id)
    .sort()
    .join('|')
}

/**
 * Default sizing for recommended (not yet configured) sources.
 * Sized to fit marginal budget gaps — not full enterprise counts.
 */
function defaultPlanningSourceState(source, budgetCap = 100, gapGbHint = null) {
  const key = source.sizing_formula?.primary_input || 'count'
  const rate = source.sizing_formula?.rate_per_unit ?? 0.01
  const targetRawGb =
    gapGbHint != null
      ? Math.max(2, Math.min(14, gapGbHint))
      : Math.max(4, Math.min(12, budgetCap * 0.05))
  const units = rate > 0 ? Math.round(targetRawGb / rate) : Math.round(budgetCap * 4)
  const clamped = Math.max(8, Math.min(1200, units))
  return { status: 'future', [key]: clamped, isPlanningRecommendation: true }
}

/**
 * Add high-value catalog sources (future) so walk/run can approach full buffered budgetGbDay.
 * budgetGbDay already includes buffer — all cap checks use buffered totals.
 */
/** Packed buffered GB for configured current sources (base pool, pre-augment). */
function configuredBufferedCeiling(pool, budgetCap = null) {
  const current = pool.candidates.filter((c) => c.status === 'current')
  if (!current.length) return 0

  let selected = []
  let gb = 0
  const ranked = [...current].sort((a, b) => b.priorityScore - a.priorityScore || b.gb - a.gb)
  const maxPackGb = budgetCap ? budgetCap * 1.08 : Number.POSITIVE_INFINITY

  for (const c of ranked) {
    if (!candidateAddsIngest(selected, c, pool, maxPackGb)) continue
    selected = addSourcesWithDependencies(selected, [c], pool)
    gb = totalPlanGb(selected, pool)
    if (budgetCap && gb >= budgetCap * 0.98) break
  }

  return gb
}

function hasBudgetHeadroom(configuredCeiling, budgetCap) {
  return budgetCap > 0 && configuredCeiling < budgetCap * HEADROOM_THRESHOLD
}

function allowPhase2Suggestions(budgetCap, configuredCeiling) {
  if (!budgetCap || budgetCap <= LOW_BUDGET_GB_DAY) return false
  if (configuredCeiling >= budgetCap) return false
  return hasBudgetHeadroom(configuredCeiling, budgetCap)
}

function sumPhase2Totals(suggestions) {
  if (!suggestions?.length) {
    return { low: 0, expected: 0, high: 0, buffered: { low: 0, expected: 0, high: 0 } }
  }
  const expected = suggestions.reduce((s, r) => s + (r.gbDay || 0), 0)
  const low = suggestions.reduce((s, r) => s + (r.gbLow ?? (r.gbDay || 0) * 0.8), 0)
  const high = suggestions.reduce((s, r) => s + (r.gbHigh ?? (r.gbDay || 0) * 1.2), 0)
  return { low, expected, high, buffered: { low, expected, high } }
}

function buildPhase2Suggestions(pool, phase1Ids, budgetCap, configuredCeiling, rankedUseCases) {
  if (!allowPhase2Suggestions(budgetCap, configuredCeiling)) return []

  const augmented = augmentPoolForWalkRun(pool, rankedUseCases, budgetCap, configuredCeiling)
  const phase1Set = new Set(phase1Ids)
  const gapGb = Math.max(0, budgetCap - configuredCeiling)

  const extras = [...augmented.candidatesById.values()]
    .filter((c) => c.isPlanningRecommendation && !phase1Set.has(c.id))
    .sort((a, b) => b.valuePerGb - a.valuePerGb || b.priorityScore - a.priorityScore)

  const suggestions = []
  let cumulative = 0
  for (const c of extras) {
    if (cumulative >= gapGb * 0.98) break
    if (c.gb <= 0) continue
    suggestions.push({
      id: c.id,
      name: c.source.name,
      category: c.source.category || 'Uncategorized',
      gbDay: c.gb,
      gbLow: c.gb * 0.8,
      gbHigh: c.gb * 1.2,
      status: 'future',
      isPlanningRecommendation: true,
      reason: 'Suggested follow-on sources to broaden coverage — configure in Data Sources before planning.',
    })
    cumulative += c.gb
  }
  return suggestions
}

function augmentPoolForWalkRun(pool, rankedUseCases, budgetCap, packedCeiling) {
  if (!budgetCap || budgetCap <= 0) return pool
  if (budgetCap <= LOW_BUDGET_GB_DAY) return pool

  const configuredCeiling = packedCeiling ?? configuredBufferedCeiling(pool, budgetCap)
  if (configuredCeiling >= budgetCap * (1 - WALK_TOLERANCE)) return pool

  const planningStates = { ...pool.sourceStates }
  const extra = []
  const focusDomains = new Set()
  for (const uc of rankedUseCases) {
    ;(uc.requiredDomains || []).forEach((d) => focusDomains.add(d))
    ;(uc.recommendedDomains || []).forEach((d) => focusDomains.add(d))
  }

  const gapGb = Math.max(0, budgetCap - configuredCeiling)
  const perSourceHint = Math.max(3, Math.min(12, gapGb / 6))

  for (const row of pool.scored) {
    if (pool.candidatesById.has(row.id)) continue
    const source = pool.allSources.find((s) => s.id === row.id)
    if (!source) continue
    const matchesFocus = [...focusDomains].some((d) => domainStrengthOnSource(source, d) >= 0.5)
    if (!matchesFocus && row.priorityScore < 35) continue

    if (!planningStates[source.id]) {
      planningStates[source.id] = defaultPlanningSourceState(source, budgetCap, perSourceHint)
    }
    const ss = planningStates[source.id]
    if (ss.status !== 'future' && ss.status !== 'current') {
      planningStates[source.id] = { ...defaultPlanningSourceState(source, budgetCap, perSourceHint), status: 'future' }
    }

    const est = calculateFullSourceIngest(source, planningStates[source.id], {
      catalog: pool.catalogTree,
      allInputs: planningStates,
    })
    if (!sourceCountsTowardTotals(source, planningStates[source.id], est, pool.excludedIds)) continue

    const gb = planSourceGbWithStates(source, planningStates, pool.overlapDecisions, pool.bufferPercent, pool.catalogTree)
    if (gb <= 0) continue

    extra.push({
      id: source.id,
      source,
      gb,
      priorityScore: row.priorityScore,
      valuePerGb: row.estimatedGB > 0 ? row.priorityScore / row.estimatedGB : row.priorityScore,
      status: 'future',
      reasons: row.reasons,
      isPlanningRecommendation: true,
    })
  }

  if (!extra.length) return pool

  extra.sort((a, b) => b.valuePerGb - a.valuePerGb || b.priorityScore - a.priorityScore)
  const candidates = [...pool.candidates, ...extra.slice(0, 45)]
  return {
    ...pool,
    candidates,
    candidatesById: new Map(candidates.map((c) => [c.id, c])),
    sourceStates: planningStates,
    userSourceStates: pool.userSourceStates,
  }
}

function planSourceGbWithStates(source, sourceStates, overlapDecisions, bufferPercent, catalogTree) {
  const { totals } = sizeSources([source], sourceStates, overlapDecisions, bufferPercent, catalogTree)
  return totals.buffered.expected
}

function scaleNumericState(st, factor) {
  const out = { ...st }
  for (const k of NUMERIC_STATE_KEYS) {
    if (typeof out[k] === 'number') out[k] = Math.max(1, Math.round(out[k] * factor))
  }
  return out
}

/**
 * Uplift disabled for display totals — user session counts only (packing may still use augment).
 */
function upliftPoolForWalkBudget(pool, budgetCap, packedCeiling, maxFactor = WALK_UPLIFT_MAX) {
  return pool
}

function candidateAddsIngest(selected, candidate, pool, maxGb) {
  if (wouldExceedBufferedCap(selected, candidate, pool, maxGb)) return false
  const before = totalPlanGb(selected, pool)
  const after = totalPlanGb(addSourcesWithDependencies([...selected], [candidate], pool), pool)
  return after > before + 0.001
}

function primarySatisfied(sources, primary) {
  if (!primary) return true
  return uncoveredRequiredDomains(sources, [primary]).length === 0
}

function planningSecondaryUseCase(rankedUseCases, primary) {
  if (!rankedUseCases?.length) return null
  const observabilityIds = new Set([
    'observability_apm',
    'application_monitoring',
    'infrastructure_monitoring',
    'it_operations',
    'digital_experience',
    'kubernetes_container',
    'network_operations',
  ])
  const securityPrimary =
    primary?.id === 'foundational_security' ||
    primary?.id === 'enterprise_security' ||
    primary?.id === 'threat_detection'
  if (!securityPrimary) return rankedUseCases[1] ?? null
  return (
    rankedUseCases.find((u) => u.id !== primary?.id && !observabilityIds.has(u.id)) ||
    rankedUseCases[1] ||
    null
  )
}

function buildCrawlThemePath(pool, primary, rankedUseCases, crawlMin, crawlTarget, crawlMax) {
  const crawlMust = primary ? [primary] : []
  let selected = seedMustHaveSources(pool, crawlMust, { preferCurrent: true, allowFuture: false })

  const crawlRanked = rankCandidatesForTheme(pool, 'crawl_foundational', selected, { preferCurrent: true })
    .filter((c) => c.status === 'current')

  for (const c of crawlRanked) {
    if (totalPlanGb(selected, pool) >= crawlTarget) break
    if (wouldExceedBufferedCap(selected, c, pool, crawlMax)) continue
    selected = addSourcesWithDependencies(selected, [c], pool)
  }

  let guard = 0
  while (totalPlanGb(selected, pool) < crawlMin && guard++ < 40) {
    const next = crawlRanked.find((c) => !selected.some((s) => s.id === c.id) && !wouldExceedBufferedCap(selected, c, pool, crawlMax))
    if (!next) break
    selected = addSourcesWithDependencies(selected, [next], pool)
  }

  if (totalPlanGb(selected, pool) > crawlMax) {
    selected = trimPlanToBudgetGb(selected, pool, crawlMax, protectPrimaryIds(pool, crawlMust), {
      relaxCoverage: true,
      useCases: crawlMust,
    })
  }

  return selected
}

function buildThemeExpansionPath(pool, seedSources, themeKey, opts = {}) {
  const { targetGb, maxGb, excludeIds = new Set(), preferCurrent = false } = opts
  let selected = [...seedSources]
  const cap = maxGb ?? (targetGb ? targetGb * (1 + WALK_TOLERANCE) : Number.POSITIVE_INFINITY)

  const ranked = rankCandidatesForTheme(pool, themeKey, selected, { preferCurrent })

  for (const c of ranked) {
    if (excludeIds.has(c.id)) continue
    if (targetGb && totalPlanGb(selected, pool) >= targetGb * (1 - WALK_TOLERANCE)) break
    if (!candidateAddsIngest(selected, c, pool, cap)) continue
    selected = addSourcesWithDependencies(selected, [c], pool)
  }

  if (targetGb) {
    let fillGuard = 0
    while (totalPlanGb(selected, pool) < targetGb * (1 - WALK_TOLERANCE) && fillGuard++ < 80) {
      const next = ranked
        .filter((c) => !selected.some((s) => s.id === c.id) && !excludeIds.has(c.id))
        .find((c) => candidateAddsIngest(selected, c, pool, cap))
      if (!next) break
      selected = addSourcesWithDependencies(selected, [next], pool)
    }
  }

  if (totalPlanGb(selected, pool) > cap + 0.001) {
    selected = forceUnderBufferedCap(selected, pool, cap, protectPrimaryIds(pool, opts.mustSatisfy || []))
  }

  return selected
}

function diversifyWalkBFromWalkA(walkBSources, walkASources, crawlIds, pool, targetGb, maxGb) {
  const overlap = computeSourceOverlapRatio(walkBSources, walkASources, crawlIds)
  if (overlap <= 0.7) return { sources: walkBSources, overlap, note: null }

  const crawlSet = new Set(crawlIds)
  let list = [...walkBSources]
  const walkAExtraIds = new Set(walkASources.map((s) => s.id).filter((id) => !crawlSet.has(id)))
  const cap = maxGb ?? targetGb * (1 + WALK_TOLERANCE)

  const droppable = list
    .filter((s) => walkAExtraIds.has(s.id) && sourceInTheme(s.id, 'security_core') && !sourceInTheme(s.id, 'cloud_data_risk'))
    .map((s) => pool.candidatesById.get(s.id))
    .filter(Boolean)
    .sort((a, b) => a.priorityScore - b.priorityScore)

  const cloudCandidates = rankCandidatesForTheme(pool, 'cloud_data_risk', list, { preferCurrent: false })

  for (const drop of droppable) {
    const add = cloudCandidates.find((c) => !list.some((s) => s.id === c.id))
    if (!add) continue
    const trial = list.filter((s) => s.id !== drop.id)
    const added = addSourcesWithDependencies(trial, [add], pool)
    if (totalPlanGb(added, pool) <= cap + 0.01) {
      list = added
      const newOverlap = computeSourceOverlapRatio(list, walkASources, crawlIds)
      if (newOverlap <= 0.7) break
    }
  }

  const finalOverlap = computeSourceOverlapRatio(list, walkASources, crawlIds)
  const note =
    finalOverlap > 0.7
      ? 'Walk B closely matches Walk A because there are not enough configured cloud/data sources to create a separate alternate path.'
      : null

  return { sources: list, overlap: finalOverlap, note }
}

function buildRunThemePath(pool, opts = {}) {
  const { softMaxGb, mustSatisfy = [] } = opts
  let selected = seedMustHaveSources(pool, mustSatisfy, { preferCurrent: true, allowFuture: true })

  const ranked = [...pool.candidates]
    .filter((c) => !selected.some((s) => s.id === c.id))
    .sort((a, b) => b.priorityScore - a.priorityScore || b.valuePerGb - a.valuePerGb)

  for (const c of ranked) {
    if (softMaxGb && wouldExceedBufferedCap(selected, c, pool, softMaxGb)) continue
    selected = addSourcesWithDependencies(selected, [c], pool)
  }

  if (softMaxGb && totalPlanGb(selected, pool) > softMaxGb) {
    selected = trimPlanToBudgetGb(selected, pool, softMaxGb, new Set(), {
      relaxCoverage: true,
      useCases: pool.useCases,
    })
  }

  return selected
}

/** @param {number} budgetGbDay @param {object} [intake] */
export function resolvePathBudgetTargets(budgetGbDay, intake = {}) {
  const pct = intake.pathBudgetPercentages || { crawl: 80, walk: 100, run: 110 }
  return {
    crawl: budgetGbDay * (pct.crawl / 100),
    walk: budgetGbDay * (pct.walk / 100),
    run: budgetGbDay * (pct.run / 100),
  }
}

function configuredCandidatesOnly(pool) {
  return pool.candidates.filter((c) => c.status === 'current')
}

function buildScoringContext(pool, intake = {}) {
  const combinedApps = [...new Set([...(intake.desiredApps || []), ...(intake.recommendedApps || [])])]
  const sorted = prioritizeAndSortSources(
    pool.allSources,
    pool.useCases,
    combinedApps,
    pool.catalogTree,
    pool.userSourceStates,
    pool.overlapDecisions,
    OVERLAP_GROUPS,
    intake,
  )
  const relevanceById = new Map()
  for (const s of sorted) {
    relevanceById.set(s.id, mapPriorityScoreToRelevance1to10(s.relevance?.priorityScore ?? 0))
  }
  return { relevanceById, combinedApps }
}

function countAppsPoweringSource(sourceId, appIds) {
  let n = 0
  for (const appId of appIds) {
    const knowledge = APPS_BY_ID.get(appId)
    const required = knowledge?.requiredSourceIds || []
    const recommended = knowledge?.recommendedSourceIds || []
    const boosted = rules.appCapabilityMappings?.[appId]?.boostSourceIds || []
    if (required.includes(sourceId) || recommended.includes(sourceId) || boosted.includes(sourceId)) n += 1
  }
  return n
}

function scoreConfiguredCandidate(c, pool, selected, ctx, strategy = 'balanced') {
  const rel = ctx.relevanceById.get(c.id) ?? mapPriorityScoreToRelevance1to10(c.priorityScore)
  let score = rel * 4 + c.priorityScore * 2 + (c.valuePerGb || 0) * 6
  score += countAppsPoweringSource(c.id, ctx.combinedApps) * 5
  const cats = new Set(selected.map((s) => s.category || pool.candidatesById.get(s.id)?.source?.category || ''))
  const cat = c.source?.category || ''
  if (cat && !cats.has(cat)) score += 14
  if (strategy === 'foundational' && sourceInTheme(c.id, 'crawl_foundational')) score += 18
  if (strategy === 'balanced') {
    if (sourceInTheme(c.id, 'security_core')) score += 8
    if (sourceInTheme(c.id, 'cloud_data_risk')) score += 6
  }
  if (strategy === 'max') score += Math.min(c.gb, 50) * 0.15
  return score
}

function rankConfiguredCandidates(pool, selected, ctx, strategy) {
  return configuredCandidatesOnly(pool)
    .filter((c) => !selected.some((s) => s.id === c.id))
    .map((c) => ({ ...c, rankScore: scoreConfiguredCandidate(c, pool, selected, ctx, strategy) }))
    .sort((a, b) => b.rankScore - a.rankScore || b.priorityScore - a.priorityScore)
}

function packConfiguredToTarget(pool, targetGb, opts = {}) {
  const { seedSources = [], maxGb, mustSatisfy = [], intake = {}, strategy = 'balanced' } = opts
  let selected = [...seedSources]
  const cap = maxGb ?? (targetGb ? targetGb * (1 + WALK_TOLERANCE) : Number.POSITIVE_INFINITY)
  const ctx = buildScoringContext(pool, intake)
  const ranked = rankConfiguredCandidates(pool, selected, ctx, strategy)

  if (targetGb) {
    for (const c of ranked) {
      if (totalPlanGb(selected, pool) >= targetGb * (1 - WALK_TOLERANCE)) break
      if (!candidateAddsIngest(selected, c, pool, cap)) continue
      selected = addSourcesWithDependencies(selected, [c], pool)
    }
    let fillGuard = 0
    while (totalPlanGb(selected, pool) < targetGb * (1 - WALK_TOLERANCE) && fillGuard++ < 80) {
      const next = rankConfiguredCandidates(pool, selected, ctx, strategy).find((c) =>
        candidateAddsIngest(selected, c, pool, cap),
      )
      if (!next) break
      selected = addSourcesWithDependencies(selected, [next], pool)
    }
  } else {
    for (const c of ranked) {
      if (!candidateAddsIngest(selected, c, pool, cap)) continue
      selected = addSourcesWithDependencies(selected, [c], pool)
    }
  }

  if (Number.isFinite(cap) && totalPlanGb(selected, pool) > cap + 0.001) {
    selected = trimPlanToBudgetGb(selected, pool, cap, protectPrimaryIds(pool, mustSatisfy), {
      relaxCoverage: true,
      useCases: mustSatisfy,
    })
  }
  return selected
}

function packCrawlFoundational(pool, targetGb, opts = {}) {
  const { mustSatisfy = [], intake = {} } = opts
  const crawlMin = targetGb ? targetGb * 0.85 : 0
  const crawlTarget = targetGb || 0
  const crawlMax = targetGb ? targetGb * (1 + WALK_TOLERANCE) : Number.POSITIVE_INFINITY
  let selected = seedMustHaveSources(pool, mustSatisfy, { preferCurrent: true, allowFuture: false })
  const ctx = buildScoringContext(pool, intake)
  const crawlRanked = rankConfiguredCandidates(pool, selected, ctx, 'foundational').filter((c) =>
    sourceInTheme(c.id, 'crawl_foundational'),
  )

  for (const c of crawlRanked) {
    if (targetGb && totalPlanGb(selected, pool) >= crawlTarget) break
    if (targetGb && wouldExceedBufferedCap(selected, c, pool, crawlMax)) continue
    selected = addSourcesWithDependencies(selected, [c], pool)
  }

  if (targetGb) {
    let guard = 0
    while (totalPlanGb(selected, pool) < crawlMin && guard++ < 40) {
      const next = crawlRanked.find(
        (c) => !selected.some((s) => s.id === c.id) && !wouldExceedBufferedCap(selected, c, pool, crawlMax),
      )
      if (!next) break
      selected = addSourcesWithDependencies(selected, [next], pool)
    }
    if (totalPlanGb(selected, pool) > crawlMax) {
      selected = trimPlanToBudgetGb(selected, pool, crawlMax, protectPrimaryIds(pool, mustSatisfy), {
        relaxCoverage: true,
        useCases: mustSatisfy,
      })
    }
  } else if (selected.length === seedMustHaveSources(pool, mustSatisfy, { preferCurrent: true, allowFuture: false }).length) {
    const minimal = crawlRanked.slice(0, Math.min(4, crawlRanked.length))
    for (const c of minimal) {
      if (!selected.some((s) => s.id === c.id)) {
        selected = addSourcesWithDependencies(selected, [c], pool)
      }
    }
  }

  return selected
}

function packAllConfigured(pool, mustSatisfy = [], intake = {}) {
  let selected = seedMustHaveSources(pool, mustSatisfy, { preferCurrent: true, allowFuture: false })
  const ctx = buildScoringContext(pool, intake)
  const ranked = rankConfiguredCandidates(pool, selected, ctx, 'max')
  for (const c of ranked) {
    selected = addSourcesWithDependencies(selected, [c], pool)
  }
  return selected
}

function buildBudgetPaths(pool, budgetCap, primary, rankedUseCases, intake = {}) {
  const targets = resolvePathBudgetTargets(budgetCap, intake)
  const walkMust = primary ? [primary] : []
  const packedCeiling = configuredBufferedCeiling(pool, budgetCap)
  const headroom = hasBudgetHeadroom(packedCeiling, budgetCap)
  const finalizeMeta = {
    budgetCap,
    configuredCeiling: packedCeiling,
    rankedUseCases,
    intake,
  }

  let crawlSources = packCrawlFoundational(pool, targets.crawl, { mustSatisfy: walkMust, intake })
  let walkSources = packConfiguredToTarget(pool, targets.walk, {
    seedSources: crawlSources,
    maxGb: targets.walk * (1 + WALK_TOLERANCE),
    mustSatisfy: walkMust,
    intake,
    strategy: 'balanced',
  })
  let runSources = packConfiguredToTarget(pool, targets.run, {
    seedSources: walkSources,
    maxGb: targets.run * (1 + WALK_TOLERANCE),
    mustSatisfy: walkMust,
    intake,
    strategy: 'max',
  })
  runSources = packAllConfiguredUnderCap(pool, runSources, targets.run * (1 + WALK_TOLERANCE), walkMust, intake)

  const out = [
    finalizePlan(crawlSources, pool, 'crawl', null, finalizeMeta),
    finalizePlan(walkSources, pool, 'walk', null, finalizeMeta),
    finalizePlan(runSources, pool, 'run', null, finalizeMeta),
  ]
  out.forEach((p) => {
    p.budgetGbDay = budgetCap
    p.budgetTargetGbDay = targets[p.pathPhase]
    p.hasBudgetHeadroom = headroom
  })
  return out
}

function packAllConfiguredUnderCap(pool, seed, maxGb, mustSatisfy, intake) {
  let selected = [...seed]
  const ctx = buildScoringContext(pool, intake)
  const ranked = rankConfiguredCandidates(pool, selected, ctx, 'max')
  for (const c of ranked) {
    if (!candidateAddsIngest(selected, c, pool, maxGb)) continue
    selected = addSourcesWithDependencies(selected, [c], pool)
  }
  if (Number.isFinite(maxGb) && totalPlanGb(selected, pool) > maxGb + 0.001) {
    selected = trimPlanToBudgetGb(selected, pool, maxGb, protectPrimaryIds(pool, mustSatisfy), {
      relaxCoverage: true,
      useCases: mustSatisfy,
    })
  }
  return selected
}

function buildNoBudgetPaths(pool, primary, rankedUseCases, currentSources, intake = {}) {
  const walkMust = primary ? [primary] : []
  const finalizeMeta = { rankedUseCases, intake }

  const crawlSources = packCrawlFoundational(pool, null, { mustSatisfy: walkMust, intake })
  const crawlGb = totalPlanGb(crawlSources, pool)
  const walkTarget = Math.max(crawlGb * 1.35, crawlGb + 5)

  const walkSources = packConfiguredToTarget(pool, walkTarget, {
    seedSources: crawlSources,
    mustSatisfy: walkMust,
    intake,
    strategy: 'balanced',
  })
  const runSources = packAllConfigured(pool, walkMust, intake)

  return [
    finalizePlan(crawlSources, pool, 'crawl', null, finalizeMeta),
    finalizePlan(walkSources, pool, 'walk', null, finalizeMeta),
    finalizePlan(runSources, pool, 'run', null, finalizeMeta),
  ]
}

/**
 * Pack sources until buffered GB is within [minGb, maxGb], satisfying mustSatisfy use cases.
 */
function buildPackToBufferedTarget(pool, opts) {
  const { focusUseCases, mustSatisfy, minGb, targetGb, maxGb, preferCurrent, allowFuture = false } = opts
  let selected = seedMustHaveSources(pool, mustSatisfy, { preferCurrent, allowFuture })
  let gb = totalPlanGb(selected, pool)

  if (gb > maxGb) {
    selected = forceUnderBufferedCap(selected, pool, maxGb, protectPrimaryIds(pool, mustSatisfy))
    gb = totalPlanGb(selected, pool)
  }

  const rankWithMarginal = (list, sortPreferCurrentFirst = false) =>
    rankCandidatesForPack(pool, list, focusUseCases, mustSatisfy, {
      variant: 'crawl',
      preferCurrent: sortPreferCurrentFirst ? true : preferCurrent,
      allowFuture,
    })
      .map((c) => ({ ...c, marginal: marginalGbIfAdded(list, c, pool) }))
      .filter((c) => c.marginal > 0)

  if (allowFuture) {
    const currentOnly = rankWithMarginal(selected, true)
      .filter((c) => c.status === 'current')
      .sort((a, b) => a.marginal - b.marginal || b.rank - a.rank)
    const interimTarget = Math.min(targetGb * 0.42, minGb * 0.48)

    for (const c of currentOnly) {
      if (gb >= interimTarget) break
      if (wouldExceedBufferedCap(selected, c, pool, maxGb)) continue
      selected = addSourcesWithDependencies(selected, [c], pool)
      gb = totalPlanGb(selected, pool)
    }

    const fillRanked = rankWithMarginal(selected)
      .sort((a, b) => b.marginal - a.marginal || b.rank - a.rank)
    for (const c of fillRanked) {
      if (gb >= targetGb) break
      if (wouldExceedBufferedCap(selected, c, pool, maxGb)) continue
      selected = addSourcesWithDependencies(selected, [c], pool)
      gb = totalPlanGb(selected, pool)
    }
  } else {
    const ranked = rankWithMarginal(selected)
      .sort((a, b) => a.marginal - b.marginal || b.rank - a.rank)
    for (const c of ranked) {
      if (gb >= targetGb) break
      if (wouldExceedBufferedCap(selected, c, pool, maxGb)) continue
      selected = addSourcesWithDependencies(selected, [c], pool)
      gb = totalPlanGb(selected, pool)
    }
  }

  let guard = 0
  while (gb < minGb && guard++ < 60) {
    const next = rankCandidatesForPack(pool, selected, focusUseCases, mustSatisfy, {
      variant: 'crawl',
      preferCurrent,
      allowFuture,
    })
      .map((c) => ({ ...c, marginal: marginalGbIfAdded(selected, c, pool) }))
      .filter((c) => c.marginal > 0 && !wouldExceedBufferedCap(selected, c, pool, maxGb))
      .sort((a, b) => a.marginal - b.marginal)[0]
    if (!next) break
    selected = addSourcesWithDependencies(selected, [next], pool)
    gb = totalPlanGb(selected, pool)
    if (gb >= targetGb) break
  }

  if (gb > maxGb) {
    selected = forceUnderBufferedCap(selected, pool, maxGb, protectPrimaryIds(pool, mustSatisfy))
    gb = totalPlanGb(selected, pool)
  }

  if (gb > targetGb * 1.06) {
    selected = trimPlanToBudgetGb(selected, pool, Math.min(maxGb, targetGb * 1.05), protectPrimaryIds(pool, mustSatisfy), {
      relaxCoverage: true,
      useCases: mustSatisfy,
    })
  }

  return selected
}

/** Drop highest-impact sources until buffered total is at or below maxGb. */
function forceUnderBufferedCap(selected, pool, maxGb, protectIds) {
  let list = [...selected]
  let guard = 0
  while (totalPlanGb(list, pool) > maxGb + 0.001 && list.length > 0 && guard++ < 100) {
    let dropId = null
    let bestReduction = 0
    const current = totalPlanGb(list, pool)
    for (const s of list) {
      if (protectIds.has(s.id)) continue
      const trial = list.filter((x) => x.id !== s.id)
      const reduction = current - totalPlanGb(trial, pool)
      if (reduction > bestReduction) {
        bestReduction = reduction
        dropId = s.id
      }
    }
    if (!dropId || bestReduction <= 0) break
    list = list.filter((s) => s.id !== dropId)
  }
  return list
}

function protectPrimaryIds(pool, mustSatisfy) {
  const ids = new Set()
  for (const uc of mustSatisfy) {
    for (const id of uc.minimumSources || []) ids.add(id)
  }
  return ids
}

function enforceWalkBufferedCap(sources, pool, walkCap, mustSatisfy) {
  const maxGb = walkCap * (1 + WALK_TOLERANCE)
  const protectIds = protectPrimaryIds(pool, mustSatisfy)
  let list = [...sources]
  if (totalPlanGb(list, pool) > maxGb + 0.001) {
    list = forceUnderBufferedCap(list, pool, maxGb, protectIds)
  }
  return list
}

function buildWalkPack(pool, opts) {
  const { targetGb, focusUseCases, mustSatisfy, variant, secondaryHighlight } = opts
  const maxGb = opts.maxGb ?? targetGb * (1 + WALK_TOLERANCE)
  const minGb = opts.minGb ?? targetGb * (1 - WALK_TOLERANCE)
  const protectIds = protectPrimaryIds(pool, mustSatisfy)

  let selected = seedMustHaveSources(pool, mustSatisfy, { preferCurrent: true, allowFuture: true })
  let gb = totalPlanGb(selected, pool)

  const ranked = rankCandidatesForPack(pool, selected, focusUseCases, mustSatisfy, {
    variant,
    preferCurrent: false,
    secondaryHighlight,
  })

  for (const c of ranked) {
    if (gb >= targetGb * (1 - WALK_TOLERANCE)) break
    if (!candidateAddsIngest(selected, c, pool, maxGb)) continue
    selected = addSourcesWithDependencies(selected, [c], pool)
    gb = totalPlanGb(selected, pool)
  }

  if (gb > maxGb) {
    selected = trimPlanToBudgetGb(selected, pool, maxGb, protectIds, {
      relaxCoverage: true,
      useCases: focusUseCases,
    })
    gb = totalPlanGb(selected, pool)
  }

  const rankedFill = () =>
    rankCandidatesForPack(pool, selected, focusUseCases, mustSatisfy, {
      variant,
      preferCurrent: false,
      secondaryHighlight,
    })

  let guard = 0
  while (gb < targetGb * (1 - WALK_TOLERANCE) && guard++ < 120) {
    const next = rankedFill()
      .filter((c) => candidateAddsIngest(selected, c, pool, maxGb))
      .map((c) => ({ ...c, marginal: marginalGbIfAdded(selected, c, pool) }))
      .sort((a, b) => b.marginal - a.marginal || b.rank - a.rank)[0]
    if (!next) break
    selected = addSourcesWithDependencies(selected, [next], pool)
    gb = totalPlanGb(selected, pool)
  }

  if (gb < minGb) {
    for (const c of rankedFill()) {
      if (gb >= minGb) break
      if (!candidateAddsIngest(selected, c, pool, maxGb)) continue
      selected = addSourcesWithDependencies(selected, [c], pool)
      gb = totalPlanGb(selected, pool)
    }
  }

  if (mustSatisfy.length && !primarySatisfied(selected, mustSatisfy[0])) {
    for (const c of ranked) {
      const trial = addSourcesWithDependencies([...selected], [c], pool)
      if (primarySatisfied(trial, mustSatisfy[0]) && totalPlanGb(trial, pool) <= maxGb * 1.01) {
        selected = trial
        break
      }
    }
  }

  gb = totalPlanGb(selected, pool)
  if (gb > maxGb) {
    selected = forceUnderBufferedCap(selected, pool, maxGb, protectIds)
  }

  return selected
}

/** Swap sources so Walk B (and crawl) are not identical to other paths when possible. */
function diversifyPackFrom(pool, selected, otherPacks, opts) {
  const others = otherPacks.map((p) => sourceSetKey(p))
  if (!others.includes(sourceSetKey(selected))) return selected

  const { targetGb, focusUseCases, mustSatisfy, variant, secondaryHighlight } = opts
  const maxGb = targetGb * (1 + WALK_TOLERANCE)
  const minGb = targetGb * (1 - WALK_TOLERANCE)
  const protectIds = protectPrimaryIds(pool, mustSatisfy)
  let list = [...selected]
  let gb = totalPlanGb(list, pool)

  const ranked = rankCandidatesForPack(pool, list, focusUseCases, mustSatisfy, {
    variant,
    preferCurrent: false,
    secondaryHighlight,
  })

  for (let attempt = 0; attempt < 40 && others.includes(sourceSetKey(list)); attempt++) {
    const droppable = list
      .map((s) => pool.candidatesById.get(s.id))
      .filter(Boolean)
      .filter((c) => !protectIds.has(c.id))
      .sort((a, b) => a.priorityScore - b.priorityScore || b.gb - a.gb)

    let swapped = false
    for (const drop of droppable) {
      const trimmed = list.filter((s) => s.id !== drop.id)
      const add = ranked.find(
        (c) => !trimmed.some((s) => s.id === c.id) && !wouldExceedBufferedCap(trimmed, c, pool, maxGb),
      )
      if (!add) continue
      const trial = addSourcesWithDependencies(trimmed, [add], pool)
      const trialGb = totalPlanGb(trial, pool)
      if (trialGb < minGb * 0.85) continue
      if (mustSatisfy[0] && !primarySatisfied(trial, mustSatisfy[0])) continue
      list = trial
      gb = trialGb
      swapped = true
      break
    }
    if (!swapped) break
  }

  gb = totalPlanGb(list, pool)
  if (gb > maxGb) {
    list = forceUnderBufferedCap(list, pool, maxGb, protectIds)
  }

  return list
}

/** Run: maximize use case coverage; soft cap on buffered GB. */
function buildRunPack(pool, { useCases, softMaxGb }) {
  let selected = []
  let gb = 0
  const ranked = rankCandidatesForPack(pool, selected, useCases, [], { variant: 'run', preferCurrent: false })

  for (const c of ranked) {
    if (softMaxGb && wouldExceedBufferedCap(selected, c, pool, softMaxGb)) continue
    selected = addSourcesWithDependencies(selected, [c], pool)
    gb = totalPlanGb(selected, pool)
  }

  if (softMaxGb && gb > softMaxGb) {
    selected = trimPlanToBudgetGb(selected, pool, softMaxGb, new Set(), { relaxCoverage: true, useCases })
  }

  return selected
}

function buildGreedyForUseCases(pool, focusUseCases, opts = {}) {
  const { preferCurrent, allowFuture, secondaryHighlight, includeAllCurrent, currentSources, maxSources } = opts
  let selected = seedMustHaveSources(pool, focusUseCases.slice(0, 1), { preferCurrent, allowFuture })
  const ranked = rankCandidatesForPack(pool, selected, focusUseCases, focusUseCases.slice(0, 1), {
    variant: 'walk',
    preferCurrent,
    secondaryHighlight,
  })

  for (const c of ranked) {
    if (maxSources != null && selected.length >= maxSources) break
    selected = addSourcesWithDependencies(selected, [c], pool)
  }

  if (includeAllCurrent && currentSources?.length) {
    const ids = new Set(selected.map((s) => s.id))
    for (const s of currentSources) {
      if (!ids.has(s.id) && pool.candidatesById.has(s.id)) {
        selected.push(s)
        ids.add(s.id)
      }
    }
  }

  return selected
}

function seedMustHaveSources(pool, mustSatisfy, { preferCurrent, allowFuture }) {
  let selected = []
  for (const uc of mustSatisfy) {
    if (!uc) continue
    for (const domain of uc.requiredDomains || []) {
      if (uncoveredRequiredDomains(selected, [uc]).length === 0) continue
      const options = pool.candidates
        .filter((c) => !selected.some((s) => s.id === c.id))
        .filter((c) => domainStrengthOnSource(c.source, domain) >= 0.5)
        .filter((c) => (preferCurrent ? c.status === 'current' : true) || (allowFuture && c.status === 'future'))
        .sort((a, b) => {
          const sa = domainStrengthOnSource(a.source, domain)
          const sb = domainStrengthOnSource(b.source, domain)
          if (sb !== sa) return sb - sa
          if (preferCurrent && a.status === 'current' && b.status !== 'current') return -1
          if (preferCurrent && b.status === 'current' && a.status !== 'current') return 1
          return a.gb - b.gb
        })
      if (options[0]) selected = addSourcesWithDependencies(selected, [options[0]], pool)
    }
    if (uc.minimumSources?.length) {
      for (const id of uc.minimumSources) {
        const c = pool.candidatesById.get(id)
        if (c) selected = addSourcesWithDependencies(selected, [c], pool)
      }
    }
  }
  return selected
}

function rankCandidatesForPack(pool, selected, focusUseCases, mustSatisfy, opts) {
  const { variant, preferCurrent, secondaryHighlight } = opts
  const gaps = uncoveredRequiredDomains(selected, focusUseCases)

  return pool.candidates
    .filter((c) => !selected.some((s) => s.id === c.id))
    .filter((c) => !preferCurrent || c.status === 'current' || c.status === 'future')
    .map((c) => {
      let rank = c.priorityScore + c.valuePerGb * 3
      if (c.status === 'current') rank += 15
      if (variant === 'run' && c.status === 'future') rank += 10

      for (const gap of gaps) {
        if (domainStrengthOnSource(c.source, gap) >= 0.5) rank += 80
      }

      for (const uc of mustSatisfy) {
        for (const d of uc.requiredDomains || []) {
          if (domainStrengthOnSource(c.source, d) >= 0.5) rank += 40
        }
      }

      if (secondaryHighlight) {
        for (const d of secondaryHighlight.requiredDomains || []) {
          if (domainStrengthOnSource(c.source, d) >= 0.5) rank += 25
        }
      }

      if (variant === 'crawl') rank -= c.gb * 2
      return { ...c, rank }
    })
    .sort((a, b) => b.rank - a.rank)
}

function trimPlanToBudgetGb(selected, pool, maxGb, protectIds = new Set(), opts = {}) {
  const relaxCoverage = opts.relaxCoverage === true
  const useCases = opts.useCases ?? pool.useCases
  let list = [...selected]
  let gb = totalPlanGb(list, pool)
  let guard = 0

  while (gb > maxGb && list.length > 1 && guard++ < 100) {
    const droppable = list
      .map((s) => pool.candidatesById.get(s.id))
      .filter(Boolean)
      .filter((c) => !protectIds.has(c.id))
      .sort((a, b) => a.priorityScore - b.priorityScore || b.gb - a.gb)

    let dropped = false
    for (const c of droppable) {
      const trial = list.filter((s) => s.id !== c.id)
      if (!relaxCoverage && uncoveredRequiredDomains(trial, useCases).length > 0) continue
      list = trial
      gb = totalPlanGb(list, pool)
      dropped = true
      break
    }
    if (!dropped) break
  }

  return list
}

function finalizePlan(packedSources, pool, phase, variant = null, meta = {}) {
  const { userSourceStates, overlapDecisions, catalogTree, useCases } = pool
  const userCtx = { catalog: catalogTree, allInputs: userSourceStates }
  const budgetCap = meta.budgetCap ?? null
  const configuredCeiling =
    meta.configuredCeiling ?? (budgetCap ? configuredBufferedCeiling(pool, budgetCap) : 0)

  const phase1Sources = []
  const recommendedNotConfigured = []
  for (const s of packedSources) {
    if (isSourceEligibleForPlanningTotals(s, userSourceStates, userCtx, overlapDecisions)) {
      phase1Sources.push({ ...s, isPlanningRecommendation: false })
    } else {
      recommendedNotConfigured.push({
        id: s.id,
        name: s.name,
        category: s.category,
        reason: !userSourceStates[s.id]
          ? 'Recommended for coverage — configure in Data Sources before ingest planning'
          : userSourceStates[s.id].status === 'unknown'
            ? 'Status unknown — set to Current or Future with valid counts'
            : 'No valid sizing counts — configure before ingest planning',
      })
    }
  }

  const rankedUseCases = meta.rankedUseCases ?? useCases
  const phase2Suggestions = buildPhase2Suggestions(
    pool,
    phase1Sources.map((s) => s.id),
    budgetCap,
    configuredCeiling,
    rankedUseCases,
  )

  const customs = Object.entries(userSourceStates || {})
    .filter(([id]) => id.startsWith('custom_'))
    .map(([id, s]) => ({
      id,
      name: s.name || 'Custom',
      category: 'Custom',
      sizing_formula: { primary_input: 'count', rate_per_unit: s.sizingRate || 0.1 },
    }))
  const allCatalogSources = [...pool.allSources, ...customs.filter((c) => !pool.allSources.some((a) => a.id === c.id))]

  const { totals, adjustedResults } = sumPlanningIngestForSources(
    allCatalogSources,
    userSourceStates,
    overlapDecisions,
    userCtx,
    { sourceIds: phase1Sources.map((s) => s.id) },
  )

  const phase2Totals = sumPhase2Totals(phase2Suggestions)
  const coverage = calculateCoverage(phase1Sources)
  const validation = validateForPlan(coverage, useCases)
  const sourceIngestGb = buildPathSourceIngestBreakdown(phase1Sources, adjustedResults)

  const appsPoweredIds = collectPlanAppsPowered(phase1Sources, meta.intake || {})
  const planShell = {
    sources: phase1Sources,
    phase2Suggestions,
    phase2Totals,
    configuredCeiling,
    budgetGbDay: budgetCap,
    budgetUtilizationPct: budgetCap ? (totals.buffered.expected / budgetCap) * 100 : null,
    budgetHeadroomGb: budgetCap ? Math.max(0, budgetCap - totals.buffered.expected) : null,
    recommendedNotConfigured,
    packedSourceCount: packedSources.length,
    totals,
    sourceIngestGb,
    coverage,
    validation,
    storage: calculateStorage(totals.buffered.expected, phase === 'run' ? 365 : undefined),
    strengths: buildStrengths(phase1Sources, validation, phase),
    risks: buildRisks(validation, packedSources),
    pathPhase: phase,
    pathVariant: variant,
    appsPowered: appsPoweredIds,
    appsPartiallyPowered: collectPlanAppsPartiallyPowered(
      phase1Sources,
      appsPoweredIds,
      meta.intake || {},
    ),
    gaps: formatPlanGapsPlain(validation, recommendedNotConfigured, {
      useCases,
      intake: meta.intake || {},
      pathSourceIds: phase1Sources.map((s) => s.id),
      configuredSourceIds: getConfiguredSourceIds(userSourceStates),
    }),
    categoryBreakdown: buildPlanCategoryBreakdown(sourceIngestGb, phase1Sources, totals.buffered.expected),
  }

  const outcomeReadiness = adjustReadinessForPhase(
    computeRoadmapReadiness(planShell, useCases, { roadmapCompleteness: 0 }),
    phase,
    phase1Sources.length,
  )
  const pathMessaging = buildPathCardMessaging({ ...planShell, outcomeReadiness }, useCases)

  return {
    ...planShell,
    outcomeReadiness,
    pathMessaging,
    pathThemeLabel: pathMessaging.themeLabel,
    pathValueUnlocked: pathMessaging.mainValueUnlocked,
    pathTradeoff: pathMessaging.tradeoff,
  }
}

function buildSourceIngestBreakdown(sources, adjustedResults) {
  return buildPathSourceIngestBreakdown(sources, adjustedResults)
}

function collectPlanAppsPowered(sources, intake = {}) {
  const combinedApps = [...new Set([...(intake.desiredApps || []), ...(intake.recommendedApps || [])])]
  const pathIds = new Set(sources.map((s) => s.id))
  const powered = new Set()

  for (const s of sources) {
    if (countAppsPoweringSource(s.id, combinedApps) > 0) {
      for (const appId of combinedApps) {
        const knowledgeId = resolveKnowledgeAppId(appId)
        const knowledge = APPS_BY_ID.get(knowledgeId)
        const required = knowledge?.requiredSourceIds || []
        const recommended = knowledge?.recommendedSourceIds || []
        const boosted = rules.appCapabilityMappings?.[appId]?.boostSourceIds || []
        if (required.includes(s.id) || recommended.includes(s.id) || boosted.includes(s.id)) {
          powered.add(appId)
        }
      }
    }
  }

  for (const rawId of combinedApps) {
    if (String(rawId).startsWith('add_on_')) continue
    const knowledgeId = resolveKnowledgeAppId(rawId)
    const knowledge = APPS_BY_ID.get(knowledgeId)
    if (!knowledge) {
      if ((intake.desiredApps || []).includes(rawId)) powered.add(rawId)
      continue
    }
    const required = knowledge.requiredSourceIds || []
    const hasRequiredOnPath = required.length === 0 || required.every((id) => pathIds.has(id))
    const touchesPath = sources.some(
      (s) =>
        required.includes(s.id)
        || (knowledge.recommendedSourceIds || []).includes(s.id),
    )
    const explicitlyDesired = (intake.desiredApps || []).includes(rawId)
    if (hasRequiredOnPath || touchesPath || explicitlyDesired) {
      powered.add(rawId)
    }
  }

  return [...powered]
}

function collectPlanAppsPartiallyPowered(sources, poweredIds, intake = {}) {
  const pathIds = new Set(sources.map((s) => s.id))
  const powered = new Set(poweredIds || [])
  const partial = []

  for (const rawId of intake.desiredApps || []) {
    if (String(rawId).startsWith('add_on_')) continue
    const knowledgeId = resolveKnowledgeAppId(rawId)
    const knowledge = APPS_BY_ID.get(knowledgeId)
    if (!knowledge) continue

    const required = knowledge.requiredSourceIds || []
    const recommended = knowledge.recommendedSourceIds || []
    const missingRequired = required.filter((id) => !pathIds.has(id))
    if (missingRequired.length > 0) {
      partial.push({
        id: rawId,
        reason: `This path is missing required telemetry (${missingRequired.map((id) => id.replace(/_/g, ' ')).join(', ')}) for full app coverage.`,
      })
      continue
    }

    if (!powered.has(rawId)) {
      partial.push({
        id: rawId,
        reason: 'Desired app is not fully powered by telemetry on this path — consider a later phase or additional sources.',
      })
      continue
    }

    const missingRecommended = recommended.filter((id) => !pathIds.has(id))
    if (missingRecommended.length > 0) {
      partial.push({
        id: rawId,
        reason: `Core controls are covered; add ${missingRecommended.slice(0, 3).map((id) => id.replace(/_/g, ' ')).join(', ')} in a later phase for richer compliance evidence.`,
      })
    }
  }

  return partial
}

function formatPlanGapsPlain(validation, recommendedNotConfigured = [], opts = {}) {
  return buildFutureMaturityOpportunities({
    validation,
    recommendedNotConfigured,
    pathSourceIds: opts.pathSourceIds || [],
    configuredSourceIds: opts.configuredSourceIds || [],
    useCases: opts.useCases || [],
    intake: opts.intake || {},
  })
}

function buildPlanCategoryBreakdown(sourceIngestGb, sources, totalExpected) {
  const byCat = {}
  for (const row of sourceIngestGb || []) {
    const src = sources.find((s) => s.id === row.id)
    const cat = src?.category || 'Other'
    byCat[cat] = (byCat[cat] || 0) + (row.gbDay || 0)
  }
  return Object.entries(byCat)
    .map(([category, gbDay]) => ({
      category,
      gbDay,
      pct: totalExpected > 0 ? (gbDay / totalExpected) * 100 : 0,
    }))
    .sort((a, b) => b.gbDay - a.gbDay)
}

function applyPlanLabels(plan, phase, variant = null) {
  const labels = {
    crawl: {
      name: 'Crawl',
      subtitle: 'Foundational',
      description:
        'Day-one SIEM foundation — identity, endpoint, and network telemetry without broad cloud/SaaS expansion.',
      nextStep: 'Validate ingest with customer measurement, then expand to Walk for balanced coverage.',
    },
    walk: {
      name: 'Walk',
      subtitle: 'Balanced recommended',
      description:
        'Recommended balanced path — security-core and cloud/SaaS coverage aligned to your selected maturity phase.',
      nextStep: 'Deploy in phases over 3–6 months, then compare with Run for full roadmap scope.',
    },
    run: {
      name: 'Run',
      subtitle: 'Target Roadmap',
      description:
        'Complete roadmap across security, cloud, SaaS, compliance, and analytics — nearly all valid configured sources.',
      nextStep: 'Multi-quarter roadmap with milestones, success criteria, and executive alignment.',
    },
  }

  const meta = labels[phase] || labels.walk
  return {
    ...plan,
    name: meta.name,
    pathPhase: phase,
    pathVariant: variant,
    pathSubtitle: meta.subtitle,
    description: meta.description,
    nextStep: meta.nextStep,
  }
}

function validateForPlan(coverage, useCases) {
  if (!useCases || useCases.length === 0) {
    const hasCov = Object.values(coverage).some((v) => v.score > 0)
    return { passed: hasCov, overallScore: hasCov ? 50 : 0, score: hasCov ? 50 : 0, perUseCase: [], gaps: [], warnings: [] }
  }
  const result = validateMultiUseCase(coverage, useCases)
  return { ...result, score: result.overallScore }
}

function sizeSources(sources, sourceStates, overlapDecisions, bufferPercent = 0.2, catalogTree) {
  const sizingCtx = { catalog: catalogTree, allInputs: sourceStates }
  const sizeResults = {}
  for (const s of sources) {
    sizeResults[s.id] = calculateFullSourceIngest(s, sourceStates[s.id] || {}, sizingCtx)
  }
  const overlapAdjusted = OVERLAP_ANNOTATE_ONLY
    ? { results: { ...sizeResults }, excluded: [], assumptions: [] }
    : applyOverlapExclusions(sizeResults, overlapDecisions)
  const { results: adjustedResults } = overlapAdjusted
  return { sizeResults, adjustedResults, totals: calculateTotals(adjustedResults, bufferPercent) }
}

function buildStrengths(sources, validation, phase) {
  if (sources.length === 0) return ['No sources configured yet']

  const strengths = []
  if (phase === 'crawl') {
    strengths.push('Fastest time to value')
    strengths.push('Sized for a credible day-one footprint (not a minimal token deployment)')
    if (validation.passed) strengths.push('Primary use case requirements met')
  } else if (phase === 'walk') {
    strengths.push('Balanced security and cloud/SaaS coverage for core use cases')
    strengths.push('Primary use case fully covered')
    if (validation.score >= 70) strengths.push('Strong multi use-case coverage across selected domains')
  } else if (phase === 'run') {
    strengths.push('Maximum use-case breadth for long-term roadmap')
    if (sources.length >= 6) strengths.push('Broad visibility across telemetry domains')
  }
  return strengths
}

function buildRisks(validation, sources) {
  const risks = []
  const gaps = validation.gaps || []
  if (gaps.length > 0) {
    risks.push(`${gaps.length} required focus area(s) still need coverage`)
  }
  if (sources.some((s) => s.dependencies?.length > 0)) {
    risks.push('Some sources have unvalidated dependencies')
  }
  if (validation.warnings?.length > 3) {
    risks.push('Multiple recommended domains without coverage')
  }
  return risks
}
