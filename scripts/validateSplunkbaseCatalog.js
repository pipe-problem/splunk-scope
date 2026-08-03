#!/usr/bin/env node
/**
 * Structural + optional live validation for splunkbaseCatalog.json
 *
 * Usage:
 *   node scripts/validateSplunkbaseCatalog.js
 *   node scripts/validateSplunkbaseCatalog.js --live
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateSplunkbaseEntry,
  canonicalSplunkbaseUrl,
  parseAppIdFromUrl,
  isCustomerFacingLinkSafe,
  resolveCustomerUrl,
} from './lib/splunkbaseValidator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'src/data/splunkbaseCatalog.json');

const SPLUNKBASE_RE = /^https:\/\/splunkbase\.splunk\.com\/app\/\d+\/?$/;

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function collectCatalogRefs() {
  const refs = new Set();
  for (const file of ['src/data/technicalAddons.json', 'src/data/splunkApps.json']) {
    const data = loadJson(path.join(ROOT, file));
    if (data.addons) {
      for (const ta of data.addons) if (ta.catalogId) refs.add(ta.catalogId);
    }
    if (Array.isArray(data)) {
      for (const cat of data) {
        for (const app of cat.apps || []) if (app.catalogId) refs.add(app.catalogId);
      }
    }
  }
  return refs;
}

function collectRawSplunkbaseUrls() {
  const urls = [];
  for (const file of ['src/data/technicalAddons.json', 'src/data/splunkApps.json', 'src/data/premiumSplunkbaseIds.json']) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) continue;
    const raw = fs.readFileSync(fp, 'utf8');
    const matches = raw.match(/splunkbase\.splunk\.com\/app\/\d+/g) || [];
    urls.push(...matches.map((m) => `https://${m}`));
  }
  return urls;
}

async function main() {
  const live = process.argv.includes('--live');
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error('FAIL: src/data/splunkbaseCatalog.json not found. Run npm run refresh:splunkbase first.');
    process.exit(1);
  }

  const catalog = loadJson(CATALOG_PATH);
  const entries = catalog.entries || [];
  let errors = 0;
  let warnings = 0;

  const ids = new Set();
  const appIds = new Map();

  for (const e of entries) {
    if (!e.id || !e.name || !e.type || !e.status) {
      console.error(`FAIL ${e.id || e.name}: missing required field (id, name, type, status)`);
      errors++;
    }
    if (ids.has(e.id)) {
      console.error(`FAIL duplicate catalog id: ${e.id}`);
      errors++;
    }
    ids.add(e.id);

    if (e.splunkbaseAppId) {
      const list = appIds.get(e.splunkbaseAppId) || [];
      list.push(e.id);
      appIds.set(e.splunkbaseAppId, list);
    }

    if (e.status === 'verified') {
      if (!e.splunkbaseUrl) {
        console.error(`FAIL ${e.id}: verified entry missing splunkbaseUrl`);
        errors++;
      } else if (!SPLUNKBASE_RE.test(e.splunkbaseUrl)) {
        console.error(`FAIL ${e.id}: verified URL not canonical: ${e.splunkbaseUrl}`);
        errors++;
      } else if (parseAppIdFromUrl(e.splunkbaseUrl) !== String(e.splunkbaseAppId)) {
        console.error(`FAIL ${e.id}: URL app id mismatch`);
        errors++;
      }
      if (!e.lastVerified) {
        warnings++;
        console.warn(`WARN ${e.id}: verified but missing lastVerified`);
      }
    }
  }

  for (const e of entries) {
    if (e.replacementId && !ids.has(e.replacementId)) {
      console.error(`FAIL ${e.id}: replacementId "${e.replacementId}" not in catalog`);
      errors++;
    }
  }

  for (const [appId, catalogIds] of appIds.entries()) {
    if (catalogIds.length > 1) {
      console.error(`FAIL duplicate splunkbaseAppId ${appId}: ${catalogIds.join(', ')}`);
      errors++;
    }
  }

  const catalogRefs = collectCatalogRefs();
  for (const ref of catalogRefs) {
    if (!ids.has(ref)) {
      console.error(`FAIL catalogId "${ref}" referenced in data files but missing from catalog`);
      errors++;
    }
  }

  const rawUrls = collectRawSplunkbaseUrls();
  if (rawUrls.length) {
    warnings++;
    console.warn(`WARN ${rawUrls.length} raw splunkbase URL(s) still in data files — prefer catalogId references`);
  }

  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const e of entries) {
    if (e.status === 'deprecated' && !e.replacementId) {
      warnings++;
      console.warn(`WARN ${e.id}: deprecated without replacementId`);
    }
    if (!isCustomerFacingLinkSafe(e) && e.status !== 'needsReview') {
      const url = resolveCustomerUrl(e, byId);
      if (!url && ['deprecated', 'replacementPreferred'].includes(e.status)) {
        warnings++;
        console.warn(`WARN ${e.id}: no customer-safe URL via replacement`);
      }
    }
  }

  if (live) {
    console.log('Running live HTTP validation for verified entries…');
    for (const e of entries.filter((x) => x.splunkbaseAppId && x.status !== 'needsReview')) {
      const result = await validateSplunkbaseEntry(e);
      if (result.status === 'needsReview' && e.status === 'verified') {
        console.error(`FAIL ${e.id}: live validation failed — ${result.notes}`);
        errors++;
      }
    }
  }

  console.log(`\nSplunkbase catalog validation: ${errors} error(s), ${warnings} warning(s), ${entries.length} entries`);
  console.log(`  verified: ${entries.filter((e) => e.status === 'verified').length}`);
  console.log(`  needsReview: ${entries.filter((e) => e.status === 'needsReview').length}`);

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
