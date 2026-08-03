# SaaS (General) Sizing Methodology v2

## Model
Tenant baseline + active-user activity + integration/API activity.

Total ingest = sum of enabled components:
- Admin / configuration audit events (per tenant/org/instance)
- Authentication / access security events (per active user)
- User activity / object/content events (per active user)
- API / integration events (per integration/API client)

## Measurement
- Raw UTF-8 bytes per synthetic event line (including newline)
- Not compressed size, not index size, not parsed field size
- 2,500 synthetic events per vendor × component × activity profile (150,000 minimum)

## Event rate assumptions (per unit per day)
See `event_rate_assumptions.csv`.

## Vendors modeled
Salesforce, ServiceNow, Workday, Box, Atlassian Cloud, Average / Blended.

Synthetic data uses RFC 5737 IPs and example.com / example.net only.
