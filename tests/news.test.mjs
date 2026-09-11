import test from 'node:test'
import assert from 'node:assert/strict'
import { collectNews, parseFeed, safeArticleUrl } from '../lib/news.js'

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
    const { default: handler } = await import('../api/news.js')
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
    assert.equal(count, 7)
    const payload = await responses[0].json()
    assert.equal(payload.items.length, 1)
    await handler(new Request('https://example.com/api/news'))
    assert.equal(count, 7)
  } finally { globalThis.fetch = originalFetch }
})
