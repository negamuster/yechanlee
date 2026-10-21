import test, { beforeEach, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import './helpers/register-tsx.mjs'
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://anthracite.test/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'SVGElement', 'Node', 'MouseEvent', 'KeyboardEvent', 'Event', 'StorageEvent', 'localStorage', 'sessionStorage']) globalThis[key] = dom.window[key]
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
window.matchMedia = query => ({ matches: query.includes('prefers-reduced-motion'), media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
const { createElement: h, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, Routes, Route, useNavigate } = await import('react-router-dom')
const { default: Stock } = await import('../src/pages/06_Stock.tsx')
const { default: SavedItemsProvider } = await import('../src/components/SavedItemsProvider.tsx')
const originalFetch = globalThis.fetch, originalNow = Date.now
let root, symbol, sequence = 0, now, calls, failFinancials, emptyFinancials, delayedChart
const container = document.getElementById('root')
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const price = (date, c) => ({ t: Date.parse(date), c })
const bar = (date, c) => ({ ...price(date, c), o: c, h: c + 1, l: c - 1 })
const annual = () => ({ start_date: '2025-01-01', end_date: '2025-12-31', filing_date: '2026-02-01', accounting_standard: 'us-gaap', source_filing_url: 'https://www.sec.gov/Archives/edgar/data/1/000000000126000001/0000000001-26-000001-index.html', financials: {
  income_statement: { revenues: { value: 100, unit: 'USD' }, net_income_loss: { value: -10, unit: 'USD' }, diluted_earnings_per_share: { value: 0, unit: 'USD/shares' } }, balance_sheet: { equity: { value: 50, unit: 'USD' }, liabilities: { value: 20, unit: 'USD' } },
} })
function chart(ticker, period) {
  const points = period === '1D' ? [price('2026-10-20T13:30Z', 101), price('2026-10-20T13:35Z', 102)] : period === 'ALL' ? [price('1980-12-12T15:00Z', 1), price('2026-10-20T15:00Z', 102)] : [price('2026-10-19T15:00Z', 100), price('2026-10-20T15:00Z', 102)]
  return { symbol: ticker, period, points, currency: 'USD', interval: period === '1D' ? '5m' : period === '5D' ? '30m' : period === '5Y' || period === 'ALL' ? '1wk' : '1d', source: 'Yahoo Finance', fetchedAt: now, stale: false, baseline: { c: 100, label: '테스트 비교 기준' }, changePercent: 2 }
}
function SwitchStock() { const navigate = useNavigate(); return h('button', { id: 'switch-stock', onClick: () => navigate(`/stock/${symbol}NEXT`) }, '다른 종목') }
async function render() {
  root = createRoot(container)
  await act(async () => { root.render(h(MemoryRouter, { initialEntries: [`/stock/${symbol}`] }, h(SavedItemsProvider, null, h(SwitchStock), h(Routes, null, h(Route, { path: '/stock/:ticker', element: h(Stock) }))))); await tick() }); await act(tick)
}
async function click(element) { assert.ok(element); await act(async () => { element.click(); await tick() }); await act(tick) }
const buttons = () => [...container.querySelectorAll('.stock-periods button')]
const period = value => buttons().find(button => button.textContent === value)
beforeEach(() => {
  symbol = `TST${++sequence}`; now = Date.parse('2026-10-21T12:00:00Z'); Date.now = () => now
  calls = []; failFinancials = false; emptyFinancials = false; delayedChart = null
  localStorage.clear(); sessionStorage.clear()
  globalThis.fetch = async raw => {
    calls.push(raw); const url = new URL(raw, 'https://anthracite.test'), ticker = url.searchParams.get('ticker')
    if (url.pathname === '/api/stock-chart') {
      const selected = url.searchParams.get('period')
      if (delayedChart && ticker === symbol && selected === '5Y') return delayedChart()
      return Response.json(chart(ticker, selected))
    }
    if (url.pathname === '/api/stock-financials') return failFinancials ? Response.json({}, { status: 503 }) : Response.json({ symbol: ticker, results: emptyFinancials ? [] : [annual()], source: 'SEC EDGAR', fetchedAt: now, stale: false })
    const path = url.searchParams.get('path') || ''
    if (path.startsWith('/v3/reference/tickers/')) return Response.json({ results: { ticker: path.split('/').at(-1), name: 'Test Company', currency_name: 'usd' } })
    if (path.includes('/range/')) return Response.json({ results: [bar('2026-10-19T04:00Z', 100), bar('2026-10-20T04:00Z', 102)] })
    return Response.json({ results: [] })
  }
})
afterEach(async () => { await act(async () => { root?.unmount(); await tick() }); globalThis.fetch = originalFetch; Date.now = originalNow })
after(() => dom.window.close())

test('stock detail offers exactly eight live periods, labelled intraday/long-history prices and annual SEC filing sources', async () => {
  await render()
  assert.deepEqual(buttons().map(button => button.textContent), ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'ALL'])
  const financials = container.querySelector('#stock-financials')
  assert.match(financials.textContent, /SEC EDGAR.*US GAAP.*2025-01-01.*2025-12-31/)
  assert.ok(financials.querySelector('a[href^="https://www.sec.gov/Archives/"]'))
  assert.match(financials.textContent, /-\$10.00/)
  assert.equal(calls.some(url => url.includes('vX')), false)
  for (const value of ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'ALL']) {
    await click(period(value))
    assert.equal(buttons().filter(button => button.getAttribute('aria-pressed') === 'true').length, 1)
    assert.equal(period(value).getAttribute('aria-pressed'), 'true')
    assert.ok(container.querySelector('.stock-price-chart'))
  }
  assert.match(container.querySelector('.stock-chart-x-labels').textContent, /1980/)
  assert.match(container.querySelector('.stock-chart-source').textContent, /조회 가능 전체 범위/)
  await click(period('1D'))
  const readout = container.querySelector('.stock-chart-readout')
  assert.match(readout.textContent, /09:35.*ET.*5분봉/)
  await act(async () => { container.querySelector('.stock-chart-frame').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); await tick() })
  assert.match(readout.textContent, /09:30/)
})
test('changing period hides the old series immediately and a late series cannot overwrite another stock', async () => {
  await render()
  let finish
  delayedChart = () => new Promise(resolve => { finish = resolve })
  await click(period('5Y'))
  assert.equal(container.querySelector('.stock-price-chart'), null)
  assert.ok(container.querySelector('#stock-chart .data-skeleton'))
  await click(container.querySelector('#switch-stock'))
  assert.equal(container.querySelector('.stock-symbol').textContent, `${symbol}NEXT`)
  const markup = container.querySelector('.stock-price-chart').outerHTML
  await act(async () => { finish(Response.json(chart(symbol, '5Y'))); await tick() })
  assert.equal(container.querySelector('.stock-symbol').textContent, `${symbol}NEXT`)
  assert.equal(container.querySelector('.stock-price-chart').outerHTML, markup)
})
test('a later financial fetch failure retains the confirmed annual data and original SEC collection timestamp', async () => {
  await render()
  const stamp = () => [...container.querySelectorAll('#stock-financials p')].find(p => p.textContent.startsWith('SEC 공시 조회')).textContent
  const original = stamp()
  failFinancials = true; now += 60000
  await click([...container.querySelectorAll('.stock-hero .stock-actions button')].find(button => button.textContent === '새로고침'))
  assert.match(container.querySelector('#stock-financials').textContent, /SEC 재조회에 실패해 이전에 확인한/)
  assert.match(container.querySelector('#stock-financials').textContent, /-\$10.00/)
  assert.equal(stamp(), original)
  assert.ok(container.querySelector('.stock-price-chart'))
})
test('no standard annual filings is a separate empty state that does not mark the price/news view as failed', async () => {
  emptyFinancials = true; await render()
  assert.match(container.querySelector('#stock-financials').textContent, /확인 가능한 표준 연간 재무 자료가 없습니다/)
  assert.equal(container.querySelector('.stock-state').textContent, '조회 완료')
  assert.ok(container.querySelector('.stock-price-chart'))
})
