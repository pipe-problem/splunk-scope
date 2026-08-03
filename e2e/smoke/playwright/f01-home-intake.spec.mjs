import { test, expect } from '@playwright/test';
import { beginIntake, assertNoErrorBoundary } from './helpers/navigation.mjs';

test('F01 — Home → Start → Intake', async ({ page }) => {
  await beginIntake(page);
  await expect(page.getByRole('heading', { name: 'Customer Intake' })).toBeVisible();
  await assertNoErrorBoundary(page);
});
