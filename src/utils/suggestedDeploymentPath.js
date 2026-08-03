import { getSplunkbaseUrl, resolveSplunkbaseLink } from './splunkbaseLinks.js';
import { getSourceOnboardingGuidance } from '../services/startupGuideEngine.js';

const DOC = {
  uf: 'https://docs.splunk.com/Documentation/Forwarder/latest/Forwarder/Abouttheuniversalforwarder',
  hec: 'https://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector',
  sc4s: 'https://docs.splunk.com/Documentation/SC4S/current/SC4S/OpenSource',
  syslog: 'https://docs.splunk.com/Documentation/Splunk/latest/Data/Monitoringsyslog',
  cim: 'https://docs.splunk.com/Documentation/CIM/latest/User/Overview',
  indexes: 'https://docs.splunk.com/Documentation/Splunk/latest/Admin/Createcustomindexes',
  cloudDataManager: 'https://docs.splunk.com/Documentation/SplunkCloud/latest/Admin/AboutSplunkCloudDataManager',
  dbConnect: 'https://docs.splunk.com/Documentation/DBConnect/latest/Deploy/DeployDBConnect',
  stream: 'https://docs.splunk.com/Documentation/Stream/latest/Stream/AboutSplunkStream',
  otel: 'https://docs.splunk.com/Documentation/Splunk/latest/Data/FormatsandschemaforOpenTelemetry',
};

const METHOD_DOC = {
  forwarder: DOC.uf,
  hec: DOC.hec,
  syslog: DOC.syslog,
  sc4s: DOC.sc4s,
  cloud_addon: DOC.cloudDataManager,
  api: DOC.hec,
  db_connect: DOC.dbConnect,
  sc4k: DOC.otel,
  otel: DOC.otel,
};

/**
 * Planning steps for onboarding a source — each item links to Splunkbase or Splunk docs.
 * Splunkbase steps use verified catalog URLs only; unverified entries omit raw URLs.
 * @param {{ id: string, name: string, splunkApps?: string[], technicalAddons?: string[] }} source
 * @returns {{ label: string, url: string|null, kind: 'splunkbase'|'docs'|'planning', linkNote?: string }[]}
 */
export function getSuggestedDeploymentPath(source) {
  if (!source?.id) return [];
  const guidance = getSourceOnboardingGuidance(source.id);
  const steps = [];

  if (guidance.ta) {
    const link = resolveSplunkbaseLink(guidance.ta);
    const customerUrl = link?.customerUrl || null;
    steps.push({
      label: `Review Technology Add-on: ${guidance.ta}`,
      url: customerUrl,
      kind: customerUrl ? 'splunkbase' : 'planning',
      linkNote: !customerUrl && link ? 'Link needs validation' : undefined,
    });
  }

  for (const app of source.splunkApps || []) {
    const link = resolveSplunkbaseLink(app);
    const customerUrl = link?.customerUrl || null;
    if (customerUrl) {
      steps.push({
        label: `Install or configure: ${app}`,
        url: customerUrl,
        kind: 'splunkbase',
      });
    } else if (link?.status === 'needsReview') {
      steps.push({
        label: `Install or configure: ${app}`,
        url: null,
        kind: 'planning',
        linkNote: 'Link needs validation',
      });
    }
  }

  steps.push({
    label: `Configure ingest via ${guidance.methodLabel || 'syslog or forwarder'}`,
    url: METHOD_DOC[guidance.methodKey] || DOC.syslog,
    kind: 'docs',
  });

  steps.push({
    label: 'Define index and sourcetype routing',
    url: DOC.indexes,
    kind: 'docs',
  });

  steps.push({
    label: 'Validate field extraction and CIM alignment',
    url: DOC.cim,
    kind: 'docs',
  });

  if (guidance.firstDashboard) {
    steps.push({
      label: `Enable dashboards: ${guidance.firstDashboard}`,
      url: 'https://docs.splunk.com/Documentation/Splunk/latest/Dashboards/DashboardOverview',
      kind: 'docs',
    });
  }

  const seen = new Set();
  return steps.filter((s) => {
    const key = `${s.label}|${s.url}|${s.linkNote || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** @deprecated Use resolveSplunkbaseLink — kept for callers expecting URL-only helper */
export { getSplunkbaseUrl };
