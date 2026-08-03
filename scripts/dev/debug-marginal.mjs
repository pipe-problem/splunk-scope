import { flattenSourceCatalog } from '../src/services/sizingEngine.js';
import { generatePlans } from '../src/services/planEngine.js';
import { scoreAllSources } from '../src/services/priorityEngine.js';
import { calculateCoverage } from '../src/services/coverageEngine.js';
import { calculateFullSourceIngest, sourceCountsTowardTotals } from '../src/services/sourceEligibilityEngine.js';
import sourceCatalog from '../src/data/sources.json' with { type: 'json' };
import sampleScenarios from '../src/data/sampleScenarios.json' with { type: 'json' };
import useCaseProfiles from '../src/data/useCaseProfiles.json' with { type: 'json' };

const flat = flattenSourceCatalog(sourceCatalog);
const m = sampleScenarios[0];
const ucs = useCaseProfiles.filter((u) =>
  ['foundational_security', 'enterprise_security'].includes(u.id),
);
const plans = generatePlans(flat, m.sources, ucs, [], {}, 0.2, { budgetGbDay: 100 });
const selected = plans[1].sources;
const proxy = flat.find((s) => s.id === 'proxy');
const ss = { status: 'future', number_of_users: 240 };
const est = calculateFullSourceIngest(proxy, ss, { catalog: sourceCatalog, allInputs: { ...m.sources, proxy: ss } });
console.log('proxy est', est.expected);
