import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { holdingRows, holdingChange, nextHoldingSort, DEFAULT_HOLDING_SORT, compareFilings, csvDocument, csvIdentifier, filteredHoldings, formatHoldingPercent, isFiling } from '../src/lib/form13fPresentation.ts'
import { filingFixture } from './fixtures/form13f.mjs'

const holding = (name, value, shares, prevShares, cusip = name, title = 'COM') => ({ name, value, shares, prevShares, cusip, title })

test('holdings search preserves original ranks, share classes and the full-portfolio denominator', () => {
  const data = [holding('ALPHABET INC', 300, 30, 20, '02079K305', 'CL A'), holding('ALPHABET INC', 100, 10, 20, '02079K107', 'CL C')]
  const original = structuredClone(data)
  const rows = holdingRows(data, 1000, 'alphabet CL C', DEFAULT_HOLDING_SORT)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].cusip, '02079K107')
  assert.equal(rows[0].rank, 2)
  assert.equal(rows[0].pct, 10)
  assert.equal(holdingRows(data, 1000, '02079k305', DEFAULT_HOLDING_SORT)[0].pct, 30)
  assert.deepEqual(data, original)
})

test('sorts raw amounts and share changes numerically with stable ties, not compact display strings', () => {
  const data = [holding('First', 950e6, 10000, 5000), holding('Second', 1.1e9, 950, 1000), holding('Third', 1.1e9, 950, 1000)]
  const names = sort => holdingRows(data, 4e9, '', sort).map(row => row.name)
  assert.deepEqual(names(DEFAULT_HOLDING_SORT), ['Second', 'Third', 'First'])
  assert.deepEqual(names({ key: 'value', direction: 'asc' }), ['First', 'Second', 'Third'])
  assert.deepEqual(names({ key: 'shares', direction: 'desc' }), ['First', 'Second', 'Third'])
  assert.deepEqual(names({ key: 'change', direction: 'asc' }), ['Second', 'Third', 'First'])
  assert.deepEqual(nextHoldingSort(DEFAULT_HOLDING_SORT, 'value'), { key: 'value', direction: 'asc' })
  assert.deepEqual(nextHoldingSort(DEFAULT_HOLDING_SORT, 'name'), { key: 'name', direction: 'asc' })
})

test('new and unavailable holdings never become a numeric zero or an infinite percentage', () => {
  const data = [holding('Unknown', 10, 2), holding('New', 10, 2, 0), holding('Unchanged', 10, 2, 2), holding('Decreased', 10, 1, 2)]
  for (const direction of ['asc', 'desc']) {
    const rows = holdingRows(data, 40, '', { key: 'change', direction })
    assert.deepEqual(rows.slice(-2).map(row => row.name), ['New', 'Unknown'])
    assert.ok(rows.slice(0, 2).every(row => Number.isFinite(row.change.percent)))
  }
  assert.deepEqual(holdingChange(data[0]), { kind: 'unknown', percent: null })
  assert.deepEqual(holdingChange(data[1]), { kind: 'new', percent: null })
  assert.deepEqual(holdingChange(data[2]), { kind: 'percent', percent: 0 })
  assert.deepEqual(holdingChange(holding('Sold', 0, 0, 5)), { kind: 'percent', percent: -100 })
})

test('comparison uses same-quarter complete CUSIP coverage, keeping share classes and independent weights', () => {
  const left = filingFixture({ holdings: [holding('Alphabet', 300, 30, 20, '02079K305', 'CL A'), holding('Alphabet', 100, 10, 10, '02079K107', 'CL C')] })
  const right = filingFixture({ holdings: [holding('ALPHABET INC', 100, 10, 10, '02079K305', 'COMMON CLASS A'), holding('Other', 900, 90, 90, '000000001')] })
  const rows = compareFilings(left, right), common = rows.find(h => h.cusip === '02079K305')
  assert.equal(rows.length, 3); assert.equal(common.leftPct, 75); assert.equal(common.rightPct, 10); assert.equal(common.difference, 65)
  assert.equal(rows.find(h => h.cusip === '02079K107').right, null)
  assert.throws(() => compareFilings(left, { ...right, period: '2026-03-31' }), /incomparable/)
  assert.throws(() => compareFilings(left, { ...right, holdingsComplete: false }), /incomparable/)
  assert.throws(() => compareFilings(left, { ...right, holdingCount: 30 }), /incomparable/)
  assert.equal(isFiling({ ...left, totalValue: 1 }), false)
})

test('quarter filters distinguish exits, decreases, new and unavailable data', () => {
  const data = filingFixture({ closedHoldings: [holding('Exited', 0, 0, 10, '999999999')] })
  assert.equal(filteredHoldings(data, 'current').length, 3)
  assert.deepEqual(filteredHoldings(data, 'closed').map(h => h.name), ['Exited'])
  assert.deepEqual(filteredHoldings(data, 'decreased').map(h => h.name), ['BETA INC'])
  assert.deepEqual(filteredHoldings(data, 'new').map(h => h.name), ['NEW INC'])
  assert.equal(filteredHoldings(data, 'all').length, 4)
  assert.equal(isFiling({ ...data, previousAvailable: false }), false)
})

test('CSV preserves UTF-8 names, raw numbers, identifiers and safely escapes spreadsheet formulas', () => {
  const csv = csvDocument([['name', 'CUSIP', 'amount'], ['한글, "Issuer"', csvIdentifier('000000001'), 1234567.25], [' =HYPERLINK("bad")', '@danger', -5], ['\tSUM(1)', '+evil', 0]])
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('\r\n'))
  assert.ok(csv.includes('"한글, ""Issuer"""')); assert.ok(csv.includes('"\'000000001"')); assert.ok(csv.includes('"1234567.25"'))
  assert.ok(csv.includes('"\' =HYPERLINK')); assert.ok(csv.includes('"\'@danger"')); assert.ok(csv.includes('"\'\tSUM')); assert.ok(csv.includes('"-5"'))
})
test('small positive holdings never display as a zero allocation', () => {
  assert.equal(formatHoldingPercent(0.0001), '<0.01%')
  assert.equal(formatHoldingPercent(0), '0%')
  assert.equal(formatHoldingPercent(33.333333), '33.33%')
  const rows = holdingRows([holding('Larger', 2, 1, 1), holding('Smaller', 1, 1, 1)], 1e6, '', { key: 'pct', direction: 'asc' })
  assert.deepEqual(rows.map(h => h.name), ['Smaller', 'Larger'])
})
