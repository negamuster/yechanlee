import test from 'node:test'
import assert from 'node:assert/strict'
import { HEALTH_SYMBOLS, PRODUCTION_ORIGIN, healthSymbol, stockHealthRequests, inspectStockHealth, runStockHealth } from '../lib/stock-health.js'
import { FIXED_AT, fixturePayload } from './e2e/stock-fixtures.mjs'

test('reference symbols rotate each six hours; stock probes cover each resource and all chart horizons', () => {
  assert.deepEqual([0, 1, 2].map(slot => healthSymbol(slot * 21600000)), HEALTH_SYMBOLS)
  const probes = stockHealthRequests('AAPL', FIXED_AT)
  assert.equal(probes.length, 9)
  assert.deepEqual(probes.filter(p => p.period).map(p => p.period), ['1D', '1M', 'ALL'])
  assert.equal(probes.filter(p => p.market).length, 5)
  assert.throws(() => stockHealthRequests('https://evil.test', FIXED_AT))
  for (const symbol of HEALTH_SYMBOLS) for (const probe of stockHealthRequests(symbol, FIXED_AT)) {
    const result = inspectStockHealth(probe.kind, fixturePayload(probe.kind, symbol, probe.period), { symbol, period: probe.period, now: FIXED_AT })
    assert.deepEqual(result.errors, [], `${symbol} ${probe.kind}`)
  }
})

test('health checks distinguish missing values, original receipt age and valid empty optional data', () => {
  const context = { symbol: 'NVDA', now: FIXED_AT }
  const details = fixturePayload('details')
  delete details.results.market_cap
  assert.ok(inspectStockHealth('details', details, context).errors.some(e => e.includes('market_cap')))
  const news = fixturePayload('news')
  news.results = []
  assert.deepEqual(inspectStockHealth('news', news, context).errors, [])
  assert.ok(inspectStockHealth('news', news, context).warnings.length)
  news.sourceInfo.stale = true
  news.sourceInfo.fetchedAt -= 7 * 3600000
  const stale = inspectStockHealth('news', news, context)
  assert.equal(stale.sourceFetchedAt, news.sourceInfo.fetchedAt)
  assert.ok(stale.errors.includes('Source receipt time expired'))
  assert.ok(stale.warnings.some(w => w.includes('refresh failed')))
  const financials = fixturePayload('financials')
  financials.status = 'not_available'; financials.results = []
  assert.ok(inspectStockHealth('financials', financials, context).errors.length)
})

test('daily checks allow weekends but reject an uncompleted session and old observations', () => {
  const saturday = Date.parse('2026-10-24T12:00Z')
  const history = fixturePayload('history')
  assert.deepEqual(inspectStockHealth('history', history, { symbol: 'NVDA', now: saturday }).errors.filter(e => e.includes('prices') || e.includes('trading')), [])
  history.results.at(-1).t = Date.parse('2026-10-21T04:00Z')
  assert.ok(inspectStockHealth('history', history, { symbol: 'NVDA', now: FIXED_AT }).errors.includes('Uncompleted trading day in daily response'))
  history.results.at(-1).t -= 30 * 86400000
  history.results[0].t -= 30 * 86400000
  assert.ok(inspectStockHealth('history', history, { symbol: 'NVDA', now: FIXED_AT }).errors.some(e => e.includes('older than 10')))
})

test('live runner spaces provider calls, uses only the production origin and performs no retries', async () => {
  let now = FIXED_AT, index = 0
  const starts = [], sleeps = [], probes = stockHealthRequests('NVDA', now)
  const result = await runStockHealth({ symbol: 'NVDA', now: () => now, sleep: async ms => { sleeps.push(ms); now += ms }, fetcher: async (url, init) => {
    const probe = probes[index++]
    assert.equal(new URL(url).origin, PRODUCTION_ORIGIN)
    assert.equal(init.redirect, 'error')
    if (probe.market) starts.push(now)
    return Response.json(fixturePayload(probe.kind, 'NVDA', probe.period))
  } })
  assert.equal(result.failed, false)
  assert.equal(index, 9)
  assert.deepEqual(sleeps, [20000, 20000, 20000, 20000])
  assert.ok(starts.every((at, i) => !i || at - starts[i - 1] >= 20000))
})

test('rate limits stop remaining provider requests while independent financial/chart probes continue', async () => {
  const urls = []
  const result = await runStockHealth({ symbol: 'NVDA', now: () => FIXED_AT, sleep: async () => {}, fetcher: async url => {
    urls.push(url)
    const query = new URL(url).searchParams
    if (url.includes('/api/stock-data')) return Response.json({ private: 'DO_NOT_LOG' }, { status: 429 })
    return Response.json(fixturePayload(query.has('period') ? 'chart' : 'financials', 'NVDA', query.get('period')))
  } })
  assert.equal(urls.length, 5)
  assert.equal(result.checks.filter(c => c.status === 'SKIP').length, 4)
  assert.equal(result.failed, true)
  assert.ok(!JSON.stringify(result).includes('DO_NOT_LOG'))
  const invalid = await runStockHealth({ symbol: 'AAPL', now: () => FIXED_AT, sleep: async () => {}, fetcher: async () => new Response('<html>private</html>') })
  assert.ok(invalid.checks.every(c => c.errors.includes('Invalid JSON response')))
})
