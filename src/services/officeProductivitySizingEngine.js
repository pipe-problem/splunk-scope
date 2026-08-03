/**
 * Office Productivity (M365/Google) — additive measured sizing model.
 * Modeled planning defaults from synthetic samples — not official vendor sizing.
 */

import officeRates from '../data/officeProductivitySizingRates.json';
import { parseCount } from './iaasSizingEngine.js';

export const OFFICE_PRODUCTIVITY_SOURCE_ID = 'saas_office';
export const OFFICE_REVIEW_SUMMARY_TEXT =
  'Office Productivity sizing uses product, tenant count, active users, mailboxes, file users, collaboration users, and selected productivity log components.';
export const OFFICE_M365_SUITE_NOTE =
  'Microsoft 365 may include Exchange, SharePoint/OneDrive, and Teams activity. Avoid separately counting those workloads unless they are collected through separate pipelines.';
export const OFFICE_VALIDATION_NOTE = 'Validate with a 24-hour sample when available.';

const PRODUCT_OPTIONS = Object.entries(officeRates.products).map(([id, p]) => ({
  id,
  label: p.label,
}));

const TOGGLE_KEYS = [
  'includeTenantAdminAudit',
  'includeLoginAccessSecurity',
  'includeEmailMessageActivity',
  'includeFileActivity',
  'includeChatMeetingActivity',
];

const LEGACY_PRODUCT_MAP = {
  microsoft: 'microsoft_365',
  'microsoft 365': 'microsoft_365',
  m365: 'microsoft_365',
  'office 365': 'microsoft_365',
  google: 'google_workspace',
  'google workspace': 'google_workspace',
  workspace: 'google_workspace',
  exchange: 'exchange_online',
  'exchange online': 'exchange_online',
  sharepoint: 'sharepoint_online',
  'sharepoint online': 'sharepoint_online',
  teams: 'teams',
};

export function getOfficeProductOptions() {
  return PRODUCT_OPTIONS;
}

export function getOfficeProfileOptions() {
  return Object.entries(officeRates.collectionProfiles || {}).map(([id, p]) => ({
    id,
    label: p.label,
    description: p.description,
  }));
}

export function getOfficeProductMeta(productId) {
  return officeRates.products[productId] || officeRates.products.average_blended;
}

export function getOfficeFieldVisibility(productId) {
  const meta = getOfficeProductMeta(productId);
  return meta.fieldVisibility || {
    officeActiveUserCount: true,
    officeActiveMailboxCount: true,
    officeActiveFileUserCount: true,
    officeActiveCollaborationUserCount: true,
  };
}

/** @param {number} gb */
export function formatOfficeProductivityIngest(gb) {
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
export function formatOfficeProductivityIngestString(gb) {
  const f = formatOfficeProductivityIngest(gb);
  if (!f.unit) return '0';
  return `${f.text} ${f.unit}`;
}

function parseToggle(value, defaultTrue = true) {
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value == null || value === '') return defaultTrue;
  return defaultTrue;
}

function buildProfileToggles(productMeta, profileId) {
  const componentIds = productMeta.profileComponents?.[profileId] || [];
  const toggles = {
    includeTenantAdminAudit: false,
    includeLoginAccessSecurity: false,
    includeEmailMessageActivity: false,
    includeFileActivity: false,
    includeChatMeetingActivity: false,
  };
  for (const compId of componentIds) {
    const def = productMeta.components?.[compId];
    if (def?.toggleKey && toggles[def.toggleKey] !== undefined) {
      toggles[def.toggleKey] = true;
    }
  }
  return toggles;
}

function resolveEffectiveToggles(state, productMeta) {
  const profile =
    state.officeCollectionProfile === 'audit_only' || state.officeCollectionProfile === 'full_activity'
      ? state.officeCollectionProfile
      : 'standard_activity';
  const preset = buildProfileToggles(productMeta, profile);
  if (!state.officeCustomizeComponents) {
    return { ...preset };
  }
  const raw =
    state.officeComponentToggles && typeof state.officeComponentToggles === 'object'
      ? state.officeComponentToggles
      : {};
  return {
    includeTenantAdminAudit: parseToggle(raw.includeTenantAdminAudit, preset.includeTenantAdminAudit),
    includeLoginAccessSecurity: parseToggle(
      raw.includeLoginAccessSecurity,
      preset.includeLoginAccessSecurity,
    ),
    includeEmailMessageActivity: parseToggle(
      raw.includeEmailMessageActivity,
      preset.includeEmailMessageActivity,
    ),
    includeFileActivity: parseToggle(raw.includeFileActivity, preset.includeFileActivity),
    includeChatMeetingActivity: parseToggle(
      raw.includeChatMeetingActivity,
      preset.includeChatMeetingActivity,
    ),
  };
}

export function normalizeOfficeProductivityState(inputState = {}) {
  const state = { ...inputState };
  const isActive = state.status === 'current' || state.status === 'future';

  let product = state.officeProductivityProduct;
  if (!product || !officeRates.products[product]) {
    const vendorKey = String(state.vendor || '').trim().toLowerCase();
    product = LEGACY_PRODUCT_MAP[vendorKey] || 'average_blended';
  }
  state.officeProductivityProduct = product;

  const strField = (key, fallback = '') => {
    if (state[key] == null || state[key] === '') return fallback;
    return String(state[key]);
  };

  if (state.officeTenantCount == null || state.officeTenantCount === '') {
    state.officeTenantCount = isActive ? '1' : '';
  } else {
    state.officeTenantCount = String(state.officeTenantCount);
  }

  const legacyUsers =
    state.count != null && state.count !== '' ? String(state.count) : '';
  state.officeActiveUserCount = strField('officeActiveUserCount', legacyUsers);
  state.officeActiveMailboxCount = strField('officeActiveMailboxCount', legacyUsers);
  state.officeActiveFileUserCount = strField('officeActiveFileUserCount', legacyUsers);
  state.officeActiveCollaborationUserCount = strField(
    'officeActiveCollaborationUserCount',
    legacyUsers,
  );

  state.officeCollectionProfile =
    state.officeCollectionProfile === 'audit_only' || state.officeCollectionProfile === 'full_activity'
      ? state.officeCollectionProfile
      : 'standard_activity';

  state.officeCustomizeComponents = Boolean(state.officeCustomizeComponents);
  const productMeta = getOfficeProductMeta(product);
  state.officeComponentToggles = { ...resolveEffectiveToggles(state, productMeta) };
  state.count = state.officeActiveUserCount || legacyUsers;

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
    rateSource: 'office_productivity_additive',
    needsReview: true,
    countBasis: 'tenants + users + mailboxes + file + collaboration',
    vendorMultiplier: 1.0,
    scopeMultiplier: 1.0,
    bufferApplied: false,
    officeBreakdown: [],
    officeProduct: 'average_blended',
  };
}

function isToggleEnabled(toggles, toggleKey) {
  if (!toggleKey) return true;
  return toggles[toggleKey] !== false;
}

function overlapSourceConfigured(ss) {
  if (!ss || (ss.status !== 'current' && ss.status !== 'future')) return false;
  if (parseCount(ss.count) > 0) return true;
  if (parseCount(ss.number_of_users) > 0) return true;
  if (parseCount(ss.saasActiveUsers) > 0) return true;
  if (parseCount(ss.saasTenantCount) > 0) return true;
  if (parseCount(ss.officeActiveUserCount) > 0) return true;
  if (parseCount(ss.officeActiveMailboxCount) > 0) return true;
  if (parseCount(ss.officeActiveFileUserCount) > 0) return true;
  if (parseCount(ss.officeActiveCollaborationUserCount) > 0) return true;
  return false;
}

function componentsForCalculation(state, productMeta) {
  const profile = state.officeCollectionProfile;
  const profileIds = productMeta.profileComponents?.[profile] || [];
  if (state.officeCustomizeComponents) {
    return Object.keys(productMeta.components || {});
  }
  return profileIds;
}

/**
 * @param {object} inputState
 * @param {{ allInputs?: Record<string, object> }} [sizingContext]
 */
export function calculateOfficeProductivitySizing(inputState, sizingContext = {}) {
  const result = emptyResult();
  if (!inputState) return result;

  const state = normalizeOfficeProductivityState(inputState);
  const productMeta = getOfficeProductMeta(state.officeProductivityProduct);
  const toggles = state.officeComponentToggles;
  const profile = state.officeCollectionProfile;

  result.officeProduct = state.officeProductivityProduct;

  if (profile === 'audit_only') {
    result.assumptions.push(
      'Audit-only productivity logging. Mail, file, and collaboration activity are not fully included.',
    );
  }

  const componentIds = componentsForCalculation(state, productMeta);
  const breakdown = [];
  let low = 0;
  let expected = 0;
  let high = 0;

  for (const compId of componentIds) {
    const def = productMeta.components?.[compId];
    if (!def) continue;
    if (!state.officeCustomizeComponents && !productMeta.profileComponents?.[profile]?.includes(compId)) {
      continue;
    }
    if (!isToggleEnabled(toggles, def.toggleKey)) continue;

    const count = parseCount(state[def.countField]);
    if (count <= 0) continue;

    const rowLow = def.low * count;
    const rowMed = def.medium * count;
    const rowHigh = def.high * count;
    low += rowLow;
    expected += rowMed;
    high += rowHigh;
    breakdown.push({
      id: compId,
      label: def.label,
      count,
      unit: def.unitLabel || def.unit,
      lowGb: rowLow,
      mediumGb: rowMed,
      highGb: rowHigh,
    });
  }

  if (breakdown.length === 0) {
    const hasAnyCount =
      parseCount(state.officeTenantCount) > 0 ||
      parseCount(state.officeActiveUserCount) > 0 ||
      parseCount(state.officeActiveMailboxCount) > 0 ||
      parseCount(state.officeActiveFileUserCount) > 0 ||
      parseCount(state.officeActiveCollaborationUserCount) > 0;
    if (!hasAnyCount) {
      result.warnings.push(
        'Enter tenant count, active users, mailboxes, file users, or collaboration users to estimate ingest.',
      );
    } else {
      result.warnings.push('No productivity log components matched the current counts and profile.');
    }
    return result;
  }

  result.low = low;
  result.expected = expected;
  result.high = high;
  result.officeBreakdown = breakdown;
  result.confidence = 'medium';
  result.needsReview = true;
  result.assumptions = [
    `Product: ${productMeta.label || state.officeProductivityProduct}`,
    `Collection profile: ${officeRates.collectionProfiles[profile]?.label || profile}`,
    'Office productivity ingest is estimated from tenant count, active users, mailboxes, file users, collaboration users, and selected log components.',
    'Modeled Splunk ingest planning defaults measured from synthetic raw event samples.',
    OFFICE_VALIDATION_NOTE,
  ];

  const overlap = detectOfficeProductivityOverlap(state, sizingContext.allInputs);
  if (overlap) result.warnings.push(overlap);

  return result;
}

/** @returns {string|null} */
export function detectOfficeProductivityOverlap(officeState, allInputs = {}) {
  const state = normalizeOfficeProductivityState(officeState);
  const product = state.officeProductivityProduct;
  const warnings = [];

  const overlapIds = officeRates.overlapSourceIds || [];
  const activeOverlap = overlapIds.filter((id) => overlapSourceConfigured(allInputs[id]));
  if (activeOverlap.length > 0) {
    warnings.push(
      'Office productivity logs can overlap with SaaS, SSO, email security, file sharing, CASB, DLP, or individual Microsoft 365 workload sources. Confirm whether these logs are sized here or separately.',
    );
  }

  if (product === 'microsoft_365') {
    if (overlapSourceConfigured(allInputs.email)) {
      warnings.push(
        'Microsoft 365 includes Exchange mail activity. Email Servers / Email Gateways is also configured — confirm Exchange logs are not double-counted.',
      );
    }
    if (overlapSourceConfigured(allInputs.saas_filesharing)) {
      warnings.push(
        'Microsoft 365 includes SharePoint/OneDrive file activity. File Sharing is also configured — confirm file activity is not double-counted.',
      );
    }
  }

  if (product === 'exchange_online' && overlapSourceConfigured(allInputs.email)) {
    warnings.push(
      'Exchange Online and Email Servers / Email Gateways may both include mail flow logs. Confirm sizing is not duplicated.',
    );
  }

  if (product === 'sharepoint_online' && overlapSourceConfigured(allInputs.saas_filesharing)) {
    warnings.push(
      'SharePoint Online and File Sharing may both include file collaboration logs. Confirm sizing is not duplicated.',
    );
  }

  if (product === 'google_workspace') {
    if (overlapSourceConfigured(allInputs.saas_sso)) {
      warnings.push(
        'Google Workspace login activity may overlap with SSO / Identity Provider logs. Confirm whether access logs are sized here or separately.',
      );
    }
    if (overlapSourceConfigured(allInputs.saas_filesharing)) {
      warnings.push(
        'Google Workspace Drive activity may overlap with File Sharing. Confirm whether file logs are sized here or separately.',
      );
    }
  }

  return warnings.length > 0 ? warnings.join(' ') : null;
}

export function getOfficeProductivitySizingReviewDisplay(sizingResult) {
  const product = sizingResult?.officeProduct;
  const m365Note =
    product === 'microsoft_365' ? OFFICE_M365_SUITE_NOTE : null;

  if (!sizingResult?.officeBreakdown?.length) {
    return {
      summary: OFFICE_REVIEW_SUMMARY_TEXT,
      rows: [],
      validationNote: OFFICE_VALIDATION_NOTE,
      m365Note,
    };
  }
  return {
    summary: OFFICE_REVIEW_SUMMARY_TEXT,
    rows: sizingResult.officeBreakdown.map((r) => ({
      label: r.label,
      count: r.count,
      unit: r.unit,
      mediumGb: r.mediumGb,
    })),
    validationNote: OFFICE_VALIDATION_NOTE,
    m365Note,
  };
}

export { officeRates, buildProfileToggles };
