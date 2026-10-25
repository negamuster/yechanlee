import { FRED_ECONOMIC_SERIES, monthOffset } from './economic-series.js'

export const FRED_ECONOMIC_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv'
export function fredEconomicUrl(from, to) {
  return `${FRED_ECONOMIC_CSV}?id=CPIAUCNS,UNRATE&cosd=${from}&coed=${to}`
}

// Fixed untransformed monthly series. The public CSV may return history before
// the requested window; validate it, then explicitly select the required years.
// Numeric/date-only cells need no general-purpose quoted CSV interpretation.
export function parseFREDCSV(text, id, { from, to }) {
  const expected = FRED_ECONOMIC_SERIES[id]
  if (!expected || typeof text !== 'string') throw new Error('invalid_fred_csv')
  const lines = text.replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/)
  const headers = lines.shift().split(',')
  if (headers.length !== 3 || !['observation_date', 'CPIAUCNS', 'UNRATE'].every(h => headers.includes(h)) || lines.length > 3000) throw new Error('invalid_fred_csv')
  const dateColumn = headers.indexOf('observation_date'), valueColumn = headers.indexOf(expected)
  let previousDate = ''
  const observations = []
  for (const line of lines) {
    const cells = line.split(','), date = cells[dateColumn], raw = cells[valueColumn]
    if (cells.length !== 3 || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(date) || date <= previousDate || date > to
      || raw !== '' && raw !== '.' && !/^-?\d+(?:\.\d+)?$/.test(raw)) throw new Error('invalid_fred_csv')
    previousDate = date
    if (date >= from) observations.push({ date, value: raw === '' || raw === '.' ? null : Number(raw) })
  }
  if (observations.length < 24 || !observations.some(p => p.value !== null)) throw new Error('fred_history_missing')
  // A missing value must have an explicit row; truncation or a missing month is
  // not allowed to replace a complete previously verified history.
  for (let date = from, i = 0; date <= observations.at(-1).date; date = monthOffset(date, 1), i++) {
    if (observations[i]?.date !== date) throw new Error('fred_history_missing')
  }
  return observations
}
