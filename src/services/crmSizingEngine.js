/**
 * CRM — tenant + active-user + integration additive sizing model.
 * Modeled planning defaults from synthetic samples — not official vendor sizing.
 */

import crmRates from '../data/crmSizingRates.json';
import { parseCount } from './iaasSizingEngine.js';
import {
  calculateWorkbookSimpleSizing,
  shouldUseWorkbookSimpleSizing,
  applyWorkbookSimpleToResult,
} from './workbookSimpleSizing.js';

export const CRM_SOURCE_ID = 'saas_crm';
export const CRM_REVIEW_SUMMARY_TEXT =
  'CRM sizing uses vendor, tenant count, active CRM users, integrations, selected CRM log components, and activity level.';
export const CRM_VALIDATION_NOTE = 'Validate with a 24-hour sample when available.';
export const CRM_DAILY_OVERRIDE_NOTE =
  'CRM sizing uses provided daily event counts for one or more components.';

const VENDOR_OPTIONS = Object.entries(crmRates.vendors).map(([id, v]) => ({
  id,
  label: v.label,
}));

const ACTIVITY_TIER = {
  light: 'low',
  normal: 'medium',
  heavy: 'high',
};

const LEGACY_VENDOR_MAP = {
  salesforce: 'salesforce',
  hubspot: 'hubspot',
  'dynamics 365': 'dynamics_365',
  dynamics: 'dynamics_365',
  zendesk: 'zendesk',
  servicenow: 'servicenow_csm',
  'service now': 'servicenow_csm',
};

const DAILY_EVENT_FIELDS = [
  'dailyAdminAuditEvents',
  'dailyLoginAccessEvents',
  'dailyCrmRecordEvents',
  'dailyApiIntegrationEvents',
];

export function getCrmVendorOptions() {
  return VENDOR_OPTIONS;
}

export function getCrmProfileOptions() {
  return Object.entries(crmRates.collectionProfiles || {}).map(([id, p]) => ({
    id,
    label: p.label,
    description: p.description,
  }));
}

export function getCrmActivityLevelOptions() {
  return Object.entries(crmRates.activityLevels || {}).map(([id, p]) => ({
    id,
    label: p.label,
    tier: p.tier,
  }));
}

export function getCrmVendorMeta(vendorId) {
  return crmRates.vendors[vendorId] || crmRates.vendors.average_blended;
}

/** @param {number} gb */
export function formatCrmIngest(gb) {
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
export function formatCrmIngestString(gb) {
  const f = formatCrmIngest(gb);
  if (!f.unit) return '0';
  return `${f.text} ${f.unit}`;
}

function parseToggle(value, defaultTrue = true) {
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value == null || value === '') return defaultTrue;
  return defaultTrue;
}

function buildProfileToggles(profileId) {
  const componentIds = crmRates.profileComponents?.[profileId] || [];
  const toggles = {
    includeAdminConfigAudit: false,
    includeLoginAccessSecurity: false,
    includeCrmRecordActivity: false,
    includeApiIntegrationEvents: false,
  };
  const toggleByComponent = {
    admin_config_audit: 'includeAdminConfigAudit',
    login_access_security: 'includeLoginAccessSecurity',
    crm_record_activity: 'includeCrmRecordActivity',
    api_integration_events: 'includeApiIntegrationEvents',
  };
  for (const compId of componentIds) {
    const key = toggleByComponent[compId];
    if (key) toggles[key] = true;
  }
  return toggles;
}

function resolveEffectiveToggles(state, profile) {
  const preset = buildProfileToggles(profile);
  if (!state.crmCustomizeComponents) {
    return { ...preset };
  }
  const raw =
    state.crmComponentToggles && typeof state.crmComponentToggles === 'object'
      ? state.crmComponentToggles
      : {};
  return {
    includeAdminConfigAudit: parseToggle(raw.includeAdminConfigAudit, preset.includeAdminConfigAudit),
    includeLoginAccessSecurity: parseToggle(
      raw.includeLoginAccessSecurity,
      preset.includeLoginAccessSecurity,
    ),
    includeCrmRecordActivity: parseToggle(raw.includeCrmRecordActivity, preset.includeCrmRecordActivity),
    includeApiIntegrationEvents: parseToggle(
      raw.includeApiIntegrationEvents,
      preset.includeApiIntegrationEvents,
    ),
  };
}

export function normalizeCrmState(inputState = {}) {
  const state = { ...inputState };
  const isActive = state.status === 'current' || state.status === 'future';

  let vendor = state.crmVendor;
  if (!vendor || !crmRates.vendors[vendor]) {
    const vendorKey = String(state.vendor || '').trim().toLowerCase();
    vendor = LEGACY_VENDOR_MAP[vendorKey] || 'average_blended';
  }
  state.crmVendor = vendor;

  if (state.crmTenantCount == null || state.crmTenantCount === '') {
    state.crmTenantCount = isActive ? '1' : '';
  } else {
    state.crmTenantCount = String(state.crmTenantCount);
  }

  const legacyCount =
    state.count != null && state.count !== '' ? String(state.count) : '';
  state.crmActiveUserCount =
    state.crmActiveUserCount == null || state.crmActiveUserCount === ''
      ? legacyCount
      : String(state.crmActiveUserCount);
  state.crmIntegrationCount =
    state.crmIntegrationCount == null || state.crmIntegrationCount === ''
      ? ''
      : String(state.crmIntegrationCount);

  const profile = state.crmCollectionProfile;
  state.crmCollectionProfile =
    profile === 'audit_only' || profile === 'full_crm_activity'
      ? profile
      : 'standard_crm_activity';

  const level = state.crmActivityLevel;
  state.crmActivityLevel = level === 'light' || level === 'heavy' ? level : 'normal';

  state.crmCustomizeComponents = Boolean(state.crmCustomizeComponents);
  state.crmUseDailyEventCounts = Boolean(state.crmUseDailyEventCounts);

  for (const field of DAILY_EVENT_FIELDS) {
    if (state[field] == null || state[field] === '') {
      state[field] = '';
    } else {
      state[field] = String(state[field]);
    }
  }

  state.crmComponentToggles = { ...resolveEffectiveToggles(state, state.crmCollectionProfile) };
  state.count = state.crmActiveUserCount || legacyCount;

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
    rateSource: 'crm_additive',
    needsReview: true,
    countBasis: 'tenants + CRM users + integrations',
    vendorMultiplier: 1.0,
    scopeMultiplier: 1.0,
    bufferApplied: false,
    crmBreakdown: [],
    crmVendor: 'average_blended',
    crmUsesDailyEventOverrides: false,
  };
}

function isToggleEnabled(toggles, toggleKey) {
  return toggleKey ? toggles[toggleKey] !== false : true;
}

function gbFromDailyEvents(bytesPerEvent, dailyEvents) {
  const events = parseCount(dailyEvents);
  const bytes = Number(bytesPerEvent);
  if (events <= 0 || !Number.isFinite(bytes) || bytes <= 0) return null;
  return (bytes * events) / 1024 ** 3;
}

function componentGbForTier(def, state, tier, useDailyOverrides) {
  if (useDailyOverrides && def.dailyEventField) {
    const overrideGb = gbFromDailyEvents(def.avgBytesMedium, state[def.dailyEventField]);
    if (overrideGb != null) {
      return { low: overrideGb, medium: overrideGb, high: overrideGb, fromOverride: true };
    }
  }
  const count = parseCount(state[def.countField]);
  if (count <= 0) return null;
  return {
    low: def.low * count,
    medium: def.medium * count,
    high: def.high * count,
    fromOverride: false,
    count,
  };
}

function calcBands(vendorMeta, state, profile, toggles, useDailyOverrides) {
  const profileIds = crmRates.profileComponents?.[profile] || [];
  const componentIds = state.crmCustomizeComponents
    ? Object.keys(vendorMeta.components || {})
    : profileIds;

  const breakdown = [];
  let low = 0;
  let medium = 0;
  let high = 0;
  let usesOverride = false;

  for (const compId of componentIds) {
    const def = vendorMeta.components?.[compId];
    if (!def) continue;
    if (!state.crmCustomizeComponents && !profileIds.includes(compId)) continue;
    if (!isToggleEnabled(toggles, def.toggleKey)) continue;

    const bands = componentGbForTier(def, state, 'medium', useDailyOverrides);
    if (!bands) continue;

    low += bands.low;
    medium += bands.medium;
    high += bands.high;
    if (bands.fromOverride) usesOverride = true;

    breakdown.push({
      id: compId,
      label: def.label,
      count: bands.count ?? parseCount(state[def.countField]),
      unit: def.unitLabel || def.unit,
      lowGb: bands.low,
      mediumGb: bands.medium,
      highGb: bands.high,
      fromDailyOverride: bands.fromOverride,
    });
  }

  return { low, medium, high, breakdown, usesOverride };
}

function calcForActivityTier(vendorMeta, state, profile, toggles, tier, useDailyOverrides) {
  const profileIds = crmRates.profileComponents?.[profile] || [];
  const componentIds = state.crmCustomizeComponents
    ? Object.keys(vendorMeta.components || {})
    : profileIds;

  let total = 0;
  const breakdown = [];

  for (const compId of componentIds) {
    const def = vendorMeta.components?.[compId];
    if (!def) continue;
    if (!state.crmCustomizeComponents && !profileIds.includes(compId)) continue;
    if (!isToggleEnabled(toggles, def.toggleKey)) continue;

    let tierGb;
    let fromOverride = false;
    let count = parseCount(state[def.countField]);

    if (useDailyOverrides && def.dailyEventField) {
      const overrideGb = gbFromDailyEvents(def.avgBytesMedium, state[def.dailyEventField]);
      if (overrideGb != null) {
        tierGb = overrideGb;
        fromOverride = true;
        count = parseCount(state[def.dailyEventField]);
      }
    }

    if (tierGb == null) {
      if (count <= 0) continue;
      tierGb = def[tier] * count;
    }

    total += tierGb;
    breakdown.push({
      id: compId,
      label: def.label,
      count,
      unit: def.unitLabel || def.unit,
      tierGb,
      fromDailyOverride: fromOverride,
    });
  }

  return { expected: total, breakdown };
}

/**
 * @param {object} inputState
 * @param {{ allInputs?: Record<string, object> }} [sizingContext]
 */
export function calculateCrmSizing(inputState, sizingContext = {}) {
  const result = emptyResult();
  if (!inputState) return result;

  if (shouldUseWorkbookSimpleSizing(CRM_SOURCE_ID, inputState)) {
    const simple = calculateWorkbookSimpleSizing(CRM_SOURCE_ID, inputState);
    if (simple) {
      return applyWorkbookSimpleToResult(result, simple, CRM_SOURCE_ID);
    }
  }

  const state = normalizeCrmState(inputState);
  const vendorMeta = getCrmVendorMeta(state.crmVendor);
  const toggles = state.crmComponentToggles;
  const profile = state.crmCollectionProfile;
  const activityTier = ACTIVITY_TIER[state.crmActivityLevel] || 'medium';
  const useDailyOverrides = state.crmUseDailyEventCounts;

  result.crmVendor = state.crmVendor;

  const tenants = parseCount(state.crmTenantCount);
  const users = parseCount(state.crmActiveUserCount);
  const integrations = parseCount(state.crmIntegrationCount);

  if (tenants <= 0 && users <= 0 && integrations <= 0 && !useDailyOverrides) {
    result.warnings.push(
      'Enter tenant count, active CRM users, or integrations to estimate ingest.',
    );
    return result;
  }

  const bands = calcBands(vendorMeta, state, profile, toggles, useDailyOverrides);
  const selected = calcForActivityTier(
    vendorMeta,
    state,
    profile,
    toggles,
    activityTier,
    useDailyOverrides,
  );

  if (bands.breakdown.length === 0 && selected.breakdown.length === 0) {
    result.warnings.push('No CRM log components matched the current counts and profile.');
    return result;
  }

  result.low = bands.low;
  result.expected = selected.expected;
  result.high = bands.high;
  result.crmUsesDailyEventOverrides = bands.usesOverride || selected.breakdown.some((r) => r.fromDailyOverride);
  result.crmBreakdown = selected.breakdown.map((row) => ({
    ...row,
    lowGb: bands.breakdown.find((b) => b.id === row.id)?.lowGb ?? row.tierGb,
    mediumGb: bands.breakdown.find((b) => b.id === row.id)?.mediumGb ?? row.tierGb,
    highGb: bands.breakdown.find((b) => b.id === row.id)?.highGb ?? row.tierGb,
    displayGb: row.tierGb,
  }));
  result.confidence = 'medium';
  result.needsReview = true;
  result.assumptions = [
    `Vendor: ${vendorMeta.label || state.crmVendor}`,
    `Collection profile: ${crmRates.collectionProfiles[profile]?.label || profile}`,
    `Activity level: ${crmRates.activityLevels[state.crmActivityLevel]?.label || state.crmActivityLevel}`,
    'CRM ingest is estimated from vendor, tenant count, active CRM users, integrations, collection profile, and activity level.',
    'Modeled Splunk ingest planning defaults measured from synthetic raw event samples.',
    CRM_VALIDATION_NOTE,
  ];
  if (result.crmUsesDailyEventOverrides) {
    result.assumptions.push(CRM_DAILY_OVERRIDE_NOTE);
  }

  const overlap = detectCrmOverlap(state, sizingContext.allInputs);
  if (overlap) result.warnings.push(overlap);

  result.assumptions.push(
    'CRM sizing includes a planning guardrail based on active CRM users to avoid underestimating record and activity volume.',
  );

  return result;
}

function overlapSourceConfigured(ss) {
  if (!ss || (ss.status !== 'current' && ss.status !== 'future')) return false;
  if (parseCount(ss.count) > 0) return true;
  if (parseCount(ss.number_of_users) > 0) return true;
  if (parseCount(ss.saasActiveUsers) > 0) return true;
  if (parseCount(ss.crmActiveUserCount) > 0) return true;
  if (parseCount(ss.crmIntegrationCount) > 0) return true;
  if (parseCount(ss.crmTenantCount) > 0) return true;
  return false;
}

/** @returns {string|null} */
export function detectCrmOverlap(crmState, allInputs = {}) {
  const state = normalizeCrmState(crmState);
  const vendor = state.crmVendor;
  const warnings = [];
  const toggles = state.crmComponentToggles;

  const overlapIds = crmRates.overlapSourceIds || [];
  if (overlapIds.some((id) => overlapSourceConfigured(allInputs[id]))) {
    warnings.push(
      'CRM logs can overlap with SaaS, SSO, API gateway, integration, application, or ServiceNow platform logs. Confirm whether these logs are sized here or separately.',
    );
  }

  if (vendor === 'salesforce' && overlapSourceConfigured(allInputs.saas_general)) {
    warnings.push(
      'Salesforce CRM is selected and SaaS (General) is also configured — confirm Salesforce logs are not double-counted.',
    );
  }

  if (vendor === 'servicenow_csm' && overlapSourceConfigured(allInputs.saas_general)) {
    warnings.push(
      'ServiceNow CSM is selected and SaaS (General) may include ServiceNow platform logs — confirm sizing is not duplicated.',
    );
  }

  if (vendor === 'zendesk' && overlapSourceConfigured(allInputs.saas_general)) {
    warnings.push(
      'Zendesk is selected and SaaS (General) may also include Zendesk activity — confirm sizing is not duplicated.',
    );
  }

  if (
    toggles.includeLoginAccessSecurity &&
    overlapSourceConfigured(allInputs.saas_sso)
  ) {
    warnings.push(
      'CRM login/access security may overlap with SSO / Identity Provider logs. Confirm whether access logs are sized here or separately.',
    );
  }

  if (
    toggles.includeApiIntegrationEvents &&
    (overlapSourceConfigured(allInputs.api_gateway) ||
      overlapSourceConfigured(allInputs.integration_platform))
  ) {
    warnings.push(
      'CRM API/integration events may overlap with API gateway or integration platform logs. Confirm whether integration traffic is sized here or separately.',
    );
  }

  return warnings.length > 0 ? warnings.join(' ') : null;
}

export function getCrmSizingReviewDisplay(sizingResult) {
  const summary = sizingResult?.crmUsesDailyEventOverrides
    ? `${CRM_REVIEW_SUMMARY_TEXT} ${CRM_DAILY_OVERRIDE_NOTE}`
    : CRM_REVIEW_SUMMARY_TEXT;

  if (!sizingResult?.crmBreakdown?.length) {
    return {
      summary,
      rows: [],
      validationNote: CRM_VALIDATION_NOTE,
    };
  }
  return {
    summary,
    rows: sizingResult.crmBreakdown.map((r) => ({
      label: r.label,
      count: r.count,
      unit: r.unit,
      mediumGb: r.mediumGb,
      displayGb: r.displayGb,
    })),
    validationNote: CRM_VALIDATION_NOTE,
  };
}

export { crmRates, buildProfileToggles };
