import test from 'node:test'
import assert from 'node:assert/strict'
import { completedBars, quoteFromBars, freshSnapshot, usableSnapshot, fetchStockSnapshot, STOCK_TTL, STOCK_MAX_AGE } from '../src/lib/stockSnapshot.ts'
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
  const path = new URL(url, 'https://example.com').searchParams.get('path')
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
  const fetcher = ticker => async url => new URL(url, 'https://example.com').searchParams.get('path').includes('/prev?')
    ? Response.json({ results: [{ ...bar('2026-10-06', 110), T: ticker }, { ...bar('2026-10-07', 999), T: ticker }] })
    : mock()(url)
  const snapshot = await fetchStockSnapshot('AAPL', new AbortController().signal, fetcher('AAPL'), now)
  assert.equal(quoteFromBars(snapshot.bars).changePct, 10)
  assert.equal(snapshot.bars.length, 2)
  const mismatch = await fetchStockSnapshot('AAPL', new AbortController().signal, fetcher('MSFT'), now)
  assert.equal(quoteFromBars(mismatch.bars).latest.c, 105)
})
