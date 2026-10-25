import { test, expect } from '@playwright/test'
import { installStockFixtures } from './stock-fixtures.mjs'

test('simulator handles boundary ages and rejects invalid ages without blocking input', async ({ page }) => {
  const state = await installStockFixtures(page)
  await page.goto('/simulator')
  const age = page.getByRole('spinbutton', { name: '현재 나이', exact: true })
  await age.fill('-1000000000')
  await expect(page.getByRole('alert')).toContainText('0~100의 정수')
  for (const name of ['은행 저축 · 예금 (원)', '연간 평균 소비 (원)', '연 수입 (원)']) await page.getByRole('textbox', { name, exact: true }).fill('0')
  for (const value of ['0', '25', '100']) {
    await age.fill(value)
    await expect(page.locator('.sim-table tbody tr')).toHaveCount(101 - Number(value))
    await expect(page.locator('.sim-table tbody tr').first().getByRole('rowheader')).toHaveText(`${value}세`)
    await expect(page.locator('.sim-chart text').filter({ hasText: /^\d+세$/ }).first()).toHaveText(`${value}세`)
    await expect(page.locator('.sim-chart text').filter({ hasText: /^100세$/ })).toHaveCount(1)
  }
  for (const value of ['-1000000000', '101', '25.5']) {
    await age.fill(value)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.locator('.sim-chart, .sim-table')).toHaveCount(0)
  }
  await age.fill('25')
  await expect(page.locator('.sim-table tbody tr')).toHaveCount(76)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(state.pageErrors).toEqual([])
})
