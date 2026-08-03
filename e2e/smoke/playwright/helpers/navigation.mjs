import { expect } from '@playwright/test';

export const EXAMPLE_SCENARIOS = [
  { id: 'robbins_retail_hybrid', label: /Chuck Robbins/i },
];

/** Analysis → Sources header CTA */
export const SOURCES_CONTINUE = /Begin sizing|Configure sources/i;

export async function clearSession(page) {
  await page.goto('/#/');
  await page.evaluate(() => localStorage.clear());
}

export async function assertNoErrorBoundary(page) {
  const err = page.getByRole('heading', { name: 'Something went wrong' });
  await expect(err).toHaveCount(0);
  const visible = await err.isVisible().catch(() => false);
  if (visible) {
    const detail = await page.locator('pre').first().textContent().catch(() => '');
    throw new Error(`ErrorBoundary visible${detail ? `: ${detail}` : ''}`);
  }
}

export async function beginIntake(page) {
  await page.goto('/#/');
  await assertNoErrorBoundary(page);
  await page.getByRole('button', { name: /Begin/i }).click();
  await page.waitForURL(/#\/intake/);
  await assertNoErrorBoundary(page);
}

export async function loadExample(page, labelPattern) {
  await page.getByRole('button', { name: /Load Example|Example ▾/i }).click();
  const menu = page.locator('div.absolute.right-0.top-full').first();
  await menu.getByRole('button', { name: labelPattern }).click();
  await page.waitForTimeout(300);
}

export async function goToAnalysis(page) {
  await page.getByRole('button', { name: /Continue to analysis|^Analyze$/i }).click();
  await page.waitForURL(/#\/analysis/);
  await page.getByRole('heading', { name: /Analysis|Your Splunk Scope/, level: 2 }).waitFor();
  await page.getByRole('heading', { name: /Your objectives|Splunk solutions|Priority data sources/i }).first().waitFor();
  await assertNoErrorBoundary(page);
}

export async function clickContinue(page, labelPattern) {
  await page.getByRole('button', { name: labelPattern }).first().click();
}

export async function goToSourcesFromAnalysis(page) {
  await clickContinue(page, SOURCES_CONTINUE);
  await page.waitForURL(/#\/sources/);
  await assertNoErrorBoundary(page);
}

export async function activateSource(page, searchTerm, cardPattern) {
  const search = page.getByRole('textbox', { name: /Search sources/i });
  await search.fill(searchTerm);
  await page.waitForTimeout(200);
  const card = page.locator('[data-source-id]').filter({ hasText: cardPattern }).first();
  await card.click();
  const dialog = page.getByRole('dialog').last();
  await dialog.waitFor({ timeout: 10000 });
  const numberInputs = dialog.locator('input[type="number"]');
  const count = await numberInputs.count();
  for (let i = 0; i < count; i++) {
    const input = numberInputs.nth(i);
    const val = await input.inputValue();
    if (!val || val === '0') {
      await input.fill('10');
    }
  }
  await dialog.getByRole('button', { name: /^Save$/i }).first().click();
  await page.waitForTimeout(400);
  await search.fill('');
  await page.waitForTimeout(200);
}

export async function resolveOverlapPrompts(page) {
  const prompt = page.getByText(/Overlap check|Overlap — choose primary source/i);
  if (await prompt.isVisible().catch(() => false)) {
    const btn = page.locator('.btn-secondary').first();
    if (await btn.isVisible().catch(() => false)) await btn.click();
  }
}

export async function openSessionTools(page) {
  const panel = page.getByText('Session Tools').first();
  if (!(await panel.isVisible().catch(() => false))) {
    await page.locator('button[title="Session tools"]').first().click();
  }
  await expect(panel).toBeVisible();
}

export async function saveNamedScenario(page, name) {
  await openSessionTools(page);
  await page.getByLabel('Scenario name').fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(300);
}

export async function selectPathForReport(page, pathPattern = /Walk/i) {
  await page.waitForURL(/#\/paths/);
  await assertNoErrorBoundary(page);

  const pathTab = page.getByRole('tab', { name: pathPattern });
  if (await pathTab.isVisible().catch(() => false)) {
    await pathTab.click();
    await page.waitForTimeout(350);
  }

  const centerCard = page.locator('.plan-path-card--center');
  await expect(centerCard).toBeVisible({ timeout: 15000 });
  await centerCard.scrollIntoViewIfNeeded();
  await expect(centerCard).toContainText(pathPattern);
  await page.getByRole('button', { name: /Select for report/i }).click();
  await page.waitForTimeout(300);
}

export async function runWorkflowToReport(page, { exampleLabel, pathPattern = /Walk/i } = {}) {
  await clearSession(page);
  await beginIntake(page);
  if (exampleLabel) await loadExample(page, exampleLabel);
  await goToAnalysis(page);
  await goToSourcesFromAnalysis(page);
  await clickContinue(page, /^Review$/i);
  await page.waitForURL(/#\/review/);
  await clickContinue(page, /^Paths$/i);
  await page.waitForURL(/#\/paths/);
  await selectPathForReport(page, pathPattern);
  await clickContinue(page, /^Report$/i);
  await page.waitForURL(/#\/report/);
  await assertNoErrorBoundary(page);
}
