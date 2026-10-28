import { test, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { installStockFixtures, FIXED_AT } from './stock-fixtures.mjs'
import { SECTORS } from '../../lib/sector-performance.js'

async function setup(page) {
  const state = await installStockFixtures(page)
  const fontFiles = new Map()
  page.on('response', response => {
    if (new URL(response.url()).pathname.endsWith('.woff2')) fontFiles.set(response.url(), response.body().then(body => body.byteLength).catch(() => null))
  })
  state.fontFiles = fontFiles
  const day = '2026-10-20', returns = { '1d': 1.25, '1w': 2.1, '1m': 3.4, ytd: 12.8 }
  const sector = { symbol: 'XLK', name: 'Technology', returns, relative: returns, starts: { '1d': '2026-10-19', '1w': '2026-10-13', '1m': '2026-09-18', ytd: '2025-12-31' }, asOf: day }
  await page.route('**/api/sector-performance', route => route.fulfill({ json: { sectors: SECTORS.map(([symbol, name], index) => ({ ...sector, symbol, name, returns: { ...returns, '1d': index % 3 ? -.45 : 1.25 } })), benchmark: { ...sector, symbol: 'VOO', name: 'S&P 500' }, fetchedAt: new Date(FIXED_AT).toISOString(), stale: false, basis: 'USD · 일별 종가 · 배당 미포함 가격수익률' } }))
  await page.route('**/api/market-movers', route => route.fulfill({ json: { tradingDate: day, previousTradingDate: '2026-10-19', fetchedAt: FIXED_AT, stale: false, rankings: { turnover: [{ ticker: 'AAPL', price: 102, volume: 1e6, turnover: 1e9, changePct: 1.25 }, { ticker: 'NVDA', price: 204, volume: 2e6, turnover: 9e8, changePct: -.45 }], gainers: [], losers: [] } } }))
  await page.route('**/api/market-indices', route => route.fulfill({ json: { fetchedAt: FIXED_AT, quotes: [{ symbol: '^GSPC', label: 'S&P 500', price: 6000, changePercent: 1.25, asOf: '2026-10-20T20:00:00Z', unit: 'pt', status: 'ok' }, { symbol: '^IXIC', label: 'NASDAQ', price: 20000, changePercent: -.45, asOf: '2026-10-20T20:00:00Z', unit: 'pt', status: 'ok' }] } }))
  await page.route('**/api/calendar?*', route => route.fulfill({ json: { events: [], sources: [{ name: 'BLS', date: null, state: 'snapshot', updatedAt: '2026-10-20T12:00:00Z', error: 'http_403', checkedAt: '2026-10-21T12:00:00Z', url: 'https://www.bls.gov/schedule/' }], fetchedAt: new Date(FIXED_AT).toISOString() } }))
  await page.route('**/api/news', route => route.fulfill({ json: { items: [{ id: 'home-design-fixture', title: '미국 기술주와 반도체 시장 점검', publisher: '검증용 뉴스', article_url: 'https://example.com/home-design-fixture', published_utc: '2026-10-21T11:00:00Z', region: 'global', topics: ['investing'] }], sources: [], fetchedAt: FIXED_AT } }))
  await page.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<html lang="ko"><body style="margin:0;background:#18283f;color:white;display:grid;place-content:center;height:100vh;font:16px sans-serif">브라우저 검증용 방송 영역</body></html>' }))
  return state
}
async function fontsReady(page) {
  await page.evaluate(async () => { await document.fonts.ready })
  expect(await page.evaluate(() => [...document.fonts].some(face => face.family.includes('Pretendard') && face.status === 'loaded'))).toBe(true)
}
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
async function compactTilesFit(page) {
  const maps = page.locator('.home-dashboard-maps')
  await expect(maps.locator('.sector-selectable')).toHaveCount(11)
  expect(await maps.locator('.sector-selectable').evaluateAll(tiles => tiles.every(tile => {
    const bounds = tile.getBoundingClientRect()
    return [...tile.querySelectorAll('button > span, strong, a')].every(element => {
      const box = element.getBoundingClientRect()
      return box.left >= bounds.left - 1 && box.right <= bounds.right + 1 && element.scrollWidth <= element.clientWidth + 1
    })
  }))).toBe(true)
  const buttons = await maps.locator('.sector-periods button').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y } }))
  expect(buttons[0].y).toBe(buttons[1].y)
  expect(buttons[2].y).toBe(buttons[3].y)
  expect(buttons[2].y).toBeGreaterThan(buttons[0].y)
}

test('home type, icons, nested actions and local fonts remain accessible with source warnings intact', async ({ page }, testInfo) => {
  const state = await setup(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: '오늘의 시장', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '미국 기술주와 반도체 시장 점검', exact: true })).toBeVisible()
  await fontsReady(page)
  const body = await page.locator('body').evaluate(element => ({ font: getComputedStyle(element).fontFamily, size: parseFloat(getComputedStyle(element).fontSize) }))
  expect(body.font).toContain('Pretendard'); expect(body.size).toBeGreaterThanOrEqual(15)
  const caption = page.locator('.mobile-briefing-disclaimer, .briefing-meta').last()
  expect(await caption.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12)
  const selected = page.locator('.news-filters button[aria-pressed="true"]')
  const contrast = await selected.evaluate(element => {
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4 })
    const luminance = value => { const [r, g, b] = rgb(value); return .2126 * r + .7152 * g + .0722 * b }
    const style = getComputedStyle(element), a = luminance(style.color), b = luminance(style.backgroundColor)
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
  })
  expect(contrast).toBeGreaterThanOrEqual(4.5)
  if (testInfo.project.name === 'desktop-chromium') {
    const maps = page.locator('.home-dashboard-maps')
    await compactTilesFit(page)
    await maps.getByRole('button', { name: 'Maps 출처와 산정 기준', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(maps.locator('.widget-info-panel')).toBeVisible()
    await maps.getByRole('button', { name: 'Maps 출처와 산정 기준', exact: true }).click()
    await expect(page.locator('.home-dashboard-calendar')).toContainText('일정 일부를 확인하지 못했습니다.')
    const save = page.getByRole('button', { name: 'AAPL 관심 종목 저장', exact: true })
    await expect(save.locator('svg')).toHaveAttribute('focusable', 'false')
    await save.click()
    await expect(page.getByRole('button', { name: 'AAPL 관심 종목 해제', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/\/$/)
  }
  const search = page.getByRole('button', { name: '통합 검색·빠른 이동', exact: true })
  await search.click()
  const dialog = page.getByRole('dialog', { name: '통합 검색·빠른 이동', exact: true })
  await expect(dialog.getByRole('combobox')).toBeFocused()
  await dialog.getByRole('combobox').press('Escape')
  await expect(search).toBeFocused()
  await noOverflow(page)
  await page.getByRole('heading', { level: 1, name: '오늘의 시장', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('home-ui.png'), fullPage: true })
  // Use actual WOFF2 response bodies so metrics do not depend on ResourceTiming availability.
  // These are compressed font payload bytes, excluding HTTP headers.
  const fonts = await Promise.all([...state.fontFiles].map(async ([url, bytes]) => ({ url, bytes: await bytes })))
  const metrics = { fontRequests: fonts.length, fontPayloadBytes: fonts.reduce((sum, entry) => sum + entry.bytes, 0), fontOrigins: [...new Set(fonts.map(entry => new URL(entry.url).origin))] }
  await writeFile(testInfo.outputPath('home-ui-metrics.json'), JSON.stringify(metrics, null, 2))
  expect(metrics.fontRequests).toBeGreaterThan(0)
  expect(fonts.every(entry => entry.bytes !== null && entry.bytes > 0)).toBe(true)
  expect(metrics.fontOrigins).toEqual(['http://127.0.0.1:4173'])
  expect(metrics.fontPayloadBytes).toBeLessThan(1_000_000)
  expect(state.pageErrors).toEqual([])
})

test('home reflows through desktop, tablet, zoom-equivalent and narrow mobile widths', async ({ page }, testInfo) => {
  const state = await setup(page)
  await page.goto('/')
  await fontsReady(page)
  for (const width of [1440, 1280, 1024, 768, 640, 393, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    const briefing = page.locator('.home-briefing')
    if (width <= 700) await expect(briefing).toHaveClass(/is-mobile/)
    else await expect(briefing).not.toHaveClass(/is-mobile/)
    if (width > 700) await compactTilesFit(page)
    await noOverflow(page)
    if ([1440, 768, 320].includes(width)) await page.screenshot({ path: testInfo.outputPath(`home-ui-${width}.png`), fullPage: true })
  }
  expect(state.pageErrors).toEqual([])
})
