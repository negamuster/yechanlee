// @ts-expect-error Shared server/client trading-day cutoff.
import { latestDailyDate, nyDate } from '../../lib/trading-session.js'

import { refreshPolicies } from './refreshPolicy.ts'
export const STOCK_TTL = refreshPolicies.stock.staleTime
export const STOCK_MAX_AGE = 24 * 3600000
export interface DailyBar { t: number; o: number; h: number; l: number; c: number }
export interface StockResourceSource { fetchedAt: number; stale: boolean }
export interface StockSnapshot {
  symbol: string; fetchedAt: number; details: any; bars: DailyBar[];
  news: any[]; financials: any[]; related: string[]; issues: string[]; historyAvailable: boolean;
  companySource: 'Polygon / Massive' | 'SEC EDGAR';
  resourceSources?: { details?: StockResourceSource; news?: StockResourceSource; related?: StockResourceSource };
  financialSource?: { source: string; fetchedAt: number; stale: boolean; status?: string }
}
export class StockSnapshotError extends Error {}
export function freshSnapshot(item: StockSnapshot | undefined, symbol: string, now = Date.now()) {
  return !!item && item.symbol === symbol && now >= item.fetchedAt && now - item.fetchedAt < STOCK_TTL && !item.issues.length
}
export function usableSnapshot(item: StockSnapshot | undefined, symbol: string, now = Date.now()) {
  return !!item && item.symbol === symbol && now >= item.fetchedAt && now - item.fetchedAt <= STOCK_MAX_AGE
}
export function retainStockResources(previous: StockSnapshot | undefined, incoming: StockSnapshot, now = Date.now()): StockSnapshot {
  if (!usableSnapshot(previous, incoming.symbol, now) || !previous) return incoming
  const result = { ...incoming, resourceSources: { ...incoming.resourceSources } }
  const source = (part: 'details' | 'news' | 'related', maxAge: number) => {
    const value = previous.resourceSources?.[part]
    return value && now >= value.fetchedAt && now - value.fetchedAt <= maxAge ? { ...value, stale: true } : undefined
  }
  const details = source('details', 24 * 3600000)
  if (incoming.companySource === 'SEC EDGAR' && previous.companySource === 'Polygon / Massive' && previous.details?.ticker === incoming.symbol && details) {
    result.details = previous.details; result.companySource = previous.companySource; result.resourceSources.details = details
  }
  for (const [part, issue, maxAge] of [['news', '뉴스', 6 * 3600000], ['related', '관련 종목', 7 * 86400000]] as const) {
    const original = source(part, maxAge)
    if (incoming.issues.includes(issue) && previous[part].length && original) {
      result[part] = previous[part]; result.resourceSources[part] = original
    }
  }
  return result
}
export function completedBars(rows: DailyBar[], now = Date.now()): DailyBar[] {
  const cutoff = latestDailyDate(now)
  return [...new Map(rows.filter(row => Number.isFinite(row.t) && row.t > 0
    && [row.o, row.h, row.l, row.c].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)
    && row.h >= Math.max(row.o, row.c, row.l) && row.l <= Math.min(row.o, row.c)
    && nyDate(row.t) <= cutoff).map(row => [nyDate(row.t), row])).values()].sort((a, b) => a.t - b.t)
}
export function quoteFromBars(bars: DailyBar[]) {
  const latest = bars.at(-1), previous = bars.at(-2)
  const change = latest && previous ? latest.c - previous.c : null
  return { latest, previous, tradingDate: latest ? nyDate(latest.t) : null,
    previousDate: previous ? nyDate(previous.t) : null, change,
    changePct: change !== null && previous ? change / previous.c * 100 : null,
    high: bars.length ? Math.max(...bars.map(b => b.h)) : null,
    low: bars.length ? Math.min(...bars.map(b => b.l)) : null }
}
export async function fetchStockSnapshot(symbol: string, signal: AbortSignal, fetcher = fetch, now = Date.now()): Promise<StockSnapshot> {
  const to = latestDailyDate(now)
  const from = new Date(Date.parse(`${to}T12:00:00Z`) - 365 * 86400000).toISOString().slice(0, 10)
  async function get(path: string, retry = false) {
    for (let attempt = 0; attempt < (retry ? 2 : 1); attempt++) {
      let transient = true
      try {
        const response = await fetcher(`/api/stock-data?path=${encodeURIComponent(path)}`, {
          signal: AbortSignal.any([signal, AbortSignal.timeout(retry ? 12000 : 18000)]),
        })
        transient = [500, 502, 503, 504].includes(response.status)
        const data = await response.json()
        transient = transient && data?.code !== 'MARKET_ACCESS_DENIED'
        if (response.status === 429) throw new StockSnapshotError('조회 요청이 몰려 일시적으로 제한되고 있습니다. 잠시 후 다시 조회해 주세요.')
        if (!response.ok) throw new Error('조회 실패')
        if (!data || data.error || ['ERROR', 'NOT_AUTHORIZED'].includes(data.status)) throw new Error('조회 실패')
        return data
      } catch (error) {
        signal.throwIfAborted()
        if (!retry || attempt > 0 || !transient) throw error
      }
    }
  }
  async function annual() {
    const response = await fetcher(`/api/stock-financials?ticker=${encodeURIComponent(symbol)}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]) })
    if (!response.ok) throw new Error('연간 재무 조회 실패')
    const data = await response.json()
    if (data.symbol !== symbol || !Array.isArray(data.results) || data.source !== 'SEC EDGAR' || !Number.isFinite(data.fetchedAt)) throw new Error('연간 재무 응답 미확인')
    return data
  }
  const jobs = await Promise.allSettled([
    get(`/v3/reference/tickers/${symbol}`, true),
    get(`/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=500`, true),
    get(`/v2/reference/news?ticker=${symbol}&limit=8&order=desc`, true),
    annual(),
    get(`/v1/related-companies/${symbol}`, true),
    get(`/v2/aggs/ticker/${symbol}/prev?adjusted=true`),
  ])
  signal.throwIfAborted()
  const value = (i: number) => jobs[i].status === 'fulfilled' ? i === 3 ? jobs[i].value : jobs[i].value.results : undefined
  const source = (i: number): StockResourceSource => {
    const info = jobs[i].status === 'fulfilled' ? jobs[i].value.sourceInfo : undefined
    return info?.source === 'Polygon / Massive' && Number.isFinite(info.fetchedAt) && info.fetchedAt > 0 && info.fetchedAt <= Date.now() + 30000
      ? { fetchedAt: info.fetchedAt, stale: info.stale === true } : { fetchedAt: now, stale: false }
  }
  const annualData = value(3), reference = value(0)
  // A failed reference request must not hide independently confirmed prices and
  // filings. SEC has already checked this symbol's ticker-to-CIK correspondence.
  // An explicit conflicting symbol is never eligible for fallback.
  if (reference?.ticker && reference.ticker !== symbol) throw new StockSnapshotError('응답한 기업 정보의 티커가 일치하지 않습니다. 다시 조회해 주세요.')
  const hasReference = reference?.ticker === symbol && typeof reference.name === 'string' && !!reference.name.trim()
  const secName = annualData?.status === 'ok' && typeof annualData.company === 'string' && annualData.company.trim()
  if (!hasReference && !secName) {
    if (jobs[0].status === 'rejected' && jobs[0].reason instanceof StockSnapshotError) throw jobs[0].reason
    throw new StockSnapshotError('기업 정보를 확인하지 못했습니다. 데이터 제공자의 일시적인 오류일 수 있으니 잠시 후 다시 조회해 주세요.')
  }
  const details = hasReference ? reference : { ticker: symbol, name: secName }
  // The range endpoint can lag the previous-day endpoint. Merge only validated,
  // completed, same-ticker bars; a missing latest bar never becomes a zero quote.
  const previousDay = Array.isArray(value(5)) ? value(5).filter((row: DailyBar & { T?: string }) => row.T === symbol) : []
  const history = Array.isArray(value(1)) ? completedBars(value(1), now) : []
  const bars = completedBars([...history, ...previousDay], now)
  if (!bars.length) {
    const rateLimit = [jobs[1], jobs[5]].find(job => job.status === 'rejected' && job.reason instanceof StockSnapshotError)
    if (rateLimit?.status === 'rejected') throw rateLimit.reason
    throw new StockSnapshotError('기업 정보는 확인했지만 일별 시세를 받지 못했습니다. 잠시 후 다시 조회해 주세요.')
  }
  const issues = [2, 4, 5].filter(i => !Array.isArray(value(i))).map(i => ['','','뉴스','','관련 종목','최근 종가'][i])
  if (!hasReference) issues.unshift('상세 기업 정보')
  if (!annualData || annualData.stale) issues.push('연간 재무')
  if (!history.length) issues.unshift('가격 이력')
  return { symbol, fetchedAt: now, details, companySource: hasReference ? 'Polygon / Massive' : 'SEC EDGAR', bars, issues, historyAvailable: history.length > 0,
    resourceSources: { details: hasReference ? source(0) : undefined, news: Array.isArray(value(2)) ? source(2) : undefined, related: Array.isArray(value(4)) ? source(4) : undefined },
    news: Array.isArray(value(2)) ? value(2) : [], financials: annualData?.results ?? [],
    financialSource: annualData ? { source: annualData.source, fetchedAt: annualData.fetchedAt, stale: annualData.stale, status: annualData.status } : undefined,
    related: Array.isArray(value(4)) ? value(4).map((r: { ticker: string }) => r.ticker).filter((s: string) => /^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(s)).slice(0, 8) : [] }
}
