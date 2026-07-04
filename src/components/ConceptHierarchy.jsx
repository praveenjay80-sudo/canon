import { useState, useEffect, useCallback, memo } from 'react';
import { loadConceptHierarchy, getConceptUrl } from '../utils/conceptHierarchy';

const LEVEL_CONFIG = [
  { label: 'Domain',  badge: 'bg-violet-600 text-white',       text: 'text-sm font-semibold text-stone-900',  border: 'border-violet-200',  gen: 'text-violet-500 hover:text-violet-800 hover:bg-violet-50' },
  { label: 'Field',   badge: 'bg-sky-500 text-white',          text: 'text-sm font-medium text-stone-800',    border: 'border-sky-200',     gen: 'text-sky-500 hover:text-sky-800 hover:bg-sky-50' },
  { label: 'Sub',     badge: 'bg-teal-500 text-white',         text: 'text-xs font-medium text-stone-700',    border: 'border-teal-200',    gen: 'text-teal-500 hover:text-teal-800 hover:bg-teal-50' },
  { label: 'Topic',   badge: 'bg-amber-500 text-white',        text: 'text-xs text-stone-600',                border: 'border-amber-200',   gen: 'text-amber-500 hover:text-amber-800 hover:bg-amber-50' },
  { label: 'Concept', badge: 'bg-rose-500 text-white',         text: 'text-[11px] text-stone-600',            border: 'border-rose-200',    gen: 'text-rose-400 hover:text-rose-700 hover:bg-rose-50' },
  { label: 'Micro',   badge: 'bg-stone-400 text-stone-900',    text: 'text-[11px] text-stone-500',            border: 'border-stone-200',   gen: 'text-stone-400 hover:text-stone-600 hover:bg-stone-50' },
];

function ChevronIcon({ open }) {
  return (
    <svg width="8" height="8" viewBox="0 0 10 10" fill="none"
      className={`shrink-0 transition-transform duration-100 ${open ? 'rotate-90' : ''}`}>
      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GenerateIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 5h6M6 2.5L8.5 5 6 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ConceptNode = memo(function ConceptNode({ id, depth, data, onSelect, disabled, appMode }) {
  const [open, setOpen] = useState(false);
  const concept = data.concepts[id];
  if (!concept) return null;

  const cfg = LEVEL_CONFIG[Math.min(concept.l, LEVEL_CONFIG.length - 1)];
  const kids = data.children[id];
  const hasKids = kids && kids.length > 0;
  const url = getConceptUrl(id);

  const modeLabel = {
    canon: 'Canon', curriculum: 'Curriculum', dissertation: 'Dissertation',
    drift: 'Drift', consilience: 'Consilience', inquiry: 'Inquiry',
    reverse: 'Prerequisites', math: 'Reading List',
  }[appMode] || 'Canon';

  return (
    <li>
      <div
        className={`group/node flex items-center gap-1 py-[5px] select-none transition-colors
          hover:bg-stone-50 ${open ? 'bg-stone-50/70' : ''}
          ${disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => hasKids && !disabled && setOpen(v => !v)}
      >
        {/* Chevron */}
        <span className={`shrink-0 w-3 flex items-center justify-center text-stone-300 ${!hasKids ? 'invisible' : ''}`}>
          <ChevronIcon open={open} />
        </span>

        {/* Level badge */}
        <span className={`shrink-0 text-[9px] font-mono font-semibold px-1 py-px leading-none tracking-wide ${cfg.badge}`}>
          {cfg.label}
        </span>

        {/* Name */}
        <span className={`flex-1 truncate leading-snug ${cfg.text}`}>{concept.n}</span>

        {/* Actions — visible on hover */}
        <span className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover/node:opacity-100 transition-opacity mr-0.5">
          <button
            onClick={e => { e.stopPropagation(); onSelect(concept.n); }}
            disabled={disabled}
            className={`flex items-center gap-0.5 text-[9px] font-mono font-semibold px-1 py-0.5 rounded-sm transition-colors ${cfg.gen}`}
            title={`Generate ${modeLabel} for "${concept.n}"`}
          >
            <GenerateIcon />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[9px] font-mono font-semibold text-sky-500 hover:text-sky-700 hover:underline px-0.5 transition-colors"
            title="Open in OpenAlex"
          >
            OA↗
          </a>
        </span>
      </div>

      {/* Children */}
      {open && hasKids && (
        <ul className={`border-l-2 ${cfg.border}`} style={{ marginLeft: `${depth * 12 + 14}px` }}>
          {kids
            .slice()
            .sort((a, b) => (data.concepts[a]?.n || '').localeCompare(data.concepts[b]?.n || ''))
            .map(kid => (
              <ConceptNode
                key={kid}
                id={kid}
                depth={depth + 1}
                data={data}
                onSelect={onSelect}
                disabled={disabled}
                appMode={appMode}
              />
            ))}
        </ul>
      )}
    </li>
  );
});

export default function ConceptHierarchy({ onSelect, disabled, appMode = 'canon' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadConceptHierarchy()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = useCallback(name => onSelect(name), [onSelect]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col gap-2 py-6 px-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-violet-400 animate-pulse rounded-full" />
          <span className="text-xs text-stone-400 font-mono animate-pulse">Loading 65k concepts…</span>
        </div>
        <div className="space-y-1 mt-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-5 bg-stone-100 animate-pulse rounded"
              style={{ width: `${60 + Math.random() * 30}%`, animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 px-2 space-y-1">
        <p className="text-xs text-red-500 font-mono">Failed to load hierarchy</p>
        <p className="text-[10px] text-stone-400">{error}</p>
        <p className="text-[10px] text-stone-400 mt-2">
          Run <code className="font-mono bg-stone-100 px-1">node scripts/build-concepts.mjs</code> to generate the data file.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-bold text-stone-800">
            {data.total.toLocaleString()}
          </span>
          <span className="text-[10px] font-mono text-stone-400">concepts · 6 levels</span>
        </div>
        <div className="flex items-center gap-2">
          {LEVEL_CONFIG.map(({ label, badge }) => (
            <span key={label} className={`text-[8px] font-mono font-semibold px-1 py-px leading-none ${badge}`}>
              {label[0]}
            </span>
          ))}
        </div>
      </div>

      {/* Tree */}
      <ul className="flex-1 overflow-y-auto space-y-0">
        {data.roots.map(id => (
          <ConceptNode
            key={id}
            id={id}
            depth={0}
            data={data}
            onSelect={handleSelect}
            disabled={disabled}
            appMode={appMode}
          />
        ))}
      </ul>
    </div>
  );
}
