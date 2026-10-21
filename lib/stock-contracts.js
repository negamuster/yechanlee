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
const money = z.object({ value: z.number(), unit: currency, label: z.string().optional() })
const eps = z.object({ value: z.number(), unit: z.string().regex(/^[A-Z]{3}\/shares$/), label: z.string().optional() })
const annualRow = z.object({
  start_date: date, end_date: date, filing_date: date, fiscal_period: z.literal('FY'),
  accounting_standard: z.enum(['us-gaap', 'ifrs-full']),
  source_filing_url: webUrl.refine(value => value.startsWith('https://www.sec.gov/Archives/edgar/data/')),
  financials: z.object({
    income_statement: z.object({ revenues: money.optional(), net_income_loss: money.optional(), diluted_earnings_per_share: eps.optional() }),
    balance_sheet: z.object({ equity: money.optional(), liabilities: money.optional() }),
  }),
}).refine(row => {
  const days = (Date.parse(row.end_date) - Date.parse(row.start_date)) / 86400000
  return days >= 300 && days <= 400 && row.filing_date >= row.end_date
})

export const stockSchemas = {
  details: z.object({ results: z.object({ ticker, name: z.string().trim().min(1), market_cap: z.number().nonnegative().nullish(), currency_name: z.string().regex(/^[a-z]{3}$/i).nullish(), primary_exchange: z.string().nullish(), list_date: date.nullish() }), sourceInfo }),
  history: z.object({ ticker, results: z.array(dailyBar).max(500), sourceInfo }),
  previous: z.object({ ticker, results: z.array(dailyBar.and(z.object({ T: ticker }))).max(10), sourceInfo }),
  news: z.object({ results: z.array(z.object({ title: z.string().trim().min(1), article_url: webUrl, published_utc: z.string().refine(value => Number.isFinite(Date.parse(value))), publisher: z.object({ name: z.string().trim().min(1) }) })).max(8), sourceInfo }),
  related: z.object({ results: z.array(z.object({ ticker })).max(100), sourceInfo }),
  financials: z.object({ symbol: ticker, source: z.literal('SEC EDGAR'), fetchedAt: timestamp, stale: z.boolean(), status: z.enum(['ok', 'not_available']), company: z.string().optional(), results: z.array(annualRow).max(2) })
    .refine(data => (data.status !== 'not_available' || !data.results.length) && data.results.every((row, index) => !index || row.end_date < data.results[index - 1].end_date)),
  chart: z.object({
    symbol: ticker, period: z.enum(CHART_PERIODS), currency, source: z.literal('Yahoo Finance'), interval: z.string().min(1).max(16),
    fetchedAt: timestamp, stale: z.boolean(), changePercent: z.number().nullable(),
    baseline: z.object({ c: z.number().positive(), t: timestamp.optional(), label: z.string().min(1) }).nullable(),
    points: z.array(z.object({ t: timestamp, c: z.number().positive() })).max(15000),
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
  if (kind === 'financials' && data.results.some(row => row.filing_date > new Date(now).toISOString().slice(0, 10))) return { code: 'future_filing', fields: ['filing_date'] }
  return null
}
