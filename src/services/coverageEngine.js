/**
 * Coverage Engine
 * Weighted telemetry domain coverage calculation with multi-use-case support.
 * Uses source eligibility checks to exclude 0-GB or overlap-excluded sources.
 * Recommended domains carry secondary scoring weight.
 */

import { flattenSourceCatalog } from './sizingEngine.js'
import { sourceCountsTowardCoverage, calculateFullSourceIngest } from './sourceEligibilityEngine.js'
import sourcesCatalog from '../data/sources.json' with { type: 'json' }
import { strengthToScore } from './strengthScores.js'

export const TELEMETRY_DOMAINS = [
  'authentication', 'endpoint', 'network', 'perimeter_control', 'remote_access',
  'threat_enrichment', 'identity_governance', 'vulnerability_asset',
  'email_collaboration', 'cloud_control_plane', 'saas_activity',
  'infrastructure_metrics', 'application_logs', 'application_traces',
  'service_health', 'synthetic_monitoring', 'real_user_monitoring',
  'kubernetes_container', 'cloud_infrastructure', 'database_activity',
  'middleware_messaging', 'network_performance', 'storage_performance',
  'business_transactions', 'user_experience', 'audit_compliance',
  'platform_health', 'ingest_pipeline_health', 'asset_inventory',
  'ot_network', 'scada_events', 'historian_data', 'industrial_assets',
]

export const DOMAIN_CATEGORIES = {
  Security: [
    'authentication', 'endpoint', 'network', 'perimeter_control',
    'remote_access', 'threat_enrichment', 'identity_governance',
    'vulnerability_asset', 'email_collaboration', 'cloud_control_plane', 'saas_activity',
  ],
  'Observability / IT': [
    'infrastructure_metrics', 'application_logs', 'application_traces',
    'service_health', 'synthetic_monitoring', 'real_user_monitoring',
    'kubernetes_container', 'cloud_infrastructure', 'database_activity',
    'middleware_messaging', 'network_performance', 'storage_performance',
  ],
  'Business / Platform': [
    'business_transactions', 'user_experience', 'audit_compliance',
    'platform_health', 'ingest_pipeline_health', 'asset_inventory',
  ],
  'OT / ICS': ['ot_network', 'scada_events', 'historian_data', 'industrial_assets'],
}

/** Customer-friendly labels for SIEM / security coverage areas. */
export const CUSTOMER_DOMAIN_LABELS = {
  authentication: 'Identity and authentication',
  endpoint: 'Endpoint activity',
  network: 'Network and perimeter',
  perimeter_control: 'Network and perimeter',
  remote_access: 'VPN / remote access',
  threat_enrichment: 'Detection and investigation readiness',
  identity_governance: 'Identity and authentication',
  vulnerability_asset: 'Asset and vulnerability context',
  email_collaboration: 'Email security',
  cloud_control_plane: 'Cloud control plane',
  saas_activity: 'SaaS activity',
  infrastructure_metrics: 'Infrastructure metrics',
  application_logs: 'Application logs',
  application_traces: 'Application traces',
  service_health: 'Service health',
  synthetic_monitoring: 'Synthetic monitoring',
  real_user_monitoring: 'Real user monitoring',
  kubernetes_container: 'Kubernetes / containers',
  cloud_infrastructure: 'Cloud infrastructure',
  database_activity: 'Database activity',
  middleware_messaging: 'Middleware / messaging',
  network_performance: 'Network performance',
  storage_performance: 'Storage performance',
  business_transactions: 'Business transactions',
  user_experience: 'User experience',
  audit_compliance: 'Audit and compliance',
  platform_health: 'Platform health',
  ingest_pipeline_health: 'Ingest pipeline health',
  asset_inventory: 'Asset inventory',
  ot_network: 'OT network',
  scada_events: 'SCADA events',
  historian_data: 'Historian data',
  industrial_assets: 'Industrial assets',
}

/** Default SIEM/security domains shown unless user expands to all domains. */
export const SIEM_DEFAULT_DOMAINS = new Set([
  'authentication', 'endpoint', 'network', 'perimeter_control', 'remote_access',
  'threat_enrichment', 'vulnerability_asset', 'email_collaboration',
  'identity_governance', 'asset_inventory',
])

export function formatDomainForCustomer(domain) {
  return CUSTOMER_DOMAIN_LABELS[domain] || domain.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const COVERAGE_THRESHOLD = 0.75

/**
 * Calculate weighted coverage from selected sources.
 * Returns per-domain score (0-1) and contributing sources.
 */
export function calculateCoverage(selectedSources) {
  const coverage = {}
  for (const d of TELEMETRY_DOMAINS) {
    coverage[d] = { score: 0, maxStrength: 'none', contributingSources: [] }
  }

  for (const source of selectedSources) {
    if (!source.telemetryDomains) continue
    for (const [domain, strength] of Object.entries(source.telemetryDomains)) {
      if (!coverage[domain]) {
        coverage[domain] = { score: 0, maxStrength: 'none', contributingSources: [] }
      }
      const score = strengthToScore(strength)
      coverage[domain].contributingSources.push({ id: source.id, name: source.name, strength, score })
      if (score > coverage[domain].score) {
        coverage[domain].score = score
        coverage[domain].maxStrength = strength
      }
    }
  }

  return coverage
}

/**
 * Calculate separate current vs. future coverage.
 * Filters sources through eligibility so 0-GB and overlap-excluded sources
 * do not inflate coverage.
 *
 * @param {object[]} allSources
 * @param {Record<string, object>} sourceStates
 * @param {string[]} [overlapExcludedIds] - overlap-excluded source IDs
 */
export function calculateSplitCoverage(allSources, sourceStates, overlapExcludedIds) {
  const excluded = overlapExcludedIds || []

  function isEligible(s) {
    const ss = sourceStates[s.id]
    if (!ss) return false
    const sizingCtx = { catalog: sourcesCatalog, allInputs: sourceStates }
    const estimate = calculateFullSourceIngest(s, ss, sizingCtx)
    return sourceCountsTowardCoverage(s, ss, estimate, excluded)
  }

  const current = allSources.filter((s) => sourceStates[s.id]?.status === 'current' && isEligible(s))
  const future = allSources.filter((s) => sourceStates[s.id]?.status === 'future' && isEligible(s))
  const all = [...current, ...future]

  return {
    current: calculateCoverage(current),
    future: calculateCoverage(future),
    combined: calculateCoverage(all),
  }
}

/**
 * Validate coverage against multiple use cases with weighting.
 * Each use case can have a weight (default 1.0).
 */
export function validateMultiUseCase(coverage, useCases) {
  if (!useCases || useCases.length === 0) {
    const hasAnyCoverage = Object.values(coverage).some((v) => v.score > 0)
    return { passed: false, overallScore: hasAnyCoverage ? 0 : 0, perUseCase: [], gaps: [], warnings: ['No use cases selected — coverage cannot be evaluated'] }
  }

  const totalWeight = useCases.reduce((sum, uc) => sum + (uc.weight || 1), 0)
  let weightedScore = 0
  const perUseCase = []
  const allGaps = new Set()
  const allWarnings = new Set()

  for (const useCase of useCases) {
    const weight = useCase.weight || 1
    const ucResult = validateForUseCase(coverage, useCase)
    weightedScore += (ucResult.score / 100) * (weight / totalWeight)
    perUseCase.push({ id: useCase.id, name: useCase.name, ...ucResult, weight })
    ucResult.gaps.forEach((g) => allGaps.add(g))
    ucResult.warnings.forEach((w) => allWarnings.add(w))
  }

  return {
    passed: weightedScore >= COVERAGE_THRESHOLD,
    overallScore: Math.round(weightedScore * 100),
    perUseCase,
    gaps: [...allGaps],
    warnings: [...allWarnings],
  }
}

const REQUIRED_WEIGHT = 1.0
const RECOMMENDED_WEIGHT = 0.3

/**
 * Validate coverage against a single use case profile.
 * Required domains carry primary weight; recommended carry secondary weight.
 */
export function validateForUseCase(coverage, useCaseProfile) {
  const gaps = []
  const warnings = []
  const suggestions = []

  if (!useCaseProfile) return { passed: false, score: 0, requiredScore: 0, recommendedScore: 0, gaps, warnings: ['Use case profile not found'], suggestions }

  const allSources = flattenSourceCatalog(sourcesCatalog)

  let requiredScoreSum = 0
  let requiredMax = 0

  for (const domain of useCaseProfile.requiredDomains || []) {
    const cov = coverage[domain]
    const score = cov?.score || 0
    requiredMax += 1
    requiredScoreSum += score

    if (score < COVERAGE_THRESHOLD) {
      gaps.push(domain)
      const fixSources = allSources
        .filter((s) => strengthToScore(s.telemetryDomains?.[domain]) >= COVERAGE_THRESHOLD)
        .slice(0, 3)
        .map((s) => ({ id: s.id, name: s.name, category: s.category }))
      if (fixSources.length > 0) suggestions.push({ domain, sources: fixSources })
    }
  }

  let recommendedScoreSum = 0
  let recommendedMax = 0

  for (const domain of useCaseProfile.recommendedDomains || []) {
    const cov = coverage[domain]
    recommendedMax += 1
    recommendedScoreSum += cov?.score || 0
    if (!cov || cov.score === 0) warnings.push(domain)
  }

  const requiredPct = requiredMax > 0 ? requiredScoreSum / requiredMax : 0
  const recommendedPct = recommendedMax > 0 ? recommendedScoreSum / recommendedMax : 0

  const totalWeight = (requiredMax > 0 ? REQUIRED_WEIGHT : 0) + (recommendedMax > 0 ? RECOMMENDED_WEIGHT : 0)
  const blended = totalWeight > 0
    ? ((requiredPct * REQUIRED_WEIGHT) + (recommendedPct * RECOMMENDED_WEIGHT)) / totalWeight
    : 0

  const score = Math.round(blended * 100)
  const requiredScorePct = requiredMax > 0 ? Math.round(requiredPct * 100) : 0
  const recommendedScorePct = recommendedMax > 0 ? Math.round(recommendedPct * 100) : 0

  return { passed: gaps.length === 0, score, requiredScore: requiredScorePct, recommendedScore: recommendedScorePct, gaps, warnings, suggestions }
}

/**
 * Calculate source priority score relative to current coverage and use cases.
 */
export function calculateSourcePriority(source, useCases, currentCoverage, expectedGB = 0) {
  if (!source.telemetryDomains) return { score: 0, reasons: [] }

  let score = 0
  const reasons = []
  const allRequired = new Set()
  const allRecommended = new Set()

  for (const uc of useCases || []) {
    (uc.requiredDomains || []).forEach((d) => allRequired.add(d))
    ;(uc.recommendedDomains || []).forEach((d) => allRecommended.add(d))
  }

  for (const [domain, strength] of Object.entries(source.telemetryDomains)) {
    const domainScore = strengthToScore(strength)
    const currentScore = currentCoverage?.[domain]?.score || 0
    const fillsGap = currentScore < COVERAGE_THRESHOLD

    if (allRequired.has(domain) && fillsGap) {
      const points = domainScore * 30
      score += points
      reasons.push(`Fills required gap: ${domain.replace(/_/g, ' ')} (+${points.toFixed(0)})`)
    } else if (allRecommended.has(domain) && currentScore === 0) {
      const points = domainScore * 15
      score += points
      reasons.push(`Adds recommended: ${domain.replace(/_/g, ' ')} (+${points.toFixed(0)})`)
    } else if (fillsGap) {
      score += domainScore * 5
    }
  }

  if (expectedGB > 0 && score > 0) {
    const efficiency = score / expectedGB
    if (efficiency > 10) reasons.push('High value per GB')
  }

  return { score: Math.round(score), reasons }
}
