import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { simpleMovingAverage, compareChartReturns } from '../src/lib/chartAnalysis.ts'
const points = (n, price = i => i + 1) => Array.from({ length: n }, (_, i) => ({ t: (i + 1) * 86400000, c: price(i) }))
const primary = overrides => ({ points: points(60), currency: 'USD', interval: '1d', period: '6M', ...overrides })
const benchmark = overrides => ({ symbol: 'VOO', ...primary(), baseline: { c: 9999, label: 'Independent baseline' }, fetchedAt: 1, stale: false, ...overrides })
test('SMA includes exactly N closes, never fills warm-up, and uses history before the visible window', () => {
  const data = points(60), before = structuredClone(data)
  const ma20 = simpleMovingAverage(data, 20), ma50 = simpleMovingAverage(data, 50)
  assert.ok(ma20.slice(0, 19).every(p => p.value === null))
  assert.ok(Math.abs(ma20[19].value - 10.5) < 1e-10)
  assert.ok(Math.abs(ma20.at(-1).value - 50.5) < 1e-10)
  assert.ok(ma50.slice(0, 49).every(p => p.value === null))
  assert.ok(Math.abs(ma50[49].value - 25.5) < 1e-10)
  assert.ok(simpleMovingAverage(data.slice(0, 12), 20).every(p => p.value === null))
  assert.deepEqual(data, before)
})
test('invalid/missing prices never become zeros in moving averages and valid large means stay finite', () => {
  const data = points(40); data[19].c = NaN
  assert.equal(simpleMovingAverage(data, 20)[38].value, null)
  assert.ok(simpleMovingAverage(data, 20)[39].value > 0)
  assert.ok(Number.isFinite(simpleMovingAverage(points(20, () => 1e307), 20).at(-1).value))
})
test('comparison starts at the first exact common close and never uses the 1D/YTD headline baseline', () => {
  const p = primary({ points: points(4, i => 100 + i * 10) })
  const b = benchmark({ points: points(4, i => 200 + i * 10).slice(1) })
  const before = structuredClone({ p, b }), result = compareChartReturns(p, b)
  assert.equal(result.status, 'ok'); assert.equal(result.points.length, 3)
  assert.deepEqual(result.points[0], { t: p.points[1].t, stock: 0, benchmark: 0, difference: 0 })
  const last = result.points.at(-1)
  assert.ok(Math.abs(last.stock - (130 / 110 - 1) * 100) < 1e-10)
  assert.ok(Math.abs(last.benchmark - (230 / 210 - 1) * 100) < 1e-10)
  assert.equal(last.difference, last.stock - last.benchmark)
  assert.deepEqual({ p, b }, before)
})
test('comparison rejects wrong identity, periods, currencies, intervals, invalid data and insufficient common times', () => {
  for (const patch of [{ symbol: 'SPY' }, { period: '1Y' }, { currency: 'EUR' }, { interval: '1wk' }, { points: points(4).map(p => ({ ...p, t: p.t + 1 })) }, { points: [{ t: 1, c: 0 }, { t: 2, c: 10 }] }, { points: [{ t: 2, c: 10 }, { t: 1, c: 11 }] }]) {
    assert.equal(compareChartReturns(primary(), benchmark(patch)).status, 'unavailable')
  }
  const b = benchmark({ points: points(60).filter((_, i) => i % 2 === 0) })
  const result = compareChartReturns(primary(), b)
  assert.equal(result.points.length, 30)
  assert.ok(result.points.every(p => b.points.some(b => b.t === p.t)))
  assert.equal(result.points.at(-1).t, primary().points.at(-2).t)
})
