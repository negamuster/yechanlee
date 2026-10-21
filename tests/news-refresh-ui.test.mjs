import test, { after, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import './helpers/register-tsx.mjs'

const dom = new JSDOM('<!doctype html><html><body><header class="site-header"></header><div id="root"></div></body></html>', { url: 'https://anthracite.test/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'SVGElement', 'Node', 'MouseEvent', 'Event', 'StorageEvent', 'localStorage', 'sessionStorage']) globalThis[key] = dom.window[key]
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
window.matchMedia = query => ({ matches: query.includes('prefers-reduced-motion'), media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
const { createElement: h, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { MotionConfig } = await import('motion/react')
const { toast } = await import('sonner')
const { default: SavedItemsProvider } = await import('../src/components/SavedItemsProvider.tsx')
const { default: NewsFeed } = await import('../src/components/NewsFeed.tsx')
const { NEWS_REFRESH_INTERVAL, NEWS_SNAPSHOT_KEY } = await import('../src/lib/newsRefresh.ts')
const { SAVED_KEY } = await import('../src/lib/savedItems.ts')
const container = document.getElementById('root')
const originalFetch = globalThis.fetch
let root, baseline, nextResponse, requests, sequence = 0, scrollY, scrollCalls, jumps, timerId = 0
const intervals = new Map()
window.setInterval = (callback, delay) => { const id = ++timerId; intervals.set(id, { callback, delay }); return id }
window.clearInterval = id => intervals.delete(id)
window.scrollBy = options => { scrollY += options.top; scrollCalls.push(options.top) }
window.scrollTo = options => { scrollY = options.top }
Object.defineProperty(window, 'scrollY', { get: () => scrollY })
Object.defineProperty(window, 'innerHeight', { value: 700 })
window.HTMLElement.prototype.scrollIntoView = function (options) { jumps.push({ element: this, options }) }
const rect = (top, height) => ({ top, bottom: top + height, height, width: 800, left: 0, right: 800, x: 0, y: top, toJSON() {} })
// Model list offsets to exercise anchor compensation; this is not visual browser QA.
window.HTMLElement.prototype.getBoundingClientRect = function () {
  if (this.classList.contains('site-header')) return rect(0, 72)
  if (this.classList.contains('news-article')) {
    const index = [...container.querySelectorAll('.news-article')].indexOf(this)
    const notices = (container.querySelector('.news-update-notice') ? 46 : 0)
      + (container.querySelector('.data-notice-loading') ? 28 : 0) + (container.querySelector('.data-notice-warning') ? 54 : 0)
    return rect(300 + index * 120 + notices - scrollY, 100)
  }
  return rect(0, 0)
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
async function render(mobile = false) {
  root = createRoot(container)
  await act(async () => { root.render(h(MotionConfig, { reducedMotion: 'always' }, h(SavedItemsProvider, null, h(NewsFeed, { mobile })))); await tick() })
  await act(tick)
}
async function click(element) { assert.ok(element); await act(async () => { element.click(); await tick() }) }
async function poll() {
  const refresh = [...intervals.values()].find(timer => timer.delay === NEWS_REFRESH_INTERVAL)
  assert.ok(refresh)
  await act(async () => { refresh.callback(); await tick() })
  await act(tick)
}
async function edit(input, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true })); await tick()
  })
}
const cards = () => [...container.querySelectorAll('.news-article')]
const names = () => cards().map(article => article.querySelector('h3').textContent)
const incoming = (suffix, overrides = {}) => ({ ...baseline.items[0], id: `new-${sequence}-${suffix}`, title: `New ${suffix} market news`, article_url: `https://example.com/new-${sequence}-${suffix}`, publisher: `New Publisher ${suffix}`, published_utc: new Date().toISOString(), ...overrides })
const updated = items => ({ ...baseline, items, fetchedAt: Date.now() + 1 })

beforeEach(() => {
  sequence++; requests = 0; scrollY = 0; scrollCalls = []; jumps = []; intervals.clear()
  localStorage.clear(); sessionStorage.clear(); toast.dismiss()
  baseline = { fetchedAt: Date.now() - 60000, sources: [], items: Array.from({ length: 18 }, (_, index) => ({
    id: `old-${sequence}-${index}`, title: `Original ${index} market news`, article_url: `https://example.com/old-${sequence}-${index}`, publisher: `Publisher ${index % 6}`,
    published_utc: new Date(Date.now() - (index + 1) * 60000).toISOString(), region: 'global', topics: ['economy'],
  })) }
  sessionStorage.setItem('anthracite_curated_news_v6', JSON.stringify(baseline))
  nextResponse = async () => Response.json(updated([incoming('a'), ...baseline.items]))
  globalThis.fetch = async () => { requests++; return nextResponse() }
})
afterEach(async () => { await act(async () => { root?.unmount(); toast.dismiss(); await tick() }); root = null; globalThis.fetch = originalFetch })
after(() => dom.window.close())

test('automatic refresh keeps expanded articles, DOM identity, focus and the visible reading anchor until the reader applies updates', async () => {
  await render()
  assert.equal(requests, 0)
  assert.equal(cards().length, 12)
  await click(container.querySelector('.news-more'))
  assert.equal(cards().length, 18)
  scrollY = 550
  const before = cards(), order = names(), reading = before[3]
  const focused = reading.querySelector('a')
  focused.addEventListener('click', event => event.preventDefault())
  await click(focused)
  focused.focus({ preventScroll: true })
  const top = reading.getBoundingClientRect().top
  await poll()
  assert.deepEqual(names(), order)
  assert.deepEqual(cards(), before)
  assert.equal(reading.getBoundingClientRect().top, top)
  assert.equal(document.activeElement, focused)
  assert.equal(reading.classList.contains('is-read'), true)
  assert.equal(container.querySelector('.news-apply-updates').textContent, '새 기사 1건 보기↑')
  assert.match(container.querySelector('.news-updated').textContent, /목록 기준/)
  assert.equal(container.querySelector('.news-updated time').dateTime, new Date(baseline.fetchedAt).toISOString())
  assert.equal(container.querySelector('.news-results').getAttribute('aria-busy'), 'false')
  assert.equal(jumps.length, 0)
  await click(container.querySelector('.news-apply-updates'))
  assert.equal(names()[0], 'New a market news')
  assert.equal(cards().length, 12)
  assert.equal(container.querySelector('.news-update-notice'), null)
  assert.equal(jumps.length, 1)
  assert.equal(jumps[0].options.behavior, 'instant')
  assert.equal(document.activeElement, cards()[0].querySelector('a'))
})

test('manual checks and subsequent failed polls keep both the expanded list and the already pending update', async () => {
  await render()
  await click(container.querySelector('.news-more'))
  const order = names()
  await click(container.querySelector('.news-refresh'))
  assert.deepEqual(names(), order)
  nextResponse = async () => Response.json({}, { status: 503 })
  await poll()
  assert.equal(cards().length, 18)
  assert.deepEqual(names(), order)
  assert.match(container.textContent, /갱신 실패/)
  assert.match(container.querySelector('.news-apply-updates').textContent, /새 기사 1건/)
  nextResponse = async () => Response.json(updated([incoming('a'), ...baseline.items]))
  await click(container.querySelector('.data-retry'))
  assert.deepEqual(names(), order)
  assert.match(container.querySelector('.news-apply-updates').textContent, /새 기사 1건/)
  await click(container.querySelector('.news-apply-updates'))
})

test('returning to the page restores the unapplied list, expanded range and pending update without an immediate replacement', async () => {
  await render()
  await click(container.querySelector('.news-more'))
  await poll()
  const order = names()
  assert.equal(JSON.parse(sessionStorage.getItem(NEWS_SNAPSHOT_KEY)).latest.items[0].title, 'New a market news')
  await act(async () => root.unmount()); root = null
  await render()
  assert.deepEqual(names(), order)
  assert.equal(cards().length, 18)
  assert.match(container.querySelector('.news-apply-updates').textContent, /새 기사 1건/)
  assert.equal(requests, 1)
  await click(container.querySelector('.news-apply-updates'))
})

test('mobile articles and bookmark state survive polling and pending updates, including blocked snapshot storage', async () => {
  await render(true)
  const existing = cards()[0]
  await click(existing.querySelector('.save-button'))
  const saved = JSON.parse(localStorage.getItem(SAVED_KEY)).articles[0].article_url
  const storage = globalThis.sessionStorage
  globalThis.sessionStorage = { getItem: storage.getItem.bind(storage), setItem() { throw new Error('quota') } }
  try { await poll() } finally { globalThis.sessionStorage = storage }
  assert.equal(cards()[0], existing)
  assert.equal(existing.querySelector('.save-button').getAttribute('aria-pressed'), 'true')
  assert.match(container.querySelector('.news-apply-updates').textContent, /새 기사 1건/)
  await click(container.querySelector('.news-apply-updates'))
  const same = cards().find(card => card.querySelector('a').href === saved)
  assert.equal(same.querySelector('.save-button').getAttribute('aria-pressed'), 'true')
  assert.equal(container.querySelector('.mobile-news-articles') !== null, true)
})

test('pending counts follow search filters and do not offer irrelevant new articles', async () => {
  nextResponse = async () => Response.json(updated([incoming('a', { title: 'BreakingQuantum launch' }), ...baseline.items]))
  await render()
  const search = container.querySelector('.news-search input')
  await edit(search, 'Original 17')
  await poll()
  assert.equal(container.querySelector('.news-apply-updates'), null)
  assert.deepEqual(names(), ['Original 17 market news'])
  await edit(search, 'BreakingQuantum')
  assert.match(container.querySelector('.news-apply-updates').textContent, /새 기사 1건/)
  await click(container.querySelector('.news-apply-updates'))
  assert.equal(search.value, 'BreakingQuantum')
  assert.deepEqual(names(), ['BreakingQuantum launch'])
  await click(container.querySelector('.news-clear-filters'))
})
