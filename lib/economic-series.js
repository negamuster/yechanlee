import { z } from 'zod'
export const DAY = 86400000
export const FRED_ECONOMIC_SERIES = Object.freeze({ cpi: 'CPIAUCNS', unemployment: 'UNRATE' })
export function economicRetrieval(series) {
  if (series.id === 'effr') return { via: 'nyfed', label: '뉴욕 연준 API', url: economicDefinitions[2].url, seriesId: 'EFFR' }
  if (series.retrievedVia === 'fred') {
    const seriesId = FRED_ECONOMIC_SERIES[series.id]
    return { via: 'fred', label: 'FRED (BLS 통계)', url: `https://fred.stlouisfed.org/series/${seriesId}`, seriesId }
  }
  const definition = economicDefinitions.find(d => d.id === series.id)
  return { via: 'bls', label: 'BLS API', url: definition.url, seriesId: definition.seriesId }
}
export const economicDefinitions = [
  { id: 'cpi', label: 'CPI 전년동월비', seriesId: 'CUUR0000SA0', provider: 'U.S. Bureau of Labor Statistics', url: 'https://www.bls.gov/cpi/', frequency: 'monthly', adjustment: '비계절조정', description: '미국 도시 소비자 전체 품목 CPI-U. 원지수(1982–84=100)에서 전년 같은 달 대비 변화를 계산합니다.' },
  { id: 'unemployment', label: '실업률', seriesId: 'LNS14000000', provider: 'U.S. Bureau of Labor Statistics', url: 'https://www.bls.gov/cps/', frequency: 'monthly', adjustment: '계절조정', description: '미국 16세 이상 민간 노동력 중 실업자의 비율(U-3)입니다.' },
  { id: 'effr', label: '연방기금 실효금리', seriesId: 'EFFR', provider: 'Federal Reserve Bank of New York', url: 'https://www.newyorkfed.org/markets/reference-rates/effr', frequency: 'daily', adjustment: '비계절조정', description: '영업일별 익일물 거래의 거래량 가중 중앙값입니다. FOMC 목표금리 범위와 구분해 읽으세요.' },
]
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v)
const timestamp = z.string().datetime()
const priorNote = z.object({ text: z.string().max(500), value: z.number().finite().nullable(), collectedAt: timestamp })
const row = z.object({ date, value: z.number().finite().nullable(), note: z.string().max(500).optional(), priorNote: priorNote.optional() })
const validValue = (id, value) => value === null || (id === 'cpi' ? value > 0 && value < 10000 : value >= 0 && value <= 100)
export const economicFailureReasonSchema = z.union([
  z.string().regex(/^http_[45]\d{2}$/),
  z.enum(['timeout', 'network_error', 'invalid_json', 'response_too_large', 'bls_request_failed', 'bls_rate_limited', 'bls_series_missing', 'bls_history_missing', 'invalid_bls_observation', 'effr_history_missing', 'invalid_effr_observation', 'invalid_fred_csv', 'fred_history_missing', 'invalid_or_regressed_series', 'unexpected_error']),
])
export const economicSnapshotSchema = z.object({ version: z.literal(1), series: z.array(z.object({
  id: z.enum(['cpi', 'unemployment', 'effr']), collectedAt: timestamp.nullable(), attemptedAt: timestamp.nullable(), error: z.literal('unavailable').nullable(), failureReason: economicFailureReasonSchema.nullable().optional(),
  retrievedVia: z.enum(['bls', 'fred', 'nyfed']).optional(), primaryFailureReason: economicFailureReasonSchema.nullable().optional(), fallbackFailureReason: economicFailureReasonSchema.nullable().optional(), observations: z.array(row).max(3000),
})).length(3) }).refine(s => s.series.every((entry, i) => entry.id === economicDefinitions[i].id && (!entry.observations.length || !!entry.collectedAt)
  && (entry.error !== null || entry.failureReason == null)
  && (!entry.retrievedVia || !!entry.collectedAt && (entry.id === 'effr' ? entry.retrievedVia === 'nyfed' : entry.retrievedVia !== 'nyfed'))
  && (entry.id !== 'effr' || entry.primaryFailureReason == null && entry.fallbackFailureReason == null)
  && (entry.error !== null || entry.fallbackFailureReason == null && (entry.retrievedVia === 'fred' ? !!entry.primaryFailureReason : entry.primaryFailureReason == null))
  && (!entry.collectedAt || !!entry.attemptedAt && entry.attemptedAt >= entry.collectedAt)
  && entry.observations.every((p, j) => (!j || p.date > entry.observations[j - 1].date)
    && (entry.id === 'effr' || p.date.endsWith('-01')) && validValue(entry.id, p.value)
    && (!p.priorNote || entry.id !== 'effr' && Date.parse(p.priorNote.collectedAt) <= Date.parse(entry.collectedAt) && validValue(entry.id, p.priorNote.value)))))
export function validEconomicSnapshot(value, now = Date.now()) {
  if (!economicSnapshotSchema.safeParse(value).success) return false
  const today = new Date(now).toISOString().slice(0, 10)
  return value.series.every(s => [s.collectedAt, s.attemptedAt].every(t => !t || Date.parse(t) <= now + 60000)
    && s.observations.every(p => p.date <= today && p.date <= s.collectedAt.slice(0, 10) && (s.id === 'effr' || p.date.slice(0, 7) < s.collectedAt.slice(0, 7))))
}
export function economicStatus(series, now = Date.now()) {
  if (!series?.collectedAt || !series.observations.length || now - Date.parse(series.collectedAt) > 30 * DAY) return 'unavailable'
  const latest = series.observations.at(-1)
  return series.error || now - Date.parse(series.collectedAt) > 2 * DAY || now - Date.parse(latest.date) > (series.id === 'effr' ? 7 : 75) * DAY ? 'stale' : 'ok'
}
export function monthOffset(date, count) {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + count); return d.toISOString().slice(0, 10)
}
// Complete the monthly grid before calculating: a missing month never means zero,
// and year-over-year always compares the same calendar month, not 12 valid rows.
export function economicPoints(series) {
  if (!series?.observations.length) return []
  if (series.id === 'effr') return series.observations.map(p => ({ ...p }))
  const raw = new Map(series.observations.map(p => [p.date, p]))
  const points = []
  for (let date = series.observations[0].date; date <= series.observations.at(-1).date; date = monthOffset(date, 1)) {
    const current = raw.get(date), previous = raw.get(monthOffset(date, -12))
    const value = series.id !== 'cpi' ? current?.value ?? null : current?.value != null && previous?.value != null ? (current.value / previous.value - 1) * 100 : null
    points.push({ date, value, ...(series.id === 'cpi' ? { index: current?.value ?? null } : {}), ...(current?.priorNote ? { priorNote: current.priorNote } : {}), note: current?.note || (value === null ? '비교에 필요한 공식 자료 미제공' : '') })
  }
  return points
}
export function economicComparison(series) {
  const points = economicPoints(series), latest = points.at(-1), previous = points.at(-2)
  return { latest, previous, change: latest?.value != null && previous?.value != null ? latest.value - previous.value : null }
}
export function economicWindow(series, years) {
  const points = economicPoints(series), latest = points.at(-1)
  if (!latest) return []
  // Inclusive monthly count; daily windows use the same calendar date in prior years.
  const from = series.id === 'effr' ? `${Number(latest.date.slice(0, 4)) - years}${latest.date.slice(4)}` : monthOffset(latest.date, -12 * years + 1)
  return points.filter(p => p.date >= from)
}
