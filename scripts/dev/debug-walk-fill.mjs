import { flattenSourceCatalog } from '../src/services/sizingEngine.js';
import { scoreAllSources } from '../src/services/priorityEngine.js';
import { calculateCoverage } from '../src/services/coverageEngine.js';
import sourceCatalog from '../src/data/sources.json' with { type: 'json' };
import sampleScenarios from '../src/data/sampleScenarios.json' with { type: 'json' };
import useCaseProfiles from '../src/data/useCaseProfiles.json' with { type: 'json' };
import { generatePlans } from '../src/services/planEngine.js';

const flat = flattenSourceCatalog(sourceCatalog);
const m = sampleScenarios[0];
const ucs = useCaseProfiles.filter((u) =>
  ['foundational_security', 'enterprise_security', 'threat_detection', 'compliance_audit', 'identity_access'].includes(u.id),
);
const plans = generatePlans(flat, m.sources, ucs, [], {}, 0.2, { budgetGbDay: 100 });
const walk = plans[1];
console.log('walk sources', walk.sources.length, walk.totals.buffered.expected);
const ids = new Set(walk.sources.map((s) => s.id));
const allScored = scoreAllSources(flat, ucs, calculateCoverage([]), m.sources);
const missing = allScored.filter((r) => !ids.has(r.id) && r.priorityScore > 40).map((r) => r.id);
console.log('high-priority not in walk', missing.slice(0, 20).join(', '));
