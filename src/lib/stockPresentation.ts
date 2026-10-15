import type { DailyBar } from './stockSnapshot'

export function stockNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
export function stockMoney(value: unknown, currency = 'USD', compact = false) {
  const number = stockNumber(value)
  if (number === null) return '—'
  const unit = /^[A-Z]{3}$/.test(currency) ? currency : 'USD'
  const scale = compact ? [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']].find(([size]) => Math.abs(number) >= Number(size)) : undefined
  const divisor = scale ? Number(scale[0]) : 1
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: unit, maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(number / divisor) + (scale?.[1] ?? '')
}
export function stockPercent(value: unknown, signed = false) {
  const number = stockNumber(value)
  return number === null ? '—' : `${signed && number > 0 ? '+' : ''}${number.toFixed(2)}%`
}
export function stockChartWindow(bars: DailyBar[], days: number) {
  const last = bars.at(-1)
  const selected = last ? bars.filter(bar => bar.t >= last.t - days * 86400000) : []
  const first = selected[0]
  const changePercent = selected.length > 1 && first && last ? (last.c / first.c - 1) * 100 : null
  return { bars: selected, first, last, changePercent }
}
export function nearestStockBar(bars: DailyBar[], fraction: number) {
  if (!bars.length) return -1
  const target = bars[0].t + Math.max(0, Math.min(1, fraction)) * (bars.at(-1)!.t - bars[0].t)
  return bars.reduce((closest, bar, index) => Math.abs(bar.t - target) < Math.abs(bars[closest].t - target) ? index : closest, 0)
}
