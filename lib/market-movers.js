const DAY = 86_400_000
// Exchange test issues can appear even in real consolidated daily aggregates.
// Nasdaq guidance: https://www.nasdaqtrader.com/MicroNews.aspx?id=ERA2016-5
const TEST_SYMBOLS = new Set(['ZVZZT', 'ZWZZT', 'ZXZZT', 'ZTEST'])
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0

// A completed calendar day in New York; never rank a partially populated day.
export function candidateDates(now = Date.now()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const midnight = Date.parse(`${today}T00:00:00Z`)
  return Array.from({ length: 14 }, (_, index) => new Date(midnight - (index + 1) * DAY))
    .filter(date => ![0, 6].includes(date.getUTCDay()))
    .map(date => date.toISOString().slice(0, 10))
}

export function rankMovers(latest, previous, limit = 10) {
  const prior = new Map(previous.map(row => [row.T, row.c]))
  const seen = new Set()
  const rows = latest.flatMap(row => {
    if (typeof row.T !== 'string' || !/^[A-Z0-9][A-Z0-9.\-]{0,15}$/.test(row.T)
      || seen.has(row.T) || TEST_SYMBOLS.has(row.T) || row.otc === true || !positive(row.c) || row.c < 1
      || !positive(row.v) || row.v < 10000) return []
    seen.add(row.T)
    const previousClose = prior.get(row.T)
    const change = positive(previousClose) ? (row.c / previousClose - 1) * 100 : null
    const turnover = positive(row.vw) ? row.vw * row.v : null
    return [{ ticker: row.T, price: row.c, volume: row.v,
      changePct: Number.isFinite(change) ? change : null,
      turnover: Number.isFinite(turnover) ? turnover : null }]
  })
  const tie = (a, b) => a.ticker.localeCompare(b.ticker)
  return {
    turnover: rows.filter(row => row.turnover !== null).sort((a, b) => b.turnover - a.turnover || tie(a, b)).slice(0, limit),
    gainers: rows.filter(row => row.changePct !== null && row.changePct > 0).sort((a, b) => b.changePct - a.changePct || tie(a, b)).slice(0, limit),
    losers: rows.filter(row => row.changePct !== null && row.changePct < 0).sort((a, b) => a.changePct - b.changePct || tie(a, b)).slice(0, limit),
  }
}

export async function collectMovers({ key, fetchImpl = fetch, now = Date.now(), signal } = {}) {
  if (!key) throw new Error('not_configured')
  const days = []
  for (const date of candidateDates(now)) {
    const response = await fetchImpl(`https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true&include_otc=false`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, signal,
    })
    // Do not silently skip a failed trading date and compare nonconsecutive sessions.
    if (!response.ok) throw new Error(response.status === 429 ? 'rate_limited' : 'provider_unavailable')
    const data = await response.json()
    if (data.status !== 'OK' && data.status !== 'DELAYED') throw new Error('provider_unavailable')
    if (!Array.isArray(data.results)) {
      if (data.resultsCount === 0 || data.queryCount === 0) continue
      throw new Error('invalid_response')
    }
    if (!data.results.length) continue // Weekend/holiday, not an upstream failure.
    days.push({ date, rows: data.results })
    if (days.length === 2) break
  }
  if (days.length < 2) throw new Error('insufficient_data')
  const rankings = rankMovers(days[0].rows, days[1].rows)
  if (!rankings.turnover.length) throw new Error('insufficient_data')
  return { version: 'daily-movers-v1', source: 'Polygon / Massive', currency: 'USD',
    session: 'completed_daily', tradingDate: days[0].date, previousTradingDate: days[1].date,
    fetchedAt: now, rankings }
}

export function createMoversHandler({ getKey = () => process.env.POLYGON_KEY || process.env.VITE_POLYGON_KEY,
  fetchImpl = fetch, now = Date.now, timeoutMs = 20000 } = {}) {
  let cached = null
  let inFlight = null
  let retryAfter = 0
  let lastError = 'unavailable'
  const ttl = 30 * 60 * 1000
  async function update() {
    const controller = new AbortController()
    let timer
    try {
      const result = await Promise.race([
        collectMovers({ key: getKey(), fetchImpl, now: now(), signal: controller.signal }),
        new Promise((_, reject) => { timer = setTimeout(() => {
          controller.abort(); reject(new Error('timeout'))
        }, timeoutMs) }),
      ])
      cached = result
      retryAfter = 0
    } catch (error) {
      const allowed = ['not_configured', 'rate_limited', 'provider_unavailable', 'invalid_response', 'insufficient_data', 'timeout']
      lastError = allowed.includes(error.message) ? error.message : 'unavailable'
      retryAfter = now() + 60000
    } finally { clearTimeout(timer) }
  }
  return async request => {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
    const fresh = cached && now() - cached.fetchedAt < ttl
    if (!fresh && now() >= retryAfter) {
      if (!inFlight) inFlight = update().finally(() => { inFlight = null })
      await inFlight
    }
    if (!cached || now() - cached.fetchedAt > 7 * DAY) {
      return Response.json({ error: lastError }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
    const stale = now() - cached.fetchedAt >= ttl
    return Response.json({ ...cached, stale }, { headers: {
      'Cache-Control': stale ? 'no-store' : 'public, max-age=0, s-maxage=300',
    } })
  }
}
