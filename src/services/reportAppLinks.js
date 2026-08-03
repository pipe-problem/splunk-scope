import { getFlatSplunkApps } from './splunkAppsCatalog.js';
import { APPS_BY_ID } from './goalAppSourceKnowledge.js';
import { resolveSplunkbaseLink } from './splunkbaseCatalog.js';
import { getCustomerAppDisplayName } from '../utils/customerAppDisplay.js';

/**
 * @param {string[]} appIds
 * @returns {{ id: string, name: string, url: string|null }[]}
 */
export function resolvePoweredAppLinks(appIds = []) {
  return (appIds || []).map((appId) => {
    const flat = getFlatSplunkApps().find((a) => a.id === appId);
    const knowledge = APPS_BY_ID.get(appId);
    const catalogKey = flat?.catalogId || knowledge?.splunkbaseCatalogId || appId;
    const link = resolveSplunkbaseLink(catalogKey);
    return {
      id: appId,
      name: getCustomerAppDisplayName(appId, flat?.name || knowledge?.name || appId),
      url: link?.customerUrl || null,
    };
  });
}
