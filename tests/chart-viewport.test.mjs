import test from 'node:test'
import assert from 'node:assert/strict'
import { chartFullRange, clampChartRange, zoomChartRange, moveChartRange, latestChartRange, nearestChartIndex, preserveChartRange, visibleChartPoints } from '../src/lib/chartViewport.ts'
const points = (start, count) => Array.from({ length: count }, (_, i) => ({ t: 1000 * (start + i), c: i + 1 }))
test('zoom, movement and latest/reset stay inside confirmed bars, including tiny series', () => {
  const full = chartFullRange(100), zoomed = zoomChartRange(full, 100, .65)
  assert.deepEqual(full, { from: 0, to: 99 }); assert.ok(zoomed.from > 0 && zoomed.to < 99)
  assert.equal(moveChartRange(zoomed, 100, -100).from, 0); assert.equal(moveChartRange(zoomed, 100, 100).to, 99)
  assert.equal(latestChartRange(zoomed, 100).to, 99)
  assert.deepEqual(clampChartRange({ from: NaN, to: Infinity }, 100), full)
  assert.deepEqual(zoomChartRange(chartFullRange(2), 2, .01), chartFullRange(2))
  assert.equal(zoomChartRange(full, 100, .001).to - zoomChartRange(full, 100, .001).from, 7)
})
test('refresh preserves actual timestamps when bars append or history prepends/truncates', () => {
  const old = points(10, 100), range = { from: 20.25, to: 60.75 }
  assert.deepEqual(preserveChartRange(old, points(10, 101), range), range)
  assert.deepEqual(preserveChartRange(old, points(0, 110), range), { from: 30.25, to: 70.75 })
  assert.deepEqual(preserveChartRange(old, points(20, 90), range), { from: 10.25, to: 50.75 })
  const shrunk = preserveChartRange(old, points(90, 20), range)
  assert.ok(shrunk.from >= 0 && shrunk.to <= 19 && shrunk.to - shrunk.from >= 7)
})
test('visible tables contain only the selected bars and nearest navigation resolves actual observations', () => {
  const data = points(10, 100), range = { from: 20.25, to: 60.75 }, visible = visibleChartPoints(data, range)
  assert.equal(visible[0].t, 31000); assert.equal(visible.at(-1).t, 70000); assert.equal(visible.length, 40)
  assert.equal(nearestChartIndex(data, 30100), 20); assert.equal(nearestChartIndex(data, -1), 0); assert.equal(nearestChartIndex(data, Infinity), 99)
})
