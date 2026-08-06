# Contributing to Splunk Scope

Splunk Scope is a local React/Vite workshop app for Splunk Solutions Engineers. This guide covers setup, testing, catalog maintenance, and releases.

---

## Prerequisites

- **Node.js 20+** and npm
- **Git** access to [pipe-problem/splunk-scope](https://github.com/pipe-problem/splunk-scope) (private — request collaborator access)
- Optional: sibling folder **`../splunk-scope-reference/`** for generated spreadsheets and validation reports (see [`docs/DOC_INDEX.md`](docs/DOC_INDEX.md))

---

## Quick start

```bash
git clone https://github.com/pipe-problem/splunk-scope.git
cd splunk-scope
npm install
npm run build    # verify clone is complete
npm run dev      # http://localhost:5173
```

---

## Project layout

| Path | Role |
|------|------|
| [`src/pages/`](src/pages/) | Workflow screens (Intake, Analysis, Sources, Report, …) |
| [`src/components/`](src/components/) | Reusable UI |
| [`src/services/`](src/services/) | Business logic engines (sizing, coverage, recommendations) |
| [`src/data/`](src/data/) | JSON catalogs — see [`src/data/README.md`](src/data/README.md) |
| [`docs/`](docs/) | Product and engineering documentation — see [`docs/README.md`](docs/README.md) |
| [`scripts/`](scripts/) | Catalog validators and doc generators — see [`scripts/README.md`](scripts/README.md) |
| [`e2e/`](e2e/) | Playwright smoke tests — see [`e2e/README.md`](e2e/README.md) |

---

## Development commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smoke (F01–F10) |
| `npm run lint` | ESLint |
| `npm run validate:catalog` | Validate `sources.json` and content rules |
| `npm run validate:measurement` | Audit measurement question coverage |
| `npm run validate:splunkbase` | Audit Splunkbase link IDs |

---

## Editing catalogs

1. Read [`src/data/README.md`](src/data/README.md) for which file owns which concern.
2. Read [`docs/SIZING_METHODOLOGY.md`](docs/SIZING_METHODOLOGY.md) before changing rates or formulas.
3. Run `npm run validate:catalog` after editing `sources.json`.
4. Run `npm test` — engine tests catch regressions in sizing and recommendations.
5. Update `catalogVersion.json` `changeSummary` when shipping catalog changes.

---

## Documentation

- **End users (SEs):** [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)
- **Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Full index:** [`docs/DOC_INDEX.md`](docs/DOC_INDEX.md)
- **Releases:** [`CHANGELOG.md`](CHANGELOG.md) and [`docs/VERSIONING.md`](docs/VERSIONING.md)

When you change user-visible behavior, update the User Guide and add a CHANGELOG entry in the same PR.

---

## Pull requests and releases

1. Branch from `main`, make focused changes.
2. Run `npm test` and `npm run build` locally.
3. Update CHANGELOG under `[Unreleased]` or the target version section.
4. Follow the release checklist in [`docs/VERSIONING.md`](docs/VERSIONING.md) before merging version bumps to `main`.

---

## Questions

Open a [GitHub issue](https://github.com/pipe-problem/splunk-scope/issues) for bugs or enhancement ideas.
