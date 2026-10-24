import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultNoteFilters, defaultEvidenceFilters, findNotes, findEvidence, koreanToday, validNoteFilters, validEvidenceFilters } from '../src/lib/noteDiscovery.ts'
const at = '2026-10-20T00:00:00Z'
const note = (ticker, more = {}) => ({ ticker, name: ticker === 'NVDA' ? 'NVIDIA' : ticker, revision: 'r', createdAt: at, updatedAt: at, reasons: ['Merlin launch', '', ''], counter: 'Cash burn', next: 'Renewals', reviewDate: '', history: [], ...more })
const source = (id, more = {}) => ({ id, kind: 'news', role: 'support', title: 'Original launch', publisher: 'Research News', reason: 'Contract renewal', attachedAt: at, ...more })
test('note query combines saved prose/history tokens with latest judgment, never mutating records', () => {
  const notes = [note('SATL', { history: [{ judgment: 'strengthen', reason: 'Old catalyst' }, { judgment: 'pending', reason: 'Await confirmation' }] }), note('NVDA')]
  const original = structuredClone(notes)
  assert.deepEqual(findNotes(notes, { ...defaultNoteFilters(), query: 'ＳＡＴＬ cash CATALYST', judgment: 'pending' }).map(n => n.ticker), ['SATL'])
  assert.equal(findNotes(notes, { ...defaultNoteFilters(), judgment: 'strengthen' }).length, 0)
  assert.deepEqual(findNotes(notes, { ...defaultNoteFilters(), judgment: 'none' }).map(n => n.ticker), ['NVDA'])
  assert.deepEqual(notes, original)
})
test('Korean midnight and review filters include today in due and the next seven days in upcoming', () => {
  assert.equal(koreanToday(new Date('2026-10-23T14:59:59Z')), '2026-10-23')
  assert.equal(koreanToday(new Date('2026-10-23T15:00:00Z')), '2026-10-24')
  const notes = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-31', '2026-11-01', ''].map((reviewDate, i) => note(`T${i}`, { reviewDate }))
  const find = review => findNotes(notes, { ...defaultNoteFilters(), review }, '2026-10-24').map(n => n.ticker)
  assert.deepEqual(find('due'), ['T0', 'T1']); assert.deepEqual(find('upcoming'), ['T2', 'T3']); assert.deepEqual(find('none'), ['T5'])
})
test('evidence filters combine kind/role/archive/query and order by the actual attachment instant', () => {
  const evidence = [source('a', { attachedAt: '2026-10-20T09:00:00+09:00' }), source('b', { kind: 'filing', role: 'counter', archivedAt: at }), source('c', { attachedAt: '2026-10-20T01:00:00Z' })]
  const before = structuredClone(evidence)
  assert.deepEqual(findEvidence(evidence, defaultEvidenceFilters()).map(e => e.id), ['c', 'a'])
  assert.deepEqual(findEvidence(evidence, { ...defaultEvidenceFilters(), sort: 'oldest' }).map(e => e.id), ['a', 'c'])
  assert.deepEqual(findEvidence(evidence, { query: 'RESEARCH renewal', kind: 'filing', role: 'counter', archive: 'archived', sort: 'newest' }).map(e => e.id), ['b'])
  assert.equal(findEvidence(evidence, { ...defaultEvidenceFilters(), query: 'missing' }).length, 0)
  assert.deepEqual(evidence, before)
})
test('invalid persisted filter shapes are rejected rather than hiding every record', () => {
  assert.equal(validNoteFilters(defaultNoteFilters()), true); assert.equal(validEvidenceFilters(defaultEvidenceFilters()), true)
  for (const v of [null, {}, { ...defaultNoteFilters(), judgment: 'toString' }, { ...defaultNoteFilters(), query: 'x'.repeat(121) }, { ...defaultNoteFilters(), review: 'tomorrow' }]) assert.equal(validNoteFilters(v), false)
  for (const v of [null, {}, { ...defaultEvidenceFilters(), kind: '__proto__' }, { ...defaultEvidenceFilters(), archive: 'bad' }, { ...defaultEvidenceFilters(), query: [] }, { ...defaultEvidenceFilters(), sort: 'bad' }]) assert.equal(validEvidenceFilters(v), false)
})
