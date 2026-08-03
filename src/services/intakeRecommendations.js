/**
 * Intake app recommendations — map engine output to intake app IDs (apps only).
 */
import { recommendApps } from './appRecommendationEngine.js';
import { resolveCanonicalAppId } from './appCatalogService.js';
import {
  filterIntakeAppIds,
  getFlatSplunkApps,
  inferSplunkAppType,
} from './splunkAppsCatalog.js';
import { matchParsedSplunkLabelToAppId } from './intakeImportHelpers.js';

const SPLUNK_APP_BY_CATALOG_ID = new Map();
for (const app of getFlatSplunkApps()) {
  if (app.catalogId) SPLUNK_APP_BY_CATALOG_ID.set(app.catalogId, app.id);
  SPLUNK_APP_BY_CATALOG_ID.set(app.id, app.id);
}

/**
 * Map a catalog or splunk app id to an intake-selectable splunkApps.json id.
 * @param {string} rawId
 * @returns {string|null}
 */
export function mapToIntakeSplunkAppId(rawId) {
  if (!rawId) return null;
  const canonical = resolveCanonicalAppId(rawId) || rawId;
  if (SPLUNK_APP_BY_CATALOG_ID.has(canonical)) {
    const mapped = SPLUNK_APP_BY_CATALOG_ID.get(canonical);
    return inferSplunkAppType({ id: mapped }) === 'app' ? mapped : null;
  }
  const flat = getFlatSplunkApps().find((a) => a.id === canonical);
  if (flat && inferSplunkAppType(flat) === 'app') return flat.id;
  return matchParsedSplunkLabelToAppId(rawId);
}

/**
 * @param {object} intake
 * @param {object} [sourceStatuses]
 * @returns {string[]}
 */
export function suggestRecommendedAppIds(intake, sourceStatuses = {}) {
  const result = recommendApps({ intake, sourceStatuses });
  const rawIds = [
    ...(result.recommendedSolutions || []).map((r) => r.appId),
    ...(result.helpfulApps || []).map((r) => r.appId),
  ];
  const mapped = rawIds
    .map((id) => mapToIntakeSplunkAppId(id))
    .filter(Boolean);
  return filterIntakeAppIds([...new Set(mapped)]);
}
