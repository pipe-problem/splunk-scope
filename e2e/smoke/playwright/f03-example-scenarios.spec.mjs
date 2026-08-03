import { test, expect } from '@playwright/test';
import { EXAMPLE_SCENARIOS, runWorkflowToReport, assertNoErrorBoundary } from './helpers/navigation.mjs';

for (const scenario of EXAMPLE_SCENARIOS) {
  test(`F03 — ${scenario.id}: example workflow through Report`, async ({ page }) => {
    await runWorkflowToReport(page, { exampleLabel: scenario.label });
    await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Overview|Sources|Startup Guide/i }).first()).toBeVisible();
    await assertNoErrorBoundary(page);
  });
}
