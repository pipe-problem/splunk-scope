import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog } from '../services/sizingEngine';
import { calculateCoverage, validateMultiUseCase, TELEMETRY_DOMAINS, formatDomainForCustomer } from '../services/coverageEngine';
import { resolveUseCaseProfiles } from '../services/useCaseResolver';
import { sumSessionPlanningIngest } from '../services/planningIngestTotals.js';
import { GitCompare, ChevronDown, TrendingUp, TrendingDown, Minus, ArrowLeft } from 'lucide-react';

const flatCatalog = flattenSourceCatalog(sourceCatalog);

function formatDomainLabel(domain) {
  return domain.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeScenarioMetrics(scenario) {
  const sizingCtx = { catalog: sourceCatalog, allInputs: scenario.sources };
  const session = sumSessionPlanningIngest({
    catalog: sourceCatalog,
    sourceStates: scenario.sources,
    overlapDecisions: scenario.overlapDecisions || {},
    sizingContext: sizingCtx,
  });
  const totals = session.totals;
  const sourceResults = Object.fromEntries(
    session.eligible.map((row) => [
      row.id,
      { expected: row.rawExpected ?? row.gbExpected ?? 0, low: row.gbLow, high: row.gbHigh },
    ]),
  );
  const activeSources = flatCatalog.filter((s) => sourceResults[s.id]);
  const coverage = calculateCoverage(activeSources);
  const { profiles: useCases } = resolveUseCaseProfiles(scenario.intake || {});
  const coverageValidation = validateMultiUseCase(coverage, useCases);

  const currentCount = Object.values(scenario.sources).filter((s) => s.status === 'current').length;
  const futureCount = Object.values(scenario.sources).filter((s) => s.status === 'future').length;

  return { sourceResults, totals, coverage, coverageValidation, currentCount, futureCount, activeSources };
}

function DeltaIndicator({ value, suffix = '', invert = false }) {
  if (value === 0) {
    return (
      <span className="text-badge text-[var(--cast-text-muted)] flex items-center gap-1 justify-center">
        <Minus size={12} /> No change
      </span>
    );
  }
  const positive = invert ? value < 0 : value > 0;
  return (
    <span className={`text-badge flex items-center gap-1 justify-center ${positive ? 'text-[var(--cast-success)]' : 'text-[var(--cast-critical)]'}`}>
      {value > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {value > 0 ? '+' : ''}
      {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}
      {suffix}
    </span>
  );
}

export default function ScenarioComparisonPage() {
  const { state, dispatch } = useApp();
  const { scenarios } = state;
  const [leftId, setLeftId] = useState(scenarios[0]?.id || '');
  const [rightId, setRightId] = useState(scenarios[1]?.id || '');
  const [showUnchangedDomains, setShowUnchangedDomains] = useState(false);

  const leftScenario = scenarios.find((s) => s.id === leftId);
  const rightScenario = scenarios.find((s) => s.id === rightId);

  const leftMetrics = useMemo(
    () => (leftScenario ? computeScenarioMetrics(leftScenario) : null),
    [leftScenario],
  );
  const rightMetrics = useMemo(
    () => (rightScenario ? computeScenarioMetrics(rightScenario) : null),
    [rightScenario],
  );

  if (scenarios.length < 2) {
    return (
      <div className="page-viewport">
        <div className="page-header shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2>Scenario Comparison</h2>
          </div>
          <button type="button" onClick={() => dispatch({ type: 'SET_STEP', payload: 0 })} className="btn-secondary flex items-center gap-1.5">
            <ArrowLeft size={14} /> Back
          </button>
        </div>
        <div className="page-scroll flex items-center justify-center">
          <div className="text-center space-y-3 py-12 max-w-md px-4">
            <GitCompare size={36} className="text-[var(--cast-text-muted)] mx-auto" />
            <p className="text-empty-title">Save at least two scenarios to compare them side by side.</p>
            <p className="text-empty-body">Use the sidebar to save your current session as a named scenario, then return here.</p>
          </div>
        </div>
      </div>
    );
  }

  const allSourceIds = new Set();
  if (leftMetrics) Object.keys(leftMetrics.sourceResults).forEach((id) => allSourceIds.add(id));
  if (rightMetrics) Object.keys(rightMetrics.sourceResults).forEach((id) => allSourceIds.add(id));

  const sourceDiffs = [];
  for (const id of allSourceIds) {
    const left = leftMetrics?.sourceResults[id];
    const right = rightMetrics?.sourceResults[id];
    const name = flatCatalog.find((s) => s.id === id)?.name || id;
    sourceDiffs.push({
      id,
      name,
      leftGB: left?.expected || 0,
      rightGB: right?.expected || 0,
      onlyLeft: !!left && !right,
      onlyRight: !left && !!right,
    });
  }
  sourceDiffs.sort((a, b) => Math.abs(b.rightGB - b.leftGB) - Math.abs(a.rightGB - a.leftGB));
  const meaningfulSourceDiffs = sourceDiffs.filter((s) => s.onlyLeft || s.onlyRight || Math.abs(s.rightGB - s.leftGB) >= 0.05);

  const domainDiffs = [];
  if (leftMetrics && rightMetrics) {
    for (const domain of TELEMETRY_DOMAINS) {
      const leftPct = leftMetrics.coverage[domain]?.score || 0;
      const rightPct = rightMetrics.coverage[domain]?.score || 0;
      if (leftPct > 0 || rightPct > 0) {
        domainDiffs.push({ domain, label: formatDomainForCustomer(domain), leftPct, rightPct });
      }
    }
  }
  const meaningfulDomainDiffs = domainDiffs.filter((d) => Math.abs(d.rightPct - d.leftPct) >= 0.05);
  const visibleDomainDiffs = showUnchangedDomains ? domainDiffs : meaningfulDomainDiffs;

  return (
    <div className="page-viewport">
      <div className="page-header shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h2>Scenario Comparison</h2>
          <p className="hidden sm:block page-subtitle">Compare ingest, coverage, and source mix between saved scenarios</p>
        </div>
        <button type="button" onClick={() => dispatch({ type: 'SET_STEP', payload: 0 })} className="btn-secondary flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <div className="page-scroll p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-label font-medium text-[var(--cast-text-secondary)]">Baseline scenario</label>
            <div className="relative">
              <select
                value={leftId}
                onChange={(e) => setLeftId(e.target.value)}
                className="w-full px-3 py-2.5 bg-[var(--cast-bg)] border border-[var(--cast-border)] rounded-lg text-[var(--cast-text)] appearance-none pr-8"
              >
                <option value="">Select scenario…</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cast-text-muted)] pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-label font-medium text-[var(--cast-text-secondary)]">Comparison scenario</label>
            <div className="relative">
              <select
                value={rightId}
                onChange={(e) => setRightId(e.target.value)}
                className="w-full px-3 py-2.5 bg-[var(--cast-bg)] border border-[var(--cast-border)] rounded-lg text-[var(--cast-text)] appearance-none pr-8"
              >
                <option value="">Select scenario…</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cast-text-muted)] pointer-events-none" />
            </div>
          </div>
        </div>

        {leftMetrics && rightMetrics && (
          <>
            <div className="rounded-xl border border-[var(--cast-accent)]/25 bg-[var(--cast-accent-muted)] p-4">
              <p className="text-card-header mb-2">What changed</p>
              <ul className="text-label text-[var(--cast-text-secondary)] space-y-1">
                <li>
                  Expected ingest: {leftMetrics.totals.raw.expected.toFixed(1)} → {rightMetrics.totals.raw.expected.toFixed(1)} GB/day
                  ({rightMetrics.totals.raw.expected - leftMetrics.totals.raw.expected >= 0 ? '+' : ''}
                  {(rightMetrics.totals.raw.expected - leftMetrics.totals.raw.expected).toFixed(1)} GB/day)
                </li>
                <li>
                  Coverage: {leftMetrics.coverageValidation.overallScore}% → {rightMetrics.coverageValidation.overallScore}%
                  ({rightMetrics.coverageValidation.overallScore - leftMetrics.coverageValidation.overallScore >= 0 ? '+' : ''}
                  {rightMetrics.coverageValidation.overallScore - leftMetrics.coverageValidation.overallScore}%)
                </li>
                <li>{meaningfulSourceDiffs.length} source(s) with meaningful ingest differences</li>
                <li>{meaningfulDomainDiffs.length} coverage domain(s) changed</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card-compact text-center p-4">
                <p className="text-metric-label mb-2">Expected ingest (GB/day)</p>
                <div className="flex items-center justify-center gap-3 text-body">
                  <span className="text-xl font-bold text-[var(--cast-text)]">{leftMetrics.totals.raw.expected.toFixed(1)}</span>
                  <span className="text-[var(--cast-text-muted)]">→</span>
                  <span className="text-xl font-bold text-[var(--cast-text)]">{rightMetrics.totals.raw.expected.toFixed(1)}</span>
                </div>
                <DeltaIndicator value={rightMetrics.totals.raw.expected - leftMetrics.totals.raw.expected} suffix=" GB/day" />
              </div>
              <div className="card-compact text-center p-4">
                <p className="text-metric-label mb-2">Configured sources</p>
                <div className="flex items-center justify-center gap-3 text-body">
                  <span className="text-xl font-bold text-[var(--cast-text)]">{leftMetrics.currentCount + leftMetrics.futureCount}</span>
                  <span className="text-[var(--cast-text-muted)]">→</span>
                  <span className="text-xl font-bold text-[var(--cast-text)]">{rightMetrics.currentCount + rightMetrics.futureCount}</span>
                </div>
                <DeltaIndicator
                  value={(rightMetrics.currentCount + rightMetrics.futureCount) - (leftMetrics.currentCount + leftMetrics.futureCount)}
                  suffix=" sources"
                />
              </div>
              <div className="card-compact text-center p-4">
                <p className="text-metric-label mb-2">Overall coverage</p>
                <div className="flex items-center justify-center gap-3 text-body">
                  <span className="text-xl font-bold text-[var(--cast-text)]">{leftMetrics.coverageValidation.overallScore}%</span>
                  <span className="text-[var(--cast-text-muted)]">→</span>
                  <span className="text-xl font-bold text-[var(--cast-text)]">{rightMetrics.coverageValidation.overallScore}%</span>
                </div>
                <DeltaIndicator
                  value={rightMetrics.coverageValidation.overallScore - leftMetrics.coverageValidation.overallScore}
                  suffix="%"
                />
              </div>
            </div>

            {visibleDomainDiffs.length > 0 && (
              <details className="collapsible" open>
                <summary className="flex items-center gap-2 p-3 rounded-lg bg-[var(--cast-panel)] border border-[var(--cast-border)] cursor-pointer">
                  <span className="text-body font-medium text-[var(--cast-text)]">Coverage by domain</span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setShowUnchangedDomains(!showUnchangedDomains); }}
                    className="text-label text-[var(--cast-accent)] ml-auto hover:underline"
                  >
                    {showUnchangedDomains ? 'Hide unchanged' : 'Show unchanged'}
                  </button>
                </summary>
                <div className="mt-3 space-y-2">
                  {visibleDomainDiffs.map((d) => (
                    <div key={d.domain} className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cast-bg)]">
                      <span className="text-label text-[var(--cast-text)] w-full sm:w-40 truncate">{d.label}</span>
                      <div className="flex-1 flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-2 bg-[var(--cast-panel-alt)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--cast-text-muted)] rounded-full" style={{ width: `${Math.round(d.leftPct * 100)}%` }} />
                        </div>
                        <span className="text-badge text-[var(--cast-text-muted)] w-10 text-right">{Math.round(d.leftPct * 100)}%</span>
                      </div>
                      <span className="text-[var(--cast-text-muted)] hidden sm:inline">→</span>
                      <div className="flex-1 flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-2 bg-[var(--cast-panel-alt)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--cast-accent)] rounded-full" style={{ width: `${Math.round(d.rightPct * 100)}%` }} />
                        </div>
                        <span className="text-badge text-[var(--cast-text-muted)] w-10 text-right">{Math.round(d.rightPct * 100)}%</span>
                      </div>
                      <DeltaIndicator value={Math.round((d.rightPct - d.leftPct) * 100)} suffix="%" />
                    </div>
                  ))}
                </div>
              </details>
            )}

            <details className="collapsible">
              <summary className="flex items-center gap-2 p-3 rounded-lg bg-[var(--cast-panel)] border border-[var(--cast-border)] cursor-pointer">
                <span className="text-body font-medium text-[var(--cast-text)]">Source differences</span>
                <span className="text-badge text-[var(--cast-text-muted)] ml-auto">{sourceDiffs.length} sources</span>
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-label">
                  <thead>
                    <tr className="border-b border-[var(--cast-border)]">
                      <th className="text-left py-2 px-3 text-[var(--cast-text-muted)] font-medium">Source</th>
                      <th className="text-right py-2 px-3 text-[var(--cast-text-muted)] font-medium">Baseline GB/day</th>
                      <th className="text-right py-2 px-3 text-[var(--cast-text-muted)] font-medium">Comparison GB/day</th>
                      <th className="text-right py-2 px-3 text-[var(--cast-text-muted)] font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meaningfulSourceDiffs.map((s) => (
                      <tr key={s.id} className="border-b border-[var(--cast-border)]/50">
                        <td className="py-2 px-3 text-[var(--cast-text)]">
                          {s.name}
                          {s.onlyLeft && <span className="ml-2 text-badge text-[var(--cast-critical)]">(removed)</span>}
                          {s.onlyRight && <span className="ml-2 text-badge text-[var(--cast-success)]">(added)</span>}
                        </td>
                        <td className="text-right py-2 px-3 text-[var(--cast-text-muted)]">{s.leftGB > 0 ? s.leftGB.toFixed(2) : '—'}</td>
                        <td className="text-right py-2 px-3 text-[var(--cast-text-muted)]">{s.rightGB > 0 ? s.rightGB.toFixed(2) : '—'}</td>
                        <td className="text-right py-2 px-3">
                          <DeltaIndicator value={parseFloat((s.rightGB - s.leftGB).toFixed(2))} suffix=" GB" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
