import { z } from 'zod'
import { CHART_PERIODS } from './stock-chart-periods.js'

const ticker = z.string().regex(/^[A-Z0-9][A-Z0-9.:-]{0,19}$/)
const timestamp = z.number().positive()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value)
const currency = z.string().regex(/^[A-Z]{3}$/)
const webUrl = z.string().url().refine(value => /^https?:\/\//.test(value))
const sourceInfo = z.object({ source: z.literal('Polygon / Massive'), fetchedAt: timestamp, stale: z.boolean() }).optional()
const dailyBar = z.object({ t: timestamp, o: z.number().positive(), h: z.number().positive(), l: z.number().positive(), c: z.number().positive() })
  .refine(bar => bar.h >= Math.max(bar.o, bar.c, bar.l) && bar.l <= Math.min(bar.o, bar.c))
const filingUrl = webUrl.refine(value => value.startsWith('https://www.sec.gov/Archives/edgar/data/'))
const financialForm = z.enum(['10-K', '10-K/A', '10-Q', '10-Q/A', '20-F', '20-F/A', '40-F', '40-F/A'])
const financialSource = z.object({ accession: z.string().regex(/^\d{10}-\d{2}-\d{6}$/), form: financialForm,
  filing_date: date, start_date: date.optional(), end_date: date, tag: z.string().min(1), value: z.number(), unit: z.string().regex(/^[A-Z]{3}(?:\/shares)?$/), url: filingUrl, revised: z.boolean() })
  .refine(source => source.filing_date >= source.end_date && (!source.start_date || source.start_date <= source.end_date))
const money = z.object({ value: z.number(), unit: currency, label: z.string().optional(), basis: z.enum(['ppe', 'productive_assets']).optional(), calculation: z.enum(['difference', 'sum', 'ocf_minus_capex']).optional(), sources: z.array(financialSource).min(1).max(32).optional() })
  .refine(value => !value.sources || value.sources.every(source => source.unit === value.unit))
const eps = z.object({ value: z.number(), unit: z.string().regex(/^[A-Z]{3}\/shares$/), label: z.string().optional() })
const financialRow = period => z.object({
  start_date: date, end_date: date, filing_date: date, fiscal_period: z.literal(period),
  accounting_standard: z.enum(['us-gaap', 'ifrs-full']),
  source_filing_url: filingUrl, form: financialForm.optional(), amended: z.boolean().optional(), calculated: z.boolean().optional(),
  financials: z.object({
    income_statement: z.object({ revenues: money.optional(), operating_income_loss: money.optional(), net_income_loss: money.optional(), diluted_earnings_per_share: eps.optional() }),
    balance_sheet: z.object({ equity: money.optional(), liabilities: money.optional() }),
    cash_flow_statement: z.object({ operating_cash_flow: money.optional(), capital_expenditures: money.refine(v => v.value >= 0).optional(), free_cash_flow: money.optional() }).optional(),
  }),
}).refine(row => {
  const days = (Date.parse(row.end_date) - Date.parse(row.start_date)) / 86400000
  const cash = row.financials.cash_flow_statement
  return days >= (period === 'Q' ? 70 : 300) && days <= (period === 'Q' ? 110 : 400) && row.filing_date >= row.end_date
    && (!cash?.free_cash_flow || cash.operating_cash_flow && cash.capital_expenditures && cash.free_cash_flow.unit === cash.operating_cash_flow.unit && cash.free_cash_flow.unit === cash.capital_expenditures.unit
      && cash.free_cash_flow.basis === cash.capital_expenditures.basis && Math.abs(cash.free_cash_flow.value - (cash.operating_cash_flow.value - cash.capital_expenditures.value)) <= Math.max(0.01, Math.abs(cash.free_cash_flow.value) * 1e-12))
})
const descending = rows => rows.every((row, index) => !index || row.end_date < rows[index - 1].end_date)
const financialField = (row, key) => row.financials.income_statement[key] ?? row.financials.cash_flow_statement?.[key]
function validTtm(data) {
  const trailing = data.ttm?.[0]
  if (!trailing) return true
  const quarters = data.quarterly?.slice(0, 4) || []
  if (quarters.length !== 4 || trailing.start_date !== quarters[3].start_date || trailing.end_date !== quarters[0].end_date
    || quarters.some((row, i) => row.accounting_standard !== trailing.accounting_standard || i && Date.parse(quarters[i - 1].start_date) - Date.parse(row.end_date) !== 86400000)
    || trailing.financials.income_statement.diluted_earnings_per_share) return false
  return ['revenues', 'operating_income_loss', 'net_income_loss', 'operating_cash_flow', 'capital_expenditures', 'free_cash_flow'].every(key => {
    const value = financialField(trailing, key)
    if (!value) return true
    const components = quarters.map(row => financialField(row, key))
    return components.every(v => v && v.unit === value.unit && v.basis === value.basis) && Math.abs(value.value - components.reduce((sum, v) => sum + v.value, 0)) <= Math.max(.01, Math.abs(value.value) * 1e-12)
  })
}

export const stockSchemas = {
  details: z.object({ results: z.object({ ticker, name: z.string().trim().min(1), market_cap: z.number().nonnegative().nullish(), currency_name: z.string().regex(/^[a-z]{3}$/i).nullish(), primary_exchange: z.string().nullish(), list_date: date.nullish() }), sourceInfo }),
  history: z.object({ ticker, results: z.array(dailyBar).max(500), sourceInfo }),
  previous: z.object({ ticker, results: z.array(dailyBar.and(z.object({ T: ticker }))).max(10), sourceInfo }),
  news: z.object({ results: z.array(z.object({ title: z.string().trim().min(1), article_url: webUrl, published_utc: z.string().refine(value => Number.isFinite(Date.parse(value))), publisher: z.object({ name: z.string().trim().min(1) }) })).max(8), sourceInfo }),
  related: z.object({ results: z.array(z.object({ ticker })).max(100), sourceInfo }),
  financials: z.object({ symbol: ticker, source: z.literal('SEC EDGAR'), fetchedAt: timestamp, stale: z.boolean(), status: z.enum(['ok', 'not_available']), company: z.string().optional(),
    results: z.array(financialRow('FY')).max(5), quarterly: z.array(financialRow('Q')).max(8).optional(), ttm: z.array(financialRow('TTM')).max(1).optional() })
    .refine(data => [data.results, data.quarterly || [], data.ttm || []].every(rows => descending(rows) && (data.status !== 'not_available' || !rows.length)) && validTtm(data)),
  chart: z.object({
    symbol: ticker, period: z.enum(CHART_PERIODS), currency, source: z.literal('Yahoo Finance'), interval: z.string().min(1).max(16),
    fetchedAt: timestamp, stale: z.boolean(), changePercent: z.number().nullable(),
    baseline: z.object({ c: z.number().positive(), t: timestamp.optional(), label: z.string().min(1) }).nullable(),
    points: z.array(z.object({ t: timestamp, c: z.number().positive(), o: z.number().positive().optional(), h: z.number().positive().optional(), l: z.number().positive().optional(), v: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional() }).refine(p => [p.o, p.h, p.l].every(v => v === undefined) || [p.o, p.h, p.l].every(v => v !== undefined) && p.h >= Math.max(p.o, p.c, p.l) && p.l <= Math.min(p.o, p.c))).max(15000),
  }).refine(data => data.points.every((point, index) => !index || point.t > data.points[index - 1].t)),
}

// Report only fixed field paths/codes, never raw upstream bodies or values.
export function stockPayloadIssue(kind, data, { symbol, period, now = Date.now() } = {}) {
  const identity = kind === 'details' ? data?.results?.ticker : ['history', 'previous'].includes(kind) ? data?.ticker : ['financials', 'chart'].includes(kind) ? data?.symbol : undefined
  if (symbol && typeof identity === 'string' && identity !== symbol) return { code: 'symbol_mismatch', fields: [kind === 'details' ? 'results.ticker' : 'symbol'] }
  const result = stockSchemas[kind].safeParse(data)
  if (!result.success) return { code: 'invalid_response', fields: [...new Set(result.error.issues.slice(0, 3).map(issue => issue.path.join('.') || 'response'))] }
  if (kind === 'previous' && symbol && data.results.some(row => row.T !== symbol)) return { code: 'symbol_mismatch', fields: ['results.T'] }
  if (kind === 'chart' && period && data.period !== period) return { code: 'period_mismatch', fields: ['period'] }
  const fetchedAt = data.sourceInfo?.fetchedAt ?? data.fetchedAt
  if (fetchedAt > now + 30000) return { code: 'future_timestamp', fields: ['fetchedAt'] }
  if (kind === 'chart' && data.points.some(point => point.t > now + 30000)) return { code: 'future_observation', fields: ['points.t'] }
  if (kind === 'financials' && [...data.results, ...(data.quarterly || []), ...(data.ttm || [])].some(row => row.filing_date > new Date(now).toISOString().slice(0, 10)
    || Object.values(row.financials).some(statement => statement && Object.values(statement).some(value => value?.sources?.some(source => source.filing_date > new Date(now).toISOString().slice(0, 10)))))) return { code: 'future_filing', fields: ['filing_date'] }
  return null
}
