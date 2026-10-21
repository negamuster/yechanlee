import test, { beforeEach, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import './helpers/register-tsx.mjs'
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://anthracite.test/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MouseEvent', 'Event']) globalThis[key] = dom.window[key]
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true, userAgent: window.navigator.userAgent } })
const { createElement: h, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { default: SectorPerformance } = await import('../src/components/SectorPerformance.tsx')
const { useResource } = await import('../src/hooks/useResource.ts')
const { refreshPolicies } = await import('../src/lib/refreshPolicy.ts')
const { invalidateResource, loadResource } = await import('../src/utils/resourceCache.ts')
const originalFetch = globalThis.fetch, originalNow = Date.now
const container = document.getElementById('root')
const timers = new Map()
let root, now, requests, hidden, sequence = 0
Object.defineProperty(document, 'hidden', { get: () => hidden })
window.setInterval = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id }
window.clearInterval = id => timers.delete(id)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const returns = { '1d': 1, '1w': 2, '1m': 3, ytd: 4 }
const row = { name: 'Technology', symbol: 'XLK', returns, relative: returns, starts: { '1d': '2026-10-19' }, asOf: '2026-10-20' }
const data = { sectors: [row], benchmark: { ...row, symbol: 'VOO' }, fetchedAt: '2026-10-21T00:00:00Z', stale: false, basis: '조정 종가' }
async function render(child) { await act(async () => { root.render(h(MemoryRouter, null, child)); await tick() }); await act(tick) }
async function event(target, type) { await act(async () => { target.dispatchEvent(new Event(type)); await tick() }); await act(tick) }
async function poll() { now += refreshPolicies.maps.interval; await act(async () => { for (const timer of timers.values()) timer.callback(); await tick() }); await act(tick) }
beforeEach(() => {
  now = originalNow(); Date.now = () => now; requests = 0; hidden = false; navigator.onLine = true; timers.clear()
  invalidateResource('/api/sector-performance'); invalidateResource('/test/refresh-one'); invalidateResource('/test/refresh-two')
  globalThis.fetch = async () => { requests++; return Response.json(data) }
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); globalThis.fetch = originalFetch; Date.now = originalNow; assert.equal(timers.size, 0) })
after(() => { dom.window.close(); if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator })
test('mounted Maps updates over a long session, skips hidden/offline polls, and rechecks once after recovery', async () => {
  await render(h(SectorPerformance)); assert.equal(requests, 1)
  await event(window, 'focus'); assert.equal(requests, 1)
  hidden = true; await poll(); assert.equal(requests, 1)
  hidden = false; navigator.onLine = false; await event(document, 'visibilitychange'); assert.equal(requests, 1)
  navigator.onLine = true; await event(window, 'online'); await event(window, 'focus'); assert.equal(requests, 2)
  await poll(); assert.equal(requests, 3)
  assert.match(container.textContent, /2026-10-20/)
})
test('shared Maps observers deduplicate requests and failures keep values, source time and retry available', async () => {
  await render(h('div', null, h(SectorPerformance, { compact: true }), h(SectorPerformance)))
  assert.equal(requests, 1)
  globalThis.fetch = async () => { requests++; return Response.json({}, { status: 503 }) }
  await poll(); assert.equal(requests, 2)
  assert.ok(container.querySelector('.sector-tile strong').textContent.includes('+1.00%'))
  assert.match(container.textContent, /2026-10-20/)
  assert.ok(container.querySelector('.data-retry'))
  globalThis.fetch = async () => { requests++; return Response.json(data) }
  await act(async () => { container.querySelector('.data-retry').click(); await tick() }); await act(tick)
  assert.equal(requests, 3)
  assert.equal(container.querySelectorAll('.data-notice-error, .data-notice-warning').length, 0, 'one successful retry recovers every observer of the same cached resource')
})
const valid = value => value && typeof value.name === 'string'
function Probe({ resource }) { const state = useResource(resource, valid, refreshPolicies.maps, 0); return h('p', null, state.data?.name || 'loading') }
test('resource key changes never render another resource or let its late request overwrite the new one', async () => {
  let finish
  globalThis.fetch = () => new Promise(resolve => { finish = resolve })
  await render(h(Probe, { resource: '/test/refresh-one' }))
  globalThis.fetch = async () => Response.json({ name: 'second' })
  await render(h(Probe, { resource: '/test/refresh-two' })); assert.equal(container.textContent, 'second')
  await act(async () => { finish(Response.json({ name: 'first' })); await tick() }); assert.equal(container.textContent, 'second')
})
test('manual refresh bypasses a fresh application cache', async () => {
  await loadResource('/api/sector-performance', () => true, refreshPolicies.maps.staleTime)
  await render(h(SectorPerformance, { compact: true })); assert.equal(requests, 1)
  await act(async () => { container.querySelector('[data-widget-action=refresh]').click(); await tick() }); await act(tick)
  assert.equal(requests, 2)
})
