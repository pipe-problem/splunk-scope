/**
 * Splunkbase link resolution — delegates to canonical catalog.
 * @see src/services/splunkbaseCatalog.js
 * @see src/data/splunkbaseCatalog.json
 */
export {
  getSplunkbaseUrl,
  getSplunkbaseLinkLabel,
  resolveSplunkbaseLink,
  getCatalogEntry,
  isSplunkbaseLinkCustomerSafe,
} from '../services/splunkbaseCatalog.js';
