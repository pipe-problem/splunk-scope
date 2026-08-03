# Data source sizing — required fields and rate reference

> **Generated:** 2026-08-03 — app 1.8.0, sizing rates 1.8
> **Regenerate:** `node scripts/generateDataSourceSizingDoc.mjs` (writes this file; review diff before commit)

## How GB/day is computed in the app

1. **Status** — Only *Active* (`current`) or *Planned* (`future`) rows contribute to totals.
2. **Primary quantity** — The field named in `sizing_formula.primary_input` in `sources.json` (often `count` or `number_of_*`).
3. **Optional: vendor / model** — When `sizingRates.json` defines `vendorRates`, the engine picks vendor- or model-specific low/medium/high GB/day per unit.
4. **Optional: logging scope / audit level** — Drives scope multipliers (catalog `scopeMultipliers` when tokens match, else regex fallback in `sizingEngine.js`).
5. **Manual override** — `override` or `manual_gb_day` (GB/day) replaces formula output for that row.
6. **Parent rollup** — If a catalog row has `children` and any child is Active/Planned, the **parent** row contributes **0 GB/day** in the app (configure children instead).
7. **Windows log channels** — `windows_servers` adds **base** per-server ingest plus **selected** `log_options` (`gb_per_unit` × server count). Base rate is tuned so base + default channels approximate workshop expectations.
8. **IaaS / SaaS general dispersion** — `iaas` uses optional `number_of_regions` (more than one region applies a small upward factor). `saas_general` uses optional `number_of_platforms` (more than one platform applies a small upward factor).

## Rate catalog mapping (source id → sizingRates key)

| Source id | sizingRates key |
|-----------|-----------------|
| `iaas` | `iaas` |
| `iaas_containers` | `iaas_containers` |
| `iaas_instances` | `iaas_instances` |
| `iaas_storage` | `iaas_storage` |
| `paas` | `paas` |
| `saas_general` | `saas_general` |
| `saas_office` | `m365_audit_logs` |
| `saas_crm` | `saas_crm` |
| `saas_sso` | `okta_sso` |
| `saas_conferencing` | `saas_conferencing` |
| `saas_filesharing` | `saas_filesharing` |
| `cspm` | `cspm` |
| `cwpp` | `cwpp` |
| `casb` | `casb` |
| `sase` | `sase` |
| `windows_servers` | `windows_servers` |
| `linux_servers` | `linux_servers` |
| `linux_servers_nonprod` | `linux_servers_nonprod` |
| `mainframe` | `mainframe` |
| `hypervisor` | `hypervisor` |
| `database` | `database` |
| `db_transaction` | `db_transaction` |
| `db_access` | `db_access` |
| `web_servers` | `web_servers` |
| `web_servers_nonprod` | `web_servers_nonprod` |
| `app_servers` | `app_servers` |
| `app_servers_nonprod` | `app_servers_nonprod` |
| `middleware` | `middleware` |
| `middleware_nonprod` | `middleware_nonprod` |
| `apm` | `apm` |
| `pki` | `pki` |
| `sap` | `sap` |
| `desktops` | `desktops` |
| `sso_pam` | `sso_pam` |
| `active_directory` | `active_directory_security` |
| `email` | `email` |
| `mdm` | `mdm` |
| `vuln_mgmt` | `vulnerability_scanner` |
| `netflow` | `netflow_data` |
| `ids_ips` | `ids_ips` |
| `threat_intel` | `threat_intel` |
| `sandbox` | `sandbox` |
| `edr` | `edr_logs` |
| `ndr` | `ndr` |
| `dlp` | `dlp` |
| `uba` | `uba` |
| `asset_cmdb` | `asset_cmdb` |
| `deception` | `deception` |
| `firewalls` | `firewall_logs` |
| `fw_perimeter` | `fw_perimeter` |
| `fw_internal` | `fw_internal` |
| `fw_waf` | `fw_waf` |
| `switches` | `switches` |
| `routers` | `routers` |
| `vpn` | `vpn_logs` |
| `proxy` | `proxy_web_gateway` |
| `nac` | `nac` |
| `dns` | `dns_logs` |
| `dhcp` | `dhcp` |
| `loadbalancer` | `loadbalancer` |
| `ddos` | `ddos` |
| `wireless` | `wireless` |
| `dpi` | `dpi` |
| `storage_prod` | `storage_prod` |
| `ics_scada` | `ics_scada` |
| `ot_security` | `ot_security` |
| `devops_cicd` | `devops_cicd` |
| `config_mgmt` | `config_mgmt` |
| `business_txn` | `business_txn` |

## Per-source fields and estimates

### IaaS (Cloud Infrastructure) (`iaas`)

- **Category:** Cloud/SaaS Services / Infrastructure
- **Primary input for formula:** `iaasAccountCount`
- **Form fields:** *(none)*
- **Hierarchy:** Has child sources — if any child is Active/Planned, this parent row is **rolled up** (0 GB/day in totals).

- **Catalog unit:** account — Cloud account equivalent with broad IaaS logging enabled (standard mode)
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.3** / high **3** GB/day

### Containers / Pods / Clusters (`iaas_containers`)

- **Category:** Cloud/SaaS Services
- **Primary input for formula:** `containerCounts.clusters`
- **Form fields:** *(none)*

- **Catalog unit:** additive — Additive model: clusters (control-plane + audit), nodes (infrastructure), pods/containers (stdout)
- **Default bands (per unit, before scope/vendor):** low **0.000391** / medium **0.0048** / high **0.071** GB/day

### Cloud Instances / VMs (`iaas_instances`)

- **Category:** Cloud/SaaS Services
- **Primary input for formula:** `cloudVmInstanceCount`
- **Form fields:** *(none)*

- **Catalog unit:** additive — Additive model: per-instance OS, auth, agent, and optional application/service logs
- **Default bands (per unit, before scope/vendor):** low **0.000929** / medium **0.011828** / high **0.139274** GB/day

### Cloud Storage (`iaas_storage`)

- **Category:** Cloud/SaaS Services
- **Primary input for formula:** `cloudStorageAssetCount`
- **Form fields:** *(none)*

- **Catalog unit:** additive — Additive model: per-asset management, access, lifecycle, and health logs
- **Default bands (per unit, before scope/vendor):** low **0.0002** / medium **0.0032** / high **0.093** GB/day

### PaaS (Platform Services) (`paas`)

- **Category:** Cloud/SaaS Services / Platform
- **Primary input for formula:** `number_of_applications`
- **Form fields:** `number_of_applications` (number), `number_of_instances` (number), `vendor` (select)

- **Catalog unit:** application — Number of distinct PaaS applications or logical services emitting platform logs
- **Default bands (per unit, before scope/vendor):** low **0.08** / medium **0.15** / high **0.3** GB/day

### SaaS (General) (`saas_general`)

- **Category:** Cloud/SaaS Services / SaaS
- **Primary input for formula:** `number_of_users`
- **Form fields:** `number_of_users` (number), `number_of_platforms` (number), `audit_level` (select)
- **Hierarchy:** Has child sources — if any child is Active/Planned, this parent row is **rolled up** (0 GB/day in totals).

- **Catalog unit:** additive — Additive model: per tenant, per active user, and per integration/API client
- **Default bands (per unit, before scope/vendor):** low **0.00182** / medium **0.01338** / high **0.1295** GB/day

### Office Productivity (M365/Google) (`saas_office`)

- **Category:** Cloud/SaaS Services
- **Primary input for formula:** `officeActiveUserCount`
- **Form fields:** *(none)*

- **Catalog unit:** user — Number of M365 licensed users
- **Default bands (per unit, before scope/vendor):** low **0.002** / medium **0.005** / high **0.01** GB/day

### CRM (`saas_crm`)

- **Category:** Cloud/SaaS Services
- **Primary input for formula:** `crmActiveUserCount`
- **Form fields:** *(none)*

- **Catalog unit:** additive — Additive model: per tenant, active CRM user, and integration
- **Default bands (per unit, before scope/vendor):** low **0.000998** / medium **0.02668** / high **0.0805** GB/day

### SSO / Identity Provider (`saas_sso`)

- **Category:** Cloud/SaaS Services
- **Primary input for formula:** `ssoActiveUserCount`
- **Form fields:** *(none)*

- **Catalog unit:** user — Number of Okta-managed users
- **Default bands (per unit, before scope/vendor):** low **0.002** / medium **0.005** / high **0.01** GB/day

### Web Conferencing (`saas_conferencing`)

- **Category:** Cloud/SaaS Services
- **Primary input for formula:** `count`
- **Form fields:** `count` (number)

- **Catalog unit:** user — Number of collaboration/conferencing users
- **Default bands (per unit, before scope/vendor):** low **0.002** / medium **0.005** / high **0.008** GB/day

### File Sharing / Collaboration (`saas_filesharing`)

- **Category:** Cloud/SaaS Services
- **Primary input for formula:** `count`
- **Form fields:** `count` (number)

- **Catalog unit:** user — Number of users on file sharing / collaboration platforms
- **Default bands (per unit, before scope/vendor):** low **0.002** / medium **0.005** / high **0.01** GB/day

### Cloud Security Posture Management (CSPM) (`cspm`)

- **Category:** Cloud/SaaS Services / Cloud Security
- **Primary input for formula:** `number_of_accounts`
- **Form fields:** `number_of_accounts` (number), `number_of_resources` (number), `vendor` (select)

- **Catalog unit:** account — Number of cloud accounts/projects assessed by CSPM
- **Default bands (per unit, before scope/vendor):** low **0.02** / medium **0.05** / high **0.1** GB/day

### Cloud Workload Protection Platform (CWPP) (`cwpp`)

- **Category:** Cloud/SaaS Services / Cloud Security
- **Primary input for formula:** `number_of_instances`
- **Form fields:** `number_of_instances` (number), `vendor` (select)

- **Catalog unit:** instance — Number of protected workloads (VMs, containers) under CWPP telemetry
- **Default bands (per unit, before scope/vendor):** low **0.02** / medium **0.05** / high **0.1** GB/day

### Cloud Access Security Broker (CASB) (`casb`)

- **Category:** Cloud/SaaS Services / Cloud Security
- **Primary input for formula:** `number_of_users`
- **Form fields:** `number_of_users` (number), `number_of_platforms` (number)

- **Catalog unit:** user — Number of users proxied or API-governed by CASB
- **Default bands (per unit, before scope/vendor):** low **0.02** / medium **0.05** / high **0.08** GB/day

### Secure Access Service Edge (SASE) (`sase`)

- **Category:** Cloud/SaaS Services / Cloud Security
- **Primary input for formula:** `number_of_users`
- **Form fields:** `number_of_users` (number), `number_of_sites` (number)

- **Catalog unit:** user — Number of users consuming SASE/SSE (SWG, ZTNA, CASB bundle)
- **Default bands (per unit, before scope/vendor):** low **0.02** / medium **0.05** / high **0.1** GB/day

### Windows Servers (`windows_servers`)

- **Category:** Server / Windows
- **Primary input for formula:** `number_of_servers`
- **Form fields:** `number_of_servers` (number)
- **Log options:** 12 channel(s); each selected option adds `gb_per_unit` × primary server count (see `sources.json`).

- **Catalog unit:** server — Total Windows servers (physical + virtual) forwarding Windows event channels
- **Default bands (per unit, before scope/vendor):** low **0.12** / medium **0.18** / high **0.35** GB/day

### Linux / Unix Servers (Production) (`linux_servers`)

- **Category:** Server / Linux
- **Primary input for formula:** `number_of_servers`
- **Form fields:** `number_of_servers` (number), `logging_scope` (select)

- **Catalog unit:** server — Production Linux/Unix servers under centralized log collection
- **Default bands (per unit, before scope/vendor):** low **0.08** / medium **0.15** / high **0.3** GB/day

### Linux / Unix Servers (Non-Production) (`linux_servers_nonprod`)

- **Category:** Server / Linux
- **Primary input for formula:** `number_of_servers`
- **Form fields:** `number_of_servers` (number)

- **Catalog unit:** server — Non-production Linux/Unix servers (dev/test/stage) collected
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.15** / high **0.25** GB/day

### Mainframe (`mainframe`)

- **Category:** Server / Legacy
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `manual_gb_day` (number)

- **Catalog unit:** system — Mainframe LPAR/system partitions or SMF export endpoints
- **Default bands (per unit, before scope/vendor):** low **0.15** / medium **0.25** / high **0.5** GB/day

### Virtual Infrastructure (Hypervisor) (`hypervisor`)

- **Category:** Server / Virtualization
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `number_of_vms` (number), `vendor` (select)

- **Catalog unit:** node — Hypervisor hosts (ESXi, Hyper-V, KVM) exporting host and VM events
- **Default bands (per unit, before scope/vendor):** low **0.02** / medium **0.05** / high **0.15** GB/day

### Database Instances (`database`)

- **Category:** Database / RDBMS
- **Primary input for formula:** `number_of_instances`
- **Form fields:** `number_of_instances` (number), `vendor` (select), `audit_level` (select)
- **Hierarchy:** Has child sources — if any child is Active/Planned, this parent row is **rolled up** (0 GB/day in totals).

- **Catalog unit:** instance — Database instances (cluster nodes counted separately if each exports logs)
- **Default bands (per unit, before scope/vendor):** low **0.08** / medium **0.15** / high **0.35** GB/day

### Transaction Logs (`db_transaction`)

- **Category:** Database
- **Primary input for formula:** `count`
- **Form fields:** `count` (number)

- **Catalog unit:** instance — Per database instance exporting transaction/redo oriented telemetry
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.1** / high **0.2** GB/day

### Access / Audit Logs (`db_access`)

- **Category:** Database
- **Primary input for formula:** `count`
- **Form fields:** `count` (number)

- **Catalog unit:** instance — Per database instance exporting access/DDL audit streams
- **Default bands (per unit, before scope/vendor):** low **0.02** / medium **0.05** / high **0.15** GB/day

### Web Servers (Production) (`web_servers`)

- **Category:** Application / Web Tier
- **Primary input for formula:** `number_of_servers`
- **Form fields:** `number_of_servers` (number), `requests_per_day` (number)

- **Catalog unit:** server — Web servers (Apache, nginx, non-IIS) with access/error logs centralized
- **Default bands (per unit, before scope/vendor):** low **0.1** / medium **0.25** / high **0.5** GB/day

### Web Servers (Non-Production) (`web_servers_nonprod`)

- **Category:** Application / Web Tier
- **Primary input for formula:** `number_of_servers`
- **Form fields:** `number_of_servers` (number), `requests_per_day` (number)

- **Catalog unit:** server — Non-production web servers with access/error logs centralized
- **Default bands (per unit, before scope/vendor):** low **0.06** / medium **0.15** / high **0.3** GB/day

### Application Servers (Production) (`app_servers`)

- **Category:** Application / App Tier
- **Primary input for formula:** `number_of_servers`
- **Form fields:** `number_of_servers` (number), `number_of_applications` (number)

- **Catalog unit:** server — Application-tier servers (non-web primary role) forwarding application logs
- **Default bands (per unit, before scope/vendor):** low **0.1** / medium **0.25** / high **0.5** GB/day

### Application Servers (Non-Production) (`app_servers_nonprod`)

- **Category:** Application / App Tier
- **Primary input for formula:** `number_of_servers`
- **Form fields:** `number_of_servers` (number), `number_of_applications` (number)

- **Catalog unit:** server — Non-production application-tier servers forwarding application logs
- **Default bands (per unit, before scope/vendor):** low **0.06** / medium **0.15** / high **0.3** GB/day

### Middleware Services (Production) (`middleware`)

- **Category:** Application / Middleware
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `vendor` (select)

- **Catalog unit:** server — Middleware brokers/queues (Kafka, RabbitMQ, WebLogic, etc.) under collection
- **Default bands (per unit, before scope/vendor):** low **0.1** / medium **0.25** / high **0.4** GB/day

### Middleware Services (Non-Production) (`middleware_nonprod`)

- **Category:** Application / Middleware
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `vendor` (select)

- **Catalog unit:** server — Non-production middleware brokers/queues under collection
- **Default bands (per unit, before scope/vendor):** low **0.06** / medium **0.15** / high **0.24** GB/day

### APM (Application Performance Monitoring) (`apm`)

- **Category:** Application / Monitoring
- **Primary input for formula:** `number_of_applications`
- **Form fields:** `number_of_applications` (number), `number_of_instances` (number), `traces_per_day` (number)

- **Catalog unit:** application — APM-monitored application services or service names
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.1** / high **0.25** GB/day

### Public Key Infrastructure (PKI) (`pki`)

- **Category:** Application / Security Infrastructure
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `number_of_certificates` (number)

- **Catalog unit:** server — PKI issuance servers / CA hierarchy endpoints
- **Default bands (per unit, before scope/vendor):** low **0.001** / medium **0.005** / high **0.01** GB/day

### SAP (`sap`)

- **Category:** Application / Enterprise Apps
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `number_of_users` (number)

- **Catalog unit:** application — SAP application instances or logical SID groupings producing security/business logs
- **Default bands (per unit, before scope/vendor):** low **0.1** / medium **0.25** / high **0.5** GB/day

### Desktops / Workstations (`desktops`)

- **Category:** End-User Support / Endpoints
- **Primary input for formula:** `number_of_endpoints`
- **Form fields:** `number_of_endpoints` (number), `logging_scope` (select)

- **Catalog unit:** endpoint — Managed end-user desktops and laptops with log collection
- **Default bands (per unit, before scope/vendor):** low **0.002** / medium **0.004** / high **0.012** GB/day

### User Authentication (SSO / PAM / IAM) (`sso_pam`)

- **Category:** End-User Support / Identity
- **Primary input for formula:** `number_of_users`
- **Form fields:** `number_of_users` (number), `vendor` (select)

- **Catalog unit:** user — Users authenticating through centralized SSO/PAM/IAM flows
- **Default bands (per unit, before scope/vendor):** low **0.0004** / medium **0.001** / high **0.004** GB/day

### Active Directory / Domain Controllers (`active_directory`)

- **Category:** End-User Support / Identity
- **Primary input for formula:** `number_of_dcs`
- **Form fields:** `number_of_users` (number), `number_of_dcs` (number)

- **Catalog unit:** domain_controller — Number of Active Directory domain controllers
- **Default bands (per unit, before scope/vendor):** low **0.15** / medium **0.25** / high **0.75** GB/day

### Email Servers / Email Gateways (`email`)

- **Category:** End-User Support / Communication
- **Primary input for formula:** `number_of_users`
- **Form fields:** `number_of_users` (number), `vendor` (select), `logging_scope` (select)

- **Catalog unit:** server — Mail servers or gateways (Exchange, SMTP relays, secure gateways) exporting message tracking/filter logs
- **Default bands (per unit, before scope/vendor):** low **0.1** / medium **0.25** / high **0.5** GB/day

### Mobile Device Management (MDM) (`mdm`)

- **Category:** End-User Support / Mobile
- **Primary input for formula:** `number_of_devices`
- **Form fields:** `number_of_devices` (number), `vendor` (select)

- **Catalog unit:** device — Managed mobile devices under MDM/UEM telemetry
- **Default bands (per unit, before scope/vendor):** low **0.1** / medium **0.5** / high **0.75** GB/day

### Vulnerability Management (`vuln_mgmt`)

- **Category:** Security & Compliance / Vulnerability
- **Primary input for formula:** `number_of_assets`
- **Form fields:** `number_of_assets` (number), `scan_frequency` (select), `vendor` (select)

- **Catalog unit:** asset — Number of assets scanned
- **Default bands (per unit, before scope/vendor):** low **0.00005** / medium **0.0001** / high **0.0003** GB/day

### Network Traffic Analysis / NetFlow (`netflow`)

- **Category:** Security & Compliance / Network Security
- **Primary input for formula:** `number_of_devices`
- **Form fields:** `number_of_devices` (number), `sampling_rate` (select)

- **Catalog unit:** exporter — Number of NetFlow/sFlow/IPFIX exporters
- **Default bands (per unit, before scope/vendor):** low **0.1** / medium **0.5** / high **2** GB/day

### Intrusion Prevention/Detection Systems (IPS/IDS) (`ids_ips`)

- **Category:** Security & Compliance / Network Security
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `vendor` (select)

- **Catalog unit:** sensor — IPS/IDS sensors or managed detection taps (physical or virtual)
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.15** / high **0.4** GB/day

### Threat Intelligence Feeds (`threat_intel`)

- **Category:** Security & Compliance / Threat Intelligence
- **Primary input for formula:** `number_of_feeds`
- **Form fields:** `number_of_feeds` (number), `vendor` (select)

- **Catalog unit:** manual — Intel source feeds or integration endpoints (STIX/TAXII, commercial bundles)
- **Default bands (per unit, before scope/vendor):** low **0.01** / medium **0.05** / high **0.1** GB/day

### Automated Malware Analysis (Sandbox) (`sandbox`)

- **Category:** Security & Compliance / Threat Intelligence
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `submissions_per_day` (number)

- **Catalog unit:** device — Sandbox analysis appliances or cloud sandbox tenant units
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.15** / high **0.3** GB/day

### EDR (Endpoint Detection & Response) (`edr`)

- **Category:** Security & Compliance / Endpoint Security
- **Primary input for formula:** `number_of_endpoints`
- **Form fields:** `number_of_endpoints` (number), `number_of_servers` (number), `vendor` (select)

- **Catalog unit:** endpoint — Number of managed endpoints (laptops, desktops, servers) with EDR agent
- **Default bands (per unit, before scope/vendor):** low **0.005** / medium **0.012** / high **0.035** GB/day
- **Vendor / model reference (from sizingRates.json):**

- **CrowdStrike Falcon** — low/med/high per unit: 0.006 / 0.014 / 0.04 GB/d
- **Microsoft Defender for Endpoint** — low/med/high per unit: 0.004 / 0.01 / 0.025 GB/d
- **SentinelOne** — low/med/high per unit: 0.006 / 0.015 / 0.035 GB/d
- **Carbon Black** — low/med/high per unit: 0.008 / 0.02 / 0.05 GB/d

### NDR (Network Detection & Response) (`ndr`)

- **Category:** Security & Compliance / Network Security
- **Primary input for formula:** `number_of_sensors`
- **Form fields:** `number_of_sensors` (number), `bandwidth_gbps` (number), `vendor` (select)

- **Catalog unit:** sensor — NDR sensors or passive taps covering east-west traffic
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.15** / high **0.4** GB/day

### Data Loss/Leakage Prevention (DLP) (`dlp`)

- **Category:** Security & Compliance / Data Security
- **Primary input for formula:** `number_of_users`
- **Form fields:** `number_of_users` (number), `number_of_channels` (number), `dlpSizingProfile` (select)

- **Catalog unit:** user — Users or protected endpoints under DLP policy enforcement telemetry
- **Default bands (per unit, before scope/vendor):** low **0.02** / medium **0.05** / high **0.1** GB/day

### User Behavior Analytics (UBA/UEBA) (`uba`)

- **Category:** Security & Compliance / Analytics
- **Primary input for formula:** `number_of_users`
- **Form fields:** `number_of_users` (number)

- **Catalog unit:** user — Users modeled in UEBA (behavior analytics product user entities)
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.15** / high **0.25** GB/day

### Asset & Identity Lists (CMDB / AD / LDAP) (`asset_cmdb`)

- **Category:** Security & Compliance / Asset Management
- **Primary input for formula:** `number_of_assets`
- **Form fields:** `number_of_assets` (number), `assetExportProfile` (select), `vendor` (select)

- **Catalog unit:** asset — Assets synchronized from CMDB/ITAM/discovery feeds
- **Default bands (per unit, before scope/vendor):** low **0.01** / medium **0.025** / high **0.05** GB/day

### Deception Technology (`deception`)

- **Category:** Security & Compliance / Advanced Detection
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `vendor` (select)

- **Catalog unit:** sensor — Deception tokens/decoys/beacons under management
- **Default bands (per unit, before scope/vendor):** low **0.005** / medium **0.015** / high **0.03** GB/day

### Firewalls (Next-Gen Firewalls) (`firewalls`)

- **Category:** Networking / Perimeter
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_users` (number), `number_of_systems` (number), `vendor` (select), `logging_scope` (select)
- **Hierarchy:** Has child sources — if any child is Active/Planned, this parent row is **rolled up** (0 GB/day in totals).

- **Catalog unit:** device — Number of firewall appliances/instances generating logs
- **Default bands (per unit, before scope/vendor):** low **0.1** / medium **0.35** / high **1.5** GB/day
- **Vendor / model reference (from sizingRates.json):**

- **Palo Alto Networks** — models: PA-220: 0.05 / 0.1 / 0.3 GB/d; PA-440: 0.1 / 0.2 / 0.5 GB/d; PA-3200: 0.2 / 0.5 / 1.5 GB/d; PA-5200: 0.5 / 1 / 3 GB/d; PA-7000: 1 / 2 / 5 GB/d; VM-Series: 0.1 / 0.3 / 1 GB/d; Prisma Access: 0.001 / 0.002 / 0.005 GB/d
- **Fortinet** — models: FortiGate 60/80: 0.05 / 0.1 / 0.3 GB/d; FortiGate 100-200: 0.15 / 0.3 / 0.8 GB/d; FortiGate 600-1000: 0.3 / 0.6 / 1.5 GB/d; FortiGate 3000+: 0.8 / 1.5 / 4 GB/d
- **Cisco ASA/FTD** — low/med/high per unit: 0.2 / 0.5 / 1.8 GB/d
- **Check Point** — low/med/high per unit: 0.2 / 0.45 / 1.5 GB/d
- **Scope multipliers (catalog keys):**
  - `traffic_only`: ×0.7
  - `basic_traffic`: ×0.7
  - `traffic_and_threat`: ×1
  - `traffic_threat_utm`: ×1.1
  - `traffic_threat_url`: ×1.3
  - `full_verbose`: ×1.8

### Perimeter Firewalls (`fw_perimeter`)

- **Category:** Networking
- **Primary input for formula:** `count`
- **Form fields:** `count` (number)

- **Catalog unit:** device — Internet-edge / north-south NGFW devices
- **Default bands (per unit, before scope/vendor):** low **0.2** / medium **0.55** / high **1.5750000000000002** GB/day

### Internal Segmentation Firewalls (`fw_internal`)

- **Category:** Networking
- **Primary input for formula:** `count`
- **Form fields:** `count` (number)

- **Catalog unit:** device — Internal segmentation / east-west firewall contexts
- **Default bands (per unit, before scope/vendor):** low **0.13999999999999999** / medium **0.375** / high **1.275** GB/day

### Web Application Firewall (WAF) (`fw_waf`)

- **Category:** Networking
- **Primary input for formula:** `count`
- **Form fields:** `count` (number)

- **Catalog unit:** device — WAF appliances, WAAP edge nodes, or equivalent protected origins
- **Default bands (per unit, before scope/vendor):** low **0.15000000000000002** / medium **0.425** / high **1.35** GB/day

### Network Switches (`switches`)

- **Category:** Networking / Infrastructure
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number)

- **Catalog unit:** device — Managed switches exporting syslog or security telemetry
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.15** / high **0.3** GB/day

### Routers (`routers`)

- **Category:** Networking / Infrastructure
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number)

- **Catalog unit:** device — Routers exporting routing and security syslog
- **Default bands (per unit, before scope/vendor):** low **0.1** / medium **0.25** / high **0.5** GB/day

### VPN Gateways (`vpn`)

- **Category:** Networking / Remote Access
- **Primary input for formula:** `number_of_users`
- **Form fields:** `number_of_users` (number), `number_of_systems` (number), `vendor` (select)

- **Catalog unit:** user — Number of VPN users
- **Default bands (per unit, before scope/vendor):** low **0.0004** / medium **0.001** / high **0.003** GB/day

### Web Proxy / Secure Web Gateway (`proxy`)

- **Category:** Networking / Perimeter
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_users` (number), `number_of_systems` (number), `vendor` (select)

- **Catalog unit:** device — Number of proxy/SWG appliances or virtual instances
- **Default bands (per unit, before scope/vendor):** low **0.5** / medium **1** / high **2** GB/day

### Network Access Control (NAC) (`nac`)

- **Category:** Networking / Access Control
- **Primary input for formula:** `number_of_devices`
- **Form fields:** `number_of_devices` (number), `vendor` (select)

- **Catalog unit:** device — NAC enforcement appliances or head-end clusters
- **Default bands (per unit, before scope/vendor):** low **0.1** / medium **0.25** / high **0.5** GB/day

### DNS (`dns`)

- **Category:** Networking / Infrastructure
- **Primary input for formula:** `number_of_servers`
- **Form fields:** `number_of_users` (number), `number_of_servers` (number), `query_logging` (select)

- **Catalog unit:** server — Number of DNS servers/resolvers generating logs
- **Default bands (per unit, before scope/vendor):** low **0.03** / medium **0.08** / high **0.25** GB/day

### DHCP (`dhcp`)

- **Category:** Networking / Infrastructure
- **Primary input for formula:** `number_of_servers`
- **Form fields:** `number_of_servers` (number), `number_of_leases` (number)

- **Catalog unit:** device — DHCP servers or IPAM-managed DHCP service heads
- **Default bands (per unit, before scope/vendor):** low **0.03** / medium **0.1** / high **0.2** GB/day

### Load Balancers (`loadbalancer`)

- **Category:** Networking / Infrastructure
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `vendor` (select)

- **Catalog unit:** device — Load balancer / ADC instances emitting access and health-check logs
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.1** / high **0.25** GB/day

### DDoS Protection (`ddos`)

- **Category:** Networking / Perimeter
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number)

- **Catalog unit:** device — On-prem or service scrubbing centers exporting attack telemetry
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.15** / high **0.3** GB/day

### Wireless Access Points (`wireless`)

- **Category:** Networking / Infrastructure
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number)

- **Catalog unit:** device — Wireless LAN controllers or autonomous AP management exports
- **Default bands (per unit, before scope/vendor):** low **0.02** / medium **0.05** / high **0.1** GB/day

### Deep Packet Inspection / Full PCAP (`dpi`)

- **Category:** Networking / Network Security
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `bandwidth_gbps` (number)

- **Catalog unit:** sensor — DPI sensors or appliances performing deep inspection / optional PCAP retention
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.1** / high **0.5** GB/day

### Production Storage Arrays (`storage_prod`)

- **Category:** Storage / Production
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `manual_gb_day` (number)

- **Catalog unit:** system — Enterprise storage arrays or unified storage systems exporting audit/diagnostic feeds
- **Default bands (per unit, before scope/vendor):** low **0.1** / medium **0.25** / high **0.4** GB/day

### ICS / SCADA Systems (`ics_scada`)

- **Category:** OT/ICS / Control Systems
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `number_of_sensors` (number), `vendor` (select), `manual_gb_day` (number)

- **Catalog unit:** device — ICS controllers, historians, or SCADA hosts monitored
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.15** / high **0.3** GB/day

### OT Security Solutions (OT IDS) (`ot_security`)

- **Category:** OT/ICS / OT Security
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `vendor` (select)

- **Catalog unit:** sensor — Dedicated OT IDS/visibility sensors or passive monitoring taps
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.15** / high **0.3** GB/day

### CI/CD and Build Systems (`devops_cicd`)

- **Category:** Application Development / DevOps
- **Primary input for formula:** `number_of_pipelines`
- **Form fields:** `number_of_pipelines` (number), `number_of_builds_per_day` (number), `vendor` (select)

- **Catalog unit:** application — CI/CD controllers (Jenkins, GitLab Runners, GitHub Actions org exports) aggregated
- **Default bands (per unit, before scope/vendor):** low **0.1** / medium **0.25** / high **0.5** GB/day

### Configuration Management / Deployment Tools (`config_mgmt`)

- **Category:** Application Development / DevOps
- **Primary input for formula:** `number_of_systems`
- **Form fields:** `number_of_systems` (number), `vendor` (select)

- **Catalog unit:** server — Configuration management servers (Ansible Tower, Puppet, Chef, SCCM related exports)
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.1** / high **0.2** GB/day

### Business Transaction Logs (`business_txn`)

- **Category:** Business Services / Transactions
- **Primary input for formula:** `number_of_applications`
- **Form fields:** `number_of_applications` (number), `transactions_per_day` (number)

- **Catalog unit:** application — Business applications emitting transaction/audit logs (POS, ERP events, etc.)
- **Default bands (per unit, before scope/vendor):** low **0.05** / medium **0.1** / high **0.5** GB/day
