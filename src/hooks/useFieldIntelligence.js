import { useState, useCallback, useRef, useMemo } from 'react';
import { syllabusHarvest, seminalPapersHarvest } from '../utils/syllabusHarvest';
import { parseLandscape, parseAudit, parseBibliography, parseThinkers } from '../utils/parseFieldIntelligence';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const LANDSCAPE_PROMPT = `You are an expert in intellectual history and the sociology of knowledge. Your job is to produce a complete, precise intellectual map of a field or topic — every significant school of thought, the actual arguments they make, the real confrontations between them, and the single deepest contested claim at the center of it all.

CRITICAL: Output ONLY the structured text below. No markdown. No bold. No asterisks. No preamble. Start your response with "TOPIC:" and nothing before it.

TOPIC: [topic as given]
OVERVIEW: [2-3 sentences: (1) what this field or debate is fundamentally about, stated plainly so a newcomer immediately understands the stakes; (2) what the central disagreement is and why intelligent people end up on different sides of it; (3) why it matters beyond the academy]

---
SCHOOL: [school name]
ORIGIN: [2-3 sentences: when and where it emerged, what specific problem or dissatisfaction triggered it, and what made it feel like a necessary departure from what came before]
STANCE: [3-4 sentences: the school's core position stated plainly — what they believe, why they believe it, and what they think the alternative gets wrong. Write it so a newcomer who has never heard of this school immediately understands what it stands for]
FIGURES:
- Name — their specific contribution to this school, in one concrete sentence
KEY CONCEPTS:
- Concept — what this concept means in the way THIS school uses it, defined in plain terms a newcomer can immediately grasp
WORKS:
- Title by Author (Year) — one sentence on what this specific work contributes to this school's program; prefer works from the provided data
LEGACY: [1-2 sentences: what lasting impact this school has had — on the field, on neighboring fields, or on how we think about the topic generally]

---

[repeat SCHOOL block for every significant school — do not cap at 3 or 4]

---
EXCHANGE: [School A] vs [School B]
DISPUTE: [2-3 sentences: the specific proposition at issue — what exactly School A claims that School B denies, stated precisely enough that someone could verify whether a given argument is relevant to it]
KEY MOMENT: [the specific paper, book, experiment, or event that crystallized this exchange into a real confrontation]
BEST CASE A: [3-4 sentences: the strongest argument School A actually makes — not a caricature. Name the mechanism, the evidence, or the logical chain. Make it as compelling as possible; a reader should be able to see why intelligent people hold this view]
BEST CASE B: [3-4 sentences: the strongest argument School B actually makes — same standard. Name the mechanism or evidence. Make it genuinely compelling]
STATUS: [resolved / ongoing / transformed] — [2 sentences: where this exchange stands now and what changed or remains unresolved]

---

[repeat EXCHANGE block for every major pairing]

---
CENTRAL CLAIM: [the single most contested proposition in this field — state it as a specific, falsifiable or at least debatable claim, not as a topic label]
FOR: [4-5 sentences: the strongest cumulative case for this claim — name the specific arguments, evidence, and mechanisms. This should be the best possible defense of the position]
AGAINST: [4-5 sentences: the strongest cumulative case against — same standard. Name specific counterarguments, anomalies, or alternative explanations]
META: [3-4 sentences: what this debate is really about at a deeper level. What human concern, methodological commitment, or philosophical assumption makes this so hard to settle? What would someone have to give up to change sides?]

Rules:
- Include ALL significant schools — never cap at 3 or 4 if more exist
- FIGURES must name real people with real, specific contributions to this school — not generic descriptions
- KEY CONCEPTS must be the terms this school actually uses, defined as this school uses them — not general field terms
- WORKS must prefer works from the provided data; supplement from knowledge where data is thin
- Each EXCHANGE must be a real documented confrontation — a specific dispute between named parties, not a vague "tension"
- CENTRAL CLAIM must be a specific proposition, not a topic name or vague question
- Write everything in plain, clear English a curious non-specialist can follow — when a technical term is unavoidable, define it in the same sentence
- Every narrative field (STANCE, BEST CASE A/B, FOR, AGAINST, META, ORIGIN, LEGACY) must be a fully developed explanation with its actual logic — not a label, not a summary heading, not a one-clause abstract. A reader who knows nothing about this field should be able to follow the argument
- No bullet points except inside FIGURES, KEY CONCEPTS, and WORKS lists`;

const AUDIT_PROMPT = `You are an expert in the history and philosophy of science and the critical analysis of academic disciplines. Your job is to strip a field down to its bones: where it came from, what assumptions it has built in that practitioners no longer question, and how stable its current foundations actually are.

CRITICAL: Output ONLY the structured text below. No markdown. No bold. No asterisks. No preamble. Start your response with "FIELD:" and nothing before it.

FIELD: [field name]
FOUNDING PROBLEM: [2-3 sentences: the specific intellectual or practical problem this field was invented to solve — not "to study X" but "to explain why X happens despite Y" or "to settle the dispute between Z and W." Explain why this problem felt urgent at the time and why existing approaches had failed to solve it]
BIRTH: [2-3 sentences: when, where, and who — the specific founding moment, institution, text, or event. Why did this particular moment produce the field rather than ten years earlier or later? What made it possible?]
FOUNDERS:
- Name — their specific founding contribution and why it was decisive, in one concrete sentence
ROADS NOT TAKEN: [3-4 sentences: name the real alternative framings or approaches that existed at the founding moment and were passed over. Why were they rejected — was it intellectual, social, political, or practical reasons? What would this field look like today if a different approach had won?]
WHAT WAS EXCLUDED: [2-3 sentences: what kinds of questions, methods, populations, or data were ruled out of bounds at the founding, and who or what bore the cost of that exclusion? This is the field's original blind spot, built in at birth]

---
AXIOM: [name of the assumption — state it as a claim, not as a label]
INVISIBLE: [3-4 sentences: why practitioners in this field don't notice or question this assumption. What makes it feel like common sense rather than a choice? What would have to happen for someone inside the field to even see it as an assumption rather than an obvious fact?]
CONSEQUENCE: [3-4 sentences: what the field cannot see, cannot ask, or systematically gets wrong because of this assumption. Give a specific example of a real phenomenon, finding, or population that this assumption causes the field to misread, ignore, or distort. Explain the actual mechanism of the distortion]
ALTERNATIVE: [1-2 sentences: what would a field look like that did NOT hold this axiom? What would it study, how would it study it, and what might it find?]

---

[repeat AXIOM block for every significant hidden assumption — aim for at least 4-6]

---
PARADIGM: [name of the current dominant paradigm or research program]
CORE COMMITMENTS: [3-4 sentences: what this paradigm takes for granted — the assumptions you must accept to work within it. State them concretely: what it says exists, what counts as evidence, what questions are central, what methods are legitimate]
ANOMALIES:
- [a specific named finding, result, or problem that this paradigm cannot adequately explain — name the study, effect, or case]
STATUS: [stable / stressed / crumbling / shifting] — [3-4 sentences: explain what the evidence for this status actually is. What specific anomalies, replication failures, or competing programs are creating pressure? Or why, despite apparent challenges, does the paradigm remain robust?]
CHALLENGERS: [3-4 sentences: name the specific researchers, schools, or programs challenging the paradigm, what angle they are attacking from, and what alternative they are proposing. Not vague "critics" but named people making specific claims]
NEXT: [3-4 sentences: what a paradigm shift in this field would concretely look like — what specific assumptions would have to be abandoned, what new assumptions would replace them, and what work already exists that points in that direction]

Rules:
- FOUNDING PROBLEM must be specific — not "to study X" but the exact problem X was meant to solve
- ROADS NOT TAKEN must name real historical alternatives with real proponents, not hypothetical alternatives
- Each AXIOM must be an actual hidden assumption that field practitioners currently hold — not an explicit stated method, not something the field openly debates
- INVISIBLE must explain the specific mechanism (social, institutional, cognitive) that keeps this assumption invisible — not just "it feels obvious"
- CONSEQUENCE must name a specific real-world case where the assumption causes a concrete error or distortion, not a general limitation
- ALTERNATIVE must be a specific different field or approach that actually exists, not a thought experiment
- ANOMALIES must be specific named findings, studies, or cases — not vague "challenges" or "critics"
- CHALLENGERS must name real researchers and their specific claims
- Write everything in plain, accessible English — as if explaining to a highly intelligent person who is new to this field. Every technical term must be defined the first time it appears. Every abstract claim must be followed by a concrete example
- No bullet points except inside FOUNDERS and ANOMALIES lists`;

const BIBLIOGRAPHY_PROMPT = `You are a senior research librarian and scholar with deep expertise across all academic fields. Your job is to produce the definitive annotated bibliography for a field — every essential work, placed at exactly the right level, with honest and specific annotations that tell a reader not just what a book is about but what it will do for them and what they need before picking it up.

CRITICAL: Output ONLY the structured text below. No markdown. No bold. No asterisks. No preamble. Start your response with "FIELD:" and nothing before it.

FIELD: [field or topic as given]
SCOPE: [2-3 sentences: what this bibliography covers, how it is organized, and what kind of reader it is built for]

---
LEVEL: Introductory
FOR: [who this level is for — be specific: "curious non-specialists, undergraduates, anyone encountering this topic for the first time with no prior background"]

WORK: [exact title]
AUTHOR: [author(s)]
YEAR: [year]
TYPE: [Textbook / Monograph / Essay Collection / Paper / Review / Classic]
PREREQS: None
ANNOTATION: [5-8 sentences in plain English — write as if explaining to a curious person who knows nothing about this field: (1) what this work is actually about, explained from scratch — not the title restated; (2) the single most important thing it argues or shows; (3) how it makes its case — what kind of evidence, reasoning, or examples it uses; (4) what the reader will concretely understand or be able to do after reading it; (5) honest caveats about difficulty, age, bias, scope, or style]

---
LEVEL: Intermediate
FOR: [who this level is for — e.g., "readers who have completed an introductory survey and are ready for primary texts and foundational debates"]

WORK: [exact title]
AUTHOR: [author(s)]
YEAR: [year]
TYPE: [type]
PREREQS: [name the exact work or specific skill genuinely needed — e.g., "Read Feser's Beginner's Guide first" or "Requires basic statistics". Never write vague phrases like "some familiarity with the field." If truly no prereqs, write "None"]
ANNOTATION: [5-8 sentences — same standard as Introductory: explain the work from scratch, its core claim, how it argues, what the reader gains, honest caveats. Do not assume the reader has read anything at this level yet]

---
LEVEL: Advanced
FOR: [who this level is for — e.g., "graduate students and specialists prepared for sustained technical argument"]

WORK: [exact title]
AUTHOR: [author(s)]
YEAR: [year]
TYPE: [type]
PREREQS: [specific prior works or skills genuinely required]
ANNOTATION: [5-8 sentences — same standard: explain the work plainly, its contribution, the argument, what the reader gains, honest difficulty assessment]

---
LEVEL: Research Frontier
FOR: [who this level is for — e.g., "PhD students, active researchers, and specialists tracking live debates"]

[SPLIT this level into two clearly labeled groups:]

Theoretical and Empirical Frontier

WORK: [title]
AUTHOR: [author(s)]
YEAR: [year]
TYPE: [type]
PREREQS: [specific prior works required]
ANNOTATION: [5-8 sentences — same standard]

[continue for all theoretical/empirical frontier works]

Methodological Frontier

WORK: [title]
AUTHOR: [author(s)]
YEAR: [year]
TYPE: [type]
PREREQS: [specific prior works required]
ANNOTATION: [5-8 sentences]

[continue for all methodological frontier works]

---
READING ORDER:
1. [exact title] — [one sentence: what this work opens up and why it comes here — not "it is introductory" but what specific understanding it gives the reader that the next work depends on]
2. [exact title] — [one sentence: same standard]
[number every work from every level — this should be a complete, opinionated sequence, not a re-listing of levels]

Rules:

CANONICITY — the most important rule:
Before writing a single entry, audit: what are the 10-15 most assigned, most cited, most foundational works in this field? Every single one must appear somewhere in this bibliography regardless of whether it is in the provided data. A bibliography of philosophy of mind without Nagel's "What Is It Like to Be a Bat?" or Searle's Chinese Room, a bibliography of economics without Adam Smith, a bibliography of linguistics without Chomsky — these are professional failures. Use the provided data to inform level placement and work selection, but never let data gaps cause canonical omissions.

LEVEL PLACEMENT — the single test for Introductory is: "Can a curious person with absolutely zero background in this field read this and understand it without help?" If no, it belongs at Intermediate or higher. Apply this test strictly:
- Introductory: ONLY modern textbook introductions, accessible overview books, and popular-science works written explicitly for non-specialists. Do NOT place historical primary sources here even if foundational — primary sources from earlier centuries (Descartes, Kant, Marx, Freud, Darwin's Origin) belong at Intermediate, because appreciating them requires context a beginner lacks. Short classic papers by living or recent authors may be Introductory only if they are genuinely accessible in prose and argument.
- Intermediate: The field's essential primary texts, landmark papers, core theoretical monographs — works that are foundational but require prior orientation to fully appreciate. This is where most classic and canonical texts belong.
- Advanced: Technical papers, demanding systematic monographs, specialist debates — works requiring genuine fluency in the field's methods and vocabulary.
- Research Frontier: Split into Theoretical/Empirical Frontier and Methodological Frontier as shown above.

ANNOTATIONS — non-negotiable standards:
- 5-8 complete sentences at every level — never fewer
- Always explain the work from scratch — never assume the reader has read other works on this list or knows the field
- Define every technical term the first time it appears in an annotation
- State the actual argument or content plainly, not just what category it falls into
- Be honest about difficulty, age, bias, and limitations — do not write promotional blurbs
- Never end an annotation mid-sentence — always finish a complete thought before starting the next WORK block

PREREQS:
- Introductory works: always "None" — if a work genuinely requires background to understand, it is not Introductory
- Intermediate and above: name the exact title or specific skill — never vague phrases. "Read Nagel's bat paper first" is correct. "Some background in philosophy" is not.

COMPLETENESS:
- Be exhaustive — never artificially cap the number of entries
- Every level must have at least 8 works; major fields will have 15-25+ per level
- Do not repeat works across levels
- TYPE must be one of: Textbook, Monograph, Essay Collection, Paper, Review, Classic

READING ORDER:
- Include every work from every level in a single numbered sequence
- Each entry must explain what the work builds on and what it opens up — not just "it is introductory" or "it is advanced"
- Be opinionated: this is a prescribed path, not a re-listing of levels
- A reader following this order should never encounter a work they are not yet prepared for`;

const THINKERS_PROMPT = `You are an expert in intellectual history and the biography of ideas. Your job is to produce rich intellectual portraits of the key figures who shaped a field — the actual people, their journeys, the arguments they made, the controversies they were at the center of, and how they changed the way their field thinks.

CRITICAL: Output ONLY the structured text below. No markdown. No bold. No asterisks. No preamble. Start your response with "FIELD:" and nothing before it.

FIELD: [field name]

---
THINKER: [full name]
BORN: [birth year–death year, or b. birth year for living scholars]
FORMATION: [2-3 sentences: where they studied, who taught them, what intellectual traditions shaped their thinking before they made their major contribution. Explain how their training positioned them to see what others had missed]
CONTRIBUTION: [3-4 sentences: what they specifically added to the field that was not there before them — not just "they wrote X" but the exact idea, framework, or method they brought into existence. What did the field now have that it did not have before?]
KEY WORKS:
- Title (Year) — one sentence on what this work specifically argues or introduces
CENTRAL DEBATE: [2-3 sentences: the main controversy they were at the center of — what the argument was, who the other side was, what each position claimed, and what was fundamentally at stake]
INFLUENCE: [3-4 sentences: who they influenced directly, what questions they opened, what became thinkable because of them, and how their ideas traveled into adjacent fields]
CRITICISM: [2-3 sentences: the principal critique of their work — what the strongest objection is, who raised it, and whether the criticism has been answered or remains live]
---

[repeat THINKER block for every major figure — include everyone who substantially shaped the field, do not cap artificially at 5 or 6]

Rules:
- Include ALL major figures — founders, challengers, synthesizers, and living researchers who are reshaping the field now
- FORMATION must name specific teachers, schools, or intellectual traditions — not just "they studied at X"
- CONTRIBUTION must state the exact claim, concept, or method introduced — never "they argued for X" without saying what X is
- KEY WORKS must use exact titles — never "major works" or "several books"
- CENTRAL DEBATE must name real opposing figures with specific positions, not "critics disagreed"
- INFLUENCE must name real thinkers who were influenced and explain what specific idea traveled to them
- CRITICISM must name a real critic making a specific, checkable claim
- Write everything in plain accessible English — define every technical term when it first appears
- No bullet points except inside KEY WORKS lists`;

async function streamGenerate(prompt, userMessage, signal, onChunk, maxTokens = 16000) {
  const apiKey = resolveApiKey();
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
      max_tokens: maxTokens,
      stream: true,
      system: prompt,
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

function buildDataBlock(textbooks, papers) {
  const ospData = textbooks.length > 0
    ? textbooks.slice(0, 70).map(w =>
        `- ${w.title}${w.authors ? ` by ${w.authors}` : ''}${w.year ? ` (${w.year})` : ''}`
      ).join('\n')
    : '(No syllabus data)';

  const paperData = papers.length > 0
    ? papers.slice(0, 50).map(p =>
        `- "${p.title}"${p.authors ? ` by ${p.authors}` : ''}${p.year ? ` (${p.year})` : ''} -- ${p.influentialCitationCount?.toLocaleString() || 0} influential citations`
      ).join('\n')
    : '(No Semantic Scholar data)';

  return { ospData, paperData };
}

export function useFieldIntelligence() {
  const [landscapePhase, setLandscapePhase] = useState('idle');
  const [auditPhase, setAuditPhase] = useState('idle');
  const [bibPhase, setBibPhase] = useState('idle');
  const [thinkersPhase, setThinkersPhase] = useState('idle');
  const [landscapeContent, setLandscapeContent] = useState('');
  const [auditContent, setAuditContent] = useState('');
  const [bibContent, setBibContent] = useState('');
  const [thinkersContent, setThinkersContent] = useState('');
  const [dataCount, setDataCount] = useState(0);
  const [error, setError] = useState(null);
  const [currentTopic, setCurrentTopic] = useState('');

  const landscapeAbortRef = useRef(null);
  const auditAbortRef = useRef(null);
  const bibAbortRef = useRef(null);
  const thinkersAbortRef = useRef(null);
  const harvestedRef = useRef({ textbooks: [], papers: [], topic: '' });

  // Harvests data only — does NOT start any generation
  const generate = useCallback(async (topic) => {
    landscapeAbortRef.current?.abort();
    auditAbortRef.current?.abort();
    bibAbortRef.current?.abort();
    thinkersAbortRef.current?.abort();
    landscapeAbortRef.current = new AbortController();
    const { signal } = landscapeAbortRef.current;

    setLandscapeContent('');
    setAuditContent('');
    setBibContent('');
    setThinkersContent('');
    setDataCount(0);
    setError(null);
    setCurrentTopic(topic);
    setLandscapePhase('harvesting');
    setAuditPhase('idle');
    setBibPhase('idle');
    setThinkersPhase('idle');
    harvestedRef.current = { textbooks: [], papers: [], topic: '' };

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set.');
      setLandscapePhase('error');
      return;
    }

    let textbooks = [], papers = [];
    try {
      [textbooks, papers] = await Promise.all([
        syllabusHarvest(topic),
        seminalPapersHarvest(topic),
      ]);
      if (signal.aborted) return;
      harvestedRef.current = { textbooks, papers, topic };
      setDataCount(textbooks.length + papers.length);
    } catch { /* harvest failure — proceed with empty data */ }

    if (signal.aborted) return;
    setLandscapePhase('ready');
  }, []);

  // Explicitly triggered landscape generation
  const generateLandscape = useCallback(async () => {
    if (landscapePhase === 'generating') return;

    landscapeAbortRef.current?.abort();
    landscapeAbortRef.current = new AbortController();
    const { signal } = landscapeAbortRef.current;

    setLandscapeContent('');
    setError(null);
    setLandscapePhase('generating');

    const apiKey = resolveApiKey();
    if (!apiKey) { setError('No API key set.'); setLandscapePhase('error'); return; }

    const { textbooks, papers, topic } = harvestedRef.current;
    const { ospData, paperData } = buildDataBlock(textbooks, papers);
    const userMessage = `Map the intellectual landscape for: ${topic}

=== TEXTBOOKS AND COURSE MATERIALS (Open Syllabus Project) ===
${ospData}

=== RESEARCH PAPERS (Semantic Scholar, by influential citations) ===
${paperData}

Use works from these lists for WORKS fields where relevant.`;

    try {
      await streamGenerate(LANDSCAPE_PROMPT, userMessage, signal, setLandscapeContent);
      if (!signal.aborted) setLandscapePhase('complete');
    } catch (err) {
      if (signal.aborted) return;
      setError(err.message || 'Generation failed.');
      setLandscapePhase('error');
    }
  }, [landscapePhase]);

  const generateAudit = useCallback(async () => {
    if (auditPhase === 'generating') return;

    auditAbortRef.current?.abort();
    auditAbortRef.current = new AbortController();
    const { signal } = auditAbortRef.current;

    setAuditContent('');
    setError(null);
    setAuditPhase('generating');

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set.');
      setAuditPhase('error');
      return;
    }

    const { textbooks, papers, topic } = harvestedRef.current;
    const { ospData, paperData } = buildDataBlock(textbooks, papers);

    const userMessage = `Produce a field audit for: ${topic}

=== TEXTBOOKS AND COURSE MATERIALS (Open Syllabus Project) ===
${ospData}

=== RESEARCH PAPERS (Semantic Scholar, by influential citations) ===
${paperData}

Use these works to ground the audit in real scholarship.`;

    try {
      await streamGenerate(AUDIT_PROMPT, userMessage, signal, setAuditContent);
      if (!signal.aborted) setAuditPhase('complete');
    } catch (err) {
      if (signal.aborted) return;
      setError(err.message || 'Audit generation failed.');
      setAuditPhase('error');
    }
  }, [auditPhase]);

  const generateBib = useCallback(async () => {
    if (bibPhase === 'generating') return;

    bibAbortRef.current?.abort();
    bibAbortRef.current = new AbortController();
    const { signal } = bibAbortRef.current;

    setBibContent('');
    setError(null);
    setBibPhase('generating');

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set.');
      setBibPhase('error');
      return;
    }

    const { textbooks, papers, topic } = harvestedRef.current;
    const { ospData, paperData } = buildDataBlock(textbooks, papers);

    const userMessage = `Produce an exhaustive annotated bibliography for: ${topic}

=== TEXTBOOKS AND COURSE MATERIALS (Open Syllabus Project) ===
${ospData}

=== RESEARCH PAPERS (Semantic Scholar, by influential citations) ===
${paperData}

Draw heavily from these lists — they represent the real scholarly consensus on what matters. Supplement from your knowledge for any levels or areas not covered by the data. Be exhaustive.`;

    try {
      await streamGenerate(BIBLIOGRAPHY_PROMPT, userMessage, signal, setBibContent, 64000);
      if (!signal.aborted) setBibPhase('complete');
    } catch (err) {
      if (signal.aborted) return;
      setError(err.message || 'Bibliography generation failed.');
      setBibPhase('error');
    }
  }, [bibPhase]);

  const generateThinkers = useCallback(async () => {
    if (thinkersPhase === 'generating') return;

    thinkersAbortRef.current?.abort();
    thinkersAbortRef.current = new AbortController();
    const { signal } = thinkersAbortRef.current;

    setThinkersContent('');
    setError(null);
    setThinkersPhase('generating');

    const apiKey = resolveApiKey();
    if (!apiKey) { setError('No API key set.'); setThinkersPhase('error'); return; }

    const { textbooks, papers, topic } = harvestedRef.current;
    const { ospData, paperData } = buildDataBlock(textbooks, papers);

    const userMessage = `Profile the key thinkers who shaped: ${topic}

=== TEXTBOOKS AND COURSE MATERIALS (Open Syllabus Project) ===
${ospData}

=== RESEARCH PAPERS (Semantic Scholar, by influential citations) ===
${paperData}

Use these works to identify who the major figures are and ground their KEY WORKS in real scholarship.`;

    try {
      await streamGenerate(THINKERS_PROMPT, userMessage, signal, setThinkersContent);
      if (!signal.aborted) setThinkersPhase('complete');
    } catch (err) {
      if (signal.aborted) return;
      setError(err.message || 'Thinkers generation failed.');
      setThinkersPhase('error');
    }
  }, [thinkersPhase]);

  const reset = useCallback(() => {
    landscapeAbortRef.current?.abort();
    auditAbortRef.current?.abort();
    bibAbortRef.current?.abort();
    thinkersAbortRef.current?.abort();
    setLandscapePhase('idle');
    setAuditPhase('idle');
    setBibPhase('idle');
    setThinkersPhase('idle');
    setLandscapeContent('');
    setAuditContent('');
    setBibContent('');
    setThinkersContent('');
    setDataCount(0);
    setError(null);
    setCurrentTopic('');
    harvestedRef.current = { textbooks: [], papers: [], topic: '' };
  }, []);

  const parsedLandscape = useMemo(() => parseLandscape(landscapeContent), [landscapeContent]);
  const parsedAudit = useMemo(() => parseAudit(auditContent), [auditContent]);
  const parsedBib = useMemo(() => parseBibliography(bibContent), [bibContent]);
  const parsedThinkers = useMemo(() => parseThinkers(thinkersContent), [thinkersContent]);

  return {
    landscapePhase, auditPhase, bibPhase, thinkersPhase,
    landscapeContent, auditContent, bibContent, thinkersContent,
    dataCount, error, currentTopic,
    parsedLandscape, parsedAudit, parsedBib, parsedThinkers,
    generate, generateLandscape, generateAudit, generateBib, generateThinkers, reset,
  };
}
