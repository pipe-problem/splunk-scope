/**
 * Resolves per-source onboarding details (ingest method, TA, validation SPL)
 * for startup guide generation and customer HTML exports.
 */

import { resolveSplunkbaseLink } from './splunkbaseCatalog.js';
import { sanitizeCustomerFacingText } from './exportShared.js';

const VALIDATION_LIBRARY_GROUPS = [
  {
    name: 'Windows / Active Directory',
    match: /active directory|windows|winevent|domain controller/i,
    spl: 'index=main sourcetype="WinEventLog:Security" EventCode=4624 | stats count by Account_Name, host | head 20',
    expected: 'Recent authentication events with parseable account and host fields.',
    troubleshooting: 'Verify forwarder connectivity, event log permissions, and sourcetype assignment.',
  },
  {
    name: 'Firewall / VPN / Perimeter',
    match: /firewall|vpn|perimeter|waf|asa|anyconnect|ngfw/i,
    spl: 'index=main sourcetype=*firewall* OR sourcetype=*vpn* | stats count by sourcetype, action | head 20',
    expected: 'Traffic or session events with action, source, and destination fields.',
    troubleshooting: 'Confirm syslog or HEC path, technology add-on deployment, and index routing.',
  },
  {
    name: 'DNS / DHCP',
    match: /dns|dhcp/i,
    spl: 'index=main sourcetype=*dns* | stats count by query, client_ip | head 20',
    expected: 'Query or lease events suitable for investigation enrichment.',
    troubleshooting: 'Enable query logging and verify syslog or forwarder configuration.',
  },
  {
    name: 'EDR / Endpoint',
    match: /edr|endpoint|crowdstrike|defender|falcon|desktops/i,
    spl: 'index=main sourcetype=* | stats count by sourcetype, vendor_product | head 20',
    expected: 'Detection or process events with host and severity fields.',
    troubleshooting: 'Validate API credentials, input schedule, and index assignment.',
  },
  {
    name: 'Email security',
    match: /email|proofpoint|mimecast|messag/i,
    spl: 'index=main sourcetype=*email* | stats count by action, recipient | head 20',
    expected: 'Message or threat events with sender and recipient context.',
    troubleshooting: 'Confirm API or syslog integration and field extractions.',
  },
  {
    name: 'Cloud / SaaS / IaaS',
    match: /cloud|saas|o365|m365|azure|aws|gcp|iaas|paas|cspm|cwpp|casb|sase/i,
    spl: 'index=main sourcetype=*o365* OR sourcetype=*aws* OR sourcetype=*azure* | stats count by sourcetype | head 15',
    expected: 'Recent audit events with user, action, and workload fields.',
    troubleshooting: 'Verify add-on credentials, input schedule, and time synchronization.',
  },
  {
    name: 'Vulnerability / Asset',
    match: /vuln|tenable|qualys|cmdb|asset|threat_intel/i,
    spl: 'index=main sourcetype=* | stats count by sourcetype | head 10',
    expected: 'Asset or finding records with host or CVE identifiers.',
    troubleshooting: 'Confirm scan export schedule and index routing.',
  },
  {
    name: 'Linux / Network devices',
    match: /linux|router|switch|wireless|netflow|loadbalancer|middleware|web server/i,
    spl: 'index=main | stats count by sourcetype, host | sort - count | head 20',
    expected: 'Device events with host and vendor sourcetype.',
    troubleshooting: 'Check syslog receivers, time sync, and add-on parsing.',
  },
  {
    name: 'Database',
    match: /database|db_|oracle|sql server|postgres/i,
    spl: 'index=main sourcetype=*db* OR sourcetype=*audit* | stats count by sourcetype, database_name | head 15',
    expected: 'Audit or diagnostic events with database and user context.',
    troubleshooting: 'Validate DB Connect JDBC drivers, read-only accounts, and input schedules.',
  },
  {
    name: 'OT / ICS',
    match: /ics|scada|ot_|industrial/i,
    spl: 'index=main sourcetype=* | stats count by sourcetype, device_type | head 15',
    expected: 'OT security or historian events with device identifiers.',
    troubleshooting: 'Coordinate with OT engineering for passive collection paths and parsing.',
  },
];

const CATEGORY_DEFAULT_METHOD = {
  'Cloud/SaaS Services': 'cloud_addon',
  'Server': 'forwarder',
  Database: 'db_connect',
  Application: 'forwarder',
  'End-User Support': 'forwarder',
  'Security & Compliance': 'api',
  Networking: 'syslog',
  Storage: 'syslog',
  'OT/ICS': 'syslog',
  'Application Development': 'api',
  'Business Services': 'forwarder',
};

/** Per-source validation SPL — avoids generic o365/aws/azure searches on unrelated sources. */
const SOURCE_VALIDATION_BY_ID = {
  active_directory:
    'index={index} sourcetype="WinEventLog:Security" EventCode=4624\n| stats count by Account_Name, host | head 20',
  asset_cmdb:
    'index={index} sourcetype=*cmdb* OR sourcetype=*asset*\n| stats count by sourcetype, asset_id | head 15',
  edr:
    'index={index} sourcetype=*crowdstrike* OR sourcetype=*falcon* OR vendor_product="CrowdStrike Falcon"\n| stats count by event_type, action, severity | head 20',
  firewalls:
    'index={index} sourcetype=*pan* OR sourcetype=*firewall*\n| stats count by action, src_ip, dest_ip | head 20',
  dns: 'index={index} sourcetype=*dns*\n| stats count by query, reply_code | head 20',
  saas_sso:
    'index={index} sourcetype="OktaIM2:log" OR sourcetype="okta:*"\n| stats count by eventType, actor.displayName | head 20',
  saas_office:
    'index={index} sourcetype="o365:management:activity"\n| stats count by Workload, Operation | head 20',
  windows_servers:
    'index={index} sourcetype="WinEventLog:*"\n| stats count by sourcetype, host | head 20',
  vuln_mgmt:
    'index={index} sourcetype=*tenable* OR sourcetype=*qualys* OR sourcetype=*vuln*\n| stats count by severity, plugin_id | head 20',
  proxy:
    'index={index} sourcetype=*zscaler* OR sourcetype=*proxy*\n| stats count by action, url_category | head 20',
  vpn: 'index={index} sourcetype=*vpn*\n| stats count by action, user | head 20',
  ids_ips:
    'index={index} sourcetype=*ids* OR sourcetype=*ips*\n| stats count by signature, severity | head 20',
  email:
    'index={index} sourcetype=*email* OR sourcetype=*proofpoint*\n| stats count by action, recipient | head 20',
  iaas:
    'index={index} sourcetype="aws:cloudtrail"\n| stats count by eventName, userIdentity.type | head 20',
  iaas_containers:
    'index={index} sourcetype="kube:*" OR sourcetype="kubernetes:*"\n| stats count by sourcetype, cluster_name | head 20',
  saas_crm:
    'index={index} sourcetype=*salesforce* OR sourcetype=*crm*\n| stats count by sourcetype, user | head 15',
  saas_general:
    'index={index} sourcetype=*saas*\n| stats count by sourcetype, app | head 15',
};

const SOURCE_METHOD_BY_ID = {
  edr: { methodKey: 'api', methodLabel: 'API / modular input (vendor add-on / FDR where applicable)' },
  saas_sso: { methodKey: 'api', methodLabel: 'IdP API or supported add-on (Okta, Entra ID, Ping)' },
  saas_office: {
    methodKey: 'cloud_addon',
    methodLabel: 'Microsoft 365 / Cloud Services add-on (API-based collection)',
  },
  iaas_containers: {
    methodKey: 'otel',
    methodLabel: 'OpenTelemetry Collector, Splunk Connect for Kubernetes, or HEC',
  },
  vuln_mgmt: { methodKey: 'api', methodLabel: 'Tenable / Qualys / Rapid7 API or supported add-on' },
  saas_crm: { methodKey: 'api', methodLabel: 'Vendor API or supported SaaS add-on' },
  asset_cmdb: { methodKey: 'api', methodLabel: 'CMDB / asset API export or modular input' },
  active_directory: {
    methodKey: 'forwarder',
    methodLabel: 'Universal Forwarder with Splunk Add-on for Microsoft Windows',
  },
  windows_servers: {
    methodKey: 'forwarder',
    methodLabel: 'Universal Forwarder with Splunk Add-on for Microsoft Windows',
  },
};

function normalizeTroubleshooting(text) {
  let t = String(text || '')
    .replace(/^If no data appears:\s*/i, '')
    .replace(/^If empty:\s*/i, '')
    .trim();
  if (!t) return 'Verify collection path, credentials, add-on, and index routing.';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function assignValidationGroup(sourceName, category = '') {
  const hay = `${sourceName} ${category}`;
  for (const g of VALIDATION_LIBRARY_GROUPS) {
    if (g.match.test(hay)) return g;
  }
  return null;
}

function resolveIndexName(sourceId, guidance) {
  const idx = guidance.defaultIndex;
  if (idx && !idx.includes('<') && !idx.includes('{')) return idx;
  return 'main';
}

function normalizeValidationSpl(template, indexName) {
  let spl = String(template || '')
    .replace(/\{index\}/g, indexName)
    .replace(/<source_index>/g, indexName);
  if (!spl.includes('|')) {
    spl = `${spl}\n| stats count by sourcetype, host | head 20`;
  }
  return spl.trim();
}

function resolveTaRecommendations(source, guidance) {
  const catalogAddons = (source.technicalAddons || []).filter(Boolean);
  const splunkApps = (source.splunkApps || [])
    .filter((a) => typeof a === 'string' && /add-on|addon|connect|db connect/i.test(a));

  const candidates = [...new Set([...catalogAddons, ...splunkApps])];
  if (candidates.length) {
    return candidates.slice(0, 4).join(' · ');
  }

  const base = guidance.ta || '';
  if (base && !/check splunkbase/i.test(base)) return base;
  return 'Install the Splunk-supported technology add-on for this source from Splunkbase.';
}

function resolveIngestMethodLabel(source, guidance) {
  if (guidance.methodLabel) return guidance.methodLabel;
  const methodKey = guidance.methodKey || CATEGORY_DEFAULT_METHOD[source.category] || guidance.method || 'syslog';
  const labels = {
    syslog: 'Syslog / Splunk Connect for Syslog',
    hec: 'HTTP Event Collector (HEC)',
    api: 'API / modular input',
    forwarder: 'Universal Forwarder',
    cloud_addon: 'Splunk Cloud add-on (vendor API)',
    sc4s: 'Splunk Connect for Syslog (SC4S)',
    sc4k: 'Splunk Connect for Kubernetes',
    otel: 'OpenTelemetry Collector',
    db_connect: 'Splunk DB Connect',
  };
  return labels[methodKey] || guidance.method || 'Syslog or Universal Forwarder';
}

/**
 * @param {object} source - catalog source row
 * @param {object} guidance - from SOURCE_GUIDANCE + INGESTION_METHODS labels
 * @param {object} [options]
 * @param {string} [options.indexName]
 */
export function enrichGuideSource(source, guidance, options = {}) {
  const indexName = options.indexName || resolveIndexName(source.id, guidance);
  const methodOverride = SOURCE_METHOD_BY_ID[source.id];
  const validationGroup = assignValidationGroup(source.name, source.category);

  const idTemplate = SOURCE_VALIDATION_BY_ID[source.id];
  let validation = normalizeValidationSpl(
    idTemplate || guidance.validationTemplate || 'index={index} sourcetype=* | stats count by sourcetype, host | head 20',
    indexName,
  );
  if (!idTemplate && validation.includes('*') && validationGroup?.spl) {
    validation = validationGroup.spl.replace(/index=main/g, `index=${indexName}`);
  }

  const ta = resolveTaRecommendations(source, guidance);
  const method =
    methodOverride?.methodLabel || guidance.methodLabel || resolveIngestMethodLabel(source, guidance);

  return {
    method,
    methodKey: methodOverride?.methodKey || guidance.methodKey || guidance.method,
    complexity: guidance.complexity || 'Medium',
    ta,
    taLinks: buildTaLinks(ta),
    permissions: sanitizeCustomerFacingText(
      guidance.permissions || 'Read-only access to logs or APIs for this source.',
    ),
    validation,
    validationExpected:
      validationGroup?.expected ||
      `Recent events from ${source.name} with expected sourcetype and host fields.`,
    validationTroubleshooting: normalizeTroubleshooting(
      validationGroup?.troubleshooting ||
        'Verify collection path, credentials, add-on, and index routing.',
    ),
    firstDashboard: guidance.firstDashboard || '',
    estimatedHours: guidance.estimatedHours || 2,
    dependsOn: guidance.dependsOn || [],
  };
}

/** @deprecated use enrichGuideSource */
export function resolveSourceOnboardingDetails(source, guidance, options = {}) {
  return enrichGuideSource(source, guidance, options);
}

export function buildTaLinks(taString) {
  if (!taString) return [];
  const parts = String(taString)
    .split(/\s*(?:·|,|\bor\b|\/)\s*/i)
    .map((p) => p.replace(/^\(?e\.g\.\s*,?\s*/i, '').replace(/[()]/g, '').trim())
    .filter((p) => p && !/vendor-specific|splunk-supported technology/i.test(p));

  const links = [];
  for (const part of parts.slice(0, 4)) {
    const resolved = resolveSplunkbaseLink(part);
    links.push({
      label: resolved?.label || part,
      url: resolved?.customerUrl || null,
    });
  }
  return links;
}

/**
 * Build rich onboarding cards from sanitized report data.
 * @param {object} data - sanitizeCustomerReportData output
 */
export function buildOnboardingCardsFromReportData(data) {
  const guideByName = new Map(
    (data.startupGuide?.onboardingSources || []).map((s) => [s.name, s]),
  );
  const ordered = data.startupSourcesOrdered?.length
    ? data.startupSourcesOrdered
    : data.startupGuide?.onboardingSources || [];

  return ordered.map((row) => {
    const guide = guideByName.get(row.name) || row;
    const validationText =
      row.validation ||
      guide.validation?.text ||
      guide.validation ||
      '';
    const spl = String(validationText)
      .replace(/<source_index>/g, 'main')
      .replace(/\{index\}/g, 'main');

    return {
      id: row.id,
      name: row.name,
      status: row.status,
      method: row.method || guide.method || '—',
      ta: row.ta || guide.ta || '',
      taLinks: row.taLinks || buildTaLinks(row.ta || guide.ta),
      permissions: row.permissions || guide.permissions || '',
      validationSpl: spl,
      validationIsExample: guide.validation?.isExample ?? /index=main sourcetype=\*/.test(spl),
      validationExpected: row.validationExpected || guide.validationExpected || '',
      validationTroubleshooting: row.validationTroubleshooting || guide.validationTroubleshooting || '',
      complexity: row.complexity || guide.complexity || '',
    };
  });
}
