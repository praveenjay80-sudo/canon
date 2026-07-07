import { useState } from 'react';

const EXAMPLES = [
  'sleep', 'money and markets', 'child development', 'climate', 'creativity', 'aging',
];

export default function SpectrumInput({ onGenerateQuestions, onSubmitDirect, disabled }) {
  const [mode, setMode] = useState('generate'); // 'generate' | 'direct'
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');

  function handleGenerate() {
    const v = topic.trim();
    if (!v || disabled) return;
    onGenerateQuestions(v);
  }

  function handleDirect() {
    const v = question.trim();
    if (!v || disabled) return;
    onSubmitDirect(v);
  }

  return (
    <div>
      <div className="flex gap-4 mb-3">
        <button
          onClick={() => setMode('generate')}
          className={`text-xs font-mono pb-1 border-b-2 transition-colors ${
            mode === 'generate' ? 'border-cyan-600 text-cyan-700 font-semibold' : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          Generate Questions
        </button>
        <button
          onClick={() => setMode('direct')}
          className={`text-xs font-mono pb-1 border-b-2 transition-colors ${
            mode === 'direct' ? 'border-cyan-600 text-cyan-700 font-semibold' : 'border-transparent text-stone-400 hover:text-stone-700'
          }`}
        >
          I Already Have a Question
        </button>
      </div>

      {mode === 'generate' ? (
        <div>
          <p className="text-xs text-stone-400 mb-2">Enter any topic — get real-life questions whose complete answer genuinely requires multiple disciplines.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              placeholder="Enter any topic..."
              disabled={disabled}
              className="flex-1 px-3 py-2.5 text-sm border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-700 transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || disabled}
              className="px-5 py-2.5 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              Find Questions
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setTopic(ex)}
                disabled={disabled}
                className="text-xs text-stone-400 hover:text-stone-700 transition-colors disabled:opacity-40"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-stone-400 mb-2">Type your own real-life question directly — skip straight to the concept breakdown and reading list.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDirect()}
              placeholder="Enter your question..."
              disabled={disabled}
              className="flex-1 px-3 py-2.5 text-sm border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-700 transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleDirect}
              disabled={!question.trim() || disabled}
              className="px-5 py-2.5 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              Build Answer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
