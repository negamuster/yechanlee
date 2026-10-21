import { portfolioPercent } from './financialMath.ts'

export interface Holding {
  name: string; shares: number; value: number; prevShares?: number; pct?: number; cusip: string; title: string
}
export type HoldingSortKey = 'name' | 'pct' | 'shares' | 'value' | 'change'
export type HoldingSort = { key: HoldingSortKey; direction: 'asc' | 'desc' }
export const DEFAULT_HOLDING_SORT: HoldingSort = { key: 'value', direction: 'desc' }

export function holdingChange(holding: Holding): { kind: 'percent' | 'new' | 'unknown'; percent: number | null } {
  const previous = holding.prevShares
  if (previous == null || !Number.isFinite(previous) || previous < 0 || !Number.isFinite(holding.shares)) return { kind: 'unknown', percent: null }
  if (previous === 0) return { kind: holding.shares > 0 ? 'new' : 'unknown', percent: null }
  return { kind: 'percent', percent: (holding.shares - previous) / previous * 100 }
}

export function nextHoldingSort(current: HoldingSort, key: HoldingSortKey): HoldingSort {
  return { key, direction: current.key === key ? (current.direction === 'desc' ? 'asc' : 'desc') : key === 'name' ? 'asc' : 'desc' }
}

export function holdingRows(holdings: Holding[], total: number, query: string, sort: HoldingSort) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  // Keep the original portfolio rank and denominator through filtering and sorting.
  const rows = holdings.map((holding, index) => ({ ...holding, rank: index + 1, pct: portfolioPercent(holding.value, total), change: holdingChange(holding) }))
    .filter(holding => {
      const text = `${holding.name} ${holding.title} ${holding.cusip}`.toLocaleLowerCase()
      const tokens = text.split(/[^\p{L}\p{N}]+/u)
      // A class letter in a multi-word query must not match a letter inside INC.
      return words.every(word => words.length > 1 && word.length === 1 ? tokens.includes(word) : text.includes(word))
    })
  return rows.sort((a, b) => {
    let comparison = 0
    if (sort.key === 'change') {
      // New holdings have no percentage denominator; never treat them as 0% or infinity.
      const group = { percent: 0, new: 1, unknown: 2 }
      const category = group[a.change.kind] - group[b.change.kind]
      if (category) return category
      comparison = (a.change.percent ?? 0) - (b.change.percent ?? 0)
    } else if (sort.key === 'name') comparison = a.name.localeCompare(b.name)
    else comparison = a[sort.key] - b[sort.key]
    return (sort.direction === 'desc' ? -comparison : comparison) || a.rank - b.rank
  })
}

export function formatHoldingValue(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${Math.round(value / 1e3).toLocaleString('en-US')}K`
  return `$${Math.round(value).toLocaleString('en-US')}`
}
