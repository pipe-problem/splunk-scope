/**
 * Pre-export validation for customer planning pack (HTML + PDF).
 */

const LOCALHOST_PATTERN = /localhost|127\.0\.0\.1/i;
const INTERNAL_FIELD_PATTERN =
  /\b(opportunityBudgetUsd|internalBudget|budgetNotes|confidenceScore|reasonCodes|debugReason)\b/i;

function collectExportStrings(value, out = [], depth = 0) {
  if (depth > 10) return out;
  if (value == null) return out;
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return out;
  if (Array.isArray(value)) {
    value.forEach((v) => collectExportStrings(v, out, depth + 1));
    return out;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach((v) => collectExportStrings(v, out, depth + 1));
  }
  return out;
}

function collectStrings(data) {
  return collectExportStrings(data).join(' ');
}

/**
 * @param {object} data - sanitized customer report data
 * @returns {{ critical: string[], warnings: string[] }}
 */
export function validateCustomerReportExport(data) {
  const critical = [];
  const warnings = [];
  const blob = collectStrings(data);

  if (!data?.customer?.trim()) critical.push('Missing customer name');
  if (!data?.selectedPath?.trim()) critical.push('Missing selected architecture path');

  if (/\[object Object\]/i.test(blob)) critical.push('Export contains [object Object] rendering');
  if (/\bundefined\b/i.test(blob)) critical.push('Export contains undefined text');
  if (/null/i.test(blob.replace(/\bnull\b/gi, ''))) {
    if (/\bnull\b/i.test(blob)) warnings.push('Export may contain null visible text');
  }
  if (/GB\/day\s+GB\/day/i.test(blob)) critical.push('Export contains duplicated GB/day units');

  if (LOCALHOST_PATTERN.test(blob)) critical.push('Export contains localhost references');
  if (INTERNAL_FIELD_PATTERN.test(blob)) critical.push('Export contains internal-only fields');
  if (/\$\d[\d,]*(?:\.\d+)?\s*(?:USD|usd|budget)/i.test(blob)) {
    warnings.push('Export may contain budget or pricing references');
  }
  if (/confidence\s*(?:score|:)\s*\d/i.test(blob)) {
    warnings.push('Export may expose confidence scores');
  }

  if (!data?.overview) warnings.push('Overview section is empty');
  if (!data?.sourceGroups?.length) warnings.push('No configured sources in export');
  if (!data?.startupGuide) warnings.push('Startup guide section is empty');

  for (const group of data?.sourceGroups || []) {
    for (const src of group.sources || []) {
      if (src.ingest?.expected <= 0 && src.configured === false) {
        warnings.push(`Unconfigured zero-ingest source: ${src.name}`);
      }
    }
  }

  for (const link of data?.links || []) {
    if (!link?.url?.startsWith('https://')) warnings.push(`Unverified link: ${link?.label || 'unknown'}`);
  }

  return { critical, warnings };
}

export function canExportCustomerReport(validation) {
  return validation.critical.length === 0;
}
