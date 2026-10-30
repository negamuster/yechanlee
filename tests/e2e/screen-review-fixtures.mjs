import { readFile } from 'node:fs/promises'
import { installStockFixtures, FIXED_AT } from './stock-fixtures.mjs'
import { filingFixture } from '../fixtures/form13f.mjs'
import { economicFixture } from '../fixtures/economic-indicators.mjs'
import { SECTORS } from '../../lib/sector-performance.js'
const sec = JSON.parse(await readFile(new URL('../fixtures/sec-monitor.json', import.meta.url), 'utf8'))

export async function installScreenReviewFixtures(page) {
  const state = await installStockFixtures(page)
  await page.route('**/api/economic-indicators', route => route.fulfill({ json: economicFixture() }))
  await page.route('**/api/form13f?*', route => route.fulfill({ json: filingFixture() }))
  await page.route('**/data/sec-filings.json', route => route.fulfill({ json: sec }))
  await page.route('**/api/market-indices', route => route.fulfill({ json: { fetchedAt: FIXED_AT, quotes: ['^GSPC', '^IXIC', '^KS11', '^N225', 'GC=F', 'CL=F', 'BTC-USD', 'DX-Y.NYB'].map((symbol, i) => ({ symbol, label: `검증 시세 ${i + 1}`, price: 100 + i, changePercent: 1.25, asOf: '2026-10-20T20:00:00Z', unit: 'pt', status: 'ok' })) } }))
  await page.route('**/api/market-movers', route => route.fulfill({ json: { tradingDate: '2026-10-20', previousTradingDate: '2026-10-19', fetchedAt: FIXED_AT, stale: false, rankings: { turnover: [{ ticker: 'AAPL', price: 102, volume: 1e6, turnover: 102e6, changePct: 1.25 }], gainers: [], losers: [] } } }))
  const returns = { '1d': 1.25, '1w': 2.1, '1m': 3.4, ytd: 12.8 }
  const sector = { returns, relative: returns, starts: { '1d': '2026-10-19', '1w': '2026-10-13', '1m': '2026-09-18', ytd: '2025-12-31' }, asOf: '2026-10-20' }
  await page.route('**/api/sector-performance', route => route.fulfill({ json: { sectors: SECTORS.map(([symbol, name]) => ({ ...sector, symbol, name })), benchmark: { ...sector, symbol: 'VOO', name: 'S&P 500' }, fetchedAt: new Date(FIXED_AT).toISOString(), stale: false, basis: '검증용 USD 종가 수익률' } }))
  await page.route('**/api/calendar?*', route => route.fulfill({ json: { events: new URL(route.request().url()).searchParams.get('mode') === 'month' ? [{ id: 'screen-event', title: '검증 경제 일정', date: '2026-10-21', startAt: '2026-10-21T13:30:00Z', category: 'Economic', major: true, source: '검증 출처', sourceUrl: 'https://example.com/calendar', estimated: false }] : [], sources: [], fetchedAt: new Date(FIXED_AT).toISOString() } }))
  await page.route('**/api/news', route => route.fulfill({ json: { items: [{ id: 'screen-news', title: '전체 화면 검증용 시장 뉴스', publisher: '검증 출처', article_url: 'https://example.com/screen-news', published_utc: '2026-10-21T11:00:00Z', region: 'global', topics: ['investing'] }], sources: [{ id: 'screen-news', publisher: '검증 출처', region: 'global', status: 'ok', checkedAt: FIXED_AT }], fetchedAt: FIXED_AT } }))
  await page.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<html lang="ko"><body style="margin:0;background:#18283f;color:white;display:grid;place-content:center;height:100vh;font:16px sans-serif">검증용 방송 영역</body></html>' }))
  return state
}
