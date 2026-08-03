/**
 * Splunk apps catalog helpers — intake vs full catalog (apps vs add-ons).
 */
import splunkApps from '../data/splunkApps.json';

const FLAT_SPLUNK_APPS = splunkApps.flatMap((cat) =>
  cat.apps.map((app) => ({ ...app, category: cat.category })),
);

/**
 * @param {{ appType?: string, id?: string, name?: string }} app
 * @returns {'app' | 'addon'}
 */
export function inferSplunkAppType(app) {
  if (app.appType === 'app' || app.appType === 'addon') return app.appType;
  if (app.id?.startsWith('add_on_')) return 'addon';
  if (/\badd-on\b/i.test(app.name || '')) return 'addon';
  return 'app';
}

/**
 * Catalog for Intake "Desired Splunk apps" — products only, never add-ons.
 * @returns {typeof splunkApps}
 */
export function getIntakeSplunkAppsCatalog() {
  return splunkApps
    .map((cat) => ({
      ...cat,
      apps: cat.apps.filter((app) => inferSplunkAppType(app) === 'app'),
    }))
    .filter((cat) => cat.apps.length > 0);
}

/**
 * @param {string} appId
 * @returns {boolean}
 */
export function isIntakeSplunkAppId(appId) {
  if (!appId || String(appId).startsWith('custom:')) return true;
  if (String(appId).startsWith('add_on_')) return false;
  const hit = FLAT_SPLUNK_APPS.find((a) => a.id === appId);
  if (!hit) return true;
  return inferSplunkAppType(hit) === 'app';
}

/**
 * Strip add-on IDs from intake desired/recommended app lists.
 * @param {string[]} ids
 * @returns {string[]}
 */
export function filterIntakeAppIds(ids) {
  return (ids || []).filter(isIntakeSplunkAppId);
}

export function getFlatSplunkApps() {
  return FLAT_SPLUNK_APPS;
}

export function getIntakeSplunkAppIds() {
  return FLAT_SPLUNK_APPS.filter((a) => inferSplunkAppType(a) === 'app').map((a) => a.id);
}
