import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { load } from 'cheerio'
import { briefingSections } from '../src/lib/briefingPresentation.ts'
const { default: BriefingDetails } = await import('../src/components/BriefingDetails.tsx')
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
const details = (section, mobile = true, item = edition) => render(createElement(BriefingDetails, { item, section, mobile, headingLevel: 'h3' }))

test('full-edition sections reflect available published details without changing the edition', () => {
  const before = structuredClone(edition)
  assert.deepEqual(briefingSections(edition).map(x => [x.key, x.count]), [['stocks', 1], ['assets', 2], ['events', 2]])
  assert.deepEqual(briefingSections(undefined), [])
  assert.deepEqual(briefingSections({ ...edition, homepage: { stocks: [], assets: [], events: [] } }), [])
  assert.deepEqual(edition, before)
})

test('full-edition stock details retain original names, price changes, reasons, basis and citations', () => {
  const $ = details('stocks')
  for (const stock of edition.homepage.stocks) {
    for (const text of [stock.name, stock.ticker, stock.change, stock.reason, stock.basis]) assert.ok($('.briefing-stocks').text().includes(text))
    for (const id of stock.sourceIds) assert.ok($(`.briefing-stocks a[href="/briefings/${edition.id}#source-${id}"]`).length)
  }
  assert.equal($('.briefing-stock-heading .briefing-down').text(), '−3.2%')
  assert.equal($('.briefing-section-heading h3').text(), '주요 종목')
})

test('full-edition asset layouts preserve each value, change, observation basis and source', () => {
  for (const mobile of [true, false]) {
    const $ = details('assets', mobile)
    assert.equal(mobile ? $('.mobile-briefing-assets > div').length : $('.briefing-assets tbody tr').length, edition.homepage.assets.length)
    for (const asset of edition.homepage.assets) {
      for (const text of [asset.label, asset.value, asset.change, asset.basis]) assert.ok($('.briefing-section').text().includes(text))
      for (const id of asset.sourceIds) assert.ok($(`a[href="/briefings/${edition.id}#source-${id}"]`).length)
    }
    assert.ok($('.briefing-section').text().includes('자산별 관측 시각과 비교 기준이 다릅니다.'))
  }
})

test('full-edition events retain original times, order, details and citations', () => {
  const before = structuredClone(edition), $ = details('events')
  assert.deepEqual($('.briefing-events time').map((_, el) => $(el).attr('datetime')).get(), edition.homepage.events.map(event => event.at))
  for (const event of edition.homepage.events) {
    assert.ok($('.briefing-events').text().includes(event.label))
    if (event.detail) assert.ok($('.briefing-events').text().includes(event.detail))
    for (const id of event.sourceIds) assert.ok($(`a[href="/briefings/${edition.id}#source-${id}"]`).length)
  }
  assert.deepEqual(edition, before)
})

test('legacy editions without structured details and unknown sections do not invent data', () => {
  const legacy = { ...edition }; delete legacy.homepage
  assert.equal(details('stocks', true, legacy)('.briefing-section').length, 0)
  assert.equal(details(undefined)('.briefing-section').length, 0)
})
