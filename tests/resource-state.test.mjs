import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { Children, createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'

const { default: ResourceState, DataNotice, DataSkeleton } = await import('../src/components/ResourceState.tsx')
const { dataTime } = await import('../src/utils/dataTime.ts')
const stamp = '2026-10-15T03:20:00Z'
const render = props => load(renderToStaticMarkup(createElement(ResourceState, { label: '시장 데이터', loading: false, error: false, hasData: false, onRetry() {}, ...props })))

test('initial loading has a named skeleton without pretending to have values', () => {
  for (const [layout, count] of [['rows', 3], ['tiles', 6], ['news', 3], ['ticker', 4]]) {
    const $ = load(renderToStaticMarkup(createElement(DataSkeleton, { label: '시장 데이터 불러오는 중', layout })))
    assert.equal($('.data-skeleton[role=status]').attr('aria-label'), '시장 데이터 불러오는 중')
    assert.equal($('.data-sr-only').text(), '시장 데이터 불러오는 중')
    assert.equal($('.data-skeleton-shapes[aria-hidden=true] .data-skeleton-item').length, count)
    assert.equal($('button, time, a').length, 0)
  }
  assert.equal(render({ loading: true })('.data-skeleton').length, 1)
})

test('background refresh uses a small status, and successful idle data has no notice', () => {
  const $ = render({ loading: true, hasData: true, updatedAt: stamp })
  assert.equal($('.data-notice-loading').text().trim(), '업데이트 중…')
  assert.equal($('.data-notice-mark[aria-hidden="true"] svg').length, 1)
  assert.equal($('.data-skeleton, button').length, 0)
  assert.equal(render({ hasData: true }).root().text(), '')
})

test('an initial error offers retry without a phantom previous-data timestamp', () => {
  const $ = render({ error: true, updatedAt: stamp })
  assert.equal($('.data-notice-error').length, 1)
  assert.ok($('.data-notice').text().includes('시장 데이터 조회에 실패했습니다.'))
  assert.equal($('.data-retry').text(), '다시 시도')
  assert.equal($('.data-retry').is('[disabled]'), false)
  assert.equal($('time, .data-skeleton').length, 0)
  assert.equal($('.data-notice').is('[data-widget-interactive]'), true)
})

test('failed refresh keeps the displayed snapshot timestamp explicit and disables duplicate retries', () => {
  const $ = render({ error: true, hasData: true, loading: true, updatedAt: stamp })
  assert.equal($('.data-notice-warning').length, 1)
  assert.ok($('.data-notice').text().includes('이전 데이터 표시 중'))
  assert.equal($('time').attr('datetime'), stamp.replace('Z', '.000Z'))
  assert.equal($('time').text(), dataTime(stamp))
  assert.equal($('.data-retry').is('[disabled]'), true)
  assert.equal($('.data-retry').text(), '확인 중…')
  assert.equal($('.data-skeleton').length, 0)
})

test('partial results describe the missing source without calling all available data stale', () => {
  const $ = render({ stale: true, hasData: true, failureMessage: '일정 일부를 확인하지 못했습니다.', failureDetail: 'BLS · 실적 조회 실패' })
  assert.ok($('.data-notice').text().includes('일정 일부를 확인하지 못했습니다.'))
  assert.ok($('.data-notice').text().includes('BLS · 실적 조회 실패'))
  assert.equal($('.data-notice').text().includes('이전 데이터'), false)
})

test('retry calls its handler once and invalid times do not become invented dates', () => {
  let calls = 0
  const element = DataNotice({ message: '조회 실패', onRetry: () => calls++, updatedAt: 'invalid' })
  Children.toArray(element.props.children).find(child => child.type === 'button').props.onClick()
  assert.equal(calls, 1)
  const $ = load(renderToStaticMarkup(element))
  assert.equal($('time').length, 0)
})
