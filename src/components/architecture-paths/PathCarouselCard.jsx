import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import DonutChart from '../DonutChart.jsx';
import { formatIngestString } from '../../utils/formatIngestDisplay.js';
import { getPathTotals } from '../../services/pathDisplayHelpers.js';
import { buildPathCardDonutData, resolvePoweredAppLinks } from './pathCarouselCardHelpers.js';
import { SELECTED_PATH_INGEST_LABEL, RANGE_CAPTION } from '../../constants/customerFacingCopy.js';

const DONUT_COLORS = [
  'var(--cast-accent)',
  'var(--cast-info)',
  'var(--cast-success)',
  'var(--cast-warning)',
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
  '#ec4899',
];

function MetricPill({ label, value }) {
  return (
    <div className="path-card-metric">
      <span className="path-card-metric__value">{value}</span>
      <span className="path-card-metric__label">{label}</span>
    </div>
  );
}

function CategoryDetailPanel({ category, sources, segments, onSelectCategory }) {
  const coloredSegments = useMemo(
    () =>
      (segments || []).map((s, i) => ({
        ...s,
        color: s.color || DONUT_COLORS[i % DONUT_COLORS.length],
      })),
    [segments],
  );

  if (!category) {
    return (
      <div className="path-card-category-panel">
        <p className="path-card-category-panel__prompt">Select a category</p>
        <ul className="path-card-slice-legend" aria-label="Category slices">
          {coloredSegments.map((seg) => (
            <li key={seg.label}>
              <button
                type="button"
                className="path-card-slice-legend__item path-card-slice-legend__button"
                onClick={() => onSelectCategory?.(seg.label)}
              >
                <span className="path-card-slice-legend__dot" style={{ background: seg.color }} aria-hidden />
                <span className="path-card-slice-legend__label">{seg.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const totalGb = sources.reduce((sum, row) => sum + row.gbExpected, 0);

  return (
    <div className="path-card-category-panel path-card-category-panel--active">
      <div className="flex items-baseline justify-between gap-2 mb-1.5 shrink-0">
        <h5 className="text-sm font-semibold text-[var(--cast-text)] leading-snug">{category}</h5>
        <span className="text-badge font-mono text-[var(--cast-text)] tabular-nums shrink-0">
          {formatIngestString(totalGb)}
        </span>
      </div>
      <ul className="path-card-donut-source-list space-y-0.5">
        {sources.map((row) => (
          <li key={row.id} className="flex items-center gap-2 text-tiny">
            <span className="text-[var(--cast-text-secondary)] truncate flex-1">{row.name}</span>
            <span className="font-mono text-[var(--cast-text)] tabular-nums shrink-0">
              {formatIngestString(row.gbExpected)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Premium path card — ingest band, powers, category donut.
 */
export default function PathCarouselCard({
  plan,
  sourceStates = {},
  isCenter = false,
  isReportPath = false,
  onSelectForReport,
}) {
  const [pinnedCategory, setPinnedCategory] = useState(null);
  const [hoverCategory, setHoverCategory] = useState(null);

  const totals = getPathTotals(plan);
  const sourceCount = plan?.sources?.length ?? 0;
  const activeCategory = hoverCategory ?? pinnedCategory;

  const appsPowered = plan?.appsPowered;
  const appLinks = useMemo(
    () => resolvePoweredAppLinks(appsPowered || []),
    [appsPowered],
  );

  const { segments, sourcesByCategory, totalExpected } = useMemo(
    () => buildPathCardDonutData(plan, sourceStates),
    [plan, sourceStates],
  );

  const activeSources = activeCategory ? sourcesByCategory[activeCategory] || [] : [];

  function handleDonutHover(_index, slice) {
    setHoverCategory(slice?.label ?? null);
  }

  function handleDonutClick(_index, slice) {
    if (slice?.label) setPinnedCategory(slice.label);
  }

  const body = (
    <>
      <header className="path-card-row path-card-row--title">
        <h3 className="text-xl font-bold text-[var(--cast-text)] leading-snug">{plan.name}</h3>
      </header>

      <div className="path-card-metrics path-card-metrics--three">
        <MetricPill label={SELECTED_PATH_INGEST_LABEL} value={formatIngestString(totals.expected)} />
        <MetricPill
          label={RANGE_CAPTION}
          value={`${formatIngestString(totals.low)} – ${formatIngestString(totals.high)}`}
        />
        <MetricPill label="Sources" value={String(sourceCount)} />
      </div>

      <section className="path-card-section path-card-section--powers">
        <h4 className="path-card-section__title">Powers</h4>
        {appLinks.length === 0 ? (
          <p className="text-tiny text-[var(--cast-text-muted)]">No Splunk apps mapped yet.</p>
        ) : (
          <ul className="path-card-app-list path-card-app-list--wide">
            {appLinks.slice(0, 6).map((app) => (
              <li key={app.id}>
                {app.url ? (
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="path-card-app-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">{app.name}</span>
                    <ExternalLink size={12} className="shrink-0 opacity-70" />
                  </a>
                ) : (
                  <span className="path-card-app-name">{app.name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="path-card-section path-card-section--donut">
        <h4 className="path-card-section__title">Ingest by category</h4>
        <div className="path-card-donut-row">
          <div className="path-card-donut-chart-wrap">
            <DonutChart
              segments={segments}
              size={180}
              strokeWidth={24}
              showLegend={false}
              presentationScale={false}
              expandOnHover={false}
              centerMode="total-only"
              centerValue={totalExpected}
              centerLabel="GB/day"
              onHoverChange={handleDonutHover}
              onSliceClick={handleDonutClick}
            />
          </div>
          <CategoryDetailPanel
            category={activeCategory}
            sources={activeSources}
            segments={segments}
            onSelectCategory={setPinnedCategory}
          />
        </div>
      </section>
    </>
  );

  return (
    <div className={`plan-path-card-inner ${isCenter ? 'plan-path-card-inner--center' : ''}`}>
      <div className="plan-path-card-inner__body">{body}</div>

      {isCenter && (
        <footer className="path-card-footer path-card-footer--sticky">
          {isReportPath ? (
            <span className="path-card-cta path-card-cta--selected">Selected</span>
          ) : (
            <button
              type="button"
              className="path-card-cta"
              onClick={(e) => {
                e.stopPropagation();
                onSelectForReport?.();
              }}
            >
              Select for report
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
