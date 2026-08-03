/**
 * Overlap Engine
 * Prevents double-counting for sources that commonly share log streams.
 * Evaluates overlap groups, surfaces resolution prompts, and adjusts
 * totals based on user decisions stored in session state.
 */

import sourceCatalog from '../data/sources.json' with { type: 'json' }
import { isBranchActiveInSession } from './sizingEngine.js'
import { pairKey as sortedPairKey } from './sourceOverlapLookupEngine.js'

export const OVERLAP_GROUPS = {
  network_security_controls: {
    label: 'Network Security Controls',
    members: ['firewalls', 'fw_perimeter', 'fw_internal', 'fw_waf', 'ids_ips', 'ndr', 'sase', 'proxy'],
    warning: 'Firewall, IDS/IPS, NDR, SASE, and Proxy sources often share overlapping log streams.',
    pairs: [
      {
        sources: ['firewalls', 'ids_ips'],
        question: 'Are these IDS/IPS events separate from the firewall logs already entered?',
        options: [
          { id: 'separate', label: 'Yes, this is a separate standalone IDS/IPS source', dedup: false },
          { id: 'included', label: 'No, these events are included in firewall logging', dedup: true },
          { id: 'unknown', label: 'Unknown / needs validation', dedup: false, lowConfidence: true },
        ],
      },
      {
        sources: ['firewalls', 'ndr'],
        question: 'Is NDR telemetry collected separately from firewall traffic logs?',
        options: [
          { id: 'separate', label: 'Yes, NDR has its own sensor/appliance', dedup: false },
          { id: 'included', label: 'No, NDR data comes from the same firewall flow logs', dedup: true },
          { id: 'unknown', label: 'Unknown / needs validation', dedup: false, lowConfidence: true },
        ],
      },
      {
        sources: ['proxy', 'sase'],
        question: 'Is proxy logging separate from SASE platform logs?',
        options: [
          { id: 'separate', label: 'Yes, traditional proxy is separate from SASE', dedup: false },
          { id: 'included', label: 'No, proxy functionality is provided by the SASE platform', dedup: true },
          { id: 'unknown', label: 'Unknown / needs validation', dedup: false, lowConfidence: true },
        ],
      },
      {
        sources: ['firewalls', 'sase'],
        question: 'Are firewall logs separate from SASE platform logs?',
        options: [
          { id: 'separate', label: 'Yes, on-prem firewalls are separate from cloud SASE', dedup: false },
          { id: 'included', label: 'No, firewall is provided by the SASE platform', dedup: true },
          { id: 'unknown', label: 'Unknown / needs validation', dedup: false, lowConfidence: true },
        ],
      },
    ],
  },
  remote_access: {
    label: 'Remote Access',
    members: ['vpn', 'sase', 'firewalls'],
    warning: 'VPN logs may be included in firewall or SASE platform logs.',
    pairs: [
      {
        sources: ['vpn', 'firewalls'],
        question: 'Are VPN logs separate from firewall logs?',
        options: [
          { id: 'separate', label: 'Yes, VPN appliance is separate', dedup: false },
          { id: 'included', label: 'No, VPN runs on the firewall', dedup: true },
          { id: 'unknown', label: 'Unknown / needs validation', dedup: false, lowConfidence: true },
        ],
      },
    ],
  },
  cloud_security: {
    label: 'Cloud Security',
    members: ['cspm', 'cwpp'],
    warning: 'CSPM and CWPP from the same vendor may emit overlapping control-plane and workload findings.',
    pairs: [
      {
        sources: ['cspm', 'cwpp'],
        question: 'Are CSPM and CWPP from different vendors or the same platform?',
        options: [
          { id: 'separate', label: 'Different vendors — separate telemetry', dedup: false },
          { id: 'included', label: 'Same platform — overlapping telemetry', dedup: true },
          { id: 'unknown', label: 'Unknown / needs validation', dedup: false, lowConfidence: true },
        ],
      },
    ],
  },
  endpoint_security: {
    label: 'Endpoint Security',
    members: ['edr', 'windows_servers'],
    warning: 'EDR and Windows event security channels can overlap when AV/EDR agents duplicate host telemetry.',
    pairs: [
      {
        sources: ['edr', 'windows_servers'],
        question: 'Is Windows Security / host telemetry already fully captured by the EDR pipeline (e.g., Defender for Endpoint)?',
        options: [
          { id: 'separate', label: 'Yes, Windows event collection is separate from EDR streaming', dedup: false },
          { id: 'included', label: 'No, EDR is the primary path — Windows logs would duplicate ingest', dedup: true },
          { id: 'unknown', label: 'Unknown / needs validation', dedup: false, lowConfidence: true },
        ],
      },
    ],
  },
  saas_identity: {
    label: 'SaaS & Identity',
    members: ['saas_office', 'saas_sso', 'casb', 'saas_general'],
    warning: 'M365 audit, IdP, CASB, and general SaaS summaries may overlap on identity and sign-in events.',
    pairs: [
      {
        sources: ['saas_office', 'saas_general'],
        question: 'Does the general SaaS sizing row already include Microsoft 365 / Google Workspace audit volume?',
        options: [
          { id: 'separate', label: 'No, M365 / Workspace is sized separately (recommended)', dedup: false },
          { id: 'included', label: 'Yes, the general SaaS row already includes that audit volume', dedup: true },
          { id: 'unknown', label: 'Unknown / needs validation', dedup: false, lowConfidence: true },
        ],
      },
    ],
  },
}

/**
 * Find all overlap pairs that apply given the current source statuses.
 * Only surfaces prompts when both sources in a pair are active.
 * Uses catalog tree so a child firewall row still counts as the firewall family for prompts.
 */
export function detectActiveOverlaps(sourceStates, catalogRoots = sourceCatalog) {
  const prompts = []

  for (const [groupId, group] of Object.entries(OVERLAP_GROUPS)) {
    for (const pair of group.pairs) {
      const [srcA, srcB] = pair.sources
      const activeA = isBranchActiveInSession(srcA, sourceStates, catalogRoots)
      const activeB = isBranchActiveInSession(srcB, sourceStates, catalogRoots)

      if (activeA && activeB) {
        prompts.push({
          groupId,
          groupLabel: group.label,
          pairKey: sortedPairKey(srcA, srcB),
          sources: pair.sources,
          question: pair.question,
          options: pair.options,
          warning: group.warning,
        })
      }
    }
  }

  return prompts
}

/**
 * Determine which sources should be excluded from totals based on overlap decisions.
 */
export function getExcludedSources(overlapDecisions) {
  const excluded = new Set()
  const assumptions = []

  for (const [pairKey, decision] of Object.entries(overlapDecisions || {})) {
    if (!decision) continue

    const option = decision.selectedOption
    if (option?.dedup) {
      const [, secondary] = pairKey.split('__')
      excluded.add(secondary)
      assumptions.push(
        `${secondary.replace(/_/g, ' ')} excluded from totals — included in ${pairKey.split('__')[0].replace(/_/g, ' ')} logging`
      )
    }
    if (option?.lowConfidence) {
      assumptions.push(
        `${pairKey.replace(/__/g, ' / ').replace(/_/g, ' ')} overlap is unconfirmed — included with low confidence`
      )
    }
  }

  return { excluded, assumptions }
}

/**
 * Filter source results to exclude deduplicated sources.
 */
export function applyOverlapExclusions(sourceResults, overlapDecisions) {
  const { excluded, assumptions } = getExcludedSources(overlapDecisions)
  const filtered = {}

  for (const [id, result] of Object.entries(sourceResults)) {
    if (!excluded.has(id)) {
      filtered[id] = result
    }
  }

  return { results: filtered, excluded: [...excluded], assumptions }
}

/**
 * Check if a specific source needs an overlap prompt before configuration.
 */
export function getOverlapPromptForSource(sourceId, sourceStates) {
  const allPrompts = detectActiveOverlaps(sourceStates)
  return allPrompts.filter((p) => p.sources.includes(sourceId))
}
