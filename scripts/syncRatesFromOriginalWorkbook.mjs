#!/usr/bin/env node
/**
 * Propagate originalSizingRates.json → sizingRates.json + sources.json (workbook canonical rates).
 * Usage: node scripts/syncRatesFromOriginalWorkbook.mjs [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  REPO_ROOT,
  SOURCES_PATH,
  loadSourcesJson,
} from './lib/catalogUtils.mjs';

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

/** Workbook simple rate used when composite engine runs in default/simple mode. */
export const WORKBOOK_SIMPLE_SOURCE_IDS = new Set([
  'saas_sso',
  'saas_office',
  'saas_crm',
  'saas_general',
  'iaas',
  'iaas_containers',
  'iaas_instances',
  'iaas_storage',
]);

function sizingUnitFromPrimary(primaryField, unitLabel) {
  const p = String(primaryField || '').toLowerCase();
  const u = String(unitLabel || '').toLowerCase();
  if (p.includes('user') || u.includes('user')) return 'per_user';
  if (p.includes('account')) return 'per_account';
  if (p.includes('endpoint')) return 'per_item';
  if (p.includes('cluster')) return 'per_item';
  return 'per_item';
}

function rateUnitForSizingRates(primaryField, unitLabel) {
  const p = String(primaryField || '').toLowerCase();
  const u = String(unitLabel || '').toLowerCase();
  if (p.includes('user') || u.includes('user')) return 'user';
  if (p.includes('account') || u.includes('account')) return 'account';
  if (p.includes('endpoint')) return 'endpoint';
  if (p.includes('device')) return 'device';
  if (p.includes('server')) return 'server';
  if (p.includes('dc')) return 'domain controller';
  if (p.includes('feed')) return 'feed';
  if (p.includes('pipeline')) return 'pipeline';
  if (p.includes('application')) return 'application';
  if (p.includes('instance')) return 'instance';
  return 'system';
}

function applyRateToNode(node, orig, changes) {
  const rate = Number(orig.rateGbPerUnit);
  const low = rate * (orig.lowMultiplier ?? 0.8);
  const high = rate * (orig.highMultiplier ?? 1.2);
  const strategy = node.sizing_formula?.strategy;
  const isComposite = COMPOSITE_STRATEGIES.has(strategy);

  const before = {
    sizingRate: node.sizingRate,
    sizingRateLow: node.sizingRateLow,
    sizingRateHigh: node.sizingRateHigh,
    formulaRate: node.sizing_formula?.rate_per_unit,
    primary: node.sizing_formula?.primary_input,
  };

  node.sizingRate = rate;
  node.sizingRateLow = low;
  node.sizingRateHigh = high;
  node.workbookRateGbPerUnit = rate;

  if (node.sizing_formula) {
    if (!isComposite || WORKBOOK_SIMPLE_SOURCE_IDS.has(node.id)) {
      node.sizing_formula.rate_per_unit = rate;
    }
    if (orig.primaryInputField) {
      node.sizing_formula.primary_input = orig.primaryInputField;
    }
  }

  if (!isComposite) {
    node.sizingUnit = sizingUnitFromPrimary(orig.primaryInputField, orig.unitLabel);
  }

  const after = {
    sizingRate: node.sizingRate,
    sizingRateLow: node.sizingRateLow,
    sizingRateHigh: node.sizingRateHigh,
    formulaRate: node.sizing_formula?.rate_per_unit,
    primary: node.sizing_formula?.primary_input,
  };

  if (JSON.stringify(before) !== JSON.stringify(after)) {
    changes.push({ id: node.id, before, after });
  }

  for (const child of node.children || []) {
    const childOrig = origEntries[child.id];
    if (childOrig) applyRateToNode(child, childOrig, changes);
  }
}

const write = process.argv.includes('--write');
const origDoc = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'src/data/originalSizingRates.json'), 'utf8'),
);
const origEntries = origDoc.entries || {};
const sizingRatesDoc = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'src/data/sizingRates.json'), 'utf8'),
);
const rates = sizingRatesDoc.rates || {};

const sourceChanges = [];
const roots = loadSourcesJson();
for (const root of roots) {
  const orig = origEntries[root.id];
  if (orig) applyRateToNode(root, orig, sourceChanges);
  for (const child of root.children || []) {
    const childOrig = origEntries[child.id];
    if (childOrig) applyRateToNode(child, childOrig, sourceChanges);
  }
}

const rateChanges = [];
for (const [sourceId, orig] of Object.entries(origEntries)) {
  const rate = Number(orig.rateGbPerUnit);
  const low = rate * (orig.lowMultiplier ?? 0.8);
  const high = rate * (orig.highMultiplier ?? 1.2);
  const existing = rates[sourceId] || { sourceId };
  const next = {
    ...existing,
    sourceId,
    baseRate: rate,
    low,
    medium: rate,
    high,
    unit: rateUnitForSizingRates(orig.primaryInputField, orig.unitLabel),
    unitDescription: orig.unitLabel,
    workbookAligned: true,
    lastUpdated: new Date().toISOString().slice(0, 10),
    source: 'ORIGINAL Sizing Calculator.xlsx (canonical)',
  };
  if (JSON.stringify(existing) !== JSON.stringify(next)) {
    rateChanges.push(sourceId);
  }
  rates[sourceId] = next;
}

console.log(`sources.json: ${sourceChanges.length} nodes updated`);
console.log(`sizingRates.json: ${rateChanges.length} entries updated`);
for (const c of sourceChanges.slice(0, 15)) {
  console.log(JSON.stringify(c));
}
if (sourceChanges.length > 15) console.log(`… and ${sourceChanges.length - 15} more`);

if (write) {
  fs.writeFileSync(SOURCES_PATH, `${JSON.stringify(roots, null, 2)}\n`);
  sizingRatesDoc.rates = rates;
  fs.writeFileSync(
    path.join(REPO_ROOT, 'src/data/sizingRates.json'),
    `${JSON.stringify(sizingRatesDoc, null, 2)}\n`,
  );
  console.log('Wrote sources.json and sizingRates.json');
} else {
  console.log('Dry run — pass --write to apply');
}
