export const COMPANY_MAP_URL = 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=largest_market_cap&count=100'
const exchanges = new Set(['NYQ', 'NMS', 'NGM', 'NCM'])
const number = value => typeof value === 'number' && Number.isFinite(value)
export function parseCompanyMap(payload, metadata, fetchedAt, now = Date.now()) {
  const result = payload?.finance?.result?.[0]
  if (!result || !Array.isArray(result.quotes) || result.quotes.length > 100 || result.quotes.length < 1
    || result.criteriaMeta?.sortField !== 'intradaymarketcap' || result.criteriaMeta?.sortType?.toUpperCase() !== 'DESC') throw new Error('Invalid market-cap screen')
  const companies = new Map()
  let excluded = 0
  for (const quote of result.quotes) {
    const symbol = quote.symbol
    if (!/^[A-Z][A-Z0-9]{0,5}(?:-[AB])?$/.test(symbol) || !exchanges.has(quote.exchange) || quote.quoteType !== 'EQUITY'
      || quote.currency !== 'USD' || !number(quote.marketCap) || quote.marketCap <= 0 || !number(quote.regularMarketTime)
      || quote.regularMarketTime * 1000 > now + 30000 || quote.regularMarketTime * 1000 < Date.parse('2000-01-01')) { excluded++; continue }
    const meta = metadata.companies[symbol] ?? {}
    const identity = meta.issuer ?? symbol
    const row = { symbol, name: meta.name ?? quote.longName ?? quote.shortName ?? symbol, sector: meta.sector ?? 'unknown',
      marketCap: quote.marketCap, changePercent: number(quote.regularMarketChangePercent) ? quote.regularMarketChangePercent : null,
      quoteAt: new Date(quote.regularMarketTime * 1000).toISOString() }
    if (typeof row.name !== 'string' || row.name.length > 200) { excluded++; continue }
    const previous = companies.get(identity)
    if (!previous || symbol === meta.preferred) companies.set(identity, row)
    if (previous) excluded++
  }
  const rows = [...companies.values()].sort((a, b) => b.marketCap - a.marketCap || a.symbol.localeCompare(b.symbol))
  if (!rows.length) throw new Error('No usable company values')
  return { version: 1, companies: rows, fetchedAt, source: 'Yahoo Finance', sourceUrl: 'https://finance.yahoo.com/research-hub/screener/largest_market_cap/',
    sourceCount: result.quotes.length, excluded, stale: false, classificationAt: metadata.checkedAt }
}
export function validCompanyMap(data) {
  return data?.version === 1 && Array.isArray(data.companies) && data.companies.length > 0 && data.companies.length <= 100
    && Number.isFinite(Date.parse(data.fetchedAt)) && data.sourceCount <= 100 && data.sourceCount >= data.companies.length
    && new Set(data.companies.map(c => c.symbol)).size === data.companies.length
    && data.companies.every(c => /^[A-Z][A-Z0-9]{0,5}(?:-[AB])?$/.test(c.symbol) && typeof c.name === 'string' && c.name.length > 0 && c.name.length <= 200
      && typeof c.sector === 'string' && number(c.marketCap) && c.marketCap > 0 && (c.changePercent === null || number(c.changePercent)) && Number.isFinite(Date.parse(c.quoteAt)))
}
export function createCompanyMapHandler({ metadata, snapshot, fetcher = fetch, now = Date.now } = {}) {
  let cache, pending, lastAttempt = -Infinity
  const fallback = () => {
    const previous = cache?.data ?? snapshot
    return validCompanyMap(previous) ? { ...previous, stale: true, sourceError: true } : null
  }
  async function collect() {
    lastAttempt = now()
    try {
      const response = await fetcher(COMPANY_MAP_URL, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
      if (!response.ok) throw new Error('Source unavailable')
      const bytes = await response.text()
      if (bytes.length > 2_000_000) throw new Error('Source too large')
      const data = parseCompanyMap(JSON.parse(bytes), metadata, new Date(now()).toISOString(), now())
      cache = { data, at: now() }; return data
    } catch { return fallback() }
  }
  return async request => {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
    const data = cache && now() - cache.at < 300000 ? cache.data : pending ? await pending : now() - lastAttempt < 60000 ? fallback() : await (pending = collect().finally(() => { pending = null }))
    if (!data) return Response.json({ error: 'Company map unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    return Response.json(data, { headers: { 'Cache-Control': data.stale ? 'no-store' : 'public, s-maxage=300' } })
  }
}
