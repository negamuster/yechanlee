import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { installStockFixtures } from './stock-fixtures.mjs'

const manifest = JSON.parse(await readFile(new URL('../../dist/.vite/manifest.json', import.meta.url), 'utf8'))
const paletteFile = manifest['src/components/CommandPalette.tsx'].file
const archiveFile = Object.values(manifest).find(chunk => chunk.name === 'briefingArchive').file
const editions = JSON.parse(await readFile(new URL('../../src/data/published-briefings.json', import.meta.url), 'utf8'))
const latest = editions[0], older = editions.at(-1)
const trigger = page => page.getByRole('button', { name: '통합 검색·빠른 이동', exact: true })
const menu = page => page.getByRole('dialog', { name: '통합 검색·빠른 이동', exact: true })

test('home renders the current edition before deferred search/archive downloads and delayed search can be cancelled safely', async ({ page }) => {
  const state = await installStockFixtures(page)
  const scripts = []
  page.on('request', request => { if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname) })
  let release
  const gate = new Promise(resolve => { release = resolve })
  await page.route(`**/${paletteFile}`, async route => { await gate; await route.continue() })
  await page.goto('/')
  await expect(page.locator('.home-briefing-summary')).toHaveText(latest.summary.slice(0, 3))
  expect(scripts).not.toContain(`/${paletteFile}`)
  expect(scripts).not.toContain(`/${archiveFile}`)
  await trigger(page).click()
  await expect(menu(page).getByRole('status')).toHaveText('검색을 불러오는 중…')
  await expect(menu(page).getByRole('button', { name: '검색 닫기', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
  await expect(trigger(page)).toBeFocused()
  release()
  await trigger(page).click()
  await expect(menu(page).getByRole('combobox')).toBeFocused()
  await menu(page).getByRole('button', { name: '브리핑', exact: true }).click()
  await menu(page).getByRole('combobox').fill(older.id)
  await expect(menu(page).getByRole('option').and(menu(page).locator(`a[href="/briefings/${older.id}"]`))).toBeVisible()
  expect(scripts).toContain(`/${paletteFile}`)
  expect(scripts).toContain(`/${archiveFile}`)
  await page.keyboard.press('Escape')
  await expect(trigger(page)).toBeFocused()
  expect(await page.locator('body').evaluate(node => node.style.overflowY)).not.toBe('hidden')
  expect(state.pageErrors).toEqual([])
})

test('a failed search chunk gives a closable error without hiding the home edition, and reload recovers', async ({ page }) => {
  await installStockFixtures(page)
  await page.route(`**/${paletteFile}`, route => route.abort())
  await page.goto('/')
  await trigger(page).click()
  await expect(menu(page).getByRole('alert')).toContainText('검색을 불러오지 못했습니다.')
  await expect(menu(page).getByRole('button', { name: '페이지 새로고침', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
  await expect(trigger(page)).toBeFocused()
  await expect(page.locator('.home-briefing-summary')).toHaveText(latest.summary.slice(0, 3))
  expect(await page.locator('body').evaluate(node => node.style.overflowY)).not.toBe('hidden')
  await page.unroute(`**/${paletteFile}`)
  await trigger(page).click()
  await menu(page).getByRole('button', { name: '페이지 새로고침', exact: true }).click()
  await expect(page.locator('.home-briefing-summary')).toHaveText(latest.summary.slice(0, 3))
  await trigger(page).click()
  await expect(menu(page).getByRole('combobox')).toBeFocused()
})

test('direct archive and source deep links keep all original body, corrections and source URLs', async ({ page }) => {
  const state = await installStockFixtures(page)
  const source = older.sources[0]
  await page.goto(`/briefings/${older.id}#source-${source.id}`)
  await expect(page.locator('.briefing-article h1')).toHaveText(older.title)
  for (const block of older.blocks) for (const text of block.kind === 'metadata' ? block.text.split(' · ') : [block.text]) await expect(page.locator('.briefing-article')).toContainText(text)
  for (const correction of older.corrections) await expect(page.locator('.briefing-article details')).toContainText(correction.text)
  await expect(page.locator(`#source-${source.id} > a`).first()).toHaveAttribute('href', source.url)
  await expect(page.locator(`#source-${source.id}`)).toBeInViewport()
  await page.goto('/briefings')
  await expect(page.locator('.briefing-archive ol > li')).toHaveCount(editions.length)
  expect(state.pageErrors).toEqual([])
})
