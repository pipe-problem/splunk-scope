#!/usr/bin/env node
/**
 * Sync sources.json sizingRate bands from sizingRates.json (authoritative planning doc).
 * Usage: node scripts/syncRatesFromSizingCatalog.mjs [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { REPO_ROOT, SOURCES_PATH, loadSourcesJson } from './lib/catalogUtils.mjs';

const COMPOSITE_STRATEGIES = new Set([
  'iaas_cloud',
  'container_additive',
  'cloud_vm_additive',
  'cloud_storage_additive',
  'office_productivity_additive',
  'crm_additive',
  'sso_identity_additive',
  'saas_additive_v2',
]);

const write = process.argv.includes('--write');
const sizingRatesDoc = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'src/data/sizingRates.json'), 'utf8'),
);
const ratesBySourceId = new Map();
for (const [key, entry] of Object.entries(sizingRatesDoc.rates || {})) {
  const id = entry.sourceId || key;
  ratesBySourceId.set(id, entry);
}

let updated = 0;
const changes = [];

function syncNode(node) {
  const strategy = node.sizing_formula?.strategy;
  const isComposite = COMPOSITE_STRATEGIES.has(strategy);
  const isAdditiveUnit = String(node.sizingUnit || '').includes('additive');

  const rateEntry = ratesBySourceId.get(node.id);
  if (rateEntry && !isComposite && !isAdditiveUnit) {
    const medium = Number(rateEntry.medium);
    const low = Number(rateEntry.low);
    const high = Number(rateEntry.high);
    if (Number.isFinite(medium)) {
      const before = {
        sizingRate: node.sizingRate,
        sizingRateLow: node.sizingRateLow,
        sizingRateHigh: node.sizingRateHigh,
        formulaRate: node.sizing_formula?.rate_per_unit,
      };
      node.sizingRate = medium;
      if (Number.isFinite(low)) node.sizingRateLow = low;
      if (Number.isFinite(high)) node.sizingRateHigh = high;
      if (node.sizing_formula && node.sizing_formula.rate_per_unit != null) {
        node.sizing_formula.rate_per_unit = medium;
      }
      const after = {
        sizingRate: node.sizingRate,
        sizingRateLow: node.sizingRateLow,
        sizingRateHigh: node.sizingRateHigh,
        formulaRate: node.sizing_formula?.rate_per_unit,
      };
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        updated += 1;
        changes.push({ id: node.id, before, after });
      }
    }
    if (rateEntry.needsReview === false && node.needsReview === true) {
      node.needsReview = false;
      updated += 1;
      changes.push({ id: node.id, needsReview: false });
    }
  }

  if (node.id === 'cspm' && node.sizingUnit === 'per_user') {
    node.sizingUnit = 'per_account';
    updated += 1;
    changes.push({ id: 'cspm', sizingUnit: 'per_account' });
  }

  for (const child of node.children || []) {
    syncNode(child);
  }
}

const roots = loadSourcesJson();
for (const root of roots) syncNode(root);

console.log(`Would update ${updated} field groups on ${changes.length} sources`);
if (changes.length) {
  for (const c of changes.slice(0, 30)) {
    console.log(JSON.stringify(c));
  }
  if (changes.length > 30) console.log(`… and ${changes.length - 30} more`);
}

if (write) {
  fs.writeFileSync(SOURCES_PATH, `${JSON.stringify(roots, null, 2)}\n`);
  console.log(`Wrote ${SOURCES_PATH}`);
} else {
  console.log('Dry run — pass --write to apply');
}
