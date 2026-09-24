import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { json } from './api-guards.js'
const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false, ignoreAttributes: true })
const CIKS = new Set(['0001061768','0000200217','0001040273','0001067983','0002012383','0000102909','0000093751','0001350694','0001423053','0001037389','0001536411','0002026053','0001656456','0001029160','0001697748','0001709323','0001649339'])
const array = x => x == null ? [] : Array.isArray(x) ? x : [x]
const numeric = value => {
  if (value == null || !/^\d+(\.\d+)?$/.test(String(value).replaceAll(',', '').trim())) throw new Error('invalid_number')
  const result = Number(String(value).replaceAll(',', ''))
  if (!Number.isFinite(result) || result < 0) throw new Error('invalid_number')
  return result
}
function xml(text) {
  if (XMLValidator.validate(text) !== true) throw new Error('invalid_xml')
  return parser.parse(text)
}
export function parseCover(text, filedAt) {
  const root = xml(text).edgarSubmission
  const cover = root?.formData?.coverPage, summary = root?.formData?.summaryPage
  if (!cover || !summary) throw new Error('missing_summary')
  const multiplier = filedAt < '2023-01-03' ? 1000 : 1
  return { period: String(cover.reportCalendarOrQuarter || ''),
    amendment: String(cover.amendmentInfo?.amendmentType || '').toUpperCase(),
    reportedTotal: numeric(summary.tableValueTotal) * multiplier,
    reportedCount: numeric(summary.tableEntryTotal), multiplier }
}
export function parseTable(text, multiplier = 1) {
  const root = xml(text).informationTable
  if (!root) throw new Error('missing_information_table')
  return array(root.infoTable).map(entry => {
    const cusip = String(entry.cusip || '').trim(), name = String(entry.nameOfIssuer || '').trim()
    const title = String(entry.titleOfClass || '').trim(), type = String(entry.shrsOrPrnAmt?.sshPrnamtType || '').trim().toUpperCase()
    if (!name || !cusip || !title || !['SH','PRN'].includes(type)) throw new Error('invalid_holding')
    return { key: `${cusip}|${title}|${type}`, cusip, name, title, type,
      putCall: String(entry.putCall || '').trim().toUpperCase(),
      shares: numeric(entry.shrsOrPrnAmt.sshPrnamt), value: numeric(entry.value) * multiplier }
  })
}
export function verifyTable(cover, rows) {
  const parsedTotal = rows.reduce((sum, row) => sum + row.value, 0)
  if (rows.length !== cover.reportedCount || Math.abs(parsedTotal - cover.reportedTotal) > 0.01) throw new Error('summary_mismatch')
  return { reportedTotal: cover.reportedTotal, parsedTotal, reportedCount: cover.reportedCount, parsedCount: rows.length }
}
export function combineFilings(filings) {
  let rows = null
  for (const filing of filings) {
    if (filing.form === '13F-HR' || filing.amendment === 'RESTATEMENT') rows = filing.rows
    else if (filing.amendment === 'NEW HOLDINGS' && rows) rows = [...rows, ...filing.rows]
    else throw new Error('unsupported_amendment')
  }
  if (!rows) throw new Error('missing_base_filing')
  const holdings = new Map()
  let excludedValue = 0
  for (const row of rows) {
    if (row.putCall || row.type !== 'SH') { excludedValue += row.value; continue }
    const previous = holdings.get(row.key)
    holdings.set(row.key, previous ? { ...previous, shares: previous.shares + row.shares, value: previous.value + row.value } : { ...row })
  }
  return { holdings: [...holdings.values()].sort((a, b) => b.value - a.value), excludedValue,
    reportedTotal: rows.reduce((sum, row) => sum + row.value, 0) }
}
export function submissionRecords(data) {
  return array(data.form).flatMap((form, i) => {
    if (!['13F-HR','13F-HR/A'].includes(form)) return []
    const period = data.reportDate?.[i], accession = data.accessionNumber?.[i], filedAt = data.filingDate?.[i], primary = data.primaryDocument?.[i]
    if (!/^\d{4}-\d{2}-\d{2}$/.test(period || '') || !/^\d{10}-\d{2}-\d{6}$/.test(accession || '') || !/^\d{4}-\d{2}-\d{2}$/.test(filedAt || '')) throw new Error('invalid_filing_metadata')
    return [{ form, period, accession, filedAt, primary: primary || '', acceptedAt: data.acceptanceDateTime?.[i] || filedAt }]
  })
}
export function previousQuarter(period) {
  const date = new Date(`${period}T00:00:00Z`)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 2, 0)).toISOString().slice(0, 10)
}
// Shared request queue avoids bursts within a server instance.
let queue = Promise.resolve()
let nextStart = 0
async function pacedFetch(fetchImpl, url, signal) {
  const start = queue.then(async () => {
    const delay = Math.max(0, nextStart - Date.now())
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
    nextStart = Date.now() + 250
  })
  queue = start.catch(() => {})
  await start
  const response = await fetchImpl(url, { headers: { 'User-Agent': 'Anthracite yechan030102@gmail.com', Accept: 'application/json, application/xml, text/html' }, signal, redirect: 'error' })
  if (!response.ok) throw new Error(response.status === 429 ? 'sec_rate_limited' : 'sec_unavailable')
  return response.text()
}
export async function collect13F(cik, { fetchImpl = fetch, now = Date.now(), signal } = {}) {
  const get = url => pacedFetch(fetchImpl, url, signal)
  const sub = JSON.parse(await get(`https://data.sec.gov/submissions/CIK${cik}.json`))
  let records = submissionRecords(sub.filings?.recent || {})
  const periods = () => [...new Set(records.map(r => r.period))].sort().reverse()
  // Read older metadata if the current list does not contain both reporting quarters.
  for (const file of (sub.filings?.files || []).slice(0, 5)) {
    if (periods().length >= 2) break
    if (!/^CIK\d{10}-submissions-\d+\.json$/.test(file.name)) throw new Error('invalid_filing_metadata')
    records.push(...submissionRecords(JSON.parse(await get(`https://data.sec.gov/submissions/${file.name}`))))
  }
  records = [...new Map(records.map(r => [r.accession, r])).values()]
  const period = periods()[0]
  if (!period) throw new Error('no_filings')
  async function loadPeriod(target) {
    const selected = records.filter(r => r.period === target).sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt) || a.accession.localeCompare(b.accession))
    if (!selected.length || selected.length > 12) throw new Error('missing_base_filing')
    const filings = []
    for (const record of selected) {
      const base = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${record.accession.replaceAll('-', '')}`
      const primaryName = record.primary.split('/').pop()
      if (!/^[\w.-]+\.xml$/i.test(primaryName)) throw new Error('unsupported_filing_format')
      const coverUrl = `${base}/${primaryName}`
      const cover = parseCover(await get(coverUrl), record.filedAt)
      const normalized = /^\d{2}-\d{2}-\d{4}$/.test(cover.period) ? `${cover.period.slice(6)}-${cover.period.slice(0, 2)}-${cover.period.slice(3, 5)}` : cover.period
      if (normalized !== target) throw new Error('period_mismatch')
      const indexUrl = `${base}/${record.accession}-index.htm`
      const index = await get(indexUrl)
      const links = new Set()
      for (const row of index.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []) {
        if (!/INFORMATION TABLE/i.test(row)) continue
        for (const match of row.matchAll(/href=["']([^"']+\.xml)["']/gi)) {
          const name = match[1].split('/').pop()
          if (/^[\w.-]+\.xml$/i.test(name) && name !== primaryName) links.add(`${base}/${name}`)
        }
      }
      if (links.size === 0 && cover.reportedCount !== 0) throw new Error('missing_information_table')
      const rows = []
      for (const url of links) rows.push(...parseTable(await get(url), cover.multiplier))
      const verification = verifyTable(cover, rows)
      filings.push({ ...record, ...cover, rows, indexUrl, coverUrl, tableUrls: [...links], verification })
    }
    return { ...combineFilings(filings), filings }
  }
  const current = await loadPeriod(period)
  let previous = null
  const previousPeriod = previousQuarter(period)
  try { previous = await loadPeriod(previousPeriod) } catch { /* explicitly unknown, never new holdings */ }
  const previousMap = new Map(previous?.holdings.map(h => [h.key, h.shares]) || [])
  const totalValue = current.holdings.reduce((sum, h) => sum + h.value, 0)
  const holdings = current.holdings.map(h => ({ ...h, pct: totalValue ? Math.round(h.value / totalValue * 1000) / 10 : 0,
    ...(previous ? { prevShares: previousMap.get(h.key) ?? 0 } : {}) }))
  return { period, previousPeriod, previousAvailable: !!previous, filedAt: current.filings.at(-1).filedAt,
    totalValue, excludedValue: current.excludedValue, reportedTotal: current.reportedTotal,
    holdingCount: holdings.length, holdings: holdings.slice(0, 30), checkedAt: now,
    sources: current.filings.map(({ accession, form, indexUrl, coverUrl, tableUrls, verification }) => ({ accession, form, indexUrl, coverUrl, tableUrls, ...verification })),
    verification: 'matched', managerName: sub.name, stale: false }
}
export function create13FHandler({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map(), retry = new Map()
  return async req => {
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
    const cik = new URL(req.url).searchParams.get('cik')
    if (!CIKS.has(cik)) return json({ error: 'Unknown institution' }, 400)
    const existing = cache.get(cik)
    if (existing && now() - existing.checkedAt < 15 * 60000) return json(existing)
    if ((retry.get(cik) || 0) > now()) return existing ? json({ ...existing, stale: true }) : json({ error: 'SEC 재조회 대기 중입니다. 잠시 후 다시 시도해 주세요.' }, 503)
    if (!pending.has(cik)) {
      const task = collect13F(cik, { fetchImpl, now: now(), signal: AbortSignal.timeout(55000) }).then(data => { cache.set(cik, data); return data })
        .catch(() => { retry.set(cik, now() + 60000); return null }).finally(() => pending.delete(cik))
      pending.set(cik, task)
    }
    const result = await pending.get(cik)
    if (result) return json(result)
    if (existing) return json({ ...existing, stale: true })
    return json({ error: 'SEC 공시를 가져오거나 원문 합계를 검증하지 못했습니다. 원문을 확인하거나 잠시 후 다시 시도해 주세요.' }, 503)
  }
}
