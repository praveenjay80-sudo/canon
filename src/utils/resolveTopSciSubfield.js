import { TOPSCI_ALL_SUBFIELDS, TOPSCI_FIELD_SUBFIELDS } from '../constants/topSciFacets.js';

// Mirrors pulseOpenAlex.js's resolveOpenAlexTopicId technique exactly (same
// stopwords, same Jaccard word-overlap, same 0.6 threshold) — proven here
// already for topic-name matching against a fixed vocabulary.
const STOPWORDS = new Set(['a', 'an', 'and', 'of', 'the', 'in', 'on', 'for', 'with', 'to', 'at', 'by', 'or', 'vs', 'via', 'as']);

function significantWords(name) {
  return new Set((name || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter(w => w && !STOPWORDS.has(w)));
}

function jaccard(a, b) {
  const inter = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
}

const SUBFIELD_TO_FIELD = (() => {
  const map = {};
  for (const [field, subs] of Object.entries(TOPSCI_FIELD_SUBFIELDS)) {
    for (const sf of subs) map[sf] = field;
  }
  return map;
})();

function wordOverlapMatch(topic) {
  const topicWords = significantWords(topic);
  let best = null, bestScore = 0;
  for (const sf of TOPSCI_ALL_SUBFIELDS) {
    const score = jaccard(topicWords, significantWords(sf));
    if (score > bestScore) { bestScore = score; best = sf; }
  }
  return bestScore >= 0.6 ? best : null;
}

// Only reached when word-overlap found nothing confident — forced to pick
// from the closed 174-subfield list or explicitly decline, same
// never-fabricate discipline as the Top Scientists bio generator.
async function haikuMatch(topic) {
  const key = localStorage.getItem('canon_api_key') || import.meta.env?.VITE_ANTHROPIC_API_KEY || '';
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 40,
        system: `Classify the given research topic into exactly one Science-Metrix subfield from this fixed list, or reply NONE if nothing genuinely fits:\n${TOPSCI_ALL_SUBFIELDS.join(', ')}\n\nReply with only the exact subfield name copied from the list, or the single word NONE. No other text.`,
        messages: [{ role: 'user', content: topic }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const answer = data.content?.[0]?.text?.trim();
    if (!answer || answer === 'NONE') return null;
    return TOPSCI_ALL_SUBFIELDS.includes(answer) ? answer : null;
  } catch { return null; }
}

const cache = new Map();

// { subfield, field } on a confident match, otherwise null — callers should
// render nothing rather than guess (same principle as every fix this session).
export async function resolveTopSciSubfield(topic) {
  if (cache.has(topic)) return cache.get(topic);
  let subfield = wordOverlapMatch(topic);
  if (!subfield) subfield = await haikuMatch(topic);
  const result = subfield ? { subfield, field: SUBFIELD_TO_FIELD[subfield] || null } : null;
  cache.set(topic, result);
  return result;
}
