import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import PlanningKpiStrip from '../PlanningKpiStrip.jsx';
import CiscoPromoIngestValue from '../CiscoPromoIngestValue.jsx';
import {
  FUTURE_MATURITY_SECTION_TITLE,
  TELEMETRY_GAPS_SECTION_TITLE,
  STARTUP_SUMMARY_SECTION_TITLE,
} from '../../constants/customerFacingCopy.js';

function AccordionSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card-compact !p-0 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[var(--cast-panel-alt)] transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-card-header">{title}</span>
        {open ? (
          <ChevronDown size={16} className="text-[var(--cast-text-muted)] shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-[var(--cast-text-muted)] shrink-0" />
        )}
      </button>
      {open && <div className="px-4 pb-4 border-t border-[var(--cast-border)]">{children}</div>}
    </div>
  );
}

/**
 * Customer-facing report preview — driven entirely by customerReportDataBuilder output.
 * @param {{ data: object }} props
 */
export default function ReportDeliverablePreview({ data }) {
  const path = data.pathDetail;
  if (!path) return null;

  const maturityOpportunities = path.maturityOpportunities || path.gaps || [];
  const telemetryGaps = path.telemetryGaps || [];
  const showTelemetryGaps =
    (path.pathPhase === 'crawl' || path.pathPhase === 'walk') && telemetryGaps.length > 0;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <header className="card-compact">
        <p className="text-metric-label mb-1">{data.customer}</p>
        <h3 className="text-page-title m-0">{path.name}</h3>
        {path.description && (
          <p className="text-body text-[var(--cast-text-secondary)] mt-2 mb-0">{path.description}</p>
        )}
      </header>

      <section className="card-compact">
        <PlanningKpiStrip
          scope="path"
          totals={path.ingestSummary}
          title="Recommended path ingest (±20%)"
          compact
        />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="card-compact">
          <h4 className="text-card-header mb-2">What this delivers</h4>
          <ul className="text-body text-[var(--cast-text-secondary)] space-y-1.5 list-disc pl-4 m-0">
            {(path.valueDelivered || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="card-compact">
          <h4 className="text-card-header mb-2">
            Splunk apps powered
            <span className="text-badge text-[var(--cast-text-muted)] font-normal ml-2">
              ({path.appsPowered?.length || 0})
            </span>
          </h4>
          {path.appsPowered?.length ? (
            <ul className="space-y-1.5 m-0 p-0 list-none">
              {path.appsPowered.map((app) => (
                <li key={app.id} className="flex items-center gap-1.5 text-body">
                  {app.url ? (
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--cast-accent)] hover:underline inline-flex items-center gap-1"
                    >
                      {app.name}
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-[var(--cast-text-secondary)]">{app.name}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-label text-[var(--cast-text-muted)] m-0">No app mappings for this path yet.</p>
          )}
          {path.appsPartiallyPowered?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[var(--cast-border)]">
              <p className="text-badge text-[var(--cast-text-muted)] mb-2 m-0">Later phase / partially covered</p>
              <ul className="space-y-2 m-0 p-0 list-none">
                {path.appsPartiallyPowered.map((app) => (
                  <li key={app.id} className="text-body text-[var(--cast-text-secondary)]">
                    <span className="font-medium text-[var(--cast-text-primary)]">{app.name}</span>
                    {app.reason && (
                      <span className="block text-label text-[var(--cast-text-muted)] mt-0.5">{app.reason}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="card-compact">
        <h4 className="text-card-header mb-2">
          Sources in this path
          <span className="text-badge text-[var(--cast-text-muted)] font-normal ml-2">
            ({path.sourceCount})
          </span>
        </h4>
        <ul className="divide-y divide-[var(--cast-border)] m-0 p-0 list-none">
          {path.sourcesIncluded.map((src) => (
            <li key={src.id} className="flex items-center justify-between gap-3 py-2 text-body">
              <span className="text-[var(--cast-text-secondary)] truncate">{src.name}</span>
              <span className="font-mono text-sm text-[var(--cast-success)] tabular-nums shrink-0">
                <CiscoPromoIngestValue
                  billable={src.ingestExpected}
                  gross={src.ingestGrossExpected}
                  promoApplied={src.ciscoPromoApplied}
                  billableClassName="font-mono text-sm text-[var(--cast-success)] tabular-nums"
                />
              </span>
            </li>
          ))}
        </ul>
      </section>

      {maturityOpportunities.length > 0 && (
        <section className="card-compact border-[var(--cast-warning)]/30">
          <h4 className="text-card-header mb-2">{FUTURE_MATURITY_SECTION_TITLE}</h4>
          <ul className="text-body text-[var(--cast-text-secondary)] space-y-1.5 list-disc pl-4 m-0">
            {maturityOpportunities.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </section>
      )}

      {showTelemetryGaps && (
        <section className="card-compact border-[var(--cast-info)]/30">
          <h4 className="text-card-header mb-2">{TELEMETRY_GAPS_SECTION_TITLE}</h4>
          <p className="text-label text-[var(--cast-text-muted)] mt-0 mb-2">
            Required telemetry domains that remain below the coverage threshold on this path. Address
            these during onboarding or a later phase to strengthen use-case coverage.
          </p>
          <ul className="text-body text-[var(--cast-text-secondary)] space-y-1.5 list-disc pl-4 m-0">
            {telemetryGaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </section>
      )}

      {data.startupGuide?.phaseCards?.length > 0 && (
        <section>
          <h4 className="text-card-header mb-2 px-1">{STARTUP_SUMMARY_SECTION_TITLE}</h4>
          <div className="space-y-2">
            {data.startupGuide.phaseCards.map((card) => (
              <AccordionSection key={card.title} title={card.title}>
                <div className="space-y-3 pt-2">
                  {card.phases.map((phase) => (
                    <div key={`${card.title}-${phase.title}`}>
                      <p className="text-label font-semibold text-[var(--cast-text)] mb-1">{phase.title}</p>
                      <ul className="text-label text-[var(--cast-text-secondary)] space-y-0.5 list-disc pl-4 m-0">
                        {(phase.tasks || []).map((task) => (
                          <li key={task}>{task}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            ))}
          </div>
        </section>
      )}

      <p className="text-tiny text-[var(--cast-text-muted)] px-1">{data.assumptions}</p>
    </div>
  );
}
