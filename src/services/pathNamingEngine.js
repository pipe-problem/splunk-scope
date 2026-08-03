/**
 * Deterministic dynamic display names for architecture paths (Crawl / Walk / Run).
 * Stable for the same inputs — no AI required.
 */

const SOURCE_FAMILIES = {
  identity: ['active_directory', 'saas_sso', 'sso_pam', 'email'],
  endpoint: ['edr', 'windows_servers', 'desktops', 'av_edr_legacy'],
  network: ['firewalls', 'vpn', 'switches', 'routers', 'netflow', 'ndr', 'wireless'],
  cloud: ['saas_office', 'iaas', 'cspm', 'cwpp', 'casb', 'sase'],
  email: ['email'],
  vulnerability: ['vuln_mgmt', 'asset_cmdb'],
  dns: ['dns', 'dhcp'],
};

const USE_CASE_THEMES = [
  { match: /cloud|saas|iaas|cspm|cwpp|casb/i, theme: 'Cloud & SaaS Visibility' },
  { match: /identity|access|authentication/i, theme: 'Identity & Access Foundation' },
  { match: /network|perimeter|firewall/i, theme: 'Network Security Foundation' },
  { match: /threat|detection|siem|infosec|security/i, theme: 'SIEM & Threat Detection' },
  { match: /observability|performance|it ops|service health/i, theme: 'Service Health Foundation' },
  { match: /compliance|audit/i, theme: 'Compliance & Audit Readiness' },
];

const PHASE_SUFFIX = {
  crawl: 'Foundation',
  walk: 'Coverage',
  run: 'Maturity',
};

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function scoreFamilies(sourceIds) {
  const scores = {};
  for (const [family, ids] of Object.entries(SOURCE_FAMILIES)) {
    scores[family] = ids.filter((id) => sourceIds.includes(id)).length;
  }
  return scores;
}

function dominantFamily(scores) {
  const ranked = Object.entries(scores)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] || 'security';
}

const FAMILY_LABELS = {
  identity: 'Identity + Access',
  endpoint: 'Endpoint Visibility',
  network: 'Identity + Network',
  cloud: 'Cloud Control Plane',
  email: 'Email & Collaboration',
  vulnerability: 'Risk Context',
  dns: 'DNS & Attribution',
  security: 'Security Telemetry',
};

function themeFromUseCases(useCases = []) {
  const names = useCases.map((u) => u.name || u.id || '').join(' ');
  for (const row of USE_CASE_THEMES) {
    if (row.match.test(names)) return row.theme;
  }
  return 'Security Telemetry';
}

function walkVariantLabel(secondaryFocusName) {
  if (secondaryFocusName) return `${secondaryFocusName} Depth`;
  return 'Balanced Coverage';
}

/**
 * @param {object} params
 * @param {'crawl'|'walk'|'run'} params.pathPhase
 * @param {object} [params.plan]
 * @param {object[]} [params.useCases]
 * @param {object} [params.intake]
 * @returns {{ roleName: string, dynamicName: string, displayLabel: string }}
 */
export function generatePathDisplayName({ pathPhase, pathVariant = null, plan = {}, useCases = [], intake = {} }) {
  const sourceIds = (plan.sources || []).map((s) => s.id).sort();
  const familyScores = scoreFamilies(sourceIds);
  const family = dominantFamily(familyScores);
  const ucTheme = themeFromUseCases(useCases);
  const roleNames = { crawl: 'Crawl', walk: 'Walk', run: 'Run' };
  const roleName = roleNames[pathPhase] || 'Walk';

  let dynamicCore;
  if (pathPhase === 'crawl') {
    dynamicCore = family === 'cloud' ? 'Cloud & Identity Foundation' : `${FAMILY_LABELS[family] || ucTheme}`;
  } else if (pathPhase === 'walk') {
    const walkCore = walkVariantLabel(plan.secondaryFocusName);
    dynamicCore = family === 'cloud' ? `Cloud ${walkCore}` : `${ucTheme.replace(/ Foundation$/, '')} ${walkCore}`;
  } else {
    dynamicCore = intake.runGoal?.includes('matur') ? 'Enterprise Security Maturity' : `${ucTheme} Maturity`;
  }

  dynamicCore = dynamicCore.replace(/\s+/g, ' ').trim().slice(0, 48);
  const displayLabel = `${roleName} — ${dynamicCore}`;

  const seed = hashString([pathPhase, ...sourceIds].join('|'));
  if (dynamicCore.length < 8 && seed % 3 === 0) {
    dynamicCore = `${FAMILY_LABELS[family]} ${PHASE_SUFFIX[pathPhase] || 'Path'}`;
  }

  return {
    roleName,
    dynamicName: dynamicCore,
    displayLabel: `${roleName} — ${dynamicCore}`,
  };
}

/**
 * Apply dynamic naming to a plan object (mutates copy).
 */
export function enrichPlanWithDynamicName(plan, useCases = [], intake = {}) {
  if (!plan) return plan;
  const naming = generatePathDisplayName({
    pathPhase: plan.pathPhase,
    pathVariant: plan.pathVariant,
    plan,
    useCases,
    intake,
  });
  return {
    ...plan,
    dynamicPathName: naming.dynamicName,
    displayLabel: naming.displayLabel,
    pathSubtitle: naming.dynamicName,
  };
}
