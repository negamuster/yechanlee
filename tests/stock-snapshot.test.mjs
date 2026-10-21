import test from 'node:test'
import assert from 'node:assert/strict'
import { completedBars, quoteFromBars, freshSnapshot, usableSnapshot, fetchStockSnapshot, retainStockResources, StockSnapshotError, STOCK_TTL, STOCK_MAX_AGE } from '../src/lib/stockSnapshot.ts'
import { latestDailyDate } from '../lib/trading-session.js'
const now = Date.parse('2026-10-07T03:00:00Z')
const bar = (day, c, o = c, h = Math.max(c, o) + 10, l = Math.min(c, o) - 10) => ({ t: Date.parse(`${day}T04:00:00Z`), o, h, l, c })
const bars = [bar('2026-10-05', 100), bar('2026-10-06', 105, 104, 120, 90)]
test('quote compares consecutive closes, includes intraday extremes and preserves missing/flat values', () => {
  const quote = quoteFromBars(bars)
  assert.equal(quote.changePct, 5)
  assert.equal(quote.previous.c, 100)
  assert.equal(quote.high, 120)
  assert.equal(quote.low, 90)
  assert.equal(quote.tradingDate, '2026-10-06')
  assert.equal(quoteFromBars([bars[0]]).changePct, null)
  assert.equal(quoteFromBars([bars[0], bars[0]]).changePct, 0)
  assert.equal(quoteFromBars([]).high, null)
})
test('incomplete, invalid and duplicate daily bars cannot contaminate quotes', () => {
  assert.deepEqual(completedBars([bars[1], bars[0], bars[0], bar('2026-10-07', 999), { ...bars[0], c: NaN }, { ...bars[0], h: 1 }], now), bars)
  assert.equal(latestDailyDate(Date.parse('2026-10-07T00:59:59Z')), '2026-10-05')
  assert.equal(latestDailyDate(Date.parse('2026-10-07T01:00:00Z')), '2026-10-06')
  assert.equal(latestDailyDate(Date.parse('2026-12-08T01:59:59Z')), '2026-12-06')
  assert.equal(latestDailyDate(Date.parse('2026-12-08T02:00:00Z')), '2026-12-07')
})
test('cache expires, rejects symbol mismatches and retries incomplete snapshots', () => {
  const item = { symbol: 'AAPL', fetchedAt: now, issues: [] }
  assert.equal(freshSnapshot(item, 'AAPL', now + STOCK_TTL - 1), true)
  assert.equal(freshSnapshot(item, 'AAPL', now + STOCK_TTL), false)
  assert.equal(freshSnapshot(item, 'MSFT', now), false)
  assert.equal(freshSnapshot({ ...item, issues: ['뉴스'] }, 'AAPL', now), false)
  assert.equal(usableSnapshot(item, 'AAPL', now + STOCK_MAX_AGE + 1), false)
  assert.equal(usableSnapshot(item, 'AAPL', now - 1), false)
})
const mock = (failure = '') => async url => {
  const endpoint = new URL(url, 'https://example.com')
  if (endpoint.pathname === '/api/stock-financials') return failure === '/financials' ? Response.json({}, { status: 503 }) : Response.json({ symbol: 'AAPL', results: [], source: 'SEC EDGAR', fetchedAt: now, stale: false })
  const path = endpoint.searchParams.get('path') || ''
  if (path.includes(failure) && failure) return Response.json({ error: 'unavailable' }, { status: 503 })
  return Response.json({ results: path.includes('/range/') ? bars : path.includes('/v3/') ? { name: 'Apple', ticker: 'AAPL' } : [] })
}
test('optional data failure is visible while failed prices never become zero or a successful cache entry', async () => {
  const snapshot = await fetchStockSnapshot('AAPL', new AbortController().signal, mock('/financials'), now)
  assert.deepEqual(snapshot.issues, ['연간 재무'])
  assert.equal(quoteFromBars(snapshot.bars).latest.c, 105)
  await assert.rejects(fetchStockSnapshot('AAPL', new AbortController().signal, mock('/range/'), now))
  await assert.rejects(fetchStockSnapshot('MSFT', new AbortController().signal, mock(), now))
  await assert.rejects(fetchStockSnapshot('AAPL', AbortSignal.abort(), mock(), now), { name: 'AbortError' })
})

test('previous-day response supplements a lagging range only for the requested ticker and completed date', async () => {
  const fetcher = ticker => async url => new URL(url, 'https://example.com').searchParams.get('path')?.includes('/prev?')
    ? Response.json({ results: [{ ...bar('2026-10-06', 110), T: ticker }, { ...bar('2026-10-07', 999), T: ticker }] })
    : mock()(url)
  const snapshot = await fetchStockSnapshot('AAPL', new AbortController().signal, fetcher('AAPL'), now)
  assert.equal(quoteFromBars(snapshot.bars).changePct, 10)
  assert.equal(snapshot.bars.length, 2)
  const mismatch = await fetchStockSnapshot('AAPL', new AbortController().signal, fetcher('MSFT'), now)
  assert.equal(quoteFromBars(mismatch.bars).latest.c, 105)
})

test('a transient core-data error retries once; persistent failure stays bounded', async () => {
  let detailsCalls = 0
  const fetcher = async (url, options) => {
    const path = new URL(url, 'https://example.com').searchParams.get('path')
    if (path?.includes('/v3/') && ++detailsCalls === 1) return new Response(null, {status:503})
    return mock()(url, options)
  }
  const snapshot = await fetchStockSnapshot('AAPL', new AbortController().signal, fetcher, now)
  assert.equal(snapshot.details.ticker, 'AAPL')
  assert.equal(detailsCalls, 2)
  let deniedCalls = 0
  await assert.rejects(fetchStockSnapshot('AAPL', new AbortController().signal, async (url, options) => {
    if (url.includes(encodeURIComponent('/v3/'))) { deniedCalls++; return new Response(null, {status:403}) }
    return mock()(url, options)
  }, now))
  assert.equal(deniedCalls, 1)
})

test('failed price history preserves a confirmed same-symbol close without inventing a change or a 52-week range', async () => {
  let historyCalls = 0
  const fetcher = async (url, options) => {
    const path = new URL(url, 'https://example.com').searchParams.get('path')
    if (path?.includes('/range/')) { historyCalls++; return new Response(null, {status:503}) }
    if (path?.includes('/prev?')) return Response.json({results:[{...bars[1],T:'AAPL'}]})
    return mock()(url, options)
  }
  const snapshot = await fetchStockSnapshot('AAPL', new AbortController().signal, fetcher, now)
  assert.equal(historyCalls,2)
  assert.equal(quoteFromBars(snapshot.bars).latest.c,105)
  assert.equal(quoteFromBars(snapshot.bars).changePct,null)
  assert.equal(snapshot.historyAvailable,false)
  assert.ok(snapshot.issues.includes('가격 이력'))
})

test('a failed company reference does not hide confirmed prices and a same-symbol SEC company', async () => {
  let detailsCalls = 0
  const fetcher = async (url, options) => {
    const endpoint = new URL(url, 'https://example.com'), path = endpoint.searchParams.get('path')
    if (path?.includes('/v3/')) { detailsCalls++; return Response.json({}, { status: 503 }) }
    if (endpoint.pathname === '/api/stock-financials') return Response.json({ symbol: 'AAPL', company: 'Apple Inc.', source: 'SEC EDGAR', status: 'ok', results: [], fetchedAt: now, stale: false })
    return mock()(url, options)
  }
  const snapshot = await fetchStockSnapshot('AAPL', new AbortController().signal, fetcher, now)
  assert.equal(detailsCalls, 2)
  assert.deepEqual(snapshot.details, { ticker: 'AAPL', name: 'Apple Inc.' })
  assert.equal(snapshot.companySource, 'SEC EDGAR')
  assert.ok(snapshot.issues.includes('상세 기업 정보'))
  assert.equal(quoteFromBars(snapshot.bars).latest.c, 105)
  assert.equal(freshSnapshot(snapshot, 'AAPL', now), false)
  // A conflicting reference is evidence of a mismatch, not a retrieval failure.
  await assert.rejects(fetchStockSnapshot('AAPL', new AbortController().signal, async (url, options) => {
    if (new URL(url, 'https://example.com').searchParams.get('path')?.includes('/v3/')) return Response.json({ results: { ticker: 'MSFT', name: 'Microsoft' } })
    return fetcher(url, options)
  }, now), /티커가 일치하지/)
  // A different SEC symbol, an unnamed company, or no confirmed price cannot enable fallback.
  for (const change of [{ symbol: 'MSFT' }, { company: '' }, { source: 'unverified' }, { status: 'not_available' }]) {
    await assert.rejects(fetchStockSnapshot('AAPL', new AbortController().signal, async (url, options) => {
      if (new URL(url, 'https://example.com').pathname === '/api/stock-financials') return Response.json({ symbol: 'AAPL', company: 'Apple', source: 'SEC EDGAR', status: 'ok', results: [], fetchedAt: now, ...change })
      return fetcher(url, options)
    }, now), StockSnapshotError)
  }
  await assert.rejects(fetchStockSnapshot('AAPL', new AbortController().signal, async (url, options) => {
    if (new URL(url, 'https://example.com').searchParams.get('path')?.includes('/range/')) return Response.json({}, { status: 503 })
    return fetcher(url, options)
  }, now), /일별 시세/)
})

test('rate limits and known access failures are not retried immediately and missing prices have a specific error', async () => {
  for (const [status, code] of [[429, 'MARKET_RATE_LIMITED'], [503, 'MARKET_ACCESS_DENIED']]) {
    let detailsCalls = 0
    await assert.rejects(fetchStockSnapshot('AAPL', new AbortController().signal, async (url, options) => {
      if (new URL(url, 'https://example.com').searchParams.get('path')?.includes('/v3/')) { detailsCalls++; return Response.json({ code }, { status }) }
      return mock()(url, options)
    }, now), status === 429 ? /일시적으로 제한/ : /기업 정보를 확인하지/)
    assert.equal(detailsCalls, 1)
  }
  await assert.rejects(fetchStockSnapshot('AAPL', new AbortController().signal, mock('/range/'), now), /기업 정보는 확인했지만 일별 시세/)
})

test('a partial refresh preserves dated same-symbol company data, news and peers; confirmed empty results clear old lists', async () => {
  const confirmed = await fetchStockSnapshot('AAPL', new AbortController().signal, mock(), now)
  const original = now - 60000
  const previous = { ...confirmed, details: { ticker: 'AAPL', name: 'Apple', market_cap: 1000, primary_exchange: 'XNAS', list_date: '1980-12-12' }, news: [{ title: 'Confirmed news' }], related: ['MSFT'], resourceSources: Object.fromEntries(['details', 'news', 'related'].map(part => [part, { fetchedAt: original, stale: false }])) }
  const incoming = { ...confirmed, details: { ticker: 'AAPL', name: 'Apple SEC' }, companySource: 'SEC EDGAR', issues: ['상세 기업 정보', '뉴스', '관련 종목'], news: [], related: [], resourceSources: {} }
  const result = retainStockResources(previous, incoming, now)
  assert.equal(result.details.market_cap, 1000)
  assert.equal(result.companySource, 'Polygon / Massive')
  assert.deepEqual(result.news, previous.news)
  assert.deepEqual(result.related, ['MSFT'])
  for (const part of ['details', 'news', 'related']) assert.deepEqual(result.resourceSources[part], { fetchedAt: original, stale: true })
  assert.deepEqual(incoming.news, [])
  assert.equal(previous.resourceSources.details.stale, false)
  const cleared = retainStockResources(previous, confirmed, now)
  assert.deepEqual(cleared.news, [])
  assert.deepEqual(cleared.related, [])
  assert.equal(cleared.resourceSources.news.stale, false)
  assert.equal(retainStockResources({ ...previous, symbol: 'MSFT' }, incoming, now), incoming)
  const expired = { ...previous, resourceSources: { details: { fetchedAt: now - 24 * 3600000 - 1 }, news: { fetchedAt: now - 6 * 3600000 - 1 }, related: { fetchedAt: now - 7 * 86400000 - 1 } } }
  const rejected = retainStockResources(expired, incoming, now)
  assert.equal(rejected.details.market_cap, undefined)
  assert.deepEqual(rejected.news, [])
  assert.deepEqual(rejected.related, [])
})

test('provider cache timestamps survive the snapshot and optional transient failures retry once', async () => {
  const attempts = new Map(), original = now - 3600000
  const fetcher = async (url, options) => {
    const path = new URL(url, 'https://example.com').searchParams.get('path') || ''
    if (path.includes('/news?') || path.includes('/related-companies/')) {
      attempts.set(path, (attempts.get(path) || 0) + 1)
      if (attempts.get(path) === 1) return Response.json({}, { status: 503 })
    }
    const response = await mock()(url, options), body = await response.json()
    return Response.json({ ...body, sourceInfo: { source: 'Polygon / Massive', fetchedAt: original, stale: false } })
  }
  const snapshot = await fetchStockSnapshot('AAPL', new AbortController().signal, fetcher, now)
  assert.deepEqual(snapshot.issues, [])
  assert.deepEqual([...attempts.values()], [2, 2])
  for (const part of ['details', 'news', 'related']) assert.equal(snapshot.resourceSources[part].fetchedAt, original)
  for (const status of [429, 403]) {
    let calls = 0
    const partial = await fetchStockSnapshot('AAPL', new AbortController().signal, async (url, options) => {
      if (new URL(url, 'https://example.com').searchParams.get('path')?.includes('/news?')) { calls++; return Response.json({}, { status }) }
      return mock()(url, options)
    }, now)
    assert.equal(calls, 1)
    assert.ok(partial.issues.includes('뉴스'))
  }
})
