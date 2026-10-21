import test from 'node:test'
import assert from 'node:assert/strict'
import { applyNewsSnapshot, isNewsFeed, newsUpdateSummary, NEWS_SNAPSHOT_KEY, readNewsSnapshot, receiveNewsSnapshot } from '../src/lib/newsRefresh.ts'
import { defaultNewsFilters, matchingNews } from '../src/lib/newsFilters.ts'

const now = Date.parse('2026-10-21T01:00:00Z')
const article = (id, overrides = {}) => ({ id, title: `${id} market news`, article_url: `https://example.com/${id}`, publisher: 'Test News', region: 'global', topics: ['economy'], published_utc: new Date(now - 3600000).toISOString(), ...overrides })
const feed = (items, time = now) => ({ items, fetchedAt: time, sources: [] })
const initial = current => ({ current, latest: current, selectedAt: now })
const filters = defaultNewsFilters('list')

test('background refresh stages additions, edits and removals without changing the current reading snapshot', () => {
  const current = feed([article('a'), article('b')])
  const state = initial(current)
  const next = receiveNewsSnapshot(state, feed([article('new'), article('a', { title: 'Corrected headline' })], now + 60000), now + 60000)
  assert.equal(next.current, current)
  assert.equal(next.selectedAt, now)
  assert.deepEqual(next.current.items.map(item => item.id), ['a', 'b'])
  assert.deepEqual(newsUpdateSummary(next, filters, () => false, now + 60000), { count: 1, available: true })
  const applied = applyNewsSnapshot(next, now + 120000)
  assert.equal(applied.current, next.latest)
  assert.equal(applied.selectedAt, now + 120000)
  assert.deepEqual(newsUpdateSummary(applied, filters, () => false, now + 120000), { count: 0, available: false })
})

test('new-article counts use canonical URLs, ignore publisher ID changes and do not accumulate duplicates across polls', () => {
  const current = feed([article('a')])
  const sameArticle = article('changed-id', { title: 'a market news', article_url: 'https://example.com/a#updated' })
  const incoming = feed([sameArticle, article('b'), article('duplicate-b', { article_url: 'https://example.com/b#copy' })], now + 1)
  const next = receiveNewsSnapshot(initial(current), incoming, now + 1)
  assert.equal(next.latest.items.length, 2)
  assert.equal(newsUpdateSummary(next, filters, () => false, now + 1).count, 1)
  const repeat = receiveNewsSnapshot(next, { ...incoming, fetchedAt: now + 2 }, now + 2)
  assert.equal(newsUpdateSummary(repeat, filters, () => false, now + 2).count, 1)
  const noChange = receiveNewsSnapshot(initial(current), feed([sameArticle], now + 1), now + 1)
  assert.deepEqual(newsUpdateSummary(noChange, filters, () => false, now + 1), { count: 0, available: false })
})

test('counts respect active region, topic, title query, sector and read filters', () => {
  const next = receiveNewsSnapshot(initial(feed([article('a')])), feed([
    article('a'), article('tech', { title: 'NVIDIA chip technology', topics: ['tech'] }),
    article('kr', { title: 'NVIDIA chip Korea', region: 'kr', topics: ['tech'] }),
    article('other', { title: 'Oil markets', topics: ['investing'] }),
  ], now + 1), now + 1)
  const active = { ...filters, region: 'global', topic: 'tech', query: 'NVIDIA', sector: { symbol: 'XLK', name: 'Technology' }, hideRead: true }
  assert.equal(newsUpdateSummary(next, active, () => false, now + 1).count, 1)
  assert.deepEqual(newsUpdateSummary(next, active, url => url.endsWith('/tech'), now + 1), { count: 0, available: false })
})

test('pending corrections and empty replacements remain explicit and older responses cannot discard newer pending data', () => {
  const state = initial(feed([article('a')]))
  const corrected = receiveNewsSnapshot(state, feed([article('a', { title: 'Correction' })], now + 2), now + 2)
  assert.deepEqual(newsUpdateSummary(corrected, filters, () => false, now + 2), { count: 0, available: true })
  assert.equal(receiveNewsSnapshot(corrected, feed([article('old')], now + 1), now + 3), corrected)
  const empty = receiveNewsSnapshot(corrected, feed([], now + 3), now + 3)
  assert.deepEqual(newsUpdateSummary(empty, filters, () => false, now + 3), { count: 0, available: true })
  assert.equal(applyNewsSnapshot(empty).current.items.length, 0)
  const first = receiveNewsSnapshot({ current: null, latest: null, selectedAt: now }, feed([article('first')]), now)
  assert.equal(first.current, first.latest)
})

test('saved snapshots restore the unchanged reading list and its pending update together, with bounded cache age', () => {
  const state = receiveNewsSnapshot(initial(feed([article('a')])), feed([article('b')], now + 1), now + 1)
  const restored = readNewsSnapshot({ getItem: key => key === NEWS_SNAPSHOT_KEY ? JSON.stringify(state) : null }, now + 60000)
  assert.deepEqual(restored, state)
  const legacy = readNewsSnapshot({ getItem: key => key === 'anthracite_curated_news_v6' ? JSON.stringify(feed([article('a')])) : null }, now)
  assert.equal(legacy.current.items[0].id, 'a')
  assert.equal(readNewsSnapshot({ getItem: () => JSON.stringify(state) }, now + 7 * 3600000).current, null)
  assert.equal(readNewsSnapshot({ getItem() { throw new Error('blocked') } }, now).current, null)
  assert.equal(isNewsFeed(feed([article('bad', { article_url: 'javascript:alert(1)' })]), now), false)
  assert.equal(isNewsFeed(feed([article('bad', { article_url: ['https://example.com/a'] })]), now), false)
})

test('articles do not disappear from a reading snapshot merely because its 72-hour boundary passes during a poll', () => {
  const current = feed([article('boundary', { published_utc: new Date(now - 72 * 3600000 + 1000).toISOString() })])
  const state = receiveNewsSnapshot(initial(current), feed([], now + 60000), now + 60000)
  assert.equal(matchingNews(state.current.items, filters, () => false, state.selectedAt).length, 1)
  assert.deepEqual(newsUpdateSummary(state, filters, () => false, now + 60000), { count: 0, available: true })
})
