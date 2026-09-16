#!/usr/bin/env node
/**
 * Trim catalog configure UX to vendor (optional) + workbook primary count only.
 * Exception: sources with optionalSecondaryInputs in originalSizingRates use
 * log channel toggles in the UI (windows_servers) — not extra input_fields.
 * Usage: node scripts/syncSimpleInputFields.mjs [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  REPO_ROOT,
  SOURCES_PATH,
  catalogById,
  flattenCatalog,
  loadSourcesJson,
} from './lib/catalogUtils.mjs';

const write = process.argv.includes('--write');

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

const SIMPLE_STRATEGIES = new Set(['per_item', 'per_user']);

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'));
}

function titleCaseUnit(unitLabel) {
  if (!unitLabel) return 'Quantity';
  const u = String(unitLabel).trim();
  return u.charAt(0).toUpperCase() + u.slice(1);
}

function countFieldLabel(primaryField, unitLabel) {
  const u = String(unitLabel || '').toLowerCase();
  const p = String(primaryField || '').toLowerCase();
  if (p.includes('user') || u.includes('user')) return 'Number of users';
  if (p.includes('dc')) return 'Number of domain controllers';
  if (p.includes('endpoint')) return 'Number of endpoints';
  if (p.includes('server')) return 'Number of servers';
  if (p.includes('device')) return 'Number of devices';
  if (p.includes('account')) return 'Number of accounts';
  if (p.includes('application')) return 'Number of applications';
  if (p.includes('instance')) return 'Number of instances';
  if (p.includes('pipeline')) return 'Number of pipelines';
  if (p.includes('feed')) return 'Number of feeds';
  if (p.includes('sensor')) return 'Number of sensors';
  if (p.includes('cluster')) return 'Number of clusters';
  if (primaryField === 'count') return `Number of ${u || 'units'}`;
  return `Number of ${u || primaryField.replace(/^number_of_/, '').replace(/\./g, ' ')}`;
}

function vendorLabel(sourceId) {
  if (sourceId === 'saas_sso') return 'IdP vendor';
  if (sourceId === 'sso_pam') return 'PAM / vault vendor';
  if (sourceId === 'edr') return 'EDR vendor';
  return 'Vendor';
}

function sizingStrategy(primaryField, unitLabel) {
  const p = String(primaryField || '').toLowerCase();
  const u = String(unitLabel || '').toLowerCase();
  if (p.includes('user') || u.includes('user')) return 'per_user';
  return 'per_item';
}

function buildInputFields(source, orig) {
  const primary = orig.primaryInputField || source.sizing_formula?.primary_input || 'count';
  const fields = [
    {
      key: primary,
      label: countFieldLabel(primary, orig.unitLabel),
      type: 'number',
    },
  ];

  const vendors = source.exampleVendors || [];
  if (vendors.length > 0) {
    fields.unshift({
      key: 'vendor',
      label: vendorLabel(source.id),
      type: 'select',
      options: [...vendors],
    });
  }

  return fields.slice(0, 2);
}

function walk(nodes, origEntries, stats) {
  for (const node of nodes) {
    const orig = origEntries[node.id];
    if (orig) {
      const nextFields = buildInputFields(node, orig);
      const prevLen = (node.input_fields || []).length;
      node.input_fields = nextFields;

      const strategy = sizingStrategy(orig.primaryInputField, orig.unitLabel);
      if (!node.sizing_formula) node.sizing_formula = {};
      if (COMPOSITE_STRATEGIES.has(node.sizing_formula.strategy) || !SIMPLE_STRATEGIES.has(node.sizing_formula.strategy)) {
        node.sizing_formula.strategy = strategy;
        stats.strategyUpdates += 1;
      }
      node.sizing_formula.primary_input = orig.primaryInputField;
      node.sizing_formula.rate_per_unit = Number(orig.rateGbPerUnit);
      node.sizingUnit = strategy === 'per_user' ? 'per_user' : 'per_item';

      if (prevLen !== nextFields.length) stats.fieldUpdates += 1;
    }
    if (node.children?.length) walk(node.children, origEntries, stats);
  }
}

function main() {
  const origDoc = loadJson('src/data/originalSizingRates.json');
  const origEntries = origDoc.entries || {};
  const questionsDoc = loadJson('src/data/sourceMeasurementQuestions.json');
  const countingDoc = loadJson('src/data/sourceCountingMethods.json');
  const questions = questionsDoc.questions || {};
  const methods = countingDoc.methods || {};

  const roots = loadSourcesJson();
  const catalog = catalogById(roots);
  const flat = flattenCatalog(roots);

  const stats = { fieldUpdates: 0, strategyUpdates: 0, qUpdates: 0, mUpdates: 0 };

  walk(roots, origEntries, stats);

  for (const { id: sourceId } of flat) {
    const source = catalog.get(sourceId);
    const orig = origEntries[sourceId];
    if (!source || !orig) continue;

    const primary = orig.primaryInputField;

    if (!questions[sourceId]) {
      questions[sourceId] = { sourceId };
    }
    const q = questions[sourceId];
    // Hand-authored questions in JSON are authoritative; only bootstrap when missing.
    if (!q.question) {
      q.question = `How many ${orig.unitLabel || 'units'}?`;
      stats.qUpdates += 1;
    }
    if (q.primaryInputField !== primary) {
      q.primaryInputField = primary;
      stats.qUpdates += 1;
    }
    q.unitLabel = orig.unitLabel;
    q.helperText = source.customerSummary || source.description?.slice(0, 160) || '';

    if (!methods[sourceId]) {
      methods[sourceId] = { sourceId };
    }
    const m = methods[sourceId];
    if (!m.customerQuestion && q.question) {
      m.customerQuestion = q.question;
      stats.mUpdates += 1;
    }
    if (m.primaryUnit !== orig.unitLabel) {
      m.primaryUnit = orig.unitLabel;
      stats.mUpdates += 1;
    }
    m.howToCount = q.helperText;
  }

  console.log(
    `Simple fields: ${stats.fieldUpdates} sources touched, ${stats.strategyUpdates} strategy updates, ${stats.qUpdates} question updates, ${stats.mUpdates} counting updates`,
  );

  if (!write) {
    console.log('Dry run — pass --write to apply');
    return;
  }

  fs.writeFileSync(SOURCES_PATH, `${JSON.stringify(roots, null, 2)}\n`);
  fs.writeFileSync(
    path.join(REPO_ROOT, 'src/data/sourceMeasurementQuestions.json'),
    `${JSON.stringify({ ...questionsDoc, questions }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(REPO_ROOT, 'src/data/sourceCountingMethods.json'),
    `${JSON.stringify({ ...countingDoc, methods }, null, 2)}\n`,
  );
  console.log('Written sources.json, sourceMeasurementQuestions.json, sourceCountingMethods.json');
}

main();
