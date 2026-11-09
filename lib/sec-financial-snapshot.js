import { stockPayloadIssue } from './stock-contracts.js'
export const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json'
export const factsUrl = cik => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`
export const FINANCIAL_RETENTION = 7 * 86400000

// The snapshot is produced by the same converter as live responses. Validate the
// existing contracts plus filing issuer paths before accepting a stored record.
export function validFinancialRecord(data, symbol, now = Date.now()) {
  // Treat corrupt stored data as unavailable even if an optional provenance
  // field is malformed in a way the shared UI contract does not inspect.
  try { return validateRecord(data, symbol, now) } catch { return false }
}
function validateRecord(data, symbol, now) {
  if (!data || data.symbol !== symbol || !/^\d{10}$/.test(data.cik || '') || Number(data.cik) <= 0
    || data.tickerSource !== SEC_TICKERS_URL || data.factsUrl !== factsUrl(data.cik)
    || data.stale !== false || stockPayloadIssue('financials', data, { symbol, now })) return false
  const validUrl = url => {
    const match = String(url).match(/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/(\d+)\/(\d{18})\/(\d{10}-\d{2}-\d{6})-index\.html$/)
    return match && Number(match[1]) === Number(data.cik) && match[2] === match[3].replaceAll('-', '')
  }
  return [...data.results, ...(data.quarterly || []), ...(data.ttm || [])].every(row => validUrl(row.source_filing_url)
    && Object.values(row.financials).filter(Boolean).flatMap(section => Object.values(section).filter(Boolean))
      .every(value => Array.isArray(value.sources) && value.sources.length > 0 && value.sources.every(source => validUrl(source?.url) && source.url.endsWith(`/${source.accession}-index.html`))))
}
export function financialSnapshotRecord(snapshot, symbol, now = Date.now()) {
  if (snapshot?.version !== 1) return null
  const data = snapshot.companies?.[symbol]
  if (!validFinancialRecord(data, symbol, now) || now < data.fetchedAt || now - data.fetchedAt > FINANCIAL_RETENTION) return null
  return data
}
