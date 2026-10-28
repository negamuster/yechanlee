export const FIXED_AT = Date.parse('2026-10-21T12:00:00Z')
const point = (date, c) => ({ t: Date.parse(date), c })
const bar = (date, c) => ({ ...point(date, c), o: c, h: c + 1, l: c - 1 })
const companies = { AAPL: ['Apple Inc.', 102, 3e12], NVDA: ['NVIDIA Corporation', 204, 5e12], SATL: ['Satellogic Inc.', 5.5, 7e8], VOO: ['Vanguard S&P 500 ETF', 500, 1e12] }
const info = () => ({ source: 'Polygon / Massive', fetchedAt: FIXED_AT, stale: false })
export function fixturePayload(kind, symbol = 'NVDA', period = '1M') {
  const [name, price, marketCap] = companies[symbol]
  if (kind === 'details') return { results: { ticker: symbol, name, currency_name: 'usd', market_cap: marketCap, primary_exchange: 'XNAS', list_date: '1999-01-22' }, sourceInfo: info() }
  if (kind === 'history') return { ticker: symbol, results: [bar('2026-10-19T04:00Z', price - 1), bar('2026-10-20T04:00Z', price)], sourceInfo: info() }
  if (kind === 'previous') return { ticker: symbol, results: [{ ...bar('2026-10-20T04:00Z', price), T: symbol }], sourceInfo: info() }
  if (kind === 'news') return { results: [{ id: `${symbol}-story`, title: `${symbol} fixture earnings report`, article_url: `https://example.com/${symbol}/earnings`, published_utc: '2026-10-20T12:00:00Z', publisher: { name: 'Fixture News' } }], sourceInfo: info() }
  if (kind === 'related') return { results: [{ ticker: symbol === 'AAPL' ? 'NVDA' : 'AAPL' }], sourceInfo: info() }
  if (kind === 'financials') return { symbol, company: name, source: 'SEC EDGAR', fetchedAt: FIXED_AT, stale: false, status: 'ok', results: [2025, 2024].map(year => ({
    start_date: `${year}-01-01`, end_date: `${year}-12-31`, filing_date: '2026-02-01', fiscal_period: 'FY', accounting_standard: 'us-gaap', source_filing_url: 'https://www.sec.gov/Archives/edgar/data/1/000000000126000001/0000000001-26-000001-index.html',
    financials: { income_statement: { revenues: { value: 1000, unit: 'USD' }, net_income_loss: { value: -10, unit: 'USD' }, diluted_earnings_per_share: { value: 0, unit: 'USD/shares' } }, balance_sheet: { equity: { value: 50, unit: 'USD' }, liabilities: { value: 20, unit: 'USD' } } },
  })) }
  const points = period === '1D' ? [point('2026-10-20T13:30Z', price - 1), point('2026-10-20T13:35Z', price)] : period === 'ALL' ? [point('1980-12-12T15:00Z', 1), point('2026-10-20T15:00Z', price)] : [point('2026-10-19T15:00Z', price - 1), point('2026-10-20T15:00Z', price)]
  return { symbol, period, points: points.map((p, i) => ({ ...p, o: p.c - .25, h: p.c + .5, l: p.c - .5, v: i ? 2000 : 0 })), currency: 'USD', interval: period === '1D' ? '5m' : period === '5D' ? '30m' : ['5Y', 'ALL'].includes(period) ? '1wk' : '1d', source: 'Yahoo Finance', fetchedAt: FIXED_AT, stale: false, baseline: { c: price - 1, label: 'Fixture first price' }, changePercent: 1 }
}

export async function installStockFixtures(page) {
  const state = { denseChart: false, closeOnlyChart: false, partialChart: false, appendChart: false, failChart: false, failBenchmark: false, benchmarkCurrency: 'USD', benchmarkInterval: null, benchmarkOffset: 0, failReference: false, failOptional: false, failAllPrices: false, failFinancials: false, annualOnly: false, mixedCurrency: false, mismatchReference: false, emptyLists: false, delay: null, delayed: 0, release: null, requests: [], pageErrors: [] }
  await page.clock.setFixedTime(new Date(FIXED_AT))
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:4173') return route.abort()
    if (!url.pathname.startsWith('/api/')) return route.continue()
    state.requests.push(url.pathname + url.search)
    if (url.pathname === '/api/news') return route.fulfill({ json: { version: 'rss-node-v6', items: [], sources: [], fetchedAt: FIXED_AT } })
    if (url.searchParams.has('search')) {
      const query = url.searchParams.get('search').toUpperCase(), symbols = Object.keys(companies).filter(symbol => symbol === query || companies[symbol][0].toUpperCase().includes(query))
      return route.fulfill({ json: { results: symbols.map(ticker => ({ ticker, name: companies[ticker][0], primary_exchange: 'XNAS' })) } })
    }
    const path = url.searchParams.get('path') || ''
    const symbol = url.searchParams.get('ticker') || (path.startsWith('/v3/reference/tickers/') ? path.split('/').at(-1) : path.startsWith('/v1/related-companies/') ? path.split('/').at(-1) : path.startsWith('/v2/reference/news') ? new URL(path, url.origin).searchParams.get('ticker') : path.split('/')[4])
    const kind = url.pathname === '/api/stock-chart' ? 'chart' : url.pathname === '/api/stock-financials' ? 'financials' : path.includes('/range/') ? 'history' : path.includes('/prev?') ? 'previous' : path.startsWith('/v3/') ? 'details' : path.startsWith('/v1/') ? 'related' : path.startsWith('/v2/reference/news') ? 'news' : null
    if (!kind || !companies[symbol]) return route.fulfill({ status: 503, json: { error: 'Unconfigured fixture' } })
    if (kind === 'details' && state.failReference || ['news', 'related'].includes(kind) && state.failOptional || ['history', 'previous'].includes(kind) && state.failAllPrices || kind === 'financials' && state.failFinancials) return route.fulfill({ status: 503, json: { error: 'Simulated outage' } })
    const period = url.searchParams.get('period') || '1M'
    if (kind === 'chart' && state.delay?.symbol === symbol && state.delay.period === period) { state.delayed++; await new Promise(resolve => { state.release = resolve }) }
    const body = fixturePayload(kind, symbol, period)
    if (kind === 'chart') {
      if (state.failChart || symbol === 'VOO' && state.failBenchmark) return route.fulfill({ status: 503, json: { error: 'Simulated chart outage' } })
      if (state.denseChart) {
        const dates = []
        for (let d = Date.parse('2026-10-19T15:00Z'); dates.length < 32; d -= 86400000) if (![0, 6].includes(new Date(d).getUTCDay())) dates.unshift(d)
        body.points = dates.map((t, i) => { const c = symbol === 'VOO' ? 200 + i / 4 : 100 + i / 2; return { t, c, o: c - .25, h: c + 1, l: c - 1, v: i * 1000 } })
        if (state.appendChart) { const c = symbol === 'VOO' ? 208 : 116; body.points.push({ t: Date.parse('2026-10-20T15:00Z'), c, o: c - .25, h: c + 1, l: c - 1, v: 32000 }) }
      }
      if (symbol === 'VOO') { body.currency = state.benchmarkCurrency; body.interval = state.benchmarkInterval || body.interval; body.points = body.points.map(p => ({ ...p, t: p.t + state.benchmarkOffset })) }
      if (state.closeOnlyChart) body.points = body.points.map(({ t, c }) => ({ t, c }))
      if (state.partialChart) { const p = body.points.at(-1); delete p.o; delete p.h; delete p.l; p.v = 0 }
    }
    if (kind === 'financials') {
      const data = financialHistory(financialFacts(), '1', FIXED_AT)
      body.results = data.annual; body.quarterly = state.annualOnly ? [] : data.quarterly; body.ttm = state.annualOnly ? [] : data.ttm
      if (state.mixedCurrency) body.results[1].financials.income_statement.revenues = { value: 90, unit: 'EUR' }
    }
    if (kind === 'details' && state.mismatchReference) body.results.ticker = symbol === 'NVDA' ? 'AAPL' : 'NVDA'
    if (['news', 'related'].includes(kind) && state.emptyLists) body.results = []
    await route.fulfill({ json: body }).catch(() => {})
  })
  return state
}
import { financialHistory } from '../../lib/financial-history.js'
import { financialFacts } from '../fixtures/financial-history.mjs'
