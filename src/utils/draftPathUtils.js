/** Read/write dotted paths on plain objects (e.g. containerCounts.clusters). */

export function getNestedValue(obj, path) {
  if (!path || obj == null) return undefined;
  let cur = obj;
  for (const part of path.split('.')) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function setNestedValue(obj, path, value) {
  if (!path) return obj;
  const parts = path.split('.');
  const root = { ...obj };
  let cur = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    cur[part] = { ...(cur[part] || {}) };
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
  return root;
}

export function patchDraftField(draft, key, value) {
  if (key.includes('.')) {
    return setNestedValue(draft, key, value);
  }
  return { ...draft, [key]: value };
}
