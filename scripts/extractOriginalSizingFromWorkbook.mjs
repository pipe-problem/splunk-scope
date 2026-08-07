#!/usr/bin/env node
/**
 * Extract canonical sizing rates from ORIGINAL Sizing Calculator.xlsx (external path).
 * Does not copy the workbook into the repo — pass absolute path as CLI argument.
 *
 * Usage: node scripts/extractOriginalSizingFromWorkbook.mjs "/path/to/ORIGINAL Sizing Calculator.xlsx" [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';
import { REPO_ROOT, loadSourcesJson, catalogById } from './lib/catalogUtils.mjs';

const SHEET_NAME = 'DSA (with Calculations)';
const OUT_PATH = path.join(REPO_ROOT, 'src/data/originalSizingRates.json');

/** Row number (1-based) → catalog source id (from existing canonical map). */
const ROW_TO_SOURCE_ID = {
  7: 'iaas',
  8: 'iaas_containers',
  9: 'iaas_instances',
  10: 'iaas_storage',
  11: 'paas',
  12: 'saas_general',
  13: 'saas_office',
  14: 'saas_crm',
  15: 'saas_sso',
  16: 'saas_conferencing',
  17: 'saas_filesharing',
  18: 'cspm',
  19: 'cwpp',
  20: 'casb',
  21: 'sase',
  26: 'windows_servers',
  32: 'linux_servers',
  33: 'mainframe',
  34: 'linux_servers_nonprod',
  35: 'hypervisor',
  40: 'database',
  41: 'db_transaction',
  42: 'db_access',
  47: 'web_servers',
  48: 'app_servers',
  49: 'middleware',
  50: 'business_txn',
  52: 'apm',
  54: 'pki',
  55: 'sap',
  60: 'desktops',
  61: 'sso_pam',
  62: 'active_directory',
  63: 'email',
  69: 'mdm',
  74: 'vuln_mgmt',
  76: 'netflow',
  77: 'ids_ips',
  78: 'threat_intel',
  79: 'sandbox',
  82: 'dlp',
  83: 'edr',
  84: 'ndr',
  85: 'deception',
  90: 'web_servers_nonprod',
  91: 'app_servers_nonprod',
  92: 'middleware_nonprod',
  94: 'config_mgmt',
  95: 'devops_cicd',
  100: 'switches',
  101: 'routers',
  102: 'firewalls',
  103: 'fw_perimeter',
  104: 'fw_internal',
  105: 'fw_waf',
  106: 'ddos',
  107: 'vpn',
  108: 'proxy',
  109: 'nac',
  110: 'wireless',
  112: 'dns',
  114: 'dpi',
  115: 'dhcp',
  116: 'loadbalancer',
  121: 'storage_prod',
  130: 'ics_scada',
  134: 'asset_cmdb',
  135: 'ot_security',
};

/** Per-item sources where column C is blank — count platforms/appliances, not users. */
const PER_ITEM_PRIMARY_FIELD = new Set(['sso_pam', 'vpn', 'email']);

/** Catalog primary fields that must not be replaced by generic column-C hints. */
const PRIMARY_FIELD_OVERRIDES = {
  cspm: 'number_of_accounts',
  cwpp: 'number_of_instances',
  saas_conferencing: 'count',
  saas_filesharing: 'count',
  db_access: 'count',
  db_transaction: 'count',
  fw_perimeter: 'count',
  fw_internal: 'count',
  fw_waf: 'count',
  active_directory: 'number_of_dcs',
  edr: 'number_of_endpoints',
  netflow: 'number_of_devices',
  nac: 'number_of_devices',
  mdm: 'number_of_devices',
  iaas: 'iaasAccountCount',
  iaas_containers: 'containerCounts.clusters',
  iaas_instances: 'cloudVmInstanceCount',
  iaas_storage: 'cloudStorageAssetCount',
  saas_office: 'officeActiveUserCount',
  saas_crm: 'crmActiveUserCount',
  saas_sso: 'ssoActiveUserCount',
  devops_cicd: 'number_of_pipelines',
  threat_intel: 'number_of_feeds',
  ndr: 'number_of_sensors',
  vuln_mgmt: 'number_of_assets',
  asset_cmdb: 'number_of_assets',
};

/** Column C hint → primary input field. */
function primaryFieldFromHint(sourceId, columnC, unitText, catalogEntry) {
  if (PRIMARY_FIELD_OVERRIDES[sourceId]) {
    return PRIMARY_FIELD_OVERRIDES[sourceId];
  }
  if (PER_ITEM_PRIMARY_FIELD.has(sourceId)) {
    return 'number_of_systems';
  }
  const hint = String(columnC || '').toLowerCase();
  if (hint.includes('endpoint')) return 'number_of_endpoints';
  if (hint.includes('user')) {
    if (sourceId === 'saas_sso') return 'ssoActiveUserCount';
    if (sourceId === 'saas_office') return 'officeActiveUserCount';
    if (sourceId === 'saas_crm') return 'crmActiveUserCount';
    return 'number_of_users';
  }

  const formula = catalogEntry?.sizing_formula?.primary_input;
  if (formula) return String(formula);

  const unit = String(unitText || '').toLowerCase();
  if (unit.includes('per user')) return 'number_of_users';
  if (unit.includes('per endpoint')) return 'number_of_endpoints';
  return 'number_of_systems';
}

function unitLabelFromRate(sourceId, unitText, catalogEntry, existing) {
  if (existing?.unitLabel) return existing.unitLabel;
  const unit = String(unitText || '').toLowerCase();
  if (unit.includes('per user')) return 'active users';
  if (unit.includes('per endpoint')) return 'endpoints covered';
  if (unit.includes('per item')) {
    return String(catalogEntry?.configuredItemLabel || 'configured items')
      .replace(/^#\s*of\s+/i, '')
      .replace(/\([^)]*\)/g, '')
      .trim()
      .toLowerCase() || 'configured items';
  }
  return 'configured items';
}

function cell(ws, row, col) {
  const ref = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  return ws[ref]?.v;
}

function main() {
  const workbookPath = process.argv[2];
  const write = process.argv.includes('--write');
  if (!workbookPath) {
    console.error('Usage: node scripts/extractOriginalSizingFromWorkbook.mjs "/path/to/ORIGINAL Sizing Calculator.xlsx" [--write]');
    process.exit(1);
  }
  if (!fs.existsSync(workbookPath)) {
    console.error(`Workbook not found: ${workbookPath}`);
    process.exit(1);
  }

  const existingDoc = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
  const catalog = catalogById(loadSourcesJson());

  const wb = XLSX.readFile(workbookPath, { cellDates: true });
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    console.error(`Sheet not found: ${SHEET_NAME}`);
    process.exit(1);
  }

  const entries = { ...existingDoc.entries };
  let updated = 0;

  for (const [rowStr, sourceId] of Object.entries(ROW_TO_SOURCE_ID)) {
    const row = Number(rowStr);
    const rate = cell(ws, row, 4);
    if (typeof rate !== 'number' || rate < 0) continue;

    const label = String(cell(ws, row, 1) || '').trim();
    const columnC = cell(ws, row, 3);
    const unitText = cell(ws, row, 5);
    const notes = cell(ws, row, 7);
    const catalogEntry = catalog.get(sourceId);
    const prev = entries[sourceId] || {};

    const primaryInputField = primaryFieldFromHint(sourceId, columnC, unitText, catalogEntry);
    const unitLabel = unitLabelFromRate(sourceId, unitText, catalogEntry, prev);

    const next = {
      sourceId,
      primaryInputField,
      unitLabel,
      rateGbPerUnit: rate,
      lowMultiplier: prev.lowMultiplier ?? existingDoc.lowMultiplierDefault ?? 0.8,
      highMultiplier: prev.highMultiplier ?? existingDoc.highMultiplierDefault ?? 1.2,
      notes: notes != null ? String(notes) : prev.notes || '',
      sheetRowRef: `${SHEET_NAME}!A${row}`,
      sheetLabel: label || prev.sheetLabel || sourceId,
    };

    if (sourceId === 'windows_servers' && prev.optionalSecondaryInputs) {
      next.optionalSecondaryInputs = prev.optionalSecondaryInputs;
    }
    if (sourceId === 'storage_prod' && prev.optionalSecondaryInputs) {
      next.optionalSecondaryInputs = prev.optionalSecondaryInputs;
    }

    const changed = JSON.stringify(prev) !== JSON.stringify(next);
    if (changed) updated += 1;
    entries[sourceId] = next;
  }

  const out = {
    schemaVersion: existingDoc.schemaVersion || '1.0',
    sourceWorkbook: path.basename(workbookPath),
    sourceSheet: SHEET_NAME,
    lastExtracted: new Date().toISOString().slice(0, 10),
    lowMultiplierDefault: existingDoc.lowMultiplierDefault ?? 0.8,
    highMultiplierDefault: existingDoc.highMultiplierDefault ?? 1.2,
    entryCount: Object.keys(entries).length,
    entries,
  };

  console.log(`Extracted ${Object.keys(ROW_TO_SOURCE_ID).length} rows; ${updated} entries changed`);
  for (const id of ['sso_pam', 'vpn', 'email', 'saas_sso']) {
    const e = entries[id];
    console.log(`${id}: rate=${e.rateGbPerUnit} primary=${e.primaryInputField} unit=${e.unitLabel}`);
  }

  if (write) {
    fs.writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`Wrote ${OUT_PATH}`);
  } else {
    console.log('Dry run — pass --write to apply');
  }
}

main();
