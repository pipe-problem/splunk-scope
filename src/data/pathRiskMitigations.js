/**
 * UI-only mapping from planEngine risk strings → structured cards for Paths page.
 * Does not modify planEngine packing logic.
 */

import { formatDomainForCustomer } from '../services/coverageEngine.js';

const RISK_PATTERNS = [
  {
    test: (t) => /required focus area/i.test(t),
    title: 'Coverage gaps remain',
    impact: 'Selected use cases may not be fully supported until additional telemetry is onboarded.',
    buildMitigation: (ctx) => {
      const gaps = (ctx.validation?.gaps || []).slice(0, 4);
      const gapLabels = gaps.map(formatDomainForCustomer).join(', ');
      return gapLabels
        ? `Phase 2 sources: prioritize ${gapLabels}. Validate availability and ingest with the customer in a discovery workshop.`
        : 'Phase 2 sources: review Coverage page gaps and add high-impact sources in the next rollout wave.';
    },
    showCoverageLink: true,
  },
  {
    test: (t) => /unvalidated dependenc/i.test(t),
    title: 'Unvalidated source dependencies',
    impact: 'Some sources rely on prerequisites (agents, network paths, or upstream systems) that have not been confirmed.',
    buildMitigation: () =>
      'Validate with a technical workshop: confirm collection method, agent deployment, and firewall/syslog paths before committing to timeline.',
    showCoverageLink: false,
  },
  {
    test: (t) => /recommended domains without coverage/i.test(t),
    title: 'Recommended domains not yet covered',
    impact: 'Optional but valuable telemetry domains are missing — limiting advanced analytics and correlation.',
    buildMitigation: (ctx) => {
      const warnings = (ctx.validation?.warnings || []).slice(0, 3);
      const hint = warnings.length ? warnings[0] : 'Review recommended domains on the Coverage page.';
      return `${hint} Plan a Phase 2 expansion once foundational sources are stable.`;
    },
    showCoverageLink: true,
  },
];

/**
 * @param {string} riskText
 * @param {{ validation?: { gaps?: string[], warnings?: string[] }, plan?: object }} ctx
 */
export function mapPlanRiskToCard(riskText, ctx = {}) {
  const text = String(riskText || '').trim();
  for (const pattern of RISK_PATTERNS) {
    if (pattern.test(text)) {
      return {
        id: pattern.title,
        title: pattern.title,
        impact: pattern.impact,
        mitigation: pattern.buildMitigation(ctx),
        showCoverageLink: pattern.showCoverageLink,
        severity: 'planning',
        raw: text,
      };
    }
  }
  return {
    id: text.slice(0, 40),
    title: 'Planning consideration',
    impact: text,
    mitigation: 'Discuss with the customer during discovery to confirm scope, dependencies, and rollout sequencing.',
    showCoverageLink: false,
    severity: 'medium',
    raw: text,
  };
}

/**
 * @param {string[]} riskStrings
 * @param {{ validation?: object, plan?: object }} ctx
 * @param {number} [max=5]
 */
export function buildStructuredPlanRisks(riskStrings, ctx = {}, max = 5) {
  const list = riskStrings?.length ? riskStrings : [];
  if (list.length === 0) {
    return [{
      id: 'none',
      title: 'No major risks flagged',
      impact: 'This path meets current coverage thresholds for the selected use cases at planning level.',
      mitigation: 'Re-validate after customer-specific sizing and before final architecture sign-off.',
      showCoverageLink: false,
      severity: 'planning',
      raw: '',
    }];
  }
  return list.slice(0, max).map((r) => mapPlanRiskToCard(r, ctx));
}
