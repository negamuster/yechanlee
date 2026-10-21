import test from 'node:test'
import assert from 'node:assert/strict'
import { allowedPath, createStockHandler } from '../lib/stock-data.js'
import { createAnalysisHandler } from '../lib/stock-analysis.js'

const base = 'https://example.com'
const stockReq = path => new Request(`${base}/api/stock-data?path=${encodeURIComponent(path)}`)
const aiReq = (body, extra = {}) => new Request(`${base}/api/claude-proxy`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) })
const prompt = 'AAPL 재무 데이터에 대한 교육용 분석을 작성해 주세요.'

test('stock proxy only accepts bounded app routes and parameters', () => {
  for (const path of ['/v3/reference/tickers/AAPL', '/v2/aggs/ticker/AAPL/prev?adjusted=true', '/v2/reference/news?ticker=AAPL&limit=8&order=desc']) assert.ok(allowedPath(path))
  for (const path of ['/vX/reference/financials?ticker=AAPL&timeframe=annual&limit=2&order=desc', 'https://evil.test', '//evil.test', '/v3/reference/tickers/../tickers/AAPL', '/v3/reference/tickers/%41APL', '/v3/reference/tickers/AAPL?apiKey=attacker', '/v2/reference/news?limit=50000', '/v2/reference/news?ticker=AAPL&ticker=MSFT', '/v2/aggs/ticker/AAPL/range/1/minute/2026-01-01/2026-02-01', '/v2/aggs/ticker/AAPL/range/1/day/2026-02-30/2026-03-01']) assert.equal(allowedPath(path), null, path)
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

test('retired analysis rejects old clients without reading credentials or calling providers', async () => {
  let calls = 0
  const handler = createAnalysisHandler({ getKey: () => { calls++; return 'secret' }, fetchImpl: async () => { calls++; throw new Error('must not call') } })
  const responses = await Promise.all([handler(aiReq({ prompt })), handler(aiReq({ prompt: 'a'.repeat(20000) }))])
  for (const response of responses) assert.equal(response.status, 410)
  assert.equal((await handler(aiReq({ prompt }, { Origin: 'https://evil.test' }))).status, 403)
  assert.equal((await handler(new Request(`${base}/api/claude-proxy`))).status, 405)
  assert.equal(calls, 0)
})

test('ticker search fixes scope and limits, rejects mixed proxy parameters', async () => {
  let calls=0
  const handler=createStockHandler({getKey:()=> 'secret', fetchImpl:async url=>{
    calls++;assert.equal(url.pathname,'/v3/reference/tickers');assert.equal(url.searchParams.get('market'),'stocks');assert.equal(url.searchParams.get('locale'),'us')
    if(url.searchParams.has('ticker')) { assert.equal(url.searchParams.get('ticker'),'APPLE');assert.equal(url.searchParams.get('limit'),'1') }
    else { assert.equal(url.searchParams.get('limit'),'8');assert.equal(url.searchParams.get('search'),'Apple') }
    return Response.json({results:[{ticker:'AAPL',name:'Apple Inc.'}]})
  }})
  assert.equal((await handler(new Request(`${base}/api/stock-data?search=Apple`))).status,200)
  for(const query of ['search=Apple&path=/v3/reference/tickers/AAPL','search=Apple&search=Tesla','search=','search='+ 'a'.repeat(61),'search=https://evil.test'])assert.equal((await handler(new Request(`${base}/api/stock-data?${query}`))).status,400)
  assert.equal(calls,2)
})

test('exact TSLA precedes a full page of related ETFs and duplicate results remain bounded', async () => {
  let calls = 0
  const related = ['CRSH','ELOL','TESC','TESL','TEST','TLA','TSDD','TSIB'].map(ticker => ({ticker,name:`${ticker} TSLA ETF`}))
  const handler = createStockHandler({getKey:()=> 'secret',fetchImpl:async url=>{
    calls++
    return Response.json({results: url.searchParams.has('ticker') ? [{ticker:'TSLA',name:'Tesla, Inc.'}] : related})
  }})
  const request = () => new Request(`${base}/api/stock-data?search=tsla`)
  const response = await handler(request())
  assert.equal(response.status,200)
  const data = await response.json()
  assert.equal(data.results[0].ticker,'TSLA')
  assert.equal(data.results.length,8)
  assert.equal(new Set(data.results.map(row=>row.ticker)).size,8)
  await handler(request())
  assert.equal(calls,2)
})

test('search retains a verified exact match during broad-search failure but does not cache a failed search as empty', async () => {
  const handler = createStockHandler({getKey:()=> 'secret',fetchImpl:async url=>{
    if(!url.searchParams.has('ticker')) return new Response(null,{status:503})
    return Response.json({results:url.searchParams.get('ticker')==='TSLA' ? [{ticker:'TSLA',name:'Tesla'}] : []})
  }})
  const response=await handler(new Request(`${base}/api/stock-data?search=TSLA`))
  assert.equal(response.status,200)
  assert.equal((await response.json()).results[0].ticker,'TSLA')
  assert.equal((await handler(new Request(`${base}/api/stock-data?search=UNKNOWN`))).status,503)
})

test('upstream quota and access failures remain distinct without exposing provider bodies or credentials', async () => {
  for (const route of [stockReq('/v3/reference/tickers/TSLA'), new Request(`${base}/api/stock-data?search=TSLA`)]) {
    for (const [retry, expected] of [['17', '17'], ['9999', '120'], ['secret-key', '60']]) {
      const handler = createStockHandler({ getKey: () => 'secret-key', fetchImpl: async () => Response.json({ error: 'secret-key provider internals' }, { status: 429, headers: { 'Retry-After': retry } }) })
      const response = await handler(route)
      assert.equal(response.status, 429)
      assert.equal(response.headers.get('Retry-After'), expected)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      const body = await response.text()
      assert.ok(!body.includes('secret-key'))
      assert.equal(JSON.parse(body).code, 'MARKET_RATE_LIMITED')
    }
  }
  const handler = createStockHandler({ getKey: () => 'secret-key', fetchImpl: async () => Response.json({ error: 'secret-key' }, { status: 403 }) })
  const response = await handler(stockReq('/v3/reference/tickers/TSLA'))
  assert.equal(response.status, 503)
  assert.equal((await response.json()).code, 'MARKET_ACCESS_DENIED')
})

test('company and peer metadata cache for an hour, news for five minutes and prices for a minute with original receipt times', async () => {
  let time = Date.parse('2026-10-21T04:00:00Z')
  const firstTime = time, calls = new Map()
  const handler = createStockHandler({ getKey: () => 'secret', now: () => time, fetchImpl: async url => {
    calls.set(url.pathname, (calls.get(url.pathname) || 0) + 1)
    return Response.json({ results: [] })
  } })
  const routes = [['/v3/reference/tickers/NVDA', 3600], ['/v1/related-companies/NVDA', 3600], ['/v2/reference/news?ticker=NVDA&limit=8&order=desc', 300], ['/v2/aggs/ticker/NVDA/prev?adjusted=true', 60]]
  for (const [path, ttl] of routes) {
    const response = await handler(stockReq(path))
    assert.equal(response.headers.get('Cache-Control'), `public, s-maxage=${ttl}`)
    assert.equal((await response.json()).sourceInfo.fetchedAt, firstTime)
  }
  time += 120000
  for (const [path, ttl] of routes) {
    const body = await (await handler(stockReq(path))).json()
    assert.equal(body.sourceInfo.fetchedAt, ttl === 60 ? time : firstTime)
  }
  time += 240000
  for (const [path, ttl] of routes) {
    const body = await (await handler(stockReq(path))).json()
    assert.equal(body.sourceInfo.fetchedAt, ttl <= 300 ? time : firstTime)
    assert.equal(calls.get(new URL(path, base).pathname), ttl === 60 ? 3 : ttl === 300 ? 2 : 1)
  }
})
