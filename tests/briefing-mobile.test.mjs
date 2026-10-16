import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import './helpers/register-tsx.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { load } from 'cheerio'
import { briefingEventPreview, briefingSections, validMobileBriefingState, visibleBriefingSummary } from '../src/lib/briefingPresentation.ts'

const { MobileBriefingCard } = await import('../src/components/MobileDailyBriefing.tsx')
const { default: BriefingDetails } = await import('../src/components/BriefingDetails.tsx')
const { default: DailyBriefing } = await import('../src/components/DailyBriefing.tsx')
const [publishedEdition] = JSON.parse(readFileSync(new URL('../src/data/published-briefings.json', import.meta.url), 'utf8'))
const edition = {
  id: '2026-10-15', title: 'Test briefing', sessionDate: '2026-10-14', cutoffAt: '2026-10-14T22:00:00Z', publishedAt: '2026-10-14T22:10:00Z', reviewMode: 'automated',
  summary: ['첫 번째 요약입니다.[1]', '두 번째 요약입니다.[1][2]', '세 번째 요약입니다.[2]'], blocks: [], dataNote: 'Fixture', corrections: [],
  sources: [{ id: 1, label: 'First source', url: 'https://example.com/one' }, { id: 2, label: 'Second source', url: 'https://example.com/two' }],
  homepage: { headline: '핵심 헤드라인[1]',
    stocks: [{ ticker: 'ABC', name: 'Test company', change: '−3.2%', reason: '확인된 주가 변동 이유', basis: '2026-10-14 정규장 종가 · 전 거래일 대비', sourceIds: [1] }],
    assets: [{ label: 'Test yield', value: '5.19%', change: '−2bp', basis: '10/15 04:30 KST 관측 · 10/13 대비', sourceIds: [1] }, { label: 'Test gold', value: 'US$4,096.58/트로이온스', change: '−1.45%', basis: '현물 호가 · 공식 종가 아님', sourceIds: [2] }],
    events: [{ at: '2026-10-15T21:30:00+09:00', label: 'Test release', detail: '확인할 항목: 전월·전년 대비 변화.', sourceIds: [2] }, { at: '2026-10-16T21:30:00+09:00', label: 'Next release', sourceIds: [1] }],
  },
}
const render = element => load(renderToStaticMarkup(createElement(MemoryRouter, null, element)))
const card = (state = { summary: false, section: null }, item = edition) => render(createElement(MobileBriefingCard, { item, state, onChange() {} }))

test('mobile home starts with one intact summary and folded details while retaining date, sources and live-data warning', () => {
  const before = structuredClone(edition), $ = card()
  assert.equal($('.mobile-briefing-summary-list li').length, 1)
  assert.ok($('.mobile-briefing-summary-list').text().includes(edition.summary[0]))
  assert.ok($('.mobile-briefing-meta').text().includes(edition.sessionDate))
  assert.equal($('.mobile-briefing-meta time').attr('datetime'), edition.cutoffAt)
  assert.ok($('.mobile-briefing-meta').text().includes('KST'))
  assert.equal($('.mobile-briefing-detail-content[aria-hidden="true"][inert]').length, 1)
  assert.equal($('.mobile-briefing-detail-controls button[aria-expanded="true"]').length, 0)
  assert.ok($('.mobile-briefing-disclaimer').text().includes('실시간 시황이 아닙니다'))
  assert.ok($(`a[href="/briefings/${edition.id}#source-1"]`).length)
  assert.equal($('.mobile-briefing-kicker a[data-widget-link]').attr('href'), '/briefings')
  assert.equal($('.mobile-briefing-headline a').attr('href'), `/briefings/${edition.id}`)
  assert.equal($('.mobile-briefing-actions').length, 0)
  assert.deepEqual(edition, before)
})
test('expanded mobile summary preserves every original paragraph and source reference', () => {
  const $ = card({ summary: true, section: null })
  assert.equal($('.mobile-briefing-summary-list li').length, edition.summary.length)
  for (const paragraph of edition.summary) assert.ok($('.mobile-briefing-summary-list').text().includes(paragraph))
  assert.equal($('.mobile-briefing-summary-toggle').attr('aria-expanded'), 'true')
})
test('mobile asset cards retain full values, changes, observation basis and source links', () => {
  const $ = card({ summary: false, section: 'assets' })
  assert.equal($('.mobile-briefing-detail-content[aria-hidden="true"]').length, 0)
  assert.equal($('.mobile-briefing-assets > div').length, edition.homepage.assets.length)
  assert.equal($('.mobile-briefing-detail-content table').length, 0)
  for (const asset of edition.homepage.assets) {
    assert.ok($('.mobile-briefing-assets').text().includes(asset.value))
    assert.ok($('.mobile-briefing-assets').text().includes(asset.change))
    assert.ok($('.mobile-briefing-assets').text().includes(asset.basis))
    for (const id of asset.sourceIds) assert.ok($(`.mobile-briefing-assets a[href="/briefings/${edition.id}#source-${id}"]`).length)
  }
  assert.equal($('.mobile-briefing-detail-controls button[aria-expanded="true"]').length, 1)
})
test('expanded stocks retain price basis and reasons; expanded events retain what to check without duplicating preview', () => {
  const stocks = card({ summary: false, section: 'stocks' })
  for (const stock of edition.homepage.stocks) {
    assert.ok(stocks('.briefing-stocks').text().includes(stock.reason))
    assert.ok(stocks('.briefing-stocks').text().includes(stock.basis))
    assert.ok(stocks('.briefing-stocks').text().includes(stock.change))
  }
  const events = card({ summary: false, section: 'events' })
  assert.equal(events('.mobile-briefing-event-preview').length, 0)
  for (const event of edition.homepage.events) if (event.detail) assert.ok(events('.briefing-events').text().includes(event.detail))
})
test('desktop keeps its original overview, tabs and table-based assets', () => {
  const $ = render(createElement(DailyBriefing, { mobile: false }))
  assert.equal($('.mobile-briefing').length, 0)
  assert.equal($('.briefing-detail-tabs').length, briefingSections(publishedEdition).length ? 1 : 0)
  assert.equal($('.briefing-stocks li').length, publishedEdition?.homepage?.stocks.length ?? 0)
  const assets = render(createElement(BriefingDetails, { item: edition, section: 'assets' }))
  assert.equal(assets('table.briefing-assets tbody tr').length, edition.homepage.assets.length)
})
test('older editions and missing briefings still expose a useful reading path without empty detail controls', () => {
  const older = { ...edition }; delete older.homepage
  const $ = card({ summary: false, section: 'stocks' }, older)
  assert.equal($('.mobile-briefing-detail-controls').length, 0)
  assert.equal($('.mobile-briefing-event-preview').length, 0)
  assert.equal($('.mobile-briefing-headline a').attr('href'), `/briefings/${older.id}`)
  const empty = render(createElement(MobileBriefingCard, { state: { summary: false, section: null }, onChange() {} }))
  assert.equal(empty('.mobile-briefing-empty a').attr('href'), '/#home-news-title')
  assert.equal(empty('.mobile-briefing-summary').length, 0)
})
test('disclosure state validation and event preview preserve edition contents and order', () => {
  assert.equal(validMobileBriefingState({ summary: false, section: null }), true)
  assert.equal(validMobileBriefingState({ summary: true, section: 'events' }), true)
  for (const value of [null, {}, { summary: 'false', section: 'stocks' }, { summary: true, section: 'unknown' }]) assert.equal(validMobileBriefingState(value), false)
  const copy = structuredClone(edition)
  copy.homepage.events.reverse()
  const before = structuredClone(copy)
  assert.equal(briefingEventPreview(copy).at, edition.homepage.events[0].at)
  assert.deepEqual(copy, before)
  assert.equal(visibleBriefingSummary(copy.summary, false).length, 1)
  assert.deepEqual(visibleBriefingSummary(copy.summary, true), copy.summary)
  assert.deepEqual(briefingSections(undefined), [])
  assert.deepEqual(visibleBriefingSummary([], false), [])
})
