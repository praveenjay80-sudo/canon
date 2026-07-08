import { useState, useRef, useCallback } from 'react';
import { openAlexAuth } from '../utils/openAlexAuth';

const MAILTO = 'mailto=praveen.jay80@gmail.com';

const LEVEL_LABELS = ['Domain', 'Field', 'Subfield', 'Topic', 'Concept', 'Micro'];
const LEVEL_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-stone-100 text-stone-600',
  'bg-stone-100 text-stone-500',
];

function ExternalLinkIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
      <path d="M1 8L8 1M8 1H3M8 1V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ConceptSearch({ onSelect, disabled }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setLoading(false); return; }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const res = await fetch(
        `https://api.openalex.org/concepts?search=${encodeURIComponent(q)}&per-page=12&${MAILTO}${openAlexAuth()}`,
        { signal: abortRef.current.signal }
      );
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      setResults(json.results || []);
    } catch (e) {
      if (e.name !== 'AbortError') setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(q), 300);
  }

  function handleSelect(concept) {
    onSelect(concept.display_name);
    setQuery('');
    setResults([]);
  }

  return (
    <div className="mb-5">
      <p className="text-xs font-mono text-stone-400 mb-2">Concepts</p>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          disabled={disabled}
          placeholder="Search 65k concepts…"
          className="w-full text-xs px-2 py-1.5 border border-stone-200 bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400 disabled:opacity-40"
        />
        {loading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs animate-pulse">…</span>
        )}
      </div>

      {results.length > 0 && (
        <ul className="mt-1 border border-stone-200 bg-white divide-y divide-stone-100 max-h-72 overflow-y-auto">
          {results.map(concept => {
            const level = concept.level ?? 4;
            return (
              <li key={concept.id} className="group/concept flex items-start">
                <button
                  onClick={() => handleSelect(concept)}
                  disabled={disabled}
                  className="flex-1 text-left px-2 py-1.5 min-w-0 hover:bg-stone-50 disabled:opacity-40 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`shrink-0 text-[10px] px-1 py-0.5 font-mono ${LEVEL_COLORS[level] || LEVEL_COLORS[4]}`}>
                      {LEVEL_LABELS[level] ?? `L${level}`}
                    </span>
                    <span className="text-xs text-stone-800 truncate">{concept.display_name}</span>
                  </div>
                  {concept.works_count != null && (
                    <div className="text-[10px] text-stone-400 mt-0.5 pl-0.5">
                      {concept.works_count.toLocaleString()} works
                    </div>
                  )}
                </button>
                <a
                  href={concept.id}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="shrink-0 opacity-0 group-hover/concept:opacity-100 transition-opacity p-2 text-stone-400 hover:text-stone-600"
                  title="Open in OpenAlex"
                >
                  <ExternalLinkIcon />
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <p className="text-xs text-stone-400 px-2 py-1.5">No concepts found</p>
      )}
    </div>
  );
}
