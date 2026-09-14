/**
 * Planning adjustments for simple sizing — corrects catalog rates that assume
 * full inline proxy volume when customers typically forward policy/audit events only,
 * and reduces double-count when EDR is the primary endpoint path.
 */

import { parseCount } from './iaasSizingEngine.js';

/** GB/day per user by CASB collection mode (not full SASE/SWG inline traffic). */
export const CASB_RATES_BY_PROFILE = {
  policy_alerts: 0.005,
  full_inline_saas: 0.05,
};

/** GB/day per server when EDR is primary and Windows logs are a security supplement. */
export const WINDOWS_SERVER_EDR_SUPPLEMENT_RATE = 0.08;

function cloneEstimate(estimate) {
  return {
    ...estimate,
    assumptions: [...(estimate.assumptions || [])],
    warnings: [...(estimate.warnings || [])],
  };
}

function rescaleEstimate(out, quantity, rate, unitLabel, assumptionLine) {
  const expected = quantity * rate;
  out.expected = expected;
  out.low = expected * 0.8;
  out.high = expected * 1.2;
  out.quantity = quantity;
  out.countBasis = unitLabel;
  out.assumptions.push(assumptionLine);
  return out;
}

/**
 * @param {{ id?: string }} source
 * @param {object} sourceState
 * @param {object} estimate
 * @param {{ allInputs?: object, overlapDecisions?: object }} [sizingContext]
 */
export function applyPlanningAdjustments(source, sourceState, estimate, sizingContext = {}) {
  if (!source?.id || !estimate) return estimate;

  const allInputs = sizingContext.allInputs || {};
  let out = cloneEstimate(estimate);

  if (source.id === 'casb') {
    out = applyCasbPlanningAdjustment(sourceState, out);
  }

  if (source.id === 'windows_servers') {
    out = applyWindowsServerEdrAdjustment(sourceState, out, allInputs, sizingContext.overlapDecisions);
  }

  return out;
}

function applyCasbPlanningAdjustment(sourceState, estimate) {
  const users = parseCount(sourceState.number_of_users);
  if (users <= 0) return estimate;

  const profile = sourceState.casbCollectionProfile || 'policy_alerts';
  const rate = CASB_RATES_BY_PROFILE[profile] ?? CASB_RATES_BY_PROFILE.policy_alerts;
  const out = cloneEstimate(estimate);

  rescaleEstimate(
    out,
    users,
    rate,
    'active users',
    `${users} active users × ${rate} GB/day (CASB ${profile.replace(/_/g, ' ')})`,
  );

  if (profile === 'policy_alerts') {
    out.assumptions.push(
      'Policy/alert CASB mode — audit, discovery, and violation events (not full inline SaaS session proxy volume).',
    );
    if (users >= 1000 && out.expected > 25) {
      out.warnings.push(
        'CASB ingest exceeds typical policy/alert mode — confirm inline proxy logging is in scope or switch profile to Full inline SaaS.',
      );
    }
  }

  return out;
}

function applyWindowsServerEdrAdjustment(sourceState, estimate, allInputs, overlapDecisions) {
  const servers =
    parseCount(sourceState.number_of_servers)
    || parseCount(sourceState.count)
    || estimate.quantity
    || 0;
  if (servers <= 0) return estimate;

  const edrState = allInputs.edr;
  const edrActive = edrState?.status === 'current' || edrState?.status === 'future';
  const edrEndpoints = parseCount(edrState?.number_of_endpoints);
  const overlapKey = 'edr__windows_servers';
  const overlapDecision = overlapDecisions?.[overlapKey];
  const optionId = overlapDecision?.selectedOption?.id;
  const separate = optionId === 'separate';
  const included = optionId === 'included';
  const profile = sourceState.windowsServerCollectionProfile;

  const out = cloneEstimate(estimate);

  if (included || profile === 'edr_primary_exclude') {
    out.expected = 0;
    out.low = 0;
    out.high = 0;
    out.assumptions.push('Windows Server OS logs excluded — EDR is the primary host telemetry path.');
    return out;
  }

  if (profile === 'full_os_logs' || separate) {
    if (separate) {
      out.assumptions.push('Separate Windows event collection confirmed — full server rate retained.');
    }
    return out;
  }

  if (edrActive && edrEndpoints > 0) {
    const rate = WINDOWS_SERVER_EDR_SUPPLEMENT_RATE;
    rescaleEstimate(
      out,
      servers,
      rate,
      'total windows servers',
      `${servers} servers × ${rate} GB/day (security-channel supplement; EDR covers ${edrEndpoints} endpoints)`,
    );
    out.warnings.push(
      'Windows Server rate reduced while EDR is active — confirm supplemental OS logs are required beyond EDR.',
    );
  }

  return out;
}

export function getCasbRateForProfile(profile) {
  return CASB_RATES_BY_PROFILE[profile] ?? CASB_RATES_BY_PROFILE.policy_alerts;
}
