import { test, expect } from '@playwright/test';
import {
  clearSession,
  beginIntake,
  loadExample,
  goToAnalysis,
  goToSourcesFromAnalysis,
  clickContinue,
  assertNoErrorBoundary,
} from './helpers/navigation.mjs';

async function goToCoverage(page) {
  await clearSession(page);
  await beginIntake(page);
  await loadExample(page, /Chuck Robbins/i);
  await goToAnalysis(page);
  await goToSourcesFromAnalysis(page);
  await clickContinue(page, /^Review$/i);
  await page.waitForURL(/#\/review/);
  // Coverage is archived from the main workflow nav; route remains available for direct access.
  await page.goto('/#/coverage');
  await page.waitForURL(/#\/coverage/);
  await assertNoErrorBoundary(page);
}

test('F05 — Coverage: domains score; fixed 20% planning contingency', async ({ page }) => {
  await goToCoverage(page);

  await expect(page.getByRole('heading', { name: 'Coverage Analysis' })).toBeVisible();
  await expect(page.getByText('Telemetry Domains')).toBeVisible();
  await expect(page.getByText(/Total configured source ingest/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '30%' })).toHaveCount(0);
});
