import { json, createLimiter, clientId, crossSite } from './api-guards.js'
import { parseQuote } from './market-indices.js'
export function parseTickers(value) {
  if (typeof value !== 'string' || value.length > 420) return null
  const rows = value.split(',')
  if (!rows.length || rows.length > 20 || rows.some(row => !/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(row))) return null
  return [...new Set(rows)]
}
export function createWatchlistHandler({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map()
  const limit = createLimiter(30, 60000, now)
  async function quote(ticker) {
    const cached = cache.get(ticker)
    if (cached && now() - cached.checkedAt < 120000) return cached
    if (pending.has(ticker)) return pending.get(ticker)
    const task = (async () => {
      try {
        const symbol = ticker.replaceAll('.', '-')
        const response = await fetchImpl(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`, { headers: { Accept: 'application/json', 'User-Agent': 'Anthracite/1.0' }, signal: AbortSignal.timeout(10000), redirect: 'error' })
        if (!response.ok) throw new Error('unavailable')
        const raw = await response.json()
        const meta = raw?.chart?.result?.[0]?.meta
        const parsed = parseQuote(meta, symbol, ticker)
        if (!parsed) throw new Error('invalid')
        const result = { ticker, price: parsed.price, changePercent: parsed.changePercent, asOf: parsed.asOf, currency: meta.currency || null, checkedAt: now(), stale: false }
        cache.delete(ticker); cache.set(ticker, result)
        if (cache.size > 500) cache.delete(cache.keys().next().value)
        return result
      } catch {
        if (cached && now() - cached.checkedAt < 24 * 3600000) return { ...cached, stale: true }
        return { ticker, price: null, changePercent: null, asOf: null, currency: null, checkedAt: null, stale: true }
      }
    })()
    pending.set(ticker, task)
    try { return await task } finally { pending.delete(ticker) }
  }
  return async req => {
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' })
    if (crossSite(req)) return json({ error: 'Forbidden' }, 403)
    const query = new URL(req.url).searchParams
    const tickers = parseTickers(query.get('tickers'))
    if (query.size !== 1 || !tickers) return json({ error: 'Provide up to 20 valid tickers' }, 400)
    if (!limit(clientId(req))) return json({ error: 'Too many requests' }, 429, { 'Retry-After': '60' })
    const quotes = []
    // Bound upstream concurrency even for a full saved list.
    for (let i = 0; i < tickers.length; i += 4) quotes.push(...await Promise.all(tickers.slice(i, i + 4).map(quote)))
    return json({ quotes, fetchedAt: now(), source: 'Yahoo Finance' })
  }
}
