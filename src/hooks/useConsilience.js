import { useState, useCallback, useRef, useMemo } from 'react';
import { syllabusHarvest, seminalPapersHarvest } from '../utils/syllabusHarvest';
import { parseConsilience } from '../utils/parseConsilience';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const SYSTEM_PROMPT = `You are an expert in cross-disciplinary synthesis. Given a question that spans multiple academic fields, identify every discipline that genuinely bears on it, explain what each field actually says, and synthesize across all of them.

CRITICAL: Output ONLY the structured text below. No markdown. No bold. No preamble. Start your response with "QUESTION:" and nothing before it.

QUESTION: [restate the question precisely]
FIELDS: [comma-separated list of 4-8 disciplines that have relevant research on this question]

---

FIELD: [discipline name]
LENS: [one sentence: what unique angle this field brings to this specific question]
ANSWER: [2-3 sentences: what this field's research actually says in answer to the question — cite specific findings, frameworks, or mechanisms]
KEY WORKS: [1-3 works from the provided data, separated by semicolons; write KEY WORKS: (none in dataset) if no relevant works found]

---

[repeat FIELD block for each relevant discipline]

---

CONVERGENCE: [2-3 sentences: where multiple fields independently reach the same conclusion — name specific findings, not just "fields agree"]
TENSIONS: [2-3 sentences: where fields most importantly contradict each other — name specifically what disagrees and why]
SYNTHESIS: [3-4 sentences: what emerges when all perspectives are held together — the most complete answer available, which no single field can say alone]
CROSS-DISCIPLINARY READING: [2-4 works from the data most useful across multiple fields; separated by semicolons]

Rules:
- Identify 4-8 disciplines; each must add genuinely distinct insight to this question
- KEY WORKS must use only works from the provided data
- CONVERGENCE and TENSIONS must name specific findings, not general statements about academic disagreement
- SYNTHESIS must say something no single field can say alone
- The FIELDS line must list exactly the disciplines that appear as FIELD: blocks`;

export function useConsilience() {
  const [phase, setPhase] = useState('idle');
  const [content, setContent] = useState('');
  const [dataCount, setDataCount] = useState(0);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const generate = useCallback(async (question) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setContent('');
    setDataCount(0);
    setError(null);
    setPhase('harvesting');

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set.');
      setPhase('error');
      return;
    }

    let textbooks = [], papers = [];
    try {
      [textbooks, papers] = await Promise.all([
        syllabusHarvest(question),
        seminalPapersHarvest(question),
      ]);
      if (signal.aborted) return;
      setDataCount(textbooks.length + papers.length);
    } catch { textbooks = []; papers = []; }

    if (signal.aborted) return;
    setPhase('generating');

    const ospData = textbooks.length > 0
      ? textbooks.slice(0, 50).map(w =>
          `- ${w.title}${w.authors ? ` by ${w.authors}` : ''}${w.year ? ` (${w.year})` : ''}`
        ).join('\n')
      : '(No syllabus data)';

    const paperData = papers.length > 0
      ? papers.slice(0, 40).map(p =>
          `- "${p.title}"${p.authors ? ` by ${p.authors}` : ''}${p.year ? ` (${p.year})` : ''}`
        ).join('\n')
      : '(No Semantic Scholar data)';

    const userMessage = `Synthesize across all relevant disciplines for this question: ${question}

=== TEXTBOOKS AND COURSE MATERIALS (Open Syllabus Project) ===
${ospData}

=== RESEARCH PAPERS (Semantic Scholar, by influential citations) ===
${paperData}

Use works from these lists for KEY WORKS and CROSS-DISCIPLINARY READING. Identify 4-8 disciplines that have distinct things to say about this question.`;

    try {
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
          max_tokens: 6000,
          stream: true,
          system: SYSTEM_PROMPT,
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
                setContent(result);
              }
            } catch {}
          }
        }
      } finally { reader.releaseLock(); }

      if (!signal.aborted) setPhase('complete');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Generation failed.');
        setPhase('error');
      } else {
        setPhase('idle');
      }
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    setContent('');
    setDataCount(0);
    setError(null);
  }, []);

  const parsed = useMemo(() => parseConsilience(content), [content]);

  return { phase, content, dataCount, error, parsed, generate, reset };
}
