const L0_CACHE_KEY = 'openalex_concepts_l0_v1';
const MAILTO = 'mailto=praveen.jay80@gmail.com';

let l0Cache = null;

function shortId(url) {
  return url?.split('/').pop() || url;
}

export async function getLevel0() {
  if (l0Cache) return l0Cache;
  try {
    const cached = JSON.parse(localStorage.getItem(L0_CACHE_KEY) || 'null');
    if (cached) { l0Cache = cached; return cached; }
  } catch {}

  const res = await fetch(
    `https://api.openalex.org/concepts?filter=level:0&per-page=200&${MAILTO}`
  );
  if (!res.ok) throw new Error('OpenAlex concepts fetch failed');
  const json = await res.json();

  const data = (json.results || []).map(c => ({
    id: c.id,
    sid: shortId(c.id),
    name: c.display_name,
    wc: c.works_count,
  }));

  l0Cache = data;
  try { localStorage.setItem(L0_CACHE_KEY, JSON.stringify(data)); } catch {}
  return data;
}

export async function fetchChildren(parentSid, childLevel) {
  const url =
    `https://api.openalex.org/concepts` +
    `?filter=ancestors.id:${parentSid},level:${childLevel}` +
    `&per-page=80&${MAILTO}`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.results || []).map(c => ({
    id: c.id,
    sid: shortId(c.id),
    name: c.display_name,
    wc: c.works_count,
  }));
}
