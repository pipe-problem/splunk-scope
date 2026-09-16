import { formatIngestValue } from '../utils/formatIngestDisplay.js';
import CiscoPromoIngestValue from './CiscoPromoIngestValue.jsx';
import { CISCO_INGEST_PROMO_COPY } from '../services/ciscoIngestPromo.js';

const SCOPE_META = {
  session: {
    title: 'Total configured source ingest',
    footnote:
      'Sums sized Current sources in this session. Low / Expected / High reflect the selected sizing model; legacy sources use a planning buffer when measured bands are unavailable.',
  },
  path: {
    title: 'Selected path ingest',
    footnote:
      'Sum of sources you sized in this session that appear in the selected path.',
  },
};

/**
 * Unified Low / Expected / High KPI strip for session vs path ingest scope.
 */
export default function PlanningKpiStrip({
  totals,
  scope = 'session',
  title,
  footnote,
  compact = false,
  className = '',
}) {
  const meta = SCOPE_META[scope] || SCOPE_META.session;
  const low = totals?.low ?? 0;
  const expected = totals?.expected ?? 0;
  const high = totals?.high ?? 0;

  return (
    <div className={className}>
      <p className="text-metric-label mb-1">{title || meta.title}</p>
      <div className={`grid grid-cols-3 gap-2 ${compact ? '' : ''}`}>
        {[
          { label: 'Low', value: low, color: 'var(--cast-info)' },
          { label: 'Expected', value: expected, color: 'var(--cast-success)', highlight: true },
          { label: 'High', value: high, color: 'var(--cast-warning)' },
        ].map((m) => {
          const fmt = formatIngestValue(m.value);
          return (
            <div
              key={m.label}
              className={`card-compact text-center ${compact ? '!py-1.5' : '!py-2'} ${m.highlight ? 'border-[var(--cast-green)]/30' : ''}`}
            >
              <p className="text-metric-label mb-0.5">{m.label}</p>
              <p className={`${compact ? 'text-base' : 'text-lg'} font-bold tabular-nums`} style={{ color: m.color }}>
                {m.highlight && totals?.ciscoPromoApplied ? (
                  <CiscoPromoIngestValue
                    billable={m.value}
                    gross={totals.gross?.expected}
                    promoApplied
                    billableClassName=""
                  />
                ) : (
                  fmt.text
                )}
              </p>
              <p className="text-metric-sub">{fmt.unit || 'GB/day'}</p>
            </div>
          );
        })}
      </div>
      <p className="text-label text-[var(--cast-text-muted)] mt-1.5 leading-snug">{footnote || meta.footnote}</p>
      {totals?.ciscoPromoApplied && (
        <p className="text-label text-[var(--cast-accent)] mt-1 leading-snug">{CISCO_INGEST_PROMO_COPY}</p>
      )}
    </div>
  );
}
