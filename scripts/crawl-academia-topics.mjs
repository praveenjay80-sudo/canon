// Run: node scripts/crawl-academia-topics.mjs
// Scrapes academia.edu/topics 3 levels deep.
// L1: 25 disciplines → L2: subtopics → L3: sub-subtopics
// Outputs: src/constants/academiaTopics.js

import { execFile } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../src/constants/academiaTopics.js');
const BASE = 'https://www.academia.edu';
const DELAY_MS = 700;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetchPage(url, attempt = 0) {
  const fullUrl = url.startsWith('http') ? url : BASE + url;
  return new Promise((resolve, reject) => {
    execFile('curl', [
      '-s', '-L', '--compressed',
      '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '-H', 'Accept: text/html,application/xhtml+xml',
      '-H', 'Accept-Language: en-US,en;q=0.9',
      '--max-time', '30',
      fullUrl,
    ], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        if (attempt < 2) sleep(3000).then(() => fetchPage(url, attempt + 1)).then(resolve).catch(reject);
        else reject(err);
        return;
      }
      if (stdout.includes('HTTP 429') && attempt < 3) {
        sleep(5000 * (attempt + 1)).then(() => fetchPage(url, attempt + 1)).then(resolve).catch(reject);
        return;
      }
      resolve(stdout);
    });
  });
}

function parseTopics(html) {
  const results = [];
  const re = /<a[^>]+class="topic-card-link"[^>]+href="(?:https?:\/\/www\.academia\.edu)?\/Documents\/in\/([^"]+)"[^>]*>[\s\S]*?<div class="topic-name">([^<]+)<\/div>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].trim();
    const name = m[2].trim();
    if (slug && name) results.push({ slug, name });
  }
  return results;
}

async function main() {
  const t0 = Date.now();
  console.log('Academia.edu topic hierarchy — 3-level crawl\n');

  // Phase 1: L1 disciplines from /topics
  console.log('Phase 1: Fetching L1 disciplines...');
  const topicsHtml = await fetchPage('/topics');
  const l1Topics = parseTopics(topicsHtml);
  console.log(`  ${l1Topics.length} disciplines found`);

  const disciplines = l1Topics.map(t => t.name);
  const children = {};  // name → child name[]
  const slugs = {};     // name → slug (for academia.edu URLs)

  for (const t of l1Topics) slugs[t.name] = t.slug;

  // Phase 2: L2 subtopics
  console.log('\nPhase 2: Fetching L2 subtopics...');
  const l2All = [];
  for (let i = 0; i < l1Topics.length; i++) {
    const { slug, name } = l1Topics[i];
    await sleep(DELAY_MS);
    process.stdout.write(`\r  [${i + 1}/${l1Topics.length}] ${name.padEnd(35)}`);
    try {
      const html = await fetchPage(`/Documents/in/${slug}`);
      const kids = parseTopics(html);
      children[name] = kids.map(k => k.name);
      for (const k of kids) {
        slugs[k.name] = k.slug;
        l2All.push(k);
      }
    } catch (e) {
      process.stdout.write(` ERROR: ${e.message}`);
      children[name] = [];
    }
  }
  const l2Unique = [...new Map(l2All.map(t => [t.slug, t])).values()];
  console.log(`\n  ${l2Unique.length} unique L2 subtopics`);

  // Phase 3: L3 sub-subtopics
  console.log(`\nPhase 3: Fetching L3 sub-subtopics (${l2Unique.length} pages)...`);
  let l3Count = 0;
  for (let i = 0; i < l2Unique.length; i++) {
    const { slug, name } = l2Unique[i];
    await sleep(DELAY_MS);
    process.stdout.write(`\r  [${i + 1}/${l2Unique.length}] ${name.slice(0, 38).padEnd(40)} L3: ${l3Count.toLocaleString()}`);
    try {
      const html = await fetchPage(`/Documents/in/${slug}`);
      const kids = parseTopics(html);
      if (kids.length > 0) {
        children[name] = kids.map(k => k.name);
        for (const k of kids) slugs[k.name] = k.slug;
        l3Count += kids.length;
      }
    } catch (e) {
      // skip failed pages silently
    }
  }
  console.log(`\n  ${l3Count.toLocaleString()} L3 sub-subtopics collected`);

  // Total unique topics
  const allNames = new Set(disciplines);
  for (const [k, kids] of Object.entries(children)) {
    allNames.add(k);
    for (const kid of kids) allNames.add(kid);
  }
  const total = allNames.size;

  const elapsed = Math.round((Date.now() - t0) / 1000);
  console.log(`\nResults (${elapsed}s):`);
  console.log(`  L1 disciplines:      ${disciplines.length}`);
  console.log(`  L2 subtopics:        ${l2Unique.length.toLocaleString()}`);
  console.log(`  L3 sub-subtopics:    ${l3Count.toLocaleString()}`);
  console.log(`  Total unique topics: ${total.toLocaleString()}`);

  // Diff against existing data if it exists
  if (existsSync(OUT)) {
    try {
      const existing = readFileSync(OUT, 'utf8');
      const prevTotalMatch = existing.match(/Total topics: ([\d,]+)/);
      const prevTotal = prevTotalMatch ? parseInt(prevTotalMatch[1].replace(/,/g, ''), 10) : 0;
      const prevNames = new Set((existing.match(/"([^"]+)":/g) || []).map(s => s.slice(1, -2)));
      const newNames = allNames;
      const added = [...newNames].filter(n => !prevNames.has(n));
      const removed = [...prevNames].filter(n => !newNames.has(n) && n.length > 2);
      if (added.length || removed.length) {
        console.log(`\nChanges vs previous crawl:`);
        console.log(`  New topics:     +${added.length.toLocaleString()} (total: ${prevTotal.toLocaleString()} → ${total.toLocaleString()})`);
        if (removed.length) console.log(`  Removed topics: -${removed.length.toLocaleString()}`);
        if (added.length <= 20) added.forEach(n => console.log(`    + ${n}`));
      } else {
        console.log('\nNo changes detected vs previous crawl.');
      }
    } catch (_) {}
  }

  const crawlDate = new Date().toISOString();
  const output = `// Auto-generated by scripts/crawl-academia-topics.mjs — do not hand-edit
// Last crawled: ${crawlDate}
// Source: Academia.edu topic hierarchy — academia.edu/topics
// Total topics: ${total.toLocaleString()}

export const ACADEMIA_DISCIPLINES = ${JSON.stringify(disciplines, null, 2)};

export const ACADEMIA_CHILDREN = ${JSON.stringify(children, null, 2)};

export const ACADEMIA_SLUGS = ${JSON.stringify(slugs, null, 2)};

export const ACADEMIA_TOTAL = ${total};

export const ACADEMIA_CRAWL_DATE = "${crawlDate}";
`;

  writeFileSync(OUT, output, 'utf8');
  console.log(`\nWrote ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
