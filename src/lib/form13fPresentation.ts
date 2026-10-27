import { portfolioPercent } from './financialMath.ts'

export interface Holding {
  name: string; shares: number; value: number; prevShares?: number; pct?: number; cusip: string; title: string
}
export interface FilingData {
  period: string; availablePeriods: string[]; previousPeriod: string; previousAvailable: boolean
  filedAt?: string; checkedAt?: number; stale?: boolean; verification: string
  totalValue: number; reportedTotal?: number; excludedValue?: number; holdingCount: number; holdingsComplete: true
  holdings: Holding[]; closedHoldings: Holding[]
  sources?: { accession: string; form: string; indexUrl: string; reportedTotal: number; parsedTotal: number; reportedCount: number; parsedCount: number }[]
  previousSources?: { accession: string; indexUrl: string }[]
}
const periodPattern = /^\d{4}-(03-31|06-30|09-30|12-31)$/
export function isFiling(value: unknown): value is FilingData {
  const data = value as FilingData | null
  const validHolding = (h: Holding) => !!h && typeof h.name === 'string' && typeof h.cusip === 'string' && !!h.cusip.trim()
    && typeof h.title === 'string' && Number.isFinite(h.shares) && h.shares >= 0 && Number.isFinite(h.value) && h.value >= 0
    && (h.prevShares === undefined || Number.isFinite(h.prevShares) && h.prevShares >= 0)
  return !!data && data.verification === 'matched' && data.holdingsComplete === true && periodPattern.test(data.period)
    && Array.isArray(data.availablePeriods) && data.availablePeriods.includes(data.period) && data.availablePeriods.every(p => periodPattern.test(p))
    && periodPattern.test(data.previousPeriod) && Number.isFinite(data.totalValue) && data.totalValue >= 0 && typeof data.previousAvailable === 'boolean'
    && Array.isArray(data.holdings) && data.holdingCount === data.holdings.length && data.holdings.every(validHolding)
    && Math.abs(data.holdings.reduce((sum, h) => sum + h.value, 0) - data.totalValue) < 0.01
    && Array.isArray(data.closedHoldings) && data.closedHoldings.every(h => validHolding(h) && h.shares === 0 && h.value === 0 && (h.prevShares ?? 0) > 0)
    && new Set(data.holdings.map(h => h.cusip.toUpperCase())).size === data.holdings.length
    && new Set([...data.holdings, ...data.closedHoldings].map(h => h.cusip.toUpperCase())).size === data.holdings.length + data.closedHoldings.length
    && (data.previousAvailable ? data.holdings.every(h => h.prevShares !== undefined) : data.closedHoldings.length === 0 && data.holdings.every(h => h.prevShares === undefined))
}
export type HoldingFilter = 'current' | 'all' | 'new' | 'increased' | 'decreased' | 'unchanged' | 'closed' | 'unknown'
export const HOLDING_FILTERS: { value: HoldingFilter; label: string }[] = [
  { value: 'current', label: '현재 공시 전체' }, { value: 'all', label: '전량 미기재 포함' },
  { value: 'new', label: '신규 기재' }, { value: 'increased', label: '수량 증가' }, { value: 'decreased', label: '수량 감소' },
  { value: 'unchanged', label: '수량 동일' }, { value: 'closed', label: '전량 미기재' }, { value: 'unknown', label: '비교 자료 없음' },
]
export function holdingStatus(h: Holding): Exclude<HoldingFilter, 'current' | 'all'> {
  if (h.prevShares == null) return 'unknown'
  if (h.prevShares > 0 && h.shares === 0) return 'closed'
  if (h.prevShares === 0 && h.shares > 0) return 'new'
  return h.shares > h.prevShares ? 'increased' : h.shares < h.prevShares ? 'decreased' : 'unchanged'
}
export function filteredHoldings(filing: FilingData, filter: HoldingFilter) {
  const rows = filter === 'all' || filter === 'closed' ? [...filing.holdings, ...filing.closedHoldings] : filing.holdings
  return filter === 'all' || filter === 'current' ? rows : rows.filter(h => holdingStatus(h) === filter)
}

export function compareFilings(left: FilingData, right: FilingData) {
  if (!isFiling(left) || !isFiling(right) || left.period !== right.period) throw new Error('incomparable_filings')
  // A CUSIP represents a security/share class. Do not join by issuer name or descriptive title.
  const index = (filing: FilingData) => {
    const map = new Map<string, Holding>()
    for (const h of filing.holdings) {
      const key = h.cusip.trim().toUpperCase(), prior = map.get(key)
      map.set(key, prior ? { ...prior, value: prior.value + h.value, shares: prior.shares + h.shares } : h)
    }
    return map
  }
  const a = index(left), b = index(right)
  return [...new Set([...a.keys(), ...b.keys()])].map(cusip => {
    const l = a.get(cusip) ?? null, r = b.get(cusip) ?? null
    const leftPct = left.totalValue && l ? l.value / left.totalValue * 100 : 0
    const rightPct = right.totalValue && r ? r.value / right.totalValue * 100 : 0
    return { cusip, name: (l ?? r)!.name, title: (l ?? r)!.title, left: l, right: r, leftPct, rightPct, difference: leftPct - rightPct }
  }).sort((a, b) => Math.max(b.leftPct, b.rightPct) - Math.max(a.leftPct, a.rightPct) || a.cusip.localeCompare(b.cusip))
}

export function csvDocument(rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    // Prevent spreadsheet formulas from upstream names; preserve numeric values as numbers.
    let text = String(value)
    if (typeof value === 'string' && (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
export const csvIdentifier = (value: string) => `'${value}`
export function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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

export function holdingMatchesQuery(holding: Pick<Holding, 'name' | 'title' | 'cusip'>, query: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const text = `${holding.name} ${holding.title} ${holding.cusip}`.toLocaleLowerCase()
  const tokens = text.split(/[^\p{L}\p{N}]+/u)
  return words.every(word => words.length > 1 && word.length === 1 ? tokens.includes(word) : text.includes(word))
}
export interface HoldingRow extends Holding {
  rank: number; pct: number; change: ReturnType<typeof holdingChange>
}
// Return ties as zero so a table can apply a secondary sort before portfolio rank.
export function compareHoldingRows(a: HoldingRow, b: HoldingRow, sort: HoldingSort) {
  let comparison: number
  if (sort.key === 'change') {
    const group = { percent: 0, new: 1, unknown: 2 }
    const category = group[a.change.kind] - group[b.change.kind]
    if (category) return category
    comparison = (a.change.percent ?? 0) - (b.change.percent ?? 0)
  } else if (sort.key === 'name') comparison = a.name.localeCompare(b.name)
  else if (sort.key === 'pct') comparison = a.value - b.value
  else comparison = a[sort.key] - b[sort.key]
  return sort.direction === 'desc' ? -comparison : comparison
}
export function holdingRows(holdings: Holding[], total: number, query: string, sort?: HoldingSort): HoldingRow[] {
  // Keep the original portfolio rank and denominator through filtering and sorting.
  const rows = holdings.map((holding, index) => ({ ...holding, rank: index + 1, pct: portfolioPercent(holding.value, total), change: holdingChange(holding) }))
    .filter(holding => holdingMatchesQuery(holding, query))
  return sort ? rows.sort((a, b) => compareHoldingRows(a, b, sort) || a.rank - b.rank) : rows
}

export function formatHoldingValue(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${Math.round(value / 1e3).toLocaleString('en-US')}K`
  return `$${Math.round(value).toLocaleString('en-US')}`
}

export function formatHoldingPercent(value: number, fixed = false): string {
  if (value > 0 && value < 0.01) return '<0.01%'
  return value.toLocaleString('en-US', { minimumFractionDigits: fixed ? 2 : 0, maximumFractionDigits: 2 }) + '%'
}
