import test from 'node:test'
import assert from 'node:assert/strict'
import { collectNews } from '../lib/news.js'
const at = Date.parse('2026-10-07T05:00:00Z')
const source = { id: 'example', publisher: 'Example', region: 'global', url: 'https://example.com/feed', hosts: ['example.com'] }
const xml = (date = at) => `<rss><channel><item><title>Stocks and markets rise</title><link>https://example.com/article</link><pubDate>${new Date(date).toUTCString()}</pubDate></item></channel></rss>`

test('a failed feed retains eligible articles with original success time and retries after backoff', async () => {
  const cache = new Map()
  await collectNews(async () => new Response(xml()), [source], at, 100, cache)
  let calls = 0
  const offline = async () => { calls++; return new Response(null, { status: 403 }) }
  const failed = await collectNews(offline, [source], at + 600000, 100, cache)
  assert.equal(failed.sources[0].status, 'stale')
  assert.equal(failed.sources[0].lastSuccessAt, at)
  assert.equal(failed.items[0].feedCollectedAt, at)
  assert.equal(failed.items[0].feedStale, true)
  const waiting = await collectNews(offline, [source], at + 1200000, 100, cache)
  assert.equal(calls, 1)
  assert.equal(waiting.sources[0].checkedAt, at + 600000)
  assert.equal(waiting.sources[0].nextRetryAt, at + 2400000)
  const recovered = await collectNews(async () => new Response(xml()), [source], at + 2400000, 100, cache)
  assert.equal(recovered.sources[0].status, 'ok')
  assert.equal(recovered.items[0].feedStale, undefined)
  assert.equal(recovered.sources[0].lastSuccessAt, at + 2400000)
})

test('retention and article age limits apply even while 404 retry is deferred', async () => {
  const cache = new Map()
  await collectNews(async () => new Response(xml()), [source], at, 100, cache)
  const offline = async () => new Response(null, { status: 404 })
  await collectNews(offline, [source], at + 3600000, 100, cache)
  const expired = await collectNews(() => { throw new Error('should still be backing off') }, [source], at + 6 * 3600000 + 1, 100, cache)
  assert.equal(expired.items.length, 0)
  assert.equal(expired.sources[0].status, 'unavailable')
  assert.equal(expired.sources[0].error, 'http_404')
  const old = new Map()
  await collectNews(async () => new Response(xml(at - 71.5 * 3600000)), [source], at, 100, old)
  assert.equal((await collectNews(offline, [source], at + 3600000, 100, old)).items.length, 0)
})

test('successful empty feeds replace old articles; stateless briefing collections never reuse failures', async () => {
  const cache = new Map()
  await collectNews(async () => new Response(xml()), [source], at, 100, cache)
  await collectNews(async () => new Response('<rss><channel><title>Example</title></channel></rss>'), [source], at + 1, 100, cache)
  assert.equal((await collectNews(async () => new Response(null, { status: 503 }), [source], at + 2, 100, cache)).items.length, 0)
  let calls = 0
  const fetcher = async () => { calls++; return new Response(null, { status: 404 }) }
  await collectNews(fetcher, [source], at)
  await collectNews(fetcher, [source], at + 1)
  assert.equal(calls, 2)
})
