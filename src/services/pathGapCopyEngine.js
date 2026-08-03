/**
 * Customer-facing copy for architecture path coverage gaps (Report page only).
 */
import { formatDomainForCustomer, TELEMETRY_DOMAINS } from './coverageEngine.js';
import { getGoalsForIntake, GOALS_BY_ID } from './goalAppSourceKnowledge.js';
import { flattenSourceCatalog } from './sizingEngine.js';
import sourcesCatalog from '../data/sources.json' with { type: 'json' };
import { strengthToScore } from './strengthScores.js';

const COVERAGE_THRESHOLD = 0.75;

/** Short, report-friendly labels for common gap-closing sources. */
const SOURCE_HINT_LABELS = {
  active_directory: 'Directory authentication logs',
  sso_pam: 'Identity provider logs',
  firewalls: 'Firewall logs',
  edr: 'Endpoint detection logs',
  email: 'Email security logs',
  iaas: 'Cloud infrastructure logs',
  proxy: 'Web proxy logs',
  threat_intel: 'Threat intelligence feeds',
  vpn: 'VPN logs',
  asset_cmdb: 'Asset inventory feeds',
  vuln_mgmt: 'Vulnerability scan data',
  dns: 'DNS query logs',
  windows_servers: 'Windows server logs',
  linux_servers: 'Linux server logs',
  saas_general: 'SaaS application logs',
  netflow: 'Network flow data',
  cspm: 'Cloud posture assessment logs',
  casb: 'CASB activity logs',
  cwpp: 'Cloud workload protection logs',
  database: 'Database audit logs',
  config_mgmt: 'Configuration management logs',
  uba: 'User behavior analytics feeds',
  ids_ips: 'IDS/IPS alert logs',
  ndr: 'Network detection and response logs',
  sandbox: 'Malware sandbox results',
  mdm: 'Mobile device management logs',
  apm: 'Application performance traces',
  web_servers: 'Web server access logs',
  business_txn: 'Business transaction logs',
};

/** What improves when a domain gap is closed. */
const DOMAIN_MONITORING_OUTCOMES = {
  authentication: 'authentication monitoring',
  identity_governance: 'identity and access monitoring',
  endpoint: 'endpoint threat detection',
  network: 'network visibility',
  perimeter_control: 'perimeter security monitoring',
  remote_access: 'remote access monitoring',
  threat_enrichment: 'threat detection and enrichment',
  vulnerability_asset: 'asset and vulnerability context',
  email_collaboration: 'email security monitoring',
  cloud_control_plane: 'cloud control plane monitoring',
  saas_activity: 'SaaS activity monitoring',
  infrastructure_metrics: 'infrastructure performance monitoring',
  application_logs: 'application log visibility',
  application_traces: 'distributed tracing coverage',
  service_health: 'service health monitoring',
  synthetic_monitoring: 'synthetic transaction monitoring',
  real_user_monitoring: 'real user experience monitoring',
  kubernetes_container: 'container platform monitoring',
  cloud_infrastructure: 'cloud infrastructure monitoring',
  database_activity: 'database activity monitoring',
  middleware_messaging: 'middleware and messaging visibility',
  network_performance: 'network performance monitoring',
  storage_performance: 'storage performance monitoring',
  business_transactions: 'business transaction monitoring',
  user_experience: 'user experience monitoring',
  audit_compliance: 'audit and compliance evidence',
  platform_health: 'Splunk platform health monitoring',
  ingest_pipeline_health: 'ingest pipeline monitoring',
  asset_inventory: 'asset inventory context',
  ot_network: 'OT network visibility',
  scada_events: 'SCADA event monitoring',
  historian_data: 'historian and process data coverage',
  industrial_assets: 'industrial asset monitoring',
};

/** @type {Map<string, object>|null} */
let sourceByIdCache = null;

function getSourceByIdMap() {
  if (!sourceByIdCache) {
    sourceByIdCache = new Map(flattenSourceCatalog(sourcesCatalog).map((s) => [s.id, s]));
  }
  return sourceByIdCache;
}

function normalizeGapEntry(gap) {
  if (typeof gap === 'string') return { domain: gap };
  if (gap && typeof gap === 'object') {
    const domain =
      gap.domain
      || (typeof gap.useCase === 'string' && TELEMETRY_DOMAINS.includes(gap.useCase) ? gap.useCase : null);
    return {
      domain,
      useCaseId: gap.useCaseId || (domain ? null : gap.useCase) || null,
      message: gap.message || gap.detail || null,
    };
  }
  return { domain: null };
}

function sourceHintLabel(sourceId) {
  if (SOURCE_HINT_LABELS[sourceId]) return SOURCE_HINT_LABELS[sourceId];
  const src = getSourceByIdMap().get(sourceId);
  if (src?.name) {
    const short = src.name.split(' / ')[0].trim();
    return short.endsWith(' logs') ? short : `${short} logs`;
  }
  return sourceId.replace(/_/g, ' ');
}

function collectSourceCandidatesForDomain(domain, { useCases = [], intake = {} }) {
  const seen = new Set();
  const candidates = [];

  function add(sourceId, weight) {
    if (!sourceId || seen.has(sourceId)) return;
    const src = getSourceByIdMap().get(sourceId);
    if (!src) return;
    const score = strengthToScore(src.telemetryDomains?.[domain]);
    if (score < 0.5) return;
    seen.add(sourceId);
    candidates.push({ sourceId, weight, score, name: src.name });
  }

  for (const goal of getGoalsForIntake(intake)) {
    for (const sourceId of goal.prioritySourceIds || []) add(sourceId, 3);
  }

  for (const uc of useCases) {
    for (const sourceId of uc.minimumSources || []) add(sourceId, 2);
    for (const sourceId of uc.suggestedSources || []) add(sourceId, 1);
  }

  for (const src of getSourceByIdMap().values()) {
    if (strengthToScore(src.telemetryDomains?.[domain]) >= COVERAGE_THRESHOLD) {
      add(src.id, 0);
    }
  }

  candidates.sort((a, b) => b.weight - a.weight || b.score - a.score || a.name.localeCompare(b.name));
  return candidates.slice(0, 3);
}

function monitoringOutcomeForDomain(domain) {
  return (
    DOMAIN_MONITORING_OUTCOMES[domain]
    || `${formatDomainForCustomer(domain).toLowerCase()} coverage`
  );
}

function formatGapSentence(domain, opts) {
  const outcome = monitoringOutcomeForDomain(domain);
  const candidates = collectSourceCandidatesForDomain(domain, opts);

  if (candidates.length === 0) {
    return `Additional log sources are recommended to improve ${outcome}`;
  }

  const primary = sourceHintLabel(candidates[0].sourceId);
  const secondary = candidates[1] ? sourceHintLabel(candidates[1].sourceId) : null;

  if (secondary) {
    return `${primary} or ${secondary} would strengthen ${outcome}`;
  }
  return `${primary} would strengthen ${outcome}`;
}

/**
 * Map a single validation gap (domain string or structured object) to customer copy.
 * @param {string|object} gap
 * @param {{ useCases?: object[], intake?: object }} [opts]
 * @returns {string}
 */
export function mapGapToCustomerCopy(gap, opts = {}) {
  const normalized = normalizeGapEntry(gap);

  if (
    normalized.message
    && !normalized.message.includes('Additional telemetry needed')
    && !/^Coverage:\s*Additional telemetry needed/i.test(normalized.message)
  ) {
    return normalized.message;
  }

  if (normalized.domain) {
    return formatGapSentence(normalized.domain, opts);
  }

  if (normalized.useCaseId) {
    const goal = GOALS_BY_ID.get(normalized.useCaseId);
    if (goal) {
      return `Expand telemetry aligned to ${goal.name} to close remaining coverage gaps`;
    }
  }

  return 'Configure additional log sources to close coverage gaps for your use cases';
}

/**
 * Map validation.gaps to deduplicated customer-facing strings.
 * @param {{ gaps?: Array<string|object> }} validation
 * @param {{ useCases?: object[], intake?: object }} [opts]
 * @returns {string[]}
 */
export function mapValidationGapsToCopy(validation, opts = {}) {
  const lines = [];
  const seen = new Set();

  for (const gap of validation?.gaps || []) {
    const copy = mapGapToCustomerCopy(gap, opts).trim();
    if (!copy || seen.has(copy)) continue;
    seen.add(copy);
    lines.push(copy);
  }

  return lines;
}

/**
 * @param {{ name?: string, reason?: string }} row
 * @returns {string}
 */
export function formatRecommendedNotConfiguredGap(row) {
  const name = row?.name || 'Recommended source';
  const reason = row?.reason || 'Configure in Data Sources before ingest planning';
  return `${name}: ${reason}`;
}

export const BANNED_GAP_SUBSTRINGS = ['Additional telemetry needed', 'Coverage: Additional'];
