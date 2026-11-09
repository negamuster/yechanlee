import { json, createLimiter, clientId, crossSite } from './api-guards.js'
import { financialHistory } from './financial-history.js'
import { sourceFailure, retryDeadline } from './source-retry.js'
import { financialSnapshotRecord, SEC_TICKERS_URL, factsUrl, FINANCIAL_RETENTION } from './sec-financial-snapshot.js'

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
  if (!response.ok) {
    void response.body?.cancel().catch(() => {})
    throw Object.assign(sourceFailure(`http_${response.status}`, response.headers.get('retry-after')), { status: response.status })
  }
  try { return await response.json() } catch (error) {
    if (signal.aborted) throw error
    throw sourceFailure('parse_failed')
  }
}

export function createFinancialsHandler({ fetcher = fetch, now = Date.now, snapshot = null } = {}) {
  let companies, companiesAt = 0, companyRequest
  const failures = new Map(), recordedFailures = new WeakMap()
  let tickerFailure
  const cache = new Map(), pending = new Map(), limit = createLimiter(30, 60000, now)
  async function collect(symbol) {
    const signal = AbortSignal.timeout(20000)
    if (!companies || now() - companiesAt >= DAY) {
      companyRequest ||= secJson(fetcher, SEC_TICKERS_URL, signal).then(data => {
        if (!data || typeof data !== 'object' || !Object.values(data).some(row => typeof row?.ticker === 'string')) throw sourceFailure('invalid_response')
        companies = data; companiesAt = now(); tickerFailure = null
      }).catch(error => { throw Object.assign(error, { stage: 'ticker_map' }) }).finally(() => { companyRequest = null })
      await companyRequest
    }
    const company = Object.values(companies).find(row => typeof row?.ticker === 'string' && tickerKey(row.ticker) === tickerKey(symbol))
    if (!company || !Number.isSafeInteger(company.cik_str) || company.cik_str <= 0) return { symbol, results: [], quarterly: [], ttm: [], source: 'SEC EDGAR', status: 'not_available', fetchedAt: now(), stale: false }
    const cik = String(company.cik_str).padStart(10, '0')
    let facts
    try { facts = await secJson(fetcher, factsUrl(cik), signal) }
    catch (error) { if (error.status === 404) return { symbol, results: [], quarterly: [], ttm: [], source: 'SEC EDGAR', cik, status: 'not_available', fetchedAt: now(), stale: false }; throw Object.assign(error, { stage: 'company_facts' }) }
    let history
    try { history = financialHistory(facts, cik, now()) }
    catch { throw Object.assign(sourceFailure('conversion_failed'), { stage: 'conversion' }) }
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
    function unavailable(failure) {
      const candidates = [previous, financialSnapshotRecord(snapshot, symbol, now())]
        .filter(data => data && now() >= data.fetchedAt && now() - data.fetchedAt <= FINANCIAL_RETENTION)
        .sort((a, b) => b.fetchedAt - a.fetchedAt)
      const sourceFailure = { stage: failure.stage, code: failure.code, checkedAt: failure.checkedAt, nextRetryAt: failure.nextRetryAt }
      const headers = { 'Cache-Control': 'no-store', 'Retry-After': String(Math.max(1, Math.ceil((failure.nextRetryAt - now()) / 1000))) }
      if (candidates.length) return json({ ...candidates[0], stale: true, sourceFailure }, 200, headers)
      return json({ error: 'SEC financial statements temporarily unavailable', source: 'SEC EDGAR', sourceFailure }, 503, headers)
    }
    const waiting = [failures.get(symbol), tickerFailure].filter(Boolean).sort((a, b) => b.nextRetryAt - a.nextRetryAt)[0]
    if (waiting && now() >= waiting.checkedAt && now() < waiting.nextRetryAt) return unavailable(waiting)
    try {
      if (!pending.has(symbol)) pending.set(symbol, collect(symbol).then(data => {
        if (cache.size >= 100) cache.delete(cache.keys().next().value)
        cache.set(symbol, data); failures.delete(symbol); tickerFailure = null; return data
      }).finally(() => pending.delete(symbol)))
      return json(await pending.get(symbol), 200, { 'Cache-Control': 'public, s-maxage=3600' })
    } catch (error) {
      // Concurrent callers share one failure record and must not extend retry or
      // original data retention deadlines. Only fixed stage/code values escape.
      const objectError = error && typeof error === 'object'
      let failure = objectError ? recordedFailures.get(error) : null
      if (!failure) {
        const code = ['AbortError', 'TimeoutError'].includes(error?.name) ? 'timeout'
          : /^(http_\d{3}|parse_failed|invalid_response|conversion_failed)$/.test(error?.code || '') ? error.code : 'request_failed'
        const stage = ['ticker_map', 'company_facts', 'conversion'].includes(error?.stage) ? error.stage : 'request'
        const checkedAt = now(), count = Math.min(8, (waiting?.failures || 0) + 1)
        failure = { code, stage, checkedAt, nextRetryAt: retryDeadline({ code, retryAfter: error?.retryAfter }, checkedAt, count), failures: count }
        if (objectError) recordedFailures.set(error, failure)
      }
      if (failures.size >= 100 && !failures.has(symbol)) failures.delete(failures.keys().next().value)
      failures.set(symbol, failure)
      if (failure.stage === 'ticker_map') tickerFailure = failure
      return unavailable(failure)
    }
  }
}
