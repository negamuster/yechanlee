import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFREDCSV, fredEconomicUrl } from '../lib/fred-economic.js'
import { collectEconomicSnapshot, createEconomicHandler } from '../lib/economic-indicators.js'
import { validEconomicSnapshot, economicStatus, economicRetrieval, economicPoints, DAY } from '../lib/economic-series.js'
import { economicCollectionReport } from '../lib/economic-collection-report.js'
import { inspectHealth } from '../lib/data-health.js'
import { economicFixture, blsFixture, effrFixture, fredFixture, ECONOMIC_NOW as now } from './fixtures/economic-indicators.mjs'

const window = { from: '2020-01-01', to: '2026-10-21' }
const json = value => Response.json(value)
function providers({ bls = () => new Response('', { status: 503 }), fred = () => new Response(fredFixture()), fed = () => json(effrFixture()) } = {}) {
  const calls = [], waits = []
  return { calls, waits, wait: async ms => waits.push(ms), fetchImpl: async (url, options) => {
    calls.push({ url, options })
    return url.includes('bls.gov') ? bls(url, options) : url.includes('fred.stlouisfed.org') ? fred(url, options) : fed(url, options)
  } }
}
const fallback = options => collectEconomicSnapshot({ previous: economicFixture(), now, ...options })

test('FRED CSV maps exact monthly BLS series, ignores earlier history, and preserves explicit gaps/zero', () => {
  const csv = '\uFEFF' + fredFixture().replace('2020-01-01,100,4.1', '1948-01-01,,3.4\n2020-01-01,100,0').replace('2026-08-01,104,4.1', '2026-08-01,.,').replaceAll('\n', '\r\n')
  const cpi = parseFREDCSV(csv, 'cpi', window), unemployment = parseFREDCSV(csv, 'unemployment', window)
  assert.equal(cpi.length, 81); assert.equal(unemployment.length, 81)
  assert.equal(unemployment[0].value, 0); assert.equal(cpi.at(-2).value, null); assert.equal(unemployment.at(-2).value, null)
  assert.equal(cpi.at(-1).value, 104); assert.equal(unemployment.at(-1).value, 4.2)
  assert.match(fredEconomicUrl(window.from, window.to), /id=CPIAUCNS,UNRATE&cosd=2020-01-01&coed=2026-10-21$/)
})

test('FRED rejects wrong/duplicate headers, malformed/duplicate/future dates, unsupported values and truncated history', () => {
  for (const csv of [
    '<html>unavailable</html>', fredFixture().replace('CPIAUCNS', 'CPIAUCSL'), fredFixture().replace('UNRATE', 'CPIAUCNS'),
    fredFixture().replace('2020-01-01', '2020-13-01'), fredFixture().replace('2020-02-01', '2020-01-01'),
    fredFixture() + '2027-01-01,104,4.2\n', fredFixture().replace('2020-01-01,100', '2020-01-01,1e2'),
    fredFixture().replace('2020-01-01,100,4.1\n', ''), fredFixture().replace('2021-05-01,100,4.1\n', ''),
    'observation_date,CPIAUCNS,UNRATE\n2026-09-01,104,4.2\n',
  ]) assert.throws(() => parseFREDCSV(csv, 'cpi', window), /invalid_fred_csv|fred_history_missing/)
  assert.throws(() => parseFREDCSV(fredFixture(), 'effr', window), /invalid_fred_csv/)
})

test('direct BLS success never requests FRED and records the original retrieval route', async () => {
  const p = providers({ bls: () => json(blsFixture()), fred: () => assert.fail('no fallback needed') })
  const data = await fallback(p)
  assert.equal(p.calls.length, 2)
  assert.deepEqual(data.series.map(s => s.retrievedVia), ['bls', 'bls', 'nyfed'])
  assert.ok(data.series.every(s => !s.error && !s.primaryFailureReason && !s.fallbackFailureReason))
  assert.equal(economicCollectionReport(data, now).exitCode, 0)
})

test('BLS outage downloads one shared FRED CSV, records its real receipt, and succeeds with warnings', async () => {
  const p = providers(), later = now + DAY
  const data = await fallback({ ...p, now: later })
  assert.equal(p.calls.filter(c => c.url.includes('bls.gov')).length, 3)
  assert.equal(p.calls.filter(c => c.url.includes('fred.stlouisfed.org')).length, 1)
  for (const s of data.series.slice(0, 2)) {
    assert.equal(s.error, null); assert.equal(s.failureReason, null); assert.equal(s.retrievedVia, 'fred')
    assert.equal(s.primaryFailureReason, 'http_503'); assert.equal(s.fallbackFailureReason, null)
    assert.equal(s.collectedAt, new Date(later).toISOString()); assert.equal(s.attemptedAt, s.collectedAt)
    assert.equal(economicStatus(s, later), 'ok')
  }
  assert.equal(economicRetrieval(data.series[0]).seriesId, 'CPIAUCNS')
  assert.equal(economicRetrieval(data.series[1]).url, 'https://fred.stlouisfed.org/series/UNRATE')
  assert.equal(data.series[2].retrievedVia, 'nyfed')
  const report = economicCollectionReport(data, later)
  assert.equal(report.exitCode, 0); assert.equal(report.warnings.length, 2)
  assert.match(report.summary, /WARN.*FRED \(BLS 통계\)/)
  const health = inspectHealth('indicators', data, later)
  assert.equal(health.errors.length, 0); assert.match(health.warnings.join(' '), /retrieved via FRED/)
})

test('one invalid BLS series uses FRED without replacing independently successful BLS observations or notes', async () => {
  const raw = blsFixture(); raw.Results.series[0].data.shift()
  raw.Results.series[1].data[0].footnotes = [{ text: 'Official BLS note' }]
  const p = providers({ bls: () => json(raw), fred: () => new Response(fredFixture().replace('2026-09-01,104,4.2', '2026-09-01,104,99')) })
  const data = await fallback(p)
  assert.equal(data.series[0].retrievedVia, 'fred'); assert.equal(data.series[0].primaryFailureReason, 'invalid_or_regressed_series')
  assert.equal(data.series[1].retrievedVia, 'bls'); assert.equal(data.series[1].observations.at(-1).value, 4.2)
  assert.equal(data.series[1].observations.at(-1).note, 'Official BLS note')
})

test('both routes failing preserve the previous receipt, observations and successful retrieval route', async () => {
  const previous = await fallback(providers())
  const p = providers({ bls: () => new Response('', { status: 429 }), fred: () => new Response('private body', { status: 403 }) })
  const data = await fallback({ ...p, previous, now: now + DAY })
  for (let i = 0; i < 2; i++) {
    const s = data.series[i]
    assert.equal(s.error, 'unavailable'); assert.equal(s.primaryFailureReason, 'http_429')
    assert.equal(s.fallbackFailureReason, 'http_403'); assert.equal(s.failureReason, 'http_403')
    assert.equal(s.collectedAt, previous.series[i].collectedAt); assert.deepEqual(s.observations, previous.series[i].observations)
    assert.equal(s.retrievedVia, 'fred'); assert.equal(s.attemptedAt, new Date(now + DAY).toISOString())
    assert.equal(economicStatus(s, now + DAY), 'stale')
  }
  assert.equal(data.series[2].error, null)
  assert.equal(economicCollectionReport(data, now + DAY).exitCode, 1)
  assert.doesNotMatch(JSON.stringify(data), /private body/)
})

test('FRED retries only transient requests and a missing rate-limit wait does not cause repeated downloads', async () => {
  let n = 0
  const p = providers({ fred: () => ++n === 1 ? new Response('', { status: 503 }) : new Response(fredFixture()) })
  assert.equal((await fallback(p)).series[0].error, null)
  assert.equal(n, 2); assert.deepEqual(p.waits, [1000, 2000, 1000])
  const limited = providers({ fred: () => new Response('', { status: 429 }) })
  const result = await fallback(limited)
  assert.equal(limited.calls.filter(c => c.url.includes('fred.stlouisfed.org')).length, 1)
  assert.equal(result.series[0].fallbackFailureReason, 'http_429')
})

test('bad or regressed fallback cannot replace the good history; good other series still recover', async () => {
  for (const csv of [fredFixture().replace('2026-09-01,104,4.2\n', ''), fredFixture().replace('2020-01-01,100', '2020-01-01,0'), fredFixture().replace('2020-01-01,100,4.1\n', '')]) {
    const data = await fallback(providers({ fred: () => new Response(csv) }))
    assert.equal(data.series[0].error, 'unavailable')
    assert.deepEqual(data.series[0].observations, economicFixture().series[0].observations)
    assert.equal(data.series[0].collectedAt, economicFixture().series[0].collectedAt)
  }
  const onlyCPIBad = await fallback(providers({ fred: () => new Response(fredFixture().replace('2020-01-01,100', '2020-01-01,0')) }))
  assert.equal(onlyCPIBad.series[1].error, null); assert.equal(onlyCPIBad.series[1].retrievedVia, 'fred')
})

test('return to BLS clears fallback diagnostics, uses actual BLS notes and never calls FRED', async () => {
  const previous = await fallback(providers())
  const p = providers({ bls: () => json(blsFixture()), fred: () => assert.fail('BLS recovered') })
  const recovered = await fallback({ ...p, previous, now: now + DAY })
  for (const s of recovered.series.slice(0, 2)) {
    assert.equal(s.retrievedVia, 'bls'); assert.equal(s.primaryFailureReason, null); assert.equal(s.fallbackFailureReason, null)
    assert.equal(s.error, null); assert.equal(s.collectedAt, new Date(now + DAY).toISOString())
  }
  assert.equal(economicCollectionReport(recovered, now + DAY).warnings.length, 0)
})

test('fallback retains prior BLS notes with their original values/times even when FRED revises a value', async () => {
  const previous = economicFixture()
  previous.series[0].observations[0].note = 'Original BLS historical note'
  previous.series[0].observations[1].value = null
  previous.series[0].observations[1].note = 'Missing observation explanation'
  const csv = fredFixture().replace('2020-01-01,100', '2020-01-01,101').replace('2020-02-01,100', '2020-02-01,.')
  const collected = await fallback({ ...providers({ fred: () => new Response(csv) }), previous, now: now + DAY })
  const first = collected.series[0].observations[0]
  assert.equal(first.value, 101); assert.equal(first.note, undefined)
  assert.deepEqual(first.priorNote, { text: 'Original BLS historical note', value: 100, collectedAt: previous.series[0].collectedAt })
  assert.equal(economicPoints(collected.series[0])[1].priorNote.text, 'Missing observation explanation')
  const repeated = await fallback({ ...providers({ fred: () => new Response(csv) }), previous: collected, now: now + 2 * DAY })
  assert.deepEqual(repeated.series[0].observations[0].priorNote, first.priorNote)
  const direct = blsFixture(); direct.Results.series[0].data.at(-1).footnotes = [{ text: 'Current direct BLS note' }]
  const recovered = await fallback({ ...providers({ bls: () => json(direct) }), previous: repeated, now: now + 3 * DAY })
  assert.equal(recovered.series[0].observations[0].note, 'Current direct BLS note')
  assert.equal(recovered.series[0].observations[0].priorNote, undefined)
})

test('download time never overrides an old observation period and missing YoY input remains missing', async () => {
  const csv = fredFixture().split('\n').filter(line => !/^2026-(0[7-9])/.test(line)).join('\n')
  const data = await fallback(providers({ fred: () => new Response(csv) }))
  assert.equal(data.series[0].error, 'unavailable') // Cannot regress an already received September.
  const previous = economicFixture(); previous.series[0].observations = previous.series[0].observations.filter(p => p.date < '2026-07-01')
  previous.series[1].observations = previous.series[1].observations.filter(p => p.date < '2026-07-01')
  const old = await fallback({ ...providers({ fred: () => new Response(csv) }), previous })
  assert.equal(old.series[0].error, null); assert.equal(economicStatus(old.series[0], now), 'stale')
  const gap = await fallback(providers({ fred: () => new Response(fredFixture().replace('2025-09-01,100,4.1', '2025-09-01,.,4.1')) }))
  assert.equal(economicPoints(gap.series[0]).at(-1).value, null)
})

test('legacy snapshots remain valid and incompatible routes/unsafe diagnostics cannot be published', async () => {
  const legacy = economicFixture(); assert.equal(validEconomicSnapshot(legacy, now), true)
  assert.equal(economicRetrieval(legacy.series[0]).via, 'bls')
  const good = await fallback(providers()); assert.equal(validEconomicSnapshot(good, now), true)
  for (const mutate of [s => { s.series[2].retrievedVia = 'fred' }, s => { s.series[0].retrievedVia = 'nyfed' }, s => { s.series[0].primaryFailureReason = 'sensitive upstream body' }, s => { s.series[0].primaryFailureReason = null }, s => { s.series[0].fallbackFailureReason = 'http_403' }]) {
    const data = structuredClone(good); mutate(data); assert.equal(validEconomicSnapshot(data, now), false)
    assert.throws(() => economicCollectionReport(data, now), /invalid_collection_report/)
  }
  const badNote = structuredClone(good)
  badNote.series[0].observations[0].priorNote = { text: 'note', value: 100, collectedAt: new Date(now + DAY).toISOString() }
  assert.equal(validEconomicSnapshot(badNote, now), false)
})

test('handler preserves retrieval provenance and refuses older direct snapshots after a fallback receipt', async () => {
  const current = await fallback({ ...providers(), now: now + DAY })
  const handler = createEconomicHandler({ snapshot: current, snapshotUrl: 'https://example.test/economic.json', now: () => now + DAY, fetchImpl: async () => json(economicFixture()) })
  const response = await handler(new Request('https://example.test/api/economic-indicators'))
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.series[0].retrievedVia, 'fred'); assert.equal(data.series[0].primaryFailureReason, 'http_503')
  assert.equal(data.series[0].collectedAt, new Date(now + DAY).toISOString())
})
