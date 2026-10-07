import test from 'node:test'
import assert from 'node:assert/strict'
import { feedText } from '../lib/feed-text.js'
import { parseFeed } from '../lib/news.js'
test('feed titles decode bounded HTML entities and remain plain text', () => {
  assert.equal(feedText('Fed &quot;rates&quot; &#x2019; &#39; &amp;amp;'), `Fed "rates" ’ ' &`)
  assert.equal(feedText('&lt;b&gt;Stocks&lt;/b&gt; &nbsp; rise'), 'Stocks rise')
  assert.equal(feedText('&#x110000; &#xD800;'), '&#x110000; &#xD800;')
})
test('CDATA and escaped RSS titles normalize to the same visible title', () => {
  const source = { publisher: 'Example', region: 'global', hosts: ['example.com'] }
  const now = Date.parse('2026-10-07T03:00:00Z')
  const titles = ['<![CDATA[Stocks &quot;rise&quot; &#x2019;]]>', 'Stocks &amp;quot;rise&amp;quot; &amp;#x2019;']
  for (const title of titles) {
    const xml = `<rss><channel><item><title>${title}</title><link>https://example.com/a</link><pubDate>Wed, 07 Oct 2026 02:00:00 GMT</pubDate></item></channel></rss>`
    assert.equal(parseFeed(xml, source, now)[0].title, 'Stocks "rise" ’')
  }
})
