import { json, createLimiter, clientId, crossSite } from './api-guards.js'
import { financialHistory } from './financial-history.js'

const DAY = 86400000
const tickerKey = value => value.replaceAll('.', '-').toUpperCase()
export { financialHistory } from './financial-history.js'
export function annualFinancials(data, cik, now = Date.now()) { return financialHistory(data, cik, now).annual }

// SEC fair-access pacing is shared by financial requests in this instance.
let queue = Promise.resolve(), nextStart = 0
async function secJson(fetcher, url, signal) {
  const start = queue.then(async () => {
    const wait = Math.max(0, nextStart - Date.now())
    if (wait) await new Promise(resolve => setTimeout(resolve, wait))
    signal.throwIfAborted(); nextStart = Date.now() + 250
  })
  queue = start.catch(() => {})
  await start
  const response = await fetcher(url, { headers: { 'User-Agent': 'Anthracite yechan030102@gmail.com', Accept: 'application/json' }, signal, redirect: 'error' })
  if (!response.ok) throw Object.assign(new Error('SEC unavailable'), { status: response.status })
  return response.json()
}

export function createFinancialsHandler({ fetcher = fetch, now = Date.now } = {}) {
  let companies, companiesAt = 0, companyRequest
  const cache = new Map(), pending = new Map(), limit = createLimiter(30, 60000, now)
  async function collect(symbol) {
    const signal = AbortSignal.timeout(20000)
    if (!companies || now() - companiesAt >= DAY) {
      companyRequest ||= secJson(fetcher, 'https://www.sec.gov/files/company_tickers.json', signal).then(data => {
        if (!data || typeof data !== 'object' || !Object.values(data).some(row => typeof row?.ticker === 'string')) throw new Error('Invalid company list')
        companies = data; companiesAt = now()
      }).finally(() => { companyRequest = null })
      await companyRequest
    }
    const company = Object.values(companies).find(row => typeof row?.ticker === 'string' && tickerKey(row.ticker) === tickerKey(symbol))
    if (!company || !Number.isSafeInteger(company.cik_str) || company.cik_str <= 0) return { symbol, results: [], quarterly: [], ttm: [], source: 'SEC EDGAR', status: 'not_available', fetchedAt: now(), stale: false }
    const cik = String(company.cik_str).padStart(10, '0')
    let facts
    try { facts = await secJson(fetcher, `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, signal) }
    catch (error) { if (error.status === 404) return { symbol, results: [], quarterly: [], ttm: [], source: 'SEC EDGAR', cik, status: 'not_available', fetchedAt: now(), stale: false }; throw error }
    const history = financialHistory(facts, cik, now())
    return { symbol, results: history.annual, quarterly: history.quarterly, ttm: history.ttm, source: 'SEC EDGAR', cik, company: facts.entityName, fetchedAt: now(), stale: false, status: 'ok' }
  }
  return async request => {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' })
    if (crossSite(request)) return json({ error: 'Forbidden' }, 403)
    const params = new URL(request.url).searchParams, symbol = params.get('ticker')
    if (params.size !== 1 || params.getAll('ticker').length !== 1 || !/^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(symbol || '')) return json({ error: 'Invalid ticker' }, 400)
    if (!limit(clientId(request))) return json({ error: 'Too many requests' }, 429, { 'Retry-After': '60' })
    const previous = cache.get(symbol)
    if (previous && now() - previous.fetchedAt < 6 * 3600000) return json(previous, 200, { 'Cache-Control': 'public, s-maxage=3600' })
    try {
      if (!pending.has(symbol)) pending.set(symbol, collect(symbol).then(data => {
        if (cache.size >= 100) cache.delete(cache.keys().next().value)
        cache.set(symbol, data); return data
      }).finally(() => pending.delete(symbol)))
      return json(await pending.get(symbol), 200, { 'Cache-Control': 'public, s-maxage=3600' })
    } catch {
      if (previous && now() - previous.fetchedAt <= 7 * DAY) return json({ ...previous, stale: true }, 200)
      return json({ error: 'SEC financial statements temporarily unavailable', source: 'SEC EDGAR' }, 503)
    }
  }
}
