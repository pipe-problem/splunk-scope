import sources from '../src/data/sources.json' with { type: 'json' };
import questions from '../src/data/sourceMeasurementQuestions.json' with { type: 'json' };
import rates from '../src/data/originalSizingRates.json' with { type: 'json' };
import { resolveMeasurementInputFields } from '../src/utils/measurementInputFields.js';

const sourceById = Object.fromEntries(sources.map((s) => [s.id, s]));
const qMap = questions.questions || {};
const ids = [...new Set([...Object.keys(qMap), ...sources.map((s) => s.id)])].sort();

for (const id of ids) {
  const s = sourceById[id] || { id, name: id, input_fields: [], log_options: [] };
  const m = qMap[id];
  const rate = rates[id];
  const { numbers, selects } = resolveMeasurementInputFields(id, s, m, rate);
  const logs = (s.log_options || [])
    .filter((o) => o.group === 'basic')
    .map((o) => o.label || o.id);
  const extraFields = (s.input_fields || [])
    .filter((f) => f.type !== 'number' && f.type !== 'select')
    .map((f) => `${f.type}:${f.key}`);

  const formatSelect = (sel) => {
    const opts = (sel.options || [])
      .map((o) => o.label || o.value)
      .filter(Boolean)
      .join(', ');
    return `  - \`${sel.key}\` — ${sel.label}${opts ? `: ${opts}` : ''}`;
  };

  console.log(`### ${s.name} (\`${id}\`)`);
  console.log(`- **Sizing question:** ${m?.question || '—'}`);
  console.log(`- **Primary field:** ${m?.primaryInputField || rate?.primaryInputField || '—'}`);
  if (numbers.length) {
    console.log('- **Count inputs:**');
    for (const n of numbers) {
      console.log(`  - \`${n.key}\` — ${n.label}${n.helper ? ` (${n.helper})` : ''}`);
    }
  }
  if (selects.length) {
    console.log('- **Dropdowns:**');
    for (const sel of selects) {
      console.log(formatSelect(sel));
    }
  }
  if (logs.length) {
    console.log(`- **Log type toggles:** ${logs.join('; ')}`);
  }
  if (extraFields.length) {
    console.log(`- **Other fields:** ${extraFields.join('; ')}`);
  }
  console.log('');
}
