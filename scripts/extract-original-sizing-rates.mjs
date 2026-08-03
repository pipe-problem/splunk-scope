#!/usr/bin/env node
/**
 * One-time extractor: ORIGINAL Sizing Calculator.xlsx → originalSizingRates.json
 * and sourceMeasurementQuestions.json (aligned to sheet counting units).
 *
 * Usage: node scripts/extract-original-sizing-rates.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import {
  REPO_ROOT,
  catalogById,
  derivePrimaryInputField,
  deriveUnitLabel,
  loadSourcesJson,
} from './lib/catalogUtils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEFAULT_XLSX = '/Users/msaxby/Documents/sizing/ORIGINAL Sizing Calculator.xlsx'
const SHEET_NAME = 'DSA (with Calculations)'
const LOW_MULTIPLIER = 0.8
const HIGH_MULTIPLIER = 1.2

/** Row → catalog sourceId (authoritative audit map). */
const ROW_SOURCE_MAP = {
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
  135: 'ot_security',
  134: 'asset_cmdb',
}

/** Windows log-channel rows → optional secondary inputs on windows_servers. */
const WINDOWS_SECONDARY_ROWS = {
  27: { field: 'windows_application_log_servers', label: 'Windows servers (Application log)' },
  28: { field: 'windows_security_log_servers', label: 'Windows servers (Security log)' },
  29: { field: 'windows_system_log_servers', label: 'Windows servers (System log)' },
  30: { field: 'windows_setup_log_servers', label: 'Windows servers (Setup log)' },
  31: { field: 'windows_performance_log_servers', label: 'Windows servers (Performance log)' },
}

/** Storage variant rows → optional secondary inputs on storage_prod. */
const STORAGE_SECONDARY_ROWS = {
  122: { field: 'storage_moderate_iops_arrays', label: 'production storage arrays (moderate/low IOPS)' },
  123: { field: 'storage_san_switches', label: 'production SAN switches' },
  124: { field: 'storage_nonprod_arrays', label: 'non-production storage arrays' },
  125: { field: 'storage_backup_tape', label: 'backup tape systems' },
}

/** Example quantities for validation / workshop defaults. */
const EXAMPLE_QUANTITIES = {
  firewalls: 12,
  active_directory: 4,
  edr: 5000,
  saas_office: 2500,
  saas_sso: 2500,
  windows_servers: 120,
  iaas: 3,
  iaas_instances: 400,
  iaas_storage: 25,
  dns: 8,
  number_of_users: 2500,
  number_of_endpoints: 5000,
  number_of_systems: 10,
}

function sheetRowRef(rowNum) {
  return `${SHEET_NAME}!A${rowNum}`
}

function readWorkbookRows(xlsxPath) {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`Workbook not found: ${xlsxPath}`)
  }
  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const sheet = wb.Sheets[SHEET_NAME]
  if (!sheet) {
    throw new Error(`Sheet not found: ${SHEET_NAME}`)
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
  return rows
}

function parseRow(rows, rowNum) {
  const idx = rowNum - 1
  const row = rows[idx] || []
  return {
    rowNum,
    label: row[0] != null ? String(row[0]).trim() : '',
    inputHint: row[2] != null ? String(row[2]).trim() : null,
    rateGbPerUnit: typeof row[3] === 'number' ? row[3] : Number(row[3]),
    unitHint: row[4] != null ? String(row[4]).trim() : '',
    exampleVendors: row[6] != null ? String(row[6]).trim() : '',
    mitreId: row[7] != null ? String(row[7]).trim() : '',
    notes: row[8] != null ? String(row[8]).trim() : '',
  }
}

function buildSecondaryInput(rows, rowNum, meta) {
  const parsed = parseRow(rows, rowNum)
  if (!Number.isFinite(parsed.rateGbPerUnit)) return null
  return {
    field: meta.field,
    unitLabel: meta.label,
    rateGbPerUnit: parsed.rateGbPerUnit,
    sheetRowRef: sheetRowRef(rowNum),
  }
}

function buildEntry(rows, rowNum, sourceId, catalog) {
  const parsed = parseRow(rows, rowNum)
  if (!Number.isFinite(parsed.rateGbPerUnit)) {
    throw new Error(`Row ${rowNum} (${sourceId}): missing numeric rate in column D`)
  }

  const catalogEntry = catalog.get(sourceId)
  if (!catalogEntry) {
    throw new Error(`Row ${rowNum}: sourceId "${sourceId}" not in sources.json catalog`)
  }

  const noteParts = []
  if (parsed.notes) noteParts.push(parsed.notes.replace(/\r\n/g, '\n'))
  if (parsed.exampleVendors) noteParts.push(`Example vendors: ${parsed.exampleVendors}`)
  if (parsed.mitreId) noteParts.push(`MITRE ATT&CK: ${parsed.mitreId}`)

  return {
    sourceId,
    primaryInputField: derivePrimaryInputField(parsed.inputHint, catalogEntry),
    unitLabel: deriveUnitLabel(catalogEntry, parsed.unitHint),
    rateGbPerUnit: parsed.rateGbPerUnit,
    lowMultiplier: LOW_MULTIPLIER,
    highMultiplier: HIGH_MULTIPLIER,
    optionalSecondaryInputs: [],
    notes: noteParts.join(' | ') || undefined,
    sheetRowRef: sheetRowRef(rowNum),
    sheetLabel: parsed.label,
  }
}

function loadCountingQuestions() {
  const p = path.join(REPO_ROOT, 'src', 'data', 'sourceCountingMethods.json')
  const data = JSON.parse(fs.readFileSync(p, 'utf8'))
  return data.methods || {}
}

function buildMeasurementQuestions(entries, catalog) {
  const counting = loadCountingQuestions()
  const questions = {}

  for (const entry of Object.values(entries)) {
    const catalogEntry = catalog.get(entry.sourceId)
    const countingEntry = counting[entry.sourceId]
    const primaryField = entry.primaryInputField

    let question =
      countingEntry?.customerQuestion ||
      `How many ${entry.unitLabel} will send logs to Splunk for ${catalogEntry?.name || entry.sourceId}?`

    if (entry.sourceId === 'windows_servers') {
      question =
        countingEntry?.customerQuestion ||
        'How many Windows servers (physical and virtual) will centralize event logs?'
    }

    const exampleKey = EXAMPLE_QUANTITIES[entry.sourceId] != null
      ? entry.sourceId
      : primaryField
    const exampleQuantity = EXAMPLE_QUANTITIES[exampleKey] ?? 10

    questions[entry.sourceId] = {
      sourceId: entry.sourceId,
      question,
      primaryInputField: primaryField,
      unitLabel: entry.unitLabel,
      exampleQuantity,
      helperText: countingEntry?.howToCount || undefined,
    }
  }

  return {
    schemaVersion: '1.0',
    sourceWorkbook: path.basename(process.env.ORIGINAL_SIZING_XLSX || DEFAULT_XLSX),
    sourceSheet: SHEET_NAME,
    lastUpdated: new Date().toISOString().slice(0, 10),
    questions,
  }
}

function main() {
  const xlsxPath = process.env.ORIGINAL_SIZING_XLSX || DEFAULT_XLSX
  const rows = readWorkbookRows(xlsxPath)
  const sources = loadSourcesJson()
  const catalog = catalogById(sources)

  /** @type {Record<string, ReturnType<typeof buildEntry>>} */
  const entries = {}

  for (const [rowStr, sourceId] of Object.entries(ROW_SOURCE_MAP)) {
    const rowNum = Number(rowStr)
    if (entries[sourceId]) {
      throw new Error(`Duplicate sourceId mapping: ${sourceId}`)
    }
    entries[sourceId] = buildEntry(rows, rowNum, sourceId, catalog)
  }

  for (const [rowStr, meta] of Object.entries(WINDOWS_SECONDARY_ROWS)) {
    const secondary = buildSecondaryInput(rows, Number(rowStr), meta)
    if (secondary) entries.windows_servers.optionalSecondaryInputs.push(secondary)
  }

  for (const [rowStr, meta] of Object.entries(STORAGE_SECONDARY_ROWS)) {
    const secondary = buildSecondaryInput(rows, Number(rowStr), meta)
    if (secondary) entries.storage_prod.optionalSecondaryInputs.push(secondary)
  }

  for (const entry of Object.values(entries)) {
    if (entry.optionalSecondaryInputs.length === 0) {
      delete entry.optionalSecondaryInputs
    }
  }

  const output = {
    schemaVersion: '1.0',
    sourceWorkbook: path.basename(xlsxPath),
    sourceSheet: SHEET_NAME,
    lastExtracted: new Date().toISOString().slice(0, 10),
    lowMultiplierDefault: LOW_MULTIPLIER,
    highMultiplierDefault: HIGH_MULTIPLIER,
    entryCount: Object.keys(entries).length,
    entries,
  }

  const ratesPath = path.join(REPO_ROOT, 'src', 'data', 'originalSizingRates.json')
  const questionsPath = path.join(REPO_ROOT, 'src', 'data', 'sourceMeasurementQuestions.json')

  fs.writeFileSync(ratesPath, `${JSON.stringify(output, null, 2)}\n`)
  fs.writeFileSync(
    questionsPath,
    `${JSON.stringify(buildMeasurementQuestions(entries, catalog), null, 2)}\n`,
  )

  console.log(`Wrote ${Object.keys(entries).length} entries → ${path.relative(REPO_ROOT, ratesPath)}`)
  console.log(`Wrote measurement questions → ${path.relative(REPO_ROOT, questionsPath)}`)
}

main()
