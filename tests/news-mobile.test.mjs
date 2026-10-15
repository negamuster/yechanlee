import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'

const { default: MobileNewsArticle } = await import('../src/components/MobileNewsArticle.tsx')
const { default: SavedItemsProvider } = await import('../src/components/SavedItemsProvider.tsx')
const { default: MobileNewsFilters } = await import('../src/components/MobileNewsFilters.tsx')
const { default: NewsFeed } = await import('../src/components/NewsFeed.tsx')
const { defaultNewsFilters } = await import('../src/lib/newsFilters.ts')
const item = { id: 'mobile-news', title: '긴 제목도 임의로 자르지 않고 시장의 움직임과 그 이유를 온전히 확인할 수 있는 기사', publisher: 'Test Financial News', published_utc: '2026-10-15T03:20:00Z', article_url: 'https://example.com/news/mobile', region: 'global', topics: ['economy', 'tech'] }
const render = (props = {}) => load(renderToStaticMarkup(createElement(SavedItemsProvider, null,
  createElement(MobileNewsArticle, { item, read: false, timeLabel: '30분 전', onRead() {}, ...props }))))

test('mobile news keeps intact title above consistent source/time metadata and an independent bookmark action', () => {
  const $ = render(), link = $('.mobile-news-link')
  assert.equal(link.find('h3').text(), item.title)
  assert.equal(link.attr('href'), item.article_url)
  assert.equal(link.attr('target'), '_blank')
  assert.equal($('.mobile-news-publisher').text(), item.publisher)
  assert.equal($('.mobile-news-time time').attr('datetime'), item.published_utc)
  assert.equal($('.mobile-news-time time').text(), '30분 전')
  assert.equal($('.mobile-news-footer > .save-button').length, 1)
  assert.equal(link.find('button').length, 0)
  assert.equal($('.save-button').attr('aria-pressed'), 'false')
  assert.equal(link.attr('aria-describedby'), $('.mobile-news-metadata').attr('id'))
  assert.equal($('.mobile-news-article').attr('data-reading-key'), `news:${item.article_url}`)
  assert.equal(link.attr('data-focus-key'), `news:${item.article_url}`)
})
test('card and list views share title, metadata and bookmark order without reserving empty image space', () => {
  const list = render(), card = render({ image: createElement('img', { src: 'https://example.com/photo.jpg', alt: '' }) })
  assert.equal(list('.mobile-news-thumbnail').length, 0)
  assert.equal(card('.mobile-news-thumbnail img').length, 1)
  assert.equal(card('.mobile-news-link.has-image').length, 1)
  for (const selector of ['h3', '.mobile-news-metadata', '.save-button']) assert.equal(list(selector).text(), card(selector).text())
  assert.equal(card('.mobile-news-link + .mobile-news-footer').length, 1)
})
test('read and stale indicators remain explicit without obscuring title or publication time', () => {
  const $ = render({ item: { ...item, region: 'kr', feedStale: true }, read: true })
  assert.equal($('.mobile-news-article.is-read').length, 1)
  assert.equal($('.news-read-badge').text(), '읽음')
  assert.equal($('.mobile-news-stale').text(), '이전 수집 기사')
  assert.ok($('.mobile-news-time').text().includes('국내'))
  assert.equal($('h3').text(), item.title)
  assert.equal($('time').attr('datetime'), item.published_utc)
})
test('older articles without topic metadata still render the complete title and controls', () => {
  const $ = render({ item: { ...item, topics: undefined } })
  assert.equal($('h3').text(), item.title)
  assert.equal($('.mobile-news-topics').text(), '')
  assert.equal($('.mobile-news-footer > button').length, 1)
})
test('mobile filter sheet has a labelled native dialog, keyboard-native choices and separate reset/apply controls', () => {
  const $ = load(renderToStaticMarkup(createElement(MobileNewsFilters, { id: 'test-filters', value: defaultNewsFilters('list'), items: [], available: true, isRead: () => false, onApply() {}, onDismiss() {} })))
  assert.equal($('dialog').attr('aria-modal'), 'true')
  assert.equal($('dialog').attr('aria-labelledby'), $('h2').attr('id'))
  assert.equal($('dialog').attr('aria-describedby'), $('.news-sheet-header p').attr('id'))
  assert.equal($('fieldset').length, 4)
  assert.equal($('input[type=radio][checked]').length, 3)
  assert.equal($('.news-sheet-reset').text(), '조건 초기화')
  assert.equal($('.news-sheet-apply').text(), '적용하기')
  assert.equal($('.news-sheet-close').attr('aria-label'), '뉴스 필터 닫기')
  assert.equal($('.news-sheet-footer [role=status]').text(), '이 조건에 맞는 기사 0개')
  assert.equal($('dialog[open]').length, 0, 'showModal, not an open attribute, controls top-layer lifecycle')
})
test('news filters keep desktop inline controls while mobile exposes a closed dialog trigger and compact toolbar', () => {
  const feed = mobile => load(renderToStaticMarkup(createElement(SavedItemsProvider, null, createElement(NewsFeed, { mobile }))))
  const mobile = feed(true), desktop = feed(false)
  assert.equal(mobile('.news-filter-toggle').attr('aria-haspopup'), 'dialog')
  assert.equal(mobile('.news-filter-toggle').attr('aria-expanded'), 'false')
  assert.equal(mobile('.news-filter-panel, .news-view-toggle, dialog').length, 0)
  assert.equal(mobile('.news-filters button').length, 3)
  assert.equal(mobile('.news-refresh .news-sr-only').length, 1)
  assert.equal(desktop('.news-filter-toggle').attr('aria-haspopup'), undefined)
  assert.equal(desktop('.news-filter-panel[hidden]').length, 0)
  assert.equal(desktop('.news-filter-panel .news-topic-filters button').length, 5)
  assert.equal(desktop('.news-view-toggle button').length, 2)
})
