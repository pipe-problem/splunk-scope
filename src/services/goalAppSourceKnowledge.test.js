import { describe, it, expect } from 'vitest';
import knowledge from '../data/goalAppSourceKnowledge.json';
import splunkApps from '../data/splunkApps.json';
import appCatalog from '../data/appCatalog.json';
import technicalAddons from '../data/technicalAddons.json';
import sourcesCatalog from '../data/sources.json';
import { flattenSourceCatalog } from './sizingEngine.js';
import { inferSplunkAppType } from './splunkAppsCatalog.js';
import { resolveCanonicalAppId, getAppCatalogEntry } from './appCatalogService.js';
import {
  getGoalsForIntake,
  getAppsForGoal,
  getSourcesForApp,
  getAddonsForSource,
} from './goalAppSourceKnowledge.js';

const flatSources = flattenSourceCatalog(sourcesCatalog);
const SOURCE_IDS = new Set(flatSources.map((s) => s.id));

const SPLUNK_APP_IDS = new Set(
  splunkApps.flatMap((cat) => cat.apps.filter((a) => inferSplunkAppType(a) === 'app').map((a) => a.id)),
);

const CATALOG_APP_IDS = new Set((appCatalog.apps || []).map((a) => a.id));

const TECHNICAL_ADDON_IDS = new Set((technicalAddons.addons || []).map((a) => a.id));

function appIdExistsInCatalog(appId) {
  if (SPLUNK_APP_IDS.has(appId)) return true;
  if (CATALOG_APP_IDS.has(appId)) return true;
  if (resolveCanonicalAppId(appId)) return true;
  if (getAppCatalogEntry(appId)) return true;
  return false;
}

describe('goalAppSourceKnowledge.json closure', () => {
  it('every goal appId exists in apps[]', () => {
    const appIds = new Set(knowledge.apps.map((a) => a.id));
    for (const goal of knowledge.goals) {
      for (const appId of goal.appIds) {
        expect(appIds.has(appId), `goal ${goal.id} references unknown app ${appId}`).toBe(true);
      }
    }
  });

  it('every appId in goals exists in splunkApps or appCatalog', () => {
    const referenced = new Set();
    for (const goal of knowledge.goals) {
      for (const appId of goal.appIds) referenced.add(appId);
    }
    for (const appId of referenced) {
      expect(appIdExistsInCatalog(appId), `appId ${appId} missing from splunkApps/appCatalog`).toBe(true);
    }
  });

  it('every app goalIds reference valid goals', () => {
    const goalIds = new Set(knowledge.goals.map((g) => g.id));
    for (const app of knowledge.apps) {
      for (const goalId of app.goalIds) {
        expect(goalIds.has(goalId), `app ${app.id} references unknown goal ${goalId}`).toBe(true);
      }
    }
  });

  it('goal appIds align with app goalIds (bidirectional closure)', () => {
    for (const goal of knowledge.goals) {
      for (const appId of goal.appIds) {
        const app = knowledge.apps.find((a) => a.id === appId);
        expect(app?.goalIds, `app ${appId} missing goal ${goal.id}`).toContain(goal.id);
      }
    }
  });

  it('priority and app source ids exist in sources catalog', () => {
    for (const goal of knowledge.goals) {
      for (const sourceId of goal.prioritySourceIds) {
        expect(SOURCE_IDS.has(sourceId), `goal ${goal.id} unknown source ${sourceId}`).toBe(true);
      }
    }
    for (const app of knowledge.apps) {
      for (const sourceId of [...app.requiredSourceIds, ...app.recommendedSourceIds]) {
        expect(SOURCE_IDS.has(sourceId), `app ${app.id} unknown source ${sourceId}`).toBe(true);
      }
    }
    for (const addon of knowledge.addons) {
      for (const sourceId of addon.sourceIds) {
        expect(SOURCE_IDS.has(sourceId), `addon ${addon.id} unknown source ${sourceId}`).toBe(true);
      }
    }
  });

  it('addons reference technicalAddons.json entries', () => {
    for (const addon of knowledge.addons) {
      expect(
        TECHNICAL_ADDON_IDS.has(addon.technicalAddonId),
        `addon ${addon.id} missing technicalAddons entry ${addon.technicalAddonId}`,
      ).toBe(true);
    }
  });

  it('seeds minimum spec goals', () => {
    const ids = knowledge.goals.map((g) => g.id);
    expect(ids).toEqual(
      expect.arrayContaining(['siem', 'rba', 'compliance', 'cloud_security', 'platform_admin', 'ml_analytics']),
    );
  });
});

describe('goalAppSourceKnowledge service', () => {
  it('getGoalsForIntake maps SIEM use case to siem goal', () => {
    const goals = getGoalsForIntake({
      useCases: ['Enterprise Security / SIEM'],
      desiredApps: [],
    });
    expect(goals.map((g) => g.id)).toContain('siem');
  });

  it('getGoalsForIntake does not infer ml_analytics from generic AI app alone', () => {
    const goals = getGoalsForIntake({
      useCases: ['Foundational Security / InfoSec'],
      desiredApps: ['ai_assistant_spl'],
    });
    expect(goals.map((g) => g.id)).not.toContain('ml_analytics');
  });

  it('getGoalsForIntake includes ml_analytics for anchored use case profile', () => {
    const goals = getGoalsForIntake({
      useCases: ['AI / ML / Predictive Analytics'],
    });
    expect(goals.map((g) => g.id)).toContain('ml_analytics');
  });

  it('getAppsForGoal returns app records for siem', () => {
    const apps = getAppsForGoal('siem');
    expect(apps.length).toBeGreaterThan(0);
    expect(apps.some((a) => a.id === 'enterprise_security')).toBe(true);
  });

  it('getSourcesForApp returns required and recommended sources', () => {
    const sources = getSourcesForApp('enterprise_security');
    expect(sources.requiredSourceIds).toContain('active_directory');
    expect(sources.recommendedSourceIds).toContain('threat_intel');
    expect(sources.allSourceIds.length).toBeGreaterThan(sources.requiredSourceIds.length);
  });

  it('getAddonsForSource returns AWS TA for iaas', () => {
    const addons = getAddonsForSource('iaas');
    expect(addons.some((a) => a.technicalAddonId === 'ta_aws')).toBe(true);
  });

  it('getAddonsForSource returns empty for unknown source', () => {
    expect(getAddonsForSource('nonexistent_source_xyz')).toEqual([]);
  });
});
