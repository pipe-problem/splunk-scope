#!/usr/bin/env node
/**
 * Validates originalSizingRates.json against sources.json and prints an audit table.
 *
 * Usage: node scripts/validate-original-rates.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { REPO_ROOT, catalogById, loadSourcesJson } from './lib/catalogUtils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const EXAMPLE_QTY_OVERRIDES = {
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
}

function loadQuestions() {
  const p = path.join(REPO_ROOT, 'src', 'data', 'sourceMeasurementQuestions.json')
  if (!fs.existsSync(p)) return {}
  const data = JSON.parse(fs.readFileSync(p, 'utf8'))
  return data.questions || {}
}

function exampleQty(entry, questions) {
  if (EXAMPLE_QTY_OVERRIDES[entry.sourceId] != null) {
    return EXAMPLE_QTY_OVERRIDES[entry.sourceId]
  }
  const q = questions[entry.sourceId]
  if (q?.exampleQuantity != null) return q.exampleQuantity
  return 10
}

function main() {
  const ratesPath = path.join(REPO_ROOT, 'src', 'data', 'originalSizingRates.json')
  if (!fs.existsSync(ratesPath)) {
    console.error('Missing originalSizingRates.json — run scripts/extract-original-sizing-rates.mjs first')
    process.exit(1)
  }

  const ratesDoc = JSON.parse(fs.readFileSync(ratesPath, 'utf8'))
  const entries = Object.values(ratesDoc.entries || {})
  const catalog = catalogById(loadSourcesJson())
  const questions = loadQuestions()

  const errors = []
  const seen = new Set()

  for (const entry of entries) {
    if (!entry.sourceId) {
      errors.push('Entry missing sourceId')
      continue
    }
    if (seen.has(entry.sourceId)) {
      errors.push(`Duplicate sourceId: ${entry.sourceId}`)
    }
    seen.add(entry.sourceId)

    if (!catalog.has(entry.sourceId)) {
      errors.push(`sourceId not in catalog: ${entry.sourceId}`)
    }
    if (!Number.isFinite(entry.rateGbPerUnit)) {
      errors.push(`${entry.sourceId}: rateGbPerUnit is not numeric`)
    }
  }

  if (errors.length) {
    console.error('Validation FAILED:\n')
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  const sorted = [...entries].sort((a, b) => a.sourceId.localeCompare(b.sourceId))

  console.log('Validation PASSED')
  console.log(`  entries: ${sorted.length}`)
  console.log(`  workbook: ${ratesDoc.sourceWorkbook}`)
  console.log('')
  console.log('| Source | Unit | Rate (GB/day per unit) | Example qty | Expected GB/day |')
  console.log('|--------|------|------------------------|-------------|-----------------|')

  for (const entry of sorted) {
    const qty = exampleQty(entry, questions)
    const expected = (entry.rateGbPerUnit * qty).toFixed(3)
    const name = catalog.get(entry.sourceId)?.name || entry.sourceId
    console.log(
      `| ${entry.sourceId} (${name}) | ${entry.unitLabel} | ${entry.rateGbPerUnit} | ${qty} | ${expected} |`,
    )
  }

  process.exit(0)
}

main()
