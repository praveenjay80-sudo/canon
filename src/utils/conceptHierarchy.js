let _cache = null;

export async function loadConceptHierarchy() {
  if (_cache) return _cache;
  const res = await fetch('/concept-hierarchy.json');
  if (!res.ok) throw new Error(`Failed to load concept hierarchy: ${res.status}`);
  const concepts = await res.json();

  // Build parent → children index
  const children = {};
  for (const [id, c] of Object.entries(concepts)) {
    for (const pid of c.p) {
      if (!children[pid]) children[pid] = [];
      children[pid].push(id);
    }
  }

  // Level-0 roots, alphabetical
  const roots = Object.entries(concepts)
    .filter(([, c]) => c.l === 0)
    .sort(([, a], [, b]) => a.n.localeCompare(b.n))
    .map(([id]) => id);

  _cache = { concepts, children, roots, total: Object.keys(concepts).length };
  return _cache;
}

export function getConceptUrl(id) {
  return `https://openalex.org/${id}`;
}
