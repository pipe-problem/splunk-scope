/**
 * SSO / Identity Provider — additive IdP sizing model.
 */

import ssoRates from '../data/ssoIdentitySizingRates.json';
import { parseCount } from './iaasSizingEngine.js';
import { formatIngestString } from '../utils/formatIngestDisplay.js';
import {
  calculateWorkbookSimpleSizing,
  shouldUseWorkbookSimpleSizing,
  applyWorkbookSimpleToResult,
} from './workbookSimpleSizing.js';

export const SSO_SOURCE_ID = 'saas_sso';
export const SSO_REVIEW_SUMMARY_TEXT =
  'SSO sizing uses IdP vendor, tenant count, active users, MFA-protected users, app integrations, collection profile, and activity level.';
export const SSO_VALIDATION_NOTE = 'Validate with a 24-hour sample when available.';

const ACTIVITY_TIER = { light: 'low', normal: 'medium', heavy: 'high' };

const LEGACY_VENDOR_MAP = {
  okta: 'okta',
  duo: 'duo',
  'microsoft entra id': 'entra_id',
  entra: 'entra_id',
  'azure ad': 'entra_id',
  'ping identity': 'ping_identity',
  ping: 'ping_identity',
  onelogin: 'onelogin',
};

export function getSsoVendorOptions() {
  return Object.entries(ssoRates.vendors).map(([id, v]) => ({ id, label: v.label }));
}

export function getSsoProfileOptions() {
  return Object.entries(ssoRates.collectionProfiles || {}).map(([id, p]) => ({
    id,
    label: p.label,
    description: p.description,
  }));
}

export function getSsoActivityLevelOptions() {
  return Object.entries(ssoRates.activityLevels || {}).map(([id, p]) => ({
    id,
    label: p.label,
    tier: p.tier,
  }));
}

export function getSsoVendorMeta(vendorId) {
  return ssoRates.vendors[vendorId] || ssoRates.vendors.average_blended;
}

export function formatSsoIngestString(gb) {
  return formatIngestString(gb);
}

export function normalizeSsoState(inputState = {}) {
  const state = { ...inputState };
  const isActive = state.status === 'current' || state.status === 'future';

  let vendor = state.ssoIdpVendor;
  if (!vendor || !ssoRates.vendors[vendor]) {
    const vendorKey = String(state.vendor || '').trim().toLowerCase();
    vendor = LEGACY_VENDOR_MAP[vendorKey] || 'average_blended';
  }
  state.ssoIdpVendor = vendor;

  if (state.ssoTenantCount == null || state.ssoTenantCount === '') {
    state.ssoTenantCount = isActive ? '1' : '';
  } else {
    state.ssoTenantCount = String(state.ssoTenantCount);
  }

  const legacyCount = state.count != null && state.count !== '' ? String(state.count) : '';
  state.ssoActiveUserCount =
    state.ssoActiveUserCount == null || state.ssoActiveUserCount === ''
      ? legacyCount
      : String(state.ssoActiveUserCount);
  state.ssoMfaUserCount =
    state.ssoMfaUserCount == null || state.ssoMfaUserCount === ''
      ? ''
      : String(state.ssoMfaUserCount);
  state.ssoAppIntegrationCount =
    state.ssoAppIntegrationCount == null || state.ssoAppIntegrationCount === ''
      ? ''
      : String(state.ssoAppIntegrationCount);

  const profile = state.ssoCollectionProfile;
  state.ssoCollectionProfile =
    profile === 'audit_only' || profile === 'full_identity_activity'
      ? profile
      : 'authentication_security';

  const level = state.ssoActivityLevel;
  state.ssoActivityLevel = level === 'light' || level === 'heavy' ? level : 'normal';

  state.count = state.ssoActiveUserCount || legacyCount;
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
    rateSource: 'sso_identity_additive',
    needsReview: true,
    countBasis: 'tenants + identity users + MFA users + app integrations',
    vendorMultiplier: 1.0,
    scopeMultiplier: 1.0,
    bufferApplied: false,
    ssoBreakdown: [],
  };
}

function calcForTier(vendorMeta, profileKey, tier, state) {
  const componentIds = ssoRates.profileComponents?.[profileKey] || [];
  let low = 0;
  let expected = 0;
  let high = 0;
  const breakdown = [];

  for (const compId of componentIds) {
    const def = vendorMeta.components?.[compId];
    if (!def) continue;
    const count = parseCount(state[def.countField]);
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
export function calculateSsoIdentitySizing(inputState, sizingContext = {}) {
  const result = emptyResult();
  if (!inputState) return result;

  if (shouldUseWorkbookSimpleSizing(SSO_SOURCE_ID, inputState)) {
    const simple = calculateWorkbookSimpleSizing(SSO_SOURCE_ID, inputState);
    if (simple) {
      return applyWorkbookSimpleToResult(result, simple, SSO_SOURCE_ID);
    }
  }

  const state = normalizeSsoState(inputState);
  const vendorMeta = getSsoVendorMeta(state.ssoIdpVendor);
  const profile = state.ssoCollectionProfile;
  const activityTier = ACTIVITY_TIER[state.ssoActivityLevel] || 'medium';

  const tenants = parseCount(state.ssoTenantCount);
  const users = parseCount(state.ssoActiveUserCount);
  const mfaUsers = parseCount(state.ssoMfaUserCount);
  const apps = parseCount(state.ssoAppIntegrationCount);

  if (tenants <= 0 && users <= 0 && mfaUsers <= 0 && apps <= 0) {
    result.warnings.push(
      'Enter tenant count, active identity users, MFA-protected users, or SSO app integrations to estimate ingest.',
    );
    return result;
  }

  const light = calcForTier(vendorMeta, profile, 'low', state);
  const selected = calcForTier(vendorMeta, profile, activityTier, state);
  const heavy = calcForTier(vendorMeta, profile, 'high', state);

  if (selected.breakdown.length === 0) {
    result.warnings.push('No SSO log components matched the current counts and profile.');
    return result;
  }

  result.low = light.expected;
  result.expected = selected.expected;
  result.high = heavy.expected;
  result.ssoBreakdown = selected.breakdown.map((row) => ({
    ...row,
    displayGb: row.tierGb,
  }));
  result.confidence = 'medium';
  result.assumptions = [
    `Vendor: ${vendorMeta.label || state.ssoIdpVendor}`,
    `Collection profile: ${ssoRates.collectionProfiles[profile]?.label || profile}`,
    `Activity level: ${ssoRates.activityLevels[state.ssoActivityLevel]?.label || state.ssoActivityLevel}`,
    SSO_VALIDATION_NOTE,
  ];

  const overlap = detectSsoOverlap(state, sizingContext.allInputs);
  if (overlap) result.warnings.push(overlap);

  return result;
}

function overlapConfigured(ss) {
  if (!ss || (ss.status !== 'current' && ss.status !== 'future')) return false;
  return parseCount(ss.count) > 0 || parseCount(ss.ssoActiveUserCount) > 0;
}

/** @returns {string|null} */
export function detectSsoOverlap(ssoState, allInputs = {}) {
  const ids = ssoRates.overlapSourceIds || [];
  if (ids.some((id) => overlapConfigured(allInputs[id]))) {
    return 'SSO / IdP logs can overlap with SaaS (General), Office Productivity, or Active Directory. Confirm whether identity logs are sized here or separately.';
  }
  return null;
}

export function getSsoSizingReviewDisplay(sizingResult) {
  if (!sizingResult?.ssoBreakdown?.length) {
    return { summary: SSO_REVIEW_SUMMARY_TEXT, rows: [], validationNote: SSO_VALIDATION_NOTE };
  }
  return {
    summary: SSO_REVIEW_SUMMARY_TEXT,
    rows: sizingResult.ssoBreakdown.map((r) => ({
      label: r.label,
      count: r.count,
      unit: r.unit,
      displayGb: r.displayGb,
    })),
    validationNote: SSO_VALIDATION_NOTE,
  };
}

export { ssoRates };
