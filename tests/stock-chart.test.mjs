import test from 'node:test'
import assert from 'node:assert/strict'
import { CHART_PERIODS, chartQuery, parseStockChart, createStockChartHandler } from '../lib/stock-chart.js'
import { stockChartPeriods, chartPointTime, chartIntervalLabel, validStockChart } from '../src/lib/stockChart.ts'
const at = Date.parse('2026-10-21T12:00:00Z')
const row = (date, c) => ({ t: Date.parse(date), c })
const response = (points, meta = {}) => ({ meta: { symbol: 'AAPL', currency: 'USD', dataGranularity: '1d', ...meta }, timestamp: points.map(p => p.t / 1000), indicators: { quote: [{ close: points.map(p => p.c) }] } })
test('browser and server expose exactly the requested eight periods and use real intraday/long-history queries', () => {
  assert.deepEqual(CHART_PERIODS, ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'ALL'])
  assert.deepEqual(stockChartPeriods, CHART_PERIODS)
  assert.equal(chartQuery('1D', at).get('interval'), '5m')
  assert.equal(chartQuery('5D', at).get('interval'), '30m')
  assert.equal(chartQuery('5Y', at).get('range'), '5y')
  assert.equal(chartQuery('ALL', at).get('period1'), '0')
  assert.equal(chartQuery('ALL', at).get('range'), null, 'explicit bounds avoid the max-range quarterly downsampling shortcut')
  assert.equal(chartQuery('YTD', at).get('period1'), String(Date.parse('2025-12-20T00:00:00Z') / 1000))
  assert.throws(() => chartQuery('3M', at))
})
test('1D keeps genuine intraday timestamps and compares the last price with the confirmed prior close', () => {
  const points = [row('2026-10-19T20:00Z', 100), row('2026-10-20T13:30Z', 101), row('2026-10-20T13:35Z', 102)]
  const parsed = parseStockChart(response(points, { previousClose: 100, dataGranularity: '5m' }), 'AAPL', '1D', at)
  assert.equal(parsed.points.length, 2); assert.ok(Math.abs(parsed.changePercent - 2) < 1e-8)
  assert.equal(parsed.points[1].t - parsed.points[0].t, 300000)
  assert.equal(parsed.baseline.label, '전 거래일 종가 대비'); assert.equal(validStockChart(parsed), true)
  assert.match(chartPointTime(points[1].t, '1D'), /09:30/)
  assert.equal(chartIntervalLabel('5m'), '5분봉')
})
test('5D selects five observed trading sessions across a weekend rather than five calendar days', () => {
  const points = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20'].map((date, i) => row(`${date}T15:00Z`, 100 + i))
  const parsed = parseStockChart(response(points), 'AAPL', '5D', at)
  assert.deepEqual(parsed.points, points.slice(-5))
})
test('YTD uses the previous year closing price and omits the prior-year point from the displayed series', () => {
  const points = [row('2025-12-31T15:00Z', 100), row('2026-01-02T15:00Z', 110), row('2026-10-20T15:00Z', 120)]
  const parsed = parseStockChart(response(points), 'AAPL', 'YTD', at)
  assert.equal(parsed.points.length, 2); assert.ok(Math.abs(parsed.changePercent - 20) < 1e-8)
  assert.equal(parsed.baseline.t, points[0].t)
  const missing = parseStockChart(response(points.slice(1)), 'AAPL', 'YTD', at)
  assert.match(missing.baseline.label, /전년 말 종가 미제공/)
})
test('5Y and ALL retain returned long history and show years; invalid, future, duplicate and missing observations are not invented', () => {
  const points = [row('1980-12-12T15:00Z', 1), row('2026-10-20T15:00Z', 100), row('2026-10-20T15:00Z', 100), row('2026-10-22T15:00Z', 999), { t: at - 1000, c: null }]
  const parsed = parseStockChart(response(points, { dataGranularity: '1wk' }), 'AAPL', 'ALL', at)
  assert.equal(parsed.points.length, 2); assert.equal(parsed.interval, '1wk')
  assert.match(chartPointTime(parsed.points[0].t, 'ALL', true), /1980/)
  assert.throws(() => parseStockChart(response(points), 'NVDA', 'ALL', at), /Invalid/)
  assert.equal(validStockChart({ ...parsed, points: [...parsed.points].reverse() }), false)
})
test('chart endpoint caches by ticker AND period, normalizes class shares, and preserves prior data after refresh failure', async () => {
  let now = at, fail = false, calls = 0
  const points = [row('2026-10-19T15:00Z', 100), row('2026-10-20T15:00Z', 101)]
  const handler = createStockChartHandler({ now: () => now, fetcher: async url => {
    calls++; assert.ok(url.startsWith('https://query1.finance.yahoo.com/v8/finance/chart/BRK-B?'))
    return fail ? new Response(null, { status: 503 }) : Response.json({ chart: { result: [response(points, { symbol: 'BRK-B' })], error: null } })
  } })
  const req = period => new Request(`https://example.com/api/stock-chart?ticker=BRK.B&period=${period}`)
  const [a, b] = await Promise.all([handler(req('1M')), handler(req('1M'))])
  const original = await a.json(); assert.deepEqual(original, await b.json()); assert.equal(calls, 1)
  await handler(req('1Y')); assert.equal(calls, 2)
  now += 61000; fail = true
  const stale = await (await handler(req('1M'))).json()
  assert.equal(stale.stale, true); assert.equal(stale.fetchedAt, original.fetchedAt); assert.deepEqual(stale.points, original.points)
})
test('chart endpoint bounds input to configured periods and cannot proxy user-selected URLs or date ranges', async () => {
  let calls = 0
  const handler = createStockChartHandler({ fetcher: async () => { calls++; throw new Error() } })
  for (const query of ['ticker=AAPL&period=3M', 'ticker=AAPL&period=ALL&url=https://evil.test', 'ticker=AAPL&period=1D&period=5D', 'ticker=https://evil.test&period=1D', 'ticker=AAPL&period=1D&from=1900-01-01']) assert.equal((await handler(new Request(`https://example.com/api/stock-chart?${query}`))).status, 400)
  assert.equal(calls, 0)
})
