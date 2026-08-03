import ReadinessBreakdownBars from '../plans/ReadinessBreakdownBars.jsx';
import { buildPlanDisplayMetrics } from '../../services/pathDisplayHelpers.js';
import { formatIngestString } from '../../utils/formatIngestDisplay.js';

/**
 * Technical Proof tab — collapsed scoring and domain coverage.
 */
export default function PathTechnicalProofPanel({ plan, sourceRows = [], pathExpected = 0 }) {
  const metrics = buildPlanDisplayMetrics(plan);
  const breakdown = plan.outcomeReadiness?.breakdown;

  const topSources = sourceRows.slice(0, 8).map((r) => ({
    name: r.name,
    gb: r.gbExpected,
    pct: r.pct,
  }));

  return (
    <div className="apath-panel space-y-3">
      <div className="apath-panel__card">
        <h4 className="apath-panel__title">Roadmap readiness</h4>
        <p className="apath-tech-kpi">
          <strong>{metrics.readiness}%</strong> {metrics.qualitativeLabel}
          {' · '}
          Domain coverage <strong>{metrics.domainCoverage}%</strong>
        </p>
      </div>

      <ReadinessBreakdownBars
        breakdown={breakdown}
        score={metrics.readiness}
        domainCoverage={metrics.domainCoverage}
        showTechnical
      />

      <div className="apath-panel__card">
        <h4 className="apath-panel__title">Ingest math</h4>
        <ul className="apath-panel__drivers">
          <li>
            <span>Path total (buffered)</span>
            <span className="tabular-nums">{formatIngestString(pathExpected)}</span>
          </li>
          {topSources.map((r) => (
            <li key={r.name}>
              <span>{r.name}</span>
              <span className="tabular-nums">
                {formatIngestString(r.gb)} ({r.pct.toFixed(0)}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
