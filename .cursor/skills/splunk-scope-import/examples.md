# Splunk Scope Import — Examples

## High-confidence auto-fill (Placer-style)

Customer notes excerpt:

> 4,000 CrowdStrike endpoints, 6 domain controllers, Palo Alto NGFW at 10 sites. Splunk Cloud SIEM pilot with Enterprise Security.

Expected `dataSources` excerpts:

```json
{
  "sourceId": "edr",
  "sourceName": "Endpoint detection and response",
  "vendor": "CrowdStrike",
  "count": 4000,
  "confidence": "high"
},
{
  "sourceId": "active_directory",
  "count": 6,
  "confidence": "high"
},
{
  "sourceId": "firewalls",
  "vendor": "Palo Alto Networks",
  "count": 10,
  "confidence": "high"
}
```

`validate-import-json.mjs` should report **3 apply-eligible** sources.

## Hint-only (Arcadia-style vague cloud)

Customer notes excerpt:

> They have some cloud stuff and maybe O365. Need better visibility.

Expected row:

```json
{
  "sourceName": "Microsoft 365 / cloud productivity",
  "confidence": "low",
  "skipReason": "No explicit user or tenant count"
}
```

No `sourceId` with `confidence: high`. Scope keeps this in **source hints** only.

## aiSummary block

```json
{
  "aiSummary": {
    "useCaseAssessment": "Mid-size organization pursuing cloud SIEM with identity and perimeter telemetry. Likely phased crawl-walk-run starting with high-value security sources.",
    "recommendedSplunkCapabilities": [
      "Enterprise Security correlation and notable events",
      "CIM normalization for firewall and identity data",
      "Risk-based alerting once baseline detections are stable"
    ],
    "recommendedAppIds": ["enterprise_security", "cim"]
  }
}
```
