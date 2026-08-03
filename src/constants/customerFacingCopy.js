/**
 * Customer-facing copy constants — budget language is INTERNAL ONLY (Intake + SE summary).
 */

/** Review page — all configured sources in the session. */
export const TOTAL_CONFIGURED_INGEST_LABEL = 'Total configured source ingest';
/** @deprecated alias — use TOTAL_CONFIGURED_INGEST_LABEL */
export const TOTAL_INGEST_LABEL = TOTAL_CONFIGURED_INGEST_LABEL;
/** Architecture Paths cards and path-scoped KPIs. */
export const SELECTED_PATH_INGEST_LABEL = 'Selected path ingest';
/** Report page and customer exports for the chosen path. */
export const RECOMMENDED_PATH_INGEST_LABEL = 'Recommended path ingest';
export const RANGE_CAPTION = '±20% estimate range';
export const OVERLAP_ANNOTATE_ONLY_NOTE =
  'Informational only — these overlaps are shown for planning discussion and are not automatically removed from the estimate.';
export const FUTURE_MATURITY_SECTION_TITLE = 'Future maturity opportunities';
/** Crawl / Walk paths — coverage domains below threshold. */
export const TELEMETRY_GAPS_SECTION_TITLE = 'Potential telemetry gaps';
export const STARTUP_SUMMARY_SECTION_TITLE = 'Startup summary';

/** Must never appear in customer UI, report, or export deliverables (except se-sales-summary.html). */
export const BANNED_CUSTOMER_BUDGET_PHRASES =
  /planning budget|ingest budget|opportunity budget|budget cap|budget target|budget utilization|budget headroom|sized to your planning budget|within budget|gb\/day budget|budget context/i;

export function containsBannedBudgetLanguage(text) {
  return BANNED_CUSTOMER_BUDGET_PHRASES.test(String(text || ''));
}

/** Internal SE language that must not appear in customer UI or exports. */
export const BANNED_CUSTOMER_PROMPTING_PHRASES =
  /ask the customer|confirm with the customer|talk track|internal only|se only|follow-on phase|follow on phase|follow-on sources|size these sources|what we heard|needs review|planned in a later phase|active sources|confirm with system owner|system owners during planning/i;

export function containsBannedPromptingLanguage(text) {
  return BANNED_CUSTOMER_PROMPTING_PHRASES.test(String(text || ''));
}

export function findBannedPromptingLanguageInReport(data, path = 'root') {
  const hits = [];
  if (data == null) return hits;
  if (typeof data === 'string') {
    if (containsBannedPromptingLanguage(data)) hits.push({ path, text: data.slice(0, 120) });
    return hits;
  }
  if (Array.isArray(data)) {
    data.forEach((item, i) => {
      hits.push(...findBannedPromptingLanguageInReport(item, `${path}[${i}]`));
    });
    return hits;
  }
  if (typeof data === 'object') {
    for (const [key, val] of Object.entries(data)) {
      hits.push(...findBannedPromptingLanguageInReport(val, `${path}.${key}`));
    }
  }
  return hits;
}

/**
 * Remove customer-visible text that references internal budget inputs.
 * Returns empty string when the whole value is budget-related.
 */
export function stripBannedBudgetLanguage(text) {
  if (text == null || text === '') return text;
  const s = String(text).trim();
  if (!s) return s;
  if (containsBannedBudgetLanguage(s)) return '';
  return s;
}

/**
 * Collect banned budget phrase hits from a sanitized report object (for tests).
 */
export function findBannedBudgetLanguageInReport(data, path = 'root') {
  const hits = [];
  if (data == null) return hits;

  if (typeof data === 'string') {
    if (containsBannedBudgetLanguage(data)) hits.push({ path, text: data.slice(0, 120) });
    return hits;
  }

  if (Array.isArray(data)) {
    data.forEach((item, i) => {
      hits.push(...findBannedBudgetLanguageInReport(item, `${path}[${i}]`));
    });
    return hits;
  }

  if (typeof data === 'object') {
    for (const [key, val] of Object.entries(data)) {
      hits.push(...findBannedBudgetLanguageInReport(val, `${path}.${key}`));
    }
  }
  return hits;
}
