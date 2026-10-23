import { test, expect } from '@playwright/test'
import { installStockFixtures, FIXED_AT } from './stock-fixtures.mjs'
let state
test.beforeEach(async ({page}) => { state=await installStockFixtures(page) })
test.afterEach(() => { expect(state.pageErrors).toEqual([]) })

test('calendar exposes retained source time, failed attempt and next retry without claiming no events', async ({page}) => {
  await page.route('**/api/calendar?*', route => {
    const mode=new URL(route.request().url()).searchParams.get('mode')
    return route.fulfill({json:{events:[],sources:mode==='month'?[{name:'BLS',date:null,state:'snapshot',updatedAt:'2026-10-20T12:00:00Z',url:'https://www.bls.gov/schedule/',error:'http_403',checkedAt:'2026-10-21T12:00:00Z',nextRetryAt:'2026-10-21T12:30:00Z'}]:[],fetchedAt:new Date(FIXED_AT).toISOString()}})
  })
  await page.goto('/calendar')
  await expect(page.getByText('일정 일부를 확인하지 못했습니다.',{exact:true})).toBeVisible()
  await expect(page.getByText('선택한 날짜에 등록된 일정이 없어요.',{exact:true})).toHaveCount(0)
  await page.locator('.calendar-help summary[aria-label="캘린더 출처와 조회 범위"]').click()
  const source=page.locator('.calendar-source-status')
  await expect(source).toContainText('저장 일정 사용')
  await expect(source).toContainText('출처 서버 접근 거부 (403)')
  await expect(source).toContainText('원본 확인:')
  await expect(source).toContainText('최근 시도:')
  await expect(source).toContainText('재시도 가능 시각:')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})

test('news keeps stale-feed warnings separate from healthy articles and missing configuration', async ({page}) => {
  await page.route('**/api/news',route=>route.fulfill({json:{items:[{id:'fixture',title:'Markets earnings rise',article_url:'https://example.com/story',publisher:'Fixture News',region:'global',published_utc:'2026-10-21T11:00:00Z',topics:['investing'],feedStale:true,feedCollectedAt:FIXED_AT-3600000}],fetchedAt:FIXED_AT,sources:[{id:'example',publisher:'Fixture News',region:'global',status:'stale',error:'http_503',checkedAt:FIXED_AT,lastSuccessAt:FIXED_AT-3600000,nextRetryAt:FIXED_AT+120000},{id:'reuters',publisher:'Reuters',region:'global',status:'not_configured',checkedAt:null}]}}))
  await page.goto('/')
  await page.locator('.news-source-status summary').click()
  const status=page.locator('.news-source-status')
  await expect(status).toContainText('갱신 실패 · 이전 수집 기사 표시')
  await expect(status).toContainText('마지막 정상 수집:')
  await expect(status).toContainText('재시도 가능 시각:')
  await expect(status).toContainText('피드 미설정 · 수집 대상에서 제외')
  await expect(page.getByRole('heading',{name:'Markets earnings rise',exact:true})).toBeVisible()
})
