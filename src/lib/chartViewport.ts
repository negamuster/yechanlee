import type { PricePoint } from './stockChart'
export interface ChartRange { from: number; to: number }
export function chartFullRange(count: number): ChartRange { return { from: 0, to: Math.max(1, count - 1) } }
export function clampChartRange(range: ChartRange, count: number): ChartRange {
  const full = chartFullRange(count), width = Math.min(count - 1, Math.max(Math.min(7, count - 1), range.to - range.from))
  if (count < 2 || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return full
  const from = Math.max(full.from, Math.min(full.to - width, range.from))
  return { from, to: from + width }
}
export function zoomChartRange(range: ChartRange, count: number, factor: number): ChartRange {
  const width = (range.to - range.from) * factor, center = (range.from + range.to) / 2
  return clampChartRange({ from: center - width / 2, to: center + width / 2 }, count)
}
export function moveChartRange(range: ChartRange, count: number, direction: number): ChartRange {
  const shift = Math.max(1, (range.to - range.from) / 3) * direction
  return clampChartRange({ from: range.from + shift, to: range.to + shift }, count)
}
export function latestChartRange(range: ChartRange, count: number): ChartRange {
  const to = count - 1
  return clampChartRange({ from: to - (range.to - range.from), to }, count)
}
export function nearestChartIndex(points: PricePoint[], time: number) {
  if (!points.length || Number.isNaN(time) || time <= points[0].t) return 0
  if (time >= points.at(-1)!.t) return points.length - 1
  let lo = 0, hi = points.length - 1
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (points[mid].t < time) lo = mid + 1; else hi = mid }
  return lo > 0 && Math.abs(points[lo - 1].t - time) <= Math.abs((points[lo]?.t ?? Infinity) - time) ? lo - 1 : lo
}
// Anchor both ends to actual observation timestamps, so prepends, rolling
// intraday windows and newly appended bars do not move a reader's chosen window.
export function preserveChartRange(previous: PricePoint[], next: PricePoint[], range: ChartRange): ChartRange {
  if (!previous.length || !next.length) return chartFullRange(next.length)
  const map = (logical: number) => { const index = Math.max(0, Math.min(previous.length - 1, Math.round(logical))); return nearestChartIndex(next, previous[index].t) + logical - index }
  return clampChartRange({ from: map(range.from), to: map(range.to) }, next.length)
}
export function visibleChartPoints(points: PricePoint[], range: ChartRange) {
  return points.slice(Math.max(0, Math.ceil(range.from)), Math.min(points.length, Math.floor(range.to) + 1))
}
