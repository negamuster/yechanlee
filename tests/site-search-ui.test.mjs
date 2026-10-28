import test, { beforeEach, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import './helpers/register-tsx.mjs'

// Native top-layer layout, focus trapping and touch still require browser QA.
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://anthracite.test/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'SVGElement', 'Node', 'MouseEvent', 'KeyboardEvent', 'Event', 'StorageEvent', 'localStorage', 'sessionStorage']) globalThis[key] = dom.window[key]
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
window.matchMedia = query => ({ matches: query.includes('prefers-reduced-motion'), media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
window.HTMLElement.prototype.scrollIntoView = function () {}
window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
const { createElement: h, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const { default: SavedItemsProvider } = await import('../src/components/SavedItemsProvider.tsx')
const { default: SiteSearch } = await import('../src/components/SiteSearch.tsx')
const { loadResource, invalidateResource } = await import('../src/utils/resourceCache.ts')
const { SAVED_KEY } = await import('../src/lib/savedItems.ts')
const { READ_KEY } = await import('../src/lib/readArticles.ts')
const { briefings } = await import('../src/lib/briefings.ts')
const container = document.getElementById('root')
const originalFetch = globalThis.fetch
const timeouts = new Map()
const setTimeoutNative = window.setTimeout.bind(window), clearTimeoutNative = window.clearTimeout.bind(window)
let root, requests, currentLocation, sequence = 0
window.setTimeout = (callback, delay, ...args) => {
  if (delay === 350 || delay === 10000) { const id = --sequence; timeouts.set(id, callback); return id }
  return setTimeoutNative(callback, delay, ...args)
}
window.clearTimeout = id => { if (id < 0) timeouts.delete(id); else clearTimeoutNative(id) }
function Location() { currentLocation = useLocation(); return h('output', { id: 'location' }, currentLocation.pathname) }
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
async function render() {
  root = createRoot(container)
  await act(async () => { root.render(h(MemoryRouter, { initialEntries: ['/saved'] }, h(SavedItemsProvider, null, h(SiteSearch, { onSelect() {} }), h(Location)))); await tick() })
}
async function click(element) { assert.ok(element); await act(async () => { element.click(); await tick() }) }
async function key(element, value, options = {}) { await act(async () => { element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options })); await tick() }) }
async function edit(value) {
  const input = container.querySelector('#command-query')
  await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); await tick() })
}
const input = () => container.querySelector('#command-query')
const options = () => [...container.querySelectorAll('[role=option]')]
async function open() { const button = container.querySelector('.site-search-trigger'); button.focus(); await click(button); assert.ok(input()); return button }
async function category(label) { await click([...container.querySelectorAll('.command-filters button')].find(button => button.textContent === label)) }
async function debounce() { const pending = [...timeouts.values()]; timeouts.clear(); await act(async () => { for (const callback of pending) await callback(); await tick() }) }
const savedArticle = { title: '테스트 반도체 투자 기사', article_url: 'https://example.com/test-search-saved', publisher: 'Reuters', published_utc: new Date().toISOString() }
beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); timeouts.clear(); requests = []
  document.body.style.overflow = 'auto'
  localStorage.setItem(SAVED_KEY, JSON.stringify({ version: 1, stocks: [{ ticker: 'AAPL', name: 'Apple Inc.' }], articles: [savedArticle] }))
  invalidateResource('/api/news')
  const feed = { items: [{ id: 'new-search', title: '새로운 시장 뉴스', article_url: 'https://example.com/new-search', publisher: 'Test News', published_utc: new Date().toISOString(), topics: ['economy'], region: 'global' }], fetchedAt: Date.now(), sources: [] }
  globalThis.fetch = async () => Response.json(feed)
  await loadResource('/api/news', () => true, 600000, true)
  globalThis.fetch = async url => { requests.push(url); return Response.json({ results: [{ ticker: 'NVDA', name: 'NVIDIA Corporation' }] }) }
  await render()
})
afterEach(async () => { await act(async () => { root?.unmount(); await tick() }); root = null; globalThis.fetch = originalFetch; timeouts.clear() })
after(() => dom.window.close())

test('header button and both shortcuts open the labelled modal, focus input, and restore page styles/focus on closing', async () => {
  const trigger = await open()
  assert.equal(document.activeElement, input())
  assert.equal(document.body.style.overflowY, 'hidden')
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  await key(window, 'k', { metaKey: true })
  assert.equal(input(), null); assert.equal(document.activeElement, trigger)
  assert.equal(document.body.style.overflow, 'auto')
  await key(window, 'k', { ctrlKey: true }); assert.ok(input())
  await act(async () => { container.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true })); await tick() })
  assert.equal(input(), null); assert.equal(document.activeElement, trigger)
  assert.equal(timeouts.size, 0)
})
test('arrows change the accessible active option and Enter navigates with the original return destination', async () => {
  await open(); await edit('13F')
  const first = options()[0]
  assert.equal(first.getAttribute('href'), '/form13f')
  assert.equal(input().getAttribute('aria-activedescendant'), first.id)
  await key(input(), 'ArrowDown')
  assert.equal(options().find(row => row.getAttribute('aria-selected') === 'true').id, input().getAttribute('aria-activedescendant'))
  await key(input(), 'ArrowUp'); await key(input(), 'Enter')
  assert.equal(currentLocation.pathname, '/form13f')
  assert.equal(currentLocation.state.returnOrigin.href, '/saved')
  assert.equal(input(), null)
})
test('Korean IME Enter never opens a result and alias search reuses confirmed stock matches', async () => {
  await open(); await edit('애플')
  assert.ok(options().some(row => row.getAttribute('href') === '/stock/AAPL'))
  await key(input(), 'Enter', { isComposing: true })
  assert.equal(currentLocation.pathname, '/saved'); assert.ok(input())
  await key(input(), 'Enter'); assert.equal(currentLocation.pathname, '/stock/AAPL')
})
test('query changes cancel delayed searches and late remote responses cannot replace newer matches', async () => {
  await open(); await category('종목')
  let finishOld
  globalThis.fetch = url => { requests.push(url); return new Promise(resolve => { finishOld = resolve }) }
  await edit('oldquery')
  const oldCallback = [...timeouts.values()][0]; timeouts.clear()
  let oldRequest
  await act(async () => { oldRequest = oldCallback(); await tick() })
  await edit('엔비디아')
  globalThis.fetch = async url => { requests.push(url); return Response.json({ results: [{ ticker: 'NVDA', name: 'NVIDIA Corporation' }] }) }
  await debounce()
  assert.ok(options().some(row => row.getAttribute('href') === '/stock/NVDA'))
  await act(async () => { finishOld(Response.json({ results: [{ ticker: 'OLD', name: 'Old match' }] })); await oldRequest; await tick() })
  assert.equal(options().some(row => row.textContent.includes('Old match')), false)
  assert.ok(requests.some(url => url.endsWith('search=NVDA')))
  await edit('ZZREMOTE')
  globalThis.fetch = async () => Response.json({}, { status: 503 })
  await debounce()
  assert.match(container.textContent, /정확한 티커로 직접 이동/)
  await key(input(), 'Enter'); assert.equal(currentLocation.pathname, '/saved')
  await click(container.querySelector('.command-direct-stock button'))
  assert.equal(currentLocation.pathname, '/stock/ZZREMOTE')
})
test('company-name Enter waits for confirmed matches and selects the real ticker instead of inventing one', async () => {
  await open(); await category('종목'); await edit('Example Remote')
  assert.equal(options().some(row => row.getAttribute('href') === '/stock/EXAMPLEREMOTE'), false)
  assert.equal(container.querySelector('.command-direct-stock'), null)
  await key(input(), 'Enter'); assert.equal(currentLocation.pathname, '/saved')
  globalThis.fetch = async () => Response.json({ results: [{ ticker: 'RMT', name: 'Example Remote Corp' }] })
  await debounce()
  assert.equal(options().length, 1)
  assert.equal(options()[0].getAttribute('href'), '/stock/RMT')
  assert.equal(container.querySelector('.command-direct-stock'), null)
  await key(input(), 'Enter'); assert.equal(currentLocation.pathname, '/stock/RMT')
})
test('published briefing text, saved articles and news are searchable with separate categories and safe external links', async () => {
  await open(); await category('브리핑'); await edit(briefings[0].id)
  assert.ok(options().some(row => row.getAttribute('href') === `/briefings/${briefings[0].id}`))
  await category('저장 기사'); await edit('테스트 반도체')
  const article = options()[0]
  assert.equal(article.getAttribute('href'), savedArticle.article_url)
  assert.equal(article.getAttribute('target'), '_blank')
  assert.equal(article.getAttribute('rel'), 'noopener noreferrer')
  // Prevent jsdom's external navigation while still exercising the actual click handler.
  article.addEventListener('click', event => event.preventDefault())
  await click(article)
  assert.ok(JSON.parse(localStorage.getItem(READ_KEY))[savedArticle.article_url])
  await open(); await category('뉴스'); await edit('새로운 시장')
  assert.equal(options().length, 1)
  assert.equal(options()[0].getAttribute('href'), 'https://example.com/new-search')
})
test('long article queries stay local and never exceed the remote stock API search budget', async () => {
  await open(); await edit('x'.repeat(61)); await debounce()
  assert.equal(requests.length, 0)
  await category('종목'); await debounce()
  assert.match(container.textContent, /60자 이내/)
  assert.equal(requests.length, 0)
})

test('catalog typo matches remain usable on provider failure with safe highlights and no fabricated direct ticker', async () => {
  await open(); await category('종목'); await edit('nvida')
  assert.equal(options()[0].getAttribute('href'), '/stock/NVDA')
  assert.ok(options()[0].querySelector('mark'))
  globalThis.fetch = async () => Response.json({}, { status: 503 })
  await debounce()
  assert.match(container.textContent, /외부 종목 검색에 실패/)
  assert.equal(container.querySelector('.command-direct-stock'), null)
  await key(input(), 'Enter'); assert.equal(currentLocation.pathname, '/stock/NVDA')
})
test('catalog exact ticker is the default accessible result in all categories and local Enter cancels pending API lookup', async () => {
  await open(); await edit('GOOG')
  assert.equal(options()[0].getAttribute('href'), '/stock/GOOG')
  assert.equal(options().filter(row => row.getAttribute('href') === '/stock/GOOGL').length, 0)
  assert.equal(options()[0].getAttribute('aria-selected'), 'true')
  await key(input(), 'Enter')
  assert.equal(currentLocation.pathname, '/stock/GOOG')
  await debounce(); assert.equal(requests.length, 0)
})
test('search highlights render untrusted article titles as text and keep source links unchanged', async () => {
  const title = 'NVIDIA <img src=x onerror=alert(1)> results'
  localStorage.setItem(SAVED_KEY, JSON.stringify({ version: 1, stocks: [], articles: [{ ...savedArticle, title }] }))
  await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: SAVED_KEY })); await tick() })
  await open(); await category('저장 기사'); await edit('nvida')
  assert.equal(options()[0].querySelector('strong').textContent, title)
  assert.ok(options()[0].querySelector('mark'))
  assert.equal(options()[0].querySelector('img'), null)
  assert.equal(options()[0].getAttribute('href'), savedArticle.article_url)
  assert.equal(requests.length, 0)
})
