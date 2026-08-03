#!/usr/bin/env node
/**
 * Playwright smoke: Home → Intake → Analysis → Sources (empty intake + example scenario).
 * Run: npm run test:smoke
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173';
const HASH = (route) => `${BASE}/#${route}`;

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server not ready at ${url} after ${timeoutMs}ms`));
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function assertNoErrorBoundary(page) {
  const err = page.locator('text=Something went wrong');
  if (await err.isVisible().catch(() => false)) {
    const detail = await page.locator('pre').textContent().catch(() => '');
    throw new Error(`ErrorBoundary visible${detail ? `: ${detail}` : ''}`);
  }
}

async function walkHappyPath(page, { loadExampleLabel } = {}) {
  await page.goto(HASH('/'));
  await assertNoErrorBoundary(page);
  await page.getByRole('button', { name: /Begin/i }).click();
  await page.waitForURL(/#\/intake/);

  if (loadExampleLabel) {
    await page.getByRole('button', { name: /Load Example|Example ▾/i }).click();
    await page.getByRole('button', { name: loadExampleLabel }).click();
  }

  await assertNoErrorBoundary(page);
  await page.getByRole('button', { name: /Continue to analysis/i }).click();
  await page.waitForURL(/#\/analysis/);
  await page.getByText('Your objectives').waitFor({ timeout: 10000 });
  await assertNoErrorBoundary(page);

  await page.getByRole('button', { name: /Begin sizing|Size these sources|Configure sources/i }).first().click();
  await page.waitForURL(/#\/sources/);
  await page.getByRole('heading', { name: 'Data Sources' }).waitFor({ timeout: 10000 });
  await assertNoErrorBoundary(page);
}

async function main() {
  const ownServer = !process.env.SMOKE_BASE_URL;
  let devProc;

  if (ownServer) {
    devProc = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
      cwd: ROOT,
      stdio: 'pipe',
      env: { ...process.env, BROWSER: 'none' },
    });
    devProc.stdout?.on('data', () => {});
    devProc.stderr?.on('data', () => {});
    await waitForServer(BASE);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  try {
    const page = await context.newPage();
    page.on('pageerror', (err) => {
      throw new Error(`Uncaught page error: ${err.message}`);
    });

    console.log('Smoke: empty intake path…');
    await walkHappyPath(page);

    console.log('Smoke: robbins_retail_hybrid example…');
    await page.goto(HASH('/'));
    await page.evaluate(() => localStorage.clear());
    await walkHappyPath(page, { loadExampleLabel: /Chuck Robbins/i });

    console.log('Smoke: PASS');
  } finally {
    await browser.close();
    if (devProc) {
      devProc.kill('SIGTERM');
    }
  }
}

main().catch((err) => {
  console.error('Smoke: FAIL', err.message);
  process.exit(1);
});
