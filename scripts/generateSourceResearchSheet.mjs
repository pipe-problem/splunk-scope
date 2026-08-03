#!/usr/bin/env node
/**
 * Generates source-sizing-research-template.xlsx in ../splunk-scope-reference/docs/
 * Fill in researched values and return the sheet to update sizingRates.json.
 *
 * Usage: node scripts/generateSourceResearchSheet.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { getReferenceDocsDir } from './lib/catalogUtils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function flattenCatalog(nodes, inherited = {}) {
  const flat = [];
  for (const node of nodes) {
    const merged = { ...node };
    if (inherited.category && !merged.category) merged.category = inherited.category;
    flat.push(merged);
    if (node.children?.length) {
      flat.push(...flattenCatalog(node.children, { category: merged.category }));
    }
  }
  return flat;
}

const sources = JSON.parse(fs.readFileSync(path.join(root, 'src/data/sources.json'), 'utf8'));
const sizingRates = JSON.parse(fs.readFileSync(path.join(root, 'src/data/sizingRates.json'), 'utf8'));
const flat = flattenCatalog(sources);
const rates = sizingRates.rates || {};

const RATE_ALIASES = {
  firewalls: 'firewall_logs',
  edr: 'edr_logs',
  active_directory: 'active_directory_security',
};

const rows = flat.map((s) => {
  const rateKey = RATE_ALIASES[s.id] || s.id;
  const rate = rates[rateKey] || rates[s.id] || {};
  const vendors = (s.exampleVendors || []).join('; ');
  const splunkApps = [...(s.splunkApps || []), ...(s.technicalAddons || [])].join('; ');
  return {
    source_id: s.id,
    source_name: s.name,
    category: s.category || '',
    subcategory: s.subcategory || '',
    example_vendors: vendors,
    splunk_apps_and_tas: splunkApps,
    sizing_unit: rate.unit || s.sizingRate?.unit || '',
    current_low_gb_per_unit: rate.low ?? s.sizingRateLow ?? '',
    current_medium_gb_per_unit: rate.medium ?? rate.baseRate ?? s.sizingRate ?? '',
    current_high_gb_per_unit: rate.high ?? s.sizingRateHigh ?? '',
    researched_low_gb_per_unit: '',
    researched_medium_gb_per_unit: '',
    researched_high_gb_per_unit: '',
    research_source_url: '',
    research_notes: '',
    confidence_after_research: '',
    needs_review: rate.needsReview ? 'yes' : '',
  };
});

const ws = XLSX.utils.json_to_sheet(rows);
ws['!cols'] = [
  { wch: 28 },
  { wch: 36 },
  { wch: 18 },
  { wch: 14 },
  { wch: 40 },
  { wch: 48 },
  { wch: 14 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch: 50 },
  { wch: 40 },
  { wch: 12 },
  { wch: 10 },
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'SourceSizingResearch');

const instructions = [
  { step: 1, action: 'Research each source using vendor docs, Splunk Lantern, TA documentation, and customer PoV data.' },
  { step: 2, action: 'Fill researched_low / researched_medium / researched_high (GB per sizing_unit per day).' },
  { step: 3, action: 'Add research_source_url (vendor doc, Splunk doc, or internal benchmark).' },
  { step: 4, action: 'Set confidence_after_research: high | medium | low.' },
  { step: 5, action: 'Return this file — values in researched_* columns become the basis for sizingRates.json updates.' },
];
const ws2 = XLSX.utils.json_to_sheet(instructions);
XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

const outPath = path.join(getReferenceDocsDir(), 'source-sizing-research-template.xlsx');
XLSX.writeFile(wb, outPath);

console.log(`Wrote ${rows.length} sources to ${outPath}`);
