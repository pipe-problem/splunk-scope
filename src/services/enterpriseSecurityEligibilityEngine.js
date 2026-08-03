/**
 * Holistic Enterprise Security readiness assessor.
 * Reads structured intake + narrative text; returns explainable eligibility.
 */

import { withEffectiveGoals } from '../utils/goalPresets.js';

function collectText(intake = {}) {
  const effective = withEffectiveGoals(intake);
  const parts = [
    effective.customerName,
    effective.summary,
    effective.goals,
    effective.crawlGoal,
    effective.walkGoal,
    effective.runGoal,
    effective.discoveryNotes,
    effective.useCaseNotes,
    effective.customUseCases,
    intake.budgetNotes,
    ...(intake.useCases || []).map((u) => (typeof u === 'string' ? u : u?.name || u?.label || '')),
    ...(intake.desiredApps || []),
    ...(intake.rawPriorities || []),
  ];
  return parts.filter(Boolean).join('\n');
}

function parseBudgetUsd(intake) {
  const raw = intake?.opportunityBudgetUsd;
  const amount = typeof raw === 'number' ? raw : parseFloat(String(raw || '').replace(/[,$]/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parseEmployeeCount(intake) {
  const text = collectText(intake);
  const m =
    text.match(/(\d{2,6})\s*(?:employees|staff|users|seats)/i) ||
    text.match(/~\s*(\d{2,6})\s*(?:residents|people)/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

function parseItStaffCount(intake) {
  const text = collectText(intake);
  const m =
    text.match(/(\d+)\s*(?:it\s+staff|it\s+people|person\s+it\s+team|it\s+team)/i) ||
    text.match(/it\s+is\s+(\d+)\s+people/i) ||
    text.match(/(\d+)\s+people:\s*one\s+handles/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

function parseSocAnalystCount(intake) {
  const text = collectText(intake);
  const patterns = [
    /(\d+)\s*(?:soc\s+analysts?|security\s+analysts?|dedicated\s+analysts?)/i,
    /soc\s+team\s+of\s+(\d+)/i,
    /(\d+)\s*person\s+soc/i,
    /(\d+)\s*-\s*person\s+security\s+team/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return parseInt(m[1], 10);
  }
  if (/\b24\s*\/\s*7\s+soc\b|\bmature\s+soc\b|\bdedicated\s+soc\b/i.test(text)) return 6;
  if (/\bno\s+dedicated\s+security\s+analyst\b|\bno\s+soc\b|\bnot\s+a\s+24\s*\/\s*7\s+security\s+team\b/i.test(text)) {
    return 0;
  }
  return null;
}

function parseSplunkTenureYears(intake) {
  const text = collectText(intake);
  const m =
    text.match(/splunk\s+for\s+(\d+)\s*(?:\+?\s*)?years?/i) ||
    text.match(/had\s+splunk\s+.*?(\d+)\s+years?/i) ||
    text.match(/using\s+splunk\s+.*?(\d+)\s+years?/i);
  if (m) return parseInt(m[1], 10);
  if (/\bnew\s+to\s+splunk\b|\bfirst\s+splunk\b|\bnever\s+used\s+splunk\b|\bpilot\b|\bpoc\b/i.test(text)) {
    return 0;
  }
  return null;
}

function explicitEsDesired(intake) {
  const apps = (intake.desiredApps || []).map((a) => String(a).toLowerCase());
  if (apps.some((a) => a.includes('enterprise_security') || a === 'es')) return true;
  const text = collectText(intake).toLowerCase();
  return (
    /\bsplunk\s+enterprise\s+security\b/.test(text) ||
    /\bbuying\s+enterprise\s+security\b/.test(text) ||
    /\bdeploy\s+enterprise\s+security\b/.test(text)
  );
}

/**
 * @param {object} intake
 * @returns {{
 *   esEligible: boolean,
 *   confidence: 'high'|'medium'|'low',
 *   rationale: string[],
 *   signals: { positive: string[], negative: string[] },
 * }}
 */
export function assessEnterpriseSecurityEligibility(intake = {}) {
  const text = collectText(intake).toLowerCase();
  const positive = [];
  const negative = [];
  let score = 0;

  if (explicitEsDesired(intake)) {
    positive.push('Customer explicitly selected Enterprise Security.');
    score += 4;
  }

  const budget = parseBudgetUsd(intake);
  if (budget != null) {
    if (budget >= 250000) {
      positive.push(`Planning budget (~$${Math.round(budget / 1000)}K) supports enterprise SIEM scale.`);
      score += 3;
    } else if (budget >= 120000) {
      positive.push('Budget is in a range where ES is plausible with a staffed SOC.');
      score += 1;
    } else if (budget < 80000) {
      negative.push('Planning budget is modest — foundational InfoSec is usually a better fit than ES.');
      score -= 2;
    } else {
      negative.push('Mid-range budget without clear SOC maturity rarely sustains ES operations.');
      score -= 1;
    }
  }

  const socCount = parseSocAnalystCount(intake);
  if (socCount != null) {
    if (socCount >= 5) {
      positive.push(`Security operations team size (~${socCount}) can support ES workflows.`);
      score += 4;
    } else if (socCount >= 3) {
      positive.push(`Small SOC team (${socCount}) — ES possible but needs careful scoping.`);
      score += 1;
    } else {
      negative.push(`Team size (${socCount}) is below typical ES staffing for 24/7 operations.`);
      score -= 3;
    }
  } else if (/\btwo\s+person\s+it\b|\b2\s+it\s+staff\b|\bno\s+dedicated\s+security\s+analyst\b|\bpart-time\s+security\b/i.test(text)) {
    negative.push('Intake describes a very small IT/security team — ES is usually premature.');
    score -= 3;
  }

  const itStaff = parseItStaffCount(intake);
  if (itStaff != null && itStaff <= 3 && socCount == null) {
    negative.push(`Only ~${itStaff} IT staff mentioned — limited capacity for ES tuning and response.`);
    score -= 2;
  }

  const tenure = parseSplunkTenureYears(intake);
  if (tenure != null) {
    if (tenure >= 2) {
      positive.push(`Existing Splunk experience (~${tenure} years) supports ES adoption.`);
      score += 2;
    } else if (tenure === 0) {
      negative.push('First Splunk deployment — start with Security Essentials / InfoSec before ES.');
      score -= 2;
    }
  }

  const employees = parseEmployeeCount(intake);
  if (employees != null && employees >= 2000) {
    positive.push('Large organization scale often warrants ES with proper staffing.');
    score += 1;
  } else if (employees != null && employees <= 250) {
    negative.push('Small organization — lightweight InfoSec visibility is typically the right entry point.');
    score -= 1;
  }

  if (/\bnot\s+shopping\s+for\s+premium\s+siem\b|\bwithout\s+buying\s+.*siem\b|\bnot\s+.*enterprise\s+security\b|\btoo\s+heavy\s+.*platform\b/i.test(text)) {
    negative.push('Customer narrative explicitly avoids premium SIEM / ES at this stage.');
    score -= 4;
  }

  if (/\bmature\s+soc\b|\btier-?1\s+and\s+tier-?2\s+analysts?\b|\bsecurity\s+operations\s+center\b/i.test(text) && !/\bno\s+soc\b/i.test(text)) {
    positive.push('Mature security operations language in intake.');
    score += 2;
  }

  if (/\bfoundational\s+security\b|\binfosec\b|\bsecurity\s+essentials\b|\blightweight\b/i.test(text)) {
    negative.push('Foundational / InfoSec framing — prefer Security Essentials over ES.');
    score -= 1;
  }

  const esEligible = explicitEsDesired(intake) ? score >= 0 : score >= 4;

  const rationale = [];
  if (esEligible) {
    rationale.push('Enterprise Security is appropriate given team scale, budget, and/or stated maturity.');
    if (positive.length) rationale.push(positive[0]);
  } else {
    rationale.push('Recommend Security Essentials and InfoSec App first — ES needs more team, budget, or Splunk maturity.');
    if (negative.length) rationale.push(negative[0]);
  }

  let confidence = 'medium';
  if (Math.abs(score) >= 5 || explicitEsDesired(intake)) confidence = 'high';
  else if (Math.abs(score) <= 1) confidence = 'low';

  return {
    esEligible,
    confidence,
    rationale,
    signals: { positive, negative },
    score,
  };
}
