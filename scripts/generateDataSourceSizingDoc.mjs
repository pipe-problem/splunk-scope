/**
 * Generates docs/archive/DATA_SOURCE_SIZING_FIELDS.md from sources.json + sizingRates.json.
 * Run from repo root: node scripts/generateDataSourceSizingDoc.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

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

function flattenCatalog(nodes, inherited = {}) {
  const flat = []
  for (const node of nodes) {
    const merged = { ...node }
    if (inherited.category && !merged.category) merged.category = inherited.category
    flat.push(merged)
    if (node.children?.length) {
      flat.push(...flattenCatalog(node.children, { category: merged.category }))
    }
  }
  return flat
}

function formatVendorRates(vr) {
  if (!vr || typeof vr !== 'object') return ''
  const lines = []
  for (const [vendor, spec] of Object.entries(vr)) {
    if (spec.models && typeof spec.models === 'object') {
      const models = Object.entries(spec.models)
        .map(([m, ms]) => {
          const t = [ms.low, ms.medium ?? ms.baseRate, ms.high].filter((x) => typeof x === 'number')
          return t.length === 3 ? `${m}: ${t[0]} / ${t[1]} / ${t[2]} GB/d` : `${m}: (see catalog)`
        })
        .join('; ')
      lines.push(`- **${vendor}** — models: ${models}`)
    } else {
      const t = [spec.low, spec.medium ?? spec.baseRate, spec.high].filter((x) => typeof x === 'number')
      lines.push(
        t.length === 3
          ? `- **${vendor}** — low/med/high per unit: ${t[0]} / ${t[1]} / ${t[2]} GB/d`
          : `- **${vendor}** — (see sizingRates.json)`,
      )
    }
  }
  return lines.join('\n')
}

function main() {
  const sources = JSON.parse(fs.readFileSync(path.join(root, 'src/data/sources.json'), 'utf8'))
  const sizingRates = JSON.parse(fs.readFileSync(path.join(root, 'src/data/sizingRates.json'), 'utf8'))
  const catalogVersion = JSON.parse(fs.readFileSync(path.join(root, 'src/data/catalogVersion.json'), 'utf8'))
  const rates = sizingRates.rates || {}
  const flat = flattenCatalog(sources)

  const lines = []
  lines.push('# Data source sizing — required fields and rate reference')
  lines.push('')
  lines.push(`> **Generated:** ${new Date().toISOString().slice(0, 10)} — app ${catalogVersion.appVersion}, sizing rates ${catalogVersion.sizingRatesVersion}`)
  lines.push('> **Regenerate:** `node scripts/generateDataSourceSizingDoc.mjs` (writes this file; review diff before commit)')
  lines.push('')
  lines.push('## How GB/day is computed in the app')
  lines.push('')
  lines.push('1. **Status** — Only *Active* (`current`) or *Planned* (`future`) rows contribute to totals.')
  lines.push('2. **Primary quantity** — The field named in `sizing_formula.primary_input` in `sources.json` (often `count` or `number_of_*`).')
  lines.push('3. **Optional: vendor / model** — When `sizingRates.json` defines `vendorRates`, the engine picks vendor- or model-specific low/medium/high GB/day per unit.')
  lines.push('4. **Optional: logging scope / audit level** — Drives scope multipliers (catalog `scopeMultipliers` when tokens match, else regex fallback in `sizingEngine.js`).')
  lines.push('5. **Manual override** — `override` or `manual_gb_day` (GB/day) replaces formula output for that row.')
  lines.push('6. **Parent rollup** — If a catalog row has `children` and any child is Active/Planned, the **parent** row contributes **0 GB/day** in the app (configure children instead).')
  lines.push('7. **Windows log channels** — `windows_servers` adds **base** per-server ingest plus **selected** `log_options` (`gb_per_unit` × server count). Base rate is tuned so base + default channels approximate workshop expectations.')
  lines.push('8. **IaaS / SaaS general dispersion** — `iaas` uses optional `number_of_regions` (more than one region applies a small upward factor). `saas_general` uses optional `number_of_platforms` (more than one platform applies a small upward factor).')
  lines.push('')
  lines.push('## Rate catalog mapping (source id → sizingRates key)')
  lines.push('')
  lines.push('| Source id | sizingRates key |')
  lines.push('|-----------|-----------------|')
  const mapSeen = new Set()
  for (const s of flat) {
    if (mapSeen.has(s.id)) continue
    mapSeen.add(s.id)
    const key = RATE_ALIASES[s.id] || s.id
    const has = rates[key]
    lines.push(`| \`${s.id}\` | ${has ? `\`${key}\`` : '*(formula fallback)*'} |`)
  }
  lines.push('')
  lines.push('## Per-source fields and estimates')
  lines.push('')

  for (const s of flat) {
    const formula = s.sizing_formula || {}
    const primary = formula.primary_input || 'count'
    const fields = s.input_fields || []
    const fieldList = fields.map((f) => `\`${f.key}\` (${f.type})`).join(', ') || '*(none)*'
    const hasChildren = Array.isArray(s.children) && s.children.length > 0
    const rateKey = RATE_ALIASES[s.id] || s.id
    const entry = rates[rateKey]

    lines.push(`### ${s.name} (\`${s.id}\`)`)
    lines.push('')
    lines.push(`- **Category:** ${s.category || '—'}${s.subcategory ? ` / ${s.subcategory}` : ''}`)
    lines.push(`- **Primary input for formula:** \`${primary}\``)
    lines.push(`- **Form fields:** ${fieldList}`)
    if (hasChildren) {
      lines.push('- **Hierarchy:** Has child sources — if any child is Active/Planned, this parent row is **rolled up** (0 GB/day in totals).')
    }
    if ((s.log_options || []).length) {
      lines.push(`- **Log options:** ${s.log_options.length} channel(s); each selected option adds \`gb_per_unit\` × primary server count (see \`sources.json\`).`)
    }
    lines.push('')
    if (entry) {
      lines.push(`- **Catalog unit:** ${entry.unit || '—'} — ${entry.unitDescription || entry.helpText || ''}`)
      lines.push(
        `- **Default bands (per unit, before scope/vendor):** low **${entry.low}** / medium **${entry.medium ?? entry.baseRate}** / high **${entry.high}** GB/day`,
      )
      if (entry.vendorRates && Object.keys(entry.vendorRates).length) {
        lines.push('- **Vendor / model reference (from sizingRates.json):**')
        lines.push('')
        lines.push(formatVendorRates(entry.vendorRates) || '*(none)*')
      }
      if (entry.scopeMultipliers && Object.keys(entry.scopeMultipliers).length) {
        lines.push('- **Scope multipliers (catalog keys):**')
        for (const [k, v] of Object.entries(entry.scopeMultipliers)) {
          lines.push(`  - \`${k}\`: ×${v}`)
        }
      }
      if (entry.needsReview) {
        lines.push(`- **needsReview:** yes — ${entry.notes || 'validate with customer metering.'}`)
      }
    } else {
      lines.push(
        `- **In-app estimate:** Uses \`sources.json\` \`sizing_formula.rate_per_unit\` / \`sizingRate\` with scope and limited vendor multipliers (see \`sizingEngine.js\`).`,
      )
    }
    lines.push('')
  }

  const outPath = path.join(root, 'docs/archive/DATA_SOURCE_SIZING_FIELDS.md')
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8')
  console.log(`Wrote ${outPath} (${lines.length} lines)`)
}

main()
