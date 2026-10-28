import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { installStockFixtures } from './stock-fixtures.mjs'

async function setup(page, time) {
  const state = await installStockFixtures(page)
  await page.clock.setFixedTime(new Date(time))
  await page.route('**/api/calendar?*', route => route.fulfill({ status: 503, json: { error: 'Fixture feed outage' } }))
  return state
}
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)

test('home shows the planned NYSE holiday and next KST open on both layouts without depending on provider feeds', async ({ page }) => {
  const state = await setup(page, '2026-11-26T15:00:00Z')
  await page.goto('/')
  const status = page.getByRole('region', { name: '미국 정규장 일정', exact: true })
  await expect(status).toContainText('휴장일')
  await expect(status).toContainText(/다음 개장.*11.*27.*23:30.*KST/)
  await status.locator('summary').click()
  await expect(status).toContainText('실제 거래 상태')
  await expect(status).toContainText('장전·장후 거래는 포함하지 않습니다')
  await noOverflow(page)
  await status.getByRole('link', { name: '휴장 일정 ↗', exact: true }).click()
  await expect(page).toHaveURL(/\/calendar$/)
  await expect(page.locator('.calendar-list')).toContainText('미국 주식 휴장 (NYSE)')
  expect(state.pageErrors).toEqual([])
})

test('local holidays survive feed failure and export US all-day dates while early closes keep KST/ET instants', async ({ page }) => {
  const state = await setup(page, '2026-11-26T15:00:00Z')
  await page.goto('/calendar')
  await page.getByRole('button', { name: '거래소', exact: true }).click()
  const agenda = page.locator('.calendar-list')
  await expect(agenda).toContainText('일정 일부를 확인하지 못했습니다.')
  await expect(agenda).toContainText('미국 주식 휴장 (NYSE)')
  await expect(agenda).toContainText('종일 (미국 날짜)')
  await expect(page.getByText('선택한 날짜에 등록된 일정이 없어요.', { exact: true })).toHaveCount(0)
  const holidayDownload = page.waitForEvent('download')
  await agenda.getByRole('button', { name: 'NYSE equity market holiday 일정 파일 저장', exact: true }).click()
  const holiday = await readFile(await (await holidayDownload).path(), 'utf8')
  expect(holiday).toContain('DTSTART;VALUE=DATE:20261126')
  expect(holiday).not.toContain('DTSTART:')
  await page.locator('.calendar-date[data-date="2026-11-27"]').click()
  await expect(agenda).toContainText('미국 주식 조기 폐장 (NYSE)')
  await expect(agenda).toContainText(/11.*28.*03:00 KST/)
  await page.locator('.calendar-settings-menu > summary').click()
  await page.getByRole('combobox', { name: '발표 시간대', exact: true }).selectOption('America/New_York')
  await expect(agenda).toContainText(/11.*27.*13:00 ET/)
  const earlyDownload = page.waitForEvent('download')
  await agenda.getByRole('button', { name: 'NYSE equity market early close 일정 파일 저장', exact: true }).click()
  const early = await readFile(await (await earlyDownload).path(), 'utf8')
  expect(early).toContain('DTSTART:20261127T180000Z')
  await page.getByRole('button', { name: '관심 종목 실적만', exact: true }).click()
  await expect(agenda.getByText('미국 주식 조기 폐장 (NYSE)', { exact: false })).toHaveCount(0)
  await noOverflow(page)
  expect(state.pageErrors).toEqual([])
})
