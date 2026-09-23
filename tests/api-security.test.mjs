import test from 'node:test'
import assert from 'node:assert/strict'
import { allowedPath, createStockHandler } from '../lib/stock-data.js'
import { createAnalysisHandler } from '../lib/stock-analysis.js'

const base = 'https://example.com'
const stockReq = path => new Request(`${base}/api/stock-data?path=${encodeURIComponent(path)}`)
const aiReq = (body, extra = {}) => new Request(`${base}/api/claude-proxy`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) })
const prompt = 'AAPL 재무 데이터에 대한 교육용 분석을 작성해 주세요.'

test('stock proxy only accepts bounded app routes and parameters', () => {
  for (const path of ['/v3/reference/tickers/AAPL', '/v2/aggs/ticker/AAPL/prev?adjusted=true', '/v2/reference/news?ticker=AAPL&limit=8&order=desc', '/vX/reference/financials?ticker=AAPL&timeframe=annual&limit=2&order=desc']) assert.ok(allowedPath(path))
  for (const path of ['https://evil.test', '//evil.test', '/v3/reference/tickers/../tickers/AAPL', '/v3/reference/tickers/%41APL', '/v3/reference/tickers/AAPL?apiKey=attacker', '/v2/reference/news?limit=50000', '/v2/reference/news?ticker=AAPL&ticker=MSFT', '/v2/aggs/ticker/AAPL/range/1/minute/2026-01-01/2026-02-01', '/v2/aggs/ticker/AAPL/range/1/day/2026-02-30/2026-03-01']) assert.equal(allowedPath(path), null, path)
})

test('stock key stays upstream, JSON is sanitized and successful calls are cached', async () => {
  let count = 0
  const handler = createStockHandler({ getKey: () => 'secret-key', fetchImpl: async (url, options) => {
    count++; assert.equal(url.searchParams.has('apiKey'), false); assert.equal(options.headers.Authorization, 'Bearer secret-key'); assert.equal(options.redirect, 'error')
    return Response.json({ results: { name: 'Apple', branding: { icon_url: 'https://api.polygon.io/logo?apiKey=secret-key' } }, next_url: 'https://api.polygon.io?apiKey=secret-key' })
  } })
  const first = await handler(stockReq('/v3/reference/tickers/AAPL'))
  assert.equal(first.status, 200); assert.ok(!(await first.text()).includes('secret-key'))
  await handler(stockReq('/v3/reference/tickers/AAPL')); assert.equal(count, 1)
  assert.equal((await handler(stockReq('//evil.test'))).status, 400)
})

test('logo cannot fetch an arbitrary branding host; upstream errors never leak credentials', async () => {
  let count = 0
  const handler = createStockHandler({ getKey: () => 'secret-key', fetchImpl: async () => { count++; return Response.json({ results: { branding: { icon_url: 'https://evil.test/logo.png' } } }) } })
  assert.equal((await handler(new Request(`${base}/api/stock-data?logo=AAPL`))).status, 404); assert.equal(count, 1)
  const failed = createStockHandler({ getKey: () => 'secret-key', fetchImpl: async () => { throw new Error('secret-key') } })
  const response = await failed(stockReq('/v3/reference/tickers/AAPL')); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('secret-key'))
})

test('analysis fixes the model and output budget, caches identical prompts and enforces rate limit', async () => {
  let count = 0
  const handler = createAnalysisHandler({ getKey: () => 'secret-key', fetchImpl: async (_, options) => {
    count++; const body = JSON.parse(options.body)
    assert.equal(body.max_tokens, 800); assert.equal(body.model, 'claude-sonnet-4-20250514'); assert.ok(body.system); assert.equal(body.tools, undefined)
    return Response.json({ content: [{ type: 'text', text: '분석 결과' }], usage: { input_tokens: 100 } })
  } })
  assert.equal((await handler(aiReq({ prompt }))).status, 200)
  assert.equal((await handler(aiReq({ prompt }))).status, 200); assert.equal(count, 1)
  await handler(aiReq({ prompt }))
  assert.equal((await handler(aiReq({ prompt }))).status, 429)
})

test('analysis rejects arbitrary payloads, cross-site calls and oversized bodies without spending tokens', async () => {
  let count = 0
  const make = () => createAnalysisHandler({ getKey: () => 'secret-key', fetchImpl: async () => { count++; throw new Error('not called') } })
  for (const body of [{ model: 'other', messages: [] }, { prompt, max_tokens: 100000 }, { prompt: 'a'.repeat(6001) }, { prompt: '가'.repeat(6000) }]) assert.equal((await make()(aiReq(body))).status, 400)
  assert.equal((await make()(aiReq({ prompt }, { Origin: 'https://evil.test' }))).status, 403)
  assert.equal((await make()(new Request(`${base}/api/claude-proxy`))).status, 405)
  assert.equal(count, 0)
})

test('concurrent upstream analysis failures both return controlled errors', async () => {
  const handler = createAnalysisHandler({ getKey: () => 'secret', fetchImpl: async () => { await new Promise(r => setTimeout(r, 10)); throw new Error('secret') } })
  const responses = await Promise.all([handler(aiReq({ prompt })), handler(aiReq({ prompt }))])
  for (const response of responses) { assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('secret')) }
})
