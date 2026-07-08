const MAILTO = 'mailto=canon-app@praveen.dev';

async function fetchWithTimeout(url, options = {}, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function extractAuthors(authorships) {
  return (authorships || []).slice(0, 3).map(a => a.author?.display_name).filter(Boolean).join(', ');
}

function oaWork(w) {
  return {
    title: w.title,
    authors: extractAuthors(w.authorships),
    year: w.publication_year,
    citationCount: w.cited_by_count || 0,
    fwci: w.fwci ?? null,
    type: w.type,
    isOA: w.open_access?.is_oa || false,
    oaUrl: w.open_access?.oa_url || null,
    venue: w.primary_location?.source?.display_name || null,
    doi: w.doi || null,
    countsByYear: w.counts_by_year || [],
  };
}

export function recentCitationVelocity(work) {
  const counts = work.countsByYear || [];
  const sorted = [...counts].sort((a, b) => b.year - a.year);
  return sorted.slice(0, 2).reduce((sum, c) => sum + (c.cited_by_count || 0), 0);
}

// Topic ids from fetchOpenAlexTaxonomy() are full URLs (https://openalex.org/T10883);
// the filter param wants the bare id.
function bareId(id) {
  return id.split('/').pop();
}

// Broad OpenAlex topic nodes pull in software manuals, program docs, and bare
// journal/proceedings containers alongside real scholarship. type:article|book
// removes datasets/reports/editorials server-side; this catches what slips through.
const NOISE_TITLE_RE = /\b(user'?s?\s+guide|user\s+manual|reference\s+guide|reference\s+manual|instruction\s+manual|program\s+distributed\s+by|proceeding(s)?|symposium|workshop\s+on|for\s+windows|for\s+personal\s+computers|version\s+\d)\b/i;
// Bare journal/venue placeholders masquerading as a work title: "X forum",
// or a "<journal name> <volume>(<issue>) <year>" citation stub with no real title.
const NOISE_CONTAINER_RE = /\bforum$|\d+\(\d+\)\s+\d{4}$/i;

function isNoisyTitle(title) {
  const t = (title || '').trim();
  if (t.length < 8) return true;
  if (/^\d+$/.test(t)) return true;
  return NOISE_TITLE_RE.test(t) || NOISE_CONTAINER_RE.test(t);
}

export async function fetchTopicWorks(topicId, limit = 30) {
  const fetchLimit = Math.min(limit * 3, 100);
  const url = `https://api.openalex.org/works?filter=topics.id:${encodeURIComponent(bareId(topicId))},type:article|book&select=title,authorships,publication_year,cited_by_count,fwci,type,open_access,primary_location,doi,counts_by_year&sort=cited_by_count:desc&per_page=${fetchLimit}&${MAILTO}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`OpenAlex fetch failed: ${res.status}`);
  const json = await res.json();
  return (json.results || [])
    .map(oaWork)
    .filter(w => !isNoisyTitle(w.title))
    .slice(0, limit);
}
