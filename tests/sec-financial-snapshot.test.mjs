import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { financialHistory } from '../lib/financial-history.js'
import { createFinancialsHandler } from '../lib/stock-financials.js'
import { financialSnapshotRecord, validFinancialRecord, SEC_TICKERS_URL, factsUrl, FINANCIAL_RETENTION } from '../lib/sec-financial-snapshot.js'
import { collectFinancialSnapshot } from '../scripts/refresh-sec-financials.mjs'
import { FINANCIAL_NOW as at, financialFacts } from './fixtures/financial-history.mjs'

const req = symbol => new Request(`https://example.com/api/stock-financials?ticker=${symbol}`)
const record = (symbol = 'AAPL', fetchedAt = at) => {
  const history = financialHistory(financialFacts(), '1', at)
  return JSON.parse(JSON.stringify({ symbol, cik: '0000000001', source: 'SEC EDGAR', status: 'ok', stale: false, fetchedAt,
    tickerSource: SEC_TICKERS_URL, factsUrl: factsUrl('0000000001'), results: history.annual, quarterly: history.quarterly, ttm: history.ttm }))
}
const snapshot = data => ({ version: 1, companies: { [data.symbol]: data } })

test('bundled real SEC records retain issuer provenance and annual/quarterly/TTM contracts', async () => {
  const stored = JSON.parse(await readFile(new URL('../data/sec-financials.json', import.meta.url)))
  const config = JSON.parse(await readFile(new URL('../config/sec-financials.json', import.meta.url)))
  assert.deepEqual(Object.keys(stored.companies).sort(), [...config.symbols].sort())
  for (const symbol of config.symbols) {
    const data = stored.companies[symbol]
    // Collection intentionally keeps expired receipts on partial failure.
    // Check provenance at its own receipt, not freshness against other issuers.
    assert.ok(validFinancialRecord(data, symbol, data.fetchedAt), symbol)
    assert.equal(data.factsUrl, factsUrl(data.cik))
  }
})

test('cold SEC failure serves verified values with original receipt and explicit stale diagnostics', async () => {
  const data = record(); let calls = 0
  const handler = createFinancialsHandler({ snapshot: snapshot(data), now: () => at + 3600000, fetcher: async () => { calls++; return new Response('private upstream body', { status: 403 }) } })
  const response = await handler(req('AAPL')), body = await response.json()
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('retry-after'), '1800')
  assert.equal(body.stale, true); assert.equal(body.fetchedAt, at)
  assert.deepEqual(body.results, data.results); assert.deepEqual(body.quarterly, data.quarterly); assert.deepEqual(body.ttm, data.ttm)
  assert.equal(body.results[0].financials.income_statement.net_income_loss.value, -10)
  assert.equal(body.results[0].financials.income_statement.diluted_earnings_per_share.value, 0)
  assert.deepEqual(body.sourceFailure, { stage: 'ticker_map', code: 'http_403', checkedAt: at + 3600000, nextRetryAt: at + 5400000 })
  assert.ok(!JSON.stringify(body).includes('private upstream body'))
  const repeated = await (await handler(req('AAPL'))).json()
  assert.deepEqual(repeated.sourceFailure, body.sourceFailure); assert.equal(calls, 1)
})

test('stored records reject wrong issuer, missing metric provenance, malformed EPS sources, future receipts and renewed expiry', () => {
  const good = record()
  assert.equal(validFinancialRecord(good, 'AAPL', at), true)
  for (const corrupt of [
    data => { data.symbol = 'NVDA' },
    data => { data.cik = '0000000002'; data.factsUrl = factsUrl(data.cik) },
    data => { delete data.results[0].financials.income_statement.revenues.sources },
    data => { data.results[0].financials.income_statement.diluted_earnings_per_share.sources = [null] },
    data => { data.stale = true },
    data => { data.factsUrl = 'https://example.com/facts' },
    data => { data.results[0].source_filing_url = data.results[0].source_filing_url.replace('/data/1/', '/data/2/') },
  ]) { const data = structuredClone(good); corrupt(data); assert.equal(validFinancialRecord(data, 'AAPL', at), false) }
  assert.equal(financialSnapshotRecord(snapshot(record('AAPL', at + 1)), 'AAPL', at), null)
  assert.ok(financialSnapshotRecord(snapshot(good), 'AAPL', at + FINANCIAL_RETENTION))
  assert.equal(financialSnapshotRecord({ ...snapshot(good), attemptedAt: new Date(at + FINANCIAL_RETENTION + 1).toISOString() }, 'AAPL', at + FINANCIAL_RETENTION + 1), null)
})

test('absent, corrupt and expired snapshots remain retryable 503, never invented empty financials', async () => {
  for (const stored of [null, snapshot(record('NVDA')), snapshot(record('AAPL', at - FINANCIAL_RETENTION - 1)), snapshot({ ...record(), cik: 'wrong' })]) {
    const handler = createFinancialsHandler({ snapshot: stored, now: () => at, fetcher: async () => new Response(null, { status: 503, headers: { 'retry-after': '600' } }) })
    const response = await handler(req('AAPL')), body = await response.json()
    assert.equal(response.status, 503); assert.equal(body.results, undefined)
    assert.equal(body.sourceFailure.code, 'http_503'); assert.equal(response.headers.get('retry-after'), '600')
  }
})

test('shared ticker-map failures deduplicate concurrent symbols and back off again after retry expiry', async () => {
  let now = at, calls = 0
  const handler = createFinancialsHandler({ now: () => now, fetcher: async () => { calls++; return new Response(null, { status: 503 }) } })
  const results = await Promise.all(['AAPL', 'NVDA', 'AAPL'].map(symbol => handler(req(symbol))))
  const bodies = await Promise.all(results.map(r => r.json()))
  assert.equal(calls, 1); assert.deepEqual(bodies[0].sourceFailure, bodies[1].sourceFailure)
  await handler(req('SATL')); assert.equal(calls, 1)
  now += 60001
  const retried = await (await handler(req('NVDA'))).json()
  assert.equal(calls, 2); assert.equal(retried.sourceFailure.nextRetryAt, now + 120000)
  // AAPL has an expired local failure but must obey the newer shared failure.
  await handler(req('AAPL')); assert.equal(calls, 2)
})

test('facts transport, JSON and conversion failures are distinct; live recovery clears stale and keeps valid empty responses', async () => {
  for (const [mode, stage, code] of [['http', 'company_facts', 'http_429'], ['json', 'company_facts', 'parse_failed'], ['identity', 'conversion', 'conversion_failed']]) {
    let now = at, failed = true, calls = 0
    const handler = createFinancialsHandler({ snapshot: snapshot(record()), now: () => now, fetcher: async url => {
      calls++
      if (url === SEC_TICKERS_URL) return Response.json({ 0: { ticker: 'AAPL', cik_str: 1 } })
      if (!failed) return Response.json(financialFacts())
      return mode === 'http' ? new Response(null, { status: 429, headers: { 'retry-after': '1200' } }) : mode === 'json' ? new Response('{invalid') : Response.json({ ...financialFacts(), cik: 2 })
    } })
    const stale = await (await handler(req('AAPL'))).json()
    assert.equal(stale.stale, true); assert.equal(stale.sourceFailure.stage, stage); assert.equal(stale.sourceFailure.code, code)
    const count = calls; await handler(req('AAPL')); assert.equal(calls, count)
    failed = false; now = stale.sourceFailure.nextRetryAt
    const recovered = await (await handler(req('AAPL'))).json()
    assert.equal(recovered.stale, false); assert.equal(recovered.fetchedAt, now); assert.equal(recovered.sourceFailure, undefined)
    assert.equal(recovered.results.length, 5)
  }
  const empty = createFinancialsHandler({ snapshot: snapshot(record()), now: () => at, fetcher: async url => url === SEC_TICKERS_URL ? Response.json({ 0: { ticker: 'AAPL', cik_str: 1 } }) : new Response(null, { status: 404 }) })
  const result = await (await empty(req('AAPL'))).json()
  assert.equal(result.status, 'not_available'); assert.equal(result.stale, false); assert.deepEqual(result.results, [])
})

test('collection keeps failed company receipts while other companies update and records explicit failures', async () => {
  const old = record(), previous = snapshot(old), now = at + 3600000
  const collected = await collectFinancialSnapshot({ symbols: ['AAPL', 'NVDA'], previous, now: () => now, handler: async request => {
    if (new URL(request.url).searchParams.get('ticker') === 'AAPL') return new Response(null, { status: 503 })
    return Response.json(record('NVDA', now))
  } })
  assert.deepEqual(collected.companies.AAPL, old)
  assert.equal(collected.companies.NVDA.fetchedAt, now)
  assert.deepEqual(collected.failures, [{ symbol: 'AAPL', code: 'collection_failed' }])
  assert.equal(collected.attemptedAt, new Date(now).toISOString())
  const expired = await collectFinancialSnapshot({ symbols: ['AAPL'], previous, now: () => at + FINANCIAL_RETENTION + 1, handler: async () => new Response(null, { status: 503 }) })
  assert.equal(expired.companies.AAPL.fetchedAt, at)
  assert.equal(financialSnapshotRecord(expired, 'AAPL', at + FINANCIAL_RETENTION + 1), null)
})

test('collection refuses stale, foreign or corrupt responses and bounds the configured ticker list', async () => {
  for (const body of [{ ...record(), stale: true }, record('NVDA'), { ...record(), cik: '0' }]) {
    const collected = await collectFinancialSnapshot({ symbols: ['AAPL'], now: () => at, handler: async () => Response.json(body) })
    assert.deepEqual(collected.companies, {}); assert.equal(collected.failures.length, 1)
  }
  for (const symbols of [[], ['AAPL', 'AAPL'], ['https://example.com'], Array.from({ length: 21 }, (_, i) => `S${i}`)]) await assert.rejects(collectFinancialSnapshot({ symbols }), /invalid_financial_collection_symbols/)
})
