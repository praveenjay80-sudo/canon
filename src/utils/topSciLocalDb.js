// IndexedDB store for imported World's Top 2% Scientists datasets — files
// run into the hundreds of thousands of rows, far past localStorage's ~5MB
// limit. Used as a fallback when the live pasanhu.cn proxy is unreachable.

const DB_NAME = 'topsci_local';
const DB_VERSION = 1;
const STORE = 'datasets';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function keyFor(year, type) {
  return `${year}::${type || 'single'}`;
}

export async function saveLocalDataset(year, type, rows, sourceName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      key: keyFor(year, type), year, type, rows,
      count: rows.length, sourceName, importedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalDataset(year, type) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(keyFor(year, type));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function listLocalDatasets() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).map(d => ({
      year: d.year, type: d.type, count: d.count, sourceName: d.sourceName, importedAt: d.importedAt,
    })));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalDataset(year, type) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(keyFor(year, type));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Client-side equivalent of server.js's filter+sort+paginate, run against a
// locally-imported dataset when the live query can't reach pasanhu.cn.
export function queryLocalDataset(dataset, filters, page, limit) {
  let rows = dataset.rows;
  const { sm_field, sm_subfield_1, sm_subfield_2, cntry, authfull, inst_name, sortBy, sortDir } = filters;

  if (sm_field) rows = rows.filter(r => r.field === sm_field);
  if (sm_subfield_1) rows = rows.filter(r => r.subfield1 === sm_subfield_1);
  if (sm_subfield_2) rows = rows.filter(r => r.subfield2 === sm_subfield_2);
  if (cntry) rows = rows.filter(r => r.cntry === cntry);
  if (authfull) {
    const q = authfull.toLowerCase();
    rows = rows.filter(r => r.authfull.toLowerCase().includes(q));
  }
  if (inst_name) {
    const q = inst_name.toLowerCase();
    rows = rows.filter(r => (r.inst_name || '').toLowerCase().includes(q));
  }

  const metricKey = sortBy || 'rank';
  const effectiveDir = sortDir === 'desc' ? 'desc' : 'asc';
  const sorted = [...rows].sort((a, b) => {
    const av = a[metricKey], bv = b[metricKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return effectiveDir === 'desc' ? bv - av : av - bv;
  });

  const start = (page - 1) * limit;
  return { count: sorted.length, page, limit, rows: sorted.slice(start, start + limit), capped: false, offline: true };
}
