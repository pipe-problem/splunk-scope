# Splunk Scope — Cursor-Assisted Import

Use this skill when the user has customer discovery notes, RFP PDFs, meeting writeups, or email threads and wants structured JSON for Splunk Scope Intake.

## Outcome

Produce **JSON only** matching Scope's import schema so the SE can paste it into **Intake → Cursor-assisted import → Process Cursor Output → Apply to Intake**.

Scope parses JSON **locally in the browser** — do not call external APIs from Scope itself.

## Workflow

1. Read customer materials (attached PDFs, pasted notes, transcripts).
2. Read allowlists from this repo before inventing IDs:
   - `src/data/useCaseProfiles.json` — exact use case names
   - `src/data/splunkApps.json` — Splunk app IDs
   - `src/data/sources.json` — flattened source catalog (`sourceId`, vendors)
   - `src/data/originalSizingRates.json` — `primaryInputField` per source
   - `src/data/goalPresets.json` — crawl/walk/run preset IDs
3. Follow the live schema from `buildCircuitExtractionPrompt()` in `src/services/circuitPromptBuilder.js`, or run:
   ```bash
   node scripts/generate-import-prompt.mjs > scope-import-prompt.txt
   ```
4. Emit JSON to `scope-import.json` (or a fenced `json` block for paste).
5. Validate before handoff:
   ```bash
   node scripts/validate-import-json.mjs scope-import.json
   ```
6. Fix all validation warnings; re-run until clean or explain residual review items to the SE.

## Schema highlights (v7)

| Field | Rules |
|-------|--------|
| `aiSummary.useCaseAssessment` | 2–3 sentences on likely customer need |
| `aiSummary.recommendedSplunkCapabilities` | Short bullets (ES, ITSI, CIM, SOAR, etc.) |
| `aiSummary.recommendedAppIds` | IDs from `splunkApps.json` only |
| `dataSources[].sourceId` | Must match catalog when known |
| `dataSources[].confidence` | `high` \| `medium` \| `low` |
| `dataSources[].count` | Numeric only when explicitly stated in notes |
| `dataSources[].inputs` | Optional; keys match catalog `input_fields` / `primaryInputField` |
| `dataSources[].skipReason` | Required when not `high` or count is vague |

### Confidence rules (strict)

- **`high`** — explicit count + valid `sourceId` + vendor matches catalog options when required → Scope can auto-apply to Sources page
- **`medium`** — plausible mapping but SE should confirm in preview (unchecked by default)
- **`low`** — vague hints only; include `skipReason`; never set `high` without explicit counts

## Examples

See `examples.md` in this skill folder for Placer-style and Arcadia-style fixtures.

## Privacy

Customer content stays in Cursor during extraction. Only structured JSON is pasted into Scope.
