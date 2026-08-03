/**
 * Shared helpers for source catalog flattening and lookup.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.join(__dirname, '..', '..')
export const SOURCES_PATH = path.join(REPO_ROOT, 'src', 'data', 'sources.json')

/** Local-only artifacts live in ../splunk-scope-reference (override with REFERENCE_ROOT). */
export function getReferenceRoot() {
  return process.env.REFERENCE_ROOT
    ? path.resolve(process.env.REFERENCE_ROOT)
    : path.join(REPO_ROOT, '..', 'splunk-scope-reference')
}

export function getReferenceDocsArchiveDir() {
  const dir = path.join(getReferenceRoot(), 'docs', 'archive')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getReferenceDocsDir() {
  const dir = path.join(getReferenceRoot(), 'docs')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getReferenceScreenshotsDir() {
  const dir = path.join(getReferenceRoot(), 'docs', 'screenshots')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** @returns {import('node:fs').PathLike} */
export function loadSourcesJson() {
  return JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8'))
}

/**
 * @param {Array<Record<string, unknown>>} nodes
 * @param {Record<string, unknown>} [inherited]
 */
export function flattenCatalog(nodes, inherited = {}) {
  const flat = []
  for (const node of nodes) {
    const merged = { ...node }
    if (inherited.category && !merged.category) merged.category = inherited.category
    flat.push(merged)
    if (Array.isArray(node.children) && node.children.length) {
      flat.push(...flattenCatalog(node.children, { category: merged.category }))
    }
  }
  return flat
}

/** @param {Array<Record<string, unknown>>} sources */
export function catalogById(sources) {
  const map = new Map()
  for (const entry of flattenCatalog(sources)) {
    map.set(entry.id, entry)
  }
  return map
}

/**
 * Plain-English unit label from catalog configuredItemLabel or sizing unit hint.
 * @param {Record<string, unknown> | undefined} catalogEntry
 * @param {string} [sheetUnitHint]
 */
export function deriveUnitLabel(catalogEntry, sheetUnitHint = '') {
  const hint = sheetUnitHint.toLowerCase()
  if (hint.includes('per user')) return 'active users'
  if (hint.includes('per endpoint')) return 'managed endpoints'

  const label = String(catalogEntry?.configuredItemLabel || '')
  const cleaned = label
    .replace(/^#\s*of\s+/i, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .toLowerCase()

  if (cleaned) return cleaned
  return 'configured items'
}

/**
 * @param {string | null | undefined} columnCHint
 * @param {Record<string, unknown> | undefined} catalogEntry
 */
export function derivePrimaryInputField(columnCHint, catalogEntry) {
  const hint = String(columnCHint || '').toLowerCase()
  if (hint.includes('user')) return 'number_of_users'
  if (hint.includes('endpoint')) return 'number_of_endpoints'

  const formula = catalogEntry?.sizing_formula
  if (formula && typeof formula === 'object' && formula.primary_input) {
    return String(formula.primary_input)
  }
  return 'number_of_systems'
}
