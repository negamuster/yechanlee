import { test, expect } from '@playwright/test'
import { installStockFixtures } from './stock-fixtures.mjs'

async function setup(page) {
  const state = await installStockFixtures(page)
  const searches = []
  await page.route(/\/api\/stock-data\?search=/, route => { searches.push(route.request().url()); return route.fulfill({ status: 503, json: { error: 'Fixture search failure' } }) })
  await page.goto('/stock/AAPL')
  await expect(page.locator('.stock-current-price')).toHaveText('$102.00')
  return { state, searches }
}
const trigger = page => page.getByRole('button', { name: '통합 검색·빠른 이동', exact: true })
const menu = page => page.getByRole('dialog', { name: '통합 검색·빠른 이동', exact: true })

test('catalog typo fallback, highlight, focus restoration and IME-safe Enter work on both layouts', async ({ page }) => {
  const { state } = await setup(page)
  await trigger(page).click()
  const dialog = menu(page), input = dialog.getByRole('combobox')
  await expect(input).toBeFocused()
  const firstId = await input.getAttribute('aria-activedescendant')
  await input.press('ArrowDown')
  expect(await input.getAttribute('aria-activedescendant')).not.toBe(firstId)
  await input.press('Escape')
  await expect(dialog).not.toBeVisible(); await expect(trigger(page)).toBeFocused()
  await page.keyboard.press('Control+k')
  await expect(menu(page)).toBeVisible()
  await menu(page).getByRole('button', { name: '종목', exact: true }).click()
  await input.fill('nvida')
  const match = dialog.getByRole('option').and(dialog.locator('a[href="/stock/NVDA"]'))
  await expect(match).toBeVisible(); await expect(match.locator('mark').first()).toBeVisible()
  await expect(dialog.getByText('외부 종목 검색에 실패했습니다.', { exact: false })).toBeVisible()
  await expect(dialog.locator('.command-direct-stock')).toHaveCount(0)
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  await expect(page).toHaveURL(/\/stock\/AAPL$/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await input.press('Enter')
  await expect(page).toHaveURL(/\/stock\/NVDA$/)
  await expect(page.locator('#stock-company-title')).toHaveText('NVIDIA Corporation')
  expect(state.pageErrors).toEqual([])
})
test('exact share-class ranking and escaped saved-title highlighting preserve private local records', async ({ page }) => {
  const title = 'NVIDIA <img src=x onerror=alert(1)> earnings'
  await page.addInitScript(({ title }) => localStorage.setItem('anthracite:saved:v3', JSON.stringify({ version: 1, stocks: [], articles: [{ title, article_url: 'https://example.com/private-fuse', publisher: 'Private', published_utc: '2026-10-20T12:00:00Z' }] })), { title })
  const { searches, state } = await setup(page)
  const before = await page.evaluate(() => localStorage.getItem('anthracite:saved:v3'))
  await trigger(page).click()
  const dialog = menu(page), input = dialog.getByRole('combobox')
  for (const ticker of ['GOOG', 'GOOGL', 'NVDA']) {
    await input.fill(ticker)
    const selected = dialog.locator('[role="option"][aria-selected="true"]')
    await expect(selected).toHaveAttribute('href', `/stock/${ticker}`)
    await expect(selected.locator('mark')).toHaveText(ticker)
  }
  await dialog.getByRole('button', { name: '저장 기사', exact: true }).click()
  const requestCount = searches.length
  await input.fill('nvida')
  const article = dialog.getByRole('option')
  await expect(article.locator('strong')).toHaveText(title)
  await expect(article.locator('mark').first()).toBeVisible()
  await expect(article.locator('img')).toHaveCount(0)
  await expect(article).toHaveAttribute('href', 'https://example.com/private-fuse')
  await expect(article).toHaveAttribute('rel', 'noopener noreferrer')
  await input.fill('Private earnings')
  await expect(article).toBeVisible()
  expect(searches.length).toBe(requestCount)
  expect(await page.evaluate(() => localStorage.getItem('anthracite:saved:v3'))).toBe(before)
  expect(state.pageErrors).toEqual([])
})
