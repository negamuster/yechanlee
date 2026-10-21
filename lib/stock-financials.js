import { json, createLimiter, clientId, crossSite } from './api-guards.js'

const DAY = 86400000
const ANNUAL_FORMS = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A'])
const tags = {
  'us-gaap': {
    revenues: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
    net_income_loss: ['NetIncomeLoss', 'ProfitLoss'], diluted_earnings_per_share: ['EarningsPerShareDiluted'],
    equity: ['StockholdersEquity'], liabilities: ['Liabilities'],
  },
  'ifrs-full': { revenues: ['Revenue'], net_income_loss: ['ProfitLoss'], diluted_earnings_per_share: ['DilutedEarningsLossPerShare'], equity: ['EquityAttributableToOwnersOfParent'], liabilities: ['Liabilities'] },
}
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const tickerKey = value => value.replaceAll('.', '-').toUpperCase()

function namespaceFinancials(data, cik, namespace, now) {
  const today = new Date(now).toISOString().slice(0, 10)
  const facts = data.facts[namespace], definition = tags[namespace]
  function records(field) {
    return definition[field].flatMap((tag, priority) => Object.entries(facts[tag]?.units || {}).flatMap(([unit, rows]) => Array.isArray(rows) ? rows.filter(row => row && ANNUAL_FORMS.has(row.form)
      && date(row.end) && row.end <= today && date(row.filed) && row.filed <= today && /^\d{10}-\d{2}-\d{6}$/.test(row.accn || '') && Number.isFinite(row.val)
      && (field === 'diluted_earnings_per_share' ? /^[A-Z]{3}\/shares$/.test(unit) : /^[A-Z]{3}$/.test(unit)))
      .map(row => ({ ...row, unit, tag, priority })) : []))
  }
  const duration = row => date(row.start) && (Date.parse(row.end) - Date.parse(row.start)) / DAY >= 300 && (Date.parse(row.end) - Date.parse(row.start)) / DAY <= 400
  const all = Object.fromEntries(Object.keys(definition).map(field => [field, records(field)]))
  const anchors = [...all.revenues, ...all.net_income_loss, ...all.diluted_earnings_per_share].filter(duration)
    .sort((a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed) || b.accn.localeCompare(a.accn))
  const periods = []
  for (const anchor of anchors) {
    if (periods.some(period => period.end_date === anchor.end)) continue
    // Keep all values in a row on the same fiscal period AND filing accession.
    const take = (field, instant = false) => {
      const candidates = all[field].filter(row => row.accn === anchor.accn && row.end === anchor.end && (instant ? !row.start : row.start === anchor.start && duration(row)))
      candidates.sort((a, b) => a.priority - b.priority)
      if (!candidates.length) return undefined
      const first = candidates[0], equivalent = candidates.filter(row => row.priority === first.priority)
      // Ambiguous units or conflicting facts are left unconfirmed.
      if (equivalent.some(row => row.unit !== first.unit || row.val !== first.val)) return undefined
      return { value: first.val, unit: first.unit, label: first.tag }
    }
    periods.push({ start_date: anchor.start, end_date: anchor.end, filing_date: anchor.filed, fiscal_period: 'FY', accounting_standard: namespace,
      source_filing_url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${anchor.accn.replaceAll('-', '')}/${anchor.accn}-index.html`,
      financials: { income_statement: { revenues: take('revenues'), net_income_loss: take('net_income_loss'), diluted_earnings_per_share: take('diluted_earnings_per_share') }, balance_sheet: { equity: take('equity', true), liabilities: take('liabilities', true) } } })
    if (periods.length === 2) break
  }
  return periods
}

export function annualFinancials(data, cik, now = Date.now()) {
  if (Number(data?.cik) !== Number(cik) || !data?.facts) throw new Error('Company mismatch')
  const rows = Object.keys(tags).filter(namespace => data.facts[namespace]).flatMap(namespace => namespaceFinancials(data, cik, namespace, now))
    .sort((a, b) => b.end_date.localeCompare(a.end_date) || b.filing_date.localeCompare(a.filing_date))
  const seen = new Set()
  return rows.filter(row => { if (seen.has(row.end_date)) return false; seen.add(row.end_date); return true }).slice(0, 2)
}

// SEC fair-access pacing is shared by financial requests in this instance.
let queue = Promise.resolve(), nextStart = 0
async function secJson(fetcher, url, signal) {
  const start = queue.then(async () => {
    const wait = Math.max(0, nextStart - Date.now())
    if (wait) await new Promise(resolve => setTimeout(resolve, wait))
    signal.throwIfAborted(); nextStart = Date.now() + 250
  })
  queue = start.catch(() => {})
  await start
  const response = await fetcher(url, { headers: { 'User-Agent': 'Anthracite yechan030102@gmail.com', Accept: 'application/json' }, signal, redirect: 'error' })
  if (!response.ok) throw Object.assign(new Error('SEC unavailable'), { status: response.status })
  return response.json()
}

export function createFinancialsHandler({ fetcher = fetch, now = Date.now } = {}) {
  let companies, companiesAt = 0, companyRequest
  const cache = new Map(), pending = new Map(), limit = createLimiter(30, 60000, now)
  async function collect(symbol) {
    const signal = AbortSignal.timeout(20000)
    if (!companies || now() - companiesAt >= DAY) {
      companyRequest ||= secJson(fetcher, 'https://www.sec.gov/files/company_tickers.json', signal).then(data => {
        if (!data || typeof data !== 'object' || !Object.values(data).some(row => typeof row?.ticker === 'string')) throw new Error('Invalid company list')
        companies = data; companiesAt = now()
      }).finally(() => { companyRequest = null })
      await companyRequest
    }
    const company = Object.values(companies).find(row => typeof row?.ticker === 'string' && tickerKey(row.ticker) === tickerKey(symbol))
    if (!company || !Number.isSafeInteger(company.cik_str) || company.cik_str <= 0) return { symbol, results: [], source: 'SEC EDGAR', status: 'not_available', fetchedAt: now(), stale: false }
    const cik = String(company.cik_str).padStart(10, '0')
    let facts
    try { facts = await secJson(fetcher, `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, signal) }
    catch (error) { if (error.status === 404) return { symbol, results: [], source: 'SEC EDGAR', cik, status: 'not_available', fetchedAt: now(), stale: false }; throw error }
    return { symbol, results: annualFinancials(facts, cik, now()), source: 'SEC EDGAR', cik, company: facts.entityName, fetchedAt: now(), stale: false, status: 'ok' }
  }
  return async request => {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' })
    if (crossSite(request)) return json({ error: 'Forbidden' }, 403)
    const params = new URL(request.url).searchParams, symbol = params.get('ticker')
    if (params.size !== 1 || params.getAll('ticker').length !== 1 || !/^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(symbol || '')) return json({ error: 'Invalid ticker' }, 400)
    if (!limit(clientId(request))) return json({ error: 'Too many requests' }, 429, { 'Retry-After': '60' })
    const previous = cache.get(symbol)
    if (previous && now() - previous.fetchedAt < 6 * 3600000) return json(previous, 200, { 'Cache-Control': 'public, s-maxage=3600' })
    try {
      if (!pending.has(symbol)) pending.set(symbol, collect(symbol).then(data => {
        if (cache.size >= 100) cache.delete(cache.keys().next().value)
        cache.set(symbol, data); return data
      }).finally(() => pending.delete(symbol)))
      return json(await pending.get(symbol), 200, { 'Cache-Control': 'public, s-maxage=3600' })
    } catch {
      if (previous && now() - previous.fetchedAt <= 7 * DAY) return json({ ...previous, stale: true }, 200)
      return json({ error: 'SEC annual financials temporarily unavailable', source: 'SEC EDGAR' }, 503)
    }
  }
}
