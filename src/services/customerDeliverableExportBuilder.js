/**
 * Standalone HTML deliverables + zip export for Splunk Scope proposition pack.
 * HTML bodies: exportHtmlSiteRenderer.js (mirrors ReportDeliverablePreview.jsx).
 * Document shell: exportDocumentShell.js (mirrors app chrome + CAST dark theme).
 */

import JSZip from 'jszip';
import { formatIngestGb, formatIngestWithUnit, formatDisplayDate, safeExportFilename, propositionZipFilename } from './exportShared.js';
import {
  renderCustomerValuePropositionBody,
  renderStartupGuideBody,
} from './exportHtmlSiteRenderer.js';
import {
  PROPOSITION_PACK,
  wrapExportDocument,
} from './exportDocumentShell.js';

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function organizationName(data) {
  return String(data?.customer || '').trim();
}

function wrapValuePropositionHtml(data) {
  const org = organizationName(data);
  return wrapExportDocument({
    organizationName: org,
    pageTitle: `${org} — Splunk Value Proposition`,
    documentLabel: 'Value proposition',
    bodyHtml: renderCustomerValuePropositionBody(data),
    generatedAt: data.generatedAt,
  });
}

function wrapStartupGuideHtml(data) {
  const org = organizationName(data);
  return wrapExportDocument({
    organizationName: org,
    pageTitle: `${org} — Splunk Startup Guide`,
    documentLabel: 'Startup guide',
    bodyHtml: renderStartupGuideBody(data),
    generatedAt: data.generatedAt,
  });
}

/**
 * Plain-language README for non-technical recipients.
 * @param {object} data - sanitized report data
 */
export function buildPropositionReadmeTxt(data) {
  const org = organizationName(data) || 'your organization';
  const dateStr = data.generatedAt ? formatDisplayDate(data.generatedAt) : '';
  const pathName = data.pathDetail?.name || data.selectedPath || 'your selected architecture path';

  return `SPLUNK SCOPE PLANNING PACK
Prepared for: ${org}
${dateStr ? `Date: ${dateStr}\n` : ''}Recommended path: ${pathName}

================================================================================
WHAT IS IN THIS FOLDER
================================================================================

This zip contains two interactive HTML reports and this instruction file:

  1. value-proposition.html
     Your Splunk sizing summary — recommended architecture path, ingest
     estimates, Splunk apps powered, and the data sources included in the plan.

  2. startup-guide.html
     A startup summary with collection methods, technology add-ons, access
     requirements, and validation searches for each source.

================================================================================
HOW TO OPEN THE HTML REPORTS IN GOOGLE CHROME
================================================================================

On a Mac:
  1. Unzip this folder if your computer has not already done so (double-click
     the zip file).
  2. Double-click "value-proposition.html" or "startup-guide.html".
  3. If the file opens as plain text or code instead of a formatted report,
     close it, right-click the file, choose Open With, and select Google Chrome.
  4. You can also drag the HTML file into an open Chrome window.

On Windows:
  1. Right-click the zip file and choose Extract All.
  2. Open the extracted folder.
  3. Right-click "value-proposition.html" and choose Open with → Google Chrome.
     If Chrome is not listed, choose "Choose another app" and select Chrome.

Safari and Microsoft Edge also work if Chrome is not installed — the reports
are designed for modern browsers.

================================================================================
SAVE AS PDF (OPTIONAL)
================================================================================

With a report open in Chrome:
  File → Print → Destination: Save as PDF → Save

================================================================================
QUESTIONS?
================================================================================

Contact your Splunk account team.
`.trim();
}

/**
 * Executive value proposition HTML — mirrors in-app Report preview.
 * @param {object} data - sanitized report data
 */
export function buildCustomerValuePropositionHtml(data) {
  return wrapValuePropositionHtml(data);
}

/**
 * Implementation startup guide HTML.
 * @param {object} data - sanitized report data
 */
export function buildStartupGuideHtml(data) {
  return wrapStartupGuideHtml(data);
}

/**
 * Files for the proposition pack zip (README + two HTML reports).
 * @param {object} sanitizedData
 */
export function buildSplunkPropositionPackFiles(sanitizedData) {
  return {
    [PROPOSITION_PACK.readme]: buildPropositionReadmeTxt(sanitizedData),
    [PROPOSITION_PACK.valueProposition]: buildCustomerValuePropositionHtml(sanitizedData),
    [PROPOSITION_PACK.startupGuide]: buildStartupGuideHtml(sanitizedData),
  };
}

/** @deprecated use buildSplunkPropositionPackFiles */
export const buildCustomerEmailPackFiles = buildSplunkPropositionPackFiles;

/** @deprecated use buildPropositionReadmeTxt */
export const buildDeliverableReadmeTxt = buildPropositionReadmeTxt;

/**
 * Internal SE sales summary — not included in the proposition pack zip.
 * @param {object} rawData
 */
export function buildSeSalesSummaryHtml(rawData) {
  const internal = rawData.internalSalesSummary || {};
  const path = rawData.pathDetail || {};
  const dateStr = formatDisplayDate(rawData.generatedAt);
  const org = organizationName(rawData);

  const goalsHtml = (internal.goals || []).map((g) => `<li>${esc(g)}</li>`).join('');
  const sourcesHtml = (internal.configuredSources || [])
    .map(
      (s) =>
        `<div class="source-row"><span>${esc(s.name)}</span><span class="mono">${esc(formatIngestGb(s.ingestExpected))} GB/day</span></div>`,
    )
    .join('');
  const overlapsHtml = (internal.overlaps || [])
    .map((o) => `<li>${esc(o)}</li>`)
    .join('') || '<li>None flagged for configured sources.</li>';
  const missingHtml = (internal.missingPriorities || [])
    .map(
      (m) =>
        `<li><strong>${esc(m.name)}</strong>${m.appLabels?.length ? ` — apps: ${esc(m.appLabels.join(', '))}` : ''}${m.rationale ? `<br><span class="meta">${esc(m.rationale)}</span>` : ''}</li>`,
    )
    .join('') || '<li>All analysis priorities are configured.</li>';
  const talkHtml = (internal.talkTracks || [])
    .map((t) => `<div class="card"><h3>${esc(t.label)}</h3><p>${esc(t.text)}</p></div>`)
    .join('');

  const budgetLine =
    internal.budgetUsd != null && internal.budgetUsd !== ''
      ? `Opportunity budget: $${esc(String(internal.budgetUsd))}`
      : '';
  const budgetGb =
    internal.budgetGbDay != null
      ? `Ingest budget target: ${esc(formatIngestWithUnit(internal.budgetGbDay))}`
      : '';

  const body = `
<div class="internal-banner"><strong>Internal — Splunk sales / SE use only.</strong> Do not send this file to the recipient organization.</div>
<h1>SE Sales Summary</h1>
<p class="meta">${esc(org)} · ${esc(dateStr)} · Path: ${esc(path.name || internal.selectedPath || '—')}</p>
<h2>Goals</h2>
<ul class="clean">${goalsHtml}</ul>
<h2>Budget context</h2>
<div class="card">
  ${budgetLine ? `<p>${budgetLine}</p>` : ''}
  ${budgetGb ? `<p>${budgetGb}</p>` : ''}
  ${!budgetLine && !budgetGb ? '<p class="meta">No budget entered in intake.</p>' : ''}
</div>
<h2>Selected path ingest</h2>
${ingestBandHtml(path.ingestSummary || rawData.ingestSummary)}
<h2>Configured sources (${esc(String(internal.configuredSourceCount || 0))})</h2>
<div class="card">${sourcesHtml || '<p class="meta">No configured sources in path.</p>'}</div>
<h2>Overlap notes</h2>
<ul class="clean">${overlapsHtml}</ul>
<h2>Missing analysis priorities</h2>
<ul class="clean">${missingHtml}</ul>
<h2>Talk tracks</h2>
${talkHtml || '<p class="meta">Select a path to generate talk tracks.</p>'}`;

  return wrapExportDocument({
    organizationName: org,
    pageTitle: `SE Sales Summary — ${org}`,
    documentLabel: 'Internal sales summary',
    bodyHtml: body,
    generatedAt: rawData.generatedAt,
  });
}

function ingestBandHtml(summary) {
  const low = formatIngestGb(summary?.low);
  const expected = formatIngestGb(summary?.expected);
  const high = formatIngestGb(summary?.high);
  return `<div class="kpi-row">
  <div class="kpi"><div class="kpi-val kpi-val--info">${esc(low)}</div><div class="kpi-label">Low GB/day</div></div>
  <div class="kpi"><div class="kpi-val">${esc(expected)}</div><div class="kpi-label">Expected GB/day</div></div>
  <div class="kpi"><div class="kpi-val kpi-val--warning">${esc(high)}</div><div class="kpi-label">High GB/day</div></div>
</div>`;
}

/**
 * @param {object} rawData
 * @param {object} sanitizedData
 */
export function buildCustomerDeliverableZipFiles(rawData, sanitizedData) {
  return {
    'se-sales-summary.html': buildSeSalesSummaryHtml(rawData),
    ...buildSplunkPropositionPackFiles(sanitizedData),
  };
}

async function downloadZipFromFiles(files, filename) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return filename;
}

/**
 * Primary export — one zip: README + value proposition + startup guide.
 * @param {object} sanitizedData
 * @returns {Promise<string>} filename
 */
export async function downloadSplunkPropositionPack(sanitizedData) {
  const files = buildSplunkPropositionPackFiles(sanitizedData);
  return downloadZipFromFiles(files, propositionZipFilename(sanitizedData.customer));
}

/** @deprecated use downloadSplunkPropositionPack */
export async function downloadCustomerReportPack(sanitizedData) {
  return downloadSplunkPropositionPack(sanitizedData);
}

/**
 * Full SE deliverable zip (internal summary + proposition pack).
 * @param {object} rawData
 * @param {object} sanitizedData
 */
export async function downloadCustomerDeliverableZip(rawData, sanitizedData) {
  const slug = safeExportFilename(sanitizedData.customer);
  const files = buildCustomerDeliverableZipFiles(rawData, sanitizedData);
  return downloadZipFromFiles(files, `${slug}_splunk_deliverables.zip`);
}

/** Simple stable hash for HTML structure snapshots in tests. */
export function hashExportStructure(html) {
  const normalized = String(html)
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'TIMESTAMP')
    .replace(/\s+/g, ' ')
    .trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}
