/**
 * Stub web-search results. This is the "service" the provider sells.
 *
 * The point of the tutorial is the payment + key-provisioning flow,
 * not the search quality — so results are deterministic placeholders
 * that vary by query so output looks plausible during the demo.
 */

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

const SNIPPETS = [
  'Comprehensive overview from a high-traffic source.',
  'In-depth analysis published last quarter.',
  'Quick reference guide with worked examples.',
  'Long-form essay arguing the opposite position.',
  'Primary-source documentation, regularly updated.',
]

export function stubSearch(query: string, limit = 5): SearchResult[] {
  const safe = query.trim() || 'untitled'
  return Array.from({ length: limit }, (_, i) => ({
    title: `${safe} — result ${i + 1}`,
    url: `https://example.com/${encodeURIComponent(safe.toLowerCase())}/${i + 1}`,
    snippet: SNIPPETS[i % SNIPPETS.length],
  }))
}
