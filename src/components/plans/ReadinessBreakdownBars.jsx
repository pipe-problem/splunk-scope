const BREAKDOWN_LABELS = [
  { key: 'requiredTelemetryPct', label: 'Core telemetry' },
  { key: 'recommendedTelemetryPct', label: 'Recommended telemetry' },
  { key: 'enrichmentContextPct', label: 'Enrichment / context' },
  { key: 'useCaseBreadthPct', label: 'Use-case breadth' },
  { key: 'detectionDepthPct', label: 'Detection depth' },
  { key: 'roadmapCompletenessPct', label: 'Roadmap completeness' },
  { key: 'roadmapMaturityPct', label: 'Phase maturity' },
];

function barTone(pct) {
  if (pct >= 75) return 'readiness-bar__fill--high';
  if (pct >= 50) return 'readiness-bar__fill--mid';
  return 'readiness-bar__fill--low';
}

/**
 * Technical breakdown bars — shown in selected path detail, not on cards.
 */
export default function ReadinessBreakdownBars({
  breakdown,
  score,
  domainCoverage,
  showTechnical = false,
}) {
  if (!breakdown) return null;

  const title = showTechnical ? 'Technical score breakdown' : 'Roadmap readiness breakdown';

  return (
    <div className="readiness-breakdown">
      <div className="readiness-breakdown__header">
        <span className="readiness-breakdown__title">{title}</span>
        {score != null && (
          <span className="readiness-breakdown__total">{score}% roadmap readiness</span>
        )}
      </div>
      {showTechnical && domainCoverage != null && (
        <p className="readiness-breakdown__domain-note">
          Domain coverage (technical): <strong>{domainCoverage}%</strong>
        </p>
      )}
      <ul className="readiness-breakdown__list">
        {BREAKDOWN_LABELS.map(({ key, label }) => {
          const pct = breakdown[key] ?? 0;
          return (
            <li key={key} className="readiness-bar">
              <div className="readiness-bar__row">
                <span className="readiness-bar__label">{label}</span>
                <span className="readiness-bar__pct">{pct}%</span>
              </div>
              <div className="readiness-bar__track">
                <div
                  className={`readiness-bar__fill ${barTone(pct)}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
