# Splunk Scope — Screenshot Checklist

Generated: 2026-06-03T20:33:57.891Z
Viewport: **1440×900** @ 100% zoom (Chrome, Mac logical pixels)
Sample data: **Chuck Robbins Inc. — Regional Retail & Distribution** (`robbins_retail_hybrid`)

## Automated captures

| # | File | Route | What to verify |
|---|------|-------|----------------|
| 1 | `docs/screenshots/dark/01-home.png` | — | Intro / hero + CTAs |
| 2 | `docs/screenshots/dark/02-intake.png` | — | Customer Intake with Northstar example |
| 3 | `docs/screenshots/dark/03-analysis.png` | — | AI interpretation results |
| 4 | `docs/screenshots/dark/04-sources.png` | — | Data Sources grid + filters |
| 5 | `docs/screenshots/dark/05-review.png` | — | Source review table + totals |
| 6 | `docs/screenshots/dark/06-coverage.png` | — | Coverage gauge + domain matrix |
| 7 | `docs/screenshots/dark/07-paths.png` | — | Architecture paths — compact compare + detail |
| 8 | `docs/screenshots/dark/08-report-overview.png` | — | Report — Overview tab |
| 9 | `docs/screenshots/dark/09-reference-library.png` | — | SE source reference library |
| 10 | `docs/screenshots/dark/10-scenario-compare.png` | — | Scenario comparison (2 saved scenarios) |
| 11 | `docs/screenshots/dark/08b-report-sources.png` | — | Report — Sources tab |
| 12 | `docs/screenshots/dark/08c-report-startup-guide.png` | — | Report — Startup Guide tab |

## Light mode

Same filenames under `docs/screenshots/light/`.

## Manual re-capture

```bash
npm run build
npm run screenshots
```

Or with dev server:

```bash
npm run dev
node scripts/capture-screenshots.mjs --url http://localhost:5173 --no-preview
```

## ChatGPT review bundle

Attach all files from `docs/screenshots/dark/` plus this checklist. Ask for screen-share readability at 1080p Zoom window size.
