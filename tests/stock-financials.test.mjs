import test from 'node:test'
import assert from 'node:assert/strict'
import { annualFinancials, createFinancialsHandler } from '../lib/stock-financials.js'

const at = Date.parse('2026-10-21T00:00:00Z')
const accession = '0000320193-25-000079'
const annual = (val, overrides = {}) => ({ start: '2024-09-29', end: '2025-09-27', val, accn: accession, fy: 2025, fp: 'FY', form: '10-K', filed: '2025-10-31', ...overrides })
const instant = (val, overrides = {}) => { const row = annual(val, overrides); delete row.start; return row }
const fact = (rows, unit = 'USD') => ({ units: { [unit]: rows } })
const facts = () => ({ cik: 320193, entityName: 'Apple Inc.', facts: { 'us-gaap': {
  RevenueFromContractWithCustomerExcludingAssessedTax: fact([annual(416161000000), annual(391035000000, { start: '2023-10-01', end: '2024-09-28', fy: 2025 })]),
  NetIncomeLoss: fact([annual(-10)]), EarningsPerShareDiluted: fact([annual(0)], 'USD/shares'),
  StockholdersEquity: fact([instant(73733000000)]), Liabilities: fact([instant(285508000000)]),
} } })
test('SEC annual extraction preserves two fiscal periods, losses, zero EPS, units and original filing date', () => {
  const rows = annualFinancials(facts(), '0000320193', at)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].financials.income_statement.revenues.value, 416161000000)
  assert.equal(rows[0].financials.income_statement.net_income_loss.value, -10)
  assert.equal(rows[0].financials.income_statement.diluted_earnings_per_share.value, 0)
  assert.equal(rows[0].financials.income_statement.diluted_earnings_per_share.unit, 'USD/shares')
  assert.equal(rows[1].start_date, '2023-10-01', 'comparative FY is identified by dates, not the later filing fiscal-year label')
  assert.equal(rows[0].filing_date, '2025-10-31')
  assert.equal(rows[0].financials.balance_sheet.equity.value, 73733000000)
  assert.ok(rows[0].source_filing_url.endsWith('/0000320193-25-000079-index.html'))
  assert.throws(() => annualFinancials(facts(), '0000000001', at), /mismatch/)
})
test('quarterly, nine-month, multi-year, future and wrong-period facts never become annual metrics', () => {
  const data = facts(), gaap = data.facts['us-gaap']
  gaap.RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(
    annual(999, { form: '10-Q', end: '2026-09-27' }), annual(999, { start: '2025-01-01' }),
    annual(999, { start: '2022-01-01' }), annual(999, { start: '2025-09-28', end: '2026-09-26', filed: '2026-10-31' }),
  )
  gaap.StockholdersEquity = fact([instant(999, { end: '2025-06-30' })])
  const rows = annualFinancials(data, '320193', at)
  assert.equal(rows.length, 2); assert.equal(rows[0].end_date, '2025-09-27')
  assert.equal(rows[0].financials.balance_sheet.equity, undefined)
})
test('a restatement does not mix missing fields from the superseded accession, nor ambiguous units or wrong EPS units', () => {
  const data = facts(), gaap = data.facts['us-gaap']
  gaap.RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(annual(420000000000, { form: '10-K/A', filed: '2026-02-01', accn: '0000320193-26-000010' }))
  const revised = annualFinancials(data, '320193', at)[0]
  assert.equal(revised.financials.income_statement.revenues.value, 420000000000)
  assert.equal(revised.financials.income_statement.net_income_loss, undefined)
  gaap.RevenueFromContractWithCustomerExcludingAssessedTax.units.EUR = [annual(123, { form: '10-K/A', filed: '2026-02-01', accn: '0000320193-26-000010' })]
  assert.equal(annualFinancials(data, '320193', at)[0].financials.income_statement.revenues, undefined)
  gaap.EarningsPerShareDiluted = fact([annual(10)], 'USD')
  assert.equal(annualFinancials(data, '320193', at)[1].financials.income_statement.diluted_earnings_per_share, undefined)
})
test('standard IFRS annual facts are supported without converting currency or substituting basic EPS', () => {
  const data = { cik: 1, facts: { 'ifrs-full': { Revenue: fact([annual(100, { form: '20-F' })], 'EUR'), ProfitLoss: fact([annual(10, { form: '20-F' })], 'EUR'), EquityAttributableToOwnersOfParent: fact([instant(50, { form: '20-F' })], 'EUR') } } }
  const row = annualFinancials(data, '1', at)[0]
  assert.equal(row.accounting_standard, 'ifrs-full')
  assert.equal(row.financials.income_statement.revenues.unit, 'EUR')
  assert.equal(row.financials.income_statement.diluted_earnings_per_share, undefined)
  assert.deepEqual(annualFinancials({ cik: 1, facts: { dei: {} } }, '1', at), [])
})
test('companies that changed accounting standards use the newest annual periods without mixing namespaces', () => {
  const data = facts()
  data.facts['ifrs-full'] = { Revenue: fact([annual(500, { start: '2025-01-01', end: '2025-12-31', form: '20-F', filed: '2026-03-01', accn: '0000320193-26-000011' })], 'EUR') }
  const rows = annualFinancials(data, '320193', at)
  assert.equal(rows[0].accounting_standard, 'ifrs-full')
  assert.equal(rows[0].end_date, '2025-12-31')
  assert.equal(rows[0].financials.income_statement.revenues.unit, 'EUR')
  assert.equal(rows[0].financials.balance_sheet.equity, undefined)
  assert.equal(rows[1].accounting_standard, 'us-gaap')
})
const req = symbol => new Request(`https://example.com/api/stock-financials?ticker=${symbol}`)
test('financial endpoint resolves ticker identity, deduplicates SEC requests and uses no paid API key', async () => {
  const calls = []
  const handler = createFinancialsHandler({ now: () => at, fetcher: async (url, options) => {
    calls.push(url); assert.ok(options.headers['User-Agent'].includes('@')); assert.equal(options.headers.Authorization, undefined)
    return Response.json(url.includes('company_tickers') ? { 0: { ticker: 'AAPL', cik_str: 320193 } } : facts())
  } })
  const [a, b] = await Promise.all([handler(req('AAPL')), handler(req('AAPL'))])
  assert.equal(a.status, 200); assert.deepEqual(await a.json(), await b.json()); assert.equal(calls.length, 2)
  await handler(req('AAPL')); assert.equal(calls.length, 2)
  assert.equal((await (await handler(req('ETF'))).json()).status, 'not_available')
})
test('SEC failures retain previously collected financials with their original timestamp; missing facts are not a transport error', async () => {
  let now = at, fail = false
  const handler = createFinancialsHandler({ now: () => now, fetcher: async url => fail ? new Response(null, { status: 503 }) : Response.json(url.includes('company_tickers') ? { 0: { ticker: 'AAPL', cik_str: 320193 } } : facts()) })
  const original = await (await handler(req('AAPL'))).json()
  now += 7 * 3600000; fail = true
  const stale = await (await handler(req('AAPL'))).json()
  assert.equal(stale.stale, true); assert.equal(stale.fetchedAt, original.fetchedAt); assert.deepEqual(stale.results, original.results)
  const missing = createFinancialsHandler({ now: () => at, fetcher: async url => url.includes('company_tickers') ? Response.json({ 0: { ticker: 'AAPL', cik_str: 320193 } }) : new Response(null, { status: 404 }) })
  const response = await missing(req('AAPL')); assert.equal(response.status, 200); assert.equal((await response.json()).status, 'not_available')
})
test('financial endpoint rejects arbitrary URLs, duplicate tickers, extra parameters, cross-site requests and non-GET methods', async () => {
  let calls = 0
  const handler = createFinancialsHandler({ fetcher: async () => { calls++; throw new Error() } })
  for (const query of ['ticker=https://evil.test', 'ticker=AAPL&ticker=NVDA', 'ticker=AAPL&cik=1', 'ticker=AAPL&apiKey=secret', 'ticker=']) assert.equal((await handler(new Request(`https://example.com/api/stock-financials?${query}`))).status, 400)
  assert.equal((await handler(new Request(req('AAPL'), { method: 'POST' }))).status, 405)
  assert.equal((await handler(new Request(req('AAPL'), { headers: { 'sec-fetch-site': 'cross-site' } }))).status, 403)
  assert.equal(calls, 0)
})
