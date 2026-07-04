import ConceptSearch from './ConceptSearch';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
    >
      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
      <path d="M1 8L8 1M8 1H3M8 1V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OALink({ url, className = '' }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className={`shrink-0 opacity-0 group-hover/row:opacity-100 transition-all text-[9px] font-mono font-semibold tracking-wide text-sky-500 hover:text-sky-700 hover:underline px-1 py-0.5 ${className}`}
      title="Open in OpenAlex"
    >
      OA↗
    </a>
  );
}

function FieldNav({
  fieldNames, taxonomyLoading, topicCount,
  activeCanonTopic,
  onClickTopLevel, onClickSubfield, onClickSubSubfield,
  isFieldExpanded, isSubfieldExpanded,
  getSubfields, getSubSubfields,
  getFieldUrl, getSubfieldUrl, getTopicUrl,
  disabled,
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-mono text-stone-400">Fields</p>
        {topicCount > 0 && (
          <span className="text-[10px] font-mono text-stone-400">
            {topicCount.toLocaleString()} topics
          </span>
        )}
      </div>
      {taxonomyLoading && (
        <p className="text-xs text-stone-400 px-2 py-1 animate-pulse">Loading OpenAlex taxonomy…</p>
      )}
      <ul>
        {fieldNames.map(field => {
          const expanded = isFieldExpanded(field);
          const subfields = getSubfields(field);
          const isActive = activeCanonTopic === field;
          const fieldUrl = getFieldUrl(field);

          return (
            <li key={field} className="group/row">
              {/* Level 1 */}
              <div className={`flex items-center transition-colors ${isActive ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'}`}>
                <button
                  onClick={() => onClickTopLevel(field)}
                  disabled={disabled}
                  className="flex-1 text-left px-2 py-1.5 text-sm flex items-center gap-1 disabled:opacity-40 min-w-0"
                >
                  <span className="truncate">{field}</span>
                  <span className={`shrink-0 ${isActive ? 'text-stone-300' : 'text-stone-400'}`}>
                    <ChevronIcon open={expanded} />
                  </span>
                </button>
                <OALink url={fieldUrl} className="mr-1" />
              </div>

              {expanded && (
                <ul className="ml-3 border-l border-stone-200">
                  {subfields.map(sf => {
                    const sfKey = `${field}::${sf}`;
                    const sfExpanded = isSubfieldExpanded(sfKey);
                    const sfActive = activeCanonTopic === sf;
                    const subSubfields = getSubSubfields(field, sf);
                    const sfUrl = getSubfieldUrl(sf);

                    return (
                      <li key={sf} className="group/row">
                        {/* Level 2 */}
                        <div className={`flex items-center transition-colors ${sfActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'}`}>
                          <button
                            onClick={() => onClickSubfield(field, sf)}
                            disabled={disabled}
                            className="flex-1 text-left pl-2 py-1 text-sm flex items-center gap-1 disabled:opacity-40 min-w-0"
                          >
                            <span className="truncate">{sf}</span>
                            {subSubfields.length > 0 && (
                              <span className={`shrink-0 ${sfActive ? 'text-stone-300' : 'text-stone-400'}`}>
                                <ChevronIcon open={sfExpanded} />
                              </span>
                            )}
                          </button>
                          <OALink url={sfUrl} className="mr-1" />
                        </div>

                        {sfExpanded && subSubfields.length > 0 && (
                          <ul className="ml-3 border-l border-stone-100">
                            {subSubfields.map(ssf => {
                              const ssfActive = activeCanonTopic === ssf;
                              const topicUrl = getTopicUrl(sf, ssf);
                              return (
                                <li key={ssf} className="group/row">
                                  {/* Level 3 */}
                                  <div className={`flex items-center transition-colors ${ssfActive ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'}`}>
                                    <button
                                      onClick={() => onClickSubSubfield(ssf)}
                                      disabled={disabled}
                                      className="flex-1 text-left pl-2 py-0.5 text-xs disabled:opacity-40"
                                    >
                                      {ssf}
                                    </button>
                                    <OALink url={topicUrl} className="mr-1" />
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Sidebar({
  history, onLoad, onDelete, onClearAll,
  activeCanonTopic,
  onClickTopLevel, onClickSubfield, onClickSubSubfield,
  isFieldExpanded, isSubfieldExpanded,
  getSubfields, getSubSubfields,
  getFieldUrl, getSubfieldUrl, getTopicUrl,
  fieldNames, taxonomyLoading, topicCount,
  onSelectConcept,
  disabled,
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 pb-3 border-b border-stone-200">
        <h1 className="text-[11px] font-mono font-bold text-stone-800 uppercase tracking-widest mb-1.5">
          Academic Navigator
        </h1>
        <p className="text-[10px] text-stone-500 leading-relaxed">
          {taxonomyLoading
            ? 'Loading live taxonomy from OpenAlex…'
            : `${fieldNames.length} Fields · ${topicCount.toLocaleString()} Topics — live from OpenAlex`}
        </p>
        <p className="text-[10px] text-stone-400 mt-0.5">
          Click any item to generate its canon reading list. OA↗ links open the source.
        </p>
      </div>

      <FieldNav
        fieldNames={fieldNames || []}
        taxonomyLoading={taxonomyLoading}
        topicCount={topicCount}
        activeCanonTopic={activeCanonTopic}
        onClickTopLevel={onClickTopLevel}
        onClickSubfield={onClickSubfield}
        onClickSubSubfield={onClickSubSubfield}
        isFieldExpanded={isFieldExpanded}
        isSubfieldExpanded={isSubfieldExpanded}
        getSubfields={getSubfields}
        getSubSubfields={getSubSubfields}
        getFieldUrl={getFieldUrl || (() => null)}
        getSubfieldUrl={getSubfieldUrl || (() => null)}
        getTopicUrl={getTopicUrl || (() => null)}
        disabled={disabled}
      />

      <div className="border-t border-stone-200 my-4" />

      <ConceptSearch onSelect={onSelectConcept} disabled={disabled} />

      {history.length > 0 && <div className="border-t border-stone-200 mb-4" />}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-mono text-stone-500">
          Saved
          {history.length > 0 && <span className="ml-1.5 text-stone-400">({history.length})</span>}
        </h2>
        {history.length > 0 && (
          <button onClick={onClearAll} className="text-xs text-stone-400 hover:text-stone-700 transition-colors">
            Clear all
          </button>
        )}
      </div>

      {history.length > 0 && (
        <ul className="space-y-0.5 flex-1 overflow-y-auto">
          {history.map(item => (
            <li key={item.id} className="group flex items-start gap-1">
              <button
                onClick={() => onLoad(item)}
                className="flex-1 text-left py-2 px-2 text-sm text-stone-700 hover:bg-stone-100 transition-colors leading-snug"
              >
                <div className="font-medium truncate">{item.topic}</div>
                <div className="text-xs text-stone-400 mt-0.5">{formatDate(item.generatedAt)}</div>
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="shrink-0 p-2 text-stone-300 hover:text-stone-600 transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Delete"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
