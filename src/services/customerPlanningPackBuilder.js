/**
 * Unified Customer Planning Pack — merges Overview, Sources, and Startup Guide for email delivery.
 */
import { buildValueProposalDocument } from './valueProposalExportBuilder.js';
import { buildStartupGuideDocument } from './startupGuideExportBuilder.js';
import {
  sanitizeCustomerFacingText,
  formatIngestRangeWithUnit,
  formatDisplayDate,
} from './exportShared.js';
import { formatIngestPromoPlain } from '../utils/formatIngestDisplay.js';

function buildProductRecommendationsPage(payload) {
  const rec = payload.productRecommendations;
  if (!rec) return null;
  const solutions = (rec.recommendedSolutions || []).slice(0, 6);
  const addons = (rec.technicalAddons || []).slice(0, 4);
  const deps = (rec.dependencies || []).slice(0, 3);
  if (!solutions.length && !addons.length) return null;

  const blocks = [
    { type: 'heading', text: 'Recommended Splunk products' },
    {
      type: 'paragraph',
      text: 'Aligned to selected use cases, deployment model, and configured sources. Validate licensing with your account team.',
      small: true,
    },
  ];
  if (solutions.length) {
    blocks.push({ type: 'subheading', text: 'Premium solutions' });
    blocks.push({
      type: 'bullets',
      items: solutions.map(
        (r) => `${r.name}${r.phase ? ` (${r.phase})` : ''} — ${sanitizeCustomerFacingText(r.reason || '')}`,
      ),
    });
  }
  if (addons.length) {
    blocks.push({ type: 'subheading', text: 'Technical add-ons' });
    blocks.push({
      type: 'bullets',
      items: addons.map((r) => `${r.name} — ${sanitizeCustomerFacingText(r.reason || '')}`),
    });
  }
  if (deps.length) {
    blocks.push({ type: 'subheading', text: 'Dependencies & readiness' });
    blocks.push({
      type: 'bullets',
      items: deps.map((r) => `${r.name} — ${sanitizeCustomerFacingText(r.reason || '')}`),
    });
  }
  return { id: 'product_recommendations', title: 'Product Recommendations', blocks };
}

function mapSourceDetailRow(row) {
  const expected = row.ingest?.expected ?? row.ingestRange?.expected ?? 0;
  const low = row.ingest?.low ?? row.ingestRange?.low ?? expected;
  const high = row.ingest?.high ?? row.ingestRange?.high ?? expected;
  const summary =
    sanitizeCustomerFacingText(row.whyIncluded || row.valueProp?.summary || row.valueSummary || '') ||
    'Supports selected use cases and architecture path.';
  return {
    name: row.name,
    category: row.category || 'Uncategorized',
    status: String(row.status || 'unknown').replace(/_/g, ' '),
    gbDay: formatIngestRangeWithUnit(low, expected, high),
    confidence: row.ingest?.confidence || row.confidence || 'medium',
    valueSummary: summary.slice(0, 200),
    needsReview: Boolean(row.needsReview),
  };
}

export function buildSourcesDetailPages(payload) {
  const pages = [];
  const sorted = [...(payload.sourceRows || [])].sort(
    (a, b) => (b.ingest?.expected ?? b.ingestRange?.expected ?? 0) - (a.ingest?.expected ?? a.ingestRange?.expected ?? 0),
  );
  const mixRows = sorted
    .filter((r) => (r.ingest?.expected ?? r.ingestRange?.expected ?? 0) > 0)
    .slice(0, 10)
    .map((r) => ({
      name: r.name,
    gbDay: formatIngestPromoPlain(
      r.ingest?.expected ?? r.ingestRange?.expected ?? 0,
      r.ingest?.grossExpected,
      r.ingest?.ciscoPromoApplied,
    ),
      category: r.category || 'Uncategorized',
    }));

  pages.push({
    id: 'sources_ingest_mix',
    title: 'Ingest Mix',
    blocks: [
      { type: 'heading', text: 'Configured sources — ingest mix' },
      {
        type: 'paragraph',
        text: `${payload.sourceCount ?? 0} source(s) in the selected path. Top contributors by expected GB/day (20% planning contingency per source).`,
        small: true,
      },
      ...(mixRows.length
        ? [{ type: 'ingest_mix_table', rows: mixRows }]
        : [{ type: 'paragraph', text: 'No non-zero ingest estimates in the selected path.', small: true }]),
    ],
  });

  for (const [category, rows] of payload.sourceRowsByCategory || []) {
    pages.push({
      id: `sources_${category.replace(/\W+/g, '_').toLowerCase()}`,
      title: category,
      blocks: [
        { type: 'subheading', text: category },
        {
          type: 'sources_detail_table',
          rows: rows.map(mapSourceDetailRow),
        },
      ],
    });
  }

  if (!pages.length) {
    pages.push({
      id: 'sources_empty',
      title: 'Sources',
      blocks: [{ type: 'paragraph', text: 'No configured sources in the selected path.' }],
    });
  }
  return pages;
}

/**
 * @param {object} payload — from buildReportExportPayload
 */
export function buildCustomerPlanningPackDocument(payload) {
  const vpDoc = payload.valueProposalDocument || buildValueProposalDocument(payload);
  const sgDoc = payload.startupGuideDocument || buildStartupGuideDocument(payload);
  const sourcesPages = buildSourcesDetailPages(payload);
  const productPage = buildProductRecommendationsPage(payload);

  const coverPage = vpDoc.pages?.find((p) => p.id === 'cover');
  if (coverPage) {
    for (const block of coverPage.blocks || []) {
      if (block.type === 'cover') {
        block.documentTitle = 'Customer Planning Pack';
      }
    }
  }

  const vpBody = (vpDoc.pages || []).filter((p) => p.id !== 'cover');
  const sgDisclaimer = sgDoc.pages?.find((p) => p.id === 'disclaimer');
  const sgBody = (sgDoc.pages || []).filter((p) => p.id !== 'disclaimer');

  const partSourcesDivider = {
    id: 'part_sources_divider',
    blocks: [
      {
        type: 'part_divider',
        text: 'Part 2 — Configured Sources',
        subtitle: 'Per-source sizing, confidence, and value summary for the selected architecture path.',
      },
    ],
  };

  const partStartupDivider = {
    id: 'part_startup_divider',
    blocks: [
      {
        type: 'part_divider',
        text: 'Part 3 — Implementation Startup Guide',
        subtitle: 'Year-one cadence, technical setup, onboarding order, and validation searches.',
      },
    ],
  };

  const pages = [
    coverPage,
    ...vpBody,
    ...(productPage ? [productPage] : []),
    partSourcesDivider,
    ...sourcesPages,
    partStartupDivider,
    ...sgBody,
    sgDisclaimer,
  ].filter(Boolean);

  return {
    documentType: 'customer_planning_pack',
    customerName: payload.customerName,
    generatedAt: payload.generatedAt,
    documentTitle: 'Customer Planning Pack',
    preparedBy: 'Cisco | Splunk Scope',
    date: formatDisplayDate(payload.generatedAt),
    deployment: payload.deploymentLabel,
    pathName: payload.pathDisplayLabel || payload.selectedPlan?.displayLabel || payload.selectedPlan?.name,
    pages,
    meta: {
      pathName: payload.pathDisplayLabel,
      sourceCount: payload.sourceCount,
      sectionIds: ['cover', 'overview', 'sources', 'startup'],
      pageIds: pages.map((p) => p.id).filter(Boolean),
      includesValueProposal: true,
      includesSourcesDetail: sourcesPages.length > 0,
      includesStartupGuide: sgBody.length > 0,
    },
  };
}
