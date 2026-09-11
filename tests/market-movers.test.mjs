import test from 'node:test'
import assert from 'node:assert/strict'
import { candidateDates, rankMovers, collectMovers, createMoversHandler } from '../lib/market-movers.js'

const at = Date.parse('2026-09-11T12:00:00Z')
const row = (T, c, v = 20000, vw = c) => ({ T, c, v, vw })
const request = () => new Request('https://example.com/api/market-movers')
const payload = rows => Response.json({ status: 'OK', results: rows })

test('New York completed dates exclude today/weekends across DST and UTC midnight', () => {
  assert.deepEqual(candidateDates(at).slice(0, 2), ['2026-09-10', '2026-09-09'])
  assert.equal(candidateDates(Date.parse('2026-09-12T00:30:00Z'))[0], '2026-09-10')
  assert.equal(candidateDates(Date.parse('2026-03-09T12:00:00Z'))[0], '2026-03-06')
})

test('turnover uses VWAP times volume, percent change uses prior close, with honest exclusions', () => {
  const latest = [row('AAA', 20, 20000, 10), row('BBB', 8, 40000, 12), row('NEW', 4),
    row('FLAT', 10), row('PENNY', .5), row('THIN', 20, 9999), row('NOVWAP', 7, 20000, null),
    { ...row('OTC', 20), otc: true }, row('AAA', 999), row('BAD', Infinity), row('ZVZZT', 10000)]
  const ranked = rankMovers(latest, [row('AAA', 10), row('BBB', 10), row('FLAT', 10), row('NOVWAP', 10)])
  assert.equal(ranked.turnover[0].ticker, 'BBB')
  assert.equal(ranked.turnover[0].turnover, 480000)
  assert.equal(ranked.gainers[0].ticker, 'AAA')
  assert.equal(ranked.gainers[0].changePct, 100)
  assert.equal(ranked.losers[0].ticker, 'NOVWAP')
  assert.equal(ranked.turnover.find(r => r.ticker === 'NEW').changePct, null)
  assert.ok(!ranked.turnover.some(r => ['PENNY', 'THIN', 'NOVWAP', 'OTC', 'BAD', 'ZVZZT'].includes(r.ticker)))
  assert.ok(!ranked.gainers.some(r => r.ticker === 'FLAT'))
  assert.equal(rankMovers(latest, [], 1).turnover.length, 1)
})

test('holiday gaps are skipped, but upstream failures never become false daily comparisons', async () => {
  const calls = []
  const result = await collectMovers({ key: 'test', now: at, fetchImpl: async url => {
    calls.push(url)
    return calls.length === 1 ? payload([row('AAA', 20)]) : calls.length === 2
      ? Response.json({ status: 'OK', resultsCount: 0 }) : payload([row('AAA', 10)])
  } })
  assert.equal(result.previousTradingDate, '2026-09-08')
  assert.equal(result.rankings.gainers[0].changePct, 100)
  await assert.rejects(collectMovers({ key: 'test', now: at,
    fetchImpl: async () => new Response(null, { status: 429 }) }), /rate_limited/)
})

test('cache coalesces callers, preserves timestamp on failure, and expires stale data', async () => {
  let clock = at, calls = 0, fail = false
  const handler = createMoversHandler({ getKey: () => 'test', now: () => clock, fetchImpl: async () => {
    calls++
    if (fail) return new Response(null, { status: 403 })
    return payload([row('AAA', calls === 1 ? 20 : 10)])
  } })
  const results = await Promise.all([handler(request()), handler(request())])
  assert.equal(calls, 2)
  assert.equal((await results[0].json()).stale, false)
  await handler(request()); assert.equal(calls, 2)
  clock += 31 * 60000; fail = true
  const cached = await (await handler(request())).json()
  assert.equal(cached.stale, true)
  assert.equal(cached.fetchedAt, at)
  await handler(request()); assert.equal(calls, 3)
  clock += 8 * 86400000
  assert.equal((await handler(request())).status, 503)
})

test('missing key, timeout and method errors are bounded and do not expose credentials', async () => {
  const missing = createMoversHandler({ getKey: () => '', now: () => at })
  assert.equal((await missing(request())).status, 503)
  assert.equal((await missing(new Request(request(), { method: 'POST' }))).status, 405)
  const timeout = createMoversHandler({ getKey: () => 'secret', now: () => at, timeoutMs: 10,
    fetchImpl: () => new Promise(() => {}) })
  assert.deepEqual(await (await timeout(request())).json(), { error: 'timeout' })
})
