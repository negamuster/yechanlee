import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from './helpers/render-static.mjs'
import { MemoryRouter } from 'react-router-dom'
import { load } from 'cheerio'

const { default: MarketMovers } = await import('../src/components/MarketMovers.tsx')
const { default: Markets } = await import('../src/pages/Markets.tsx')
const { default: SavedItemsProvider } = await import('../src/components/SavedItemsProvider.tsx')
const { loadResource } = await import('../src/utils/resourceCache.ts')
const rows = prefix => Array.from({ length: 10 }, (_, index) => ({ ticker: `${prefix}${index + 1}`, price: 123.45 + index, changePct: prefix === 'L' ? -10 + index : 10 - index, turnover: 1e9 - index * 1e6, volume: 1e6 - index }))
const fixture = { tradingDate: '2026-10-14', previousTradingDate: '2026-10-13', fetchedAt: Date.now(), stale: false, rankings: { turnover: rows('T'), gainers: rows('G'), losers: rows('L') } }
async function seed(data) {
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify(data))
  try { await loadResource('/api/market-movers', () => true, 60000, true) } finally { globalThis.fetch = previous }
}
function render(overview, category = 'turnover', markets = false) {
  const previousWindow = globalThis.window, previousSession = globalThis.sessionStorage
  globalThis.window = { history: { state: { idx: 0 } } }
  globalThis.sessionStorage = { getItem: key => key === 'anthracite.ui.v1.movers.category' ? JSON.stringify(category) : null }
  try { return load(renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [overview ? '/' : '/markets'] }, createElement(SavedItemsProvider, null, markets ? createElement(Markets) : createElement(MarketMovers, { overview }))))) }
  finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow
    if (previousSession === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = previousSession
  }
}
await seed(fixture)
test('each ranking tab shows the same first five on home and all ten on the markets page without changing ranking order', () => {
  const before = structuredClone(fixture)
  for (const category of ['turnover', 'gainers', 'losers']) {
    const home = render(true, category), full = render(false, category)
    const tickers = $ => $('.mover-identity strong').toArray().map(element => $(element).text())
    assert.deepEqual(tickers(home), fixture.rankings[category].slice(0, 5).map(row => row.ticker))
    assert.deepEqual(tickers(full), fixture.rankings[category].map(row => row.ticker))
    assert.deepEqual(home('.mover-rank').toArray().map(element => home(element).text()), ['01', '02', '03', '04', '05'])
    assert.equal(full('.mover-rank').last().text(), '10')
    assert.equal(home('.movers-tabs [aria-pressed=true]').text(), full('.movers-tabs [aria-pressed=true]').text())
    assert.ok(home('.movers-info > p').text().includes('상위 5개까지'))
    assert.ok(full('.movers-info > p').text().includes('상위 10개까지'))
  }
  assert.deepEqual(fixture, before)
})
test('home destination still opens the markets ranking, whose actual page retains ten rows and the selected tab', () => {
  const home = render(true, 'gainers'), full = render(false, 'gainers', true)
  assert.equal(home('[data-widget-link]').attr('href'), '/markets#market-movers-heading')
  assert.equal(full('.movers-list > li').length, 10)
  assert.equal(full('.movers-tabs [aria-pressed=true]').text(), '상승')
  assert.equal(full('.mover-identity strong').first().text(), 'G1')
})
test('limited rows retain stock destinations, independent watch buttons and the original price/date/source context', () => {
  const $ = render(true, 'losers')
  assert.equal($('.movers-list > li > .save-button').length, 5)
  assert.equal($('.mover-row button').length, 0)
  assert.equal($('.mover-row').first().attr('href'), '/stock/L1')
  assert.equal($('.mover-row').first().attr('data-focus-key'), 'mover:losers:L1')
  assert.equal($('.mover-price > span').first().text(), '$123.45')
  assert.equal($('.mover-down').first().text(), '-10.00%')
  assert.ok($('.movers-status').text().includes('2026-10-14 종가 기준 · 실시간 아님'))
  assert.ok($('.movers-info').text().includes('Polygon / Massive'))
})
test('short rankings show only available rows rather than padding or altering the source data', async () => {
  await seed({ ...fixture, rankings: { turnover: fixture.rankings.turnover.slice(0, 2), gainers: [], losers: [] } })
  assert.equal(render(true)('.movers-list > li').length, 2)
  assert.equal(render(false)('.movers-list > li').length, 2)
  assert.equal(render(true, 'gainers')('.movers-list > li').length, 0)
  await seed(fixture)
})
test('previous-data and pending-latest warnings remain visible in the five-row home widget', async () => {
  await seed({ ...fixture, stale: true, pendingLatest: true })
  const $ = render(true)
  assert.equal($('.movers-list > li').length, 5)
  assert.ok($('.data-notice').text().includes('갱신 실패 · 이전 데이터 표시 중'))
  assert.ok($('.data-notice').text().includes('이전 거래일 순위'))
  assert.ok($('.movers-status').text().includes('2026-10-14'))
  await seed(fixture)
})
