import { stockPayloadIssue } from './stock-contracts.js'
import { latestDailyDate, nyDate } from './trading-session.js'

export const PRODUCTION_ORIGIN = 'https://yechanlee.vercel.app'
export const HEALTH_SYMBOLS = ['AAPL', 'NVDA', 'SATL']
const DAY = 86400000
export const healthSymbol = (now = Date.now()) => HEALTH_SYMBOLS[Math.floor(now / (6 * 3600000)) % HEALTH_SYMBOLS.length]

export function stockHealthRequests(symbol, now = Date.now()) {
  if (!HEALTH_SYMBOLS.includes(symbol)) throw new Error('Unsupported health-check symbol')
  const to = latestDailyDate(now), from = new Date(Date.parse(`${to}T12:00Z`) - 365 * DAY).toISOString().slice(0, 10)
  const proxy = (kind, path) => ({ kind, market: true, path: `/api/stock-data?path=${encodeURIComponent(path)}` })
  return [
    proxy('details', `/v3/reference/tickers/${symbol}`),
    proxy('history', `/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=500`),
    proxy('previous', `/v2/aggs/ticker/${symbol}/prev?adjusted=true`),
    proxy('news', `/v2/reference/news?ticker=${symbol}&limit=8&order=desc`),
    proxy('related', `/v1/related-companies/${symbol}`),
    { kind: 'financials', path: `/api/stock-financials?ticker=${symbol}` },
    ...['1D', '1M', 'ALL'].map(period => ({ kind: 'chart', period, path: `/api/stock-chart?ticker=${symbol}&period=${period}` })),
  ]
}

export function inspectStockHealth(kind, data, { symbol, period, now = Date.now() }) {
  const errors = [], warnings = []
  const issue = stockPayloadIssue(kind, data, { symbol, period, now })
  if (issue) return { errors: [`${issue.code}: ${issue.fields.join(', ')}`], warnings }
  const sourceFetchedAt = data.sourceInfo?.fetchedAt ?? data.fetchedAt
  if (!sourceFetchedAt) warnings.push('Source receipt time missing')
  else if (now - sourceFetchedAt > (kind === 'financials' ? 7 * DAY : kind === 'news' ? DAY / 4 : DAY)) errors.push('Source receipt time expired')
  if (data.stale || data.sourceInfo?.stale) warnings.push('Previously collected data; refresh failed')
  let lastObservationAt
  if (kind === 'details') {
    for (const field of ['market_cap', 'primary_exchange', 'list_date']) if (data.results[field] == null || data.results[field] === '') errors.push(`Missing company field: ${field}`)
    if (!(data.results.market_cap > 0)) errors.push('Market cap is not positive')
  } else if (kind === 'history' || kind === 'previous') {
    const rows = data.results
    if (rows.length < (kind === 'history' ? 2 : 1)) errors.push('Insufficient confirmed daily prices')
    if (rows.some(row => nyDate(row.t) > latestDailyDate(now))) errors.push('Uncompleted trading day in daily response')
    lastObservationAt = rows.length ? Math.max(...rows.map(row => row.t)) : undefined
    if (lastObservationAt && now - lastObservationAt > 10 * DAY) errors.push('Daily prices older than 10 calendar days')
  } else if (kind === 'news') {
    if (!data.results.length) warnings.push('No articles returned')
    if (data.results.some(row => Date.parse(row.published_utc) > now + 300000)) errors.push('Future news publication time')
    lastObservationAt = data.results.length ? Math.max(...data.results.map(row => Date.parse(row.published_utc))) : undefined
    if (lastObservationAt && now - lastObservationAt > 3 * DAY) warnings.push('Newest article older than 72 hours')
  } else if (kind === 'related') {
    if (!data.results.length) warnings.push('No related companies returned')
  } else if (kind === 'financials') {
    if (data.status !== 'ok' || !data.results.length) errors.push('No annual coverage for reference company')
    const annual = data.results[0]
    if (annual) {
      for (const field of ['revenues', 'net_income_loss', 'diluted_earnings_per_share']) if (!annual.financials.income_statement[field]) warnings.push(`Annual field missing: ${field}`)
      lastObservationAt = Date.parse(annual.end_date)
      if (now - lastObservationAt > 550 * DAY) warnings.push('Latest annual period older than 550 days')
      if (!annual.financials.income_statement.operating_income_loss) warnings.push('Annual operating income missing')
      for (const key of ['operating_cash_flow', 'capital_expenditures', 'free_cash_flow']) if (!annual.financials.cash_flow_statement?.[key]) warnings.push(`Annual field missing: ${key}`)
    }
    if (!data.quarterly?.length) warnings.push('No discrete quarterly coverage')
    if (!data.ttm?.length) warnings.push('No confirmed four-quarter TTM')
  } else if (kind === 'chart') {
    if (data.points.length < 2) errors.push('Insufficient chart observations')
    lastObservationAt = data.points.at(-1)?.t
    if (lastObservationAt && now - lastObservationAt > 10 * DAY) errors.push('Chart observations older than 10 calendar days')
  }
  return { errors, warnings, sourceFetchedAt, lastObservationAt }
}

export async function runStockHealth({ symbol = healthSymbol(), fetcher = fetch, now = Date.now, marketIntervalMs = 20000, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), onResult = () => {} } = {}) {
  const checks = [], startedAt = now()
  let lastMarketAt, quotaReached = false
  for (const request of stockHealthRequests(symbol, startedAt)) {
    const name = `${symbol} ${request.kind}${request.period ? ` ${request.period}` : ''}`
    let result
    if (request.market && quotaReached) {
      result = { name, status: 'SKIP', errors: [], warnings: ['Skipped after provider rate limit'] }
    } else {
      if (request.market && lastMarketAt !== undefined) await sleep(Math.max(0, marketIntervalMs - (now() - lastMarketAt)))
      if (request.market) lastMarketAt = now()
      try {
        const response = await fetcher(PRODUCTION_ORIGIN + request.path, { signal: AbortSignal.timeout(30000), redirect: 'error' })
        if (!response.ok) {
          quotaReached ||= !!request.market && response.status === 429
          const code = response.status === 429 ? 'rate_limited' : response.status === 401 || response.status === 403 ? 'access_denied' : 'upstream_unavailable'
          result = { name, http: response.status, errors: [`HTTP ${response.status} (${code})`], warnings: [] }
        } else {
          const data = await response.json()
          result = { name, http: response.status, ...inspectStockHealth(request.kind, data, { symbol, period: request.period, now: now() }) }
        }
      } catch (error) {
        result = { name, errors: [error instanceof SyntaxError ? 'Invalid JSON response' : ['TimeoutError', 'AbortError'].includes(error?.name) ? 'Request timed out' : 'Connection failed'], warnings: [] }
      }
    }
    result.status ||= result.errors.length ? 'FAIL' : result.warnings.length ? 'WARN' : 'OK'
    checks.push(result); await onResult(result)
  }
  return { symbol, checkedAt: now(), checks, failed: checks.some(check => check.status === 'FAIL') }
}
