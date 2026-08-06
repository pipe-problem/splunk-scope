import { formatDomainForCustomer } from '../../services/coverageEngine';

export default function GapSummaryPanel({ perUseCase, onJumpToSource }) {
  const suggestions = perUseCase
    .flatMap((uc) => uc.suggestions || [])
    .filter((s, i, arr) => arr.findIndex((x) => x.domain === s.domain) === i);

  if (suggestions.length === 0) return null;

  return (
    <div className="card-compact !p-3 space-y-3">
      {suggestions.length > 0 && (
        <>
          <h3 className="text-label font-semibold text-[var(--cast-text)]">Practical next additions</h3>
          <p className="text-label text-[var(--cast-text-muted)] mb-2">Top sources that would improve coverage for your selected use cases.</p>
          <ul className="space-y-2">
            {suggestions.slice(0, 5).map(({ domain, sources: gapSources }) => {
              const top = gapSources[0];
              const sourceId = top?.id;
              const sourceName = top?.name || 'a matching source';
              const canJump = onJumpToSource && sourceId;

              return (
                <li key={domain} className="flex items-start gap-2 text-label text-[var(--cast-text-secondary)]">
                  <span className="text-[var(--cast-accent)] shrink-0 mt-0.5">•</span>
                  <span>
                    <span className="font-medium text-[var(--cast-text)]">{formatDomainForCustomer(domain)}</span>
                    {' — '}
                    {canJump ? (
                      <button
                        type="button"
                        onClick={() => onJumpToSource(sourceId, top.category)}
                        className="text-[var(--cast-accent)] hover:underline font-medium bg-transparent border-0 p-0 cursor-pointer"
                      >
                        {sourceName}
                      </button>
                    ) : (
                      <span>add {sourceName}</span>
                    )}
                    {' '}to close this gap.
                  </span>
                </li>
              );
            })}
          </ul>
          {suggestions.length > 5 && (
            <p className="text-label text-[var(--cast-text-muted)]">+{suggestions.length - 5} more areas available in advanced view</p>
          )}
        </>
      )}
    </div>
  );
}
