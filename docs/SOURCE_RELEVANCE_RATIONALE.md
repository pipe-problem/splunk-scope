# Source relevance rationale

Changes to [`src/data/sourceUseCaseMappings.json`](../src/data/sourceUseCaseMappings.json) (2026-09-16).
UI scores out of 10 come from `ceil(priorityScore / 10)` in `sourcePrioritizationEngine`; this file is the use-case input to that score.

Capability IDs in `logRequirements.json` were aliased to live catalog source ids in `logRequirementEngine.js` (`REQUIREMENT_SOURCE_ID_ALIASES`) so gap-closure (30% of the score) actually fires for `firewalls`, `edr`, `active_directory`, and `saas_sso`.

`relevance: "low"` now contributes **0** (was a hidden +3 for any non high/medium value).

| Source | Change | Why | Source |
|---|---|---|---|
| `active_directory` | `cloud_security` high → medium; drop `kubernetes_container` | CIM Authentication treats AD as an identity service (`authentication_service` examples include ActiveDirectory). It corroborates hybrid identity in cloud programs but is not CSPM/control-plane evidence. AD is not a Kubernetes telemetry class. | [CIM Authentication](https://help.splunk.com/en/splunk-cloud-platform/common-information-model/8.6/data-models/authentication) |
| `windows_servers` | Drop `cloud_security` and `database_monitoring`; ES medium → high; add `threat_detection` high | Windows Security maps to Authentication and Endpoint models used by ES detections; it is not cloud posture or database audit. | [Windows add-on CIM mapping](https://docs.splunk.com/Documentation/WindowsAddOn/8.1.2/User/CIMModelandFieldMappingChanges); [ES CIM setup](https://help.splunk.com/en/splunk-enterprise-security-7/risk-based-alerting/7.3/best-practices/configure-data-models-to-normalize-data-for-splunk-enterprise-security) |
| `firewalls` | `threat_detection` medium → high; drop `kubernetes_container` | NGFW traffic/threat logs populate Network Traffic and Intrusion Detection — primary ES evidence, not a k8s source. | [Palo Alto CIM normalization](https://splunk.github.io/splunk-add-on-for-palo-alto-networks/DataNormalization/); ES network diversity guidance |
| `dns` | `enterprise_security` medium → high | Network Resolution (DNS) is listed with authentication, web, email, and IDS as core SIEM diversity. | [ES CIM / data diversity](https://help.splunk.com/en/splunk-enterprise-security-7/risk-based-alerting/7.3/best-practices/configure-data-models-to-normalize-data-for-splunk-enterprise-security) |
| `netflow` | `threat_detection` → high; drop `kubernetes_container`; ES stays medium | Flow metadata is high-signal for threat hunting and network ops; on low-budget SIEM it remains enrichment (not Suggested) when firewalls/AD/EDR are the minimum viable set. | ES network diversity; enrichmentSourceIds clamp |
| `cspm` | ES high → medium; `foundational_security` → low | CSPM is a primary **cloud_security** / compliance source (config posture), not a substitute for on-prem SIEM foundations (AD, firewall, endpoint). Cloud-only clamp remains. | Cloud posture is configuration/API audit, not Network Traffic / Endpoint |
| `cwpp` | ES and `endpoint_security` high → medium | Workload protection is cloud/k8s-primary; it is not a replacement for host EDR on endpoints. | Distinct from Endpoint CIM (processes/filesystem) used by EDR |
| `casb` | ES and `identity_access` high → medium | CASB is SaaS access/control (cloud_security), not an IdP. Everyday SSO stays on `saas_sso` / AD. | CASB vs Authentication CIM (`Okta`, `ActiveDirectory`, `AzureAD`) |
| `edr` | Drop `kubernetes_container` | Endpoint CIM (processes, filesystem) is host EDR, not kube-audit. CWPP covers workload. | ES Endpoint data model usage |

Northstar / on-prem SIEM: `cspm` and `cwpp` must still not land in **suggested** when cloud is not in scope (`cloudOnlySourceIds` −25). Identity use cases still rank AD / SSO / PAM high. Network ops still ranks firewalls, netflow, and DNS high.
