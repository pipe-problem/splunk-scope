/**
 * Startup Guide Engine
 * Generates a customer-facing data onboarding plan from the active session.
 * Produces step-by-step ingestion guidance, timeline, TAs, and validation queries.
 */
import { enrichGuideSource } from './sourceOnboardingResolver.js';

/**
 * @typedef {{id: string, name: string, category?: string}} Source
 * @typedef {{status?: 'current'|'future'|'not_applicable', owner?: string, notes?: string}} SourceState
 * @typedef {{id: string, name: string}} UseCase
 * @typedef {Record<string, string>} IndexMap - Maps source IDs to customer-specific index names
 *
 * @typedef {Object} GuideSource
 * @property {string} id
 * @property {string} name
 * @property {string} status
 * @property {string} category
 * @property {string} method
 * @property {string} methodKey
 * @property {string} complexity
 * @property {string} ta
 * @property {string} taAppId - Reference to splunkApps.json app ID
 * @property {string} permissions
 * @property {string} validation
 * @property {string} firstDashboard
 * @property {string} owner
 * @property {string} notes
 * @property {number} estimatedHours
 * @property {string[]} dependsOn - Source IDs that should be onboarded first
 *
 * @typedef {Object} StartupGuide
 * @property {Object} metadata
 * @property {GuideSource[]} sources
 * @property {GuideSource[]} currentSources
 * @property {GuideSource[]} futureSources
 * @property {Object[]} timeline
 * @property {Object[]} questions
 * @property {string[]} prerequisites
 * @property {Object[]} checkpoints
 * @property {Object[]} useCases
 */

const INGESTION_METHODS = {
  syslog: { label: 'Syslog / Splunk Connect for Syslog', complexity: 'Low', estimatedHours: 2 },
  hec: { label: 'HTTP Event Collector (HEC)', complexity: 'Low', estimatedHours: 1 },
  api: { label: 'API / Modular Input', complexity: 'Medium', estimatedHours: 4 },
  forwarder: { label: 'Universal Forwarder', complexity: 'Low', estimatedHours: 2 },
  cloud_addon: { label: 'Splunk Cloud Add-on', complexity: 'Medium', estimatedHours: 4 },
  sc4s: { label: 'Splunk Connect for Syslog (SC4S)', complexity: 'Low', estimatedHours: 2 },
  sc4k: { label: 'Splunk Connect for Kubernetes', complexity: 'Medium', estimatedHours: 6 },
  otel: { label: 'OpenTelemetry Collector', complexity: 'Medium', estimatedHours: 6 },
  db_connect: { label: 'Splunk DB Connect', complexity: 'High', estimatedHours: 8 },
}

const SOURCE_GUIDANCE = {
  active_directory: {
    method: 'forwarder',
    taAppId: 'add_on_windows',
    ta: 'Splunk Add-on for Microsoft Active Directory',
    permissions: 'Domain read access, Event Log Reader group membership on DCs',
    validationTemplate: 'index={index} sourcetype="WinEventLog:Security" EventCode=4624 | stats count by Account_Name',
    defaultIndex: 'wineventlog',
    firstDashboard: 'ES Identity Intelligence or AD Health Dashboard',
    dependsOn: [],
  },
  firewalls: {
    method: 'syslog',
    taAppId: 'add_on_palo_alto_networks',
    ta: 'Vendor-specific TA (e.g., Palo Alto Networks Add-on, Fortinet Add-on)',
    permissions: 'Syslog forwarding configuration on firewall management console',
    validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, action',
    defaultIndex: 'firewall',
    firstDashboard: 'Enterprise Security Network dashboards',
    dependsOn: [],
  },
  windows_servers: {
    method: 'forwarder',
    taAppId: 'add_on_windows',
    ta: 'Splunk Add-on for Microsoft Windows',
    permissions: 'Local admin or Event Log Reader on target servers',
    validationTemplate: 'index={index} sourcetype="WinEventLog:*" | stats count by sourcetype, host',
    defaultIndex: 'wineventlog',
    firstDashboard: 'Windows Infrastructure Overview',
    dependsOn: [],
  },
  edr: {
    method: 'api',
    taAppId: 'add_on_crowdstrike',
    ta: 'Vendor-specific TA (CrowdStrike, Defender, SentinelOne)',
    permissions: 'API key with read-only access to detection and event data',
    validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, vendor',
    defaultIndex: 'edr',
    firstDashboard: 'Endpoint Investigation or ES Endpoint dashboards',
    dependsOn: [],
  },
  m365: {
    method: 'cloud_addon',
    taAppId: 'add_on_microsoft_cloud_services',
    ta: 'Splunk Add-on for Microsoft Cloud Services',
    permissions: 'Azure AD App Registration with audit log read permissions',
    validationTemplate: 'index={index} sourcetype="o365:management:activity" | stats count by Workload',
    defaultIndex: 'o365',
    firstDashboard: 'Microsoft 365 Security & Compliance',
    dependsOn: [],
  },
  sso_okta: {
    method: 'api',
    taAppId: 'add_on_okta',
    ta: 'Splunk Add-on for Okta Identity Cloud',
    permissions: 'Okta API token with read-only admin access',
    validationTemplate: 'index={index} sourcetype="OktaIM2:log" | stats count by eventType',
    defaultIndex: 'okta',
    firstDashboard: 'Okta Identity dashboards or ES Access Center',
    dependsOn: [],
  },
  saas_sso: {
    method: 'api',
    taAppId: 'add_on_okta',
    ta: 'Splunk Add-on for Okta Identity Cloud (or Entra ID / Ping vendor add-on)',
    permissions: 'IdP API credentials with read-only access to sign-in and admin audit logs',
    validationTemplate: 'index={index} sourcetype="OktaIM2:log" OR sourcetype="okta:*" | stats count by eventType',
    defaultIndex: 'okta',
    firstDashboard: 'Identity Provider Activity or ES Access Center',
    dependsOn: ['active_directory'],
  },
  saas_office: {
    method: 'cloud_addon',
    taAppId: 'add_on_microsoft_cloud_services',
    ta: 'Splunk Add-on for Microsoft Office 365 / Microsoft Cloud Services',
    permissions: 'Azure AD app registration with Office 365 management API read permissions',
    validationTemplate: 'index={index} sourcetype="o365:management:activity" | stats count by Workload',
    defaultIndex: 'o365',
    firstDashboard: 'Microsoft 365 Security & Compliance',
    dependsOn: ['saas_sso'],
  },
  asset_cmdb: {
    method: 'api',
    taAppId: null,
    ta: 'ServiceNow CMDB export, asset API, or Splunk-supported CMDB add-on',
    permissions: 'Read-only API or scheduled export access to asset and identity lists',
    validationTemplate: 'index={index} sourcetype=*cmdb* | stats count by sourcetype, asset_id',
    defaultIndex: 'assets',
    firstDashboard: 'Asset and Identity Context dashboards',
    dependsOn: [],
  },
  vuln_mgmt: {
    method: 'api',
    taAppId: null,
    ta: 'Tenable, Qualys, or Rapid7 supported add-on / API modular input',
    permissions: 'Read-only API credentials for vulnerability findings export',
    validationTemplate: 'index={index} sourcetype=*tenable* OR sourcetype=*vuln* | stats count by severity',
    defaultIndex: 'vuln',
    firstDashboard: 'Vulnerability Posture dashboards',
    dependsOn: ['asset_cmdb'],
  },
  iaas: {
    method: 'cloud_addon',
    taAppId: 'add_on_aws',
    ta: 'Splunk Add-on for Amazon Web Services (or Azure/GCP equivalent)',
    permissions: 'Cloud IAM role with read-only access to audit and security logs',
    validationTemplate: 'index={index} sourcetype="aws:cloudtrail" | stats count by eventName',
    defaultIndex: 'aws',
    firstDashboard: 'Cloud Security dashboards',
    dependsOn: [],
  },
  iaas_containers: {
    method: 'otel',
    taAppId: 'connect_kubernetes',
    ta: 'Splunk Connect for Kubernetes / OpenTelemetry Collector',
    permissions: 'Kubernetes RBAC for log collection and HEC endpoint access',
    validationTemplate: 'index={index} sourcetype="kube:*" | stats count by sourcetype, cluster_name',
    defaultIndex: 'kubernetes',
    firstDashboard: 'Container platform monitoring',
    dependsOn: ['iaas'],
  },
  dns: {
    method: 'syslog',
    taAppId: null,
    ta: 'Splunk Add-on for Infoblox or Microsoft DNS',
    permissions: 'DNS query logging enabled, syslog forwarding or forwarder on DNS server',
    validationTemplate: 'index={index} sourcetype=* | stats count by query_type, reply_code',
    defaultIndex: 'dns',
    firstDashboard: 'DNS Activity and Anomaly Detection',
    dependsOn: ['firewalls'],
  },
  proxy: {
    method: 'syslog',
    taAppId: null,
    ta: 'Vendor-specific TA (Zscaler, Bluecoat, Squid)',
    permissions: 'Proxy admin access for log forwarding configuration',
    validationTemplate: 'index={index} sourcetype=* | stats count by action, category',
    defaultIndex: 'proxy',
    firstDashboard: 'Web Proxy Activity dashboards',
    dependsOn: ['firewalls'],
  },
  cloud_aws: {
    method: 'cloud_addon',
    taAppId: 'add_on_aws',
    ta: 'Splunk Add-on for Amazon Web Services',
    permissions: 'IAM role with CloudTrail, VPC Flow Logs, and GuardDuty read access',
    validationTemplate: 'index={index} sourcetype="aws:cloudtrail" | stats count by eventName, userIdentity.type',
    defaultIndex: 'aws',
    firstDashboard: 'AWS Security and CloudTrail dashboards',
    dependsOn: [],
  },
  cloud_azure: {
    method: 'cloud_addon',
    taAppId: 'add_on_microsoft_cloud_services',
    ta: 'Splunk Add-on for Microsoft Azure',
    permissions: 'Azure Event Hub with Diagnostic Settings configured',
    validationTemplate: 'index={index} sourcetype="mscs:azure:*" | stats count by sourcetype',
    defaultIndex: 'azure',
    firstDashboard: 'Azure Activity and Security dashboards',
    dependsOn: [],
  },
  cloud_gcp: {
    method: 'cloud_addon',
    taAppId: null,
    ta: 'Splunk Add-on for Google Cloud Platform',
    permissions: 'GCP Pub/Sub subscription with logging sink configured',
    validationTemplate: 'index={index} sourcetype="google:gcp:*" | stats count by sourcetype',
    defaultIndex: 'gcp',
    firstDashboard: 'GCP Audit and Security dashboards',
    dependsOn: [],
  },
  kubernetes: {
    method: 'sc4k',
    taAppId: 'connect_kubernetes',
    ta: 'Splunk OpenTelemetry Collector for Kubernetes',
    permissions: 'RBAC access to cluster logs and metrics, HEC endpoint configured',
    validationTemplate: 'index={index} sourcetype="kube:*" | stats count by sourcetype, cluster_name',
    defaultIndex: 'kubernetes',
    firstDashboard: 'Kubernetes Monitoring dashboards',
    dependsOn: [],
  },
  databases: {
    method: 'db_connect',
    taAppId: 'db_connect',
    ta: 'Splunk DB Connect or vendor-specific TA',
    permissions: 'Read-only database user with audit log access',
    validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, database_name',
    defaultIndex: 'database',
    firstDashboard: 'Database Activity Monitoring',
    dependsOn: [],
  },
  linux_servers: {
    method: 'forwarder',
    taAppId: 'add_on_unix_linux',
    ta: 'Splunk Add-on for Unix and Linux',
    permissions: 'Root or sudoer access for forwarder installation',
    validationTemplate: 'index={index} sourcetype="linux_secure" OR sourcetype="syslog" | stats count by host, sourcetype',
    defaultIndex: 'os',
    firstDashboard: 'Unix/Linux Infrastructure Overview',
    dependsOn: [],
  },
  vpn: {
    method: 'syslog',
    taAppId: 'add_on_cisco_security',
    ta: 'Vendor-specific TA (Cisco AnyConnect, Palo Alto GlobalProtect, Pulse Secure)',
    permissions: 'VPN concentrator admin access for syslog forwarding',
    validationTemplate: 'index={index} sourcetype=* | stats count by action, user',
    defaultIndex: 'vpn',
    firstDashboard: 'VPN Activity and Access dashboards',
    dependsOn: ['firewalls'],
  },
  switches: {
    method: 'syslog',
    taAppId: 'add_on_cisco_security',
    ta: 'Splunk Add-on for Cisco, Arista, or vendor-specific TA',
    permissions: 'Switch management access for syslog configuration',
    validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, host',
    defaultIndex: 'network',
    firstDashboard: 'Network Infrastructure Overview',
    dependsOn: [],
  },
  routers: {
    method: 'syslog',
    taAppId: 'add_on_cisco_security',
    ta: 'Splunk Add-on for Cisco IOS or vendor-specific TA',
    permissions: 'Router management access for syslog forwarding',
    validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, host',
    defaultIndex: 'network',
    firstDashboard: 'Network Infrastructure Overview',
    dependsOn: [],
  },
  loadbalancer: {
    method: 'syslog',
    taAppId: null,
    ta: 'Vendor-specific TA (F5, Citrix NetScaler, HAProxy)',
    permissions: 'Load balancer admin access for syslog/API configuration',
    validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, virtual_server',
    defaultIndex: 'network',
    firstDashboard: 'Application Delivery dashboards',
    dependsOn: [],
  },
  desktops: {
    method: 'forwarder',
    taAppId: 'add_on_windows',
    ta: 'Splunk Add-on for Microsoft Windows',
    permissions: 'Endpoint management deployment (SCCM, Intune, GPO)',
    validationTemplate: 'index={index} host=* sourcetype="WinEventLog:Security" | stats count by host',
    defaultIndex: 'wineventlog',
    firstDashboard: 'Endpoint Security Overview',
    dependsOn: ['windows_servers'],
  },
  ids_ips: {
    method: 'syslog',
    taAppId: null,
    ta: 'Vendor-specific TA (Snort, Suricata, Cisco FirePOWER)',
    permissions: 'IPS/IDS management console access for syslog forwarding',
    validationTemplate: 'index={index} sourcetype=* | stats count by signature, severity',
    defaultIndex: 'ids',
    firstDashboard: 'Intrusion Detection dashboards or ES Network',
    dependsOn: ['firewalls'],
  },
  ndr: {
    method: 'api',
    taAppId: null,
    ta: 'Vendor-specific TA (ExtraHop, Vectra, Darktrace)',
    permissions: 'API key with read-only access to detection and metadata exports',
    validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, detection_type',
    defaultIndex: 'ndr',
    firstDashboard: 'Network Detection & Response dashboards',
    dependsOn: ['firewalls'],
  },
  dlp: {
    method: 'api',
    taAppId: null,
    ta: 'Vendor-specific TA (Symantec DLP, Microsoft Purview)',
    permissions: 'DLP management console API access with read-only permissions',
    validationTemplate: 'index={index} sourcetype=* | stats count by policy_name, action',
    defaultIndex: 'dlp',
    firstDashboard: 'Data Loss Prevention dashboards',
    dependsOn: [],
  },
  email: {
    method: 'forwarder',
    taAppId: null,
    ta: 'Splunk Add-on for Microsoft Exchange or mail gateway TA',
    permissions: 'Exchange admin or mail gateway syslog forwarding access',
    validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, action',
    defaultIndex: 'email',
    firstDashboard: 'Email Security and ES Email dashboards',
    dependsOn: ['m365'],
  },
  web_servers: {
    method: 'forwarder',
    taAppId: null,
    ta: 'Splunk Add-on for Apache Web Server or Nginx',
    permissions: 'Read access to web server log directories',
    validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, status',
    defaultIndex: 'web',
    firstDashboard: 'Web Server Activity dashboards',
    dependsOn: ['linux_servers'],
  },
  netflow: {
    method: 'syslog',
    taAppId: 'app_stream',
    ta: 'Splunk App for Stream or NetFlow Integrator',
    permissions: 'Router/switch flow export configuration access',
    validationTemplate: 'index={index} sourcetype=* | stats count by src_ip, dest_ip',
    defaultIndex: 'netflow',
    firstDashboard: 'Network Traffic Analysis dashboards',
    dependsOn: ['switches', 'routers'],
  },
  sase: {
    method: 'api',
    taAppId: null,
    ta: 'Vendor-specific TA (Zscaler, Palo Alto Prisma, Netskope)',
    permissions: 'SASE platform API credentials with log read access',
    validationTemplate: 'index={index} sourcetype=* | stats count by action, user',
    defaultIndex: 'sase',
    firstDashboard: 'SASE/SSE Security dashboards',
    dependsOn: [],
  },
  ics_scada: {
    method: 'syslog',
    taAppId: null,
    ta: 'Splunk Add-on for OT Security or vendor-specific TA',
    permissions: 'OT network tap or historian read access (coordinate with OT engineering)',
    validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, device_type',
    defaultIndex: 'ot',
    firstDashboard: 'OT/ICS Security Monitoring dashboards',
    dependsOn: [],
  },
  hypervisor: {
    method: 'syslog',
    taAppId: 'add_on_vmware',
    ta: 'Splunk Add-on for VMware ESXi or Hyper-V',
    permissions: 'vCenter or hypervisor host syslog forwarding access',
    validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, host',
    defaultIndex: 'virtualization',
    firstDashboard: 'Virtual Infrastructure dashboards',
    dependsOn: [],
  },
  threat_intel: {
    method: 'api',
    taAppId: 'enterprise_security',
    ta: 'Splunk ES Threat Intelligence Framework',
    permissions: 'Threat intel feed API keys or STIX/TAXII subscription credentials',
    validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, threat_type',
    defaultIndex: 'threat_intel',
    firstDashboard: 'ES Threat Intelligence dashboards',
    dependsOn: ['firewalls', 'edr'],
  },
}

const SECURITY_ONBOARDING_PRIORITY = [
  'asset_cmdb',
  'active_directory',
  'saas_sso',
  'windows_servers',
  'edr',
  'firewalls',
  'dns',
  'saas_office',
  'vuln_mgmt',
  'email',
  'proxy',
  'vpn',
  'ids_ips',
  'iaas',
  'dlp',
  'saas_general',
  'saas_crm',
  'iaas_containers',
  'iaas_instances',
  'iaas_storage',
  'database',
  'app_servers',
];

function sortStartupSourcesForDemo(sources, useCases = []) {
  const text = (useCases || []).map((u) => u.name || '').join(' ');
  const securityFocused = /threat|compliance|cloud security|siem|investigation/i.test(text);
  if (!securityFocused) return sources;
  return [...sources].sort((a, b) => {
    const ia = SECURITY_ONBOARDING_PRIORITY.indexOf(a.id);
    const ib = SECURITY_ONBOARDING_PRIORITY.indexOf(b.id);
    const ra = ia === -1 ? 500 : ia;
    const rb = ib === -1 ? 500 : ib;
    if (ra !== rb) return ra - rb;
    return (a.name || '').localeCompare(b.name || '');
  });
}

const DEFAULT_GUIDANCE = {
  method: 'syslog',
  taAppId: null,
  ta: 'Check Splunkbase for applicable TA',
  permissions: 'Read-only log or API access for this source',
  validationTemplate: 'index={index} sourcetype=* | stats count by sourcetype, host | head 20',
  defaultIndex: '<source_index>',
  firstDashboard: 'Custom dashboards based on ingested data',
  dependsOn: [],
};

/**
 * Onboarding guidance for a catalog source (used by suggested deployment path + reference library).
 * @param {string} sourceId
 */
export function getSourceOnboardingGuidance(sourceId) {
  const guidance = SOURCE_GUIDANCE[sourceId] || DEFAULT_GUIDANCE
  const method = INGESTION_METHODS[guidance.method] || INGESTION_METHODS.syslog
  return {
    ...guidance,
    methodKey: guidance.method,
    methodLabel: method.label,
    complexity: method.complexity,
    estimatedHours: method.estimatedHours,
  }
}

const COMPLEXITY_MAP = {
  Low: 1,
  Medium: 2,
  High: 3,
}

/**
 * Resolve a validation query template with the customer's index name.
 * @param {string} template
 * @param {string} index
 * @returns {string}
 */
function resolveValidationQuery(template, index) {
  return template.replace('{index}', index)
}

/**
 * Topological sort for sources with dependency ordering.
 * Sources whose dependencies appear earlier in the list are promoted.
 * Falls back to complexity sort for sources at the same dependency depth.
 * @param {GuideSource[]} sources
 * @returns {GuideSource[]}
 */
function sortByDependencies(sources) {
  const sourceIds = new Set(sources.map((s) => s.id))
  const visited = new Set()
  const result = []

  function visit(source) {
    if (visited.has(source.id)) return
    visited.add(source.id)
    for (const depId of source.dependsOn) {
      if (sourceIds.has(depId)) {
        const dep = sources.find((s) => s.id === depId)
        if (dep) visit(dep)
      }
    }
    result.push(source)
  }

  const byComplexity = [...sources].sort(
    (a, b) => (COMPLEXITY_MAP[a.complexity] || 2) - (COMPLEXITY_MAP[b.complexity] || 2)
  )
  for (const s of byComplexity) {
    visit(s)
  }
  return result
}

/**
 * Generate a full startup guide from selected sources.
 *
 * @param {Source[]} activeSources - All sources selected in the session
 * @param {Record<string, SourceState>} sourceStates - Per-source state (status, owner, notes)
 * @param {UseCase[]} useCases - Selected use cases
 * @param {string} [customerName] - Customer display name
 * @param {Object} [options] - Additional configuration
 * @param {IndexMap} [options.indexMap] - Customer-specific index name overrides keyed by source ID
 * @returns {StartupGuide|null}
 */
export function generateStartupGuide(activeSources, sourceStates, useCases, customerName, options = {}) {
  if (!Array.isArray(activeSources) || activeSources.length === 0) return null
  const safeSourceStates = sourceStates || {}
  const safeUseCases = Array.isArray(useCases) ? useCases : []
  const indexMap = options.indexMap || {}

  const guideSources = activeSources
    .filter((s) => {
      if (!s || !s.id) return false
      const ss = safeSourceStates[s.id]
      return ss?.status === 'current' || ss?.status === 'future'
    })
    .map((s) => {
      const ss = safeSourceStates[s.id] || {}
      const guidance = SOURCE_GUIDANCE[s.id] || DEFAULT_GUIDANCE
      const method = INGESTION_METHODS[guidance.method] || INGESTION_METHODS.syslog
      const index = indexMap[s.id] || guidance.defaultIndex || DEFAULT_GUIDANCE.defaultIndex
      const enriched = enrichGuideSource(s, {
        ...guidance,
        methodKey: guidance.method,
        methodLabel: method.label,
        complexity: method.complexity,
        estimatedHours: method.estimatedHours,
      }, { indexName: index.includes('<') || index.includes('{') ? 'main' : index })
      return {
        id: s.id,
        name: s.name,
        status: ss.status,
        category: s.category || 'Other',
        method: enriched.method,
        methodKey: enriched.methodKey,
        complexity: enriched.complexity,
        ta: enriched.ta,
        taAppId: guidance.taAppId || null,
        taLinks: enriched.taLinks,
        permissions: enriched.permissions,
        validation: enriched.validation,
        validationExpected: enriched.validationExpected,
        validationTroubleshooting: enriched.validationTroubleshooting,
        firstDashboard: enriched.firstDashboard,
        owner: ss.owner || '',
        notes: ss.notes || '',
        estimatedHours: enriched.estimatedHours,
        dependsOn: enriched.dependsOn,
      }
    })

  const currentSources = sortStartupSourcesForDemo(
    sortByDependencies(guideSources.filter((s) => s.status === 'current')),
    safeUseCases,
  )
  const futureSources = sortByDependencies(guideSources.filter((s) => s.status === 'future'))
  const allSorted = [...currentSources, ...futureSources]

  const deployType = options.deploymentType || options.intake?.deploymentType || ''
  const timeline = buildTimeline(currentSources, futureSources, { deploymentType: deployType })
  const questions = buildOwnershipQuestions(allSorted, safeSourceStates)
  const prerequisites = buildPrerequisites(allSorted, { deploymentType: deployType })
  const checkpoints = buildValidationCheckpoints(allSorted)

  const totalEstimatedHours = allSorted.reduce((sum, s) => sum + s.estimatedHours, 0)

  return {
    metadata: {
      customerName: customerName || 'Customer',
      generatedAt: new Date().toISOString(),
      sourceCount: allSorted.length,
      totalEstimatedHours,
      disclaimer: 'Planning-level onboarding guidance. Validate collection paths and ingest volume in your environment before production rollout.',
    },
    sources: allSorted,
    currentSources,
    futureSources,
    timeline,
    questions,
    prerequisites,
    checkpoints,
    useCases: safeUseCases.map((uc) => ({ id: uc.id, name: uc.name })),
  }
}

/**
 * Build a phased timeline that adapts to the number of sources.
 * Omits phases that have no relevant sources.
 * @param {GuideSource[]} currentSources
 * @param {GuideSource[]} futureSources
 * @returns {Object[]}
 */
export function buildTimeline(currentSources, futureSources, options = {}) {
  const isCloud = options.deploymentType === 'cloud' || options.deploymentType === 'Splunk Cloud';
  const provisionTask = isCloud
    ? 'Confirm Splunk Cloud stack access, indexes, HEC endpoints, forwarder strategy, syslog collection tier, and required access'
    : 'Provision Splunk deployment (indexers, forwarders, HEC endpoints)';
  const phases = []

  phases.push({
    phase: 'Week 0–1',
    title: 'Preparation & Discovery',
    tasks: [
      'Validate source availability and access during planning',
      'Validate logging levels and retention policies',
      provisionTask,
      'Install required Technology Add-ons (TAs) on search heads',
      ...currentSources.slice(0, 3).map((s) => `Verify ${s.name}: ${s.permissions}`),
    ],
  })

  if (currentSources.length > 0) {
    phases.push({
      phase: 'Week 1–2',
      title: 'Foundational Source Onboarding',
      tasks: [
        ...currentSources.map((s) => `Onboard ${s.name} via ${s.method}`),
        'Validate data parsing and field extraction',
        'Confirm index assignments and sourcetype mappings',
        'Run initial validation queries for each source',
      ],
    })

    phases.push({
      phase: 'Month 1',
      title: 'Validation & First Dashboards',
      tasks: [
        'Verify all foundational sources are flowing consistently',
        'Build or enable initial dashboards for each active use case',
        'Tune alert thresholds based on observed baselines',
        'Document any data quality issues or parsing gaps',
        'Train analysts on initial search and dashboard navigation',
      ],
    })
  }

  const firstBatch = futureSources.slice(0, 5)
  if (firstBatch.length > 0) {
    phases.push({
      phase: 'Month 2–3',
      title: 'Enrichment Source Onboarding',
      tasks: [
        ...firstBatch.map((s) => `Onboard ${s.name} via ${s.method}`),
        'Enable cross-source correlation rules',
        'Integrate threat intelligence feeds if applicable',
        'Build investigation workflows and playbooks',
      ],
    })
  }

  const remainingBatch = futureSources.slice(5)
  if (remainingBatch.length > 0) {
    phases.push({
      phase: 'Month 3+',
      title: 'Target State Expansion',
      tasks: [
        ...remainingBatch.map((s) => `Onboard ${s.name} via ${s.method}`),
        'Expand to target-state architecture',
        'Enable advanced analytics and ML-based detection',
        'Implement automated response workflows (SOAR)',
        'Conduct quarterly coverage review and optimization',
      ],
    })
  } else if (currentSources.length > 0 || futureSources.length > 0) {
    phases.push({
      phase: 'Ongoing',
      title: 'Optimization & Expansion',
      tasks: [
        'Conduct quarterly coverage review and optimization',
        'Evaluate additional data sources as needs evolve',
        'Enable advanced analytics and ML-based detection',
      ],
    })
  }

  return phases
}

/**
 * Build discovery questions, conditionally including infrastructure questions
 * only when relevant methods are in use.
 * @param {GuideSource[]} sources
 * @param {Record<string, SourceState>} sourceStates
 * @returns {Object[]}
 */
export function buildOwnershipQuestions(sources, sourceStates) {
  const questions = []
  const methodsInUse = new Set(sources.map((s) => s.methodKey))

  for (const s of sources) {
    const ss = sourceStates[s.id] || {}
    if (!ss.owner) {
      questions.push({
        sourceId: s.id,
        sourceName: s.name,
        question: `Confirm ownership and access path for ${s.name} log collection.`,
      })
    }
  }

  if (methodsInUse.has('syslog') || methodsInUse.has('sc4s')) {
    questions.push({ question: 'Confirm whether a centralized syslog infrastructure is already in place.' })
  }
  if (methodsInUse.has('forwarder')) {
    questions.push({ question: 'Identify change management requirements for deploying forwarders.' })
  }
  if (sources.length > 0) {
    questions.push({ question: 'Identify network segmentation constraints that affect log forwarding.' })
  }
  if (methodsInUse.has('api') || methodsInUse.has('cloud_addon')) {
    questions.push({ question: 'Confirm the preferred method for API credential management.' })
  }
  if (methodsInUse.has('hec') || methodsInUse.has('sc4k') || methodsInUse.has('otel')) {
    questions.push({ question: 'Confirm HEC endpoint availability and token provisioning process.' })
  }

  return questions
}

/**
 * Build infrastructure prerequisites based on methods in use.
 * @param {GuideSource[]} sources
 * @returns {string[]}
 */
export function buildPrerequisites(sources, options = {}) {
  const isCloud = options.deploymentType === 'cloud' || options.deploymentType === 'Splunk Cloud';
  const prereqs = new Set()
  prereqs.add(
    isCloud
      ? 'Splunk Cloud stack provisioned with required indexes and HEC endpoints'
      : 'Splunk deployment provisioned and accessible',
  )
  prereqs.add('Network connectivity validated between sources and Splunk Cloud or on-premises collectors')
  prereqs.add('Index and role structure defined in Splunk Cloud (or on-premises deployment)')

  for (const s of sources) {
    if (s.methodKey === 'syslog' || s.methodKey === 'sc4s') {
      prereqs.add('Syslog infrastructure (SC4S or rsyslog) deployed and configured')
    }
    if (s.methodKey === 'forwarder') {
      prereqs.add('Universal Forwarder deployment plan and binaries available')
    }
    if (s.methodKey === 'hec') {
      prereqs.add('HEC endpoints configured with appropriate tokens')
    }
    if (s.methodKey === 'api' || s.methodKey === 'cloud_addon') {
      prereqs.add('API credentials provisioned with least-privilege access')
    }
    if (s.methodKey === 'sc4k' || s.methodKey === 'otel') {
      prereqs.add('Kubernetes cluster access and Helm chart deployment capability')
    }
    if (s.methodKey === 'db_connect') {
      prereqs.add('Java Runtime and JDBC drivers available for Splunk DB Connect')
    }
  }

  return [...prereqs]
}

/**
 * Build per-source validation checkpoints.
 * @param {GuideSource[]} sources
 * @returns {Object[]}
 */
export function buildValidationCheckpoints(sources) {
  return sources.map((s) => ({
    sourceId: s.id,
    sourceName: s.name,
    estimatedHours: s.estimatedHours,
    checks: [
      `Data flowing: ${s.validation}`,
      `Sourcetype correct: verify CIM compliance`,
      `Field extraction working: check key fields are parsed`,
      `Volume aligned with estimate: compare actual vs. planned GB/day`,
    ],
  }))
}
