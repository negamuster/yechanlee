import { test, expect } from '@playwright/test'
import { installStockFixtures } from './stock-fixtures.mjs'
import { economicFixture } from '../fixtures/economic-indicators.mjs'
let state, payload, fail
const dashboard = page => page.getByRole('region', { name: '주요 경제지표' })
test.beforeEach(async ({ page }) => {
  state = await installStockFixtures(page); payload = economicFixture(); fail = false
  await page.route('**/api/economic-indicators', route => fail ? route.fulfill({ status: 503, json: { error: 'Simulated outage' } }) : route.fulfill({ json: payload }))
})
test.afterEach(() => { if (state) expect(state.pageErrors).toEqual([]) })
test('dashboard shows actual observation periods, source basis and accessible charts for all indicators', async ({ page }) => {
  await page.goto('/indicators')
  const ui = dashboard(page), cards = ui.getByRole('group', { name: '경제지표 선택' })
  await expect(cards.getByRole('button', { name: /CPI 전년동월비/ })).toContainText('4.00%')
  await expect(cards.getByRole('button', { name: /실업률/ })).toContainText('+0.10%p')
  await expect(ui.getByRole('img', { name: /CPI 전년동월비/ })).toBeVisible()
  await expect(ui.locator('.economic-chart svg')).toBeVisible()
  await expect(ui.locator('.economic-source')).toContainText('CUUR0000SA0')
  await ui.getByRole('button', { name: '1Y', exact: true }).click()
  await ui.getByText('조회 표 · 12개 관측 기간', { exact: true }).click()
  await expect(ui.getByRole('table')).toContainText('Sep 2026')
  await expect(ui.getByRole('table')).toContainText('104.000')
  await ui.getByRole('button', { name: '5Y', exact: true }).click()
  await expect(ui.getByText('조회 표 · 60개 관측 기간', { exact: true })).toBeVisible()
  await cards.getByRole('button', { name: /실업률/ }).click()
  await expect(ui.locator('.economic-description')).toContainText('U-3')
  await expect(ui.locator('.economic-chart-heading')).toContainText('계절조정')
  await cards.getByRole('button', { name: /연방기금 실효금리/ }).click()
  await expect(ui.getByRole('img', { name: /연방기금 실효금리/ })).toBeVisible()
  await expect(ui.locator('.economic-latest')).toContainText('Oct 19, 2026')
  await expect(ui.locator('.economic-source')).toContainText('Federal Reserve Bank of New York')
  await expect(page.getByRole('heading', { name: '어떻게 읽을까요?' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('partial outage preserves collection time and gaps do not become zero or an older latest observation', async ({ page }) => {
  payload.series[0].observations = payload.series[0].observations.filter(p => p.date !== '2025-09-01')
  payload.series[0].error = 'unavailable'; payload.series[0].collectedAt = '2026-10-19T12:00:00Z'
  await page.goto('/indicators')
  const ui = dashboard(page), cpi = ui.getByRole('button', { name: /CPI 전년동월비/ })
  await expect(cpi).toContainText('미제공'); await expect(cpi).toContainText('비교 불가'); await expect(cpi).toContainText('Sep 2026')
  await expect(ui.locator('.economic-warning')).toContainText('갱신 지연')
  await expect(ui.locator('.economic-source time')).toHaveAttribute('datetime', '2026-10-19T12:00:00Z')
  await ui.getByRole('button', { name: /실업률/ }).click(); await expect(ui.locator('.economic-latest')).toContainText('4.20%')
})
test('initial outage retries and failed refresh retains previous data with its source collection timestamp', async ({ page }) => {
  fail = true; await page.goto('/indicators')
  const ui = dashboard(page)
  await expect(ui.getByText('경제지표 조회에 실패했습니다.', { exact: true })).toBeVisible()
  fail = false; await ui.getByRole('button', { name: '경제지표 조회에 실패했습니다. 다시 시도' }).click()
  await expect(ui.locator('.economic-cards')).toBeVisible()
  fail = true; await ui.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(ui.getByText('갱신 실패 · 이전 데이터 표시 중', { exact: true })).toBeVisible()
  await expect(ui.locator('.economic-cards')).toContainText('4.00%')
  await expect(ui.locator('.economic-source time')).toHaveAttribute('datetime', '2026-10-21T12:00:00.000Z')
})

test('expired cached data is hidden from charts after time advances and refresh fails', async ({ page }) => {
  await page.goto('/indicators')
  const ui = dashboard(page)
  await expect(ui.getByRole('img', { name: /CPI 전년동월비/ })).toBeVisible()
  await page.clock.setFixedTime(new Date('2026-11-22T12:00:00Z'))
  fail = true
  await ui.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(ui.locator('.economic-empty')).toHaveText('표시할 관측치가 없습니다.')
  await expect(ui.getByRole('img')).toHaveCount(0)
})

test('verified FRED fallback shows both source identities and its receipt without inventing a BLS success', async ({ page }) => {
  payload.series[0] = { ...payload.series[0], retrievedVia: 'fred', primaryFailureReason: 'http_503', fallbackFailureReason: null, failureReason: null }
  payload.series[0].observations.at(-1).priorNote = { text: '보존한 BLS 각주', value: 103, collectedAt: '2026-10-20T12:00:00.000Z' }
  await page.goto('/indicators')
  const ui = dashboard(page), cpi = ui.getByRole('button', { name: /CPI 전년동월비/ })
  await expect(cpi).toContainText('FRED 경유')
  await expect(cpi).toContainText('4.00%')
  await expect(cpi).not.toContainText('갱신 지연')
  await expect(ui.locator('.economic-fallback-note')).toContainText('FRED에서 수집한 BLS 통계')
  await expect(ui.locator('.economic-source')).toContainText('CUUR0000SA0')
  await expect(ui.locator('.economic-source')).toContainText('CPIAUCNS')
  await expect(ui.locator('.economic-source a').filter({ hasText: 'FRED (BLS 통계)' })).toHaveAttribute('href', 'https://fred.stlouisfed.org/series/CPIAUCNS')
  await expect(ui.locator('.economic-source time')).toHaveAttribute('datetime', '2026-10-21T12:00:00.000Z')
  await ui.getByRole('button', { name: '5Y', exact: true }).click()
  await expect(ui.getByText('조회 표 · 60개 관측 기간', { exact: true })).toBeVisible()
  await ui.getByText('조회 표 · 60개 관측 기간', { exact: true }).click()
  await expect(ui.getByRole('table')).toContainText('보존한 BLS 각주')
  await expect(ui.getByRole('table')).toContainText('당시 원자료 값 103')
  await ui.getByRole('button', { name: /실업률/ }).click()
  await expect(ui.locator('.economic-fallback-note')).toHaveCount(0)
  await expect(ui.locator('.economic-source')).toContainText('LNS14000000')
  await expect(ui.getByRole('button', { name: /실업률/ })).toContainText('수집 정상')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('both routes failing retain the last FRED receipt with a stale label; BLS recovery removes the fallback route', async ({ page }) => {
  payload.series[1] = { ...payload.series[1], retrievedVia: 'fred', primaryFailureReason: 'http_503', failureReason: null }
  await page.goto('/indicators')
  const ui = dashboard(page)
  await ui.getByRole('button', { name: /실업률/ }).click()
  await expect(ui.getByRole('button', { name: /실업률/ })).toContainText('FRED 경유')
  payload.series[1] = { ...payload.series[1], error: 'unavailable', attemptedAt: '2026-10-21T12:00:30.000Z', failureReason: 'http_403', fallbackFailureReason: 'http_403' }
  await ui.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(ui.getByRole('button', { name: /실업률/ })).toContainText('갱신 지연')
  await expect(ui.locator('.economic-source time')).toHaveAttribute('datetime', '2026-10-21T12:00:00.000Z')
  await expect(ui.locator('.economic-source a').filter({ hasText: 'FRED (BLS 통계)' })).toHaveAttribute('href', 'https://fred.stlouisfed.org/series/UNRATE')
  await expect(ui.locator('.economic-latest')).toContainText('4.20%')
  payload.series[1] = { ...payload.series[1], error: null, retrievedVia: 'bls', failureReason: null, primaryFailureReason: null, fallbackFailureReason: null }
  await ui.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(ui.getByRole('button', { name: /실업률/ })).toContainText('수집 정상')
  await expect(ui.locator('.economic-fallback-note')).toHaveCount(0)
  await expect(ui.locator('.economic-source a').filter({ hasText: 'BLS API' })).toHaveAttribute('href', 'https://www.bls.gov/cps/')
})
