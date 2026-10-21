export const ECONOMIC_NOW = Date.parse('2026-10-21T12:00:00Z')
export function economicFixture() {
  const observations = []
  for (let y = 2020; y <= 2026; y++) for (let m = 1; m <= (y === 2026 ? 9 : 12); m++) observations.push({ date: `${y}-${String(m).padStart(2, '0')}-01`, value: y === 2026 ? 104 : 100 })
  return { version: 1, series: [
    { id: 'cpi', observations },
    { id: 'unemployment', observations: observations.map(p => ({ ...p, value: p.date === '2026-09-01' ? 4.2 : 4.1 })) },
    { id: 'effr', observations: Array.from({ length: 60 }, (_, i) => { const d = new Date(ECONOMIC_NOW - (61 - i) * 86400000); return { date: d.toISOString().slice(0, 10), value: 3.88 } }).filter(p => ![0, 6].includes(new Date(p.date).getUTCDay())) },
  ].map(s => ({ ...s, collectedAt: new Date(ECONOMIC_NOW).toISOString(), attemptedAt: new Date(ECONOMIC_NOW).toISOString(), error: null })) }
}
export const blsFixture = () => ({ status: 'REQUEST_SUCCEEDED', message: [], Results: { series: economicFixture().series.slice(0, 2).map((s, i) => ({ seriesID: ['CUUR0000SA0', 'LNS14000000'][i], data: s.observations.map(p => ({ year: p.date.slice(0, 4), period: `M${p.date.slice(5, 7)}`, value: String(p.value), footnotes: [{}] })).reverse() })) } })
export const effrFixture = () => ({ refRates: economicFixture().series[2].observations.map(p => ({ effectiveDate: p.date, percentRate: p.value, type: 'EFFR', revisionIndicator: '' })).reverse() })
