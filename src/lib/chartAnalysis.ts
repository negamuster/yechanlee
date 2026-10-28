import type { PricePoint, StockChartData, StockChartPeriod } from './stockChart'

export const movingAverageWindows = [20, 50] as const
export type MovingAverageWindow = typeof movingAverageWindows[number]
export interface AveragePoint { t: number; value: number | null }
// These are N observed bars, not N calendar/trading days. Do not invent warm-up history.
export function simpleMovingAverage(points: PricePoint[], window: MovingAverageWindow): AveragePoint[] {
  return points.map((point, index) => {
    if (index + 1 < window) return { t: point.t, value: null }
    const sample = points.slice(index + 1 - window, index + 1)
    const valid = sample.every(p => Number.isFinite(p.c) && p.c > 0)
    const value = valid ? sample.reduce((sum, p) => sum + p.c / window, 0) : NaN
    return { t: point.t, value: Number.isFinite(value) ? value : null }
  })
}
export interface ComparisonPoint { t: number; stock: number; benchmark: number; difference: number }
export type ReturnComparison = { status: 'ok'; points: ComparisonPoint[] } | { status: 'unavailable'; reason: string }
const orderedPrices = (points: PricePoint[]) => points.every((p, i) => Number.isFinite(p.t) && Number.isFinite(p.c) && p.c > 0 && (!i || p.t > points[i - 1].t))
export function compareChartReturns(primary: { points: PricePoint[]; currency: string; interval: string; period: StockChartPeriod }, benchmark: StockChartData): ReturnComparison {
  const unavailable = (reason: string): ReturnComparison => ({ status: 'unavailable', reason })
  if (benchmark.symbol !== 'VOO' || primary.period !== benchmark.period) return unavailable('비교 종목·조회 기간이 일치하지 않습니다.')
  if (primary.currency !== benchmark.currency) return unavailable('통화가 달라 VOO와 비교하지 않습니다.')
  if (primary.interval !== benchmark.interval) return unavailable('봉 주기가 달라 VOO와 비교하지 않습니다.')
  if (!orderedPrices(primary.points) || !orderedPrices(benchmark.points)) return unavailable('가격·관측 시점을 검증할 수 없습니다.')
  const index = new Map(benchmark.points.map(p => [p.t, p.c]))
  const common = primary.points.filter(p => index.has(p.t))
  if (common.length < 2) return unavailable('동일 시점의 공통 관측치가 2개 이상 필요합니다.')
  const first = common[0], base = index.get(first.t)!
  const points = common.map(p => {
    const stock = ((p.c - first.c) / first.c) * 100, benchmark = ((index.get(p.t)! - base) / base) * 100
    return { t: p.t, stock, benchmark, difference: stock - benchmark }
  })
  return points.every(p => [p.stock, p.benchmark, p.difference].every(Number.isFinite)) ? { status: 'ok', points } : unavailable('비교 변화율을 계산할 수 없습니다.')
}
