# Circuit-Assisted Structured Import

**Added:** 2026-06-23 (schema v5)  
**Status:** Active — replaces misleading "AI-assisted extraction" label on Intake

## Summary

Splunk Scope does **not** call OpenAI, Anthropic, Azure OpenAI, or any external LLM API. Structured intake uses a **Circuit-assisted workflow**:

1. SE copies a generated prompt from Scope into **Cisco Circuit** (internal AI).
2. SE pastes customer notes into Circuit.
3. Circuit returns **JSON** matching Scope's schema.
4. SE pastes JSON into Scope and clicks **Process Circuit Output**.
5. SE reviews the preview and clicks **Apply to Intake**.

All parsing after paste runs **locally in the browser**. Customer content only transits Circuit when the SE chooses to use it there—not through Scope's network stack.

## Revert / rollback

| Layer | How to revert |
|-------|----------------|
| **Git** | Revert the commit(s) that introduced Circuit import (search CHANGELOG for "Circuit-assisted"). |
| **Session data** | Schema v5 adds optional fields; v4 sessions auto-migrate on load. Export sessions before testing if you need a frozen snapshot. |
| **UX** | Unstructured fallback remains under **Edit advanced intake fields → pattern matching**. |
| **Legacy goals** | Freeform `crawlGoal` / `walkGoal` / `runGoal` are preserved in `discoveryNotes` on migration, not deleted. |

## Files added or changed

| File | Role |
|------|------|
| `src/data/goalPresets.json` | 30 Crawl / 30 Walk / 30 Run preset library |
| `src/utils/goalPresets.js` | Preset resolution for engines and exports |
| `src/services/circuitPromptBuilder.js` | Copyable Circuit prompt + allowlists |
| `src/services/circuitResponseProcessor.js` | JSON parse, validate, map to intake |
| `src/services/intakeImportHelpers.js` | Shared app/source/deployment matching |
| `src/pages/IntakePage.jsx` | Circuit workflow UI + manual essentials |
| `src/services/sessionMigrationEngine.js` | Schema v5 migration |
| `src/context/AppContext.jsx` | New intake fields |
| `src/services/circuit.test.js` | Vitest coverage for Circuit flow |

## Intake fields (schema v5)

| Field | Type | Notes |
|-------|------|-------|
| `crawlGoalPresetId` | string | ID from `goalPresets.json` |
| `walkGoalPresetId` | string | ID from `goalPresets.json` |
| `runGoalPresetId` | string | ID from `goalPresets.json` |
| `sourceHints` | array | Structured source hints from Circuit |
| `crawlGoal` / `walkGoal` / `runGoal` | string | Legacy freeform — kept for old sessions |

Engines resolve preset IDs to `internalMeaning` for scoring and `customerFacingText` for reports.

## Circuit JSON schema

See `buildCircuitExtractionPrompt()` in `circuitPromptBuilder.js` for the live schema embedded in the copyable prompt. Key rules for Circuit:

- `deploymentType`: `cloud` | `onprem` | `hybrid` | `unknown`
- `splunkApps`: array of **app IDs** from `splunkApps.json`
- `primaryUseCases` / `secondaryUseCases`: exact names from `useCaseProfiles.json`
- Goal fields: preset IDs only (`crawlGoalPresetId`, etc.)—not freeform goal prose
- `budget`: numeric USD only when explicitly stated

## Default presets when unsure

| Phase | Default ID |
|-------|------------|
| Crawl | `crawl_foundational_visibility` |
| Walk | `walk_expand_correlation` |
| Run | `run_optimize_and_mature` |

## Testing

```bash
npm test          # includes src/services/circuit.test.js
npm run build
```

## Wording (product copy)

Use:

- Circuit-assisted extraction
- Structured import
- Process Circuit output
- Pattern-matching fallback

Avoid:

- "Scope AI extraction"
- "AI-powered intake" (unless clarifying Circuit is external and user-driven)

## Privacy model

| Path | Customer data leaves browser? |
|------|------------------------------|
| Manual intake | No |
| Circuit workflow | Only if SE pastes into Circuit (Cisco internal tool) |
| Pattern-matching fallback | No |
| Session export/import | User-controlled file |
