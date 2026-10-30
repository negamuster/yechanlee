import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { installScreenReviewFixtures } from './screen-review-fixtures.mjs'
const editions = JSON.parse(await readFile(new URL('../../src/data/published-briefings.json', import.meta.url), 'utf8'))
const legacy = editions.find(item => item.id === '2026-10-16')
const screens = [
  { id: 'home', path: '/', title: '오늘의 시장', ready: '.news-article', nav: '/' },
  { id: 'markets', path: '/markets', title: '시장', ready: '.mover-row', nav: '/markets' },
  { id: 'equity', path: '/equity', title: '주식시장', ready: '.company-map-tile', nav: '/markets' },
  { id: 'rates', path: '/rates', title: '금리·채권', ready: '.guide-resources', nav: '/markets' },
  { id: 'fed', path: '/fed', title: '연준·통화정책', ready: '.guide-resources', nav: '/markets' },
  { id: 'indicators', path: '/indicators', title: '경제지표', ready: '.economic-chart svg', nav: '/markets' },
  { id: 'macro', path: '/macro', title: '글로벌 매크로', ready: '.guide-resources', nav: '/markets' },
  { id: 'calendar', path: '/calendar', title: /Calendar/, ready: '.calendar-event', nav: '/calendar' },
  { id: 'filings', path: '/filings', title: '공시 모니터링', ready: '.filing-list li', nav: '/more' },
  { id: 'form13f', path: '/form13f', title: '기관 포트폴리오 · 13F', ready: '.portfolio-holdings tbody tr', nav: '/more' },
  { id: 'simulator', path: '/simulator', title: '자산 시뮬레이터', ready: '.simulator-sections', nav: '/more' },
  { id: 'saved', path: '/saved', title: '저장한 항목', ready: '.saved-empty', nav: '/saved' },
  { id: 'thesis', path: '/saved/thesis/AAPL', title: /AAPL.*투자 노트/, ready: '.thesis-page form', nav: '/saved' },
  { id: 'briefings', path: '/briefings', title: 'Daily Market Briefing', ready: '.briefing-archive ol li', nav: '/' },
  { id: 'latest-briefing', path: `/briefings/${editions[0].id}`, title: editions[0].title, ready: '.briefing-sources li', nav: '/' },
  { id: 'legacy-briefing', path: `/briefings/${legacy.id}`, title: legacy.title, ready: '.briefing-sources li', nav: '/' },
  { id: 'methodology', path: '/briefings/methodology', title: '브리핑 작성 원칙', ready: '.briefing-article h2', nav: '/' },
  { id: 'more', path: '/more', title: '더보기', ready: '.more-page section', nav: '/more' },
  { id: 'live', path: '/live', title: 'Live', ready: '.market-live-open', nav: '/more' },
  { id: 'stock', path: '/stock/AAPL', title: 'Apple Inc.', ready: '.stock-current-price', nav: '/markets' },
]

for (const screen of screens) test(`screen review: ${screen.id} has a readable page heading and fits both widths`, async ({ page, isMobile }, testInfo) => {
  const state = await installScreenReviewFixtures(page)
  if (screen.id === 'thesis') await page.addInitScript(() => localStorage.setItem('anthracite:saved:v3', JSON.stringify({ version: 1, stocks: [{ ticker: 'AAPL', name: 'Apple Inc.' }], articles: [] })))
  const widths = isMobile ? [393, 320] : [1440, 768]
  await page.setViewportSize({ width: widths[0], height: 1000 })
  await page.goto(screen.path)
  await expect(page.locator('main h1')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1, name: screen.title, exact: typeof screen.title === 'string' })).toBeVisible()
  await expect(page.locator(screen.ready).first()).toBeVisible()
  const metrics = []
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 })
    await page.evaluate(async () => { await document.fonts.ready })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const heading = await page.locator('main h1').evaluate(el => { const s = getComputedStyle(el); return { text: el.textContent, font: s.fontFamily, size: parseFloat(s.fontSize), clipped: el.scrollWidth > el.clientWidth + 1 } })
    expect(heading.size).toBeGreaterThanOrEqual(20)
    expect(heading.clipped).toBe(false)
    if (isMobile) {
      const nav = page.getByRole('navigation', { name: '모바일 주요 메뉴', exact: true })
      await expect(nav).toBeVisible()
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
      await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('href', screen.nav)
    }
    await page.screenshot({ path: testInfo.outputPath(`screen-review-${screen.id}-${width}.png`), fullPage: true })
    metrics.push({ width, heading })
  }
  await writeFile(testInfo.outputPath(`screen-review-${screen.id}.json`), JSON.stringify({ path: screen.path, metrics }, null, 2))
  expect(state.pageErrors).toEqual([])
})
