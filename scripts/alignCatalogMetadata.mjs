#!/usr/bin/env node
/**
 * Add customerSummary to catalog entries and align measurement/counting copy with originalSizingRates.
 * Usage: node scripts/alignCatalogMetadata.mjs [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  REPO_ROOT,
  SOURCES_PATH,
  catalogById,
  flattenCatalog,
  loadSourcesJson,
} from './lib/catalogUtils.mjs';

const write = process.argv.includes('--write');

const CUSTOMER_SUMMARY_OVERRIDES = {
  saas_sso:
    'Sign-in and MFA events from your cloud identity provider (Okta, Entra, Ping) for SaaS and VPN apps.',
  sso_pam:
    'Privileged-access and vault session logs from PAM tools (CyberArk, BeyondTrust)—not the same as everyday SSO sign-ins.',
  active_directory:
    'On-prem Windows domain controller security logs (Kerberos, logons, group changes).',
  saas_office:
    'Microsoft 365 or Google Workspace audit logs—mail, files, Teams, and admin activity.',
  saas_crm:
    'CRM audit logs (Salesforce, Dynamics, etc.) for logins, record changes, and integrations.',
  saas_general:
    'General SaaS application audit logs not covered by Office, CRM, or IdP rows.',
  edr:
    'Endpoint detection alerts and telemetry from your EDR platform (CrowdStrike, Defender, etc.).',
  firewalls:
    'Next-generation firewall traffic, threat, URL, and VPN logs from perimeter and internal devices.',
  fw_perimeter: 'Internet-facing firewall traffic and threat logs (north-south).',
  fw_internal: 'Internal segmentation firewall logs for east-west traffic between zones.',
  fw_waf: 'Web application firewall HTTP/S request and block logs.',
  vpn: 'VPN gateway connection and authentication logs from concentrators and SSL VPN appliances.',
  email: 'On-prem mail server or secure email gateway message tracking and threat logs.',
  proxy: 'Web proxy URL, category, and policy enforcement logs.',
  dns: 'Internal DNS query and response logs from resolvers and authoritative servers.',
  netflow: 'NetFlow, sFlow, or IPFIX metadata from routers, switches, or firewalls.',
  casb: 'Cloud app discovery, sanctioned/unsanctioned usage, and CASB policy violation logs.',
  sase: 'Secure access edge logs for remote users (SWG, ZTNA, CASB bundle).',
};

const COUNTING_OVERRIDES = {
  sso_pam: {
    primaryUnit: 'PAM / vault platforms',
    howToCount:
      'Count distinct privileged-access or vault platforms (CyberArk, BeyondTrust, etc.) that forward session audit logs — not SSO user counts.',
    customerQuestion:
      'How many PAM or vault platforms send privileged session audit logs to Splunk?',
    commonMistakes: [
      'Counting SSO/IdP users instead of PAM platforms',
      'Double-counting Okta sign-ins already sized under Cloud IdP SSO',
    ],
  },
  vpn: {
    primaryUnit: 'VPN gateway devices',
    howToCount:
      'Count VPN concentrators, GlobalProtect gateways, or SSL VPN appliances exporting connection logs — not licensed user seats.',
    customerQuestion: 'How many VPN gateway devices or concentrators forward logs to Splunk?',
    commonMistakes: ['Using concurrent VPN user count instead of appliance count'],
  },
  email: {
    primaryUnit: 'Mail servers or secure gateways',
    howToCount:
      'Count Exchange servers, SMTP relays, or secure email gateways (Proofpoint, Mimecast) exporting message or threat logs.',
    customerQuestion: 'How many mail servers or email security gateways send logs to Splunk?',
    commonMistakes: ['Using mailbox/user count instead of server or gateway appliances'],
  },
  saas_sso: {
    primaryUnit: 'SSO-enrolled users',
    howToCount:
      'Users who authenticate through a cloud IdP (Okta, Entra, Ping) whose sign-in logs you centralize — separate from PAM vault platforms.',
    customerQuestion:
      'How many users authenticate through the IdP whose SaaS SSO logs you centralize?',
    commonMistakes: [
      'Double-counting with Privileged Access (PAM) row',
      'Including on-prem AD users not using cloud IdP SSO',
    ],
  },
};

function firstSentence(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const match = t.match(/^[^.!?]+[.!?]?/);
  return (match ? match[0] : t.slice(0, 120)).trim();
}

function walk(nodes, fn) {
  for (const node of nodes) {
    fn(node);
    if (node.children?.length) walk(node.children, fn);
  }
}

function main() {
  const roots = loadSourcesJson();
  const catalog = catalogById(roots);
  const flat = flattenCatalog(roots);
  const orig = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src/data/originalSizingRates.json'), 'utf8'),
  ).entries;
  const questionsDoc = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src/data/sourceMeasurementQuestions.json'), 'utf8'),
  );
  const countingDoc = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src/data/sourceCountingMethods.json'), 'utf8'),
  );

  let summaryAdded = 0;
  walk(roots, (node) => {
    if (!node.customerSummary) {
      node.customerSummary =
        CUSTOMER_SUMMARY_OVERRIDES[node.id] || firstSentence(node.description);
      summaryAdded += 1;
    } else if (CUSTOMER_SUMMARY_OVERRIDES[node.id]) {
      node.customerSummary = CUSTOMER_SUMMARY_OVERRIDES[node.id];
    }
  });

  let qUpdates = 0;
  let cUpdates = 0;
  for (const { id } of flat) {
    const o = orig[id];
    const source = catalog.get(id);
    const countingOverride = COUNTING_OVERRIDES[id];
    if (countingOverride) {
      countingDoc.methods[id] = {
        ...(countingDoc.methods[id] || {}),
        ...countingOverride,
      };
      cUpdates += 1;
    }

    if (!o && !countingOverride) continue;

    const primary = o?.primaryInputField || source?.sizing_formula?.primary_input;
    const unitLabel = o?.unitLabel || countingDoc.methods[id]?.primaryUnit?.toLowerCase();
    const customerQuestion =
      countingOverride?.customerQuestion
      || countingDoc.methods[id]?.customerQuestion
      || `How many ${unitLabel || 'items'} apply to ${source?.name || id}?`;

    const prev = questionsDoc.questions[id] || { sourceId: id };
    const next = {
      ...prev,
      sourceId: id,
      question: customerQuestion,
      primaryInputField: primary,
      unitLabel: unitLabel || prev.unitLabel,
      helperText: countingOverride?.howToCount || countingDoc.methods[id]?.howToCount || prev.helperText || '',
    };
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      questionsDoc.questions[id] = next;
      qUpdates += 1;
    }
  }

  console.log(`customerSummary set/updated on ${summaryAdded} nodes`);
  console.log(`measurement questions updated: ${qUpdates}`);
  console.log(`counting methods updated: ${cUpdates}`);

  if (write) {
    fs.writeFileSync(SOURCES_PATH, `${JSON.stringify(roots, null, 2)}\n`);
    fs.writeFileSync(
      path.join(REPO_ROOT, 'src/data/sourceMeasurementQuestions.json'),
      `${JSON.stringify(questionsDoc, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(REPO_ROOT, 'src/data/sourceCountingMethods.json'),
      `${JSON.stringify(countingDoc, null, 2)}\n`,
    );
    console.log('Wrote sources.json, sourceMeasurementQuestions.json, sourceCountingMethods.json');
  } else {
    console.log('Dry run — pass --write to apply');
  }
}

main();
