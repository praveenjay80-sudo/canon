#!/usr/bin/env node
/**
 * Downloads the full OpenAlex concept hierarchy from Google Sheets
 * and writes a compact JSON to public/concept-hierarchy.json.
 *
 * Run: node scripts/build-concepts.mjs
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/1LBFHjPt4rj_9r0t0TTAlT68NwOtNH8Z21lBMsJDMoZg/export?format=csv&gid=575855905';
const OUT = 'public/concept-hierarchy.json';

function parseCSVLine(line) {
  const fields = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      fields.push(cur); cur = '';
    } else cur += ch;
  }
  fields.push(cur);
  return fields;
}

function sid(url) {
  const m = (url || '').trim().match(/[Cc](\d+)$/);
  return m ? `C${m[1]}` : '';
}

async function main() {
  console.log('Fetching OpenAlex concept hierarchy from Google Sheets…');
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const text = await res.text();

  const lines = text.split(/\r?\n/);
  const hdr = parseCSVLine(lines[0]);
  const iId      = hdr.indexOf('openalex_id');
  const iName    = hdr.indexOf('display_name');
  const iLevel   = hdr.indexOf('level');
  const iParents = hdr.indexOf('parent_ids');

  if (iId < 0 || iName < 0 || iLevel < 0) {
    throw new Error(`Unexpected CSV header: ${hdr.join(', ')}`);
  }

  const out = {};
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const f = parseCSVLine(raw);

    const id    = sid(f[iId]);
    const name  = (f[iName] || '').trim();
    const level = parseInt(f[iLevel], 10);
    const parentRaw = iParents >= 0 ? (f[iParents] || '') : '';
    const parents = parentRaw
      ? parentRaw.split(',').map(sid).filter(s => /^C\d+$/.test(s))
      : [];

    if (!id || !name || isNaN(level)) { skipped++; continue; }
    out[id] = { n: name, l: level, p: parents };
  }

  if (!existsSync('public')) await mkdir('public', { recursive: true });
  const json = JSON.stringify(out);
  await writeFile(OUT, json);

  const n = Object.keys(out).length;
  const dist = Object.values(out).reduce((acc, { l }) => {
    acc[l] = (acc[l] || 0) + 1;
    return acc;
  }, {});
  const distStr = Object.entries(dist)
    .sort(([a], [b]) => +a - +b)
    .map(([l, c]) => `L${l}: ${c.toLocaleString()}`)
    .join('  ');

  console.log(`\n✓ ${n.toLocaleString()} concepts written to ${OUT}`);
  console.log(`  ${(json.length / 1024 / 1024).toFixed(1)} MB on disk`);
  console.log(`  ${skipped} rows skipped`);
  console.log(`  Distribution: ${distStr}\n`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
