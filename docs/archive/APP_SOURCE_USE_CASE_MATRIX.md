# Splunk product — sources and use cases matrix

**Instructions:** One row per Splunk **product or add-on**. Use Splunk Scope **source ids** from the Source Library where possible. Leave cells blank if not applicable.

**Customer / program name:** _______________________  
**Completed by:** _______________________ · **Role:** _______________________  
**Date:** _______________________

---

## Legend

| Symbol | Meaning |
|--------|---------|
| **R** | Required source for meaningful value |
| **Rec** | Recommended |
| **Opt** | Optional |
| **P** | Primary use-case fit |
| **S** | Secondary fit |
| **—** | Not relevant |

---

## Quick reference — common source ids

| Source id | Plain English |
|-----------|---------------|
| `active_directory` | Active Directory / Entra ID |
| `firewalls` | Perimeter firewalls |
| `edr` | Endpoint detection and response |
| `proxy` | Web proxy |
| `dns` | DNS logs |
| `vpn` | VPN concentrator |
| `email` | Email security gateway |
| `windows_servers` | Windows server logs |
| `linux_servers` | Linux/Unix logs |
| `aws` | AWS control plane / audit |
| `azure` | Azure audit / activity |
| `gcp` | GCP audit logs |
| `m365` | Microsoft 365 / Entra audit |
| `switches` | Network switches |
| `routers` | Routers |
| `vuln_mgmt` | Vulnerability management |

*(Add vendor/model in **Notes** for Cisco, OT, or multi-vendor rows.)*

---

## Matrix — copy rows as needed

| # | Splunk product / add-on | Type (Premium / Free / TA / SaaS) | Use cases enabled (short phrases) | Fit P/S/— | Sources **R** | Sources **Rec** | Sources **Opt** | CIM / models | Maturity (crawl/walk/run) | Customer outcome (one sentence) | Doc / Splunkbase link | Notes |
|---|-------------------------|-----------------------------------|-----------------------------------|-----------|---------------|-----------------|-----------------|--------------|---------------------------|----------------------------------|----------------------|-------|
| 1 | Splunk Security Essentials | Free app | | | | | | | | | | |
| 2 | Splunk InfoSec App | Free app | | | | | | | | | | |
| 3 | Splunk Enterprise Security | Premium | | | | | | | | | | |
| 4 | Splunk Enterprise Security Premier | Premium | | | | | | | | | | |
| 5 | Splunk SOAR | Premium | | | | | | | | | | |
| 6 | Splunk UBA | Premium | | | | | | | | | | |
| 7 | Splunk Mission Control | Premium | | | | | | | | | | |
| 8 | Splunk ITSI | Premium | | | | | | | | | | |
| 9 | Splunk Observability Cloud | SaaS | | | | | | | | | | |
| 10 | Splunk APM | SaaS module | | | | | | | | | | |
| 11 | Splunk Infrastructure Monitoring | SaaS module | | | | | | | | | | |
| 12 | Splunk RUM | SaaS module | | | | | | | | | | |
| 13 | Splunk Synthetic Monitoring | SaaS module | | | | | | | | | | |
| 14 | Splunk On-Call | SaaS | | | | | | | | | | |
| 15 | Splunk MLTK | Free app | | | | | | | | | | |
| 16 | Splunk AI Toolkit | Free app | | | | | | | | | | |
| 17 | App for Cisco Network Data | Splunkbase | | | | | | | | | | |
| 18 | Add-on for Cisco ASA | TA | | | | | | | | | | |
| 19 | Add-on for Cisco ISE | TA | | | | | | | | | | |
| 20 | Add-on for AWS | TA | | | | | | | | | | |
| 21 | Add-on for Microsoft Cloud Services | TA | | | | | | | | | | |
| 22 | Splunk CIM | Prerequisite | | | | | | | | | | |
| 23 | ESCU (content) | Content pack | | | | | | | | | | |
| 24 | | | | | | | | | | | | |
| 25 | | | | | | | | | | | | |

---

## Use case library — link outcomes to products

For each outcome, list **product names or catalog ids** and **source ids**.

| Use case outcome | Products that help | Must-have sources (R) | Nice-to-have (Rec/Opt) | How customer measures success |
|------------------|-------------------|------------------------|-------------------------|------------------------------|
| Detect authentication attacks | | | | |
| Perimeter threat detection | | | | |
| Endpoint investigation | | | | |
| Threat hunting | | | | |
| Incident response automation | | | | |
| Insider threat / UEBA | | | | |
| IT service health / KPIs | | | | |
| APM / microservices | | | | |
| Digital experience / RUM | | | | |
| Cloud security posture | | | | |
| Compliance reporting (PCI/HIPAA/SOX) | | | | |
| OT / ICS visibility (read-only) | | | | |

---

## Review checklist (lead SE)

- [ ] Every **Premium** row has required sources **or** explicit “services-led” note
- [ ] SOAR row documents SIEM / ES dependency
- [ ] Observability rows clarify ingest path (O11y/OTel vs Enterprise indexes)
- [ ] Cisco rows distinguish ASA / FTD / ISE / Meraki / Security Cloud
- [ ] Each row has at least one **primary use case** phrase and one **customer outcome** sentence

**Return to:** _______________________

**Engineering import:** Rows feed `appCatalog.json` (`minimumUsefulSources`, `recommendedSources`, `intentTriggers`) and `docs/APP_CATALOG_SME_INTAKE.md` Section B.
