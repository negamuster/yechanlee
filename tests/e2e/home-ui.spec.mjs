import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { installStockFixtures, FIXED_AT } from './stock-fixtures.mjs'
import { SECTORS } from '../../lib/sector-performance.js'
const [edition] = JSON.parse(await readFile(new URL('../../src/data/published-briefings.json', import.meta.url), 'utf8'))

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
  const events = ['2026-10-21', '2026-10-22'].flatMap(date => Array.from({ length: 5 }, (_, index) => ({ id: `${date}-${index}`, title: `검증 일정 ${index + 1}`, date, startAt: `${date}T${String(14 + index).padStart(2, '0')}:00:00Z`, category: 'Economic', major: index === 0, source: '검증 출처', sourceUrl: 'https://example.com/calendar', estimated: false })))
  await page.route('**/api/calendar?*', route => route.fulfill({ json: { events: new URL(route.request().url()).searchParams.get('mode') === 'month' ? events : [], sources: [{ name: 'BLS', date: null, state: 'snapshot', updatedAt: '2026-10-20T12:00:00Z', error: 'http_403', checkedAt: '2026-10-21T12:00:00Z', url: 'https://www.bls.gov/schedule/' }], fetchedAt: new Date(FIXED_AT).toISOString() } }))
  state.homeNews = { fail: false, partial: true, items: [{ id: 'home-design-fixture', title: '미국 기술주와 반도체 시장 점검', publisher: '검증용 뉴스', article_url: 'https://example.com/home-design-fixture', published_utc: '2026-10-21T11:00:00Z', region: 'global', topics: ['investing'] }] }
  await page.route('**/api/news', route => state.homeNews.fail ? route.fulfill({ status: 503, json: { error: 'Simulated outage' } }) : route.fulfill({ json: { items: state.homeNews.items, sources: [{ id: 'fixture', publisher: '검증용 뉴스', region: 'global', status: 'ok', checkedAt: FIXED_AT }, ...(state.homeNews.partial ? [{ id: 'fixture-blocked', publisher: '접근 제한 매체', region: 'global', status: 'unavailable', error: 'http_403', checkedAt: FIXED_AT, nextRetryAt: FIXED_AT + 1800000 }] : [])], fetchedAt: FIXED_AT } }))
  await page.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<html lang="ko"><head><meta charset="utf-8"></head><body style="margin:0;background:#18283f;color:white;display:grid;place-content:center;height:100vh;font:16px sans-serif">브라우저 검증용 방송 영역</body></html>' }))
  return state
}
async function fontsReady(page) {
  await page.evaluate(async () => { await document.fonts.ready })
  expect(await page.evaluate(() => [...document.fonts].some(face => face.family.includes('Pretendard') && face.status === 'loaded'))).toBe(true)
}
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
async function compactTilesFit(page) {
  const maps = page.locator('.home-dashboard-maps')
  await maps.getByRole('button', { name: '업종 ETF', exact: true }).click()
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
  await maps.getByRole('button', { name: '기업 시가총액', exact: true }).click()
  await expect(maps.locator('.company-map-tile')).toHaveCount(3)
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
  const layout = await page.evaluate(() => Object.fromEntries(['.home-briefing', '.news-controls', '.news-status-area', '.news-article'].map(selector => { const r = document.querySelector(selector)?.getBoundingClientRect(); return [selector, r ? { top: r.top + scrollY, height: r.height } : null] })))
  await writeFile(testInfo.outputPath('home-ui-layout.json'), JSON.stringify(layout, null, 2))
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

test('compact briefing opens the complete edition with every original summary and detail basis', async ({ page }, testInfo) => {
  await setup(page)
  await page.goto('/')
  const card = page.locator('.home-briefing-card')
  await expect(card.locator('.home-briefing-summary')).toHaveText(edition.summary.slice(0, 3))
  await fontsReady(page)
  const height = (await page.locator('.home-briefing').boundingBox()).height
  await expect(card.locator('.briefing-detail-tabs, .briefing-stocks, .mobile-briefing-event-preview')).toHaveCount(0)
  await expect(card.locator('time')).toHaveAttribute('datetime', edition.cutoffAt)
  await card.getByRole('link', { name: '브리핑 전체 보기', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/briefings/${edition.id}$`))
  await expect(page.locator('.briefing-edition-summary li')).toHaveCount(edition.summary.length)
  for (const text of edition.summary) await expect(page.locator('.briefing-edition-summary')).toContainText(text)
  for (const stock of edition.homepage?.stocks ?? []) await expect(page.locator('.briefing-stocks')).toContainText(stock.basis)
  for (const asset of edition.homepage?.assets ?? []) {
    await expect(page.locator('.mobile-briefing-assets')).toContainText(asset.value)
    await expect(page.locator('.mobile-briefing-assets')).toContainText(asset.basis)
  }
  await noOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('home-ui-edition.png'), fullPage: true })
  await page.getByRole('link', { name: '← 지난 브리핑', exact: true }).click()
  await expect(page).toHaveURL(/\/briefings$/)
  await page.getByRole('link', { name: '← 홈', exact: true }).click()
  await expect(card.locator('.home-briefing-summary')).toHaveText(edition.summary.slice(0, 3))
  await fontsReady(page)
  expect((await page.locator('.home-briefing').boundingBox()).height).toBeLessThanOrEqual(height + 1)
  await noOverflow(page)
})

test('compact news preserves filter choices and restores mobile dialog focus', async ({ page }, testInfo) => {
  await setup(page)
  await page.goto('/')
  const feed = page.locator('.news-feed'), toggle = feed.locator('.news-filter-toggle')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  if (testInfo.project.name === 'mobile-chromium') {
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(toggle).toBeFocused()
  } else {
    await expect(feed.getByRole('group', { name: '뉴스 주제 선택' })).toBeVisible()
    await feed.getByRole('button', { name: '테크', exact: true }).click()
    await toggle.click()
    await expect(feed.getByRole('button', { name: '테크 주제 필터 해제', exact: true })).toBeVisible()
    await page.reload()
    await expect(feed.getByRole('button', { name: /필터/ }).filter({ has: page.locator('.news-filter-count') })).toHaveAttribute('aria-expanded', 'false')
    await feed.getByRole('button', { name: '테크 주제 필터 해제', exact: true }).click()
    await expect(feed.getByRole('heading', { name: '미국 기술주와 반도체 시장 점검', exact: true })).toBeVisible()
    await feed.getByRole('button', { name: '필터', exact: true }).click()
    await page.reload()
    await expect(feed.getByRole('button', { name: '필터', exact: true })).toHaveAttribute('aria-expanded', 'true')
  }
})

test('news warnings remain visible with folded source details and a failed refresh retains original articles and receipt time', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/')
  const feed = page.locator('.news-feed'), sources = feed.locator('.news-source-status')
  const headline = feed.getByRole('heading', { name: '미국 기술주와 반도체 시장 점검', exact: true })
  await expect(headline).toBeVisible()
  await expect(feed.getByText('일부 매체를 확인하지 못했습니다.', { exact: true })).toBeVisible()
  await expect(sources).not.toHaveAttribute('open')
  await sources.locator('summary').click()
  await expect(sources).toContainText('출처 서버에서 접근 거부 (403)')
  await sources.locator('summary').click()
  state.homeNews.fail = true
  await feed.getByRole('button', { name: '새 기사 확인', exact: true }).click()
  await expect(feed.getByText('갱신 실패 · 이전 수집 기사 표시 중', { exact: true })).toBeVisible()
  await expect(headline).toBeVisible()
  await expect(feed.locator('.data-notice-time time')).toHaveAttribute('datetime', new Date(FIXED_AT).toISOString())
  state.homeNews.fail = false; state.homeNews.partial = false; state.homeNews.items = []
  await feed.getByRole('button', { name: '갱신 실패 · 이전 수집 기사 표시 중 다시 시도', exact: true }).click()
  await expect(feed.getByRole('button', { name: '뉴스 목록 업데이트 보기', exact: true })).toBeVisible()
  await expect(headline).toBeVisible()
  await feed.getByRole('button', { name: '뉴스 목록 업데이트 보기', exact: true }).click()
  await expect(headline).toHaveCount(0)
  await expect(feed.getByText('최근 72시간 내 선택한 조건에 맞는 기사가 없습니다.', { exact: true })).toBeVisible()
  await expect(feed.getByText('일부 매체를 확인하지 못했습니다.', { exact: true })).toHaveCount(0)
})

test('an initial news failure remains distinct from a confirmed empty list', async ({ page }) => {
  const state = await setup(page); state.homeNews.fail = true
  await page.goto('/')
  const feed = page.locator('.news-feed')
  await expect(feed.getByText('뉴스를 불러오지 못했습니다.', { exact: true })).toBeVisible()
  await expect(feed.getByText('최근 72시간 내 선택한 조건에 맞는 기사가 없습니다.', { exact: true })).toHaveCount(0)
  state.homeNews.fail = false; state.homeNews.partial = false; state.homeNews.items = []
  await feed.getByRole('button', { name: '뉴스를 불러오지 못했습니다. 다시 시도', exact: true }).click()
  await expect(feed.getByText('최근 72시간 내 선택한 조건에 맞는 기사가 없습니다.', { exact: true })).toBeVisible()
})

test('home calendar previews three events and expands, folds and resets for another date without losing source warnings', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 1024, height: 1000 })
  await page.goto('/')
  const calendar = page.locator('.home-dashboard-calendar'), events = calendar.locator('.calendar-event')
  await expect(events).toHaveCount(3)
  await expect(calendar).toContainText('주요 일정 우선 · 3/5개 표시')
  await expect(calendar).toContainText('일정 일부를 확인하지 못했습니다.')
  expect((await calendar.locator('.calendar-list').boundingBox()).height).toBeLessThanOrEqual(241)
  await calendar.getByRole('button', { name: '나머지 2개 더 보기', exact: true }).click()
  await expect(events).toHaveCount(5)
  const fold = calendar.getByRole('button', { name: '일정 접기', exact: true })
  await expect(fold).toBeFocused()
  await fold.click()
  await expect(events).toHaveCount(3)
  await calendar.getByRole('button', { name: '나머지 2개 더 보기', exact: true }).click()
  await calendar.locator('[data-date="2026-10-22"]').click()
  await expect(events).toHaveCount(3)
  await expect(calendar.getByRole('button', { name: '나머지 2개 더 보기', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(calendar).toContainText('BLS')
  await expect(page).toHaveURL(/\/$/)
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

test('every home card title and its actual link use the same font before and after reading an edition', async ({ page }, testInfo) => {
  await setup(page)
  await page.goto('/')
  const readTitles = async () => page.locator('.home-content h2.widget-title').evaluateAll(nodes => nodes.flatMap(node => [node, ...node.querySelectorAll('a')].map(element => {
    const s = getComputedStyle(element)
    return { text: element.textContent, family: s.fontFamily, size: parseFloat(s.fontSize), weight: s.fontWeight, lineHeight: parseFloat(s.lineHeight), spacing: s.letterSpacing === 'normal' ? 0 : parseFloat(s.letterSpacing) }
  })))
  const check = async () => {
    await expect(page.locator('.home-content h2.widget-title').first()).toBeVisible()
    await fontsReady(page)
    const titles = await readTitles()
    expect(titles.length).toBeGreaterThanOrEqual(3)
    for (const title of titles) {
      expect(title.family).toContain('Pretendard')
      expect(title.size).toBe(18)
      expect(title.weight).toBe('600')
      expect(title.lineHeight).toBeCloseTo(25.2, 1)
      expect(title.spacing).toBe(0)
    }
    return titles
  }
  const measurements = []
  for (const width of [1440, 1024, 768, 393, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    if (width <= 700) await expect(page.locator('.home-briefing')).toHaveClass(/is-mobile/)
    else await expect(page.locator('.home-briefing')).not.toHaveClass(/is-mobile/)
    const titles = await check()
    expect(await page.locator('.home-content h2.widget-title').count()).toBe(width > 700 ? 6 : 2)
    if (width > 700) {
      const maps = page.locator('.home-dashboard-maps')
      await maps.getByRole('button', { name: '업종 ETF', exact: true }).click()
      await check()
      await maps.getByRole('button', { name: '기업 시가총액', exact: true }).click()
    }
    await noOverflow(page)
    if ([1440, 320].includes(width)) await page.screenshot({ path: testInfo.outputPath(`home-ui-titles-${width}.png`), fullPage: true })
    measurements.push({ width, titles })
  }
  await page.getByRole('link', { name: '브리핑 전체 보기', exact: true }).click()
  await expect(page.locator('.briefing-article h1')).toBeVisible()
  await page.getByRole('link', { name: '← 지난 브리핑', exact: true }).click()
  await page.getByRole('link', { name: '← 홈', exact: true }).click()
  await check()
  await writeFile(testInfo.outputPath('home-ui-title-metrics.json'), JSON.stringify(measurements, null, 2))
})

test('header clocks stay centered without covering navigation and the market strip stays compact and readable', async ({ page, isMobile }, testInfo) => {
  const state = await setup(page)
  const metrics = []
  for (const width of isMobile ? [393, 320] : [2048, 1440, 1280, 1101, 1100, 1024, 861, 860, 768, 700, 393, 320]) {
    await page.setViewportSize({ width, height: 700 })
    // Home intentionally omits the strip on mobile; Markets exposes the same widget.
    const path = width <= 700 ? '/markets' : '/'
    if (new URL(page.url()).pathname !== path) await page.goto(path)
    await expect(page.locator('.market-ticker-item').first()).toBeVisible()
    if (width > 700) await expect(page.locator('.home-briefing')).not.toHaveClass(/is-mobile/)
    await fontsReady(page)
    const layout = await page.evaluate(() => {
      const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, center: r.top + r.height / 2 } }
      const clocks = box('.market-clocks'), header = box('.site-header'), quote = box('.market-ticker-item')
      const overlap = [...document.querySelectorAll('.site-menu a')].some(el => { const r = el.getBoundingClientRect(); return r.width && r.height && r.left < clocks.right && r.right > clocks.left && r.top < clocks.bottom && r.bottom > clocks.top })
      return { header, clocks, quote, search: box('.site-search'), brand: box('.site-brand'), contact: box('.site-contact'), overlap,
        tickerHeight: box('.market-ticker').height,
        priceFont: parseFloat(getComputedStyle(document.querySelector('.market-ticker-value')).fontSize),
        timeFont: parseFloat(getComputedStyle(document.querySelector('.market-ticker-time')).fontSize),
        controlHeight: box('.market-ticker-meta button').height }
    })
    if (width > 1100) {
      // The content grid has 6px top padding; optical center remains within 3px of the complete bar.
      expect(Math.abs(layout.clocks.center - layout.header.center)).toBeLessThanOrEqual(3)
      expect(Math.abs(layout.contact.center - layout.clocks.center)).toBeLessThanOrEqual(1)
    } else {
      const row = width > 860 ? layout.search : layout.brand
      expect(Math.abs(layout.clocks.center - row.center)).toBeLessThanOrEqual(1)
    }
    expect(layout.overlap).toBe(false)
    expect(layout.quote.height).toBeLessThanOrEqual(48)
    expect(layout.priceFont).toBeGreaterThanOrEqual(14)
    expect(layout.timeFont).toBeGreaterThanOrEqual(12)
    if (isMobile) expect(layout.controlHeight).toBeGreaterThanOrEqual(44)
    await expect(page.locator('.market-ticker-item').first().locator('.market-ticker-time')).toContainText('시세 기준')
    await noOverflow(page)
    metrics.push({ width, path, ...layout })
    if ([2048, 1440, 1101, 768, 320].includes(width)) await page.screenshot({ path: testInfo.outputPath(`home-ui-header-${width}.png`) })
  }
  if (!isMobile) {
    await page.setViewportSize({ width: 1440, height: 700 })
    await page.getByRole('button', { name: '통합 검색·빠른 이동', exact: true }).press('Tab')
    const button = page.locator('button[aria-controls="site-contact-links"]')
    await expect(button).toBeFocused()
    await button.press('Enter')
    await button.press('Tab')
    const profile = page.locator('#site-contact-links a').first()
    await expect(profile).toBeFocused()
    await expect(profile).toBeInViewport()
    await expect(profile).toHaveText('Personal Profile ↗')
    await expect(profile).toHaveAttribute('href', 'https://negamuster.github.io/')
    await profile.press('Escape')
    await expect(page.locator('#site-contact-links')).toHaveCount(0)
  }
  await page.goto('/more')
  const contact = page.getByRole('region', { name: 'Contact', exact: true })
  await expect(contact.getByRole('link', { name: /Personal Profile/ })).toHaveAttribute('href', 'https://negamuster.github.io/')
  await writeFile(testInfo.outputPath('home-ui-header-metrics.json'), JSON.stringify(metrics, null, 2))
  expect(state.pageErrors).toEqual([])
})
