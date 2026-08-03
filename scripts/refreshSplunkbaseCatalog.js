#!/usr/bin/env node
/**
 * Refresh Splunkbase catalog from seed + discovered references.
 * Validates each URL via HTTP before marking verified.
 *
 * Usage: node scripts/refreshSplunkbaseCatalog.js [--skip-live]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateSplunkbaseEntry,
  canonicalSplunkbaseUrl,
  parseAppIdFromUrl,
} from './lib/splunkbaseValidator.mjs';
import { getReferenceDocsArchiveDir } from './lib/catalogUtils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REF_ARCHIVE = getReferenceDocsArchiveDir();
const SEED_PATH = path.join(ROOT, 'src/data/splunkbaseCatalog.seed.json');
const CATALOG_PATH = path.join(ROOT, 'src/data/splunkbaseCatalog.json');
const REPORT_PATH = path.join(REF_ARCHIVE, 'SPLUNKBASE_CATALOG_REPORT.md');
const VALIDATION_JSON_PATH = path.join(REF_ARCHIVE, 'splunkbase-catalog-validation.json');

const DELAY_MS = 150;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function stripInternalFields(entry) {
  const { forceStatus, validationReason, pageTitle, titleMatchScore, ...rest } = entry;
  void forceStatus;
  void validationReason;
  void pageTitle;
  void titleMatchScore;
  return rest;
}

/** Merge discovery candidates from existing app data files. */
function discoverCandidates(seedEntries) {
  const byId = new Map(seedEntries.map((e) => [e.id, { ...e }]));
  const technicalAddons = loadJson(path.join(ROOT, 'src/data/technicalAddons.json'));
  const splunkApps = loadJson(path.join(ROOT, 'src/data/splunkApps.json'));

  for (const ta of technicalAddons.addons || []) {
    const catalogId = ta.catalogId || ta.id;
    if (byId.has(catalogId)) continue;
    if (ta.splunkbaseId) {
      byId.set(catalogId, {
        id: catalogId,
        name: ta.name,
        type: 'addon',
        vendor: 'Splunk LLC',
        splunkbaseAppId: String(ta.splunkbaseId),
        splunkbaseUrl: canonicalSplunkbaseUrl(ta.splunkbaseId),
        status: 'needsReview',
        replacementId: null,
        sourceFamilies: [],
        relatedSourceIds: ta.supportedSources || [],
        notes: 'Discovered from technicalAddons.json — pending live validation.',
      });
    }
  }

  for (const cat of splunkApps) {
    for (const app of cat.apps || []) {
      const catalogId = app.catalogId || app.id;
      if (byId.has(catalogId)) continue;
      if (app.splunkbaseId) {
        byId.set(catalogId, {
          id: catalogId,
          name: app.name,
          type: 'app',
          vendor: 'Splunk LLC',
          splunkbaseAppId: String(app.splunkbaseId),
          splunkbaseUrl: canonicalSplunkbaseUrl(app.splunkbaseId),
          status: 'needsReview',
          replacementId: null,
          sourceFamilies: [],
          relatedSourceIds: [],
          notes: 'Discovered from splunkApps.json — pending live validation.',
        });
      }
    }
  }

  return [...byId.values()];
}

function collectUsageReferences() {
  const refs = { catalogIds: new Set(), names: new Set() };
  const technicalAddons = loadJson(path.join(ROOT, 'src/data/technicalAddons.json'));
  const splunkApps = loadJson(path.join(ROOT, 'src/data/splunkApps.json'));

  for (const ta of technicalAddons.addons || []) {
    if (ta.catalogId) refs.catalogIds.add(ta.catalogId);
    if (ta.name) refs.names.add(ta.name);
  }
  for (const cat of splunkApps) {
    for (const app of cat.apps || []) {
      if (app.catalogId) refs.catalogIds.add(app.catalogId);
      if (app.name) refs.names.add(app.name);
    }
  }
  return refs;
}

function buildReport(entries, validation, usage) {
  const counts = { verified: 0, needsReview: 0, deprecated: 0, replacementPreferred: 0 };
  for (const e of entries) counts[e.status] = (counts[e.status] || 0) + 1;

  const dupAppIds = validation.duplicateAppIds || [];
  const dupNames = validation.duplicateNames || [];
  const missingFamilies = entries.filter((e) => e.status === 'verified' && !(e.sourceFamilies?.length));
  const unused = entries.filter((e) => !usage.catalogIds.has(e.id) && e.status === 'verified');

  const lines = [
    '# Splunkbase Catalog Report',
    '',
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|------:|`,
    `| Total entries | ${entries.length} |`,
    `| Verified | ${counts.verified || 0} |`,
    `| Needs review | ${counts.needsReview || 0} |`,
    `| Deprecated | ${counts.deprecated || 0} |`,
    `| Replacement preferred | ${counts.replacementPreferred || 0} |`,
    '',
    '## Broken / invalid URLs',
    '',
  ];

  const broken = validation.results.filter((r) => r.validationReason && r.status !== 'verified' && r.status !== 'deprecated' && r.status !== 'replacementPreferred');
  if (!broken.length) lines.push('_None marked verified with validation failures._');
  else {
    for (const b of broken) {
      lines.push(`- **${b.id}** (${b.name}): ${b.validationReason || b.status} — ${b.notes || ''}`);
    }
  }

  lines.push('', '## Duplicate app IDs', '');
  if (!dupAppIds.length) lines.push('_None._');
  else dupAppIds.forEach((d) => lines.push(`- App ID **${d.appId}**: ${d.ids.join(', ')}`));

  lines.push('', '## Duplicate names', '');
  if (!dupNames.length) lines.push('_None._');
  else dupNames.forEach((d) => lines.push(`- **${d.name}**: ${d.ids.join(', ')}`));

  lines.push('', '## Verified entries missing source family mappings', '');
  if (!missingFamilies.length) lines.push('_None._');
  else missingFamilies.forEach((e) => lines.push(`- ${e.id} (${e.name})`));

  lines.push('', '## Catalog IDs referenced in app data but missing from catalog', '');
  const missingRefs = [...usage.catalogIds].filter((id) => !entries.some((e) => e.id === id));
  if (!missingRefs.length) lines.push('_None._');
  else missingRefs.forEach((id) => lines.push(`- ${id}`));

  lines.push('', '## Verified entries not referenced in app data', '');
  if (!unused.length) lines.push('_None._');
  else unused.slice(0, 30).forEach((e) => lines.push(`- ${e.id} (${e.name})`));
  if (unused.length > 30) lines.push(`- … and ${unused.length - 30} more`);

  lines.push('', '## Needs review entries', '');
  entries
    .filter((e) => e.status === 'needsReview')
    .forEach((e) => lines.push(`- **${e.id}**: ${e.notes || 'pending validation'}`));

  lines.push('', '## Deprecated / replacement preferred', '');
  entries
    .filter((e) => e.status === 'deprecated' || e.status === 'replacementPreferred')
    .forEach((e) => {
      lines.push(`- **${e.id}** (${e.status})${e.replacementId ? ` → ${e.replacementId}` : ''}: ${e.notes || ''}`);
    });

  return lines.join('\n');
}

function analyzeEntries(entries) {
  const appIdMap = new Map();
  const nameMap = new Map();
  for (const e of entries) {
    if (e.splunkbaseAppId) {
      const list = appIdMap.get(e.splunkbaseAppId) || [];
      list.push(e.id);
      appIdMap.set(e.splunkbaseAppId, list);
    }
    const key = e.name?.toLowerCase();
    if (key) {
      const list = nameMap.get(key) || [];
      list.push(e.id);
      nameMap.set(key, list);
    }
  }
  const duplicateAppIds = [...appIdMap.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([appId, ids]) => ({ appId, ids }));
  const duplicateNames = [...nameMap.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([name, ids]) => ({ name, ids }));
  return { duplicateAppIds, duplicateNames };
}

async function main() {
  const skipLive = process.argv.includes('--skip-live');
  const seed = loadJson(SEED_PATH);
  let candidates = discoverCandidates(seed.entries || []);

  console.log(`Splunkbase catalog refresh — ${candidates.length} candidate entries`);
  const results = [];

  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i];
    const prepared = {
      ...entry,
      splunkbaseUrl: entry.splunkbaseUrl || (entry.splunkbaseAppId ? canonicalSplunkbaseUrl(entry.splunkbaseAppId) : null),
    };

    if (skipLive || !prepared.splunkbaseAppId) {
      results.push({
        ...stripInternalFields(prepared),
        status: prepared.status || 'needsReview',
        lastVerified: prepared.lastVerified || null,
      });
    } else {
      const validated = await validateSplunkbaseEntry(prepared);
      results.push(stripInternalFields(validated));
      process.stdout.write(`  [${i + 1}/${candidates.length}] ${validated.id}: ${validated.status}\n`);
      await sleep(DELAY_MS);
    }
  }

  // Resolve replacementId references — ensure replacement entries exist
  const byId = new Map(results.map((e) => [e.id, e]));
  for (const e of results) {
    if (e.replacementId && !byId.has(e.replacementId)) {
      e.notes = [e.notes, `replacementId "${e.replacementId}" not found in catalog`].filter(Boolean).join(' ');
      if (e.status === 'verified') e.status = 'needsReview';
    }
  }

  const analysis = analyzeEntries(results);
  const usage = collectUsageReferences();
  const validationPayload = {
    generatedAt: new Date().toISOString(),
    skipLive,
    summary: {
      total: results.length,
      verified: results.filter((e) => e.status === 'verified').length,
      needsReview: results.filter((e) => e.status === 'needsReview').length,
      deprecated: results.filter((e) => e.status === 'deprecated').length,
      replacementPreferred: results.filter((e) => e.status === 'replacementPreferred').length,
    },
    duplicateAppIds: analysis.duplicateAppIds,
    duplicateNames: analysis.duplicateNames,
    missingCatalogRefs: [...usage.catalogIds].filter((id) => !byId.has(id)),
    results: results.map((e) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      splunkbaseAppId: e.splunkbaseAppId,
      validationReason: e.validationReason || null,
      notes: e.notes,
    })),
  };

  const catalog = {
    version: '1.0.0',
    lastRefreshed: new Date().toISOString().slice(0, 10),
    description: 'Canonical Splunkbase URL catalog for Splunk Scope. URLs marked verified were checked via HTTP.',
    entries: results,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  fs.writeFileSync(REPORT_PATH, `${buildReport(results, validationPayload, usage)}\n`);
  fs.writeFileSync(VALIDATION_JSON_PATH, `${JSON.stringify(validationPayload, null, 2)}\n`);

  console.log(`\nWrote ${CATALOG_PATH}`);
  console.log(`Wrote ${REPORT_PATH}`);
  console.log(`Wrote ${VALIDATION_JSON_PATH}`);
  console.log(`Verified: ${validationPayload.summary.verified}, needsReview: ${validationPayload.summary.needsReview}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
