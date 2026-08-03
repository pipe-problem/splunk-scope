import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  calculateIaasSizing,
  detectIaasChildOverlap,
  formatIaasGb,
  getIaasAdvancedCountFields,
  getIaasStandardProviders,
  getProviderMeta,
  normalizeIaasState,
} from '../../services/iaasSizingEngine.js';

const PROVIDER_OPTIONS = getIaasStandardProviders();

export default function IaasSizingPanel({ sourceId, ss, sessionSources, update }) {
  const normalized = useMemo(() => normalizeIaasState(ss), [ss]);
  const provider = normalized.iaasProvider;
  const mode = normalized.iaasSizingMode;
  const providerMeta = getProviderMeta(provider);
  const advancedFields = getIaasAdvancedCountFields();
  const sizing = useMemo(
    () => calculateIaasSizing(ss, { allInputs: sessionSources }),
    [ss, sessionSources],
  );
  const overlapWarning = useMemo(
    () => detectIaasChildOverlap(ss, sessionSources),
    [ss, sessionSources],
  );

  function setProvider(next) {
    update(sourceId, { iaasProvider: next, vendor: getProviderMeta(next).label });
  }

  function setMode(next) {
    update(sourceId, { iaasSizingMode: next });
  }

  function setAccountCount(value) {
    update(sourceId, { iaasAccountCount: value, number_of_accounts: value });
  }

  function setAdvancedCount(key, value) {
    const counts = { ...(normalized.iaasAdvancedCounts || {}), [key]: value };
    update(sourceId, { iaasAdvancedCounts: counts });
  }

  const breakdown = sizing.iaasBreakdown || [];

  return (
    <div className="space-y-3">
      <p className="text-label text-[var(--cast-text-secondary)] leading-snug">
        IaaS includes cloud provider infrastructure logs such as audit activity, VM events, flow logs, storage access logs, Kubernetes control-plane logs, and configuration/inventory changes.
      </p>

      <div>
        <label className="text-label block mb-0.5">Cloud provider</label>
        <select
          className="input-field w-full"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          {PROVIDER_OPTIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1"
          checked={mode === 'advanced'}
          onChange={(e) => setMode(e.target.checked ? 'advanced' : 'standard')}
        />
        <span>
          <span className="text-label font-medium text-[var(--cast-text)] block">Use advanced IaaS sizing</span>
          <span className="text-badge text-[var(--cast-text-muted)]">
            Use this if the customer knows VM, flow log, storage, or Kubernetes counts.
          </span>
        </span>
      </label>

      {mode === 'standard' ? (
        <div className="space-y-2">
          <p className="text-badge text-[var(--cast-text-muted)]">
            Fast estimate using the number of cloud accounts, subscriptions, projects, or tenancies.
          </p>
          <div>
            <label className="text-label block mb-0.5">{providerMeta.accountFieldLabel || 'Number of cloud accounts'}</label>
            <input
              type="number"
              min="0"
              step="1"
              className="input-field w-full"
              value={normalized.iaasAccountCount ?? ''}
              onChange={(e) => setAccountCount(e.target.value)}
              placeholder="0"
            />
            <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
              For Azure use subscriptions. For GCP use projects. For OCI use tenancies or compartments.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-badge text-[var(--cast-text-muted)]">
            More accurate estimate using VM, flow log, storage, and Kubernetes counts.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {advancedFields.map((field) => (
              <div key={field.key}>
                <label className="text-label block mb-0.5">{field.label}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="input-field w-full"
                  value={normalized.iaasAdvancedCounts?.[field.key] ?? ''}
                  onChange={(e) => setAdvancedCount(field.key, e.target.value)}
                  placeholder="0"
                />
                <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">{field.helper}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(sizing.expected > 0 || sizing.low > 0 || sizing.high > 0) && (
        <div className="rounded-lg border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/60 p-2.5 space-y-2">
          <p className="text-metric-label text-[var(--cast-text-muted)]">Calculated ingest (modeled planning estimate)</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Low', value: sizing.low, color: 'var(--cast-info)' },
              { label: 'Medium', value: sizing.expected, color: 'var(--cast-success)', highlight: true },
              { label: 'High', value: sizing.high, color: 'var(--cast-warning)' },
            ].map((m) => (
              <div key={m.label} className={`rounded-md border border-[var(--cast-border)] px-2 py-1.5 ${m.highlight ? 'bg-[var(--cast-success)]/5' : ''}`}>
                <p className="text-badge text-[var(--cast-text-muted)]">{m.label}</p>
                <p className="text-label font-bold tabular-nums" style={{ color: m.color }}>
                  {formatIaasGb(m.value)} <span className="font-normal text-[var(--cast-text-muted)]">GB/day</span>
                </p>
              </div>
            ))}
          </div>
          <p className="text-badge text-[var(--cast-text-muted)] italic">
            Validate with a 24-hour sample when available. These are modeled planning values, not official vendor defaults.
          </p>
        </div>
      )}

      {mode === 'advanced' && breakdown.length > 0 && (
        <div className="rounded-lg border border-[var(--cast-border)] overflow-hidden">
          <p className="text-badge font-semibold text-[var(--cast-text-muted)] uppercase px-2.5 py-1.5 bg-[var(--cast-panel)] border-b border-[var(--cast-border)]">
            Scope breakdown (medium GB/day)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-badge">
              <thead>
                <tr className="text-tiny uppercase text-[var(--cast-text-muted)] border-b border-[var(--cast-border)]/50">
                  <th className="text-left py-1 px-2 font-medium">Scope</th>
                  <th className="text-right py-1 px-1 font-medium w-12">Count</th>
                  <th className="text-left py-1 px-1 font-medium">Unit</th>
                  <th className="text-right py-1 px-2 font-medium w-20">Medium</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--cast-border)]/30 last:border-0">
                    <td className="py-1 px-2 text-[var(--cast-text-secondary)] leading-snug">{row.label}</td>
                    <td className="py-1 px-1 text-right tabular-nums text-[var(--cast-text)]">{row.count}</td>
                    <td className="py-1 px-1 text-[var(--cast-text-muted)]">{row.unit}</td>
                    <td className="py-1 px-2 text-right tabular-nums text-[var(--cast-success)]">
                      {formatIaasGb(row.mediumGb)} GB/day
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {overlapWarning && (
        <p className="flex items-start gap-1.5 text-badge text-[var(--cast-warning)]">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          {overlapWarning}
        </p>
      )}

      {sizing.warnings.filter((w) => w !== overlapWarning).map((w) => (
        <p key={w} className="text-badge text-[var(--cast-warning)] flex items-center gap-1">
          <AlertTriangle size={10} /> {w}
        </p>
      ))}
    </div>
  );
}
