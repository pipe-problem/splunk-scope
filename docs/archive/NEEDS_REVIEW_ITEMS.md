# Needs Review Items — Splunk Scope v1.7

**Date:** 2026-05-06

## Overview
18 rate entries in `sizingRates.json` have `needsReview: true`. Treat these as provisional until validated with customer or vendor data.

## Items

### 1. APM (Application Performance Monitoring) (`apm`)
- **Category:** Application
- **Current estimate:** Low 0.05 / Avg 0.1 / High 0.25 GB/day per application
- **Confidence:** low
- **Why it needs review:** Distributed traces and span detail can dwarf log lines; scope (traces vs logs) changes totals by orders of magnitude.
- **Suggested validation method:** Confirm whether APM traces are in Splunk scope; sample exporter/API daily volume for a representative service.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Request vendor APM→SIEM sizing or run a 48h pilot on one instrumented application.


### 2. Application logs (generic) (`application_logs`)
- **Category:** Application
- **Current estimate:** Low 0.02 / Avg 0.1 / High 0.5 GB/day per application
- **Confidence:** low
- **Why it needs review:** Notes describe this band as wildly variable—logging level (INFO vs DEBUG) and traffic dominate.
- **Suggested validation method:** Meter forwarder or HEC volume from a production-like app tier; compare INFO baseline to DEBUG spike.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Pick two reference applications (batch + interactive) and extrapolate.


### 3. Automated Malware Analysis (Sandbox) (`sandbox`)
- **Category:** Security & Compliance
- **Current estimate:** Low 0.05 / Avg 0.15 / High 0.3 GB/day per device
- **Confidence:** medium
- **Why it needs review:** Submission rate and whether summaries vs artifacts are exported drives ingest; outbreaks create spikes.
- **Suggested validation method:** Use sandbox admin stats (submissions/day) and average report size from vendor or last 30 days export.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Budget average separately from outbreak peak if SOC runs large retro hunts.


### 4. AWS CloudTrail (`aws_cloudtrail`)
- **Category:** Cloud/SaaS Services
- **Current estimate:** Low 0.1 / Avg 0.5 / High 3 GB/day per account
- **Confidence:** low
- **Why it needs review:** Mgmt events are modest; S3/Lambda data events and organization-wide trails can multiply volume 10×+ per account.
- **Suggested validation method:** Sum historical CloudTrail S3 object growth or Athena query over trail; split mgmt vs data events.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Align with customer's actual Data Events enablement per high-churn buckets/functions.


### 5. Business Transaction Logs (`business_txn`)
- **Category:** Business Services
- **Current estimate:** Low 0.05 / Avg 0.1 / High 0.5 GB/day per application
- **Confidence:** low
- **Why it needs review:** POS/ERP/claims patterns differ widely; the catalog rate is provisional unless event shapes are measured.
- **Suggested validation method:** Collect representative txn payloads during peak TPS or month-end close.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Work with application owner to export one day of prod-equivalent logs.


### 6. DDoS Protection (`ddos`)
- **Category:** Networking
- **Current estimate:** Low 0.05 / Avg 0.15 / High 0.3 GB/day per device
- **Confidence:** medium
- **Why it needs review:** Steady-state can be low while scrubbing centers generate large bursts under attack—averages mislead.
- **Suggested validation method:** Review last 12 months of attack-volume reports from provider; model peak GB/day separately.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Add explicit peak buffer line item vs SIEM daily average.


### 7. Deception Technology (`deception`)
- **Category:** Security & Compliance
- **Current estimate:** Low 0.005 / Avg 0.015 / High 0.03 GB/day per sensor
- **Confidence:** medium
- **Why it needs review:** Telemetry is quiet until engagement; campaigns and PCAP-style exports can spike.
- **Suggested validation method:** Ask vendor for events/sec in steady vs active engagement; review last red-team exercise exports.
- **Suggested owner:** SE / PS / Customer
- **Next action:** If PCAP is enabled, size with security architecture, not this syslog baseline alone.


### 8. Deep Packet Inspection / Full PCAP (`dpi`)
- **Category:** Networking
- **Current estimate:** Low 0.05 / Avg 0.1 / High 0.5 GB/day per sensor
- **Confidence:** low
- **Why it needs review:** Sampled metadata vs SSL inspection vs payload-adjacent exports differ by orders of magnitude.
- **Suggested validation method:** Measure appliance export over business hours; document inspected Gbps and feature pack.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Validate with vendor EPS table for the licensed throughput tier.


### 9. DNS query / resolver logs (user-normalized) (`dns_logs`)
- **Category:** Networking
- **Current estimate:** Low 0.001 / Avg 0.002 / High 0.008 GB/day per user
- **Confidence:** low
- **Why it needs review:** Full internal query logging is among the highest-variance network sources.
- **Suggested validation method:** Estimate QPS × bytes/event from resolver or use DNS vendor sizing; evaluate sampling.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Decide full-fidelity vs passive DNS before locking license.


### 10. ICS / SCADA Systems (`ics_scada`)
- **Category:** OT/ICS
- **Current estimate:** Low 0.05 / Avg 0.15 / High 0.3 GB/day per device
- **Confidence:** low
- **Why it needs review:** OT protocols are sparse per device but historian polling and compliance retention swing totals; few standardized benchmarks.
- **Suggested validation method:** Measure historian/gateway export over 24–48h; confirm scan/poll intervals.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Engage OT vendor on expected events/day for the enabled tag list.


### 11. Kubernetes cluster / container logs (`kubernetes_logs`)
- **Category:** Cloud/SaaS Services
- **Current estimate:** Low 0.02 / Avg 0.05 / High 0.15 GB/day per node
- **Confidence:** low
- **Why it needs review:** Includes container stdout/stderr, platform components, and audit—pod churn and audit policy drive highs.
- **Suggested validation method:** Pull metrics from logging agent or cluster audit log bucket for one prod-like cluster × node count.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Reconcile with `iaas_containers` if control-plane logs are double-counted.


### 12. Mainframe (`mainframe`)
- **Category:** Server
- **Current estimate:** Low 0.15 / Avg 0.25 / High 0.5 GB/day per system
- **Confidence:** low
- **Why it needs review:** SMF record mix and modernization middleware can swing volume 10×; rare skill-set environment.
- **Suggested validation method:** Mainframe ops RACF/SMF/syslog forward sizing; use historical offload file sizes if available.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Treat estimate as placeholder until LPAR export is measured.


### 13. NDR (Network Detection & Response) (`ndr`)
- **Category:** Security & Compliance
- **Current estimate:** Low 0.05 / Avg 0.15 / High 0.4 GB/day per sensor
- **Confidence:** low
- **Why it needs review:** Metadata-only NDR vs decryption-rich analytics spans a huge band; overlaps with NetFlow/IPS must be deduped.
- **Suggested validation method:** Sensor EPS from vendor for monitored Gbps; 24–48h capture at Splunk ingest.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Document overlap with `netflow` and `ids_ips` to avoid double counting.


### 14. NetFlow / IPFIX / sFlow (`netflow_data`)
- **Category:** Security & Compliance
- **Current estimate:** Low 0.1 / Avg 0.5 / High 2 GB/day per exporter
- **Confidence:** low
- **Why it needs review:** Core routers vs edge, sampling ratio, and v9/IPFIX option templates make generic per-exporter rates unreliable.
- **Suggested validation method:** Flow collector stats: records/day per exporter; verify sampling on each platform.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Prefer netflow collector reporting over theoretical interface math.


### 15. OT Security Solutions (OT IDS) (`ot_security`)
- **Category:** OT/ICS
- **Current estimate:** Low 0.05 / Avg 0.15 / High 0.3 GB/day per sensor
- **Confidence:** low
- **Why it needs review:** Dedicated OT IDS parsers and span coverage vary; often correlated with plant complexity more than sensor count.
- **Suggested validation method:** OT sensor vendor export sizing for monitored VLANs; confirm passive vs inline.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Pair with `ics_scada` scope rules so historians aren't triple-counted.


### 16. Sysmon (endpoint telemetry) (`sysmon_logs`)
- **Category:** Security & Compliance
- **Current estimate:** Low 0.01 / Avg 0.03 / High 0.1 GB/day per endpoint
- **Confidence:** low
- **Why it needs review:** Notes flag extreme XML/config dependence; untuned Sysmon can exceed table highs.
- **Suggested validation method:** Deploy candidate Sysmon XML on gold images; measure Security Channel growth per endpoint.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Compare to `sysmon` (server-forwarded) if customer uses both patterns—dedupe.


### 17. Threat Intelligence Feeds (`threat_intel`)
- **Category:** Security & Compliance
- **Current estimate:** Low 0.01 / Avg 0.05 / High 0.1 GB/day per manual
- **Confidence:** low
- **Why it needs review:** Provider bundles range from compact IOC lists to large STIX graphs; duplicates across feeds are common.
- **Suggested validation method:** Provider datasheet MB/day or test import; check dedup ratio in Splunk.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Ask TIP vendor for daily indexed volume at licensed tier.


### 18. User Authentication (SSO / PAM / IAM) (`sso_pam`)
- **Category:** End-User Support
- **Current estimate:** Low 0.0004 / Avg 0.001 / High 0.004 GB/day per user
- **Confidence:** medium
- **Why it needs review:** Combines IdP-style auth with PAM/vault patterns; vault session recording is explicitly out of band for this rate.
- **Suggested validation method:** Export sample IdP system log + PAM audit for one day; check MFA density.
- **Suggested owner:** SE / PS / Customer
- **Next action:** Deduplicate versus `saas_sso` / Entra sign-in if both feed Splunk.
