import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from './helpers/render-static.mjs'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { load } from 'cheerio'
const { briefings } = await import('../src/lib/briefingArchive.ts')
const { default: Briefings } = await import('../src/pages/Briefings.tsx')
const { default: SavedItemsProvider } = await import('../src/components/SavedItemsProvider.tsx')
const { briefingEvidence } = await import('../src/lib/evidenceSources.ts')

test('every published edition renders original summaries, sources and optional correction history without mutating the archive', () => {
  const before = structuredClone(briefings)
  for (const item of briefings) {
    const $ = load(renderToStaticMarkup(h(MemoryRouter, { initialEntries: [`/briefings/${item.id}`] }, h(SavedItemsProvider, null,
      h(Routes, null, h(Route, { path: '/briefings/:date', element: h(Briefings) }))))))
    assert.equal($('h1').text(), item.title, item.id)
    assert.equal($('.briefing-edition-summary li').length, item.summary.length, item.id)
    assert.equal($('.briefing-sources li').length, item.sources.length, item.id)
    for (const source of item.sources) assert.equal($(`#source-${source.id} > a`).first().attr('href'), source.url, item.id)
    for (const correction of item.corrections ?? []) assert.ok($('.briefing-article details').text().includes(correction.text), item.id)
    const evidence = briefingEvidence(item)
    assert.equal(evidence.observedAt, item.cutoffAt)
    assert.equal(evidence.url, `https://yechanlee.vercel.app/briefings/${item.id}`)
    if (!item.corrections?.length) assert.equal(evidence.caveat.includes('연결 당시 정정 이력:'), false, item.id)
  }
  assert.deepEqual(briefings, before)
})
