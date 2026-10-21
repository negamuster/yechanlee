import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { observeRefresh, needsRefresh, refreshPolicies } from '../src/lib/refreshPolicy.ts'

const originalNow = Date.now
const originals = Object.fromEntries(['window', 'document', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
let now, timers, receivedAt, requests, release
beforeEach(() => {
  now = 1000000; Date.now = () => now; timers = new Map(); receivedAt = now; requests = 0
  const browser = Object.assign(new EventTarget(), { setInterval(callback, interval) { timers.set(1, { callback, interval }); return 1 }, clearInterval(id) { timers.delete(id) } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: Object.assign(new EventTarget(), { hidden: false }) })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })
  release = observeRefresh(refreshPolicies.maps, () => receivedAt, () => requests++)
})
afterEach(() => {
  release(); Date.now = originalNow
  for (const key of Object.keys(originals)) { if (originals[key]) Object.defineProperty(globalThis, key, originals[key]); else delete globalThis[key] }
})
const focus = () => window.dispatchEvent(new Event('focus'))
const visibility = () => document.dispatchEvent(new Event('visibilitychange'))
test('fresh data avoids focus/online requests; stale data refetches once for an event burst', () => {
  focus(); window.dispatchEvent(new Event('online')); visibility(); assert.equal(requests, 0)
  now += refreshPolicies.maps.staleTime
  visibility(); focus(); window.dispatchEvent(new Event('online')); assert.equal(requests, 1)
  receivedAt = now
  now += 30000; focus(); assert.equal(requests, 1)
})
test('hidden and offline tabs pause polling; visibility and connectivity recovery revalidate stale data', () => {
  now += refreshPolicies.maps.staleTime
  document.hidden = true; timers.get(1).callback(); focus(); assert.equal(requests, 0)
  document.hidden = false; navigator.onLine = false; visibility(); timers.get(1).callback(); assert.equal(requests, 0)
  navigator.onLine = true; window.dispatchEvent(new Event('online')); visibility(); assert.equal(requests, 1)
})
test('long foreground sessions revalidate Maps at expiry and retain bounded retry attempts after failures', () => {
  const timer = timers.get(1); assert.equal(timer.interval, 5 * 60000)
  now += timer.interval; timer.callback(); assert.equal(requests, 1)
  focus(); visibility(); assert.equal(requests, 1)
  now += 29999; focus(); assert.equal(requests, 1)
  now += 1; focus(); assert.equal(requests, 2)
  now += timer.interval; timer.callback(); assert.equal(requests, 3)
})
test('unsubscribing removes timers and all return/reconnect listeners', () => {
  release(); now += 1e6; focus(); visibility(); window.dispatchEvent(new Event('online'))
  assert.equal(requests, 0); assert.equal(timers.size, 0)
})
test('missing, expired and future receipt times require revalidation; source time is not modified', () => {
  assert.equal(needsRefresh(null, 30000, now), true)
  assert.equal(needsRefresh(now, 30000, now + 29999), false)
  assert.equal(needsRefresh(now, 30000, now + 30000), true)
  assert.equal(needsRefresh(now + 1, 30000, now), true)
})
