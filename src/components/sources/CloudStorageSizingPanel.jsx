import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  calculateCloudStorageSizing,
  detectCloudStorageOverlap,
  formatCloudStorageGb,
  getCloudStorageProfileOptions,
  getCloudStorageVendorMeta,
  getCloudStorageVendorOptions,
  normalizeCloudStorageState,
  PROFILE_TOGGLES,
  CLOUD_STORAGE_VALIDATION_NOTE,
} from '../../services/cloudStorageSizingEngine.js';

export function CloudStorageSizingBreakdownTable({ breakdown, className = '' }) {
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
                  {formatCloudStorageGb(row.mediumGb)} GB/day
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const COMPONENT_FIELDS = [
  { key: 'includeManagementAudit', label: 'Management / configuration audit logs' },
  { key: 'includeAccessRequestLogs', label: 'Object / file access request logs', helper: 'Use this if object or file access logs are collected, such as GET, PUT, DELETE, READ, WRITE, OPEN, or CLOSE activity.' },
  { key: 'includeLifecycleReplication', label: 'Lifecycle / replication / tiering logs' },
  { key: 'includePerformanceHealth', label: 'Performance / health / system logs' },
];

export default function CloudStorageSizingPanel({ sourceId, ss, sessionSources, update }) {
  const normalized = useMemo(() => normalizeCloudStorageState(ss), [ss]);
  const vendorOptions = getCloudStorageVendorOptions();
  const profileOptions = getCloudStorageProfileOptions();
  const vendorMeta = getCloudStorageVendorMeta(normalized.cloudStorageVendor);
  const [showCustomize, setShowCustomize] = useState(Boolean(normalized.cloudStorageCustomizeComponents));

  const sizing = useMemo(
    () => calculateCloudStorageSizing(ss, { allInputs: sessionSources }),
    [ss, sessionSources],
  );
  const overlapWarning = useMemo(
    () => detectCloudStorageOverlap(ss, sessionSources),
    [ss, sessionSources],
  );

  function setVendor(next) {
    update(sourceId, {
      cloudStorageVendor: next,
      vendor: getCloudStorageVendorMeta(next).label,
    });
  }

  function setAssetCount(value) {
    update(sourceId, {
      cloudStorageAssetCount: value,
      count: value,
    });
  }

  function setProfile(profileId) {
    const toggles = PROFILE_TOGGLES[profileId] || PROFILE_TOGGLES.base_storage_telemetry;
    update(sourceId, {
      cloudStorageCollectionProfile: profileId,
      cloudStorageCustomizeComponents: false,
      cloudStorageComponentToggles: { ...toggles },
    });
    setShowCustomize(false);
  }

  function setCustomize(enabled) {
    setShowCustomize(enabled);
    update(sourceId, { cloudStorageCustomizeComponents: enabled });
  }

  function setComponentToggle(key, checked) {
    const toggles = { ...(normalized.cloudStorageComponentToggles || {}), [key]: checked };
    update(sourceId, {
      cloudStorageCustomizeComponents: true,
      cloudStorageComponentToggles: toggles,
    });
    setShowCustomize(true);
  }

  return (
    <div className="space-y-3">
      <p className="text-label text-[var(--cast-text-secondary)] leading-snug">
        Cloud Storage includes logs from cloud object storage and cloud file storage platforms, such as management activity, object/file access requests, lifecycle or replication events, and storage health telemetry.
      </p>
      <p className="text-badge text-[var(--cast-text-muted)]">
        Storage ingest is estimated from vendor, storage asset count, and selected log components.
      </p>

      <div>
        <label className="text-label block mb-0.5">Cloud storage vendor</label>
        <select
          className="input-field w-full"
          value={normalized.cloudStorageVendor}
          onChange={(e) => setVendor(e.target.value)}
        >
          {vendorOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">Cloud storage platform.</p>
      </div>

      <div>
        <label className="text-label block mb-0.5">Number of storage assets</label>
        <input
          type="number"
          min="0"
          step="1"
          className="input-field w-full"
          value={normalized.cloudStorageAssetCount ?? ''}
          onChange={(e) => setAssetCount(e.target.value)}
          placeholder="0"
        />
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
          How many buckets, storage accounts, volumes, or filesystems will send logs?
        </p>
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
          For AWS and Google, use buckets. For Azure, use storage accounts. For NetApp, use volumes. For Dell PowerScale, use filesystems or access zones.
        </p>
      </div>

      <div>
        <label className="text-label block mb-0.5">Collection profile</label>
        <p className="text-badge text-[var(--cast-text-muted)] mb-1">Choose what storage logging is collected.</p>
        <div className="space-y-2">
          {profileOptions.map((p) => (
            <label key={p.id} className="flex items-start gap-2 cursor-pointer rounded-lg border border-[var(--cast-border)] p-2 hover:bg-[var(--cast-panel-alt)]/50">
              <input
                type="radio"
                name={`cloudStorageProfile-${sourceId}`}
                className="mt-1"
                checked={normalized.cloudStorageCollectionProfile === p.id}
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

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showCustomize}
          onChange={(e) => setCustomize(e.target.checked)}
        />
        <span className="text-label text-[var(--cast-text)]">Customize storage log components</span>
      </label>

      {showCustomize && (
        <div className="rounded-lg border border-[var(--cast-border)] p-2.5 space-y-2 bg-[var(--cast-panel-alt)]/40">
          {COMPONENT_FIELDS.map((f) => (
            <label key={f.key} className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={normalized.cloudStorageComponentToggles?.[f.key] !== false}
                onChange={(e) => setComponentToggle(f.key, e.target.checked)}
              />
              <span>
                <span className="text-label font-medium text-[var(--cast-text)] block">{f.label}</span>
                {f.helper && (
                  <span className="text-badge text-[var(--cast-text-muted)]">{f.helper}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}

      {(sizing.expected > 0 || sizing.low > 0 || sizing.high > 0) && (
        <div className="rounded-lg border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/60 p-2.5 space-y-2">
          <p className="text-metric-label text-[var(--cast-text-muted)]">
            Calculated ingest ({vendorMeta.label} · per {vendorMeta.assetUnitLabel})
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
                  {formatCloudStorageGb(m.value)} <span className="font-normal text-[var(--cast-text-muted)]">GB/day</span>
                </p>
              </div>
            ))}
          </div>
          <p className="text-badge text-[var(--cast-text-muted)] italic">{CLOUD_STORAGE_VALIDATION_NOTE}</p>
        </div>
      )}

      <CloudStorageSizingBreakdownTable breakdown={sizing.cloudStorageBreakdown} />

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
