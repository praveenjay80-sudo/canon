function clean(line) {
  return line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim();
}

export function parseConsilience(text) {
  if (!text) return null;

  const result = {
    question: '', fields: [],
    lenses: [],
    convergence: '', tensions: '', synthesis: '', crossReading: '',
  };

  const lines = text.split('\n');
  let i = 0;
  let currentField = null;
  let collecting = null;
  let collectLines = [];

  const normSep = s => s.replace(/ — /g, ' -- ').replace(/—/g, '--');

  const KNOWN_KEYS = /^(QUESTION|FIELDS|FIELD|LENS|ANSWER|KEY WORKS?|CONVERGENCE|TENSIONS|SYNTHESIS|CROSS-DISCIPLINARY READING):/i;

  function flushCollect() {
    if (!collecting) return;
    const val = collectLines.join(' ').trim();
    if (collecting === 'lens' && currentField) currentField.lens = val;
    else if (collecting === 'answer' && currentField) currentField.answer = val;
    else if (collecting === 'keyWorksRaw' && currentField) {
      currentField.keyWorks = val
        ? val.split(/[;]/).map(s => s.trim()).filter(Boolean)
        : collectLines.filter(Boolean);
    }
    else if (collecting === 'convergence') result.convergence = val;
    else if (collecting === 'tensions') result.tensions = val;
    else if (collecting === 'synthesis') result.synthesis = val;
    else if (collecting === 'crossReading') result.crossReading = val;
    collecting = null;
    collectLines = [];
  }

  function pushField() {
    if (!currentField) return;
    if (!Array.isArray(currentField.keyWorks)) currentField.keyWorks = [];
    result.lenses.push(currentField);
    currentField = null;
  }

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = clean(normSep(raw));

    if (!trimmed || trimmed === '---') {
      flushCollect();
      if (trimmed === '---') pushField();
      i++; continue;
    }

    let m;

    if ((m = trimmed.match(/^QUESTION:\s*(.*)/i))) {
      flushCollect(); result.question = m[1].trim(); i++; continue;
    }

    if ((m = trimmed.match(/^FIELDS:\s*(.*)/i))) {
      flushCollect();
      result.fields = m[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
      i++; continue;
    }

    if ((m = trimmed.match(/^FIELD:\s*(.*)/i))) {
      flushCollect(); pushField();
      currentField = { name: m[1].trim(), lens: '', answer: '', keyWorks: [] };
      i++; continue;
    }

    if ((m = trimmed.match(/^LENS:\s*(.*)/i)) && currentField) {
      flushCollect();
      if (m[1].trim()) currentField.lens = m[1].trim();
      else { collecting = 'lens'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^ANSWER:\s*(.*)/i)) && currentField) {
      flushCollect();
      if (m[1].trim()) currentField.answer = m[1].trim();
      else { collecting = 'answer'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^KEY WORKS?:\s*(.*)/i)) && currentField) {
      flushCollect();
      const inline = m[1].trim();
      if (inline && !inline.startsWith('(none')) {
        currentField.keyWorks = inline.split(/[;]/).map(s => s.trim()).filter(Boolean);
      } else {
        collecting = 'keyWorksRaw'; collectLines = [];
      }
      i++; continue;
    }

    if ((m = trimmed.match(/^CONVERGENCE:\s*(.*)/i))) {
      flushCollect(); pushField();
      if (m[1].trim()) result.convergence = m[1].trim();
      else { collecting = 'convergence'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^TENSIONS:\s*(.*)/i))) {
      flushCollect(); pushField();
      if (m[1].trim()) result.tensions = m[1].trim();
      else { collecting = 'tensions'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^SYNTHESIS:\s*(.*)/i))) {
      flushCollect(); pushField();
      if (m[1].trim()) result.synthesis = m[1].trim();
      else { collecting = 'synthesis'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^CROSS-DISCIPLINARY READING:\s*(.*)/i))) {
      flushCollect(); pushField();
      if (m[1].trim()) result.crossReading = m[1].trim();
      else { collecting = 'crossReading'; collectLines = []; }
      i++; continue;
    }

    // Bulleted items for keyWorksRaw
    if (collecting === 'keyWorksRaw' && trimmed.match(/^[-*]\s+/)) {
      collectLines.push(trimmed.replace(/^[-*]\s+/, '').trim());
      i++; continue;
    }

    // Continuation lines
    if (collecting && !trimmed.match(KNOWN_KEYS)) {
      collectLines.push(trimmed);
      i++; continue;
    }

    i++;
  }

  flushCollect();
  pushField();

  return result;
}
