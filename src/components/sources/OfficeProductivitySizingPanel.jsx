import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  calculateOfficeProductivitySizing,
  detectOfficeProductivityOverlap,
  formatOfficeProductivityIngestString,
  getOfficeFieldVisibility,
  getOfficeProductMeta,
  getOfficeProductOptions,
  getOfficeProfileOptions,
  normalizeOfficeProductivityState,
  OFFICE_M365_SUITE_NOTE,
  OFFICE_VALIDATION_NOTE,
  buildProfileToggles,
} from '../../services/officeProductivitySizingEngine.js';

export function OfficeProductivitySizingBreakdownTable({ breakdown, className = '' }) {
  if (!breakdown?.length) return null;
  return (
    <div className={`rounded-lg border border-[var(--cast-border)] overflow-hidden ${className}`.trim()}>
      <p className="text-badge font-semibold text-[var(--cast-text-muted)] uppercase px-2.5 py-1.5 bg-[var(--cast-panel)] border-b border-[var(--cast-border)]">
        Component breakdown (medium GB/day)
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
                  {formatOfficeProductivityIngestString(row.mediumGb)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const COMPONENT_TOGGLE_FIELDS = [
  { key: 'includeTenantAdminAudit', label: 'Tenant/admin audit events' },
  { key: 'includeLoginAccessSecurity', label: 'Login/access security events' },
  { key: 'includeEmailMessageActivity', label: 'Email/message activity events' },
  { key: 'includeFileActivity', label: 'File activity events' },
  { key: 'includeChatMeetingActivity', label: 'Chat/meeting collaboration events' },
];

export default function OfficeProductivitySizingPanel({ sourceId, ss, sessionSources, update }) {
  const normalized = useMemo(() => normalizeOfficeProductivityState(ss), [ss]);
  const productOptions = getOfficeProductOptions();
  const profileOptions = getOfficeProfileOptions();
  const productMeta = getOfficeProductMeta(normalized.officeProductivityProduct);
  const fieldVisibility = getOfficeFieldVisibility(normalized.officeProductivityProduct);
  const [showCustomize, setShowCustomize] = useState(Boolean(normalized.officeCustomizeComponents));

  const sizing = useMemo(
    () => calculateOfficeProductivitySizing(ss, { allInputs: sessionSources }),
    [ss, sessionSources],
  );
  const overlapWarning = useMemo(
    () => detectOfficeProductivityOverlap(ss, sessionSources),
    [ss, sessionSources],
  );

  function setProduct(next) {
    const meta = getOfficeProductMeta(next);
    const toggles = buildProfileToggles(meta, normalized.officeCollectionProfile);
    update(sourceId, {
      officeProductivityProduct: next,
      vendor: meta.label,
      officeCustomizeComponents: false,
      officeComponentToggles: toggles,
    });
    setShowCustomize(false);
  }

  function setProfile(profileId) {
    const toggles = buildProfileToggles(productMeta, profileId);
    update(sourceId, {
      officeCollectionProfile: profileId,
      officeCustomizeComponents: false,
      officeComponentToggles: toggles,
    });
    setShowCustomize(false);
  }

  function setCustomize(enabled) {
    setShowCustomize(enabled);
    update(sourceId, { officeCustomizeComponents: enabled });
  }

  function setComponentToggle(key, checked) {
    const toggles = { ...(normalized.officeComponentToggles || {}), [key]: checked };
    update(sourceId, {
      officeCustomizeComponents: true,
      officeComponentToggles: toggles,
    });
    setShowCustomize(true);
  }

  return (
    <div className="space-y-3">
      <p className="text-label text-[var(--cast-text-secondary)] leading-snug">
        Office Productivity includes audit and activity logs from Microsoft 365, Google Workspace, Exchange Online, SharePoint Online, and Teams.
      </p>
      <p className="text-badge text-[var(--cast-text-muted)]">
        Office productivity ingest is estimated from tenant count, active users, mailboxes, file users, collaboration users, and selected log components.
      </p>

      <div>
        <label className="text-label block mb-0.5">Product</label>
        <select
          className="input-field w-full"
          value={normalized.officeProductivityProduct}
          onChange={(e) => setProduct(e.target.value)}
        >
          {productOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">Office productivity platform or workload.</p>
      </div>

      <div>
        <label className="text-label block mb-0.5">Number of tenants / orgs</label>
        <input
          type="number"
          min="0"
          step="1"
          className="input-field w-full"
          value={normalized.officeTenantCount ?? ''}
          onChange={(e) => update(sourceId, { officeTenantCount: e.target.value })}
          placeholder="0"
        />
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
          Microsoft 365 tenants, Google Workspace customers, or workload instances sending audit logs.
        </p>
      </div>

      {fieldVisibility.officeActiveUserCount && (
        <div>
          <label className="text-label block mb-0.5">Number of active users</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input-field w-full"
            value={normalized.officeActiveUserCount ?? ''}
            onChange={(e) =>
              update(sourceId, { officeActiveUserCount: e.target.value, count: e.target.value })
            }
            placeholder="0"
          />
          <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
            Users generating login, admin, or general productivity activity.
          </p>
        </div>
      )}

      {fieldVisibility.officeActiveMailboxCount && (
        <div>
          <label className="text-label block mb-0.5">Number of active mailboxes</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input-field w-full"
            value={normalized.officeActiveMailboxCount ?? ''}
            onChange={(e) => update(sourceId, { officeActiveMailboxCount: e.target.value })}
            placeholder="0"
          />
          <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
            Mailboxes generating Exchange, Gmail, message trace, or mailbox audit events.
          </p>
        </div>
      )}

      {fieldVisibility.officeActiveFileUserCount && (
        <div>
          <label className="text-label block mb-0.5">Number of active file users</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input-field w-full"
            value={normalized.officeActiveFileUserCount ?? ''}
            onChange={(e) => update(sourceId, { officeActiveFileUserCount: e.target.value })}
            placeholder="0"
          />
          <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
            Users generating SharePoint, OneDrive, or Drive file activity.
          </p>
        </div>
      )}

      {fieldVisibility.officeActiveCollaborationUserCount && (
        <div>
          <label className="text-label block mb-0.5">Number of active collaboration / Teams users</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input-field w-full"
            value={normalized.officeActiveCollaborationUserCount ?? ''}
            onChange={(e) => update(sourceId, { officeActiveCollaborationUserCount: e.target.value })}
            placeholder="0"
          />
          <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
            Users generating Teams, Meet, Chat, channel, or meeting activity.
          </p>
        </div>
      )}

      <div>
        <label className="text-label block mb-0.5">Collection profile</label>
        <p className="text-badge text-[var(--cast-text-muted)] mb-1">Choose the type of productivity logs collected.</p>
        <div className="space-y-2">
          {profileOptions.map((p) => (
            <label
              key={p.id}
              className="flex items-start gap-2 cursor-pointer rounded-lg border border-[var(--cast-border)] p-2 hover:bg-[var(--cast-panel-alt)]/50"
            >
              <input
                type="radio"
                name={`officeProfile-${sourceId}`}
                className="mt-1"
                checked={normalized.officeCollectionProfile === p.id}
                onChange={() => setProfile(p.id)}
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
        <label className="flex items-center gap-2 cursor-pointer text-label">
          <input
            type="checkbox"
            checked={showCustomize}
            onChange={(e) => setCustomize(e.target.checked)}
          />
          Customize productivity log components
        </label>
        {showCustomize && (
          <div className="mt-2 space-y-1.5 pl-1 border-l-2 border-[var(--cast-border)] ml-1">
            {COMPONENT_TOGGLE_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 cursor-pointer text-badge">
                <input
                  type="checkbox"
                  checked={normalized.officeComponentToggles?.[f.key] !== false}
                  onChange={(e) => setComponentToggle(f.key, e.target.checked)}
                />
                {f.label}
              </label>
            ))}
          </div>
        )}
      </div>

      {normalized.officeProductivityProduct === 'microsoft_365' && (
        <p className="text-badge text-[var(--cast-text-muted)] italic">{OFFICE_M365_SUITE_NOTE}</p>
      )}

      {(sizing.expected > 0 || sizing.low > 0 || sizing.high > 0) && (
        <div className="rounded-lg border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/60 p-2.5 space-y-2">
          <p className="text-metric-label text-[var(--cast-text-muted)]">
            Calculated ingest ({productMeta.label})
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Low', value: sizing.low, color: 'var(--cast-info)' },
              { label: 'Medium', value: sizing.expected, color: 'var(--cast-success)', highlight: true },
              { label: 'High', value: sizing.high, color: 'var(--cast-warning)' },
            ].map((m) => (
              <div
                key={m.label}
                className={`rounded-md border border-[var(--cast-border)] px-2 py-1.5 ${m.highlight ? 'bg-[var(--cast-success)]/5' : ''}`}
              >
                <p className="text-badge text-[var(--cast-text-muted)]">{m.label}</p>
                <p className="text-label font-bold tabular-nums" style={{ color: m.color }}>
                  {formatOfficeProductivityIngestString(m.value)}
                </p>
              </div>
            ))}
          </div>
          <p className="text-badge text-[var(--cast-text-muted)] italic">{OFFICE_VALIDATION_NOTE}</p>
        </div>
      )}

      <OfficeProductivitySizingBreakdownTable breakdown={sizing.officeBreakdown} />

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
