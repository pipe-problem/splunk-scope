/**
 * Interpretation Engine
 * Analyzes customer intake data (structured use cases + freeform text)
 * to recommend use case profiles, source families, and telemetry domains.
 *
 * Supports dual-input model: structured multi-select AND freeform text.
 */

import useCaseProfiles from '../data/useCaseProfiles.json'
import sourcesCatalog from '../data/sources.json'
import { flattenSourceCatalog } from './sizingEngine.js'
import { TELEMETRY_DOMAINS } from './coverageEngine.js'
import { recommendApps } from './appRecommendationEngine.js'
import { assessEnterpriseSecurityEligibility } from './enterpriseSecurityEligibilityEngine.js'
import { withEffectiveGoals } from '../utils/goalPresets.js'

const flatSources = flattenSourceCatalog(sourcesCatalog)
const profilesById = new Map(useCaseProfiles.map((p) => [p.id, p]))
const profilesByName = new Map(useCaseProfiles.map((p) => [p.name, p]))

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'with',
  'we', 'our', 'us', 'want', 'need', 'like', 'use', 'also', 'would',
])

function tokenize(text) {
  if (!text || typeof text !== 'string') return []
  return text
    .toLowerCase()
    .split(/[^a-z0-9+/]+/g)
    .filter((t) => t.length > 1 && !STOP.has(t))
}

function collectNarrative(intakeData) {
  const chunks = []
  if (intakeData.goals) chunks.push(String(intakeData.goals))
  if (intakeData.crawlGoal) chunks.push(String(intakeData.crawlGoal))
  if (intakeData.walkGoal) chunks.push(String(intakeData.walkGoal))
  if (intakeData.runGoal) chunks.push(String(intakeData.runGoal))
  if (intakeData.discoveryNotes) chunks.push(String(intakeData.discoveryNotes))
  if (intakeData.useCaseNotes) chunks.push(String(intakeData.useCaseNotes))
  if (intakeData.summary) chunks.push(String(intakeData.summary))
  if (intakeData.customUseCases) chunks.push(String(intakeData.customUseCases))
  if (Array.isArray(intakeData.rawPriorities)) {
    chunks.push(intakeData.rawPriorities.join(' '))
  }
  if (Array.isArray(intakeData.useCases)) {
    for (const u of intakeData.useCases) {
      if (typeof u === 'string') chunks.push(u)
      else if (u?.label) chunks.push(String(u.label))
      else if (u?.name) chunks.push(String(u.name))
    }
  }
  if (Array.isArray(intakeData.desiredApps)) {
    chunks.push(intakeData.desiredApps.join(' '))
  }
  return tokenize(chunks.join(' '))
}

const RULES = [
  { ids: ['compliance_audit'], keywords: ['compliance', 'audit', 'grc', 'pci', 'hipaa', 'sox', 'gdpr', 'iso', 'regulation'], weight: 3 },
  { ids: ['risk_based_alerting'], keywords: ['insider', 'ueba', 'entity behavior', 'risk score', 'risk-based', 'risk based alerting', 'insider threat'], weight: 3 },
  { ids: ['cloud_security'], keywords: ['cloud security', 'cspm', 'cwpp', 'cloud posture', 'multi-cloud security'], weight: 3 },
  { ids: ['enterprise_security'], keywords: ['siem', 'enterprise security', 'security operations', 'soc', 'incident response', 'alert fatigue', 'dwell time'], weight: 2 },
  { ids: ['foundational_security'], keywords: ['security', 'infosec', 'detection', 'alert', 'ransomware', 'threat'], weight: 1 },
  { ids: ['threat_detection'], keywords: ['threat hunting', 'investigation', 'forensics', 'ioc', 'mitre', 'attack', 'malware', 'mttr'], weight: 3 },
  { ids: ['identity_access'], keywords: ['identity', 'iam', 'pam', 'privileged', 'sso', 'mfa', 'okta', 'entra', 'access management'], weight: 3 },
  { ids: ['endpoint_security'], keywords: ['edr', 'endpoint', 'crowdstrike', 'defender', 'sentinelone', 'carbon black'], weight: 2 },
  { ids: ['observability_apm'], keywords: ['observability', 'apm', 'traces', 'tracing', 'opentelemetry', 'latency', 'distributed', 'service map'], weight: 3 },
  { ids: ['it_operations'], keywords: ['itops', 'it operations', 'server monitoring', 'infrastructure', 'capacity', 'itsi', 'uptime', 'availability'], weight: 2 },
  { ids: ['infrastructure_monitoring'], keywords: ['infrastructure monitoring', 'cpu', 'memory', 'disk', 'metrics', 'signalfx'], weight: 2 },
  { ids: ['application_monitoring'], keywords: ['application monitoring', 'app logs', 'error rate', 'log observer', 'application logs', 'sap', 'erp'], weight: 2 },
  { ids: ['kubernetes_container'], keywords: ['kubernetes', 'k8s', 'container', 'docker', 'helm', 'pod', 'eks', 'aks', 'gke'], weight: 3 },
  { ids: ['network_operations'], keywords: ['network operations', 'netops', 'bandwidth', 'snmp', 'netflow', 'network monitoring'], weight: 2 },
  { ids: ['database_monitoring'], keywords: ['database', 'db connect', 'sql', 'oracle', 'postgres', 'mysql', 'db monitoring'], weight: 2 },
  { ids: ['business_analytics'], keywords: ['business analytics', 'kpi', 'revenue', 'transaction', 'business intelligence', 'business impact'], weight: 3 },
  { ids: ['digital_experience'], keywords: ['rum', 'real user', 'digital experience', 'customer experience', 'web vitals', 'synthetic', 'conversion'], weight: 3 },
  { ids: ['ai_ml_analytics'], keywords: ['machine learning', 'mltk', 'aitk', 'anomaly detection', 'forecasting', 'predictive', 'ai', 'correlation'], weight: 2 },
  { ids: ['ot_ics_security'], keywords: ['ot', 'ics', 'scada', 'industrial', 'plc', 'hmi', 'historian', 'nozomi', 'claroty', 'dragos'], weight: 3 },
  { ids: ['platform_admin'], keywords: ['platform', 'splunk health', 'monitoring console', 'license', 'ingest', 'forwarder'], weight: 2 },
]

function scoreProfiles(tokens, deploymentType) {
  const scores = new Map()
  for (const p of useCaseProfiles) {
    scores.set(p.id, 0)
  }

  for (const { ids, keywords, weight } of RULES) {
    for (const id of ids) {
      let add = 0
      for (const kw of keywords) {
        const needle = kw.toLowerCase()
        if (tokens.some((t) => t.includes(needle) || needle.includes(t))) {
          add += weight
        }
      }
      scores.set(id, (scores.get(id) ?? 0) + add)
    }
  }

  for (const p of useCaseProfiles) {
    const hay = tokenize(`${p.name} ${p.description}`).join(' ')
    for (const t of tokens) {
      if (t.length > 3 && hay.includes(t)) {
        scores.set(p.id, (scores.get(p.id) ?? 0) + 1)
      }
    }
  }

  if (String(deploymentType).toLowerCase().includes('cloud')) {
    scores.set('cloud_security', (scores.get('cloud_security') ?? 0) + 2)
  }

  return scores
}

function pickPrimaryUseCase(scores, esEligibility = { esEligible: true }) {
  let bestId = useCaseProfiles[0]?.id
  let best = -1
  for (const [id, s] of scores) {
    if (!esEligibility.esEligible && id === 'enterprise_security') continue
    if (s > best) { best = s; bestId = id }
  }
  if (best <= 0) bestId = useCaseProfiles[0]?.id ?? 'foundational_security'
  return profilesById.get(bestId) ?? useCaseProfiles[0]
}

/**
 * Parse freeform custom use case text and attempt to map to known profiles.
 * Returns { matched, unmatched } arrays.
 */
export function parseCustomUseCases(customText) {
  if (!customText || typeof customText !== 'string' || !customText.trim()) {
    return { matched: [], unmatched: [] }
  }

  const tokens = tokenize(customText)
  const matched = []
  const matchedIds = new Set()

  for (const { ids, keywords } of RULES) {
    for (const kw of keywords) {
      const needle = kw.toLowerCase()
      if (tokens.some((t) => t.includes(needle) || needle.includes(t))) {
        for (const id of ids) {
          if (!matchedIds.has(id)) {
            const profile = profilesById.get(id)
            if (profile) {
              matched.push({ id: profile.id, name: profile.name, matchedKeyword: kw })
              matchedIds.add(id)
            }
          }
        }
      }
    }
  }

  const phrases = customText.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
  const unmatched = []
  for (const phrase of phrases) {
    const phraseTokens = tokenize(phrase)
    const hasMatch = phraseTokens.some((t) => {
      for (const { keywords } of RULES) {
        for (const kw of keywords) {
          if (t.includes(kw.toLowerCase()) || kw.toLowerCase().includes(t)) return true
        }
      }
      return false
    })
    if (!hasMatch && phrase.length > 3) {
      unmatched.push(phrase)
    }
  }

  return { matched, unmatched }
}

function sourceFamiliesForProfile(profile) {
  const ids = new Set([
    ...(profile.suggestedSources ?? []),
    ...(profile.minimumSources ?? []),
  ])
  const families = new Map()
  for (const s of flatSources) {
    if (!ids.has(s.id)) continue
    const cat = s.category ?? 'General'
    if (!families.has(cat)) families.set(cat, new Set())
    families.get(cat).add(s.subcategory ?? s.name)
  }
  return [...families.entries()].map(([category, sub]) => ({
    category,
    subcategories: [...sub],
  }))
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))]
}

/**
 * Resolve structured use case names to profiles.
 * Handles the dual-input model: structured selections + freeform text.
 */
export function resolveUseCases(intakeData) {
  const structuredNames = intakeData.useCases || []
  const structuredProfiles = structuredNames
    .map((name) => profilesByName.get(name))
    .filter(Boolean)

  const customParsed = parseCustomUseCases(intakeData.customUseCases)
  const esEligibility = assessEnterpriseSecurityEligibility(intakeData)

  const freeformProfiles = customParsed.matched
    .map((m) => profilesById.get(m.id))
    .filter(Boolean)
    .filter((p) => !structuredProfiles.some((sp) => sp.id === p.id))
    .filter((p) => p.id !== 'enterprise_security' || esEligibility.esEligible)

  let allProfiles = [...structuredProfiles, ...freeformProfiles]
  if (!esEligibility.esEligible) {
    allProfiles = allProfiles.filter((p) => p.id !== 'enterprise_security')
  }
  const customUnmatched = customParsed.unmatched

  return { allProfiles, customUnmatched, freeformMatches: customParsed.matched, esEligibility }
}

/**
 * Main interpretation function.
 * Processes both structured selections and freeform custom use cases.
 */
export function interpretInputs(intakeData) {
  const effectiveIntake = withEffectiveGoals(intakeData)
  const tokens = collectNarrative(effectiveIntake)
  const esEligibility = assessEnterpriseSecurityEligibility(effectiveIntake)
  const scores = scoreProfiles(tokens, effectiveIntake.deploymentType ?? '')
  if (!esEligibility.esEligible) {
    scores.set('enterprise_security', 0)
    scores.set('enterprise_security_premier', 0)
  }
  const primaryUseCase = pickPrimaryUseCase(scores, esEligibility)

  const { allProfiles, customUnmatched, freeformMatches } = resolveUseCases(effectiveIntake)
  const customParsed = parseCustomUseCases(effectiveIntake.customUseCases)
  const narrativeKeywordMappings = buildNarrativeKeywordMappings(tokens, scores)
  const customPhraseMappings = buildCustomPhraseMappings(effectiveIntake.customUseCases, customParsed)

  const suggestedSourceFamilies = sourceFamiliesForProfile(primaryUseCase)

  const appRecommendations = recommendApps({
    intake: effectiveIntake,
    sourceStatuses: intakeData.sourceStatuses || {},
    useCaseProfiles: allProfiles.length ? allProfiles : [primaryUseCase],
  })

  const suggestedApps = uniq([
    ...(appRecommendations.recommendedSolutions || []).map((r) => r.displayName),
    ...(appRecommendations.helpfulApps || []).map((r) => r.displayName),
    ...(appRecommendations.dependencies || []).map((r) => r.displayName),
  ]).slice(0, 8)

  const requiredTelemetry = [...(primaryUseCase.requiredDomains ?? [])].filter(
    (d) => TELEMETRY_DOMAINS.includes(d),
  )
  const futureExtras = uniq([
    ...(primaryUseCase.recommendedDomains ?? []).map(
      (d) => `Strengthen ${d.replace(/_/g, ' ')} telemetry`,
    ),
    'Expand coverage to recommended domains once baseline is established',
  ])

  const day1Sources = uniq([
    ...(primaryUseCase.minimumSources ?? []),
    ...(primaryUseCase.suggestedSources ?? []).slice(0, 3),
  ]).filter((id) => flatSources.some((s) => s.id === id))

  const futureSources = (primaryUseCase.suggestedSources ?? []).filter(
    (id) => !day1Sources.includes(id),
  )

  return {
    primaryUseCase,
    resolvedProfiles: allProfiles,
    customUnmatched,
    freeformMatches,
    narrativeKeywordMappings,
    customPhraseMappings,
    suggestedSourceFamilies,
    suggestedApps,
    appRecommendations,
    esEligibility,
    requiredTelemetry,
    day1Sources,
    futureSources,
    growthPathNotes: futureExtras,
    matchedProfileScores: Object.fromEntries(scores),
    notes: [
      'Keyword and rule-based mapping only; validate with a Splunk architect before committing scope.',
      ...(customUnmatched.length > 0
        ? [`${customUnmatched.length} custom use case(s) could not be mapped to known profiles and will be included as-is.`]
        : []),
    ],
  }
}

/**
 * Keywords from intake narrative that fired rule mapping (for advanced details UI).
 */
function buildNarrativeKeywordMappings(tokens, scores) {
  const rows = []
  for (const { ids, keywords, weight } of RULES) {
    for (const kw of keywords) {
      const needle = kw.toLowerCase()
      const hit = tokens.some((t) => t.includes(needle) || needle.includes(t))
      if (!hit) continue
      const profile = profilesById.get(ids[0])
      if (!profile) continue
      rows.push({
        keyword: kw,
        profileId: profile.id,
        profileName: profile.name,
        weight,
      })
      break
    }
  }
  return rows.sort((a, b) => b.weight - a.weight).slice(0, 24)
}

/**
 * Per-line custom use case text → matched profile or unmatched phrase.
 */
function buildCustomPhraseMappings(customText, customParsed) {
  if (!customText || typeof customText !== 'string' || !customText.trim()) return []
  const phrases = customText.split(/[,;\n]+/).map((s) => s.trim()).filter((p) => p.length > 3)
  const unmatchedSet = new Set((customParsed.unmatched || []).map((u) => u.toLowerCase()))

  return phrases.map((phrase) => {
    const phraseTokens = tokenize(phrase)
    let profileName = null
    let matchedKeyword = null

    for (const m of customParsed.matched || []) {
      const kw = (m.matchedKeyword || '').toLowerCase()
      if (kw && phraseTokens.some((t) => t.includes(kw) || kw.includes(t))) {
        profileName = m.name
        matchedKeyword = m.matchedKeyword
        break
      }
    }

    if (!profileName) {
      for (const { ids, keywords } of RULES) {
        for (const kw of keywords) {
          const needle = kw.toLowerCase()
          if (phraseTokens.some((t) => t.includes(needle) || needle.includes(t))) {
            matchedKeyword = kw
            profileName = profilesById.get(ids[0])?.name ?? null
            break
          }
        }
        if (profileName) break
      }
    }

    return {
      phrase,
      profileName,
      matchedKeyword,
      unmatched: !profileName && unmatchedSet.has(phrase.toLowerCase()),
    }
  })
}

export { useCaseProfiles }
