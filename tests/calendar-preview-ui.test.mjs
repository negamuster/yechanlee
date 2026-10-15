import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { load } from 'cheerio'
import { data, event, now, source } from './fixtures/calendar-preview.mjs'

const { CalendarPreviewCard } = await import('../src/components/CalendarPreview.tsx')
function render({ events = [event('first')], sources = [source()], resource, ...props } = {}) {
  return load(renderToStaticMarkup(createElement(MemoryRouter, null, createElement(CalendarPreviewCard, {
    now, resource: resource ?? { data: data(events, sources), loading: false, error: false }, watched: new Set(), onRefresh() {}, ...props,
  }))))
}
test('main calendar renders a compact upcoming list with the existing full-page destination and independent source links', () => {
  const events = Array.from({ length: 7 }, (_, index) => event(`item-${index}`, { title: `Consumer Price Index ${index}` }))
  const $ = render({ events })
  assert.equal($('.calendar-heading [data-widget-link]').attr('href'), '/calendar')
  assert.equal($('.calendar-preview-events > li').length, 5)
  assert.equal($('.calendar-preview-event').first().attr('href'), events[0].sourceUrl)
  assert.equal($('.calendar-preview-event').first().attr('target'), '_blank')
  assert.equal($('.calendar-preview-event').first().attr('data-focus-key'), 'calendar-preview:item-0')
  assert.equal($('.calendar-month-grid, .calendar-controls, .calendar-filters, .calendar-list').length, 0)
  assert.equal($('a a, a button').length, 0)
  assert.equal($('.calendar-preview-zone').text(), 'KST')
  assert.equal($('button[aria-label="일정 새로고침"]').length, 1)
  assert.equal($('button[aria-label="일정 출처와 표시 기준"]').attr('aria-expanded'), 'false')
  assert.equal($('.calendar-preview-info[hidden]').length, 1)
  assert.ok($('.calendar-preview-info').text().includes('확인된 7건 중 최대 5건'))
})
test('preview preserves full titles, publication time zones, source metadata, and uncertain watched-stock earnings', () => {
  const earnings = event('earnings', { category: 'Earnings', title: 'ABC · Long Company Name', ticker: 'ABC', major: false, startAt: null, session: 'post', estimated: true, source: 'Nasdaq', sourceUrl: 'https://www.nasdaq.com/market-activity/earnings?date=2026-10-15' })
  const $ = render({ events: [event('clock', { startAt: '2026-10-15T20:00:00Z' }), earnings], watched: new Set(['ABC']) })
  assert.ok($('.calendar-preview-events').text().includes('소비자물가지수 (CPI)'))
  assert.ok($('.calendar-preview-events').text().includes('10.16'))
  assert.ok($('.calendar-preview-events').text().includes('05:00'))
  assert.equal($('time[datetime="2026-10-15T20:00:00Z"]').length, 1)
  assert.ok($('.calendar-preview-events').text().includes('ABC · Long Company Name · 실적 발표'))
  assert.ok($('.calendar-preview-events').text().includes('10.15 ET'))
  assert.ok($('.calendar-preview-events').text().includes('장후'))
  assert.ok($('.calendar-preview-meta').text().includes('★ 관심 종목'))
  assert.ok($('.calendar-preview-meta').text().includes('예상 · 변경 가능'))
  assert.equal($('.calendar-preview-footer time').attr('datetime'), data().fetchedAt)
})
test('initial loading uses placeholders; refreshing cached schedules keeps the real rows and original query time', () => {
  const loading = render({ resource: { data: null, loading: true, error: false } })
  assert.equal(loading('.calendar-preview-skeleton span').length, 3)
  assert.equal(loading('.calendar-preview-events').length, 0)
  assert.equal(loading('button[aria-label="일정 새로고침"][disabled]').length, 1)
  const refreshing = render({ resource: { data: data([event('cached')]), loading: true, error: false } })
  assert.equal(refreshing('.calendar-preview-events > li').length, 1)
  assert.equal(refreshing('.calendar-preview-skeleton').length, 0)
  assert.equal(refreshing('.calendar-preview-footer time').attr('datetime'), data().fetchedAt)
})
test('empty, partial and failed states remain distinct and never assert an unverified absence of events', () => {
  const empty = render({ events: [] })
  assert.equal(empty('.calendar-preview-empty').text(), '향후 7일 내 확인된 주요 일정이 없습니다.')
  const partial = render({ events: [], sources: [source({ state: 'unavailable' })] })
  assert.equal(partial('.calendar-preview-empty').text(), '현재 확인 가능한 주요 일정이 없습니다.')
  assert.equal(partial('.calendar-preview-status').text(), '일부 출처 확인 불가')
  const failed = render({ resource: { data: null, loading: false, error: true } })
  assert.equal(failed('.calendar-preview-status').text(), '일정을 불러오지 못했습니다.')
  assert.equal(failed('.calendar-preview-empty').text().includes('없습니다'), false)
  assert.equal(failed('button[aria-label="일정 새로고침"][disabled]').length, 0)
})
test('stale and snapshot schedules keep their provenance without hiding available events', () => {
  const stale = render({ resource: { data: data([event('stale')], [source({ state: 'stale' })]), loading: false, error: true } })
  assert.equal(stale('.calendar-preview-status').text(), '갱신 실패 · 이전 일정 표시')
  assert.equal(stale('.calendar-preview-source-warning').text(), '이전 자료')
  assert.equal(stale('.calendar-preview-events > li').length, 1)
  const stored = render({ sources: [source({ state: 'snapshot' })] })
  assert.equal(stored('.calendar-preview-status').text(), '저장 일정 포함')
  assert.ok(stored('.calendar-preview-meta').text().includes('저장 일정'))
  assert.ok(stored('.calendar-preview-info').text().includes('원본 확인'))
  assert.ok(stored('.calendar-preview-info').text().includes('출처별 원본 확인 시각'))
})
test('full calendar language and timezone preferences also apply to the home preview', () => {
  const $ = render({ language: 'en', timezone: 'America/New_York' })
  assert.equal($('.calendar-preview-event h3').text(), 'Consumer Price Index')
  assert.equal($('.calendar-preview-zone').text(), 'ET')
  assert.equal($('.calendar-preview-event time strong').text(), '08:30')
})
