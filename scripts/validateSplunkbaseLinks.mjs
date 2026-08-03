#!/usr/bin/env node
/**
 * Validates Splunkbase URL fields in splunkApps.json and technicalAddons.json.
 * Entries without splunkbaseId are flagged; malformed IDs fail validation.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const SPLUNKBASE_RE = /^\d{3,6}$/;

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

let errors = 0;
let warnings = 0;
const needsReview = [];

function checkEntry(entry, file, kind) {
  const id = entry.splunkbaseId;
  if (!id) {
    if (entry.needsReview) {
      needsReview.push({ file, name: entry.name, reason: 'needsReview flag set' });
      warnings++;
      return;
    }
    warnings++;
    needsReview.push({ file, name: entry.name, reason: 'missing splunkbaseId' });
    return;
  }
  const sid = String(id).trim();
  if (!SPLUNKBASE_RE.test(sid)) {
    console.error(`FAIL ${file} ${entry.name}: invalid splunkbaseId "${id}"`);
    errors++;
    return;
  }
  const url = `https://splunkbase.splunk.com/app/${sid}`;
  if (!url.startsWith('https://splunkbase.splunk.com/app/')) {
    console.error(`FAIL ${file} ${entry.name}: malformed URL derived from id`);
    errors++;
  }
}

const splunkApps = loadJson('src/data/splunkApps.json');
for (const cat of splunkApps) {
  for (const app of cat.apps || []) {
    checkEntry(app, 'splunkApps.json', 'app');
  }
}

const technicalAddons = loadJson('src/data/technicalAddons.json');
for (const ta of technicalAddons.addons || []) {
  checkEntry(ta, 'technicalAddons.json', 'ta');
}

console.log(`Splunkbase link audit: ${errors} error(s), ${warnings} warning(s)`);
if (needsReview.length) {
  console.log('Needs review (no verified Splunkbase ID):');
  for (const n of needsReview.slice(0, 20)) {
    console.log(`  - ${n.name} (${n.file}): ${n.reason}`);
  }
  if (needsReview.length > 20) console.log(`  … and ${needsReview.length - 20} more`);
}

process.exit(errors > 0 ? 1 : 0);
