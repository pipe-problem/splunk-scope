#!/usr/bin/env node
/**
 * Content, parameter, and value alignment checks for every flat catalog source.
 * Usage: node scripts/validateSourceContent.mjs
 * Exit 1 if any source has blocking issues.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  REPO_ROOT,
  catalogById,
  deriveUnitLabel,
  flattenCatalog,
  getReferenceDocsArchiveDir,
  loadSourcesJson,
} from './lib/catalogUtils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'));
}

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

function unitFamily(source, rateEntry) {
  const su = String(source.sizingUnit || '').toLowerCase();
  const ru = String(rateEntry?.unit || '').toLowerCase();
  if (su.includes('user') || ru === 'user') return 'user';
  if (su.includes('item') || su.includes('device') || ru === 'device') return 'device';
  if (su.includes('account')) return 'account';
  return 'other';
}

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fieldMatchesPrimary(fieldKey, primaryInputField) {
  if (!primaryInputField || !fieldKey) return false;
  if (fieldKey === primaryInputField) return true;
  const root = String(primaryInputField).split('.')[0];
  return fieldKey === root || fieldKey.startsWith(`${root}.`) || primaryInputField.startsWith(`${fieldKey}.`);
}

function wouldInjectSyntheticPrimary(source, measurement, originalRate, resolveMeasurementInputFields) {
  const primaryKey = measurement?.primaryInputField || originalRate?.primaryInputField;
  const catalogNumbers = (source?.input_fields || []).filter(
    (f) => f.type === 'number' && !String(f.key).includes('manual'),
  );
  const hasPrimaryCoverage = primaryKey
    ? catalogNumbers.some((f) => fieldMatchesPrimary(f.key, primaryKey))
    : catalogNumbers.length > 0;
  if (!primaryKey) return false;
  if (hasPrimaryCoverage) return false;
  return true;
}

async function main() {
  const resolverPath = path.join(REPO_ROOT, 'src', 'utils', 'measurementInputFields.js');
  const { resolveMeasurementInputFields } = await import(pathToFileURL(resolverPath).href);

  const sourcesJson = loadSourcesJson();
  const catalog = catalogById(sourcesJson);
  const flat = flattenCatalog(sourcesJson);
  const questions = loadJson('src/data/sourceMeasurementQuestions.json').questions || {};
  const originalRates = loadJson('src/data/originalSizingRates.json').entries || {};
  const counting = loadJson('src/data/sourceCountingMethods.json').methods || {};
  const sizingRates = loadJson('src/data/sizingRates.json').rates || {};

  const PLACEHOLDER_EXAMPLE_QTY = 2500;
  const issuesBySource = new Map();
  const warningsBySource = new Map();

  function addWarning(sourceId, code, detail) {
    if (!warningsBySource.has(sourceId)) warningsBySource.set(sourceId, []);
    warningsBySource.get(sourceId).push({ code, detail });
  }
  function addIssue(sourceId, code, detail) {
    if (!issuesBySource.has(sourceId)) issuesBySource.set(sourceId, []);
    issuesBySource.get(sourceId).push({ code, detail });
  }

  for (const entry of flat) {
    const sourceId = entry.id;
    const source = catalog.get(sourceId);
    if (!source) continue;

    const measurement = questions[sourceId] ?? null;
    const originalRate = originalRates[sourceId] ?? null;
    const countingMethod = counting[sourceId] ?? null;
    const formulaPrimary = source.sizing_formula?.primary_input
      ? String(source.sizing_formula.primary_input)
      : null;

    if (!source.description || String(source.description).trim().length < 20) {
      addIssue(sourceId, 'missing_description', 'description missing or too short');
    }
    if (!source.whyItMatters || String(source.whyItMatters).trim().length < 20) {
      addIssue(sourceId, 'missing_why_it_matters', 'whyItMatters missing or too short');
    }

    for (const field of source.input_fields || []) {
      if (!field.label || !String(field.label).trim()) {
        addIssue(sourceId, 'input_field_no_label', `input_fields key "${field.key}" has no label`);
      }
      if (field.type === 'select' && (!field.options || !field.options.length)) {
        addIssue(sourceId, 'select_no_options', `select "${field.key}" has empty options`);
      }
    }

    const expectedPrimary =
      formulaPrimary ||
      measurement?.primaryInputField ||
      originalRate?.primaryInputField ||
      null;

    if (formulaPrimary && measurement?.primaryInputField && measurement.primaryInputField !== formulaPrimary) {
      addIssue(
        sourceId,
        'primary_mismatch_formula',
        `measurement primary "${measurement.primaryInputField}" ≠ sizing_formula.primary_input "${formulaPrimary}"`,
      );
    }

    if (expectedPrimary && (source.input_fields || []).length) {
      const hasKey = (source.input_fields || []).some((f) => fieldMatchesPrimary(f.key, expectedPrimary));
      if (!hasKey && !wouldInjectSyntheticPrimary(source, measurement, originalRate, resolveMeasurementInputFields)) {
        addIssue(
          sourceId,
          'primary_not_in_input_fields',
          `primary "${expectedPrimary}" not found in input_fields`,
        );
      }
    }

    if (
      wouldInjectSyntheticPrimary(source, measurement, originalRate, resolveMeasurementInputFields) &&
      !COMPOSITE_STRATEGIES.has(source.sizing_formula?.strategy)
    ) {
      addIssue(
        sourceId,
        'synthetic_primary_injection',
        `primaryInputField "${measurement?.primaryInputField || originalRate?.primaryInputField}" does not match catalog number fields — UI would inject duplicate field`,
      );
    }

    if (measurement?.exampleQuantity === PLACEHOLDER_EXAMPLE_QTY) {
      const primary = measurement?.primaryInputField || formulaPrimary || '';
      const isUserBased =
        String(primary).includes('user') ||
        String(measurement.unitLabel || '').includes('user');
      if (!isUserBased) {
        addIssue(sourceId, 'placeholder_example_quantity', `exampleQuantity still default ${PLACEHOLDER_EXAMPLE_QTY}`);
      }
    }

    if (
      measurement?.unitLabel === 'active users' &&
      expectedPrimary &&
      !String(expectedPrimary).includes('user')
    ) {
      addIssue(
        sourceId,
        'placeholder_unit_label',
        'unitLabel is "active users" but primary field is not user-based',
      );
    }

    if (measurement?.question && countingMethod?.customerQuestion) {
      const q = normalizeText(measurement.question);
      const cq = normalizeText(countingMethod.customerQuestion);
      if (q && cq && q !== cq) {
        const qWords = new Set(q.split(' ').filter((w) => w.length > 3));
        const cqWords = cq.split(' ').filter((w) => w.length > 3);
        const overlap = cqWords.filter((w) => qWords.has(w)).length;
        if (overlap / Math.max(cqWords.length, 1) < 0.35) {
          addIssue(
            sourceId,
            'question_counting_drift',
            'measurement question diverges from sourceCountingMethods.customerQuestion',
          );
        }
      }
    }

    const rateEntry = sizingRates[sourceId];
    if (
      rateEntry &&
      source.sizingRate != null &&
      rateEntry.medium != null &&
      !COMPOSITE_STRATEGIES.has(source.sizing_formula?.strategy) &&
      !String(source.sizingUnit || '').includes('additive')
    ) {
      const label = String(source.configuredItemLabel || '').toLowerCase();
      const rateUnit = String(rateEntry.unit || '').toLowerCase();
      const deviceSized = label.includes('device') || label.includes('firewall') || label.includes('appliance');
      const userRate = rateUnit === 'user';
      if (!(deviceSized && userRate)) {
        const formulaRate = source.sizing_formula?.rate_per_unit;
        const compareSource = formulaRate != null ? Number(formulaRate) : Number(source.sizingRate);
        const compareCatalog = Number(rateEntry.medium);
        const ratio = compareSource / compareCatalog;
        if (Number.isFinite(ratio) && (ratio > 4 || ratio < 0.25)) {
          addIssue(
            sourceId,
            'rate_drift',
            `runtime rate ${compareSource} vs sizingRates medium ${compareCatalog} (ratio ${ratio.toFixed(2)})`,
          );
        }
      }
    }

    const splunkApps = source.splunkApps || [];
    const dupApps = splunkApps.filter((a, i) => splunkApps.indexOf(a) !== i);
    if (dupApps.length) {
      addIssue(sourceId, 'duplicate_splunk_apps', `duplicate splunkApps: ${[...new Set(dupApps)].join(', ')}`);
    }
  }

  const reportPath = path.join(getReferenceDocsArchiveDir(), 'catalog-content-validation.json');
  const report = {
    generatedAt: new Date().toISOString(),
    sourceCount: flat.length,
    sourcesWithIssues: issuesBySource.size,
    sourcesWithWarnings: warningsBySource.size,
    issues: Object.fromEntries(
      [...issuesBySource.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    warnings: Object.fromEntries(
      [...warningsBySource.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  if (warningsBySource.size) {
    console.warn(`Source content warnings (${warningsBySource.size} sources — review sizingRates vs runtime):`);
    for (const [sourceId, warnings] of [...warningsBySource.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 8)) {
      console.warn(`  ${sourceId}: ${warnings.map((w) => w.code).join(', ')}`);
    }
    if (warningsBySource.size > 8) console.warn(`  … and ${warningsBySource.size - 8} more (see report)`);
  }

  if (issuesBySource.size) {
    console.error(`Source content validation FAILED (${issuesBySource.size} sources with issues):`);
    for (const [sourceId, issues] of [...issuesBySource.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      console.error(`  ${sourceId}:`);
      for (const i of issues) {
        console.error(`    - [${i.code}] ${i.detail}`);
      }
    }
    console.error(`\nFull report: ${path.relative(REPO_ROOT, reportPath)}`);
    process.exit(1);
  }

  console.log(`Source content validation PASSED (${flat.length} flat sources)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
