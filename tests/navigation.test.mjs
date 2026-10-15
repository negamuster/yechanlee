import test from 'node:test'
import assert from 'node:assert/strict'
import { createReadingStore, findReadingTarget, readingKeys, resumesList, maintainReadingPosition, topPosition } from '../src/lib/readingPosition.ts'
import { makeReturnOrigin, readReturnOrigin, returnDelta, originLabel } from '../src/lib/returnNavigation.ts'
import { isNewsSector } from '../src/components/sectorNews.ts'

const position = (y, extras = {}) => ({ y, panels: {}, ...extras })
function storage() {
  const data = new Map()
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
}
function environment() {
  let current = position(0), available = 0, hashAvailable = false
  const callbacks = {}, applied = [], saved = [], disposed = []
  const register = name => callback => { callbacks[name] = callback; return () => disposed.push(name) }
  const env = {
    capture: () => structuredClone(current),
    restore: target => { applied.push(structuredClone(target)); current = { ...target, y: Math.min(target.y, available) } },
    followHash: hash => { if (hashAvailable) { current = position(740); return hash === '#source-4' } return false },
    observe: register('resize'), onScroll: register('scroll'), onInteraction: register('input'), onExit: register('exit'),
    deadline: (callback, ms) => { assert.equal(ms, 32000); return register('deadline')(callback) },
  }
  return { env, callbacks, applied, saved, disposed, available: value => { available = value }, move: value => { current = value; callbacks.scroll?.() }, hashReady: () => { hashAvailable = true }, save: p => saved.push(structuredClone(p)) }
}

test('reading positions survive reload and keep separate history entries, layouts and nested panels', () => {
  const disk = storage(), store = createReadingStore(disk)
  const first = readingKeys('desktop', 'home-a', '/'), second = readingKeys('desktop', 'home-b', '/')
  const mobile = readingKeys('mobile', 'home-a', '/')
  const original = position(1800, { anchor: { key: 'news:https://example.com/article', offset: 110 }, focus: 'news:article', panels: { 'movers-gainers': { top: 240, left: 0 } } })
  store.set(first.entry, original); store.set(first.route, original)
  store.set(second.entry, position(500)); store.set(second.route, position(500)); store.set(mobile.entry, position(90))
  const reloaded = createReadingStore(disk)
  assert.deepEqual(reloaded.get(first.entry), original)
  assert.equal(reloaded.get(second.entry).y, 500)
  assert.equal(reloaded.get(first.route).y, 500)
  assert.equal(reloaded.get(mobile.entry).y, 90)
  assert.equal(resumesList('/'), true)
  assert.equal(resumesList('/saved'), true)
  assert.equal(resumesList('/stock/TSLA'), false)
})
test('blocked storage keeps positions in memory, corrupt snapshots are discarded and history stays bounded', () => {
  const blocked = createReadingStore({ getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } })
  blocked.set('home', position(50)); assert.equal(blocked.get('home').y, 50)
  const disk = storage()
  disk.setItem('anthracite.reading.v2', JSON.stringify([['negative', position(-1)], ['badPanel', position(0, { panels: { x: { top: '50', left: 0 } } })], ['good', position(30)]]))
  const store = createReadingStore(disk)
  assert.equal(store.get('negative'), undefined); assert.equal(store.get('badPanel'), undefined); assert.equal(store.get('good').y, 30)
  for (let i = 0; i < 200; i++) store.set(`entry-${i}`, position(i))
  const reloaded = createReadingStore(disk)
  assert.equal(reloaded.get('entry-0'), undefined)
  assert.equal(reloaded.get('entry-199').y, 199)
  assert.ok([...disk.data.values()][0].length < 20000)
})
test('late lists retry the intended reading position instead of saving a clamped loading-screen position', () => {
  const e = environment(), target = position(2200, { panels: { movers: { top: 220, left: 0 } } })
  const dispose = maintainReadingPosition(target, '', e.env, e.save)
  assert.equal(e.applied.length, 1)
  e.callbacks.scroll() // Initial short loading page clamps scrollY to zero.
  e.callbacks.exit()
  assert.deepEqual(e.saved.at(-1), target)
  e.available(5000); e.callbacks.resize()
  assert.deepEqual(e.applied.at(-1), target)
  e.callbacks.deadline(); dispose()
  assert.equal(e.saved.at(-1).y, 2200)
  assert.deepEqual(e.disposed.sort(), ['deadline', 'exit', 'input', 'resize', 'scroll'])
})
test('user scrolling cancels restoration and saves the new position for the next visit', () => {
  const e = environment()
  const dispose = maintainReadingPosition(position(2000), '', e.env, e.save)
  e.callbacks.input(); e.move(position(320))
  const count = e.applied.length
  e.available(8000); e.callbacks.resize(); e.callbacks.deadline()
  assert.equal(e.applied.length, count)
  dispose(); assert.equal(e.saved.at(-1).y, 320)
})
test('source anchors take priority over stored scroll and wait for lazy content', () => {
  const e = environment()
  const dispose = maintainReadingPosition(position(2200), '#source-4', e.env, e.save)
  assert.equal(e.applied.length, 0)
  e.hashReady(); e.callbacks.resize(); e.callbacks.resize(); dispose()
  assert.equal(e.saved.at(-1).y, 740)
})
test('fresh detail pages start at the top and do not pull users back after they begin reading', () => {
  const e = environment()
  const dispose = maintainReadingPosition(topPosition(), '', e.env, e.save)
  e.move(position(600)); e.callbacks.resize(); dispose()
  assert.equal(e.applied.length, 1)
  assert.equal(e.saved.at(-1).y, 600)
})
test('stock detail retains its source through related stocks and computes a real return through history', () => {
  const source = { pathname: '/saved', search: '?view=stocks', hash: '', key: 'saved-a' }
  const origin = makeReturnOrigin(source, 3)
  assert.equal(originLabel(origin.href), '관심목록')
  const related = makeReturnOrigin({ pathname: '/stock/MSFT', search: '', hash: '#stock-news', key: 'stock-b', state: { returnOrigin: origin } }, 5)
  assert.deepEqual(related, origin)
  assert.equal(returnDelta(related, 5), -2)
  assert.equal(returnDelta(related, 3), null)
  assert.equal(returnDelta(related, undefined), null)
  assert.equal(makeReturnOrigin({ pathname: '/stock/TSLA', search: '', hash: '', key: 'direct' }, 0), null)
})
test('return destinations reject external paths, malformed state and invalid history indices', () => {
  for (const href of ['//evil.example', 'https://evil.example', '/\\evil.example', '/stock/TSLA', '/unknown', '/saved\n']) {
    assert.equal(readReturnOrigin({ returnOrigin: { href, key: 'a', index: 0 } }), null, href)
  }
  assert.equal(readReturnOrigin({ returnOrigin: { href: '/saved', key: 'a', index: -1 } }), null)
  assert.equal(readReturnOrigin({ returnOrigin: { href: '/saved', key: 'a', index: '0' } }), null)
  assert.equal(readReturnOrigin(null), null)
})
test('persisted sector filters accept known sectors and reset invalid stored values', () => {
  assert.equal(isNewsSector(null), true)
  assert.equal(isNewsSector({ symbol: 'XLK', name: 'Technology' }), true)
  for (const value of [{ symbol: 'BAD', name: 'bad' }, { symbol: '__proto__', name: 'bad' }, { symbol: 'XLK', name: 2 }, undefined, {}]) assert.equal(isNewsSector(value), false)
})
test('back and forward use the correct entry; menu visits resume lists while new detail visits start at the top', () => {
  const store = createReadingStore(storage())
  const a = { pathname: '/', search: '', key: 'a' }, b = { pathname: '/', search: '', key: 'b' }
  store.set(readingKeys('desktop', 'a', '/').entry, position(1800))
  store.set(readingKeys('desktop', 'b', '/').entry, position(800))
  store.set(readingKeys('desktop', 'b', '/').route, position(800))
  assert.equal(findReadingTarget(store, 'desktop', a, 'POP').position.y, 1800)
  assert.equal(findReadingTarget(store, 'desktop', b, 'POP').position.y, 800)
  assert.equal(findReadingTarget(store, 'desktop', { ...a, key: 'new' }, 'PUSH').position.y, 800)
  assert.equal(findReadingTarget(store, 'desktop', { ...a, key: 'new', state: { restoreEntry: 'a' } }, 'PUSH').position.y, 1800)
  const stock = { pathname: '/stock/TSLA', search: '', key: 's' }
  store.set(readingKeys('desktop', 's', stock.pathname).entry, position(500))
  store.set(readingKeys('desktop', 's', stock.pathname).route, position(500))
  assert.equal(findReadingTarget(store, 'desktop', stock, 'POP').position.y, 500)
  assert.equal(findReadingTarget(store, 'desktop', { ...stock, key: 'new' }, 'PUSH').position.y, 0)
  assert.equal(findReadingTarget(store, 'mobile', a, 'POP').position.y, 0)
})
test('unkeyed direct visits do not inherit a different route position', () => {
  const store = createReadingStore(storage())
  store.set(readingKeys('desktop', 'default', '/').entry, position(2000))
  const stock = { pathname: '/stock/TSLA', search: '', key: 'default' }
  assert.equal(findReadingTarget(store, 'desktop', stock, 'POP').position.y, 0)
})
test('revisiting a fragment restores where reading stopped, while a fresh source link follows the fragment', () => {
  const store = createReadingStore(storage())
  const entry = { pathname: '/briefings/2026-10-15', search: '', hash: '#source-4', key: 'read' }
  store.set(readingKeys('desktop', entry.key, entry.pathname).entry, position(2100))
  assert.deepEqual(findReadingTarget(store, 'desktop', entry, 'POP'), { position: position(2100), hash: '' })
  assert.equal(findReadingTarget(store, 'desktop', { ...entry, key: 'new' }, 'PUSH').hash, '#source-4')
})
