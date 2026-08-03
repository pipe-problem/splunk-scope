#!/usr/bin/env node
/**
 * Align sourceMeasurementQuestions.json (and originalSizingRates primary fields)
 * with sources.json sizing_formula.primary_input and counting methods.
 *
 * Usage: node scripts/syncMeasurementFromCatalog.mjs [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  REPO_ROOT,
  catalogById,
  deriveUnitLabel,
  flattenCatalog,
  loadSourcesJson,
} from './lib/catalogUtils.mjs';

const write = process.argv.includes('--write');

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'));
}

function unitFromCounting(method, catalogEntry) {
  if (method?.primaryUnit) return String(method.primaryUnit).toLowerCase();
  return deriveUnitLabel(catalogEntry);
}

function sensibleExample(primaryField, unitLabel) {
  const u = String(unitLabel || '').toLowerCase();
  const p = String(primaryField || '').toLowerCase();
  if (p.includes('account')) return 12;
  if (p.includes('user')) return 2500;
  if (p.includes('server') || p.includes('host') || p.includes('instance')) return 120;
  if (p.includes('endpoint') || p.includes('device')) return 500;
  if (p.includes('application')) return 25;
  if (u.includes('cluster')) return 8;
  if (u.includes('account')) return 12;
  return 100;
}

function main() {
  const sourcesJson = loadSourcesJson();
  const catalog = catalogById(sourcesJson);
  const flat = flattenCatalog(sourcesJson);
  const questionsDoc = loadJson('src/data/sourceMeasurementQuestions.json');
  const ratesDoc = loadJson('src/data/originalSizingRates.json');
  const counting = loadJson('src/data/sourceCountingMethods.json').methods || {};

  const questions = questionsDoc.questions || {};
  const entries = ratesDoc.entries || {};

  let qUpdates = 0;
  let rUpdates = 0;

  for (const { id: sourceId } of flat) {
    const source = catalog.get(sourceId);
    if (!source) continue;

    const formulaPrimary = source.sizing_formula?.primary_input
      ? String(source.sizing_formula.primary_input)
      : null;
    const method = counting[sourceId];
    const unitLabel = unitFromCounting(method, source);

    if (!questions[sourceId]) {
      if (method?.customerQuestion || formulaPrimary) {
        questions[sourceId] = {
          sourceId,
          question: method?.customerQuestion || `How many ${unitLabel} apply to ${source.name}?`,
          primaryInputField: formulaPrimary || 'count',
          unitLabel,
          exampleQuantity: sensibleExample(formulaPrimary, unitLabel),
          helperText: method?.howToCount || '',
        };
        qUpdates += 1;
      }
      continue;
    }

    const q = questions[sourceId];
    if (formulaPrimary && q.primaryInputField !== formulaPrimary) {
      q.primaryInputField = formulaPrimary;
      qUpdates += 1;
    }
    if (unitLabel && q.unitLabel !== unitLabel && q.unitLabel === 'active users' && !String(formulaPrimary || '').includes('user')) {
      q.unitLabel = unitLabel;
      qUpdates += 1;
    }
    if (q.exampleQuantity === 2500 && formulaPrimary && !String(formulaPrimary).includes('user')) {
      q.exampleQuantity = sensibleExample(formulaPrimary, unitLabel);
      qUpdates += 1;
    }
    if (method?.customerQuestion && !q.question) {
      q.question = method.customerQuestion;
      qUpdates += 1;
    }
    if (method?.howToCount && (!q.helperText || q.helperText.length < 10)) {
      q.helperText = method.howToCount;
      qUpdates += 1;
    }

    if (entries[sourceId] && formulaPrimary && entries[sourceId].primaryInputField !== formulaPrimary) {
      entries[sourceId].primaryInputField = formulaPrimary;
      rUpdates += 1;
    }
    if (entries[sourceId] && unitLabel && entries[sourceId].unitLabel === 'active users' && !String(formulaPrimary || '').includes('user')) {
      entries[sourceId].unitLabel = unitLabel;
      rUpdates += 1;
    }
  }

  console.log(`Would update ${qUpdates} measurement question fields, ${rUpdates} original rate fields`);
  if (!write) {
    console.log('Dry run — pass --write to apply');
    process.exit(0);
  }

  questionsDoc.questions = questions;
  ratesDoc.entries = entries;
  fs.writeFileSync(
    path.join(REPO_ROOT, 'src/data/sourceMeasurementQuestions.json'),
    `${JSON.stringify(questionsDoc, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(REPO_ROOT, 'src/data/originalSizingRates.json'),
    `${JSON.stringify(ratesDoc, null, 2)}\n`,
  );
  console.log('Written measurement + originalSizingRates alignment');
}

main();
