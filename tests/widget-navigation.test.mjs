import test from 'node:test'
import assert from 'node:assert/strict'
import { widgetActivation } from '../src/lib/widgetNavigation.ts'

const click = { button: 0, defaultPrevented: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false }
test('plain card clicks open their page while nested controls and selected text retain their own behavior', () => {
  assert.equal(widgetActivation(click, false, ''), 'same-tab')
  assert.equal(widgetActivation(click, true, ''), null, 'date, filter, save, link and player controls are excluded')
  assert.equal(widgetActivation(click, false, '선택한 브리핑 문장'), null)
  assert.equal(widgetActivation({ ...click, defaultPrevented: true }, false, ''), null)
})
test('modified and middle card clicks open a separate tab; context menus and alt-click are left alone', () => {
  for (const option of [{ button: 1 }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
    assert.equal(widgetActivation({ ...click, ...option }, false, ''), 'new-tab')
    assert.equal(widgetActivation({ ...click, ...option }, true, ''), null)
  }
  assert.equal(widgetActivation({ ...click, button: 2 }, false, ''), null)
  assert.equal(widgetActivation({ ...click, altKey: true }, false, ''), null)
})
