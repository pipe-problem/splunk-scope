/**
 * Helpers for user-defined custom data sources (custom_* session keys).
 */

export const CUSTOM_SOURCE_CATEGORY = 'Custom';

export function createCustomSourceId() {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 9);
  return `custom_${Date.now()}_${suffix}`;
}

/**
 * Build a minimal catalog-shaped object for sizing / UI.
 * @param {string} id
 * @param {object} ss - session source state
 */
export function customSourceCatalogEntry(id, ss = {}) {
  const rate = parseFloat(ss.sizingRate);
  return {
    id,
    name: ss.name?.trim() || 'Custom source',
    category: CUSTOM_SOURCE_CATEGORY,
    subcategory: ss.vendor?.trim() || 'Custom',
    description: ss.notes?.trim() || 'User-defined data source for planning estimates.',
    isCustom: true,
    exampleVendors: ss.vendor ? [ss.vendor] : [],
    sizing_formula: {
      primary_input: 'count',
      rate_per_unit: Number.isFinite(rate) && rate > 0 ? rate : 0.1,
    },
    input_fields: [],
    telemetryDomains: ss.telemetryDomains || {},
  };
}

export function listCustomSourcesFromSession(sourceStates = {}) {
  return Object.entries(sourceStates)
    .filter(([id]) => id.startsWith('custom_'))
    .map(([id, ss]) => customSourceCatalogEntry(id, ss));
}

export function countCustomSourcesInCategory(sourceStates = {}) {
  return Object.keys(sourceStates).filter((id) => id.startsWith('custom_')).length;
}

/**
 * Default state for a newly created custom source.
 */
export function defaultCustomSourceState({ name, vendor, count, sizingMode, sizingRate, manualGbTotal }) {
  const state = {
    status: 'current',
    name: name?.trim() || 'Custom source',
    vendor: vendor?.trim() || '',
    count: count != null && count !== '' ? String(count) : '',
    sizingMode: sizingMode === 'manual_total' ? 'manual_total' : 'per_unit',
    sizingRate: sizingRate != null && sizingRate !== '' ? String(sizingRate) : '0.1',
    notes: '',
  };
  if (state.sizingMode === 'manual_total' && manualGbTotal != null && manualGbTotal !== '') {
    state.override = String(manualGbTotal);
  }
  return state;
}
