/**
 * Shared sanitization and formatting for customer exports.
 */

import {
  stripBannedBudgetLanguage,
  containsBannedPromptingLanguage,
  BANNED_CUSTOMER_PROMPTING_PHRASES,
} from '../constants/customerFacingCopy.js';

export const GENERIC_VALUE_PROP = /enriches telemetry across \d+ domain\(s\)/i;

export function truncate(text, max = 120) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

export function toReadableString(value, depth = 0) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (depth > 2) return '';
  if (Array.isArray(value)) {
    return value.map((v) => toReadableString(v, depth + 1)).filter(Boolean).join('; ');
  }
  if (typeof value === 'object') {
    return (
      value.narrative ||
      value.text ||
      value.title ||
      value.description ||
      value.summary ||
      value.name ||
      value.label ||
      ''
    ).trim();
  }
  return String(value);
}

export function sanitizeCustomerFacingText(text) {
  if (!text) return '';
  let s = String(text)
    .replace(/confirm with system owner/gi, 'Read-only access required during implementation')
    .replace(/Confirm source availability and access with system owners/gi, 'Validate source availability and access during planning')
    .replace(/\bfollow-on phase\b/gi, 'later phase')
    .replace(/\bfollow on phase\b/gi, 'later phase')
    .replace(/\bask the customer:?\s*/gi, '')
    .replace(/\bSplunk Machine Learning Toolkit\b/gi, 'Splunk AI Toolkit')
    .replace(/\bMachine Learning Toolkit\b/gi, 'Splunk AI Toolkit')
    .replace(/\bMLTK\b/g, 'AITK')
    .replace(/\bIncluded in a later phase\b/gi, 'Future maturity opportunities')
    .replace(/\bPOC\b|\bPOV\b|proof.of.concept|proof.of.value/gi, 'planning estimate')
    .replace(/\bofficial sizing\b/gi, 'sizing estimate')
    .replace(/\bguaranteed\b/gi, 'planned')
    .trim();
  s = stripBannedBudgetLanguage(s);
  if (containsBannedPromptingLanguage(s)) {
    s = s
      .replace(BANNED_CUSTOMER_PROMPTING_PHRASES, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return s;
}

export function formatIngestGb(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '0';
  return n.toFixed(1);
}

export function formatIngestRange(low, expected, high) {
  return `${formatIngestGb(low)} / ${formatIngestGb(expected)} / ${formatIngestGb(high)}`;
}

export function formatIngestRangeWithUnit(low, expected, high) {
  return `${formatIngestRange(low, expected, high)} GB/day`;
}

export function formatIngestWithUnit(value) {
  return `${formatIngestGb(value)} GB/day`;
}

export function formatBulletList(items) {
  return (items || []).filter(Boolean).map((item) => `• ${sanitizeCustomerFacingText(toReadableString(item))}`);
}

export function formatNumberedList(items) {
  return (items || [])
    .filter(Boolean)
    .map((item, i) => `${i + 1}. ${sanitizeCustomerFacingText(toReadableString(item))}`);
}

export function safeExportFilename(name) {
  return (name || 'session').replace(/[^\w\-]+/g, '_').slice(0, 60);
}

/** Zip download name: {Organization}_splunk_proposition.zip */
export function propositionZipFilename(organizationName) {
  return `${safeExportFilename(organizationName)}_splunk_proposition.zip`;
}

export function formatDisplayDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}

/**
 * Normalize text for jsPDF / autoTable — avoids spaced-glyph rendering from Unicode punctuation.
 */
export function normalizePdfText(text) {
  if (text == null) return '';
  return String(text)
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]/g, '')
    .replace(/\u2192|\u2794|\u279C|\u27A1/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2713|\u2714|\u2611/g, '(selected)')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sanitize + normalize for PDF output. */
export function pdfText(value) {
  return normalizePdfText(sanitizeCustomerFacingText(toReadableString(value)));
}
