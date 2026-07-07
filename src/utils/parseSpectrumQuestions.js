function clean(line) {
  return line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim();
}

function parseDisciplines(raw) {
  return raw.split(',').map(s => s.trim()).filter(Boolean).map(entry => {
    const m = entry.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    return m ? { name: m[1].trim(), tier: m[2].trim() } : { name: entry, tier: '' };
  });
}

export function parseSpectrumQuestions(text) {
  if (!text) return null;

  const result = { questions: [] };

  const lines = text.split('\n');
  let i = 0;
  let current = null;
  let collecting = null;
  let collectLines = [];

  const KNOWN_KEYS = /^(QUESTION\s+\d+|DISCIPLINES|SPANS):/i;

  function flushCollect() {
    if (!collecting) return;
    const val = collectLines.join(' ').trim();
    if (current && collecting === 'spans') current.spans = val;
    collecting = null;
    collectLines = [];
  }

  function pushQ() {
    if (current) result.questions.push(current);
    current = null;
  }

  while (i < lines.length) {
    const trimmed = clean(lines[i]);

    if (!trimmed) { flushCollect(); i++; continue; }

    let m;

    if ((m = trimmed.match(/^QUESTION\s+(\d+):\s*(.*)/i))) {
      flushCollect(); pushQ();
      current = { number: parseInt(m[1]), question: m[2].trim(), disciplines: [], spans: '' };
      i++; continue;
    }

    if ((m = trimmed.match(/^DISCIPLINES:\s*(.*)/i)) && current) {
      flushCollect();
      current.disciplines = parseDisciplines(m[1].trim());
      i++; continue;
    }

    if ((m = trimmed.match(/^SPANS:\s*(.*)/i)) && current) {
      flushCollect();
      if (m[1].trim()) current.spans = m[1].trim();
      else { collecting = 'spans'; collectLines = []; }
      i++; continue;
    }

    if (collecting && !trimmed.match(KNOWN_KEYS)) {
      collectLines.push(trimmed);
      i++; continue;
    }

    i++;
  }

  flushCollect();
  pushQ();

  return result;
}
