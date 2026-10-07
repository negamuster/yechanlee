// @ts-expect-error Shared server/client trading-day cutoff.
import { latestDailyDate, nyDate } from '../../lib/trading-session.js'

export const STOCK_TTL = 5 * 60000
export const STOCK_MAX_AGE = 24 * 3600000
export interface DailyBar { t: number; o: number; h: number; l: number; c: number }
export interface StockSnapshot {
  symbol: string; fetchedAt: number; details: any; bars: DailyBar[];
  news: any[]; financials: any[]; related: string[]; issues: string[];
}
export function freshSnapshot(item: StockSnapshot | undefined, symbol: string, now = Date.now()) {
  return !!item && item.symbol === symbol && now >= item.fetchedAt && now - item.fetchedAt < STOCK_TTL && !item.issues.length
}
export function usableSnapshot(item: StockSnapshot | undefined, symbol: string, now = Date.now()) {
  return !!item && item.symbol === symbol && now >= item.fetchedAt && now - item.fetchedAt <= STOCK_MAX_AGE
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
  async function get(path: string) {
    const response = await fetcher(`/api/stock-data?path=${encodeURIComponent(path)}`, { signal })
    if (!response.ok) throw new Error('조회 실패')
    const data = await response.json()
    if (data.error || ['ERROR', 'NOT_AUTHORIZED'].includes(data.status)) throw new Error('조회 실패')
    return data.results
  }
  const jobs = await Promise.allSettled([
    get(`/v3/reference/tickers/${symbol}`),
    get(`/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=500`),
    get(`/v2/reference/news?ticker=${symbol}&limit=8&order=desc`),
    get(`/vX/reference/financials?ticker=${symbol}&timeframe=annual&limit=2&order=desc`),
    get(`/v1/related-companies/${symbol}`),
    get(`/v2/aggs/ticker/${symbol}/prev?adjusted=true`),
  ])
  signal.throwIfAborted()
  const value = (i: number) => jobs[i].status === 'fulfilled' ? jobs[i].value : undefined
  if (!value(0)?.name || value(0).ticker !== symbol || !Array.isArray(value(1))) throw new Error('종목 데이터를 확인하지 못했습니다. 잠시 후 다시 조회해 주세요.')
  // The range endpoint can lag the previous-day endpoint. Merge only validated,
  // completed, same-ticker bars; a missing latest bar never becomes a zero quote.
  const previousDay = Array.isArray(value(5)) ? value(5).filter((row: DailyBar & { T?: string }) => row.T === symbol) : []
  const bars = completedBars([...value(1), ...previousDay], now)
  if (!bars.length) throw new Error('확인된 일별 시세가 없습니다. 잠시 후 다시 조회해 주세요.')
  const issues = [2, 3, 4, 5].filter(i => !Array.isArray(value(i))).map(i => ['','','뉴스','연간 재무','관련 종목','최근 종가'][i])
  return { symbol, fetchedAt: now, details: value(0), bars, issues,
    news: Array.isArray(value(2)) ? value(2) : [], financials: Array.isArray(value(3)) ? value(3) : [],
    related: Array.isArray(value(4)) ? value(4).map((r: { ticker: string }) => r.ticker).filter((s: string) => /^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(s)).slice(0, 8) : [] }
}
