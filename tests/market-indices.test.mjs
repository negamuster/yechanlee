import test from 'node:test'
import assert from 'node:assert/strict'
import { INDICES, parseQuote, createIndicesHandler } from '../lib/market-indices.js'
const meta = { symbol: '^GSPC', regularMarketPrice: 110, previousClose: 100, regularMarketTime: 1789766988 }
test('index quotes preserve timestamp and units; absent previous close is not a zero return', () => {
  assert.ok(Math.abs(parseQuote(meta, '^GSPC', 'S&P 500').changePercent - 10) < 1e-9)
  assert.equal(parseQuote(meta, '^GSPC', 'S&P 500').unit, 'pt')
  assert.equal(parseQuote({ ...meta, previousClose: null }, '^GSPC', '').changePercent, null)
  assert.equal(parseQuote({ ...meta, regularMarketPrice: null }, '^GSPC', ''), null)
  assert.equal(parseQuote(meta, '^KS11', ''), null)
})
test('partial failure keeps all 19 instruments; concurrent requests coalesce and cache expires', async () => {
  let calls = 0, time = 1000
  const handler = createIndicesHandler({ now: () => time, fetcher: async url => {
    calls++
    return url.includes('%5EGSPC') ? Response.json({ chart: { result: [{ meta }] } }) : new Response('', { status: 429 })
  } })
  const request = () => new Request('http://localhost/api/market-indices')
  const responses = await Promise.all([handler(request()), handler(request())])
  const result = await responses[0].json()
  assert.equal(responses[0].status, 200)
  assert.equal(result.quotes.length, 19)
  assert.equal(result.quotes.filter(q => q.status === 'ok').length, 1)
  assert.equal(calls, INDICES.length)
  await handler(request()); assert.equal(calls, 19)
  time += 61000
  await handler(request()); assert.equal(calls, 38)
  assert.equal((await handler(new Request(request(), { method: 'POST' }))).status, 405)
})
test('total provider failure yields a retryable 503 without fabricated prices', async () => {
  const handler = createIndicesHandler({ fetcher: async () => { throw new Error('offline') } })
  const r = await handler(new Request('http://localhost/api/market-indices'))
  assert.equal(r.status, 503)
  assert.ok((await r.json()).quotes.every(q => q.price === null))
})
