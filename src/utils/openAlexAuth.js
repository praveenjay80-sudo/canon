// OpenAlex moved to a credit-based rate limit in 2026 — keyless/mailto-only
// requests get throttled to near-zero almost immediately. A free API key
// (openalex.org/settings/api) unlocks the real $1/day free quota.
export function openAlexAuth() {
  const key = (localStorage.getItem('canon_openalex_key') || '').trim();
  return key ? `&api_key=${encodeURIComponent(key)}` : '';
}
