import test from 'node:test'
import assert from 'node:assert/strict'
import snapshot from '../data/us-equity-sessions.json' with { type: 'json' }
import { createExchangeCalendar, exchangeCalendar as calendar, validateExchangeCalendar } from '../lib/exchange-calendar.js'
import { candidateDates, collectMovers, createMoversHandler } from '../lib/market-movers.js'
import { exportCalendar } from '../src/lib/calendarExport.ts'
import { koreanCalendarTitle } from '../src/lib/calendarPresentation.ts'
import { matchesCalendarFocus } from '../src/lib/calendarFilters.ts'
const at = value => Date.parse(value)
const payload = price => Response.json({ status: 'OK', results: [{ T: 'ABC', c: price, v: 20000, vw: price }] })

test('official observed holidays, early closes and the Saturday New Year exception are retained', () => {
  assert.ok(calendar.info)
  for (const date of ['2026-07-03', '2026-11-26', '2027-06-18', '2027-12-24', '2028-07-04']) assert.equal(calendar.day(date).state, 'holiday', date)
  for (const date of ['2026-11-27', '2026-12-24', '2028-07-03']) assert.equal(calendar.day(date).earlyClose, true, date)
  assert.equal(calendar.day('2027-12-31').state, 'session')
  assert.equal(calendar.day('2028-01-01').state, 'weekend')
  assert.equal(calendar.day('2026-10-12').state, 'session', 'a federal/Fed holiday does not imply an equity closure')
})
test('DST follows New York; open is inclusive and close exclusive, including early close', () => {
  assert.equal(calendar.day('2026-03-06').open, '2026-03-06T14:30:00Z')
  assert.equal(calendar.day('2026-03-09').open, '2026-03-09T13:30:00Z')
  assert.equal(calendar.day('2026-11-02').open, '2026-11-02T14:30:00Z')
  for (const date of ['2026-03-09', '2026-11-27']) {
    const session = calendar.day(date)
    assert.equal(calendar.status(at(session.open) - 1).state, 'before-open')
    assert.equal(calendar.status(at(session.open)).state, 'open')
    assert.equal(calendar.status(at(session.close) - 1).state, 'open')
    assert.equal(calendar.status(at(session.close)).state, 'after-close')
  }
  const holiday = calendar.status(at('2026-11-26T15:00:00Z'))
  assert.equal(holiday.state, 'holiday'); assert.equal(holiday.nextSession.date, '2026-11-27')
  assert.equal(calendar.status(at('2026-11-28T01:00:00Z')).nextSession.date, '2026-11-30')
})
test('truncated, duplicated, malformed or wrong-zone snapshots fail closed without guessed weekdays', () => {
  for (const modify of [data => data.sessions.pop(), data => data.sessions.splice(5, 1), data => data.sessions.push(data.sessions[0]),
    data => { data.sessions[20].open = data.sessions[20].open.replace('14:30', '13:30') },
    data => { data.timezone = 'UTC' }, data => { data.holidays.push('2026-10-12') }, data => { data.reviewedAt = '2026-10-29T00:00:00Z' }]) {
    const data = structuredClone(snapshot); modify(data)
    assert.equal(validateExchangeCalendar(data), false)
    const broken = createExchangeCalendar(data)
    assert.equal(broken.info, null); assert.equal(broken.day('2026-11-27').state, 'unavailable')
    assert.equal(broken.status(at('2026-11-27T15:00:00Z')).state, 'unavailable')
    assert.equal(broken.events('2026-11-01', '2026-11-30'), null)
    assert.deepEqual(broken.datesThrough('2026-11-27'), [])
  }
  assert.equal(calendar.day('2029-01-02').state, 'unavailable')
  assert.equal(calendar.status(NaN).state, 'unavailable')
  assert.equal(calendar.events('2028-12-01', '2029-01-01'), null)
  assert.deepEqual(calendar.datesThrough('2026-02-30'), [])
})
test('holiday ICS keeps the US date; early close keeps its exact instant and market filters stay separate', () => {
  const events = calendar.events('2026-11-23', '2026-11-29')
  assert.equal(events.length, 2, 'weekends are not fabricated holiday events')
  const [holiday, early] = events
  const holidayIcs = exportCalendar([holiday]), earlyIcs = exportCalendar([early])
  assert.ok(holidayIcs.includes('DTSTART;VALUE=DATE:20261126'))
  assert.ok(!holidayIcs.includes('DTSTART:'))
  assert.ok(!holidayIcs.replace(/\r\n /g, '').includes('시간 미정'))
  assert.ok(earlyIcs.includes('DTSTART:20261127T180000Z'))
  assert.equal(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', day: '2-digit' }).format(new Date(early.startAt)), '28')
  assert.equal(koreanCalendarTitle(holiday), '미국 주식 휴장 (NYSE)')
  assert.equal(koreanCalendarTitle(early), '미국 주식 조기 폐장 (NYSE)')
  for (const event of events) {
    assert.equal(matchesCalendarFocus(event, 'all', new Set()), true)
    assert.equal(matchesCalendarFocus(event, 'major', new Set()), false)
    assert.equal(matchesCalendarFocus(event, 'watched', new Set(['NYSE'])), false)
  }
})
test('Movers skips official closures before requests and keeps its independent 21 ET gate on early closes', async () => {
  assert.deepEqual(candidateDates(at('2026-11-27T17:00:00Z')).slice(0, 2), ['2026-11-25', '2026-11-24'])
  assert.equal(candidateDates(at('2026-11-28T01:59:59Z'))[0], '2026-11-25')
  assert.equal(candidateDates(at('2026-11-28T02:00:00Z'))[0], '2026-11-27')
  const dates = []
  const result = await collectMovers({ key: 'test', now: at('2026-11-27T17:00:00Z'), fetchImpl: async url => {
    dates.push(new URL(url).pathname.split('/').at(-1)); return payload(dates.length === 1 ? 20 : 10)
  } })
  assert.deepEqual(dates, ['2026-11-25', '2026-11-24'])
  assert.equal(result.previousTradingDate, '2026-11-24')
  assert.equal(result.rankings.gainers[0].changePct, 100)
  let requests = 0
  await assert.rejects(collectMovers({ key: 'test', now: at('2029-01-02T15:00:00Z'), fetchImpl: async () => { requests++; return payload(20) } }), /calendar_unavailable/)
  assert.equal(requests, 0)
})
test('an empty historical trading session never becomes a holiday or a fabricated cross-gap return', async () => {
  let calls = 0
  await assert.rejects(collectMovers({ key: 'test', now: at('2026-11-27T17:00:00Z'), fetchImpl: async () => ++calls === 1 ? payload(20) : Response.json({ status: 'OK', results: [] }) }), /insufficient_data/)
  assert.equal(calls, 2)
  let now = at('2026-11-27T17:00:00Z'), empty = false
  const handler = createMoversHandler({ getKey: () => 'test', now: () => now, fetchImpl: async () => empty ? Response.json({ status: 'OK', results: [] }) : payload(++calls === 3 ? 20 : 10) })
  const request = () => new Request('https://example.com/api/market-movers')
  const original = await (await handler(request())).json()
  now += 31 * 60000; empty = true
  const retained = await (await handler(request())).json()
  assert.equal(retained.stale, true); assert.equal(retained.fetchedAt, original.fetchedAt)
  assert.deepEqual(retained.rankings, original.rankings)
})
