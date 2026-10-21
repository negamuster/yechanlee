import { articleKey } from './savedItems.ts'
import type { SavedItems } from './savedItems.ts'
import type { Briefing } from './briefings.ts'
import type { NewsFeedData } from './newsRefresh.ts'
import { stockSearchQuery } from './stockSearch.ts'
import type { StockMatch } from './stockSearch.ts'

export const searchGroups = [
  ['pages', '빠른 이동'], ['stocks', '종목'], ['briefings', '브리핑'], ['saved', '저장 기사'], ['news', '뉴스'],
] as const
export type SearchGroup = typeof searchGroups[number][0]
export interface SearchResult { id: string; group: SearchGroup; title: string; description: string; href: string; external?: boolean; text: string }
export const searchPages = [
  ['/', '홈 · 최신 뉴스', '뉴스 news home'], ['/markets', '시장 · Market Movers', '시세 상승 하락 거래대금 market movers'],
  ['/briefings', 'Daily Market Briefing', '브리핑 지난 브리핑 daily briefing'], ['/saved', '저장한 항목 · 관심 종목', '북마크 저장 기사 투자 노트 watchlist saved bookmarks'],
  ['/calendar', '경제·실적 캘린더', '일정 calendar earnings'], ['/form13f', '기관 포트폴리오 · 13F', '13f 기관 보유 공시 institutional holdings'],
  ['/simulator', '자산 시뮬레이터', '복리 자산 경제적 자유 simulator'], ['/equity', '주식시장 · Maps', '주식 업종 히트맵 섹터 equity maps sectors'],
  ['/rates', '금리·채권', '채권 국채 수익률 bond rates treasury'], ['/fed', '연준·통화정책', 'fed fomc 금리'],
  ['/indicators', '경제지표', '지표 경제 cpi 고용 economic indicators'], ['/macro', '글로벌 매크로', '환율 원자재 거시 macro'],
  ['/live', 'Yahoo Finance Live', '라이브 방송 live'], ['/more', '더보기 · 투자 도구', '도구 tools more'],
] as const
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim()

export function siteSearchResults(query: string, saved: SavedItems, briefings: Briefing[], news: NewsFeedData | null, stocks: StockMatch[] = [], group: SearchGroup | 'all' = 'all') {
  const rows: SearchResult[] = searchPages.map(([href, title, text]) => ({ id: `page:${href}`, group: 'pages', href, title, text: `${title} ${text}`, description: '페이지로 이동' }))
  const matches = new Map<string, StockMatch>(saved.stocks.map(stock => [stock.ticker, { ...stock, primary_exchange: '관심 종목' }]))
  for (const stock of stocks) if (!matches.has(stock.ticker)) matches.set(stock.ticker, stock)
  const direct = stockSearchQuery(query).toUpperCase()
  for (const stock of matches.values()) rows.push({ id: `stock:${stock.ticker}`, group: 'stocks', title: `${stock.ticker} · ${stock.name}`, text: `${stock.ticker} ${stock.name}`, href: `/stock/${encodeURIComponent(stock.ticker)}`, description: stock.primary_exchange || '미국 상장 종목' })
  for (const item of briefings) rows.push({ id: `briefing:${item.id}`, group: 'briefings', title: item.title, description: `${item.sessionDate || item.id} · 게시된 브리핑`, href: `/briefings/${encodeURIComponent(item.id)}`, text: `${item.title} ${item.id} ${item.sessionDate || ''} ${item.summary.join(' ')} ${item.blocks.map(block => block.text).join(' ')}` })
  const seen = new Set<string>()
  const article = (item: { article_url: string; title: string; publisher: string; published_utc: string }, category: 'news' | 'saved') => {
    const href = articleKey(item.article_url)
    if (!href || seen.has(href)) return
    seen.add(href)
    rows.push({ id: `article:${href}`, group: category, title: item.title, text: `${item.title} ${item.publisher}`, description: `${item.publisher} · ${item.published_utc.slice(0, 10)} · 원문 ↗`, href, external: true })
  }
  saved.articles.forEach(item => article(item, 'saved'))
  news?.items.forEach(item => article(item, 'news'))
  const terms = normalize(query).split(' ').filter(Boolean)
  const exact = normalize(query)
  const filtered = rows.filter(row => (group === 'all' || row.group === group) && (!terms.length || terms.every(term => normalize(row.text).includes(term)) || row.group === 'stocks' && row.id === `stock:${direct}`))
  const rank = (row: SearchResult) => row.group === 'stocks' && row.id === `stock:${direct}` ? 4 : normalize(row.title) === exact ? 3 : normalize(row.title).startsWith(exact) ? 2 : normalize(row.title).includes(exact) ? 1 : 0
  return searchGroups.flatMap(([category]) => filtered.filter(row => row.group === category).sort((a, b) => rank(b) - rank(a)).slice(0, terms.length ? 6 : category === 'pages' ? 8 : 3))
}
