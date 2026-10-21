// @ts-expect-error Shared runtime validation and transformations also used by the collector/API.
import { economicDefinitions as definitions, validEconomicSnapshot, economicStatus as status, economicComparison as comparison, economicWindow as windowPoints } from '../../lib/economic-series.js'
export type EconomicId = 'cpi' | 'unemployment' | 'effr'
export interface EconomicPoint { date: string; value: number | null; index?: number | null; note?: string }
export interface EconomicSeries { id: EconomicId; collectedAt: string | null; attemptedAt: string | null; error: 'unavailable' | null; observations: EconomicPoint[] }
export interface EconomicData { version: 1; series: EconomicSeries[] }
export interface EconomicDefinition { id: EconomicId; label: string; seriesId: string; provider: string; url: string; frequency: 'monthly' | 'daily'; adjustment: string; description: string }
export const economicDefinitions = definitions as EconomicDefinition[]
export const validEconomicData = (value: unknown): value is EconomicData => validEconomicSnapshot(value)
export const economicStatus = (series: EconomicSeries): 'ok' | 'stale' | 'unavailable' => status(series)
export const economicComparison = (series: EconomicSeries): { latest?: EconomicPoint; previous?: EconomicPoint; change: number | null } => comparison(series)
export const economicWindow = (series: EconomicSeries, years: number): EconomicPoint[] => windowPoints(series, years)
export const economicDate = (date: string, daily = false) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', ...(daily ? { day: 'numeric' } : {}) }).format(new Date(`${date}T00:00:00Z`))
export const economicValue = (value: number | null | undefined) => value == null ? '미제공' : `${value.toFixed(2)}%`
export const economicChange = (value: number | null) => value == null ? '비교 불가' : `${value > 0 ? '+' : ''}${(Math.abs(value) < .000001 ? 0 : value).toFixed(2)}%p`
