import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, Zap } from 'lucide-react';
import { generateSourceInsight } from '../../services/sourceInsightEngine';
import sourceUseCaseMappings from '../../data/sourceUseCaseMappings.json';

const STRENGTH_COLORS = {
  strong: 'bg-[var(--cast-success)]/15 text-[var(--cast-success)] border-[var(--cast-success)]/25',
  partial: 'bg-[var(--cast-warning)]/15 text-[var(--cast-warning)] border-[var(--cast-warning)]/25',
  minimal: 'bg-[var(--cast-panel-alt)] text-[var(--cast-text-muted)] border-[var(--cast-border)]',
};

function useCaseLabelsForSource(sourceId, useCases) {
  const mapping = (sourceUseCaseMappings.mappings || {})[sourceId];
  if (!mapping?.useCases || !useCases?.length) return [];
  const ids = new Set(
    mapping.useCases.filter((m) => m.relevance === 'high' || m.relevance === 'medium').map((m) => m.useCaseId),
  );
  return useCases.filter((uc) => ids.has(uc.id)).map((uc) => uc.name);
}

export default function SourceDetailSummary({
  source,
  useCases,
  currentCoverage,
  sourceStates,
  allSources,
  compact = false,
  scopeBannerOnly = false,
}) {
  const insight = useMemo(
    () => generateSourceInsight(source, useCases, currentCoverage, sourceStates, allSources),
    [source, useCases, currentCoverage, sourceStates, allSources],
  );

  const poweredUseCases = useMemo(() => useCaseLabelsForSource(source.id, useCases), [source.id, useCases]);

  if (!insight) return null;

  const bodyClass = compact ? 'text-label' : 'text-xs';

  return (
    <div className="space-y-3">
      <div
        className={`p-3 rounded-lg border ${
          insight.recommendation.recommended
            ? 'bg-[var(--cast-accent-muted)] border-[var(--cast-accent)]/30'
            : 'bg-[var(--cast-panel-alt)] border-[var(--cast-border)]'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          {insight.recommendation.recommended ? (
            <CheckCircle2 size={14} className="text-[var(--cast-success)] shrink-0" />
          ) : (
            <Info size={14} className="text-[var(--cast-text-muted)] shrink-0" />
          )}
          <span className="text-label font-semibold text-[var(--cast-text)]">
            {insight.recommendation.recommended ? 'Recommended for your scope' : 'Optional for your scope'}
          </span>
        </div>
        <details className="mt-1">
          <summary className="text-badge text-[var(--cast-text-muted)] cursor-pointer hover:text-[var(--cast-text-secondary)]">Planning details</summary>
        </details>
        {insight.recommendation.overlapWarning && (
          <p className={`${bodyClass} text-[var(--cast-warning)] flex items-start gap-1.5`}>
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            {insight.recommendation.overlapWarning}
          </p>
        )}
      </div>

      {scopeBannerOnly ? null : (
        <>
      {source.whyItMatters && (
        <div className="rounded-lg bg-[var(--cast-bg)] border border-[var(--cast-border)] p-3">
          <h4 className="text-badge font-semibold text-[var(--cast-text-muted)] uppercase tracking-wide mb-1 flex items-center gap-1">
            <Zap size={11} className="text-[var(--cast-accent)]" /> Why it matters
          </h4>
          <p className={`${bodyClass} text-[var(--cast-text-secondary)] leading-relaxed`}>{source.whyItMatters}</p>
        </div>
      )}

      <div>
        <h4 className="text-badge font-semibold text-[var(--cast-text-muted)] uppercase tracking-wide mb-1">What it provides</h4>
        <p className={`${bodyClass} text-[var(--cast-text-secondary)] leading-relaxed`}>{insight.overview}</p>
      </div>

      {poweredUseCases.length > 0 && (
        <div>
          <h4 className="text-badge font-semibold text-[var(--cast-text-muted)] uppercase tracking-wide mb-1.5">Supports your use cases</h4>
          <div className="flex flex-wrap gap-1.5">
            {poweredUseCases.slice(0, 6).map((name) => (
              <span key={name} className="text-badge px-2 py-0.5 rounded-full bg-[var(--cast-accent)]/10 text-[var(--cast-accent)] border border-[var(--cast-accent)]/20">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {insight.telemetryDomains.length > 0 && (
        <div>
          <h4 className="text-badge font-semibold text-[var(--cast-text-muted)] uppercase tracking-wide mb-1.5">Telemetry domains</h4>
          <div className="flex flex-wrap gap-1.5">
            {insight.telemetryDomains.map((d) => (
              <span key={d.domain} className={`text-badge px-2 py-0.5 rounded border ${STRENGTH_COLORS[d.strength] || STRENGTH_COLORS.minimal}`}>
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {(source.exampleVendors?.length > 0 || source.splunkApps?.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {source.exampleVendors?.length > 0 && (
            <div>
              <h4 className="text-badge font-semibold text-[var(--cast-text-muted)] uppercase tracking-wide mb-1">Common vendors</h4>
              <p className={`${bodyClass} text-[var(--cast-text-secondary)]`}>{source.exampleVendors.slice(0, 5).join(' · ')}</p>
            </div>
          )}
          {source.splunkApps?.length > 0 && (
            <div>
              <h4 className="text-badge font-semibold text-[var(--cast-text-muted)] uppercase tracking-wide mb-1">Splunk apps / TAs</h4>
              <p className={`${bodyClass} text-[var(--cast-text-secondary)] leading-snug`}>
                {(source.splunkApps || []).slice(0, 4).join(' · ')}
                {(source.splunkApps || []).length > 4 ? ` +${source.splunkApps.length - 4} more` : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {source.mitreId && (
        <p className="text-badge text-[var(--cast-text-muted)]">
          MITRE data component: <span className="text-[var(--cast-text-secondary)] font-mono">{source.mitreId}</span>
        </p>
      )}
        </>
      )}
    </div>
  );
}
