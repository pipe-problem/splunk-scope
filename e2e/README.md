# End-to-end tests

Playwright smoke tests cover the main workshop workflow. Legacy Node smoke tests also exist under `tests/smoke/`.

---

## Playwright (primary)

**Command:** `npm run test:e2e`

**Config:** [`e2e/smoke/playwright/playwright.config.mjs`](smoke/playwright/playwright.config.mjs)

**Specs** (F01–F10):

| Spec | Flow exercised |
|------|----------------|
| `f01-home-intake.spec.mjs` | Home → Intake essentials |
| `f02-analysis-products.spec.mjs` | Analysis product suggestions |
| `f03-example-scenarios.spec.mjs` | Load Example scenario |
| `f04-sources-review.spec.mjs` | Sources configure → Review |
| `f05-coverage-buffer.spec.mjs` | Coverage buffer controls |
| `f06-paths-walk.spec.mjs` | Architecture Paths carousel |
| `f07-report-exports.spec.mjs` | Report export actions |
| `f08-session-resume.spec.mjs` | Session export/import |
| `f09-reference-library.spec.mjs` | Source Reference Library |
| `f10-scenario-comparison.spec.mjs` | Scenario comparison |

**Helpers:** [`smoke/playwright/helpers/navigation.mjs`](smoke/playwright/helpers/navigation.mjs)

### First-time setup

```bash
npm install
npx playwright install chromium
npm run build
npm run test:e2e
```

CI runs Playwright on every push to `main` (see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

---

## Legacy smoke test

**Command:** `npm run test:smoke`

**File:** [`tests/smoke/navigation.spec.mjs`](../tests/smoke/navigation.spec.mjs)

Lightweight navigation checks without Playwright. Prefer `test:e2e` for workflow coverage; keep `test:smoke` for quick local sanity checks.

---

## Unit tests

Engine and component logic: **`npm test`** (Vitest, co-located under `src/`).
