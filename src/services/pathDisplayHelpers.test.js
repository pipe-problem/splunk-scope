/**
 * Architecture Paths display helpers — consistency and copy limits.
 */
import { describe, it, expect } from 'vitest';
import sourceCatalog from '../data/sources.json';
import useCaseProfiles from '../data/useCaseProfiles.json';
import { flattenSourceCatalog } from './sizingEngine.js';
import { generatePlans } from './planEngine.js';
import {
  buildPathSourceRows,
  buildPlanDisplayMetrics,
  findRecommendedPlanIndex,
  getPathDelta,
  getPlanIngestGb,
  isShortTileCopy,
} from './pathDisplayHelpers.js';
import { buildPathCardMessaging, buildPathChips } from './pathValueMessagingEngine.js';

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const foundational = useCaseProfiles.find((uc) => uc.id === 'foundational_security');

function richStates() {
  const ids = [
    'active_directory', 'firewalls', 'windows_servers', 'dns', 'edr', 'saas_sso',
    'proxy', 'vpn', 'email', 'vuln_mgmt', 'saas_office', 'asset_cmdb', 'iaas',
    'iaas_instances', 'iaas_storage', 'iaas_containers', 'saas_general', 'saas_crm',
    'dlp', 'web_servers', 'database',
  ];
  const st = {};
  for (const id of ids) {
    st[id] = {
      status: 'current',
      number_of_users: 5000,
      number_of_endpoints: 2000,
      count: 100,
      vendor: 'Microsoft',
      logging_scope: 'Security + System',
    };
  }
  st.firewalls = { ...st.firewalls, vendor: 'Palo Alto Networks', count: 8 };
  st.iaas = { ...st.iaas, number_of_accounts: 4, cloud_provider: 'aws' };
  return st;
}

function richPlans() {
  return generatePlans(flatCatalog, richStates(), [foundational], [], {}, 0.2, {
    budgetGbDay: 250,
    primaryProfileId: 'foundational_security',
  });
}

describe('pathDisplayHelpers', () => {
  it('card metrics match detail metrics from the same plan object', () => {
    const plans = richPlans();
    const states = richStates();
    for (const plan of plans) {
      const card = buildPlanDisplayMetrics(plan);
      const { pathExpected, allRows } = buildPathSourceRows(plan, states);
      expect(card.ingestGb).toBe(getPlanIngestGb(plan));
      expect(card.sourceCount).toBe(plan.sources.length);
      expect(pathExpected).toBe(card.ingestGb);
      expect(allRows.length).toBe(card.sourceCount);
    }
  });

  it('biggest ingest drivers come from path source breakdown', () => {
    const plans = richPlans();
    const run = plans[2];
    const { allRows, pathExpected } = buildPathSourceRows(run, richStates());
    expect(allRows.length).toBeGreaterThan(0);
    const top = allRows[0];
    expect(top.gbExpected).toBeGreaterThanOrEqual(allRows[allRows.length - 1].gbExpected);
    expect(pathExpected).toBeCloseTo(allRows.reduce((s, r) => s + r.gbExpected, 0), 4);
  });

  it('recommends Walk for balanced commercial path', () => {
    const plans = richPlans();
    const idx = findRecommendedPlanIndex(plans);
    expect(plans[idx].pathPhase).toBe('walk');
    expect(plans[idx].name).toBe('Walk');
  });

  it('path tile copy stays short', () => {
    const plans = richPlans();
    for (const plan of plans) {
      const msg = plan.pathMessaging || buildPathCardMessaging(plan, [foundational]);
      expect(isShortTileCopy(msg.cardUnlock)).toBe(true);
      expect(isShortTileCopy(msg.cardBestFor)).toBe(true);
      expect((msg.chips || []).length).toBe(0);
    }
  });

  it('report data builder uses same plan index and ingest as generatePlans', () => {
    const plans = richPlans();
    const selectedIndex = 1;
    const selectedPlan = plans[selectedIndex];
    const plansAgain = generatePlans(flatCatalog, richStates(), [foundational], [], {}, 0.2, {
      budgetGbDay: 250,
      primaryProfileId: 'foundational_security',
    });
    expect(plansAgain[selectedIndex].name).toBe(selectedPlan.name);
    expect(getPlanIngestGb(plansAgain[selectedIndex])).toBe(getPlanIngestGb(selectedPlan));
    expect(plansAgain[selectedIndex].sources.length).toBe(selectedPlan.sources.length);
  });

  it('delta uses plan pathComparison when present', () => {
    const plans = richPlans();
    const walkA = plans[1];
    expect(walkA.pathComparison).toBeTruthy();
    const delta = getPathDelta(walkA, plans[0]);
    expect(delta.readinessDelta).toBe(walkA.pathComparison.readinessDelta);
  });

  it('comparison board does not use chips', () => {
    expect(buildPathChips()).toEqual([]);
    const plans = richPlans();
    for (const plan of plans) {
      expect((plan.pathMessaging?.chips || []).length).toBe(0);
    }
  });
});

describe('Architecture Paths page layout contract', () => {
  it('scroll container classes avoid nested max-height traps', async () => {
    const fs = await import('node:fs');
    const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    expect(css).toContain('.page-scroll--paths');
    expect(css).toContain('overflow-y: auto');
    expect(css).not.toMatch(/\.plans-detail-panel[\s\S]*?max-height:\s*calc\(100vh/);
  });

  it('technical details expanded on desktop by default', async () => {
    const fs = await import('node:fs');
    const details = fs.readFileSync(
      new URL('../components/architecture-paths/PathTechnicalDetails.jsx', import.meta.url),
      'utf8',
    );
    expect(details).toContain('defaultOpenOnDesktop');
    expect(details).toContain('Source breakdown');
    expect(details).toContain('PathTechnicalProofPanel');
    expect(details).toMatch(/Sources.*Scoring|scoring.*sources/is);
  });

  it('PlansPage uses carousel and separates view from report path', async () => {
    const fs = await import('node:fs');
    const page = fs.readFileSync(new URL('../pages/PlansPage.jsx', import.meta.url), 'utf8');
    expect(page).toContain('viewIndex');
    expect(page).toContain('reportPathIndex');
    expect(page).toContain('PathCarousel');
    expect(page).toContain('PathTechnicalDetails');
    expect(page).toContain('SELECT_PLAN');
    expect(page).not.toContain('RoadmapComparisonBoard');
    expect(page).not.toContain('RecommendedPathStrip');
    expect(page).not.toContain('RoadmapPathTile');
  });

  it('carousel styles use centered stage and step arrows', async () => {
    const fs = await import('node:fs');
    const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    expect(css).toContain('.path-carousel__stage');
    expect(css).toContain('.path-carousel__step');
    expect(css).toContain('.plan-path-card--center');
    expect(css).toContain('.path-technical-details');
    expect(css).toContain('.page-content-width');
    expect(css).toContain('.path-carousel-viewport');
    expect(css).toContain('max-width: 58rem');
    expect(css).toContain('path-card-enter');
  });

  it('carousel component wraps circularly', async () => {
    const fs = await import('node:fs');
    const carousel = fs.readFileSync(
      new URL('../components/architecture-paths/PathCarousel.jsx', import.meta.url),
      'utf8',
    );
    expect(carousel).toContain('wrapIndex(viewIndex - 1, count)');
    expect(carousel).toContain('wrapIndex(viewIndex + 1, count)');
    expect(carousel).toContain('PathCarouselCard');
    expect(carousel).toContain('path-carousel__step-name');
    expect(carousel).not.toContain('PathChip');
    expect(carousel).not.toContain('getVisibleCarouselSlots');
  });

  it('path card shows solution fit, ingest band, powers, and donut', async () => {
    const fs = await import('node:fs');
    const card = fs.readFileSync(
      new URL('../components/architecture-paths/PathCarouselCard.jsx', import.meta.url),
      'utf8',
    );
    expect(card).toContain('DonutChart');
    expect(card).toContain('Select for report');
    expect(card).toContain('Powers');
    expect(card).not.toContain('Solution fit');
    expect(card).toContain('onSliceClick');
    expect(card).toContain('pinnedCategory');
    expect(card).toContain('presentationScale={false}');
    expect(card).toContain('expandOnHover={false}');
    expect(card).not.toContain('Misses');
    expect(card).not.toContain('plan.gaps');
    expect(card).not.toContain('validation.gaps');
    expect(card).not.toContain('PlanningKpiStrip');
  });

  it('carousel shows one centered card without side-card click navigation', async () => {
    const fs = await import('node:fs');
    const carousel = fs.readFileSync(
      new URL('../components/architecture-paths/PathCarousel.jsx', import.meta.url),
      'utf8',
    );
    expect(carousel).toContain('plan-path-card--solo');
    expect(carousel).toContain("role=\"group\"");
    expect(carousel).not.toContain('path-cards-deck__slot');
  });

  it('PlansPage carousel imports DonutChart via path card', async () => {
    const fs = await import('node:fs');
    const card = fs.readFileSync(
      new URL('../components/architecture-paths/PathCarouselCard.jsx', import.meta.url),
      'utf8',
    );
    expect(card).toContain('<DonutChart');
    expect(card).toMatch(/import\s+DonutChart\s+from\s+['"].*DonutChart/);
  });
});
