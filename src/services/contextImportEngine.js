/**
 * Context import engine for pasted or uploaded customer context.
 * Heuristic extraction only; no network calls.
 */

import { formatImportReviewLabel } from '../utils/displayLabels.js';

/** @typedef {'high'|'medium'|'low'} Confidence */

/** @typedef {{
 *   customerName: string|null,
 *   deploymentModel: 'cloud'|'onprem'|'hybrid'|'unknown'|null,
 *   vendors: string[],
 *   useCases: string[],
 *   splunkApps: string[],
 *   dataSources: string[],
 *   unknowns: string[],
 *   sourceOwners: { source: string, owner: string }[],
 *   counts: { type: string, value: number, context: string }[],
 *   confidence: Confidence,
 *   extractedFields: { field: string, value: string, confidence: Confidence }[],
 * }} ParseResult */

const USE_CASE_SPECS = [
  {
    name: 'Enterprise Security / SIEM',
    patterns: [
      /\bsiem\b/i,
      /\benterprise\s+security\b/i,
      /\bsplunk\s+es\b/i,
      /\bes\s+console\b/i,
      /\b\(es\)\b/i,
      /\bsecurity\s+operations\b/i,
      /\bsoc\b/i,
      /\bsecurity\s+information\s+(?:and\s+)?event\s+management\b/i,
    ],
  },
  {
    name: 'IT Operations Monitoring',
    patterns: [
      /\bit\s*ops\b/i,
      /\bit\s+operations\b/i,
      /\bservice\s+availability\b/i,
      /\bincident\s+management\b/i,
    ],
  },
  {
    name: 'Observability / APM',
    patterns: [
      /\bobservability\b/i,
      /\bapm\b/i,
      /\bapplication\s+performance\s+management\b/i,
      /\bdistributed\s+tracing\b/i,
      /\bopen\s*telemetry\b/i,
      /\botel\b/i,
    ],
  },
  {
    name: 'Cloud Security',
    patterns: [
      /\bcloud\s+security\b/i,
      /\bcspm\b/i,
      /\bcwpp\b/i,
      /\bcloud\s+posture\b/i,
      /\bworkload\s+protection\b/i,
    ],
  },
  {
    name: 'Compliance and Audit',
    patterns: [
      /\bcompliance\b/i,
      /\baudit(?:ing)?\b/i,
      /\bpci[\s\-]?dss\b/i,
      /\bhipaa\b/i,
      /\bsox\b/i,
      /\bgdpr\b/i,
      /\bgrc\b/i,
    ],
  },
  {
    name: 'Threat Detection and Investigation',
    patterns: [
      /\bthreat\s+(?:detection|hunting|intel)\b/i,
      /\bti\s+feed\b/i,
      /\bmitre\b/i,
      /\battack\s+surface\b/i,
      /\binvestigation\b/i,
      /\bincident\s+response\b/i,
      /\bmalware\b/i,
    ],
  },
  {
    name: 'Identity and Access Monitoring',
    patterns: [
      /\bidentity\s+(?:and\s+)?access\b/i,
      /\biam\b/i,
      /\bprivileged\s+access\b/i,
      /\bpam\b/i,
      /\bsingle\s+sign[\s\-]on\b/i,
    ],
  },
  {
    name: 'Risk-Based Alerting',
    patterns: [
      /\brisk[\s\-]based\b/i,
      /\bueba\b/i,
      /\bentity\s+behavior\b/i,
      /\binsider\s+threat\b/i,
    ],
  },
  {
    name: 'Endpoint Security',
    patterns: [
      /\bedr\b/i,
      /\bendpoint\s+security\b/i,
      /\bworkstation\b/i,
      /(?:^|[\s,.])epp(?:$|[\s,.])/i,
    ],
  },
  {
    name: 'Kubernetes / Container Monitoring',
    patterns: [
      /\bkubernetes\b/i,
      /\bk8s\b/i,
      /\bcontainers?\b/i,
      /\bdocker\b/i,
      /\bopenshift\b/i,
      /\beks\b/i,
      /\baks\b/i,
      /\bgke\b/i,
    ],
  },
  {
    name: 'Application Monitoring',
    patterns: [
      /\bapplication\s+monitoring\b/i,
      /\bapp\s+monitoring\b/i,
      /\bsynthetic\s+monitoring\b/i,
      /\brum\b/i,
    ],
  },
  {
    name: 'Database Monitoring',
    patterns: [
      /\bdatabase\s+monitoring\b/i,
      /\bdba\s+monitoring\b/i,
      /\boracle\b.*\bmonitor/i,
      /\bpostgres\b.*\bmonitor/i,
      /\bsql\s+server\b.*\bmonitor/i,
    ],
  },
  {
    name: 'Infrastructure Monitoring',
    patterns: [
      /\binfrastructure\s+monitoring\b/i,
      /\bserver\s+monitoring\b/i,
      /\bnetwork\s+monitoring\b/i,
      /\bhypervisor\b/i,
      /\bvmware\b/i,
      /\bnutanix\b/i,
    ],
  },
  {
    name: 'OT / ICS Security',
    patterns: [
      /\bot\s*\/\s*ics\b/i,
      /\bics\s+security\b/i,
      /\bot\s+security\b/i,
      /\bscada\b/i,
      /\bindustrial\s+control\b/i,
    ],
  },
  {
    name: 'Business Analytics',
    patterns: [
      /\bbusiness\s+analytics\b/i,
      /\bbusiness\s+intelligence\b/i,
      /\bexecutive\s+dashboard/i,
      /\breporting\s+platform\b/i,
    ],
  },
  {
    name: 'Foundational Security / InfoSec',
    patterns: [
      /\binfosec\b/i,
      /\binformation\s+security\b/i,
      /\bfoundational\s+security\b/i,
      /\bsecurity\s+program\b/i,
      /\bvulnerability\s+management\b/i,
    ],
  },
]

const VENDOR_ENTRIES = [
  ['CrowdStrike', /\bcrowdstrike\b/i],
  ['SentinelOne', /\bsentinel\s*one\b/i],
  ['Palo Alto Networks', /\bpalo\s+alto\b/i],
  ['Palo Alto Networks', /\bpan[\-\s]?os\b/i],
  ['Palo Alto Networks', /\bcortex\s+xdr\b/i],
  ['Fortinet', /\bfortinet\b/i],
  ['Fortinet', /\bfortigate\b/i],
  ['Cisco', /\bcisco\b/i],
  ['Cisco', /\bmeraki\b/i],
  ['Check Point', /\bcheck\s*point\b/i],
  ['Okta', /\bokta\b/i],
  ['Microsoft Entra ID', /\bentra\b/i],
  ['Microsoft Entra ID', /\bazure\s+ad\b/i],
  ['Microsoft Entra ID', /\baad\b/i],
  ['Amazon Web Services', /\baws\b/i],
  ['Microsoft Azure', /\bazure\b/i],
  ['Google Cloud Platform', /\bgcp\b/i],
  ['Google Cloud Platform', /\bgoogle\s+cloud\b/i],
  ['Zscaler', /\bzscaler\b/i],
  ['Proofpoint', /\bproofpoint\b/i],
  ['Qualys', /\bqualys\b/i],
  ['Tenable', /\btenable\b/i],
  ['ServiceNow', /\bservicenow\b/i],
  ['Datadog', /\bdatadog\b/i],
  ['New Relic', /\bnew\s+relic\b/i],
  ['Dynatrace', /\bdynatrace\b/i],
  ['Splunk', /\bsplunk\b/i],
  ['VMware Carbon Black', /\bcarbon\s+black\b/i],
  ['Microsoft Defender', /\bmicrosoft\s+defender\b/i],
  ['Microsoft Defender', /\bdefender\s+for\s+endpoint\b/i],
  ['IBM QRadar', /\bqradar\b/i],
  ['Exabeam', /\bexabeam\b/i],
  ['Elastic', /\belastic\b/i],
  ['Elasticsearch', /\belasticsearch\b/i],
  ['LogRhythm', /\blogrhythm\b/i],
  ['Securonix', /\bsecuronix\b/i],
  ['Varonis', /\bvaronis\b/i],
  ['Darktrace', /\bdarktrace\b/i],
  ['Rapid7', /\brapid7\b/i],
  ['Rapid7', /\binsightidr\b/i],
  ['Tanium', /\btanium\b/i],
  ['Jamf', /\bjamf\b/i],
  ['Snyk', /\bsnyk\b/i],
  ['Wiz', /\bwiz\b/i],
  ['Lacework', /\blacework\b/i],
  ['Prisma Cloud', /\bprisma\s+cloud\b/i],
  ['Akamai', /\bakamai\b/i],
  ['Cloudflare', /\bcloudflare\b/i],
  ['F5', /\bf5\b/i],
  ['NetScaler', /\bnetscaler\b/i],
  ['Citrix', /\bcitrix\b/i],
  ['IBM', /\bibm\b/i],
  ['Oracle', /\boracle\b/i],
  ['Salesforce', /\bsalesforce\b/i],
  ['Workday', /\bworkday\b/i],
  ['SAP', /\bsap\b/i],
]

const DATA_SOURCE_ENTRIES = [
  ['Firewall logs', /\bfirewall\b/i],
  ['EDR telemetry', /\bedr\b/i],
  ['Endpoint detection', /\bendpoint\s+detection\b/i],
  ['SIEM data', /\bsiem\b/i],
  ['Proxy logs', /\bproxy\b/i],
  ['VPN logs', /\bvpn\b/i],
  ['Active Directory', /\bactive\s+directory\b/i],
  ['DNS', /\bdns\b/i],
  ['DHCP', /\bdhcp\b/i],
  ['Syslog', /\bsyslog\b/i],
  ['AWS CloudTrail', /\bcloudtrail\b/i],
  ['Cloud audit logs', /\bcloud\s+audit\b/i],
  ['Email security gateway', /\bemail\s+security\b/i],
  ['DLP events', /\bdlp\b/i],
  ['Vulnerability scanner', /\bvulnerability\s+scan/i],
  ['NetFlow / IPFIX', /\bnetflow\b/i],
  ['NetFlow / IPFIX', /\bipfix\b/i],
  ['Windows Event Logs', /\bwindows\s+events?\b/i],
  ['Linux auditd', /\bauditd\b/i],
  ['Kubernetes API audit', /\bkubernetes\s+audit\b/i],
  ['Database audit', /\bdatabase\s+audit\b/i],
  ['Web server access logs', /\baccess\s+logs?\b/i],
  ['Packet capture', /\bpcap\b/i],
  ['Packet capture', /\bpacket\s+capture\b/i],
  ['IDS/IPS', /\bids\b/i],
  ['IDS/IPS', /\bips\b/i],
  ['OT / ICS telemetry', /\bscada\b/i],
  ['LDAP / directory', /\bldap\b/i],
  ['CASB logs', /\bcasb\b/i],
  ['SWG logs', /\bswg\b/i],
  ['S3 access logs', /\bs3\s+access\b/i],
  ['GCP audit logs', /\bgcp\s+audit\b/i],
  ['Azure Activity logs', /\bazure\s+activity\b/i],
]

const SPLUNK_APP_SPECS = [
  { label: 'Splunk Enterprise Security (ES)', patterns: [/\bsplunk\s+enterprise\s+security\b/i, /\bsplunk\s+es\b/i, /\benterprise\s+security\s*\(es\)/i, /\benterprise\s+security\b/i] },
  { label: 'Splunk ITSI', patterns: [/\bit\s*service\s+intelligence\b/i, /\bsplunk\s+itsi\b/i, /\bitsi\b/i] },
  { label: 'Splunk SOAR', patterns: [/\bsplunk\s+soar\b/i, /\bphantom\s*\(soar\)/i] },
  { label: 'Splunk UBA', patterns: [/\bsplunk\s+uba\b/i, /\buser\s+behavior\s+analytics\b/i] },
  { label: 'Splunk Observability Cloud', patterns: [/\bobservability\s+cloud\b/i, /\bsplunk\s+o11y\b/i] },
  { label: 'Splunk Infrastructure Monitoring', patterns: [/\binfrastructure\s+monitoring\b/i, /\bsignal\s*fx\b/i] },
  { label: 'Splunk IT Essentials Learn / Work', patterns: [/\bit\s+essentials\b/i] },
  { label: 'Splunk DB Connect', patterns: [/\bdb\s+connect\b/i] },
  { label: 'Splunk Stream', patterns: [/\bsplunk\s+stream\b/i] },
  { label: 'Splunk Enterprise', patterns: [/\bsplunk\s+enterprise\b/i] },
  { label: 'Splunk Cloud Platform', patterns: [/\bsplunk\s+cloud\b/i] },
  { label: 'Splunk for Palo Alto Networks', patterns: [/\bsplunk\s+(?:add[\-\s]?on|ta)\s+for\s+palo/i] },
  { label: 'Splunk Add-on for AWS', patterns: [/\bsplunk\s+(?:add[\-\s]?on|ta)\s+for\s+aws\b/i] },
  { label: 'Splunk Add-on for Microsoft Cloud Services', patterns: [/\bsplunk\s+(?:add[\-\s]?on|ta)\s+for\s+microsoft\b/i] },
]

const DEPLOYMENT_SIGNALS = {
  cloud: [
    /\bsplunk\s+cloud\b/i,
    /\bcloud[\s\-]managed\b/i,
    /\bsaas\b/i,
    /\bhosted\s+splunk\b/i,
    /\bsc\.?splunk\.com\b/i,
  ],
  onprem: [
    /\bon[\s\-]prem(?:ises)?\b/i,
    /\bself[\s\-]managed\b/i,
    /\bdedicated\s+(?:virtual\s+)?private\s+cloud\b/i,
    /\bin[\s\-]house\s+data\s+center\b/i,
    /\bdata\s+cent(?:er|re)\b/i,
  ],
  hybrid: [/\bhybrid\b/i, /\bco[\s\-]?located\b/i, /\bcolo\b/i],
}

const CUSTOMER_NAME_PATTERNS = [
  /(?:^|\n)\s*(?:customer|account|company|organization|organisation)\s*[:#–—\-]\s*(.+?)(?:\s{2,}|\n|$)/i,
  /(?:^|\n)\s*(?:account|customer)\s+name\s*[:#–—\-]\s*(.+?)(?:\s{2,}|\n|$)/i,
  /(?:^|\n)\s*SES?R?\s*[:#–—\-]\s*(?:account|customer)?\s*[:#–—\-]?\s*(.+?)(?:\n|$)/i,
  /(?:^|[.;]\s+)(?:account|customer|company)\s*[:#–—\-]\s*([^.;:\n][^.;:\n]{1,118})/i,
]

const COUNT_PATTERN = /(\d[\d,]*(?:\.\d+)?)\s*(tb|gb|mb|pb|eps|events?\s*\/\s*s|events?\s+per\s+second|hosts?|endpoints?|users?|devices?|firewalls?|index(?:es)?|sourcetypes?|sourcetype|dashboards?|use\s+cases?|data\s+sources?|sources?)/gi

const FIELD_LINE = /(?:^|\n)\s{0,3}([A-Z][A-Za-z0-9 &/%\-]{1,48})\s*[:#]\s*([^\n]+)/g

const OWNER_PATTERNS = [
  /([A-Za-z0-9][A-Za-z0-9\s\-\/]{2,60}?)\s*(?:—|–|-)\s*(?:owner|steward)\s*:\s*([^\n]+)/gi,
  /(?:owner|steward|data\s+owner)\s*[:#]\s*([^\n]+?)(?:\s+(?:for|of)\s+)([A-Za-z0-9][^\n]{1,80})/gi,
  /(?:for|of)\s+([A-Za-z0-9][A-Za-z0-9\s\-]{2,50}?)\s*,\s*(?:owner|steward)\s*[:#]\s*([^\n]+)/gi,
]

const GENERIC_STOP = new Set([
  'the', 'and', 'for', 'our', 'they', 'them', 'that', 'this', 'with', 'from',
  'have', 'been', 'will', 'were', 'into', 'about', 'your', 'their',
])

const UNKNOWN_PHRASE_SKIP = new Set([
  'account name', 'customer name', 'company name', 'opportunity name',
  'project name', 'meeting notes', 'next steps', 'action items', 'discovery notes',
])

const TECH_UNKNOWN_HINTS = [
  /\bproprietary\b/gi,
  /\blegacy\b/gi,
  /\bvendor\s+agnostic\b/gi,
  /\bevaluating\b/gi,
  /\bpoc\b/gi,
  /\bpilot\b/gi,
  /\btbd\b/gi,
  /\bto\s+be\s+determined\b/gi,
  /\bunknown\b/gi,
]

function emptyResult() {
  return {
    customerName: null,
    deploymentModel: null,
    vendors: [],
    useCases: [],
    splunkApps: [],
    dataSources: [],
    unknowns: [],
    sourceOwners: [],
    counts: [],
    confidence: 'low',
    extractedFields: [],
  }
}

function uniqSorted(items) {
  return [...new Set(items)].sort((a, b) => a.localeCompare(b))
}

function extractCustomerName(raw) {
  for (const re of CUSTOMER_NAME_PATTERNS) {
    re.lastIndex = 0
    const m = re.exec(raw)
    if (m?.[1]) {
      const name = m[1].replace(/\s+/g, ' ').trim().replace(/^["']|["']$/g, '')
      if (name.length >= 2 && name.length <= 120) return name
    }
  }
  return null
}

function extractDeploymentModel(text) {
  const hit = (keys) => keys.some((k) => DEPLOYMENT_SIGNALS[k].some((re) => {
    re.lastIndex = 0
    return re.test(text)
  }))

  const hy = hit(['hybrid'])
  const cl = hit(['cloud'])
  const op = hit(['onprem'])

  if (hy || (cl && op)) return 'hybrid'
  if (cl) return 'cloud'
  if (op) return 'onprem'
  if (!cl && !op && !hy) {
    const envUnknown = /\b(?:deployment|hosting|topology|environment|architecture)\b[^.;]{0,48}\bunknown\b/i.test(text)
      || /\bunknown\b[^.;]{0,48}\b(?:deployment|hosting|topology|environment)\b/i.test(text)
    if (envUnknown) return 'unknown'
  }
  return null
}

function collectByPatterns(text, entries) {
  const out = []
  for (const [label, re] of entries) {
    re.lastIndex = 0
    if (re.test(text)) out.push(label)
  }
  return out
}

function collectSplunkApps(text) {
  const out = []
  for (const spec of SPLUNK_APP_SPECS) {
    if (spec.patterns.some((re) => {
      re.lastIndex = 0
      return re.test(text)
    })) {
      out.push(spec.label)
    }
  }
  return uniqSorted(out)
}

function collectUseCases(text) {
  const out = []
  for (const spec of USE_CASE_SPECS) {
    if (spec.patterns.some((re) => {
      re.lastIndex = 0
      return re.test(text)
    })) {
      out.push(spec.name)
    }
  }
  return uniqSorted(out)
}

function trimOwnerSourcePhrase(s) {
  const t = s.replace(/\s+/g, ' ').trim()
  const i = t.toLowerCase().indexOf(' owned by ')
  if (i > 0) return t.slice(0, i).trim()
  return t
}

function extractSourceOwners(raw) {
  const owners = []
  for (const re of OWNER_PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(raw)) !== null) {
      const a = (m[1] || '').replace(/\s+/g, ' ').trim()
      const b = (m[2] || '').replace(/\s+/g, ' ').trim()
      if (a && b && a.length < 100 && b.length < 120) {
        const looksOwnerFirst = /owner|steward/i.test(m[0]) && /for|of/i.test(m[0])
        const source = trimOwnerSourcePhrase(looksOwnerFirst ? b : a)
        const owner = (looksOwnerFirst ? a : b).trim()
        owners.push({ source, owner })
      }
    }
  }
  const seen = new Set()
  const deduped = []
  for (const o of owners) {
    const k = `${o.source.toLowerCase()}|${o.owner.toLowerCase()}`
    if (!seen.has(k)) {
      seen.add(k)
      deduped.push(o)
    }
  }
  return deduped
}

function extractCounts(raw) {
  const counts = []
  let m
  COUNT_PATTERN.lastIndex = 0
  while ((m = COUNT_PATTERN.exec(raw)) !== null) {
    const numStr = m[1].replace(/,/g, '')
    const n = Number.parseFloat(numStr)
    if (!Number.isFinite(n)) continue
    const type = m[2].replace(/\s+/g, ' ').trim().toLowerCase()
    const start = Math.max(0, m.index - 24)
    const end = Math.min(raw.length, m.index + m[0].length + 24)
    const context = raw.slice(start, end).replace(/\s+/g, ' ').trim()
    counts.push({ type, value: n, context })
  }
  return counts
}

function extractLabeledFields(raw) {
  const fields = []
  FIELD_LINE.lastIndex = 0
  let m
  while ((m = FIELD_LINE.exec(raw)) !== null) {
    const field = m[1].trim()
    const value = m[2].trim()
    if (field.length < 2 || value.length < 1 || value.length > 500) continue
    if (/^(the|and)$/i.test(field)) continue
    const fl = field.toLowerCase()
    const conf = /name|account|company|deployment|environment|owner|steward|title/i.test(fl)
      ? 'high'
      : fl.length <= 4
        ? 'low'
        : 'medium'
    fields.push({ field, value, confidence: conf })
  }
  return fields
}

function collectUnknowns(raw, classifiedSlices, fieldLabels, customerName, sourceOwners, vendors) {
  const unknowns = []
  const seen = new Set()
  const ownerSet = new Set(
    sourceOwners.flatMap((o) => [o.owner, o.source].map((s) => s.toLowerCase())),
  )

  const push = (s) => {
    const t = s.replace(/\s+/g, ' ').trim()
    if (t.length < 8 || t.length > 140) return
    const k = t.toLowerCase()
    if (seen.has(k)) return
    if (customerName && k.includes(customerName.toLowerCase())) return
    if (ownerSet.has(k) || [...ownerSet].some((x) => x.includes(k) || k.includes(x))) return
    seen.add(k)
    unknowns.push(t)
  }

  const vendorHints = new Set(vendors.map((v) => v.toLowerCase()))

  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (t.length < 6) continue
    const hinted = TECH_UNKNOWN_HINTS.some((re) => {
      re.lastIndex = 0
      return re.test(t)
    })
    if (!hinted) continue
    const tl = t.toLowerCase()
    if (/\bevaluating\b/i.test(t) && vendorHints.size && [...vendorHints].some((v) => tl.includes(v.split(' ')[0]))) {
      continue
    }
    push(t.length > 120 ? `${t.slice(0, 117)}...` : t)
  }

  const phraseRe = /\b(?:[A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){1,3})\b/g
  let pm
  while ((pm = phraseRe.exec(raw)) !== null) {
    const phrase = pm[0]
    const low = phrase.toLowerCase()
    if (UNKNOWN_PHRASE_SKIP.has(low) || GENERIC_STOP.has(low)) continue
    if (fieldLabels.has(low)) continue
    if (ownerSet.has(low)) continue
    if (phrase.length < 5 || phrase.length > 48) continue
    if (classifiedSlices.some((s) => s.includes(low))) continue
    if (/^(Splunk|Microsoft|Google|Amazon)/.test(phrase)) continue
    if (/^(Network|Security|Platform|Infrastructure|Global)\s+(Ops|Team|Dept|Group)$/i.test(phrase)) {
      continue
    }
    push(phrase)
    if (unknowns.length >= 20) break
  }
  return unknowns.slice(0, 20)
}

function computeConfidence(result) {
  let score = 0
  if (result.customerName) score += 2
  if (result.deploymentModel && result.deploymentModel !== 'unknown') score += 2
  if (result.vendors.length) score += 1
  if (result.useCases.length) score += 2
  if (result.dataSources.length) score += 1
  if (result.splunkApps.length) score += 1
  if (result.counts.length) score += 1
  if (result.sourceOwners.length) score += 1
  if (result.extractedFields.length >= 3) score += 1
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

/**
 * Parse freeform customer context into structured intake hints.
 *
 * @param {string} text
 * @returns {ParseResult}
 */
export function parseCustomerContext(text) {
  if (text == null || typeof text !== 'string') {
    return emptyResult()
  }
  const raw = text.replace(/\r\n/g, '\n').trim()
  if (!raw) {
    return emptyResult()
  }

  const customerName = extractCustomerName(raw)
  const deploymentModel = extractDeploymentModel(raw)
  const vendors = uniqSorted(collectByPatterns(raw, VENDOR_ENTRIES))
  const dataSources = uniqSorted(collectByPatterns(raw, DATA_SOURCE_ENTRIES))
  const useCases = collectUseCases(raw)
  const splunkApps = collectSplunkApps(raw)
  const sourceOwners = extractSourceOwners(raw)
  const counts = extractCounts(raw)
  const extractedFields = extractLabeledFields(raw)

  const classifiedSlices = [
    customerName?.toLowerCase() || '',
    ...vendors.map((v) => v.toLowerCase()),
    ...useCases.map((u) => u.toLowerCase()),
    ...splunkApps.map((s) => s.toLowerCase()),
    ...dataSources.map((d) => d.toLowerCase()),
  ].filter(Boolean)

  const fieldLabels = new Set(extractedFields.map((f) => f.field.toLowerCase()))
  const unknowns = collectUnknowns(raw, classifiedSlices, fieldLabels, customerName, sourceOwners, vendors)

  const base = {
    customerName,
    deploymentModel,
    vendors,
    useCases,
    splunkApps,
    dataSources,
    unknowns,
    sourceOwners,
    counts,
    confidence: 'low',
    extractedFields,
  }
  return { ...base, confidence: computeConfidence(base) }
}

/**
 * Render a concise human-readable summary of a parse result.
 *
 * @param {ParseResult} result
 * @returns {string}
 */
export function formatExtractionSummary(result) {
  if (!result || typeof result !== 'object') {
    return 'No extraction results.'
  }
  const lines = []
  lines.push(`Confidence: ${result.confidence || 'low'}`)
  if (result.customerName) lines.push(`Customer: ${result.customerName}`)
  if (result.deploymentModel) lines.push(`Deployment model: ${result.deploymentModel}`)
  if (result.vendors?.length) lines.push(`Vendors: ${result.vendors.join(', ')}`)
  if (result.useCases?.length) lines.push(`Use cases: ${result.useCases.join('; ')}`)
  if (result.splunkApps?.length) lines.push(`Splunk apps: ${result.splunkApps.join(', ')}`)
  if (result.dataSources?.length) lines.push(`Data sources: ${result.dataSources.join(', ')}`)
  if (result.counts?.length) {
    lines.push(
      `Counts: ${result.counts.map((c) => `${c.value} ${c.type}`).join('; ')}`,
    )
  }
  if (result.sourceOwners?.length) {
    lines.push(
      `Ownership: ${result.sourceOwners.map((o) => `${o.source} → ${o.owner}`).join('; ')}`,
    )
  }
  if (result.extractedFields?.length) {
    lines.push(
      `Labeled fields: ${result.extractedFields.map((f) => `${f.field}: ${f.value}`).join('; ')}`,
    )
  }
  if (result.unknowns?.length) {
    lines.push(`${formatImportReviewLabel()}: ${result.unknowns.join('; ')}`)
  }
  if (lines.length === 1) {
    lines.push('No high-signal fields detected in this text.')
  }
  return lines.join('\n')
}

/**
 * Supported pasted/uploaded context shapes for this parser.
 *
 * @returns {string[]}
 */
export function getSupportedFormats() {
  return [
    'Plain text / markdown meeting or discovery notes',
    'Gong (or similar) call summaries pasted as paragraphs',
    'Salesforce SESR or opportunity notes with labeled fields',
    'Semi-structured bullets with vendor, data source, or tool names',
    'Architecture or environment snippets mentioning Splunk Cloud vs on-prem',
    'Rough counts inline (TB indexed, endpoints, EPS, dashboards)',
  ]
}
