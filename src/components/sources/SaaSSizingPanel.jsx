import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  calculateSaaSSizing,
  detectSaaSOverlap,
  formatSaaSIngestString,
  getSaaSActivityLevelOptions,
  getSaaSProfileOptions,
  getSaaSVendorMeta,
  getSaaSVendorOptions,
  normalizeSaaSState,
  SAAS_VALIDATION_NOTE,
} from '../../services/saasSizingEngine.js';

export function SaaSSizingBreakdownTable({ breakdown, className = '' }) {
  if (!breakdown?.length) return null;
  return (
    <div className={`rounded-lg border border-[var(--cast-border)] overflow-hidden ${className}`.trim()}>
      <p className="text-badge font-semibold text-[var(--cast-text-muted)] uppercase px-2.5 py-1.5 bg-[var(--cast-panel)] border-b border-[var(--cast-border)]">
        Component breakdown (selected activity level)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-badge">
          <thead>
            <tr className="text-tiny uppercase text-[var(--cast-text-muted)] border-b border-[var(--cast-border)]/50">
              <th className="text-left py-1 px-2 font-medium">Component</th>
              <th className="text-right py-1 px-1 font-medium w-12">Count</th>
              <th className="text-left py-1 px-1 font-medium">Unit</th>
              <th className="text-right py-1 px-2 font-medium w-24">Ingest</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((row) => (
              <tr key={row.id} className="border-b border-[var(--cast-border)]/30 last:border-0">
                <td className="py-1 px-2 text-[var(--cast-text-secondary)] leading-snug">{row.label}</td>
                <td className="py-1 px-1 text-right tabular-nums text-[var(--cast-text)]">{row.count}</td>
                <td className="py-1 px-1 text-[var(--cast-text-muted)]">{row.unit}</td>
                <td className="py-1 px-2 text-right tabular-nums text-[var(--cast-success)]">
                  {formatSaaSIngestString(row.displayGb)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SaaSSizingPanel({ sourceId, ss, sessionSources, update }) {
  const normalized = useMemo(() => normalizeSaaSState(ss), [ss]);
  const vendorOptions = getSaaSVendorOptions();
  const profileOptions = getSaaSProfileOptions();
  const activityOptions = getSaaSActivityLevelOptions();
  const vendorMeta = getSaaSVendorMeta(normalized.saasVendor);

  const sizing = useMemo(
    () => calculateSaaSSizing(ss, { allInputs: sessionSources }),
    [ss, sessionSources],
  );
  const overlapWarning = useMemo(
    () => detectSaaSOverlap(ss, sessionSources),
    [ss, sessionSources],
  );

  function setVendor(next) {
    update(sourceId, {
      saasVendor: next,
      vendor: getSaaSVendorMeta(next).label,
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-label text-[var(--cast-text-secondary)] leading-snug">
        SaaS (General) covers platform audit and activity logs: admin/configuration changes, authentication and access security, user/object activity, and API/integration events.
      </p>
      <p className="text-badge text-[var(--cast-text-muted)]">
        Modeled Splunk ingest planning defaults measured from synthetic raw event samples. Validate with a 24-hour customer sample when available.
      </p>

      <div>
        <label className="text-label block mb-0.5">SaaS vendor</label>
        <select
          className="input-field w-full"
          value={normalized.saasVendor}
          onChange={(e) => setVendor(e.target.value)}
        >
          {vendorOptions.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">Cloud SaaS platform.</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="text-label block mb-0.5">Number of tenants / orgs / instances</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input-field w-full"
            value={normalized.saasTenantCount ?? ''}
            onChange={(e) => update(sourceId, { saasTenantCount: e.target.value })}
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-label block mb-0.5">Number of active users</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input-field w-full"
            value={normalized.saasActiveUsers ?? ''}
            onChange={(e) =>
              update(sourceId, { saasActiveUsers: e.target.value, number_of_users: e.target.value })
            }
            placeholder="0"
          />
          <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
            Actual active users (not per-1,000). Use licensed or regularly active users.
          </p>
        </div>
        <div>
          <label className="text-label block mb-0.5">Number of integrations / API clients</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input-field w-full"
            value={normalized.saasIntegrationCount ?? ''}
            onChange={(e) => update(sourceId, { saasIntegrationCount: e.target.value })}
            placeholder="0"
          />
          <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
            Connected apps, integration users, or API clients sending events.
          </p>
        </div>
      </div>

      <div>
        <label className="text-label block mb-0.5">Collection profile</label>
        <p className="text-badge text-[var(--cast-text-muted)] mb-1">Choose what SaaS logging is collected.</p>
        <div className="space-y-2">
          {profileOptions.map((p) => (
            <label
              key={p.id}
              className="flex items-start gap-2 cursor-pointer rounded-lg border border-[var(--cast-border)] p-2 hover:bg-[var(--cast-panel-alt)]/50"
            >
              <input
                type="radio"
                name={`saasProfile-${sourceId}`}
                className="mt-1"
                checked={normalized.saasCollectionProfile === p.id}
                onChange={() => update(sourceId, { saasCollectionProfile: p.id })}
              />
              <span>
                <span className="text-label font-medium text-[var(--cast-text)] block">{p.label}</span>
                <span className="text-badge text-[var(--cast-text-muted)]">{p.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="text-label block mb-0.5">Activity level</label>
        <select
          className="input-field w-full"
          value={normalized.saasActivityLevel}
          onChange={(e) => update(sourceId, { saasActivityLevel: e.target.value })}
        >
          {activityOptions.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
          Light, normal, or heavy user and API activity assumptions.
        </p>
      </div>

      {(sizing.expected > 0 || sizing.low > 0 || sizing.high > 0) && (
        <div className="rounded-lg border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/60 p-2.5 space-y-2">
          <p className="text-metric-label text-[var(--cast-text-muted)]">
            Calculated ingest ({vendorMeta.label})
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Low (light activity)', value: sizing.low, color: 'var(--cast-info)' },
              {
                label: 'Expected',
                value: sizing.expected,
                color: 'var(--cast-success)',
                highlight: true,
              },
              { label: 'High (heavy activity)', value: sizing.high, color: 'var(--cast-warning)' },
            ].map((m) => (
              <div
                key={m.label}
                className={`rounded-md border border-[var(--cast-border)] px-2 py-1.5 ${m.highlight ? 'bg-[var(--cast-success)]/5' : ''}`}
              >
                <p className="text-badge text-[var(--cast-text-muted)]">{m.label}</p>
                <p className="text-label font-bold tabular-nums" style={{ color: m.color }}>
                  {formatSaaSIngestString(m.value)}
                </p>
              </div>
            ))}
          </div>
          <p className="text-badge text-[var(--cast-text-muted)] italic">{SAAS_VALIDATION_NOTE}</p>
        </div>
      )}

      <SaaSSizingBreakdownTable breakdown={sizing.saasBreakdown} />

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
