import { writeFileSync } from 'fs';

async function fetchWikitext() {
  const url = 'https://en.wikipedia.org/w/api.php?action=query&titles=Outline_of_academic_disciplines&prop=revisions&rvprop=content&format=json&rvslots=main';
  const r = await fetch(url, { headers: { 'User-Agent': 'Canon/1.0' } });
  const data = await r.json();
  const pages = data.query.pages;
  const page = Object.values(pages)[0];
  return page.revisions[0].slots.main['*'];
}

// Clean a wikitext token into plain text
function cleanName(raw) {
  // [[Display|Link]] → Display, [[Link]] → Link
  let s = raw.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2');
  s = s.replace(/\[\[([^\]]+)\]\]/g, '$1');
  // Remove (outline), (outline of X), etc.
  s = s.replace(/\s*\(\[\[Outline[^\)]*\]\]\)/gi, '');
  s = s.replace(/\s*\(outline[^)]*\)/gi, '');
  s = s.replace(/\s*\(outline\)/gi, '');
  // Remove refs and templates
  s = s.replace(/<ref[^>]*>.*?<\/ref>/gs, '');
  s = s.replace(/\{\{[^}]*\}\}/g, '');
  // Clean whitespace and trailing punctuation
  s = s.replace(/[,;]+$/, '').replace(/\s+/g, ' ').trim();
  return s;
}

function parseWikitext(text) {
  const lines = text.split('\n');
  const domains = [];
  let curDomain = null;
  let curGroup = null;
  let curField = null;

  for (const line of lines) {
    // == Domain ==
    const domainMatch = line.match(/^==\s*([^=]+?)\s*==$/);
    if (domainMatch) {
      const name = cleanName(domainMatch[1]);
      // Skip non-content sections
      if (['See also', 'References', 'External links', 'Notes', 'Bibliography'].includes(name)) {
        curDomain = null; curGroup = null; curField = null;
        continue;
      }
      curDomain = { name, groups: [] };
      domains.push(curDomain);
      curGroup = null; curField = null;
      continue;
    }
    if (!curDomain) continue;

    // === Group ===
    const groupMatch = line.match(/^===\s*([^=]+?)\s*===$/);
    if (groupMatch) {
      const name = cleanName(groupMatch[1]);
      curGroup = { name, fields: [] };
      curDomain.groups.push(curGroup);
      curField = null;
      continue;
    }

    // * Field (level 1 bullet)
    const fieldMatch = line.match(/^\*\s+(?!\*)(.+)/);
    if (fieldMatch && curGroup) {
      const name = cleanName(fieldMatch[1]);
      if (!name || name.length < 2) continue;
      curField = { name, subs: [] };
      curGroup.fields.push(curField);
      continue;
    }

    // ** Sub-field (level 2 bullet)
    const subMatch = line.match(/^\*\*\s+(?!\*)(.+)/);
    if (subMatch && curField) {
      const name = cleanName(subMatch[1]);
      if (!name || name.length < 2) continue;
      // Skip overly granular entries (very specific sub-sub things)
      curField.subs.push(name);
      continue;
    }
    // *** and deeper — skip (too granular)
  }

  return domains;
}

function countNodes(domains) {
  let groups = 0, fields = 0, subs = 0;
  for (const d of domains) {
    groups += d.groups.length;
    for (const g of d.groups) {
      fields += g.fields.length;
      for (const f of g.fields) subs += f.subs.length;
    }
  }
  return { domains: domains.length, groups, fields, subs };
}

const wikitext = await fetchWikitext();
console.error('Fetched wikitext, length:', wikitext.length);

const domains = parseWikitext(wikitext);
const counts = countNodes(domains);
console.error('Parsed:', JSON.stringify(counts));

// Print sample for verification
for (const d of domains.slice(0, 2)) {
  console.error(`\n[${d.name}]`);
  for (const g of d.groups.slice(0, 2)) {
    console.error(`  [${g.name}]`);
    for (const f of g.fields.slice(0, 4)) {
      console.error(`    ${f.name}${f.subs.length ? ' → ' + f.subs.slice(0,3).join(', ') : ''}`);
    }
  }
}

writeFileSync('public/data/knowledge-map.json', JSON.stringify(domains));
console.error('\nWritten to public/data/knowledge-map.json');
