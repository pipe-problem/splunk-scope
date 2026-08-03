/**
 * Renders structured export documents (from builders) to customer-facing PDFs.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EXPORT_BRAND, PDF_LAYOUT, PDF_FONTS } from './exportDesignTokens.js';
import { EXPORT_FOOTER } from './exportConstants.js';
import {
  formatBulletList,
  formatNumberedList,
  formatIngestGb,
  safeExportFilename,
  pdfText,
  normalizePdfText,
} from './exportShared.js';

const L = PDF_LAYOUT;
const B = EXPORT_BRAND;

const TABLE_STYLES = {
  styles: {
    fontSize: PDF_FONTS.body,
    cellPadding: 1.4,
    overflow: 'linebreak',
    lineColor: [220, 220, 228],
    lineWidth: 0.1,
    font: 'helvetica',
  },
  headStyles: {
    fillColor: B.dark,
    textColor: [255, 255, 255],
    fontStyle: 'bold',
    fontSize: PDF_FONTS.body,
    font: 'helvetica',
  },
  alternateRowStyles: { fillColor: B.panel },
  margin: { left: L.marginLeft, right: L.marginRight },
  showHead: 'everyPage',
  rowPageBreak: 'avoid',
};

function addHeader(doc, customerName, docTitle) {
  doc.setFillColor(...B.dark);
  doc.rect(0, 0, L.pageWidth, L.headerHeight, 'F');
  doc.setDrawColor(...B.accent);
  doc.setLineWidth(0.5);
  doc.line(L.marginLeft, L.headerHeight, L.pageWidth - L.marginRight, L.headerHeight);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_FONTS.small);
  doc.text(pdfText('Cisco | Splunk Scope'), L.marginLeft, 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(190, 190, 200);
  doc.text(pdfText('Prepared for planning discussion by Cisco/Splunk technical teams'), L.pageWidth - L.marginRight, 7, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_FONTS.body);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfText(customerName || 'Customer'), L.marginLeft, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_FONTS.small);
  doc.text(pdfText(docTitle), L.marginLeft, 19);
}

function addCoverStrip(doc) {
  doc.setFillColor(...B.dark);
  doc.rect(0, 0, L.pageWidth, L.coverStripHeight, 'F');
  doc.setDrawColor(...B.accent);
  doc.setLineWidth(0.5);
  doc.line(L.marginLeft, L.coverStripHeight, L.pageWidth - L.marginRight, L.coverStripHeight);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_FONTS.small);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfText('Cisco | Splunk Scope'), L.marginLeft, 6.5);
}

function addFooter(doc, pageNum, totalPages) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...B.muted);
  doc.text(pdfText(EXPORT_FOOTER), L.marginLeft, L.footerY, { maxWidth: L.contentWidth - 28 });
  doc.text(pdfText(`Page ${pageNum} of ${totalPages}`), L.pageWidth - L.marginRight, L.footerY, { align: 'right' });
}

function newPage(doc, customerName, docTitle) {
  doc.addPage();
  addHeader(doc, customerName, docTitle);
  return L.bodyStartY;
}

function ensureY(doc, y, needed, customerName, docTitle) {
  if (y + needed <= L.maxBodyY) return y;
  return newPage(doc, customerName, docTitle);
}

function drawTextBlock(doc, text, x, y, maxW, fontSize = PDF_FONTS.body, fontStyle = 'normal') {
  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fontSize);
  doc.setTextColor(...B.text);
  const lines = doc.splitTextToSize(pdfText(text), maxW);
  doc.text(lines, x, y);
  return y + lines.length * (fontSize * 0.36) + L.blockGap;
}

function renderKpiRow(doc, block, y, customerName, docTitle) {
  const items = block.items || [];
  const cols = Math.min(items.length, 4);
  const cardW = (L.contentWidth - (cols - 1) * 2) / cols;
  const cardH = 16;
  items.slice(0, cols).forEach((item, i) => {
    const x = L.marginLeft + i * (cardW + 2);
    doc.setFillColor(...B.panel);
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'F');
    doc.setDrawColor(...B.accent);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(PDF_FONTS.kpiLabel);
    doc.setTextColor(...B.muted);
    doc.text(pdfText(item.label), x + 2.5, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(PDF_FONTS.kpiValue);
    doc.setTextColor(...B.text);
    const valLines = doc.splitTextToSize(pdfText(item.value), cardW - 5);
    doc.text(valLines.slice(0, 2), x + 2.5, y + 11);
  });
  return y + cardH + L.sectionGap;
}

function renderCover(doc, block, customerName) {
  let y = L.coverBodyStartY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_FONTS.title);
  doc.setTextColor(...B.text);
  doc.text(pdfText(block.documentTitle || 'Architecture Value Proposal'), L.marginLeft, y);
  y += 7;
  doc.setFontSize(PDF_FONTS.section);
  doc.setTextColor(...B.accent);
  doc.text(pdfText(block.customerName || customerName), L.marginLeft, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_FONTS.body);
  doc.setTextColor(...B.muted);
  doc.text(pdfText(`Prepared by ${block.preparedBy || 'Cisco | Splunk Scope'} - ${block.date || ''}`), L.marginLeft, y);
  y += 4;
  doc.text(pdfText(`Deployment: ${block.deployment || '-'}`), L.marginLeft, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...B.text);
  doc.text(pdfText(`Selected path: ${block.pathName || '-'}`), L.marginLeft, y);
  y += 6;
  y = renderKpiRow(doc, { items: block.kpis || [] }, y);
  if (block.kpiFootnote) {
    y = drawTextBlock(doc, block.kpiFootnote, L.marginLeft, y, L.contentWidth, PDF_FONTS.small);
  }
  return y;
}

function renderPainSolutionPairs(doc, pairs, y, customerName, docTitle) {
  for (const pair of pairs || []) {
    y = ensureY(doc, y, 18, customerName, docTitle);
    doc.setFillColor(...B.panel);
    doc.roundedRect(L.marginLeft, y, L.contentWidth, 17, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(PDF_FONTS.body);
    doc.setTextColor(...B.text);
    const painLines = doc.splitTextToSize(pdfText(`Challenge: ${pair.pain}`), L.contentWidth - 6);
    doc.text(painLines.slice(0, 2), L.marginLeft + 3, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...B.muted);
    const solLines = doc.splitTextToSize(pdfText(`Splunk: ${pair.solution}`), L.contentWidth - 6);
    doc.text(solLines.slice(0, 2), L.marginLeft + 3, y + 10);
    y += 18;
  }
  return y + L.blockGap;
}

function renderPathsTable(doc, block, y, customerName, docTitle) {
  const rows = block.rows || [];
  if (!rows.length) return y;
  y = ensureY(doc, y, 22, customerName, docTitle);
  autoTable(doc, {
    startY: y,
    head: [[pdfText('Path'), pdfText('Expected GB/day'), pdfText('Sources'), pdfText('Coverage')]],
    body: rows.map((r) => {
      const short = r.shortName || r.name;
      const label = r.selected ? `${short} (selected)` : short;
      return [
        pdfText(label),
        pdfText(formatIngestGb(r.expectedGb)),
        pdfText(String(r.sourceCount ?? 0)),
        pdfText(`${r.coverage ?? 0}%`),
      ];
    }),
    ...TABLE_STYLES,
    columnStyles: {
      0: { cellWidth: 45 },
      1: { halign: 'right', cellWidth: 36 },
      2: { halign: 'right', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 22 },
    },
    didParseCell(data) {
      if (data.section === 'body' && rows[data.row.index]?.selected) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [255, 240, 250];
      }
      if (data.cell.text != null) {
        data.cell.text = Array.isArray(data.cell.text)
          ? data.cell.text.map((t) => normalizePdfText(String(t)))
          : normalizePdfText(String(data.cell.text));
      }
    },
  });
  let finalY = (doc.lastAutoTable?.finalY || y) + L.blockGap;
  const footnotes = block.pathFootnotes?.length
    ? block.pathFootnotes
    : rows.filter((r) => r.fullName && r.fullName !== (r.shortName || r.name)).map((r) => `${r.shortName || r.name}: ${r.fullName}`);
  if (footnotes.length) {
    finalY = drawTextBlock(doc, footnotes.join('  |  '), L.marginLeft, finalY, L.contentWidth, PDF_FONTS.small);
  }
  return finalY + L.sectionGap;
}

function renderSourcesTable(doc, block, y, customerName, docTitle) {
  const rows = block.rows || [];
  if (!rows.length) return y;
  y = ensureY(doc, y, 18, customerName, docTitle);
  autoTable(doc, {
    startY: y,
    head: [[pdfText('Source'), pdfText('Category'), pdfText('Expected GB/day')]],
    body: rows.map((r) => [
      pdfText(r.needsReview ? `${r.name} *` : r.name),
      pdfText(r.category),
      pdfText(r.gbDay),
    ]),
    ...TABLE_STYLES,
    columnStyles: {
      0: { cellWidth: 68 },
      1: { cellWidth: 50 },
      2: { cellWidth: 36, halign: 'right' },
    },
    didParseCell(data) {
      if (data.cell.text != null) {
        data.cell.text = Array.isArray(data.cell.text)
          ? data.cell.text.map((t) => normalizePdfText(String(t)))
          : normalizePdfText(String(data.cell.text));
      }
    },
  });
  let finalY = (doc.lastAutoTable?.finalY || y) + L.blockGap;
  if (rows.some((r) => r.needsReview)) {
    finalY = drawTextBlock(doc, '* Source requires validation of counts or logging scope.', L.marginLeft, finalY, L.contentWidth, PDF_FONTS.small);
  }
  return finalY;
}

function renderPhasedNextSteps(doc, block, y, customerName, docTitle) {
  const phases = block.phases || {};
  const sections = [
    { label: 'First 30 days', items: phases.days30 || [] },
    { label: 'Days 31-60', items: phases.days60 || [] },
    { label: 'Days 61-90', items: phases.days90 || [] },
  ];
  for (const section of sections) {
    y = ensureY(doc, y, 12, customerName, docTitle);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(PDF_FONTS.section);
    doc.setTextColor(...B.accent);
    doc.text(pdfText(section.label), L.marginLeft, y);
    y += 4;
    for (const line of formatBulletList(section.items).slice(0, 4)) {
      y = ensureY(doc, y, 5, customerName, docTitle);
      y = drawTextBlock(doc, line, L.marginLeft, y, L.contentWidth, PDF_FONTS.body);
    }
    y += L.blockGap;
  }
  return y;
}

function renderRiskTable(doc, rows, y, customerName, docTitle) {
  if (!rows?.length) return y;
  y = ensureY(doc, y, 18, customerName, docTitle);
  autoTable(doc, {
    startY: y,
    head: [[pdfText('Severity'), pdfText('Risk'), pdfText('Mitigation')]],
    body: rows.map((r) => [
      pdfText(r.severity || 'Planning'),
      pdfText(r.description),
      pdfText(r.mitigation),
    ]),
    ...TABLE_STYLES,
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 62 },
      2: { cellWidth: 62 },
    },
    didParseCell(data) {
      if (data.cell.text != null) {
        data.cell.text = Array.isArray(data.cell.text)
          ? data.cell.text.map((t) => normalizePdfText(String(t)))
          : normalizePdfText(String(data.cell.text));
      }
    },
  });
  return (doc.lastAutoTable?.finalY || y) + L.sectionGap;
}

function renderPhaseCard(doc, block, y, customerName, docTitle) {
  y = ensureY(doc, y, 16, customerName, docTitle);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_FONTS.section);
  doc.setTextColor(...B.accent);
  doc.text(pdfText(`${block.period}: ${block.title}`), L.marginLeft, y);
  y += 4;
  for (const line of formatBulletList(block.objectives || []).slice(0, 4)) {
    y = drawTextBlock(doc, line, L.marginLeft, y, L.contentWidth, PDF_FONTS.body);
  }
  if (block.sources) y = drawTextBlock(doc, `Sources: ${block.sources}`, L.marginLeft, y, L.contentWidth, PDF_FONTS.small);
  if (block.validation) y = drawTextBlock(doc, `Validation: ${block.validation}`, L.marginLeft, y, L.contentWidth, PDF_FONTS.small);
  return y + L.blockGap;
}

function renderSourceCards(doc, cards, y, customerName, docTitle) {
  for (const card of cards || []) {
    y = ensureY(doc, y, 36, customerName, docTitle);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(PDF_FONTS.section);
    doc.setTextColor(...B.text);
    doc.text(pdfText(card.name), L.marginLeft, y);
    y += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(PDF_FONTS.small);
    const fields = [
      `Vendor: ${card.vendor} - Method: ${card.collectionMethod}`,
      `Purpose: ${card.purpose}`,
      `TA/add-on: ${card.technicalAddon}`,
      `Scope: ${card.scope} - Complexity: ${card.complexity}`,
      card.validationIsExample ? `Example SPL: ${card.validationSpl}` : `Validation SPL: ${card.validationSpl}`,
    ].filter(Boolean);
    for (const line of fields) {
      const wrapped = doc.splitTextToSize(pdfText(line), L.contentWidth);
      y = ensureY(doc, y, wrapped.length * 3, customerName, docTitle);
      doc.text(wrapped, L.marginLeft, y);
      y += wrapped.length * 3 + 0.5;
    }
    y += L.blockGap;
  }
  return y;
}

function renderValidationEntries(doc, entries, y, customerName, docTitle) {
  for (const entry of entries || []) {
    y = ensureY(doc, y, 24, customerName, docTitle);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(PDF_FONTS.section);
    doc.text(pdfText(entry.name), L.marginLeft, y);
    y += 3.5;
    const lines = [
      `Purpose: ${entry.purpose}`,
      entry.isExample ? `Example SPL: ${entry.spl}` : `Validation SPL: ${entry.spl}`,
      `Expected: ${entry.expected}`,
      `If no data: ${entry.troubleshooting}`,
    ];
    for (const line of lines) {
      y = drawTextBlock(doc, line, L.marginLeft, y, L.contentWidth, PDF_FONTS.small);
    }
    y += L.blockGap;
  }
  return y;
}

function renderPartDivider(doc, block, y, customerName, docTitle) {
  y = ensureY(doc, y, 28, customerName, docTitle);
  doc.setFillColor(...B.dark);
  doc.roundedRect(L.marginLeft, y, L.contentWidth, 20, 2, 2, 'F');
  doc.setDrawColor(...B.accent);
  doc.setLineWidth(0.4);
  doc.roundedRect(L.marginLeft, y, L.contentWidth, 20, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_FONTS.section);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfText(block.text), L.marginLeft + 4, y + 8);
  if (block.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(PDF_FONTS.small);
    doc.setTextColor(200, 200, 210);
    const lines = doc.splitTextToSize(pdfText(block.subtitle), L.contentWidth - 8);
    doc.text(lines, L.marginLeft + 4, y + 14);
  }
  return y + 24 + L.sectionGap;
}

function renderIngestMixTable(doc, block, y, customerName, docTitle) {
  const rows = block.rows || [];
  if (!rows.length) return y;
  y = ensureY(doc, y, 18, customerName, docTitle);
  autoTable(doc, {
    startY: y,
    head: [[pdfText('Source'), pdfText('Category'), pdfText('Expected GB/day')]],
    body: rows.map((r) => [pdfText(r.name), pdfText(r.category), pdfText(r.gbDay)]),
    ...TABLE_STYLES,
    columnStyles: {
      0: { cellWidth: 72 },
      1: { cellWidth: 52 },
      2: { cellWidth: 30, halign: 'right' },
    },
    didParseCell(data) {
      if (data.cell.text != null) {
        data.cell.text = Array.isArray(data.cell.text)
          ? data.cell.text.map((t) => normalizePdfText(String(t)))
          : normalizePdfText(String(data.cell.text));
      }
    },
  });
  return (doc.lastAutoTable?.finalY || y) + L.sectionGap;
}

function renderSourcesDetailTable(doc, block, y, customerName, docTitle) {
  const rows = block.rows || [];
  if (!rows.length) return y;
  y = ensureY(doc, y, 18, customerName, docTitle);
  autoTable(doc, {
    startY: y,
    head: [[pdfText('Source'), pdfText('Status'), pdfText('GB/day'), pdfText('Conf.'), pdfText('Value summary')]],
    body: rows.map((r) => [
      pdfText(r.needsReview ? `${r.name} *` : r.name),
      pdfText(r.status),
      pdfText(r.gbDay),
      pdfText(r.confidence),
      pdfText(r.valueSummary),
    ]),
    ...TABLE_STYLES,
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 22 },
      2: { cellWidth: 28 },
      3: { cellWidth: 16 },
      4: { cellWidth: 66 },
    },
    didParseCell(data) {
      if (data.cell.text != null) {
        data.cell.text = Array.isArray(data.cell.text)
          ? data.cell.text.map((t) => normalizePdfText(String(t)))
          : normalizePdfText(String(data.cell.text));
      }
    },
  });
  let finalY = (doc.lastAutoTable?.finalY || y) + L.blockGap;
  if (rows.some((r) => r.needsReview)) {
    finalY = drawTextBlock(doc, '* Source requires planning review before final sizing.', L.marginLeft, finalY, L.contentWidth, PDF_FONTS.small);
  }
  return finalY;
}

function renderLinkList(doc, links, y, customerName, docTitle) {
  for (const link of links || []) {
    y = ensureY(doc, y, 10, customerName, docTitle);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(PDF_FONTS.body);
    doc.setTextColor(...B.text);
    doc.text(pdfText(link.label), L.marginLeft, y);
    y += 3;
    doc.setTextColor(0, 102, 204);
    doc.setFontSize(PDF_FONTS.small);
    doc.textWithLink(pdfText(link.url), L.marginLeft, y, { url: link.url });
    y += 3;
    doc.setTextColor(...B.muted);
    doc.text(pdfText(link.purpose || ''), L.marginLeft, y);
    y += 4;
  }
  return y;
}

function renderBlocks(doc, blocks, y, customerName, docTitle, opts = {}) {
  for (const block of blocks || []) {
    switch (block.type) {
      case 'cover':
        y = renderCover(doc, block, customerName);
        break;
      case 'heading':
        y = ensureY(doc, y, 7, customerName, docTitle);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(PDF_FONTS.section);
        doc.setTextColor(...B.text);
        doc.text(pdfText(block.text), L.marginLeft, y);
        y += 5;
        break;
      case 'subheading':
        y = ensureY(doc, y, 6, customerName, docTitle);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(PDF_FONTS.section);
        doc.setTextColor(...B.accent);
        doc.text(pdfText(block.text), L.marginLeft, y);
        y += 4;
        break;
      case 'paragraph':
        y = ensureY(doc, y, 8, customerName, docTitle);
        y = drawTextBlock(doc, block.text, L.marginLeft, y, L.contentWidth, block.small ? PDF_FONTS.small : PDF_FONTS.body);
        break;
      case 'bullets':
        for (const line of formatBulletList(block.items)) {
          y = ensureY(doc, y, 5, customerName, docTitle);
          y = drawTextBlock(doc, line, L.marginLeft, y, L.contentWidth, PDF_FONTS.body);
        }
        y += L.blockGap;
        break;
      case 'numbered':
        for (const line of formatNumberedList(block.items)) {
          y = ensureY(doc, y, 5, customerName, docTitle);
          y = drawTextBlock(doc, line, L.marginLeft, y, L.contentWidth, PDF_FONTS.body);
        }
        y += L.blockGap;
        break;
      case 'kpi_row':
        y = renderKpiRow(doc, block, y, customerName, docTitle);
        break;
      case 'pain_solution_pairs':
        y = renderPainSolutionPairs(doc, block.pairs, y, customerName, docTitle);
        break;
      case 'paths_table':
        y = renderPathsTable(doc, block, y, customerName, docTitle);
        break;
      case 'sources_table':
        y = renderSourcesTable(doc, block, y, customerName, docTitle);
        break;
      case 'phased_next_steps':
        y = renderPhasedNextSteps(doc, block, y, customerName, docTitle);
        break;
      case 'risk_table':
        y = renderRiskTable(doc, block.rows, y, customerName, docTitle);
        break;
      case 'phase_card':
        y = renderPhaseCard(doc, block, y, customerName, docTitle);
        break;
      case 'source_cards':
        y = renderSourceCards(doc, block.cards, y, customerName, docTitle);
        break;
      case 'validation_entries':
        y = renderValidationEntries(doc, block.entries, y, customerName, docTitle);
        break;
      case 'link_list':
        y = renderLinkList(doc, block.links, y, customerName, docTitle);
        break;
      case 'part_divider':
        y = renderPartDivider(doc, block, y, customerName, docTitle);
        break;
      case 'ingest_mix_table':
        y = renderIngestMixTable(doc, block, y, customerName, docTitle);
        break;
      case 'sources_detail_table':
        y = renderSourcesDetailTable(doc, block, y, customerName, docTitle);
        break;
      default:
        break;
    }
  }
  return y;
}

function finalizePdf(doc, customerName, filename, sections) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    addFooter(doc, p, pageCount);
  }
  doc.save(filename);
  return { filename, pageCount, sections };
}

/**
 * @param {object} document - from buildValueProposalDocument
 * @param {object} payload - original export payload
 */
export function renderValueProposalPdf(document, payload) {
  const docTitle = 'Architecture Value Proposal';
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });

  const pages = document.pages || [];
  const coverPage = pages.find((p) => p.id === 'cover');
  const bodyPages = pages.filter((p) => p.id !== 'cover');

  if (coverPage) {
    addCoverStrip(doc);
    renderBlocks(doc, coverPage.blocks, L.coverBodyStartY, document.customerName, docTitle);
  }

  if (bodyPages.length) {
    doc.addPage();
    addHeader(doc, document.customerName, docTitle);
    let y = L.bodyStartY;
    for (const page of bodyPages) {
      y = renderBlocks(doc, page.blocks, y, document.customerName, docTitle);
    }
  }

  const filename = `splunk-scope-value-proposal-${safeExportFilename(document.customerName)}.pdf`;
  return finalizePdf(doc, document.customerName, filename, document.meta?.sectionIds || []);
}

/**
 * @param {object} document - from buildStartupGuideDocument
 */
export function renderStartupGuidePdf(document, payload) {
  const docTitle = 'Implementation Startup Guide';
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  addHeader(doc, document.customerName, docTitle);

  const pages = document.pages || [];
  pages.forEach((page, idx) => {
    if (idx > 0) {
      doc.addPage();
      addHeader(doc, document.customerName, docTitle);
    }
    renderBlocks(doc, page.blocks, L.bodyStartY, document.customerName, docTitle);
  });

  const filename = `splunk-scope-startup-guide-${safeExportFilename(document.customerName)}.pdf`;
  return finalizePdf(doc, document.customerName, filename, document.meta?.sectionIds || []);
}

/**
 * @param {object} document - from buildCustomerPlanningPackDocument
 */
export function renderCustomerPlanningPackPdf(document, payload) {
  const docTitle = 'Customer Planning Pack';
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pages = document.pages || [];

  for (const page of pages) {
    if (page.id === 'cover') {
      addCoverStrip(doc);
      renderBlocks(doc, page.blocks, L.coverBodyStartY, document.customerName, docTitle);
    } else {
      doc.addPage();
      addHeader(doc, document.customerName, docTitle);
      renderBlocks(doc, page.blocks, L.bodyStartY, document.customerName, docTitle);
    }
  }

  const filename = `splunk-scope-planning-pack-${safeExportFilename(document.customerName)}.pdf`;
  return finalizePdf(doc, document.customerName, filename, document.meta?.sectionIds || []);
}
