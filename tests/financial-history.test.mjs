import test from 'node:test'
import assert from 'node:assert/strict'
import { financialHistory, field } from '../lib/financial-history.js'
import { stockPayloadIssue } from '../lib/stock-contracts.js'
import { financialFacts, FINANCIAL_NOW as now } from './fixtures/financial-history.mjs'
const history = data => financialHistory(data, '1', now)
const rows = (data, tag) => data.facts['us-gaap'][tag].units.USD
const revenue = 'RevenueFromContractWithCustomerExcludingAssessedTax', ocf = 'NetCashProvidedByUsedInOperatingActivities', capex = 'PaymentsToAcquirePropertyPlantAndEquipment'
const response = h => ({ symbol: 'NVDA', source: 'SEC EDGAR', fetchedAt: now, stale: false, status: 'ok', results: h.annual, quarterly: h.quarterly, ttm: h.ttm })

test('five annual years, eight discrete quarters and TTM share validated periods and original filing sources', () => {
  const h = history(financialFacts())
  assert.equal(h.annual.length, 5); assert.equal(h.quarterly.length, 8); assert.equal(h.ttm.length, 1)
  assert.equal(stockPayloadIssue('financials', response(h), { now, symbol: 'NVDA' }), null)
  assert.equal(field(h.ttm[0], 'revenues').value, 180)
  assert.equal(field(h.ttm[0], 'operating_cash_flow').value, 18)
  assert.equal(field(h.ttm[0], 'capital_expenditures').value, 6)
  assert.equal(field(h.ttm[0], 'free_cash_flow').value, 12)
  assert.equal(h.ttm[0].financials.income_statement.diluted_earnings_per_share, undefined)
  assert.ok(field(h.ttm[0], 'free_cash_flow').sources.length > 4)
})

test('six-month cash flow becomes a genuine second-quarter difference; Q4 is annual minus nine months, never annual EPS minus YTD EPS', () => {
  const h = history(financialFacts()), q2 = h.quarterly[0], q4 = h.quarterly.find(q => q.end_date === '2025-12-31')
  assert.equal(field(q2, 'operating_cash_flow').value, 6)
  assert.equal(field(q2, 'operating_cash_flow').calculation, 'difference')
  assert.deepEqual(field(q2, 'operating_cash_flow').sources.map(s => s.value), [11, 5])
  assert.equal(q4.start_date, '2025-10-01'); assert.equal(q4.calculated, true)
  assert.equal(field(q4, 'revenues').value, 40)
  assert.equal(field(q4, 'free_cash_flow').value, 2)
  assert.equal(q4.financials.income_statement.diluted_earnings_per_share, undefined)
})

test('losses and zero Capex remain numbers; negative Capex is not silently converted to a cash outflow', () => {
  const data = financialFacts()
  const first = rows(data, ocf).find(r => r.end === '2025-03-31'); first.val = -5
  const q1 = history(data).quarterly.find(q => q.end_date === first.end)
  assert.equal(field(q1, 'free_cash_flow').value, -5)
  assert.equal(field(q1, 'capital_expenditures').value, 0)
  rows(data, capex).find(r => r.end === first.end).val = -1
  assert.equal(field(history(data).quarterly.find(q => q.end_date === first.end), 'free_cash_flow'), undefined)
})

test('a missing quarter prevents TTM; cumulative six- and nine-month rows never masquerade as quarters', () => {
  const data = financialFacts()
  for (const fact of Object.values(data.facts['us-gaap'])) for (const [unit, records] of Object.entries(fact.units)) fact.units[unit] = records.filter(r => !r.accn.endsWith('-26-000001'))
  const h = history(data)
  assert.deepEqual(h.ttm, [])
  assert.ok(h.quarterly.every(q => (Date.parse(q.end_date) - Date.parse(q.start_date)) / 86400000 <= 110))
  assert.equal(field(h.quarterly[0], 'operating_cash_flow'), undefined)
})

test('currency and concept changes block cash-flow subtraction and FCF without converting units', () => {
  const data = financialFacts(), fact = data.facts['us-gaap'][capex]
  const first = fact.units.USD.find(r => r.end === '2026-03-31')
  fact.units.EUR = [{ ...first }]; fact.units.USD = fact.units.USD.filter(r => r !== first)
  const h = history(data)
  assert.equal(field(h.quarterly[0], 'capital_expenditures'), undefined)
  assert.equal(field(h.quarterly[1], 'free_cash_flow'), undefined)
  assert.equal(field(h.ttm[0], 'capital_expenditures'), undefined)
  assert.equal(field(h.ttm[0], 'revenues').value, 180)
})

test('amended and subsequently revised prefix values cannot contaminate a later cash-flow difference', () => {
  for (const amendment of [true, false]) {
    const data = financialFacts(), previous = rows(data, ocf).find(r => r.end === '2026-03-31')
    rows(data, ocf).push({ ...previous, val: 999, filed: '2026-09-01', form: amendment ? '10-Q/A' : '10-Q', accn: '0000000001-26-000099' })
    const h = history(data)
    assert.equal(field(h.quarterly[0], 'operating_cash_flow'), undefined)
    assert.equal(h.ttm[0] && field(h.ttm[0], 'operating_cash_flow'), undefined)
  }
})

test('a later unchanged comparative value preserves the complete original quarter; a changed comparative stays visible without filling from the superseded filing', () => {
  const data = financialFacts(), previous = rows(data, revenue).find(r => r.end === '2026-03-31')
  rows(data, revenue).push({ ...previous, filed: '2026-08-10', accn: '0000000001-26-000002' })
  let q = history(data).quarterly[1]
  assert.equal(field(q, 'operating_cash_flow').value, 5)
  rows(data, revenue).at(-1).val = 999
  q = history(data).quarterly[1]
  assert.equal(field(q, 'revenues').value, 999)
  assert.equal(field(q, 'revenues').sources[0].revised, true)
  assert.equal(field(q, 'operating_cash_flow'), undefined)
})

test('financial response validation catches wrong FCF, nonconsecutive TTM and an invented TTM EPS', () => {
  const h = history(financialFacts()), body = response(h)
  body.ttm[0].financials.cash_flow_statement.free_cash_flow.value++
  assert.ok(stockPayloadIssue('financials', body, { now }))
  body.ttm[0].financials.cash_flow_statement.free_cash_flow.value--
  body.quarterly[1].start_date = '2026-01-02'
  assert.ok(stockPayloadIssue('financials', body, { now }))
  body.quarterly[1].start_date = '2026-01-01'
  body.ttm[0].financials.income_statement.diluted_earnings_per_share = { value: 1, unit: 'USD/shares' }
  assert.ok(stockPayloadIssue('financials', body, { now }))
})

test('IFRS annual cash flows retain their reporting currency and do not fabricate foreign-issuer quarters', () => {
  const row = { start: '2025-01-01', end: '2025-12-31', filed: '2026-03-01', accn: '0000000001-26-000001', form: '20-F', val: 100 }
  const fact = val => ({ units: { EUR: [{ ...row, val }] } })
  const h = history({ cik: 1, facts: { 'ifrs-full': { Revenue: fact(100), ProfitLossFromOperatingActivities: fact(-2), CashFlowsFromUsedInOperatingActivities: fact(-5), PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities: fact(0) } } })
  assert.equal(field(h.annual[0], 'free_cash_flow').value, -5)
  assert.equal(field(h.annual[0], 'free_cash_flow').unit, 'EUR')
  assert.deepEqual(h.quarterly, []); assert.deepEqual(h.ttm, [])
})

test('reported productive-asset purchases fill Capex when PPE is absent, with an explicit scope carried through FCF', () => {
  const data = financialFacts(), gaap = data.facts['us-gaap']
  gaap.PaymentsToAcquireProductiveAssets = gaap[capex]; delete gaap[capex]
  const h = history(data)
  assert.equal(field(h.annual[0], 'capital_expenditures').basis, 'productive_assets')
  assert.equal(field(h.quarterly[0], 'capital_expenditures').value, 2)
  assert.equal(field(h.ttm[0], 'free_cash_flow').value, 12)
  assert.equal(field(h.ttm[0], 'free_cash_flow').basis, 'productive_assets')
  assert.equal(stockPayloadIssue('financials', response(h), { now }), null)
})

test('TTM never mixes PPE-only Capex with broader productive-asset purchases', () => {
  const data = financialFacts(), gaap = data.facts['us-gaap']
  gaap.PaymentsToAcquireProductiveAssets = structuredClone(gaap[capex])
  gaap[capex].units.USD = gaap[capex].units.USD.filter(r => r.end < '2026-01-01')
  const h = history(data)
  assert.equal(field(h.quarterly[0], 'capital_expenditures').basis, 'productive_assets')
  assert.equal(field(h.quarterly[2], 'capital_expenditures').basis, 'ppe')
  assert.equal(field(h.ttm[0], 'capital_expenditures'), undefined)
  assert.equal(field(h.ttm[0], 'free_cash_flow'), undefined)
  assert.equal(field(h.ttm[0], 'revenues').value, 180)
})

test('a change of accounting standard cannot create a mixed-standard TTM', () => {
  const data = financialFacts(), latest = rows(data, revenue).find(r => r.start === '2026-04-01')
  data.facts['ifrs-full'] = { Revenue: { units: { USD: [{ ...latest, filed: '2026-08-20', accn: '0000000001-26-000099' }] } } }
  const h = history(data)
  assert.equal(h.quarterly[0].accounting_standard, 'ifrs-full')
  assert.deepEqual(h.ttm, [])
})
