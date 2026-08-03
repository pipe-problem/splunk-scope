/**
 * Pre-export validation for customer-facing PDF/PPTX content.
 */

import {
  EXPORT_DISCLAIMER_FULL,
  EXPORT_DISCLAIMER_SHORT,
  EXPORT_OFFICIAL_LINKS,
} from './exportConstants.js';
import { GENERIC_VALUE_PROP } from './exportShared.js';

const PROHIBITED_EXPORT_TERMS =
  /proof.of.value|\bPOV\b|\bPOC\b|proof.of.concept|guaranteed|free implementation|commercial commitment|official sizing|guaranteed to work/i;

const INSTALL_ONLY_IN_VALUE_PROPOSAL =
  /Universal Forwarder download|indexes\.conf reference|Install Splunk Enterprise on Linux|splunk install linux|deployment server stanza/i;

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

/** @returns {string[]} */
export function validateExportContent(payload) {
  const issues = [];
  const strings = collectExportStrings(payload);
  const textBlob = strings.join(' ') + EXPORT_DISCLAIMER_FULL + EXPORT_DISCLAIMER_SHORT;

  if (/\[object Object\]/i.test(textBlob)) issues.push('Export contains [object Object] rendering');
  if (/undefined|null/i.test(textBlob.replace(/\bnull\b/g, ''))) {
    if (/\bundefined\b/i.test(textBlob)) issues.push('Export contains undefined text');
  }
  if (/GB\/day\s+GB\/day/i.test(textBlob)) issues.push('Export contains duplicated GB/day units');
  if (GENERIC_VALUE_PROP.test(textBlob)) issues.push('Export contains generic domain enrichment copy');
  if (PROHIBITED_EXPORT_TERMS.test(textBlob)) issues.push('Prohibited language detected in export content');

  for (const link of payload.officialLinksFull || Object.values(EXPORT_OFFICIAL_LINKS)) {
    if (!link?.url?.startsWith('https://')) issues.push(`Invalid link: ${link?.label || 'unknown'}`);
    if (!link?.label?.length) issues.push('Official link missing label');
  }

  if (!payload.selectedPlan?.name && !payload.pathDisplayLabel) {
    issues.push('Missing selected architecture path');
  }
  if (payload.sourceCount != null && payload.sourceRows?.length !== payload.sourceCount) {
    issues.push('Source count mismatch in export payload');
  }

  for (const row of payload.sourceRows || []) {
    if (!row.configured) issues.push(`Unconfigured source in export: ${row.name}`);
    if (row.ingestRange?.expected <= 0 && !row.zeroIngestContext) {
      issues.push(`Zero-ingest source in export without context flag: ${row.name}`);
    }
    if (GENERIC_VALUE_PROP.test(row.whyIncluded || '')) {
      issues.push(`Generic value copy for source: ${row.name}`);
    }
  }

  return issues;
}

export function validateValueProposalContent(payload) {
  const issues = validateExportContent(payload);
  const doc = payload.valueProposalDocument;
  const blob = collectExportStrings({
    doc,
    valueGroups: payload.valueGroups,
    outcomes: payload.businessOutcomes,
    forward: payload.forwardSteps,
  }).join(' ');

  if (INSTALL_ONLY_IN_VALUE_PROPOSAL.test(blob)) {
    issues.push('Value proposal contains install-guide-only content');
  }
  if (payload.executiveSummaryOnly) {
    const execRequired = ['cover', 'executive_summary'];
    const ids = new Set((doc?.pages || []).map((p) => p.id));
    for (const id of execRequired) {
      if (doc && !ids.has(id)) issues.push(`Executive summary export missing section: ${id}`);
    }
    if (doc && doc.pages.length > 2) {
      issues.push('Executive summary export exceeds 2 pages');
    }
    return issues;
  }
  if (doc && (!doc.pages?.length || doc.pages.length < 5)) {
    issues.push('Value proposal document has fewer than 5 pages');
  }
  const requiredSections = [
    'cover',
    'challenges_solutions',
    'architecture_paths',
    'top_sources',
    'risks_next_steps',
  ];
  const ids = new Set((doc?.pages || []).map((p) => p.id));
  for (const id of requiredSections) {
    if (doc && !ids.has(id)) issues.push(`Value proposal missing section: ${id}`);
  }
  return issues;
}

export function validateStartupGuideContent(payload) {
  const issues = validateExportContent(payload);
  const doc = payload.startupGuideDocument;

  if (!payload.validationEntries?.length && !doc?.pages?.some((p) => p.id === 'validation_library')) {
    issues.push('Startup guide missing validation searches');
  }
  if (!payload.officialLinksFull?.length) issues.push('Startup guide missing official links');
  if (!payload.yearOnePlan?.phases?.length) issues.push('Startup guide missing year-one deployment plan');
  if (payload.intake?.opportunityBudgetUsd) issues.push('Budget must not appear in customer-facing exports');
  if (payload.sourceRows?.some((r) => Object.prototype.hasOwnProperty.call(r, 'confidence'))) {
    issues.push('Customer export exposes numeric confidence scores');
  }
  if (doc) {
    const ids = new Set(doc.pages.map((p) => p.id));
    for (const id of ['implementation_summary', 'year_one_roadmap', 'deployment_setup', 'source_details', 'validation_library']) {
      if (!ids.has(id)) issues.push(`Startup guide missing section: ${id}`);
    }
  }
  return issues;
}

export function validatePptxDeck(deck) {
  const issues = [];
  if (!deck?.slides?.length || deck.slides.length < 8) {
    issues.push('PPTX deck has fewer than 8 slides');
  }
  const required = ['title', 'what_we_heard', 'recommended_path', 'value_capability', 'ingest', 'next_steps', 'assumptions'];
  const ids = new Set((deck?.slides || []).map((s) => s.id));
  for (const id of required) {
    if (!ids.has(id)) issues.push(`PPTX missing slide: ${id}`);
  }
  const blob = collectExportStrings(deck).join(' ');
  if (PROHIBITED_EXPORT_TERMS.test(blob)) issues.push('Prohibited language in PPTX');
  if (INSTALL_ONLY_IN_VALUE_PROPOSAL.test(blob)) issues.push('PPTX contains install-only content');
  return issues;
}
