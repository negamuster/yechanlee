import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarPreviewHealth, calendarPreviewRange, calendarPreviewRequest, calendarPreviewTime, selectUpcomingCalendar, validCalendarPreview } from '../src/lib/calendarPreview.ts'
import { koreanCalendarTitle } from '../src/lib/calendarPresentation.ts'
import { data, event, now, source } from './fixtures/calendar-preview.mjs'

test('home uses a rolling seven-date NY range across Korean midnight, month/year boundaries and daylight saving', () => {
  for (const [instant, from, to] of [
    ['2026-10-15T02:00:00Z', '2026-10-14', '2026-10-20'],
    ['2026-10-15T11:31:00Z', '2026-10-15', '2026-10-21'],
    ['2026-10-31T20:00:00Z', '2026-10-31', '2026-11-06'],
    ['2026-12-30T20:00:00Z', '2026-12-30', '2027-01-05'],
  ]) assert.deepEqual(calendarPreviewRange(Date.parse(instant)), { from, to })
  assert.equal(calendarPreviewRequest(now, false), '/api/calendar?from=2026-10-15&to=2026-10-21&mode=month')
  assert.equal(calendarPreviewRequest(now, true), '/api/calendar?from=2026-10-15&to=2026-10-21&mode=all')
})
test('selection keeps only upcoming major events and saved-stock earnings, orders them and caps at five without mutating data', () => {
  const events = [
    event('six', { date: '2026-10-20', startAt: '2026-10-20T12:30:00Z' }),
    event('four', { date: '2026-10-18', startAt: '2026-10-18T12:30:00Z' }),
    event('past', { startAt: '2026-10-15T11:30:00Z' }),
    event('one'), event('one'),
    event('ordinary', { major: false }),
    event('unwatched', { category: 'Earnings', major: false, ticker: 'OTHER', startAt: null, estimated: true }),
    event('three', { date: '2026-10-17', startAt: null, category: 'Earnings', major: false, ticker: 'abc', session: 'post', estimated: true }),
    event('two', { date: '2026-10-16', startAt: '2026-10-16T12:30:00Z' }),
    event('five', { date: '2026-10-19', startAt: '2026-10-19T12:30:00Z' }),
    event('outside', { date: '2026-10-22', startAt: '2026-10-22T12:30:00Z' }),
  ]
  const before = structuredClone(events), selected = selectUpcomingCalendar(events, now, new Set(['ABC']))
  assert.deepEqual(selected.events.map(item => item.id), ['one', 'two', 'three', 'four', 'five'])
  assert.equal(selected.total, 6)
  assert.deepEqual(events, before)
})
test('past exact times disappear at the cutoff; today date-only events remain explicitly uncertain and short lists are not padded', () => {
  const events = [event('past', { startAt: new Date(now - 1).toISOString() }), event('now', { startAt: new Date(now).toISOString() }), event('unknown', { startAt: null }), event('old-day', { date: '2026-10-14', startAt: null }), event('invalid-time', { startAt: 'invalid' })]
  assert.deepEqual(selectUpcomingCalendar(events, now, new Set()).events.map(item => item.id), ['now', 'unknown'])
  assert.equal(selectUpcomingCalendar([event('only')], now, new Set()).events.length, 1)
  assert.equal(selectUpcomingCalendar([event('ordinary', { major: false })], now, new Set()).total, 0)
})
test('dated-only earnings never acquire an invented clock time or a converted Korean date', () => {
  for (const [session, time] of [['pre', '장전'], ['post', '장후'], ['unknown', '미정'], [null, '미정']]) {
    const stamp = calendarPreviewTime(event('earnings', { startAt: null, session }), 'Asia/Seoul')
    assert.equal(stamp.date, '10.15 ET')
    assert.equal(stamp.time, time)
    assert.ok(stamp.description.includes('미국 날짜'))
    assert.ok(stamp.description.includes('시각 미정'))
    assert.equal(stamp.time.includes('00:00'), false)
  }
})
test('exact event times convert through IANA zones, including next-day KST and the NY daylight-saving transition', () => {
  const item = event('post', { startAt: '2026-10-15T20:00:00Z' })
  assert.deepEqual(calendarPreviewTime(item, 'Asia/Seoul'), { date: '10.16', time: '05:00', description: '10.16 05:00 KST' })
  assert.deepEqual(calendarPreviewTime(item, 'America/New_York'), { date: '10.15', time: '16:00', description: '10.15 16:00 ET' })
  const dst = calendarPreviewTime(event('dst', { startAt: '2026-11-01T06:30:00Z' }), 'America/New_York')
  assert.equal(dst.time, '01:30')
})
test('source health distinguishes request failure, partial failure, stored schedules and successful empty results', () => {
  assert.equal(calendarPreviewHealth(null, true), '일정을 불러오지 못했습니다.')
  assert.equal(calendarPreviewHealth(data(), true), '갱신 실패 · 이전 일정 표시')
  assert.equal(calendarPreviewHealth(data([], [source({ state: 'stale' }), source({ name: 'BEA', state: 'unavailable' })]), false), '이전 자료 포함 · 일부 출처 확인 불가')
  assert.equal(calendarPreviewHealth(data([], [source({ state: 'unavailable' })]), false), '일부 출처 확인 불가')
  assert.equal(calendarPreviewHealth(data([], [source({ state: 'snapshot' })]), false), '저장 일정 포함')
  assert.equal(calendarPreviewHealth(data(), false), null)
})
test('preview validation rejects malformed events, unsafe links and invalid collection/source times', () => {
  assert.equal(validCalendarPreview(data([event('valid')])), true)
  for (const invalid of [null, {}, data([event('date', { date: '2026-02-30' })]), data([event('time', { startAt: 'invalid' })]), data([event('url', { sourceUrl: 'javascript:alert(1)' })]), { ...data(), fetchedAt: 'invalid' }, data([], [source({ updatedAt: 'invalid' })]), data([], [source({ url: 'https://user:password@example.com' })])]) assert.equal(validCalendarPreview(invalid), false)
})
test('shared titles retain full calendar translations and earnings names', () => {
  assert.equal(koreanCalendarTitle(event('cpi')), '소비자물가지수 (CPI)')
  assert.equal(koreanCalendarTitle(event('fomc', { category: 'Fed', title: 'FOMC Minutes' })), 'FOMC 의사록')
  assert.equal(koreanCalendarTitle(event('earnings', { category: 'Earnings', title: 'ABC · Test Company' })), 'ABC · Test Company · 실적 발표')
})
