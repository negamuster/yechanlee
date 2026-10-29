import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from './helpers/render-static.mjs'
import { MemoryRouter } from 'react-router-dom'
import { load } from 'cheerio'

const { default: Home } = await import('../src/pages/00_Home.tsx')
const { default: MarketCalendar } = await import('../src/components/MarketCalendar.tsx')
const { default: MarketSessionStatus } = await import('../src/components/MarketSessionStatus.tsx')
const { default: SavedItemsProvider } = await import('../src/components/SavedItemsProvider.tsx')
const { loadResource } = await import('../src/utils/resourceCache.ts')
const { latestBriefing } = await import('../src/lib/briefings.ts')
const { SAVED_KEY } = await import('../src/lib/savedItems.ts')
const moverData = { tradingDate: '2026-10-14', previousTradingDate: '2026-10-13', fetchedAt: Date.now(), stale: false,
  rankings: { turnover: [{ ticker: 'ABC', price: 123.45, changePct: -2.1, turnover: 1e9, volume: 1e6 }, ...Array.from({ length: 9 }, (_, index) => ({ ticker: `TEST${index}`, price: 100, changePct: 1, turnover: 1e8, volume: 1e6 }))], gainers: [], losers: [] } }
const returns = { '1d': -1.2, '1w': 2, '1m': 3, ytd: 4 }
const row = { name: 'Technology', symbol: 'XLK', returns, relative: returns, starts: { '1d': '2026-10-13' }, asOf: '2026-10-14' }
const sectorData = { sectors: [row], benchmark: { ...row, name: 'S&P 500', symbol: 'VOO' }, fetchedAt: new Date().toISOString(), stale: false, basis: '배당 조정 종가' }
async function seed(key, data) {
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify(data))
  try { await loadResource(key, () => true, 60000, true) } finally { globalThis.fetch = previous }
}
await seed('/api/market-movers', moverData)
await seed('/api/sector-performance', sectorData)

test('home session summary follows scheduled boundaries and keeps unknown coverage distinct on both layouts', () => {
  const previousNow = Date.now
  try {
    for (const [time, expected] of [['2026-11-26T15:00:00Z', '휴장일'], ['2026-11-27T14:30:00Z', '정규장 시간'], ['2026-11-27T18:00:00Z', '정규장 종료 시간 이후'], ['2029-01-02T15:00:00Z', '일정 미확인']]) {
      Date.now = () => Date.parse(time)
      for (const mobile of [false, true]) {
        const $ = render(createElement(MarketSessionStatus), mobile)
        assert.equal($('.market-session-state').text(), expected + (time.startsWith('2026-11-27') ? ' · 조기 폐장일' : ''))
        assert.ok($('.market-session-status').text().includes('실제 거래 상태'))
        assert.ok($('.market-session-status').text().includes('공식 일정 확인 2026.'))
        assert.equal($('.market-session-summary a').attr('href'), '/calendar')
        if (time.startsWith('2029')) assert.ok($('.market-session-summary').text().includes('다음 개장 미확인'))
      }
    }
  } finally { Date.now = previousNow }
})

test('calendar adds a separate local market category with US-date holidays and rollover-aware early closes', () => {
  const previousNow = Date.now
  Date.now = () => Date.parse('2026-11-26T15:00:00Z')
  try {
    const session = { 'anthracite.ui.v1.calendar.month': '2026-11', 'anthracite.ui.v1.calendar.day': '2026-11-26', 'anthracite.ui.v1.calendar.category': 'Market' }
    const holiday = render(createElement(MarketCalendar, { full: true }), false, { session })
    assert.equal(holiday('.calendar-filters button[aria-pressed=true]').text(), '거래소')
    assert.ok(holiday('.calendar-list').text().includes('미국 주식 휴장 (NYSE)'))
    assert.ok(holiday('.calendar-list').text().includes('종일 (미국 날짜)'))
    assert.ok(holiday('.calendar-date[data-date="2026-11-27"]').attr('aria-label').includes('거래소 일정'))
    const early = render(createElement(MarketCalendar, { full: true }), false, { session: { ...session, 'anthracite.ui.v1.calendar.day': '2026-11-27' } })
    assert.ok(early('.calendar-list').text().includes('미국 주식 조기 폐장 (NYSE)'))
    assert.ok(/11.*28.*03:00 KST/.test(early('.calendar-event-meta').text()))
  } finally { Date.now = previousNow }
})

function render(element, mobile = false, { session = {}, saved } = {}) {
  const previous = globalThis.window
  const previousSession = globalThis.sessionStorage, previousLocal = globalThis.localStorage
  globalThis.window = { matchMedia: () => ({ matches: mobile }), history: { state: { idx: 0 } } }
  globalThis.sessionStorage = { getItem: key => Object.hasOwn(session, key) ? JSON.stringify(session[key]) : null }
  if (saved) globalThis.localStorage = { getItem: key => key === SAVED_KEY ? JSON.stringify(saved) : null }
  try { return load(renderToStaticMarkup(createElement(MemoryRouter, null, createElement(SavedItemsProvider, null, element)))) }
  finally {
    if (previous === undefined) delete globalThis.window; else globalThis.window = previous
    if (previousSession === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = previousSession
    if (previousLocal === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousLocal
  }
}
test('each desktop home card has one keyboard-accessible destination with no duplicate navigation labels or nested links', () => {
  const $ = render(createElement(Home))
  const destinations = { '.home-briefing': '/briefings', '.home-dashboard-maps': '/equity', '.home-dashboard-movers': '/markets#market-movers-heading', '.home-dashboard-calendar': '/calendar', '.home-dashboard-live': '/live' }
  for (const [selector, destination] of Object.entries(destinations)) {
    assert.equal($(`${selector}.linked-widget`).length, 1, selector)
    assert.equal($(`${selector} a[data-widget-link]`).length, 1, selector)
    const link = $(`${selector} a[data-widget-link]`)
    assert.equal(link.attr('href'), destination)
    assert.ok(link.attr('aria-label').includes(link.text()), 'accessible name includes visible title')
  }
  const mainText = $('.home-content').text()
  for (const removed of ['전체 보기 ↗', '지난 브리핑 ↗', '움직임과 배경', '미국 · USD', '영어 방송', '24/7 Stream · Daily Market Coverage']) assert.equal(mainText.includes(removed), false, removed)
  assert.equal($('a a, a button, a input, a select, a iframe').length, 0)
})
test('home keeps the month grid without detail filters while stock rows and playback retain independent controls', () => {
  const $ = render(createElement(Home))
  assert.equal($('.home-dashboard-calendar .calendar-month-grid:not(.calendar-week-grid)').length, 1)
  assert.ok($('.home-dashboard-calendar .calendar-date').length >= 28)
  assert.equal($('.calendar-tabs, .calendar-filters, .calendar-focus-filters, .calendar-controls, .calendar-settings').length, 0)
  assert.equal($('.calendar-month-navigation button').length, 2)
  assert.equal($('.home-dashboard-calendar .calendar-preview').length, 0)
  assert.equal($('.home-dashboard-movers .movers-tabs button').length, 3)
  assert.equal($('.mover-row').attr('href'), '/stock/ABC')
  assert.equal($('.movers-list > li > button.save-button').length, 5)
  assert.equal($('.sector-selectable > button').length, 1)
  assert.equal($('.home-dashboard-live iframe').length, 1)
  assert.ok($('.home-dashboard-live iframe').attr('src').includes('mute=1'))
  assert.equal($('.home-dashboard-live button[aria-label="영상 닫기"]').length, 1)
})
test('home retains price dates, currency context, timezone, source references and non-live warnings', () => {
  const $ = render(createElement(Home))
  assert.ok($('.movers-status').text().includes('2026-10-14 종가 기준 · 실시간 아님'))
  assert.ok($('.movers-info').text().includes('USD'))
  assert.equal($('.mover-price > span').first().text(), '$123.45')
  assert.ok($('.sector-period-range').text().includes('2026-10-13 → 2026-10-14'))
  assert.ok($('.sector-compact-status').text().includes('종가 기준 · Yahoo Finance'))
  assert.ok($('.calendar-compact-status').text().includes('미국 날짜 · KST'))
  assert.ok($('.calendar-help').text().includes('자동 반영되지 않습니다'))
  assert.ok($('.home-briefing-card').text().includes('실시간 시황이 아닙니다'))
  assert.equal($('.home-briefing-summary').text().replace(/\s+/g, ''), latestBriefing.summary[0].replace(/\s+/g, ''))
  assert.equal($('.home-briefing-read').attr('href'), `/briefings/${latestBriefing.id}`)
  assert.equal($('.briefing-stocks, .briefing-detail-tabs').length, 0)
})
test('home cards align their title and actions without duplicate refresh controls or nested links', () => {
  const $ = render(createElement(Home))
  for (const selector of ['.home-briefing', '.home-dashboard-maps', '.home-dashboard-calendar', '.home-dashboard-movers', '.home-dashboard-live']) {
    assert.equal($(`${selector} .widget-heading > h2 > [data-widget-link]`).length, 1, selector)
  }
  for (const selector of ['.home-dashboard-maps', '.home-dashboard-calendar', '.home-dashboard-movers']) {
    const card = $(selector), actions = card.find('.widget-heading > .widget-actions')
    assert.equal(actions.find('[data-widget-action="refresh"]').length, 1, selector)
    assert.equal(actions.find('[data-widget-action="info"]').length, 1, selector)
    const info = actions.find('[data-widget-action="info"]')
    assert.equal(info.attr('aria-expanded'), 'false', selector)
    const panel = card.find(`[id="${info.attr('aria-controls')}"]`)
    assert.equal(panel.length, 1, selector)
    assert.equal(panel.hasClass('widget-info-panel'), true, selector)
    assert.equal(panel.is('[hidden]'), true, selector)
    assert.equal(panel.is('[data-widget-interactive]'), true, selector)
    assert.ok(panel.text().length > 30, selector)
    assert.equal(card.find('.sector-compact-status button, .calendar-compact-status button, .movers-status button, .sector-info-toggle, details.movers-info, details.calendar-help').length, 0, selector)
  }
  assert.equal($('.home-dashboard-live .widget-heading [data-widget-action="close"]').attr('aria-label'), '영상 닫기')
  assert.equal($('.home-dashboard-live .market-live-actions button').length, 0)
  assert.equal($('a button, a a').length, 0)
})
test('mobile home keeps the archive destination and a direct full-edition path in the compact summary', () => {
  const $ = render(createElement(Home), true)
  assert.equal($('.linked-widget').length, 1)
  assert.equal($('.home-briefing-card [data-widget-link]').attr('href'), '/briefings')
  assert.equal($('.home-briefing-read').attr('href'), `/briefings/${latestBriefing.id}`)
  assert.equal($('.home-briefing-summary').length, 1)
  assert.equal($('.mobile-briefing-detail-controls, .home-dashboard-movers, .home-dashboard-calendar').length, 0)
  assert.ok($('.home-briefing-disclaimer').text().includes('실시간 시황이 아닙니다'))
})
test('full calendar page retains its full labels and has no self-referencing card destination', () => {
  const $ = render(createElement(MarketCalendar, { full: true }))
  assert.equal($('.calendar-heading [data-widget-link]').length, 0)
  assert.ok($('.calendar-heading').text().includes('경제·실적'))
  assert.ok($('.calendar-focus-filters').text().includes('관심 종목 실적만'))
  assert.ok($('.calendar-help summary').text().includes('출처·조회 범위'))
  assert.ok($('.calendar-date').length >= 28)
  assert.equal($('.calendar-tabs button').length, 2)
  assert.equal($('.calendar-filters button').length, 6)
  assert.equal($('.calendar-focus-filters button').length, 3)
})
test('home always shows the month and all events without overwriting detailed calendar preferences', () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.now())
  const [year, month] = today.split('-').map(Number)
  const previousMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
  const session = {
    'anthracite.ui.v1.calendar.month': previousMonth, 'anthracite.ui.v1.calendar.day': `${previousMonth}-01`,
    'anthracite.ui.v1.calendar.category': 'Earnings', 'anthracite.ui.v1.calendar.focus': 'watched',
    'anthracite.ui.v1.calendar.view': 'week', 'anthracite.ui.v1.calendar.homeView': 'week', 'anthracite.ui.v1.calendar.language': 'en', 'anthracite.ui.v1.calendar.timezone': 'America/New_York',
  }
  const saved = { version: 1, stocks: [{ ticker: 'ABC', name: 'Test Company' }], articles: [] }
  const home = render(createElement(Home), false, { session, saved })
  const [savedYear, savedMonth] = previousMonth.split('-').map(Number)
  assert.ok(home('.calendar-month-navigation').text().includes(`${savedYear}년 ${savedMonth}월`))
  assert.ok(home('.calendar-date').length >= 35)
  assert.equal(home('.calendar-week-grid, .calendar-tabs, .calendar-filters, .calendar-focus-filters, .calendar-settings').length, 0)
  assert.ok(home('.calendar-compact-status').text().includes('ET'))
  const full = render(createElement(MarketCalendar, { full: true }), false, { session, saved })
  assert.equal(full('.calendar-tabs button[aria-pressed=true]').text(), '주간')
  assert.equal(full('.calendar-week-grid .calendar-date').length, 7)
  assert.equal(full('.calendar-filters button[aria-pressed=true]').text(), '실적')
  assert.equal(full('.calendar-focus-filters button[aria-pressed=true]').text(), '관심 종목 실적만')
  assert.equal(full('.calendar-settings select[aria-label="일정 이름 언어"] option[selected]').attr('value'), 'en')
})

test('October and November home grids fill five complete weeks with muted neighboring dates', () => {
  const previousNow = Date.now
  Date.now = () => Date.parse('2026-10-15T12:00:00Z')
  try {
    const october = render(createElement(Home), false, { session: { 'anthracite.ui.v1.calendar.month': '2026-10' } })
    assert.equal(october('.calendar-date').length, 35)
    assert.equal(october('.calendar-date').first().attr('data-date'), '2026-09-27')
    assert.equal(october('.calendar-date').last().attr('data-date'), '2026-10-31')
    assert.deepEqual(october('.calendar-date.is-outside-month').toArray().map(node => october(node).attr('data-date')), ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'])
    assert.equal(october('.calendar-date[data-date="2026-10-01"]').index(), 11) // Seven weekday labels, then Thursday.
    assert.ok(october('.calendar-date').first().attr('aria-label').includes('이전 달'))
    assert.equal(october('.calendar-date[aria-current="date"]').attr('data-date'), '2026-10-15')
    assert.equal(october('.calendar-date[aria-pressed="true"]').attr('data-date'), '2026-10-15')

    const november = render(createElement(Home), false, { session: { 'anthracite.ui.v1.calendar.month': '2026-11' } })
    assert.equal(november('.calendar-date').length, 35)
    assert.equal(november('.calendar-date').first().attr('data-date'), '2026-11-01')
    assert.equal(november('.calendar-date').last().attr('data-date'), '2026-12-05')
    assert.deepEqual(november('.calendar-date.is-outside-month').toArray().map(node => november(node).attr('data-date')), ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'])
    assert.ok(november('.calendar-date[data-date="2026-12-01"]').attr('aria-label').includes('다음 달'))
    assert.equal(november('.calendar-date[data-date="2026-12-01"]').attr('disabled'), undefined)
  } finally { Date.now = previousNow }
})

test('home includes economic and earnings events despite saved detail filters', async () => {
  const previousNow = Date.now
  Date.now = () => Date.parse('2026-10-15T12:00:00Z')
  try {
    const common = { date: '2026-10-15', startAt: null, session: null, major: false, source: 'Test', sourceUrl: 'https://example.com', estimated: false }
    const economic = { ...common, id: 'economic', title: 'Economic event', category: 'Economic' }
    const earnings = { ...common, id: 'earnings', title: 'Test earnings', category: 'Earnings', ticker: 'ABC' }
    await seed('/api/calendar?from=2026-10-01&to=2026-10-31&mode=month', { events: [economic], sources: [], fetchedAt: '2026-10-15T12:00:00Z' })
    await seed('/api/calendar?from=2026-10-15&to=2026-10-15&mode=earnings', { events: [earnings], sources: [], fetchedAt: '2026-10-15T12:00:00Z' })
    const session = { 'anthracite.ui.v1.calendar.category': 'Earnings', 'anthracite.ui.v1.calendar.focus': 'watched' }
    const home = render(createElement(Home), false, { session })
    assert.equal(home('.calendar-event').length, 2)
    assert.equal(home('.calendar-date[data-date="2026-10-15"] .calendar-dots i').length, 2)
    const full = render(createElement(MarketCalendar, { full: true }), false, { session })
    assert.equal(full('.calendar-event').length, 0)
    assert.equal(full('.calendar-filters button[aria-pressed=true]').text(), '실적')
    assert.equal(full('.calendar-focus-filters button[aria-pressed=true]').text(), '관심 종목 실적만')
  } finally { Date.now = previousNow }
})

test('neighboring dates remain visible but cannot navigate outside the supported month range', () => {
  const previousNow = Date.now
  Date.now = () => Date.parse('2026-10-15T12:00:00Z')
  try {
    const september = render(createElement(MarketCalendar), false, { session: { 'anthracite.ui.v1.calendar.month': '2026-09' } })
    assert.equal(september('.calendar-date[data-date="2026-08-30"]').is('[disabled]'), true)
    assert.equal(september('.calendar-date[data-date="2026-09-01"]').attr('disabled'), undefined)
    const january = render(createElement(MarketCalendar), false, { session: { 'anthracite.ui.v1.calendar.month': '2027-01' } })
    assert.equal(january('.calendar-date').length, 42)
    assert.equal(january('.calendar-date[data-date="2027-01-31"]').length, 1)
    assert.equal(january('.calendar-date[data-date="2027-02-01"]').is('[disabled]'), true)
  } finally { Date.now = previousNow }
})
