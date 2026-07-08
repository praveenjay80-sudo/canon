import { openAlexAuth } from './openAlexAuth';

const CACHE_KEY = 'openalex_taxonomy_v2';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const MAILTO = 'mailto=praveen.jay80@gmail.com';

async function fetchAllPages(baseUrl) {
  const results = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${baseUrl}&page=${page}&per-page=200&${MAILTO}${openAlexAuth()}`);
    if (!res.ok) throw new Error(`OpenAlex fetch failed: ${res.status}`);
    const json = await res.json();
    results.push(...(json.results || []));
    if (results.length >= (json.meta?.count || 0)) break;
    page++;
  }
  return results;
}

export async function fetchOpenAlexTaxonomy() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  } catch {}

  // Fetch fields, subfields, and ALL topics in parallel
  const [fields, subfields, topics] = await Promise.all([
    fetchAllPages('https://api.openalex.org/fields?'),
    fetchAllPages('https://api.openalex.org/subfields?'),
    fetchAllPages('https://api.openalex.org/topics?'),
  ]);

  const fieldNames = [];
  const fieldUrls = {};
  const fieldSubfields = {};

  for (const f of fields) {
    fieldNames.push(f.display_name);
    fieldUrls[f.display_name] = f.id;
    fieldSubfields[f.display_name] = (f.subfields || []).map(sf => sf.display_name);
  }

  const subfieldUrls = {};
  const subfieldTopics = {};

  for (const sf of subfields) {
    subfieldUrls[sf.display_name] = sf.id;
    subfieldTopics[sf.display_name] = [];
  }

  // Build subfieldTopics from the full topics list (sf.topics is truncated at 60)
  for (const t of topics) {
    const sfName = t.subfield?.display_name;
    if (sfName) {
      if (!subfieldTopics[sfName]) subfieldTopics[sfName] = [];
      subfieldTopics[sfName].push({ name: t.display_name, url: t.id });
    }
  }

  const data = { fieldNames, fieldUrls, fieldSubfields, subfieldUrls, subfieldTopics };

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}

  return data;
}
