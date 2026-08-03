/**
 * Canonical app/product catalog loader and ID resolution.
 */

import appCatalogData from '../data/appCatalog.json' with { type: 'json' };

const APPS = appCatalogData.apps || [];
const BY_ID = new Map(APPS.map((a) => [a.id, a]));

/** @type {Map<string, string>} legacy id / alias → canonical appCatalog id */
const ALIAS_TO_ID = new Map();
for (const app of APPS) {
  ALIAS_TO_ID.set(app.id, app.id);
  for (const alias of app.legacyIds || []) {
    ALIAS_TO_ID.set(alias, app.id);
  }
  if (app.splunkbaseCatalogId) {
    ALIAS_TO_ID.set(app.splunkbaseCatalogId, app.id);
  }
  ALIAS_TO_ID.set(slugify(app.displayName), app.id);
  if (app.shortName) ALIAS_TO_ID.set(app.shortName.toLowerCase(), app.id);
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/splunk\s+/gi, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * @param {string} raw
 * @returns {string|null}
 */
export function resolveCanonicalAppId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (BY_ID.has(trimmed)) return trimmed;
  if (ALIAS_TO_ID.has(trimmed)) return ALIAS_TO_ID.get(trimmed);
  const lower = trimmed.toLowerCase();
  if (ALIAS_TO_ID.has(lower)) return ALIAS_TO_ID.get(lower);
  const slug = slugify(trimmed);
  if (ALIAS_TO_ID.has(slug)) return ALIAS_TO_ID.get(slug);
  for (const app of APPS) {
    if (slugify(app.displayName) === slug) return app.id;
  }
  return null;
}

/** @param {string} id */
export function getAppCatalogEntry(id) {
  const canonical = resolveCanonicalAppId(id);
  return canonical ? BY_ID.get(canonical) || null : null;
}

export function getAllCatalogApps() {
  return APPS;
}

export function getAppsByType(type) {
  return APPS.filter((a) => a.type === type);
}

export function getAppsForSource(sourceId) {
  return APPS.filter(
    (a) =>
      (a.minimumUsefulSources || []).includes(sourceId) ||
      (a.recommendedSources || []).includes(sourceId) ||
      (a.sourceTriggers || []).includes(sourceId),
  );
}

/**
 * Normalize a list of intake ids, profile display names, or source metadata strings to canonical catalog ids.
 * @param {string[]} rawList
 * @returns {Set<string>}
 */
export function collectCanonicalAppIds(rawList) {
  const set = new Set();
  for (const raw of rawList || []) {
    const id = resolveCanonicalAppId(raw);
    if (id) set.add(id);
  }
  return set;
}

/**
 * True when a source's splunkApps metadata aligns with desired/profile app interest (canonical ids).
 * @param {string[]} sourceSplunkApps
 * @param {string[]} interestRaw
 */
export function sourceMatchesAppInterest(sourceSplunkApps, interestRaw) {
  const interest = collectCanonicalAppIds(interestRaw);
  if (!interest.size) return false;
  for (const raw of sourceSplunkApps || []) {
    const id = resolveCanonicalAppId(raw);
    if (id && interest.has(id)) return true;
  }
  return false;
}

export { slugify };
