import { useState, useCallback, useRef } from 'react';

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
  const reqIdRef = useRef(0);

  const runQuery = useCallback(async (f, p) => {
    const reqId = ++reqIdRef.current;
    setStatus('loading');
    setError(null);
    try {
      const params = new URLSearchParams({
        year: f.year, type: f.type, sm_field: f.sm_field, sm_subfield_1: f.sm_subfield_1,
        sm_subfield_2: f.sm_subfield_2, cntry: f.cntry, authfull: f.authfull, inst_name: f.inst_name,
        sortBy: f.sortBy, sortDir: f.sortDir, page: String(p), limit: String(PAGE_LIMIT),
      });
      const res = await fetch(`/api/topsci/query?${params}`);
      const data = await res.json();
      if (reqId !== reqIdRef.current) return; // stale response — a newer query superseded this one
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRows(data.rows);
      setCount(data.count);
      setCapped(data.capped);
      setStatus('complete');
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      setError(e.message);
      setStatus('error');
    }
  }, []);

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

  return {
    filters, page, status, rows, count, capped, error,
    pageLimit: PAGE_LIMIT, totalPages: Math.max(1, Math.ceil(count / PAGE_LIMIT)),
    load, setFilters, goToPage,
  };
}
