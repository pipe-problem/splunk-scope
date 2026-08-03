import aliasesConfig from '../data/sourceSearchAliases.json' with { type: 'json' };

/**
 * Deterministic source library search — matches names, vendors, apps, and alias terms.
 * @param {object[]} catalog - flat source catalog entries
 * @param {string} query
 * @returns {object[]}
 */
export function searchSourceCatalog(catalog, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return catalog;

  const aliasSourceIds = new Set();
  for (const row of aliasesConfig.aliases || []) {
    if (row.terms.some((t) => q.includes(t) || t.includes(q))) {
      for (const id of row.sourceIds || []) aliasSourceIds.add(id);
    }
  }

  const tokens = q.split(/\s+/).filter(Boolean);

  return catalog.filter((s) => {
    if (aliasSourceIds.has(s.id)) return true;
    const blob = [
      s.id,
      s.name,
      s.category,
      s.subcategory,
      s.description,
      s.whyItMatters,
      ...(s.exampleVendors || []),
      ...(s.splunkApps || []),
      ...(s.technicalAddons || []),
      ...(s.alternateNames || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return tokens.every((tok) => blob.includes(tok));
  });
}

export function getAliasTermsForSource(sourceId) {
  const terms = [];
  for (const row of aliasesConfig.aliases || []) {
    if (row.sourceIds?.includes(sourceId)) terms.push(...row.terms);
  }
  return [...new Set(terms)];
}
