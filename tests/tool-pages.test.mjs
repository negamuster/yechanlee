import test, { after, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import './helpers/register-tsx.mjs'

// DOM interactions validate data and controls; sticky layout still needs browser QA.
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://anthracite.test/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MouseEvent', 'Event']) globalThis[key] = dom.window[key]
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { createElement: h, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { default: Form13F } = await import('../src/pages/Form13F.tsx')
const { default: Simulator } = await import('../src/pages/Simulator.tsx')
const { projectAssets } = await import('../src/lib/financialMath.ts')
const { invalidateResource } = await import('../src/utils/resourceCache.ts')
const originalFetch = globalThis.fetch
const container = document.getElementById('root')
let root
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
async function render(component) { await act(async () => { root.render(h(component)); await tick() }); await act(tick) }
async function click(element) { assert.ok(element); await act(async () => { element.click(); await tick() }) }
async function edit(input, value) {
  assert.ok(input)
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
    await tick()
  })
}
const filing = overrides => ({ verification: 'matched', period: '2026-06-30', filedAt: '2026-08-14', checkedAt: Date.parse('2026-10-21T00:00:00Z'), totalValue: 1000, holdingCount: 40,
  holdings: [
    { name: 'ALPHA INC', cusip: '001', title: 'COM', shares: 30, prevShares: 20, value: 300 },
    { name: 'BETA INC', cusip: '002', title: 'CL A', shares: 100, prevShares: 200, value: 200 },
    { name: 'NEW INC', cusip: '003', title: 'COM', shares: 50, prevShares: 0, value: 100 },
  ], ...overrides })
const rowNames = () => [...container.querySelectorAll('.holdings-table tbody .holding-name strong')].map(element => element.textContent)
beforeEach(() => { for (const cik of ['0001067983', '0002012383']) invalidateResource(`/api/form13f?cik=${cik}`); root = createRoot(container); globalThis.fetch = async () => Response.json(filing()) })
afterEach(async () => { await act(async () => root.unmount()); globalThis.fetch = originalFetch })
after(() => dom.window.close())

test('13F header sorting, multi-field search and reset preserve the chart and original portfolio weights', async () => {
  await render(Form13F)
  assert.equal(container.querySelector('.tool-page-header h1').textContent, '기관 포트폴리오 · 13F')
  const chart = container.querySelector('.portfolio-donut').textContent
  await click(container.querySelector('[aria-sort="descending"] button'))
  assert.deepEqual(rowNames(), ['NEW INC', 'BETA INC', 'ALPHA INC'])
  assert.equal(container.querySelector('[aria-sort="ascending"]').textContent.trim(), '평가액↑')
  await edit(container.querySelector('input[type=search]'), 'beta cl a')
  assert.deepEqual(rowNames(), ['BETA INC'])
  const row = container.querySelector('.holdings-table tbody tr')
  assert.equal(row.querySelector('.holding-rank').textContent, '2')
  assert.equal(row.querySelector('td').textContent, '20%')
  assert.equal(container.querySelector('.portfolio-donut').textContent, chart)
  await edit(container.querySelector('input[type=search]'), 'no such holding')
  assert.equal(rowNames().length, 0)
  await click(container.querySelector('.tool-empty button'))
  assert.deepEqual(rowNames(), ['ALPHA INC', 'BETA INC', 'NEW INC'])
  assert.equal(container.querySelector('input[type=search]').value, '')
})

test('refresh failure keeps the last verified filing, dates and the current search visible', async () => {
  let completeRefresh
  await render(Form13F)
  await edit(container.querySelector('input[type=search]'), 'beta')
  globalThis.fetch = () => new Promise(resolve => { completeRefresh = resolve })
  await click(container.querySelector('[data-widget-action=refresh]'))
  assert.deepEqual(rowNames(), ['BETA INC'])
  assert.match(container.textContent, /업데이트 중/)
  await act(async () => { completeRefresh(Response.json({ error: 'unavailable' }, { status: 503 })); await tick() })
  assert.deepEqual(rowNames(), ['BETA INC'])
  assert.match(container.textContent, /마지막 검증 자료/)
  assert.match(container.querySelector('.portfolio-summary').textContent, /2026-06-30.*2026-08-14/)
  assert.ok(container.querySelector('.data-retry'))
})

test('late responses cannot replace another institution and switching institutions clears table controls', async () => {
  let finishFirst
  globalThis.fetch = () => new Promise(resolve => { finishFirst = resolve })
  await render(Form13F)
  assert.ok(container.querySelector('.data-skeleton'))
  globalThis.fetch = async () => Response.json(filing({ holdings: [{ name: 'BLACKROCK HOLDING', cusip: '099', title: 'COM', shares: 1, value: 1 }] }))
  await click(container.querySelectorAll('.portfolio-manager')[1])
  assert.deepEqual(rowNames(), ['BLACKROCK HOLDING'])
  await act(async () => { finishFirst(Response.json(filing())); await tick() })
  assert.deepEqual(rowNames(), ['BLACKROCK HOLDING'])
  await edit(container.querySelector('input[type=search]'), 'not found')
  await click(container.querySelectorAll('.portfolio-manager')[0])
  assert.equal(container.querySelector('input[type=search]').value, '')
  assert.equal(container.querySelector('[aria-sort=descending]').textContent.trim(), '평가액↓')
})

test('unverified data is rejected, while a verified empty filing is a valid result', async () => {
  globalThis.fetch = async () => Response.json(filing({ verification: 'mismatch' }))
  await render(Form13F)
  assert.ok(container.querySelector('.data-notice-error'))
  assert.equal(container.querySelector('.portfolio-donut'), null)
  globalThis.fetch = async () => Response.json(filing({ holdings: [], totalValue: 0 }))
  await click(container.querySelector('.data-retry'))
  assert.equal(container.querySelector('.data-notice-error'), null)
  assert.match(container.textContent, /표시할 주식 보유 종목이 없습니다/)
})

test('simulator inputs still produce the same complete projection after the shared card redesign', async () => {
  await render(Simulator)
  const input = label => [...container.querySelectorAll('.tool-field')].find(field => field.querySelector('span').textContent === label)?.querySelector('input')
  for (const [label, value] of [['현재 나이', '30'], ['은퇴 나이', '60'], ['은행 저축 · 예금 (원)', '100000000'], ['예금 연 수익률 (%)', '3.5'], ['연간 평균 소비 (원)', '24000000'], ['연 수입 (원)', '40000000'], ['주택담보대출 (원)', '20000000'], ['주택담보대출 연 이자율 (%)', '4'], ['주택담보대출 연 원금 상환액 (원)', '1000000']]) await edit(input(label), value)
  const expected = projectAssets({ age: 30, retireAge: 60, assets: [{ balance: 1e8, rate: 3.5 }, { balance: 0, rate: 0 }, { balance: 0, rate: 0 }], debts: [{ balance: 2e7, rate: 4, annualPrincipal: 1e6 }, { balance: 0, rate: 0, annualPrincipal: 0 }], income: 4e7, expense: 24e6, incomeGrowth: 0, expenseGrowth: 0 })
  const rows = [...container.querySelectorAll('.sim-table tbody tr')]
  assert.equal(rows.length, expected.length)
  for (let index = 0; index < rows.length; index++) {
    const cells = [...rows[index].querySelectorAll('th,td')].map(cell => cell.textContent)
    assert.deepEqual(cells, [`${expected[index].age}세`, ...[expected[index].grossAssets, expected[index].debt, expected[index].fundingGap, expected[index].asset].map(value => Math.round(value).toLocaleString('ko-KR'))])
  }
  assert.match(container.querySelector('.sim-result-value').textContent, /14,200,000/)
  assert.ok(container.querySelector('svg[role=img]'))
  assert.equal(input('은행 저축 · 예금 (원)').value, '100,000,000')
  await edit(input('현재 나이'), '30.5')
  assert.ok(container.querySelector('[role=alert]'))
  assert.equal(container.querySelector('.sim-table'), null)
})
