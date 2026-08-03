import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  calculateContainerSizing,
  detectContainerOverlap,
  formatContainerGb,
  getContainerPlatformOptions,
  getPlatformMeta,
  normalizeContainerState,
  CONTAINER_VALIDATION_NOTE,
} from '../../services/containerSizingEngine.js';

export function ContainerSizingBreakdownTable({ breakdown, className = '' }) {
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
                  {formatContainerGb(row.mediumGb)} GB/day
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ContainerSizingPanel({ sourceId, ss, sessionSources, update }) {
  const normalized = useMemo(() => normalizeContainerState(ss), [ss]);
  const platformOptions = getContainerPlatformOptions();
  const platformMeta = getPlatformMeta(normalized.containerPlatform);
  const sizing = useMemo(
    () => calculateContainerSizing(ss, { allInputs: sessionSources }),
    [ss, sessionSources],
  );
  const overlapWarning = useMemo(
    () => detectContainerOverlap(ss, sessionSources),
    [ss, sessionSources],
  );

  function setPlatform(next) {
    update(sourceId, {
      containerPlatform: next,
      vendor: getPlatformMeta(next).label,
    });
  }

  function setCount(key, value) {
    const counts = { ...(normalized.containerCounts || {}), [key]: value };
    update(sourceId, {
      containerCounts: counts,
      count: key === 'clusters' ? value : normalized.containerCounts?.clusters ?? ss.count,
    });
  }

  function setToggle(key, checked) {
    const toggles = { ...(normalized.containerToggles || {}), [key]: checked };
    update(sourceId, { containerToggles: toggles });
  }

  return (
    <div className="space-y-3">
      <p className="text-label text-[var(--cast-text-secondary)] leading-snug">
        Containers / Pods / Clusters includes Kubernetes and container platform logs such as control-plane activity, audit events, node/runtime logs, and application logs written by containers.
      </p>
      <p className="text-badge text-[var(--cast-text-muted)]">
        Container ingest is estimated from cluster, node, and pod/container counts.
      </p>

      <div>
        <label className="text-label block mb-0.5">Container platform</label>
        <select
          className="input-field w-full"
          value={normalized.containerPlatform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          {platformOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
          Kubernetes, OpenShift, EKS, AKS, GKE, or blended average.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="text-label block mb-0.5">Number of clusters</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input-field w-full"
            value={normalized.containerCounts?.clusters ?? ''}
            onChange={(e) => setCount('clusters', e.target.value)}
            placeholder="0"
          />
          <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
            Clusters sending control-plane, audit, or Kubernetes event logs.
          </p>
        </div>
        <div>
          <label className="text-label block mb-0.5">Number of nodes</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input-field w-full"
            value={normalized.containerCounts?.nodes ?? ''}
            onChange={(e) => setCount('nodes', e.target.value)}
            placeholder="0"
          />
          <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
            Worker/control nodes sending kubelet, runtime, or infrastructure logs.
          </p>
        </div>
        <div>
          <label className="text-label block mb-0.5">Number of pods / containers</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input-field w-full"
            value={normalized.containerCounts?.podsOrContainers ?? ''}
            onChange={(e) => setCount('podsOrContainers', e.target.value)}
            placeholder="0"
          />
          <p className="text-badge text-[var(--cast-text-muted)] mt-0.5">
            Running pods or containers sending stdout/application logs. If only pod count is known, use pod count as an approximation.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={normalized.containerToggles?.includeAuditEvents !== false}
            onChange={(e) => setToggle('includeAuditEvents', e.target.checked)}
          />
          <span>
            <span className="text-label font-medium text-[var(--cast-text)] block">Include audit/events</span>
            <span className="text-badge text-[var(--cast-text-muted)]">API activity and Kubernetes object/event changes.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={normalized.containerToggles?.includeContainerStdout !== false}
            onChange={(e) => setToggle('includeContainerStdout', e.target.checked)}
          />
          <span>
            <span className="text-label font-medium text-[var(--cast-text)] block">Include container stdout</span>
            <span className="text-badge text-[var(--cast-text-muted)]">Application logs written by containers.</span>
          </span>
        </label>
      </div>

      {(sizing.expected > 0 || sizing.low > 0 || sizing.high > 0) && (
        <div className="rounded-lg border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/60 p-2.5 space-y-2">
          <p className="text-metric-label text-[var(--cast-text-muted)]">Calculated ingest ({platformMeta.label})</p>
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
                  {formatContainerGb(m.value)} <span className="font-normal text-[var(--cast-text-muted)]">GB/day</span>
                </p>
              </div>
            ))}
          </div>
          <p className="text-badge text-[var(--cast-text-muted)] italic">{CONTAINER_VALIDATION_NOTE}</p>
        </div>
      )}

      <ContainerSizingBreakdownTable breakdown={sizing.containerBreakdown} />

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
