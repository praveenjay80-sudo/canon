import { useState, useEffect, useRef } from 'react';
import { resolveTopSciSubfield } from '../utils/resolveTopSciSubfield.js';

// Grounds "who works on this" in real citation data (World's Top 2%
// Scientists) instead of Claude naming researchers from its own training
// knowledge — same reasoning as why Most Cited Publications uses OpenAlex
// rather than an LLM. Renders nothing at all when the topic doesn't
// confidently resolve to a known subfield — silence over a wrong guess.

async function fetchTopResearchers(subfield, limit = 5) {
  try {
    const params = new URLSearchParams({
      year: '2024', type: '', sm_field: '', sm_subfield_1: subfield, sm_subfield_2: '',
      cntry: '', authfull: '', inst_name: '', sortBy: 'hindex', sortDir: 'desc',
      page: '1', limit: String(limit),
    });
    const res = await fetch(`/api/topsci/query?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.rows || [];
  } catch { return []; }
}

export default function LeadingResearchersPanel({ topic }) {
  const [state, setState] = useState({ phase: 'idle', subfield: null, researchers: [] });
  const reqRef = useRef(0);

  useEffect(() => {
    if (!topic) { setState({ phase: 'idle', subfield: null, researchers: [] }); return; }
    const reqId = ++reqRef.current;
    setState({ phase: 'loading', subfield: null, researchers: [] });

    (async () => {
      const match = await resolveTopSciSubfield(topic);
      if (reqId !== reqRef.current) return;
      if (!match) { setState({ phase: 'no-match', subfield: null, researchers: [] }); return; }

      const researchers = await fetchTopResearchers(match.subfield);
      if (reqId !== reqRef.current) return;
      setState({ phase: 'done', subfield: match.subfield, researchers });
    })();
  }, [topic]);

  if (state.phase === 'idle' || state.phase === 'no-match') return null;

  if (state.phase === 'loading') {
    return (
      <div className="border border-stone-200 p-4 rounded">
        <p className="text-xs font-mono text-stone-400">Finding leading researchers…</p>
      </div>
    );
  }

  if (state.researchers.length === 0) return null;

  return (
    <div className="border border-stone-200 p-4 rounded">
      <p className="text-xs font-mono text-stone-400 mb-3">
        Leading Researchers — {state.subfield}
        <span className="text-stone-300 font-normal"> (World's Top 2% Scientists, by h-index)</span>
      </p>
      <div className="space-y-2">
        {state.researchers.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <span className="text-stone-800 font-medium">{r.authfull}</span>
              <span className="text-stone-400 text-xs ml-2 truncate">{r.inst_name}</span>
            </div>
            <div className="flex gap-3 shrink-0 text-xs font-mono text-stone-500 tabular-nums">
              <span title="H-index">h{r.hindex}</span>
              <span title="Citations">{r.citations?.toLocaleString()}c</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
