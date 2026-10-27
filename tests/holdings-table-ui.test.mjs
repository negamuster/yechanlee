import test, { beforeEach, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import './helpers/register-tsx.mjs'
import { filingFixture, manyHoldings } from './fixtures/form13f.mjs'
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://anthracite.test/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MouseEvent', 'Event']) globalThis[key] = dom.window[key]
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { createElement: h, act, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
const { default: FullHoldingsTable } = await import('../src/components/FullHoldingsTable.tsx')
const { DEFAULT_HOLDINGS_SORTING } = await import('../src/lib/holdingsTable.ts')
const { holdingRows } = await import('../src/lib/form13fPresentation.ts')
const container = document.getElementById('root')
let root, downloaded
const createURL = URL.createObjectURL, revokeURL = URL.revokeObjectURL
URL.createObjectURL = blob => { downloaded = blob; return 'blob:test' }
URL.revokeObjectURL = () => {}
dom.window.HTMLAnchorElement.prototype.click = () => {}
function Harness({ filing }) {
  const [query, setQuery] = useState(''), [sort, setSort] = useState(DEFAULT_HOLDINGS_SORTING)
  return h(FullHoldingsTable, { filing, cik: '0001067983', query, setQuery, sort, setSort })
}
async function render(filing, key = 'first') { await act(async () => root.render(h(Harness, { filing, key }))) }
function button(text) { return [...container.querySelectorAll('button')].find(b => b.textContent.trim() === text) }
async function click(element, options = {}) { assert.ok(element); await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true, ...options }))) }
const names = () => [...container.querySelectorAll('tbody .holding-name strong')].map(el => el.textContent)
const header = id => container.querySelector(`thead [data-column="${id}"] button`)
const checkbox = label => [...container.querySelectorAll('.holdings-columns label')].find(el => el.textContent.startsWith(label)).querySelector('input')
async function select(filter) { const input = container.querySelector('select'); await act(async () => { input.value = filter; input.dispatchEvent(new Event('change', { bubbles: true })) }) }
beforeEach(() => { root = createRoot(container); downloaded = null })
afterEach(async () => { await act(async () => root.unmount()) })
after(() => { URL.createObjectURL = createURL; URL.revokeObjectURL = revokeURL; dom.window.close() })

test('TanStack pagination and visibility preserve full CSV, raw identifiers, original ranks and the portfolio denominator', async () => {
  const filing = filingFixture({ holdings: manyHoldings() }), original = structuredClone(filing)
  await render(filing); assert.equal(names().length, 50)
  await click(button('다음')); assert.equal(names().length, 17)
  await click(checkbox('평가액'))
  assert.equal(container.querySelectorAll('thead th').length, 4)
  assert.match(container.querySelector('.holdings-sort-order').textContent, /종목 오름차순/)
  assert.equal(container.querySelector('.holdings-pagination [role="status"]').textContent, '1–50 / 67개 · 1 / 2페이지')
  assert.equal(checkbox('종목').disabled, true)
  await click(button('CSV 저장 (67)'))
  const csv = await downloaded.text()
  assert.equal(csv.trim().split('\r\n').length, 68)
  assert.match(csv, /value_usd/); assert.match(csv, /'000000067/)
  assert.ok(csv.indexOf('HOLDING 001') < csv.indexOf('HOLDING 067'))
  await select('increased')
  assert.equal(container.querySelector('.holding-rank').textContent, '2')
  const first = container.querySelector('tbody tr')
  assert.equal(first.querySelector('td').textContent, (66 / filing.totalValue * 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + '%')
  assert.deepEqual(filing, original)
})

test('numeric sorting and explicit multi-sort use full precision, preserve distinct CUSIPs and expose one primary aria-sort', async () => {
  const holdings = [
    { name: 'ALPHA', cusip: '000000001', title: 'CL C', value: 950e6, shares: 10, prevShares: 20 },
    { name: 'ALPHA', cusip: '000000002', title: 'CL A', value: 1.1e9, shares: 30, prevShares: 20 },
    { name: 'BETA', cusip: '000000003', title: 'COM', value: 1.1e9, shares: 40, prevShares: 20 },
  ]
  await render(filingFixture({ holdings }))
  assert.deepEqual([...container.querySelectorAll('.holding-rank')].map(el => el.textContent), ['2', '3', '1'])
  await click(header('name')); await click(button('다중 정렬')); await click(header('shares'))
  assert.deepEqual([...container.querySelectorAll('.holding-rank')].map(el => el.textContent), ['2', '1', '3'])
  assert.match(container.querySelector('.holdings-sort-order').textContent, /1\. 종목 오름차순 → 2\. 보유 수량 내림차순/)
  assert.equal(container.querySelectorAll('[aria-sort]').length, 1)
  assert.equal(container.querySelector('[aria-sort]').getAttribute('data-column'), 'name')
  await click(header('value')); await click(header('pct'))
  assert.match(container.querySelector('.holdings-sort-order').textContent, /1\. 보유 수량 내림차순 → 2\. 평가액 내림차순 → 3\. 비중 내림차순/)
  await click(checkbox('보유 수량'))
  assert.doesNotMatch(container.querySelector('.holdings-sort-order').textContent, /보유 수량/)
  await click(button('초기화'))
  assert.equal(container.querySelectorAll('thead th').length, 5)
  assert.equal(button('다중 정렬').getAttribute('aria-pressed'), 'false')
  assert.match(container.querySelector('.holdings-sort-order').textContent, /평가액 내림차순/)
})

test('change sorting matches existing financial rules in both directions, including missing/new values and previous-only exits', async () => {
  const filing = filingFixture({ closedHoldings: [{ name: 'EXIT', cusip: '999999999', title: 'COM', shares: 0, prevShares: 10, value: 0 }] })
  await render(filing); await select('all')
  for (const direction of ['desc', 'asc']) {
    await click(header('change'))
    const expected = holdingRows([...filing.holdings, ...filing.closedHoldings], filing.totalValue, '', { key: 'change', direction })
    assert.deepEqual(names(), expected.map(row => row.name))
    assert.equal(names().at(-1), 'NEW INC')
  }
  assert.match(container.textContent, /전량 미기재/)
  const unknown = filingFixture({ previousAvailable: false, holdings: filing.holdings.map(({ prevShares, ...row }) => row) })
  await render(unknown, 'other')
  await click(header('change')); await click(header('change'))
  assert.equal(container.querySelectorAll('tbody tr').length, 3)
  assert.equal([...container.querySelectorAll('tbody tr')].filter(row => row.textContent.includes('비교 자료 없음')).length, 3)
})

test('empty filters and new filing data clamp pagination, and reset restores every visible column even on an empty table', async () => {
  const filing = filingFixture({ holdings: manyHoldings() })
  await render(filing); await click(button('다음'))
  await select('closed'); assert.equal(names().length, 0)
  assert.match(container.textContent, /검색·필터와 일치하는 보유 종목이 없습니다/)
  await select('current'); assert.equal(names().length, 50)
  assert.match(container.querySelector('.holdings-pagination').textContent, /1–50/)
  await click(button('다음'))
  await render(filingFixture({ checkedAt: filing.checkedAt + 1 }))
  assert.equal(names().length, 3)
  assert.match(container.querySelector('.holdings-pagination').textContent, /1–3/)
  for (const label of ['비중', '보유 수량', '평가액', '수량 변화']) await click(checkbox(label))
  assert.equal(container.querySelectorAll('thead th').length, 1)
  await render(filingFixture({ holdings: [] }), 'empty')
  assert.equal(names().length, 0); assert.equal(button('CSV 저장 (0)').disabled, true)
  await click(checkbox('평가액')); await click(button('초기화'))
  assert.equal(container.querySelectorAll('thead th').length, 5)
  assert.match(container.querySelector('.holdings-pagination').textContent, /0–0 \/ 0개 · 1 \/ 1페이지/)
})
