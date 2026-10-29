import test, { after, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import './helpers/register-tsx.mjs'

// Exercise actual React events, storage and presence lifecycles without a browser.
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://anthracite.test/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'SVGElement', 'Node', 'MouseEvent', 'StorageEvent', 'localStorage', 'sessionStorage']) globalThis[key] = dom.window[key]
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let reducedMotion = true
const preferenceListeners = new Set()
dom.window.matchMedia = query => ({ get matches() { return query.includes('prefers-reduced-motion') && reducedMotion }, media: query,
  addListener(listener) { preferenceListeners.add(listener) }, removeListener(listener) { preferenceListeners.delete(listener) },
  addEventListener(_event, listener) { preferenceListeners.add(listener) }, removeEventListener(_event, listener) { preferenceListeners.delete(listener) } })
function setMotionPreference(reduced) { reducedMotion = reduced; for (const listener of preferenceListeners) listener({ matches: reduced }) }

const { createElement: h, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { MotionConfig } = await import('motion/react')
const { toast } = await import('sonner')
const { default: SavedItemsProvider, BookmarkButton } = await import('../src/components/SavedItemsProvider.tsx')
const { useSavedItems } = await import('../src/hooks/useSavedItems.ts')
const { SectorETF: SectorPerformance } = await import('../src/components/SectorPerformance.tsx')
const { default: MarketMovers } = await import('../src/components/MarketMovers.tsx')
const { SAVED_KEY } = await import('../src/lib/savedItems.ts')
const { loadResource } = await import('../src/utils/resourceCache.ts')

const article = { article_url: 'https://example.com/a', title: 'Article A', publisher: 'Source A', published_utc: '2026-10-15T00:00:00Z' }
const other = { ...article, article_url: 'https://example.com/b', title: 'Article B' }
const container = document.getElementById('root')
let root
const tick = () => new Promise(resolve => setTimeout(resolve, 45))
async function render(children) {
  root = createRoot(container)
  await act(async () => { root.render(h(MemoryRouter, null, h(MotionConfig, { reducedMotion: 'user' }, h(SavedItemsProvider, null, children)))); await tick() })
}
async function click(element) {
  assert.ok(element, 'expected an interactive element')
  await act(async () => { element.click(); await tick() })
}
const stored = () => JSON.parse(localStorage.getItem(SAVED_KEY))
const bookmark = () => container.querySelector('button[aria-label="Article A 북마크 저장"], button[aria-label="Article A 북마크 해제"]')
const toastAction = title => [...document.querySelectorAll('[data-sonner-toast]')].find(node => node.textContent.includes(title))?.querySelector('[data-button]')
function persist(articles = [], stocks = []) { localStorage.setItem(SAVED_KEY, JSON.stringify({ version: 1, stocks, articles })) }
function BulkControl() {
  const { removeSelected } = useSavedItems()
  return h('button', { onClick: () => removeSelected('stocks', ['AAPL']), 'data-bulk-delete': true }, 'Delete selected stock')
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); toast.dismiss(); setMotionPreference(true) })
afterEach(async () => { await act(async () => { root?.unmount(); toast.dismiss(); await tick() }); root = undefined })
after(() => dom.window.close())

test('Maps and Movers retain independent selections, saved preferences and original data while the highlight follows the active button', async () => {
  const returns = { '1d': 1, '1w': 2, '1m': 3, ytd: 4 }
  const row = { name: 'Technology', symbol: 'XLK', returns, relative: returns, starts: { '1d': '2026-10-14', '1w': '2026-10-08' }, asOf: '2026-10-15' }
  const sectors = { sectors: [row], benchmark: { ...row, symbol: 'VOO' }, fetchedAt: new Date().toISOString(), stale: false, basis: 'Original basis' }
  const mover = ticker => ({ ticker, price: 123.45, changePct: 2.1, turnover: 1e9, volume: 10000 })
  const movers = { tradingDate: '2026-10-15', previousTradingDate: '2026-10-14', fetchedAt: Date.now(), stale: false, rankings: { turnover: [mover('ABC')], gainers: [mover('GAIN')], losers: [mover('LOSS')] } }
  const previousFetch = globalThis.fetch
  globalThis.fetch = async url => new Response(JSON.stringify(url.includes('sector') ? sectors : movers))
  try {
    await loadResource('/api/sector-performance', () => true, 60000, true)
    await loadResource('/api/market-movers', () => true, 60000, true)
    await render(h('div', null, h(SectorPerformance, { compact: true }), h(MarketMovers, { overview: true })))
    const period = [...container.querySelectorAll('.sector-periods button')].find(button => button.textContent === '1주')
    period.focus()
    await click(period)
    assert.equal(document.activeElement, period)
    assert.equal(container.querySelector('.sector-periods [aria-pressed=true]').textContent, '1주')
    assert.equal(container.querySelector('.sector-tile strong').textContent, '+2.00%')
    await click([...container.querySelectorAll('.movers-tabs button')].find(button => button.textContent === '상승'))
    assert.equal(container.querySelector('.mover-identity strong').textContent, 'GAIN')
    assert.equal(container.querySelector('.mover-price > span').textContent, '$123.45')
    assert.equal(container.querySelector('.sector-periods [aria-pressed=true]').textContent, '1주')
    for (const group of container.querySelectorAll('.sector-periods, .movers-tabs')) {
      assert.equal(group.querySelectorAll('.ui-selection-highlight').length, 1)
      assert.ok(group.querySelector('[aria-pressed=true] > .ui-selection-highlight[aria-hidden=true]'))
    }
    assert.equal(JSON.parse(sessionStorage.getItem('anthracite.ui.v1.maps.period')), '1w')
    assert.equal(JSON.parse(sessionStorage.getItem('anthracite.ui.v1.movers.category')), 'gainers')
    assert.ok(container.querySelector('.movers-status').textContent.includes('2026-10-15'))
  } finally { globalThis.fetch = previousFetch }
})

test('saving updates duplicate bookmarks and undo removes only that article from the latest storage', async () => {
  await render(h('div', null, h(BookmarkButton, { article, iconOnly: true }), h(BookmarkButton, { article })))
  await click(bookmark())
  assert.equal(container.querySelectorAll('.save-button[aria-pressed=true]').length, 2)
  assert.equal(stored().articles[0].article_url, article.article_url)
  assert.ok(toastAction('기사를 저장했습니다.'))
  const current = stored()
  localStorage.setItem(SAVED_KEY, JSON.stringify({ ...current, stocks: [{ ticker: 'MSFT', name: 'Microsoft' }], articles: [other, ...current.articles] }))
  await click(toastAction('기사를 저장했습니다.'))
  assert.deepEqual(stored().articles, [other])
  assert.deepEqual(stored().stocks, [{ ticker: 'MSFT', name: 'Microsoft' }])
  assert.equal(container.querySelectorAll('.save-button[aria-pressed=false]').length, 2)
  assert.ok(!bookmark().style.transform || bookmark().style.transform === 'none', 'reduced motion skips the save pulse')
})

test('undoing an unsave restores the original article metadata and order without discarding other-tab additions', async () => {
  persist([article, other])
  await render(h(BookmarkButton, { article: { ...article, publisher: 'Updated feed label' }, iconOnly: true }))
  await click(bookmark())
  assert.deepEqual(stored().articles, [other])
  const third = { ...other, article_url: 'https://example.com/c', title: 'Article C' }
  persist([third, other])
  await click(toastAction('기사 저장을 해제했습니다.'))
  assert.deepEqual(stored().articles, [article, third, other])
  assert.equal(bookmark().getAttribute('aria-pressed'), 'true')
})

test('rapid repeated saves replace one notice and undo the final action rather than toggling an unrelated item', async () => {
  persist([other])
  await render(h(BookmarkButton, { article, iconOnly: true }))
  await act(async () => { bookmark().click(); bookmark().click(); await tick() })
  assert.equal(document.querySelectorAll('[data-sonner-toast]').length, 1)
  assert.deepEqual(stored().articles, [other])
  await click(toastAction('기사 저장을 해제했습니다.'))
  assert.deepEqual(stored().articles, [article, other])
})

test('blocked storage keeps the bookmark unchanged and shows an error without a success notice', async () => {
  await render(h(BookmarkButton, { article, iconOnly: true }))
  const storage = globalThis.localStorage
  globalThis.localStorage = { getItem: storage.getItem.bind(storage), setItem() { throw new Error('quota exceeded') } }
  try {
    await click(bookmark())
    assert.equal(bookmark().getAttribute('aria-pressed'), 'false')
    assert.ok(container.querySelector('[role=alert]').textContent.includes('저장하지 못했습니다'))
    assert.equal(toast.getToasts().filter(item => item.id === 'article-save').length, 0)
    assert.equal(storage.getItem(SAVED_KEY), null)
  } finally { globalThis.localStorage = storage }
})

test('bulk deletion retains its separate thirty-second undo when a bookmark notice is also present', async () => {
  persist([], [{ ticker: 'AAPL', name: 'Apple' }, { ticker: 'MSFT', name: 'Microsoft' }])
  await render(h('div', null, h(BulkControl), h(BookmarkButton, { article })))
  await click(container.querySelector('[data-bulk-delete]'))
  await click(bookmark())
  assert.ok(toastAction('30초간 복원 가능'))
  assert.ok(toastAction('기사를 저장했습니다.'))
  await click(toastAction('30초간 복원 가능'))
  assert.deepEqual(stored().stocks.map(row => row.ticker), ['AAPL', 'MSFT'])
  assert.deepEqual(stored().articles, [article])
})

test('ordinary bookmark motion settles after interrupted saves without leaving a scaled button', async () => {
  setMotionPreference(false)
  await render(h(BookmarkButton, { article, iconOnly: true }))
  await click(bookmark())
  await click(bookmark())
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)) })
  assert.equal(bookmark().getAttribute('aria-pressed'), 'false')
  assert.ok(['', 'none', 'scale(1)'].includes(bookmark().style.transform))
  assert.deepEqual(stored().articles, [])
})
