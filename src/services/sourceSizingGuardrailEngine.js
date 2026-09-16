/**
 * Source sizing guardrails — conservative planning floors from the original sizing sheet.
 * Applied as max(additive, guardrail) for normal planning profiles.
 */

import guardrailsData from '../data/sourceSizingGuardrails.json';
import { getScopeMultiplier } from './sizingEngine.js';
import { parseCount } from './iaasSizingEngine.js';
import { normalizeSaaSState } from './saasSizingEngine.js';
import { normalizeCrmState } from './crmSizingEngine.js';
import { normalizeOfficeProductivityState } from './officeProductivitySizingEngine.js';
import { normalizeSsoState } from './ssoIdentitySizingEngine.js';
import { normalizeCloudVmState } from './cloudVmSizingEngine.js';
import { normalizeCloudStorageState } from './cloudStorageSizingEngine.js';
import { normalizeContainerState } from './containerSizingEngine.js';

const NOTES = guardrailsData.notes || {};
const GUARDRAILS_BY_ID = Object.fromEntries(
  (guardrailsData.guardrails || []).map((g) => [g.sourceId, g]),
);

function maxBands(a, b) {
  return {
    low: Math.max(a.low || 0, b.low || 0),
    expected: Math.max(a.expected || 0, b.expected || 0),
    high: Math.max(a.high || 0, b.high || 0),
  };
}

function ratesToBands(rates, count) {
  if (!rates || count <= 0) return { low: 0, expected: 0, high: 0 };
  return {
    low: (rates.lowPerUnit || 0) * count,
    expected: (rates.expectedPerUnit || 0) * count,
    high: (rates.highPerUnit || 0) * count,
  };
}

function profileApplies(guardrail, profileValue) {
  if (!guardrail.appliesToProfiles || guardrail.appliesToProfiles.length === 0) return true;
  return guardrail.appliesToProfiles.includes(profileValue);
}

function getProfileValue(sourceId, inputState) {
  const state = inputState || {};
  switch (sourceId) {
    case 'saas_general':
      return normalizeSaaSState(state).saasCollectionProfile;
    case 'saas_crm':
      return normalizeCrmState(state).crmCollectionProfile;
    case 'saas_office':
      return normalizeOfficeProductivityState(state).officeCollectionProfile;
    case 'saas_sso':
      return normalizeSsoState(state).ssoCollectionProfile;
    case 'iaas_instances':
      return normalizeCloudVmState(state).cloudVmCollectionProfile;
    case 'iaas_storage':
      return normalizeCloudStorageState(state).cloudStorageCollectionProfile;
    case 'windows_servers':
      return state.windowsLogProfile || 'selected_channels';
    case 'casb':
      return state.casbCollectionProfile || 'policy_alerts';
    default:
      if (guardrailsData.guardrails.find((g) => g.sourceId === sourceId)?.profileField) {
        const field = guardrailsData.guardrails.find((g) => g.sourceId === sourceId).profileField;
        return state[field];
      }
      return null;
  }
}

function officeUserBasis(state) {
  const normalized = normalizeOfficeProductivityState(state);
  return Math.max(
    parseCount(normalized.officeActiveUserCount),
    parseCount(normalized.officeActiveMailboxCount),
    parseCount(normalized.officeActiveFileUserCount),
    parseCount(normalized.officeActiveCollaborationUserCount),
  );
}

function applyMaxWithAdditive(estimate, guardrailBands, note) {
  const before = estimate.expected || 0;
  const out = { ...estimate };
  const assumptions = [...(out.assumptions || [])];
  const warnings = [...(out.warnings || [])];

  if (guardrailBands.expected > 0 && out.expected < guardrailBands.expected) {
    out.low = Math.max(out.low || 0, guardrailBands.low);
    out.expected = Math.max(out.expected || 0, guardrailBands.expected);
    out.high = Math.max(out.high || 0, guardrailBands.high);
    if (note) assumptions.push(note);
    out.guardrailApplied = true;
  }

  if (out.expected > before) {
    out.rateSource = out.rateSource || 'guardrail_floor';
  }

  out.assumptions = assumptions;
  out.warnings = warnings;
  return out;
}

function resolveSaaSGuardrail(inputState, guardrail) {
  const state = normalizeSaaSState(inputState);
  const tenants = parseCount(state.saasTenantCount);
  const users = parseCount(state.saasActiveUsers);
  const tenantBands = ratesToBands(guardrail.tenantRates, tenants);
  const userBands = ratesToBands(guardrail.userRates, users);
  return maxBands(tenantBands, userBands);
}

function resolveUserGuardrail(inputState, guardrail, userCountResolver) {
  const count = userCountResolver(inputState);
  return ratesToBands(guardrail.userRates, count);
}

function normalizeDlpProfile(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'channel/products only' || v === 'channel_products') return 'channel_products';
  if (v === 'lookup/context only' || v === 'lookup_context') return 'lookup_context';
  return 'user_and_channel';
}

function normalizeAssetProfile(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'lookup/context only' || v === 'lookup_context') return 'lookup_context';
  if (v === 'full asset/identity synchronization' || v === 'full_sync') return 'full_sync';
  return 'periodic_sync';
}

function normalizeCasbProfile(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'full_inline_saas' || v === 'full inline saas') return 'full_inline_saas';
  return 'policy_alerts';
}

function resolveCasbGuardrail(inputState, estimate) {
  const users = parseCount(inputState.number_of_users);
  if (users <= 0) return estimate;

  const profile = normalizeCasbProfile(inputState.casbCollectionProfile);
  const rate = profile === 'full_inline_saas' ? 0.05 : 0.005;
  const guardrailBands = ratesToBands(
    { lowPerUnit: rate * 0.8, expectedPerUnit: rate, highPerUnit: rate * 1.2 },
    users,
  );
  const note = NOTES.casb;
  return applyMaxWithAdditive(estimate, guardrailBands, note);
}

function resolveDlpGuardrail(inputState, estimate) {
  const channels = parseCount(inputState.number_of_channels);
  const users = parseCount(inputState.number_of_users);
  const profile = normalizeDlpProfile(inputState.dlpSizingProfile);

  const channelFloor = ratesToBands(
    { lowPerUnit: 0.02, expectedPerUnit: 0.05, highPerUnit: 0.1 },
    channels,
  );
  const userFloor = ratesToBands(
    { lowPerUnit: 0.001, expectedPerUnit: 0.002, highPerUnit: 0.004 },
    users,
  );

  const out = { ...estimate };
  const warnings = [...(out.warnings || [])];
  const assumptions = [...(out.assumptions || [])];

  if (profile === 'lookup_context') {
    out.low = 0;
    out.expected = 0;
    out.high = 0;
    out.confidence = 'none';
    out.lookupContextOnly = true;
    out.rateSource = 'lookup_context';
    assumptions.push('Lookup / context DLP reference — not sized as continuous ingest.');
    out.assumptions = assumptions;
    out.warnings = warnings;
    return out;
  }

  if (profile === 'channel_products') {
    if (channels <= 0) {
      warnings.push('Missing DLP product/channel count');
      out.confidence = 'none';
      out.warnings = warnings;
      return out;
    }
    return applyMaxWithAdditive(out, channelFloor, null);
  }

  if (users <= 0) {
    if (channels > 0) {
      warnings.push('Missing monitored users');
      out.confidence = 'none';
      out.warnings = warnings;
      out.assumptions = assumptions;
      return out;
    }
    warnings.push('Missing monitored users');
    out.confidence = 'none';
    out.warnings = warnings;
    return out;
  }

  const combined = maxBands(channelFloor, userFloor);
  return applyMaxWithAdditive(out, combined, null);
}

function resolveFirewallGuardrail(inputState, estimate) {
  const devices = parseCount(inputState.number_of_systems) || parseCount(inputState.count);
  const users = parseCount(inputState.number_of_users);

  if (devices <= 0 && users <= 0) {
    const out = { ...estimate };
    if (!out.warnings?.some((w) => w.includes('Missing firewall sizing inputs'))) {
      out.warnings = [...(out.warnings || []), 'Missing firewall sizing inputs'];
    }
    out.confidence = 'none';
    return out;
  }

  const deviceBands = ratesToBands(
    { lowPerUnit: 0.5, expectedPerUnit: 1.0, highPerUnit: 2.0 },
    devices,
  );
  const userBands = ratesToBands(
    { lowPerUnit: 0.005, expectedPerUnit: 0.01, highPerUnit: 0.02 },
    users,
  );
  let guardrailBands = maxBands(deviceBands, userBands);
  const scope = inputState.logging_scope || inputState.traffic_level || '';
  const scopeMult = getScopeMultiplier(scope, null);
  if (scopeMult !== 1) {
    guardrailBands = {
      low: guardrailBands.low * scopeMult,
      expected: guardrailBands.expected * scopeMult,
      high: guardrailBands.high * scopeMult,
    };
  }
  const note = NOTES.firewalls;
  const out = applyMaxWithAdditive(estimate, guardrailBands, note);
  if (scope && scopeMult !== 1) {
    out.scopeMultiplier = scopeMult;
    out.assumptions = [...(out.assumptions || []), `Logging scope multiplier: ${scopeMult}× (${scope})`];
  }
  return out;
}

function resolveAssetGuardrail(inputState, estimate) {
  const profile = normalizeAssetProfile(inputState.assetExportProfile);
  const sources = parseCount(inputState.number_of_assets) || parseCount(inputState.count);

  const out = { ...estimate };

  if (profile === 'lookup_context') {
    out.low = 0;
    out.expected = 0;
    out.high = 0;
    out.confidence = 'none';
    out.lookupContextOnly = true;
    out.rateSource = 'lookup_context';
    out.assumptions = [
      ...(out.assumptions || []),
      'Lookup / context source — enrichment only, not continuous ingest.',
    ];
    return out;
  }

  if (sources <= 0) {
    out.warnings = [...(out.warnings || []), 'Enter number of asset or identity data sources'];
    out.confidence = 'none';
    return out;
  }

  const guardrailBands = ratesToBands(
    { lowPerUnit: 0.01, expectedPerUnit: 0.025, highPerUnit: 0.05 },
    sources,
  );
  return applyMaxWithAdditive(out, guardrailBands, null);
}

/**
 * @param {{ id?: string }} source
 * @param {object} inputState
 * @param {object} estimate
 * @returns {object}
 */
export function applySizingGuardrails(source, inputState, estimate) {
  if (!source?.id || !estimate) return estimate;
  if (estimate.rateSource === 'manual') return estimate;
  if (estimate.rateSource === 'rollup_children') return estimate;

  const guardrail = GUARDRAILS_BY_ID[source.id];
  if (!guardrail) return estimate;

  const profileValue = getProfileValue(source.id, inputState);
  if (guardrail.profileField && guardrail.appliesToProfiles && !profileApplies(guardrail, profileValue)) {
    return estimate;
  }

  const note = guardrail.noteKey ? NOTES[guardrail.noteKey] : null;

  switch (guardrail.applyMode) {
    case 'max_with_additive': {
      let guardrailBands = { low: 0, expected: 0, high: 0 };

      if (source.id === 'saas_general') {
        const state = normalizeSaaSState(inputState);
        const profile = state.saasCollectionProfile;
        const users = parseCount(state.saasActiveUsers);
        if (profile !== 'audit_only' && users <= 0) {
          return estimate;
        }
        guardrailBands = resolveSaaSGuardrail(inputState, guardrail);
      } else if (source.id === 'saas_crm') {
        guardrailBands = resolveUserGuardrail(
          inputState,
          guardrail,
          (s) => parseCount(normalizeCrmState(s).crmActiveUserCount),
        );
      } else if (source.id === 'saas_office') {
        guardrailBands = resolveUserGuardrail(inputState, guardrail, officeUserBasis);
      } else if (source.id === 'saas_sso') {
        guardrailBands = resolveUserGuardrail(
          inputState,
          guardrail,
          (s) => parseCount(normalizeSsoState(s).ssoActiveUserCount),
        );
      } else if (source.id === 'iaas_instances') {
        const vmState = normalizeCloudVmState(inputState);
        const instances = parseCount(vmState.cloudVmInstanceCount);
        const profileRates =
          vmState.cloudVmCollectionProfile === 'full_vm_logs'
            ? guardrail.fullInstanceRates || guardrail.instanceRates
            : vmState.cloudVmCollectionProfile === 'minimal_vm_telemetry'
              || vmState.cloudVmCollectionProfile === 'base_vm_telemetry'
              ? guardrail.minimalInstanceRates || guardrail.instanceRates
              : guardrail.instanceRates;
        guardrailBands = ratesToBands(profileRates, instances);
      } else if (source.id === 'iaas_storage') {
        const assets = parseCount(normalizeCloudStorageState(inputState).cloudStorageAssetCount);
        guardrailBands = ratesToBands(guardrail.assetRates, assets);
      } else if (source.id === 'iaas_containers') {
        const clusters = parseCount(normalizeContainerState(inputState).containerCounts?.clusters);
        guardrailBands = ratesToBands(guardrail.clusterRates, clusters);
      } else if (source.id === 'windows_servers') {
        const servers = parseCount(inputState.count) || parseCount(inputState.number_of_servers);
        guardrailBands = ratesToBands(guardrail.serverRates, servers);
      }

      return applyMaxWithAdditive(estimate, guardrailBands, note);
    }

    case 'dlp_combined':
      return resolveDlpGuardrail(inputState, estimate);

    case 'casb_collection':
      return resolveCasbGuardrail(inputState, estimate);

    case 'firewall_max':
      return resolveFirewallGuardrail(inputState, estimate);

    case 'asset_export':
      return resolveAssetGuardrail(inputState, estimate);

    default:
      return estimate;
  }
}

export function getGuardrailAuditNote(sourceId) {
  const g = GUARDRAILS_BY_ID[sourceId];
  if (!g?.noteKey) return null;
  return NOTES[g.noteKey] || null;
}

export { GUARDRAILS_BY_ID, NOTES as GUARDRAIL_NOTES };
