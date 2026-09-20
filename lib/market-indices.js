// Same instrument universe as Neuberg's /stocks/indices; independent implementation.
export const INDICES = [
  ['^GSPC', 'S&P 500'], ['^DJI', 'Dow Jones'], ['^IXIC', 'NASDAQ'],
  ['^RUT', 'Russell 2000'], ['^VIX', 'VIX'], ['^FTSE', 'FTSE 100'],
  ['^N225', 'Nikkei 225'], ['^HSI', 'Hang Seng'], ['^GDAXI', 'DAX'],
  ['^FCHI', 'CAC 40'], ['000001.SS', 'Shanghai'], ['^BSESN', 'Sensex'],
  ['^AXJO', 'ASX 200'], ['^KS11', 'KOSPI'], ['^GSPTSE', 'TSX'],
  ['GC=F', 'Gold Futures'], ['CL=F', 'WTI Futures'], ['BTC-USD', 'Bitcoin'],
  ['DX-Y.NYB', 'US Dollar Index'],
]
export function parseQuote(meta, symbol, label) {
  if (meta?.symbol !== symbol || !Number.isFinite(meta.regularMarketPrice) || meta.regularMarketPrice <= 0
    || !Number.isFinite(meta.regularMarketTime) || meta.regularMarketTime <= 0) return null
  const previous = meta.previousClose ?? meta.chartPreviousClose
  return { symbol, label, price: meta.regularMarketPrice,
    changePercent: Number.isFinite(previous) && previous > 0 ? (meta.regularMarketPrice / previous - 1) * 100 : null,
    asOf: new Date(meta.regularMarketTime * 1000).toISOString(),
    unit: symbol.startsWith('^') || ['000001.SS', 'DX-Y.NYB'].includes(symbol) ? 'pt' : meta.currency || '', status: 'ok' }
}
export function createIndicesHandler({ fetcher = fetch, now = Date.now } = {}) {
  let cache, pending
  async function collect() {
    const quotes = await Promise.all(INDICES.map(async ([symbol, label]) => {
      try {
        const response = await fetcher(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`,
          { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(18000) })
        if (!response.ok) throw new Error('Unavailable')
        const data = await response.json()
        const quote = parseQuote(data?.chart?.result?.[0]?.meta, symbol, label)
        if (quote) return quote
      } catch { /* Preserve the instrument position, never invent a quote. */ }
      return { symbol, label, price: null, changePercent: null, asOf: null, unit: '', status: 'unavailable' }
    }))
    cache = { quotes, fetchedAt: now() }
    return cache
  }
  return async request => {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
    if (!cache || now() - cache.fetchedAt >= 60000) {
      pending ||= collect().finally(() => { pending = null })
      await pending
    }
    const ok = cache.quotes.some(q => q.status === 'ok')
    return Response.json(cache, { status: ok ? 200 : 503, headers: { 'Cache-Control': ok ? 'public, s-maxage=60' : 'no-store' } })
  }
}
