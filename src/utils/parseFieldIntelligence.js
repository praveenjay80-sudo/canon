function clean(line) {
  return line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim();
}

// ── Landscape parser ────────────────────────────────────────────────────────

const LANDSCAPE_KEYS = /^(TOPIC|OVERVIEW|SCHOOL|ORIGIN|STANCE|FIGURES|KEY CONCEPTS|WORKS|LEGACY|EXCHANGE|DISPUTE|KEY MOMENT|BEST CASE A|BEST CASE B|STATUS|CENTRAL CLAIM|FOR|AGAINST|META):/i;

export function parseLandscape(text) {
  if (!text) return null;

  const result = {
    topic: '', overview: '',
    schools: [],
    exchanges: [],
    argument: { centralClaim: '', for: '', against: '', meta: '' },
  };

  const lines = text.split('\n');
  let i = 0;
  let currentSchool = null;
  let currentExchange = null;
  let currentSection = null; // tracks 'figures' | 'concepts' | 'works' within a school
  let collecting = null;
  let collectLines = [];

  function flushCollect() {
    if (!collecting) return;
    const val = collectLines.join(' ').trim();
    if (collecting === 'schoolOrigin' && currentSchool) currentSchool.origin = val;
    else if (collecting === 'schoolStance' && currentSchool) currentSchool.stance = val;
    else if (collecting === 'schoolLegacy' && currentSchool) currentSchool.legacy = val;
    else if (collecting === 'exchangeDispute' && currentExchange) currentExchange.dispute = val;
    else if (collecting === 'exchangeKeyMoment' && currentExchange) currentExchange.keyMoment = val;
    else if (collecting === 'exchangeBestA' && currentExchange) currentExchange.bestCaseA = val;
    else if (collecting === 'exchangeBestB' && currentExchange) currentExchange.bestCaseB = val;
    else if (collecting === 'exchangeStatus' && currentExchange) currentExchange.status = val;
    else if (collecting === 'argClaim') result.argument.centralClaim = val;
    else if (collecting === 'argFor') result.argument.for = val;
    else if (collecting === 'argAgainst') result.argument.against = val;
    else if (collecting === 'argMeta') result.argument.meta = val;
    else if (collecting === 'overview') result.overview = val;
    collecting = null;
    collectLines = [];
  }

  function pushSchool() {
    if (!currentSchool) return;
    result.schools.push(currentSchool);
    currentSchool = null;
    currentSection = null;
  }

  function pushExchange() {
    if (!currentExchange) return;
    result.exchanges.push(currentExchange);
    currentExchange = null;
  }

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = clean(raw);

    if (!trimmed) { i++; continue; }

    if (trimmed === '---') {
      flushCollect();
      pushSchool();
      pushExchange();
      i++; continue;
    }

    let m;

    if ((m = trimmed.match(/^TOPIC:\s*(.*)/i))) {
      flushCollect(); result.topic = m[1].trim(); i++; continue;
    }
    if ((m = trimmed.match(/^OVERVIEW:\s*(.*)/i))) {
      flushCollect();
      if (m[1].trim()) result.overview = m[1].trim();
      else { collecting = 'overview'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^SCHOOL:\s*(.*)/i))) {
      flushCollect(); pushSchool(); pushExchange();
      currentSchool = { name: m[1].trim(), origin: '', stance: '', figures: [], concepts: [], works: [], legacy: '' };
      currentSection = null;
      i++; continue;
    }
    if ((m = trimmed.match(/^ORIGIN:\s*(.*)/i)) && currentSchool) {
      flushCollect(); currentSection = null;
      if (m[1].trim()) currentSchool.origin = m[1].trim();
      else { collecting = 'schoolOrigin'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^STANCE:\s*(.*)/i)) && currentSchool) {
      flushCollect(); currentSection = null;
      if (m[1].trim()) currentSchool.stance = m[1].trim();
      else { collecting = 'schoolStance'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^FIGURES:/i)) && currentSchool) {
      flushCollect(); currentSection = 'figures'; i++; continue;
    }
    if ((m = trimmed.match(/^KEY CONCEPTS:/i)) && currentSchool) {
      flushCollect(); currentSection = 'concepts'; i++; continue;
    }
    if ((m = trimmed.match(/^WORKS:/i)) && currentSchool) {
      flushCollect(); currentSection = 'works'; i++; continue;
    }
    if ((m = trimmed.match(/^LEGACY:\s*(.*)/i)) && currentSchool) {
      flushCollect(); currentSection = null;
      if (m[1].trim()) currentSchool.legacy = m[1].trim();
      else { collecting = 'schoolLegacy'; collectLines = []; }
      i++; continue;
    }

    // Bullet items inside school — use currentSection for reliable assignment
    if (currentSchool && trimmed.match(/^[-•]\s+/)) {
      const item = trimmed.replace(/^[-•]\s+/, '').trim();
      if (currentSection === 'works') currentSchool.works.push(item);
      else if (currentSection === 'concepts') currentSchool.concepts.push(item);
      else currentSchool.figures.push(item); // default to figures
      i++; continue;
    }

    if ((m = trimmed.match(/^EXCHANGE:\s*(.*)/i))) {
      flushCollect(); pushSchool(); pushExchange();
      currentExchange = { schools: m[1].trim(), dispute: '', keyMoment: '', bestCaseA: '', bestCaseB: '', status: '' };
      currentSection = null;
      i++; continue;
    }
    if ((m = trimmed.match(/^DISPUTE:\s*(.*)/i)) && currentExchange) {
      flushCollect();
      if (m[1].trim()) currentExchange.dispute = m[1].trim();
      else { collecting = 'exchangeDispute'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^KEY MOMENT:\s*(.*)/i)) && currentExchange) {
      flushCollect();
      if (m[1].trim()) currentExchange.keyMoment = m[1].trim();
      else { collecting = 'exchangeKeyMoment'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^BEST CASE A:\s*(.*)/i)) && currentExchange) {
      flushCollect();
      if (m[1].trim()) currentExchange.bestCaseA = m[1].trim();
      else { collecting = 'exchangeBestA'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^BEST CASE B:\s*(.*)/i)) && currentExchange) {
      flushCollect();
      if (m[1].trim()) currentExchange.bestCaseB = m[1].trim();
      else { collecting = 'exchangeBestB'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^STATUS:\s*(.*)/i)) && currentExchange) {
      flushCollect();
      if (m[1].trim()) currentExchange.status = m[1].trim();
      else { collecting = 'exchangeStatus'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^CENTRAL CLAIM:\s*(.*)/i))) {
      flushCollect(); pushSchool(); pushExchange();
      if (m[1].trim()) result.argument.centralClaim = m[1].trim();
      else { collecting = 'argClaim'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^FOR:\s*(.*)/i))) {
      flushCollect();
      if (m[1].trim()) result.argument.for = m[1].trim();
      else { collecting = 'argFor'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^AGAINST:\s*(.*)/i))) {
      flushCollect();
      if (m[1].trim()) result.argument.against = m[1].trim();
      else { collecting = 'argAgainst'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^META:\s*(.*)/i))) {
      flushCollect();
      if (m[1].trim()) result.argument.meta = m[1].trim();
      else { collecting = 'argMeta'; collectLines = []; }
      i++; continue;
    }

    if (collecting && !trimmed.match(LANDSCAPE_KEYS)) {
      collectLines.push(trimmed);
    }

    i++;
  }

  flushCollect();
  pushSchool();
  pushExchange();

  return result;
}

// ── Audit parser ─────────────────────────────────────────────────────────────

const AUDIT_KEYS = /^(FIELD|FOUNDING PROBLEM|BIRTH|FOUNDERS|ROADS NOT TAKEN|WHAT WAS EXCLUDED|AXIOM|INVISIBLE|CONSEQUENCE|ALTERNATIVE|PARADIGM|CORE COMMITMENTS|ANOMALIES|STATUS|CHALLENGERS|NEXT):/i;

export function parseAudit(text) {
  if (!text) return null;

  const result = {
    field: '', foundingProblem: '', birth: '',
    founders: [], roadsNotTaken: '', excluded: '',
    axioms: [],
    paradigm: { name: '', coreCommitments: '', anomalies: [], status: '', challengers: '', next: '' },
  };

  const lines = text.split('\n');
  let i = 0;
  let currentAxiom = null;
  let collecting = null;
  let collectLines = [];
  let inParadigm = false;
  let inFounders = false;
  let inAnomalies = false;

  function flushCollect() {
    if (!collecting) return;
    const val = collectLines.join(' ').trim();
    if (collecting === 'foundingProblem') result.foundingProblem = val;
    else if (collecting === 'birth') result.birth = val;
    else if (collecting === 'roadsNotTaken') result.roadsNotTaken = val;
    else if (collecting === 'excluded') result.excluded = val;
    else if (collecting === 'axiomInvisible' && currentAxiom) currentAxiom.invisible = val;
    else if (collecting === 'axiomConsequence' && currentAxiom) currentAxiom.consequence = val;
    else if (collecting === 'axiomAlternative' && currentAxiom) currentAxiom.alternative = val;
    else if (collecting === 'paradigmCore') result.paradigm.coreCommitments = val;
    else if (collecting === 'paradigmStatus') result.paradigm.status = val;
    else if (collecting === 'paradigmChallengers') result.paradigm.challengers = val;
    else if (collecting === 'paradigmNext') result.paradigm.next = val;
    collecting = null;
    collectLines = [];
  }

  function pushAxiom() {
    if (!currentAxiom) return;
    result.axioms.push(currentAxiom);
    currentAxiom = null;
  }

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = clean(raw);

    if (!trimmed) { i++; continue; }

    if (trimmed === '---') {
      flushCollect();
      pushAxiom();
      inFounders = false;
      inAnomalies = false;
      i++; continue;
    }

    let m;

    if ((m = trimmed.match(/^FIELD:\s*(.*)/i))) {
      flushCollect(); result.field = m[1].trim(); i++; continue;
    }
    if ((m = trimmed.match(/^FOUNDING PROBLEM:\s*(.*)/i))) {
      flushCollect();
      if (m[1].trim()) result.foundingProblem = m[1].trim();
      else { collecting = 'foundingProblem'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^BIRTH:\s*(.*)/i))) {
      flushCollect();
      if (m[1].trim()) result.birth = m[1].trim();
      else { collecting = 'birth'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^FOUNDERS:/i))) {
      flushCollect(); inFounders = true; i++; continue;
    }
    if ((m = trimmed.match(/^ROADS NOT TAKEN:\s*(.*)/i))) {
      flushCollect(); inFounders = false;
      if (m[1].trim()) result.roadsNotTaken = m[1].trim();
      else { collecting = 'roadsNotTaken'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^WHAT WAS EXCLUDED:\s*(.*)/i))) {
      flushCollect(); inFounders = false;
      if (m[1].trim()) result.excluded = m[1].trim();
      else { collecting = 'excluded'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^AXIOM:\s*(.*)/i))) {
      flushCollect(); pushAxiom();
      currentAxiom = { name: m[1].trim(), invisible: '', consequence: '', alternative: '' };
      inParadigm = false;
      i++; continue;
    }
    if ((m = trimmed.match(/^INVISIBLE:\s*(.*)/i)) && currentAxiom) {
      flushCollect();
      if (m[1].trim()) currentAxiom.invisible = m[1].trim();
      else { collecting = 'axiomInvisible'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^CONSEQUENCE:\s*(.*)/i)) && currentAxiom) {
      flushCollect();
      if (m[1].trim()) currentAxiom.consequence = m[1].trim();
      else { collecting = 'axiomConsequence'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^ALTERNATIVE:\s*(.*)/i)) && currentAxiom) {
      flushCollect();
      if (m[1].trim()) currentAxiom.alternative = m[1].trim();
      else { collecting = 'axiomAlternative'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^PARADIGM:\s*(.*)/i))) {
      flushCollect(); pushAxiom();
      result.paradigm.name = m[1].trim();
      inParadigm = true;
      i++; continue;
    }
    if ((m = trimmed.match(/^CORE COMMITMENTS:\s*(.*)/i)) && inParadigm) {
      flushCollect();
      if (m[1].trim()) result.paradigm.coreCommitments = m[1].trim();
      else { collecting = 'paradigmCore'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^ANOMALIES:/i)) && inParadigm) {
      flushCollect(); inAnomalies = true; i++; continue;
    }
    if ((m = trimmed.match(/^STATUS:\s*(.*)/i)) && inParadigm) {
      flushCollect(); inAnomalies = false;
      if (m[1].trim()) result.paradigm.status = m[1].trim();
      else { collecting = 'paradigmStatus'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^CHALLENGERS:\s*(.*)/i)) && inParadigm) {
      flushCollect();
      if (m[1].trim()) result.paradigm.challengers = m[1].trim();
      else { collecting = 'paradigmChallengers'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^NEXT:\s*(.*)/i)) && inParadigm) {
      flushCollect();
      if (m[1].trim()) result.paradigm.next = m[1].trim();
      else { collecting = 'paradigmNext'; collectLines = []; }
      i++; continue;
    }

    // Bullet items
    if (trimmed.match(/^[-•]\s+/)) {
      const item = trimmed.replace(/^[-•]\s+/, '').trim();
      if (inFounders) { result.founders.push(item); i++; continue; }
      if (inAnomalies && inParadigm) { result.paradigm.anomalies.push(item); i++; continue; }
    }

    if (collecting && !trimmed.match(AUDIT_KEYS)) {
      collectLines.push(trimmed);
    }

    i++;
  }

  flushCollect();
  pushAxiom();

  return result;
}

// ── Bibliography parser ───────────────────────────────────────────────────────

const BIB_KEYS = /^(FIELD|SCOPE|LEVEL|FOR|WORK|AUTHOR|YEAR|TYPE|PREREQS|ANNOTATION|READING ORDER):/i;

export function parseBibliography(text) {
  if (!text) return null;

  const result = { field: '', scope: '', levels: [], readingOrder: [] };

  const lines = text.split('\n');
  let i = 0;
  let currentLevel = null;
  let currentWork = null;
  let currentSubgroup = null;
  let collecting = null;
  let collectLines = [];
  let inReadingOrder = false;

  function flushCollect() {
    if (!collecting) return;
    const val = collectLines.join(' ').trim();
    if (collecting === 'annotation' && currentWork) currentWork.annotation = val;
    else if (collecting === 'scope') result.scope = val;
    else if (collecting === 'levelFor' && currentLevel) currentLevel.for = val;
    collecting = null;
    collectLines = [];
  }

  function pushWork() {
    if (!currentWork || !currentLevel) return;
    currentLevel.works.push(currentWork);
    currentWork = null;
  }

  function pushLevel() {
    if (!currentLevel) return;
    pushWork();
    result.levels.push(currentLevel);
    currentLevel = null;
    currentSubgroup = null;
  }

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = clean(raw);

    if (!trimmed) { i++; continue; }

    if (trimmed === '---') {
      flushCollect();
      pushWork();
      inReadingOrder = false;
      i++; continue;
    }

    let m;

    if ((m = trimmed.match(/^READING ORDER:/i))) {
      flushCollect(); pushWork(); pushLevel();
      inReadingOrder = true;
      i++; continue;
    }

    if (inReadingOrder) {
      // Match "1. Title — reason" or "1. Title - reason"
      const roMatch = trimmed.match(/^\d+\.\s+(.+?)\s+[—\-–]\s+(.+)$/);
      if (roMatch) {
        result.readingOrder.push({ title: roMatch[1].trim(), reason: roMatch[2].trim() });
      } else if (trimmed.match(/^\d+\.\s+/)) {
        // No reason separator — just store the title
        result.readingOrder.push({ title: trimmed.replace(/^\d+\.\s+/, '').trim(), reason: '' });
      }
      i++; continue;
    }

    if ((m = trimmed.match(/^FIELD:\s*(.*)/i))) {
      flushCollect(); result.field = m[1].trim(); i++; continue;
    }
    if ((m = trimmed.match(/^SCOPE:\s*(.*)/i))) {
      flushCollect();
      if (m[1].trim()) result.scope = m[1].trim();
      else { collecting = 'scope'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^LEVEL:\s*(.*)/i))) {
      flushCollect(); pushLevel();
      currentLevel = { name: m[1].trim(), for: '', works: [] };
      i++; continue;
    }
    if ((m = trimmed.match(/^FOR:\s*(.*)/i)) && currentLevel && !currentWork) {
      flushCollect();
      if (m[1].trim()) currentLevel.for = m[1].trim();
      else { collecting = 'levelFor'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^WORK:\s*(.*)/i))) {
      flushCollect(); pushWork();
      currentWork = { title: m[1].trim(), author: '', year: '', type: '', prereqs: '', annotation: '', subgroup: currentSubgroup };
      i++; continue;
    }
    if ((m = trimmed.match(/^AUTHOR:\s*(.*)/i)) && currentWork) {
      flushCollect(); currentWork.author = m[1].trim(); i++; continue;
    }
    if ((m = trimmed.match(/^YEAR:\s*(.*)/i)) && currentWork) {
      flushCollect(); currentWork.year = m[1].trim(); i++; continue;
    }
    if ((m = trimmed.match(/^TYPE:\s*(.*)/i)) && currentWork) {
      flushCollect(); currentWork.type = m[1].trim(); i++; continue;
    }
    if ((m = trimmed.match(/^PREREQS:\s*(.*)/i)) && currentWork) {
      flushCollect(); currentWork.prereqs = m[1].trim(); i++; continue;
    }
    if ((m = trimmed.match(/^ANNOTATION:\s*(.*)/i)) && currentWork) {
      flushCollect();
      if (m[1].trim()) currentWork.annotation = m[1].trim();
      else { collecting = 'annotation'; collectLines = []; }
      i++; continue;
    }

    if (collecting && !trimmed.match(BIB_KEYS)) {
      collectLines.push(trimmed);
      i++; continue;
    }

    // Unrecognised line inside a level with no active work = subgroup header
    if (currentLevel && !currentWork && !collecting && !trimmed.match(BIB_KEYS)) {
      currentSubgroup = trimmed;
      i++; continue;
    }

    i++;
  }

  flushCollect();
  pushLevel();

  return result;
}

// ── Thinkers parser ───────────────────────────────────────────────────────────

const THINKER_KEYS = /^(FIELD|THINKER|BORN|FORMATION|CONTRIBUTION|KEY WORKS|CENTRAL DEBATE|INFLUENCE|CRITICISM):/i;

export function parseThinkers(text) {
  if (!text) return null;

  const result = { field: '', thinkers: [] };
  const lines = text.split('\n');
  let i = 0;
  let currentThinker = null;
  let collecting = null;
  let collectLines = [];
  let inKeyWorks = false;

  function flushCollect() {
    if (!collecting) return;
    const val = collectLines.join(' ').trim();
    if (collecting === 'formation' && currentThinker) currentThinker.formation = val;
    else if (collecting === 'contribution' && currentThinker) currentThinker.contribution = val;
    else if (collecting === 'centralDebate' && currentThinker) currentThinker.centralDebate = val;
    else if (collecting === 'influence' && currentThinker) currentThinker.influence = val;
    else if (collecting === 'criticism' && currentThinker) currentThinker.criticism = val;
    collecting = null;
    collectLines = [];
  }

  function pushThinker() {
    if (!currentThinker) return;
    result.thinkers.push(currentThinker);
    currentThinker = null;
    inKeyWorks = false;
  }

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = clean(raw);

    if (!trimmed) { i++; continue; }

    if (trimmed === '---') {
      flushCollect();
      pushThinker();
      i++; continue;
    }

    let m;

    if ((m = trimmed.match(/^FIELD:\s*(.*)/i))) {
      flushCollect(); result.field = m[1].trim(); i++; continue;
    }
    if ((m = trimmed.match(/^THINKER:\s*(.*)/i))) {
      flushCollect(); pushThinker();
      currentThinker = { name: m[1].trim(), born: '', formation: '', contribution: '', keyWorks: [], centralDebate: '', influence: '', criticism: '' };
      inKeyWorks = false;
      i++; continue;
    }
    if ((m = trimmed.match(/^BORN:\s*(.*)/i)) && currentThinker) {
      flushCollect(); inKeyWorks = false;
      currentThinker.born = m[1].trim();
      i++; continue;
    }
    if ((m = trimmed.match(/^FORMATION:\s*(.*)/i)) && currentThinker) {
      flushCollect(); inKeyWorks = false;
      if (m[1].trim()) currentThinker.formation = m[1].trim();
      else { collecting = 'formation'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^CONTRIBUTION:\s*(.*)/i)) && currentThinker) {
      flushCollect(); inKeyWorks = false;
      if (m[1].trim()) currentThinker.contribution = m[1].trim();
      else { collecting = 'contribution'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^KEY WORKS:/i)) && currentThinker) {
      flushCollect(); inKeyWorks = true; i++; continue;
    }
    if ((m = trimmed.match(/^CENTRAL DEBATE:\s*(.*)/i)) && currentThinker) {
      flushCollect(); inKeyWorks = false;
      if (m[1].trim()) currentThinker.centralDebate = m[1].trim();
      else { collecting = 'centralDebate'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^INFLUENCE:\s*(.*)/i)) && currentThinker) {
      flushCollect(); inKeyWorks = false;
      if (m[1].trim()) currentThinker.influence = m[1].trim();
      else { collecting = 'influence'; collectLines = []; }
      i++; continue;
    }
    if ((m = trimmed.match(/^CRITICISM:\s*(.*)/i)) && currentThinker) {
      flushCollect(); inKeyWorks = false;
      if (m[1].trim()) currentThinker.criticism = m[1].trim();
      else { collecting = 'criticism'; collectLines = []; }
      i++; continue;
    }

    if (currentThinker && inKeyWorks && trimmed.match(/^[-•]\s+/)) {
      currentThinker.keyWorks.push(trimmed.replace(/^[-•]\s+/, '').trim());
      i++; continue;
    }

    if (collecting && !trimmed.match(THINKER_KEYS)) {
      collectLines.push(trimmed);
    }

    i++;
  }

  flushCollect();
  pushThinker();

  return result;
}
