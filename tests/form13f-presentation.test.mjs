import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { holdingRows, holdingChange, nextHoldingSort, DEFAULT_HOLDING_SORT } from '../src/lib/form13fPresentation.ts'

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
