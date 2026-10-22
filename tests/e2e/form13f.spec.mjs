import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { filingFixture, manyHoldings } from '../fixtures/form13f.mjs'
import { installStockFixtures } from './stock-fixtures.mjs'

let state, a, b, failHistorical, requests
test.beforeEach(async ({ page }) => {
  state = await installStockFixtures(page); requests = []; failHistorical = false
  a = filingFixture({ holdings: manyHoldings(), closedHoldings: [{ name: 'PREVIOUS ONLY', cusip: '999999999', title: 'COM', shares: 0, prevShares: 25, value: 0 }] })
  b = filingFixture({ holdings: [a.holdings[0], { name: 'B ONLY', cusip: '888888888', title: 'COM', shares: 5, prevShares: 5, value: 100 }] })
  await page.route('**/api/form13f?*', async route => {
    const url = new URL(route.request().url()); requests.push(url.search)
    const data = url.searchParams.get('cik') === '0001067983' ? a : b
    const period = url.searchParams.get('period')
    if (period && failHistorical) return route.fulfill({ status: 503, json: { error: 'No verified filing' } })
    return route.fulfill({ json: period ? { ...data, period, previousPeriod: '2025-12-31', filedAt: '2026-05-15' } : data })
  })
})
test.afterEach(() => { if (state) expect(state.pageErrors).toEqual([]) })

test('all holdings paginate and CSV includes every filtered row rather than the visible page', async ({ page, isMobile }) => {
  await page.goto('/form13f')
  const table = page.locator('.portfolio-holdings')
  await expect(table.locator('tbody tr')).toHaveCount(50)
  await table.getByRole('button', { name: '다음', exact: true }).click()
  await expect(table.locator('tbody tr')).toHaveCount(17)
  await expect(table).toContainText('HOLDING 067')
  const downloading = page.waitForEvent('download')
  await table.getByRole('button', { name: 'CSV 저장 (67)', exact: true }).click()
  const download = await downloading, csv = await readFile(await download.path(), 'utf8')
  expect(download.suggestedFilename()).toContain('2026-06-30')
  expect(csv.trim().split('\r\n')).toHaveLength(68)
  expect(csv).toContain("'000000067"); expect(csv).toContain('HOLDING 001')
  await table.getByRole('searchbox', { name: '보유 종목 검색' }).fill('HOLDING 067')
  await expect(table.locator('tbody tr')).toHaveCount(1)
  await expect(table.locator('.holding-rank')).toHaveText('67')
  await table.getByRole('button', { name: '초기화', exact: true }).click()
  await table.getByLabel('분기 변동 필터').selectOption('closed')
  await expect(table.locator('tbody tr')).toHaveCount(1)
  await expect(table.locator('tbody')).toContainText('PREVIOUS ONLY')
  await expect(table.locator('tbody')).toContainText('전량 미기재')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const scroll = table.getByRole('region', { name: /기관 보유 종목 표/ })
  await scroll.evaluate(el => { el.scrollLeft = 150 })
  if (isMobile) expect(await scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
})

test('comparison separates common securities from exclusive positions with each institutions own denominator', async ({ page }) => {
  await page.goto('/form13f'); await page.getByRole('button', { name: '기관 비교', exact: true }).click()
  const comparison = page.locator('.institution-comparison')
  await expect(comparison.locator('.comparison-summary')).toContainText('공통 종목1개')
  await comparison.getByLabel('비교 범위', { exact: true }).selectOption('common')
  await expect(comparison.locator('tbody tr')).toHaveCount(1)
  const row = comparison.locator('tbody tr')
  await expect(row).toContainText((67 / a.totalValue * 100).toFixed(2) + '%')
  await expect(row).toContainText((67 / b.totalValue * 100).toFixed(2) + '%')
  await comparison.getByLabel('비교 범위', { exact: true }).selectOption('right')
  await expect(comparison.locator('tbody')).toContainText('B ONLY')
  await expect(comparison.locator('tbody')).toContainText('미기재')
  await comparison.getByLabel('공통 보고 분기').selectOption('2026-03-31')
  await expect(comparison.getByRole('table')).toContainText('B ONLY')
  expect(requests.filter(q => q.includes('period=2026-03-31'))).toHaveLength(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('different latest quarters load a common historical quarter and errors never become zero holdings', async ({ page }) => {
  b = { ...b, period: '2026-03-31', availablePeriods: ['2026-03-31'], previousPeriod: '2025-12-31' }
  failHistorical = true
  await page.goto('/form13f'); await page.getByRole('button', { name: '기관 비교', exact: true }).click()
  const comparison = page.locator('.institution-comparison')
  await expect(comparison.getByLabel('공통 보고 분기')).toHaveValue('2026-03-31')
  await expect(comparison.locator('.data-notice-error')).toBeVisible()
  await expect(comparison.getByRole('table')).toHaveCount(0)
  await expect(comparison.getByRole('button', { name: /비교 CSV 저장/ })).toHaveCount(0)
  failHistorical = false
  await comparison.getByRole('button', { name: '비교 자료 새로고침', exact: true }).click()
  await expect(comparison.getByRole('table')).toBeVisible()
  expect(requests.some(q => q.includes('cik=0001067983') && q.includes('period=2026-03-31'))).toBe(true)
})
