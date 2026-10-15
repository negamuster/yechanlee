import test from 'node:test'
import assert from 'node:assert/strict'
import { countNewsFilters, defaultNewsFilters, matchingNews } from '../src/lib/newsFilters.ts'
import { outsideDialog, presentModal } from '../src/lib/modal.ts'

const now = Date.parse('2026-10-15T04:00:00Z')
const news = (id, extra = {}) => ({ id, title: 'Nvidia technology earnings', article_url: `https://example.com/${id}`, publisher: 'Test', published_utc: '2026-10-15T03:00:00Z', region: 'global', topics: ['tech'], ...extra })
test('filter reset removes every condition but retains the reading layout preference', () => {
  for (const view of ['cards', 'list']) {
    const filters = defaultNewsFilters(view)
    assert.equal(filters.view, view)
    assert.equal(countNewsFilters(filters), 0)
    assert.equal(countNewsFilters({ ...filters, region: 'kr', topic: 'tech', query: ' Nvidia ', sector: { symbol: 'XLK', name: 'Tech' }, hideRead: true }), 5)
    assert.equal(countNewsFilters({ ...filters, query: '  ' }), 0)
  }
})
test('sheet preview and applied news use the same search, region, topic, sector and read rules without mutating articles', () => {
  const items = [news('match'), news('read'), news('region', { region: 'kr' }), news('topic', { topics: ['business'] }), news('keyword', { title: 'Nvidia tariff update' }), news('sector', { title: 'Other company earnings' }), news('old', { published_utc: '2026-10-10T03:00:00Z' })]
  const before = structuredClone(items)
  const filters = { ...defaultNewsFilters('list'), region: 'global', topic: 'tech', query: 'earnings', sector: { symbol: 'XLK', name: 'Tech' }, hideRead: true }
  assert.deepEqual(matchingNews(items, filters, url => url.endsWith('/read'), now).map(item => item.id), ['match'])
  assert.deepEqual(items, before)
  assert.deepEqual(matchingNews(items, { ...filters, query: 'unmatched query' }, () => false, now), [])
  assert.equal(matchingNews(items, defaultNewsFilters('cards'), () => false, now).length, 6)
})

function fakeStyle(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, { value, priority: 'important' }]))
  return { getPropertyValue: key => values.get(key)?.value || '', getPropertyPriority: key => values.get(key)?.priority || '',
    setProperty: (key, value, priority = '') => values.set(key, { value, priority }), removeProperty: key => values.delete(key) }
}
function modalFixture() {
  const focusCalls = []
  const trigger = { isConnected: true, focus: options => focusCalls.push(options) }
  const root = { style: fakeStyle({ 'overflow-y': 'scroll', color: 'red' }) }, body = { style: fakeStyle() }
  const dialog = { ownerDocument: { activeElement: trigger, documentElement: root, body }, open: false, closes: 0,
    showModal() { this.open = true }, close() { this.open = false; this.closes++ } }
  return { dialog, trigger, root, body, focusCalls }
}
test('native sheet lifecycle pairs scroll locking with exact style restoration and focus return on dismissal/unmount', () => {
  const { dialog, root, body, focusCalls } = modalFixture()
  const release = presentModal(dialog)
  assert.equal(dialog.open, true)
  assert.equal(root.style.getPropertyValue('overflow-x'), 'hidden')
  assert.equal(body.style.getPropertyValue('overflow-y'), 'hidden')
  release(); release()
  assert.equal(dialog.open, false)
  assert.equal(dialog.closes, 1)
  assert.equal(root.style.getPropertyValue('overflow-y'), 'scroll')
  assert.equal(root.style.getPropertyPriority('overflow-y'), 'important')
  assert.equal(root.style.getPropertyValue('overflow-x'), '')
  assert.equal(body.style.getPropertyValue('overflow-y'), '')
  assert.equal(root.style.getPropertyValue('color'), 'red')
  assert.deepEqual(focusCalls, [{ preventScroll: true }])
})
test('route unmount does not focus a removed trigger; failed modal opening does not lock scrolling', () => {
  const fixture = modalFixture(), release = presentModal(fixture.dialog)
  fixture.trigger.isConnected = false
  release()
  assert.deepEqual(fixture.focusCalls, [])
  const failed = modalFixture()
  failed.dialog.showModal = () => { throw new Error('Opening failed') }
  assert.throws(() => presentModal(failed.dialog), /Opening failed/)
  assert.equal(failed.root.style.getPropertyValue('overflow-y'), 'scroll')
  assert.equal(failed.body.style.getPropertyValue('overflow-y'), '')
})
test('only taps outside the actual panel bounds count as backdrop dismissal', () => {
  const rect = { left: 0, right: 390, top: 250, bottom: 844 }
  assert.equal(outsideDialog({ clientX: 180, clientY: 200 }, rect), true)
  assert.equal(outsideDialog({ clientX: 180, clientY: 270 }, rect), false)
  assert.equal(outsideDialog({ clientX: 0, clientY: 250 }, rect), false)
  assert.equal(outsideDialog({ clientX: 391, clientY: 500 }, rect), true)
})
