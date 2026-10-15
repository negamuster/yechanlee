import test from 'node:test'
import assert from 'node:assert/strict'
import { monthGridDates } from '../src/lib/calendarGrid.ts'

test('five-week grids fill leading and trailing dates across year boundaries and February', () => {
  for (const [month, first, last] of [
    ['2026-10', '2026-09-27', '2026-10-31'],
    ['2026-11', '2026-11-01', '2026-12-05'],
    ['2026-12', '2026-11-29', '2027-01-02'],
    ['2026-02', '2026-02-01', '2026-03-07'],
    ['2028-02', '2028-01-30', '2028-03-04'],
  ]) {
    const dates = monthGridDates(month)
    assert.equal(dates.length, 35, month)
    assert.equal(dates[0], first, month)
    assert.equal(dates.at(-1), last, month)
  }
})

test('months spanning six weeks retain the last days instead of cutting them off', () => {
  const dates = monthGridDates('2026-08')
  assert.equal(dates.length, 42)
  assert.equal(dates[0], '2026-07-26')
  assert.ok(dates.includes('2026-08-31'))
  assert.equal(dates.at(-1), '2026-09-05')
})

test('all months have consecutive Sunday-to-Saturday weeks and include every day once', () => {
  for (let year = 2026; year <= 2029; year++) {
    for (let month = 1; month <= 12; month++) {
      const key = `${year}-${String(month).padStart(2, '0')}`
      const dates = monthGridDates(key)
      assert.ok(dates.length === 35 || dates.length === 42, key)
      assert.equal(new Date(`${dates[0]}T12:00:00Z`).getUTCDay(), 0, key)
      assert.equal(new Date(`${dates.at(-1)}T12:00:00Z`).getUTCDay(), 6, key)
      assert.equal(dates.filter(date => date.startsWith(key)).length, new Date(Date.UTC(year, month, 0)).getUTCDate(), key)
      assert.equal(new Set(dates).size, dates.length, key)
      for (let index = 1; index < dates.length; index++) assert.equal(Date.parse(dates[index]) - Date.parse(dates[index - 1]), 86400000, key)
    }
  }
})
