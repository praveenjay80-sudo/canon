const DISCIPLINE_COLORS = [
  { badge: 'bg-stone-200 text-stone-700'     },
  { badge: 'bg-sky-100 text-sky-700'         },
  { badge: 'bg-indigo-100 text-indigo-700'   },
  { badge: 'bg-violet-100 text-violet-700'   },
  { badge: 'bg-teal-100 text-teal-700'       },
  { badge: 'bg-emerald-100 text-emerald-700' },
  { badge: 'bg-amber-100 text-amber-700'     },
  { badge: 'bg-rose-100 text-rose-700'       },
];

export default function SpectrumQuestionsView({ listParsed, isStreaming, onSelect }) {
  if (!listParsed) return null;

  const hasContent = listParsed.questions.length > 0;
  if (!hasContent) {
    return (
      <div className="mt-10 flex items-center gap-2.5 text-stone-400">
        <span className="flex gap-0.5">
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
        </span>
        <span className="text-sm">Finding questions that genuinely span disciplines...</span>
      </div>
    );
  }

  return (
    <div className={`mt-10 space-y-4 ${isStreaming ? 'opacity-90' : ''}`}>
      {listParsed.questions.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          disabled={isStreaming}
          className="w-full text-left border border-stone-200 hover:border-cyan-400 hover:bg-cyan-50/30 transition-colors px-6 py-5 disabled:cursor-default disabled:hover:border-stone-200 disabled:hover:bg-transparent"
        >
          <h3 className="text-sm font-semibold text-stone-900 leading-snug">{q.question}</h3>
          {q.disciplines.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {q.disciplines.map((d, j) => {
                const c = DISCIPLINE_COLORS[j % DISCIPLINE_COLORS.length];
                return (
                  <span key={j} className={`text-xs font-mono px-2 py-0.5 ${c.badge}`}>
                    {d.name}{d.tier ? ` · ${d.tier}` : ''}
                  </span>
                );
              })}
            </div>
          )}
          {q.spans && (
            <p className="mt-2.5 text-xs text-stone-500 italic leading-relaxed">{q.spans}</p>
          )}
        </button>
      ))}
    </div>
  );
}
