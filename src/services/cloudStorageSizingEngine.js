/**
 * Cloud Storage — additive measured sizing model.
 * Modeled planning defaults from synthetic samples — not official vendor sizing.
 */

import cloudStorageRates from '../data/cloudStorageSizingRates.json';
import { normalizeIaasState, parseCount } from './iaasSizingEngine.js';

export const CLOUD_STORAGE_SOURCE_ID = 'iaas_storage';
export const CLOUD_STORAGE_REVIEW_SUMMARY =
  'Cloud Storage sizing uses vendor, storage asset count, and selected storage log components.';
export const CLOUD_STORAGE_VALIDATION_NOTE = 'Validate with a 24-hour sample when available.';

const VENDOR_OPTIONS = Object.entries(cloudStorageRates.vendors).map(([id, v]) => ({
  id,
  label: v.label,
  assetUnitLabel: v.assetUnitLabel,
}));

const COMPONENT_TOGGLE_MAP = {
  management_audit: 'includeManagementAudit',
  access_request: 'includeAccessRequestLogs',
  lifecycle_replication: 'includeLifecycleReplication',
  performance_health: 'includePerformanceHealth',
};

export const PROFILE_TOGGLES = {
  base_storage_telemetry: {
    includeManagementAudit: true,
    includeAccessRequestLogs: false,
    includeLifecycleReplication: true,
    includePerformanceHealth: true,
  },
  full_storage_access_logs: {
    includeManagementAudit: true,
    includeAccessRequestLogs: true,
    includeLifecycleReplication: true,
    includePerformanceHealth: true,
  },
};

const LEGACY_VENDOR_MAP = {
  aws: 'aws_s3',
  s3: 'aws_s3',
  'aws s3': 'aws_s3',
  'amazon s3': 'aws_s3',
  azure: 'azure_storage',
  'azure storage': 'azure_storage',
  'azure blob': 'azure_storage',
  'azure blob storage': 'azure_storage',
  gcp: 'google_cloud_storage',
  gcs: 'google_cloud_storage',
  'google cloud storage': 'google_cloud_storage',
  'gcp cloud storage': 'google_cloud_storage',
  netapp: 'netapp_cloud_volumes',
  'netapp cloud volumes': 'netapp_cloud_volumes',
  dell: 'dell_powerscale',
  powerscale: 'dell_powerscale',
  'dell powerscale': 'dell_powerscale',
  'dell apex': 'dell_powerscale',
};

export function getCloudStorageVendorOptions() {
  return VENDOR_OPTIONS;
}

export function getCloudStorageProfileOptions() {
  return Object.entries(cloudStorageRates.collectionProfiles || {}).map(([id, p]) => ({
    id,
    label: p.label,
    description: p.description,
  }));
}

export function getCloudStorageVendorMeta(vendorId) {
  return cloudStorageRates.vendors[vendorId] || cloudStorageRates.vendors.average_blended;
}

/** @param {number} value */
export function formatCloudStorageGb(value) {
  const v = Number(value);
  if (!Number.isFinite(v) || v === 0) return '0';
  if (v >= 10) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.1) return v.toFixed(2);
  return v.toFixed(3);
}

function parseToggle(value, defaultTrue = true) {
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value == null || value === '') return defaultTrue;
  return defaultTrue;
}

function resolveEffectiveToggles(state) {
  const profile =
    state.cloudStorageCollectionProfile === 'full_storage_access_logs'
      ? 'full_storage_access_logs'
      : 'base_storage_telemetry';
  const preset = PROFILE_TOGGLES[profile];
  if (!state.cloudStorageCustomizeComponents) {
    return { ...preset };
  }
  const raw =
    state.cloudStorageComponentToggles && typeof state.cloudStorageComponentToggles === 'object'
      ? state.cloudStorageComponentToggles
      : {};
  return {
    includeManagementAudit: parseToggle(raw.includeManagementAudit, preset.includeManagementAudit),
    includeAccessRequestLogs: parseToggle(raw.includeAccessRequestLogs, preset.includeAccessRequestLogs),
    includeLifecycleReplication: parseToggle(
      raw.includeLifecycleReplication,
      preset.includeLifecycleReplication,
    ),
    includePerformanceHealth: parseToggle(raw.includePerformanceHealth, preset.includePerformanceHealth),
  };
}

export function normalizeCloudStorageState(inputState = {}) {
  const state = { ...inputState };

  let vendor = state.cloudStorageVendor;
  if (!vendor || !cloudStorageRates.vendors[vendor]) {
    const vendorKey = String(state.vendor || '').trim().toLowerCase();
    vendor = LEGACY_VENDOR_MAP[vendorKey] || 'average_blended';
  }
  state.cloudStorageVendor = vendor;

  if (state.cloudStorageAssetCount == null || state.cloudStorageAssetCount === '') {
    if (state.count != null && state.count !== '') {
      state.cloudStorageAssetCount = String(state.count);
    } else {
      state.cloudStorageAssetCount = '';
    }
  } else {
    state.cloudStorageAssetCount = String(state.cloudStorageAssetCount);
  }

  state.cloudStorageCollectionProfile =
    state.cloudStorageCollectionProfile === 'full_storage_access_logs'
      ? 'full_storage_access_logs'
      : 'base_storage_telemetry';

  state.cloudStorageCustomizeComponents = Boolean(state.cloudStorageCustomizeComponents);
  state.cloudStorageComponentToggles = { ...resolveEffectiveToggles(state) };
  state.count = state.cloudStorageAssetCount;

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
    rateSource: 'cloud_storage_additive',
    needsReview: true,
    countBasis: 'storage assets',
    vendorMultiplier: 1.0,
    scopeMultiplier: 1.0,
    bufferApplied: false,
    cloudStorageBreakdown: [],
  };
}

function isComponentEnabled(toggles, componentId) {
  const key = COMPONENT_TOGGLE_MAP[componentId];
  return key ? toggles[key] !== false : false;
}

function sourceHasActiveCount(ss) {
  if (!ss || (ss.status !== 'current' && ss.status !== 'future')) return false;
  return (
    parseCount(ss.count) > 0 ||
    parseCount(ss.cloudStorageAssetCount) > 0 ||
    parseCount(ss.number_of_systems) > 0
  );
}

/**
 * @param {object} inputState
 * @param {{ allInputs?: Record<string, object> }} [sizingContext]
 */
export function calculateCloudStorageSizing(inputState, sizingContext = {}) {
  const result = emptyResult();
  if (!inputState) return result;

  const state = normalizeCloudStorageState(inputState);
  const vendor = getCloudStorageVendorMeta(state.cloudStorageVendor);
  const assets = parseCount(state.cloudStorageAssetCount);
  const toggles = state.cloudStorageComponentToggles;

  if (assets <= 0) {
    result.warnings.push('Enter the number of storage assets to estimate ingest.');
    return result;
  }

  const components = vendor.components;
  const breakdown = [];
  let low = 0;
  let expected = 0;
  let high = 0;

  for (const [id, def] of Object.entries(components)) {
    if (!isComponentEnabled(toggles, id)) continue;
    const rowLow = def.low * assets;
    const rowMed = def.medium * assets;
    const rowHigh = def.high * assets;
    low += rowLow;
    expected += rowMed;
    high += rowHigh;
    breakdown.push({
      id,
      label: def.label,
      count: assets,
      unit: def.unit,
      lowGb: rowLow,
      mediumGb: rowMed,
      highGb: rowHigh,
    });
  }

  result.low = low;
  result.expected = expected;
  result.high = high;
  result.cloudStorageBreakdown = breakdown;
  result.confidence = breakdown.length ? 'medium' : 'none';
  result.needsReview = true;
  result.assumptions = [
    `Vendor: ${vendor.label || state.cloudStorageVendor}`,
    'Storage ingest is estimated from vendor, storage asset count, and selected log components.',
    CLOUD_STORAGE_VALIDATION_NOTE,
    'Modeled planning defaults — not official vendor sizing.',
  ];

  const overlap = detectCloudStorageOverlap(state, sizingContext.allInputs);
  if (overlap) result.warnings.push(overlap);

  return result;
}

/** @returns {string|null} */
export function detectCloudStorageOverlap(storageState, allInputs = {}) {
  const normalized = normalizeCloudStorageState(storageState);
  const overlapIds = cloudStorageRates.overlapSourceIds || [];
  const activeOverlap = overlapIds.filter((id) => {
    const ss = allInputs[id];
    if (!ss || (ss.status !== 'current' && ss.status !== 'future')) return false;
    if (id === 'iaas') {
      const iaas = normalizeIaasState(ss);
      if (iaas.iaasSizingMode !== 'advanced') return true;
      return parseCount(iaas.iaasAdvancedCounts?.storageBuckets) > 0;
    }
    return sourceHasActiveCount(ss);
  });

  if (activeOverlap.length === 0) return null;
  return 'Cloud storage logs can overlap with application, web, backup, DLP, CASB, or IaaS storage logs. Confirm whether these logs are sized here or separately.';
}

export function getCloudStorageSizingReviewDisplay(sizingResult) {
  if (!sizingResult?.cloudStorageBreakdown?.length) {
    return {
      summary: CLOUD_STORAGE_REVIEW_SUMMARY,
      rows: [],
      validationNote: CLOUD_STORAGE_VALIDATION_NOTE,
    };
  }
  return {
    summary: CLOUD_STORAGE_REVIEW_SUMMARY,
    rows: sizingResult.cloudStorageBreakdown.map((r) => ({
      label: r.label,
      count: r.count,
      unit: r.unit,
      mediumGb: r.mediumGb,
    })),
    validationNote: CLOUD_STORAGE_VALIDATION_NOTE,
  };
}

export { cloudStorageRates };
