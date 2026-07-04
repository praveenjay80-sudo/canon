import { useState, useEffect } from 'react';
import { getLevel0, fetchChildren } from '../utils/openAlexConcepts';

function OAIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M1.5 8.5L8.5 1.5M8.5 1.5H3.5M8.5 1.5V6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GenerateIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 5h6M6 2.5L8.5 5 6 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg width="8" height="8" viewBox="0 0 10 10" fill="none"
      className={`shrink-0 transition-transform duration-100 ${open ? 'rotate-90' : ''}`}>
      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const DEPTH_CONFIG = [
  { text: 'text-sm font-semibold text-stone-900', badge: 'bg-violet-600 text-white', border: 'border-violet-300', link: 'text-violet-500 hover:text-violet-700', gen: 'text-violet-400 hover:text-violet-700 hover:bg-violet-50' },
  { text: 'text-xs font-medium text-stone-800',  badge: 'bg-sky-500 text-white',    border: 'border-sky-200',    link: 'text-sky-500 hover:text-sky-700',    gen: 'text-sky-400 hover:text-sky-700 hover:bg-sky-50' },
  { text: 'text-xs text-stone-700',              badge: 'bg-teal-500 text-white',   border: 'border-teal-200',   link: 'text-teal-500 hover:text-teal-700',  gen: 'text-teal-400 hover:text-teal-700 hover:bg-teal-50' },
  { text: 'text-xs text-stone-600',              badge: 'bg-amber-500 text-white',  border: 'border-amber-200',  link: 'text-amber-500 hover:text-amber-700', gen: 'text-amber-400 hover:text-amber-700 hover:bg-amber-50' },
  { text: 'text-[11px] text-stone-500',          badge: 'bg-stone-400 text-white',  border: 'border-stone-200',  link: 'text-stone-400 hover:text-stone-600', gen: 'text-stone-400 hover:text-stone-600 hover:bg-stone-50' },
  { text: 'text-[11px] text-stone-400',          badge: 'bg-stone-300 text-stone-700', border: 'border-stone-100', link: 'text-stone-400 hover:text-stone-600', gen: 'text-stone-400 hover:text-stone-600 hover:bg-stone-50' },
];

const LEVEL_LABELS = ['Domain', 'Field', 'Sub', 'Topic', 'Concept', 'Micro'];
const MAX_LEVEL = 5;

function fmt(n) {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function ConceptNode({ concept, depth, childLevel, onSelect, disabled }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);

  const cfg = DEPTH_CONFIG[Math.min(depth, DEPTH_CONFIG.length - 1)];
  const canExpand = childLevel <= MAX_LEVEL;

  async function expand() {
    if (!canExpand) return;
    if (children === null) {
      setLoading(true);
      try {
        const kids = await fetchChildren(concept.sid, childLevel);
        setChildren(kids);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(v => !v);
  }

  return (
    <li>
      {/* Row: click anywhere to expand/collapse */}
      <div
        role="button"
        tabIndex={0}
        onClick={canExpand && !disabled ? expand : undefined}
        onKeyDown={e => e.key === 'Enter' && canExpand && !disabled && expand()}
        className={`group/node flex items-center gap-1 py-1 cursor-pointer select-none transition-colors hover:bg-stone-50 ${expanded ? 'bg-stone-50' : ''} ${disabled ? 'opacity-40 cursor-default' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {/* chevron — visual indicator only */}
        <span className={`shrink-0 w-3 flex items-center justify-center text-stone-400 ${!canExpand ? 'invisible' : ''}`}>
          <ChevronIcon open={expanded} />
        </span>

        {/* level badge */}
        <span className={`shrink-0 text-[9px] font-mono px-1 py-px leading-none ${cfg.badge}`}>
          {LEVEL_LABELS[depth] ?? `L${depth}`}
        </span>

        {/* name */}
        <span className={`flex-1 truncate ${cfg.text}`}>{concept.name}</span>

        {/* works count */}
        {concept.wc != null && (
          <span className="shrink-0 text-[10px] text-stone-400 font-mono">{fmt(concept.wc)}</span>
        )}

        {/* generate canon */}
        <button
          onClick={e => { e.stopPropagation(); onSelect(concept.name); }}
          disabled={disabled}
          className={`shrink-0 opacity-0 group-hover/node:opacity-100 transition-opacity p-0.5 rounded-sm ${cfg.gen}`}
          title={`Generate canon for "${concept.name}"`}
        >
          <GenerateIcon />
        </button>

        {/* OpenAlex link */}
        <a
          href={concept.id}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className={`shrink-0 opacity-0 group-hover/node:opacity-100 transition-opacity p-0.5 ${cfg.link}`}
          title="Open in OpenAlex"
        >
          <OAIcon />
        </a>
      </div>

      {expanded && (
        <ul className={`border-l-2 ${cfg.border}`} style={{ marginLeft: `${depth * 12 + 12}px` }}>
          {loading && (
            <li className="text-xs text-stone-400 py-1 pl-2 animate-pulse">Loading…</li>
          )}
          {!loading && children?.length === 0 && (
            <li className="text-xs text-stone-400 py-1 pl-2">No subconcepts</li>
          )}
          {children?.map(child => (
            <ConceptNode
              key={child.id}
              concept={child}
              depth={depth + 1}
              childLevel={childLevel + 1}
              onSelect={onSelect}
              disabled={disabled}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function ConceptTree({ onSelect, disabled }) {
  const [l0, setL0] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getLevel0()
      .then(setL0)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-mono text-stone-400">Concepts</p>
        <a
          href="https://openalex.org/concepts"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-stone-400 hover:text-violet-600 transition-colors flex items-center gap-0.5"
        >
          OpenAlex <OAIcon />
        </a>
      </div>

      {loading && <p className="text-xs text-stone-400 px-2 py-1 animate-pulse">Loading concepts…</p>}
      {error && <p className="text-xs text-red-400 px-2 py-1">Failed to load concepts</p>}

      {l0 && (
        <ul className="space-y-0.5">
          {l0.map(concept => (
            <ConceptNode
              key={concept.id}
              concept={concept}
              depth={0}
              childLevel={1}
              onSelect={onSelect}
              disabled={disabled}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
