#!/usr/bin/env node
/**
 * Generate source verification sign-off sheet (markdown) in reference docs folder.
 * Usage: node scripts/generateSourceVerificationSheet.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  catalogById,
  getReferenceDocsDir,
  loadSourcesJson,
} from './lib/catalogUtils.mjs';

function main() {
  const origDoc = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src/data/originalSizingRates.json'), 'utf8'),
  );
  const questions = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src/data/sourceMeasurementQuestions.json'), 'utf8'),
  ).questions;
  const catalog = catalogById(loadSourcesJson());

  const ordered = Object.entries(origDoc.entries).sort((a, b) =>
    String(a[1].sheetLabel).localeCompare(String(b[1].sheetLabel)),
  );

  const lines = [
    '# Source verification sign-off sheet',
    '',
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    '',
    'Review each row and mark **OK** or note changes. Rates are GB/day per unit from ORIGINAL Sizing Calculator.',
    '',
    '| # | ID | Name | Rate | Unit | Primary field | Question | customerSummary | Status |',
    '|---|-----|------|------|------|---------------|----------|-----------------|--------|',
  ];

  ordered.forEach(([id, o], idx) => {
    const source = catalog.get(id) || {};
    const q = questions[id] || {};
    const rateOk =
      source.sizingRate == null
      || Math.abs(Number(source.sizingRate) - Number(o.rateGbPerUnit)) < 1e-9;
    const status = rateOk ? 'OK' : `FIX (${source.sizingRate})`;
    const summary = String(source.customerSummary || '').replace(/\|/g, '/').slice(0, 80);
    const question = String(q.question || '').replace(/\|/g, '/').slice(0, 70);
    lines.push(
      `| ${idx + 1} | \`${id}\` | ${String(o.sheetLabel).replace(/\|/g, '/').slice(0, 40)} | ${o.rateGbPerUnit} | ${o.unitLabel} | \`${q.primaryInputField || o.primaryInputField}\` | ${question} | ${summary} | ${status} |`,
    );
  });

  lines.push('');
  lines.push('**Extra catalog source (not in workbook):** `uba` — review separately.');
  lines.push('');

  const outPath = path.join(getReferenceDocsDir(), 'source-verification-signoff.md');
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
  console.log(`Wrote ${outPath} (${ordered.length} sources)`);
}

main();
