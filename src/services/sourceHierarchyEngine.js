/**
 * Source Hierarchy Engine
 *
 * Manages parent/child source relationships. Sources like "Windows Servers"
 * contain nested log channels; "Firewalls" contain traffic/threat/VPN sub-types.
 * This engine flattens, resolves, and provides hierarchy-aware helpers.
 */

import { isCatalogParentRolledUp } from './sizingEngine.js'

/**
 * Check if a source has children defined in the catalog.
 */
export function hasChildren(source) {
  return Array.isArray(source.children) && source.children.length > 0
}

/**
 * Get log options for a source (used for Windows Server-style sub-selections).
 * These are defined as `log_options` in sources.json.
 */
export function getLogOptions(source) {
  return source.log_options || []
}

/**
 * Build the combined list of active log options for a parent source.
 * Returns the IDs of selected log options from session state.
 */
export function getActiveLogOptions(source, sourceState) {
  const options = getLogOptions(source)
  if (options.length === 0) return []

  const selected = sourceState?.selectedLogOptions || {}
  return options.filter((opt) => selected[opt.id] !== false).map((opt) => opt.id)
}

/**
 * Calculate the aggregate sizing impact of selected log options.
 * Each option can define a `gb_per_unit` that adds to the parent's total.
 *
 * @param {{ catalog?: object[], allInputs?: Record<string, object> }} [sizingContext] - When set, rolled-up parents return 0.
 */
export function calculateLogOptionIngest(source, sourceState, sizingContext) {
  const options = getLogOptions(source)
  if (options.length === 0) return 0

  if (sizingContext?.catalog && sizingContext?.allInputs && source?.id
    && isCatalogParentRolledUp(sizingContext.catalog, sizingContext.allInputs, source.id)) {
    return 0
  }

  const selected = sourceState?.selectedLogOptions || {}
  const pk = source.sizing_formula?.primary_input || 'count'
  const raw = sourceState?.[pk] ?? sourceState?.count ?? sourceState?.number_of_servers
    ?? sourceState?.number_of_endpoints ?? sourceState?.number_of_systems ?? 0
  const primaryCount = parseInt(String(raw), 10)
  if (!primaryCount || primaryCount <= 0) return 0

  let total = 0
  for (const opt of options) {
    const isAdvanced = opt.group === 'advanced'
    const isOn = isAdvanced ? selected[opt.id] === true : selected[opt.id] !== false
    if (!isOn) continue
    total += (opt.gb_per_unit || 0) * primaryCount
  }
  return total
}

/**
 * Per-channel ingest breakdown for sources with log_options (e.g. Windows Servers).
 * @returns {{ serverCount: number, perServerGb: number, totalGb: number, channels: Array<{ id, name, group, perServerGb, totalGb, selected: boolean }> }}
 */
export function getLogChannelBreakdown(source, sourceState, sizingContext) {
  const options = getLogOptions(source)
  if (options.length === 0) return null

  if (sizingContext?.catalog && sizingContext?.allInputs && source?.id
    && isCatalogParentRolledUp(sizingContext.catalog, sizingContext.allInputs, source.id)) {
    return null
  }

  const selected = sourceState?.selectedLogOptions || {}
  const pk = source.sizing_formula?.primary_input || 'count'
  const raw = sourceState?.[pk] ?? sourceState?.count ?? sourceState?.number_of_servers
    ?? sourceState?.number_of_endpoints ?? sourceState?.number_of_systems ?? 0
  const serverCount = parseInt(String(raw), 10)
  if (!serverCount || serverCount <= 0) return null

  const channels = []
  let perServerGb = 0

  for (const opt of options) {
    const isAdvanced = opt.group === 'advanced'
    const isOn = isAdvanced ? selected[opt.id] === true : selected[opt.id] !== false
    if (!isOn) continue
    const rate = opt.gb_per_unit || 0
    perServerGb += rate
    channels.push({
      id: opt.id,
      name: opt.name,
      group: opt.group || 'basic',
      perServerGb: rate,
      totalGb: rate * serverCount,
      selected: true,
    })
  }

  return {
    serverCount,
    perServerGb,
    totalGb: perServerGb * serverCount,
    channels,
  }
}

/**
 * Get telemetry domain contributions from selected log options.
 * Returns merged domain map reflecting which options are active.
 */
export function getLogOptionDomains(source, sourceState) {
  const options = getLogOptions(source)
  if (options.length === 0) return source.telemetryDomains || {}

  const selected = sourceState?.selectedLogOptions || {}
  const domains = { ...(source.telemetryDomains || {}) }

  for (const opt of options) {
    const isAdvanced = opt.group === 'advanced'
    const isOn = isAdvanced ? selected[opt.id] === true : selected[opt.id] !== false
    if (!isOn) continue
    if (opt.telemetryDomains) {
      for (const [domain, strength] of Object.entries(opt.telemetryDomains)) {
        const SCORES = { strong: 3, partial: 2, minimal: 1 }
        const existing = SCORES[domains[domain]] || 0
        const incoming = SCORES[strength] || 0
        if (incoming > existing) {
          domains[domain] = strength
        }
      }
    }
  }

  return domains
}

/**
 * Get coverage warnings for a parent source based on use cases
 * and which log options are selected/deselected.
 */
export function getLogOptionWarnings(source, sourceState, useCases) {
  const options = getLogOptions(source)
  if (options.length === 0) return []

  const selected = sourceState?.selectedLogOptions || {}
  const warnings = []

  const allRequired = new Set()
  for (const uc of useCases || []) {
    for (const d of uc.requiredDomains || []) allRequired.add(d)
  }

  for (const opt of options) {
    if (selected[opt.id] !== false) continue
    if (!opt.warning_if_disabled) continue

    const isRelevant = opt.telemetryDomains &&
      Object.keys(opt.telemetryDomains).some((d) => allRequired.has(d))

    if (isRelevant) {
      warnings.push(opt.warning_if_disabled)
    }
  }

  return warnings
}

/**
 * Check if a source ID is a child log option (not a top-level source).
 */
export function isChildLogOption(sourceId, catalogSources) {
  for (const parent of catalogSources) {
    const logOpts = parent.log_options || []
    if (logOpts.some((opt) => opt.id === sourceId)) return true
  }
  return false
}
