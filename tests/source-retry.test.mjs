import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceFailure, retryDeadline } from '../lib/source-retry.js'
const now = Date.parse('2026-10-23T12:00:00Z'), minute = 60000

test('HTTP wait floors and bounded exponential transient backoff', () => {
  for (const [code, minutes] of [['http_403',30],['http_404',360],['http_410',360],['http_429',15]]) {
    assert.equal(retryDeadline(sourceFailure(code), now, 8), now + minutes * minute)
  }
  assert.deepEqual([1,2,3,4,5,8].map(n => (retryDeadline(sourceFailure('http_500'), now, n) - now) / minute), [1,2,4,8,15,15])
})
test('Retry-After accepts seconds and HTTP dates only on 429/503, capped at 24h', () => {
  assert.equal(retryDeadline(sourceFailure('http_429', '3600'), now), now + 60 * minute)
  assert.equal(retryDeadline(sourceFailure('http_503', new Date(now + 3 * minute).toUTCString()), now), now + 3 * minute)
  assert.equal(retryDeadline(sourceFailure('http_503', '99999999999999999999999999'), now), now + 24 * 60 * minute)
  assert.equal(retryDeadline(sourceFailure('http_403', '999999'), now), now + 30 * minute)
  for (const value of ['-10', '1.5', 'tomorrow', new Date(now - minute).toUTCString()]) {
    assert.equal(retryDeadline(sourceFailure('http_503', value), now), now + minute)
  }
})
