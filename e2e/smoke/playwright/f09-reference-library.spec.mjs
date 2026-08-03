import { test, expect } from '@playwright/test';
import { beginIntake, loadExample, goToAnalysis, assertNoErrorBoundary } from './helpers/navigation.mjs';

test('F09 — Source Reference Library opens; search works', async ({ page }) => {
  await beginIntake(page);
  await loadExample(page, /Chuck Robbins/i);
  await goToAnalysis(page);

  await page.getByRole('button', { name: 'Source Reference Library' }).click();
  await page.waitForURL(/#\/reference/);
  await assertNoErrorBoundary(page);
  await expect(page.getByRole('heading', { name: 'Source Reference Library' })).toBeVisible();

  const search = page.getByPlaceholder(/Search by product/i);
  await search.fill('CrowdStrike');
  await expect(page.getByText(/EDR|CrowdStrike/i).first()).toBeVisible();
});
