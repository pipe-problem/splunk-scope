import { useState } from 'react';
import { X } from 'lucide-react';

const SIZING_MODES = [
  { id: 'per_unit', label: 'Units × GB/unit' },
  { id: 'manual_total', label: 'Manual GB/day total' },
];

export default function CustomSourceModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [count, setCount] = useState('');
  const [sizingMode, setSizingMode] = useState('per_unit');
  const [sizingRate, setSizingRate] = useState('0.1');
  const [manualGbTotal, setManualGbTotal] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  function reset() {
    setName('');
    setVendor('');
    setCount('');
    setSizingMode('per_unit');
    setSizingRate('0.1');
    setManualGbTotal('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter a source name.');
      return;
    }
    if (sizingMode === 'manual_total') {
      const gb = parseFloat(manualGbTotal);
      if (!Number.isFinite(gb) || gb <= 0) {
        setError('Enter a valid manual GB/day total.');
        return;
      }
    } else {
      const rate = parseFloat(sizingRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        setError('Enter a valid GB per unit rate.');
        return;
      }
    }
    onCreate({
      name: trimmedName,
      vendor: vendor.trim(),
      count,
      sizingMode,
      sizingRate,
      manualGbTotal,
    });
    reset();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Create custom data source">
      <button type="button" className="absolute inset-0 bg-black/55 border-0 cursor-default" onClick={handleClose} aria-label="Close" />
      <form
        className="relative w-full max-w-md rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel)] shadow-2xl p-4 space-y-3"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-card-header">Create custom data source</h3>
            <p className="text-label text-[var(--cast-text-muted)] mt-0.5">For feeds not in the catalog — sizing uses units × rate or a manual total.</p>
          </div>
          <button type="button" onClick={handleClose} className="p-1 rounded-lg hover:bg-[var(--cast-panel-alt)]" aria-label="Close">
            <X size={16} className="text-[var(--cast-text-muted)]" />
          </button>
        </div>

        <div>
          <label className="text-label block mb-0.5">Source name</label>
          <input className="input-field w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Legacy app syslog" required />
        </div>
        <div>
          <label className="text-label block mb-0.5">Vendor (optional)</label>
          <input className="input-field w-full" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Internal team" />
        </div>
        <div>
          <label className="text-label block mb-0.5">Number of units (optional)</label>
          <input type="number" min="0" step="1" className="input-field w-full" value={count} onChange={(e) => setCount(e.target.value)} placeholder="e.g. 40" />
          <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">Servers, hosts, appliances, or other countable units</p>
        </div>

        <div>
          <span className="text-label block mb-1">Sizing method</span>
          <div className="flex flex-wrap gap-2">
            {SIZING_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSizingMode(m.id)}
                className={`px-3 py-1.5 rounded-lg border text-label ${sizingMode === m.id ? 'border-[var(--cast-accent)] bg-[var(--cast-accent-muted)] text-[var(--cast-accent)]' : 'border-[var(--cast-border)] text-[var(--cast-text-secondary)]'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {sizingMode === 'per_unit' ? (
          <div>
            <label className="text-label block mb-0.5">GB per unit / day</label>
            <input type="number" min="0" step="0.01" className="input-field w-full" value={sizingRate} onChange={(e) => setSizingRate(e.target.value)} placeholder="0.1" />
            {count && sizingRate && (
              <p className="text-badge text-[var(--cast-text-muted)] mt-1">
                Estimate: {(parseFloat(count) * parseFloat(sizingRate)).toFixed(2)} GB/day (before buffer)
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="text-label block mb-0.5">Manual GB/day total</label>
            <input type="number" min="0" step="0.01" className="input-field w-full" value={manualGbTotal} onChange={(e) => setManualGbTotal(e.target.value)} placeholder="e.g. 12.5" />
          </div>
        )}

        {error && <p className="text-badge text-[var(--cast-critical)]">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn-primary flex-1">Create source</button>
          <button type="button" className="btn-secondary" onClick={handleClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
