import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  calculateCrmSizing,
  detectCrmOverlap,
  formatCrmIngestString,
  getCrmActivityLevelOptions,
  getCrmProfileOptions,
  getCrmVendorMeta,
  getCrmVendorOptions,
  normalizeCrmState,
  buildProfileToggles,
  CRM_VALIDATION_NOTE,
} from '../../services/crmSizingEngine.js';

export function CrmSizingBreakdownTable({ breakdown, className = '' }) {
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
                  {formatCrmIngestString(row.displayGb)}
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
  { key: 'includeAdminConfigAudit', label: 'Admin / configuration audit events' },
  { key: 'includeLoginAccessSecurity', label: 'Login / access security events' },
  { key: 'includeCrmRecordActivity', label: 'CRM record / case / ticket activity events' },
  { key: 'includeApiIntegrationEvents', label: 'API / integration events' },
];

const DAILY_EVENT_FIELDS = [
  { key: 'dailyAdminAuditEvents', label: 'Daily admin / configuration audit events' },
  { key: 'dailyLoginAccessEvents', label: 'Daily login / access security events' },
  { key: 'dailyCrmRecordEvents', label: 'Daily CRM record / case / ticket events' },
  { key: 'dailyApiIntegrationEvents', label: 'Daily API / integration events' },
];

export default function CrmSizingPanel({ sourceId, ss, sessionSources, update }) {
  const normalized = useMemo(() => normalizeCrmState(ss), [ss]);
  const vendorOptions = getCrmVendorOptions();
  const profileOptions = getCrmProfileOptions();
  const activityOptions = getCrmActivityLevelOptions();
  const vendorMeta = getCrmVendorMeta(normalized.crmVendor);
  const [showCustomize, setShowCustomize] = useState(Boolean(normalized.crmCustomizeComponents));
  const [showDailyEvents, setShowDailyEvents] = useState(Boolean(normalized.crmUseDailyEventCounts));

  const sizing = useMemo(
    () => calculateCrmSizing(ss, { allInputs: sessionSources }),
    [ss, sessionSources],
  );
  const overlapWarning = useMemo(
    () => detectCrmOverlap(ss, sessionSources),
    [ss, sessionSources],
  );

  function setVendor(next) {
    const meta = getCrmVendorMeta(next);
    const toggles = buildProfileToggles(normalized.crmCollectionProfile);
    update(sourceId, {
      crmVendor: next,
      vendor: meta.label,
      crmCustomizeComponents: false,
      crmComponentToggles: toggles,
    });
    setShowCustomize(false);
  }

  function setProfile(profileId) {
    const toggles = buildProfileToggles(profileId);
    update(sourceId, {
      crmCollectionProfile: profileId,
      crmCustomizeComponents: false,
      crmComponentToggles: toggles,
    });
    setShowCustomize(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-label text-[var(--cast-text-secondary)] leading-snug">
        CRM includes audit, login, record activity, case/ticket activity, and integration events from CRM platforms such as Salesforce, Dynamics 365, HubSpot, Zendesk, and ServiceNow CSM.
      </p>
      <p className="text-badge text-[var(--cast-text-muted)]">
        CRM ingest is estimated from vendor, tenant count, active CRM users, integrations, collection profile, and activity level.
      </p>

      <div>
        <label className="text-label block mb-0.5">CRM vendor</label>
        <select
          className="input-field w-full"
          value={normalized.crmVendor}
          onChange={(e) => setVendor(e.target.value)}
        >
          {vendorOptions.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">CRM platform.</p>
      </div>

      <div>
        <label className="text-label block mb-0.5">Number of tenants / orgs / instances</label>
        <input
          type="number"
          min="0"
          step="1"
          className="input-field w-full"
          value={normalized.crmTenantCount ?? ''}
          onChange={(e) => update(sourceId, { crmTenantCount: e.target.value })}
          placeholder="0"
        />
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
          CRM tenants, orgs, environments, portals, or instances sending audit logs.
        </p>
      </div>

      <div>
        <label className="text-label block mb-0.5">Number of active CRM users</label>
        <input
          type="number"
          min="0"
          step="1"
          className="input-field w-full"
          value={normalized.crmActiveUserCount ?? ''}
          onChange={(e) =>
            update(sourceId, { crmActiveUserCount: e.target.value, count: e.target.value })
          }
          placeholder="0"
        />
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
          Users actively working in the CRM, such as sales users, service agents, admins, or managers.
        </p>
      </div>

      <div>
        <label className="text-label block mb-0.5">Number of integrations / API clients</label>
        <input
          type="number"
          min="0"
          step="1"
          className="input-field w-full"
          value={normalized.crmIntegrationCount ?? ''}
          onChange={(e) => update(sourceId, { crmIntegrationCount: e.target.value })}
          placeholder="0"
        />
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
          Connected apps, service accounts, middleware jobs, API clients, or scheduled CRM integrations.
        </p>
      </div>

      <div>
        <label className="text-label block mb-0.5">Collection profile</label>
        <p className="text-badge text-[var(--cast-text-muted)] mb-1">Choose the type of CRM logging collected.</p>
        <div className="space-y-2">
          {profileOptions.map((p) => (
            <label
              key={p.id}
              className="flex items-start gap-2 cursor-pointer rounded-lg border border-[var(--cast-border)] p-2 hover:bg-[var(--cast-panel-alt)]/50"
            >
              <input
                type="radio"
                name={`crmProfile-${sourceId}`}
                className="mt-1"
                checked={normalized.crmCollectionProfile === p.id}
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
        <label className="text-label block mb-0.5">Activity level</label>
        <select
          className="input-field w-full"
          value={normalized.crmActivityLevel}
          onChange={(e) => update(sourceId, { crmActivityLevel: e.target.value })}
        >
          {activityOptions.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
          Adjusts modeled CRM event volume for light, normal, or heavy CRM usage.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer text-label">
          <input
            type="checkbox"
            checked={showCustomize}
            onChange={(e) => {
              setShowCustomize(e.target.checked);
              update(sourceId, { crmCustomizeComponents: e.target.checked });
            }}
          />
          Customize CRM log components
        </label>
        {showCustomize && (
          <div className="mt-2 space-y-1.5 pl-1 border-l-2 border-[var(--cast-border)] ml-1">
            {COMPONENT_TOGGLE_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 cursor-pointer text-badge">
                <input
                  type="checkbox"
                  checked={normalized.crmComponentToggles?.[f.key] !== false}
                  onChange={(e) => {
                    const toggles = {
                      ...(normalized.crmComponentToggles || {}),
                      [f.key]: e.target.checked,
                    };
                    update(sourceId, {
                      crmCustomizeComponents: true,
                      crmComponentToggles: toggles,
                    });
                    setShowCustomize(true);
                  }}
                />
                {f.label}
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer text-label">
          <input
            type="checkbox"
            checked={showDailyEvents}
            onChange={(e) => {
              setShowDailyEvents(e.target.checked);
              update(sourceId, { crmUseDailyEventCounts: e.target.checked });
            }}
          />
          Use exact daily event counts
        </label>
        {showDailyEvents && (
          <div className="mt-2 space-y-2 pl-1 border-l-2 border-[var(--cast-border)] ml-1">
            {DAILY_EVENT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-badge block mb-0.5">{f.label}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="input-field w-full"
                  value={normalized[f.key] ?? ''}
                  onChange={(e) => update(sourceId, { [f.key]: e.target.value })}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        )}
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
                  {formatCrmIngestString(m.value)}
                </p>
              </div>
            ))}
          </div>
          <p className="text-badge text-[var(--cast-text-muted)] italic">{CRM_VALIDATION_NOTE}</p>
        </div>
      )}

      <CrmSizingBreakdownTable breakdown={sizing.crmBreakdown} />

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
