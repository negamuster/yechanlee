export interface StockMatch { ticker: string; name: string; primary_exchange?: string }
const TTL = 15 * 60000
const cache = new Map<string, { at: number; matches: StockMatch[] }>()
export function cachedSearch(query: string, now = Date.now()) {
  const key = query.trim().toLowerCase()
  const entry = cache.get(key)
  if (!entry || now < entry.at || now - entry.at >= TTL) { cache.delete(key); return undefined }
  return entry.matches
}
export async function searchStocks(query: string, signal: AbortSignal, fetcher = fetch, now = Date.now()) {
  const response = await fetcher(`/api/stock-data?search=${encodeURIComponent(query)}`, { signal })
  if (!response.ok) throw new Error('search unavailable')
  const data = await response.json()
  signal.throwIfAborted()
  if (!Array.isArray(data.results)) throw new Error('invalid search response')
  const matches: StockMatch[] = data.results.filter((row: StockMatch) => typeof row?.ticker === 'string'
    && /^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(row.ticker) && typeof row.name === 'string')
    .sort((a: StockMatch, b: StockMatch) => Number(b.ticker === query.toUpperCase()) - Number(a.ticker === query.toUpperCase())).slice(0, 8)
  if (cache.size >= 50) cache.delete(cache.keys().next().value!)
  cache.set(query.trim().toLowerCase(), { at: now, matches })
  return matches
}
