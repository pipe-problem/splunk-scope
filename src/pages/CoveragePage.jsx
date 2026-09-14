import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useWorkflowNavigation } from '../hooks/useWorkflowNavigation.js';
import sourceCatalog from '../data/sources.json';
import { DOMAIN_CATEGORIES, TELEMETRY_DOMAINS, calculateSplitCoverage, validateMultiUseCase, SIEM_DEFAULT_DOMAINS, formatDomainForCustomer } from '../services/coverageEngine';
import { flattenSourceCatalog } from '../services/sizingEngine';
import { getOverlapExcludedIds } from '../services/sourceEligibilityEngine';
import { resolveUseCaseProfiles } from '../services/useCaseResolver';
import IngestChart, { IngestByCategory } from '../components/IngestChart';
import GapSummaryPanel from '../components/coverage/GapSummaryPanel';
import CoverageGauge from '../components/coverage/CoverageGauge';
import PageHeaderActions from '../components/layout/PageHeaderActions';
import WorkflowStepIndicator from '../components/layout/WorkflowStepIndicator';
import { SHOW_COVERAGE_PAGE } from '../config/featureFlags.js';
import { STEP } from '../config/workflowSteps.js';
import PlanningKpiStrip from '../components/PlanningKpiStrip';
import { AlertTriangle, CheckCircle2, XCircle, Shield, Activity, Briefcase, Factory, Search } from 'lucide-react';
import { getEligibleConfiguredSources, sumSessionPlanningIngest } from '../services/planningIngestTotals.js';

const CATEGORY_ICONS = { Security: Shield, 'Observability / IT': Activity, 'Business / Platform': Briefcase, 'OT / ICS': Factory };
const OT_DOMAINS = new Set(['ot_network', 'scada_events', 'historian_data', 'industrial_assets']);
const NON_SIEM_DEFAULT_DOMAINS = new Set([
  'real_user_monitoring', 'platform_health', 'ingest_pipeline_health', 'user_experience',
  'business_transactions', 'application_traces', 'kubernetes_container', 'database_activity',
  'network_performance', 'service_health', 'infrastructure_metrics',
]);

function isSiemFocusedScope(useCases, intake) {
  const apps = intake?.desiredApps || [];
  if (apps.includes('enterprise_security')) return true;
  return useCases.some((uc) =>
    ['foundational_security', 'enterprise_security', 'threat_detection', 'identity_access', 'network_security'].includes(uc.id),
  );
}
const flatCatalog = flattenSourceCatalog(sourceCatalog);

function UseCaseDrilldown({ perUseCase }) {
  const [expanded, setExpanded] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const sorted = [...perUseCase].sort((a, b) => b.score - a.score);
  const visible = showAll ? sorted : sorted.slice(0, 3);

  return (
    <div className="card-compact !p-3 space-y-2">
      <h3 className="text-section-kicker text-[var(--cast-text-muted)] mb-1">Top Use Cases</h3>
      {visible.map((uc) => (
        <button
          key={uc.id}
          type="button"
          onClick={() => setExpanded(expanded === uc.id ? null : uc.id)}
          className="interactive-card w-full text-left p-3 rounded-lg bg-[var(--cast-bg)] border border-[var(--cast-border)]"
        >
          <div className="flex items-center gap-2">
            {uc.passed ? <CheckCircle2 size={14} className="text-[var(--cast-success)] shrink-0" /> : <XCircle size={14} className="text-[var(--cast-warning)] shrink-0" />}
            <span className="text-label font-medium text-[var(--cast-text)] flex-1 truncate">{uc.name}</span>
            <span className="text-label font-bold text-[var(--cast-text)]">{uc.score}%</span>
          </div>
          {expanded === uc.id && (
            <div className="mt-2 pt-2 border-t border-[var(--cast-border)]/50 space-y-1 animate-fade-in">
              {uc.coveredSources?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {uc.coveredSources.map((s, i) => (
                    <span key={i} className="text-badge px-1.5 py-0.5 rounded bg-[var(--cast-success)]/10 text-[var(--cast-success)] border border-[var(--cast-success)]/20">{s}</span>
                  ))}
                </div>
              )}
              {uc.gaps?.length > 0 && (
                <div>
                  <p className="text-metric-label mb-0.5">Needs:</p>
                  <div className="flex flex-wrap gap-1">
                    {uc.gaps.map((g, i) => (
                      <span key={i} className="text-badge px-2 py-0.5 rounded bg-[var(--cast-warning)]/10 text-[var(--cast-warning)] border border-[var(--cast-warning)]/20">{formatDomainForCustomer(g)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </button>
      ))}
      {perUseCase.length > 3 && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="text-label text-[var(--cast-accent)] hover:underline w-full text-center py-1.5 cursor-pointer">
          {showAll ? 'Show less' : `View all ${perUseCase.length} use cases`}
        </button>
      )}
    </div>
  );
}

function DomainHierarchy({ splitCoverage, relevantDomains, requiredSet }) {
  const [expandedCat, setExpandedCat] = useState(null);

  return (
    <div className="card-compact !p-2 space-y-1.5">
      <h3 className="text-badge font-semibold text-[var(--cast-text-muted)] uppercase mb-1">Telemetry Domains</h3>
      {Object.entries(DOMAIN_CATEGORIES).map(([catName, domains]) => {
        const catDomains = domains.filter((d) => relevantDomains.has(d));
        if (catDomains.length === 0) return null;
        const Icon = CATEGORY_ICONS[catName] || Shield;
        const covered = catDomains.filter((d) => (splitCoverage.combined[d]?.score || 0) >= 0.75).length;
        const isOpen = expandedCat === catName;
        const avgScore = catDomains.reduce((sum, d) => sum + (splitCoverage.combined[d]?.score || 0), 0) / catDomains.length;

        return (
          <button
            key={catName}
            type="button"
            onClick={() => setExpandedCat(isOpen ? null : catName)}
            className="interactive-card w-full text-left rounded-lg bg-[var(--cast-bg)] border border-[var(--cast-border)] p-2"
          >
            <div className="flex items-center gap-2">
              <Icon size={12} className="text-[var(--cast-accent)] shrink-0" />
              <span className="text-badge font-medium text-[var(--cast-text)] flex-1">{catName}</span>
              <span className="text-badge text-[var(--cast-text-muted)]">{covered}/{catDomains.length}</span>
              <span className={`text-badge font-bold ${avgScore >= 0.75 ? 'text-[var(--cast-success)]' : avgScore > 0.3 ? 'text-[var(--cast-warning)]' : 'text-[var(--cast-text-muted)]'}`}>
                {(avgScore * 100).toFixed(0)}%
              </span>
            </div>
            {isOpen && (
              <div className="mt-2 pt-2 border-t border-[var(--cast-border)]/50 space-y-1 animate-fade-in">
                {catDomains.map((domain) => {
                  const combined = splitCoverage.combined[domain] || { score: 0 };
                  const current = splitCoverage.current[domain] || { score: 0 };
                  const future = splitCoverage.future[domain] || { score: 0 };
                  const isRequired = requiredSet.has(domain);
                  return (
                    <div key={domain} className="flex items-center gap-2 py-0.5">
                      <div className="w-24 shrink-0 flex items-center gap-1">
                        <span className="text-label capitalize text-[var(--cast-text-secondary)] truncate">{formatDomainForCustomer(domain)}</span>
                        {isRequired && <span className="text-[6px] px-0.5 rounded badge-required font-bold shrink-0">FOCUS</span>}
                      </div>
                      <div className="flex-1 h-2.5 rounded-full bg-[var(--cast-panel-alt)] overflow-hidden border border-[var(--cast-border)] relative">
                        {current.score > 0 && <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--cast-success)]" style={{ width: `${Math.min(current.score * 100, 100)}%` }} />}
                        {future.score > 0 && current.score < 1 && <div className="absolute inset-y-0 rounded-full bg-[var(--cast-warning)]/60" style={{ left: `${current.score * 100}%`, width: `${Math.min(future.score * 100, 100 - current.score * 100)}%` }} />}
                      </div>
                      <span className={`text-tiny w-6 text-right font-mono ${combined.score >= 0.75 ? 'text-[var(--cast-success)]' : 'text-[var(--cast-warning)]'}`}>
                        {(combined.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function CoveragePage() {
  const { state, dispatch } = useApp();
  const { goToStep } = useWorkflowNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [rightTab, setRightTab] = useState('summary');

  const useCases = useMemo(() => resolveUseCaseProfiles(state.intake).profiles, [state.intake]);

  const allSources = useMemo(() => {
    const custom = Object.entries(state.sources)
      .filter(([id, s]) => id.startsWith('custom_') && (s.status === 'current' || s.status === 'future'))
      .map(([id, s]) => ({ id, name: s.name || 'Custom', telemetryDomains: s.telemetryDomains || {} }));
    return [...flatCatalog, ...custom];
  }, [state.sources]);

  const excludedIds = useMemo(() => getOverlapExcludedIds(state.overlapDecisions), [state.overlapDecisions]);

  const splitCoverage = useMemo(
    () => calculateSplitCoverage(allSources, state.sources, excludedIds),
    [allSources, state.sources, excludedIds]
  );

  const multiValidation = useMemo(
    () => validateMultiUseCase(splitCoverage.combined, useCases),
    [splitCoverage.combined, useCases]
  );


  const sizingCtx = useMemo(() => ({ catalog: sourceCatalog, allInputs: state.sources }), [state.sources]);

  const configuredSources = useMemo(
    () => getEligibleConfiguredSources({
      catalog: sourceCatalog,
      sourceStates: state.sources,
      overlapDecisions: state.overlapDecisions,
      sizingContext: sizingCtx,
    }),
    [state.sources, state.overlapDecisions, sizingCtx],
  );

  const overlapExcludedIds = useMemo(
    () => getOverlapExcludedIds(state.overlapDecisions),
    [state.overlapDecisions],
  );

  const filteredSources = useMemo(() => {
    if (!searchQuery.trim()) return configuredSources;
    const q = searchQuery.toLowerCase();
    return configuredSources.filter((s) =>
      [s.name, s.category, s.vendor, s.notes, s.status, s.includeInTotalsReason].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [configuredSources, searchQuery]);

  const totals = useMemo(
    () => sumSessionPlanningIngest({
      catalog: sourceCatalog,
      sourceStates: state.sources,
      overlapDecisions: state.overlapDecisions,
      sizingContext: sizingCtx,
    }).totals,
    [state.sources, state.overlapDecisions, sizingCtx],
  );

  const customSourcesForPlans = useMemo(
    () => Object.entries(state.sources)
      .filter(([id, s]) => id.startsWith('custom_') && (s.status === 'current' || s.status === 'future'))
      .map(([id, s]) => ({ id, name: s.name || 'Custom', ...s, telemetryDomains: s.telemetryDomains || {} })),
    [state.sources],
  );

  const countedSourceCount = useMemo(
    () => getEligibleConfiguredSources({
      catalog: sourceCatalog,
      sourceStates: state.sources,
      overlapDecisions: state.overlapDecisions,
      sizingContext: sizingCtx,
    }).length,
    [state.sources, state.overlapDecisions, sizingCtx],
  );

  const activeSourceCount = useMemo(
    () => configuredSources.filter((s) => s.status === 'current' || s.status === 'future').length,
    [configuredSources]
  );

  const eligibleIds = useMemo(
    () => new Set(
      getEligibleConfiguredSources({
        catalog: sourceCatalog,
        sourceStates: state.sources,
        overlapDecisions: state.overlapDecisions,
        sizingContext: sizingCtx,
      }).map((s) => s.id),
    ),
    [state.sources, state.overlapDecisions, sizingCtx],
  );

  const chartSources = useMemo(() => {
    return configuredSources
      .filter((s) => eligibleIds.has(s.id) && s.gbExpected > 0)
      .map((s) => ({ ...s, ingest: { expected: s.gbExpected } }));
  }, [configuredSources, eligibleIds]);

  const relevantDomains = useMemo(() => {
    const fromUseCases = new Set();
    for (const uc of useCases) {
      (uc.requiredDomains || []).forEach((d) => fromUseCases.add(d));
      (uc.recommendedDomains || []).forEach((d) => fromUseCases.add(d));
    }
    if (state.showAllDomains) return new Set(TELEMETRY_DOMAINS);

    if (isSiemFocusedScope(useCases, state.intake)) {
      const focused = new Set(SIEM_DEFAULT_DOMAINS);
      for (const d of fromUseCases) {
        if (!OT_DOMAINS.has(d) && !NON_SIEM_DEFAULT_DOMAINS.has(d)) focused.add(d);
      }
      return focused;
    }

    return new Set([...fromUseCases].filter((d) => !OT_DOMAINS.has(d) || fromUseCases.has(d)));
  }, [useCases, state.showAllDomains, state.intake]);

  const requiredSet = useMemo(() => {
    const s = new Set();
    useCases.forEach((uc) => (uc.requiredDomains || []).forEach((d) => s.add(d)));
    return s;
  }, [useCases]);


  function updateSourceField(sourceId, field, value) {
    dispatch({ type: 'UPDATE_SOURCE', payload: { sourceId, data: { [field]: value } } });
  }

  const hasActiveSourcesForCoverage = allSources.some((s) => state.sources[s.id]?.status === 'current' || state.sources[s.id]?.status === 'future');

  const coverageDashboardReady = hasActiveSourcesForCoverage && useCases.length > 0;
  const dashboardScoreLabel = coverageDashboardReady ? `${multiValidation.overallScore}%` : '—';
  const dashboardGapCount = coverageDashboardReady ? multiValidation.gaps.length : '—';
  const scoreValue = coverageDashboardReady ? multiValidation.overallScore : 0;

  return (
    <div className="page-viewport">
      <div className="page-header shrink-0 flex-wrap gap-2">
        <div className="min-w-0 flex-1">
          <h2>Coverage Analysis</h2>
          {SHOW_COVERAGE_PAGE ? (
            <WorkflowStepIndicator currentStep={STEP.COVERAGE} />
          ) : (
            <p className="text-label text-[var(--cast-text-muted)] mt-0.5">Coverage · archived</p>
          )}
          <p className="text-label text-[var(--cast-text-muted)]">
            Coverage based on selected use cases and configured sources.
          </p>
        </div>
        <PageHeaderActions
          state={state}
          backLabel="Review"
          onBack={() => goToStep(STEP.REVIEW)}
          continueLabel="Paths"
          onContinue={() => goToStep(STEP.PATHS)}
        />
      </div>

      <div className="page-scroll p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 max-w-[1600px] mx-auto">

          {/* Left column — Coverage score + domains */}
          <div className="space-y-3 min-w-0">

            {/* Coverage gauge hero — bold and scannable */}
            <div className="rounded-2xl bg-gradient-to-br from-[var(--cast-panel)] to-[var(--cast-panel-alt)] border border-[var(--cast-border)] p-4">
              <div className="flex items-center gap-5">
                <CoverageGauge
                  percent={coverageDashboardReady ? scoreValue : 0}
                  size={130}
                  customerName={state.intake.customerName || ''}
                />
                <div className="flex-1 min-w-0 space-y-3">
                  <PlanningKpiStrip totals={totals} scope="session" compact />
                  <div className="flex items-center gap-5">
                    <div>
                      <span className="text-xl font-bold text-[var(--cast-text)]">{activeSourceCount}</span>
                      <span className="text-label text-[var(--cast-text-muted)] ml-2">active sources</span>
                    </div>
                    <div className="w-px h-6 bg-[var(--cast-border)]" />
                    <div>
                      <span className={`text-xl font-bold ${coverageDashboardReady ? 'text-[var(--cast-warning)]' : 'text-[var(--cast-text-muted)]'}`}>{dashboardGapCount}</span>
                      <span className="text-label text-[var(--cast-text-muted)] ml-2">gaps</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {overlapExcludedIds.length > 0 && (
              <div className="p-1.5 rounded-lg bg-[var(--cast-warning)]/5 border border-[var(--cast-warning)]/20">
                <p className="text-badge text-[var(--cast-warning)]">
                  {overlapExcludedIds.length} source(s) excluded from totals due to overlap
                </p>
              </div>
            )}

            {!hasActiveSourcesForCoverage ? (
              <div className="card-compact border-[var(--cast-warning)]/20 text-center py-6">
                <AlertTriangle className="text-[var(--cast-warning)] mx-auto mb-2" size={20} />
                <p className="text-empty-title">No active sources</p>
                <p className="text-empty-body mt-1">Set sources to Current or Future to compute coverage.</p>
              </div>
            ) : useCases.length === 0 ? (
              <div className="card-compact border-[var(--cast-info)]/20 text-center py-6">
                <AlertTriangle className="text-[var(--cast-info)] mx-auto mb-2" size={20} />
                <p className="text-label text-[var(--cast-text)]">No use cases selected</p>
                <p className="text-badge text-[var(--cast-text-muted)] mt-1">Add use cases on Intake to score coverage.</p>
              </div>
            ) : (
              <>
                {/* Per-use-case breakdown — top 5 expandable */}
                {multiValidation.perUseCase.length > 0 && (
                  <UseCaseDrilldown perUseCase={multiValidation.perUseCase} />
                )}

                {/* Domain hierarchy — category-first with expand */}
                <DomainHierarchy
                  splitCoverage={splitCoverage}
                  relevantDomains={relevantDomains}
                  requiredSet={requiredSet}
                />
              </>
            )}

            {hasActiveSourcesForCoverage && useCases.length > 0
              && multiValidation.perUseCase.some((uc) => uc.suggestions?.length > 0) && (
              <GapSummaryPanel
                perUseCase={multiValidation.perUseCase}
                onJumpToSource={(sourceId, category) => {
                  const src = flatCatalog.find((s) => s.id === sourceId);
                  dispatch({
                    type: 'OPEN_SOURCE_FOR_CONFIG',
                    payload: { sourceId, category: category || src?.category },
                  });
                }}
              />
            )}

          </div>

          {/* Right column — Tabbed: Charts / Sources */}
          <div className="space-y-3 min-w-0">
            {configuredSources.length === 0 ? (
              <div className="card-compact border-[var(--cast-warning)]/20 text-center py-6">
                <AlertTriangle className="text-[var(--cast-warning)] mx-auto mb-2" size={20} />
                <p className="text-label text-[var(--cast-text)]">No sources configured</p>
                <p className="text-badge text-[var(--cast-text-muted)] mt-1">Configure sources on the Data Sources page.</p>
              </div>
            ) : (
              <>
                {/* Tab bar */}
                <div className="flex items-center gap-1 border-b border-[var(--cast-border)] pb-0">
                  {[{ key: 'charts', label: 'Ingest Charts' }, { key: 'summary', label: 'Summary' }, { key: 'sources', label: `Table (${configuredSources.length})` }].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setRightTab(tab.key)}
                      className={`px-3 py-1.5 text-tab-label transition-colors border-b-2 -mb-px ${
                        rightTab === tab.key
                          ? 'border-[var(--cast-accent)] text-[var(--cast-accent)]'
                          : 'border-transparent text-[var(--cast-text-muted)] hover:text-[var(--cast-text-secondary)]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {rightTab === 'charts' && chartSources.length > 0 && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="card-compact">
                      <IngestChart sources={chartSources} title="Ingest by Source" />
                    </div>
                    <div className="card-compact">
                      <IngestByCategory sources={chartSources} title="Ingest by Category" />
                    </div>
                  </div>
                )}

                {rightTab === 'summary' && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Low', value: totals.low, color: 'var(--cast-info)' },
                        { label: 'Expected', value: totals.expected, color: 'var(--cast-success)' },
                        { label: 'High', value: totals.high, color: 'var(--cast-warning)' },
                      ].map((m) => (
                        <div key={m.label} className="card-compact text-center !p-2">
                          <p className="text-metric-label">{m.label}</p>
                          <p className="text-lg font-bold" style={{ color: m.color }}>{m.value.toFixed(1)}</p>
                          <p className="text-metric-sub">GB/day</p>
                        </div>
                      ))}
                    </div>
                    <div className="card-compact !p-2">
                      <h4 className="text-section-kicker text-[var(--cast-text-muted)] mb-1.5">By Category</h4>
                      <div className="space-y-1">
                        {Object.entries(
                          configuredSources
                            .filter((s) => eligibleIds.has(s.id))
                            .reduce((acc, s) => {
                              const cat = s.category || 'Other';
                              if (!acc[cat]) acc[cat] = { count: 0, gb: 0 };
                              acc[cat].count += 1;
                              acc[cat].gb += s.gbExpected;
                              return acc;
                            }, {})
                        )
                          .sort(([, a], [, b]) => b.gb - a.gb)
                          .map(([cat, data]) => (
                            <div key={cat} className="flex items-center gap-2">
                              <span className="text-badge text-[var(--cast-text-secondary)] flex-1 truncate">{cat}</span>
                              <span className="text-badge text-[var(--cast-text-muted)]">{data.count} src</span>
                              <span className="text-badge font-mono font-medium text-[var(--cast-success)] w-14 text-right">{data.gb.toFixed(1)} GB</span>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="card-compact !p-2">
                      <h4 className="text-section-kicker text-[var(--cast-text-muted)] mb-1.5">Top Sources</h4>
                      <div className="space-y-0.5">
                        {configuredSources
                          .filter((s) => eligibleIds.has(s.id) && s.gbExpected > 0)
                          .sort((a, b) => b.gbExpected - a.gbExpected)
                          .slice(0, 8)
                          .map((s) => (
                            <div key={s.id} className="flex items-center gap-2 py-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status === 'current' ? 'bg-[var(--cast-success)]' : 'bg-[var(--cast-warning)]'}`} />
                              <span className="text-badge text-[var(--cast-text-secondary)] flex-1 truncate">{s.name}</span>
                              <span className="text-badge font-mono font-medium text-[var(--cast-success)]">{s.gbExpected.toFixed(1)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {rightTab === 'sources' && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-2 text-[var(--cast-text-muted)]" />
                      <input className="input-field !pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search sources..." />
                    </div>

                    <div className="card-compact !p-0 overflow-hidden">
                      <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        <table className="w-full text-badge">
                          <thead>
                            <tr className="border-b border-[var(--cast-border)] text-tiny uppercase tracking-wider text-[var(--cast-text-muted)]">
                              <th className="text-left py-1.5 px-2">Source</th>
                              <th className="text-left py-1.5 px-1">Status</th>
                              <th className="text-right py-1.5 px-1">Low</th>
                              <th className="text-right py-1.5 px-1">Expected</th>
                              <th className="text-right py-1.5 px-1">High</th>
                              <th className="text-center py-1.5 px-1">Conf.</th>
                              <th className="text-left py-1.5 px-1">Include</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSources.map((source) => {
                              const isExcluded = overlapExcludedIds.includes(source.id);
                              const active = source.status === 'current' || source.status === 'future';
                              const counts = eligibleIds.has(source.id);
                              const showNotConfigured = active && source.gbExpected <= 0 && !counts && !isExcluded;
                              const canManual = active && source.gbExpected <= 0 && !isExcluded;

                              return (
                                <tr
                                  key={source.id}
                                  className={`border-b border-[var(--cast-border)]/30 hover:bg-[var(--cast-panel-alt)]/50 ${isExcluded ? 'opacity-40' : ''} ${!isExcluded ? 'cursor-pointer' : ''}`}
                                  onClick={() => { if (!isExcluded) goToStep(STEP.SOURCES); }}
                                >
                                  <td className="py-1 px-2 font-medium text-[var(--cast-text)]">
                                    <span className={isExcluded ? 'line-through' : ''}>{source.name}</span>
                                    {source.isCustom && <span className="ml-1 text-badge text-[var(--cast-text-muted)]">custom</span>}
                                    {isExcluded && <span className="ml-1 text-badge text-[var(--cast-warning)]">overlap</span>}
                                    {showNotConfigured && (
                                      <span className="ml-1 text-[6px] px-0.5 rounded border border-[var(--cast-warning)]/40 text-[var(--cast-warning)]">Not configured</span>
                                    )}
                                  </td>
                                  <td className="py-1 px-1">
                                    <select
                                      value={source.status}
                                      onChange={(e) => { e.stopPropagation(); updateSourceField(source.id, 'status', e.target.value); }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="bg-transparent border-none text-badge cursor-pointer focus:outline-none text-[var(--cast-text-secondary)]"
                                    >
                                      <option value="current">Current</option>
                                      <option value="future">Future</option>
                                      <option value="skip">Not in scope</option>
                                    </select>
                                  </td>
                                  <td className={`py-1 px-1 text-right font-mono text-[var(--cast-info)] ${isExcluded ? 'line-through' : ''}`}>{source.gbLow.toFixed(1)}</td>
                                  <td className={`py-1 px-1 text-right font-mono text-[var(--cast-success)] font-semibold ${isExcluded ? 'line-through' : ''}`}>{source.gbExpected.toFixed(1)}</td>
                                  <td className={`py-1 px-1 text-right font-mono text-[var(--cast-warning)] ${isExcluded ? 'line-through' : ''}`}>{source.gbHigh.toFixed(1)}</td>
                                  <td className="py-1 px-1 text-center">
                                    <span className={`text-badge px-1 py-0.5 rounded border ${
                                      source.confidence === 'high' ? 'bg-[var(--cast-success)]/15 text-[var(--cast-success)] border-[var(--cast-success)]/25' :
                                      source.confidence === 'medium' ? 'bg-[var(--cast-warning)]/15 text-[var(--cast-warning)] border-[var(--cast-warning)]/25' :
                                      'bg-[var(--cast-text-muted)]/10 text-[var(--cast-text-muted)] border-[var(--cast-border)]'
                                    }`}>{source.confidence}</span>
                                  </td>
                                  <td className="py-1 px-1" onClick={(e) => e.stopPropagation()}>
                                    {canManual ? (
                                      <div className="flex flex-col gap-0.5">
                                        <label className="flex items-center gap-1 text-badge text-[var(--cast-text-muted)] cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={!!source.includeInTotals}
                                            onChange={(e) => {
                                              const on = e.target.checked;
                                              updateSourceField(source.id, 'includeInTotals', on);
                                              if (!on) updateSourceField(source.id, 'includeInTotalsReason', '');
                                            }}
                                            className="rounded border-[var(--cast-border)]"
                                          />
                                          Count
                                        </label>
                                        <input
                                          type="text"
                                          value={source.includeInTotalsReason || ''}
                                          onChange={(e) => updateSourceField(source.id, 'includeInTotalsReason', e.target.value)}
                                          placeholder="Reason"
                                          className="w-full max-w-[100px] px-1 py-0.5 rounded text-badge bg-[var(--cast-bg)] border border-[var(--cast-border)] text-[var(--cast-text)]"
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-tiny text-[var(--cast-text-muted)]">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-[var(--cast-accent)]/30 bg-[var(--cast-panel-alt)]">
                              <td colSpan={3} className="py-1 px-2 font-semibold text-[var(--cast-text)] text-badge">
                                Planning total (20% contingency per source)
                                <span className="text-tiny text-[var(--cast-text-muted)] ml-1">({countedSourceCount} sources)</span>
                              </td>
                              <td className="py-1 px-1 text-right font-mono font-bold text-[var(--cast-info)]">{totals.low.toFixed(1)}</td>
                              <td className="py-1 px-1 text-right font-mono font-bold text-[var(--cast-success)]">{totals.expected.toFixed(1)}</td>
                              <td className="py-1 px-1 text-right font-mono font-bold text-[var(--cast-warning)]">{totals.high.toFixed(1)}</td>
                              <td colSpan={2} />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
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
