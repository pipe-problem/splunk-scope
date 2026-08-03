import catalogData from '../data/splunkbaseCatalog.json' with { type: 'json' };

const ENTRIES = catalogData.entries || [];
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));
const BY_APP_ID = new Map(
  ENTRIES.filter((e) => e.splunkbaseAppId).map((e) => [String(e.splunkbaseAppId), e]),
);

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/splunk\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const BY_NAME = new Map();
for (const entry of ENTRIES) {
  BY_NAME.set(norm(entry.name), entry);
  for (const alias of entry.aliases || []) {
    BY_NAME.set(norm(alias), entry);
  }
}

/** @typedef {{ catalogId: string, name: string, status: string, url: string|null, customerUrl: string|null, label: string, isSafe: boolean, replacementId: string|null }} SplunkbaseLinkInfo */

/**
 * @param {string} idOrName
 * @returns {object|null}
 */
export function getCatalogEntry(idOrName) {
  if (!idOrName) return null;
  if (BY_ID.has(idOrName)) return BY_ID.get(idOrName);
  return BY_NAME.get(norm(idOrName)) || null;
}

/**
 * Resolve customer-safe Splunkbase URL (verified or replacement only).
 * @param {object|null} entry
 * @returns {string|null}
 */
export function resolveCustomerSplunkbaseUrl(entry) {
  if (!entry) return null;
  if (entry.status === 'verified' && entry.splunkbaseUrl) return entry.splunkbaseUrl;
  if (entry.replacementId) {
    const repl = BY_ID.get(entry.replacementId);
    if (repl?.status === 'verified' && repl.splunkbaseUrl) return repl.splunkbaseUrl;
  }
  return null;
}

/**
 * Full link metadata for UI and exports.
 * @param {string} nameOrCatalogId
 * @returns {SplunkbaseLinkInfo|null}
 */
export function resolveSplunkbaseLink(nameOrCatalogId) {
  const entry = getCatalogEntry(nameOrCatalogId);
  if (!entry) return null;

  const customerUrl = resolveCustomerSplunkbaseUrl(entry);
  const isSafe = entry.status === 'verified' || (entry.status === 'replacementPreferred' && !!customerUrl);

  let label = entry.name;
  if (entry.status === 'needsReview') label = 'Link needs validation';
  else if (entry.status === 'replacementPreferred' && entry.replacementId) {
    const repl = BY_ID.get(entry.replacementId);
    if (repl) label = `${entry.name} (see ${repl.name})`;
  } else if (entry.status === 'deprecated') {
    label = entry.replacementId ? `${entry.name} (deprecated)` : `${entry.name} (deprecated — link needs validation)`;
  }

  return {
    catalogId: entry.id,
    name: entry.name,
    status: entry.status,
    url: entry.splunkbaseUrl || null,
    customerUrl,
    label,
    isSafe,
    replacementId: entry.replacementId || null,
    notes: entry.notes || '',
  };
}

/**
 * Customer-facing URL only — null when not verified/replacement-safe.
 * @param {string} displayName
 * @returns {string|null}
 */
export function getSplunkbaseUrl(displayName) {
  const info = resolveSplunkbaseLink(displayName);
  return info?.customerUrl || null;
}

/**
 * Display label for links (includes "Link needs validation" when appropriate).
 * @param {string} displayName
 * @returns {string}
 */
export function getSplunkbaseLinkLabel(displayName) {
  const info = resolveSplunkbaseLink(displayName);
  return info?.label || displayName;
}

/**
 * Whether a Splunkbase link should appear in customer exports.
 * @param {string} displayName
 * @returns {boolean}
 */
export function isSplunkbaseLinkCustomerSafe(displayName) {
  const info = resolveSplunkbaseLink(displayName);
  return !!info?.isSafe && !!info.customerUrl;
}

export function getCatalogEntries() {
  return ENTRIES;
}

export function getCatalogEntryByAppId(appId) {
  return BY_APP_ID.get(String(appId)) || null;
}
