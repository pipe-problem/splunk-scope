/**
 * Maps Cursor/Circuit import dataSources[] rows to source candidates and hints.
 */
import sourcesCatalog from '../data/sources.json';
import sizingRates from '../data/originalSizingRates.json';
import { flattenSourceCatalog } from './sizingEngine.js';
import { matchSourceHint } from './intakeImportHelpers.js';
import { getNestedValue, setNestedValue } from '../utils/draftPathUtils.js';

const FLAT_CATALOG = flattenSourceCatalog(sourcesCatalog);
const CATALOG_BY_ID = new Map(FLAT_CATALOG.map((s) => [s.id, s]));
const RATE_BY_ID = sizingRates.entries || {};

function normalizeConfidence(value) {
  const raw = String(value || 'low').trim().toLowerCase();
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return 'low';
}

function parsePositiveNumber(value) {
  if (value == null || value === '') return null;
  const num = Number(String(value).replace(/[,$]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function getPrimaryInputField(sourceId) {
  return RATE_BY_ID[sourceId]?.primaryInputField || null;
}

function getVendorFieldDef(catalogEntry) {
  return (catalogEntry?.input_fields || []).find((f) => f.key === 'vendor' && f.type === 'select');
}

function resolveVendor(vendorField, vendor) {
  if (!vendor) return { vendor: null, valid: true };
  const raw = String(vendor).trim();
  if (!vendorField?.options?.length) return { vendor: raw, valid: true };
  const match = vendorField.options.find(
    (opt) => String(opt).toLowerCase() === raw.toLowerCase(),
  );
  if (match) return { vendor: match, valid: true };
  const fuzzy = vendorField.options.find(
    (opt) => raw.toLowerCase().includes(String(opt).toLowerCase())
      || String(opt).toLowerCase().includes(raw.toLowerCase()),
  );
  if (fuzzy) return { vendor: fuzzy, valid: true };
  return { vendor: raw, valid: false };
}

function buildInputPatch(sourceId, row, catalogEntry) {
  const primaryField = getPrimaryInputField(sourceId);
  let patch = {};

  if (row.inputs && typeof row.inputs === 'object') {
    for (const [key, value] of Object.entries(row.inputs)) {
      if (value == null || value === '') continue;
      if (key.includes('.')) {
        patch = setNestedValue(patch, key, value);
      } else {
        patch[key] = value;
      }
    }
  }

  const count = parsePositiveNumber(row.count);
  if (primaryField && count != null) {
    const existing = getNestedValue(patch, primaryField);
    if (existing == null || existing === '') {
      patch = setNestedValue(patch, primaryField, count);
    }
  }

  const vendorField = getVendorFieldDef(catalogEntry);
  const vendorResult = resolveVendor(vendorField, row.vendor);
  if (vendorResult.vendor) {
    patch.vendor = vendorResult.vendor;
  }

  if (row.notes?.trim()) {
    patch.notes = String(row.notes).trim();
  }

  return { patch, vendorResult, primaryField, count };
}

function getPrimaryCount(patch, primaryField) {
  if (!primaryField) return null;
  return parsePositiveNumber(getNestedValue(patch, primaryField));
}

/**
 * @param {object[]} dataSources
 * @param {string[]} [warnings]
 * @returns {{ sourceCandidates: object[], sourceHints: object[] }}
 */
export function mapImportDataSources(dataSources, warnings = []) {
  const sourceCandidates = [];
  const sourceHints = [];

  for (const row of dataSources || []) {
    if (!row || typeof row !== 'object') continue;

    const sourceName = String(row.sourceName || row.name || '').trim();
    const vendor = row.vendor || null;
    const product = row.product || null;
    let sourceId = row.sourceId || null;

    if (sourceId && !CATALOG_BY_ID.has(sourceId)) {
      warnings.push(`Unknown sourceId from import: ${sourceId}`);
      sourceId = matchSourceHint(sourceName, vendor, product);
    } else if (!sourceId) {
      sourceId = matchSourceHint(sourceName, vendor, product);
    }

    const catalogEntry = sourceId ? CATALOG_BY_ID.get(sourceId) : null;
    const declaredConfidence = normalizeConfidence(row.confidence);
    const skipReason = row.skipReason ? String(row.skipReason).trim() : null;

    const hint = {
      sourceName,
      sourceId,
      vendor: vendor ? String(vendor).trim() : null,
      product: product ? String(product).trim() : null,
      count: parsePositiveNumber(row.count),
      environment: row.environment || 'unknown',
      status: row.status || 'current',
      notes: String(row.notes || '').trim(),
      confidence: declaredConfidence,
      skipReason,
    };

    if (!sourceId) {
      hint.confidence = 'low';
      if (sourceName || vendor || product) {
        warnings.push(`Could not map data source: ${[sourceName, vendor, product].filter(Boolean).join(' / ')}`);
      }
      sourceHints.push(hint);
      continue;
    }

    const { patch, vendorResult, primaryField, count } = buildInputPatch(sourceId, row, catalogEntry);
    const primaryCount = getPrimaryCount(patch, primaryField);

    let effectiveConfidence = declaredConfidence;
    let effectiveSkipReason = skipReason;

    if (!primaryField) {
      effectiveConfidence = 'low';
      effectiveSkipReason = effectiveSkipReason || 'No sizing primary field for this source';
    } else if (primaryCount == null) {
      effectiveConfidence = 'low';
      effectiveSkipReason = effectiveSkipReason || 'No explicit count for sizing';
    }

    if (vendorResult.valid === false) {
      if (effectiveConfidence === 'high') effectiveConfidence = 'medium';
      warnings.push(`Vendor "${row.vendor}" not in catalog options for ${sourceId}`);
    }

    if (declaredConfidence === 'high' && effectiveConfidence !== 'high') {
      warnings.push(`Downgraded ${sourceId} from high to ${effectiveConfidence}: ${effectiveSkipReason || 'validation failed'}`);
    }

    const applyEligible = effectiveConfidence === 'high'
      && primaryCount != null
      && vendorResult.valid !== false;

    const candidate = {
      sourceId,
      sourceName: catalogEntry?.name || sourceName || sourceId,
      confidence: effectiveConfidence,
      applyEligible,
      applyByDefault: applyEligible,
      skipReason: effectiveSkipReason,
      primaryField,
      primaryCount,
      vendor: patch.vendor || null,
      patch: {
        status: row.status === 'future' ? 'future' : 'current',
        ...patch,
      },
      hint,
    };

    sourceCandidates.push(candidate);

    if (!applyEligible) {
      sourceHints.push({ ...hint, confidence: effectiveConfidence, skipReason: effectiveSkipReason });
    }
  }

  return { sourceCandidates, sourceHints };
}

export function buildSourceCatalogAppendix() {
  const lines = ['Source catalog (use sourceId exactly; map counts to primaryInputField):'];
  for (const entry of FLAT_CATALOG) {
    const rate = RATE_BY_ID[entry.id];
    if (!rate?.primaryInputField) continue;
    const vendors = entry.exampleVendors?.slice(0, 3).join(', ') || '';
    lines.push(
      `  - ${entry.id}: ${entry.name} | primary=${rate.primaryInputField} (${rate.unitLabel})${vendors ? ` | vendors: ${vendors}` : ''}`,
    );
  }
  return lines.join('\n');
}

export function getFlatCatalogIds() {
  return FLAT_CATALOG.map((s) => s.id);
}
