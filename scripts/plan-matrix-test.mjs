#!/usr/bin/env node
/**
 * Architecture paths matrix — ~50 scenario combinations.
 * Run: node scripts/plan-matrix-test.mjs
 */
import { flattenSourceCatalog } from '../src/services/sizingEngine.js';
import { generatePlans } from '../src/services/planEngine.js';
import { computeIngestBudgetFromIntake } from '../src/services/budgetEngine.js';
import sourceCatalog from '../src/data/sources.json' with { type: 'json' };
import useCaseProfiles from '../src/data/useCaseProfiles.json' with { type: 'json' };
import sampleScenarios from '../src/data/sampleScenarios.json' with { type: 'json' };

const flatCatalog = flattenSourceCatalog(sourceCatalog);
const robbins = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid');
const foundational = useCaseProfiles.find((u) => u.id === 'foundational_security');
const enterprise = useCaseProfiles.find((u) => u.id === 'enterprise_security');
const threat = useCaseProfiles.find((u) => u.id === 'threat_detection');
const compliance = useCaseProfiles.find((u) => u.id === 'compliance_audit');
const identity = useCaseProfiles.find((u) => u.id === 'identity_access');

const CORE_IDS = [
  'active_directory',
  'saas_office',
  'saas_sso',
  'email',
  'edr',
  'desktops',
  'windows_servers',
  'firewalls',
  'vpn',
  'dns',
  'dhcp',
  'switches',
  'routers',
  'wireless',
  'nac',
  'proxy',
  'netflow',
  'ids_ips',
];

function sourceSetKey(sources) {
  return [...sources]
    .map((s) => s.id)
    .sort()
    .join('|');
}

function scaleStates(states, factor) {
  const out = {};
  for (const [id, st] of Object.entries(states)) {
    out[id] = { ...st };
    for (const k of [
      'number_of_users',
      'number_of_endpoints',
      'number_of_servers',
      'number_of_systems',
      'number_of_devices',
      'number_of_leases',
      'count',
    ]) {
      if (typeof out[id][k] === 'number') out[id][k] = Math.max(1, Math.round(out[id][k] * factor));
    }
  }
  return out;
}

function pickStates(ids, template, status = 'current') {
  const out = {};
  for (const id of ids) {
    if (template[id]) out[id] = { ...template[id] };
    else {
      out[id] = {
        status,
        number_of_users: 800,
        number_of_endpoints: 400,
        number_of_servers: 20,
        number_of_systems: 4,
        count: 200,
        vendor: 'Check Point',
        logging_scope: 'Traffic + threat prevention',
      };
    }
  }
  return out;
}

function budgetFromUsd(usd, deploymentType) {
  return computeIngestBudgetFromIntake({
    opportunityBudgetUsd: usd,
    deploymentType,
  })?.budgetGbDay ?? null;
}

function buildScenarios() {
  const marionStates = robbins?.sources ?? {};
  const marionUc = [
    foundational,
    enterprise,
    threat,
    compliance,
    identity,
  ].filter(Boolean);

  const scenarios = [];
  let n = 0;

  const add = (label, states, useCases, budgetUsd, deploymentType, primaryId) => {
    scenarios.push({
      id: ++n,
      label,
      states,
      useCases,
      budgetGbDay: budgetUsd != null ? budgetFromUsd(budgetUsd, deploymentType) : null,
      deploymentType,
      primaryProfileId: primaryId ?? foundational?.id,
    });
  };

  // Marion-like full stack
  for (const [usd, dep] of [
    [100_000, 'cloud'],
    [100_000, 'hybrid'],
    [200_000, 'cloud'],
    [350_000, 'cloud'],
    [650_000, 'cloud'],
    [65_000, 'onprem'],
    [130_000, 'onprem'],
    [650_000, 'onprem'],
  ]) {
    add(`Marion 14-src · $${usd / 1000}k ${dep}`, marionStates, marionUc, usd, dep, foundational?.id);
  }

  add('Marion · no budget', marionStates, marionUc, null, 'hybrid', foundational?.id);
  add('Marion · scale 0.5× · $100k cloud', scaleStates(marionStates, 0.5), marionUc, 100_000, 'cloud', foundational?.id);
  add('Marion · scale 2× · $650k cloud', scaleStates(marionStates, 2), marionUc, 650_000, 'cloud', enterprise?.id);

  const perimeter = ['active_directory', 'firewalls', 'vpn', 'dns', 'edr', 'windows_servers'];
  const identityPack = ['active_directory', 'saas_sso', 'saas_office', 'email', 'edr'];
  const networkPack = ['firewalls', 'switches', 'routers', 'wireless', 'dns', 'netflow'];
  const minimal = ['active_directory', 'firewalls', 'windows_servers'];

  for (const [label, ids] of [
    ['Perimeter 6', perimeter],
    ['Identity 5', identityPack],
    ['Network 6', networkPack],
    ['Minimal 3', minimal],
    ['Core 8', CORE_IDS.slice(0, 8)],
    ['Core 12', CORE_IDS.slice(0, 12)],
  ]) {
    add(`${label} · $100k cloud`, pickStates(ids, marionStates), [foundational, enterprise], 100_000, 'cloud');
    add(`${label} · $50k cloud`, pickStates(ids, marionStates), [foundational], 50_000, 'cloud');
    add(`${label} · no budget`, pickStates(ids, marionStates), [foundational, enterprise], null, 'cloud');
  }

  add('Foundational only · 10 src · $100k', pickStates(CORE_IDS.slice(0, 10), marionStates), [foundational], 100_000, 'cloud');
  add('Enterprise primary · Marion · $150k', marionStates, [enterprise, foundational], 150_000, 'cloud', enterprise?.id);
  add('Single UC threat · 8 src · $100k', pickStates(CORE_IDS.slice(0, 8), marionStates), [threat], 100_000, 'cloud', threat?.id);

  // Future mix
  const futureMix = pickStates(['edr', 'ndr', 'sase', 'cspm'], marionStates, 'future');
  futureMix.edr = { ...marionStates.edr, status: 'current' };
  add('Future-heavy · $100k cloud', futureMix, [enterprise], 100_000, 'cloud');

  // Tiny / edge
  add('Tiny 2-src · $30k cloud', pickStates(['active_directory', 'firewalls'], marionStates), [foundational], 30_000, 'cloud');
  add('Large synthetic 16 · $500k cloud', pickStates(CORE_IDS, marionStates), marionUc, 500_000, 'cloud');
  add('Low budget $40k · Marion', marionStates, marionUc, 40_000, 'cloud');
  add('High budget $1M · Marion', marionStates, marionUc, 1_000_000, 'cloud');

  const extraBudgets = [
    [75_000, 'cloud'],
    [125_000, 'cloud'],
    [250_000, 'cloud'],
    [42_500, 'onprem'],
    [97_500, 'onprem'],
  ];
  for (const [usd, dep] of extraBudgets) {
    add(`Marion · $${usd / 1000}k ${dep}`, marionStates, marionUc, usd, dep);
  }

  const randomSets = [
    ['firewalls', 'windows_servers', 'edr', 'dns', 'proxy'],
    ['active_directory', 'saas_sso', 'email', 'edr', 'vpn'],
    ['firewalls', 'switches', 'wireless', 'nac', 'netflow'],
    ['windows_servers', 'linux_servers', 'edr', 'dhcp', 'dns'],
    ['saas_office', 'saas_sso', 'casb', 'proxy', 'edr'],
  ];
  for (let i = 0; i < randomSets.length; i++) {
    add(`Mix ${i + 1} · $100k`, pickStates(randomSets[i], marionStates), [foundational, enterprise], 100_000, 'cloud');
  }

  return scenarios.slice(0, 50);
}

function validateScenario(scenario, plans) {
  const issues = [];
  const [crawl, walkA, walkB, run] = plans;
  const B = scenario.budgetGbDay;

  if (plans.length !== 4) issues.push(`expected 4 plans, got ${plans.length}`);

  const gb = (p) => p?.totals?.buffered?.expected ?? 0;
  const crawlGb = gb(crawl);
  const walkAGb = gb(walkA);
  const walkBGb = gb(walkB);
  const runGb = gb(run);

  if (B != null && B > 0) {
    const crawlMin = B * 0.6
    const crawlMax = B * 0.8
    const walkMax = B * (1 + 0.03)
    if (crawlGb > crawlMax * 1.04) {
      issues.push(`crawl ${crawlGb.toFixed(1)} > 80% cap (${crawlMax.toFixed(1)})`);
    }
    if (crawlGb < crawlMin * 0.97 && crawl.sources.length > 0) {
      const usesFullConfiguredStack =
        crawl.sources.length >= 8 && crawlGb >= B * 0.6 * 0.65
      const budgetExceedsConfiguredIngest =
        B > 120 &&
        crawl.sources.length >= 12 &&
        crawlGb >= 65 &&
        crawlGb < crawlMin
      if (!usesFullConfiguredStack && !budgetExceedsConfiguredIngest) {
        issues.push(`crawl ${crawlGb.toFixed(1)} < 60% cap (${crawlMin.toFixed(1)})`)
      }
    }
    if (walkAGb > walkMax + 0.5) issues.push(`walkA ${walkAGb.toFixed(1)} > 103% cap`);
    if (walkBGb > walkMax + 0.5) issues.push(`walkB ${walkBGb.toFixed(1)} > 103% cap`);
  }

  const kC = sourceSetKey(crawl.sources);
  const kA = sourceSetKey(walkA.sources);
  const kB = sourceSetKey(walkB.sources);
  const kR = sourceSetKey(run.sources);

  if (kC === kA && kC === kB && crawl.sources.length > 0) {
    issues.push('crawl/walkA/walkB identical source sets');
  } else {
    if (kC === kA) issues.push('crawl === walkA sources');
    if (kC === kB) issues.push('crawl === walkB sources');
    if (kA === kB) issues.push('walkA === walkB sources');
  }

  if (
    crawlGb === walkAGb &&
    walkAGb === walkBGb &&
    crawl.sources.length > 0 &&
    kC === kA &&
    kA === kB
  ) {
    issues.push('all three paths same GB and same sources');
  } else if (crawlGb === walkAGb && crawlGb === walkBGb && B != null) {
    issues.push('crawl/walkA/walkB same GB (sources may differ)');
  }

  if (B != null && walkAGb > 0 && crawlGb > walkAGb + 1) {
    issues.push(`crawl GB (${crawlGb.toFixed(1)}) > walkA (${walkAGb.toFixed(1)})`);
  }

  if (B != null && Math.abs(crawlGb - walkAGb) < 0.5 && Math.abs(walkAGb - walkBGb) < 0.5 && kC === kA && kA === kB) {
    issues.push('crawl/walkA/walkB same GB and same sources');
  }

  if (runGb < walkAGb * 0.85 && run.sources.length <= walkA.sources.length) {
    issues.push(`run (${runGb.toFixed(1)}) not broader than walkA (${walkAGb.toFixed(1)})`);
  }

  return {
    issues,
    crawlGb,
    walkAGb,
    walkBGb,
    runGb,
    nCrawl: crawl.sources.length,
    nA: walkA.sources.length,
    nB: walkB.sources.length,
    nRun: run.sources.length,
    distinctSets: new Set([kC, kA, kB]).size,
    sameGbTriple:
      Math.abs(crawlGb - walkAGb) < 0.05 && Math.abs(walkAGb - walkBGb) < 0.05,
  };
}

const scenarios = buildScenarios();
const rows = [];
let pass = 0;
let fail = 0;

for (const sc of scenarios) {
  const plans = generatePlans(
    flatCatalog,
    sc.states,
    sc.useCases,
    [],
    {},
    0.2,
    {
      budgetGbDay: sc.budgetGbDay,
      primaryProfileId: sc.primaryProfileId,
    },
  );
  const v = validateScenario(sc, plans);
  const ok = v.issues.length === 0;
  if (ok) pass++;
  else fail++;

  rows.push({
    id: sc.id,
    label: sc.label,
    budget: sc.budgetGbDay != null ? sc.budgetGbDay.toFixed(0) : '—',
    crawl: v.crawlGb.toFixed(1),
    walkA: v.walkAGb.toFixed(1),
    walkB: v.walkBGb.toFixed(1),
    run: v.runGb.toFixed(1),
    src: `${v.nCrawl}/${v.nA}/${v.nB}/${v.nRun}`,
    sets: v.distinctSets,
    ok: ok ? 'PASS' : 'FAIL',
    issues: v.issues.join('; ') || '—',
  });
}

console.log('\n=== Architecture Paths Matrix (%d scenarios) ===\n', rows.length);
console.log(
  '| # | Scenario | Budget | Crawl | WalkA | WalkB | Run | Src C/A/B/R | Distinct | Result | Notes |',
);
console.log(
  '|---|----------|--------|-------|-------|-------|-----|-------------|----------|--------|-------|',
);
for (const r of rows) {
  console.log(
    `| ${r.id} | ${r.label.slice(0, 42)} | ${r.budget} | ${r.crawl} | ${r.walkA} | ${r.walkB} | ${r.run} | ${r.src} | ${r.sets}/3 | ${r.ok} | ${r.issues.slice(0, 60)} |`,
  );
}

console.log('\n--- Summary ---');
console.log(`PASS: ${pass}/${rows.length}`);
console.log(`FAIL: ${fail}/${rows.length}`);

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dir = dirname(fileURLToPath(import.meta.url));
const md = [
  '# Architecture Paths Matrix Results',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `**PASS:** ${pass}/${rows.length} · **FAIL:** ${fail}/${rows.length}`,
  '',
  '| # | Scenario | Budget | Crawl | Walk A | Walk B | Run | Sources C/A/B/R | Distinct sets | Result | Notes |',
  '|---|----------|--------|-------|--------|--------|-----|-----------------|---------------|--------|-------|',
  ...rows.map(
    (r) =>
      `| ${r.id} | ${r.label.replace(/\|/g, '/')} | ${r.budget} | ${r.crawl} | ${r.walkA} | ${r.walkB} | ${r.run} | ${r.src} | ${r.sets}/3 | ${r.ok} | ${r.issues.replace(/\|/g, '/')} |`,
  ),
  '',
].join('\n');
writeFileSync(join(__dir, '../docs/archive/plan-matrix-results.md'), md);
console.log('Wrote docs/archive/plan-matrix-results.md');

const failRows = rows.filter((r) => r.ok === 'FAIL');
if (failRows.length) {
  console.log('\nFailed scenarios detail:');
  for (const r of failRows) {
    console.log(`  [${r.id}] ${r.label}: ${r.issues}`);
  }
  process.exit(1);
}

process.exit(0);
