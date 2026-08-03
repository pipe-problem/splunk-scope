/**
 * Shared helpers for intake import (Circuit JSON and heuristic fallback).
 */
import sourcesCatalog from '../data/sources.json';
import { flattenSourceCatalog } from './sizingEngine.js';
import { getFlatSplunkApps, filterIntakeAppIds, getIntakeSplunkAppIds } from './splunkAppsCatalog.js';

const FLAT_SPLUNK_APPS = getFlatSplunkApps().sort((a, b) => b.name.length - a.name.length);

const flatSources = flattenSourceCatalog(sourcesCatalog);

const SOURCE_NAME_PATTERNS = [
  { id: 'active_directory', patterns: [/active\s+directory/i, /\bad\b(?!\s*sync)/i, /\bdomain\s+controller/i] },
  { id: 'windows_event_log', patterns: [/windows\s+(?:event|security)\s+log/i, /\bwin\s*event/i] },
  { id: 'linux_syslog', patterns: [/linux/i, /syslog/i, /auditd/i] },
  { id: 'firewall', patterns: [/firewall/i, /palo\s*alto/i, /fortinet/i, /check\s*point/i] },
  { id: 'dns', patterns: [/\bdns\b/i, /bind/i] },
  { id: 'proxy', patterns: [/proxy/i, /blue\s*coat/i, /zscaler/i] },
  { id: 'vpn', patterns: [/\bvpn\b/i, /remote\s+access/i] },
  { id: 'm365', patterns: [/m365/i, /microsoft\s*365/i, /office\s*365/i, /o365/i] },
  { id: 'azure_ad', patterns: [/azure\s*ad/i, /entra/i] },
  { id: 'aws_cloudtrail', patterns: [/cloudtrail/i, /\baws\b/i] },
  { id: 'endpoint_defender', patterns: [/defender/i, /crowdstrike/i, /sentinelone/i, /carbon\s*black/i] },
  { id: 'vmware', patterns: [/vmware/i, /hypervisor/i, /vsphere/i] },
  { id: 'kubernetes', patterns: [/kubernetes/i, /\bk8s\b/i, /container/i] },
  { id: 'database', patterns: [/database/i, /\bdb\b/i, /oracle/i, /sql\s*server/i] },
  { id: 'web_server', patterns: [/web\s*server/i, /iis/i, /apache/i, /nginx/i] },
  { id: 'application', patterns: [/application\s+server/i, /app\s+server/i] },
];

export function matchParsedSplunkLabelToAppId(label) {
  const raw = (label || '').trim();
  if (!raw) return null;
  if (/splunk\s+itsi\b/i.test(raw) || /^itsi$/i.test(raw)) {
    const hit = FLAT_SPLUNK_APPS.find((a) => a.id === 'it_service_intelligence');
    return hit?.id ?? null;
  }
  if (/splunk\s+uba\b/i.test(raw) || /^uba$/i.test(raw)) {
    const hit = FLAT_SPLUNK_APPS.find((a) => a.name.toLowerCase().includes('user behavior analytics'));
    return hit?.id ?? null;
  }
  if (/splunk\s+stream\b/i.test(raw)) {
    const hit = FLAT_SPLUNK_APPS.find((a) => a.name.toLowerCase().includes('stream'));
    return hit?.id ?? null;
  }
  const normalized = raw.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  for (const app of FLAT_SPLUNK_APPS) {
    const an = app.name.toLowerCase();
    if (normalized === an) return app.id;
  }
  for (const app of FLAT_SPLUNK_APPS) {
    const an = app.name.toLowerCase();
    if (normalized.includes(an)) return app.id;
  }
  for (const app of FLAT_SPLUNK_APPS) {
    const an = app.name.toLowerCase();
    if (an.includes(normalized) && normalized.length >= 10) return app.id;
  }
  if (normalized === 'es' || normalized.includes('enterprise security')) {
    return FLAT_SPLUNK_APPS.find((a) => a.id === 'enterprise_security')?.id ?? null;
  }
  return null;
}

export function matchSplunkAppToken(token) {
  const raw = String(token || '').trim();
  if (!raw) return { id: null, label: raw };
  const byId = FLAT_SPLUNK_APPS.find((a) => a.id === raw);
  if (byId) return { id: byId.id, label: byId.name };
  const id = matchParsedSplunkLabelToAppId(raw);
  if (id) {
    const app = FLAT_SPLUNK_APPS.find((a) => a.id === id);
    return { id, label: app?.name ?? raw };
  }
  return { id: null, label: raw };
}

export function matchSourceHint(sourceName, vendor, product) {
  const combined = [sourceName, vendor, product].filter(Boolean).join(' ');
  const hay = combined.toLowerCase();

  for (const src of flatSources) {
    if (sourceName && src.id === sourceName) return src.id;
    if (sourceName && src.name.toLowerCase() === String(sourceName).toLowerCase()) return src.id;
  }

  for (const row of SOURCE_NAME_PATTERNS) {
    if (row.patterns.some((re) => re.test(hay))) return row.id;
  }

  for (const src of flatSources) {
    const name = src.name.toLowerCase();
    if (hay && name.length > 4 && hay.includes(name)) return src.id;
    if (src.exampleVendors?.some((v) => hay.includes(String(v).toLowerCase()))) return src.id;
  }

  return null;
}

export function normalizeDeploymentType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'unknown';
  if (raw === 'cloud' || raw.includes('splunk cloud') || raw.includes('saas')) return 'cloud';
  if (
    raw === 'onprem' ||
    raw === 'on-prem' ||
    raw === 'on prem' ||
    raw.includes('on-premises') ||
    raw.includes('on premises') ||
    raw.includes('self-managed') ||
    raw.includes('self managed') ||
    raw.includes('enterprise (self')
  ) {
    return 'onprem';
  }
  if (raw === 'hybrid' || raw.includes('hybrid')) return 'hybrid';
  if (raw === 'unknown') return 'unknown';
  return 'unknown';
}

export function getAllowedIntakeSplunkAppIds() {
  return getIntakeSplunkAppIds();
}

export { filterIntakeAppIds, getFlatSplunkApps } from './splunkAppsCatalog.js';
