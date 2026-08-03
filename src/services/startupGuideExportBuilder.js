/**
 * Builds structured content for Implementation Startup Guide PDF.
 */

import {
  sanitizeCustomerFacingText,
  truncate,
  formatIngestRangeWithUnit,
  formatDisplayDate,
  formatBulletList,
  formatNumberedList,
} from './exportShared.js';

const VALIDATION_LIBRARY_GROUPS = [
  {
    name: 'Windows / Active Directory',
    match: /active directory|windows|winevent|domain controller/i,
    purpose: 'Confirm security and system events are indexed with expected sourcetypes.',
    spl: 'index=main sourcetype="WinEventLog:Security" EventCode=4624 | stats count by Account_Name, host | head 20',
    expected: 'Recent authentication events with parseable account and host fields.',
    troubleshooting: 'Verify UF connectivity, permissions, and sourcetype assignment on domain controllers.',
  },
  {
    name: 'Firewall / VPN',
    match: /firewall|vpn|perimeter|asa|anyconnect/i,
    purpose: 'Validate perimeter and remote access telemetry.',
    spl: 'index=main sourcetype=*firewall* OR sourcetype=*vpn* | stats count by sourcetype, action | head 20',
    expected: 'Traffic or session events with action, source, and destination fields.',
    troubleshooting: 'Confirm syslog/HEC path, TA deployment, and index routing.',
  },
  {
    name: 'DNS / DHCP',
    match: /dns|dhcp/i,
    purpose: 'Validate name resolution and IP attribution context.',
    spl: 'index=main sourcetype=*dns* | stats count by query, client_ip | head 20',
    expected: 'Query or lease events suitable for investigation enrichment.',
    troubleshooting: 'Enable query logging; verify forwarder or syslog configuration.',
  },
  {
    name: 'EDR / Endpoint',
    match: /edr|endpoint|crowdstrike|defender|falcon/i,
    purpose: 'Confirm endpoint detection events are searchable.',
    spl: 'index=main sourcetype=* | stats count by sourcetype, vendor_product | head 20',
    expected: 'Detection or process events with host and severity fields.',
    troubleshooting: 'Validate API credentials, modular input schedule, and index assignment.',
  },
  {
    name: 'Email security',
    match: /email|proofpoint|mimecast|messag/i,
    purpose: 'Validate email security telemetry for phishing and policy events.',
    spl: 'index=main sourcetype=*email* | stats count by action, recipient | head 20',
    expected: 'Message or threat events with sender/recipient context.',
    troubleshooting: 'Confirm API or syslog integration and field extractions.',
  },
  {
    name: 'Cloud / SaaS',
    match: /cloud|saas|o365|m365|azure|aws|gcp|entra/i,
    purpose: 'Validate cloud audit and SaaS activity logs.',
    spl: 'index=main sourcetype=*o365* OR sourcetype=*aws* | stats count by sourcetype | head 15',
    expected: 'Recent audit events with user, action, and workload fields.',
    troubleshooting: 'Verify add-on credentials, input schedule, and time skew.',
  },
  {
    name: 'Vulnerability / Asset',
    match: /vuln|tenable|qualys|cmdb|asset/i,
    purpose: 'Validate vulnerability or asset context for enrichment.',
    spl: 'index=main sourcetype=* | stats count by sourcetype | head 10',
    expected: 'Asset or finding records with host or CVE identifiers.',
    troubleshooting: 'Confirm scan export schedule and lookup/index routing.',
  },
  {
    name: 'Linux / Network devices',
    match: /linux|router|switch|catalyst|syslog/i,
    purpose: 'Validate Linux or network device syslog ingestion.',
    spl: 'index=main | stats count by sourcetype, host | sort - count | head 20',
    expected: 'Device events with host and facility or vendor sourcetype.',
    troubleshooting: 'Check syslog receivers, time sync, and TA parsing.',
  },
];

function assignValidationGroup(sourceName, category = '') {
  const hay = `${sourceName} ${category}`;
  for (const g of VALIDATION_LIBRARY_GROUPS) {
    if (g.match.test(hay)) return g;
  }
  return null;
}

function buildSourceOnboardingCards(payload) {
  return (payload.sourceRows || []).map((row) => {
    const guide = payload.startupGuide?.sources?.find((s) => s.id === row.id);
    const spl = guide?.validation || row.guideValidation || '';
    const isTemplate = !spl || spl.includes('<source_index>') || spl.includes('{index}');
    return {
      id: row.id,
      name: row.name,
      vendor: row.vendor || '—',
      purpose: sanitizeCustomerFacingText(row.whyIncluded || guide?.notes || `Onboard ${row.name} for the selected architecture path.`),
      collectionMethod: row.collectionMethod || guide?.method || '—',
      technicalAddon: row.technicalAddon || guide?.ta || '—',
      indexNotes: 'Plan dedicated index/sourcetype with retention aligned to use case — validate with platform admin.',
      permissions: sanitizeCustomerFacingText(guide?.permissions || row.guidePermissions || 'Coordinate read access with source owner.'),
      validationSpl: isTemplate ? spl.replace('<source_index>', 'main').replace('{index}', 'main') : spl,
      validationIsExample: isTemplate,
      expectedResult: `Recent events from ${row.name} with expected fields for dashboards and detections.`,
      troubleshooting: 'If no data: verify collection method, credentials, network path, TA/add-on, and index routing.',
      caveats: row.needsReview ? 'Validation needed: confirm counts, logging scope, or vendor configuration.' : null,
      complexity: guide?.complexity || 'Medium',
      scope: row.invalidCount || row.count === 'Needs validation' ? 'Needs validation' : row.count,
    };
  });
}

function buildValidationLibrary(payload) {
  const usedGroups = new Set();
  const entries = [];

  for (const row of payload.sourceRows || []) {
    const g = assignValidationGroup(row.name, row.category);
    if (g && !usedGroups.has(g.name)) {
      usedGroups.add(g.name);
      entries.push({ ...g, fromSource: row.name });
    }
  }

  for (const entry of payload.validationEntries || []) {
    const g = assignValidationGroup(entry.sourceName);
    if (g && !usedGroups.has(g.name)) {
      usedGroups.add(g.name);
      entries.push({
        ...g,
        fromSource: entry.sourceName,
        spl: entry.splExample || g.spl,
        purpose: entry.purpose || g.purpose,
        expected: entry.expectedSignal || g.expected,
        troubleshooting: entry.troubleshooting || g.troubleshooting,
        isExample: entry.isExample,
      });
    }
  }

  if (!entries.length) {
    return VALIDATION_LIBRARY_GROUPS.slice(0, 4).map((g) => ({ ...g, isExample: true }));
  }
  return entries;
}

/**
 * @param {object} payload
 */
export function buildStartupGuideDocument(payload) {
  const plan = payload.selectedPlan;
  const totals = payload.totals || { low: 0, expected: 0, high: 0 };
  const install = payload.installationGuidance;
  const firstWave = (payload.sourceRows || []).slice(0, 6).map((r) => r.name).join(', ');

  const pages = [
    {
      id: 'implementation_summary',
      title: 'Implementation Summary',
      blocks: [
        { type: 'heading', text: 'Implementation summary' },
        { type: 'kpi_row', items: [
          { label: 'Customer', value: payload.customerName },
          { label: 'Deployment', value: payload.deploymentLabel },
          { label: 'Architecture path', value: payload.pathDisplayLabel || plan?.name },
          { label: 'Expected ingest', value: formatIngestRangeWithUnit(totals.low, totals.expected, totals.high) },
        ]},
        { type: 'paragraph', text: `First onboarding wave: ${firstWave || 'per architecture path'}.` },
        {
          type: 'paragraph',
          text: 'Objective: Onboard the selected source bundle with validated data flow, parsing, and index routing before expanding scope.',
        },
        { type: 'subheading', text: 'Required roles' },
        { type: 'bullets', items: [
          'Splunk platform administrator',
          'Source/data owner for each telemetry domain',
          'Network/security engineering for collection paths',
          'Project lead for cadence and decision tracking',
        ]},
        { type: 'subheading', text: 'Technical add-ons' },
        {
          type: 'paragraph',
          text: payload.productRecommendations?.technicalAddonsLine
            ? payload.productRecommendations.technicalAddonsLine
            : 'Install Splunk-supported add-ons for each data source before expanding correlation content.',
        },
        { type: 'subheading', text: 'Dependencies & readiness' },
        {
          type: 'paragraph',
          text: payload.productRecommendations?.dependenciesLine
            ? payload.productRecommendations.dependenciesLine
            : 'Validate CIM field extractions and content packs when premium security solutions are in scope.',
        },
        { type: 'subheading', text: 'Assumptions' },
        {
          type: 'bullets',
          items: [
            'Planning estimates require validation with customer-specific measurement before staffing commitments.',
            'Access requests and logging scope confirmations may extend the timeline.',
          ],
        },
      ],
    },
    {
      id: 'year_one_roadmap',
      title: 'Year-One Roadmap',
      blocks: [
        { type: 'heading', text: 'Part 1 — Year-one deployment plan' },
        { type: 'paragraph', text: 'Week-by-week and month-by-month cadence aligned to crawl / walk / run goals from customer intake.' },
        ...(payload.yearOnePlan?.phases || []).map((phase) => ({
          type: 'phase_card',
          period: phase.period,
          title: phase.title,
          objectives: (phase.objectives || []).slice(0, 3),
          sources: phase.sources,
          validation: phase.validation,
        })),
        { type: 'subheading', text: 'Suggested workshops' },
        { type: 'bullets', items: payload.yearOnePlan?.workshops || [] },
      ],
    },
    {
      id: 'cadence_plan',
      title: 'Cadence Plan',
      blocks: [
        { type: 'heading', text: 'Cadence plan' },
        { type: 'subheading', text: 'Meeting rhythm' },
        {
          type: 'bullets',
          items: [
            'Weekly startup calls during weeks 1–4',
            'Biweekly or monthly expansion check-ins after initial validation',
            'Executive readout after first dashboards and validation milestones',
          ],
        },
        { type: 'subheading', text: 'Before first cadence call' },
        { type: 'bullets', items: payload.cadencePlan?.beforeFirstCall || [] },
        { type: 'subheading', text: 'After each source onboarding' },
        { type: 'bullets', items: payload.cadencePlan?.afterEachSource || [] },
        { type: 'subheading', text: 'Open validation items' },
        {
          type: 'bullets',
          items: [
            ...(payload.cadencePlan?.openDecisions || []),
            ...(payload.cadencePlan?.lowConfidenceSources?.length
              ? [`Sources needing validation: ${payload.cadencePlan.lowConfidenceSources.join(', ')}`]
              : []),
          ],
        },
        { type: 'subheading', text: 'Suggested next meeting agenda' },
        { type: 'bullets', items: payload.cadencePlan?.nextAgenda || [] },
      ],
    },
    {
      id: 'deployment_setup',
      title: 'Deployment Setup',
      blocks: [
        { type: 'heading', text: 'Part 2 — Weeks 1–3 technical startup' },
        { type: 'paragraph', text: install?.overview || 'Configure collection, apps/add-ons, and validation for priority sources.' },
        { type: 'subheading', text: `Deployment setup — ${install?.label || payload.deploymentLabel}` },
        { type: 'bullets', items: install?.approach || [] },
        { type: 'subheading', text: 'Focus areas' },
        { type: 'bullets', items: install?.focusAreas || [] },
        ...(payload.deploymentType === 'onprem' || payload.deploymentType === 'hybrid'
          ? [{ type: 'subheading', text: 'Sizing notes' }, { type: 'bullets', items: [install?.referenceHardware?.summary, install?.referenceHardware?.minimumIndexer].filter(Boolean) }]
          : []),
        { type: 'subheading', text: 'Universal Forwarder deployment' },
        { type: 'numbered', items: payload.ufSteps || [] },
      ],
    },
    {
      id: 'onboarding_roadmap',
      title: 'Onboarding Roadmap',
      blocks: [
        { type: 'heading', text: 'Onboarding roadmap (weeks 1–3)' },
        ...(payload.startupPhases || []).map((phase) => ({
          type: 'phase_card',
          period: phase.title,
          title: phase.title,
          objectives: phase.tasks || [],
          sources: '',
          validation: '',
        })),
      ],
    },
    {
      id: 'source_details',
      title: 'Source Onboarding Details',
      blocks: [
        { type: 'heading', text: 'Source-by-source onboarding' },
        { type: 'source_cards', cards: buildSourceOnboardingCards(payload) },
      ],
    },
    {
      id: 'validation_library',
      title: 'Validation Search Library',
      blocks: [
        { type: 'heading', text: 'Validation search library' },
        { type: 'paragraph', text: 'Use these searches after each source is onboarded. Example SPL may use index=main — adjust to your environment.' },
        { type: 'validation_entries', entries: buildValidationLibrary(payload) },
      ],
    },
    {
      id: 'official_links',
      title: 'Official Documentation',
      blocks: [
        { type: 'heading', text: 'Official Splunk documentation' },
        { type: 'link_list', links: payload.officialLinksFull || [] },
      ],
    },
    {
      id: 'disclaimer',
      title: 'Disclaimer',
      blocks: [
        { type: 'paragraph', text: truncate(payload.disclaimerShort || payload.disclaimer, 500), small: true },
      ],
    },
  ];

  return {
    documentType: 'startup_guide',
    customerName: payload.customerName,
    generatedAt: payload.generatedAt,
    documentTitle: 'Implementation Startup Guide',
    pages,
    meta: {
      sourceCount: payload.sourceCount,
      sectionIds: pages.map((p) => p.id),
    },
  };
}
