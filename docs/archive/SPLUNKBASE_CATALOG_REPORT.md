# Splunkbase Catalog Report

Generated: 2026-06-02

## Summary

| Metric | Count |
|--------|------:|
| Total entries | 64 |
| Verified | 58 |
| Needs review | 3 |
| Deprecated | 1 |
| Replacement preferred | 2 |

## Broken / invalid URLs

_None marked verified with validation failures._

## Duplicate app IDs

_None._

## Duplicate names

_None._

## Verified entries missing source family mappings

_None._

## Catalog IDs referenced in app data but missing from catalog

_None._

## Verified entries not referenced in app data

- splunk_es_content_update (Splunk ES Content Update)
- splunk_cim (Splunk Common Information Model (CIM))
- sa_investigator_es (SA-Investigator for Enterprise Security)
- ot_security_addon (OT Security Add-on for Splunk)
- ocsf_cim_addon (OCSF-CIM Add-On for Splunk)
- cisco_appdynamics_addon (Cisco Splunk Add-on for AppDynamics)
- infra_monitoring_addon (Splunk Infrastructure Monitoring Add-on)
- scom_addon (Splunk Add-on for Microsoft System Center Operations Manager)
- aws_security_dashboards (Splunk App for AWS Security Dashboards)
- aws_security_hub (Splunk Add-on for AWS Security Hub)
- azure_app (Microsoft Azure App for Splunk)
- cisco_security_cloud (Cisco Security Cloud)
- ta_cisco_ise (Splunk Add-on for Cisco Identity Services)
- cisco_suite (Cisco Suite for Splunk)
- cisco_secure_firewall (Cisco Secure Firewall)
- cisco_firepower (Cisco Firepower)
- ccx_cisco_firepower (CCX Unified Add-on for Cisco Firepower)
- ta_f5 (Splunk Add-on for F5 BIG-IP)
- ta_oracle_db (Splunk Add-on for Oracle Database)
- ta_jmx (Splunk Add-on for Java Management Extensions)
- content_pack_snmp_netflow (Content Pack for SNMP and NetFlow)
- cato_cim_addon (Cato Networks CIM Add-on for Splunk)
- nessus_vuln_mapper (Nessus Vulnerability CIM Mapper)
- okta_identity_cloud_community (Okta Identity Cloud Add-on for Splunk)
- okta_soar_connector (Okta)
- fortinet_app (Fortinet FortiGate App for Splunk)
- ta_proofpoint_syslog (Proofpoint Email Security Add-On using Remote Syslog)
- cloudflare_app (Cloudflare App for Splunk)

## Needs review entries

- **splunk_soar**: No verified Splunk Enterprise Splunkbase listing ID — SOAR uses separate on-prem/cloud app packaging.
- **splunk_uba**: Prior Splunkbase ID 4502 no longer resolves to UBA — verify current packaging with Splunk account team.
- **splunk_mission_control**: Prior Splunkbase ID 5703 no longer resolves to Mission Control — verify current packaging.

## Deprecated / replacement preferred

- **deprecated_cisco_network_data** (deprecated) → app_cisco_network_data: Deprecated listing — do not recommend for new deployments.
- **duo_splunk_connector** (replacementPreferred) → cisco_security_cloud: Deprecated 31-May-2026 — Splunkbase directs migration to Cisco Security Cloud (7404).
- **ta_cloudflare** (replacementPreferred) → cloudflare_app: Prior Splunkbase ID 4912 recycled — no official Splunk TA listing. Use Cloudflare App (4501) with Logpush to HEC.
