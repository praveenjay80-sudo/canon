import * as XLSX from 'xlsx';

// Column naming from the official Ioannidis "World's Top 2% Scientists"
// dataset (Mendeley Data 10.17632/btchxktzyw) — the same schema pasanhu.cn's
// live API mirrors (see server.js's pasanhuMetricColumns()). Year and type
// are read straight off the headers rather than asked from the user: the
// h-index column carries the year ("h24 (ns)" -> 2024), and which citation
// column exists tells single-year ("nc2424 (ns)") from career ("nc9624 (ns)").
function detectYearAndType(headers) {
  const hHeader = headers.find(h => /^h\d{2} \(ns\)$/.test(h));
  if (!hHeader) return null;
  const yy = hHeader.match(/^h(\d{2}) \(ns\)$/)[1];
  const year = String(2000 + parseInt(yy, 10));
  const singleYearCol = `nc${yy}${yy} (ns)`;
  const careerCol = `nc96${yy} (ns)`;
  let type = null, ncCol = null;
  if (headers.includes(singleYearCol)) { type = ''; ncCol = singleYearCol; }
  else if (headers.includes(careerCol)) { type = 'CAREER'; ncCol = careerCol; }
  if (type === null) return null;
  return { year, type, ncCol, hCol: hHeader, hmCol: `hm${yy} (ns)`, papersCol: `np60${yy}` };
}

function toNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// Array-mode extraction (header row + raw arrays) avoids re-allocating a
// property-keyed object per row — meaningfully faster than sheet_to_json's
// default object mode at the scale these files run (200k+ rows). The
// workbook decode itself (XLSX.read) dominates total time regardless
// (confirmed: ~3 minutes for a 96MB file) and can't be sped up this way,
// but this part of it can.
export async function parseTopSciExcel(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', dense: true });
  const sheetName = wb.SheetNames.includes('Data') ? 'Data' : wb.SheetNames[wb.SheetNames.length - 1];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error('No readable sheet found in this file');

  const table = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (table.length < 2) throw new Error('No data rows found');

  const headers = table[0];
  const detected = detectYearAndType(headers);
  if (!detected) {
    throw new Error('Could not identify this as a World\'s Top 2% Scientists file — expected a column like "h24 (ns)" plus a matching citation column');
  }
  const { year, type, ncCol, hCol, hmCol, papersCol } = detected;

  const idx = (name) => headers.indexOf(name);
  const iAuth = idx('authfull'), iInst = idx('inst_name'), iCntry = idx('cntry');
  const iField = idx('sm-field'), iSf1 = idx('sm-subfield-1'), iSf2 = idx('sm-subfield-2');
  const iRank = idx('rank (ns)'), iNc = idx(ncCol), iH = idx(hCol), iHm = idx(hmCol);
  const iPapers = idx(papersCol), iComposite = idx('c (ns)'), iSelfpct = idx('self%');

  const rows = [];
  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    const authfull = row[iAuth];
    if (!authfull) continue;
    rows.push({
      id: rows.length + 1,
      authfull: String(authfull),
      inst_name: row[iInst] ? String(row[iInst]) : '',
      cntry: row[iCntry] ? String(row[iCntry]).toLowerCase() : '',
      field: row[iField] ? String(row[iField]) : '',
      subfield1: row[iSf1] ? String(row[iSf1]) : '',
      subfield2: row[iSf2] ? String(row[iSf2]) : '',
      rank: toNum(row[iRank]),
      citations: toNum(row[iNc]),
      hindex: toNum(row[iH]),
      hmindex: toNum(row[iHm]),
      papers: toNum(row[iPapers]),
      composite: toNum(row[iComposite]),
      selfpct: toNum(row[iSelfpct]),
    });
  }

  return { year, type, rows, count: rows.length };
}
