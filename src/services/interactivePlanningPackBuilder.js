/**
 * Build standalone interactive customer planning pack HTML.
 * SSR of CustomerPlanningPackView — matches live Report page UX exactly.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CustomerPlanningPackView from '../components/report/CustomerPlanningPackView.jsx';
import customerPlanningPackCss from '../styles/customerPlanningPack.css?inline';
import { safeExportFilename, formatDisplayDate } from './exportShared.js';

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const INTERACTIVE_SCRIPT = `
(function(){
  document.querySelectorAll('[data-pack-tab]').forEach(function(tab){
    tab.addEventListener('click', function(){
      var key = tab.getAttribute('data-pack-tab');
      document.querySelectorAll('[data-pack-tab]').forEach(function(t){ t.classList.remove('active'); });
      document.querySelectorAll('[data-pack-panel]').forEach(function(panel){
        var match = panel.getAttribute('data-pack-panel') === key;
        if(match){
          panel.classList.remove('report-section-inactive');
        } else {
          panel.classList.add('report-section-inactive');
        }
      });
      tab.classList.add('active');
    });
  });
  document.querySelectorAll('.pack-source-row').forEach(function(row){
    row.addEventListener('click', function(){ row.classList.toggle('expanded'); });
  });
  var viewAll = document.getElementById('pack-view-all-products');
  if(viewAll){
    viewAll.addEventListener('click', function(){
      var list = document.getElementById('pack-products-list');
      if(list) list.classList.remove('pack-products-collapsed');
      viewAll.style.display = 'none';
    });
  }
})();
`;

/**
 * @param {object} data - sanitized customer report data
 * @returns {{ html: string, filename: string }}
 */
export function buildInteractivePlanningPackHtml(data) {
  const dateStr = formatDisplayDate(data.generatedAt);
  const slug = safeExportFilename(data.customer);
  const filename = `${slug}_splunk_scoping_package.html`;

  const bodyMarkup = renderToStaticMarkup(
    createElement(CustomerPlanningPackView, { data, activeTab: 'overview' }),
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.reportTitle)} — ${esc(data.customer)}</title>
<style>${customerPlanningPackCss}</style>
</head>
<body>
${bodyMarkup}
<footer class="pack-footer">
  <p class="text-card-header">Planning estimate disclaimer</p>
  <p class="text-label">${esc(data.assumptions)}</p>
  <p class="text-badge text-[var(--cast-text-muted)] mt-2">Generated ${esc(dateStr)}</p>
</footer>
<script>${INTERACTIVE_SCRIPT}</script>
</body>
</html>`;

  return { html, filename };
}

export function downloadInteractivePlanningPack(data) {
  const { html, filename } = buildInteractivePlanningPackHtml(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}
