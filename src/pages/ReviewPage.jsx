import { useMemo, useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useWorkflowNavigation } from '../hooks/useWorkflowNavigation.js';
import PageHeaderActions from '../components/layout/PageHeaderActions';
import WorkflowStepIndicator from '../components/layout/WorkflowStepIndicator';
import { SHOW_COVERAGE_PAGE } from '../config/featureFlags.js';
import { STEP } from '../config/workflowSteps.js';
import { formatIngestString, formatIngestValue } from '../utils/formatIngestDisplay.js';
import { truncateSubtitle } from '../utils/displayLabels.js';
import { buildReviewGateData, formatQuantityUnit } from '../services/reviewGateEngine.js';
import sourceCatalog from '../data/sources.json';
import { flattenSourceCatalog } from '../services/sizingEngine.js';

import { RANGE_CAPTION, TOTAL_CONFIGURED_INGEST_LABEL, OVERLAP_ANNOTATE_ONLY_NOTE } from '../constants/customerFacingCopy.js';
import { Link2, ChevronDown, CircleDot } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sources', label: 'Sources' },
  { id: 'missing', label: 'Not yet sized' },
  { id: 'overlaps', label: 'Shared telemetry' },
];

const flatCatalog = flattenSourceCatalog(sourceCatalog);

function RelevanceBar({ score }) {
  const pct = Math.max(10, Math.min(100, (score / 10) * 100));
  return (
    <div className="flex items-center gap-2 min-w-[5.5rem]">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--cast-panel-alt)] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--cast-accent)] to-[var(--cast-success)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-bold tabular-nums text-[var(--cast-text-muted)] w-7 text-right">{score}/10</span>
    </div>
  );
}

function RangeBandBar({ low, expected, high }) {
  const span = Math.max(high - low, 0.001);
  const expectedPct = Math.max(0, Math.min(100, ((expected - low) / span) * 100));

  return (
    <div className="space-y-2">
      <div className="relative h-3 rounded-full bg-[var(--cast-panel-alt)] overflow-hidden border border-[var(--cast-border)]/60">
        <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-[var(--cast-accent)]/18 via-[var(--cast-info)]/28 to-[var(--cast-accent)]/18" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[var(--cast-accent)] border-2 border-[var(--cast-panel)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--cast-accent)_40%,transparent)]"
          style={{ left: `calc(${expectedPct}% - 5px)` }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between text-label text-[var(--cast-text-muted)] tabular-nums">
        <span>{formatIngestString(low)}</span>
        <span className="font-semibold text-[var(--cast-accent)]">{formatIngestString(expected)}</span>
        <span>{formatIngestString(high)}</span>
      </div>
      <p className="text-center text-badge text-[var(--cast-text-muted)]">
        {RANGE_CAPTION} (low — expected — high)
      </p>
    </div>
  );
}

function TopSourcesBarChart({ rows }) {
  if (!rows.length) {
    return (
      <p className="text-label text-[var(--cast-text-muted)] text-center py-4">Configure sources to see ingest breakdown.</p>
    );
  }

  const maxGb = rows[0]?.gbExpected || 1;

  return (
    <div className="space-y-2.5">
      <h4 className="text-label font-semibold text-[var(--cast-text-muted)] uppercase tracking-wide">Top sources by ingest</h4>
      {rows.map((row, index) => {
        const pct = Math.max(4, Math.min(100, (row.gbExpected / maxGb) * 100));
        const barOpacity = Math.max(0.35, 1 - index * 0.14);
        return (
          <div key={row.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-label">
              <span className="truncate text-[var(--cast-text-secondary)]">{row.name}</span>
              <span className="font-mono font-semibold text-[var(--cast-text)] shrink-0 tabular-nums">{formatIngestString(row.gbExpected)}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--cast-panel-alt)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--cast-accent)]"
                style={{ width: `${pct}%`, opacity: barOpacity }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OverlapPairVisual({ overlap, onEditSource }) {
  const [expanded, setExpanded] = useState(false);
  const names =
    overlap.sourceNames?.length === 2
      ? overlap.sourceNames
      : overlap.sourceIds.map(
          (id) => flatCatalog.find((s) => s.id === id)?.name || id.replace(/_/g, ' '),
        );
  const telemetry = (overlap.sharedTelemetry || []).slice(0, 5);
  const panelId = `overlap-detail-${overlap.pairKey}`;

  return (
    <article className="rounded-xl border border-[var(--cast-warning)]/30 bg-[var(--cast-panel)] p-4 sm:p-5 space-y-4">
      {overlap.groupLabel && (
        <p className="text-badge font-semibold uppercase tracking-wide text-[var(--cast-warning)]">{overlap.groupLabel}</p>
      )}
      <p className="text-sm text-[var(--cast-text-secondary)] leading-relaxed">{overlap.summary || overlap.message}</p>

      <div className="flex items-center justify-center gap-0 py-1">
        <button
          type="button"
          onClick={() => onEditSource(overlap.sourceIds[0])}
          className="relative z-10 rounded-full border-2 border-[var(--cast-accent)]/40 bg-[var(--cast-accent-muted)] px-4 py-2 text-label font-medium text-[var(--cast-accent)] hover:border-[var(--cast-accent)] max-w-[38%] truncate"
        >
          {names[0]}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="relative flex flex-col items-center justify-center w-[5.5rem] shrink-0 -mx-1 z-20 group"
        >
          <div className="relative flex items-center justify-center w-16 h-12" aria-hidden>
            <div className="absolute w-10 h-10 rounded-full bg-[var(--cast-warning)]/25 border border-[var(--cast-warning)]/40 left-0 top-1 transition-transform group-hover:scale-105" />
            <div className="absolute w-10 h-10 rounded-full bg-[var(--cast-accent)]/20 border border-[var(--cast-accent)]/35 right-0 top-1 transition-transform group-hover:scale-105" />
          </div>
          <span className="text-[10px] font-semibold text-[var(--cast-warning)] tracking-wide mt-0.5 group-hover:text-[var(--cast-accent)]">
            {expanded ? 'Hide' : 'What overlaps?'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onEditSource(overlap.sourceIds[1])}
          className="relative z-10 rounded-full border-2 border-[var(--cast-accent)]/40 bg-[var(--cast-accent-muted)] px-4 py-2 text-label font-medium text-[var(--cast-accent)] hover:border-[var(--cast-accent)] max-w-[38%] truncate"
        >
          {names[1]}
        </button>
      </div>

      {expanded && (
        <div
          id={panelId}
          className="rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/40 p-4 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-[var(--cast-text)]">
              Telemetry that may appear in both sources
            </h4>
            <ChevronDown size={16} className="text-[var(--cast-text-muted)] rotate-180 shrink-0" aria-hidden />
          </div>

          {telemetry.length > 0 && (
            <ul className="space-y-2.5">
              {telemetry.map((item) => (
                <li key={item.label} className="flex gap-2.5 text-sm leading-relaxed">
                  <CircleDot size={16} className="text-[var(--cast-accent)] shrink-0 mt-0.5" aria-hidden />
                  <span className="text-[var(--cast-text-secondary)]">
                    <span className="font-medium text-[var(--cast-text)]">{item.label}</span>
                    {item.example ? (
                      <span className="text-[var(--cast-text-muted)]"> — {item.example}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {overlap.confirmQuestion && (
            <p className="text-sm text-[var(--cast-text-secondary)] leading-relaxed border-l-2 border-[var(--cast-accent)]/40 pl-3">
              <span className="font-semibold text-[var(--cast-text)]">Confirm during planning: </span>
              {overlap.confirmQuestion}
            </p>
          )}

          {telemetry.length > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center text-[11px] sm:text-xs">
              <div className="rounded-lg border border-[var(--cast-border)] bg-[var(--cast-panel)]/60 p-2 space-y-1">
                <p className="font-semibold text-[var(--cast-accent)] truncate" title={names[0]}>{names[0]}</p>
                <p className="text-[var(--cast-text-muted)] leading-snug">Source A collection path</p>
              </div>
              <div className="rounded-lg border border-[var(--cast-warning)]/30 bg-[var(--cast-warning)]/5 p-2 space-y-1">
                <p className="font-semibold text-[var(--cast-warning)] flex items-center justify-center gap-1">
                  <Link2 size={12} aria-hidden />
                  Shared
                </p>
                <ul className="text-[var(--cast-text-muted)] space-y-0.5 leading-snug">
                  {telemetry.slice(0, 3).map((item) => (
                    <li key={`mid-${item.label}`}>{item.label}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-[var(--cast-border)] bg-[var(--cast-panel)]/60 p-2 space-y-1">
                <p className="font-semibold text-[var(--cast-accent)] truncate" title={names[1]}>{names[1]}</p>
                <p className="text-[var(--cast-text-muted)] leading-snug">Source B collection path</p>
              </div>
            </div>
          )}

          {overlap.hint && (
            <p className="text-label text-[var(--cast-text-muted)] leading-relaxed">{overlap.hint}</p>
          )}
        </div>
      )}
    </article>
  );
}

function ReviewTabBar({ activeTab, onChange, counts }) {
  return (
    <div className="border-b border-[var(--cast-border)] bg-[var(--cast-panel)]/80 shrink-0">
      <nav className="flex gap-1 px-4 overflow-x-auto hidden-scrollbar" aria-label="Review sections">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={`px-3 py-2.5 text-label font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-[var(--cast-accent)] text-[var(--cast-accent)]'
                  : 'border-transparent text-[var(--cast-text-muted)] hover:text-[var(--cast-text-secondary)]'
              }`}
            >
              {tab.label}
              {count != null && count > 0 && tab.id !== 'overview' ? (
                <span className="ml-1.5 text-badge tabular-nums opacity-80">({count})</span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function ReviewPage() {
  const { state, dispatch } = useApp();
  const { goToStep } = useWorkflowNavigation();
  const [activeTab, setActiveTab] = useState('overview');

  const sizingCtx = useMemo(
    () => ({ catalog: sourceCatalog, allInputs: state.sources }),
    [state.sources],
  );

  const review = useMemo(
    () =>
      buildReviewGateData({
        catalog: sourceCatalog,
        sourceStates: state.sources,
        overlapDecisions: state.overlapDecisions,
        sizingContext: sizingCtx,
        intake: state.intake,
      }),
    [state.sources, state.overlapDecisions, sizingCtx, state.intake],
  );

  const { totals, configuredRows, configuredCount, missingPriorities, missingPriorityCount, overlaps } = review;

  const sortedConfiguredRows = useMemo(
    () => [...configuredRows].sort((a, b) => (b.gbExpected ?? 0) - (a.gbExpected ?? 0)),
    [configuredRows],
  );

  const topFiveSources = useMemo(() => sortedConfiguredRows.slice(0, 5), [sortedConfiguredRows]);

  const expectedDisplay = formatIngestValue(totals.expected);

  const openSourceEditor = useCallback(
    (sourceId, category) => {
      dispatch({
        type: 'OPEN_SOURCE_FOR_CONFIG',
        payload: { sourceId, category: category || null },
      });
      goToStep(STEP.SOURCES);
    },
    [dispatch, goToStep],
  );

  return (
    <div className="page-viewport">
      <div className="page-header shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h2>Review &amp; Confirm</h2>
            <WorkflowStepIndicator currentStep={STEP.REVIEW} />
          </div>
          <p className="hidden sm:block text-label text-[var(--cast-text-muted)]">
            Confirm your sized sources before choosing a path
          </p>
        </div>
        <PageHeaderActions
          state={state}
          backLabel="Sources"
          onBack={() => goToStep(STEP.SOURCES)}
          continueLabel={SHOW_COVERAGE_PAGE ? 'Coverage' : 'Paths'}
          onContinue={() => goToStep(SHOW_COVERAGE_PAGE ? STEP.COVERAGE : STEP.PATHS)}
          exportHint="splunk-scope-review"
        />
      </div>

      <ReviewTabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        counts={{
          sources: configuredCount,
          missing: missingPriorityCount,
          overlaps: overlaps.length,
        }}
      />

      <div className="page-scroll py-4 sm:py-6">
        <div className="page-content-width">
        {activeTab === 'overview' && (
          <section className="max-w-3xl mx-auto space-y-6" role="tabpanel">
            <div className="card-compact text-center py-8 sm:py-10">
              <p className="text-metric-label text-[var(--cast-text-muted)] mb-2 uppercase tracking-wide">{TOTAL_CONFIGURED_INGEST_LABEL}</p>
              <p className="text-5xl sm:text-6xl lg:text-7xl font-black tabular-nums text-[var(--cast-accent)] leading-none">
                {expectedDisplay.text}
              </p>
              <p className="text-lg sm:text-xl font-semibold text-[var(--cast-text-muted)] mt-1">{expectedDisplay.unit || 'GB/day'}</p>
              <p className="text-sm text-[var(--cast-text-muted)] mt-3 max-w-md mx-auto leading-relaxed">
                Estimated daily volume from sources you sized together
              </p>

              <div className="flex flex-wrap justify-center gap-2 mt-6">
                <span className="text-badge px-3 py-1 rounded-full bg-[var(--cast-success)]/10 text-[var(--cast-success)] border border-[var(--cast-success)]/25 font-semibold">
                  {configuredCount} configured
                </span>
                <span
                  className={`text-badge px-3 py-1 rounded-full border font-semibold ${
                    missingPriorityCount > 0
                      ? 'bg-[var(--cast-warning)]/10 text-[var(--cast-warning)] border-[var(--cast-warning)]/25'
                      : 'bg-[var(--cast-panel-alt)] text-[var(--cast-text-muted)] border-[var(--cast-border)]'
                  }`}
                >
                  {missingPriorityCount} not yet sized
                </span>
              </div>
            </div>

            <div className="card-compact">
              <RangeBandBar low={totals.low} expected={totals.expected} high={totals.high} />
            </div>

            <div className="card-compact">
              <TopSourcesBarChart rows={topFiveSources} />
            </div>
          </section>
        )}

        {activeTab === 'sources' && (
          <section className="max-w-3xl mx-auto space-y-2" role="tabpanel">
            {sortedConfiguredRows.length === 0 ? (
              <div className="card-compact text-center py-10">
                <p className="text-label text-[var(--cast-text-muted)]">No configured sources yet. Return to Sources to add sizing.</p>
              </div>
            ) : (
              sortedConfiguredRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => openSourceEditor(row.id, row.category)}
                  className="card-compact w-full text-left flex flex-wrap items-center gap-3 hover:border-[var(--cast-border-strong)] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--cast-text)]">
                      {row.name}
                      {row.isCustom && <span className="ml-1 text-badge text-purple-400">custom</span>}
                    </p>
                    <p className="text-label text-[var(--cast-text-muted)] mt-0.5">{formatQuantityUnit(row)}</p>
                  </div>
                  <p className="font-mono font-bold text-[var(--cast-text)] tabular-nums shrink-0">{formatIngestString(row.gbExpected)}</p>
                  <span className="text-label text-[var(--cast-accent)] font-medium shrink-0">Edit</span>
                </button>
              ))
            )}
          </section>
        )}

        {activeTab === 'missing' && (
          <section className="max-w-3xl mx-auto space-y-2" role="tabpanel">
            {missingPriorities.length === 0 ? (
              <div className="card-compact text-center py-10">
                <p className="text-label text-[var(--cast-text-muted)]">All Analysis priority sources are configured.</p>
              </div>
            ) : (
              missingPriorities.map((p) => (
                <div key={p.sourceId} className="card-compact flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-semibold text-[var(--cast-text)]">{p.sourceName}</p>
                      <RelevanceBar score={p.relevanceScore1to10} />
                    </div>
                    {p.appLabels?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.appLabels.map((label) => (
                          <span
                            key={label}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--cast-panel-alt)] text-[var(--cast-text-secondary)] border border-[var(--cast-border)]"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-label text-[var(--cast-text-muted)] line-clamp-2">{truncateSubtitle(p.whyOneLine)}</p>
                  </div>
                  <button
                    type="button"
                    className="text-label text-[var(--cast-accent)] font-medium hover:underline shrink-0"
                    onClick={() => openSourceEditor(p.sourceId)}
                  >
                    Add sizing
                  </button>
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === 'overlaps' && (
          <section className="max-w-3xl mx-auto space-y-4" role="tabpanel">
            <p className="text-label text-[var(--cast-text-muted)]">
              {OVERLAP_ANNOTATE_ONLY_NOTE}
            </p>
            {overlaps.length === 0 ? (
              <div className="card-compact text-center py-10">
                <p className="text-label text-[var(--cast-text-muted)]">No shared telemetry pairs among configured sources.</p>
              </div>
            ) : (
              overlaps.map((o) => (
                <OverlapPairVisual key={o.pairKey} overlap={o} onEditSource={(id) => openSourceEditor(id)} />
              ))
            )}
          </section>
        )}
        </div>
      </div>
    </div>
  );
}
