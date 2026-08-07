/**
 * Sizing Engine
 * Calculates estimated daily ingest ranges for data sources.
 * Supports multi-input formulas, vendor multipliers, scope modifiers,
 * manual overrides, and confidence scoring.
 */

import sizingRates from '../data/sizingRates.json' with { type: 'json' }
import { calculatePlanningTotals, PLANNING_BUFFER_FRACTION } from '../utils/bufferBand.js'
import { calculateIaasSizing } from './iaasSizingEngine.js'
import { calculateContainerSizing } from './containerSizingEngine.js'
import { calculateCloudVmSizing } from './cloudVmSizingEngine.js'
import { calculateCloudStorageSizing } from './cloudStorageSizingEngine.js'
import { calculateSaaSSizing } from './saasSizingEngine.js'
import { calculateOfficeProductivitySizing } from './officeProductivitySizingEngine.js'
import { calculateCrmSizing } from './crmSizingEngine.js'
import { calculateSsoIdentitySizing } from './ssoIdentitySizingEngine.js'
import {
  calculateWorkbookSimpleSizing,
  applyWorkbookSimpleToResult,
  shouldUseWorkbookSimpleSizing,
  shouldRunCompositeEngine,
} from './workbookSimpleSizing.js'
import { parseCount, normalizeIaasState } from './iaasSizingEngine.js'
import { normalizeSaaSState } from './saasSizingEngine.js'

export { PLANNING_BUFFER_FRACTION, applyPlanningBufferToSource, calculatePlanningTotals } from '../utils/bufferBand.js'

const RATES = sizingRates.rates || {}

const RATE_ALIASES = {
  firewalls: 'firewall_logs',
  edr: 'edr_logs',
  active_directory: 'active_directory_security',
  vpn: 'vpn_logs',
  proxy: 'proxy_web_gateway',
  dns: 'dns_logs',
  netflow: 'netflow_data',
  vuln_mgmt: 'vulnerability_scanner',
  saas_office: 'm365_audit_logs',
  saas_sso: 'okta_sso',
}

/** Vendor skew when catalog has no tier for this vendor (preserves legacy behavior). */
function legacyVendorMultiplier(vendor) {
  if (!vendor) return 1.0
  const legacy = {
    'Palo Alto Networks': 1.3,
    Fortinet: 0.9,
    'Cisco ASA/FTD': 1.1,
    'Check Point': 1.0,
    'CrowdStrike Falcon': 1.15,
    'Microsoft Defender for Endpoint': 0.85,
    SentinelOne: 1.0,
  }
  return legacy[vendor] ?? 1.0
}

function getScopeMultiplierRegex(scope) {
  if (!scope) return 1.0
  const rules = [
    { pattern: /full|verbose|all|complete/i, factor: 1.5 },
    { pattern: /traffic.*threat|ddl.*dml|security.*system.*application|sign-in.*admin.*full/i, factor: 1.2 },
    { pattern: /traffic|auth.*syslog|security.*system|sign-in.*admin/i, factor: 1.0 },
    { pattern: /basic|only|minimal|connection|auth.*only|security only/i, factor: 0.6 },
    { pattern: /unknown/i, factor: 1.0 },
  ]
  for (const { pattern, factor } of rules) {
    if (pattern.test(scope)) return factor
  }
  return 1.0
}

function normalizeScopeToken(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\+/g, ' ')
    .replace(/\s+/g, ' ')
}

/**
 * Match UI/logging scope strings to sizingRates scopeMultipliers keys.
 */
function getScopeMultiplierFromCatalog(scope, catalogEntry) {
  if (!scope || !catalogEntry?.scopeMultipliers) return null
  const s = normalizeScopeToken(scope)
  const mults = catalogEntry.scopeMultipliers
  let best = null
  let bestScore = -1
  for (const [key, factor] of Object.entries(mults)) {
    const tokens = key
      .toLowerCase()
      .split('_')
      .filter((t) => t && t !== 'and')
    if (!tokens.length) continue
    const hits = tokens.filter((t) => s.includes(t)).length
    if (hits === tokens.length) {
      const score = tokens.length + (key.length > 0 ? 0.1 : 0)
      if (score > bestScore) {
        bestScore = score
        best = factor
      }
    }
  }
  return best
}

function getScopeMultiplier(scope, catalogEntry) {
  const fromCatalog = getScopeMultiplierFromCatalog(scope, catalogEntry)
  if (fromCatalog != null) return fromCatalog
  return getScopeMultiplierRegex(scope)
}

export { getScopeMultiplier }

/**
 * Resolve sizing rate with vendor/model cascade against a catalog rates entry.
 *
 * Priority 1: vendor + model (vendorRates[vendor].models[model])
 * Priority 2: vendor (vendorRates[vendor])
 * Priority 3: source-level fields on the resolved rates[sourceId] entry
 * Priority 4: same cascade against rates[RATE_ALIASES[sourceId]] when sourceId has no entry
 * Priority 5: null
 */
export function lookupSizingRate(sourceId, vendor, model) {
  if (sourceId == null || sourceId === '') return null

  let entry = RATES[sourceId]
  let resolvedKey = sourceId
  let viaAlias = false

  if (!entry) {
    const aliased = RATE_ALIASES[sourceId]
    if (aliased && RATES[aliased]) {
      entry = RATES[aliased]
      resolvedKey = aliased
      viaAlias = true
    }
  }

  if (!entry) return null

  const v = vendor ? String(vendor) : ''
  const m = model ? String(model) : ''

  if (v && entry.vendorRates?.[v]) {
    const vr = entry.vendorRates[v]
    if (m && vr.models?.[m]) {
      return {
        catalogEntry: entry,
        rateSlice: vr.models[m],
        layer: 'model_specific',
        resolvedKey,
        viaAlias,
      }
    }
    return {
      catalogEntry: entry,
      rateSlice: vr,
      layer: 'vendor_specific',
      resolvedKey,
      viaAlias,
    }
  }

  return {
    catalogEntry: entry,
    rateSlice: entry,
    layer: 'source_specific',
    resolvedKey,
    viaAlias,
  }
}

function tierFromSlice(slice) {
  if (!slice) return {}
  const low = typeof slice.low === 'number' ? slice.low : undefined
  const medium =
    typeof slice.medium === 'number'
      ? slice.medium
      : typeof slice.baseRate === 'number'
        ? slice.baseRate
        : undefined
  const high = typeof slice.high === 'number' ? slice.high : undefined
  return { low, medium, high }
}

function hasExplicitLowMediumHigh(slice) {
  const t = tierFromSlice(slice)
  return (
    typeof t.low === 'number'
    && typeof t.medium === 'number'
    && typeof t.high === 'number'
  )
}

function resolveRateSourceLabel(layer, viaAlias) {
  if (viaAlias && layer === 'source_specific') return 'category_fallback'
  return layer
}

function vendorMultiplierForSource(layer, catalogEntry, vendor) {
  if (layer === 'model_specific' || layer === 'vendor_specific') return 1.0
  if (!vendor || !catalogEntry?.vendorRates?.[vendor]) {
    return legacyVendorMultiplier(vendor)
  }
  return 1.0
}

export function flattenSourceCatalog(nodes, inherited = {}) {
  const flat = []
  for (const node of nodes) {
    const merged = { ...node }
    if (inherited.telemetryDomains && !merged.telemetryDomains) {
      merged.telemetryDomains = inherited.telemetryDomains
    }
    if (inherited.category && !merged.category) merged.category = inherited.category
    flat.push(merged)
    if (node.children?.length) {
      flat.push(...flattenSourceCatalog(node.children, {
        telemetryDomains: merged.telemetryDomains,
        category: merged.category,
        subcategory: merged.subcategory,
      }))
    }
  }
  return flat
}

/** Find a catalog node by id (searches full tree including nested children). */
export function findCatalogNode(nodes, id) {
  if (!nodes || !id) return null
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) {
      const hit = findCatalogNode(n.children, id)
      if (hit) return hit
    }
  }
  return null
}

/** True if any direct or nested child source is Active/Planned in session input. */
export function hasActiveChildBranch(node, allInputs) {
  if (!node?.children?.length) return false
  for (const ch of node.children) {
    const st = allInputs[ch.id]?.status
    if (st === 'current' || st === 'future') return true
    if (hasActiveChildBranch(ch, allInputs)) return true
  }
  return false
}

/** True when this source id or any of its catalog descendants is Active/Planned. */
export function isBranchActiveInSession(sourceId, allInputs, catalogRoots) {
  const st = allInputs[sourceId]?.status
  if (st === 'current' || st === 'future') return true
  const node = findCatalogNode(catalogRoots, sourceId)
  if (!node?.children?.length) return false
  return node.children.some((c) => isBranchActiveInSession(c.id, allInputs, catalogRoots))
}

/**
 * True when the parent has direct sizing inputs (additive panel fields, counts, manual override).
 * When true, parent is sized on its own inputs even if child sources are Active/Planned.
 */
export function parentHasDirectSizingInputs(source, inputState) {
  if (!source || !inputState) return false

  const override = parseFloat(inputState.override || inputState.manual_gb_day)
  if (override > 0) return true

  if (source.id === 'saas_general') {
    const s = normalizeSaaSState(inputState)
    return parseCount(s.saasTenantCount) > 0
      || parseCount(s.saasActiveUsers) > 0
      || parseCount(s.saasIntegrationCount) > 0
  }

  if (source.id === 'iaas') {
    const s = normalizeIaasState(inputState)
    if (parseCount(s.iaasAccountCount) > 0) return true
    const adv = s.iaasAdvancedCounts || {}
    return Object.values(adv).some((v) => parseCount(v) > 0)
  }

  if (source.id === 'firewalls') {
    return parseCount(inputState.number_of_systems) > 0
      || parseCount(inputState.count) > 0
      || parseCount(inputState.number_of_users) > 0
      || Boolean(inputState.logging_scope || inputState.traffic_level)
  }

  const formula = source.sizing_formula || {}
  const primaryKey = formula.primary_input || 'count'
  if (parseCount(inputState[primaryKey]) > 0) return true

  const deviceLikePrimary = /systems|devices|servers|endpoints|dcs|sensors|collectors/.test(primaryKey)
  const fallbackKeys = [
    'number_of_dcs', 'number_of_users', 'number_of_systems', 'number_of_servers',
    'number_of_endpoints', 'number_of_devices', 'number_of_instances',
    'number_of_accounts', 'number_of_applications', 'number_of_clusters',
  ].filter((key) => key !== primaryKey && !(deviceLikePrimary && key === 'number_of_users'))

  return fallbackKeys.some((key) => parseCount(inputState[key]) > 0)
}

/** True when this source id is a parent row rolled up to active children (no direct parent inputs). */
export function isCatalogParentRolledUp(catalogRoots, allInputs, sourceId) {
  if (!catalogRoots || !allInputs || !sourceId) return false
  const treeNode = findCatalogNode(catalogRoots, sourceId)
  if (!treeNode?.children?.length || !hasActiveChildBranch(treeNode, allInputs)) return false
  return !parentHasDirectSizingInputs(treeNode, allInputs[sourceId] || {})
}

/**
 * Calculate estimated ingest for a single source.
 * When `sizingContext.catalog` and `sizingContext.allInputs` are set, a parent catalog row
 * with any Active/Planned child returns zero GB/day (rollup to children only).
 *
 * Returns: { low, expected, high, confidence, assumptions, warnings, rateSource, needsReview, countBasis, vendorMultiplier, scopeMultiplier, bufferApplied }
 */
export function calculateSourceSize(source, inputState, sizingContext) {
  const result = {
    low: 0,
    expected: 0,
    high: 0,
    confidence: 'none',
    assumptions: [],
    warnings: [],
    rateSource: 'catalog_formula',
    needsReview: false,
    countBasis: '',
    vendorMultiplier: 1.0,
    scopeMultiplier: 1.0,
    bufferApplied: false,
  }
  if (!inputState) return result

  const cat = sizingContext?.catalog
  const sessionInputs = sizingContext?.allInputs
  if (cat && sessionInputs && source?.id) {
    const treeNode = findCatalogNode(cat, source.id)
    if (
      treeNode?.children?.length
      && hasActiveChildBranch(treeNode, sessionInputs)
      && !parentHasDirectSizingInputs(treeNode, inputState)
    ) {
      return {
        ...result,
        assumptions: ['Rolled up through configured child sources — size child cards or add direct inputs on the parent.'],
        rateSource: 'rollup_children',
      }
    }
  }

  const override = parseFloat(inputState.override || inputState.manual_gb_day)
  if (override && override > 0) {
    result.low = override * 0.9
    result.expected = override
    result.high = override * 1.1
    result.confidence = 'medium'
    result.assumptions.push('Manual estimate provided by SE')
    result.rateSource = 'manual'
    result.needsReview = false
    result.countBasis = 'manual_gb_day'
    return result
  }

  if (source?.id && shouldUseWorkbookSimpleSizing(source.id, inputState, source.sizing_formula?.primary_input)) {
    const simple = calculateWorkbookSimpleSizing(
      source.id,
      inputState,
      source.sizing_formula?.primary_input,
    )
    if (simple) {
      return applyWorkbookSimpleToResult({ ...result }, simple, source.id)
    }
  }

  if (shouldRunCompositeEngine(source.id, inputState, source.sizing_formula?.primary_input)) {
  if (source.id === 'iaas') {
    return calculateIaasSizing(inputState, sizingContext)
  }

  if (source.id === 'iaas_containers') {
    return calculateContainerSizing(inputState, sizingContext)
  }

  if (source.id === 'iaas_instances') {
    return calculateCloudVmSizing(inputState, sizingContext)
  }

  if (source.id === 'iaas_storage') {
    return calculateCloudStorageSizing(inputState, sizingContext)
  }

  if (source.id === 'saas_general') {
    return calculateSaaSSizing(inputState, sizingContext)
  }

  if (source.id === 'saas_office') {
    return calculateOfficeProductivitySizing(inputState, sizingContext)
  }

  if (source.id === 'saas_crm') {
    return calculateCrmSizing(inputState, sizingContext)
  }

  if (source.id === 'saas_sso') {
    return calculateSsoIdentitySizing(inputState, sizingContext)
  }
  }

  if (source.id === 'dlp') {
    const monitoredUsers = parseCount(inputState.number_of_users)
    const channels = parseCount(inputState.number_of_channels)
    const profile = inputState.dlpSizingProfile || 'user_and_channel'
    if (profile !== 'lookup_context' && profile !== 'channel_products' && monitoredUsers <= 0) {
      // Guardrail engine handles channel-only profile; allow sizing to proceed for guardrail pass
      if (channels <= 0) {
        result.confidence = 'none'
        result.warnings.push('Missing monitored users')
        result.rateSource = 'catalog_formula'
        result.countBasis = 'monitored users'
        return result
      }
    }
  }

  if (source.id === 'firewalls') {
    const fwSystems = parseCount(inputState.number_of_systems) || parseCount(inputState.count)
    const fwUsers = parseCount(inputState.number_of_users)
    const fwTraffic = inputState.logging_scope || inputState.traffic_level
    if (!fwSystems && !fwUsers && !fwTraffic) {
      const treeNode = cat ? findCatalogNode(cat, source.id) : null
      const childActive = treeNode?.children?.length
        && hasActiveChildBranch(treeNode, sessionInputs || {})
      if (!childActive) {
        result.confidence = 'none'
        result.warnings.push('Missing firewall sizing inputs')
        result.rateSource = 'catalog_formula'
        result.countBasis = 'firewall devices / traffic'
        return result
      }
    }
    if (fwSystems > 0 && !fwUsers && !fwTraffic) {
      result.warnings.push('Firewall ingest is usually driven by traffic/users as much as device count.')
    }
  }

  const formula = source.sizing_formula || {}
  const primaryKey = formula.primary_input || 'count'
  const model =
    inputState.model
    || inputState.firewall_model
    || inputState.appliance_model
    || ''

  let primaryValue = parseFloat(inputState[primaryKey] || inputState.count || 0)
  let usedFallback = false

  if (!primaryValue || primaryValue <= 0) {
    const deviceLikePrimary = /systems|devices|servers|endpoints|dcs|sensors|collectors/.test(primaryKey)
    const fallbackKeys = [
      'number_of_dcs', 'number_of_users', 'number_of_systems', 'number_of_servers',
      'number_of_endpoints', 'number_of_devices', 'number_of_instances',
      'number_of_accounts', 'number_of_applications', 'number_of_clusters',
    ].filter((key) => key !== primaryKey && !(deviceLikePrimary && key === 'number_of_users'))
    for (const key of fallbackKeys) {
      if (inputState[key]) {
        const val = parseFloat(inputState[key])
        if (val > 0) {
          primaryValue = val
          usedFallback = true
          result.assumptions.push(`Used ${key.replace(/_/g, ' ')} as input (primary field empty)`)
          break
        }
      }
    }
  }

  if (!primaryValue || primaryValue <= 0) {
    result.confidence = 'none'
    result.warnings.push('No quantity inputs provided')
    result.rateSource = 'catalog_formula'
    result.countBasis = primaryKey.replace(/_/g, ' ')
    return result
  }

  const scope = inputState.logging_scope || inputState.audit_level || ''
  const vendor = inputState.vendor || ''

  if (source.id === 'edr') {
    const endpoints = parseFloat(inputState.number_of_endpoints || 0) || 0
    const servers = parseFloat(inputState.number_of_servers || 0) || 0
    const epCount = endpoints > 0 ? endpoints : (primaryKey === 'number_of_endpoints' ? primaryValue : 0)
    const srvCount = servers > 0 ? servers : 0
    if (epCount > 0 || srvCount > 0) {
      const lookupEdr = lookupSizingRate('edr', vendor, model)
      let epRate = formula.rate_per_unit || source.sizingRate || 0.012
      if (lookupEdr?.rateSlice) {
        const t = tierFromSlice(lookupEdr.rateSlice)
        if (typeof t.medium === 'number') epRate = t.medium
      }
      const srvRate = 0.025
      const catalogEntryEdr = lookupEdr?.catalogEntry
      const scopeMult = getScopeMultiplier(scope, catalogEntryEdr)
      const vendorMult = lookupEdr
        ? vendorMultiplierForSource(lookupEdr.layer, catalogEntryEdr, vendor)
        : legacyVendorMultiplier(vendor)
      const edrExpected = (epCount * epRate + srvCount * srvRate) * scopeMult * vendorMult
      result.vendorMultiplier = vendorMult
      result.scopeMultiplier = scopeMult
      result.expected = edrExpected
      result.low = edrExpected * 0.6
      result.high = edrExpected * 1.5
      result.confidence = vendor && scope ? 'high' : 'medium'
      result.countBasis = 'endpoint + server'
      result.rateSource = lookupEdr ? resolveRateSourceLabel(lookupEdr.layer, lookupEdr.viaAlias) : 'catalog_formula'
      result.assumptions.push(`${epCount} endpoints @ ${epRate} GB/day, ${srvCount} servers @ ${srvRate} GB/day`)
      if (scope) result.assumptions.push(`Scope: ${scope}`)
      if (vendor) result.assumptions.push(`Vendor: ${vendor}`)
      return result
    }
  }

  const lookup = source.id != null ? lookupSizingRate(source.id, vendor, model) : null

  const scopeMultiplier = getScopeMultiplier(scope, lookup?.catalogEntry)

  let baseRate = formula.rate_per_unit || source.sizingRate || 0.1
  let rateSlice = null
  let catalogEntry = null
  let rateLayer = null
  let viaAlias = false
  let inputMatchesRateUnit = false

  if (lookup) {
    catalogEntry = lookup.catalogEntry
    rateSlice = lookup.rateSlice
    rateLayer = lookup.layer
    viaAlias = lookup.viaAlias
    const rateUnit = rateSlice?.unit || catalogEntry?.unit || ''
    inputMatchesRateUnit = !rateUnit
      || primaryKey === 'count'
      || primaryKey.includes(rateUnit.replace(/s$/, ''))
      || rateUnit.includes(primaryKey.replace(/^number_of_/, '').replace(/s$/, ''))
    if (inputMatchesRateUnit) {
      const t = tierFromSlice(rateSlice)
      if (typeof t.medium === 'number') baseRate = t.medium
    }
  }

  const vendorMultiplier = lookup
    ? vendorMultiplierForSource(rateLayer, catalogEntry, vendor)
    : legacyVendorMultiplier(vendor)

  result.vendorMultiplier = vendorMultiplier
  result.scopeMultiplier = scopeMultiplier

  result.rateSource = lookup
    ? resolveRateSourceLabel(rateLayer, viaAlias)
    : 'catalog_formula'
  result.needsReview = !!(lookup?.catalogEntry?.needsReview)
  if (lookup && inputMatchesRateUnit) {
    const unitHint = rateSlice?.unit || catalogEntry?.unit
    result.countBasis = unitHint || primaryKey.replace(/_/g, ' ').replace('number of ', '')
  } else {
    result.countBasis = primaryKey.replace(/_/g, ' ').replace('number of ', '')
  }

  const hasExplicit = lookup && rateSlice && inputMatchesRateUnit && hasExplicitLowMediumHigh(rateSlice)
  let expected
  let lowVal
  let highVal

  if (hasExplicit) {
    const { low: rl, medium: rm, high: rh } = tierFromSlice(rateSlice)
    lowVal = primaryValue * rl * scopeMultiplier * vendorMultiplier
    expected = primaryValue * rm * scopeMultiplier * vendorMultiplier
    highVal = primaryValue * rh * scopeMultiplier * vendorMultiplier
  } else {
    expected = primaryValue * baseRate * scopeMultiplier * vendorMultiplier
    let bandLow = 0.6
    let bandHigh = 1.5

    if (usedFallback) {
      bandLow = 0.4
      bandHigh = 2.0
      result.assumptions.push('Wider range due to fallback input')
    } else if (vendor && scope) {
      bandLow = 0.8
      bandHigh = 1.3
      result.assumptions.push('Narrowed range: vendor and scope provided')
    } else if (vendor || scope) {
      bandLow = 0.7
      bandHigh = 1.4
    }

    lowVal = expected * bandLow
    highVal = expected * bandHigh
  }

  let confidence = 'medium'
  if (usedFallback) confidence = 'low'
  else if (vendor && scope) confidence = 'high'
  else if (vendor || scope) confidence = 'medium'
  if (hasExplicit && catalogEntry?.confidence) confidence = catalogEntry.confidence
  result.confidence = confidence

  result.low = lowVal
  result.expected = expected
  result.high = highVal

  if (scope) result.assumptions.push(`Scope: ${scope}`)
  if (vendor) result.assumptions.push(`Vendor: ${vendor}`)

  if (lookup && rateLayer) {
    const t = tierFromSlice(rateSlice)
    const brLine =
      hasExplicit
        ? `Catalog bands (low/medium/high): ${t.low} / ${t.medium} / ${t.high} GB/day per ${result.countBasis}`
        : `Base rate: ${baseRate} GB/day per ${result.countBasis}`
    result.assumptions.push(brLine)
  } else {
    result.assumptions.push(`Base rate: ${baseRate} GB/day per ${primaryKey.replace(/_/g, ' ').replace('number of ', '')}`)
  }

  if (source.id === 'desktops' && sessionInputs?.edr) {
    const edrSt = sessionInputs.edr
    if (edrSt.status === 'current' || edrSt.status === 'future') {
      result.low *= 0.25
      result.expected *= 0.25
      result.high *= 0.25
      result.assumptions.push('×0.25 overlap adjustment — EDR already configured for endpoint telemetry')
    }
  }

  return result
}

/**
 * Calculate total ingest from all source results.
 * Each source: low/high = ±PLANNING_BUFFER_FRACTION (20%) around its planning `expected`.
 * Totals: sum of per-source low, expected, and high (not buffer applied only to aggregate).
 * @param {Record<string, { expected?: number }>} sourceResults
 * @param {number} [_bufferPercent] - ignored; fixed 20% planning buffer (session compat only)
 */
export function calculateTotals(sourceResults, _bufferPercent = PLANNING_BUFFER_FRACTION) {
  return calculatePlanningTotals(sourceResults)
}

/**
 * Compute storage estimate.
 */
export function calculateStorage(expectedGBPerDay, retentionDays = 90, compressionFactor = 0.5) {
  const rawGB = expectedGBPerDay * retentionDays
  const compressedGB = rawGB * compressionFactor
  return { rawGB, compressedGB, retentionDays, compressionFactor }
}

/**
 * Compute value_per_gb for a source.
 */
export function calculateValuePerGB(source, coverageContribution, expectedGB) {
  if (!expectedGB || expectedGB <= 0) return 0
  return coverageContribution / expectedGB
}

/**
 * Size all active sources in a session.
 */
export function sizeAllSources(catalog, allInputs) {
  const results = {}
  const flat = flattenSourceCatalog(catalog)

  for (const source of flat) {
    const inputs = allInputs[source.id]
    if (!inputs || (inputs.status !== 'current' && inputs.status !== 'future')) continue
    results[source.id] = calculateSourceSize(source, inputs, { catalog, allInputs })
  }

  for (const [id, inputs] of Object.entries(allInputs)) {
    if (!id.startsWith('custom_')) continue
    if (inputs.status !== 'current' && inputs.status !== 'future') continue
    results[id] = calculateSourceSize(
      { sizing_formula: { primary_input: 'count', rate_per_unit: inputs.sizingRate || 0.1 } },
      inputs,
    )
  }

  return results
}
