/**
 * Use-case-aware "Future maturity opportunities" for architecture path reports.
 */
import { mapValidationGapsToCopy, formatRecommendedNotConfiguredGap } from './pathGapCopyEngine.js';
import { isGapSourceAlreadyCovered } from './sourceEquivalencyEngine.js';
import { getGoalsForIntake } from './goalAppSourceKnowledge.js';

const OT_DOMAINS = new Set([
  'ot_network',
  'scada_events',
  'historian_data',
  'industrial_assets',
]);

const OT_USE_CASE_PATTERN =
  /\bot\b|ics|scada|manufacturing|industrial|warehouse automation|operational technology/i;

const GAP_LINE_SOURCE_PATTERNS = [
  { pattern: /endpoint detection logs/i, sourceId: 'edr' },
  { pattern: /identity provider logs|directory authentication logs/i, sourceId: 'sso_pam' },
  { pattern: /windows server logs/i, sourceId: 'windows_servers' },
];

const MATURITY_OPPORTUNITY_CATALOG = [
  {
    id: 'threat_intel',
    sourceId: 'threat_intel',
    useCaseMatch: /threat|siem|detection|investigation/i,
    label: 'Threat intelligence feeds',
    reason:
      'Enrich Enterprise Security notables and risk-based alerting with curated IOC and actor context.',
  },
  {
    id: 'cspm',
    sourceId: 'cspm',
    useCaseMatch: /cloud security|cloud/i,
    label: 'Cloud posture (CSPM) findings',
    reason: 'Deepen cloud security context with misconfiguration and compliance posture signals from AWS/Azure.',
  },
  {
    id: 'casb',
    sourceId: 'casb',
    useCaseMatch: /cloud security|compliance|audit/i,
    label: 'CASB / SaaS security controls',
    reason: 'Strengthen SaaS and data-protection monitoring beyond core identity and productivity logs.',
  },
  {
    id: 'dlp',
    sourceId: 'dlp',
    useCaseMatch: /compliance|audit|cloud security/i,
    label: 'Data loss prevention (DLP)',
    reason: 'Add exfiltration and sensitive-data policy evidence for compliance and insider-risk programs.',
  },
  {
    id: 'proxy',
    sourceId: 'proxy',
    useCaseMatch: /threat|cloud security|compliance/i,
    label: 'Web proxy / secure web gateway expansion',
    reason: 'Broaden north-south web visibility and URL categorization for investigation and PCI evidence.',
  },
  {
    id: 'vuln_mgmt',
    sourceId: 'vuln_mgmt',
    useCaseMatch: /threat|compliance|cloud security/i,
    label: 'Vulnerability management enrichment',
    reason: 'Correlate detections with patch and exposure context for prioritization and audit responses.',
  },
  {
    id: 'database',
    sourceId: 'database',
    useCaseMatch: /compliance|audit|pci/i,
    label: 'Database audit telemetry',
    reason: 'Support PCI and compliance evidence with database access and change activity in CDE scope.',
  },
];

function intakeText(intake = {}) {
  return [
    ...(intake.useCases || []),
    intake.customUseCases || '',
    intake.discoveryNotes || '',
  ].join(' ');
}

function otInScope(useCases = [], intake = {}) {
  const text = [...useCases.map((u) => u.name || ''), intakeText(intake)].join(' ');
  return OT_USE_CASE_PATTERN.test(text);
}

function filterGapLine(line, pathIds, configuredIds, useCases, intake) {
  const hay = String(line || '');
  for (const { pattern, sourceId } of GAP_LINE_SOURCE_PATTERNS) {
    if (pattern.test(hay) && isGapSourceAlreadyCovered(sourceId, pathIds)) {
      return null;
    }
  }
  if (!otInScope(useCases, intake)) {
    for (const domain of OT_DOMAINS) {
      if (new RegExp(domain.replace(/_/g, '[\\s_]'), 'i').test(hay)) return null;
    }
    if (/ot\/ics|scada|industrial asset|historian/i.test(hay)) return null;
  }
  if (/database audit logs/i.test(hay) && !/compliance|audit|pci|database/i.test(intakeText(intake))) {
    return null;
  }
  if (isGapSourceAlreadyCovered('database', pathIds) && /database audit logs/i.test(hay)) {
    return null;
  }
  return hay;
}

function buildCatalogOpportunities(pathIds, useCases, intake) {
  const text = intakeText(intake);
  const goals = getGoalsForIntake(intake).map((g) => g.name).join(' ');
  const combined = `${text} ${goals}`;
  const lines = [];

  for (const item of MATURITY_OPPORTUNITY_CATALOG) {
    if (pathIds.has(item.sourceId)) continue;
    if (!item.useCaseMatch.test(combined)) continue;
    lines.push(`${item.label} — ${item.reason}`);
  }
  return lines;
}

/**
 * @param {object} params
 * @param {{ gaps?: unknown[] }} params.validation
 * @param {object[]} [params.recommendedNotConfigured]
 * @param {string[]} params.pathSourceIds
 * @param {string[]} params.configuredSourceIds
 * @param {object[]} [params.useCases]
 * @param {object} [params.intake]
 * @returns {string[]}
 */
export function buildFutureMaturityOpportunities({
  validation,
  recommendedNotConfigured = [],
  pathSourceIds = [],
  configuredSourceIds = [],
  useCases = [],
  intake = {},
}) {
  const pathIds = new Set(pathSourceIds);
  const configuredIds = new Set(configuredSourceIds);

  const fromValidation = mapValidationGapsToCopy(validation, { useCases, intake })
    .map((line) => filterGapLine(line, pathIds, configuredIds, useCases, intake))
    .filter(Boolean)
    .map((line) => line.replace(/^Additional log sources are recommended to improve/i, 'Optional maturity improvement:'));

  const fromRecommended = recommendedNotConfigured
    .filter((row) => !pathIds.has(row.id) && !configuredIds.has(row.id))
    .filter((row) => !isGapSourceAlreadyCovered(row.id, pathIds))
    .slice(0, 3)
    .map((row) => {
      const base = formatRecommendedNotConfiguredGap(row);
      return base.replace(/^[^:]+:\s*/, (name) => `Optional: ${name.trim()} — `);
    });

  const catalog = buildCatalogOpportunities(pathIds, useCases, intake);

  const seen = new Set();
  const merged = [];
  for (const line of [...fromValidation, ...catalog, ...fromRecommended]) {
    const key = line.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(line.trim());
  }
  return merged.slice(0, 15);
}

export const READINESS_HELPER_TEXT =
  'Readiness reflects coverage of selected use cases for this maturity path. A primary use case can be covered while optional sources may still improve enrichment, depth, and operational maturity.';
