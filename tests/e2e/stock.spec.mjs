import { test, expect } from '@playwright/test'
import { FIXED_AT, installStockFixtures } from './stock-fixtures.mjs'

let state
test.beforeEach(async ({ page }) => { state = await installStockFixtures(page) })
test.afterEach(() => { state.release?.(); expect(state.pageErrors).toEqual([]) })
async function search(page, query, symbol) {
  await page.getByRole('button', { name: '통합 검색·빠른 이동', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '통합 검색·빠른 이동' })
  await dialog.getByRole('combobox').fill(query)
  await expect(dialog.getByRole('option').filter({ hasText: symbol })).toBeVisible()
  await dialog.getByRole('combobox').press('Enter')
  await expect(page).toHaveURL(new RegExp(`/stock/${symbol}$`))
  await expect(page.locator('.stock-symbol')).toHaveText(symbol)
}
const refresh = page => page.locator('.stock-hero').getByRole('button', { name: '새로고침', exact: true }).click()

test('company search opens the verified stock and all eight chart periods work with English dates', async ({ page }) => {
  await page.goto('/stock/AAPL')
  await expect(page.locator('.stock-current-price')).toHaveText('$102.00')
  await search(page, '엔비디아', 'NVDA')
  await expect(page.locator('#stock-company-title')).toHaveText('NVIDIA Corporation')
  for (const period of ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'ALL']) {
    const button = page.locator('.stock-periods').getByRole('button', { name: period, exact: true })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.stock-price-chart')).toBeVisible()
    await expect(page.locator('.stock-chart-readout time')).toContainText('Oct 20, 2026')
  }
  await expect(page.locator('.stock-chart-x-labels')).toContainText('Dec 12, 1980')
  const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }))
  expect(width.content).toBeLessThanOrEqual(width.viewport)
})

test('an initial reference/news outage keeps SEC financials and prices visible, then in-section retry recovers fields', async ({ page }) => {
  state.failReference = true; state.failOptional = true
  await page.goto('/stock/NVDA')
  await expect(page.locator('.stock-state')).toHaveText('일부 자료 미확인')
  await expect(page.locator('.stock-current-price')).toHaveText('$204.00')
  await expect(page.locator('#stock-financials')).toContainText('-$10.00')
  await expect(page.locator('.stock-price-chart')).toBeVisible()
  state.failReference = false; state.failOptional = false
  await page.locator('#stock-about').getByRole('button', { name: '기업 정보 누락 자료 다시 조회' }).click()
  await expect(page.locator('.stock-state')).toHaveText('조회 완료')
  await expect(page.locator('#stock-financials')).toContainText('$5.00T')
  await expect(page.locator('#stock-about')).toContainText('XNAS')
  await expect(page.locator('#stock-news')).toContainText('NVDA fixture earnings report')
})

test('partial refresh retains confirmed values and receipt times, and a successful empty result clears old lists', async ({ page }) => {
  await page.goto('/stock/NVDA')
  await expect(page.locator('.stock-state')).toHaveText('조회 완료')
  const originalStamp = await page.locator('#stock-about .stock-note').filter({ hasText: '기업 정보 조회' }).textContent()
  await page.clock.setFixedTime(new Date(FIXED_AT + 60000))
  state.failReference = true; state.failOptional = true
  await refresh(page)
  await expect(page.locator('.stock-state')).toHaveText('일부 자료 미확인')
  await expect(page.locator('#stock-financials')).toContainText('$5.00T')
  await expect(page.locator('#stock-about')).toContainText(originalStamp)
  await expect(page.locator('#stock-news')).toContainText('NVDA fixture earnings report')
  await expect(page.locator('#stock-news')).toContainText('이전에 확인한 자료')
  state.failReference = false; state.failOptional = false; state.emptyLists = true
  await page.locator('#stock-news').getByRole('button', { name: '뉴스 누락 자료 다시 조회' }).click()
  await expect(page.locator('.stock-state')).toHaveText('조회 완료')
  await expect(page.locator('#stock-news')).not.toContainText('NVDA fixture earnings report')
  await expect(page.locator('.stock-related-links')).toHaveCount(0)
})

test('a mismatched company identity cannot use SEC fallback or show another company price', async ({ page }) => {
  state.mismatchReference = true
  await page.goto('/stock/NVDA')
  await expect(page.locator('.stock-empty')).toContainText('티커가 일치하지')
  await expect(page.locator('.stock-current-price')).toHaveCount(0)
  state.mismatchReference = false
  await page.getByRole('button', { name: '다시 조회', exact: true }).click()
  await expect(page.locator('.stock-current-price')).toHaveText('$204.00')
})

test('a late chart response cannot replace the newly selected stock', async ({ page }) => {
  await page.goto('/stock/NVDA')
  await expect(page.locator('.stock-state')).toHaveText('조회 완료')
  state.delay = { symbol: 'NVDA', period: '5Y' }
  await page.locator('.stock-periods').getByRole('button', { name: '5Y', exact: true }).click()
  await expect.poll(() => state.delayed).toBe(1)
  await expect(page.locator('.stock-price-chart')).toHaveCount(0)
  await search(page, 'AAPL', 'AAPL')
  await expect(page.locator('.stock-chart-readout')).toContainText('$102.00')
  const delayedResponse = page.waitForResponse(response => response.url().includes('ticker=NVDA&period=5Y'))
  state.release(); await delayedResponse
  await expect(page.locator('.stock-symbol')).toHaveText('AAPL')
  await expect(page.locator('.stock-chart-readout')).toContainText('$102.00')
})
