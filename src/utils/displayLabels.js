/**
 * Customer-facing display labels for domains, IDs, status, and telemetry areas.
 */
import { formatDomainForCustomer } from '../services/coverageEngine.js';

export { formatDomainForCustomer };

/** Customer-facing source workflow status labels (never "Active" / "Planned" / "Skip"). */
export const SOURCE_STATUS_LABELS = {
  current: 'Configured',
  future: 'Future phase',
  skip: 'Not in scope',
  unknown: 'Not configured',
};

/** Relevance badge labels shown on Sources and Analysis surfaces. */
export const RELEVANCE_BADGE_LABELS = {
  suggested: 'Suggested',
  optional: 'Enrichment',
  redundant: 'Possible overlap',
  required: 'Suggested',
  recommended: 'Suggested',
  unnecessary: 'Enrichment',
};

/**
 * Format a telemetry domain or focus-area key for customer-facing UI.
 */
export function formatTelemetryFocusLabel(domain) {
  return formatDomainForCustomer(domain);
}

/**
 * @param {string} status
 */
export function formatSourceStatusLabel(status) {
  return SOURCE_STATUS_LABELS[status] || SOURCE_STATUS_LABELS.unknown;
}

/** Replaces internal "Needs review" copy in customer-facing surfaces. */
export function formatValidationNeededLabel() {
  return 'Validate during planning';
}

/** Intake / import surfaces — softer than "Needs review". */
export function formatImportReviewLabel() {
  return 'Confirm during intake';
}

/**
 * @param {string} classification
 */
export function formatRelevanceBadgeLabel(classification) {
  if (classification === 'needs_review') return formatValidationNeededLabel();
  return RELEVANCE_BADGE_LABELS[classification] || RELEVANCE_BADGE_LABELS.optional;
}

/**
 * @param {string} text
 */
export function truncateSubtitle(text, maxLines = 2) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const words = normalized.split(' ');
  const approxChars = maxLines * 72;
  if (normalized.length <= approxChars) return normalized;
  return `${normalized.slice(0, approxChars - 1).trim()}…`;
}

/** Substrings that must not appear in customer-facing UI copy. */
export const BANNED_CUSTOMER_COPY = [
  'Needs review',
  'What we heard',
  'Size these sources',
  '>Skip<',
  ' value="skip">Skip',
  'Planned in a later phase',
  'Active sources',
  ' label: \'Optional\'',
  ' label: \'Redundant\'',
  ' label: \'Required\'',
];
