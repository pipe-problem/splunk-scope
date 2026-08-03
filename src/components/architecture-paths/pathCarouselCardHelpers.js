import { buildPathSourceRows, getPathTotals } from '../../services/pathDisplayHelpers.js';
import { resolvePoweredAppLinks } from '../../services/reportAppLinks.js';

export { resolvePoweredAppLinks };

/**
 * @param {object} plan
 * @param {Record<string, object>} sourceStates
 */
export function buildPathCardDonutData(plan, sourceStates = {}) {
  const { allRows } = buildPathSourceRows(plan, sourceStates);
  const segments = (plan.categoryBreakdown || []).map((row) => ({
    label: row.category,
    value: row.gbDay,
  }));

  const sourcesByCategory = {};
  for (const row of allRows) {
    const cat = row.category || 'Other';
    if (!sourcesByCategory[cat]) sourcesByCategory[cat] = [];
    sourcesByCategory[cat].push(row);
  }
  for (const cat of Object.keys(sourcesByCategory)) {
    sourcesByCategory[cat].sort((a, b) => b.gbExpected - a.gbExpected);
  }

  const totals = getPathTotals(plan);
  return { segments, sourcesByCategory, totalExpected: totals.expected };
}

/**
 * Relative card position for 3-card deck (-1 left peek, 0 center, 1 right peek).
 * @param {number} index
 * @param {number} viewIndex
 * @param {number} count
 */
export function getCardRelativeOffset(index, viewIndex, count) {
  let rel = index - viewIndex;
  if (rel > count / 2) rel -= count;
  if (rel < -count / 2) rel += count;
  return rel;
}

/** Map relative offset to deck slot class (-1 left, 0 center, 1 right). */
export function getCarouselSlotClass(rel) {
  if (rel === 0) return 'plan-path-card--center';
  if (rel < 0) return 'plan-path-card--left';
  return 'plan-path-card--right';
}

/**
 * Visible carousel slots — at most one card per side; hides |rel| > 1.
 * @returns {{ index: number, rel: number, slotClass: string }[]}
 */
export function getVisibleCarouselSlots(viewIndex, count) {
  if (!count) return [];
  const slots = [];
  for (let index = 0; index < count; index += 1) {
    const rel = getCardRelativeOffset(index, viewIndex, count);
    if (Math.abs(rel) > 1) continue;
    slots.push({ index, rel, slotClass: getCarouselSlotClass(rel) });
  }
  return slots;
}
