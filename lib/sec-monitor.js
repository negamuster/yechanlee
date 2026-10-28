import { z } from 'zod'

export const monitorForms = ['10-K', '10-K/A', '10-Q', '10-Q/A', '8-K', '8-K/A', '20-F', '20-F/A', '40-F', '40-F/A', '6-K', '6-K/A']
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v)
const instant = z.string().datetime({ offset: true })
const filing = z.object({ accession: z.string().regex(/^\d{10}-\d{2}-\d{6}$/), form: z.enum(monitorForms), filed: date, reportDate: date.nullable(), url: z.string() })
const company = z.object({ symbol: z.string().regex(/^[A-Z0-9][A-Z0-9.-]{0,19}$/), cik: z.string().regex(/^\d{10}$/).refine(v => Number(v) > 0), name: z.string().trim().min(1).max(300),
  aliases: z.array(z.string().regex(/^[A-Z0-9][A-Z0-9.-]{0,19}$/)).min(1).max(10).optional(), indices: z.array(z.enum(['sp500', 'nasdaq100', 'additional'])).min(1).max(3).optional(), status: z.enum(['ok', 'stale', 'unavailable']), attemptedAt: instant, fetchedAt: instant.nullable(), coverageFrom: date.nullable(), coverageTo: date.nullable(), filings: z.array(filing).max(40) })
export const monitorSchema = z.object({ version: z.literal(1), source: z.literal('SEC EDGAR'), collector: z.literal('EdgarTools 5.62.1'), attemptedAt: instant,
  lookbackDays: z.literal(180), maxFilings: z.literal(40), universe: z.object({ checkedAt: instant, sources: z.tuple([z.literal('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'), z.literal('https://en.wikipedia.org/wiki/List_of_NASDAQ-100_companies')]), identitySource: z.literal('https://www.sec.gov/files/company_tickers.json'), counts: z.object({ sp500: z.number().int().min(490).max(520), nasdaq100: z.number().int().min(95).max(110) }), refreshMode: z.literal('reviewed-snapshot') }).optional(), companies: z.array(company).min(1).max(650) })

export function validMonitor(value, now = Date.now()) {
  const parsed = monitorSchema.safeParse(value)
  if (!parsed.success) return false
  const data = parsed.data, identities = new Set(), ciks = new Set(), aliases = new Set()
  if (Date.parse(data.attemptedAt) > now + 30000) return false
  if (data.universe && (Date.parse(data.universe.checkedAt) > now + 30000 || ['sp500', 'nasdaq100'].some(index => data.companies.filter(c => c.indices?.includes(index)).reduce((n, c) => n + (c.aliases?.length ?? 0), 0) !== data.universe.counts[index]))) return false
  return data.companies.every(c => {
    if (ciks.has(c.cik)) return false
    ciks.add(c.cik)
    if (data.universe && (!c.aliases || !c.indices)) return false
    if (c.aliases && (!c.aliases.includes(c.symbol) || c.aliases.some(a => aliases.has(a)) || new Set(c.aliases).size !== c.aliases.length)) return false
    for (const a of c.aliases ?? [c.symbol]) aliases.add(a)
    if (identities.has(c.symbol) || Date.parse(c.attemptedAt) > Date.parse(data.attemptedAt)) return false
    identities.add(c.symbol)
    if (c.status === 'unavailable') return c.fetchedAt === null && c.coverageFrom === null && c.coverageTo === null && !c.filings.length
    if (!c.fetchedAt || !c.coverageFrom || !c.coverageTo || c.coverageFrom > c.coverageTo || c.coverageTo > c.fetchedAt.slice(0, 10)
      || Date.parse(c.fetchedAt) > Date.parse(c.attemptedAt) || c.status === 'ok' && c.fetchedAt !== c.attemptedAt) return false
    const accessions = new Set()
    return c.filings.every((f, i) => {
      const expected = `https://www.sec.gov/Archives/edgar/data/${Number(c.cik)}/${f.accession.replaceAll('-', '')}/${f.accession}-index.html`
      if (accessions.has(f.accession) || f.url !== expected || f.filed < c.coverageFrom || f.filed > c.coverageTo || f.reportDate && f.reportDate > f.filed) return false
      accessions.add(f.accession)
      const prev = c.filings[i - 1]
      return !prev || f.filed < prev.filed || f.filed === prev.filed && f.accession < prev.accession
    })
  })
}

export function monitorIdentity({ symbol, cik, name, aliases, indices }) { return { symbol, cik, name, ...(aliases ? { aliases, indices } : {}) } }
