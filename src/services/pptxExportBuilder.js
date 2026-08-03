/**
 * Renders Value Proposal slide deck to PowerPoint.
 */
import PptxGenJS from 'pptxgenjs';
import { PPTX_THEME } from './exportDesignTokens.js';
import { formatBulletList, safeExportFilename } from './exportShared.js';

const T = PPTX_THEME;

function titleBar(slide, pptx, title, subtitle) {
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.65, fill: { color: T.dark } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.65, w: '100%', h: 0.04, fill: { color: T.accent } });
  slide.addText(title, { x: 0.5, y: 0.14, w: 9, h: 0.35, fontSize: 22, color: 'FFFFFF', bold: true });
  if (subtitle) {
    slide.addText(subtitle, { x: 0.5, y: 0.78, w: 9, h: 0.35, fontSize: 11, color: '888888' });
  }
}

function bulletSlide(slide, pptx, slideDef) {
  titleBar(slide, pptx, slideDef.title, slideDef.subtitle);
  const items = (slideDef.bullets || []).filter(Boolean).slice(0, 6);
  if (items.length) {
    slide.addText(formatBulletList(items).join('\n'), {
      x: 0.5,
      y: 1.15,
      w: 9,
      h: 3.6,
      fontSize: 14,
      color: T.text,
      valign: 'top',
    });
  }
}

/**
 * @param {object} deck - from buildValueProposalSlideDeck
 */
export async function renderValueProposalPptx(deck) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Cisco | Splunk Scope';
  pptx.title = `${deck.customerName} — Architecture Value Proposal`;
  pptx.subject = 'Prepared for planning discussion by Cisco/Splunk technical teams';

  for (const slideDef of deck.slides || []) {
    const slide = pptx.addSlide();

    if (slideDef.id === 'title') {
      titleBar(slide, pptx, slideDef.title, slideDef.subtitle);
      const kpis = slideDef.kpis || [];
      let y = 1.2;
      for (const kpi of kpis) {
        slide.addText(`${kpi.label}: `, { x: 0.5, y, w: 2.2, fontSize: 12, color: T.muted });
        slide.addText(kpi.value, { x: 2.5, y, w: 7, fontSize: 14, color: T.accent, bold: true });
        y += 0.55;
      }
      continue;
    }

    if (slideDef.id === 'recommended_path') {
      titleBar(slide, pptx, slideDef.title);
      slide.addText(slideDef.highlight || '', { x: 0.5, y: 1.2, w: 9, fontSize: 22, color: T.accent, bold: true });
      if (slideDef.body) {
        slide.addText(slideDef.body, { x: 0.5, y: 1.85, w: 9, h: 1.2, fontSize: 13, color: T.text });
      }
      if (slideDef.bullets?.length) {
        slide.addText(formatBulletList(slideDef.bullets).join('\n'), {
          x: 0.5,
          y: 3.1,
          w: 9,
          h: 1.6,
          fontSize: 12,
          color: T.text,
        });
      }
      if (slideDef.tradeoff) {
        slide.addText(`Tradeoff: ${slideDef.tradeoff}`, { x: 0.5, y: 4.5, w: 9, fontSize: 11, color: T.muted });
      }
      continue;
    }

    if (slideDef.id === 'ingest') {
      titleBar(slide, pptx, slideDef.title);
      slide.addText(slideDef.highlight || '', { x: 0.5, y: 1.3, fontSize: 28, color: T.success, bold: true });
      slide.addText(formatBulletList(slideDef.bullets || []).join('\n'), {
        x: 0.5,
        y: 2.05,
        w: 9,
        h: 3,
        fontSize: 13,
        color: T.text,
      });
      continue;
    }

    if (slideDef.id === 'coverage') {
      titleBar(slide, pptx, slideDef.title);
      slide.addText(`Coverage score: ${slideDef.coverageScore ?? 0}%`, {
        x: 0.5,
        y: 1.2,
        fontSize: 20,
        bold: true,
        color: T.text,
      });
      slide.addText(formatBulletList(slideDef.bullets || []).join('\n'), {
        x: 0.5,
        y: 1.85,
        w: 9,
        h: 3.2,
        fontSize: 13,
        color: T.text,
      });
      continue;
    }

    bulletSlide(slide, pptx, slideDef);
  }

  const filename = `splunk-scope-value-proposal-${safeExportFilename(deck.customerName)}.pptx`;
  await pptx.writeFile({ fileName: filename });
  return {
    filename,
    slideCount: deck.slides?.length || 0,
    slideTitles: (deck.slides || []).map((s) => s.title),
    slideIds: (deck.slides || []).map((s) => s.id),
  };
}
