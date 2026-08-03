import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runWorkflowToReport, clearSession, assertNoErrorBoundary } from './helpers/navigation.mjs';

test('F08 — Save session JSON → Home → Resume → same step + data', async ({ page }) => {
  await runWorkflowToReport(page, { exampleLabel: /Chuck Robbins/i });
  const customer = await page.locator('text=Chuck Robbins').first().textContent().catch(() => 'Chuck Robbins');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Save and Quit/i }).click();
  const download = await downloadPromise;
  const tmpPath = path.join(os.tmpdir(), `splunk-scope-e2e-${Date.now()}.json`);
  await download.saveAs(tmpPath);
  expect(fs.statSync(tmpPath).size).toBeGreaterThan(200);

  await clearSession(page);
  await page.goto('/#/');
  await assertNoErrorBoundary(page);

  await page.locator('input[type="file"]').setInputFiles(tmpPath);
  await page.waitForURL(/#\/report/);
  await assertNoErrorBoundary(page);
  await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible();
  if (customer) {
    await expect(page.getByText(/Chuck Robbins/i).first()).toBeVisible();
  }

  fs.unlinkSync(tmpPath);
});
