import test from 'node:test'
import assert from 'node:assert/strict'
import { siteSearchResults, searchPages } from '../src/lib/siteSearch.ts'
import { stockSearchQuery } from '../src/lib/stockSearch.ts'
const saved = { version: 1, stocks: [{ ticker: 'AAPL', name: 'Apple Inc.' }], articles: [{ title: '애플 반도체 투자 확대', publisher: 'Reuters', article_url: 'https://example.com/apple#saved', published_utc: '2026-10-20T10:00:00Z' }] }
const briefings = [{ id: '2026-10-20', title: 'Daily Market Briefing', sessionDate: '2026-10-19', summary: ['연준 금리 동결'], blocks: [{ kind: 'paragraph', text: '반도체 설비투자 증가' }] }]
const news = { items: [saved.articles[0], { ...saved.articles[0], title: '엔비디아 실적 발표', article_url: 'https://example.com/nvidia' }], fetchedAt: 1, sources: [] }
const find = (query, stocks = [], group = 'all') => siteSearchResults(query, saved, briefings, news, stocks, group)
test('quick destinations include every top-level route, tools and archives; empty query shows useful choices', () => {
  assert.equal(new Set(searchPages.map(row => row[0])).size, searchPages.length)
  for (const route of ['/calendar', '/form13f', '/simulator', '/saved', '/briefings']) assert.ok(searchPages.some(row => row[0] === route))
  assert.ok(find('').some(row => row.group === 'stocks' && row.href === '/stock/AAPL'))
  assert.equal(find('13f')[0].href, '/form13f')
  assert.equal(find('캘린더')[0].href, '/calendar')
})
test('search covers briefing body, dates, saved titles, publishers and recent news without altering source data', () => {
  const before = structuredClone({ saved, briefings, news })
  assert.ok(find('설비투자').some(row => row.href === '/briefings/2026-10-20'))
  assert.ok(find('2026-10-19').some(row => row.group === 'briefings'))
  assert.ok(find('애플 투자').some(row => row.group === 'saved'))
  assert.ok(find('Reuters').some(row => row.group === 'news'))
  assert.deepEqual({ saved, briefings, news }, before)
})
test('saved articles win canonical URL deduplication and unsafe links are excluded', () => {
  assert.equal(find('').filter(row => row.href === 'https://example.com/apple').length, 1)
  assert.equal(find('').find(row => row.href === 'https://example.com/apple').group, 'saved')
  const invalid = { ...saved, articles: [{ ...saved.articles[0], article_url: 'javascript:alert(1)' }] }
  assert.equal(siteSearchResults('', invalid, [], null).filter(row => row.external).length, 0)
})
test('Korean aliases and case-insensitive tickers share confirmed remote and saved matches', () => {
  assert.equal(stockSearchQuery(' 애플 '), 'AAPL')
  assert.equal(find('애플').find(row => row.group === 'stocks').href, '/stock/AAPL')
  const matches = [{ ticker: 'AAPL', name: 'Apple' }, { ticker: 'AAP', name: 'Advance Auto Parts' }]
  assert.equal(find('aapl', matches, 'stocks').length, 1)
  assert.equal(find('brk.b', [], 'stocks').length, 0, 'unverified tickers are not search results')
  assert.equal(find('https://evil.test', [], 'stocks').length, 0)
  assert.ok(find('엔비디아', [{ ticker: 'NVDA', name: 'NVIDIA' }], 'stocks').some(row => row.href === '/stock/NVDA'))
})
test('company names cannot invent ticker results or outrank the company returned by the provider', () => {
  for (const [query, ticker, name] of [['Apple', 'AAPL', 'Apple Inc.'], ['Nvidia', 'NVDA', 'NVIDIA Corporation'], ['Tesla', 'TSLA', 'Tesla Inc.']]) {
    const items = { version: 1, stocks: [], articles: [] }
    assert.equal(siteSearchResults(query, items, [], null, [], 'stocks').length, 0)
    const rows = siteSearchResults(query, items, [], null, [{ ticker, name }], 'stocks')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].href, `/stock/${ticker}`)
    assert.equal(rows.some(row => row.href === `/stock/${query.toUpperCase()}`), false)
  }
})
test('category filters keep results in their category and multiword matching requires all words', () => {
  assert.ok(find('반도체', [], 'briefings').every(row => row.group === 'briefings'))
  assert.equal(find('반도체 외계인', [], 'news').length, 0)
  assert.equal(find('애플', [], 'saved').length, 1)
})
