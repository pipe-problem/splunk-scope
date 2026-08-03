/**
 * Builds structured content for Architecture Value Proposal (PDF + PPTX).
 * Does not render — only produces customer-facing document sections.
 */

import {
  sanitizeCustomerFacingText,
  truncate,
  toReadableString,
  formatIngestWithUnit,
  formatIngestRangeWithUnit,
  formatDisplayDate,
} from './exportShared.js';
import { DEPLOYMENT_LABELS } from './exportDesignTokens.js';
import { getCustomerFacingGoalText } from '../utils/goalPresets.js';

const CAPABILITY_NARRATIVES = {
  'Identity and Access': {
    understand: 'Who signed in, from where, with what outcome, and whether access patterns are abnormal.',
    value: 'Faster account compromise investigations and stronger access governance evidence.',
    risk: 'Reduces blind spots for credential abuse, privilege escalation, and unauthorized access.',
  },
  'Endpoint and Server': {
    understand: 'Process, file, and host activity that indicates compromise or policy violations.',
    value: 'Endpoint context enriches every security investigation and executive incident briefing.',
    risk: 'Reduces time to detect malware, lateral movement, and unauthorized changes on servers and workstations.',
  },
  'Network and Perimeter': {
    understand: 'Perimeter traffic, VPN sessions, DNS, and network device activity tied to users and assets.',
    value: 'Connects network events to identity and endpoint context for end-to-end investigations.',
    risk: 'Improves detection of exfiltration, command-and-control, and policy violations at the edge.',
  },
  'Email / SaaS / Cloud': {
    understand: 'Collaboration, cloud control plane, and SaaS audit activity alongside traditional logs.',
    value: 'Supports cloud and productivity security use cases without separate analytics tools.',
    risk: 'Reduces gaps for business email compromise, OAuth abuse, and misconfiguration in cloud services.',
  },
  'Risk and Context': {
    understand: 'Vulnerabilities, assets, threat intelligence, and CMDB context alongside security events.',
    value: 'Prioritizes work by connecting detections to asset criticality and exposure.',
    risk: 'Reduces alert fatigue and focuses remediation on what matters most to the business.',
  },
  'Observability / IT Ops': {
    understand: 'Service health, infrastructure metrics, and application performance signals.',
    value: 'Supports IT operations and reliability outcomes alongside security monitoring.',
    risk: 'Reduces mean time to identify infrastructure or application issues affecting users.',
  },
  'Other telemetry': {
    understand: 'Additional domain-specific logs that enrich the selected use cases.',
    value: 'Extends visibility where specialized teams need unified search and reporting.',
    risk: 'Closes niche visibility gaps that otherwise require ad hoc tooling.',
  },
};

const DEFAULT_PAIN_SOLUTIONS = [
  {
    pain: 'Security and operations data scattered across siloed tools slows investigations.',
    solution:
      'Splunk Security Essentials and the InfoSec App centralize identity, network, and endpoint telemetry with prebuilt searches and dashboards.',
  },
  {
    pain: 'Manual correlation and handoffs delay incident response and executive reporting.',
    solution:
      'Splunk unified search and shared dashboards reduce console-hopping and give IT a single place to investigate alerts.',
  },
  {
    pain: 'Difficulty prioritizing risk without cross-domain context and measurable coverage.',
    solution:
      'Splunk correlates authentication, perimeter, and endpoint events so small teams can focus on what matters first.',
  },
];

const DEFAULT_PAIN_SOLUTIONS_ES = [
  {
    pain: 'Security and operations data scattered across siloed tools slows investigations.',
    solution: 'Splunk Enterprise Security centralizes CIM-normalized telemetry so analysts correlate identity, network, and endpoint context in one investigation workspace.',
  },
  {
    pain: 'Manual correlation and handoffs delay incident response and executive reporting.',
    solution: 'Splunk correlation searches, notables, and unified dashboards reduce mean time to detect and respond with searchable retained history.',
  },
  {
    pain: 'Difficulty prioritizing risk without cross-domain context and measurable coverage.',
    solution: 'Splunk risk-based alerting and asset-aware detections prioritize work using enrichment from CMDB, vulnerability, and identity context.',
  },
];

const GENERIC_SOLUTION_PATTERNS = [
  /optimized to your planning ingest budget/i,
  /enriches telemetry across \d+ domain/i,
  /^validate ingest$/i,
];

const USE_CASE_SPLUNK_SOLUTIONS = {
  foundational_security:
    'Splunk Security Essentials and the InfoSec App deliver foundational detections, dashboards, and operational security visibility without full SIEM licensing.',
  enterprise_security:
    'Splunk Enterprise Security correlation searches, notables, and risk-based alerting unify SIEM workflows for tier-1 and tier-2 analysts.',
  threat_detection:
    'Splunk Enterprise Security investigation workbench and threat-intel enrichment accelerate detection, triage, and hunt workflows.',
  identity_access:
    'CIM Authentication analytics and identity-focused correlation expose abnormal sign-in, privilege use, and access patterns across hybrid identity.',
  network_security:
    'CIM Network Traffic analytics and ES network detections correlate perimeter, VPN, DNS, and internal flow anomalies.',
  observability_itops:
    'Splunk IT Service Intelligence and infrastructure analytics connect service health signals to incident investigation context.',
};

function isGenericSolution(text) {
  const s = String(text || '').trim();
  if (!s || s.length < 24) return true;
  return GENERIC_SOLUTION_PATTERNS.some((re) => re.test(s));
}

function esTrackActive(payload) {
  const elig = payload.esEligibility || payload.appRecommendations?.esEligibility;
  if (elig && !elig.esEligible) return false;
  const apps = payload.intake?.desiredApps || [];
  const names = (payload.productRecommendations?.recommendedSolutions || []).map((r) => r.name);
  return apps.includes('enterprise_security') || names.some((n) => /enterprise security/i.test(n));
}

function observabilityInScope(payload) {
  const ids = new Set((payload.useCases || []).map((u) => u.id));
  const observabilityIds = [
    'observability_apm',
    'application_monitoring',
    'infrastructure_monitoring',
    'it_operations',
    'digital_experience',
    'kubernetes_container',
    'network_operations',
  ];
  if (observabilityIds.some((id) => ids.has(id))) return true;
  return (payload.useCases || []).some((u) => /observability|it ops|apm|infrastructure monitoring/i.test(u.name || ''));
}

function filterValueGroupsForScope(valueGroups, payload) {
  if (observabilityInScope(payload)) return valueGroups || [];
  return (valueGroups || []).filter((g) => g.name !== 'Observability / IT Ops');
}

function defaultPainSolutions(payload) {
  return esTrackActive(payload) ? DEFAULT_PAIN_SOLUTIONS_ES : DEFAULT_PAIN_SOLUTIONS;
}

function splunkSolutionForUseCase(uc, payload) {
  const id = uc?.id || '';
  if (USE_CASE_SPLUNK_SOLUTIONS[id]) {
    if (id === 'enterprise_security' && !esTrackActive(payload)) {
      return USE_CASE_SPLUNK_SOLUTIONS.foundational_security;
    }
    return USE_CASE_SPLUNK_SOLUTIONS[id];
  }

  const apps = payload.intake?.desiredApps || [];
  const names = (payload.productRecommendations?.recommendedSolutions || []).map((r) => r.name);
  if (esTrackActive(payload)) {
    if (apps.includes('enterprise_security') || names.some((n) => /enterprise security/i.test(n))) {
      return 'Splunk Enterprise Security delivers correlation, notables, and MITRE-aligned detections for the selected use cases.';
    }
  } else if (apps.includes('security_essentials') || apps.includes('infosec_app') || names.some((n) => /InfoSec|Security Essentials/i.test(n))) {
    return 'Splunk Security Essentials and the InfoSec App provide unified security visibility with prebuilt content sized for lean IT teams.';
  }
  if (apps.includes('itsi') || names.some((n) => /IT Service Intelligence/i.test(n))) {
    return 'Splunk IT Service Intelligence KPIs and service health scores operationalize SLA and incident visibility.';
  }
  if (apps.includes('machine_learning_toolkit') || apps.includes('ai_toolkit')) {
    return 'Splunk AI Toolkit baselines identity and VPN patterns to surface anomalies alongside ES detections.';
  }
  return null;
}

function splunkSolutionFromSources(payload) {
  if (!esTrackActive(payload)) {
    return 'Splunk Security Essentials and the InfoSec App tie identity, perimeter, and endpoint events into unified investigations for lean security teams.';
  }
  const rows = payload.sourceRows || [];
  const categories = new Set(rows.map((r) => r.category).filter(Boolean));
  if (categories.has('Security') || rows.some((r) => /firewall|edr|vpn|identity|active directory/i.test(r.name))) {
    return 'Splunk Enterprise Security with CIM field normalization ties identity, perimeter, VPN, and endpoint events into unified investigations.';
  }
  if (categories.has('Networking')) {
    return 'CIM Network Traffic parsing and ES network analytics correlate Cisco firewall, VPN, and flow data with identity context.';
  }
  return null;
}

function pathLabel(plan) {
  return plan?.displayLabel || plan?.name || 'Selected architecture path';
}

function enrichCapabilityCards(valueGroups, productRecommendations, payload = {}) {
  const scopedGroups = filterValueGroupsForScope(valueGroups, payload);
  const fallbackApps = [
    ...(productRecommendations?.recommendedSolutions || []).map((r) => r.name),
    ...(productRecommendations?.helpfulApps || []).map((r) => r.name),
  ].slice(0, 4);

  return (scopedGroups || []).map((g) => {
    const narrative = CAPABILITY_NARRATIVES[g.name] || CAPABILITY_NARRATIVES['Other telemetry'];
    return {
      name: g.name,
      whatSplunkHelps: narrative.understand,
      valueDelivered: narrative.value,
      riskReduced: narrative.risk,
      sourceExamples: (g.sourceNames || []).slice(0, 5),
      relatedApps: g.apps?.length ? g.apps.slice(0, 4) : fallbackApps,
      ingestContribution: g.totalIngestLabel,
      needsReview: g.needsReview,
    };
  });
}

function buildPainSolutionPairs(payload, limit = 4) {
  const pairs = [];
  const capabilityCards = enrichCapabilityCards(payload.valueGroups, payload.productRecommendations, payload);
  const discovery = payload.intake?.discoveryNotes?.trim();

  const strengthSolution = (payload.planStrengths || []).find((s) => !isGenericSolution(s));
  const sourceSolution = splunkSolutionFromSources(payload);

  if (discovery) {
    const sentences = discovery.split(/(?<=[.!?])\s+/).filter(Boolean);
    const painText = sanitizeCustomerFacingText(sentences[0] || discovery);
    const solutionFromUc = splunkSolutionForUseCase(payload.useCases?.[0], payload);
    const solutionFromCap = capabilityCards[0]
      ? `${capabilityCards[0].whatSplunkHelps} ${capabilityCards[0].valueDelivered}`
      : null;
    const solution = sanitizeCustomerFacingText(
      solutionFromUc ||
        sourceSolution ||
        strengthSolution ||
        payload.businessOutcomes?.[0] ||
        solutionFromCap ||
        defaultPainSolutions(payload)[0].solution,
    );
    if (!isGenericSolution(solution)) {
      pairs.push({ pain: painText, solution });
    }
  }

  for (const uc of payload.useCases || []) {
    if (pairs.length >= limit) break;
    const ucName = sanitizeCustomerFacingText(uc.name || toReadableString(uc));
    if (!ucName) continue;
    const mapped = splunkSolutionForUseCase(uc, payload);
    const card = capabilityCards.find((c) =>
      (c.sourceExamples || []).some((s) => s.toLowerCase().includes(ucName.toLowerCase().split(' ')[0])),
    ) || capabilityCards[pairs.length % Math.max(capabilityCards.length, 1)];
    const narrative = card || CAPABILITY_NARRATIVES['Other telemetry'];
    const solution = sanitizeCustomerFacingText(
      mapped || `${narrative.valueDelivered || narrative.value} ${narrative.riskReduced || narrative.risk}`.trim(),
    );
    if (isGenericSolution(solution)) continue;
    pairs.push({
      pain: `${ucName}: limited cross-tool visibility slows detection, investigation, and stakeholder reporting.`,
      solution,
    });
  }

  for (const label of payload.useCaseLabels || []) {
    if (pairs.length >= limit) break;
    if (pairs.some((p) => p.pain.includes(label))) continue;
    const uc = (payload.useCases || []).find((u) => u.name === label);
    const mapped = uc ? splunkSolutionForUseCase(uc, payload) : null;
    const card = capabilityCards.find((c) => c.name) || { valueDelivered: defaultPainSolutions(payload)[1].solution };
    const solution = sanitizeCustomerFacingText(mapped || card.valueDelivered);
    if (isGenericSolution(solution)) continue;
    pairs.push({
      pain: `${label}: teams lack unified search and correlation across related telemetry domains.`,
      solution,
    });
  }

  for (const card of capabilityCards) {
    if (pairs.length >= limit) break;
    if (pairs.some((p) => p.pain.toLowerCase().includes(card.name.toLowerCase()))) continue;
    const solution = sanitizeCustomerFacingText(`${card.whatSplunkHelps} ${card.valueDelivered}`);
    if (isGenericSolution(solution)) continue;
    pairs.push({
      pain: `Gaps in ${card.name.toLowerCase()} limit investigation speed and stakeholder reporting.`,
      solution,
    });
  }

  for (const fallback of defaultPainSolutions(payload)) {
    if (pairs.length >= limit) break;
    if (!pairs.some((p) => p.pain === fallback.pain)) {
      pairs.push({
        pain: sanitizeCustomerFacingText(fallback.pain),
        solution: sanitizeCustomerFacingText(fallback.solution),
      });
    }
  }

  return pairs.slice(0, limit);
}

function buildTopSourcesTable(sourceRows, limit = 15) {
  return [...(sourceRows || [])]
    .sort((a, b) => (b.ingestRange?.expected ?? 0) - (a.ingestRange?.expected ?? 0))
    .slice(0, limit)
    .map((r) => ({
      name: sanitizeCustomerFacingText(r.name),
      category: sanitizeCustomerFacingText(r.category || '—'),
      gbDay: formatIngestWithUnit(r.ingestRange?.expected ?? 0),
      needsReview: r.needsReview,
    }));
}

function buildPhased306090(payload) {
  const journey = buildPhasedJourney(payload);
  const crawl = journey.find((p) => p.phase === 'Crawl') || journey[0];
  const walk = journey.find((p) => p.phase === 'Walk') || journey[1];
  const run = journey.find((p) => p.phase === 'Run') || journey[2];

  return {
    days30: [
      ...(crawl?.bullets || []).slice(0, 3),
      crawl?.sources?.length ? `Focus sources: ${crawl.sources.slice(0, 4).join(', ')}` : null,
      (payload.forwardSteps || [])[0],
    ].filter(Boolean).map((s) => sanitizeCustomerFacingText(s)),
    days60: [
      ...(walk?.bullets || []).slice(0, 3),
      walk?.sources?.length ? `Expand to: ${walk.sources.slice(0, 4).join(', ')}` : null,
      (payload.forwardSteps || [])[2],
    ].filter(Boolean).map((s) => sanitizeCustomerFacingText(s)),
    days90: [
      ...(run?.bullets || []).slice(0, 3),
      (payload.forwardSteps || [])[4],
      (payload.nextSteps || [])[0],
    ].filter(Boolean).map((s) => sanitizeCustomerFacingText(s)),
  };
}

function buildPhasedJourney(payload) {
  const intake = payload.intake || {};
  const crawlSources = (payload.sourceRows || [])
    .filter((r) => r.status === 'current')
    .slice(0, 6)
    .map((r) => r.name);
  const futureSources = (payload.sourceRows || [])
    .filter((r) => r.status === 'future')
    .slice(0, 4)
    .map((r) => r.name);

  return [
    {
      phase: 'Crawl',
      title: 'Establish foundation',
      narrative: truncate(
        sanitizeCustomerFacingText(
          getCustomerFacingGoalText(intake, 'crawl') || 'Onboard foundational sources, first dashboards, and initial investigations.',
        ),
        280,
      ),
      bullets: [
        'Foundational identity, perimeter, and endpoint telemetry',
        'First dashboards and investigation workflows',
        'Validate parsing, indexes, and ingest assumptions',
      ],
      sources: crawlSources.length ? crawlSources : ['Core sources from selected path'],
    },
    {
      phase: 'Walk',
      title: 'Expand coverage',
      narrative: truncate(
        sanitizeCustomerFacingText(
          getCustomerFacingGoalText(intake, 'walk') || 'Add enrichment sources, risk context, and broader correlation.',
        ),
        280,
      ),
      bullets: [
        'Enrichment sources (DNS, email, vulnerability, network context)',
        'Broader correlation across domains',
        'Tune detections with stakeholder feedback',
      ],
      sources: futureSources.length ? futureSources : ['Walk-phase sources per architecture path'],
    },
    {
      phase: 'Run',
      title: 'Mature operations',
      narrative: truncate(
        sanitizeCustomerFacingText(
          getCustomerFacingGoalText(intake, 'run') || 'Automation, advanced analytics, and mature SOC or service workflows.',
        ),
        280,
      ),
      bullets: [
        'Advanced detections and executive reporting',
        'Automation and orchestration readiness where applicable',
        'Continuous validation of ingest and coverage',
      ],
      sources: ['Future expansion per business priorities'],
    },
  ];
}

function buildIngestContributors(sourceRows, limit = 6) {
  return [...(sourceRows || [])]
    .sort((a, b) => (b.ingestRange?.expected ?? 0) - (a.ingestRange?.expected ?? 0))
    .slice(0, limit)
    .map((r) => ({
      name: r.name,
      expected: r.ingestRange?.expected ?? 0,
      label: formatIngestWithUnit(r.ingestRange?.expected ?? 0),
      needsReview: r.needsReview,
    }));
}

function buildRiskTableRows(payload) {
  const structured = payload.structuredRisks || [];
  if (structured.length) {
    return structured.map((r) => ({
      severity: r.severity || 'Planning',
      description: r.title ? `${r.title}: ${r.description}` : r.description,
      mitigation: r.mitigation,
    }));
  }
  return (payload.risks || []).slice(0, 6);
}

/**
 * @param {object} payload - from buildReportExportPayload
 */
export function buildValueProposalDocument(payload) {
  const plan = payload.selectedPlan;
  const totals = payload.totals || { low: 0, expected: 0, high: 0 };
  const painPairs = buildPainSolutionPairs(payload, 4);
  const topSources = buildTopSourcesTable(payload.sourceRows, 15);
  const pathRows = payload.pathComparisonRows?.length
    ? payload.pathComparisonRows
    : [{
      name: pathLabel(plan),
      expectedGb: totals.expected,
      sourceCount: payload.sourceCount ?? 0,
      coverage: payload.coverageValidation?.overallScore ?? 0,
      selected: true,
    }];
  const phased306090 = buildPhased306090(payload);
  const riskRows = buildRiskTableRows(payload);

  const sourceCount = payload.sourceCount ?? 0;

  const fullPages = [
    {
      id: 'cover',
      title: 'Cover',
      blocks: [
        {
          type: 'cover',
          customerName: payload.customerName,
          documentTitle: 'Architecture Value Proposal',
          preparedBy: 'Cisco | Splunk Scope',
          date: formatDisplayDate(payload.generatedAt),
          deployment: payload.deploymentLabel,
          pathName: pathLabel(plan),
          kpis: [
            { label: 'Low', value: formatIngestWithUnit(totals.low) },
            { label: 'Expected', value: formatIngestWithUnit(totals.expected) },
            { label: 'High', value: formatIngestWithUnit(totals.high) },
          ],
          kpiFootnote: `Expected ingest = sum of ${sourceCount} configured source${sourceCount === 1 ? '' : 's'} (20% contingency per source).`,
        },
      ],
    },
    {
      id: 'challenges_solutions',
      title: 'Challenges and Solutions',
      blocks: [
        { type: 'heading', text: 'Your challenges - How Splunk addresses them' },
        { type: 'pain_solution_pairs', pairs: painPairs },
      ],
    },
    {
      id: 'architecture_paths',
      title: 'Architecture Paths',
      blocks: [
        { type: 'heading', text: 'Architecture path summary' },
        {
          type: 'paragraph',
          text: `Recommended path: ${pathLabel(plan)}. Compare crawl / walk / run options below — the selected path is highlighted.`,
        },
        {
          type: 'paths_table',
          rows: pathRows,
          selectedName: pathLabel(plan),
          pathFootnotes: pathRows
            .filter((r) => r.fullName && r.fullName !== r.shortName)
            .map((r) => `${r.shortName}: ${r.fullName}`),
        },
        {
          type: 'paragraph',
          text:
            sanitizeCustomerFacingText(
              payload.pathRationale || plan?.description || 'Balances coverage, ingest, and phased rollout for the stated use cases.',
            ) || 'Balances coverage, ingest, and phased rollout for the stated use cases.',
          small: true,
        },
      ],
    },
    {
      id: 'top_sources',
      title: 'Top Sources',
      blocks: [
        { type: 'heading', text: 'Top sources by planned ingest' },
        {
          type: 'paragraph',
          text: 'Expected GB/day per configured source in the selected path. Estimates include 20% planning contingency per source before summing.',
          small: true,
        },
        { type: 'sources_table', rows: topSources },
      ],
    },
    {
      id: 'risks_next_steps',
      title: 'Risks and Next Steps',
      blocks: [
        { type: 'heading', text: 'Risks & mitigations' },
        { type: 'risk_table', rows: riskRows },
        { type: 'subheading', text: 'Phased next steps' },
        { type: 'phased_next_steps', phases: phased306090 },
        {
          type: 'paragraph',
          text: truncate(payload.disclaimerShort || payload.disclaimer, 320),
          small: true,
        },
      ],
    },
  ];

  const executivePages = [
    fullPages[0],
    {
      id: 'executive_summary',
      title: 'Executive Summary',
      blocks: [
        { type: 'heading', text: 'Executive summary' },
        { type: 'pain_solution_pairs', pairs: painPairs.slice(0, 3) },
        {
          type: 'kpi_row',
          items: [
            { label: 'Expected ingest', value: formatIngestWithUnit(totals.expected) },
            { label: 'Planning range', value: formatIngestRangeWithUnit(totals.low, totals.expected, totals.high) },
            { label: 'Selected path', value: pathLabel(plan) },
            { label: 'Sources', value: String(payload.sourceCount ?? 0) },
          ],
        },
        { type: 'subheading', text: 'Immediate next steps (30 days)' },
        { type: 'bullets', items: phased306090.days30.slice(0, 4) },
        {
          type: 'paragraph',
          text: truncate(payload.disclaimerShort || payload.disclaimer, 220),
          small: true,
        },
      ],
    },
  ];

  const pages = payload.executiveSummaryOnly ? executivePages : fullPages;

  return {
    documentType: 'value_proposal',
    customerName: payload.customerName,
    generatedAt: payload.generatedAt,
    pages,
    meta: {
      pathName: pathLabel(plan),
      sourceCount: payload.sourceCount,
      sectionIds: pages.map((p) => p.id),
      executiveSummaryOnly: Boolean(payload.executiveSummaryOnly),
    },
  };
}

/** Slide-oriented summary for PPTX */
export function buildValueProposalSlideDeck(payload) {
  const doc = buildValueProposalDocument(payload);
  const totals = payload.totals || { low: 0, expected: 0, high: 0 };
  const capabilityCards = enrichCapabilityCards(payload.valueGroups, payload.productRecommendations, payload);
  const painPairs = buildPainSolutionPairs(payload, 3);

  const productBullets = [
    ...(payload.productRecommendations?.recommendedSolutions || []).slice(0, 4).map(
      (r) => `${r.name} (${r.phase}) — ${truncate(r.reason, 70)}`,
    ),
    ...(payload.productRecommendations?.helpfulApps || []).slice(0, 2).map(
      (r) => `${r.name} — ${truncate(r.reason, 60)}`,
    ),
  ];

  const sourceBundleBullets = capabilityCards.slice(0, 5).map(
    (c) => `${c.name}: ${c.sourceExamples.slice(0, 3).join(', ')} (${c.ingestContribution})`,
  );

  return {
    documentType: 'value_proposal_pptx',
    customerName: payload.customerName,
    slides: [
      {
        id: 'title',
        title: 'Customer Snapshot',
        subtitle: payload.customerName,
        bullets: [],
        kpis: [
          { label: 'Deployment', value: payload.deploymentLabel },
          { label: 'Path', value: doc.meta.pathName },
          { label: 'Expected ingest', value: formatIngestWithUnit(totals.expected) },
          { label: 'Sources', value: String(payload.sourceCount) },
        ],
      },
      {
        id: 'what_we_heard',
        title: 'What We Heard',
        bullets: painPairs.map((p) => `${truncate(p.pain, 90)} → ${truncate(p.solution, 90)}`),
      },
      {
        id: 'recommended_path',
        title: 'Recommended Splunk Path',
        highlight: doc.meta.pathName,
        body: truncate(sanitizeCustomerFacingText(payload.pathRationale || ''), 320),
        tradeoff: truncate(payload.pathTradeoff || '', 120),
        bullets: productBullets.length
          ? productBullets.slice(0, 3)
          : [],
      },
      {
        id: 'value_capability',
        title: 'Value Delivered by Capability',
        bullets: capabilityCards.slice(0, 5).map((c) => `${c.name}: ${truncate(c.valueDelivered, 90)}`),
      },
      {
        id: 'source_bundle',
        title: 'Selected Source Bundle',
        bullets: sourceBundleBullets.length ? sourceBundleBullets : [`${payload.sourceCount} sources in selected path`],
      },
      {
        id: 'ingest',
        title: 'Estimated Ingest Range',
        highlight: formatIngestWithUnit(totals.expected),
        bullets: [
          `Low ${formatIngestWithUnit(totals.low)} · High ${formatIngestWithUnit(totals.high)}`,
          'Estimates include 20% planning contingency per source',
          ...buildIngestContributors(payload.sourceRows, 3).map((c) => `${c.name}: ${c.label}`),
        ],
      },
      {
        id: 'coverage',
        title: 'Coverage and Remaining Gaps',
        coverageScore: payload.coverageValidation?.overallScore ?? 0,
        bullets: [
          ...(payload.planGaps?.length ? payload.planGaps.slice(0, 3) : ['No major gaps for selected use cases']),
          ...(payload.risks || []).slice(0, 2).map((r) => `[${r.severity}] ${truncate(r.description, 80)}`),
        ],
      },
      {
        id: 'phased',
        title: 'Phased Journey',
        bullets: buildPhasedJourney(payload).map((p) => `${p.phase}: ${p.title}`),
      },
      {
        id: 'next_steps',
        title: 'Recommended Next Steps',
        bullets: (payload.forwardSteps || []).slice(0, 5),
      },
      {
        id: 'assumptions',
        title: 'Assumptions and Validation',
        bullets: [
          'Planning estimates require customer-specific validation',
          'Not a commercial commitment or capacity guarantee',
          truncate(payload.disclaimerShort, 200),
        ],
      },
    ],
    meta: doc.meta,
  };
}
