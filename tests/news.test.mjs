import test from 'node:test'
import assert from 'node:assert/strict'
import { collectNews, parseFeed, safeArticleUrl, SOURCES, feedImage, publicationTime } from '../lib/news.js'

const now = Date.parse('2026-09-11T03:00:00Z')
const source = { id: 'test', publisher: 'WSJ', region: 'global', hosts: ['wsj.com'], url: 'https://feed.example/rss' }
const article = (title = 'Markets &amp; interest rates', link = 'https://www.wsj.com/finance/story?utm_source=rss', date = new Date(now - 60000).toUTCString()) => `<item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate><description>Do not redistribute this full text</description></item>`
const rss = items => `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`

test('RSS output contains only headline metadata and canonical publisher links', () => {
  const [item] = parseFeed(rss(article()), source, now)
  assert.equal(item.title, 'Markets & interest rates')
  assert.equal(item.article_url, 'https://www.wsj.com/finance/story')
  assert.equal(item.publisher, 'WSJ')
  assert.equal(item.region, 'global')
  assert.ok(!JSON.stringify(item).includes('Do not redistribute'))
})

test('rejects unsafe domains, credentials, malformed XML and entity declarations', () => {
  for (const url of ['javascript:alert(1)', 'https://wsj.com.evil.test/x', 'https://evilwsj.com/x', 'https://user:pass@wsj.com/x', 'https://wsj.com:8000/x']) {
    assert.equal(safeArticleUrl(url, source.hosts), null)
  }
  assert.throws(() => parseFeed('<rss><channel>', source, now))
  assert.throws(() => parseFeed('<!DOCTYPE rss [<!ENTITY x "abc">]>' + rss(article()), source, now))
})

test('old, future, undated and promotional entries never become a fallback', () => {
  const data = article('Old story', 'https://wsj.com/old', 'Tue, 01 Sep 2026 00:00:00 GMT')
    + article('Future story', 'https://wsj.com/future', 'Tue, 01 Sep 2027 00:00:00 GMT')
    + article('Undated story', 'https://wsj.com/undated', '')
    + article('Market set to grow at 10% CAGR') + article('SHAREHOLDER ALERT: Law firm reminder')
  assert.deepEqual(parseFeed(rss(data), source, now), [])
})

test('Atom CDATA and Korean business topic filtering work without HTML rendering', () => {
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title><![CDATA[Markets <b>today</b>]]></title><link rel="alternate" href="https://wsj.com/atom"/><published>2026-09-11T02:00:00Z</published></entry></feed>`
  assert.equal(parseFeed(atom, source, now)[0].title, 'Markets today')
  const korean = { ...source, filterTopics: true, region: 'kr', publisher: '조선비즈', hosts: ['biz.chosun.com'] }
  const items = article('반도체 수출 증가', 'https://biz.chosun.com/industry/one') + article('오늘의 날씨', 'https://biz.chosun.com/weather/two')
  assert.equal(parseFeed(rss(items), korean, now).length, 1)
})

test('one publisher failure retains other publishers; duplicates are removed', async () => {
  const feeds = [source, { ...source, id: 'duplicate' }, { ...source, id: 'offline', url: 'https://offline.example/rss' }]
  const result = await collectNews(async url => url.includes('offline')
    ? new Response('Denied', { status: 403 }) : new Response(rss(article())), feeds, now)
  assert.equal(result.items.length, 1)
  assert.equal(result.sources[2].status, 'unavailable')
  assert.equal(result.fetchedAt, now)
  const empty = await collectNews(async () => new Response(rss(article('Sponsored report'))), [source], now)
  assert.deepEqual(empty.items, [])
  assert.equal(empty.sources[0].status, 'empty')
})

test('oversized feeds are rejected', async () => {
  const result = await collectNews(async () => new Response('x', { headers: { 'content-length': '3000000' } }), [source], now)
  assert.deepEqual(result.items, [])
  assert.equal(result.sources[0].status, 'unavailable')
})

test('API rejects writes, does not cache outages, and coalesces concurrent refreshes', async () => {
  const originalFetch = globalThis.fetch
  try {
    const { default: api } = await import('../api/news.js')
    const handler = api.fetch
    const post = await handler(new Request('https://example.com/api/news', { method: 'POST' }))
    assert.equal(post.status, 405)
    globalThis.fetch = async () => new Response('Unavailable', { status: 503 })
    const unavailable = await handler(new Request('https://example.com/api/news'))
    assert.equal(unavailable.status, 503)
    assert.equal(unavailable.headers.get('cache-control'), 'no-store')
    let count = 0
    globalThis.fetch = async () => {
      count++
      return new Response(rss(article('Current markets', 'https://www.wsj.com/current', new Date().toUTCString())))
    }
    const responses = await Promise.all([handler(new Request('https://example.com/api/news')), handler(new Request('https://example.com/api/news'))])
    assert.equal(responses[0].status, 200)
    assert.equal(responses[1].status, 200)
    assert.equal(count, SOURCES.filter(source => source.url).length)
    const payload = await responses[0].json()
    assert.equal(payload.items.length, 1)
    await handler(new Request('https://example.com/api/news'))
    assert.equal(count, SOURCES.filter(source => source.url).length)
  } finally { globalThis.fetch = originalFetch }
})

test('collector does not require the optional AbortSignal.timeout static method', async () => {
  const original = AbortSignal.timeout
  try {
    AbortSignal.timeout = undefined
    let calls = 0
    const result = await collectNews(async () => { calls++; return new Response(rss(article())) }, [source], now)
    assert.equal(calls, 1)
    assert.equal(result.items.length, 1)
    assert.equal(result.version, 'rss-node-v4')
  } finally { AbortSignal.timeout = original }
})

test('follows publisher redirects but rejects redirects outside the allowed domains', async () => {
  const visited = []
  const result = await collectNews(async url => {
    visited.push(url)
    return visited.length === 1 ? new Response(null, { status: 301, headers: { location: 'https://www.wsj.com/new-feed.xml' } })
      : new Response(rss(article()))
  }, [source], now)
  assert.equal(result.items.length, 1)
  assert.deepEqual(visited, ['https://feed.example/rss', 'https://www.wsj.com/new-feed.xml'])
  let requests = 0
  const blocked = await collectNews(async () => {
    requests++
    return new Response(null, { status: 302, headers: { location: 'https://unrelated.example/feed' } })
  }, [source], now)
  assert.equal(requests, 1)
  assert.equal(blocked.sources[0].error, 'redirect_not_allowed')
})

test('deadline finishes even when a fetch implementation ignores its abort signal', async () => {
  const start = Date.now()
  const result = await collectNews(() => new Promise(() => {}), [source], now, 20)
  assert.equal(result.sources[0].error, 'timeout')
  assert.ok(Date.now() - start < 1000)
})

test('failed feeds report sanitized stage or HTTP codes without exposing response bodies', async () => {
  const http = await collectNews(async () => new Response('Private upstream details', { status: 403 }), [source], now)
  assert.equal(http.sources[0].error, 'http_403')
  assert.ok(!JSON.stringify(http).includes('Private upstream'))
  const xml = await collectNews(async () => new Response('<html>Not a feed</html>'), [source], now)
  assert.equal(xml.sources[0].error, 'parse_failed')
})


test('feed image metadata chooses a usable image and retains its credit', () => {
  const entry = { 'media:content': [
    { '@_url': 'https://wsj.com/pixel.jpg', '@_width': '1', '@_height': '1' },
    { '@_url': 'https://images.wsj.net/photo.jpg?width=900&token=signed', '@_type': 'image/jpeg', '@_width': '900', 'media:credit': 'Photo agency' },
  ] }
  assert.deepEqual(feedImage(entry, { ...source, imageHosts: ['images.wsj.net'] }), {
    image_url: 'https://images.wsj.net/photo.jpg?width=900&token=signed', image_credit: 'Photo agency',
  })
  assert.deepEqual(feedImage({ 'media:thumbnail': { '@_url': 'https://evil.test/photo.jpg' } }, source), {})
  assert.deepEqual(feedImage({ 'media:thumbnail': { '@_url': 'javascript:alert(1)' } }, source), {})
  assert.deepEqual(feedImage({ 'media:content': { '@_url': 'https://wsj.com/movie.mp4', '@_type': 'video/mp4' } }, source), {})
})

test('RSS enclosures and description images are extracted without rendering HTML', () => {
  assert.equal(feedImage({ enclosure: { '@_type': 'image/jpeg', '@_url': 'https://wsj.com/photo.jpg' } }, source).image_url, 'https://wsj.com/photo.jpg')
  assert.equal(feedImage({ description: '<p>Body</p><img src="https://wsj.com/photo.jpg?a=1&amp;b=2" onerror="alert(1)">' }, source).image_url, 'https://wsj.com/photo.jpg?a=1&b=2')
  assert.deepEqual(feedImage({ description: '<script>alert(1)</script>' }, source), {})
})

test('timezone-less Korean dates use the publisher timezone', () => {
  const korean = { ...source, timezone: '+09:00' }
  assert.equal(publicationTime('2026-09-11 11:00:00', korean), Date.parse('2026-09-11T02:00:00Z'))
  assert.equal(publicationTime('Fri, 11 Sep 2026 11:00:00 +0900', korean), Date.parse('2026-09-11T02:00:00Z'))
  assert.ok(Number.isNaN(publicationTime('2026-09-11 11:00:00', source)))
})

test('licensed Reuters feed is explicit and does not expose configuration secrets', async () => {
  const key = 'ANTHRACITE_TEST_REUTERS_RSS_URL'
  const reuters = { ...SOURCES.find(source => source.id === 'reuters'), env: key }
  try {
    delete process.env[key]
    let requests = 0
    const missing = await collectNews(async () => { requests++; return new Response('') }, [reuters], now)
    assert.equal(missing.sources[0].status, 'not_configured')
    assert.equal(requests, 0)
    process.env[key] = 'https://unrelated.example/rss?token=private'
    const invalid = await collectNews(async () => { requests++; return new Response('') }, [reuters], now)
    assert.equal(invalid.sources[0].error, 'invalid_configuration')
    assert.equal(requests, 0)
    assert.ok(!JSON.stringify(invalid).includes('private'))
    process.env[key] = 'https://feeds.reuters.com/account/rss?token=private'
    const valid = await collectNews(async () => new Response(rss(article('Markets', 'https://www.reuters.com/markets/story'))), [reuters], now)
    assert.equal(valid.items.length, 1)
    assert.ok(!JSON.stringify(valid).includes('private'))
  } finally { delete process.env[key] }
})
