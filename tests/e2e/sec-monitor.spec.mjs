import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { installStockFixtures, FIXED_AT } from './stock-fixtures.mjs'
const snapshot = JSON.parse(readFileSync(new URL('../fixtures/sec-monitor.json', import.meta.url)))
async function install(page) {
  await installStockFixtures(page)
  const state = { data: structuredClone(snapshot), fail: false, requests: 0 }
  await page.route('**/data/sec-filings.json', route => { state.requests++; return state.fail ? route.fulfill({ status: 503, json: { error: 'Fixture failure' } }) : route.fulfill({ json: state.data }) })
  return state
}
test('monitor exposes original SEC dates, amendment identity, exact source links and bounded filters on both layouts', async ({ page }) => {
  await install(page)
  await page.goto('/filings')
  const monitor = page.getByRole('region', { name: 'SEC 공시 목록', exact: true })
  await expect(monitor.locator('.filing-list li')).toHaveCount(3)
  const amended = monitor.locator('.filing-list li').first()
  await expect(amended).toContainText('10-Q/A'); await expect(amended).toContainText('정정 공시')
  await expect(amended).toContainText('제출일 2026-10-20 · 보고 기준일 2026-09-30')
  await expect(amended.locator('.filing-primary')).toHaveAttribute('href', snapshot.companies[0].filings[0].url)
  await monitor.getByLabel('공시 유형', { exact: true }).selectOption('10-Q')
  await expect(monitor.locator('.filing-list li')).toHaveCount(2)
  await monitor.getByRole('searchbox', { name: '기업 검색' }).fill('NVDA')
  await expect(monitor).toContainText('확인된 수집 범위에서 선택 조건에 맞는 공시가 없습니다.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
test('watchlist filtering is local and unsupported symbols are not reported as companies with no filings', async ({ page }) => {
  const state = await install(page)
  await page.addInitScript(() => localStorage.setItem('anthracite:saved:v3', JSON.stringify({ version: 1, stocks: [{ ticker: 'AAPL', name: 'Apple' }, { ticker: 'ZZZ', name: 'Unknown' }], articles: [] })))
  await page.goto('/filings')
  await expect(page.locator('.filing-list li')).toHaveCount(3)
  const before = await page.evaluate(() => localStorage.getItem('anthracite:saved:v3'))
  await page.getByLabel('관심 종목만', { exact: true }).check()
  await expect(page.getByText('수집 대상 밖 관심 종목:', { exact: false })).toContainText('ZZZ')
  await expect(page.locator('.filing-source')).toHaveCount(1)
  expect(state.requests).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('anthracite:saved:v3'))).toBe(before)
})
test('failed refresh retains filing identities and original receipt, then confirmed empty clears them', async ({ page }) => {
  const state = await install(page)
  await page.goto('/filings')
  await expect(page.locator('.filing-list li')).toHaveCount(3)
  const receipt = page.locator('.filing-source time').first()
  await expect(receipt).toHaveAttribute('datetime', snapshot.companies[0].fetchedAt)
  state.fail = true
  await page.getByRole('button', { name: '공시 목록 새로고침', exact: true }).click()
  await expect(page.getByText('갱신 실패 · 이전 데이터 표시 중', { exact: true })).toBeVisible()
  await expect(page.locator('.filing-list li')).toHaveCount(3)
  await expect(receipt).toHaveAttribute('datetime', snapshot.companies[0].fetchedAt)
  state.fail = false; state.data.companies[0].filings = []
  await page.getByRole('button', { name: '공시 목록 새로고침', exact: true }).click()
  await expect(page.locator('.filing-list li')).toHaveCount(0)
  await expect(page.getByText('확인된 수집 범위에서 선택 조건에 맞는 공시가 없습니다.', { exact: true })).toBeVisible()
})
test('collector outage, six-hour delay and uncovered stock remain explicit without blocking stock charts', async ({ page }) => {
  const state = await install(page)
  state.data.companies[0].status = 'stale'
  state.data.companies[1] = { ...state.data.companies[1], status: 'unavailable', fetchedAt: null, coverageFrom: null, coverageTo: null }
  await page.goto('/stock/AAPL')
  await expect(page.getByRole('region', { name: 'AAPL SEC 공시', exact: true })).toContainText('갱신 실패 · 이전 수집본')
  await expect(page.locator('#stock-chart')).toContainText('주가 차트')
  await page.goto('/stock/SATL')
  await expect(page.getByRole('region', { name: 'SATL SEC 공시', exact: true })).toContainText('현재 수집 대상에 포함되지 않습니다.')
  await page.goto('/filings')
  await expect(page.locator('.filing-source').nth(1)).toContainText('수집 실패 · 확인된 자료 없음')
  state.data.companies[0].status = 'ok'
  await page.clock.setFixedTime(new Date(FIXED_AT + 7 * 3600000))
  await page.getByRole('button', { name: '공시 목록 새로고침', exact: true }).click()
  // The clock updates age labels without changing provider receipt times.
  await page.reload()
  await expect(page.locator('.filing-source').first()).toContainText('수집 지연 · 이전 수집본')
})
test('flat navigation preserves requested order and fits desktop, tablet and mobile', async ({ page }) => {
  await install(page)
  await page.goto('/filings')
  for (const width of [1280, 1000, 790]) {
    await page.setViewportSize({ width, height: 900 })
    if (width <= 860) await page.getByRole('button', { name: '메뉴 열기', exact: true }).click()
    const links = page.getByRole('navigation', { name: '주요 메뉴', exact: true }).getByRole('link')
    expect((await links.allTextContents()).slice(5)).toEqual(['글로벌 매크로', '경제·실적 캘린더', 'SEC 공시 모니터', '기관 포트폴리오 · 13F', '자산 시뮬레이터', '저장한 항목'])
    await expect(links.filter({ hasText: 'SEC 공시 모니터' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 900 })
  const mobile = page.getByRole('navigation', { name: '모바일 주요 메뉴', exact: true })
  await expect(mobile.getByRole('link', { name: '캘린더', exact: true })).toHaveAttribute('href', '/calendar')
  await mobile.getByRole('link', { name: '더보기', exact: true }).click()
  for (const label of ['SEC 공시 모니터', '기관 포트폴리오 · 13F', '자산 시뮬레이터']) {
    await expect(page.getByRole('main').getByRole('link', { name: label, exact: true })).toBeVisible()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('index filters and share-class search use a single issuer at full universe scale', async ({ page }) => {
  const state = await install(page)
  const config = JSON.parse(readFileSync(new URL('../../config/sec-monitor.json', import.meta.url)))
  state.data.universe = { ...config.universe, checkedAt: state.data.attemptedAt }
  state.data.companies = config.companies.map(c => ({ ...snapshot.companies[1], ...c, filings: [] }))
  await page.goto('/filings')
  await expect(page.getByText('선택 대상 516개 기업', { exact: false })).toBeVisible()
  await page.getByLabel('지수', { exact: true }).selectOption('nasdaq100')
  await expect(page.getByText('선택 대상 100개 기업', { exact: false })).toBeVisible()
  await page.getByRole('searchbox', { name: '기업 검색' }).fill('GOOG')
  await expect(page.locator('.filing-source')).toHaveCount(1)
  await expect(page.locator('.filing-source')).toContainText('GOOG / GOOGL')
  await page.getByRole('searchbox', { name: '기업 검색' }).fill('')
  await page.getByLabel('지수', { exact: true }).selectOption('sp500')
  await expect(page.getByText('선택 대상 500개 기업', { exact: false })).toBeVisible()
  await page.getByLabel('지수', { exact: true }).selectOption('additional')
  await expect(page.locator('.filing-source')).toHaveCount(1)
  await expect(page.locator('.filing-source')).toContainText('SATL')
})

test('short new-CIK history exposes exact coverage and excluded predecessor filings', async ({ page }) => {
  const state = await install(page)
  state.data.companies[0].coverageFrom = '2026-07-01'
  await page.goto('/filings')
  await expect(page.locator('.filing-source').first()).toContainText('2026-07-01 ~ 2026-10-21')
  await expect(page.locator('.filing-source').first()).toContainText('이전 CIK 공시 미포함')
})
