export function filingFixture(overrides = {}) {
  const data = {
    verification: 'matched', holdingsComplete: true, period: '2026-06-30', availablePeriods: ['2026-06-30', '2026-03-31'],
    previousPeriod: '2026-03-31', previousAvailable: true, filedAt: '2026-08-14', checkedAt: Date.parse('2026-10-21T00:00:00Z'),
    holdings: [
      { name: 'ALPHA INC', cusip: '000000001', title: 'COM', shares: 30, prevShares: 20, value: 300 },
      { name: 'BETA INC', cusip: '000000002', title: 'CL A', shares: 100, prevShares: 200, value: 200 },
      { name: 'NEW INC', cusip: '000000003', title: 'COM', shares: 50, prevShares: 0, value: 100 },
    ], closedHoldings: [], sources: [{ accession: '0000000001-26-000001', form: '13F-HR', indexUrl: 'https://www.sec.gov/Archives/example-index.htm', reportedTotal: 600, parsedTotal: 600, reportedCount: 3, parsedCount: 3 }], ...overrides,
  }
  return { ...data, totalValue: overrides.totalValue ?? data.holdings.reduce((sum, h) => sum + h.value, 0), holdingCount: overrides.holdingCount ?? data.holdings.length }
}
export const manyHoldings = (count = 67) => Array.from({ length: count }, (_, i) => ({ name: `HOLDING ${String(i + 1).padStart(3, '0')}`, cusip: String(i + 1).padStart(9, '0'), title: 'COM', shares: 100 + i, prevShares: 100, value: count - i }))
