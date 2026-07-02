import { useState } from 'react';

const EXAMPLES = [
  'Attention Is All You Need — Vaswani et al.',
  "Gödel's Incompleteness Theorems",
  "Rudin's Principles of Mathematical Analysis",
  'On the Electrodynamics of Moving Bodies — Einstein (1905)',
];

export default function ReverseInput({ onGenerate, disabled, shake }) {
  const [input, setInput] = useState('');

  function handleSubmit() {
    const v = input.trim();
    if (!v || disabled) return;
    onGenerate(v);
  }

  return (
    <div className={shake ? 'animate-shake' : ''}>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Paste any paper or book title..."
          disabled={disabled}
          className="flex-1 px-3 py-2.5 text-sm border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-700 transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || disabled}
          className="px-5 py-2.5 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-40 whitespace-nowrap"
        >
          Map Prerequisites
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => { setInput(ex); }}
            disabled={disabled}
            className="text-xs text-stone-400 hover:text-stone-700 transition-colors disabled:opacity-40"
          >
            {ex.length > 40 ? ex.slice(0, 37) + '...' : ex}
          </button>
        ))}
      </div>
    </div>
  );
}
