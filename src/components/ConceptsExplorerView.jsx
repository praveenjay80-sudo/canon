import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ConceptHierarchy from './ConceptHierarchy';
import { loadConceptHierarchy, getConceptUrl } from '../utils/conceptHierarchy';

const MODES = [
  { key: 'canon',        label: 'Canon',        desc: 'Definitive reading list' },
  { key: 'curriculum',   label: 'Curriculum',   desc: 'University course progression' },
  { key: 'dissertation', label: 'Dissertation', desc: 'PhD qualifying exam list' },
  { key: 'drift',        label: 'Canon Drift',  desc: 'How the canon shifted across eras' },
  { key: 'consilience',  label: 'Consilience',  desc: 'Cross-disciplinary synthesis' },
  { key: 'inquiry',      label: 'Inquiry',      desc: 'Open frontier questions' },
  { key: 'reverse',      label: 'Prerequisites',desc: 'Intellectual map for this concept' },
];

const LEVEL_LABELS = ['Domain', 'Field', 'Sub', 'Topic', 'Concept', 'Micro'];
const LEVEL_COUNTS = [19, 284, 21455, 24749, 12395, 6124];
const LEVEL_BADGE  = [
  'bg-violet-600 text-white',
  'bg-sky-500 text-white',
  'bg-teal-500 text-white',
  'bg-amber-500 text-white',
  'bg-rose-500 text-white',
  'bg-stone-400 text-white',
];

const PAGE_SIZE = 200;

function modeShortLabel(mode) {
  return { canon: 'Canon', curriculum: 'Curriculum', dissertation: 'Dissertation',
    drift: 'Drift', consilience: 'Consilience', inquiry: 'Inquiry', reverse: 'Prereqs' }[mode] || 'Canon';
}

function buildAncestorPath(id, concepts) {
  const path = [];
  let cur = concepts[id];
  const seen = new Set([id]);
  while (cur && cur.p.length > 0) {
    const pid = cur.p[0];
    if (seen.has(pid)) break;
    seen.add(pid);
    const parent = concepts[pid];
    if (!parent) break;
    path.unshift({ id: pid, name: parent.n, level: parent.l });
    cur = parent;
  }
  return path;
}

// ── Streaming explanation via Claude Haiku ─────────────────────────────────

async function streamExplain(conceptName, levelLabel, parentName, onChunk, signal) {
  const apiKey = localStorage.getItem('canon_api_key');
  if (!apiKey) throw new Error('No API key — enter your Anthropic key in the settings field above.');

  const context = parentName ? ` (a sub-concept of ${parentName})` : '';
  const prompt = `Explain the academic concept "${conceptName}"${context} in plain English for someone with a general engineering or technical background who may not know this specific area.

Write 3–4 sentences covering: (1) what it is, (2) why it matters or where it's used, (3) one concrete real-world example. Avoid unnecessary jargon. Be direct and clear.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') return;
      try {
        const j = JSON.parse(raw);
        if (j.type === 'content_block_delta' && j.delta?.text) onChunk(j.delta.text);
      } catch {}
    }
  }
}

// ── Shared row renderer ────────────────────────────────────────────────────

function ConceptRow({ item, explain, onExplain, onSelect, onDrill, mode, showPath }) {
  const isExplaining = explain.id === item.id;

  return (
    <div>
      <div className="group flex items-start gap-2.5 px-3 py-2.5 hover:bg-stone-50 transition-colors">
        <span className={`shrink-0 mt-0.5 text-[9px] font-mono font-semibold px-1.5 py-px leading-none ${LEVEL_BADGE[item.level]}`}>
          {LEVEL_LABELS[item.level]}
        </span>

        <div className="flex-1 min-w-0">
          {showPath && item.ancestorPath && item.ancestorPath.length > 0 && (
            <div className="text-[10px] font-mono text-stone-400 mb-0.5 truncate">
              {item.ancestorPath.map(a => a.name).join(' › ')}
            </div>
          )}
          {item.childCount > 0 ? (
            <button
              onClick={() => onDrill(item)}
              className="block w-full text-left text-sm text-stone-800 font-medium truncate hover:text-violet-700 transition-colors"
            >
              {item.name}
            </button>
          ) : (
            <span className="block text-sm text-stone-700 truncate">{item.name}</span>
          )}
          {item.childCount > 0 && (
            <span className="text-[10px] text-stone-400 font-mono">
              {item.childCount} {LEVEL_LABELS[Math.min(item.level + 1, 5)]}{item.childCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onExplain(item)}
            className={`text-[9px] font-mono font-semibold px-2 py-1 border transition-colors
              ${isExplaining
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-stone-200 text-stone-500 hover:border-amber-300 hover:text-amber-700'}`}
          >Explain</button>
          <button
            onClick={() => onSelect(item.name)}
            className="text-[9px] font-mono font-semibold px-2 py-1 bg-stone-900 text-white hover:bg-stone-700 transition-colors whitespace-nowrap"
          >→ {modeShortLabel(mode)}</button>
          <a href={getConceptUrl(item.id)} target="_blank" rel="noopener noreferrer"
            className="text-[9px] font-mono font-semibold text-sky-500 hover:text-sky-700 hover:underline transition-colors">OA↗</a>
        </div>
      </div>

      {isExplaining && (
        <div className="px-4 pb-3 pt-1 bg-amber-50 border-t border-amber-100">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {explain.loading && !explain.text && <p className="text-xs text-amber-500 font-mono animate-pulse">Explaining…</p>}
              {explain.error && <p className="text-xs text-red-500 font-mono">{explain.error}</p>}
              {explain.text && (
                <p className="text-sm text-stone-700 leading-relaxed">
                  {explain.text}
                  {explain.loading && <span className="inline-block w-1 h-3.5 bg-amber-400 ml-0.5 animate-pulse align-middle" />}
                </p>
              )}
            </div>
            <button onClick={() => onExplain(item)} className="shrink-0 text-amber-400 hover:text-amber-700 text-xs mt-0.5">×</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main browser component ─────────────────────────────────────────────────

function Browser({ data, onSelect, mode }) {
  // 'all' | 0..5 = level tab; -1 = drill-down mode
  const [levelTab, setLevelTab] = useState(-1);
  const [path, setPath]         = useState([]);   // drill-down path
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(0);

  const [explain, setExplain]   = useState({ id: null, text: '', loading: false, error: null });
  const abortRef                = useRef(null);
  const explainCache            = useRef({});

  // Pre-build level index: level → sorted array of items
  const byLevel = useMemo(() => {
    const idx = [{}, {}, {}, {}, {}, {}];
    for (const [id, c] of Object.entries(data.concepts)) {
      const l = c.l;
      if (l >= 0 && l <= 5) idx[l][id] = c;
    }
    return idx.map((bucket, l) =>
      Object.entries(bucket)
        .map(([id, c]) => ({
          id, name: c.n, level: c.l,
          childCount: (data.children[id] || []).length,
          ancestorPath: buildAncestorPath(id, data.concepts),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }, [data]);

  // Items shown in drill-down mode
  const currentId = path.length > 0 ? path[path.length - 1].id : null;
  const drillItems = useMemo(() => {
    const ids = currentId ? (data.children[currentId] || []) : data.roots;
    return ids
      .map(id => {
        const c = data.concepts[id];
        return c ? { id, name: c.n, level: c.l, childCount: (data.children[id] || []).length, ancestorPath: [] } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, currentId]);

  // Global search across all 65k
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return null;
    const results = [];
    for (const [id, c] of Object.entries(data.concepts)) {
      if (c.n.toLowerCase().includes(q)) {
        results.push({
          id, name: c.n, level: c.l,
          childCount: (data.children[id] || []).length,
          ancestorPath: buildAncestorPath(id, data.concepts),
        });
      }
    }
    return results.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [data, search]);

  const isSearching = searchResults !== null;

  // Items for level-tab view (with search filter applied)
  const levelItems = useMemo(() => {
    if (levelTab < 0 || levelTab > 5) return [];
    const all = byLevel[levelTab];
    const q = search.trim().toLowerCase();
    return q ? all.filter(it => it.name.toLowerCase().includes(q)) : all;
  }, [byLevel, levelTab, search]);

  function switchTab(tab) {
    setLevelTab(tab);
    setPath([]);
    setPage(0);
    setSearch('');
    closeExplain();
  }

  function drillIn(item) {
    if (item.childCount === 0) return;
    setPath(p => [...p, { id: item.id, name: item.name }]);
    setSearch('');
    setPage(0);
    closeExplain();
  }

  function drillFromSearch(item) {
    const newPath = (item.ancestorPath || []).map(a => ({ id: a.id, name: a.name }));
    if (item.childCount > 0) newPath.push({ id: item.id, name: item.name });
    setPath(newPath);
    setLevelTab(-1);
    setSearch('');
    setPage(0);
    closeExplain();
  }

  function navigateTo(idx) {
    setPath(p => p.slice(0, idx + 1));
    setSearch('');
    setPage(0);
    closeExplain();
  }

  function goRoot() {
    setPath([]);
    setSearch('');
    setPage(0);
    closeExplain();
  }

  function closeExplain() {
    abortRef.current?.abort();
    setExplain({ id: null, text: '', loading: false, error: null });
  }

  const handleExplain = useCallback(async (item) => {
    if (explain.id === item.id) { closeExplain(); return; }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (explainCache.current[item.id]) {
      setExplain({ id: item.id, text: explainCache.current[item.id], loading: false, error: null });
      return;
    }

    setExplain({ id: item.id, text: '', loading: true, error: null });
    const parentName = path.length > 0 ? path[path.length - 1].name : null;

    try {
      let accumulated = '';
      await streamExplain(item.name, LEVEL_LABELS[item.level], parentName,
        chunk => {
          accumulated += chunk;
          setExplain(prev => prev.id === item.id ? { ...prev, text: accumulated, loading: true } : prev);
        }, ctrl.signal);
      explainCache.current[item.id] = accumulated;
      setExplain(prev => prev.id === item.id ? { ...prev, loading: false } : prev);
    } catch (e) {
      if (e.name === 'AbortError') return;
      setExplain(prev => prev.id === item.id ? { ...prev, loading: false, error: e.message } : prev);
    }
  }, [explain.id, path]);

  // Determine what list to show
  const showSearch  = isSearching;
  const showLevel   = !isSearching && levelTab >= 0;
  const showDrill   = !isSearching && levelTab < 0;

  const pagedLevelItems = levelItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(levelItems.length / PAGE_SIZE);

  const rowProps = { explain, onExplain: handleExplain, onSelect, mode };

  return (
    <div>
      {/* Level tabs — always visible */}
      <div className="flex items-center gap-px mb-4 flex-wrap">
        <button
          onClick={() => switchTab(-1)}
          className={`px-3 py-1.5 text-xs font-mono border transition-colors
            ${levelTab === -1 && !isSearching
              ? 'bg-stone-900 text-white border-stone-900'
              : 'bg-white text-stone-500 border-stone-200 hover:text-stone-800 hover:border-stone-400'}`}
        >
          Drill-down
        </button>
        {LEVEL_LABELS.map((label, i) => (
          <button key={label}
            onClick={() => switchTab(i)}
            className={`px-3 py-1.5 text-xs font-mono border transition-colors
              ${levelTab === i && !isSearching
                ? `${LEVEL_BADGE[i]} border-transparent`
                : 'bg-white text-stone-500 border-stone-200 hover:text-stone-800 hover:border-stone-400'}`}
          >
            {label}
            <span className={`ml-1.5 text-[9px] font-mono ${levelTab === i && !isSearching ? 'opacity-70' : 'text-stone-400'}`}>
              {LEVEL_COUNTS[i].toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="text-xs font-mono text-stone-500">
          {showSearch && <>{searchResults.length.toLocaleString()} results across all levels</>}
          {showLevel && <>{levelItems.length.toLocaleString()} {LEVEL_LABELS[levelTab]} concepts
            {search && ' matching'}{currentId && ` under ${data.concepts[currentId]?.n}`}
            {totalPages > 1 && <span className="text-stone-400"> · page {page + 1}/{totalPages}</span>}
          </>}
          {showDrill && <>{drillItems.length.toLocaleString()} items
            {currentId && <span className="text-stone-400"> under {data.concepts[currentId]?.n}</span>}
          </>}
        </div>
        <div className="relative shrink-0">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search all 65,026 concepts…"
            className="border border-stone-200 px-2.5 py-1.5 text-xs font-mono w-60 focus:outline-none focus:border-violet-400 bg-white"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs">×</button>
          )}
        </div>
      </div>

      {/* Drill-down breadcrumb */}
      {showDrill && (
        <div className="flex items-center flex-wrap gap-x-1 gap-y-1 mb-3 px-1">
          <button onClick={goRoot}
            className={`text-sm font-mono transition-colors ${path.length === 0 ? 'text-stone-900 font-bold' : 'text-stone-400 hover:text-stone-700'}`}>
            All Domains
          </button>
          {path.map((p, i) => (
            <span key={p.id} className="flex items-center gap-1">
              <span className="text-stone-300">›</span>
              <button onClick={() => navigateTo(i)}
                className={`text-sm font-mono transition-colors ${i === path.length - 1 ? 'text-stone-900 font-bold' : 'text-stone-400 hover:text-stone-700'}`}>
                {p.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Item list */}
      <div className="border border-stone-200 bg-white divide-y divide-stone-100">

        {/* Search results */}
        {showSearch && searchResults.map(item => (
          <ConceptRow key={item.id} item={item} showPath onDrill={drillFromSearch} onSelect={onSelect} {...rowProps} />
        ))}
        {showSearch && searchResults.length === 0 && (
          <div className="px-4 py-10 text-sm text-stone-400 font-mono text-center">No concepts match "{search}"</div>
        )}

        {/* Level tab — flat list with paths */}
        {showLevel && pagedLevelItems.map(item => (
          <ConceptRow key={item.id} item={item} showPath onDrill={drillFromSearch} onSelect={onSelect} {...rowProps} />
        ))}
        {showLevel && levelItems.length === 0 && (
          <div className="px-4 py-10 text-sm text-stone-400 font-mono text-center">No concepts match "{search}"</div>
        )}

        {/* Drill-down results */}
        {showDrill && drillItems.map(item => (
          <ConceptRow key={item.id} item={item} showPath={false} onDrill={drillIn} onSelect={onSelect} {...rowProps} />
        ))}
        {showDrill && drillItems.length === 0 && (
          <div className="px-4 py-10 text-sm text-stone-400 font-mono text-center">No children found</div>
        )}
      </div>

      {/* Pagination for level view */}
      {showLevel && totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <button
            onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs font-mono border border-stone-200 bg-white text-stone-600 hover:border-stone-400 disabled:opacity-30 disabled:cursor-default"
          >← Prev</button>
          <span className="text-xs font-mono text-stone-400">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, levelItems.length)} of {levelItems.length.toLocaleString()}
          </span>
          <button
            onClick={() => { setPage(p => Math.min(totalPages - 1, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-xs font-mono border border-stone-200 bg-white text-stone-600 hover:border-stone-400 disabled:opacity-30 disabled:cursor-default"
          >Next →</button>
        </div>
      )}
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────

export default function ConceptsExplorerView({ onGenerate, disabled }) {
  const [mode, setMode]       = useState('canon');
  const [view, setView]       = useState('browse');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    loadConceptHierarchy()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedMode = MODES.find(m => m.key === mode);

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">OpenAlex Concept Explorer</h2>
          <span className="text-sm font-mono text-stone-400">
            {data ? data.total.toLocaleString() : '65,026'} concepts · 6 levels
          </span>
        </div>
        <p className="text-sm text-stone-500 leading-relaxed max-w-2xl">
          Browse all 65k concepts by level — click any level tab to see the full list.
          Search globally, or use Drill-down to navigate the hierarchy.
          Click <strong className="text-amber-600">Explain</strong> for a plain-English summary,
          or <strong className="text-stone-700">→</strong> to generate scholarly content.
        </p>

        {/* Level legend */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {LEVEL_LABELS.map((label, i) => (
            <span key={label} className="flex items-center gap-1">
              <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 leading-none ${LEVEL_BADGE[i]}`}>
                {label}
              </span>
              <span className="text-[9px] font-mono text-stone-400">
                {LEVEL_COUNTS[i].toLocaleString()}
              </span>
              {i < 5 && <span className="text-stone-300 text-xs">→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Mode + View selectors */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest mb-2">Generate as</p>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map(m => (
              <button key={m.key} onClick={() => setMode(m.key)} title={m.desc}
                className={`px-3 py-1.5 text-xs font-mono transition-all border
                  ${mode === m.key
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-800'}`}>
                {m.label}
              </button>
            ))}
          </div>
          {selectedMode && (
            <p className="text-[10px] text-stone-400 mt-1.5 font-mono">
              → <span className="text-stone-600">{selectedMode.desc}</span>
            </p>
          )}
        </div>

        <div className="flex border border-stone-200 shrink-0">
          <button onClick={() => setView('browse')}
            className={`px-4 py-2 text-xs font-mono transition-colors
              ${view === 'browse' ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 hover:text-stone-800'}`}>
            Browse
          </button>
          <button onClick={() => setView('tree')}
            className={`px-4 py-2 text-xs font-mono border-l border-stone-200 transition-colors
              ${view === 'tree' ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 hover:text-stone-800'}`}>
            Tree
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="border border-stone-200 bg-white py-16 flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
          <p className="text-sm text-stone-400 font-mono animate-pulse">Loading 65k concepts…</p>
        </div>
      )}

      {error && (
        <div className="border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-600 font-mono">Failed to load concept hierarchy</p>
          <p className="text-xs text-red-400 mt-1">{error}</p>
        </div>
      )}

      {data && view === 'browse' && (
        <Browser
          data={data}
          onSelect={name => onGenerate(name, mode)}
          mode={mode}
        />
      )}

      {data && view === 'tree' && (
        <div className="border border-stone-200 bg-white" style={{ minHeight: '60vh' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100 bg-stone-50">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-stone-600 uppercase tracking-widest">Hierarchy Tree</span>
              <span className="text-[10px] text-stone-400 font-mono">expand any branch · leaf nodes have no chevron</span>
            </div>
            <a href="https://openalex.org/concepts" target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-mono text-sky-500 hover:text-sky-700 hover:underline">OA↗</a>
          </div>
          <div className="p-2 overflow-y-auto" style={{ maxHeight: '72vh' }}>
            <ConceptHierarchy
              onSelect={name => onGenerate(name, mode)}
              disabled={disabled}
              appMode={mode}
            />
          </div>
        </div>
      )}
    </div>
  );
}
