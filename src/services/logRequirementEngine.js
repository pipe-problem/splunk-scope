/**
 * Resolves log capability requirements from use cases and Splunk apps, and checks
 * whether active sources satisfy those capabilities.
 */

import logRequirementsData from '../data/logRequirements.json' with { type: 'json' }
import appRequirementsData from '../data/appRequirements.json' with { type: 'json' }

const { logCapabilities } = logRequirementsData
const appsRegistry = appRequirementsData.apps || {}

const STRENGTH_ORDER = { strong: 3, partial: 2, minimal: 1 }
const SATISFIED_RANK = STRENGTH_ORDER.strong

/** @type {Record<string, string | null>} */
const APP_KEY_ALIASES = {
  splunk_es: 'splunk_enterprise_security',
  enterprise_security: 'splunk_enterprise_security',
  es: 'splunk_enterprise_security',
  soar: 'splunk_soar',
  splunk_soar_cloud: 'splunk_soar',
  user_behavior_analytics: 'splunk_uba',
  uba: 'splunk_uba',
  observability_cloud: 'splunk_observability',
  splunk_observability_cloud: 'splunk_observability',
  it_service_intelligence: 'itsi',
  itsi: 'itsi',
  security_essentials: null,
}

const capabilitiesByDomain = (() => {
  /** @type {Record<string, string[]>} */
  const map = {}
  for (const cap of Object.values(logCapabilities)) {
    const dom = cap.domain
    if (!map[dom]) map[dom] = []
    map[dom].push(cap.id)
  }
  return map
})()

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Map intake / catalog app identifiers and display names to `appRequirements` keys.
 * @param {string} raw
 * @returns {string | null}
 */
export function resolveAppRequirementKey(raw) {
  if (!raw || typeof raw !== 'string') return null
  if (raw.startsWith('custom:')) return null

  const trimmed = raw.trim()
  if (appsRegistry[trimmed]) return trimmed

  const lower = trimmed.toLowerCase()
  const directKey = Object.keys(appsRegistry).find((k) => k.toLowerCase() === lower)
  if (directKey) return directKey

  if (Object.prototype.hasOwnProperty.call(APP_KEY_ALIASES, lower)) {
    return APP_KEY_ALIASES[lower]
  }

  const slug = slugify(trimmed)
  const slugKey = Object.keys(appsRegistry).find((k) => slugify(k) === slug)
  if (slugKey) return slugKey

  for (const [key, app] of Object.entries(appsRegistry)) {
    if (!app?.name) continue
    const nameLower = app.name.toLowerCase()
    const baseName = app.name.split('(')[0].trim().toLowerCase()
    if (
      nameLower === lower ||
      baseName === lower ||
      nameLower.includes(lower) ||
      (lower.length >= 6 && baseName.includes(lower))
    ) {
      return key
    }
  }

  return null
}

/**
 * @param {string[]} desiredApps
 * @param {object[]} useCases
 * @returns {Set<string>}
 */
function collectResolvedAppKeys(desiredApps, useCases) {
  const keys = new Set()
  for (const id of desiredApps || []) {
    const k = resolveAppRequirementKey(id)
    if (k) keys.add(k)
  }
  for (const uc of useCases || []) {
    for (const label of uc.splunkApps || []) {
      const k = resolveAppRequirementKey(label)
      if (k) keys.add(k)
    }
  }
  return keys
}

/**
 * @typedef {{ capabilityId: string, name: string, domain: string, satisfiedBy: string[], reason: string }} LogRequirementEntry
 */

/**
 * Merge capability IDs from apps and use-case domains into required / recommended / optional tiers.
 *
 * @param {object[]} useCases
 * @param {string[]} desiredApps
 * @returns {{ required: LogRequirementEntry[], recommended: LogRequirementEntry[], optional: LogRequirementEntry[] }}
 */
export function resolveLogRequirements(useCases, desiredApps) {
  /** @type {Map<string, 'required' | 'recommended' | 'optional'>} */
  const tierByCap = new Map()
  /** @type {Map<string, string[]>} */
  const reasonsByCap = new Map()

  function addReason(capId, reason) {
    if (!reasonsByCap.has(capId)) reasonsByCap.set(capId, [])
    reasonsByCap.get(capId).push(reason)
  }

  function setTier(capId, tier, reason) {
    const rank = { required: 3, recommended: 2, optional: 1 }
    const prev = tierByCap.get(capId)
    if (!prev || rank[tier] > rank[prev]) {
      tierByCap.set(capId, tier)
      addReason(capId, reason)
    } else if (prev === tier) {
      addReason(capId, reason)
    }
  }

  for (const uc of useCases || []) {
    const ucLabel = uc.name || uc.id || 'use case'
    for (const d of uc.requiredDomains || []) {
      for (const capId of capabilitiesByDomain[d] || []) {
        setTier(capId, 'required', `Domain "${d}" required by ${ucLabel}`)
      }
    }
    for (const d of uc.recommendedDomains || []) {
      for (const capId of capabilitiesByDomain[d] || []) {
        if (tierByCap.get(capId) !== 'required') {
          setTier(capId, 'recommended', `Domain "${d}" recommended by ${ucLabel}`)
        }
      }
    }
  }

  const appKeys = collectResolvedAppKeys(desiredApps, useCases)
  for (const appKey of appKeys) {
    const app = appsRegistry[appKey]
    if (!app) continue
    const appName = app.name || appKey
    for (const capId of app.requiredLogCapabilities || []) {
      setTier(capId, 'required', `Required by ${appName}`)
    }
    for (const capId of app.recommendedLogCapabilities || []) {
      if (tierByCap.get(capId) !== 'required') {
        setTier(capId, 'recommended', `Recommended by ${appName}`)
      }
    }
    for (const capId of app.optionalLogCapabilities || []) {
      if (tierByCap.get(capId) !== 'required' && tierByCap.get(capId) !== 'recommended') {
        setTier(capId, 'optional', `Optional for ${appName}`)
      }
    }
  }

  /** @param {'required' | 'recommended' | 'optional'} tier */
  function buildTier(tier) {
    const out = []
    for (const [capId, t] of tierByCap) {
      if (t !== tier) continue
      const def = logCapabilities[capId]
      if (!def) continue
      const uniqReasons = [...new Set(reasonsByCap.get(capId) || [])]
      out.push({
        capabilityId: capId,
        name: def.name || capId,
        domain: def.domain,
        satisfiedBy: [...(def.sources || [])],
        reason: uniqReasons.join('; '),
      })
    }
    out.sort((a, b) => a.capabilityId.localeCompare(b.capabilityId))
    return out
  }

  return {
    required: buildTier('required'),
    recommended: buildTier('recommended'),
    optional: buildTier('optional'),
  }
}

function isSourceActive(sourceStates, sourceId) {
  const st = sourceStates?.[sourceId]
  return st && (st.status === 'current' || st.status === 'future')
}

/**
 * Best strength an active source provides for a capability.
 * @param {object} capDef
 * @param {object} sourceStates
 * @returns {{ sourceId: string, strength: string } | null}
 */
function bestActiveStrengthForCapability(capDef, sourceStates, allowedIds) {
  let best = null
  const bySrc = capDef.strengthBySource || {}
  for (const sourceId of Object.keys(bySrc)) {
    if (!isSourceActive(sourceStates, sourceId)) continue
    if (allowedIds && !allowedIds.has(sourceId)) continue
    const strength = bySrc[sourceId]
    const rank = STRENGTH_ORDER[strength] || 0
    if (!best || rank > STRENGTH_ORDER[best.strength]) {
      best = { sourceId, strength }
    }
  }
  return best
}

/**
 * Evaluate coverage of resolved requirements using active source states.
 *
 * @param {ReturnType<typeof resolveLogRequirements>} logRequirements
 * @param {Record<string, { status?: string }>} sourceStates
 * @param {object[]} allSources
 * @returns {{
 *   satisfied: { capabilityId: string, satisfiedBySource: string, strength: string }[],
 *   unsatisfied: { capabilityId: string, name: string, availableSources: string[] }[],
 *   partial: { capabilityId: string, partialSource: string, strength: string }[],
 * }}
 */
export function checkCapabilitySatisfaction(logRequirements, sourceStates, allSources) {
  const allowedIds =
    Array.isArray(allSources) && allSources.length > 0
      ? new Set(allSources.map((s) => s?.id).filter(Boolean))
      : null
  const satisfied = []
  const unsatisfied = []
  const partial = []

  const seen = new Set()
  const lists = [
    ...(logRequirements.required || []),
    ...(logRequirements.recommended || []),
    ...(logRequirements.optional || []),
  ]

  for (const entry of lists) {
    const capId = entry.capabilityId
    if (seen.has(capId)) continue
    seen.add(capId)

    const capDef = logCapabilities[capId]
    if (!capDef) {
      unsatisfied.push({
        capabilityId: capId,
        name: entry.name || capId,
        availableSources: [],
      })
      continue
    }

    const best = bestActiveStrengthForCapability(capDef, sourceStates, allowedIds)
    if (!best) {
      unsatisfied.push({
        capabilityId: capId,
        name: capDef.name || capId,
        availableSources: [...(capDef.sources || [])],
      })
      continue
    }

    if (STRENGTH_ORDER[best.strength] >= SATISFIED_RANK) {
      satisfied.push({
        capabilityId: capId,
        satisfiedBySource: best.sourceId,
        strength: best.strength,
      })
    } else {
      partial.push({
        capabilityId: capId,
        partialSource: best.sourceId,
        strength: best.strength,
      })
    }
  }

  return { satisfied, unsatisfied, partial }
}

/**
 * All log catalog capabilities a source can emit, keyed by capability id.
 * Values are strength labels from `strengthBySource`.
 *
 * @param {string} sourceId
 * @returns {Record<string, 'strong' | 'partial' | 'minimal'>}
 */
export function getSourceCapabilities(sourceId) {
  /** @type {Record<string, 'strong' | 'partial' | 'minimal'>} */
  const out = {}
  if (!sourceId) return out

  for (const cap of Object.values(logCapabilities)) {
    const str = cap.strengthBySource?.[sourceId]
    if (str) out[cap.id] = str
  }
  return out
}
