/**
 * Cloud Instances / VMs — additive measured sizing model.
 * Modeled planning defaults from synthetic samples — not official vendor sizing.
 */

import cloudVmRates from '../data/cloudVmSizingRates.json';
import { normalizeIaasState, parseCount } from './iaasSizingEngine.js';

export const CLOUD_VM_SOURCE_ID = 'iaas_instances';
export const CLOUD_VM_REVIEW_SUMMARY =
  'Cloud VM sizing uses provider, instance count, and selected VM log components.';
export const CLOUD_VM_VALIDATION_NOTE = 'Validate with a 24-hour sample when available.';

const PROVIDER_OPTIONS = Object.entries(cloudVmRates.providers).map(([id, p]) => ({
  id,
  label: p.label,
}));

const COMPONENT_TOGGLE_MAP = {
  os_system: 'includeOsSystemLogs',
  auth_security: 'includeAuthSecurityLogs',
  agent_platform: 'includeAgentPlatformLogs',
  application_service: 'includeApplicationServiceLogs',
};

const PROFILE_TOGGLES = {
  minimal_vm_telemetry: {
    includeOsSystemLogs: true,
    includeAuthSecurityLogs: true,
    includeAgentPlatformLogs: true,
    includeApplicationServiceLogs: false,
  },
  base_vm_telemetry: {
    includeOsSystemLogs: true,
    includeAuthSecurityLogs: true,
    includeAgentPlatformLogs: true,
    includeApplicationServiceLogs: false,
  },
  standard_vm_logs: {
    includeOsSystemLogs: true,
    includeAuthSecurityLogs: true,
    includeAgentPlatformLogs: true,
    includeApplicationServiceLogs: false,
  },
  full_vm_logs: {
    includeOsSystemLogs: true,
    includeAuthSecurityLogs: true,
    includeAgentPlatformLogs: true,
    includeApplicationServiceLogs: true,
  },
};

const LEGACY_VENDOR_PROVIDER = {
  aws: 'aws_ec2',
  'aws ec2': 'aws_ec2',
  ec2: 'aws_ec2',
  'amazon ec2': 'aws_ec2',
  azure: 'azure_vms',
  'azure vms': 'azure_vms',
  'microsoft azure': 'azure_vms',
  gcp: 'gcp_compute',
  'google compute': 'gcp_compute',
  'google compute engine': 'gcp_compute',
  'gcp compute': 'gcp_compute',
  vmware: 'vmware_cloud',
  'vmware cloud': 'vmware_cloud',
  oci: 'oci_compute',
  'oracle cloud': 'oci_compute',
  'oracle cloud compute': 'oci_compute',
};

export function getCloudVmProviderOptions() {
  return PROVIDER_OPTIONS;
}

export function getCloudVmProfileOptions() {
  return Object.entries(cloudVmRates.collectionProfiles || {}).map(([id, p]) => ({
    id,
    label: p.label,
    description: p.description,
  }));
}

export function getCloudVmProviderMeta(providerId) {
  return cloudVmRates.providers[providerId] || cloudVmRates.providers.average_blended;
}

/** @param {number} value */
export function formatCloudVmGb(value) {
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
  const profile = state.cloudVmCollectionProfile;
  const presetKey =
    profile === 'full_vm_logs'
      ? 'full_vm_logs'
      : profile === 'minimal_vm_telemetry' || profile === 'base_vm_telemetry'
        ? 'minimal_vm_telemetry'
        : 'standard_vm_logs';
  const preset = PROFILE_TOGGLES[presetKey] || PROFILE_TOGGLES.standard_vm_logs;
  if (!state.cloudVmCustomizeComponents) {
    return { ...preset };
  }
  const raw = state.cloudVmComponentToggles && typeof state.cloudVmComponentToggles === 'object'
    ? state.cloudVmComponentToggles
    : {};
  return {
    includeOsSystemLogs: parseToggle(raw.includeOsSystemLogs, preset.includeOsSystemLogs),
    includeAuthSecurityLogs: parseToggle(raw.includeAuthSecurityLogs, preset.includeAuthSecurityLogs),
    includeAgentPlatformLogs: parseToggle(raw.includeAgentPlatformLogs, preset.includeAgentPlatformLogs),
    includeApplicationServiceLogs: parseToggle(
      raw.includeApplicationServiceLogs,
      preset.includeApplicationServiceLogs,
    ),
  };
}

export function normalizeCloudVmState(inputState = {}) {
  const state = { ...inputState };

  let provider = state.cloudVmProvider;
  if (!provider || !cloudVmRates.providers[provider]) {
    const vendorKey = String(state.vendor || '').trim().toLowerCase();
    provider = LEGACY_VENDOR_PROVIDER[vendorKey] || 'average_blended';
  }
  state.cloudVmProvider = provider;

  if (state.cloudVmInstanceCount == null || state.cloudVmInstanceCount === '') {
    if (state.count != null && state.count !== '') {
      state.cloudVmInstanceCount = String(state.count);
    } else {
      state.cloudVmInstanceCount = '';
    }
  } else {
    state.cloudVmInstanceCount = String(state.cloudVmInstanceCount);
  }

  state.cloudVmCollectionProfile =
    state.cloudVmCollectionProfile === 'full_vm_logs'
      ? 'full_vm_logs'
      : state.cloudVmCollectionProfile === 'minimal_vm_telemetry'
        || state.cloudVmCollectionProfile === 'base_vm_telemetry'
        ? 'minimal_vm_telemetry'
        : state.cloudVmCollectionProfile === 'standard_vm_logs'
          ? 'standard_vm_logs'
          : 'standard_vm_logs';

  state.cloudVmCustomizeComponents = Boolean(state.cloudVmCustomizeComponents);

  const effective = resolveEffectiveToggles(state);
  state.cloudVmComponentToggles = { ...effective };

  state.count = state.cloudVmInstanceCount;

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
    rateSource: 'cloud_vm_additive',
    needsReview: true,
    countBasis: 'cloud VM instances',
    vendorMultiplier: 1.0,
    scopeMultiplier: 1.0,
    bufferApplied: false,
    cloudVmBreakdown: [],
  };
}

function isComponentEnabled(toggles, componentId) {
  const key = COMPONENT_TOGGLE_MAP[componentId];
  return key ? toggles[key] !== false : false;
}

/**
 * @param {object} inputState
 * @param {{ allInputs?: Record<string, object> }} [sizingContext]
 */
export function calculateCloudVmSizing(inputState, sizingContext = {}) {
  const result = emptyResult();
  if (!inputState) return result;

  const state = normalizeCloudVmState(inputState);
  const provider = getCloudVmProviderMeta(state.cloudVmProvider);
  const instances = parseCount(state.cloudVmInstanceCount);
  const toggles = state.cloudVmComponentToggles;

  if (instances <= 0) {
    result.warnings.push('Enter the number of cloud VMs or instances to estimate ingest.');
    return result;
  }

  const components = provider.components;
  const breakdown = [];
  let low = 0;
  let expected = 0;
  let high = 0;

  for (const [id, def] of Object.entries(components)) {
    if (!isComponentEnabled(toggles, id)) continue;
    const rowLow = def.low * instances;
    const rowMed = def.medium * instances;
    const rowHigh = def.high * instances;
    low += rowLow;
    expected += rowMed;
    high += rowHigh;
    breakdown.push({
      id,
      label: def.label,
      count: instances,
      unit: def.unit,
      lowGb: rowLow,
      mediumGb: rowMed,
      highGb: rowHigh,
    });
  }

  result.low = low;
  result.expected = expected;
  result.high = high;
  result.cloudVmBreakdown = breakdown;
  result.confidence = breakdown.length ? 'medium' : 'none';
  result.needsReview = true;
  result.assumptions = [
    `Provider: ${provider.label || state.cloudVmProvider}`,
    'VM ingest is estimated from provider, instance count, and selected log components.',
    CLOUD_VM_VALIDATION_NOTE,
    'Modeled planning defaults — not official vendor sizing.',
  ];

  const overlap = detectCloudVmOverlap(state, sizingContext.allInputs);
  if (overlap) result.warnings.push(overlap);

  return result;
}

function sourceHasActiveCount(ss) {
  if (!ss || (ss.status !== 'current' && ss.status !== 'future')) return false;
  return (
    parseCount(ss.count) > 0 ||
    parseCount(ss.cloudVmInstanceCount) > 0 ||
    parseCount(ss.number_of_servers) > 0 ||
    parseCount(ss.number_of_instances) > 0 ||
    parseCount(ss.number_of_systems) > 0 ||
    parseCount(ss.number_of_endpoints) > 0
  );
}

/** @returns {string|null} */
export function detectCloudVmOverlap(cloudVmState, allInputs = {}) {
  const normalized = normalizeCloudVmState(cloudVmState);
  const overlapIds = cloudVmRates.overlapSourceIds || [];
  const activeOverlap = overlapIds.filter((id) => {
    const ss = allInputs[id];
    if (!ss || (ss.status !== 'current' && ss.status !== 'future')) return false;
    if (id === 'iaas') {
      const iaas = normalizeIaasState(ss);
      if (iaas.iaasSizingMode !== 'advanced') return true;
      return parseCount(iaas.iaasAdvancedCounts?.instances) > 0;
    }
    return sourceHasActiveCount(ss);
  });

  if (activeOverlap.length === 0) return null;
  return 'Cloud VM logs can overlap with server, application, web, container, or observability sources. Confirm whether these logs are sized here or separately.';
}

export function getCloudVmSizingReviewDisplay(sizingResult) {
  if (!sizingResult?.cloudVmBreakdown?.length) {
    return {
      summary: CLOUD_VM_REVIEW_SUMMARY,
      rows: [],
      validationNote: CLOUD_VM_VALIDATION_NOTE,
    };
  }
  return {
    summary: CLOUD_VM_REVIEW_SUMMARY,
    rows: sizingResult.cloudVmBreakdown.map((r) => ({
      label: r.label,
      count: r.count,
      unit: r.unit,
      mediumGb: r.mediumGb,
    })),
    validationNote: CLOUD_VM_VALIDATION_NOTE,
  };
}

export { cloudVmRates, PROFILE_TOGGLES };
