/**
 * Shared HTML document shell for export deliverables.
 * Visual tokens: exportDesignTokens.js (CAST_DARK) — keep in sync with index.css dark theme.
 * Body layouts: exportHtmlSiteRenderer.js — keep in sync with ReportDeliverablePreview.jsx.
 */

import { buildStandaloneExportCss } from './exportDesignTokens.js';
import { formatDisplayDate } from './exportShared.js';

export const PROPOSITION_PACK = {
  readme: 'README.txt',
  valueProposition: 'value-proposition.html',
  startupGuide: 'startup-guide.html',
};

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline Scope logo mark — matches ScopeLogo.jsx */
export function buildScopeLogoSvgHtml(size = 28, gradientId = 'export-logo-grad') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" class="doc-brand__logo">
  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E954B7"/>
      <stop offset="55%" stop-color="#FF7A1A"/>
      <stop offset="100%" stop-color="#FFD84D"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="#1A1A1A"/>
  <circle cx="16" cy="15" r="8" fill="none" stroke="url(#${gradientId})" stroke-width="2"/>
  <circle cx="16" cy="15" r="2.5" fill="url(#${gradientId})"/>
  <line x1="22" y1="21" x2="27" y2="26" stroke="url(#${gradientId})" stroke-width="2" stroke-linecap="round"/>
</svg>`;
}

/**
 * @param {string} organizationName
 * @param {string} documentLabel - e.g. "Value proposition"
 */
export function buildExportDocumentBrandBar(organizationName, documentLabel) {
  return `<div class="doc-brand">
  ${buildScopeLogoSvgHtml(32, 'export-shell-grad')}
  <div class="doc-brand__text">
    <p class="doc-brand__product">Splunk Scope</p>
    <p class="doc-brand__doc">${esc(documentLabel)}</p>
    <p class="doc-brand__org">${esc(organizationName)}</p>
  </div>
</div>`;
}

/**
 * Full standalone HTML page for export deliverables.
 * @param {{ organizationName: string, pageTitle: string, documentLabel: string, bodyHtml: string, generatedAt?: string }} opts
 */
export function wrapExportDocument({ organizationName, pageTitle, documentLabel, bodyHtml, generatedAt }) {
  const dateStr = generatedAt ? formatDisplayDate(generatedAt) : '';
  const org = organizationName?.trim() || 'Your organization';
  const footerOrg = esc(org);

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${buildStandaloneExportCss()}</style>
</head>
<body>
<div class="wrap">
${buildExportDocumentBrandBar(org, documentLabel)}
${bodyHtml}
<footer class="footer">
  <p class="footer__line">Prepared for <strong>${footerOrg}</strong>${dateStr ? ` · ${esc(dateStr)}` : ''}</p>
  <p class="footer__line">Planning estimate only — validate ingest and licensing in your environment before purchase.</p>
  <p class="footer__line footer__muted">Splunk Scope · Planning &amp; Architecture</p>
</footer>
</div>
</body>
</html>`;
}
