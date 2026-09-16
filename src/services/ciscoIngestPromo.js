/**
 * Permanent Cisco ingest advantage: Cisco-sourced volume is counted at 0.5×
 * toward customer-facing (billable) GB/day. Technical (gross) ingest is retained
 * for strikethrough display. This is a commercial promo, not a volume-skew multiplier.
 */

export const CISCO_INGEST_PROMO_FACTOR = 0.5;

export const CISCO_INGEST_PROMO_COPY =
  'Cisco ingest advantage: every 1 GB of Cisco telemetry counts as 0.5 GB toward your Splunk ingest plan.';

export const CISCO_INGEST_PROMO_EXAMPLE =
  'Example: 10 GB of Cisco data counts as 5 GB on the plan.';

const VENDOR_FIELD_KEYS = [
  'vendor',
  'saasVendor',
  'ssoIdpVendor',
  'iaasProvider',
  'officeVendor',
  'crmVendor',
  'cloudStorageVendor',
  'cloudVmVendor',
  'containerPlatform',
];

/**
 * @param {unknown} vendor
 * @returns {boolean}
 */
export function isCiscoVendor(vendor) {
  if (vendor == null) return false;
  return /\bcisco\b/i.test(String(vendor));
}

function catalogRoots(catalog) {
  if (!catalog) return [];
  return Array.isArray(catalog) ? catalog : [catalog];
}

/**
 * Parent catalog id for a child source, or null if the id is a root / unknown.
 * @param {object|object[]} catalog
 * @param {string} sourceId
 * @returns {string|null}
 */
export function findParentSourceId(catalog, sourceId) {
  if (!sourceId) return null;

  function walk(nodes, parentId) {
    for (const node of nodes || []) {
      if (node.id === sourceId) return parentId;
      if (node.children?.length) {
        const hit = walk(node.children, node.id);
        if (hit !== undefined) return hit;
      }
    }
    return undefined;
  }

  const hit = walk(catalogRoots(catalog), null);
  return hit === undefined ? null : hit;
}

function vendorFromState(sourceState) {
  if (!sourceState || typeof sourceState !== 'object') return '';
  for (const key of VENDOR_FIELD_KEYS) {
    const value = sourceState[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

/**
 * Vendor label for promo detection. Children inherit the parent vendor when unset.
 * @param {{ id?: string }} source
 * @param {object} sourceState
 * @param {{ catalog?: object|object[], allInputs?: Record<string, object> }} [sizingContext]
 * @returns {string}
 */
export function resolveSourceVendor(source, sourceState, sizingContext = {}) {
  const direct = vendorFromState(sourceState);
  if (direct) return direct;

  const catalog = sizingContext.catalog;
  const allInputs = sizingContext.allInputs || {};
  const sourceId = source?.id;
  if (!sourceId || !catalog) return '';

  const visited = new Set();
  let currentId = sourceId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const parentId = findParentSourceId(catalog, currentId);
    if (!parentId) break;
    const inherited = vendorFromState(allInputs[parentId]);
    if (inherited) return inherited;
    currentId = parentId;
  }
  return '';
}

function cloneEstimate(estimate) {
  return {
    ...estimate,
    assumptions: [...(estimate.assumptions || [])],
    warnings: [...(estimate.warnings || [])],
  };
}

/**
 * Keep gross ingest, set billable expected/low/high to 0.5× when vendor is Cisco.
 * @param {{ id?: string }} source
 * @param {object} sourceState
 * @param {object} estimate
 * @param {{ catalog?: object|object[], allInputs?: Record<string, object> }} [sizingContext]
 */
export function applyCiscoIngestPromo(source, sourceState, estimate, sizingContext = {}) {
  if (!estimate) return estimate;

  const vendor = resolveSourceVendor(source, sourceState, sizingContext);
  const grossExpected = Number(estimate.expected) || 0;
  const grossLow = Number(estimate.low) || 0;
  const grossHigh = Number(estimate.high) || 0;

  const out = cloneEstimate(estimate);
  out.gbGrossExpected = estimate.gbGrossExpected ?? grossExpected;
  out.gbGrossLow = estimate.gbGrossLow ?? grossLow;
  out.gbGrossHigh = estimate.gbGrossHigh ?? grossHigh;
  out.ciscoPromoApplied = false;
  out.ciscoPromoFactor = 1;
  out.ciscoVendor = vendor;

  if (!isCiscoVendor(vendor)) return out;
  if (grossExpected <= 0 && grossLow <= 0 && grossHigh <= 0) return out;

  out.ciscoPromoApplied = true;
  out.ciscoPromoFactor = CISCO_INGEST_PROMO_FACTOR;
  out.expected = grossExpected * CISCO_INGEST_PROMO_FACTOR;
  out.low = grossLow * CISCO_INGEST_PROMO_FACTOR;
  out.high = grossHigh * CISCO_INGEST_PROMO_FACTOR;
  if (!out.assumptions.includes(CISCO_INGEST_PROMO_COPY)) {
    out.assumptions.push(CISCO_INGEST_PROMO_COPY);
  }
  return out;
}
