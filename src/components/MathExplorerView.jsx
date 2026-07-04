import { useState, useRef } from 'react';
import { MATH_TAXONOMY } from '../utils/mathTaxonomy';
import { mathWorksFromClaude, explainWorkForBeginners } from '../utils/mathWorksFromClaude';

const DOMAIN_COLORS = {
  foundations: '#6D28D9',
  algebra: '#1D4ED8',
  'number-theory': '#0E7490',
  geometry: '#065F46',
  topology: '#92400E',
  analysis: '#991B1B',
  equations: '#7C3AED',
  probability: '#9D174D',
  discrete: '#3730A3',
  computation: '#134E4A',
  numerics: '#78350F',
  optimization: '#14532D',
  applied: '#1E3A5F',
  'math-physics': '#581C87',
  emerging: '#881337',
};

const TYPE_LABELS = { textbook: 'Textbook', paper: 'Paper', 'lecture-notes': 'Notes', monograph: 'Monograph' };

function scholarUrl(title, authors) {
  const q = [title, authors].filter(Boolean).join(' ');
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`;
}
const LEVEL_COLORS = {
  undergraduate: '#059669',
  'early-graduate': '#0891B2',
  graduate: '#1D4ED8',
  research: '#7C3AED',
};

function ReadingItem({ item, query, domainColor, isExpanded, onToggle, explanation, explainLoading }) {
  const typeColor = '#78716C';
  const levelColor = LEVEL_COLORS[item.level] || '#6B7280';

  return (
    <div className="border border-stone-200 bg-white">
      {/* Item header — always visible */}
      <div className="flex gap-4 px-5 py-4">
        {/* Order badge */}
        <div
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
          style={{ background: domainColor, color: '#fff' }}
        >
          {item.order}
        </div>

        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            <span
              className="text-xs px-1.5 py-0.5 font-mono rounded-sm"
              style={{ background: `${levelColor}18`, color: levelColor }}
            >
              {item.level}
            </span>
            <span className="text-xs px-1.5 py-0.5 font-mono rounded-sm bg-stone-100 text-stone-500">
              {TYPE_LABELS[item.type] || item.type}
            </span>
          </div>

          {/* Title */}
          <div className="font-semibold text-stone-900 text-sm leading-snug">{item.title}</div>
          {item.authors && (
            <div className="text-xs text-stone-500 mt-0.5">
              {item.authors}{item.year ? `, ${item.year}` : ''}
            </div>
          )}

          {/* Focus */}
          {item.focus && (
            <div className="mt-2 text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-sm px-2.5 py-1.5 leading-relaxed">
              <span className="font-mono text-stone-400 mr-1">Focus:</span>{item.focus}
            </div>
          )}

          {/* Why */}
          {item.why && (
            <div className="mt-1.5 text-xs text-stone-400 italic leading-relaxed">{item.why}</div>
          )}

          {/* Scholar link */}
          <a
            href={scholarUrl(item.title, item.authors)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Google Scholar
          </a>

          {/* Explain button */}
          <button
            onClick={onToggle}
            className="mt-2.5 text-xs font-mono flex items-center gap-1 transition-colors"
            style={{ color: isExpanded ? domainColor : '#A8A29E' }}
          >
            {explainLoading
              ? <><span className="flex gap-0.5"><span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/></span> explaining…</>
              : isExpanded
              ? '▲ hide explanation'
              : '▼ explain for beginners'
            }
          </button>
        </div>
      </div>

      {/* Expanded explanation */}
      {(isExpanded || explainLoading) && (
        <div className="px-5 pb-5 pt-1 border-t border-stone-100 ml-11">
          {explanation
            ? <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{explanation}</p>
            : explainLoading
            ? <p className="text-sm text-stone-400 italic">Generating explanation…</p>
            : null
          }
        </div>
      )}
    </div>
  );
}

function SubfieldPanel({ subfield, domainColor, isOpen, onToggle, onTopicClick, activeQuery, listData }) {
  const query = activeQuery || subfield.name;
  const items = listData?.items || [];
  const overview = listData?.overview || '';
  const loading = listData?.loading || false;
  const error = listData?.error || null;

  const [expandedItem, setExpandedItem] = useState(null);
  const [explanations, setExplanations] = useState({});
  const [explainLoading, setExplainLoading] = useState({});
  const abortRefs = useRef({});

  function handleExplain(item) {
    const key = `${item.order}::${query}`;
    if (expandedItem === key) {
      setExpandedItem(null);
      return;
    }
    setExpandedItem(key);
    if (explanations[key]) return; // already fetched

    // abort any previous for this slot
    abortRefs.current[key]?.abort();
    const ctrl = new AbortController();
    abortRefs.current[key] = ctrl;

    setExplainLoading(prev => ({ ...prev, [key]: true }));
    setExplanations(prev => ({ ...prev, [key]: '' }));

    explainWorkForBeginners({
      title: item.title,
      authors: item.authors,
      year: item.year,
      focus: item.focus,
      topic: query,
      onChunk: chunk => setExplanations(prev => ({ ...prev, [key]: (prev[key] || '') + chunk })),
      signal: ctrl.signal,
    }).finally(() => setExplainLoading(prev => ({ ...prev, [key]: false })));
  }

  return (
    <div className="border border-stone-200 bg-white">
      {/* Subfield header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium text-stone-900 text-sm">{subfield.name}</div>
          {!isOpen && <div className="text-xs text-stone-400 mt-0.5 truncate">{subfield.role}</div>}
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={`shrink-0 ml-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-stone-100">
          {/* Role + topic chips */}
          <div className="px-5 pt-4 pb-4">
            <p className="text-sm text-stone-600 leading-relaxed mb-4">{subfield.role}</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onTopicClick(subfield.name)}
                className="px-2.5 py-1 text-xs rounded-sm border transition-colors"
                style={query === subfield.name
                  ? { background: domainColor, color: '#fff', borderColor: domainColor }
                  : { background: 'transparent', color: '#78716C', borderColor: '#E7E5E4' }}
              >
                {subfield.name}
              </button>
              {subfield.topics.map(t => (
                <button key={t} onClick={() => onTopicClick(t)}
                  className="px-2.5 py-1 text-xs rounded-sm border transition-colors"
                  style={query === t
                    ? { background: domainColor, color: '#fff', borderColor: domainColor }
                    : { background: 'transparent', color: '#78716C', borderColor: '#E7E5E4' }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 px-5 py-6">
              <span className="flex gap-0.5">
                <span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/>
              </span>
              <span className="text-xs text-stone-400">Building reading sequence for "{query}"…</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="mx-5 mb-4 px-4 py-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-sm">
              {error}
            </div>
          )}

          {/* Reading list */}
          {!loading && !error && items.length > 0 && (
            <div>
              {overview && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-stone-600 leading-relaxed border-l-2 pl-3" style={{ borderColor: domainColor }}>
                    {overview}
                  </p>
                </div>
              )}
              <div className="px-5 pb-5 space-y-2">
                <div className="text-xs font-mono text-stone-400 mb-3 uppercase tracking-wider">
                  Reading sequence · {items.length} works
                </div>
                {items.map(item => {
                  const key = `${item.order}::${query}`;
                  return (
                    <ReadingItem
                      key={key}
                      item={item}
                      query={query}
                      domainColor={domainColor}
                      isExpanded={expandedItem === key}
                      onToggle={() => handleExplain(item)}
                      explanation={explanations[key] || ''}
                      explainLoading={explainLoading[key] || false}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MathExplorerView() {
  const [activeDomainId, setActiveDomainId] = useState(MATH_TAXONOMY[0].id);
  const [openSubfieldId, setOpenSubfieldId] = useState(null);
  const [activeTopics, setActiveTopics] = useState({});
  const [listData, setListData] = useState({});
  const inFlight = useRef(new Set());

  const domain = MATH_TAXONOMY.find(d => d.id === activeDomainId);
  const color = DOMAIN_COLORS[activeDomainId] || '#374151';

  async function doFetch(subfieldId, query) {
    const key = `${subfieldId}::${query}`;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setListData(prev => ({ ...prev, [key]: { items: [], overview: '', loading: true, error: null } }));
    const result = await mathWorksFromClaude(query);
    setListData(prev => ({
      ...prev,
      [key]: { items: result.items, overview: result.overview, loading: false, error: result.error },
    }));
  }

  function handleDomainClick(domainId) {
    setActiveDomainId(domainId);
    setOpenSubfieldId(null);
  }

  function handleSubfieldToggle(subfield) {
    if (openSubfieldId === subfield.id) { setOpenSubfieldId(null); return; }
    setOpenSubfieldId(subfield.id);
    const query = activeTopics[subfield.id] || subfield.name;
    doFetch(subfield.id, query);
  }

  function handleTopicClick(subfield, topic) {
    setActiveTopics(prev => ({ ...prev, [subfield.id]: topic }));
    doFetch(subfield.id, topic);
  }

  return (
    <div className="mt-8">
      {/* Domain tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1 min-w-max">
          {MATH_TAXONOMY.map(d => {
            const isActive = d.id === activeDomainId;
            const c = DOMAIN_COLORS[d.id] || '#374151';
            return (
              <button key={d.id} onClick={() => handleDomainClick(d.id)}
                className="px-3 py-2 text-xs font-medium rounded-sm transition-colors whitespace-nowrap"
                style={isActive ? { background: c, color: '#fff' } : { background: '#F5F5F4', color: '#78716C' }}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Domain header */}
      <div className="mt-5 mb-4">
        <h2 className="text-lg font-semibold text-stone-900">{domain.description}</h2>
        <p className="text-xs text-stone-400 mt-0.5">
          {domain.subfields.length} subfields · expand a subfield to load its reading sequence · click any topic chip to focus
        </p>
      </div>

      {/* Subfields */}
      <div className="space-y-2">
        {domain.subfields.map(sf => {
          const query = activeTopics[sf.id] || sf.name;
          const key = `${sf.id}::${query}`;
          return (
            <SubfieldPanel
              key={sf.id}
              subfield={sf}
              domainColor={color}
              isOpen={openSubfieldId === sf.id}
              onToggle={() => handleSubfieldToggle(sf)}
              onTopicClick={t => handleTopicClick(sf, t)}
              activeQuery={activeTopics[sf.id] || null}
              listData={listData[key] || null}
            />
          );
        })}
      </div>
    </div>
  );
}
