#!/usr/bin/env python3
"""
Generate synthetic SaaS (General) log samples, measure raw UTF-8 sizes,
and compute additive sizing rates for Splunk Scope v2 model.
"""

import csv
import json
import random
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "deliverables" / "saas_general_v2"
ZIP_PATH = ROOT / "deliverables" / "saas_general_synthetic_logs_v2.zip"
CSV_PATH = ROOT / "deliverables" / "saas_general_measured_sizing_v2.csv"
RATES_JSON = ROOT / "src" / "data" / "saasSizingRates.json"

VENDORS = {
    "salesforce": "Salesforce",
    "servicenow": "ServiceNow",
    "workday": "Workday",
    "box": "Box",
    "atlassian_cloud": "Atlassian Cloud",
}

COMPONENTS = {
    "admin_config_audit": {
        "label": "Admin / configuration audit events",
        "unit": "tenant",
        "unitLabel": "tenant / org / instance",
    },
    "auth_access_security": {
        "label": "Authentication / access security events",
        "unit": "active user",
        "unitLabel": "active user",
    },
    "user_activity_content": {
        "label": "User activity / object/content events",
        "unit": "active user",
        "unitLabel": "active user",
    },
    "api_integration_events": {
        "label": "API / integration events",
        "unit": "integration",
        "unitLabel": "integration / API client",
    },
}

ACTIVITY_PROFILES = ["light", "normal", "heavy"]
ACTIVITY_LEVEL_MAP = {"light": "low", "normal": "medium", "heavy": "high"}

EVENT_RATES = {
    "admin_config_audit": {"light": 100, "normal": 1000, "heavy": 10000},
    "auth_access_security": {"light": 2, "normal": 8, "heavy": 30},
    "user_activity_content": {"light": 5, "normal": 40, "heavy": 200},
    "api_integration_events": {"light": 250, "normal": 5000, "heavy": 50000},
}

COLLECTION_PROFILES = {
    "audit_only": {
        "label": "Audit only",
        "description": "Admin/configuration and authentication/access security events.",
        "components": ["admin_config_audit", "auth_access_security"],
    },
    "standard_activity": {
        "label": "Standard activity",
        "description": "Audit events plus user activity and object/content changes.",
        "components": ["admin_config_audit", "auth_access_security", "user_activity_content"],
    },
    "full_activity": {
        "label": "Full activity",
        "description": "Audit, user activity, and API/integration events.",
        "components": [
            "admin_config_audit",
            "auth_access_security",
            "user_activity_content",
            "api_integration_events",
        ],
    },
}

IPS = ["192.0.2.10", "192.0.2.55", "198.51.100.12", "198.51.100.88", "203.0.113.42"]
DOMAINS = ["example.com", "example.net"]
EVENTS_PER_BUCKET = 2500
GB_DIV = 1024 ** 3

random.seed(42)


def pick_ip():
    return random.choice(IPS)


def pick_domain():
    return random.choice(DOMAINS)


def ts():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def gen_event(vendor: str, component: str, profile: str, idx: int) -> str:
    """Return raw JSON line string (no trailing newline)."""
    user = f"user{idx % 500}@{pick_domain()}"
    tenant = f"tenant-{idx % 20:03d}"
    org = f"org-{idx % 15:03d}"
    req = f"req-{vendor[:3]}-{idx:08d}"
    ip = pick_ip()
    ua = "Mozilla/5.0 (compatible; ExampleBot/1.0; +https://example.com/bot)"

    base = {
        "timestamp": ts(),
        "tenant_id": tenant,
        "org_id": org,
        "request_id": req,
        "source_ip": ip,
        "user_agent": ua,
        "vendor": VENDORS[vendor],
        "activity_profile": profile,
    }

    if component == "admin_config_audit":
        extra = {
            "event_type": "ADMIN_AUDIT",
            "admin_user": f"admin{idx % 12}@{pick_domain()}",
            "action": random.choice(["UPDATE", "CREATE", "DELETE", "ENABLE", "DISABLE"]),
            "object_type": random.choice(["PermissionSet", "Profile", "Flow", "ConnectedApp", "Role"]),
            "object_id": f"cfg-{idx:06d}",
            "old_value": "enabled=false",
            "new_value": "enabled=true",
            "session_id": f"sess-admin-{idx}",
        }
        if vendor == "salesforce":
            extra.update(
                {
                    "EVENT_TYPE": "SetupAuditTrail",
                    "SECTION": "Setup",
                    "DISPLAY": "Changed profile assignment",
                    "ORGANIZATION_ID": org,
                }
            )
        elif vendor == "servicenow":
            extra.update(
                {
                    "table": "sys_audit",
                    "documentkey": f"record-{idx}",
                    "fieldname": "state",
                    "oldvalue": "1",
                    "newvalue": "2",
                }
            )
        elif vendor == "workday":
            extra.update(
                {
                    "integration_system": f"wd-int-{idx % 5}",
                    "task_name": "SecurityPolicyUpdate",
                    "business_process": "AdminChange",
                }
            )
        elif vendor == "box":
            extra.update({"type": "ADMIN_LOGIN", "service_id": f"svc-{idx % 8}"})
        elif vendor == "atlassian_cloud":
            extra.update(
                {
                    "action": "site_administration_changed",
                    "site_id": f"site-{idx % 6}",
                    "product": random.choice(["jira", "confluence"]),
                }
            )

    elif component == "auth_access_security":
        extra = {
            "event_type": "AUTH",
            "user": user,
            "login_result": random.choice(["SUCCESS", "FAILURE", "CHALLENGE"]),
            "mfa_used": random.choice([True, False]),
            "sso_provider": random.choice(["okta", "entra", "native"]),
            "session_id": f"sess-{idx:08d}",
            "geo_country": random.choice(["US", "CA", "GB", "DE"]),
            "geo_city": random.choice(["Example City", "Sample Town"]),
            "risk_level": random.choice(["LOW", "MEDIUM", "HIGH"]),
            "device_id": f"device-{idx % 200}",
        }
        if vendor == "salesforce":
            extra.update({"EVENT_TYPE": "Login", "LOGIN_STATUS": extra["login_result"]})
        elif vendor == "servicenow":
            extra.update({"event": "login", "username": user, "status": extra["login_result"]})
        elif vendor == "workday":
            extra.update({"signon_type": "SAML", "authentication_type": "SSO"})
        elif vendor == "box":
            extra.update({"type": "LOGIN", "created_by": {"login": user}})
        elif vendor == "atlassian_cloud":
            extra.update({"action": "user_logged_in", "actor": {"email": user}})

    elif component == "user_activity_content":
        obj_type = random.choice(["Case", "Incident", "File", "Report", "Page", "Ticket"])
        extra = {
            "event_type": "USER_ACTIVITY",
            "user": user,
            "object_type": obj_type,
            "object_id": f"obj-{idx:08d}",
            "operation": random.choice(["VIEW", "UPDATE", "DOWNLOAD", "EXPORT", "CREATE", "DELETE"]),
            "status": random.choice(["SUCCESS", "FAILURE"]),
            "record_count": random.randint(1, 50 if profile == "light" else 500),
        }
        if vendor == "salesforce":
            extra.update(
                {
                    "EVENT_TYPE": "ReportEvent",
                    "REPORT_ID": f"report-{idx % 100}",
                    "ROWS_PROCESSED": extra["record_count"],
                }
            )
        elif vendor == "servicenow":
            extra.update(
                {
                    "table": random.choice(["incident", "change_request", "task"]),
                    "sys_id": extra["object_id"],
                    "operation": extra["operation"].lower(),
                }
            )
        elif vendor == "workday":
            extra.update(
                {
                    "business_process": random.choice(["Report", "Integration", "Task"]),
                    "report_name": f"wd-report-{idx % 40}",
                }
            )
        elif vendor == "box":
            extra.update(
                {
                    "type": random.choice(["DOWNLOAD", "UPLOAD", "PREVIEW", "SHARE"]),
                    "item_name": f"file-{idx % 300}.pdf",
                    "item_id": extra["object_id"],
                }
            )
        elif vendor == "atlassian_cloud":
            extra.update(
                {
                    "action": random.choice(["page_viewed", "issue_updated", "comment_created"]),
                    "object": {"id": extra["object_id"], "type": obj_type.lower()},
                }
            )
        if profile == "heavy":
            extra["detail_payload"] = "x" * random.randint(80, 200)
        elif profile == "light":
            pass
        else:
            extra["detail_payload"] = "x" * random.randint(20, 80)

    else:  # api_integration_events
        client = f"integration-{idx % 40}"
        extra = {
            "event_type": "API",
            "integration_client": client,
            "service_account": f"svc-{client}@{pick_domain()}",
            "api_operation": random.choice(["GET", "POST", "PUT", "DELETE", "QUERY"]),
            "endpoint": f"/api/v1/{random.choice(['records', 'bulk', 'query', 'events'])}",
            "http_status": random.choice([200, 201, 400, 401, 429, 500]),
            "response_time_ms": random.randint(20, 2500),
            "records_processed": random.randint(1, 5000 if profile == "heavy" else 200),
            "correlation_id": f"corr-{idx:10d}",
        }
        if vendor == "salesforce":
            extra.update({"API_TYPE": "REST", "CLIENT_ID": client, "ROWS_PROCESSED": extra["records_processed"]})
        elif vendor == "servicenow":
            extra.update({"table": "sys_log", "source": client, "level": "info"})
        elif vendor == "workday":
            extra.update({"integration_name": client, "integration_event": "OutboundDelivery"})
        elif vendor == "box":
            extra.update({"type": "API_CALL", "api_key_id": f"key-{idx % 30}"})
        elif vendor == "atlassian_cloud":
            extra.update({"action": "api_request", "client_id": client})

    base.update(extra)
    return json.dumps(base, separators=(",", ":"))


def measure_events(vendor, component, profile):
    sizes = []
    lines = []
    for i in range(EVENTS_PER_BUCKET):
        line = gen_event(vendor, component, profile, i)
        raw = (line + "\n").encode("utf-8")
        sizes.append(len(raw))
        lines.append(line)
    avg = sum(sizes) / len(sizes)
    return avg, lines


def gb_per_unit(events_per_day: float, avg_bytes: float) -> float:
    return (events_per_day * avg_bytes) / GB_DIV


def compute_vendor_rates(vendor: str, avg_bytes: dict) -> dict:
    """avg_bytes[component][profile] -> rates[component][low|medium|high]"""
    rates = {}
    for comp in COMPONENTS:
        rates[comp] = {}
        for profile in ACTIVITY_PROFILES:
            tier = ACTIVITY_LEVEL_MAP[profile]
            epd = EVENT_RATES[comp][profile]
            rates[comp][tier] = gb_per_unit(epd, avg_bytes[comp][profile])
    return rates


def scenario_total(vendor_rates, tenants, users, integrations, profile_key, activity_tier):
    comps = COLLECTION_PROFILES[profile_key]["components"]
    total = 0.0
    for comp in comps:
        rate = vendor_rates[comp][activity_tier]
        if comp == "admin_config_audit":
            total += rate * tenants
        elif comp in ("auth_access_security", "user_activity_content"):
            total += rate * users
        elif comp == "api_integration_events":
            total += rate * integrations
    return total


def blend_vendor_rates(all_rates: dict) -> dict:
    keys = list(VENDORS.keys())
    blended = {}
    for comp in COMPONENTS:
        blended[comp] = {}
        for tier in ("low", "medium", "high"):
            blended[comp][tier] = sum(all_rates[v][comp][tier] for v in keys) / len(keys)
    return blended


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    logs_dir = OUT_DIR / "sample_logs"
    logs_dir.mkdir(exist_ok=True)

    avg_bytes = {v: {c: {} for c in COMPONENTS} for v in VENDORS}
    vendor_rates = {}

    size_rows = []
    for vendor in VENDORS:
        for comp in COMPONENTS:
            for profile in ACTIVITY_PROFILES:
                avg, lines = measure_events(vendor, comp, profile)
                avg_bytes[vendor][comp][profile] = avg
                size_rows.append(
                    {
                        "vendor": VENDORS[vendor],
                        "component": COMPONENTS[comp]["label"],
                        "activity_profile": profile,
                        "sample_count": EVENTS_PER_BUCKET,
                        "avg_bytes_per_event": avg,
                    }
                )
                log_path = logs_dir / f"{vendor}_{comp}_{profile}.jsonl"
                with open(log_path, "w", encoding="utf-8") as f:
                    for line in lines[:50]:  # keep ZIP smaller; full set measured above
                        f.write(line + "\n")
        vendor_rates[vendor] = compute_vendor_rates(vendor, avg_bytes[vendor])

    vendor_rates["average_blended"] = blend_vendor_rates(vendor_rates)

    # Component rates table
    component_rows = []
    for vendor_id, vendor_label in VENDORS.items():
        for comp_id, comp_meta in COMPONENTS.items():
            r = vendor_rates[vendor_id][comp_id]
            component_rows.append(
                {
                    "Vendor": vendor_label,
                    "Component": comp_meta["label"],
                    "Unit": comp_meta["unitLabel"],
                    "Low GB/day": r["low"],
                    "Medium GB/day": r["medium"],
                    "High GB/day": r["high"],
                    "Avg bytes/event low": avg_bytes[vendor_id][comp_id]["light"],
                    "Avg bytes/event medium": avg_bytes[vendor_id][comp_id]["normal"],
                    "Avg bytes/event high": avg_bytes[vendor_id][comp_id]["heavy"],
                }
            )
    # blended row
    for comp_id, comp_meta in COMPONENTS.items():
        r = vendor_rates["average_blended"][comp_id]
        component_rows.append(
            {
                "Vendor": "Average / Blended",
                "Component": comp_meta["label"],
                "Unit": comp_meta["unitLabel"],
                "Low GB/day": r["low"],
                "Medium GB/day": r["medium"],
                "High GB/day": r["high"],
                "Avg bytes/event low": sum(avg_bytes[v][comp_id]["light"] for v in VENDORS) / len(VENDORS),
                "Avg bytes/event medium": sum(avg_bytes[v][comp_id]["normal"] for v in VENDORS) / len(VENDORS),
                "Avg bytes/event high": sum(avg_bytes[v][comp_id]["heavy"] for v in VENDORS) / len(VENDORS),
            }
        )

    scenarios = {
        "Small SaaS": (1, 50, 1),
        "Medium SaaS": (1, 500, 5),
        "Large SaaS": (2, 5000, 20),
    }
    rollup_rows = []
    for vendor_id, vendor_label in {**VENDORS, "average_blended": "Average / Blended"}.items():
        rates = vendor_rates[vendor_id]
        for scen_name, (t, u, i) in scenarios.items():
            for profile_key in COLLECTION_PROFILES:
                rollup_rows.append(
                    {
                        "Vendor": vendor_label,
                        "Scenario": scen_name,
                        "Profile": COLLECTION_PROFILES[profile_key]["label"],
                        "Low GB/day": scenario_total(rates, t, u, i, profile_key, "low"),
                        "Medium GB/day": scenario_total(rates, t, u, i, profile_key, "medium"),
                        "High GB/day": scenario_total(rates, t, u, i, profile_key, "high"),
                    }
                )

    defaults_rows = []
    for vendor_id, vendor_label in {**VENDORS, "average_blended": "Average / Blended"}.items():
        rates = vendor_rates[vendor_id]
        defaults_rows.append(
            {
                "Vendor": vendor_label,
                "Default profile": "Standard activity",
                "Default activity level": "Normal",
                "Small medium GB/day": scenario_total(rates, 1, 50, 1, "standard_activity", "medium"),
                "Medium medium GB/day": scenario_total(rates, 1, 500, 5, "standard_activity", "medium"),
                "Large medium GB/day": scenario_total(rates, 2, 5000, 20, "standard_activity", "medium"),
            }
        )

    # Write main CSV
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=list(component_rows[0].keys()),
        )
        w.writeheader()
        w.writerows(component_rows)

    # Build JSON for app
    vendors_json = {}
    for vendor_id, label in {**VENDORS, "average_blended": "Average / Blended"}.items():
        comps = {}
        for comp_id, comp_meta in COMPONENTS.items():
            r = vendor_rates[vendor_id][comp_id]
            comps[comp_id] = {
                "label": comp_meta["label"],
                "unit": comp_meta["unit"],
                "unitLabel": comp_meta["unitLabel"],
                "low": r["low"],
                "medium": r["medium"],
                "high": r["high"],
                "avgBytesLight": avg_bytes.get(vendor_id, {}).get(comp_id, {}).get("light")
                or sum(avg_bytes[v][comp_id]["light"] for v in VENDORS) / len(VENDORS),
                "avgBytesNormal": avg_bytes.get(vendor_id, {}).get(comp_id, {}).get("normal")
                or sum(avg_bytes[v][comp_id]["normal"] for v in VENDORS) / len(VENDORS),
                "avgBytesHeavy": avg_bytes.get(vendor_id, {}).get(comp_id, {}).get("heavy")
                or sum(avg_bytes[v][comp_id]["heavy"] for v in VENDORS) / len(VENDORS),
            }
        vendors_json[vendor_id] = {"label": label, "components": comps}

    rates_doc = {
        "description": "Modeled Splunk ingest planning defaults measured from synthetic raw event samples — not official vendor sizing.",
        "methodology": "GB/day = events_per_unit_per_day × avg_raw_utf8_bytes / 1024³",
        "eventRatesPerDay": EVENT_RATES,
        "vendors": vendors_json,
        "collectionProfiles": COLLECTION_PROFILES,
        "activityLevels": {
            "light": {"label": "Light", "tier": "low"},
            "normal": {"label": "Normal", "tier": "medium"},
            "heavy": {"label": "Heavy", "tier": "high"},
        },
        "overlapSourceIds": [
            "saas_office",
            "saas_crm",
            "saas_sso",
            "saas_conferencing",
            "saas_filesharing",
            "casb",
            "dlp",
        ],
    }
    RATES_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(RATES_JSON, "w", encoding="utf-8") as f:
        json.dump(rates_doc, f, indent=2)
        f.write("\n")

    # methodology.md
    methodology = """# SaaS (General) Sizing Methodology v2

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
"""
    (OUT_DIR / "methodology.md").write_text(methodology, encoding="utf-8")

    # sample examples
    examples = []
    for vendor in list(VENDORS.keys())[:2]:
        for comp in list(COMPONENTS.keys())[:2]:
            line = gen_event(vendor, comp, "normal", 1)
            examples.append(f"### {VENDORS[vendor]} — {COMPONENTS[comp]['label']}\n```json\n{line}\n```\n")
    (OUT_DIR / "sample_examples.md").write_text("\n".join(examples), encoding="utf-8")

    with open(OUT_DIR / "measured_event_sizes.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(size_rows[0].keys()))
        w.writeheader()
        w.writerows(size_rows)

    with open(OUT_DIR / "event_rate_assumptions.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Component", "Light events/unit/day", "Normal events/unit/day", "Heavy events/unit/day"])
        for comp in COMPONENTS:
            w.writerow([COMPONENTS[comp]["label"], *EVENT_RATES[comp].values()])

    with open(OUT_DIR / "sizing_estimates_rollups.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rollup_rows[0].keys()))
        w.writeheader()
        w.writerows(rollup_rows)

    with open(OUT_DIR / "scope_defaults.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(defaults_rows[0].keys()))
        w.writeheader()
        w.writerows(defaults_rows)

    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in OUT_DIR.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(OUT_DIR.parent))

    print(f"Generated {len(size_rows) * EVENTS_PER_BUCKET} synthetic events (measured)")
    print(f"CSV: {CSV_PATH}")
    print(f"ZIP: {ZIP_PATH}")
    print(f"Rates JSON: {RATES_JSON}")
    print("\n--- Component rates (first vendor) ---")
    for row in component_rows[:4]:
        print(row)


if __name__ == "__main__":
    main()
