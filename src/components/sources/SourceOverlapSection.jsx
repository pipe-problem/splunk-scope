import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { evaluatePair, getLikelyPeerSourceIds } from '../../services/sourceOverlapLookupEngine.js';

const VERDICT_UI = {
  may_overlap: {
    label: 'May overlap',
    icon: AlertTriangle,
    className: 'border-[var(--cast-warning)]/40 bg-[var(--cast-warning)]/10 text-[var(--cast-warning)]',
  },
  unknown: {
    label: 'Validate overlap',
    icon: HelpCircle,
    className: 'border-[var(--cast-border)] bg-[var(--cast-panel-alt)] text-[var(--cast-text-secondary)]',
  },
  unlikely_overlap: {
    label: 'Unlikely overlap',
    icon: CheckCircle2,
    className: 'border-[var(--cast-success)]/30 bg-[var(--cast-success)]/10 text-[var(--cast-success)]',
  },
};

export default function SourceOverlapSection({ source, allSources, onSelectPeer }) {
  const sourceId = source?.id;
  const [compareId, setCompareId] = useState('');

  const peerIds = useMemo(() => getLikelyPeerSourceIds(sourceId), [sourceId]);

  const catalogOptions = useMemo(
    () => (allSources || []).filter((s) => s.id !== sourceId).sort((a, b) => a.name.localeCompare(b.name)),
    [allSources, sourceId],
  );

  const nameById = useMemo(() => {
    const m = new Map();
    for (const s of allSources || []) m.set(s.id, s.name);
    return m;
  }, [allSources]);

  const comparison = useMemo(() => {
    if (!compareId) return null;
    return evaluatePair(sourceId, compareId);
  }, [sourceId, compareId]);

  if (!sourceId) return null;

  return (
    <section className="source-overlap-section space-y-4" aria-labelledby="source-overlap-heading">
      <h3 id="source-overlap-heading" className="text-base font-semibold text-[var(--cast-text)]">
        Overlap with other sources
      </h3>
      <p className="text-sm text-[var(--cast-text-muted)] leading-relaxed max-w-3xl">
        Compare this source to another catalog entry to see whether telemetry may be double-counted during sizing.
      </p>

      {peerIds.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cast-text-muted)] mb-2">
            Commonly overlaps with
          </p>
          <div className="flex flex-wrap gap-2">
            {peerIds.map((pid) => (
              <button
                key={pid}
                type="button"
                onClick={() => {
                  setCompareId(pid);
                  onSelectPeer?.(pid);
                }}
                className="text-badge px-2.5 py-1 rounded-full border border-[var(--cast-accent)]/25 bg-[var(--cast-accent-muted)] text-[var(--cast-accent)] hover:opacity-90"
              >
                {nameById.get(pid) || pid}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-md">
        <label htmlFor="overlap-compare-select" className="text-sm font-medium text-[var(--cast-text)] block mb-2">
          Compare to another source
        </label>
        <select
          id="overlap-compare-select"
          className="input-field w-full"
          value={compareId}
          onChange={(e) => setCompareId(e.target.value)}
        >
          <option value="">Select a source…</option>
          {catalogOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {comparison && compareId && (
        <div className={`rounded-xl border p-4 sm:p-5 ${VERDICT_UI[comparison.verdict]?.className || ''}`}>
          <div className="flex items-center gap-2 mb-2">
            {(() => {
              const Icon = VERDICT_UI[comparison.verdict]?.icon || HelpCircle;
              return <Icon size={18} className="shrink-0" aria-hidden />;
            })()}
            <span className="text-sm font-semibold">{VERDICT_UI[comparison.verdict]?.label}</span>
            <span className="text-sm opacity-80">vs {nameById.get(compareId) || compareId}</span>
          </div>
          <p className="text-sm leading-relaxed opacity-95">{comparison.summary}</p>
          {comparison.sharedTelemetry?.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm opacity-90">
              {comparison.sharedTelemetry.map((row) => (
                <li key={row.label}>
                  <span className="font-medium">{row.label}</span>
                  {row.example ? <span className="opacity-80"> — {row.example}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
