import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getCardRelativeOffset,
  getVisibleCarouselSlots,
} from './pathCarouselCardHelpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const carouselSource = readFileSync(resolve(__dirname, 'PathCarousel.jsx'), 'utf8');
const cssSource = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');
const cardSource = readFileSync(resolve(__dirname, 'PathCarouselCard.jsx'), 'utf8');

describe('pathCarouselCardHelpers', () => {
  it('getVisibleCarouselSlots hides cards with |rel| > 1', () => {
    for (let viewIndex = 0; viewIndex < 3; viewIndex += 1) {
      const slots = getVisibleCarouselSlots(viewIndex, 3);
      expect(slots).toHaveLength(3);
      expect(slots.map((s) => s.rel).sort()).toEqual([-1, 0, 1]);
      expect(new Set(slots.map((s) => s.slotClass)).size).toBe(3);
    }
  });

  it('getCardRelativeOffset wraps circularly for three paths', () => {
    expect(getCardRelativeOffset(2, 0, 3)).toBe(-1);
    expect(getCardRelativeOffset(1, 0, 3)).toBe(1);
    expect(getCardRelativeOffset(0, 1, 3)).toBe(-1);
    expect(getCardRelativeOffset(2, 1, 3)).toBe(1);
  });
});

describe('PathCarousel single-card layout', () => {
  it('renders one centered card with prev/next step labels', () => {
    expect(carouselSource).toContain('path-carousel__stage');
    expect(carouselSource).toContain('path-carousel__step--prev');
    expect(carouselSource).toContain('path-carousel__step--next');
    expect(carouselSource).toContain('path-carousel__step-name');
    expect(carouselSource).toContain('plan-path-card--solo');
    expect(carouselSource).not.toContain('path-cards-deck__slot');
    expect(carouselSource).not.toContain('getVisibleCarouselSlots');
  });

  it('stage CSS centers solo card with step arrows', () => {
    expect(cssSource).toContain('.path-carousel__stage');
    expect(cssSource).toContain('.path-carousel__step-name');
    expect(cssSource).toContain('.plan-path-card--solo');
    expect(cssSource).toContain('.path-carousel-viewport');
    expect(cssSource).toContain('max-width: 58rem');
    expect(cssSource).toContain('.plan-path-card--center .plan-path-card-inner__body');
  });

  it('PathCarouselCard uses total-only donut center and category detail panel', () => {
    expect(cardSource).toContain('centerMode="total-only"');
    expect(cardSource).toContain('expandOnHover={false}');
    expect(cardSource).toContain('Select a category');
    expect(cardSource).toContain('path-card-category-panel');
    expect(cardSource).toContain('path-card-metrics--three');
    expect(cardSource).toContain('slice(0, 6)');
    expect(cardSource).not.toContain('path-card-donut-category-label');
  });
});
