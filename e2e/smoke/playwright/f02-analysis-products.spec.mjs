import { test, expect } from '@playwright/test';
import { beginIntake, loadExample, goToAnalysis, assertNoErrorBoundary } from './helpers/navigation.mjs';

test('F02 — Intake → Analyze → Analysis renders ProductRecommendationsPanel', async ({ page }) => {
  await beginIntake(page);
  await loadExample(page, /Chuck Robbins/i);
  await goToAnalysis(page);
  await expect(page.getByRole('heading', { name: 'Splunk solutions' })).toBeVisible();
  const panel = page.getByText(/Enterprise Security|Mission Control|Requested|Suggested/i);
  await expect(panel.first()).toBeVisible();
  await assertNoErrorBoundary(page);
});
