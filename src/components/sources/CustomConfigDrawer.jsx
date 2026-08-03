import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { calculateFullSourceIngest } from '../../services/sourceEligibilityEngine';

import { formatSourceStatusLabel } from '../../utils/displayLabels.js';

const STATUS_OPTIONS = [
  { value: 'current', label: formatSourceStatusLabel('current') },
  { value: 'future', label: formatSourceStatusLabel('future') },
  { value: 'skip', label: formatSourceStatusLabel('skip') },
];
const STATUS_PILL_COLORS = { current: 'var(--cast-success)', future: 'var(--cast-info)', skip: 'var(--cast-text-muted)' };
const CONF_BADGE = {
  high: 'bg-[var(--cast-success)]/15 text-[var(--cast-success)]',
  medium: 'bg-[var(--cast-warning)]/15 text-[var(--cast-warning)]',
  low: 'bg-[var(--cast-critical)]/15 text-[var(--cast-critical)]',
  none: 'bg-[var(--cast-critical)]/15 text-[var(--cast-critical)]',
};

export default function CustomConfigDrawer({ source, ss, onClose, update, onStatus, onDelete }) {
  const active = ss.status === 'current' || ss.status === 'future';
  const sizingMode = ss.sizingMode === 'manual_total' ? 'manual_total' : 'per_unit';
  const [mode, setMode] = useState(sizingMode);

  const est = active
    ? calculateFullSourceIngest(source, {
        ...ss,
        override: mode === 'manual_total' ? ss.override : '',
      })
    : null;
  const tot = est?.expected ?? 0;

  function setModeAndClear(modeId) {
    setMode(modeId);
    if (modeId === 'manual_total') {
      update(source.id, { sizingMode: 'manual_total', sizingRate: ss.sizingRate || '0.1' });
    } else {
      update(source.id, { sizingMode: 'per_unit', override: '' });
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Custom source configuration">
      <button type="button" className="absolute inset-0 bg-black/55 border-0 cursor-default" onClick={onClose} aria-label="Close panel" />
      <aside className="relative w-full max-w-md h-full overflow-y-auto hidden-scrollbar bg-[var(--cast-panel)] border-l border-[var(--cast-border)] shadow-2xl flex flex-col animate-slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-4 border-b border-[var(--cast-border)] bg-[var(--cast-panel)]">
          <div className="min-w-0 flex-1">
            <h3 className="text-card-header leading-snug">{ss.name || source.name}</h3>
            <p className="text-label text-[var(--cast-text-muted)] mt-1">Custom · {ss.vendor || 'No vendor'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--cast-panel-alt)] shrink-0" aria-label="Close">
            <X size={16} className="text-[var(--cast-text-muted)]" />
          </button>
        </div>
        <div className="p-4 flex-1 space-y-3">
          {active && est && (
            <div className="p-2.5 rounded-lg bg-[var(--cast-success)]/10 border border-[var(--cast-success)]/25">
              <p className="text-metric-label text-[var(--cast-text-muted)] mb-0.5">Estimated ingest</p>
              <p className="text-xl font-black tabular-nums text-[var(--cast-success)]">
                {tot.toFixed(1)} <span className="text-label font-normal text-[var(--cast-text-muted)]">GB/day</span>
              </p>
              <span className={`text-badge px-1.5 py-0.5 rounded ${CONF_BADGE[est.confidence] || CONF_BADGE.none}`}>{est.confidence}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-section-kicker text-[var(--cast-text-muted)]">Status</span>
            <div className="flex gap-1">
              {STATUS_OPTIONS.map((o) => {
                const isActive = (ss.status || 'unknown') === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onStatus(source.id, isActive ? 'unknown' : o.value)}
                    className={`px-3 py-1 rounded-full text-badge font-medium ${isActive ? 'text-white' : 'text-[var(--cast-text-muted)] hover:bg-[var(--cast-panel-alt)]'}`}
                    style={isActive ? { backgroundColor: STATUS_PILL_COLORS[o.value] } : undefined}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-label block mb-0.5">Source name</label>
              <input className="input-field w-full" value={ss.name || ''} onChange={(e) => update(source.id, { name: e.target.value })} />
            </div>
            <div>
              <label className="text-label block mb-0.5">Vendor</label>
              <input className="input-field w-full" value={ss.vendor || ''} onChange={(e) => update(source.id, { vendor: e.target.value })} />
            </div>
            <div>
              <label className="text-label block mb-0.5">Number of units</label>
              <input type="number" min="0" className="input-field w-full" value={ss.count || ''} onChange={(e) => update(source.id, { count: e.target.value })} />
            </div>
            <div>
              <span className="text-label block mb-1">Sizing method</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setModeAndClear('per_unit')} className={`px-2 py-1 rounded border text-badge ${mode === 'per_unit' ? 'border-[var(--cast-accent)] text-[var(--cast-accent)]' : 'border-[var(--cast-border)]'}`}>Units × GB/unit</button>
                <button type="button" onClick={() => setModeAndClear('manual_total')} className={`px-2 py-1 rounded border text-badge ${mode === 'manual_total' ? 'border-[var(--cast-accent)] text-[var(--cast-accent)]' : 'border-[var(--cast-border)]'}`}>Manual GB/day</button>
              </div>
            </div>
            {mode === 'per_unit' ? (
              <div>
                <label className="text-label block mb-0.5">GB per unit / day</label>
                <input type="number" min="0" step="0.01" className="input-field w-full" value={ss.sizingRate || ''} onChange={(e) => update(source.id, { sizingRate: e.target.value, sizingMode: 'per_unit' })} />
              </div>
            ) : (
              <div>
                <label className="text-label block mb-0.5">Manual GB/day total</label>
                <input type="number" min="0" step="0.01" className="input-field w-full" value={ss.override || ''} onChange={(e) => update(source.id, { override: e.target.value, sizingMode: 'manual_total' })} />
              </div>
            )}
            <div>
              <label className="text-label block mb-0.5">Notes</label>
              <textarea className="input-field w-full min-h-[72px]" value={ss.notes || ''} onChange={(e) => update(source.id, { notes: e.target.value })} />
            </div>
          </div>

          <button
            type="button"
            className="btn-secondary w-full flex items-center justify-center gap-1.5 text-[var(--cast-critical)] border-[var(--cast-critical)]/30"
            onClick={() => onDelete(source.id)}
          >
            <Trash2 size={14} /> Remove custom source
          </button>
        </div>
      </aside>
    </div>
  );
}
