import type { SavedStock } from './savedItems'
export type Quote = { ticker: string; price: number | null; changePercent: number | null; asOf: string | null; currency: string | null; checkedAt: number | null; stale: boolean }
export type Sort = 'saved' | 'name' | 'change'
export function sortStocks(stocks: SavedStock[], quotes: Record<string, Quote>, sort: Sort) {
  return [...stocks].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.ticker.localeCompare(b.ticker)
    if (sort === 'change') {
      const av = quotes[a.ticker]?.changePercent, bv = quotes[b.ticker]?.changePercent
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return bv - av
    }
    return 0
  })
}
export function isQuotes(value: unknown): value is { quotes: Quote[] } {
  const data = value as { quotes?: Quote[] } | null
  return !!data && Array.isArray(data.quotes) && data.quotes.every(q => typeof q.ticker === 'string' && (q.price === null || Number.isFinite(q.price)) && (q.changePercent === null || Number.isFinite(q.changePercent)))
}
export function isWebUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
