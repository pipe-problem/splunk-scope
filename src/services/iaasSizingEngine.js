/**
 * IaaS cloud sizing — standard (provider × accounts) and advanced (scope × counts).
 * Rates are modeled planning defaults, not official vendor sizing.
 */

import iaasRates from '../data/iaasSizingRates.json';

export const IAAS_PROVIDERS = Object.entries(iaasRates.standardProviderRates).map(([id, p]) => ({
  id,
  label: p.label,
  unit: p.unit,
}));

const LEGACY_VENDOR_MAP = {
  aws: 'aws',
  azure: 'azure',
  gcp: 'gcp',
  'oracle cloud': 'oci',
  oci: 'oci',
  'ibm cloud': 'ibm',
  ibm: 'ibm',
  other: 'average',
  unknown: 'average',
};

export function mapLegacyVendorToProvider(vendor) {
  if (!vendor) return null;
  const key = String(vendor).trim().toLowerCase();
  return LEGACY_VENDOR_MAP[key] || null;
}

export function parseCount(value) {
  if (value === '' || value == null) return 0;
  const n = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Display GB/day with tiered precision — no trailing noise for zero. */
export function formatIaasGb(value) {
  const v = Number(value);
  if (!Number.isFinite(v) || v === 0) return '0';
  if (v >= 1) return v.toFixed(1);
  if (v >= 0.1) return v.toFixed(2);
  return v.toFixed(3);
}

export function getProviderMeta(providerId) {
  return iaasRates.standardProviderRates[providerId] || iaasRates.standardProviderRates.average;
}

export function normalizeIaasState(inputState = {}) {
  const state = { ...inputState };
  let provider = state.iaasProvider || mapLegacyVendorToProvider(state.vendor);
  if (!provider || !iaasRates.standardProviderRates[provider]) {
    provider = 'average';
  }
  state.iaasProvider = provider;

  let mode = state.iaasSizingMode === 'advanced' ? 'advanced' : 'standard';
  state.iaasSizingMode = mode;

  if (state.iaasAccountCount == null || state.iaasAccountCount === '') {
    if (state.number_of_accounts != null && state.number_of_accounts !== '') {
      state.iaasAccountCount = state.number_of_accounts;
    }
  }

  const raw = state.iaasAdvancedCounts && typeof state.iaasAdvancedCounts === 'object'
    ? state.iaasAdvancedCounts
    : {};
  state.iaasAdvancedCounts = {
    accountLikeContainers: raw.accountLikeContainers ?? '',
    instances: raw.instances ?? '',
    flowLogInterfaces: raw.flowLogInterfaces ?? '',
    storageBuckets: raw.storageBuckets ?? '',
    kubernetesClusters: raw.kubernetesClusters ?? '',
    containersOrPods: raw.containersOrPods ?? '',
  };

  return state;
}

function emptyResult() {
  return {
    low: 0,
    expected: 0,
    high: 0,
    confidence: 'none',
    assumptions: [],
    warnings: [],
    rateSource: 'iaas_cloud',
    needsReview: true,
    countBasis: '',
    vendorMultiplier: 1.0,
    scopeMultiplier: 1.0,
    bufferApplied: false,
    iaasBreakdown: null,
  };
}

function calculateStandard(providerId, accountCount) {
  const rates = getProviderMeta(providerId);
  const low = rates.low * accountCount;
  const expected = rates.medium * accountCount;
  const high = rates.high * accountCount;
  return {
    low,
    expected,
    high,
    assumptions: [
      `Standard IaaS estimate: ${accountCount} ${rates.unit}(s) × ${rates.medium} GB/day (medium band)`,
      'Modeled planning defaults — validate with a 24-hour sample when available.',
    ],
    countBasis: rates.unit,
    breakdown: null,
  };
}

function calculateAdvanced(providerId, counts) {
  const providerRates = iaasRates.advancedScopeRates[providerId] || iaasRates.advancedScopeRates.average;
  const scopes = [];
  let low = 0;
  let expected = 0;
  let high = 0;

  for (const scopeDef of iaasRates.advancedScopes) {
    const rate = providerRates[scopeDef.id];
    if (!rate) continue;
    const count = parseCount(counts[scopeDef.countKey]);
    const scopeLow = rate.low * count;
    const scopeMedium = rate.medium * count;
    const scopeHigh = rate.high * count;
    low += scopeLow;
    expected += scopeMedium;
    high += scopeHigh;
    if (count > 0) {
      scopes.push({
        id: scopeDef.id,
        label: scopeDef.label,
        count,
        unit: rate.unit,
        lowGb: scopeLow,
        mediumGb: scopeMedium,
        highGb: scopeHigh,
        confidence: scopeDef.confidence,
      });
    }
  }

  return {
    low,
    expected,
    high,
    assumptions: [
      `Advanced IaaS estimate: ${scopes.length} scope(s) with non-zero counts`,
      'Modeled planning defaults — validate with a 24-hour sample when available.',
    ],
    countBasis: 'advanced scopes',
    breakdown: scopes,
  };
}

/**
 * @param {object} inputState - session source state for iaas
 * @param {{ allInputs?: Record<string, object> }} [sizingContext]
 */
export function calculateIaasSizing(inputState, sizingContext = {}) {
  const result = emptyResult();
  if (!inputState) return result;

  const state = normalizeIaasState(inputState);
  const provider = state.iaasProvider;
  const providerMeta = getProviderMeta(provider);
  const mode = state.iaasSizingMode;

  let calc;
  if (mode === 'advanced') {
    const hasAny = iaasRates.advancedCountFields.some(
      (f) => parseCount(state.iaasAdvancedCounts[f.key]) > 0,
    );
    if (!hasAny) {
      result.confidence = 'none';
      result.warnings.push('Enter at least one advanced count, or switch to standard sizing.');
      result.countBasis = 'advanced scopes';
      return result;
    }
    calc = calculateAdvanced(provider, state.iaasAdvancedCounts);
  } else {
    const accountCount = parseCount(state.iaasAccountCount);
    if (accountCount <= 0) {
      result.confidence = 'none';
      result.warnings.push('Enter the number of cloud accounts (or switch to advanced sizing).');
      result.countBasis = providerMeta.unit;
      return result;
    }
    calc = calculateStandard(provider, accountCount);
  }

  result.low = calc.low;
  result.expected = calc.expected;
  result.high = calc.high;
  result.assumptions = calc.assumptions;
  result.countBasis = calc.countBasis;
  result.confidence = mode === 'standard' ? 'medium' : 'medium';
  result.needsReview = true;
  result.iaasBreakdown = calc.breakdown;

  result.assumptions.unshift(`Provider: ${providerMeta.label}`);

  const overlapWarning = detectIaasChildOverlap(state, sizingContext.allInputs);
  if (overlapWarning) {
    result.warnings.push(overlapWarning);
  }

  return result;
}

/** @returns {string|null} */
export function detectIaasChildOverlap(iaasState, allInputs = {}) {
  if (normalizeIaasState(iaasState).iaasSizingMode !== 'advanced') return null;
  const activeChildren = (iaasRates.overlapChildSourceIds || []).filter((id) => {
    const ss = allInputs[id];
    if (!ss || (ss.status !== 'current' && ss.status !== 'future')) return false;
    const count = parseCount(ss.count);
    return count > 0 || parseCount(ss.number_of_instances) > 0;
  });
  if (activeChildren.length === 0) return null;
  return 'Some advanced IaaS counts may overlap with separate cloud sources already configured. Confirm whether IaaS should include these logs or whether they are sized separately.';
}

export function getIaasAdvancedCountFields() {
  return iaasRates.advancedCountFields;
}

export function getIaasStandardProviders() {
  return IAAS_PROVIDERS;
}

export {
  iaasRates,
};
