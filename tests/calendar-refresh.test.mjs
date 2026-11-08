import test from 'node:test'
import assert from 'node:assert/strict'
import { refreshCalendarSnapshots } from '../lib/calendar-refresh.js'
import { SOURCES } from '../lib/calendar.js'
import { FRED_RELEASES } from '../lib/fred-calendar.js'
const at = Date.parse('2026-11-08T12:00:00Z')
const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:one\nDTSTART:20261110T133000Z\nSUMMARY:Consumer Price Index\nEND:VEVENT\nEND:VCALENDAR'
const page = rid => `<div id="release-dates-pager"><tbody><tr><td>Tuesday November 10, 2026</td></tr><tr><td>7:30 am</td><td><a href="/release?rid=${rid}">Title</a></td></tr></tbody>Releases 1 - 1 of 1</div>All times are US Central Time.`
const log = { log() {}, warn() {} }

test('BLS success still refreshes all nine FRED families independently', async () => {
  const saved = new Map(), calls = []
  const result = await refreshCalendarSnapshots({ now: () => at, log, save: async (name, value) => saved.set(name, value), download: async url => {
    calls.push(url)
    if (url === SOURCES.bls.url) return ics
    const rid = new URL(url).searchParams.get('rid')
    if (rid) return page(rid)
    throw new Error('HTTP403')
  } })
  assert.equal(result.bls.status, 'ok'); assert.equal(result.fred.status, 'ok')
  assert.equal(saved.get('fred-bls-calendar.json').events.length, Object.keys(FRED_RELEASES).length)
  assert.equal(saved.get('bls-calendar.json').checkedAt, new Date(at).toISOString())
  assert.equal(calls.filter(url => url.includes('rid=')).length, 9)
})
test('partial FRED failure never replaces its old snapshot; BLS update survives', async () => {
  const saved = []
  const result = await refreshCalendarSnapshots({ now: () => at, log, save: async name => saved.push(name), download: async url => {
    if (url === SOURCES.bls.url) return ics
    const rid = new URL(url).searchParams.get('rid')
    if (rid === '10') return page(rid)
    throw new Error('HTTP403')
  } })
  assert.equal(result.fred.status, 'unavailable'); assert.deepEqual(saved, ['bls-calendar.json'])
})
test('FRED success preserves failed BLS file/time; both failing reject without a save', async () => {
  const saved = []
  const result = await refreshCalendarSnapshots({ now: () => at, log, save: async name => saved.push(name), download: async url => {
    const rid = new URL(url).searchParams.get('rid')
    if (rid) return page(rid)
    throw new Error('HTTP403')
  } })
  assert.equal(result.bls.status, 'unavailable'); assert.deepEqual(saved, ['fred-bls-calendar.json'])
  await assert.rejects(refreshCalendarSnapshots({ now: () => at, log, save: async () => assert.fail('must not save'), download: async () => { throw new Error('offline') } }), /all_calendar_refresh_sources_failed/)
})
