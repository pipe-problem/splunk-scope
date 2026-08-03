import { test, expect } from '@playwright/test';
import {
  beginIntake,
  clickContinue,
  activateSource,
  assertNoErrorBoundary,
  resolveOverlapPrompts,
  goToSourcesFromAnalysis,
} from './helpers/navigation.mjs';

test('F04 — Sources: configure AD+firewall+EDR; Review Sources tab populates', async ({ page }) => {
  await beginIntake(page);
  await page.getByRole('button', { name: /Continue to analysis/i }).click();
  await page.waitForURL(/#\/analysis/);
  await goToSourcesFromAnalysis(page);

  await activateSource(page, 'Active Directory', /Active Directory/i);
  await activateSource(page, 'Firewall', /Firewalls/i);
  await activateSource(page, 'EDR', /EDR/i);
  await resolveOverlapPrompts(page);

  await clickContinue(page, /^Review$/i);
  await page.waitForURL(/#\/review/);
  await assertNoErrorBoundary(page);

  await expect(page.getByText(/Total configured source ingest/i)).toBeVisible();

  await page.getByRole('tab', { name: /^Sources/i }).click();

  const sourcesPanel = page.getByRole('tabpanel').first();
  await expect(sourcesPanel.getByText(/Active Directory/i).first()).toBeVisible();
  await expect(sourcesPanel.getByText(/Firewalls/i).first()).toBeVisible();
  await expect(sourcesPanel.getByText(/EDR/i).first()).toBeVisible();
});
