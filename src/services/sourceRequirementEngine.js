/**
 * Classifies sources using log capability resolution layered on domain-based recommendations.
 */

import {
  resolveLogRequirements,
  checkCapabilitySatisfaction,
  getSourceCapabilities,
  resolveAppRequirementKey,
} from './logRequirementEngine.js'
import { classifySource } from './sourceRecommendationEngine.js'
import appRequirementsData from '../data/appRequirements.json' with { type: 'json' }
import dataModelRequirementsData from '../data/dataModelRequirements.json' with { type: 'json' }
import logRequirementsData from '../data/logRequirements.json' with { type: 'json' }

const appsRegistry = appRequirementsData.apps || {}
const dataModelsRegistry = dataModelRequirementsData.dataModels || {}
const { logCapabilities } = logRequirementsData

/** Ordinal rank for peer comparison only — not the 0–1 coverage weight scale. */
const STRENGTH_SCORE = { strong: 3, partial: 2, minimal: 1 }

const HIGH_VOLUME_DOMAINS = new Set([
  'network',
  'endpoint',
  'perimeter_control',
  'email_collaboration',
  'cloud_control_plane',
  'cloud_infrastructure',
  'application_traces',
  'kubernetes_container',
  'saas_activity',
])

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

function noiseLevelForStrength(strength) {
  if (strength === 'strong') return 'low'
  if (strength === 'partial') return 'medium'
  return 'high'
}

function complexityForStrength(strength) {
  if (strength === 'strong') return 'low'
  if (strength === 'partial') return 'medium'
  return 'high'
}

function volumeLevelForCapability(capDef) {
  if (capDef?.domain && HIGH_VOLUME_DOMAINS.has(capDef.domain)) return 'high'
  return 'medium'
}

function caveatForStrength(strength) {
  if (strength === 'minimal') return 'Field coverage and event fidelity may be limited without tuning or add-ons.'
  if (strength === 'partial') return 'May need add-ons, tagging, or CIM alignment for production detections.'
  return ''
}

/**
 * Per-capability ingest profile for a source from catalog strength metadata.
 *
 * @param {object} source - Catalog source (expects `id`)
 * @returns {Record<string, { strength: 'strong'|'partial'|'minimal', caveats: string, noiseLevel: 'low'|'medium'|'high', volumeLevel: 'low'|'medium'|'high', implementationComplexity: 'low'|'medium'|'high' }>}
 */
export function getSourceStrengthProfile(source) {
  const sid = source?.id
  /** @type {Record<string, { strength: string, caveats: string, noiseLevel: string, volumeLevel: string, implementationComplexity: string }>} */
  const out = {}
  if (!sid) return out

  for (const cap of Object.values(logCapabilities)) {
    const strength = cap.strengthBySource?.[sid]
    if (!strength) continue
    out[cap.id] = {
      strength,
      caveats: caveatForStrength(strength),
      noiseLevel: noiseLevelForStrength(strength),
      volumeLevel: volumeLevelForCapability(cap),
      implementationComplexity: complexityForStrength(strength),
    }
  }
  return out
}

function overlappingProviders(capabilityId, sourceId, sourceStates) {
  const capDef = logCapabilities[capabilityId]
  if (!capDef?.strengthBySource) return []
  const str = capDef.strengthBySource[sourceId]
  if (!str) return []
  const rank = STRENGTH_SCORE[str] || 0
  const peers = []
  for (const otherId of Object.keys(capDef.strengthBySource)) {
    if (otherId === sourceId) continue
    if (!isSourceActive(sourceStates, otherId)) continue
    const otherStr = capDef.strengthBySource[otherId]
    if ((STRENGTH_SCORE[otherStr] || 0) >= rank) peers.push(otherId)
  }
  return peers
}

function isSourceActive(sourceStates, sourceId) {
  const st = sourceStates?.[sourceId]
  return st && (st.status === 'current' || st.status === 'future')
}

function computeCimRequired(appKeys) {
  for (const k of appKeys) {
    if (appsRegistry[k]?.cimRequired) return true
  }
  return false
}

/**
 * Data models touched by this source's capabilities that matter to resolved apps.
 *
 * @param {Set<string>} appKeys
 * @param {Record<string, { strength: string }>} strengthProfileKeys
 * @returns {string[]}
 */
function dataModelsImpactedForSource(appKeys, strengthProfileKeys) {
  const capIds = new Set(Object.keys(strengthProfileKeys))
  const models = []
  for (const [modelId, dm] of Object.entries(dataModelsRegistry)) {
    const requiredBy = dm.requiredByApps || []
    if (!requiredBy.some((a) => appKeys.has(a))) continue
    const dmc = dm.logCapabilities || []
    if (dmc.some((c) => capIds.has(c))) models.push(modelId)
  }
  return [...models].sort()
}

/**
 * Capability-aware classification combining `classifySource` with requirement gaps.
 *
 * @param {object} source
 * @param {object[]} useCases
 * @param {string[]} desiredApps
 * @param {object[]} allSources
 * @param {Record<string, { status?: string }>} sourceStates
 * @returns {{
 *   classification: 'required' | 'recommended' | 'optional' | 'redundant' | 'needs_review' | 'unnecessary',
 *   confidence: 'high' | 'medium' | 'low',
 *   explanation: string,
 *   capabilitiesSatisfied: string[],
 *   gapsAddressed: string[],
 *   possibleOverlaps: string[],
 *   affectsGbDay: boolean,
 *   dataModelsImpacted: string[],
 *   cimRequired: boolean,
 * }}
 */
export function classifySourceByCapability(source, useCases, desiredApps, allSources, sourceStates) {
  const base = classifySource(source, useCases, desiredApps, allSources, sourceStates, {}, {})

  const logReq = resolveLogRequirements(useCases, desiredApps)
  const satisfaction = checkCapabilitySatisfaction(logReq, sourceStates, allSources)
  const appKeys = collectResolvedAppKeys(desiredApps, useCases)

  const requiredIds = new Set((logReq.required || []).map((r) => r.capabilityId))
  const recommendedIds = new Set((logReq.recommended || []).map((r) => r.capabilityId))

  const sourceCaps = getSourceCapabilities(source.id)
  const profile = getSourceStrengthProfile(source)

  const gapEntries = [...satisfaction.unsatisfied, ...satisfaction.partial]
  const gapRequired = gapEntries.filter((g) => requiredIds.has(g.capabilityId))

  const gapsAddressed = []
  for (const g of gapRequired) {
    if (sourceCaps[g.capabilityId]) gapsAddressed.push(g.capabilityId)
  }

  const capabilitiesSatisfied = []
  for (const capId of [...requiredIds, ...recommendedIds]) {
    if (sourceCaps[capId] === 'strong') capabilitiesSatisfied.push(capId)
  }

  const overlapSet = new Set()
  for (const capId of Object.keys(sourceCaps)) {
    for (const peer of overlappingProviders(capId, source.id, sourceStates)) {
      overlapSet.add(`${capId}↔${peer}`)
    }
  }
  const possibleOverlaps = [...overlapSet].sort()

  const sizingRate = typeof source?.sizingRate === 'number' ? source.sizingRate : 0
  const profileVolumeHigh = Object.values(profile).some((p) => p.volumeLevel === 'high')
  const affectsGbDay = profileVolumeHigh || sizingRate >= 0.35

  const dataModelsImpacted = dataModelsImpactedForSource(appKeys, profile)
  const cimRequired = computeCimRequired(appKeys)

  let classification = base.classification
  let explanation = base.reason || base.explanation || ''
  let confidence = 'medium'

  if (base.classification === 'redundant') {
    return {
      classification: base.classification,
      confidence: 'medium',
      explanation,
      capabilitiesSatisfied,
      gapsAddressed,
      possibleOverlaps,
      affectsGbDay,
      dataModelsImpacted,
      cimRequired,
    }
  }

  const isOnlyStrongActiveProvider = gapsAddressed.some((capId) => {
    const capDef = logCapabilities[capId]
    if (capDef?.strengthBySource?.[source.id] !== 'strong') return false
    for (const [oid, st] of Object.entries(capDef.strengthBySource)) {
      if (oid === source.id) continue
      if (st !== 'strong') continue
      if (isSourceActive(sourceStates, oid)) return false
    }
    return true
  })

  if (gapRequired.length > 0 && gapsAddressed.length > 0) {
    if (isSourceActive(sourceStates, source.id) && isOnlyStrongActiveProvider) {
      classification = 'required'
      explanation = `Only strong active provider for ${gapsAddressed.length} required log capability gap(s).`
      confidence = 'high'
    } else if (!isSourceActive(sourceStates, source.id)) {
      if (base.classification === 'unnecessary' || base.classification === 'optional') {
        classification = 'recommended'
        explanation = `Closes ${gapsAddressed.length} required log capability gap(s) if onboarded.`
        confidence = 'medium'
      }
    } else if (classification === 'recommended' || classification === 'required') {
      explanation = `${base.reason}; addresses ${gapsAddressed.length} capability gap(s).`
      confidence = 'high'
    }
  } else if (Object.keys(sourceCaps).length === 0 && (useCases?.length > 0 || appKeys.size > 0)) {
    if (classification === 'recommended' && gapRequired.length > 0) {
      classification = 'optional'
      explanation = 'Needs validation: source mapping is incomplete for current requirements.'
      confidence = 'low'
    }
  }

  if (classification === 'needs_review') {
    confidence = 'low'
  }

  return {
    classification,
    confidence,
    explanation,
    capabilitiesSatisfied,
    gapsAddressed,
    possibleOverlaps,
    affectsGbDay,
    dataModelsImpacted,
    cimRequired,
  }
}
