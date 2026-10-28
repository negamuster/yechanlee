import Fuse from 'fuse.js/basic'
import { articleKey } from './savedItems.ts'
import type { SavedItems } from './savedItems.ts'
import type { Briefing } from './briefings.ts'
import type { NewsFeedData } from './newsRefresh.ts'
import { stockSearchQuery, stockSearchAliases } from './stockSearch.ts'
import type { StockMatch } from './stockSearch.ts'

export const searchGroups = [
  ['pages', '빠른 이동'], ['stocks', '종목'], ['briefings', '브리핑'], ['saved', '저장 기사'], ['news', '뉴스'],
] as const
export type SearchGroup = typeof searchGroups[number][0]
export interface SearchResult { id: string; group: SearchGroup; title: string; description: string; href: string; external?: boolean; text: string; highlights?: [number, number][] }
export const searchPages = [
  ['/', '홈 · 최신 뉴스', '뉴스 news home'], ['/markets', '시장 · Market Movers', '시세 상승 하락 거래대금 market movers'],
  ['/briefings', 'Daily Market Briefing', '브리핑 지난 브리핑 daily briefing'], ['/saved', '저장한 항목 · 관심 종목', '북마크 저장 기사 투자 노트 watchlist saved bookmarks'],
  ['/filings', 'SEC 공시 모니터', '공시 보고서 sec edgar filings 10-k 10-q 8-k'], ['/calendar', '경제·실적 캘린더', '일정 calendar earnings'], ['/form13f', '기관 포트폴리오 · 13F', '13f 기관 보유 공시 institutional holdings'],
  ['/simulator', '자산 시뮬레이터', '복리 자산 경제적 자유 simulator'], ['/equity', '주식시장 · Maps', '주식 업종 히트맵 섹터 equity maps sectors'],
  ['/rates', '금리·채권', '채권 국채 수익률 bond rates treasury'], ['/fed', '연준·통화정책', 'fed fomc 금리'],
  ['/indicators', '경제지표', '지표 경제 cpi 물가 실업률 고용 금리 effr economic indicators'], ['/macro', '글로벌 매크로', '환율 원자재 거시 macro'],
  ['/live', 'Yahoo Finance Live', '라이브 방송 live'], ['/more', '더보기 · 투자 도구', '도구 tools more'],
] as const
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim()

export function siteSearchResults(query: string, saved: SavedItems, briefings: Briefing[], news: NewsFeedData | null, stocks: StockMatch[] = [], group: SearchGroup | 'all' = 'all', companies: StockMatch[] = []) {
  const rows: SearchResult[] = searchPages.map(([href, title, text]) => ({ id: `page:${href}`, group: 'pages', href, title, text: `${title} ${text}`, description: '페이지로 이동' }))
  const matches = new Map<string, StockMatch>(saved.stocks.map(stock => [stock.ticker, { ...stock, primary_exchange: '관심 종목' }]))
  if (query.trim()) for (const stock of companies) if (!matches.has(stock.ticker)) matches.set(stock.ticker, stock)
  for (const stock of stocks) if (!matches.has(stock.ticker)) matches.set(stock.ticker, stock)
  const direct = stockSearchQuery(query).toUpperCase()
  for (const stock of matches.values()) rows.push({ id: `stock:${stock.ticker}`, group: 'stocks', title: `${stock.ticker} · ${stock.name}`, text: `${stock.ticker} ${stock.name} ${Object.entries(stockSearchAliases).filter(([, ticker]) => ticker === stock.ticker).map(([alias]) => alias).join(' ')}`, href: `/stock/${encodeURIComponent(stock.ticker)}`, description: stock.primary_exchange || '미국 상장 종목' })
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
  const scoped = rows.filter(row => group === 'all' || row.group === group)
  const fuse = new Fuse(scoped, { keys: [{ name: 'title', weight: 0.7 }, { name: 'text', weight: 0.3 }], threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2, includeMatches: true, includeScore: true, findAllMatches: true })
  // Every word must match. Short identifiers and numbers remain literal.
  const exactStock = scoped.find(row => row.id === `stock:${direct}`)
  const fuzzy = terms.map(term => new Map((!exactStock && term.length >= 3 && /[\p{L}]/u.test(term) ? fuse.search(term) : []).map(hit => [hit.item.id, hit])))
  const filtered = scoped.filter(row => (!terms.length || row === exactStock || terms.every((term, i) => normalize(row.text).includes(term) || fuzzy[i].has(row.id)))
    && (!exactStock || row.group !== 'stocks' || row === exactStock))
  const rank = (row: SearchResult) => row === exactStock ? 4 : normalize(row.title) === exact ? 3 : normalize(row.title).startsWith(exact) ? 2 : normalize(row.title).includes(exact) ? 1 : 0
  const score = (row: SearchResult) => fuzzy.reduce((total, hits) => total + (hits.get(row.id)?.score ?? 1), 0)
  const groups = exactStock ? [['stocks', '종목'] as const, ...searchGroups.filter(([category]) => category !== 'stocks')] : searchGroups
  return groups.flatMap(([category]) => filtered.filter(row => row.group === category).sort((a, b) => rank(b) - rank(a) || score(a) - score(b)).slice(0, terms.length ? 6 : category === 'pages' ? 8 : 3)).map(row => {
    const ranges: [number, number][] = fuzzy.flatMap(hits => hits.get(row.id)?.matches?.filter(match => match.key === 'title').flatMap(match => match.indices.map(([from, to]) => [from, to] as [number, number])) ?? [])
    // Literal/alias highlights use original string positions, never normalized offsets.
    for (const term of [...terms, ...(row === exactStock ? [direct.toLowerCase()] : [])]) {
      const title = row.title.toLowerCase()
      for (let at = title.indexOf(term); term && at >= 0; at = title.indexOf(term, at + term.length)) ranges.push([at, at + term.length - 1])
    }
    return { ...row, highlights: mergeSearchHighlights(row.title, ranges) }
  })
}

export function mergeSearchHighlights(text: string, ranges: readonly (readonly [number, number])[]) {
  const merged: [number, number][] = []
  for (const [from, to] of [...ranges].filter(([a, b]) => Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= a && b < text.length).sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1)
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to)
    else merged.push([from, to])
  }
  return merged
}
