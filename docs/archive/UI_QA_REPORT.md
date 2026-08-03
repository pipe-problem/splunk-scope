# Splunk Scope — UI QA Report (Screen-Share Readability Pass)

**Date:** 2026-06-01  
**Version:** 2.0.0  
**Viewports reviewed:** 1366×768, 1440×900, 1512×982 (MacBook), 1920×1080 (browser devtools + Zoom share simulation)

## Summary

This pass optimizes Splunk Scope for live SE screen sharing on Zoom/Teams: larger base typography, improved muted-text contrast, softer light mode, conservative source recommendations, customer-safe copy, and cleaner report/export credibility.

## Screen-share QA matrix

| Viewport | Zoom legibility | Notes |
|----------|-----------------|-------|
| **1366×768** | Good | Minimum supported width; table text readable; path cards stack vertically; chart legends use `chart-legend-text` |
| **1440×900** | Excellent | Primary SE laptop target; Top Suggested (max 6) visible without scroll on Data Sources |
| **1512×982** | Excellent | MacBook Pro default; report hero metrics and coverage gauge readable at arm's length |
| **1920×1080** | Excellent | Shared 1080p stream; body ~17px; tab labels and table rows comfortable for remote viewers |

## Typography & contrast

| Token | Before | After |
|-------|--------|-------|
| `--text-body` | 0.8125rem (13px) | 1.0625rem (~17px) |
| `--text-page-title` | 1rem | 1.375rem |
| `--text-label` | 0.6875rem | 0.875rem |
| Muted text (dark) | `#737373` | `#A3A3A3` |
| Primary/secondary buttons | compact | min-height 44px, body font |

Additional classes: `.text-table`, `.chart-legend-text` for tables and donut legends.

## Light mode

- Background: `#E8E8ED` (off-white, not pure white)
- Panels: `#F2F2F6` / `#ECECF1`
- Text secondary adjusted for readable contrast on soft gray backgrounds
- Status accents (pink/orange/yellow/green) verified on cards, charts, and badges

## Page-by-page notes

| Page | Changes |
|------|---------|
| **Home / Intro** | Larger body text; Resume & Import unchanged |
| **Customer Intake** | Example scenarios; customer-safe profile copy |
| **Analysis** | Removed internal "For the SE" wording; advanced details collapsed |
| **Data Sources** | Top Suggested max 6 with specific reasons; distinct "Not configured" vs 0 GB/day; fewer chips |
| **Source Review** | Default: configured only; toggle for unconfigured; larger table; Label column |
| **Coverage Analysis** | SIEM-focused default domains; top 3 use cases; customer domain labels; top 5 gap suggestions |
| **Architecture Paths** | Path deltas vs previous path; smaller donuts; larger card text |
| **Report Overview** | Value delivered section; fixed duplicate GB/day; chart explanation copy |
| **Report Sources** | Configured-first sort; hide unconfigured 0 GB/day toggle |
| **Report Startup Guide** | Part 1 Year-One Plan + Part 2 Week 1–3 technical setup |
| **Source Reference Library** | Alias search (login logs, firewall traffic); larger text; priority score behind details |
| **Scenario Comparison** | What changed summary; hide unchanged domains; overlap-aware metrics |

## Report header (acceptance)

1. **Export** — Value Proposal PDF, Value Proposal PPTX, Startup Guide PDF  
2. **Back**  
3. **Save and Quit**

## Customer-facing visibility

- Budget: SE-only; excluded from PDF/PPTX/brief exports  
- Confidence score: hidden on Report Sources tab and export payloads  
- Needs Review: visible where sizing or configuration is incomplete  
- Prohibited wording stripped from exports (POC/POV/guaranteed/official sizing/internal guidance)

## Export credibility checks

- No duplicated `GB/day GB/day` in executive summary or PDF ranges  
- No `[object Object]` in export payloads  
- Source count consistent: selected path configured sources  
- Unconfigured 0 GB/day sources excluded from customer exports by default  

## Remaining follow-ups (non-blocking)

- Some architecture path chart legends could shrink further on 1366×768 when four paths are expanded  
- Optional: bump remaining `text-badge` chips on Report architecture flow to `text-label` in a future polish pass
