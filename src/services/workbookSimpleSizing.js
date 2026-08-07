/**
 * Workbook-aligned simple sizing: count × rateGbPerUnit from originalSizingRates.
 * Used as default path for composite sources before additive engine detail.
 */
import originalRates from '../data/originalSizingRates.json' with { type: 'json' };
import { parseCount } from './iaasSizingEngine.js';

const ENTRIES = originalRates.entries || {};

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

/** True when only the workbook primary count is populated (no advanced additive inputs). */
export function shouldUseWorkbookSimpleSizing(sourceId, inputState) {
  if (!inputState) return false;
  if (inputState.useAdvancedSizing === true) return false;

  if (sourceId === 'saas_sso') {
    const tenants = parseCount(inputState.ssoTenantCount);
    const mfa = parseCount(inputState.ssoMfaUserCount);
    const apps = parseCount(inputState.ssoAppIntegrationCount);
    const users = parseCount(inputState.ssoActiveUserCount || inputState.count);
    return users > 0 && tenants <= 0 && mfa <= 0 && apps <= 0;
  }

  if (sourceId === 'saas_office') {
    const users = parseCount(inputState.officeActiveUserCount || inputState.count);
    const mail = parseCount(inputState.officeActiveMailboxCount);
    const files = parseCount(inputState.officeActiveFileUserCount);
    const teams = parseCount(inputState.officeActiveCollaborationUserCount);
    const tenants = parseCount(inputState.officeTenantCount);
    return users > 0 && mail <= 0 && files <= 0 && teams <= 0 && tenants <= 0;
  }

  if (sourceId === 'saas_crm') {
    const users = parseCount(inputState.crmActiveUserCount || inputState.count);
    const tenants = parseCount(inputState.crmTenantCount);
    const integrations = parseCount(inputState.crmIntegrationCount);
    return users > 0 && tenants <= 0 && integrations <= 0;
  }

  if (sourceId === 'iaas_instances') {
    const vms = parseCount(inputState.cloudVmInstanceCount);
    return vms > 0 && !inputState.cloudVmProvider;
  }

  return true;
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
    'Workbook simple rate (ORIGINAL Sizing Calculator) — switch to advanced fields for component-level sizing.',
  ];
  return result;
}
