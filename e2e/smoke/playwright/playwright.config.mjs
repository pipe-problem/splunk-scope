import { defineConfig } from '@playwright/test';

const PORT = 4173;
const HOST = '127.0.0.1';

export default defineConfig({
  testDir: '.',
  testMatch: 'f*.spec.mjs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run build && npm run preview -- --host ${HOST} --port ${PORT}`,
    port: PORT,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
