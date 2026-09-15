import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyNews } from '../lib/news-topics.js'
import { parseFeed } from '../lib/news.js'
import { filterNews, selectNews } from '../src/components/newsSelection.ts'

test('Korean and English finance, technology and company stories receive relevant topics', () => {
  for (const [title, topics] of [
    ['한국은행 기준금리 동결, 물가 전망 조정', ['economy']],
    ['Fed holds interest rates as inflation eases', ['economy']],
    ['반도체 수출 증가, 엔비디아 실적 발표', ['economy', 'tech', 'business']],
    ['Nvidia shares surge after earnings beat', ['tech', 'investing', 'business']],
    ['ETF 자금 유입과 국채 수익률 상승', ['investing']],
    ['기업 인수합병과 공급망 재편', ['business']],
  ]) {
    for (const topic of topics) assert.ok(classifyNews(title).includes(topic), `${title}: ${topic}`)
  }
})

test('unrelated content is excluded even inside a finance feed, while business impact is retained', () => {
  for (const title of ['오늘의 날씨: 맑고 따뜻', '배우 결혼식 화제', '축구 결승전 결과', 'AI로 그린 연예인 결혼식',
    'Celebrity divorce stuns fans', 'Golf tournament winner crowned', '쿠폰코드로 노트북 할인']) {
    assert.deepEqual(classifyNews(title, 'Business Finance'), [], title)
  }
  assert.deepEqual(classifyNews('A traveller said goodbye'), []) // "said" must not match "AI".
  assert.deepEqual(classifyNews('금융맨 남편에 섭섭함 토로'), [])
  assert.deepEqual(classifyNews('AI scammers are scouring obituaries to target widows'), [])
  assert.ok(classifyNews('축구 중계권 매출 급증').includes('business'))
  assert.ok(classifyNews('AI chip stocks gain').includes('tech'))
  assert.ok(classifyNews('Hurricane drives oil prices higher').includes('economy'))
  assert.ok(classifyNews('Oil climbs as pipeline remains offline').includes('economy'))
  assert.ok(classifyNews('Grab to buy majority stake in Atome').includes('business'))
  assert.ok(classifyNews('KKR private high-grade debt deals surge').includes('investing'))
  assert.deepEqual(classifyNews('Market research report predicts 12% CAGR'), [])
})

test('metadata classifies ambiguous headlines, without overwriting specific headline topics', () => {
  assert.deepEqual(classifyNews('A new chapter begins', 'Technology'), ['tech'])
  assert.deepEqual(classifyNews('OpenAI unveils new AI model', 'Economy Business'), ['tech'])
  assert.deepEqual(classifyNews('A new chapter begins', 'World'), [])
})

test('server applies the topic gate to all publishers and emits metadata only', () => {
  const now = Date.parse('2026-09-15T10:00:00Z')
  const item = (title, path, category = '') => `<item><title>${title}</title><category>${category}</category><link>https://example.com/${path}</link><pubDate>${new Date(now).toUTCString()}</pubDate><description>Private full article text</description></item>`
  const xml = `<rss><channel>${item('배우 결혼식', 'one', 'Business')}${item('반도체 실적 개선', 'two')}${item('A new chapter begins', 'three', 'Technology')}</channel></rss>`
  const result = parseFeed(xml, { publisher: 'Test', region: 'kr', hosts: ['example.com'] }, now)
  assert.equal(result.length, 2)
  assert.ok(result[0].topics.includes('tech'))
  assert.ok(!JSON.stringify(result).includes('Private full'))
})

test('region, topic and search combine before display limits; multiple topic labels work', () => {
  const now = Date.parse('2026-09-15T10:00:00Z')
  const items = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, title: `Market update ${i}`, publisher: `P${i}`, region: 'global', topics: ['investing'], published_utc: new Date(now - i * 60000).toISOString() }))
  const tech = { id: 'tech', title: '엔비디아 반도체 실적', publisher: '매일경제', region: 'kr', topics: ['tech', 'business'], published_utc: new Date(now - 6000000).toISOString() }
  items.push(tech)
  const matches = filterNews(items, 'kr', 'tech', '엔비디아 매일경제', now)
  assert.deepEqual(matches, [tech])
  assert.deepEqual(selectNews(matches, 'kr', now), [tech])
  assert.deepEqual(filterNews(items, 'global', 'tech', '', now), [])
  assert.deepEqual(filterNews(items, 'all', 'business', '', now), [tech])
  assert.deepEqual(filterNews(items, 'all', 'all', 'not found', now), [])
  assert.deepEqual(filterNews(items, 'all', 'all', '', now + 4 * 86400000), [])
})
