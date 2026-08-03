# Splunk Scope v1.8 — Catalog Validation Report

Generated: 2026-08-03

## Summary

- Total sources: 81
- Complete metadata: 58
- Partial metadata: 23
- needsReview: 0
- Critical gaps (sizing or counting): none

### Breakdown by category

| Category | Total | Complete | Partial | needsReview |
|----------|-------|----------|---------|-------------|
| Application | 9 | 3 | 6 | 0 |
| Application Development | 2 | 0 | 2 | 0 |
| Business Services | 1 | 1 | 0 | 0 |
| Cloud/SaaS Services | 15 | 14 | 1 | 0 |
| Database | 3 | 3 | 0 | 0 |
| End-User Support | 5 | 4 | 1 | 0 |
| Networking | 15 | 10 | 5 | 0 |
| OT/ICS | 2 | 1 | 1 | 0 |
| Security & Compliance | 11 | 8 | 3 | 0 |
| Server | 17 | 14 | 3 | 0 |
| Storage | 1 | 0 | 1 | 0 |

## Coverage Matrix

| Source | Category | Sizing | Counting | UseCase | LogCap | Vendor | Research | NeedsReview |
|--------|----------|--------|----------|---------|--------|--------|----------|-------------|
| iaas | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | false |
| iaas_containers | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| iaas_instances | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| iaas_storage | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| paas | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| saas_general | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| saas_office | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| saas_crm | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| saas_sso | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| saas_conferencing | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| saas_filesharing | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| cspm | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| cwpp | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| casb | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| sase | Cloud/SaaS Services | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| windows_servers | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| security_event_log | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| system_event_log | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| application_event_log | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| setup_event_log | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| forwarded_events | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| powershell_operational | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| sysmon | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| windows_defender | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| performance_metrics | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| iis_logs | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| dns_server_logs | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| dhcp_server_logs | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| linux_servers | Server | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| linux_servers_nonprod | Server | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| mainframe | Server | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| hypervisor | Server | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| database | Database | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | false |
| db_transaction | Database | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| db_access | Database | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| web_servers | Application | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| web_servers_nonprod | Application | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| app_servers | Application | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| app_servers_nonprod | Application | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| middleware | Application | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| middleware_nonprod | Application | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| apm | Application | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| pki | Application | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| sap | Application | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| desktops | End-User Support | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| sso_pam | End-User Support | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | false |
| active_directory | End-User Support | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| email | End-User Support | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | false |
| mdm | End-User Support | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| vuln_mgmt | Security & Compliance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | false |
| netflow | Security & Compliance | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| ids_ips | Security & Compliance | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| threat_intel | Security & Compliance | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| sandbox | Security & Compliance | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| edr | Security & Compliance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | false |
| ndr | Security & Compliance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | false |
| dlp | Security & Compliance | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| uba | Security & Compliance | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| asset_cmdb | Security & Compliance | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| deception | Security & Compliance | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| firewalls | Networking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | false |
| fw_perimeter | Networking | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| fw_internal | Networking | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| fw_waf | Networking | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| switches | Networking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | false |
| routers | Networking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | false |
| vpn | Networking | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| proxy | Networking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | false |
| nac | Networking | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| dns | Networking | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| dhcp | Networking | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |
| loadbalancer | Networking | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| ddos | Networking | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| wireless | Networking | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| dpi | Networking | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| storage_prod | Storage | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | false |
| ics_scada | OT/ICS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | false |
| ot_security | OT/ICS | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| devops_cicd | Application Development | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| config_mgmt | Application Development | ✓ | ✓ | ✓ | ✓ | — | ✗ | false |
| business_txn | Business Services | ✓ | ✓ | ✓ | ✓ | — | ✓ | false |

## Missing Metadata

- **sase** (Cloud/SaaS Services): missing researchNote
- **linux_servers_nonprod** (Server): missing researchNote
- **mainframe** (Server): missing researchNote
- **hypervisor** (Server): missing researchNote
- **web_servers_nonprod** (Application): missing researchNote
- **app_servers_nonprod** (Application): missing researchNote
- **middleware** (Application): missing researchNote
- **middleware_nonprod** (Application): missing researchNote
- **pki** (Application): missing researchNote
- **sap** (Application): missing researchNote
- **mdm** (End-User Support): missing researchNote
- **sandbox** (Security & Compliance): missing researchNote
- **asset_cmdb** (Security & Compliance): missing researchNote
- **deception** (Security & Compliance): missing researchNote
- **nac** (Networking): missing researchNote
- **loadbalancer** (Networking): missing researchNote
- **ddos** (Networking): missing researchNote
- **wireless** (Networking): missing researchNote
- **dpi** (Networking): missing researchNote
- **storage_prod** (Storage): missing researchNote
- **ot_security** (OT/ICS): missing researchNote
- **devops_cicd** (Application Development): missing researchNote
- **config_mgmt** (Application Development): missing researchNote

## Legacy Aliases

sizingRates.json defines **97** rate keys; the flattened source catalog lists **81** IDs. The **16** keys present in sizing rates but not as standalone source rows are:

1. **Canonical partners for legacy IDs** (see `RATE_ALIASES` in the validator): `firewall_logs`, `edr_logs`, `active_directory_security`, `okta_sso`, `m365_audit_logs`, `vpn_logs`, `proxy_web_gateway`, `dns_logs`, `netflow_data`, `vulnerability_scanner`
2. **Additional granular / alternate rate paths** documented in sizingRates for additive or vendor-specific estimates: `windows_security_event_log`, `sysmon_logs`, `aws_cloudtrail`, `linux_auth`, `application_logs`, `kubernetes_logs`

Keys in sizingRates.json that are not top-level rows in sources.json include: (1) canonical rate IDs paired with legacy catalog IDs via RATE_ALIASES, (2) channel- or platform-specific rates (e.g. windows_security_event_log, kubernetes_logs) used when additive or alternate sizing paths are documented in sizingRates.
