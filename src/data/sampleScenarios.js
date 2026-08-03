import northstar from './sampleScenarios.json';
import additional from './additionalSampleScenarios.json';

/** All demo/practice example scenarios (varying complexity). */
const sampleScenarios = [...northstar, ...additional];

export default sampleScenarios;

export function getSampleScenarioById(id) {
  return sampleScenarios.find((s) => s.id === id) || null;
}
