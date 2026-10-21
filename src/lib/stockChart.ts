// @ts-expect-error Shared browser/server period registry.
import { CHART_PERIODS } from '../../lib/stock-chart-periods.js'
export const stockChartPeriods = CHART_PERIODS as readonly ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'ALL']
export type StockChartPeriod = typeof stockChartPeriods[number]
export interface PricePoint { t: number; c: number }
export interface StockChartData {
  symbol: string; period: StockChartPeriod; points: PricePoint[]; currency: string; interval: string; source: string;
  fetchedAt: number; stale: boolean; baseline: { c: number; t?: number; label: string } | null; changePercent: number | null;
}
export function validStockChart(value: unknown): value is StockChartData {
  const data = value as StockChartData | null
  return !!data && typeof data.symbol === 'string' && stockChartPeriods.includes(data.period) && /^[A-Z]{3}$/.test(data.currency)
    && typeof data.source === 'string' && typeof data.interval === 'string' && Number.isFinite(data.fetchedAt)
    && (data.changePercent === null || Number.isFinite(data.changePercent))
    && (data.baseline === null || Number.isFinite(data.baseline?.c) && data.baseline.c > 0 && typeof data.baseline.label === 'string')
    && Array.isArray(data.points) && data.points.length <= 15000 && data.points.every((point, index) => point && Number.isFinite(point.t) && Number.isFinite(point.c) && point.c > 0 && (index === 0 || point.t > data.points[index - 1].t))
}
export function chartIntervalLabel(interval: string) {
  return ({ '1m': '1분봉', '5m': '5분봉', '15m': '15분봉', '30m': '30분봉', '1h': '1시간봉', '60m': '1시간봉', '1d': '일봉', '1wk': '주봉', '1mo': '월봉', '3mo': '3개월봉' } as Record<string, string>)[interval] ?? '가격 집계'
}
const chartDateFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })
const chartTimeFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export function chartPointTime(at: number, period: StockChartPeriod, axis = false) {
  if (axis) return period === '1D' ? chartTimeFormat.format(at) : chartDateFormat.format(at)
  const date = chartDateFormat.format(at)
  return period === '1D' || period === '5D' ? `${date} ${chartTimeFormat.format(at)}` : date
}
