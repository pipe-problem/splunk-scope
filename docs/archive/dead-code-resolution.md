# Dead Code Resolution

Audit performed as part of the engineering hardening pass.

## Decision Framework

For each file identified as dead/unused in the audit:
- **Wire**: Integrate into runtime if it serves the product mission
- **Move**: Relocate to `src/future/` if it has potential value but is not yet needed
- **Delete**: Remove if obsolete or superseded

## Resolved Files

### Deleted (follow-up improvements pass)

| File | Reason |
|------|--------|
| `TopSuggestedSources.jsx` | Never imported; workflow uses SourceGridCard scoring instead. |
| `RelevanceReviewBadge.jsx` | Only consumed by deleted TopSuggestedSources. |
| `PathCompareCard.jsx`, `PathExecutiveRisks.jsx`, `PathExecutiveValue.jsx`, `PathRoadmapLadder.jsx`, `PathSelectedSummary.jsx`, `ReadinessRing.jsx` | Orphaned plan carousel shells superseded by PathCarouselCard flow. |
| `ExecutiveSummarySection.jsx`, `ReportAccordionSection.jsx`, `ReportMetricStrip.jsx` | Orphaned report sections; ReportPage uses CustomerPlanningPackView. |
| `BudgetUtilizationBar.jsx`, `IngestBarList.jsx`, `KeywordGraph.jsx`, `MaturityScore.jsx`, `ProductRecommendationsPanel.jsx`, `ProgressRail.jsx` | Zero importers after workflow consolidation. |
| `PathBadge.jsx`, `PathBusinessValuePanel.jsx`, `PathChip.jsx`, `PathGapsPanel.jsx`, `PathIncludedPanel.jsx`, `PathReadinessGauge.jsx`, `CoverageMetricCards.jsx`, `ExportMenu.jsx`, `ExampleProfilePanel.jsx` | Orphaned UI from prior architecture-path experiments. |
| `reportEngine.js` | Superseded by inline ReportPage + customerReportDataBuilder. |
| `testHarness.js`, `services/testHarness.js`, `tests/engineTests.js` | Legacy CLI harness; Vitest (`npm test`) is canonical. |
| `config/customerTemplates.js`, `config/projectScope.js`, `utils/relevance.js` | Only referenced by deleted harness. |

### Deleted (product updates pass)

| File | Reason |
|------|--------|
| `correlationEngine.js` | Never imported; coverage narratives handled elsewhere. |
| `timeToValueEngine.js` | Never imported; feature flag unused in runtime. |
| `chartDataEngine.js` | Superseded by `chartDisplayEngine.js`. |

### Moved to `src/future/`

| File | Reason |
|------|--------|
| `gapImpactEngine.js` | Gap analysis is handled by `coverageEngine.validateMultiUseCase()` and `planEngine` gap-filling. This engine's approach was superseded. May be useful if we add quantified gap-impact scoring in the future. |
| `assumptionEngine.js` | Assumption tracking is handled inline by `sizingEngine.calculateSourceSize()` (returns `assumptions[]`). This standalone engine duplicates that responsibility. |
| `sourceRelevanceEngine.js` | Source relevance is handled by `sourceRecommendationEngine.classifySource()` and `sourceRequirementEngine.classifySourceByCapability()`. This engine's approach was superseded by capability-based classification. |
| `architectureDiagramEngine.js` | Diagram generation was never wired into any page. The `ArchitectureDiagram.jsx` component that consumed it was also orphaned. May be useful if we add visual architecture diagrams in the future. |
| `timelineEngine.js` | Timeline generation was never wired into any page. The `TimelineView.jsx` component that consumed it was also orphaned. May be useful if we add implementation timeline visualizations. |
| `sizingBenchmarks.json` | Benchmark data structure exists but was never consumed by any engine. The `sizingRates.json` file serves the active sizing pipeline. May be useful if we add benchmark comparison features. |
| `sizingRules.json` | Rule definitions were never consumed. Sizing logic lives in `sizingEngine.js` with vendor/scope multipliers. |
| `TimelineView.jsx` | Orphaned React component — no page imports it. |
| `ArchitectureDiagram.jsx` | Orphaned React component — no page imports it. |

### Wired Into Runtime (This Pass)

| File | Action |
|------|--------|
| `sourceRequirementEngine.js` | **Wired** — now imported by `sourceRecommendationEngine.classifyAndSortSources()` for capability-based classification |
| `logRequirementEngine.js` | **Wired** — consumed by `sourceRequirementEngine.js` which is now in the live classification path |
| `logRequirements.json` | **Wired** — consumed by `logRequirementEngine.js` |
| `appRequirements.json` | **Wired** — consumed by `logRequirementEngine.js` and `sourceRequirementEngine.js` |
| `dataModelRequirements.json` | **Wired** — consumed by `sourceRequirementEngine.js` for data model impact analysis |

### Unused Exports (Left In Place)

These are exports within active files that have no external callers. They remain because they are part of the module's public API and may be consumed by future features or tests:

| File | Export | Status |
|------|--------|--------|
| `sizingEngine.js` | `calculateValuePerGB` | Unused externally; kept as utility |
| `sizingEngine.js` | `sizeAllSources` | Unused externally; kept as utility |
| `sourceHierarchyEngine.js` | `hasChildren` | Unused externally; kept as utility |
| `sourceHierarchyEngine.js` | `getActiveLogOptions` | Used internally by tests; kept |
| `sourceHierarchyEngine.js` | `getLogOptionDomains` | Unused externally; kept as utility |
| `priorityEngine.js` | `getNextPriority` | Unused externally; kept as utility |
| `priorityEngine.js` | `getGapClosers` | Unused externally; kept as utility |
| `overlapEngine.js` | `getExcludedSources` | Now consumed by `sourceEligibilityEngine.js` |
