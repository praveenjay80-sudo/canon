// UDC scraper — ETH-UDK library
// Usage: node scripts/scrape-udc.js
// Output: public/data/udc-codes.json

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'public', 'data', 'udc-codes.json');
const PROGRESS = join(__dir, '..', 'public', 'data', 'udc-progress.json');

const BASE = 'https://eth-udk.library.ethz.ch/index/udc?page=';
const LAST_PAGE = 9056;
const CONCURRENCY = 40;
const RETRY_MAX = 4;
const RETRY_DELAY_MS = 800;

// --- HTML parser (no deps) ---
const CODE_RE = /col-span-3[^>]*>([^<]+)<\/div>/g;
const LABEL_RE = /col-span-9[^>]*>([\s\S]*?)<\/div>/g;

function parsePage(html) {
  const entries = [];
  const codes = [...html.matchAll(CODE_RE)].map(m => m[1].trim());
  const labels = [...html.matchAll(LABEL_RE)].map(m => {
    const parts = m[1].split(/<br\s*\/?>/i);
    return {
      de: parts[0]?.trim() || '',
      en: parts[1]?.trim() || '',
      fr: parts[2]?.trim() || '',
    };
  });
  const n = Math.min(codes.length, labels.length);
  for (let i = 0; i < n; i++) {
    if (codes[i] && labels[i].en) {
      entries.push({ code: codes[i], label: labels[i].en, de: labels[i].de });
    }
  }
  return entries;
}

// --- fetch with retry ---
async function fetchPage(page, attempt = 0) {
  try {
    const res = await fetch(BASE + page, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parsePage(await res.text());
  } catch (e) {
    if (attempt >= RETRY_MAX) { console.error(`  FAILED page ${page}: ${e.message}`); return []; }
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    return fetchPage(page, attempt + 1);
  }
}

// --- concurrency pool ---
async function pool(tasks, limit) {
  const results = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

// --- main ---
const startTime = Date.now();
let done = 0;

// Load progress if resuming
let startPage = 1;
let all = [];
if (existsSync(PROGRESS)) {
  try {
    const prog = JSON.parse(readFileSync(PROGRESS, 'utf8'));
    startPage = prog.nextPage || 1;
    all = prog.entries || [];
    console.log(`Resuming from page ${startPage} (${all.length} entries already collected)`);
  } catch {}
}

console.log(`Scraping UDC pages ${startPage}–${LAST_PAGE} with concurrency=${CONCURRENCY}`);

const pages = [];
for (let p = startPage; p <= LAST_PAGE; p++) pages.push(p);

const BATCH = 500; // save progress every 500 pages
for (let b = 0; b < pages.length; b += BATCH) {
  const batch = pages.slice(b, b + BATCH);
  const tasks = batch.map(p => () => fetchPage(p));
  const results = await pool(tasks, CONCURRENCY);
  for (const r of results) all.push(...r);
  done += batch.length;
  const pct = ((startPage - 1 + done) / LAST_PAGE * 100).toFixed(1);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const rate = (done / ((Date.now() - startTime) / 1000)).toFixed(1);
  const eta = ((LAST_PAGE - startPage + 1 - done) / rate).toFixed(0);
  console.log(`  ${pct}% — ${all.length} entries — ${elapsed}s elapsed — ETA ${eta}s`);
  // Save progress
  writeFileSync(PROGRESS, JSON.stringify({ nextPage: startPage + done, entries: all }));
}

// Sort by code
all.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

writeFileSync(OUT, JSON.stringify(all, null, 0));
console.log(`\nDone! ${all.length} UDC entries → ${OUT}`);
// Clean up progress file
try { require('fs').unlinkSync(PROGRESS); } catch {}
