import test from 'node:test'
import assert from 'node:assert/strict'
import { stockPayloadIssue } from '../lib/stock-contracts.js'
import { fixturePayload, FIXED_AT as now } from './e2e/stock-fixtures.mjs'

const options = { symbol: 'NVDA', now }
test('shared contracts reject wrong identities, malformed numbers and unsafe news URLs without exposing values', () => {
  const details = fixturePayload('details')
  details.results.ticker = 'AAPL'
  assert.equal(stockPayloadIssue('details', details, options).code, 'symbol_mismatch')
  const previous = fixturePayload('previous')
  previous.results[0].T = 'AAPL'
  assert.equal(stockPayloadIssue('previous', previous, options).code, 'symbol_mismatch')
  const history = fixturePayload('history')
  history.results[0].c = 'PRIVATE_UPSTREAM_BODY'
  const issue = stockPayloadIssue('history', history, options)
  assert.equal(issue.code, 'invalid_response')
  assert.ok(!JSON.stringify(issue).includes('PRIVATE_UPSTREAM_BODY'))
  const news = fixturePayload('news')
  news.results[0].article_url = 'javascript:alert(1)'
  assert.equal(stockPayloadIssue('news', news, options).code, 'invalid_response')
})

test('annual contracts preserve losses and zero EPS but reject quarterly periods, invalid dates and future filings', () => {
  const annual = fixturePayload('financials')
  assert.equal(stockPayloadIssue('financials', annual, options), null)
  assert.equal(annual.results[0].financials.income_statement.diluted_earnings_per_share.value, 0)
  annual.results[0].start_date = '2025-10-01'
  assert.equal(stockPayloadIssue('financials', annual, options).code, 'invalid_response')
  annual.results[0].start_date = '2025-01-01'
  annual.results[0].filing_date = '2026-02-30'
  assert.equal(stockPayloadIssue('financials', annual, options).code, 'invalid_response')
  annual.results[0].filing_date = '2026-10-22'
  assert.equal(stockPayloadIssue('financials', annual, options).code, 'future_filing')
  annual.results[0].filing_date = '2026-02-01'
  annual.results[0].financials.income_statement.diluted_earnings_per_share.unit = 'USD'
  assert.equal(stockPayloadIssue('financials', annual, options).code, 'invalid_response')
})

test('chart contracts enforce the requested period, sorted real observations and valid source timestamps', () => {
  const chart = fixturePayload('chart')
  assert.equal(stockPayloadIssue('chart', chart, { ...options, period: '1M' }), null)
  assert.equal(stockPayloadIssue('chart', chart, { ...options, period: '1D' }).code, 'period_mismatch')
  chart.points.reverse()
  assert.equal(stockPayloadIssue('chart', chart, options).code, 'invalid_response')
  chart.points.reverse()
  chart.points.at(-1).t = now + 60000
  assert.equal(stockPayloadIssue('chart', chart, options).code, 'future_observation')
  chart.points.at(-1).t = now - 60000
  chart.fetchedAt = now + 60000
  assert.equal(stockPayloadIssue('chart', chart, options).code, 'future_timestamp')
})
