#!/usr/bin/env node
/**
 * Validate Cursor import JSON using the same processor as the app.
 * Usage: node scripts/validate-import-json.mjs [path-to-json]
 * Reads stdin when no file path is given.
 */
import fs from 'node:fs';
import process from 'node:process';
import { loadAppModule } from './lib/viteModuleLoader.mjs';

async function readInput(pathArg) {
  if (pathArg) {
    return fs.readFileSync(pathArg, 'utf8');
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function printResult(result) {
  if (!result.parsed) {
    console.error('FAIL: could not parse import JSON');
    if (result.parseError) console.error(`  ${result.parseError}`);
    process.exitCode = 1;
    return;
  }

  console.log(`OK: parsed (${result.source}, confidence=${result.confidence})`);
  const fields = result.fields || {};
  if (fields.customerName) console.log(`  customer: ${fields.customerName}`);
  if (fields.deploymentType && fields.deploymentType !== 'unknown') {
    console.log(`  deployment: ${fields.deploymentType}`);
  }

  const candidates = fields.sourceCandidates || [];
  const applyEligible = candidates.filter((c) => c.applyEligible);
  console.log(`  source candidates: ${candidates.length} (${applyEligible.length} apply-eligible)`);
  for (const c of candidates) {
    const flag = c.applyEligible ? 'APPLY' : 'skip';
    const count = c.primaryCount != null ? ` count=${c.primaryCount}` : '';
    console.log(`    [${flag}] ${c.sourceId} (${c.confidence})${count}${c.skipReason ? ` — ${c.skipReason}` : ''}`);
  }

  const hints = fields.sourceHints || [];
  if (hints.length) {
    console.log(`  source hints (not auto-applied): ${hints.length}`);
    for (const h of hints.slice(0, 10)) {
      console.log(`    - ${[h.sourceName, h.sourceId, h.skipReason].filter(Boolean).join(' · ')}`);
    }
    if (hints.length > 10) console.log(`    … and ${hints.length - 10} more`);
  }

  if (fields.aiImportSummary?.useCaseAssessment) {
    console.log('  aiSummary.useCaseAssessment: present');
  }

  if (result.warnings?.length) {
    console.log(`  warnings (${result.warnings.length}):`);
    for (const w of result.warnings) console.log(`    - ${w}`);
  }
  if (result.needsReview?.length) {
    console.log(`  needs review (${result.needsReview.length}):`);
    for (const w of result.needsReview) console.log(`    - ${w}`);
  }
}

const { processImportResponse } = await loadAppModule('src/services/circuitResponseProcessor.js');
const pathArg = process.argv[2];
const text = await readInput(pathArg);
const result = processImportResponse(text);
printResult(result);
