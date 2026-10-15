import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { load } from 'cheerio'

const { default: Home } = await import('../src/pages/00_Home.tsx')
const { default: MarketCalendar } = await import('../src/components/MarketCalendar.tsx')
const { default: SavedItemsProvider } = await import('../src/components/SavedItemsProvider.tsx')
const { loadResource } = await import('../src/utils/resourceCache.ts')
const { latestBriefing } = await import('../src/lib/briefings.ts')
const { briefingSections } = await import('../src/lib/briefingPresentation.ts')
const { calendarPreviewRequest, calendarPreviewRange } = await import('../src/lib/calendarPreview.ts')
const { SAVED_KEY } = await import('../src/lib/savedItems.ts')
const moverData = { tradingDate: '2026-10-14', previousTradingDate: '2026-10-13', fetchedAt: Date.now(), stale: false,
  rankings: { turnover: [{ ticker: 'ABC', price: 123.45, changePct: -2.1, turnover: 1e9, volume: 1e6 }], gainers: [], losers: [] } }
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
const previewNow = Date.now(), previewAt = new Date(previewNow + 3600000).toISOString()
const previewDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(previewAt))
const majorEvent = { id: 'home-major', title: 'Consumer Price Index', category: 'Economic', date: previewDay, startAt: previewAt, session: null, major: true, source: 'BLS', sourceUrl: 'https://www.bls.gov/schedule/', estimated: false }
const watchedEvent = { ...majorEvent, id: 'home-earnings', title: 'ABC · Test Company', ticker: 'ABC', category: 'Earnings', date: calendarPreviewRange(previewNow).from, startAt: null, session: 'post', major: false, source: 'Nasdaq', sourceUrl: 'https://www.nasdaq.com/market-activity/earnings', estimated: true }
const previewData = { events: [majorEvent, watchedEvent], sources: [{ name: 'BLS', date: null, state: 'ok', updatedAt: new Date(previewNow - 60000).toISOString(), url: majorEvent.sourceUrl }], fetchedAt: new Date(previewNow).toISOString() }
await seed(calendarPreviewRequest(previewNow, false), { ...previewData, events: [majorEvent] })
await seed(calendarPreviewRequest(previewNow, true), previewData)

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
test('home calendar is a compact preview while stock links, watch buttons and live playback retain independent controls', () => {
  const $ = render(createElement(Home))
  assert.equal($('.home-dashboard-calendar .calendar-preview').length, 1)
  assert.equal($('.home-dashboard-calendar .calendar-date, .calendar-tabs, .calendar-filters, .calendar-focus-filters').length, 0)
  assert.equal($('.home-dashboard-calendar button[aria-label="일정 새로고침"]').length, 1)
  assert.equal($('.home-dashboard-movers .movers-tabs button').length, 3)
  assert.equal($('.mover-row').attr('href'), '/stock/ABC')
  assert.equal($('.movers-list > li > button.save-button').length, 1)
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
  assert.equal($('.calendar-preview-zone').text(), 'KST')
  assert.ok($('.calendar-preview-info').text().includes('미국 날짜'))
  assert.ok($('.calendar-preview-info').text().includes('예상 일정은 변경될 수 있습니다'))
  assert.ok($('.daily-briefing').text().includes('실시간 시황이 아닙니다'))
  for (const stock of latestBriefing?.homepage?.stocks ?? []) assert.ok($('.briefing-stocks').text().includes(stock.basis))
})
test('mobile home keeps its briefing archive destination and disclosures without extra navigation buttons', () => {
  const $ = render(createElement(Home), true)
  assert.equal($('.linked-widget').length, 1)
  assert.equal($('.mobile-briefing-kicker [data-widget-link]').attr('href'), '/briefings')
  assert.ok($('.mobile-briefing-headline a').attr('href').startsWith('/briefings/'))
  assert.equal($('.mobile-briefing-detail-controls button').length, briefingSections(latestBriefing).length)
  assert.equal($('.mobile-briefing-actions, .home-dashboard-movers, .home-dashboard-calendar').length, 0)
  assert.ok($('.mobile-briefing-disclaimer').text().includes('실시간 시황이 아닙니다'))
})
test('full calendar page retains its full labels and has no self-referencing card destination', () => {
  const $ = render(createElement(MarketCalendar, { full: true }))
  assert.equal($('.calendar-heading [data-widget-link]').length, 0)
  assert.ok($('.calendar-heading').text().includes('경제·실적'))
  assert.ok($('.calendar-focus-filters').text().includes('관심 종목 실적만'))
  assert.ok($('.calendar-help summary').text().includes('출처·조회 범위'))
  assert.ok($('.calendar-date').length >= 28)
  assert.equal($('.calendar-tabs button').length, 2)
  assert.equal($('.calendar-filters button').length, 5)
  assert.equal($('.calendar-focus-filters button').length, 3)
})
test('home uses upcoming dates independently of saved full-calendar filters and fetches watched earnings only when needed', () => {
  const { from } = calendarPreviewRange(previewNow)
  const [year, month] = from.split('-').map(Number)
  const previousMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
  const session = {
    'anthracite.ui.v1.calendar.month': previousMonth, 'anthracite.ui.v1.calendar.day': `${previousMonth}-01`,
    'anthracite.ui.v1.calendar.category': 'Earnings', 'anthracite.ui.v1.calendar.focus': 'watched',
    'anthracite.ui.v1.calendar.view': 'month', 'anthracite.ui.v1.calendar.language': 'en', 'anthracite.ui.v1.calendar.timezone': 'America/New_York',
  }
  const plain = render(createElement(Home), false, { session })
  assert.ok(plain('.calendar-preview-events').text().includes('Consumer Price Index'))
  assert.equal(plain('.calendar-preview-events').text().includes('ABC'), false)
  assert.equal(plain('.calendar-preview-zone').text(), 'ET')
  const saved = { version: 1, stocks: [{ ticker: 'ABC', name: 'Test Company' }], articles: [] }
  const watched = render(createElement(Home), false, { session, saved })
  assert.ok(watched('.calendar-preview-events').text().includes('ABC · Test Company'))
  assert.ok(watched('.calendar-preview-events').text().includes('★ 관심 종목'))
  const full = render(createElement(MarketCalendar, { full: true }), false, { session, saved })
  const [savedYear, savedMonth] = previousMonth.split('-').map(Number)
  assert.ok(full('.calendar-month-navigation').text().includes(`${savedYear}년 ${savedMonth}월`))
  assert.equal(full('.calendar-filters button[aria-pressed=true]').text(), '실적')
  assert.equal(full('.calendar-focus-filters button[aria-pressed=true]').text(), '관심 종목 실적만')
  assert.equal(full('.calendar-settings select[aria-label="일정 이름 언어"] option[selected]').attr('value'), 'en')
})
