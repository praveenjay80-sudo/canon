function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const LIST_SYSTEM = `You are a master mathematics educator. Given a specific math topic, produce a precise ordered reading sequence covering ONLY that exact topic — from first contact to research frontier.

Your entire response must be a single valid JSON object. Start your response with { and end with }. No prose, no markdown, no code fences — only the raw JSON object.

Schema:
{
  "overview": "2–3 sentences: what this topic is about and what the reading journey looks like",
  "items": [
    {
      "order": 1,
      "type": "textbook" | "paper" | "lecture-notes" | "monograph",
      "title": "exact title",
      "authors": "Last, First; Last, First",
      "year": 1990,
      "level": "undergraduate" | "early-graduate" | "graduate" | "research",
      "focus": "specific chapters, sections, or parts — e.g. 'Ch. 1–3: axioms and basic constructions; Ch. 5: cardinal arithmetic'",
      "why": "1–2 sentences: what this item contributes at this position and what it unlocks next"
    }
  ]
}

Rules:
- 12–18 items, strictly ordered from introductory to frontier
- EVERY item must be directly and specifically about the given topic — not general background
- Papers appear after the textbooks that develop the necessary machinery
- focus must name specific chapters or sections, not "read everything"
- ACCURACY IS CRITICAL: only include works you are highly confident exist with exactly that title and those authors. If unsure, omit it. Never combine titles from different works.
- level = what the reader needs BEFORE this item`;

const EXPLAIN_SYSTEM = `You are a brilliant mathematics teacher explaining a specific book or paper to a complete beginner. Write in plain English — no assumed knowledge beyond high school algebra. Be engaging, concrete, and enthusiastic. Use analogies. Explain why this work matters.

Structure your explanation with these sections (plain text, no markdown headers, just natural prose paragraphs):

1. What this is: What kind of work is this? Who wrote it and when?
2. The big idea: What is the central mathematical idea or question? Explain it as if to a curious 16-year-old.
3. What you'll encounter: Walk through the main things a reader will meet — key concepts, techniques, or results — in plain language.
4. Why it matters: What did this work open up? Why do mathematicians still read it?
5. Before you open it: What should a reader know or have done first? Be honest and specific.
6. A taste: Give one concrete example or result from the work, explained from scratch.

Write 400–600 words total. No bullet points. Flowing paragraphs only.`;

function parseJson(text) {
  // Try direct parse first
  try { return JSON.parse(text); } catch {}
  // Strip markdown fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  // Extract first {...} block
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  return null;
}

export async function mathWorksFromClaude(topic) {
  const apiKey = resolveApiKey();
  if (!apiKey) return { items: [], overview: '', error: 'No API key — set one in the API Key field above.' };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        stream: true,
        system: LIST_SYSTEM,
        messages: [{ role: 'user', content: `Topic: ${topic}` }],
      }),
    });

    if (!res.ok) {
      let msg = `API error ${res.status}`;
      try { const err = await res.json(); msg = err.error?.message || msg; } catch {}
      return { items: [], overview: '', error: msg };
    }

    // Accumulate streamed text then parse
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', fullText = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const chunk = line.slice(6).trim();
          if (!chunk || chunk === '[DONE]') continue;
          try {
            const event = JSON.parse(chunk);
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              fullText += event.delta.text;
            }
          } catch {}
        }
      }
    } finally { reader.releaseLock(); }

    const parsed = parseJson(fullText.trim());
    if (!parsed) {
      const snippet = fullText.trim().slice(0, 120);
      return { items: [], overview: '', error: `Parse failed. Response started with: ${snippet || '(empty)'}` };
    }
    return {
      overview: parsed.overview || '',
      items: Array.isArray(parsed.items) ? parsed.items : [],
      error: null,
    };
  } catch (err) {
    return { items: [], overview: '', error: err.message || 'Request failed.' };
  }
}

// Streams a beginner explanation for a specific work into a setter function
export async function explainWorkForBeginners({ title, authors, year, focus, topic, onChunk, signal }) {
  const apiKey = resolveApiKey();
  if (!apiKey) { onChunk('No API key set.'); return; }

  const userMsg = `Explain this work to a complete beginner. The reader is studying: ${topic}.

Work: "${title}"${authors ? ` by ${authors}` : ''}${year ? ` (${year})` : ''}${focus ? `\nFocus area: ${focus}` : ''}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      stream: true,
      system: EXPLAIN_SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    }),
    signal,
  });

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const err = await res.json(); msg = err.error?.message || msg; } catch {}
    onChunk(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
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
            onChunk(event.delta.text);
          }
        } catch {}
      }
    }
  } finally { reader.releaseLock(); }
}
