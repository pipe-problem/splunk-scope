# Source Sizing Matrix — Splunk Scope v1.7

**Generated:** 2026-05-06  
**Disclaimer:** Planning estimates only. Validate with customer data.

## How to Read This Matrix
- **Low**: Conservative baseline (minimal logging, light traffic)
- **Average**: Typical production deployment
- **High**: Verbose logging, heavy traffic, advanced features enabled
- All rates are GB/day per counting unit unless noted

## Cloud / SaaS Services

| Source | Unit | Low | Avg | High | Confidence | NeedsReview | Top Vendors | Key Caveats |
|--------|------|-----|-----|------|------------|-------------|-------------|-------------|
| Cloud Access Security Broker (CASB) (`casb`) | per user | 0.02 | 0.05 | 0.08 | medium | No | — | Shadow-IT discovery and granular DLP on SaaS traffic increase ingestion versus policy-only mode. |
| Cloud Instances / VMs (`iaas_instances`) | per instance | 0.1 | 0.25 | 0.35 | medium | No | — | Count production compute instances forwarding guest logs, not just hypervisor inventory. |
| Cloud Security Posture Management (CSPM) (`cspm`) | per account | 0.02 | 0.05 | 0.1 | medium | No | — | Findings streams and configuration snapshots are bursty. Multi-cloud and frequent scans trend high. |
| Cloud Storage (`iaas_storage`) | per asset | 0.1 | 0.25 | 0.4 | medium | No | — | Often counted as buckets or storage accounts. Object-level event logging can dominate volume versus management events alone. |
| Cloud Workload Protection Platform (CWPP) (`cwpp`) | per instance | 0.02 | 0.05 | 0.1 | medium | No | — | Workload agents emit runtime events; serverless ephemeral workloads may compress or fragment counts. |
| Containers / Pods / Clusters (`iaas_containers`) | per cluster | 0.15 | 0.25 | 0.5 | medium | No | — | Count orchestration clusters (EKS, AKS, GKE, OpenShift). High pod churn and verbose API audit policies increase volume. |
| CRM (`saas_crm`) | per user | 0.002 | 0.005 | 0.01 | medium | No | — | Salesforce, Dynamics, HubSpot, etc. Bulk sync jobs and integrations add burst load. |
| File Sharing / Collaboration (`saas_filesharing`) | per user | 0.002 | 0.005 | 0.01 | medium | No | — | SharePoint/Box/Dropbox audit trails scale with file activity and shared-link usage. |
| IaaS (Cloud Infrastructure) (`iaas`) | per account | 0.15 | 0.25 | 0.4 | medium | No | AWS, Microsoft Azure, Google Cloud, Oracle Cloud Infrastructure, IBM Cloud | Count discrete billing/administrative boundaries that export cloud audit logs. Enable data-plane or data-event logging increases volume sharply. |
| Office Productivity (M365/Google) (`saas_office`) | per user | 0.0004 | 0.001 | 0.003 | medium | No | — | Aligns with Microsoft 365 unified audit volume assumptions. E5/Advanced Audit increases events per user. |
| PaaS (Platform Services) (`paas`) | per application | 0.08 | 0.15 | 0.3 | medium | No | — | Azure App Service, Cloud Functions/Lambda at scale, managed databases, etc. Burst traffic and verbose diagnostics drive high side. |
| SaaS (General) (`saas_general`) | per user | 0.08 | 0.15 | 0.25 | medium | No | — | Use tenant user count. Niche SaaS APIs vary; prefer vendor sizing guides when available. |
| Secure Access Service Edge (SASE) (`sase`) | per user | 0.02 | 0.05 | 0.1 | medium | No | — | Combines proxy-like and VPN-like flows; treat as upper bound of SWG plus ZTNA session telemetry. |
| SSO / Identity Provider (`saas_sso`) | per user | 0.00022 | 0.000575 | 0.0012 | medium | No | — | Okta, Azure AD/Entra, Ping, etc. MFA, device trust, and high API polling increase steady-state volume. |
| Web Conferencing (`saas_conferencing`) | per user | 0.002 | 0.005 | 0.008 | medium | No | — | Teams, Zoom, Webex meeting metadata is modest per user compared to mail or DLP-heavy suites. |

## Server

| Source | Unit | Low | Avg | High | Confidence | NeedsReview | Top Vendors | Key Caveats |
|--------|------|-----|-----|------|------------|-------------|-------------|-------------|
| Application Event Log (`application_event_log`) | per server | 0.04 | 0.08 | 0.16 | medium | No | — | Depends on installed applications and .NET/MSI logging. IIS-heavy roles may overlap dedicated IIS log estimates. |
| DHCP Server Logs (DHCP role) (`dhcp_server_logs`) | per server | 0.01 | 0.02 | 0.04 | medium | No | — | Mostly lease churn; large campus or IoT-dense networks push highs. |
| DNS Server Logs (DNS role) (`dns_server_logs`) | per server | 0.025 | 0.05 | 0.1 | medium | No | — | Microsoft DNS analytical logs are query-heavy; compare to dedicated `dns` network source for resolvers. |
| Forwarded Events (`forwarded_events`) | per server | 0.04 | 0.08 | 0.16 | medium | No | — | Volume equals sum of upstream sources concentrated on collectors—avoid double counting with member servers. |
| IIS Logs (web server role) (`iis_logs`) | per server | 0.05 | 0.1 | 0.2 | medium | No | — | Traffic-shaped. High-traffic properties or full W3C extended fields trend high. |
| Linux / Unix Servers (Non-Production) (`linux_servers_nonprod`) | per server | 0.05 | 0.15 | 0.25 | medium | No | — | Often noisier due to unstable apps; sizing for retention is still required. |
| Linux / Unix Servers (Production) (`linux_servers`) | per server | 0.08 | 0.15 | 0.3 | medium | No | — | Syslog, auditd, container runtime logs on the host; web- and auth-heavy hosts trend high. |
| Mainframe (`mainframe`) | per system | 0.15 | 0.25 | 0.5 | low | Yes | — | Rare environment—SMF record mix and modernization middleware drive 10x+ swings; treat highs as provisional. |
| Performance Metrics (`performance_metrics`) | per server | 0.013 | 0.025 | 0.05 | medium | No | — | Polling interval and counter set dominate; sub-minute polling grows quickly. |
| PowerShell Operational Logs (`powershell_operational`) | per server | 0.025 | 0.05 | 0.1 | medium | No | — | Script Block Logging and module logging materially increase size versus default. |
| Security Event Log (`security_event_log`) | per server | 0.05 | 0.1 | 0.2 | medium | No | — | Domain controllers and strict advanced auditing trend high; member servers are usually lower. |
| Setup Event Log (`setup_event_log`) | per server | 0.005 | 0.01 | 0.02 | medium | No | — | Typically low except during wide-scale patching windows. |
| Sysmon Events (`sysmon`) | per server | 0.075 | 0.15 | 0.3 | medium | No | — | Distinct from generic Sysmon endpoint telemetry (`sysmon_logs`): server channel rates assume Windows Event Log forwarding. |
| System Event Log (`system_event_log`) | per server | 0.025 | 0.05 | 0.1 | medium | No | — | Driver, service, and hardware events. Verbose providers increase volume. |
| Virtual Infrastructure (Hypervisor) (`hypervisor`) | per node | 0.02 | 0.05 | 0.15 | medium | No | — | Includes vmkernel / Hyper-V operational logs; not guest OS logs (count under server sources). |
| Windows Defender / Security Center (`windows_defender`) | per server | 0.015 | 0.03 | 0.06 | medium | No | — | Includes AV/EDR-adjacent events in Windows Security center channels on server SKUs. |
| Windows Servers (`windows_servers`) | per server | 0.15 | 0.3 | 0.5 | medium | No | — | Aggregate estimate when channel mix is unknown. Prefer additive per-channel rates (security_event_log, etc.) when detailing collection. |

## Networking

| Source | Unit | Low | Avg | High | Confidence | NeedsReview | Top Vendors | Key Caveats |
|--------|------|-----|-----|------|------------|-------------|-------------|-------------|
| DDoS Protection (`ddos`) | per device | 0.05 | 0.15 | 0.3 | medium | Yes | — | Attack-time bursts dominate; average daily may be low until large events occur—budget peak separately. |
| Deep Packet Inspection / Full PCAP (`dpi`) | per sensor | 0.05 | 0.1 | 0.5 | low | Yes | — | Extremely variable; sampled flow metadata vs. full payload capture differs by orders of magnitude. |
| DHCP (`dhcp`) | per device | 0.03 | 0.1 | 0.2 | medium | No | — | Mostly lease activity; large IoT or short-lease designs increase churn. |
| DNS (`dns`) | per device | 0.001 | 0.002 | 0.008 | medium | No | — | Maps conceptually to resolver query logging; overlaps with `dns_logs` user-normalized model—avoid double count in hybrid designs. |
| Firewalls (Next-Gen Firewalls) (`firewalls`) | per device | 0.2 | 0.5 | 1.5 | medium | No | Palo Alto Networks, Fortinet, Cisco ASA/Firepower, Check Point, Juniper SRX | Child types (`fw_perimeter`, `fw_internal`, `fw_waf`) refine placement in the architecture. |
| Internal Segmentation Firewalls (`fw_internal`) | per device | 0.14 | 0.375 | 1.275 | medium | No | — | Often high connection fan-out but may log less URL detail than perimeter devices. |
| Load Balancers (`loadbalancer`) | per device | 0.05 | 0.1 | 0.25 | medium | No | — | TLS inspection and verbose L7 logging increase dramatically vs. connection counts only. |
| Network Access Control (NAC) (`nac`) | per device | 0.1 | 0.25 | 0.5 | medium | No | — | 802.1X and posture assessment volume rises with campus refresh events; steady per-port auth is moderate. |
| Network Switches (`switches`) | per device | 0.05 | 0.15 | 0.3 | medium | No | Cisco, Juniper, Arista, HPE Aruba, Dell | Port flap storms, spanning-tree, and AAA failures create spikes; most steady state modest. |
| Perimeter Firewalls (`fw_perimeter`) | per device | 0.2 | 0.55 | 1.575 | medium | No | — | Typically highest flows per device; full threat + URL logging multipliers apply. |
| Routers (`routers`) | per device | 0.1 | 0.25 | 0.5 | medium | No | Cisco, Juniper, Arista, Nokia, Huawei | BGP/OSPF churn and ACL logging settings dominate; core routers busier than stub sites. |
| VPN Gateways (`vpn`) | per user | 0.0004 | 0.001 | 0.003 | medium | No | — | Full-tunnel with DPI or split-tunnel malware inspection changes effective logging rates. |
| Web Application Firewall (WAF) (`fw_waf`) | per device | 0.15 | 0.425 | 1.35 | medium | No | — | HTTP request logging verbosity and bot traffic materially affect volume. |
| Web Proxy / Secure Web Gateway (`proxy`) | per user | 0.001 | 0.002 | 0.005 | medium | No | Zscaler, Netskope, Cisco Umbrella, Palo Alto Prisma Access, Cloudflare | Mapped to `proxy_web_gateway` assumptions; URL categorization vs. full URL logging is the swing factor. |
| Wireless Access Points (`wireless`) | per device | 0.02 | 0.05 | 0.1 | medium | No | — | Client roaming density and security (WPA3-Enterprise, rogue AP) features affect volume. |

## Security & Compliance

| Source | Unit | Low | Avg | High | Confidence | NeedsReview | Top Vendors | Key Caveats |
|--------|------|-----|-----|------|------------|-------------|-------------|-------------|
| Asset & Identity Lists (CMDB / AD / LDAP) (`asset_cmdb`) | per asset | 0.01 | 0.025 | 0.05 | medium | No | — | Usually batch JSON/CSV imports; daily average small but burst on full sync. |
| Automated Malware Analysis (Sandbox) (`sandbox`) | per device | 0.05 | 0.15 | 0.3 | medium | Yes | — | Submission rate and full PCAP/summary artifacts drive storage more than steady syslog. |
| Data Loss/Leakage Prevention (DLP) (`dlp`) | per user | 0.02 | 0.05 | 0.1 | medium | No | — | Email and cloud DLP often overlap SaaS audit; deduplicate consciously in totals. |
| Deception Technology (`deception`) | per sensor | 0.005 | 0.015 | 0.03 | medium | Yes | — | Low steady state until engagement—budget for campaign bursts and full packet captures if enabled. |
| EDR (Endpoint Detection & Response) (`edr`) | per endpoint | 0.005 | 0.015 | 0.04 | medium | No | CrowdStrike, Microsoft Defender for Endpoint, SentinelOne, VMware Carbon Black, Trellix | Use `edr_logs` vendor tiers when known; server workloads typically higher than desktops. |
| Intrusion Prevention/Detection Systems (IPS/IDS) (`ids_ips`) | per sensor | 0.05 | 0.15 | 0.4 | medium | No | — | Signature set, decryption, and packet logging options dominate variability. |
| NDR (Network Detection & Response) (`ndr`) | per sensor | 0.05 | 0.15 | 0.4 | low | Yes | Darktrace, ExtraHop, Vectra AI, Corelight, Cisco Secure Network Analytics | Metadata-only NDR lighter than full PCAP-style analytics; encrypted traffic inspection changes math. |
| Network Traffic Analysis / NetFlow (`netflow`) | per exporter | 0.1 | 0.5 | 2 | medium | No | — | Same conceptual unit as `netflow_data`. Core exporters and unsampled rates trend high. |
| Threat Intelligence Feeds (`threat_intel`) | per manual | 0.01 | 0.05 | 0.1 | low | Yes | — | Often normalized to daily index volume per provider contract; use vendor sheet when available. |
| User Behavior Analytics (UBA/UEBA) (`uba`) | per user | 0.05 | 0.15 | 0.25 | medium | No | — | Back-end entity graph + raw auth events can re-ingest overlapping identity logs. |
| Vulnerability Management (`vuln_mgmt`) | per asset | 0.00005 | 0.0001 | 0.0003 | medium | No | Tenable, Qualys, Rapid7, Microsoft Defender Vulnerability Management, Wiz | Mapped to vulnerability scanner benchmark; batch imports affect daily average smoothing. |

## Application

| Source | Unit | Low | Avg | High | Confidence | NeedsReview | Top Vendors | Key Caveats |
|--------|------|-----|-----|------|------------|-------------|-------------|-------------|
| APM (Application Performance Monitoring) (`apm`) | per application | 0.05 | 0.1 | 0.25 | low | Yes | — | Distributed traces and code-level spans can dwarf log lines; confirm if traces vs. logs are in scope. |
| Application Servers (`app_servers`) | per server | 0.1 | 0.25 | 0.5 | medium | No | — | JVM/.NET app logging levels dominate; treat DEBUG as out-of-band for budget baselines. |
| Middleware Services (`middleware`) | per server | 0.1 | 0.25 | 0.4 | medium | No | — | Message trace/debug logging is expensive; security-relevant broker ACL/admin logs are lighter. |
| Public Key Infrastructure (PKI) (`pki`) | per server | 0.001 | 0.005 | 0.01 | medium | No | — | High-volume auto-enrollment environments can spike during certificate lifecycle events. |
| SAP (`sap`) | per application | 0.1 | 0.25 | 0.5 | medium | No | — | SAP audit vs. business logs differ widely by modules activated; integrate with functional owners. |
| Web Servers (`web_servers`) | per server | 0.1 | 0.25 | 0.5 | medium | No | — | Highly traffic dependent; CDN or load balancer in front reduces origin log volume but may shift to LB logs. |

## End-User Support

| Source | Unit | Low | Avg | High | Confidence | NeedsReview | Top Vendors | Key Caveats |
|--------|------|-----|-----|------|------------|-------------|-------------|-------------|
| Active Directory / Domain Controllers (`active_directory`) | per domain controller | 0.1 | 0.3 | 1 | medium | No | — | Mapped to domain-controller-centric rates (`active_directory_security`). Busy LDAP apps inflate LDAP-related events. |
| Desktops / Workstations (`desktops`) | per endpoint | 0.005 | 0.01 | 0.025 | medium | No | — | Covers workstation security logging without full EDR pipeline (`edr` separate if telemetry includes EDR backend). |
| Email Servers / Email Gateways (`email`) | per server | 0.1 | 0.25 | 0.5 | medium | No | Microsoft Exchange / Microsoft 365, Proofpoint, Mimecast, Barracuda, Cisco Email Security Appliance (ESA) | Message volume and attachment inspection drive highs; cloud SaaS mail overlaps `saas_office` if only M365. |
| Mobile Device Management (MDM) (`mdm`) | per device | 0.1 | 0.5 | 0.75 | medium | No | — | Per-device compliance, app inventory, and network events scale with fleet churn. |
| User Authentication (SSO / PAM / IAM) (`sso_pam`) | per user | 0.0004 | 0.001 | 0.004 | medium | Yes | Okta, Microsoft Entra ID, Ping Identity, Cisco Duo, CyberArk | Privileged session recording vaults (video/keystroke) require separate storage models not captured here. |

## Database

| Source | Unit | Low | Avg | High | Confidence | NeedsReview | Top Vendors | Key Caveats |
|--------|------|-----|-----|------|------------|-------------|-------------|-------------|
| Access / Audit Logs (`db_access`) | per instance | 0.02 | 0.05 | 0.15 | medium | No | — | Fine-grained auditing on busy schemas can exceed OLTP steady-state application logs. |
| Database Instances (`database`) | per instance | 0.08 | 0.15 | 0.35 | medium | No | Oracle, Microsoft SQL Server, PostgreSQL, MySQL / MariaDB, MongoDB | RDMS audit vs. native transaction log shipping differ; prefer vendor audit sizing when known. |
| Transaction Logs (`db_transaction`) | per instance | 0.05 | 0.1 | 0.2 | medium | No | — | Heavy OLTP and batch ETL windows create spikes; often batch-oriented not steady GB/day. |

## OT/ICS

| Source | Unit | Low | Avg | High | Confidence | NeedsReview | Top Vendors | Key Caveats |
|--------|------|-----|-----|------|------------|-------------|-------------|-------------|
| ICS / SCADA Systems (`ics_scada`) | per device | 0.05 | 0.15 | 0.3 | low | Yes | Nozomi Networks, Claroty, Dragos, Rockwell Automation, Siemens | OT protocols are sparse but long-retention compliance needs common; confirm historian sampling. |
| OT Security Solutions (OT IDS) (`ot_security`) | per sensor | 0.05 | 0.15 | 0.3 | low | Yes | — | Mirrors network-sensor class sizing with OT-specific protocol parsers. |

## Storage

| Source | Unit | Low | Avg | High | Confidence | NeedsReview | Top Vendors | Key Caveats |
|--------|------|-----|-----|------|------------|-------------|-------------|-------------|
| Production Storage Arrays (`storage_prod`) | per system | 0.1 | 0.25 | 0.4 | medium | No | NetApp, Dell EMC, Pure Storage, HPE, IBM Storage | Vendor syslog and NAS/SAN security logs are modest compared to per-volume I/O analytics. |

## Application Development

| Source | Unit | Low | Avg | High | Confidence | NeedsReview | Top Vendors | Key Caveats |
|--------|------|-----|-----|------|------------|-------------|-------------|-------------|
| CI/CD and Build Systems (`devops_cicd`) | per application | 0.1 | 0.25 | 0.5 | medium | No | — | Build log verbosity and artifact retention often exceed security-event needs; pipeline frequency dominates. |
| Configuration Management / Deployment Tools (`config_mgmt`) | per server | 0.05 | 0.1 | 0.2 | medium | No | — | Inventory sync and change audit streams; bursts during patch windows. |

## Business Services

| Source | Unit | Low | Avg | High | Confidence | NeedsReview | Top Vendors | Key Caveats |
|--------|------|-----|-----|------|------------|-------------|-------------|-------------|
| Business Transaction Logs (`business_txn`) | per application | 0.05 | 0.1 | 0.5 | low | Yes | — | Highly bespoke—treat as provisional unless sample events measured. |
