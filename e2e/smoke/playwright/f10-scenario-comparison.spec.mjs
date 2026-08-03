import { test, expect } from '@playwright/test';
import {
  beginIntake,
  loadExample,
  goToAnalysis,
  saveNamedScenario,
  openSessionTools,
  assertNoErrorBoundary,
} from './helpers/navigation.mjs';

test('F10 — Scenario Comparison with 2 saved scenarios', async ({ page }) => {
  await beginIntake(page);
  await loadExample(page, /Chuck Robbins/i);
  await goToAnalysis(page);
  await saveNamedScenario(page, 'E2E Scenario A');

  await page.locator('.sidebar-desktop button[title="Intake"]').click();
  await page.waitForURL(/#\/intake/);
  await loadExample(page, /Chuck Robbins/i);
  await goToAnalysis(page);
  await saveNamedScenario(page, 'E2E Scenario B');

  await openSessionTools(page);
  await page.getByRole('button', { name: /Compare Scenarios/i }).click();
  await page.waitForURL(/#\/compare/);
  await assertNoErrorBoundary(page);

  await expect(page.getByRole('heading', { name: 'Scenario Comparison' })).toBeVisible();
  await expect(page.getByText(/Compare ingest, coverage/i)).toBeVisible();
  await expect(page.getByText(/GB\/day|Coverage|sources/i).first()).toBeVisible();
});
