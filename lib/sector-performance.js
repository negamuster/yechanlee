// Independent implementation: fixed ETF universe, daily closing prices, no synthetic data.
export const SECTORS = [
  ['XLK', '정보기술'], ['XLF', '금융'], ['XLV', '헬스케어'], ['XLY', '경기소비재'],
  ['XLP', '필수소비재'], ['XLE', '에너지'], ['XLI', '산업재'], ['XLB', '소재'],
  ['XLRE', '부동산'], ['XLC', '커뮤니케이션'], ['XLU', '유틸리티'],
]
export const PERIODS = ['1d', '1w', '1m', 'ytd']
const DAY = 86400000
export function parseHistory(result, symbol, now = Date.now()) {
  if (result?.meta?.symbol !== symbol || result.meta.currency !== 'USD') return []
  const end = result.meta.currentTradingPeriod?.regular?.end
  const currentDate = new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const points = new Map()
  for (const [i, ts] of (result.timestamp || []).entries()) {
    const price = result.indicators?.quote?.[0]?.close?.[i]
    if (!Number.isFinite(ts) || ts * 1000 > now || !Number.isFinite(price) || price <= 0) continue
    const date = new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    // Do not mix an unfinished daily candle with completed historical sessions.
    if (date === currentDate && (!Number.isFinite(end) || now < (end + 900) * 1000)) continue
    points.set(date, price)
  }
  return [...points].map(([date, price]) => ({ date, price })).sort((a, b) => a.date.localeCompare(b.date))
}
export function compareSeries(series, benchmark) {
  const prices = new Map(series.map(p => [p.date, p.price]))
  const last = benchmark.at(-1)
  const returns = {}, relative = {}, starts = {}
  for (const period of PERIODS) {
    let base
    if (last) {
      const target = period === 'ytd' ? `${Number(last.date.slice(0, 4)) - 1}-12-31`
        : new Date(Date.parse(last.date) - (period === '1w' ? 7 : 30) * DAY).toISOString().slice(0, 10)
      base = period === '1d' ? benchmark.at(-2) : benchmark.findLast(p => p.date <= target)
      // Avoid treating a distant stale observation as the requested period boundary.
      if (period !== '1d' && base && Date.parse(target) - Date.parse(base.date) > 7 * DAY) base = undefined
    }
    const start = base && prices.get(base.date), finish = last && prices.get(last.date)
    returns[period] = start && finish ? (finish / start - 1) * 100 : null
    relative[period] = returns[period] === null ? null : returns[period] - (last.price / base.price - 1) * 100
    starts[period] = base?.date ?? null
  }
  return { returns, relative, starts, asOf: last && prices.has(last.date) ? last.date : null }
}
export function createSectorHandler({ fetcher = fetch, now = Date.now } = {}) {
  let cache, pending
  async function collect() {
    const entries = await Promise.all([...SECTORS, ['SPY', 'S&P 500 (SPY)']].map(async ([symbol, name]) => {
      try {
        const response = await fetcher(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=2y&interval=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(15000),
        })
        if (!response.ok) throw new Error('Unavailable')
        const data = await response.json()
        return { symbol, name, history: parseHistory(data?.chart?.result?.[0], symbol, now()) }
      } catch { return { symbol, name, history: [] } }
    }))
    const spy = entries.at(-1)
    const benchmark = { symbol: spy.symbol, name: spy.name, ...compareSeries(spy.history, spy.history) }
    const sectors = entries.slice(0, -1).map(({ symbol, name, history }) => ({ symbol, name, ...compareSeries(history, spy.history) }))
    const usable = sectors.some(s => s.returns['1d'] !== null)
    if (!usable && cache) return { ...cache.data, stale: true }
    const data = { sectors, benchmark, fetchedAt: new Date(now()).toISOString(), stale: false,
      source: 'Yahoo Finance', basis: 'USD · 일별 종가 · 배당 미포함 가격수익률' }
    if (usable) cache = { data, at: now() }
    return data
  }
  return async request => {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
    let data = cache?.data
    if (!cache || now() - cache.at >= 300000) {
      pending ||= collect().finally(() => { pending = null })
      data = await pending
    }
    const usable = data.sectors.some(s => s.returns['1d'] !== null)
    return Response.json(data, { status: usable ? 200 : 503, headers: {
      'Cache-Control': usable && !data.stale ? 'public, s-maxage=300' : 'no-store',
    } })
  }
}
