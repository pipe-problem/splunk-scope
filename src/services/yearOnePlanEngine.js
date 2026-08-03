import { getCustomerFacingGoalText } from '../utils/goalPresets.js';

function formatSourceList(sources = [], limit = 6) {
  return sources
    .slice(0, limit)
    .map((s) => s.name || s.id)
    .join(', ');
}

/**
 * @param {object} params
 * @param {object} params.intake
 * @param {object} params.selectedPlan
 * @param {object} [params.startupGuide]
 * @returns {{ phases: object[], workshops: string[], cadenceCheckpoints: string[] }}
 */
export function buildYearOneDeploymentPlan({ intake = {}, selectedPlan = {}, startupGuide = {} }) {
  const currentSources = (selectedPlan.sources || []).filter(
    (s) => (startupGuide.sources || []).find((g) => g.id === s.id)?.status === 'current' ||
      !startupGuide.sources?.length,
  );
  const names = currentSources.map((s) => s.name).slice(0, 12);
  const crawl = getCustomerFacingGoalText(intake, 'crawl') || 'Establish foundational visibility for priority use cases.';
  const walk = getCustomerFacingGoalText(intake, 'walk') || 'Expand coverage and enrichment sources.';
  const run = getCustomerFacingGoalText(intake, 'run') || 'Mature detections, dashboards, and operational processes.';

  const phases = [
    {
      period: 'Week 0–1',
      title: 'Prepare & align',
      objectives: [
        'Confirm project roles, source owners, and Splunk platform access',
        'Validate index/sourcetype naming and retention with stakeholders',
        'Review architecture path selection and onboarding sequence',
      ],
      sources: 'Planning only — no production ingest yet',
      validation: 'Kickoff workshop complete; access requests submitted',
    },
    {
      period: 'Week 1–3',
      title: 'Foundational install & onboarding',
      objectives: [
        'Deploy Universal Forwarders / HEC / syslog collection as required',
        'Install Splunk apps and add-ons for priority sources',
        `Onboard crawl-phase sources: ${formatSourceList(currentSources.slice(0, 4)) || 'per architecture path'}`,
      ],
      sources: formatSourceList(currentSources.slice(0, 5)) || 'Core identity, perimeter, endpoint sources',
      validation: 'Each onboarded source returns events in expected index/sourcetype within 24h',
    },
    {
      period: 'Month 1',
      title: 'Validate & first dashboards',
      objectives: [
        'Run validation searches per source; document parsing gaps',
        'Enable first dashboards / ES content for primary use cases',
        crawl.slice(0, 120),
      ],
      sources: 'Stabilize crawl bundle before adding enrichment',
      validation: 'Coverage score reviewed; ingest within planning range',
    },
    {
      period: 'Month 2–3',
      title: 'Enrichment & walk expansion',
      objectives: [
        walk.slice(0, 120),
        'Add DNS, DHCP, vulnerability, or network enrichment as planned',
        'Tune alerts and correlation searches with SOC feedback',
      ],
      sources: formatSourceList(currentSources.slice(4, 10)) || 'Walk-phase sources from architecture path',
      validation: 'Investigation workflows tested with cross-source correlation',
    },
    {
      period: 'Month 3–6',
      title: 'Expanded use cases',
      objectives: [
        'Onboard remaining planned sources within ingest headroom',
        'Expand detection content and executive reporting',
        'Conduct mid-point architecture review with customer stakeholders',
      ],
      sources: 'Remaining path sources and approved future-phase items',
      validation: 'Use-case coverage targets met or gaps documented',
    },
    {
      period: 'Month 6–12',
      title: 'Optimize & mature',
      objectives: [
        run.slice(0, 120),
        'Optimize indexes, parsing, and search performance',
        'Establish ongoing cadence for content updates and ingest validation',
      ],
      sources: 'Future/context sources only after crawl/walk stability',
      validation: 'Year-one maturity checkpoint — roadmap for year two',
    },
  ];

  const workshops = [
    'Week 0: Architecture & onboarding kickoff (2h)',
    'Month 1: Validation & dashboard review (90 min)',
    'Month 3: Detection tuning working session (2h)',
    'Month 6: Coverage & ingest reconciliation (90 min)',
    'Month 12: Maturity & expansion planning (2h)',
  ];

  const cadenceCheckpoints = [
    'Before first ingest: confirm collection methods and credentials',
    'After each source onboarded: run validation SPL and record event counts',
    'Monthly: reconcile ingest GB/day vs planning estimates',
    'Quarterly: review coverage gaps and path adjustments',
    'Document open validation items before each cadence call',
  ];

  return { phases, workshops, cadenceCheckpoints };
}
