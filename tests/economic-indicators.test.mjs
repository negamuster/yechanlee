import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { economicPoints, economicComparison, economicWindow, validEconomicSnapshot, economicStatus, DAY } from '../lib/economic-series.js'
import { parseBLS, parseEFFR, collectEconomicSnapshot, createEconomicHandler, emptyEconomicSnapshot } from '../lib/economic-indicators.js'
import { inspectHealth } from '../lib/data-health.js'
import { economicFixture, blsFixture, effrFixture, ECONOMIC_NOW as now } from './fixtures/economic-indicators.mjs'
const request = (method = 'GET', suffix = '') => new Request(`https://example.test/api/economic-indicators${suffix}`, { method })
const response = value => new Response(JSON.stringify(value))
test('BLS parser selects exact series, sorts monthly data and preserves missing-value footnotes', () => {
  const raw = blsFixture(); raw.Results.series[0].data[0].value = '-'; raw.Results.series[0].data[0].footnotes = [{ text: 'Not available' }]
  const rows = parseBLS(raw, 'CUUR0000SA0')
  assert.equal(rows[0].date, '2020-01-01'); assert.equal(rows.at(-1).value, null); assert.equal(rows.at(-1).note, 'Not available')
  assert.throws(() => parseBLS({ status: 'REQUEST_FAILED' }, 'CUUR0000SA0'))
  assert.throws(() => parseBLS(raw, 'UNKNOWN'))
  raw.Results.series[0].data[0].value = 'garbage'; assert.throws(() => parseBLS(raw, 'CUUR0000SA0'))
})
test('CPI YoY uses the same calendar month and leaves gaps in the monthly grid', () => {
  const s = economicFixture().series[0]
  s.observations = s.observations.filter(p => p.date !== '2025-09-01' && p.date !== '2026-08-01')
  const points = economicPoints(s), c = economicComparison(s)
  assert.equal(points.at(-2).date, '2026-08-01'); assert.equal(points.at(-2).value, null)
  assert.equal(c.latest.date, '2026-09-01'); assert.equal(c.latest.index, 104); assert.equal(c.latest.value, null); assert.equal(c.change, null)
  assert.ok(Math.abs(points.find(p => p.date === '2026-07-01').value - 4) < 1e-10)
})
test('month comparisons are percentage points and selected windows have 12/36/60 months', () => {
  const s = economicFixture().series[1]
  assert.ok(Math.abs(economicComparison(s).change - .1) < 1e-10)
  for (const years of [1, 3, 5]) assert.equal(economicWindow(s, years).length, years * 12)
})
test('EFFR is daily and compares the previous provided business day, not a monthly average', () => {
  const s = economicFixture().series[2], parsed = parseEFFR(effrFixture())
  assert.deepEqual(parsed, s.observations)
  assert.equal(economicComparison(s).latest.date, '2026-10-19'); assert.equal(economicComparison(s).previous.date, '2026-10-16')
  const raw = effrFixture(); raw.refRates[0].type = 'SOFR'; assert.throws(() => parseEFFR(raw))
})
test('contract rejects wrong identity/order, duplicate dates, nonfinite/out-of-range values and future timestamps', () => {
  assert.equal(validEconomicSnapshot(economicFixture(), now), true)
  for (const mutate of [s => { s.series.reverse() }, s => { s.series[0].observations.push(s.series[0].observations.at(-1)) }, s => { s.series[0].observations[0].value = NaN }, s => { s.series[1].observations[0].value = 101 }, s => { s.series[1].observations[0].date = '2020-02-30' }, s => { s.series[0].collectedAt = '2027-01-01T00:00:00Z' }, s => { s.series[0].observations.push({ date: '2026-10-01', value: 104 }) }]) {
    const s = economicFixture(); mutate(s); assert.equal(validEconomicSnapshot(s, now), false)
  }
})
test('freshness distinguishes collection age, old observation and failure without inventing a new collection time', () => {
  const s = economicFixture().series[0]
  assert.equal(economicStatus(s, now), 'ok'); assert.equal(economicStatus(s, now + 3 * DAY), 'stale'); assert.equal(economicStatus(s, now + 31 * DAY), 'unavailable')
  assert.equal(economicStatus({ ...s, error: 'unavailable' }, now), 'stale')
  assert.equal(economicStatus({ ...s, observations: s.observations.filter(p => p.date < '2026-07-01') }, now), 'stale')
})
test('collector makes one bounded BLS call for both series and one NY Fed call without keys', async () => {
  const calls = [], value = await collectEconomicSnapshot({ now, fetchImpl: async (url, options) => { calls.push([url, options]); return response(url.includes('bls.gov') ? blsFixture() : effrFixture()) } })
  assert.equal(calls.length, 2); assert.deepEqual(JSON.parse(calls[0][1].body), { seriesid: ['CUUR0000SA0', 'LNS14000000'], startyear: '2020', endyear: '2026' })
  assert.equal(validEconomicSnapshot(value, now), true); assert.ok(value.series.every(s => !s.error))
})
test('partial provider failure preserves original collection time while other series update', async () => {
  const previous = economicFixture(), later = now + DAY
  const data = await collectEconomicSnapshot({ previous, now: later, fetchImpl: async url => url.includes('bls.gov') ? new Response('', { status: 429 }) : response(effrFixture()) })
  assert.equal(data.series[0].collectedAt, previous.series[0].collectedAt); assert.equal(data.series[0].attemptedAt, new Date(later).toISOString()); assert.equal(data.series[0].error, 'unavailable')
  assert.equal(data.series[2].collectedAt, new Date(later).toISOString()); assert.equal(data.series[2].error, null)
})
test('invalid or regressed single series cannot replace a good history', async () => {
  const previous = economicFixture(), raw = blsFixture(); raw.Results.series[0].data.shift()
  const data = await collectEconomicSnapshot({ previous, now: now + DAY, fetchImpl: async url => response(url.includes('bls.gov') ? raw : effrFixture()) })
  assert.equal(data.series[0].error, 'unavailable'); assert.deepEqual(data.series[0].observations, previous.series[0].observations); assert.equal(data.series[1].error, null)
})
test('snapshot handler coalesces requests, refreshes with original timestamps and refuses rollback', async () => {
  let calls = 0, current = now, candidate = economicFixture()
  const base = economicFixture(); base.series.forEach(s => { s.collectedAt = s.attemptedAt = new Date(now - DAY).toISOString() })
  const handler = createEconomicHandler({ snapshot: base, snapshotUrl: 'https://example.test/fixed.json', now: () => current, fetchImpl: async () => { calls++; return response(candidate) } })
  const results = await Promise.all([handler(request()), handler(request())]); assert.equal(calls, 1)
  assert.equal((await results[0].json()).series[0].collectedAt, new Date(now).toISOString())
  candidate = base; current += 16 * 60000
  assert.equal((await (await handler(request())).json()).series[0].collectedAt, new Date(now).toISOString()); assert.equal(calls, 2)
  assert.equal((await handler(request('POST'))).status, 405); assert.equal((await handler(request('GET', '?series=unknown'))).status, 400)
})
test('expired or missing sources are excluded; partial failure stays usable; all missing returns 503', async () => {
  const snapshot = economicFixture(); snapshot.series[0].collectedAt = snapshot.series[0].attemptedAt = new Date(now - 31 * DAY).toISOString(); snapshot.series[0].observations = snapshot.series[0].observations.filter(p => p.date < '2026-09-01')
  const handler = createEconomicHandler({ snapshot, now: () => now })
  const r = await handler(request()); assert.equal(r.status, 200); assert.deepEqual((await r.json()).series[0].observations, [])
  const empty = createEconomicHandler({ snapshot: emptyEconomicSnapshot(), now: () => now }); assert.equal((await empty(request())).status, 503)
  const outage = createEconomicHandler({ snapshot: economicFixture(), snapshotUrl: 'https://example.test/data.json', now: () => now, fetchImpl: async () => { throw new Error('offline') } })
  assert.equal((await outage(request())).status, 200)
})
test('health checks warn on individual delayed series and fail invalid/all-unavailable responses', () => {
  const data = economicFixture(); assert.deepEqual(inspectHealth('indicators', data, now), { errors: [], warnings: [] })
  data.series[0].error = 'unavailable'; const health = inspectHealth('indicators', data, now); assert.equal(health.errors.length, 0); assert.ok(health.warnings[0].includes('cpi'))
  assert.ok(inspectHealth('indicators', emptyEconomicSnapshot(), now).errors.length)
  assert.ok(inspectHealth('indicators', {}, now).errors.length)
})
test('bundled official observations validate, with both monthly and daily series and source-specific timestamps', async () => {
  const data = JSON.parse(await readFile(new URL('../data/economic-indicators.json', import.meta.url), 'utf8'))
  const collectedAt = Math.max(...data.series.map(s => Date.parse(s.collectedAt)))
  assert.equal(validEconomicSnapshot(data, collectedAt), true); assert.ok(data.series.every(s => s.observations.length >= 60))
})
