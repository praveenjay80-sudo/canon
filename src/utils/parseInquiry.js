function clean(line) {
  return line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim();
}

export function parseInquiry(text) {
  if (!text) return null;

  const result = {
    topic: '', overview: '',
    questions: [],
    openTerritory: '',
  };

  const lines = text.split('\n');
  let i = 0;
  let currentQ = null;
  let collecting = null;
  let collectLines = [];

  const normSep = s => s.replace(/ — /g, ' -- ').replace(/—/g, '--');

  const KNOWN_KEYS = /^(TOPIC|OVERVIEW|QUESTION\s+\d+|PLAIN|MATTERS|HARD|TRIED|ACTION|ENTRY|OPEN TERRITORY):/i;

  function flushCollect() {
    if (!collecting) return;
    const val = collectLines.join(' ').trim();
    if (currentQ && ['plain', 'matters', 'hard', 'tried', 'action', 'entry'].includes(collecting)) {
      currentQ[collecting] = val;
    } else if (collecting === 'overview') result.overview = val;
    else if (collecting === 'openTerritory') result.openTerritory = val;
    collecting = null;
    collectLines = [];
  }

  function pushQ() {
    if (currentQ) result.questions.push(currentQ);
    currentQ = null;
  }

  while (i < lines.length) {
    const trimmed = clean(normSep(lines[i]));

    if (!trimmed) { flushCollect(); i++; continue; }

    let m;

    if ((m = trimmed.match(/^TOPIC:\s*(.*)/i))) {
      flushCollect(); result.topic = m[1].trim(); i++; continue;
    }

    if (trimmed.match(/^OVERVIEW:\s*/i)) {
      flushCollect();
      const inline = trimmed.replace(/^OVERVIEW:\s*/i, '').trim();
      if (inline) result.overview = inline;
      else { collecting = 'overview'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^QUESTION\s+(\d+):\s*(.*)/i))) {
      flushCollect(); pushQ();
      currentQ = { number: parseInt(m[1]), question: m[2].trim(), plain: '', matters: '', hard: '', tried: '', action: '', entry: '' };
      i++; continue;
    }

    if ((m = trimmed.match(/^PLAIN:\s*(.*)/i)) && currentQ) {
      flushCollect();
      if (m[1].trim()) currentQ.plain = m[1].trim();
      else { collecting = 'plain'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^MATTERS:\s*(.*)/i)) && currentQ) {
      flushCollect();
      if (m[1].trim()) currentQ.matters = m[1].trim();
      else { collecting = 'matters'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^HARD:\s*(.*)/i)) && currentQ) {
      flushCollect();
      if (m[1].trim()) currentQ.hard = m[1].trim();
      else { collecting = 'hard'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^TRIED:\s*(.*)/i)) && currentQ) {
      flushCollect();
      if (m[1].trim()) currentQ.tried = m[1].trim();
      else { collecting = 'tried'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^ACTION:\s*(.*)/i)) && currentQ) {
      flushCollect();
      if (m[1].trim()) currentQ.action = m[1].trim();
      else { collecting = 'action'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^ENTRY:\s*(.*)/i)) && currentQ) {
      flushCollect();
      if (m[1].trim()) currentQ.entry = m[1].trim();
      else { collecting = 'entry'; collectLines = []; }
      i++; continue;
    }

    if (trimmed.match(/^OPEN TERRITORY:\s*/i)) {
      flushCollect(); pushQ();
      const inline = trimmed.replace(/^OPEN TERRITORY:\s*/i, '').trim();
      if (inline) result.openTerritory = inline;
      else { collecting = 'openTerritory'; collectLines = []; }
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
