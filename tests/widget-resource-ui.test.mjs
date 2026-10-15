import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { load } from 'cheerio'

const { default: SectorPerformance } = await import('../src/components/SectorPerformance.tsx')
const { default: MarketMovers } = await import('../src/components/MarketMovers.tsx')
const { default: MarketCalendar } = await import('../src/components/MarketCalendar.tsx')
const { default: MarketTicker } = await import('../src/components/MarketTicker.tsx')
const { default: NewsFeed } = await import('../src/components/NewsFeed.tsx')
const { default: SavedItemsProvider } = await import('../src/components/SavedItemsProvider.tsx')
const { loadResource, cachedResource } = await import('../src/utils/resourceCache.ts')

function render(Component, props = {}, session = {}) {
  const previousWindow = globalThis.window, previousSession = globalThis.sessionStorage
  globalThis.window = { history: { state: { idx: 0 } } }
  globalThis.sessionStorage = { getItem: key => Object.hasOwn(session, key) ? JSON.stringify(session[key]) : null }
  try { return load(renderToStaticMarkup(createElement(MemoryRouter, null, createElement(SavedItemsProvider, null, createElement(Component, props))))) }
  finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow
    if (previousSession === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = previousSession
  }
}
async function seed(key, data) {
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify(data))
  try { await loadResource(key, () => true, 60000, true) } finally { globalThis.fetch = previous }
}

test('initial widget loads use the common skeleton while the calendar month remains available', () => {
  assert.equal(render(SectorPerformance, { compact: true })('.data-skeleton-tiles').length, 1)
  assert.equal(render(MarketMovers, { overview: true })('.data-skeleton-rows').length, 1)
  const calendar = render(MarketCalendar)
  assert.equal(calendar('.data-skeleton-rows').length, 1)
  assert.ok(calendar('.calendar-date').length >= 35)
  assert.equal(calendar('.calendar-selected-heading').text().includes('0건'), false)
  assert.equal(render(MarketTicker)('.data-skeleton-ticker').length, 1)
  assert.equal(render(NewsFeed)('.data-skeleton-news').length, 1)
})

test('cached Maps values and their original basis stay visible during refresh', async () => {
  const returns = { '1d': 1.25, '1w': 2, '1m': 3, ytd: 4 }
  const row = { name: 'Technology', symbol: 'XLK', returns, relative: returns, starts: { '1d': '2026-10-13' }, asOf: '2026-10-14' }
  await seed('/api/sector-performance', { sectors: [row], benchmark: { ...row, symbol: 'VOO' }, fetchedAt: '2026-10-15T01:00:00Z', stale: false, basis: '배당 조정 종가' })
  const $ = render(SectorPerformance, { compact: true })
  assert.equal($('.data-skeleton').length, 0)
  assert.equal($('.data-notice-loading').length, 1)
  assert.equal($('.sector-tile strong').text(), '+1.25%')
  assert.ok($('.sector-compact-status').text().includes('2026-10-14 종가 기준'))
  assert.ok($('.widget-info-panel').text().includes('배당 조정 종가'))
})

test('ticker refresh failures retain the same cached values and per-instrument timestamp', async () => {
  const data = { quotes: [{ symbol: '^GSPC', label: 'S&P 500', price: 5000.25, changePercent: -1.5, asOf: '2026-10-14T20:00:00Z', unit: 'pt', status: 'ok' }], fetchedAt: Date.now() - 10000 }
  await seed('/api/market-indices', data)
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response('{}', { status: 503 })
  try { await assert.rejects(loadResource('/api/market-indices', () => true, 30000, true)) } finally { globalThis.fetch = previous }
  assert.deepEqual(cachedResource('/api/market-indices').data, data)
  const $ = render(MarketTicker)
  assert.equal($('.market-ticker-item').first().find('.market-ticker-value > span').first().text(), '5,000.25 pt')
  assert.ok($('.market-ticker-time').first().text().includes('2026. 10. 15. 05:00 KST'))
  assert.equal($('.ticker-down').first().text().trim(), '▼ 1.50%')
  assert.equal($('.data-skeleton').length, 0)
})

test('calendar source gaps preserve loaded events and expose a named retry without an empty-state claim', async () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.now())
  const month = today.slice(0, 7), [year, monthNumber] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const event = { id: 'fed-event', title: 'Federal Reserve event', category: 'Fed', date: today, startAt: null, session: null, major: true, source: 'Federal Reserve', sourceUrl: 'https://www.federalreserve.gov/', estimated: false }
  const schedule = { events: [event], sources: [{ name: 'BLS', state: 'unavailable', date: null, updatedAt: null, url: 'https://www.bls.gov/' }], fetchedAt: new Date().toISOString() }
  await seed(`/api/calendar?from=${month}-01&to=${month}-${last}&mode=month`, schedule)
  await seed(`/api/calendar?from=${today}&to=${today}&mode=earnings`, { events: [], sources: [], fetchedAt: schedule.fetchedAt })
  const $ = render(MarketCalendar)
  assert.ok($('.data-notice-warning').text().includes('일정 일부'))
  assert.ok($('.data-notice-detail').text().includes('BLS'))
  assert.equal($('.calendar-event').length, 1)
  assert.equal($('.calendar-event-title').attr('href'), event.sourceUrl)
  assert.equal($('.calendar-list .data-retry').length, 1)
  assert.equal($('.calendar-list').text().includes('등록된 일정이 없어요'), false)
})

test('partial news retains full titles, publication times and feed-check timestamps', () => {
  const published = new Date(Date.now() - 3600000).toISOString(), fetchedAt = Date.now() - 600000
  const item = { id: 'partial-news', title: '부분 수집 중에도 표시되는 기사 전체 제목', publisher: 'Test News', published_utc: published, article_url: 'https://example.com/partial', region: 'global', topics: ['economy'] }
  const data = { items: [item], fetchedAt, sources: [{ id: 'test', publisher: 'Test News', region: 'global', status: 'stale', checkedAt: fetchedAt, lastSuccessAt: fetchedAt - 3600000 }] }
  const $ = render(NewsFeed, {}, { anthracite_curated_news_v6: data })
  assert.ok($('.data-notice-warning').text().includes('일부 매체'))
  assert.equal($('.news-title').text(), item.title)
  assert.equal($('.news-article-time time').attr('datetime'), published)
  assert.equal($('.news-updated time').attr('datetime'), new Date(fetchedAt).toISOString())
  assert.equal($('.data-notice-time').length, 0, 'the visible feed-check timestamp is not repeated for partial results')
  assert.ok($('.news-source-status').text().includes('마지막 정상 수집'))
})
