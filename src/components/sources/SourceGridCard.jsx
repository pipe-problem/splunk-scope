import { CheckCircle2 } from 'lucide-react';
import { truncateSubtitle } from '../../utils/displayLabels.js';
import { formatConfiguredSourceSummary } from '../../utils/sourceConfiguredSummary.js';

const DISPLAY_NAME_MAX = 42;

function displayName(source, ss) {
  const full = (ss?.name || source.name || '').trim();
  if (full.length <= DISPLAY_NAME_MAX) return { primary: full, secondary: null };
  return {
    primary: `${full.slice(0, DISPLAY_NAME_MAX).trim()}…`,
    secondary: full,
  };
}

export default function SourceGridCard({
  source,
  ss,
  isOpen,
  showRelevance = false,
  relevanceScore1to10,
  appLabels = [],
  onToggle,
}) {
  const configured = ss?.status === 'current';
  const configuredSummary = configured ? formatConfiguredSourceSummary(source, ss) : null;
  const { primary, secondary } = displayName(source, ss);
  const description =
    configuredSummary
    || (source.customerSummary || source.description || '').trim();

  const relevanceLabel =
    relevanceScore1to10 == null ? '—' : relevanceScore1to10;

  const handleClick = (event) => {
    if (event.target.closest('a, button')) return;
    onToggle(source.id, event);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle(source.id, event);
    }
  };

  const ariaLabel = showRelevance
    ? `${source.name}, relevance ${relevanceLabel} out of 10${configured ? ', configured' : ''}`
    : `${source.name}${configured ? ', configured' : ''}`;

  return (
    <div
      role="button"
      tabIndex={0}
      data-source-id={source.id}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-expanded={isOpen}
      aria-label={ariaLabel}
      className={`card-compact !p-0 h-full flex flex-col min-h-0 transition-all cursor-pointer select-none ${
        isOpen
          ? 'ring-2 ring-[var(--cast-accent)]/45 shadow-[var(--shadow-glow)] scale-[1.01]'
          : 'hover:border-[var(--cast-border-strong)] hover:shadow-sm'
      }`}
    >
      <div className="p-3 flex-1 flex flex-col min-h-0 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--cast-text)] leading-snug" title={secondary || primary}>
              {primary}
            </h3>
            {secondary && (
              <p className="text-badge text-[var(--cast-text-muted)] mt-0.5 line-clamp-1">{secondary}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-badge font-bold tabular-nums px-1.5 py-0.5 rounded ${
                showRelevance
                  ? 'bg-[var(--cast-accent-muted)] text-[var(--cast-accent)]'
                  : 'bg-[var(--cast-panel-alt)] text-[var(--cast-text-muted)]'
              }`}
              title={showRelevance ? 'Relevance to your goals' : 'Complete intake (use case or app) to score relevance'}
            >
              {relevanceLabel}/10
            </span>
            {configured ? (
              <CheckCircle2 size={16} className="text-[var(--cast-success)]" aria-label="Configured" title="Configured" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-[var(--cast-border-strong)]" aria-label="Not configured" title="Not configured" />
            )}
          </div>
        </div>

        {showRelevance && appLabels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {appLabels.slice(0, 2).map((label) => (
              <span
                key={label}
                className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--cast-panel-alt)] text-[var(--cast-text-secondary)] border border-[var(--cast-border)]"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {description && (
          <p
            className={`text-label leading-relaxed line-clamp-2 ${
              configuredSummary
                ? 'text-[var(--cast-text-secondary)] font-medium'
                : 'text-[var(--cast-text-muted)]'
            }`}
          >
            {truncateSubtitle(description, configuredSummary ? 3 : 2)}
          </p>
        )}
      </div>

      <div className="px-3 pb-3 pt-2 border-t border-[var(--cast-border)]/50 mt-auto">
        <span
          className={`block text-center text-xs font-semibold tracking-wide ${
            isOpen ? 'text-[var(--cast-accent)]' : 'text-[var(--cast-text-secondary)]'
          }`}
        >
          {configured ? 'Edit' : 'Configure'}
        </span>
      </div>
    </div>
  );
}
