import { useState, useCallback, useRef, useEffect } from 'react';
import { parseTopSciExcel } from '../utils/topSciImport.js';
import { saveLocalDataset, getLocalDataset, listLocalDatasets, deleteLocalDataset, queryLocalDataset } from '../utils/topSciLocalDb.js';

const DEFAULT_FILTERS = {
  year: '2024',
  type: '',           // '' = single year, 'CAREER' = career
  sm_field: '',
  sm_subfield_1: '',
  sm_subfield_2: '',
  cntry: '',
  authfull: '',
  inst_name: '',
  sortBy: 'rank',
  sortDir: 'asc',
};

const PAGE_LIMIT = 25;

export function useTopScientists() {
  const [filters, setFiltersState] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'complete' | 'error'
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [capped, setCapped] = useState(false);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);
  const reqIdRef = useRef(0);

  // Tries the local IndexedDB import for this year/type when the live proxy
  // is unreachable — resilience against pasanhu.cn going away, not a
  // replacement for live data otherwise. Returns true if it served the query.
  const tryLocalFallback = useCallback(async (f, p, reqId) => {
    const local = await getLocalDataset(f.year, f.type).catch(() => null);
    if (!local) return false;
    if (reqId !== reqIdRef.current) return true;
    const data = queryLocalDataset(local, f, p, PAGE_LIMIT);
    setRows(data.rows);
    setCount(data.count);
    setCapped(data.capped);
    setOffline(true);
    setStatus('complete');
    return true;
  }, []);

  const runQuery = useCallback(async (f, p) => {
    const reqId = ++reqIdRef.current;
    setStatus('loading');
    setError(null);
    setOffline(false);
    try {
      const params = new URLSearchParams({
        year: f.year, type: f.type, sm_field: f.sm_field, sm_subfield_1: f.sm_subfield_1,
        sm_subfield_2: f.sm_subfield_2, cntry: f.cntry, authfull: f.authfull, inst_name: f.inst_name,
        sortBy: f.sortBy, sortDir: f.sortDir, page: String(p), limit: String(PAGE_LIMIT),
      });
      const res = await fetch(`/api/topsci/query?${params}`);
      const data = await res.json();
      if (reqId !== reqIdRef.current) return; // stale response — a newer query superseded this one
      if (!res.ok) {
        if (await tryLocalFallback(f, p, reqId)) return;
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setRows(data.rows);
      setCount(data.count);
      setCapped(data.capped);
      setStatus('complete');
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      if (await tryLocalFallback(f, p, reqId)) return;
      setError(e.message);
      setStatus('error');
    }
  }, [tryLocalFallback]);

  const load = useCallback(() => {
    runQuery(DEFAULT_FILTERS, 1);
  }, [runQuery]);

  const setFilters = useCallback((patch) => {
    setFiltersState(prev => {
      const next = { ...prev, ...patch };
      // Changing field resets subfield-1 (subfield-1 options are field-scoped);
      // any filter change resets to page 1.
      if ('sm_field' in patch && patch.sm_field !== prev.sm_field) next.sm_subfield_1 = '';
      setPage(1);
      runQuery(next, 1);
      return next;
    });
  }, [runQuery]);

  const goToPage = useCallback((p) => {
    setPage(p);
    runQuery(filters, p);
  }, [filters, runQuery]);

  const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'scanning' | 'done' | 'error'
  const [scanResult, setScanResult] = useState(null); // { candidateYear, newFields, newSubfields, newCountries }

  // Only the hardcoded year list and the one-time facets crawl can go stale —
  // the scientist rows themselves are always live. Self-heals into
  // localStorage (mirrors Academia's patch pattern) so a newly-detected year
  // or facet becomes selectable immediately, without waiting for a redeploy.
  const checkForUpdates = useCallback(async (knownYears, knownFields, knownSubfields, knownCountries) => {
    setScanStatus('scanning');
    try {
      const res = await fetch(`/api/topsci/check-updates?knownYears=${knownYears.join(',')}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      if (data.candidateYear) {
        const extra = JSON.parse(localStorage.getItem('topsci_extra_years') || '[]');
        if (!extra.includes(data.candidateYear)) {
          localStorage.setItem('topsci_extra_years', JSON.stringify([...extra, data.candidateYear]));
        }
      }
      const patchList = (key, known, found) => {
        const newOnes = found.filter(v => !known.includes(v));
        if (newOnes.length === 0) return newOnes;
        const extra = JSON.parse(localStorage.getItem(key) || '[]');
        const merged = [...new Set([...extra, ...newOnes])];
        localStorage.setItem(key, JSON.stringify(merged));
        return newOnes;
      };
      const newFields = patchList('topsci_extra_fields', knownFields, data.sampleFields);
      const newSubfields = patchList('topsci_extra_subfields', knownSubfields, data.sampleSubfields);
      const newCountries = patchList('topsci_extra_countries', knownCountries, data.sampleCountries);

      setScanResult({ candidateYear: data.candidateYear, newFields, newSubfields, newCountries });
      setScanStatus('done');
    } catch (e) {
      setScanStatus('error');
      setError(`Scan failed: ${e.message}`);
    }
  }, []);

  // ── Excel import (resilience fallback) ──────────────────────────────────
  const [importedDatasets, setImportedDatasets] = useState([]);
  const [importStatus, setImportStatus] = useState('idle'); // 'idle' | 'importing' | 'error'
  const [importError, setImportError] = useState(null);

  const refreshImportedDatasets = useCallback(() => {
    listLocalDatasets().then(setImportedDatasets).catch(() => {});
  }, []);

  useEffect(() => { refreshImportedDatasets(); }, [refreshImportedDatasets]);

  const importFile = useCallback(async (file) => {
    setImportStatus('importing');
    setImportError(null);
    try {
      const { year, type, rows: parsed, count: n } = await parseTopSciExcel(file);
      if (n === 0) throw new Error('No usable rows found in this file');
      await saveLocalDataset(year, type, parsed, file.name);
      refreshImportedDatasets();
      // A successfully-imported year is real data, whether or not it's
      // confirmed live yet — self-heal it into the Year dropdown the same
      // way checkForUpdates does, so it's selectable immediately.
      const extraYears = JSON.parse(localStorage.getItem('topsci_extra_years') || '[]');
      if (!extraYears.includes(year)) {
        localStorage.setItem('topsci_extra_years', JSON.stringify([...extraYears, year]));
      }
      setImportStatus('idle');
      return { year, type, count: n };
    } catch (e) {
      setImportError(e.message);
      setImportStatus('error');
      throw e;
    }
  }, [refreshImportedDatasets]);

  const removeImport = useCallback(async (year, type) => {
    await deleteLocalDataset(year, type);
    refreshImportedDatasets();
  }, [refreshImportedDatasets]);

  return {
    filters, page, status, rows, count, capped, error, offline,
    pageLimit: PAGE_LIMIT, totalPages: Math.max(1, Math.ceil(count / PAGE_LIMIT)),
    load, setFilters, goToPage,
    scanStatus, scanResult, checkForUpdates,
    importedDatasets, importStatus, importError, importFile, removeImport,
  };
}
