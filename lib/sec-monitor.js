import { z } from 'zod'

export const monitorForms = ['10-K', '10-K/A', '10-Q', '10-Q/A', '8-K', '8-K/A', '20-F', '20-F/A', '40-F', '40-F/A', '6-K', '6-K/A']
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v)
const instant = z.string().datetime({ offset: true })
const filing = z.object({ accession: z.string().regex(/^\d{10}-\d{2}-\d{6}$/), form: z.enum(monitorForms), filed: date, reportDate: date.nullable(), url: z.string() })
const company = z.object({ symbol: z.string().regex(/^[A-Z0-9][A-Z0-9.-]{0,19}$/), cik: z.string().regex(/^\d{10}$/).refine(v => Number(v) > 0), name: z.string().trim().min(1).max(300),
  status: z.enum(['ok', 'stale', 'unavailable']), attemptedAt: instant, fetchedAt: instant.nullable(), coverageFrom: date.nullable(), coverageTo: date.nullable(), filings: z.array(filing).max(40) })
export const monitorSchema = z.object({ version: z.literal(1), source: z.literal('SEC EDGAR'), collector: z.literal('EdgarTools 5.62.1'), attemptedAt: instant,
  lookbackDays: z.literal(180), maxFilings: z.literal(40), companies: z.array(company).min(1).max(30) })

export function validMonitor(value, now = Date.now()) {
  const parsed = monitorSchema.safeParse(value)
  if (!parsed.success) return false
  const data = parsed.data, identities = new Set()
  if (Date.parse(data.attemptedAt) > now + 30000) return false
  return data.companies.every(c => {
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
