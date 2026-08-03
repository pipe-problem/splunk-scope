/**
 * Customer HTML that mirrors the in-app Report preview (ReportDeliverablePreview.jsx).
 * When changing report layout or copy, update both files and exportDesignTokens.js (CAST_DARK ↔ index.css).
 */

import { formatIngestString } from '../utils/formatIngestDisplay.js';
import { formatIngestGb } from './exportShared.js';
import {
  RECOMMENDED_PATH_INGEST_LABEL,
  RANGE_CAPTION,
  FUTURE_MATURITY_SECTION_TITLE,
  TELEMETRY_GAPS_SECTION_TITLE,
  STARTUP_SUMMARY_SECTION_TITLE,
} from '../constants/customerFacingCopy.js';
import { buildOnboardingCardsFromReportData } from './sourceOnboardingResolver.js';

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function exportStatusTag(status) {
  if (!status || status === 'current') {
    return '<span class="tag tag--included">Included</span>';
  }
  if (status === 'future') {
    return '<span class="tag">Future phase</span>';
  }
  return '';
}

function formatTaLinksHtml(links, fallbackText) {
  if (Array.isArray(links) && links.length) {
    return links
      .map((link) =>
        link.url
          ? `<a class="app-link" href="${esc(link.url)}" rel="noopener">${esc(link.label)}</a>`
          : esc(link.label),
      )
      .join(' · ');
  }
  return esc(fallbackText || '');
}

/** Matches PlanningKpiStrip — Low / Expected / High ingest band. */
function renderPathIngestKpiStrip(summary) {
  const low = formatIngestGb(summary?.low);
  const expected = formatIngestGb(summary?.expected);
  const high = formatIngestGb(summary?.high);

  return `
<section class="card-compact">
  <p class="text-metric-label">${esc(RECOMMENDED_PATH_INGEST_LABEL)} (±20%)</p>
  <div class="ingest-kpi-grid">
    <div class="ingest-kpi-cell">
      <p class="ingest-kpi-label">Low</p>
      <p class="ingest-kpi-val ingest-kpi-val--info">${esc(low)}</p>
      <p class="ingest-kpi-unit">GB/day</p>
    </div>
    <div class="ingest-kpi-cell ingest-kpi-cell--expected">
      <p class="ingest-kpi-label">Expected</p>
      <p class="ingest-kpi-val ingest-kpi-val--expected">${esc(expected)}</p>
      <p class="ingest-kpi-unit">GB/day</p>
    </div>
    <div class="ingest-kpi-cell">
      <p class="ingest-kpi-label">High</p>
      <p class="ingest-kpi-val ingest-kpi-val--warning">${esc(high)}</p>
      <p class="ingest-kpi-unit">GB/day</p>
    </div>
  </div>
  <p class="ingest-kpi-foot">${esc(RANGE_CAPTION)}</p>
</section>`;
}

function renderBulletSection(title, items, { badge, variant } = {}) {
  if (!items?.length) return '';
  const badgeHtml = badge != null ? ` <span class="text-badge">(${esc(String(badge))})</span>` : '';
  const variantClass = variant ? ` card-${variant}` : '';
  const listHtml = items.map((item) => `<li>${esc(item)}</li>`).join('');
  return `
<section class="card-compact${variantClass}">
  <h2 class="text-card-header">${esc(title)}${badgeHtml}</h2>
  <ul class="bullet-list">${listHtml}</ul>
</section>`;
}

function renderAppsSection(path) {
  const apps = path.appsPowered || [];
  const partialApps = path.appsPartiallyPowered || [];

  const appsHtml = apps.length
    ? apps
        .map((app) =>
          app.url
            ? `<li><a class="app-link" href="${esc(app.url)}" rel="noopener">${esc(app.name)}</a></li>`
            : `<li>${esc(app.name)}</li>`,
        )
        .join('')
    : '<li class="text-muted">No app mappings for this path yet.</li>';

  const partialAppsHtml = partialApps.length
    ? `<div class="partial-apps">
        <p class="text-metric-label">Later phase / partially covered</p>
        <ul class="bullet-list">${partialApps
          .map(
            (app) =>
              `<li><strong>${esc(app.name)}</strong>${app.reason ? `<br><span class="meta">${esc(app.reason)}</span>` : ''}</li>`,
          )
          .join('')}</ul>
      </div>`
    : '';

  return `
<section class="card-compact">
  <h2 class="text-card-header">Splunk apps powered <span class="text-badge">(${apps.length})</span></h2>
  <ul class="link-list">${appsHtml}</ul>
  ${partialAppsHtml}
</section>`;
}

function renderSourcesSection(path) {
  const sources = path.sourcesIncluded || [];
  const sourcesHtml = sources
    .map(
      (src) => `<li class="source-line">
        <span class="source-line__name">${esc(src.name)}</span>
        <span class="source-line__ingest">${esc(formatIngestString(src.ingestExpected))}</span>
      </li>`,
    )
    .join('');

  return `
<section class="card-compact">
  <h2 class="text-card-header">Sources in this path <span class="text-badge">(${sources.length})</span></h2>
  <ul class="source-table">${sourcesHtml || '<li class="text-muted">No configured sources in this path.</li>'}</ul>
</section>`;
}

/**
 * Value proposition HTML — mirrors ReportDeliverablePreview layout.
 * @param {object} data - sanitized report data
 */
export function renderCustomerValuePropositionBody(data) {
  const path = data.pathDetail || {};
  const summary = path.ingestSummary || data.ingestSummary || {};
  const dateStr = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const valueItems = (path.valueDelivered || data.overview?.deliveryBullets || []).filter(Boolean);
  const maturityOpportunities = path.maturityOpportunities || path.gaps || [];
  const telemetryGaps = path.telemetryGaps || [];
  const showTelemetryGaps =
    (path.pathPhase === 'crawl' || path.pathPhase === 'walk') && telemetryGaps.length > 0;

  const valueHtml =
    valueItems.map((v) => `<li>${esc(v)}</li>`).join('') ||
    '<li>Operational visibility from your configured telemetry sources.</li>';

  const maturityHtml = maturityOpportunities.length
    ? renderBulletSection(FUTURE_MATURITY_SECTION_TITLE, maturityOpportunities, { variant: 'warning' })
    : '';

  const telemetryHtml = showTelemetryGaps
    ? `<section class="card-compact card-info">
      <h2 class="text-card-header">${esc(TELEMETRY_GAPS_SECTION_TITLE)}</h2>
      <p class="section-lead">Required telemetry domains that remain below the coverage threshold on this path. Address these during onboarding or a later phase to strengthen use-case coverage.</p>
      <ul class="bullet-list">${telemetryGaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
    </section>`
    : '';

  return `
<div class="report-preview">
  <header class="card-compact report-header">
    <p class="text-metric-label">${esc(data.customer)}</p>
    <h1 class="text-page-title">${esc(path.name || data.selectedPath)}</h1>
    ${path.description ? `<p class="text-body text-secondary">${esc(path.description)}</p>` : ''}
    ${dateStr ? `<p class="text-tiny text-muted">Prepared ${esc(dateStr)}</p>` : ''}
  </header>

  ${renderPathIngestKpiStrip(summary)}

  <div class="grid-2">
    <section class="card-compact">
      <h2 class="text-card-header">What this delivers</h2>
      <ul class="bullet-list">${valueHtml}</ul>
    </section>
    ${renderAppsSection(path)}
  </div>

  ${renderSourcesSection(path)}
  ${maturityHtml}
  ${telemetryHtml}
</div>`;
}

/**
 * Startup guide HTML — startup summary + per-source onboarding with validation SPL.
 * @param {object} data - sanitized report data
 */
export function renderStartupGuideBody(data) {
  const path = data.pathDetail || {};
  const summary = path.ingestSummary || data.ingestSummary || {};
  const cards = buildOnboardingCardsFromReportData(data);
  const dateStr = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const summaryHtml = (data.startupGuide?.phaseCards || [])
    .map((card) => {
      const phasesInner = card.phases
        .map(
          (phase) =>
            `<li><strong>${esc(phase.title)}</strong><ul class="bullet-list">${(phase.tasks || [])
              .map((t) => `<li>${esc(t)}</li>`)
              .join('')}</ul></li>`,
        )
        .join('');
      return `<details class="week-accordion"><summary>${esc(card.title)}</summary><div class="week-accordion-body"><ul class="clean">${phasesInner}</ul></div></details>`;
    })
    .join('');

  const prereqHtml = (data.startupGuide?.prerequisites || [])
    .map((p) => `<li>${esc(p)}</li>`)
    .join('');

  const sourceCardsHtml = cards
    .map((card) => {
      const taHtml = formatTaLinksHtml(card.taLinks, card.ta);
      return `<article class="startup-source-card">
        <div class="source-line">
          <h3 class="startup-source-card__title">${esc(card.name)}</h3>
          ${exportStatusTag(card.status)}
        </div>
        <dl class="detail-grid">
          <div><dt>Recommended ingest</dt><dd>${esc(card.method)}</dd></div>
          <div><dt>Technology add-ons</dt><dd>${taHtml || '—'}</dd></div>
          <div><dt>Complexity</dt><dd>${esc(card.complexity || 'Medium')}</dd></div>
          <div class="span-all"><dt>Access requirements</dt><dd>${esc(card.permissions || 'Read-only access to logs or APIs for this source.')}</dd></div>
        </dl>
        <div class="validation-block">
          <p class="validation-block__label">Validation search${card.validationIsExample ? ' <span class="text-badge">adjust index names</span>' : ''}</p>
          <pre class="spl-block">${esc(card.validationSpl)}</pre>
          ${card.validationExpected ? `<p class="text-tiny text-secondary"><strong>Expected:</strong> ${esc(card.validationExpected)}</p>` : ''}
          ${card.validationTroubleshooting ? `<p class="text-tiny text-muted"><strong>If empty:</strong> ${esc(card.validationTroubleshooting)}</p>` : ''}
        </div>
      </article>`;
    })
    .join('');

  const priorityLine =
    data.startupGuide?.weekOneThreePriority?.length > 0
      ? esc(data.startupGuide.weekOneThreePriority.join(', '))
      : 'sources in your selected path';

  return `
<div class="report-preview">
  <header class="card-compact report-header">
    <p class="text-metric-label">${esc(data.customer)}</p>
    <h1 class="text-page-title">Implementation startup guide</h1>
    <p class="text-body text-secondary">Architecture path: <strong>${esc(path.name || data.selectedPath)}</strong></p>
    ${dateStr ? `<p class="text-tiny text-muted">Prepared ${esc(dateStr)}</p>` : ''}
  </header>

  ${renderPathIngestKpiStrip(summary)}

  ${
    prereqHtml
      ? `<section class="card-compact"><h2 class="text-card-header">Before you begin</h2><ul class="bullet-list">${prereqHtml}</ul></section>`
      : ''
  }

  <section class="card-compact">
    <h2 class="text-card-header">${esc(STARTUP_SUMMARY_SECTION_TITLE)}</h2>
    <p class="section-lead">Onboarding priorities for this path. First focus: ${priorityLine}.</p>
    ${summaryHtml || '<p class="text-muted">Complete source configuration to generate a startup summary.</p>'}
  </section>

  <section class="card-compact">
    <h2 class="text-card-header">Source onboarding <span class="text-badge">(${cards.length})</span></h2>
    <p class="section-lead">Each source includes a recommended collection method, Splunk technology add-ons, access requirements, and a validation search to confirm data is flowing.</p>
    <div class="startup-source-list">${sourceCardsHtml || '<p class="text-muted">No onboarding sources in this path.</p>'}</div>
  </section>
</div>`;
}
