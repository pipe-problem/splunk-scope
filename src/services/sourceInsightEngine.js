/**
 * Source Insight Engine
 * Powers the "More Info" panel for every data source.
 * Generates dynamic context-aware recommendations, gap analysis,
 * dependency status, and value assessment — all before source selection.
 */

import { calculateSourcePriority, DOMAIN_CATEGORIES } from './coverageEngine.js'
import { calculateSourceSize } from './sizingEngine.js'
import { getAppsForSource } from './appCatalogService.js'
import sourceCatalog from '../data/sources.json' with { type: 'json' }

const NOISE_LEVELS = {
  firewalls: 'high',
  proxy_web_gateway: 'high',
  dns_logs: 'high',
  dhcp_logs: 'medium',
  windows_security_logs: 'high',
  linux_audit_logs: 'medium',
  ad_domain_controllers: 'high',
  crowdstrike: 'medium',
  microsoft_defender_endpoint: 'medium',
  okta: 'low',
  azure_ad: 'low',
  aws_cloudtrail: 'medium',
  o365_audit_logs: 'medium',
  custom_application_logs: 'variable',
}

const AI_ML_OPPORTUNITIES = {
  authentication: 'Anomalous login detection, impossible travel, credential stuffing identification',
  endpoint: 'Behavioral analytics, process chain analysis, fileless malware detection',
  network: 'Traffic baseline anomalies, DGA detection, beaconing identification',
  cloud_control_plane: 'Configuration drift detection, policy violation prediction',
  infrastructure_metrics: 'Capacity forecasting, anomaly detection, predictive failure analysis',
  application_logs: 'Error pattern prediction, performance degradation forecasting',
  application_traces: 'Service dependency mapping, bottleneck identification',
  business_transactions: 'Fraud detection, revenue anomaly alerting',
  database_activity: 'Data exfiltration detection, query pattern anomalies',
}

/**
 * Generate full insight payload for a source.
 */
export function generateSourceInsight(source, useCases, currentCoverage, sourceStates, allSources) {
  const estimate = calculateSourceSize(source, sourceStates[source.id] || {}, {
    catalog: sourceCatalog,
    allInputs: sourceStates,
  })
  const priority = calculateSourcePriority(source, useCases, currentCoverage, estimate.expected)

  return {
    overview: buildOverview(source),
    whyItMatters: buildWhyItMatters(source, useCases),
    telemetryDomains: buildDomainDetail(source),
    splunkApps: buildAppsList(source),
    splunkAppsPowered: buildAppsList(source),
    collectionMethods: buildCollectionMethods(source),
    technologyAddons: buildTechnologyAddons(source),
    catalogProducts: buildCatalogProductGuidance(source),
    requiredTAs: source.technicalAddons || [],
    dataCharacteristics: buildDataCharacteristics(source),
    ingestDrivers: buildIngestDrivers(source),
    recommendation: buildRecommendation(source, priority, estimate, useCases, currentCoverage),
    dependencies: buildDependencies(source, sourceStates, allSources),
    aiMlOpportunities: buildAIMLOpportunities(source),
    prosCons: buildProsCons(source, estimate, priority),
  }
}

function buildOverview(source) {
  const lines = [source.description || `${source.name} provides telemetry for Splunk analysis.`]
  const domainCount = Object.keys(source.telemetryDomains || {}).length
  if (domainCount > 0) {
    lines.push(`Contributes to ${domainCount} telemetry domain${domainCount > 1 ? 's' : ''}.`)
  }
  return lines.join(' ')
}

function buildWhyItMatters(source, useCases) {
  const reasons = []
  const domains = source.telemetryDomains || {}

  for (const uc of useCases || []) {
    const required = uc.requiredDomains || []
    const overlap = required.filter((d) => domains[d])
    if (overlap.length > 0) {
      reasons.push(`Supports "${uc.name}" by providing ${overlap.length} required telemetry domain${overlap.length > 1 ? 's' : ''}.`)
    }
  }

  if (reasons.length === 0) {
    reasons.push('This source provides additional telemetry enrichment across your architecture.')
  }

  return reasons
}

function buildDomainDetail(source) {
  const domains = source.telemetryDomains || {}
  return Object.entries(domains).map(([domain, strength]) => {
    let categoryName = 'Other'
    for (const [cat, doms] of Object.entries(DOMAIN_CATEGORIES)) {
      if (doms.includes(domain)) { categoryName = cat; break }
    }
    return { domain, strength, category: categoryName, label: domain.replace(/_/g, ' ') }
  })
}

function buildAppsList(source) {
  const raw = source.splunkApps || [];
  return raw
    .filter((app) => {
      const name = typeof app === 'string' ? app : app?.name || '';
      return !/add-on|addon|connect for|db connect/i.test(name);
    })
    .map((app) => (typeof app === 'string' ? { name: app } : app));
}

function buildCollectionMethods(source) {
  const category = source.category || '';
  if (/Security & Compliance/i.test(category) && /edr/i.test(source.id)) {
    return ['API / modular input (vendor add-on)', 'HEC (FDR / streaming where supported)'];
  }
  if (source.id === 'active_directory' || source.id === 'windows_servers') {
    return ['Universal Forwarder'];
  }
  if (source.id === 'saas_sso') {
    return ['IdP API / vendor add-on (Okta, Entra ID, Ping)', 'Syslog (where vendor supports)'];
  }
  if (source.id === 'saas_office') {
    return ['Microsoft 365 / Cloud Services add-on (API)', 'HEC for high-volume workloads'];
  }
  if (source.id === 'iaas_containers') {
    return ['Splunk Connect for Kubernetes', 'OpenTelemetry Collector', 'HEC / platform log forwarding'];
  }
  if (/Networking|firewall|vpn|proxy|ids/i.test(source.name || '') || source.id === 'firewalls') {
    return ['Syslog / Splunk Connect for Syslog (SC4S)'];
  }
  if (source.id === 'vuln_mgmt') {
    return ['Tenable / Qualys / Rapid7 API or supported add-on'];
  }
  return (source.technicalAddons || []).slice(0, 2).map((ta) => `Technology add-on: ${ta}`);
}

function buildTechnologyAddons(source) {
  const names = new Set();
  for (const ta of source.technicalAddons || []) {
    if (ta) names.add(typeof ta === 'string' ? ta : ta.name || String(ta));
  }
  const guidance = buildCatalogProductGuidance(source);
  for (const ta of guidance.technicalAddons || []) {
    if (ta?.name) names.add(ta.name);
  }
  if (source.id === 'active_directory' || source.id === 'windows_servers') {
    names.add('Splunk Add-on for Microsoft Windows');
  }
  if (source.id === 'edr') {
    names.add('Splunk Add-on for CrowdStrike');
  }
  return [...names].slice(0, 6).map((name) => ({ name }));
}

function buildCatalogProductGuidance(source) {
  const related = getAppsForSource(source.id)
  const solutions = related.filter((a) => a.type === 'premium_solution' || a.type === 'free_app' || a.type === 'splunkbase_app')
  const technicalAddons = related.filter((a) => a.type === 'technical_addon' || a.type === 'connector')
  const dependencies = related.filter((a) => a.type === 'prerequisite' || a.type === 'content_pack')
  return {
    relatedSolutions: solutions.map((a) => ({
      id: a.id,
      name: a.displayName,
      type: a.type,
      note: a.customerDescription || '',
    })),
    technicalAddons: technicalAddons.map((a) => ({
      id: a.id,
      name: a.displayName,
      note: a.recommendationCaveat || '',
    })),
    dependencies: dependencies.map((a) => ({
      id: a.id,
      name: a.displayName,
      note: a.recommendationCaveat || '',
    })),
  }
}

function buildDataCharacteristics(source) {
  const noiseLevel = NOISE_LEVELS[source.id] || 'medium'
  const types = []
  if (source.ingestType) types.push(source.ingestType)
  if (source.sizing_formula?.strategy === 'per_user') types.push('Volume scales with user count')
  if (source.sizing_formula?.strategy === 'per_system') types.push('Volume scales with device/system count')

  return {
    noiseLevel,
    ingestTypes: types.length > 0 ? types : ['Event-based logging'],
    avgEventSize: source.avgEventSize || null,
    burstiness: noiseLevel === 'high' ? 'Bursty — volume spikes during active periods' : 'Relatively steady',
  }
}

function buildIngestDrivers(source) {
  const drivers = []
  const formula = source.sizing_formula || {}
  if (formula.primary_input) {
    drivers.push(`Primary driver: ${formula.primary_input.replace(/_/g, ' ')}`)
  }
  if (formula.rate_per_unit) {
    drivers.push(`Base rate: ~${formula.rate_per_unit} GB/day per unit`)
  }

  const fields = source.input_fields || []
  const scopeField = fields.find((f) => f.key === 'logging_scope' || f.key === 'audit_level')
  if (scopeField) {
    drivers.push(`Logging scope significantly affects volume`)
  }

  return drivers
}

function buildRecommendation(source, priority, estimate, useCases, currentCoverage) {
  const isRecommended = priority.score >= 15
  const reasons = priority.reasons.length > 0 ? priority.reasons : ['Adds supplementary telemetry']

  const gapsFilled = []
  for (const [domain, strength] of Object.entries(source.telemetryDomains || {})) {
    if (strength === 'strong' && (!currentCoverage?.[domain] || currentCoverage[domain].score < 0.75)) {
      gapsFilled.push(domain.replace(/_/g, ' '))
    }
  }

  let stage = 'run'
  if (priority.score >= 40) stage = 'crawl'
  else if (priority.score >= 20) stage = 'walk'

  return {
    recommended: isRecommended,
    reasons,
    gapsFilled,
    overlapWarning: gapsFilled.length === 0 && priority.score < 10
      ? 'Existing sources may already cover these domains'
      : null,
    priorityScore: priority.score,
    stage,
  }
}

function buildDependencies(source, sourceStates, allSources) {
  const deps = source.dependencies || []
  if (deps.length === 0) return { hasDependencies: false, items: [] }

  const items = deps.map((depId) => {
    const depSource = (allSources || []).find((s) => s.id === depId)
    const depState = sourceStates[depId]
    return {
      id: depId,
      name: depSource?.name || depId,
      status: depState?.status || 'not configured',
      met: depState?.status === 'current' || depState?.status === 'future',
    }
  })

  return { hasDependencies: true, items }
}

function buildAIMLOpportunities(source) {
  const opportunities = []
  for (const [domain] of Object.entries(source.telemetryDomains || {})) {
    if (AI_ML_OPPORTUNITIES[domain]) {
      opportunities.push({ domain: domain.replace(/_/g, ' '), description: AI_ML_OPPORTUNITIES[domain] })
    }
  }
  return opportunities
}

function buildProsCons(source, estimate, priority) {
  const pros = []
  const cons = []

  if (priority.score >= 30) pros.push('High priority for selected use cases')
  if (priority.score >= 15 && priority.score < 30) pros.push('Moderate priority for planning context')

  const domains = Object.entries(source.telemetryDomains || {})
  const strongCount = domains.filter(([, s]) => s === 'strong').length
  if (strongCount >= 2) pros.push(`Strong coverage across ${strongCount} domains`)

  if (estimate.expected > 0 && estimate.expected < 5) pros.push('Low ingest footprint')
  if (estimate.expected > 50) cons.push('High ingest volume — ensure budget alignment')

  if (estimate.confidence === 'low') cons.push('Low confidence estimate — refine inputs for better accuracy')
  if (estimate.confidence === 'none') cons.push('No estimate available — manual input recommended')

  if (source.dependencies?.length > 0) cons.push(`Depends on ${source.dependencies.length} other source(s)`)

  const noiseLevel = NOISE_LEVELS[source.id]
  if (noiseLevel === 'high') cons.push('High noise level — consider filtering or summarization')

  if (pros.length === 0) pros.push('Adds telemetry diversity')

  return { pros, cons }
}
