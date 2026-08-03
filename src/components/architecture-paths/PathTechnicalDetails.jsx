import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import PathTechnicalProofPanel from './PathTechnicalProofPanel.jsx';
import { formatIngestString } from '../../utils/formatIngestDisplay.js';

const TABS = [
  { id: 'sources', label: 'Sources' },
  { id: 'scoring', label: 'Scoring' },
];

function defaultOpenOnDesktop() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 1024px)').matches;
}

function SourcesTab({ sourceRows, pathExpected, delta }) {
  const drivers = sourceRows.slice(0, 8);
  const added = delta?.addedSourceDetails || sourceRows.filter((r) => r.addedInPath);

  return (
    <div className="space-y-3 text-badge">
      {drivers.length > 0 && (
        <div className="card-compact !p-3">
          <h4 className="text-section-kicker text-[var(--cast-text-muted)] mb-2">Biggest ingest drivers</h4>
          <div className="space-y-1">
            {drivers.map((row) => (
              <div key={row.id} className="flex items-center gap-2 py-0.5">
                <span className="text-[var(--cast-text-secondary)] flex-1 truncate">{row.name}</span>
                <span className="font-mono font-medium text-[var(--cast-success)] tabular-nums shrink-0">
                  {formatIngestString(row.gbExpected)}
                </span>
                <span className="text-tiny text-[var(--cast-text-muted)] w-8 text-right tabular-nums">
                  {row.pct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
          <p className="text-tiny text-[var(--cast-text-muted)] mt-2 tabular-nums">
            Path total: {formatIngestString(pathExpected)}
          </p>
        </div>
      )}

      {added.length > 0 && (
        <div className="card-compact !p-3">
          <h4 className="text-section-kicker text-[var(--cast-text-muted)] mb-2">Added vs previous path</h4>
          <ul className="space-y-0.5 text-[var(--cast-text-secondary)]">
            {added.slice(0, 12).map((s) => (
              <li key={s.id || s.name} className="truncate">
                {s.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sourceRows.length > 0 && (
        <div className="card-compact !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-badge">
              <thead>
                <tr className="border-b border-[var(--cast-border)] text-tiny uppercase tracking-wider text-[var(--cast-text-muted)] bg-[var(--cast-panel-alt)]">
                  <th className="text-left py-1.5 px-2">Source</th>
                  <th className="text-right py-1.5 px-2">GB/day</th>
                  <th className="text-right py-1.5 px-2">Share</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--cast-border)]/30">
                    <td className="py-1 px-2 text-[var(--cast-text)] truncate max-w-[200px]">{row.name}</td>
                    <td className="py-1 px-2 text-right font-mono text-[var(--cast-success)] tabular-nums">
                      {formatIngestString(row.gbExpected)}
                    </td>
                    <td className="py-1 px-2 text-right text-[var(--cast-text-muted)] tabular-nums">
                      {row.pct.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Source breakdown — Sources | Scoring tabs below the carousel.
 */
export default function PathTechnicalDetails({ plan, sourceRows, pathExpected, delta }) {
  const [open, setOpen] = useState(defaultOpenOnDesktop);
  const [tab, setTab] = useState('sources');

  return (
    <section className="path-technical-details">
      <button
        type="button"
        className={`path-technical-details__toggle ${open ? 'path-technical-details__toggle--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-semibold text-label">Source breakdown</span>
        <span className="text-badge text-[var(--cast-text-muted)] flex-1">
          Per-source ingest and scoring detail
        </span>
        <ChevronDown size={16} className="path-technical-details__chevron shrink-0" aria-hidden />
      </button>

      {open && (
        <div className="path-technical-details__body animate-fade-in">
          <div className="flex items-center gap-1 border-b border-[var(--cast-border)] pb-0 mb-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-tab-label transition-colors border-b-2 -mb-px ${
                  tab === t.id
                    ? 'border-[var(--cast-accent)] text-[var(--cast-accent)]'
                    : 'border-transparent text-[var(--cast-text-muted)] hover:text-[var(--cast-text-secondary)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'sources' && (
            <SourcesTab sourceRows={sourceRows} pathExpected={pathExpected} delta={delta} />
          )}
          {tab === 'scoring' && (
            <PathTechnicalProofPanel plan={plan} sourceRows={sourceRows} pathExpected={pathExpected} />
          )}
        </div>
      )}
    </section>
  );
}

export { TABS };
