/**
 * Prevents duplicate identity / endpoint gaps when an equivalent source is already configured.
 */

/** When primary is configured, suppress missing-priority rows for downgrade targets. */
export const MISSING_PRIORITY_COVERED_BY = {
  sso_pam: ['saas_sso', 'active_directory'],
  av_edr_legacy: ['edr'],
  desktops: ['edr'],
};

/** When any of these are on the path, do not recommend the gap source in maturity copy. */
export const GAP_SOURCE_COVERED_BY = {
  edr: ['edr'],
  sso_pam: ['saas_sso', 'active_directory'],
  active_directory: ['saas_sso'],
  windows_servers: ['edr'],
  av_edr_legacy: ['edr'],
  desktops: ['edr'],
};

export function getConfiguredSourceIds(sourceStates = {}) {
  return Object.entries(sourceStates)
    .filter(([, s]) => s?.status === 'current')
    .map(([id]) => id);
}

/**
 * @param {string} sourceId
 * @param {string[]} configuredIds
 */
export function isMissingPriorityCoveredByEquivalent(sourceId, configuredIds) {
  const covers = MISSING_PRIORITY_COVERED_BY[sourceId];
  if (!covers?.length) return false;
  return covers.some((id) => configuredIds.includes(id));
}

/**
 * @param {string} gapSourceId
 * @param {Set<string>|string[]} pathOrConfiguredIds
 */
export function isGapSourceAlreadyCovered(gapSourceId, pathOrConfiguredIds) {
  const ids = pathOrConfiguredIds instanceof Set ? pathOrConfiguredIds : new Set(pathOrConfiguredIds);
  const covers = GAP_SOURCE_COVERED_BY[gapSourceId];
  if (!covers?.length) return false;
  return covers.some((id) => ids.has(id));
}

/**
 * @param {Array<{ sourceId: string }>} priorities
 * @param {Record<string, object>} sourceStates
 */
export function filterMissingPrioritiesForEquivalency(priorities, sourceStates) {
  const configured = getConfiguredSourceIds(sourceStates);
  return (priorities || []).filter(
    (p) => !isMissingPriorityCoveredByEquivalent(p.sourceId, configured),
  );
}
