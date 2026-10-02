// Public FRED calendar lists release times in US Central Time.
import { zonedISO, validDate, dateInNY } from './calendar.js'
export const FRED_RELEASES = {
  10: 'Consumer Price Index', 11: 'Employment Cost Index', 50: 'Employment Situation',
  192: 'Job Openings and Labor Turnover Survey', 113: 'Metropolitan Area Employment and Unemployment',
  46: 'Producer Price Index', 47: 'Productivity and Costs', 112: 'State Employment and Unemployment',
  188: 'U.S. Import and Export Price Indexes',
}
export const FRED_URL = 'https://fred.stlouisfed.org/releases/calendar'
export function parseFREDCalendar(html, rid) {
  if (!FRED_RELEASES[rid] || !html.includes('All times are US Central Time.')) throw new Error('invalid_fred_calendar')
  const table = html.match(/<div id="release-dates-pager">([\s\S]*?)<\/tbody>/)?.[1]
  const count = html.match(/Releases\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/)
  if (!table || !count || Number(count[1]) !== 1 || count[2] !== count[3]) throw new Error('incomplete_fred_calendar')
  let date = null
  const events = []
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const heading = row[1].match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/)
    if (heading) {
      const month = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(heading[1]) + 1
      date = `${heading[3]}-${String(month).padStart(2,'0')}-${heading[2].padStart(2,'0')}`
      if (!validDate(date)) throw new Error('invalid_fred_date')
      continue
    }
    const release = row[1].match(/href="\/release\?rid=(\d+)"/)
    if (!release) continue
    if (!date || Number(release[1]) !== Number(rid)) throw new Error('unexpected_fred_release')
    const cell = row[1].match(/<td\b[^>]*>([\s\S]*?)<\/td>/)?.[1].replace(/<[^>]*>/g,'').trim()
    const time = cell?.match(/^(\d{1,2}):(\d{2})\s*([ap])m$/i)
    if (!time && cell !== 'N/A') throw new Error('invalid_fred_time')
    if (time && (Number(time[1]) < 1 || Number(time[1]) > 12 || Number(time[2]) > 59)) throw new Error('invalid_fred_time')
    const startAt = time ? zonedISO(date, Number(time[1]) % 12 + (time[3].toLowerCase() === 'p' ? 12 : 0), Number(time[2]), 'America/Chicago') : null
    events.push({ rid: Number(rid), date: startAt ? dateInNY(Date.parse(startAt)) : date, startAt })
  }
  if (events.length !== Number(count[3])) throw new Error('incomplete_fred_events')
  return events
}
export function readFREDSnapshot(snapshot, now = Date.now()) {
  const at = Date.parse(snapshot?.checkedAt)
  if (snapshot?.version !== 1 || snapshot.sourceUrl !== FRED_URL || !Number.isFinite(at) || at > now + 60000 || now - at > 7 * 86400000 || !validDate(snapshot.from) || !validDate(snapshot.to) || snapshot.from > snapshot.to || !Array.isArray(snapshot.events) || !snapshot.events.length || !Array.isArray(snapshot.releaseIds) || Object.keys(FRED_RELEASES).some(id => !snapshot.releaseIds.includes(Number(id)))) throw new Error('invalid_fred_snapshot')
  const events = snapshot.events.map(e => {
    if (!FRED_RELEASES[e.rid] || !validDate(e.date) || e.date < snapshot.from || e.date > snapshot.to || (e.startAt !== null && (!Number.isFinite(Date.parse(e.startAt)) || dateInNY(Date.parse(e.startAt)) !== e.date))) throw new Error('invalid_fred_event')
    return { id: `fred-bls:${e.rid}:${e.date}`, title: FRED_RELEASES[e.rid], category: 'Economic', date: e.date, startAt: e.startAt, session: null, major: [10,50,192,46].includes(e.rid), source: 'FRED (BLS)', sourceUrl: `${FRED_URL}?rid=${e.rid}`, estimated: false }
  })
  return { events, at, state: now - at > 2 * 86400000 ? 'stale' : 'snapshot', from: snapshot.from, to: snapshot.to }
}
