# Splunkbase Catalog Methodology

Splunk Scope maintains a **canonical Splunkbase URL catalog** at `src/data/splunkbaseCatalog.json`. All customer-facing Splunkbase links resolve through this file — not duplicated raw URLs in app data.

## Why this exists

Splunkbase numeric app IDs are **not stable forever**. IDs can be recycled to unrelated listings, causing 404s or wrong-app links in customer PDFs and the Source Library. This catalog enforces:

1. HTTP validation before marking a link `verified`
2. Deprecation / replacement tracking
3. A single source of truth for URLs

## File layout

| File | Purpose |
|------|---------|
| `src/data/splunkbaseCatalog.seed.json` | Human-edited seed entries (names, IDs, mappings, notes) |
| `src/data/splunkbaseCatalog.json` | Generated catalog (validated by refresh script) |
| `src/services/splunkbaseCatalog.js` | Runtime resolver (UI + exports) |
| `scripts/refreshSplunkbaseCatalog.js` | Re-validates seed + writes catalog + reports |
| `scripts/validateSplunkbaseCatalog.js` | Structural checks (+ optional `--live` HTTP re-check) |
| `scripts/lib/splunkbaseValidator.mjs` | Shared HTTP validation logic |
| `docs/SPLUNKBASE_CATALOG_REPORT.md` | Human-readable refresh summary |
| `docs/splunkbase-catalog-validation.json` | Machine-readable validation output |

## Status values

| Status | Meaning | Customer-facing behavior |
|--------|---------|--------------------------|
| `verified` | HTTP 200, title matches, canonical URL | Show Splunkbase link |
| `needsReview` | Missing ID, 404, title mismatch, or network error | Show **"Link needs validation"** — no raw URL |
| `deprecated` | Listing explicitly deprecated | Do not recommend; use `replacementId` if set |
| `replacementPreferred` | Deprecated with a validated replacement | Show replacement URL (e.g. Duo → Cisco Security Cloud) |

## Validation rules (verified)

A URL is marked `verified` only when:

- HTTP status is **200**
- Final URL is `https://splunkbase.splunk.com/app/<id>`
- Page H1/title matches expected name (score ≥ 0.45, including aliases)
- App ID in URL matches `splunkbaseAppId`
- Page is not a 404 or unrelated listing

If any check fails → `needsReview` with reason in `notes`.

## How URLs are discovered

1. **Seed list** — curated major Splunk/Cisco/partner apps in `splunkbaseCatalog.seed.json`
2. **App data references** — `catalogId` in `technicalAddons.json` and `splunkApps.json`
3. **Manual research** — Splunk docs, official Splunkbase search, vendor pages (never guess IDs)

Priority for new entries:

1. Splunk LLC official listings
2. Cisco Systems, Inc.
3. Official Splunk partners / vendor-supported
4. Community only when no official option exists

## How to add a new app/add-on

1. Add an entry to `src/data/splunkbaseCatalog.seed.json` with:
   - Stable `id` (snake_case)
   - Exact Splunkbase listing title
   - `splunkbaseAppId` (if known)
   - `type`, `vendor`, `sourceFamilies`, `relatedSourceIds`
2. Run `npm run refresh:splunkbase` (requires network)
3. Confirm status in `docs/SPLUNKBASE_CATALOG_REPORT.md`
4. Add `catalogId` to `technicalAddons.json` or `splunkApps.json` — **do not** add `splunkbaseId`
5. Run `npm run validate:splunkbase` and `npm test`

## How to refresh the catalog

```bash
npm run refresh:splunkbase
npm run validate:splunkbase
```

Optional live re-check of all non-`needsReview` entries:

```bash
node scripts/validateSplunkbaseCatalog.js --live
```

## App / source mapping

Map entries conservatively in seed `sourceFamilies` and `relatedSourceIds`. Only map when the TA clearly applies to that source family.

Example: `ta_windows` → families `Server`, `End-User Support`; sources `windows_servers`, `active_directory`, `dns`.

## Customer export rules

- PDF, PPTX, source briefs, Startup Guide, and Source Library use `resolveSplunkbaseLink()` / `getSplunkbaseUrl()`
- Only `verified` URLs (or `replacementPreferred` with verified replacement) appear as clickable links
- `needsReview` → text label only, no broken URL
- `deprecated` → never recommended unless no replacement exists

## Deprecated apps

When Splunkbase shows deprecation language (`deprecated`, `migrate to`, `replacement`):

- Set `status` to `deprecated` or `replacementPreferred`
- Set `replacementId` to the catalog ID of the validated replacement
- Do not mark the old listing `verified` for new deployments

## Community / unsupported apps

Community listings are included only when no official Splunk or vendor TA exists. Mark clearly in `vendor` and `notes`. Prefer official Splunk-built TAs (e.g. Okta 6553 over community 3682).

## Anti-patterns

- Do **not** hardcode Splunkbase URLs in UI, exports, or JSON data files
- Do **not** mark `verified` without running the refresh script
- Do **not** reuse stale numeric IDs from old spreadsheets — Splunkbase recycles IDs
- Do **not** show 404 or wrong-app links in customer materials
