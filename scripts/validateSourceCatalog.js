#!/usr/bin/env node
/**
 * Validates every source ID in src/data/sources.json against satellite catalogs
 * (sizing rates, counting methods, use-case mappings, log capabilities, vendor
 * multipliers, research notes) and writes docs/archive/catalog-validation-report.{md,json}.
 *
 * Usage: node scripts/validateSourceCatalog.js
 * Exit 1 if any catalog source is missing a sizing rate or counting method; else 0.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'src', 'data')
const DOCS = path.join(ROOT, 'docs', 'archive')

const RATE_ALIASES = {
  firewalls: 'firewall_logs',
  edr: 'edr_logs',
  active_directory: 'active_directory_security',
  vpn: 'vpn_logs',
  proxy: 'proxy_web_gateway',
  dns: 'dns_logs',
  netflow: 'netflow_data',
  vuln_mgmt: 'vulnerability_scanner',
  saas_office: 'm365_audit_logs',
  saas_sso: 'okta_sso',
}

const LEGACY_BY_CANON = Object.fromEntries(
  Object.entries(RATE_ALIASES).map(([legacy, canon]) => [canon, legacy]),
)

function orderedKeyCandidates(id) {
  const out = []
  const add = (k) => {
    if (k != null && !out.includes(k)) out.push(k)
  }
  add(id)
  add(RATE_ALIASES[id])
  add(LEGACY_BY_CANON[id])
  for (const [legacy, canon] of Object.entries(RATE_ALIASES)) {
    if (canon === id) add(legacy)
  }
  return out
}

function resolveRecordKey(record, id) {
  for (const k of orderedKeyCandidates(id)) {
    if (Object.prototype.hasOwnProperty.call(record, k)) return k
  }
  return null
}

function resolveWithAncestors(record, id, parentById) {
  const seen = new Set()
  let cur = id
  while (cur != null && !seen.has(cur)) {
    seen.add(cur)
    const hit = resolveRecordKey(record, cur)
    if (hit) return { key: hit, matchedId: cur }
    cur = parentById.get(cur) ?? null
  }
  return null
}

/**
 * @param {object} node
 * @param {{ inheritedCategory: string | null, parentId: string | null, isChild: boolean }} ctx
 * @param {Array<object>} out
 */
function walkSourceTree(node, ctx, out) {
  const category = node.category ?? ctx.inheritedCategory
  out.push({
    id: node.id,
    name: node.name ?? null,
    category,
    parentId: ctx.parentId,
    isChild: ctx.isChild,
    isLogOption: false,
  })
  const nextCtx = {
    inheritedCategory: category,
    parentId: node.id,
    isChild: true,
  }
  for (const child of node.children ?? []) {
    walkSourceTree(child, nextCtx, out)
  }
  for (const lo of node.log_options ?? []) {
    out.push({
      id: lo.id,
      name: lo.name ?? null,
      category,
      parentId: node.id,
      isChild: true,
      isLogOption: true,
    })
  }
}

function flattenSourcesCatalog(sourcesJson) {
  const out = []
  for (const root of sourcesJson) {
    walkSourceTree(root, {
      inheritedCategory: null,
      parentId: null,
      isChild: false,
    }, out)
  }
  return out
}

function loadJson(fileName) {
  const p = path.join(DATA, fileName)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function explainExtraRateKeys(extraKeys, aliasCanonValues) {
  const fromAliasCanon = extraKeys.filter((k) => aliasCanonValues.has(k))
  const remainder = extraKeys.filter((k) => !aliasCanonValues.has(k))
  return {
    fromAliasCanon,
    additionalGranular: remainder,
    note:
      'Keys in sizingRates.json that are not top-level rows in sources.json include: '
      + '(1) canonical rate IDs paired with legacy catalog IDs via RATE_ALIASES, '
      + '(2) channel- or platform-specific rates (e.g. windows_security_event_log, kubernetes_logs) '
      + 'used when additive or alternate sizing paths are documented in sizingRates.',
  }
}

function markdownCellMark(ok) {
  if (ok === true) return '✓'
  if (ok === false) return '✗'
  return '—'
}

function main() {
  const sourcesJson = loadJson('sources.json')
  const sizingRatesDoc = loadJson('sizingRates.json')
  const countingDoc = loadJson('sourceCountingMethods.json')
  const useCaseDoc = loadJson('sourceUseCaseMappings.json')
  const logCapDoc = loadJson('sourceLogCapabilities.json')
  const researchDoc = loadJson('sizingResearchNotes.json')
  const vendorModelDoc = loadJson('vendorModelRates.json')
  const technicalAddons = loadJson('technicalAddons.json')
  const splunkApps = loadJson('splunkApps.json')
  const catalogVersion = loadJson('catalogVersion.json')

  const rates = sizingRatesDoc.rates ?? {}
  const methods = countingDoc.methods ?? {}
  const mappings = useCaseDoc.mappings ?? {}
  const capabilities = logCapDoc.capabilities ?? {}
  const vendorRates = vendorModelDoc.rates ?? {}
  const notes = researchDoc.notes ?? []

  const entries = flattenSourcesCatalog(sourcesJson)
  const parentById = new Map(entries.map((e) => [e.id, e.parentId]))

  const catalogIdSet = new Set(entries.map((e) => e.id))
  const rateKeys = Object.keys(rates)
  const extraRateKeys = rateKeys.filter((k) => !catalogIdSet.has(k))
  const aliasCanonValues = new Set(Object.values(RATE_ALIASES))
  const legacyAnalysis = explainExtraRateKeys(extraRateKeys, aliasCanonValues)

  const addonList = technicalAddons.addons ?? []
  const supportedSourceRefCount = addonList.reduce(
    (n, a) => n + (a.supportedSources?.length ?? 0),
    0,
  )

  const noteSourceIds = new Set(notes.map((n) => n.sourceId))

  function hasResearchViaAncestors(id) {
    const seen = new Set()
    let cur = id
    while (cur != null && !seen.has(cur)) {
      seen.add(cur)
      for (const k of orderedKeyCandidates(cur)) {
        if (noteSourceIds.has(k)) return true
      }
      cur = parentById.get(cur) ?? null
    }
    return false
  }

  const rowResults = entries.map((entry) => {
    const { id, category, isChild, isLogOption } = entry

    const rateKey = resolveRecordKey(rates, id)
    const hasSizing = rateKey != null
    const sizingResolvedKey = rateKey

    const methodKey = resolveRecordKey(methods, id)
    const hasCounting = methodKey != null

    const mappingKey = resolveRecordKey(mappings, id)
    const hasUseCase = mappingKey != null

    const capResolved = resolveWithAncestors(capabilities, id, parentById)
    const hasLogCap = capResolved != null

    const vendorKey = resolveRecordKey(vendorRates, id)
    const hasVendorMultiplier = vendorKey != null

    const hasResearch = hasResearchViaAncestors(id)

    let needsReview = null
    if (rateKey != null && Object.prototype.hasOwnProperty.call(rates[rateKey], 'needsReview')) {
      needsReview = Boolean(rates[rateKey].needsReview)
    }

    const missingFields = []
    if (!hasSizing) missingFields.push('sizingRate')
    if (!hasCounting) missingFields.push('countingMethod')
    if (!hasUseCase) missingFields.push('useCaseMapping')
    if (!hasLogCap) missingFields.push('logCapability')
    if (!hasResearch) missingFields.push('researchNote')

    const coreComplete = hasSizing && hasCounting && hasUseCase && hasLogCap && hasResearch

    return {
      id,
      category: category ?? '(unknown)',
      isChild,
      isLogOption,
      checks: {
        sizing: hasSizing,
        counting: hasCounting,
        useCase: hasUseCase,
        logCapability: hasLogCap,
        vendorModel: hasVendorMultiplier,
        research: hasResearch,
      },
      resolvedKeys: {
        sizingRate: sizingResolvedKey,
        countingMethod: methodKey,
        useCaseMapping: mappingKey,
        logCapability: capResolved?.key ?? null,
        logCapabilityVia: capResolved && capResolved.matchedId !== id
          ? capResolved.matchedId
          : null,
        vendorModel: vendorKey,
      },
      needsReview,
      missingFields,
      metadataComplete: coreComplete,
    }
  })

  const totalSources = rowResults.length
  const completeMetadata = rowResults.filter((r) => r.metadataComplete).length
  const partialMetadata = totalSources - completeMetadata
  const needsReviewCount = rowResults.filter((r) => r.needsReview === true).length

  const criticalGaps = rowResults.filter((r) =>
    r.missingFields.includes('sizingRate') || r.missingFields.includes('countingMethod'),
  ).map((r) => r.id)

  const byCategory = {}
  for (const r of rowResults) {
    const cat = r.category
    if (!byCategory[cat]) {
      byCategory[cat] = { total: 0, complete: 0, partial: 0, needsReview: 0 }
    }
    byCategory[cat].total += 1
    if (r.metadataComplete) byCategory[cat].complete += 1
    else byCategory[cat].partial += 1
    if (r.needsReview === true) byCategory[cat].needsReview += 1
  }

  const generatedAt = new Date().toISOString().slice(0, 10)
  const appVersion = catalogVersion.appVersion ?? '1.7.0'
  const scopeLabel = appVersion.replace(/(\d+\.\d+).*/, 'v$1')

  const jsonOut = {
    generatedAt,
    catalogVersion,
    loadedFiles: {
      sources: 'src/data/sources.json',
      sizingRates: 'src/data/sizingRates.json',
      sourceCountingMethods: 'src/data/sourceCountingMethods.json',
      sourceUseCaseMappings: 'src/data/sourceUseCaseMappings.json',
      sourceLogCapabilities: 'src/data/sourceLogCapabilities.json',
      sizingResearchNotes: 'src/data/sizingResearchNotes.json',
      vendorModelRates: 'src/data/vendorModelRates.json',
      technicalAddons: 'src/data/technicalAddons.json',
      splunkApps: 'src/data/splunkApps.json',
      catalogVersionFile: 'src/data/catalogVersion.json',
    },
    rateAliases: RATE_ALIASES,
    summary: {
      totalSources,
      completeMetadata,
      partialMetadata,
      needsReview: needsReviewCount,
      byCategory,
      criticalGaps,
    },
    legacyRateKeys: {
      count: extraRateKeys.length,
      keys: extraRateKeys,
      aliasCanonicalTargets: [...aliasCanonValues],
      analysis: legacyAnalysis,
    },
    technicalAddons: {
      addonCount: addonList.length,
      supportedSourceReferenceCount: supportedSourceRefCount,
    },
    splunkApps: {
      loaded: Array.isArray(splunkApps),
      categoryCount: Array.isArray(splunkApps) ? splunkApps.length : 0,
    },
    sources: rowResults,
  }

  const mdLines = [
    `# Splunk Scope ${scopeLabel} — Catalog Validation Report`,
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total sources: ${totalSources}`,
    `- Complete metadata: ${completeMetadata}`,
    `- Partial metadata: ${partialMetadata}`,
    `- needsReview: ${needsReviewCount}`,
    `- Critical gaps (sizing or counting): ${criticalGaps.length === 0 ? 'none' : criticalGaps.join(', ')}`,
    '',
    '### Breakdown by category',
    '',
    '| Category | Total | Complete | Partial | needsReview |',
    '|----------|-------|----------|---------|-------------|',
  ]

  const categoryNames = Object.keys(byCategory).sort()
  for (const cat of categoryNames) {
    const b = byCategory[cat]
    mdLines.push(`| ${cat} | ${b.total} | ${b.complete} | ${b.partial} | ${b.needsReview} |`)
  }

  mdLines.push(
    '',
    '## Coverage Matrix',
    '',
    '| Source | Category | Sizing | Counting | UseCase | LogCap | Vendor | Research | NeedsReview |',
    '|--------|----------|--------|----------|---------|--------|--------|----------|-------------|',
  )

  for (const r of rowResults) {
    const { checks } = r
    const vendorCell = checks.vendorModel ? '✓' : '—'
    mdLines.push(
      `| ${r.id} | ${r.category} | ${markdownCellMark(checks.sizing)} | ${markdownCellMark(checks.counting)} | ${markdownCellMark(checks.useCase)} | ${markdownCellMark(checks.logCapability)} | ${vendorCell} | ${markdownCellMark(checks.research)} | ${r.needsReview == null ? '—' : String(r.needsReview)} |`,
    )
  }

  mdLines.push('', '## Missing Metadata', '')

  const withGaps = rowResults.filter((r) => r.missingFields.length > 0)
  if (withGaps.length === 0) {
    mdLines.push('All catalog sources have sizing, counting, use-case, log-capability coverage, and research (including ancestor notes for scoped channels).')
  } else {
    for (const r of withGaps) {
      mdLines.push(`- **${r.id}** (${r.category}): missing ${r.missingFields.join(', ')}`)
    }
  }

  mdLines.push('', '## Legacy Aliases', '')

  mdLines.push(
    `sizingRates.json defines **${rateKeys.length}** rate keys; the flattened source catalog lists **${catalogIdSet.size}** IDs. `
      + `The **${extraRateKeys.length}** keys present in sizing rates but not as standalone source rows are:`,
    '',
  )
  mdLines.push('1. **Canonical partners for legacy IDs** (see `RATE_ALIASES` in the validator): '
    + `${legacyAnalysis.fromAliasCanon.map((k) => `\`${k}\``).join(', ') || '(none)'}`)
  mdLines.push('2. **Additional granular / alternate rate paths** documented in sizingRates for additive or vendor-specific estimates: '
    + `${legacyAnalysis.additionalGranular.map((k) => `\`${k}\``).join(', ') || '(none)'}`)
  mdLines.push('', legacyAnalysis.note)

  fs.mkdirSync(DOCS, { recursive: true })
  fs.writeFileSync(
    path.join(DOCS, 'catalog-validation-report.json'),
    `${JSON.stringify(jsonOut, null, 2)}\n`,
    'utf8',
  )
  fs.writeFileSync(
    path.join(DOCS, 'catalog-validation-report.md'),
    `${mdLines.join('\n')}\n`,
    'utf8',
  )

  console.log(`Wrote docs/archive/catalog-validation-report.md and .json (${totalSources} sources).`)

  const blockers = rowResults.filter((r) =>
    !r.checks.sizing || !r.checks.counting,
  )
  if (blockers.length > 0) {
    console.error('Validation failed: missing sizing rate or counting method for:')
    for (const r of blockers) console.error(`  - ${r.id}`)
    process.exitCode = 1
  } else {
    process.exitCode = 0
  }
}

main()
