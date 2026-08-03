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

async function goToPaths(page) {
  await clearSession(page);
  await beginIntake(page);
  await loadExample(page, /Chuck Robbins/i);
  await goToAnalysis(page);
  await goToSourcesFromAnalysis(page);
  await clickContinue(page, /^Review$/i);
  await page.waitForURL(/#\/review/);
  await clickContinue(page, /^Paths$/i);
  await page.waitForURL(/#\/paths/);
  await assertNoErrorBoundary(page);
}

test('F06 — Paths: carousel, select Walk, source breakdown', async ({ page }) => {
  await goToPaths(page);

  const walkTab = page.getByRole('tab', { name: /Walk/i });
  if (await walkTab.isVisible().catch(() => false)) {
    await walkTab.click();
    await page.waitForTimeout(350);
  }

  const walkCenter = page.locator('.plan-path-card--center');
  await expect(walkCenter).toBeVisible();
  await walkCenter.scrollIntoViewIfNeeded();
  await expect(walkCenter).toContainText(/Walk/i);

  await expect(page.getByRole('button', { name: /Select for report/i })).toBeVisible();

  await page.getByRole('button', { name: /Select for report/i }).click();
  await expect(page.locator('.plan-path-card--selected')).toBeVisible();
  await expect(page.locator('.plan-path-card--selected')).toContainText(/Walk/i);
  await expect(page.getByText(/^Selected$/).first()).toBeVisible();

  await expect(page.getByRole('button', { name: /Source breakdown/i })).toBeVisible();
});
