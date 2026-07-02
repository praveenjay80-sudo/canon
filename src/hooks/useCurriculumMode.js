import { useState, useCallback, useRef, useMemo } from 'react';
import { syllabusHarvest, seminalPapersHarvest } from '../utils/syllabusHarvest';
import { parseCurriculum } from '../utils/parseCurriculum';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const SYSTEM_PROMPT = `You are a senior university curriculum designer and intellectual historian. You have real data from two sources: the Open Syllabus Project (books most assigned in university courses worldwide) and Semantic Scholar (most influential research papers by academic impact). Your task: build the definitive, highly detailed university curriculum for the requested topic — the kind produced by the world's leading graduate program.

Output EXACTLY this format — no preamble, no commentary, no text outside this structure:

TOPIC: [topic]
OVERVIEW: [3–4 sentences: the intellectual structure of this field, major schools of thought or subfields, what mastery looks like, how the curriculum is organized]
LEVEL RANGE: [e.g., First-year undergraduate to active researcher]
TRACKS: [comma-separated learning pathways if the field has meaningful branching, e.g. "Theoretical, Applied, Computational" — omit this line entirely if the field has no meaningful tracks]

---

COURSE 1: [University course title as a department would list it]
LEVEL: [Undergraduate Year 1–2 / Undergraduate Year 3–4 / Graduate Year 1–2 / Advanced Graduate / Research Seminar]
DURATION: [e.g., 1 semester / 2 semesters / 1 year]
PREREQS: [List prior course numbers required, e.g. "Course 1, Course 2" — or "None" for first course]
SKILLS: [3–5 specific, measurable competencies gained — not vague "understanding" but concrete abilities like "can implement X", "can prove Y", "can read Z independently"]
MILESTONE: [One concrete sentence: name a specific paper, text, or capability that becomes accessible after this course]
[One sentence: what students master and what it prepares them for]
TEXTBOOKS:
- [Title] by [Author] ([Year]) — [N] university courses — [core text / supplementary / reference]
  → Typically covers: [specific chapters or topic clusters assigned at this course level]
PAPERS:
- [Title] by [Author] ([Year]) — [one sentence: what this paper establishes and why it belongs at this course level]

COURSE 2: [Name]
LEVEL: ...
...

---

TOTAL CURRICULUM: [N courses · estimated X–Y years from complete beginner to research frontier]

Rules:
- Use ONLY works from the provided data — never invent or hallucinate titles not in the supplied lists
- 5–9 courses total; order strictly introductory → research frontier, no level skipping
- 3–6 TEXTBOOKS per course (from OSP data); 1–4 PAPERS per course (from Semantic Scholar data); omit a subsection entirely if no appropriate works exist for it
- PREREQS must cite course numbers defined earlier (e.g. "Course 1, Course 2") — not generic descriptions
- SKILLS must be specific and measurable — name techniques, theorems, or tools; avoid "understand" or "appreciate"
- MILESTONE must name something concrete: a specific paper that becomes readable, a technique now achievable, or a problem now solvable
- Honor syllabusCount as the primary signal for textbook course placement: 1000+ courses = Year 1–2; 100–999 = Year 3–4 / early graduate; 10–99 = graduate; <10 = advanced graduate/seminar
- Honor influentialCitations for paper placement: assign papers to courses where students have sufficient background to read them
- Never list the same work twice across courses
- TOTAL CURRICULUM line is mandatory`;

export function useCurriculumMode() {
  const [phase, setPhase] = useState('idle'); // idle | harvesting | generating | complete | error
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [ospWorks, setOspWorks] = useState([]);
  const [seminalWorks, setSeminalWorks] = useState([]);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const generate = useCallback(async (inputTopic) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setTopic(inputTopic);
    setContent('');
    setOspWorks([]);
    setSeminalWorks([]);
    setError(null);
    setPhase('harvesting');

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set. Enter your Anthropic API key above.');
      setPhase('error');
      return;
    }

    let works = [];
    let papers = [];
    try {
      [works, papers] = await Promise.all([
        syllabusHarvest(inputTopic),
        seminalPapersHarvest(inputTopic),
      ]);
      if (signal.aborted) return;
      setOspWorks(works);
      setSeminalWorks(papers);
    } catch {
      works = [];
      papers = [];
    }

    if (signal.aborted) return;
    setPhase('generating');

    const ospData = works.length > 0
      ? works.slice(0, 70).map(w =>
          `- ${w.title}${w.authors ? ` by ${w.authors}` : ''}${w.year ? ` (${w.year})` : ''} — ${w.syllabusCount || 0} university courses`
        ).join('\n')
      : '(No Open Syllabus data available — use your knowledge of standard university curricula for this topic)';

    const seminalData = papers.length > 0
      ? papers.slice(0, 40).map(p =>
          `- "${p.title}"${p.authors ? ` by ${p.authors}` : ''}${p.year ? ` (${p.year})` : ''} — ${p.influentialCitationCount.toLocaleString()} influential citations`
        ).join('\n')
      : '(No Semantic Scholar data available)';

    const userMessage = `Build the complete university curriculum for: ${inputTopic}

── TEXTBOOKS (Open Syllabus Project — ranked by worldwide university course assignments) ──
${ospData}

── FOUNDATIONAL PAPERS (Semantic Scholar — ranked by influential citations) ──
${seminalData}

Place textbooks in TEXTBOOKS sections and papers in PAPERS sections. Use only works listed above.`;

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

      if (!signal.aborted) setPhase('complete');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Generation failed. Please try again.');
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
    setTopic('');
    setOspWorks([]);
    setSeminalWorks([]);
    setError(null);
  }, []);

  const parsed = useMemo(() => parseCurriculum(content), [content]);

  return { phase, topic, content, ospWorks, seminalWorks, error, parsed, generate, reset };
}
