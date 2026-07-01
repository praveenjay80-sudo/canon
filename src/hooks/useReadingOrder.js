import { useState, useCallback, useRef } from 'react';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const SYSTEM_PROMPT = `You are a scholarly curriculum designer building a complete, gap-free reading curriculum.

Output exactly this format — no preamble, no trailing summary:

PHASE 1: [Name] (Weeks [range])
[One sentence describing what the reader will be able to do after this phase]
- [Title] by [Author] ([Year]) — [Why this is the right starting point; what it gives the reader]
- [Title] by [Author] ([Year]) — [What the previous work unlocked that makes this one now accessible]

PHASE 2: [Name] (Weeks [range])
[One sentence describing the new capability unlocked in this phase]
- [Title] by [Author] ([Year]) — [How it builds directly on the phase 1 foundation]
- ...

Rules for a gap-free curriculum:
- Every work must follow seamlessly from the one before it — no unexplained jumps in difficulty or assumed knowledge
- Textbooks strictly ordered: introductory → undergraduate → graduate → advanced research. Never skip a level.
- Within each phase, works are ordered so each one provides the vocabulary, intuition, or technique that the next one requires
- Papers and monographs come only after the textbook that gives the reader the formal apparatus to read them
- If two works cover the same level, order the more concrete/applied one first, then the more abstract/theoretical
- First phase: works a motivated beginner with no prior exposure can open and understand; final phase: research frontier
- Every work in the canon appears exactly once
- The rationale for each work must name what it gives the reader that enables the next work — make the chain of dependencies explicit`;

export function useReadingOrder() {
  const [status, setStatus] = useState('idle');
  const [content, setContent] = useState('');
  const abortRef = useRef(null);

  const generate = useCallback(async (canonContent) => {
    if (!canonContent) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setStatus('loading');
    setContent('');

    const apiKey = resolveApiKey();
    if (!apiKey) { setStatus('error'); return; }

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
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          stream: true,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Sequence this canon into a reading plan:\n\n${canonContent}` }],
        }),
        signal,
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result = '';

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
      } finally {
        reader.releaseLock();
      }

      if (!signal.aborted) setStatus('complete');
    } catch (err) {
      if (err.name !== 'AbortError') setStatus('error');
    }
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setContent('');
  }, []);

  return { status, content, generate, clear };
}
