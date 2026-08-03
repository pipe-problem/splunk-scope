#!/usr/bin/env node
/**
 * Asserts every flat catalog source with an originalSizingRates entry or measurement
 * question would show at least one number input in SourceConfigModal.
 *
 * Usage: node scripts/audit-measurement-coverage.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REPO_ROOT, catalogById, flattenCatalog, loadSourcesJson } from './lib/catalogUtils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'));
}

function fieldMatchesPrimary(fieldKey, primaryInputField) {
  if (!primaryInputField || !fieldKey) return false;
  if (fieldKey === primaryInputField) return true;
  const root = String(primaryInputField).split('.')[0];
  return fieldKey === root || fieldKey.startsWith(`${root}.`) || primaryInputField.startsWith(`${fieldKey}.`);
}

function wouldInjectSyntheticPrimary(source, measurement, originalRate) {
  const primaryKey = measurement?.primaryInputField || originalRate?.primaryInputField;
  const catalogNumbers = (source?.input_fields || []).filter(
    (f) => f.type === 'number' && !String(f.key).includes('manual'),
  );
  const hasPrimaryCoverage = primaryKey
    ? catalogNumbers.some((f) => fieldMatchesPrimary(f.key, primaryKey))
    : catalogNumbers.length > 0;
  if (!primaryKey || !catalogNumbers.length) return false;
  return !hasPrimaryCoverage;
}

async function main() {
  const resolverPath = path.join(REPO_ROOT, 'src', 'utils', 'measurementInputFields.js');
  const { resolveMeasurementInputFields } = await import(pathToFileURL(resolverPath).href);
  const catalog = catalogById(loadSourcesJson());
  const rates = loadJson('src/data/originalSizingRates.json');
  const questions = loadJson('src/data/sourceMeasurementQuestions.json').questions || {};

  const flatIds = new Set(flattenCatalog(loadSourcesJson()).map((s) => s.id));
  const inScope = new Set([
    ...Object.keys(rates.entries || {}),
    ...Object.keys(questions),
  ]);

  const fails = [];
  const alignmentIssues = [];

  for (const sourceId of [...inScope].sort()) {
    if (!flatIds.has(sourceId)) continue;

    const source = catalog.get(sourceId);
    if (!source) {
      fails.push({ sourceId, reason: 'missing catalog entry' });
      continue;
    }

    const measurement = questions[sourceId] ?? null;
    const originalRate = rates.entries?.[sourceId] ?? null;

    const formulaPrimary = source.sizing_formula?.primary_input
      ? String(source.sizing_formula.primary_input)
      : null;

    if (measurement && originalRate && measurement.primaryInputField !== originalRate.primaryInputField) {
      alignmentIssues.push({
        sourceId,
        issue: 'primaryInputField mismatch',
        question: measurement.primaryInputField,
        rate: originalRate.primaryInputField,
      });
    }
    if (measurement && originalRate && measurement.unitLabel !== originalRate.unitLabel) {
      alignmentIssues.push({
        sourceId,
        issue: 'unitLabel mismatch',
        question: measurement.unitLabel,
        rate: originalRate.unitLabel,
      });
    }
    if (formulaPrimary && measurement?.primaryInputField && measurement.primaryInputField !== formulaPrimary) {
      alignmentIssues.push({
        sourceId,
        issue: 'primaryInputField ≠ sizing_formula.primary_input',
        question: measurement.primaryInputField,
        rate: formulaPrimary,
      });
    }
    if (wouldInjectSyntheticPrimary(source, measurement, originalRate)) {
      const composite = new Set([
        'iaas_cloud',
        'container_additive',
        'cloud_vm_additive',
        'cloud_storage_additive',
        'office_productivity_additive',
        'crm_additive',
        'sso_identity_additive',
        'saas_additive_v2',
      ]);
      if (!composite.has(source.sizing_formula?.strategy)) {
        alignmentIssues.push({
          sourceId,
          issue: 'synthetic primary field would be injected',
          question: measurement?.primaryInputField || originalRate?.primaryInputField,
          rate: formulaPrimary,
        });
      }
    }

    const { numbers } = resolveMeasurementInputFields(sourceId, source, measurement, originalRate);
    if (!numbers.length) {
      fails.push({
        sourceId,
        reason: 'modal would show zero number inputs',
        hasRate: Boolean(originalRate),
        hasQuestion: Boolean(measurement),
        catalogInputFields: (source.input_fields || []).length,
      });
    }
  }

  if (alignmentIssues.length) {
    console.error(`Measurement alignment FAILED (${alignmentIssues.length} issues):`);
    for (const issue of alignmentIssues) {
      console.error(`  - ${issue.sourceId}: ${issue.issue}`, issue.question ?? '', '↔', issue.rate ?? '');
    }
    console.error('');
    process.exit(1);
  }

  if (fails.length) {
    console.error(`Measurement coverage audit FAILED (${fails.length} sources):`);
    for (const f of fails) {
      console.error(`  - ${f.sourceId}: ${f.reason}`, `(rate=${f.hasRate}, question=${f.hasQuestion})`);
    }
    process.exit(1);
  }

  console.log(`Measurement coverage audit PASSED (${inScope.size} in-scope flat sources)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
