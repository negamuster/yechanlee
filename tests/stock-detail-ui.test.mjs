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
let root, symbol, sequence = 0, now, calls, failFinancials, emptyFinancials, delayedChart, failDetails, failPrices, rateLimited, failNews, failRelated, extraData
const container = document.getElementById('root')
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const price = (date, c) => ({ t: Date.parse(date), c })
const bar = (date, c) => ({ ...price(date, c), o: c, h: c + 1, l: c - 1 })
const annual = () => ({ fiscal_period: 'FY', start_date: '2025-01-01', end_date: '2025-12-31', filing_date: '2026-02-01', accounting_standard: 'us-gaap', source_filing_url: 'https://www.sec.gov/Archives/edgar/data/1/000000000126000001/0000000001-26-000001-index.html', financials: {
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
  calls = []; failFinancials = false; emptyFinancials = false; delayedChart = null; failDetails = false; failPrices = false; rateLimited = false
  failNews = false; failRelated = false; extraData = false
  localStorage.clear(); sessionStorage.clear()
  globalThis.fetch = async raw => {
    calls.push(raw); const url = new URL(raw, 'https://anthracite.test'), ticker = url.searchParams.get('ticker')
    if (url.pathname === '/api/stock-chart') {
      const selected = url.searchParams.get('period')
      if (delayedChart && ticker === symbol && selected === '5Y') return delayedChart()
      return Response.json(chart(ticker, selected))
    }
    if (url.pathname === '/api/stock-financials') return failFinancials ? Response.json({}, { status: 503 }) : Response.json({ symbol: ticker, company: 'SEC Test Company', status: 'ok', results: emptyFinancials ? [] : [annual()], source: 'SEC EDGAR', fetchedAt: now, stale: false })
    const path = url.searchParams.get('path') || ''
    if (path.startsWith('/v3/reference/tickers/')) return failDetails ? Response.json({}, { status: rateLimited ? 429 : 503 }) : Response.json({ results: { ticker: path.split('/').at(-1), name: 'Test Company', currency_name: 'usd', market_cap: 1000000, primary_exchange: 'XNAS', list_date: '1999-01-22' } })
    if (path.includes('/range/')) return failPrices ? Response.json({}, { status: 503 }) : Response.json({ ticker: path.split('/')[4], results: [bar('2026-10-19T04:00Z', 100), bar('2026-10-20T04:00Z', 102)] })
    if (path.includes('/news?')) return failNews ? Response.json({}, { status: 503 }) : Response.json({ results: extraData ? [{ id: 'story', title: 'Confirmed company news', article_url: 'https://example.com/story', published_utc: '2026-10-20T12:00Z', publisher: { name: 'Test Publisher' } }] : [] })
    if (path.includes('/related-companies/')) return failRelated ? Response.json({}, { status: 503 }) : Response.json({ results: extraData ? [{ ticker: 'MSFT' }] : [] })
    return Response.json({ ticker: path.split('/')[4] || ticker, results: [] })
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

test('a failed company reference keeps confirmed prices, SEC financials and charts visible and can recover on refresh', async () => {
  failDetails = true; await render()
  assert.equal(container.querySelector('#stock-company-title').textContent, 'SEC Test Company')
  assert.equal(container.querySelector('.stock-current-price').textContent, '$102.00')
  assert.ok(container.querySelector('.stock-price-chart'))
  assert.equal(buttons().length, 8)
  assert.match(container.querySelector('#stock-financials').textContent, /연간 순이익.*-\$10.00/)
  assert.match(container.querySelector('.stock-hero').textContent, /기업명은 SEC EDGAR로 확인/)
  assert.match(container.querySelector('.stock-hero').textContent, /상세 기업 정보/)
  assert.equal(container.querySelector('.stock-state').textContent, '일부 자료 미확인')
  assert.equal(container.querySelector('.stock-empty'), null)
  failDetails = false
  await click([...container.querySelectorAll('.stock-hero .stock-actions button')].find(button => button.textContent === '새로고침'))
  assert.equal(container.querySelector('#stock-company-title').textContent, 'Test Company')
  assert.equal(container.querySelector('.stock-state').textContent, '조회 완료')
  assert.doesNotMatch(container.querySelector('.stock-hero').textContent, /기업명은 SEC EDGAR로 확인/)
})

test('when no fallback is confirmed, rate limits and missing prices explain the failed stage', async () => {
  failDetails = true; rateLimited = true; failFinancials = true; await render()
  assert.match(container.querySelector('.stock-empty').textContent, /일시적으로 제한/)
  assert.equal(calls.filter(raw => new URL(raw, 'https://anthracite.test').searchParams.get('path')?.startsWith('/v3/')).length, 1)
  failDetails = false; failFinancials = false; failPrices = true
  await click([...container.querySelectorAll('.stock-empty button')].find(button => button.textContent === '다시 조회'))
  assert.match(container.querySelector('.stock-empty').textContent, /기업 정보는 확인했지만 일별 시세/)
  assert.equal(container.querySelector('.stock-current-price'), null)
})

test('a partial refresh retains market cap, exchange, listing, stories and peers with their original timestamps', async () => {
  extraData = true; await render()
  const stamp = section => [...container.querySelectorAll(`${section} .stock-note`)].find(p => / 조회 /.test(p.textContent))?.textContent
  const sections = ['#stock-about', '#stock-news', '[aria-labelledby="stock-related-title"]']
  const original = sections.map(stamp)
  failDetails = true; failNews = true; failRelated = true; now += 60000
  await click([...container.querySelectorAll('.stock-hero .stock-actions button')].find(button => button.textContent === '새로고침'))
  assert.match(container.querySelector('#stock-financials').textContent, /\$1.00M.*이전 확인 기업정보 기준/)
  assert.match(container.querySelector('#stock-about').textContent, /XNAS.*1999-01-22/)
  assert.match(container.querySelector('#stock-news').textContent, /Confirmed company news/)
  assert.ok(container.querySelector('a[href="/stock/MSFT"]'))
  assert.deepEqual(sections.map(stamp), original)
  for (const selector of sections) assert.match(container.querySelector(selector).textContent, /이전에 확인한 자료/)
  failDetails = false; failNews = false; failRelated = false; extraData = false
  await click(container.querySelector('#stock-news button[aria-label="뉴스 누락 자료 다시 조회"]'))
  assert.equal(container.querySelector('.stock-state').textContent, '조회 완료')
  assert.doesNotMatch(container.querySelector('#stock-news').textContent, /Confirmed company news/)
  assert.equal(container.querySelector('a[href="/stock/MSFT"]'), null)
})

test('an initially partial view offers a retry beside missing fields and restores them after provider recovery', async () => {
  failDetails = true; failNews = true; failRelated = true; await render()
  assert.match(container.querySelector('#stock-financials').textContent, /기업정보 조회 실패/)
  assert.ok(container.querySelector('#stock-news button[aria-label="뉴스 누락 자료 다시 조회"]'))
  assert.ok(container.querySelector('button[aria-label="관련 종목 누락 자료 다시 조회"]'))
  failDetails = false; failNews = false; failRelated = false; extraData = true
  await click(container.querySelector('#stock-about button[aria-label="기업 정보 누락 자료 다시 조회"]'))
  assert.match(container.querySelector('#stock-financials').textContent, /\$1.00M/)
  assert.match(container.querySelector('#stock-about').textContent, /XNAS.*1999-01-22/)
  assert.match(container.querySelector('#stock-news').textContent, /Confirmed company news/)
  assert.equal(container.querySelector('.stock-state').textContent, '조회 완료')
})
