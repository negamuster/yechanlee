import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cachedResource, loadResource } from '../src/utils/resourceCache.ts'
const valid = value => !!value && typeof value.value === 'number'
test('deduplicates concurrent reads, reuses fresh data, and preserves last success after a failed refresh', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ value: calls }) } }
  try {
    const [a, b] = await Promise.all([loadResource('/test/cache', valid, 10000), loadResource('/test/cache', valid, 10000)])
    assert.equal(calls, 1); assert.deepEqual(a, b)
    await loadResource('/test/cache', valid, 10000)
    assert.equal(calls, 1)
    assert.equal((await loadResource('/test/cache', valid, 10000, true)).value, 2)
    globalThis.fetch = async () => ({ ok: false })
    await assert.rejects(loadResource('/test/cache', valid, 10000, true))
    assert.equal(cachedResource('/test/cache').data.value, 2)
  } finally { globalThis.fetch = original }
})
test('does not mix date keys or store invalid responses; expires by receipt time', async () => {
  const original = globalThis.fetch
  const originalNow = Date.now
  let now = 1000000
  Date.now = () => now
  globalThis.fetch = async key => ({ ok: true, json: async () => key === '/test/invalid' ? {} : { value: key.endsWith('1') ? 1 : 2 } })
  try {
    await loadResource('/test/day1', valid, 1000)
    await loadResource('/test/day2', valid, 1000)
    assert.equal(cachedResource('/test/day1').data.value, 1)
    assert.equal(cachedResource('/test/day2').data.value, 2)
    await assert.rejects(loadResource('/test/invalid', valid, 1000))
    assert.equal(cachedResource('/test/invalid'), null)
    now += 6 * 60 * 60 * 1000 + 1
    assert.equal(cachedResource('/test/day1'), null)
  } finally { globalThis.fetch = original; Date.now = originalNow }
})
