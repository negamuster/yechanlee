import test from 'node:test'
import assert from 'node:assert/strict'
import { createStockHandler } from '../lib/stock-data.js'
import { stockPayloadIssue } from '../lib/stock-contracts.js'
import { HEALTH_SYMBOLS, inspectStockHealth } from '../lib/stock-health.js'
import { fetchStockSnapshot, retainStockResources } from '../src/lib/stockSnapshot.ts'
import { FIXED_AT, fixturePayload } from './e2e/stock-fixtures.mjs'

const request = path => new Request(`https://example.com/api/stock-data?${new URLSearchParams({ path })}`)
const proxy = payload => createStockHandler({ getKey: () => 'test-key', now: () => FIXED_AT, fetchImpl: async () => Response.json(payload) })

test('successful same-ticker omitted peers reach the shared contract and health check as an empty list', async () => {
  for (const symbol of HEALTH_SYMBOLS) {
    const response = await proxy({ status: 'OK', ticker: symbol })(request(`/v1/related-companies/${symbol}`))
    const data = await response.json()
    assert.equal(response.status, 200)
    assert.deepEqual(data.results, [])
    assert.equal(stockPayloadIssue('related', data, { symbol, now: FIXED_AT }), null)
    const health = inspectStockHealth('related', data, { symbol, now: FIXED_AT })
    assert.deepEqual(health.errors, [])
    assert.deepEqual(health.warnings, ['No related companies returned'])
  }
})

test('normalizing absent peers preserves the original cache receipt time and populated peer lists', async () => {
  let time = FIXED_AT, calls = 0
  const handler = createStockHandler({ getKey: () => 'test-key', now: () => time, fetchImpl: async url => {
    calls++
    return Response.json({ status: 'OK', ticker: url.pathname.split('/').at(-1), ...(url.pathname.endsWith('/AAPL') ? { results: [{ ticker: 'NVDA' }] } : {}) })
  } })
  const data = await (await handler(request('/v1/related-companies/SATL'))).json()
  time += 1000
  const cached = await (await handler(request('/v1/related-companies/SATL'))).json()
  assert.deepEqual(cached.results, [])
  assert.equal(cached.sourceInfo.fetchedAt, data.sourceInfo.fetchedAt)
  assert.equal(calls, 1)
  assert.deepEqual((await (await handler(request('/v1/related-companies/AAPL'))).json()).results, [{ ticker: 'NVDA' }])
})

test('ambiguous, mismatched and malformed peer responses remain validation failures', async () => {
  for (const payload of [
    {}, { ticker: 'SATL' }, { status: 'OK' }, { status: 'OK', ticker: 'MSFT' },
    { status: 'DELAYED', ticker: 'SATL' },
    ...[null, {}, 'missing', [{ ticker: 'not a ticker' }]].map(results => ({ status: 'OK', ticker: 'SATL', results })),
  ]) {
    const response = await proxy(payload)(request('/v1/related-companies/SATL'))
    const data = await response.json()
    assert.equal(stockPayloadIssue('related', data, { symbol: 'SATL', now: FIXED_AT })?.code, 'invalid_response')
    assert.ok(inspectStockHealth('related', data, { symbol: 'SATL', now: FIXED_AT }).errors.length)
  }
  for (const payload of [{ status: 'ERROR', ticker: 'SATL' }, { status: 'NOT_AUTHORIZED', ticker: 'SATL' }, { status: 'OK', ticker: 'SATL', error: 'Unavailable' }]) {
    assert.equal((await proxy(payload)(request('/v1/related-companies/SATL'))).status, 503)
  }
  const otherResource = await (await proxy({ status: 'OK', ticker: 'SATL' })(request('/v2/aggs/ticker/SATL/prev?adjusted=true'))).json()
  assert.equal(Object.hasOwn(otherResource, 'results'), false)
  assert.equal(stockPayloadIssue('previous', otherResource, { symbol: 'SATL', now: FIXED_AT })?.code, 'invalid_response')
})

test('the stock snapshot accepts the normalized empty list and clears previously retained peers', async () => {
  const symbol = 'SATL'
  const handler = createStockHandler({ getKey: () => 'test-key', now: () => FIXED_AT, fetchImpl: async url => {
    if (url.pathname.startsWith('/v1/related-companies/')) return Response.json({ status: 'OK', ticker: symbol })
    const kind = url.pathname.includes('/range/') ? 'history' : url.pathname.endsWith('/prev') ? 'previous' : url.pathname === '/v2/reference/news' ? 'news' : 'details'
    return Response.json(fixturePayload(kind, symbol))
  } })
  const snapshot = await fetchStockSnapshot(symbol, new AbortController().signal, async (url, init) => {
    const req = new Request(new URL(url, 'https://example.com'), init)
    return new URL(req.url).pathname === '/api/stock-financials' ? Response.json(fixturePayload('financials', symbol)) : handler(req)
  }, FIXED_AT)
  assert.deepEqual(snapshot.related, [])
  assert.ok(!snapshot.issues.includes('관련 종목'))
  assert.deepEqual(snapshot.resourceSources.related, { fetchedAt: FIXED_AT, stale: false })
  const previous = { ...snapshot, related: ['AAPL'] }
  assert.deepEqual(retainStockResources(previous, snapshot, FIXED_AT).related, [])
})
