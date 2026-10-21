export const FINANCIAL_NOW = Date.parse('2026-10-21T12:00Z')
export const financialFacts = () => {
  const gaap = {}, facts = { cik: 1, entityName: 'Fixture Company', facts: { 'us-gaap': gaap } }
  const add = (tag, value, row, unit = 'USD') => { ((gaap[tag] ||= { units: {} }).units[unit] ||= []).push({ ...row, val: value }) }
  const accession = (year, n) => `0000000001-${String(year).slice(-2)}-${String(n).padStart(6, '0')}`
  for (let year = 2021; year <= 2025; year++) {
    const row = { start: `${year}-01-01`, end: `${year}-12-31`, filed: `${year + 1}-02-10`, form: '10-K', accn: accession(year + 1, 90), fy: year, fp: 'FY' }
    for (const [tag, value] of Object.entries({ RevenueFromContractWithCustomerExcludingAssessedTax: 100 - (2025 - year) * 10, OperatingIncomeLoss: 20, NetIncomeLoss: -10, NetCashProvidedByUsedInOperatingActivities: 10, PaymentsToAcquirePropertyPlantAndEquipment: 4 })) add(tag, value, row)
    add('EarningsPerShareDiluted', 0, row, 'USD/shares')
    const instant = { ...row }; delete instant.start
    add('StockholdersEquity', 50, instant); add('Liabilities', 20, instant)
  }
  for (const year of [2024, 2025, 2026]) for (let q = 1; q <= (year === 2026 ? 2 : 3); q++) {
    const start = `${year}-${['01', '04', '07'][q - 1]}-01`, end = `${year}-${['03-31', '06-30', '09-30'][q - 1]}`
    const row = { start, end, filed: `${year}-${['05-10', '08-10', '11-10'][q - 1]}`, form: '10-Q', accn: accession(year, q), fy: year, fp: `Q${q}` }
    const revenue = year === 2026 ? [50, 60][q - 1] : [10, 20, 30][q - 1], ytdRevenue = year === 2026 ? [50, 110][q - 1] : [10, 30, 60][q - 1]
    for (const [tag, divisor] of [['RevenueFromContractWithCustomerExcludingAssessedTax', 1], ['OperatingIncomeLoss', 5], ['NetIncomeLoss', 10]]) {
      add(tag, revenue / divisor, row)
      if (q > 1) add(tag, ytdRevenue / divisor, { ...row, start: `${year}-01-01` })
    }
    add('EarningsPerShareDiluted', 0, row, 'USD/shares')
    add('NetCashProvidedByUsedInOperatingActivities', year === 2026 ? [5, 11][q - 1] : [1, 3, 6][q - 1], { ...row, start: `${year}-01-01` })
    add('PaymentsToAcquirePropertyPlantAndEquipment', year === 2026 ? [1, 3][q - 1] : [0, 1, 2][q - 1], { ...row, start: `${year}-01-01` })
  }
  return facts
}
