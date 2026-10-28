import monitor from '../../config/sec-monitor.json' with { type: 'json' }
import type { StockMatch } from './stockSearch.ts'

// Reviewed SEC identities; keep share-class tickers distinct for exact navigation.
export const searchCompanies: StockMatch[] = monitor.companies.flatMap(company => company.aliases.map(ticker => ({ ticker, name: company.name, primary_exchange: '공시 모니터 대상 기업' })))
export const searchCompanyCount = monitor.companies.length
export const searchCompaniesCheckedAt = monitor.universe.checkedAt
