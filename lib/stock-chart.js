import { json, createLimiter, clientId, crossSite } from './api-guards.js'
import { nyDate } from './trading-session.js'
import { CHART_PERIODS } from './stock-chart-periods.js'

export { CHART_PERIODS }
export function chartQuery(period, now = Date.now()) {
  if (!CHART_PERIODS.includes(period)) throw new Error('Invalid period')
  const query = new URLSearchParams({ interval: period === '1D' ? '5m' : period === '5D' ? '30m' : ['5Y', 'ALL'].includes(period) ? '1wk' : '1d', includePrePost: 'false', events: 'splits' })
  if (period === 'ALL' || period === 'YTD') {
    query.set('period1', period === 'ALL' ? '0' : String(Date.UTC(Number(nyDate(now).slice(0, 4)) - 1, 11, 20) / 1000))
    query.set('period2', String(Math.floor(now / 1000)))
  } else query.set('range', { '1D': '1d', '5D': '1mo', '1M': '1mo', '6M': '6mo', '1Y': '1y', '5Y': '5y' }[period])
  return query
}

export function parseStockChart(result, symbol, period, now = Date.now()) {
  const meta = result?.meta, prices = result?.indicators?.quote?.[0]?.close
  if (meta?.symbol !== symbol || !/^[A-Z]{3}$/.test(meta.currency || '') || !Array.isArray(result?.timestamp) || !Array.isArray(prices)) throw new Error('Invalid chart response')
  const records = new Map()
  result.timestamp.forEach((time, index) => {
    const t = time * 1000, c = prices[index]
    if (Number.isFinite(t) && t > 0 && t <= now && Number.isFinite(c) && c > 0) records.set(t, { t, c })
  })
  let points = [...records.values()].sort((a, b) => a.t - b.t)
  if (points.length > 15000) throw new Error('Chart response too large')
  let baseline = null
  if (period === '1D') {
    const lastDate = points.length ? nyDate(points.at(-1).t) : null
    points = points.filter(point => nyDate(point.t) === lastDate)
    const previous = meta.previousClose ?? meta.chartPreviousClose
    if (Number.isFinite(previous) && previous > 0) baseline = { c: previous, label: '전 거래일 종가 대비' }
  } else if (period === '5D') {
    const dates = [...new Set(points.map(point => nyDate(point.t)))].slice(-5)
    points = points.filter(point => dates.includes(nyDate(point.t)))
  } else if (period === 'YTD') {
    const year = nyDate(now).slice(0, 4)
    const previous = points.findLast(point => nyDate(point.t) < `${year}-01-01`)
    points = points.filter(point => nyDate(point.t) >= `${year}-01-01`)
    if (previous && nyDate(previous.t).slice(0, 4) === String(Number(year) - 1) && Date.parse(`${year}-01-01`) - Date.parse(nyDate(previous.t)) <= 7 * 86400000) baseline = { ...previous, label: '전년도 마지막 확인 종가 대비' }
  }
  if (!baseline && points.length > 1) baseline = { ...points[0], label: period === 'YTD' ? '확인 가능한 첫 가격 대비 · 전년 말 종가 미제공' : '표시 기간 첫 가격 대비' }
  const last = points.at(-1), changePercent = last && baseline ? (last.c / baseline.c - 1) * 100 : null
  return { symbol, period, points, baseline, changePercent, currency: meta.currency, interval: meta.dataGranularity || chartQuery(period, now).get('interval'), source: 'Yahoo Finance', fetchedAt: now, stale: false }
}

export function createStockChartHandler({ fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map(), limit = createLimiter(120, 60000, now)
  return async request => {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' })
    if (crossSite(request)) return json({ error: 'Forbidden' }, 403)
    const params = new URL(request.url).searchParams, symbol = params.get('ticker'), period = params.get('period')
    if (params.size !== 2 || params.getAll('ticker').length !== 1 || params.getAll('period').length !== 1 || !/^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(symbol || '') || !CHART_PERIODS.includes(period)) return json({ error: 'Invalid chart request' }, 400)
    if (!limit(clientId(request))) return json({ error: 'Too many requests' }, 429, { 'Retry-After': '60' })
    const key = `${symbol}:${period}`, previous = cache.get(key)
    if (previous && now() - previous.fetchedAt < 60000) return json(previous, 200, { 'Cache-Control': 'public, s-maxage=60' })
    try {
      if (!pending.has(key)) pending.set(key, (async () => {
        // Yahoo uses a dash for class shares (e.g. BRK.B -> BRK-B).
        const yahooSymbol = symbol.replaceAll('.', '-')
        const response = await fetcher(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?${chartQuery(period, now())}`, {
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(18000),
        })
        if (!response.ok) throw new Error('Chart unavailable')
        const body = await response.json(), result = body?.chart?.result?.[0]
        if (body?.chart?.error) throw new Error('Chart unavailable')
        const data = parseStockChart(result, yahooSymbol, period, now())
        data.symbol = symbol
        if (cache.size >= 120) cache.delete(cache.keys().next().value)
        cache.set(key, data); return data
      })().finally(() => pending.delete(key)))
      return json(await pending.get(key), 200, { 'Cache-Control': 'public, s-maxage=60' })
    } catch {
      if (previous && now() - previous.fetchedAt <= 6 * 3600000) return json({ ...previous, stale: true }, 200)
      return json({ error: 'Price chart temporarily unavailable' }, 503)
    }
  }
}
