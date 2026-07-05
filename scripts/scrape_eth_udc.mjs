import { writeFileSync, readFileSync, existsSync } from 'fs';

const BASE     = 'https://eth-udk.library.ethz.ch/index/eng?page=';
const LAST_PAGE = 11539;
const BATCH     = 10;   // concurrent requests per batch
const DELAY     = 350;  // ms between batches
const CKPT      = 'scripts/.udc_checkpoint.json';

// UDC main class names
const MAIN_CLASSES = {
  '0': 'Science and Knowledge. Organization. Information. Documentation. Librarianship',
  '1': 'Philosophy. Psychology',
  '2': 'Religion. Theology',
  '3': 'Social Sciences',
  '5': 'Natural Sciences. Mathematics',
  '6': 'Applied Sciences. Medicine. Technology',
  '7': 'Arts. Recreation. Entertainment. Sport',
  '8': 'Linguistics. Language. Literature',
  '9': 'Geography. Biography. History',
};

// Accept only "clean" UDC main-table codes: digits with optional dots/hyphens
// Reject: geographic (xxx), language =, form (0xx), time "", special chars * % , /
function isAcademicCode(code) {
  if (!code || code.length === 0) return false;
  // Must start with a digit 0-9
  if (!/^\d/.test(code)) return false;
  // Must contain only digits and dots (simple decimal UDC)
  if (!/^\d+(\.\d+)*$/.test(code)) return false;
  // Reject codes starting with 4 (vacant class in modern UDC)
  if (code.startsWith('4')) return false;
  return true;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}${page}&index_id=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const items = [];
      for (const m of html.matchAll(
        /<div class="py-1[^"]*text-blue-600">([^<]+)<\/div>\s*<div class="py-1 ml-auto text-gray-900">([^<]*)<\/div>/g
      )) {
        const name = m[1].trim().replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        const code = m[2].trim();
        items.push({ name, code });
      }
      return items;
    } catch (e) {
      if (attempt < 2) await sleep(1000 * (attempt + 1));
      else process.stderr.write(` [err p${page}: ${e.message}]`);
    }
  }
  return [];
}

// ── Load checkpoint or start fresh ────────────────────────────────────────────
let allEntries = [];
let startPage  = 1;

if (existsSync(CKPT)) {
  const ckpt = JSON.parse(readFileSync(CKPT, 'utf8'));
  allEntries = ckpt.entries;
  startPage  = ckpt.nextPage;
  console.error(`Resuming from page ${startPage} (${allEntries.length} entries so far)`);
} else {
  console.error(`Starting fresh scrape of ${LAST_PAGE} pages…`);
}

// ── Scrape in batches ─────────────────────────────────────────────────────────
for (let p = startPage; p <= LAST_PAGE; p += BATCH) {
  const batch = Array.from({ length: Math.min(BATCH, LAST_PAGE - p + 1) }, (_, i) => p + i);
  const results = await Promise.all(batch.map(fetchPage));
  for (const items of results) allEntries.push(...items);

  if (p % 500 === 1 || p + BATCH > LAST_PAGE) {
    process.stderr.write(`\nPage ${p + BATCH - 1}/${LAST_PAGE} | total entries: ${allEntries.length}`);
    writeFileSync(CKPT, JSON.stringify({ entries: allEntries, nextPage: p + BATCH }));
  } else {
    process.stderr.write('.');
  }

  if (p + BATCH <= LAST_PAGE) await sleep(DELAY);
}

console.error(`\nScrape complete. Raw entries: ${allEntries.length}`);

// ── Filter to academic entries ────────────────────────────────────────────────
const academic = allEntries.filter(e => isAcademicCode(e.code));
console.error(`Academic (clean decimal UDC codes): ${academic.length}`);

// ── Deduplicate by (code + name) ─────────────────────────────────────────────
const seen   = new Set();
const unique = academic.filter(e => {
  const key = `${e.code}|||${e.name}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
console.error(`After dedup: ${unique.length}`);

// ── Build hierarchy ────────────────────────────────────────────────────────────
// Parent of a code: strip last segment
//   "511.37"  → "511.3"  (strip after last dot)   actually → "511" (strip after last dot entirely)
//   Wait: "511.3" → parent "511", "511" → "51", "51" → "5"
function getParent(code) {
  const dotIdx = code.lastIndexOf('.');
  if (dotIdx >= 0) return code.slice(0, dotIdx);
  if (code.length > 1) return code.slice(0, -1);
  return null;
}

// Build a map: code → { code, name (best label), children: Set, terms: [] }
const nodeMap = new Map();

function ensureNode(code) {
  if (!nodeMap.has(code)) {
    nodeMap.set(code, { code, name: '', children: new Set(), terms: [] });
    // Ensure ancestor chain
    const parent = getParent(code);
    if (parent) {
      ensureNode(parent);
      nodeMap.get(parent).children.add(code);
    }
  }
  return nodeMap.get(code);
}

// Add synthetic root nodes for main classes
for (const [digit, name] of Object.entries(MAIN_CLASSES)) {
  ensureNode(digit);
  nodeMap.get(digit).name = name;
}

// Add all academic entries
for (const { code, name } of unique) {
  const node = ensureNode(code);
  node.terms.push(name);
  // Use first term as node name if no better label yet
  if (!node.name) node.name = name;
}

// For nodes without a name, derive from the most common term prefix
for (const [code, node] of nodeMap) {
  if (!node.name && node.terms.length > 0) {
    // Pick the shortest / most general term as label
    const sorted = [...node.terms].sort((a, b) => a.length - b.length);
    node.name = sorted[0];
  }
  if (!node.name) node.name = code;
}

console.error(`Total nodes in tree: ${nodeMap.size}`);

// ── Serialize to JSON (depth-first, prune orphan single-term leaves if desired) ─
function serializeNode(code) {
  const node = nodeMap.get(code);
  if (!node) return null;
  const children = [...node.children]
    .sort()
    .map(c => serializeNode(c))
    .filter(Boolean);
  return {
    code,
    name: node.name,
    terms: node.terms.slice(0, 200), // cap terms per node to keep JSON sane
    children,
  };
}

// Build from top-level roots (single-digit codes that exist)
const roots = ['0','1','2','3','5','6','7','8','9']
  .filter(d => nodeMap.has(d))
  .map(d => serializeNode(d))
  .filter(Boolean);

// Count tree stats
let totalNodes = 0, totalTerms = 0;
function countTree(n) {
  totalNodes++;
  totalTerms += n.terms.length;
  n.children.forEach(countTree);
}
roots.forEach(countTree);
console.error(`Tree: ${roots.length} root classes | ${totalNodes} nodes | ${totalTerms} terms`);

writeFileSync('public/data/udc-full.json', JSON.stringify(roots));
console.error('Written → public/data/udc-full.json');
