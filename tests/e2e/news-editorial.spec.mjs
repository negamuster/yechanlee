import { test, expect } from '@playwright/test'
import { installScreenReviewFixtures } from './screen-review-fixtures.mjs'
import { FIXED_AT } from './stock-fixtures.mjs'

test('major news groups close reports, latest reveals originals, and unrelated headlines stay excluded', async ({ page }, testInfo) => {
  await installScreenReviewFixtures(page)
  const item = (id, title, hours) => ({ id, title, publisher: id, region: 'global', topics: ['business'], article_url: `https://example.com/${id}`, published_utc: new Date(FIXED_AT - hours * 3600000).toISOString() })
  const items = [item('fresh', 'Technology market discussion', .1), item('cpi', 'US CPI inflation report released', 2), item('apple', 'Apple announces quarterly earnings revenue growth 10%', 1), item('related', 'Apple quarterly earnings revenue growth 10% announced', 3), item('routine', '지석진 주식 폭망 (런닝맨)', .01)]
  await page.route('**/api/news', route => route.fulfill({ json: { items, sources: [], fetchedAt: FIXED_AT } }))
  await page.goto('/')
  const feed = page.locator('.news-feed:visible')
  await feed.scrollIntoViewIfNeeded()
  await expect(feed.getByRole('button', { name: '주요 뉴스', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(feed.locator('.news-article')).toHaveCount(3)
  await expect(feed.locator('.news-article').first().locator('h3')).toHaveText('US CPI inflation report released')
  await feed.getByText('관련 보도 1건 · 제목·사건 단서 기준').click()
  const related = feed.locator('.news-related a')
  await expect(related).toHaveAttribute('href', 'https://example.com/related')
  await expect(feed.locator('.news-related time')).toHaveAttribute('datetime', items[3].published_utc)
  await expect(feed.getByText('지석진 주식 폭망 (런닝맨)')).toHaveCount(0)
  await feed.getByRole('button', { name: '최신순', exact: true }).click()
  await expect(feed.locator('.news-article')).toHaveCount(4)
  await expect(feed.locator('.news-article').first().locator('h3')).toHaveText('Technology market discussion')
  await expect(feed.locator('.news-related')).toHaveCount(0)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  expect(overflow).toBe(false)
  await page.screenshot({ path: testInfo.outputPath('home-ui-news-editorial.png') })
})

test('same bank decision links Korean and English reports, while forecasts remain separate and labeled', async ({ page }) => {
  await installScreenReviewFixtures(page)
  const make = (id, title, hours) => ({ id, title, publisher: id, region: id === 'ko' ? 'kr' : 'global', topics: ['economy'], article_url: `https://example.com/${id}`, published_utc: new Date(FIXED_AT - hours * 3600000).toISOString() })
  const items = [make('en', 'Fed holds interest rates at 5.25%', 1), make('ko', '연준 기준금리 5.25% 동결', 2), make('preview', '연준 기준금리 5.25% 동결 전망', 3)]
  await page.route('**/api/news', route => route.fulfill({ json: { items, sources: [], fetchedAt: FIXED_AT } }))
  await page.goto('/')
  const feed = page.locator('.news-feed:visible')
  await feed.scrollIntoViewIfNeeded()
  await expect(feed.locator('.news-article')).toHaveCount(2)
  await expect(feed.locator('.news-article-kind').filter({ hasText: '보도·일반' })).toHaveCount(1)
  await expect(feed.locator('.news-article-kind').filter({ hasText: '전망·예고' })).toHaveCount(1)
  await feed.locator('.news-related summary').click()
  await expect(feed.locator('.news-related a')).toHaveText('연준 기준금리 5.25% 동결')
  await feed.getByRole('button', { name: '최신순', exact: true }).click()
  await expect(feed.locator('.news-article')).toHaveCount(3)
})
