# Bugfix log

- **2026-06-29** — Fixed Report page crash on Ingest tab: `DonutChart is not defined` — added missing `import DonutChart from '../components/DonutChart.jsx'` in `ReportPage.jsx`.
- **2026-06-29** — Aligned `src/config/version.js` `SCHEMA_VERSION` with session `CURRENT_SCHEMA_VERSION` (5); was stale at 4.
- **2026-06-03** — Fixed `/analysis` crash: `InterpretationPage` referenced undefined `apps` in metric strip; use `result.suggestedApps.length` instead.
- **2026-06-03** — Fixed `ReportPage` `toast is not defined`: wire up `useToast()` hook where save-and-quit calls `toast.success`.
- **2026-06-03** — P2 feature-matrix e2e (`e2e/smoke/playwright/f01–f10`): Playwright harness aligned to current UI — example menu scoped to intake dropdown (avoids collision with template chips); sources search uses `Search by name, vendor, or domain` placeholder; configure drawer sets Active once (status pills toggle off on second click); session tools opened via `title="Session tools"`; scenario save scoped to tools panel; F10 returns to Intake via sidebar before loading second example. Regression: `npm run test:e2e` (13 tests, F01–F10 matrix).
