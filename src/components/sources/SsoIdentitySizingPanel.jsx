import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  calculateSsoIdentitySizing,
  detectSsoOverlap,
  formatSsoIngestString,
  getSsoActivityLevelOptions,
  getSsoProfileOptions,
  getSsoVendorMeta,
  getSsoVendorOptions,
  normalizeSsoState,
  SSO_VALIDATION_NOTE,
} from '../../services/ssoIdentitySizingEngine.js';

export function SsoIdentitySizingBreakdownTable({ breakdown, className = '' }) {
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
                  {formatSsoIngestString(row.displayGb)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SsoIdentitySizingPanel({ sourceId, ss, sessionSources, update }) {
  const normalized = useMemo(() => normalizeSsoState(ss), [ss]);
  const vendorOptions = getSsoVendorOptions();
  const profileOptions = getSsoProfileOptions();
  const activityOptions = getSsoActivityLevelOptions();
  const vendorMeta = getSsoVendorMeta(normalized.ssoIdpVendor);

  const sizing = useMemo(
    () => calculateSsoIdentitySizing(ss, { allInputs: sessionSources }),
    [ss, sessionSources],
  );
  const overlapWarning = useMemo(
    () => detectSsoOverlap(ss, sessionSources),
    [ss, sessionSources],
  );

  function setVendor(next) {
    const meta = getSsoVendorMeta(next);
    update(sourceId, { ssoIdpVendor: next, vendor: meta.label });
  }

  return (
    <div className="space-y-3">
      <p className="text-label text-[var(--cast-text-secondary)] leading-snug">
        SSO / IdP sizing uses admin audit, authentication sign-in, MFA / risk, and application provisioning events.
      </p>

      <div>
        <label className="text-label block mb-0.5">IdP vendor</label>
        <select className="input-field w-full" value={normalized.ssoIdpVendor} onChange={(e) => setVendor(e.target.value)}>
          {vendorOptions.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-label block mb-0.5">Number of IdP tenants / orgs</label>
        <input
          type="number"
          min="0"
          className="input-field w-full"
          value={normalized.ssoTenantCount ?? ''}
          onChange={(e) => update(sourceId, { ssoTenantCount: e.target.value })}
          placeholder="0"
        />
      </div>

      <div>
        <label className="text-label block mb-0.5">Number of active identity users</label>
        <input
          type="number"
          min="0"
          className="input-field w-full"
          value={normalized.ssoActiveUserCount ?? ''}
          onChange={(e) =>
            update(sourceId, { ssoActiveUserCount: e.target.value, count: e.target.value })
          }
          placeholder="0"
        />
      </div>

      <div>
        <label className="text-label block mb-0.5">Number of MFA-protected users</label>
        <input
          type="number"
          min="0"
          className="input-field w-full"
          value={normalized.ssoMfaUserCount ?? ''}
          onChange={(e) => update(sourceId, { ssoMfaUserCount: e.target.value })}
          placeholder="0"
        />
      </div>

      <div>
        <label className="text-label block mb-0.5">Number of SSO app / provisioning integrations</label>
        <input
          type="number"
          min="0"
          className="input-field w-full"
          value={normalized.ssoAppIntegrationCount ?? ''}
          onChange={(e) => update(sourceId, { ssoAppIntegrationCount: e.target.value })}
          placeholder="0"
        />
      </div>

      <div>
        <label className="text-label block mb-0.5">Collection profile</label>
        <div className="space-y-2">
          {profileOptions.map((p) => (
            <label
              key={p.id}
              className="flex items-start gap-2 cursor-pointer rounded-lg border border-[var(--cast-border)] p-2 hover:bg-[var(--cast-panel-alt)]/50"
            >
              <input
                type="radio"
                name={`ssoProfile-${sourceId}`}
                className="mt-1"
                checked={normalized.ssoCollectionProfile === p.id}
                onChange={() => update(sourceId, { ssoCollectionProfile: p.id })}
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
          value={normalized.ssoActivityLevel}
          onChange={(e) => update(sourceId, { ssoActivityLevel: e.target.value })}
        >
          {activityOptions.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </div>

      {sizing.ssoBreakdown?.length > 0 && (
        <SsoIdentitySizingBreakdownTable breakdown={sizing.ssoBreakdown} />
      )}

      {overlapWarning && (
        <p className="text-badge text-[var(--cast-warning)] flex items-center gap-1">
          <AlertTriangle size={12} /> {overlapWarning}
        </p>
      )}

      {sizing.warnings?.map((w, i) => (
        <p key={i} className="text-badge text-[var(--cast-warning)] flex items-center gap-1">
          <AlertTriangle size={12} /> {w}
        </p>
      ))}

      <p className="text-badge text-[var(--cast-text-muted)] italic">{SSO_VALIDATION_NOTE}</p>
      <p className="text-badge text-[var(--cast-text-muted)]">Vendor: {vendorMeta.label}</p>
    </div>
  );
}
