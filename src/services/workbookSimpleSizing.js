/**
 * Workbook-aligned simple sizing: count × rateGbPerUnit from originalSizingRates.
 * Default configure path for all workbook catalog sources.
 */
import originalRates from '../data/originalSizingRates.json' with { type: 'json' };
import { parseCount } from './iaasSizingEngine.js';

const ENTRIES = originalRates.entries || {};

export const COMPOSITE_SOURCE_IDS = new Set([
  'iaas',
  'iaas_containers',
  'iaas_instances',
  'iaas_storage',
  'saas_general',
  'saas_office',
  'saas_crm',
  'saas_sso',
]);

/** Keys that indicate composite / advanced sizing beyond vendor + primary count. */
const ADVANCED_SIZING_KEYS = new Set([
  'iaasSizingMode',
  'iaasRegionCount',
  'iaasSubscriptionCount',
  'ssoTenantCount',
  'ssoMfaUserCount',
  'ssoAppIntegrationCount',
  'ssoCollectionProfile',
  'ssoActivityLevel',
  'officeTenantCount',
  'officeSharePointSiteCount',
  'officeTeamsCount',
  'officeCollectionProfile',
  'officeActivityLevel',
  'officeEmailVolumeLevel',
  'officeCustomizeComponents',
  'officeComponents',
  'crmTenantCount',
  'crmIntegrationCount',
  'crmCollectionProfile',
  'crmActivityLevel',
  'saasTenantCount',
  'saasIntegrationCount',
  'saasCollectionProfile',
  'saasActivityLevel',
  'cloudVmCollectionProfile',
  'cloudVmCustomizeComponents',
  'cloudVmComponents',
  'cloudVmLogComponents',
  'cloudStorageCollectionProfile',
  'cloudStorageCustomizeComponents',
  'cloudStorageComponents',
  'containerCollectionProfile',
  'containerCustomizeComponents',
  'containerComponents',
  'containerSizingProfile',
  'dlpSizingProfile',
  'logging_scope',
  'traffic_level',
  'number_of_channels',
]);

function isMeaningfulValue(val) {
  if (val == null || val === '' || val === false) return false;
  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.some(isMeaningfulValue);
    return Object.values(val).some(isMeaningfulValue);
  }
  return true;
}

function hasNestedContainerAdvancedInputs(sourceId, inputState) {
  const counts = inputState.containerCounts;
  if (!counts || typeof counts !== 'object') return false;

  const primaryField = ENTRIES[sourceId]?.primaryInputField || '';
  if (!primaryField.startsWith('containerCounts.')) {
    return isMeaningfulValue(counts);
  }

  const primaryLeaf = primaryField.split('.')[1];
  return Object.entries(counts).some(
    ([key, val]) => key !== primaryLeaf && isMeaningfulValue(val),
  );
}

/** True when composite engines should run instead of workbook simple sizing. */
export function hasAdvancedSizingInputs(sourceId, inputState) {
  if (!inputState) return false;
  if (inputState.useAdvancedSizing === true) return true;
  if (!COMPOSITE_SOURCE_IDS.has(sourceId)) return false;

  for (const key of ADVANCED_SIZING_KEYS) {
    if (isMeaningfulValue(inputState[key])) return true;
  }

  if (hasNestedContainerAdvancedInputs(sourceId, inputState)) return true;

  return false;
}

/**
 * @param {string} sourceId
 * @param {object} inputState
 * @param {string} [primaryFieldOverride]
 * @returns {{ expected: number, low: number, high: number, count: number, rate: number } | null}
 */
export function calculateWorkbookSimpleSizing(sourceId, inputState, primaryFieldOverride) {
  const entry = ENTRIES[sourceId];
  if (!entry || !inputState) return null;

  const primaryField =
    primaryFieldOverride
    || entry.primaryInputField
    || 'count';

  let count = parseCount(inputState[primaryField]);
  if (count <= 0 && primaryField.includes('.')) {
    const [root, leaf] = primaryField.split('.');
    count = parseCount(inputState[root]?.[leaf] ?? inputState[root]);
  }
  if (count <= 0 && inputState.count != null) {
    count = parseCount(inputState.count);
  }
  if (count <= 0 && inputState.number_of_users != null) {
    count = parseCount(inputState.number_of_users);
  }
  if (count <= 0) return null;

  const rate = Number(entry.rateGbPerUnit);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const lowMul = entry.lowMultiplier ?? originalRates.lowMultiplierDefault ?? 0.8;
  const highMul = entry.highMultiplier ?? originalRates.highMultiplierDefault ?? 1.2;
  const expected = rate * count;

  return {
    expected,
    low: expected * lowMul,
    high: expected * highMul,
    count,
    rate,
  };
}

/** Workbook simple sizing when no composite/advanced inputs are present. */
export function shouldUseWorkbookSimpleSizing(sourceId, inputState, primaryFieldOverride) {
  if (!inputState || !ENTRIES[sourceId]) return false;
  if (hasAdvancedSizingInputs(sourceId, inputState)) return false;
  return true;
}

export function shouldRunCompositeEngine(sourceId, inputState, primaryFieldOverride) {
  if (!COMPOSITE_SOURCE_IDS.has(sourceId)) return false;
  return hasAdvancedSizingInputs(sourceId, inputState);
}

export function applyWorkbookSimpleToResult(result, simple, sourceId) {
  if (!simple) return result;
  result.low = simple.low;
  result.expected = simple.expected;
  result.high = simple.high;
  result.rateSource = 'workbook_simple';
  result.confidence = 'medium';
  result.countBasis = `${simple.count} × ${simple.rate} GB/day (${sourceId})`;
  result.assumptions = [
    ...(result.assumptions || []),
    'Workbook rate (ORIGINAL Sizing Calculator): count × GB/day per unit.',
  ];
  return result;
}
