import test from 'node:test'
import assert from 'node:assert/strict'
import { hideMobileNavigation, isTextEntry, mobileSection } from '../src/lib/mobileUI.ts'

test('nested briefing and investment-note routes retain the correct mobile tab', () => {
  for (const route of ['/', '/briefings', '/briefings/2026-10-15', '/briefings/methodology']) assert.equal(mobileSection(route), '/')
  for (const route of ['/saved', '/saved/thesis/TSLA']) assert.equal(mobileSection(route), '/saved')
  for (const route of ['/markets', '/equity', '/stock/TSLA']) assert.equal(mobileSection(route), '/markets')
  assert.equal(mobileSection('/calendar'), '/calendar')
  assert.equal(mobileSection('/form13f'), '/more')
})
test('text entry is distinguished from date pickers, file dialogs and non-editable fields', () => {
  for (const type of ['text','search','email','number','tel']) assert.equal(isTextEntry({ tagName:'INPUT', type }), true)
  for (const type of ['date','time','month','file','checkbox','radio','range','button']) assert.equal(isTextEntry({ tagName:'INPUT', type }), false)
  assert.equal(isTextEntry({ tagName:'TEXTAREA' }), true)
  assert.equal(isTextEntry({ tagName:'DIV', isContentEditable:true }), true)
  assert.equal(isTextEntry({ tagName:'INPUT', type:'text', readOnly:true }), false)
  assert.equal(isTextEntry({ tagName:'TEXTAREA', disabled:true }), false)
  assert.equal(isTextEntry({ tagName:'SELECT' }), false)
  assert.equal(isTextEntry(null), false)
})
test('closing the keyboard restores navigation even while the field remains focused', () => {
  assert.equal(hideMobileNavigation(true, 800, { height:470, scale:1 }), true)
  assert.equal(hideMobileNavigation(true, 800, { height:800, scale:1 }), false)
  assert.equal(hideMobileNavigation(true, 800, { height:760, scale:1 }), false)
  assert.equal(hideMobileNavigation(false, 800, { height:470, scale:1 }), false)
  assert.equal(hideMobileNavigation(true, 360, { height:180, scale:1 }), true)
})
test('pinch zoom and invalid viewport sizes do not hide navigation; old browsers retain focus fallback', () => {
  assert.equal(hideMobileNavigation(true, 800, { height:400, scale:2 }), false)
  assert.equal(hideMobileNavigation(true, 800, { height:250, scale:2 }), true)
  assert.equal(hideMobileNavigation(true, 800, null), true)
  assert.equal(hideMobileNavigation(false, 800, null), false)
  for (const viewport of [{ height:0, scale:1 }, { height:NaN, scale:1 }, { height:400, scale:0 }]) assert.equal(hideMobileNavigation(true, 800, viewport), false)
})
