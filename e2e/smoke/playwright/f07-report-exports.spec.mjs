import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { runWorkflowToReport, assertNoErrorBoundary } from './helpers/navigation.mjs';

test('F07 — Report: single proposition pack zip download', async ({ page }) => {
  await runWorkflowToReport(page, { exampleLabel: /Chuck Robbins/i });
  await assertNoErrorBoundary(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download Proposition Pack/i }).click(),
  ]);

  const name = download.suggestedFilename();
  expect(name).toMatch(/Chuck_Robbins.*_splunk_proposition\.zip$/i);
  expect(name).not.toMatch(/customer/i);

  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  expect(fs.statSync(filePath).size).toBeGreaterThan(500);
});
