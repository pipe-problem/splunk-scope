/**
 * Strip internal-only fields from customer report data before export.
 */

import { sanitizeCustomerFacingText } from './reportExportEngine.js';
import {
  containsBannedBudgetLanguage,
  stripBannedBudgetLanguage,
  findBannedBudgetLanguageInReport,
} from '../constants/customerFacingCopy.js';

export { findBannedBudgetLanguageInReport };

const INTERNAL_KEYS = new Set([
  'confidence',
  'rateSource',
  'warnings',
  'budgetGbDay',
  'opportunityBudgetUsd',
  'budgetNotes',
  'internalBudget',
  'internalNotes',
  'internalSalesSummary',
  'debug',
  'reasonCodes',
  'scoring',
  'rawId',
  'sessionId',
  'schemaVersion',
]);

const LOCALHOST_PATTERN = /localhost|127\.0\.0\.1|0\.0\.0\.0/i;

function deepSanitize(value, depth = 0) {
  if (depth > 12) return null;
  if (value == null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    let s = sanitizeCustomerFacingText(value);
    s = stripBannedBudgetLanguage(s);
    if (LOCALHOST_PATTERN.test(s)) return '';
    return s;
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepSanitize(v, depth + 1)).filter((v) => v !== undefined);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (INTERNAL_KEYS.has(key)) continue;
      if (/^internal/i.test(key) || /debug/i.test(key)) continue;
      out[key] = deepSanitize(val, depth + 1);
    }
    return out;
  }
  return value;
}

/** @param {object} data */
export function sanitizeCustomerReportData(data) {
  const sanitized = deepSanitize(data);

  if (sanitized.links) {
    sanitized.links = sanitized.links.filter(
      (link) => link?.url && /^https:\/\//i.test(link.url) && !LOCALHOST_PATTERN.test(link.url),
    );
  }

  if (sanitized.recommendedProducts) {
    for (const group of Object.values(sanitized.recommendedProducts)) {
      if (!Array.isArray(group)) continue;
      for (const item of group) {
        if (item.url && (LOCALHOST_PATTERN.test(item.url) || !/^https:\/\//i.test(item.url))) {
          item.url = null;
          item.needsValidation = true;
        }
      }
    }
  }

  if (sanitized.productRecommendations?.compactItems) {
    for (const item of sanitized.productRecommendations.compactItems) {
      if (item.customerUrl && (LOCALHOST_PATTERN.test(item.customerUrl) || !/^https:\/\//i.test(item.customerUrl))) {
        item.customerUrl = null;
        item.needsExternalValidation = true;
      }
    }
  }

  if (sanitized.pathDetail?.description && containsBannedBudgetLanguage(sanitized.pathDetail.description)) {
    sanitized.pathDetail.description = '';
  }
  if (sanitized.selectedPathDescription && containsBannedBudgetLanguage(sanitized.selectedPathDescription)) {
    sanitized.selectedPathDescription = '';
  }

  return sanitized;
}
