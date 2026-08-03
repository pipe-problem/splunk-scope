import { useMemo } from 'react';
import { Info, Target, Database, Package, Activity, FileText, Ruler } from 'lucide-react';
import { generateSourceInsight } from '../../services/sourceInsightEngine.js';
import { calculateCoverage } from '../../services/coverageEngine.js';
import sourceCatalog from '../../data/sources.json';
import { flattenSourceCatalog } from '../../services/sizingEngine.js';
import {
  getMeasurementQuestion,
  resolveMeasurementInputFields,
} from '../../services/sourceMeasurementQuestionsService.js';
import SourceOverlapSection from './SourceOverlapSection.jsx';

const flatCatalog = flattenSourceCatalog(sourceCatalog);

const STRENGTH_WIDTH = {
  strong: 100,
  partial: 62,
  minimal: 28,
};

const TILE_ICONS = {
  'What it is': Info,
  'Used for': Target,
  Collection: Database,
  'Apps powered': Package,
};

function buildSampleLog(source) {
  if (source.exampleLog) return String(source.exampleLog);
  if (Array.isArray(source.exampleLogs) && source.exampleLogs.length) {
    return source.exampleLogs.slice(0, 5).join('\n');
  }
  if (source.id === 'edr') {
    return [
      'timestamp=2026-07-06T21:49:45Z host=workstation-042 user=DOMAIN\\jsmith',
      'vendor_product="CrowdStrike Falcon" event_type=process process_name=powershell.exe',
      'parent_process=winword.exe command_line="powershell.exe -enc <encoded_command>"',
      'file_hash=SHA256:a1b2c3d4e5 severity=high action=blocked',
      'src_ip=10.0.1.42 dest_ip=198.51.100.25',
    ].join('\n');
  }
  const vendor = source.exampleVendors?.[0] || 'vendor';
  return [
    `${new Date().toISOString().slice(0, 19)}Z host=server01 action=audit vendor="${vendor}"`,
    'event_id=4624 log_name=Security outcome=success user=DOMAIN\\\\jsmith',
    'src_ip=10.0.1.42 dest=dc01.corp.local category=authentication',
    'message="An account was successfully logged on."',
  ].join('\n');
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--cast-accent-muted)] flex items-center justify-center">
        <Icon size={17} className="text-[var(--cast-accent)]" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-[var(--cast-text)]">{title}</h3>
    </div>
  );
}

function TelemetryDomainBars({ domains }) {
  if (!domains?.length) {
    return (
      <p className="text-sm text-[var(--cast-text-muted)] leading-relaxed pl-[2.875rem]">
        No telemetry domain mapping for this source.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader icon={Activity} title="Telemetry domains" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 pl-0 sm:pl-[2.875rem]">
        {domains.slice(0, 8).map((d) => {
          const pct = STRENGTH_WIDTH[d.strength] ?? 20;
          return (
            <div key={d.domain} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm text-[var(--cast-text-secondary)]">
                <span className="capitalize">{d.label}</span>
                <span className="text-[var(--cast-text-muted)] shrink-0 capitalize text-xs">{d.strength}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--cast-panel-alt)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--cast-accent)]/70 to-[var(--cast-accent)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoBlock({ label, text, icon: Icon }) {
  if (!text) return null;
  return (
    <div className="rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/35 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--cast-accent-muted)] flex items-center justify-center mt-0.5">
          <Icon size={17} className="text-[var(--cast-accent)]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--cast-text)] mb-1.5">{label}</p>
          <p className="text-sm text-[var(--cast-text-secondary)] leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}

function LinkListBlock({ label, items, icon: Icon }) {
  const list = [...new Set((items || []).filter(Boolean))];
  if (!list.length) return null;
  return (
    <div className="rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/35 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--cast-accent-muted)] flex items-center justify-center mt-0.5">
          <Icon size={17} className="text-[var(--cast-accent)]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--cast-text)] mb-2">{label}</p>
          <ul className="space-y-1.5 text-sm text-[var(--cast-text-secondary)] leading-relaxed">
            {list.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[var(--cast-accent)] shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SizingReferenceSection({ source }) {
  const measurement = getMeasurementQuestion(source.id);
  const { numbers, selects } = resolveMeasurementInputFields(source.id, source, measurement);

  if (!measurement?.question && !numbers.length && !selects.length) return null;

  return (
    <section className="space-y-4" aria-labelledby="sizing-reference-heading">
      <SectionHeader icon={Ruler} title="Sizing parameters" />
      {measurement?.question && (
        <div className="rounded-xl border border-[var(--cast-border)] bg-[var(--cast-panel-alt)]/40 px-5 py-4">
          <p className="text-sm font-medium text-[var(--cast-text)]">{measurement.question}</p>
          {measurement.helperText && (
            <p className="text-sm text-[var(--cast-text-muted)] mt-2 leading-relaxed">{measurement.helperText}</p>
          )}
        </div>
      )}
      {(numbers.length > 0 || selects.length > 0) && (
        <ul className="text-sm text-[var(--cast-text-secondary)] space-y-2 pl-1">
          {numbers.map((f) => (
            <li key={f.key}>
              <span className="font-medium text-[var(--cast-text)]">{f.label || f.key}</span>
              {f.helper ? <span className="text-[var(--cast-text-muted)]"> — {f.helper}</span> : null}
            </li>
          ))}
          {selects.map((f) => (
            <li key={f.key}>
              <span className="font-medium text-[var(--cast-text)]">{f.label || f.key}</span>
              {f.options?.length ? (
                <span className="text-[var(--cast-text-muted)]"> ({f.options.slice(0, 4).join(', ')}
                  {f.options.length > 4 ? ', …' : ''})</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Shared source intelligence blocks for configure panel and reference library.
 */
export default function SourceIntelSections({
  source,
  useCases,
  sourceStates,
  allSources = flatCatalog,
  showSizingReference = true,
  showOverlap = true,
}) {
  const insight = useMemo(
    () =>
      generateSourceInsight(
        source,
        useCases,
        calculateCoverage(useCases, sourceStates, sourceCatalog),
        sourceStates,
        allSources,
      ),
    [source, useCases, sourceStates, allSources],
  );

  const sampleLog = useMemo(() => buildSampleLog(source), [source]);
  const sampleLines = sampleLog.split('\n').slice(0, 5).join('\n');

  if (!insight || !source) return null;

  const collectionItems = (insight.collectionMethods || []).filter(Boolean).slice(0, 6);

  const technologyItems = [
    ...(source.technicalAddons || []),
    ...(insight.technologyAddons || []).map((a) => (typeof a === 'string' ? a : a?.name)),
    ...(insight.catalogProducts?.technicalAddons || []).map((a) => a.name),
  ].filter(Boolean);

  const appItems = [
    ...(source.splunkApps || []),
    ...(insight.splunkAppsPowered || insight.splunkApps || []).map((a) =>
      typeof a === 'string' ? a : a?.name,
    ),
  ].filter(Boolean);

  const usedFor = Array.isArray(insight.whyItMatters)
    ? insight.whyItMatters.join(' ')
    : insight.whyItMatters;

  const vendorFallback = source.exampleVendors?.slice(0, 3).join(', ');
  const overview = source.description || insight.overview;

  return (
    <div className="source-intel-sections space-y-6">
      <SectionHeader icon={Info} title="About this source" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoBlock label="What it is" text={overview} icon={TILE_ICONS['What it is']} />
        <InfoBlock
          label="Used for"
          text={source.whyItMatters || usedFor}
          icon={TILE_ICONS['Used for']}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LinkListBlock
          label="Collection method"
          items={
            collectionItems.length
              ? collectionItems
              : vendorFallback
                ? [`Universal Forwarder or syslog (e.g. ${vendorFallback})`]
                : []
          }
          icon={TILE_ICONS.Collection}
        />
        <LinkListBlock
          label="Technology add-ons / integrations"
          items={technologyItems}
          icon={TILE_ICONS.Collection}
        />
        <LinkListBlock label="Apps powered" items={appItems} icon={TILE_ICONS['Apps powered']} />
      </div>

      <TelemetryDomainBars domains={insight.telemetryDomains} />

      {showSizingReference && <SizingReferenceSection source={source} />}

      {showOverlap && (
        <SourceOverlapSection source={source} allSources={allSources} />
      )}

      <div className="space-y-3">
        <SectionHeader icon={FileText} title="Sample log" />
        <pre className="rounded-xl border border-[var(--cast-border)] bg-[var(--cast-bg)]/70 px-5 py-4 text-xs sm:text-sm font-mono text-[var(--cast-text-secondary)] leading-relaxed overflow-x-auto whitespace-pre-wrap break-words max-h-[8rem] overflow-y-auto">
          {sampleLines}
        </pre>
      </div>
    </div>
  );
}
