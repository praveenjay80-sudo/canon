import { useState, useRef, useCallback, useEffect } from 'react';
import LeadingResearchersPanel from './LeadingResearchersPanel.jsx';

const SYNOPSIS_PROMPT = `You are an expert explainer. Your job is to describe a scholarly work in completely plain, conversational English that anyone can follow with zero prior knowledge. Write as if explaining to a curious, intelligent friend who has never studied this subject and has never heard of this work.

STRICT FORMATTING RULES — violations will make the output unusable:
- No markdown of any kind. No asterisks (*), no double-asterisks (**), no underscores, no hashes (#), no dashes at the start of lines.
- No bold. No italic. No bullet points.
- Plain text only — every word in the same weight.
- No academic phrases like "the author argues," "this work examines," "this seminal text" — just say what it says.
- No jargon without an immediate plain-English definition in the same sentence.
- Output ONLY the structured text below. Start with "TITLE:" and nothing before it — no greeting, no preamble, no "Sure, here's the synopsis."

TITLE: [exact title as given]

WHAT IT IS: [One sentence. What kind of thing is this — a book, a paper, a collection — and what is it about, stated in the simplest possible terms? Avoid the title. Example: "A short philosophy paper that asks whether a computer program can ever genuinely understand language, or whether it just mimics understanding."]

THE BIG IDEA: [3-5 sentences. What is the one central claim or question this work is built around? Explain it from the very beginning — assume the reader knows nothing. If the work makes an argument, state the argument plainly including its logic. If it's a textbook or overview, say what problem it is trying to solve and why that problem matters. Make the stakes clear: why does this idea matter to anyone?]

HOW IT WORKS: [4-6 sentences. How does the author actually make their case? Walk through the reasoning or structure step by step in plain terms: first they establish X, then they show Y follows from X, then they use Z as evidence. Name the specific examples, thought experiments, case studies, or data the author uses. Make the reader feel the shape of the argument, not just its conclusion.]

THE KEY INSIGHT: [3-4 sentences. What is the single most important thing this work shows or argues that was not obvious before it? What does it reveal that changes how you think about the subject? Phrase it as something the reader can immediately grasp and remember — a concrete realization, not an abstract principle.]

WHY IT MATTERS: [3-4 sentences. Why do scholars, students, or curious people still engage with this work? What did it change about how the field thinks or how the problem is approached? Be honest: if it has been partly refuted or superseded, say so and explain what still stands and why it is still worth reading.]

WHO SHOULD READ IT: [2-3 sentences. Be specific and honest. Who gets the most from this work and when in their reading journey? Who should wait until they have read something else first? Is there anyone for whom this would be the wrong starting point?]

HOW TO READ IT: [3-4 sentences. Concrete practical advice. What should the reader pay close attention to? What can be skimmed? Are there specific chapters, sections, or thought experiments that are the core of the work? What should they read before, alongside, or immediately after this to get the most out of it?]`;

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

async function streamSynopsis(title, author, year, annotation, signal, onChunk) {
  const apiKey = resolveApiKey();
  const userMessage = `Give me a detailed synopsis of: "${title}"${author ? ` by ${author}` : ''}${year ? ` (${year})` : ''}.

Here is what we already know about it: ${annotation || '(no prior annotation)'}

Expand on this significantly. Explain everything from scratch for a complete beginner.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 3000,
      stream: true,
      system: SYNOPSIS_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal,
  });

  if (!response.ok) {
    let msg = `API error ${response.status}`;
    try { const err = await response.json(); msg = err.error?.message || msg; } catch {}
    throw new Error(msg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', result = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const event = JSON.parse(data);
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            result += event.delta.text;
            onChunk(result);
          }
        } catch {}
      }
    }
  } finally { reader.releaseLock(); }
  return result;
}

function stripMarkdown(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-•]\s+/gm, '')
    .trim();
}

function parseSynopsis(text) {
  if (!text) return null;
  const fields = ['WHAT IT IS', 'THE BIG IDEA', 'HOW IT WORKS', 'THE KEY INSIGHT', 'WHY IT MATTERS', 'WHO SHOULD READ IT', 'HOW TO READ IT'];
  const result = {};
  for (let fi = 0; fi < fields.length; fi++) {
    const key = fields[fi];
    const next = fields[fi + 1];
    const re = new RegExp(`${key}:\\s*([\\s\\S]*?)${next ? `(?=${next}:)` : '$'}`, 'i');
    const m = text.match(re);
    if (m) result[key] = stripMarkdown(m[1].trim());
  }
  return result;
}

function SynopsisPanel({ work, onClose }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('loading');
  const abortRef = useRef(null);

  useEffect(() => {
    abortRef.current = new AbortController();
    setStatus('loading');
    setText('');
    streamSynopsis(work.title, work.author, work.year, work.annotation, abortRef.current.signal, (chunk) => {
      setText(chunk);
      setStatus('streaming');
    }).then(() => {
      setStatus('done');
    }).catch((err) => {
      if (abortRef.current?.signal.aborted) return;
      setStatus('error');
      setText(err.message);
    });
    return () => abortRef.current?.abort();
  }, [work.title]);

  const parsed = parseSynopsis(text);
  const SECTION_LABELS = [
    ['WHAT IT IS',       'What It Is'],
    ['THE BIG IDEA',     'The Big Idea'],
    ['HOW IT WORKS',     'How It Works'],
    ['THE KEY INSIGHT',  'The Key Insight'],
    ['WHY IT MATTERS',   'Why It Matters'],
    ['WHO SHOULD READ IT','Who Should Read It'],
    ['HOW TO READ IT',   'How To Read It'],
  ];

  return (
    <div className="mt-2 border border-stone-200 bg-stone-50">
      <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200 bg-white">
        <div>
          <p className="text-xs font-mono text-stone-400 mb-0.5">Synopsis</p>
          <p className="text-sm font-semibold text-stone-900 leading-snug">{work.title}</p>
          {work.author && <p className="text-xs text-stone-500">{work.author}{work.year ? ` · ${work.year}` : ''}</p>}
        </div>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
          </svg>
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {(status === 'loading') && (
          <div className="flex items-center gap-2.5 text-stone-400 py-4">
            <span className="flex gap-0.5">
              <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
            </span>
            <span className="text-sm">Generating synopsis in plain language...</span>
          </div>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600">{text}</p>
        )}
        {(status === 'streaming' || status === 'done') && parsed && (
          SECTION_LABELS.map(([key, label]) => parsed[key] ? (
            <div key={key}>
              <p className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-sm text-stone-800 leading-relaxed">{parsed[key]}</p>
            </div>
          ) : null)
        )}
        {(status === 'streaming' || status === 'done') && !parsed && (
          <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{text}</p>
        )}
      </div>
    </div>
  );
}

function scholarUrl(title, author) {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(`${title} ${author}`.trim())}`;
}

function SectionHeader({ label, color = 'bg-emerald-500' }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className={`w-1 h-5 shrink-0 ${color}`} />
      <h3 className="text-xs font-bold text-stone-800 uppercase tracking-widest">{label}</h3>
      <div className="flex-1 h-px bg-stone-200" />
    </div>
  );
}

const SCHOOL_COLORS = [
  { bg: 'bg-stone-50',   border: 'border-stone-200',   badge: 'bg-stone-200 text-stone-700',     accent: 'text-stone-500'   },
  { bg: 'bg-sky-50',     border: 'border-sky-200',     badge: 'bg-sky-100 text-sky-700',         accent: 'text-sky-600'     },
  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-700',   accent: 'text-indigo-600'  },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-700',   accent: 'text-violet-600'  },
  { bg: 'bg-teal-50',    border: 'border-teal-200',    badge: 'bg-teal-100 text-teal-700',       accent: 'text-teal-600'    },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700',     accent: 'text-amber-600'   },
  { bg: 'bg-rose-50',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700',       accent: 'text-rose-600'    },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', accent: 'text-emerald-600' },
];

const AXIOM_COLORS = [
  'border-l-stone-400', 'border-l-sky-400', 'border-l-indigo-400', 'border-l-violet-400',
  'border-l-teal-400',  'border-l-amber-400', 'border-l-rose-400', 'border-l-emerald-400',
];

const LEVEL_STYLES = {
  'Introductory':      { border: 'border-stone-300',   badge: 'bg-stone-100 text-stone-600',     dot: 'bg-stone-400'   },
  'Intermediate':      { border: 'border-sky-300',     badge: 'bg-sky-100 text-sky-700',         dot: 'bg-sky-500'     },
  'Advanced':          { border: 'border-indigo-300',  badge: 'bg-indigo-100 text-indigo-700',   dot: 'bg-indigo-500'  },
  'Research Frontier': { border: 'border-violet-300',  badge: 'bg-violet-100 text-violet-700',   dot: 'bg-violet-500'  },
};

function defaultLevelStyle() {
  return { border: 'border-stone-200', badge: 'bg-stone-100 text-stone-600', dot: 'bg-stone-400' };
}

function getLevelStyle(name = '') {
  for (const [key, val] of Object.entries(LEVEL_STYLES)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return defaultLevelStyle();
}

function LoadingDots({ message }) {
  return (
    <div className="mt-10 flex items-center gap-2.5 text-stone-400">
      <span className="flex gap-0.5">
        <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
      </span>
      <span className="text-sm">{message}</span>
    </div>
  );
}

function GeneratePrompt({ message, onGenerate }) {
  return (
    <div className="mt-10 text-center py-12 border border-dashed border-stone-200">
      <p className="text-sm text-stone-500 mb-4">{message}</p>
      <button
        onClick={onGenerate}
        className="px-5 py-2.5 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
      >
        Generate
      </button>
    </div>
  );
}

// ── Landscape ─────────────────────────────────────────────────────────────────

function LandscapeView({ parsed, isStreaming }) {
  if (!parsed || (!parsed.topic && parsed.schools.length === 0)) {
    return <LoadingDots message="Mapping intellectual landscape..." />;
  }

  return (
    <div className={`mt-8 ${isStreaming ? 'opacity-90' : ''}`}>
      {parsed.topic && (
        <div className="mb-8">
          <p className="text-xs font-mono text-stone-400 mb-1">Landscape</p>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight leading-snug">{parsed.topic}</h2>
          {parsed.overview && (
            <p className="mt-2 text-sm text-stone-600 leading-relaxed max-w-2xl">{parsed.overview}</p>
          )}
          <div className="mt-4 h-px bg-stone-200" />
        </div>
      )}

      {parsed.schools.length > 0 && (
        <div className="mb-8">
          <SectionHeader label="Schools of Thought" />
          <div className="space-y-4">
            {parsed.schools.map((school, i) => {
              const c = SCHOOL_COLORS[i % SCHOOL_COLORS.length];
              return (
                <div key={i} className={`border ${c.border} ${c.bg}`}>
                  <div className="px-6 pt-5 pb-4 border-b border-inherit">
                    <span className={`inline-block text-xs font-mono px-1.5 py-0.5 mb-2 ${c.badge}`}>{school.name}</span>
                    {school.stance && <p className="text-sm font-medium text-stone-900 leading-snug">{school.stance}</p>}
                    {school.origin && <p className="mt-1 text-xs text-stone-500 italic">{school.origin}</p>}
                  </div>
                  <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-5">
                    {school.figures.length > 0 && (
                      <div>
                        <p className={`text-xs font-mono mb-2 ${c.accent}`}>Key Figures</p>
                        <ul className="space-y-1">
                          {school.figures.map((f, j) => <li key={j} className="text-xs text-stone-700 leading-relaxed">— {f}</li>)}
                        </ul>
                      </div>
                    )}
                    {school.concepts.length > 0 && (
                      <div>
                        <p className={`text-xs font-mono mb-2 ${c.accent}`}>Key Concepts</p>
                        <ul className="space-y-1">
                          {school.concepts.map((c2, j) => <li key={j} className="text-xs text-stone-700 leading-relaxed">— {c2}</li>)}
                        </ul>
                      </div>
                    )}
                    {school.works.length > 0 && (
                      <div>
                        <p className={`text-xs font-mono mb-2 ${c.accent}`}>Essential Works</p>
                        <ul className="space-y-1">
                          {school.works.map((w, j) => <li key={j} className="text-xs text-stone-700 leading-relaxed">— {w}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                  {school.legacy && (
                    <div className="px-6 pb-4">
                      <p className={`text-xs font-mono mb-1 ${c.accent}`}>Legacy</p>
                      <p className="text-xs text-stone-600 leading-relaxed italic">{school.legacy}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {parsed.exchanges.length > 0 && (
        <div className="mb-8">
          <SectionHeader label="Key Exchanges" color="bg-sky-500" />
          <div className="space-y-4">
            {parsed.exchanges.map((ex, i) => (
              <div key={i} className="border border-stone-200">
                <div className="px-6 py-4 bg-stone-900">
                  <p className="text-xs font-mono text-stone-300 mb-0.5">Exchange</p>
                  <p className="text-sm font-semibold text-white">{ex.schools}</p>
                  {ex.dispute && <p className="mt-1.5 text-xs text-stone-400 leading-relaxed">{ex.dispute}</p>}
                </div>
                <div className="divide-y divide-stone-100">
                  {ex.keyMoment && (
                    <div className="px-6 py-3 flex gap-3">
                      <span className="text-xs font-mono text-stone-400 shrink-0 w-24 pt-0.5">Key Moment</span>
                      <p className="text-xs text-stone-600 leading-relaxed italic flex-1">{ex.keyMoment}</p>
                    </div>
                  )}
                  {ex.bestCaseA && (
                    <div className="px-6 py-3 flex gap-3">
                      <span className="text-xs font-mono text-sky-500 shrink-0 w-24 pt-0.5">Best Case A</span>
                      <p className="text-sm text-stone-700 leading-relaxed flex-1">{ex.bestCaseA}</p>
                    </div>
                  )}
                  {ex.bestCaseB && (
                    <div className="px-6 py-3 flex gap-3">
                      <span className="text-xs font-mono text-violet-500 shrink-0 w-24 pt-0.5">Best Case B</span>
                      <p className="text-sm text-stone-700 leading-relaxed flex-1">{ex.bestCaseB}</p>
                    </div>
                  )}
                  {ex.status && (
                    <div className="px-6 py-3 flex gap-3">
                      <span className="text-xs font-mono text-stone-400 shrink-0 w-24 pt-0.5">Status</span>
                      <p className="text-xs text-stone-500 leading-relaxed flex-1">{ex.status}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {parsed.argument.centralClaim && (
        <div className="border border-stone-200 divide-y divide-stone-200">
          <div className="px-6 py-5 bg-stone-900">
            <p className="text-xs font-mono text-stone-400 mb-1.5">Central Argument</p>
            <p className="text-sm font-semibold text-white leading-snug">{parsed.argument.centralClaim}</p>
          </div>
          {parsed.argument.for && (
            <div className="px-6 py-4 flex gap-3">
              <span className="text-xs font-mono text-emerald-600 shrink-0 w-16 pt-0.5">For</span>
              <p className="text-sm text-stone-700 leading-relaxed flex-1">{parsed.argument.for}</p>
            </div>
          )}
          {parsed.argument.against && (
            <div className="px-6 py-4 flex gap-3">
              <span className="text-xs font-mono text-rose-500 shrink-0 w-16 pt-0.5">Against</span>
              <p className="text-sm text-stone-700 leading-relaxed flex-1">{parsed.argument.against}</p>
            </div>
          )}
          {parsed.argument.meta && (
            <div className="px-6 py-4 flex gap-3">
              <span className="text-xs font-mono text-stone-400 shrink-0 w-16 pt-0.5">Meta</span>
              <p className="text-sm text-stone-600 leading-relaxed flex-1 italic">{parsed.argument.meta}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Audit ─────────────────────────────────────────────────────────────────────

function AuditView({ parsed, isStreaming }) {
  const hasContent = parsed && (
    parsed.foundingProblem || parsed.birth || parsed.founders.length > 0 ||
    parsed.roadsNotTaken || parsed.axioms.length > 0 || parsed.paradigm.name
  );
  if (!hasContent) {
    return <LoadingDots message="Auditing field assumptions and paradigm..." />;
  }

  const statusColor = (s = '') => {
    const sl = s.toLowerCase();
    if (sl.includes('stable'))   return 'text-emerald-600';
    if (sl.includes('stressed')) return 'text-amber-600';
    if (sl.includes('crumbling'))return 'text-rose-600';
    if (sl.includes('shifting')) return 'text-sky-600';
    return 'text-stone-500';
  };

  return (
    <div className={`mt-8 ${isStreaming ? 'opacity-90' : ''}`}>
      {parsed.field && (
        <div className="mb-8">
          <p className="text-xs font-mono text-stone-400 mb-1">Audit</p>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight">{parsed.field}</h2>
          <div className="mt-4 h-px bg-stone-200" />
        </div>
      )}

      {(parsed.foundingProblem || parsed.birth || parsed.founders.length > 0 || parsed.roadsNotTaken || parsed.excluded) && (
        <div className="mb-8">
          <SectionHeader label="Origin Story" color="bg-amber-500" />
          <div className="border border-stone-200 divide-y divide-stone-100">
            {parsed.foundingProblem && (
              <div className="px-6 py-4 flex gap-3">
                <span className="text-xs font-mono text-stone-400 shrink-0 w-32 pt-0.5">Founded To</span>
                <p className="text-sm text-stone-800 leading-relaxed flex-1 font-medium">{parsed.foundingProblem}</p>
              </div>
            )}
            {parsed.birth && (
              <div className="px-6 py-4 flex gap-3">
                <span className="text-xs font-mono text-stone-400 shrink-0 w-32 pt-0.5">Birth</span>
                <p className="text-sm text-stone-700 leading-relaxed flex-1">{parsed.birth}</p>
              </div>
            )}
            {parsed.founders.length > 0 && (
              <div className="px-6 py-4 flex gap-3">
                <span className="text-xs font-mono text-stone-400 shrink-0 w-32 pt-0.5">Founders</span>
                <ul className="flex-1 space-y-1">
                  {parsed.founders.map((f, i) => <li key={i} className="text-sm text-stone-700 leading-relaxed">— {f}</li>)}
                </ul>
              </div>
            )}
            {parsed.roadsNotTaken && (
              <div className="px-6 py-4 flex gap-3">
                <span className="text-xs font-mono text-stone-400 shrink-0 w-32 pt-0.5">Roads Not Taken</span>
                <p className="text-sm text-stone-600 leading-relaxed flex-1 italic">{parsed.roadsNotTaken}</p>
              </div>
            )}
            {parsed.excluded && (
              <div className="px-6 py-4 flex gap-3">
                <span className="text-xs font-mono text-rose-400 shrink-0 w-32 pt-0.5">What Was Excluded</span>
                <p className="text-sm text-stone-700 leading-relaxed flex-1">{parsed.excluded}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {parsed.axioms.length > 0 && (
        <div className="mb-8">
          <SectionHeader label="Hidden Assumptions" color="bg-rose-500" />
          <div className="space-y-3">
            {parsed.axioms.map((ax, i) => (
              <div key={i} className={`border-l-4 ${AXIOM_COLORS[i % AXIOM_COLORS.length]} border border-stone-100 pl-5 pr-6 py-4`}>
                <p className="text-xs font-mono text-stone-500 mb-1">Axiom</p>
                <p className="text-sm font-semibold text-stone-900 mb-3">{ax.name}</p>
                <div className="space-y-2">
                  {ax.invisible && (
                    <div className="flex gap-3">
                      <span className="text-xs font-mono text-stone-400 shrink-0 w-20 pt-0.5">Invisible</span>
                      <p className="text-sm text-stone-600 leading-relaxed flex-1">{ax.invisible}</p>
                    </div>
                  )}
                  {ax.consequence && (
                    <div className="flex gap-3">
                      <span className="text-xs font-mono text-rose-400 shrink-0 w-20 pt-0.5">Blind Spot</span>
                      <p className="text-sm text-stone-700 leading-relaxed flex-1">{ax.consequence}</p>
                    </div>
                  )}
                  {ax.alternative && (
                    <div className="flex gap-3">
                      <span className="text-xs font-mono text-sky-500 shrink-0 w-20 pt-0.5">Alternative</span>
                      <p className="text-sm text-stone-600 leading-relaxed flex-1 italic">{ax.alternative}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {parsed.paradigm.name && (
        <div>
          <SectionHeader label="Current Paradigm" color="bg-violet-500" />
          <div className="border border-stone-200">
            <div className="px-6 py-5 bg-stone-900">
              <p className="text-xs font-mono text-stone-400 mb-1">Paradigm</p>
              <p className="text-sm font-semibold text-white">{parsed.paradigm.name}</p>
              {parsed.paradigm.status && (
                <p className={`mt-1.5 text-xs font-mono ${statusColor(parsed.paradigm.status)}`}>
                  {parsed.paradigm.status}
                </p>
              )}
            </div>
            <div className="divide-y divide-stone-100">
              {parsed.paradigm.coreCommitments && (
                <div className="px-6 py-4 flex gap-3">
                  <span className="text-xs font-mono text-stone-400 shrink-0 w-28 pt-0.5">Core Commitments</span>
                  <p className="text-sm text-stone-700 leading-relaxed flex-1">{parsed.paradigm.coreCommitments}</p>
                </div>
              )}
              {parsed.paradigm.anomalies.length > 0 && (
                <div className="px-6 py-4 flex gap-3">
                  <span className="text-xs font-mono text-amber-500 shrink-0 w-28 pt-0.5">Anomalies</span>
                  <ul className="flex-1 space-y-1">
                    {parsed.paradigm.anomalies.map((a, i) => <li key={i} className="text-sm text-stone-700 leading-relaxed">— {a}</li>)}
                  </ul>
                </div>
              )}
              {parsed.paradigm.challengers && (
                <div className="px-6 py-4 flex gap-3">
                  <span className="text-xs font-mono text-stone-400 shrink-0 w-28 pt-0.5">Challengers</span>
                  <p className="text-sm text-stone-700 leading-relaxed flex-1">{parsed.paradigm.challengers}</p>
                </div>
              )}
              {parsed.paradigm.next && (
                <div className="px-6 py-4 flex gap-3">
                  <span className="text-xs font-mono text-stone-400 shrink-0 w-28 pt-0.5">What's Next</span>
                  <p className="text-sm text-stone-600 leading-relaxed flex-1 italic">{parsed.paradigm.next}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bibliography ──────────────────────────────────────────────────────────────

const TYPE_COLORS = {
  'Textbook':        'bg-sky-100 text-sky-700',
  'Monograph':       'bg-indigo-100 text-indigo-700',
  'Paper':           'bg-teal-100 text-teal-700',
  'Review':          'bg-emerald-100 text-emerald-700',
  'Essay Collection':'bg-amber-100 text-amber-700',
  'Classic':         'bg-rose-100 text-rose-700',
};

function typeColor(t = '') {
  for (const [key, val] of Object.entries(TYPE_COLORS)) {
    if (t.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return 'bg-stone-100 text-stone-600';
}

function ReadingOrderView({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-5 shrink-0 bg-stone-800" />
        <h3 className="text-xs font-bold text-stone-800 uppercase tracking-widest">Precise Reading Order</h3>
        <div className="flex-1 h-px bg-stone-200" />
        <span className="text-xs font-mono text-stone-400">{items.length} works</span>
      </div>
      <div className="space-y-0 border border-stone-200">
        {items.map((item, i) => (
          <div key={i} className={`flex gap-4 px-5 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-stone-50'} border-b border-stone-100 last:border-0`}>
            <span className="text-xs font-mono text-stone-400 shrink-0 w-6 pt-0.5 text-right">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-900 leading-snug">{item.title}</p>
              {item.reason && (
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{item.reason}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BibView({ parsed, isStreaming }) {
  const [expandedWork, setExpandedWork] = useState(null);

  if (!parsed || (parsed.levels.length === 0 && !parsed.scope)) {
    return <LoadingDots message="Building exhaustive annotated bibliography..." />;
  }

  return (
    <div className={`mt-8 ${isStreaming ? 'opacity-90' : ''}`}>
      {parsed.field && (
        <div className="mb-8">
          <p className="text-xs font-mono text-stone-400 mb-1">Annotated Bibliography</p>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight">{parsed.field}</h2>
          {parsed.scope && (
            <p className="mt-2 text-sm text-stone-500 leading-relaxed max-w-2xl">{parsed.scope}</p>
          )}
          <div className="mt-4 h-px bg-stone-200" />
        </div>
      )}

      <div className="space-y-10">
        {parsed.levels.map((level, li) => {
          const s = getLevelStyle(level.name);

          // Group works by subgroup for Research Frontier split rendering
          const groups = [];
          let lastSubgroup = undefined;
          for (const work of level.works) {
            const sg = work.subgroup || null;
            if (groups.length === 0 || sg !== lastSubgroup) {
              groups.push({ subgroup: sg, works: [] });
              lastSubgroup = sg;
            }
            groups[groups.length - 1].works.push(work);
          }

          return (
            <div key={li}>
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-1 h-6 shrink-0 ${s.dot}`} />
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-widest">{level.name}</h3>
                {level.for && (
                  <span className={`text-xs px-2 py-0.5 font-mono ${s.badge}`}>{level.for}</span>
                )}
                <div className="flex-1 h-px bg-stone-200" />
                <span className="text-xs font-mono text-stone-400">{level.works.length} works</span>
              </div>

              <div className="space-y-8">
                {groups.map((group, gi) => (
                  <div key={gi}>
                    {group.subgroup && (
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-[11px] font-bold font-mono text-stone-500 uppercase tracking-widest">{group.subgroup}</span>
                        <div className="flex-1 h-px bg-stone-100" />
                      </div>
                    )}
                    <div className="space-y-3">
                      {group.works.map((work, wi) => {
                        const workKey = `${li}-${gi}-${wi}`;
                        const isExpanded = expandedWork === workKey;
                        return (
                          <div key={wi} className={`border ${s.border} bg-white`}>
                            <div
                              className="px-6 py-4 cursor-pointer hover:bg-stone-50 transition-colors"
                              onClick={() => setExpandedWork(isExpanded ? null : workKey)}
                            >
                              <div className="flex flex-wrap items-start gap-2 mb-1">
                                <p className="text-sm font-semibold text-stone-900 leading-snug flex-1">{work.title}</p>
                                {work.type && (
                                  <span className={`text-[10px] font-mono px-1.5 py-0.5 shrink-0 ${typeColor(work.type)}`}>
                                    {work.type}
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-stone-400 shrink-0 mt-0.5">
                                  {isExpanded ? '▲ synopsis' : '▼ synopsis'}
                                </span>
                              </div>
                              {(work.author || work.year) && (
                                <div className="flex items-center gap-3 mb-2">
                                  <p className="text-xs text-stone-500">
                                    {work.author}{work.author && work.year ? ' · ' : ''}{work.year}
                                  </p>
                                  <a
                                    href={scholarUrl(work.title, work.author)}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-[10px] font-mono text-emerald-600 hover:text-emerald-800 hover:underline shrink-0"
                                  >
                                    Google Scholar ↗
                                  </a>
                                </div>
                              )}
                              {work.prereqs && !work.prereqs.toLowerCase().startsWith('none') && (
                                <div className="flex items-start gap-2 mb-2">
                                  <span className="text-[10px] font-mono shrink-0 mt-0.5 text-stone-400">Prereqs</span>
                                  <span className="text-[11px] leading-relaxed text-amber-700">{work.prereqs}</span>
                                </div>
                              )}
                              {work.annotation && (
                                <p className="text-sm text-stone-600 leading-relaxed">{work.annotation}</p>
                              )}
                            </div>
                            {isExpanded && (
                              <SynopsisPanel
                                work={work}
                                onClose={() => setExpandedWork(null)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {parsed.readingOrder && parsed.readingOrder.length > 0 && (
        <ReadingOrderView items={parsed.readingOrder} />
      )}
    </div>
  );
}

// ── Thinkers ──────────────────────────────────────────────────────────────────

function ThinkersView({ parsed, isStreaming }) {
  if (!parsed || parsed.thinkers.length === 0) {
    return <LoadingDots message="Profiling key thinkers and intellectual biographies..." />;
  }

  return (
    <div className={`mt-8 ${isStreaming ? 'opacity-90' : ''}`}>
      {parsed.field && (
        <div className="mb-8">
          <p className="text-xs font-mono text-stone-400 mb-1">Thinkers</p>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight">{parsed.field}</h2>
          <div className="mt-4 h-px bg-stone-200" />
        </div>
      )}
      <div className="space-y-6">
        {parsed.thinkers.map((thinker, i) => {
          const c = SCHOOL_COLORS[i % SCHOOL_COLORS.length];
          return (
            <div key={i} className={`border ${c.border} bg-white`}>
              <div className="px-6 py-5 bg-stone-900">
                <p className="text-xs font-mono text-stone-400 mb-0.5">Thinker</p>
                <h3 className="text-base font-bold text-white">{thinker.name}</h3>
                {thinker.born && <p className="text-xs text-stone-400 mt-0.5">{thinker.born}</p>}
              </div>
              <div className="divide-y divide-stone-100">
                {thinker.formation && (
                  <div className="px-6 py-4 flex gap-3">
                    <span className="text-xs font-mono text-stone-400 shrink-0 w-28 pt-0.5">Formation</span>
                    <p className="text-sm text-stone-700 leading-relaxed flex-1">{thinker.formation}</p>
                  </div>
                )}
                {thinker.contribution && (
                  <div className="px-6 py-4 flex gap-3">
                    <span className={`text-xs font-mono ${c.accent} shrink-0 w-28 pt-0.5`}>Contribution</span>
                    <p className="text-sm text-stone-800 leading-relaxed flex-1 font-medium">{thinker.contribution}</p>
                  </div>
                )}
                {thinker.keyWorks.length > 0 && (
                  <div className="px-6 py-4 flex gap-3">
                    <span className="text-xs font-mono text-stone-400 shrink-0 w-28 pt-0.5">Key Works</span>
                    <ul className="flex-1 space-y-1.5">
                      {thinker.keyWorks.map((w, j) => (
                        <li key={j} className="text-sm text-stone-600 leading-relaxed">— {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {thinker.centralDebate && (
                  <div className="px-6 py-4 flex gap-3">
                    <span className="text-xs font-mono text-amber-500 shrink-0 w-28 pt-0.5">Central Debate</span>
                    <p className="text-sm text-stone-700 leading-relaxed flex-1">{thinker.centralDebate}</p>
                  </div>
                )}
                {thinker.influence && (
                  <div className="px-6 py-4 flex gap-3">
                    <span className="text-xs font-mono text-emerald-600 shrink-0 w-28 pt-0.5">Influence</span>
                    <p className="text-sm text-stone-700 leading-relaxed flex-1">{thinker.influence}</p>
                  </div>
                )}
                {thinker.criticism && (
                  <div className="px-6 py-4 flex gap-3">
                    <span className="text-xs font-mono text-rose-400 shrink-0 w-28 pt-0.5">Criticism</span>
                    <p className="text-sm text-stone-600 leading-relaxed flex-1 italic">{thinker.criticism}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function FieldIntelligenceView({
  landscapePhase, auditPhase, bibPhase, thinkersPhase,
  parsedLandscape, parsedAudit, parsedBib, parsedThinkers,
  dataCount, currentTopic,
  onGenerateLandscape, onGenerateAudit, onGenerateBib, onGenerateThinkers, onReset,
  landscapeContent, auditContent, bibContent, thinkersContent,
}) {
  const [view, setView] = useState('landscape');

  return (
    <div className="mt-10">
      {/* View tabs */}
      <div className="flex border-b border-stone-200 mb-2">
        {[
          { id: 'landscape',    label: 'Landscape',    phase: landscapePhase },
          { id: 'audit',        label: 'Audit',        phase: auditPhase     },
          { id: 'bibliography', label: 'Bibliography', phase: bibPhase       },
          { id: 'thinkers',     label: 'Thinkers',     phase: thinkersPhase  },
        ].map(({ id, label, phase }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`px-4 py-2.5 text-xs font-mono -mb-px transition-colors flex items-center gap-1.5 ${
              view === id
                ? 'border-b-2 border-emerald-600 text-emerald-700'
                : 'border-b-2 border-transparent text-stone-400 hover:text-stone-700'
            }`}
          >
            {label}
            {phase === 'generating' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
            {phase === 'complete'   && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />}
          </button>
        ))}
      </div>

      {dataCount > 0 && (
        <p className="text-xs font-mono text-stone-400 mb-2">
          {dataCount} works harvested · {currentTopic}
        </p>
      )}

      {currentTopic && (
        <div className="mb-6">
          <LeadingResearchersPanel topic={currentTopic} />
        </div>
      )}

      {/* Only the active tab renders — no hidden panels that can silently error */}
      {view === 'landscape' && (
        landscapePhase === 'harvesting'
          ? <LoadingDots message="Querying Open Syllabus + Semantic Scholar..." />
          : landscapePhase === 'ready' || landscapePhase === 'idle'
          ? <GeneratePrompt message="Map all schools of thought, key debates, and the central argument structure of this field." onGenerate={onGenerateLandscape} />
          : <LandscapeView parsed={parsedLandscape} isStreaming={landscapePhase === 'generating'} />
      )}

      {view === 'audit' && (
        landscapePhase === 'harvesting'
          ? <LoadingDots message="Querying Open Syllabus + Semantic Scholar..." />
          : auditPhase === 'idle'
          ? <GeneratePrompt message="Audit this field's origin story, hidden assumptions, and current paradigm status." onGenerate={onGenerateAudit} />
          : <AuditView parsed={parsedAudit} isStreaming={auditPhase === 'generating'} />
      )}

      {view === 'bibliography' && (
        landscapePhase === 'harvesting'
          ? <LoadingDots message="Querying Open Syllabus + Semantic Scholar..." />
          : bibPhase === 'idle'
          ? <GeneratePrompt message="Build an exhaustive annotated bibliography across all levels — from first encounter to research frontier." onGenerate={onGenerateBib} />
          : <BibView parsed={parsedBib} isStreaming={bibPhase === 'generating'} />
      )}

      {view === 'thinkers' && (
        landscapePhase === 'harvesting'
          ? <LoadingDots message="Querying Open Syllabus + Semantic Scholar..." />
          : thinkersPhase === 'idle'
          ? <GeneratePrompt message="Profile every major thinker — their intellectual formation, core contribution, key works, central debates, and lasting influence." onGenerate={onGenerateThinkers} />
          : <ThinkersView parsed={parsedThinkers} isStreaming={thinkersPhase === 'generating'} />
      )}

      {/* Footer actions */}
      {(landscapePhase === 'complete' || auditPhase === 'complete' || bibPhase === 'complete' || thinkersPhase === 'complete') && (
        <div className="mt-8 pt-6 border-t border-stone-200 flex gap-2">
          {view === 'landscape' && landscapePhase === 'complete' && (
            <button onClick={() => navigator.clipboard.writeText(landscapeContent)}
              className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors">
              Copy Landscape
            </button>
          )}
          {view === 'audit' && auditPhase === 'complete' && (
            <button onClick={() => navigator.clipboard.writeText(auditContent)}
              className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors">
              Copy Audit
            </button>
          )}
          {view === 'bibliography' && bibPhase === 'complete' && (
            <button onClick={() => navigator.clipboard.writeText(bibContent)}
              className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors">
              Copy Bibliography
            </button>
          )}
          {view === 'thinkers' && thinkersPhase === 'complete' && (
            <button onClick={() => navigator.clipboard.writeText(thinkersContent)}
              className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors">
              Copy Thinkers
            </button>
          )}
          <button onClick={onReset}
            className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors">
            New Field
          </button>
        </div>
      )}
    </div>
  );
}
