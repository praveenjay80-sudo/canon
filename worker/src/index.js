const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function titleWords(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
}

function titlesMatch(a, b) {
  const wa = titleWords(a), wb = titleWords(b);
  if (!wa.length || !wb.length) return false;
  const shared = wa.filter(w => wb.includes(w)).length;
  const threshold = Math.max(1, Math.floor(Math.min(wa.length, wb.length) * 0.5));
  return shared >= threshold;
}

function extractYear(summary) {
  if (!summary) return null;
  const m = summary.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0]) : null;
}

async function scholarSearch(title, author, apiKey) {
  const q = [title, author].filter(Boolean).join(' ');
  const url = `https://serpapi.com/search?engine=google_scholar&q=${encodeURIComponent(q)}&num=10&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}`);
  const data = await res.json();
  const results = data.organic_results || [];

  // Collect all title matches, then pick the highest-cited one.
  // "First match" fails for short titles like "A Theory of Justice" where an
  // obscure paper can appear before the canonical work in Scholar results.
  const matches = results.filter(r => titlesMatch(r.title || '', title));
  if (!matches.length) return null;
  const match = matches.reduce((best, r) => {
    const bc = best.inline_links?.cited_by?.total ?? 0;
    const rc = r.inline_links?.cited_by?.total ?? 0;
    return rc > bc ? r : best;
  });

  return {
    citationCount: match.inline_links?.cited_by?.total ?? null,
    title: match.title,
    year: extractYear(match.publication_info?.summary),
    link: match.link || null,
  };
}

function extractAuthors(authors) {
  return (authors || []).map(a => a.name).filter(Boolean).join(', ');
}

async function scholarTopicSearch(query, apiKey, num) {
  const url = `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(query)}&num=${num}&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}`);
  const data = await res.json();
  return (data.organic_results || [])
    .map(r => ({
      title: r.title || '',
      authors: extractAuthors(r.publication_info?.authors),
      year: extractYear(r.publication_info?.summary),
      citationCount: r.inline_links?.cited_by?.total ?? 0,
      link: r.link || '',
    }))
    .sort((a, b) => b.citationCount - a.citationCount);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // Browser-side calls straight to SerpAPI are blocked (no CORS headers on
    // their end, and it would expose the key client-side anyway) — every
    // Scholar-touching feature must route through this worker instead.
    // A caller-supplied `key` takes priority over the worker's own
    // SERPAPI_KEY secret, so BYOK users aren't limited by the shared quota.
    if (url.pathname === '/scholar-search') {
      const q = url.searchParams.get('q')?.trim();
      const num = Math.min(parseInt(url.searchParams.get('num') || '20', 10) || 20, 20);
      const apiKey = url.searchParams.get('key')?.trim() || env.SERPAPI_KEY;

      if (!q) return json({ error: 'q required' }, 400);
      if (!apiKey) return json({ error: 'No SerpAPI key available' }, 500);

      try {
        const cacheKey = `scholarsearch:${q.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)}`;
        const usingSharedKey = apiKey === env.SERPAPI_KEY;
        if (usingSharedKey && env.CACHE) {
          const cached = await env.CACHE.get(cacheKey);
          if (cached) return json(JSON.parse(cached));
        }

        const results = await scholarTopicSearch(q, apiKey, num);

        // Only cache results fetched with the shared key — caching a
        // BYOK user's results under a query-only key would leak them
        // to other users of the shared key for the same query.
        if (usingSharedKey && env.CACHE) {
          await env.CACHE.put(cacheKey, JSON.stringify(results), { expirationTtl: 86400 });
        }

        return json(results);
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    if (url.pathname !== '/enrich') {
      return json({ error: 'Not found' }, 404);
    }

    const title = url.searchParams.get('title')?.trim();
    const author = url.searchParams.get('author')?.trim() || '';

    if (!title) return json({ error: 'title required' }, 400);
    if (!env.SERPAPI_KEY) return json({ error: 'SERPAPI_KEY not configured' }, 500);

    try {
      // Check KV cache first
      const cacheKey = `scholar:${title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)}`;
      if (env.CACHE) {
        const cached = await env.CACHE.get(cacheKey);
        if (cached) return json(JSON.parse(cached));
      }

      const result = await scholarSearch(title, author, env.SERPAPI_KEY);

      // Cache for 7 days
      if (env.CACHE && result) {
        await env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 604800 });
      }

      return json(result);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
};
