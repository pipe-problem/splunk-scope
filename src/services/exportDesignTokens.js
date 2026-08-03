/** Design tokens for customer-facing PDF and PPTX exports. */

export const EXPORT_BRAND = {
  accent: [233, 84, 183],
  accentHex: 'E954B7',
  accent2: [255, 122, 26],
  accent2Hex: 'FF7A1A',
  dark: [20, 20, 24],
  darkHex: '141418',
  text: [40, 40, 48],
  textHex: '282830',
  muted: [100, 100, 110],
  mutedHex: '64646E',
  panel: [245, 245, 248],
  panelHex: 'F5F5F8',
  success: [34, 197, 94],
  successHex: '22C55E',
  warning: [245, 158, 11],
  warningHex: 'F59E0B',
  white: [255, 255, 255],
};

export const PDF_LAYOUT = {
  pageWidth: 215.9,
  pageHeight: 279.4,
  marginLeft: 12,
  marginRight: 12,
  contentWidth: 191.9,
  headerHeight: 24,
  coverStripHeight: 10,
  footerY: 272,
  bodyStartY: 30,
  coverBodyStartY: 14,
  maxBodyY: 260,
  sectionGap: 2.5,
  blockGap: 1,
};

export const PDF_FONTS = {
  title: 15,
  section: 12,
  body: 10,
  small: 8,
  kpiValue: 13,
  kpiLabel: 8,
};

export const PPTX_THEME = {
  accent: 'E954B7',
  dark: '141418',
  text: '333333',
  muted: '666666',
  panel: 'F5F5F8',
  success: '22C55E',
};

export const DEPLOYMENT_LABELS = {
  cloud: 'Splunk Cloud Platform',
  onprem: 'Customer-managed Splunk Enterprise',
  hybrid: 'Hybrid (Splunk Cloud + on-premises collection)',
};

/** CAST dark theme for standalone HTML deliverables — matches index.css dark tokens. */
export const CAST_DARK = {
  bg: '#050505',
  panel: '#111111',
  panelAlt: '#1A1A1A',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  text: '#FFFFFF',
  textSecondary: '#C7C7C7',
  textMuted: '#A3A3A3',
  accent: '#F04E98',
  accent2: '#FF7A1A',
  accentEnd: '#FFD84D',
  accentGradient: 'linear-gradient(90deg, #F04E98 0%, #FF7A1A 55%, #FFD84D 100%)',
  accentMuted: 'rgba(240, 78, 152, 0.14)',
  info: '#4A90E2',
  warning: '#F5A623',
  success: '#65A637',
};

/**
 * Inline CSS for standalone export HTML — dark theme, no external deps.
 * @returns {string}
 */
export function buildStandaloneExportCss() {
  const c = CAST_DARK;
  return `
:root {
  color-scheme: dark;
  --bg: ${c.bg};
  --panel: ${c.panel};
  --panel-alt: ${c.panelAlt};
  --border: ${c.border};
  --border-strong: ${c.borderStrong};
  --text: ${c.text};
  --text-secondary: ${c.textSecondary};
  --text-muted: ${c.textMuted};
  --accent: ${c.accent};
  --accent-2: ${c.accent2};
  --accent-gradient: ${c.accentGradient};
  --accent-muted: ${c.accentMuted};
  --info: ${c.info};
  --warning: ${c.warning};
  --success: ${c.success};
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  font-size: 1.0625rem;
}
.wrap { max-width: 56rem; margin: 0 auto; padding: 1.5rem 1.25rem 2.5rem; }
.report-preview { display: flex; flex-direction: column; gap: 1rem; }
.gradient-line {
  height: 3px;
  background: var(--accent-gradient);
  border-radius: 999px;
}
.card-compact {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem 1.1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.card-warning { border-color: color-mix(in srgb, var(--warning) 35%, var(--border)); }
.card-info { border-color: color-mix(in srgb, var(--info) 35%, var(--border)); }
.section-lead { font-size: 0.9375rem; line-height: 1.55; color: var(--text-secondary); margin: 0 0 0.75rem; }
.report-header { margin-bottom: 0; }
.partial-apps { margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid var(--border); }
.ingest-kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.65rem; margin-top: 0.65rem; }
.ingest-kpi-cell { border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.65rem 0.5rem; text-align: center; background: var(--panel-alt); }
.ingest-kpi-cell--expected { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); background: var(--accent-muted); }
.ingest-kpi-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: 0 0 0.25rem; }
.ingest-kpi-val { font-size: 1.125rem; font-weight: 800; font-variant-numeric: tabular-nums; margin: 0; line-height: 1.2; }
.ingest-kpi-val--expected { background: var(--accent-gradient); -webkit-background-clip: text; background-clip: text; color: transparent; }
.ingest-kpi-val--info { color: var(--info); }
.ingest-kpi-val--warning { color: var(--warning); }
.ingest-kpi-unit { font-size: 0.65rem; color: var(--text-muted); margin: 0.15rem 0 0; }
.ingest-kpi-foot { font-size: 0.8125rem; color: var(--text-muted); margin: 0.65rem 0 0; line-height: 1.45; }
.text-page-title { font-size: 1.5rem; font-weight: 700; margin: 0.25rem 0 0.5rem; letter-spacing: -0.02em; }
.text-card-header { font-size: 1rem; font-weight: 600; margin: 0 0 0.65rem; }
.text-metric-label { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: 0; }
.text-body { font-size: 1.0625rem; line-height: 1.55; margin: 0; }
.text-secondary { color: var(--text-secondary); }
.text-muted { color: var(--text-muted); }
.text-tiny { font-size: 0.8125rem; line-height: 1.45; }
.text-badge { font-size: 0.875rem; color: var(--text-muted); font-weight: 500; }
.text-center { text-align: center; }
.kpi-accent { font-size: 1.5rem; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--accent); margin: 0.15rem 0 0; }
.kpi-accent--path { font-size: 1.1rem; font-weight: 700; }
.grid-2 { display: grid; grid-template-columns: 1fr; gap: 1rem; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
.span-2 { grid-column: span 2; }
.span-all { grid-column: 1 / -1; }
.mt-3 { margin-top: 0.75rem; }
@media (min-width: 768px) { .grid-2 { grid-template-columns: 1fr 1fr; } }
.ingest-hero { text-align: center; }
.hero-metric-value {
  font-size: 2.5rem; font-weight: 900; font-variant-numeric: tabular-nums; line-height: 1; margin: 0.35rem 0 0;
  background: var(--accent-gradient); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.hero-metric-unit { font-size: 0.75rem; color: var(--text-muted); margin: 0.25rem 0 0; }
.range-caption { font-size: 0.8rem; color: var(--text-muted); margin: 0.75rem 0; }
.range-bar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 0.5rem; }
.range-bar-cell { border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.55rem; background: var(--panel-alt); }
.range-bar-cell--expected { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); background: var(--accent-muted); }
.range-bar-val { font-size: 1.1rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.range-bar-val--expected { background: var(--accent-gradient); -webkit-background-clip: text; background-clip: text; color: transparent; }
.range-bar-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-top: 0.15rem; }
.kpi-val--info { color: var(--info); }
.kpi-val--warning { color: var(--warning); }
.bullet-list, .link-list, .clean { margin: 0; padding-left: 1.1rem; color: var(--text-secondary); }
.bullet-list li, .clean li { margin: 0.35rem 0; }
.link-list { list-style: none; padding-left: 0; }
.link-list li { margin: 0.4rem 0; }
.source-table { list-style: none; padding: 0; margin: 0; }
.source-line { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; padding: 0.55rem 0; border-bottom: 1px solid var(--border); }
.source-line:last-child { border-bottom: none; }
.source-line__name { color: var(--text-secondary); }
.source-line__ingest { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--success); font-variant-numeric: tabular-nums; }
.tag { display: inline-block; font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 999px; border: 1px solid var(--border); color: var(--text-muted); }
.tag--included { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); color: var(--accent); background: var(--accent-muted); }
a, .app-link { color: var(--accent); text-decoration: none; font-weight: 600; }
a:hover { text-decoration: underline; }
.week-accordion { border: 1px solid var(--border); border-radius: 0.75rem; margin-top: 0.65rem; background: var(--panel-alt); overflow: hidden; }
.week-accordion summary { cursor: pointer; padding: 0.75rem 1rem; font-weight: 600; list-style: none; color: var(--accent); }
.week-accordion summary::-webkit-details-marker { display: none; }
.week-accordion-body { padding: 0.75rem 1rem 1rem; border-top: 1px solid var(--border); }
.startup-source-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.75rem; }
.startup-source-card { border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.9rem 1rem; background: var(--bg); }
.startup-source-card__title { font-size: 1rem; margin: 0; font-weight: 600; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem 1rem; margin: 0.75rem 0; }
.detail-grid dt { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin: 0 0 0.15rem; }
.detail-grid dd { margin: 0; color: var(--text-secondary); font-size: 0.9375rem; }
.validation-block { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); }
.validation-block__label { font-size: 0.8125rem; font-weight: 600; margin: 0 0 0.35rem; color: var(--text); }
.spl-block {
  margin: 0 0 0.5rem; padding: 0.75rem; border-radius: 0.5rem; background: #0a0a0a;
  border: 1px solid var(--border); color: #d4f4dd; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8125rem; line-height: 1.45; white-space: pre-wrap; overflow-x: auto;
}
.footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--text-muted); }
.footer__line { margin: 0.25rem 0; line-height: 1.5; }
.footer__muted { opacity: 0.85; margin-top: 0.5rem; }
.doc-brand {
  display: flex; align-items: center; gap: 0.85rem; margin-bottom: 1.25rem;
  padding: 0.85rem 1rem; border: 1px solid var(--border); border-radius: 0.75rem;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 6%, var(--panel)), var(--panel-alt));
}
.doc-brand__logo { flex-shrink: 0; }
.doc-brand__text { min-width: 0; }
.doc-brand__product {
  margin: 0; font-size: 1.125rem; font-weight: 800; letter-spacing: -0.02em;
  background: var(--accent-gradient); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.doc-brand__doc { margin: 0.1rem 0 0; font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.08em; }
.doc-brand__org { margin: 0.2rem 0 0; font-size: 0.875rem; color: var(--text-muted); }
.exec-summary {
  margin: 0; font-size: 1.0625rem; line-height: 1.6; color: var(--text-secondary);
  border-left: 3px solid var(--accent); padding-left: 0.85rem;
}
.internal-banner {
  background: color-mix(in srgb, var(--warning) 12%, var(--panel));
  border: 1px solid color-mix(in srgb, var(--warning) 35%, var(--border));
  border-radius: 0.75rem; padding: 0.65rem 0.85rem; margin-bottom: 1rem; font-size: 0.8rem; color: var(--text-secondary);
}
h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem; }
h2 { font-size: 1rem; font-weight: 600; margin: 1.25rem 0 0.65rem; }
h3 { font-size: 0.875rem; font-weight: 600; margin: 0 0 0.35rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.meta { color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1rem; }
.card { background: var(--panel); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem; margin-bottom: 0.75rem; }
.kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.65rem; margin: 0.75rem 0; }
.kpi { border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.65rem; text-align: center; background: var(--panel-alt); }
.kpi-val { font-size: 1.25rem; font-weight: 800; color: var(--accent); }
.kpi-label { font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); }
.source-row { display: flex; justify-content: space-between; gap: 0.75rem; padding: 0.35rem 0; border-bottom: 1px solid var(--border); font-size: 0.875rem; }
.source-row:last-child { border-bottom: none; }
.mono { font-family: ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }
ul.clean { margin: 0; padding-left: 1.1rem; color: var(--text-secondary); }
`.trim();
}
