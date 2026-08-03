import { getSuggestedDeploymentPath } from '../utils/suggestedDeploymentPath.js';
import sizingRates from '../data/sizingRates.json' with { type: 'json' };

/**
 * Customer-facing plain-text brief for a single data source (downloadable from Source Library).
 * Excludes SE-only guidance: discovery questions, confidence scores, internal notes.
 */
export function buildSourceBriefText(source, useCases, currentCoverage, sourceStates, allSources) {
  void useCases;
  void currentCoverage;
  void allSources;
  const rate = sizingRates.rates?.[source.id];
  const path = getSuggestedDeploymentPath(source);
  const lines = [];

  lines.push(`${source.name}`);
  lines.push('='.repeat(Math.min(60, source.name.length + 4)));
  lines.push('');
  lines.push(`Category: ${source.category || '—'}${source.subcategory ? ` · ${source.subcategory}` : ''}`);
  lines.push('');
  lines.push('OVERVIEW');
  lines.push(source.description || source.whyItMatters || '—');
  lines.push('');
  if (source.whyItMatters && source.description) {
    lines.push('VALUE');
    lines.push(source.whyItMatters);
    lines.push('');
  }
  if (source.exampleVendors?.length) {
    lines.push(`Common products: ${source.exampleVendors.join(', ')}`);
    lines.push('');
  }
  if (source.exampleLogs?.length) {
    lines.push('EXAMPLE LOG TYPES');
    for (const log of source.exampleLogs.slice(0, 6)) lines.push(`  • ${log}`);
    lines.push('');
  }
  if (rate) {
    lines.push('PLANNING SIZING ESTIMATE (not a capacity guarantee)');
    lines.push(`  Low: ${rate.low} GB/day per ${rate.unit}`);
    lines.push(`  Typical: ${rate.medium ?? rate.baseRate} GB/day per ${rate.unit}`);
    lines.push(`  High: ${rate.high} GB/day per ${rate.unit}`);
    if (rate.notes) lines.push(`  Notes: ${rate.notes}`);
    lines.push('');
  }
  if (source.collectionMethods?.length) {
    lines.push('TYPICAL COLLECTION METHODS');
    for (const m of source.collectionMethods) lines.push(`  • ${m}`);
    lines.push('');
  }
  if (path.length) {
    lines.push('SPLUNK ONBOARDING REFERENCES');
    path.forEach((step, i) => {
      lines.push(`  ${i + 1}. ${step.label}`);
      if (step.url) {
        lines.push(`     ${step.url}`);
      } else if (step.linkNote) {
        lines.push(`     (${step.linkNote})`);
      }
    });
    lines.push('');
  }
  if (source.splunkApps?.length || source.technicalAddons?.length) {
    lines.push('SPLUNK APPS & ADD-ONS');
    for (const a of source.splunkApps || []) lines.push(`  • ${a}`);
    for (const t of source.technicalAddons || []) lines.push(`  • ${t}`);
    lines.push('');
  }
  if (source.overlapNotes) {
    lines.push('OVERLAP NOTE');
    lines.push(`  ${source.overlapNotes}`);
    lines.push('');
  }
  lines.push('—');
  lines.push('Cisco | Splunk Scope planning brief. Figures are estimates for discovery');
  lines.push('and architecture planning only. Validate ingest, parsing, and licensing in your environment.');
  lines.push(`Generated ${new Date().toISOString().split('T')[0]}`);

  const text = lines.join('\n');
  const banned = /SIZING QUESTION FOR DISCOVERY|confidence score|what to ask|internal guidance|planning budget/i;
  if (banned.test(text)) {
    throw new Error('Customer brief contains internal-only wording');
  }
  return text;
}

export function downloadSourceBrief(source, useCases, currentCoverage, sourceStates, allSources) {
  const text = buildSourceBriefText(source, useCases, currentCoverage, sourceStates, allSources);
  const slug = (source.id || source.name || 'source').replace(/[^\w-]+/g, '_').slice(0, 48);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `splunk-scope-${slug}-brief.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
