const DAY = 86400000
const ANNUAL = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A'])
const FORMS = new Set([...ANNUAL, '10-Q', '10-Q/A'])
const definitions = {
  'us-gaap': {
    revenues: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'],
    other_revenues: ['RevenueNotFromContractWithCustomer'],
    operating_income_loss: ['OperatingIncomeLoss'], net_income_loss: ['NetIncomeLoss', 'ProfitLoss'],
    diluted_earnings_per_share: ['EarningsPerShareDiluted'], equity: ['StockholdersEquity'], liabilities: ['Liabilities'],
    operating_cash_flow: ['NetCashProvidedByUsedInOperatingActivities'],
    capital_expenditures: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  },
  'ifrs-full': {
    revenues: ['Revenue'], operating_income_loss: ['ProfitLossFromOperatingActivities'], net_income_loss: ['ProfitLoss'],
    diluted_earnings_per_share: ['DilutedEarningsLossPerShare'], equity: ['EquityAttributableToOwnersOfParent'], liabilities: ['Liabilities'],
    operating_cash_flow: ['CashFlowsFromUsedInOperatingActivities'],
    capital_expenditures: ['PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'],
  },
}
const incomeKeys = ['revenues', 'operating_income_loss', 'net_income_loss', 'diluted_earnings_per_share']
const cashKeys = ['operating_cash_flow', 'capital_expenditures']
const flowKeys = [...incomeKeys.filter(key => key !== 'diluted_earnings_per_share'), ...cashKeys]
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const days = (start, end) => (Date.parse(end) - Date.parse(start)) / DAY
const nextDate = date => new Date(Date.parse(date) + DAY).toISOString().slice(0, 10)
const duration = (row, min, max) => validDate(row.start) && days(row.start, row.end) >= min && days(row.start, row.end) <= max
const newest = (a, b) => b.filed.localeCompare(a.filed) || b.accn.localeCompare(a.accn) || a.priority - b.priority
const uniqueSources = sources => [...new Map(sources.map(source => [JSON.stringify(source), source])).values()]

function namespaceHistory(data, cik, namespace, now) {
  const today = new Date(now).toISOString().slice(0, 10), facts = data.facts[namespace]
  const url = accn => `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accn.replaceAll('-', '')}/${accn}-index.html`
  const all = Object.fromEntries(Object.entries(definitions[namespace]).map(([key, tags]) => [key,
    tags.flatMap((tag, priority) => Object.entries(facts[tag]?.units || {}).flatMap(([unit, rows]) => Array.isArray(rows) ? rows.filter(row => row && FORMS.has(row.form)
      && validDate(row.end) && row.end <= today && validDate(row.filed) && row.filed <= today && row.filed >= row.end
      && /^\d{10}-\d{2}-\d{6}$/.test(row.accn || '') && Number.isFinite(row.val)
      && (key === 'diluted_earnings_per_share' ? /^[A-Z]{3}\/shares$/.test(unit) : /^[A-Z]{3}$/.test(unit)))
      .map(row => ({ ...row, unit, tag, priority, key })) : [])),
  ]))
  function choose(rows, key) {
    if (!rows.length) return undefined
    const first = [...rows].sort((a, b) => a.priority - b.priority)[0]
    // Contract revenue can be only a subtotal for insurers/conglomerates. Never
    // label it total revenue when the same period reports additional revenue.
    if (key === 'revenues' && first.tag === 'RevenueFromContractWithCustomerExcludingAssessedTax'
      && all.other_revenues?.some(row => row.accn === first.accn && row.start === first.start && row.end === first.end && row.val !== 0)) return undefined
    if (rows.some(row => row.priority === first.priority && (row.unit !== first.unit || row.val !== first.val))) return undefined
    if (key === 'capital_expenditures' && first.val < 0) return undefined
    const revised = all[key].some(row => row.start === first.start && row.end === first.end && row.tag === first.tag && row.unit === first.unit && row.filed < first.filed && row.val !== first.val)
    return { value: first.val, unit: first.unit, label: first.tag, ...(key === 'capital_expenditures' ? { basis: first.tag === 'PaymentsToAcquireProductiveAssets' ? 'productive_assets' : 'ppe' } : {}), sources: [{ accession: first.accn, form: first.form, filing_date: first.filed,
      ...(first.start ? { start_date: first.start } : {}), end_date: first.end, tag: first.tag, value: first.val, unit: first.unit, url: url(first.accn), revised }] }
  }
  function direct(key, anchor, instant = false) {
    return choose(all[key].filter(row => row.accn === anchor.accn && row.end === anchor.end && (instant ? !row.start : row.start === anchor.start)), key)
  }
  function difference(key, anchor, start) {
    // Subtract only the same concept, fiscal start and currency. A later revision
    // of the operand or a known amendment cannot be combined across filings.
    let totals = all[key].filter(row => row.accn === anchor.accn && row.end === anchor.end && row.start < start && duration(row, 140, 400)).sort((a, b) => b.start.localeCompare(a.start))
    // If the total exists but its matching prefix is absent, a contract-revenue
    // difference cannot silently stand in for the total's quarterly figure.
    if (key === 'revenues' && totals.length) totals = totals.filter(row => row.priority === Math.min(...totals.map(row => row.priority)))
    for (const total of totals) {
      const before = all[key].filter(row => row.tag === total.tag && row.start === total.start && nextDate(row.end) === start).sort(newest)
      const eligible = before.find(row => row.filed <= total.filed)
      if (!eligible || before.some(row => row.filed > total.filed && (row.val !== eligible.val || row.unit !== eligible.unit))) continue
      const selected = before.filter(row => row.accn === eligible.accn)
      const a = choose([total], key), b = choose(selected, key)
      if (!a || !b || a.unit !== b.unit) continue
      if (total.accn !== eligible.accn && [...a.sources, ...b.sources].some(source => source.form.endsWith('/A') || source.revised)) continue
      const value = a.value - b.value
      if (!Number.isFinite(value) || key === 'capital_expenditures' && value < 0) continue
      return { value, unit: a.unit, label: total.tag, ...(a.basis ? { basis: a.basis } : {}), calculation: 'difference', sources: uniqueSources([...a.sources, ...b.sources]) }
    }
  }
  function cashFlow(operating_cash_flow, capital_expenditures) {
    const free_cash_flow = operating_cash_flow && capital_expenditures && operating_cash_flow.unit === capital_expenditures.unit
      ? { value: operating_cash_flow.value - capital_expenditures.value, unit: operating_cash_flow.unit, basis: capital_expenditures.basis, calculation: 'ocf_minus_capex', sources: uniqueSources([...operating_cash_flow.sources, ...capital_expenditures.sources]) } : undefined
    return { operating_cash_flow, capital_expenditures, free_cash_flow }
  }
  function row(anchor, period, start = anchor.start, derived = false) {
    const take = key => derived ? difference(key, anchor, start) : direct(key, anchor) ?? (period === 'Q' && cashKeys.includes(key) ? difference(key, anchor, start) : undefined)
    const values = Object.fromEntries(incomeKeys.map(key => [key, derived && key === 'diluted_earnings_per_share' ? undefined : take(key)]))
    const cash = cashFlow(take('operating_cash_flow'), take('capital_expenditures'))
    return { start_date: start, end_date: anchor.end, filing_date: anchor.filed, fiscal_period: period, accounting_standard: namespace,
      form: anchor.form, amended: anchor.form.endsWith('/A'), calculated: derived, source_filing_url: url(anchor.accn),
      financials: { income_statement: values, balance_sheet: { equity: direct('equity', anchor, true), liabilities: direct('liabilities', anchor, true) }, cash_flow_statement: cash } }
  }
  const anchors = [...incomeKeys, ...cashKeys].flatMap(key => all[key]).sort((a, b) => b.end.localeCompare(a.end) || newest(a, b))
  const filingEnds = new Map()
  for (const record of Object.values(all).flat()) filingEnds.set(record.accn, record.end > (filingEnds.get(record.accn) || '') ? record.end : filingEnds.get(record.accn))
  function rowsFor(period) {
    const seen = new Set()
    return anchors.filter(anchor => period === 'FY' ? ANNUAL.has(anchor.form) && duration(anchor, 300, 400) : duration(anchor, 70, 110))
      .filter(anchor => { if (seen.has(anchor.end)) return false; seen.add(anchor.end); return true }).slice(0, period === 'FY' ? 5 : 12).map(anchor => {
        if (period === 'Q') {
          const samePeriod = anchors.filter(a => a.start === anchor.start && a.end === anchor.end)
          const original = samePeriod.find(a => filingEnds.get(a.accn) === a.end)
          // A later filing may merely repeat one comparative value. Keep the
          // complete original filing only when every later repeated fact agrees.
          if (original && samePeriod.filter(a => a.filed > original.filed).every(a => {
            const prior = direct(a.key, original)
            return !a.form.endsWith('/A') && prior?.unit === a.unit && prior.value === a.val
          })) anchor = original
        }
        return row(anchor, period)
      })
  }
  const annual = rowsFor('FY').slice(0, 5), quarterly = rowsFor('Q')
  for (const yearly of annual) {
    if (quarterly.some(q => q.end_date === yearly.end_date)) continue
    const anchor = anchors.find(a => a.start === yearly.start_date && a.end === yearly.end_date && a.filed === yearly.filing_date && url(a.accn) === yearly.source_filing_url)
    const prefix = anchors.filter(a => a.form.startsWith('10-Q') && a.start === yearly.start_date && duration(a, 240, 300) && days(a.end, yearly.end_date) >= 70 && days(a.end, yearly.end_date) <= 110).sort((a, b) => b.end.localeCompare(a.end) || newest(a, b))[0]
    if (anchor && prefix) {
      const fourth = row(anchor, 'Q', nextDate(prefix.end), true)
      if (flowKeys.some(key => field(fourth, key))) quarterly.push(fourth)
    }
  }
  return { annual, quarterly: quarterly.sort((a, b) => b.end_date.localeCompare(a.end_date)).slice(0, 12) }
}
export function field(row, key) { return row.financials.income_statement[key] ?? row.financials.cash_flow_statement?.[key] }

function trailing(quarters) {
  const rows = quarters.slice(0, 4)
  if (rows.length !== 4 || rows.some((row, index) => row.accounting_standard !== rows[0].accounting_standard || index && nextDate(row.end_date) !== rows[index - 1].start_date)
    || days(rows[3].start_date, rows[0].end_date) < 300 || days(rows[3].start_date, rows[0].end_date) > 400) return []
  const sum = key => {
    const values = rows.map(row => field(row, key))
    if (values.some(value => !value || value.unit !== values[0].unit || value.basis !== values[0].basis || value.sources.some(source => source.form.endsWith('/A') || source.revised))) return undefined
    const value = values.reduce((total, item) => total + item.value, 0)
    return Number.isFinite(value) ? { value, unit: values[0].unit, ...(values[0].basis ? { basis: values[0].basis } : {}), calculation: 'sum', sources: uniqueSources(values.flatMap(item => item.sources)) } : undefined
  }
  const income = Object.fromEntries(flowKeys.slice(0, 3).map(key => [key, sum(key)])), operating = sum('operating_cash_flow'), capex = sum('capital_expenditures')
  const free = operating && capex && operating.unit === capex.unit ? { value: operating.value - capex.value, unit: operating.unit, basis: capex.basis, calculation: 'ocf_minus_capex', sources: uniqueSources([...operating.sources, ...capex.sources]) } : undefined
  if (![...Object.values(income), operating, capex].some(Boolean)) return []
  return [{ ...rows[0], start_date: rows[3].start_date, filing_date: rows.map(row => row.filing_date).sort().at(-1), fiscal_period: 'TTM', calculated: true,
    financials: { income_statement: income, balance_sheet: {}, cash_flow_statement: { operating_cash_flow: operating, capital_expenditures: capex, free_cash_flow: free } } }]
}

export function financialHistory(data, cik, now = Date.now()) {
  if (Number(data?.cik) !== Number(cik) || !data?.facts) throw new Error('Company mismatch')
  const histories = Object.keys(definitions).filter(namespace => data.facts[namespace]).map(namespace => namespaceHistory(data, cik, namespace, now))
  const merge = key => {
    const seen = new Set()
    return histories.flatMap(h => h[key]).sort((a, b) => b.end_date.localeCompare(a.end_date) || b.filing_date.localeCompare(a.filing_date))
      .filter(row => { if (seen.has(row.end_date)) return false; seen.add(row.end_date); return true })
  }
  const annual = merge('annual').slice(0, 5), quarterly = merge('quarterly').slice(0, 8)
  return { annual, quarterly, ttm: trailing(quarterly) }
}
