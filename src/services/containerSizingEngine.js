/**
 * Containers / Pods / Clusters — additive measured sizing model.
 * Modeled planning defaults from synthetic samples — not official vendor sizing.
 */

import containerRates from '../data/containerSizingRates.json';
import { normalizeIaasState, parseCount } from './iaasSizingEngine.js';

export const CONTAINER_SOURCE_ID = 'iaas_containers';
export const CONTAINER_REVIEW_SUMMARY =
  'Container platform sizing uses cluster, node, and pod/container counts.';
export const CONTAINER_VALIDATION_NOTE = 'Validate with a 24-hour sample when available.';

const PLATFORM_OPTIONS = Object.entries(containerRates.platforms).map(([id, p]) => ({
  id,
  label: p.label,
}));

const LEGACY_VENDOR_PLATFORM = {
  eks: 'eks',
  'amazon eks': 'eks',
  'aws eks': 'eks',
  aks: 'aks',
  'azure aks': 'aks',
  'microsoft aks': 'aks',
  gke: 'gke',
  'google gke': 'gke',
  openshift: 'openshift',
  'red hat openshift': 'openshift',
  kubernetes: 'generic_kubernetes',
  generic: 'generic_kubernetes',
};

export function getContainerPlatformOptions() {
  return PLATFORM_OPTIONS;
}

export function getPlatformMeta(platformId) {
  return containerRates.platforms[platformId] || containerRates.platforms.average_blended;
}

/** @param {number} value */
export function formatContainerGb(value) {
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

export function normalizeContainerState(inputState = {}) {
  const state = { ...inputState };

  let platform = state.containerPlatform;
  if (!platform || !containerRates.platforms[platform]) {
    const vendorKey = String(state.vendor || '').trim().toLowerCase();
    platform = LEGACY_VENDOR_PLATFORM[vendorKey] || 'average_blended';
  }
  state.containerPlatform = platform;

  const rawCounts =
    state.containerCounts && typeof state.containerCounts === 'object' ? state.containerCounts : {};
  let clusters = rawCounts.clusters ?? state.count ?? '';
  state.containerCounts = {
    clusters: clusters !== null && clusters !== undefined ? String(clusters) : '',
    nodes: rawCounts.nodes != null && rawCounts.nodes !== '' ? String(rawCounts.nodes) : '',
    podsOrContainers:
      rawCounts.podsOrContainers != null && rawCounts.podsOrContainers !== ''
        ? String(rawCounts.podsOrContainers)
        : '',
  };

  const rawToggles =
    state.containerToggles && typeof state.containerToggles === 'object' ? state.containerToggles : {};
  state.containerToggles = {
    includeAuditEvents: parseToggle(rawToggles.includeAuditEvents, true),
    includeContainerStdout: parseToggle(rawToggles.includeContainerStdout, true),
  };

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
    rateSource: 'container_additive',
    needsReview: true,
    countBasis: 'clusters + nodes + pods',
    vendorMultiplier: 1.0,
    scopeMultiplier: 1.0,
    bufferApplied: false,
    containerBreakdown: [],
  };
}

/**
 * @param {object} inputState
 * @param {{ allInputs?: Record<string, object> }} [sizingContext]
 */
export function calculateContainerSizing(inputState, sizingContext = {}) {
  const result = emptyResult();
  if (!inputState) return result;

  const state = normalizeContainerState(inputState);
  const platform = getPlatformMeta(state.containerPlatform);
  const counts = state.containerCounts;
  const toggles = state.containerToggles;

  const clusters = parseCount(counts.clusters);
  const nodes = parseCount(counts.nodes);
  const pods = parseCount(counts.podsOrContainers);

  if (clusters <= 0 && nodes <= 0 && pods <= 0) {
    result.warnings.push('Enter cluster, node, or pod/container counts to estimate ingest.');
    return result;
  }

  const components = platform.components;
  const breakdown = [];
  let low = 0;
  let expected = 0;
  let high = 0;

  function addRow(id, def, count) {
    if (count <= 0) return;
    const rowLow = def.low * count;
    const rowMed = def.medium * count;
    const rowHigh = def.high * count;
    low += rowLow;
    expected += rowMed;
    high += rowHigh;
    breakdown.push({
      id,
      label: def.label,
      count,
      unit: def.unit,
      lowGb: rowLow,
      mediumGb: rowMed,
      highGb: rowHigh,
    });
  }

  if (clusters > 0) {
    addRow('control_plane', components.control_plane, clusters);
    if (toggles.includeAuditEvents) {
      addRow('audit_events', components.audit_events, clusters);
    }
  }

  if (nodes > 0) {
    addRow('node_infra', components.node_infra, nodes);
  }

  if (pods > 0 && toggles.includeContainerStdout) {
    addRow('container_stdout', components.container_stdout, pods);
  }

  result.low = low;
  result.expected = expected;
  result.high = high;
  result.containerBreakdown = breakdown;
  result.confidence = breakdown.length ? 'medium' : 'none';
  result.needsReview = true;
  result.assumptions = [
    `Platform: ${platform.label || state.containerPlatform}`,
    'Container ingest is estimated from cluster, node, and pod/container counts.',
    CONTAINER_VALIDATION_NOTE,
    'Modeled planning defaults — not official vendor sizing.',
  ];

  const overlap = detectContainerOverlap(state, sizingContext.allInputs);
  if (overlap) result.warnings.push(overlap);

  return result;
}

/** @returns {string|null} */
export function detectContainerOverlap(containerState, allInputs = {}) {
  const activeOverlap = (containerRates.overlapSourceIds || []).filter((id) => {
    const ss = allInputs[id];
    if (!ss || (ss.status !== 'current' && ss.status !== 'future')) return false;
    if (id === 'iaas') {
      const iaas = normalizeIaasState(ss);
      if (iaas.iaasSizingMode !== 'advanced') return true;
      const adv = iaas.iaasAdvancedCounts || {};
      return (
        parseCount(adv.kubernetesClusters) > 0 ||
        parseCount(adv.containersOrPods) > 0 ||
        parseCount(adv.instances) > 0
      );
    }
    const count =
      parseCount(ss.count) ||
      parseCount(ss.number_of_servers) ||
      parseCount(ss.number_of_instances) ||
      parseCount(ss.number_of_systems);
    return count > 0 || parseCount(ss.iaasAccountCount) > 0;
  });

  if (activeOverlap.length === 0) return null;
  return 'Container logs can overlap with IaaS, application server, web server, or observability sources. Confirm whether these logs are sized here or separately.';
}

export function getContainerSizingReviewDisplay(sizingResult) {
  if (!sizingResult?.containerBreakdown?.length) {
    return {
      summary: CONTAINER_REVIEW_SUMMARY,
      rows: [],
      validationNote: CONTAINER_VALIDATION_NOTE,
    };
  }
  return {
    summary: CONTAINER_REVIEW_SUMMARY,
    rows: sizingResult.containerBreakdown.map((r) => ({
      label: r.label,
      count: r.count,
      unit: r.unit,
      mediumGb: r.mediumGb,
    })),
    validationNote: CONTAINER_VALIDATION_NOTE,
  };
}

export { containerRates };
