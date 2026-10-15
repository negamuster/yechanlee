import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { Children, createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'

const { default: WidgetActions } = await import('../src/components/WidgetActions.tsx')

test('widget refresh, info and close controls invoke independent actions', () => {
  const invoked = []
  const element = WidgetActions({ label: 'Calendar', refresh: { loading: false, onClick: () => invoked.push('refresh') },
    info: { id: 'source-panel', label: '캘린더 출처와 조회 범위', open: false, onClick: () => invoked.push('info') }, close: () => invoked.push('close') })
  const buttons = Children.toArray(element.props.children)
  assert.equal(buttons.length, 3)
  for (const name of ['info', 'refresh', 'close']) buttons.find(button => button.props['data-widget-action'] === name).props.onClick()
  assert.deepEqual(invoked, ['info', 'refresh', 'close'])
})

test('loading and disclosure state remain explicit for keyboard and screen-reader users', () => {
  const $ = load(renderToStaticMarkup(createElement(WidgetActions, { label: 'Maps', refresh: { loading: true, onClick() {} },
    info: { id: 'maps-source', label: 'Maps 출처와 산정 기준', open: true, onClick() {} } })))
  const refresh = $('[data-widget-action=refresh]'), info = $('[data-widget-action=info]')
  assert.equal(refresh.is('[disabled]'), true)
  assert.ok(refresh.attr('aria-label').includes('Maps 새로고침'))
  assert.equal(info.attr('aria-expanded'), 'true')
  assert.equal(info.attr('aria-controls'), 'maps-source')
  assert.equal(info.attr('aria-label'), 'Maps 출처와 산정 기준')
  assert.equal($('button[type=button]').length, 2)
  assert.equal($('svg[aria-hidden=true]').length, 2)
  assert.equal($('a').length, 0)
})
