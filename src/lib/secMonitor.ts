// @ts-expect-error Shared snapshot contract used by browser and collection checks.
import { validMonitor as validate } from '../../lib/sec-monitor.js'
export interface MonitoredFiling { accession: string; form: string; filed: string; reportDate: string | null; url: string }
export interface MonitoredCompany {
  aliases?: string[]; indices?: string[]; symbol: string; cik: string; name: string; status: 'ok' | 'stale' | 'unavailable'; attemptedAt: string;
  fetchedAt: string | null; coverageFrom: string | null; coverageTo: string | null; filings: MonitoredFiling[];
}
export interface SecMonitor { universe?: { checkedAt: string; sources: string[]; counts: { sp500: number; nasdaq100: number } }; version: 1; source: string; collector: string; attemptedAt: string; lookbackDays: number; maxFilings: number; companies: MonitoredCompany[] }
export function validSecMonitor(value: unknown): value is SecMonitor { return validate(value) }
export function delayedCompany(company: MonitoredCompany, now = Date.now()) {
  return company.status !== 'ok' || !company.fetchedAt || now - Date.parse(company.fetchedAt) > 6 * 3600000
}
export function formLabel(form: string) {
  return ({ '10-K': '연차 보고서', '10-Q': '분기 보고서', '8-K': '수시 보고서', '20-F': '외국기업 연차 보고서', '40-F': '캐나다기업 연차 보고서', '6-K': '외국기업 수시 보고서' } as Record<string, string>)[form.replace('/A', '')] ?? form
}
