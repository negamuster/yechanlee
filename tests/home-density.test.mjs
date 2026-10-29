import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from './helpers/render-static.mjs'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { load } from 'cheerio'
const { HomeBriefingCard } = await import('../src/components/HomeBriefing.tsx')
const { default: Briefings } = await import('../src/pages/Briefings.tsx')
const { default: SavedItemsProvider } = await import('../src/components/SavedItemsProvider.tsx')
const { latestBriefing } = await import('../src/lib/briefings.ts')

const edition = { id: 'test-edition', title: 'Original title', sessionDate: '2026-10-20', cutoffAt: '2026-10-20T22:00:00Z', publishedAt: '2026-10-20T22:10:00Z', reviewMode: 'automated',
  summary: ['정규장 -0.5% · 시간외 보도 시점 +2%입니다. 최종 종가가 아닙니다.[1]', '두 번째 문단입니다.[1]', '세 번째 문단입니다.[1]'],
  homepage: { headline: '원래 헤드라인[1]', stocks: [], assets: [], events: [] }, sources: [{ id: 1, label: 'Official source', url: 'https://example.com/source' }], blocks: [], dataNote: 'Original basis', corrections: [] }
const render = element => load(renderToStaticMarkup(h(MemoryRouter, null, element)))

test('compact home preserves one complete cited paragraph, original date and a direct full-edition path on both layouts', () => {
  const before = structuredClone(edition)
  for (const mobile of [false, true]) {
    const $ = render(h(HomeBriefingCard, { item: edition, mobile }))
    assert.equal($('.home-briefing-summary').text(), edition.summary[0])
    assert.equal($('.home-briefing-card').text().includes(edition.summary[1]), false)
    assert.equal($('.home-briefing-date time').attr('datetime'), edition.cutoffAt)
    assert.ok($('.home-briefing-date').text().includes(edition.sessionDate))
    assert.ok($('.home-briefing-date').text().includes('KST'))
    assert.equal($('h3 a').text(), '원래 헤드라인')
    assert.equal($('.home-briefing-read').attr('href'), '/briefings/test-edition')
    assert.equal($('[data-widget-link]').attr('href'), '/briefings')
    assert.equal($('[data-widget-link]').length, 1)
    assert.equal($('.home-briefing-summary a').attr('href'), '/briefings/test-edition#source-1')
    assert.ok($('.home-briefing-disclaimer').text().includes('AI 작성·자동 검토'))
    assert.ok($('.home-briefing-disclaimer').text().includes('실시간 시황이 아닙니다'))
    assert.equal($('.briefing-detail-tabs, .briefing-stocks, .mobile-briefing-event-preview').length, 0)
  }
  assert.deepEqual(edition, before)
})

test('compact home keeps rules/legacy editions honest and missing editions have a useful empty state', () => {
  const legacy = { ...edition, reviewMode: 'rules' }; delete legacy.homepage
  const $ = render(h(HomeBriefingCard, { item: legacy }))
  assert.equal($('h3 a').text(), edition.title)
  assert.ok($('.home-briefing-disclaimer').text().includes('규칙 기반 자동 정리 · AI 미사용'))
  assert.equal($('.home-briefing-summary').text(), edition.summary[0])
  const empty = render(h(HomeBriefingCard))
  assert.equal(empty('.home-briefing-empty a').attr('href'), '/#home-news-title')
  assert.equal(empty('.home-briefing-summary, time, .home-briefing-read').length, 0)
})

test('full edition exposes all original summary/detail values, basis, sources and events removed from the home preview', () => {
  const item = latestBriefing, before = structuredClone(item)
  const $ = load(renderToStaticMarkup(h(MemoryRouter, { initialEntries: [`/briefings/${item.id}`] }, h(SavedItemsProvider, null,
    h(Routes, null, h(Route, { path: '/briefings/:date', element: h(Briefings) }))))))
  assert.equal($('.briefing-edition-summary li').length, item.summary.length)
  for (const paragraph of item.summary) assert.ok($('.briefing-edition-summary').text().includes(paragraph))
  for (const stock of item.homepage?.stocks ?? []) {
    for (const text of [stock.name, stock.ticker, stock.change, stock.reason, stock.basis]) assert.ok($('.briefing-stocks').text().includes(text), text)
    for (const id of stock.sourceIds) assert.ok($(`.briefing-stocks a[href="/briefings/${item.id}#source-${id}"]`).length)
  }
  for (const asset of item.homepage?.assets ?? []) {
    for (const text of [asset.label, asset.value, asset.change, asset.basis]) assert.ok($('.mobile-briefing-assets').text().includes(text), text)
    for (const id of asset.sourceIds) assert.ok($(`.mobile-briefing-assets a[href="/briefings/${item.id}#source-${id}"]`).length)
  }
  for (const event of item.homepage?.events ?? []) {
    assert.ok($(`.briefing-events time[datetime="${event.at}"]`).length)
    assert.ok($('.briefing-events').text().includes(event.label))
    if (event.detail) assert.ok($('.briefing-events').text().includes(event.detail))
  }
  assert.equal($('.briefing-edition-details h4').length, 0)
  assert.deepEqual(item, before)
})
