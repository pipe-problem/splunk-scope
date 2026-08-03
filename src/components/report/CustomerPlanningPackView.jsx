/**
 * Standalone customer planning pack — mirrors Report page tab content exactly.
 * Used for HTML export via SSR and matches live Report UX (colors, copy, structure).
 */
import {
  ChevronDown,
  ChevronRight,
  BookOpen,
  ShieldAlert,
  Layers,
  Database,
  Target,
  ArrowRight,
  Check,
  Boxes,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import DonutChart from '../DonutChart.jsx';
import { formatValidationNeededLabel } from '../../utils/displayLabels.js';
import { TOTAL_INGEST_LABEL, RANGE_CAPTION } from '../../constants/customerFacingCopy.js';

const TYPE_LABELS = {
  premium_solution: 'Premium',
  free_app: 'App',
  splunkbase_app: 'App',
  technical_addon: 'Add-on',
  connector: 'Connector',
  prerequisite: 'Prerequisite',
  content_pack: 'Content',
};

const FIT_CLASS = {
  strong: 'pack-product-fit-strong',
  moderate: 'pack-product-fit-moderate',
  weak: 'pack-product-fit-weak',
};

function fmtGb(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(1) : '0.0';
}

function IngestBarListStatic({ segments, limit = 5, title, className = '' }) {
  const top = [...(segments || [])].sort((a, b) => b.value - a.value).slice(0, limit);
  if (!top.length) return null;
  const max = top[0].value || 1;
  return (
    <div className={`ingest-bar-list ${className}`.trim()}>
      {title && <p className="text-metric-label mb-2">{title}</p>}
      {top.map((s) => (
        <div key={s.label} className="ingest-bar-row">
          <span className="ingest-bar-label" title={s.label}>
            {s.label}
          </span>
          <div className="ingest-bar-track">
            <div
              className="ingest-bar-fill"
              style={{ width: `${Math.max(4, (s.value / max) * 100)}%` }}
            />
          </div>
          <span className="ingest-bar-value">{fmtGb(s.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PlanningKpiStripStatic({ ingestSummary }) {
  const low = ingestSummary?.low ?? 0;
  const expected = ingestSummary?.expected ?? 0;
  const high = ingestSummary?.high ?? 0;
  return (
    <div>
      <p className="text-metric-label mb-1">{TOTAL_INGEST_LABEL}</p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Low', value: low, color: 'var(--cast-info)' },
          { label: 'Expected', value: expected, color: 'var(--cast-success)', highlight: true },
          { label: 'High', value: high, color: 'var(--cast-warning)' },
        ].map((m) => (
          <div
            key={m.label}
            className={`card-compact text-center !py-1.5 ${m.highlight ? 'border-[var(--cast-green)]/30' : ''}`}
          >
            <p className="text-metric-label mb-0.5">{m.label}</p>
            <p className="text-base font-bold tabular-nums" style={{ color: m.color }}>
              {fmtGb(m.value)}
            </p>
            <p className="text-metric-sub">GB/day</p>
          </div>
        ))}
      </div>
      <p className="text-label text-[var(--cast-text-muted)] mt-1.5 leading-snug">
        Sum of sources you sized in this session that appear in the selected path.
      </p>
    </div>
  );
}

function ProductRowStatic({ item }) {
  const typeLabel = TYPE_LABELS[item.type] || item.type;
  const fitClass = FIT_CLASS[item.fit] || FIT_CLASS.moderate;
  return (
    <div className="pack-product-row space-y-1.5">
      <div className="flex flex-wrap items-start gap-2 justify-between">
        <div className="min-w-0 flex-1">
          {item.customerUrl ? (
            <a
              href={item.customerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--cast-text)]"
            >
              {item.displayName}
              <ExternalLink size={11} className="opacity-60" />
            </a>
          ) : (
            <span className="text-sm font-semibold text-[var(--cast-text)]">{item.displayName}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <span className="px-2 py-0.5 rounded-md text-tiny font-medium uppercase tracking-wide bg-[var(--cast-panel-alt)] text-[var(--cast-text-muted)] border border-[var(--cast-border)]">
            {typeLabel}
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-tiny font-medium uppercase tracking-wide border ${fitClass}`}
          >
            {item.phase}
          </span>
        </div>
      </div>
      <p className="text-label text-[var(--cast-text-secondary)] leading-snug">{item.customerReason}</p>
      {item.readinessWarnings?.length > 0 && (
        <p className="flex items-start gap-1.5 text-badge text-[var(--cast-warning)]">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          {item.readinessWarnings[0]}
        </p>
      )}
      {item.needsExternalValidation && (
        <p className="text-badge text-[var(--cast-text-muted)]">Validate availability with your account team.</p>
      )}
    </div>
  );
}

function ReportAccordion({ title, icon: Icon, iconClass, children }) {
  return (
    <details className="report-accordion rounded-lg border border-[var(--cast-border)] overflow-hidden group">
      <summary className="report-accordion-summary report-accordion-summary flex items-center gap-2 px-3 py-2 cursor-pointer bg-[var(--cast-panel)]">
        {Icon && <Icon size={14} className={iconClass || 'text-[var(--cast-accent)]'} />}
        <span className="text-card-header flex-1">{title}</span>
        <ChevronDown size={14} className="text-[var(--cast-text-muted)] transition-transform group-open:rotate-180 shrink-0" />
      </summary>
      <div className="px-3 py-2.5 border-t border-[var(--cast-border)] bg-[var(--cast-bg)]">{children}</div>
    </details>
  );
}

/**
 * @param {{ data: object, activeTab?: string }} props
 */
export default function CustomerPlanningPackView({ data, activeTab = 'overview' }) {
  const {
    customer,
    reportTitle,
    ingestSummary,
    coverageSummary,
    selectedPath,
    overview,
    architectureFlow,
    productRecommendations,
    risks,
    sourceGroups,
    startupGuide,
    appVersion,
  } = data;

  const coverageColor =
    coverageSummary.score >= 75
      ? 'var(--cast-success)'
      : coverageSummary.score >= 50
        ? 'var(--cast-warning)'
        : 'var(--cast-critical)';

  const ingestSegments = overview?.ingestSegments || [];
  const ingestChartTotal = overview?.ingestChartTotal ?? 0;
  const strengths = (overview?.strengths || []).slice(0, 3);
  const gaps = (overview?.gaps || []).slice(0, 3);
  const useCases = overview?.useCases || [];
  const products = productRecommendations?.compactItems || [];

  const tabClass = (key) => `pack-tab text-tab-label${activeTab === key ? ' active' : ''}`;

  return (
    <div className="pack-root" data-theme="dark">
      <div className="gradient-line" />

      <header className="pack-brand-header">
        <p className="pack-header-eyebrow">{reportTitle || 'Splunk Scope Planning Pack'}</p>
        <h1 className="pack-customer-name">{customer || 'Customer'}</h1>
        {useCases.length > 0 && (
          <div className="pack-use-case-row">
            <span className="pack-use-case-label">Use cases</span>
            <div className="pack-use-case-chips">
              {useCases.map((name) => (
                <span key={name} className="pack-use-case-chip">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
        {selectedPath && (
          <p className="pack-header-meta">
            Recommended path: <span className="pack-header-meta-accent">{selectedPath}</span>
          </p>
        )}
      </header>

      <div className="pack-tab-bar-wrap">
        <div className="pack-tab-bar">
          <div className="flex items-center gap-0">
            <button type="button" className={tabClass('overview')} data-pack-tab="overview">
              Overview
            </button>
            <button type="button" className={tabClass('sources')} data-pack-tab="sources">
              Sources
            </button>
            <button type="button" className={tabClass('guide')} data-pack-tab="guide">
              Startup Guide
            </button>
          </div>
        </div>
      </div>

      <div className="page-scroll">
        {/* OVERVIEW */}
        <div
          className={`report-overview${activeTab !== 'overview' ? ' report-section-inactive' : ''}`}
          data-pack-panel="overview"
        >
          <div className="report-overview-hero pack-hero-gradient">
            <div className="max-w-3xl">
              <PlanningKpiStripStatic ingestSummary={ingestSummary} />
            </div>

            <div className="report-kpi-strip mt-3">
              <div className="report-kpi-cell">
                <p className="report-kpi-value" style={{ color: 'var(--cast-text)' }}>
                  {coverageSummary.sourceCount}
                </p>
                <p className="text-metric-label">Sources in path</p>
              </div>
              <div className="report-kpi-cell">
                <p className="report-kpi-value" style={{ color: coverageColor }}>
                  {coverageSummary.score}%
                </p>
                <p className="text-metric-label">Coverage</p>
              </div>
              <div className="report-kpi-cell">
                <p className="report-kpi-path" style={{ color: 'var(--cast-accent)' }}>
                  {selectedPath || '—'}
                </p>
                <p className="text-metric-label">Selected path</p>
              </div>
            </div>

            <div className="report-overview-columns">
              <div className="rounded-lg border border-[var(--cast-border)] bg-[var(--cast-panel)]/80 p-3">
                <p className="text-card-header mb-2">What this delivers</p>
                {(overview?.deliveryBullets || []).length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {overview.deliveryBullets.map((line) => (
                      <li key={line} className="text-label text-[var(--cast-text-secondary)] leading-snug flex gap-2">
                        <span className="text-[var(--cast-accent)] shrink-0">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {overview?.executiveOneLiner && (
                  <p className="text-label text-[var(--cast-text-muted)] leading-snug">{overview.executiveOneLiner}</p>
                )}
              </div>
              <div className="rounded-lg border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/60 p-3">
                {ingestSegments.length > 0 ? (
                  <>
                    <IngestBarListStatic segments={ingestSegments} limit={5} title="Ingest mix (top sources)" />
                    <p className="text-label text-[var(--cast-text-muted)] mt-1.5">
                      Top sources in selected path (sums to {ingestChartTotal.toFixed(1)} GB/day)
                    </p>
                  </>
                ) : (
                  <p className="text-label text-[var(--cast-text-muted)]">No ingest data for this path.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {architectureFlow && (
                <ReportAccordion title="Architecture flow" icon={Layers}>
                  <div className="report-flow-row">
                    <div className="report-flow-step">
                      <Database size={12} className="text-[var(--cast-info)] mb-1" />
                      <p className="text-metric-label">Sources</p>
                      <p className="text-label font-semibold text-[var(--cast-text)]">
                        {architectureFlow.sourceCount} configured
                      </p>
                      <p className="text-badge text-[var(--cast-text-muted)]">Telemetry from selected path bundle</p>
                    </div>
                    <ArrowRight size={16} className="report-flow-arrow text-[var(--cast-accent)] shrink-0" />
                    <div className="report-flow-step report-flow-step--accent">
                      <Target size={12} className="text-[var(--cast-accent)] mb-1" />
                      <p className="text-metric-label">Splunk</p>
                      <p className="text-label font-semibold text-[var(--cast-accent)]">{architectureFlow.pathName}</p>
                      <p className="text-badge text-[var(--cast-text-secondary)] leading-snug">
                        {architectureFlow.pathDescription}
                      </p>
                    </div>
                    <ArrowRight size={16} className="report-flow-arrow text-[var(--cast-success)] shrink-0" />
                    <div className="report-flow-step report-flow-step--success">
                      <Check size={12} className="text-[var(--cast-success)] mb-1" />
                      <p className="text-metric-label">Outcomes</p>
                      {useCases.slice(0, 3).map((name) => (
                        <p key={name} className="text-badge text-[var(--cast-text-secondary)]">
                          {name}
                        </p>
                      ))}
                      {useCases.length > 3 && (
                        <p className="text-badge text-[var(--cast-text-muted)]">+{useCases.length - 3} more use cases</p>
                      )}
                    </div>
                  </div>
                </ReportAccordion>
              )}

              {(strengths.length > 0 || gaps.length > 0) && (
                <ReportAccordion title="Strengths & gaps" icon={Check} iconClass="text-[var(--cast-success)]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {strengths.length > 0 && (
                      <div>
                        <p className="text-metric-label text-[var(--cast-success)] mb-1.5">Strengths</p>
                        <ul className="space-y-1">
                          {strengths.map((s) => (
                            <li key={s} className="text-label text-[var(--cast-text-secondary)] leading-snug flex gap-2">
                              <Check size={10} className="text-[var(--cast-success)] shrink-0 mt-0.5" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {gaps.length > 0 && (
                      <div>
                        <p className="text-metric-label text-[var(--cast-warning)] mb-1.5">Gaps</p>
                        <ul className="space-y-1">
                          {gaps.map((g) => (
                            <li key={g} className="text-label text-[var(--cast-text-secondary)] capitalize leading-snug">
                              {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </ReportAccordion>
              )}

              <ReportAccordion title="Recommended Splunk products" icon={Boxes}>
                <div className="space-y-3">
                  {productRecommendations?.primaryRecommendationSummary && (
                    <p className="text-label text-[var(--cast-text-secondary)] border-l-2 border-[var(--cast-accent)] pl-3 line-clamp-2">
                      {productRecommendations.primaryRecommendationSummary}
                    </p>
                  )}
                  <div
                    id="pack-products-list"
                    className={`space-y-2${products.length > 3 ? ' pack-products-collapsed' : ''}`}
                  >
                    {products.map((item) => (
                      <ProductRowStatic key={item.appId} item={item} />
                    ))}
                  </div>
                  {products.length > 3 && (
                    <button type="button" id="pack-view-all-products" className="text-label text-[var(--cast-accent)]">
                      View all {products.length} products
                    </button>
                  )}
                  {!products.length && (
                    <p className="text-label text-[var(--cast-text-muted)]">
                      Add use cases and sources to refine product suggestions.
                    </p>
                  )}
                </div>
              </ReportAccordion>

              {risks?.length > 0 && (
                <ReportAccordion title="Risks" icon={ShieldAlert} iconClass="text-[var(--cast-warning)]">
                  <table className="report-risk-table w-full text-badge">
                    <thead>
                      <tr className="text-tiny uppercase tracking-wider text-[var(--cast-text-muted)] border-b border-[var(--cast-border)]/50">
                        <th className="text-left py-1 pr-2 font-medium">Risk</th>
                        <th className="text-left py-1 font-medium">Mitigation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {risks.map((row) => (
                        <tr key={`${row.title}-${row.mitigation}`} className="border-b border-[var(--cast-border)]/30 last:border-0">
                          <td className="py-1.5 pr-2 text-[var(--cast-text)] align-top">{row.title}</td>
                          <td className="py-1.5 text-[var(--cast-text-secondary)] align-top leading-snug">
                            {row.mitigation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ReportAccordion>
              )}

            </div>

            <p className="report-overview-footnote text-badge text-[var(--cast-text-muted)] italic mt-3">
              Planning estimate — validate with environment-specific measurement. Splunk Scope v{appVersion}
            </p>
          </div>
        </div>

        {/* SOURCES */}
        <div
          className={`${activeTab !== 'sources' ? 'report-section-inactive' : ''}`}
          data-pack-panel="sources"
        >
          <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-4">
            <p className="text-label text-[var(--cast-text-muted)]">
              Configured sources in the selected path, grouped by category.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Low', value: ingestSummary.low, color: 'var(--cast-info)' },
                { label: 'Expected', value: ingestSummary.expected, color: 'var(--cast-success)' },
                { label: 'High', value: ingestSummary.high, color: 'var(--cast-warning)' },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel)] p-4 text-center"
                >
                  <p className="text-3xl font-black leading-none" style={{ color: m.color }}>
                    {m.value.toFixed(1)}
                  </p>
                  <p className="text-metric-label mt-1.5">{m.label} GB/day</p>
                </div>
              ))}
            </div>

            {ingestSegments.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <IngestBarListStatic
                  segments={ingestSegments}
                  limit={8}
                  title="Ingest by source (bar)"
                  className="rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/40 p-3"
                />
                <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel)] p-3">
                  <DonutChart
                    segments={ingestSegments}
                    size={120}
                    strokeWidth={18}
                    showLegend
                    presentationScale={false}
                    centerValue={ingestChartTotal}
                    centerLabel="GB/day"
                    centerSubLabel={`Top ${Math.min(ingestSegments.length, 8)}`}
                  />
                </div>
              </div>
            )}

            {sourceGroups.map((group) => (
              <div key={group.category} className="rounded-xl border border-[var(--cast-border)] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[var(--cast-border)] bg-[var(--cast-panel)] flex items-center justify-between">
                  <span className="text-label font-semibold text-[var(--cast-text)]">{group.category}</span>
                  <span className="text-badge text-[var(--cast-text-muted)]">
                    {group.sources.length} source{group.sources.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="divide-y divide-[var(--cast-border)]/50">
                  {group.sources.map((row) => (
                    <button
                      key={row.id || row.name}
                      type="button"
                      className={`pack-source-row${row.isZeroUnconfigured ? ' opacity-50' : ''}`}
                      data-source-id={row.id || row.name}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`shrink-0 w-2 h-2 rounded-full ${
                            row.status === 'current'
                              ? 'bg-[var(--cast-success)]'
                              : row.configured
                                ? 'bg-[var(--cast-warning)]'
                                : 'bg-[var(--cast-text-muted)]'
                          }`}
                        />
                        <span className="text-label font-medium text-[var(--cast-text)] flex-1 truncate">
                          {row.name}
                        </span>
                        {row.isCustom && (
                          <span className="text-badge px-1.5 py-0.5 rounded-full bg-[var(--cast-panel-alt)] text-[var(--cast-text-muted)] border border-[var(--cast-border)] font-medium shrink-0">
                            Legacy custom
                          </span>
                        )}
                        {!row.configured && (
                          <span className="text-badge px-1.5 py-0.5 rounded-full bg-[var(--cast-text-muted)]/15 text-[var(--cast-text-muted)] font-medium shrink-0">
                            Not configured
                          </span>
                        )}
                        {row.needsReview && row.configured && (
                          <span className="text-badge px-2 py-0.5 rounded font-medium badge-needs_review shrink-0">
                            {formatValidationNeededLabel()}
                          </span>
                        )}
                        <span className="text-label font-mono font-bold text-[var(--cast-success)]">
                          {row.ingest.expected.toFixed(1)}
                        </span>
                        <span className="text-metric-sub">GB/day</span>
                        <span className="flex items-center gap-0.5 text-badge text-[var(--cast-accent)] shrink-0 pack-source-toggle-label">
                          Details
                          <ChevronRight size={12} className="pack-chevron" />
                        </span>
                      </div>
                      <div className="pack-source-detail space-y-1">
                        <p className="text-label text-[var(--cast-text-muted)]">
                          Range: {row.ingest.low.toFixed(2)} – {row.ingest.high.toFixed(2)} GB/day
                        </p>
                        {row.valueSummary && (
                          <p className="text-badge text-[var(--cast-text-secondary)]">{row.valueSummary}</p>
                        )}
                        <p className="text-label text-[var(--cast-text-muted)] capitalize">
                          Status: {row.status}
                          {!row.configured ? ' — sizing inputs incomplete' : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {!sourceGroups.length && (
              <div className="text-center py-12">
                <Database size={24} className="text-[var(--cast-text-muted)] mx-auto mb-2" />
                <p className="text-empty-title">No sources in selected path</p>
              </div>
            )}
          </div>
        </div>

        {/* STARTUP GUIDE */}
        <div
          className={`${activeTab !== 'guide' ? 'report-section-inactive' : ''}`}
          data-pack-panel="guide"
        >
          <div className="p-4 md:p-5 max-w-5xl mx-auto space-y-3">
            {!startupGuide ? (
              <div className="text-center py-12">
                <BookOpen size={24} className="text-[var(--cast-text-muted)] mx-auto mb-2" />
                <p className="text-empty-title">No sources configured</p>
                <p className="text-empty-body mt-1">Select sources to generate onboarding guidance.</p>
              </div>
            ) : (
              <>
                {startupGuide.yearOnePlan && (
                  <div className="rounded-2xl border border-[var(--cast-border)] overflow-hidden">
                    <div className="px-5 py-3 border-b border-[var(--cast-border)] bg-[var(--cast-panel)]">
                      <h3 className="text-card-header">Part 1 — Year-One Deployment Plan</h3>
                      <p className="text-label text-[var(--cast-text-muted)] mt-0.5">
                        Phased rollout aligned to crawl, walk, and run goals from intake.
                      </p>
                    </div>
                    <div className="p-3 space-y-2">
                      {startupGuide.yearOnePlan.phases.map((phase) => (
                        <div
                          key={phase.period}
                          className="rounded-xl border border-[var(--cast-border)] bg-[var(--cast-bg)] p-3"
                        >
                          <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
                            <span className="text-label font-bold text-[var(--cast-accent)]">{phase.period}</span>
                            <span className="text-label font-semibold text-[var(--cast-text)]">{phase.title}</span>
                          </div>
                          <ul className="space-y-1 mb-1.5">
                            {(phase.objectives || []).slice(0, 3).map((obj) => (
                              <li key={obj} className="text-label text-[var(--cast-text-secondary)] flex items-start gap-2">
                                <span className="text-[var(--cast-accent)] shrink-0">•</span>
                                <span>{obj}</span>
                              </li>
                            ))}
                          </ul>
                          {phase.sources && (
                            <p className="text-badge text-[var(--cast-text-muted)]">
                              <span className="font-semibold">Sources:</span> {phase.sources}
                            </p>
                          )}
                          {phase.validation && (
                            <p className="text-badge text-[var(--cast-text-muted)] mt-1">
                              <span className="font-semibold">Checkpoint:</span> {phase.validation}
                            </p>
                          )}
                        </div>
                      ))}
                      {startupGuide.yearOnePlan.workshops?.length > 0 && (
                        <div className="rounded-xl border border-[var(--cast-border)] p-4">
                          <p className="text-label font-semibold text-[var(--cast-text)] mb-2">Recommended workshops</p>
                          <ul className="space-y-1">
                            {startupGuide.yearOnePlan.workshops.map((w) => (
                              <li key={w} className="text-label text-[var(--cast-text-secondary)]">
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-[var(--cast-border)] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[var(--cast-border)] bg-[var(--cast-panel)]">
                    <h3 className="text-card-header">Part 2 — Week 1–3 Technical Setup</h3>
                    <p className="text-label text-[var(--cast-text-muted)] mt-0.5">
                      Collection methods, add-ons, validation searches, and troubleshooting for priority sources.
                    </p>
                  </div>
                  <div className="p-3 space-y-2">
                    {startupGuide.phaseCards?.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {startupGuide.phaseCards
                          .filter((c) => /prepare|onboard|validat/i.test(c.title))
                          .map((card) => (
                            <div key={card.title} className="rounded-xl border border-[var(--cast-border)] overflow-hidden">
                              <div className="px-4 py-2.5 border-b border-[var(--cast-border)] bg-[var(--cast-panel-alt)]">
                                <span className="text-label font-semibold text-[var(--cast-accent)]">{card.title}</span>
                              </div>
                              <div className="p-3 space-y-2">
                                {card.phases.map((phase) => (
                                  <div key={phase.title}>
                                    <p className="text-label font-medium text-[var(--cast-text)] mb-1">{phase.title}</p>
                                    <ul className="space-y-1">
                                      {(phase.tasks || []).slice(0, 4).map((task) => (
                                        <li key={task} className="text-label text-[var(--cast-text-secondary)] flex items-start gap-2">
                                          <span className="text-[var(--cast-accent)] mt-0.5 shrink-0">•</span>
                                          <span>{task}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    <div className="rounded-xl border border-[var(--cast-border)] overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-[var(--cast-border)] bg-[var(--cast-panel)]">
                        <span className="text-label font-semibold text-[var(--cast-text)]">Source onboarding order</span>
                        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
                          Week 1–3 priority:{' '}
                          {startupGuide.weekOneThreePriority?.join(', ') || 'per selected path'}
                        </p>
                      </div>
                      <div className="divide-y divide-[var(--cast-border)]/50">
                        {(startupGuide.onboardingSources || []).map((src) => (
                          <details key={src.name} className="group">
                            <summary className="px-4 py-3 cursor-pointer hover:bg-[var(--cast-panel-alt)] flex items-center gap-3 list-none">
                              <span
                                className={`shrink-0 w-2 h-2 rounded-full ${
                                  src.status === 'current' ? 'bg-[var(--cast-success)]' : 'bg-[var(--cast-warning)]'
                                }`}
                              />
                              <span className="text-label font-medium text-[var(--cast-text)] flex-1">{src.name}</span>
                              <span
                                className={`text-badge px-1.5 py-0.5 rounded-full font-medium ${
                                  src.complexity === 'Low'
                                    ? 'bg-[var(--cast-success)]/10 text-[var(--cast-success)]'
                                    : src.complexity === 'Medium'
                                      ? 'bg-[var(--cast-warning)]/10 text-[var(--cast-warning)]'
                                      : 'bg-[var(--cast-critical)]/10 text-[var(--cast-critical)]'
                                }`}
                              >
                                {src.complexity}
                              </span>
                              <span className="text-badge text-[var(--cast-text-muted)]">{src.method}</span>
                              <ChevronRight size={12} className="text-[var(--cast-accent)] group-open:rotate-90 transition-transform shrink-0" />
                            </summary>
                            <div className="px-4 pb-3 pt-1 ml-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-badge">
                              <div>
                                <span className="text-[var(--cast-text-muted)]">Method:</span>{' '}
                                <span className="text-[var(--cast-text-secondary)] ml-1">{src.method}</span>
                              </div>
                              <div>
                                <span className="text-[var(--cast-text-muted)]">TA / add-on:</span>{' '}
                                <span className="text-[var(--cast-text-secondary)] ml-1">{src.ta}</span>
                              </div>
                              <div className="col-span-full">
                                <span className="text-[var(--cast-text-muted)]">Validation:</span>{' '}
                                {src.validation?.isExample ? (
                                  <span className="text-[var(--cast-text-secondary)] ml-1">
                                    Example search — {src.validation.text}
                                  </span>
                                ) : (
                                  <code className="text-[var(--cast-info)] ml-1">{src.validation?.text}</code>
                                )}
                              </div>
                              <div className="col-span-full">
                                <span className="text-[var(--cast-text-muted)]">Access:</span>{' '}
                                <span className="text-[var(--cast-text-secondary)] ml-1">{src.permissions}</span>
                              </div>
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {startupGuide.prerequisites?.length > 0 && (
                  <div className="rounded-xl border border-[var(--cast-border)] p-4">
                    <p className="text-label font-semibold text-[var(--cast-text)] mb-2">Planning considerations</p>
                    <ul className="space-y-1">
                      {startupGuide.prerequisites.map((p) => (
                        <li key={p} className="text-label text-[var(--cast-text-secondary)] flex items-start gap-2">
                          <span className="text-[var(--cast-text-muted)] shrink-0">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
