#!/usr/bin/env node
/**
 * Capture Splunk Scope UI screenshots for visual review (screen-share QA).
 * Uses Chuck Robbins retail example data preloaded via localStorage.
 *
 * Usage:
 *   npm run build && npm run preview &
 *   node scripts/capture-screenshots.mjs
 *
 * Or with dev server already running on :5173:
 *   node scripts/capture-screenshots.mjs --url http://localhost:5173
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getReferenceScreenshotsDir } from './lib/catalogUtils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = getReferenceScreenshotsDir();
const STORAGE_KEY = 'splunk-scope-session';

const VIEWPORT = { width: 1440, height: 900 };

function parseArgs() {
  const urlIdx = process.argv.indexOf('--url');
  return {
    baseUrl: urlIdx >= 0 ? process.argv[urlIdx + 1] : 'http://localhost:4173',
    spawnPreview: !process.argv.includes('--no-preview') && urlIdx < 0,
  };
}

async function loadSampleScenario() {
  const primary = JSON.parse(
    await readFile(path.join(ROOT, 'src/data/sampleScenarios.json'), 'utf8'),
  );
  const additional = JSON.parse(
    await readFile(path.join(ROOT, 'src/data/additionalSampleScenarios.json'), 'utf8'),
  );
  const sampleScenarios = [...primary, ...additional];
  const scenario = sampleScenarios.find((s) => s.id === 'robbins_retail_hybrid') || sampleScenarios[0];
  if (!scenario) throw new Error('No sample scenario found');
  return scenario;
}

function buildSession(scenario, theme = 'dark') {
  const now = new Date().toISOString();
  const baseline = {
    id: `sc_${scenario.id}_baseline`,
    name: 'Baseline — Chuck Robbins',
    intake: scenario.intake,
    sources: scenario.sources,
    savedAt: now,
  };
  const expandedSources = {
    ...scenario.sources,
    dns: { ...(scenario.sources.dns || { status: 'future', number_of_servers: 2 }), status: 'current', notes: 'DNS logging enabled for Run-phase demo.' },
  };
  const expanded = {
    id: `sc_${scenario.id}_expanded`,
    name: 'Expanded — DNS logging',
    intake: scenario.intake,
    sources: expandedSources,
    savedAt: now,
  };

  return {
    schemaVersion: 4,
    currentStep: 7,
    theme,
    intake: scenario.intake,
    sources: scenario.sources,
    interpretation: null,
    interpretationIntakeKey: null,
    plans: null,
    selectedPlanIndex: scenario.selectedPlanIndex ?? 1,
    sessionId: 'screenshot-session',
    lastSaved: now,
    scenarios: [baseline, expanded],
    activeScenarioId: null,
    activeTemplateId: `example:${scenario.id}`,
    bufferPercent: 20,
    overlapDecisions: {},
    showAllDomains: false,
  };
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server not reachable at ${url}`);
}

function startPreview() {
  return spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: false,
  });
}

async function injectSession(page, session) {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: session },
  );
}

async function capture(page, filePath, { fullPage = false, waitMs = 600 } = {}) {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: filePath, fullPage });
}

async function main() {
  const { baseUrl, spawnPreview } = parseArgs();
  let previewProc = null;

  if (spawnPreview) {
    previewProc = startPreview();
    await waitForServer(baseUrl);
  } else {
    await waitForServer(baseUrl);
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('Playwright not installed. Run: npm install -D playwright && npx playwright install chromium');
    process.exit(1);
  }

  const scenario = await loadSampleScenario();
  await mkdir(path.join(OUT_DIR, 'dark'), { recursive: true });
  await mkdir(path.join(OUT_DIR, 'light'), { recursive: true });

  const captures = [];

  for (const theme of ['dark', 'light']) {
    const session = buildSession(scenario, theme);
    const dir = path.join(OUT_DIR, theme);
    const hash = (route) => `${baseUrl}/#${route}`;

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: theme === 'dark' ? 'dark' : 'light',
    });
    const page = await context.newPage();
    await injectSession(page, session);

    const shots = [
      { file: '01-home.png', url: hash('/'), waitMs: 1200, note: 'Intro / hero + CTAs' },
      { file: '02-intake.png', url: hash('/intake'), waitMs: 900, note: 'Customer Intake with Chuck Robbins retail example' },
      { file: '03-analysis.png', url: hash('/analysis'), waitMs: 1500, note: 'AI interpretation results' },
      { file: '04-sources.png', url: hash('/sources'), waitMs: 1200, note: 'Data Sources grid + filters' },
      { file: '05-review.png', url: hash('/review'), waitMs: 1000, note: 'Source review table + totals' },
      { file: '06-coverage.png', url: hash('/coverage'), waitMs: 1200, note: 'Coverage gauge + domain matrix' },
      { file: '07-paths.png', url: hash('/paths'), waitMs: 1200, note: 'Architecture paths — compact compare + detail', measureScroll: true },
      { file: '08-report-overview.png', url: hash('/report'), waitMs: 1500, note: 'Report — Overview tab', fullPage: true },
      { file: '09-reference-library.png', url: hash('/reference'), waitMs: 1000, note: 'SE source reference library' },
      { file: '10-scenario-compare.png', url: hash('/compare'), waitMs: 1000, note: 'Scenario comparison (2 saved scenarios)' },
    ];

    for (const shot of shots) {
      await page.goto(shot.url, { waitUntil: 'networkidle' });
      const outPath = path.join(dir, shot.file);
      await capture(page, outPath, { fullPage: shot.fullPage, waitMs: shot.waitMs });
      if (shot.measureScroll) {
        const scroll = await page.evaluate(() => {
          const el = document.querySelector('.page-scroll--paths') || document.querySelector('.page-scroll');
          if (!el) return null;
          const depth = el.clientHeight > 0 ? el.scrollHeight / el.clientHeight : null;
          return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, depth };
        });
        if (scroll?.depth != null) {
          console.log(
            `[paths scroll] ${theme}: ${scroll.scrollHeight}px / ${scroll.clientHeight}px = ${scroll.depth.toFixed(2)}× depth`,
          );
        }
      }
      captures.push({ theme, ...shot, path: `docs/screenshots/${theme}/${shot.file}` });
    }

    // Report — additional tabs (scope to tab bar to avoid sidebar nav collision)
    await page.goto(hash('/report'), { waitUntil: 'networkidle' });
    const tabBar = page.locator('.page-viewport .border-b.border-\\[var\\(--cast-border\\)\\]').first();
    for (const tab of [
      { label: 'Sources', file: '08b-report-sources.png' },
      { label: 'Startup Guide', file: '08c-report-startup-guide.png' },
    ]) {
      await tabBar.getByRole('button', { name: tab.label, exact: true }).click();
      await capture(page, path.join(dir, tab.file), { fullPage: true, waitMs: 800 });
      captures.push({
        theme,
        file: tab.file,
        note: `Report — ${tab.label} tab`,
        path: `docs/screenshots/${theme}/${tab.file}`,
      });
    }

    await browser.close();
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    baseUrl,
    sampleScenario: scenario.id,
    captures,
  };

  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const checklist = `# Splunk Scope — Screenshot Checklist

Generated: ${manifest.generatedAt}
Viewport: **${VIEWPORT.width}×${VIEWPORT.height}** @ 100% zoom (Chrome, Mac logical pixels)
Sample data: **${scenario.label || scenario.name}** (\`${scenario.id}\`)

## Automated captures

| # | File | Route | What to verify |
|---|------|-------|----------------|
${captures
  .filter((c) => c.theme === 'dark')
  .map((c, i) => `| ${i + 1} | \`${c.path}\` | — | ${c.note || ''} |`)
  .join('\n')}

## Light mode

Same filenames under \`docs/screenshots/light/\`.

## Manual re-capture

\`\`\`bash
npm run build
npm run screenshots
\`\`\`

Or with dev server:

\`\`\`bash
npm run dev
node scripts/capture-screenshots.mjs --url http://localhost:5173 --no-preview
\`\`\`

## ChatGPT review bundle

Attach all files from \`docs/screenshots/dark/\` plus this checklist. Ask for screen-share readability at 1080p Zoom window size.
`;

  await writeFile(path.join(OUT_DIR, 'SCREENSHOT_CHECKLIST.md'), checklist);

  console.log(`\nCaptured ${captures.length} screenshots → ${OUT_DIR}`);
  console.log(`Manifest: docs/screenshots/manifest.json`);
  console.log(`Checklist: docs/screenshots/SCREENSHOT_CHECKLIST.md`);

  if (previewProc) previewProc.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
