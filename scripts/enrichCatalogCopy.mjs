#!/usr/bin/env node
/**
 * Fill missing description / whyItMatters on catalog nodes (children inheriting context).
 * Usage: node scripts/enrichCatalogCopy.mjs --write
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { REPO_ROOT, loadSourcesJson } from './lib/catalogUtils.mjs';

const write = process.argv.includes('--write');

const COPY = {
  saas_office: {
    description:
      'Microsoft 365 and Google Workspace audit and activity telemetry: sign-in and admin audit, Exchange/SharePoint/Teams activity, and security/compliance signals routed to Splunk.',
    whyItMatters:
      'Office productivity clouds are the top vector for account takeover and data exfiltration. Centralizing M365/Google audit logs enables BEC detection, DLP correlation, and insider-threat investigations.',
  },
  saas_crm: {
    description:
      'CRM platform audit and API activity (Salesforce, Dynamics, HubSpot, ServiceNow CSM, Zendesk): logins, object changes, integrations, and security events.',
    whyItMatters:
      'CRM systems hold customer PII and revenue data. Audit visibility supports fraud detection, privileged access monitoring, and compliance for sales and service operations.',
  },
  saas_sso: {
    description:
      'Identity-provider and SSO/MFA logs (Okta, Entra ID, Ping, Duo): authentication, MFA challenges, admin changes, and federation events.',
    whyItMatters:
      'SSO is the front door to SaaS and VPN. IdP logs are essential for detecting credential theft, MFA fatigue, and unauthorized app assignments.',
  },
  saas_conferencing: {
    description:
      'Web conferencing audit logs (Zoom, Teams, Webex, Slack huddles): meetings, recordings, admin settings, and sign-in activity forwarded to Splunk.',
    whyItMatters:
      'Conferencing platforms expose meeting content and guest access paths. Audit logs help detect hijacking, data leakage via recordings, and shadow IT conferencing.',
  },
  saas_filesharing: {
    description:
      'Enterprise file-sharing audit logs (Box, Dropbox, OneDrive standalone tenants): file access, sharing links, admin actions, and DLP-related events.',
    whyItMatters:
      'File shares are a common exfiltration path. File-sharing audit trails underpin insider-threat and data-loss investigations.',
  },
  db_access: {
    description:
      'Database access and authentication audit logs (DBA actions, failed logins, privilege use) from enterprise RDBMS platforms.',
    whyItMatters:
      'Database access logs reveal credential abuse, excessive privilege use, and suspicious query patterns that raw transaction logs may not contextualize.',
  },
  db_transaction: {
    description:
      'Database transaction or SQL audit streams capturing DML/DDL activity, sensitive table access, and application database calls.',
    whyItMatters:
      'Transaction-level database telemetry supports fraud detection, data integrity monitoring, and forensic reconstructions after data tampering.',
  },
  fw_perimeter: {
    description:
      'Internet-facing next-generation firewall traffic, threat, and VPN logs from perimeter appliances and virtual firewalls.',
    whyItMatters:
      'Perimeter firewalls see north-south attacks first. These logs anchor network detection, threat hunting, and compliance evidence for external exposure.',
  },
  fw_internal: {
    description:
      'Internal segmentation firewall logs for east-west traffic between zones, data centers, and sensitive VLANs.',
    whyItMatters:
      'Lateral movement often crosses internal segments. Segmentation firewall logs help validate Zero Trust boundaries and detect east-west C2.',
  },
  fw_waf: {
    description:
      'Web application firewall logs including HTTP/S requests, blocked attacks, bot scores, and OWASP rule hits.',
    whyItMatters:
      'WAF telemetry exposes application-layer attacks before they reach origin servers — critical for protecting customer-facing and API workloads.',
  },
  iaas_containers: {
    whyItMatters:
      'Kubernetes and container control-plane logs reveal cluster admin abuse, risky workloads, and runtime events that complement cloud audit trails.',
  },
  iaas_instances: {
    whyItMatters:
      'Cloud VM logs extend visibility into guest OS and agent telemetry for workloads that may not yet send logs through a central forwarder.',
  },
  iaas_storage: {
    whyItMatters:
      'Object and file storage access logs detect public exposure, ransomware staging, and unauthorized data access in cloud buckets and shares.',
  },
};

function walk(nodes, fn) {
  for (const node of nodes) {
    fn(node);
    if (node.children?.length) walk(node.children, fn);
    for (const lo of node.log_options || []) {
      fn(lo);
    }
  }
}

function main() {
  const sources = loadSourcesJson();
  let updates = 0;

  walk(sources, (node) => {
    const patch = COPY[node.id];
    if (!patch) return;
    if (patch.description && (!node.description || String(node.description).length < 20)) {
      node.description = patch.description;
      updates += 1;
    }
    if (patch.whyItMatters && (!node.whyItMatters || String(node.whyItMatters).length < 20)) {
      node.whyItMatters = patch.whyItMatters;
      updates += 1;
    }
  });

  console.log(`Catalog copy enrichment: ${updates} field(s) updated`);
  if (!write) {
    console.log('Dry run — pass --write to apply');
    return;
  }
  fs.writeFileSync(
    path.join(REPO_ROOT, 'src/data/sources.json'),
    `${JSON.stringify(sources, null, 2)}\n`,
  );
}

main();
