import { useState, useCallback } from 'react';

const MODES = [
  { key: 'canon',        label: 'Canon' },
  { key: 'curriculum',   label: 'Curriculum' },
  { key: 'dissertation', label: 'Dissertation' },
  { key: 'drift',        label: 'Drift' },
  { key: 'consilience',  label: 'Consilience' },
  { key: 'inquiry',      label: 'Inquiry' },
  { key: 'reverse',      label: 'Prerequisites' },
];

// Predefined domains — English label + known Wikidata Q-ID (skips search step)
const DOMAINS = [
  { en: 'Philosophy',          qid: 'Q5891'   },
  { en: 'Mathematics',         qid: 'Q395'    },
  { en: 'Physics',             qid: 'Q413'    },
  { en: 'Chemistry',           qid: 'Q2329'   },
  { en: 'Biology',             qid: 'Q420'    },
  { en: 'Computer Science',    qid: 'Q21198'  },
  { en: 'Linguistics',         qid: 'Q8162'   },
  { en: 'Economics',           qid: 'Q8134'   },
  { en: 'Law',                 qid: 'Q7748'   },
  { en: 'History',             qid: 'Q309'    },
  { en: 'Geography',           qid: 'Q1071'   },
  { en: 'Psychology',          qid: 'Q9418'   },
  { en: 'Sociology',           qid: 'Q21201'  },
  { en: 'Medicine',            qid: 'Q11190'  },
  { en: 'Arts',                qid: 'Q735'    },
  { en: 'Music',               qid: 'Q638'    },
  { en: 'Literature',          qid: 'Q8242'   },
  { en: 'Theology',            qid: 'Q34178'  },
  { en: 'Political Science',   qid: 'Q36442'  },
  { en: 'Engineering',         qid: 'Q11023'  },
  { en: 'Architecture',        qid: 'Q12271'  },
  { en: 'Education',           qid: 'Q8434'   },
  { en: 'Anthropology',        qid: 'Q23404'  },
  { en: 'Astronomy',           qid: 'Q333'    },
  { en: 'Environmental Science', qid: 'Q2027596' },
];

// ── Wikidata helpers ──────────────────────────────────────────────────────────

// English query → Wikidata Q-ID (top hit)
async function wdSearch(query) {
  const res = await fetch(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*&limit=5&type=item`
  );
  if (!res.ok) throw new Error(`Wikidata search: HTTP ${res.status}`);
  const json = await res.json();
  const hit = json.search?.[0];
  if (!hit) throw new Error(`"${query}" not found on Wikidata`);
  return hit.id; // Q-ID
}

// Q-ID → { gndId, enLabel, deLabel }
async function wdGetInfo(qid) {
  const res = await fetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims|labels&languages=en|de&format=json&origin=*`
  );
  if (!res.ok) throw new Error(`Wikidata entity: HTTP ${res.status}`);
  const json  = await res.json();
  const entity = json.entities?.[qid];
  const gndId  = entity?.claims?.P227?.[0]?.mainsnak?.datavalue?.value || null;
  return {
    gndId,
    enLabel: entity?.labels?.en?.value || '',
    deLabel: entity?.labels?.de?.value || '',
  };
}

// GND IDs (suffixes like "4038936-4") → { "https://d-nb.info/gnd/4038936-4": "English label" }
// Uses Wikidata SPARQL — one request regardless of how many IDs
async function sparqlEnglish(gndIds) {
  if (!gndIds.length) return {};
  const vals = gndIds.slice(0, 40).map(id => `"${id}"`).join(' ');
  const query = `SELECT ?g ?label WHERE {
    VALUES ?g { ${vals} }
    ?item wdt:P227 ?g.
    ?item rdfs:label ?label.
    FILTER(LANG(?label)="en")
  }`;
  const res = await fetch(
    `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`,
    { headers: { Accept: 'application/sparql-results+json' } }
  );
  if (!res.ok) throw new Error(`SPARQL: HTTP ${res.status}`);
  const json = await res.json();
  const out  = {};
  for (const b of json.results?.bindings || []) {
    out['https://d-nb.info/gnd/' + b.g.value] = b.label.value;
  }
  return out; // full-URI key → english label
}

// ── GND record fetch ──────────────────────────────────────────────────────────

function gndSuffix(uri) {
  return (uri || '').replace('https://d-nb.info/gnd/', '');
}

async function fetchGNDRecord(id) {
  const res = await fetch(`https://lobid.org/gnd/${id}?format=json`);
  if (!res.ok) throw new Error(`GND record: HTTP ${res.status}`);
  return res.json();
}

// ── Full resolve pipeline ─────────────────────────────────────────────────────
// Returns { enLabel, deLabel, qid, gndId, gndRecord, termEn }

async function resolveConcept({ qid, gndId: knownGndId, enLabel: knownEn }) {
  let gndId  = knownGndId;
  let enLabel = knownEn || '';
  let deLabel = '';
  let resolvedQid = qid;

  // If we have a Q-ID but no GND ID, fetch from Wikidata
  if (qid && !gndId) {
    const info = await wdGetInfo(qid);
    gndId   = info.gndId;
    enLabel = knownEn || info.enLabel;
    deLabel = info.deLabel;
  }

  if (!gndId) throw new Error('No GND identifier found — concept may not be in GND');

  // Fetch the actual GND record
  const gndRecord = await fetchGNDRecord(gndId);
  deLabel = deLabel || gndRecord.preferredName;

  // If no Wikidata label yet, try sameAs in the GND record
  if (!enLabel) {
    const wd = (gndRecord.sameAs || []).find(s => /wikidata\.org\/entity\/Q/.test(s.id || ''));
    if (wd) {
      resolvedQid = wd.id.match(/Q\d+/)?.[0];
      if (resolvedQid) {
        const info = await wdGetInfo(resolvedQid).catch(() => ({}));
        enLabel = info.enLabel || '';
      }
    }
  }
  enLabel = enLabel || deLabel;

  // Collect all term IDs to translate via SPARQL
  const narrower = [...(gndRecord.narrowerTermInstantial || []), ...(gndRecord.narrowerTermGeneral || [])];
  const related  = gndRecord.relatedTerm || [];
  const broader  = [...(gndRecord.broaderTermInstantial || []), ...(gndRecord.broaderTermGeneral || [])];
  const allTerms = [...narrower, ...related, ...broader];
  const suffixes = allTerms.map(t => gndSuffix(t.id)).filter(Boolean);

  const termEn = await sparqlEnglish(suffixes).catch(() => ({}));

  return { enLabel, deLabel, qid: resolvedQid, gndId, gndRecord, termEn };
}

// ── UI components ─────────────────────────────────────────────────────────────

function Dots() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

function modeLabel(key) {
  return MODES.find(m => m.key === key)?.label || 'Canon';
}

function TermRow({ term, enLabel, onDrill, onGenerate, mode }) {
  const display = enLabel || term.label;
  const hasEn   = !!enLabel && enLabel !== term.label;

  return (
    <div className="flex items-center gap-2 py-2 border-b border-stone-50 last:border-0 group">
      <div className="flex-1 min-w-0">
        <button
          onClick={() => onDrill(term)}
          className="block w-full text-left text-sm text-stone-800 hover:text-blue-700 font-medium truncate transition-colors"
        >
          {display}
        </button>
        {hasEn && (
          <span className="text-[9px] font-mono text-stone-400">{term.label}</span>
        )}
      </div>
      <div className="shrink-0 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onDrill(term)}
          className="text-[8px] font-mono px-1.5 py-0.5 border border-stone-200 text-stone-400 hover:border-blue-300 hover:text-blue-600 transition-colors">
          expand ▸
        </button>
        <button onClick={() => onGenerate(display, mode)}
          className="text-[8px] font-mono px-1.5 py-0.5 bg-stone-900 text-white hover:bg-stone-700 transition-colors">
          → {modeLabel(mode)}
        </button>
      </div>
    </div>
  );
}

function ConceptPanel({ data, onDrill, onGenerate, mode }) {
  const { enLabel, deLabel, gndId, qid, gndRecord, termEn } = data;

  const broader  = [...(gndRecord.broaderTermInstantial || []), ...(gndRecord.broaderTermGeneral || [])];
  const narrower = [...(gndRecord.narrowerTermInstantial || []), ...(gndRecord.narrowerTermGeneral || [])];
  const related  = gndRecord.relatedTerm || [];
  const cats     = gndRecord.gndSubjectCategory || [];
  const lcsh     = (gndRecord.sameAs || []).find(s => String(s.id || '').includes('id.loc.gov'));
  const wd       = qid ? `https://www.wikidata.org/wiki/${qid}` : null;

  return (
    <div className="space-y-6">
      {/* Concept header */}
      <div className="border border-blue-100 bg-blue-50 px-5 py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-blue-600 text-white shrink-0">GND</span>
              <h3 className="text-2xl font-bold text-stone-900 leading-tight">{enLabel}</h3>
            </div>
            {deLabel !== enLabel && (
              <p className="text-xs font-mono text-stone-500">German (GND): {deLabel}</p>
            )}
            {cats.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {cats.map((c, i) => (
                  <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 bg-blue-100 border border-blue-200 text-blue-700">
                    {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 flex gap-2 text-[9px] font-mono">
            <a href={`https://lobid.org/gnd/${gndId}`} target="_blank" rel="noopener noreferrer"
              className="text-blue-500 hover:underline">GND↗</a>
            {wd && <a href={wd} target="_blank" rel="noopener noreferrer"
              className="text-emerald-600 hover:underline">WD↗</a>}
            {lcsh && <a href={lcsh.id} target="_blank" rel="noopener noreferrer"
              className="text-orange-500 hover:underline">LC↗</a>}
          </div>
        </div>

        {/* Broader context */}
        {broader.length > 0 && (
          <div className="pt-2 border-t border-blue-200">
            <span className="text-[8px] font-mono text-blue-500 uppercase tracking-wider mr-2">Broader:</span>
            {broader.map((t, i) => (
              <span key={i}>
                <button onClick={() => onDrill(t)}
                  className="text-xs font-mono text-blue-700 hover:underline">
                  {termEn[t.id] || t.label}
                </button>
                {i < broader.length - 1 && <span className="text-blue-300 mx-1">·</span>}
              </span>
            ))}
          </div>
        )}

        {/* Generate */}
        <div>
          <button onClick={() => onGenerate(enLabel, mode)}
            className="text-[9px] font-mono font-bold px-3 py-1.5 bg-stone-900 text-white hover:bg-stone-700 transition-colors">
            → {modeLabel(mode)}
          </button>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div>
          <p className="text-[9px] font-mono text-stone-400 uppercase tracking-widest mb-2">
            Related <span className="text-stone-300 normal-case font-normal">({related.length})</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {related.slice(0, 18).map((t, i) => {
              const en = termEn[t.id] || t.label;
              return (
                <button key={i} onClick={() => onDrill(t)}
                  className="text-[10px] font-mono px-2 py-0.5 bg-white border border-stone-200 text-stone-600 hover:border-blue-400 hover:text-blue-700 transition-colors">
                  {en}
                </button>
              );
            })}
            {related.length > 18 && (
              <span className="text-[10px] font-mono text-stone-300 self-center">+{related.length - 18} more</span>
            )}
          </div>
        </div>
      )}

      {/* Narrower */}
      {narrower.length > 0 && (
        <div>
          <p className="text-[9px] font-mono text-stone-400 uppercase tracking-widest mb-2">
            Narrower <span className="text-stone-300 normal-case font-normal">({narrower.length} — click to drill deeper)</span>
          </p>
          <div className="border border-stone-100 bg-white divide-y divide-stone-50 px-3">
            {narrower.map((t, i) => (
              <TermRow
                key={i}
                term={t}
                enLabel={termEn[t.id] || ''}
                onDrill={onDrill}
                onGenerate={onGenerate}
                mode={mode}
              />
            ))}
          </div>
        </div>
      )}

      {narrower.length === 0 && related.length === 0 && (
        <p className="text-xs font-mono text-stone-400">Leaf concept — no narrower terms in GND.</p>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function KeywordsView({ onGenerate }) {
  const [mode,         setMode]        = useState('canon');
  const [input,        setInput]       = useState('');
  const [activeDomain, setActiveDomain]= useState(null);
  const [conceptData,  setConceptData] = useState(null);
  const [path,         setPath]        = useState([]);
  const [loading,      setLoading]     = useState(false);
  const [error,        setError]       = useState(null);

  async function load(params, pathEntry) {
    setLoading(true);
    setError(null);
    try {
      const data = await resolveConcept(params);
      setConceptData(data);
      setPath(p => [...p, { ...pathEntry, gndId: data.gndId, enLabel: data.enLabel }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    const q = input.trim();
    if (!q) return;
    setActiveDomain(null);
    setPath([]);
    setConceptData(null);
    setLoading(true);
    setError(null);
    try {
      const qid  = await wdSearch(q);
      const data = await resolveConcept({ qid, enLabel: q });
      setConceptData(data);
      setPath([{ enLabel: data.enLabel, gndId: data.gndId }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const selectDomain = useCallback(async (d) => {
    setActiveDomain(d.en);
    setInput('');
    setPath([]);
    setConceptData(null);
    setLoading(true);
    setError(null);
    try {
      const data = await resolveConcept({ qid: d.qid, enLabel: d.en });
      setConceptData(data);
      setPath([{ enLabel: data.enLabel, gndId: data.gndId }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const drillInto = useCallback(async (term) => {
    setLoading(true);
    setError(null);
    try {
      const id   = gndSuffix(term.id);
      const data = await resolveConcept({ gndId: id, enLabel: '' });
      setConceptData(data);
      setPath(p => [...p, { enLabel: data.enLabel, gndId: id }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const navigateTo = useCallback(async (idx) => {
    const crumb = path[idx];
    if (!crumb) return;
    setLoading(true);
    setError(null);
    try {
      const data = await resolveConcept({ gndId: crumb.gndId, enLabel: crumb.enLabel });
      setConceptData(data);
      setPath(p => p.slice(0, idx + 1));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">GND Concept Hierarchy</h2>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-blue-600 text-white">GND</span>
        </div>
        <p className="text-sm text-stone-500 max-w-2xl leading-relaxed">
          Search in English — Wikidata translates to German for GND lookup, then all terms are
          translated back to English via Wikidata. No German required.
        </p>
      </div>

      {/* Mode */}
      <div>
        <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest mb-2">Generate as</p>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`px-3 py-1.5 text-xs font-mono border transition-all
                ${mode === m.key
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-800'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search any concept in English — e.g. Metaphysics, Topology, Postcolonialism…"
          className="flex-1 px-3 py-2.5 text-sm border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-blue-400 transition-colors"
        />
        <button onClick={handleSearch} disabled={!input.trim() || loading}
          className="px-5 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-40">
          Search
        </button>
      </div>

      {/* Domain shortcuts */}
      <div>
        <p className="text-[9px] font-mono text-stone-400 uppercase tracking-widest mb-2">
          Or jump to a domain
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DOMAINS.map(d => (
            <button key={d.en} onClick={() => selectDomain(d)} disabled={loading}
              className={`px-3 py-1.5 text-xs font-mono border transition-all disabled:opacity-40
                ${activeDomain === d.en && !input
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-blue-400 hover:text-blue-700'}`}>
              {d.en}
            </button>
          ))}
        </div>
      </div>

      {/* Breadcrumb */}
      {path.length > 0 && (
        <div className="flex items-center flex-wrap gap-x-1 gap-y-1 text-sm font-mono">
          {path.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-stone-300">›</span>}
              <button onClick={() => navigateTo(i)}
                className={`transition-colors ${
                  i === path.length - 1
                    ? 'text-blue-700 font-bold'
                    : 'text-stone-400 hover:text-stone-700'
                }`}>
                {crumb.enLabel}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="border border-blue-100 bg-blue-50 py-12 flex flex-col items-center gap-3">
          <Dots />
          <p className="text-xs font-mono text-blue-400">
            Wikidata → GND → English labels via SPARQL…
          </p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="border border-red-200 bg-red-50 px-5 py-4 space-y-1">
          <p className="text-sm font-mono text-red-700">{error}</p>
          <p className="text-[10px] font-mono text-stone-400">
            Try a more specific term, a synonym, or select a domain above.
          </p>
        </div>
      )}

      {/* Concept panel */}
      {!loading && conceptData && (
        <ConceptPanel
          data={conceptData}
          onDrill={drillInto}
          onGenerate={onGenerate}
          mode={mode}
        />
      )}

      {/* Empty state */}
      {!loading && !conceptData && !error && (
        <div className="border border-stone-100 bg-stone-50 py-16 text-center space-y-1">
          <p className="text-sm font-mono text-stone-400">Type any concept in English and press Search</p>
          <p className="text-[10px] font-mono text-stone-300">
            Or click a domain above — each shows the full GND hierarchy with English labels throughout
          </p>
        </div>
      )}
    </div>
  );
}
