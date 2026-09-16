# Cursor-Assisted Structured Import

**Added:** 2026-06-23 (schema v5); **Cursor rebrand + sources pre-fill:** 2026-08-12 (schema v7)  
**Status:** Active — replaces Circuit-assisted import label on Intake

## Summary

Splunk Scope does **not** call OpenAI, Anthropic, Azure OpenAI, or any external LLM API. Structured intake uses a **Cursor-assisted workflow**:

1. SE copies a generated prompt from Scope (or uses the repo skill below).
2. SE attaches customer notes or PDFs in **Cursor**.
3. Cursor returns **JSON** matching Scope's schema.
4. SE pastes JSON into Scope and clicks **Process Cursor Output**.
5. SE reviews intake preview, optional **Sources to apply** checkboxes, and **Apply to Intake**.

All parsing after paste runs **locally in the browser**. Customer content only transits Cursor when the SE chooses to use it there—not through Scope's network stack.

## How to use the project skill

1. Open this repo in Cursor.
2. Attach customer PDFs or paste discovery notes in chat.
3. Ask the agent to use the **`splunk-scope-import`** skill (`.cursor/skills/splunk-scope-import/SKILL.md`).
4. Save or copy the resulting JSON; optionally validate:
   ```bash
   node scripts/validate-import-json.mjs scope-import.json
   ```
5. Paste into Scope **Intake → Cursor-assisted import → Process Cursor Output**. In the preview, check sources to apply, **edit counts and vendors inline**, then **Apply to Intake**.

Regenerate the copyable prompt after catalog changes (prompt embeds **splunk-scope-import** skill instructions):

```bash
node scripts/generate-import-prompt.mjs > scope-import-prompt.txt
```

## Revert / rollback

| Layer | How to revert |
|-------|----------------|
| **Git** | Revert commits for Cursor-assisted import (search CHANGELOG). |
| **Session data** | Schema v7 adds `intake.aiImportSummary`; v6 sessions auto-migrate on load. Export sessions before testing if you need a frozen snapshot. |
| **UX** | Unstructured fallback remains under **Edit advanced intake fields → pattern matching**. |
| **Legacy goals** | Freeform `crawlGoal` / `walkGoal` / `runGoal` are preserved in `discoveryNotes` on migration, not deleted. |

## Files added or changed

| File | Role |
|------|------|
| `src/data/goalPresets.json` | Crawl / Walk / Run preset library |
| `src/utils/goalPresets.js` | Preset resolution for engines and exports |
| `src/services/circuitPromptBuilder.js` | Copyable Cursor prompt + allowlists + source catalog appendix |
| `src/services/circuitResponseProcessor.js` | JSON parse, validate, map to intake + sources |
| `src/services/importSourceMapper.js` | Count→primaryField mapping, vendor validation, confidence gating |
| `src/services/intakeImportHelpers.js` | Shared app/source/deployment matching |
| `src/pages/IntakePage.jsx` | Cursor workflow UI, AI summary card, source apply preview |
| `src/services/sessionMigrationEngine.js` | Schema v7 migration (`aiImportSummary`) |
| `src/context/AppContext.jsx` | `APPLY_IMPORTED_SOURCES`, `aiImportSummary` on intake |
| `scripts/generate-import-prompt.mjs` | Regenerate prompt text |
| `scripts/validate-import-json.mjs` | CLI validation before paste |
| `.cursor/skills/splunk-scope-import/` | Project Cursor skill + examples |
| `src/services/circuit.test.js` | Vitest coverage for import flow |

## Intake fields (schema v7)

| Field | Type | Notes |
|-------|------|-------|
| `aiImportSummary` | object \| null | Use case assessment + recommended capabilities/apps after apply |
| `crawlGoalPresetId` | string | ID from `goalPresets.json` |
| `walkGoalPresetId` | string | ID from `goalPresets.json` |
| `runGoalPresetId` | string | ID from `goalPresets.json` |
| `sourceHints` | array | Low/medium confidence or unmapped sources |
| `crawlGoal` / `walkGoal` / `runGoal` | string | Legacy freeform — kept for old sessions |

Applied import sources merge into `state.sources` via `APPLY_IMPORTED_SOURCES` (high-confidence rows checked by default in preview).

## Cursor JSON schema

See `buildCircuitExtractionPrompt()` in `circuitPromptBuilder.js` for the live schema. Key rules:

- `deploymentType`: `cloud` | `onprem` | `hybrid` | `unknown`
- `splunkApps`: array of **app IDs** from `splunkApps.json`
- `primaryUseCases` / `secondaryUseCases`: exact names from `useCaseProfiles.json`
- Goal fields: preset IDs only (`crawlGoalPresetId`, etc.)
- `budget`: numeric USD only when explicitly stated
- `aiSummary`: assessment + capability bullets + `recommendedAppIds`
- `dataSources[].confidence`: only `high` when count and mapping are explicit in notes

## Default presets when unsure

| Phase | Default ID |
|-------|------------|
| Crawl | `crawl_foundational_visibility` |
| Walk | `walk_expand_correlation` |
| Run | `run_optimize_and_mature` |

## Testing

```bash
npm test          # includes circuit.test.js, importSourceMapper.test.js
node scripts/validate-import-json.mjs path/to/fixture.json
npm run build
```

## Wording (product copy)

Use:

- Cursor-assisted import
- Structured import
- Process Cursor output
- Pattern-matching fallback

Avoid:

- "Scope AI extraction"
- "AI-powered intake" (unless clarifying Cursor is external and user-driven)

## Privacy model

| Path | Customer data leaves browser? |
|------|------------------------------|
| Manual intake | No |
| Cursor workflow | Only if SE uses Cursor with customer materials |
| Pattern-matching fallback | No |
| Session export/import | User-controlled file |
