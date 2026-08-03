/**
 * SaaS (General) — tenant + active-user + integration additive sizing model v2.
 * Modeled planning defaults from synthetic raw event samples — not official vendor sizing.
 */

import saasRates from '../data/saasSizingRates.json';
import { parseCount } from './iaasSizingEngine.js';

export const SAAS_SOURCE_ID = 'saas_general';
export const SAAS_REVIEW_SUMMARY_TEXT =
  'SaaS sizing uses vendor, tenant count, active users, integrations, collection profile, and activity level.';
export const SAAS_VALIDATION_NOTE = 'Validate with a 24-hour customer sample when available.';

const VENDOR_OPTIONS = Object.entries(saasRates.vendors).map(([id, v]) => ({
  id,
  label: v.label,
}));

const PROFILE_COMPONENTS = {
  audit_only: ['admin_config_audit', 'auth_access_security'],
  standard_activity: ['admin_config_audit', 'auth_access_security', 'user_activity_content'],
  full_activity: [
    'admin_config_audit',
    'auth_access_security',
    'user_activity_content',
    'api_integration_events',
  ],
};

const ACTIVITY_TIER = {
  light: 'low',
  normal: 'medium',
  heavy: 'high',
};

const LEGACY_VENDOR_MAP = {
  salesforce: 'salesforce',
  servicenow: 'servicenow',
  'service now': 'servicenow',
  workday: 'workday',
  box: 'box',
  atlassian: 'atlassian_cloud',
  'atlassian cloud': 'atlassian_cloud',
  jira: 'atlassian_cloud',
  confluence: 'atlassian_cloud',
};

export function getSaaSVendorOptions() {
  return VENDOR_OPTIONS;
}

export function getSaaSProfileOptions() {
  return Object.entries(saasRates.collectionProfiles || {}).map(([id, p]) => ({
    id,
    label: p.label,
    description: p.description,
  }));
}

export function getSaaSActivityLevelOptions() {
  return Object.entries(saasRates.activityLevels || {}).map(([id, p]) => ({
    id,
    label: p.label,
    tier: p.tier,
  }));
}

export function getSaaSVendorMeta(vendorId) {
  return saasRates.vendors[vendorId] || saasRates.vendors.average_blended;
}

/**
 * Adaptive display: GB/day when >= 0.1, else MB/day. Never show 0.000000.
 * @returns {{ text: string, unit: string, gb: number }}
 */
export function formatSaaSIngest(gb) {
  const v = Number(gb);
  if (!Number.isFinite(v) || v === 0) {
    return { text: '0', unit: '', gb: 0 };
  }
  if (v >= 0.1) {
    let text;
    if (v >= 10) text = v.toFixed(1);
    else if (v >= 1) text = v.toFixed(2);
    else text = v.toFixed(2);
    return { text, unit: 'GB/day', gb: v };
  }
  const mb = v * 1024;
  let text;
  if (mb >= 10) text = mb.toFixed(1);
  else if (mb >= 1) text = mb.toFixed(2);
  else text = mb.toFixed(2);
  return { text, unit: 'MB/day', gb: v };
}

/** @param {number} gb */
export function formatSaaSIngestString(gb) {
  const f = formatSaaSIngest(gb);
  if (!f.unit) return '0';
  return `${f.text} ${f.unit}`;
}

export function normalizeSaaSState(inputState = {}) {
  const state = { ...inputState };

  let vendor = state.saasVendor;
  if (!vendor || !saasRates.vendors[vendor]) {
    const vendorKey = String(state.vendor || '').trim().toLowerCase();
    vendor = LEGACY_VENDOR_MAP[vendorKey] || 'average_blended';
  }
  state.saasVendor = vendor;

  if (state.saasTenantCount == null || state.saasTenantCount === '') {
    const platforms = state.number_of_platforms;
    if (platforms != null && platforms !== '') {
      state.saasTenantCount = String(platforms);
    } else {
      state.saasTenantCount = state.saasTenantCount ?? '';
    }
  }
  if (state.saasTenantCount === undefined || state.saasTenantCount === null) {
    state.saasTenantCount = '';
  } else {
    state.saasTenantCount = String(state.saasTenantCount);
  }

  if (state.saasActiveUsers == null || state.saasActiveUsers === '') {
    if (state.number_of_users != null && state.number_of_users !== '') {
      state.saasActiveUsers = String(state.number_of_users);
    } else if (state.count != null && state.count !== '') {
      state.saasActiveUsers = String(state.count);
    } else {
      state.saasActiveUsers = '';
    }
  } else {
    state.saasActiveUsers = String(state.saasActiveUsers);
  }

  if (state.saasIntegrationCount == null || state.saasIntegrationCount === '') {
    state.saasIntegrationCount = '';
  } else {
    state.saasIntegrationCount = String(state.saasIntegrationCount);
  }

  const profile = state.saasCollectionProfile;
  state.saasCollectionProfile =
    profile === 'audit_only' || profile === 'full_activity' ? profile : 'standard_activity';

  const level = state.saasActivityLevel;
  state.saasActivityLevel =
    level === 'light' || level === 'heavy' ? level : 'normal';

  state.number_of_users = state.saasActiveUsers;

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
    rateSource: 'saas_additive_v2',
    needsReview: true,
    countBasis: 'tenants + active users + integrations',
    vendorMultiplier: 1.0,
    scopeMultiplier: 1.0,
    bufferApplied: false,
    saasBreakdown: [],
  };
}

function componentCount(componentId, tenants, users, integrations) {
  if (componentId === 'admin_config_audit') return tenants;
  if (componentId === 'api_integration_events') return integrations;
  return users;
}

function calcForTier(vendorMeta, profileKey, tier, tenants, users, integrations) {
  const components = PROFILE_COMPONENTS[profileKey] || PROFILE_COMPONENTS.standard_activity;
  let low = 0;
  let expected = 0;
  let high = 0;
  const breakdown = [];

  for (const compId of components) {
    const def = vendorMeta.components[compId];
    if (!def) continue;
    const count = componentCount(compId, tenants, users, integrations);
    if (count <= 0) continue;
    const rowLow = def.low * count;
    const rowMed = def.medium * count;
    const rowHigh = def.high * count;
    low += rowLow;
    expected += def[tier] * count;
    high += rowHigh;
    breakdown.push({
      id: compId,
      label: def.label,
      count,
      unit: def.unitLabel || def.unit,
      lowGb: rowLow,
      mediumGb: rowMed,
      highGb: rowHigh,
      tierGb: def[tier] * count,
    });
  }

  return { low, expected, high, breakdown };
}

/**
 * @param {object} inputState
 * @param {{ allInputs?: Record<string, object> }} [sizingContext]
 */
export function calculateSaaSSizing(inputState, sizingContext = {}) {
  const result = emptyResult();
  if (!inputState) return result;

  const state = normalizeSaaSState(inputState);
  const vendor = getSaaSVendorMeta(state.saasVendor);
  const tenants = parseCount(state.saasTenantCount);
  const users = parseCount(state.saasActiveUsers);
  const integrations = parseCount(state.saasIntegrationCount);
  const profile = state.saasCollectionProfile;
  const activityTier = ACTIVITY_TIER[state.saasActivityLevel] || 'medium';

  if (tenants <= 0 && users <= 0 && integrations <= 0) {
    result.warnings.push(
      'Enter tenant/org count, active users, or integrations to estimate ingest.',
    );
    return result;
  }

  if (profile !== 'audit_only' && users <= 0) {
    result.warnings.push('Missing active users for SaaS activity sizing.');
    result.confidence = 'none';
    return result;
  }

  if (profile === 'audit_only') {
    result.assumptions.push(
      'Audit-only tenant baseline. User activity and integrations are not included.',
    );
  }

  const light = calcForTier(vendor, profile, 'low', tenants, users, integrations);
  const selected = calcForTier(vendor, profile, activityTier, tenants, users, integrations);
  const heavy = calcForTier(vendor, profile, 'high', tenants, users, integrations);

  result.low = light.low;
  result.expected = selected.expected;
  result.high = heavy.high;
  result.saasBreakdown = selected.breakdown.map((row) => ({
    ...row,
    displayGb: row.tierGb,
  }));
  result.confidence = selected.breakdown.length ? 'medium' : 'none';
  result.needsReview = true;
  result.assumptions = [
    `Vendor: ${vendor.label || state.saasVendor}`,
    `Collection profile: ${saasRates.collectionProfiles[profile]?.label || profile}`,
    `Activity level: ${saasRates.activityLevels[state.saasActivityLevel]?.label || state.saasActivityLevel}`,
    'SaaS ingest is estimated from vendor, tenant count, active users, integrations, and selected log components.',
    'Modeled Splunk ingest planning defaults measured from synthetic raw event samples.',
    SAAS_VALIDATION_NOTE,
  ];

  const overlap = detectSaaSOverlap(state, sizingContext.allInputs);
  if (overlap) result.warnings.push(overlap);

  return result;
}

function sourceActive(ss) {
  if (!ss || (ss.status !== 'current' && ss.status !== 'future')) return false;
  return (
    parseCount(ss.count) > 0 ||
    parseCount(ss.saasActiveUsers) > 0 ||
    parseCount(ss.number_of_users) > 0
  );
}

/** @returns {string|null} */
export function detectSaaSOverlap(saasState, allInputs = {}) {
  const overlapIds = saasRates.overlapSourceIds || [];
  const active = overlapIds.filter((id) => sourceActive(allInputs[id]));
  if (active.length === 0) return null;
  return 'SaaS logs can overlap with dedicated Office, CRM, SSO, file-sharing, CASB, or DLP sources. Confirm whether these logs are sized here or separately.';
}

export function getSaaSSizingReviewDisplay(sizingResult) {
  if (!sizingResult?.saasBreakdown?.length) {
    return {
      summary: SAAS_REVIEW_SUMMARY_TEXT,
      rows: [],
      validationNote: SAAS_VALIDATION_NOTE,
    };
  }
  return {
    summary: SAAS_REVIEW_SUMMARY_TEXT,
    rows: sizingResult.saasBreakdown.map((r) => ({
      label: r.label,
      count: r.count,
      unit: r.unit,
      displayGb: r.displayGb,
    })),
    validationNote: SAAS_VALIDATION_NOTE,
  };
}

export { saasRates, PROFILE_COMPONENTS };
