/**
 * Value Proposition Engine
 * Generates executive summaries, technical value narratives,
 * and cross-source correlation stories for planning reports.
 */

import { DOMAIN_CATEGORIES } from './coverageEngine.js'

const DOMAIN_VALUE_MAP = {
  authentication: { label: 'Identity Intelligence', category: 'security', description: 'Visibility into who is accessing resources, failed logins, MFA events, and credential-based attacks.' },
  endpoint: { label: 'Endpoint Protection', category: 'security', description: 'Process execution, file changes, and behavioral analytics across endpoints.' },
  network: { label: 'Network Visibility', category: 'security', description: 'Traffic analysis, anomaly detection, lateral movement identification.' },
  perimeter_control: { label: 'Perimeter Defense', category: 'security', description: 'Firewall, IPS/IDS, and perimeter threat intelligence.' },
  remote_access: { label: 'Remote Access Security', category: 'security', description: 'VPN, proxy, and remote session monitoring for distributed workforces.' },
  threat_enrichment: { label: 'Threat Intelligence', category: 'security', description: 'IOC matching, threat feeds, and enrichment for faster triage.' },
  identity_governance: { label: 'Identity Governance', category: 'security', description: 'Access reviews, privilege tracking, and identity lifecycle.' },
  vulnerability_asset: { label: 'Asset & Vulnerability Management', category: 'security', description: 'Risk-based vulnerability prioritization correlated to active threats.' },
  email_collaboration: { label: 'Email Security', category: 'security', description: 'Phishing detection, email flow analysis, collaboration monitoring.' },
  cloud_control_plane: { label: 'Cloud Security Posture', category: 'security', description: 'Cloud provider audit trails, configuration monitoring, compliance.' },
  saas_activity: { label: 'SaaS Activity Monitoring', category: 'security', description: 'User activity across SaaS platforms, shadow IT detection.' },
  infrastructure_metrics: { label: 'Infrastructure Performance', category: 'observability', description: 'CPU, memory, disk, and network metrics for capacity planning.' },
  application_logs: { label: 'Application Intelligence', category: 'observability', description: 'Error tracking, performance analysis, deployment impact assessment.' },
  application_traces: { label: 'Distributed Tracing', category: 'observability', description: 'End-to-end request tracing for microservices architectures.' },
  service_health: { label: 'Service Reliability', category: 'it_ops', description: 'SLI/SLO tracking, availability monitoring, incident correlation.' },
  kubernetes_container: { label: 'Container Orchestration', category: 'observability', description: 'Pod health, container lifecycle, Kubernetes events and resource usage.' },
  cloud_infrastructure: { label: 'Cloud Infrastructure', category: 'observability', description: 'Cloud resource monitoring, cost and performance optimization.' },
  database_activity: { label: 'Database Intelligence', category: 'it_ops', description: 'Query performance, access patterns, data exfiltration detection.' },
  network_performance: { label: 'Network Performance', category: 'it_ops', description: 'Latency, throughput, packet loss for network optimization.' },
  business_transactions: { label: 'Business Transactions', category: 'business', description: 'Revenue-critical transaction monitoring and business KPI tracking.' },
  user_experience: { label: 'Digital Experience', category: 'business', description: 'User journey analytics, conversion optimization, experience monitoring.' },
  audit_compliance: { label: 'Compliance & Audit', category: 'business', description: 'Regulatory compliance evidence, audit trail integrity.' },
  platform_health: { label: 'Platform Operations', category: 'business', description: 'Splunk platform health, search performance, knowledge object management.' },
  ot_network: { label: 'OT Network Security', category: 'ot', description: 'Industrial network segmentation, protocol analysis, anomaly detection.' },
  scada_events: { label: 'SCADA Monitoring', category: 'ot', description: 'Supervisory control event monitoring and safety system alerting.' },
}

/**
 * Generate executive summary for the full planning engagement.
 */
export function generateExecutiveSummary(plans, useCases, customerName) {
  const run = plans[plans.length - 1]
  const crawl = plans[0]
  const walk = plans[1] || crawl

  if (!run || run.sources.length === 0) {
    return {
      text: `Preliminary architecture view for ${customerName || 'the customer'}. Configure data sources to generate ingest and coverage recommendations.`,
      primaryUseCases: (useCases || []).slice(0, 5).map((uc) => uc.name),
    }
  }

  const walkGb = formatGB(walk.totals?.buffered?.expected)
  const runGb = formatGB(run.totals?.buffered?.expected)
  const score = run.validation?.score ?? 0

  const text = [
    `${customerName || 'This customer'} can achieve security and operations visibility with a phased Splunk rollout.`,
    `The recommended Walk path targets ~${walkGb} across ${walk.sources.length} sources.`,
    `The Run path extends to ~${runGb} for a 2–3 year target footprint (${run.sources.length} sources).`,
    score >= 75
      ? 'Selected sources meet most required coverage areas for the chosen use cases.'
      : 'Additional sources may be needed to close remaining coverage gaps.',
  ].join(' ')

  return {
    text,
    primaryUseCases: (useCases || []).slice(0, 6).map((uc) => uc.name),
  }
}

/**
 * Generate per-source value proposition.
 */
export function generateSourceValueProp(source, useCases, currentCoverage) {
  const domains = source.telemetryDomains || {}
  const lines = []
  const categories = new Set()

  for (const [domain, strength] of Object.entries(domains)) {
    const mapped = DOMAIN_VALUE_MAP[domain]
    if (!mapped) continue
    categories.add(mapped.category)
    const currentScore = currentCoverage?.[domain]?.score || 0
    if (strength === 'strong' && currentScore < 0.75) {
      lines.push(`Provides strong ${mapped.label.toLowerCase()} — filling a current gap.`)
    }
  }

  if (lines.length === 0) {
    if (source.whyItMatters?.trim()) {
      lines.push(source.whyItMatters.trim())
    } else {
      lines.push(`${source.name} supports visibility and investigation for your selected use cases.`)
    }
  }

  const relevantUCs = useCases.filter((uc) => {
    const required = uc.requiredDomains || []
    return required.some((d) => domains[d])
  })

  if (relevantUCs.length > 0) {
    lines.push(`Supports: ${relevantUCs.map((u) => u.name).join(', ')}.`)
  }

  return {
    summary: lines.join(' '),
    categories: [...categories],
    gapsFilled: lines.filter((l) => l.includes('filling a current gap')).length,
    relevantUseCases: relevantUCs.map((u) => u.name),
  }
}

/**
 * Build cross-source narrative for a plan.
 */
export function generatePlanNarrative(plan, useCases) {
  const categoryCounts = { security: 0, observability: 0, it_ops: 0, business: 0, ot: 0 }

  for (const source of plan.sources) {
    for (const domain of Object.keys(source.telemetryDomains || {})) {
      const mapped = DOMAIN_VALUE_MAP[domain]
      if (mapped && categoryCounts[mapped.category] !== undefined) {
        categoryCounts[mapped.category]++
      }
    }
  }

  const sections = []

  if (categoryCounts.security > 0) {
    sections.push({
      category: 'Security',
      narrative: `This path provides ${categoryCounts.security} security telemetry touchpoints, enabling threat detection, investigation, and response workflows.`,
    })
  }
  if (categoryCounts.observability > 0) {
    sections.push({
      category: 'Observability',
      narrative: `With ${categoryCounts.observability} observability data points, this path supports service health monitoring, performance analysis, and incident correlation.`,
    })
  }
  if (categoryCounts.it_ops > 0) {
    sections.push({
      category: 'IT Operations',
      narrative: `${categoryCounts.it_ops} IT operations signals provide infrastructure and service management insights.`,
    })
  }
  if (categoryCounts.business > 0) {
    sections.push({
      category: 'Business Analytics',
      narrative: `Business-critical data from ${categoryCounts.business} touchpoints enables transaction monitoring and compliance reporting.`,
    })
  }
  if (categoryCounts.ot > 0) {
    sections.push({
      category: 'OT / ICS',
      narrative: `Operational technology visibility across ${categoryCounts.ot} data points supports industrial monitoring and safety.`,
    })
  }

  return sections
}

function formatGB(gb) {
  if (!gb || gb <= 0) return '0 GB/day'
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB/day`
  return `${gb.toFixed(1)} GB/day`
}
