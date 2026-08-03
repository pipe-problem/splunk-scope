import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(REPO_ROOT, 'src');
const exts = ['.js', '.jsx', '.ts', '.tsx'];

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (exts.some((x) => e.name.endsWith(x))) acc.push(p);
  }
  return acc;
}

function resolveImport(fromFile, spec) {
  if (spec.startsWith('@/')) {
    return path.join(SRC, spec.slice(2));
  }
  if (spec.startsWith('./') || spec.startsWith('../')) {
    return path.normalize(path.join(path.dirname(fromFile), spec));
  }
  return null;
}

function toRel(abs) {
  return path.relative(SRC, abs).split(path.sep).join('/');
}

const files = walk(SRC);
const graph = new Map();

for (const f of files) {
  const rel = toRel(f);
  const txt = fs.readFileSync(f, 'utf8');
  const imps = new Set();
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(txt))) {
    const targetBase = resolveImport(f, m[1]);
    if (!targetBase || !targetBase.startsWith(SRC)) continue;
    let resolved = null;
    if (exts.some((ext) => targetBase.endsWith(ext)) && fs.existsSync(targetBase)) {
      resolved = targetBase;
    }
    for (const ext of exts) {
      if (fs.existsSync(targetBase + ext)) {
        resolved = targetBase + ext;
        break;
      }
    }
    if (!resolved && fs.existsSync(path.join(targetBase, 'index.js'))) {
      resolved = path.join(targetBase, 'index.js');
    }
    if (!resolved && fs.existsSync(path.join(targetBase, 'index.jsx'))) {
      resolved = path.join(targetBase, 'index.jsx');
    }
    if (resolved) imps.add(toRel(resolved));
  }
  graph.set(rel, [...imps]);
}

function reachable(start) {
  const seen = new Set();
  const q = [...start];
  while (q.length) {
    const n = q.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    for (const dep of graph.get(n) || []) {
      if (!seen.has(dep)) q.push(dep);
    }
  }
  return seen;
}

const entries = ['main.jsx', 'App.jsx'];
const testFiles = files
  .filter((f) => f.includes('.test.'))
  .map((f) => toRel(f));
const used = new Set([...reachable(entries), ...reachable(testFiles)]);
const orphans = files
  .map((f) => toRel(f))
  .filter((f) => !used.has(f) && !f.includes('.test.'));

console.log(`Orphans (${orphans.length}):`);
orphans.sort().forEach((o) => console.log(`  ${o}`));
