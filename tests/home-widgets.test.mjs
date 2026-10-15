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

function render(element, mobile = false) {
  const previous = globalThis.window
  globalThis.window = { matchMedia: () => ({ matches: mobile }), history: { state: { idx: 0 } } }
  try { return load(renderToStaticMarkup(createElement(MemoryRouter, null, createElement(SavedItemsProvider, null, element)))) }
  finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous }
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
test('calendar dates, filters, stock detail links, watch buttons and live playback retain independent native controls', () => {
  const $ = render(createElement(Home))
  assert.ok($('.home-dashboard-calendar .calendar-date').length >= 28)
  assert.equal($('.calendar-tabs button').length, 2)
  assert.equal($('.calendar-filters button').length, 5)
  assert.equal($('.calendar-focus-filters button').length, 3)
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
  assert.ok($('.calendar-compact-status').text().includes('미국 날짜 · KST'))
  assert.ok($('.calendar-help').text().includes('자동 반영되지 않습니다'))
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
})
