import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'

const { default: NewsArticle } = await import('../src/components/NewsArticle.tsx')
const { default: NewsFeed } = await import('../src/components/NewsFeed.tsx')
const { default: SavedItemsProvider, BookmarkButton } = await import('../src/components/SavedItemsProvider.tsx')
const { SAVED_KEY } = await import('../src/lib/savedItems.ts')
const { READ_KEY } = await import('../src/lib/readArticles.ts')

const item = {
  id: 'desktop-news', title: 'A complete headline with enough detail to explain the market move and the issue behind it',
  publisher: 'Financial News With A Long Publisher Name', published_utc: new Date(Date.now() - 30 * 60000).toISOString(),
  article_url: 'https://example.com/news/desktop', region: 'global', topics: ['economy', 'tech'],
}
function render(element, { session = {}, articles = [], read = {} } = {}) {
  const previousSession = globalThis.sessionStorage, previousLocal = globalThis.localStorage
  globalThis.sessionStorage = { getItem: key => Object.hasOwn(session, key) ? JSON.stringify(session[key]) : null }
  globalThis.localStorage = { getItem: key => key === SAVED_KEY ? JSON.stringify({ version: 1, stocks: [], articles }) : key === READ_KEY ? JSON.stringify(read) : null }
  try { return load(renderToStaticMarkup(createElement(SavedItemsProvider, null, element))) }
  finally {
    if (previousSession === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = previousSession
    if (previousLocal === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousLocal
  }
}
const article = (props = {}, storage) => render(createElement(NewsArticle, { item, read: false, timeLabel: '30분 전', onRead() {}, ...props }), storage)

test('desktop title links retain the full headline and reading position while metadata and bookmark share a footer', () => {
  const $ = article(), link = $('.news-row')
  assert.equal(link.find('h3').text(), item.title)
  assert.equal(link.attr('href'), item.article_url)
  assert.equal(link.attr('target'), '_blank')
  assert.equal(link.attr('rel'), 'noopener noreferrer')
  assert.equal($('.news-card').attr('data-reading-key'), `news:${item.article_url}`)
  assert.equal(link.attr('data-focus-key'), `news:${item.article_url}`)
  assert.equal(link.attr('aria-describedby'), $('.news-article-metadata').attr('id'))
  assert.equal($('.news-article-publisher').text(), item.publisher)
  assert.equal($('.news-article-time time').attr('datetime'), item.published_utc)
  assert.equal($('.news-article-time time').text(), '30분 전')
  assert.ok($('.news-article-time time').attr('title'))
  assert.equal($('.news-card > .news-row + .news-article-footer').length, 1)
  assert.equal($('.news-article-footer > .news-article-metadata + button.save-button').length, 1)
  assert.equal($('a button').length, 0)
  assert.equal($('.news-original').length, 0)
  assert.equal($('.news-topic-tags span').length, 2)
})

test('card and list articles share the footer without reserving blank image space in lists', () => {
  const list = article(), card = article({ image: createElement('figure', null, createElement('img', { src: 'https://example.com/photo.jpg', alt: '' }), createElement('figcaption', null, 'Photo credit')) })
  assert.equal(list('figure, img').length, 0)
  assert.equal(card('.news-row > figure img').length, 1)
  assert.equal(card('figcaption').text(), 'Photo credit')
  assert.equal(card('.news-row').children().first().prop('tagName'), 'FIGURE')
  for (const selector of ['h3', '.news-article-metadata', '.save-button']) assert.equal(list(selector).text(), card(selector).text())
})

test('desktop bookmarks have named icon actions and distinguish saved state without affecting text buttons elsewhere', () => {
  for (const saved of [false, true]) {
    const $ = article({}, { articles: saved ? [item] : [] }), button = $('.save-button')
    assert.equal(button.hasClass('save-button-icon'), true)
    assert.equal(button.attr('aria-pressed'), String(saved))
    assert.equal(button.attr('aria-label'), `${item.title} 북마크 ${saved ? '해제' : '저장'}`)
    assert.equal(button.attr('title'), saved ? '북마크 해제' : '기사 저장')
    assert.equal(button.text().trim(), '')
    assert.equal(button.find('svg').attr('aria-hidden'), 'true')
    assert.equal(button.find('svg').attr('fill'), saved ? 'currentColor' : 'none')
    const text = render(createElement(BookmarkButton, { article: item }), { articles: saved ? [item] : [] })
    assert.equal(text('.save-button').text().trim(), saved ? '✓ 저장됨' : '+ 기사 저장')
    assert.equal(text('.save-button svg').length, 0)
  }
})

test('mobile and desktop use the same publication metadata, read and stale indicators', () => {
  const props = { item: { ...item, region: 'kr', feedStale: true }, read: true }
  const desktop = article(props), mobile = article({ ...props, mobile: true })
  assert.equal(desktop('.news-card.is-read').length, 1)
  assert.equal(mobile('.mobile-news-article.is-read').length, 1)
  assert.equal(desktop('.news-article-metadata').text(), mobile('.news-article-metadata').text())
  assert.equal(desktop('.news-read-badge').text(), '읽음')
  assert.equal(desktop('.news-article-stale').text(), '이전 수집 기사')
  assert.ok(desktop('.news-article-time').text().includes('국내'))
  assert.equal(mobile('.save-button-icon').length, 0)
  assert.equal(mobile('.save-button').text().trim(), '+ 기사 저장')
})

test('actual desktop feeds render the shared articles in both display modes and keep logo fallbacks and saved marks', () => {
  for (const view of ['cards', 'list']) {
    const other = { ...item, id: 'domestic', title: '두 번째 기사의 전체 제목', article_url: 'https://example.com/news/domestic', region: 'kr', publisher: '국내 매체', published_utc: new Date(Date.now() - 45 * 60000).toISOString() }
    const data = { items: [item, other], sources: [], fetchedAt: Date.now() }
    const $ = render(createElement(NewsFeed), {
      session: { anthracite_curated_news_v6: data, 'anthracite.ui.v1.news.view': view }, articles: [item],
    })
    const selector = view === 'cards' ? '.news-grid' : '.news-list'
    assert.equal($(`${selector} > .news-card`).length, 2)
    assert.equal($(`${selector} .news-article-footer > .save-button-icon`).length, 2)
    assert.equal($(`${selector} .news-image-wrap`).length, view === 'cards' ? 2 : 0)
    assert.equal($(`${selector} .news-publisher-logo`).length, view === 'cards' ? 2 : 0)
    assert.equal($(`${selector} .save-button[aria-pressed=true]`).length, 1)
    assert.equal($(`${selector} .news-original, ${selector} .news-card > .save-button`).length, 0)
    assert.equal($(`${selector} a button`).length, 0)
  }
})
