# Versioning

Splunk Scope uses **semantic versioning** (`MAJOR.MINOR.PATCH`) for the application. The canonical version lives in [`package.json`](../package.json) and is mirrored in:

| Location | Purpose |
|----------|---------|
| [`src/config/version.js`](../src/config/version.js) | In-app footer and export metadata (`APP_VERSION`, `RELEASE_NAME`) |
| [`src/data/catalogVersion.json`](../src/data/catalogVersion.json) | Catalog governance (`appVersion`, dataset sub-versions, `lastUpdated`) |
| [`README.md`](../README.md) footer | Clone/install reference |
| [`CHANGELOG.md`](../CHANGELOG.md) | Release history |

Session persistence uses a separate **schema version** (`SCHEMA_VERSION` in `version.js`, from `sessionMigrationEngine.js`). Bump the session schema only when intake or source state shape changes require migration.

---

## When to bump

| Change type | Bump | Example |
|-------------|------|---------|
| Bug fix, copy tweak, doc-only | **PATCH** | 2.0.1 → 2.0.2 |
| New feature, new sizing panel, workflow step | **MINOR** | 2.0.1 → 2.1.0 |
| Breaking session format or removed workflow | **MAJOR** | 2.x → 3.0.0 |

Catalog JSON files (`sources.json`, `sizingRates.json`, etc.) have their own sub-version fields in `catalogVersion.json`. Update `changeSummary` when you materially change catalog data.

---

## Release checklist

1. Implement and test the change (`npm test`, `npm run build`).
2. Add an entry under **`[Unreleased]`** in [`CHANGELOG.md`](../CHANGELOG.md) (or write directly under a new version heading).
3. Bump `package.json` `version` to the new semver.
4. Sync mirrors:
   - `APP_VERSION` and `RELEASE_NAME` in `src/config/version.js`
   - `appVersion` and `lastUpdated` in `src/data/catalogVersion.json`
   - README footer `**Version X.Y.Z**`
5. Update user-facing docs if behavior changed ([`USER_GUIDE.md`](./USER_GUIDE.md), [`PROJECT_SCOPE.md`](./PROJECT_SCOPE.md)).
6. Commit, push to `main`, and tag optionally: `git tag v2.0.1`.

---

## Current release

**2.0.1** — Pre-intake Sources UX (no relevance scores until intake entered) and documentation refresh.

See [`CHANGELOG.md`](../CHANGELOG.md) for full history.
